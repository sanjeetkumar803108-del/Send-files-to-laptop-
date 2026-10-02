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
  lang,
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
      setPinError('Invalid');
      return;
    }

    setPinError(null);
    setIsCheckingPin(true);

    try {
      const res = await onJoinRoom(cleanPin);
      if (res === false) {
        setPinError('Wrong');
      } else {
        setPinError(null);
        setInputPin('');
        setShowPinInput(false);
      }
    } catch {
      setPinError('Error');
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
    <div className="w-full bg-[#FAF8F5]/90 backdrop-blur-2xl border border-[#E8E0D1] rounded-3xl p-4 sm:p-6 shadow-[0_10px_35px_rgba(24,90,219,0.03)]">
      {/* Horizontal Device Circular Showcase */}
      <div className="flex items-center justify-between sm:justify-around gap-2 xs:gap-3 sm:gap-6 relative">
        {/* Device 1: Left Circle (This Device) */}
        <div className="relative flex flex-col items-center">
          <div className="relative w-28 h-28 xs:w-32 xs:h-32 sm:w-40 sm:h-40 rounded-full bg-white border-2 border-[#185ADB] shadow-md shadow-[#185ADB]/10 ring-4 ring-[#185ADB]/10 flex flex-col items-center justify-center p-2 text-center transition-transform hover:scale-[1.02]">
            {/* Top Badge Tag */}
            <span className="absolute -top-2.5 px-2.5 py-0.5 rounded-full bg-[#185ADB] text-white text-[9px] sm:text-[10px] font-bold shadow-2xs">
              This
            </span>

            {/* Icon */}
            <div className="p-2 sm:p-2.5 rounded-full bg-[#EEF4FD] text-[#185ADB] border border-[#D8E5FB] mb-1">
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
                  className="bg-white border border-[#185ADB] rounded px-1.5 py-0.5 text-[11px] text-slate-800 outline-none w-20 text-center font-bold"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                />
                <button
                  onClick={handleSaveName}
                  className="p-1 rounded-full bg-[#185ADB] text-white hover:bg-[#1246AB]"
                >
                  <Check className="w-2.5 h-2.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-1 mt-0.5 max-w-[85px] xs:max-w-[100px] sm:max-w-[125px]">
                <span className="text-xs sm:text-sm font-extrabold text-slate-900 truncate">
                  {myDeviceName}
                </span>
                <button
                  onClick={() => {
                    setTempName(myDeviceName);
                    setIsEditing(true);
                  }}
                  className="text-slate-400 hover:text-slate-600 transition-colors shrink-0"
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
              className="mt-1 text-[9px] sm:text-[10px] text-[#FF8A3D] hover:text-[#E66F20] font-bold flex items-center gap-0.5 hover:underline"
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
            <div className="w-full flex flex-col items-center justify-center relative">
              {/* Continuous Flowing Energy Beam */}
              <div className="w-full h-1.5 sm:h-2 rounded-full animate-flow-beam relative overflow-hidden shadow-[0_0_12px_rgba(16,185,129,0.6)]">
                {/* Moving Pulses Travelling back and forth */}
                <div className="travel-pulse-right absolute top-1/2 w-4 sm:w-6 h-full bg-white rounded-full blur-[1px]" />
                <div className="travel-pulse-left absolute top-1/2 w-4 sm:w-6 h-full bg-emerald-200 rounded-full blur-[1px]" />
              </div>

              {/* Glowing Pulse Particles */}
              <div className="w-full relative h-2 -mt-1 pointer-events-none">
                <div className="travel-pulse-right absolute top-0 w-2 h-2 rounded-full bg-[#10B981] shadow-[0_0_8px_#10B981]" />
                <div className="travel-pulse-left absolute top-0 w-2 h-2 rounded-full bg-[#FF8A3D] shadow-[0_0_8px_#FF8A3D]" />
              </div>

              {/* Connected Badge */}
              <div className="mt-2 sm:mt-3">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-300 text-[10px] sm:text-xs font-bold shadow-xs whitespace-nowrap">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  <span>Connected</span>
                </span>
              </div>
            </div>
          ) : (
            /* Waiting/Connecting State */
            <div className="w-full flex flex-col items-center justify-center">
              {/* Dashed line bridge */}
              <div className="w-full border-t-2 border-dashed border-[#DFD5C0] relative">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[#FF8A3D] animate-ping" />
              </div>

              {/* Waiting Status */}
              <div className="mt-2 sm:mt-2.5">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white text-slate-500 border border-[#E8E0D1] text-[9px] sm:text-[11px] font-semibold whitespace-nowrap shadow-2xs">
                  <RefreshCw className="w-2.5 h-2.5 animate-spin text-[#185ADB]" />
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
            <div className="relative w-28 h-28 xs:w-32 xs:h-32 sm:w-40 sm:h-40 rounded-full bg-white border-2 border-emerald-500 shadow-md shadow-emerald-500/15 ring-4 ring-emerald-500/10 flex flex-col items-center justify-center p-2 text-center transition-transform hover:scale-[1.02]">
              {/* Top Badge Tag */}
              <span className="absolute -top-2.5 px-2.5 py-0.5 rounded-full bg-emerald-600 text-white text-[9px] sm:text-[10px] font-bold shadow-2xs">
                Paired
              </span>

              {/* Icon */}
              <div className="p-2 sm:p-2.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 mb-1">
                {peer.deviceType === 'laptop' ? (
                  <Laptop className="w-5 h-5 sm:w-6 sm:h-6" />
                ) : (
                  <Smartphone className="w-5 h-5 sm:w-6 sm:h-6" />
                )}
              </div>

              {/* Peer Device Name */}
              <span className="text-xs sm:text-sm font-extrabold text-slate-900 truncate max-w-[85px] xs:max-w-[100px] sm:max-w-[125px] mt-0.5">
                {peer.name}
              </span>

              {/* Status subtitle */}
              <span className="text-[9px] sm:text-[10px] font-bold text-emerald-600 mt-1 flex items-center gap-1">
                <Zap className="w-2.5 h-2.5 text-emerald-500" />
                <span>Ready</span>
              </span>
            </div>
          ) : (
            /* Waiting Target Device Circle */
            <div className="relative w-28 h-28 xs:w-32 xs:h-32 sm:w-40 sm:h-40 rounded-full bg-white/70 border-2 border-dashed border-[#DFD5C0] flex flex-col items-center justify-center p-2 text-center transition-all">
              {/* Top Badge Tag */}
              <span className="absolute -top-2.5 px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-600 text-[9px] sm:text-[10px] font-bold shadow-2xs">
                Target
              </span>

              {/* Icon */}
              <div className="p-2 sm:p-2.5 rounded-full bg-[#FAF8F5] text-slate-400 border border-[#E8E0D1] mb-1">
                {myDeviceType === 'mobile' ? (
                  <Laptop className="w-5 h-5 sm:w-6 sm:h-6" />
                ) : (
                  <Smartphone className="w-5 h-5 sm:w-6 sm:h-6" />
                )}
              </div>

              {/* Target Device Type */}
              <span className="text-xs sm:text-sm font-bold text-slate-600 truncate max-w-[85px] xs:max-w-[100px] sm:max-w-[125px] mt-0.5">
                {myDeviceType === 'mobile' ? 'Laptop' : 'Mobile'}
              </span>

              {/* Subtext */}
              <span className="text-[9px] sm:text-[10px] text-slate-400 mt-1">
                Offline
              </span>
            </div>
          )}
        </div>
      </div>

      {/* When Not Connected: Quick Actions (Scan, QR, PIN) below the circles */}
      {!hasPeer && (
        <div className="mt-4 pt-3.5 border-t border-[#E8E0D1] flex flex-col items-center gap-2.5">
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {myDeviceType === 'mobile' && onOpenScanner && (
              <button
                onClick={onOpenScanner}
                className="px-3.5 py-1.5 bg-[#185ADB] hover:bg-[#1246AB] text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors shadow-xs"
                title="Scan"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Scan</span>
              </button>
            )}

            <button
              onClick={onOpenQR}
              className="px-3.5 py-1.5 bg-white hover:bg-[#F5F1E8] text-slate-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 border border-[#E8E0D1] shadow-2xs transition-colors"
              title="QR Code"
            >
              <QrCode className="w-3.5 h-3.5 text-[#185ADB]" />
              <span>QR</span>
            </button>

            <button
              onClick={() => setShowPinInput(!showPinInput)}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl flex items-center gap-1.5 border transition-colors shadow-2xs ${
                showPinInput
                  ? 'bg-[#FF8A3D] text-white border-[#FF8A3D]'
                  : 'bg-white hover:bg-[#F5F1E8] text-slate-700 border-[#E8E0D1]'
              }`}
              title="PIN"
            >
              <KeyRound className={`w-3.5 h-3.5 ${showPinInput ? 'text-white' : 'text-[#FF8A3D]'}`} />
              <span>PIN</span>
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
                  className={`flex-1 bg-white rounded-xl px-3 py-1.5 text-xs text-slate-900 outline-none font-mono tracking-widest text-center border shadow-xs transition-all ${
                    pinError
                      ? 'border-rose-400 ring-1 ring-rose-400/50 bg-rose-50/50 text-rose-800'
                      : 'border-[#DFD5C0] focus:border-[#185ADB]'
                  }`}
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={inputPin.length < 6 || isCheckingPin}
                  className="px-3.5 py-1.5 bg-[#FF8A3D] hover:bg-[#E66F20] disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-colors shadow-xs shrink-0"
                >
                  {isCheckingPin ? '...' : 'Connect'}
                </button>
              </form>

              {pinError && (
                <div className="mt-1.5 p-1.5 rounded-lg bg-rose-50 border border-rose-200 flex items-center gap-1.5 text-rose-700 text-[11px] justify-center">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
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

