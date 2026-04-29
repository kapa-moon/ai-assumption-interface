// Mental Models Panel - main right panel component (ported from syconistic-dial)
import { useState, useCallback } from 'react';
import { DraggableScoreBar } from './DraggableScoreBar';
import { ScoresChart } from './ScoresChart';
import type { CombinedMentalModel } from '../types';

const INDUCT_SERIES = [
  { key: 'validation_seeking', label: 'Validation seeking', color: '#f8961e' },
  { key: 'user_rightness', label: 'User rightness', color: '#619b8a' },
  { key: 'user_information_advantage', label: 'User info advantage', color: '#f25c54' },
  { key: 'objectivity_seeking', label: 'Objectivity seeking', color: '#3c096c' },
] as const;

const TYPES_SUPPORT_SERIES = [
  { key: 'emotional_support', label: 'Emotional support', color: '#ef476f' },
  { key: 'information_guidance', label: 'Information & guidance', color: '#3a86ff' },
] as const;

interface MentalModelsPanelProps {
  mentalModel: CombinedMentalModel | null;
  mentalModelsByTurn: CombinedMentalModel[];
  isLoading: boolean;
  liveInductUser: Record<string, number> | null;
  liveTypesSupportUser: Record<string, number> | null;
  onInductChange: (key: string, score: number) => void;
  onTypesSupportChange: (key: string, score: number) => void;
  onInductConfirmDimension: (key: string, reason: string) => void;
  onTypesSupportConfirmDimension: (key: string, reason: string) => void;
  onInductCancel: (key: string) => void;
  onTypesSupportCancel: (key: string) => void;
  onInductReactionChange: (key: string, dir: 'up' | 'down' | null) => void;
  onTypesSupportReactionChange: (key: string, dir: 'up' | 'down' | null) => void;
  onInductSaveComment: (key: string, comment: string) => void;
  onTypesSupportSaveComment: (key: string, comment: string) => void;
  section1Ref?: React.RefObject<HTMLDivElement | null>;
  section2Ref?: React.RefObject<HTMLDivElement | null>;
}

function SectionBadge({ n }: { n: 1 | 2 }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 22,
        height: 22,
        borderRadius: 6,
        backgroundColor: '#18181b',
        color: '#fff',
        fontFamily: "'Dosis', sans-serif",
        fontWeight: 700,
        fontSize: 13,
        flexShrink: 0,
      }}
    >
      {n}
    </span>
  );
}

interface ScoreSectionProps {
  title: string;
  sectionNumber?: 1 | 2;
  series: readonly { key: string; label: string; color: string }[];
  beliefs: Record<string, { score: number; explanation?: string }> | undefined;
  userBeliefs?: Record<string, number> | null;
  liveBeliefs?: Record<string, number> | null;
  reactions?: Record<string, 'up' | 'down'> | null;
  turnsData: unknown[];
  userScoresByTurn?: (Record<string, number> | null)[];
  isLoading: boolean;
  onUserScoreChange: (key: string, score: number) => void;
  onConfirmDimension: (key: string, reason: string) => void;
  onCancel: (key: string) => void;
  onReactionChange: (key: string, dir: 'up' | 'down' | null) => void;
  onSaveComment: (key: string, comment: string) => void;
}

