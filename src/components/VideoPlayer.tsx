import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Play, Pause, Volume2, VolumeX, Maximize, Minimize, 
  Settings, Bookmark, RotateCcw, ChevronRight, ChevronDown,
  Headphones, Check, Upload, CheckCircle2 
} from 'lucide-react';
import { extractMp4AudioTrack, detectEmbeddedAudioTracks, srtToVtt } from '../utils/mediaMetadata';

export interface SubtitleTrackUrl {
  label: string;
  srclang: string;
  url: string;
  isCustom?: boolean;
}

export interface AudioTrackOption {
  id: string;
  label: string;
  language?: string;
  languageCode?: string;
  url?: string;
  isInternal?: boolean;
  internalIndex?: number;
  isCustom?: boolean;
  isEmbedded?: boolean;
  embeddedIndex?: number;
  trackId?: number;
  codec?: string;
}

export interface VideoBookmark {
  id: string;
  timestamp: number;
  note: string;
  createdAt: number;
}

interface VideoPlayerProps {
  videoSrc: string;
  fileObj?: File | null;
  subtitles?: SubtitleTrackUrl[];
  audioTracks?: AudioTrackOption[];
  lessonName: string;
  lessonPath: string;
  courseId: string;
  onVideoEnded: () => void;
  onTimeUpdate: (time: number) => void;
  onAddBookmark: (timestamp: number, note: string) => void;
  bookmarks?: VideoBookmark[];
  hasNextLesson?: boolean;
  onVideoCompleted?: () => void;
  isLessonCompleted?: boolean;
  onToggleCompleted?: () => void;
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
  fileObj,
  subtitles,
  audioTracks,
  lessonName,
  lessonPath,
  courseId,
  onVideoEnded,
  onTimeUpdate,
  onAddBookmark,
  bookmarks,
  hasNextLesson = false,
  onVideoCompleted,
  isLessonCompleted = false,
  onToggleCompleted
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // YouTube-Style Hover Preview & Scrubber Refs & State
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const [isHoveringTimeline, setIsHoveringTimeline] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [isPreciseSeeking, setIsPreciseSeeking] = useState(false);
  const [hoverTime, setHoverTime] = useState(0);
  const [hoverX, setHoverX] = useState(0);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const isPreviewSeekingRef = useRef(false);
  const pendingPreviewTimeRef = useRef<number | null>(null);

  const wasPlayingBeforeScrubRef = useRef(false);
  const dragStartYRef = useRef(0);
  const dragStartXRef = useRef(0);
  const dragStartTimeRef = useRef(0);
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
  const [selectedSubtitleIndex, setSelectedSubtitleIndex] = useState(0);
  const [customSubtitles, setCustomSubtitles] = useState<SubtitleTrackUrl[]>([]);
  const [showSubtitleMenu, setShowSubtitleMenu] = useState(false);
  const subtitleFileInputRef = useRef<HTMLInputElement>(null);
  const [resumeNotice, setResumeNotice] = useState('');
  const [isCompleted, setIsCompleted] = useState(false);
  const [countdown, setCountdown] = useState(8);
  const [isCountdownActive, setIsCountdownActive] = useState(false);

  // Audio track states
  const [selectedAudioTrackId, setSelectedAudioTrackId] = useState<string>('default');
  const [internalAudioTracks, setInternalAudioTracks] = useState<AudioTrackOption[]>([]);
  const [customAudioTracks, setCustomAudioTracks] = useState<AudioTrackOption[]>([]);
  const [detectedTracks, setDetectedTracks] = useState<AudioTrackOption[]>([]);
  const [isScanningTracks, setIsScanningTracks] = useState(false);
  const [showAudioMenu, setShowAudioMenu] = useState(false);
  const [audioSyncOffset, setAudioSyncOffset] = useState(0);
  const [isExtractingAudio, setIsExtractingAudio] = useState(false);
  const [extractedBlobUrls, setExtractedBlobUrls] = useState<Record<string, string>>({});

  // Assemble complete subtitles list (prop tracks + custom loaded tracks)
  const allSubtitles: SubtitleTrackUrl[] = useMemo(() => {
    return [...(subtitles || []), ...customSubtitles];
  }, [subtitles, customSubtitles]);

  const resumeKey = `resume_${courseId}_${lessonPath}`;

  // Independent scanner fallback on fileObj
  useEffect(() => {
    let isCancelled = false;
    if (fileObj) {
      setIsScanningTracks(true);
      detectEmbeddedAudioTracks(fileObj)
        .then(tracks => {
          if (!isCancelled && tracks.length > 0) {
            const mapped: AudioTrackOption[] = tracks.map((et, idx) => ({
              id: et.id,
              label: et.label,
              language: et.language,
              languageCode: et.languageCode,
              codec: et.codec,
              isEmbedded: true,
              embeddedIndex: idx,
              trackId: et.trackId
            }));
            setDetectedTracks(mapped);
          }
        })
        .catch(err => console.warn('[VideoPlayer] Fallback track detection err:', err))
        .finally(() => {
          if (!isCancelled) setIsScanningTracks(false);
        });
    } else {
      setDetectedTracks([]);
      setIsScanningTracks(false);
    }
    return () => { isCancelled = true; };
  }, [fileObj, videoSrc]);

  // Merge prop tracks and directly detected tracks without duplicates
  const rawTrackList = [
    ...(audioTracks || []),
    ...detectedTracks.filter(dt => !(audioTracks || []).some(at => at.id === dt.id))
  ];

  // Partition embedded and external tracks
  const embeddedList = rawTrackList.filter(t => t.isEmbedded);
  const externalList = rawTrackList.filter(t => !t.isEmbedded);

  // Assemble complete audio tracks list with VLC parity
  const allAudioTracks: AudioTrackOption[] = [
    ...(embeddedList.length > 0
      ? [
          {
            ...embeddedList[0],
            id: 'default',
            label: `${embeddedList[0].label} (Main)`,
            url: undefined
          },
          ...embeddedList.slice(1).map(t => ({
            ...t,
            url: extractedBlobUrls[t.id] || t.url
          }))
        ]
      : [
          {
            id: 'default',
            label: internalAudioTracks.length > 0 ? `${internalAudioTracks[0].label} (Default)` : 'Default Audio (Main)',
            language: internalAudioTracks[0]?.language || 'default'
          },
          ...internalAudioTracks.slice(1)
        ]
    ),
    ...externalList,
    ...customAudioTracks
  ];

  const activeAudioTrack = allAudioTracks.find(t => t.id === selectedAudioTrackId) || allAudioTracks[0];

