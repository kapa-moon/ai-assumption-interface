import { useState, useCallback, useRef } from 'react';
import { DraggableScoreBar } from './DraggableScoreBar';
import type { UserSelfReport, TurnIntentChoice } from '../types';

// ─── Perspective chart (self-report scores across turns) ─────────────────────

const SELF_REPORT_SERIES = [
  { key: 'validationSupport' as keyof UserSelfReport, label: 'Support and validation', color: '#f8961e' },
  { key: 'objectivityInformation' as keyof UserSelfReport, label: 'Objectivity and information', color: '#3a86ff' },
] as const;

interface SelfReportChartProps {
  reportsByTurn: UserSelfReport[];
}

function SelfReportChart({ reportsByTurn }: SelfReportChartProps) {
  if (!reportsByTurn.length) return null;
  const hasAnyScore = reportsByTurn.some(
    (r) => r.validationSupport != null || r.objectivityInformation != null
  );
  if (!hasAnyScore) return null;

  const n = reportsByTurn.length;
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
      <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wide mb-1.5">Your scores across turns</p>
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
        {SELF_REPORT_SERIES.map((s) => {
          const vals = reportsByTurn.map((r) => r[s.key] as number | undefined ?? null);
          const pts = vals
            .map((v, i) => (v != null ? [xScale(i), yScale(v)] as [number, number] : null))
            .filter(Boolean) as [number, number][];
          return (
            <g key={s.key as string}>
              <path d={polylinePath(pts)} fill="none" stroke={s.color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              {vals.map((v, i) =>
                v != null
                  ? <circle key={i} cx={xScale(i)} cy={yScale(v)} r={i === n - 1 ? 4 : 2.5} fill={s.color} />
                  : null
              )}
            </g>
          );
        })}
      </svg>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
        {SELF_REPORT_SERIES.map((s) => (
          <span key={s.key as string} className="flex items-center gap-1 text-[9px] text-zinc-500">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Turn intent options ──────────────────────────────────────────────────────

const TURN_INTENT_OPTIONS: { value: TurnIntentChoice; label: string; sublabel: string }[] = [
  { value: 'evaluation', label: 'Evaluation', sublabel: 'Making sense of the situation' },
  { value: 'listening', label: 'Listening', sublabel: 'Attention, empathy, validation, or reflective presence' },
  { value: 'teaching', label: 'Teaching', sublabel: 'Explanations, concepts, scripts, norms, or skill-building guidance' },
  { value: 'concrete_info', label: 'Concrete, tangible information', sublabel: 'Suggestions of possible actions, referrals to other resources, or completing a particular task' },
  { value: 'encouragement', label: 'Encouragement', sublabel: 'Building confidence, reassurance, hope, or motivation' },
];

interface SelfReportCheckboxProps {
  label: string;
  sublabel: string;
  checked: boolean;
  onClick: () => void;
}

function SelfReportCheckbox({ label, sublabel, checked, onClick }: SelfReportCheckboxProps) {
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
      <span
        className="flex-shrink-0 flex items-center justify-center"
        style={{
          width: 16, height: 16, borderRadius: 4,
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
        {sublabel && <span style={{ color: checked ? '#3b6bc2' : '#4a4a4a' }}>{' '}({sublabel})</span>}
      </span>
    </button>
  );
}

// ─── Main panel ──────────────────────────────────────────────────────────────

export interface NoAssumptionPanelProps {
  selfReportsByTurn: UserSelfReport[];
  isMandatoryReviewTurn: boolean;
  isReportComplete: boolean;
  onValidationSupportChange: (score: number) => void;
  onObjectivityInformationChange: (score: number) => void;
  onTurnIntentChange: (choice: TurnIntentChoice) => void;
  onTurnIntentReasonSave: (reason: string) => void;
  section1Ref?: React.RefObject<HTMLDivElement | null>;
  section2Ref?: React.RefObject<HTMLDivElement | null>;
}

export function NoAssumptionPanel({
  selfReportsByTurn,
  isMandatoryReviewTurn,
  isReportComplete,
  onValidationSupportChange,
  onObjectivityInformationChange,
  onTurnIntentChange,
  onTurnIntentReasonSave,
  section1Ref,
  section2Ref,
}: NoAssumptionPanelProps) {
  const [intentReasonText, setIntentReasonText] = useState('');
  const [showIntentReasonSaved, setShowIntentReasonSaved] = useState(false);
  const intentReasonTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSaveIntentReason = useCallback(() => {
    if (!intentReasonText.trim()) return;
    onTurnIntentReasonSave(intentReasonText.trim());
    setIntentReasonText('');
    setShowIntentReasonSaved(true);
    if (intentReasonTimerRef.current) clearTimeout(intentReasonTimerRef.current);
    intentReasonTimerRef.current = setTimeout(() => setShowIntentReasonSaved(false), 1200);
  }, [intentReasonText, onTurnIntentReasonSave]);

  if (selfReportsByTurn.length === 0) return null;

  const lastReport = selfReportsByTurn[selfReportsByTurn.length - 1];
  const isEditable = true;

  return (
    <div className="space-y-5 mt-2">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Dosis:wght@400;500;600;700&display=swap');`}</style>

      {/* Banner */}
      {isMandatoryReviewTurn && !isReportComplete && (
        <div className="rounded-lg px-3 py-2.5 text-sm" style={{ backgroundColor: '#fef9c3', border: '1px solid #fde047', color: '#713f12' }}>
          Please fill in all three fields below to unlock the chat.
        </div>
      )}
      {isMandatoryReviewTurn && isReportComplete && (
        <div className="rounded-lg px-3 py-2.5 text-sm" style={{ backgroundColor: '#f0fdf4', border: '1px solid #86efac', color: '#14532d' }}>
          Self-assessment complete — you can continue chatting.
        </div>
      )}

      {/* Section 1 — Perspective sliders */}
      <div ref={section1Ref}>
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
              How were you feeling going into this conversation?
            </p>
          </div>
          <SelfReportChart reportsByTurn={selfReportsByTurn} />
        </div>

        <div className="space-y-5 mt-4">
          {/* Validation support slider */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-medium text-zinc-700" style={{ fontSize: 15 }}>Support and validation</span>
            </div>
            <div className="pr-9">
              <DraggableScoreBar
                aiScore={null}
                userScore={lastReport.validationSupport ?? null}
                color="#f8961e"
                onChange={onValidationSupportChange}
                inviteDrag={lastReport.validationSupport == null}
                disabled={false}
              />
            </div>
          </div>

          {/* Objectivity / information slider */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-medium text-zinc-700" style={{ fontSize: 15 }}>Objectivity and information</span>
            </div>
            <div className="pr-9">
              <DraggableScoreBar
                aiScore={null}
                userScore={lastReport.objectivityInformation ?? null}
                color="#3a86ff"
                onChange={onObjectivityInformationChange}
                inviteDrag={lastReport.objectivityInformation == null}
                disabled={false}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-zinc-100" />

      {/* Section 2 — Turn intent */}
      <div ref={section2Ref}>
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
            }}>2</span>
            <p style={{ fontFamily: "'Dosis', sans-serif", fontWeight: 600, color: '#000', fontSize: '17px', lineHeight: '1.35' }}>
              What were you primarily asking for in this turn?
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-1">
          {TURN_INTENT_OPTIONS.map((opt) => (
            <SelfReportCheckbox
              key={opt.value}
              label={opt.label}
              sublabel={opt.sublabel}
              checked={lastReport.turnIntent === opt.value}
              onClick={() => onTurnIntentChange(opt.value)}
            />
          ))}

          {/* Rationale textbox — appears after any turn intent selection */}
          {isEditable && lastReport.turnIntent != null && (
            <div className="mt-3">
              {lastReport.turnIntentReason && !showIntentReasonSaved ? (
                <p className="text-[13px] text-zinc-500" style={{ fontFamily: "'Dosis', sans-serif" }}>
                  Note saved: <span style={{ color: '#18181b' }}>{lastReport.turnIntentReason}</span>
                  <button
                    type="button"
                    onClick={() => setIntentReasonText(lastReport.turnIntentReason!)}
                    className="ml-2 text-[11px] underline text-zinc-400 hover:text-zinc-600"
                  >edit</button>
                </p>
              ) : showIntentReasonSaved ? (
                <p className="text-[13px] font-semibold text-green-600" style={{ fontFamily: "'Dosis', sans-serif" }}>Saved</p>
              ) : (
                <div className="flex items-center gap-1.5">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      className="w-full text-base rounded border border-zinc-200 py-1.5 pl-2.5 pr-6 bg-white focus:outline-none focus:border-zinc-400"
                      style={{ fontFamily: "'Dosis', sans-serif" }}
                      placeholder="Optional: note why you chose this"
                      value={intentReasonText}
                      onChange={(e) => setIntentReasonText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSaveIntentReason(); } }}
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-zinc-300 pointer-events-none select-none">↵</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveIntentReason}
                    className="flex-shrink-0 py-1 px-3 text-[11px] bg-white rounded"
                    style={{ border: '1.5px solid #3a86ff', color: '#000', fontFamily: "'Dosis', sans-serif", fontWeight: 600 }}
                  >Save</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
