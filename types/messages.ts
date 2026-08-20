import type { MediaMetadata, StreamDownloadProgress } from './media';
import type { SecurityVerificationResult } from './security';

/**
 * Message Passing Protocol bertipe ketat (Discriminated Unions)
 * Komunikasi antar Service Worker, Content Script, dan Popup
 */
export type ExtensionMessage =
  // Event ketika media terdeteksi oleh Service Worker
  | {
      type: 'MEDIA_DETECTED';
      payload: MediaMetadata;
    }
  // Request daftar media aktif dari tab
  | {
      type: 'GET_TAB_MEDIA_REQUEST';
      payload: { tabId?: number };
    }
  // Respon daftar media aktif
  | {
      type: 'GET_TAB_MEDIA_RESPONSE';
      payload: { mediaList: MediaMetadata[] };
    }
  // Request verifikasi URL
  | {
      type: 'VERIFY_URL_REQUEST';
      payload: { url: string };
    }
  // Respon verifikasi URL
  | {
      type: 'VERIFY_URL_RESPONSE';
      payload: SecurityVerificationResult;
    }
  // Perintah memulai pengunduhan media
  | {
      type: 'START_MEDIA_DOWNLOAD';
      payload: {
        mediaId: string;
        sourceUrl: string;
        filename: string;
        formatCategory: MediaMetadata['formatCategory'];
      };
    }
  // Update progres unduhan stream (HLS)
  | {
      type: 'DOWNLOAD_PROGRESS_UPDATE';
      payload: StreamDownloadProgress;
    }
  // Perintah membuka modal clean player di content script
  | {
      type: 'TRIGGER_CLEAN_PLAYER';
      payload: MediaMetadata;
    };
