import React, { useState } from 'react';
import { Users, Crown, Bot, Sparkles, Play, Plus, X, Dices, Settings, Volume2, UserCheck } from 'lucide-react';
import { soundSynthesizer } from '../services/soundSynthesizer.js';
import { EGYPTIAN_CHARACTERS, DEFAULT_CHARACTER } from '../data/characters.js';
import CharacterSelectModal from './CharacterSelectModal.jsx';

const SHOW_SOUND_PACKS = false; // Feature flag to hide sound packs UI without deleting code

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
  onAddBot,
  onRemoveBot,
  onUpdateSettings,
  onSoloPractice
}) {
  const [name, setName] = useState(() => FUNNY_NAMES[Math.floor(Math.random() * FUNNY_NAMES.length)]);
  const [selectedCharacter, setSelectedCharacter] = useState(DEFAULT_CHARACTER);
  const [isCharModalOpen, setIsCharModalOpen] = useState(false);
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [joinMode, setJoinMode] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Randomize nickname
  const handleRandomizeName = () => {
    soundSynthesizer.playUiSound('click');
    const random = FUNNY_NAMES[Math.floor(Math.random() * FUNNY_NAMES.length)];
    setName(random);
  };

  // If player is not in a room yet, show Create/Join screen
  if (!room) {
    return (
      <div className="w-full max-w-xl mx-auto px-4 py-6">
        <div className="arcade-card relative overflow-hidden text-center">
          {/* Decorative Egyptian stamp */}
          <div className="absolute top-3 right-4 text-xs font-black text-amber-400/40 uppercase tracking-widest pointer-events-none">
            جمهورية قلدها المصرية 🇪🇬
          </div>

          <div className="inline-block p-3 rounded-2xl bg-amber-400/20 border-2 border-amber-400 mb-4 animate-bounce-in">
            <span className="text-4xl">🎙️</span>
          </div>

          <h2 className="text-3xl md:text-4xl font-black text-white mb-2">
            Ready to Mimic?!
          </h2>
          <p className="text-slate-300 text-sm md:text-base mb-6">
            Listen to iconic Egyptian sounds, record your best vocal impression, and let AI score your performance against friends!
          </p>

          {/* Player Name Input */}
          <div className="mb-5 text-left">
            <label className="block text-sm font-bold text-amber-300 mb-2">
              Your Stage Name (اللقب الفني):
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={name}
                maxLength={24}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your nickname..."
                className="w-full bg-slate-900 border-2 border-black rounded-xl px-4 py-3 font-bold text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 shadow-[3px_3px_0px_#000]"
              />
              <button
                type="button"
                onClick={handleRandomizeName}
                title="Random Name"
                className="bg-slate-800 hover:bg-slate-700 border-2 border-black px-3.5 rounded-xl shadow-[3px_3px_0px_#000] text-amber-300 transition active:scale-95"
              >
                <Dices size={20} />
              </button>
            </div>
          </div>

          {/* Character / Avatar Selection Card */}
          <div className="mb-6 text-left">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-bold text-amber-300">
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
                <span>Change Character 🎭</span>
              </button>
            </div>

            {/* Selected Character Preview Banner */}
            <div
              onClick={() => {
                soundSynthesizer.playUiSound('click');
                setIsCharModalOpen(true);
              }}
              className="p-3 bg-slate-950/80 hover:bg-slate-900 border-2 border-black rounded-2xl flex items-center justify-between cursor-pointer transition shadow-[3px_3px_0px_#000] group"
            >
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-slate-800 border-2 border-black flex items-center justify-center text-3xl shadow group-hover:scale-105 transition">
                  {selectedCharacter.avatar}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-white">{selectedCharacter.name}</h3>
                    <span className="text-xs font-bold text-amber-300 font-cairo">({selectedCharacter.nameAr})</span>
                  </div>
                  <span className="text-[11px] text-cyan-300 font-bold block">{selectedCharacter.title}</span>
                  <span className="text-[10px] text-slate-400 italic block">"{selectedCharacter.quote}"</span>
                </div>
              </div>

              <div className="px-3 py-1.5 rounded-xl bg-amber-400/20 text-amber-300 border border-amber-400/40 text-xs font-extrabold flex items-center gap-1 group-hover:bg-amber-400 group-hover:text-black transition">
                <Sparkles size={14} />
                <span>Roster</span>
              </div>
            </div>
          </div>

          {errorMessage && (
            <div className="mb-4 p-3 bg-red-900/60 border-2 border-red-500 rounded-xl text-red-200 text-sm font-bold animate-wiggle">
              {errorMessage}
            </div>
          )}

          {/* Action Tabs: Create Room vs Join Room */}
          {!joinMode ? (
            <div className="space-y-3">
              <button
                onClick={() => {
                  soundSynthesizer.playUiSound('go');
                  onCreateRoom({ playerName: name, avatar: selectedCharacter.avatar, character: selectedCharacter });
                }}
                className="btn-arcade btn-arcade-gold w-full text-lg py-3.5"
              >
                <Crown size={20} />
                <span>Create New Room (Host Game)</span>
              </button>

              <button
                onClick={() => {
                  soundSynthesizer.playUiSound('click');
                  setJoinMode(true);
                }}
                className="btn-arcade btn-arcade-cyan w-full text-base py-3"
              >
                <Users size={18} />
                <span>Join with Room Code</span>
              </button>

              <div className="pt-2 border-t border-white/10">
                <button
                  onClick={() => {
                    soundSynthesizer.playUiSound('go');
                    onSoloPractice({ playerName: name, avatar: selectedCharacter.avatar, character: selectedCharacter });
                  }}
                  className="btn-arcade btn-arcade-pink w-full text-sm py-2.5 opacity-95 hover:opacity-100"
                >
                  <Bot size={18} />
                  <span>Solo Practice vs Egyptian AI Bots 🤖</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-left">
                <label className="block text-sm font-bold text-cyan-300 mb-2">
                  Enter 4-Letter Room Code:
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={roomCodeInput}
                  onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                  placeholder="e.g. AHWA"
                  className="w-full text-center tracking-widest uppercase font-mono text-2xl bg-slate-900 border-2 border-black rounded-xl px-4 py-3 font-black text-amber-400 focus:outline-none focus:border-cyan-400 shadow-[3px_3px_0px_#000]"
                />
              </div>

              <button
                onClick={() => {
                  if (!roomCodeInput.trim()) {
                    setErrorMessage('Please enter a room code first!');
                    return;
                  }
                  soundSynthesizer.playUiSound('go');
                  onJoinRoom({ roomId: roomCodeInput.trim(), playerName: name, avatar: selectedCharacter.avatar, character: selectedCharacter }, (err) => {
                    if (err) setErrorMessage(err);
                  });
                }}
                className="btn-arcade btn-arcade-cyan w-full text-lg py-3.5"
              >
                <span>Enter Room Now 🚪</span>
              </button>

              <button
                onClick={() => {
                  soundSynthesizer.playUiSound('click');
                  setJoinMode(false);
                  setErrorMessage('');
                }}
                className="btn-arcade btn-arcade-dark w-full text-sm py-2.5"
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

  // When player is inside an active room lobby
  const isHost = player?.isHost;
  const currentPlayers = room.players || [];

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Left Column: Match Settings (Host Controls) */}
        <div className="arcade-card md:col-span-1 flex flex-col justify-between text-left">
          <div>
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/10">
              <Settings size={20} className="text-amber-400" />
              <h3 className="text-lg font-black text-white">Match Settings</h3>
            </div>

            {/* Rounds Selector */}
            <div className="mb-4">
              <label className="block text-xs font-bold text-amber-300 mb-2">
                Number of Rounds:
              </label>
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
                      className={`py-2 rounded-xl font-black text-sm border-2 border-black transition shadow-[2px_2px_0px_#000] ${
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
                <div className="bg-slate-900 border-2 border-black rounded-xl p-2.5 text-center font-black text-amber-300">
                  {room.settings?.rounds || 3} Rounds
                </div>
              )}
            </div>

            {/* Categories / Sound Packs Selector (Hidden via SHOW_SOUND_PACKS flag) */}
            {SHOW_SOUND_PACKS && (
              <div className="mb-4">
                <label className="block text-xs font-bold text-amber-300 mb-2">
                  Sound Theme / Category:
                </label>
                {isHost ? (
                  <select
                    value={room.settings?.category || 'all'}
                    onChange={(e) => {
                      soundSynthesizer.playUiSound('click');
                      onUpdateSettings({ category: e.target.value });
                    }}
                    className="w-full bg-slate-900 border-2 border-black rounded-xl p-2.5 font-bold text-sm text-white focus:outline-none focus:border-amber-400 shadow-[2px_2px_0px_#000]"
                  >
                    <option value="all">All Egyptian Sounds (Party Mix)</option>
                    <option value="vehicles">Cairo Traffic & Streets (Toktok, Horns)</option>
                    <option value="animals">Egyptian Animals (Street Cats, Ducks)</option>
                    <option value="vendors">Street Vendors (Bread, Sellers)</option>
                    <option value="cafes">Egyptian Cafés (Ahwa Tea & Spoons)</option>
                  </select>
                ) : (
                  <div className="bg-slate-900 border-2 border-black rounded-xl p-2.5 text-center font-bold text-sm text-white">
                    {room.settings?.category === 'vehicles' ? 'Cairo Traffic & Streets'
                      : room.settings?.category === 'animals' ? 'Egyptian Animals'
                      : room.settings?.category === 'vendors' ? 'Street Vendors'
                      : 'All Egyptian Sounds'}
                  </div>
                )}
              </div>
            )}

            {/* Recording Window Length */}
            <div className="bg-slate-950/60 border border-white/10 rounded-xl p-3 text-xs text-slate-300 flex items-center justify-between">
              <span>Recording Duration:</span>
              <span className="font-bold text-amber-300">Max 6.0 Seconds</span>
            </div>
          </div>

          {/* Quick Bots Helper */}
          {isHost && (
            <div className="mt-4 pt-4 border-t border-white/10">
              <button
                type="button"
                onClick={() => {
                  soundSynthesizer.playUiSound('click');
                  onAddBot();
                }}
                disabled={currentPlayers.length >= 8}
                className="btn-arcade btn-arcade-pink w-full text-xs py-2.5"
              >
                <Plus size={16} />
                <span>Add Egyptian AI Bot 🤖</span>
              </button>
              <p className="text-[11px] text-slate-400 text-center mt-1.5">
                Play immediately without waiting for other human players
              </p>
            </div>
          )}
        </div>

        {/* Right Column: Players Roster & Start Button */}
        <div className="arcade-card md:col-span-2 flex flex-col justify-between text-left">
          <div>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Users size={20} className="text-cyan-400" />
                <h3 className="text-lg font-black text-white">
                  Connected Players ({currentPlayers.length}/8)
                </h3>
              </div>
              <div className="text-xs bg-slate-950/80 border border-amber-400/40 text-amber-300 px-3 py-1 rounded-full font-bold">
                Code: <span className="font-mono tracking-widest">{room.id}</span>
              </div>
            </div>

            {/* Player Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
              {currentPlayers.map((p) => (
                <div
                  key={p.id}
                  className={`flex items-center justify-between p-3 rounded-xl border-2 border-black shadow-[3px_3px_0px_#000] ${
                    p.id === player?.id
                      ? 'bg-amber-400/15 border-amber-400'
                      : p.isBot
                      ? 'bg-purple-950/40 border-purple-500/40'
                      : 'bg-slate-900/90'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-3xl p-1 bg-black/30 rounded-xl border border-white/10">
                      {p.avatar}
                    </span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-black text-white text-sm">{p.name}</span>
                        {p.isHost && (
                          <span title="Room Host (المعلم)">
                            <Crown size={14} className="text-amber-400 fill-amber-400" />
                          </span>
                        )}
                        {p.isBot && (
                          <span className="text-[10px] bg-purple-500/30 text-purple-300 px-1.5 py-0.5 rounded border border-purple-400/30 font-bold">
                            BOT
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {p.id === player?.id ? 'You' : p.isHost ? 'Host' : 'Ready to Mimic'}
                      </span>
                    </div>
                  </div>

                  {/* Remove bot button for host */}
                  {isHost && p.isBot && (
                    <button
                      onClick={() => {
                        soundSynthesizer.playUiSound('click');
                        onRemoveBot(p.id);
                      }}
                      title="Remove this bot"
                      className="text-red-400 hover:text-red-300 p-1 rounded-lg hover:bg-red-950/40"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              ))}

              {/* Empty slot placeholder */}
              {Array.from({ length: Math.max(0, 4 - currentPlayers.length) }).map((_, idx) => (
                <div
                  key={`empty_${idx}`}
                  className="flex items-center justify-center p-3 rounded-xl border-2 border-dashed border-white/15 bg-slate-950/30 text-slate-500 text-xs font-bold"
                >
                  <span>Open slot for a player...</span>
                </div>
              ))}
            </div>
          </div>

          {/* Start Game Action */}
          <div className="pt-4 border-t border-white/10">
            {isHost ? (
              <button
                onClick={() => {
                  soundSynthesizer.playUiSound('go');
                  onStartGame();
                }}
                className="btn-arcade btn-arcade-gold w-full text-xl py-4"
              >
                <Play size={22} className="fill-black" />
                <span>Start Match! قلدها 🔥</span>
              </button>
            ) : (
              <div className="text-center p-4 bg-slate-900/80 border-2 border-black rounded-xl shadow-[3px_3px_0px_#000]">
                <div className="inline-block animate-pulse text-2xl mb-1">⏳</div>
                <p className="font-extrabold text-amber-300 text-base">
                  Waiting for Host to start the match...
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Warm up your vocal cords and try not to laugh!
                </p>
              </div>
            )}
          </div>
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
