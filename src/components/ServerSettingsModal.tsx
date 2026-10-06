import React, { useState, useEffect } from 'react';
import { X, Server, Check, AlertCircle, RefreshCw, Globe, Wifi } from 'lucide-react';

interface ServerSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUrl: string;
  signalingStatus: 'connected' | 'connecting' | 'disconnected';
  onSaveUrl: (url: string) => void;
  lang?: 'hi' | 'en';
}

export const ServerSettingsModal: React.FC<ServerSettingsModalProps> = ({
  isOpen,
  onClose,
  currentUrl,
  signalingStatus,
  onSaveUrl,
}) => {
  const [inputUrl, setInputUrl] = useState(currentUrl);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setInputUrl(currentUrl);
      setTestResult(null);
    }
  }, [isOpen, currentUrl]);

  if (!isOpen) return null;

  const handleTestConnection = () => {
    const urlToTest = inputUrl.trim();
    if (!urlToTest) {
      setTestResult({ success: false, message: 'Server URL cannot be empty' });
      return;
    }
    if (!urlToTest.startsWith('ws://') && !urlToTest.startsWith('wss://')) {
      setTestResult({ success: false, message: 'URL must start with ws:// or wss://' });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const testWs = new WebSocket(urlToTest);
      let resolved = false;

      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          try { testWs.close(); } catch {}
          setTesting(false);
          setTestResult({ success: false, message: 'Connection timed out. Check network or server status.' });
        }
      }, 5000);

      testWs.onopen = () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          try { testWs.close(); } catch {}
          setTesting(false);
          setTestResult({ success: true, message: '✅ Connection successful!' });
        }
      };

      testWs.onerror = () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          setTesting(false);
          setTestResult({
            success: false,
            message: '❌ Cannot connect to this WebSocket server. Make sure server is running and supports WebSockets.',
          });
        }
      };
    } catch (e: any) {
      setTesting(false);
      setTestResult({ success: false, message: `Error: ${e?.message || 'Invalid WebSocket URL'}` });
    }
  };

  const handleSave = () => {
    const trimmed = inputUrl.trim();
    onSaveUrl(trimmed);
    onClose();
  };

  const handleReset = () => {
    localStorage.removeItem('hotspot_drop_signaling_url');
    setInputUrl('');
    onSaveUrl('');
    setTestResult(null);
  };

  const statusBadge = () => {
    if (signalingStatus === 'connected') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
          <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse" />
          Server Connected
        </span>
      );
    }
    if (signalingStatus === 'connecting') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
          <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_#fbbf24] animate-ping" />
          Connecting...
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30">
        <span className="w-2 h-2 rounded-full bg-rose-400 shadow-[0_0_8px_#f43f5e]" />
        Server Disconnected
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-2xl animate-in fade-in duration-200">
      <div className="w-full max-w-lg glass-modal rounded-3xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/15 text-cyan-300 flex items-center justify-center border border-blue-400/25 shadow-inner">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-lg">Signaling Server Settings</h3>
              <p className="text-xs text-slate-300">Connect mobile APK & laptop web app</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 scrollbar-thin">
          {/* Status Bar */}
          <div className="p-4 rounded-2xl glass-card border-white/10 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Current Status
              </span>
              <span className="text-xs text-slate-200 truncate max-w-[220px] block mt-0.5">
                {currentUrl || 'Cloud Relay (Zero-Config Default)'}
              </span>
            </div>
            {statusBadge()}
          </div>

          {/* Server Input */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-200 block">
              Custom Signaling WebSocket URL (wss:// or ws://)
            </label>
            <div className="relative">
              <input
                type="text"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder="Leave empty for auto zero-config cloud relay or enter ws://..."
                className="w-full px-4 py-3 text-xs sm:text-sm font-mono glass-input rounded-xl outline-none"
              />
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              💡 <strong>Tip:</strong> By default, zero-config Cloud Relay is enabled. Scanning QR automatically handles pairing without any setup!
            </p>
          </div>

          {/* Test connection result */}
          {testResult && (
            <div
              className={`p-3.5 rounded-xl text-xs flex items-start gap-2.5 border ${
                testResult.success
                  ? 'bg-emerald-950/60 border-emerald-500/30 text-emerald-200'
                  : 'bg-rose-950/60 border-rose-500/30 text-rose-200'
              }`}
            >
              {testResult.success ? (
                <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              )}
              <span className="leading-relaxed">{testResult.message}</span>
            </div>
          )}

          {/* Guide info boxes */}
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Connection Options:
            </h4>

            {/* Cloud Relay Option */}
            <div className="p-3.5 rounded-xl glass-card border-blue-400/20 text-xs text-blue-200 space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-cyan-300">
                <Globe className="w-4 h-4" />
                <span>1. Zero-Config Cloud Relay (Default)</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Connects live Vercel web app and Android APK instantly via global public WSS broker. Direct WebRTC P2P file transfers are unthrottled and direct.
              </p>
            </div>

            {/* Local Hotspot Option */}
            <div className="p-3.5 rounded-xl glass-card border-amber-400/20 text-xs text-amber-200 space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-amber-300">
                <Wifi className="w-4 h-4" />
                <span>2. Local Hotspot / Wi-Fi (No Internet Needed)</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Run local server on your laptop (e.g. <code>ws://192.168.137.1:3000/ws</code>) for completely offline hotspot mode.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={handleTestConnection}
              disabled={testing || !inputUrl.trim()}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold glass-btn-secondary flex items-center gap-1.5 disabled:opacity-50"
            >
              {testing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Server className="w-3.5 h-3.5" />}
              <span>{testing ? 'Testing...' : 'Test URL'}</span>
            </button>
            <button
              onClick={handleReset}
              className="px-3 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-colors"
            >
              Reset to Default
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold glass-btn-secondary"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2 rounded-xl text-xs font-semibold glass-btn-primary active:scale-95 shadow-md"
            >
              Save & Connect
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
