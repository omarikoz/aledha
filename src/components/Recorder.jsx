import React, { useEffect, useRef, useState } from 'react';
import { Mic, CheckCircle2, AlertCircle } from 'lucide-react';
import { audioEngine } from '../services/audioEngine.js';
import { soundSynthesizer } from '../services/soundSynthesizer.js';

export default function Recorder({ sound, timer, player, onSubmitRecording }) {
  const [micVolume, setMicVolume] = useState(0);
  const [isCapturing, setIsCapturing] = useState(false);
  const [hasRecorded, setHasRecorded] = useState(false);
  const [micError, setMicError] = useState(null);
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const recordedSoundIdRef = useRef(null);

  const onSubmitRef = useRef(onSubmitRecording);
  useEffect(() => {
    onSubmitRef.current = onSubmitRecording;
  });

  const soundKey = sound?.id || sound?.name || 'current-round-sound';

  useEffect(() => {
    if (recordedSoundIdRef.current === soundKey) return;
    recordedSoundIdRef.current = soundKey;

    let isMounted = true;
    audioEngine.unlockAudioContext();

    // Duration: 4 seconds
    const durationMs = Math.min(4500, Math.max(2500, Math.ceil((sound?.duration || 3.5) * 1000)));

    const startRecordingSession = async () => {
      try {
        setIsCapturing(true);
        soundSynthesizer.playUiSound('go');

        const stream = await audioEngine.initMicrophone();
        if (!stream) {
          throw new Error('Microphone permission required! Please enable mic.');
        }
        const liveAnalyser = audioEngine.setupAnalyser(stream);

        // Visualizer
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          const renderVisualizer = () => {
            if (!isMounted) return;
            const currentAnalyser = audioEngine.analyser || liveAnalyser;

            ctx.fillStyle = 'rgba(10, 15, 30, 0.45)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const centerY = canvas.height / 2;
            let currentRms = 0;

            if (currentAnalyser) {
              const bufferLength = currentAnalyser.frequencyBinCount;
              const dataArray = new Uint8Array(bufferLength);
              currentAnalyser.getByteTimeDomainData(dataArray);

              let sumSquares = 0;
              for (let i = 0; i < bufferLength; i++) {
                const norm = (dataArray[i] - 128) / 128.0;
                sumSquares += norm * norm;
              }
              currentRms = Math.sqrt(sumSquares / bufferLength);

              ctx.lineWidth = 3;
              ctx.strokeStyle = currentRms > 0.02 ? '#06b6d4' : '#fbbf24';
              ctx.beginPath();

              const sliceWidth = (canvas.width * 1.0) / bufferLength;
              let x = 0;

              for (let i = 0; i < bufferLength; i++) {
                const norm = (dataArray[i] - 128) / 128.0;
                const amp = norm * 6.5;
                const y = Math.max(4, Math.min(canvas.height - 4, centerY + (amp * (centerY - 6))));
                if (i === 0) {
                  ctx.moveTo(x, y);
                } else {
                  ctx.lineTo(x, y);
                }
                x += sliceWidth;
              }
              ctx.stroke();
            } else {
              ctx.strokeStyle = '#fbbf24';
              ctx.beginPath();
              ctx.moveTo(0, centerY);
              ctx.lineTo(canvas.width, centerY);
              ctx.stroke();
            }

            if (isMounted) {
              setMicVolume(Math.min(1.0, currentRms * 5.5));
            }

            animFrameRef.current = requestAnimationFrame(renderVisualizer);
          };
          renderVisualizer();
        }

        // Record audio
        const userRec = await audioEngine.recordAudio(durationMs, (volume) => {
          if (isMounted) setMicVolume((v) => Math.max(v, volume));
        });

        if (!isMounted) return;
        setIsCapturing(false);
        setHasRecorded(true);

        // Submit audio directly to room for peer voting (no algorithmic scoring)
        if (onSubmitRef.current) {
          onSubmitRef.current({
            recordedAudioUrl: userRec.objectUrl,
            audioDataUrl: userRec.dataUrl
          });
        }
      } catch (err) {
        console.error('Recording error:', err);
        if (isMounted) {
          setMicError(err.message || 'Microphone error occurred');
          setIsCapturing(false);
          if (onSubmitRef.current) {
            onSubmitRef.current({
              recordedAudioUrl: null,
              audioDataUrl: null
            });
          }
        }
      }
    };

    startRecordingSession();

    return () => {
      isMounted = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      audioEngine.stopMic();
    };
  }, [soundKey]);

  return (
    <div
      onClick={() => audioEngine.unlockAudioContext()}
      className="w-full max-w-md mx-auto px-4 py-4 sm:py-6 text-center select-none"
    >
      <div className="arcade-card relative overflow-hidden flex flex-col items-center">
        {/* Clean Pulsing Recording Badge (No Mimic It text) */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-500/20 border-2 border-red-500 text-red-400 font-extrabold text-xs sm:text-sm mb-3 animate-pulse">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping"></span>
          <span>🔴 RECORDING AUDIO</span>
        </div>

        {/* Sound Title */}
        <h2 className="text-2xl sm:text-3xl font-black text-amber-400 mb-2 tracking-tight">
          {sound.name}
        </h2>

        {/* Live Audio Scope */}
        <div className="w-full max-w-sm my-2 relative">
          <canvas
            ref={canvasRef}
            width={340}
            height={80}
            className="visualizer-canvas w-full rounded-2xl"
          />
        </div>

        {/* Big Mic Status Visualizer */}
        <div className="my-3 flex items-center justify-center">
          <div
            className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full border-4 border-black flex items-center justify-center transition-all duration-200 shadow-[4px_4px_0px_#000] ${
              isCapturing
                ? micVolume > 0.08
                  ? 'bg-gradient-to-br from-emerald-400 to-cyan-400 scale-110 shadow-[0_0_20px_#10b981]'
                  : 'bg-gradient-to-br from-red-500 to-pink-600 scale-105 animate-pulse'
                : 'bg-emerald-500 text-black'
            }`}
          >
            {hasRecorded ? (
              <CheckCircle2 size={42} className="text-black" />
            ) : (
              <Mic size={42} className="text-white" />
            )}
          </div>
        </div>

        {/* Status (No numeric duration timers or clock labels) */}
        {hasRecorded ? (
          <div className="text-emerald-400 font-black text-sm sm:text-base mt-2 flex items-center gap-2">
            <span>✓ Recording submitted! Preparing reveals...</span>
          </div>
        ) : (
          <div className="mt-2 text-center">
            <span className="text-xs font-bold text-slate-300 block">
              Speak clearly into your microphone
            </span>
          </div>
        )}

        {micError && (
          <div className="mt-3 p-2.5 bg-red-950/70 border border-red-500 rounded-xl text-red-200 text-xs font-bold flex items-center gap-2">
            <AlertCircle size={15} />
            <span>{micError}</span>
          </div>
        )}
      </div>
    </div>
  );
}
