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

// Load sound packs catalog (Pack 1: Magyar PIN-protected)
let soundPacksCatalog = [];
let soundsCatalog = [];
try {
  const packsPath = path.join(__dirname, '../src/data/soundPacks.json');
  if (fs.existsSync(packsPath)) {
    soundPacksCatalog = JSON.parse(fs.readFileSync(packsPath, 'utf8'));
    soundsCatalog = soundPacksCatalog[0]?.sounds || [];
  } else {
    const soundsPath = path.join(__dirname, '../src/data/sounds.json');
    soundsCatalog = JSON.parse(fs.readFileSync(soundsPath, 'utf8'));
  }
} catch (e) {
  console.error('Error loading soundPacks.json:', e);
}

app.get('/api/sound-packs', (req, res) => {
  const safePacks = soundPacksCatalog.map((p) => ({
    id: p.id,
    packNumber: p.packNumber,
    title: p.title,
    name: p.name,
    description: p.description,
    emoji: p.emoji,
    requiresPin: p.requiresPin,
    soundCount: p.sounds?.length || 0
  }));
  res.json(safePacks);
});

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

// Helper to broadcast room state and phase change to all sockets in room
function broadcastRoom(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;
  const currentRec = room.recordings ? room.recordings[room.revealIndex] : null;
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

  // Server-Authoritative Phase Change Event
  io.to(roomId).emit('phase_change', {
    phase: room.state,
    state: room.state,
    revealPhase: room.revealPhase,
    activePlayerId: currentRec?.playerId || null,
    revealIndex: room.revealIndex,
    timer: room.timer,
    currentRound: room.currentRound,
    totalRounds: room.settings.rounds,
    roundSound: room.roundSound,
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
  if (room.revealTimer) clearTimeout(room.revealTimer);
  if (room.timerInterval) clearInterval(room.timerInterval);

  const activePackId = room.settings?.soundPack || 'pack_1';
  const activePack = soundPacksCatalog.find((p) => p.id === activePackId) || soundPacksCatalog[0];
  const packSounds = activePack?.sounds && activePack.sounds.length > 0 ? activePack.sounds : soundsCatalog;

  const filteredSounds = (!room.settings?.category || room.settings.category === 'all')
    ? packSounds
    : packSounds.filter((s) => s.category === room.settings.category);
  const soundPool = filteredSounds.length > 0 ? filteredSounds : packSounds;

  const sound = soundPool[Math.floor(Math.random() * soundPool.length)];

  room.roundSound = sound;
  room.recordings = [];
  room.revealIndex = 0;
  room.revealPhase = 'PLAYING';
  room.state = 'SOUND';
  broadcastRoom(room.id);

  // Play Target Sound (listening phase: 3.5s to 4s)
  const soundDuration = Math.min(5, Math.max(3, Math.ceil(sound.duration || 3.5)));
  runCountdown(room, soundDuration, 'RECORDING', () => {
    // Recording Window (everyone records simultaneously: 4.5s)
    const recordDuration = Math.min(6, Math.max(4, Math.ceil(sound.duration || 3.5) + 1));
    runCountdown(room, recordDuration, 'PROCESSING', () => {
      setTimeout(() => {
        completeRoundRecordings(room);
      }, 500);
    });
  });
}

// Finish collecting recordings & begin peer voting or AI evaluation
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
        avatar: player.avatar || '🎤',
        character: null,
        audioData: null,
        audioDataUrl: null,
        recordedAudioUrl: null,
        mimeType: 'audio/webm',
        aiScore: 0,
        aiDetails: { timingMatch: 0, toneMatch: 0, rhythmScore: 0, durationScore: 0, spectralScore: 0 },
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

  // Transition to REVEAL & start contestant sequence
  room.state = 'REVEAL';
  startContestantVoting(room, 0);
}

// Start peer voting or AI evaluation for contestant at given index
function startContestantVoting(room, index) {
  if (room.revealTimer) clearTimeout(room.revealTimer);
  if (room.timerInterval) clearInterval(room.timerInterval);

  room.revealIndex = index;
  const currentRec = room.recordings[index];
  if (!currentRec) {
    scheduleLeaderboardAdvance(room);
    return;
  }

  const isAiMode = room.settings?.gameMode === 'ai';

  // Step 1: Announce and play contestant take simultaneously to ALL players (3s)
  room.revealPhase = 'PLAYING';
  room.timer = 0;
  broadcastRoom(room.id);

  // Broadcast reveal audio payload to ALL players (including active contestant)
  const contestantAudioData = currentRec.audioData || currentRec.audioDataUrl || currentRec.recordedAudioUrl;
  const revealPayload = {
    playerId: currentRec.playerId,
    playerName: currentRec.playerName,
    audioData: contestantAudioData,
    mimeType: currentRec.mimeType || 'audio/webm'
  };
  io.to(room.id).emit('play_player_reveal', revealPayload);
  io.to(room.id).emit('reveal_player_recording', revealPayload);

  runCountdown(room, 3, null, () => {
    if (isAiMode) {
      // In "AI Auto-Vote" Mode: Skip manual slider, reveal deterministic AI score
      if (currentRec.aiScore !== null && currentRec.aiScore !== undefined) {
        currentRec.score = currentRec.aiScore;
      } else if (currentRec.score === null) {
        currentRec.score = 50;
      }
      revealContestantResult(room);
    } else {
      // Step 2: Strict 10-Second Voting Window with Visible Countdown!
      room.revealPhase = 'VOTING';
      runCountdown(room, 10, null, () => {
        revealContestantResult(room);
      });
    }
  });
}

// Calculate voted/AI score and reveal to everyone
function revealContestantResult(room) {
  if (room.revealTimer) clearTimeout(room.revealTimer);
  if (room.timerInterval) clearInterval(room.timerInterval);

  const isAiMode = room.settings?.gameMode === 'ai';
  const currentRec = room.recordings[room.revealIndex];
  if (currentRec) {
    if (isAiMode) {
      currentRec.score = (currentRec.aiScore !== null && currentRec.aiScore !== undefined) ? currentRec.aiScore : 50;
    } else {
      const voteValues = Object.values(currentRec.votes || {});
      const avgScore = voteValues.length > 0
        ? Math.round(voteValues.reduce((sum, v) => sum + v, 0) / voteValues.length)
        : 50;
      currentRec.score = avgScore;
    }
  }

  room.revealPhase = 'RESULT';
  room.timer = 0;
  broadcastRoom(room.id);

  // 4 seconds to view the score breakdown result before moving forward
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

// Leaderboard countdown then automatic advance
function scheduleLeaderboardAdvance(room) {
  if (room.timerInterval) clearInterval(room.timerInterval);
  if (room.revealTimer) clearTimeout(room.revealTimer);

  runCountdown(room, 4, null, () => {
    advanceRound(room);
  });
}

// Clean round lifecycle: ROUND_END -> SHORT_BUFFER (2s) -> START_ROUND -> PLAY_TARGET_SOUND
function advanceRound(room) {
  if (room.isAdvancing) return;
  room.isAdvancing = true;

  if (room.timerInterval) clearInterval(room.timerInterval);
  if (room.revealTimer) clearTimeout(room.revealTimer);

  if (room.currentRound >= room.settings.rounds) {
    room.state = 'GAME_OVER';
    room.isAdvancing = false;
    broadcastRoom(room.id);
  } else {
    room.currentRound += 1;
    // SHORT_BUFFER (2s)
    room.state = 'BUFFER';
    room.timer = 2;
    broadcastRoom(room.id);

    runCountdown(room, 2, null, () => {
      room.isAdvancing = false;
      startRound(room);
    });
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
        category: settings?.category || 'all',
        gameMode: settings?.gameMode || 'player',
        soundPack: settings?.soundPack || null
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
      isBot: false,
      isMuted: false
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

    const cleanName = (playerName || '').trim();
    if (!cleanName) {
      if (callback) callback({ success: false, error: 'Please enter your name.' });
      return;
    }

    // Case-insensitive duplicate check against connected players in the lobby
    const isDuplicate = Array.from(room.players.values()).some(
      (p) => p.name.trim().toLowerCase() === cleanName.toLowerCase()
    );

    if (isDuplicate) {
      if (callback) callback({
        success: false,
        error: 'This name is already taken by another player in the lobby.'
      });
      return;
    }

    const player = {
      id: socket.id,
      name: cleanName,
      avatar: '🎤',
      recordedAudioUrl: null,
      score: 0,
      lastRoundScore: 0,
      isHost: false,
      isBot: false,
      isMuted: false
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

  // Start Game - Strict Minimum 2 Players & Sound Pack Required!
  socket.on('start_game', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room || room.hostId !== socket.id) return;

    if (!room.settings?.soundPack) {
      return; // Cannot start without a selected Sound Pack
    }

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

  // Submit Player Recording (Base64 audio broadcast pipeline)
  socket.on('submit_recording', (payload) => {
    const roomId = payload?.roomId;
    const room = rooms.get(roomId);
    if (!room || (room.state !== 'RECORDING' && room.state !== 'PROCESSING')) return;

    const player = room.players.get(socket.id);
    if (!player) return;

    const audioData = payload?.audioData || payload?.recordingData?.audioData || payload?.recordingData?.audioDataUrl || payload?.recordingData?.recordedAudioUrl || null;
    const mimeType = payload?.mimeType || payload?.recordingData?.mimeType || 'audio/webm';
    const aiScore = payload?.aiScore ?? payload?.recordingData?.aiScore ?? null;
    const aiDetails = payload?.aiDetails || payload?.recordingData?.aiDetails || null;

    player.recordedAudioUrl = audioData;
    player.audioData = audioData;

    const recEntry = {
      playerId: socket.id,
      playerName: player.name,
      avatar: player.avatar,
      character: player.character || null,
      audioData: audioData,
      audioDataUrl: audioData,
      recordedAudioUrl: audioData,
      mimeType: mimeType,
      aiScore: aiScore,
      aiDetails: aiDetails,
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
    if (!room || room.state !== 'REVEAL' || room.revealPhase !== 'VOTING' || room.settings?.gameMode === 'ai') return;

    const currentRec = room.recordings[room.revealIndex];
    if (!currentRec) return;

    // Disallow voting for oneself
    if (currentRec.playerId === socket.id) return;

    const cleanScore = Math.max(1, Math.min(100, Math.round(Number(score) || 50)));
    currentRec.votes = currentRec.votes || {};
    currentRec.votes[socket.id] = cleanScore;

    // Check if all other eligible players have voted
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

  // Player Mute State Toggle
  socket.on('player_toggle_mute', ({ roomId, isMuted }) => {
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (room) {
      const player = room.players.get(socket.id);
      if (player) {
        player.isMuted = !!isMuted;
      }
    }
    io.to(roomId).emit('player_mute_updated', {
      playerId: socket.id,
      isMuted: !!isMuted
    });
  });

  // WebRTC Mesh Voice Chat Signaling Relay
  socket.on('voice_join', ({ roomId }) => {
    if (roomId) {
      socket.to(roomId).emit('new_peer_joined', { peerId: socket.id });
      socket.to(roomId).emit('voice_user_joined', { peerId: socket.id });
    }
  });

  socket.on('signal_send', ({ to, targetPeerId, signal }) => {
    const target = to || targetPeerId;
    if (target && signal) {
      io.to(target).emit('signal_receive', {
        from: socket.id,
        signal
      });
      io.to(target).emit('voice_signal', {
        fromPeerId: socket.id,
        signal
      });
    }
  });

  socket.on('voice_signal', ({ targetPeerId, to, signal }) => {
    const target = targetPeerId || to;
    if (target && signal) {
      io.to(target).emit('voice_signal', {
        fromPeerId: socket.id,
        signal
      });
      io.to(target).emit('signal_receive', {
        from: socket.id,
        signal
      });
    }
  });

  socket.on('voice_leave', ({ roomId }) => {
    if (roomId) {
      socket.to(roomId).emit('peer_left', { peerId: socket.id });
      socket.to(roomId).emit('voice_user_left', { peerId: socket.id });
    }
  });

  // Disconnect
  socket.on('disconnect', () => {
    const roomId = socket.data.roomId;
    if (roomId) {
      socket.to(roomId).emit('voice_user_left', { peerId: socket.id });
    }
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
