import React, { useEffect, useState, useRef } from 'react';
import { Volume2, Sparkles, Check, Users } from 'lucide-react';
import { soundSynthesizer } from '../services/soundSynthesizer.js';
import CharacterAvatar from './CharacterAvatar.jsx';

export default function RevealScreen({
  room,
  player,
  localRecordedAudioUrl,
  onVote
}) {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [voteValue, setVoteValue] = useState(75);
  const [hasVoted, setHasVoted] = useState(false);
  const audioRef = useRef(null);

  const recordings = room?.recordings || [];
  const revealIndex = Math.max(0, room?.revealIndex || 0);
  const revealPhase = room?.revealPhase || 'VOTING'; // 'VOTING' or 'RESULT'
  const timer = room?.timer ?? 0;

  const currentRec = recordings[revealIndex] || recordings[0] || null;

  // Active contestant info
  const isCurrentUser = currentRec?.playerId === player?.id;
  const contestantPlayer = (room?.players || []).find(p => p.id === currentRec?.playerId);
  const contestantCharacter = currentRec?.character || contestantPlayer?.character || null;

  const humanAudioSource = (isCurrentUser && localRecordedAudioUrl)
    || currentRec?.audioDataUrl
    || currentRec?.recordedAudioUrl;

  // Reset vote state when contestant changes
  useEffect(() => {
    setHasVoted(false);
    setVoteValue(75);
  }, [revealIndex]);

  // Check if player has already voted in room state
  useEffect(() => {
    if (currentRec?.votes && player?.id && currentRec.votes[player.id] !== undefined) {
      setHasVoted(true);
      setVoteValue(currentRec.votes[player.id]);
    }
  }, [currentRec?.votes, player?.id]);

  // Synchronized audio playback: automatically play contestant take once on reveal
  useEffect(() => {
    setIsPlayingAudio(false);

    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.src = '';
      } catch (e) {}
      audioRef.current = null;
    }

    if (humanAudioSource) {
      try {
        const audio = new Audio(humanAudioSource);
        audio.volume = 1.0;
        audioRef.current = audio;
        setIsPlayingAudio(true);

        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch((e) => {
            console.warn('Playback error on recorded audio:', e);
            setIsPlayingAudio(false);
          });
        }

        audio.onended = () => setIsPlayingAudio(false);
        audio.onerror = () => setIsPlayingAudio(false);
      } catch (e) {
        setIsPlayingAudio(false);
      }
    }

    return () => {
      soundSynthesizer.stopAll();
      if (audioRef.current) {
        try {
          audioRef.current.pause();
          audioRef.current.src = '';
        } catch (e) {}
        audioRef.current = null;
      }
    };
  }, [revealIndex, humanAudioSource]);

  const handleCastVote = () => {
    if (hasVoted || isCurrentUser) return;
    soundSynthesizer.playUiSound('click');
    setHasVoted(true);
    if (onVote) {
      onVote(voteValue);
    }
  };

  if (!currentRec) {
    return (
      <div className="w-full max-w-md mx-auto px-4 py-8 text-center arcade-card">
        <div className="text-4xl animate-bounce mb-3">🎙️</div>
        <h3 className="text-xl font-bold text-amber-400 mb-2">Preparing Contestant Takes...</h3>
        <p className="text-slate-300 text-sm">Synchronizing audio submissions across all players.</p>
      </div>
    );
  }

  const votesMap = currentRec.votes || {};
  const totalVotesCount = Object.keys(votesMap).length;
  const eligibleVotersCount = Math.max(1, (room?.players?.length || 2) - 1);

  return (
    <div className="w-full max-w-lg mx-auto px-3 sm:px-4 py-4 select-none">
      <div className="arcade-card relative overflow-hidden text-center space-y-4">
        {/* Top Header Tracker */}
        <div className="flex items-center justify-between pb-2 border-b border-white/10 text-xs font-bold text-slate-300">
          <div className="flex items-center gap-1.5 text-amber-400">
            <Sparkles size={15} />
            <span>Contestant {revealIndex + 1} of {recordings.length}</span>
          </div>

          <div className="flex items-center gap-1 bg-slate-900 px-3 py-1 rounded-full border border-white/10 text-cyan-400 font-mono text-xs">
            <span>⏳</span>
            <span>{timer}s</span>
          </div>
        </div>

        {/* Center: Contestant Avatar & Stage Name */}
        <div className="flex flex-col items-center justify-center pt-2">
          <CharacterAvatar
            avatar={currentRec.avatar || contestantCharacter?.avatar || '👑'}
            name={currentRec.playerName}
            character={contestantCharacter}
            isTalking={isPlayingAudio}
            size="xl"
          />

          <div className="flex items-center gap-2 mt-3">
            <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {currentRec.playerName}
            </h3>
            {isCurrentUser && (
              <span className="text-[10px] bg-amber-400 text-black px-2 py-0.5 rounded-full font-black">
                YOU
              </span>
            )}
          </div>

          {contestantCharacter && (
            <div className="text-xs text-amber-300 font-bold font-cairo mt-0.5">
              "{contestantCharacter.nameAr || contestantCharacter.name}"
            </div>
          )}
        </div>

        {/* Animated Soundwave Indicator while playing */}
        <div className="flex items-center justify-center gap-1.5 h-12 w-full max-w-xs mx-auto bg-slate-950/80 rounded-2xl border-2 border-black p-2.5">
          {isPlayingAudio ? (
            Array.from({ length: 14 }).map((_, i) => (
              <div
                key={i}
                className="w-1.5 bg-gradient-to-t from-cyan-400 to-amber-400 rounded-full animate-pulse"
                style={{
                  height: `${Math.max(25, Math.sin(i * 0.8 + Date.now() / 180) * 80 + 20)}%`,
                  animationDelay: `${i * 60}ms`
                }}
              />
            ))
          ) : (
            <div className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
              <Volume2 size={16} className="text-slate-500" />
              <span>Voice Take Finished</span>
            </div>
          )}
        </div>

        {/* SECTION A: VOTING PHASE */}
        {revealPhase === 'VOTING' && (
          <div className="mt-4 p-4 rounded-3xl bg-slate-950/90 border-2 border-black shadow-[3px_3px_0px_#000] text-center">
            {isCurrentUser ? (
              // Active Contestant View (Cannot vote for self)
              <div className="py-4 space-y-2">
                <div className="text-3xl animate-bounce">🎙️</div>
                <h4 className="text-base sm:text-lg font-black text-amber-400">
                  اللاعبون الآخرون يقيمون صوتك الآن ⏳
                </h4>
                <p className="text-xs text-slate-400 font-bold">
                  Other players are rating your take (1 to 100)...
                </p>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 border border-white/10 text-xs font-mono font-bold text-emerald-400 mt-2">
                  <Users size={14} />
                  <span>{totalVotesCount} / {eligibleVotersCount} Voted</span>
                </div>
              </div>
            ) : (
              // Other Players View: 1 to 100 Voting Slider
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-300">
                    Rate {currentRec.playerName}'s Sound:
                  </span>
                  <span className="font-display font-black text-3xl text-amber-400">
                    {voteValue}
                    <span className="text-xs font-bold text-slate-400"> / 100</span>
                  </span>
                </div>

                {/* 1 to 100 Slider */}
                <div className="space-y-2">
                  <input
                    type="range"
                    min="1"
                    max="100"
                    disabled={hasVoted}
                    value={voteValue}
                    onChange={(e) => setVoteValue(Number(e.target.value))}
                    className="w-full h-3 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-amber-400 border border-black"
                  />

                  {/* Preset Quick Buttons */}
                  {!hasVoted && (
                    <div className="grid grid-cols-4 gap-2 pt-1">
                      {[25, 50, 75, 100].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setVoteValue(val)}
                          className={`py-1 rounded-xl text-xs font-black border border-black transition ${
                            voteValue === val
                              ? 'bg-amber-400 text-black'
                              : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                          }`}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Submit Vote Button */}
                {hasVoted ? (
                  <div className="p-3 rounded-2xl bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400 font-black text-sm flex items-center justify-center gap-2">
                    <Check size={18} />
                    <span>تم تسجيل صوتك ({voteValue} / 100) ✅</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleCastVote}
                    className="btn-arcade btn-arcade-gold w-full text-base sm:text-lg py-3 flex items-center justify-center gap-2 shadow-[2px_2px_0px_#000]"
                  >
                    <span>صوّت (Submit Vote) 🗳️</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* SECTION B: RESULT REVEAL PHASE */}
        {revealPhase === 'RESULT' && (
          <div className="mt-4 p-5 rounded-3xl bg-slate-950/95 border-3 border-amber-400 shadow-[4px_4px_0px_#000] text-center animate-bounce-in space-y-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block">
              متوسط تقييم اللاعبين (Peer Voted Score)
            </span>

            {/* Prominent Average Score Display */}
            <div className="flex items-baseline justify-center gap-1.5 my-2">
              <span className="font-display font-black text-6xl sm:text-7xl text-amber-400">
                {currentRec.score ?? 50}
              </span>
              <span className="text-2xl font-black text-slate-500">/ 100</span>
            </div>

            <div className="text-xs font-bold text-emerald-400 flex items-center justify-center gap-1.5">
              <span>🌟</span>
              <span>
                Based on {totalVotesCount} {totalVotesCount === 1 ? 'player vote' : 'player votes'}!
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
