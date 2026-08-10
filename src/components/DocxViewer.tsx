import React, { useEffect, useRef, useState } from 'react';
import { renderAsync } from 'docx-preview';
import JSZip from 'jszip';
import { 
  FileText, Download, ZoomIn, ZoomOut, RotateCcw, 
  RefreshCw, CheckCircle2, AlertTriangle, Eye, Sparkles
} from 'lucide-react';
import type { CourseFile } from '../utils/fileSystem';

interface DocxViewerProps {
  lesson: CourseFile;
  fileObj: File;
  onToggleCompleted?: (path: string) => void;
  isCompleted?: boolean;
}

export const DocxViewer: React.FC<DocxViewerProps> = ({
  lesson,
  fileObj,
  onToggleCompleted,
  isCompleted = false
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [fallbackHtml, setFallbackHtml] = useState<string | null>(null);
  const [isLegacyDoc, setIsLegacyDoc] = useState<boolean>(false);
  const [zoom, setZoom] = useState<number>(100);
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    let isCancelled = false;

    const renderDocument = async () => {
      setLoading(true);
      setError(null);
      setFallbackHtml(null);
      setIsLegacyDoc(false);
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }

      try {
        const buffer = await fileObj.arrayBuffer();
        if (isCancelled) return;

        const ext = lesson.name.split('.').pop()?.toLowerCase() || '';

        // 1. If it's a modern DOCX (or ODT/RTF), try high-fidelity docx-preview
        let renderedSuccessfully = false;
        if (['docx', 'dotx'].includes(ext) && containerRef.current) {
          try {
            await renderAsync(buffer, containerRef.current, undefined, {
              className: 'docx-preview-content',
              inWrapper: true,
              ignoreWidth: false,
              ignoreHeight: false,
              ignoreFonts: false,
              breakPages: true,
              useBase64URL: true
            });
            renderedSuccessfully = true;
          } catch (renderErr) {
            console.warn('docx-preview failed, attempting XML fallback:', renderErr);
          }
        }

        // 2. If docx-preview failed or it's a zipped package, try JSZip word/document.xml extraction
        if (!renderedSuccessfully && ['docx', 'dotx'].includes(ext)) {
          try {
            const zip = await JSZip.loadAsync(buffer);
            const docXml = zip.file('word/document.xml');
            if (docXml) {
              const xmlText = await docXml.async('string');
              const parser = new DOMParser();
              const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
              
              const paragraphs = xmlDoc.getElementsByTagName('w:p');
              const htmlParts: string[] = [];

              for (let i = 0; i < paragraphs.length; i++) {
                const p = paragraphs[i];
                const textNodes = p.getElementsByTagName('w:t');
                let pText = '';
                for (let t = 0; t < textNodes.length; t++) {
                  pText += textNodes[t].textContent || '';
                }

                if (pText.trim()) {
                  const isHeading = p.getElementsByTagName('w:pStyle')[0]?.getAttribute('w:val')?.toLowerCase().includes('heading');
                  if (isHeading) {
                    htmlParts.push(`<h2 style="color: #6366f1; margin-top: 24px; margin-bottom: 12px; font-size: 1.35rem; font-weight: 700;">${pText}</h2>`);
                  } else {
                    htmlParts.push(`<p style="color: #334155; font-size: 1rem; line-height: 1.7; margin-bottom: 14px;">${pText}</p>`);
                  }
                }
              }

              if (htmlParts.length > 0) {
                setFallbackHtml(htmlParts.join(''));
                renderedSuccessfully = true;
              }
            }
          } catch (zipErr) {
            console.warn('JSZip DOCX fallback failed:', zipErr);
          }
        }

        // 3. For Legacy Binary .DOC / .RTF (Word 97-2003 Compound Format)
        if (!renderedSuccessfully) {
          try {
            const uint8 = new Uint8Array(buffer);
            let rawText = '';
            
            // Extract readable text sequences from binary stream
            for (let i = 0; i < uint8.length; i++) {
              const byte = uint8[i];
              if ((byte >= 32 && byte <= 126) || byte === 10 || byte === 13) {
                rawText += String.fromCharCode(byte);
              } else if (byte === 0 && i + 1 < uint8.length && uint8[i + 1] >= 32 && uint8[i + 1] <= 126) {
                rawText += String.fromCharCode(uint8[i + 1]);
                i++;
              }
            }

            // Extract sentences and clean paragraphs
            const paragraphs = rawText
              .split(/[\r\n]{2,}/)
              .map(p => p.replace(/[^\x20-\x7E\n\r]/g, ' ').replace(/\s+/g, ' ').trim())
              .filter(p => p.length > 25 && !p.includes('Microsoft Word') && !p.includes('Normal.dotm') && !p.includes('CompObj'));

            if (paragraphs.length > 0) {
              const html = paragraphs
                .map(p => `<p style="color: #334155; font-size: 1rem; line-height: 1.7; margin-bottom: 14px;">${p}</p>`)
                .join('');
              
              if (!isCancelled) {
                setFallbackHtml(html);
                setIsLegacyDoc(true);
                renderedSuccessfully = true;
              }
            } else {
              throw new Error('Unable to extract text content from document.');
            }
          } catch (binaryErr: unknown) {
            throw new Error((binaryErr as Error).message || 'Could not parse document.', { cause: binaryErr });
          }
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          console.error('Error rendering document:', err);
          setError((err as Error).message || 'Could not render document.');
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    renderDocument();

    return () => {
      isCancelled = true;
    };
  }, [fileObj, lesson]);

  const handleDownload = () => {
    const url = URL.createObjectURL(fileObj);
    const a = document.createElement('a');
    a.href = url;
    a.download = lesson.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const ext = lesson.name.split('.').pop()?.toUpperCase() || 'DOC';

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      gap: '16px'
    }}>
      {/* Top Header Controls */}
      <div style={{
        padding: '12px 20px',
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
            background: 'rgba(59, 130, 246, 0.12)',
            border: '1px solid rgba(59, 130, 246, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#3b82f6'
          }}>
            <FileText size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0 }}>{lesson.name}</h2>
              <span style={{
                background: 'rgba(59, 130, 246, 0.15)',
                color: '#60a5fa',
                padding: '2px 8px',
                borderRadius: '12px',
                fontSize: '0.72rem',
                fontWeight: 600
              }}>
                {ext} Document
              </span>
              {isLegacyDoc && (
                <span style={{
                  background: 'rgba(245, 158, 11, 0.15)',
                  color: '#f59e0b',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '0.7rem',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <Sparkles size={10} /> Text Extracted
                </span>
              )}
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
              {(fileObj.size / 1024).toFixed(1)} KB • Rendered locally in browser
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Zoom controls */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '2px 6px'
          }}>
            <button
              onClick={() => setZoom(prev => Math.max(50, prev - 10))}
              title="Zoom Out"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-primary)',
                padding: '4px 6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <ZoomOut size={14} />
            </button>
            <span style={{ fontSize: '0.76rem', fontWeight: 600, minWidth: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              {zoom}%
            </span>
            <button
              onClick={() => setZoom(prev => Math.min(150, prev + 10))}
              title="Zoom In"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-primary)',
                padding: '4px 6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <ZoomIn size={14} />
            </button>
            <button
              onClick={() => setZoom(100)}
              title="Reset Zoom"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                padding: '4px 6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <RotateCcw size={12} />
            </button>
          </div>

          <button
            onClick={() => setThemeMode(prev => prev === 'light' ? 'dark' : 'light')}
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              color: 'var(--text-secondary)',
              padding: '6px 12px',
              fontSize: '0.8rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Eye size={13} />
            {themeMode === 'light' ? 'Dark Paper' : 'Light Paper'}
          </button>

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
            onClick={handleDownload}
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
            Download
          </button>
        </div>
      </div>

      {/* Main Document Body */}
      <div style={{
        flex: 1,
        background: themeMode === 'light' ? '#202028' : '#0d0d12',
        border: '1px solid var(--border-color)',
        borderRadius: '16px',
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '24px',
        position: 'relative'
      }}>
        {loading ? (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            color: 'var(--text-secondary)'
          }}>
            <RefreshCw size={28} className="spin" style={{ color: 'var(--color-primary)' }} />
            <span style={{ fontSize: '0.9rem' }}>Reading document...</span>
          </div>
        ) : error && !fallbackHtml ? (
          <div style={{
            padding: '40px',
            textAlign: 'center',
            color: 'var(--text-secondary)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px'
          }}>
            <AlertTriangle size={36} color="#ef4444" />
            <h3 style={{ color: 'var(--text-primary)', margin: 0 }}>Could not render document</h3>
            <p style={{ fontSize: '0.85rem', maxWidth: '400px' }}>{error}</p>
            <button
              onClick={handleDownload}
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
              Download Document File
            </button>
          </div>
        ) : fallbackHtml ? (
          <div 
            style={{
              transform: `scale(${zoom / 100})`,
              transformOrigin: 'top center',
              transition: 'transform 0.15s ease',
              width: '100%',
              maxWidth: '800px',
              background: themeMode === 'light' ? '#ffffff' : '#181820',
              padding: '48px 56px',
              borderRadius: '8px',
              boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
              filter: themeMode === 'dark' ? 'invert(0.9) hue-rotate(180deg)' : 'none'
            }}
            dangerouslySetInnerHTML={{ __html: fallbackHtml }}
          />
        ) : (
          <div 
            style={{
              transform: `scale(${zoom / 100})`,
              transformOrigin: 'top center',
              transition: 'transform 0.15s ease',
              filter: themeMode === 'dark' ? 'invert(0.9) hue-rotate(180deg)' : 'none',
              boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
              borderRadius: '4px'
            }}
          >
            <div ref={containerRef} />
          </div>
        )}
      </div>
    </div>
  );
};
