import React from 'react';
import {
  FileText,
  Image as ImageIcon,
  Film,
  Music,
  Archive,
  Download,
  Eye,
  XCircle,
  CheckCircle,
  ArrowUpRight,
  ArrowDownLeft,
  Trash2,
  Zap,
} from 'lucide-react';
import { TransferProgress } from '../types/transfer';
import { formatBytes, formatSpeed, formatEta } from '../utils/format';

interface TransferListProps {
  transfers: TransferProgress[];
  autoDownload: boolean;
  onToggleAutoDownload: (val: boolean) => void;
  onCancelTransfer: (fileId: string) => void;
  onPreviewFile: (transfer: TransferProgress) => void;
  onClearTransfers: () => void;
  lang: 'hi' | 'en';
}

export const TransferList: React.FC<TransferListProps> = ({
  transfers,
  autoDownload,
  onToggleAutoDownload,
  onCancelTransfer,
  onPreviewFile,
  onClearTransfers,
  lang,
}) => {
  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <ImageIcon className="w-5 h-5 text-indigo-600" />;
    if (mimeType.startsWith('video/')) return <Film className="w-5 h-5 text-cyan-600" />;
    if (mimeType.startsWith('audio/')) return <Music className="w-5 h-5 text-emerald-600" />;
    if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('compressed')) {
      return <Archive className="w-5 h-5 text-amber-600" />;
    }
    return <FileText className="w-5 h-5 text-slate-500" />;
  };

  const activeTransfers = transfers.filter((t) => t.status === 'transferring' || t.status === 'queued');
  const completedTransfers = transfers.filter((t) => t.status === 'completed' || t.status === 'cancelled' || t.status === 'error');

  return (
    <div className="w-full bg-white/75 backdrop-blur-2xl border border-white/80 rounded-2xl p-4 sm:p-5 shadow-[0_10px_35px_rgba(0,0,0,0.04)] space-y-4">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-slate-900 tracking-tight">
            {lang === 'hi' ? 'Transfers & Files' : 'Transfer Activity'}
          </h3>
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            {transfers.length}
          </span>
        </div>

        <div className="flex items-center gap-4 text-xs">
          {/* Auto Download Toggle */}
          <label className="flex items-center gap-2 cursor-pointer select-none text-slate-600 hover:text-slate-900">
            <input
              type="checkbox"
              checked={autoDownload}
              onChange={(e) => onToggleAutoDownload(e.target.checked)}
              className="w-4 h-4 rounded bg-white border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="font-medium">
              {lang === 'hi' ? 'Auto-Download Incoming' : 'Auto-Download Files'}
            </span>
          </label>

          {transfers.length > 0 && (
            <button
              onClick={onClearTransfers}
              className="text-slate-400 hover:text-rose-600 transition-colors flex items-center gap-1 font-medium"
              title={lang === 'hi' ? 'History saaf karein' : 'Clear History'}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{lang === 'hi' ? 'Clear' : 'Clear'}</span>
            </button>
          )}
        </div>
      </div>

      {transfers.length === 0 ? (
        <div className="py-6 text-center text-slate-400 text-xs">
          <p>{lang === 'hi' ? 'Abhi koi transfer nahi hua hai.' : 'No transfers yet.'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Active Transfers */}
          {activeTransfers.map((item) => (
            <div
              key={item.fileId}
              className="p-3.5 rounded-xl bg-indigo-50/50 border border-indigo-200/80 shadow-xs space-y-2.5"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 truncate">
                  <div className="p-2 rounded-lg bg-white border border-slate-200 shrink-0 shadow-2xs">
                    {getFileIcon(item.type)}
                  </div>
                  <div className="truncate">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-800 truncate max-w-[200px] sm:max-w-xs">
                        {item.name}
                      </span>
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-semibold ${
                        item.direction === 'outgoing'
                          ? 'bg-purple-100 text-purple-700 border border-purple-200'
                          : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                      }`}>
                        {item.direction === 'outgoing' ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownLeft className="w-2.5 h-2.5" />}
                        {item.direction === 'outgoing' ? (lang === 'hi' ? 'Bhej rahe hain' : 'Sending') : (lang === 'hi' ? 'Aa rahi hai' : 'Receiving')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                      <span>{formatBytes(item.transferredBytes)} of {formatBytes(item.size)}</span>
                      <span>•</span>
                      <span className="font-mono text-emerald-600 font-semibold flex items-center gap-1">
                        <Zap className="w-2.5 h-2.5" />
                        {formatSpeed(item.speedBytesPerSec)}
                      </span>
                      <span>•</span>
                      <span>ETA: {formatEta(item.etaSeconds)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-mono font-bold text-indigo-600">
                    {item.progressPercent}%
                  </span>
                  <button
                    onClick={() => onCancelTransfer(item.fileId)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-white transition-colors"
                    title="Cancel"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-2 rounded-full bg-slate-200/80 overflow-hidden relative">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 via-cyan-500 to-emerald-500 rounded-full transition-all duration-150 ease-out"
                  style={{ width: `${item.progressPercent}%` }}
                />
              </div>
            </div>
          ))}

          {/* Completed / Past Transfers */}
          {completedTransfers.map((item) => (
            <div
              key={item.fileId}
              className="p-3 rounded-xl bg-slate-50/80 border border-slate-200/80 hover:bg-slate-100/60 transition-colors flex items-center justify-between gap-3 text-xs"
            >
              <div className="flex items-center gap-3 truncate">
                <div className="p-2 rounded-lg bg-white border border-slate-200 shrink-0 shadow-2xs">
                  {getFileIcon(item.type)}
                </div>
                <div className="truncate">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-800 truncate max-w-[200px] sm:max-w-sm">
                      {item.name}
                    </span>
                    {item.status === 'completed' ? (
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                        <CheckCircle className="w-3 h-3" />
                        {lang === 'hi' ? 'Complete' : 'Complete'}
                      </span>
                    ) : item.status === 'cancelled' ? (
                      <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                        {lang === 'hi' ? 'Cancelled' : 'Cancelled'}
                      </span>
                    ) : (
                      <span className="text-[10px] text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                        {lang === 'hi' ? 'Error' : 'Error'}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                    <span>{formatBytes(item.size)}</span>
                    <span>•</span>
                    <span>{item.direction === 'outgoing' ? 'Sent' : 'Received'}</span>
                    <span>•</span>
                    <span className="text-slate-400">{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              </div>

              {/* Actions for completed */}
              <div className="flex items-center gap-1.5 shrink-0">
                {item.status === 'completed' && item.downloadUrl && (
                  <>
                    <button
                      onClick={() => onPreviewFile(item)}
                      className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-white rounded-lg transition-colors border border-slate-200 shadow-2xs"
                      title={lang === 'hi' ? 'Preview dekhein' : 'Preview'}
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <a
                      href={item.downloadUrl}
                      download={item.name}
                      className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg flex items-center gap-1 font-semibold transition-colors shadow-2xs"
                      title={lang === 'hi' ? 'File save karein' : 'Download'}
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span className="text-[11px]">{lang === 'hi' ? 'Save' : 'Save'}</span>
                    </a>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
