import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Crown, Trophy, RefreshCw, Home, Sparkles, Flame } from 'lucide-react';
import { soundSynthesizer } from '../services/soundSynthesizer.js';

export default function GameOver({
  room,
  player,
  onPlayAgain,
  onLeaveRoom
}) {
  const isHost = player?.isHost;
  const sortedPlayers = [...(room.players || [])].sort((a, b) => b.score - a.score);
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
    <div className="w-full max-w-2xl mx-auto px-4 py-6 text-center">
      <div className="arcade-card relative overflow-hidden">
        {/* Celebration Title */}
        <div className="arcade-badge bg-amber-400 text-black border-black mb-3 text-sm py-1 px-4">
          <Crown size={18} className="fill-black" />
          <span>Match Finished & Champion Crowned!</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-black text-white mb-2">
          The Egyptian Voice Champion 👑
        </h1>
        <p className="text-slate-300 text-sm mb-8">
          Big shoutout to all the golden vocal cords that brought the energy and laughs!
        </p>

        {/* 3D Visual Podium for Top 3 */}
        <div className="flex items-end justify-center gap-3 my-6 pt-6 px-2">
          {/* 2nd Place */}
          {runnerUp && (
            <div className="flex-1 flex flex-col items-center">
              <div className="text-3xl mb-1">{runnerUp.avatar || runnerUp.character?.avatar || '🥈'}</div>
              <div className="text-xs font-black text-white truncate max-w-[90px] mb-0.5">
                {runnerUp.name}
              </div>
              {runnerUp.character && (
                <div className="text-[10px] text-amber-300 font-bold font-cairo mb-1">
                  ({runnerUp.character.nameAr || runnerUp.character.name})
                </div>
              )}
              <div className="text-xs font-extrabold text-slate-300 mb-2 font-mono">
                {runnerUp.score} pts
              </div>
              <div className="w-full h-28 bg-gradient-to-t from-slate-800 to-slate-700 rounded-t-2xl border-2 border-black shadow-[3px_3px_0px_#000] flex items-center justify-center">
                <span className="text-3xl font-display font-black text-slate-300">🥈</span>
              </div>
            </div>
          )}

          {/* 1st Place (Winner) */}
          {winner && (
            <div className="flex-1 flex flex-col items-center -mt-6">
              <div className="relative">
                <div className="text-5xl mb-1 animate-bounce">{winner.avatar || winner.character?.avatar || '👑'}</div>
                <div className="absolute -top-4 -right-1 text-2xl">👑</div>
              </div>
              <div className="text-base font-black text-amber-400 truncate max-w-[110px] mb-0.5">
                {winner.name}
              </div>
              {winner.character && (
                <div className="text-xs text-amber-200 font-bold font-cairo mb-1">
                  ({winner.character.nameAr || winner.character.name})
                </div>
              )}
              <div className="text-sm font-extrabold text-amber-300 mb-2 font-mono">
                {winner.score} pts
              </div>
              <div className="w-full h-40 bg-gradient-to-t from-amber-600 via-amber-500 to-amber-400 rounded-t-2xl border-3 border-black shadow-[4px_4px_0px_#000] flex flex-col items-center justify-center">
                <span className="text-4xl font-display font-black text-black">🥇</span>
                <span className="text-[11px] font-black text-black mt-1 bg-white/40 px-2 py-0.5 rounded-full">
                  1st Place (Champion)
                </span>
              </div>
            </div>
          )}

          {/* 3rd Place */}
          {thirdPlace && (
            <div className="flex-1 flex flex-col items-center">
              <div className="text-3xl mb-1">{thirdPlace.avatar || thirdPlace.character?.avatar || '🥉'}</div>
              <div className="text-xs font-black text-white truncate max-w-[90px] mb-0.5">
                {thirdPlace.name}
              </div>
              {thirdPlace.character && (
                <div className="text-[10px] text-amber-300 font-bold font-cairo mb-1">
                  ({thirdPlace.character.nameAr || thirdPlace.character.name})
                </div>
              )}
              <div className="text-xs font-extrabold text-amber-600 mb-2 font-mono">
                {thirdPlace.score} pts
              </div>
              <div className="w-full h-20 bg-gradient-to-t from-amber-900/60 to-amber-800/80 rounded-t-2xl border-2 border-black shadow-[3px_3px_0px_#000] flex items-center justify-center">
                <span className="text-2xl font-display font-black text-amber-400">🥉</span>
              </div>
            </div>
          )}
        </div>

        {/* All Players Mini Table */}
        <div className="bg-slate-950/70 p-4 rounded-2xl border-2 border-black my-6 text-left">
          <h4 className="text-xs font-bold text-slate-400 mb-3">
            Final Tournament Standings:
          </h4>
          <div className="space-y-2">
            {sortedPlayers.map((p, i) => (
              <div
                key={p.id}
                className="flex items-center justify-between text-xs font-bold py-1.5 px-3 rounded-lg bg-slate-900 border border-white/5"
              >
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 font-mono">#{i + 1}</span>
                  <span>{p.avatar || p.character?.avatar}</span>
                  <span className="text-white">{p.name}</span>
                  {p.character && (
                    <span className="text-[10px] text-amber-300/80 font-cairo">
                      ({p.character.nameAr || p.character.name})
                    </span>
                  )}
                </div>
                <span className="text-amber-400 font-mono font-black">{p.score} pts</span>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-white/10">
          {isHost ? (
            <button
              onClick={() => {
                soundSynthesizer.playUiSound('go');
                onPlayAgain();
              }}
              className="btn-arcade btn-arcade-gold flex-1 text-base py-3.5"
            >
              <RefreshCw size={18} />
              <span>Play Again with Same Squad 🔄</span>
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
            className="btn-arcade btn-arcade-dark py-3.5 px-6 text-sm"
          >
            <Home size={18} />
            <span>Main Menu</span>
          </button>
        </div>
      </div>
    </div>
  );
}
