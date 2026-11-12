// Native WebRTC Voice Chat with Trystero-powered Screen Sharing
// Features:
// 1. Native WebRTC voice mesh with signaling through the existing game room
// 2. High-Fidelity Voice Chat with Opus codec, Echo Cancellation, Noise Suppression & AGC
// 3. Direct remote audio playback through one HTMLAudioElement per peer
// 4. 3D Spatial Proximity Audio: Dynamic distance attenuation (sounds louder up close, comfortable floor everywhere)
// 5. Voice Activity Detection (VAD) via Web Audio API Analyser for real-time speaking indicators
// 6. Full HD Screen Sharing (Entire Screen, App Window, Browser Tab with Audio) onto the Giant 3D Cinema TV

import { joinRoom } from 'https://cdn.jsdelivr.net/npm/trystero/+esm';

export class RtcManager {
  constructor({
    selfId,
    roomId,
    sendSignal = () => {},
    getPeerIds = () => [],
    onRemoteScreenTrack,
    onPeerSpeakingChange,
    onLocalSpeakingChange,
    onMicStateChange,
    onScreenShareChange,
    toast = () => {},
  }) {
    this.selfId = selfId;
    this.roomId = roomId || this.parseRoomId();
    this.sendSignal = sendSignal;
    this.getPeerIds = getPeerIds;
    this.onRemoteScreenTrack = onRemoteScreenTrack;
    this.onPeerSpeakingChange = onPeerSpeakingChange;
    this.onLocalSpeakingChange = onLocalSpeakingChange;
    this.onMicStateChange = onMicStateChange;
    this.onScreenShareChange = onScreenShareChange;
    this.toast = toast;

    // Streams & State
    this.localVoiceStream = null;
    this.localScreenStream = null;
    this.isMicMuted = true;
    this.isMicRequested = false;
    this.isSharingScreen = false;

    // Web Audio API context for Spatial Audio & VAD
    this.audioCtx = null;
    this.localAnalyser = null;
    this.localVoiceSource = null;
    this.isLocalSpeaking = false;
    this.vadInterval = null;
    this.audioUnlockHandler = null;
    this.audioContextStateHandler = null;

    // Settings
    this.proximityEnabled = true;
    this.masterVoiceVolume = 1.0;
    this.maxAudibleDistance = 55.0;
    this.minAudibleDistance = 4.0;

    // Peers map: gameId -> { peerId, tPeerId, audioEl, stream, screenStream }
    this.remotePeers = new Map();
    this.trysteroToGameId = new Map();
    this.voiceConnections = new Map();
    this.seenVoiceSignals = new Set();

    // Trystero Room instance & actions
    this.room = null;

    this.initAudioContext();
    this.initTrystero();
  }

  parseRoomId() {
    if (typeof window !== 'undefined' && window.location?.hash) {
      const match = window.location.hash.match(/room=([^&]+)/);
      if (match) return decodeURIComponent(match[1]);
    }
    return 'quang-truong-noel';
  }

