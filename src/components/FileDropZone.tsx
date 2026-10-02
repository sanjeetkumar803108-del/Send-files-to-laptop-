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
  lang,
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

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      if (isPeerConnected) {
        onSendFiles(e.dataTransfer.files);
      } else {
        // Stage files and prompt user to connect
        setStagedFiles(Array.from(e.dataTransfer.files));
      }
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      if (isPeerConnected) {
        onSendFiles(e.target.files);
      } else {
        setStagedFiles(Array.from(e.target.files));
      }
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

      {/* Main Drag & Drop Box */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative w-full rounded-2xl border-2 border-dashed p-6 sm:p-8 text-center transition-all ${
          isDragging
            ? 'border-indigo-500 bg-indigo-500/10 scale-[1.01]'
            : 'border-slate-700/80 hover:border-slate-600 bg-slate-900/60 hover:bg-slate-900/90'
        } ${!isPeerConnected ? 'opacity-90' : ''}`}
      >
        <div className="max-w-md mx-auto flex flex-col items-center justify-center">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
            <UploadCloud className="w-8 h-8" />
          </div>

          <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
            {lang === 'hi'
              ? 'Files Drag & Drop karein ya Select karein'
              : 'Drag & Drop Files Here or Select Below'}
          </h3>

          {/* Action Buttons */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl flex items-center gap-2 shadow-md shadow-indigo-600/20 transition-all hover:scale-105 active:scale-95"
            >
              <FileText className="w-4 h-4" />
              <span>{lang === 'hi' ? 'Files Chunein' : 'Select Files'}</span>
            </button>

            <button
              onClick={() => folderInputRef.current?.click()}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl border border-slate-700 flex items-center gap-1.5 transition-all hover:scale-105 active:scale-95"
            >
              <FolderUp className="w-4 h-4 text-cyan-400" />
              <span>{lang === 'hi' ? 'Folder Chunein' : 'Select Folder'}</span>
            </button>

            <button
              onClick={() => cameraInputRef.current?.click()}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl border border-slate-700 flex items-center gap-1.5 transition-all hover:scale-105 active:scale-95 sm:hidden"
            >
              <Camera className="w-4 h-4 text-emerald-400" />
              <span>{lang === 'hi' ? 'Camera' : 'Camera'}</span>
            </button>
          </div>

          {!isPeerConnected && (
            <div className="mt-4 pt-3 border-t border-slate-800/80 w-full flex items-center justify-center gap-2 text-xs">
              <button
                onClick={onOpenQR}
                className="underline font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5"
              >
                <span>{lang === 'hi' ? 'Pairing QR Code Kholein' : 'Open Pairing QR Code'}</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Staged Files Preview (if selected before peer connected) */}
      {stagedFiles.length > 0 && (
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                {lang === 'hi' ? 'Selected Files' : 'Selected Files'}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                {stagedFiles.length} files ({formatBytes(totalStagedSize)})
              </span>
            </div>

            <button
              onClick={() => setStagedFiles([])}
              className="text-xs text-slate-400 hover:text-red-400 transition-colors"
            >
              {lang === 'hi' ? 'Clear' : 'Clear All'}
            </button>
          </div>

          <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
            {stagedFiles.map((file, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2 rounded-lg bg-slate-950/70 border border-slate-800 text-xs text-slate-300"
              >
                <div className="flex items-center gap-2 truncate pr-2">
                  <FileText className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span className="truncate">{file.name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] text-slate-500">{formatBytes(file.size)}</span>
                  <button
                    onClick={() => removeStagedFile(idx)}
                    className="p-1 text-slate-500 hover:text-red-400 rounded transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2 flex justify-end">
            <button
              onClick={handleSendStaged}
              disabled={!isPeerConnected}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-xl flex items-center gap-2 transition-colors shadow-md shadow-emerald-600/20"
            >
              <Send className="w-3.5 h-3.5" />
              <span>
                {isPeerConnected
                  ? (lang === 'hi' ? 'Abhi Send Karein' : 'Send Now')
                  : (lang === 'hi' ? 'Pehle Device Connect Karein' : 'Connect Device First')}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
