# Implementation Roadmap & Development Guide (ROADMAP.md)
**Proyek:** Universal Ad-Free Media Extractor  
**Versi:** 1.0 (Master Execution Plan)  
**Status Proyek:** Siap Dieksekusi (*Ready for Development*)  

---

## 1. Referensi Dokumen Proyek
Sebelum memulai atau saat mengerjakan setiap tahapan, selalu rujuk dokumen spesifikasi berikut:
* ðŸ“„ [Business Requirements Document.md](file:///D:/Download%20video/Business%20Requirements%20Document.md) â€” *Latar belakang bisnis, target audiens, dan KPI produk.*
* ðŸ“„ [Dokumen PRD.md](file:///D:/Download%20video/Dokumen%20PRD.md) â€” *Master PRD & arsitektur teknis sistem menyeluruh.*
* ðŸ“„ [Minimum Viable Product.md](file:///D:/Download%20video/Minimum%20Viable%20Product.md) â€” *Matriks prioritas fitur MoSCoW & Definition of Done.*
* ðŸŽ¨ [DESIGN.md](file:///D:/Download%20video/DESIGN.md) â€” *Spesifikasi desain UI/UX, token Tailwind CSS v4, Dark Mode, dan Hotkeys.*
* ðŸ’» [CLEAN_CODE.md](file:///D:/Download%20video/CLEAN_CODE.md) â€” *Standar Clean Code, strict TypeScript, penanganan error, dan konvensi penamaan.*

---

## 2. Tabel Pelacak Progres (*Progress Tracker*)

| Fase | Fokus Modul | Status | Target Keluaran |
| :--- | :--- | :---: | :--- |
| **Fase 1** | Inisialisasi Plasmo, TypeScript & Tailwind CSS v4 | `[x] Selesai` | Struktur proyek ekstensi siap build & style terisolasi |
| **Fase 2** | Background Service Worker & Media Sniffer | `[x] Selesai` | Penangkapan URL video MP4, WebM, M3U8 dari network |
| **Fase 3** | Injected UI (Shadow DOM) & Clean Player Modal | `[ ] Belum Mulai` | Floating action badge & pemutar HTML5 + `hls.js` |
| **Fase 4** | Popup Extension Panel & Multi-Media Cards | `[ ] Belum Mulai` | Panel popup interaktif dengan Dark Mode & daftar video |
| **Fase 5** | Smart Link Verifier & Red Warning Page | `[ ] Belum Mulai` | Pencegatan URL phishing/judi & halaman `warning.html` |
| **Fase 6** | Universal Ad-Blocker Core (DNR & DOM Cleaner) | `[ ] Belum Mulai` | Pemblokiran iklan banner, pop-under, & overlay anti-klik |
| **Fase 7** | Downloader Engine & HLS Segment Merger | `[ ] Belum Mulai` | Unduhan langsung MP4 & penggabungan segmen HLS `.ts` |
| **Fase 8** | Backend Companion (Laravel 12 API) | `[ ] Belum Mulai` | Proxy CORS media & enkapsulasi API keamanan |
| **Fase 9** | Pengujian Komprehensif & Build Rilis | `[ ] Belum Mulai` | Paket ekstensi teruji bebas bug untuk distribusi |

---

## 3. Rincian Langkah Eksekusi Per Fase

### ðŸš€ **Fase 1: Inisialisasi Proyek & Setup Lingkungan**
*   [x] Inisialisasi proyek browser extension menggunakan Plasmo Framework (Manifest V3) dengan template React & TypeScript.
*   [x] Konfigurasi Tailwind CSS v4 untuk mendukung injeksi styling berbasis **Shadow DOM** (`plasmo:csui`).
*   [x] Siapkan struktur direktori standar sesuai [CLEAN_CODE.md](file:///D:/Download%20video/dokumen/CLEAN_CODE.md) (`contents/`, `popup/`, `components/`, `services/`, `types/`).
*   [x] Konfigurasi `manifest.json` permissions (`declarativeNetRequest`, `webRequest`, `webNavigation`, `downloads`, `storage`, `activeTab`, `scripting`).
*   *Kriteria Selesai:* Ekstensi dapat di-build (`npm run build` / `npm run dev`) dan dimuat ke Chrome Developer Mode tanpa error.

---

### ðŸŽ¯ **Fase 2: Background Service Worker & Media Sniffer Engine**
*   [x] Definisikan TypeScript interfaces untuk `MediaMetadata` dan `ExtensionMessage` di `types/`.
*   [x] Buat `background.ts` untuk memantau request jaringan via `chrome.webRequest.onHeadersReceived`.
*   [x] Implementasikan filter penangkap stream (MIME types: `video/mp4`, `video/webm`, `application/x-mpegURL`, `application/vnd.apple.mpegurl`).
*   [x] Saring video durasi sangat pendek / iklan pelacak agar tidak memicu deteksi palsu.
*   [x] Buat sistem *message passing* aman ke Content Script tab terkait saat media baru terdeteksi.
*   *Kriteria Selesai:* Membuka situs streaming uji coba berhasil mendeteksi dan mencatat URL video asli di konsol background.

---

### ðŸŽ¬ **Fase 3: Injected UI (Shadow DOM) & Clean Player Modal**
*   [ ] Buat Content Script UI (`content/index.tsx`) dengan Plasmo Shadow DOM root.
*   [ ] Implementasikan **Floating Action Badge** di sudut kanan bawah dengan efek transisi hover sesuai [DESIGN.md](file:///D:/Download%20video/DESIGN.md).
*   [ ] Buat komponen **Clean Player Modal** berbasis HTML5 murni yang terintegrasi dengan pustaka `hls.js` untuk memutar stream `.m3u8`.
*   [ ] Tambahkan custom floating control bar (Play/Pause, Seekbar, Volume, Fullscreen).
*   [ ] Implementasikan seluruh pintasan keyboard (*Hotkeys*: `Space`, `Esc`, `F`, `M`, `â†`/`â†’`, `â†‘`/`â†“`).
*   [ ] Buat komponen **Toast Notification** melayang untuk umpan balik instan ke pengguna.
*   *Kriteria Selesai:* Mengklik floating badge membuka modal player bersih yang memutar video tanpa iklan atau pop-up situs host.

---

### ðŸ“± **Fase 4: Popup Extension Panel & Multi-Media Cards**
*   [ ] Buat antarmuka `popup/index.tsx` berukuran `360px x 480px` dengan dukungan **Native Dark Mode**.
*   [ ] Bangun komponen **Header Status**: Perisai keamanan domain aktif & toggle proteksi per-situs (*whitelist*).
*   [ ] Bangun komponen **Media Item Card List**: Menampilkan thumbnail, badge resolusi, format (`MP4`/`HLS`), dan tombol aksi cepat (*"Nonton Bersih"* & *"Unduh"*).
*   [ ] Bangun komponen **Empty State**: Ilustrasi ramah saat tab tidak memuat video.
*   *Kriteria Selesai:* Mengklik ikon ekstensi di toolbar menampilkan popup yang sinkron dengan daftar video di tab aktif.

---

### ðŸ›¡ï¸ **Fase 5: Smart Link Verifier & Red Warning Page**
*   [ ] Buat modul pencegat URL pada event `chrome.webNavigation.onBeforeNavigate`.
*   [ ] Implementasikan *Local Fast-Cache* (IndexedDB / Chrome Storage) untuk menyimpan domain aman/berbahaya.
*   [ ] Buat halaman peringatan internal `warning.html` dengan latar merah gelap, informasi ancaman, dan tombol kembali ke halaman aman.
*   [ ] Tambahkan opsi bypass berisiko (*Proceed anyway*) jika pengguna memaksa membuka link.
*   *Kriteria Selesai:* Membuka tautan uji coba situs judi/malware langsung dialihkan ke halaman `warning.html` sebelum situs termuat.

---

### ðŸ§¹ **Fase 6: Universal Ad-Blocker Core (DNR & DOM Cleaner)**
*   [ ] Susun rulesets statis `chrome.declarativeNetRequest` berbasis EasyList untuk memblokir tracker dan banner iklan pihak ketiga.
*   [ ] Buat skrip pembersih DOM di Content Script untuk proaktif mendeteksi dan menghapus layer transparan anti-klik (*clickjacking invisible overlays*).
*   [ ] Sediakan penghitung (*counter*) jumlah iklan/tracker yang berhasil dibersihkan pada Popup Panel.
*   *Kriteria Selesai:* Menjelajah situs streaming video uji coba bebas dari pop-under atau tab baru yang terbuka sendiri saat area video diklik.

---

### ðŸ“¥ **Fase 7: Downloader Engine & HLS Segment Merger**
*   [ ] Implementasikan pengunduhan direct stream (`.mp4`, `.webm`) menggunakan `chrome.downloads.download()`.
*   [ ] Integrasikan pustaka penggabung segmen stream (`mux.js` / TS downloader) untuk stream `.m3u8`:
    *   Mengunduh berkas index playlist `.m3u8`.
    *   Mengunduh seluruh segmen `.ts` secara asinkron sekuensial.
    *   Menggabungkan dan mentransmux segmen menjadi file `.mp4` utuh di browser.
*   [ ] Tampilkan status progres unduhan (*dynamic progress bar*) pada tombol dan notifikasi Toast.
*   *Kriteria Selesai:* Mengunduh video `.m3u8` menghasilkan file `.mp4` utuh yang dapat diputar secara offline di pemutar media komputer.

---

### ðŸŒ **Fase 8: Backend Companion (Laravel 12 API)**
*   [ ] Setup proyek Laravel 12 di environment lokal menggunakan Laravel Herd on Windows.
*   [ ] Buat controller & endpoint `POST /api/v1/verify-link` (terkoneksi ke Google Safe Browsing / PhishTank API dengan secret key aman).
*   [ ] Buat endpoint `POST /api/v1/proxy-media` untuk menangani pembatasan CORS saat browser klien mem-fetch stream video.
*   [ ] Terapkan caching Redis/File pada backend untuk verifikasi URL agar response time < 50ms.
*   *Kriteria Selesai:* Ekstensi dapat memanggil endpoint backend Laravel untuk verifikasi tautan dan bypass CORS secara transparan.

---

### ðŸ§ª **Fase 9: Pengujian Komprehensif, Optimasi & Packaging**
*   [ ] Pengujian stabilitas memori (memastikan Service Worker tetap di bawah batas memori 40 MB).
*   [ ] Uji coba kompatibilitas pada minimal 10 situs penyedia video non-DRM.
*   [ ] Validasi kepatuhan Manifest V3 & aturan kebijakan Chrome Web Store (penerapan *domain exclusion* untuk YouTube).
*   [ ] Eksekusi `npm run build` untuk menghasilkan bundel zip rilis final siap instalasi.
*   *Kriteria Selesai:* Paket rilis lolos seluruh kriteria di [Minimum Viable Product.md](file:///D:/Download%20video/Minimum%20Viable%20Product.md) (*Definition of Done*).
