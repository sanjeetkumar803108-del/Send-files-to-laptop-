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

      {/* Main Drag & Drop Box */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={(e) => {
          handleDrop(e);
          if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFilesChosen(e.dataTransfer.files);
          }
        }}
        className={`relative w-full rounded-2xl border-2 border-dashed p-6 text-center transition-all backdrop-blur-2xl shadow-[0_10px_35px_rgba(24,90,219,0.03)] ${
          isDragging
            ? 'border-[#185ADB] bg-[#EEF4FD]/80 scale-[1.01]'
            : 'border-[#DFD5C0] hover:border-[#185ADB] bg-[#FAF8F5]/85 hover:bg-white/95'
        }`}
      >
        <div className="max-w-md mx-auto flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#EEF4FD] to-[#FFF5EE] text-[#185ADB] border border-[#D8E5FB] flex items-center justify-center mb-2.5 shadow-inner">
            <UploadCloud className="w-6 h-6" />
          </div>

          <h3 className="text-base font-bold text-slate-900 tracking-tight">
            Drop Files
          </h3>

          {/* Action Buttons - Distinct Cobalt, Tangerine, Linen Mix */}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            {/* Cobalt Blue Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-[#185ADB] hover:bg-[#1246AB] text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-md shadow-[#185ADB]/20 transition-all hover:scale-105 active:scale-95"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Files</span>
            </button>

            {/* Tangerine Button */}
            <button
              onClick={() => folderInputRef.current?.click()}
              className="px-4 py-2 bg-[#FF8A3D] hover:bg-[#E66F20] text-white text-xs font-semibold rounded-xl shadow-md shadow-[#FF8A3D]/20 flex items-center gap-1.5 transition-all hover:scale-105 active:scale-95"
            >
              <FolderUp className="w-3.5 h-3.5" />
              <span>Folder</span>
            </button>

            {/* Cream Linen Button with Cobalt Accent */}
            <button
              onClick={() => cameraInputRef.current?.click()}
              className="px-3.5 py-2 bg-white hover:bg-[#F5F1E8] text-[#185ADB] text-xs font-semibold rounded-xl border border-[#DFD5C0] shadow-2xs flex items-center gap-1.5 transition-all hover:scale-105 active:scale-95 sm:hidden"
            >
              <Camera className="w-3.5 h-3.5 text-[#FF8A3D]" />
              <span>Camera</span>
            </button>
          </div>

          {!isPeerConnected && (
            <div className="mt-3 pt-2.5 border-t border-[#E8E0D1] w-full flex items-center justify-center gap-1 text-xs">
              <button
                onClick={onOpenQR}
                className="font-semibold text-[#FF8A3D] hover:text-[#E66F20] flex items-center gap-0.5"
              >
                <span>Pair</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Staged Files Preview */}
      {stagedFiles.length > 0 && (
        <div className="p-3.5 bg-[#FAF8F5]/90 backdrop-blur-2xl border border-[#E8E0D1] rounded-2xl shadow-md space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-800">
                Selected
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-[#EEF4FD] text-[#185ADB] border border-[#D8E5FB] font-semibold">
                {stagedFiles.length} ({formatBytes(totalStagedSize)})
              </span>
            </div>

            <button
              onClick={() => setStagedFiles([])}
              className="text-xs text-slate-400 hover:text-rose-600 transition-colors"
            >
              Clear
            </button>
          </div>

          <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
            {stagedFiles.map((file, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2 rounded-lg bg-white border border-[#E8E0D1] text-xs text-slate-700"
              >
                <div className="flex items-center gap-2 truncate pr-2">
                  <FileText className="w-3.5 h-3.5 text-[#185ADB] shrink-0" />
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
              className="px-5 py-2 bg-gradient-to-r from-[#185ADB] to-[#FF8A3D] hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all shadow-md shadow-[#185ADB]/20 active:scale-95"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isPeerConnected ? 'Send' : 'Connect'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
