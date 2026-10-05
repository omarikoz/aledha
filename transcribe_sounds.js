import fs from 'fs';
import path from 'path';
import { pipeline } from '@xenova/transformers';
import decode from 'audio-decode';

const soundsDir = path.join(process.cwd(), 'public/sounds');
const files = fs.readdirSync(soundsDir).filter(f => f.endsWith('.mp3'));

// Resample audio to 16000 Hz if needed
function resample(audioData, origRate, targetRate = 16000) {
  if (origRate === targetRate) return audioData;
  const ratio = origRate / targetRate;
  const newLength = Math.round(audioData.length / ratio);
  const result = new Float32Array(newLength);
  for (let i = 0; i < newLength; i++) {
    const origIndex = Math.floor(i * ratio);
    result[i] = audioData[origIndex];
  }
  return result;
}

async function transcribeAll() {
  console.log('Loading whisper-tiny pipeline...');
  const transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny');
  console.log('Pipeline loaded!');

  const results = [];

  for (const f of files) {
    const fullPath = path.join(soundsDir, f);
    try {
      console.log(`Decoding ${f}...`);
      const buffer = fs.readFileSync(fullPath);
      const audio = await decode(buffer);

      const channel0 = audio.channelData ? audio.channelData[0] : (audio._channelData ? audio._channelData[0] : null);
      if (!channel0) {
        throw new Error('Could not find channel 0 data');
      }
      const sampleRate = audio.sampleRate || 44100;
      const resampled = resample(channel0, sampleRate, 16000);
      const duration = channel0.length / sampleRate;

      console.log(`Transcribing ${f} (duration: ${duration.toFixed(1)}s)...`);
      const output = await transcriber(resampled, {
        language: 'arabic',
        task: 'transcribe'
      });

      console.log(`>>> [${f}]: "${output.text}"`);
      results.push({
        file: `/sounds/${f}`,
        filename: f,
        duration: Math.round(duration * 10) / 10,
        text: output.text?.trim()
      });
    } catch (e) {
      console.error(`Error on ${f}:`, e.message);
      results.push({
        file: `/sounds/${f}`,
        filename: f,
        duration: 3.5,
        text: ''
      });
    }
  }

  fs.writeFileSync('transcribed_results.json', JSON.stringify(results, null, 2));
  console.log('Saved to transcribed_results.json!');
}

transcribeAll();
