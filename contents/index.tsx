import cssText from 'data-text:~style.css';
import type { PlasmoCSConfig, PlasmoGetStyle } from 'plasmo';
import { useState, useEffect } from 'react';
import { CleanPlayerModal } from '~/components/clean-player/CleanPlayerModal';
import { Toast, type ToastMessage } from '~/components/ui/Toast';
import { AdBlockerService } from '~/services/ad-blocker';
import type { MediaMetadata } from '~/types/media';
import type { ExtensionMessage } from '~/types/messages';

export const config: PlasmoCSConfig = {
  matches: ['http://*/*', 'https://*/*'],
  exclude_matches: [
    'https://chrome.google.com/*',
    'https://chromewebstore.google.com/*'
  ],
  all_frames: true
};

/**
 * Menyuntikkan style CSS ke dalam Shadow DOM agar terisolasi dari situs web host
 */
export const getStyle: PlasmoGetStyle = () => {
  const style = document.createElement('style');
  style.textContent = cssText;
  return style;
};

export default function ContentOverlay() {
  // UI (modal Clean Player & Toast) hanya dirender di top frame. Guard popup &
  // sanitizer DOM tetap dipasang di semua frame lewat useEffect di bawah.
  const isTopFrame = typeof window !== 'undefined' && window.top === window.self;

  const [activePlayMedia, setActivePlayMedia] = useState<MediaMetadata | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  useEffect(() => {
    // 1. Inisialisasi pembersih overlay anti-klik DOM (Layer 2 Ad-Blocker) di latar belakang
    const cleanupSanitizer = AdBlockerService.initDomSanitizer((count) => {
      chrome.runtime.sendMessage({
        type: 'ADS_BLOCKED_COUNT_UPDATE',
        payload: { count }
      }).catch(() => {});
    });

    // 1b. Injeksi pageGuard ke MAIN world untuk memblokir popup/judol/pop-under hoster
    AdBlockerService.installPageGuard();
    const cleanupPageGuard = AdBlockerService.listenPageGuardReports((guardCount) => {
      chrome.runtime.sendMessage({
        type: 'ADS_BLOCKED_COUNT_UPDATE',
        payload: { count: guardCount }
      }).catch(() => {});
    });

    // 2. Listener pesan dari Popup Extension (Trigger Clean Player & Downloads)
    const messageListener = (
      message: ExtensionMessage,
      _sender: chrome.runtime.MessageSender,
      sendResponse: (response?: unknown) => void
    ) => {
      if (message.type === 'TRIGGER_CLEAN_PLAYER') {
        const media = message.payload as MediaMetadata;
        setActivePlayMedia(media);
        sendResponse({ success: true });
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);

    return () => {
      cleanupSanitizer();
      cleanupPageGuard();
      chrome.runtime.onMessage.removeListener(messageListener);
    };
  }, []);

  if (!isTopFrame) return null;

  const handleDownload = (media: MediaMetadata) => {
    if (media.formatCategory === 'YOUTUBE') {
      setToast({
        id: Date.now().toString(),
        type: 'info',
        title: 'YouTube Clean Embed Mode',
        message: 'Pengunduhan langsung YouTube dinonaktifkan sesuai kebijakan Chrome Web Store. Anda dapat menonton bebas iklan di Clean Player.',
        durationMs: 4500
      });
      return;
    }

    const EXT_MAP: Record<string, string> = {
      MP4: 'mp4',
      WEBM: 'webm',
      HLS: 'mp4',
      DASH: 'mp4',
      AUDIO: 'mp3'
    };
    const ext = EXT_MAP[media.formatCategory] || 'mp4';

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
        filename: `${media.pageTitle || 'video'}.${ext}`,
        formatCategory: media.formatCategory
      }
    };

    chrome.runtime.sendMessage(msg).catch(() => {});
  };

  return (
    <div className="font-sans antialiased select-none pointer-events-none">
      {/* Toast Notification Container */}
      <div className="pointer-events-auto">
        <Toast toast={toast} onClose={() => setToast(null)} />
      </div>

      {/* Clean Player Fullscreen Modal (Hanya muncul jika dipicu oleh pengguna dari popup) */}
      {activePlayMedia && (
        <div className="pointer-events-auto">
          <CleanPlayerModal
            media={activePlayMedia}
            onClose={() => setActivePlayMedia(null)}
            onDownload={handleDownload}
          />
        </div>
      )}
    </div>
  );
}
