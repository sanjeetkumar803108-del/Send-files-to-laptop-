import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, AlertCircle, RefreshCw } from 'lucide-react';

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

    const timer = setTimeout(() => {
      try {
        const html5QrCode = new Html5Qrcode(scannerContainerId);
        scannerRef.current = html5QrCode;

        html5QrCode
          .start(
            { facingMode: 'environment' },
            {
              fps: 10,
              qrbox: { width: 250, height: 250 },
            },
            (decodedText) => {
              // Successfully decoded QR code
              try {
                html5QrCode.stop().catch(() => {});
              } catch {}
              onScanSuccess(decodedText);
              onClose();
            },
            () => {
              // ignore frame misses
            }
          )
          .then(() => {
            setIsScanning(true);
            setError(null);
          })
          .catch((err) => {
            console.error('Camera QR start error:', err);
            setError(
              lang === 'hi'
                ? 'Camera access nahi mila. Browser permission allow karein ya PIN code enter karein.'
                : 'Could not access camera. Please allow camera permissions or enter the 6-digit PIN.'
            );
            setIsScanning(false);
          });
      } catch (e: any) {
        setError(e.message || 'Scanner initialization error');
      }
    }, 200);

    return () => {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-5 text-slate-100 overflow-hidden text-center">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3.5 right-3.5 p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg border border-indigo-500/20">
            <Camera className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-white">
            {lang === 'hi' ? 'Laptop Screen Scan Karein' : 'Scan Laptop QR Code'}
          </h3>
        </div>

        <p className="text-xs text-slate-400 mb-4 max-w-xs mx-auto">
          {lang === 'hi'
            ? 'Laptop screen par jo QR Code dikh raha hai, phone ke camera ko uske samne layein.'
            : 'Point your phone camera towards the QR code displayed on your laptop screen.'}
        </p>

        {/* Video stream container */}
        <div className="relative w-full aspect-square bg-black rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center">
          <div id={scannerContainerId} className="w-full h-full" />
          
          {!isScanning && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-2 bg-slate-950">
              <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
              <span className="text-xs">{lang === 'hi' ? 'Camera shuru ho raha hai...' : 'Starting camera...'}</span>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 p-4 flex flex-col items-center justify-center text-rose-400 gap-2 bg-slate-950/90 text-xs">
              <AlertCircle className="w-6 h-6 text-rose-400 shrink-0" />
              <p>{error}</p>
            </div>
          )}
        </div>

        <div className="mt-4">
          <button
            onClick={onClose}
            className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 transition-colors"
          >
            {lang === 'hi' ? 'Band Karein (Close)' : 'Close Scanner'}
          </button>
        </div>
      </div>
    </div>
  );
};
