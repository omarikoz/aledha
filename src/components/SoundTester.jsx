import React, { useState } from 'react';
import { X, Volume2, Mic, Play, Pause, Activity, Sparkles, Lock, Package } from 'lucide-react';
import soundsData from '../data/sounds.json';
import { soundPackManager } from '../services/soundPackManager.js';
import { soundSynthesizer } from '../services/soundSynthesizer.js';
import { audioEngine } from '../services/audioEngine.js';

export default function SoundTester({ isOpen, onClose }) {
  const [playingId, setPlayingId] = useState(null);
  const [isTestingMic, setIsTestingMic] = useState(false);
  const [micLevel, setMicLevel] = useState(0);

  if (!isOpen) return null;

  const activePack = soundPackManager.getPackById('pack_1');
  const soundsList = activePack?.sounds || soundsData;

  const handlePlaySound = (sound) => {
    soundSynthesizer.playUiSound('click');
    if (playingId === sound.id) {
      soundSynthesizer.stopAll();
      setPlayingId(null);
    } else {
      setPlayingId(sound.id);
      soundSynthesizer.playTargetSound(sound, () => {
        setPlayingId(null);
      });
    }
  };

  const handleTestMic = async () => {
    soundSynthesizer.playUiSound('click');
    if (isTestingMic) {
      audioEngine.stopMic();
      setIsTestingMic(false);
      setMicLevel(0);
    } else {
      try {
        const stream = await audioEngine.initMic();
        const analyser = audioEngine.setupAnalyser(stream);
        setIsTestingMic(true);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const checkVol = () => {
          if (!analyser) return;
          analyser.getByteTimeDomainData(dataArray);
          let sumSquares = 0;
          for (let i = 0; i < dataArray.length; i++) {
            const norm = (dataArray[i] - 128) / 128;
            sumSquares += norm * norm;
          }
          const rms = Math.sqrt(sumSquares / dataArray.length);
          setMicLevel(Math.min(1, rms * 3.5));
          if (stream.active) {
            requestAnimationFrame(checkVol);
          }
        };
        requestAnimationFrame(checkVol);
      } catch (e) {
        alert('Could not access microphone. Please check browser permissions.');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-bounce-in">
      <div className="arcade-card w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden text-left">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎛️</span>
            <div>
              <h3 className="text-xl font-black text-white">Egyptian Sound Library & Mic Tester</h3>
              <p className="text-xs text-slate-400 font-bold">Audition the target clips & verify your audio input</p>
            </div>
          </div>
          <button
            onClick={() => {
              soundSynthesizer.stopAll();
              audioEngine.stopMic();
              onClose();
            }}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border-2 border-black text-slate-300"
          >
            <X size={20} />
          </button>
        </div>

        {/* Mic Quick Tester Bar */}
        <div className="bg-slate-950/80 p-3.5 rounded-2xl border-2 border-black mb-4">
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={handleTestMic}
              className={`btn-arcade py-1.5 px-4 text-xs ${
                isTestingMic ? 'btn-arcade-pink' : 'btn-arcade-cyan'
              }`}
            >
              <Mic size={15} />
              <span>{isTestingMic ? 'Stop Mic Test' : 'Test Microphone Input 🎙️'}</span>
            </button>
            <span className="text-xs font-bold text-slate-300">
              {isTestingMic
                ? micLevel > 0.1
                  ? 'Microphone is picking up sound! 🔊'
                  : 'Speak into your mic...'
                : 'Click to verify mic before entering matches'}
            </span>
          </div>

          <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden border border-black">
            <div
              className="h-full bg-gradient-to-r from-emerald-400 to-amber-400 transition-all duration-75"
              style={{ width: `${Math.min(100, Math.max(0, micLevel * 100))}%` }}
            />
          </div>
        </div>

        {/* Active Sound Pack Banner */}
        <div className="flex items-center justify-between p-2.5 px-3 rounded-xl bg-slate-900 border border-white/10 mb-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-lg">{activePack.emoji || '🔥'}</span>
            <div>
              <span className="font-black text-white">{activePack.title}: {activePack.name}</span>
              <span className="text-[10px] text-slate-400 block">{soundsList.length} Viral Audio Clips</span>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
            <Lock size={10} /> PIN: {activePack.pinCode}
          </span>
        </div>

        {/* Sounds List Scrollable */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-3">
          {soundsList.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between p-3 rounded-2xl bg-slate-900/90 border-2 border-black shadow-[2px_2px_0px_#000]"
            >
              <div className="flex items-center gap-3">
                <span className="text-3xl p-1 bg-black/40 rounded-xl border border-white/10">
                  {s.emoji}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-white text-sm">{s.name}</span>
                    <span className="text-[10px] bg-slate-800 text-cyan-300 px-2 py-0.5 rounded-full border border-cyan-400/30 font-bold">
                      {s.categoryName || s.category}
                    </span>
                  </div>
                  <p className="text-xs text-amber-200/80 font-bold mt-0.5">
                    💡 {s.hint}
                  </p>
                </div>
              </div>

              <button
                onClick={() => handlePlaySound(s)}
                className={`btn-arcade py-2 px-3 text-xs ${
                  playingId === s.id ? 'btn-arcade-pink' : 'btn-arcade-gold'
                }`}
              >
                {playingId === s.id ? <Pause size={15} /> : <Play size={15} />}
                <span>{playingId === s.id ? 'Stop' : 'Play'}</span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
