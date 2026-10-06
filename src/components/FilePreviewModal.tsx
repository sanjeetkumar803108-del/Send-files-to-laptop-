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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-2xl animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl glass-modal rounded-3xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5 truncate pr-3">
            {isImage && <ImageIcon className="w-5 h-5 text-cyan-400 shrink-0" />}
            {isVideo && <Film className="w-5 h-5 text-amber-400 shrink-0" />}
            {isAudio && <Music className="w-5 h-5 text-emerald-400 shrink-0" />}
            {!isImage && !isVideo && !isAudio && <FileText className="w-5 h-5 text-slate-300 shrink-0" />}
            <div className="truncate">
              <h3 className="text-sm font-bold text-white truncate">{name}</h3>
              <p className="text-[11px] text-slate-400">{formatBytes(size)} • {type || 'File'}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {downloadUrl && (
              <a
                href={downloadUrl}
                download={name}
                className="px-3.5 py-1.5 glass-btn-primary text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 active:scale-95 shadow-md"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{lang === 'hi' ? 'Download' : 'Download'}</span>
              </a>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-full hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Viewer */}
        <div className="p-4 flex-1 overflow-auto flex items-center justify-center bg-black/30 min-h-[300px]">
          {isImage && downloadUrl && (
            <img
              src={downloadUrl}
              alt={name}
              className="max-h-[60vh] max-w-full object-contain rounded-xl shadow-2xl ring-1 ring-white/15"
            />
          )}

          {isVideo && downloadUrl && (
            <video
              src={downloadUrl}
              controls
              autoPlay
              className="max-h-[60vh] max-w-full rounded-xl shadow-2xl ring-1 ring-white/15"
            />
          )}

          {isAudio && downloadUrl && (
            <div className="w-full max-w-md p-6 glass-card rounded-2xl text-center space-y-4 border-white/10">
              <Music className="w-12 h-12 text-cyan-400 mx-auto animate-pulse" />
              <p className="text-sm font-bold text-white">{name}</p>
              <audio src={downloadUrl} controls className="w-full" autoPlay />
            </div>
          )}

          {isText && (
            <pre className="w-full h-full max-h-[55vh] p-4 glass-card rounded-xl text-xs font-mono text-slate-200 overflow-auto whitespace-pre-wrap border-white/10 scrollbar-thin">
              {textContent}
            </pre>
          )}

          {!isImage && !isVideo && !isAudio && !isText && (
            <div className="text-center py-10 space-y-3">
              <FileText className="w-16 h-16 text-slate-500 mx-auto" />
              <p className="text-sm text-slate-300">
                {lang === 'hi'
                  ? 'Is file type ka in-app preview available nahi hai. Download karke open karein.'
                  : 'No in-app preview available for this file type. Click download to save.'}
              </p>
              {downloadUrl && (
                <a
                  href={downloadUrl}
                  download={name}
                  className="inline-flex items-center gap-1.5 px-4 py-2 glass-btn-primary text-xs font-semibold rounded-xl shadow-md"
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
