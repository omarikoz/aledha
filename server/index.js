import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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
    revealPhase: room.revealPhase,
    settings: room.settings,
    currentRound: room.currentRound,
    totalRounds: room.settings.rounds,
    roundSound: room.roundSound,
    players: Array.from(room.players.values()),
    recordings: room.recordings,
    revealIndex: room.revealIndex,
    timer: room.timer,
    abortReason: room.abortReason || null
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
  const filteredSounds = room.settings.category === 'all'
    ? soundsCatalog
    : soundsCatalog.filter(s => s.category === room.settings.category);
  const soundPool = filteredSounds.length > 0 ? filteredSounds : soundsCatalog;

  const sound = soundPool[Math.floor(Math.random() * soundPool.length)];
  if (room.revealTimer) clearTimeout(room.revealTimer);
  if (room.timerInterval) clearInterval(room.timerInterval);

  room.roundSound = sound;
  room.recordings = [];
  room.revealIndex = 0;
  room.revealPhase = 'VOTING';
  room.state = 'COUNTDOWN';
  broadcastRoom(room.id);

  // 1. Countdown: 3 seconds ("Get Ready...")
  runCountdown(room, 3, 'SOUND', () => {
    // 2. Play Target Sound (Synchronized listening: 4 seconds)
    const soundDuration = Math.min(5, Math.max(3, Math.ceil(sound.duration || 3.5)));
    runCountdown(room, soundDuration, 'RECORDING', () => {
      // 3. Recording Window (Everyone records simultaneously: 5 seconds)
      const recordDuration = Math.min(6, Math.max(4, Math.ceil(sound.duration || 3.5) + 1));
      runCountdown(room, recordDuration, 'PROCESSING', () => {
        setTimeout(() => {
          completeRoundRecordings(room);
        }, 1000);
      });
    });
  });
}

// Finish collecting recordings & begin peer voting
function completeRoundRecordings(room) {
  if (room.state === 'REVEAL' || room.state === 'LEADERBOARD' || room.state === 'GAME_OVER') return;
  if (room.timerInterval) clearInterval(room.timerInterval);

  // Ensure every player in the room has an entry
  for (const player of room.players.values()) {
    const hasAttempt = room.recordings.some(r => r.playerId === player.id);
    if (!hasAttempt) {
      room.recordings.push({
        playerId: player.id,
        playerName: player.name,
        avatar: player.avatar,
        character: player.character || null,
        recordedAudioUrl: null,
        audioDataUrl: null,
        votes: {},
        score: null
      });
    }
  }

  // Initialize votes dictionary on each recording
  for (const rec of room.recordings) {
    if (!rec.votes) rec.votes = {};
    rec.score = null;
  }

  // Transition to REVEAL & start peer voting on Contestant 0
  room.state = 'REVEAL';
  startContestantVoting(room, 0);
}

// Start peer voting for contestant at given index
function startContestantVoting(room, index) {
  if (room.revealTimer) clearTimeout(room.revealTimer);
  if (room.timerInterval) clearInterval(room.timerInterval);

  room.revealIndex = index;
  room.revealPhase = 'VOTING';

  const currentRec = room.recordings[index];
  if (!currentRec) {
    scheduleLeaderboardAdvance(room);
    return;
  }

  // Synchronized voting window: 8 seconds
  runCountdown(room, 8, null, () => {
    revealContestantResult(room);
  });
}

// Calculate average voted score and reveal to everyone
function revealContestantResult(room) {
  if (room.revealTimer) clearTimeout(room.revealTimer);
  if (room.timerInterval) clearInterval(room.timerInterval);

  const currentRec = room.recordings[room.revealIndex];
  if (currentRec) {
    const voteValues = Object.values(currentRec.votes || {});
    const avgScore = voteValues.length > 0
      ? Math.round(voteValues.reduce((sum, v) => sum + v, 0) / voteValues.length)
      : 50;
    currentRec.score = avgScore;
  }

  room.revealPhase = 'RESULT';

  // 4 seconds to view the average score result before moving forward
  runCountdown(room, 4, null, () => {
    if (room.revealIndex + 1 < room.recordings.length) {
      startContestantVoting(room, room.revealIndex + 1);
    } else {
      // All contestants evaluated! Accumulate scores & display leaderboard
      for (const rec of room.recordings) {
        const player = room.players.get(rec.playerId);
        if (player) {
          player.score = (player.score || 0) + (rec.score || 0);
          player.lastRoundScore = rec.score || 0;
        }
      }
      room.state = 'LEADERBOARD';
      broadcastRoom(room.id);
      scheduleLeaderboardAdvance(room);
    }
  });
}

// Leaderboard 5-second countdown then automatic advance
function scheduleLeaderboardAdvance(room) {
  if (room.timerInterval) clearInterval(room.timerInterval);

  runCountdown(room, 5, null, () => {
    advanceRound(room);
  });
}

function advanceRound(room) {
  if (room.timerInterval) clearInterval(room.timerInterval);

  if (room.currentRound >= room.settings.rounds) {
    room.state = 'GAME_OVER';
    broadcastRoom(room.id);
  } else {
    room.currentRound += 1;
    startRound(room);
  }
}

