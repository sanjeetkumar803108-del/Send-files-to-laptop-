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
    <div className="relative overflow-hidden rounded-3xl bg-white/75 backdrop-blur-2xl border border-white/80 shadow-[0_10px_35px_rgba(0,0,0,0.04)] p-5 sm:p-7">
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Left Column: 6-Digit PIN */}
        <div className="lg:col-span-7 space-y-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
              Pairing
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-tight mt-1.5">
              Scan QR
            </h2>
          </div>

          {/* 6-Digit PIN Showcase */}
          <div className="p-3.5 rounded-2xl bg-white/80 border border-slate-200/80 shadow-xs flex items-center justify-between gap-4">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                PIN
              </span>
              <div className="text-3xl sm:text-4xl font-mono font-extrabold tracking-widest text-indigo-600 mt-0.5">
                {roomId.replace(/(\d{3})(\d{3})/, '$1 $2')}
              </div>
            </div>

            <button
              onClick={copyPin}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-semibold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-xs"
            >
              {copiedPin ? <Check className="w-3.5 h-3.5 text-emerald-200" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedPin ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          {/* Network IP selector if multiple IPs */}
          {networkIps.length > 1 && (
            <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 flex flex-wrap items-center gap-1.5">
              <span className="text-slate-400 font-medium">IP:</span>
              {networkIps.map((ip) => (
                <button
                  key={ip}
                  onClick={() => setSelectedIp(ip)}
                  className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
                    selectedIp === ip
                      ? 'bg-indigo-600 text-white font-bold'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
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
          <div className="relative group p-3.5 bg-white rounded-2xl shadow-md border border-slate-100 ring-2 ring-indigo-500/10">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="QR Code"
                className="w-48 h-48 sm:w-56 sm:h-56 object-contain rounded-lg"
              />
            ) : (
              <div className="w-48 h-48 sm:w-56 sm:h-56 flex flex-col items-center justify-center text-slate-400">
                <QrCode className="w-8 h-8 animate-pulse text-indigo-500 mb-1" />
                <span className="text-xs">QR...</span>
              </div>
            )}

            <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-white border border-slate-200 text-slate-700 text-[10px] font-bold shadow-xs flex items-center gap-1 whitespace-nowrap">
              <Smartphone className="w-3 h-3 text-indigo-600" />
              <span>Scan QR</span>
            </div>
          </div>

          <div className="mt-4 w-full max-w-xs text-center">
            <div className="p-1.5 px-2.5 rounded-xl bg-slate-50 border border-slate-200 font-mono text-[11px] text-slate-600 flex items-center justify-between truncate shadow-2xs">
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
