/**
 * Model data verifikasi keamanan URL dan kategori ancaman siber
 */
export type ThreatCategory = 'PHISHING' | 'MALWARE' | 'GAMBLING' | 'CLICKJACKING' | 'SUSPICIOUS';

export type SecurityStatus = 'SAFE' | 'WARNING' | 'BLOCKED' | 'UNVERIFIED';

export interface SecurityVerificationResult {
  url: string;
  domain: string;
  status: SecurityStatus;
  threatCategory?: ThreatCategory;
  threatDescription?: string;
  riskScore: number; // 0 (100% Safe) to 100 (Extremely Dangerous)
  isCached: boolean;
  verifiedAtTimestamp: number;
}

export interface DomainSecurityConfig {
  domain: string;
  isWhitelisted: boolean;
  adBlockEnabled: boolean;
  snifferEnabled: boolean;
}
