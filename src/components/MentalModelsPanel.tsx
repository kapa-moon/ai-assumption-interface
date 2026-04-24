// Mental Models Panel - main right panel component (ported from syconistic-dial)
import { useState } from 'react';
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
}: ScoreSectionProps) {
  const [reasons, setReasons] = useState<Record<string, string>>({});

  const handleConfirm = (key: string) => {
    onConfirmDimension(key, reasons[key]?.trim() ?? '');
    setReasons((prev) => {
      const n = { ...prev };
      delete n[key];
      return n;
    });
  };

  const toggleReaction = (key: string, dir: 'up' | 'down') => {
    onReactionChange(key, reactions?.[key] === dir ? null : dir);
  };

  return (
    <div>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Dosis:wght@400;500;600;700&display=swap');`}</style>
      
      {/* Section title */}
      <div className="flex items-start gap-2 mb-3">
        {sectionNumber && <SectionBadge n={sectionNumber} />}
        <p style={{ fontFamily: "'Dosis', sans-serif", fontWeight: 600, color: '#000', fontSize: '15px', lineHeight: '1.35' }}>
          {title}
        </p>
      </div>

      {/* Chart */}
      <ScoresChart
        mentalModelsByTurn={turnsData as CombinedMentalModel[]}
        modelType={series === INDUCT_SERIES ? 'induct' : 'types_support'}
        userScoresByTurn={userScoresByTurn}
      />

      {/* Score bars */}
      <div className="space-y-5 mt-4">
        {series.map((s) => {
          const item = beliefs?.[s.key];
          const aiScore = typeof item?.score === 'number' ? item.score : null;
          const userScore = userBeliefs?.[s.key] ?? null;
          const isLive = (liveBeliefs?.[s.key] ?? null) !== null;

          return (
            <div key={s.key}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-medium text-zinc-700" style={{ fontSize: 13 }}>{s.label}</span>
                {isLoading && <span className="text-[9px] text-zinc-300 animate-pulse">updating</span>}
              </div>
              
              {aiScore != null ? (
                <>
                  <div className="pr-9">
                    <DraggableScoreBar
                      aiScore={aiScore}
                      userScore={userScore}
                      color={s.color}
                      onChange={(score) => onUserScoreChange(s.key, score)}
                    />
                  </div>
                  
                  {/* AI explanation with thumbs */}
                  {item?.explanation && (
                    <div className="flex items-start gap-1.5 mt-2">
                      <p className="leading-relaxed flex-1 text-zinc-500" style={{ fontSize: 12 }}>{item.explanation}</p>
                      <div className="flex gap-1 flex-shrink-0 mt-0.5">
                        <button
                          onClick={() => toggleReaction(s.key, 'up')}
                          className="w-5 h-5 flex items-center justify-center text-[11px] border transition-colors"
                          style={{
                            borderRadius: 3,
                            borderColor: reactions?.[s.key] === 'up' ? '#16a34a' : '#e4e4e7',
                            backgroundColor: reactions?.[s.key] === 'up' ? '#f0fdf4' : '#fff',
                          }}
                          title="This is exactly what I think!"
                        >
                          👍
                        </button>
                        <button
                          onClick={() => toggleReaction(s.key, 'down')}
                          className="w-5 h-5 flex items-center justify-center text-[11px] border transition-colors"
                          style={{
                            borderRadius: 3,
                            borderColor: reactions?.[s.key] === 'down' ? '#dc2626' : '#e4e4e7',
                            backgroundColor: reactions?.[s.key] === 'down' ? '#fef2f2' : '#fff',
                          }}
                          title="This is not a good assumption about me."
                        >
                          👎
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {/* Confirm with reason */}
                  {isLive && (
                    <div className="mt-2 flex items-center gap-1.5">
                      <button
                        onClick={() => handleConfirm(s.key)}
                        className="flex-shrink-0 py-1 px-3 text-[11px] bg-white rounded"
                        style={{
                          border: `1.5px solid ${s.color}`,
                          color: '#000',
                          fontFamily: "'Dosis', sans-serif",
                          fontWeight: 600,
                        }}
                      >
                        Confirm score
                      </button>
                      <button
                        onClick={() => {
                          setReasons((prev) => {
                            const n = { ...prev };
                            delete n[s.key];
                            return n;
                          });
                          onCancel(s.key);
                        }}
                        title="Cancel change"
                        className="flex-shrink-0 w-7 h-7 flex items-center justify-center bg-white rounded text-red-500 font-bold text-[13px]"
                        style={{ border: '1.5px solid #fca5a5' }}
                      >
                        ✕
                      </button>
                      <div className="relative flex-1">
                        <input
                          type="text"
                          className="w-full text-sm rounded border border-zinc-200 py-1.5 pl-2.5 pr-6 bg-white focus:outline-none focus:border-zinc-400"
                          style={{ fontFamily: "'Dosis', sans-serif" }}
                          placeholder="Why did you make this change?"
                          value={reasons[s.key] ?? ''}
                          onChange={(e) =>
                            setReasons((prev) => ({ ...prev, [s.key]: e.target.value }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleConfirm(s.key);
                            }
                          }}
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-zinc-300 pointer-events-none select-none">
                          ↵
                        </span>
                      </div>
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
        />
      </div>
    </div>
  );
}
