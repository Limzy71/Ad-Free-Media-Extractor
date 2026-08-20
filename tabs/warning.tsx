import { useEffect, useState } from 'react';
import { ShieldAlert, AlertTriangle, ArrowLeft, Shield } from 'lucide-react';
import '~/style.css';

export default function WarningPage() {
  const [targetUrl, setTargetUrl] = useState<string>('Tidak diketahui');
  const [threatType, setThreatType] = useState<string>('Judi Online / Phishing');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const url = params.get('url');
    const threat = params.get('threat');

    if (url) setTargetUrl(url);
    if (threat) {
      switch (threat.toUpperCase()) {
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

  const handleGoBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.close();
    }
  };

  const handleBypass = () => {
    if (!targetUrl || targetUrl === 'Tidak diketahui') return;

    // Validasi: hanya izinkan protokol HTTP/HTTPS, blokir javascript:, data:, vbscript:, dll
    try {
      const parsed = new URL(targetUrl);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        window.location.href = targetUrl;
      }
    } catch {
      // URL tidak valid, abaikan navigasi
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans flex items-center justify-center p-6 select-none">
      <div className="max-w-md w-full bg-red-950/40 border border-red-500/40 rounded-3xl p-8 backdrop-blur-xl shadow-2xl flex flex-col items-center text-center gap-5 animate-in fade-in zoom-in-95 duration-200">
        {/* Threat Shield Icon */}
        <div className="w-16 h-16 rounded-2xl bg-red-600/20 border border-red-500/50 flex items-center justify-center text-red-400 shadow-lg">
          <ShieldAlert className="w-9 h-9 animate-pulse" />
        </div>

        {/* Header Titles */}
        <div className="space-y-1">
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-900/60 border border-red-700/50 text-red-300 text-[11px] font-semibold tracking-wide uppercase">
            <AlertTriangle className="w-3 h-3" /> Ancaman Terdeteksi
          </span>
          <h1 className="text-xl font-bold text-red-50 tracking-tight mt-2">
            Tautan Berbahaya Dicegat
          </h1>
          <p className="text-xs text-red-200/80 leading-relaxed max-w-xs mx-auto">
            Sistem <span className="font-semibold text-white">Smart Link Verifier</span> memblokir akses ke: <span className="text-red-300 font-semibold">{threatType}</span>.
          </p>
        </div>

        {/* Target URL Display */}
        <div className="w-full bg-black/50 border border-red-500/20 rounded-xl p-3 text-left">
          <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">
            URL Tujuan:
          </p>
          <p className="text-xs font-mono text-zinc-200 break-all select-all">
            {targetUrl}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="w-full space-y-2.5 pt-2">
          <button
            onClick={handleGoBack}
            className="w-full py-3 px-4 bg-white hover:bg-zinc-100 active:bg-zinc-200 text-zinc-950 font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Halaman Aman (Direkomendasikan)</span>
          </button>

          <button
            onClick={handleBypass}
            className="text-[11px] text-zinc-400 hover:text-zinc-200 underline transition-colors"
          >
            Lanjutkan ke situs berisiko (Tidak disarankan)
          </button>
        </div>

        {/* Footer info */}
        <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 pt-2 border-t border-red-900/40 w-full justify-center">
          <Shield className="w-3 h-3 text-emerald-400" />
          <span>Dilindungi oleh Universal Ad-Free Media Extractor</span>
        </div>
      </div>
    </div>
  );
}
