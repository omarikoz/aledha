import React, { useEffect, useState, useRef } from 'react';
import { Volume2, Sparkles, Check, Users, Clock, Bot, Activity, Zap } from 'lucide-react';
import { soundSynthesizer } from '../services/soundSynthesizer.js';
import { audioEngine } from '../services/audioEngine.js';

export default function RevealScreen({
  room,
  player,
  localRecordedAudioUrl,
  onVote
}) {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [voteValue, setVoteValue] = useState(75);
  const [hasVoted, setHasVoted] = useState(false);
  const [localAiAnalysis, setLocalAiAnalysis] = useState(null);
  const audioRef = useRef(null);

  const recordings = room?.recordings || [];
  const revealIndex = Math.max(0, room?.revealIndex || 0);
  const revealPhase = room?.revealPhase || 'VOTING'; // 'PLAYING', 'VOTING', or 'RESULT'
  const timer = room?.timer ?? 0;
  const isAiMode = room?.settings?.gameMode === 'ai';

  const currentRec = recordings[revealIndex] || recordings[0] || null;

  // Active contestant info & broadcasted audio source
  const isCurrentUser = currentRec?.playerId === player?.id;
  const rawAudioSource = currentRec?.audioData
    || currentRec?.audioDataUrl
    || currentRec?.recordedAudioUrl
    || (isCurrentUser ? localRecordedAudioUrl : null);

  // Reset vote state when contestant changes
  useEffect(() => {
    setHasVoted(false);
    setVoteValue(75);
    setLocalAiAnalysis(null);
  }, [revealIndex]);

  // Check if player has already voted in room state
  useEffect(() => {
    if (currentRec?.votes && player?.id && currentRec.votes[player.id] !== undefined) {
      setHasVoted(true);
      setVoteValue(currentRec.votes[player.id]);
    }
  }, [currentRec?.votes, player?.id]);

  // On-demand AI accuracy analysis fallback if not already provided
  useEffect(() => {
    if (!isAiMode) return;
    if (currentRec?.aiDetails && currentRec.aiDetails.timingMatch !== undefined) {
      setLocalAiAnalysis(currentRec.aiDetails);
      return;
    }

    let isMounted = true;
    const computeFallback = async () => {
      try {
        if (!rawAudioSource || !room?.roundSound) return;
        const pBuffer = await audioEngine.decodeAudio(rawAudioSource);
        const rBuffer = await soundSynthesizer.getReferenceAudioBuffer(room.roundSound);
        if (pBuffer && rBuffer && isMounted) {
          const res = audioEngine.calculateAiAccuracy(pBuffer, rBuffer);
          setLocalAiAnalysis(res);
        }
      } catch (e) {
        console.warn('Local fallback AI evaluation error:', e);
      }
    };
    computeFallback();

    return () => { isMounted = false; };
  }, [isAiMode, currentRec?.playerId, rawAudioSource, room?.roundSound]);

  // Synchronized audio broadcast playback: Play contestant take to EVERYONE in the room
  useEffect(() => {
    setIsPlayingAudio(false);
    let activeBlobUrl = null;

    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.src = '';
      } catch (e) {}
      audioRef.current = null;
    }

    if (rawAudioSource) {
      try {
        let playUrl = rawAudioSource;

        // Convert Base64 data string to local Blob URL for universal audio decoder support
        if (typeof rawAudioSource === 'string' && rawAudioSource.startsWith('data:')) {
          try {
            const parts = rawAudioSource.split(',');
            const mime = parts[0].match(/:(.*?);/)?.[1] || 'audio/webm';
            const bstr = atob(parts[1]);
            let n = bstr.length;
            const u8arr = new Uint8Array(n);
            while (n--) {
              u8arr[n] = bstr.charCodeAt(n);
            }
            const blob = new Blob([u8arr], { type: mime });
            activeBlobUrl = URL.createObjectURL(blob);
            playUrl = activeBlobUrl;
          } catch (convErr) {
            playUrl = rawAudioSource;
          }
        }

        const audio = new Audio(playUrl);
        audio.volume = 1.0;
        audioRef.current = audio;
        setIsPlayingAudio(true);

        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch((e) => {
            console.warn('Audio playback error on contestant take:', e);
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
      if (activeBlobUrl) {
        try { URL.revokeObjectURL(activeBlobUrl); } catch (e) {}
      }
    };
  }, [revealIndex, rawAudioSource]);

  const handleCastVote = () => {
    if (hasVoted || isCurrentUser || isAiMode) return;
    soundSynthesizer.playUiSound('click');
    setHasVoted(true);
    if (onVote) {
      onVote(voteValue);
    }
  };

  // Auto-submit current vote when 10s voting timer expires
  useEffect(() => {
    if (!isAiMode && revealPhase === 'VOTING' && timer <= 1 && !hasVoted && !isCurrentUser) {
      handleCastVote();
    }
  }, [isAiMode, revealPhase, timer, hasVoted, isCurrentUser]);

  if (!currentRec) {
    return (
      <div className="w-full max-w-md mx-auto px-4 py-8 text-center arcade-card">
        <div className="text-4xl animate-bounce mb-3">🎙️</div>
        <h3 className="text-xl font-bold text-amber-400 mb-2">Preparing Contestant Takes...</h3>
        <p className="text-slate-300 text-sm">Broadcasting audio recordings across all connected players.</p>
      </div>
    );
  }

  const votesMap = currentRec.votes || {};
  const totalVotesCount = Object.keys(votesMap).length;
  const eligibleVotersCount = Math.max(1, (room?.players?.length || 2) - 1);

  // AI Details
  const aiDetails = currentRec.aiDetails || localAiAnalysis;
  const timingScore = aiDetails?.timingMatch ?? (currentRec.score ?? 50);
  const toneScore = aiDetails?.toneMatch ?? (currentRec.score ?? 50);
  const overallAiScore = currentRec.aiScore ?? currentRec.score ?? 50;

  return (
    <div className="w-full max-w-lg mx-auto px-3 sm:px-4 py-3 select-none">
      <div className="arcade-card relative overflow-hidden text-center space-y-3 sm:space-y-4">
        {/* Top Header Tracker */}
        <div className="flex items-center justify-between pb-2 border-b border-white/10 text-xs font-bold text-slate-300">
          <div className="flex items-center gap-1.5 text-amber-400">
            <Sparkles size={15} />
            <span>Contestant {revealIndex + 1} of {recordings.length}</span>
          </div>

          {/* Mode-Specific Status Pill */}
          {isAiMode ? (
            <div className="flex items-center gap-1.5 bg-cyan-500/20 px-3 py-1 rounded-full border border-cyan-400 text-cyan-300 font-mono text-xs font-black">
              <Bot size={14} />
              <span>AI Auto-Vote</span>
            </div>
          ) : revealPhase === 'VOTING' ? (
            <div className="flex items-center gap-1.5 bg-amber-400/20 px-3 py-1 rounded-full border border-amber-400 text-amber-300 font-mono text-xs font-black animate-pulse">
              <Clock size={14} />
              <span>Voting ends in: {Math.max(1, timer)}s</span>
            </div>
          ) : revealPhase === 'PLAYING' ? (
            <div className="flex items-center gap-1.5 bg-cyan-400/20 px-3 py-1 rounded-full border border-cyan-400 text-cyan-300 text-xs font-bold animate-pulse">
              <Volume2 size={14} />
              <span>Listening to take...</span>
            </div>
          ) : (
            <div className="text-xs text-slate-400 font-semibold">
              Results
            </div>
          )}
        </div>

        {/* Center: Contestant Name */}
        <div className="flex flex-col items-center justify-center pt-1">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-slate-900 border-2 border-black flex items-center justify-center text-3xl shadow-[3px_3px_0px_#000]">
            🎙️
          </div>

          <div className="flex items-center gap-2 mt-2">
            <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              {currentRec.playerName}
            </h3>
            {isCurrentUser && (
              <span className="text-[10px] bg-amber-400 text-black px-2 py-0.5 rounded-full font-black">
                YOU
              </span>
            )}
          </div>
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

        {/* ------------------------------------------------------------- */}
        {/* MODE 1: "AI AUTO-VOTE" MODE (NO MANUAL SLIDER)                 */}
        {/* ------------------------------------------------------------- */}
        {isAiMode ? (
          <div className="mt-3 p-4 sm:p-5 rounded-3xl bg-slate-950/95 border-2 border-cyan-400/60 shadow-[4px_4px_0px_#000] text-center space-y-3.5">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-cyan-500/15 border border-cyan-400 text-cyan-300 text-xs font-black">
              <Bot size={15} />
              <span>ALGORITHMIC AUDIO ACCURACY</span>
            </div>

            {/* Big AI Score Display */}
            <div className="py-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                AI Accuracy Score
              </span>
              <div className="flex items-baseline justify-center gap-1.5">
                <span className="font-display font-black text-6xl sm:text-7xl bg-gradient-to-r from-amber-400 via-yellow-300 to-cyan-400 bg-clip-text text-transparent">
                  {overallAiScore}
                </span>
                <span className="text-2xl font-black text-slate-500">/ 100</span>
              </div>
            </div>

            {/* Deterministic Feature Breakdown Cards */}
            <div className="grid grid-cols-2 gap-2.5 pt-1 text-left">
              {/* Card 1: Timing & Rhythm Match (50% + 25%) */}
              <div className="p-3 rounded-2xl bg-slate-900 border border-white/10 shadow-[2px_2px_0px_#000]">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1 text-amber-300 font-bold text-xs">
                    <Activity size={13} />
                    <span>Timing Match</span>
                  </div>
                  <span className="font-mono font-black text-xs text-amber-400">
                    {timingScore}%
                  </span>
                </div>
                {/* Progress Bar */}
                <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-black">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-yellow-300 transition-all duration-500 rounded-full"
                    style={{ width: `${Math.max(4, timingScore)}%` }}
                  />
                </div>
                <span className="text-[9px] text-slate-400 mt-1 block">
                  50ms RMS Envelope & Rhythm
                </span>
              </div>

              {/* Card 2: Tone Match (25%) */}
              <div className="p-3 rounded-2xl bg-slate-900 border border-white/10 shadow-[2px_2px_0px_#000]">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1 text-cyan-300 font-bold text-xs">
                    <Zap size={13} />
                    <span>Tone Match</span>
                  </div>
                  <span className="font-mono font-black text-xs text-cyan-400">
                    {toneScore}%
                  </span>
                </div>
                {/* Progress Bar */}
                <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-black">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-blue-400 transition-all duration-500 rounded-full"
                    style={{ width: `${Math.max(4, toneScore)}%` }}
                  />
                </div>
                <span className="text-[9px] text-slate-400 mt-1 block">
                  FFT Spectral Centroid Match
                </span>
              </div>
            </div>

            <p className="text-[10px] text-slate-400 pt-1 font-semibold">
              Deterministic audio comparison • Zero manual voting needed
            </p>
          </div>
        ) : (
          /* ------------------------------------------------------------- */
          /* MODE 2: "PLAYER VOTE" MODE (10-SECOND VOTING SLIDER)           */
          /* ------------------------------------------------------------- */
          <>
            {revealPhase === 'VOTING' && (
              <div className="mt-3 p-4 rounded-3xl bg-slate-950/90 border-2 border-black shadow-[3px_3px_0px_#000] text-center">
                {/* Prominent 10-Second Countdown Window Display */}
                <div className="flex items-center justify-center gap-2 p-2 rounded-2xl bg-amber-500/15 border-2 border-amber-400/40 text-amber-300 font-black text-xs sm:text-sm mb-3 animate-pulse">
                  <Clock size={16} />
                  <span>Voting ends in: {Math.max(1, timer)}s</span>
                </div>

                {isCurrentUser ? (
                  // Active Contestant View (Cannot vote for self)
                  <div className="py-4 space-y-2">
                    <div className="text-3xl animate-bounce">🎙️</div>
                    <h4 className="text-base sm:text-lg font-black text-amber-400">
                      Other players are voting on your take!
                    </h4>
                    <p className="text-xs text-slate-400 font-bold">
                      Voting window is 10 seconds
                    </p>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 border border-white/10 text-xs font-mono font-bold text-emerald-400 mt-2">
                      <Users size={14} />
                      <span>{totalVotesCount} / {eligibleVotersCount} Voted</span>
                    </div>
                  </div>
                ) : (
                  // Other Players View: 10s 1 to 100 Voting Slider
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
                        <span>Vote Recorded ({voteValue} / 100) ✓</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handleCastVote}
                        className="btn-arcade btn-arcade-gold w-full text-base sm:text-lg py-3 flex items-center justify-center gap-2 shadow-[2px_2px_0px_#000]"
                      >
                        <span>Submit Vote 🗳️</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* RESULT REVEAL PHASE FOR PLAYER VOTE */}
            {revealPhase === 'RESULT' && (
              <div className="mt-3 p-5 rounded-3xl bg-slate-950/95 border-3 border-amber-400 shadow-[4px_4px_0px_#000] text-center animate-bounce-in space-y-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block">
                  Peer Voted Score
                </span>

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
          </>
        )}
      </div>
    </div>
  );
}
