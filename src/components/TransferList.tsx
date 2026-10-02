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
    if (mimeType.startsWith('image/')) return <ImageIcon className="w-5 h-5 text-[#185ADB]" />;
    if (mimeType.startsWith('video/')) return <Film className="w-5 h-5 text-[#FF8A3D]" />;
    if (mimeType.startsWith('audio/')) return <Music className="w-5 h-5 text-emerald-600" />;
    if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('compressed')) {
      return <Archive className="w-5 h-5 text-amber-600" />;
    }
    return <FileText className="w-5 h-5 text-slate-500" />;
  };

  const activeTransfers = transfers
    .filter((t) => t.status === 'transferring' || t.status === 'queued')
    .sort((a, b) => {
      // Currently transferring item stays on top, followed by queued items chronologically
      if (a.status === 'transferring' && b.status === 'queued') return -1;
      if (a.status === 'queued' && b.status === 'transferring') return 1;
      return a.timestamp - b.timestamp;
    });
  const completedTransfers = transfers.filter((t) => t.status === 'completed' || t.status === 'cancelled' || t.status === 'error');

  return (
    <div className="w-full bg-[#FAF8F5]/90 backdrop-blur-2xl border border-[#E8E0D1] rounded-2xl p-4 sm:p-5 shadow-[0_10px_35px_rgba(24,90,219,0.03)] space-y-4">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#E8E0D1]">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-slate-900 tracking-tight">
            Transfers
          </h3>
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-white text-slate-700 border border-[#E8E0D1]">
            {transfers.length}
          </span>
        </div>

        <div className="flex items-center gap-4 text-xs">
          {/* Auto Download Toggle */}
          <label className="flex items-center gap-1.5 cursor-pointer select-none text-slate-600 hover:text-slate-900">
            <input
              type="checkbox"
              checked={autoDownload}
              onChange={(e) => onToggleAutoDownload(e.target.checked)}
              className="w-4 h-4 rounded bg-white border-[#DFD5C0] text-[#185ADB] focus:ring-[#185ADB]"
            />
            <span className="font-semibold">Auto</span>
          </label>

          {transfers.length > 0 && (
            <button
              onClick={onClearTransfers}
              className="text-slate-400 hover:text-rose-600 transition-colors flex items-center gap-1 font-semibold"
              title="Clear"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {transfers.length === 0 ? (
        <div className="py-5 text-center text-slate-400 text-xs">
          <p>No transfers</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {/* Active and Queued Transfers */}
          {activeTransfers.map((item) => {
            const isQueued = item.status === 'queued';

            if (isQueued) {
              return (
                <div
                  key={item.fileId}
                  className="p-3 rounded-xl bg-white border border-[#E8E0D1] shadow-xs space-y-2 relative overflow-hidden"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1 truncate">
                      <div className="p-2 rounded-lg bg-[#FAF8F5] border border-[#E8E0D1] shrink-0 shadow-2xs">
                        {getFileIcon(item.type)}
                      </div>
                      <div className="min-w-0 flex-1 truncate">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-800 truncate max-w-[130px] xs:max-w-[180px] sm:max-w-xs">
                            {item.name}
                          </span>
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#FFF5EE] text-[#FF8A3D] border border-[#FFE6D5] shrink-0">
                            <Clock className="w-2.5 h-2.5 animate-spin" style={{ animationDuration: '4s' }} />
                            <span>Queued</span>
                          </span>
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#FAF8F5] text-slate-500 border border-[#E8E0D1] shrink-0">
                            {item.direction === 'outgoing' ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownLeft className="w-2.5 h-2.5" />}
                            {item.direction === 'outgoing' ? 'Send' : 'Receive'}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500 mt-0.5">
                          <span>{formatBytes(item.size)}</span>
                          <span>•</span>
                          <span className="text-[#FF8A3D] font-medium">
                            {lang === 'hi' ? 'कतार में (पहले ट्रांसफ़र का इंतज़ार...)' : 'Waiting in line...'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => onCancelTransfer(item.fileId)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-[#FAF8F5] transition-colors"
                        title="Cancel"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Warm gentle pulsing indicator for queued state */}
                  <div className="w-full h-1.5 rounded-full bg-[#EFECE6] overflow-hidden relative">
                    <div className="h-full bg-gradient-to-r from-amber-300 via-[#FF8A3D] to-amber-300 rounded-full opacity-60 w-full animate-pulse" />
                  </div>
                </div>
              );
            }

            return (
              <div
                key={item.fileId}
                className="p-3 rounded-xl bg-[#EEF4FD]/80 border border-[#D8E5FB] shadow-xs space-y-2"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1 truncate">
                    <div className="p-2 rounded-lg bg-white border border-[#D8E5FB] shrink-0 shadow-2xs">
                      {getFileIcon(item.type)}
                    </div>
                    <div className="min-w-0 flex-1 truncate">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-800 truncate max-w-[130px] xs:max-w-[180px] sm:max-w-xs">
                          {item.name}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-semibold shrink-0 ${
                          item.direction === 'outgoing'
                            ? 'bg-[#FFF5EE] text-[#FF8A3D] border border-[#FFE6D5]'
                            : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                        }`}>
                          {item.direction === 'outgoing' ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownLeft className="w-2.5 h-2.5" />}
                          {item.direction === 'outgoing' ? 'Sending' : 'Receiving'}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500 mt-0.5">
                        <span>{formatBytes(item.transferredBytes)} / {formatBytes(item.size)}</span>
                        <span>•</span>
                        <span className="font-mono text-[#FF8A3D] font-semibold flex items-center gap-0.5">
                          <Zap className="w-2.5 h-2.5" />
                          {formatSpeed(item.speedBytesPerSec)}
                        </span>
                        <span>•</span>
                        <span>ETA: {formatEta(item.etaSeconds)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-mono font-bold text-[#185ADB]">
                      {item.progressPercent}%
                    </span>
                    <button
                      onClick={() => onCancelTransfer(item.fileId)}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-white transition-colors"
                      title="Cancel"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Progress Bar - Cobalt Blue to Tangerine Gradient */}
                <div className="w-full h-1.5 rounded-full bg-slate-200/80 overflow-hidden relative">
                  <div
                    className="h-full bg-gradient-to-r from-[#185ADB] via-[#8B5CF6] to-[#FF8A3D] rounded-full transition-all duration-150 ease-out"
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
              className="p-2.5 rounded-xl bg-white border border-[#E8E0D1] hover:bg-[#FAF8F5] transition-colors flex items-center justify-between gap-3 text-xs"
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1 truncate">
                <div className="p-1.5 rounded-lg bg-[#FAF8F5] border border-[#E8E0D1] shrink-0 shadow-2xs">
                  {getFileIcon(item.type)}
                </div>
                <div className="min-w-0 flex-1 truncate">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-800 truncate max-w-[130px] xs:max-w-[200px] sm:max-w-sm">
                      {item.name}
                    </span>
                    {item.status === 'completed' ? (
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 shrink-0">
                        <CheckCircle className="w-3 h-3" />
                        Complete
                      </span>
                    ) : item.status === 'cancelled' ? (
                      <span className="text-[10px] text-slate-500 bg-[#F5F1E8] px-1.5 py-0.5 rounded border border-[#E8E0D1]">
                        Cancelled
                      </span>
                    ) : (
                      <span className="text-[10px] text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                        Error
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
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
                      className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-[#FAF8F5] rounded-lg transition-colors border border-[#E8E0D1] shadow-2xs"
                      title="Preview"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <a
                      href={item.downloadUrl}
                      download={item.name}
                      className="px-2.5 py-1 bg-[#185ADB] hover:bg-[#1246AB] text-white rounded-lg flex items-center gap-1 font-semibold transition-colors shadow-2xs shadow-[#185ADB]/20"
                      title="Save"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span className="text-[11px]">Save</span>
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
