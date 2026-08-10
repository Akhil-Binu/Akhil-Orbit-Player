import React, { useState, useEffect, useMemo, useRef } from 'react';
import JSZip from 'jszip';
import { 
  Archive, FileText, Image as ImageIcon, Code, Folder,
  Download, Search, Copy, Check, ChevronRight, ChevronDown, 
  FileQuestion, Music, RefreshCw, CheckCircle2, Eye, List, FolderTree,
  AlertCircle, HardDrive, FileSpreadsheet, Presentation
} from 'lucide-react';
import { DocumentViewer } from './DocumentViewer';
import { getFileType, type CourseFile } from '../utils/fileSystem';

interface ArchiveViewerProps {
  lesson: CourseFile;
  fileObj: File;
  onToggleCompleted?: (path: string) => void;
  isCompleted?: boolean;
}

export interface ArchiveEntry {
  path: string;
  name: string;
  isDir: boolean;
  size: number;
  date: Date;
  category: 'code' | 'image' | 'doc' | 'media' | 'folder' | 'other';
}

interface TreeNode {
  name: string;
  path: string;
  isDir: boolean;
  entry?: ArchiveEntry;
  children: Record<string, TreeNode>;
}

export const ArchiveViewer: React.FC<ArchiveViewerProps> = ({
  lesson,
  fileObj,
  onToggleCompleted,
  isCompleted = false
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<ArchiveEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<ArchiveEntry | null>(null);
  
  // Preview state
  const [previewLoading, setPreviewLoading] = useState<boolean>(false);
  const [innerFileState, setInnerFileState] = useState<{
    lesson: CourseFile;
    fileObj: File;
    contentUrl: string;
    textData?: string;
  } | null>(null);
  
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'tree' | 'list'>('tree');
  const [activeFilter, setActiveFilter] = useState<'all' | 'code' | 'image' | 'doc'>('all');
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<boolean>(false);

  // Keep JSZip reference in a ref so it doesn't trigger re-renders
  const zipRef = useRef<JSZip | null>(null);

  // Categorize extensions helper
  const getCategory = (filePath: string, isDir: boolean): ArchiveEntry['category'] => {
    if (isDir) return 'folder';
    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    if (['js', 'jsx', 'ts', 'tsx', 'html', 'css', 'scss', 'json', 'py', 'java', 'cpp', 'c', 'cs', 'go', 'rs', 'php', 'rb', 'sh', 'sql', 'yaml', 'yml', 'toml', 'env', 'xml', 'md'].includes(ext)) {
      return 'code';
    }
    if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp'].includes(ext)) {
      return 'image';
    }
    if (['pdf', 'docx', 'doc', 'pptx', 'ppt', 'xlsx', 'xls', 'csv', 'tsv', 'ods', 'odt', 'odp', 'txt', 'rtf', 'log'].includes(ext)) {
      return 'doc';
    }
    if (['mp3', 'wav', 'mp4', 'webm', 'ogg', 'mov', 'flac', 'm4a'].includes(ext)) {
      return 'media';
    }
    return 'other';
  };

  const formatSize = (bytes: number) => {
    if (!bytes || bytes <= 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // 1. Load ZIP Structure
  useEffect(() => {
    let isCancelled = false;
    zipRef.current = null;

    const loadArchive = async () => {
      setLoading(true);
      setError(null);
      setEntries([]);
      setSelectedEntry(null);
      setInnerFileState(null);

      try {
        if (fileObj.size > 300 * 1024 * 1024) {
          throw new Error('Archive is very large (> 300MB). To avoid freezing your browser, please download the archive file directly.');
        }

        const buffer = await fileObj.arrayBuffer();
        if (isCancelled) return;

        const zip = await JSZip.loadAsync(buffer);
        if (isCancelled) return;

        zipRef.current = zip;

        const parsed: ArchiveEntry[] = [];
        const initialExpanded: Record<string, boolean> = {};
        let fileCount = 0;

        zip.forEach((rawPath, zipEntry) => {
          if (fileCount > 2000) return;

          const cleanPath = rawPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
          if (!cleanPath) return;

          if (cleanPath.startsWith('__MACOSX') || cleanPath.includes('/._') || cleanPath.startsWith('._')) {
            return;
          }

          const isDir = zipEntry.dir || rawPath.endsWith('/') || rawPath.endsWith('\\');
          const parts = cleanPath.split('/').filter(Boolean);
          const name = parts[parts.length - 1] || cleanPath;

          const entry: ArchiveEntry = {
            path: cleanPath,
            name,
            isDir,
            size: (zipEntry as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize || 0,
            date: zipEntry.date || new Date(),
            category: getCategory(cleanPath, isDir)
          };

          parsed.push(entry);
          fileCount++;

          if (isDir && parts.length <= 2) {
            initialExpanded[cleanPath] = true;
          }
        });

        parsed.sort((a, b) => {
          if (a.isDir && !b.isDir) return -1;
          if (!a.isDir && b.isDir) return 1;
          return a.path.localeCompare(b.path, undefined, { numeric: true });
        });

        if (!isCancelled) {
          setEntries(parsed);
          setExpandedFolders(initialExpanded);

          // Find first small text/doc file (< 50KB) to select by default
          const firstSmallFile = parsed.find(e => 
            !e.isDir && (e.name.toLowerCase().includes('readme') || e.name.toLowerCase().startsWith('index') || e.category === 'doc' || e.category === 'code') && e.size < 50 * 1024
          ) || parsed.find(e => !e.isDir && e.size < 50 * 1024);

          if (firstSmallFile) {
            setSelectedEntry(firstSmallFile);
          }
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          console.error('Error reading zip archive:', err);
          setError((err as Error).message || 'Failed to read compressed file.');
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    loadArchive();

    return () => {
      isCancelled = true;
      zipRef.current = null;
    };
  }, [fileObj, lesson]);

  // 2. Extract and Prepare File for Viewing on Demand
  useEffect(() => {
    if (!selectedEntry || selectedEntry.isDir || !zipRef.current) {
      setInnerFileState(null);
      return;
    }

    let isCancelled = false;
    let createdUrl = '';

    const extractFile = async () => {
      setPreviewLoading(true);
      try {
        const zip = zipRef.current;
        if (!zip) return;

        const zipFile = zip.file(selectedEntry.path) || 
                        zip.file(selectedEntry.path + '/') || 
                        Object.values(zip.files).find(f => f.name.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '') === selectedEntry.path);

        if (!zipFile) {
          throw new Error('File not found in archive');
        }

        const fileType = getFileType(selectedEntry.name);

        // A. Document files (.docx, .doc, .pptx, .ppt, .xlsx, .xls, .csv, .pdf) or Images or Media
        if (['document', 'pdf', 'image', 'audio', 'video', 'html'].includes(fileType)) {
          const blob = await zipFile.async('blob');
          if (isCancelled) return;

          const extractedFile = new File([blob], selectedEntry.name, {
            type: blob.type || 'application/octet-stream'
          });

          createdUrl = URL.createObjectURL(blob);

          const innerLesson: CourseFile = {
            name: selectedEntry.name,
            path: selectedEntry.path,
            type: fileType,
            file: extractedFile,
            size: selectedEntry.size
          };

          setInnerFileState({
            lesson: innerLesson,
            fileObj: extractedFile,
            contentUrl: createdUrl
          });
        } 
        // B. Code / Markdown / Text / JSON files
        else {
          if (selectedEntry.size > 2 * 1024 * 1024) {
            setInnerFileState({
              lesson: {
                name: selectedEntry.name,
                path: selectedEntry.path,
                type: 'unknown',
                size: selectedEntry.size
              },
              fileObj: new File([], selectedEntry.name),
              contentUrl: '',
              textData: `File is large (${formatSize(selectedEntry.size)}). Click "Extract" to download and open locally.`
            });
            return;
          }

          const rawText = await zipFile.async('string');
          if (isCancelled) return;

          const isTruncated = rawText.length > 40000;
          const safeText = isTruncated 
            ? rawText.slice(0, 40000) + '\n\n/* ---------------------------------------------------------------------- */\n/* Preview truncated to first 40KB. Click "Extract" to view complete file. */\n/* ---------------------------------------------------------------------- */'
            : rawText;

          const blob = new Blob([rawText], { type: 'text/plain;charset=utf-8' });
          createdUrl = URL.createObjectURL(blob);

          setInnerFileState({
            lesson: {
              name: selectedEntry.name,
              path: selectedEntry.path,
              type: fileType,
              size: selectedEntry.size
            },
            fileObj: new File([blob], selectedEntry.name, { type: 'text/plain' }),
            contentUrl: createdUrl,
            textData: safeText
          });
        }
      } catch (err) {
        console.error('Preview error:', err);
        if (!isCancelled) {
          setInnerFileState(null);
        }
      } finally {
        if (!isCancelled) {
          setPreviewLoading(false);
        }
      }
    };

    extractFile();

    return () => {
      isCancelled = true;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [selectedEntry]);

  // Extract and download single file
  const handleDownloadEntry = async (entry: ArchiveEntry) => {
    if (!zipRef.current || entry.isDir) return;
    try {
      const zip = zipRef.current;
      const zipFile = zip.file(entry.path) || Object.values(zip.files).find(f => f.name.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '') === entry.path);
      if (!zipFile) {
        alert('File not found in archive.');
        return;
      }
      const blob = await zipFile.async('blob');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = entry.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Extract error:', err);
      alert('Could not extract file.');
    }
  };

  const handleDownloadFullArchive = () => {
    const url = URL.createObjectURL(fileObj);
    const a = document.createElement('a');
    a.href = url;
    a.download = lesson.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyText = () => {
    if (innerFileState?.textData) {
      navigator.clipboard.writeText(innerFileState.textData);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Stats calculation
  const stats = useMemo(() => {
    let totalFiles = 0;
    let totalFolders = 0;
    let uncompressedSize = 0;

    entries.forEach(e => {
      if (e.isDir) {
        totalFolders++;
      } else {
        totalFiles++;
        uncompressedSize += e.size;
      }
    });

    const compressedSize = fileObj.size;
    const ratio = uncompressedSize > 0 
      ? Math.max(0, Math.round((1 - compressedSize / uncompressedSize) * 100))
      : 0;

    return {
      totalFiles,
      totalFolders,
      uncompressedSize,
      compressedSize,
      ratio: ratio > 0 ? `${ratio}% space saved` : '0%'
    };
  }, [entries, fileObj]);

  // Filtered files
  const filteredEntries = useMemo(() => {
    const term = searchQuery.toLowerCase().trim();
    return entries.filter(entry => {
      if (term && !entry.path.toLowerCase().includes(term)) {
        return false;
      }
      if (activeFilter === 'all') return true;
      if (entry.isDir) return true;
      if (activeFilter === 'code') return entry.category === 'code';
      if (activeFilter === 'image') return entry.category === 'image';
      if (activeFilter === 'doc') return entry.category === 'doc';
      return true;
    });
  }, [entries, searchQuery, activeFilter]);

  // Safe tree builder
  const treeRoot = useMemo(() => {
    const root: TreeNode = { name: '', path: '', isDir: true, children: {} };

    filteredEntries.forEach(entry => {
      const cleanPath = entry.path.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
      if (!cleanPath) return;

      const parts = cleanPath.split('/').filter(Boolean);
      let current = root;

      parts.forEach((part, index) => {
        const isLast = index === parts.length - 1;
        const currentPath = parts.slice(0, index + 1).join('/');

        if (!current.children[part]) {
          current.children[part] = {
            name: part,
            path: currentPath,
            isDir: isLast ? entry.isDir : true,
            entry: isLast ? entry : undefined,
            children: {}
          };
        }
        current = current.children[part];
      });
    });

    return root;
  }, [filteredEntries]);

  const toggleFolder = (folderPath: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedFolders(prev => ({
      ...prev,
      [folderPath]: !prev[folderPath]
    }));
  };

  const getEntryIcon = (entry?: ArchiveEntry, isDir = false) => {
    if (isDir) {
      return <Folder size={15} style={{ color: '#f59e0b', flexShrink: 0 }} />;
    }
    if (!entry) return <FileText size={15} style={{ color: '#9ca3af', flexShrink: 0 }} />;

    const ext = entry.name.split('.').pop()?.toLowerCase() || '';
    if (['xlsx', 'xls', 'csv', 'tsv', 'ods'].includes(ext)) {
      return <FileSpreadsheet size={15} style={{ color: '#10b981', flexShrink: 0 }} />;
    }
    if (['pptx', 'ppt', 'ppsx', 'odp'].includes(ext)) {
      return <Presentation size={15} style={{ color: '#f97316', flexShrink: 0 }} />;
    }
    if (['docx', 'doc', 'pdf', 'odt', 'rtf'].includes(ext)) {
      return <FileText size={15} style={{ color: '#3b82f6', flexShrink: 0 }} />;
    }

    switch (entry.category) {
      case 'code': return <Code size={15} style={{ color: '#38bdf8', flexShrink: 0 }} />;
      case 'image': return <ImageIcon size={15} style={{ color: '#fb923c', flexShrink: 0 }} />;
      case 'doc': return <FileText size={15} style={{ color: '#34d399', flexShrink: 0 }} />;
      case 'media': return <Music size={15} style={{ color: '#fb7185', flexShrink: 0 }} />;
      default: return <FileQuestion size={15} style={{ color: '#9ca3af', flexShrink: 0 }} />;
    }
  };

  // Safe tree renderer
  const renderTree = (node: TreeNode, depth = 0): React.ReactNode => {
    if (depth > 20) return null;

    const childKeys = Object.keys(node.children);
    const isExpanded = expandedFolders[node.path] ?? false;
    const isSelected = selectedEntry && node.entry && selectedEntry.path === node.entry.path;

    return (
      <div key={node.path || 'root'} style={{ userSelect: 'none' }}>
        {node.path !== '' && (
          <div
            onClick={(e) => {
              if (node.isDir) {
                toggleFolder(node.path, e);
              } else if (node.entry) {
                setSelectedEntry(node.entry);
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 10px',
              paddingLeft: `${8 + depth * 12}px`,
              borderRadius: '6px',
              cursor: 'pointer',
              background: isSelected ? 'var(--bg-active)' : 'transparent',
              border: isSelected ? '1px solid var(--border-highlight)' : '1px solid transparent',
              color: isSelected ? 'var(--color-primary)' : 'var(--text-primary)',
              fontSize: '0.82rem',
              transition: 'all 0.15s ease',
              marginBottom: '2px'
            }}
            onMouseEnter={(e) => {
              if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
            }}
            onMouseLeave={(e) => {
              if (!isSelected) e.currentTarget.style.background = 'transparent';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {node.isDir ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--text-muted)' }}>
                  {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                </span>
              ) : (
                <span style={{ width: '13px' }} />
              )}
              {getEntryIcon(node.entry, node.isDir)}
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {node.name}
              </span>
            </div>

            {node.entry && !node.isDir && (
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '6px', flexShrink: 0 }}>
                {formatSize(node.entry.size)}
              </span>
            )}
          </div>
        )}

        {(node.path === '' || isExpanded) && childKeys.length > 0 && (
          <div>
            {childKeys
              .map(k => node.children[k])
              .sort((a, b) => {
                if (a.isDir && !b.isDir) return -1;
                if (!a.isDir && b.isDir) return 1;
                return a.name.localeCompare(b.name, undefined, { numeric: true });
              })
              .map(child => renderTree(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      gap: '16px'
    }}>
      {/* Top Header Card */}
      <div style={{
        padding: '12px 18px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'rgba(245, 158, 11, 0.12)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#f59e0b'
          }}>
            <Archive size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0 }}>{lesson.name}</h2>
              <span style={{
                background: 'rgba(245, 158, 11, 0.15)',
                color: '#f59e0b',
                padding: '2px 8px',
                borderRadius: '12px',
                fontSize: '0.72rem',
                fontWeight: 600
              }}>
                ZIP Archive Explorer
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              <span>{stats.totalFiles} files {stats.totalFolders > 0 && `(${stats.totalFolders} folders)`}</span>
              <span>•</span>
              <span>{formatSize(stats.compressedSize)}</span>
              {stats.ratio !== '0%' && (
                <>
                  <span>•</span>
                  <span style={{ color: '#10b981', fontWeight: 500 }}>{stats.ratio}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {onToggleCompleted && (
            <button
              onClick={() => onToggleCompleted(lesson.path)}
              style={{
                background: isCompleted ? 'var(--color-success)' : 'rgba(255,255,255,0.05)',
                color: isCompleted ? 'white' : 'var(--text-secondary)',
                border: '1px solid var(--border-color)',
                padding: '7px 12px',
                borderRadius: '8px',
                fontSize: '0.82rem',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <CheckCircle2 size={14} />
              {isCompleted ? 'Completed' : 'Mark Done'}
            </button>
          )}

          <button
            onClick={handleDownloadFullArchive}
            style={{
              background: 'var(--gradient-accent)',
              color: 'white',
              border: 'none',
              padding: '7px 14px',
              borderRadius: '8px',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <Download size={14} />
            Download ZIP
          </button>
        </div>
      </div>

      {/* Main Body */}
      {loading ? (
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '16px',
          gap: '12px'
        }}>
          <RefreshCw size={28} className="spin" style={{ color: 'var(--color-primary)' }} />
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Reading archive contents in browser...</p>
        </div>
      ) : error ? (
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: '16px',
          padding: '40px',
          textAlign: 'center',
          gap: '14px'
        }}>
          <AlertCircle size={36} color="#ef4444" />
          <h3 style={{ color: 'var(--text-primary)', margin: 0 }}>Archive Notice</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '440px' }}>{error}</p>
          <button
            onClick={handleDownloadFullArchive}
            style={{
              background: 'var(--gradient-accent)',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Download size={14} />
            Download File Directly
          </button>
        </div>
      ) : (
        <div style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '280px 1fr',
          gap: '16px',
          minHeight: '0'
        }}>
          {/* Left Column: Explorer Tree / List */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            {/* Search & View Mode Switcher */}
            <div style={{
              padding: '10px 12px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              <div style={{ display: 'flex', gap: '6px' }}>
                <div style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '4px 8px'
                }}>
                  <Search size={13} style={{ color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    placeholder="Search in archive..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      color: 'var(--text-primary)',
                      fontSize: '0.78rem',
                      width: '100%'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '2px' }}>
                  <button
                    onClick={() => setViewMode('tree')}
                    title="Tree View"
                    style={{
                      background: viewMode === 'tree' ? 'var(--bg-active)' : 'transparent',
                      border: 'none',
                      color: viewMode === 'tree' ? 'var(--color-primary)' : 'var(--text-muted)',
                      borderRadius: '6px',
                      padding: '3px 5px',
                      cursor: 'pointer',
                      display: 'flex'
                    }}
                  >
                    <FolderTree size={13} />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    title="Flat List View"
                    style={{
                      background: viewMode === 'list' ? 'var(--bg-active)' : 'transparent',
                      border: 'none',
                      color: viewMode === 'list' ? 'var(--color-primary)' : 'var(--text-muted)',
                      borderRadius: '6px',
                      padding: '3px 5px',
                      cursor: 'pointer',
                      display: 'flex'
                    }}
                  >
                    <List size={13} />
                  </button>
                </div>
              </div>

              {/* Filter Pills */}
              <div style={{ display: 'flex', gap: '3px' }}>
                {(['all', 'code', 'image', 'doc'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setActiveFilter(f)}
                    style={{
                      flex: 1,
                      background: activeFilter === f ? 'var(--bg-active)' : 'transparent',
                      border: activeFilter === f ? '1px solid var(--border-highlight)' : '1px solid transparent',
                      color: activeFilter === f ? 'var(--color-primary)' : 'var(--text-secondary)',
                      borderRadius: '6px',
                      padding: '3px 0',
                      fontSize: '0.72rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                      textTransform: 'capitalize'
                    }}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Tree / List Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '6px' }}>
              {filteredEntries.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  No matching files.
                </div>
              ) : viewMode === 'tree' ? (
                renderTree(treeRoot)
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {filteredEntries.filter(e => !e.isDir).map(entry => {
                    const isSelected = selectedEntry?.path === entry.path;
                    return (
                      <div
                        key={entry.path}
                        onClick={() => setSelectedEntry(entry)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '5px 8px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          background: isSelected ? 'var(--bg-active)' : 'transparent',
                          border: isSelected ? '1px solid var(--border-highlight)' : '1px solid transparent',
                          color: isSelected ? 'var(--color-primary)' : 'var(--text-primary)',
                          fontSize: '0.8rem'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                          {getEntryIcon(entry)}
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {entry.path}
                          </span>
                        </div>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: '6px', flexShrink: 0 }}>
                          {formatSize(entry.size)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: In-Archive File Preview & Document Viewer */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            {selectedEntry ? (
              <>
                {/* Preview Top Bar */}
                <div style={{
                  padding: '8px 14px',
                  background: 'rgba(0,0,0,0.2)',
                  borderBottom: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                    {getEntryIcon(selectedEntry)}
                    <span style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {selectedEntry.path}
                    </span>
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                      ({formatSize(selectedEntry.size)})
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {innerFileState?.textData && (
                      <button
                        onClick={handleCopyText}
                        style={{
                          background: copied ? 'var(--color-success)' : 'rgba(255,255,255,0.05)',
                          color: copied ? 'white' : 'var(--text-secondary)',
                          border: '1px solid var(--border-color)',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          fontSize: '0.74rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        {copied ? <Check size={11} /> : <Copy size={11} />}
                        {copied ? 'Copied' : 'Copy'}
                      </button>
                    )}

                    <button
                      onClick={() => handleDownloadEntry(selectedEntry)}
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border-color)',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '0.74rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <Download size={11} />
                      Extract
                    </button>
                  </div>
                </div>

                {/* Preview Canvas */}
                <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
                  {previewLoading ? (
                    <div style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      color: 'var(--text-secondary)',
                      fontSize: '0.85rem'
                    }}>
                      <RefreshCw size={16} className="spin" />
                      Loading file preview...
                    </div>
                  ) : innerFileState ? (
                    // 1. Documents & PDFs (Word, PowerPoint, Excel, CSV, PDF)
                    innerFileState.lesson.type === 'document' || innerFileState.lesson.type === 'pdf' ? (
                      <div style={{ flex: 1, height: '100%', padding: '12px' }}>
                        <DocumentViewer
                          lesson={innerFileState.lesson}
                          fileObj={innerFileState.fileObj}
                          contentUrl={innerFileState.contentUrl}
                        />
                      </div>
                    ) : 
                    // 2. Images
                    innerFileState.lesson.type === 'image' ? (
                      <div style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '24px',
                        background: '#09090e'
                      }}>
                        <img
                          src={innerFileState.contentUrl}
                          alt={selectedEntry.name}
                          style={{
                            maxWidth: '100%',
                            maxHeight: '100%',
                            objectFit: 'contain',
                            borderRadius: '8px'
                          }}
                        />
                      </div>
                    ) : 
                    // 3. Audio & Video
                    innerFileState.lesson.type === 'audio' || innerFileState.lesson.type === 'video' ? (
                      <div style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '40px',
                        background: '#09090e'
                      }}>
                        <audio controls src={innerFileState.contentUrl} style={{ width: '80%', maxWidth: '380px' }} />
                      </div>
                    ) : 
                    // 4. HTML Documents
                    innerFileState.lesson.type === 'html' ? (
                      <iframe
                        src={innerFileState.contentUrl}
                        title={selectedEntry.name}
                        sandbox="allow-scripts allow-same-origin"
                        style={{
                          width: '100%',
                          height: '100%',
                          border: 'none',
                          background: '#ffffff'
                        }}
                      />
                    ) : 
                    // 5. Code, Markdown & Text
                    innerFileState.textData ? (
                      <pre style={{
                        flex: 1,
                        margin: 0,
                        padding: '16px 20px',
                        background: '#09090e',
                        overflow: 'auto',
                        color: '#e2e8f0',
                        fontFamily: 'Fira Code, monospace',
                        fontSize: '0.98rem',
                        lineHeight: '1.65'
                      }}>
                        <code>{innerFileState.textData}</code>
                      </pre>
                    ) : (
                      <div style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '40px',
                        textAlign: 'center',
                        gap: '12px'
                      }}>
                        <FileQuestion size={36} style={{ color: 'var(--text-muted)' }} />
                        <div>
                          <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 500, margin: 0 }}>
                            Binary File Preview Not Supported
                          </p>
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                            Extract this file to open it with desktop software.
                          </p>
                        </div>
                        <button
                          onClick={() => handleDownloadEntry(selectedEntry)}
                          style={{
                            background: 'var(--gradient-accent)',
                            color: 'white',
                            border: 'none',
                            padding: '7px 14px',
                            borderRadius: '6px',
                            fontSize: '0.82rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <Download size={13} />
                          Extract {selectedEntry.name}
                        </button>
                      </div>
                    )
                  ) : (
                    <div style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '40px',
                      textAlign: 'center',
                      gap: '12px'
                    }}>
                      <HardDrive size={36} style={{ color: 'var(--color-primary)' }} />
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Click a file on the left to preview</p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)',
                gap: '8px'
              }}>
                <Eye size={28} />
                <p style={{ fontSize: '0.85rem' }}>Select a file from the left outline to preview</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
