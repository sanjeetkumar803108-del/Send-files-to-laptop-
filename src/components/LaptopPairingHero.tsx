import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  QrCode,
  Copy,
  Check,
  Smartphone,
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
          dark: '#0f172a',
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
    <div className="relative overflow-hidden rounded-3xl bg-white/75 backdrop-blur-2xl border border-white/80 shadow-[0_10px_35px_rgba(0,0,0,0.05)] p-6 sm:p-8">
      {/* Subtle decorative color aura */}
      <div className="absolute -top-20 -right-20 w-72 h-72 bg-indigo-200/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -left-20 w-72 h-72 bg-cyan-200/30 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left Column: 6-Digit PIN & Connection Info */}
        <div className="lg:col-span-7 space-y-5">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50/80 px-2.5 py-1 rounded-full border border-indigo-100/80">
              {lang === 'hi' ? 'Fast Connect' : 'Instant Pair'}
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-tight mt-2.5">
              {lang === 'hi' ? (
                <>
                  QR Scan करें या <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-cyan-600">PIN डालें</span>
                </>
              ) : (
                <>
                  Scan QR or <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-cyan-600">Enter PIN</span>
                </>
              )}
            </h2>
          </div>

          {/* 6-Digit PIN Showcase */}
          <div className="p-4 rounded-2xl bg-white/80 border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">
                {lang === 'hi' ? '6-Digit Pairing PIN' : '6-Digit Pairing PIN'}
              </span>
              <div className="text-3xl sm:text-4xl font-mono font-extrabold tracking-widest text-indigo-600 mt-0.5">
                {roomId.replace(/(\d{3})(\d{3})/, '$1 $2')}
              </div>
            </div>

            <button
              onClick={copyPin}
              className="w-full sm:w-auto px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-md shadow-indigo-600/20"
            >
              {copiedPin ? <Check className="w-4 h-4 text-emerald-200" /> : <Copy className="w-4 h-4" />}
              <span>{copiedPin ? (lang === 'hi' ? 'PIN Copied!' : 'PIN Copied!') : (lang === 'hi' ? 'Copy PIN' : 'Copy PIN')}</span>
            </button>
          </div>

          {/* Network IP selector if multiple IPs */}
          {networkIps.length > 1 && (
            <div className="p-2.5 rounded-xl bg-slate-50/80 border border-slate-200/80 text-[11px] text-slate-600 flex flex-wrap items-center gap-2">
              <span className="text-slate-500 font-medium">{lang === 'hi' ? 'Active IP:' : 'Active IP:'}</span>
              {networkIps.map((ip) => (
                <button
                  key={ip}
                  onClick={() => setSelectedIp(ip)}
                  className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
                    selectedIp === ip
                      ? 'bg-indigo-600 text-white font-bold shadow-sm'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
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
          <div className="relative group p-4 sm:p-5 bg-white rounded-3xl shadow-xl border border-slate-100 ring-4 ring-indigo-500/10 transition-all hover:scale-[1.02]">
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
            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-white border border-slate-200 text-slate-700 text-[10px] font-bold shadow-md flex items-center gap-1.5 whitespace-nowrap">
              <Smartphone className="w-3 h-3 text-indigo-600" />
              <span>{lang === 'hi' ? 'Phone कैमरे से Scan करें' : 'Scan with Phone Camera'}</span>
            </div>
          </div>

          {/* Quick URL for manual opening */}
          <div className="mt-5 w-full max-w-xs text-center">
            <div className="p-2 rounded-xl bg-slate-50/80 border border-slate-200/80 font-mono text-[11px] text-slate-600 flex items-center justify-between truncate shadow-sm">
              <span className="truncate">{effectiveBaseUrl}</span>
              <button
                onClick={copyUrl}
                className="text-[10px] px-2 py-0.5 rounded bg-white hover:bg-slate-100 text-slate-700 shrink-0 ml-1.5 border border-slate-200 font-medium"
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
