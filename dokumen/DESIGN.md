# UI/UX Design Specifications (DESIGN.md)
**Proyek:** Universal Ad-Free Media Extractor  
**Versi:** 1.2 (Production-Grade & State-of-the-Art)  
**Target Platform:** Chromium Browser Extensions (Plasmo MV3) & Web Companion  

---

## 1. Filosofi & Prinsip Utama Desain

*   **Utility-First Pragmatism:** Antarmuka memprioritaskan kecepatan aksi dan efisiensi fungsi. Tidak ada elemen visual dekoratif yang memberatkan rendering peramban (*zero-bloat rendering*).
*   **Shadow DOM Encapsulation:** Seluruh komponen yang disuntikkan ke halaman (*Injected Overlay* & *Floating Action Widget*) wajib berada di dalam **Shadow Root**. Hal ini menjamin 100% isolasi gaya sehingga tidak ada class Tailwind yang merusak atau terdistorsi oleh CSS situs web host.
*   **Aksesibilitas & Keyboard-First (A11y):** Setiap tombol aksi dan kontrol video dapat dioperasikan secara penuh melalui keyboard tanpa memerlukan mouse.
*   **Dark Mode Native Support:** Menyesuaikan secara otomatis dengan preferensi tema sistem peramban pengguna (`prefers-color-scheme`) untuk kenyamanan visual saat menonton di lingkungan redup.

---

## 2. Token Visual & Desain Sistem (Tailwind CSS v4.1)

### 2.1. Tipografi & Font Stack
Font dispesifikasikan menggunakan *system font stack* berkinerja tinggi agar tidak memerlukan unduhan webfont eksternal ke dalam Shadow DOM:
*   **Font Family:** `font-sans` (`system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`)
*   **Hierarki Teks:**
    *   *Modal Title / Page Header:* `text-lg font-semibold tracking-tight`
    *   *Section Title / Subhead:* `text-sm font-semibold tracking-normal`
    *   *Body / Description:* `text-sm font-normal leading-relaxed`
    *   *Badges / Captions / Timestamps:* `text-xs font-medium tracking-wide`

### 2.2. Palet Warna Semantik (Light & Dark Mode)

| Token Semantik | Light Mode Class | Dark Mode Class | Peruntukan |
| :--- | :--- | :--- | :--- |
| **Primary Action** | `bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white` | `dark:bg-blue-500 dark:hover:bg-blue-600 text-white` | Tombol Putar, Unduh, Aksi Utama |
| **Danger / Threat** | `bg-red-600 hover:bg-red-700 text-white` | `dark:bg-red-600 dark:hover:bg-red-700 text-white` | Halaman Peringatan, Situs Berbahaya/Judi |
| **Success / Safe** | `bg-emerald-600 text-white` | `dark:bg-emerald-500 text-white` | Indikator URL Aman, Status Bersih |
| **Warning / Notice**| `bg-amber-500 text-white` | `dark:bg-amber-400 dark:text-zinc-950` | Notifikasi DRM, Stream Terbatas |
| **Surface Base** | `bg-white text-zinc-900 border-zinc-200` | `dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-800` | Latar Belakang Popup Panel & Kartu |
| **Surface Muted**| `bg-zinc-50 text-zinc-600` | `dark:bg-zinc-800/60 dark:text-zinc-400` | Latar Belakang Item List & Input |
| **Backdrop Blur** | `bg-black/80 backdrop-blur-md` | `bg-black/85 backdrop-blur-md` | Overlay Layar Penuh Clean Player |

### 2.3. Sistem Layering & Z-Index Tokens
Untuk mencegah benturan penumpukan (*z-index fighting*) dengan situs web pihak ketiga:
*   `z-toast: 9999999` : Notifikasi Toast melayang di atas segalanya.
*   `z-modal: 999999` : Modal Clean Player layar penuh.
*   `z-widget: 99999` : Tombol aksi mengambang (*Floating Action Badge*).

---

## 3. Spesifikasi Tata Letak Komponen (*Layouts*)

