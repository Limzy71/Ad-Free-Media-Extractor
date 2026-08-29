/**
 * Service DNS-over-HTTPS (DoH) untuk membypass pemblokiran DNS tingkat ISP (Internet Positif / NXDOMAIN)
 * Menggunakan Google Public DoH & Cloudflare 1.1.1.1 JSON API
 */
export class DohResolverService {
  /**
   * Memeriksa apakah domain valid di internet global meskipun diblokir oleh DNS lokal ISP
   */
  public static async resolveDomainDoH(domain: string): Promise<{ isAlive: boolean; ip?: string }> {
    const cleanDomain = domain.replace(/^https?:\/\//i, '').split('/')[0].split(':')[0];

    // 1. Coba Google DoH
    try {
      const res = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(cleanDomain)}&type=A`);
      if (res.ok) {
        const data = await res.json();
        if (data.Status === 0 && data.Answer && data.Answer.length > 0) {
          return { isAlive: true, ip: data.Answer[0].data };
        }
      }
    } catch {}

    // 2. Coba Cloudflare DoH (1.1.1.1)
    try {
      const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(cleanDomain)}&type=A`, {
        headers: { Accept: 'application/dns-json' }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.Status === 0 && data.Answer && data.Answer.length > 0) {
          return { isAlive: true, ip: data.Answer[0].data };
        }
      }
    } catch {}

    return { isAlive: false };
  }

  /**
   * Menghasilkan URL Proxy Media Backend untuk membypass pembatasan ISP/CORS
   */
  public static getBackendProxyUrl(targetUrl: string, referer?: string): string {
    const backendBase = 'http://127.0.0.1:8000/api/v1/proxy-media';
    const params = new URLSearchParams({ media_url: targetUrl });
    if (referer) {
      params.set('referer', referer);
    }
    return `${backendBase}?${params.toString()}`;
  }
}