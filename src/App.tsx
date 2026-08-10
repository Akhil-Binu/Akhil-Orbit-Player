import React, { useState, useEffect } from 'react';
import { 
  FolderOpen, UploadCloud, GraduationCap, ChevronLeft, 
  ChevronRight, CheckCircle2, Bookmark, FileText, Sparkles, BookOpen,
  Music, HelpCircle, Link2, ExternalLink
} from 'lucide-react';
import { parseDirectory, parseFileList, buildCourseDataFromFolder, getFileObject } from './utils/fileSystem';
import type { CourseData, CourseFile } from './utils/fileSystem';
import { Sidebar } from './components/Sidebar';
import { VideoPlayer } from './components/VideoPlayer';
import { NotesPanel } from './components/NotesPanel';
import { BookmarksPanel } from './components/BookmarksPanel';
import { ArchiveViewer } from './components/ArchiveViewer';
import { DocumentViewer } from './components/DocumentViewer';
import type { VideoBookmark } from './components/BookmarksPanel';

export default function App() {
  const [courseData, setCourseData] = useState<CourseData | null>(null);
  const [currentLesson, setCurrentLesson] = useState<CourseFile | null>(null);
  const [currentContentUrl, setCurrentContentUrl] = useState<string | null>(null);
  const [currentTextContent, setCurrentTextContent] = useState<string>('');
  const [currentFileObject, setCurrentFileObject] = useState<File | null>(null);
  
  // Track completions and bookmarks in LocalStorage
  const [completedLessons, setCompletedLessons] = useState<Record<string, boolean>>({});
  const [bookmarks, setBookmarks] = useState<VideoBookmark[]>([]);
  const [videoCurrentTime, setVideoCurrentTime] = useState<number>(0);
  
  // Layout states
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [rightPanelTab, setRightPanelTab] = useState<'notes' | 'bookmarks'>('notes');
  const [isLoading, setIsLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [currentSubtitles, setCurrentSubtitles] = useState<{ label: string; srclang: string; url: string }[]>([]);

  // Helper to load course & initialize saved completion states
  const loadCourse = (data: CourseData) => {
    setCourseData(data);
    const key = `completed_${data.title}`;
    try {
      const saved = localStorage.getItem(key);
      setCompletedLessons(saved ? JSON.parse(saved) : {});
    } catch (e) {
      console.error('Error loading completion states', e);
      setCompletedLessons({});
    }
  };

  // Revoke Object URLs on lesson switch to prevent memory leaks
  useEffect(() => {
    return () => {
      if (currentContentUrl) {
        URL.revokeObjectURL(currentContentUrl);
      }
    };
  }, [currentContentUrl]);

  // Handle subtitles URLs cleanup
  useEffect(() => {
    return () => {
      currentSubtitles.forEach(track => {
        URL.revokeObjectURL(track.url);
      });
    };
  }, [currentSubtitles]);

  // Helper to load selected lesson content
  const loadLesson = async (lesson: CourseFile, targetCourse?: CourseData | null) => {
    setIsLoading(true);
    const activeCourse = targetCourse || courseData;
    if (activeCourse) {
      const key = `bookmarks_${activeCourse.title}_${lesson.path}`;
      try {
        const saved = localStorage.getItem(key);
        setBookmarks(saved ? JSON.parse(saved) : []);
      } catch (e) {
        console.error('Error loading bookmarks', e);
        setBookmarks([]);
      }
    }
    setVideoCurrentTime(0);

    try {
      // Clear previous URL & subtitles & file objects immediately
      if (currentContentUrl) {
        URL.revokeObjectURL(currentContentUrl);
        setCurrentContentUrl(null);
      }
      currentSubtitles.forEach(track => URL.revokeObjectURL(track.url));
      setCurrentSubtitles([]);
      setCurrentTextContent('');
      setCurrentFileObject(null);

      const fileObj = await getFileObject(lesson);

      if (['video', 'audio', 'pdf', 'image', 'html'].includes(lesson.type)) {
        const url = URL.createObjectURL(fileObj);
        setCurrentContentUrl(url);

        // Load subtitle tracks if video
        if (lesson.type === 'video' && lesson.subtitles && lesson.subtitles.length > 0) {
          const resolvedTracks = await Promise.all(
            lesson.subtitles.map(async (track) => {
              const trackFile = await getFileObject(track as unknown as CourseFile);
              const trackUrl = URL.createObjectURL(trackFile);
              return {
                label: track.label,
                srclang: track.srclang,
                url: trackUrl
              };
            })
          );
          setCurrentSubtitles(resolvedTracks);
        }
      } else if (lesson.type === 'subtitle') {
        const text = await fileObj.text();
        const htmlContent = convertVttToHtml(text, lesson.name);
        const htmlBlob = new Blob([htmlContent], { type: 'text/html' });
        const url = URL.createObjectURL(htmlBlob);
        setCurrentContentUrl(url);
      } else if (lesson.type === 'url') {
        const text = await fileObj.text();
        const targetUrl = parseUrlContent(text);
        setCurrentContentUrl(targetUrl);
      } else if (['markdown', 'text', 'code'].includes(lesson.type)) {
        const text = await fileObj.text();
        setCurrentTextContent(text);
      }

      // Atomically set active lesson and matching file object
      setCurrentFileObject(fileObj);
      setCurrentLesson(lesson);
    } catch (err) {
      console.error('Error loading lesson file:', err);
      alert('Failed to load file from local storage. Please ensure access is allowed.');
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle item complete status
  const handleToggleCompleted = (path: string) => {
    if (!courseData) return;
    const key = `completed_${courseData.title}`;
    const updated = {
      ...completedLessons,
      [path]: !completedLessons[path]
    };
    setCompletedLessons(updated);
    localStorage.setItem(key, JSON.stringify(updated));
  };

  // Trigger when a video finishes
  const handleVideoEnded = () => {
    if (!courseData || !currentLesson) return;
    
    // 1. Mark current lesson completed
    if (!completedLessons[currentLesson.path]) {
      handleToggleCompleted(currentLesson.path);
    }

    // 2. Play next lesson automatically
    const currentIndex = courseData.flatLessons.findIndex(f => f.path === currentLesson.path);
    if (currentIndex !== -1 && currentIndex < courseData.flatLessons.length - 1) {
      const nextLesson = courseData.flatLessons[currentIndex + 1];
      loadLesson(nextLesson);
    }
  };

  // Bookmark actions
  const handleAddBookmark = (timestamp: number, note: string) => {
    if (!courseData || !currentLesson) return;
    const key = `bookmarks_${courseData.title}_${currentLesson.path}`;
    const newBookmark: VideoBookmark = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp,
      note,
      createdAt: Date.now()
    };
    const updated = [...bookmarks, newBookmark];
    setBookmarks(updated);
    localStorage.setItem(key, JSON.stringify(updated));
  };

  const handleDeleteBookmark = (id: string) => {
    if (!courseData || !currentLesson) return;
    const key = `bookmarks_${courseData.title}_${currentLesson.path}`;
    const updated = bookmarks.filter(b => b.id !== id);
    setBookmarks(updated);
    localStorage.setItem(key, JSON.stringify(updated));
  };

  const handleSeek = (timestamp: number) => {
    const video = document.querySelector('video');
    if (video) {
      video.currentTime = timestamp;
      video.play().catch(err => console.log('Playback resume error:', err));
    }
  };

  // Handle Directory selection via File System Access API
  const handleSelectDirectory = async () => {
    setIsLoading(true);
    try {
      const picker = (window as unknown as { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker;
      const dirHandle = await picker();
      const parsedFolder = await parseDirectory(dirHandle);
      const data = buildCourseDataFromFolder(parsedFolder);
      loadCourse(data);
      
      // Auto-load first lesson
      if (data.flatLessons.length > 0) {
        loadLesson(data.flatLessons[0], data);
      }
    } catch (err: unknown) {
      if ((err as Error).name !== 'AbortError') {
        console.error('Directory Picker Error:', err);
        alert('Failed to read folder. Please try the standard folder upload fallback.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Directory fallback selection
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setIsLoading(true);
    try {
      const data = parseFileList(e.target.files);
      loadCourse(data);
      if (data.flatLessons.length > 0) {
        loadLesson(data.flatLessons[0], data);
      }
    } catch (err) {
      console.error(err);
      alert('Error parsing course directory.');
    } finally {
      setIsLoading(false);
    }
  };

  // Drag & drop logic for fallback
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    // Check files
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setIsLoading(true);
      try {
        const data = parseFileList(e.dataTransfer.files);
        loadCourse(data);
        if (data.flatLessons.length > 0) {
          loadLesson(data.flatLessons[0], data);
        }
      } catch (err) {
        console.error(err);
        alert('Error parsing course files. Ensure you drag and drop folders.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleCloseCourse = () => {
    if (currentContentUrl) {
      URL.revokeObjectURL(currentContentUrl);
      setCurrentContentUrl(null);
    }
    setCourseData(null);
    setCurrentLesson(null);
    setCurrentTextContent('');
    setCompletedLessons({});
    setBookmarks([]);
  };

  // Navigate to Next/Prev lesson
  const handleNavigateLesson = (direction: 'next' | 'prev') => {
    if (!courseData || !currentLesson) return;
    const currentIndex = courseData.flatLessons.findIndex(f => f.path === currentLesson.path);
    if (currentIndex === -1) return;

    if (direction === 'next' && currentIndex < courseData.flatLessons.length - 1) {
      loadLesson(courseData.flatLessons[currentIndex + 1]);
    } else if (direction === 'prev' && currentIndex > 0) {
      loadLesson(courseData.flatLessons[currentIndex - 1]);
    }
  };

  // Check if we are on first or last lesson
  const isFirstLesson = () => {
    if (!courseData || !currentLesson) return true;
    return courseData.flatLessons.findIndex(f => f.path === currentLesson.path) === 0;
  };

  const isLastLesson = () => {
    if (!courseData || !currentLesson) return true;
    const idx = courseData.flatLessons.findIndex(f => f.path === currentLesson.path);
    return idx === courseData.flatLessons.length - 1;
  };

  // Render main content depending on file type
  const renderContent = () => {
    if (isLoading) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '16px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid rgba(99, 102, 241, 0.1)',
            borderTopColor: 'var(--color-primary)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Loading course content...</span>
        </div>
      );
    }

    if (!currentLesson) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px', color: 'var(--text-muted)' }}>
          <BookOpen size={48} style={{ opacity: 0.3 }} />
          <span>Select a lesson from the sidebar to begin learning.</span>
        </div>
      );
    }

    const currentFlatIndex = courseData && currentLesson
      ? courseData.flatLessons.findIndex(f => f.path === currentLesson.path)
      : -1;
    const hasNextLesson = !!(courseData && currentFlatIndex !== -1 && currentFlatIndex < courseData.flatLessons.length - 1);

    switch (currentLesson.type) {
      case 'video':
        return currentContentUrl ? (
          <VideoPlayer
            key={currentLesson.path}
            videoSrc={currentContentUrl}
            subtitles={currentSubtitles}
            lessonName={currentLesson.name}
            lessonPath={currentLesson.path}
            courseId={courseData?.title || 'default'}
            onVideoEnded={handleVideoEnded}
            onTimeUpdate={setVideoCurrentTime}
            onAddBookmark={handleAddBookmark}
            hasNextLesson={hasNextLesson}
            onVideoCompleted={() => {
              if (courseData && currentLesson && !completedLessons[currentLesson.path]) {
                handleToggleCompleted(currentLesson.path);
              }
            }}
          />
        ) : null;
        
      case 'audio':
        return currentContentUrl ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            padding: '32px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            textAlign: 'center',
            gap: '24px'
          }}>
            <div style={{
              width: '120px',
              height: '120px',
              borderRadius: '50%',
              background: 'var(--gradient-accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'var(--shadow-neon)',
              animation: isAudioPlaying ? 'pulse 2s infinite' : 'none'
            }}>
              <Music size={48} color="white" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '6px' }}>{currentLesson.name}</h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>Audio Lesson</p>
            </div>
            <audio 
              src={currentContentUrl} 
              controls 
              style={{ width: '100%', maxWidth: '400px' }}
              onPlay={() => setIsAudioPlaying(true)}
              onPause={() => setIsAudioPlaying(false)}
              onEnded={() => {
                setIsAudioPlaying(false);
                handleToggleCompleted(currentLesson.path);
              }}
            />
          </div>
        ) : null;
      case 'html':
        return currentContentUrl ? (
          <iframe
            src={currentContentUrl}
            style={{
              width: '100%',
              height: '100%',
              border: '1px solid var(--border-color)',
              borderRadius: '16px',
              background: '#ffffff'
            }}
            title={currentLesson.name}
            sandbox="allow-scripts allow-same-origin allow-forms"
          />
        ) : null;
        
      case 'pdf':
        return currentFileObject && currentContentUrl ? (
          <DocumentViewer
            lesson={currentLesson}
            fileObj={currentFileObject}
            contentUrl={currentContentUrl}
            onToggleCompleted={handleToggleCompleted}
            isCompleted={!!completedLessons[currentLesson.path]}
          />
        ) : null;
        
      case 'markdown':
        return (
          <div style={{
            height: '100%',
            overflowY: 'auto',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            padding: '32px'
          }} className="markdown-body">
            {/* Quick Title overlay */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '24px' }}>
              <h1 style={{ margin: 0, fontSize: '1.6rem' }}>{currentLesson.name}</h1>
              <button 
                onClick={() => handleToggleCompleted(currentLesson.path)}
                style={{
                  background: completedLessons[currentLesson.path] ? 'var(--color-success)' : 'rgba(255,255,255,0.05)',
                  color: completedLessons[currentLesson.path] ? 'white' : 'var(--text-secondary)',
                  border: '1px solid var(--border-color)',
                  padding: '6px 14px',
                  borderRadius: '20px',
                  fontSize: '0.82rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all var(--transition-fast)'
                }}
              >
                <CheckCircle2 size={14} />
                {completedLessons[currentLesson.path] ? 'Completed' : 'Mark Complete'}
              </button>
            </div>
            {/* Simple Markdown renderer */}
            <div dangerouslySetInnerHTML={{ __html: parseMarkdownText(currentTextContent) }} />
          </div>
        );
        
      case 'text':
      case 'code':
        return (
          <div style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            overflow: 'hidden'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 20px',
              backgroundColor: 'rgba(0,0,0,0.3)',
              borderBottom: '1px solid var(--border-color)'
            }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontFamily: 'Fira Code, monospace' }}>
                {currentLesson.name}
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => navigator.clipboard.writeText(currentTextContent)}
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    fontSize: '0.8rem',
                    cursor: 'pointer'
                  }}
                >
                  Copy
                </button>
                <button 
                  onClick={() => handleToggleCompleted(currentLesson.path)}
                  style={{
                    background: completedLessons[currentLesson.path] ? 'var(--color-success)' : 'rgba(255,255,255,0.05)',
                    color: completedLessons[currentLesson.path] ? 'white' : 'var(--text-secondary)',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    fontSize: '0.8rem',
                    cursor: 'pointer'
                  }}
                >
                  {completedLessons[currentLesson.path] ? 'Done' : 'Mark Done'}
                </button>
              </div>
            </div>
            <pre style={{
              flex: 1,
              margin: 0,
              padding: '24px',
              background: '#0d0d11',
              overflow: 'auto',
              color: '#38bdf8',
              fontFamily: 'Fira Code, monospace',
              fontSize: '1.02rem',
              lineHeight: '1.6'
            }}>
              <code>{currentTextContent}</code>
            </pre>
          </div>
        );

      case 'url':
        return currentContentUrl ? (
          <div style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{
              padding: '24px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '16px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              gap: '16px'
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: 'rgba(96, 165, 250, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#60a5fa'
              }}>
                <Link2 size={24} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 600 }}>External Link Resource</h3>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginTop: '4px', wordBreak: 'break-all' }}>
                  {currentContentUrl}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <a
                  href={currentContentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    background: 'var(--gradient-accent)',
                    color: 'white',
                    textDecoration: 'none',
                    padding: '10px 20px',
                    borderRadius: '8px',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: 'var(--shadow-sm)',
                    cursor: 'pointer'
                  }}
                >
                  Open in New Tab
                  <ExternalLink size={14} />
                </a>
                <button 
                  onClick={() => handleToggleCompleted(currentLesson.path)}
                  style={{
                    background: completedLessons[currentLesson.path] ? 'var(--color-success)' : 'rgba(255,255,255,0.05)',
                    color: completedLessons[currentLesson.path] ? 'white' : 'var(--text-secondary)',
                    border: '1px solid var(--border-color)',
                    padding: '10px 20px',
                    borderRadius: '8px',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all var(--transition-fast)'
                  }}
                >
                  {completedLessons[currentLesson.path] ? 'Done' : 'Mark Done'}
                </button>
              </div>
            </div>
            
            {/* Attempt frame preview */}
            <div style={{ flex: 1, position: 'relative', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
              <iframe
                src={currentContentUrl}
                style={{ width: '100%', height: '100%', background: 'white' }}
                title={currentLesson.name}
                sandbox="allow-scripts allow-same-origin allow-forms"
              />
            </div>
          </div>
        ) : null;

      case 'subtitle':
        return currentContentUrl ? (
          <iframe
            src={currentContentUrl}
            style={{
              width: '100%',
              height: '100%',
              border: '1px solid var(--border-color)',
              borderRadius: '16px',
              background: '#09090b'
            }}
            title={currentLesson.name}
            sandbox="allow-scripts allow-same-origin"
          />
        ) : null;
        
      case 'image':
        return currentContentUrl ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            padding: '16px'
          }}>
            <img 
              src={currentContentUrl} 
              alt={currentLesson.name} 
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
                borderRadius: '8px',
                boxShadow: 'var(--shadow-md)'
              }}
            />
          </div>
        ) : null;
        
      case 'archive':
        return currentFileObject ? (
          <ArchiveViewer
            lesson={currentLesson}
            fileObj={currentFileObject}
            onToggleCompleted={handleToggleCompleted}
            isCompleted={!!completedLessons[currentLesson.path]}
          />
        ) : null;
        
      case 'document':
        return currentFileObject ? (
          <DocumentViewer
            lesson={currentLesson}
            fileObj={currentFileObject}
            contentUrl={currentContentUrl}
            onToggleCompleted={handleToggleCompleted}
            isCompleted={!!completedLessons[currentLesson.path]}
          />
        ) : null;
        
      default:
        return (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            padding: '32px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            textAlign: 'center',
            gap: '16px'
          }}>
            <HelpCircle size={48} style={{ opacity: 0.3 }} />
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 600 }}>Unsupported file format</h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Cannot render this file type directly ({currentLesson.name}).
              </p>
            </div>
            {currentContentUrl && (
              <a
                href={currentContentUrl}
                download={currentLesson.name}
                style={{
                  background: 'var(--gradient-accent)',
                  color: 'white',
                  textDecoration: 'none',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontSize: '0.88rem',
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                Open / Download File
              </a>
            )}
          </div>
        );
    }
  };

  // Simple Markdown text renderer helper
  const parseMarkdownText = (md: string) => {
    if (!md) return '';
    let html = md
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    
    html = html.replace(/^### (.*)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.*)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.*)$/gm, '<h1>$1</h1>');
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
    html = html.replace(/^- (.*)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/g, '<ul>$1</ul>');
    html = html.replace(/<\/ul>\s*<ul>/g, '');
    
    return html;
  };

  const totalLessons = courseData ? courseData.flatLessons.length : 0;
  const completedCount = courseData ? courseData.flatLessons.filter(f => completedLessons[f.path]).length : 0;
  const percentComplete = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

  // Render upload landing page if no course is loaded
  if (!courseData) {
    return (
      <div 
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '24px',
          background: dragOver ? 'rgba(99, 102, 241, 0.05)' : 'transparent',
          transition: 'background 0.2s'
        }}
      >
        <div 
          className="glass-panel"
          style={{
            width: '100%',
            maxWidth: '560px',
            padding: '40px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '24px',
            animation: 'fadeIn 0.5s ease',
            border: dragOver ? '2px dashed var(--color-primary)' : '1px solid var(--border-color)',
            boxShadow: dragOver ? 'var(--shadow-neon)' : 'var(--shadow-lg)'
          }}
        >
          {/* Logo Icon */}
          <div style={{
            width: '72px',
            height: '72px',
            borderRadius: '20px',
            background: 'var(--gradient-accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--shadow-neon)'
          }}>
            <GraduationCap size={36} color="white" />
          </div>

          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 700, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
              Akhil Orbit Player <Sparkles size={20} style={{ color: 'var(--color-primary)' }} />
            </h1>
            <p style={{ color: 'var(--text-secondary)', marginTop: '8px', fontSize: '0.95rem', lineHeight: '1.5' }}>
              Load, play, and organize course contents directly from your local folders. Fast, private, and fully offline.
            </p>
            <div style={{ marginTop: '12px' }}>
              <a 
                href="https://akhil-orbit-player.vercel.app/" 
                target="_blank" 
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.8rem',
                  color: 'var(--color-primary)',
                  textDecoration: 'none',
                  background: 'rgba(99, 102, 241, 0.08)',
                  padding: '5px 12px',
                  borderRadius: '20px',
                  border: '1px solid rgba(99, 102, 241, 0.15)',
                  transition: 'all 0.2s ease',
                  fontWeight: 500
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(99, 102, 241, 0.15)';
                  e.currentTarget.style.borderColor = 'var(--color-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(99, 102, 241, 0.08)';
                  e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.15)';
                }}
              >
                <ExternalLink size={12} />
                akhil-orbit-player.vercel.app
              </a>
            </div>
          </div>

          {/* Directory Selectors */}
          <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: '12px', marginTop: '8px' }}>
            <button
              onClick={handleSelectDirectory}
              style={{
                background: 'var(--gradient-accent)',
                color: 'white',
                border: 'none',
                padding: '14px 20px',
                borderRadius: '10px',
                fontWeight: 600,
                fontSize: '0.95rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: 'var(--shadow-sm)',
                transition: 'transform 0.15s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'none'}
            >
              <FolderOpen size={18} />
              Select Course Folder
            </button>

            {/* Folder Upload Fallback Form */}
            <label
              style={{
                background: 'rgba(255,255,255,0.03)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                padding: '14px 20px',
                borderRadius: '10px',
                fontWeight: 500,
                fontSize: '0.92rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-highlight)';
                e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-color)';
                e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
              }}
            >
              <UploadCloud size={18} />
              Upload Directory (Fallback)
              <input
                type="file"
                // @ts-expect-error - webkitdirectory is custom attribute
                webkitdirectory=""
                directory=""
                multiple
                onChange={handleFileInputChange}
                style={{ display: 'none' }}
              />
            </label>
          </div>

          <div style={{
            fontSize: '0.8rem',
            color: 'var(--text-muted)',
            lineHeight: '1.4',
            borderTop: '1px solid var(--border-color)',
            paddingTop: '16px',
            width: '100%'
          }}>
            Drag and drop a folder here to load instantly.<br />
            Supported: Videos, PDFs, Markdown notes, audio, code, and text sheets.
          </div>
        </div>
      </div>
    );
  }

  // Render course main dashboard player interface
  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      width: '100vw',
      overflow: 'hidden',
      backgroundColor: 'var(--bg-dark)'
    }}>
      {/* Sidebar Panel */}
      {isSidebarOpen && (
        <div className="glass-panel" style={{
          width: '320px',
          height: '100%',
          borderRadius: 0,
          borderTop: 'none',
          borderBottom: 'none',
          borderLeft: 'none',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0
        }}>
          {/* Header Close button */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <button
              onClick={handleCloseCourse}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary)',
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontWeight: 500
              }}
            >
              <ChevronLeft size={16} />
              All Courses
            </button>
          </div>

          <Sidebar
            courseData={courseData}
            currentLesson={currentLesson}
            onSelectLesson={loadLesson}
            completedLessons={completedLessons}
            onToggleCompleted={handleToggleCompleted}
          />
        </div>
      )}

      {/* Main Core Viewer Section */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        position: 'relative',
        padding: '24px',
        backgroundColor: 'rgba(0,0,0,0.1)'
      }}>
        {/* Top bar controls */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px',
          zIndex: 4
        }}>
          {/* Collapse sidebar button */}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            style={{
              background: 'var(--bg-panel)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              borderRadius: '8px',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            {isSidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
          </button>

          {/* Header Course Progress Bar */}
          {courseData && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              flex: 1,
              maxWidth: '320px',
              margin: '0 24px',
              background: 'rgba(255, 255, 255, 0.02)',
              padding: '6px 12px',
              borderRadius: '20px',
              border: '1px solid var(--border-color)',
              backdropFilter: 'blur(8px)'
            }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', fontWeight: 500 }}>
                Course Progress: {percentComplete}%
              </span>
              <div style={{
                flex: 1,
                height: '6px',
                background: 'rgba(255, 255, 255, 0.06)',
                borderRadius: '3px',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${percentComplete}%`,
                  height: '100%',
                  background: 'var(--gradient-accent)',
                  borderRadius: '3px',
                  boxShadow: '0 0 8px rgba(99, 102, 241, 0.3)',
                  transition: 'width 0.4s ease'
                }} />
              </div>
            </div>
          )}

          {/* Navigation Controls */}
          {currentLesson && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                disabled={isFirstLesson()}
                onClick={() => handleNavigateLesson('prev')}
                style={{
                  background: 'var(--bg-panel)',
                  border: '1px solid var(--border-color)',
                  color: isFirstLesson() ? 'var(--text-muted)' : 'var(--text-primary)',
                  borderRadius: '8px',
                  padding: '6px 12px',
                  fontSize: '0.82rem',
                  fontWeight: 500,
                  cursor: isFirstLesson() ? 'default' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  opacity: isFirstLesson() ? 0.5 : 1
                }}
              >
                <ChevronLeft size={14} />
                Prev
              </button>
              <button
                disabled={isLastLesson()}
                onClick={() => handleNavigateLesson('next')}
                style={{
                  background: 'var(--bg-panel)',
                  border: '1px solid var(--border-color)',
                  color: isLastLesson() ? 'var(--text-muted)' : 'var(--text-primary)',
                  borderRadius: '8px',
                  padding: '6px 12px',
                  fontSize: '0.82rem',
                  fontWeight: 500,
                  cursor: isLastLesson() ? 'default' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  opacity: isLastLesson() ? 0.5 : 1
                }}
              >
                Next
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>

        {/* Content Box */}
        <div style={{ flex: 1, height: '0px' }}>
          {renderContent()}
        </div>
      </div>

      {/* Right Interaction Panel (Notes & Bookmarks) */}
      {currentLesson && (
        <div className="glass-panel" style={{
          width: '320px',
          height: '100%',
          borderRadius: 0,
          borderTop: 'none',
          borderBottom: 'none',
          borderRight: 'none',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0
        }}>
          {/* Panel Selector tabs */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
            <button
              onClick={() => setRightPanelTab('notes')}
              style={{
                flex: 1,
                background: rightPanelTab === 'notes' ? 'var(--bg-active)' : 'transparent',
                border: rightPanelTab === 'notes' ? '1px solid var(--border-highlight)' : '1px solid transparent',
                color: rightPanelTab === 'notes' ? 'var(--color-primary)' : 'var(--text-secondary)',
                borderRadius: '8px',
                padding: '8px',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all var(--transition-fast)'
              }}
            >
              <FileText size={14} />
              Notes
            </button>
            
            {currentLesson.type === 'video' && (
              <button
                onClick={() => setRightPanelTab('bookmarks')}
                style={{
                  flex: 1,
                  background: rightPanelTab === 'bookmarks' ? 'var(--bg-active)' : 'transparent',
                  border: rightPanelTab === 'bookmarks' ? '1px solid var(--border-highlight)' : '1px solid transparent',
                  color: rightPanelTab === 'bookmarks' ? 'var(--color-primary)' : 'var(--text-secondary)',
                  borderRadius: '8px',
                  padding: '8px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all var(--transition-fast)'
                }}
              >
                <Bookmark size={14} />
                Bookmarks
              </button>
            )}
          </div>

          {/* Panel active slot */}
          <div style={{ flex: 1, height: '0px' }}>
            {rightPanelTab === 'notes' || currentLesson.type !== 'video' ? (
              <NotesPanel 
                key={`notes_${courseData.title}_${currentLesson.path}`}
                courseId={courseData.title}
                lessonPath={currentLesson.path}
              />
            ) : (
              <BookmarksPanel
                bookmarks={bookmarks}
                currentTime={videoCurrentTime}
                onAddBookmark={handleAddBookmark}
                onDeleteBookmark={handleDeleteBookmark}
                onSeek={handleSeek}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface VttCue {
  start: string;
  end: string;
  text: string;
}

function parseVttCues(vttText: string): VttCue[] {
  const lines = vttText.split(/\r?\n/);
  const cues: VttCue[] = [];
  let currentCue: Partial<VttCue> = {};
  let textLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      if (currentCue.start && textLines.length > 0) {
        currentCue.text = textLines.join(' ');
        cues.push(currentCue as VttCue);
        currentCue = {};
        textLines = [];
      }
      continue;
    }

    if (line.includes('-->')) {
      const parts = line.split('-->');
      currentCue.start = parts[0].trim();
      currentCue.end = parts[1].trim();
    } else if (line !== 'WEBVTT' && !line.match(/^\d+$/)) {
      if (currentCue.start) {
        textLines.push(line);
      }
    }
  }

  if (currentCue.start && textLines.length > 0) {
    currentCue.text = textLines.join(' ');
    cues.push(currentCue as VttCue);
  }

  return cues;
}

function convertVttToHtml(vttText: string, fileName: string): string {
  const cues = parseVttCues(vttText);
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Transcript: ${fileName}</title>
  <style>
    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background-color: #09090b;
      color: #e4e4e7;
      padding: 32px;
      margin: 0;
      line-height: 1.6;
    }
    h1 {
      font-size: 1.5rem;
      font-weight: 600;
      color: #ffffff;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      padding-bottom: 12px;
      margin-top: 0;
      margin-bottom: 24px;
    }
    .cue {
      display: flex;
      gap: 16px;
      margin-bottom: 16px;
      align-items: flex-start;
    }
    .timestamp {
      font-family: monospace;
      color: #6366f1;
      background: rgba(99, 102, 241, 0.1);
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 0.82rem;
      font-weight: 600;
      flex-shrink: 0;
    }
    .text {
      margin: 0;
      font-size: 0.92rem;
    }
  </style>
</head>
<body>
  <h1>Transcript: ${fileName}</h1>
  ${cues.length === 0 ? '<p style="color: #71717a; font-style: italic;">No speech cues detected in VTT file.</p>' : ''}
  ${cues.map(cue => '<div class="cue"><span class="timestamp">' + cue.start.split('.')[0] + '</span><p class="text">' + cue.text + '</p></div>').join('')}
</body>
</html>
  `.trim();
}

function parseUrlContent(content: string): string {
  const match = content.match(/URL\s*=\s*(https?:\/\/[^\s\r\n]+)/i);
  if (match) return match[1];
  const fallback = content.match(/(https?:\/\/[^\s\r\n]+)/i);
  return fallback ? fallback[1] : '';
}
