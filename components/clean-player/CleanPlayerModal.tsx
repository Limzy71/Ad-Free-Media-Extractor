import React, { useRef, useState, useEffect } from 'react';
import Hls from 'hls.js';
import { X, Film, AlertTriangle, RefreshCw } from 'lucide-react';
import { PlayerControls } from './PlayerControls';
import type { MediaMetadata } from '~/types/media';

interface CleanPlayerModalProps {
  media: MediaMetadata | null;
  onClose: () => void;
  onDownload: (media: MediaMetadata) => void;
}

export const CleanPlayerModal: React.FC<CleanPlayerModalProps> = ({
  media,
  onClose,
  onDownload
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isPipAvailable, setIsPipAvailable] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolume] = useState<number>(1);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [hlsLevels, setHlsLevels] = useState<{ height: number; bitrate: number }[]>([]);
  const [currentHlsLevel, setCurrentHlsLevel] = useState<number>(-1);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isVertical, setIsVertical] = useState<boolean>(false);

  // Check Picture-in-Picture Support
  useEffect(() => {
    setIsPipAvailable(document.pictureInPictureEnabled || false);
  }, []);

  // Initialize Video & HLS.js
  useEffect(() => {
    if (!media || !videoRef.current) return;

    const video = videoRef.current;
    setErrorMsg(null);
    setHlsLevels([]);
    setCurrentHlsLevel(-1);

    const isHls =
      media.formatCategory === 'HLS' ||
      media.sourceUrl.includes('.m3u8') ||
      media.mimeType === 'application/x-mpegURL' ||
      media.mimeType === 'application/vnd.apple.mpegurl';

    if (isHls) {
      if (Hls.isSupported()) {
        const hlsInstance = new Hls({
          enableWorker: true,
          lowLatencyMode: true
        });
        hlsRef.current = hlsInstance;

        hlsInstance.loadSource(media.sourceUrl);
        hlsInstance.attachMedia(video);

        hlsInstance.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
          if (data.levels && data.levels.length > 0) {
            const mappedLevels = data.levels.map((lvl) => ({
              height: lvl.height,
              bitrate: lvl.bitrate
            }));
            setHlsLevels(mappedLevels);
          }
          video.play().catch(() => setIsPlaying(false));
        });

        hlsInstance.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
          setCurrentHlsLevel(data.level);
        });

        hlsInstance.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                hlsInstance.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                hlsInstance.recoverMediaError();
                break;
              default:
                hlsInstance.destroy();
                setErrorMsg('Gagal memuat aliran video HLS. Sumber media mungkin dibatasi atau kadaluarsa.');
                break;
            }
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = media.sourceUrl;
        video.play().catch(() => setIsPlaying(false));
      } else {
        setErrorMsg('Peramban Anda tidak mendukung pemutaran video HLS.');
      }
    } else {
      // Direct MP4 / WebM
      video.src = media.sourceUrl;
      video.play().catch(() => setIsPlaying(false));
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [media]);

  // Detect Aspect Ratio after Video Metadata Loaded
  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    const { videoWidth, videoHeight, duration: vidDuration } = videoRef.current;
    setDuration(vidDuration || 0);

    // If height > width, it is a vertical video (9:16 Shorts/Reels)
    if (videoHeight > videoWidth) {
      setIsVertical(true);
    } else {
      setIsVertical(false);
    }
  };

  // Keyboard Shortcuts (Hotkeys)
  useEffect(() => {
    if (!media) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'escape':
          e.preventDefault();
          onClose();
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          break;
        case 'p':
          e.preventDefault();
          togglePip();
          break;
        case 'j':
          e.preventDefault();
          seek(Math.max(0, currentTime - 10));
          break;
        case 'l':
          e.preventDefault();
          seek(Math.min(duration, currentTime + 10));
          break;
        case 'arrowleft':
          e.preventDefault();
          seek(Math.max(0, currentTime - 5));
          break;
        case 'arrowright':
          e.preventDefault();
          seek(Math.min(duration, currentTime + 5));
          break;
        case 'arrowup':
          e.preventDefault();
          handleVolumeChange(Math.min(1, volume + 0.05));
          break;
        case 'arrowdown':
          e.preventDefault();
          handleVolumeChange(Math.max(0, volume - 0.05));
          break;
        default:
          if (e.key >= '0' && e.key <= '9') {
            const percent = parseInt(e.key, 10) / 10;
            seek(duration * percent);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [media, isPlaying, isMuted, volume, currentTime, duration]);

  if (!media) return null;

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(videoRef.current.muted);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true));
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false));
    }
  };

  const togglePip = () => {
    if (!videoRef.current) return;
    if (document.pictureInPictureElement) {
      document.exitPictureInPicture();
    } else {
      videoRef.current.requestPictureInPicture().catch(() => {});
    }
  };

  const seek = (time: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = time;
    setCurrentTime(time);
  };

  const handleVolumeChange = (vol: number) => {
    if (!videoRef.current) return;
    videoRef.current.volume = vol;
    videoRef.current.muted = vol === 0;
    setVolume(vol);
    setIsMuted(vol === 0);
  };

  const handlePlaybackRateChange = (rate: number) => {
    if (!videoRef.current) return;
    videoRef.current.playbackRate = rate;
    setPlaybackRate(rate);
  };

  const handleLevelChange = (levelIdx: number) => {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = levelIdx;
      setCurrentHlsLevel(levelIdx);
    }
  };

  const handleRetry = () => {
    setErrorMsg(null);
    if (videoRef.current) {
      videoRef.current.load();
    }
  };

  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 sm:p-6 animate-in fade-in duration-200">
      {/* Video Container (Dynamic Landscape 16:9 vs Vertical 9:16) */}
      <div
        ref={containerRef}
        className={`w-full max-h-[85vh] bg-black rounded-2xl overflow-hidden shadow-2xl relative border border-white/10 flex items-center justify-center group ${
          isVertical ? 'max-w-sm aspect-[9/16]' : 'max-w-5xl aspect-video'
        }`}
      >
        {/* Top Floating Header */}
        <div className="absolute top-0 inset-x-0 p-4 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="flex items-center gap-2 text-white text-xs font-semibold drop-shadow">
            <Film className="w-4 h-4 text-blue-400" />
            <span className="truncate max-w-md">{media.pageTitle || 'Pemutar Video Bersih'}</span>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-white/20 hover:bg-white/40 text-white transition-colors"
            title="Tutup Pemutar (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Video Element (Double-click to toggle fullscreen) */}
        <video
          ref={videoRef}
          onClick={togglePlay}
          onDoubleClick={toggleFullscreen}
          onTimeUpdate={() => videoRef.current && setCurrentTime(videoRef.current.currentTime)}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={() => setIsPlaying(false)}
          className="w-full h-full object-contain cursor-pointer"
          playsInline
        />

        {/* Error Notification Banner with Retry */}
        {errorMsg && (
          <div className="absolute inset-0 flex items-center justify-center p-6 bg-black/90 z-30">
            <div className="p-5 rounded-2xl bg-red-950/80 border border-red-500/50 text-white flex flex-col items-center text-center gap-3 max-w-md">
              <AlertTriangle className="w-8 h-8 text-red-400 animate-bounce" />
              <p className="text-xs font-medium leading-relaxed">{errorMsg}</p>
              <div className="flex items-center gap-2 mt-1">
                <button
                  onClick={handleRetry}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Coba Lagi</span>
                </button>
                <button
                  onClick={onClose}
                  className="px-3.5 py-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-bold rounded-lg"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Bottom Custom Controls Bar */}
        <PlayerControls
          isPlaying={isPlaying}
          isMuted={isMuted}
          isFullscreen={isFullscreen}
          isPipAvailable={isPipAvailable}
          currentTime={currentTime}
          duration={duration}
          volume={volume}
          playbackRate={playbackRate}
          levels={hlsLevels}
          currentLevel={currentHlsLevel}
          onTogglePlay={togglePlay}
          onToggleMute={toggleMute}
          onToggleFullscreen={toggleFullscreen}
          onTogglePip={togglePip}
          onSeek={seek}
          onVolumeChange={handleVolumeChange}
          onPlaybackRateChange={handlePlaybackRateChange}
          onLevelChange={handleLevelChange}
          onDownload={() => onDownload(media)}
        />
      </div>
    </div>
  );
};
