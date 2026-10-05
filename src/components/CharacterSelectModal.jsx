import React from 'react';
import { X, Check, Sparkles } from 'lucide-react';
import { EGYPTIAN_CHARACTERS } from '../data/characters.js';
import { soundSynthesizer } from '../services/soundSynthesizer.js';

export default function CharacterSelectModal({
  isOpen,
  selectedCharacterId,
  onSelectCharacter,
  onClose
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-bounce-in">
      <div className="arcade-card w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden text-left bg-slate-900 border-4 border-black shadow-[8px_8px_0px_#000]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3 px-1">
          <div className="flex items-center gap-2.5">
            <span className="text-3xl">🎭</span>
            <div>
              <h2 className="text-2xl font-black text-white flex items-center gap-2">
                <span>Select Your Character</span>
                <span className="text-xs bg-amber-400 text-black px-2 py-0.5 rounded-full font-extrabold font-cairo">
                  شخصيات قلدها
                </span>
              </h2>
              <p className="text-xs text-slate-400 font-bold">
                Choose your party avatar for live reactions and talking animations!
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              soundSynthesizer.playUiSound('click');
              onClose();
            }}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border-2 border-black text-slate-300"
          >
            <X size={18} />
          </button>
        </div>

        {/* Character Cards Grid */}
        <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 py-2">
          {EGYPTIAN_CHARACTERS.map((char) => {
            const isSelected = char.id === selectedCharacterId;
            return (
              <div
                key={char.id}
                onClick={() => {
                  soundSynthesizer.playUiSound('click');
                  onSelectCharacter(char);
                }}
                className={`relative p-3.5 rounded-2xl border-3 cursor-pointer transition-all duration-150 transform hover:-translate-y-1 ${
                  isSelected
                    ? 'border-amber-400 bg-gradient-to-b from-amber-400/20 to-slate-900 shadow-[4px_4px_0px_#fbbf24]'
                    : 'border-black bg-slate-950/80 hover:bg-slate-800/80 shadow-[3px_3px_0px_#000]'
                }`}
              >
                {/* Selected Checkmark Badge */}
                {isSelected && (
                  <div className="absolute top-2 right-2 bg-amber-400 text-black p-1 rounded-full border border-black shadow">
                    <Check size={14} strokeWidth={3} />
                  </div>
                )}

                <div className="flex items-start gap-3">
                  {/* Avatar Icon with Talk Bounce frame */}
                  <div
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl border-2 border-black shadow-inner ${
                      isSelected ? 'bg-amber-400/30 scale-105' : 'bg-slate-800'
                    }`}
                  >
                    {char.avatar}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-black text-white truncate">
                      {char.name}
                    </h3>
                    <div className="text-xs font-bold text-amber-300 font-cairo">
                      {char.nameAr}
                    </div>
                    <span className="text-[10px] text-cyan-300 font-extrabold uppercase tracking-wider block mt-0.5">
                      {char.title}
                    </span>
                  </div>
                </div>

                {/* Catchphrase quote */}
                <div className="mt-2.5 pt-2 border-t border-white/5 text-[11px] text-slate-300 italic">
                  "{char.quote}"
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal Footer */}
        <div className="pt-3 border-t border-white/10 mt-2 text-right">
          <button
            onClick={() => {
              soundSynthesizer.playUiSound('go');
              onClose();
            }}
            className="btn-arcade btn-arcade-gold px-8 py-2.5 text-sm"
          >
            <Sparkles size={16} />
            <span>Confirm Character 🎭</span>
          </button>
        </div>
      </div>
    </div>
  );
}
