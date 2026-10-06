import React, { useEffect, useState, useRef } from 'react';
import { Volume2 } from 'lucide-react';
import { soundSynthesizer } from '../services/soundSynthesizer.js';

export default function SoundPlayer({ sound, timer }) {
  const [isPlaying, setIsPlaying] = useState(true);
  const playedSoundIdRef = useRef(null);

  useEffect(() => {
    if (!sound?.id) return;
    if (playedSoundIdRef.current === sound.id) return;
    playedSoundIdRef.current = sound.id;

    setIsPlaying(true);
    soundSynthesizer.playTargetSound(sound, () => {
      setIsPlaying(false);
    });

    return () => {
      soundSynthesizer.stopAll();
    };
  }, [sound?.id]);

  return (
    <div className="w-full max-w-lg mx-auto px-4 py-6 text-center select-none">
      <div className="arcade-card relative overflow-hidden flex flex-col items-center">
        {/* Status Pill */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-500/20 border-2 border-cyan-400 text-cyan-300 font-extrabold text-xs sm:text-sm mb-4 animate-pulse">
          <Volume2 size={16} />
          <span>LISTEN CLOSELY (استمع جيداً)</span>
        </div>

        {/* Sound Emoji Icon */}
        <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-slate-900 border-4 border-black shadow-[6px_6px_0px_#000] flex items-center justify-center text-5xl sm:text-6xl my-2">
          {sound.emoji || '🔊'}
        </div>

        {/* Sound Title */}
        <h2 className="text-2xl sm:text-4xl font-black text-white mt-3 mb-1 tracking-tight">
          {sound.name}
        </h2>
        {sound.nameAr && (
          <p className="text-base sm:text-lg font-bold text-amber-300 font-cairo mb-3">
            ({sound.nameAr})
          </p>
        )}

        {/* Clean Animated Audio Waves */}
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
                height: isPlaying ? `${Math.max(20, Math.sin(i * 0.7 + (Date.now() / 150)) * 75 + 25)}%` : '6px',
                animationDelay: `${i * 50}ms`
              }}
            />
          ))}
        </div>

        {/* Large Countdown */}
        <div className="mt-2 text-center">
          <div className="text-xs font-bold text-slate-400 mb-1">
            Recording starts in:
          </div>
          <div className="text-4xl font-black font-display text-amber-400">
            {timer}s
          </div>
        </div>
      </div>
    </div>
  );
}
