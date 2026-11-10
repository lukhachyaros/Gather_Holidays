// WebRTC P2P Voice Chat & Real-Time Screen Sharing Engine
// Features:
// 1. Full-Mesh WebRTC RTCPeerConnection with W3C Perfect Negotiation & STUN servers
// 2. High-Fidelity Voice Chat with Opus codec, Echo Cancellation, Noise Suppression & AGC
// 3. 3D Spatial Proximity Audio: Dynamic distance attenuation (sounds louder up close, fades naturally with distance)
// 4. Voice Activity Detection (VAD) via Web Audio API Analyser for real-time speaking indicators
// 5. Full HD Screen Sharing (Entire Screen, App Window, Browser Tab with System/Tab Audio) onto the Giant 3D Cinema TV

const RTC_CONFIG = {
  iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
    { urls: ['stun:stun2.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] },
  ],
  iceCandidatePoolSize: 2,
};

export class RtcManager {
  constructor({
    selfId,
    sendSignal,
    onRemoteScreenTrack,
    onPeerSpeakingChange,
    onLocalSpeakingChange,
    onMicStateChange,
    onScreenShareChange,
    toast = () => {},
  }) {
    this.selfId = selfId;
    this.sendSignal = sendSignal;
    this.onRemoteScreenTrack = onRemoteScreenTrack;
    this.onPeerSpeakingChange = onPeerSpeakingChange;
    this.onLocalSpeakingChange = onLocalSpeakingChange;
    this.onMicStateChange = onMicStateChange;
    this.onScreenShareChange = onScreenShareChange;
    this.toast = toast;

    // Local Media Streams
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
    this.proximityEnabled = true; // 3D distance attenuation
    this.masterVoiceVolume = 1.0; // 0.0 - 1.0
    this.maxAudibleDistance = 18; // In map tiles (distance > 18 = volume 0)
    this.minAudibleDistance = 2.5; // Full volume within 2.5 tiles

    // Peer connections Map: peerId -> { pc, isPolite, makingOffer, ignoreOffer, audioGain, audioEl, analyser, remoteScreenStream, isSpeaking }
    this.peers = new Map();

    this.initAudioContext();
  }

  initAudioContext() {
    if (!this.audioCtx && typeof window !== 'undefined') {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    // Resume audio context on any user interaction if suspended
    const resumeAudio = () => {
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }
    };
    window.addEventListener('pointerdown', resumeAudio, { passive: true, once: false });
    window.addEventListener('keydown', resumeAudio, { passive: true, once: false });
  }

  // -------------------------------------------------------------
  // MICROPHONE & VOICE CHAT
  // -------------------------------------------------------------
  async toggleMic() {
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
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
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

      // Set up Web Audio Analyser for local Voice Activity Detection (VAD)
      if (this.audioCtx) {
        this.localVoiceSource = this.audioCtx.createMediaStreamSource(stream);
        this.localAnalyser = this.audioCtx.createAnalyser();
        this.localAnalyser.fftSize = 256;
        this.localAnalyser.smoothingTimeConstant = 0.4;
        this.localVoiceSource.connect(this.localAnalyser);
      }

      // Add local audio tracks to all existing peer connections
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = true;
        for (const [peerId, peer] of this.peers.entries()) {
          try {
            const senders = peer.pc.getSenders();
            const existing = senders.find(s => s.track && s.track.kind === 'audio');
            if (existing) {
              existing.replaceTrack(audioTrack);
            } else {
              peer.pc.addTrack(audioTrack, stream);
            }
          } catch (e) {
            console.warn(`[RTC] Failed to add audio track to peer ${peerId}:`, e);
          }
        }
      }

      this.startVadLoop();
      this.onMicStateChange?.(true);
      this.toast('🎙️ Đã bật Microphone — Bạn có thể nói chuyện cùng mọi người!');
      return true;
    } catch (err) {
      console.error('[RTC] Microphone access denied or error:', err);
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
      // 1. Local voice check
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

      // 2. Remote peers voice check
      for (const [peerId, peer] of this.peers.entries()) {
        if (peer.analyser) {
          peer.analyser.getByteFrequencyData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) sum += buf[i];
          const avg = sum / buf.length;
          const speaking = avg > 12;
          if (speaking !== peer.isSpeaking) {
            peer.isSpeaking = speaking;
            this.onPeerSpeakingChange?.(peerId, speaking);
          }
        }
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
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }

      // Capture screen with audio (tab/system audio if user enables it)
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
          frameRate: { max: 30 },
        },
        audio: true,
      });

      this.localScreenStream = stream;
      this.isSharingScreen = true;

      // Handle user clicking the native browser "Stop sharing" floating bar
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          this.stopScreenShare();
        };
      }

      // Add screen tracks to all peer connections
      stream.getTracks().forEach(track => {
        for (const [peerId, peer] of this.peers.entries()) {
          try {
            peer.pc.addTrack(track, stream);
          } catch (e) {
            console.warn(`[RTC] Failed to add screen track to peer ${peerId}:`, e);
          }
        }
      });

      this.onScreenShareChange?.(true, stream);
      this.toast('🖥️ Đang chiếu Màn hình của bạn lên TV lớn!');
      return stream;
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        // User cancelled picker, do not toast an error
        return null;
      }
      console.error('[RTC] Screen share failed:', err);
      this.toast('⚠️ Không thể chia sẻ màn hình: ' + (err.message || 'Lỗi không xác định'));
      return null;
    }
  }

  stopScreenShare() {
    if (!this.isSharingScreen && !this.localScreenStream) return;

    if (this.localScreenStream) {
      this.localScreenStream.getTracks().forEach(track => {
        track.stop();
        // Remove track sender from all peer connections
        for (const peer of this.peers.values()) {
          try {
            const senders = peer.pc.getSenders();
            const sender = senders.find(s => s.track === track);
            if (sender) peer.pc.removeTrack(sender);
          } catch {}
        }
      });
      this.localScreenStream = null;
    }

    this.isSharingScreen = false;
    this.onScreenShareChange?.(false, null);
    this.toast('⏹ Đã dừng chia sẻ màn hình lên TV.');
  }

  // -------------------------------------------------------------
  // PEER CONNECTION MANAGEMENT (W3C Perfect Negotiation)
  // -------------------------------------------------------------
  getOrCreatePeer(peerId) {
    if (this.peers.has(peerId)) {
      return this.peers.get(peerId);
    }

    // Deterministic polite assignment: smaller ID is polite
    const isPolite = this.selfId > peerId;

    const pc = new RTCPeerConnection(RTC_CONFIG);
    const peerData = {
      peerId,
      pc,
      isPolite,
      makingOffer: false,
      ignoreOffer: false,
      audioGain: null,
      audioEl: null,
      analyser: null,
      remoteScreenStream: null,
      isSpeaking: false,
    };

    this.peers.set(peerId, peerData);

    // Setup Web Audio nodes for remote peer's incoming audio
    this.setupRemoteAudioGraph(peerData);

    // Add existing local tracks to new peer
    if (this.localVoiceStream) {
      const audioTrack = this.localVoiceStream.getAudioTracks()[0];
      if (audioTrack) {
        try {
          pc.addTrack(audioTrack, this.localVoiceStream);
        } catch {}
      }
    }

    if (this.localScreenStream) {
      this.localScreenStream.getTracks().forEach(track => {
        try {
          pc.addTrack(track, this.localScreenStream);
        } catch {}
      });
    }

    // ICE Candidates
    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        this.sendSignal(peerId, { candidate });
      }
    };

    // Perfect Negotiation Offer creation
    pc.onnegotiationneeded = async () => {
      try {
        peerData.makingOffer = true;
        await pc.setLocalDescription();
        this.sendSignal(peerId, { description: pc.localDescription });
      } catch (err) {
        console.warn(`[RTC] Error during negotiation with ${peerId}:`, err);
      } finally {
        peerData.makingOffer = false;
      }
    };

    // Incoming Remote Tracks (Voice audio & Screen share video/audio)
    pc.ontrack = event => {
      const track = event.track;
      const stream = event.streams[0] || new MediaStream([track]);

      if (track.kind === 'video') {
        // Screen share video stream from remote peer!
        peerData.remoteScreenStream = stream;
        this.onRemoteScreenTrack?.(peerId, stream);

        track.onended = () => {
          if (peerData.remoteScreenStream === stream) {
            peerData.remoteScreenStream = null;
            this.onRemoteScreenTrack?.(peerId, null);
          }
        };
      } else if (track.kind === 'audio') {
        // Audio track: voice chat or screen audio
        this.attachRemoteAudioTrack(peerData, stream, track);
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed') {
        try {
          pc.restartIce();
        } catch {}
      }
    };

    return peerData;
  }

  setupRemoteAudioGraph(peerData) {
    if (!this.audioCtx) return;
    try {
      const analyser = this.audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.4;
      peerData.analyser = analyser;
    } catch (e) {
      console.warn('[RTC] Audio analyser setup error:', e);
    }
  }

  attachRemoteAudioTrack(peerData, stream, track) {
    // 1. Resume AudioContext if suspended
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }

    // 2. Connect to Web Audio Analyser for VAD (Voice Activity Detection)
    if (this.audioCtx && peerData.analyser) {
      try {
        const source = this.audioCtx.createMediaStreamSource(stream);
        source.connect(peerData.analyser);
      } catch (e) {
        console.warn('[RTC] MediaStreamSource connection warning:', e);
      }
    }

    // 3. Native HTMLAudioElement attached to DOM as Primary, 100% Reliable Audio Output
    let audio = peerData.audioEl;
    if (!audio) {
      audio = document.createElement('audio');
      audio.id = `gh-voice-${peerData.peerId}`;
      audio.autoplay = true;
      audio.playsInline = true;
      audio.style.display = 'none';
      document.body.appendChild(audio);
      peerData.audioEl = audio;
    }

    audio.srcObject = stream;
    audio.volume = this.masterVoiceVolume;
    audio.play().catch(err => {
      console.warn('[RTC] Audio autoplay waiting for user interaction:', err);
    });

    this.startVadLoop();
  }

  async handleSignal(fromPeerId, signal) {
    if (!signal) return;
    const peer = this.getOrCreatePeer(fromPeerId);
    const { pc, isPolite } = peer;

    try {
      if (signal.description) {
        const desc = signal.description;
        const offerCollision = desc.type === 'offer' && (peer.makingOffer || pc.signalingState !== 'stable');
        peer.ignoreOffer = !isPolite && offerCollision;

        if (peer.ignoreOffer) {
          return;
        }

        await pc.setRemoteDescription(desc);
        if (desc.type === 'offer') {
          await pc.setLocalDescription();
          this.sendSignal(fromPeerId, { description: pc.localDescription });
        }
      } else if (signal.candidate) {
        try {
          await pc.addIceCandidate(signal.candidate);
        } catch (err) {
          if (!peer.ignoreOffer) {
            console.warn('[RTC] ICE candidate error:', err);
          }
        }
      }
    } catch (err) {
      console.warn(`[RTC] Signal processing error from ${fromPeerId}:`, err);
    }
  }

  removePeer(peerId) {
    const peer = this.peers.get(peerId);
    if (!peer) return;

    if (peer.analyser) {
      try {
        peer.analyser.disconnect();
      } catch {}
    }
    if (peer.audioEl) {
      try {
        peer.audioEl.pause();
        peer.audioEl.srcObject = null;
        peer.audioEl.remove();
      } catch {}
    }
    try {
      peer.pc.close();
    } catch {}

    this.peers.delete(peerId);
  }

  // -------------------------------------------------------------
  // 3D SPATIAL PROXIMITY AUDIO
  // -------------------------------------------------------------
  // Called every animation frame with player's 3D coordinates
  updatePeerDistances(myPos, peerPositionsMap) {
    if (!this.peers.size) return;

    for (const [peerId, peer] of this.peers.entries()) {
      if (!peer.audioEl) continue;

      let volume = this.masterVoiceVolume;

      if (this.proximityEnabled && myPos && peerPositionsMap?.has(peerId)) {
        const pPos = peerPositionsMap.get(peerId);
        const dist = Math.hypot(pPos.x - myPos.x, pPos.y - myPos.y);

        if (dist <= this.minAudibleDistance) {
          volume = this.masterVoiceVolume;
        } else if (dist >= this.maxAudibleDistance) {
          volume = 0;
        } else {
          // Smooth non-linear inverse falloff
          const t = (dist - this.minAudibleDistance) / (this.maxAudibleDistance - this.minAudibleDistance);
          volume = this.masterVoiceVolume * Math.pow(1 - t, 1.8);
        }
      }

      const clampedVol = Math.max(0, Math.min(1, volume));
      try {
        if (Math.abs(peer.audioEl.volume - clampedVol) > 0.02) {
          peer.audioEl.volume = clampedVol;
        }
      } catch {}
    }
  }

  unlockAudioPlayback() {
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    for (const peer of this.peers.values()) {
      if (peer.audioEl && peer.audioEl.paused && peer.audioEl.srcObject) {
        peer.audioEl.play().catch(() => {});
      }
    }
  }

  setProximityEnabled(enabled) {
    this.proximityEnabled = !!enabled;
    if (!this.proximityEnabled) {
      for (const peer of this.peers.values()) {
        if (peer.audioEl) {
          try {
            peer.audioEl.volume = this.masterVoiceVolume;
          } catch {}
        }
      }
    }
  }

  setMasterVoiceVolume(val) {
    this.masterVoiceVolume = Math.max(0, Math.min(1, val));
    for (const peer of this.peers.values()) {
      if (peer.audioEl && !this.proximityEnabled) {
        try {
          peer.audioEl.volume = this.masterVoiceVolume;
        } catch {}
      }
    }
  }

  getRemoteScreenStream(peerId) {
    return this.peers.get(peerId)?.remoteScreenStream || null;
  }

  destroy() {
    if (this.vadInterval) {
      clearInterval(this.vadInterval);
      this.vadInterval = null;
    }
    this.stopMicrophone();
    this.stopScreenShare();
    for (const peerId of this.peers.keys()) {
      this.removePeer(peerId);
    }
    if (this.audioCtx) {
      try {
        this.audioCtx.close();
      } catch {}
      this.audioCtx = null;
    }
  }
}
