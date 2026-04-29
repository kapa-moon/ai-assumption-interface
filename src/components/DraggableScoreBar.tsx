// Draggable score bar component (ported from syconistic-dial)
import { useRef } from 'react';

interface DraggableScoreBarProps {
  aiScore: number | null;
  userScore: number | null;
  color: string;
  onChange: (score: number) => void;
  // When true (👎 given), bar is interactive and styled to invite dragging
  inviteDrag?: boolean;
  // When true, pointer events are disabled (no reaction or 👍 given)
  disabled?: boolean;
}

export function DraggableScoreBar({ aiScore, userScore, color, onChange, inviteDrag = false, disabled = false }: DraggableScoreBarProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const scoreFromEvent = (e: React.PointerEvent) => {
    const rect = trackRef.current!.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  };

  const displayScore = userScore ?? aiScore ?? 0;
  const hasUserSet = userScore !== null;
  const pct = Math.round(displayScore * 100);

  return (
    <div
      ref={trackRef}
      className="relative h-5 select-none"
      style={{ cursor: disabled ? 'default' : 'ew-resize' }}
      onPointerDown={(e) => {
        if (disabled) return;
        trackRef.current!.setPointerCapture(e.pointerId);
        dragging.current = true;
        onChange(scoreFromEvent(e));
      }}
      onPointerMove={(e) => {
        if (disabled || !dragging.current) return;
        onChange(scoreFromEvent(e));
      }}
      onPointerUp={() => {
        dragging.current = false;
      }}
    >
      {/* Track */}
      <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-1.5 rounded-full" style={{ backgroundColor: '#f4f4f5' }} />
      
      {/* AI fill */}
      {aiScore != null && (
        <div
          className="absolute top-1/2 -translate-y-1/2 left-0 h-1.5 rounded-full transition-opacity duration-300"
          style={{ width: `${aiScore * 100}%`, backgroundColor: color, opacity: hasUserSet ? 0.22 : 1 }}
        />
      )}
      
      {/* User fill */}
      {hasUserSet && (
        <div
          className="absolute top-1/2 -translate-y-1/2 left-0 h-1.5 rounded-full"
          style={{ width: `${displayScore * 100}%`, backgroundColor: color, transition: 'width 0.05s ease' }}
        />
      )}
      
      {/* Ghost AI position marker */}
      {hasUserSet && aiScore != null && (
        <div
          className="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full pointer-events-none"
          style={{ left: `calc(${aiScore * 100}% - 3px)`, backgroundColor: color, opacity: 0.28 }}
        />
      )}
      
      {/* Thumb — smaller and borderless when locked, bold white ring when interactive */}
      <div
        className="absolute top-1/2 -translate-y-1/2 rounded-full pointer-events-none"
        style={{
          left: `calc(${displayScore * 100}% - ${disabled ? 5 : 10}px)`,
          width: disabled ? 10 : 20,
          height: disabled ? 10 : 20,
          backgroundColor: color,
          border: disabled ? 'none' : '3px solid white',
          boxShadow:
            disabled ? 'none'
            : inviteDrag ? '0 2px 10px rgba(0,0,0,0.26)'
            : '0 1px 4px rgba(0,0,0,0.18)',
          transition: 'left 0.05s ease, width 0.15s ease, height 0.15s ease',
        }}
      />
      
      {/* Score label */}
      <span
        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-full pl-2 text-[13px] tabular-nums font-medium pointer-events-none"
        style={{ color }}
      >
        {pct}%
      </span>
    </div>
  );
}
