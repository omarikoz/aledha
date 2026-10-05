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
import { peerNetwork } from './services/peerNetwork.js';
import { audioEngine } from './services/audioEngine.js';

export default function App() {
  const [room, setRoom] = useState(null);
  const [player, setPlayer] = useState(null);
  const [localRecordedAudioUrl, setLocalRecordedAudioUrl] = useState(null);
  const [isTesterOpen, setIsTesterOpen] = useState(false);

  const [micReady, setMicReady] = useState(() => audioEngine.isMicReady());

  // Function to request microphone permission explicitly and unlock audio context
  const handleRequestMic = async () => {
    try {
      audioEngine.unlockAudioContext();
      await audioEngine.initMic();
      setMicReady(true);
      return true;
    } catch (e) {
      console.warn('Microphone permission request failed:', e);
      return false;
    }
  };

  // Request microphone access immediately on website load and unlock audio context
  useEffect(() => {
    // 1. Pre-warm microphone permission immediately on site load
    handleRequestMic();

    // 2. Unlock AudioContext and re-check mic on first user touch/tap anywhere
    const unlock = () => {
      audioEngine.unlockAudioContext();
      handleRequestMic();
    };
    window.addEventListener('touchstart', unlock, { passive: true });
    window.addEventListener('click', unlock, { passive: true });
    window.addEventListener('pointerdown', unlock, { passive: true });
    return () => {
      window.removeEventListener('touchstart', unlock);
      window.removeEventListener('click', unlock);
      window.removeEventListener('pointerdown', unlock);
    };
  }, []);

  // Listen to P2P peer network updates (for GitHub Pages & Mobile WebRTC)
  useEffect(() => {
    peerNetwork.onRoomUpdate((updatedRoom) => {
      setRoom(updatedRoom);
    });

    peerNetwork.onPlayerUpdate((updatedPlayer) => {
      setPlayer(updatedPlayer);
    });

    // Also support local Socket.io if running local server daemon
    socket.on('room_update', (updatedRoom) => {
      if (!peerNetwork.roomId) {
        setRoom(updatedRoom);
        if (socket.id) {
          const me = updatedRoom.players?.find((p) => p.id === socket.id);
          if (me) setPlayer(me);
        }
      }
    });

    return () => {
      socket.off('room_update');
    };
  }, []);

  // Handlers for Lobby Room Creation & Joining
  const handleCreateRoom = ({ playerName, avatar, character }) => {
    // If local Node.js socket server is connected, use it; otherwise use P2P WebRTC directly on mobile/browser
    if (socket.connected) {
      socket.emit('create_room', { playerName, avatar, character }, (res) => {
        if (res?.success) {
          setPlayer(res.player);
        } else {
          peerNetwork.createRoom({ playerName, avatar, character }, (p2pRes) => {
            if (p2pRes.success) setPlayer(p2pRes.player);
          });
        }
      });
    } else {
      peerNetwork.createRoom({ playerName, avatar, character }, (p2pRes) => {
        if (p2pRes.success) setPlayer(p2pRes.player);
      });
    }
  };

  const handleJoinRoom = ({ roomId, playerName, avatar, character }, onError) => {
    if (socket.connected) {
      socket.emit('join_room', { roomId, playerName, avatar, character }, (res) => {
        if (res?.success) {
          setPlayer(res.player);
        } else {
          peerNetwork.joinRoom({ roomId, playerName, avatar, character }, (p2pRes) => {
            if (p2pRes.success) {
              setPlayer(p2pRes.player);
            } else if (onError) {
              onError(p2pRes.error || 'Could not join room');
            }
          });
        }
      });
    } else {
      peerNetwork.joinRoom({ roomId, playerName, avatar, character }, (p2pRes) => {
        if (p2pRes.success) {
          setPlayer(p2pRes.player);
        } else if (onError) {
          onError(p2pRes.error || 'Could not join room');
        }
      });
    }
  };

  const handleStartGame = () => {
    if (peerNetwork.roomId) {
      peerNetwork.startGame();
    } else if (room?.id) {
      socket.emit('start_game', { roomId: room.id });
    }
  };

  const handleUpdateSettings = (settings) => {
    if (peerNetwork.roomId) {
      peerNetwork.updateSettings(settings);
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
    if (peerNetwork.roomId) {
      peerNetwork.submitRecording(recordingData);
    } else {
      socket.emit('submit_recording', { roomId: room.id, recordingData });
    }
  };

  // Reveal Step
  const handleNextRevealStep = () => {
    if (!room?.id) return;
    if (peerNetwork.roomId) {
      peerNetwork.nextRevealStep();
    } else {
      socket.emit('next_reveal_step', { roomId: room.id });
    }
  };

  // Leaderboard Advance
  const handleAdvanceRound = () => {
    if (!room?.id) return;
    if (peerNetwork.roomId) {
      peerNetwork.advanceRound();
    } else {
      socket.emit('advance_round', { roomId: room.id });
    }
  };

  // Play Again
  const handlePlayAgain = () => {
    if (!room?.id) return;
    if (peerNetwork.roomId) {
      peerNetwork.playAgain();
    } else {
      socket.emit('play_again', { roomId: room.id });
    }
  };

  // Leave Room
  const handleLeaveRoom = () => {
    peerNetwork.cleanup();
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
        micReady={micReady}
        onRequestMic={handleRequestMic}
        onOpenSoundTester={() => setIsTesterOpen(true)}
      />

      {/* Main Game Screen depending on Room State */}
      <main className="flex-1 flex items-center justify-center py-2 px-2 sm:px-4">
        {!room || room.state === 'LOBBY' ? (
          <Lobby
            room={room}
            player={player}
            micReady={micReady}
            onRequestMic={handleRequestMic}
            onCreateRoom={handleCreateRoom}
            onJoinRoom={handleJoinRoom}
            onStartGame={handleStartGame}
            onUpdateSettings={handleUpdateSettings}
          />
        ) : room.state === 'COUNTDOWN' ? (
          <Countdown
            timer={room.timer}
            round={room.currentRound || 1}
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
          <div className="arcade-card text-center p-6 sm:p-8 max-w-sm sm:max-w-md mx-auto">
            <div className="text-4xl sm:text-5xl animate-bounce mb-3">🎛️</div>
            <h3 className="text-xl sm:text-2xl font-black text-amber-400 mb-2">
              Evaluating Vocal Impressions...
            </h3>
            <p className="text-slate-300 text-xs sm:text-sm">
              Analyzing vocal energy, pitch contours, and timing matches!
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
      <footer className="w-full text-center py-2.5 text-[11px] sm:text-xs text-slate-500 font-bold border-t border-white/5">
        Aledha (قَلِّدْهَا) • Egyptian Voice Party Game 🇪🇬 • Multiplayer with Friends
      </footer>

      {/* Sound Library & Mic Tester Modal */}
      <SoundTester
        isOpen={isTesterOpen}
        onClose={() => setIsTesterOpen(false)}
      />
    </div>
  );
}
