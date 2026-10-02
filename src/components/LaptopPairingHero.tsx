import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  QrCode,
  Copy,
  Check,
  Smartphone,
  Laptop,
  Zap,
  ShieldCheck,
  Wifi,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { getPublicAppUrl } from '../utils/format';

interface LaptopPairingHeroProps {
  roomId: string;
  lang: 'hi' | 'en';
}

export const LaptopPairingHero: React.FC<LaptopPairingHeroProps> = ({ roomId, lang }) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedPin, setCopiedPin] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [networkIps, setNetworkIps] = useState<string[]>([]);
  const [selectedIp, setSelectedIp] = useState<string>('');

  useEffect(() => {
    fetch('/api/network-ip')
      .then((res) => res.json())
      .then((data) => {
        if (data?.ips && Array.isArray(data.ips) && data.ips.length > 0) {
          setNetworkIps(data.ips);
          const hotspotIp =
            data.ips.find((ip: string) => ip.startsWith('192.168.137.')) ||
            data.ips.find((ip: string) => ip.startsWith('192.168.')) ||
            data.ips[0];
          setSelectedIp(hotspotIp);
        }
      })
      .catch(() => {});
  }, []);

  const getEffectiveBaseUrl = () => {
    if (typeof window === 'undefined') return '';
    const protocol = window.location.protocol;
    const isLocal =
      window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    if (isLocal && selectedIp) {
      const port = window.location.port ? `:${window.location.port}` : '';
      return `${protocol}//${selectedIp}${port}`;
    }
    return getPublicAppUrl();
  };

  const effectiveBaseUrl = getEffectiveBaseUrl();
  const joinUrl = `${effectiveBaseUrl}/?room=${roomId}&join=1`;

  useEffect(() => {
    if (joinUrl) {
      QRCode.toDataURL(joinUrl, {
        width: 300,
        margin: 2,
        color: {
          dark: '#020617',
          light: '#ffffff',
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error('Failed to generate QR code in Hero:', err));
    }
  }, [joinUrl]);

  const copyPin = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(roomId);
      setCopiedPin(true);
      setTimeout(() => setCopiedPin(false), 2000);
    }
  };

  const copyUrl = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(joinUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900/95 to-indigo-950/40 border border-slate-800 shadow-2xl p-6 sm:p-8">
      {/* Subtle background glow */}
      <div className="absolute -top-24 -right-24 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left Column: Instructions & 6-Digit PIN */}
        <div className="lg:col-span-7 space-y-5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>
              {lang === 'hi' ? 'Zero Install Web App • Ready for Pairing' : 'Zero Install Web App • Ready for Pairing'}
            </span>
          </div>

          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight">
              {lang === 'hi' ? (
                <>
                  Mobile App खोलें और <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">QR Scan</span> करें
                </>
              ) : (
                <>
                  Open Mobile App & <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">Scan QR Code</span>
                </>
              )}
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm mt-1.5 leading-relaxed">
              {lang === 'hi'
                ? 'लैपटॉप में कुछ भी इंस्टॉल करने की ज़रूरत नहीं है! बस मोबाइल से यह QR कोड स्कैन करें या 6-digit PIN डालें।'
                : 'No installation required on laptop! Simply scan this QR code or enter the 6-digit PIN from your mobile app.'}
            </p>
          </div>

          {/* 3 Step Guide */}
          <div className="space-y-2.5 text-xs sm:text-sm">
            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <div className="w-6 h-6 rounded-lg bg-indigo-500/15 text-indigo-400 font-bold flex items-center justify-center shrink-0 text-xs">
                1
              </div>
              <span className="text-slate-300 font-medium">
                {lang === 'hi'
                  ? 'Mobile में HotSpot Drop ऐप खोलें'
                  : 'Open HotSpot Drop app on your phone'}
              </span>
            </div>

            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <div className="w-6 h-6 rounded-lg bg-cyan-500/15 text-cyan-400 font-bold flex items-center justify-center shrink-0 text-xs">
                2
              </div>
              <span className="text-slate-300 font-medium">
                {lang === 'hi'
                  ? 'स्क्रीन पर दिख रहा QR Code स्कैन करें या 6-digit PIN डालें'
                  : 'Scan this QR Code or enter the 6-digit PIN below'}
              </span>
            </div>

            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <div className="w-6 h-6 rounded-lg bg-emerald-500/15 text-emerald-400 font-bold flex items-center justify-center shrink-0 text-xs">
                3
              </div>
              <span className="text-slate-300 font-medium">
                {lang === 'hi'
                  ? 'फाइलें सेलेक्ट करें और 80 MB/s तक की स्पीड पर भेजें!'
                  : 'Select files and transfer at full Wi-Fi speed (up to 80 MB/s)'}
              </span>
            </div>
          </div>

          {/* 6-Digit PIN Showcase */}
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-indigo-500/30 shadow-inner flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                {lang === 'hi' ? '6-Digit Pairing PIN' : '6-Digit Pairing PIN'}
              </span>
              <div className="text-3xl sm:text-4xl font-mono font-extrabold tracking-widest text-emerald-400 mt-0.5">
                {roomId.replace(/(\d{3})(\d{3})/, '$1 $2')}
              </div>
            </div>

            <button
              onClick={copyPin}
              className="w-full sm:w-auto px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/30"
            >
              {copiedPin ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
              <span>{copiedPin ? (lang === 'hi' ? 'PIN Copy Ho Gaya!' : 'PIN Copied!') : (lang === 'hi' ? 'PIN Copy Karein' : 'Copy PIN')}</span>
            </button>
          </div>

          {/* Network IP selector if multiple IPs */}
          {networkIps.length > 1 && (
            <div className="p-2.5 rounded-xl bg-slate-950/50 border border-slate-800 text-[11px] text-slate-400 flex flex-wrap items-center gap-2">
              <span className="text-slate-500 font-medium">{lang === 'hi' ? 'Active IP:' : 'Active IP:'}</span>
              {networkIps.map((ip) => (
                <button
                  key={ip}
                  onClick={() => setSelectedIp(ip)}
                  className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
                    selectedIp === ip
                      ? 'bg-indigo-600 text-white font-bold'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {ip.startsWith('192.168.137.') ? `🔥 Hotspot (${ip})` : ip}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Direct Live QR Code */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center">
          <div className="relative group p-4 sm:p-5 bg-white rounded-3xl shadow-2xl ring-4 ring-indigo-500/20 transition-all hover:scale-[1.02]">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="Room Pairing QR Code"
                className="w-56 h-56 sm:w-64 sm:h-64 object-contain rounded-xl"
              />
            ) : (
              <div className="w-56 h-56 sm:w-64 sm:h-64 flex flex-col items-center justify-center text-slate-400">
                <QrCode className="w-10 h-10 animate-pulse text-indigo-500 mb-2" />
                <span className="text-xs">Generating QR...</span>
              </div>
            )}

            {/* Corner badge */}
            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-slate-900 border border-slate-700 text-slate-200 text-[10px] font-bold shadow-lg flex items-center gap-1.5 whitespace-nowrap">
              <Smartphone className="w-3 h-3 text-indigo-400" />
              <span>{lang === 'hi' ? 'Phone कैमरे से Scan करें' : 'Scan with Phone Camera'}</span>
            </div>
          </div>

          {/* Quick URL for manual opening */}
          <div className="mt-6 w-full max-w-xs text-center space-y-1.5">
            <span className="text-[10px] text-slate-500 block">
              {lang === 'hi' ? 'या Mobile Browser में यह URL खोलें:' : 'Or visit in Mobile Browser:'}
            </span>
            <div className="p-2 rounded-xl bg-slate-950/80 border border-slate-800 font-mono text-[11px] text-cyan-300 flex items-center justify-between truncate">
              <span className="truncate">{effectiveBaseUrl}</span>
              <button
                onClick={copyUrl}
                className="text-[10px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 shrink-0 ml-1.5 border border-slate-700"
              >
                {copiedUrl ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
