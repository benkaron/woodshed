import { useState } from 'react';

interface TransportControlsProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function TransportControls({
  isPlaying,
  currentTime,
  duration,
  onTogglePlay,
  onSeek,
}: TransportControlsProps) {
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);
  const displayTime = isSeeking ? seekValue : currentTime;
  const progress = duration > 0 ? (displayTime / duration) * 100 : 0;

  return (
    <div className="flex items-center gap-4">
      <button
        onClick={onTogglePlay}
        disabled={duration === 0}
        className="w-12 h-12 flex items-center justify-center rounded-full
                   bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500
                   text-white transition-colors shrink-0"
        title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
      >
        {isPlaying ? (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      <span className="text-white font-mono text-sm w-12 text-right shrink-0">
        {formatTime(displayTime)}
      </span>

      <div className="flex-1 relative group">
        <input
          type="range"
          min={0}
          max={duration || 1}
          step={0.1}
          value={displayTime}
          onPointerDown={() => {
            setIsSeeking(true);
            setSeekValue(currentTime);
          }}
          onChange={(e) => {
            const val = parseFloat(e.target.value);
            setSeekValue(val);
            if (isSeeking) return; // defer actual seek until release
            onSeek(val);
          }}
          onPointerUp={() => {
            if (isSeeking) {
              onSeek(seekValue);
              setIsSeeking(false);
            }
          }}
          onPointerCancel={() => setIsSeeking(false)}
          className="w-full h-1.5 bg-gray-700 rounded-full appearance-none cursor-pointer
                     [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5
                     [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full
                     [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:hover:bg-blue-400
                     [&::-webkit-slider-thumb]:transition-colors"
          style={{
            background: `linear-gradient(to right, #3b82f6 ${progress}%, #374151 ${progress}%)`,
          }}
          disabled={duration === 0}
        />
      </div>

      <span className="text-gray-400 font-mono text-sm w-12 shrink-0">
        {formatTime(duration)}
      </span>
    </div>
  );
}
