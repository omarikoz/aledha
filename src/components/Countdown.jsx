import React, { useEffect } from 'react';
import { Sparkles } from 'lucide-react';
import { soundSynthesizer } from '../services/soundSynthesizer.js';

export default function Countdown({ seconds, currentRound, totalRounds }) {
  useEffect(() => {
    if (seconds > 0) {
      soundSynthesizer.playUiSound('tick');
    } else {
      soundSynthesizer.playUiSound('go');
    }
  }, [seconds]);

  const displayCount = seconds === 3 ? '3' : seconds === 2 ? '2' : seconds === 1 ? '1' : 'قَلِّدْهَا!';

  return (
    <div className="w-full max-w-lg mx-auto px-4 py-12 text-center">
      <div className="arcade-card relative overflow-hidden flex flex-col items-center justify-center py-10">
        {/* Round Badge */}
        <div className="arcade-badge bg-purple-600/30 text-purple-200 border-purple-500 mb-6">
          <Sparkles size={16} className="text-purple-300" />
          <span>Round {currentRound} of {totalRounds}</span>
        </div>

        <h3 className="text-2xl md:text-3xl font-black text-amber-300 mb-6 animate-pulse">
          Get Ready... Listen Closely! (استعد)
        </h3>

        {/* Big Animated Countdown Ring */}
        <div className="relative w-36 h-36 flex items-center justify-center my-4">
          <div className="absolute inset-0 rounded-full border-4 border-amber-400/30 animate-pulse-ring"></div>
          <div className="w-32 h-32 rounded-full bg-gradient-to-tr from-amber-500 to-amber-300 border-4 border-black shadow-[6px_6px_0px_#000] flex items-center justify-center transform transition-all duration-300 animate-bounce-in">
            <span className="font-display font-black text-6xl text-slate-950">
              {displayCount}
            </span>
          </div>
        </div>

        <p className="text-slate-300 text-sm mt-6 font-semibold">
          💡 Match the pitch, rhythm, and pauses to beat the competition!
        </p>
      </div>
    </div>
  );
}
