import type { MediaMetadata, MediaMimeType, MediaFormatCategory } from '~/types/media';

/**
 * Service untuk menganalisis URL dan header HTTP guna mengekstrak informasi media
 * Dilengkapi dengan HLS Master Manifest parser & sanitasi nama berkas
 */
export class MediaSnifferService {
  /**
   * Menentukan format category berdasarkan MIME type atau ekstensi URL
   */
  public static categorizeFormat(mimeType: string, url: string): MediaFormatCategory {
    const lowerMime = mimeType.toLowerCase();
    const cleanUrl = url.toLowerCase().split('?')[0];

    if (
      lowerMime.includes('application/x-mpegurl') ||
      lowerMime.includes('application/vnd.apple.mpegurl') ||
      cleanUrl.endsWith('.m3u8')
    ) {
      return 'HLS';
    }

    if (lowerMime.includes('video/mp4') || cleanUrl.endsWith('.mp4')) {
      return 'MP4';
    }

    if (lowerMime.includes('video/webm') || cleanUrl.endsWith('.webm')) {
      return 'WEBM';
    }

    if (lowerMime.includes('application/dash+xml') || cleanUrl.endsWith('.mpd')) {
      return 'DASH';
    }

    if (
      lowerMime.includes('audio/mpeg') ||
      lowerMime.includes('audio/mp4') ||
      cleanUrl.endsWith('.mp3') ||
      cleanUrl.endsWith('.aac')
    ) {
      return 'AUDIO';
    }

    return 'MP4';
  }

  /**
   * Memvalidasi apakah URL atau request jaringan memenuhi syarat sebagai stream video valid
   */
  public static isValidMediaStream(
    url: string,
    mimeType: string,
    contentLength?: number
  ): boolean {
    const lowerUrl = url.toLowerCase();

    // Abaikan potongan segmen individual (.ts) dari sniffer agar tidak membanjiri notifikasi
    if (lowerUrl.includes('.ts') && !lowerUrl.includes('.m3u8')) {
      return false;
    }

    // Abaikan audio/video iklan atau beacon pelacak yang sangat kecil (< 50 KB)
    if (contentLength && contentLength < 50 * 1024) {
      return false;
    }

    const validExtensions = ['.mp4', '.webm', '.m3u8', '.mpd', '.mp3', '.aac'];
    const cleanUrl = lowerUrl.split('?')[0];
    const hasValidExtension = validExtensions.some((ext) => cleanUrl.endsWith(ext));

    const validMimes = [
      'video/mp4',
      'video/webm',
      'application/x-mpegurl',
      'application/vnd.apple.mpegurl',
      'application/dash+xml',
      'audio/mpeg',
      'audio/mp4'
    ];
    const hasValidMime = validMimes.some((m) => mimeType.toLowerCase().includes(m));

    return hasValidExtension || hasValidMime;
  }

  /**
   * Membersihkan judul halaman dari kata-kata promosi situs streaming
   */
  public static sanitizeTitle(rawTitle: string): string {
    if (!rawTitle) return 'Video Stream';

    let cleaned = rawTitle
      .replace(/\|.*$/g, '')
      .replace(/-.*(Watch|Stream|Nonton|Free|Download).*$/gi, '')
      .replace(/\[.*?\]/g, '')
      .replace(/\(.*?\)/g, '')
      .trim();

    // Hapus karakter ilegal untuk nama berkas OS
    cleaned = cleaned.replace(/[/\\?%*:|"<>]/g, '_').trim();

    return cleaned || 'Video Stream';
  }

  /**
   * Ekstraksi resolusi dari URL atau estimasi nama (misal: 1080p, 720p, 480p)
   */
  public static extractResolutionFromUrl(url: string): string | undefined {
    const match = url.match(/(2160p|4k|1080p|720p|480p|360p|240p)/i);
    if (match) {
      return match[1].toUpperCase();
    }
    return undefined;
  }

  /**
   * Menghasilkan objek MediaMetadata terstruktur
   */
  public static createMediaMetadata(
    sourceUrl: string,
    pageUrl: string,
    rawTitle: string,
    mimeType: string,
    contentLength?: number
  ): MediaMetadata {
    const formatCategory = this.categorizeFormat(mimeType, sourceUrl);
    const sanitizedTitle = this.sanitizeTitle(rawTitle);
    const resolution = this.extractResolutionFromUrl(sourceUrl);
    const id = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    return {
      id,
      sourceUrl,
      pageUrl,
      pageTitle: sanitizedTitle,
      mimeType: mimeType as MediaMimeType,
      formatCategory,
      resolution,
      contentLengthBytes: contentLength,
      detectedAtTimestamp: Date.now(),
      isDrmProtected:
        mimeType.includes('application/dash+xml') ||
        sourceUrl.includes('widevine') ||
        sourceUrl.includes('fairplay')
    };
  }
}
