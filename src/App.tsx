// Main App Component - brings together chat and mental model panels
import { useEffect, useRef, useCallback, useState } from 'react';
import { ChatInterface } from './components/ChatInterface';
import { MentalModelsPanel } from './components/MentalModelsPanel';
// import { FeedbackWidget } from './components/FeedbackWidget';
import { HighlightPopup, type ActiveHighlight } from './components/HighlightPopup';
import { useChat } from './hooks/useChat';
import { parseQualtricsParams } from './services/qualtrics';
import './index.css';

function App() {
  // Get Qualtrics parameters from URL
  const [qualtricsParams] = useState(() => parseQualtricsParams());
  
  // Section refs for navigation
  const section1Ref = useRef<HTMLDivElement>(null);
  const section2Ref = useRef<HTMLDivElement>(null);

  // Highlight popup state
  const [activeHighlight, setActiveHighlight] = useState<ActiveHighlight | null>(null);

  // Initialize chat hook
  const {
    messages,
    input,
    setInput,
    isLoading,
    streamingText,
    mentalModel,
    mentalModelsByTurn,
    isLoadingMentalModel,
    liveInductUser,
    liveTypesSupportUser,
    highlightsByMessage,
    handleSend,
    handleInductChange,
    handleTypesSupportChange,
    handleInductConfirmDimension,
    handleTypesSupportConfirmDimension,
    handleInductCancel,
    handleTypesSupportCancel,
    handleInductReactionChange,
    handleTypesSupportReactionChange,
    handleSaveHighlight,
    signalChatComplete,
  } = useChat({
    qualtricsParams,
  });

  // Handle text selection for highlights
  const handleTextSelect = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;
    
    const text = selection.toString().trim();
    if (!text) return;
    
    const range = selection.getRangeAt(0);
    let node: HTMLElement | null = range.commonAncestorContainer as HTMLElement;
    if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
    while (node && !node.dataset?.messageIndex) node = node.parentElement;
    if (!node) return;
    
    const msgIdx = parseInt(node.dataset.messageIndex!);
    const rect = range.getBoundingClientRect();
    
    setActiveHighlight({
      text,
      messageIndex: msgIdx,
      anchorRect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
    });
  }, []);

  // Dismiss highlight popup on click outside
  useEffect(() => {
    if (!activeHighlight) return;
    const dismiss = () => setActiveHighlight(null);
    document.addEventListener('mousedown', dismiss);
    return () => document.removeEventListener('mousedown', dismiss);
  }, [activeHighlight]);

  // Save highlight handler
  const onSaveHighlight = useCallback((text: string, msgIdx: number, reaction: 'up' | 'down' | null, comment: string) => {
    setActiveHighlight(null);
    window.getSelection()?.removeAllRanges();
    handleSaveHighlight(text, msgIdx, reaction, comment);
  }, [handleSaveHighlight]);

  // Handle chat completion (when user is done)
  const handleComplete = useCallback(() => {
    // Signal completion to Qualtrics (turn count is tracked internally)
    signalChatComplete();
  }, [signalChatComplete]);

  return (
    <div className="flex flex-col h-screen bg-zinc-50">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-zinc-200 z-10">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-zinc-900">AI Assumptions Study</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-500">Session: {qualtricsParams.sessionId.slice(0, 8)}</span>
          <button
            onClick={handleComplete}
            className="text-sm font-bold px-4 py-2 bg-[#ff4d4d] text-white rounded hover:bg-[#ff3333] transition-colors shadow-sm"
          >
            Complete Chat
          </button>
        </div>
      </header>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Chat panel */}
        <ChatInterface
          messages={messages}
          streamingText={streamingText}
          isLoading={isLoading}
          input={input}
          onInputChange={setInput}
          onSend={handleSend}
          onTextSelect={handleTextSelect}
          highlightsByMessage={highlightsByMessage}
          loadingConversation={false}
        />

        {/* Right panel - Mental Models */}
        <div className="flex flex-col flex-shrink-0 overflow-hidden border-l border-zinc-200" style={{ width: '45%' }}>
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-zinc-200 flex-shrink-0">
            <span style={{ fontFamily: "'Dosis', sans-serif", fontWeight: 600, color: '#000', fontSize: '16px', lineHeight: '1.35' }}>
              What does the AI assume about you when answering your questions?
            </span>
            <div className="flex items-center gap-2 ml-3 flex-shrink-0">
              {isLoadingMentalModel && (
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
              )}
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-red-800 border border-red-200 rounded-lg bg-red-50 whitespace-nowrap shadow-sm" style={{ fontFamily: "'Dosis', sans-serif" }}>
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: '#dc2626' }} />
                Please review both sections ⚠️
              </div>
              <button
                onClick={() => section1Ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: 6, backgroundColor: '#18181b', color: '#fff', fontFamily: "'Dosis', sans-serif", fontWeight: 700, fontSize: 13, cursor: 'pointer', border: 'none' }}
              >
                1
              </button>
              <button
                onClick={() => section2Ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: 6, backgroundColor: '#18181b', color: '#fff', fontFamily: "'Dosis', sans-serif", fontWeight: 700, fontSize: 13, cursor: 'pointer', border: 'none' }}
              >
                2
              </button>
            </div>
          </div>

          {/* Mental models content */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <p className="text-sm font-light text-black leading-relaxed mb-3">
              Updated after each AI response, based on your conversation.
            </p>
            <MentalModelsPanel
              mentalModel={mentalModel}
              mentalModelsByTurn={mentalModelsByTurn}
              isLoading={isLoadingMentalModel}
              liveInductUser={liveInductUser}
              liveTypesSupportUser={liveTypesSupportUser}
              onInductChange={handleInductChange}
              onTypesSupportChange={handleTypesSupportChange}
              onInductConfirmDimension={handleInductConfirmDimension}
              onTypesSupportConfirmDimension={handleTypesSupportConfirmDimension}
              onInductCancel={handleInductCancel}
              onTypesSupportCancel={handleTypesSupportCancel}
              onInductReactionChange={handleInductReactionChange}
              onTypesSupportReactionChange={handleTypesSupportReactionChange}
              section1Ref={section1Ref}
              section2Ref={section2Ref}
            />
          </div>
        </div>
      </div>

      {/* Feedback widget - temporarily disabled */}
      {/* {false && (
        <FeedbackWidget key={messages.filter((m) => m.role === 'assistant').length} onSubmit={handleFeedbackSubmit} />
      )} */}

      {/* Highlight popup */}
      {activeHighlight && (
        <HighlightPopup
          active={activeHighlight}
          onSave={onSaveHighlight}
          onDismiss={() => setActiveHighlight(null)}
        />
      )}
    </div>
  );
}

export default App;
