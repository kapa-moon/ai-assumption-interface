// Chat Interface - main chat panel (ported from syconistic-dial)
import { useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import type { Message } from '../types';

interface ChatInterfaceProps {
  messages: Message[];
  streamingText: string;
  isLoading: boolean;
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onTextSelect: () => void;
  highlightsByMessage: Record<number, number>;
  loadingConversation: boolean;
  isInputLocked?: boolean;
  isAtLimit?: boolean;
}

export function ChatInterface({
  messages,
  streamingText,
  isLoading,
  input,
  onInputChange,
  onSend,
  onTextSelect,
  highlightsByMessage,
  loadingConversation,
  isInputLocked = false,
  isAtLimit = false,
}: ChatInterfaceProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-resize textarea
  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const lineHeight = parseInt(getComputedStyle(el).lineHeight) || 20;
    const maxHeight = lineHeight * 3 + 40;
    el.style.height = Math.min(el.scrollHeight, maxHeight) + 'px';
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.overflowY = 'hidden';
      }
    }
  };

  return (
    <div className="flex flex-col flex-1 border-r border-zinc-200 min-w-0">
      {/* Messages */}
      <div 
        className="flex-1 overflow-y-auto px-6 py-4 space-y-4"
        onMouseUp={onTextSelect}
      >
        {loadingConversation ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-zinc-400">Loading...</p>
          </div>
        ) : messages.length === 0 && !streamingText && !isLoading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-zinc-400">Start a conversation...</p>
          </div>
        ) : null}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'user' ? (
              <div
                className="max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed text-zinc-900"
                data-message-index={i}
                style={{
                  background: '#ffedd1',
                }}
              >
                {msg.content}
              </div>
            ) : (
              <div className="max-w-[80%] flex flex-col gap-1" data-message-index={i}>
                <div className="px-4 py-2.5 text-zinc-900 text-sm leading-relaxed prose prose-sm max-w-none">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
                <div className="flex items-center gap-3 px-1">
                  {msg.createdAt && (
                    <span className="text-[10px] text-zinc-400">
                      {new Date(msg.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                  {highlightsByMessage[i] ? (
                    <span className="text-[10px] text-zinc-400 flex items-center gap-1">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                      {highlightsByMessage[i]}
                    </span>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Streaming text */}
        {streamingText && (
          <div className="flex justify-start">
            <div className="max-w-[80%] px-4 py-2.5 text-zinc-900 text-sm leading-relaxed prose prose-sm max-w-none">
              <ReactMarkdown>{streamingText}</ReactMarkdown>
              <span className="inline-block w-1 h-3 bg-zinc-400 ml-0.5 animate-pulse" />
            </div>
          </div>
        )}

        {/* Loading indicator */}
        {isLoading && !streamingText && messages.length > 0 && (
          <div className="flex justify-start">
            <div className="px-4 py-2.5">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div className="relative px-6 py-4 bg-white border-t border-zinc-200">
        {/* At-limit overlay */}
        {isAtLimit && (
          <div
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2"
            style={{
              background: 'rgba(255, 255, 255, 0.92)',
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ff4d4d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <p
              className="text-center text-zinc-700 leading-snug px-4"
              style={{ fontFamily: "'Dosis', sans-serif", fontWeight: 600, fontSize: 13 }}
            >
              You've reached the maximum of 20 turns.<br />Please click <span style={{ color: '#ff4d4d' }}>Complete Chat</span> to continue.
            </p>
          </div>
        )}

        {/* Lock overlay */}
        {!isAtLimit && isInputLocked && (
          <div
            className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-b-none"
            style={{
              background: 'rgba(255, 255, 255, 0.88)',
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
            }}
          >
            {/* Lock icon */}
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#71717a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <p
              className="text-center text-zinc-600 leading-snug px-4"
              style={{ fontFamily: "'Dosis', sans-serif", fontWeight: 600, fontSize: 15 }}
            >
              Please review the AI assumption scores on the right<br />before sending your next message
            </p>
          </div>
        )}

        <div className="relative">
          <textarea
            ref={textareaRef}
            className="w-full resize-none border border-zinc-200 rounded-xl px-4 pt-3 pb-10 text-sm outline-none focus:ring-2 focus:ring-zinc-900 leading-relaxed"
            placeholder="Type a message..."
            rows={2}
            value={input}
            onChange={(e) => {
              onInputChange(e.target.value);
              resizeTextarea();
            }}
            onKeyDown={handleKeyDown}
            disabled={isInputLocked || isAtLimit}
          />
          <button
            onClick={() => {
              onSend();
              if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
                textareaRef.current.style.overflowY = 'hidden';
              }
            }}
            disabled={isLoading || isInputLocked || isAtLimit || !input.trim()}
            className="absolute right-3 bottom-3 p-1 text-zinc-900 hover:text-zinc-500 transition-colors disabled:opacity-30 flex items-center justify-center"
            aria-label="Send"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
