// Client-Side Game Engine for "Aledha"
// Enables 100% full gameplay (Play vs AI / Solo Practice) on static hosts like GitHub Pages
// Runs cleanly without requiring a Node.js server!

import soundsCatalog from '../data/sounds.json';
import { audioEngine } from './audioEngine.js';

const ROOM_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function generateRoomCode() {
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += ROOM_CHARS.charAt(Math.floor(Math.random() * ROOM_CHARS.length));
  }
  return code;
}

const BOT_TEMPLATES = [
  {
    name: 'Captain Koshary 🍲',
    avatar: '🍲',
    personality: 'funny',
    character: {
      name: 'Captain Koshary',
      nameAr: 'كابتن كشري',
      avatar: '🍲',
      quote: 'شطة ودقة وصوت يهز القلعة!'
    }
  },
  {
    name: 'Uncle Shakshak 🪕',
    avatar: '🪕',
    personality: 'pro',
    character: {
      name: 'Uncle Shakshak',
      nameAr: 'عم شكشك',
      avatar: '🪕',
      quote: 'الأصل ما يتنسيش والنغمة فنانة!'
    }
  },
  {
    name: 'Mido Toktok Maestro 🛺',
    avatar: '🛺',
    personality: 'pro',
    character: {
      name: 'Mido Toktok',
      nameAr: 'أسطى الميكروباص',
      avatar: '🛺',
      quote: 'وسع يا بني النقل السريع هنا!'
    }
  },
  {
    name: 'Doctor Dahk 🩺',
    avatar: '👨‍⚕️',
    personality: 'funny',
    character: {
      name: 'Doctor Dahk',
      nameAr: 'دكتور ضحك',
      avatar: '👨‍⚕️',
      quote: 'ضحكة واحدة تعالج مليون علة!'
    }
  }
];

class ClientGameEngine {
  constructor() {
    this.room = null;
    this.timerInterval = null;
    this.revealTimer = null;
    this.listeners = new Set();
    this.humanPlayer = null;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    if (this.room) listener(this.room);
    return () => this.listeners.delete(listener);
  }

  broadcast() {
    if (!this.room) return;
    const cloned = JSON.parse(JSON.stringify(this.room));
    for (const listener of this.listeners) {
      listener(cloned);
    }
  }

  // Create Room (Host Game / Solo Practice) - NEVER auto-starts! Stays in Lobby view.
  createRoom({ playerName, avatar, character, isSolo = false }) {
    this.cleanup();

    const hostId = 'local_player';
    const roomId = generateRoomCode();

    this.humanPlayer = {
      id: hostId,
      name: playerName || 'The Host (المعلم)',
      avatar: avatar || character?.avatar || '👑',
      character: character || null,
      recordedAudioUrl: null,
      score: 0,
      lastRoundScore: 0,
      isHost: true,
      isBot: false,
      isAI: false
    };

    const players = [this.humanPlayer];

    // If solo, add 2 Egyptian bots so the player has immediate opponents
    if (isSolo) {
      const shuffledBots = [...BOT_TEMPLATES].sort(() => 0.5 - Math.random());
      players.push({
        id: 'bot_1',
        name: shuffledBots[0].name,
        avatar: shuffledBots[0].avatar,
        character: shuffledBots[0].character,
        personality: shuffledBots[0].personality,
        score: 0,
        lastRoundScore: 0,
        isHost: false,
        isBot: true,
        isAI: true
      });
      players.push({
        id: 'bot_2',
        name: shuffledBots[1].name,
        avatar: shuffledBots[1].avatar,
        character: shuffledBots[1].character,
        personality: shuffledBots[1].personality,
        score: 0,
        lastRoundScore: 0,
        isHost: false,
        isBot: true,
        isAI: true
      });
    }

    this.room = {
      id: roomId,
      hostId,
      state: 'LOBBY',
      settings: {
        rounds: 3,
        category: 'all',
        difficulty: 'medium'
      },
      currentRound: 1,
      totalRounds: 3,
      roundSound: null,
      players,
      recordings: [],
      revealIndex: 0,
      timer: 0
    };

    // Stays in LOBBY! No setTimeout, no auto-start.
    this.broadcast();
    return { success: true, roomId, player: this.humanPlayer };
  }

  // Backward compatibility alias
  createSoloRoom(params) {
    return this.createRoom({ ...params, isSolo: true });
  }

