import React, { useState, useEffect } from 'react';
import { Lock, Unlock, Check, Sparkles, X, KeyRound, AlertCircle, Volume2 } from 'lucide-react';
import { soundPackManager } from '../services/soundPackManager.js';
import { soundSynthesizer } from '../services/soundSynthesizer.js';

export default function SoundPackModal({
  isOpen,
  onClose,
  selectedPackId = 'pack_1',
  onSelectPack,
  isHost = false
}) {
  const [packs, setPacks] = useState(() => soundPackManager.getAllPacks());
  const [activePinPack, setActivePinPack] = useState(null); // Pack currently prompting for PIN
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPacks(soundPackManager.getAllPacks());
      setPinInput('');
      setPinError('');
      setActivePinPack(null);
      setIsSuccess(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleOpenPinPrompt = (pack) => {
    soundSynthesizer.playUiSound('click');
    setActivePinPack(pack);
    setPinInput('');
    setPinError('');
    setIsSuccess(false);
  };

  const handleVerifyPin = () => {
    if (!activePinPack) return;
    const res = soundPackManager.unlockPack(activePinPack.id, pinInput);
    if (res.success) {
      soundSynthesizer.playUiSound('go');
      setIsSuccess(true);
      setPacks(soundPackManager.getAllPacks());
      setTimeout(() => {
        onSelectPack(activePinPack.id);
        setActivePinPack(null);
        setPinInput('');
      }, 700);
    } else {
      soundSynthesizer.playUiSound('buzzer');
      setPinError(res.error || 'Incorrect PIN code!');
    }
  };

  const handleDirectSelect = (packId) => {
    soundSynthesizer.playUiSound('click');
    onSelectPack(packId);
  };

  const handleKeypadDigit = (digit) => {
    soundSynthesizer.playUiSound('click');
    if (pinInput.length < 6) {
      setPinInput((prev) => prev + digit);
      setPinError('');
    }
  };

  const handleKeypadBackspace = () => {
    soundSynthesizer.playUiSound('click');
    setPinInput((prev) => prev.slice(0, -1));
    setPinError('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="arcade-card w-full max-w-lg p-4 sm:p-6 relative max-h-[92vh] flex flex-col overflow-hidden border-2 border-black shadow-[6px_6px_0px_#000]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-amber-400 text-black border-2 border-black flex items-center justify-center font-black shadow-[2px_2px_0px_#000]">
              📦
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
                <span>Sound Packs Gateway</span>
              </h2>
              <p className="text-[11px] sm:text-xs text-amber-300 font-semibold">
                Select your room audio collection
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              soundSynthesizer.playUiSound('click');
              onClose();
            }}
            className="w-8 h-8 rounded-xl bg-slate-900 hover:bg-slate-800 border-2 border-black flex items-center justify-center text-slate-300 transition active:scale-95"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto py-3 sm:py-4 space-y-3.5 custom-scrollbar">
          {/* Active PIN Prompt Sub-View */}
          {activePinPack ? (
            <div className="p-4 sm:p-5 rounded-3xl bg-slate-950/95 border-2 border-amber-400 shadow-[4px_4px_0px_#000] text-center space-y-4 animate-bounce-in">
              <div className="w-14 h-14 rounded-2xl bg-amber-400 text-black border-2 border-black flex items-center justify-center text-2xl mx-auto shadow-[3px_3px_0px_#000]">
                {isSuccess ? <Check size={32} /> : <KeyRound size={28} />}
              </div>

              <div>
                <span className="text-[11px] font-bold text-amber-300 uppercase tracking-widest block">
                  {activePinPack.title}
                </span>
                <h3 className="text-xl sm:text-2xl font-black text-white mt-0.5">
                  Unlock "{activePinPack.name}"
                </h3>
                <p className="text-xs text-slate-300 mt-1">
                  Enter the 4-digit security PIN to unlock this sound collection.
                </p>
              </div>

              {/* PIN Display Digits */}
              <div className="flex justify-center gap-2.5 my-2">
                {[0, 1, 2, 3].map((idx) => {
                  const digit = pinInput[idx];
                  return (
                    <div
                      key={idx}
                      className={`w-12 h-14 rounded-2xl border-2 flex items-center justify-center text-2xl font-mono font-black transition ${
                        isSuccess
                          ? 'border-emerald-400 bg-emerald-500/20 text-emerald-300'
                          : pinError
                          ? 'border-rose-500 bg-rose-500/20 text-rose-300'
                          : digit
                          ? 'border-amber-400 bg-slate-900 text-amber-300 shadow-[2px_2px_0px_#000]'
                          : 'border-slate-800 bg-slate-950 text-slate-600'
                      }`}
                    >
                      {digit ? '●' : ''}
                    </div>
                  );
                })}
              </div>

              {/* Error / Success Message */}
              {pinError && (
                <div className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-400 bg-rose-500/10 px-3 py-1 rounded-xl border border-rose-500/30">
                  <AlertCircle size={14} />
                  <span>{pinError}</span>
                </div>
              )}

              {isSuccess && (
                <div className="inline-flex items-center gap-1.5 text-xs font-black text-emerald-400 bg-emerald-500/20 px-3.5 py-1.5 rounded-xl border border-emerald-500">
                  <Check size={16} />
                  <span>Pack Unlocked Successfully! ✓</span>
                </div>
              )}

              {/* Virtual Keypad */}
              {!isSuccess && (
                <div className="max-w-[260px] mx-auto pt-1 space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => handleKeypadDigit(d)}
                        className="btn-arcade bg-slate-900 hover:bg-slate-800 text-white border-black text-lg py-2 rounded-xl transition active:scale-95 shadow-[2px_2px_0px_#000]"
                      >
                        {d}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setPinInput('')}
                      className="btn-arcade bg-slate-950 text-slate-400 border-black text-xs py-2 rounded-xl hover:text-white"
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      onClick={() => handleKeypadDigit('0')}
                      className="btn-arcade bg-slate-900 hover:bg-slate-800 text-white border-black text-lg py-2 rounded-xl transition active:scale-95 shadow-[2px_2px_0px_#000]"
                    >
                      0
                    </button>
                    <button
                      type="button"
                      onClick={handleKeypadBackspace}
                      className="btn-arcade bg-slate-950 text-slate-400 border-black text-xs py-2 rounded-xl hover:text-white"
                    >
                      ⌫
                    </button>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setActivePinPack(null)}
                      className="btn-arcade btn-arcade-dark flex-1 py-2 text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={pinInput.length === 0}
                      onClick={handleVerifyPin}
                      className={`btn-arcade flex-1 py-2 text-xs font-black ${
                        pinInput.length > 0 ? 'btn-arcade-gold' : 'bg-slate-800 text-slate-500 opacity-60'
                      }`}
                    >
                      Unlock Pack 🔓
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Sound Packs List View */
            <div className="space-y-3">
              {packs.map((pack) => {
                const isSelected = selectedPackId === pack.id;
                const isUnlocked = pack.isUnlocked;

                return (
                  <div
                    key={pack.id}
                    className={`p-3.5 sm:p-4 rounded-2xl border-2 transition relative ${
                      isSelected
                        ? 'bg-gradient-to-r from-amber-500/25 via-slate-900 to-amber-500/10 border-amber-400 shadow-[3px_3px_0px_#000]'
                        : 'bg-slate-900/90 border-black shadow-[2px_2px_0px_#000] hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      {/* Left Pack Info */}
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-slate-950 border-2 border-black flex items-center justify-center text-2xl shadow-inner shrink-0">
                          {pack.emoji || '📦'}
                        </div>

                        <div className="text-left">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-slate-950 border border-white/10 text-amber-300">
                              {pack.title}
                            </span>

                            {pack.requiresPin && (
                              <span
                                className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full border ${
                                  isUnlocked
                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                    : 'bg-amber-500/20 text-amber-300 border-amber-400/40'
                                }`}
                              >
                                {isUnlocked ? <Unlock size={10} /> : <Lock size={10} />}
                                <span>{isUnlocked ? 'Unlocked' : 'PIN Locked'}</span>
                              </span>
                            )}
                          </div>

                          <h3 className="text-base sm:text-lg font-black text-white mt-1">
                            {pack.name}
                          </h3>

                          <p className="text-xs text-slate-300 mt-0.5 line-clamp-2">
                            {pack.description}
                          </p>

                          <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 mt-2">
                            <Volume2 size={13} className="text-cyan-400" />
                            <span>{pack.sounds?.length || 0} Authentic Audio Clips</span>
                          </div>
                        </div>
                      </div>

                      {/* Right Action */}
                      <div className="shrink-0 pt-1">
                        {isSelected ? (
                          <div className="inline-flex items-center gap-1 bg-amber-400 text-black px-3 py-1.5 rounded-xl font-black text-xs border border-black shadow-[1px_1px_0px_#000]">
                            <Check size={14} />
                            <span>Active</span>
                          </div>
                        ) : !isUnlocked ? (
                          <button
                            type="button"
                            onClick={() => handleOpenPinPrompt(pack)}
                            className="btn-arcade btn-arcade-gold text-xs py-1.5 px-3 flex items-center gap-1.5 shadow-[2px_2px_0px_#000]"
                          >
                            <KeyRound size={13} />
                            <span>Enter PIN</span>
                          </button>
                        ) : isHost ? (
                          <button
                            type="button"
                            onClick={() => handleDirectSelect(pack.id)}
                            className="btn-arcade btn-arcade-cyan text-xs py-1.5 px-3 shadow-[2px_2px_0px_#000]"
                          >
                            <span>Select Pack</span>
                          </button>
                        ) : (
                          <span className="text-xs font-bold text-slate-500">
                            Host controls pack
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Modular Extensible Preview for Future Packs */}
              <div className="p-3.5 rounded-2xl border-2 border-dashed border-white/10 bg-slate-950/40 text-left opacity-75">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">✨</span>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">
                        Modular Architecture
                      </span>
                      <h4 className="text-sm font-black text-slate-300">
                        Sound Pack 2: Shaabi Classics & More
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Upcoming modular sound packs will appear here automatically.
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-900 border border-white/10 text-slate-400">
                    Coming Soon
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-white/10 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-400 font-semibold">
            Pack 1: "Magyar" (PIN Code: 1535)
          </span>

          <button
            type="button"
            onClick={() => {
              soundSynthesizer.playUiSound('click');
              onClose();
            }}
            className="btn-arcade btn-arcade-dark py-2 px-4 text-xs font-bold"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
