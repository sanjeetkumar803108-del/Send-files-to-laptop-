import React, { useState } from 'react';
import { MessageSquare, Send, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { SharedSnippet } from '../types/transfer';

interface QuickShareTextProps {
  snippets: SharedSnippet[];
  onSendText: (text: string) => void;
  isPeerConnected: boolean;
  lang: 'hi' | 'en';
}

export const QuickShareText: React.FC<QuickShareTextProps> = ({
  snippets,
  onSendText,
  isPeerConnected,
  lang,
}) => {
  const [inputText, setInputText] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim()) {
      onSendText(inputText.trim());
      setInputText('');
    }
  };

  const copyToClipboard = (id: string, text: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  return (
    <div className="w-full glass-panel rounded-3xl p-4 sm:p-5 space-y-3 transition-all">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-3 text-left w-full group"
        >
          <div className="p-2.5 rounded-2xl bg-blue-500/10 text-blue-600 border border-blue-400/25 shrink-0 shadow-xs group-hover:bg-blue-500/20 transition-colors">
            <MessageSquare className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                Quick Text & Link Share
              </h4>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold glass-pill text-amber-700 border-amber-300/40">
                Clipboard
              </span>
            </div>
            <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">
              {lang === 'hi'
                ? 'Mobile aur Laptop ke beech links, notes, text ya messages turant share karein'
                : 'Instantly share text, website links, notes or clipboard between mobile & laptop'}
            </p>
          </div>
          <div className="p-2 rounded-xl glass-card text-slate-500 group-hover:text-slate-900 transition-colors shrink-0">
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>
      </div>

      {isExpanded && (
        <div className="space-y-3 pt-2 border-t border-slate-200/80 animate-in fade-in duration-150">
          {/* Input Form */}
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              placeholder={lang === 'hi' ? 'Koi bhi link, note ya message type karein...' : 'Type message, link, or note...'}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={!isPeerConnected}
              className="flex-1 glass-input rounded-xl px-3.5 py-2 text-xs text-slate-900 placeholder:text-slate-400 outline-none transition-all disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || !isPeerConnected}
              className="px-4 py-2 glass-btn-accent disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send</span>
            </button>
          </form>

          {/* Snippets List */}
          {snippets.length > 0 && (
            <div className="max-h-48 overflow-y-auto space-y-2 pr-1 pt-1 scrollbar-thin">
              {snippets.map((snip) => (
                <div
                  key={snip.id}
                  className="p-3 rounded-xl glass-card border border-white/80 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0 flex-1 truncate">
                    <p className="text-slate-800 font-mono text-xs select-all truncate">{snip.text}</p>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                      <span className="font-semibold text-blue-600">{snip.senderName}</span>
                      <span>•</span>
                      <span>{new Date(snip.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => copyToClipboard(snip.id, snip.text)}
                    className="p-1.5 glass-btn-secondary text-slate-600 hover:text-slate-900 rounded-lg transition-colors shrink-0"
                    title="Copy Text"
                  >
                    {copiedId === snip.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
