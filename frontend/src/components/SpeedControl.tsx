import { useState } from 'react';
import type { SpeedRampConfig } from '../lib/AudioEngine';

interface SpeedControlProps {
  speed: number;
  speedRamp: SpeedRampConfig;
  onSpeedChange: (speed: number) => void;
  onSpeedRampChange: (config: Partial<SpeedRampConfig>) => void;
}

const SPEED_PRESETS = [0.5, 0.75, 1.0, 1.25, 1.5];
const SPEED_STEP = 0.05;

export function SpeedControl({
  speed,
  speedRamp,
  onSpeedChange,
  onSpeedRampChange,
}: SpeedControlProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');

  const handleEditStart = () => {
    setEditValue(speed.toFixed(2));
    setIsEditing(true);
  };

  const handleEditCommit = () => {
    const val = parseFloat(editValue);
    if (!isNaN(val) && val >= 0.25 && val <= 2.0) {
      onSpeedChange(val);
    }
    setIsEditing(false);
  };

  return (
    <div className="bg-gray-800/50 rounded-lg p-4">
      <h3 className="text-gray-300 text-sm font-medium mb-3 uppercase tracking-wider">
        Speed
      </h3>

      {/* Current speed display — click to edit */}
      <div className="text-center mb-4">
        {isEditing ? (
          <input
            type="number"
            min={0.25}
            max={2.0}
            step={0.05}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleEditCommit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleEditCommit();
              if (e.key === 'Escape') setIsEditing(false);
            }}
            autoFocus
            className="w-28 text-center text-3xl font-mono font-bold bg-gray-700 text-white
                       border border-blue-500 rounded-lg px-2 py-1 focus:outline-none"
          />
        ) : (
          <button
            onClick={handleEditStart}
            className="text-3xl font-mono text-white font-bold hover:text-blue-400
                       transition-colors cursor-text"
            title="Click to type a value"
          >
            {speed.toFixed(2)}x
          </button>
        )}
      </div>

      {/* Slider with -/+ buttons */}
      <div className="flex items-center gap-3 mb-3">
        <button
          onClick={() => onSpeedChange(Math.round((speed - SPEED_STEP) * 100) / 100)}
          disabled={speed <= 0.25}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-700
                     text-white text-lg font-bold hover:bg-gray-600
                     disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0"
        >
          &minus;
        </button>
        <input
          type="range"
          min={0}
          max={2.0}
          step={0.05}
          value={speed}
          onChange={(e) => onSpeedChange(Math.max(0.25, parseFloat(e.target.value)))}
          className="flex-1 h-1.5 bg-gray-700 rounded-full appearance-none cursor-pointer
                     [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4
                     [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full
                     [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md"
        />
        <button
          onClick={() => onSpeedChange(Math.round((speed + SPEED_STEP) * 100) / 100)}
          disabled={speed >= 2.0}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-700
                     text-white text-lg font-bold hover:bg-gray-600
                     disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0"
        >
          +
        </button>
      </div>

      {/* Preset buttons */}
      <div className="flex gap-1.5 mb-4">
        {SPEED_PRESETS.map((preset) => (
          <button
            key={preset}
            onClick={() => onSpeedChange(preset)}
            className={`flex-1 py-2 text-sm rounded-lg font-mono transition-colors ${
              Math.abs(speed - preset) < 0.01
                ? 'bg-white text-gray-900 font-bold'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {preset}x
          </button>
        ))}
      </div>

      {/* Speed Ramp Section */}
      <div className="border-t border-gray-700 pt-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-gray-400 text-xs uppercase tracking-wider">
            Speed Ramp
          </span>
          <button
            onClick={() =>
              onSpeedRampChange({ enabled: !speedRamp.enabled })
            }
            className={`px-3 py-1 text-xs rounded-full transition-colors ${
              speedRamp.enabled
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
            }`}
          >
            {speedRamp.enabled ? 'ON' : 'OFF'}
          </button>
        </div>

        <div
          className={`grid grid-cols-3 gap-2 ${
            speedRamp.enabled ? 'opacity-100' : 'opacity-40 pointer-events-none'
          }`}
        >
          <div>
            <label className="text-gray-500 text-xs block mb-1">Start</label>
            <input
              type="number"
              min={0.25}
              max={2.0}
              step={0.05}
              value={speedRamp.startSpeed}
              onChange={(e) =>
                onSpeedRampChange({ startSpeed: parseFloat(e.target.value) })
              }
              className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded
                         text-white text-sm font-mono text-center focus:outline-none
                         focus:border-blue-500"
            />
          </div>
          <div>
            <label className="text-gray-500 text-xs block mb-1">Target</label>
            <input
              type="number"
              min={0.25}
              max={2.0}
              step={0.05}
              value={speedRamp.endSpeed}
              onChange={(e) =>
                onSpeedRampChange({ endSpeed: parseFloat(e.target.value) })
              }
              className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded
                         text-white text-sm font-mono text-center focus:outline-none
                         focus:border-blue-500"
            />
          </div>
          <div>
            <label className="text-gray-500 text-xs block mb-1">Step</label>
            <input
              type="number"
              min={0.01}
              max={0.5}
              step={0.01}
              value={speedRamp.increment}
              onChange={(e) =>
                onSpeedRampChange({ increment: parseFloat(e.target.value) })
              }
              className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded
                         text-white text-sm font-mono text-center focus:outline-none
                         focus:border-blue-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
