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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white/95 border border-white/80 rounded-3xl shadow-2xl p-6 text-slate-800 overflow-hidden max-h-[92vh] overflow-y-auto backdrop-blur-2xl">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition-colors z-10"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center">
          <div className="inline-flex p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl mb-2 border border-indigo-100 shadow-inner">
            <QrCode className="w-5 h-5" />
          </div>
          <h2 className="text-lg font-bold tracking-tight text-slate-900">
            {lang === 'hi' ? 'Device Pairing' : 'Device Pairing'}
          </h2>
        </div>

        {/* QR Code Container */}
        <div className="mt-4 flex flex-col items-center justify-center">
          <div className="p-3 bg-white rounded-2xl shadow-md border border-slate-200">
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
          <div className="mt-4 w-full bg-slate-50 border border-slate-200/80 rounded-xl p-3 flex items-center justify-between shadow-2xs">
            <div className="text-left">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
                {lang === 'hi' ? '6-Digit PIN' : '6-Digit PIN'}
              </span>
              <p className="text-xl font-mono font-bold tracking-widest text-indigo-600">
                {roomId.replace(/(\d{3})(\d{3})/, '$1 $2')}
              </p>
            </div>
            <button
              onClick={copyPin}
              className="px-3 py-1.5 text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 rounded-lg flex items-center gap-1.5 transition-colors border border-slate-200 shadow-2xs"
            >
              {copiedPin ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedPin ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          {/* Quick URL Box */}
          <div className="mt-3 w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 font-mono text-[11px] text-slate-700 flex items-center justify-between truncate shadow-2xs">
            <span className="truncate">{effectiveBaseUrl}</span>
            <button
              onClick={copyUrl}
              className="text-xs px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 ml-2 font-medium"
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
                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/20 transition-colors"
              >
                <Camera className="w-4 h-4" />
                <span>Scan</span>
              </button>
            )}

            <button
              onClick={shareViaWhatsApp}
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 transition-colors"
            >
              <Share2 className="w-4 h-4" />
              <span>Share</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
