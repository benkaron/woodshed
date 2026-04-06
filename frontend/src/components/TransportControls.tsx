import { useState, useRef, useEffect, useCallback } from 'react';
import type { LoopBounds } from '../lib/AudioEngine';

interface TransportControlsProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  loop: LoopBounds | null;
  peaks: number[] | null;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

const BAR_WIDTH = 3;
const BAR_GAP = 1;
const WAVEFORM_HEIGHT = 48;
const MIN_BAR_HEIGHT = 2;

// Colors
const COLOR_PLAYED = '#3b82f6';       // blue-500
const COLOR_UNPLAYED = '#4b5563';     // gray-600
const COLOR_LOOP_PLAYED = '#d97706';  // amber-600 (bright)
const COLOR_LOOP_UNPLAYED = '#78350f'; // amber-900 (muted, still reads as loop)

export function TransportControls({
  isPlaying,
  currentTime,
  duration,
  loop,
  peaks,
  onTogglePlay,
  onSeek,
}: TransportControlsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);
  const [canvasWidth, setCanvasWidth] = useState(0);
  const displayTime = isSeeking ? seekValue : currentTime;

  // Measure container width
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      setCanvasWidth(entries[0].contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Draw waveform
  const drawWaveform = useCallback(() => {
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
    ctx.clearRect(0, 0, canvasWidth, WAVEFORM_HEIGHT);

    const barStep = BAR_WIDTH + BAR_GAP;
    const barCount = peaks.length;
    const totalBarsWidth = barCount * barStep;
    const scale = canvasWidth / totalBarsWidth;

    const progressFrac = duration > 0 ? displayTime / duration : 0;
    const progressX = progressFrac * canvasWidth;

    const loopStartX = loop && duration > 0 ? (loop.start / duration) * canvasWidth : null;
    const loopEndX = loop && duration > 0 ? (loop.end / duration) * canvasWidth : null;

    for (let i = 0; i < barCount; i++) {
      const x = i * barStep * scale;
      const w = BAR_WIDTH * scale;
      const h = Math.max(MIN_BAR_HEIGHT, peaks[i] * (WAVEFORM_HEIGHT - 4));
      const y = (WAVEFORM_HEIGHT - h) / 2;

      // Determine color based on position
      const barCenter = x + w / 2;
      const inLoop = loopStartX !== null && loopEndX !== null &&
                     barCenter >= loopStartX && barCenter <= loopEndX;
      const played = barCenter <= progressX;

      if (inLoop && played) {
        ctx.fillStyle = COLOR_LOOP_PLAYED;
      } else if (inLoop) {
        ctx.fillStyle = COLOR_LOOP_UNPLAYED;
      } else if (played) {
        ctx.fillStyle = COLOR_PLAYED;
      } else {
        ctx.fillStyle = COLOR_UNPLAYED;
      }

      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 1);
      ctx.fill();
    }
  }, [peaks, canvasWidth, displayTime, duration, loop]);

  useEffect(() => {
    drawWaveform();
  }, [drawWaveform]);

  // Handle click/drag on the waveform to seek
  const handleWaveformSeek = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSeek(frac * duration);
  };

  return (
    <div className="flex flex-col gap-2 px-2">
      {/* Waveform scrubber */}
      <div
        ref={containerRef}
        className="relative cursor-pointer group"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          setIsSeeking(true);
          handleWaveformSeek(e);
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
            className="w-full rounded opacity-80 group-hover:opacity-100 transition-opacity"
            style={{ height: WAVEFORM_HEIGHT }}
          />
        ) : (
          <div
            className="w-full bg-gray-800 rounded"
            style={{ height: WAVEFORM_HEIGHT }}
          />
        )}

        {/* Playhead line */}
        {duration > 0 && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-white/80 pointer-events-none"
            style={{ left: `${(displayTime / duration) * 100}%` }}
          />
        )}
      </div>

      {/* Time + controls row */}
      <div className="flex items-center justify-between">
        <span className="text-gray-400 font-mono text-xs w-12">
          {formatTime(displayTime)}
        </span>

        <div className="flex items-center gap-3">
          {/* Jump to loop start */}
          {loop && (
            <button
              onClick={() => onSeek(loop.start)}
              className="w-10 h-10 flex items-center justify-center rounded-full
                         bg-gray-700 hover:bg-gray-600 text-amber-400
                         transition-colors"
              title="Jump to loop start"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
              </svg>
            </button>
          )}

          {/* Play/pause button */}
          <button
            onClick={onTogglePlay}
            disabled={duration === 0}
            className="w-14 h-14 flex items-center justify-center rounded-full
                       bg-white hover:bg-gray-200 disabled:bg-gray-700 disabled:text-gray-500
                       text-gray-900 transition-colors"
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

          {/* Spacer to keep play centered when loop button is showing */}
          {loop && <div className="w-10" />}
        </div>

        <span className="text-gray-400 font-mono text-xs w-12 text-right">
          {formatTime(duration)}
        </span>
      </div>
    </div>
  );
}
