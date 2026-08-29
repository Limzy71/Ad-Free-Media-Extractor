import React, { useRef, useState, useEffect } from 'react';
import Hls from 'hls.js';
import { X, Film, AlertTriangle, RefreshCw, Loader2, FileQuestion, Ban, WifiOff, ExternalLink, ServerCrash } from 'lucide-react';
import { PlayerControls } from './PlayerControls';
import { DohResolverService } from '~/services/doh-resolver';
import type { MediaMetadata } from '~/types/media';

interface CleanPlayerModalProps {
  media: MediaMetadata | null;
  onClose: () => void;
  onDownload: (media: MediaMetadata) => void;
}

interface ErrorDetails {
  title: string;
  message: string;
  statusCode?: number | string;
  type: 'EXPIRED' | 'FORBIDDEN' | 'NETWORK' | 'FORMAT' | 'UNKNOWN';
}

function extractYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
  return match ? match[1] : null;
}

export const CleanPlayerModal: React.FC<CleanPlayerModalProps> = ({
  media,
  onClose,
  onDownload
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const blobUrlRef = useRef<string | null>(null);

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
  const [errorDetails, setErrorDetails] = useState<ErrorDetails | null>(null);
  const [isLoadingMedia, setIsLoadingMedia] = useState<boolean>(true);
  const [isVertical, setIsVertical] = useState<boolean>(false);
  const [bypassStage, setBypassStage] = useState<'DIRECT' | 'CORS_BLOB' | 'BACKEND_PROXY' | 'DONE'>('DIRECT');

  const youtubeVideoId = media ? (extractYouTubeId(media.sourceUrl) || extractYouTubeId(media.pageUrl)) : null;

  useEffect(() => {
    setIsPipAvailable(document.pictureInPictureEnabled || false);
  }, []);

  // Initialize Video & HLS.js (Skip if YouTube embed)
  useEffect(() => {
    if (!media || youtubeVideoId) {
      setIsLoadingMedia(false);
      return;
    }
    if (!videoRef.current) return;

    const video = videoRef.current;
    setErrorDetails(null);
    setIsLoadingMedia(true);
    setBypassStage('DIRECT');
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
          lowLatencyMode: false,
          abrEwmaDefaultEstimate: 10_000_000,
          capLevelToPlayerSize: false
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
            hlsInstance.currentLevel = data.levels.length - 1;
            setCurrentHlsLevel(data.levels.length - 1);
          }
          setIsLoadingMedia(false);
          setBypassStage('DONE');
          video.play().catch(() => setIsPlaying(false));
        });

        hlsInstance.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
          setCurrentHlsLevel(data.level);
        });

        hlsInstance.on(Hls.Events.ERROR, (_event, data) => {
          const httpStatus = data.response?.code;
          if (data.fatal) {
            hlsInstance.destroy();
            setIsLoadingMedia(false);
            if (httpStatus === 404 || httpStatus === 410) {
              setErrorDetails({ type: 'EXPIRED', statusCode: httpStatus, title: 'Tautan Stream Kadaluwarsa (404 Not Found)', message: 'Berkas playlist stream .m3u8 sudah tidak ditemukan atau masa aktif tautan telah berakhir di server sumber.' });
            } else if (httpStatus === 403 || httpStatus === 401) {
              setErrorDetails({ type: 'FORBIDDEN', statusCode: httpStatus, title: 'Akses Dibatasi oleh Server (403 Forbidden)', message: 'Server penyedia video memblokir izin pemutaran langsung (CORS / token sesi kadaluwarsa).' });
            } else if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
              setErrorDetails({ type: 'NETWORK', statusCode: httpStatus || 'Network', title: 'Koneksi ke Server Stream Terputus', message: 'Gagal mengunduh fragmen video HLS. Periksa koneksi internet Anda atau coba muat ulang.' });
            } else {
              setErrorDetails({ type: 'FORMAT', title: 'Format Media HLS Tidak Kompatibel', message: 'Terjadi kesalahan saat mendekode segmen video dari server sumber.' });
            }
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = media.sourceUrl;
        video.play().catch(() => setIsPlaying(false));
      } else {
        setIsLoadingMedia(false);
        setErrorDetails({ type: 'FORMAT', title: 'Format Tidak Didukung', message: 'Browser ini tidak mendukung pemutaran stream HLS secara native.' });
      }
    } else {
      video.src = media.sourceUrl;
      video.load();
      video.play().catch(() => setIsPlaying(false));
    }

    return () => {
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
      if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null; }
    };
  }, [media, youtubeVideoId]);

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    const { videoWidth, videoHeight, duration: vidDuration } = videoRef.current;
    setDuration(vidDuration || 0);
    setIsLoadingMedia(false);
    setBypassStage('DONE');
    setErrorDetails(null);
    setIsVertical(videoHeight > videoWidth);
  };

  /**
   * Handler error bertingkat: Direct -> CORS Blob -> Backend Proxy (DoH) -> Show Error
   */
  const handleVideoError = async () => {
    if (!media || !videoRef.current) return;

    // ============ STAGE 1: Coba bypass CORS via Blob fetch (ekstensi) ============
    if (bypassStage === 'DIRECT' && !media.sourceUrl.startsWith('blob:')) {
      setBypassStage('CORS_BLOB');
      setIsLoadingMedia(true);

      try {
        const response = await fetch(media.sourceUrl);
        if (response.ok) {
          const blob = await response.blob();
          if (blob && blob.size > 1000) {
            const blobUrl = URL.createObjectURL(blob);
            blobUrlRef.current = blobUrl;
            videoRef.current.src = blobUrl;
            videoRef.current.load();
            videoRef.current.play().catch(() => {});
            return; // Berhasil bypass CORS!
          }
        }
      } catch {
        // Blob fetch gagal (kemungkinan DNS ISP blokir), lanjut ke backend proxy
      }
    }

    // ============ STAGE 2: Coba melalui Backend Proxy dengan DoH DNS ============
    if (bypassStage === 'CORS_BLOB' || (bypassStage === 'DIRECT' && media.sourceUrl.startsWith('blob:'))) {
      setBypassStage('BACKEND_PROXY');
      setIsLoadingMedia(true);

      try {
        const proxyUrl = DohResolverService.getBackendProxyUrl(media.sourceUrl, media.pageUrl);
        const proxyResponse = await fetch(proxyUrl);

        if (proxyResponse.ok) {
          const blob = await proxyResponse.blob();
          if (blob && blob.size > 1000) {
            if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
            const blobUrl = URL.createObjectURL(blob);
            blobUrlRef.current = blobUrl;
            videoRef.current.src = blobUrl;
            videoRef.current.load();
            videoRef.current.play().catch(() => {});
            return; // Berhasil via backend proxy + DoH!
          }
        }
      } catch {
        // Backend proxy juga gagal, tampilkan error final
      }
    }

    // ============ STAGE 3: Semua bypass gagal, diagnosis dan tampilkan error ============
    setIsLoadingMedia(false);
    setBypassStage('DONE');

    try {
      const res = await fetch(media.sourceUrl, { method: 'HEAD' });
      if (res.status === 404 || res.status === 410) {
        setErrorDetails({ type: 'EXPIRED', statusCode: res.status, title: 'Tautan Video Kadaluwarsa (404 Not Found)', message: 'Berkas video sudah dihapus atau tautan telah habis masa berlakunya di server penyedia.' });
        return;
      }
      if (res.status === 403 || res.status === 401) {
        setErrorDetails({ type: 'FORBIDDEN', statusCode: res.status, title: 'Akses Dibatasi oleh Server (403 Forbidden)', message: 'Server sumber menolak akses streaming langsung dari luar domainnya (Hotlink Protection).' });
        return;
      }
    } catch {}

    // Cek apakah domain diblokir ISP via DoH
    try {
      const domain = new URL(media.sourceUrl).hostname;
      const dohResult = await DohResolverService.resolveDomainDoH(domain);
      if (dohResult.isAlive) {
        setErrorDetails({
          type: 'NETWORK',
          title: 'Domain Diblokir oleh ISP (DNS Blocked)',
          message: `Domain "${domain}" diblokir oleh provider internet Anda. Backend proxy (localhost:8000) diperlukan untuk melewati blokir ini. Pastikan backend Laravel sudah aktif dengan menjalankan: php artisan serve`
        });
        return;
      }
    } catch {}

    setErrorDetails({
      type: 'FORBIDDEN',
      title: 'Akses Dibatasi atau Tautan Kadaluwarsa',
      message: 'Server video menerapkan proteksi yang mencegah pemutaran langsung. Pastikan backend proxy (php artisan serve) aktif untuk bypass otomatis.'
    });
  };

  const handleOpenSourcePage = () => {
    if (media?.pageUrl) {
      chrome.tabs.create({ url: media.pageUrl });
    }
  };

  // Keyboard Shortcuts
  useEffect(() => {
    if (!media || youtubeVideoId) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) return;
      switch (e.key.toLowerCase()) {
        case ' ': case 'k': e.preventDefault(); togglePlay(); break;
        case 'escape': e.preventDefault(); onClose(); break;
        case 'f': e.preventDefault(); toggleFullscreen(); break;
        case 'm': e.preventDefault(); toggleMute(); break;
        case 'p': e.preventDefault(); togglePip(); break;
        case 'j': e.preventDefault(); seek(Math.max(0, currentTime - 10)); break;
        case 'l': e.preventDefault(); seek(Math.min(duration, currentTime + 10)); break;
        case 'arrowleft': e.preventDefault(); seek(Math.max(0, currentTime - 5)); break;
        case 'arrowright': e.preventDefault(); seek(Math.min(duration, currentTime + 5)); break;
        case 'arrowup': e.preventDefault(); handleVolumeChange(Math.min(1, volume + 0.05)); break;
        case 'arrowdown': e.preventDefault(); handleVolumeChange(Math.max(0, volume - 0.05)); break;
        default:
          if (e.key >= '0' && e.key <= '9') { seek(duration * (parseInt(e.key, 10) / 10)); }
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [media, isPlaying, isMuted, volume, currentTime, duration, youtubeVideoId]);

  if (!media) return null;

  const togglePlay = () => { if (!videoRef.current) return; if (videoRef.current.paused) { videoRef.current.play(); setIsPlaying(true); } else { videoRef.current.pause(); setIsPlaying(false); } };
  const toggleMute = () => { if (!videoRef.current) return; videoRef.current.muted = !videoRef.current.muted; setIsMuted(videoRef.current.muted); };
  const toggleFullscreen = () => { if (!containerRef.current) return; if (!document.fullscreenElement) { containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)); } else { document.exitFullscreen().then(() => setIsFullscreen(false)); } };
  const togglePip = () => { if (!videoRef.current) return; if (document.pictureInPictureElement) { document.exitPictureInPicture(); } else { videoRef.current.requestPictureInPicture().catch(() => {}); } };
  const seek = (time: number) => { if (!videoRef.current) return; videoRef.current.currentTime = time; setCurrentTime(time); };
  const handleVolumeChange = (vol: number) => { if (!videoRef.current) return; videoRef.current.volume = vol; videoRef.current.muted = vol === 0; setVolume(vol); setIsMuted(vol === 0); };
  const handlePlaybackRateChange = (rate: number) => { if (!videoRef.current) return; videoRef.current.playbackRate = rate; setPlaybackRate(rate); };
  const handleLevelChange = (levelIdx: number) => { if (hlsRef.current) { hlsRef.current.currentLevel = levelIdx; setCurrentHlsLevel(levelIdx); } };

  const handleRetry = () => {
    setErrorDetails(null);
    setIsLoadingMedia(true);
    setBypassStage('DIRECT');
    if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null; }
    if (videoRef.current && media) {
      videoRef.current.src = media.sourceUrl;
      videoRef.current.load();
    }
  };

  const getLoadingMessage = (): string => {
    switch (bypassStage) {
      case 'DIRECT': return 'Memuat video...';
      case 'CORS_BLOB': return 'Mencoba bypass CORS (Blob stream)...';
      case 'BACKEND_PROXY': return 'Melewati blokir ISP via Backend Proxy (DoH)...';
      default: return 'Memuat video...';
    }
  };

  const renderErrorIcon = () => {
    if (!errorDetails) return null;
    switch (errorDetails.type) {
      case 'EXPIRED': return <FileQuestion className="w-9 h-9 text-amber-400" />;
      case 'FORBIDDEN': return <Ban className="w-9 h-9 text-red-400" />;
      case 'NETWORK': return <WifiOff className="w-9 h-9 text-blue-400" />;
      default: return <AlertTriangle className="w-9 h-9 text-red-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 sm:p-6 animate-in fade-in duration-200">
      <div
        ref={containerRef}
        className={`w-full max-h-[85vh] bg-black rounded-2xl overflow-hidden shadow-2xl relative border border-white/10 flex items-center justify-center group ${isVertical ? 'max-w-sm aspect-[9/16]' : 'max-w-5xl aspect-video'}`}
      >
        {/* Top Header */}
        <div className="absolute top-0 inset-x-0 p-4 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="flex items-center gap-2 text-white text-xs font-semibold drop-shadow">
            <Film className="w-4 h-4 text-blue-400" />
            <span className="truncate max-w-md">{media.pageTitle || 'Pemutar Video Bersih'}</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full bg-white/20 hover:bg-white/40 text-white transition-colors cursor-pointer" title="Tutup (Esc)">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* YouTube Clean Embed */}
        {youtubeVideoId ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${youtubeVideoId}?autoplay=1&modestbranding=1&rel=0`}
            title={media.pageTitle || 'YouTube Video'}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="w-full h-full border-0"
          />
        ) : (
          <video
            ref={videoRef}
            onClick={togglePlay}
            onDoubleClick={toggleFullscreen}
            onTimeUpdate={() => videoRef.current && setCurrentTime(videoRef.current.currentTime)}
            onLoadedMetadata={handleLoadedMetadata}
            onError={handleVideoError}
            onWaiting={() => setIsLoadingMedia(true)}
            onPlaying={() => { setIsLoadingMedia(false); setBypassStage('DONE'); }}
            onEnded={() => setIsPlaying(false)}
            className="w-full h-full object-contain cursor-pointer"
            playsInline
          />
        )}

        {/* Loading Spinner with Stage Info */}
        {!youtubeVideoId && isLoadingMedia && !errorDetails && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 bg-black/60 z-25 pointer-events-none">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            <span className="text-xs font-semibold text-zinc-300">{getLoadingMessage()}</span>
            {bypassStage === 'BACKEND_PROXY' && (
              <span className="text-[10px] text-cyan-400 font-mono">Rute: localhost:8000/api/v1/proxy-media + DoH DNS</span>
            )}
          </div>
        )}

        {/* Error Banner */}
        {!youtubeVideoId && errorDetails && (
          <div className="absolute inset-0 flex items-center justify-center p-6 bg-black/90 z-30">
            <div className="p-6 rounded-3xl bg-zinc-900/95 border border-zinc-700 text-white flex flex-col items-center text-center gap-3.5 max-w-md shadow-2xl backdrop-blur-xl animate-in zoom-in-95 duration-150">
              <div className="w-16 h-16 rounded-2xl bg-zinc-800 flex items-center justify-center">{renderErrorIcon()}</div>
              <div>
                <h4 className="text-sm font-bold text-white tracking-tight">{errorDetails.title}</h4>
                {errorDetails.statusCode && (
                  <span className="inline-block mt-1 px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-400 text-[10px] font-mono font-semibold">Status: {errorDetails.statusCode}</span>
                )}
                <p className="text-xs text-zinc-300 leading-relaxed mt-2">{errorDetails.message}</p>
              </div>
              <div className="flex flex-col gap-2 pt-1 w-full">
                <div className="flex items-center gap-2 w-full">
                  <button onClick={handleRetry} className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-blue-900/30 cursor-pointer">
                    <RefreshCw className="w-3.5 h-3.5" /><span>Coba Lagi</span>
                  </button>
                  <button onClick={handleOpenSourcePage} className="flex-1 py-2.5 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 border border-zinc-700 transition-all cursor-pointer" title="Buka situs sumber">
                    <ExternalLink className="w-3.5 h-3.5 text-zinc-400" /><span>Buka Situs Host</span>
                  </button>
                </div>
                <button onClick={onClose} className="w-full py-2 text-xs font-semibold text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer">Tutup Pemutar</button>
              </div>
            </div>
          </div>
        )}

        {/* Controls */}
        {!youtubeVideoId && (
          <PlayerControls
            isPlaying={isPlaying} isMuted={isMuted} isFullscreen={isFullscreen} isPipAvailable={isPipAvailable}
            currentTime={currentTime} duration={duration} volume={volume} playbackRate={playbackRate}
            levels={hlsLevels} currentLevel={currentHlsLevel}
            onTogglePlay={togglePlay} onToggleMute={toggleMute} onToggleFullscreen={toggleFullscreen} onTogglePip={togglePip}
            onSeek={seek} onVolumeChange={handleVolumeChange} onPlaybackRateChange={handlePlaybackRateChange}
            onLevelChange={handleLevelChange} onDownload={() => onDownload(media)}
          />
        )}
      </div>
    </div>
  );
};