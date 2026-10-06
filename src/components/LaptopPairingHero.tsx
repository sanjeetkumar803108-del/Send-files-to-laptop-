import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  QrCode,
  Copy,
  Check,
  Smartphone,
  Share2,
  Sparkles,
} from 'lucide-react';
import { getPublicAppUrl } from '../utils/format';

interface LaptopPairingHeroProps {
  roomId: string;
  lang: 'hi' | 'en';
}

export const LaptopPairingHero: React.FC<LaptopPairingHeroProps> = ({ roomId }) => {
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

  const getEffectiveSignalingUrl = () => {
    if (typeof window === 'undefined') return '';
    const saved = localStorage.getItem('hotspot_drop_signaling_url')?.trim();
    if (saved && !saved.includes('vercel.app')) return saved;
    const envWs = (import.meta.env.VITE_SIGNALING_URL as string | undefined)?.trim();
    if (envWs && !envWs.includes('vercel.app')) return envWs;

    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocal && selectedIp) {
      const port = window.location.port ? `:${window.location.port}` : '';
      return `ws://${selectedIp}${port}/ws`;
    }
    // On Vercel or any cloud static host: return empty string (Cloud Relay)
    return '';
  };

  const effectiveBaseUrl = getEffectiveBaseUrl();
  const effectiveSigUrl = getEffectiveSignalingUrl();
  const joinUrl = effectiveSigUrl && (effectiveSigUrl.startsWith('ws://') || effectiveSigUrl.startsWith('wss://'))
    ? `${effectiveBaseUrl}/?room=${roomId}&sig=${encodeURIComponent(effectiveSigUrl)}&join=1`
    : `${effectiveBaseUrl}/?room=${roomId}&join=1`;

  useEffect(() => {
    if (joinUrl) {
      QRCode.toDataURL(joinUrl, {
        width: 320,
        margin: 2,
        color: {
          dark: '#080C16',
          light: '#FFFFFF',
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

  const shareUrl = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          text: effectiveBaseUrl,
        });
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          try {
            await navigator.share({ url: effectiveBaseUrl });
          } catch {
            if (navigator.clipboard) {
              await navigator.clipboard.writeText(effectiveBaseUrl);
              setCopiedUrl(true);
              setTimeout(() => setCopiedUrl(false), 2000);
            }
          }
        }
      }
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(effectiveBaseUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-3xl glass-panel p-5 sm:p-7 transition-all">
      {/* Decorative Specular Glint */}
      <div className="absolute top-0 left-1/4 right-1/4 h-[1px] bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent pointer-events-none" />

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Left Column: 6-Digit PIN Showcase */}
        <div className="lg:col-span-7 space-y-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full glass-pill text-amber-300 text-[11px] font-bold border-amber-400/20 shadow-xs">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>Instant P2P Pairing</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight mt-2">
              Scan QR or Enter PIN
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-1">
              Mobile app se QR scan karein ya PIN enter karein to connect directly at full Wi-Fi speed.
            </p>
          </div>

          {/* 6-Digit PIN Showcase - Ultra Glass Card */}
          <div className="p-4 rounded-2xl glass-card border border-white/15 flex items-center justify-between gap-4 shadow-xl">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 block">
                PAIRING PIN
              </span>
              <div className="text-3xl sm:text-4xl font-mono font-black tracking-widest bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-300 bg-clip-text text-transparent mt-0.5 drop-shadow-[0_0_20px_rgba(6,182,212,0.35)]">
                {roomId.replace(/(\d{3})(\d{3})/, '$1 $2')}
              </div>
            </div>

            <button
              onClick={copyPin}
              className="px-4 py-2 glass-btn-primary rounded-xl flex items-center gap-1.5 text-xs font-semibold active:scale-95"
            >
              {copiedPin ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedPin ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          {/* Network IP selector if multiple IPs */}
          {networkIps.length > 1 && (
            <div className="p-2.5 rounded-xl glass-card text-[11px] text-slate-300 flex flex-wrap items-center gap-1.5">
              <span className="text-slate-400 font-semibold">IP:</span>
              {networkIps.map((ip) => (
                <button
                  key={ip}
                  onClick={() => setSelectedIp(ip)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all ${
                    selectedIp === ip
                      ? 'glass-btn-primary font-bold'
                      : 'glass-pill text-slate-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {ip.startsWith('192.168.137.') ? `Hotspot (${ip})` : ip}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Direct Live QR Code */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center">
          <div className="relative group p-3.5 bg-white/95 rounded-2xl shadow-[0_0_40px_rgba(59,130,246,0.3)] ring-2 ring-cyan-400/30">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="QR Code"
                className="w-48 h-48 sm:w-56 sm:h-56 object-contain rounded-xl"
              />
            ) : (
              <div className="w-48 h-48 sm:w-56 sm:h-56 flex flex-col items-center justify-center text-slate-400">
                <QrCode className="w-8 h-8 animate-pulse text-blue-500 mb-1" />
                <span className="text-xs">Generating QR...</span>
              </div>
            )}

            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full glass-modal border-white/20 text-slate-100 text-[10px] font-bold shadow-lg flex items-center gap-1.5 whitespace-nowrap">
              <Smartphone className="w-3 h-3 text-cyan-400" />
              <span>Scan with Mobile App</span>
            </div>
          </div>

          {/* Direct Base URL Container */}
          <div className="mt-5 w-full max-w-xs text-center">
            <div className="p-1.5 px-2.5 rounded-xl glass-card font-mono text-[11px] text-slate-300 flex items-center justify-between gap-1.5 min-w-0 border-white/10">
              <div className="overflow-x-auto whitespace-nowrap scrollbar-thin select-all flex-1 text-left min-w-0 py-0.5 text-slate-300">
                <span>{effectiveBaseUrl}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-1.5">
                <button
                  onClick={copyUrl}
                  className="text-[10px] px-2 py-0.5 rounded-lg glass-btn-secondary text-cyan-300 font-semibold flex items-center gap-0.5"
                >
                  <Copy className="w-2.5 h-2.5" />
                  <span>{copiedUrl ? 'Copied' : 'Copy'}</span>
                </button>
                <button
                  onClick={shareUrl}
                  className="text-[10px] px-2 py-0.5 rounded-lg glass-btn-accent text-white font-semibold flex items-center gap-0.5"
                >
                  <Share2 className="w-2.5 h-2.5" />
                  <span>Share</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
