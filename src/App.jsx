import React, { useState, useEffect } from 'react';
import Header from './components/Header.jsx';
import Lobby from './components/Lobby.jsx';
import Countdown from './components/Countdown.jsx';
import SoundPlayer from './components/SoundPlayer.jsx';
import Recorder from './components/Recorder.jsx';
import RevealScreen from './components/RevealScreen.jsx';
import Leaderboard from './components/Leaderboard.jsx';
import GameOver from './components/GameOver.jsx';
import SoundTester from './components/SoundTester.jsx';
import { socket } from './services/socket.js';
import { soundSynthesizer } from './services/soundSynthesizer.js';
import { clientGameEngine } from './services/clientGameEngine.js';

export default function App() {
  const [room, setRoom] = useState(null);
  const [player, setPlayer] = useState(null);
  const [localRecordedAudioUrl, setLocalRecordedAudioUrl] = useState(null);
  const [isTesterOpen, setIsTesterOpen] = useState(false);
  const [isClientMode, setIsClientMode] = useState(false);

  // Listen to server room updates & client engine updates
  useEffect(() => {
    const unsubscribe = clientGameEngine.subscribe((updatedRoom) => {
      if (isClientMode) {
        setRoom(updatedRoom);
        if (updatedRoom.players) {
          const me = updatedRoom.players.find((p) => p.id === 'local_player');
          if (me) setPlayer(me);
        }
      }
    });

    socket.on('room_update', (updatedRoom) => {
      if (!isClientMode) {
        setRoom(updatedRoom);
        if (socket.id) {
          const me = updatedRoom.players?.find((p) => p.id === socket.id);
          if (me) setPlayer(me);
        }
      }
    });

    return () => {
      unsubscribe();
      socket.off('room_update');
    };
  }, [isClientMode]);

  // Client mode starter (Host Game / Solo Practice) - NEVER auto-starts! Stays in Lobby view.
  const startClientRoom = ({ playerName, avatar, character, isSolo = false }) => {
    setIsClientMode(true);
    const res = clientGameEngine.createRoom({ playerName, avatar, character, isSolo });
    setPlayer(res.player);
  };

  // Handlers for Lobby
  const handleCreateRoom = ({ playerName, avatar, character }) => {
    if (socket.connected) {
      socket.emit('create_room', { playerName, avatar, character }, (res) => {
        if (res?.success) {
          setPlayer(res.player);
        } else {
          startClientRoom({ playerName, avatar, character, isSolo: false });
        }
      });
    } else {
      startClientRoom({ playerName, avatar, character, isSolo: false });
    }
  };

  const handleJoinRoom = ({ roomId, playerName, avatar, character }, onError) => {
    if (!socket.connected) {
      if (onError) onError('Multiplayer requires a live game server. Click "Play vs AI (Solo)" to play right now in your browser!');
      return;
    }
    socket.emit('join_room', { roomId, playerName, avatar, character }, (res) => {
      if (res?.success) {
        setPlayer(res.player);
      } else if (onError) {
        onError(res?.error || 'Could not join room');
      }
    });
  };

  // Solo Practice: Creates room with 2 Egyptian bots, and STAYS in lobby until host clicks Start Game
  const handleSoloPractice = ({ playerName, avatar, character }) => {
    if (socket.connected) {
      socket.emit('create_room', { playerName, avatar, character }, (res) => {
        if (res?.success) {
          setPlayer(res.player);
          const roomId = res.roomId;
          // Add 2 bots to the lobby
          socket.emit('add_bot', { roomId });
          socket.emit('add_bot', { roomId });
          // NO auto-start! Player stays in lobby until clicking Start Game!
        } else {
          startClientRoom({ playerName, avatar, character, isSolo: true });
        }
      });
    } else {
      // Offline / GitHub Pages mode - creates lobby with 2 bots, stays in lobby
      startClientRoom({ playerName, avatar, character, isSolo: true });
    }
  };

  const handleStartGame = () => {
    if (isClientMode) {
      clientGameEngine.startGame();
    } else if (room?.id) {
      socket.emit('start_game', { roomId: room.id });
    }
  };

  const handleAddBot = () => {
    if (isClientMode) {
      clientGameEngine.addBot();
    } else if (room?.id) {
      socket.emit('add_bot', { roomId: room.id });
    }
  };

  const handleRemoveBot = (botId) => {
    if (isClientMode) {
      clientGameEngine.removeBot(botId);
    } else if (room?.id) {
      socket.emit('remove_bot', { roomId: room.id, botId });
    }
  };

  const handleUpdateSettings = (settings) => {
    if (isClientMode) {
      clientGameEngine.updateSettings(settings);
    } else if (room?.id) {
      socket.emit('update_settings', { roomId: room.id, settings });
    }
  };

  // Recorder Submit
  const handleSubmitRecording = (recordingData) => {
    if (!room?.id) return;
    if (recordingData.recordedAudioUrl) {
      setLocalRecordedAudioUrl(recordingData.recordedAudioUrl);
    }
    if (isClientMode) {
      clientGameEngine.submitRecording(recordingData);
    } else {
      socket.emit('submit_recording', { roomId: room.id, recordingData });
    }
  };

  // Reveal Step
  const handleNextRevealStep = () => {
    if (!room?.id) return;
    if (isClientMode) {
      clientGameEngine.nextRevealStep();
    } else {
      socket.emit('next_reveal_step', { roomId: room.id });
    }
  };

  // Leaderboard Advance
  const handleAdvanceRound = () => {
    if (!room?.id) return;
    if (isClientMode) {
      clientGameEngine.advanceRound();
    } else {
      socket.emit('advance_round', { roomId: room.id });
    }
  };

  // Play Again
  const handlePlayAgain = () => {
    if (!room?.id) return;
    if (isClientMode) {
      clientGameEngine.playAgain();
    } else {
      socket.emit('play_again', { roomId: room.id });
    }
  };

  // Leave Room
  const handleLeaveRoom = () => {
    if (isClientMode) {
      clientGameEngine.cleanup();
      setIsClientMode(false);
    }
    setRoom(null);
    setPlayer(null);
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex flex-col justify-between selection:bg-amber-400 selection:text-black">
      {/* Top Navigation */}
      <Header
        room={room}
        player={player}
        onOpenSoundTester={() => setIsTesterOpen(true)}
      />

      {/* Main Game Screen depending on Room State */}
      <main className="flex-1 flex items-center justify-center py-2">
        {!room || room.state === 'LOBBY' ? (
          <Lobby
            room={room}
            player={player}
            onCreateRoom={handleCreateRoom}
            onJoinRoom={handleJoinRoom}
            onStartGame={handleStartGame}
            onAddBot={handleAddBot}
            onRemoveBot={handleRemoveBot}
            onUpdateSettings={handleUpdateSettings}
            onSoloPractice={handleSoloPractice}
          />
        ) : room.state === 'COUNTDOWN' ? (
          <Countdown
            seconds={room.timer}
            currentRound={room.currentRound}
            totalRounds={room.totalRounds || room.settings?.rounds || 3}
          />
        ) : room.state === 'SOUND' ? (
          <SoundPlayer
            sound={room.roundSound}
            timer={room.timer}
          />
        ) : room.state === 'RECORDING' ? (
          <Recorder
            sound={room.roundSound}
            timer={room.timer}
            player={player}
            onSubmitRecording={handleSubmitRecording}
          />
        ) : room.state === 'PROCESSING' ? (
          <div className="arcade-card text-center p-8 max-w-md mx-auto">
            <div className="text-5xl animate-bounce mb-3">🎛️</div>
            <h3 className="text-2xl font-black text-amber-400 mb-2">
              Evaluating Vocal Inflections & Accuracies...
            </h3>
            <p className="text-slate-300 text-sm">
              AI is comparing pitch contours, rhythm envelopes, and tonal frequencies!
            </p>
          </div>
        ) : room.state === 'REVEAL' ? (
          <RevealScreen
            room={room}
            player={player}
            localRecordedAudioUrl={localRecordedAudioUrl}
            onNextRevealStep={handleNextRevealStep}
          />
        ) : room.state === 'LEADERBOARD' ? (
          <Leaderboard
            room={room}
            player={player}
            onAdvanceRound={handleAdvanceRound}
          />
        ) : room.state === 'GAME_OVER' ? (
          <GameOver
            room={room}
            player={player}
            onPlayAgain={handlePlayAgain}
            onLeaveRoom={handleLeaveRoom}
          />
        ) : null}
      </main>

      {/* Footer Info */}
      <footer className="w-full text-center py-3 text-xs text-slate-500 font-bold border-t border-white/5">
        Aledha (قَلِّدْهَا) • Egyptian Voice Mimic Party Game 🇪🇬 • Powered by Web Audio API & WebSockets
      </footer>

      {/* Sound Library & Mic Tester Modal */}
      <SoundTester
        isOpen={isTesterOpen}
        onClose={() => setIsTesterOpen(false)}
      />
    </div>
  );
}
