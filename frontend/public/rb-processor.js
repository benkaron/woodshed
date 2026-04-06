/**
 * Rubber Band AudioWorklet Processor
 *
 * Manages its own playback position — no AudioBufferSourceNode needed.
 * Feeds exactly the right amount of audio to Rubber Band each frame.
 */

const BLOCK_SIZE = 128;

class RBProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.running = true;
    this.ready = false;
    this.playing = false;
    this.rb = null;
    this.state = null;
    this.channels = 2;
    this.tempo = 1.0;
    this.pitch = 1.0;

    // Audio data (received from main thread)
    this.audioData = null;  // array of Float32Array per channel
    this.audioLength = 0;   // total samples per channel
    this.readPos = 0;       // current read position in samples

    // WASM memory pointers
    this.inPtrs = null;
    this.outPtrs = null;
    this.inBufs = [];
    this.outBufs = [];

    // Output ring buffer — smooths out uneven Rubber Band output
    this.outRing = [null, null]; // per-channel ring buffers
    this.ringSize = 16384;
    this.ringWritePos = 0;
    this.ringReadPos = 0;

    // Position reporting (throttled)
    this._reportCounter = 0;

    this.port.onmessage = (e) => {
      const data = e.data;

      // Binary: WASM module bytes
      if (data instanceof ArrayBuffer) {
        this.initFromBuffer(data);
        return;
      }

      // Audio data: { type: 'audio', channels: Float32Array[] }
      if (data && data.type === 'audio') {
        this.audioData = data.channels;
        this.audioLength = data.channels[0].length;
        this.readPos = 0;
        return;
      }

      // JSON commands
      const msg = JSON.parse(data);
      if (msg[0] === 'tempo') {
        this.tempo = msg[1];
        if (this.state && this.rb) {
          const ratio = 1.0 / this.tempo;
          this.rb.rubberband_set_time_ratio(this.state, ratio);
        }
      } else if (msg[0] === 'pitch') {
        this.pitch = msg[1];
        if (this.state && this.rb) {
          this.rb.rubberband_set_pitch_scale(this.state, this.pitch);
        }
      } else if (msg[0] === 'play') {
        this.playing = true;
      } else if (msg[0] === 'pause') {
        this.playing = false;
      } else if (msg[0] === 'seek') {
        this.readPos = msg[1]; // sample position
        this.ringWritePos = 0;
        this.ringReadPos = 0;
        if (this.state && this.rb) {
          this.rb.rubberband_reset(this.state);
          const pad = this.rb.rubberband_get_preferred_start_pad(this.state);
          if (pad > 0) this.feedSilence(this.rb, pad);
        }
      } else if (msg[0] === 'close') {
        this.running = false;
        this.cleanup();
      }
    };
  }

  async initFromBuffer(wasmBytes) {
    try {
      const wasmModule = await WebAssembly.compile(wasmBytes);
      const rb = await this.initializeRubberBand(wasmModule);
      this.rb = rb;

      const options =
        1 |          // RealTime
        536870912 |  // EngineFiner (R3)
        65536 |      // ThreadingNever
        33554432;    // PitchHighQuality

      this.state = rb.rubberband_new(
        sampleRate,
        this.channels,
        options,
        1.0 / this.tempo,
        this.pitch
      );

      rb.rubberband_set_max_process_size(this.state, BLOCK_SIZE);
      this.allocateBuffers(rb);

      const pad = rb.rubberband_get_preferred_start_pad(this.state);
      if (pad > 0) this.feedSilence(rb, pad);

      // Initialize output ring buffers
      for (let c = 0; c < this.channels; c++) {
        this.outRing[c] = new Float32Array(this.ringSize);
      }
      this.ringWritePos = 0;
      this.ringReadPos = 0;

      this.ready = true;
      console.log('Rubber Band processor initialized');
    } catch (err) {
      console.error('Failed to initialize Rubber Band processor:', err);
    }
  }

  async initializeRubberBand(module) {
    let heap = {};
    let printBuffer = [];

    const wasmInstance = await WebAssembly.instantiate(module, {
      env: {
        emscripten_notify_memory_growth: () => {
          heap.HEAP8 = new Uint8Array(wasmInstance.exports.memory.buffer);
          heap.HEAP32 = new Uint32Array(wasmInstance.exports.memory.buffer);
        },
      },
      wasi_snapshot_preview1: {
        proc_exit: () => 52,
        fd_read: () => 52,
        fd_write: (fd, iov, iovcnt, pnum) => {
          if (fd > 2) return 52;
          let num = 0;
          for (let i = 0; i < iovcnt; i++) {
            const ptr = heap.HEAP32[iov >> 2];
            const len = heap.HEAP32[(iov + 4) >> 2];
            iov += 8;
            for (let j = 0; j < len; j++) {
              const curr = heap.HEAP8[ptr + j];
              if (curr === 0 || curr === 10) {
                if (printBuffer.length > 0) console.log(printBuffer.join(''));
                printBuffer.length = 0;
              } else {
                printBuffer.push(String.fromCharCode(curr));
              }
            }
            num += len;
          }
          heap.HEAP32[pnum >> 2] = num;
          return 0;
        },
        fd_seek: () => 52,
        fd_close: () => 52,
        environ_sizes_get: () => 52,
        environ_get: () => 52,
        clock_time_get: () => 52,
      },
    });

    const exports = wasmInstance.exports;
    if (exports._initialize) exports._initialize();

    heap.HEAP8 = new Uint8Array(exports.memory.buffer);
    heap.HEAP32 = new Uint32Array(exports.memory.buffer);

    return {
      malloc: exports.wasm_malloc,
      free: exports.wasm_free,
      heap,
      exports,
      memWriteF32(destPtr, data) {
        new Float32Array(exports.memory.buffer, destPtr, data.length).set(data);
      },
      memReadF32(srcPtr, length) {
        return new Float32Array(exports.memory.buffer, srcPtr, length);
      },
      memWritePtr(destPtr, srcPtr) {
        new Uint32Array(exports.memory.buffer, destPtr, 1)[0] = srcPtr;
      },
      rubberband_new: exports.rb_new,
      rubberband_delete: exports.rb_delete,
      rubberband_reset: exports.rb_reset,
      rubberband_set_time_ratio: exports.rb_set_time_ratio,
      rubberband_set_pitch_scale: exports.rb_set_pitch_scale,
      rubberband_get_preferred_start_pad: exports.rb_get_preferred_start_pad,
      rubberband_set_max_process_size: exports.rb_set_max_process_size,
      rubberband_get_samples_required: exports.rb_get_samples_required,
      rubberband_process: exports.rb_process,
      rubberband_available: exports.rb_available,
      rubberband_retrieve: exports.rb_retrieve,
    };
  }

  allocateBuffers(rb) {
    const ch = this.channels;
    this.inPtrs = rb.malloc(ch * 4);
    this.outPtrs = rb.malloc(ch * 4);
    this.inBufs = [];
    this.outBufs = [];
    for (let c = 0; c < ch; c++) {
      const inBuf = rb.malloc(BLOCK_SIZE * 4);
      const outBuf = rb.malloc(BLOCK_SIZE * 4);
      this.inBufs.push(inBuf);
      this.outBufs.push(outBuf);
      rb.memWritePtr(this.inPtrs + c * 4, inBuf);
      rb.memWritePtr(this.outPtrs + c * 4, outBuf);
    }
  }

  feedSilence(rb, samples) {
    const silence = new Float32Array(BLOCK_SIZE);
    let remaining = samples;
    while (remaining > 0) {
      const n = Math.min(remaining, BLOCK_SIZE);
      for (let c = 0; c < this.channels; c++) {
        rb.memWriteF32(this.inBufs[c], silence.subarray(0, n));
      }
      rb.rubberband_process(this.state, this.inPtrs, n, 0);
      remaining -= n;
    }
  }

  ringAvailable() {
    return (this.ringWritePos - this.ringReadPos + this.ringSize) % this.ringSize;
  }

  ringWrite(rb, samples) {
    // Write Rubber Band output into ring buffer
    rb.rubberband_retrieve(this.state, this.outPtrs, samples);
    for (let c = 0; c < this.channels; c++) {
      const data = rb.memReadF32(this.outBufs[c], samples);
      for (let i = 0; i < samples; i++) {
        this.outRing[c][(this.ringWritePos + i) % this.ringSize] = data[i];
      }
    }
    this.ringWritePos = (this.ringWritePos + samples) % this.ringSize;
  }

  ringRead(output, samples) {
    // Read from ring buffer into output
    for (let c = 0; c < output.length; c++) {
      const src = Math.min(c, this.channels - 1);
      for (let i = 0; i < samples; i++) {
        output[c][i] = this.outRing[src][(this.ringReadPos + i) % this.ringSize];
      }
    }
    this.ringReadPos = (this.ringReadPos + samples) % this.ringSize;
  }

  process(_inputs, outputs) {
    if (!this.running) return false;
    if (!this.ready || !this.rb || !this.state || !this.playing || !this.audioData) {
      return true;
    }

    const rb = this.rb;
    const output = outputs[0];
    const outLen = output[0].length;

    // Step 1: Feed audio to Rubber Band and drain output into ring buffer
    for (let iter = 0; iter < 16; iter++) {
      // Pull any available output into ring buffer
      const avail = rb.rubberband_available(this.state);
      if (avail > 0) {
        const toPull = Math.min(avail, BLOCK_SIZE);
        this.ringWrite(rb, toPull);
      }

      // If ring buffer has enough for this frame, stop feeding
      if (this.ringAvailable() >= outLen) break;

      // Feed more input
      const required = rb.rubberband_get_samples_required(this.state);
      if (required === 0) continue; // RB processing internally, try pulling again

      const toFeed = Math.min(required, BLOCK_SIZE);
      const remaining = this.audioLength - this.readPos;

      if (remaining <= 0) {
        const silence = new Float32Array(toFeed);
        for (let c = 0; c < this.channels; c++) {
          rb.memWriteF32(this.inBufs[c], silence);
        }
        rb.rubberband_process(this.state, this.inPtrs, toFeed, 1);
        continue;
      }

      const n = Math.min(toFeed, remaining);
      for (let c = 0; c < this.channels; c++) {
        const channelIdx = Math.min(c, this.audioData.length - 1);
        const chunk = this.audioData[channelIdx].subarray(this.readPos, this.readPos + n);
        rb.memWriteF32(this.inBufs[c], chunk);
      }
      rb.rubberband_process(this.state, this.inPtrs, n, 0);
      this.readPos += n;
    }

    // Step 2: Read from ring buffer into output
    if (this.ringAvailable() >= outLen) {
      this.ringRead(output, outLen);
    }
    // If not enough yet, output stays zeroed (initial buffer fill)

    // Report position
    this._reportCounter++;
    if (this._reportCounter >= 5) {
      this._reportCounter = 0;
      this.port.postMessage({ type: 'position', readPos: this.readPos });
    }

    return true;
  }

  cleanup() {
    if (this.rb && this.state) {
      this.rb.rubberband_delete(this.state);
      this.state = null;
    }
  }
}

registerProcessor('rb-processor', RBProcessor);
