import React, { useState, useEffect } from 'react';
import { Users, Crown, Play, Settings, Copy, Check, Bot } from 'lucide-react';
import { soundSynthesizer } from '../services/soundSynthesizer.js';
import { audioEngine } from '../services/audioEngine.js';

export default function Lobby({
  room,
  player,
  micReady,
  onRequestMic,
  onCreateRoom,
  onJoinRoom,
  onStartGame,
  onUpdateSettings
}) {
  const [name, setName] = useState('');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [joinMode, setJoinMode] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const [testingMic, setTestingMic] = useState(false);
  const [micVerified, setMicVerified] = useState(() => audioEngine.isMicReady() || !!micReady);

  useEffect(() => {
    if (micReady) {
      setMicVerified(true);
    }
  }, [micReady]);

  // Single compact mic initialization check
  const handleEnableMic = async () => {
    soundSynthesizer.playUiSound('click');
    setTestingMic(true);
    try {
      audioEngine.unlockAudioContext();
      const stream = await audioEngine.initMicrophone();
      if (stream) {
        setMicVerified(true);
        if (onRequestMic) onRequestMic();
      }
    } catch (e) {
      console.warn('Microphone activation failed:', e);
    } finally {
      setTestingMic(false);
    }
  };

  const handleCopyCode = () => {
    if (!room?.id) return;
    soundSynthesizer.playUiSound('click');
    try {
      navigator.clipboard.writeText(room.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isNameValid = name.trim().length > 0;

  // 1. Entry / Join screen (When player is not in a room yet)
  if (!room) {
    return (
      <div className="w-full max-w-md mx-auto px-4 py-4 sm:py-6">
        <div className="arcade-card relative overflow-hidden text-center space-y-4">
          <div className="inline-block p-3 rounded-2xl bg-amber-400/20 border-2 border-amber-400 animate-bounce-in">
            <span className="text-3xl sm:text-4xl">🎙️</span>
          </div>

          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-white mb-1 tracking-tight">
              Ready to Play?
            </h2>
            <p className="text-slate-300 text-xs sm:text-sm px-2">
              Listen to sounds, record your mimicry, and vote on the best takes with friends!
            </p>
          </div>

          {/* Simplified Mic Button (Single Compact Button) */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/90 border-2 border-black shadow-[2px_2px_0px_#000]">
            <div className="text-left">
              <span className="text-xs font-black text-white block">Microphone</span>
              <span className="text-[11px] text-slate-400 block">
                {micVerified ? 'Microphone is ready for rounds' : 'Enable mic access before starting'}
              </span>
            </div>

            {micVerified ? (
              <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-400 text-xs font-black border-2 border-emerald-500/50">
                ✓ Mic Ready
              </span>
            ) : (
              <button
                type="button"
                onClick={handleEnableMic}
                disabled={testingMic}
                className="btn-arcade btn-arcade-gold text-xs py-1.5 px-3"
              >
                {testingMic ? 'Connecting...' : '🎙️ Enable Mic'}
              </button>
            )}
          </div>

          {/* Single Clean Name Input Bar */}
          <div className="text-left">
            <label className="block text-xs font-bold text-amber-300 mb-1.5">
              Your Name:
            </label>
            <input
              type="text"
              value={name}
              maxLength={20}
              onChange={(e) => {
                setName(e.target.value);
                if (errorMessage) setErrorMessage('');
              }}
              placeholder="Enter your name"
              className={`w-full bg-slate-900 border-2 rounded-xl px-3.5 py-2.5 text-sm sm:text-base font-bold text-white placeholder-slate-500 focus:outline-none shadow-[2px_2px_0px_#000] ${
                errorMessage ? 'border-rose-500' : 'border-black focus:border-amber-400'
              }`}
            />
            {errorMessage ? (
              <div className="mt-2 p-2 bg-rose-950/90 border border-rose-500 rounded-xl text-rose-300 text-xs font-bold animate-wiggle">
                ⚠️ {errorMessage}
              </div>
            ) : !isNameValid ? (
              <p className="text-[11px] text-slate-400 mt-1">
                Please enter your name to create or join a room.
              </p>
            ) : null}
          </div>

          {/* Action Tabs: Create Room vs Join Room */}
          {!joinMode ? (
            <div className="space-y-3 pt-1">
              <button
                disabled={!isNameValid}
                onClick={async () => {
                  if (!isNameValid) return;
                  if (!micVerified) {
                    await handleEnableMic();
                  }
                  soundSynthesizer.playUiSound('go');
                  onCreateRoom({ playerName: name.trim() });
                }}
                className={`btn-arcade w-full text-base sm:text-lg py-3.5 flex items-center justify-center gap-2 ${
                  isNameValid
                    ? 'btn-arcade-gold'
                    : 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed opacity-60 shadow-none'
                }`}
              >
                <Crown size={20} />
                <span>Create Room</span>
              </button>

              <button
                disabled={!isNameValid}
                onClick={async () => {
                  if (!isNameValid) return;
                  soundSynthesizer.playUiSound('click');
                  if (!micVerified) {
                    handleEnableMic().catch(() => {});
                  }
                  setJoinMode(true);
                }}
                className={`btn-arcade w-full text-sm sm:text-base py-3 flex items-center justify-center gap-2 ${
                  isNameValid
                    ? 'btn-arcade-cyan'
                    : 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed opacity-60 shadow-none'
                }`}
              >
                <Users size={18} />
                <span>Join Room</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3 pt-1">
              <div className="text-left">
                <label className="block text-xs font-bold text-cyan-300 mb-1.5">
                  Enter Room Code:
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={roomCodeInput}
                  onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                  placeholder="e.g. 4GLR"
                  className="w-full text-center tracking-widest uppercase font-mono text-2xl bg-slate-900 border-2 border-black rounded-xl px-4 py-2.5 font-black text-amber-400 focus:outline-none focus:border-cyan-400 shadow-[3px_3px_0px_#000]"
                />
              </div>

              <button
                disabled={!isNameValid || !roomCodeInput.trim()}
                onClick={async () => {
                  if (!isNameValid) {
                    setErrorMessage('Please enter your name first!');
                    return;
                  }
                  if (!roomCodeInput.trim()) {
                    setErrorMessage('Please enter a room code first!');
                    return;
                  }
                  if (!micVerified) {
                    await handleEnableMic();
                  }
                  soundSynthesizer.playUiSound('go');
                  onJoinRoom(
                    { roomId: roomCodeInput.trim(), playerName: name.trim() },
                    (err) => {
                      if (err) setErrorMessage(err);
                    }
                  );
                }}
                className={`btn-arcade w-full text-base sm:text-lg py-3.5 ${
                  isNameValid && roomCodeInput.trim()
                    ? 'btn-arcade-cyan'
                    : 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed opacity-60 shadow-none'
                }`}
              >
                <span>Enter Room 🚪</span>
              </button>

              <button
                onClick={() => {
                  soundSynthesizer.playUiSound('click');
                  setJoinMode(false);
                  setErrorMessage('');
                }}
                className="btn-arcade btn-arcade-dark w-full text-xs sm:text-sm py-2.5"
              >
                <span>Back</span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 2. Inside Room Lobby Screen
  const isHost = player?.isHost;
  const currentPlayers = room.players || [];

  return (
    <div className="w-full max-w-md mx-auto px-4 py-3 sm:py-4">
      <div className="arcade-card text-left space-y-4">
        {/* Room Code Share Banner */}
        <div className="bg-slate-950/90 border-2 border-black rounded-2xl p-3 sm:p-4 text-center shadow-[3px_3px_0px_#000]">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
            Share Room Code with Friends
          </span>
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="font-mono text-3xl sm:text-4xl font-black text-amber-400 tracking-wider">
              {room.id}
            </span>
            <button
              onClick={handleCopyCode}
              title="Copy Room Code"
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-white/10 text-white transition active:scale-95"
            >
              {copied ? (
                <Check size={18} className="text-emerald-400" />
              ) : (
                <Copy size={18} className="text-amber-300" />
              )}
            </button>
          </div>
          <span className="text-[11px] text-cyan-300 font-bold">
            {copied ? '✓ Code copied to clipboard!' : 'Give this code to friends on their phones!'}
          </span>
        </div>

        {/* Match Settings: Game Mode Selection */}
        <div className="bg-slate-900/80 border-2 border-black rounded-2xl p-3 shadow-[2px_2px_0px_#000]">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Bot size={16} className="text-amber-400" />
              <span className="text-xs font-black text-white">Game Mode</span>
            </div>
            <span className="text-[11px] text-slate-400 font-bold">
              {isHost ? 'Host selects mode' : room.settings?.gameMode === 'ai' ? 'AI Auto-Vote' : 'Player Vote'}
            </span>
          </div>

          {isHost ? (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  soundSynthesizer.playUiSound('click');
                  onUpdateSettings({ gameMode: 'player' });
                }}
                className={`py-2 px-2.5 rounded-xl font-black text-xs sm:text-sm border-2 border-black transition shadow-[2px_2px_0px_#000] flex items-center justify-center gap-1.5 ${
                  (room.settings?.gameMode || 'player') === 'player'
                    ? 'bg-amber-400 text-black border-black'
                    : 'bg-slate-800 text-white hover:bg-slate-700'
                }`}
              >
                <Users size={15} />
                <span>👥 Player Vote</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  soundSynthesizer.playUiSound('click');
                  onUpdateSettings({ gameMode: 'ai' });
                }}
                className={`py-2 px-2.5 rounded-xl font-black text-xs sm:text-sm border-2 border-black transition shadow-[2px_2px_0px_#000] flex items-center justify-center gap-1.5 ${
                  room.settings?.gameMode === 'ai'
                    ? 'bg-gradient-to-r from-cyan-400 to-blue-500 text-black border-black'
                    : 'bg-slate-800 text-white hover:bg-slate-700'
                }`}
              >
                <Bot size={15} />
                <span>🤖 AI Auto-Vote</span>
              </button>
            </div>
          ) : (
            <div className="bg-slate-950 border border-white/10 rounded-xl py-2 px-3 text-center font-black text-amber-300 text-xs sm:text-sm flex items-center justify-center gap-2">
              {room.settings?.gameMode === 'ai' ? (
                <>
                  <span className="text-cyan-400">🤖 AI Auto-Vote Mode</span>
                  <span className="text-[10px] text-slate-400 font-normal">(Audio Engine Scoring)</span>
                </>
              ) : (
                <>
                  <span className="text-amber-400">👥 Player Vote Mode</span>
                  <span className="text-[10px] text-slate-400 font-normal">(10s Voting Slider)</span>
                </>
              )}
            </div>
          )}

          <p className="text-[10px] text-slate-400 mt-2 px-1">
            {room.settings?.gameMode === 'ai'
              ? '🤖 AI mode algorithmically analyzes timing, rhythm & pitch accuracy against the sound clip.'
              : '👥 Players manually rate each other from 1 to 100 with a 10s voting countdown window.'}
          </p>
        </div>

        {/* Match Settings: Rounds Selection */}
        <div className="bg-slate-900/80 border-2 border-black rounded-2xl p-3 shadow-[2px_2px_0px_#000]">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Settings size={16} className="text-amber-400" />
              <span className="text-xs font-black text-white">Match Length</span>
            </div>
            <span className="text-[11px] text-slate-400 font-bold">
              {isHost ? 'Host sets rounds' : `${room.settings?.rounds || 3} Rounds`}
            </span>
          </div>

          {isHost ? (
            <div className="grid grid-cols-3 gap-2">
              {[3, 5, 7].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => {
                    soundSynthesizer.playUiSound('click');
                    onUpdateSettings({ rounds: num });
                  }}
                  className={`py-2 rounded-xl font-black text-xs sm:text-sm border-2 border-black transition shadow-[2px_2px_0px_#000] ${
                    room.settings?.rounds === num
                      ? 'bg-amber-400 text-black border-black'
                      : 'bg-slate-800 text-white hover:bg-slate-700'
                  }`}
                >
                  {num} Rounds
                </button>
              ))}
            </div>
          ) : (
            <div className="bg-slate-950 border border-white/10 rounded-xl py-2 text-center font-black text-amber-300 text-sm">
              {room.settings?.rounds || 3} Rounds Match
            </div>
          )}
        </div>

        {/* Players List (Clean text, no avatars/caricatures) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Users size={16} className="text-cyan-400" />
              <h3 className="text-xs sm:text-sm font-black text-white">
                Players in Lobby ({currentPlayers.length}/8)
              </h3>
            </div>
            <span className="text-[11px] text-emerald-400 font-bold animate-pulse">
              ● Live Lobby
            </span>
          </div>

          <div className="space-y-2">
            {currentPlayers.map((p) => {
              const isMe = p.id === player?.id;
              return (
                <div
                  key={p.id}
                  className={`flex items-center justify-between p-2.5 sm:p-3 rounded-xl border-2 border-black shadow-[2px_2px_0px_#000] ${
                    isMe
                      ? 'bg-amber-400/20 border-amber-400'
                      : 'bg-slate-900/90'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-black text-white text-sm">
                      {p.name}
                    </span>
                    {p.isHost && (
                      <span title="Host">
                        <Crown size={14} className="text-amber-400 fill-amber-400" />
                      </span>
                    )}
                    {isMe && (
                      <span className="text-[10px] bg-amber-400 text-black font-extrabold px-1.5 py-0.5 rounded">
                        You
                      </span>
                    )}
                  </div>

                  <span className="px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-[11px] font-black border border-emerald-500/40">
                    Ready ✓
                  </span>
                </div>
              );
            })}

            {currentPlayers.length < 2 && (
              <div className="p-3 rounded-xl border-2 border-dashed border-white/15 bg-slate-950/40 text-center">
                <span className="text-xs text-amber-300 font-bold block mb-0.5">
                  Waiting for friends to join...
                </span>
                <span className="text-[11px] text-slate-400 block">
                  Share room code <span className="font-mono font-black text-white">{room.id}</span>
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Microphone Status in Lobby */}
        <div className="p-3 rounded-2xl bg-slate-950/90 border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-between">
          <div>
            <span className="text-xs font-black text-white block">Microphone</span>
            <span className="text-[10px] text-slate-400 block">
              {micVerified ? 'Microphone enabled & ready' : 'Enable microphone before starting'}
            </span>
          </div>

          {micVerified ? (
            <span className="px-2.5 py-1 rounded-xl bg-emerald-500/20 text-emerald-400 text-xs font-black border border-emerald-500/40">
              ✓ Mic Ready
            </span>
          ) : (
            <button
              type="button"
              onClick={handleEnableMic}
              disabled={testingMic}
              className="btn-arcade btn-arcade-gold text-xs py-1.5 px-3"
            >
              {testingMic ? 'Connecting...' : '🎙️ Enable Mic'}
            </button>
          )}
        </div>

        {/* Start Game Action Button - Strict Minimum 2 Players */}
        <div className="pt-2">
          {isHost ? (
            currentPlayers.length < 2 ? (
              <div className="space-y-2">
                <button
                  disabled
                  type="button"
                  className="btn-arcade bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed w-full text-base sm:text-lg py-3.5 flex items-center justify-center gap-2 opacity-60 shadow-none"
                >
                  <Play size={20} className="fill-slate-500" />
                  <span>Start Game 🔥</span>
                </button>
                <div className="text-center p-2.5 rounded-xl bg-amber-500/15 border-2 border-amber-500/30 text-amber-300 text-xs sm:text-sm font-bold animate-pulse">
                  Waiting for at least 2 players to start (minimum 2 players)...
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={async () => {
                  if (!micVerified) {
                    await handleEnableMic();
                  }
                  soundSynthesizer.playUiSound('go');
                  if (onRequestMic) onRequestMic();
                  onStartGame();
                }}
                className="btn-arcade btn-arcade-gold w-full text-base sm:text-lg py-3.5 flex items-center justify-center gap-2 shadow-[3px_3px_0px_#000]"
              >
                <Play size={20} className="fill-black" />
                <span>Start Game 🔥</span>
              </button>
            )
          ) : (
            <div className="text-center p-3.5 bg-slate-900/90 border-2 border-black rounded-xl shadow-[2px_2px_0px_#000]">
              <div className="inline-block animate-pulse text-xl mb-1">⏳</div>
              <p className="font-extrabold text-amber-300 text-sm">
                Waiting for Host to start the match...
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {currentPlayers.length < 2
                  ? 'Waiting for at least 2 players to start (minimum 2 players)...'
                  : 'Get ready to mimic the sound on your mic!'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
