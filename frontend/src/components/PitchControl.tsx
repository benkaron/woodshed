interface PitchControlProps {
  pitch: number;
  onPitchChange: (semitones: number) => void;
}

export function PitchControl({ pitch, onPitchChange }: PitchControlProps) {
  const displayPitch = pitch > 0 ? `+${pitch}` : `${pitch}`;

  return (
    <div className="bg-gray-800/50 rounded-lg p-4">
      <h3 className="text-gray-300 text-sm font-medium mb-3 uppercase tracking-wider">
        Pitch
      </h3>

      {/* Current pitch display */}
      <div className="text-center mb-3">
        <span className="text-2xl font-mono text-white font-bold">
          {displayPitch}
        </span>
        <span className="text-gray-400 text-sm ml-1">st</span>
      </div>

      {/* Pitch slider */}
      <input
        type="range"
        min={-12}
        max={12}
        step={1}
        value={pitch}
        onChange={(e) => onPitchChange(parseInt(e.target.value))}
        className="w-full h-1.5 bg-gray-700 rounded-full appearance-none cursor-pointer
                   [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5
                   [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full
                   [&::-webkit-slider-thumb]:bg-blue-500"
      />
      <div className="flex justify-between text-xs text-gray-500 mt-1 mb-3">
        <span>-12</span>
        <span>0</span>
        <span>+12</span>
      </div>

      {/* Buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => onPitchChange(pitch - 1)}
          disabled={pitch <= -12}
          className="flex-1 py-1.5 text-sm rounded bg-gray-700 text-gray-300
                     hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed
                     transition-colors font-mono"
        >
          -1
        </button>
        <button
          onClick={() => onPitchChange(0)}
          className={`flex-1 py-1.5 text-sm rounded transition-colors font-mono ${
            pitch === 0
              ? 'bg-blue-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Reset
        </button>
        <button
          onClick={() => onPitchChange(pitch + 1)}
          disabled={pitch >= 12}
          className="flex-1 py-1.5 text-sm rounded bg-gray-700 text-gray-300
                     hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed
                     transition-colors font-mono"
        >
          +1
        </button>
      </div>
    </div>
  );
}
