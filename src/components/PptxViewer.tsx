import React, { useState, useEffect, useRef } from 'react';
import JSZip from 'jszip';
import { 
  Presentation, ChevronLeft, ChevronRight, Maximize2, Minimize2, 
  Download, RefreshCw, CheckCircle2, AlertTriangle, Layers,
  FileText, Layout
} from 'lucide-react';
import type { CourseFile } from '../utils/fileSystem';

interface PptxViewerProps {
  lesson: CourseFile;
  fileObj: File;
  onToggleCompleted?: (path: string) => void;
  isCompleted?: boolean;
}

interface TextRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  fontSize?: number;
  color?: string;
}

interface TextParagraph {
  runs: TextRun[];
  level: number;
  align?: 'left' | 'center' | 'right' | 'justify';
  isBullet?: boolean;
}

interface SlideElement {
  id: string;
  type: 'text' | 'image' | 'table';
  x: number; // percentage (0 - 100)
  y: number; // percentage (0 - 100)
  width: number; // percentage (0 - 100)
  height: number; // percentage (0 - 100)
  paragraphs?: TextParagraph[];
  isTitle?: boolean;
  imageUrl?: string;
  tableData?: string[][];
  bgColor?: string;
}

interface SlideData {
  index: number;
  title: string;
  elements: SlideElement[];
  plainTexts: string[];
  bgColor?: string;
}

