import { socket } from './socket.js';
import { audioEngine } from './audioEngine.js';

const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

class VoiceChatService {
  constructor() {
    this.roomId = null;
    this.localStream = null;
    this.peers = new Map(); // peerId -> RTCPeerConnection
    this.pendingCandidates = new Map(); // peerId -> RTCIceCandidate[]
    this.audioElements = new Map(); // peerId -> HTMLAudioElement
    this.isEmergencyMuted = false;
    this.isPhaseMuted = false;
    this.currentPhase = 'LOBBY';
    this.isConnected = false;
    this.stateListeners = new Set();
    this.socketHandlersBound = false;
  }

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
      this.applyMuteStates();
      this.notifyStateChange();

      // Announce to all room members that local player is ready for voice chat
      if (socket.connected) {
        socket.emit('voice_join', { roomId: this.roomId });
      }
    } catch (err) {
      console.warn('Voice chat connect error:', err);
    }
  }

  bindSocketEvents() {
    // 1. Existing players receive alert when a new player joins the voice mesh
    const handleNewPeerJoined = async ({ peerId }) => {
      if (!peerId || peerId === socket.id) return;
      await this.createPeerConnection(peerId, true);
    };

    socket.on('new_peer_joined', handleNewPeerJoined);
    socket.on('voice_user_joined', handleNewPeerJoined);

    // 2. Signaling pipeline (offer, answer, candidate)
    const handleSignalReceive = async ({ from, fromPeerId, signal }) => {
      const senderId = from || fromPeerId;
      if (!senderId || senderId === socket.id || !signal) return;
      await this.handleIncomingSignal(senderId, signal);
    };

    socket.on('signal_receive', handleSignalReceive);
    socket.on('voice_signal', handleSignalReceive);

    // 3. Peer disconnection
    const handlePeerLeft = ({ peerId }) => {
      if (!peerId) return;
      this.closePeer(peerId);
      this.notifyStateChange();
    };

    socket.on('peer_left', handlePeerLeft);
    socket.on('voice_user_left', handlePeerLeft);
  }

  async createPeerConnection(remotePeerId, isInitiator = false) {
    if (this.peers.has(remotePeerId)) {
      this.closePeer(remotePeerId);
    }

    try {
      const pc = new RTCPeerConnection(RTC_CONFIG);
      this.peers.set(remotePeerId, pc);
      this.pendingCandidates.set(remotePeerId, []);

      // Add local audio tracks immediately
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

      // Exchange ICE Candidates via Socket.io
      pc.onicecandidate = (event) => {
        if (event.candidate && this.roomId) {
          const payload = {
            roomId: this.roomId,
            to: remotePeerId,
            targetPeerId: remotePeerId,
            signal: {
              type: 'candidate',
              candidate: event.candidate
            }
          };
          socket.emit('signal_send', payload);
        }
      };

      // Auto-Attaching Remote Audio Streams in DOM with playsInline & autoplay
      pc.ontrack = (event) => {
        const stream = event.streams[0] || new MediaStream([event.track]);
        let audioEl = document.getElementById(`audio-peer-${remotePeerId}`);
        if (!audioEl) {
          audioEl = document.createElement('audio');
          audioEl.id = `audio-peer-${remotePeerId}`;
          audioEl.autoplay = true;
          audioEl.playsInline = true;
          audioEl.style.display = 'none';
          document.body.appendChild(audioEl);
          this.audioElements.set(remotePeerId, audioEl);
        }

        audioEl.srcObject = stream;
        audioEl.muted = this.isPhaseMuted;

        const playPromise = audioEl.play();
        if (playPromise !== undefined) {
          playPromise.catch((err) => {
            console.warn('Remote peer audio autoplay blocked:', err);
          });
        }
      };

      pc.onconnectionstatechange = () => {
        if (
          pc.connectionState === 'disconnected' ||
          pc.connectionState === 'failed' ||
          pc.connectionState === 'closed'
        ) {
          this.closePeer(remotePeerId);
          this.notifyStateChange();
        }
      };

      // If initiator, generate offer and emit
      if (isInitiator) {
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: false
        });
        await pc.setLocalDescription(offer);

        const payload = {
          roomId: this.roomId,
          to: remotePeerId,
          targetPeerId: remotePeerId,
          signal: {
            type: 'offer',
            sdp: pc.localDescription
          }
        };
        socket.emit('signal_send', payload);
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

        // Flush any queued ICE candidates for this peer
        await this.flushPendingCandidates(remotePeerId, pc);

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        const payload = {
          roomId: this.roomId,
          to: remotePeerId,
          targetPeerId: remotePeerId,
          signal: {
            type: 'answer',
            sdp: pc.localDescription
          }
        };
        socket.emit('signal_send', payload);
      } else if (signal.type === 'answer') {
        if (pc && pc.signalingState !== 'stable') {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          await this.flushPendingCandidates(remotePeerId, pc);
        }
      } else if (signal.type === 'candidate' && signal.candidate) {
        if (pc && pc.remoteDescription && pc.remoteDescription.type) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
          } catch (e) {
            console.warn('addIceCandidate error:', e);
          }
        } else {
          // Queue ICE candidate until setRemoteDescription completes
          const queue = this.pendingCandidates.get(remotePeerId) || [];
          queue.push(signal.candidate);
          this.pendingCandidates.set(remotePeerId, queue);
        }
      }
    } catch (err) {
      console.warn('handleIncomingSignal error:', err);
    }
  }

  async flushPendingCandidates(peerId, pc) {
    const queue = this.pendingCandidates.get(peerId) || [];
    for (const candidate of queue) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.warn('flush candidate error:', e);
      }
    }
    this.pendingCandidates.set(peerId, []);
  }

  closePeer(remotePeerId) {
    const pc = this.peers.get(remotePeerId);
    if (pc) {
      try { pc.close(); } catch (e) {}
      this.peers.delete(remotePeerId);
    }
    this.pendingCandidates.delete(remotePeerId);

    const audioEl = this.audioElements.get(remotePeerId) || document.getElementById(`audio-peer-${remotePeerId}`);
    if (audioEl) {
      try {
        audioEl.pause();
        audioEl.srcObject = null;
        if (audioEl.parentNode) {
          audioEl.parentNode.removeChild(audioEl);
        }
      } catch (e) {}
      this.audioElements.delete(remotePeerId);
    }
  }

  // Automatic Game Phase Muting
  // - "SOUND" (Listen phase) -> MUTED so target sound is crystal clear
  // - "RECORDING" (Mimic phase) -> MUTED so players are isolated
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

    // 1. Control local microphone tracks
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

    // 3. Control remote audio elements
    this.audioElements.forEach((audioEl) => {
      try {
        audioEl.muted = this.isPhaseMuted;
      } catch (e) {}
    });
  }

  disconnect() {
    if (this.roomId && socket.connected) {
      socket.emit('voice_leave', { roomId: this.roomId });
    }

    this.peers.forEach((_, id) => this.closePeer(id));
    this.peers.clear();
    this.pendingCandidates.clear();
    this.audioElements.clear();
    this.roomId = null;
    this.isConnected = false;
    this.notifyStateChange();
  }
}

export const voiceChat = new VoiceChatService();
