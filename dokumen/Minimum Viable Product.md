# Minimum Viable Product (MVP) Specification
**Proyek:** Universal Ad-Free Media Extractor  
**Versi:** 1.1 (Final Refined)  
**Tujuan Dokumen:** Menetapkan batasan fungsional, prioritas modul, dan kriteria penyelesaian (*Definition of Done*) untuk rilis perdana (MVP).

---

## 1. Matriks Prioritas Fitur (MoSCoW Framework)

| Kategori | Fitur / Modul | Deskripsi Singkat |
| :--- | :--- | :--- |
| **Must-Have (Wajib)** | **Smart Link Verifier** | Mencegat URL navigasi & menampilkan halaman peringatan merah jika terindikasi berbahaya/judi. |
| **Must-Have (Wajib)** | **Universal Ad-Blocker Core** | Memblokir pop-up, pop-under, dan overlay klik tembus pandang berbasis aturan EasyList ringkas. |
| **Must-Have (Wajib)** | **Media Sniffer (Network-based)** | Menangkap URL media `.mp4`, `.webm`, dan stream `.m3u8` secara otomatis dari lalu lintas jaringan. |
| **Must-Have (Wajib)** | **Clean Player & Injected UI** | Injeksi overlay tombol "Unduh" & "Nonton Bersih" via Shadow DOM + Pemutar HTML5 mandiri. |
| **Must-Have (Wajib)** | **Direct Video Downloader** | Pengunduhan berkas media `.mp4`/`.webm` menggunakan browser Downloads API. |
| **Should-Have (Penting)** | **HLS Stream Segment Merger** | Penggabungan segmen `.ts` dari playlist `.m3u8` menjadi satu berkas `.mp4` utuh sebelum diunduh. |
| **Should-Have (Penting)** | **Laravel 12 Companion API** | Backend proxy untuk mengamankan API key verifikasi URL dan bypass CORS media. |
| **Could-Have (Opsional)** | **Audio Extractor (`.mp3`)** | Opsi mengunduh trek audio saja dari video yang terdeteksi. |
| **Won't-Have (Fase 2+)** | **User Account & Cloud Sync** | Tidak ada sistem login, database pengguna, atau penyimpanan video di cloud pada versi MVP. |

---

## 2. Rincian Modul Inti MVP

### Modul 1: Pemindai Keamanan (*Smart Link Verifier*)
* **Prioritas:** `Must-Have`
* **Input:** URL tujuan pada event navigasi peramban (`onBeforeNavigate`).
* **Mekanisme Kerja:**
  1. Ekstensi mengecek domain target pada *Local Fast-Cache* (Chrome Storage / LRU Cache).
  2. Jika belum ada di cache, ekstensi mengirim permintaan verifikasi ke endpoint backend Laravel (`POST /api/v1/verify-link`).
  3. Jika terdeteksi sebagai situs judi, malware, atau phishing:
     - Navigasi dibatalkan/dialihkan secara instan ke halaman internal: `chrome-extension://.../warning.html`.
     - Pengguna diberikan opsi: *"Tinggalkan Halaman (Direkomendasikan)"* atau *"Lanjutkan dengan Risiko Sendiri (Bypass)"*.
* **Output:** Status keamanan URL (Safe / Malicious / Gambling) + Tindakan mitigasi.

---

### Modul 2: Pembersih Iklan & DOM (*Universal Ad-Blocker Core*)
* **Prioritas:** `Must-Have`
* **Input:** Permintaan web (*Network Requests*) dan struktur DOM halaman web aktif.
* **Mekanisme Kerja:**
  1. **Layer 1 (Network Level):** Menerapkan aturan statis `chrome.declarativeNetRequest` berbasis EasyList untuk memblokir script iklan, banner provider, dan tracker sebelum dimuat.
  2. **Layer 2 (DOM Cleanup):** Content script membersihkan elemen anti-klik (*transparent clickjacking overlays*) dan pop-under trigger yang tersisa pada halaman.
