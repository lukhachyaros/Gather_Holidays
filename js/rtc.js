// LiveKit Voice Chat with Trystero-powered Screen Sharing
// Features:
// 1. LiveKit SFU voice rooms with automatic track subscription
// 2. High-Fidelity Voice Chat with Opus codec, Echo Cancellation, Noise Suppression & AGC
// 3. Direct remote audio playback through one HTMLAudioElement per peer
// 4. 3D Spatial Proximity Audio: Dynamic distance attenuation (sounds louder up close, comfortable floor everywhere)
// 5. LiveKit active-speaker events for real-time speaking indicators
// 6. Full HD Screen Sharing (Entire Screen, App Window, Browser Tab with Audio) onto the Giant 3D Cinema TV

import { joinRoom } from 'https://cdn.jsdelivr.net/npm/trystero/+esm';

const LIVEKIT_URL = 'wss://gather-holidays-72e5l6gu.livekit.cloud';
const LIVEKIT_TOKEN_SERVER_ID = 'gatherholidays-gpzvfy';
const LIVEKIT_SDK_URL = 'https://cdn.jsdelivr.net/npm/livekit-client@2.23.0/+esm';

export class RtcManager {
  constructor({
    selfId,
    roomId,
    participantName,
    onRemoteScreenTrack,
    onPeerSpeakingChange,
    onLocalSpeakingChange,
    onMicStateChange,
    onScreenShareChange,
    toast = () => {},
  }) {
    this.selfId = selfId;
    this.roomId = roomId || this.parseRoomId();
    this.participantName = participantName || selfId;
    this.onRemoteScreenTrack = onRemoteScreenTrack;
    this.onPeerSpeakingChange = onPeerSpeakingChange;
    this.onLocalSpeakingChange = onLocalSpeakingChange;
    this.onMicStateChange = onMicStateChange;
    this.onScreenShareChange = onScreenShareChange;
    this.toast = toast;

    // Streams & State
    this.localScreenStream = null;
    this.isMicMuted = true;
    this.isMicRequested = false;
    this.isSharingScreen = false;

    this.isLocalSpeaking = false;
    this.audioUnlockHandler = null;

    // Settings
    this.proximityEnabled = true;
    this.masterVoiceVolume = 1.0;
    this.maxAudibleDistance = 55.0;
    this.minAudibleDistance = 4.0;

    // Peers map: gameId -> { peerId, audioEl, audioTrack, screenStream }
    this.remotePeers = new Map();
    this.trysteroToGameId = new Map();
    this.remoteSpeakingState = new Map();
    this.voiceRoom = null;
    this.destroyed = false;

    // Trystero Room instance & actions
    this.room = null;

    this.initTrystero();
    this.initAudioUnlock();
    this.liveKitReady = this.initLiveKit();
  }

  parseRoomId() {
    if (typeof window !== 'undefined' && window.location?.hash) {
      const match = window.location.hash.match(/room=([^&]+)/);
      if (match) return decodeURIComponent(match[1]);
    }
    return 'quang-truong-noel';
  }

