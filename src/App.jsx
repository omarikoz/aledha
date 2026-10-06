import React, { useState, useEffect, useCallback } from 'react';
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

    // 2. Unlock AudioContext and re-check mic on first user touch/tap
    const unlock = () => {
      audioEngine.unlockAudioContext();
      if (!audioEngine.isMicReady()) {
        handleRequestMic();
      }
    };
    window.addEventListener('touchstart', unlock, { passive: true, once: true });
    window.addEventListener('click', unlock, { passive: true, once: true });
    window.addEventListener('pointerdown', unlock, { passive: true, once: true });
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

    socket.on('game_aborted', (data) => {
      if (!peerNetwork.roomId) {
        setRoom((prev) =>
          prev
            ? {
                ...prev,
                state: 'ABORTED',
                abortReason:
                  data?.message ||
                  `${data?.playerName || 'A player'} disconnected. The game has ended.`
              }
            : null
        );
      }
    });

    return () => {
      socket.off('room_update');
      socket.off('game_aborted');
    };
  }, []);

  // Handlers for Lobby Room Creation & Joining
  const handleCreateRoom = ({ playerName }) => {
    if (socket.connected) {
      socket.emit('create_room', { playerName }, (res) => {
        if (res?.success) {
          setPlayer(res.player);
        } else {
          peerNetwork.createRoom({ playerName }, (p2pRes) => {
            if (p2pRes.success) setPlayer(p2pRes.player);
          });
        }
      });
    } else {
      peerNetwork.createRoom({ playerName }, (p2pRes) => {
        if (p2pRes.success) setPlayer(p2pRes.player);
      });
    }
  };

  const handleJoinRoom = ({ roomId, playerName }, onError) => {
    if (socket.connected) {
      socket.emit('join_room', { roomId, playerName }, (res) => {
        if (res?.success) {
          setPlayer(res.player);
        } else {
          peerNetwork.joinRoom({ roomId, playerName }, (p2pRes) => {
            if (p2pRes.success) {
              setPlayer(p2pRes.player);
            } else if (onError) {
              onError(p2pRes.error || 'Could not join room');
            }
          });
        }
      });
    } else {
      peerNetwork.joinRoom({ roomId, playerName }, (p2pRes) => {
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

  // Recorder Submit (Base64 audio broadcast pipeline)
  const handleSubmitRecording = useCallback((payload) => {
    if (!room?.id) return;
    const audioData = payload?.audioData || payload?.audioDataUrl || payload?.recordedAudioUrl;
    if (audioData) {
      setLocalRecordedAudioUrl(audioData);
    }
    const dataPayload = {
      roomId: room.id,
      audioData,
      audioDataUrl: audioData,
      recordedAudioUrl: audioData,
      mimeType: payload?.mimeType || 'audio/webm',
      aiScore: payload?.aiScore,
      aiDetails: payload?.aiDetails,
      recordingData: payload
    };

    if (peerNetwork.roomId) {
      peerNetwork.submitRecording(dataPayload);
    } else {
      socket.emit('submit_recording', dataPayload);
    }
  }, [room?.id]);

  // Peer Vote Submit
  const handleVote = (score) => {
    if (!room?.id) return;
    if (peerNetwork.roomId) {
      peerNetwork.submitVote(score);
    } else {
      socket.emit('submit_vote', { roomId: room.id, score });
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

  // Return to Lobby after Match Abort
  const handleReturnToLobby = () => {
    if (peerNetwork.roomId) {
      peerNetwork.returnToLobby();
    } else if (room?.id) {
      socket.emit('return_to_lobby', { roomId: room.id });
    } else {
      handleLeaveRoom();
    }
  };

  // Leave Room / Main Menu
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
        ) : room.state === 'COUNTDOWN' || room.state === 'BUFFER' ? (
          <Countdown
            currentRound={room.currentRound || 1}
            totalRounds={room.totalRounds || room.settings?.rounds || 3}
          />
        ) : room.state === 'SOUND' ? (
          <SoundPlayer
            sound={room.roundSound}
            round={room.currentRound || 1}
          />
        ) : room.state === 'RECORDING' ? (
          <Recorder
            sound={room.roundSound}
            player={player}
            room={room}
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
            onVote={handleVote}
          />
        ) : room.state === 'LEADERBOARD' ? (
          <Leaderboard
            room={room}
            player={player}
            onAdvanceRound={handleAdvanceRound}
          />
        ) : room.state === 'ABORTED' ? (
          <div className="w-full max-w-md mx-auto px-4 py-8 text-center animate-bounce-in">
            <div className="arcade-card p-6 sm:p-8 space-y-4">
              <div className="text-4xl sm:text-5xl animate-bounce">⚠️</div>
              <h3 className="text-xl sm:text-2xl font-black text-rose-400">
                Match Aborted
              </h3>
              <p className="text-slate-200 text-sm font-semibold">
                {room.abortReason || 'A player disconnected. The game has ended.'}
              </p>
              <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
                <button
                  onClick={handleReturnToLobby}
                  className="btn-arcade btn-arcade-gold flex-1 text-base py-3.5 shadow-[3px_3px_0px_#000]"
                >
                  Return to Lobby
                </button>
                <button
                  onClick={handleLeaveRoom}
                  className="btn-arcade btn-arcade-dark py-3.5 px-5 text-sm"
                >
                  Main Menu
                </button>
              </div>
            </div>
          </div>
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
        Aledha • Voice Mimic Party Game • Multiplayer with Friends
      </footer>

      {/* Sound Library & Mic Tester Modal */}
      <SoundTester
        isOpen={isTesterOpen}
        onClose={() => setIsTesterOpen(false)}
      />
    </div>
  );
}
