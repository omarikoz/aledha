import React, { useEffect, useRef, useState } from 'react';
import { Mic, Activity, CheckCircle2, AlertCircle } from 'lucide-react';
import { audioEngine } from '../services/audioEngine.js';
import { soundSynthesizer } from '../services/soundSynthesizer.js';
import CharacterAvatar from './CharacterAvatar.jsx';

export default function Recorder({ sound, timer, player, onSubmitRecording }) {
  const [micVolume, setMicVolume] = useState(0);
  const [isCapturing, setIsCapturing] = useState(false);
  const [hasRecorded, setHasRecorded] = useState(false);
  const [micError, setMicError] = useState(null);
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const recordedOnceRef = useRef(false);

  useEffect(() => {
    if (recordedOnceRef.current) return;
    recordedOnceRef.current = true;

    let isMounted = true;
    // Hard-cap recording duration strictly to max 6.0 seconds
    const durationMs = Math.min(6000, Math.max(1500, Math.ceil((sound?.duration || 3.5) * 1000)));

    const startRecordingSession = async () => {
      try {
        setIsCapturing(true);
        soundSynthesizer.playUiSound('go');

        // Draw live audio waveform on canvas
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          const renderVisualizer = () => {
            if (!isMounted) return;
            const analyser = audioEngine.analyser;
            if (analyser && canvas) {
              const bufferLength = analyser.frequencyBinCount;
              const dataArray = new Uint8Array(bufferLength);
              analyser.getByteTimeDomainData(dataArray);

              ctx.fillStyle = 'rgba(10, 15, 30, 0.4)';
              ctx.fillRect(0, 0, canvas.width, canvas.height);

              ctx.lineWidth = 3;
              ctx.strokeStyle = '#fbbf24'; // Gold wave
              ctx.beginPath();

              const sliceWidth = (canvas.width * 1.0) / bufferLength;
              let x = 0;

              for (let i = 0; i < bufferLength; i++) {
                const v = dataArray[i] / 128.0;
                const y = (v * canvas.height) / 2;
                if (i === 0) {
                  ctx.moveTo(x, y);
                } else {
                  ctx.lineTo(x, y);
                }
                x += sliceWidth;
              }

              ctx.lineTo(canvas.width, canvas.height / 2);
              ctx.stroke();
            }
            animFrameRef.current = requestAnimationFrame(renderVisualizer);
          };
          renderVisualizer();
        }

        // Get reference audio buffer for acoustic comparison
        const refBuffer = await soundSynthesizer.getReferenceAudioBuffer(sound);

        // Record user audio
        const userRec = await audioEngine.recordAudio(durationMs, (volume) => {
          if (isMounted) setMicVolume(volume);
        });

        if (!isMounted) return;
        setIsCapturing(false);
        // Deterministic score recording against reference sound
        const scoreResult = audioEngine.scoreRecording(userRec.audioBuffer, refBuffer);

        // Capture direct Object URL from real MediaRecorder audioBlob
        const recordedAudioUrl = userRec.objectUrl || (userRec.blob ? URL.createObjectURL(userRec.blob) : userRec.dataUrl);

        // Submit to room
        onSubmitRecording({
          recordedAudioUrl,
          audioDataUrl: userRec.dataUrl || recordedAudioUrl,
          score: scoreResult.totalScore,
          rhythmScore: scoreResult.rhythmScore,
          pitchScore: scoreResult.pitchScore,
          energyScore: scoreResult.energyScore,
          tier: scoreResult.tier
        });
      } catch (err) {
        console.error('Recording failed:', err);
        if (isMounted) {
          setMicError(err.message || 'Microphone error occurred');
          setIsCapturing(false);
          // Deterministic fallback score for error state
          onSubmitRecording({
            recordedAudioUrl: null,
            audioDataUrl: null,
            score: 15,
            rhythmScore: 10,
            pitchScore: 15,
            energyScore: 15,
            tier: audioEngine.getEgyptianRatingTier(15)
          });
        }
      }
    };

    startRecordingSession();

    return () => {
      isMounted = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      audioEngine.stopMic();
    };
  }, [sound, onSubmitRecording]);

  return (
    <div className="w-full max-w-xl mx-auto px-4 py-6 text-center">
      <div className="arcade-card relative overflow-hidden flex flex-col items-center">
        {/* Pulsing Header */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-500/20 border-2 border-red-500 text-red-400 font-extrabold text-sm mb-4 animate-pulse">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping"></span>
          <span>🔴 LIVE RECORDING: MIMIC IT NOW! (قَلِّدْهَا)</span>
        </div>

        <h2 className="text-3xl md:text-5xl font-black text-amber-400 mb-1 tracking-tight">
          Mimic: {sound.name}
        </h2>
        {sound.nameAr && (
          <p className="text-sm font-bold text-amber-200/80 font-cairo mb-3">
            ({sound.nameAr})
          </p>
        )}
        <p className="text-sm font-bold text-slate-300 mb-4">
          Speak and make the sound directly into your microphone!
        </p>

        {/* Live Audio Visualizer Canvas */}
        <div className="w-full max-w-md my-2 relative">
          <canvas
            ref={canvasRef}
            width={450}
            height={120}
            className="visualizer-canvas"
          />
          <div className="absolute top-2 left-3 text-[11px] font-mono font-bold text-amber-300/80 bg-black/60 px-2 py-0.5 rounded border border-white/10">
            Live Audio Scope
          </div>
        </div>

        {/* Real-time Mic Input Level Meter */}
        <div className="w-full max-w-md my-3 bg-slate-950/80 p-3 rounded-xl border-2 border-black">
          <div className="flex items-center justify-between text-xs font-bold text-slate-300 mb-1.5">
            <span className="flex items-center gap-1.5">
              <Activity size={15} className="text-cyan-400" />
              <span>Mic Sensitivity:</span>
            </span>
            <span className={micVolume > 0.1 ? 'text-emerald-400' : 'text-slate-400'}>
              {micVolume > 0.1 ? 'Voice detected loud & clear! 🔊' : 'Make sound into your mic...'}
            </span>
          </div>
          <div className="w-full h-3.5 bg-slate-900 rounded-full overflow-hidden border border-black flex">
            <div
              className={`h-full transition-all duration-75 rounded-full ${
                micVolume > 0.7
                  ? 'bg-red-500'
                  : micVolume > 0.3
                  ? 'bg-gradient-to-r from-emerald-400 to-amber-400'
                  : 'bg-emerald-400'
              }`}
              style={{ width: `${Math.min(100, Math.max(5, micVolume * 100))}%` }}
            />
          </div>
        </div>

        {/* Character Avatar with Talking Bounce */}
        <div className="my-2 flex items-center justify-center gap-4">
          <CharacterAvatar
            avatar={player?.avatar || '👑'}
            name={player?.name || 'You'}
            character={player?.character}
            isTalking={micVolume > 0.1}
            size="lg"
          />

          <div
            className={`w-24 h-24 rounded-full border-4 border-black flex items-center justify-center transition-all duration-200 shadow-[5px_5px_0px_#000] ${
              isCapturing
                ? 'bg-gradient-to-br from-red-500 to-pink-600 scale-110 animate-pulse'
                : 'bg-emerald-500 text-black'
            }`}
          >
            {hasRecorded ? (
              <CheckCircle2 size={46} className="text-black" />
            ) : (
              <Mic size={46} className="text-white" />
            )}
          </div>
        </div>

        {/* Status Text */}
        {hasRecorded ? (
          <div className="text-emerald-400 font-black text-lg mt-2 flex items-center gap-2">
            <span>Recording captured! Collecting all players...</span>
          </div>
        ) : (
          <div className="text-amber-300 font-extrabold text-lg mt-2">
            {timer}s remaining in recording window!
          </div>
        )}

        {micError && (
          <div className="mt-4 p-3 bg-red-950/70 border border-red-500 rounded-xl text-red-200 text-xs font-bold flex items-center gap-2">
            <AlertCircle size={16} />
            <span>{micError}</span>
          </div>
        )}
      </div>
    </div>
  );
}