  async initLiveKit() {
    try {
      const { Room, RoomEvent, Track, TokenSource } = await import(LIVEKIT_SDK_URL);
      const roomName = `gh_${encodeURIComponent(this.roomId)}`;
      const tokenSource = TokenSource.developmentTokenServer(LIVEKIT_TOKEN_SERVER_ID);
      const { serverUrl, participantToken } = await tokenSource.fetch({
        roomName,
        participantIdentity: String(this.selfId),
        participantName: String(this.participantName),
      });
      if (this.destroyed) return false;

      const room = new Room({ adaptiveStream: false, dynacast: false });
      this.voiceRoom = room;
      room.on(RoomEvent.ParticipantConnected, participant => {
        console.log(`[RTC] LiveKit participant joined: ${participant.identity}`);
        this.getOrCreatePeer(participant.identity);
      });
      room.on(RoomEvent.ParticipantDisconnected, participant => {
        console.log(`[RTC] LiveKit participant left: ${participant.identity}`);
        this.onPeerSpeakingChange?.(participant.identity, false);
        this.remoteSpeakingState.delete(participant.identity);
        this.removePeer(participant.identity);
      });
      room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        console.log(`[RTC] LiveKit track subscribed: ${track.kind} from ${participant.identity}.`);
        if (track.kind === Track.Kind.Audio) this.attachLiveKitAudio(track, participant);
      });
      room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
        if (track.kind === Track.Kind.Audio) this.detachLiveKitAudio(track, participant);
      });
      room.on(RoomEvent.ActiveSpeakersChanged, speakers => {
        const speakingIds = new Set(speakers.map(participant => participant.identity));
        const localSpeaking = speakingIds.has(room.localParticipant.identity);
        if (localSpeaking !== this.isLocalSpeaking) {
          this.isLocalSpeaking = localSpeaking;
          this.onLocalSpeakingChange?.(localSpeaking);
        }
        for (const identity of room.remoteParticipants.keys()) {
          const speaking = speakingIds.has(identity);
          if (this.remoteSpeakingState.get(identity) !== speaking) {
            this.remoteSpeakingState.set(identity, speaking);
            this.onPeerSpeakingChange?.(identity, speaking);
          }
        }
      });
      room.on(RoomEvent.AudioPlaybackStatusChanged, canPlayback => {
        if (!canPlayback) console.warn('[RTC] LiveKit audio playback is blocked until a user gesture.');
      });
      room.on(RoomEvent.LocalTrackPublished, publication => {
        console.log(`[RTC] LiveKit published local ${publication.kind} track.`);
      });
      room.on(RoomEvent.TrackSubscriptionFailed, (trackSid, participant) => {
        console.error(`[RTC] LiveKit could not subscribe to track ${trackSid} from ${participant.identity}.`);
      });
      room.on(RoomEvent.Reconnecting, () => console.warn('[RTC] LiveKit is reconnecting.'));
      room.on(RoomEvent.Reconnected, () => console.log('[RTC] LiveKit reconnected.'));
      room.on(RoomEvent.Disconnected, reason => {
        console.warn('[RTC] LiveKit voice room disconnected:', reason || 'no reason provided');
      });

      await room.connect(serverUrl || LIVEKIT_URL, participantToken);
      if (this.destroyed) {
        await room.disconnect();
        return false;
      }
      console.log(`[RTC] Connected to LiveKit voice room: ${roomName}.`);
      return true;
    } catch (error) {
      try { this.voiceRoom?.disconnect(); } catch {}
      this.voiceRoom = null;
      console.error('[RTC] Could not connect to LiveKit:', error);
      return false;
    }
  }

  initAudioUnlock() {
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
          const p = this.getOrCreatePeer(gameId);
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

  async publishStream(stream, target, kind) {
    if (!this.room) {
      console.warn(`[Trystero] Cannot publish ${kind} stream before joining the room.`);
      this.toast('⚠️ Screen share room chưa kết nối.');
      return false;
    }
    if (typeof this.room.addStream !== 'function') {
      console.error(`[Trystero] The room does not support publishing ${kind} streams.`);
      this.toast('⚠️ Phiên bản hiện tại không hỗ trợ chia sẻ màn hình.');
      return false;
    }

    const options = { metadata: { kind, selfId: this.selfId } };
    if (target) options.target = target;
    try {
      await this.room.addStream(stream, options);
      return true;
    } catch (error) {
      console.warn(`[Trystero] Could not publish ${kind} stream:`, error);
      this.toast('⚠️ Không thể chia sẻ màn hình tới người chơi.');
      return false;
    }
  }

  // -------------------------------------------------------------
  // MICROPHONE & VOICE CHAT
  // -------------------------------------------------------------
  async toggleMic() {
    this.unlockAudioPlayback();
    if (!this.isMicRequested) return await this.startMicrophone();
    this.isMicMuted = !this.isMicMuted;
    try {
      await this.applyMicMuteState();
    } catch (error) {
      this.isMicMuted = !this.isMicMuted;
      console.error('[RTC] Could not change LiveKit microphone state:', error);
      return !this.isMicMuted;
    }
    this.onMicStateChange?.(!this.isMicMuted);
    return !this.isMicMuted;
  }

  async startMicrophone() {
    try {
      await this.liveKitReady;
      if (!this.voiceRoom) {
        this.toast('⚠️ Không kết nối được LiveKit voice room. Xem Console để biết chi tiết.');
        return false;
      }
      await this.voiceRoom.localParticipant.setMicrophoneEnabled(true, {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      });
      this.isMicRequested = true;
      this.isMicMuted = false;
      this.onMicStateChange?.(true);
      this.toast('🎙️ Đã bật Microphone — Bạn có thể nói chuyện cùng mọi người!');
      return true;
    } catch (err) {
      console.error('[RTC] Could not publish microphone to LiveKit:', err);
      this.toast('⚠️ Không thể bật Micro: Vui lòng cho phép quyền truy cập Micro trên trình duyệt!');
      this.isMicMuted = true;
      this.isMicRequested = false;
      this.onMicStateChange?.(false);
      return false;
    }
  }

  async applyMicMuteState() {
    if (this.voiceRoom?.localParticipant && this.isMicRequested) {
      await this.voiceRoom.localParticipant.setMicrophoneEnabled(!this.isMicMuted);
    }
    if (this.isMicMuted && this.isLocalSpeaking) {
      this.isLocalSpeaking = false;
      this.onLocalSpeakingChange?.(false);
    }
  }

  stopMicrophone() {
    if (this.voiceRoom?.localParticipant && this.isMicRequested) {
      this.voiceRoom.localParticipant.setMicrophoneEnabled(false).catch(error => {
        console.warn('[RTC] Could not stop the LiveKit microphone cleanly:', error);
      });
    }
    this.isMicRequested = false;
    this.isMicMuted = true;
    this.isLocalSpeaking = false;
    this.onLocalSpeakingChange?.(false);
    this.onMicStateChange?.(false);
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

  attachLiveKitAudio(track, participant) {
    const peerId = participant.identity;
    const peer = this.getOrCreatePeer(peerId);
    if (peer.audioEl) this.detachLiveKitAudio(peer.audioTrack, participant);

    const audio = track.attach();
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
    audio.onplaying = () => console.log(`[RTC] LiveKit audio playback started for ${peerId}.`);
    peer.audioEl = audio;
    peer.audioTrack = track;
    document.body.appendChild(audio);
    this.updateRemoteAudioRouting(peer);
  }

  detachLiveKitAudio(track, participant) {
    const peer = this.remotePeers.get(participant.identity);
    if (!peer?.audioEl || (track && peer.audioTrack !== track)) return;
    try {
      peer.audioTrack?.detach(peer.audioEl);
      peer.audioEl.pause();
      peer.audioEl.srcObject = null;
      peer.audioEl.remove();
    } catch {}
    peer.audioEl = null;
    peer.audioTrack = null;
    if (!peer.screenStream) this.remotePeers.delete(participant.identity);
  }

  updateRemoteAudioRouting(peer) {
    if (!peer?.audioEl) return;
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
    if (this.voiceRoom && !this.voiceRoom.canPlaybackAudio) {
      this.voiceRoom.startAudio().catch(error => {
        console.warn('[RTC] LiveKit audio could not be unlocked:', error);
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
    let peer = this.remotePeers.get(peerId);
    if (!peer) {
      peer = { peerId, audioEl: null, audioTrack: null, stream: null, screenStream: null };
      this.remotePeers.set(peerId, peer);
    }
    return peer;
  }

  removePeer(peerId) {
    const peer = this.remotePeers.get(peerId);
    this.remoteSpeakingState.delete(peerId);
    if (!peer) return;

    if (peer.screenStream) this.onRemoteScreenTrack?.(peerId, null);
    if (peer.audioTrack) {
      try { peer.audioTrack.detach(peer.audioEl); } catch {}
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
    this.destroyed = true;
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
    if (this.voiceRoom) {
      try { this.voiceRoom.disconnect(); } catch {}
      this.voiceRoom = null;
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
