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
    <div className="w-full bg-[#FAF8F5]/90 backdrop-blur-2xl border border-[#E8E0D1] rounded-2xl p-4 sm:p-5 shadow-[0_10px_35px_rgba(24,90,219,0.03)] space-y-3">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2.5 text-left w-full group"
        >
          <div className="p-1.5 rounded-lg bg-[#EEF4FD] text-[#185ADB] border border-[#D8E5FB]">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <h4 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-[#185ADB] transition-colors">
              Text
            </h4>
          </div>
          <div className="p-1 text-slate-400 group-hover:text-slate-600">
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>
      </div>

      {isExpanded && (
        <div className="space-y-3 pt-2 border-t border-[#E8E0D1] animate-in fade-in duration-150">
          {/* Input Form */}
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              placeholder="Type message or link..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={!isPeerConnected}
              className="flex-1 bg-white border border-[#DFD5C0] rounded-xl px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-[#185ADB] focus:ring-1 focus:ring-[#185ADB] shadow-xs transition-colors disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || !isPeerConnected}
              className="px-4 py-2 bg-[#FF8A3D] hover:bg-[#E66F20] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send</span>
            </button>
          </form>

          {/* Snippets List */}
          {snippets.length > 0 && (
            <div className="max-h-48 overflow-y-auto space-y-2 pr-1 pt-1">
              {snippets.map((snip) => (
                <div
                  key={snip.id}
                  className="p-2.5 rounded-xl bg-white border border-[#E8E0D1] flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0 flex-1 truncate">
                    <p className="text-slate-800 font-mono text-xs select-all truncate">{snip.text}</p>
                    <span className="text-[10px] text-slate-400 mt-0.5 block truncate">
                      {snip.senderName} • {new Date(snip.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(snip.id, snip.text)}
                    className="p-1.5 bg-[#FAF8F5] hover:bg-[#F5F1E8] text-slate-600 rounded-lg flex items-center gap-1 shrink-0 transition-colors border border-[#E8E0D1] shadow-2xs"
                    title="Copy"
                  >
                    {copiedId === snip.id ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
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
