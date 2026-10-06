// Audio Similarity Engine & Web Audio API Specialist Service for "Aledha" (قلدها)

class AudioEngine {
  constructor() {
    this.audioCtx = null;
    this.micStream = null;
    this.analyser = null;
    this.mediaRecorder = null;
    this.recordedChunks = [];
  }

  // Ensure AudioContext is initialized and active
  getAudioContext() {
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioCtxClass();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  // Unlock AudioContext for iOS Safari / Mobile
  unlockAudioContext() {
    const ctx = this.getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  }

  // Check if active microphone stream is already established and live
  isMicReady() {
    if (!this.micStream || !this.micStream.active) return false;
    const tracks = this.micStream.getAudioTracks ? this.micStream.getAudioTracks() : [];
    return tracks.length > 0 && tracks.some((t) => t.readyState === 'live');
  }

  // Explicit Microphone Permission & Initialization Check
  async initMicrophone() {
    try {
      this.unlockAudioContext();
      if (this.isMicReady()) {
        try {
          this.micStream.getAudioTracks().forEach((t) => { t.enabled = true; });
        } catch (e) {}
        this.setupAnalyser(this.micStream);
        return this.micStream;
      }

      // Universal audio constraint for mobile & desktop
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.micStream = stream;
      this.setupAnalyser(stream);
      return stream;
    } catch (err) {
      console.error("Microphone access denied or error:", err);
      if (typeof window !== 'undefined' && window.alert) {
        alert("يرجى تفعيل المايكروفون من إعدادات المتصفح لتتمكن من اللعب!");
      }
      return null;
    }
  }

  // Request Microphone permissions & return stream
  async initMic() {
    return await this.initMicrophone();
  }

  // Start live mic level monitoring for Pre-Game Audio Check in lobby
  startLiveLevelMonitor(onLevelUpdate) {
    if (!this.micStream) return () => {};
    const analyser = this.setupAnalyser(this.micStream);
    if (!analyser) return () => {};

    let isRunning = true;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const checkLevel = () => {
      if (!isRunning) return;
      analyser.getByteTimeDomainData(dataArray);
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        const norm = (dataArray[i] - 128) / 128.0;
        sum += norm * norm;
      }
      const rms = Math.sqrt(sum / bufferLength);
      if (onLevelUpdate) onLevelUpdate(Math.min(1.0, rms * 5.5));
      requestAnimationFrame(checkLevel);
    };
    requestAnimationFrame(checkLevel);

    return () => { isRunning = false; };
  }

  // Setup AnalyserNode for real-time visualizer without resetting active stream
  setupAnalyser(stream) {
    const ctx = this.getAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    const targetStream = stream || this.micStream;
    if (!targetStream) return this.analyser;

    try {
      if (!this._analyserSource || this._currentStream !== targetStream) {
        if (this._analyserSource) {
          try { this._analyserSource.disconnect(); } catch (e) {}
        }
        this._currentStream = targetStream;
        this._analyserSource = ctx.createMediaStreamSource(targetStream);
      }

      if (!this.analyser) {
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.4;
        this._analyserSource.connect(analyser);
        this.analyser = analyser;
      }
      return this.analyser;
    } catch (e) {
      console.warn('setupAnalyser error:', e);
      return this.analyser;
    }
  }

  // Soft stop mic - keeps tracks active so the browser never prompts for permission on each round
  stopMic() {
    // Intentionally keep audio tracks alive across rounds
  }

