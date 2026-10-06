import React, { useState } from 'react';
import {
  Smartphone,
  Laptop,
  RefreshCw,
  Edit2,
  Check,
  ArrowLeftRight,
  QrCode,
  KeyRound,
  Camera,
  AlertCircle,
  Zap,
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
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempName, setTempName] = useState(myDeviceName);
  const [inputPin, setInputPin] = useState('');
  const [showPinInput, setShowPinInput] = useState(false);
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
      setPinError('Invalid 6-digit PIN');
      return;
    }

    setPinError(null);
    setIsCheckingPin(true);

    try {
      const res = await onJoinRoom(cleanPin);
      if (res === false) {
        setPinError('PIN not found or room expired');
      } else {
        setPinError(null);
        setInputPin('');
        setShowPinInput(false);
      }
    } catch {
      setPinError('Error connecting to room');
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
    <div className="w-full glass-panel rounded-3xl p-4 sm:p-6 transition-all">
      {/* Horizontal Device Circular Showcase */}
      <div className="flex items-center justify-between sm:justify-around gap-2 xs:gap-3 sm:gap-6 relative">
        {/* Device 1: Left Circle (This Device) */}
        <div className="relative flex flex-col items-center">
          <div className="relative w-28 h-28 xs:w-32 xs:h-32 sm:w-40 sm:h-40 rounded-full bg-slate-900/60 backdrop-blur-2xl border-2 border-blue-400/50 shadow-[0_0_30px_rgba(59,130,246,0.25)] ring-4 ring-blue-500/15 flex flex-col items-center justify-center p-2 text-center transition-transform hover:scale-[1.02]">
            {/* Top Badge Tag */}
            <span className="absolute -top-2.5 px-3 py-0.5 rounded-full glass-btn-primary text-white text-[9px] sm:text-[10px] font-bold shadow-md">
              THIS DEVICE
            </span>

            {/* Icon with glowing backdrop */}
            <div className="p-2 sm:p-2.5 rounded-full bg-blue-500/20 text-cyan-300 border border-blue-400/30 mb-1 shadow-inner">
              {myDeviceType === 'mobile' ? (
                <Smartphone className="w-5 h-5 sm:w-6 sm:h-6" />
              ) : (
                <Laptop className="w-5 h-5 sm:w-6 sm:h-6" />
              )}
            </div>

            {/* Device Name */}
            {isEditing ? (
              <div className="flex items-center gap-1 mt-0.5">
                <input
                  type="text"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  className="glass-input rounded px-2 py-0.5 text-[11px] text-white outline-none w-20 text-center font-bold"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                />
                <button
                  onClick={handleSaveName}
                  className="p-1 rounded-full bg-blue-600 text-white hover:bg-blue-500"
                >
                  <Check className="w-2.5 h-2.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-1 mt-0.5 max-w-[85px] xs:max-w-[100px] sm:max-w-[125px]">
                <span className="text-xs sm:text-sm font-extrabold text-white truncate">
                  {myDeviceName}
                </span>
                <button
                  onClick={() => {
                    setTempName(myDeviceName);
                    setIsEditing(true);
                  }}
                  className="text-slate-400 hover:text-cyan-300 transition-colors shrink-0"
                  title="Rename"
                >
                  <Edit2 className="w-2.5 h-2.5" />
                </button>
              </div>
            )}

            {/* Switch Type Action */}
            <button
              onClick={onToggleDeviceType}
              title="Switch"
              className="mt-1 text-[9px] sm:text-[10px] text-amber-400 hover:text-amber-300 font-bold flex items-center gap-0.5 transition-colors"
            >
              <ArrowLeftRight className="w-2.5 h-2.5" />
              <span>Switch</span>
            </button>
          </div>
        </div>

        {/* Center Connecting Bridge with Continuous Animation */}
        <div className="flex-1 flex flex-col items-center justify-center relative min-w-[65px] xs:min-w-[85px] sm:min-w-[140px] px-1 sm:px-3">
          {hasPeer ? (
            /* Continuous Active Connection Animation */
            <div className="w-full flex flex-col items-center justify-center relative transform-gpu">
              {/* Continuous Flowing Energy Beam */}
              <div className="w-full h-2 sm:h-2.5 rounded-full animate-flow-beam relative overflow-hidden shadow-[0_0_15px_rgba(16,185,129,0.6)] transform-gpu">
                {/* Moving Pulses Travelling back and forth */}
                <div className="travel-pulse-right absolute top-0 w-5 sm:w-8 h-full bg-white rounded-full blur-[1px]" />
                <div className="travel-pulse-left absolute top-0 w-5 sm:w-8 h-full bg-cyan-200 rounded-full blur-[1px]" />
              </div>

              {/* Glowing Pulse Particles */}
              <div className="w-full relative h-2 -mt-1 pointer-events-none overflow-hidden transform-gpu">
                <div className="travel-pulse-right absolute top-0 w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                <div className="travel-pulse-left absolute top-0 w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#38bdf8]" />
              </div>

              {/* Connected Badge */}
              <div className="mt-2.5 sm:mt-3">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full glass-modal bg-emerald-950/60 text-emerald-300 border-emerald-500/40 text-[10px] sm:text-xs font-bold shadow-[0_0_15px_rgba(16,185,129,0.3)] whitespace-nowrap">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse" />
                  <span>Direct P2P</span>
                </span>
              </div>
            </div>
          ) : (
            /* Waiting/Connecting State */
            <div className="w-full flex flex-col items-center justify-center transform-gpu">
              {/* Dashed line bridge */}
              <div className="w-full border-t-2 border-dashed border-white/20 relative overflow-hidden h-1">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-amber-400 animate-pulse shadow-[0_0_6px_#fbbf24]" />
              </div>

              {/* Waiting Status */}
              <div className="mt-2.5 sm:mt-3">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full glass-pill text-slate-300 text-[9px] sm:text-[11px] font-semibold whitespace-nowrap">
                  <RefreshCw className="w-2.5 h-2.5 animate-spin text-cyan-400" />
                  <span>Waiting</span>
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Device 2: Right Circle (Paired Target Device) */}
        <div className="relative flex flex-col items-center">
          {hasPeer ? (
            /* Connected Paired Device Circle */
            <div className="relative w-28 h-28 xs:w-32 xs:h-32 sm:w-40 sm:h-40 rounded-full bg-slate-900/60 backdrop-blur-2xl border-2 border-emerald-400/60 shadow-[0_0_35px_rgba(16,185,129,0.3)] ring-4 ring-emerald-500/15 flex flex-col items-center justify-center p-2 text-center transition-transform hover:scale-[1.02]">
              {/* Top Badge Tag */}
              <span className="absolute -top-2.5 px-3 py-0.5 rounded-full bg-gradient-to-r from-emerald-600 to-teal-500 text-white text-[9px] sm:text-[10px] font-bold shadow-md">
                CONNECTED
              </span>

              {/* Icon */}
              <div className="p-2 sm:p-2.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 mb-1 shadow-inner">
                {peer.deviceType === 'laptop' ? (
                  <Laptop className="w-5 h-5 sm:w-6 sm:h-6" />
                ) : (
                  <Smartphone className="w-5 h-5 sm:w-6 sm:h-6" />
                )}
              </div>

              {/* Peer Device Name */}
              <span className="text-xs sm:text-sm font-extrabold text-white truncate max-w-[85px] xs:max-w-[100px] sm:max-w-[125px] mt-0.5">
                {peer.name}
              </span>

              {/* Status subtitle */}
              <span className="text-[9px] sm:text-[10px] font-bold text-emerald-400 mt-1 flex items-center gap-1">
                <Zap className="w-2.5 h-2.5 text-emerald-400" />
                <span>Ready</span>
              </span>
            </div>
          ) : (
            /* Waiting Target Device Circle */
            <div className="relative w-28 h-28 xs:w-32 xs:h-32 sm:w-40 sm:h-40 rounded-full bg-slate-900/30 backdrop-blur-xl border-2 border-dashed border-white/20 flex flex-col items-center justify-center p-2 text-center transition-all">
              {/* Top Badge Tag */}
              <span className="absolute -top-2.5 px-2.5 py-0.5 rounded-full glass-pill text-slate-400 text-[9px] sm:text-[10px] font-bold">
                TARGET
              </span>

              {/* Icon */}
              <div className="p-2 sm:p-2.5 rounded-full bg-white/5 text-slate-500 border border-white/10 mb-1">
                {myDeviceType === 'mobile' ? (
                  <Laptop className="w-5 h-5 sm:w-6 sm:h-6" />
                ) : (
                  <Smartphone className="w-5 h-5 sm:w-6 sm:h-6" />
                )}
              </div>

              {/* Target Device Type */}
              <span className="text-xs sm:text-sm font-bold text-slate-400 truncate max-w-[85px] xs:max-w-[100px] sm:max-w-[125px] mt-0.5">
                {myDeviceType === 'mobile' ? 'Laptop' : 'Mobile'}
              </span>

              {/* Subtext */}
              <span className="text-[9px] sm:text-[10px] text-slate-500 mt-1">
                Offline
              </span>
            </div>
          )}
        </div>
      </div>

      {/* When Not Connected: Quick Actions (Scan, QR, PIN) below the circles */}
      {!hasPeer && (
        <div className="mt-5 pt-4 border-t border-white/10 flex flex-col items-center gap-3">
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {myDeviceType === 'mobile' && onOpenScanner && (
              <button
                onClick={onOpenScanner}
                className="px-4 py-2 glass-btn-primary rounded-xl flex items-center gap-1.5 text-xs font-semibold active:scale-95 shadow-md"
                title="Scan QR Code"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Scan QR</span>
              </button>
            )}

            <button
              onClick={onOpenQR}
              className="px-3.5 py-2 glass-btn-secondary text-xs font-semibold rounded-xl flex items-center gap-1.5"
              title="View QR Code"
            >
              <QrCode className="w-3.5 h-3.5 text-cyan-400" />
              <span>QR Code</span>
            </button>

            <button
              onClick={() => setShowPinInput(!showPinInput)}
              className={`px-3.5 py-2 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all shadow-xs ${
                showPinInput
                  ? 'glass-btn-accent text-white'
                  : 'glass-btn-secondary text-slate-200'
              }`}
              title="Enter PIN"
            >
              <KeyRound className={`w-3.5 h-3.5 ${showPinInput ? 'text-white' : 'text-amber-400'}`} />
              <span>Enter PIN</span>
            </button>
          </div>

          {/* Quick PIN Input Form */}
          {showPinInput && (
            <div className="w-full max-w-xs animate-in fade-in slide-in-from-top-2 duration-200">
              <form onSubmit={handleJoin} className="flex items-center gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="6-digit PIN"
                  value={inputPin}
                  onChange={handlePinChange}
                  className={`flex-1 glass-input rounded-xl px-3 py-2 text-xs outline-none font-mono tracking-widest text-center transition-all ${
                    pinError
                      ? 'border-rose-500 ring-2 ring-rose-500/30 text-rose-300'
                      : 'focus:border-cyan-400'
                  }`}
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={inputPin.length < 6 || isCheckingPin}
                  className="px-4 py-2 glass-btn-accent disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-all shrink-0"
                >
                  {isCheckingPin ? '...' : 'Connect'}
                </button>
              </form>

              {pinError && (
                <div className="mt-2 p-2 rounded-xl bg-rose-950/60 border border-rose-500/30 flex items-center gap-1.5 text-rose-300 text-[11px] justify-center">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span>{pinError}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
