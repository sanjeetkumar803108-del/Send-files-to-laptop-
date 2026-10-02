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
import { Wifi, AlertCircle, ShieldCheck, CheckCircle2, Laptop, Copy, Check, Camera } from 'lucide-react';

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
  const [lang, setLang] = useState<'hi' | 'en'>('hi');
  const [isQrOpen, setIsQrOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [previewItem, setPreviewItem] = useState<TransferProgress | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [copiedAppUrl, setCopiedAppUrl] = useState(false);

  const engineRef = useRef<TransferEngine | null>(null);

  const showToast = useCallback((text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  }, []);

  // Initialize and synchronize TransferEngine
  useEffect(() => {
    // If URL has join parameter and opened on mobile, show quick confirmation
    if (typeof window !== 'undefined') {
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
        setPeers(connectedPeers);
      },
      (items) => {
        setTransfers([...items]);
      },
      (newSnippet) => {
        setSnippets((prev) => [newSnippet, ...prev]);
        showToast(
          lang === 'hi' ? 'Naya Text Message Receive Hua!' : 'New Snippet Received!',
          'info'
        );
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

    // Check if room has an active host on the signaling server
    if (engineRef.current) {
      const res = await engineRef.current.checkRoom(cleanPin);
      if (!res.isValid) {
        showToast(
          lang === 'hi'
            ? '❌ Galat PIN! Is PIN se koi laptop connected nahi hai.'
            : '❌ Wrong PIN! No active laptop found with this PIN.',
          'error'
        );
        return false;
      }
    }

    setRoomId(cleanPin);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('hotspot_drop_room', cleanPin);
      const url = new URL(window.location.href);
      url.searchParams.set('room', cleanPin);
      window.history.replaceState({}, '', url.toString());
    }
    showToast(
      lang === 'hi' ? 'Sahi PIN! Laptop se connect ho rahe hain...' : 'Valid PIN! Connecting to laptop...',
      'success'
    );
    return true;
  };

  const handleScanSuccess = (scannedText: string) => {
    try {
      if (scannedText.includes('room=')) {
        const url = new URL(scannedText);
        const r = url.searchParams.get('room');
        if (r && /^\d{6}$/.test(r)) {
          handleJoinRoom(r);
          return;
        }
      }
      const match = scannedText.match(/room=(\d{6})/);
      if (match && match[1]) {
        handleJoinRoom(match[1]);
        return;
      }
      const cleanDigits = scannedText.replace(/\D/g, '');
      if (cleanDigits.length === 6) {
        handleJoinRoom(cleanDigits);
      }
    } catch {
      const match = scannedText.match(/\d{6}/);
      if (match) handleJoinRoom(match[0]);
    }
  };

  const handleSendFiles = (files: FileList | File[]) => {
    if (!engineRef.current) return;
    try {
      engineRef.current.queueFiles(files);
      showToast(
        lang === 'hi'
          ? `${files.length} file(s) transfer shuru ho gayi!`
          : `Sending ${files.length} file(s)...`,
        'info'
      );
    } catch (err: any) {
      showToast(err.message || 'Error queueing files', 'error');
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
      showToast(lang === 'hi' ? 'Text bheja gaya' : 'Text sent', 'success');
    } catch (err: any) {
      showToast(err.message || 'Error sending text', 'error');
    }
  };

  const handleCancelTransfer = (fileId: string) => {
    if (engineRef.current) {
      engineRef.current.cancelTransfer(fileId);
      showToast(lang === 'hi' ? 'Transfer cancel kiya gaya' : 'Transfer cancelled', 'info');
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

  const isPeerConnected = peers.length > 0;
  const currentOrigin = getPublicAppUrl();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-200">
          <div className={`px-4 py-2.5 rounded-xl shadow-2xl border flex items-center gap-2.5 text-xs font-semibold backdrop-blur-md ${
            toastMessage.type === 'success'
              ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/40'
              : toastMessage.type === 'error'
              ? 'bg-rose-950/90 text-rose-300 border-rose-500/40'
              : 'bg-indigo-950/90 text-indigo-300 border-indigo-500/40'
          }`}>
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-400" />
            )}
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <Header
        roomId={roomId}
        connectionMode={connectionMode}
        connectedCount={peers.length}
        deviceType={deviceType}
        lang={lang}
        onToggleLang={() => setLang(lang === 'hi' ? 'en' : 'hi')}
        onOpenQR={() => setIsQrOpen(true)}
        onOpenScanner={() => setIsScannerOpen(true)}
        onOpenGuide={() => setIsGuideOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* On Laptop when waiting to connect: Show Instant QR Code & 6-Digit PIN directly on screen */}
        {deviceType === 'laptop' && !isPeerConnected && (
          <LaptopPairingHero roomId={roomId} lang={lang} />
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
