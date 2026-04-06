import { useState, useRef, useCallback, useEffect } from 'react';
import { AudioEngine } from '../lib/AudioEngine';
import type { LoopBounds, SpeedRampConfig } from '../lib/AudioEngine';

export function useAudioEngine() {
  const engineRef = useRef<AudioEngine | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeedState] = useState(1.0);
  const [pitch, setPitchState] = useState(0);
  const [loop, setLoopState] = useState<LoopBounds | null>(null);
  const [eq, setEqState] = useState({ lowpass: 20000, highpass: 20 });
  const [speedRamp, setSpeedRampState] = useState<SpeedRampConfig>({
    startSpeed: 0.5,
    endSpeed: 1.0,
    increment: 0.05,
    enabled: false,
  });

  // Create engine once
  useEffect(() => {
    const engine = new AudioEngine();
    engineRef.current = engine;

    // Wire callbacks
    engine.onTimeUpdate = (time) => setCurrentTime(time);
    engine.onPlayStateChange = (playing) => setIsPlaying(playing);
    engine.onLoopRestart = (_count, currentSpeed) => setSpeedState(currentSpeed);

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  const load = useCallback(async (videoId: string) => {
    const engine = engineRef.current;
    if (!engine) return;
    setIsLoading(true);
    try {
      const { duration: dur } = await engine.load(videoId);
      setDuration(dur);
      setCurrentTime(0);
      setIsPlaying(false);
      setLoopState(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const togglePlayPause = useCallback(() => {
    engineRef.current?.togglePlayPause();
  }, []);

  const seek = useCallback((time: number) => {
    engineRef.current?.seek(time);
  }, []);

  const setSpeed = useCallback((rate: number) => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setSpeed(rate);
    setSpeedState(engine.speed);
  }, []);

  const setPitch = useCallback((semitones: number) => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setPitch(semitones);
    setPitchState(engine.pitch);
  }, []);

  const setLoop = useCallback((start: number, end: number) => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setLoop(start, end);
    setLoopState(engine.loop);
    if (engine.speedRamp.enabled) {
      setSpeedState(engine.speed);
    }
  }, []);

  const clearLoop = useCallback(() => {
    engineRef.current?.clearLoop();
    setLoopState(null);
  }, []);

  const setEQ = useCallback((lowpass: number, highpass: number) => {
    engineRef.current?.setEQ(lowpass, highpass);
    setEqState({ lowpass, highpass });
  }, []);

  const setSpeedRamp = useCallback((config: Partial<SpeedRampConfig>) => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setSpeedRamp(config);
    setSpeedRampState(engine.speedRamp);
    setSpeedState(engine.speed);
  }, []);

  const getBuffer = useCallback(() => {
    return engineRef.current?.getBuffer() ?? null;
  }, []);

  return {
    // State
    isPlaying,
    isLoading,
    currentTime,
    duration,
    speed,
    pitch,
    loop,
    eq,
    speedRamp,
    // Actions
    load,
    togglePlayPause,
    seek,
    setSpeed,
    setPitch,
    setLoop,
    clearLoop,
    setEQ,
    setSpeedRamp,
    getBuffer,
  };
}
