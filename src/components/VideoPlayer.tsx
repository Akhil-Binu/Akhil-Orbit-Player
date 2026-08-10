import React, { useRef, useState, useEffect, useCallback } from 'react';
import { 
  Play, Pause, Volume2, VolumeX, Maximize, Minimize, 
  Settings, Bookmark, RotateCcw, ChevronRight 
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
  hasNextLesson?: boolean;
  onVideoCompleted?: () => void;
}

const SkipBack10Icon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <text x="12" y="15" fontSize="7" fontWeight="bold" fontFamily="sans-serif" textAnchor="middle" fill="currentColor" stroke="none">10</text>
  </svg>
);

const SkipForward10Icon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
    <text x="12" y="15" fontSize="7" fontWeight="bold" fontFamily="sans-serif" textAnchor="middle" fill="currentColor" stroke="none">10</text>
  </svg>
);

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoSrc,
  subtitles,
  lessonName,
  lessonPath,
  courseId,
  onVideoEnded,
  onTimeUpdate,
  onAddBookmark,
  hasNextLesson = false,
  onVideoCompleted
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
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
  const [isCompleted, setIsCompleted] = useState(false);
  const [countdown, setCountdown] = useState(8);
  const [isCountdownActive, setIsCountdownActive] = useState(false);

  const resumeKey = `resume_${courseId}_${lessonPath}`;

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().catch(err => console.log('Playback error:', err));
      setIsPlaying(true);
    }
  }, [isPlaying]);

  const seek = useCallback((amount: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.min(
      Math.max(0, videoRef.current.currentTime + amount),
      duration
    );
  }, [duration]);

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const newTime = parseFloat(e.target.value);
    videoRef.current.currentTime = newTime;
    setCurrentTimeState(newTime);
  };

  const toggleMute = useCallback(() => {
    if (!videoRef.current) return;
    const newMute = !isMuted;
    videoRef.current.muted = newMute;
    setIsMuted(newMute);
  }, [isMuted]);

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

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(err => console.log('Fullscreen error:', err));
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  const toggleSubtitles = useCallback(() => {
    if (!videoRef.current) return;
    const tracks = videoRef.current.textTracks;
    const newOn = !isSubtitlesOn;
    setIsSubtitlesOn(newOn);
    for (let i = 0; i < tracks.length; i++) {
      tracks[i].mode = newOn ? 'showing' : 'disabled';
    }
  }, [isSubtitlesOn]);

  const handleReplay = useCallback(() => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = 0;
    setCurrentTimeState(0);
    setIsCompleted(false);
    setIsCountdownActive(false);
    videoRef.current.play().then(() => {
      setIsPlaying(true);
    }).catch(err => console.log('Replay error:', err));
  }, []);

  // Sync playback rate when video element mounts
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate, videoSrc]);

  // Keyboard shortcut listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in notes/bookmarks
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }
      
      switch (e.code) {
        case 'Space':
        case 'KeyK':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowRight':
          e.preventDefault();
          seek(5);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          seek(-5);
          break;
        case 'KeyL':
          e.preventDefault();
          seek(10);
          break;
        case 'KeyJ':
          e.preventDefault();
          seek(-10);
          break;
        case 'KeyR':
          e.preventDefault();
          handleReplay();
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
  }, [isPlaying, isFullscreen, isMuted, isSubtitlesOn, duration, togglePlay, seek, handleReplay, toggleFullscreen, toggleMute, toggleSubtitles]);

  // Hide controls after 2.5s of mouse inactivity
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
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

  // Sync fullscreen state in case user exits using ESC key
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

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
    setIsCompleted(true);
    if (onVideoCompleted) {
      onVideoCompleted();
    }
    if (hasNextLesson) {
      setCountdown(8);
      setIsCountdownActive(true);
    }
  };

  // Countdown timer effect for auto-advance
  useEffect(() => {
    if (!isCountdownActive) return;
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setIsCountdownActive(false);
          onVideoEnded();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isCountdownActive, onVideoEnded]);

  // Confetti particles effect on complete
  useEffect(() => {
    if (!isCompleted || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = canvas.offsetWidth || 800);
    let height = (canvas.height = canvas.offsetHeight || 450);

    const resizeCanvas = () => {
      if (!canvas) return;
      width = canvas.width = canvas.clientWidth;
      height = canvas.height = canvas.clientHeight;
    };
    window.addEventListener('resize', resizeCanvas);

    const colors = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#a855f7'];
    const particles: Array<{
      x: number;
      y: number;
      size: number;
      color: string;
      speedX: number;
      speedY: number;
      rotation: number;
      rotationSpeed: number;
      opacity: number;
    }> = [];

    const particleCount = 120;
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: width / 2,
        y: height / 2 + 50,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        speedX: (Math.random() - 0.5) * 12,
        speedY: -Math.random() * 15 - 5,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10,
        opacity: 1
      });
    }

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      let alive = false;
      particles.forEach((p) => {
        if (p.opacity <= 0) return;
        alive = true;

        p.x += p.speedX;
        p.y += p.speedY;
        p.speedY += 0.25; // gravity
        p.speedX *= 0.98;
        p.rotation += p.rotationSpeed;
        p.opacity -= 0.005;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = Math.max(0, p.opacity);
        ctx.fillStyle = p.color;
        
        if (p.size % 2 === 0) {
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      });

      if (alive) {
        animationFrameId = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [isCompleted]);

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

      {/* Confetti Canvas */}
      {isCompleted && (
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 14
          }}
        />
      )}

      {/* Completion Overlay */}
      {isCompleted && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(9, 9, 11, 0.92)',
          backdropFilter: 'blur(12px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 15,
          color: 'white',
          animation: 'fadeIn 0.3s ease-out',
          textAlign: 'center',
          padding: '24px'
        }}>
          <style>{`
            @keyframes scaleIn {
              0% { transform: scale(0.3); opacity: 0; }
              50% { transform: scale(1.05); }
              70% { transform: scale(0.9); }
              100% { transform: scale(1); opacity: 1; }
            }
            @keyframes drawCheck {
              to { strokeDashoffset: 0; }
            }
          `}</style>

          {/* Animated Checkmark Badge */}
          <div style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '84px',
            height: '84px',
            borderRadius: '50%',
            background: 'var(--gradient-glow)',
            border: '2px solid var(--color-success)',
            boxShadow: '0 0 30px rgba(16, 185, 129, 0.4)',
            marginBottom: '20px',
            animation: 'scaleIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards'
          }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" style={{
                strokeDasharray: 50,
                strokeDashoffset: 50,
                animation: 'drawCheck 0.4s ease-out 0.3s forwards'
              }} />
            </svg>
          </div>

          <h2 style={{
            fontSize: '1.8rem',
            fontWeight: 700,
            marginBottom: '8px',
            background: 'linear-gradient(135deg, #10b981 0%, #6366f1 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '-0.02em'
          }}>
            Lesson Completed!
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '32px', maxWidth: '80%' }}>
            {lessonName}
          </p>

          {hasNextLesson && isCountdownActive && (
            <div style={{
              width: '100%',
              maxWidth: '320px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '32px',
              background: 'rgba(255,255,255,0.03)',
              padding: '16px',
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.05)'
            }}>
              <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>
                Next lesson in <strong style={{ color: 'var(--color-primary)', fontVariationSettings: '"tnum" 1' }}>{countdown}</strong> seconds
              </span>
              <div style={{
                width: '100%',
                height: '4px',
                backgroundColor: 'rgba(255,255,255,0.1)',
                borderRadius: '2px',
                overflow: 'hidden'
              }}>
                <div style={{
                  height: '100%',
                  backgroundColor: 'var(--color-primary)',
                  width: `${(countdown / 8) * 100}%`,
                  transition: 'width 1s linear'
                }} />
              </div>
              <button
                onClick={() => setIsCountdownActive(!isCountdownActive)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255,255,255,0.5)',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  textDecoration: 'underline'
                }}
              >
                {isCountdownActive ? 'Pause Countdown' : 'Resume Countdown'}
              </button>
            </div>
          )}

          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              onClick={handleReplay}
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: 'white',
                padding: '10px 20px',
                borderRadius: '8px',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.15)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'}
            >
              <RotateCcw size={16} />
              Replay
            </button>

            {hasNextLesson && (
              <button
                onClick={onVideoEnded}
                style={{
                  background: 'var(--gradient-accent)',
                  border: 'none',
                  color: 'white',
                  padding: '10px 20px',
                  borderRadius: '8px',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s',
                  boxShadow: 'var(--shadow-neon)'
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'none'}
              >
                Next Lesson
                <ChevronRight size={16} />
              </button>
            )}

            <button
              onClick={() => {
                setIsCountdownActive(false);
                setIsCompleted(false);
              }}
              style={{
                background: 'none',
                border: '1px solid rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.6)',
                padding: '10px 20px',
                borderRadius: '8px',
                fontSize: '0.9rem',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}
            >
              Stay
            </button>
          </div>
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

      {/* Controls Overlay */}
      {showControls && (
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
          {/* Progress Slider */}
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
                height: '4px',
                background: `linear-gradient(to right, var(--color-primary) ${(currentTimeState / (duration || 1)) * 100}%, rgba(255,255,255,0.1) ${(currentTimeState / (duration || 1)) * 100}%)`,
                transition: 'background 0.1s ease'
              }}
            />
            <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.7)', fontVariationSettings: '"tnum" 1' }}>
              {formatTime(duration)}
            </span>
          </div>

          {/* Button Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {/* Left buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              {/* Skip Back 10s */}
              <button 
                onClick={() => seek(-10)} 
                title="Seek backward 10s (J)"
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
                <SkipBack10Icon />
              </button>

              {/* Play/Pause */}
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

              {/* Skip Forward 10s */}
              <button 
                onClick={() => seek(10)} 
                title="Seek forward 10s (L)"
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
                <SkipForward10Icon />
              </button>

              {/* Replay Button */}
              <button 
                onClick={handleReplay} 
                title="Replay Video (R)"
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
                <RotateCcw size={18} />
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
                    height: '3px',
                    background: `linear-gradient(to right, var(--color-primary) ${(isMuted ? 0 : volume) * 100}%, rgba(255,255,255,0.2) ${(isMuted ? 0 : volume) * 100}%)`,
                    transition: 'background 0.1s ease'
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
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
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
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
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
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
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
