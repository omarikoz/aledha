// Client-Side Game Engine for "Aledha"
// Enables 100% full gameplay (Play vs AI / Solo Practice) on static hosts like GitHub Pages
// Runs without requiring a Node.js server!

import soundsCatalog from '../data/sounds.json';
import { audioEngine } from './audioEngine.js';

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
    // Re-attach non-serializable properties if any
    for (const listener of this.listeners) {
      listener(cloned);
    }
  }

  // Create Solo Practice Room (1 Human + 2 Egyptian Bots)
  createSoloRoom({ playerName, avatar, character }) {
    this.cleanup();

    const hostId = 'local_player';
    this.humanPlayer = {
      id: hostId,
      name: playerName || 'Player (المعلم)',
      avatar: avatar || character?.avatar || '👑',
      character: character || null,
      recordedAudioUrl: null,
      score: 0,
      lastRoundScore: 0,
      isHost: true,
      isBot: false
    };

    // Pick 2 distinct bots
    const shuffledBots = [...BOT_TEMPLATES].sort(() => 0.5 - Math.random());
    const bot1 = {
      id: 'bot_1',
      name: shuffledBots[0].name,
      avatar: shuffledBots[0].avatar,
      character: shuffledBots[0].character,
      personality: shuffledBots[0].personality,
      score: 0,
      lastRoundScore: 0,
      isHost: false,
      isBot: true
    };
    const bot2 = {
      id: 'bot_2',
      name: shuffledBots[1].name,
      avatar: shuffledBots[1].avatar,
      character: shuffledBots[1].character,
      personality: shuffledBots[1].personality,
      score: 0,
      lastRoundScore: 0,
      isHost: false,
      isBot: true
    };

    this.room = {
      id: 'SOLO',
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
      players: [this.humanPlayer, bot1, bot2],
      recordings: [],
      revealIndex: 0,
      timer: 0
    };

    this.broadcast();

    // Auto-start match after brief lobby preview
    setTimeout(() => {
      this.startGame();
    }, 600);

    return { success: true, roomId: 'SOLO', player: this.humanPlayer };
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

    // Pick random sound from catalog
    const sound = soundsCatalog[Math.floor(Math.random() * soundsCatalog.length)];
    this.room.roundSound = sound;
    this.room.recordings = [];
    this.room.revealIndex = 0;
    this.room.state = 'COUNTDOWN';
    this.broadcast();

    // 1. Countdown 3 seconds
    this.runCountdown(3, 'SOUND', () => {
      // 2. Play Target Sound (Max 6s)
      const soundDuration = Math.min(6, Math.max(2, Math.ceil(sound.duration || 4.0)));
      this.runCountdown(soundDuration, 'RECORDING', () => {
        // 3. Recording Window (Max 6s)
        const recordDuration = Math.min(6, Math.max(2, Math.ceil(sound.duration || 4.0)));
        this.runCountdown(recordDuration, 'PROCESSING', () => {
          // Transition to reveal
          setTimeout(() => {
            this.completeRound();
          }, 800);
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

    // Immediately process round
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
        recordedAudioUrl: null,
        audioDataUrl: null,
        score: 35,
        rhythmScore: 30,
        pitchScore: 35,
        energyScore: 40,
        tier: audioEngine.getEgyptianRatingTier(35)
      });
    }

    // Generate Bot attempts
    const bots = this.room.players.filter(p => p.isBot);
    for (const bot of bots) {
      const alreadyHas = this.room.recordings.some(r => r.playerId === bot.id);
      if (!alreadyHas) {
        let baseScore = 60;
        if (bot.personality === 'pro') baseScore = 75 + Math.floor(Math.random() * 20);
        else if (bot.personality === 'wild') baseScore = 20 + Math.floor(Math.random() * 45);
        else baseScore = 45 + Math.floor(Math.random() * 35);

        const rhythmScore = Math.max(10, Math.min(99, baseScore + Math.floor((Math.random() - 0.5) * 16)));
        const pitchScore = Math.max(10, Math.min(99, baseScore + Math.floor((Math.random() - 0.5) * 16)));
        const energyScore = Math.max(10, Math.min(99, baseScore + Math.floor((Math.random() - 0.5) * 16)));

        this.room.recordings.push({
          playerId: bot.id,
          playerName: bot.name,
          avatar: bot.avatar,
          character: bot.character,
          isBot: true,
          recordedAudioUrl: null,
          audioDataUrl: null,
          score: baseScore,
          rhythmScore,
          pitchScore,
          energyScore,
          tier: audioEngine.getEgyptianRatingTier(baseScore)
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
