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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5 truncate pr-3">
            {isImage && <ImageIcon className="w-5 h-5 text-indigo-400 shrink-0" />}
            {isVideo && <Film className="w-5 h-5 text-cyan-400 shrink-0" />}
            {isAudio && <Music className="w-5 h-5 text-emerald-400 shrink-0" />}
            {!isImage && !isVideo && !isAudio && <FileText className="w-5 h-5 text-slate-400 shrink-0" />}
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
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{lang === 'hi' ? 'Download' : 'Download'}</span>
              </a>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Viewer */}
        <div className="p-4 flex-1 overflow-auto flex items-center justify-center bg-slate-950/40 min-h-[300px]">
          {isImage && downloadUrl && (
            <img
              src={downloadUrl}
              alt={name}
              className="max-h-[60vh] max-w-full object-contain rounded-lg shadow-md"
            />
          )}

          {isVideo && downloadUrl && (
            <video
              src={downloadUrl}
              controls
              autoPlay
              className="max-h-[60vh] max-w-full rounded-lg shadow-md"
            />
          )}

          {isAudio && downloadUrl && (
            <div className="w-full max-w-md p-6 bg-slate-900 border border-slate-800 rounded-xl text-center space-y-4">
              <Music className="w-12 h-12 text-emerald-400 mx-auto animate-pulse" />
              <p className="text-sm font-semibold text-white">{name}</p>
              <audio src={downloadUrl} controls className="w-full" autoPlay />
            </div>
          )}

          {isText && (
            <pre className="w-full h-full max-h-[55vh] p-4 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-200 overflow-auto whitespace-pre-wrap">
              {textContent}
            </pre>
          )}

          {!isImage && !isVideo && !isAudio && !isText && (
            <div className="text-center py-10 space-y-3">
              <FileText className="w-16 h-16 text-slate-600 mx-auto" />
              <p className="text-sm text-slate-400">
                {lang === 'hi'
                  ? 'Is file type ka in-app preview available nahi hai. Download karke open karein.'
                  : 'No in-app preview available for this file type. Click download to open.'}
              </p>
              {downloadUrl && (
                <a
                  href={downloadUrl}
                  download={name}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl"
                >
                  <Download className="w-4 h-4" />
                  <span>{lang === 'hi' ? 'Abhi Download Karein' : 'Download File'}</span>
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
