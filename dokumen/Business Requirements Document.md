# Business Requirements Document (BRD)
**Proyek:** Universal Ad-Free Media Extractor  
**Versi Dokumen:** 1.1 (Final Refined)  
**Status:** Approved for Technical Implementation  

---

## 1. Ringkasan Eksekutif
*Universal Ad-Free Media Extractor* adalah ekstensi peramban (*browser extension*) modern berbasis Chromium (Google Chrome, Microsoft Edge, Brave, Opera) yang mengintegrasikan tiga kebutuhan esensial pengguna internet dalam satu alur kerja terpadu:
1. **Keamanan Tautan (*Link Security*):** Melindungi pengguna dari phishing, malware, dan tautan judi online.
2. **Kenyamanan Berselancar (*Ad & Clutter-Free*):** Menghilangkan pop-up, pop-under, banner agresif, dan script pelacak.
3. **Ekstraksi & Unduhan Media (*Universal Media Downloader*):** Menyediakan pemutar video bersih bebas gangguan serta fitur pengunduhan media lintas platform.

---

## 2. Masalah Bisnis & Peluang Pasar (*Problem Statement*)
* **Fragmentasi Ekstensi:** Pengguna internet awam saat ini terpaksa memasang 3–4 ekstensi terpisah (Ad-Blocker, Antivirus/URL Verifier, Video Downloader, dan Video Player enhancer). Hal ini meningkatkan konsumsi memori RAM browser secara signifikan dan memperlambat kinerja peramban.
* **Tingginya Risiko Kejahatan Siber pada Situs Media:** Situs penyedia streaming video pihak ketiga sering dipenuhi dengan iklan jebakan (*click-bait*), *invisible click overlays*, *redirects* ke situs judi online, serta malware unduhan palsu.
* **Pengalaman Pengguna yang Buruk:** Pengguna sering kesulitan membedakan tombol unduh asli dengan tombol iklan tipuan (*fake download buttons*).

---

## 3. Tujuan Bisnis (*Business Objectives*)
1. Menyediakan solusi satu pintu (*all-in-one unified workflow*) yang ringan, aman, dan mudah digunakan tanpa konfigurasi rumit bagi pengguna awam.
2. Menjamin privasi pengguna dengan prinsip *Zero Data Retention* (tanpa penyimpanan data penjelajahan/identitas pengguna).
3. Membangun basis pengguna loyal melalui reliabilitas ekstraksi video dan pemblokiran konten berbahaya dengan *zero-lag browsing experience*.

---

## 4. Proposisi Nilai (*Value Proposition & USP*)
* **3-in-1 Frictionless Protection:** Mengamankan, membersihkan, dan mengekstrak media secara instan tanpa perlu berpindah aplikasi atau tab.
* **Clean Injected Player:** Menampilkan pemutar video bawaan HTML5 murni yang terisolasi dari skrip pelacak atau pop-up situs asal.
* **Privacy-First & Lightweight:** Berjalan secara *stateless* tanpa database pengguna, dengan konsumsi memori rendah berkat arsitektur Manifest V3.

---

## 5. Target Pengguna & Persona (*Target Audience*)
* **Pengguna Internet Umum (Primer):** Konsumen konten video harian yang menginginkan kemudahan menonton dan mengunduh video tanpa khawatir terkena virus, phishing, atau jebakan judi.
* **Pelajar & Peneliti (Sekunder):** Pengguna yang membutuhkan pengarsipan berkas video/audio edukasi secara cepat dan bebas gangguan iklan.

---

## 6. Cakupan Proyek (*Project Scope*)

### A. In-Scope (MVP & Fase 1)
* Ekstensi browser berbasis Manifest V3 untuk peramban keluarga Chromium (Chrome, Edge, Brave).
* Deteksi dan pemblokiran URL berbahaya/judi sebelum halaman dimuat.
* Pembersihan elemen iklan intrusif (pop-under, overlay tembus pandang, banner iklan).
* Ekstraksi URL video langsung (`.mp4`, `.webm`) dan streaming (`.m3u8` / HLS).
* Pemutar video mandiri (*Clean Player*) terisolasi dalam Shadow DOM.
* Pengunduhan video langsung ke penyimpanan lokal pengguna.
* Backend companion ringan (Laravel 12) untuk enkapsulasi API Key keamanan dan fallback CORS proxy.

### B. Out-of-Scope (Fase Selanjutnya)
* Dukungan untuk browser non-Chromium (Mozilla Firefox & Apple Safari) akan dikembangkan pada Fase 2.
* *Bypass* proteksi DRM berlisensi ketat (seperti Widevine Level 1/PlayReady pada Netflix/Spotify). Ekstensi akan memberikan notifikasi ramah bahwa konten terproteksi DRM.
* Akun keanggotaan pengguna (*User Account / Cloud Library*).

---

## 7. Model Monetisasi & Keberlanjutan (*Monetization Strategy*)
Menerapkan pendekatan monetisasi etis tanpa kompromi privasi data pengguna:
1. **Donasi Komunitas (Open Collective / Buy Me a Coffee / GitHub Sponsors).**
2. **Fitur Opsional Masa Depan (Freemium):** Akses konversi transcode video resolusi tinggi (*server-side ultra fast HLS-to-MP4 converter*) atau integrasi cloud storage pribadi.

---

## 8. Indikator Kinerja Utama (*KPI & Success Metrics*)

| Metrik | Target MVP |
| :--- | :--- |
| **Akurasi Pemblokiran URL Berbahaya** | > 98% terhadap daftar blacklist uji coba |
| **Tingkat Keberhasilan Ekstraksi Media** | > 90% pada situs-situs video non-DRM standar |
| **Dampak Latensi Penjelajahan** | < 50 ms penambahan waktu muat halaman |
| **Penggunaan Memori Ekstensi** | < 40 MB saat memutar media |
| **Tingkat Crash/Error Ekstensi** | < 0.5% dari total sesi penjelajahan |

---

## 9. Analisis Risiko & Mitigasi Bisnis

| Risiko | Dampak | Strategi Mitigasi |
| :--- | :--- | :--- |
| **Kebijakan Chrome Web Store (Larangan Download YouTube)** | Ekstensi ditolak di CWS | Mengaktifkan *domain exclusion* untuk YouTube pada distribusi resmi Chrome Web Store, serta menyediakan panduan instalasi mandiri untuk fitur penuh jika diperlukan. |
| **Perubahan Struktur DOM Situs Video Sumber** | Ekstraktor gagal mendeteksi video | Media Sniffer dibangun pada level intersepsi jaringan (*network request sniffer*), bukan bergantung pada selektor DOM yang rapuh. |
| **Biaya API Pihak Ketiga** | Biaya operasional meningkat | Menerapkan *Local Caching* (IndexedDB/Chrome Storage) pada ekstensi untuk domain yang telah diverifikasi sehingga meminimalkan panggilan API ke server. |
