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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 text-slate-100 overflow-hidden max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
            <Wifi className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-white">
              {lang === 'hi' ? 'Mobile Hotspot Se Transfer Kaise Karein?' : 'How To Transfer Over Mobile Hotspot?'}
            </h2>
            <p className="text-xs text-slate-400">
              {lang === 'hi'
                ? 'Direct Local Transfer Guide (Zero Internet Data Usage)'
                : 'Direct Local P2P Transfer Guide (Zero Internet Data Consumed)'}
            </p>
          </div>
        </div>

        {/* 4 Steps */}
        <div className="space-y-3.5 my-5 text-sm">
          {/* Step 1 */}
          <div className="p-3.5 bg-slate-950/70 border border-slate-800/80 rounded-xl flex items-start gap-3.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-400 font-bold flex items-center justify-center shrink-0 border border-indigo-500/20">
              1
            </div>
            <div>
              <h4 className="font-semibold text-white flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-indigo-400" />
                {lang === 'hi' ? 'Mobile me Hotspot ON karein' : 'Turn on Mobile Hotspot'}
              </h4>
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                {lang === 'hi'
                  ? 'Apne phone ki Settings me jayein aur "Personal Hotspot" ya "Portable Hotspot" ko enable karein.'
                  : 'Open your mobile settings and turn on "Personal Hotspot" or "Wi-Fi Hotspot".'}
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="p-3.5 bg-slate-950/70 border border-slate-800/80 rounded-xl flex items-start gap-3.5">
            <div className="w-7 h-7 rounded-lg bg-cyan-500/10 text-cyan-400 font-bold flex items-center justify-center shrink-0 border border-cyan-500/20">
              2
            </div>
            <div>
              <h4 className="font-semibold text-white flex items-center gap-1.5">
                <Laptop className="w-4 h-4 text-cyan-400" />
                {lang === 'hi' ? 'Laptop ko Phone ke Hotspot se connect karein' : 'Connect Laptop to Phone Wi-Fi'}
              </h4>
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                {lang === 'hi'
                  ? 'Laptop ke Wi-Fi menu me jakar apne mobile hotspot ka name select karein aur connect karein.'
                  : 'On your laptop, click Wi-Fi and connect to your phone\'s hotspot network.'}
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="p-3.5 bg-slate-950/70 border border-slate-800/80 rounded-xl flex items-start gap-3.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 font-bold flex items-center justify-center shrink-0 border border-emerald-500/20">
              3
            </div>
            <div>
              <h4 className="font-semibold text-white flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-emerald-400" />
                {lang === 'hi' ? 'App khol kar QR Code scan karein' : 'Scan QR Code or Enter PIN'}
              </h4>
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                {lang === 'hi'
                  ? 'Laptop screen par dikh rahe QR code ko phone ke camera se scan karein ya 6-digit PIN enter karein.'
                  : 'Open this app on both devices and scan the Laptop QR code using your phone camera.'}
              </p>
            </div>
          </div>

          {/* Step 4 */}
          <div className="p-3.5 bg-slate-950/70 border border-slate-800/80 rounded-xl flex items-start gap-3.5">
            <div className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-400 font-bold flex items-center justify-center shrink-0 border border-purple-500/20">
              4
            </div>
            <div>
              <h4 className="font-semibold text-white flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-purple-400" />
                {lang === 'hi' ? 'Files select karein aur Send par tap karein' : 'Select Files & Hit Send'}
              </h4>
              <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                {lang === 'hi'
                  ? 'Photos, Videos, large files ya folders choose karein. Files direct hotspot frequency pe transfer hongi!'
                  : 'Pick photos, 4K videos, heavy documents or whole folders. Direct P2P transfer happens at up to 80+ MB/s!'}
              </p>
            </div>
          </div>
        </div>

        {/* Technical Highlights / Why it's reliable */}
        <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-2 text-xs">
          <div className="flex items-center gap-2 text-emerald-400 font-medium">
            <ShieldCheck className="w-4 h-4" />
            <span>
              {lang === 'hi' ? 'Kyun yeh bilkul secure aur fast hai?' : 'Why is this ultra-fast and secure?'}
            </span>
          </div>
          <p className="text-slate-400 leading-relaxed text-[11px]">
            {lang === 'hi'
              ? 'WebRTC DataChannel protocol use hota hai. Files kisi bhi third-party server par upload nahi hoti, balki direct aapke phone se laptop ke hardware me stream hoti hain!'
              : 'End-to-end encrypted direct WebRTC channel is used. Your files never touch any external cloud storage or leak bandwidth.'}
          </p>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs rounded-xl transition-colors shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2"
          >
            <span>{lang === 'hi' ? 'Samajh Gaya (Close)' : 'Got It, Let\'s Transfer'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
