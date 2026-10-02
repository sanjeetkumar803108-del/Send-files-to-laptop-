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
      setPinError(lang === 'hi' ? '6-digit PIN dalein' : 'Enter 6-digit PIN');
      return;
    }

    setPinError(null);
    setIsCheckingPin(true);

    try {
      const res = await onJoinRoom(cleanPin);
      if (res === false) {
        setPinError(lang === 'hi' ? 'Galat PIN!' : 'Wrong PIN!');
      } else {
        setPinError(null);
        setInputPin('');
      }
    } catch {
      setPinError(lang === 'hi' ? 'Error!' : 'Error!');
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 items-center">
        {/* My Device */}
        <div className="flex items-center justify-between p-3 sm:p-3.5 bg-slate-50/80 border border-slate-200/80 rounded-xl shadow-xs gap-2">
          <div className="flex items-center gap-2.5 min-w-0 flex-1 truncate">
            <div className={`p-2 sm:p-2.5 rounded-xl border shrink-0 ${
              myDeviceType === 'mobile'
                ? 'bg-purple-50 text-purple-600 border-purple-200/80'
                : 'bg-indigo-50 text-indigo-600 border-indigo-200/80'
            }`}>
              {myDeviceType === 'mobile' ? <Smartphone className="w-5 h-5" /> : <Laptop className="w-5 h-5" />}
            </div>
            <div className="min-w-0 flex-1 truncate">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                  {lang === 'hi' ? 'This Device' : 'This Device'}
                </span>
                <button
                  onClick={onToggleDeviceType}
                  title="Switch"
                  className="text-[10px] text-indigo-600 hover:text-indigo-700 font-semibold underline flex items-center gap-0.5"
                >
                  <ArrowLeftRight className="w-2.5 h-2.5" />
                  Switch
                </button>
              </div>

              {isEditing ? (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <input
                    type="text"
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    className="bg-white border border-indigo-400 rounded px-2 py-0.5 text-xs text-slate-800 outline-none w-28 shadow-xs"
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
                <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                  <span className="text-sm font-bold text-slate-800 truncate max-w-[110px] xs:max-w-[160px] sm:max-w-xs">{myDeviceName}</span>
                  <button
                    onClick={() => {
                      setTempName(myDeviceName);
                      setIsEditing(true);
                    }}
                    className="text-slate-400 hover:text-slate-600 transition-colors shrink-0"
                    title="Rename"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          </div>

          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white text-slate-600 border border-slate-200 shadow-2xs shrink-0">
            {myDeviceType === 'mobile' ? 'Mobile' : 'Laptop'}
          </span>
        </div>

        {/* Peer Device */}
        <div className={`p-3 sm:p-3.5 rounded-xl border transition-all ${
          hasPeer
            ? 'bg-emerald-50/60 border-emerald-300 ring-1 ring-emerald-200/50 shadow-xs'
            : 'bg-slate-50/60 border-slate-200/80 border-dashed'
        }`}>
          {hasPeer ? (
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0 flex-1 truncate">
                <div className={`p-2 sm:p-2.5 rounded-xl border shrink-0 ${
                  peer.deviceType === 'mobile'
                    ? 'bg-purple-50 text-purple-600 border-purple-200'
                    : 'bg-emerald-50 text-emerald-600 border-emerald-200'
                }`}>
                  {peer.deviceType === 'mobile' ? <Smartphone className="w-5 h-5" /> : <Laptop className="w-5 h-5" />}
                </div>
                <div className="min-w-0 flex-1 truncate">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                    Device
                  </span>
                  <h4 className="text-sm font-bold text-slate-800 mt-0.5 truncate max-w-[110px] xs:max-w-[160px] sm:max-w-xs">{peer.name}</h4>
                </div>
              </div>

              {/* Exact user requirement: "app mein jo niche ek dam likha hoina chhaiye sirf connected" */}
              <div className="text-right">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-white px-2.5 py-1 rounded-full border border-emerald-200 shadow-2xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Connected
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-white text-slate-500 border border-slate-200 shadow-xs shrink-0">
                    <RefreshCw className="w-5 h-5 animate-spin text-indigo-600" />
                  </div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-700">
                    Waiting...
                  </h4>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {myDeviceType === 'mobile' && onOpenScanner && (
                    <button
                      onClick={onOpenScanner}
                      className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1 transition-colors shadow-sm"
                      title="Scan"
                    >
                      <Camera className="w-3 h-3" />
                      <span>Scan</span>
                    </button>
                  )}

                  <button
                    onClick={onOpenQR}
                    className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1 border border-slate-200 shadow-2xs transition-colors"
                  >
                    <QrCode className="w-3 h-3 text-indigo-600" />
                    <span>QR</span>
                  </button>

                  <button
                    onClick={() => setShowPinInput(!showPinInput)}
                    className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1 border border-slate-200 shadow-2xs transition-colors"
                  >
                    <KeyRound className="w-3 h-3 text-slate-500" />
                    <span>PIN</span>
                  </button>
                </div>
              </div>

              {/* Quick PIN Input Box */}
              {showPinInput && (
                <div className="pt-2 border-t border-slate-200/80">
                  <form onSubmit={handleJoin} className="flex items-center gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="6-digit PIN"
                      value={inputPin}
                      onChange={handlePinChange}
                      className={`flex-1 bg-white rounded-lg px-3 py-1.5 text-xs text-slate-900 outline-none font-mono tracking-widest text-center border shadow-xs transition-all ${
                        pinError
                          ? 'border-rose-400 ring-1 ring-rose-400/50 bg-rose-50/50 text-rose-800'
                          : 'border-slate-300 focus:border-indigo-500'
                      }`}
                    />
                    <button
                      type="submit"
                      disabled={inputPin.length < 6 || isCheckingPin}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors shadow-xs shrink-0"
                    >
                      {isCheckingPin ? '...' : 'Connect'}
                    </button>
                  </form>

                  {pinError && (
                    <div className="mt-1.5 p-1.5 rounded-lg bg-rose-50 border border-rose-200 flex items-center gap-1.5 text-rose-700 text-[11px]">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
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
