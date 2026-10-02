import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { QrCode, Copy, Check, X, Camera, Wifi, Laptop, Share2 } from 'lucide-react';
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

  // Fetch local network IPs from server
  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/network-ip')
      .then((res) => res.json())
      .then((data) => {
        if (data?.ips && Array.isArray(data.ips) && data.ips.length > 0) {
          setNetworkIps(data.ips);
          // Prefer hotspot IP (192.168.137.x or 192.168.x.x) if available
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

  const effectiveBaseUrl = getEffectiveBaseUrl();
  const joinUrl = `${effectiveBaseUrl}/?room=${roomId}&join=1`;

  useEffect(() => {
    if (joinUrl && isOpen) {
      QRCode.toDataURL(joinUrl, {
        width: 320,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
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

  const shareViaWhatsApp = () => {
    const text = encodeURIComponent(
      `Laptop me yeh link open karein aur files transfer karein:\n${joinUrl}\nPIN: ${roomId}`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 text-slate-100 overflow-hidden max-h-[92vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors z-10"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center">
          <div className="inline-flex p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl mb-2 border border-indigo-500/20">
            <QrCode className="w-5 h-5" />
          </div>
          <h2 className="text-lg font-bold tracking-tight text-white">
            {lang === 'hi' ? 'Device Pairing' : 'Device Pairing'}
          </h2>
        </div>

        {/* QR Code Container */}
        <div className="mt-4 flex flex-col items-center justify-center">
          <div className="p-3 bg-white rounded-2xl shadow-lg border border-slate-200">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="Room Pairing QR Code"
                className="w-52 h-52 rounded-lg object-contain"
              />
            ) : (
              <div className="w-52 h-52 flex items-center justify-center text-slate-400">
                <span className="text-xs">Generating QR...</span>
              </div>
            )}
          </div>

          {/* 6-Digit Pair PIN */}
          <div className="mt-4 w-full bg-slate-950/70 border border-slate-800 rounded-xl p-3 flex items-center justify-between">
            <div className="text-left">
              <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-500">
                {lang === 'hi' ? '6-Digit PIN' : '6-Digit PIN'}
              </span>
              <p className="text-xl font-mono font-bold tracking-widest text-emerald-400">
                {roomId.replace(/(\d{3})(\d{3})/, '$1 $2')}
              </p>
            </div>
            <button
              onClick={copyPin}
              className="px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg flex items-center gap-1.5 transition-colors border border-slate-700"
            >
              {copiedPin ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedPin ? 'Copied' : (lang === 'hi' ? 'Copy PIN' : 'Copy PIN')}
            </button>
          </div>

          {/* Quick URL Box */}
          <div className="mt-3 w-full p-2 rounded-xl bg-slate-950/80 border border-slate-800 font-mono text-[11px] text-cyan-300 flex items-center justify-between truncate">
            <span className="truncate">{effectiveBaseUrl}</span>
            <button
              onClick={copyUrl}
              className="text-xs px-2 py-0.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white shrink-0 ml-2"
            >
              {copiedUrl ? 'Copied' : 'Copy'}
            </button>
          </div>

          {/* Action Row */}
          <div className="mt-3 w-full grid grid-cols-2 gap-2">
            {onOpenScanner && (
              <button
                onClick={() => {
                  onClose();
                  onOpenScanner();
                }}
                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/20 transition-colors"
              >
                <Camera className="w-4 h-4" />
                <span>{lang === 'hi' ? 'Camera Scan' : 'Scan QR'}</span>
              </button>
            )}

            <button
              onClick={shareViaWhatsApp}
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 transition-colors"
            >
              <Share2 className="w-4 h-4" />
              <span>{lang === 'hi' ? 'WhatsApp' : 'Share'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
