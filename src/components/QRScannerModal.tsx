import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, AlertCircle, RefreshCw, Zap } from 'lucide-react';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (scannedText: string) => void;
  lang: 'hi' | 'en';
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
  lang,
}) => {
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = 'qr-reader-container';

  useEffect(() => {
    if (!isOpen) {
      if (scannerRef.current) {
        scannerRef.current
          .stop()
          .catch(() => {})
          .finally(() => {
            scannerRef.current = null;
            setIsScanning(false);
          });
      }
      return;
    }

    let isMounted = true;

    const startScanner = async () => {
      try {
        const html5QrCode = new Html5Qrcode(scannerContainerId);
        scannerRef.current = html5QrCode;

        const qrConfig = {
          fps: 25,
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            const edgeSize = Math.max(Math.floor(minEdge * 0.72), 180);
            return { width: edgeSize, height: edgeSize };
          },
          aspectRatio: 1.0,
        };

        const handleSuccess = (decodedText: string) => {
          if (!isMounted) return;
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            try {
              navigator.vibrate([40, 50, 40]);
            } catch {}
          }
          try {
            html5QrCode.stop().catch(() => {});
          } catch {}
          onScanSuccess(decodedText);
          onClose();
        };

        try {
          await html5QrCode.start(
            { facingMode: 'environment' },
            qrConfig,
            handleSuccess,
            () => {}
          );
          if (isMounted) {
            setIsScanning(true);
            setError(null);
          }
          return;
        } catch (envErr) {
          console.warn('Direct environment facingMode failed, falling back to camera list:', envErr);
        }

        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length > 0) {
          const backCam = devices.find((d) =>
            d.label.toLowerCase().includes('back') ||
            d.label.toLowerCase().includes('rear') ||
            d.label.toLowerCase().includes('environment')
          ) || devices[0];

          await html5QrCode.start(
            backCam.id,
            qrConfig,
            handleSuccess,
            () => {}
          );
          if (isMounted) {
            setIsScanning(true);
            setError(null);
          }
          return;
        }

        throw new Error('No camera found on this device');
      } catch (err: any) {
        console.error('Camera QR start error:', err);
        if (isMounted) {
          setError(
            lang === 'hi'
              ? 'Camera access nahi mila. Browser permission allow karein ya PIN dalein.'
              : 'Could not access camera. Please allow camera permissions or enter PIN.'
          );
          setIsScanning(false);
        }
      }
    };

    const timer = setTimeout(() => {
      startScanner();
    }, 150);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (scannerRef.current) {
        scannerRef.current
          .stop()
          .catch(() => {})
          .finally(() => {
            scannerRef.current = null;
            setIsScanning(false);
          });
      }
    };
  }, [isOpen, onScanSuccess, onClose, lang]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-2xl animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm glass-modal rounded-3xl p-5 text-slate-100 overflow-hidden text-center">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3.5 right-3.5 p-2 text-slate-400 hover:text-white rounded-full hover:bg-white/10 transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="p-2 bg-blue-500/15 text-cyan-300 rounded-xl border border-blue-400/25 shadow-inner">
            <Camera className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-white">
            {lang === 'hi' ? 'Laptop Screen Scan Karein' : 'Scan Laptop QR Code'}
          </h3>
        </div>

        <p className="text-xs text-slate-300 mb-4 max-w-xs mx-auto">
          {lang === 'hi'
            ? 'Laptop screen par dikh rahe QR Code ke samne camera layein.'
            : 'Point your camera towards the QR code on your laptop screen.'}
        </p>

        {/* Video stream container */}
        <div className="relative w-full aspect-square bg-slate-950/80 rounded-2xl overflow-hidden border border-white/15 flex items-center justify-center shadow-[0_0_30px_rgba(0,0,0,0.6)]">
          <div id={scannerContainerId} className="w-full h-full" />

          {/* Animated Scanner Laser & Corner Overlay */}
          {isScanning && !error && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="relative w-48 h-48 border-2 border-cyan-400/60 rounded-2xl overflow-hidden shadow-[0_0_20px_rgba(6,182,212,0.3)]">
                {/* Laser scan line in Cyan */}
                <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_12px_#38bdf8] animate-bounce" />
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full glass-modal text-[10px] text-cyan-200 flex items-center gap-1 shadow-md">
                  <Zap className="w-2.5 h-2.5 text-amber-400" />
                  <span>Scanning...</span>
                </div>
              </div>
            </div>
          )}

          {!isScanning && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-2 bg-slate-950/90">
              <RefreshCw className="w-6 h-6 animate-spin text-cyan-400" />
              <span className="text-xs">{lang === 'hi' ? 'Camera shuru ho raha hai...' : 'Starting camera...'}</span>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 p-4 flex flex-col items-center justify-center text-rose-300 gap-2 bg-slate-950/95 text-xs">
              <AlertCircle className="w-6 h-6 text-rose-400 shrink-0" />
              <p>{error}</p>
            </div>
          )}
        </div>

        <div className="mt-4">
          <button
            onClick={onClose}
            className="w-full py-2.5 glass-btn-secondary text-xs font-semibold rounded-xl"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
