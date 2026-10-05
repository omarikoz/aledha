import React, { useState } from 'react';
import { Users, Crown, Sparkles, Play, Dices, Settings, Copy, Check } from 'lucide-react';
import { soundSynthesizer } from '../services/soundSynthesizer.js';
import { audioEngine } from '../services/audioEngine.js';
import { DEFAULT_CHARACTER } from '../data/characters.js';
import CharacterSelectModal from './CharacterSelectModal.jsx';

const FUNNY_NAMES = [
  'The Boss (El-Moalem) 👑', 'Captain Koshary 🍲', 'DJ Toktok 🛺', 'Doctor Dahk 😂',
  'Ahwa Master ☕', 'Shaabi King 🎤', 'Princesa Sousou 💃', 'Baladi Beat 🥁',
  'Cairo Legend 🏙️', 'Microbus Maestro 🚐', 'Nile Hero 🌊', '3ammo Shakshak 🪕',
  'Abu Galambo 🦀', 'Sico el-3agouz 👴', 'Boba el-Sayad 🎣', 'Mido el-Saree3 ⚡',
  'El-Prince Hemo 🤴', 'Om Kalthoum Fan 🎙️', 'Zizo el-Fanatasy 🪄', 'El-Nimr el-Aswad 🐯',
  'Koko el-Sweed 🥖', '3antel el-Giza 🥊', 'Beshbeshi el-Wale3 🔥', 'Sheikha Bamba 🪘',
  'Hamada el-Gedaan 😎', 'Batta el-Helwa 🦆', 'Fahd el-Sahraa 🐆', 'Osta Kareem 🚕',
  'Karika el-Moshagheb 😈', 'Felfel el-Shateer 🌶️', 'Abu Hadeed 💪', 'Tamer Hosny Clone 🎸',
  'Meshmesh el-Rayeq 🍹', 'El-Batran el-Kabeer 🎩', 'Zahran el-Tayar 🚀', 'Hoda Bondok 🌰',
  'Sultan el-Tarab 🎶', 'Moalem Tarboush 🎩', 'Bebo el-Haddad 🔨', 'Roushdi Abaza Jr 🕶️',
  'Shalaby el-Sokkar 🍬', 'Fikry el-Abqari 🧠', 'Semsem el-Gada3 🥨', 'Bogy & Tamtam 🧸',
  'Saeed el-Hawa 🌬️', 'Hassan Shakosh Vibe 🔨', 'El-Khedewi 💎', 'Zaki Shanab 👨'
];

