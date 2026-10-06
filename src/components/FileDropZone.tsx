import React, { useRef, useState } from 'react';
import { UploadCloud, FolderUp, Camera, FileText, Send, X, ArrowUpRight } from 'lucide-react';
import { formatBytes } from '../utils/format';

interface FileDropZoneProps {
  onSendFiles: (files: FileList | File[]) => void;
  isPeerConnected: boolean;
  onOpenQR: () => void;
  lang: 'hi' | 'en';
}

export const FileDropZone: React.FC<FileDropZoneProps> = ({
  onSendFiles,
  isPeerConnected,
  onOpenQR,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleFilesChosen = (files: FileList | File[]) => {
    if (files && files.length > 0) {
      if (isPeerConnected) {
        onSendFiles(files);
      } else {
        setStagedFiles(Array.from(files));
      }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFilesChosen(e.target.files);
      e.target.value = '';
    }
  };

  const handleSendStaged = () => {
    if (stagedFiles.length > 0 && isPeerConnected) {
      onSendFiles(stagedFiles);
      setStagedFiles([]);
    }
  };

  const removeStagedFile = (index: number) => {
    setStagedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const totalStagedSize = stagedFiles.reduce((acc, f) => acc + f.size, 0);

  return (
    <div className="w-full space-y-3">
      {/* Hidden file inputs */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        multiple
        className="hidden"
      />
      <input
        type="file"
        ref={folderInputRef}
        onChange={handleFileInputChange}
        // @ts-expect-error webkitdirectory is standard for folder upload
        webkitdirectory=""
        className="hidden"
      />
      <input
        type="file"
        ref={cameraInputRef}
        onChange={handleFileInputChange}
        accept="image/*,video/*"
        capture="environment"
        className="hidden"
      />

      {/* Main Drag & Drop Glass Box */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={(e) => {
          handleDrop(e);
          if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFilesChosen(e.dataTransfer.files);
          }
        }}
        className={`relative w-full rounded-3xl border-2 border-dashed p-6 sm:p-8 text-center transition-all duration-300 glass-panel ${
          isDragging
            ? 'border-blue-500 bg-blue-50/60 shadow-[0_12px_36px_rgba(37,99,235,0.18)] scale-[1.01]'
            : 'border-slate-300/80 hover:border-blue-400 hover:bg-white/85'
        }`}
      >
        <div className="max-w-md mx-auto flex flex-col items-center justify-center">
          {/* Glowing Cloud Orb */}
          <div className="relative group mb-3">
            <div className="absolute -inset-2 rounded-2xl bg-gradient-to-r from-blue-500 to-cyan-400 opacity-20 blur-md group-hover:opacity-40 transition duration-300" />
            <div className="relative w-14 h-14 rounded-2xl glass-card flex items-center justify-center text-blue-600 border border-white/80 shadow-sm">
              <UploadCloud className="w-7 h-7" />
            </div>
          </div>

          <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
            Drag & Drop Files Here
          </h3>
          <p className="text-xs text-slate-600 mt-1 max-w-xs">
            Direct high-speed P2P transfer between Laptop and Mobile
          </p>

          {/* Action Buttons - Distinct Frosted Glass Style */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
            {/* Blue Glass Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 glass-btn-primary text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-sm active:scale-95"
            >
              <FileText className="w-3.5 h-3.5 text-blue-100" />
              <span>Choose Files</span>
            </button>

            {/* Amber Glass Button */}
            <button
              onClick={() => folderInputRef.current?.click()}
              className="px-4 py-2 glass-btn-accent text-white text-xs font-semibold rounded-xl shadow-sm flex items-center gap-1.5 active:scale-95"
            >
              <FolderUp className="w-3.5 h-3.5 text-amber-100" />
              <span>Select Folder</span>
            </button>

            {/* Camera Button on Mobile */}
            <button
              onClick={() => cameraInputRef.current?.click()}
              className="px-3.5 py-2 glass-btn-secondary text-xs font-semibold rounded-xl flex items-center gap-1.5 active:scale-95 sm:hidden"
            >
              <Camera className="w-3.5 h-3.5 text-emerald-600" />
              <span>Camera</span>
            </button>
          </div>

          {!isPeerConnected && (
            <div className="mt-4 pt-3 border-t border-slate-200/80 w-full flex items-center justify-center gap-1 text-xs">
              <span className="text-slate-500">Device not connected?</span>
              <button
                onClick={onOpenQR}
                className="font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-0.5 transition-colors"
              >
                <span>Pair Devices</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Staged Files Preview */}
      {stagedFiles.length > 0 && (
        <div className="p-4 glass-panel rounded-2xl space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900">
                Selected Files
              </span>
              <span className="text-xs px-2.5 py-0.5 rounded-full glass-pill text-blue-700 border-blue-200 bg-blue-50/70 font-semibold">
                {stagedFiles.length} ({formatBytes(totalStagedSize)})
              </span>
            </div>

            <button
              onClick={() => setStagedFiles([])}
              className="text-xs text-slate-500 hover:text-rose-600 transition-colors font-medium"
            >
              Clear
            </button>
          </div>

          <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
            {stagedFiles.map((file, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2 rounded-xl glass-card text-xs text-slate-800 border-white/80"
              >
                <div className="flex items-center gap-2 truncate pr-2">
                  <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span className="truncate font-medium">{file.name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] text-slate-500">{formatBytes(file.size)}</span>
                  <button
                    onClick={() => removeStagedFile(idx)}
                    className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-1 flex justify-end">
            <button
              onClick={handleSendStaged}
              disabled={!isPeerConnected}
              className="px-5 py-2 glass-btn-primary disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-sm active:scale-95"
            >
              <Send className="w-3.5 h-3.5 text-blue-100" />
              <span>{isPeerConnected ? 'Send Now' : 'Connect First'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
