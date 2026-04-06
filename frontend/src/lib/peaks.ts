/**
 * Extract normalized peak amplitudes from an AudioBuffer for waveform display.
 * Returns an array of values between 0 and 1.
 */
export function extractPeaks(buffer: AudioBuffer, barCount: number): number[] {
  const channel = buffer.getChannelData(0);
  const samplesPerBar = Math.floor(channel.length / barCount);
  const peaks: number[] = [];

  let globalMax = 0;

  for (let i = 0; i < barCount; i++) {
    const start = i * samplesPerBar;
    const end = Math.min(start + samplesPerBar, channel.length);
    let max = 0;
    for (let j = start; j < end; j++) {
      const abs = Math.abs(channel[j]);
      if (abs > max) max = abs;
    }
    peaks.push(max);
    if (max > globalMax) globalMax = max;
  }

  // Normalize to 0-1
  if (globalMax > 0) {
    for (let i = 0; i < peaks.length; i++) {
      peaks[i] = peaks[i] / globalMax;
    }
  }

  return peaks;
}
