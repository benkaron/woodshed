/**
 * Extract smoothed RMS energy from an AudioBuffer for waveform display.
 * RMS (root mean square) gives a naturally smoother energy curve than peak values.
 * Returns an array of values between 0 and 1.
 */
export function extractPeaks(buffer: AudioBuffer, count: number): number[] {
  const channel = buffer.getChannelData(0);
  const samplesPerBin = Math.floor(channel.length / count);
  const raw: number[] = [];
  let globalMax = 0;

  for (let i = 0; i < count; i++) {
    const start = i * samplesPerBin;
    const end = Math.min(start + samplesPerBin, channel.length);
    let sum = 0;
    for (let j = start; j < end; j++) {
      sum += channel[j] * channel[j];
    }
    const rms = Math.sqrt(sum / (end - start));
    raw.push(rms);
    if (rms > globalMax) globalMax = rms;
  }

  // Normalize to 0-1
  if (globalMax > 0) {
    for (let i = 0; i < raw.length; i++) {
      raw[i] = raw[i] / globalMax;
    }
  }

  // Apply a slight power curve to boost quiet sections for visual balance
  for (let i = 0; i < raw.length; i++) {
    raw[i] = Math.pow(raw[i], 0.7);
  }

  return raw;
}
