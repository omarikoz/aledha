import { socket } from './socket.js';
import { audioEngine } from './audioEngine.js';

const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ]
};

class VoiceChatService {
  constructor() {
    this.roomId = null;
    this.localStream = null;
    this.peers = new Map(); // remotePeerId -> RTCPeerConnection
    this.audioElements = new Map(); // remotePeerId -> HTMLAudioElement
    this.isEmergencyMuted = false;
    this.isPhaseMuted = false;
    this.currentPhase = 'LOBBY';
    this.isConnected = false;
    this.stateListeners = new Set();
    this.socketHandlersBound = false;
  }

  // Subscribe to voice chat state updates (for UI indicators)
  onStateChange(callback) {
    this.stateListeners.add(callback);
    callback(this.getState());
    return () => this.stateListeners.delete(callback);
  }

  notifyStateChange() {
    const state = this.getState();
    this.stateListeners.forEach((cb) => {
      try { cb(state); } catch (e) {}
    });
  }

  getState() {
    return {
      isConnected: this.isConnected,
      activePeersCount: this.peers.size,
      isEmergencyMuted: this.isEmergencyMuted,
      isPhaseMuted: this.isPhaseMuted,
      currentPhase: this.currentPhase,
      canSpeak: this.isConnected && !this.isEmergencyMuted && !this.isPhaseMuted
    };
  }

  // Connect local microphone stream into room voice mesh
  async connect(roomId, stream = null) {
    if (!roomId) return;
    this.roomId = roomId;

    try {
      // Use existing stream from audioEngine or provided stream
      let micStream = stream || audioEngine.getMicStream();
      if (!micStream) {
        micStream = await audioEngine.initMic();
      }
      this.localStream = micStream;

      if (!this.socketHandlersBound) {
        this.bindSocketEvents();
        this.socketHandlersBound = true;
      }

      this.isConnected = true;
      this.notifyStateChange();

      // Announce entry into voice chat mesh
      if (socket.connected) {
        socket.emit('voice_join', { roomId: this.roomId });
      }
    } catch (err) {
      console.warn('Voice chat connect error:', err);
    }
  }

  bindSocketEvents() {
    // When another peer joins the room, the existing member initiates the offer
    socket.on('voice_user_joined', async ({ peerId }) => {
      if (!peerId || peerId === socket.id) return;
      await this.createPeerConnection(peerId, true);
    });

    // Handle incoming WebRTC signaling (offer, answer, candidate)
    socket.on('voice_signal', async ({ fromPeerId, signal }) => {
      if (!fromPeerId || fromPeerId === socket.id || !signal) return;
      await this.handleIncomingSignal(fromPeerId, signal);
    });

    // When another peer leaves
    socket.on('voice_user_left', ({ peerId }) => {
      if (!peerId) return;
      this.closePeer(peerId);
      this.notifyStateChange();
    });
  }

