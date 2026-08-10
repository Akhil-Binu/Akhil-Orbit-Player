import React, { useState } from 'react';
import { 
  Folder, FolderOpen, Video, FileText, Music, Image, Code, FileQuestion, 
  ChevronRight, ChevronDown, CheckSquare, Square, Search, Link2, Archive,
  Presentation, Table
} from 'lucide-react';
import type { CourseData, CourseFolder, CourseFile } from '../utils/fileSystem';

interface SidebarProps {
  courseData: CourseData;
  currentLesson: CourseFile | null;
  onSelectLesson: (lesson: CourseFile) => void;
  completedLessons: Record<string, boolean>;
  onToggleCompleted: (path: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  courseData,
  currentLesson,
  onSelectLesson,
  completedLessons,
  onToggleCompleted
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    [courseData.structure.path]: true // Expand root folder by default
  });

  const toggleFolder = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedFolders(prev => ({
      ...prev,
      [path]: !prev[path]
    }));
  };

  const getLessonIcon = (type: string, fileName = '') => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    if (type === 'document') {
      if (['pptx', 'ppt', 'ppsx', 'odp'].includes(ext)) {
        return <Presentation size={16} style={{ color: '#f97316' }} />;
      }
      if (['xlsx', 'xls', 'csv', 'tsv', 'ods'].includes(ext)) {
        return <Table size={16} style={{ color: '#10b981' }} />;
      }
      return <FileText size={16} style={{ color: '#3b82f6' }} />;
    }
    switch (type) {
      case 'video': return <Video size={16} style={{ color: '#818cf8' }} />;
      case 'pdf': return <FileText size={16} style={{ color: '#f87171' }} />;
      case 'markdown': return <FileText size={16} style={{ color: '#34d399' }} />;
      case 'text': return <FileText size={16} style={{ color: '#a7f3d0' }} />;
      case 'audio': return <Music size={16} style={{ color: '#fb7185' }} />;
      case 'image': return <Image size={16} style={{ color: '#fb923c' }} />;
      case 'code': return <Code size={16} style={{ color: '#38bdf8' }} />;
      case 'html': return <FileQuestion size={16} style={{ color: '#fbbf24' }} />;
      case 'subtitle': return <FileText size={16} style={{ color: '#a78bfa' }} />;
      case 'url': return <Link2 size={16} style={{ color: '#60a5fa' }} />;
      case 'archive': return <Archive size={16} style={{ color: '#f59e0b' }} />;
      default: return <FileQuestion size={16} style={{ color: '#9ca3af' }} />;
    }
  };

  // Check if a folder has any search-matching files (recursively)
  const folderMatchesSearch = (folder: CourseFolder, query: string): boolean => {
    if (!query) return true;
    
    const term = query.toLowerCase();
    const matchesFiles = folder.files.some(f => f.name.toLowerCase().includes(term));
    if (matchesFiles) return true;

    return folder.subfolders.some(sf => folderMatchesSearch(sf, query));
  };

  // Filter lessons in place
  const filterFiles = (files: CourseFile[], query: string) => {
    if (!query) return files;
    return files.filter(f => f.name.toLowerCase().includes(query.toLowerCase()));
  };

  // Calculate progress stats
  const totalLessonsCount = courseData.flatLessons.length;
  const completedLessonsCount = courseData.flatLessons.filter(f => completedLessons[f.path]).length;
  const percentComplete = totalLessonsCount > 0 
    ? Math.round((completedLessonsCount / totalLessonsCount) * 100) 
    : 0;

  // Render a folder level recursively
  const renderFolderNode = (folder: CourseFolder, depth = 0) => {
    const isExpanded = !!expandedFolders[folder.path] || searchQuery.length > 0;
    const match = folderMatchesSearch(folder, searchQuery);
    
    if (!match) return null;

    const folderFiles = filterFiles(folder.files, searchQuery);
    const hasChildren = folder.subfolders.length > 0 || folderFiles.length > 0;

    return (
      <div key={folder.path} style={{ display: 'flex', flexDirection: 'column' }}>
        {/* Folder Header */}
        <div
          onClick={(e) => hasChildren && toggleFolder(folder.path, e)}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '8px 12px 8px ' + (depth * 12 + 12) + 'px',
            cursor: hasChildren ? 'pointer' : 'default',
            userSelect: 'none',
            fontSize: '0.9rem',
            fontWeight: 500,
            borderRadius: '8px',
            color: 'var(--text-primary)',
            transition: 'background var(--transition-fast)',
            gap: '8px'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          {hasChildren ? (
            isExpanded ? <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} /> : <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
          ) : (
            <div style={{ width: 16 }} />
          )}
          {isExpanded ? (
            <FolderOpen size={18} style={{ color: 'var(--color-primary)' }} />
          ) : (
            <Folder size={18} style={{ color: 'var(--color-primary)' }} />
          )}
          <span style={{
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            flex: 1
          }}>
            {folder.name}
          </span>
        </div>

        {/* Folder Children */}
        {isExpanded && hasChildren && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {/* Subfolders */}
            {folder.subfolders.map(sub => renderFolderNode(sub, depth + 1))}
            
            {/* Files */}
            {folderFiles.map(file => {
              const isActive = currentLesson?.path === file.path;
              const isCompleted = !!completedLessons[file.path];
              
              return (
                <div
                  key={file.path}
                  onClick={() => onSelectLesson(file)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '8px 12px 8px ' + ((depth + 1) * 12 + 12) + 'px',
                    cursor: 'pointer',
                    fontSize: '0.88rem',
                    borderRadius: '8px',
                    backgroundColor: isActive ? 'var(--bg-active)' : 'transparent',
                    borderLeft: isActive ? '3px solid var(--color-primary)' : '3px solid transparent',
                    color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                    transition: 'all var(--transition-fast)',
                    gap: '8px'
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  {/* Custom Checkbox */}
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleCompleted(file.path);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      cursor: 'pointer',
                      color: isCompleted ? 'var(--color-success)' : 'var(--text-muted)',
                      transition: 'color var(--transition-fast)'
                    }}
                  >
                    {isCompleted ? <CheckSquare size={16} /> : <Square size={16} />}
                  </div>

                  {getLessonIcon(file.type, file.name)}
                  
                  <span style={{
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    flex: 1,
                    textDecoration: isCompleted ? 'line-through' : 'none',
                    opacity: isCompleted ? 0.6 : 1
                  }}>
                    {file.name}
                  </span>
                </div>
              );
            })}
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
      width: '100%',
      gap: '16px'
    }}>
      {/* Course Title and Global Progress */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        paddingBottom: '16px',
        borderBottom: '1px solid var(--border-color)'
      }}>
        <h2 style={{
          fontSize: '1.2rem',
          fontWeight: 700,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          background: 'var(--gradient-accent)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          {courseData.title}
        </h2>
        
        {/* Progress Info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            <span>Progress: {percentComplete}%</span>
            <span>{completedLessonsCount}/{totalLessonsCount} lessons</span>
          </div>
          <div style={{
            width: '100%',
            height: '6px',
            background: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '3px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${percentComplete}%`,
              height: '100%',
              background: 'var(--gradient-accent)',
              borderRadius: '3px',
              transition: 'width 0.4s ease'
            }} />
          </div>
        </div>
      </div>

      {/* Search Input */}
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          placeholder="Search lessons..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 12px 8px 36px',
            fontSize: '0.85rem'
          }}
        />
        <Search
          size={14}
          style={{
            position: 'absolute',
            left: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-muted)'
          }}
        />
      </div>

      {/* Sidebar Navigation Tree */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
        paddingRight: '4px'
      }}>
        {renderFolderNode(courseData.structure)}
      </div>
    </div>
  );
};
