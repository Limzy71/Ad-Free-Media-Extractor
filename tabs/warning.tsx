import { useEffect, useState } from 'react';
import { ShieldAlert, AlertTriangle, ArrowLeft, Shield, X, ShoppingCart, Ban } from 'lucide-react';
import '~/style.css';

export default function WarningPage() {
  const [targetUrl, setTargetUrl] = useState<string>('Tidak diketahui');
  const [threatType, setThreatType] = useState<string>('Judi Online / Phishing');
  const [isSpamRedirect, setIsSpamRedirect] = useState<boolean>(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const url = params.get('url');
    const threat = params.get('threat');

    if (url) setTargetUrl(url);
    if (threat) {
      switch (threat.toUpperCase()) {
        case 'SPAM_REDIRECT':
        case 'NOT_A_VIDEO':
          setIsSpamRedirect(true);
          setThreatType('Tautan Palsu / Pengalihan Iklan Afiliasi');
          break;
        case 'GAMBLING':
          setThreatType('Situs Perjudian Online Ilegal');
          break;
        case 'PHISHING':
          setThreatType('Situs Phishing / Pencurian Data');
          break;
        case 'MALWARE':
          setThreatType('Distribusi Malware Berbahaya');
          break;
        default:
          setThreatType(threat);
          break;
      }
    }
  }, []);

  const handleCloseTab = () => {
    window.close();
  };

  const handleGoBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.close();
    }
  };

  const handleBypass = () => {
    if (!targetUrl || targetUrl === 'Tidak diketahui') return;
    try {
      const parsed = new URL(targetUrl);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        window.location.href = targetUrl;
      }
    } catch {}
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans flex items-center justify-center p-6 select-none selection:bg-rose-500 selection:text-white">
      <div
        className={`max-w-md w-full rounded-3xl p-8 backdrop-blur-xl shadow-2xl flex flex-col items-center text-center gap-5 border animate-in fade-in zoom-in-95 duration-200 ${
          isSpamRedirect
            ? 'bg-amber-950/30 border-amber-500/40'
            : 'bg-red-950/40 border-red-500/40'
        }`}
      >
        {/* Shield / Alert Icon */}
        <div
          className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg ${
            isSpamRedirect
              ? 'bg-amber-500/20 border border-amber-500/50 text-amber-400'
              : 'bg-red-600/20 border border-red-500/50 text-red-400'
          }`}
        >
          {isSpamRedirect ? (
            <ShoppingCart className="w-8 h-8" />
          ) : (
            <ShieldAlert className="w-8 h-8 animate-pulse" />
          )}
        </div>

        {/* Header Titles */}
        <div className="space-y-1.5">
          <span
            className={`inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase border ${
              isSpamRedirect
                ? 'bg-amber-900/60 border-amber-700/50 text-amber-300'
                : 'bg-red-900/60 border-red-700/50 text-red-300'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            {isSpamRedirect ? 'Bukan Video Asli' : 'Ancaman Terdeteksi'}
          </span>

          <h1 className="text-xl font-black text-white tracking-tight pt-1">
            {isSpamRedirect
              ? 'Pengalihan Iklan / Shopee Dicegat'
              : 'Tautan Berbahaya Dicegat'}
          </h1>

          <p className="text-xs text-zinc-300 leading-relaxed max-w-xs mx-auto">
            {isSpamRedirect
              ? 'Tautan ini tampak seperti berkas video (.mp4), namun sebenarnya merupakan jebakan tautan afiliasi / belanja online (Shopee/Marketplace). Ekstensi telah mencegatnya agar aplikasi belanja tidak terbuka.'
              : `Sistem Smart Link Verifier memblokir akses ke: ${threatType}.`}
          </p>
        </div>

        {/* Target URL Display */}
        <div className="w-full bg-black/60 border border-zinc-800 rounded-2xl p-3.5 text-left">
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
            URL Asli Tautan:
          </p>
          <p className="text-xs font-mono text-zinc-300 break-all select-all line-clamp-3">
            {targetUrl}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="w-full space-y-2.5 pt-1">
          <button
            onClick={handleCloseTab}
            className="w-full py-3.5 px-4 bg-white hover:bg-zinc-100 active:bg-zinc-200 text-zinc-950 font-extrabold text-xs rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer hover:scale-102"
          >
            <X className="w-4 h-4" />
            <span>Tutup Tab Ini (Aman)</span>
          </button>

          <button
            onClick={handleGoBack}
            className="w-full py-2.5 px-4 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-semibold text-xs rounded-2xl border border-zinc-700 transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Kembali ke Halaman Sebelumnya</span>
          </button>

          {!isSpamRedirect && (
            <button
              onClick={handleBypass}
              className="text-[11px] text-zinc-500 hover:text-zinc-300 underline transition-colors cursor-pointer block mx-auto pt-1"
            >
              Lanjutkan ke situs berisiko (Tidak disarankan)
            </button>
          )}
        </div>

        {/* Footer info */}
        <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 pt-2 border-t border-zinc-800/80 w-full justify-center">
          <Shield className="w-3.5 h-3.5 text-emerald-400" />
          <span>Universal Ad-Free Media Extractor • Proteksi Aktif</span>
        </div>
      </div>
    </div>
  );
}
