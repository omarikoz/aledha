import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Crown, RefreshCw, Home } from 'lucide-react';
import { soundSynthesizer } from '../services/soundSynthesizer.js';

export default function GameOver({
  room,
  player,
  onPlayAgain,
  onLeaveRoom
}) {
  const isHost = player?.isHost;
  const sortedPlayers = [...(room?.players || [])].sort((a, b) => b.score - a.score);
  const winner = sortedPlayers[0];
  const runnerUp = sortedPlayers[1];
  const thirdPlace = sortedPlayers[2];

  useEffect(() => {
    soundSynthesizer.playUiSound('fanfare');

    // Confetti celebration
    const end = Date.now() + 3000;
    const colors = ['#fbbf24', '#06b6d4', '#f43f5e', '#10b981'];

    (function frame() {
      confetti({
        particleCount: 4,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: colors
      });
      confetti({
        particleCount: 4,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: colors
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    })();
  }, []);

  return (
    <div className="w-full max-w-lg mx-auto px-4 py-4 sm:py-6 text-center">
      <div className="arcade-card relative overflow-hidden">
        {/* Celebration Title */}
        <div className="arcade-badge bg-amber-400 text-black border-black mb-3 text-xs sm:text-sm py-1 px-4">
          <Crown size={16} className="fill-black" />
          <span>Match Finished & Champion Crowned!</span>
        </div>

        <h1 className="text-2xl sm:text-4xl font-black text-white mb-2">
          Voice Mimic Champion 👑
        </h1>
        <p className="text-slate-300 text-xs sm:text-sm mb-6">
          Great job to all the vocalists who gave it their all!
        </p>

        {/* Visual Podium for Top 3 */}
        <div className="flex items-end justify-center gap-2 sm:gap-3 my-4 pt-4 px-1">
          {/* 2nd Place */}
          {runnerUp && (
            <div className="flex-1 flex flex-col items-center">
              <div className="text-2xl sm:text-3xl mb-1">🥈</div>
              <div className="text-xs font-black text-white truncate max-w-[80px] sm:max-w-[100px] mb-0.5">
                {runnerUp.name}
              </div>
              <div className="text-xs font-extrabold text-slate-300 mb-2 font-mono">
                {runnerUp.score} pts
              </div>
              <div className="w-full h-24 sm:h-28 bg-gradient-to-t from-slate-800 to-slate-700 rounded-t-2xl border-2 border-black shadow-[3px_3px_0px_#000] flex items-center justify-center">
                <span className="text-2xl sm:text-3xl font-black text-slate-300">2nd</span>
              </div>
            </div>
          )}

          {/* 1st Place (Winner) */}
          {winner && (
            <div className="flex-1 flex flex-col items-center -mt-6">
              <div className="relative">
                <div className="text-4xl sm:text-5xl mb-1 animate-bounce">👑</div>
              </div>
              <div className="text-sm sm:text-base font-black text-amber-400 truncate max-w-[90px] sm:max-w-[120px] mb-0.5">
                {winner.name}
              </div>
              <div className="text-xs sm:text-sm font-extrabold text-amber-300 mb-2 font-mono">
                {winner.score} pts
              </div>
              <div className="w-full h-36 sm:h-40 bg-gradient-to-t from-amber-600 via-amber-500 to-amber-400 rounded-t-2xl border-3 border-black shadow-[4px_4px_0px_#000] flex flex-col items-center justify-center">
                <span className="text-3xl sm:text-4xl font-black text-black">🥇</span>
                <span className="text-[10px] font-black text-black mt-1 bg-white/40 px-2 py-0.5 rounded-full">
                  1st Place
                </span>
              </div>
            </div>
          )}

          {/* 3rd Place */}
          {thirdPlace && (
            <div className="flex-1 flex flex-col items-center">
              <div className="text-2xl sm:text-3xl mb-1">🥉</div>
              <div className="text-xs font-black text-white truncate max-w-[80px] sm:max-w-[100px] mb-0.5">
                {thirdPlace.name}
              </div>
              <div className="text-xs font-extrabold text-amber-600 mb-2 font-mono">
                {thirdPlace.score} pts
              </div>
              <div className="w-full h-18 sm:h-20 bg-gradient-to-t from-amber-900/60 to-amber-800/80 rounded-t-2xl border-2 border-black shadow-[3px_3px_0px_#000] flex items-center justify-center">
                <span className="text-2xl font-black text-amber-400">3rd</span>
              </div>
            </div>
          )}
        </div>

        {/* All Players Mini Table */}
        <div className="bg-slate-950/70 p-3 sm:p-4 rounded-2xl border-2 border-black my-5 text-left">
          <h4 className="text-xs font-bold text-slate-400 mb-2">
            Final Standings:
          </h4>
          <div className="space-y-1.5">
            {sortedPlayers.map((p, i) => (
              <div
                key={p.id}
                className="flex items-center justify-between text-xs font-bold py-1.5 px-3 rounded-lg bg-slate-900 border border-white/5"
              >
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 font-mono">#{i + 1}</span>
                  <span className="text-white">{p.name}</span>
                </div>
                <span className="text-amber-400 font-mono font-black">{p.score} pts</span>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-2.5 pt-3 border-t border-white/10">
          {isHost ? (
            <button
              onClick={() => {
                soundSynthesizer.playUiSound('go');
                onPlayAgain();
              }}
              className="btn-arcade btn-arcade-gold flex-1 text-sm sm:text-base py-3"
            >
              <RefreshCw size={18} />
              <span>Play Again 🔄</span>
            </button>
          ) : (
            <div className="flex-1 p-3 bg-slate-900/80 rounded-xl border border-white/10 text-xs font-bold text-slate-400">
              Waiting for Host to replay... ⏳
            </div>
          )}

          <button
            onClick={() => {
              soundSynthesizer.playUiSound('click');
              onLeaveRoom();
            }}
            className="btn-arcade btn-arcade-dark py-3 px-5 text-xs sm:text-sm"
          >
            <Home size={18} />
            <span>Main Menu</span>
          </button>
        </div>
      </div>
    </div>
  );
}
