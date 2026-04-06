import { PitchShifter } from 'soundtouchjs';

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

type Callback<T extends unknown[]> = (...args: T) => void;

/**
 * AudioEngine — wraps Web Audio API + soundtouchjs PitchShifter.
 *
 * Design:
 *  - AudioContext + EQ chain created once in constructor
 *  - PitchShifter created per-track in load()
 *  - play/pause = AudioContext resume/suspend (simplest reliable approach)
 *  - Single setInterval tick for position tracking + loop checking
 */
export class AudioEngine {
  private ctx: AudioContext;
  private shifter: PitchShifter | null = null;
  private buffer: AudioBuffer | null = null;

  // Persistent audio nodes (created once, reused across tracks)
  private lowpass: BiquadFilterNode;
  private highpass: BiquadFilterNode;
  private gain: GainNode;

  // State
  private _playing = false;
  private _speed = 1.0;
  private _pitch = 0;
  private _loop: LoopBounds | null = null;
  private _videoId: string | null = null;

  // Speed ramp
  private _ramp: SpeedRampConfig = {
    startSpeed: 0.5,
    endSpeed: 1.0,
    increment: 0.05,
    enabled: false,
  };
  private _loopCount = 0;

  // Position tick
  private _tick: ReturnType<typeof setInterval> | null = null;

  // Callbacks (single listener each — the React hook is the only consumer)
  onTimeUpdate: Callback<[number]> | null = null;
  onPlayStateChange: Callback<[boolean]> | null = null;
  onLoopRestart: Callback<[number, number]> | null = null;

  constructor() {
    this.ctx = new AudioContext();

    // Persistent EQ + gain chain (never destroyed)
    this.lowpass = this.ctx.createBiquadFilter();
    this.lowpass.type = 'lowpass';
    this.lowpass.frequency.value = 20000;
    this.lowpass.Q.value = 0.7071;

    this.highpass = this.ctx.createBiquadFilter();
    this.highpass.type = 'highpass';
    this.highpass.frequency.value = 20;
    this.highpass.Q.value = 0.7071;

    this.gain = this.ctx.createGain();
    this.gain.gain.value = 1.0;

    // Wire: [shifter] → lowpass → highpass → gain → speakers
    this.lowpass.connect(this.highpass);
    this.highpass.connect(this.gain);
    this.gain.connect(this.ctx.destination);

    // Start suspended so nothing plays until explicitly told to
    this.ctx.suspend();
  }

  // ── Getters ──────────────────────────────────────────────

