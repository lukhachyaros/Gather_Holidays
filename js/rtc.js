// WebRTC Voice Chat & Real-Time Screen Sharing Engine powered by Trystero P2P SDK
// Features:
// 1. Trystero Serverless WebRTC Mesh: robust, battle-tested P2P streaming over public MQTT brokers
// 2. High-Fidelity Voice Chat with Opus codec, Echo Cancellation, Noise Suppression & AGC
// 3. Web Audio API Direct Speaker Playback: routes incoming remote stream directly to AudioContext.destination
// 4. 3D Spatial Proximity Audio: Dynamic distance attenuation (sounds louder up close, comfortable floor everywhere)
// 5. Voice Activity Detection (VAD) via Web Audio API Analyser for real-time speaking indicators
// 6. Full HD Screen Sharing (Entire Screen, App Window, Browser Tab with Audio) onto the Giant 3D Cinema TV

import { joinRoom } from 'https://cdn.jsdelivr.net/npm/@trystero-p2p/mqtt/+esm';

export class RtcManager {
  constructor({
    selfId,
    roomId,
    sendSignal = () => {},
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

    // Settings
    this.proximityEnabled = true;
    this.masterVoiceVolume = 1.0;
    this.maxAudibleDistance = 55.0;
    this.minAudibleDistance = 4.0;

    // Peers map: gameId -> { peerId, tPeerId, audioEl, gainNode, source, screenStream }
    this.remotePeers = new Map();
    this.trysteroToGameId = new Map();

    // Trystero Room instance & actions
    this.room = null;
    this.sendHandshake = null;

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
      }
    }
    const resumeAudio = () => {
      if (this.audioCtx && this.audioCtx.state !== 'running') {
        this.audioCtx.resume().catch(() => {});
      }
      this.unlockAudioPlayback();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('pointerdown', resumeAudio, { passive: true });
      window.addEventListener('keydown', resumeAudio, { passive: true });
      window.addEventListener('click', resumeAudio, { passive: true });
      window.addEventListener('touchstart', resumeAudio, { passive: true });
    }
  }

  initTrystero() {
    try {
      const config = {
        appId: 'gather-holidays-voice-v3',
        relayUrls: [
          'wss://broker.emqx.io:8084/mqtt',
          'wss://broker.hivemq.com:8884/mqtt',
        ],
      };
      const cleanRoomId = 'gh_v_' + encodeURIComponent(this.roomId);
      console.log(`[Trystero] Joining voice room: ${cleanRoomId} with selfId=${this.selfId}`);
      this.room = joinRoom(config, cleanRoomId);

      // Handshake action to associate Trystero peerId <-> game selfId
      const handshake = this.room.makeAction('handshake');
      this.handshake = handshake;

      const handleJoin = tPeerId => {
        console.log(`[Trystero] Peer joined room: ${tPeerId}`);
        // Send our game selfId to the newcomer
        try {
          handshake.send({ selfId: this.selfId }, { target: tPeerId });
        } catch (e) {
          try { handshake.send({ selfId: this.selfId }, tPeerId); } catch {}
        }

        // If local voice or screen is currently active, push stream to the new peer
        if (this.localVoiceStream) {
          try {
            this.room.addStream(this.localVoiceStream, { target: tPeerId, metadata: { kind: 'voice', selfId: this.selfId } });
          } catch (e) {
            try { this.room.addStream(this.localVoiceStream, tPeerId, { kind: 'voice', selfId: this.selfId }); } catch {}
          }
        }
        if (this.localScreenStream) {
          try {
            this.room.addStream(this.localScreenStream, { target: tPeerId, metadata: { kind: 'screen', selfId: this.selfId } });
          } catch (e) {
            try { this.room.addStream(this.localScreenStream, tPeerId, { kind: 'screen', selfId: this.selfId }); } catch {}
          }
        }
      };

      if (typeof this.room.onPeerJoin === 'function') {
        this.room.onPeerJoin(handleJoin);
      } else {
        this.room.onPeerJoin = handleJoin;
      }

      handshake.onMessage = (data, peerInfo) => {
        const tPeerId = typeof peerInfo === 'string' ? peerInfo : peerInfo?.peerId;
        if (data && data.selfId && tPeerId) {
          console.log(`[Trystero] Handshake confirmed: ${tPeerId} <==> ${data.selfId}`);
          this.trysteroToGameId.set(tPeerId, data.selfId);
          // If we already had streams stored under tPeerId, migrate to data.selfId
          let p = this.remotePeers.get(tPeerId);
          if (p && !this.remotePeers.has(data.selfId)) {
            p.peerId = data.selfId;
            p.tPeerId = tPeerId;
            this.remotePeers.set(data.selfId, p);
            this.remotePeers.delete(tPeerId);
          }

          // If we have active voice or screen stream, ensure the peer receives it
          if (this.localVoiceStream) {
            try {
              this.room.addStream(this.localVoiceStream, { target: tPeerId, metadata: { kind: 'voice', selfId: this.selfId } });
            } catch (e) {
              try { this.room.addStream(this.localVoiceStream, tPeerId, { kind: 'voice', selfId: this.selfId }); } catch {}
            }
          }
          if (this.localScreenStream) {
            try {
              this.room.addStream(this.localScreenStream, { target: tPeerId, metadata: { kind: 'screen', selfId: this.selfId } });
            } catch (e) {
              try { this.room.addStream(this.localScreenStream, tPeerId, { kind: 'screen', selfId: this.selfId }); } catch {}
            }
          }
        }
      };

      const handleLeave = tPeerId => {
        console.log(`[Trystero] Peer left room: ${tPeerId}`);
        const gameId = this.trysteroToGameId.get(tPeerId) || tPeerId;
        this.removePeer(gameId);
        this.removePeer(tPeerId);
        this.trysteroToGameId.delete(tPeerId);
      };

      if (typeof this.room.onPeerLeave === 'function') {
        this.room.onPeerLeave(handleLeave);
      } else {
        this.room.onPeerLeave = handleLeave;
      }

      // Handle incoming streams (Microphone Voice or Screen Share)
      const handleStream = (stream, tPeerId, metadata) => {
        const gameId = metadata?.selfId || this.trysteroToGameId.get(tPeerId) || tPeerId;
        console.log(`[Trystero] Incoming stream from ${gameId} (${tPeerId}):`, metadata, stream.getTracks().map(t => `${t.kind}:${t.id}`));

        const hasVideo = stream.getVideoTracks().length > 0;
        const isScreen = metadata?.kind === 'screen' || hasVideo;

        if (isScreen) {
          // Screen Share Video Track
          let p = this.remotePeers.get(gameId);
          if (!p) {
            p = { peerId: gameId, tPeerId, audioEl: null, gainNode: null, source: null, screenStream: null };
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
          this.attachRemoteAudio(gameId, tPeerId, stream);
        }
      };

      if (typeof this.room.onPeerStream === 'function') {
        this.room.onPeerStream(handleStream);
      } else {
        this.room.onPeerStream = handleStream;
      }
    } catch (err) {
      console.error('[Trystero] Initialization error:', err);
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

      // Broadcast voice stream to all peers in the room via Trystero
      if (this.room) {
        try {
          this.room.addStream(stream, null, { kind: 'voice', selfId: this.selfId });
        } catch (e) {
          console.warn('[Trystero] Error broadcasting voice stream:', e);
        }
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
      if (this.room) {
        try {
          this.room.removeStream(this.localVoiceStream);
        } catch {}
      }
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

      // Broadcast screen share stream to all peers via Trystero
      if (this.room) {
        try {
          this.room.addStream(stream, null, { kind: 'screen', selfId: this.selfId });
        } catch (e) {
          console.warn('[Trystero] Error broadcasting screen stream:', e);
        }
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
      p = { peerId, tPeerId, audioEl: null, gainNode: null, source: null, screenStream: null };
      this.remotePeers.set(peerId, p);
    }
    p.tPeerId = tPeerId;

    // 1. Direct Web Audio API Speaker Routing
    if (this.audioCtx) {
      try {
        if (!p.gainNode) {
          p.gainNode = this.audioCtx.createGain();
          p.gainNode.gain.value = this.masterVoiceVolume;
          p.gainNode.connect(this.audioCtx.destination);
        }
        if (p.source) {
          try { p.source.disconnect(); } catch {}
        }
        p.source = this.audioCtx.createMediaStreamSource(stream);
        p.source.connect(p.gainNode);
        console.log(`[Trystero] Direct Web Audio speakers connected for ${peerId}`);
      } catch (e) {
        console.warn('[Trystero] Web Audio routing notice:', e);
      }
    }

    // 2. HTMLAudioElement on DOM (dual fallback & Chromium WebRTC active sink)
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
      document.body.appendChild(audio);
      p.audioEl = audio;
    }

    if (audio.srcObject !== stream) {
      audio.srcObject = stream;
    }
    audio.muted = false;
    audio.volume = this.masterVoiceVolume;

    audio.play().catch(err => {
      console.warn(`[Trystero] Audio element play waiting for click gesture:`, err);
    });
  }

  updatePeerDistances(myPos, peerPositionsMap) {
    if (!this.remotePeers.size) return;

    for (const [peerId, peer] of this.remotePeers.entries()) {
      let volume = this.masterVoiceVolume;

      if (this.proximityEnabled && myPos && peerPositionsMap?.has(peerId)) {
        const pPos = peerPositionsMap.get(peerId);
        const px = pPos.x ?? pPos.tx ?? myPos.x;
        const py = pPos.y ?? pPos.ty ?? myPos.y;
        const dist = Math.hypot(px - myPos.x, py - myPos.y);

        if (dist <= this.minAudibleDistance) {
          volume = this.masterVoiceVolume;
        } else if (dist >= this.maxAudibleDistance) {
          volume = this.masterVoiceVolume * 0.40;
        } else {
          const t =
            (dist - this.minAudibleDistance) / (this.maxAudibleDistance - this.minAudibleDistance);
          volume = this.masterVoiceVolume * (0.45 + 0.55 * Math.pow(1 - t, 1.2));
        }
      }

      const clampedVol = Math.max(0.35, Math.min(1, volume));
      try {
        if (peer.gainNode) {
          peer.gainNode.gain.value = clampedVol;
        }
        if (peer.audioEl && Math.abs(peer.audioEl.volume - clampedVol) > 0.02) {
          peer.audioEl.volume = clampedVol;
        }
      } catch {}
    }
  }

  unlockAudioPlayback() {
    if (this.audioCtx && this.audioCtx.state !== 'running') {
      this.audioCtx.resume().catch(() => {});
    }
    for (const peer of this.remotePeers.values()) {
      if (peer.audioEl && peer.audioEl.srcObject) {
        peer.audioEl.muted = false;
        if (peer.audioEl.paused) {
          peer.audioEl.play().catch(() => {});
        }
      }
    }
  }

  setProximityEnabled(enabled) {
    this.proximityEnabled = !!enabled;
    if (!this.proximityEnabled) {
      for (const peer of this.remotePeers.values()) {
        try {
          if (peer.gainNode) peer.gainNode.gain.value = this.masterVoiceVolume;
          if (peer.audioEl) peer.audioEl.volume = this.masterVoiceVolume;
        } catch {}
      }
    }
  }

  setMasterVoiceVolume(val) {
    this.masterVoiceVolume = Math.max(0, Math.min(1, val));
    for (const peer of this.remotePeers.values()) {
      try {
        if (peer.gainNode) peer.gainNode.gain.value = this.masterVoiceVolume;
        if (peer.audioEl) peer.audioEl.volume = this.masterVoiceVolume;
      } catch {}
    }
  }

  getRemoteScreenStream(peerId) {
    return this.remotePeers.get(peerId)?.screenStream || null;
  }

  getOrCreatePeer(peerId) {
    // Trystero automatically handles peer connections.
    // Ensure handshake is sent to announce our selfId to the peer:
    if (this.handshake) {
      try {
        this.handshake.send({ selfId: this.selfId });
      } catch {}
    }
    return null;
  }

  handleSignal(fromPeerId, signal) {
    // Trystero manages all WebRTC signaling automatically.
  }

  removePeer(peerId) {
    const peer = this.remotePeers.get(peerId);
    if (!peer) return;

    if (peer.source) {
      try { peer.source.disconnect(); } catch {}
    }
    if (peer.gainNode) {
      try { peer.gainNode.disconnect(); } catch {}
    }
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
      try {
        this.audioCtx.close();
      } catch {}
      this.audioCtx = null;
    }
  }
}
