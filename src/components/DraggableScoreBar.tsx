// Draggable score bar component (ported from syconistic-dial)
import { useRef } from 'react';

interface DraggableScoreBarProps {
  aiScore: number | null;
  userScore: number | null;
  color: string;
  onChange: (score: number) => void;
}

export function DraggableScoreBar({ aiScore, userScore, color, onChange }: DraggableScoreBarProps) {
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
      className="relative h-5 cursor-ew-resize select-none"
      onPointerDown={(e) => {
        trackRef.current!.setPointerCapture(e.pointerId);
        dragging.current = true;
        onChange(scoreFromEvent(e));
      }}
      onPointerMove={(e) => {
        if (dragging.current) onChange(scoreFromEvent(e));
      }}
      onPointerUp={() => {
        dragging.current = false;
      }}
    >
      {/* Track */}
      <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-1.5 bg-zinc-100 rounded-full" />
      
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
      
      {/* Draggable thumb */}
      <div
        className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-white shadow pointer-events-none"
        style={{ left: `calc(${displayScore * 100}% - 8px)`, backgroundColor: color, transition: 'left 0.05s ease' }}
      />
      
      {/* Score label */}
      <span
        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-full pl-2 text-[10px] tabular-nums font-medium pointer-events-none"
        style={{ color }}
      >
        {pct}%
      </span>
    </div>
  );
}