  get isPlaying(): boolean {
    return this._playing;
  }
  get currentTime(): number {
    return this.shifter?.timePlayed ?? 0;
  }
  get duration(): number {
    return this.buffer?.duration ?? 0;
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
  get speedRamp(): SpeedRampConfig {
    return { ...this._ramp };
  }
  get videoId(): string | null {
    return this._videoId;
  }
  getBuffer(): AudioBuffer | null {
    return this.buffer;
  }

  // ── Load ─────────────────────────────────────────────────

  async load(videoId: string): Promise<{ duration: number }> {
    // Stop anything currently playing
    if (this._playing) this.pause();
    this.destroyShifter();

    // Context must be running to decode audio
    await this.ctx.resume();

    const res = await fetch(`/api/stream/${videoId}`);
    if (!res.ok) throw new Error(`Failed to fetch audio: ${res.statusText}`);

    const raw = await res.arrayBuffer();
    this.buffer = await this.ctx.decodeAudioData(raw);
    this._videoId = videoId;
    this._loopCount = 0;

    // Reset speed for ramp if enabled
    if (this._ramp.enabled) {
      this._speed = this._ramp.startSpeed;
    }

    // Create PitchShifter for this track
    this.shifter = new PitchShifter(this.ctx, this.buffer, 4096, () => {
      // Song finished — pause
      this.pause();
    });
    this.shifter.tempo = this._speed;
    this.shifter.pitchSemitones = this._pitch;
    this.shifter.connect(this.lowpass);

    // Freeze immediately so it doesn't auto-play
    await this.ctx.suspend();

    return { duration: this.buffer.duration };
  }

  // ── Transport ────────────────────────────────────────────

  play(): void {
    if (!this.shifter || this._playing) return;
    this.ctx.resume();
    this._playing = true;
    this.startTick();
    this.onPlayStateChange?.(true);
  }

  pause(): void {
    if (!this._playing) return;
    this._playing = false;
    this.stopTick();
    this.ctx.suspend();
    this.onPlayStateChange?.(false);
  }

  togglePlayPause(): void {
    if (this._playing) this.pause();
    else this.play();
  }

  seek(time: number): void {
    if (!this.shifter || !this.buffer) return;
    const clamped = Math.max(0, Math.min(time, this.buffer.duration));
    this.shifter.percentagePlayed = clamped / this.buffer.duration;
    // Fire an immediate time update so the UI reflects the seek
    this.onTimeUpdate?.(clamped);
  }

  // ── Speed / Pitch / EQ ──────────────────────────────────

  setSpeed(rate: number): void {
    this._speed = Math.max(0.25, Math.min(2.0, rate));
    if (this.shifter) this.shifter.tempo = this._speed;
  }

  setPitch(semitones: number): void {
    this._pitch = Math.max(-12, Math.min(12, semitones));
    if (this.shifter) this.shifter.pitchSemitones = this._pitch;
  }

  setEQ(lowpassFreq: number, highpassFreq: number): void {
    this.lowpass.frequency.value = lowpassFreq;
    this.highpass.frequency.value = highpassFreq;
  }

  get lowpassFreq(): number {
    return this.lowpass.frequency.value;
  }
  get highpassFreq(): number {
    return this.highpass.frequency.value;
  }

  // ── Loop ─────────────────────────────────────────────────

  setLoop(start: number, end: number): void {
    if (start >= end) return;
    this._loop = { start, end };
    this._loopCount = 0;
    if (this._ramp.enabled) {
      this._speed = this._ramp.startSpeed;
      if (this.shifter) this.shifter.tempo = this._speed;
    }
  }

  clearLoop(): void {
    this._loop = null;
    this._loopCount = 0;
  }

  // ── Speed Ramp ───────────────────────────────────────────

  setSpeedRamp(config: Partial<SpeedRampConfig>): void {
    this._ramp = { ...this._ramp, ...config };
    if (this._ramp.enabled) {
      this._speed = this._ramp.startSpeed;
      this._loopCount = 0;
      if (this.shifter) this.shifter.tempo = this._speed;
    }
  }

  // ── Cleanup ──────────────────────────────────────────────

  destroy(): void {
    this.pause();
    this.destroyShifter();
    if (this.ctx.state !== 'closed') this.ctx.close();
  }

  // ── Internal ─────────────────────────────────────────────

  private startTick(): void {
    this.stopTick();
    this._tick = setInterval(() => {
      if (!this.shifter || !this._playing) return;
      const t = this.shifter.timePlayed;
      this.onTimeUpdate?.(t);
      this.checkLoop(t);
    }, 50);
  }

  private stopTick(): void {
    if (this._tick) {
      clearInterval(this._tick);
      this._tick = null;
    }
  }

  private checkLoop(time: number): void {
    if (!this._loop || !this.shifter || !this.buffer) return;
    if (time < this._loop.end) return;

    // Jump back to loop start
    this.shifter.percentagePlayed = this._loop.start / this.buffer.duration;
    this._loopCount++;

    // Speed ramp: bump speed each loop iteration
    if (this._ramp.enabled) {
      this._speed = Math.min(
        this._ramp.startSpeed + this._loopCount * this._ramp.increment,
        this._ramp.endSpeed
      );
      this.shifter.tempo = this._speed;
    }

    this.onLoopRestart?.(this._loopCount, this._speed);
  }

  private destroyShifter(): void {
    if (this.shifter) {
      this.shifter.off();
      this.shifter.disconnect();
      this.shifter = null;
    }
  }
}
