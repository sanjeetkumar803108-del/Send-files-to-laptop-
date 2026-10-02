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
      <div className="relative w-full max-w-lg bg-white/95 border border-white/80 rounded-3xl shadow-2xl p-6 text-slate-800 overflow-hidden max-h-[90vh] overflow-y-auto backdrop-blur-2xl">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100 shadow-inner">
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
          <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex items-start gap-3">
            <div className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-600 font-bold text-xs flex items-center justify-center shrink-0 border border-indigo-100">
              1
            </div>
            <div>
              <h4 className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                <Smartphone className="w-3.5 h-3.5 text-indigo-600" />
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
          <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex items-start gap-3">
            <div className="w-6 h-6 rounded-lg bg-cyan-50 text-cyan-600 font-bold text-xs flex items-center justify-center shrink-0 border border-cyan-100">
              2
            </div>
            <div>
              <h4 className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                <Laptop className="w-3.5 h-3.5 text-cyan-600" />
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
          <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex items-start gap-3">
            <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 font-bold text-xs flex items-center justify-center shrink-0 border border-emerald-100">
              3
            </div>
            <div>
              <h4 className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                <Zap className="w-3.5 h-3.5 text-emerald-600" />
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
          <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex items-start gap-3">
            <div className="w-6 h-6 rounded-lg bg-purple-50 text-purple-600 font-bold text-xs flex items-center justify-center shrink-0 border border-purple-100">
              4
            </div>
            <div>
              <h4 className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                <CheckCircle2 className="w-3.5 h-3.5 text-purple-600" />
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
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1 text-xs">
          <div className="flex items-center gap-2 text-emerald-600 font-semibold">
            <ShieldCheck className="w-4 h-4" />
            <span>
              {lang === 'hi' ? '100% Private & P2P Encrypted' : '100% Private & P2P Encrypted'}
            </span>
          </div>
          <p className="text-slate-500 text-[11px]">
            {lang === 'hi'
              ? 'Files direct phone aur laptop ke beech stream hoti hain bina kisi server par upload huye.'
              : 'Direct peer-to-peer data channel. Files are never stored on any server.'}
          </p>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl transition-colors shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2"
          >
            <span>{lang === 'hi' ? 'Theek Hai (Close)' : 'Got It, Close'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
