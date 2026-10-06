import React, { useEffect } from 'react';
import { Sparkles, Headphones } from 'lucide-react';
import { soundSynthesizer } from '../services/soundSynthesizer.js';

export default function Countdown({ currentRound, totalRounds }) {
  useEffect(() => {
    soundSynthesizer.playUiSound('tick');
  }, []);

  return (
    <div className="w-full max-w-md mx-auto px-4 py-8 sm:py-12 text-center">
      <div className="arcade-card relative overflow-hidden flex flex-col items-center justify-center py-8 sm:py-10">
        {/* Round Badge */}
        <div className="arcade-badge bg-purple-600/30 text-purple-200 border-purple-500 mb-6">
          <Sparkles size={16} className="text-purple-300" />
          <span>Round {currentRound} of {totalRounds}</span>
        </div>

        <h3 className="text-2xl md:text-3xl font-black text-amber-300 mb-4 animate-pulse">
          Get Ready... Listen Closely!
        </h3>

        {/* Pulsing Visual Ring (No numeric countdown clocks or banner) */}
        <div className="relative w-28 h-28 flex items-center justify-center my-3">
          <div className="absolute inset-0 rounded-full border-4 border-amber-400/30 animate-pulse-ring"></div>
          <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-amber-500 to-amber-300 border-4 border-black shadow-[4px_4px_0px_#000] flex items-center justify-center animate-bounce-in text-black">
            <Headphones size={40} />
          </div>
        </div>

        <p className="text-slate-300 text-xs sm:text-sm mt-4 font-semibold">
          Reference sound is starting...
        </p>
      </div>
    </div>
  );
}
