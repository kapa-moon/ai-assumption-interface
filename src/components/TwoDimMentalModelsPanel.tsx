import { useState, useCallback, useRef } from 'react';
import { DraggableScoreBar } from './DraggableScoreBar';
import type {
  CombinedTwoDimModel,
  TurnIntentChoice,
} from '../types';

// ─── Perspective chart (two slider series across turns) ────────────────────

const PERSPECTIVE_SERIES = [
  { key: 'validation_support', label: 'Support and validation', color: '#f8961e' },
  { key: 'objectivity_information', label: 'Objectivity and information', color: '#3a86ff' },
] as const;

interface PerspectiveChartProps {
  turnModels: CombinedTwoDimModel[];
  userScoresByTurn: (Record<string, number> | null)[];
}

function PerspectiveChart({ turnModels, userScoresByTurn }: PerspectiveChartProps) {
  if (!turnModels.length) return null;

  const n = turnModels.length;
  const width = 460;
  const height = 140;
  const pad = { left: 32, right: 12, top: 8, bottom: 24 };
  const iw = width - pad.left - pad.right;
  const ih = height - pad.top - pad.bottom;
  const xScale = (i: number) => pad.left + (n <= 1 ? iw / 2 : (i / Math.max(1, n - 1)) * iw);
  const yScale = (v: number) => pad.top + ih - v * ih;

  const polylinePath = (pts: [number, number][]) => {
    if (pts.length === 0) return '';
    if (pts.length === 1) return `M ${pts[0][0]} ${pts[0][1]}`;
    return 'M ' + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L ');
  };

  return (
    <div className="mt-3">
      <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wide mb-1.5">
        Scores across turns
      </p>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ display: 'block' }}>
        <rect x={0} y={0} width={width} height={height} fill="white" />
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <g key={v}>
            <line x1={pad.left} y1={yScale(v)} x2={pad.left + iw} y2={yScale(v)} stroke="#e4e4e7" strokeWidth={0.75} />
            <text x={pad.left - 4} y={yScale(v) + 3.5} fontSize={9} fill="#a1a1aa" textAnchor="end">{v}</text>
          </g>
        ))}
        {Array.from({ length: n }, (_, i) =>
          n <= 8 || i === 0 || i === n - 1 || i % Math.ceil(n / 5) === 0
            ? <text key={i} x={xScale(i)} y={height - 6} fontSize={9} fill="#a1a1aa" textAnchor="middle">T{i + 1}</text>
            : null
        )}
        {PERSPECTIVE_SERIES.map((s) => {
          const aiVals = turnModels.map((mm) => {
            const p = mm.twoDim?.mental_model?.perspective as Record<string, { score: number }> | undefined;
            const v = p?.[s.key]?.score;
            return typeof v === 'number' ? v : null;
          });
          const userVals = userScoresByTurn.map((u) => u?.[s.key] ?? null);
          const effectiveVals = aiVals.map((v, i) => userVals[i] ?? v);
          const effectivePts = effectiveVals
            .map((v, i) => (v != null ? [xScale(i), yScale(v)] as [number, number] : null))
            .filter(Boolean) as [number, number][];
          const hasAnyOverride = userVals.some((v) => v != null);
          const aiPts = aiVals
            .map((v, i) => (v != null ? [xScale(i), yScale(v)] as [number, number] : null))
            .filter(Boolean) as [number, number][];

          return (
            <g key={s.key}>
              {hasAnyOverride && (
                <path d={polylinePath(aiPts)} fill="none" stroke={s.color} strokeWidth={1.5}
                  strokeLinecap="round" strokeLinejoin="round" strokeOpacity={0.22} strokeDasharray="3 2" />
              )}
              <path d={polylinePath(effectivePts)} fill="none" stroke={s.color} strokeWidth={1.5}
                strokeLinecap="round" strokeLinejoin="round" />
              {aiVals.map((aiV, i) => {
                const userV = userVals[i];
                const isLast = i === n - 1;
                if (userV != null) {
                  return (
                    <g key={i}>
                      {aiV != null && <circle cx={xScale(i)} cy={yScale(aiV)} r={2} fill={s.color} fillOpacity={0.22} />}
                      {isLast ? (
                        <g style={{ transform: `translate(${xScale(i)}px, ${yScale(userV)}px)`, transition: 'transform 0.08s ease' }}>
                          <circle cx={0} cy={0} r={5} fill="white" stroke={s.color} strokeWidth={1.5} />
                          <circle cx={0} cy={0} r={2.5} fill={s.color} />
                        </g>
                      ) : (
                        <g>
                          <circle cx={xScale(i)} cy={yScale(userV)} r={4} fill="white" stroke={s.color} strokeWidth={1.5} />
                          <circle cx={xScale(i)} cy={yScale(userV)} r={2} fill={s.color} />
                        </g>
                      )}
                    </g>
                  );
                }
                return aiV != null
                  ? <circle key={i} cx={xScale(i)} cy={yScale(aiV)} r={2.5} fill={s.color} />
                  : null;
              })}
            </g>
          );
        })}
      </svg>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
        {PERSPECTIVE_SERIES.map((s) => (
          <span key={s.key} className="flex items-center gap-1 text-[9px] text-zinc-500">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Checkbox row ────────────────────────────────────────────────────────────

interface CheckboxRowProps {
  label: string;
  sublabel?: string;
  checked: boolean;
  isAiChoice: boolean;
  isUserOverride: boolean;
  onClick: () => void;
}

function CheckboxRow({ label, sublabel, checked, isAiChoice, isUserOverride, onClick }: CheckboxRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2.5 w-full text-left py-1.5 px-2.5 rounded-lg transition-colors"
      style={{
        backgroundColor: checked ? '#f0f9ff' : 'transparent',
        border: checked ? '1.5px solid #3a86ff' : '1.5px solid transparent',
      }}
    >
      {/* Checkbox indicator */}
      <span
        className="flex-shrink-0 flex items-center justify-center"
        style={{
          width: 16,
          height: 16,
          borderRadius: 4,
          border: checked ? '2px solid #3a86ff' : '2px solid #d4d4d8',
          backgroundColor: checked ? '#3a86ff' : 'white',
          transition: 'all 0.12s',
        }}
      >
        {checked && (
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <span className="leading-snug" style={{ fontSize: 14 }}>
        <span className="font-medium" style={{ color: checked ? '#1e40af' : '#18181b' }}>{label}</span>
        {sublabel && (
          <span style={{ color: checked ? '#3b6bc2' : '#4a4a4a' }}>{' '}({sublabel})</span>
        )}
        {isAiChoice && !isUserOverride && (
          <span className="ml-1.5" style={{ fontSize: 14, color: '#dc2626' }}>(AI's assumption)</span>
        )}
        {isUserOverride && (
          <span className="ml-1.5" style={{ fontSize: 14, color: '#3b82f6' }}>(your choice)</span>
        )}
      </span>
    </button>
  );
}

// ─── Perspective sliders section ─────────────────────────────────────────────

interface PerspectiveSectionProps {
  beliefs: Record<string, { score: number; explanation?: string }> | undefined;
  userBeliefs: Record<string, number> | null;
  liveBeliefs: Record<string, number> | null;
  reactions: Record<string, 'up' | 'down'> | null;
  turnModels: CombinedTwoDimModel[];
  userScoresByTurn: (Record<string, number> | null)[];
  isLoading: boolean;
  sectionRef?: React.RefObject<HTMLDivElement | null>;
  onUserScoreChange: (key: string, score: number) => void;
  onConfirm: (key: string, reason: string) => void;
  onCancel: (key: string) => void;
  onReactionChange: (key: string, dir: 'up' | 'down' | null) => void;
  onSaveComment: (key: string, comment: string) => void;
}

function PerspectiveSection({
  beliefs, userBeliefs, liveBeliefs, reactions, turnModels, userScoresByTurn,
  isLoading, sectionRef, onUserScoreChange, onConfirm, onCancel, onReactionChange, onSaveComment,
}: PerspectiveSectionProps) {
  const [localText, setLocalText] = useState<Record<string, string>>({});
  const [dismissedKeys, setDismissedKeys] = useState<Record<string, boolean>>({});
  const [confirmedScoreKeys, setConfirmedScoreKeys] = useState<Record<string, boolean>>({});
  const [savedKeys, setSavedKeys] = useState<Record<string, boolean>>({});

  const flashSavedAndDismiss = useCallback((key: string) => {
    setDismissedKeys((prev) => ({ ...prev, [key]: true }));
    setSavedKeys((prev) => ({ ...prev, [key]: true }));
    setTimeout(() => setSavedKeys((prev) => { const n = { ...prev }; delete n[key]; return n; }), 1200);
  }, []);

  const undismiss = useCallback((key: string) => {
    setDismissedKeys((prev) => { const n = { ...prev }; delete n[key]; return n; });
  }, []);

  const handleConfirmScore = useCallback((key: string) => {
    onConfirm(key, '');
    setConfirmedScoreKeys((prev) => ({ ...prev, [key]: true }));
  }, [onConfirm]);

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
    if (current === 'down' && newDir !== 'down') {
      onCancel(key);
      setLocalText((prev) => { const n = { ...prev }; delete n[key]; return n; });
    }
    undismiss(key);
    setConfirmedScoreKeys((prev) => { const n = { ...prev }; delete n[key]; return n; });
    onReactionChange(key, newDir);
  };

  return (
    <div ref={sectionRef}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Dosis:wght@400;500;600;700&display=swap');`}</style>
      <div
        style={{
          position: 'sticky', top: -16, zIndex: 30, backgroundColor: 'white',
          margin: '-16px -24px 0', padding: '16px 24px 12px',
          borderBottom: '1px solid #f4f4f5',
          boxShadow: '0 8px 12px -12px rgba(0,0,0,0.18)',
        }}
      >
        <div className="flex items-start gap-2 mb-3">
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 22, height: 22, borderRadius: 6, backgroundColor: '#18181b',
            color: '#fff', fontFamily: "'Dosis', sans-serif", fontWeight: 700, fontSize: 13, flexShrink: 0,
          }}>1</span>
          <p style={{ fontFamily: "'Dosis', sans-serif", fontWeight: 600, color: '#000', fontSize: '17px', lineHeight: '1.35' }}>
            How does the AI assume you want it to respond?
          </p>
        </div>
        <PerspectiveChart turnModels={turnModels} userScoresByTurn={userScoresByTurn} />
      </div>

      <div className="space-y-5 mt-4">
        {PERSPECTIVE_SERIES.map((s) => {
          const item = beliefs?.[s.key];
          const aiScore = typeof item?.score === 'number' ? item.score : null;
          const userScore = userBeliefs?.[s.key] ?? null;
          const hasLiveChange = (liveBeliefs?.[s.key] ?? null) !== null;
          const reaction = reactions?.[s.key] ?? null;
          const isAdjusting = reaction === 'down';

          return (
            <div key={s.key}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-medium text-zinc-700" style={{ fontSize: 15 }}>{s.label}</span>
                {isLoading && <span className="text-[10px] text-zinc-300 animate-pulse">updating</span>}
              </div>

              {aiScore != null ? (
                <>
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

                  {item?.explanation && (
                    <div className="flex items-start gap-1.5 mt-2">
                      <p className="leading-relaxed flex-1" style={{ fontSize: 14, color: '#18181b' }}>{item.explanation}</p>
                      <div className="flex gap-1 flex-shrink-0 mt-0.5">
                        <button
                          onClick={() => toggleReaction(s.key, 'up')}
                          className="w-6 h-6 flex items-center justify-center text-[13px] border transition-colors"
                          style={{ borderRadius: 3, borderColor: reaction === 'up' ? '#16a34a' : '#e4e4e7', backgroundColor: reaction === 'up' ? '#f0fdf4' : '#fff' }}
                          title="I agree with this assumption"
                        >👍</button>
                        <button
                          onClick={() => toggleReaction(s.key, 'down')}
                          className="w-6 h-6 flex items-center justify-center text-[13px] border transition-colors"
                          style={{ borderRadius: 3, borderColor: reaction === 'down' ? '#dc2626' : '#e4e4e7', backgroundColor: reaction === 'down' ? '#fef2f2' : '#fff' }}
                          title="This doesn't match my expectation"
                        >👎</button>
                      </div>
                    </div>
                  )}

                  {savedKeys[s.key] && (
                    <p className="mt-2 text-[13px] font-semibold text-green-600" style={{ fontFamily: "'Dosis', sans-serif" }}>Saved</p>
                  )}

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
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); handleSaveComment(s.key); } }}
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-zinc-300 pointer-events-none select-none">↵</span>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleSaveComment(s.key); }}
                        className="flex-shrink-0 py-1 px-3 text-[11px] bg-white rounded"
                        style={{ border: `1.5px solid ${s.color}`, color: '#000', fontFamily: "'Dosis', sans-serif", fontWeight: 600 }}
                      >Save</button>
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

// ─── Checkbox section (turn intent) ──────────────────────────────────────────

const TURN_INTENT_OPTIONS: { value: TurnIntentChoice; label: string; sublabel: string }[] = [
  { value: 'evaluation', label: 'Evaluation', sublabel: 'Making sense of the situation' },
  { value: 'listening', label: 'Listening', sublabel: 'Attention, empathy, validation, or reflective presence' },
  { value: 'teaching', label: 'Teaching', sublabel: 'Explanations, concepts, scripts, norms, or skill-building guidance' },
  { value: 'concrete_info', label: 'Concrete, tangible information', sublabel: 'Suggestions of possible actions, referrals to other resources, or completing a particular task' },
  { value: 'encouragement', label: 'Encouragement', sublabel: 'Building confidence, reassurance, hope, or motivation' },
];

interface CheckboxSectionProps {
  sectionNumber: 2;
  title: string;
  options: { value: string; label: string; sublabel?: string }[];
  aiChoice: string | null;
  userChoice: string | null;
  savedReason?: string | null;
  sectionRef?: React.RefObject<HTMLDivElement | null>;
  onSelect: (value: string) => void;
  onSaveReason: (reason: string) => void;
}

function CheckboxSection({ sectionNumber, title, options, aiChoice, userChoice, savedReason, sectionRef, onSelect, onSaveReason }: CheckboxSectionProps) {
  const activeChoice = userChoice ?? aiChoice;
  const isUserOverride = userChoice !== null && userChoice !== aiChoice;
  const [reasonText, setReasonText] = useState('');
  const [showSaved, setShowSaved] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSave = useCallback(() => {
    if (!reasonText.trim()) return;
    onSaveReason(reasonText.trim());
    setReasonText('');
    setShowSaved(true);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => setShowSaved(false), 1200);
  }, [reasonText, onSaveReason]);

  return (
    <div ref={sectionRef}>
      <div
        style={{
          position: 'sticky', top: -16, zIndex: 30, backgroundColor: 'white',
          margin: '-16px -24px 0', padding: '16px 24px 12px',
          borderBottom: '1px solid #f4f4f5',
          boxShadow: '0 8px 12px -12px rgba(0,0,0,0.18)',
        }}
      >
        <div className="flex items-start gap-2">
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 22, height: 22, borderRadius: 6, backgroundColor: '#18181b',
            color: '#fff', fontFamily: "'Dosis', sans-serif", fontWeight: 700, fontSize: 13, flexShrink: 0,
          }}>{sectionNumber}</span>
          <p style={{ fontFamily: "'Dosis', sans-serif", fontWeight: 600, color: '#000', fontSize: '17px', lineHeight: '1.35' }}>
            {title}
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-1">
        {!aiChoice && (
          <p style={{ fontFamily: "'Dosis', sans-serif", fontWeight: 500, fontSize: '13px', color: '#a1a1aa' }} className="mb-2">
            Waiting for AI's inference…
          </p>
        )}
        {options.map((opt) => (
          <CheckboxRow
            key={opt.value}
            label={opt.label}
            sublabel={opt.sublabel}
            checked={activeChoice === opt.value}
            isAiChoice={aiChoice === opt.value}
            isUserOverride={userChoice === opt.value && userChoice !== aiChoice}
            onClick={() => onSelect(opt.value)}
          />
        ))}
      </div>

      {/* Rationale textbox — appears when user picks a different option than AI */}
      {isUserOverride && (
        <div className="mt-3">
          {savedReason && !showSaved ? (
            <p className="text-[13px] text-zinc-500" style={{ fontFamily: "'Dosis', sans-serif" }}>
              Reason saved: <span style={{ color: '#18181b' }}>{savedReason}</span>
              <button
                type="button"
                onClick={() => setReasonText(savedReason)}
                className="ml-2 text-[11px] underline text-zinc-400 hover:text-zinc-600"
              >edit</button>
            </p>
          ) : showSaved ? (
            <p className="text-[13px] font-semibold text-green-600" style={{ fontFamily: "'Dosis', sans-serif" }}>Saved</p>
          ) : (
            <div className="flex items-center gap-1.5">
              <div className="relative flex-1">
                <input
                  type="text"
                  className="w-full text-base rounded border border-zinc-200 py-1.5 pl-2.5 pr-6 bg-white focus:outline-none focus:border-zinc-400"
                  style={{ fontFamily: "'Dosis', sans-serif" }}
                  placeholder="Why did you choose a different option?"
                  value={reasonText}
                  onChange={(e) => setReasonText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSave(); } }}
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-zinc-300 pointer-events-none select-none">↵</span>
              </div>
              <button
                type="button"
                onClick={handleSave}
                className="flex-shrink-0 py-1 px-3 text-[11px] bg-white rounded"
                style={{ border: '1.5px solid #3a86ff', color: '#000', fontFamily: "'Dosis', sans-serif", fontWeight: 600 }}
              >Save</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main panel ──────────────────────────────────────────────────────────────

export interface TwoDimMentalModelsPanelProps {
  twoDimModel: CombinedTwoDimModel | null;
  twoDimModelsByTurn: CombinedTwoDimModel[];
  isLoading: boolean;
  livePerspectiveUser: Record<string, number> | null;
  onPerspectiveChange: (key: string, score: number) => void;
  onPerspectiveConfirm: (key: string, reason: string) => void;
  onPerspectiveCancel: (key: string) => void;
  onPerspectiveReactionChange: (key: string, dir: 'up' | 'down' | null) => void;
  onPerspectiveSaveComment: (key: string, comment: string) => void;
  onTurnIntentChange: (choice: TurnIntentChoice) => void;
  onTurnIntentReasonSave: (reason: string) => void;
  section1Ref?: React.RefObject<HTMLDivElement | null>;
  section2Ref?: React.RefObject<HTMLDivElement | null>;
}

export function TwoDimMentalModelsPanel({
  twoDimModel,
  twoDimModelsByTurn,
  isLoading,
  livePerspectiveUser,
  onPerspectiveChange,
  onPerspectiveConfirm,
  onPerspectiveCancel,
  onPerspectiveReactionChange,
  onPerspectiveSaveComment,
  onTurnIntentChange,
  onTurnIntentReasonSave,
  section1Ref,
  section2Ref,
}: TwoDimMentalModelsPanelProps) {
  if (!twoDimModel && !isLoading) return null;

  const perspective = twoDimModel?.twoDim?.mental_model?.perspective as
    | Record<string, { score: number; explanation?: string }>
    | undefined;

  const aiTurnIntent = (twoDimModel?.twoDim?.mental_model?.turn_intent?.choice ?? null) as TurnIntentChoice | null;

  const lastIdx = twoDimModelsByTurn.length - 1;
  const lastMM = twoDimModelsByTurn[lastIdx];

  const mergedPerspectiveUser = lastMM?.perspectiveUser || livePerspectiveUser
    ? { ...(lastMM?.perspectiveUser ?? {}), ...(livePerspectiveUser ?? {}) }
    : null;

  const perspectiveUserTurns = twoDimModelsByTurn.map((mm, i) =>
    i === lastIdx ? (mergedPerspectiveUser ?? mm.perspectiveUser ?? null) : (mm.perspectiveUser ?? null)
  );

  return (
    <div className="space-y-5 mt-2">
      <PerspectiveSection
        sectionRef={section1Ref}
        beliefs={perspective}
        userBeliefs={mergedPerspectiveUser}
        liveBeliefs={livePerspectiveUser}
        reactions={lastMM?.perspectiveUserReactions ?? null}
        turnModels={twoDimModelsByTurn}
        userScoresByTurn={perspectiveUserTurns}
        isLoading={isLoading}
        onUserScoreChange={onPerspectiveChange}
        onConfirm={onPerspectiveConfirm}
        onCancel={onPerspectiveCancel}
        onReactionChange={onPerspectiveReactionChange}
        onSaveComment={onPerspectiveSaveComment}
      />

      <div className="border-t border-zinc-100" />

      <CheckboxSection
        sectionRef={section2Ref}
        sectionNumber={2}
        title="What does the AI think you're asking for in this turn?"
        options={TURN_INTENT_OPTIONS}
        aiChoice={aiTurnIntent}
        userChoice={lastMM?.turnIntentUser ?? null}
        savedReason={lastMM?.turnIntentUserReason ?? null}
        onSelect={(v) => onTurnIntentChange(v as TurnIntentChoice)}
        onSaveReason={onTurnIntentReasonSave}
      />
    </div>
  );
}
