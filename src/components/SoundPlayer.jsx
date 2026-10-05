import React, { useEffect, useState, useRef } from 'react';
import { Volume2, Music, Sparkles } from 'lucide-react';
import { soundSynthesizer } from '../services/soundSynthesizer.js';

export default function SoundPlayer({ sound, timer }) {
  const [isPlaying, setIsPlaying] = useState(true);
  const playedSoundIdRef = useRef(null);

  useEffect(() => {
    if (!sound?.id) return;
    // Strict guard: ensure sound triggers strictly once per round
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
    <div className="w-full max-w-xl mx-auto px-4 py-8 text-center">
      <div className="arcade-card relative overflow-hidden flex flex-col items-center">
        {/* Category Pill */}
        <div className="arcade-badge bg-cyan-500/20 text-cyan-300 border-cyan-400 mb-4">
          <Music size={16} />
          <span>{sound.categoryName || sound.category}</span>
        </div>

        {/* Big Sound Icon */}
        <div className="relative my-4">
          <div className="w-28 h-28 rounded-3xl bg-slate-900 border-4 border-black shadow-[6px_6px_0px_#000] flex items-center justify-center text-6xl animate-bounce-in">
            {sound.emoji || '🔊'}
          </div>
          {isPlaying && (
            <div className="absolute -bottom-2 -right-2 bg-emerald-500 border-2 border-black p-2 rounded-xl text-black shadow-[2px_2px_0px_#000] animate-pulse">
              <Volume2 size={20} />
            </div>
          )}
        </div>

        {/* Sound Name in English & Egyptian Arabic */}
        <h2 className="text-3xl md:text-4xl font-black text-white mt-2 mb-1">
          {sound.name}
        </h2>
        {sound.nameAr && (
          <p className="text-sm font-bold text-amber-300 font-cairo mb-2">
            ({sound.nameAr})
          </p>
        )}

        {/* Pro Tip / Egyptian Hint */}
        {sound.hint && (
          <div className="bg-amber-400/10 border-2 border-amber-400/30 rounded-2xl p-3 my-3 text-amber-200 text-sm font-bold flex items-center gap-2 max-w-md text-left">
            <span className="text-lg">💡</span>
            <span><strong>Pro Tip:</strong> {sound.hint}</span>
          </div>
        )}

        {/* Animated Sound Wave Bars */}
        <div className="flex items-center justify-center gap-1.5 h-16 w-full max-w-xs my-4 bg-slate-950/80 rounded-2xl border-2 border-black p-3">
          {Array.from({ length: 16 }).map((_, i) => (
            <div
              key={i}
              className={`w-2 rounded-full transition-all duration-150 ${
                isPlaying
                  ? 'bg-gradient-to-t from-cyan-500 to-amber-400 animate-pulse'
                  : 'bg-slate-700 h-2'
              }`}
              style={{
                height: isPlaying ? `${Math.max(15, Math.sin(i * 0.8 + Date.now() / 200) * 80 + 20)}%` : '8px',
                animationDelay: `${i * 60}ms`
              }}
            />
          ))}
        </div>

        {/* Sync Timer Bar */}
        <div className="w-full max-w-sm mt-2">
          <div className="flex justify-between text-xs font-bold text-slate-400 mb-1.5">
            <span>Listening to Target Audio</span>
            <span className="text-amber-400 font-mono">{timer}s remaining</span>
          </div>
          <div className="w-full h-3 bg-slate-900 rounded-full border-2 border-black overflow-hidden shadow-[2px_2px_0px_#000]">
            <div
              className="h-full bg-gradient-to-r from-amber-400 to-cyan-400 transition-all duration-1000 ease-linear"
              style={{ width: `${Math.min(100, Math.max(0, (timer / (sound.duration || 3.5)) * 100))}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
