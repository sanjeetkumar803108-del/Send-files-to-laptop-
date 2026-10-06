import React from 'react';
import { Wifi, QrCode, HelpCircle } from 'lucide-react';
import { ConnectionMode } from '../types/transfer';

interface HeaderProps {
  roomId?: string;
  connectionMode: ConnectionMode;
  connectedCount: number;
  deviceType?: 'mobile' | 'laptop';
  signalingStatus?: 'connected' | 'connecting' | 'disconnected';
  onOpenQR: () => void;
  onOpenScanner?: () => void;
  onOpenGuide: () => void;
  onOpenServerSettings?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  signalingStatus,
  onOpenQR,
  onOpenGuide,
  onOpenServerSettings,
}) => {
  return (
    <header className="w-full border-b border-white/10 bg-[#070A12]/60 backdrop-blur-2xl sticky top-0 z-40 shadow-[0_8px_32px_rgba(0,0,0,0.5)] transition-all">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
        {/* Brand - Glowing Neon Glass Icon */}
        <div className="flex items-center gap-2.5">
          <div className="relative group">
            <div className="absolute -inset-1 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 opacity-60 blur-xs group-hover:opacity-100 transition duration-300" />
            <div className="relative w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 flex items-center justify-center text-white shrink-0 shadow-inner">
              <Wifi className="w-4 h-4 stroke-[2.5]" />
            </div>
          </div>
          <span className="font-extrabold tracking-tight text-white text-base">
            HotSpot<span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-300 bg-clip-text text-transparent">Drop</span>
          </span>
        </div>

        {/* Action Controls - Glass Buttons */}
        <div className="flex items-center gap-2">
          {/* Signaling Server Status Button */}
          {onOpenServerSettings && (
            <button
              onClick={onOpenServerSettings}
              className="px-2.5 py-1.5 rounded-xl text-xs font-semibold glass-btn-secondary flex items-center gap-1.5 active:scale-95"
              title="Signaling Server Settings"
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  signalingStatus === 'connected'
                    ? 'bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse'
                    : signalingStatus === 'connecting'
                    ? 'bg-amber-400 shadow-[0_0_8px_#fbbf24] animate-ping'
                    : 'bg-rose-500 shadow-[0_0_8px_#f43f5e]'
                }`}
              />
              <span className="hidden sm:inline text-slate-200">Server</span>
            </button>
          )}

          {/* Hotspot Guide Button */}
          <button
            onClick={onOpenGuide}
            className="px-2.5 py-1.5 rounded-xl text-xs font-semibold glass-btn-secondary flex items-center gap-1.5"
            title="Guide"
          >
            <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden xs:inline text-slate-200">Guide</span>
          </button>

          {/* QR Code Button */}
          <button
            onClick={onOpenQR}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold glass-btn-primary flex items-center gap-1.5 active:scale-95"
            title="QR Code"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">QR</span>
          </button>
        </div>
      </div>
    </header>
  );
};
