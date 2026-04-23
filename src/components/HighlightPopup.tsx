// Highlight popup for text selection feedback (ported from syconistic-dial)
import { useState } from 'react';

export interface ActiveHighlight {
  text: string;
  messageIndex: number;
  anchorRect: { top: number; left: number; width: number; height: number };
}

interface HighlightPopupProps {
  active: ActiveHighlight;
  onSave: (text: string, msgIdx: number, reaction: 'up' | 'down' | null, comment: string) => void;
  onDismiss: () => void;
}

export function HighlightPopup({ active, onSave, onDismiss }: HighlightPopupProps) {
  const [reaction, setReaction] = useState<'up' | 'down' | null>(null);
  const [comment, setComment] = useState('');

  const handleSave = () => {
    if (!reaction && !comment.trim()) {
      onDismiss();
      return;
    }
    onSave(active.text, active.messageIndex, reaction, comment.trim());
    setReaction(null);
    setComment('');
  };

  const popupWidth = 260;
  const { top, left, width, height } = active.anchorRect;
  const posLeft = Math.max(
    8,
    Math.min(window.innerWidth - popupWidth - 8, left + width / 2 - popupWidth / 2)
  );
  const posTop = top < 140 ? top + height + 8 : top - 148;

  return (
    <div
      className="fixed z-50 bg-white border border-zinc-200 rounded-xl shadow-xl p-3"
      style={{
        width: popupWidth,
        top: posTop,
        left: posLeft,
        fontFamily: "'Dosis', sans-serif",
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Dosis:wght@400;500;600;700&display=swap');`}</style>
      
      <p className="text-[11px] text-zinc-400 mb-2 leading-relaxed italic line-clamp-2">
        &ldquo;{active.text.length > 80 ? active.text.slice(0, 80) + '…' : active.text}&rdquo;
      </p>
      
      <div className="flex items-center gap-2 mb-2">
        <button
          onClick={() => setReaction((r) => (r === 'up' ? null : 'up'))}
          className="w-7 h-7 flex items-center justify-center text-base border transition-colors"
          style={{
            borderRadius: 4,
            borderColor: reaction === 'up' ? '#16a34a' : '#e4e4e7',
            backgroundColor: reaction === 'up' ? '#f0fdf4' : '#fff',
          }}
        >
          👍
        </button>
        <button
          onClick={() => setReaction((r) => (r === 'down' ? null : 'down'))}
          className="w-7 h-7 flex items-center justify-center text-base border transition-colors"
          style={{
            borderRadius: 4,
            borderColor: reaction === 'down' ? '#dc2626' : '#e4e4e7',
            backgroundColor: reaction === 'down' ? '#fef2f2' : '#fff',
          }}
        >
          👎
        </button>
        <span className="text-[10px] text-zinc-300 ml-auto select-none">highlight</span>
      </div>
      
      <div className="relative">
        <input
          type="text"
          autoFocus
          className="w-full text-[12px] rounded border border-zinc-200 py-1.5 pl-2.5 pr-7 focus:outline-none focus:border-zinc-400 bg-white"
          style={{ fontFamily: "'Dosis', sans-serif" }}
          placeholder="Add a comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleSave();
            }
            if (e.key === 'Escape') onDismiss();
          }}
        />
        <button
          onClick={handleSave}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[12px] text-zinc-400 hover:text-zinc-700"
        >
          ↵
        </button>
      </div>
    </div>
  );
}