function ScoreSection({
  title,
  sectionNumber,
  series,
  beliefs,
  userBeliefs,
  liveBeliefs,
  reactions,
  turnsData,
  userScoresByTurn,
  isLoading,
  onUserScoreChange,
  onConfirmDimension,
  onCancel,
  onReactionChange,
  onSaveComment,
}: ScoreSectionProps) {
  // Local text for reason (👎) and comment (👍) inputs, keyed by dimension
  const [localText, setLocalText] = useState<Record<string, string>>({});
  // Keys where the comment/reason was saved — hides the input until re-interaction
  const [dismissedKeys, setDismissedKeys] = useState<Record<string, boolean>>({});
  // Keys where score has been confirmed — unlocks comment box, locks slider
  const [confirmedScoreKeys, setConfirmedScoreKeys] = useState<Record<string, boolean>>({});
  // Keys that were recently saved — shows a brief "Saved" flash
  const [savedKeys, setSavedKeys] = useState<Record<string, boolean>>({});

  // Dismiss the box immediately, flash "Saved" briefly outside it
  const flashSavedAndDismiss = useCallback((key: string) => {
    setDismissedKeys((prev) => ({ ...prev, [key]: true })); // box gone immediately
    setSavedKeys((prev) => ({ ...prev, [key]: true }));     // "Saved" appears
    setTimeout(() => {
      setSavedKeys((prev) => { const n = { ...prev }; delete n[key]; return n; }); // "Saved" fades
    }, 1200);
  }, []);

  const undismiss = useCallback((key: string) => {
    setDismissedKeys((prev) => { const n = { ...prev }; delete n[key]; return n; });
  }, []);

  // Confirm a score change — locks slider and opens comment box
  const handleConfirmScore = useCallback((key: string) => {
    onConfirmDimension(key, '');
    setConfirmedScoreKeys((prev) => ({ ...prev, [key]: true }));
  }, [onConfirmDimension]);

  // Save a comment (for 👍, 👎 no-drag, or post-confirm 👎)
  const handleSaveComment = useCallback((key: string) => {
    const text = localText[key]?.trim() ?? '';
    if (!text) return;
    onSaveComment(key, text);
    setLocalText((prev) => { const n = { ...prev }; delete n[key]; return n; });
    flashSavedAndDismiss(key);
  }, [localText, onSaveComment, flashSavedAndDismiss]);

  const toggleReaction = (key: string, dir: 'up' | 'down') => {
    const current = reactions?.[key];
    const newDir = current === dir ? null : dir;
    // Leaving 👎 — cancel any pending score drag
    if (current === 'down' && newDir !== 'down') {
      onCancel(key);
      setLocalText((prev) => { const n = { ...prev }; delete n[key]; return n; });
    }
    // Re-interaction: show the textbox again, reset confirmed state
    undismiss(key);
    setConfirmedScoreKeys((prev) => { const n = { ...prev }; delete n[key]; return n; });
    onReactionChange(key, newDir);
  };

  return (
    <div>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Dosis:wght@400;500;600;700&display=swap');`}</style>

      {/* Sticky: title + chart stick together while the dimension bars scroll */}
      <div
        style={{
          position: 'sticky',
          top: -16,
          zIndex: 30,
          backgroundColor: 'white',
          margin: '-16px -24px 0',
          padding: '16px 24px 12px',
          borderBottom: '1px solid #f4f4f5',
          boxShadow: '0 8px 12px -12px rgba(0, 0, 0, 0.18)',
        }}
      >
        <div className="flex items-start gap-2 mb-3">
          {sectionNumber && <SectionBadge n={sectionNumber} />}
          <p style={{ fontFamily: "'Dosis', sans-serif", fontWeight: 600, color: '#000', fontSize: '17px', lineHeight: '1.35' }}>
            {title}
          </p>
        </div>
        <ScoresChart
          mentalModelsByTurn={turnsData as CombinedMentalModel[]}
          modelType={series === INDUCT_SERIES ? 'induct' : 'types_support'}
          userScoresByTurn={userScoresByTurn}
        />
      </div>

      {/* Score bars */}
      <div className="space-y-5 mt-4">
        {series.map((s) => {
          const item = beliefs?.[s.key];
          const aiScore = typeof item?.score === 'number' ? item.score : null;
          const userScore = userBeliefs?.[s.key] ?? null;
          const hasLiveChange = (liveBeliefs?.[s.key] ?? null) !== null;
          const reaction = reactions?.[s.key] ?? null;
          // Slider + reason UI: only shown when 👎 is active
          const isAdjusting = reaction === 'down';

          return (
            <div key={s.key}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-medium text-zinc-700" style={{ fontSize: 15 }}>{s.label}</span>
                {isLoading && <span className="text-[10px] text-zinc-300 animate-pulse">updating</span>}
              </div>
              
              {aiScore != null ? (
                <>
                  {/* Score bar — disabled unless 👎 is active */}
                  <div className="pr-9">
                    <DraggableScoreBar
                      aiScore={aiScore}
                      userScore={userScore}
                      color={s.color}
                      onChange={(score) => {
                        undismiss(s.key);
                        setConfirmedScoreKeys((prev) => { const n = { ...prev }; delete n[s.key]; return n; });
                        onUserScoreChange(s.key, score);
                      }}
                      inviteDrag={isAdjusting && !confirmedScoreKeys[s.key]}
                      disabled={!isAdjusting || !!confirmedScoreKeys[s.key]}
                    />
                  </div>

                  {/* Hint line before drag / buttons after drag — same position */}
                  {isAdjusting && !confirmedScoreKeys[s.key] && (
                    hasLiveChange ? (
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleConfirmScore(s.key); }}
                          className="py-0.5 px-2.5 text-[11px] bg-white rounded"
                          style={{ border: `1.5px solid ${s.color}`, color: '#000', fontFamily: "'Dosis', sans-serif", fontWeight: 600 }}
                        >
                          Confirm new score
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setLocalText((prev) => { const n = { ...prev }; delete n[s.key]; return n; }); onCancel(s.key); }}
                          className="py-0.5 px-2.5 text-[11px] bg-white rounded text-red-500"
                          style={{ border: '1.5px solid #fca5a5', fontFamily: "'Dosis', sans-serif", fontWeight: 600 }}
                        >
                          Cancel change
                        </button>
                      </div>
                    ) : (
                      <p className="mt-1.5 text-[14px] text-red-400 select-none" style={{ fontFamily: "'Dosis', sans-serif", fontWeight: 500 }}>
                        ↔ drag the bar above to adjust the score
                      </p>
                    )
                  )}
                  
                  {/* AI explanation + thumbs */}
                  {item?.explanation && (
                    <div className="flex items-start gap-1.5 mt-2">
                      <p className="leading-relaxed flex-1 text-zinc-500" style={{ fontSize: 14 }}>{item.explanation}</p>
                      <div className="flex gap-1 flex-shrink-0 mt-0.5">
                        <button
                          onClick={() => toggleReaction(s.key, 'up')}
                          className="w-6 h-6 flex items-center justify-center text-[13px] border transition-colors"
                          style={{
                            borderRadius: 3,
                            borderColor: reaction === 'up' ? '#16a34a' : '#e4e4e7',
                            backgroundColor: reaction === 'up' ? '#f0fdf4' : '#fff',
                          }}
                          title="I agree with this assumption"
                        >
                          👍
                        </button>
                        <button
                          onClick={() => toggleReaction(s.key, 'down')}
                          className="w-6 h-6 flex items-center justify-center text-[13px] border transition-colors"
                          style={{
                            borderRadius: 3,
                            borderColor: reaction === 'down' ? '#dc2626' : '#e4e4e7',
                            backgroundColor: reaction === 'down' ? '#fef2f2' : '#fff',
                          }}
                          title="This doesn't match my expectation"
                        >
                          👎
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Saved flash — shown briefly after any save, outside the box */}
                  {savedKeys[s.key] && (
                    <p className="mt-2 text-[13px] font-semibold text-green-600" style={{ fontFamily: "'Dosis', sans-serif" }}>
                      Saved
                    </p>
                  )}

                  {/* 👎 comment box — only appears after score is confirmed */}
                  {isAdjusting && confirmedScoreKeys[s.key] && !dismissedKeys[s.key] && (
                    <div className="mt-2 flex items-center gap-1.5">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          className="w-full text-base rounded border border-zinc-200 py-1.5 pl-2.5 pr-6 bg-white focus:outline-none focus:border-zinc-400"
                          style={{ fontFamily: "'Dosis', sans-serif" }}
                          placeholder="Why did you change the score?"
                          value={localText[s.key] ?? ''}
                          onChange={(e) => setLocalText((prev) => ({ ...prev, [s.key]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              e.stopPropagation();
                              handleSaveComment(s.key);
                            }
                          }}
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-zinc-300 pointer-events-none select-none">↵</span>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleSaveComment(s.key); }}
                        className="flex-shrink-0 py-1 px-3 text-[11px] bg-white rounded"
                        style={{ border: `1.5px solid ${s.color}`, color: '#000', fontFamily: "'Dosis', sans-serif", fontWeight: 600 }}
                      >
                        Save
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="h-1.5 bg-zinc-100 rounded-full animate-pulse" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function MentalModelsPanel({
  mentalModel,
  mentalModelsByTurn,
  isLoading,
  liveInductUser,
  liveTypesSupportUser,
  onInductChange,
  onTypesSupportChange,
  onInductConfirmDimension,
  onTypesSupportConfirmDimension,
  onInductCancel,
  onTypesSupportCancel,
  onInductReactionChange,
  onTypesSupportReactionChange,
  onInductSaveComment,
  onTypesSupportSaveComment,
  section1Ref,
  section2Ref,
}: MentalModelsPanelProps) {
  if (!mentalModel && !isLoading) {
    return null;
  }

  const inductBeliefs = mentalModel?.induct?.mental_model?.beliefs as
    | Record<string, { score: number; explanation?: string }>
    | undefined;
  const supportBeliefs = mentalModel?.typesSupport?.mental_model?.support_seeking as
    | Record<string, { score: number; explanation?: string }>
    | undefined;

  const lastIdx = mentalModelsByTurn.length - 1;
  const lastMM = mentalModelsByTurn[lastIdx];

  // Merged user beliefs
  const mergedInductUser = lastMM?.inductUser || liveInductUser
    ? { ...(lastMM?.inductUser ?? {}), ...(liveInductUser ?? {}) }
    : null;
  const mergedTypesSupportUser = lastMM?.typesSupportUser || liveTypesSupportUser
    ? { ...(lastMM?.typesSupportUser ?? {}), ...(liveTypesSupportUser ?? {}) }
    : null;

  // Full per-turn arrays for chart
  const inductUserTurns = mentalModelsByTurn.map((mm, i) =>
    i === lastIdx ? (mergedInductUser ?? mm.inductUser ?? null) : (mm.inductUser ?? null)
  );
  const typesSupportUserTurns = mentalModelsByTurn.map((mm, i) =>
    i === lastIdx ? (mergedTypesSupportUser ?? mm.typesSupportUser ?? null) : (mm.typesSupportUser ?? null)
  );

  return (
    <div className="space-y-5 mt-2">
      <div ref={section1Ref}>
        <ScoreSection
          title="How much does the AI think you need validation vs. objectivity?"
          sectionNumber={1}
          series={INDUCT_SERIES}
          beliefs={inductBeliefs}
          userBeliefs={mergedInductUser}
          liveBeliefs={liveInductUser}
          reactions={lastMM?.inductUserReactions ?? null}
          turnsData={mentalModelsByTurn}
          userScoresByTurn={inductUserTurns}
          isLoading={isLoading}
          onUserScoreChange={onInductChange}
          onConfirmDimension={onInductConfirmDimension}
          onCancel={onInductCancel}
          onReactionChange={onInductReactionChange}
          onSaveComment={onInductSaveComment}
        />
      </div>
      
      <div className="border-t border-zinc-100" />
      
      <div ref={section2Ref}>
        <ScoreSection
          title="What kind of support does the AI think you're looking for?"
          sectionNumber={2}
          series={TYPES_SUPPORT_SERIES}
          beliefs={supportBeliefs}
          userBeliefs={mergedTypesSupportUser}
          liveBeliefs={liveTypesSupportUser}
          reactions={lastMM?.typesSupportUserReactions ?? null}
          turnsData={mentalModelsByTurn}
          userScoresByTurn={typesSupportUserTurns}
          isLoading={isLoading}
          onUserScoreChange={onTypesSupportChange}
          onConfirmDimension={onTypesSupportConfirmDimension}
          onCancel={onTypesSupportCancel}
          onReactionChange={onTypesSupportReactionChange}
          onSaveComment={onTypesSupportSaveComment}
        />
      </div>
    </div>
  );
}
