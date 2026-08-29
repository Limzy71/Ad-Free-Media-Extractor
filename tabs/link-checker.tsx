import { useState, useRef, useCallback } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  ShieldOff,
  Link2,
  Play,
  Download,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ClipboardPaste,
  Search,
  Film,
  Zap,
  Globe,
  Clock,
  BarChart2,
  ArrowLeft,
  Sparkles,
  Layers,
  ExternalLink
} from 'lucide-react';
import { LinkVerifierService } from '~/services/link-verifier';
import { CleanPlayerModal } from '~/components/clean-player/CleanPlayerModal';
import { Toast, type ToastMessage } from '~/components/ui/Toast';
import type { SecurityVerificationResult, SecurityStatus } from '~/types/security';
import type { MediaMetadata, MediaFormatCategory } from '~/types/media';
import '~/style.css';

interface CheckResult {
  security: SecurityVerificationResult | null;
  resolvedMediaUrl: string | null;
  mediaFormat: MediaFormatCategory;
  responseTimeMs: number;
  checkedAt: string;
}

/**
 * Ekstraktor pintar untuk mengambil URL video langsung dari URL halaman web
 */
async function extractDirectMediaStream(rawUrl: string): Promise<{ url: string; format: MediaFormatCategory } | null> {
  try {
    const cleanUrl = rawUrl.trim();

    // 1. Videy.co parser
    const videyMatch = cleanUrl.match(/videy\.co\/v\/\?id=([a-zA-Z0-9_-]+)/i);
    if (videyMatch && videyMatch[1]) {
      return { url: `https://cdn.videy.co/${videyMatch[1]}.mp4`, format: 'MP4' };
    }

    // 2. Format langsung (.m3u8, .mp4, .webm)
    const urlWithoutQuery = cleanUrl.split('?')[0].toLowerCase();
    if (urlWithoutQuery.endsWith('.m3u8')) return { url: cleanUrl, format: 'HLS' };
    if (urlWithoutQuery.endsWith('.webm')) return { url: cleanUrl, format: 'WEBM' };
    if (urlWithoutQuery.endsWith('.mp4')) return { url: cleanUrl, format: 'MP4' };

    // 3. Ekstraksi otomatis dari HTML halaman web
    const res = await fetch(cleanUrl);
    if (res.ok) {
      const html = await res.text();

      // Cari tag <video src="..."> atau <source src="...">
      const vMatch = html.match(/<video[^>]*src=["']([^"']+)["']/i) || html.match(/<source[^>]*src=["']([^"']+)["']/i);
      if (vMatch && vMatch[1]) {
        const absolute = new URL(vMatch[1], cleanUrl).href;
        const fmt: MediaFormatCategory = absolute.includes('.m3u8') ? 'HLS' : 'MP4';
        return { url: absolute, format: fmt };
      }

      // Cari stream URL dalam script / page data
      const urlMatch = html.match(/https?:\/\/[^"'\s<>]+\.(?:m3u8|mp4|webm)(?:\?[^"'\s<>]*)?/i);
      if (urlMatch && urlMatch[0]) {
        const absolute = urlMatch[0];
        const fmt: MediaFormatCategory = absolute.includes('.m3u8') ? 'HLS' : 'MP4';
        return { url: absolute, format: fmt };
      }
    }

    return null;
  } catch {
    return null;
  }
}

export default function LinkCheckerPage() {
  const [inputUrl, setInputUrl] = useState<string>('');
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activePlayMedia, setActivePlayMedia] = useState<MediaMetadata | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setInputUrl(text.trim());
        inputRef.current?.focus();
      }
    } catch {
      inputRef.current?.focus();
    }
  };

  const handleCheck = useCallback(async () => {
    const url = inputUrl.trim();
    if (!url) return;

    const fullUrl = url.startsWith('http') ? url : `https://${url}`;

    setIsChecking(true);
    setResult(null);
    setError(null);

    const startTime = Date.now();

    try {
      new URL(fullUrl);

      // 1. Verifikasi Keamanan URL
      const security = await LinkVerifierService.verifyUrl(fullUrl);

      // 2. Ekstraksi Media Stream Nyata
      const directMedia = await extractDirectMediaStream(fullUrl);

      const responseTimeMs = Date.now() - startTime;
      const checkedAt = new Date().toLocaleTimeString('id-ID');

      setResult({
        security,
        resolvedMediaUrl: directMedia?.url ?? null,
        mediaFormat: directMedia?.format ?? 'MP4',
        responseTimeMs,
        checkedAt
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Format URL tidak valid. Pastikan diawali dengan http:// atau https://');
    } finally {
      setIsChecking(false);
    }
  }, [inputUrl]);

  const handleOpenClean = async () => {
    if (!inputUrl) return;
    const fullUrl = inputUrl.startsWith('http') ? inputUrl : `https://${inputUrl}`;

    // Gunakan URL media yang sudah ter-resolusi atau ekstrak langsung
    let playUrl = result?.resolvedMediaUrl;
    let formatCategory = result?.mediaFormat ?? 'MP4';

    if (!playUrl) {
      const extracted = await extractDirectMediaStream(fullUrl);
      playUrl = extracted?.url ?? fullUrl;
      formatCategory = extracted?.format ?? (playUrl.includes('.m3u8') ? 'HLS' : 'MP4');
    }

    let domainTitle = 'Video Stream';
    try {
      domainTitle = new URL(fullUrl).hostname;
    } catch {}

    const mediaToPlay: MediaMetadata = {
      id: Date.now().toString(),
      sourceUrl: playUrl,
      pageUrl: fullUrl,
      pageTitle: domainTitle,
      mimeType: formatCategory === 'HLS' ? 'application/x-mpegURL' : 'video/mp4',
      formatCategory,
      detectedAtTimestamp: Date.now(),
      isDrmProtected: false
    };

    setActivePlayMedia(mediaToPlay);
  };

  const handleDownload = (media?: MediaMetadata) => {
    const targetUrl = media?.sourceUrl ?? result?.resolvedMediaUrl ?? inputUrl;
    const targetFormat = media?.formatCategory ?? result?.mediaFormat ?? 'MP4';

    setToast({
      id: Date.now().toString(),
      type: 'info',
      title: 'Memulai Unduhan',
      message: 'Sedang memproses berkas media untuk disimpan...'
    });

    chrome.runtime.sendMessage({
      type: 'START_MEDIA_DOWNLOAD',
      payload: {
        mediaId: Date.now().toString(),
        sourceUrl: targetUrl,
        filename: `video_${Date.now()}.${targetFormat.toLowerCase()}`,
        formatCategory: targetFormat
      }
    }).catch(() => {});
  };

  const statusConfig: Record<SecurityStatus, { color: string; bg: string; label: string; icon: JSX.Element }> = {
    SAFE: {
      color: 'text-emerald-400',
      bg: 'bg-emerald-950/40 border-emerald-700/50',
      label: 'Tautan Aman (Bebas Bahaya)',
      icon: <ShieldCheck className="w-8 h-8 text-emerald-400 shrink-0" />
    },
    WARNING: {
      color: 'text-amber-400',
      bg: 'bg-amber-950/40 border-amber-700/50',
      label: 'Peringatan: Tautan Mencurigakan',
      icon: <ShieldAlert className="w-8 h-8 text-amber-400 shrink-0" />
    },
    BLOCKED: {
      color: 'text-red-400',
      bg: 'bg-red-950/40 border-red-700/50',
      label: 'Ancaman Terdeteksi!',
      icon: <ShieldAlert className="w-8 h-8 text-red-400 shrink-0" />
    },
    UNVERIFIED: {
      color: 'text-zinc-400',
      bg: 'bg-zinc-900/60 border-zinc-700/50',
      label: 'Tidak Dapat Diverifikasi',
      icon: <ShieldOff className="w-8 h-8 text-zinc-400 shrink-0" />
    }
  };

  const cfg = result?.security ? (statusConfig[result.security.status] ?? statusConfig.UNVERIFIED) : null;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans antialiased flex flex-col selection:bg-blue-600 selection:text-white">
      {/* Toast Notification Container */}
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* Header */}
      <header className="border-b border-zinc-800/80 bg-zinc-900/70 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-900/30">
              <Play className="w-5 h-5 text-white fill-white ml-0.5" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                <span>Link Checker & Media Hub</span>
                <span className="px-2 py-0.5 rounded-full bg-blue-950 border border-blue-700/60 text-blue-400 text-[10px] font-semibold">
                  PRO
                </span>
              </h1>
              <p className="text-[11px] text-zinc-400">Universal Ad-Free Media Extractor</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-700/50 text-emerald-400 text-xs font-semibold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Sistem Aktif
            </span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl w-full mx-auto px-6 py-10 space-y-8 flex-1">
        {/* Title Section */}
        <div className="text-center space-y-3">
          <h2 className="text-3xl font-extrabold text-white tracking-tight sm:text-4xl bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
            Cek Keamanan & Putar Media
          </h2>
          <p className="text-sm text-zinc-400 max-w-xl mx-auto leading-relaxed">
            Tempelkan tautan video atau halaman web apa pun. Sistem akan memindai ancaman keamanan,
            mengekstrak video asli, dan memutar media langsung dalam player bersih.
          </p>
        </div>

        {/* Input Card */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-3xl p-6 shadow-2xl space-y-4 backdrop-blur-xl">
          <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
            <Link2 className="w-4 h-4 text-blue-400" />
            Tautan / URL Target
          </label>

          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
              <input
                ref={inputRef}
                type="url"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCheck()}
                placeholder="https://contoh.com/video.mp4 atau link web video..."
                className="w-full pl-11 pr-4 py-3.5 bg-zinc-950/80 border border-zinc-700/70 rounded-2xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-mono"
              />
            </div>

            <button
              onClick={handlePaste}
              className="px-4 py-3.5 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 border border-zinc-700 text-zinc-200 rounded-2xl transition-all flex items-center justify-center gap-2 text-xs font-bold shrink-0 hover:scale-102"
              title="Tempel dari Clipboard"
            >
              <ClipboardPaste className="w-4 h-4 text-zinc-400" />
              <span>Paste</span>
            </button>

            <button
              onClick={handleCheck}
              disabled={isChecking || !inputUrl.trim()}
              className="px-6 py-3.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all shrink-0 shadow-lg shadow-blue-900/30 hover:scale-102"
            >
              {isChecking ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              <span>{isChecking ? 'Memindai...' : 'Cek URL'}</span>
            </button>
          </div>

          <div className="flex items-center justify-between text-xs text-zinc-500 px-1 pt-1">
            <span className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              Tekan tombol <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-300 font-mono text-[10px]">Enter</kbd> untuk mulai memindai secara instan.
            </span>
          </div>
        </div>

        {/* Loading Animation */}
        {isChecking && (
          <div className="flex flex-col items-center justify-center py-12 gap-3 animate-pulse">
            <div className="w-16 h-16 rounded-2xl bg-blue-900/30 border border-blue-700/40 flex items-center justify-center">
              <ShieldCheck className="w-8 h-8 text-blue-400 animate-spin" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-bold text-zinc-200">Sedang Menganalisis Keamanan & Media...</p>
              <p className="text-xs text-zinc-500">Memeriksa domain phishing, judi, malware, dan stream video asli</p>
            </div>
          </div>
        )}

        {/* Error Notification */}
        {error && !isChecking && (
          <div className="p-4 rounded-2xl bg-red-950/60 border border-red-700/60 flex items-start gap-3.5 text-red-200 shadow-xl">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold">Format Tautan Tidak Valid</p>
              <p className="text-xs text-red-300/80 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Result Cards Section */}
        {result && !isChecking && cfg && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
            {/* Meta Header Info */}
            <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
              <span className="flex items-center gap-1.5 font-medium">
                <Clock className="w-3.5 h-3.5 text-zinc-500" />
                Dipindai pukul {result.checkedAt}
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <BarChart2 className="w-3.5 h-3.5 text-zinc-500" />
                Kecepatan Respons {result.responseTimeMs} ms
              </span>
            </div>

            {/* 1. Security Card */}
            <div className={`p-6 rounded-3xl border ${cfg.bg} space-y-4 shadow-xl`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  {cfg.icon}
                  <div>
                    <h3 className={`text-lg font-extrabold tracking-tight ${cfg.color}`}>
                      {cfg.label}
                    </h3>
                    <p className="text-xs text-zinc-300 font-mono mt-0.5">
                      Domain: <span className="text-white font-bold">{result.security?.domain || new URL(inputUrl.startsWith('http') ? inputUrl : `https://${inputUrl}`).hostname}</span>
                    </p>
                  </div>
                </div>

                {result.security && result.security.riskScore > 0 && (
                  <div className="px-3.5 py-1.5 rounded-xl bg-red-900/80 border border-red-700 text-center shrink-0 shadow-lg">
                    <p className="text-[10px] text-red-300 uppercase font-bold tracking-wider">Skor Risiko</p>
                    <p className="text-lg font-black text-white">{result.security.riskScore}%</p>
                  </div>
                )}
              </div>

              {result.security?.threatDescription && (
                <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-red-900/40 border border-red-700/60">
                  <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-200 leading-relaxed font-medium">
                    {result.security.threatDescription}
                  </p>
                </div>
              )}

              {result.security?.status === 'SAFE' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  {[
                    'Bebas dari indikasi platform judi online',
                    'Bebas dari skema phishing & pencurian data',
                    'Bebas dari malware & skrip berbahaya',
                    'Domain berstatus aman & bersih'
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs text-emerald-300 bg-emerald-900/20 px-3 py-2 rounded-xl border border-emerald-800/30">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 2. Media Player Action Card */}
            {result.security?.status !== 'BLOCKED' && (
              <div className="p-6 rounded-3xl bg-zinc-900/90 border border-zinc-800 space-y-4 shadow-xl">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Film className="w-4 h-4 text-blue-400" />
                    <span>Aksi Pemutar & Unduhan Media</span>
                  </h3>
                  {result.resolvedMediaUrl && (
                    <span className="px-2.5 py-0.5 rounded-full bg-blue-950 border border-blue-700 text-blue-300 text-[10px] font-bold">
                      Format: {result.mediaFormat}
                    </span>
                  )}
                </div>

                <p className="text-xs text-zinc-400 leading-relaxed">
                  {result.resolvedMediaUrl
                    ? 'Stream video berhasil diekstrak! Klik "Putar Bersih" untuk memutar video langsung tanpa iklan atau unduh ke perangkat.'
                    : 'Tautan halaman web siap diputar. Klik "Putar Bersih" untuk mengekstrak dan memutar video di dalam player bersih.'}
                </p>

                <div className="flex flex-col sm:flex-row gap-3 pt-1">
                  <button
                    onClick={handleOpenClean}
                    className="flex-1 py-3 px-5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-2xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-900/30 transition-all hover:scale-102 cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>Putar Bersih (Tanpa Iklan)</span>
                  </button>

                  <button
                    onClick={() => handleDownload()}
                    className="py-3 px-5 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 text-zinc-100 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 border border-zinc-700 transition-all hover:scale-102 cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-zinc-300" />
                    <span>Unduh Video</span>
                  </button>
                </div>
              </div>
            )}

            {/* Bottom Reset Button */}
            <div className="pt-2 text-center">
              <button
                onClick={() => {
                  setResult(null);
                  setInputUrl('');
                  inputRef.current?.focus();
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white hover:bg-zinc-900 transition-all cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Cek Tautan Lain</span>
              </button>
            </div>
          </div>
        )}

        {/* Empty State Cards */}
        {!result && !isChecking && !error && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
            {[
              {
                icon: ShieldCheck,
                title: 'Pemindai Keamanan',
                desc: 'Mendeteksi otomatis tautan phishing, malware, dan platform perjudian secara instan.',
                color: 'text-emerald-400',
                bg: 'bg-emerald-950/20 border-emerald-800/30'
              },
              {
                icon: Layers,
                title: 'Pembersih Iklan & Tracker',
                desc: 'Mencegah pop-under, tab liar, dan banner invasif saat membuka tautan video.',
                color: 'text-blue-400',
                bg: 'bg-blue-950/20 border-blue-800/30'
              },
              {
                icon: Zap,
                title: 'Putar & Unduh Bersih',
                desc: 'Tonton langsung video dengan kontrol kustom atau simpan berkas MP4 ke penyimpanan lokal.',
                color: 'text-yellow-400',
                bg: 'bg-yellow-950/20 border-yellow-800/30'
              }
            ].map(({ icon: Icon, title, desc, color, bg }, index) => (
              <div key={index} className={`p-5 rounded-3xl border ${bg} bg-zinc-900/60 backdrop-blur space-y-2.5 shadow-lg`}>
                <div className="w-9 h-9 rounded-xl bg-zinc-800 flex items-center justify-center">
                  <Icon className={`w-5 h-5 ${color}`} />
                </div>
                <h4 className="text-xs font-bold text-zinc-100">{title}</h4>
                <p className="text-[11px] text-zinc-400 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Clean Player Fullscreen Modal */}
      {activePlayMedia && (
        <CleanPlayerModal
          media={activePlayMedia}
          onClose={() => setActivePlayMedia(null)}
          onDownload={(m) => handleDownload(m)}
        />
      )}

      {/* Footer */}
      <footer className="max-w-4xl mx-auto px-6 py-6 text-center text-[11px] text-zinc-500 border-t border-zinc-900 flex items-center justify-between w-full">
        <span>Universal Ad-Free Media Extractor v1.0.0</span>
        <span className="flex items-center gap-1 text-emerald-500 font-semibold">
          <ShieldCheck className="w-3.5 h-3.5" /> Zero Data Retention - Aman & Terenkripsi
        </span>
      </footer>
    </div>
  );
}