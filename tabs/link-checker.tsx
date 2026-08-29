import { useState, useRef, useCallback } from 'react';
import {
  ShieldCheck, ShieldAlert, ShieldOff, Link2, Play, Download, Loader2,
  AlertTriangle, CheckCircle2, XCircle, ClipboardPaste, Search, Film,
  Zap, Globe, Clock, BarChart2, ChevronRight
} from 'lucide-react';
import { LinkVerifierService } from '~/services/link-verifier';
import type { SecurityVerificationResult } from '~/types/security';
import type { ExtensionMessage } from '~/types/messages';
import '~/style.css';

interface CheckResult {
  security: SecurityVerificationResult | null;
  responseTimeMs: number;
  checkedAt: string;
}

export default function LinkCheckerPage() {
  const [inputUrl, setInputUrl] = useState<string>('');
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setInputUrl(text.trim());
      inputRef.current?.focus();
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
      const security = await LinkVerifierService.verifyUrl(fullUrl);
      setResult({ security, responseTimeMs: Date.now() - startTime, checkedAt: new Date().toLocaleTimeString('id-ID') });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'URL tidak valid atau tidak dapat dijangkau.');
    } finally {
      setIsChecking(false);
    }
  }, [inputUrl]);

  const handleOpenClean = () => {
    if (!inputUrl) return;
    const fullUrl = inputUrl.startsWith('http') ? inputUrl : `https://${inputUrl}`;
    const msg: ExtensionMessage = {
      type: 'TRIGGER_CLEAN_PLAYER',
      payload: {
        id: Date.now().toString(), sourceUrl: fullUrl, pageUrl: fullUrl,
        pageTitle: new URL(fullUrl).hostname, mimeType: 'video/mp4',
        formatCategory: 'MP4', detectedAtTimestamp: Date.now(), isDrmProtected: false
      }
    };
    chrome.runtime.sendMessage(msg).catch(() => {});
  };

  const handleDownload = () => {
    if (!inputUrl) return;
    const fullUrl = inputUrl.startsWith('http') ? inputUrl : `https://${inputUrl}`;
    const msg: ExtensionMessage = {
      type: 'START_MEDIA_DOWNLOAD',
      payload: { mediaId: Date.now().toString(), sourceUrl: fullUrl, filename: `video_${Date.now()}.mp4`, formatCategory: 'MP4' }
    };
    chrome.runtime.sendMessage(msg).catch(() => {});
  };

  const statusConfig = {
    SAFE: { color: 'text-emerald-400', bg: 'bg-emerald-950/50 border-emerald-700/40', label: 'Tautan Aman', icon: <ShieldCheck className="w-8 h-8 text-emerald-400" /> },
    BLOCKED: { color: 'text-red-400', bg: 'bg-red-950/50 border-red-700/40', label: 'Ancaman Terdeteksi!', icon: <ShieldAlert className="w-8 h-8 text-red-400" /> },
    UNVERIFIED: { color: 'text-amber-400', bg: 'bg-amber-950/50 border-amber-700/40', label: 'Tidak Dapat Diverifikasi', icon: <ShieldOff className="w-8 h-8 text-amber-400" /> },
  };
  const cfg = result?.security ? (statusConfig[result.security.status] ?? statusConfig.UNVERIFIED) : null;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans antialiased">
      <header className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-900/40">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white tracking-tight">Link Checker</h1>
              <p className="text-[10px] text-zinc-400">Universal Ad-Free Media Extractor</p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-blue-950/60 border border-blue-700/40 text-blue-300 text-[10px] font-semibold">v1.0.0 MVP</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-white tracking-tight">Cek Keamanan & Media URL</h2>
          <p className="text-sm text-zinc-400 max-w-lg mx-auto leading-relaxed">
            Paste link video atau situs web apapun. Sistem akan menganalisis keamanan, mendeteksi ancaman, dan memungkinkan Anda memutar atau mengunduh tanpa iklan.
          </p>
        </div>

        <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 shadow-xl space-y-3">
          <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
            <Link2 className="w-3.5 h-3.5" /> URL yang Ingin Dicek
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
              <input
                ref={inputRef} type="url" value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCheck()}
                placeholder="https://contoh.com/video.mp4 atau link streaming..."
                className="w-full pl-10 pr-4 py-3 bg-zinc-800/80 border border-zinc-700/60 rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500/40 transition-all"
              />
            </div>
            <button onClick={handlePaste} className="px-3.5 py-3 bg-zinc-700 hover:bg-zinc-600 border border-zinc-600 text-zinc-200 rounded-xl transition-colors flex items-center gap-1.5 text-xs font-semibold shrink-0" title="Tempel dari clipboard">
              <ClipboardPaste className="w-4 h-4" /><span className="hidden sm:inline">Paste</span>
            </button>
            <button onClick={handleCheck} disabled={isChecking || !inputUrl.trim()} className="px-5 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-semibold text-sm flex items-center gap-2 transition-all shrink-0 shadow-lg shadow-blue-900/30">
              {isChecking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              <span>{isChecking ? 'Menganalisis...' : 'Cek URL'}</span>
            </button>
          </div>
          <p className="text-[11px] text-zinc-500 flex items-center gap-1">
            <Zap className="w-3 h-3 text-yellow-500/70" />
            Tekan <kbd className="px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-300 font-mono text-[10px] mx-0.5">Enter</kbd> atau klik Cek URL untuk analisis instan.
          </p>
        </div>

        {isChecking && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="w-14 h-14 rounded-full bg-blue-900/40 flex items-center justify-center animate-pulse">
              <ShieldCheck className="w-7 h-7 text-blue-400" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-semibold text-zinc-200">Sedang Menganalisis...</p>
              <p className="text-xs text-zinc-500">Memeriksa keamanan, media stream, dan tracker iklan</p>
            </div>
          </div>
        )}

        {error && !isChecking && (
          <div className="p-4 rounded-2xl bg-red-950/40 border border-red-700/40 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div><p className="text-sm font-semibold text-red-200">URL Tidak Valid</p><p className="text-xs text-red-300/70 mt-0.5">{error}</p></div>
          </div>
        )}

        {result && !isChecking && cfg && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 text-[11px] text-zinc-500 px-1">
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Dicek pada {result.checkedAt}</span>
              <span className="flex items-center gap-1"><BarChart2 className="w-3 h-3" /> Respons {result.responseTimeMs}ms</span>
            </div>

            <div className={`p-5 rounded-2xl border ${cfg.bg} space-y-3`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  {cfg.icon}
                  <div>
                    <h3 className={`text-base font-bold ${cfg.color}`}>{cfg.label}</h3>
                    <p className="text-xs text-zinc-400 mt-0.5">{result.security?.domain}</p>
                  </div>
                </div>
                {result.security && result.security.riskScore > 0 && (
                  <div className="px-3 py-1.5 rounded-xl bg-red-900/60 border border-red-700/40 text-center shrink-0">
                    <p className="text-[10px] text-red-300 font-semibold">Risiko</p>
                    <p className="text-lg font-bold text-red-200">{result.security.riskScore}%</p>
                  </div>
                )}
              </div>
              {result.security?.threatDescription && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-red-900/30 border border-red-800/30">
                  <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-200 leading-relaxed">{result.security.threatDescription}</p>
                </div>
              )}
              {result.security?.status === 'SAFE' && (
                <div className="grid grid-cols-2 gap-2">
                  {['Tidak terdeteksi sebagai situs judi', 'Tidak terdeteksi phishing', 'Tidak terdeteksi malware', 'Domain tidak masuk daftar hitam'].map((item) => (
                    <div key={item} className="flex items-center gap-2 text-[11px] text-emerald-300">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" /><span>{item}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {result.security?.status !== 'BLOCKED' && (
              <div className="p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800 space-y-3">
                <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2"><Film className="w-4 h-4 text-blue-400" /> Aksi Media</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">Jika URL ini adalah link video atau stream langsung, Anda dapat langsung memutar atau mengunduhnya tanpa iklan.</p>
                <div className="flex gap-2 pt-1">
                  <button onClick={handleOpenClean} className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors">
                    <Play className="w-3.5 h-3.5 fill-current" /> Putar Bersih (Tanpa Iklan)
                  </button>
                  <button onClick={handleDownload} className="py-2.5 px-4 bg-zinc-700 hover:bg-zinc-600 text-zinc-100 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors">
                    <Download className="w-3.5 h-3.5" /> Unduh
                  </button>
                </div>
              </div>
            )}

            {result.security?.status === 'BLOCKED' && (
              <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 flex items-center justify-between">
                <p className="text-xs text-zinc-400">Tautan ini diblokir karena terdeteksi berbahaya. Tidak disarankan untuk dibuka.</p>
                <ChevronRight className="w-4 h-4 text-zinc-600 shrink-0" />
              </div>
            )}

            <button onClick={() => { setResult(null); setInputUrl(''); inputRef.current?.focus(); }} className="w-full py-2.5 text-xs font-semibold text-zinc-400 hover:text-zinc-200 transition-colors">
              ← Cek URL Lain
            </button>
          </div>
        )}

        {!result && !isChecking && !error && (
          <div className="grid grid-cols-3 gap-3 pt-2">
            {[
              { icon: ShieldCheck, title: 'Cek Keamanan', desc: 'Deteksi phishing, malware, dan situs judi secara instan', color: 'text-emerald-400', bg: 'bg-emerald-950/30 border-emerald-800/30' },
              { icon: Film, title: 'Deteksi Media', desc: 'Temukan stream MP4, HLS, WebM tersembunyi di dalam URL', color: 'text-blue-400', bg: 'bg-blue-950/30 border-blue-800/30' },
              { icon: Zap, title: 'Putar & Unduh', desc: 'Tonton video bersih tanpa iklan atau simpan ke perangkat', color: 'text-yellow-400', bg: 'bg-yellow-950/30 border-yellow-800/30' }
            ].map(({ icon: Icon, title, desc, color, bg }) => (
              <div key={title} className={`p-4 rounded-2xl border ${bg} space-y-2`}>
                <Icon className={`w-5 h-5 ${color}`} />
                <h4 className="text-xs font-bold text-zinc-200">{title}</h4>
                <p className="text-[11px] text-zinc-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="max-w-3xl mx-auto px-6 pb-8 text-center text-[10px] text-zinc-600">
        Universal Ad-Free Media Extractor v1.0.0 · Zero Data Retention · Manifest V3
      </footer>
    </div>
  );
}