```
+-------------------------------------------------------------+
| POPUP EXTENSION (360px x 480px)                             |
| +---------------------------------------------------------+ |
| | [Shield Icon] Domain: example-stream.com   [Toggle ON]  | | <- Header Status
| +---------------------------------------------------------+ |
| | [Check Icon] 14 Iklan & Tracker Dibersihkan             | | <- Ad-block Stats
| +---------------------------------------------------------+ |
| | MEDIA TERDETEKSI (2)                                    | |
| | +-----------------------------------------------------+ | |
| | | [Video Icon] Episode 1 - Main Stream                | | | <- Media Card 1
| | | 1080p • HLS (.m3u8) • 24:15                         | | |
| | | [ Tombol Putar Bersih ]   [ Tombol Unduh ]          | | |
| | +-----------------------------------------------------+ | |
| | | [Video Icon] Trailer Teaser                         | | | <- Media Card 2
| | | 720p • Direct MP4                                   | | |
| | | [ Tombol Putar Bersih ]   [ Tombol Unduh ]          | | |
| | +-----------------------------------------------------+ | |
| +---------------------------------------------------------+ |
+-------------------------------------------------------------+
```

### 3.1. Popup Panel Extension (`360px` x `480px`)
*   **Dimensi:** Lebar tetap `360px`, tinggi `480px`, dengan `overflow-hidden flex flex-col`.
*   **Header:** 
    *   Tinggi `56px`, `px-4 py-3 border-b flex items-center justify-between`.
    *   Memuat indikator status perisai domain (Hijau = Aman, Merah = Berbahaya) dan toggle aktif/nonaktif per situs.
*   **Body Content (Scrollable):**
    *   `flex-1 overflow-y-auto p-4 space-y-3`.
    *   Menampilkan ringkasan statistik pemblokiran dan daftar kartu media yang terdeteksi (*Media Item Cards*).
*   **Footer:**
    *   `px-4 py-2.5 border-t text-xs flex justify-between items-center text-zinc-500 bg-zinc-50 dark:bg-zinc-900/50`.

---

### 3.2. Floating Action Widget (Suntikan Shadow DOM pada Sudut Halaman)
*   **Posisi:** `fixed bottom-6 right-6 z-[99999]`.
*   **Visual:** Kapsul modern dengan efek elevasi tinggi:
    ```html
    <div class="flex items-center gap-2.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-2xl cursor-pointer transition-transform duration-150 hover:scale-105 select-none font-sans text-sm font-medium">
      <svg class="w-4 h-4 animate-pulse" ...><!-- Video Icon --></svg>
      <span>Video Terdeteksi</span>
      <span class="bg-blue-800 text-xs px-2 py-0.5 rounded-full font-bold">1</span>
    </div>
    ```

---

### 3.3. Injected Clean Player Modal (Adaptif Multi-Aspek Rasio)
*   **Kontainer Luar:** `fixed inset-0 z-[999999] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 sm:p-6`.
*   **Adaptabilitas Rasio Layar:**
    *   **Lanskap Standar (16:9):** `max-w-5xl w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl relative border border-white/10`.
    *   **Vertikal / Shorts / TikTok (9:16):** `max-h-[85vh] aspect-[9/16] bg-black rounded-2xl overflow-hidden shadow-2xl relative border border-white/10`.
*   **Floating Control Bar:** 
    *   `absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent px-4 py-3 flex flex-col gap-2 transition-opacity duration-300`.
    *   Garis waktu (*Seek Bar*): Slider halus dengan efek hover preview waktu.
    *   Baris Tombol: Tombol Putar/Jeda, Indikator Durasi, Volume Slider, Pemilih Kecepatan (0.5x–2x), Tombol Download Cepat, dan Fullscreen.

---

### 3.4. Red Warning Interstitial Page (`warning.html`)
*   Layar penuh pengalihan instan: `min-h-screen bg-zinc-950 flex items-center justify-center p-6 text-white font-sans`.
*   **Kartu Peringatan:** `max-w-lg w-full bg-red-950/50 border border-red-500/40 rounded-3xl p-8 backdrop-blur-xl shadow-2xl flex flex-col items-center text-center gap-5`.
*   **Hierarki Aksi:**
    *   *Tombol Primer (Aman):* `w-full py-3.5 bg-white text-zinc-950 font-bold rounded-xl hover:bg-zinc-200 transition-colors` $\rightarrow$ Kembali ke halaman sebelumnya.
    *   *Tombol Sekunder (Bypass Berisiko):* `text-xs text-zinc-400 hover:text-zinc-200 underline mt-2` $\rightarrow$ "Lanjutkan ke situs berisiko (Tidak disarankan)".

---

## 4. Spesifikasi Komponen & State UX