  // Reset states on source change
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTimeState(0);
    setDuration(0);
    setResumeNotice('');
    setShowSpeedMenu(false);
    setShowAudioMenu(false);
    setShowSubtitleMenu(false);
    customSubtitles.forEach(track => {
      if (track.isCustom && track.url) URL.revokeObjectURL(track.url);
    });
    setCustomSubtitles([]);
    setSelectedSubtitleIndex(0);
    setSelectedAudioTrackId('default');
    setAudioSyncOffset(0);
    setInternalAudioTracks([]);
    setDetectedTracks([]);
    setIsExtractingAudio(false);
    setExtractedBlobUrls({});
    setIsCompleted(false);
    setCountdown(8);
    setIsCountdownActive(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
      videoRef.current.muted = isMuted;
    }
  }, [videoSrc, lessonPath]);

  // Clean up extracted blob URLs on change
  useEffect(() => {
    return () => {
      Object.values(extractedBlobUrls).forEach(url => URL.revokeObjectURL(url));
    };
  }, [extractedBlobUrls]);

  // Clean up custom audio blob URLs
  useEffect(() => {
    return () => {
      customAudioTracks.forEach(t => {
        if (t.url) URL.revokeObjectURL(t.url);
      });
    };
  }, [customAudioTracks]);

  // Clean up custom subtitle blob URLs
  useEffect(() => {
    return () => {
      customSubtitles.forEach(track => {
        if (track.isCustom && track.url) URL.revokeObjectURL(track.url);
      });
    };
  }, [customSubtitles]);

  // Close menus on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.player-menu-popover') && !target.closest('.player-menu-trigger')) {
        setShowSpeedMenu(false);
        setShowAudioMenu(false);
        setShowSubtitleMenu(false);
      }
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

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
        case 'KeyA':
          e.preventDefault();
          cycleAudioTrack();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, isFullscreen, isMuted, isSubtitlesOn, duration, selectedAudioTrackId, allAudioTracks, activeAudioTrack]);

  // Hide controls after 2.5s of mouse inactivity
  useEffect(() => {
    let timeout: any;
    const handleMouseMove = () => {
      setShowControls(true);
      clearTimeout(timeout);
      if (isPlaying && !isHoveringTimeline && !isScrubbing) {
        timeout = setTimeout(() => setShowControls(false), 2500);
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('mousemove', handleMouseMove);
      container.addEventListener('mouseleave', () => isPlaying && !isScrubbing && setShowControls(false));
    }

    return () => {
      if (container) {
        container.removeEventListener('mousemove', handleMouseMove);
      }
      clearTimeout(timeout);
    };
  }, [isPlaying, isHoveringTimeline, isScrubbing]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      if (audioRef.current && activeAudioTrack.url) {
        audioRef.current.pause();
      }
      setIsPlaying(false);
    } else {
      videoRef.current.play().catch(err => console.log('Playback error:', err));
      if (audioRef.current && activeAudioTrack.url) {
        audioRef.current.currentTime = Math.max(0, videoRef.current.currentTime + audioSyncOffset);
        audioRef.current.play().catch(err => console.log('Audio playback error:', err));
      }
      setIsPlaying(true);
    }
  };

  const seek = (amount: number) => {
    if (!videoRef.current) return;
    const newTime = Math.min(
      Math.max(0, videoRef.current.currentTime + amount),
      duration
    );
    videoRef.current.currentTime = newTime;
    setCurrentTimeState(newTime);
    if (audioRef.current && activeAudioTrack.url) {
      audioRef.current.currentTime = Math.max(0, newTime + audioSyncOffset);
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '00:00';
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

  const activeBookmarks = useMemo(() => {
    if (bookmarks && bookmarks.length > 0) return bookmarks;
    const key = `bookmarks_${courseId}_${lessonPath}`;
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as VideoBookmark[]) : [];
    } catch {
      return [];
    }
  }, [bookmarks, courseId, lessonPath]);

  const matchedBookmark = useMemo(() => {
    if (!activeBookmarks || activeBookmarks.length === 0) return null;
    return activeBookmarks.find(bm => Math.abs(bm.timestamp - hoverTime) <= 3);
  }, [activeBookmarks, hoverTime]);

  const requestPreviewSeek = useCallback((targetTime: number) => {
    const videoEl = previewVideoRef.current;
    if (!videoEl || !duration || isNaN(targetTime)) return;
    const clampedTime = Math.max(0, Math.min(duration, targetTime));

    if (isPreviewSeekingRef.current) {
      pendingPreviewTimeRef.current = clampedTime;
      return;
    }

    if (videoEl.readyState < 1) {
      pendingPreviewTimeRef.current = clampedTime;
      return;
    }

    isPreviewSeekingRef.current = true;
    setIsPreviewLoading(true);

    try {
      if ('fastSeek' in videoEl && typeof (videoEl as any).fastSeek === 'function') {
        (videoEl as any).fastSeek(clampedTime);
      } else {
        videoEl.currentTime = clampedTime;
      }
    } catch {
      isPreviewSeekingRef.current = false;
      setIsPreviewLoading(false);
    }
  }, [duration]);

  const handlePreviewSeeked = useCallback(() => {
    setIsPreviewLoading(false);
    isPreviewSeekingRef.current = false;
    if (pendingPreviewTimeRef.current !== null) {
      const nextTime = pendingPreviewTimeRef.current;
      pendingPreviewTimeRef.current = null;
      requestPreviewSeek(nextTime);
    }
  }, [requestPreviewSeek]);

  const handlePreviewLoadedMetadata = useCallback(() => {
    if (pendingPreviewTimeRef.current !== null) {
      const t = pendingPreviewTimeRef.current;
      pendingPreviewTimeRef.current = null;
      requestPreviewSeek(t);
    }
  }, [requestPreviewSeek]);

  const handlePreviewError = useCallback(() => {
    setIsPreviewLoading(false);
    isPreviewSeekingRef.current = false;
  }, []);

  useEffect(() => {
    if (previewVideoRef.current && videoSrc) {
      try {
        previewVideoRef.current.currentTime = 0;
      } catch {
        // ignore
      }
    }
    setIsPreviewLoading(false);
    isPreviewSeekingRef.current = false;
    pendingPreviewTimeRef.current = null;
  }, [videoSrc]);

  const handleTimelineMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration || !progressBarRef.current) return;
    e.preventDefault();

    const rect = progressBarRef.current.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const fraction = Math.max(0, Math.min(1, offsetX / rect.width));
    const newTime = fraction * duration;

    wasPlayingBeforeScrubRef.current = isPlaying;
    if (isPlaying && videoRef.current) {
      videoRef.current.pause();
      if (audioRef.current && activeAudioTrack.url) {
        audioRef.current.pause();
      }
    }

    setIsScrubbing(true);
    dragStartYRef.current = e.clientY;
    dragStartXRef.current = e.clientX;
    dragStartTimeRef.current = newTime;

    setHoverX(offsetX);
    setHoverTime(newTime);
    requestPreviewSeek(newTime);

    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
      setCurrentTimeState(newTime);
      if (audioRef.current && activeAudioTrack.url) {
        audioRef.current.currentTime = Math.max(0, newTime + audioSyncOffset);
      }
    }
  };

  useEffect(() => {
    if (!isScrubbing) return;

    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!progressBarRef.current || !duration) return;
      const rect = progressBarRef.current.getBoundingClientRect();

      const deltaY = dragStartYRef.current - e.clientY;
      const isPullUp = deltaY > 35;
      setIsPreciseSeeking(isPullUp);

      let targetTime = 0;
      if (isPullUp) {
        const deltaX = e.clientX - dragStartXRef.current;
        const timeOffset = (deltaX / 100) * 5;
        targetTime = Math.max(0, Math.min(duration, dragStartTimeRef.current + timeOffset));
        const barX = (targetTime / duration) * rect.width;
        setHoverX(barX);
      } else {
        const offsetX = e.clientX - rect.left;
        const fraction = Math.max(0, Math.min(1, offsetX / rect.width));
        targetTime = fraction * duration;
        setHoverX(Math.max(0, Math.min(rect.width, offsetX)));
      }

      setHoverTime(targetTime);
      requestPreviewSeek(targetTime);

      if (videoRef.current) {
        videoRef.current.currentTime = targetTime;
        setCurrentTimeState(targetTime);
        if (audioRef.current && activeAudioTrack.url) {
          audioRef.current.currentTime = Math.max(0, targetTime + audioSyncOffset);
        }
      }
    };

    const handleGlobalMouseUp = () => {
      setIsScrubbing(false);
      setIsPreciseSeeking(false);

      if (wasPlayingBeforeScrubRef.current && videoRef.current) {
        videoRef.current.play().catch(err => console.log('Playback error after scrub:', err));
        if (audioRef.current && activeAudioTrack.url) {
          audioRef.current.play().catch(err => console.log('Audio playback error after scrub:', err));
        }
        setIsPlaying(true);
      }
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isScrubbing, duration, requestPreviewSeek, activeAudioTrack, audioSyncOffset]);

  const handleTimelineMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration || !progressBarRef.current || isScrubbing) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const fraction = Math.max(0, Math.min(1, offsetX / rect.width));
    const time = fraction * duration;

    setHoverX(offsetX);
    setHoverTime(time);
    setIsHoveringTimeline(true);
    requestPreviewSeek(time);
  };

  const handleTimelineMouseEnter = () => {
    setIsHoveringTimeline(true);
  };

  const handleTimelineMouseLeave = () => {
    if (!isScrubbing) {
      setIsHoveringTimeline(false);
    }
  };

  const handleTimelineTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!duration || !progressBarRef.current || e.touches.length === 0) return;
    const touch = e.touches[0];
    const rect = progressBarRef.current.getBoundingClientRect();
    const offsetX = touch.clientX - rect.left;
    const fraction = Math.max(0, Math.min(1, offsetX / rect.width));
    const newTime = fraction * duration;

    wasPlayingBeforeScrubRef.current = isPlaying;
    if (isPlaying && videoRef.current) {
      videoRef.current.pause();
      if (audioRef.current && activeAudioTrack.url) audioRef.current.pause();
    }

    setIsScrubbing(true);
    setIsHoveringTimeline(true);
    dragStartYRef.current = touch.clientY;
    dragStartXRef.current = touch.clientX;
    dragStartTimeRef.current = newTime;

    setHoverX(offsetX);
    setHoverTime(newTime);
    requestPreviewSeek(newTime);

    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
      setCurrentTimeState(newTime);
      if (audioRef.current && activeAudioTrack.url) {
        audioRef.current.currentTime = Math.max(0, newTime + audioSyncOffset);
      }
    }
  };

  const handleTimelineTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isScrubbing || !duration || !progressBarRef.current || e.touches.length === 0) return;
    const touch = e.touches[0];
    const rect = progressBarRef.current.getBoundingClientRect();

    const deltaY = dragStartYRef.current - touch.clientY;
    const isPullUp = deltaY > 35;
    setIsPreciseSeeking(isPullUp);

    let targetTime = 0;
    if (isPullUp) {
      const deltaX = touch.clientX - dragStartXRef.current;
      const timeOffset = (deltaX / 100) * 5;
      targetTime = Math.max(0, Math.min(duration, dragStartTimeRef.current + timeOffset));
      setHoverX((targetTime / duration) * rect.width);
    } else {
      const offsetX = touch.clientX - rect.left;
      const fraction = Math.max(0, Math.min(1, offsetX / rect.width));
      targetTime = fraction * duration;
      setHoverX(Math.max(0, Math.min(rect.width, offsetX)));
    }

    setHoverTime(targetTime);
    requestPreviewSeek(targetTime);

    if (videoRef.current) {
      videoRef.current.currentTime = targetTime;
      setCurrentTimeState(targetTime);
      if (audioRef.current && activeAudioTrack.url) {
        audioRef.current.currentTime = Math.max(0, targetTime + audioSyncOffset);
      }
    }
  };

  const handleTimelineTouchEnd = () => {
    setIsScrubbing(false);
    setIsPreciseSeeking(false);
    setIsHoveringTimeline(false);

    if (wasPlayingBeforeScrubRef.current && videoRef.current) {
      videoRef.current.play().catch(err => console.log('Playback error:', err));
      if (audioRef.current && activeAudioTrack.url) {
        audioRef.current.play().catch(err => console.log('Audio error:', err));
      }
      setIsPlaying(true);
    }
  };

  const handleTimelineKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      seek(-5);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      seek(5);
    } else if (e.key === 'Home') {
      e.preventDefault();
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        setCurrentTimeState(0);
      }
    } else if (e.key === 'End') {
      e.preventDefault();
      if (videoRef.current && duration) {
        videoRef.current.currentTime = duration;
        setCurrentTimeState(duration);
      }
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const newMute = !isMuted;
    if (activeAudioTrack.url) {
      videoRef.current.muted = true;
      if (audioRef.current) audioRef.current.muted = newMute;
    } else {
      videoRef.current.muted = newMute;
    }
    setIsMuted(newMute);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const newVol = parseFloat(e.target.value);
    videoRef.current.volume = newVol;
    if (audioRef.current) {
      audioRef.current.volume = newVol;
      audioRef.current.muted = newVol === 0;
    }
    setVolume(newVol);
    setIsMuted(newVol === 0);
  };

  const changeSpeed = (rate: number) => {
    if (!videoRef.current) return;
    videoRef.current.playbackRate = rate;
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
    setPlaybackRate(rate);
    setShowSpeedMenu(false);
  };

  const handleSelectAudioTrack = async (trackId: string) => {
    setSelectedAudioTrackId(trackId);
    setShowAudioMenu(false);

    const track = allAudioTracks.find(t => t.id === trackId);
    const trackLabel = track ? track.label : 'Default';
    setResumeNotice(`Audio: ${trackLabel}`);
    setTimeout(() => setResumeNotice(''), 3000);

    if (!videoRef.current) return;

    if (trackId === 'default') {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const videoEl = videoRef.current as any;
      if (videoEl.audioTracks && videoEl.audioTracks.length > 0) {
        for (let i = 0; i < videoEl.audioTracks.length; i++) {
          videoEl.audioTracks[i].enabled = (i === 0);
        }
      }
      videoRef.current.muted = isMuted;
      return;
    }

    // 1. Check if browser supports native container audioTracks (e.g. Safari or Chrome with flag)
    const videoEl = videoRef.current as any;
    if (videoEl.audioTracks && videoEl.audioTracks.length > 1) {
      if (audioRef.current) audioRef.current.pause();
      const targetIdx = track?.embeddedIndex !== undefined ? track.embeddedIndex : (track?.internalIndex || 0);
      for (let i = 0; i < videoEl.audioTracks.length; i++) {
        videoEl.audioTracks[i].enabled = (i === targetIdx);
      }
      videoRef.current.muted = isMuted;
      return;
    }

    // 2. If it's an external URL (already has track.url or cached in extractedBlobUrls)
    const targetUrl = track?.url || extractedBlobUrls[trackId];
    if (targetUrl) {
      playExternalAudio(targetUrl);
      return;
    }

    // 3. If it's an embedded track that needs demuxing/extraction in Chromium
    if (track?.isEmbedded && fileObj) {
      setIsExtractingAudio(true);
      setResumeNotice(`Demuxing ${track.label}...`);
      try {
        const targetTrackId = track.trackId || (track.embeddedIndex !== undefined ? track.embeddedIndex + 1 : 1);
        const extractedUrl = await extractMp4AudioTrack(fileObj, targetTrackId);
        if (extractedUrl) {
          setExtractedBlobUrls(prev => ({ ...prev, [track.id]: extractedUrl }));
          playExternalAudio(extractedUrl);
          setResumeNotice(`Playing: ${track.label}`);
          setTimeout(() => setResumeNotice(''), 3000);
        } else {
          setResumeNotice(`Track active: ${track.label}`);
          setTimeout(() => setResumeNotice(''), 4000);
        }
      } catch (err) {
        console.warn('Audio extraction error:', err);
      } finally {
        setIsExtractingAudio(false);
      }
    }
  };

  const playExternalAudio = (url: string) => {
    if (!videoRef.current) return;
    videoRef.current.muted = true;
    if (audioRef.current) {
      audioRef.current.src = url;
      audioRef.current.currentTime = Math.max(0, videoRef.current.currentTime + audioSyncOffset);
      audioRef.current.playbackRate = playbackRate;
      audioRef.current.volume = isMuted ? 0 : volume;
      audioRef.current.muted = isMuted;
      if (isPlaying) {
        audioRef.current.play().catch(e => console.log('Audio track playback error:', e));
      }
    }
  };

  const handleCustomAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    const baseName = file.name.replace(/\.[^/.]+$/, '');
    const newTrack: AudioTrackOption = {
      id: `custom_${Date.now()}`,
      label: `${baseName} (Custom)`,
      url,
      isCustom: true
    };
    setCustomAudioTracks(prev => [...prev, newTrack]);
    handleSelectAudioTrack(newTrack.id);
    e.target.value = '';
  };

  const adjustAudioSync = (delta: number) => {
    const newOffset = Math.round((audioSyncOffset + delta) * 10) / 10;
    if (newOffset >= -5 && newOffset <= 5) {
      setAudioSyncOffset(newOffset);
      if (audioRef.current && videoRef.current) {
        audioRef.current.currentTime = Math.max(0, videoRef.current.currentTime + newOffset);
      }
    }
  };

  const cycleAudioTrack = () => {
    if (allAudioTracks.length <= 1) return;
    const currentIndex = allAudioTracks.findIndex(t => t.id === selectedAudioTrackId);
    const nextIndex = (currentIndex + 1) % allAudioTracks.length;
    handleSelectAudioTrack(allAudioTracks[nextIndex].id);
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

  const applySubtitleMode = useCallback((on: boolean, targetIdx: number) => {
    if (!videoRef.current) return;
    const tracks = videoRef.current.textTracks;
    for (let i = 0; i < tracks.length; i++) {
      if (on && i === targetIdx) {
        tracks[i].mode = 'showing';
      } else {
        tracks[i].mode = 'disabled';
      }
    }
  }, []);

  const toggleSubtitles = () => {
    setShowSubtitleMenu(false);
    setShowAudioMenu(false);
    setShowSpeedMenu(false);

    if (allSubtitles.length === 0) {
      if (subtitleFileInputRef.current) {
        subtitleFileInputRef.current.click();
      }
      setResumeNotice('No subtitles available — select a .vtt or .srt file');
      setTimeout(() => setResumeNotice(''), 3500);
      return;
    }

    const newOn = !isSubtitlesOn;
    setIsSubtitlesOn(newOn);
    applySubtitleMode(newOn, selectedSubtitleIndex);

    if (newOn) {
      const activeTrack = allSubtitles[selectedSubtitleIndex] || allSubtitles[0];
      setResumeNotice(`Captions On (${activeTrack?.label || 'Active'})`);
    } else {
      setResumeNotice('Captions Off');
    }
    setTimeout(() => setResumeNotice(''), 2500);
  };

  const handleSelectSubtitleTrack = (index: number) => {
    if (index === -1) {
      setIsSubtitlesOn(false);
      applySubtitleMode(false, selectedSubtitleIndex);
      setResumeNotice('Captions Off');
    } else {
      setSelectedSubtitleIndex(index);
      setIsSubtitlesOn(true);
      applySubtitleMode(true, index);
      const activeTrack = allSubtitles[index];
      setResumeNotice(`Captions: ${activeTrack?.label || 'Active'}`);
    }
    setTimeout(() => setResumeNotice(''), 2500);
    setShowSubtitleMenu(false);
  };

  const handleCustomSubtitleLoad = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      let trackUrl: string;
      if (file.name.toLowerCase().endsWith('.srt')) {
        const srtText = await file.text();
        const vttText = srtToVtt(srtText);
        const vttBlob = new Blob([vttText], { type: 'text/vtt' });
        trackUrl = URL.createObjectURL(vttBlob);
      } else {
        trackUrl = URL.createObjectURL(file);
      }

      const newTrack: SubtitleTrackUrl = {
        label: file.name.replace(/\.[^/.]+$/, ''),
        srclang: 'custom',
        url: trackUrl,
        isCustom: true
      };

      const newIdx = allSubtitles.length;
      setCustomSubtitles(prev => [...prev, newTrack]);
      setSelectedSubtitleIndex(newIdx);
      setIsSubtitlesOn(true);
      setTimeout(() => applySubtitleMode(true, newIdx), 100);

      setResumeNotice(`Loaded Subtitle: ${newTrack.label}`);
      setTimeout(() => setResumeNotice(''), 3000);
    } catch (err) {
      console.error('Failed to load subtitle file:', err);
      setResumeNotice('Error loading subtitle file');
      setTimeout(() => setResumeNotice(''), 3000);
    }

    if (subtitleFileInputRef.current) {
      subtitleFileInputRef.current.value = '';
    }
    setShowSubtitleMenu(false);
  };

  // Sync subtitles track visibility
  useEffect(() => {
    applySubtitleMode(isSubtitlesOn, selectedSubtitleIndex);
  }, [allSubtitles, isSubtitlesOn, selectedSubtitleIndex, applySubtitleMode]);

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    const videoDuration = videoRef.current.duration;
    setDuration(videoDuration);

    // Apply subtitle track mode
    applySubtitleMode(isSubtitlesOn, selectedSubtitleIndex);

    // Inspect native audioTracks if available
    const videoEl = videoRef.current as any;
    if (videoEl && videoEl.audioTracks && videoEl.audioTracks.length > 0) {
      const nativeList: AudioTrackOption[] = [];
      for (let i = 0; i < videoEl.audioTracks.length; i++) {
        const at = videoEl.audioTracks[i];
        nativeList.push({
          id: `internal_${i}`,
          label: at.label || `Track ${i + 1}${at.language ? ` [${at.language}]` : ''}`,
          language: at.language,
          isInternal: true,
          internalIndex: i
        });
      }
      setInternalAudioTracks(nativeList);
    }

    // Read resume time
    const savedTime = parseFloat(localStorage.getItem(resumeKey) || '0');
    if (savedTime > 2 && savedTime < videoDuration - 5) {
      videoRef.current.currentTime = savedTime;
      setCurrentTimeState(savedTime);
      if (audioRef.current && activeAudioTrack.url) {
        audioRef.current.currentTime = Math.max(0, savedTime + audioSyncOffset);
      }
      setResumeNotice(`Resumed from last position (${formatTime(savedTime)})`);
      setTimeout(() => setResumeNotice(''), 4000);
    }
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const time = videoRef.current.currentTime;
    setCurrentTimeState(time);
    onTimeUpdate(time);

    // Synchronize external audio drift
    if (audioRef.current && activeAudioTrack.url && isPlaying) {
      const targetTime = Math.max(0, time + audioSyncOffset);
      const drift = Math.abs(audioRef.current.currentTime - targetTime);
      if (drift > 0.25) {
        audioRef.current.currentTime = targetTime;
      }
    }
    
    // Save progress to local storage (approx every 3 seconds or on milestones)
    if (Math.floor(time) % 3 === 0) {
      localStorage.setItem(resumeKey, time.toString());
    }
  };

  const handleReplay = () => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = 0;
    setCurrentTimeState(0);
    setIsCompleted(false);
    setIsCountdownActive(false);
    if (audioRef.current && activeAudioTrack.url) {
      audioRef.current.currentTime = Math.max(0, 0 + audioSyncOffset);
    }
    videoRef.current.play().then(() => {
      setIsPlaying(true);
      if (audioRef.current && activeAudioTrack.url) {
        audioRef.current.play().catch(err => console.log('Audio replay error:', err));
      }
    }).catch(err => console.log('Replay error:', err));
  };

  const handleVideoEnded = () => {
    setIsPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
    }
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
    let interval: any;
    if (isCountdownActive && countdown > 0) {
      interval = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } else if (isCountdownActive && countdown === 0) {
      setIsCountdownActive(false);
      onVideoEnded();
    }
    return () => clearInterval(interval);
  }, [isCountdownActive, countdown, onVideoEnded]);

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
        {(allSubtitles || []).map((track, idx) => (
          <track
            key={`${track.url}_${idx}`}
            kind="subtitles"
            src={track.url}
            srcLang={track.srclang || 'en'}
            label={track.label}
            default={isSubtitlesOn && idx === selectedSubtitleIndex}
            onLoad={() => applySubtitleMode(isSubtitlesOn, selectedSubtitleIndex)}
          />
        ))}
      </video>

      {/* Hidden audio element for external audio track */}
      <audio
        ref={audioRef}
        src={activeAudioTrack.url}
        preload="auto"
        style={{ display: 'none' }}
      />

      {/* Hidden file input for custom audio track loading */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac"
        style={{ display: 'none' }}
        onChange={handleCustomAudioUpload}
      />

      {/* Hidden file input for custom subtitle track loading */}
      <input
        ref={subtitleFileInputRef}
        type="file"
        accept=".vtt,.srt"
        style={{ display: 'none' }}
        onChange={handleCustomSubtitleLoad}
      />

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
          {/* YouTube-Style Progress Bar with Floating Frame Preview */}
          {(() => {
            const barWidth = progressBarRef.current ? progressBarRef.current.clientWidth : 600;
            const PREVIEW_WIDTH = 210;
            const HALF_PREVIEW = PREVIEW_WIDTH / 2;
            const clampedPreviewX = Math.max(HALF_PREVIEW + 8, Math.min(barWidth - HALF_PREVIEW - 8, hoverX));
            const playedPercent = duration > 0 ? Math.min(100, Math.max(0, (currentTimeState / duration) * 100)) : 0;
            const hoverPercent = duration > 0 ? Math.min(100, Math.max(0, (hoverTime / duration) * 100)) : 0;

            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', width: '100%', position: 'relative' }}>
                <span style={{ 
                  fontSize: '0.8rem', 
                  color: '#ffffff', 
                  fontVariationSettings: '"tnum" 1', 
                  minWidth: '45px', 
                  textAlign: 'right', 
                  userSelect: 'none',
                  fontWeight: 500
                }}>
                  {formatTime(currentTimeState)}
                </span>

                {/* Custom Interactive Timeline Track */}
                <div
                  ref={progressBarRef}
                  tabIndex={0}
                  role="slider"
                  aria-label="Video timeline"
                  aria-valuemin={0}
                  aria-valuemax={duration || 100}
                  aria-valuenow={currentTimeState}
                  onMouseEnter={handleTimelineMouseEnter}
                  onMouseLeave={handleTimelineMouseLeave}
                  onMouseMove={handleTimelineMouseMove}
                  onMouseDown={handleTimelineMouseDown}
                  onTouchStart={handleTimelineTouchStart}
                  onTouchMove={handleTimelineTouchMove}
                  onTouchEnd={handleTimelineTouchEnd}
                  onKeyDown={handleTimelineKeyDown}
                  style={{
                    flex: 1,
                    height: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    cursor: 'pointer',
                    position: 'relative',
                    touchAction: 'none',
                    outline: 'none'
                  }}
                >
                  {/* Floating YouTube-Style Preview Tooltip */}
                  <div style={{
                    position: 'absolute',
                    bottom: 'calc(100% + 14px)',
                    left: `${clampedPreviewX}px`,
                    transform: 'translateX(-50%)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    pointerEvents: 'none',
                    opacity: (isHoveringTimeline || isScrubbing) ? 1 : 0,
                    visibility: (isHoveringTimeline || isScrubbing) ? 'visible' : 'hidden',
                    transition: 'opacity 0.15s cubic-bezier(0.4, 0, 0.2, 1), transform 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
                    zIndex: 35
                  }}>
                    {/* Pull up for precise seeking prompt */}
                    <div style={{
                      fontSize: '0.73rem',
                      fontWeight: 500,
                      color: isPreciseSeeking ? '#38bdf8' : 'rgba(255, 255, 255, 0.85)',
                      textShadow: '0 1px 3px rgba(0, 0, 0, 0.9)',
                      marginBottom: '6px',
                      letterSpacing: '0.01em',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      transition: 'color 0.15s ease'
                    }}>
                      {isPreciseSeeking ? (
                        <>
                          <span style={{ fontSize: '0.8rem' }}>⚡</span>
                          <span>Precise seeking mode</span>
                        </>
                      ) : (
                        <span>Pull up for precise seeking</span>
                      )}
                    </div>

                    {/* Video Thumbnail Preview Card */}
                    <div style={{
                      width: '210px',
                      height: '118px',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      background: '#000000',
                      border: isPreciseSeeking ? '1.5px solid #38bdf8' : '1.5px solid rgba(255, 255, 255, 0.3)',
                      boxShadow: '0 10px 30px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(0, 0, 0, 0.5)',
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'border-color 0.2s ease'
                    }}>
                      <video
                        ref={previewVideoRef}
                        src={videoSrc || undefined}
                        muted
                        playsInline
                        preload="auto"
                        onLoadedMetadata={handlePreviewLoadedMetadata}
                        onSeeked={handlePreviewSeeked}
                        onError={handlePreviewError}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'contain',
                          display: 'block',
                          backgroundColor: '#000000',
                          pointerEvents: 'none'
                        }}
                      />
                      {isPreviewLoading && (
                        <div style={{
                          position: 'absolute',
                          inset: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'rgba(0, 0, 0, 0.25)',
                          backdropFilter: 'blur(1px)'
                        }}>
                          <div style={{
                            width: '20px',
                            height: '20px',
                            border: '2px solid rgba(255, 255, 255, 0.25)',
                            borderTopColor: '#ef4444',
                            borderRadius: '50%',
                            animation: 'spin 0.6s linear infinite'
                          }} />
                        </div>
                      )}
                    </div>

                    {/* Timestamp Pill (e.g. 12:38) */}
                    <div style={{
                      marginTop: '6px',
                      background: 'rgba(32, 32, 36, 0.94)',
                      backdropFilter: 'blur(8px)',
                      border: '1px solid rgba(255, 255, 255, 0.18)',
                      borderRadius: '9999px',
                      padding: '3px 12px',
                      color: '#ffffff',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.6)',
                      fontVariationSettings: '"tnum" 1',
                      letterSpacing: '0.02em',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      <span>{formatTime(hoverTime)}</span>
                      {matchedBookmark && (
                        <span style={{
                          color: '#fbbf24',
                          fontSize: '0.72rem',
                          fontWeight: 500,
                          maxWidth: '130px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          • {matchedBookmark.note}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Background Track Bar */}
                  <div style={{
                    position: 'relative',
                    width: '100%',
                    height: (isHoveringTimeline || isScrubbing) ? '6px' : '4px',
                    borderRadius: '3px',
                    background: 'rgba(255, 255, 255, 0.2)',
                    transition: 'height 0.15s ease'
                  }}>
                    {/* Ghost Hover Track Bar */}
                    <div style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: `${hoverPercent}%`,
                      background: 'rgba(255, 255, 255, 0.35)',
                      borderRadius: '3px',
                      opacity: (isHoveringTimeline || isScrubbing) ? 1 : 0,
                      transition: 'opacity 0.1s ease',
                      pointerEvents: 'none'
                    }} />

                    {/* Played Progress Bar (YouTube Red) */}
                    <div style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: `${playedPercent}%`,
                      background: '#ef4444',
                      borderRadius: '3px',
                      zIndex: 2,
                      pointerEvents: 'none'
                    }} />

                    {/* Bookmark Chapter Markers */}
                    {activeBookmarks.map((bm, idx) => {
                      const percent = duration > 0 ? (bm.timestamp / duration) * 100 : 0;
                      if (percent < 0 || percent > 100) return null;
                      return (
                        <div
                          key={bm.id || idx}
                          title={`${bm.note} (${formatTime(bm.timestamp)})`}
                          style={{
                            position: 'absolute',
                            left: `${percent}%`,
                            top: 0,
                            bottom: 0,
                            width: '2px',
                            background: '#fbbf24',
                            zIndex: 3,
                            transform: 'translateX(-50%)',
                            pointerEvents: 'none',
                            borderRadius: '1px'
                          }}
                        />
                      );
                    })}

                    {/* Scrubber Circular Thumb */}
                    <div style={{
                      position: 'absolute',
                      left: `${playedPercent}%`,
                      top: '50%',
                      transform: (isHoveringTimeline || isScrubbing) ? 'translate(-50%, -50%) scale(1)' : 'translate(-50%, -50%) scale(0)',
                      width: '13px',
                      height: '13px',
                      borderRadius: '50%',
                      background: '#ef4444',
                      boxShadow: '0 0 6px rgba(239, 68, 68, 0.8), 0 0 0 2px #ffffff',
                      zIndex: 5,
                      transition: 'transform 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
                      pointerEvents: 'none'
                    }} />
                  </div>
                </div>

                <span style={{ 
                  fontSize: '0.8rem', 
                  color: 'rgba(255, 255, 255, 0.7)', 
                  fontVariationSettings: '"tnum" 1', 
                  minWidth: '45px', 
                  userSelect: 'none',
                  fontWeight: 500
                }}>
                  {formatTime(duration)}
                </span>
              </div>
            );
          })()}

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

              {/* CC Captions Button with Options Menu */}
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <button
                  className="player-menu-trigger"
                  onClick={toggleSubtitles}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowAudioMenu(false);
                    setShowSpeedMenu(false);
                    setShowSubtitleMenu(prev => !prev);
                  }}
                  title={
                    isSubtitlesOn
                      ? `Turn off captions (C) — Active: ${allSubtitles[selectedSubtitleIndex]?.label || 'On'}`
                      : allSubtitles.length > 0
                        ? `Turn on captions (C) — ${allSubtitles.length} track(s) available`
                        : 'Closed Captions (C) — Click to load .vtt or .srt subtitle file'
                  }
                  style={{
                    background: 'none',
                    border: 'none',
                    color: isSubtitlesOn ? 'var(--color-primary)' : 'rgba(255,255,255,0.85)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 6px',
                    borderRadius: '4px',
                    transition: 'all 0.2s',
                    backgroundColor: showSubtitleMenu ? 'rgba(255,255,255,0.12)' : 'transparent'
                  }}
                  onMouseEnter={(e) => {
                    if (!showSubtitleMenu) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)';
                  }}
                  onMouseLeave={(e) => {
                    if (!showSubtitleMenu) e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <div style={{
                    border: isSubtitlesOn ? '1.5px solid var(--color-primary)' : '1.5px solid rgba(255,255,255,0.7)',
                    backgroundColor: isSubtitlesOn ? 'var(--color-primary)' : 'transparent',
                    color: isSubtitlesOn ? '#ffffff' : 'rgba(255,255,255,0.85)',
                    borderRadius: '3px',
                    padding: '1px 4px',
                    fontSize: '0.65rem',
                    fontWeight: 'bold',
                    lineHeight: '1.2',
                    letterSpacing: '0.5px',
                    boxShadow: isSubtitlesOn ? '0 0 8px rgba(99, 102, 241, 0.4)' : 'none',
                    transition: 'all 0.2s'
                  }}>
                    CC
                  </div>
                </button>

                {/* Subtitle menu chevron dropdown trigger */}
                <button
                  className="player-menu-trigger"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowAudioMenu(false);
                    setShowSpeedMenu(false);
                    setShowSubtitleMenu(prev => !prev);
                  }}
                  title="Subtitle & Caption Options"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: showSubtitleMenu ? 'var(--color-primary)' : 'rgba(255,255,255,0.6)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '4px 2px',
                    marginLeft: '-3px',
                    borderRadius: '3px',
                    transition: 'color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = 'white'}
                  onMouseLeave={(e) => e.currentTarget.style.color = showSubtitleMenu ? 'var(--color-primary)' : 'rgba(255,255,255,0.6)'}
                >
                  <ChevronDown size={12} />
                </button>

                {/* Subtitle Popover Menu */}
                {showSubtitleMenu && (
                  <div
                    className="player-menu-popover"
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      position: 'absolute',
                      bottom: '36px',
                      left: 0,
                      backgroundColor: 'rgba(20, 20, 25, 0.96)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: '8px',
                      padding: '8px 0',
                      minWidth: '220px',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                      backdropFilter: 'blur(16px)',
                      zIndex: 100,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px'
                    }}
                  >
                    {/* Menu Header */}
                    <div style={{
                      padding: '4px 14px 8px',
                      borderBottom: '1px solid rgba(255,255,255,0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
                        Subtitles / Captions
                      </span>
                      <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.45)' }}>
                        {allSubtitles.length} available
                      </span>
                    </div>

                    {/* Track Options */}
                    <div style={{ maxHeight: '180px', overflowY: 'auto', padding: '4px 0' }}>
                      {/* Off Option */}
                      <button
                        onClick={() => handleSelectSubtitleTrack(-1)}
                        style={{
                          width: '100%',
                          padding: '7px 14px',
                          background: !isSubtitlesOn ? 'rgba(99, 102, 241, 0.15)' : 'none',
                          border: 'none',
                          color: !isSubtitlesOn ? 'var(--color-primary)' : 'rgba(255,255,255,0.8)',
                          fontSize: '0.78rem',
                          textAlign: 'left',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          transition: 'background 0.15s'
                        }}
                        onMouseEnter={(e) => {
                          if (isSubtitlesOn) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)';
                        }}
                        onMouseLeave={(e) => {
                          if (isSubtitlesOn) e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        <span style={{ fontWeight: !isSubtitlesOn ? 600 : 400 }}>Off</span>
                        {!isSubtitlesOn && <Check size={14} color="var(--color-primary)" />}
                      </button>

                      {/* Subtitle Tracks */}
                      {allSubtitles.map((track, idx) => {
                        const isSelected = isSubtitlesOn && selectedSubtitleIndex === idx;
                        return (
                          <button
                            key={idx}
                            onClick={() => handleSelectSubtitleTrack(idx)}
                            style={{
                              width: '100%',
                              padding: '7px 14px',
                              background: isSelected ? 'rgba(99, 102, 241, 0.15)' : 'none',
                              border: 'none',
                              color: isSelected ? 'var(--color-primary)' : 'rgba(255,255,255,0.85)',
                              fontSize: '0.78rem',
                              textAlign: 'left',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              transition: 'background 0.15s'
                            }}
                            onMouseEnter={(e) => {
                              if (!isSelected) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)';
                            }}
                            onMouseLeave={(e) => {
                              if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                          >
                            <span style={{
                              fontWeight: isSelected ? 600 : 400,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              maxWidth: '150px'
                            }}>
                              {track.label}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {track.srclang && track.srclang !== 'custom' && (
                                <span style={{
                                  fontSize: '0.62rem',
                                  padding: '1px 4px',
                                  borderRadius: '3px',
                                  backgroundColor: 'rgba(255,255,255,0.08)',
                                  color: 'rgba(255,255,255,0.6)'
                                }}>
                                  {track.srclang.toUpperCase()}
                                </span>
                              )}
                              {isSelected && <Check size={14} color="var(--color-primary)" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Load Custom Subtitle File */}
                    <div style={{
                      borderTop: '1px solid rgba(255,255,255,0.08)',
                      padding: '4px 6px 2px'
                    }}>
                      <button
                        onClick={() => subtitleFileInputRef.current?.click()}
                        style={{
                          width: '100%',
                          padding: '6px 10px',
                          background: 'none',
                          border: 'none',
                          color: 'rgba(255,255,255,0.7)',
                          fontSize: '0.74rem',
                          textAlign: 'left',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          borderRadius: '4px',
                          transition: 'all 0.15s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)';
                          e.currentTarget.style.color = 'white';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                          e.currentTarget.style.color = 'rgba(255,255,255,0.7)';
                        }}
                      >
                        <Upload size={12} />
                        <span>Load Subtitle File (.vtt, .srt)...</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

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

              {/* Mark as Completed Button inside VideoPlayer */}
              {onToggleCompleted && (
                <button
                  onClick={onToggleCompleted}
                  title={isLessonCompleted ? "Mark lesson as incomplete" : "Mark lesson as completed"}
                  style={{
                    background: isLessonCompleted ? 'rgba(16, 185, 129, 0.2)' : 'none',
                    border: isLessonCompleted ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid transparent',
                    color: isLessonCompleted ? '#34d399' : 'rgba(255,255,255,0.85)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontSize: '0.8rem',
                    fontWeight: isLessonCompleted ? 600 : 500,
                    padding: '4px 8px',
                    borderRadius: '4px',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = isLessonCompleted ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255,255,255,0.1)';
                    e.currentTarget.style.color = isLessonCompleted ? '#6ee7b7' : 'white';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = isLessonCompleted ? 'rgba(16, 185, 129, 0.2)' : 'transparent';
                    e.currentTarget.style.color = isLessonCompleted ? '#34d399' : 'rgba(255,255,255,0.85)';
                  }}
                >
                  <CheckCircle2 size={14} />
                  <span>{isLessonCompleted ? 'Completed' : 'Mark as Completed'}</span>
                </button>
              )}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', position: 'relative' }}>
              {/* Audio Track Selector */}
              <div style={{ position: 'relative' }}>
                <button
                  className="player-menu-trigger"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSpeedMenu(false);
                    setShowAudioMenu(!showAudioMenu);
                  }}
                  title="Audio Track (A)"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: selectedAudioTrackId !== 'default' ? 'var(--color-primary)' : 'rgba(255,255,255,0.85)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    padding: '4px 8px',
                    borderRadius: '4px',
                    transition: 'all var(--transition-fast)'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <Headphones size={16} />
                  <span style={{ fontSize: '0.78rem' }}>
                    {selectedAudioTrackId === 'default'
                      ? 'Audio'
                      : (activeAudioTrack.language?.toUpperCase() || 'ALT')}
                  </span>
                </button>

                {/* Audio Track Popover Menu */}
                {showAudioMenu && (
                  <div
                    className="player-menu-popover"
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      position: 'absolute',
                      bottom: '36px',
                      right: 0,
                      backgroundColor: 'rgba(20, 20, 25, 0.96)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: '10px',
                      padding: '8px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      width: '320px',
                      zIndex: 30,
                      boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                      backdropFilter: 'blur(12px)',
                      animation: 'fadeIn 0.15s ease-out'
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '4px 8px 6px 8px',
                      borderBottom: '1px solid rgba(255,255,255,0.08)',
                      marginBottom: '2px'
                    }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'white', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Headphones size={13} color="var(--color-primary)" />
                        Audio Track
                      </span>
                      <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.08)', padding: '2px 6px', borderRadius: '8px' }}>
                        {isScanningTracks ? 'Scanning...' : `${allAudioTracks.length} available`}
                      </span>
                    </div>

                    {/* Demuxing status indicator */}
                    {isExtractingAudio && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 8px',
                        backgroundColor: 'rgba(99, 102, 241, 0.15)',
                        border: '1px solid rgba(99, 102, 241, 0.3)',
                        borderRadius: '6px',
                        fontSize: '0.7rem',
                        color: 'var(--color-primary)'
                      }}>
                        <div style={{
                          width: '10px',
                          height: '10px',
                          border: '2px solid var(--color-primary)',
                          borderTopColor: 'transparent',
                          borderRadius: '50%',
                          animation: 'spin 0.8s linear infinite'
                        }} />
                        <span>Demuxing container audio track...</span>
                      </div>
                    )}

                    <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      {allAudioTracks.map(track => {
                        const isSelected = selectedAudioTrackId === track.id;
                        return (
                          <button
                            key={track.id}
                            onClick={() => handleSelectAudioTrack(track.id)}
                            style={{
                              background: isSelected ? 'rgba(99, 102, 241, 0.15)' : 'none',
                              border: isSelected ? '1px solid rgba(99, 102, 241, 0.35)' : '1px solid transparent',
                              color: isSelected ? 'var(--color-primary)' : 'white',
                              cursor: 'pointer',
                              padding: '6px 8px',
                              fontSize: '0.76rem',
                              textAlign: 'left',
                              borderRadius: '6px',
                              fontWeight: isSelected ? 600 : 400,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '8px',
                              transition: 'background 0.15s ease'
                            }}
                            onMouseEnter={(e) => {
                              if (!isSelected) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)';
                            }}
                            onMouseLeave={(e) => {
                              if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {isSelected ? (
                                <Check size={13} style={{ flexShrink: 0 }} />
                              ) : (
                                <span style={{ width: 13, height: 13, display: 'inline-block', flexShrink: 0 }} />
                              )}
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {track.label}
                              </span>
                            </div>
                            {track.id === 'default' ? (
                              <span style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', flexShrink: 0 }}>
                                Main
                              </span>
                            ) : track.language ? (
                              <span style={{ fontSize: '0.62rem', background: 'rgba(255,255,255,0.1)', padding: '1px 4px', borderRadius: '3px', textTransform: 'uppercase', flexShrink: 0 }}>
                                {track.language}
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>

                    {/* Audio Sync Adjustment */}
                    {selectedAudioTrackId !== 'default' && (
                      <div style={{
                        marginTop: '4px',
                        padding: '6px 8px',
                        background: 'rgba(0,0,0,0.3)',
                        borderRadius: '6px',
                        border: '1px solid rgba(255,255,255,0.06)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                      }}>
                        <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.6)' }}>
                          Sync: <strong style={{ color: 'white' }}>{audioSyncOffset > 0 ? `+${audioSyncOffset}s` : `${audioSyncOffset}s`}</strong>
                        </span>
                        <div style={{ display: 'flex', gap: '3px' }}>
                          <button
                            onClick={(e) => { e.stopPropagation(); adjustAudioSync(-0.1); }}
                            title="Delay audio by -0.1s"
                            style={{
                              background: 'rgba(255,255,255,0.08)',
                              border: 'none',
                              color: 'white',
                              cursor: 'pointer',
                              padding: '2px 5px',
                              borderRadius: '3px',
                              fontSize: '0.68rem'
                            }}
                          >
                            -0.1s
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setAudioSyncOffset(0); }}
                            title="Reset sync offset"
                            style={{
                              background: 'rgba(255,255,255,0.08)',
                              border: 'none',
                              color: 'rgba(255,255,255,0.7)',
                              cursor: 'pointer',
                              padding: '2px 5px',
                              borderRadius: '3px',
                              fontSize: '0.68rem'
                            }}
                          >
                            0s
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); adjustAudioSync(0.1); }}
                            title="Advance audio by +0.1s"
                            style={{
                              background: 'rgba(255,255,255,0.08)',
                              border: 'none',
                              color: 'white',
                              cursor: 'pointer',
                              padding: '2px 5px',
                              borderRadius: '3px',
                              fontSize: '0.68rem'
                            }}
                          >
                            +0.1s
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Load custom audio file button */}
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: '4px', paddingTop: '4px' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          fileInputRef.current?.click();
                        }}
                        style={{
                          width: '100%',
                          background: 'none',
                          border: '1px dashed rgba(255,255,255,0.2)',
                          color: 'rgba(255,255,255,0.8)',
                          cursor: 'pointer',
                          padding: '5px 8px',
                          fontSize: '0.72rem',
                          borderRadius: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = 'var(--color-primary)';
                          e.currentTarget.style.color = 'white';
                          e.currentTarget.style.backgroundColor = 'rgba(99, 102, 241, 0.08)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
                          e.currentTarget.style.color = 'rgba(255,255,255,0.8)';
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        <Upload size={12} />
                        Load Custom Audio Track...
                      </button>
                    </div>

                    {/* Chrome/Edge Flag Tip */}
                    {embeddedList.length > 1 && (
                      <div style={{
                        marginTop: '4px',
                        padding: '5px 7px',
                        backgroundColor: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '6px',
                        fontSize: '0.64rem',
                        color: 'rgba(255, 255, 255, 0.65)',
                        lineHeight: '1.3'
                      }}>
                        <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>💡 Tip for Chrome/Edge:</span>
                        <div>
                          Native hardware track switching can be enabled in <code style={{ color: 'white', fontSize: '0.62rem' }}>chrome://flags/#enable-experimental-web-platform-features</code>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Playback speed trigger */}
              <div style={{ position: 'relative' }}>
                <button
                  className="player-menu-trigger"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowAudioMenu(false);
                    setShowSpeedMenu(!showSpeedMenu);
                  }}
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
                  <div
                    className="player-menu-popover"
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      position: 'absolute',
                      bottom: '36px',
                      right: 0,
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
                    }}
                  >
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
              </div>

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
