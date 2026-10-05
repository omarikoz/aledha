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

  // Request Microphone permissions & return stream
  async initMic() {
    if (this.micStream && this.micStream.active) {
      return this.micStream;
    }
    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: true
        }
      });
      return this.micStream;
    } catch (err) {
      console.error('Mic access error:', err);
      throw new Error('Please allow microphone access to play Aledha!');
    }
  }

  // Setup AnalyserNode for real-time visualizer
  setupAnalyser(stream) {
    const ctx = this.getAudioContext();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.75;
    source.connect(analyser);
    this.analyser = analyser;
    return analyser;
  }

  // Record audio for durationMs with live volume callbacks using direct Web Audio PCM
  recordAudio(durationMs, onVolumeUpdate) {
    return new Promise(async (resolve, reject) => {
      try {
        const stream = await this.initMic();
        const ctx = this.getAudioContext();
        if (ctx.state === 'suspended') {
          await ctx.resume();
        }

        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.5;
        source.connect(analyser);
        this.analyser = analyser;

        let isRecording = true;
        const pcmChunks = [];
        const bufferSize = 4096;

        // ScriptProcessorNode captures raw Float32 PCM samples directly from the microphone
        const scriptNode = ctx.createScriptProcessor ? ctx.createScriptProcessor(bufferSize, 1, 1) : null;
        const silentGain = ctx.createGain();
        silentGain.gain.setValueAtTime(0, ctx.currentTime);

        if (scriptNode) {
          scriptNode.onaudioprocess = (e) => {
            if (!isRecording) return;
            const input = e.inputBuffer.getChannelData(0);
            pcmChunks.push(new Float32Array(input));
          };
          source.connect(scriptNode);
          scriptNode.connect(silentGain);
          silentGain.connect(ctx.destination);
        }

        // Parallel MediaRecorder as safety backup
        let mediaRecorder = null;
        const mrChunks = [];
        try {
          const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
            ? 'audio/webm;codecs=opus'
            : 'audio/webm';
          mediaRecorder = new MediaRecorder(stream, { mimeType });
          mediaRecorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) mrChunks.push(e.data);
          };
          mediaRecorder.start(50);
        } catch (mrErr) {
          console.warn('MediaRecorder init fallback:', mrErr);
        }

        // Live real-time volume analysis loop
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const volumeCheckInterval = setInterval(() => {
          if (!isRecording) return;
          analyser.getByteTimeDomainData(dataArray);
          let sumSquares = 0;
          for (let i = 0; i < dataArray.length; i++) {
            const normalized = (dataArray[i] - 128) / 128;
            sumSquares += normalized * normalized;
          }
          const rms = Math.sqrt(sumSquares / dataArray.length);
          if (onVolumeUpdate) {
            onVolumeUpdate(Math.min(1, rms * 4.0));
          }
        }, 30);

        // Finalize function called when recording time ends
        const finalizeRecording = async () => {
          if (!isRecording) return;
          isRecording = false;
          clearInterval(volumeCheckInterval);

          if (mediaRecorder && mediaRecorder.state === 'recording') {
            try {
              mediaRecorder.requestData();
              mediaRecorder.stop();
            } catch (e) {}
          }

          if (scriptNode) {
            try {
              source.disconnect(scriptNode);
              scriptNode.disconnect(silentGain);
              silentGain.disconnect(ctx.destination);
            } catch (e) {}
          }

          // 1. Preferred Route: Raw PCM Float32 samples collected directly from microphone
          if (pcmChunks.length > 0) {
            const totalSamples = pcmChunks.reduce((acc, c) => acc + c.length, 0);
            const mergedFloat32 = new Float32Array(totalSamples);
            let offset = 0;
            for (const chunk of pcmChunks) {
              mergedFloat32.set(chunk, offset);
              offset += chunk.length;
            }

            const sampleRate = ctx.sampleRate || 44100;
            const audioBuffer = ctx.createBuffer(1, totalSamples, sampleRate);
            audioBuffer.copyToChannel(mergedFloat32, 0);

            // Convert to 100% compliant, standard 16-bit PCM WAV Blob
            const wavBlob = this.float32ToWav(mergedFloat32, sampleRate);
            const dataUrl = await this.blobToDataUrl(wavBlob);

            resolve({
              blob: wavBlob,
              dataUrl,
              audioBuffer,
              duration: totalSamples / sampleRate
            });
            return;
          }

          // 2. Fallback Route: MediaRecorder Blob
          if (mrChunks.length > 0) {
            const rawBlob = new Blob(mrChunks, { type: 'audio/webm' });
            const dataUrl = await this.blobToDataUrl(rawBlob);
            resolve({
              blob: rawBlob,
              dataUrl,
              audioBuffer: null,
              duration: durationMs / 1000
            });
            return;
          }

          // 3. Empty fallback
          resolve({
            blob: null,
            dataUrl: null,
            audioBuffer: null,
            duration: 0
          });
        };

        setTimeout(() => {
          finalizeRecording();
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

  // Pre-processing: mono, silence trimming, downsampling & peak normalization
  preprocessAudio(audioBuffer, targetSampleRate = 22050) {
    if (!audioBuffer) return new Float32Array(0);

    const numChannels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length;
    const sampleRate = audioBuffer.sampleRate;

    // Mixdown to mono
    const mono = new Float32Array(length);
    for (let c = 0; c < numChannels; c++) {
      const channelData = audioBuffer.getChannelData(c);
      for (let i = 0; i < length; i++) {
        mono[i] += channelData[i] / numChannels;
      }
    }

    // Downsample if needed
    let resampled = mono;
    if (sampleRate !== targetSampleRate) {
      const ratio = sampleRate / targetSampleRate;
      const newLen = Math.floor(length / ratio);
      resampled = new Float32Array(newLen);
      for (let i = 0; i < newLen; i++) {
        const origIndex = Math.floor(i * ratio);
        resampled[i] = mono[origIndex];
      }
    }

    // Peak normalization
    let peak = 0;
    for (let i = 0; i < resampled.length; i++) {
      const absVal = Math.abs(resampled[i]);
      if (absVal > peak) peak = absVal;
    }
    if (peak > 0.001) {
      const scale = 0.95 / peak;
      for (let i = 0; i < resampled.length; i++) {
        resampled[i] *= scale;
      }
    }

    // Silence trimming (Threshold at 2% peak amplitude)
    const threshold = 0.02;
    let startIdx = 0;
    while (startIdx < resampled.length && Math.abs(resampled[startIdx]) < threshold) {
      startIdx++;
    }

    let endIdx = resampled.length - 1;
    while (endIdx > startIdx && Math.abs(resampled[endIdx]) < threshold) {
      endIdx--;
    }

    if (endIdx > startIdx) {
      return resampled.slice(startIdx, endIdx + 1);
    }
    return resampled;
  }

  // Extract Acoustic Features: RMS Energy Envelope, Spectral Centroid, Spectral Flatness
  extractFeatures(samples, sampleRate = 22050) {
    if (!samples || samples.length === 0) {
      return {
        rmsEnvelope: [0],
        spectralCentroids: [0],
        spectralFlatness: [0],
        avgFlatness: 0
      };
    }

    const frameSize = 1024;
    const hopSize = 512;
    const numFrames = Math.max(1, Math.floor((samples.length - frameSize) / hopSize) + 1);

    const rmsEnvelope = new Float32Array(numFrames);
    const spectralCentroids = new Float32Array(numFrames);
    const spectralFlatness = new Float32Array(numFrames);

    // Precompute Hann window
    const window = new Float32Array(frameSize);
    for (let i = 0; i < frameSize; i++) {
      window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (frameSize - 1)));
    }

    const halfSize = frameSize / 2;
    const freqBinWidth = (sampleRate / 2) / halfSize;

    for (let f = 0; f < numFrames; f++) {
      const start = f * hopSize;
      let sumSquares = 0;

      // Windowed frame
      const frame = new Float32Array(frameSize);
      for (let i = 0; i < frameSize; i++) {
        const val = (start + i < samples.length) ? samples[start + i] : 0;
        frame[i] = val * window[i];
        sumSquares += val * val;
      }

      // 1. RMS Envelope
      rmsEnvelope[f] = Math.sqrt(sumSquares / frameSize);

      // 2. Magnitude Spectrum via DFT approximation (bins 1 to halfSize)
      // For fast real-time party execution without heavy WASM dependencies:
      let weightedFreqSum = 0;
      let totalMagnitude = 0;
      let logMagSum = 0;
      let powerSum = 0;
      const binsToExamine = Math.min(128, halfSize);

      for (let k = 1; k < binsToExamine; k++) {
        let real = 0;
        let imag = 0;
        const angleStep = (2 * Math.PI * k) / frameSize;
        // Step subsampling for speed while maintaining high fidelity
        for (let n = 0; n < frameSize; n += 2) {
          const angle = angleStep * n;
          real += frame[n] * Math.cos(angle);
          imag -= frame[n] * Math.sin(angle);
        }
        const mag = Math.sqrt(real * real + imag * imag);
        const power = (mag * mag) + 1e-12;
        const freq = k * freqBinWidth;

        weightedFreqSum += freq * mag;
        totalMagnitude += mag;
        logMagSum += Math.log(power);
        powerSum += power;
      }

      // Spectral Centroid (pitch brightness / frequency profile)
      spectralCentroids[f] = totalMagnitude > 0 ? (weightedFreqSum / totalMagnitude) : 0;

      // Spectral Flatness (geometric mean / arithmetic mean)
      const numBins = binsToExamine - 1;
      const geometricMean = Math.exp(logMagSum / numBins);
      const arithmeticMean = powerSum / numBins;
      spectralFlatness[f] = arithmeticMean > 0 ? (geometricMean / arithmeticMean) : 0;
    }

    // Normalize RMS envelope to 0..1
    let maxRms = 0;
    for (let i = 0; i < rmsEnvelope.length; i++) {
      if (rmsEnvelope[i] > maxRms) maxRms = rmsEnvelope[i];
    }
    if (maxRms > 0) {
      for (let i = 0; i < rmsEnvelope.length; i++) {
        rmsEnvelope[i] /= maxRms;
      }
    }

    // Average flatness
    let sumFlatness = 0;
    for (let i = 0; i < spectralFlatness.length; i++) sumFlatness += spectralFlatness[i];
    const avgFlatness = sumFlatness / spectralFlatness.length;

    return {
      rmsEnvelope,
      spectralCentroids,
      spectralFlatness,
      avgFlatness
    };
  }

  // Dynamic Time Warping (DTW) distance between two 1D feature arrays
  computeDtwDistance(seqA, seqB) {
    const lenA = seqA.length;
    const lenB = seqB.length;
    if (lenA === 0 || lenB === 0) return 1.0;

    // Resample seqA and seqB to uniform length (e.g. 50 points) for consistent alignment
    const targetLen = 50;
    const normA = this.resample1D(seqA, targetLen);
    const normB = this.resample1D(seqB, targetLen);

    // DTW cost matrix
    const dtw = Array.from({ length: targetLen + 1 }, () => new Float32Array(targetLen + 1).fill(Infinity));
    dtw[0][0] = 0;

    for (let i = 1; i <= targetLen; i++) {
      for (let j = 1; j <= targetLen; j++) {
        const cost = Math.abs(normA[i - 1] - normB[j - 1]);
        dtw[i][j] = cost + Math.min(
          dtw[i - 1][j],     // insertion
          dtw[i][j - 1],     // deletion
          dtw[i - 1][j - 1]  // match
        );
      }
    }

    const totalCost = dtw[targetLen][targetLen];
    return totalCost / (2 * targetLen);
  }

  resample1D(arr, targetLen) {
    const res = new Float32Array(targetLen);
    if (arr.length === 0) return res;
    if (arr.length === 1) return res.fill(arr[0]);

    for (let i = 0; i < targetLen; i++) {
      const idx = (i / (targetLen - 1)) * (arr.length - 1);
      const low = Math.floor(idx);
      const high = Math.min(arr.length - 1, low + 1);
      const frac = idx - low;
      res[i] = arr[low] * (1 - frac) + arr[high] * frac;
    }
    return res;
  }

  // Full Comparison Engine: Returns Score (0-100), sub-scores, and Egyptian comedic tier
  scoreRecording(userAudioBuffer, refAudioBuffer) {
    if (!userAudioBuffer || userAudioBuffer.length === 0) {
      return {
        totalScore: 15,
        rhythmScore: 10,
        pitchScore: 15,
        energyScore: 20,
        tier: this.getEgyptianRatingTier(15)
      };
    }

    // 1. Preprocess both audio streams
    const userSamples = this.preprocessAudio(userAudioBuffer);
    const refSamples = this.preprocessAudio(refAudioBuffer);

    // 2. Extract Acoustic Features
    const userFeats = this.extractFeatures(userSamples);
    const refFeats = this.extractFeatures(refSamples);

    // 3. RMS / Rhythm Match (40% weight)
    const rmsDistance = this.computeDtwDistance(userFeats.rmsEnvelope, refFeats.rmsEnvelope);
    // Convert distance to similarity percentage
    const rhythmScore = Math.max(0, Math.min(100, Math.round((1 - Math.min(1, rmsDistance * 2.2)) * 100)));

    // 4. Pitch / Spectral Centroid Contour Match (40% weight)
    // Normalize centroid arrays
    const normUserCentroids = this.normalizeCentroids(userFeats.spectralCentroids);
    const normRefCentroids = this.normalizeCentroids(refFeats.spectralCentroids);
    const centroidDistance = this.computeDtwDistance(normUserCentroids, normRefCentroids);
    const pitchScore = Math.max(0, Math.min(100, Math.round((1 - Math.min(1, centroidDistance * 2.0)) * 100)));

    // 5. Spectral Flatness / Energy Match (20% weight)
    const flatnessDiff = Math.abs(userFeats.avgFlatness - refFeats.avgFlatness);
    const energyScore = Math.max(0, Math.min(100, Math.round((1 - Math.min(1, flatnessDiff * 3.0)) * 100)));

    // Weighted Overall Score
    let totalScore = Math.round((rhythmScore * 0.40) + (pitchScore * 0.40) + (energyScore * 0.20));
    // Apply a light party-friendly game boost curve (so players stay laughing and competitive)
    totalScore = Math.min(100, Math.max(12, Math.round(totalScore * 0.95 + 8)));

    const tier = this.getEgyptianRatingTier(totalScore);

    return {
      totalScore,
      rhythmScore,
      pitchScore,
      energyScore,
      tier
    };
  }

  normalizeCentroids(centroids) {
    let max = 0;
    for (let i = 0; i < centroids.length; i++) {
      if (centroids[i] > max) max = centroids[i];
    }
    const res = new Float32Array(centroids.length);
    if (max > 0) {
      for (let i = 0; i < centroids.length; i++) res[i] = centroids[i] / max;
    }
    return res;
  }

  // Egyptian Comedic Rating Tiers (English with Egyptian tags)
  getEgyptianRatingTier(score) {
    if (score >= 90) {
      return {
        badge: "Flawless Carbon Copy! 🔥",
        badgeAr: "نسخة طبق الأصل!",
        color: "#10B981", // Emerald
        reaction: "Bro is a walking foley artist! You matched the Egyptian sound with 100% precision!",
        soundTag: "legendary"
      };
    } else if (score >= 70) {
      return {
        badge: "Absolute Fire! 👌",
        badgeAr: "جامد فشخ!",
        color: "#3B82F6", // Blue
        reaction: "Incredible mimicry! You're just a tiny whisper away from the original recording.",
        soundTag: "great"
      };
    } else if (score >= 40) {
      return {
        badge: "Not bad, try again! 😂",
        badgeAr: "مش بطال، بس حاول تاني",
        color: "#F59E0B", // Amber
        reaction: "The spirit was there, but your vocal cords took an unexpected detour!",
        soundTag: "okay"
      };
    } else {
      return {
        badge: "What on earth was that?! 💀",
        badgeAr: "إيه ده يا فنان؟! ودني ولعت!",
        color: "#EF4444", // Red
        reaction: "My ears need immediate medical attention! That was more of a noise violation than mimicry!",
        soundTag: "fail"
      };
    }
  }

  // Stop recording and release mic
  stopMic() {
    if (this.micStream) {
      this.micStream.getTracks().forEach((track) => track.stop());
      this.micStream = null;
    }
    this.analyser = null;
  }
}

export const audioEngine = new AudioEngine();
