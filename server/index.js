import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getEgyptianTier, generateBotAttempt } from './audioScoring.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  maxHttpBufferSize: 1e7 // 10MB for audio uploads
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use('/sounds', express.static(path.join(__dirname, '../public/sounds')));

// Serve production build if exists
const distPath = path.join(__dirname, '../dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}

// Load sounds catalog
let soundsCatalog = [];
try {
  const soundsPath = path.join(__dirname, '../src/data/sounds.json');
  soundsCatalog = JSON.parse(fs.readFileSync(soundsPath, 'utf8'));
} catch (e) {
  console.error('Error loading sounds.json:', e);
}

app.get('/api/sounds', (req, res) => {
  res.json(soundsCatalog);
});

// Egyptian party codes
const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function generateRoomCode() {
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += ROOM_CODE_CHARS.charAt(Math.floor(Math.random() * ROOM_CODE_CHARS.length));
  }
  return code;
}

// In-Memory Rooms State
const rooms = new Map();

// Helper to broadcast room state to all sockets in room
function broadcastRoom(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;
  io.to(roomId).emit('room_update', {
    id: room.id,
    hostId: room.hostId,
    state: room.state,
    settings: room.settings,
    currentRound: room.currentRound,
    totalRounds: room.settings.rounds,
    roundSound: room.roundSound,
    players: Array.from(room.players.values()),
    recordings: room.recordings,
    revealIndex: room.revealIndex,
    timer: room.timer
  });
}

// Game Loop Timer Handler
function runCountdown(room, seconds, nextState, onComplete) {
  room.timer = seconds;
  broadcastRoom(room.id);

  if (room.timerInterval) clearInterval(room.timerInterval);

  room.timerInterval = setInterval(() => {
    room.timer -= 1;
    if (room.timer <= 0) {
      clearInterval(room.timerInterval);
      room.timer = 0;
      if (nextState) room.state = nextState;
      broadcastRoom(room.id);
      if (onComplete) onComplete();
    } else {
      broadcastRoom(room.id);
    }
  }, 1000);
}

// Start Round Loop
function startRound(room) {
  // Pick random sound from selected category or all
  const filteredSounds = room.settings.category === 'all'
    ? soundsCatalog
    : soundsCatalog.filter(s => s.category === room.settings.category);
  const soundPool = filteredSounds.length > 0 ? filteredSounds : soundsCatalog;

  // Pick sound not recently played if possible
  const sound = soundPool[Math.floor(Math.random() * soundPool.length)];
  if (room.revealTimer) clearTimeout(room.revealTimer);
  if (room.leaderboardTimer) clearTimeout(room.leaderboardTimer);
  if (room.timerInterval) clearInterval(room.timerInterval);

  room.roundSound = sound;
  room.recordings = [];
  room.revealIndex = 0;
  room.state = 'COUNTDOWN';
  broadcastRoom(room.id);

  // 1. Countdown: 3 seconds ("Get Ready...")
  runCountdown(room, 3, 'SOUND', () => {
    // 2. Play Target Sound (synchronized playback, strictly clamped to max 6 seconds!)
    const soundDuration = Math.min(6, Math.max(2, Math.ceil(sound.duration || 4.0)));
    runCountdown(room, soundDuration, 'RECORDING', () => {
      // 3. Recording Window ("MIMIC IT NOW!") - strictly clamped to max 6 seconds!
      const recordDuration = Math.min(6, Math.max(2, Math.ceil(sound.duration || 4.0)));
      runCountdown(room, recordDuration, 'PROCESSING', () => {
        // Buffer for network payload arrival
        setTimeout(() => {
          completeRoundRecordings(room);
        }, 800);
      });
    });
  });
}

