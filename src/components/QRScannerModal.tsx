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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm bg-white/95 border border-white/80 rounded-3xl shadow-2xl p-5 text-slate-800 overflow-hidden text-center backdrop-blur-2xl">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3.5 right-3.5 p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100 shadow-inner">
            <Camera className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-slate-900">
            {lang === 'hi' ? 'Laptop Screen Scan Karein' : 'Scan Laptop QR Code'}
          </h3>
        </div>

        <p className="text-xs text-slate-500 mb-4 max-w-xs mx-auto">
          {lang === 'hi'
            ? 'Laptop screen par dikh rahe QR Code ke samne camera layein.'
            : 'Point your camera towards the QR code on your laptop.'}
        </p>

        {/* Video stream container */}
        <div className="relative w-full aspect-square bg-slate-900 rounded-2xl overflow-hidden border border-slate-200 flex items-center justify-center shadow-inner">
          <div id={scannerContainerId} className="w-full h-full" />
          
          {!isScanning && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-2 bg-slate-900">
              <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
              <span className="text-xs">{lang === 'hi' ? 'Camera shuru ho raha hai...' : 'Starting camera...'}</span>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 p-4 flex flex-col items-center justify-center text-rose-300 gap-2 bg-slate-900/95 text-xs">
              <AlertCircle className="w-6 h-6 text-rose-400 shrink-0" />
              <p>{error}</p>
            </div>
          )}
        </div>

        <div className="mt-4">
          <button
            onClick={onClose}
            className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition-colors shadow-2xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
