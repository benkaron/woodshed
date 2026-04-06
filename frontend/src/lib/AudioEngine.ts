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
 * AudioEngine — Rubber Band WASM for studio-quality time stretching and pitch shifting.
 *
 * The AudioWorklet processor manages its own playback position and feeds
 * audio to Rubber Band at exactly the rate it needs — no AudioBufferSourceNode.
 */
export class AudioEngine {
  private ctx: AudioContext;
  private rbNode: AudioWorkletNode | null = null;
  private buffer: AudioBuffer | null = null;

  // Persistent audio nodes
  private lowpass: BiquadFilterNode;
  private highpass: BiquadFilterNode;
  private gain: GainNode;

  // State
  private _playing = false;
  private _speed = 1.0;
  private _pitch = 0;
  private _loop: LoopBounds | null = null;
  private _videoId: string | null = null;
  private _currentTime = 0;

  // Speed ramp
  private _ramp: SpeedRampConfig = {
    startSpeed: 0.5,
    endSpeed: 1.0,
    increment: 0.05,
    enabled: false,
  };
  private _loopCount = 0;

  // Tick for loop checking
  private _tick: ReturnType<typeof setInterval> | null = null;

  // Callbacks
  onTimeUpdate: Callback<[number]> | null = null;
  onPlayStateChange: Callback<[boolean]> | null = null;
  onLoopRestart: Callback<[number, number]> | null = null;

  constructor() {
    this.ctx = new AudioContext();

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

    this.lowpass.connect(this.highpass);
    this.highpass.connect(this.gain);
    this.gain.connect(this.ctx.destination);

    this.ctx.suspend();
  }

  // ── Getters ──────────────────────────────────────────────

  get isPlaying(): boolean {
    return this._playing;
  }
  get currentTime(): number {
    return this._currentTime;
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
    if (this._playing) this.pause();

    await this.ctx.resume();

    // Initialize AudioWorklet (once)
    if (!this.rbNode) {
      const wasmResponse = await fetch('/rubberband.wasm');
      const wasmBytes = await wasmResponse.arrayBuffer();

      await this.ctx.audioWorklet.addModule('/rb-processor.js');
      this.rbNode = new AudioWorkletNode(this.ctx, 'rb-processor', {
        numberOfInputs: 0,  // No input — processor reads audio internally
        numberOfOutputs: 1,
        outputChannelCount: [2],
      });
      this.rbNode.connect(this.lowpass);

      // Send WASM binary
      this.rbNode.port.postMessage(wasmBytes, [wasmBytes]);

      // Listen for position updates from processor
      this.rbNode.port.onmessage = (e) => {
        if (e.data?.type === 'position') {
          this._currentTime = e.data.readPos / this.ctx.sampleRate;
          this.onTimeUpdate?.(this._currentTime);
          this.checkLoop(this._currentTime);
        }
      };

      // Small delay for WASM to initialize
      await new Promise((r) => setTimeout(r, 200));
    }

    // Fetch and decode audio
    const res = await fetch(`/api/stream/${videoId}`);
    if (!res.ok) throw new Error(`Failed to fetch audio: ${res.statusText}`);

    const raw = await res.arrayBuffer();
    this.buffer = await this.ctx.decodeAudioData(raw);
    this._videoId = videoId;
    this._currentTime = 0;
    this._loopCount = 0;

    if (this._ramp.enabled) {
      this._speed = this._ramp.startSpeed;
    }

    // Send audio data to processor
    const channels: Float32Array[] = [];
    for (let c = 0; c < this.buffer.numberOfChannels; c++) {
      channels.push(this.buffer.getChannelData(c));
    }
    this.rbNode.port.postMessage({ type: 'audio', channels });

    // Apply settings
    this.sendMsg(['tempo', this._speed]);
    this.sendMsg(['pitch', semitonesToPitch(this._pitch)]);

    await this.ctx.suspend();

    return { duration: this.buffer.duration };
  }

  // ── Transport ────────────────────────────────────────────

  play(): void {
    if (!this.rbNode || !this.buffer || this._playing) return;
    this.ctx.resume();
    this.sendMsg(['play']);
    this._playing = true;
    this.startTick();
    this.onPlayStateChange?.(true);
  }

  pause(): void {
    if (!this._playing) return;
    this._playing = false;
    this.sendMsg(['pause']);
    this.stopTick();
    this.ctx.suspend();
    this.onPlayStateChange?.(false);
  }

  togglePlayPause(): void {
    if (this._playing) this.pause();
    else this.play();
  }

  seek(time: number): void {
    if (!this.buffer) return;
    const clamped = Math.max(0, Math.min(time, this.buffer.duration));
    const samplePos = Math.floor(clamped * this.ctx.sampleRate);
    this.sendMsg(['seek', samplePos]);
    this._currentTime = clamped;
    this.onTimeUpdate?.(clamped);
  }

  // ── Speed / Pitch / EQ ──────────────────────────────────

  setSpeed(rate: number): void {
    this._speed = Math.max(0.25, Math.min(2.0, rate));
    this.sendMsg(['tempo', this._speed]);
  }

  setPitch(semitones: number): void {
    this._pitch = Math.max(-12, Math.min(12, semitones));
    this.sendMsg(['pitch', semitonesToPitch(this._pitch)]);
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
      this.sendMsg(['tempo', this._speed]);
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
      this.sendMsg(['tempo', this._speed]);
    }
  }

  // ── Cleanup ──────────────────────────────────────────────

  destroy(): void {
    this.pause();
    if (this.rbNode) {
      this.sendMsg(['close']);
      this.rbNode.disconnect();
      this.rbNode = null;
    }
    if (this.ctx.state !== 'closed') this.ctx.close();
  }

  // ── Internal ─────────────────────────────────────────────

  private sendMsg(msg: unknown[]): void {
    this.rbNode?.port.postMessage(JSON.stringify(msg));
  }

  private startTick(): void {
    this.stopTick();
    // Tick just for loop checking — position comes from processor
    this._tick = setInterval(() => {
      if (!this._playing) return;
      this.checkLoop(this._currentTime);
    }, 100);
  }

  private stopTick(): void {
    if (this._tick) {
      clearInterval(this._tick);
      this._tick = null;
    }
  }

  private checkLoop(time: number): void {
    if (!this._loop || !this.buffer) return;
    if (time < this._loop.end) return;

    this.seek(this._loop.start);
    this._loopCount++;

    if (this._ramp.enabled) {
      this._speed = Math.min(
        this._ramp.startSpeed + this._loopCount * this._ramp.increment,
        this._ramp.endSpeed
      );
      this.sendMsg(['tempo', this._speed]);
    }

    this.onLoopRestart?.(this._loopCount, this._speed);
  }
}

function semitonesToPitch(semitones: number): number {
  return Math.pow(2, semitones / 12);
}