### 4.1. Media Item Card (Pada Popup List)
Setiap video yang terdeteksi dirender dalam kartu terstruktur:
*   `p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/50 flex flex-col gap-2.5`.
*   **Header Kartu:** Judul video (terpotong elipsis jika panjang), Badge format (`MP4` / `HLS`), Badge resolusi (`1080p`, `720p`).
*   **Aksi Kartu:** 2 tombol sejajar (`flex gap-2`):
    *   Tombol *"Nonton Bersih"*: `flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5`.
    *   Tombol *"Unduh"*: `flex-1 py-1.5 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-900 dark:text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5`.

---

### 4.2. Loading & Progress State (Penggabungan Segmen HLS)
*   Ketika mengunduh stream HLS `.m3u8`, tombol bertransformasi menjadi bar progres interaktif:
    *   Container: `relative overflow-hidden bg-blue-900 text-white rounded-lg py-2 px-3 text-xs font-semibold text-center select-none`.
    *   Progress Fill: `absolute inset-y-0 left-0 bg-blue-600 transition-all duration-150` (lebar dinamis sesuai persentase segmen yang telah digabung).
    *   Label teks: *"Menggabungkan segmen... 68% (124/182 MB)"*.

---

### 4.3. Empty State (Tidak Ada Media Terdeteksi)
*   Ditampilkan di dalam popup ketika tab aktif tidak memuat file media:
    *   Ikon: Perisai abu-abu lembut dengan garis putus-putus.
    *   Judul: *"Tidak Ada Media Terdeteksi"* (`text-sm font-semibold text-zinc-700 dark:text-zinc-300`).
    *   Keterangan: *"Jelajahi halaman atau putar video untuk memicu ekstraksi media otomatis."* (`text-xs text-zinc-500 dark:text-zinc-400 mt-1 text-center`).

---

### 4.4. Error & DRM Fallback State
*   Jika video terproteksi enkripsi Widevine DRM atau link kadaluarsa:
    *   Kotak Banner: `p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/50 flex items-start gap-3 text-xs text-amber-900 dark:text-amber-200`.
    *   Pesan: *"Video ini menggunakan enkripsi DRM berlisensi atau token sesi telah kadaluarsa. Silakan putar langsung melalui pemutar asli situs."*

---

## 5. Aksesibilitas & Pemetaan Pintasan Keyboard (*Hotkeys*)

Seluruh tombol interaktif memiliki selektor fokus keyboard yang jelas: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2`.

Saat modal **Clean Player** sedang aktif, tombol keyboard berikut otomatis terpetakan:

| Tombol Keyboard | Aksi Pemutar Video |
| :--- | :--- |
| **`Space`** atau **`K`** | Putar / Jeda (*Toggle Play/Pause*) |
| **`Esc`** | Menutup Modal Clean Player & Mengembalikan Fokus |
| **`F`** | Masuk / Keluar Layar Penuh (*Toggle Fullscreen*) |
| **`M`** | Bisukan / Bunyikan Suara (*Toggle Mute*) |
| **`Arrow Left` (`←`)** / **`J`** | Mundur 5 detik / 10 detik |
| **`Arrow Right` (`→`)** / **`L`** | Maju 5 detik / 10 detik |
| **`Arrow Up` (`↑`)** | Naikkan volume sebesar 5% |
| **`Arrow Down` (`↓`)** | Turunkan volume sebesar 5% |
| **`0` – `9`** | Melompat ke persentase durasi video (0% s/d 90%) |

---

## 6. Sistem Notifikasi Toast (*Instant Feedback*)

Komponen notifikasi mengambang ringkas disuntikkan ke pojok kanan atas layar (`fixed top-5 right-5 z-[9999999] flex flex-col gap-2 pointer-events-none`) untuk memberikan konfirmasi visual instan kepada pengguna:

```tsx
// Toast Success
<div class="pointer-events-auto flex items-center gap-2.5 px-4 py-3 bg-zinc-900/95 dark:bg-zinc-800/95 text-white border border-zinc-700/50 rounded-xl shadow-2xl text-xs font-medium backdrop-blur-md animate-slide-in">
  <span class="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
  <span>Unduhan "Episode 1.mp4" telah dimulai.</span>
</div>
```

*   **Auto-dismiss:** Otomatis menghilang setelah 3.5 detik dengan transisi memudar (*fade-out*).
*   **Tipe Pesan:**
    *   *Success:* Konfirmasi mulai unduh & verifikasi aman.
    *   *Info:* Notifikasi stream sedang diproses/transmuxing.
    *   *Error:* Peringatan kegagalan akses media dengan tombol coba lagi.
