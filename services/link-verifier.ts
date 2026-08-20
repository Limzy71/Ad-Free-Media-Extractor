import type { SecurityVerificationResult, SecurityStatus } from '~/types/security';

/**
 * Service untuk memverifikasi reputasi URL terhadap basis data ancaman (Phishing, Malware, Judi)
 */
export class LinkVerifierService {
  private static localBlacklist: string[] = [
    'slot88',
    'judionline',
    'gacor',
    'phishing-test',
    'malware-domain',
    'sbobet-fake'
  ];

  /**
   * Cek reputasi URL secara lokal dan cepat (Fast-Cache)
   */
  public static async verifyUrl(url: string): Promise<SecurityVerificationResult> {
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname.toLowerCase();

      // 1. Pengecekan terhadap daftar lokal cepat
      const isBlacklisted = this.localBlacklist.some((keyword) => domain.includes(keyword));

      if (isBlacklisted) {
        return {
          url,
          domain,
          status: 'BLOCKED',
          threatCategory: 'GAMBLING',
          threatDescription: 'Situs ini terindikasi sebagai platform perjudian atau situs berbahaya.',
          riskScore: 95,
          isCached: true,
          verifiedAtTimestamp: Date.now()
        };
      }

      // 2. Default Safe jika tidak ada pola berbahaya
      return {
        url,
        domain,
        status: 'SAFE',
        riskScore: 0,
        isCached: true,
        verifiedAtTimestamp: Date.now()
      };
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
}