// Socket IO Connections
io.on('connection', (socket) => {
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
      revealPhase: 'VOTING',
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
      name: (playerName || '').trim() || 'Host',
      avatar: '🎤',
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
  socket.on('join_room', ({ roomId, playerName }, callback) => {
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
      name: (playerName || '').trim() || `Player ${room.players.size + 1}`,
      avatar: '🎤',
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

  // Update Settings
  socket.on('update_settings', ({ roomId, settings }) => {
    const room = rooms.get(roomId);
    if (!room || room.hostId !== socket.id) return;
    room.settings = { ...room.settings, ...settings };
    broadcastRoom(roomId);
  });

  // Start Game - Strict Minimum 2 Players!
  socket.on('start_game', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room || room.hostId !== socket.id) return;

    if (room.players.size < 2) {
      return; // Must have at least 2 players to start peer voting
    }

    room.currentRound = 1;
    for (const player of room.players.values()) {
      player.score = 0;
      player.lastRoundScore = 0;
    }
    startRound(room);
  });

  // Submit Player Recording
  socket.on('submit_recording', ({ roomId, recordingData }) => {
    const room = rooms.get(roomId);
    if (!room || (room.state !== 'RECORDING' && room.state !== 'PROCESSING')) return;

    const player = room.players.get(socket.id);
    if (!player) return;

    const audioUrl = recordingData?.recordedAudioUrl || recordingData?.audioDataUrl || null;
    player.recordedAudioUrl = audioUrl;

    const recEntry = {
      playerId: socket.id,
      playerName: player.name,
      avatar: player.avatar,
      character: player.character || null,
      recordedAudioUrl: audioUrl,
      audioDataUrl: audioUrl,
      votes: {},
      score: null
    };

    const existingIndex = room.recordings.findIndex(r => r.playerId === socket.id);
    if (existingIndex >= 0) {
      room.recordings[existingIndex] = recEntry;
    } else {
      room.recordings.push(recEntry);
    }

    // Check if all players in room submitted
    if (room.recordings.length >= room.players.size) {
      if (room.timerInterval) clearInterval(room.timerInterval);
      completeRoundRecordings(room);
    }
  });

  // Submit Peer Vote (1 to 100)
  socket.on('submit_vote', ({ roomId, score }) => {
    const room = rooms.get(roomId);
    if (!room || room.state !== 'REVEAL' || room.revealPhase !== 'VOTING') return;

    const currentRec = room.recordings[room.revealIndex];
    if (!currentRec) return;

    // Disallow voting for oneself
    if (currentRec.playerId === socket.id) return;

    const cleanScore = Math.max(1, Math.min(100, Math.round(Number(score) || 50)));
    currentRec.votes = currentRec.votes || {};
    currentRec.votes[socket.id] = cleanScore;

    // Check if all other players have voted
    const eligibleVoters = Array.from(room.players.values()).filter(p => p.id !== currentRec.playerId);
    if (Object.keys(currentRec.votes).length >= eligibleVoters.length) {
      revealContestantResult(room);
    } else {
      broadcastRoom(roomId);
    }
  });

  // Play Again / Return to Lobby
  const handleResetToLobby = (roomId) => {
    const room = rooms.get(roomId);
    if (!room) return;
    if (room.timerInterval) clearInterval(room.timerInterval);
    if (room.revealTimer) clearTimeout(room.revealTimer);
    room.state = 'LOBBY';
    room.abortReason = null;
    room.revealPhase = 'VOTING';
    room.currentRound = 1;
    room.recordings = [];
    room.roundSound = null;
    for (const player of room.players.values()) {
      player.score = 0;
      player.lastRoundScore = 0;
    }
    broadcastRoom(roomId);
  };

  socket.on('play_again', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room || room.hostId !== socket.id) return;
    handleResetToLobby(roomId);
  });

  socket.on('return_to_lobby', ({ roomId }) => {
    handleResetToLobby(roomId);
  });

  // Disconnect
  socket.on('disconnect', () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room) return;

    const disconnectedPlayer = room.players.get(socket.id);
    const disconnectedName = disconnectedPlayer?.name || 'A player';

    room.players.delete(socket.id);

    if (room.players.size === 0) {
      if (room.timerInterval) clearInterval(room.timerInterval);
      if (room.revealTimer) clearTimeout(room.revealTimer);
      rooms.delete(roomId);
    } else {
      if (room.hostId === socket.id) {
        const nextHost = Array.from(room.players.values())[0];
        if (nextHost) {
          nextHost.isHost = true;
          room.hostId = nextHost.id;
        }
      }

      // If active match was in progress, immediately abort session
      if (room.state !== 'LOBBY' && room.state !== 'GAME_OVER' && room.state !== 'ABORTED') {
        if (room.timerInterval) clearInterval(room.timerInterval);
        if (room.revealTimer) clearTimeout(room.revealTimer);
        room.state = 'ABORTED';
        room.abortReason = `${disconnectedName} disconnected. The game has ended.`;
        io.to(roomId).emit('game_aborted', {
          reason: 'player_disconnected',
          playerName: disconnectedName,
          message: `${disconnectedName} disconnected. The game has ended.`
        });
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
