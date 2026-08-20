import muxjs from 'mux.js';
import type { StreamDownloadProgress } from '~/types/media';

/**
 * Service untuk mengunduh berkas media langsung (.mp4, .webm) atau
 * mengekstrak, mengunduh segmen HLS (.m3u8), dan mentransmux menjadi berkas .mp4 tunggal via mux.js
 */
export class DownloaderService {
  /**
   * Mengunduh berkas statis (MP4/WebM) menggunakan API Browser Downloads
   */
  public static async downloadDirectMedia(
    url: string,
    filename: string
  ): Promise<number> {
    return new Promise((resolve, reject) => {
      const sanitizedFilename = filename
        .replace(/[/\\?%*:|"<>]/g, '_')
        .trim();

      chrome.downloads.download(
        {
          url,
          filename: sanitizedFilename || 'video.mp4',
          saveAs: false
        },
        (downloadId) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(downloadId);
          }
        }
      );
    });
  }

  /**
   * Mengunduh playlist HLS (.m3u8), mengambil seluruh segmen .ts secara paralel terkontrol,
   * mentransmux segmen MPEG-TS menjadi file MP4 murni via mux.js, lalu menyimpannya ke disk
   */
  public static async downloadHlsStream(
    m3u8Url: string,
    rawFilename: string,
    onProgress?: (progress: StreamDownloadProgress) => void
  ): Promise<void> {
    const notifyProgress = (
      status: StreamDownloadProgress['status'],
      downloadedSegments: number,
      totalSegments: number,
      percentage: number,
      downloadedBytes: number,
      errorMessage?: string
    ) => {
      if (onProgress) {
        onProgress({
          mediaId: m3u8Url,
          totalSegments,
          downloadedSegments,
          percentage,
          downloadedBytes,
          status,
          errorMessage
        });
      }
    };

    try {
      // 1. Ambil playlist m3u8 utama (Master / Media Playlist)
      notifyProgress('FETCHING_PLAYLIST', 0, 100, 5, 0);

      const playlistResponse = await fetch(m3u8Url);
      if (!playlistResponse.ok) {
        throw new Error(`Gagal mengambil playlist HLS (Status: ${playlistResponse.status})`);
      }

      let playlistText = await playlistResponse.text();
      let mediaPlaylistUrl = m3u8Url;

      // Cek apakah ini Master Playlist (berisi varian sub-stream)
      if (playlistText.includes('#EXT-X-STREAM-INF')) {
        const variantUrl = this.extractHighestQualityVariantUrl(playlistText, m3u8Url);
        if (variantUrl) {
          mediaPlaylistUrl = variantUrl;
          const subRes = await fetch(variantUrl);
          if (subRes.ok) {
            playlistText = await subRes.text();
          }
        }
      }

      // 2. Ekstraksi daftar URL seluruh segmen .ts
      const segmentUrls = this.parseSegmentUrls(playlistText, mediaPlaylistUrl);
      if (segmentUrls.length === 0) {
        throw new Error('Tidak ada segmen media .ts yang ditemukan di dalam playlist HLS.');
      }

      const totalSegments = segmentUrls.length;
      notifyProgress('DOWNLOADING_SEGMENTS', 0, totalSegments, 10, 0);

      // 3. Unduh seluruh segmen secara asinkron dengan batas konkurensi (Concurrency = 3)
      const tsSegments: Uint8Array[] = new Array(totalSegments);
      let downloadedSegments = 0;
      let totalDownloadedBytes = 0;
      const concurrencyLimit = 3;

      const downloadSegment = async (index: number): Promise<void> => {
        const segUrl = segmentUrls[index];
        const res = await fetch(segUrl);
        if (!res.ok) {
          throw new Error(`Gagal mengunduh segmen #${index + 1} (${res.status})`);
        }
        const buffer = await res.arrayBuffer();
        const uint8 = new Uint8Array(buffer);
        tsSegments[index] = uint8;

        downloadedSegments += 1;
        totalDownloadedBytes += uint8.byteLength;

        // Progress unduhan berbobot 10% s.d. 80%
        const downloadPercent = Math.round(10 + (downloadedSegments / totalSegments) * 70);
        notifyProgress(
          'DOWNLOADING_SEGMENTS',
          downloadedSegments,
          totalSegments,
          downloadPercent,
          totalDownloadedBytes
        );
      };

      // Eksekusi download dalam antrian chunk
      for (let i = 0; i < totalSegments; i += concurrencyLimit) {
        const chunk: Promise<void>[] = [];
        for (let j = i; j < Math.min(i + concurrencyLimit, totalSegments); j++) {
          chunk.push(downloadSegment(j));
        }
        await Promise.all(chunk);
      }

      // 4. Transmuxing MPEG-TS Segments -> MP4 ISO BMFF via mux.js
      notifyProgress('TRANSMUXING', totalSegments, totalSegments, 85, totalDownloadedBytes);

      const mp4Blob = await this.transmuxTsToMp4(tsSegments);

      // 5. Simpan berkas MP4 ke disk pengguna
      notifyProgress('COMPLETED', totalSegments, totalSegments, 100, mp4Blob.size);

      const targetFilename = this.formatMp4Filename(rawFilename);
      const downloadUrl = await this.createDownloadUrlFromBlob(mp4Blob);

      await this.downloadDirectMedia(downloadUrl, targetFilename);

      // Bersihkan blob URL jika didukung
      if (downloadUrl.startsWith('blob:') && typeof URL.revokeObjectURL === 'function') {
        setTimeout(() => {
          URL.revokeObjectURL(downloadUrl);
        }, 15000);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Gagal mengunduh dan menggabungkan stream HLS.';
      notifyProgress('FAILED', 0, 0, 0, 0, message);
      throw new Error(message);
    }
  }

  /**
   * Menemukan URL varian playlist dengan bitrate / kualitas tertinggi pada Master Manifest
   */
  private static extractHighestQualityVariantUrl(masterText: string, baseUrl: string): string | null {
    const lines = masterText.split('\n');
    let highestBandwidth = -1;
    let bestVariantUri = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('#EXT-X-STREAM-INF:')) {
        const bandwidthMatch = line.match(/BANDWIDTH=(\d+)/);
        const bandwidth = bandwidthMatch ? parseInt(bandwidthMatch[1], 10) : 0;

        // URL varian biasanya berada di baris setelah tag STREAM-INF
        const nextLine = lines[i + 1]?.trim();
        if (nextLine && !nextLine.startsWith('#')) {
          if (bandwidth > highestBandwidth) {
            highestBandwidth = bandwidth;
            bestVariantUri = nextLine;
          }
        }
      }
    }

