import React, { useRef, useState, useEffect } from 'react';
import { 
  Play, Pause, Volume2, VolumeX, Maximize, Minimize, 
  Settings, Bookmark, RotateCcw 
} from 'lucide-react';

interface SubtitleTrackUrl {
  label: string;
  srclang: string;
  url: string;
}

interface VideoPlayerProps {
  videoSrc: string;
  subtitles?: SubtitleTrackUrl[];
  lessonName: string;
  lessonPath: string;
  courseId: string;
  onVideoEnded: () => void;
  onTimeUpdate: (time: number) => void;
  onAddBookmark: (timestamp: number, note: string) => void;
  onMarkComplete?: () => void;
  hasNextLesson?: boolean;
}

// Confetti Component for celebration effect
const Confetti: React.FC = () => {
  const [particles, setParticles] = useState<Array<{ id: number; left: number; delay: number; color: string; size: number; duration: number; angle: number }>>([]);

  useEffect(() => {
    const colors = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];
    const p = Array.from({ length: 60 }).map((_, idx) => ({
      id: idx,
      left: Math.random() * 100,
      delay: Math.random() * 0.4,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: Math.random() * 8 + 6,
      duration: Math.random() * 2 + 1.5,
      angle: Math.random() * 360
    }));
    setParticles(p);
  }, []);

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 12 }}>
      {particles.map(pt => (
        <div
          key={pt.id}
          style={{
            position: 'absolute',
            top: '-20px',
            left: `${pt.left}%`,
            width: `${pt.size}px`,
            height: `${pt.size}px`,
            backgroundColor: pt.color,
            borderRadius: pt.id % 2 === 0 ? '50%' : '2px',
            opacity: 0.8,
            transform: `rotate(${pt.angle}deg)`,
            animation: `fallAndSpin ${pt.duration}s linear ${pt.delay}s forwards`
          }}
        />
      ))}
    </div>
  );
};