export default function Lobby({
  room,
  player,
  onCreateRoom,
  onJoinRoom,
  onStartGame,
  onUpdateSettings
}) {
  const [name, setName] = useState(() => FUNNY_NAMES[Math.floor(Math.random() * FUNNY_NAMES.length)]);
  const [selectedCharacter, setSelectedCharacter] = useState(DEFAULT_CHARACTER);
  const [isCharModalOpen, setIsCharModalOpen] = useState(false);
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [joinMode, setJoinMode] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [copied, setCopied] = useState(false);

  // Randomize nickname
  const handleRandomizeName = () => {
    soundSynthesizer.playUiSound('click');
    const random = FUNNY_NAMES[Math.floor(Math.random() * FUNNY_NAMES.length)];
    setName(random);
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

  // If player is not in a room yet, show Create/Join screen
  if (!room) {
    return (
      <div className="w-full max-w-lg mx-auto px-3 sm:px-4 py-3 sm:py-6">
        <div className="arcade-card relative overflow-hidden text-center">
          {/* Egyptian header tag */}
          <div className="text-xs font-black text-amber-400/60 uppercase tracking-widest mb-1 font-cairo">
            جمهورية قلدها المصرية 🇪🇬
          </div>

          <div className="inline-block p-2.5 rounded-2xl bg-amber-400/20 border-2 border-amber-400 mb-3 animate-bounce-in">
            <span className="text-3xl sm:text-4xl">🎙️</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-white mb-1 tracking-tight">
            Ready to Play with Friends?!
          </h2>
          <p className="text-slate-300 text-xs sm:text-sm mb-4 px-2">
            Listen to iconic Egyptian sounds, say them into your mic, and see who did the best sound!
          </p>

          {/* Player Name Input */}
          <div className="mb-4 text-left">
            <label className="block text-xs font-bold text-amber-300 mb-1.5">
              Your Stage Name (اللقب الفني):
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={name}
                maxLength={24}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your nickname..."
                className="w-full bg-slate-900 border-2 border-black rounded-xl px-3.5 py-2.5 text-sm sm:text-base font-bold text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 shadow-[2px_2px_0px_#000]"
              />
              <button
                type="button"
                onClick={handleRandomizeName}
                title="Random Name"
                className="bg-slate-800 hover:bg-slate-700 border-2 border-black px-3 rounded-xl shadow-[2px_2px_0px_#000] text-amber-300 transition active:scale-95"
              >
                <Dices size={18} />
              </button>
            </div>
          </div>

          {/* Character / Avatar Selection Card */}
          <div className="mb-5 text-left">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-amber-300">
                Selected Character (الشخصية):
              </label>
              <button
                type="button"
                onClick={() => {
                  soundSynthesizer.playUiSound('click');
                  setIsCharModalOpen(true);
                }}
                className="text-xs text-amber-400 hover:text-white font-extrabold underline flex items-center gap-1 transition"
              >
                <span>Change 🎭</span>
              </button>
            </div>

            {/* Selected Character Preview Banner */}
            <div
              onClick={() => {
                soundSynthesizer.playUiSound('click');
                setIsCharModalOpen(true);
              }}
              className="p-2.5 bg-slate-950/80 hover:bg-slate-900 border-2 border-black rounded-2xl flex items-center justify-between cursor-pointer transition shadow-[2px_2px_0px_#000] group"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-12 h-12 rounded-xl bg-slate-800 border-2 border-black flex items-center justify-center text-2xl shadow group-hover:scale-105 transition">
                  {selectedCharacter.avatar}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-sm font-black text-white">{selectedCharacter.name}</h3>
                    <span className="text-xs font-bold text-amber-300 font-cairo">({selectedCharacter.nameAr})</span>
                  </div>
                  <span className="text-[11px] text-cyan-300 font-bold block">{selectedCharacter.title}</span>
                </div>
              </div>

              <div className="px-2.5 py-1 rounded-xl bg-amber-400/20 text-amber-300 border border-amber-400/40 text-[11px] font-extrabold flex items-center gap-1 group-hover:bg-amber-400 group-hover:text-black transition">
                <Sparkles size={12} />
                <span>Roster</span>
              </div>
            </div>
          </div>

          {errorMessage && (
            <div className="mb-4 p-2.5 bg-red-900/60 border-2 border-red-500 rounded-xl text-red-200 text-xs sm:text-sm font-bold animate-wiggle">
              {errorMessage}
            </div>
          )}

          {/* Action Tabs: Create Room vs Join Room */}
          {!joinMode ? (
            <div className="space-y-3">
              <button
                onClick={() => {
                  soundSynthesizer.playUiSound('go');
                  audioEngine.initMic().catch(() => {});
                  onCreateRoom({ playerName: name, avatar: selectedCharacter.avatar, character: selectedCharacter });
                }}
                className="btn-arcade btn-arcade-gold w-full text-base sm:text-lg py-3.5 flex items-center justify-center gap-2"
              >
                <Crown size={20} />
                <span>Create New Room (Host Game)</span>
              </button>

              <button
                onClick={() => {
                  soundSynthesizer.playUiSound('click');
                  audioEngine.initMic().catch(() => {});
                  setJoinMode(true);
                }}
                className="btn-arcade btn-arcade-cyan w-full text-sm sm:text-base py-3 flex items-center justify-center gap-2"
              >
                <Users size={18} />
                <span>Join Friend's Room</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-left">
                <label className="block text-xs font-bold text-cyan-300 mb-1.5">
                  Enter 4-Letter Room Code:
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
                onClick={() => {
                  if (!roomCodeInput.trim()) {
                    setErrorMessage('Please enter a room code first!');
                    return;
                  }
                  soundSynthesizer.playUiSound('go');
                  audioEngine.initMic().catch(() => {});
                  onJoinRoom({ roomId: roomCodeInput.trim(), playerName: name, avatar: selectedCharacter.avatar, character: selectedCharacter }, (err) => {
                    if (err) setErrorMessage(err);
                  });
                }}
                className="btn-arcade btn-arcade-cyan w-full text-base sm:text-lg py-3.5"
              >
                <span>Enter Room Now 🚪</span>
              </button>

              <button
                onClick={() => {
                  soundSynthesizer.playUiSound('click');
                  setJoinMode(false);
                  setErrorMessage('');
                }}
                className="btn-arcade btn-arcade-dark w-full text-xs sm:text-sm py-2.5"
              >
                <span>Back to Options</span>
              </button>
            </div>
          )}
        </div>

        {/* Character Selection Modal */}
        <CharacterSelectModal
          isOpen={isCharModalOpen}
          selectedCharacterId={selectedCharacter.id}
          onSelectCharacter={(char) => {
            setSelectedCharacter(char);
            setIsCharModalOpen(false);
          }}
          onClose={() => setIsCharModalOpen(false)}
        />
      </div>
    );
  }

  // When player is inside an active room lobby (Mobile-First Polish!)
  const isHost = player?.isHost;
  const currentPlayers = room.players || [];

  return (
    <div className="w-full max-w-lg mx-auto px-3 sm:px-4 py-3 sm:py-4">
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
              {copied ? <Check size={18} className="text-emerald-400" /> : <Copy size={18} className="text-amber-300" />}
            </button>
          </div>
          <span className="text-[11px] text-cyan-300 font-bold">
            {copied ? '✅ Code Copied to Clipboard!' : 'Tell your friends to enter this code on their phones!'}
          </span>
        </div>

        {/* Match Settings: Compact Pills for Mobile */}
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

        {/* Players in Lobby */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Users size={18} className="text-cyan-400" />
              <h3 className="text-sm font-black text-white">
                Friends in Lobby ({currentPlayers.length}/8)
              </h3>
            </div>
            <span className="text-[11px] text-emerald-400 font-bold animate-pulse">
              ● Live Lobby
            </span>
          </div>

          <div className="space-y-2">
            {currentPlayers.map((p) => (
              <div
                key={p.id}
                className={`flex items-center justify-between p-2.5 sm:p-3 rounded-xl border-2 border-black shadow-[2px_2px_0px_#000] ${
                  p.id === player?.id
                    ? 'bg-amber-400/20 border-amber-400'
                    : 'bg-slate-900/90'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl sm:text-3xl p-1 bg-black/40 rounded-xl border border-white/10">
                    {p.avatar}
                  </span>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-black text-white text-sm">{p.name}</span>
                      {p.isHost && (
                        <span title="Host (المعلم)">
                          <Crown size={14} className="text-amber-400 fill-amber-400" />
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] sm:text-[11px] text-slate-400 block">
                      {p.id === player?.id ? 'You (Ready)' : p.isHost ? 'Room Host' : 'Ready to Play'}
                    </span>
                  </div>
                </div>

                <div className="px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 text-[10px] font-black border border-emerald-500/40">
                  Ready ✅
                </div>
              </div>
            ))}

            {currentPlayers.length < 2 && (
              <div className="p-3 rounded-xl border-2 border-dashed border-white/15 bg-slate-950/40 text-center">
                <span className="text-xs text-amber-300 font-bold block mb-0.5">
                  Waiting for friends to join...
                </span>
                <span className="text-[11px] text-slate-400 block">
                  Give them room code <span className="font-mono font-black text-white">{room.id}</span>
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Start Game Action Button */}
        <div className="pt-2">
          {isHost ? (
            <button
              onClick={() => {
                soundSynthesizer.playUiSound('go');
                audioEngine.initMic().catch(() => {});
                onStartGame();
              }}
              className="btn-arcade btn-arcade-gold w-full text-base sm:text-lg py-4 flex items-center justify-center gap-2 shadow-[3px_3px_0px_#000]"
            >
              <Play size={20} className="fill-black" />
              <span>ابدأ اللعبة (Start Game) 🔥</span>
            </button>
          ) : (
            <div className="text-center p-3.5 bg-slate-900/90 border-2 border-black rounded-xl shadow-[2px_2px_0px_#000]">
              <div className="inline-block animate-pulse text-xl mb-1">⏳</div>
              <p className="font-extrabold text-amber-300 text-sm">
                Waiting for Host to start the match...
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Get ready to make the sound on your phone!
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Character Selection Modal */}
      <CharacterSelectModal
        isOpen={isCharModalOpen}
        selectedCharacterId={selectedCharacter.id}
        onSelectCharacter={(char) => {
          setSelectedCharacter(char);
          setIsCharModalOpen(false);
        }}
        onClose={() => setIsCharModalOpen(false)}
      />
    </div>
  );
}
