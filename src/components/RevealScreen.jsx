import React, { useEffect, useState, useRef } from 'react';
import { Volume2, Play, Pause, ChevronRight, Trophy, Sparkles, FastForward, Lock } from 'lucide-react';
import { soundSynthesizer } from '../services/soundSynthesizer.js';
import CharacterAvatar from './CharacterAvatar.jsx';

export default function RevealScreen({
  room,
  player,
  localRecordedAudioUrl,
  onNextRevealStep
}) {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const audioRef = useRef(null);
  const timerRef = useRef(null);

  const sound = room?.roundSound;
  const recordings = room?.recordings || [];
  const revealIndex = Math.max(0, room?.revealIndex || 0);
  const currentRec = recordings[revealIndex] || null;
  const isHost = player?.isHost;
  const isLastPlayer = revealIndex >= recordings.length - 1;

  // Match contestant character profile
  const contestantPlayer = (room?.players || []).find(p => p.id === currentRec?.playerId);
  const contestantCharacter = currentRec?.character || contestantPlayer?.character || null;

  // Resolve audio source: Human mic blob/dataUrl vs Bot procedural mimic
  const isCurrentUser = currentRec?.playerId === player?.id;
  const isAI = Boolean(currentRec?.isBot || currentRec?.isAI);
  const humanAudioSource = (isCurrentUser && localRecordedAudioUrl)
    || currentRec?.recordedAudioUrl
    || currentRec?.audioDataUrl;

  // Auto-play contestant's recorded audio & start step countdown
  useEffect(() => {
    setIsPlayingAudio(false);
    setCountdown(totalStepDuration);

    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.src = '';
      } catch (e) {}
      audioRef.current = null;
    }

    if (currentRec) {
      if (!isAI && humanAudioSource) {
        // Human player: strictly play their recorded mic capture directly!
        try {
          const audio = new Audio(humanAudioSource);
          audio.volume = 1.0;
          audio.muted = false;
          audioRef.current = audio;
          setIsPlayingAudio(true);

          const playPromise = audio.play();
          if (playPromise !== undefined) {
            playPromise.catch((e) => {
              console.warn('Playback error on recorded audio (likely user gesture needed):', e);
              setIsPlayingAudio(false);
            });
          }

          audio.onended = () => setIsPlayingAudio(false);
          audio.onerror = (err) => {
            console.warn('Audio onerror on recorded mic source:', err);
            setIsPlayingAudio(false);
          };
        } catch (e) {
          console.warn('Failed to initialize Audio for mic recording:', e);
          setIsPlayingAudio(false);
        }
      } else if (isAI) {
        // AI Bot: procedural mimic synthesis
        setIsPlayingAudio(true);
        soundSynthesizer.playBotMimic(sound, currentRec, () => setIsPlayingAudio(false));
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
  }, [revealIndex, currentRec?.playerId, humanAudioSource, isAI]);

  // Replay contestant vocal take
  const handleTogglePlay = () => {
    soundSynthesizer.playUiSound('click');
    if (isPlayingAudio) {
      soundSynthesizer.stopAll();
      if (audioRef.current) {
        try { audioRef.current.pause(); } catch (e) {}
      }
      setIsPlayingAudio(false);
    } else {
      if (!isAI && humanAudioSource) {
        const audio = new Audio(humanAudioSource);
        audio.volume = 1.0;
        audio.muted = false;
        audioRef.current = audio;
        setIsPlayingAudio(true);
        const p = audio.play();
        if (p !== undefined) {
          p.catch(() => setIsPlayingAudio(false));
        }
        audio.onended = () => setIsPlayingAudio(false);
        audio.onerror = () => setIsPlayingAudio(false);
      } else if (isAI) {
        setIsPlayingAudio(true);
        soundSynthesizer.playBotMimic(sound, currentRec, () => setIsPlayingAudio(false));
      }
    }
  };

  // Only allow host skip during the 1.5s reaction buffer (prevent immediate cutoffs)
  const canSkip = isHost && countdown <= 1.5;

  const handleManualSkip = () => {
    if (!canSkip) return;
    soundSynthesizer.playUiSound('click');
    if (timerRef.current) clearInterval(timerRef.current);
    onNextRevealStep();
  };

  if (!currentRec) {
    return (
      <div className="arcade-card text-center p-8 max-w-md mx-auto">
        <div className="text-4xl animate-bounce mb-3">🎙️</div>
        <h3 className="text-xl font-bold text-amber-400">Loading Contestant Vocal Reveals...</h3>
      </div>
    );
  }

  const progressPercent = Math.min(100, Math.max(0, ((totalStepDuration - countdown) / totalStepDuration) * 100));

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-4">
      <div className="arcade-card relative overflow-hidden text-center">
        {/* Header Indicator */}
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10 text-xs font-bold text-slate-300">
          <div className="flex items-center gap-1.5">
            <Sparkles size={16} className="text-amber-400" />
            <span>Vocal Mimic Score & Feedback</span>
          </div>
          <div className="bg-slate-900 border border-white/10 px-3 py-1 rounded-full text-amber-300 font-mono">
            Contestant {revealIndex + 1} of {recordings.length}
          </div>
        </div>

        {/* Player & Animated Caricature Avatar */}
        <div className="flex flex-col items-center justify-center my-3">
          <CharacterAvatar
            avatar={currentRec.avatar || contestantCharacter?.avatar || '👑'}
            name={currentRec.playerName}
            character={contestantCharacter}
            isTalking={isPlayingAudio}
            size="xl"
          />

          <div className="flex items-center gap-2 mt-2">
            <h3 className="text-2xl font-black text-white">{currentRec.playerName}</h3>
            {currentRec.isBot && (
              <span className="text-[10px] bg-purple-500/30 text-purple-300 px-2 py-0.5 rounded-full font-bold border border-purple-400/40">
                BOT
              </span>
            )}
            {isCurrentUser && (
              <span className="text-[10px] bg-amber-400 text-black px-2 py-0.5 rounded-full font-black">
                YOU
              </span>
            )}
          </div>

          {contestantCharacter && (
            <div className="text-xs text-amber-300 font-bold font-cairo mt-1">
              "{contestantCharacter.quote || contestantCharacter.role}"
            </div>
          )}
        </div>

        {/* Listen / Replay Audio Button */}
        <div className="my-3">
          <button
            onClick={handleTogglePlay}
            className={`btn-arcade py-2.5 px-6 text-sm inline-flex items-center gap-2 ${
              isPlayingAudio ? 'btn-arcade-dark border-emerald-400' : 'btn-arcade-gold'
            }`}
          >
            {isPlayingAudio ? <Pause size={17} /> : <Volume2 size={17} />}
            <span>
              {isPlayingAudio
                ? 'Listening to Vocal Take... 🔊'
                : isCurrentUser
                ? 'Replay Your Mic Recording 🎧'
                : `Replay ${currentRec.playerName}'s Take 🎧`}
            </span>
          </button>
        </div>

        {/* Big Score Card */}
        <div className="relative my-3 p-5 rounded-3xl bg-slate-950/80 border-3 border-black shadow-[5px_5px_0px_#000]">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
            Egyptian Audio Similarity Accuracy
          </div>

          {/* Big Score Number */}
          <div className="flex items-baseline justify-center gap-1 my-1">
            <span
              className="font-display font-black text-6xl md:text-7xl"
              style={{ color: currentRec.tier?.color || '#fbbf24' }}
            >
              {currentRec.score}
            </span>
            <span className="text-2xl font-black text-slate-400">/ 100</span>
          </div>

          {/* Comedic Egyptian Badge */}
          <div className="my-2">
            <span
              className="arcade-badge text-base md:text-lg py-1 px-4 text-black font-black"
              style={{ backgroundColor: currentRec.tier?.color || '#fbbf24' }}
            >
              {currentRec.tier?.badge}
            </span>
          </div>

          {/* Funny Commentary */}
          <p className="text-amber-200/90 text-sm font-bold mt-2 px-4 italic">
            "{currentRec.tier?.reaction}"
          </p>
        </div>

        {/* Pitch, Rhythm & Energy Gauges */}
        <div className="grid grid-cols-3 gap-2 my-4 text-left">
          {/* Pitch */}
          <div className="bg-slate-900/90 p-2.5 rounded-2xl border-2 border-black shadow-[2px_2px_0px_#000]">
            <div className="flex justify-between items-center text-xs font-bold text-slate-300 mb-1">
              <span>🎯 Pitch</span>
              <span className="text-cyan-400 font-mono">{currentRec.pitchScore || 70}%</span>
            </div>
            <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-black">
              <div
                className="h-full bg-cyan-400 transition-all duration-700"
                style={{ width: `${currentRec.pitchScore || 70}%` }}
              />
            </div>
          </div>

          {/* Rhythm */}
          <div className="bg-slate-900/90 p-2.5 rounded-2xl border-2 border-black shadow-[2px_2px_0px_#000]">
            <div className="flex justify-between items-center text-xs font-bold text-slate-300 mb-1">
              <span>⏱️ Rhythm</span>
              <span className="text-amber-400 font-mono">{currentRec.rhythmScore || 65}%</span>
            </div>
            <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-black">
              <div
                className="h-full bg-amber-400 transition-all duration-700"
                style={{ width: `${currentRec.rhythmScore || 65}%` }}
              />
            </div>
          </div>

          {/* Energy */}
          <div className="bg-slate-900/90 p-2.5 rounded-2xl border-2 border-black shadow-[2px_2px_0px_#000]">
            <div className="flex justify-between items-center text-xs font-bold text-slate-300 mb-1">
              <span>⚡ Energy</span>
              <span className="text-pink-400 font-mono">{currentRec.energyScore || 80}%</span>
            </div>
            <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-black">
              <div
                className="h-full bg-pink-400 transition-all duration-700"
                style={{ width: `${currentRec.energyScore || 80}%` }}
              />
            </div>
          </div>
        </div>

        {/* Host Explicit Next Contestant Controls */}
        <div className="mt-4 pt-3 border-t border-white/10">
          {isHost ? (
            <button
              onClick={() => {
                soundSynthesizer.playUiSound('go');
                onNextRevealStep();
              }}
              className="btn-arcade btn-arcade-gold w-full text-base sm:text-lg py-3.5 flex items-center justify-center gap-2 shadow-[3px_3px_0px_#000]"
            >
              <span>
                {isLastPlayer
                  ? 'View Leaderboard 🏆 (عرض النتائج)'
                  : 'Next Contestant ⏭️ (المتسابق التالي)'}
              </span>
              <ChevronRight size={20} />
            </button>
          ) : (
            <div className="text-center p-3 bg-slate-900/90 border border-white/10 rounded-2xl">
              <span className="text-xs sm:text-sm font-bold text-amber-300 animate-pulse flex items-center justify-center gap-2">
                <span>⏳</span>
                <span>Waiting for Host to advance to the next contestant...</span>
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
