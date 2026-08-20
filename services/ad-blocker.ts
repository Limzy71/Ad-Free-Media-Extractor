/**
 * Service untuk membersihkan elemen DOM intrusif dan mengonfigurasi declarativeNetRequest
 */
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
}
