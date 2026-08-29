/**
 * Model data representasi metadata berkas media yang terdeteksi
 */
export type MediaMimeType =
  | 'video/mp4'
  | 'video/webm'
  | 'application/x-mpegURL'
  | 'application/vnd.apple.mpegurl'
  | 'application/dash+xml'
  | 'audio/mpeg'
  | 'audio/mp4'
  | 'video/youtube-embed'
  | 'unknown';

export type MediaFormatCategory = 'MP4' | 'WEBM' | 'HLS' | 'DASH' | 'AUDIO' | 'YOUTUBE';

export interface MediaMetadata {
  id: string;
  sourceUrl: string;
  pageUrl: string;
  pageTitle: string;
  mimeType: MediaMimeType;
  formatCategory: MediaFormatCategory;
  resolution?: string; // e.g. '1080p', '720p'
  durationInSeconds?: number;
  contentLengthBytes?: number;
  detectedAtTimestamp: number;
  isDrmProtected?: boolean;
}

export interface StreamDownloadProgress {
  mediaId: string;
  totalSegments: number;
  downloadedSegments: number;
  percentage: number;
  downloadedBytes: number;
  status: 'IDLE' | 'FETCHING_PLAYLIST' | 'DOWNLOADING_SEGMENTS' | 'TRANSMUXING' | 'COMPLETED' | 'FAILED';
  errorMessage?: string;
}
