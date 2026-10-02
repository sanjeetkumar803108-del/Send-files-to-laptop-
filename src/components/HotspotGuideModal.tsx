import React from 'react';
import { X, Wifi, Smartphone, Laptop, Zap, CheckCircle2, ShieldCheck, ArrowRight } from 'lucide-react';

interface HotspotGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: 'hi' | 'en';
}

export const HotspotGuideModal: React.FC<HotspotGuideModalProps> = ({ isOpen, onClose, lang }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-[#FAF8F5]/98 border border-[#E8E0D1] rounded-3xl shadow-2xl p-6 text-slate-800 overflow-hidden max-h-[90vh] overflow-y-auto backdrop-blur-2xl">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-[#E8E0D1]/50 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 bg-[#EEF4FD] text-[#185ADB] rounded-2xl border border-[#185ADB]/20 shadow-inner">
            <Wifi className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">
              {lang === 'hi' ? 'Mobile Hotspot Se Direct Transfer' : 'Direct Mobile Hotspot Transfer'}
            </h2>
            <p className="text-xs text-slate-500">
              {lang === 'hi'
                ? 'Zero Internet Data - Direct High-Speed Wi-Fi Transfer'
                : 'Zero Internet Data - Direct High-Speed Wi-Fi Transfer'}
            </p>
          </div>
        </div>

        {/* 4 Clean Steps */}
        <div className="space-y-3 my-5 text-sm">
          {/* Step 1 */}
          <div className="p-3 bg-[#F5F1E8]/70 border border-[#E8E0D1] rounded-xl flex items-start gap-3">
            <div className="w-6 h-6 rounded-lg bg-[#EEF4FD] text-[#185ADB] font-bold text-xs flex items-center justify-center shrink-0 border border-[#185ADB]/20">
              1
            </div>
            <div>
              <h4 className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                <Smartphone className="w-3.5 h-3.5 text-[#185ADB]" />
                {lang === 'hi' ? 'Phone me Hotspot ON karein' : 'Turn on Mobile Hotspot'}
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {lang === 'hi'
                  ? 'Phone Settings me jakar Personal Hotspot chalu karein.'
                  : 'Turn on Personal Hotspot in your mobile settings.'}
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="p-3 bg-[#F5F1E8]/70 border border-[#E8E0D1] rounded-xl flex items-start gap-3">
            <div className="w-6 h-6 rounded-lg bg-[#FFF5EE] text-[#FF8A3D] font-bold text-xs flex items-center justify-center shrink-0 border border-[#FF8A3D]/25">
              2
            </div>
            <div>
              <h4 className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                <Laptop className="w-3.5 h-3.5 text-[#FF8A3D]" />
                {lang === 'hi' ? 'Laptop ko Phone Hotspot se connect karein' : 'Connect Laptop to Hotspot'}
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {lang === 'hi'
                  ? 'Laptop ke Wi-Fi se apne mobile hotspot ko connect karein.'
                  : 'Connect your laptop Wi-Fi to your phone\'s hotspot network.'}
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="p-3 bg-[#F5F1E8]/70 border border-[#E8E0D1] rounded-xl flex items-start gap-3">
            <div className="w-6 h-6 rounded-lg bg-[#EEF4FD] text-[#185ADB] font-bold text-xs flex items-center justify-center shrink-0 border border-[#185ADB]/20">
              3
            </div>
            <div>
              <h4 className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                <Zap className="w-3.5 h-3.5 text-[#185ADB]" />
                {lang === 'hi' ? 'QR Code scan karein ya PIN dalein' : 'Scan QR Code or Enter PIN'}
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {lang === 'hi'
                  ? 'Laptop screen ka QR scan karein ya phone me 6-digit PIN dalein.'
                  : 'Scan the laptop QR code or enter the 6-digit PIN.'}
              </p>
            </div>
          </div>

          {/* Step 4 */}
          <div className="p-3 bg-[#F5F1E8]/70 border border-[#E8E0D1] rounded-xl flex items-start gap-3">
            <div className="w-6 h-6 rounded-lg bg-[#FFF5EE] text-[#FF8A3D] font-bold text-xs flex items-center justify-center shrink-0 border border-[#FF8A3D]/25">
              4
            </div>
            <div>
              <h4 className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#FF8A3D]" />
                {lang === 'hi' ? 'Files drop karein aur Send karein' : 'Drop Files & Hit Send'}
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {lang === 'hi'
                  ? 'Files direct local high-speed frequency par stream hongi.'
                  : 'Files stream locally with full offline speed.'}
              </p>
            </div>
          </div>
        </div>

        {/* Security badge */}
        <div className="p-3 rounded-xl bg-[#FFF5EE]/70 border border-[#FF8A3D]/25 space-y-1 text-xs">
          <div className="flex items-center gap-2 text-[#FF8A3D] font-semibold">
            <ShieldCheck className="w-4 h-4" />
            <span>
              {lang === 'hi' ? '100% Private & P2P Encrypted' : '100% Private & P2P Encrypted'}
            </span>
          </div>
          <p className="text-slate-600 text-[11px]">
            {lang === 'hi'
              ? 'Files direct phone aur laptop ke beech stream hoti hain bina kisi server par upload huye.'
              : 'Direct peer-to-peer data channel. Files are never stored on any server.'}
          </p>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 bg-[#185ADB] hover:bg-[#1349b0] text-white font-semibold text-xs rounded-xl transition-colors shadow-md shadow-[#185ADB]/20 flex items-center justify-center gap-2"
          >
            <span>Close</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
