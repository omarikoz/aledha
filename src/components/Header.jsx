import React, { useState } from 'react';
import { Volume2, Users, Copy, Check, Sparkles, Music } from 'lucide-react';
import { soundSynthesizer } from '../services/soundSynthesizer.js';

export default function Header({ room, player, micReady, onRequestMic, onOpenSoundTester }) {
  const [copied, setCopied] = useState(false);

  const handleCopyCode = () => {
    if (!room?.id) return;
    navigator.clipboard.writeText(room.id);
    soundSynthesizer.playUiSound('click');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <header className="w-full max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4 border-b border-white/10 mb-4">
      {/* Logo & Game Title */}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-2xl border-2 border-black shadow-[3px_3px_0px_#000] animate-float">
          🎤
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white flex items-center gap-1.5">
              <span>Aledha</span>
              <span className="text-xs bg-amber-400 text-black font-extrabold px-2 py-0.5 rounded-full border border-black shadow-[1px_1px_0px_#000]">
                قَلِّدْهَا
              </span>
            </h1>
          </div>
          <p className="text-xs text-amber-200/80 font-semibold hidden sm:block">
            The Egyptian Voice Party Game 🇪🇬
          </p>
        </div>
      </div>

      {/* Center Room Code Pill if in Room */}
      {room && (
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyCode}
            title="Click to copy room code"
            className="flex items-center gap-2 bg-slate-900/90 hover:bg-slate-800 border-2 border-black px-3.5 py-1.5 rounded-xl shadow-[3px_3px_0px_#000] transition active:scale-95 text-sm font-bold text-amber-300"
          >
            <span className="text-slate-400 text-xs">Room:</span>
            <span className="font-mono tracking-widest text-base text-white">{room.id}</span>
            {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} className="text-slate-400" />}
          </button>

          {/* Players count */}
          <div className="hidden sm:flex items-center gap-1.5 bg-purple-950/80 border-2 border-black px-3 py-1.5 rounded-xl shadow-[3px_3px_0px_#000] text-xs font-bold text-purple-200">
            <Users size={15} />
            <span>{room.players?.length || 1} Players</span>
          </div>
        </div>
      )}

      {/* Right Controls */}
      <div className="flex items-center gap-2">
        {micReady ? (
          <span
            title="Microphone is allowed and ready for all rounds"
            className="hidden sm:inline-flex items-center gap-1.5 bg-slate-900/90 border-2 border-black px-2.5 py-1.5 rounded-xl shadow-[2px_2px_0px_#000] text-xs font-bold text-emerald-400"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>🎙️ Mic Ready</span>
          </span>
        ) : (
          <button
            onClick={() => {
              soundSynthesizer.playUiSound('click');
              onRequestMic && onRequestMic();
            }}
            title="Tap to allow microphone access for all rounds"
            className="inline-flex items-center gap-1.5 bg-amber-500/20 hover:bg-amber-500/30 border-2 border-amber-400 text-amber-300 px-2.5 py-1.5 rounded-xl shadow-[2px_2px_0px_#000] text-xs font-black transition animate-pulse active:scale-95"
          >
            <span>🎙️ Allow Mic</span>
          </button>
        )}

        {player && (
          <div className="flex items-center gap-2 bg-slate-900/80 border-2 border-black px-3 py-1 rounded-xl shadow-[2px_2px_0px_#000]">
            <span className="text-xl">{player.avatar}</span>
            <span className="text-sm font-bold text-white max-w-[120px] truncate">{player.name}</span>
          </div>
        )}
      </div>
    </header>
  );
}
