import React, { useRef, useState, useEffect } from 'react';
import { 
  Play, Pause, Volume2, VolumeX, Maximize, Minimize, 
  Settings, Bookmark 
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
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoSrc,
  subtitles,
  lessonName,
  lessonPath,
  courseId,
  onVideoEnded,
  onTimeUpdate,
  onAddBookmark
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

  const resumeKey = `resume_${courseId}_${lessonPath}`;

  // Reset states on source change
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTimeState(0);
    setDuration(0);
    setResumeNotice('');
    setShowSpeedMenu(false);
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
          e.preventDefault();
          seek(5);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          seek(-5);
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
  }, [isPlaying, isFullscreen, isMuted, isSubtitlesOn]);

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
    videoRef.current.currentTime = Math.min(
      Math.max(0, videoRef.current.currentTime + amount),
      duration
    );
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const newTime = parseFloat(e.target.value);
    videoRef.current.currentTime = newTime;
    setCurrentTimeState(newTime);
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
    onVideoEnded();
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
                height: '4px'
              }}
            />
            <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.7)', fontVariationSettings: '"tnum" 1' }}>
              {formatTime(duration)}
            </span>
          </div>

          {/* Button Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {/* Left buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
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
