import React, { useEffect, useState, useRef } from 'react';
import { Volume2 } from 'lucide-react';
import { soundSynthesizer } from '../services/soundSynthesizer.js';

export default function SoundPlayer({ sound, round }) {
  const [isPlaying, setIsPlaying] = useState(true);
  const audioTriggeredRef = useRef(false);

  useEffect(() => {
    // Cancel any lingering audio instances from previous rounds
    soundSynthesizer.stopAll();
    audioTriggeredRef.current = false;

    if (!sound?.id) return;

    // Instantiate and play strictly once upon entering listening phase
    if (!audioTriggeredRef.current) {
      audioTriggeredRef.current = true;
      setIsPlaying(true);
      soundSynthesizer.playTargetSound(sound, () => {
        setIsPlaying(false);
      });
    }

    return () => {
      // Clean up audio on unmount / state change
      soundSynthesizer.stopAll();
      audioTriggeredRef.current = false;
    };
  }, [sound?.id, round]);

  return (
    <div className="w-full max-w-md mx-auto px-4 py-4 sm:py-6 text-center select-none">
      <div className="arcade-card relative overflow-hidden flex flex-col items-center">
        {/* Status Pill */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-500/20 border-2 border-cyan-400 text-cyan-300 font-extrabold text-xs sm:text-sm mb-4 animate-pulse">
          <Volume2 size={16} />
          <span>LISTEN CAREFULLY 🔊</span>
        </div>

        {/* Sound Emoji Icon */}
        <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-slate-900 border-4 border-black shadow-[6px_6px_0px_#000] flex items-center justify-center text-5xl sm:text-6xl my-2">
          {sound?.emoji || '🔊'}
        </div>

        {/* Sound Title */}
        <h2 className="text-2xl sm:text-3xl font-black text-white mt-3 mb-2 tracking-tight">
          {sound?.name || 'Sound'}
        </h2>

        {/* Animated Audio Waves (No duration clocks or seconds remaining) */}
        <div className="flex items-center justify-center gap-1.5 h-14 w-full max-w-xs my-3 bg-slate-950/80 rounded-2xl border-2 border-black p-3 shadow-inner">
          {Array.from({ length: 16 }).map((_, i) => (
            <div
              key={i}
              className={`w-2 rounded-full transition-all duration-150 ${
                isPlaying
                  ? 'bg-gradient-to-t from-cyan-400 to-amber-400 animate-pulse'
                  : 'bg-slate-700 h-2'
              }`}
              style={{
                height: isPlaying
                  ? `${Math.max(20, Math.sin(i * 0.7 + (Date.now() / 150)) * 75 + 25)}%`
                  : '6px',
                animationDelay: `${i * 50}ms`
              }}
            />
          ))}
        </div>

        <p className="text-xs text-slate-400 font-semibold mt-1">
          {isPlaying ? 'Playing reference clip...' : 'Prepare to record your take'}
        </p>
      </div>
    </div>
  );
}
