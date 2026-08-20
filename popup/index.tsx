import React, { useState, useEffect } from 'react';
import { Header } from '~/components/popup/Header';
import { MediaCard } from '~/components/popup/MediaCard';
import { Toast, type ToastMessage } from '~/components/ui/Toast';
import { ShieldCheck, Film, RefreshCw, ExternalLink } from 'lucide-react';
import type { MediaMetadata } from '~/types/media';
import type { SecurityStatus } from '~/types/security';
import type { ExtensionMessage } from '~/types/messages';
import '~/style.css';

export default function PopupIndex() {
  const [mediaList, setMediaList] = useState<MediaMetadata[]>([]);
  const [currentDomain, setCurrentDomain] = useState<string>('');
  const [securityStatus, setSecurityStatus] = useState<SecurityStatus>('SAFE');
  const [blockedAdsCount, setBlockedAdsCount] = useState<number>(0);
  const [isEnabled, setIsEnabled] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  useEffect(() => {
    // Load active tab info and media list
    const initPopup = async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.url) {
          const urlObj = new URL(tab.url);
          setCurrentDomain(urlObj.hostname);
        }

        // Request detected media from background worker
        chrome.runtime.sendMessage(
          { type: 'GET_TAB_MEDIA_REQUEST', payload: { tabId: tab?.id } },
          (response) => {
            if (response?.mediaList) {
              setMediaList(response.mediaList);
            }
            setIsLoading(false);
          }
        );
      } catch (err) {
        setIsLoading(false);
      }
    };

    initPopup();
  }, []);

  const handlePlayClean = (media: MediaMetadata) => {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (tab?.id) {
        const msg: ExtensionMessage = {
          type: 'TRIGGER_CLEAN_PLAYER',
          payload: media
        };
        chrome.tabs.sendMessage(tab.id, msg);
        window.close(); // Close popup so user can watch directly on overlay
      }
    });
  };

  const handleDownload = (media: MediaMetadata) => {
    setToast({
      id: Date.now().toString(),
      type: 'info',
      title: 'Memulai Unduhan',
      message: `Sedang memproses "${media.pageTitle || 'Video'}"...`
    });

    const msg: ExtensionMessage = {
      type: 'START_MEDIA_DOWNLOAD',
      payload: {
        mediaId: media.id,
        sourceUrl: media.sourceUrl,
        filename: `${media.pageTitle || 'video'}.${media.formatCategory.toLowerCase()}`,
        formatCategory: media.formatCategory
      }
    };

    chrome.runtime.sendMessage(msg);
  };

  return (
    <div className="w-[360px] h-[480px] bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 flex flex-col font-sans select-none overflow-hidden">
      {/* Toast Notification Container */}
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* Header */}
      <Header
        currentDomain={currentDomain}
        securityStatus={securityStatus}
        blockedAdsCount={blockedAdsCount}
        isEnabled={isEnabled}
        onToggleEnabled={() => setIsEnabled(!isEnabled)}
      />

      {/* Body: Media List */}
      <main className="flex-1 overflow-y-auto p-3.5 space-y-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 tracking-wider uppercase">
            Media Terdeteksi ({mediaList.length})
          </span>
          <button
            onClick={() => window.location.reload()}
            className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Segarkan</span>
          </button>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 text-zinc-400 gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
            <p className="text-xs font-medium">Memindai media halaman...</p>
          </div>
        ) : mediaList.length > 0 ? (
          <div className="space-y-2.5">
            {mediaList.map((media) => (
              <MediaCard
                key={media.id}
                media={media}
                onPlayClean={handlePlayClean}
                onDownload={handleDownload}
              />
            ))}
          </div>
        ) : (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl">
            <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 mb-2">
              <Film className="w-5 h-5" />
            </div>
            <h4 className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
              Belum Ada Video Terdeteksi
            </h4>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
              Jelajahi halaman web atau mulai putar video untuk mendeteksi stream media secara otomatis.
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="px-3.5 py-2 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex items-center justify-between text-[10px] text-zinc-400">
        <span>v1.0.0 (MVP) • Manifest V3</span>
        <span className="flex items-center gap-1 text-emerald-500 font-semibold">
          <ShieldCheck className="w-3 h-3" /> Zero-Data Retention
        </span>
      </footer>
    </div>
  );
}
