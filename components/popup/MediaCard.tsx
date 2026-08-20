import React from 'react';
import { Play, Download, Film, AlertCircle } from 'lucide-react';
import { Badge } from '~/components/ui/Badge';
import type { MediaMetadata } from '~/types/media';

interface MediaCardProps {
  media: MediaMetadata;
  onPlayClean: (media: MediaMetadata) => void;
  onDownload: (media: MediaMetadata) => void;
  isDownloading?: boolean;
}

export const MediaCard: React.FC<MediaCardProps> = ({
  media,
  onPlayClean,
  onDownload,
  isDownloading = false
}) => {
  const formatBytes = (bytes?: number): string => {
    if (!bytes || bytes === 0) return '';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const formatDuration = (sec?: number): string => {
    if (!sec) return '';
    const mins = Math.floor(sec / 60);
    const remainingSec = Math.floor(sec % 60);
    return `${mins}:${remainingSec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60 flex flex-col gap-2.5 hover:border-blue-400/60 dark:hover:border-blue-500/60 transition-all">
      {/* Title & Format Badges */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Film className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
          <h3
            className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate"
            title={media.pageTitle || 'Video Media Stream'}
          >
            {media.pageTitle || 'Video Media Stream'}
          </h3>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Badge label={media.formatCategory} format={media.formatCategory} />
          {media.resolution && <Badge label={media.resolution} variant="neutral" />}
        </div>
      </div>

      {/* Media Details Row */}
      <div className="flex items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
        {media.durationInSeconds && <span>{formatDuration(media.durationInSeconds)}</span>}
        {media.durationInSeconds && media.contentLengthBytes && <span>•</span>}
        {media.contentLengthBytes && <span>{formatBytes(media.contentLengthBytes)}</span>}
        {media.isDrmProtected && (
          <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold">
            <AlertCircle className="w-3 h-3" /> DRM Protected
          </span>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 pt-1 border-t border-zinc-200/60 dark:border-zinc-700/40">
        <button
          onClick={() => onPlayClean(media)}
          className="flex-1 py-1.5 px-3 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-colors focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>Nonton Bersih</span>
        </button>

        <button
          onClick={() => onDownload(media)}
          disabled={isDownloading || media.isDrmProtected}
          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors focus-visible:ring-2 focus-visible:ring-zinc-400 ${
            media.isDrmProtected
              ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed'
              : isDownloading
              ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 cursor-wait'
              : 'bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-900 dark:text-white'
          }`}
        >
          <Download className="w-3.5 h-3.5" />
          <span>{isDownloading ? 'Mengunduh...' : 'Unduh'}</span>
        </button>
      </div>
    </div>
  );
};
