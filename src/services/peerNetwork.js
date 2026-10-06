// WebRTC P2P Multiplayer Network Engine using PeerJS
// Enables real multiplayer between friends on mobile/desktop from GitHub Pages with ZERO backend server!

import { Peer } from 'peerjs';
import soundsCatalog from '../data/sounds.json';

const ROOM_PREFIX = 'ALEDHA-';

class PeerNetwork {
  constructor() {
    this.peer = null;
    this.connections = new Map(); // peerId -> DataConnection
    this.hostConnection = null;   // connection to host if client
    this.isHost = false;
    this.roomId = null;
    this.localPlayer = null;
    this.room = null;
    this.onRoomUpdateCallback = null;
    this.onPlayerUpdateCallback = null;
    this.timerInterval = null;
  }

  onRoomUpdate(callback) {
    this.onRoomUpdateCallback = callback;
    if (this.room && callback) callback(this.room);
  }

  onPlayerUpdate(callback) {
    this.onPlayerUpdateCallback = callback;
    if (this.localPlayer && callback) callback(this.localPlayer);
  }

  notifyRoomUpdate() {
    if (!this.room) return;
    const cloned = JSON.parse(JSON.stringify(this.room));
    if (this.onRoomUpdateCallback) this.onRoomUpdateCallback(cloned);

    // If host, broadcast room state to all connected guests
    if (this.isHost) {
      this.broadcastToGuests({ type: 'ROOM_UPDATE', room: cloned });
    }
  }

  broadcastToGuests(message) {
    const payload = JSON.stringify(message);
    for (const [peerId, conn] of this.connections.entries()) {
      if (conn.open) {
        try {
          conn.send(payload);
        } catch (err) {
          console.warn(`Failed to send message to peer ${peerId}:`, err);
        }
      }
    }
  }

