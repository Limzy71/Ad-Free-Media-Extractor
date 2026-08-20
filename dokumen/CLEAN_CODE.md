# Clean Code & Engineering Standards (CLEAN_CODE.md)
**Proyek:** Universal Ad-Free Media Extractor  
**Tech Stack:** TypeScript, React, Plasmo (Manifest V3), Tailwind CSS v4, Laravel 12 (PHP 8.3+)  
**Tujuan Dokumen:** Menetapkan standar penulisan kode, arsitektur perangkat lunak, dan konvensi proyek agar kode tetap bersih, mudah dirawat (*maintainable*), mudah diuji (*testable*), dan bebas dari *technical debt*.

---

## 1. Prinsip Utama Rekayasa Perangkat Lunak

*   **KISS (Keep It Simple, Stupid):** Hindari over-engineering. Buat solusi yang paling sederhana dan efektif untuk memecahkan masalah.
*   **DRY (Don't Repeat Yourself):** Abstraksikan logika berulang (seperti normalisasi URL, penanganan pesan lintas komponen ekstensi, format error response) ke dalam modul utilitas terpusat.
*   **Single Responsibility Principle (SRP):** Setiap modul, fungsi, class, atau komponen React hanya boleh memiliki **satu alasan untuk berubah**.
    *   *Service Worker:* Hanya mengelola event jaringan, lifecycle ekstensi, dan message routing.
    *   *Content Script:* Hanya mengelola interaksi DOM dan penyuntikan UI Shadow DOM.
    *   *UI Components:* Hanya mengelola presentasi dan interaksi pengguna.
    *   *Media Downloader:* Hanya mengelola orkestrasi unduhan berkas dan transmuxing stream.

---

## 2. Standar Penulisan TypeScript & Ekstensi (Plasmo MV3)

### 2.1. Strict Type Safety (Hindari `any`)
*   Selalu definisikan tipe data (*Interfaces / Types*) secara eksplisit untuk setiap model data (metadata media, payload pesan antar-script, respon API).
*   **Dilarang keras menggunakan tipe `any`**. Gunakan `unknown` jika tipe data dinamis dan lakukan *type narrowing* dengan *type guards*.

```typescript
// ❌ Buruk (Anti-pattern)
function handleMedia(data: any) {
  console.log(data.url);
}

// ✅ Baik (Clean & Type-safe)
export interface MediaMetadata {
  id: string;
  sourceUrl: string;
  mimeType: 'video/mp4' | 'video/webm' | 'application/x-mpegURL';
  title: string;
  durationInSeconds?: number;
  quality?: string;
}

export function handleMedia(media: MediaMetadata): void {
  console.log(`Detected media: ${media.title} (${media.sourceUrl})`);
}
```

### 2.2. Message Passing Protocol yang Terstruktur
Komunikasi antara `background.ts`, `content.ts`, dan `popup.tsx` harus menggunakan format pesan bertipe kuat (*Discriminated Unions*):

```typescript
// types/messages.ts
export type ExtensionMessage =
  | { type: 'VERIFY_URL_REQUEST'; payload: { url: string } }
  | { type: 'VERIFY_URL_RESPONSE'; payload: { isSafe: boolean; threatCategory?: string } }
  | { type: 'MEDIA_DETECTED'; payload: MediaMetadata }
  | { type: 'START_DOWNLOAD'; payload: { mediaId: string; targetUrl: string; filename: string } };

// Penggunaan aman pada runtime:
chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
  switch (message.type) {
    case 'VERIFY_URL_REQUEST':
      // TypeScript akan otomatis mengenali payload.url
      verifyUrl(message.payload.url).then(sendResponse);
      return true; // Keep channel open for async response
    case 'MEDIA_DETECTED':
      renderFloatingBadge(message.payload);
      break;
  }
});
```

### 2.3. Asynchronous Safety & Cleanup
*   Selalu gunakan `async/await` daripada *nested promise callbacks* (*callback hell*).
*   Gunakan blok `try/catch` pada setiap operasi asynchronous I/O (jaringan, chrome storage, downloads).
*   Pastikan event listener yang dibuat di dalam React components selalu dibersihkan pada fungsi *cleanup* `useEffect`.

```typescript
// ✅ Clean async cleanup di React Content Script
useEffect(() => {
  const messageListener = (msg: ExtensionMessage) => {
    if (msg.type === 'MEDIA_DETECTED') {
      setMediaList((prev) => [...prev, msg.payload]);
    }
  };

  chrome.runtime.onMessage.addListener(messageListener);

  return () => {
    chrome.runtime.onMessage.removeListener(messageListener);
  };
}, []);
```

---

## 3. Standar Komponen UI & React (Tailwind v4)

*   **Pemisahan Container vs Presentational Components:** Pisahkan logika ekstraksi/fetch dari komponen tampilan tombol atau pemutar video.
*   **Shadow DOM Encapsulation:** Pastikan styling Tailwind selalu disuntikkan ke dalam Shadow Root:
    ```tsx
    // content/OverlayWidget.tsx
    import cssText from "data-text:~style.css";
    import type { PlasmoGetStyle } from "plasmo";

    export const getStyle: PlasmoGetStyle = () => {
      const style = document.createElement("style");
      style.textContent = cssText;
      return style;
    };
    ```
*   **Komponen Kecil & Fokus:** Batasi panjang berkas komponen maksimal 150-200 baris. Jika lebih panjang, pecah menjadi sub-komponen (misal: `PlayerControls.tsx`, `ProgressBar.tsx`, `VolumeSlider.tsx`).

---

## 4. Standar Backend Companion (Laravel 12 Clean Code)

### 4.1. Single Responsibility Controllers & Form Requests
*   Controller tidak boleh memuat logika bisnis berat (*Fat Controller Anti-pattern*).
*   Gunakan **Form Request** untuk validasi data input.
*   Gunakan **Service Classes / Actions** untuk eksekusi logika verifikasi URL dan proxy media.

```php
// app/Http/Controllers/Api/V1/VerifyLinkController.php
namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\VerifyLinkRequest;
use App\Services\Security\UrlVerificationService;
use Illuminate\Http\JsonResponse;

class VerifyLinkController extends Controller
{
    public function __construct(
        protected UrlVerificationService $verificationService
    ) {}

    public function __invoke(VerifyLinkRequest $request): JsonResponse
    {
        $result = $this->verificationService->verify($request->validated('url'));

        return response()->json([
            'status' => 'success',
            'data'   => $result,
        ]);
    }
}
```

### 4.2. DTO (Data Transfer Objects) untuk Integritas Respon
*   Hindari mengembalikan data array asosiatif acak dari Service. Gunakan objek DTO yang jelas untuk menjamin konsistensi kontrak API.

---

## 5. Konvensi Penamaan (*Naming Conventions*)

| Elemen | Konvensi | Contoh |
| :--- | :--- | :--- |
| **Folder / Direktori** | `kebab-case` | `services/media-extractor/`, `components/ui/` |
| **Berkas Komponen React** | `PascalCase` | `CleanPlayerModal.tsx`, `FloatingBadge.tsx` |
| **Berkas Utilitas / Skrip** | `camelCase` atau `kebab-case` | `streamMerger.ts`, `urlVerifier.ts` |
| **Interfaces / Types** | `PascalCase` | `MediaMetadata`, `VerificationResult` |
| **Fungsi & Variabel** | `camelCase` | `extractMediaUrl()`, `isMaliciousDomain` |
| **Konstanta Global** | `SCREAMING_SNAKE_CASE` | `MAX_CACHE_EXPIRY_MS`, `DEFAULT_TIMEOUT_SEC` |
| **Class PHP & Interface** | `PascalCase` | `UrlVerificationService`, `MediaProxyService` |
| **Method PHP** | `camelCase` | `verifyUrl()`, `streamToClient()` |

---

## 6. Penanganan Error & Logging (*Defensive Programming*)

1. **User-Facing Error vs Internal Log:**
   * Pengguna tidak boleh melihat kode error teknis seperti `TypeError: Cannot read properties of undefined`.
   * Berikan pesan ramah di UI (*"Gagal mengambil video. Silakan muat ulang halaman"*).
   * Cetak detail teknis di konsol pengembang hanya pada mode pengembangan (`process.env.NODE_ENV === 'development'`).
2. **Graceful Degradation:**
   * Jika backend companion Laravel sedang tidak dapat dijangkau (offline / server down), ekstensi **tidak boleh crash**. Ekstensi harus tetap menjalankan pemblokiran iklan lokal berbasis `declarativeNetRequest` dan membiarkan penjelajahan berlanjut dengan peringatan pasif.
3. **No Uncaught Rejections:**
   * Semua promise yang dieksekusi di background worker wajib memiliki handler `.catch()` atau dibungkus `try/catch`.

---

## 7. Checklist Kualitas Kode (Pre-Commit / PR)

Sebelum mengajukan perubahan kode (*pull request / push*):
* [ ] **Linter & Formatter:** Kode lolos pengecekan `eslint` dan diformat menggunakan `prettier` tanpa error.
* [ ] **Type Check:** `npx tsc --noEmit` berhasil tanpa komplain tipe data.
* [ ] **No Dead Code:** Tidak ada `console.log` sisa debug, berkas usang, atau variabel yang tidak digunakan (*unused variables*).
* [ ] **Scoped Styling:** Pastikan tidak ada class styling global yang bocor ke luar Shadow DOM.
* [ ] **Security Review:** Pastikan tidak ada API Key rahasia yang tertulis langsung (*hardcoded*) di dalam kode klien ekstensi.
