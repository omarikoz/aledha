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
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
  }

  // Request Microphone permissions & return stream (safe for iOS Safari & Android)
  async initMic() {
    if (this.micStream && this.micStream.active) {
      return this.micStream;
    }
    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      return this.micStream;
    } catch (err) {
      try {
        // Fallback for iOS / older browsers with basic constraints
        this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        return this.micStream;
      } catch (err2) {
        console.error('Mic access error:', err2);
        throw new Error('Please allow microphone access to play Aledha!');
      }
    }
  }

  // Setup AnalyserNode for real-time visualizer
  setupAnalyser(stream) {
    const ctx = this.getAudioContext();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.6;
    source.connect(analyser);
    this.analyser = analyser;
    return analyser;
  }

  // Record audio for durationMs: records raw PCM into universal WAV (100% iOS Safari & Android compatible)
  recordAudio(durationMs, onVolumeUpdate) {
    return new Promise(async (resolve, reject) => {
      try {
        const ctx = this.getAudioContext();
        if (ctx.state === 'suspended') {
          await ctx.resume().catch(() => {});
        }

        const stream = await this.initMic();

        // 1. Setup Analyser for visualizer waveform
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.5;
        source.connect(analyser);
        this.analyser = analyser;

        // 2. Setup ScriptProcessor for uncompressed PCM capture (guaranteed 100% playable on iPhone)
        const bufferSize = 4096;
        const processor = ctx.createScriptProcessor(bufferSize, 1, 1);
        const pcmChunks = [];
        let totalPcmSamples = 0;
        let isRecording = true;

        processor.onaudioprocess = (e) => {
          if (!isRecording) return;
          const input = e.inputBuffer.getChannelData(0);
          const copy = new Float32Array(input.length);
          copy.set(input);
          pcmChunks.push(copy);
          totalPcmSamples += input.length;

          // Real-time RMS for mic level bar
          let sumSquares = 0;
          for (let i = 0; i < input.length; i++) {
            sumSquares += input[i] * input[i];
          }
          const rms = Math.sqrt(sumSquares / input.length);
          if (onVolumeUpdate) {
            // Boost volume sensitivity for mobile phone mics
            onVolumeUpdate(Math.min(1.0, rms * 5.0));
          }
        };

        source.connect(processor);
        // Connect to dummy gain to ensure Chrome/Safari processes the audio thread
        const dummyGain = ctx.createGain();
        dummyGain.gain.value = 0;
        processor.connect(dummyGain);
        dummyGain.connect(ctx.destination);

        // 3. Optional MediaRecorder backup
        let mediaRecorder = null;
        const mrChunks = [];
        try {
          let mimeType = 'audio/webm';
          if (typeof MediaRecorder !== 'undefined') {
            if (MediaRecorder.isTypeSupported('audio/webm')) mimeType = 'audio/webm';
            else if (MediaRecorder.isTypeSupported('audio/mp4')) mimeType = 'audio/mp4';
            mediaRecorder = new MediaRecorder(stream, { mimeType });
            mediaRecorder.ondataavailable = (ev) => {
              if (ev.data && ev.data.size > 0) mrChunks.push(ev.data);
            };
            mediaRecorder.start();
          }
        } catch (mrErr) {
          console.warn('MediaRecorder not available or failed, using PCM recorder:', mrErr);
        }

        // Auto-stop after durationMs
        setTimeout(async () => {
          isRecording = false;

          try {
            if (mediaRecorder && mediaRecorder.state === 'recording') {
              mediaRecorder.stop();
            }
          } catch (e) {}

          // Disconnect audio graph nodes
          try {
            processor.disconnect();
            dummyGain.disconnect();
            source.disconnect();
          } catch (e) {}

          // Combine raw PCM float32 samples
          const mergedSamples = new Float32Array(totalPcmSamples);
          let offset = 0;
          for (let i = 0; i < pcmChunks.length; i++) {
            mergedSamples.set(pcmChunks[i], offset);
            offset += pcmChunks[i].length;
          }

          // Build AudioBuffer in memory (0% chance of decode failure!)
          const sampleRate = ctx.sampleRate || 44100;
          const audioBuffer = ctx.createBuffer(1, Math.max(1, mergedSamples.length), sampleRate);
          audioBuffer.getChannelData(0).set(mergedSamples);

          // Build universal WAV Blob & DataURL (100% playable on iOS Safari, Android, Chrome)
          const wavBlob = this.float32ToWav(mergedSamples, sampleRate);
          const recordedUrl = URL.createObjectURL(wavBlob);
          const dataUrl = await this.blobToDataUrl(wavBlob);

          resolve({
            blob: wavBlob,
            objectUrl: recordedUrl,
            recordedUrl,
            dataUrl,
            audioBuffer,
            duration: audioBuffer.duration
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

  // Detect vocal activity boundaries (sound onset and offset)
  detectSoundBounds(envelope) {
    if (!envelope || envelope.length === 0) {
      return { startRatio: 0, durationRatio: 0 };
    }
    const threshold = 0.04;
    let startIdx = 0;
    let endIdx = envelope.length - 1;

    for (let i = 0; i < envelope.length; i++) {
      if (envelope[i] >= threshold) {
        startIdx = i;
        break;
      }
    }
    for (let i = envelope.length - 1; i >= 0; i--) {
      if (envelope[i] >= threshold) {
        endIdx = i;
        break;
      }
    }
    const len = Math.max(1, envelope.length);
    return {
      startRatio: startIdx / len,
      durationRatio: Math.max(0.05, (endIdx - startIdx) / len)
    };
  }

  // Full Deterministic Comparison Engine: Returns Score (0-100), sub-scores, and clean Egyptian tier
  scoreRecording(userAudioBuffer, refAudioBuffer) {
    if (!userAudioBuffer || userAudioBuffer.length === 0) {
      return {
        totalScore: 10,
        rhythmScore: 10,
        pitchScore: 10,
        energyScore: 10,
        tier: this.getEgyptianRatingTier(10)
      };
    }

    // 1. Preprocess both audio streams
    const userSamples = this.preprocessAudio(userAudioBuffer);
    const refSamples = refAudioBuffer ? this.preprocessAudio(refAudioBuffer) : null;

    // Auto-gain normalize user samples for mobile phone microphone variance
    let maxAmp = 0;
    for (let i = 0; i < userSamples.length; i++) {
      const abs = Math.abs(userSamples[i]);
      if (abs > maxAmp) maxAmp = abs;
    }
    if (maxAmp > 0.003) {
      const gain = Math.min(25.0, 0.85 / maxAmp);
      for (let i = 0; i < userSamples.length; i++) {
        userSamples[i] *= gain;
      }
    }

    // 2. Extract Acoustic Features
    const userFeats = this.extractFeatures(userSamples);
    const refFeats = refSamples ? this.extractFeatures(refSamples) : null;

    // Check if user was completely silent or muted mic
    let maxUserRms = 0;
    for (let i = 0; i < userFeats.rmsEnvelope.length; i++) {
      if (userFeats.rmsEnvelope[i] > maxUserRms) maxUserRms = userFeats.rmsEnvelope[i];
    }

    if (maxUserRms < 0.004) {
      // User was completely silent
      return {
        totalScore: 12,
        rhythmScore: 10,
        pitchScore: 10,
        energyScore: 15,
        tier: this.getEgyptianRatingTier(12)
      };
    }

    let rhythmScore = 65;
    let timingScore = 60;
    let pitchScore = 60;

    if (refFeats) {
      // 1. Volume / Energy Profile (RMS) Match (40% weight)
      const rmsDistance = this.computeDtwDistance(userFeats.rmsEnvelope, refFeats.rmsEnvelope);
      rhythmScore = Math.max(0, Math.min(100, Math.round((1 - Math.min(1, rmsDistance * 2.0)) * 100)));

      // 2. Duration & Timing Match (30% weight)
      const userOnset = this.detectSoundBounds(userFeats.rmsEnvelope);
      const refOnset = this.detectSoundBounds(refFeats.rmsEnvelope);
      const onsetDiff = Math.abs(userOnset.startRatio - refOnset.startRatio);
      const durationDiff = Math.abs(userOnset.durationRatio - refOnset.durationRatio);
      const timingDist = (onsetDiff * 0.5) + (durationDiff * 0.5);
      timingScore = Math.max(0, Math.min(100, Math.round((1 - Math.min(1, timingDist * 2.2)) * 100)));

      // 3. Pitch / Spectral Centroid Frequency Match (30% weight)
      const normUserCentroids = this.normalizeCentroids(userFeats.spectralCentroids);
      const normRefCentroids = this.normalizeCentroids(refFeats.spectralCentroids);
      const centroidDistance = this.computeDtwDistance(normUserCentroids, normRefCentroids);
      pitchScore = Math.max(0, Math.min(100, Math.round((1 - Math.min(1, centroidDistance * 1.8)) * 100)));
    } else {
      rhythmScore = Math.min(90, Math.max(35, Math.round(maxUserRms * 160)));
      timingScore = 60;
      pitchScore = 65;
    }

    // Weighted Overall Score (Deterministic between 0 and 100)
    let totalScore = Math.round((rhythmScore * 0.40) + (timingScore * 0.30) + (pitchScore * 0.30));
    totalScore = Math.max(5, Math.min(98, totalScore));

    const tier = this.getEgyptianRatingTier(totalScore);

    return {
      totalScore,
      rhythmScore,
      pitchScore,
      energyScore: timingScore,
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

  // Clean, lighthearted Egyptian party rating tiers (0-100)
  getEgyptianRatingTier(score) {
    if (score >= 90) {
      return {
        badge: "عالمي! جابها في الجون 🔥",
        badgeEn: "World-Class! Hit the Target! 🔥",
        color: "#10B981", // Emerald
        reaction: "عالمي! جابها في الجون بالمللي أداء محترفين 🔥",
        soundTag: "legendary"
      };
    } else if (score >= 75) {
      return {
        badge: "رايق أوي! قريب فشخ 👌",
        badgeEn: "Super Smooth! Incredibly Close! 👌",
        color: "#3B82F6", // Blue
        reaction: "رايق أوي! قريب فشخ من الصوت الأصلي 👌",
        soundTag: "great"
      };
    } else if (score >= 50) {
      return {
        badge: "مش بطال، سامع المحاولة 👏",
        badgeEn: "Not Bad, We Hear The Effort! 👏",
        color: "#F59E0B", // Amber
        reaction: "مش بطال، سامع المحاولة والروح كانت عالية 👏",
        soundTag: "okay"
      };
    } else if (score >= 25) {
      return {
        badge: "محتاجة شوية تظبيط بس ضحكتنا 😂",
        badgeEn: "Needs A Little Tuning, But Great Laughs! 😂",
        color: "#FB923C", // Orange
        reaction: "محتاجة شوية تظبيط بس ضحكتنا وملت الجو بهجة 😂",
        soundTag: "funny"
      };
    } else {
      return {
        badge: "المهم المشاركة والروح الرياضية! 🤝",
        badgeEn: "Good Sportsmanship! 🤝",
        color: "#64748B", // Slate
        reaction: "المهم المشاركة والروح الرياضية والضحكة الحلوة! 🤝",
        soundTag: "sportsmanship"
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
