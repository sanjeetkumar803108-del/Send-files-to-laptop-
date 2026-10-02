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
    <div className="w-full bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl backdrop-blur-sm space-y-3">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-left w-full group"
        >
          <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <h4 className="text-xs sm:text-sm font-bold text-white group-hover:text-indigo-300 transition-colors">
              {lang === 'hi' ? 'Quick Text Share' : 'Quick Text Share'}
            </h4>
          </div>
          <div className="p-1 text-slate-400 group-hover:text-white">
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>
      </div>

      {isExpanded && (
        <div className="space-y-3 pt-2 border-t border-slate-800 animate-in fade-in duration-150">
          {/* Input Form */}
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              placeholder={lang === 'hi' ? 'Koi bhi link ya message type karein...' : 'Type or paste link, text, code...'}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={!isPeerConnected}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500 transition-colors disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || !isPeerConnected}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{lang === 'hi' ? 'Send' : 'Send'}</span>
            </button>
          </form>

          {/* Snippets List */}
          {snippets.length > 0 && (
            <div className="max-h-48 overflow-y-auto space-y-2 pr-1 pt-1">
              {snippets.map((snip) => (
                <div
                  key={snip.id}
                  className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="truncate">
                    <p className="text-slate-200 font-mono text-xs select-all truncate">{snip.text}</p>
                    <span className="text-[10px] text-slate-500 mt-0.5 block">
                      {snip.senderName} • {new Date(snip.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(snip.id, snip.text)}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg flex items-center gap-1 shrink-0 transition-colors border border-slate-700"
                    title="Copy text"
                  >
                    {copiedId === snip.id ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
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
