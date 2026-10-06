import React, { useState } from 'react';
import { Volume2, Users, Copy, Check, Sparkles, Music } from 'lucide-react';
import { soundSynthesizer } from '../services/soundSynthesizer.js';

export default function Header({
  room,
  player,
  micReady,
  onRequestMic,
  onOpenSoundTester,
  isMuted = false,
  onToggleMute
}) {
  const [copied, setCopied] = useState(false);

  const handleCopyCode = () => {
    if (!room?.id) return;
    navigator.clipboard.writeText(room.id);
    soundSynthesizer.playUiSound('click');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <header className="w-full max-w-5xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 sm:gap-4 border-b border-white/10 mb-3 sm:mb-4">
      {/* Logo & Game Title */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-xl sm:text-2xl border-2 border-black shadow-[2px_2px_0px_#000] sm:shadow-[3px_3px_0px_#000] animate-float">
          🎤
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-white flex items-center gap-1.5">
              <span>Aledha</span>
            </h1>
          </div>
          <p className="text-[11px] sm:text-xs text-amber-200/80 font-semibold hidden sm:block">
            Voice Mimic Party Game
          </p>
        </div>
      </div>

      {/* Center Room Code Pill if in Room */}
      {room && (
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={handleCopyCode}
            title="Click to copy room code"
            className="flex items-center gap-1.5 sm:gap-2 bg-slate-900/90 hover:bg-slate-800 border-2 border-black px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-xl shadow-[2px_2px_0px_#000] sm:shadow-[3px_3px_0px_#000] transition active:scale-95 text-xs sm:text-sm font-bold text-amber-300"
          >
            <span className="text-slate-400 text-[10px] sm:text-xs">Room:</span>
            <span className="font-mono tracking-widest text-sm sm:text-base text-white">{room.id}</span>
            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} className="text-slate-400" />}
          </button>

          {/* Players count */}
          <div className="hidden sm:flex items-center gap-1.5 bg-purple-950/80 border-2 border-black px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl shadow-[2px_2px_0px_#000] text-xs font-bold text-purple-200">
            <Users size={14} />
            <span>{room.players?.length || 1} Players</span>
          </div>
        </div>
      )}

      {/* Right Controls */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Persistent Global Mute Button (Emergency Mic Mute) */}
        <button
          type="button"
          onClick={onToggleMute}
          title={isMuted ? "Microphone is MUTED (Click to unmute)" : "Mute Microphone (Emergency Mute)"}
          className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl border-2 font-black text-xs sm:text-sm transition shadow-[2px_2px_0px_#000] active:scale-95 ${
            isMuted
              ? 'bg-red-600 hover:bg-red-500 text-white border-red-900 shadow-[0_0_12px_rgba(239,68,68,0.7)] animate-pulse'
              : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-black'
          }`}
        >
          <span>{isMuted ? '🔇' : '🎙️'}</span>
          <span>{isMuted ? 'Muted' : 'Mute'}</span>
        </button>

        {micReady ? (
          <span
            title="Microphone is ready"
            className="inline-flex items-center gap-1 bg-slate-900/90 border-2 border-black px-2 sm:px-2.5 py-1 rounded-xl shadow-[2px_2px_0px_#000] text-[11px] sm:text-xs font-bold text-emerald-400"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>✓ Ready</span>
          </span>
        ) : (
          <button
            onClick={() => {
              soundSynthesizer.playUiSound('click');
              onRequestMic && onRequestMic();
            }}
            title="Enable microphone"
            className="inline-flex items-center gap-1 bg-amber-500/20 hover:bg-amber-500/30 border-2 border-amber-400 text-amber-300 px-2 sm:px-2.5 py-1 rounded-xl shadow-[2px_2px_0px_#000] text-[11px] sm:text-xs font-black transition animate-pulse active:scale-95"
          >
            <span>🎙️ Enable Mic</span>
          </button>
        )}

        {player && (
          <div className="flex items-center gap-1.5 bg-slate-900/80 border-2 border-black px-2.5 py-1 rounded-xl shadow-[2px_2px_0px_#000]">
            <span className="text-[10px] text-amber-400 font-bold hidden sm:inline">You:</span>
            <span className="text-xs sm:text-sm font-bold text-white max-w-[85px] sm:max-w-[120px] truncate">{player.name}</span>
          </div>
        )}
      </div>
    </header>
  );
}
