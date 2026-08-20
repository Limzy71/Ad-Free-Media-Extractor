import React, { useState } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Download,
  RotateCcw,
  RotateCw,
  PictureInPicture2
} from 'lucide-react';

interface PlayerControlsProps {
  isPlaying: boolean;
  isMuted: boolean;
  isFullscreen: boolean;
  isPipAvailable: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  playbackRate: number;
  levels?: { height: number; bitrate: number }[];
  currentLevel?: number;
  onTogglePlay: () => void;
  onToggleMute: () => void;
  onToggleFullscreen: () => void;
  onTogglePip: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (vol: number) => void;
  onPlaybackRateChange: (rate: number) => void;
  onLevelChange?: (levelIndex: number) => void;
  onDownload: () => void;
}

export const PlayerControls: React.FC<PlayerControlsProps> = ({
  isPlaying,
  isMuted,
  isFullscreen,
  isPipAvailable,
  currentTime,
  duration,
  volume,
  playbackRate,
  levels,
  currentLevel = -1,
  onTogglePlay,
  onToggleMute,
  onToggleFullscreen,
  onTogglePip,
  onSeek,
  onVolumeChange,
  onPlaybackRateChange,
  onLevelChange,
  onDownload
}) => {
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState<number>(0);

  const formatTime = (seconds: number): string => {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverTime(pos * duration);
    setHoverX(e.clientX - rect.left);
  };

  return (
    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/95 via-black/75 to-transparent p-4 flex flex-col gap-2.5 select-none transition-opacity duration-200 z-30">
      {/* Timeline Progress Bar with Hover Preview Tooltip */}
      <div
        className="relative w-full h-1.5 hover:h-2.5 bg-white/20 rounded-full cursor-pointer transition-all group"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverTime(null)}
      >
        {/* Tooltip Preview */}
        {hoverTime !== null && (
          <div
            className="absolute -top-7 px-1.5 py-0.5 bg-zinc-900 text-white text-[10px] font-mono rounded shadow border border-white/10 -translate-x-1/2 pointer-events-none"
            style={{ left: `${hoverX}px` }}
          >
            {formatTime(hoverTime)}
          </div>
        )}

        <input
          type="range"
          min={0}
          max={duration || 100}
          value={currentTime}
          onChange={(e) => onSeek(parseFloat(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        />
        <div
          className="h-full bg-blue-500 rounded-full relative transition-all"
          style={{ width: `${progressPercent}%` }}
        >
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full shadow-lg scale-0 group-hover:scale-100 transition-transform" />
        </div>
      </div>

      {/* Control Buttons Row */}
      <div className="flex items-center justify-between text-white text-xs font-medium">
        {/* Left: Play/Pause, Seek Buttons, Volume, Time Counter */}
        <div className="flex items-center gap-3">
          <button
            onClick={onTogglePlay}
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-blue-400"
            title={isPlaying ? 'Jeda (Space / K)' : 'Putar (Space / K)'}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 fill-current" />
            ) : (
              <Play className="w-5 h-5 fill-current" />
            )}
          </button>

          <button
            onClick={() => onSeek(Math.max(0, currentTime - 10))}
            className="p-1 hover:bg-white/20 rounded-lg transition-colors hidden sm:block"
            title="Mundur 10 detik (J)"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={() => onSeek(Math.min(duration, currentTime + 10))}
            className="p-1 hover:bg-white/20 rounded-lg transition-colors hidden sm:block"
            title="Maju 10 detik (L)"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          {/* Volume Control */}
          <div className="flex items-center gap-1.5 group/vol">
            <button
              onClick={onToggleMute}
              className="p-1 hover:bg-white/20 rounded-lg transition-colors"
              title="Bisukan suara (M)"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4 text-red-400" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={isMuted ? 0 : volume}
              onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
              className="w-16 h-1 bg-white/30 rounded-lg accent-blue-500 cursor-pointer hidden group-hover/vol:block transition-all"
            />
          </div>

          <span className="text-[11px] text-zinc-300 font-mono tracking-tight">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>

        {/* Right: Quality Picker, Speed, PiP, Download, Fullscreen */}
        <div className="flex items-center gap-2">
          {/* HLS Quality Selector (if available) */}
          {levels && levels.length > 0 && onLevelChange && (
            <select
              value={currentLevel}
              onChange={(e) => onLevelChange(parseInt(e.target.value, 10))}
              className="bg-black/50 border border-white/20 rounded-md px-1.5 py-0.5 text-[11px] text-white hover:bg-black/70 cursor-pointer focus:outline-none"
              title="Pilih Resolusi Video"
            >
              <option value="-1">Otomatis</option>
              {levels.map((lvl, idx) => (
                <option key={idx} value={idx}>
                  {lvl.height}p
                </option>
              ))}
            </select>
          )}

          {/* Speed Selector */}
          <select
            value={playbackRate}
            onChange={(e) => onPlaybackRateChange(parseFloat(e.target.value))}
            className="bg-black/50 border border-white/20 rounded-md px-1.5 py-0.5 text-[11px] text-white hover:bg-black/70 cursor-pointer focus:outline-none"
            title="Kecepatan Pemutaran"
          >
            <option value="0.5">0.5x</option>
            <option value="1">1.0x</option>
            <option value="1.25">1.25x</option>
            <option value="1.5">1.5x</option>
            <option value="2">2.0x</option>
          </select>

          {/* Picture in Picture */}
          {isPipAvailable && (
            <button
              onClick={onTogglePip}
              className="p-1.5 hover:bg-white/20 rounded-lg transition-colors text-zinc-300 hover:text-white hidden sm:block"
              title="Picture-in-Picture (P)"
            >
              <PictureInPicture2 className="w-4 h-4" />
            </button>
          )}

          {/* Download Button */}
          <button
            onClick={onDownload}
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors text-blue-400 hover:text-blue-300"
            title="Unduh video ini"
          >
            <Download className="w-4 h-4" />
          </button>

          {/* Fullscreen Button */}
          <button
            onClick={onToggleFullscreen}
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
            title="Layar Penuh (F)"
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};
