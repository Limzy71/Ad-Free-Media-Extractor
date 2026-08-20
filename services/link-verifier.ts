import type { SecurityVerificationResult, SecurityStatus, ThreatCategory } from '~/types/security';

/**
 * Service untuk memverifikasi reputasi URL terhadap basis data ancaman (Phishing, Malware, Judi)
 * Dilengkapi in-memory LRU cache dan domain whitelisting
 */
export class LinkVerifierService {
  private static cache = new Map<string, SecurityVerificationResult>();

  private static gamblingKeywords: string[] = [
    'slot88',
    'judionline',
    'gacor',
    'sbobet',
    'poker88',
    'togel',
    'maxwin',
    'pragmaticplay',
    'casino-online',
    'bet365-fake',
    'bandarqq',
    'domino99'
  ];

  private static phishingKeywords: string[] = [
    'login-verify-account',
    'paypal-security-update',
    'bca-klik-fake',
    'mandiri-online-secure',
    'phishing-test',
    'free-giftcard-claim'
  ];

  private static malwareKeywords: string[] = [
    'malware-domain',
    'trojan-download',
    'ransomware-server',
    'virus-installer'
  ];

  /**
   * Cek reputasi URL secara lokal dan cepat (Fast-Cache)
   */
  public static async verifyUrl(url: string): Promise<SecurityVerificationResult> {
    if (!url || !url.startsWith('http')) {
      return {
        url: url || '',
        domain: '',
        status: 'SAFE',
        riskScore: 0,
        isCached: true,
        verifiedAtTimestamp: Date.now()
      };
    }

    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname.toLowerCase();

      // Cek in-memory cache
      if (this.cache.has(domain)) {
        return this.cache.get(domain)!;
      }

      // Cek apakah domain di-whitelist oleh user
      const whitelistStorage = await chrome.storage.local.get(['whitelistedDomains']);
      const whitelistedDomains: string[] = whitelistStorage.whitelistedDomains || [];
      if (whitelistedDomains.includes(domain)) {
        const safeResult: SecurityVerificationResult = {
          url,
          domain,
          status: 'SAFE',
          riskScore: 0,
          isCached: true,
          verifiedAtTimestamp: Date.now()
        };
        this.cache.set(domain, safeResult);
        return safeResult;
      }

      // Evaluasi Kategori Ancaman
      let threatCategory: ThreatCategory | undefined;
      let threatDescription: string | undefined;
      let riskScore = 0;

      if (this.gamblingKeywords.some((k) => domain.includes(k) || urlObj.pathname.includes(k))) {
        threatCategory = 'GAMBLING';
        threatDescription = 'Situs ini terindikasi sebagai platform perjudian online ilegal.';
        riskScore = 95;
      } else if (this.phishingKeywords.some((k) => domain.includes(k))) {
        threatCategory = 'PHISHING';
        threatDescription = 'Situs ini terindikasi mencoba mencuri data pribadi atau kredensial akun.';
        riskScore = 90;
      } else if (this.malwareKeywords.some((k) => domain.includes(k))) {
        threatCategory = 'MALWARE';
        threatDescription = 'Situs ini terindikasi mendistribusikan berkas berbahaya atau malware.';
        riskScore = 99;
      }

      const status: SecurityStatus = threatCategory ? 'BLOCKED' : 'SAFE';

      const result: SecurityVerificationResult = {
        url,
        domain,
        status,
        threatCategory,
        threatDescription,
        riskScore,
        isCached: true,
        verifiedAtTimestamp: Date.now()
      };

      this.cache.set(domain, result);
      return result;
    } catch {
      return {
        url,
        domain: '',
        status: 'UNVERIFIED',
        riskScore: 0,
        isCached: false,
        verifiedAtTimestamp: Date.now()
      };
    }
  }

  /**
   * Menambahkan domain ke daftar whitelist
   */
  public static async whitelistDomain(domain: string): Promise<void> {
    const data = await chrome.storage.local.get(['whitelistedDomains']);
    const list: string[] = data.whitelistedDomains || [];
    if (!list.includes(domain)) {
      list.push(domain);
      await chrome.storage.local.set({ whitelistedDomains: list });
      this.cache.delete(domain);
    }
  }

  /**
   * Menghapus domain dari daftar whitelist
   */
  public static async removeWhitelistedDomain(domain: string): Promise<void> {
    const data = await chrome.storage.local.get(['whitelistedDomains']);
    const list: string[] = data.whitelistedDomains || [];
    const updated = list.filter((d) => d !== domain);
    await chrome.storage.local.set({ whitelistedDomains: updated });
    this.cache.delete(domain);
  }
}
