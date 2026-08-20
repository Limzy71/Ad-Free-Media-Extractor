import React from 'react';
import { ShieldCheck, ShieldAlert, Sparkles, Power } from 'lucide-react';
import type { SecurityStatus } from '~/types/security';

interface HeaderProps {
  currentDomain: string;
  securityStatus: SecurityStatus;
  blockedAdsCount: number;
  isEnabled: boolean;
  onToggleEnabled: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentDomain,
  securityStatus,
  blockedAdsCount,
  isEnabled,
  onToggleEnabled
}) => {
  const isSafe = securityStatus === 'SAFE';

  return (
    <header className="px-4 py-3 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex flex-col gap-2.5 select-none">
      {/* Top Bar: Brand & Global Protection Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm">
            <Sparkles className="w-4 h-4" />
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

        <button
          onClick={onToggleEnabled}
          title={isEnabled ? 'Nonaktifkan proteksi' : 'Aktifkan proteksi'}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
            isEnabled
              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border border-zinc-200 dark:border-zinc-700'
          }`}
        >
          <Power className={`w-3 h-3 ${isEnabled ? 'text-emerald-500' : 'text-zinc-400'}`} />
          <span>{isEnabled ? 'Aktif' : 'Nonaktif'}</span>
        </button>
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
