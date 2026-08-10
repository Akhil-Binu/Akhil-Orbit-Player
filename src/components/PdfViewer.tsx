import React, { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { 
  FileText, Download, RotateCw, ZoomIn, ZoomOut, RotateCcw, 
  ChevronLeft, ChevronRight, CheckCircle2, RefreshCw, AlertTriangle,
  Layers, LayoutList, Columns
} from 'lucide-react';
import type { CourseFile } from '../utils/fileSystem';

// Initialize PDF.js worker locally for 100% offline operation
try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
} catch (e) {
  console.warn('Could not set pdf worker url:', e);
}

interface PdfViewerProps {
  lesson: CourseFile;
  fileObj: File;
  contentUrl?: string | null;
  onToggleCompleted?: (path: string) => void;
  isCompleted?: boolean;
}

export const PdfViewer: React.FC<PdfViewerProps> = ({
  lesson,
  fileObj,
  contentUrl,
  onToggleCompleted,
  isCompleted = false
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [zoom, setZoom] = useState<number>(125);
  const [rotation, setRotation] = useState<number>(0);
  const [viewMode, setViewMode] = useState<'single' | 'continuous'>('single');
  const [renderPageLoading, setRenderPageLoading] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const continuousContainerRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);

  // 1. Load PDF Document from ArrayBuffer
  useEffect(() => {
    let isCancelled = false;

    const loadPdf = async () => {
      setLoading(true);
      setError(null);
      setPdfDoc(null);
      setNumPages(0);
      setCurrentPage(1);

      try {
        const buffer = await fileObj.arrayBuffer();
        if (isCancelled) return;

        const loadingTask = pdfjsLib.getDocument({
          data: new Uint8Array(buffer),
          cMapUrl: 'https://unpkg.com/pdfjs-dist@latest/cmaps/',
          cMapPacked: true
        });

        const doc = await loadingTask.promise;
        if (isCancelled) return;

        setPdfDoc(doc);
        setNumPages(doc.numPages);
      } catch (err: unknown) {
        if (!isCancelled) {
          console.error('Error loading PDF with pdfjs-dist:', err);
          setError((err as Error).message || 'Could not load PDF document.');
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    loadPdf();

    return () => {
      isCancelled = true;
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }
    };
  }, [fileObj, lesson]);

  // 2. Render Single Page on Canvas
  useEffect(() => {
    if (!pdfDoc || viewMode !== 'single' || !canvasRef.current) return;

    let isCancelled = false;

    const renderPage = async () => {
      setRenderPageLoading(true);
      try {
        if (renderTaskRef.current) {
          renderTaskRef.current.cancel();
        }

        const page = await pdfDoc.getPage(currentPage);
        if (isCancelled) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        if (!context) return;

        // Compute high-DPI scaled viewport
        const scale = (zoom / 100) * 2.0;
        const viewport = page.getViewport({ scale, rotation });

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${viewport.width / 2.0}px`;
        canvas.style.height = `${viewport.height / 2.0}px`;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
          canvas: canvas
        };

        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;

        await renderTask.promise;
      } catch (err: unknown) {
        if ((err as Error).name !== 'RenderingCancelledException') {
          console.error('PDF Page render error:', err);
        }
      } finally {
        if (!isCancelled) {
          setRenderPageLoading(false);
        }
      }
    };

    renderPage();

    return () => {
      isCancelled = true;
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }
    };
  }, [pdfDoc, currentPage, zoom, rotation, viewMode]);

  // 3. Render Continuous Scroll View
  useEffect(() => {
    if (!pdfDoc || viewMode !== 'continuous' || !continuousContainerRef.current) return;

    let isCancelled = false;
    const container = continuousContainerRef.current;
    container.innerHTML = '';

    const renderAllPages = async () => {
      for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
        if (isCancelled) break;

        const page = await pdfDoc.getPage(pageNum);
        if (isCancelled) break;

        const pageWrapper = document.createElement('div');
        pageWrapper.style.display = 'flex';
        pageWrapper.style.flexDirection = 'column';
        pageWrapper.style.alignItems = 'center';
        pageWrapper.style.marginBottom = '24px';

        const pageLabel = document.createElement('span');
        pageLabel.textContent = `Page ${pageNum} of ${pdfDoc.numPages}`;
        pageLabel.style.fontSize = '0.75rem';
        pageLabel.style.color = '#94a3b8';
        pageLabel.style.marginBottom = '8px';
        pageWrapper.appendChild(pageLabel);

        const canvas = document.createElement('canvas');
        canvas.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5)';
        canvas.style.borderRadius = '4px';
        canvas.style.background = '#ffffff';

        const context = canvas.getContext('2d');
        if (!context) continue;

        const scale = (zoom / 100) * 2.0;
        const viewport = page.getViewport({ scale, rotation });

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${viewport.width / 2.0}px`;
        canvas.style.height = `${viewport.height / 2.0}px`;

        pageWrapper.appendChild(canvas);
        container.appendChild(pageWrapper);

        await page.render({ canvasContext: context, viewport, canvas }).promise;
      }
    };

    renderAllPages();

    return () => {
      isCancelled = true;
    };
  }, [pdfDoc, zoom, rotation, viewMode]);

  // Keyboard navigation for pages
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (numPages === 0 || viewMode !== 'single') return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        setCurrentPage(p => Math.min(numPages, p + 1));
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        setCurrentPage(p => Math.max(1, p - 1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [numPages, viewMode]);

  const handleDownload = () => {
    const url = contentUrl || URL.createObjectURL(fileObj);
    const a = document.createElement('a');
    a.href = url;
    a.download = lesson.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      gap: '10px'
    }}>
      {/* Top Header Controls Bar */}
      <div style={{
        padding: '8px 16px',
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
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ef4444'
          }}>
            <FileText size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0 }}>{lesson.name}</h2>
              <span style={{
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#f87171',
                padding: '2px 8px',
                borderRadius: '12px',
                fontSize: '0.72rem',
                fontWeight: 600
              }}>
                PDF Reader
              </span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
              {numPages > 0 ? `${numPages} pages` : 'Loading pages...'} • {(fileObj.size / (1024 * 1024)).toFixed(2)} MB
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* View Mode Toggle */}
          <div style={{
            display: 'flex',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '2px'
          }}>
            <button
              onClick={() => setViewMode('single')}
              title="Single Page View"
              style={{
                background: viewMode === 'single' ? 'var(--bg-active)' : 'transparent',
                border: 'none',
                color: viewMode === 'single' ? 'var(--color-primary)' : 'var(--text-muted)',
                borderRadius: '6px',
                padding: '4px 8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.78rem'
              }}
            >
              <Columns size={13} />
              Page
            </button>
            <button
              onClick={() => setViewMode('continuous')}
              title="Continuous Scroll View"
              style={{
                background: viewMode === 'continuous' ? 'var(--bg-active)' : 'transparent',
                border: 'none',
                color: viewMode === 'continuous' ? 'var(--color-primary)' : 'var(--text-muted)',
                borderRadius: '6px',
                padding: '4px 8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.78rem'
              }}
            >
              <LayoutList size={13} />
              Scroll
            </button>
          </div>

          {/* Zoom Controls */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '2px 6px'
          }}>
            <button
              onClick={() => setZoom(prev => Math.max(50, prev - 15))}
              title="Zoom Out"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-primary)',
                padding: '4px 6px',
                cursor: 'pointer',
                display: 'flex'
              }}
            >
              <ZoomOut size={14} />
            </button>
            <span style={{ fontSize: '0.76rem', fontWeight: 600, minWidth: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              {zoom}%
            </span>
            <button
              onClick={() => setZoom(prev => Math.min(300, prev + 15))}
              title="Zoom In"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-primary)',
                padding: '4px 6px',
                cursor: 'pointer',
                display: 'flex'
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
                display: 'flex'
              }}
            >
              <RotateCcw size={12} />
            </button>
          </div>

          {/* Rotate Button */}
          <button
            onClick={() => setRotation(r => (r + 90) % 360)}
            title="Rotate Page"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              color: 'var(--text-secondary)',
              padding: '6px 10px',
              fontSize: '0.8rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <RotateCw size={13} />
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
            Download PDF
          </button>
        </div>
      </div>

      {/* Main Document Body */}
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
          <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)' }}>Rendering PDF pages in browser...</p>
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
          <AlertTriangle size={36} color="#ef4444" />
          <h3 style={{ color: 'var(--text-primary)', margin: 0 }}>Cannot Open PDF</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '400px' }}>{error}</p>
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
            Download PDF File
          </button>
        </div>
      ) : (
        <div style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: numPages > 1 ? '150px 1fr' : '1fr',
          gap: '10px',
          minHeight: '0'
        }}>
          {/* Left Thumbnail Strip (If Multi-page) */}
          {numPages > 1 && (
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '16px',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}>
              <div style={{
                padding: '10px 14px',
                borderBottom: '1px solid var(--border-color)',
                fontSize: '0.78rem',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <Layers size={13} />
                Pages ({numPages})
              </div>

              <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}>
                {Array.from({ length: numPages }).map((_, idx) => {
                  const pageNumber = idx + 1;
                  const isSelected = currentPage === pageNumber;
                  return (
                    <div
                      key={pageNumber}
                      onClick={() => {
                        setCurrentPage(pageNumber);
                        if (viewMode === 'continuous' && continuousContainerRef.current) {
                          const target = continuousContainerRef.current.children[idx] as HTMLElement;
                          target?.scrollIntoView({ behavior: 'smooth' });
                        }
                      }}
                      style={{
                        padding: '8px 10px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        background: isSelected ? 'var(--bg-active)' : 'rgba(255,255,255,0.02)',
                        border: isSelected ? '1px solid var(--border-highlight)' : '1px solid var(--border-color)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '0.8rem',
                        color: isSelected ? 'var(--color-primary)' : 'var(--text-primary)',
                        fontWeight: isSelected ? 600 : 500
                      }}
                    >
                      <span>Page {pageNumber}</span>
                      {isSelected && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--color-primary)' }} />}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Right Main Stage View */}
          <div style={{
            background: '#15151e',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            position: 'relative'
          }}>
            {/* Viewport Canvas Container */}
            <div style={{
              flex: 1,
              overflow: 'auto',
              padding: '16px 10px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: viewMode === 'single' ? 'center' : 'flex-start',
              position: 'relative'
            }}>
              {renderPageLoading && (
                <div style={{
                  position: 'absolute',
                  top: '16px',
                  right: '16px',
                  background: 'rgba(0,0,0,0.7)',
                  padding: '4px 10px',
                  borderRadius: '16px',
                  fontSize: '0.75rem',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  zIndex: 10
                }}>
                  <RefreshCw size={12} className="spin" />
                  Rendering...
                </div>
              )}

              {viewMode === 'single' ? (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center'
                }}>
                  <canvas
                    ref={canvasRef}
                    style={{
                      boxShadow: '0 12px 36px rgba(0,0,0,0.6)',
                      borderRadius: '4px',
                      background: '#ffffff',
                      maxWidth: '100%'
                    }}
                  />
                </div>
              ) : (
                <div
                  ref={continuousContainerRef}
                  style={{
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center'
                  }}
                />
              )}
            </div>

            {/* Bottom Page Navigation (Single Page Mode) */}
            {viewMode === 'single' && numPages > 1 && (
              <div style={{
                padding: '10px 20px',
                background: 'rgba(0,0,0,0.4)',
                borderTop: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid var(--border-color)',
                      color: currentPage === 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                      borderRadius: '8px',
                      padding: '5px 12px',
                      fontSize: '0.8rem',
                      cursor: currentPage === 1 ? 'default' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      opacity: currentPage === 1 ? 0.5 : 1
                    }}
                  >
                    <ChevronLeft size={15} />
                    Prev
                  </button>

                  <button
                    disabled={currentPage === numPages}
                    onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))}
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid var(--border-color)',
                      color: currentPage === numPages ? 'var(--text-muted)' : 'var(--text-primary)',
                      borderRadius: '8px',
                      padding: '5px 12px',
                      fontSize: '0.8rem',
                      cursor: currentPage === numPages ? 'default' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      opacity: currentPage === numPages ? 0.5 : 1
                    }}
                  >
                    Next
                    <ChevronRight size={15} />
                  </button>
                </div>

                <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                  Page <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{currentPage}</span> of {numPages}
                </div>

                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  Use ← → arrow keys to flip pages
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
