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
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          {lang === 'hi' ? 'Direct Hotspot P2P (Full Speed)' : 'Direct Hotspot P2P'}
        </span>
      );
    }
    if (connectionMode === 'relay') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-sky-50 text-sky-700 border border-sky-200/80 shadow-xs">
          <span className="w-2 h-2 rounded-full bg-sky-500" />
          {lang === 'hi' ? 'Connected (Fast Relay)' : 'Connected (Relay)'}
        </span>
      );
    }
    if (connectionMode === 'connecting') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200/80 shadow-xs">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
          {connectedCount > 0 ? (lang === 'hi' ? 'Pairing...' : 'Pairing...') : (lang === 'hi' ? 'Waiting for Device...' : 'Waiting for Peer...')}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
        <span className="w-2 h-2 rounded-full bg-slate-400" />
        {lang === 'hi' ? 'Disconnected' : 'Disconnected'}
      </span>
    );
  };

  return (
    <header className="w-full border-b border-white/80 bg-white/70 backdrop-blur-2xl sticky top-0 z-40 shadow-[0_4px_20px_rgba(0,0,0,0.03)] transition-all">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 flex items-center justify-center shadow-md shadow-indigo-500/20 text-white shrink-0">
            <Wifi className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-extrabold tracking-tight text-slate-900 text-base sm:text-lg">
              HotSpot<span className="text-indigo-600">Drop</span>
            </span>
            <span className="hidden sm:inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/80 shadow-xs">
              P2P Local
            </span>
          </div>
        </div>

        {/* Center / Status */}
        <div className="hidden md:flex items-center gap-3">
          {getStatusBadge()}
          <button
            onClick={copyPin}
            title={lang === 'hi' ? 'Room PIN copy karein' : 'Click to copy PIN'}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/80 hover:bg-white border border-slate-200/90 text-slate-700 text-xs font-mono font-medium shadow-xs transition-all hover:shadow-sm"
          >
            <span className="text-slate-400 font-sans text-[11px]">PIN:</span>
            <span className="text-indigo-600 font-bold tracking-wider">{roomId.replace(/(\d{3})(\d{3})/, '$1 $2')}</span>
            {copiedPin ? <Check className="w-3.5 h-3.5 text-emerald-600 ml-1" /> : <Copy className="w-3.5 h-3.5 text-slate-400 ml-1" />}
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
              className="p-2 sm:px-3 sm:py-1.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 flex items-center gap-1 shadow-md shadow-indigo-600/20 transition-all hover:scale-105 active:scale-95"
              title={lang === 'hi' ? 'Laptop QR Scan Karein' : 'Scan Laptop QR'}
            >
              <Camera className="w-4 h-4" />
              <span className="hidden xs:inline">{lang === 'hi' ? 'Scan' : 'Scan'}</span>
            </button>
          )}

          {/* Hotspot Guide Button */}
          <button
            onClick={onOpenGuide}
            className="p-2 sm:px-3 sm:py-1.5 rounded-xl text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white/80 hover:bg-white border border-slate-200/90 shadow-xs flex items-center gap-1.5 transition-all hover:shadow-sm"
            title={lang === 'hi' ? 'Hotspot setup guide' : 'Hotspot Guide'}
          >
            <HelpCircle className="w-4 h-4 text-emerald-600" />
            <span className="hidden sm:inline">{lang === 'hi' ? 'Hotspot Guide' : 'Guide'}</span>
          </button>

          {/* QR Code Button */}
          <button
            onClick={onOpenQR}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white/80 hover:bg-white border border-slate-200/90 shadow-xs flex items-center gap-1.5 transition-all hover:shadow-sm"
            title={lang === 'hi' ? 'QR Code / PIN open karein' : 'Open QR Code'}
          >
            <QrCode className="w-4 h-4 text-indigo-600" />
            <span className="hidden xs:inline">{lang === 'hi' ? 'QR / PIN' : 'QR / PIN'}</span>
          </button>

          {/* Language Toggle */}
          <button
            onClick={onToggleLang}
            className="p-2 sm:px-2.5 sm:py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 bg-white/80 hover:bg-white border border-slate-200/90 shadow-xs flex items-center gap-1 transition-all"
            title="Toggle Language"
          >
            <Globe className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[11px]">{lang === 'hi' ? 'EN' : 'हिन्दी'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