  initAudioContext() {
    if (!this.audioCtx && typeof window !== 'undefined') {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
        this.audioContextStateHandler = () => {
          for (const peer of this.remotePeers.values()) this.updateRemoteAudioRouting(peer);
        };
        this.audioCtx.addEventListener('statechange', this.audioContextStateHandler);
      }
    }
    if (typeof window !== 'undefined' && !this.audioUnlockHandler) {
      this.audioUnlockHandler = () => this.unlockAudioPlayback();
      window.addEventListener('pointerdown', this.audioUnlockHandler, { passive: true });
      window.addEventListener('keydown', this.audioUnlockHandler, { passive: true });
      window.addEventListener('click', this.audioUnlockHandler, { passive: true });
      window.addEventListener('touchstart', this.audioUnlockHandler, { passive: true });
    }
  }

  initTrystero() {
    try {
      const config = { appId: 'gather-holidays-voice-v3' };
      const cleanRoomId = 'gh_v_' + encodeURIComponent(this.roomId);
      console.log(`[RTC] Joining Trystero media room for screen sharing: ${cleanRoomId} with selfId=${this.selfId}`);
      this.room = joinRoom(config, cleanRoomId, {
        onJoinError: ({ peerId, error }) => {
          console.error(`[RTC] Trystero screen share connection failed for peer ${peerId}:`, error);
        },
      });

      const handleJoin = peerId => {
        if (!peerId) return;
        console.log(`[RTC] Trystero screen peer joined: ${peerId}`);
        if (this.localScreenStream) this.publishStream(this.localScreenStream, peerId, 'screen');
      };

      const handleLeave = peerId => {
        const gameId = this.trysteroToGameId.get(peerId) || peerId;
        console.log(`[RTC] Trystero screen peer disconnected: ${peerId}${gameId !== peerId ? ` (player ${gameId})` : ''}`);
        const peer = this.remotePeers.get(gameId);
        if (peer?.screenStream) this.onRemoteScreenTrack?.(gameId, null);
        if (peer) peer.screenStream = null;
        if (peer && !peer.audioEl) this.remotePeers.delete(gameId);
        for (const [trysteroId, mappedGameId] of this.trysteroToGameId) {
          if (trysteroId === peerId || mappedGameId === gameId) this.trysteroToGameId.delete(trysteroId);
        }
      };

      // Trystero event hooks are callback properties, not registration methods.
      this.room.onPeerJoin = handleJoin;
      this.room.onPeerLeave = handleLeave;

      // Handle incoming streams (Microphone Voice or Screen Share)
      const handleStream = (stream, peerInfo, legacyMetadata) => {
        // Current Trystero passes {userId, peerId, metadata}; older releases passed
        // peerId as a string and metadata as the third argument.
        const peerId = typeof peerInfo === 'string' ? peerInfo : peerInfo?.peerId;
        const userId = typeof peerInfo === 'object' ? peerInfo?.userId : peerId;
        const metadata = typeof peerInfo === 'object' ? (peerInfo?.metadata || legacyMetadata) : legacyMetadata;
        const gameId = metadata?.selfId || this.trysteroToGameId.get(userId) ||
          this.trysteroToGameId.get(peerId) || userId || peerId;
        if (!gameId) return;
        if (userId) this.trysteroToGameId.set(userId, gameId);
        if (peerId) this.trysteroToGameId.set(peerId, gameId);
        const tracks = stream?.getTracks?.() || [];
        console.log(`[RTC] Incoming stream from player ${gameId} (peer ${peerId || userId}):`, metadata, tracks.map(t => `${t.kind}:${t.id}`));

        const hasVideo = stream?.getVideoTracks?.().length > 0;
        const isScreen = metadata?.kind === 'screen' || hasVideo;

        if (isScreen) {
          // Screen Share Video Track
          let p = this.remotePeers.get(gameId);
          if (!p) {
            p = { peerId: gameId, tPeerId: userId || peerId, audioEl: null, stream: null, screenStream: null };
            this.remotePeers.set(gameId, p);
          }
          p.screenStream = stream;
          this.onRemoteScreenTrack?.(gameId, stream);

          if (stream.getVideoTracks()[0]) {
            stream.getVideoTracks()[0].onended = () => {
              if (p.screenStream === stream) {
                p.screenStream = null;
                this.onRemoteScreenTrack?.(gameId, null);
              }
            };
          }
        } else {
          // Voice Audio Track
          if (!stream?.getAudioTracks?.().length) {
            console.warn(`[RTC] Ignoring non-audio stream from player ${gameId}.`);
            return;
          }
          console.log(`[RTC] Incoming microphone audio from player ${gameId}.`);
          this.attachRemoteAudio(gameId, userId || peerId, stream);
        }
      };

      this.room.onPeerStream = handleStream;
    } catch (err) {
      console.error('[Trystero] Initialization error:', err);
    }
  }

  connectPeer(peerId) {
    if (!peerId || peerId === this.selfId) return null;
    const existing = this.voiceConnections.get(peerId);
    if (existing && existing.pc.signalingState !== 'closed') {
      if (this.localVoiceStream) {
        for (const track of this.localVoiceStream.getAudioTracks()) {
          if (!existing.pc.getSenders().some(sender => sender.track === track)) {
            existing.pc.addTrack(track, this.localVoiceStream);
            console.log(`[RTC] Added local microphone track to existing connection ${peerId}.`);
          }
        }
      }
      return existing;
    }

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    });
    const connection = {
      pc,
      makingOffer: false,
      ignoreOffer: false,
      isSettingRemoteAnswerPending: false,
      pendingCandidates: [],
      polite: String(this.selfId) > String(peerId),
    };
    this.voiceConnections.set(peerId, connection);

    if (this.localVoiceStream) {
      for (const track of this.localVoiceStream.getAudioTracks()) {
        if (!pc.getSenders().some(sender => sender.track === track)) {
          pc.addTrack(track, this.localVoiceStream);
          console.log(`[RTC] Added local microphone track to ${peerId}.`);
        }
      }
    }

    pc.onicecandidate = event => {
      if (event.candidate) {
        this.sendSignal(peerId, { type: 'ice-candidate', candidate: event.candidate.toJSON() });
      }
    };
    pc.ontrack = event => {
      let stream = event.streams?.[0];
      if (!stream) {
        stream = this.remotePeers.get(peerId)?.stream || new MediaStream();
        if (!stream.getTracks().some(track => track.id === event.track.id)) stream.addTrack(event.track);
      }
      console.log(`[RTC] Native WebRTC received ${event.track.kind} track from ${peerId}.`);
      if (event.track.kind === 'audio') this.attachRemoteAudio(peerId, peerId, stream);
    };
    pc.onconnectionstatechange = () => {
      console.log(`[RTC] Voice connection ${peerId}: ${pc.connectionState}.`);
      if (pc.connectionState === 'failed') {
        console.error(`[RTC] Voice connection failed for ${peerId}; this network pair may require TURN.`);
      }
    };
    pc.onnegotiationneeded = async () => {
      try {
        connection.makingOffer = true;
        await pc.setLocalDescription(await pc.createOffer());
        this.sendSignal(peerId, {
          type: 'description',
          description: { type: pc.localDescription.type, sdp: pc.localDescription.sdp },
        });
      } catch (error) {
        console.error(`[RTC] Could not create voice offer for ${peerId}:`, error);
      } finally {
        connection.makingOffer = false;
      }
    };

    console.log(`[RTC] Created native voice connection to ${peerId}.`);
    return connection;
  }

  async handleSignal(fromPeerId, signal) {
    if (!signal || !fromPeerId) return;
    if (signal._rtcSignalId) {
      const signalKey = `${fromPeerId}:${signal._rtcSignalId}`;
      if (this.seenVoiceSignals.has(signalKey)) return;
      this.seenVoiceSignals.add(signalKey);
      if (this.seenVoiceSignals.size > 2000) {
        this.seenVoiceSignals.delete(this.seenVoiceSignals.values().next().value);
      }
    }
    const connection = this.connectPeer(fromPeerId);
    if (!connection) return;
    const { pc } = connection;

    try {
      if (signal.type === 'ice-candidate') {
        if (connection.ignoreOffer) return;
        const candidate = new RTCIceCandidate(signal.candidate);
        if (pc.remoteDescription) await pc.addIceCandidate(candidate);
        else connection.pendingCandidates.push(candidate);
        return;
      }
      if (signal.type !== 'description' || !signal.description) return;

      const description = new RTCSessionDescription(signal.description);
      const readyForOffer = !connection.makingOffer &&
        (pc.signalingState === 'stable' || connection.isSettingRemoteAnswerPending);
      const offerCollision = description.type === 'offer' && !readyForOffer;
      connection.ignoreOffer = !connection.polite && offerCollision;
      if (connection.ignoreOffer) {
        console.warn(`[RTC] Ignoring colliding voice offer from ${fromPeerId}.`);
        return;
      }

      connection.isSettingRemoteAnswerPending = description.type === 'answer';
      await pc.setRemoteDescription(description);
      connection.isSettingRemoteAnswerPending = false;

      for (const candidate of connection.pendingCandidates.splice(0)) {
        await pc.addIceCandidate(candidate);
      }

      if (description.type === 'offer') {
        await pc.setLocalDescription(await pc.createAnswer());
        this.sendSignal(fromPeerId, {
          type: 'description',
          description: { type: pc.localDescription.type, sdp: pc.localDescription.sdp },
        });
      }
    } catch (error) {
      connection.isSettingRemoteAnswerPending = false;
      if (!connection.ignoreOffer) console.error(`[RTC] Voice signaling failed for ${fromPeerId}:`, error);
    }
  }

  async publishStream(stream, target, kind) {
    if (!this.room) {
      console.warn(`[Trystero] Cannot publish ${kind} stream before joining the room.`);
      this.toast('⚠️ Voice chat chưa kết nối tới phòng.');
      return false;
    }
    if (typeof this.room.addStream !== 'function') {
      console.error(`[Trystero] The room does not support publishing ${kind} streams.`);
      this.toast('⚠️ Phiên bản voice chat hiện tại không hỗ trợ gửi media.');
      return false;
    }

    const options = { metadata: { kind, selfId: this.selfId } };
    if (target) options.target = target;
    try {
      await this.room.addStream(stream, options);
      return true;
    } catch (error) {
      console.warn(`[Trystero] Could not publish ${kind} stream:`, error);
      this.toast(`⚠️ Không thể gửi ${kind === 'voice' ? 'âm thanh' : 'màn hình'} tới người chơi.`);
      return false;
    }
  }

  // -------------------------------------------------------------
  // MICROPHONE & VOICE CHAT
  // -------------------------------------------------------------
  async toggleMic() {
    this.unlockAudioPlayback();
    if (!this.localVoiceStream) {
      return await this.startMicrophone();
    }
    this.isMicMuted = !this.isMicMuted;
    this.applyMicMuteState();
    this.onMicStateChange?.(!this.isMicMuted);
    return !this.isMicMuted;
  }

  async startMicrophone() {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      this.toast('⚠️ Trình duyệt của bạn không hỗ trợ truy cập Microphone.');
      return false;
    }

    try {
      this.initAudioContext();
      if (this.audioCtx && this.audioCtx.state !== 'running') {
        await this.audioCtx.resume().catch(() => {});
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      this.localVoiceStream = stream;
      this.isMicRequested = true;
      this.isMicMuted = false;
      for (const peerId of this.getPeerIds()) this.connectPeer(peerId);

      // Set up local Web Audio Analyser for Voice Activity Detection (VAD)
      if (this.audioCtx) {
        if (this.localVoiceSource) {
          try { this.localVoiceSource.disconnect(); } catch {}
        }
        this.localVoiceSource = this.audioCtx.createMediaStreamSource(stream);
        this.localAnalyser = this.audioCtx.createAnalyser();
        this.localAnalyser.fftSize = 256;
        this.localAnalyser.smoothingTimeConstant = 0.4;
        this.localVoiceSource.connect(this.localAnalyser);
      }

      this.startVadLoop();
      this.onMicStateChange?.(true);
      this.toast('🎙️ Đã bật Microphone — Bạn có thể nói chuyện cùng mọi người!');
      return true;
    } catch (err) {
      console.error('[Trystero] Microphone access denied or error:', err);
      this.toast('⚠️ Không thể bật Micro: Vui lòng cho phép quyền truy cập Micro trên trình duyệt!');
      this.isMicMuted = true;
      this.onMicStateChange?.(false);
      return false;
    }
  }

  applyMicMuteState() {
    if (this.localVoiceStream) {
      const track = this.localVoiceStream.getAudioTracks()[0];
      if (track) {
        track.enabled = !this.isMicMuted;
      }
    }
    if (this.isMicMuted && this.isLocalSpeaking) {
      this.isLocalSpeaking = false;
      this.onLocalSpeakingChange?.(false);
    }
  }

  stopMicrophone() {
    if (this.localVoiceStream) {
      this.localVoiceStream.getTracks().forEach(t => t.stop());
      this.localVoiceStream = null;
    }
    this.isMicMuted = true;
    this.isLocalSpeaking = false;
    this.onLocalSpeakingChange?.(false);
    this.onMicStateChange?.(false);
  }

  // Voice Activity Detection (VAD) loop: measures volume to trigger speaking indicator
  startVadLoop() {
    if (this.vadInterval) return;
    const buf = new Uint8Array(128);

    this.vadInterval = setInterval(() => {
      // Local voice check
      if (this.localAnalyser && !this.isMicMuted && this.localVoiceStream) {
        this.localAnalyser.getByteFrequencyData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i];
        const avg = sum / buf.length;
        const speaking = avg > 14; // Volume threshold
        if (speaking !== this.isLocalSpeaking) {
          this.isLocalSpeaking = speaking;
          this.onLocalSpeakingChange?.(speaking);
        }
      } else if (this.isLocalSpeaking) {
        this.isLocalSpeaking = false;
        this.onLocalSpeakingChange?.(false);
      }
    }, 120);
  }

  // -------------------------------------------------------------
  // SCREEN SHARING ONTO GIANT TV
  // -------------------------------------------------------------
  async startScreenShare() {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getDisplayMedia) {
      this.toast('⚠️ Trình duyệt của bạn không hỗ trợ tính năng Chia sẻ màn hình.');
      return null;
    }

    try {
      this.initAudioContext();
      if (this.audioCtx && this.audioCtx.state !== 'running') {
        await this.audioCtx.resume().catch(() => {});
      }

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
          frameRate: { max: 30 },
        },
        audio: true,
      });

      this.localScreenStream = stream;
      this.isSharingScreen = true;

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          this.stopScreenShare();
        };
      }

      if (!await this.publishStream(stream, null, 'screen')) {
        stream.getTracks().forEach(track => track.stop());
        this.localScreenStream = null;
        this.isSharingScreen = false;
        return null;
      }

      this.onScreenShareChange?.(true, stream);
      this.toast('🖥️ Đang chiếu Màn hình của bạn lên TV lớn!');
      return stream;
    } catch (err) {
      if (err.name === 'NotAllowedError') return null;
      console.error('[Trystero] Screen share failed:', err);
      this.toast('⚠️ Không thể chia sẻ màn hình: ' + (err.message || 'Lỗi không xác định'));
      return null;
    }
  }

  stopScreenShare() {
    if (!this.isSharingScreen && !this.localScreenStream) return;

    if (this.localScreenStream) {
      if (this.room) {
        try {
          this.room.removeStream(this.localScreenStream);
        } catch {}
      }
      this.localScreenStream.getTracks().forEach(track => track.stop());
      this.localScreenStream = null;
    }

    this.isSharingScreen = false;
    this.onScreenShareChange?.(false, null);
    this.toast('⏹ Đã dừng chia sẻ màn hình lên TV.');
  }

  // -------------------------------------------------------------
  // REMOTE AUDIO PLAYBACK & 3D SPATIAL PROXIMITY
  // -------------------------------------------------------------
  attachRemoteAudio(peerId, tPeerId, stream) {
    this.unlockAudioPlayback();

    let p = this.remotePeers.get(peerId);
    if (!p) {
      p = { peerId, tPeerId, audioEl: null, stream: null, screenStream: null };
      this.remotePeers.set(peerId, p);
    }
    p.tPeerId = tPeerId;
    p.stream = stream;
    let audio = p.audioEl;
    if (!audio) {
      audio = document.createElement('audio');
      audio.id = `gh-voice-${peerId}`;
      audio.autoplay = true;
      audio.playsInline = true;
      audio.style.position = 'fixed';
      audio.style.left = '-9999px';
      audio.style.top = '-9999px';
      audio.style.width = '1px';
      audio.style.height = '1px';
      audio.style.opacity = '0.001';
      audio.style.pointerEvents = 'none';
      audio.onplaying = () => console.log(`[RTC] Audio playback started for player ${peerId}.`);
      document.body.appendChild(audio);
      p.audioEl = audio;
    }

    if (audio.srcObject !== stream) {
      audio.srcObject = stream;
    }
    this.updateRemoteAudioRouting(p);
  }

  updateRemoteAudioRouting(peer) {
    if (!peer?.stream || !peer.audioEl) return;
    const audio = peer.audioEl;
    audio.muted = false;
    audio.volume = peer.voiceVolume ?? this.masterVoiceVolume;
    if (audio.paused) {
      audio.play().catch(error => {
        console.warn(`[RTC] Audio playback failed for player ${peer.peerId}; waiting for a user gesture:`, error);
      });
    }
  }

  updatePeerDistances(myPos, peerPositionsMap) {
    if (!this.remotePeers.size) return;

    for (const [peerId, peer] of this.remotePeers.entries()) {
      let spatialFactor = 1;

      if (this.proximityEnabled && myPos && peerPositionsMap?.has(peerId)) {
        const pPos = peerPositionsMap.get(peerId);
        const px = pPos.x ?? pPos.tx ?? myPos.x;
        const py = pPos.y ?? pPos.ty ?? myPos.y;
        const dist = Math.hypot(px - myPos.x, py - myPos.y);

        if (dist > this.minAudibleDistance) {
          const t =
            (dist - this.minAudibleDistance) / (this.maxAudibleDistance - this.minAudibleDistance);
          spatialFactor = 0.40 + 0.60 * Math.pow(1 - Math.min(1, t), 1.2);
        }
      }

      peer.voiceVolume = this.masterVoiceVolume * spatialFactor;
      this.applyPeerVolume(peer);
    }
  }

  applyPeerVolume(peer) {
    const volume = Math.max(0, Math.min(1, peer.voiceVolume ?? this.masterVoiceVolume));
    try {
      if (peer.audioEl && Math.abs(peer.audioEl.volume - volume) > 0.02) {
        peer.audioEl.volume = volume;
      }
    } catch (error) {
      console.warn(`[Trystero] Could not update voice volume for ${peer.peerId}:`, error);
    }
  }

  unlockAudioPlayback() {
    if (this.audioCtx && this.audioCtx.state !== 'running') {
      this.audioCtx.resume().catch(error => {
        console.warn('[Trystero] AudioContext could not be resumed:', error);
      });
    }
    for (const peer of this.remotePeers.values()) {
      this.updateRemoteAudioRouting(peer);
    }
  }

  setProximityEnabled(enabled) {
    this.proximityEnabled = !!enabled;
    if (!this.proximityEnabled) {
      for (const peer of this.remotePeers.values()) {
        peer.voiceVolume = this.masterVoiceVolume;
        this.applyPeerVolume(peer);
      }
    }
  }

  setMasterVoiceVolume(val) {
    this.masterVoiceVolume = Math.max(0, Math.min(1, val));
    for (const peer of this.remotePeers.values()) {
      peer.voiceVolume = this.masterVoiceVolume;
      this.applyPeerVolume(peer);
    }
  }

  getRemoteScreenStream(peerId) {
    return this.remotePeers.get(peerId)?.screenStream || null;
  }

  getOrCreatePeer(peerId) {
    return this.remotePeers.get(peerId) || null;
  }

  removePeer(peerId) {
    const connection = this.voiceConnections.get(peerId);
    if (connection) {
      connection.pc.onicecandidate = null;
      connection.pc.ontrack = null;
      connection.pc.onconnectionstatechange = null;
      connection.pc.onnegotiationneeded = null;
      try { connection.pc.close(); } catch {}
      this.voiceConnections.delete(peerId);
    }
    const peer = this.remotePeers.get(peerId);
    if (!peer) return;

    if (peer.screenStream) this.onRemoteScreenTrack?.(peerId, null);
    if (peer.audioEl) {
      try {
        peer.audioEl.pause();
        peer.audioEl.srcObject = null;
        peer.audioEl.remove();
      } catch {}
    }
    this.remotePeers.delete(peerId);
  }

  destroy() {
    if (this.vadInterval) {
      clearInterval(this.vadInterval);
      this.vadInterval = null;
    }
    this.stopMicrophone();
    this.stopScreenShare();
    for (const peerId of Array.from(this.voiceConnections.keys())) {
      this.removePeer(peerId);
    }
    for (const peerId of Array.from(this.remotePeers.keys())) {
      this.removePeer(peerId);
    }
    if (this.room) {
      try {
        this.room.leave();
      } catch {}
      this.room = null;
    }
    if (this.audioCtx) {
      if (this.audioContextStateHandler) {
        this.audioCtx.removeEventListener('statechange', this.audioContextStateHandler);
      }
      try {
        this.audioCtx.close();
      } catch {}
      this.audioCtx = null;
    }
    if (typeof window !== 'undefined' && this.audioUnlockHandler) {
      window.removeEventListener('pointerdown', this.audioUnlockHandler);
      window.removeEventListener('keydown', this.audioUnlockHandler);
      window.removeEventListener('click', this.audioUnlockHandler);
      window.removeEventListener('touchstart', this.audioUnlockHandler);
      this.audioUnlockHandler = null;
    }
  }
}
