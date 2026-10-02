import React, { useState } from 'react';
import { Wifi, QrCode, HelpCircle, Copy, Check, Globe, Camera } from 'lucide-react';
import { ConnectionMode } from '../types/transfer';

interface HeaderProps {
  roomId: string;
  connectionMode: ConnectionMode;
  connectedCount: number;
  deviceType?: 'mobile' | 'laptop';
  lang: 'hi' | 'en';
  onToggleLang: () => void;
  onOpenQR: () => void;
  onOpenScanner?: () => void;
  onOpenGuide: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  roomId,
  connectionMode,
  connectedCount,
  deviceType,
  lang,
  onToggleLang,
  onOpenQR,
  onOpenScanner,
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

  const getStatusBadge = () => {
    if (connectionMode === 'direct_p2p') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          {lang === 'hi' ? 'Direct Hotspot P2P (Full Speed)' : 'Direct Hotspot P2P'}
        </span>
      );
    }
    if (connectionMode === 'relay') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
          <span className="w-2 h-2 rounded-full bg-cyan-400" />
          {lang === 'hi' ? 'Connected (Fast Relay)' : 'Connected (Relay)'}
        </span>
      );
    }
    if (connectionMode === 'connecting') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          {connectedCount > 0 ? (lang === 'hi' ? 'Pairing...' : 'Pairing...') : (lang === 'hi' ? 'Waiting for Device...' : 'Waiting for Peer...')}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
        <span className="w-2 h-2 rounded-full bg-slate-500" />
        {lang === 'hi' ? 'Disconnected' : 'Disconnected'}
      </span>
    );
  };

  return (
    <header className="w-full border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white shrink-0">
            <Wifi className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold tracking-tight text-white text-base sm:text-lg">
                HotSpot<span className="text-indigo-400">Drop</span>
              </span>
              <span className="hidden sm:inline-block text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                P2P Local
              </span>
            </div>
            <p className="text-[10px] text-slate-400 hidden sm:block">
              {lang === 'hi' ? 'Mobile se Laptop Direct File Transfer' : 'Mobile to Laptop Direct File Transfer'}
            </p>
          </div>
        </div>

        {/* Center / Status */}
        <div className="hidden md:flex items-center gap-3">
          {getStatusBadge()}
          <button
            onClick={copyPin}
            title={lang === 'hi' ? 'Room PIN copy karein' : 'Click to copy PIN'}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-mono font-medium transition-colors"
          >
            <span className="text-slate-500">PIN:</span>
            <span className="text-indigo-300 font-bold tracking-wider">{roomId.replace(/(\d{3})(\d{3})/, '$1 $2')}</span>
            {copiedPin ? <Check className="w-3.5 h-3.5 text-emerald-400 ml-1" /> : <Copy className="w-3.5 h-3.5 text-slate-400 ml-1" />}
          </button>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Mobile status indicator */}
          <div className="md:hidden">
            {getStatusBadge()}
          </div>

          {/* Camera Scanner for Mobile */}
          {deviceType === 'mobile' && onOpenScanner && (
            <button
              onClick={onOpenScanner}
              className="p-2 sm:px-2.5 sm:py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 flex items-center gap-1 shadow-sm transition-colors"
              title={lang === 'hi' ? 'Laptop QR Scan Karein' : 'Scan Laptop QR'}
            >
              <Camera className="w-4 h-4" />
              <span className="hidden xs:inline">{lang === 'hi' ? 'Scan' : 'Scan'}</span>
            </button>
          )}

          {/* Hotspot Guide Button */}
          <button
            onClick={onOpenGuide}
            className="p-2 sm:px-3 sm:py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center gap-1.5 transition-colors"
            title={lang === 'hi' ? 'Hotspot setup guide' : 'Hotspot Guide'}
          >
            <HelpCircle className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">{lang === 'hi' ? 'Hotspot Guide' : 'Guide'}</span>
          </button>

          {/* QR Code Button */}
          <button
            onClick={onOpenQR}
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center gap-1.5 transition-colors"
            title={lang === 'hi' ? 'QR Code / PIN open karein' : 'Open QR Code'}
          >
            <QrCode className="w-4 h-4 text-indigo-400" />
            <span className="hidden xs:inline">{lang === 'hi' ? 'QR / PIN' : 'QR / PIN'}</span>
          </button>

          {/* Language Toggle */}
          <button
            onClick={onToggleLang}
            className="p-2 sm:px-2.5 sm:py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 flex items-center gap-1 transition-colors"
            title="Toggle Language"
          >
            <Globe className="w-3.5 h-3.5" />
            <span className="text-[11px] font-bold">{lang === 'hi' ? 'EN' : 'हिन्दी'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
