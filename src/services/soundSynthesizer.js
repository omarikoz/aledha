// Web Audio API Procedural Synthesizer for Authentic Egyptian Sounds
// Allows instant playability out-of-the-box + fallback when MP3 is absent

import { audioEngine } from './audioEngine.js';

// Resolve sound file URL taking into account Vite base path (e.g. GitHub Pages /aledha/)
export function resolveSoundUrl(filePath) {
  if (!filePath) return '';
  if (
    filePath.startsWith('http://') ||
    filePath.startsWith('https://') ||
    filePath.startsWith('blob:') ||
    filePath.startsWith('data:')
  ) {
    return filePath;
  }
  const cleanPath = filePath.startsWith('/') ? filePath.slice(1) : filePath;
  const base = import.meta.env.BASE_URL || './';
  const prefix = base.endsWith('/') ? base : `${base}/`;
  return `${prefix}${cleanPath}`;
}

class SoundSynthesizer {
  constructor() {
    this.currentSourceNodes = [];
  }

  stopAll() {
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
        this.currentAudio.src = '';
        this.currentAudio.load();
      } catch (e) {}
      this.currentAudio = null;
    }
    if (this.targetSafetyTimeout) {
      clearTimeout(this.targetSafetyTimeout);
      this.targetSafetyTimeout = null;
    }
    this.currentSourceNodes.forEach(node => {
      try {
        if (node.stop) node.stop();
        if (node.disconnect) node.disconnect();
      } catch (e) {}
    });
    this.currentSourceNodes = [];
  }

  // Play real audio meme file (strictly real MP3, never synthetic oscillator beeps)
  async playTargetSound(soundItem, onEnded) {
    this.stopAll();
    if (!soundItem) {
      if (onEnded) onEnded();
      return;
    }

    const maxDurationSec = Math.min(6.0, Math.max(1.5, soundItem?.duration || 3.5));
    const ctx = audioEngine.getAudioContext();
    if (ctx.state === 'suspended') {
      await ctx.resume().catch(() => {});
    }

    // Priority 1: Play decoded AudioBuffer directly via Web Audio API (never blocked by iOS autoplay!)
    try {
      const buffer = await this.getReferenceAudioBuffer(soundItem);
      if (buffer) {
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        const gainNode = ctx.createGain();
        gainNode.gain.setValueAtTime(1.0, ctx.currentTime);
        source.connect(gainNode);
        gainNode.connect(ctx.destination);
        this.currentSourceNodes.push(source, gainNode);

        let ended = false;
        const finish = () => {
          if (ended) return;
          ended = true;
          if (this.targetSafetyTimeout) clearTimeout(this.targetSafetyTimeout);
          if (onEnded) onEnded();
        };

        source.onended = finish;
        source.start(0);

        this.targetSafetyTimeout = setTimeout(() => {
          finish();
          try { source.stop(); } catch (e) {}
        }, maxDurationSec * 1000);

        return { type: 'web_audio', source };
      }
    } catch (e) {
      console.warn('Web Audio buffer playback error, trying HTML5 Audio:', e);
    }

    // Priority 2: Fallback to HTML5 Audio element with real sound file
    if (soundItem?.file) {
      try {
        const soundUrl = resolveSoundUrl(soundItem.file);
        const audio = new Audio(soundUrl);
        audio.volume = 1.0;
        this.currentAudio = audio;

        let hasFinished = false;
        const handleEnd = () => {
          if (hasFinished) return;
          hasFinished = true;
          if (this.targetSafetyTimeout) clearTimeout(this.targetSafetyTimeout);
          this.currentAudio = null;
          if (onEnded) onEnded();
        };

        audio.onended = handleEnd;
        audio.onerror = handleEnd;

        this.targetSafetyTimeout = setTimeout(() => {
          if (!hasFinished && this.currentAudio === audio) {
            handleEnd();
            try { audio.pause(); } catch (e) {}
          }
        }, maxDurationSec * 1000);

        await audio.play();
        return { type: 'file', audio };
      } catch (e) {
        console.warn('Audio play error:', e);
        if (onEnded) onEnded();
      }
    } else {
      if (onEnded) onEnded();
    }
  }

  // Load real audio buffer for acoustic scoring reference
  async getReferenceAudioBuffer(soundItem) {
    if (!soundItem?.file) return null;
    if (this.bufferCache && this.bufferCache.has(soundItem.id)) {
      return this.bufferCache.get(soundItem.id);
    }

    const ctx = audioEngine.getAudioContext();
    try {
      const soundUrl = resolveSoundUrl(soundItem.file);
      const resp = await fetch(soundUrl);
      if (resp.ok) {
        const arrayBuf = await resp.arrayBuffer();
        const decoded = await new Promise((resolve) => {
          ctx.decodeAudioData(
            arrayBuf.slice(0),
            (buf) => resolve(buf),
            (err) => {
              console.warn('decodeAudioData error:', err);
              resolve(null);
            }
          );
        });
        if (decoded) {
          if (!this.bufferCache) this.bufferCache = new Map();
          this.bufferCache.set(soundItem.id, decoded);
        }
        return decoded;
      }
    } catch (e) {
      console.warn('Error loading reference audio buffer for:', soundItem.file, e);
    }
    return null;
  }

  // Build audio graph on given context (real-time or offline)
  buildSynthGraph(ctx, synthType, duration) {
    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.85, now);
    masterGain.connect(ctx.destination);

    switch (synthType) {
      case 'toktok':
        this.buildToktok(ctx, masterGain, now, duration);
        break;
      case 'cat':
        this.buildCat(ctx, masterGain, now, duration);
        break;
      case 'microbus_horn':
        this.buildMicrobusHorn(ctx, masterGain, now, duration);
        break;
      case 'vendor_fino':
        this.buildVendorFino(ctx, masterGain, now, duration);
        break;
      case 'spoon_clink':
        this.buildSpoonClink(ctx, masterGain, now, duration);
        break;
      case 'shaabi_synth':
        this.buildShaabiSynth(ctx, masterGain, now, duration);
        break;
      case 'duck':
        this.buildDuck(ctx, masterGain, now, duration);
        break;
      case 'siren':
        this.buildSiren(ctx, masterGain, now, duration);
        break;
      case 'mosquito':
        this.buildMosquito(ctx, masterGain, now, duration);
        break;
      case 'saw':
        this.buildSaw(ctx, masterGain, now, duration);
        break;
      default:
        this.buildToktok(ctx, masterGain, now, duration);
    }
  }

  synthesizeSound(synthType, duration, onEnded) {
    const ctx = audioEngine.getAudioContext();
    this.buildSynthGraph(ctx, synthType, duration);
    if (onEnded) {
      setTimeout(onEnded, duration * 1000);
    }
  }

  // 1. Toktok Sputter & Rev (توك توك بيكركر)
  buildToktok(ctx, dest, now, duration) {
    const osc = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(55, now);
    // Rev motor at end
    osc.frequency.exponentialRampToValueAtTime(110, now + duration * 0.7);
    osc.frequency.linearRampToValueAtTime(60, now + duration);

    // Motor sputtering LFO
    lfo.type = 'square';
    lfo.frequency.setValueAtTime(14, now);
    lfo.frequency.linearRampToValueAtTime(22, now + duration * 0.7);
    lfoGain.gain.setValueAtTime(0.5, now);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(450, now);
    filter.frequency.linearRampToValueAtTime(900, now + duration * 0.7);

    gain.gain.setValueAtTime(0.1, now);
    gain.gain.linearRampToValueAtTime(0.9, now + 0.1);
    gain.gain.setValueAtTime(0.8, now + duration - 0.2);
    gain.gain.linearRampToValueAtTime(0.01, now + duration);

    lfo.connect(gain.gain);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    osc.start(now);
    lfo.start(now);
    osc.stop(now + duration);
    lfo.stop(now + duration);
    this.currentSourceNodes.push(osc, lfo);
  }

  // 2. Street Cat 3 AM Meow (قطة الشارع الفجرية)
  buildCat(ctx, dest, now, duration) {
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    // Dramatic pitch bend: 480Hz -> 820Hz -> 320Hz
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(840, now + duration * 0.45);
    osc.frequency.exponentialRampToValueAtTime(320, now + duration);

    // Formant vowel simulation
    filter.type = 'bandpass';
    filter.Q.setValueAtTime(4.0, now);
    filter.frequency.setValueAtTime(900, now);
    filter.frequency.linearRampToValueAtTime(1800, now + duration * 0.4);
    filter.frequency.linearRampToValueAtTime(600, now + duration);

    gain.gain.setValueAtTime(0.01, now);
    gain.gain.exponentialRampToValueAtTime(0.85, now + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    osc.start(now);
    osc.stop(now + duration);
    this.currentSourceNodes.push(osc);
  }

  // 3. Iconic Cairo Microbus Horn Rhythm (كلاكس ميكروباص)
  buildMicrobusHorn(ctx, dest, now, duration) {
    // Pattern: [0s: 0.15s], [0.25s: 0.15s], [0.55s: 0.4s], [1.1s: 0.15s], [1.35s: 0.6s]
    const beats = [
      { start: 0.0, dur: 0.16 },
      { start: 0.22, dur: 0.16 },
      { start: 0.48, dur: 0.42 },
      { start: 1.05, dur: 0.18 },
      { start: 1.35, dur: 0.55 }
    ];

    beats.forEach(b => {
      if (b.start + b.dur <= duration) {
        // Dual tone standard Egyptian microbus horn (420Hz & 510Hz)
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = 'square';
        osc1.frequency.setValueAtTime(415, now + b.start);
        osc2.type = 'sawtooth';
        osc2.frequency.setValueAtTime(520, now + b.start);

        gain.gain.setValueAtTime(0.0, now + b.start);
        gain.gain.linearRampToValueAtTime(0.65, now + b.start + 0.02);
        gain.gain.setValueAtTime(0.6, now + b.start + b.dur - 0.02);
        gain.gain.linearRampToValueAtTime(0.01, now + b.start + b.dur);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(dest);

        osc1.start(now + b.start);
        osc2.start(now + b.start);
        osc1.stop(now + b.start + b.dur);
        osc2.stop(now + b.start + b.dur);
        this.currentSourceNodes.push(osc1, osc2);
      }
    });
  }

  // 4. Street Vendor Chant (بتاع الفينو)
  buildVendorFino(ctx, dest, now, duration) {
    const osc = ctx.createOscillator();
    const vibrato = ctx.createOscillator();
    const vibGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    // Chant: "Yaaa" (330Hz) -> "Feeee" (440Hz) -> "Noooo" (290Hz)
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.linearRampToValueAtTime(360, now + 0.8);
    osc.frequency.setValueAtTime(440, now + 1.0);
    osc.frequency.linearRampToValueAtTime(430, now + 2.2);
    osc.frequency.exponentialRampToValueAtTime(280, now + duration);

    // Natural human vibrato
    vibrato.frequency.setValueAtTime(5.5, now);
    vibGain.gain.setValueAtTime(8, now);
    vibrato.connect(osc.frequency);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1100, now);
    filter.Q.setValueAtTime(2.5, now);

    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.85, now + 0.2);
    gain.gain.setValueAtTime(0.7, now + duration - 0.3);
    gain.gain.linearRampToValueAtTime(0.01, now + duration);

    vibrato.start(now);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    osc.start(now);
    osc.stop(now + duration);
    vibrato.stop(now + duration);
    this.currentSourceNodes.push(osc, vibrato);
  }

  // 5. Ahwa Tea Spoon Clink (تكتكة معلقة شاي القهوجي)
  buildSpoonClink(ctx, dest, now, duration) {
    const clinks = [0.1, 0.3, 0.45, 0.6, 0.72, 0.85, 0.96, 1.1, 1.25, 1.45, 1.7, 2.0];
    clinks.forEach(offset => {
      if (offset < duration) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        // High metallic glass chime
        osc.frequency.setValueAtTime(2600 + Math.random() * 300, now + offset);

        gain.gain.setValueAtTime(0.7, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.08);

        osc.connect(gain);
        gain.connect(dest);

        osc.start(now + offset);
        osc.stop(now + offset + 0.09);
        this.currentSourceNodes.push(osc);
      }
    });
  }

  // 6. Shaabi Electro Synth Riff (تفريد أورج شعبي)
  buildShaabiSynth(ctx, dest, now, duration) {
    // Shaabi quarter-tone scale sequence
    const notes = [
      { time: 0.0, freq: 523.25, dur: 0.2 }, // C5
      { time: 0.22, freq: 587.33, dur: 0.15 }, // D5
      { time: 0.40, freq: 635.0, dur: 0.25 }, // E-half-flat (Bayati)
      { time: 0.70, freq: 587.33, dur: 0.2 },
      { time: 0.95, freq: 698.46, dur: 0.3 }, // F5
      { time: 1.30, freq: 635.0, dur: 0.2 },
      { time: 1.55, freq: 587.33, dur: 0.2 },
      { time: 1.80, freq: 523.25, dur: 0.5 }, // C5 sustain with trill
      { time: 2.35, freq: 523.25, dur: 0.4 }
    ];

    notes.forEach(n => {
      if (n.time + n.dur <= duration) {
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(n.freq, now + n.time);
        // Shaabi pitch bend at start of note
        osc.frequency.linearRampToValueAtTime(n.freq * 1.03, now + n.time + n.dur * 0.5);
        osc.frequency.linearRampToValueAtTime(n.freq, now + n.time + n.dur);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2400, now + n.time);

        gain.gain.setValueAtTime(0.01, now + n.time);
        gain.gain.linearRampToValueAtTime(0.65, now + n.time + 0.02);
        gain.gain.setValueAtTime(0.55, now + n.time + n.dur - 0.02);
        gain.gain.linearRampToValueAtTime(0.01, now + n.time + n.dur);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(dest);

        osc.start(now + n.time);
        osc.stop(now + n.time + n.dur);
        this.currentSourceNodes.push(osc);
      }
    });
  }

  // 7. Duck Quacking (بطة بلدي)
  buildDuck(ctx, dest, now, duration) {
    const quacks = [
      { start: 0.1, dur: 0.35, freq: 280 },
      { start: 0.6, dur: 0.4, freq: 310 },
      { start: 1.15, dur: 0.35, freq: 270 },
      { start: 1.65, dur: 0.5, freq: 250 }
    ];

    quacks.forEach(q => {
      if (q.start + q.dur <= duration) {
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(q.freq, now + q.start);
        osc.frequency.exponentialRampToValueAtTime(q.freq * 0.75, now + q.start + q.dur);

        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(750, now + q.start);
        filter.Q.setValueAtTime(4.0, now + q.start);

        gain.gain.setValueAtTime(0.01, now + q.start);
        gain.gain.linearRampToValueAtTime(0.8, now + q.start + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, now + q.start + q.dur);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(dest);

        osc.start(now + q.start);
        osc.stop(now + q.start + q.dur);
        this.currentSourceNodes.push(osc);
      }
    });
  }

  // 8. Ambulance Siren (سرينة إسعاف)
  buildSiren(ctx, dest, now, duration) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';

    const halfPeriod = 0.5;
    const cycles = Math.floor(duration / (halfPeriod * 2));
    for (let i = 0; i <= cycles * 2; i++) {
      const t = now + i * halfPeriod;
      if (t < now + duration) {
        const freq = (i % 2 === 0) ? 960 : 720;
        osc.frequency.setValueAtTime(freq, t);
      }
    }

    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.65, now + 0.1);
    gain.gain.setValueAtTime(0.6, now + duration - 0.2);
    gain.gain.linearRampToValueAtTime(0.01, now + duration);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(now);
    osc.stop(now + duration);
    this.currentSourceNodes.push(osc);
  }

  // 9. Mosquito Buzzing (ناموسة)
  buildMosquito(ctx, dest, now, duration) {
    const osc = ctx.createOscillator();
    const jitter = ctx.createOscillator();
    const jitterGain = ctx.createGain();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(780, now);
    osc.frequency.linearRampToValueAtTime(840, now + duration * 0.5);
    osc.frequency.linearRampToValueAtTime(760, now + duration);

    jitter.frequency.setValueAtTime(18, now);
    jitterGain.gain.setValueAtTime(25, now);
    jitter.connect(osc.frequency);

    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.4, now + 0.2);
    gain.gain.linearRampToValueAtTime(0.01, now + duration);

    jitter.start(now);
    osc.connect(gain);
    gain.connect(dest);

    osc.start(now);
    osc.stop(now + duration);
    jitter.stop(now + duration);
    this.currentSourceNodes.push(osc, jitter);
  }

  // 10. Carpenter Saw (منشار خشب)
  buildSaw(ctx, dest, now, duration) {
    const bufferSize = ctx.sampleRate * 0.1;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const strokes = Math.floor(duration / 0.45);
    for (let s = 0; s < strokes; s++) {
      const strokeTime = now + s * 0.45;
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;
      noise.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1400, strokeTime);
      filter.Q.setValueAtTime(5.0, strokeTime);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.01, strokeTime);
      gain.gain.linearRampToValueAtTime(0.8, strokeTime + 0.1);
      gain.gain.linearRampToValueAtTime(0.01, strokeTime + 0.38);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(dest);

      noise.start(strokeTime);
      noise.stop(strokeTime + 0.4);
      this.currentSourceNodes.push(noise);
    }
  }

  // Arcade UI Sound Effects (Beeps, Clicks, Claps)
  playUiSound(name) {
    const ctx = audioEngine.getAudioContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (name === 'click') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.05);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.06);
    } else if (name === 'tick') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(600, now);
      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.09);
    } else if (name === 'go') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(587, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.3);
      gain.gain.setValueAtTime(0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.36);
    } else if (name === 'fanfare') {
      const chords = [523.25, 659.25, 783.99, 1046.50];
      chords.forEach((freq, idx) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'triangle';
        o.frequency.setValueAtTime(freq, now + idx * 0.08);
        g.gain.setValueAtTime(0.25, now + idx * 0.08);
        g.gain.exponentialRampToValueAtTime(0.01, now + 1.2);
        o.connect(g);
        g.connect(ctx.destination);
        o.start(now + idx * 0.08);
        o.stop(now + 1.3);
      });
    }
  }
}

export const soundSynthesizer = new SoundSynthesizer();
