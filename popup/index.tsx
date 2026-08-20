import React, { useState, useEffect } from 'react';
import { Header } from '~/components/popup/Header';
import { MediaCard } from '~/components/popup/MediaCard';
import { Toast, type ToastMessage } from '~/components/ui/Toast';
import { ShieldCheck, Film, RefreshCw, Search } from 'lucide-react';
import { LinkVerifierService } from '~/services/link-verifier';
import type { MediaMetadata } from '~/types/media';
import type { SecurityStatus } from '~/types/security';
import type { ExtensionMessage } from '~/types/messages';
import '~/style.css';

export default function PopupIndex() {
  const [mediaList, setMediaList] = useState<MediaMetadata[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentDomain, setCurrentDomain] = useState<string>('');
  const [securityStatus, setSecurityStatus] = useState<SecurityStatus>('SAFE');
  const [blockedAdsCount, setBlockedAdsCount] = useState<number>(0);
  const [isEnabled, setIsEnabled] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  useEffect(() => {
    const initPopup = async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.url) {
          const urlObj = new URL(tab.url);
          const domain = urlObj.hostname;
          setCurrentDomain(domain);

          // Cek status whitelist
          const storage = await chrome.storage.local.get(['whitelistedDomains']);
          const whitelisted: string[] = storage.whitelistedDomains || [];
          setIsEnabled(!whitelisted.includes(domain));

          // Verifikasi status keamanan domain
          const secResult = await LinkVerifierService.verifyUrl(tab.url);
          setSecurityStatus(secResult.status);
        }

        // Ambil daftar media terdeteksi dari background service worker
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

  const handleToggleProtection = async () => {
    if (!currentDomain) return;
    const newEnabledState = !isEnabled;
    setIsEnabled(newEnabledState);

    if (!newEnabledState) {
      await LinkVerifierService.whitelistDomain(currentDomain);
      setToast({
        id: Date.now().toString(),
        type: 'warning',
        title: 'Proteksi Dinonaktifkan',
        message: `Proteksi untuk ${currentDomain} telah dinonaktifkan.`
      });
    } else {
      await LinkVerifierService.removeWhitelistedDomain(currentDomain);
      setToast({
        id: Date.now().toString(),
        type: 'success',
        title: 'Proteksi Diaktifkan',
        message: `Proteksi untuk ${currentDomain} telah aktif kembali.`
      });
    }
  };

  const handlePlayClean = (media: MediaMetadata) => {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (tab?.id) {
        const msg: ExtensionMessage = {
          type: 'TRIGGER_CLEAN_PLAYER',
          payload: media
        };
        chrome.tabs.sendMessage(tab.id, msg);
        window.close();
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

  const filteredMedia = mediaList.filter((m) =>
    (m.pageTitle || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.formatCategory.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
        onToggleEnabled={handleToggleProtection}
      />

      {/* Body: Media List */}
      <main className="flex-1 overflow-y-auto p-3.5 space-y-3">
        {/* Search & Counter Bar */}
        <div className="flex items-center justify-between px-1 gap-2">
          <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 tracking-wider uppercase shrink-0">
            Media ({filteredMedia.length})
          </span>

          {mediaList.length > 2 && (
            <div className="relative flex-1">
              <Search className="w-3 h-3 text-zinc-400 absolute left-2 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari video..."
                className="w-full pl-6 pr-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-md text-[11px] text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          )}

          <button
            onClick={() => window.location.reload()}
            className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 shrink-0"
            title="Muat ulang pemindaian"
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
        ) : filteredMedia.length > 0 ? (
          <div className="space-y-2.5">
            {filteredMedia.map((media) => (
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
              {searchQuery ? 'Video Tidak Ditemukan' : 'Belum Ada Video Terdeteksi'}
            </h4>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
              {searchQuery
                ? 'Tidak ada video yang cocok dengan kata kunci pencarian Anda.'
                : 'Jelajahi halaman web atau mulai putar video untuk mendeteksi stream media secara otomatis.'}
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