* **Output:** Halaman web yang bersih dari iklan agresif, siap untuk konsumsi media.

---

### Modul 3: Ekstraktor Media Jaringan (*Media Sniffer*)
* **Prioritas:** `Must-Have`
* **Input:** Aliran header respons jaringan (*Network Response Headers & URLs*) pada tab aktif.
* **Mekanisme Kerja:**
  1. Background Service Worker memantau request jaringan dengan tipe `media` atau URL yang berakhiran ekstensi `.mp4`, `.webm`, `.m3u8`, atau mengandung MIME-type `video/*`, `application/vnd.apple.mpegurl`.
  2. Menyaring file video pendek/iklan (misal video < 5 detik atau audio ringkas) agar tidak memicu deteksi palsu.
  3. Mengirim pesan (*message passing*) ke Content Script tab terkait berisi: URL media, resolusi (jika ada), format MIME, dan judul halaman.
* **Output:** Metadata berkas media yang valid dan siap diekstraksi.

---

### Modul 4: Pemutar Bersih & Pengunduh (*Clean Player & Downloader*)
* **Prioritas:** `Must-Have` & `Should-Have`
* **Input:** Metadata berkas media dari *Media Sniffer*.
* **Mekanisme Kerja:**
  1. **Injected Action Overlay:** Tombol mengambang (*floating widget*) disuntikkan secara dinamis di samping elemen video atau di pojok kanan bawah halaman menggunakan **Shadow DOM** (menjamin isolasi CSS Tailwind v4).
  2. **Clean Player Modal:** Saat tombol *"Nonton Tanpa Iklan"* diklik, muncul modal pemutar video HTML5 murni yang terintegrasi dengan pustaka `hls.js` untuk stream `.m3u8`.
  3. **Downloader Engine:**
     - **Berkas Statis (`.mp4`, `.webm`):** Diunduh langsung melalui `chrome.downloads.download()`.
     - **Berkas Streaming (`.m3u8`):** Segmen `.ts` diunduh secara sekuensial dan digabungkan menjadi file `.mp4` melalui pustaka penggabung segmen (*stream merger*) di sisi klien / backend proxy.
* **Output:** Pemutaran media 100% bebas iklan dan berkas video tersimpan di folder *Downloads* pengguna.

---

### Modul 5: Backend Companion (*Laravel 12 API*)
* **Prioritas:** `Should-Have`
* **Input:** Payload JSON dari ekstensi peramban.
* **Mekanisme Kerja:**
  1. Menyediakan endpoint aman untuk komunikasi dengan API pihak ketiga (Google Safe Browsing / PhishTank / URLHaus) tanpa mengekspos API Key ke client ekstensi.
  2. Menyediakan utilitas proxy streaming ringan untuk menangani *CORS error* ketika browser klien mencoba mengambil video dari domain yang melarang cross-origin request.
* **Output:** Response JSON terstruktur (status validasi keamanan) dan Stream data video.

---

## 3. Kriteria Penyelesaian (*Definition of Done - DoD*) untuk MVP

Sebuah fitur MVP dinyatakan **selesai (Done)** jika memenuhi kriteria berikut:
1. **Fungsionalitas Teruji:** Lolos uji coba mandiri pada minimal 10 situs video non-DRM umum dan 5 link simulasi phishing/malware.
2. **Isolasi UI Sempurna:** Tampilan overlay widget tidak merusak layout situs web host dan tidak rusak oleh CSS situs web host (terverifikasi menggunakan Shadow DOM).
3. **Performa Stabil:** Waktu deteksi video di bawah 500 ms setelah halaman mulai memuat media.
4. **Tanpa Error di Console:** Tidak ada kebocoran error tak tertangani (*unhandled promise rejections*) pada Service Worker maupun Content Script.
5. **Kepatuhan Manifest V3:** Seluruh fungsionalitas mematuhi aturan keamanan Manifest V3 tanpa penggunaan `eval()` atau remote code execution yang dilarang.
