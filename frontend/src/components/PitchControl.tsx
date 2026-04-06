import { useState } from 'react';

interface PitchControlProps {
  pitch: number;
  onPitchChange: (semitones: number) => void;
}

const PITCH_PRESETS = [-5, -3, -1, 0, 1, 3, 5];

export function PitchControl({ pitch, onPitchChange }: PitchControlProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  const displayPitch = pitch > 0 ? `+${pitch}` : `${pitch}`;

  const handleEditStart = () => {
    setEditValue(String(pitch));
    setIsEditing(true);
  };

  const handleEditCommit = () => {
    const val = parseInt(editValue);
    if (!isNaN(val) && val >= -12 && val <= 12) {
      onPitchChange(val);
    }
    setIsEditing(false);
  };

  return (
    <div className="bg-gray-800/50 rounded-lg p-4">
      <h3 className="text-gray-300 text-sm font-medium mb-3 uppercase tracking-wider">
        Pitch
      </h3>

      {/* Current pitch display — click to edit */}
      <div className="text-center mb-4">
        {isEditing ? (
          <div className="inline-flex items-baseline">
            <input
              type="number"
              min={-12}
              max={12}
              step={1}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleEditCommit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleEditCommit();
                if (e.key === 'Escape') setIsEditing(false);
              }}
              autoFocus
              className="w-20 text-center text-3xl font-mono font-bold bg-gray-700 text-white
                         border border-blue-500 rounded-lg px-2 py-1 focus:outline-none"
            />
            <span className="text-gray-400 text-sm ml-1">st</span>
          </div>
        ) : (
          <button
            onClick={handleEditStart}
            className="inline-flex items-baseline hover:text-blue-400
                       transition-colors cursor-text"
            title="Click to type a value"
          >
            <span className="text-3xl font-mono text-white font-bold">
              {displayPitch}
            </span>
            <span className="text-gray-400 text-sm ml-1">st</span>
          </button>
        )}
      </div>

      {/* Slider with -/+ buttons */}
      <div className="flex items-center gap-3 mb-3">
        <button
          onClick={() => onPitchChange(pitch - 1)}
          disabled={pitch <= -12}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-700
                     text-white text-lg font-bold hover:bg-gray-600
                     disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0"
        >
          &minus;
        </button>
        <input
          type="range"
          min={-12}
          max={12}
          step={1}
          value={pitch}
          onChange={(e) => onPitchChange(parseInt(e.target.value))}
          className="flex-1 h-1.5 bg-gray-700 rounded-full appearance-none cursor-pointer
                     [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4
                     [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full
                     [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md"
        />
        <button
          onClick={() => onPitchChange(pitch + 1)}
          disabled={pitch >= 12}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-700
                     text-white text-lg font-bold hover:bg-gray-600
                     disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0"
        >
          +
        </button>
      </div>

      {/* Preset buttons */}
      <div className="flex gap-1.5">
        {PITCH_PRESETS.map((preset) => (
          <button
            key={preset}
            onClick={() => onPitchChange(preset)}
            className={`flex-1 py-2 text-sm rounded-lg font-mono transition-colors ${
              pitch === preset
                ? 'bg-white text-gray-900 font-bold'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {preset === 0 ? '0' : preset > 0 ? `+${preset}` : preset}
          </button>
        ))}
      </div>
    </div>
  );
}