export const PptxViewer: React.FC<PptxViewerProps> = ({
  lesson,
  fileObj,
  onToggleCompleted,
  isCompleted = false
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [slides, setSlides] = useState<SlideData[]>([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'canvas' | 'outline'>('canvas');
  const stageRef = useRef<HTMLDivElement>(null);

  // Parse PPTX presentation
  useEffect(() => {
    let isCancelled = false;
    const createdBlobUrls: string[] = [];

    const loadPresentation = async () => {
      setLoading(true);
      setError(null);
      setSlides([]);
      setCurrentSlideIndex(0);

      try {
        const buffer = await fileObj.arrayBuffer();
        if (isCancelled) return;

        const parsedSlides: SlideData[] = [];

        // 1. Modern PPTX Parsing via JSZip
        try {
          const zip = await JSZip.loadAsync(buffer);

          // Get slide dimensions from presentation.xml
          let slideWidth = 12192000; // default 16:9
          let slideHeight = 6858000;
          const presFile = zip.file('ppt/presentation.xml') || 
                           Object.values(zip.files).find(f => f.name.replace(/\\/g, '/').toLowerCase() === 'ppt/presentation.xml');

          if (presFile) {
            const presText = await presFile.async('string');
            const presDoc = new DOMParser().parseFromString(presText, 'text/xml');
            const sldSz = presDoc.getElementsByTagName('p:sldSz')[0] || presDoc.getElementsByTagName('sldSz')[0];
            if (sldSz) {
              const cx = parseInt(sldSz.getAttribute('cx') || '0', 10);
              const cy = parseInt(sldSz.getAttribute('cy') || '0', 10);
              if (cx > 0 && cy > 0) {
                slideWidth = cx;
                slideHeight = cy;
              }
            }
          }

          // Find slide files
          const slideFiles: { path: string; num: number; zipEntry: JSZip.JSZipObject }[] = [];
          zip.forEach((rawPath, zipEntry) => {
            const normPath = rawPath.replace(/\\/g, '/');
            const match = normPath.match(/ppt\/slides\/slide(\d+)\.xml$/i);
            if (match) {
              slideFiles.push({
                path: normPath,
                num: parseInt(match[1], 10),
                zipEntry
              });
            }
          });

          if (slideFiles.length > 0) {
            slideFiles.sort((a, b) => a.num - b.num);

            for (let sIdx = 0; sIdx < slideFiles.length; sIdx++) {
              const slide = slideFiles[sIdx];
              const xmlText = await slide.zipEntry.async('string');
              const parser = new DOMParser();
              const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

              // Parse image relationships for this slide
              const relMap: Record<string, string> = {};
              const relsPath = `ppt/slides/_rels/slide${slide.num}.xml.rels`;
              const relsFile = zip.file(relsPath) || 
                               Object.values(zip.files).find(f => f.name.replace(/\\/g, '/').toLowerCase() === relsPath.toLowerCase());

              if (relsFile) {
                try {
                  const relsText = await relsFile.async('string');
                  const relsDoc = parser.parseFromString(relsText, 'text/xml');
                  const relNodes = relsDoc.getElementsByTagName('Relationship');
                  
                  for (let r = 0; r < relNodes.length; r++) {
                    const id = relNodes[r].getAttribute('Id') || '';
                    const target = relNodes[r].getAttribute('Target') || '';
                    if (id && target) {
                      const mediaPath = target.startsWith('..') 
                        ? target.replace(/^\.\.\//, 'ppt/') 
                        : `ppt/${target}`;

                      const mediaFile = zip.file(mediaPath) || 
                                        Object.values(zip.files).find(f => f.name.replace(/\\/g, '/').toLowerCase() === mediaPath.toLowerCase());

                      if (mediaFile) {
                        const imageBlob = await mediaFile.async('blob');
                        const imageUrl = URL.createObjectURL(imageBlob);
                        createdBlobUrls.push(imageUrl);
                        relMap[id] = imageUrl;
                      }
                    }
                  }
                } catch (rErr) {
                  console.warn('Could not parse slide rels:', rErr);
                }
              }

              const elements: SlideElement[] = [];
              const plainTexts: string[] = [];
              let slideTitle = '';

              // Find shape tree
              const spNodes = Array.from(xmlDoc.getElementsByTagName('p:sp')).concat(
                Array.from(xmlDoc.getElementsByTagName('sp'))
              );

              spNodes.forEach((sp, idx) => {
                // Position and size (a:xfrm)
                const xfrm = sp.getElementsByTagName('a:xfrm')[0] || sp.getElementsByTagName('xfrm')[0];
                let posX = 8;
                let posY = 10 + (idx * 16) % 70;
                let width = 84;
                let height = 20;

                if (xfrm) {
                  const off = xfrm.getElementsByTagName('a:off')[0] || xfrm.getElementsByTagName('off')[0];
                  const ext = xfrm.getElementsByTagName('a:ext')[0] || xfrm.getElementsByTagName('ext')[0];
                  if (off && ext) {
                    const x = parseInt(off.getAttribute('x') || '0', 10);
                    const y = parseInt(off.getAttribute('y') || '0', 10);
                    const cx = parseInt(ext.getAttribute('cx') || '0', 10);
                    const cy = parseInt(ext.getAttribute('cy') || '0', 10);

                    posX = Math.max(0, Math.min(95, (x / slideWidth) * 100));
                    posY = Math.max(0, Math.min(95, (y / slideHeight) * 100));
                    width = Math.max(5, Math.min(100 - posX, (cx / slideWidth) * 100));
                    height = Math.max(5, Math.min(100 - posY, (cy / slideHeight) * 100));
                  }
                }

                // Placeholder type check
                const ph = sp.getElementsByTagName('p:ph')[0] || sp.getElementsByTagName('ph')[0];
                const phType = ph?.getAttribute('type') || '';
                const isTitle = ['title', 'ctrTitle'].includes(phType);

                // Paragraphs
                const pNodes = Array.from(sp.getElementsByTagName('a:p')).concat(
                  Array.from(sp.getElementsByTagName('p'))
                );

                const paragraphs: TextParagraph[] = [];

                pNodes.forEach(p => {
                  const pPr = p.getElementsByTagName('a:pPr')[0] || p.getElementsByTagName('pPr')[0];
                  const lvl = parseInt(pPr?.getAttribute('lvl') || '0', 10);
                  const rawAlgn = pPr?.getAttribute('algn') || 'l';

                  const runs: TextRun[] = [];
                  const rNodes = Array.from(p.getElementsByTagName('a:r')).concat(
                    Array.from(p.getElementsByTagName('r'))
                  );

                  rNodes.forEach(r => {
                    const rPr = r.getElementsByTagName('a:rPr')[0] || r.getElementsByTagName('rPr')[0];
                    const tNode = r.getElementsByTagName('a:t')[0] || r.getElementsByTagName('t')[0];
                    const text = tNode?.textContent || '';

                    if (text) {
                      const bold = rPr?.getAttribute('b') === '1';
                      const italic = rPr?.getAttribute('i') === '1';
                      const sz = parseInt(rPr?.getAttribute('sz') || '0', 10);

                      runs.push({
                        text,
                        bold: bold || isTitle,
                        italic,
                        fontSize: sz > 0 ? Math.round(sz / 100) : undefined
                      });
                    }
                  });

                  // If runs was empty, check plain a:t inside p
                  if (runs.length === 0) {
                    const tNodes = Array.from(p.getElementsByTagName('a:t')).concat(
                      Array.from(p.getElementsByTagName('t'))
                    );
                    let combined = '';
                    tNodes.forEach(t => { combined += t.textContent || ''; });
                    if (combined.trim()) {
                      runs.push({ text: combined, bold: isTitle });
                    }
                  }

                  if (runs.length > 0) {
                    const fullPText = runs.map(r => r.text).join('');
                    plainTexts.push(fullPText);
                    if (isTitle && !slideTitle) {
                      slideTitle = fullPText;
                    }

                    paragraphs.push({
                      runs,
                      level: lvl,
                      align: rawAlgn === 'ctr' ? 'center' : rawAlgn === 'r' ? 'right' : rawAlgn === 'just' ? 'justify' : 'left',
                      isBullet: lvl > 0 || (!isTitle && paragraphs.length > 0)
                    });
                  }
                });

                if (paragraphs.length > 0) {
                  elements.push({
                    id: `shape-${idx}`,
                    type: 'text',
                    x: posX,
                    y: posY,
                    width,
                    height,
                    paragraphs,
                    isTitle
                  });
                }
              });

              // Pictures (p:pic)
              const picNodes = Array.from(xmlDoc.getElementsByTagName('p:pic')).concat(
                Array.from(xmlDoc.getElementsByTagName('pic'))
              );

              picNodes.forEach((pic, pIdx) => {
                const blip = pic.getElementsByTagName('a:blip')[0] || pic.getElementsByTagName('blip')[0];
                const rEmbed = blip?.getAttribute('r:embed') || blip?.getAttribute('embed') || '';
                const imgUrl = relMap[rEmbed];

                if (imgUrl) {
                  const xfrm = pic.getElementsByTagName('a:xfrm')[0] || pic.getElementsByTagName('xfrm')[0];
                  let posX = 60;
                  let posY = 20;
                  let width = 30;
                  let height = 40;

                  if (xfrm) {
                    const off = xfrm.getElementsByTagName('a:off')[0] || xfrm.getElementsByTagName('off')[0];
                    const ext = xfrm.getElementsByTagName('a:ext')[0] || xfrm.getElementsByTagName('ext')[0];
                    if (off && ext) {
                      const x = parseInt(off.getAttribute('x') || '0', 10);
                      const y = parseInt(off.getAttribute('y') || '0', 10);
                      const cx = parseInt(ext.getAttribute('cx') || '0', 10);
                      const cy = parseInt(ext.getAttribute('cy') || '0', 10);

                      posX = Math.max(0, Math.min(90, (x / slideWidth) * 100));
                      posY = Math.max(0, Math.min(90, (y / slideHeight) * 100));
                      width = Math.max(10, Math.min(100 - posX, (cx / slideWidth) * 100));
                      height = Math.max(10, Math.min(100 - posY, (cy / slideHeight) * 100));
                    }
                  }

                  elements.push({
                    id: `pic-${pIdx}`,
                    type: 'image',
                    x: posX,
                    y: posY,
                    width,
                    height,
                    imageUrl: imgUrl
                  });
                }
              });

              // Tables (a:tbl)
              const tblNodes = Array.from(xmlDoc.getElementsByTagName('a:tbl')).concat(
                Array.from(xmlDoc.getElementsByTagName('tbl'))
              );

              tblNodes.forEach((tbl, tIdx) => {
                const trNodes = Array.from(tbl.getElementsByTagName('a:tr'));
                const tableData: string[][] = [];

                trNodes.forEach(tr => {
                  const tcNodes = Array.from(tr.getElementsByTagName('a:tc'));
                  const rowData: string[] = [];
                  tcNodes.forEach(tc => {
                    const tNodes = Array.from(tc.getElementsByTagName('a:t'));
                    const cellText = tNodes.map(t => t.textContent || '').join(' ').trim();
                    rowData.push(cellText);
                  });
                  if (rowData.length > 0) {
                    tableData.push(rowData);
                  }
                });

                if (tableData.length > 0) {
                  elements.push({
                    id: `tbl-${tIdx}`,
                    type: 'table',
                    x: 10,
                    y: 35,
                    width: 80,
                    height: 45,
                    tableData
                  });
                }
              });

              parsedSlides.push({
                index: sIdx + 1,
                title: slideTitle || plainTexts[0] || `Slide ${sIdx + 1}`,
                elements,
                plainTexts
              });
            }
          }
        } catch (zipErr) {
          console.warn('PPTX zip parsing failed, attempting text fallback:', zipErr);
        }

        // 2. Legacy Binary PPT fallback
        if (parsedSlides.length === 0) {
          const uint8 = new Uint8Array(buffer);
          let rawText = '';
          for (let i = 0; i < uint8.length; i++) {
            const byte = uint8[i];
            if ((byte >= 32 && byte <= 126) || byte === 10 || byte === 13) {
              rawText += String.fromCharCode(byte);
            }
          }

          const sentences = rawText
            .split(/[\r\n]{2,}/)
            .map(s => s.replace(/\s+/g, ' ').trim())
            .filter(s => s.length > 15 && !s.includes('PowerPoint Document') && !s.includes('SummaryInformation'));

          if (sentences.length > 0) {
            for (let i = 0; i < sentences.length; i += 4) {
              const group = sentences.slice(i, i + 4);
              parsedSlides.push({
                index: Math.floor(i / 4) + 1,
                title: group[0] || `Slide ${Math.floor(i / 4) + 1}`,
                elements: [
                  {
                    id: `legacy-title-${i}`,
                    type: 'text',
                    x: 8,
                    y: 12,
                    width: 84,
                    height: 15,
                    paragraphs: [{ runs: [{ text: group[0], bold: true, fontSize: 24 }], level: 0 }],
                    isTitle: true
                  },
                  {
                    id: `legacy-body-${i}`,
                    type: 'text',
                    x: 8,
                    y: 30,
                    width: 84,
                    height: 55,
                    paragraphs: group.slice(1).map(text => ({
                      runs: [{ text, fontSize: 16 }],
                      level: 1,
                      isBullet: true
                    }))
                  }
                ],
                plainTexts: group
              });
            }
          }
        }

        if (parsedSlides.length === 0) {
          throw new Error('No readable slides found in presentation.');
        }

        if (!isCancelled) {
          setSlides(parsedSlides);
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          console.error('Error loading PPTX:', err);
          setError((err as Error).message || 'Could not parse PowerPoint presentation.');
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    loadPresentation();

    return () => {
      isCancelled = true;
      createdBlobUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [fileObj, lesson]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (slides.length === 0) return;
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        setCurrentSlideIndex(prev => Math.min(slides.length - 1, prev + 1));
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        setCurrentSlideIndex(prev => Math.max(0, prev - 1));
      } else if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [slides, isFullscreen]);

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

  const toggleFullscreen = () => {
    if (!stageRef.current) return;
    if (!document.fullscreenElement) {
      stageRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const currentSlide = slides[currentSlideIndex];

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
            background: 'rgba(249, 115, 22, 0.12)',
            border: '1px solid rgba(249, 115, 22, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#f97316'
          }}>
            <Presentation size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0 }}>{lesson.name}</h2>
              <span style={{
                background: 'rgba(249, 115, 22, 0.15)',
                color: '#fb923c',
                padding: '2px 8px',
                borderRadius: '12px',
                fontSize: '0.72rem',
                fontWeight: 600
              }}>
                PowerPoint Player
              </span>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
              {slides.length > 0 ? `${slides.length} slides` : 'Loading slides...'} • {(fileObj.size / (1024 * 1024)).toFixed(2)} MB
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Mode Switcher */}
          <div style={{
            display: 'flex',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '2px'
          }}>
            <button
              onClick={() => setViewMode('canvas')}
              title="Slide Canvas View"
              style={{
                background: viewMode === 'canvas' ? 'var(--bg-active)' : 'transparent',
                border: 'none',
                color: viewMode === 'canvas' ? 'var(--color-primary)' : 'var(--text-muted)',
                borderRadius: '6px',
                padding: '4px 8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.78rem'
              }}
            >
              <Layout size={13} />
              Slide
            </button>
            <button
              onClick={() => setViewMode('outline')}
              title="Text Outline View"
              style={{
                background: viewMode === 'outline' ? 'var(--bg-active)' : 'transparent',
                border: 'none',
                color: viewMode === 'outline' ? 'var(--color-primary)' : 'var(--text-muted)',
                borderRadius: '6px',
                padding: '4px 8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.78rem'
              }}
            >
              <FileText size={13} />
              Outline
            </button>
          </div>

          {slides.length > 0 && (
            <button
              onClick={toggleFullscreen}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                color: 'var(--text-primary)',
                padding: '7px 12px',
                fontSize: '0.82rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              {isFullscreen ? 'Exit Fullscreen' : 'Present'}
            </button>
          )}

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

      {/* Main Layout */}
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
          <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)' }}>Parsing PowerPoint slides and layout...</p>
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
          <h3 style={{ color: 'var(--text-primary)', margin: 0 }}>Cannot Open Presentation</h3>
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
            Download Presentation File
          </button>
        </div>
      ) : (
        <div style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '180px 1fr',
          gap: '10px',
          minHeight: '0'
        }}>
          {/* Left Thumbnail Strip */}
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
              fontSize: '0.8rem',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <Layers size={13} />
              Slides ({slides.length})
            </div>

            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              {slides.map((slide, idx) => {
                const isSelected = idx === currentSlideIndex;
                return (
                  <div
                    key={slide.index}
                    onClick={() => setCurrentSlideIndex(idx)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      background: isSelected ? 'var(--bg-active)' : 'rgba(255,255,255,0.02)',
                      border: isSelected ? '1px solid var(--border-highlight)' : '1px solid var(--border-color)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        color: isSelected ? 'var(--color-primary)' : 'var(--text-muted)'
                      }}>
                        #{slide.index}
                      </span>
                    </div>
                    <p style={{
                      margin: 0,
                      fontSize: '0.8rem',
                      fontWeight: isSelected ? 600 : 500,
                      color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {slide.title}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Slide Canvas Stage */}
          <div 
            ref={stageRef}
            style={{
              background: '#09090e',
              border: '1px solid var(--border-color)',
              borderRadius: '16px',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              position: 'relative'
            }}
          >
            {/* Viewport */}
            <div style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '12px',
              overflow: 'auto'
            }}>
              {currentSlide && (
                viewMode === 'canvas' ? (
                  /* 16:9 High-Fidelity Slide Canvas */
                  <div style={{
                    width: '100%',
                    maxWidth: '1350px',
                    aspectRatio: '16/9',
                    background: 'linear-gradient(135deg, #181824 0%, #0f0f18 100%)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '12px',
                    boxShadow: '0 24px 48px rgba(0,0,0,0.7)',
                    position: 'relative',
                    overflow: 'hidden',
                    userSelect: 'text'
                  }}>
                    {/* Elements */}
                    {currentSlide.elements.map(el => {
                      if (el.type === 'text' && el.paragraphs) {
                        return (
                          <div
                            key={el.id}
                            style={{
                              position: 'absolute',
                              left: `${el.x}%`,
                              top: `${el.y}%`,
                              width: `${el.width}%`,
                              height: `${el.height}%`,
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: el.isTitle ? 'center' : 'flex-start',
                              overflow: 'hidden',
                              padding: '4px'
                            }}
                          >
                            {el.paragraphs.map((p, pIdx) => (
                              <div
                                key={pIdx}
                                style={{
                                  display: 'flex',
                                  alignItems: 'baseline',
                                  gap: p.isBullet ? '8px' : '0',
                                  paddingLeft: `${p.level * 16}px`,
                                  textAlign: p.align || 'left',
                                  marginBottom: el.isTitle ? '6px' : '8px'
                                }}
                              >
                                {p.isBullet && (
                                  <span style={{
                                    width: '5px',
                                    height: '5px',
                                    borderRadius: '50%',
                                    background: '#f97316',
                                    flexShrink: 0,
                                    alignSelf: 'center'
                                  }} />
                                )}
                                <div style={{ flex: 1 }}>
                                  {p.runs.map((r, rIdx) => (
                                    <span
                                      key={rIdx}
                                      style={{
                                        fontWeight: r.bold || el.isTitle ? 700 : 400,
                                        fontStyle: r.italic ? 'italic' : 'normal',
                                        fontSize: el.isTitle ? '1.85rem' : r.fontSize ? `${Math.min(28, Math.max(14, r.fontSize * 0.95))}px` : '1.15rem',
                                        color: el.isTitle ? '#ffffff' : '#e2e8f0',
                                        lineHeight: '1.45',
                                        background: el.isTitle ? 'linear-gradient(135deg, #ffffff 0%, #cbd5e1 100%)' : 'none',
                                        WebkitBackgroundClip: el.isTitle ? 'text' : 'unset',
                                        WebkitTextFillColor: el.isTitle ? 'transparent' : 'unset'
                                      }}
                                    >
                                      {r.text}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      }

                      if (el.type === 'image' && el.imageUrl) {
                        return (
                          <div
                            key={el.id}
                            style={{
                              position: 'absolute',
                              left: `${el.x}%`,
                              top: `${el.y}%`,
                              width: `${el.width}%`,
                              height: `${el.height}%`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              overflow: 'hidden'
                            }}
                          >
                            <img
                              src={el.imageUrl}
                              alt="Slide Media"
                              style={{
                                maxWidth: '100%',
                                maxHeight: '100%',
                                objectFit: 'contain',
                                borderRadius: '6px',
                                boxShadow: '0 8px 24px rgba(0,0,0,0.4)'
                              }}
                            />
                          </div>
                        );
                      }

                      if (el.type === 'table' && el.tableData) {
                        return (
                          <div
                            key={el.id}
                            style={{
                              position: 'absolute',
                              left: `${el.x}%`,
                              top: `${el.y}%`,
                              width: `${el.width}%`,
                              height: `${el.height}%`,
                              overflow: 'auto'
                            }}
                          >
                            <table style={{
                              width: '100%',
                              borderCollapse: 'collapse',
                              fontSize: '0.8rem',
                              color: '#ffffff'
                            }}>
                              <tbody>
                                {el.tableData.map((row, rIdx) => (
                                  <tr key={rIdx} style={{ background: rIdx === 0 ? 'rgba(249, 115, 22, 0.2)' : 'rgba(255,255,255,0.03)' }}>
                                    {row.map((cell, cIdx) => (
                                      <td key={cIdx} style={{ border: '1px solid rgba(255,255,255,0.1)', padding: '6px 10px' }}>
                                        {cell}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        );
                      }

                      return null;
                    })}

                    {/* Bottom Slide Number Indicator */}
                    <div style={{
                      position: 'absolute',
                      bottom: '12px',
                      right: '16px',
                      fontSize: '0.72rem',
                      color: 'rgba(255,255,255,0.3)',
                      fontWeight: 600
                    }}>
                      {currentSlideIndex + 1} / {slides.length}
                    </div>
                  </div>
                ) : (
                  /* Text Outline View */
                  <div style={{
                    width: '100%',
                    maxWidth: '800px',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    padding: '36px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px'
                  }}>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-primary)', margin: 0 }}>
                      {currentSlide.title}
                    </h1>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {currentSlide.plainTexts.map((text, idx) => (
                        <p key={idx} style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-primary)', lineHeight: '1.6' }}>
                          {text}
                        </p>
                      ))}
                    </div>
                  </div>
                )
              )}
            </div>

            {/* Bottom Slide Navigation Bar */}
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
                  disabled={currentSlideIndex === 0}
                  onClick={() => setCurrentSlideIndex(prev => Math.max(0, prev - 1))}
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid var(--border-color)',
                    color: currentSlideIndex === 0 ? 'var(--text-muted)' : 'var(--text-primary)',
                    borderRadius: '8px',
                    padding: '5px 12px',
                    fontSize: '0.8rem',
                    cursor: currentSlideIndex === 0 ? 'default' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    opacity: currentSlideIndex === 0 ? 0.5 : 1
                  }}
                >
                  <ChevronLeft size={15} />
                  Prev
                </button>

                <button
                  disabled={currentSlideIndex === slides.length - 1}
                  onClick={() => setCurrentSlideIndex(prev => Math.min(slides.length - 1, prev + 1))}
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid var(--border-color)',
                    color: currentSlideIndex === slides.length - 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                    borderRadius: '8px',
                    padding: '5px 12px',
                    fontSize: '0.8rem',
                    cursor: currentSlideIndex === slides.length - 1 ? 'default' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    opacity: currentSlideIndex === slides.length - 1 ? 0.5 : 1
                  }}
                >
                  Next
                  <ChevronRight size={15} />
                </button>
              </div>

              <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                Slide <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{currentSlideIndex + 1}</span> of {slides.length}
              </div>

              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                Use ← → arrow keys to flip slides
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
