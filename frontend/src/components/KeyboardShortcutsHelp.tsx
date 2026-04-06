import { useState } from 'react';

const SHORTCUTS = [
  { key: 'Space', description: 'Play / Pause' },
  { key: '[', description: 'Set loop start (A)' },
  { key: ']', description: 'Set loop end (B)' },
  { key: 'Backspace', description: 'Clear loop' },
  { key: 'Up / Down', description: 'Speed +/- 0.05' },
  { key: 'Left / Right', description: 'Seek +/- 5s' },
  { key: 'Shift+Up/Down', description: 'Pitch +/- 1 semitone' },
  { key: 'R', description: 'Toggle speed ramp' },
];

export function KeyboardShortcutsHelp() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-t border-gray-800 pt-3">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-gray-500 hover:text-gray-300
                   text-xs uppercase tracking-wider transition-colors mx-auto"
      >
        <svg
          className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
        Keyboard Shortcuts
      </button>

      {isOpen && (
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-1.5 text-sm">
          {SHORTCUTS.map((shortcut) => (
            <div key={shortcut.key} className="flex items-center gap-2">
              <kbd className="px-1.5 py-0.5 bg-gray-800 border border-gray-600 rounded
                             text-xs font-mono text-gray-300 shrink-0 min-w-[4rem] text-center">
                {shortcut.key}
              </kbd>
              <span className="text-gray-400 text-xs">{shortcut.description}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