// Auto-Advance Helpers for Seamless Reveal & Leaderboard Flow
function scheduleRevealStep(room) {
  if (room.revealTimer) clearTimeout(room.revealTimer);
  const clipDuration = Math.min(6.0, Math.max(2.0, room.roundSound?.duration || 3.5));
  // Reveal pacing: full clip up to 6s + a 1.5-second buffer to display score and reactions
  const stepDurationMs = Math.round((clipDuration + 1.5) * 1000);

  room.revealTimer = setTimeout(() => {
    if (room.state !== 'REVEAL') return;
    room.revealIndex += 1;
    if (room.revealIndex >= room.recordings.length) {
      room.state = 'LEADERBOARD';
      broadcastRoom(room.id);
      scheduleLeaderboardAdvance(room);
    } else {
      broadcastRoom(room.id);
      scheduleRevealStep(room);
    }
  }, stepDurationMs);
}

function scheduleLeaderboardAdvance(room) {
  if (room.leaderboardTimer) clearTimeout(room.leaderboardTimer);
  room.leaderboardTimer = setTimeout(() => {
    if (room.state !== 'LEADERBOARD') return;
    advanceRound(room);
  }, 5500);
}

function advanceRound(room) {
  if (room.revealTimer) clearTimeout(room.revealTimer);
  if (room.leaderboardTimer) clearTimeout(room.leaderboardTimer);

  if (room.currentRound >= room.settings.rounds) {
    room.state = 'GAME_OVER';
    broadcastRoom(room.id);
  } else {
    room.currentRound += 1;
    startRound(room);
  }
}

// Finish collecting recordings & transition directly to Player 1 Reveal
function completeRoundRecordings(room) {
  if (room.state === 'REVEAL' || room.state === 'LEADERBOARD' || room.state === 'GAME_OVER') return;

  if (room.timerInterval) clearInterval(room.timerInterval);

  // If bots are in room, generate their recordings
  for (const player of room.players.values()) {
    if (player.isBot) {
      const alreadyHas = room.recordings.some(r => r.playerId === player.id);
      if (!alreadyHas) {
        const botAttempt = generateBotAttempt(player, room.roundSound);
        room.recordings.push(botAttempt);
      }
    } else {
      // If human didn't submit in time, generate fallback
      const hasAttempt = room.recordings.some(r => r.playerId === player.id);
      if (!hasAttempt) {
        room.recordings.push({
          playerId: player.id,
          playerName: player.name,
          avatar: player.avatar,
          score: 30,
          rhythmScore: 25,
          pitchScore: 30,
          energyScore: 35,
          tier: getEgyptianTier(30),
          audioDataUrl: null
        });
      }
    }
  }

  // Update cumulative player scores
  for (const rec of room.recordings) {
    const player = room.players.get(rec.playerId);
    if (player) {
      player.score += rec.score;
      player.lastRoundScore = rec.score;
    }
  }

  // Transition directly to Contestant 1 (NO step -1, NO replaying reference sound!)
  room.state = 'REVEAL';
  room.revealIndex = 0;
  broadcastRoom(room.id);
  scheduleRevealStep(room);
}

