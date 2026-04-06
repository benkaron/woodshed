import {
  PitchShifter,
} from 'soundtouchjs';

export interface LoopBounds {
  start: number;
  end: number;
}

export interface SpeedRampConfig {
  startSpeed: number;
  endSpeed: number;
  increment: number;
  enabled: boolean;
}

type TimeUpdateCallback = (currentTime: number) => void;
type LoopRestartCallback = (loopCount: number, currentSpeed: number) => void;

export class AudioEngine {
  private audioContext: AudioContext | null = null;
  private audioBuffer: AudioBuffer | null = null;
  private shifter: PitchShifter | null = null;

  // Audio graph nodes
  private gainNode: GainNode | null = null;
  private lowpassFilter: BiquadFilterNode | null = null;
  private highpassFilter: BiquadFilterNode | null = null;

  // Playback state
  private _isPlaying = false;
  private _speed = 1.0;
  private _pitch = 0; // semitones
  private _loop: LoopBounds | null = null;
  private _lowpassFreq = 20000;
  private _highpassFreq = 20;

  // Speed ramp
  private _speedRamp: SpeedRampConfig = {
    startSpeed: 0.5,
    endSpeed: 1.0,
    increment: 0.05,
    enabled: false,
  };
  private _currentRampSpeed = 1.0;
  private _loopCount = 0;

  // Position tracking
  private _currentTime = 0;
  private _duration = 0;
  private positionUpdateInterval: ReturnType<typeof setInterval> | null = null;

  // Callbacks
  private timeUpdateCallbacks: TimeUpdateCallback[] = [];
  private loopRestartCallbacks: LoopRestartCallback[] = [];

  // Track loaded video ID
  private _videoId: string | null = null;

  get isPlaying(): boolean {
    return this._isPlaying;
  }

  get currentTime(): number {
    return this._currentTime;
  }

  get duration(): number {
    return this._duration;
  }

  get speed(): number {
    return this._speed;
  }

  get pitch(): number {
    return this._pitch;
  }

  get loop(): LoopBounds | null {
    return this._loop;
  }

  get lowpassFreq(): number {
    return this._lowpassFreq;
  }

  get highpassFreq(): number {
    return this._highpassFreq;
  }

  get speedRamp(): SpeedRampConfig {
    return { ...this._speedRamp };
  }

  get videoId(): string | null {
    return this._videoId;
  }

  getBuffer(): AudioBuffer | null {
    return this.audioBuffer;
  }

  async load(videoId: string): Promise<{ duration: number }> {
    // Clean up previous playback
    this.stop();
    this.destroyShifter();

    // Create audio context if needed
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }

