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
  const [showRules, setShowRules] = useState(false);

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
    handleInductSaveComment,
    handleTypesSupportSaveComment,
    handleSaveHighlight,
    signalChatComplete,
    isAtLimit,
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

  // Lock input until every score has a reaction:
  // all 4 INDUCT dimensions + all 2 TYPES_SUPPORT dimensions shown in the panel
  const lastMM = mentalModelsByTurn[mentalModelsByTurn.length - 1];
  const inductReactionCount = Object.keys(lastMM?.inductUserReactions ?? {}).length;
  const typesSupportReactionCount = Object.keys(lastMM?.typesSupportUserReactions ?? {}).length;
  const isInputLocked =
    !isLoading &&
    !isLoadingMentalModel &&
    mentalModelsByTurn.length > 0 &&
    (inductReactionCount < 4 || typesSupportReactionCount < 2);

  const MIN_TURNS = 8;
  const canComplete = mentalModelsByTurn.length >= MIN_TURNS;

  // Handle chat completion (when user is done)
  const handleComplete = useCallback(() => {
    if (!canComplete) {
      alert(`Please complete at least ${MIN_TURNS} turns before finishing. You have completed ${mentalModelsByTurn.length} so far.`);
      return;
    }
    signalChatComplete();
  }, [canComplete, mentalModelsByTurn.length, signalChatComplete]);

  return (
    <div className="flex flex-col h-screen bg-zinc-50">
      {/* Header */}
      <header className="relative flex items-center justify-between px-4 py-3 bg-white border-b border-zinc-200 z-10">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-zinc-900">AI Assumptions Study</span>
          <button
            onClick={() => setShowRules((prev) => !prev)}
            className="text-xs font-semibold px-2.5 py-1.5 rounded border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 transition-colors"
            type="button"
          >
            Instruction
          </button>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-500">Session: {qualtricsParams.sessionId.slice(0, 8)}</span>
          <button
            onClick={handleComplete}
            className="text-sm font-bold px-4 py-2 text-white rounded transition-colors shadow-sm"
            title={canComplete ? 'Complete the chat' : `Please complete at least ${MIN_TURNS} turns before finishing. You have completed ${mentalModelsByTurn.length} so far.`}
            style={{ backgroundColor: canComplete ? '#ff4d4d' : '#d4d4d8', cursor: canComplete ? 'pointer' : 'help' }}
          >
            Complete Chat
          </button>
        </div>
        {showRules && (
          <div className="absolute left-4 top-full mt-2 w-[440px] rounded-xl border border-zinc-200 bg-white p-4 shadow-xl z-50">
            <div className="flex items-start justify-between gap-3 mb-2">
              <h2 className="text-sm font-bold text-zinc-900">How to use this tool</h2>
              <button
                onClick={() => setShowRules(false)}
                className="text-xs font-bold px-2.5 py-1 rounded bg-zinc-900 text-white hover:bg-zinc-700 transition-colors"
                type="button"
              >
                Close
              </button>
            </div>
            <ul className="space-y-2 text-sm text-zinc-700 leading-relaxed">
              <li>You will discuss the situation you wrote about earlier with the AI chatbot.</li>
              <li>Please complete at least <strong>8 turns</strong>.</li>
              <li>After each AI response, review each AI assumption score by giving it a thumbs up or thumbs down.</li>
              <li>
                If you are not happy with a score, give it a thumbs down. Then tune the slider to match your own view as closely as possible.
                {' '}Make sure to <strong>confirm</strong> your new score and briefly explain your rationale.
              </li>
              <li>
                You must review all scores in section{' '}
                <span className="inline-flex items-center justify-center w-[22px] h-[22px] rounded-md bg-zinc-900 text-white text-[13px] font-bold align-middle mx-0.5">1</span>
                {' '}and section{' '}
                <span className="inline-flex items-center justify-center w-[22px] h-[22px] rounded-md bg-zinc-900 text-white text-[13px] font-bold align-middle mx-0.5">2</span>
                {' '}(scroll down on the right; section 2 sits below section 1) —{' '}
                <strong className="text-red-600">6</strong> scores in total — before proceeding to your next message.
              </li>
              <li>The chart shows the AI's assumed scores and your adjustments across conversational turns.</li>
              <li>We know this takes attention and effort. Your careful review is important, and we appreciate it :)</li>
            </ul>
          </div>
        )}
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
          isInputLocked={isInputLocked}
          isAtLimit={isAtLimit}
          onScrollToSection={(section) => {
            const target = section === 1 ? section1Ref.current : section2Ref.current;
            target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
          onOpenInstructions={() => setShowRules(true)}
        />

        {/* Right panel - Mental Models */}
        <div className="flex flex-col flex-shrink-0 overflow-hidden border-l border-zinc-200" style={{ width: '45%' }}>
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-zinc-200 flex-shrink-0">
            <span className="font-semibold text-black" style={{ fontFamily: 'Dosis, sans-serif', fontWeight: 600, fontSize: '18px', lineHeight: '1.35' }}>
              What does the AI assume about you when answering your questions?
            </span>
            <div className="flex items-center gap-2 ml-3 flex-shrink-0">
              {isLoadingMentalModel && (
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
              )}
              <button
                type="button"
                onClick={() => section1Ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className="inline-flex items-center justify-center w-[22px] h-[22px] rounded-md bg-zinc-900 text-white font-bold text-[13px] cursor-pointer border-none"
              >
                1
              </button>
              <button
                type="button"
                onClick={() => section2Ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className="inline-flex items-center justify-center w-[22px] h-[22px] rounded-md bg-zinc-900 text-white font-bold text-[13px] cursor-pointer border-none"
              >
                2
              </button>
            </div>
          </div>

          {/* Mental models content */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {(isLoadingMentalModel || mentalModelsByTurn.length === 0) && (
              <p className="text-base font-light text-black leading-relaxed mb-3">
                Updated after each AI response, based on your conversation.
              </p>
            )}
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
              onInductSaveComment={handleInductSaveComment}
              onTypesSupportSaveComment={handleTypesSupportSaveComment}
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