// Socket IO Connections
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // Create Room
  socket.on('create_room', ({ playerName, avatar, character, settings }, callback) => {
    let roomId = generateRoomCode();
    while (rooms.has(roomId)) {
      roomId = generateRoomCode();
    }

    const newRoom = {
      id: roomId,
      hostId: socket.id,
      state: 'LOBBY',
      settings: {
        rounds: settings?.rounds || 3,
        duration: settings?.duration || 3.5,
        category: settings?.category || 'all'
      },
      currentRound: 1,
      roundSound: null,
      players: new Map(),
      recordings: [],
      revealIndex: 0,
      timer: 0,
      timerInterval: null
    };

    const hostPlayer = {
      id: socket.id,
      name: playerName || 'The Host (المعلم)',
      avatar: avatar || character?.avatar || '👑',
      character: character || null,
      recordedAudioUrl: null,
      score: 0,
      lastRoundScore: 0,
      isHost: true,
      isBot: false
    };

    newRoom.players.set(socket.id, hostPlayer);
    rooms.set(roomId, newRoom);
    socket.join(roomId);
    socket.data.roomId = roomId;

    if (callback) callback({ success: true, roomId, player: hostPlayer });
    broadcastRoom(roomId);
  });

  // Join Room
  socket.on('join_room', ({ roomId, playerName, avatar, character }, callback) => {
    const code = (roomId || '').trim().toUpperCase();
    const room = rooms.get(code);

    if (!room) {
      if (callback) callback({ success: false, error: 'Room code not found! Please double-check the letters.' });
      return;
    }

    if (room.players.size >= 8) {
      if (callback) callback({ success: false, error: 'Room is full! Maximum 8 players.' });
      return;
    }

    const player = {
      id: socket.id,
      name: playerName || `Player ${room.players.size + 1}`,
      avatar: avatar || character?.avatar || '🛺',
      character: character || null,
      recordedAudioUrl: null,
      score: 0,
      lastRoundScore: 0,
      isHost: false,
      isBot: false
    };

    room.players.set(socket.id, player);
    socket.join(code);
    socket.data.roomId = code;

    if (callback) callback({ success: true, roomId: code, player });
    broadcastRoom(code);
  });

  // Add Bot Player
  socket.on('add_bot', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room || room.players.size >= 8) return;

    const botTemplates = [
      { name: 'Abu Hamid (Coffee Boss) ☕', avatar: '☕', personality: 'funny' },
      { name: 'Sousou (Party Queen) 💃', avatar: '💃', personality: 'wild' },
      { name: 'Uncle Shakshak (The Artist) 🪕', avatar: '🪕', personality: 'pro' },
      { name: 'Mido (Toktok Maestro) 🛺', avatar: '🛺', personality: 'pro' },
      { name: 'Captain Koshary 🍲', avatar: '🍲', personality: 'funny' },
      { name: 'Zizo Comedy King 😂', avatar: '😂', personality: 'wild' },
      { name: 'Doctor Dahk (Laughter Clinic) 🩺', avatar: '👨‍⚕️', personality: 'funny' },
      { name: 'Moalem Tarboush 🎩', avatar: '🎩', personality: 'pro' },
      { name: 'Batta el-Helwa 🦆', avatar: '🦆', personality: 'wild' },
      { name: 'Sico el-3agouz 👴', avatar: '👴', personality: 'funny' },
      { name: 'Beshbeshi el-Wale3 🔥', avatar: '🔥', personality: 'pro' },
      { name: 'Hamada el-Gedaan 😎', avatar: '😎', personality: 'pro' },
      { name: 'Karika el-Moshagheb 😈', avatar: '😈', personality: 'wild' },
      { name: 'Felfel el-Shateer 🌶️', avatar: '🌶️', personality: 'funny' },
      { name: 'Abu Galambo 🦀', avatar: '🦀', personality: 'wild' },
      { name: 'Om Kalthoum Fan 🎙️', avatar: '🎙️', personality: 'pro' }
    ];

    const availableBots = botTemplates.filter(b => !Array.from(room.players.values()).some(p => p.name === b.name));
    const chosenBot = availableBots.length > 0 ? availableBots[0] : botTemplates[Math.floor(Math.random() * botTemplates.length)];

    const botId = `bot_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const botPlayer = {
      id: botId,
      name: chosenBot.name,
      avatar: chosenBot.avatar,
      personality: chosenBot.personality,
      score: 0,
      lastRoundScore: 0,
      isHost: false,
      isBot: true
    };

    room.players.set(botId, botPlayer);
    broadcastRoom(roomId);
  });

  // Remove Bot
  socket.on('remove_bot', ({ roomId, botId }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    room.players.delete(botId);
    broadcastRoom(roomId);
  });

  // Update Settings
  socket.on('update_settings', ({ roomId, settings }) => {
    const room = rooms.get(roomId);
    if (!room || room.hostId !== socket.id) return;
    room.settings = { ...room.settings, ...settings };
    broadcastRoom(roomId);
  });

  // Start Game
  socket.on('start_game', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room || room.hostId !== socket.id) return;
    room.currentRound = 1;
    for (const player of room.players.values()) {
      player.score = 0;
      player.lastRoundScore = 0;
    }
    startRound(room);
  });

  // Submit Player Recording (Allows both RECORDING and PROCESSING windows)
  socket.on('submit_recording', ({ roomId, recordingData }) => {
    const room = rooms.get(roomId);
    if (!room || (room.state !== 'RECORDING' && room.state !== 'PROCESSING')) return;

    const player = room.players.get(socket.id);
    if (!player) return;

    // Check if already submitted
    const existingIndex = room.recordings.findIndex(r => r.playerId === socket.id);
    const audioUrl = recordingData.recordedAudioUrl || recordingData.audioDataUrl;
    player.recordedAudioUrl = audioUrl;

    const recEntry = {
      playerId: socket.id,
      playerName: player.name,
      avatar: player.avatar,
      character: player.character || null,
      isBot: false,
      recordedAudioUrl: audioUrl,
      audioDataUrl: audioUrl,
      score: recordingData.score,
      rhythmScore: recordingData.rhythmScore,
      pitchScore: recordingData.pitchScore,
      energyScore: recordingData.energyScore,
      tier: recordingData.tier || getEgyptianTier(recordingData.score)
    };

    if (existingIndex >= 0) {
      room.recordings[existingIndex] = recEntry;
    } else {
      room.recordings.push(recEntry);
    }

    // Check if all human players submitted -> immediately reveal without waiting!
    const humanPlayers = Array.from(room.players.values()).filter(p => !p.isBot);
    const humanRecordings = room.recordings.filter(r => !r.isBot);

    if (humanRecordings.length >= humanPlayers.length) {
      if (room.timerInterval) clearInterval(room.timerInterval);
      completeRoundRecordings(room);
    }
  });

  // Advance Reveal Step (Auto or Manual Host Skip)
  socket.on('next_reveal_step', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room || room.hostId !== socket.id || room.state !== 'REVEAL') return;
    if (room.revealTimer) clearTimeout(room.revealTimer);

    room.revealIndex += 1;
    if (room.revealIndex >= room.recordings.length) {
      room.state = 'LEADERBOARD';
      broadcastRoom(roomId);
      scheduleLeaderboardAdvance(room);
    } else {
      broadcastRoom(roomId);
      scheduleRevealStep(room);
    }
  });

  // Next Round / Game Over Advance
  socket.on('advance_round', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room || room.hostId !== socket.id) return;
    advanceRound(room);
  });

  // Play Again (Reset to Lobby)
  socket.on('play_again', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room || room.hostId !== socket.id) return;
    room.state = 'LOBBY';
    room.currentRound = 1;
    room.recordings = [];
    room.roundSound = null;
    for (const player of room.players.values()) {
      player.score = 0;
      player.lastRoundScore = 0;
    }
    broadcastRoom(roomId);
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
    const roomId = socket.data.roomId;
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room) return;

    room.players.delete(socket.id);

    // If host left, assign new host or delete room if empty
    if (room.players.size === 0) {
      if (room.timerInterval) clearInterval(room.timerInterval);
      rooms.delete(roomId);
    } else {
      if (room.hostId === socket.id) {
        // Assign first human or any player as new host
        const nextHost = Array.from(room.players.values()).find(p => !p.isBot) || Array.from(room.players.values())[0];
        if (nextHost) {
          nextHost.isHost = true;
          room.hostId = nextHost.id;
        }
      }
      broadcastRoom(roomId);
    }
  });
});

// Fallback to index.html for SPA if dist exists
if (fs.existsSync(distPath)) {
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🎤 Aledha Server running on http://localhost:${PORT}`);
});
