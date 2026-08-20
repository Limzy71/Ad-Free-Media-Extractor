import React, { useEffect } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'warning' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  durationMs?: number;
}

interface ToastProps {
  toast: ToastMessage | null;
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ toast, onClose }) => {
  useEffect(() => {
    if (!toast) return;

    const timer = setTimeout(() => {
      onClose();
    }, toast.durationMs || 3500);

    return () => clearTimeout(timer);
  }, [toast, onClose]);

  if (!toast) return null;

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-400 shrink-0" />;
      default:
        return <Info className="w-4 h-4 text-blue-400 shrink-0" />;
    }
  };

  return (
    <div className="fixed top-5 right-5 z-[9999999] pointer-events-auto flex items-start gap-3 p-3.5 bg-zinc-900/95 dark:bg-zinc-800/95 text-white border border-zinc-700/60 rounded-xl shadow-2xl backdrop-blur-md max-w-sm w-full transition-all animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="mt-0.5">{getIcon()}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-zinc-100">{toast.title}</p>
        {toast.message && (
          <p className="text-[11px] text-zinc-400 mt-0.5 leading-snug break-words">
            {toast.message}
          </p>
        )}
      </div>
      <button
        onClick={onClose}
        className="text-zinc-400 hover:text-white p-1 rounded-md transition-colors"
        aria-label="Tutup notifikasi"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
