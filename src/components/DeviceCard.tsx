import React, { useState } from 'react';
import {
  Smartphone,
  Laptop,
  CheckCircle2,
  RefreshCw,
  Edit2,
  Check,
  ArrowLeftRight,
  QrCode,
  KeyRound,
  Camera,
  AlertCircle,
} from 'lucide-react';
import { PeerDevice, ConnectionMode } from '../types/transfer';

interface DeviceCardProps {
  myDeviceName: string;
  myDeviceType: 'mobile' | 'laptop';
  onUpdateDeviceName: (name: string) => void;
  onToggleDeviceType: () => void;
  peers: PeerDevice[];
  connectionMode: ConnectionMode;
  onOpenQR: () => void;
  onOpenScanner?: () => void;
  onJoinRoom: (pin: string) => Promise<boolean> | void;
  lang: 'hi' | 'en';
}

export const DeviceCard: React.FC<DeviceCardProps> = ({
  myDeviceName,
  myDeviceType,
  onUpdateDeviceName,
  onToggleDeviceType,
  peers,
  connectionMode,
  onOpenQR,
  onOpenScanner,
  onJoinRoom,
  lang,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempName, setTempName] = useState(myDeviceName);
  const [inputPin, setInputPin] = useState('');
  const [showPinInput, setShowPinInput] = useState(true);
  const [isCheckingPin, setIsCheckingPin] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);

  const handleSaveName = () => {
    if (tempName.trim()) {
      onUpdateDeviceName(tempName.trim());
    }
    setIsEditing(false);
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPin = inputPin.replace(/\s+/g, '');
    
    if (cleanPin.length !== 6) {
      setPinError(
        lang === 'hi'
          ? 'PIN poore 6 digits ka hona chahiye (jaise: 482910)'
          : 'PIN must be exactly 6 digits (e.g. 482910)'
      );
      return;
    }

    setPinError(null);
    setIsCheckingPin(true);

    try {
      const res = await onJoinRoom(cleanPin);
      if (res === false) {
        setPinError(
          lang === 'hi'
            ? '❌ Galat PIN! Is PIN se koi laptop nahi mila. Laptop screen par check karein.'
            : '❌ Wrong PIN! No active laptop found with this PIN. Check your laptop screen.'
        );
      } else {
        setPinError(null);
        setInputPin('');
      }
    } catch {
      setPinError(
        lang === 'hi'
          ? '❌ Connect karne me error aayi. Dobara try karein.'
          : '❌ Connection error. Please try again.'
      );
    } finally {
      setIsCheckingPin(false);
    }
  };

  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '');
    setInputPin(val);
    if (pinError) {
      setPinError(null);
    }
  };

  const hasPeer = peers.length > 0;
  const peer = peers[0];

  return (
    <div className="w-full bg-white/75 backdrop-blur-2xl border border-white/80 rounded-2xl p-4 sm:p-5 shadow-[0_10px_35px_rgba(0,0,0,0.04)]">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
        {/* My Device */}
        <div className="flex items-center justify-between p-3.5 bg-slate-50/80 border border-slate-200/80 rounded-xl shadow-xs">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl border ${
              myDeviceType === 'mobile'
                ? 'bg-purple-50 text-purple-600 border-purple-200/80'
                : 'bg-indigo-50 text-indigo-600 border-indigo-200/80'
            }`}>
              {myDeviceType === 'mobile' ? <Smartphone className="w-6 h-6" /> : <Laptop className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
                  {lang === 'hi' ? 'Yeh Device (Aap)' : 'This Device (You)'}
                </span>
                <button
                  onClick={onToggleDeviceType}
                  title={lang === 'hi' ? 'Device type change karein' : 'Toggle Device Type'}
                  className="text-[10px] text-indigo-600 hover:text-indigo-700 font-semibold underline flex items-center gap-0.5"
                >
                  <ArrowLeftRight className="w-2.5 h-2.5" />
                  {myDeviceType === 'mobile' ? 'Switch to Laptop' : 'Switch to Mobile'}
                </button>
              </div>

              {isEditing ? (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <input
                    type="text"
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    className="bg-white border border-indigo-400 rounded px-2 py-0.5 text-xs text-slate-800 outline-none w-32 shadow-xs"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                  />
                  <button
                    onClick={handleSaveName}
                    className="p-1 rounded bg-indigo-600 text-white hover:bg-indigo-700"
                  >
                    <Check className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-sm font-bold text-slate-800">{myDeviceName}</span>
                  <button
                    onClick={() => {
                      setTempName(myDeviceName);
                      setIsEditing(true);
                    }}
                    className="text-slate-400 hover:text-slate-600 transition-colors"
                    title="Rename"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          </div>

          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white text-slate-600 border border-slate-200 shadow-2xs">
            {myDeviceType === 'mobile' ? 'Mobile' : 'Laptop'}
          </span>
        </div>

        {/* Peer Device */}
        <div className={`p-3.5 rounded-xl border transition-all ${
          hasPeer
            ? 'bg-emerald-50/60 border-emerald-300 ring-1 ring-emerald-200/50 shadow-xs'
            : 'bg-slate-50/60 border-slate-200/80 border-dashed'
        }`}>
          {hasPeer ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl border ${
                  peer.deviceType === 'mobile'
                    ? 'bg-purple-50 text-purple-600 border-purple-200'
                    : 'bg-emerald-50 text-emerald-600 border-emerald-200'
                }`}>
                  {peer.deviceType === 'mobile' ? <Smartphone className="w-6 h-6" /> : <Laptop className="w-6 h-6" />}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
                      {lang === 'hi' ? 'Connected Paired Device' : 'Connected Device'}
                    </span>
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-800 mt-0.5">{peer.name}</h4>
                </div>
              </div>

              <div className="text-right">
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-white/80 px-2 py-0.5 rounded-full border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {connectionMode === 'direct_p2p' ? 'P2P Ready' : 'Relay Ready'}
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-white text-slate-500 border border-slate-200 shadow-xs shrink-0">
                    <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-slate-800">
                      {lang === 'hi'
                        ? (myDeviceType === 'mobile' ? 'Laptop ka intezaar hai...' : 'Mobile Phone ka intezaar hai...')
                        : 'Waiting for device...'}
                    </h4>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2 shrink-0">
                  {myDeviceType === 'mobile' && onOpenScanner && (
                    <button
                      onClick={onOpenScanner}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors shadow-sm shadow-indigo-600/20"
                      title={lang === 'hi' ? 'Laptop screen scan karein' : 'Scan Laptop Screen'}
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>{lang === 'hi' ? 'Camera Scan' : 'Scan Laptop'}</span>
                    </button>
                  )}

                  <button
                    onClick={onOpenQR}
                    className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 border border-slate-200 shadow-2xs transition-colors"
                  >
                    <QrCode className="w-3.5 h-3.5 text-indigo-600" />
                    <span>{lang === 'hi' ? 'QR / Link' : 'QR / Link'}</span>
                  </button>

                  <button
                    onClick={() => setShowPinInput(!showPinInput)}
                    className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1 border border-slate-200 shadow-2xs transition-colors"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-slate-600" />
                    <span>{lang === 'hi' ? 'PIN' : 'PIN'}</span>
                  </button>
                </div>
              </div>

              {/* Quick PIN Input Box */}
              {showPinInput && (
                <div className="pt-2 border-t border-slate-200/80">
                  <form onSubmit={handleJoin} className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder={lang === 'hi' ? '6-digit PIN dalein' : 'Enter 6-digit PIN'}
                        value={inputPin}
                        onChange={handlePinChange}
                        className={`w-full bg-white rounded-lg px-3 py-2 text-xs text-slate-900 outline-none font-mono tracking-widest text-center border shadow-xs transition-all ${
                          pinError
                            ? 'border-rose-400 ring-1 ring-rose-400/50 bg-rose-50/50 text-rose-800'
                            : 'border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-400'
                        }`}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={inputPin.length < 6 || isCheckingPin}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors shadow-xs shrink-0"
                    >
                      {isCheckingPin ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>{lang === 'hi' ? 'Checking...' : 'Checking...'}</span>
                        </>
                      ) : (
                        <span>{lang === 'hi' ? 'Connect' : 'Connect'}</span>
                      )}
                    </button>
                  </form>

                  {/* Inline Error Message on Wrong PIN */}
                  {pinError && (
                    <div className="mt-2 p-2 rounded-lg bg-rose-50 border border-rose-200 flex items-center gap-2 text-rose-700 text-xs animate-in fade-in slide-in-from-top-1">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>{pinError}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
