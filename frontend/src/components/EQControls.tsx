interface EQControlsProps {
  lowpass: number;
  highpass: number;
  onEQChange: (lowpass: number, highpass: number) => void;
}

// Convert between slider value (linear 0-100) and frequency (log scale)
function sliderToFreq(value: number, min: number, max: number): number {
  const minLog = Math.log10(min);
  const maxLog = Math.log10(max);
  return Math.pow(10, minLog + (value / 100) * (maxLog - minLog));
}

function freqToSlider(freq: number, min: number, max: number): number {
  const minLog = Math.log10(min);
  const maxLog = Math.log10(max);
  return ((Math.log10(freq) - minLog) / (maxLog - minLog)) * 100;
}

function formatFreq(freq: number): string {
  if (freq >= 1000) {
    return `${(freq / 1000).toFixed(1)}kHz`;
  }
  return `${Math.round(freq)}Hz`;
}

const LOWPASS_MIN = 200;
const LOWPASS_MAX = 20000;
const HIGHPASS_MIN = 20;
const HIGHPASS_MAX = 5000;

export function EQControls({ lowpass, highpass, onEQChange }: EQControlsProps) {
  const lowpassSlider = freqToSlider(lowpass, LOWPASS_MIN, LOWPASS_MAX);
  const highpassSlider = freqToSlider(highpass, HIGHPASS_MIN, HIGHPASS_MAX);

  const handleReset = () => {
    onEQChange(20000, 20);
  };

  return (
    <div className="bg-gray-800/50 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-gray-300 text-sm font-medium uppercase tracking-wider">
          EQ
        </h3>
        <button
          onClick={handleReset}
          className={`text-xs px-2 py-0.5 rounded transition-colors ${
            lowpass >= 19999 && highpass <= 21
              ? 'text-gray-600 cursor-default'
              : 'text-gray-400 hover:text-white bg-gray-700 hover:bg-gray-600'
          }`}
          disabled={lowpass >= 19999 && highpass <= 21}
        >
          Reset
        </button>
      </div>

      {/* Lowpass */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-gray-400 text-xs">Lowpass</label>
          <span className="text-gray-300 font-mono text-xs">{formatFreq(lowpass)}</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={0.5}
          value={lowpassSlider}
          onChange={(e) => {
            const freq = sliderToFreq(parseFloat(e.target.value), LOWPASS_MIN, LOWPASS_MAX);
            onEQChange(freq, highpass);
          }}
          className="w-full h-1.5 bg-gray-700 rounded-full appearance-none cursor-pointer
                     [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3
                     [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full
                     [&::-webkit-slider-thumb]:bg-blue-500"
        />
        <div className="flex justify-between text-xs text-gray-600 mt-0.5">
          <span>200Hz</span>
          <span>20kHz</span>
        </div>
      </div>

      {/* Highpass */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-gray-400 text-xs">Highpass</label>
          <span className="text-gray-300 font-mono text-xs">{formatFreq(highpass)}</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={0.5}
          value={highpassSlider}
          onChange={(e) => {
            const freq = sliderToFreq(parseFloat(e.target.value), HIGHPASS_MIN, HIGHPASS_MAX);
            onEQChange(lowpass, freq);
          }}
          className="w-full h-1.5 bg-gray-700 rounded-full appearance-none cursor-pointer
                     [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3
                     [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full
                     [&::-webkit-slider-thumb]:bg-blue-500"
        />
        <div className="flex justify-between text-xs text-gray-600 mt-0.5">
          <span>20Hz</span>
          <span>5kHz</span>
        </div>
      </div>
    </div>
  );
}
