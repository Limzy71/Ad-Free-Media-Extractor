import type { SecurityVerificationResult, ThreatCategory } from '~/types/security';

const BACKEND_API_URL = 'http://127.0.0.1:8000/api';

interface BackendVerifyResponse {
  status: string;
  data: {
    url: string;
    domain: string;
    is_safe: boolean;
    threat_category: string | null;
    risk_score: number;
  };
}

const THREAT_MAP: Record<string, ThreatCategory> = {
  gambling: 'GAMBLING',
  phishing: 'PHISHING',
  malware: 'MALWARE'
};

const THREAT_DESCRIPTIONS: Record<ThreatCategory, string> = {
  GAMBLING: 'Situs ini terindikasi sebagai platform perjudian online ilegal.',
  PHISHING: 'Situs ini terindikasi mencoba mencuri data pribadi atau kredensial akun.',
  MALWARE: 'Situs ini terindikasi mendistribusikan berkas berbahaya atau malware.',
  CLICKJACKING: 'Situs ini terindikasi menggunakan teknik clickjacking.',
  SUSPICIOUS: 'Situs ini terindikasi mencurigakan.'
};

/**
 * Service untuk memverifikasi reputasi URL terhadap basis data ancaman (Phishing, Malware, Judi)
 * Strategi: Local Fast-Cache → Backend API → Local Keyword Fallback
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
   * Cek reputasi URL dengan strategi berlapis: cache → backend → fallback lokal
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

      // Layer 1: In-memory cache
      if (this.cache.has(domain)) {
        return this.cache.get(domain)!;
      }

      // Layer 1b: Whitelist check
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

      // Layer 2: Backend API
      const backendResult = await this.verifyViaBackend(url, domain);
      if (backendResult !== null) {
        this.cache.set(domain, backendResult);
        return backendResult;
      }

      // Layer 3: Local keyword fallback (offline / backend unreachable)
      const fallbackResult = this.verifyLocally(url, domain);
      this.cache.set(domain, fallbackResult);
      return fallbackResult;
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
   * Verifikasi URL melalui backend API (dengan timeout singkat)
   */
  private static async verifyViaBackend(
    url: string,
    domain: string
  ): Promise<SecurityVerificationResult | null> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(`${BACKEND_API_URL}/v1/verify-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) return null;

      const json: BackendVerifyResponse = await response.json();
      if (json.status !== 'success') return null;

      const { data } = json;
      const threatCategory = data.threat_category
        ? THREAT_MAP[data.threat_category] ?? undefined
        : undefined;

      return {
        url: data.url,
        domain: data.domain,
        status: data.is_safe ? 'SAFE' : 'BLOCKED',
        threatCategory,
        threatDescription: threatCategory ? THREAT_DESCRIPTIONS[threatCategory] : undefined,
        riskScore: data.risk_score,
        isCached: false,
        verifiedAtTimestamp: Date.now()
      };
    } catch {
      // Backend unreachable — fall through to local fallback
      return null;
    }
  }

  /**
   * Verifikasi lokal berbasis keyword (fallback saat backend tidak tersedia)
   */
  private static verifyLocally(url: string, domain: string): SecurityVerificationResult {
    let threatCategory: ThreatCategory | undefined;
    let threatDescription: string | undefined;
    let riskScore = 0;

    if (this.gamblingKeywords.some((k) => domain.includes(k) || url.includes(k))) {
      threatCategory = 'GAMBLING';
      threatDescription = THREAT_DESCRIPTIONS.GAMBLING;
      riskScore = 95;
    } else if (this.phishingKeywords.some((k) => domain.includes(k) || url.includes(k))) {
      threatCategory = 'PHISHING';
      threatDescription = THREAT_DESCRIPTIONS.PHISHING;
      riskScore = 90;
    } else if (this.malwareKeywords.some((k) => domain.includes(k) || url.includes(k))) {
      threatCategory = 'MALWARE';
      threatDescription = THREAT_DESCRIPTIONS.MALWARE;
      riskScore = 99;
    }

    return {
      url,
      domain,
      status: threatCategory ? 'BLOCKED' : 'SAFE',
      threatCategory,
      threatDescription,
      riskScore,
      isCached: false,
      verifiedAtTimestamp: Date.now()
    };
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
