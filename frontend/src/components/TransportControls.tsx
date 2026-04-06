import { useState, useRef, useEffect, useCallback } from 'react';
import type { LoopBounds } from '../lib/AudioEngine';

interface TransportControlsProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  loop: LoopBounds | null;
  peaks: number[] | null;
  seekStep: number;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onSeekStepChange: (step: number) => void;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

const WAVEFORM_HEIGHT = 64;

/**
 * Draw a smooth mirrored waveform as thin bezier stroke lines.
 * Minimal, modern — no fill, just the outline.
 */
function drawWaveform(
  ctx: CanvasRenderingContext2D,
  peaks: number[],
  width: number,
  height: number,
  progressFrac: number,
  loop: LoopBounds | null,
  duration: number
) {
  ctx.clearRect(0, 0, width, height);

  const mid = height / 2;
  const amp = mid - 4;
  const n = peaks.length;
  const step = width / n;

  // Catmull-Rom spline through all points — guaranteed smooth tangents
  function catmullRomPath(pts: { x: number; y: number }[], close: boolean): Path2D {
    const path = new Path2D();
    if (pts.length < 2) return path;

    path.moveTo(pts[0].x, pts[0].y);

    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];

      // Catmull-Rom to cubic bezier conversion (tension = 0 for smooth)
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      path.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
    }

    if (close) {
      path.lineTo(width, height);
      path.lineTo(0, height);
      path.closePath();
    }

    return path;
  }

  // Build points
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    pts.push({ x: i * step, y: mid - peaks[i] * amp });
  }

  function buildWaveLine(): Path2D {
    return catmullRomPath(pts, false);
  }

  function buildWaveFill(): Path2D {
    return catmullRomPath(pts, true);
  }

  const waveLine = buildWaveLine();
  const waveFill = buildWaveFill();

  const progressX = progressFrac * width;
  const loopStartX = loop && duration > 0 ? (loop.start / duration) * width : -1;
  const loopEndX = loop && duration > 0 ? (loop.end / duration) * width : -1;
  const hasLoop = loopStartX >= 0 && loopEndX >= 0;

  // Helper: stroke both lines clipped to a horizontal region
  function strokeRegion(x1: number, x2: number, color: string, lineWidth: number, alpha: number, fillAlpha: number = 0) {
    if (x2 <= x1) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x1, 0, x2 - x1, height);
    ctx.clip();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // Gradient fill under the curve
    const grad = ctx.createLinearGradient(0, mid - amp, 0, height);
    grad.addColorStop(0, color);
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.globalAlpha = fillAlpha;
    ctx.fill(waveFill);

    // Stroke the line on top
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.globalAlpha = alpha;
    ctx.stroke(waveLine);

    ctx.restore();
  }

  if (hasLoop) {
    strokeRegion(0, Math.min(progressX, loopStartX), '#60a5fa', 2, 0.9, 0.22);
    strokeRegion(Math.max(progressX, 0), loopStartX, '#6b7280', 1.5, 0.25, 0.06);
    strokeRegion(loopStartX, Math.min(progressX, loopEndX), '#f59e0b', 2, 0.9, 0.25);
    strokeRegion(Math.max(progressX, loopStartX), loopEndX, '#b45309', 1.5, 0.35, 0.1);
    strokeRegion(loopEndX, Math.min(progressX, width), '#60a5fa', 2, 0.9, 0.22);
    strokeRegion(Math.max(progressX, loopEndX), width, '#6b7280', 1.5, 0.25, 0.06);
  } else {
    strokeRegion(0, progressX, '#60a5fa', 2, 0.85, 0.22);
    strokeRegion(progressX, width, '#6b7280', 1.5, 0.2, 0.06);
  }
}