    // Fetch audio stream from backend
    const response = await fetch(`/api/stream/${videoId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch audio: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
    this._duration = this.audioBuffer.duration;
    this._videoId = videoId;
    this._currentTime = 0;
    this._loopCount = 0;

    // Reset speed ramp
    if (this._speedRamp.enabled) {
      this._currentRampSpeed = this._speedRamp.startSpeed;
      this._speed = this._currentRampSpeed;
    }

    this.setupAudioGraph();

    return { duration: this._duration };
  }

  private setupAudioGraph(): void {
    if (!this.audioContext || !this.audioBuffer) return;

    this.destroyShifter();

    // Create EQ filters
    this.lowpassFilter = this.audioContext.createBiquadFilter();
    this.lowpassFilter.type = 'lowpass';
    this.lowpassFilter.frequency.value = this._lowpassFreq;
    this.lowpassFilter.Q.value = 0.7071;

    this.highpassFilter = this.audioContext.createBiquadFilter();
    this.highpassFilter.type = 'highpass';
    this.highpassFilter.frequency.value = this._highpassFreq;
    this.highpassFilter.Q.value = 0.7071;

    // Create gain node
    this.gainNode = this.audioContext.createGain();
    this.gainNode.gain.value = 1.0;

    // Create PitchShifter from soundtouchjs
    // PitchShifter(context, buffer, bufferSize, onEnd)
    this.shifter = new PitchShifter(this.audioContext, this.audioBuffer, 4096, () => {
      // Audio ended
      this._isPlaying = false;
      this.stopPositionTracking();
    });

    // Set initial tempo and pitch
    const effectiveSpeed = this._speedRamp.enabled ? this._currentRampSpeed : this._speed;
    this.shifter.tempo = effectiveSpeed;
    this.shifter.pitchSemitones = this._pitch;

    // Connect: shifter → lowpass → highpass → gain → destination
    this.shifter.connect(this.lowpassFilter);
    this.lowpassFilter.connect(this.highpassFilter);
    this.highpassFilter.connect(this.gainNode);
    this.gainNode.connect(this.audioContext.destination);

    // Listen for position updates from the shifter
    this.shifter.on('play', (detail: { timePlayed: number }) => {
      this._currentTime = detail.timePlayed;
      this.notifyTimeUpdate();
      this.checkLoopBounds();
    });
  }

  private checkLoopBounds(): void {
    if (!this._loop || !this.shifter) return;

    if (this._currentTime >= this._loop.end) {
      // Jump back to loop start
      this.seekInternal(this._loop.start);
      this._loopCount++;

      // Apply speed ramp if enabled
      if (this._speedRamp.enabled) {
        const newSpeed = Math.min(
          this._speedRamp.startSpeed + this._loopCount * this._speedRamp.increment,
          this._speedRamp.endSpeed
        );
        this._currentRampSpeed = newSpeed;
        this._speed = newSpeed;
        if (this.shifter) {
          this.shifter.tempo = newSpeed;
        }
      }

      this.notifyLoopRestart();
    }
  }

  play(): void {
    if (!this.audioContext || !this.shifter) return;

    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    // If we had stopped, we need to rebuild the graph to start fresh
    if (!this._isPlaying) {
      this._isPlaying = true;
      this.startPositionTracking();
    }
  }

  pause(): void {
    if (!this.audioContext) return;
    this._isPlaying = false;
    this.audioContext.suspend();
    this.stopPositionTracking();
  }

  private stop(): void {
    this._isPlaying = false;
    this.stopPositionTracking();
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.suspend();
    }
  }

  seek(time: number): void {
    const clampedTime = Math.max(0, Math.min(time, this._duration));
    this.seekInternal(clampedTime);
  }

  private seekInternal(time: number): void {
    if (!this.shifter || !this.audioContext) return;

    const sampleRate = this.audioContext.sampleRate;
    // PitchShifter uses percentagePlayed as a fraction (0-100)
    const percentage = (time / this._duration) * 100;
    this.shifter.percentagePlayed = percentage;
    this._currentTime = time;
    // Also update the sourcePosition directly for accuracy
    const sourcePosition = Math.floor(time * sampleRate);
    if (sourcePosition >= 0) {
      this.shifter.sourcePosition = sourcePosition;
      this.shifter.timePlayed = time;
    }
    this.notifyTimeUpdate();
  }

  setSpeed(rate: number): void {
    this._speed = Math.max(0.25, Math.min(2.0, rate));
    if (this.shifter) {
      this.shifter.tempo = this._speed;
    }
    // If ramp is enabled, also update the ramp current speed
    if (this._speedRamp.enabled) {
      this._currentRampSpeed = this._speed;
    }
  }

  setPitch(semitones: number): void {
    this._pitch = Math.max(-12, Math.min(12, semitones));
    if (this.shifter) {
      this.shifter.pitchSemitones = this._pitch;
    }
  }

  setLoop(start: number, end: number): void {
    if (start >= end) return;
    this._loop = { start, end };
    this._loopCount = 0;

    // Reset speed ramp when loop changes
    if (this._speedRamp.enabled) {
      this._currentRampSpeed = this._speedRamp.startSpeed;
      this._speed = this._currentRampSpeed;
      if (this.shifter) {
        this.shifter.tempo = this._currentRampSpeed;
      }
    }
  }

  clearLoop(): void {
    this._loop = null;
    this._loopCount = 0;
  }

  setEQ(lowpass: number, highpass: number): void {
    this._lowpassFreq = lowpass;
    this._highpassFreq = highpass;
    if (this.lowpassFilter) {
      this.lowpassFilter.frequency.value = lowpass;
    }
    if (this.highpassFilter) {
      this.highpassFilter.frequency.value = highpass;
    }
  }

  setSpeedRamp(config: Partial<SpeedRampConfig>): void {
    this._speedRamp = { ...this._speedRamp, ...config };

    if (this._speedRamp.enabled) {
      this._currentRampSpeed = this._speedRamp.startSpeed;
      this._speed = this._currentRampSpeed;
      this._loopCount = 0;
      if (this.shifter) {
        this.shifter.tempo = this._currentRampSpeed;
      }
    }
  }

  getPosition(): number {
    return this._currentTime;
  }

  getDuration(): number {
    return this._duration;
  }

  onTimeUpdate(callback: TimeUpdateCallback): () => void {
    this.timeUpdateCallbacks.push(callback);
    return () => {
      this.timeUpdateCallbacks = this.timeUpdateCallbacks.filter((cb) => cb !== callback);
    };
  }

  onLoopRestart(callback: LoopRestartCallback): () => void {
    this.loopRestartCallbacks.push(callback);
    return () => {
      this.loopRestartCallbacks = this.loopRestartCallbacks.filter((cb) => cb !== callback);
    };
  }

  private notifyTimeUpdate(): void {
    for (const cb of this.timeUpdateCallbacks) {
      cb(this._currentTime);
    }
  }

  private notifyLoopRestart(): void {
    for (const cb of this.loopRestartCallbacks) {
      cb(this._loopCount, this._currentRampSpeed);
    }
  }

  private startPositionTracking(): void {
    this.stopPositionTracking();
    // Fallback position tracking interval in case the shifter 'play' event
    // doesn't fire frequently enough
    this.positionUpdateInterval = setInterval(() => {
      if (this._isPlaying && this.shifter) {
        this._currentTime = this.shifter.timePlayed;
        this.notifyTimeUpdate();
        this.checkLoopBounds();
      }
    }, 50);
  }

  private stopPositionTracking(): void {
    if (this.positionUpdateInterval) {
      clearInterval(this.positionUpdateInterval);
      this.positionUpdateInterval = null;
    }
  }

  private destroyShifter(): void {
    if (this.shifter) {
      this.shifter.off();
      this.shifter.disconnect();
      this.shifter = null;
    }
    if (this.lowpassFilter) {
      this.lowpassFilter.disconnect();
      this.lowpassFilter = null;
    }
    if (this.highpassFilter) {
      this.highpassFilter.disconnect();
      this.highpassFilter = null;
    }
    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }
  }

  destroy(): void {
    this.stop();
    this.destroyShifter();
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
    this.audioContext = null;
    this.audioBuffer = null;
    this.timeUpdateCallbacks = [];
    this.loopRestartCallbacks = [];
  }
}
