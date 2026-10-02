import React from 'react';
import { Wifi, QrCode, HelpCircle } from 'lucide-react';
import { ConnectionMode } from '../types/transfer';

interface HeaderProps {
  roomId?: string;
  connectionMode: ConnectionMode;
  connectedCount: number;
  deviceType?: 'mobile' | 'laptop';
  onOpenQR: () => void;
  onOpenScanner?: () => void;
  onOpenGuide: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenQR,
  onOpenGuide,
}) => {
  return (
    <header className="w-full border-b border-[#E8E0D1] bg-[#FAF8F5]/80 backdrop-blur-2xl sticky top-0 z-40 shadow-[0_4px_20px_rgba(24,90,219,0.03)] transition-all">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
        {/* Brand - Cobalt Blue + Tangerine on Cream Linen */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#185ADB] to-[#FF8A3D] flex items-center justify-center shadow-md shadow-[#185ADB]/25 text-white shrink-0">
            <Wifi className="w-4 h-4 stroke-[2.5]" />
          </div>
          <span className="font-extrabold tracking-tight text-slate-900 text-base">
            HotSpot<span className="text-[#185ADB]">Drop</span>
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Hotspot Guide Button */}
          <button
            onClick={onOpenGuide}
            className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-700 hover:text-[#FF8A3D] bg-white/90 hover:bg-white border border-[#E8E0D1] shadow-2xs flex items-center gap-1.5 transition-all hover:shadow-xs"
            title="Guide"
          >
            <HelpCircle className="w-3.5 h-3.5 text-[#FF8A3D]" />
            <span className="hidden xs:inline">Guide</span>
          </button>

          {/* QR Code Button - Cobalt Blue Accent */}
          <button
            onClick={onOpenQR}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold text-white bg-[#185ADB] hover:bg-[#1246AB] shadow-xs shadow-[#185ADB]/20 flex items-center gap-1.5 transition-all active:scale-95"
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
