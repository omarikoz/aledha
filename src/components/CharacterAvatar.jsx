import React from 'react';

export default function CharacterAvatar({
  avatar = '👑',
  name = 'Player',
  character = null,
  isTalking = false,
  size = 'md'
}) {
  const sizeClasses = {
    sm: 'w-10 h-10 text-xl',
    md: 'w-16 h-16 text-3xl',
    lg: 'w-24 h-24 text-5xl',
    xl: 'w-32 h-32 text-6xl'
  };

  return (
    <div className="relative inline-flex flex-col items-center">
      {/* Animated Talk Ripple Waves */}
      {isTalking && (
        <div className="absolute inset-0 rounded-full bg-amber-400/30 animate-ping pointer-events-none scale-125" />
      )}

      {/* Main Avatar Container with Talking Bounce */}
      <div
        className={`relative rounded-3xl border-4 border-black shadow-[4px_4px_0px_#000] flex items-center justify-center transition-all duration-150 ${
          sizeClasses[size] || sizeClasses.md
        } ${
          isTalking
            ? 'bg-gradient-to-br from-amber-400 to-pink-500 scale-110 animate-bounce'
            : 'bg-slate-900'
        }`}
      >
        <span>{avatar || character?.avatar || '👑'}</span>

        {/* Live Talking Mic / Sound Indicator */}
        {isTalking && (
          <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-black p-1 rounded-full border-2 border-black animate-pulse shadow">
            <span className="text-xs">🔊</span>
          </div>
        )}
      </div>

      {/* Character Name / Title if provided */}
      {character?.name && (
        <div className="mt-1 text-center">
          <div className="text-xs font-black text-white">{name}</div>
          <div className="text-[10px] font-bold text-amber-300 font-cairo">
            ({character.nameAr || character.name})
          </div>
        </div>
      )}
    </div>
  );
}
