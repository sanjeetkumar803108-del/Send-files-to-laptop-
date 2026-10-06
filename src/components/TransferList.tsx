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
  Clock,
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
    if (mimeType.startsWith('image/')) return <ImageIcon className="w-5 h-5 text-cyan-400" />;
    if (mimeType.startsWith('video/')) return <Film className="w-5 h-5 text-amber-400" />;
    if (mimeType.startsWith('audio/')) return <Music className="w-5 h-5 text-emerald-400" />;
    if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('compressed')) {
      return <Archive className="w-5 h-5 text-purple-400" />;
    }
    return <FileText className="w-5 h-5 text-slate-300" />;
  };

  const activeTransfers = transfers
    .filter((t) => t.status === 'transferring' || t.status === 'queued')
    .sort((a, b) => {
      if (a.status === 'transferring' && b.status === 'queued') return -1;
      if (a.status === 'queued' && b.status === 'transferring') return 1;
      return a.timestamp - b.timestamp;
    });
  const completedTransfers = transfers.filter((t) => t.status === 'completed' || t.status === 'cancelled' || t.status === 'error');

  return (
    <div className="w-full glass-panel rounded-3xl p-4 sm:p-5 space-y-4 transition-all">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-slate-900 tracking-tight">
            Transfers
          </h3>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold glass-pill text-blue-700 border-blue-200 bg-blue-50/70">
            {transfers.length}
          </span>
        </div>

        <div className="flex items-center gap-4 text-xs">
          {/* Auto Download Toggle */}
          <label className="flex items-center gap-2 cursor-pointer select-none text-slate-600 hover:text-slate-900 transition-colors">
            <input
              type="checkbox"
              checked={autoDownload}
              onChange={(e) => onToggleAutoDownload(e.target.checked)}
              className="w-4 h-4 rounded bg-white border-slate-300 text-blue-600 focus:ring-blue-400/40"
            />
            <span className="font-semibold text-xs">Auto Download</span>
          </label>

          {transfers.length > 0 && (
            <button
              onClick={onClearTransfers}
              className="text-slate-400 hover:text-rose-600 transition-colors flex items-center gap-1 font-semibold"
              title="Clear History"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {transfers.length === 0 ? (
        <div className="py-6 text-center text-slate-400 text-xs">
          <p>No transfers yet. Drop files above or select files to transfer.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Active and Queued Transfers */}
          {activeTransfers.map((item) => {
            const isQueued = item.status === 'queued';

            if (isQueued) {
              return (
                <div
                  key={item.fileId}
                  className="p-3.5 rounded-2xl glass-card border border-slate-200/80 space-y-2 relative overflow-hidden"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1 truncate">
                      <div className="p-2 rounded-xl bg-slate-100 border border-slate-200 shrink-0 shadow-xs">
                        {getFileIcon(item.type)}
                      </div>
                      <div className="min-w-0 flex-1 truncate">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900 truncate max-w-[130px] xs:max-w-[180px] sm:max-w-xs">
                            {item.name}
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300 shrink-0">
                            <Clock className="w-2.5 h-2.5 animate-spin" style={{ animationDuration: '4s' }} />
                            <span>Queued</span>
                          </span>
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold glass-pill text-slate-600 shrink-0">
                            {item.direction === 'outgoing' ? <ArrowUpRight className="w-2.5 h-2.5 text-blue-600" /> : <ArrowDownLeft className="w-2.5 h-2.5 text-emerald-600" />}
                            {item.direction === 'outgoing' ? 'Send' : 'Receive'}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500 mt-0.5">
                          <span>{formatBytes(item.size)}</span>
                          <span>•</span>
                          <span className="text-amber-700 font-medium">
                            {lang === 'hi' ? 'कतार में (पहले ट्रांसफ़र का इंतज़ार...)' : 'Waiting in line...'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => onCancelTransfer(item.fileId)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 transition-colors"
                        title="Cancel"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Pulsing indicator for queued state */}
                  <div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden relative">
                    <div className="h-full bg-gradient-to-r from-amber-400 to-orange-400 rounded-full opacity-70 w-full animate-pulse" />
                  </div>
                </div>
              );
            }

            return (
              <div
                key={item.fileId}
                className="p-3.5 rounded-2xl glass-card border border-blue-300/80 shadow-[0_8px_25px_rgba(37,99,235,0.08)] space-y-2.5"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1 truncate">
                    <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-400/25 shrink-0 shadow-xs">
                      {getFileIcon(item.type)}
                    </div>
                    <div className="min-w-0 flex-1 truncate">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 truncate max-w-[130px] xs:max-w-[180px] sm:max-w-xs">
                          {item.name}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold shrink-0 ${
                          item.direction === 'outgoing'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                          {item.direction === 'outgoing' ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownLeft className="w-2.5 h-2.5" />}
                          {item.direction === 'outgoing' ? 'Sending' : 'Receiving'}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-600 mt-0.5">
                        <span>{formatBytes(item.transferredBytes)} / {formatBytes(item.size)}</span>
                        <span>•</span>
                        <span className="font-mono text-blue-600 font-bold flex items-center gap-0.5">
                          <Zap className="w-2.5 h-2.5 text-amber-500" />
                          {formatSpeed(item.speedBytesPerSec)}
                        </span>
                        <span>•</span>
                        <span>ETA: {formatEta(item.etaSeconds)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-mono font-extrabold text-blue-600">
                      {item.progressPercent}%
                    </span>
                    <button
                      onClick={() => onCancelTransfer(item.fileId)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 transition-colors"
                      title="Cancel"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Progress Bar - Glowing Luminous Beam */}
                <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden relative border border-slate-300/50">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 shadow-[0_0_10px_rgba(37,99,235,0.4)] rounded-full transition-all duration-150 ease-out"
                    style={{ width: `${item.progressPercent}%` }}
                  />
                </div>
              </div>
            );
          })}

          {/* Completed / Past Transfers */}
          {completedTransfers.map((item) => (
            <div
              key={item.fileId}
              className="p-3 rounded-2xl glass-card border-white/80 hover:border-blue-300/60 transition-all flex items-center justify-between gap-3 text-xs"
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1 truncate">
                <div className="p-2 rounded-xl bg-slate-100 border border-slate-200/80 shrink-0 shadow-xs">
                  {getFileIcon(item.type)}
                </div>
                <div className="min-w-0 flex-1 truncate">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900 truncate max-w-[130px] xs:max-w-[200px] sm:max-w-sm">
                      {item.name}
                    </span>
                    {item.status === 'completed' ? (
                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-800 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-300 shrink-0">
                        <CheckCircle className="w-3 h-3 text-emerald-600" />
                        Complete
                      </span>
                    ) : item.status === 'cancelled' ? (
                      <span className="text-[10px] text-slate-500 glass-pill px-2 py-0.5 rounded-full">
                        Cancelled
                      </span>
                    ) : (
                      <span className="text-[10px] text-rose-800 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-300">
                        Error
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                    <span>{formatBytes(item.size)}</span>
                    <span>•</span>
                    <span>{item.direction === 'outgoing' ? 'Sent' : 'Received'}</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 shrink-0">
                {item.status === 'completed' && item.downloadUrl && (
                  <>
                    <button
                      onClick={() => onPreviewFile(item)}
                      className="p-1.5 text-slate-600 hover:text-slate-900 glass-btn-secondary rounded-lg transition-colors"
                      title="Preview"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <a
                      href={item.downloadUrl}
                      download={item.name}
                      className="px-3 py-1.5 glass-btn-primary rounded-xl flex items-center gap-1 font-semibold text-xs transition-colors shadow-sm"
                      title="Save File"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Save</span>
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
