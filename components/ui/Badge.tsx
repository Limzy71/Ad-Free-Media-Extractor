import React from 'react';
import type { MediaFormatCategory } from '~/types/media';

interface BadgeProps {
  label: string;
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'neutral' | 'format';
  format?: MediaFormatCategory;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'neutral',
  format,
  className = ''
}) => {
  const getFormatBadgeStyle = (fmt?: MediaFormatCategory): string => {
    switch (fmt) {
      case 'HLS':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-300 dark:border-purple-800';
      case 'MP4':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-300 dark:border-blue-800';
      case 'WEBM':
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800';
      case 'DASH':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800';
      case 'AUDIO':
        return 'bg-pink-100 text-pink-700 dark:bg-pink-950/60 dark:text-pink-300 border-pink-300 dark:border-pink-800';
      default:
        return 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border-zinc-300 dark:border-zinc-700';
    }
  };

  const getVariantStyle = (): string => {
    if (format) return getFormatBadgeStyle(format);

    switch (variant) {
      case 'primary':
        return 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800';
      case 'success':
        return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
      case 'warning':
        return 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800';
      case 'danger':
        return 'bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300 border-red-200 dark:border-red-800';
      default:
        return 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700';
    }
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border tracking-wide uppercase ${getVariantStyle()} ${className}`}
    >
      {label}
    </span>
  );
};