  async createPeerConnection(remotePeerId, isInitiator = false) {
    if (this.peers.has(remotePeerId)) {
      this.closePeer(remotePeerId);
    }

    try {
      const pc = new RTCPeerConnection(RTC_CONFIG);
      this.peers.set(remotePeerId, pc);

      // Add local audio tracks to peer connection
      const canTransmit = !this.isEmergencyMuted && !this.isPhaseMuted;
      if (this.localStream) {
        this.localStream.getAudioTracks().forEach((track) => {
          track.enabled = canTransmit;
          try {
            pc.addTrack(track, this.localStream);
          } catch (e) {
            console.warn('pc.addTrack error:', e);
          }
        });
      }

      // Handle ICE Candidate exchange
      pc.onicecandidate = (event) => {
        if (event.candidate && this.roomId) {
          socket.emit('voice_signal', {
            roomId: this.roomId,
            targetPeerId: remotePeerId,
            signal: {
              type: 'ice-candidate',
              candidate: event.candidate
            }
          });
        }
      };

      // Handle remote incoming audio track
      pc.ontrack = (event) => {
        const remoteStream = event.streams[0] || new MediaStream([event.track]);
        let audioEl = this.audioElements.get(remotePeerId);
        if (!audioEl) {
          audioEl = new Audio();
          audioEl.autoplay = true;
          this.audioElements.set(remotePeerId, audioEl);
        }
        audioEl.srcObject = remoteStream;
        // In critical phases (Sound/Recording), mute remote voice playback
        audioEl.muted = this.isPhaseMuted;
        audioEl.play().catch(() => {});
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          this.closePeer(remotePeerId);
          this.notifyStateChange();
        }
      };

      if (isInitiator) {
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: false
        });
        await pc.setLocalDescription(offer);
        socket.emit('voice_signal', {
          roomId: this.roomId,
          targetPeerId: remotePeerId,
          signal: {
            type: 'offer',
            sdp: pc.localDescription
          }
        });
      }

      this.notifyStateChange();
      return pc;
    } catch (err) {
      console.warn('createPeerConnection error:', err);
      return null;
    }
  }

  async handleIncomingSignal(remotePeerId, signal) {
    try {
      let pc = this.peers.get(remotePeerId);

      if (signal.type === 'offer') {
        if (!pc) {
          pc = await this.createPeerConnection(remotePeerId, false);
        }
        if (!pc) return;

        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit('voice_signal', {
          roomId: this.roomId,
          targetPeerId: remotePeerId,
          signal: {
            type: 'answer',
            sdp: pc.localDescription
          }
        });
      } else if (signal.type === 'answer') {
        if (pc && pc.signalingState !== 'stable') {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        }
      } else if (signal.type === 'ice-candidate') {
        if (pc && signal.candidate) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
          } catch (e) {
            console.warn('addIceCandidate error:', e);
          }
        }
      }
    } catch (err) {
      console.warn('handleIncomingSignal error:', err);
    }
  }

  closePeer(remotePeerId) {
    const pc = this.peers.get(remotePeerId);
    if (pc) {
      try { pc.close(); } catch (e) {}
      this.peers.delete(remotePeerId);
    }
    const audioEl = this.audioElements.get(remotePeerId);
    if (audioEl) {
      try {
        audioEl.pause();
        audioEl.srcObject = null;
      } catch (e) {}
      this.audioElements.delete(remotePeerId);
    }
  }

  // Automatic Game Phase Muting
  // - "SOUND" (Listen phase) -> MUTED so target sound is completely clear
  // - "RECORDING" (Mimic phase) -> MUTED so players don't hear each other while speaking
  // - "LOBBY", "REVEAL" (Voting), "LEADERBOARD", "GAME_OVER" -> UNMUTED
  setGamePhase(phase) {
    this.currentPhase = phase || 'LOBBY';
    const shouldMute = (
      phase === 'SOUND' ||
      phase === 'RECORDING' ||
      phase === 'BUFFER' ||
      phase === 'COUNTDOWN'
    );

    this.isPhaseMuted = shouldMute;
    this.applyMuteStates();
    this.notifyStateChange();
  }

  // Persistent Emergency Mute (Top-right button)
  setEmergencyMute(muted) {
    this.isEmergencyMuted = !!muted;
    this.applyMuteStates();
    this.notifyStateChange();
  }

  toggleEmergencyMute() {
    this.setEmergencyMute(!this.isEmergencyMuted);
    return this.isEmergencyMuted;
  }

  applyMuteStates() {
    const canTransmit = !this.isEmergencyMuted && !this.isPhaseMuted;

    // 1. Control local microphone hardware tracks
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = canTransmit;
      });
    }

    // 2. Control RTCPeerConnection sender tracks
    this.peers.forEach((pc) => {
      try {
        pc.getSenders().forEach((sender) => {
          if (sender.track && sender.track.kind === 'audio') {
            sender.track.enabled = canTransmit;
          }
        });
      } catch (e) {}
    });

    // 3. Control incoming remote audio playback elements
    // When in SOUND or RECORDING phase, mute remote audio so players are isolated
    this.audioElements.forEach((audioEl) => {
      try {
        audioEl.muted = this.isPhaseMuted;
      } catch (e) {}
    });
  }

  // Cleanup upon leaving room
  disconnect() {
    if (this.roomId && socket.connected) {
      socket.emit('voice_leave', { roomId: this.roomId });
    }

    this.peers.forEach((_, id) => this.closePeer(id));
    this.peers.clear();
    this.audioElements.clear();
    this.roomId = null;
    this.isConnected = false;
    this.notifyStateChange();
  }
}

export const voiceChat = new VoiceChatService();
