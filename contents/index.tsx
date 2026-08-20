import cssText from 'data-text:~style.css';
import type { PlasmoCSConfig, PlasmoGetStyle } from 'plasmo';
import React, { useState, useEffect } from 'react';
import { Play, Download, X, Layers, ChevronUp, ChevronDown, ShieldCheck } from 'lucide-react';
import { CleanPlayerModal } from '~/components/clean-player/CleanPlayerModal';
import { Toast, type ToastMessage } from '~/components/ui/Toast';
import { Badge } from '~/components/ui/Badge';
import { AdBlockerService } from '~/services/ad-blocker';
import type { MediaMetadata } from '~/types/media';
import type { ExtensionMessage } from '~/types/messages';

export const config: PlasmoCSConfig = {
  matches: ['<all_urls>']
};

/**
 * Menyuntikkan style CSS Tailwind ke dalam Shadow DOM agar 100% terisolasi dari situs web host
 */
export const getStyle: PlasmoGetStyle = () => {
  const style = document.createElement('style');
  style.textContent = cssText;
  return style;
};

export default function ContentOverlay() {
  const [detectedMediaList, setDetectedMediaList] = useState<MediaMetadata[]>([]);
  const [activePlayMedia, setActivePlayMedia] = useState<MediaMetadata | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [isBadgeVisible, setIsBadgeVisible] = useState<boolean>(true);
  const [blockedAdsCount, setBlockedAdsCount] = useState<number>(0);

  useEffect(() => {
    // 1. Inisialisasi pembersih overlay anti-klik DOM (Layer 2 Ad-Blocker)
    const cleanupSanitizer = AdBlockerService.initDomSanitizer((count) => {
      setBlockedAdsCount(count);
      // Laporkan jumlah iklan yang dibersihkan ke Background Service Worker
      chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
        if (tab?.id) {
          chrome.runtime.sendMessage({
            type: 'ADS_BLOCKED_COUNT_UPDATE',
            payload: { tabId: tab.id, count }
          });
        }
      });
    });

    // 2. Message listener dari Background Worker atau Popup
    const messageListener = (message: ExtensionMessage) => {
      if (message.type === 'MEDIA_DETECTED') {
        setDetectedMediaList((prev) => {
          if (prev.some((m) => m.sourceUrl === message.payload.sourceUrl)) {
            return prev;
          }
          return [...prev, message.payload];
        });
      } else if (message.type === 'TRIGGER_CLEAN_PLAYER') {
        setActivePlayMedia(message.payload);
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);

    return () => {
      cleanupSanitizer();
      chrome.runtime.onMessage.removeListener(messageListener);
    };
  }, []);

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

  const handleBadgeClick = () => {
    if (detectedMediaList.length === 1) {
      setActivePlayMedia(detectedMediaList[0]);
    } else {
      setIsMenuOpen(!isMenuOpen);
    }
  };

  return (
    <div className="font-sans antialiased select-none">
      {/* Toast Notification Container */}
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* Floating Injected Action Widget & Multi-Media Menu */}
      {detectedMediaList.length > 0 && !activePlayMedia && isBadgeVisible && (
        <div className="fixed bottom-6 right-6 z-[99999] pointer-events-auto flex flex-col items-end gap-2 animate-in fade-in slide-in-from-bottom-4 duration-300">
          {/* Multi-Media Flyout Menu (if expanded) */}
          {isMenuOpen && detectedMediaList.length > 1 && (
            <div className="w-80 bg-zinc-900/95 dark:bg-zinc-900/95 text-white border border-zinc-700/60 rounded-2xl shadow-2xl backdrop-blur-xl p-3 flex flex-col gap-2.5 mb-1 animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between px-1 pb-1 border-b border-zinc-800">
                <span className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-blue-400" />
                  <span>Daftar Video Terdeteksi ({detectedMediaList.length})</span>
                </span>
                <button
                  onClick={() => setIsMenuOpen(false)}
                  className="p-1 hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Media Items Scrollable List */}
              <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                {detectedMediaList.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    className="p-2.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-800 border border-zinc-700/50 flex flex-col gap-1.5 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-xs font-semibold text-zinc-100 truncate max-w-[170px]" title={item.pageTitle}>
                        {item.pageTitle || `Video ${idx + 1}`}
                      </span>
                      <Badge label={item.formatCategory} format={item.formatCategory} />
                    </div>

                    <div className="flex items-center gap-1.5 pt-1">
                      <button
                        onClick={() => {
                          setActivePlayMedia(item);
                          setIsMenuOpen(false);
                        }}
                        className="flex-1 py-1 px-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>Nonton</span>
                      </button>
                      <button
                        onClick={() => handleDownload(item)}
                        className="py-1 px-2.5 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1"
                        title="Unduh video"
                      >
                        <Download className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Blocked Ads Status Banner in Menu */}
              {blockedAdsCount > 0 && (
                <div className="flex items-center justify-between px-2 py-1 rounded-lg bg-emerald-950/50 border border-emerald-800/50 text-[10px] text-emerald-300">
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-400" />
                    <span>Overlay Iklan Dibersihkan</span>
                  </span>
                  <span className="font-bold">{blockedAdsCount}</span>
                </div>
              )}
            </div>
          )}

          {/* Main Floating Badge Button */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleBadgeClick}
              className="flex items-center gap-2.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-full shadow-2xl transition-all duration-150 hover:scale-105 select-none text-xs font-semibold"
              title="Putar video bebas iklan"
            >
              <Play className="w-4 h-4 fill-current animate-pulse" />
              <span>Nonton Bebas Iklan</span>
              <span className="bg-blue-800 px-1.5 py-0.5 rounded-full text-[10px] font-bold">
                {detectedMediaList.length}
              </span>
              {detectedMediaList.length > 1 && (
                isMenuOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />
              )}
            </button>

            {/* Quick Dismiss Button */}
            <button
              onClick={() => setIsBadgeVisible(false)}
              className="p-2 rounded-full bg-zinc-900/80 hover:bg-zinc-900 text-zinc-400 hover:text-white shadow-lg backdrop-blur-sm transition-colors text-xs"
              title="Sembunyikan tombol mengambang"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Clean Player Fullscreen Modal */}
      {activePlayMedia && (
        <CleanPlayerModal
          media={activePlayMedia}
          onClose={() => setActivePlayMedia(null)}
          onDownload={handleDownload}
        />
      )}
    </div>
  );
}
