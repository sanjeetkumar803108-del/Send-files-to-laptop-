import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { QrCode, Copy, Check, X, Camera, Share2 } from 'lucide-react';
import { getPublicAppUrl } from '../utils/format';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  onOpenScanner?: () => void;
  lang: 'hi' | 'en';
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({
  isOpen,
  onClose,
  roomId,
  onOpenScanner,
  lang,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedPin, setCopiedPin] = useState(false);
  const [networkIps, setNetworkIps] = useState<string[]>([]);
  const [selectedIp, setSelectedIp] = useState<string>('');

  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/network-ip')
      .then((res) => res.json())
      .then((data) => {
        if (data?.ips && Array.isArray(data.ips) && data.ips.length > 0) {
          setNetworkIps(data.ips);
          const hotspotIp = data.ips.find((ip: string) => ip.startsWith('192.168.137.'))
            || data.ips.find((ip: string) => ip.startsWith('192.168.'))
            || data.ips[0];
          setSelectedIp(hotspotIp);
        }
      })
      .catch(() => {});
  }, [isOpen]);

  const getEffectiveBaseUrl = () => {
    if (typeof window === 'undefined') return '';
    const protocol = window.location.protocol;
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
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
    if (joinUrl && isOpen) {
      QRCode.toDataURL(joinUrl, {
        width: 320,
        margin: 2,
        color: {
          dark: '#080C16',
          light: '#FFFFFF',
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error('Failed to generate QR code:', err));
    }
  }, [joinUrl, isOpen]);

  if (!isOpen) return null;

  const copyUrl = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(joinUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    }
  };

  const copyPin = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(roomId);
      setCopiedPin(true);
      setTimeout(() => setCopiedPin(false), 2000);
    }
  };

  const shareLink = () => {
    if (navigator.share) {
      navigator.share({ text: effectiveBaseUrl }).catch(() => {
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(effectiveBaseUrl)}`, '_blank');
      });
    } else {
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(effectiveBaseUrl)}`, '_blank');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg glass-modal rounded-3xl p-6 text-slate-800 overflow-hidden max-h-[92vh] overflow-y-auto scrollbar-thin">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-800 rounded-full hover:bg-slate-100 transition-colors z-10"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center">
          <div className="inline-flex p-2.5 bg-blue-500/10 text-blue-600 rounded-2xl mb-2 border border-blue-400/25 shadow-xs">
            <QrCode className="w-5 h-5" />
          </div>
          <h2 className="text-lg font-bold tracking-tight text-slate-900">
            {lang === 'hi' ? 'डिवाइस कनेक्ट करें (Pairing)' : 'Connect Device (Pairing)'}
          </h2>
          <p className="text-xs text-slate-600 mt-1">
            Scan QR code or use the 6-digit PIN to establish instant direct P2P link
          </p>
        </div>

        {/* QR Code Container */}
        <div className="mt-4 flex flex-col items-center justify-center">
          <div className="p-3.5 bg-white rounded-2xl shadow-[0_12px_32px_rgba(37,99,235,0.12)] border border-slate-200/80 ring-4 ring-blue-500/10">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="Room Pairing QR Code"
                className="w-52 h-52 rounded-xl object-contain"
              />
            ) : (
              <div className="w-52 h-52 flex items-center justify-center text-slate-400">
                <span className="text-xs">Generating QR...</span>
              </div>
            )}
          </div>

          {/* 6-Digit Pair PIN */}
          <div className="mt-4 w-full glass-card border border-slate-200/80 rounded-2xl p-3 flex items-center justify-between shadow-xs">
            <div className="text-left">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
                6-DIGIT PIN
              </span>
              <p className="text-2xl font-mono font-extrabold tracking-widest bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 bg-clip-text text-transparent">
                {roomId.replace(/(\d{3})(\d{3})/, '$1 $2')}
              </p>
            </div>
            <button
              onClick={copyPin}
              className="px-3.5 py-1.5 text-xs font-semibold glass-btn-primary rounded-xl flex items-center gap-1.5 transition-all active:scale-95 shadow-sm"
            >
              {copiedPin ? <Check className="w-3.5 h-3.5 text-emerald-200" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedPin ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          {/* Quick URL Box */}
          <div className="mt-3 w-full p-2.5 rounded-2xl glass-card font-mono text-[11px] text-slate-700 flex items-center justify-between gap-1.5 min-w-0 border-slate-200/80">
            <div className="overflow-x-auto whitespace-nowrap scrollbar-thin select-all flex-1 text-left min-w-0 py-0.5 text-slate-700">
              <span>{effectiveBaseUrl}</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0 ml-2">
              <button
                onClick={copyUrl}
                className="text-xs px-2.5 py-1 rounded-lg glass-btn-primary font-medium flex items-center gap-1 shadow-xs"
              >
                <Copy className="w-3 h-3" />
                <span>{copiedUrl ? 'Copied' : 'Copy'}</span>
              </button>
              <button
                onClick={shareLink}
                className="text-xs px-2.5 py-1 rounded-lg glass-btn-accent font-medium flex items-center gap-1 shadow-xs"
              >
                <Share2 className="w-3 h-3" />
                <span>Share</span>
              </button>
            </div>
          </div>

          {/* Action Row */}
          <div className="mt-3.5 w-full grid grid-cols-2 gap-2.5">
            {onOpenScanner && (
              <button
                onClick={() => {
                  onClose();
                  onOpenScanner();
                }}
                className="px-4 py-2.5 glass-btn-primary rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-95 shadow-sm"
              >
                <Camera className="w-4 h-4" />
                <span>Open Scanner</span>
              </button>
            )}

            <button
              onClick={shareLink}
              className="px-4 py-2.5 glass-btn-accent rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 active:scale-95 shadow-sm"
            >
              <Share2 className="w-4 h-4" />
              <span>Share Link</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
