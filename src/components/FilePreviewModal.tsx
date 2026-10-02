import React, { useEffect, useState } from 'react';
import { X, Download, FileText, Image as ImageIcon, Film, Music } from 'lucide-react';
import { formatBytes } from '../utils/format';

interface FilePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  name: string;
  size: number;
  type: string;
  blob?: Blob;
  downloadUrl?: string;
  lang: 'hi' | 'en';
}

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({
  isOpen,
  onClose,
  name,
  size,
  type,
  blob,
  downloadUrl,
  lang,
}) => {
  const [textContent, setTextContent] = useState<string | null>(null);

  useEffect(() => {
    if (blob && (type.startsWith('text/') || type.includes('json') || type.includes('javascript') || type.includes('csv'))) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setTextContent(e.target?.result as string);
      };
      reader.readAsText(blob);
    } else {
      setTextContent(null);
    }
  }, [blob, type]);

  if (!isOpen) return null;

  const isImage = type.startsWith('image/');
  const isVideo = type.startsWith('video/');
  const isAudio = type.startsWith('audio/');
  const isText = textContent !== null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-[#FAF8F5]/98 border border-[#E8E0D1] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] backdrop-blur-2xl">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#E8E0D1] flex items-center justify-between bg-[#F5F1E8]/80">
          <div className="flex items-center gap-2.5 truncate pr-3">
            {isImage && <ImageIcon className="w-5 h-5 text-[#185ADB] shrink-0" />}
            {isVideo && <Film className="w-5 h-5 text-[#FF8A3D] shrink-0" />}
            {isAudio && <Music className="w-5 h-5 text-[#FF8A3D] shrink-0" />}
            {!isImage && !isVideo && !isAudio && <FileText className="w-5 h-5 text-slate-500 shrink-0" />}
            <div className="truncate">
              <h3 className="text-sm font-bold text-slate-900 truncate">{name}</h3>
              <p className="text-[11px] text-slate-500">{formatBytes(size)} • {type || 'File'}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {downloadUrl && (
              <a
                href={downloadUrl}
                download={name}
                className="px-3 py-1.5 bg-[#185ADB] hover:bg-[#1349b0] text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{lang === 'hi' ? 'Download' : 'Download'}</span>
              </a>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-full hover:bg-[#E8E0D1]/50 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Viewer */}
        <div className="p-4 flex-1 overflow-auto flex items-center justify-center bg-[#F5F1E8]/40 min-h-[300px]">
          {isImage && downloadUrl && (
            <img
              src={downloadUrl}
              alt={name}
              className="max-h-[60vh] max-w-full object-contain rounded-xl shadow-md"
            />
          )}

          {isVideo && downloadUrl && (
            <video
              src={downloadUrl}
              controls
              autoPlay
              className="max-h-[60vh] max-w-full rounded-xl shadow-md"
            />
          )}

          {isAudio && downloadUrl && (
            <div className="w-full max-w-md p-6 bg-[#FAF8F5] border border-[#E8E0D1] rounded-2xl text-center space-y-4 shadow-sm">
              <Music className="w-12 h-12 text-[#FF8A3D] mx-auto animate-pulse" />
              <p className="text-sm font-bold text-slate-800">{name}</p>
              <audio src={downloadUrl} controls className="w-full" autoPlay />
            </div>
          )}

          {isText && (
            <pre className="w-full h-full max-h-[55vh] p-4 bg-[#FAF8F5] border border-[#E8E0D1] rounded-xl text-xs font-mono text-slate-800 overflow-auto whitespace-pre-wrap shadow-inner">
              {textContent}
            </pre>
          )}

          {!isImage && !isVideo && !isAudio && !isText && (
            <div className="text-center py-10 space-y-3">
              <FileText className="w-16 h-16 text-slate-300 mx-auto" />
              <p className="text-sm text-slate-600">
                {lang === 'hi'
                  ? 'Is file type ka in-app preview available nahi hai. Download karke open karein.'
                  : 'No in-app preview available for this file type. Click download to open.'}
              </p>
              {downloadUrl && (
                <a
                  href={downloadUrl}
                  download={name}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#185ADB] hover:bg-[#1349b0] text-white text-xs font-semibold rounded-xl shadow-md shadow-[#185ADB]/20"
                >
                  <Download className="w-4 h-4" />
                  <span>Download</span>
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
