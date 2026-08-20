# AI AGENTS & ASSISTANT DIRECTIVE (AGENTS.md)
**Project:** Universal Ad-Free Media Extractor  
**Repository Root:** `d:\Download video`  

---

## ⚠️ MANDATORY INSTRUCTION FOR ALL AI ASSISTANTS & AGENTS

Setiap kali Anda (AI Agent / Assistant) berinteraksi, menganalisis, atau menulis kode di dalam repository ini, **ANDA WAJIB MEMBACA DAN MEMATUHI 6 DOKUMEN SPESIFIKASI UTAMA** yang berada di dalam direktori `dokumen/`:

1. 📄 **[Business Requirements Document.md](file:///D:/Download%20video/dokumen/Business%20Requirements%20Document.md)**
   * Berisi konteks bisnis, proposisi nilai (3-in-1 tool), target audiens, dan KPI produk.
2. 📄 **[Dokumen PRD.md](file:///D:/Download%20video/dokumen/Dokumen%20PRD.md)**
   * **Master PRD:** Arsitektur sistem menyeluruh, penanganan stream HLS (`.m3u8`), isolasi Shadow DOM, dan spesifikasi REST API backend Laravel 12.
3. 📄 **[Minimum Viable Product.md](file:///D:/Download%20video/dokumen/Minimum%20Viable%20Product.md)**
   * Batasan fitur MVP berbasis MoSCoW, spesifikasi I/O tiap modul, dan *Definition of Done (DoD)*.
4. 🎨 **[DESIGN.md](file:///D:/Download%20video/dokumen/DESIGN.md)**
   * Spesifikasi desain UI/UX, token Tailwind CSS v4, Dark Mode, Hotkeys keyboard (`Space`, `Esc`, `F`, `M`), responsive aspect ratios (16:9 & 9:16), serta sistem notifikasi Toast.
5. 💻 **[CLEAN_CODE.md](file:///D:/Download%20video/dokumen/CLEAN_CODE.md)**
   * Standar penulisan kode bersih, strict TypeScript (larangan penggunaan `any`), protokol *Message Passing* bertipe kuat, standar arsitektur Service Worker & Content Script, konvensi penamaan, dan penanganan error.
6. 🗺️ **[ROADMAP.md](file:///D:/Download%20video/dokumen/ROADMAP.md)**
   * Rencana tahapan eksekusi dari Fase 1 hingga Fase 9 beserta checklist pelacak progres.

---

## 🛠️ CORE ENGINEERING RULES FOR AI AGENTS

1. **Strict Type Safety:** Dilarang menggunakan tipe data `any` pada TypeScript. Selalu buat tipe/interface eksplisit di direktori `types/`.
2. **Shadow DOM Isolation:** Seluruh komponen UI yang disuntikkan ke halaman target (*Content Script*) **wajib** menggunakan Shadow DOM (`plasmo:csui` mode Shadow Root) agar styling Tailwind CSS tidak merusak/dirusak situs host.
3. **Stateless Extension:** Ekstensi tidak menyimpan database riwayat penjelajahan pengguna (*Zero-data retention & privacy-first*).
4. **Clean Code & SRP:** Pisahkan dengan tegas logika Service Worker, Content Script, UI Components, dan API Service.
5. **No Regressions:** Pastikan setiap perubahan kode baru tidak merusak fungsionalitas fase-fase yang sudah selesai di [ROADMAP.md](file:///D:/Download%20video/dokumen/ROADMAP.md).
