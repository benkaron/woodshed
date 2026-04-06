import { useState, useRef, useCallback, useEffect } from 'react';
import { AudioEngine } from '../lib/AudioEngine';
import type { LoopBounds, SpeedRampConfig } from '../lib/AudioEngine';

export interface AudioEngineState {
  isPlaying: boolean;
  isLoading: boolean;
  currentTime: number;
  duration: number;
  speed: number;
  pitch: number;
  loop: LoopBounds | null;
  eq: { lowpass: number; highpass: number };
  speedRamp: SpeedRampConfig;
}

export interface AudioEngineActions {
  load: (videoId: string) => Promise<void>;
  play: () => void;
  pause: () => void;
  togglePlayPause: () => void;
  seek: (time: number) => void;
  setSpeed: (rate: number) => void;
  setPitch: (semitones: number) => void;
  setLoop: (start: number, end: number) => void;
  clearLoop: () => void;
  setEQ: (lowpass: number, highpass: number) => void;
  setSpeedRamp: (config: Partial<SpeedRampConfig>) => void;
  getBuffer: () => AudioBuffer | null;
}

export function useAudioEngine(): AudioEngineState & AudioEngineActions {
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

  // Initialize engine on mount
  useEffect(() => {
    engineRef.current = new AudioEngine();
    const engine = engineRef.current;

    const unsubTime = engine.onTimeUpdate((time) => {
      setCurrentTime(time);
    });

    const unsubLoop = engine.onLoopRestart((_count, currentSpeed) => {
      setSpeedState(currentSpeed);
    });

    return () => {
      unsubTime();
      unsubLoop();
      engine.destroy();
    };
  }, []);

  const load = useCallback(async (videoId: string) => {
    if (!engineRef.current) return;
    setIsLoading(true);
    try {
      const { duration: dur } = await engineRef.current.load(videoId);
      setDuration(dur);
      setCurrentTime(0);
      setIsPlaying(false);
      setLoopState(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const play = useCallback(() => {
    if (!engineRef.current) return;
    engineRef.current.play();
    setIsPlaying(true);
  }, []);

  const pause = useCallback(() => {
    if (!engineRef.current) return;
    engineRef.current.pause();
    setIsPlaying(false);
  }, []);

  const togglePlayPause = useCallback(() => {
    if (!engineRef.current) return;
    if (engineRef.current.isPlaying) {
      engineRef.current.pause();
      setIsPlaying(false);
    } else {
      engineRef.current.play();
      setIsPlaying(true);
    }
  }, []);

  const seek = useCallback((time: number) => {
    if (!engineRef.current) return;
    engineRef.current.seek(time);
    setCurrentTime(time);
  }, []);

  const setSpeed = useCallback((rate: number) => {
    if (!engineRef.current) return;
    engineRef.current.setSpeed(rate);
    setSpeedState(engineRef.current.speed);
  }, []);

  const setPitch = useCallback((semitones: number) => {
    if (!engineRef.current) return;
    engineRef.current.setPitch(semitones);
    setPitchState(engineRef.current.pitch);
  }, []);

  const setLoop = useCallback((start: number, end: number) => {
    if (!engineRef.current) return;
    engineRef.current.setLoop(start, end);
    setLoopState(engineRef.current.loop);
    if (speedRamp.enabled) {
      setSpeedState(engineRef.current.speed);
    }
  }, [speedRamp.enabled]);

  const clearLoop = useCallback(() => {
    if (!engineRef.current) return;
    engineRef.current.clearLoop();
    setLoopState(null);
  }, []);

  const setEQ = useCallback((lowpass: number, highpass: number) => {
    if (!engineRef.current) return;
    engineRef.current.setEQ(lowpass, highpass);
    setEqState({ lowpass, highpass });
  }, []);

  const setSpeedRamp = useCallback((config: Partial<SpeedRampConfig>) => {
    if (!engineRef.current) return;
    engineRef.current.setSpeedRamp(config);
    setSpeedRampState(engineRef.current.speedRamp);
    setSpeedState(engineRef.current.speed);
  }, []);

  const getBuffer = useCallback(() => {
    return engineRef.current?.getBuffer() ?? null;
  }, []);

  return {
    isPlaying,
    isLoading,
    currentTime,
    duration,
    speed,
    pitch,
    loop,
    eq,
    speedRamp,
    load,
    play,
    pause,
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
