import { useRef, useEffect, useCallback } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js';
import type { Region } from 'wavesurfer.js/dist/plugins/regions.esm.js';
import type { LoopBounds } from '../lib/AudioEngine';

interface WaveformDisplayProps {
  audioBuffer: AudioBuffer | null;
  currentTime: number;
  duration: number;
  loop: LoopBounds | null;
  onSeek: (time: number) => void;
  onLoopChange: (start: number, end: number) => void;
}

export function WaveformDisplay({
  audioBuffer,
  currentTime,
  duration,
  loop,
  onSeek,
  onLoopChange,
}: WaveformDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const regionsRef = useRef<RegionsPlugin | null>(null);
  const loopRegionRef = useRef<Region | null>(null);
  const isSeekingRef = useRef(false);

  // Initialize wavesurfer
  useEffect(() => {
    if (!containerRef.current) return;

    const regions = RegionsPlugin.create();
    regionsRef.current = regions;

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#4b5563',
      progressColor: '#3b82f6',
      cursorColor: '#60a5fa',
      cursorWidth: 2,
      height: 100,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      normalize: true,
      interact: true,
      backend: 'WebAudio',
      plugins: [regions],
      // Don't let wavesurfer play audio — we handle that via AudioEngine
      media: document.createElement('audio'),
    });

    // Handle click-to-seek
    ws.on('interaction', (newTime: number) => {
      isSeekingRef.current = true;
      onSeek(newTime);
      setTimeout(() => {
        isSeekingRef.current = false;
      }, 100);
    });

    // Handle region drag
    regions.on('region-updated', (region: Region) => {
      onLoopChange(region.start, region.end);
    });

    wavesurferRef.current = ws;

    return () => {
      ws.destroy();
      wavesurferRef.current = null;
      regionsRef.current = null;
      loopRegionRef.current = null;
    };
    // Only run on mount; onSeek/onLoopChange are stable callbacks
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load audio buffer into wavesurfer when it changes
  useEffect(() => {
    if (!wavesurferRef.current || !audioBuffer) return;

    // Create a blob URL from the audio buffer to load into wavesurfer
    // WaveSurfer can load from peaks data for visualization
    const peaks = [audioBuffer.getChannelData(0)];
    const dur = audioBuffer.duration;

    wavesurferRef.current.load('', peaks, dur);
  }, [audioBuffer]);

  // Update cursor position
  useEffect(() => {
    if (!wavesurferRef.current || !duration || isSeekingRef.current) return;
    const progress = currentTime / duration;
    if (progress >= 0 && progress <= 1) {
      wavesurferRef.current.seekTo(progress);
    }
  }, [currentTime, duration]);

  // Update loop region
  const updateLoopRegion = useCallback(() => {
    if (!regionsRef.current) return;

    // Remove existing loop region
    if (loopRegionRef.current) {
      loopRegionRef.current.remove();
      loopRegionRef.current = null;
    }

    // Add new loop region if loop is set
    if (loop) {
      loopRegionRef.current = regionsRef.current.addRegion({
        start: loop.start,
        end: loop.end,
        color: 'rgba(251, 191, 36, 0.25)',
        drag: true,
        resize: true,
      });
    }
  }, [loop]);

  useEffect(() => {
    updateLoopRegion();
  }, [updateLoopRegion]);

  return (
    <div className="bg-gray-800/50 rounded-lg p-3">
      <div
        ref={containerRef}
        className="w-full rounded overflow-hidden"
      />
      {!audioBuffer && (
        <div className="flex items-center justify-center h-[100px] text-gray-500 text-sm">
          Load a track to see the waveform
        </div>
      )}
    </div>
  );
}
