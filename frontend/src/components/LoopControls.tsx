import { useState } from 'react';
import type { LoopBounds } from '../lib/AudioEngine';
import type { LoopRegion } from '../types';

interface LoopControlsProps {
  currentTime: number;
  loop: LoopBounds | null;
  bookmarks: LoopRegion[];
  onSetLoop: (start: number, end: number) => void;
  onClearLoop: () => void;
  onSaveBookmark: (name: string, start: number, end: number) => void;
  onLoadBookmark: (bookmark: LoopRegion) => void;
  onDeleteBookmark: (id: string) => void;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  return `${mins}:${secs.toString().padStart(2, '0')}.${ms}`;
}

export function LoopControls({
  currentTime,
  loop,
  bookmarks,
  onSetLoop,
  onClearLoop,
  onSaveBookmark,
  onLoadBookmark,
  onDeleteBookmark,
}: LoopControlsProps) {
  const [bookmarkName, setBookmarkName] = useState('');
  const [pendingStart, setPendingStart] = useState<number | null>(null);

  const handleSetA = () => {
    setPendingStart(currentTime);
    if (loop) {
      // Update loop start, keeping the existing end
      onSetLoop(currentTime, loop.end);
    }
  };

  const handleSetB = () => {
    const start = pendingStart ?? loop?.start ?? 0;
    if (currentTime > start) {
      onSetLoop(start, currentTime);
    }
  };

  const handleSave = () => {
    if (!loop || !bookmarkName.trim()) return;
    onSaveBookmark(bookmarkName.trim(), loop.start, loop.end);
    setBookmarkName('');
  };

  return (
    <div className="bg-gray-800/50 rounded-lg p-4">
      <h3 className="text-gray-300 text-sm font-medium mb-3 uppercase tracking-wider">
        Loop
      </h3>

      {/* Set A/B buttons */}
      <div className="flex gap-2 mb-3">
        <button
          onClick={handleSetA}
          className="flex-1 py-2 text-sm rounded font-medium transition-colors
                     bg-amber-600/80 hover:bg-amber-500 text-white"
          title="Set loop start ([)"
        >
          Set A
          {(pendingStart !== null || loop?.start !== undefined) && (
            <span className="block text-xs font-mono opacity-75 mt-0.5">
              {formatTime(loop?.start ?? pendingStart ?? 0)}
            </span>
          )}
        </button>
        <button
          onClick={handleSetB}
          className="flex-1 py-2 text-sm rounded font-medium transition-colors
                     bg-amber-600/80 hover:bg-amber-500 text-white"
          title="Set loop end (])"
        >
          Set B
          {loop?.end !== undefined && (
            <span className="block text-xs font-mono opacity-75 mt-0.5">
              {formatTime(loop.end)}
            </span>
          )}
        </button>
        <button
          onClick={() => {
            onClearLoop();
            setPendingStart(null);
          }}
          disabled={!loop && pendingStart === null}
          className="px-4 py-2 text-sm rounded font-medium transition-colors
                     bg-gray-700 text-gray-300 hover:bg-gray-600
                     disabled:opacity-40 disabled:cursor-not-allowed"
          title="Clear loop (Backspace)"
        >
          Clear
        </button>
      </div>

      {/* Current loop display */}
      {loop && (
        <div className="bg-amber-900/20 border border-amber-700/30 rounded px-3 py-2 mb-3
                        text-sm font-mono text-amber-300 text-center">
          {formatTime(loop.start)} &mdash; {formatTime(loop.end)}
        </div>
      )}

      {/* Save bookmark */}
      {loop && (
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={bookmarkName}
            onChange={(e) => setBookmarkName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
            }}
            placeholder="Bookmark name..."
            className="flex-1 px-3 py-1.5 bg-gray-700 border border-gray-600 rounded
                       text-white text-sm placeholder-gray-400 focus:outline-none
                       focus:border-blue-500"
          />
          <button
            onClick={handleSave}
            disabled={!bookmarkName.trim()}
            className="px-3 py-1.5 text-sm rounded bg-blue-600 hover:bg-blue-500
                       disabled:bg-gray-700 disabled:text-gray-500 text-white
                       transition-colors"
          >
            Save
          </button>
        </div>
      )}

      {/* Bookmarks list */}
      {bookmarks.length > 0 && (
        <div className="border-t border-gray-700 pt-3">
          <span className="text-gray-500 text-xs uppercase tracking-wider block mb-2">
            Saved Loops
          </span>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {bookmarks.map((bm) => (
              <div
                key={bm.id}
                className="flex items-center gap-2 bg-gray-700/50 rounded px-2.5 py-1.5
                           group hover:bg-gray-700 transition-colors"
              >
                <button
                  onClick={() => onLoadBookmark(bm)}
                  className="flex-1 text-left text-sm text-gray-200 hover:text-white truncate"
                  title={`Load: ${formatTime(bm.start)} - ${formatTime(bm.end)}`}
                >
                  <span className="font-medium">{bm.name}</span>
                  <span className="text-gray-400 font-mono text-xs ml-2">
                    {formatTime(bm.start)}-{formatTime(bm.end)}
                  </span>
                </button>
                <button
                  onClick={() => onDeleteBookmark(bm.id)}
                  className="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100
                             transition-all text-xs px-1"
                  title="Delete bookmark"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
