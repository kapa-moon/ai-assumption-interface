import { useEffect, useRef, useCallback, useState } from 'react';
import { ChatInterface } from '../components/ChatInterface';
import { TwoDimMentalModelsPanel } from '../components/TwoDimMentalModelsPanel';
import { HighlightPopup, type ActiveHighlight } from '../components/HighlightPopup';
import { useChatTwoDim } from '../hooks/useChatTwoDim';
import { parseQualtricsParams } from '../services/qualtrics';
import '../index.css';

export default function AiAssumptionTwoDimension() {
  const [qualtricsParams] = useState(() => parseQualtricsParams());

  const section1Ref = useRef<HTMLDivElement>(null);
  const section2Ref = useRef<HTMLDivElement>(null);

  const [activeHighlight, setActiveHighlight] = useState<ActiveHighlight | null>(null);
  const [showRules, setShowRules] = useState(false);

  const {
    messages,
    input,
    setInput,
    isLoading,
    streamingText,
    twoDimModel,
    twoDimModelsByTurn,
    isLoadingModel,
    livePerspectiveUser,
    highlightsByMessage,
    handleSend,
    handlePerspectiveChange,
    handlePerspectiveCancel,
    handlePerspectiveConfirm,
    handlePerspectiveReactionChange,
    handlePerspectiveSaveComment,
    handleTurnIntentChange,
    handleTurnIntentReasonSave,
    handleSaveHighlight,
    signalChatComplete,
    isAtLimit,
  } = useChatTwoDim({ qualtricsParams });

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

  useEffect(() => {
    if (!activeHighlight) return;
    const dismiss = () => setActiveHighlight(null);
    document.addEventListener('mousedown', dismiss);
    return () => document.removeEventListener('mousedown', dismiss);
  }, [activeHighlight]);

  const onSaveHighlight = useCallback((text: string, msgIdx: number, reaction: 'up' | 'down' | null, comment: string) => {
    setActiveHighlight(null);
    window.getSelection()?.removeAllRanges();
    handleSaveHighlight(text, msgIdx, reaction, comment);
  }, [handleSaveHighlight]);

  const lastMM = twoDimModelsByTurn[twoDimModelsByTurn.length - 1];
  const perspectiveReactionCount = Object.keys(lastMM?.perspectiveUserReactions ?? {}).length;
  const currentTurn = twoDimModelsByTurn.length;
  const isMandatoryReviewTurn = currentTurn === 1 || (currentTurn > 1 && currentTurn % 4 === 0);
  const isInputLocked =
    !isLoading &&
    !isLoadingModel &&
    currentTurn > 0 &&
    isMandatoryReviewTurn &&
    perspectiveReactionCount < 2;

  const MIN_TURNS = 8;
  const canComplete = twoDimModelsByTurn.length >= MIN_TURNS;

  const handleComplete = useCallback(() => {
    if (!canComplete) {
      alert(`Please complete at least ${MIN_TURNS} turns before finishing. You have completed ${twoDimModelsByTurn.length} so far.`);
      return;
    }
    signalChatComplete();
  }, [canComplete, twoDimModelsByTurn.length, signalChatComplete]);

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
            title={canComplete ? 'Complete the chat' : `Please complete at least ${MIN_TURNS} turns before finishing. You have completed ${twoDimModelsByTurn.length} so far.`}
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
              <li>After each AI response, review the two assumption scores in section{' '}
                <span className="inline-flex items-center justify-center w-[22px] h-[22px] rounded-md bg-zinc-900 text-white text-[13px] font-bold align-middle mx-0.5">1</span>
                {' '}by giving each a thumbs up or thumbs down.
              </li>
              <li>
                If you disagree with a score, give it a thumbs down, drag the slider to your preferred value, confirm the new score, and briefly explain why.
              </li>
              <li>
                In section{' '}
                <span className="inline-flex items-center justify-center w-[22px] h-[22px] rounded-md bg-zinc-900 text-white text-[13px] font-bold align-middle mx-0.5">2</span>
                {' '}and section{' '}
                <span className="inline-flex items-center justify-center w-[22px] h-[22px] rounded-md bg-zinc-900 text-white text-[13px] font-bold align-middle mx-0.5">3</span>
                {' '}you can click a different option if the AI's choice doesn't match what you think.
              </li>
              <li>On turn 1 and every 4 turns after that, reviewing both scores in section 1 is required before you can continue.</li>
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

        {/* Right panel */}
        <div className="flex flex-col flex-shrink-0 overflow-hidden border-l border-zinc-200" style={{ width: '45%' }}>
          <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-zinc-200 flex-shrink-0">
            <span className="font-semibold text-black" style={{ fontFamily: 'Dosis, sans-serif', fontWeight: 600, fontSize: '18px', lineHeight: '1.35' }}>
              What does the AI assume about you when answering your questions?
            </span>
            <div className="flex items-center gap-2 ml-3 flex-shrink-0">
              {isLoadingModel && (
                <div
                  className="animate-spin flex-shrink-0"
                  style={{ width: 18, height: 18, border: '2.5px solid #ede9fe', borderTopColor: '#7c3aed', borderRadius: '50%' }}
                />
              )}
              <button
                type="button"
                onClick={() => section1Ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className="inline-flex items-center justify-center w-[22px] h-[22px] rounded-md bg-zinc-900 text-white font-bold text-[13px] cursor-pointer border-none"
              >1</button>
              <button
                type="button"
                onClick={() => section2Ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className="inline-flex items-center justify-center w-[22px] h-[22px] rounded-md bg-zinc-900 text-white font-bold text-[13px] cursor-pointer border-none"
              >2</button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {twoDimModelsByTurn.length === 0 && !isLoadingModel && (
              <div className="flex flex-col items-center justify-center h-full text-center px-4 gap-4">
                <p style={{ fontFamily: "'Dosis', sans-serif", fontWeight: 700, fontSize: '26px', lineHeight: '1.5', color: '#18181b' }}>
                  Updated after each AI response, based on your conversation.
                </p>
                <p style={{ fontFamily: "'Dosis', sans-serif", fontWeight: 500, fontSize: '15px', color: '#a1a1aa' }}>
                  Start chatting to see the AI's assumptions.
                </p>
              </div>
            )}

            {isLoadingModel && twoDimModelsByTurn.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-4">
                <div className="animate-spin" style={{ width: 32, height: 32, border: '3px solid #ede9fe', borderTopColor: '#7c3aed', borderRadius: '50%' }} />
                <p style={{ fontFamily: "'Dosis', sans-serif", fontWeight: 500, fontSize: '14px', color: '#a1a1aa' }}>
                  Analyzing your conversation…
                </p>
              </div>
            )}

            <TwoDimMentalModelsPanel
              twoDimModel={twoDimModel}
              twoDimModelsByTurn={twoDimModelsByTurn}
              isLoading={isLoadingModel}
              livePerspectiveUser={livePerspectiveUser}
              onPerspectiveChange={handlePerspectiveChange}
              onPerspectiveConfirm={handlePerspectiveConfirm}
              onPerspectiveCancel={handlePerspectiveCancel}
              onPerspectiveReactionChange={handlePerspectiveReactionChange}
              onPerspectiveSaveComment={handlePerspectiveSaveComment}
              onTurnIntentChange={handleTurnIntentChange}
              onTurnIntentReasonSave={handleTurnIntentReasonSave}
              section1Ref={section1Ref}
              section2Ref={section2Ref}
            />
          </div>
        </div>
      </div>

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
