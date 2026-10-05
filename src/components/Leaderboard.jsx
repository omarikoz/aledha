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

  const [countdown, setCountdown] = useState(5.0);

  useEffect(() => {
    soundSynthesizer.playUiSound('fanfare');

    const startTime = Date.now();
    const durationMs = 5000;
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, (durationMs - elapsed) / 1000);
      setCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        if (isHost) {
          onAdvanceRound();
        }
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isHost, onAdvanceRound]);

  // Sort players by total score descending
  const sortedPlayers = [...(room.players || [])].sort((a, b) => b.score - a.score);

  return (
    <div className="w-full max-w-xl mx-auto px-4 py-6">
      <div className="arcade-card relative overflow-hidden text-center">
        {/* Header */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-400/20 border-2 border-amber-400 text-amber-300 font-black text-sm mb-4">
          <Trophy size={16} />
          <span>Round {currentRound} of {totalRounds} Standings</span>
        </div>

        <h2 className="text-3xl md:text-4xl font-black text-white mb-2">
          Match Leaderboard 🔥
        </h2>
        <p className="text-slate-300 text-sm mb-6">
          Who hit the notes and who caused an acoustic disaster?
        </p>

        {/* Players Standings List */}
        <div className="space-y-3 mb-6">
          {sortedPlayers.map((p, index) => {
            const isMe = p.id === player?.id;
            const rankEmoji = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`;

            return (
              <div
                key={p.id}
                className={`flex items-center justify-between p-3.5 rounded-2xl border-2 border-black shadow-[3px_3px_0px_#000] transition ${
                  index === 0
                    ? 'bg-gradient-to-r from-amber-500/30 via-slate-900 to-amber-500/10 border-amber-400'
                    : isMe
                    ? 'bg-cyan-950/40 border-cyan-400'
                    : 'bg-slate-900/90'
                }`}
              >
                {/* Left: Rank & Avatar & Name */}
                <div className="flex items-center gap-3 text-left">
                  <div className="w-8 text-center text-xl font-black font-display text-amber-400">
                    {rankEmoji}
                  </div>
                  <span className="text-3xl p-1 bg-black/40 rounded-xl border border-white/10">
                    {p.avatar || p.character?.avatar || '👑'}
                  </span>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-black text-white text-base">{p.name}</span>
                      {p.character && (
                        <span className="text-[10px] text-amber-300 font-bold font-cairo">
                          ({p.character.nameAr || p.character.name})
                        </span>
                      )}
                      {index === 0 && <Crown size={15} className="text-amber-400 fill-amber-400" />}
                      {p.isBot && (
                        <span className="text-[10px] bg-purple-500/30 text-purple-300 px-1.5 py-0.5 rounded border border-purple-400/30 font-bold">
                          BOT
                        </span>
                      )}
                      {isMe && (
                        <span className="text-[10px] bg-amber-400 text-black px-1.5 py-0.5 rounded font-black">
                          YOU
                        </span>
                      )}
                    </div>
                    {p.lastRoundScore > 0 && (
                      <span className="text-xs text-emerald-400 font-bold">
                        +{p.lastRoundScore} pts this round
                      </span>
                    )}
                  </div>
                </div>

                {/* Right: Total Score */}
                <div className="text-right bg-slate-950 px-3.5 py-1.5 rounded-xl border border-white/10 shadow-inner">
                  <div className="text-[10px] font-bold text-slate-400">TOTAL</div>
                  <div className="text-xl font-display font-black text-amber-400">
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
            <span className="text-amber-400 font-mono">{Math.ceil(countdown)}s</span>
          </div>
          <div className="w-full h-2 bg-slate-950 rounded-full border border-black overflow-hidden mb-3">
            <div
              className="h-full bg-gradient-to-r from-amber-400 to-emerald-400 transition-all duration-100 ease-linear"
              style={{ width: `${Math.min(100, Math.max(0, ((5.0 - countdown) / 5.0) * 100))}%` }}
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
