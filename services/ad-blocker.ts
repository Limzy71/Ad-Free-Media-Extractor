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
   * Memulai pembersihan proaktif elemen anti-klik dan overlay iklan pada halaman web
   */
  public static initDomSanitizer(onElementBlocked?: (count: number) => void): () => void {
    const cleanOverlays = () => {
      const allDivs = document.querySelectorAll('div, iframe, a[target="_blank"]');

      allDivs.forEach((el) => {
        const htmlEl = el as HTMLElement;
        const style = window.getComputedStyle(htmlEl);

        const isHighZIndex = parseInt(style.zIndex, 10) > 9999;
        const isFixedOrAbsolute = style.position === 'fixed' || style.position === 'absolute';
        const isTransparent = parseFloat(style.opacity) < 0.1 || style.backgroundColor === 'rgba(0, 0, 0, 0)';

        const isFullCover =
          htmlEl.offsetWidth > window.innerWidth * 0.7 &&
          htmlEl.offsetHeight > window.innerHeight * 0.7 &&
          htmlEl.innerText.trim().length === 0;

        if (isHighZIndex && isFixedOrAbsolute && (isTransparent || isFullCover)) {
          if (!htmlEl.id?.includes('plasmo') && !htmlEl.tagName.toLowerCase().includes('plasmo')) {
            htmlEl.remove();
            this.blockedCount += 1;
            if (onElementBlocked) onElementBlocked(this.blockedCount);
          }
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