// Countdown Circle Component
const CountdownCircle: React.FC<{ duration: number; onComplete: () => void }> = ({ duration, onComplete }) => {
  const [timeLeft, setTimeLeft] = useState(duration);
  
  useEffect(() => {
    if (timeLeft <= 0) {
      onComplete();
      return;
    }
    const timer = setTimeout(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [timeLeft, onComplete]);

  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (timeLeft / duration) * circumference;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
      <div style={{ position: 'relative', width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="44" height="44" style={{ transform: 'rotate(-90deg)' }}>
          <circle
            cx="22"
            cy="22"
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="3"
          />
          <circle
            cx="22"
            cy="22"
            r={radius}
            fill="none"
            stroke="var(--color-primary)"
            strokeWidth="3"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{ transition: 'stroke-dashoffset 1s linear' }}
          />
        </svg>
        <span style={{ position: 'absolute', fontSize: '0.8rem', fontWeight: 600, color: 'white' }}>
          {timeLeft}
        </span>
      </div>
      <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
        Next lesson in {timeLeft}s
      </span>
    </div>
  );
};

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoSrc,
  subtitles,
  lessonName,
  lessonPath,
  courseId,
  onVideoEnded,
  onTimeUpdate,
  onAddBookmark,
  onMarkComplete,
  hasNextLesson = false
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTimeState, setCurrentTimeState] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [isSubtitlesOn, setIsSubtitlesOn] = useState(false);
  const [resumeNotice, setResumeNotice] = useState('');
  const [showCompletion, setShowCompletion] = useState(false);

  const resumeKey = `resume_${courseId}_${lessonPath}`;

  // Reset states on source change
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTimeState(0);
    setDuration(0);
    setResumeNotice('');
    setShowSpeedMenu(false);
    setShowCompletion(false);
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }
  }, [videoSrc, lessonPath]);

  // Keyboard shortcut listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in notes/bookmarks
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }
      
      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowRight':
        case 'KeyL':
          e.preventDefault();
          seek(10);
          break;
        case 'ArrowLeft':
        case 'KeyJ':
          e.preventDefault();
          seek(-10);
          break;
        case 'KeyF':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'KeyM':
          e.preventDefault();
          toggleMute();
          break;
        case 'KeyC':
          e.preventDefault();
          toggleSubtitles();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, isFullscreen, isMuted, isSubtitlesOn, showCompletion]);

  // Hide controls after 2.5s of mouse inactivity
  useEffect(() => {
    let timeout: any;
    const handleMouseMove = () => {
      setShowControls(true);
      clearTimeout(timeout);
      if (isPlaying) {
        timeout = setTimeout(() => setShowControls(false), 2500);
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('mousemove', handleMouseMove);
      container.addEventListener('mouseleave', () => isPlaying && setShowControls(false));
    }

    return () => {
      if (container) {
        container.removeEventListener('mousemove', handleMouseMove);
      }
      clearTimeout(timeout);
    };
  }, [isPlaying]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (showCompletion) {
      handleReplay();
      return;
    }
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().catch(err => console.log('Playback error:', err));
      setIsPlaying(true);
    }
  };

  const seek = (amount: number) => {
    if (!videoRef.current) return;
    if (showCompletion) {
      setShowCompletion(false);
    }
    const newTime = Math.min(
      Math.max(0, videoRef.current.currentTime + amount),
      duration
    );
    videoRef.current.currentTime = newTime;
    setCurrentTimeState(newTime);
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const newTime = parseFloat(e.target.value);
    videoRef.current.currentTime = newTime;
    setCurrentTimeState(newTime);
    if (showCompletion) {
      setShowCompletion(false);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const newMute = !isMuted;
    videoRef.current.muted = newMute;
    setIsMuted(newMute);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const newVol = parseFloat(e.target.value);
    videoRef.current.volume = newVol;
    setVolume(newVol);
    setIsMuted(newVol === 0);
  };

  const changeSpeed = (rate: number) => {
    if (!videoRef.current) return;
    videoRef.current.playbackRate = rate;
    setPlaybackRate(rate);
    setShowSpeedMenu(false);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(err => console.log('Fullscreen error:', err));
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Sync fullscreen state in case user exits using ESC key
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const toggleSubtitles = () => {
    if (!videoRef.current) return;
    const tracks = videoRef.current.textTracks;
    const newOn = !isSubtitlesOn;
    setIsSubtitlesOn(newOn);
    for (let i = 0; i < tracks.length; i++) {
      tracks[i].mode = newOn ? 'showing' : 'disabled';
    }
  };

  // Sync subtitles track visibility
  useEffect(() => {
    if (!videoRef.current) return;
    const tracks = videoRef.current.textTracks;
    for (let i = 0; i < tracks.length; i++) {
      tracks[i].mode = isSubtitlesOn ? 'showing' : 'disabled';
    }
  }, [subtitles, isSubtitlesOn]);

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    const videoDuration = videoRef.current.duration;
    setDuration(videoDuration);

    // Apply subtitle track mode
    const tracks = videoRef.current.textTracks;
    for (let i = 0; i < tracks.length; i++) {
      tracks[i].mode = isSubtitlesOn ? 'showing' : 'disabled';
    }

    // Read resume time
    const savedTime = parseFloat(localStorage.getItem(resumeKey) || '0');
    if (savedTime > 2 && savedTime < videoDuration - 5) {
      videoRef.current.currentTime = savedTime;
      setCurrentTimeState(savedTime);
      setResumeNotice(`Resumed from last position (${formatTime(savedTime)})`);
      setTimeout(() => setResumeNotice(''), 4000);
    }
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const time = videoRef.current.currentTime;
    setCurrentTimeState(time);
    onTimeUpdate(time);
    
    // Save progress to local storage (approx every 3 seconds or on milestones)
    if (Math.floor(time) % 3 === 0) {
      localStorage.setItem(resumeKey, time.toString());
    }
  };

  const handleVideoEnded = () => {
    setIsPlaying(false);
    localStorage.removeItem(resumeKey); // Clear resume marker when finished
    
    // Notify parent immediately to check sidebar box
    if (onMarkComplete) {
      onMarkComplete();
    }
    
    // Show completion screen celebration overlay
    setShowCompletion(true);
  };

  const handleReplay = () => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = 0;
    setCurrentTimeState(0);
    setShowCompletion(false);
    videoRef.current.play().catch(err => console.log('Playback replay error:', err));
    setIsPlaying(true);
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs)) return '00:00';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    
    const minutesStr = m.toString().padStart(2, '0');
    const secondsStr = s.toString().padStart(2, '0');
 
    if (h > 0) {
      return `${h}:${minutesStr}:${secondsStr}`;
    }
    return `${minutesStr}:${secondsStr}`;
  };

  const handleBookmarkCurrent = () => {
    const note = prompt('Enter a short bookmark note:', `Bookmark at ${formatTime(currentTimeState)}`);
    if (note !== null) {
      onAddBookmark(currentTimeState, note.trim() || `Bookmark`);
    }
  };

  const speeds = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];

  return (
    <div 
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        backgroundColor: '#000',
        borderRadius: isFullscreen ? '0px' : '16px',
        overflow: 'hidden',
        boxShadow: isFullscreen ? 'none' : 'var(--shadow-lg)',
        border: isFullscreen ? 'none' : '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      {/* CSS Animations style block */}
      <style>{`
        @keyframes strokeCheckmark {
          100% { stroke-dashoffset: 0; }
        }
        @keyframes scaleCheckmark {
          0%, 100% { transform: none; }
          50% { transform: scale3d(1.1, 1.1, 1); }
        }
        @keyframes fillCheckmark {
          100% { box-shadow: inset 0 0 0 30px #10b981; }
        }
        @keyframes fallAndSpin {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(600px) rotate(720deg);
            opacity: 0;
          }
        }
        @keyframes overlayFadeIn {
          from { opacity: 0; backdrop-filter: blur(0px); }
          to { opacity: 1; backdrop-filter: blur(16px); }
        }
        @keyframes cardPopIn {
          from { transform: scale(0.9); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>

      <video
        ref={videoRef}
        src={videoSrc}
        onClick={togglePlay}
        onDoubleClick={toggleFullscreen}
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleVideoEnded}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          cursor: 'pointer'
        }}
      >
        {(subtitles || []).map((track, idx) => (
          <track
            key={idx}
            kind="subtitles"
            src={track.url}
            srcLang={track.srclang}
            label={track.label}
            default={idx === 0}
          />
        ))}
      </video>

      {/* Mini bottom progress bar (visible when controls are hidden during active playback) */}
      {!showControls && isPlaying && !showCompletion && (
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '3px',
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          zIndex: 4
        }}>
          <div style={{
            height: '100%',
            width: `${(currentTimeState / (duration || 100)) * 100}%`,
            backgroundColor: 'var(--color-primary)',
            boxShadow: '0 0 6px var(--color-primary)',
            transition: 'width 0.1s linear'
          }} />
        </div>
      )}

      {/* Toast Notice for Resuming */}
      {resumeNotice && (
        <div style={{
          position: 'absolute',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'rgba(99, 102, 241, 0.95)',
          color: 'white',
          padding: '8px 16px',
          borderRadius: '20px',
          fontSize: '0.85rem',
          fontWeight: 500,
          backdropFilter: 'blur(4px)',
          boxShadow: 'var(--shadow-neon)',
          animation: 'fadeIn 0.3s ease',
          zIndex: 10
        }}>
          {resumeNotice}
        </div>
      )}

      {/* Completion Overlay Screen */}
      {showCompletion && (
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(9, 9, 11, 0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10,
          animation: 'overlayFadeIn 0.4s ease forwards',
          color: 'white',
          padding: '24px'
        }}>
          {/* Confetti celebration */}
          <Confetti />

          {/* Close button to dismiss overlay */}
          <button
            onClick={() => setShowCompletion(false)}
            title="Dismiss Completion Screen"
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'rgba(255,255,255,0.7)',
              cursor: 'pointer',
              zIndex: 13,
              fontSize: '1.2rem',
              lineHeight: '1',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.15)';
              e.currentTarget.style.color = 'white';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)';
              e.currentTarget.style.color = 'rgba(255,255,255,0.7)';
            }}
          >
            &times;
          </button>

          {/* Completion Card */}
          <div style={{
            width: '100%',
            maxWidth: '380px',
            background: 'rgba(20, 20, 25, 0.7)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '20px',
            padding: '32px 24px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            boxShadow: 'var(--shadow-neon), 0 20px 40px rgba(0,0,0,0.6)',
            animation: 'cardPopIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
            zIndex: 11
          }}>
            {/* SVG Animated Checkmark */}
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              display: 'block',
              strokeWidth: 4,
              stroke: '#10b981',
              strokeMiterlimit: 10,
              boxShadow: 'inset 0 0 0 #10b981',
              animation: 'fillCheckmark .4s ease-in-out .4s forwards, scaleCheckmark .3s ease-in-out .9s both',
              margin: '0 auto 16px auto'
            }}>
              <circle cx="26" cy="26" r="25" fill="none" style={{
                strokeDasharray: 166,
                strokeDashoffset: 166,
                strokeWidth: 4,
                strokeMiterlimit: 10,
                stroke: '#10b981',
                fill: 'none',
                animation: 'strokeCheckmark 0.6s cubic-bezier(0.65, 0, 0.45, 1) forwards'
              }}/>
              <path fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" style={{
                transformOrigin: '50% 50%',
                strokeDasharray: 48,
                strokeDashoffset: 48,
                stroke: '#ffffff',
                animation: 'strokeCheckmark 0.3s cubic-bezier(0.65, 0, 0.45, 1) 0.6s forwards'
              }}/>
            </svg>

            <h2 style={{
              fontSize: '1.45rem',
              fontWeight: 700,
              background: 'linear-gradient(135deg, #a5b4fc 0%, #818cf8 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              marginBottom: '6px',
              letterSpacing: '-0.02em'
            }}>
              Lesson Completed!
            </h2>
            <p style={{
              fontSize: '0.88rem',
              color: 'var(--text-secondary)',
              marginBottom: '24px',
              maxWidth: '90%',
              lineHeight: '1.4'
            }}>
              {lessonName}
            </p>

            {/* Countdown timer / completion banner */}
            {hasNextLesson ? (
              <div style={{ marginBottom: '24px' }}>
                <CountdownCircle duration={5} onComplete={onVideoEnded} />
              </div>
            ) : (
              <div style={{
                marginBottom: '24px',
                fontSize: '0.82rem',
                color: 'var(--color-success)',
                fontWeight: 600,
                backgroundColor: 'rgba(16, 185, 129, 0.08)',
                padding: '6px 16px',
                borderRadius: '20px',
                border: '1px solid rgba(16, 185, 129, 0.2)'
              }}>
                🎉 Course Completed!
              </div>
            )}

            {/* Completion Buttons */}
            <div style={{
              display: 'flex',
              gap: '12px',
              width: '100%',
              justifyContent: 'center'
            }}>
              <button
                onClick={handleReplay}
                style={{
                  flex: 1,
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  color: 'white',
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)'; }}
              >
                <RotateCcw size={15} />
                Replay
              </button>

              {hasNextLesson && (
                <button
                  onClick={onVideoEnded}
                  style={{
                    flex: 1,
                    background: 'var(--gradient-accent)',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '10px 14px',
                    color: 'white',
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    transition: 'opacity 0.2s',
                    boxShadow: 'var(--shadow-neon)'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
                >
                  Next Lesson
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Controls Overlay */}
      {showControls && !showCompletion && (
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 60%, transparent 100%)',
          padding: '24px 20px 16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          zIndex: 5,
          transition: 'opacity 0.25s ease',
          opacity: 1
        }}>
          {/* Progress Slider with Dynamic Gradient Track */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '0.78rem', color: 'white', fontVariationSettings: '"tnum" 1' }}>
              {formatTime(currentTimeState)}
            </span>
            <input
              type="range"
              min={0}
              max={duration || 100}
              step={0.1}
              value={currentTimeState}
              onChange={handleSeekChange}
              style={{
                flex: 1,
                cursor: 'pointer',
                height: '5px',
                borderRadius: '3px',
                background: `linear-gradient(to right, var(--color-primary) 0%, var(--color-primary) ${(currentTimeState / (duration || 100)) * 100}%, rgba(255,255,255,0.15) ${(currentTimeState / (duration || 100)) * 100}%, rgba(255,255,255,0.15) 100%)`,
                transition: 'height 0.15s ease'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.height = '7px'; }}
              onMouseLeave={(e) => { e.currentTarget.style.height = '5px'; }}
            />
            <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.7)', fontVariationSettings: '"tnum" 1' }}>
              {formatTime(duration)}
            </span>
          </div>

          {/* Button Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {/* Left buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {/* Toolbar Replay Button */}
              <button 
                onClick={handleReplay} 
                title="Replay from start"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255,255,255,0.8)',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  transition: 'color var(--transition-fast)'
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'white'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.8)'}
              >
                <RotateCcw size={16} />
              </button>

              {/* Skip 10s Backward */}
              <button 
                onClick={() => seek(-10)} 
                title="Skip backward 10s (J / ArrowLeft)"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255,255,255,0.8)',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  transition: 'color var(--transition-fast)'
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'white'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.8)'}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                  <path d="M3 3v5h5"/>
                  <text x="12" y="15.5" fontSize="8" fontFamily="Outfit, system-ui, sans-serif" fontWeight="bold" fill="currentColor" textAnchor="middle">10</text>
                </svg>
              </button>

              {/* Play / Pause */}
              <button 
                onClick={togglePlay} 
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'white',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                {isPlaying ? <Pause size={20} fill="white" /> : <Play size={20} fill="white" />}
              </button>

              {/* Skip 10s Forward */}
              <button 
                onClick={() => seek(10)} 
                title="Skip forward 10s (L / ArrowRight)"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255,255,255,0.8)',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  transition: 'color var(--transition-fast)'
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'white'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.8)'}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/>
                  <path d="M21 3v5h-5"/>
                  <text x="12" y="15.5" fontSize="8" fontFamily="Outfit, system-ui, sans-serif" fontWeight="bold" fill="currentColor" textAnchor="middle">10</text>
                </svg>
              </button>

              {/* Volume Slider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} className="volume-control">
                <button 
                  onClick={toggleMute}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'white',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  style={{
                    width: '60px',
                    height: '3px'
                  }}
                />
              </div>

              {/* CC Captions Button */}
              {subtitles && subtitles.length > 0 && (
                <button
                  onClick={toggleSubtitles}
                  title="Toggle Captions (C)"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: isSubtitlesOn ? 'var(--color-primary)' : 'rgba(255,255,255,0.8)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    transition: 'background 0.2s'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <div style={{
                    border: isSubtitlesOn ? '1.5px solid var(--color-primary)' : '1.5px solid rgba(255,255,255,0.8)',
                    borderRadius: '3px',
                    padding: '0px 3px',
                    fontSize: '0.65rem',
                    fontWeight: 'bold',
                    lineHeight: '1.2'
                  }}>
                    CC
                  </div>
                </button>
              )}

              {/* Quick Bookmark Trigger */}
              <button
                onClick={handleBookmarkCurrent}
                title="Bookmark current timestamp"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255,255,255,0.8)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.8rem',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)';
                  e.currentTarget.style.color = 'white';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'rgba(255,255,255,0.8)';
                }}
              >
                <Bookmark size={14} />
                <span>Bookmark</span>
              </button>
            </div>

            {/* Title display */}
            <span style={{
              fontSize: '0.82rem',
              color: 'rgba(255,255,255,0.7)',
              maxWidth: '30%',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              {lessonName}
            </span>

            {/* Right buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', position: 'relative' }}>
              {/* Playback speed trigger */}
              <button
                onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'white',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  padding: '4px 8px',
                  borderRadius: '4px'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <Settings size={15} />
                <span>{playbackRate}x</span>
              </button>

              {/* Speed Popover Menu */}
              {showSpeedMenu && (
                <div style={{
                  position: 'absolute',
                  bottom: '36px',
                  right: '36px',
                  backgroundColor: 'rgba(20, 20, 25, 0.95)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '8px',
                  padding: '6px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                  width: '90px',
                  zIndex: 20,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                  backdropFilter: 'blur(8px)'
                }}>
                  <div style={{ fontSize: '0.7rem', padding: '4px 8px', color: 'rgba(255,255,255,0.4)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    Speed
                  </div>
                  {speeds.map(rate => (
                    <button
                      key={rate}
                      onClick={() => changeSpeed(rate)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: playbackRate === rate ? 'var(--color-primary)' : 'white',
                        cursor: 'pointer',
                        padding: '4px 8px',
                        fontSize: '0.78rem',
                        textAlign: 'left',
                        borderRadius: '4px',
                        fontWeight: playbackRate === rate ? 600 : 400
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      {rate}x
                    </button>
                  ))}
                </div>
              )}

              {/* Fullscreen Button */}
              <button 
                onClick={toggleFullscreen}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'white',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
