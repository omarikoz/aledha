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
        alert("Please enable microphone permissions in your browser to play!");
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

  // Convert Base64 or Blob URL or ArrayBuffer to AudioBuffer
  async decodeAudio(audioSource) {
    if (!audioSource) return null;
    if (typeof AudioBuffer !== 'undefined' && audioSource instanceof AudioBuffer) {
      return audioSource;
    }
    const ctx = this.getAudioContext();
    if (ctx.state === 'suspended') {
      await ctx.resume().catch(() => {});
    }

    try {
      let arrayBuf = null;
      if (audioSource instanceof ArrayBuffer) {
        arrayBuf = audioSource;
      } else if (audioSource instanceof Blob) {
        arrayBuf = await audioSource.arrayBuffer();
      } else if (typeof audioSource === 'string') {
        if (audioSource.startsWith('data:')) {
          const parts = audioSource.split(',');
          const bstr = atob(parts[1]);
          let n = bstr.length;
          const u8arr = new Uint8Array(n);
          while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
          }
          arrayBuf = u8arr.buffer;
        } else {
          const res = await fetch(audioSource);
          arrayBuf = await res.arrayBuffer();
        }
      }

      if (!arrayBuf) return null;
      return await new Promise((resolve) => {
        ctx.decodeAudioData(
          arrayBuf.slice(0),
          (buf) => resolve(buf),
          (err) => {
            console.warn('decodeAudio error:', err);
            resolve(null);
          }
        );
      });
    } catch (e) {
      console.warn('decodeAudio exception:', e);
      return null;
    }
  }

  // Pure Deterministic Audio Accuracy Evaluation (NO Random Fallbacks)
  // Compares player's decoded AudioBuffer against reference sound's AudioBuffer
  calculateAiAccuracy(playerBuffer, refBuffer) {
    if (!playerBuffer || !refBuffer) {
      return {
        totalScore: 0,
        timingMatch: 0,
        toneMatch: 0,
        rhythmScore: 0,
        durationScore: 0,
        spectralScore: 0
      };
    }

    const pData = playerBuffer.getChannelData(0);
    const rData = refBuffer.getChannelData(0);
    const pSampleRate = playerBuffer.sampleRate || 44100;
    const rSampleRate = refBuffer.sampleRate || 44100;

    // 50ms Slices
    const pSliceSize = Math.max(1, Math.floor(pSampleRate * 0.05));
    const rSliceSize = Math.max(1, Math.floor(rSampleRate * 0.05));

    const pNumSlices = Math.floor(pData.length / pSliceSize);
    const rNumSlices = Math.floor(rData.length / rSliceSize);

    if (pNumSlices === 0 || rNumSlices === 0) {
      return {
        totalScore: 0,
        timingMatch: 0,
        toneMatch: 0,
        rhythmScore: 0,
        durationScore: 0,
        spectralScore: 0
      };
    }

    // 1. Compute RMS in 50ms slices for both audios
    const pRms = new Float32Array(pNumSlices);
    let pPeakRms = 0;
    let pActiveCount = 0;
    for (let i = 0; i < pNumSlices; i++) {
      let sum = 0;
      const start = i * pSliceSize;
      for (let j = 0; j < pSliceSize; j++) {
        const val = pData[start + j];
        sum += val * val;
      }
      const rms = Math.sqrt(sum / pSliceSize);
      pRms[i] = rms;
      if (rms > pPeakRms) pPeakRms = rms;
      if (rms >= 0.02) pActiveCount++;
    }

    // Strict Silence Check: If peak RMS is below 0.02, score = 0%
    if (pPeakRms < 0.02 || pActiveCount === 0) {
      return {
        totalScore: 0,
        timingMatch: 0,
        toneMatch: 0,
        rhythmScore: 0,
        durationScore: 0,
        spectralScore: 0
      };
    }

    const rRms = new Float32Array(rNumSlices);
    let rPeakRms = 0;
    let rActiveCount = 0;
    for (let i = 0; i < rNumSlices; i++) {
      let sum = 0;
      const start = i * rSliceSize;
      for (let j = 0; j < rSliceSize; j++) {
        const val = rData[start + j];
        sum += val * val;
      }
      const rms = Math.sqrt(sum / rSliceSize);
      rRms[i] = rms;
      if (rms > rPeakRms) rPeakRms = rms;
      if (rms >= 0.02) rActiveCount++;
    }

    // Normalize RMS envelopes
    const pNorm = new Float32Array(pNumSlices);
    for (let i = 0; i < pNumSlices; i++) {
      pNorm[i] = pPeakRms > 0 ? pRms[i] / pPeakRms : 0;
    }
    const rNorm = new Float32Array(rNumSlices);
    for (let i = 0; i < rNumSlices; i++) {
      rNorm[i] = rPeakRms > 0 ? rRms[i] / rPeakRms : 0;
    }

    // Helper: Resample array to common length
    const resampleArray = (arr, targetLen) => {
      const out = new Float32Array(targetLen);
      if (arr.length === 0) return out;
      if (arr.length === 1) {
        out.fill(arr[0]);
        return out;
      }
      for (let i = 0; i < targetLen; i++) {
        const t = (i / (targetLen - 1)) * (arr.length - 1);
        const low = Math.floor(t);
        const high = Math.min(arr.length - 1, low + 1);
        const frac = t - low;
        out[i] = arr[low] * (1 - frac) + arr[high] * frac;
      }
      return out;
    };

    const numBins = 64;
    const pEnv = resampleArray(pNorm, numBins);
    const rEnv = resampleArray(rNorm, numBins);

    // 1. Energy Envelope & Rhythm Match (50% weight):
    // Normalized correlation and Euclidean envelope similarity
    let dot = 0, pMag = 0, rMag = 0, sumDiff = 0;
    for (let i = 0; i < numBins; i++) {
      dot += pEnv[i] * rEnv[i];
      pMag += pEnv[i] * pEnv[i];
      rMag += rEnv[i] * rEnv[i];
      sumDiff += Math.abs(pEnv[i] - rEnv[i]);
    }
    const cosineSim = (pMag > 0 && rMag > 0) ? (dot / (Math.sqrt(pMag) * Math.sqrt(rMag))) : 0;
    const meanAbsDiff = sumDiff / numBins;
    const euclideanSim = Math.max(0, 1 - meanAbsDiff * 1.5);
    const rhythmScore = Math.max(0, Math.min(1.0, cosineSim * 0.6 + euclideanSim * 0.4));

    // 2. Duration & Silence Ratio (25% weight):
    // Penalize recordings where sound wasn't produced or silence dominates compared to target clip
    const pSilenceRatio = 1 - (pActiveCount / Math.max(1, pNumSlices));
    const rSilenceRatio = 1 - (rActiveCount / Math.max(1, rNumSlices));
    const silenceDiff = Math.abs(pSilenceRatio - rSilenceRatio);
    const silenceScore = Math.max(0, 1 - silenceDiff * 2.0);

    const pDuration = playerBuffer.duration;
    const rDuration = refBuffer.duration;
    const durRatio = Math.min(pDuration, rDuration) / Math.max(pDuration, rDuration, 0.1);
    const durScore = Math.max(0, durRatio);
    const durationScore = Math.max(0, Math.min(1.0, silenceScore * 0.6 + durScore * 0.4));

    // 3. Spectral Centroid / Frequency Tone Match (25% weight):
    // Pure Radix-2 Cooley-Tukey FFT spectral centroid implementation
    const pAvgCentroid = this._computeAverageSpectralCentroid(pData, pRms, pSliceSize, pSampleRate);
    const rAvgCentroid = this._computeAverageSpectralCentroid(rData, rRms, rSliceSize, rSampleRate);

    let spectralScore = 0.5; // neutral baseline if unpitched
    if (pAvgCentroid > 0 && rAvgCentroid > 0) {
      const octaveDiff = Math.abs(Math.log2(pAvgCentroid / rAvgCentroid));
      spectralScore = Math.max(0, Math.min(1.0, 1 - octaveDiff * 0.5));
    }

    // Final Deterministic 0-100 Score Formula:
    // Final Score = Math.round((rhythmScore * 0.5 + durationScore * 0.25 + spectralScore * 0.25) * 100)
    const rawScore = (rhythmScore * 0.5) + (durationScore * 0.25) + (spectralScore * 0.25);
    const finalScore = Math.max(0, Math.min(100, Math.round(rawScore * 100)));

    const timingMatch = Math.max(0, Math.min(100, Math.round((rhythmScore * 0.65 + durationScore * 0.35) * 100)));
    const toneMatch = Math.max(0, Math.min(100, Math.round(spectralScore * 100)));

    return {
      totalScore: finalScore,
      timingMatch,
      toneMatch,
      rhythmScore: Math.round(rhythmScore * 100),
      durationScore: Math.round(durationScore * 100),
      spectralScore: Math.round(spectralScore * 100)
    };
  }

  // Fast offline spectral centroid over active frames
  _computeAverageSpectralCentroid(samples, rmsArray, sliceSize, sampleRate) {
    const fftSize = 512;
    const real = new Float32Array(fftSize);
    const imag = new Float32Array(fftSize);
    let centroidSum = 0;
    let count = 0;

    for (let s = 0; s < rmsArray.length; s++) {
      if (rmsArray[s] < 0.02) continue;
      const startIdx = s * sliceSize;
      if (startIdx + fftSize > samples.length) break;

      // Hann window
      for (let i = 0; i < fftSize; i++) {
        const val = samples[startIdx + i] || 0;
        const w = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (fftSize - 1)));
        real[i] = val * w;
        imag[i] = 0;
      }

      this._radix2Fft(real, imag);

      const numBins = fftSize / 2;
      const binWidth = sampleRate / fftSize;
      let weightedSum = 0;
      let totalMag = 0;

      for (let k = 1; k < numBins; k++) {
        const mag = Math.sqrt(real[k] * real[k] + imag[k] * imag[k]);
        weightedSum += (k * binWidth) * mag;
        totalMag += mag;
      }

      if (totalMag > 1e-5) {
        centroidSum += (weightedSum / totalMag);
        count++;
      }
    }

    return count > 0 ? (centroidSum / count) : 0;
  }

  _radix2Fft(real, imag) {
    const n = real.length;
    let j = 0;
    for (let i = 0; i < n - 1; i++) {
      if (i < j) {
        const tr = real[i]; real[i] = real[j]; real[j] = tr;
        const ti = imag[i]; imag[i] = imag[j]; imag[j] = ti;
      }
      let k = n >> 1;
      while (k <= j) {
        j -= k;
        k >>= 1;
      }
      j += k;
    }

    for (let len = 2; len <= n; len <<= 1) {
      const half = len >> 1;
      const angle = (-2 * Math.PI) / len;
      const wStepR = Math.cos(angle);
      const wStepI = Math.sin(angle);

      for (let i = 0; i < n; i += len) {
        let wr = 1;
        let wi = 0;
        for (let k = 0; k < half; k++) {
          const uR = real[i + k];
          const uI = imag[i + k];
          const vR = real[i + k + half] * wr - imag[i + k + half] * wi;
          const vI = real[i + k + half] * wi + imag[i + k + half] * wr;

          real[i + k] = uR + vR;
          imag[i + k] = uI + vI;
          real[i + k + half] = uR - vR;
          imag[i + k + half] = uI - vI;

          const nextWr = wr * wStepR - wi * wStepI;
          wi = wr * wStepI + wi * wStepR;
          wr = nextWr;
        }
      }
    }
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