  // Generate a random 4-letter room code
  generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  // Cleanup existing peer connections
  cleanup() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    for (const conn of this.connections.values()) {
      try { conn.close(); } catch (e) {}
    }
    this.connections.clear();
    if (this.hostConnection) {
      try { this.hostConnection.close(); } catch (e) {}
      this.hostConnection = null;
    }
    if (this.peer) {
      try { this.peer.destroy(); } catch (e) {}
      this.peer = null;
    }
    this.isHost = false;
    this.roomId = null;
    this.room = null;
  }

  // Host creates a room
  createRoom({ playerName, avatar, character, settings }, callback) {
    this.cleanup();
    this.isHost = true;

    const code = this.generateCode();
    this.roomId = code;
    const hostPeerId = `${ROOM_PREFIX}${code}`;

    this.localPlayer = {
      id: hostPeerId,
      name: playerName || 'The Host (المعلم)',
      avatar: avatar || character?.avatar || '👑',
      character: character || null,
      score: 0,
      lastRoundScore: 0,
      isHost: true,
      isBot: false,
      isAI: false,
      recordedAudioUrl: null
    };

    this.room = {
      id: code,
      hostId: hostPeerId,
      state: 'LOBBY',
      revealPhase: 'VOTING',
      settings: {
        rounds: settings?.rounds || 3,
        category: settings?.category || 'all'
      },
      currentRound: 1,
      totalRounds: settings?.rounds || 3,
      roundSound: null,
      players: [this.localPlayer],
      recordings: [],
      revealIndex: 0,
      timer: 0
    };

    try {
      this.peer = new Peer(hostPeerId, {
        debug: 1,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' }
          ]
        }
      });

      this.peer.on('open', (id) => {
        console.log(`P2P Host created room ${code} with Peer ID:`, id);
        this.notifyRoomUpdate();
        if (this.onPlayerUpdateCallback) this.onPlayerUpdateCallback(this.localPlayer);
        if (callback) callback({ success: true, roomId: code, player: this.localPlayer });
      });

      this.peer.on('connection', (conn) => {
        this.handleGuestConnection(conn);
      });

      this.peer.on('error', (err) => {
        console.error('PeerJS Host error:', err);
        if (err.type === 'unavailable-id') {
          this.createRoom({ playerName, avatar, character, settings }, callback);
        } else if (callback) {
          callback({ success: false, error: 'Could not create P2P room. Please try again.' });
        }
      });
    } catch (err) {
      console.error('Error initializing Host Peer:', err);
      if (callback) callback({ success: false, error: err.message });
    }
  }

  // Handle incoming guest connection on Host
  handleGuestConnection(conn) {
    conn.on('open', () => {
      console.log(`Guest connected: ${conn.peer}`);
      this.connections.set(conn.peer, conn);

      conn.on('data', (rawData) => {
        try {
          const data = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
          this.handleGuestMessage(conn.peer, data);
        } catch (e) {
          console.error('Failed to parse guest message:', e);
        }
      });

      conn.on('close', () => {
        console.log(`Guest disconnected: ${conn.peer}`);
        this.connections.delete(conn.peer);
        if (this.room) {
          this.room.players = this.room.players.filter(p => p.id !== conn.peer);
          this.notifyRoomUpdate();
        }
      });
    });
  }

  // Handle messages sent from guests to Host
  handleGuestMessage(peerId, data) {
    if (!this.room) return;

    if (data.type === 'JOIN_REQUEST') {
      if (this.room.players.length >= 8) {
        const conn = this.connections.get(peerId);
        if (conn) conn.send(JSON.stringify({ type: 'JOIN_RESPONSE', success: false, error: 'Room is full (max 8 players)!' }));
        return;
      }

      const newPlayer = {
        id: peerId,
        name: data.playerName || `Player ${this.room.players.length + 1}`,
        avatar: data.avatar || '🎙️',
        character: data.character || null,
        score: 0,
        lastRoundScore: 0,
        isHost: false,
        isBot: false,
        isAI: false,
        recordedAudioUrl: null
      };

      this.room.players.push(newPlayer);
      const conn = this.connections.get(peerId);
      if (conn) {
        conn.send(JSON.stringify({ type: 'JOIN_RESPONSE', success: true, player: newPlayer, room: this.room }));
      }
      this.notifyRoomUpdate();
    } else if (data.type === 'SUBMIT_RECORDING') {
      this.recordPlayerSubmission(peerId, data.recordingData);
    } else if (data.type === 'SUBMIT_VOTE') {
      this.recordVote(peerId, data.score);
    }
  }

  // Guest joins a room code
  joinRoom({ roomId, playerName, avatar, character }, callback) {
    this.cleanup();
    this.isHost = false;

    const cleanCode = (roomId || '').trim().toUpperCase();
    this.roomId = cleanCode;
    const targetHostPeerId = `${ROOM_PREFIX}${cleanCode}`;

    try {
      this.peer = new Peer({
        debug: 1,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' }
          ]
        }
      });

      let hasResponded = false;
      const joinTimeout = setTimeout(() => {
        if (!hasResponded) {
          hasResponded = true;
          if (callback) callback({ success: false, error: `Room "${cleanCode}" not found! Make sure the host is currently in the lobby.` });
        }
      }, 9000);

      this.peer.on('open', (myPeerId) => {
        const conn = this.peer.connect(targetHostPeerId, { reliable: true });
        this.hostConnection = conn;

        conn.on('open', () => {
          conn.send(JSON.stringify({
            type: 'JOIN_REQUEST',
            playerName,
            avatar,
            character
          }));
        });

        conn.on('data', (rawData) => {
          try {
            const data = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
            if (data.type === 'JOIN_RESPONSE') {
              clearTimeout(joinTimeout);
              if (!hasResponded) {
                hasResponded = true;
                if (data.success) {
                  this.localPlayer = data.player;
                  this.room = data.room;
                  if (this.onPlayerUpdateCallback) this.onPlayerUpdateCallback(this.localPlayer);
                  if (this.onRoomUpdateCallback) this.onRoomUpdateCallback(this.room);
                  if (callback) callback({ success: true, roomId: cleanCode, player: data.player });
                } else {
                  if (callback) callback({ success: false, error: data.error || 'Could not join room' });
                }
              }
            } else if (data.type === 'ROOM_UPDATE') {
              this.room = data.room;
              if (this.localPlayer) {
                const found = this.room.players.find(p => p.id === this.localPlayer.id);
                if (found) {
                  this.localPlayer = { ...this.localPlayer, ...found };
                  if (this.onPlayerUpdateCallback) this.onPlayerUpdateCallback(this.localPlayer);
                }
              }
              if (this.onRoomUpdateCallback) this.onRoomUpdateCallback(this.room);
            }
          } catch (e) {
            console.error('Failed to parse host message:', e);
          }
        });

        conn.on('error', () => {
          clearTimeout(joinTimeout);
          if (!hasResponded) {
            hasResponded = true;
            if (callback) callback({ success: false, error: 'Connection to host failed. Please check the code.' });
          }
        });

        conn.on('close', () => {
          if (this.onRoomUpdateCallback) {
            this.onRoomUpdateCallback(null);
          }
        });
      });

      this.peer.on('error', (err) => {
        clearTimeout(joinTimeout);
        console.error('PeerJS Guest error:', err);
        if (!hasResponded) {
          hasResponded = true;
          if (callback) callback({ success: false, error: `Could not connect to room "${cleanCode}". Please verify the code!` });
        }
      });
    } catch (err) {
      if (callback) callback({ success: false, error: err.message });
    }
  }

  // Host starts the game - Strict Minimum 2 Players!
  startGame() {
    if (!this.isHost || !this.room) return;
    if (this.room.players.length < 2) return; // Strict minimum 2 players

    this.room.currentRound = 1;
    this.room.totalRounds = this.room.settings.rounds || 3;
    for (const p of this.room.players) {
      p.score = 0;
      p.lastRoundScore = 0;
    }
    this.startRound();
  }

  // Host starts a round
  startRound() {
    if (!this.isHost || !this.room) return;

    const filtered = this.room.settings.category === 'all'
      ? soundsCatalog
      : soundsCatalog.filter(s => s.category === this.room.settings.category);
    const pool = filtered.length > 0 ? filtered : soundsCatalog;
    const sound = pool[Math.floor(Math.random() * pool.length)];

    this.room.roundSound = sound;
    this.room.recordings = [];
    this.room.revealIndex = 0;
    this.room.revealPhase = 'VOTING';
    this.room.state = 'COUNTDOWN';
    this.notifyRoomUpdate();

    // 1. Countdown: 3 seconds
    this.runCountdown(3, 'SOUND', () => {
      // 2. Play Target Sound (Synchronized listening: 4 seconds)
      const soundDuration = Math.min(5, Math.max(3, Math.ceil(sound.duration || 3.5)));
      this.runCountdown(soundDuration, 'RECORDING', () => {
        // 3. Recording Window (Everyone records simultaneously: 5 seconds)
        const recordDuration = Math.min(6, Math.max(4, Math.ceil(sound.duration || 3.5) + 1));
        this.runCountdown(recordDuration, 'PROCESSING', () => {
          setTimeout(() => {
            this.completeRoundRecordings();
          }, 1000);
        });
      });
    });
  }

  runCountdown(seconds, nextState, onComplete) {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.room.timer = seconds;
    this.notifyRoomUpdate();

    this.timerInterval = setInterval(() => {
      if (!this.room) {
        clearInterval(this.timerInterval);
        return;
      }
      this.room.timer -= 1;
      if (this.room.timer <= 0) {
        clearInterval(this.timerInterval);
        this.room.timer = 0;
        if (nextState) this.room.state = nextState;
        this.notifyRoomUpdate();
        if (onComplete) onComplete();
      } else {
        this.notifyRoomUpdate();
      }
    }, 1000);
  }

  // Submit player recording (Host or Guest)
  submitRecording(recordingData) {
    if (this.isHost) {
      this.recordPlayerSubmission(this.localPlayer.id, recordingData);
    } else if (this.hostConnection && this.hostConnection.open) {
      this.hostConnection.send(JSON.stringify({
        type: 'SUBMIT_RECORDING',
        recordingData
      }));
    }
  }

  recordPlayerSubmission(playerId, recordingData) {
    if (!this.isHost || !this.room) return;

    const player = this.room.players.find(p => p.id === playerId);
    if (!player) return;

    const audioUrl = recordingData?.recordedAudioUrl || recordingData?.audioDataUrl || null;
    player.recordedAudioUrl = audioUrl;

    const recEntry = {
      playerId,
      playerName: player.name,
      avatar: player.avatar,
      character: player.character || null,
      recordedAudioUrl: audioUrl,
      audioDataUrl: audioUrl,
      votes: {},
      score: null
    };

    const idx = this.room.recordings.findIndex(r => r.playerId === playerId);
    if (idx >= 0) {
      this.room.recordings[idx] = recEntry;
    } else {
      this.room.recordings.push(recEntry);
    }

    // Check if all players in room submitted
    if (this.room.recordings.length >= this.room.players.length) {
      if (this.timerInterval) clearInterval(this.timerInterval);
      this.completeRoundRecordings();
    }
  }

  completeRoundRecordings() {
    if (!this.isHost || !this.room) return;
    if (this.room.state === 'REVEAL' || this.room.state === 'LEADERBOARD' || this.room.state === 'GAME_OVER') return;

    if (this.timerInterval) clearInterval(this.timerInterval);

    // Fallback for players who didn't submit
    for (const player of this.room.players) {
      const has = this.room.recordings.some(r => r.playerId === player.id);
      if (!has) {
        this.room.recordings.push({
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

    for (const rec of this.room.recordings) {
      if (!rec.votes) rec.votes = {};
      rec.score = null;
    }

    this.room.state = 'REVEAL';
    this.startContestantVoting(0);
  }

  startContestantVoting(index) {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.room.revealIndex = index;
    this.room.revealPhase = 'VOTING';

    const currentRec = this.room.recordings[index];
    if (!currentRec) {
      this.scheduleLeaderboard();
      return;
    }

    // 8 seconds voting countdown
    this.runCountdown(8, null, () => {
      this.revealContestantResult();
    });
  }

  revealContestantResult() {
    if (this.timerInterval) clearInterval(this.timerInterval);

    const currentRec = this.room.recordings[this.room.revealIndex];
    if (currentRec) {
      const voteValues = Object.values(currentRec.votes || {});
      const avgScore = voteValues.length > 0
        ? Math.round(voteValues.reduce((sum, v) => sum + v, 0) / voteValues.length)
        : 50;
      currentRec.score = avgScore;
    }

    this.room.revealPhase = 'RESULT';

    // 4 seconds to view the average score result before moving forward
    this.runCountdown(4, null, () => {
      if (this.room.revealIndex + 1 < this.room.recordings.length) {
        this.startContestantVoting(this.room.revealIndex + 1);
      } else {
        // Accumulate scores & display leaderboard
        for (const rec of this.room.recordings) {
          const p = this.room.players.find(x => x.id === rec.playerId);
          if (p) {
            p.score = (p.score || 0) + (rec.score || 0);
            p.lastRoundScore = rec.score || 0;
          }
        }
        this.room.state = 'LEADERBOARD';
        this.notifyRoomUpdate();
        this.scheduleLeaderboard();
      }
    });
  }

  scheduleLeaderboard() {
    if (this.timerInterval) clearInterval(this.timerInterval);

    // Leaderboard countdown 5 seconds
    this.runCountdown(5, null, () => {
      this.advanceRound();
    });
  }

  submitVote(score) {
    if (this.isHost) {
      this.recordVote(this.localPlayer.id, score);
    } else if (this.hostConnection && this.hostConnection.open) {
      this.hostConnection.send(JSON.stringify({
        type: 'SUBMIT_VOTE',
        score
      }));
    }
  }

  recordVote(voterId, score) {
    if (!this.isHost || !this.room || this.room.state !== 'REVEAL' || this.room.revealPhase !== 'VOTING') return;

    const currentRec = this.room.recordings[this.room.revealIndex];
    if (!currentRec || currentRec.playerId === voterId) return;

    const cleanScore = Math.max(1, Math.min(100, Math.round(Number(score) || 50)));
    currentRec.votes = currentRec.votes || {};
    currentRec.votes[voterId] = cleanScore;

    const eligibleVoters = this.room.players.filter(p => p.id !== currentRec.playerId);
    if (Object.keys(currentRec.votes).length >= eligibleVoters.length) {
      this.revealContestantResult();
    } else {
      this.notifyRoomUpdate();
    }
  }

  // Advance Round or Game Over
  advanceRound() {
    if (!this.isHost || !this.room) return;

    if (this.room.currentRound >= this.room.totalRounds) {
      this.room.state = 'GAME_OVER';
      this.notifyRoomUpdate();
    } else {
      this.room.currentRound += 1;
      this.startRound();
    }
  }

  // Host resets to Lobby for play again
  playAgain() {
    if (!this.isHost || !this.room) return;
    this.room.state = 'LOBBY';
    this.room.revealPhase = 'VOTING';
    this.room.currentRound = 1;
    this.room.recordings = [];
    this.room.roundSound = null;
    for (const p of this.room.players) {
      p.score = 0;
      p.lastRoundScore = 0;
    }
    this.notifyRoomUpdate();
  }

  updateSettings(settings) {
    if (!this.isHost || !this.room) return;
    this.room.settings = { ...this.room.settings, ...settings };
    this.room.totalRounds = this.room.settings.rounds;
    this.notifyRoomUpdate();
  }
}

export const peerNetwork = new PeerNetwork();
