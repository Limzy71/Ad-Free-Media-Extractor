import cssText from 'data-text:~style.css';
import type { PlasmoCSConfig, PlasmoGetStyle } from 'plasmo';
import React, { useState, useEffect } from 'react';
import { Film, Play } from 'lucide-react';
import { CleanPlayerModal } from '~/components/clean-player/CleanPlayerModal';
import { Toast, type ToastMessage } from '~/components/ui/Toast';
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
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [isVisible, setIsVisible] = useState<boolean>(true);

  useEffect(() => {
    // Message listener dari Background Worker atau Popup
    const messageListener = (message: ExtensionMessage) => {
      if (message.type === 'MEDIA_DETECTED') {
        setDetectedMediaList((prev) => {
          // Cegah duplikasi ID media
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

  const latestMedia = detectedMediaList[detectedMediaList.length - 1];

  return (
    <div className="font-sans antialiased">
      {/* Toast Notification */}
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* Floating Action Badge (Disuntikkan di pojok kanan bawah jika ada media terdeteksi) */}
      {detectedMediaList.length > 0 && !activePlayMedia && isVisible && (
        <div className="fixed bottom-6 right-6 z-[99999] pointer-events-auto flex items-center gap-2 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <button
            onClick={() => latestMedia && setActivePlayMedia(latestMedia)}
            className="flex items-center gap-2.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-full shadow-2xl transition-all duration-150 hover:scale-105 select-none text-xs font-semibold"
            title="Buka Pemutar Video Bersih"
          >
            <Play className="w-4 h-4 fill-current animate-pulse" />
            <span>Nonton Bebas Iklan</span>
            <span className="bg-blue-800 px-1.5 py-0.5 rounded-full text-[10px] font-bold">
              {detectedMediaList.length}
            </span>
          </button>
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
