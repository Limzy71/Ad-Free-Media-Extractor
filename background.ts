import { MediaSnifferService } from '~/services/media-sniffer';
import { LinkVerifierService } from '~/services/link-verifier';
import { DownloaderService } from '~/services/hls-downloader';
import { AdBlockerService } from '~/services/ad-blocker';
import type { MediaMetadata } from '~/types/media';
import type { ExtensionMessage } from '~/types/messages';

// Penyimpanan media aktif di memori per tabId
const tabMediaMap = new Map<number, MediaMetadata[]>();

// Penyimpanan jumlah iklan/tracker yang dibersihkan per tab
const tabBlockedAdsMap = new Map<number, number>();

/**
 * 0. Inisialisasi Aturan Pemblokir Iklan Dinamis (DNR Rulesets)
 */
chrome.runtime.onInstalled.addListener(() => {
  AdBlockerService.setupDynamicAdBlockRules();
});

chrome.runtime.onStartup.addListener(() => {
  AdBlockerService.setupDynamicAdBlockRules();
});

/**
 * Mengupdate indikator badge pada ikon ekstensi di toolbar browser
 */
function updateExtensionBadge(tabId: number, count: number): void {
  if (tabId < 0) return;

  if (count > 0) {
    chrome.action.setBadgeText({ tabId, text: count.toString() });
    chrome.action.setBadgeBackgroundColor({ tabId, color: '#2563eb' });
  } else {
    chrome.action.setBadgeText({ tabId, text: '' });
  }
}

/**
 * 1. Background Media Sniffer: Memantau lalu lintas header HTTP
 */
chrome.webRequest.onHeadersReceived.addListener(
  (details) => {
    if (details.tabId < 0) return;

    const contentTypeHeader = details.responseHeaders?.find(
      (h) => h.name.toLowerCase() === 'content-type'
    );
    const contentLengthHeader = details.responseHeaders?.find(
      (h) => h.name.toLowerCase() === 'content-length'
    );

    const mimeType = contentTypeHeader?.value || 'unknown';
    const contentLength = contentLengthHeader?.value
      ? parseInt(contentLengthHeader.value, 10)
      : undefined;

    if (MediaSnifferService.isValidMediaStream(details.url, mimeType, contentLength)) {
      chrome.tabs.get(details.tabId, (tab) => {
        if (chrome.runtime.lastError || !tab) return;

        if (
          !tab.url ||
          tab.url.startsWith('chrome://') ||
          tab.url.startsWith('edge://') ||
          tab.url.startsWith('about:') ||
          tab.url.startsWith('chrome-extension://')
        ) {
          return;
        }

        const mediaItem = MediaSnifferService.createMediaMetadata(
          details.url,
          tab.url,
          tab.title || '',
          mimeType,
          contentLength
        );

        const currentList = tabMediaMap.get(details.tabId) || [];
        // Cek apakah URL persis sama (full duplicate)
        const exactDuplicate = currentList.some((m) => m.sourceUrl === mediaItem.sourceUrl);

        if (!exactDuplicate) {
          // Cek apakah ada entry lama dari domain yang sama dengan kualitas lebih rendah
          const newScore = MediaSnifferService.qualityScore(mediaItem.sourceUrl, mediaItem.contentLengthBytes);
          const lowerQualityIdx = currentList.findIndex((m) => {
            try {
              const sameDomain = new URL(m.sourceUrl).hostname === new URL(mediaItem.sourceUrl).hostname;
              const sameFormat = m.formatCategory === mediaItem.formatCategory;
              if (!sameDomain || !sameFormat) return false;
              const oldScore = MediaSnifferService.qualityScore(m.sourceUrl, m.contentLengthBytes);
              return newScore > oldScore;
            } catch {
              return false;
            }
          });

          if (lowerQualityIdx >= 0) {
            // Gantikan entry resolusi rendah dengan yang lebih tinggi
            currentList[lowerQualityIdx] = mediaItem;
          } else {
            currentList.push(mediaItem);
          }
          tabMediaMap.set(details.tabId, currentList);

          updateExtensionBadge(details.tabId, currentList.length);

          const msg: ExtensionMessage = {
            type: 'MEDIA_DETECTED',
            payload: mediaItem
          };
          chrome.tabs.sendMessage(details.tabId, msg).catch(() => {
            // Content script belum siap, abaikan
          });
        }
      });
    }
  },
  { urls: ['<all_urls>'] },
  ['responseHeaders']
);

/**
 * 2. Pembersihan memori & reset badge saat tab ditutup atau dimuat ulang
 */
chrome.tabs.onRemoved.addListener((tabId) => {
  tabMediaMap.delete(tabId);
  tabBlockedAdsMap.delete(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    tabMediaMap.delete(tabId);
    tabBlockedAdsMap.delete(tabId);
    updateExtensionBadge(tabId, 0);
  }
});

/**
 * 3. Smart Link Verifier: Memeriksa navigasi ke situs berbahaya/judi
 */
chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  if (details.frameId !== 0 || !details.url || !details.url.startsWith('http')) return;

  const result = await LinkVerifierService.verifyUrl(details.url);

  if (result.status === 'BLOCKED') {
    const warningUrl = chrome.runtime.getURL(
      `tabs/warning.html?url=${encodeURIComponent(details.url)}&threat=${result.threatCategory || 'MALICIOUS'}`
    );
    chrome.tabs.update(details.tabId, { url: warningUrl });
  }
});

/**
 * 4. Message Passing Handler Terpusat
 */
chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, sender, sendResponse) => {
    switch (message.type) {
      case 'GET_TAB_MEDIA_REQUEST': {
        const tabId = message.payload.tabId || sender.tab?.id;
        const mediaList = tabId ? tabMediaMap.get(tabId) || [] : [];
        sendResponse({ mediaList });
        return false;
      }

      case 'VERIFY_URL_REQUEST': {
        LinkVerifierService.verifyUrl(message.payload.url).then((result) => {
          sendResponse(result);
        });
        return true;
      }

      case 'START_MEDIA_DOWNLOAD': {
        const { sourceUrl, filename, formatCategory } = message.payload;
        if (formatCategory === 'HLS') {
          DownloaderService.downloadHlsStream(sourceUrl, filename, (progress) => {
            const progressMsg: ExtensionMessage = {
              type: 'DOWNLOAD_PROGRESS_UPDATE',
              payload: progress
            };

            // Broadcast ke tab pengirim
            if (sender.tab?.id) {
              chrome.tabs.sendMessage(sender.tab.id, progressMsg).catch(() => {});
            }

            // Broadcast ke popup / runtime
            chrome.runtime.sendMessage(progressMsg).catch(() => {});
          }).catch(console.error);
        } else {
          DownloaderService.downloadDirectMedia(sourceUrl, filename).catch(console.error);
        }
        sendResponse({ success: true });
        return false;
      }

      case 'ADS_BLOCKED_COUNT_UPDATE': {
        const { tabId, count } = message.payload;
        tabBlockedAdsMap.set(tabId, count);
        return false;
      }

      case 'GET_ADS_BLOCKED_COUNT': {
        const blocked = tabBlockedAdsMap.get(message.payload.tabId) || 0;
        sendResponse({ count: blocked });
        return false;
      }
    }
  }
);
