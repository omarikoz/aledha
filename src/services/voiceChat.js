import { socket } from './socket.js';
import { audioEngine } from './audioEngine.js';

// Reliable public STUN servers for WebRTC NAT traversal
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
    this.peers = new Map(); // peerId -> RTCPeerConnection
    this.pendingCandidates = new Map(); // peerId -> Array of candidate objects
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
      console.warn('[WebRTC] Voice chat connect error:', err);
    }
  }

  // Allow setting or refreshing local microphone stream dynamically
  setLocalStream(stream) {
    if (!stream) return;
    this.localStream = stream;
    this.applyMuteStates();
    this.peers.forEach((pc) => {
      this.ensureLocalTrack(pc);
    });
  }

  // Ensure local audio track is attached to peer connection BEFORE offer or answer
  ensureLocalTrack(pc) {
    if (!pc) return;
    let micStream = this.localStream || audioEngine.getMicStream();
    if (!micStream) return;
    this.localStream = micStream;

    micStream.getTracks().forEach((track) => {
      track.enabled = !this.isEmergencyMuted;
      const senders = pc.getSenders ? pc.getSenders() : [];
      const existingSender = senders.find((s) => s.track && s.track.kind === track.kind);
      if (existingSender) {
        if (existingSender.track !== track) {
          existingSender.replaceTrack(track).catch((err) => {
            console.warn('[WebRTC] replaceTrack error:', err);
          });
        }
      } else {
        try {
          pc.addTrack(track, micStream);
          console.log('[WebRTC] Local track attached to peer connection');
        } catch (err) {
          console.warn('[WebRTC] pc.addTrack error:', err);
        }
      }
    });
  }

  bindSocketEvents() {
    // 1. Existing players receive alert when a new player joins the voice mesh
    const handleNewPeerJoined = async ({ peerId }) => {
      if (!peerId || peerId === socket.id) return;
      console.log('[WebRTC] New peer joined room:', peerId, '- Initiating offer');
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
      console.log('[WebRTC] Peer left room:', peerId);
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

      // 1. Local Stream Attachment BEFORE generating offer or answer
      this.ensureLocalTrack(pc);

      // 2. ICE Candidates exchange via Socket.io
      pc.onicecandidate = (event) => {
        if (event.candidate && this.roomId) {
          const candidateData = event.candidate.toJSON ? event.candidate.toJSON() : {
            candidate: event.candidate.candidate,
            sdpMid: event.candidate.sdpMid,
            sdpMLineIndex: event.candidate.sdpMLineIndex,
            usernameFragment: event.candidate.usernameFragment
          };

          const payload = {
            roomId: this.roomId,
            to: remotePeerId,
            targetPeerId: remotePeerId,
            signal: {
              type: 'candidate',
              candidate: candidateData
            }
          };
          socket.emit('signal_send', payload);
        }
      };

      // 3. Remote Audio Playback Binding
      pc.ontrack = (event) => {
        console.log(`[WebRTC] Received remote track (${event.track?.kind}) from peer: ${remotePeerId}`);
        const stream = (event.streams && event.streams[0]) ? event.streams[0] : new MediaStream([event.track]);

        let audioEl = document.getElementById(`audio-peer-${remotePeerId}`);
        if (!audioEl) {
          audioEl = document.createElement('audio');
          audioEl.id = `audio-peer-${remotePeerId}`;
          audioEl.setAttribute('data-peer-id', remotePeerId);
          audioEl.autoplay = true;
          audioEl.playsInline = true;
          audioEl.muted = false; // Remote peer audio elements must NEVER be muted!
          audioEl.style.position = 'fixed';
          audioEl.style.top = '-9999px';
          audioEl.style.left = '-9999px';
          audioEl.style.width = '1px';
          audioEl.style.height = '1px';
          audioEl.style.opacity = '0';
          audioEl.style.pointerEvents = 'none';
          document.body.appendChild(audioEl);
          this.audioElements.set(remotePeerId, audioEl);
        }

        audioEl.autoplay = true;
        audioEl.playsInline = true;
        audioEl.muted = false; // Remote peer audio elements must NEVER be muted!
        audioEl.srcObject = stream;

        // Explicitly trigger play with catch handler
        const playPromise = audioEl.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              console.log(`[WebRTC] Audio playback active for peer: ${remotePeerId}`);
            })
            .catch((err) => {
              console.error(`[WebRTC] Remote peer audio play error for ${remotePeerId}:`, err);
            });
        }
      };

      pc.onconnectionstatechange = () => {
        console.log(`[WebRTC] Connection state with ${remotePeerId}: ${pc.connectionState}`);
        if (
          pc.connectionState === 'disconnected' ||
          pc.connectionState === 'failed' ||
          pc.connectionState === 'closed'
        ) {
          this.closePeer(remotePeerId);
          this.notifyStateChange();
        }
      };

      // If initiator, generate offer and send to peer
      if (isInitiator) {
        this.ensureLocalTrack(pc);
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
            sdp: {
              type: pc.localDescription.type,
              sdp: pc.localDescription.sdp
            }
          }
        };
        socket.emit('signal_send', payload);
      }

      this.notifyStateChange();
      return pc;
    } catch (err) {
      console.warn('[WebRTC] createPeerConnection error:', err);
      return null;
    }
  }

  async handleIncomingSignal(remotePeerId, signal) {
    try {
      let pc = this.peers.get(remotePeerId);

      if (signal.type === 'offer') {
        if (!pc) {
          pc = await this.createPeerConnection(remotePeerId, false);
        } else if (pc.signalingState !== 'stable') {
          console.log(`[WebRTC] Glare/unstable state (${pc.signalingState}) for ${remotePeerId}, recreating connection`);
          this.closePeer(remotePeerId);
          pc = await this.createPeerConnection(remotePeerId, false);
        }
        if (!pc) return;

        // Ensure local audio track attached BEFORE answer
        this.ensureLocalTrack(pc);

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
            sdp: {
              type: pc.localDescription.type,
              sdp: pc.localDescription.sdp
            }
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
            console.error('[WebRTC] addIceCandidate error:', e);
          }
        } else {
          // Queue ICE candidate until setRemoteDescription completes
          const queue = this.pendingCandidates.get(remotePeerId) || [];
          queue.push(signal.candidate);
          this.pendingCandidates.set(remotePeerId, queue);
        }
      }
    } catch (err) {
      console.warn('[WebRTC] handleIncomingSignal error:', err);
    }
  }

  async flushPendingCandidates(peerId, pc) {
    const queue = this.pendingCandidates.get(peerId) || [];
    this.pendingCandidates.set(peerId, []);
    for (const candidate of queue) {
      if (candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error('[WebRTC] flush candidate error:', e);
        }
      }
    }
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
    const canTransmitVoice = !this.isEmergencyMuted && !this.isPhaseMuted;

    // 1. Control local microphone tracks: only emergency mute silences the hardware mic.
    // Phase muting MUST NOT disable the hardware mic track so players can record their voice take!
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !this.isEmergencyMuted;
      });
    }

    // 2. Control RTCPeerConnection sender tracks (silences WebRTC mesh voice during SOUND/RECORDING phases)
    this.peers.forEach((pc) => {
      try {
        pc.getSenders().forEach((sender) => {
          if (sender.track && sender.track.kind === 'audio') {
            sender.track.enabled = canTransmitVoice;
          }
        });
      } catch (e) {}
    });

    // 3. Remote audio elements must NEVER be muted (autoplay + volume intact)
    this.audioElements.forEach((audioEl) => {
      try {
        audioEl.muted = false;
      } catch (e) {}
    });
  }

  resumeAllAudio() {
    this.audioElements.forEach((audioEl) => {
      if (audioEl && audioEl.paused) {
        audioEl.play().catch(() => {});
      }
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