export function TransportControls({
  isPlaying,
  currentTime,
  duration,
  loop,
  peaks,
  seekStep,
  onTogglePlay,
  onSeek,
  onSeekStepChange,
}: TransportControlsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);
  const [canvasWidth, setCanvasWidth] = useState(0);
  const displayTime = isSeeking ? seekValue : currentTime;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      setCanvasWidth(entries[0].contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !peaks || canvasWidth === 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasWidth * dpr;
    canvas.height = WAVEFORM_HEIGHT * dpr;
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${WAVEFORM_HEIGHT}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const progressFrac = duration > 0 ? displayTime / duration : 0;
    drawWaveform(ctx, peaks, canvasWidth, WAVEFORM_HEIGHT, progressFrac, loop, duration);
  }, [peaks, canvasWidth, displayTime, duration, loop]);

  useEffect(() => {
    render();
  }, [render]);

  return (
    <div className="flex flex-col gap-2 px-2">
      {/* Waveform scrubber */}
      <div
        ref={containerRef}
        className="relative cursor-pointer group"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          setIsSeeking(true);
          const rect = e.currentTarget.getBoundingClientRect();
          const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
          setSeekValue(frac * duration);
          onSeek(frac * duration);
        }}
        onPointerMove={(e) => {
          if (!isSeeking) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
          setSeekValue(frac * duration);
        }}
        onPointerUp={(e) => {
          if (isSeeking) {
            const rect = e.currentTarget.getBoundingClientRect();
            const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            onSeek(frac * duration);
            setIsSeeking(false);
          }
        }}
        onPointerCancel={() => setIsSeeking(false)}
      >
        {peaks ? (
          <canvas
            ref={canvasRef}
            className="w-full rounded-lg opacity-85 group-hover:opacity-100 transition-opacity"
            style={{ height: WAVEFORM_HEIGHT }}
          />
        ) : (
          <div
            className="w-full bg-gray-800/30 rounded-lg"
            style={{ height: WAVEFORM_HEIGHT }}
          />
        )}

        {/* Playhead */}
        {duration > 0 && (
          <div
            className="absolute top-0 bottom-0 pointer-events-none"
            style={{ left: `${(displayTime / duration) * 100}%` }}
          >
            <div className="w-[2px] h-full bg-white rounded-full shadow-[0_0_6px_rgba(255,255,255,0.4)]" />
          </div>
        )}
      </div>

      {/* Time + controls row */}
      <div className="flex items-center justify-between">
        <span className="text-gray-400 font-mono text-xs w-12">
          {formatTime(displayTime)}
        </span>

        <div className="flex items-center gap-3">
          {loop && (
            <button
              onClick={() => onSeek(loop.start)}
              className="w-10 h-10 flex items-center justify-center rounded-full
                         bg-gray-800 hover:bg-gray-700 text-amber-400
                         transition-colors border border-gray-700"
              title="Jump to loop start"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
              </svg>
            </button>
          )}

          <button
            onClick={onTogglePlay}
            disabled={duration === 0}
            className="w-14 h-14 flex items-center justify-center rounded-full
                       bg-white hover:bg-gray-100 disabled:bg-gray-700 disabled:text-gray-500
                       text-gray-900 transition-all shadow-lg shadow-white/10"
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
          >
            {isPlaying ? (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg className="w-6 h-6 ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          {loop && <div className="w-10" />}
        </div>

        <div className="flex items-center gap-2">
          {/* Seek step selector */}
          <div className="flex items-center gap-1">
            <span className="text-gray-600 text-[10px]">←→</span>
            <select
              value={seekStep}
              onChange={(e) => onSeekStepChange(parseFloat(e.target.value))}
              className="bg-transparent text-gray-400 text-xs font-mono
                         border border-gray-700/50 rounded-md px-1.5 py-0.5
                         focus:outline-none focus:border-gray-600
                         cursor-pointer appearance-none text-center w-12"
            >
              <option value={0.5}>0.5s</option>
              <option value={1}>1s</option>
              <option value={2}>2s</option>
              <option value={3}>3s</option>
              <option value={5}>5s</option>
              <option value={10}>10s</option>
            </select>
          </div>
          <span className="text-gray-400 font-mono text-xs">
            {formatTime(duration)}
          </span>
        </div>
      </div>
    </div>
  );
}
