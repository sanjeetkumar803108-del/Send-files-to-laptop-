import React, { useState } from 'react';
import { Wifi, QrCode, HelpCircle, Copy, Check } from 'lucide-react';
import { ConnectionMode } from '../types/transfer';

interface HeaderProps {
  roomId: string;
  connectionMode: ConnectionMode;
  connectedCount: number;
  deviceType?: 'mobile' | 'laptop';
  onOpenQR: () => void;
  onOpenScanner?: () => void;
  onOpenGuide: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  roomId,
  onOpenQR,
  onOpenGuide,
}) => {
  const [copiedPin, setCopiedPin] = useState(false);

  const copyPin = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(roomId);
      setCopiedPin(true);
      setTimeout(() => setCopiedPin(false), 2000);
    }
  };

  return (
    <header className="w-full border-b border-white/80 bg-white/70 backdrop-blur-2xl sticky top-0 z-40 shadow-[0_4px_20px_rgba(0,0,0,0.03)] transition-all">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
        {/* Brand - Clean & Minimal */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center shadow-md shadow-indigo-500/20 text-white shrink-0">
            <Wifi className="w-4 h-4 stroke-[2.5]" />
          </div>
          <span className="font-extrabold tracking-tight text-slate-900 text-base">
            HotSpot<span className="text-indigo-600">Drop</span>
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* PIN Pill */}
          <button
            onClick={copyPin}
            title="Copy PIN"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/80 hover:bg-white border border-slate-200/90 text-slate-700 text-xs font-mono font-medium shadow-xs transition-all hover:shadow-sm"
          >
            <span className="text-slate-400 font-sans text-[11px]">PIN:</span>
            <span className="text-indigo-600 font-bold tracking-wider">{roomId.replace(/(\d{3})(\d{3})/, '$1 $2')}</span>
            {copiedPin ? <Check className="w-3.5 h-3.5 text-emerald-600 ml-0.5" /> : <Copy className="w-3.5 h-3.5 text-slate-400 ml-0.5" />}
          </button>

          {/* Hotspot Guide Button */}
          <button
            onClick={onOpenGuide}
            className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white/80 hover:bg-white border border-slate-200/90 shadow-xs flex items-center gap-1.5 transition-all hover:shadow-sm"
            title="Guide"
          >
            <HelpCircle className="w-3.5 h-3.5 text-emerald-600" />
            <span className="hidden xs:inline">Guide</span>
          </button>

          {/* QR Code Button */}
          <button
            onClick={onOpenQR}
            className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white/80 hover:bg-white border border-slate-200/90 shadow-xs flex items-center gap-1.5 transition-all hover:shadow-sm"
            title="QR Code"
          >
            <QrCode className="w-3.5 h-3.5 text-indigo-600" />
            <span className="hidden xs:inline">QR</span>
          </button>
        </div>
      </div>
    </header>
  );
};
