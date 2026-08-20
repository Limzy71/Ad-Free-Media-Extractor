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
   * Scoring kualitas stream berdasarkan URL dan contentLength.
   * Semakin tinggi score = semakin baik kualitasnya.
   * Digunakan untuk menggantikan entry resolusi rendah yang sudah tersimpan.
   */
  public static qualityScore(url: string, contentLength?: number): number {
    let score = 0;
    const lower = url.toLowerCase();

    // Bonus dari indikator resolusi eksplisit di URL
    if (lower.includes('2160p') || lower.includes('4k')) score += 4000;
    else if (lower.includes('1080p') || lower.includes('fhd')) score += 3000;
    else if (lower.includes('720p') || lower.includes('hd')) score += 2000;
    else if (lower.includes('480p') || lower.includes('sd')) score += 1000;
    else if (lower.includes('360p') || lower.includes('240p')) score += 100;

    // Bonus dari label kualitas di path/query
    if (lower.includes('/high/') || lower.includes('quality=high')) score += 500;
    if (lower.includes('/medium/') || lower.includes('quality=medium')) score += 250;
    if (lower.includes('/low/') || lower.includes('quality=low')) score -= 500;

    // Bonus dari ukuran file (contentLength sebagai proxy kualitas)
    if (contentLength) {
      score += Math.round(contentLength / (1024 * 1024)); // +1 per MB
    }

    return score;
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

    // YouTube exclusion — Chrome Web Store policy compliance
    if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) {
      return false;
    }

    // Abaikan potongan segmen individual (.ts) dari sniffer agar tidak membanjiri notifikasi
    const urlPath = lowerUrl.split('?')[0];
    if (urlPath.endsWith('.ts')) {
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