  addBot() {
    if (!this.room || this.room.players.length >= 8) return;
    const existingNames = this.room.players.map(p => p.name);
    const availableBots = BOT_TEMPLATES.filter(b => !existingNames.includes(b.name));
    const chosen = availableBots.length > 0 ? availableBots[0] : BOT_TEMPLATES[Math.floor(Math.random() * BOT_TEMPLATES.length)];
    const newBot = {
      id: `bot_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      name: chosen.name,
      avatar: chosen.avatar,
      character: chosen.character,
      personality: chosen.personality,
      score: 0,
      lastRoundScore: 0,
      isHost: false,
      isBot: true,
      isAI: true
    };
    this.room.players.push(newBot);
    this.broadcast();
  }

  removeBot(botId) {
    if (!this.room) return;
    this.room.players = this.room.players.filter(p => p.id !== botId);
    this.broadcast();
  }

  updateSettings(settings) {
    if (!this.room) return;
    this.room.settings = { ...this.room.settings, ...settings };
    this.room.totalRounds = this.room.settings.rounds || 3;
    this.broadcast();
  }

  startGame() {
    if (!this.room) return;
    this.room.currentRound = 1;
    this.room.players.forEach(p => {
      p.score = 0;
      p.lastRoundScore = 0;
    });
    this.startRound();
  }

  startRound() {
    this.cleanup();

    const filtered = this.room.settings?.category === 'all'
      ? soundsCatalog
      : soundsCatalog.filter(s => s.category === this.room.settings.category);
    const pool = filtered.length > 0 ? filtered : soundsCatalog;
    const sound = pool[Math.floor(Math.random() * pool.length)];

    this.room.roundSound = sound;
    this.room.recordings = [];
    this.room.revealIndex = 0;
    this.room.state = 'COUNTDOWN';
    this.broadcast();

    // 1. Countdown 3 seconds ("Get Ready")
    this.runCountdown(3, 'SOUND', () => {
      // 2. Play Target Sound (Max 6s)
      const soundDuration = Math.min(6, Math.max(2, Math.ceil(sound.duration || 4.0)));
      this.runCountdown(soundDuration, 'RECORDING', () => {
        // 3. Recording Window (Max 9s, generous buffer for smooth mic submission)
        const recordDuration = Math.min(9, Math.max(6, Math.ceil(sound.duration || 4.0) + 3));
        this.runCountdown(recordDuration, 'PROCESSING', () => {
          setTimeout(() => {
            this.completeRound();
          }, 1500);
        });
      });
    });
  }

  runCountdown(seconds, nextState, onComplete) {
    if (!this.room) return;
    this.room.timer = seconds;
    this.broadcast();

    if (this.timerInterval) clearInterval(this.timerInterval);

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
        this.broadcast();
        if (onComplete) onComplete();
      } else {
        this.broadcast();
      }
    }, 1000);
  }

  // Human submits recording
  submitRecording(recordingData) {
    if (!this.room) return;

    const audioUrl = recordingData.recordedAudioUrl || recordingData.audioDataUrl;
    this.humanPlayer.recordedAudioUrl = audioUrl;

    const recEntry = {
      playerId: this.humanPlayer.id,
      playerName: this.humanPlayer.name,
      avatar: this.humanPlayer.avatar,
      character: this.humanPlayer.character,
      isBot: false,
      isAI: false,
      recordedAudioUrl: audioUrl,
      audioDataUrl: audioUrl,
      score: recordingData.score,
      rhythmScore: recordingData.rhythmScore,
      pitchScore: recordingData.pitchScore,
      energyScore: recordingData.energyScore,
      tier: recordingData.tier || audioEngine.getEgyptianRatingTier(recordingData.score)
    };

    const existingIdx = this.room.recordings.findIndex(r => r.playerId === this.humanPlayer.id);
    if (existingIdx >= 0) {
      this.room.recordings[existingIdx] = recEntry;
    } else {
      this.room.recordings.push(recEntry);
    }

    if (this.timerInterval) clearInterval(this.timerInterval);
    this.completeRound();
  }

  completeRound() {
    if (!this.room) return;
    if (this.room.state === 'REVEAL' || this.room.state === 'LEADERBOARD') return;

    // Ensure human entry exists
    const hasHuman = this.room.recordings.some(r => r.playerId === this.humanPlayer.id);
    if (!hasHuman) {
      this.room.recordings.push({
        playerId: this.humanPlayer.id,
        playerName: this.humanPlayer.name,
        avatar: this.humanPlayer.avatar,
        character: this.humanPlayer.character,
        isBot: false,
        isAI: false,
        recordedAudioUrl: this.humanPlayer.recordedAudioUrl || null,
        audioDataUrl: null,
        score: 30,
        rhythmScore: 25,
        pitchScore: 30,
        energyScore: 35,
        tier: audioEngine.getEgyptianRatingTier(30)
      });
    }

    // Generate Bot attempts
    const bots = this.room.players.filter(p => p.isBot || p.isAI);
    for (const bot of bots) {
      const alreadyHas = this.room.recordings.some(r => r.playerId === bot.id);
      if (!alreadyHas) {
        let baseScore = 55;
        if (bot.personality === 'pro') baseScore = 80;
        else if (bot.personality === 'wild') baseScore = 65;
        else baseScore = 40;

        const variance = Math.floor(Math.random() * 21) - 10;
        const score = Math.max(15, Math.min(96, baseScore + variance));

        const rhythmScore = Math.max(10, Math.min(100, score + Math.floor(Math.random() * 12) - 6));
        const pitchScore = Math.max(10, Math.min(100, score + Math.floor(Math.random() * 12) - 6));
        const energyScore = Math.max(10, Math.min(100, score + Math.floor(Math.random() * 12) - 6));

        this.room.recordings.push({
          playerId: bot.id,
          playerName: bot.name,
          avatar: bot.avatar,
          character: bot.character,
          isBot: true,
          isAI: true,
          recordedAudioUrl: null,
          audioDataUrl: null,
          score,
          rhythmScore,
          pitchScore,
          energyScore,
          tier: audioEngine.getEgyptianRatingTier(score)
        });
      }
    }

    // Update cumulative player scores
    for (const rec of this.room.recordings) {
      const p = this.room.players.find(x => x.id === rec.playerId);
      if (p) {
        p.score += rec.score;
        p.lastRoundScore = rec.score;
      }
    }

    this.room.state = 'REVEAL';
    this.room.revealIndex = 0;
    this.broadcast();

    this.scheduleRevealStep();
  }

  scheduleRevealStep() {
    if (this.revealTimer) clearTimeout(this.revealTimer);
    if (!this.room || this.room.state !== 'REVEAL') return;

    const clipDuration = Math.min(6.0, Math.max(2.0, this.room.roundSound?.duration || 3.5));
    const stepDurationMs = Math.round((clipDuration + 1.5) * 1000);

    this.revealTimer = setTimeout(() => {
      this.nextRevealStep();
    }, stepDurationMs);
  }

  nextRevealStep() {
    if (!this.room || this.room.state !== 'REVEAL') return;
    if (this.revealTimer) clearTimeout(this.revealTimer);

    this.room.revealIndex += 1;
    if (this.room.revealIndex >= this.room.recordings.length) {
      this.room.state = 'LEADERBOARD';
      this.broadcast();
      this.scheduleLeaderboardAdvance();
    } else {
      this.broadcast();
      this.scheduleRevealStep();
    }
  }

  scheduleLeaderboardAdvance() {
    if (this.revealTimer) clearTimeout(this.revealTimer);
    this.revealTimer = setTimeout(() => {
      if (this.room?.state === 'LEADERBOARD') {
        this.advanceRound();
      }
    }, 5500);
  }

  advanceRound() {
    if (!this.room) return;
    if (this.revealTimer) clearTimeout(this.revealTimer);

    if (this.room.currentRound >= this.room.settings.rounds) {
      this.room.state = 'GAME_OVER';
      this.broadcast();
    } else {
      this.room.currentRound += 1;
      this.startRound();
    }
  }

  playAgain() {
    if (!this.room) return;
    this.room.state = 'LOBBY';
    this.room.currentRound = 1;
    this.room.recordings = [];
    this.room.roundSound = null;
    this.room.players.forEach(p => {
      p.score = 0;
      p.lastRoundScore = 0;
    });
    this.broadcast();
  }

  cleanup() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    if (this.revealTimer) clearTimeout(this.revealTimer);
    this.timerInterval = null;
    this.revealTimer = null;
  }
}

export const clientGameEngine = new ClientGameEngine();
