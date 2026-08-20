import React from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Download,
  RotateCcw,
  RotateCw
} from 'lucide-react';

interface PlayerControlsProps {
  isPlaying: boolean;
  isMuted: boolean;
  isFullscreen: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  playbackRate: number;
  onTogglePlay: () => void;
  onToggleMute: () => void;
  onToggleFullscreen: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (vol: number) => void;
  onPlaybackRateChange: (rate: number) => void;
  onDownload: () => void;
}

export const PlayerControls: React.FC<PlayerControlsProps> = ({
  isPlaying,
  isMuted,
  isFullscreen,
  currentTime,
  duration,
  volume,
  playbackRate,
  onTogglePlay,
  onToggleMute,
  onToggleFullscreen,
  onSeek,
  onVolumeChange,
  onPlaybackRateChange,
  onDownload
}) => {
  const formatTime = (seconds: number): string => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent p-4 flex flex-col gap-2.5 select-none transition-opacity duration-200">
      {/* Timeline Progress Bar */}
      <div className="relative w-full h-1.5 hover:h-2.5 bg-white/20 rounded-full cursor-pointer transition-all group">
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
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow scale-0 group-hover:scale-100 transition-transform" />
        </div>
      </div>

      {/* Control Buttons Row */}
      <div className="flex items-center justify-between text-white text-xs font-medium">
        {/* Left: Play/Pause, Seek Buttons, Time Counter */}
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

          <span className="text-[11px] text-zinc-300 font-mono">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>

        {/* Right: Speed Picker, Download, Fullscreen */}
        <div className="flex items-center gap-2">
          {/* Speed Selector */}
          <select
            value={playbackRate}
            onChange={(e) => onPlaybackRateChange(parseFloat(e.target.value))}
            className="bg-black/40 border border-white/20 rounded-md px-1.5 py-0.5 text-[11px] text-white hover:bg-black/60 cursor-pointer focus:outline-none"
          >
            <option value="0.5">0.5x</option>
            <option value="1">1.0x</option>
            <option value="1.25">1.25x</option>
            <option value="1.5">1.5x</option>
            <option value="2">2.0x</option>
          </select>

          <button
            onClick={onDownload}
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors text-blue-400 hover:text-blue-300"
            title="Unduh video ini"
          >
            <Download className="w-4 h-4" />
          </button>

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