    if (bestVariantUri) {
      return new URL(bestVariantUri, baseUrl).href;
    }

    return null;
  }

  /**
   * Mem-parsing URI segmen dari Media Playlist M3U8
   */
  private static parseSegmentUrls(playlistText: string, baseUrl: string): string[] {
    const lines = playlistText.split('\n');
    const segmentUrls: string[] = [];

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;

      // Baris adalah URI segmen
      try {
        const absoluteUrl = new URL(line, baseUrl).href;
        segmentUrls.push(absoluteUrl);
      } catch {
        // Abaikan URI tidak valid
      }
    }

    return segmentUrls;
  }

  /**
   * Menggabungkan dan mentransmux array segmen TS menjadi Blob MP4 menggunakan mux.js
   */
  private static async transmuxTsToMp4(tsSegments: Uint8Array[]): Promise<Blob> {
    return new Promise((resolve) => {
      try {
        const transmuxer = new muxjs.mp4.Transmuxer({ keepOriginalTimestamps: true });
        let initSegment: Uint8Array | null = null;
        const mp4Segments: Uint8Array[] = [];

        transmuxer.on('data', (segment) => {
          if (!initSegment && segment.initSegment) {
            initSegment = segment.initSegment;
          }
          if (segment.data) {
            mp4Segments.push(segment.data);
          }
        });

        transmuxer.on('done', () => {
          try {
            if (initSegment) {
              const combinedChunks: BlobPart[] = [
                initSegment as unknown as BlobPart,
                ...mp4Segments.map((s) => s as unknown as BlobPart)
              ];
              resolve(new Blob(combinedChunks, { type: 'video/mp4' }));
            } else {
              resolve(new Blob(tsSegments.map((s) => s as unknown as BlobPart), { type: 'video/mp4' }));
            }
          } finally {
            transmuxer.dispose();
          }
        });

        // Masukkan seluruh segmen TS ke pipeline transmuxer
        for (const ts of tsSegments) {
          if (ts && ts.length > 0) {
            transmuxer.push(ts);
          }
        }

        transmuxer.flush();
      } catch {
        // Fallback: kembalikan raw TS segments sebagai blob (mungkin tidak playable)
        resolve(new Blob(tsSegments.map((s) => s as unknown as BlobPart), { type: 'video/mp4' }));
      }
    });
  }

  /**
   * Menghasilkan URL unduh dari Blob yang kompatibel dengan browser extension
   */
  private static async createDownloadUrlFromBlob(blob: Blob): Promise<string> {
    if (typeof URL.createObjectURL === 'function') {
      try {
        return URL.createObjectURL(blob);
      } catch {
        // Fallback jika dibatasi di environment Service Worker tertentu
      }
    }

    throw new Error('URL.createObjectURL tidak tersedia. Unduhan dibatalkan.');
  }

  /**
   * Menstandarkan nama file dengan ekstensi .mp4
   */
  private static formatMp4Filename(rawFilename: string): string {
    let clean = rawFilename
      .replace(/[/\\?%*:|"<>]/g, '_')
      .replace(/[\x00-\x1f]/g, '')
      .replace(/\.+$/, '')
      .replace(/\.(m3u8|ts|webm)$/i, '')
      .trim();

    const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
    const baseName = clean.split('.')[0]?.toUpperCase() ?? '';
    if (reservedNames.includes(baseName)) {
      clean = `_${clean}`;
    }

    if (!clean.toLowerCase().endsWith('.mp4')) {
      clean = `${clean}.mp4`;
    }

    return clean;
  }
}
