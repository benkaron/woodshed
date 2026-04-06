declare module 'soundtouchjs' {
  export class SoundTouch {
    constructor();
    tempo: number;
    rate: number;
    pitch: number;
    pitchOctaves: number;
    pitchSemitones: number;
    tempoChange: number;
    rateChange: number;
    readonly inputBuffer: FifoSampleBuffer;
    readonly outputBuffer: FifoSampleBuffer;
    clear(): void;
    clone(): SoundTouch;
    process(): void;
  }

  export class FifoSampleBuffer {
    readonly vector: Float32Array;
    readonly position: number;
    readonly startIndex: number;
    readonly frameCount: number;
    readonly endIndex: number;
    clear(): void;
    put(numFrames: number): void;
    putSamples(samples: Float32Array, position?: number, numFrames?: number): void;
    putBuffer(buffer: FifoSampleBuffer, position?: number, numFrames?: number): void;
    receive(numFrames?: number): void;
    receiveSamples(output: Float32Array, numFrames?: number): void;
    extract(output: Float32Array, position?: number, numFrames?: number): void;
    ensureCapacity(numFrames?: number): void;
    ensureAdditionalCapacity(numFrames?: number): void;
    rewind(): void;
  }

  export class WebAudioBufferSource {
    constructor(buffer: AudioBuffer);
    readonly dualChannel: boolean;
    position: number;
    extract(target: Float32Array, numFrames?: number, position?: number): number;
  }

  export class SimpleFilter {
    constructor(sourceSound: WebAudioBufferSource, pipe: SoundTouch, callback?: () => void);
    position: number;
    sourcePosition: number;
    extract(target: Float32Array, numFrames?: number): number;
    handleSampleData(event: { data: Float32Array }): void;
    clear(): void;
    onEnd(): void;
  }

  export class PitchShifter {
    constructor(context: AudioContext, buffer: AudioBuffer, bufferSize: number, onEnd?: () => void);
    readonly formattedDuration: string;
    readonly formattedTimePlayed: string;
    percentagePlayed: number;
    readonly node: ScriptProcessorNode;
    pitch: number;
    pitchSemitones: number;
    rate: number;
    tempo: number;
    duration: number;
    sampleRate: number;
    timePlayed: number;
    sourcePosition: number;
    connect(toNode: AudioNode): void;
    disconnect(): void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    on(eventName: string, cb: (detail: any) => void): void;
    off(eventName?: string | null): void;
  }

  export class RateTransposer {
    constructor(createBuffers?: boolean);
    rate: number;
    reset(): void;
    process(): void;
    clear(): void;
  }

  export class Stretch {
    constructor(createBuffers?: boolean);
    tempo: number;
    setParameters(sampleRate: number, sequenceMs: number, seekWindowMs: number, overlapMs: number): void;
    clear(): void;
    process(): void;
  }

  export class AbstractFifoSamplePipe {
    constructor(createBuffers?: boolean);
    inputBuffer: FifoSampleBuffer | null;
    outputBuffer: FifoSampleBuffer | null;
    clear(): void;
  }

  export function getWebAudioNode(
    context: AudioContext,
    filter: SimpleFilter,
    sourcePositionCallback?: (position: number) => void,
    bufferSize?: number
  ): ScriptProcessorNode;
}
