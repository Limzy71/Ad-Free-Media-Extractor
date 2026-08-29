/**
 * Service untuk membersihkan elemen DOM intrusif dan mengonfigurasi declarativeNetRequest
 */
import type { ExtensionMessage } from '~/types/messages';

export class AdBlockerService {
  private static blockedCount = 0;

  public static readonly AD_DOMAINS = [
    'popads.net',
    'adsterra.com',
    'propellerads.com',
    'monetag.com',
    'adcash.com',
    'clickadu.com',
    'exoclick.com',
    'juicyads.com',
    'yllix.com',
    'trafficjunky.net',
    'bet365-tracker.com',
    'doubleclick.net',
    'googlesyndication.com'
  ];

  /**
   * Mengonfigurasi Dynamic Rules pada Declarative Net Request API
   */
  public static async setupDynamicAdBlockRules(): Promise<void> {
    try {
      const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
      const existingRuleIds = existingRules.map((r) => r.id);

      const newRules: chrome.declarativeNetRequest.Rule[] = this.AD_DOMAINS.map(
        (domain, index) => ({
          id: index + 1,
          priority: 1,
          action: { type: chrome.declarativeNetRequest.RuleActionType.BLOCK },
          condition: {
            urlFilter: `||${domain}^`,
            resourceTypes: [
              chrome.declarativeNetRequest.ResourceType.SCRIPT,
              chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST,
              chrome.declarativeNetRequest.ResourceType.SUB_FRAME,
              chrome.declarativeNetRequest.ResourceType.IMAGE
            ]
          }
        })
      );

      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: existingRuleIds,
        addRules: newRules
      });
    } catch (err) {
      console.warn('Gagal memperbarui aturan DNR dinamis:', err);
    }
  }

  /**
   * Daftar pola class/id yang umum digunakan oleh elemen iklan/overlay
   */
  private static readonly AD_OVERLAY_PATTERNS: RegExp[] = [
    /ad[_-]?overlay/i,
    /ad[_-]?wrapper/i,
    /pop[_-]?under/i,
    /click[_-]?hijack/i,
    /clickjacking/i,
    /interstitial[_-]?ad/i,
    /preroll/i,
    /midroll/i,
    /sticky[_-]?ad/i,
    /floating[_-]?ad/i,
    /video[_-]?overlay/i,
    /video[_-]?preroll/i,
    /ima[_-]?ad/i,
    /googima/i,
    /adsbygoogle/i
  ];

  /**
   * Selector Plasmo yang harus selalu dikecualikan
   */
  private static readonly PLASMO_SELECTORS = [
    '[id*="plasmo"]',
    '[id*="p_"]',
    '[class*="plasmo"]',
    'plasmo-csui'
  ];

  /**
   * Memulai pembersihan proaktif elemen anti-klik dan overlay iklan pada halaman web
   */
  public static initDomSanitizer(onElementBlocked?: (count: number) => void): () => void {
    const cleanOverlays = () => {
      // Kumpulkan semua kandidat overlay
      const candidates = document.querySelectorAll('div, iframe');

      candidates.forEach((el) => {
        const htmlEl = el as HTMLElement;

        // Selalu kecualikan elemen Plasmo/Shadow DOM
        if (htmlEl.closest(this.PLASMO_SELECTORS.join(','))) return;

        // Selalu kecualikan elemen yang memiliki interaksi (button, input, link)
        if (htmlEl.querySelector('button, input, select, textarea, a[href]')) return;

        const style = window.getComputedStyle(htmlEl);

        // Hindari elemen yang tidak di-positioning tinggi
        const isFixedOrAbsolute = style.position === 'fixed' || style.position === 'absolute';
        if (!isFixedOrAbsolute) return;

        const zIndex = parseInt(style.zIndex, 10);
        // Hanya target z-index sangat tinggi (> 999999 untuk overlay iklan, bukan 9999 untuk modals UI)
        if (isNaN(zIndex) || zIndex <= 999999) return;

        // Cek apakah elemen memiliki pola class/id iklan yang dikenal
        const hasAdPattern = this.AD_OVERLAY_PATTERNS.some(
          (pattern) =>
            pattern.test(htmlEl.id) ||
            pattern.test(htmlEl.className.toString()) ||
            (htmlEl.getAttribute('data-ad-slot') !== null)
        );

        // Cek apakah elemen transparan total (opacity sangat rendah + background transparan)
        const opacity = parseFloat(style.opacity);
        const bgColor = style.backgroundColor;
        const isTransparent = (opacity < 0.05 || bgColor === 'rgba(0, 0, 0, 0)') && !hasAdPattern;

        // Cek apakah elemen menutupi seluruh layar tanpa konten bermakna
        const rect = htmlEl.getBoundingClientRect();
        const coversFullPage =
          rect.width > window.innerWidth * 0.9 &&
          rect.height > window.innerHeight * 0.9 &&
          htmlEl.innerText.trim().length === 0 &&
          htmlEl.querySelectorAll('img, video, svg, canvas').length === 0;

        // Hapus hanya jika: (1) ada pola iklan, ATAU (2) transparan + full cover + z-index sangat tinggi
        if (hasAdPattern || (isTransparent && coversFullPage && zIndex > 999999)) {
          htmlEl.remove();
          this.blockedCount += 1;
          if (onElementBlocked) onElementBlocked(this.blockedCount);
        }
      });
    };

    cleanOverlays();

    const observer = new MutationObserver(() => {
      cleanOverlays();
    });

    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true
    });

    return () => {
      observer.disconnect();
    };
  }

  public static getBlockedCount(): number {
    return this.blockedCount;
  }

  /**
   * Fungsi ini dijalankan di MAIN world halaman host (via chrome.scripting
   * dengan world: 'MAIN'). Berjalan di world utama sehingga dapat membungkus
   * window.open milik halaman dan memblokir popup/judol.
   * Catatan: TIDAK boleh mereferensikan variabel di luar fungsinya (harus
   * self-contained agar bisa di-serialize oleh chrome.scripting.executeScript).
   */
  public static readonly pageGuardMainWorld = () => {
    const win = window as unknown as { __pageGuardInstalled?: boolean };
    if (win.__pageGuardInstalled) return;
    win.__pageGuardInstalled = true;

    const GAMBLING_TOKENS = [
      'slot', 'slot88', 'judol', 'judionline', 'gacor', 'sbobet', 'poker88', 'togel',
      'toto', 'maxwin', 'pragmatic', 'casino', 'bet365', 'bandarqq', 'domino99', 'qqslots',
      'judi', 'taruhan', 'bola88', 'mpo888', 'sultanplay'
    ];

    const POPUP_AD_HOSTS = [
      'popads.net', 'propellerads.com', 'monetag.com', 'adsterra.com', 'popunder.net',
      'popcash.net', 'adcash.com', 'popmyclick.com', 'juicyads.com', 'hilltopads.net',
      'onclickpredict.com', 'redirect.hurracloud.com', 'go2cloud.org', 'cplushk.net',
      'gatewayclouds.com', 'ads.spotify', 'click.jirawatch', 'safelink', 'spotify.click',
      'exosrv.com', 'targetpush.com', 'nativepush.com', 'adrotator.se', 'mellowads.com',
      'stickyadstv.com', 'vidmount.com', 'suirtlehub.com', 'noceanrp.com',
      'longtimedomainmap.com', 'shopeefriends', 'ads.vido-cdn', 'vaipromo'
    ];

    // Token generik jaringan iklan/afiliasi/shortener (mencakup Shopee, random, dsb.)
    const AD_TOKEN_RE = /\b(adclick|click|redirect|popunder|affiliate|aff_id|utm_|gclid|fbclid|_ga\b|tracking|utm_source)/i;
    const SHORTENER_HOST_RE = /(bit\.ly|tinyurl\.com|tiny\.cc|short\.io|shorte\.st|cutt\.ly|t\.co|goo\.gl|is\.gd|rb\.gy|s\.id|s\.shopee\.co\.id)/i;

    let blockedCount = 0;

    const isSuspiciousUrl = (url?: string | null, forNewWindow = false): boolean => {
      if (!url) return false;
      const low = String(url).toLowerCase();
      let host = '';
      try {
        host = new URL(low.startsWith('http') ? low : 'http://' + low).hostname;
      } catch {
        host = '';
      }

      if (/^about:blank/i.test(low) || /^javascript:/i.test(low)) return true;

      for (const ad of POPUP_AD_HOSTS) {
        if (host === ad || host.includes(ad)) return true;
      }
      for (const t of GAMBLING_TOKENS) {
        if (host.includes(t) || low.includes(t)) return true;
      }
      if (SHORTENER_HOST_RE.test(host)) return true;
      // Kata-kunci iklan/afiliasi pada path & query
      if (/\/?(click|ad|aff|redirect|go|[0-9]{4,})[\/?]/i.test(low) && AD_TOKEN_RE.test(low)) return true;

      // Heuristik ketat HANYA untuk window.open (popup/popunder): target tab baru
      // ke domain berbeda yang berkonotasi iklan/afiliasi/redirect → blokir tanpa
      // harus menebak nama domain spamnya. Tidak diterapkan pada klik anchor
      // biasa agar tidak menghalangi navigasi sah ke situs eksternal.
      if (forNewWindow && /^https?:\/\//i.test(low) && host !== '' && host !== location.hostname) {
        const path = low.split(/[?#]/)[0] || '';
        if (
          AD_TOKEN_RE.test(low) ||
          /\/(?:go|out|redir|redirect|click|away|exit|banner|offer|ads?|lp|landing|a\/)\b/i.test(path)
        ) {
          return true;
        }
      }

      return false;
    };

    const report = () => {
      try {
        window.postMessage({ type: '__PAGE_GUARD_REPORT__', count: blockedCount }, '*');
      } catch {
        /* ignore */
      }
    };

    const originalOpen = window.open;
    if (typeof originalOpen === 'function') {
      window.open = function (url: string | URL, target?: string, features?: string) {
        if (isSuspiciousUrl(url instanceof URL ? url.href : url, true)) {
          blockedCount += 1;
          report();
          return null;
        }
        return originalOpen.apply(window, arguments as unknown as Parameters<typeof window.open>);
      } as typeof window.open;
    }

    const blockAnchor = (anchor: HTMLAnchorElement): boolean => {
      const href = anchor.getAttribute('href') || '';
      if (!isSuspiciousUrl(href)) return false;
      blockedCount += 1;
      report();
      try {
        anchor.setAttribute('data-guard-blocked', 'true');
        if (anchor.target === '_blank') anchor.removeAttribute('target');
        anchor.style.pointerEvents = 'none';
      } catch {
        /* ignore */
      }
      return true;
    };

    const guardAnchors = () => {
      document.querySelectorAll<HTMLAnchorElement>('a[href][target="_blank"]').forEach((a) => {
        if (a.getAttribute('data-guard-handled') === 'true') return;
        a.setAttribute('data-guard-handled', 'true');
        blockAnchor(a);
      });
    };

    document.addEventListener(
      'click',
      (e) => {
        let el: EventTarget | null = e.target;
        while (el) {
          const node = el as Element | null;
          if (node && node.tagName === 'A' && node.closest('[data-guard-blocked="true"]')) {
            e.preventDefault();
            e.stopImmediatePropagation();
            return;
          }
          el = node ? node.parentElement : null;
        }
      },
      true
    );

    guardAnchors();
    new MutationObserver(guardAnchors).observe(document.documentElement, { childList: true, subtree: true });

    window.addEventListener('message', (event) => {
      if (event.data && event.data.type === '__PAGE_GUARD_REQUEST__') report();
    });
  };

  /**
   * Menginstal pageGuard (MAIN world) di frame ini.
   * 1. Jalur utama: minta background menjalankan chrome.scripting.executeScript
   *    dengan world:'MAIN' — dijamin berjalan walau halaman host memakai CSP ketat
   *    dan tersedia di semua frame (content script berjalan all_frames).
   * 2. Cadangan: injeksi inline <script> untuk situs ber-CSP longgar (guard
   *    __pageGuardInstalled mencegah duplikasi instalasi).
   */
  public static installPageGuard(): void {
    try {
      chrome.runtime.sendMessage({ type: 'INSTALL_PAGE_GUARD' } as ExtensionMessage).catch(() => {});
    } catch {
      /* ignore */
    }

    try {
      const script = document.createElement('script');
      script.textContent = '(' + this.pageGuardMainWorld.toString() + ')();';
      (document.head || document.documentElement).appendChild(script);
      script.remove();
    } catch (err) {
      console.warn('Gagal injeksi pageGuard inline:', err);
    }
  }

  /**
   * Mendengarkan laporan blokade popup/judol dari pageGuard (MAIN world)
   * lalu meneruskan jumlah blokade ke badge ekstensi.
   */
  public static listenPageGuardReports(onBlocked: (count: number) => void): () => void {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window) return;
      const data = event.data as { type?: string; count?: number } | null;
      if (data && data.type === '__PAGE_GUARD_REPORT__' && typeof data.count === 'number') {
        onBlocked(data.count);
      }
    };

    window.addEventListener('message', onMessage);

    return () => {
      window.removeEventListener('message', onMessage);
    };
  }
}
