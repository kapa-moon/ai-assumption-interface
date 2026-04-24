// SVG Chart showing scores across turns (ported from syconistic-dial)
import type { CombinedMentalModel } from '../types';

const INDUCT_SERIES = [
  { key: 'validation_seeking', label: 'Validation seeking', color: '#f8961e' },
  { key: 'user_rightness', label: 'User rightness', color: '#619b8a' },
  { key: 'user_information_advantage', label: 'User info advantage', color: '#f25c54' },
  { key: 'objectivity_seeking', label: 'Objectivity seeking', color: '#3c096c' },
];

const TYPES_SUPPORT_SERIES = [
  { key: 'emotional_support', label: 'Emotional support', color: '#ef476f' },
  { key: 'information_guidance', label: 'Information & guidance', color: '#3a86ff' },
];

interface ScoresChartProps {
  mentalModelsByTurn: CombinedMentalModel[];
  modelType: 'induct' | 'types_support';
  userScoresByTurn?: (Record<string, number> | null)[];
}

export function ScoresChart({ mentalModelsByTurn, modelType, userScoresByTurn }: ScoresChartProps) {
  const seriesConfig = modelType === 'induct' ? INDUCT_SERIES : TYPES_SUPPORT_SERIES;
  
  if (!mentalModelsByTurn?.length) return null;

  const n = mentalModelsByTurn.length;
  const width = 460;
  const height = 200;
  const pad = { left: 32, right: 12, top: 10, bottom: 28 };
  const iw = width - pad.left - pad.right;
  const ih = height - pad.top - pad.bottom;
  const xScale = (i: number) => pad.left + (n <= 1 ? iw / 2 : (i / Math.max(1, n - 1)) * iw);
  const yScale = (v: number) => pad.top + ih - v * ih;

  const polylinePath = (pts: [number, number][]) => {
    if (pts.length === 0) return '';
    if (pts.length === 1) return `M ${pts[0][0]} ${pts[0][1]}`;
    return 'M ' + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L ');
  };

  const getScore = (mm: CombinedMentalModel, key: string): number | null => {
    if (modelType === 'induct') {
      const b = mm.induct?.mental_model?.beliefs as Record<string, { score: number }> | undefined;
      return typeof b?.[key]?.score === 'number' ? b[key].score : null;
    } else {
      const s = mm.typesSupport?.mental_model?.support_seeking as Record<string, { score: number }> | undefined;
      return typeof s?.[key]?.score === 'number' ? s[key].score : null;
    }
  };

  return (
    <div className="mt-3">
      <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wide mb-1.5">Scores across turns</p>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ display: 'block' }}>
        {/* Y grid */}
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <g key={v}>
            <line x1={pad.left} y1={yScale(v)} x2={pad.left + iw} y2={yScale(v)} stroke="#e4e4e7" strokeWidth={0.75} />
            <text x={pad.left - 4} y={yScale(v) + 3.5} fontSize={9} fill="#a1a1aa" textAnchor="end">{v}</text>
          </g>
        ))}
        
        {/* X labels */}
        {Array.from({ length: n }, (_, i) =>
          n <= 8 || i === 0 || i === n - 1 || i % Math.ceil(n / 5) === 0
            ? <text key={i} x={xScale(i)} y={height - 6} fontSize={9} fill="#a1a1aa" textAnchor="middle">T{i + 1}</text>
            : null
        )}
        
        {/* Series lines and dots */}
        {seriesConfig.map((s) => {
          const aiVals = mentalModelsByTurn.map((mm) => getScore(mm, s.key));
          const userVals = (userScoresByTurn ?? []).map((u) => u?.[s.key] ?? null);
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
              {/* Ghost AI polyline */}
              {hasAnyOverride && (
                <path
                  d={polylinePath(aiPts)}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeOpacity={0.22}
                  strokeDasharray="3 2"
                />
              )}
              
              {/* Effective polyline */}
              <path d={polylinePath(effectivePts)} fill="none" stroke={s.color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              
              {/* Per-turn dots */}
              {aiVals.map((aiV, i) => {
                const userV = userVals[i];
                const isLast = i === n - 1;

                if (userV != null) {
                  return (
                    <g key={i}>
                      {aiV != null && (
                        <circle cx={xScale(i)} cy={yScale(aiV)} r={2} fill={s.color} fillOpacity={0.22} />
                      )}
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
      
      {/* Legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
        {seriesConfig.map((s) => (
          <span key={s.key} className="flex items-center gap-1 text-[9px] text-zinc-500">
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
