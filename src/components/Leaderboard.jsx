import React, { useEffect, useState } from 'react';
import { Trophy, Crown, ArrowRight, Sparkles, Flame } from 'lucide-react';
import { soundSynthesizer } from '../services/soundSynthesizer.js';

export default function Leaderboard({
  room,
  player,
  onAdvanceRound
}) {
  const isHost = player?.isHost;
  const currentRound = room.currentRound;
  const totalRounds = room.totalRounds || room.settings?.rounds || 3;
  const isFinalRound = currentRound >= totalRounds;

  // Server-authoritative timer to eliminate state desync & phase lag
  const serverTimer = room?.timer !== undefined ? room.timer : 4;

  useEffect(() => {
    soundSynthesizer.playUiSound('fanfare');
  }, []);

  // Sort players by total score descending
  const sortedPlayers = [...(room.players || [])].sort((a, b) => b.score - a.score);

  return (
    <div className="w-full max-w-md mx-auto px-4 py-4 sm:py-6">
      <div className="arcade-card relative overflow-hidden text-center">
        {/* Header */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-400/20 border-2 border-amber-400 text-amber-300 font-black text-xs sm:text-sm mb-3">
          <Trophy size={16} />
          <span>Round {currentRound} of {totalRounds} Standings</span>
        </div>

        <h2 className="text-2xl sm:text-3xl font-black text-white mb-1">
          Match Leaderboard 🔥
        </h2>
        <p className="text-slate-300 text-xs sm:text-sm mb-5">
          See who is dominating the vocal impersonations!
        </p>

        {/* Players Standings List */}
        <div className="space-y-2.5 mb-6">
          {sortedPlayers.map((p, index) => {
            const isMe = p.id === player?.id;
            const rankEmoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`;

            return (
              <div
                key={p.id}
                className={`flex items-center justify-between p-3 rounded-2xl border-2 border-black shadow-[2px_2px_0px_#000] transition ${
                  index === 0
                    ? 'bg-gradient-to-r from-amber-500/30 via-slate-900 to-amber-500/10 border-amber-400'
                    : isMe
                    ? 'bg-cyan-950/40 border-cyan-400'
                    : 'bg-slate-900/90'
                }`}
              >
                {/* Left: Rank & Name */}
                <div className="flex items-center gap-2.5 text-left">
                  <div className="w-7 text-center text-lg font-black font-display text-amber-400">
                    {rankEmoji}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-black text-white text-sm sm:text-base">{p.name}</span>
                      {index === 0 && <Crown size={14} className="text-amber-400 fill-amber-400" />}
                      {isMe && (
                        <span className="text-[10px] bg-amber-400 text-black px-1.5 py-0.5 rounded font-black">
                          YOU
                        </span>
                      )}
                    </div>
                    {p.lastRoundScore > 0 && (
                      <span className="text-[11px] text-emerald-400 font-bold block">
                        +{p.lastRoundScore} pts this round
                      </span>
                    )}
                  </div>
                </div>

                {/* Right: Total Score */}
                <div className="text-right bg-slate-950 px-3 py-1.5 rounded-xl border border-white/10 shadow-inner">
                  <div className="text-[9px] font-bold text-slate-400">TOTAL</div>
                  <div className="text-lg sm:text-xl font-display font-black text-amber-400">
                    {p.score}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Action Button & Auto Progress */}
        <div className="pt-4 border-t border-white/10 text-left">
          <div className="flex justify-between text-xs font-bold text-slate-400 mb-1.5">
            <span>
              {isFinalRound
                ? 'Revealing Final Match Winner...'
                : `Round ${currentRound + 1} starting automatically...`}
            </span>
            <span className="text-amber-400 font-mono">{Math.max(0, serverTimer)}s</span>
          </div>
          <div className="w-full h-2 bg-slate-950 rounded-full border border-black overflow-hidden mb-3">
            <div
              className="h-full bg-gradient-to-r from-amber-400 to-emerald-400 transition-all duration-300 ease-linear"
              style={{ width: `${Math.min(100, Math.max(0, ((4.0 - serverTimer) / 4.0) * 100))}%` }}
            />
          </div>

          {isHost && (
            <button
              onClick={() => {
                soundSynthesizer.playUiSound('go');
                onAdvanceRound();
              }}
              className="btn-arcade btn-arcade-gold w-full text-base py-3"
            >
              {isFinalRound ? (
                <>
                  <Crown size={20} className="fill-black" />
                  <span>Crown the Champion Now! 👑</span>
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  <span>Start Round {currentRound + 1} Now 🚀</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
