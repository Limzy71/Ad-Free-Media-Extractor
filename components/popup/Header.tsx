import React from 'react';
import { ShieldCheck, ShieldAlert, Play, Power, ExternalLink } from 'lucide-react';
import type { SecurityStatus } from '~/types/security';

interface HeaderProps {
  currentDomain: string;
  securityStatus: SecurityStatus;
  blockedAdsCount: number;
  isEnabled: boolean;
  onToggleEnabled: () => void;
  onOpenLinkChecker: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentDomain,
  securityStatus,
  blockedAdsCount,
  isEnabled,
  onToggleEnabled,
  onOpenLinkChecker
}) => {
  const isSafe = securityStatus === 'SAFE';

  return (
    <header className="px-4 py-3 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex flex-col gap-2.5 select-none">
      {/* Top Bar: Brand & Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm">
            <Play className="w-4 h-4 text-white fill-white ml-0.5" />
          </div>
          <div>
            <h1 className="text-xs font-bold text-zinc-900 dark:text-white tracking-tight leading-none">
              Media Extractor
            </h1>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium">
              Universal Ad-Free Pro
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Button Buka Web Link Checker Dashboard */}
          <button
            onClick={onOpenLinkChecker}
            title="Buka Halaman Web Link Checker di Tab Baru"
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/80 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 text-[10px] font-semibold transition-all hover:scale-105"
          >
            <ExternalLink className="w-3 h-3" />
            <span>Web Checker</span>
          </button>

          {/* Toggle On/Off Proteksi */}
          <button
            onClick={onToggleEnabled}
            title={isEnabled ? 'Nonaktifkan proteksi' : 'Aktifkan proteksi'}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition-all ${
              isEnabled
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border border-zinc-200 dark:border-zinc-700'
            }`}
          >
            <Power className={`w-3 h-3 ${isEnabled ? 'text-emerald-500' : 'text-zinc-400'}`} />
            <span>{isEnabled ? 'Aktif' : 'Off'}</span>
          </button>
        </div>
      </div>

      {/* Domain Security & Adblock Badge */}
      <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/80 dark:border-zinc-700/50 text-[11px]">
        <div className="flex items-center gap-1.5 min-w-0 pr-2">
          {isSafe ? (
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          ) : (
            <ShieldAlert className="w-3.5 h-3.5 text-red-500 shrink-0" />
          )}
          <span className="truncate font-medium text-zinc-700 dark:text-zinc-300">
            {currentDomain || 'Tab Aktif'}
          </span>
        </div>

        <span className="shrink-0 font-semibold text-blue-600 dark:text-blue-400">
          {blockedAdsCount} Iklan Dibersihkan
        </span>
      </div>
    </header>
  );
};