  // Record audio for durationMs: records using MediaRecorder with PCM fallback for 100% device compatibility
  recordAudio(durationMs, onVolumeUpdate) {
    return new Promise(async (resolve, reject) => {
      try {
        const ctx = this.getAudioContext();
        if (ctx.state === 'suspended') {
          await ctx.resume().catch(() => {});
        }

        const stream = await this.initMic();
        // Setup analyser for real-time visualizer
        this.setupAnalyser(stream);

        // Find best supported MIME type for MediaRecorder
        let mimeType = '';
        if (typeof MediaRecorder !== 'undefined') {
          const types = [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/mp4',
            'audio/aac',
            'audio/ogg'
          ];
          for (const t of types) {
            if (MediaRecorder.isTypeSupported(t)) {
              mimeType = t;
              break;
            }
          }
        }

        let mediaRecorder = null;
        const mrChunks = [];

        if (typeof MediaRecorder !== 'undefined') {
          try {
            mediaRecorder = mimeType
              ? new MediaRecorder(stream, { mimeType })
              : new MediaRecorder(stream);

            mediaRecorder.ondataavailable = (e) => {
              if (e.data && e.data.size > 0) {
                mrChunks.push(e.data);
              }
            };
            // 80ms slice guarantees chunks arrive continuously without missing data
            mediaRecorder.start(80);
          } catch (mrErr) {
            console.warn('Failed to start MediaRecorder, falling back to Web Audio PCM:', mrErr);
            mediaRecorder = null;
          }
        }

        // ScriptProcessor backup (retained on this._activeProcessor to prevent V8 garbage collection)
        let scriptNode = null;
        let dummyGain = null;
        let sourceNode = null;
        const pcmChunks = [];
        let totalPcmSamples = 0;
        let isCapturing = true;

        try {
          sourceNode = this._analyserSource || ctx.createMediaStreamSource(stream);
          scriptNode = ctx.createScriptProcessor(4096, 1, 1);
          this._activeProcessor = scriptNode; // Prevent garbage collection!

          scriptNode.onaudioprocess = (e) => {
            if (!isCapturing) return;
            const input = e.inputBuffer.getChannelData(0);
            const copy = new Float32Array(input.length);
            copy.set(input);
            pcmChunks.push(copy);
            totalPcmSamples += input.length;

            if (onVolumeUpdate) {
              let sum = 0;
              for (let i = 0; i < input.length; i++) sum += input[i] * input[i];
              const rms = Math.sqrt(sum / input.length);
              onVolumeUpdate(Math.min(1.0, rms * 6.0));
            }
          };

          dummyGain = ctx.createGain();
          dummyGain.gain.value = 0;
          sourceNode.connect(scriptNode);
          scriptNode.connect(dummyGain);
          dummyGain.connect(ctx.destination);
        } catch (spErr) {
          console.warn('ScriptProcessor setup error:', spErr);
        }

        // Auto-stop after durationMs
        setTimeout(async () => {
          isCapturing = false;

          // 1. Stop MediaRecorder if running and await final chunk flush
          if (mediaRecorder && mediaRecorder.state === 'recording') {
            await new Promise((res) => {
              mediaRecorder.onstop = () => res();
              try { mediaRecorder.stop(); } catch (e) { res(); }
              setTimeout(res, 200);
            });
          }

          // 2. Disconnect ScriptProcessor nodes only
          if (scriptNode) {
            try {
              scriptNode.disconnect();
              if (dummyGain) dummyGain.disconnect();
            } catch (e) {}
            this._activeProcessor = null;
          }

          let finalBlob = null;
          let finalDataUrl = null;
          let finalObjectUrl = null;
          let finalAudioBuffer = null;

          // Priority 1: Use MediaRecorder output if chunks exist
          if (mrChunks.length > 0) {
            const blobType = mimeType || mrChunks[0].type || 'audio/webm';
            finalBlob = new Blob(mrChunks, { type: blobType });
            finalObjectUrl = URL.createObjectURL(finalBlob);
            finalDataUrl = await this.blobToDataUrl(finalBlob);

            try {
              const arrayBuf = await finalBlob.arrayBuffer();
              finalAudioBuffer = await new Promise((res) => {
                ctx.decodeAudioData(
                  arrayBuf.slice(0),
                  (buf) => res(buf),
                  () => res(null)
                );
              });
            } catch (decErr) {
              console.warn('Error decoding MediaRecorder blob:', decErr);
            }
          }

          // Priority 2: Use ScriptProcessor PCM WAV if MediaRecorder had no chunks or decode failed
          if ((!finalAudioBuffer || finalBlob?.size === 0) && totalPcmSamples > 0) {
            const merged = new Float32Array(totalPcmSamples);
            let offset = 0;
            for (let i = 0; i < pcmChunks.length; i++) {
              merged.set(pcmChunks[i], offset);
              offset += pcmChunks[i].length;
            }
            const sRate = ctx.sampleRate || 44100;
            const pcmWav = this.float32ToWav(merged, sRate);
            finalBlob = pcmWav;
            finalObjectUrl = URL.createObjectURL(pcmWav);
            finalDataUrl = await this.blobToDataUrl(pcmWav);

            const pcmBuffer = ctx.createBuffer(1, Math.max(1, merged.length), sRate);
            pcmBuffer.getChannelData(0).set(merged);
            finalAudioBuffer = pcmBuffer;
          }

          // Absolute fallback if silence captured
          if (!finalAudioBuffer) {
            const sRate = ctx.sampleRate || 44100;
            finalAudioBuffer = ctx.createBuffer(1, sRate, sRate);
          }

          resolve({
            blob: finalBlob,
            objectUrl: finalObjectUrl,
            recordedUrl: finalObjectUrl,
            dataUrl: finalDataUrl,
            audioBuffer: finalAudioBuffer,
            duration: finalAudioBuffer.duration || (durationMs / 1000)
          });
        }, durationMs);

      } catch (err) {
        reject(err);
      }
    });
  }

  // Convert raw Float32 array to standard 16-bit PCM WAV Blob
  float32ToWav(samples, sampleRate) {
    const numChannels = 1;
    const format = 1; // PCM
    const bitDepth = 16;
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = samples.length * bytesPerSample;

    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    function writeString(offset, string) {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    }

    // RIFF chunk descriptor
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(8, 'WAVE');

    // fmt sub-chunk
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);

    // data sub-chunk
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);

    // Write PCM 16-bit samples
    let offset = 44;
    for (let i = 0; i < samples.length; i++) {
      let s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      offset += 2;
    }

    return new Blob([buffer], { type: 'audio/wav' });
  }

  // Backwards compatible method
  audioBufferToWav(buffer) {
    const channelData = buffer.getChannelData(0);
    return this.float32ToWav(channelData, buffer.sampleRate);
  }

  blobToDataUrl(blob) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  }

  // Hard release only when leaving the page entirely
  releaseMicHard() {
    if (this.micStream) {
      this.micStream.getTracks().forEach((track) => track.stop());
      this.micStream = null;
    }
    this.analyser = null;
  }
}

export const audioEngine = new AudioEngine();
