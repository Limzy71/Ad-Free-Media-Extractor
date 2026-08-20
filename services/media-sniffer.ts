import type { MediaMetadata, MediaMimeType, MediaFormatCategory } from '~/types/media';

/**
 * Service untuk menganalisis URL dan header HTTP guna mengekstrak informasi media
 */
export class MediaSnifferService {
  /**
   * Menentukan format category berdasarkan MIME type atau ekstensi URL
   */
  public static categorizeFormat(mimeType: string, url: string): MediaFormatCategory {
    const lowerMime = mimeType.toLowerCase();
    const lowerUrl = url.toLowerCase().split('?')[0];

    if (
      lowerMime.includes('application/x-mpegurl') ||
      lowerMime.includes('application/vnd.apple.mpegurl') ||
      lowerUrl.endsWith('.m3u8')
    ) {
      return 'HLS';
    }

    if (lowerMime.includes('video/mp4') || lowerUrl.endsWith('.mp4')) {
      return 'MP4';
    }

    if (lowerMime.includes('video/webm') || lowerUrl.endsWith('.webm')) {
      return 'WEBM';
    }

    if (lowerMime.includes('application/dash+xml') || lowerUrl.endsWith('.mpd')) {
      return 'DASH';
    }

    if (lowerMime.includes('audio/mpeg') || lowerMime.includes('audio/mp4') || lowerUrl.endsWith('.mp3')) {
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

    // Abaikan potongan segmen individual (.ts) dari sniffer agar tidak spamming notifikasi
    if (lowerUrl.includes('.ts') && !lowerUrl.includes('.m3u8')) {
      return false;
    }

    // Abaikan video pelacak atau beacon yang sangat kecil (< 50 KB)
    if (contentLength && contentLength < 50 * 1024) {
      return false;
    }

    const validExtensions = ['.mp4', '.webm', '.m3u8', '.mpd'];
    const hasValidExtension = validExtensions.some((ext) =>
      lowerUrl.split('?')[0].endsWith(ext)
    );

    const validMimes = [
      'video/mp4',
      'video/webm',
      'application/x-mpegurl',
      'application/vnd.apple.mpegurl',
      'application/dash+xml'
    ];
    const hasValidMime = validMimes.some((m) => mimeType.toLowerCase().includes(m));

    return hasValidExtension || hasValidMime;
  }

  /**
   * Menghasilkan objek MediaMetadata terstruktur
   */
  public static createMediaMetadata(
    sourceUrl: string,
    pageUrl: string,
    pageTitle: string,
    mimeType: string,
    contentLength?: number
  ): MediaMetadata {
    const formatCategory = this.categorizeFormat(mimeType, sourceUrl);
    const id = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    return {
      id,
      sourceUrl,
      pageUrl,
      pageTitle: pageTitle || 'Video Stream',
      mimeType: mimeType as MediaMimeType,
      formatCategory,
      contentLengthBytes: contentLength,
      detectedAtTimestamp: Date.now(),
      isDrmProtected: mimeType.includes('application/dash+xml') || sourceUrl.includes('widevine')
    };
  }
}
