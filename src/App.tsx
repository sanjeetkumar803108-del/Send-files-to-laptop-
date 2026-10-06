import React, { useEffect, useRef, useState, useCallback } from 'react';
import { TransferEngine } from './services/webrtc';
import { PeerDevice, ConnectionMode, TransferProgress, SharedSnippet } from './types/transfer';
import { generateRoomId, generatePeerId, detectDeviceType, getDefaultDeviceName, getPublicAppUrl } from './utils/format';
import { Header } from './components/Header';
import { DeviceCard } from './components/DeviceCard';
import { FileDropZone } from './components/FileDropZone';
import { TransferList } from './components/TransferList';
import { QuickShareText } from './components/QuickShareText';
import { QRCodeModal } from './components/QRCodeModal';
import { QRScannerModal } from './components/QRScannerModal';
import { HotspotGuideModal } from './components/HotspotGuideModal';
import { FilePreviewModal } from './components/FilePreviewModal';
import { LaptopPairingHero } from './components/LaptopPairingHero';
import { ServerSettingsModal } from './components/ServerSettingsModal';
import { Wifi, AlertCircle, ShieldCheck, CheckCircle2, Laptop, Copy, Check, Camera, Share2 } from 'lucide-react';

export default function App() {
  const [roomId, setRoomId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlRoom = params.get('room');
      if (urlRoom && /^\d{6}$/.test(urlRoom)) {
        return urlRoom;
      }
      const saved = sessionStorage.getItem('hotspot_drop_room');
      if (saved && /^\d{6}$/.test(saved)) {
        return saved;
      }
    }
    return generateRoomId();
  });

  const [peerId] = useState<string>(() => generatePeerId());
  const [deviceType, setDeviceType] = useState<'mobile' | 'laptop'>(() => detectDeviceType());
  const [deviceName, setDeviceName] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('hotspot_drop_device_name');
      if (saved) return saved;
    }
    return getDefaultDeviceName(detectDeviceType());
  });

  const [connectionMode, setConnectionMode] = useState<ConnectionMode>('connecting');
  const [peers, setPeers] = useState<PeerDevice[]>([]);
  const [transfers, setTransfers] = useState<TransferProgress[]>([]);
  const [snippets, setSnippets] = useState<SharedSnippet[]>([]);
  const [autoDownload, setAutoDownload] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('hotspot_drop_autodownload');
      if (saved !== null) return saved === 'true';
    }
    // Always default to true so incoming files go directly to File Manager without clicking Save
    return true;
  });

  // UI state
  const [lang] = useState<'en' | 'hi'>('en');
  const [isQrOpen, setIsQrOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isServerModalOpen, setIsServerModalOpen] = useState(false);
  const [signalingStatus, setSignalingStatus] = useState<'connected' | 'connecting' | 'disconnected'>('disconnected');
  const [signalingUrl, setSignalingUrl] = useState<string>('');
  const [previewItem, setPreviewItem] = useState<TransferProgress | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [copiedAppUrl, setCopiedAppUrl] = useState(false);

  const engineRef = useRef<TransferEngine | null>(null);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = useCallback((text: string, type: 'success' | 'error' | 'info' = 'info') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage({ text, type });
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
    }, type === 'error' ? 4500 : 3200);
  }, []);

  // Initialize and synchronize TransferEngine
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedSig = localStorage.getItem('hotspot_drop_signaling_url');
      if (savedSig && savedSig.includes('vercel.app')) {
        localStorage.removeItem('hotspot_drop_signaling_url');
      }

      const params = new URLSearchParams(window.location.search);
      if (params.get('join') === '1') {
        showToast(
          lang === 'hi' ? 'Room me connect ho gaye hain!' : 'Joined room successfully!',
          'success'
        );
      }
    }

    const engine = new TransferEngine(roomId, peerId, deviceName, deviceType);
    engine.setAutoDownload(autoDownload);

    engine.setCallbacks(
      (mode) => {
        setConnectionMode(mode);
        if (mode === 'direct_p2p') {
          showToast(
            lang === 'hi' ? 'Direct Hotspot P2P Connected!' : 'Direct Hotspot P2P Connected!',
            'success'
          );
        }
      },
      (connectedPeers) => {
        setPeers((prev) => {
          if (prev.length === 0 && connectedPeers.length === 0) return prev;
          if (
            prev.length === connectedPeers.length &&
            prev.every((p, i) => p.id === connectedPeers[i]?.id && p.name === connectedPeers[i]?.name)
          ) {
            return prev;
          }
          return connectedPeers;
        });
      },
      (items) => {
        setTransfers((prev) => {
          if (prev.length === 0 && items.length === 0) return prev;
          return [...items];
        });
      },
      (newSnippet) => {
        setSnippets((prev) => [newSnippet, ...prev]);
        showToast(
          lang === 'hi' ? 'Naya Text Message Receive Hua!' : 'New Snippet Received!',
          'info'
        );
      },
      (fileName, reason) => {
        showToast(`❌ ${fileName}: ${reason}`, 'error');
      },
      (status, url) => {
        setSignalingStatus(status);
        setSignalingUrl(url);
      }
    );

    engineRef.current = engine;
    engine.start();

    return () => {
      engine.stop();
      engineRef.current = null;
    };
  }, [roomId, peerId, deviceName, deviceType, showToast, lang]);

  // Keep auto-download synced
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setAutoDownload(autoDownload);
    }
  }, [autoDownload]);

  // Handle browser back/forward and URL changes cleanly
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const urlRoom = params.get('room');
      if (urlRoom && /^\d{6}$/.test(urlRoom) && urlRoom !== roomId) {
        setRoomId(urlRoom);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [roomId]);

  // Actions
  const handleUpdateDeviceName = (name: string) => {
    setDeviceName(name);
    if (typeof window !== 'undefined') {
      localStorage.setItem('hotspot_drop_device_name', name);
    }
    showToast(lang === 'hi' ? 'Device name update ho gaya' : 'Device name updated', 'success');
  };

  const handleToggleDeviceType = () => {
    const next = deviceType === 'mobile' ? 'laptop' : 'mobile';
    setDeviceType(next);
    showToast(
      lang === 'hi' ? `Switched to ${next}` : `Switched to ${next}`,
      'info'
    );
  };

  const handleJoinRoom = async (newPin: string): Promise<boolean> => {
    const cleanPin = newPin.trim().replace(/\D/g, '');
    if (!cleanPin || cleanPin.length !== 6) {
      showToast(lang === 'hi' ? 'PIN 6-digit ka hona chahiye!' : 'PIN must be 6 digits!', 'error');
      return false;
    }
    if (cleanPin === roomId) {
      showToast(
        lang === 'hi'
          ? 'Aap pehle se is PIN par hain! Laptop screen wala PIN dalein.'
          : 'Already using this PIN! Enter the laptop\'s PIN.',
        'error'
      );
      return false;
    }

    setRoomId(cleanPin);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('hotspot_drop_room', cleanPin);
      const url = new URL(window.location.href);
      url.searchParams.set('room', cleanPin);
      window.history.replaceState({}, '', url.toString());
    }
    showToast(
      lang === 'hi' ? 'Sahi PIN! Laptop se connect ho rahe hain...' : 'Connecting to room ' + cleanPin + '...',
      'success'
    );
    return true;
  };

  const handleSaveServerUrl = (url: string) => {
    setSignalingUrl(url);
    engineRef.current?.setSignalingUrl(url);
    showToast(url ? 'Signaling server updated!' : 'Signaling server reset to default', 'info');
  };

  const handleScanSuccess = (scannedText: string) => {
    try {
      let targetPin = '';

      // Match room=123456 from full URL, query string, or text
      const match = scannedText.match(/[?&]room=(\d{6})/i) || scannedText.match(/room=(\d{6})/i);
      if (match && match[1]) {
        targetPin = match[1];
      } else {
        // Match raw 6 digits
        const cleanDigits = scannedText.replace(/\D/g, '');
        if (cleanDigits.length === 6) {
          targetPin = cleanDigits;
        } else {
          const anyMatch = scannedText.match(/\d{6}/);
          if (anyMatch) targetPin = anyMatch[0];
        }
      }

      // Check if QR code contains a custom signaling server URL (?sig=... or ?server=...)
      const sigMatch = scannedText.match(/[?&](?:sig|server)=([^&]+)/i);
      let detectedSigUrl = '';
      if (sigMatch && sigMatch[1]) {
        try {
          detectedSigUrl = decodeURIComponent(sigMatch[1]).trim();
        } catch {}
      }

      // Only configure if explicitly ws:// or wss:// and NOT a vercel.app static domain
      if (detectedSigUrl && !detectedSigUrl.includes('vercel.app') && (detectedSigUrl.startsWith('ws://') || detectedSigUrl.startsWith('wss://'))) {
        localStorage.setItem('hotspot_drop_signaling_url', detectedSigUrl);
        setSignalingUrl(detectedSigUrl);
        engineRef.current?.setSignalingUrl(detectedSigUrl);
        showToast('Custom server configured from QR!', 'info');
      }

      if (targetPin && /^\d{6}$/.test(targetPin)) {
        // Direct instant connect upon QR scan without intermediate blocking!
        setRoomId(targetPin);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('hotspot_drop_room', targetPin);
          const url = new URL(window.location.href);
          url.searchParams.set('room', targetPin);
          window.history.replaceState({}, '', url.toString());
        }
        setIsScannerOpen(false);
        showToast(
          lang === 'hi' ? '⚡ QR Code Scanned! Direct Connected!' : '⚡ QR Code Scanned! Direct Connected!',
          'success'
        );
        return;
      }

      showToast(
        lang === 'hi' ? '❌ Invalid QR Code. Kripya laptop screen ka QR code scan karein.' : '❌ Invalid QR Code. Please scan laptop screen QR.',
        'error'
      );
    } catch (err: any) {
      console.error('Scan error:', err);
      showToast(
        lang === 'hi' ? 'QR Code scan karne me samasya aayi.' : 'Error reading QR code.',
        'error'
      );
    }
  };

  const handleSendFiles = (files: FileList | File[]) => {
    if (!engineRef.current) return;
    try {
      const isAlreadyBusy = engineRef.current.isBusy();
      engineRef.current.queueFiles(files);
      if (isAlreadyBusy) {
        showToast(
          lang === 'hi'
            ? `${files.length} फ़ाइल(s) कतार (Queue) में जुड़ गई`
            : `${files.length} file(s) added to queue`,
          'info'
        );
      } else {
        showToast(
          lang === 'hi'
            ? `${files.length} फ़ाइल(s) भेजी जा रही हैं...`
            : `Sending ${files.length} file(s)...`,
          'info'
        );
      }
    } catch (err: any) {
      showToast(`❌ ${err.message || 'Cannot send files'}`, 'error');
    }
  };

  const handleSendText = (text: string) => {
    if (!engineRef.current) return;
    try {
      engineRef.current.sendSnippet(text);
      setSnippets((prev) => [
        {
          id: 'snip_' + Date.now(),
          senderName: 'You (' + deviceName + ')',
          text,
          timestamp: Date.now(),
          direction: 'outgoing',
        },
        ...prev,
      ]);
      showToast('Text sent', 'success');
    } catch (err: any) {
      showToast(err.message || 'Error sending text', 'error');
    }
  };

  const handleCancelTransfer = (fileId: string) => {
    if (engineRef.current) {
      const t = engineRef.current.transfers.get(fileId);
      const name = t?.name || 'File';
      engineRef.current.cancelTransfer(fileId);
      showToast(`❌ Transfer cancelled: ${name}`, 'error');
    }
  };

  const handleClearTransfers = () => {
    transfers.forEach((t) => {
      if (t.downloadUrl) {
        try {
          URL.revokeObjectURL(t.downloadUrl);
        } catch {}
      }
    });
    if (engineRef.current) {
      engineRef.current.transfers.clear();
    }
    setTransfers([]);
    showToast(lang === 'hi' ? 'History saaf kar di gayi' : 'History cleared', 'info');
  };

  const copyAppUrl = () => {
    const pubUrl = getPublicAppUrl();
    if (navigator.clipboard && pubUrl) {
      navigator.clipboard.writeText(pubUrl);
      setCopiedAppUrl(true);
      setTimeout(() => setCopiedAppUrl(false), 2000);
      showToast(lang === 'hi' ? 'Website URL copy ho gayi' : 'Website URL copied', 'success');
    }
  };

  const shareAppUrl = async () => {
    const pubUrl = getPublicAppUrl();
    if (!pubUrl) return;

    if (navigator.share) {
      try {
        // "jisko share karne par sirf link text hi share hona achhaiye bhai"
        await navigator.share({
          text: pubUrl,
        });
        showToast(lang === 'hi' ? 'Link share ho gaya' : 'Link shared', 'success');
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          try {
            await navigator.share({ url: pubUrl });
            showToast(lang === 'hi' ? 'Link share ho gaya' : 'Link shared', 'success');
          } catch {
            if (navigator.clipboard) {
              await navigator.clipboard.writeText(pubUrl);
              showToast(lang === 'hi' ? 'Link copy ho gaya' : 'Link copied', 'info');
            }
          }
        }
      }
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(pubUrl);
      showToast(lang === 'hi' ? 'Link copy ho gaya' : 'Link copied', 'info');
    }
  };

  const isPeerConnected = peers.length > 0;
  const currentOrigin = getPublicAppUrl();

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-[#070A12] text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white relative">
      {/* Ambient Glassmorphic Aurora Mesh Glows - Hardware Accelerated */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10 transform-gpu will-change-transform">
        {/* Aurora Orb 1: Electric Blue / Cyan */}
        <div className="absolute top-[-15%] left-[-10%] w-[60vw] h-[60vw] rounded-full bg-gradient-to-br from-blue-600/25 via-cyan-500/15 to-transparent blur-[90px] animate-aurora-1 transform-gpu" />
        {/* Aurora Orb 2: Neon Purple / Indigo */}
        <div className="absolute bottom-[-15%] right-[-10%] w-[65vw] h-[65vw] rounded-full bg-gradient-to-tl from-indigo-600/30 via-purple-600/20 to-transparent blur-[100px] animate-aurora-2 transform-gpu" />
        {/* Aurora Orb 3: Radiant Amber / Coral Spark */}
        <div className="absolute top-[35%] right-[5%] w-[45vw] h-[45vw] rounded-full bg-gradient-to-tr from-cyan-500/15 via-blue-500/15 to-amber-500/10 blur-[85px] animate-aurora-3 transform-gpu" />
      </div>

      {/* Toast Notification - Glass Pill */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-200 max-w-[92vw]">
          <div className={`px-4 py-2.5 rounded-2xl shadow-2xl border flex items-center gap-2.5 text-xs font-semibold backdrop-blur-2xl ${
            toastMessage.type === 'success'
              ? 'bg-emerald-950/70 text-emerald-200 border-emerald-500/30 shadow-emerald-500/20'
              : toastMessage.type === 'error'
              ? 'bg-rose-950/70 text-rose-200 border-rose-500/30 shadow-rose-500/25'
              : 'glass-modal text-blue-200 border-blue-400/30 shadow-blue-500/20'
          }`}>
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : toastMessage.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-blue-400 shrink-0" />
            )}
            <span className="truncate max-w-[260px] xs:max-w-xs sm:max-w-md">{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <Header
        roomId={roomId}
        connectionMode={connectionMode}
        connectedCount={peers.length}
        deviceType={deviceType}
        signalingStatus={signalingStatus}
        onOpenQR={() => setIsQrOpen(true)}
        onOpenScanner={() => setIsScannerOpen(true)}
        onOpenGuide={() => setIsGuideOpen(true)}
        onOpenServerSettings={() => setIsServerModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-3.5 sm:px-6 py-5 sm:py-8 space-y-4 sm:space-y-6 overflow-hidden">
        {/* On Laptop when waiting to connect: Show Instant QR Code & 6-Digit PIN directly on screen */}
        {deviceType === 'laptop' && !isPeerConnected && (
          <LaptopPairingHero roomId={roomId} lang={lang} />
        )}

        {/* Laptop Web Link - Translucent Glass Card */}
        {!isPeerConnected && deviceType === 'mobile' && (
          <div className="w-full glass-panel rounded-2xl p-3 sm:p-3.5 flex flex-col sm:flex-row items-center justify-between gap-2.5 transition-all">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-blue-500/15 text-blue-400 border border-blue-400/25 shrink-0 shadow-inner">
                <Laptop className="w-4 h-4" />
              </div>
              <span className="text-xs sm:text-sm font-bold text-slate-200">
                Laptop
              </span>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto min-w-0">
              <div className="flex-1 sm:flex-initial px-3 py-1.5 rounded-xl glass-input font-mono text-xs text-slate-300 overflow-x-auto whitespace-nowrap scrollbar-thin select-all min-w-0 max-w-full sm:max-w-xs">
                <span>{currentOrigin}</span>
              </div>
              <button
                onClick={copyAppUrl}
                className="px-3 py-1.5 glass-btn-primary text-xs font-semibold rounded-xl shrink-0 flex items-center gap-1"
                title="Copy Link"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copiedAppUrl ? 'Copied' : 'Copy'}</span>
              </button>
              <button
                onClick={shareAppUrl}
                className="px-3 py-1.5 glass-btn-accent text-xs font-semibold rounded-xl shrink-0 flex items-center gap-1"
                title="Share Link"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Share</span>
              </button>
            </div>
          </div>
        )}

        {/* Device Status & Pairing Card */}
        <DeviceCard
          myDeviceName={deviceName}
          myDeviceType={deviceType}
          onUpdateDeviceName={handleUpdateDeviceName}
          onToggleDeviceType={handleToggleDeviceType}
          peers={peers}
          connectionMode={connectionMode}
          onOpenQR={() => setIsQrOpen(true)}
          onOpenScanner={() => setIsScannerOpen(true)}
          onJoinRoom={handleJoinRoom}
          lang={lang}
        />

        {/* File Drop & Selector Zone */}
        <FileDropZone
          onSendFiles={handleSendFiles}
          isPeerConnected={isPeerConnected}
          onOpenQR={() => setIsQrOpen(true)}
          lang={lang}
        />

        {/* Quick Clipboard / Text Share */}
        <QuickShareText
          snippets={snippets}
          onSendText={handleSendText}
          isPeerConnected={isPeerConnected}
          lang={lang}
        />

        {/* Live & Past Transfers */}
        <TransferList
          transfers={transfers}
          autoDownload={autoDownload}
          onToggleAutoDownload={setAutoDownload}
          onCancelTransfer={handleCancelTransfer}
          onPreviewFile={(t) => setPreviewItem(t)}
          onClearTransfers={handleClearTransfers}
          lang={lang}
        />
      </main>

      {/* Modals */}
      <QRCodeModal
        isOpen={isQrOpen}
        onClose={() => setIsQrOpen(false)}
        roomId={roomId}
        onOpenScanner={() => setIsScannerOpen(true)}
        lang={lang}
      />

      <QRScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleScanSuccess}
        lang={lang}
      />

      <HotspotGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        lang={lang}
      />

      <ServerSettingsModal
        isOpen={isServerModalOpen}
        onClose={() => setIsServerModalOpen(false)}
        currentUrl={signalingUrl}
        signalingStatus={signalingStatus}
        onSaveUrl={handleSaveServerUrl}
      />

      {previewItem && (
        <FilePreviewModal
          isOpen={true}
          onClose={() => setPreviewItem(null)}
          name={previewItem.name}
          size={previewItem.size}
          type={previewItem.type}
          blob={previewItem.blob}
          downloadUrl={previewItem.downloadUrl}
          lang={lang}
        />
      )}
    </div>
  );
}
