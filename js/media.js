// Shared YouTube player with Queue auto-advance, anti-stall buffering protection & autoplay fallback.
let player = null,
  ready = false,
  pending = null,
  current = null,
  loadedKey = '',
  endedCb = null,
  userHidden = false,
  isMuted = false;

export function parseYouTube(input) {
  if (!input) return null;
  const s = input.trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  const m = s.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})/);
  return m ? m[1] : null;
}

export function isVideoVisible() {
  return !!(current && current.vid && !userHidden);
}

export function toggleVideoHidden() {
  userHidden = !userHidden;
  return userHidden;
}

export function toggleMute() {
  if (!ready || !player) return false;
  if (player.isMuted?.()) {
    player.unMute?.();
    player.setVolume?.(100);
    isMuted = false;
  } else {
    player.mute?.();
    isMuted = true;
  }
  return isMuted;
}

export function forceReloadVideo() {
  if (!current?.vid) return;
  loadedKey = '';
  apply(current, true);
}

export function initPlayer(containerId, onTrackEnded) {
  endedCb = onTrackEnded;
  if (window.YT?.Player) return create(containerId);
  const tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  document.head.appendChild(tag);
  window.onYouTubeIframeAPIReady = () => create(containerId);
}

function create(id) {
  const vars = {
    playsinline: 1,
     autoplay: 1,
    controls: 0,
    rel: 0,
    modestbranding: 1,
    disablekb: 1,
    iv_load_policy: 3,
  };
  if (location.protocol.startsWith('http')) {
    vars.origin = location.origin;
  }
  player = new YT.Player(id, {
    width: '100%',
    height: '100%',
    playerVars: vars,
    events: {
      onReady: () => {
        ready = true;
        player.setVolume?.(90);
        if (pending !== null) {
          const p = pending;
          pending = null;
          apply(p, true);
        }
      },
      onStateChange: e => {
        const S = window.YT?.PlayerState;
        if (!S) return;
        if (e.data === S.ENDED) {
          endedCb?.(current);
        } else if (e.data === S.CUED && current?.playing) {
          player.playVideo?.();
        }
      },
      onError: () => {
        // If a video is restricted or fails to load, advance to next in queue after 1.5s
        setTimeout(() => {
          if (current?.vid) endedCb?.(current);
        }, 1500);
      },
    },
  });
}

// Apply shared media state without interrupting active buffering/playback of the same track.
export function apply(media, force = false) {
  current = media;
  if (!ready || !player) {
    pending = media;
    return;
  }
  if (!media || !media.vid) {
    loadedKey = '';
    try {
      player.stopVideo?.();
    } catch {}
    return;
  }

  const key = `${media.id || ''}:${media.vid}`;
  // Prevent duplicate loadVideoById / seekTo calls that stall YouTube buffering!
  if (!force && key === loadedKey) {
    const st = player.getPlayerState?.();
    const S = window.YT?.PlayerState;
    if (media.playing && st === S?.PAUSED) {
      player.playVideo?.();
    } else if (!media.playing && st === S?.PLAYING) {
      player.pauseVideo?.();
    }
    return;
  }

  loadedKey = key;
  const elapsed = media.playing && media.at ? Math.max(0, (Date.now() - media.at) / 1000) : 0;
  // If track was just added (< 4s ago), start cleanly from 0 so YouTube doesn't mid-stream seek on load
  const startSeconds = elapsed < 4 ? (media.t || 0) : (media.t || 0) + elapsed;

  try {
    player.loadVideoById({
      videoId: media.vid,
      startSeconds: Math.floor(startSeconds),
    });
    player.unMute?.();
    player.setVolume?.(90);
    // Autoplay fallback: if browser blocks unmuted autoplay after 1.2s, play muted first then unmute on click
    setTimeout(() => {
      if (!current?.vid || !player?.getPlayerState) return;
      const st = player.getPlayerState();
      if (st === -1 || st === 5) {
        player.mute?.();
        isMuted = true;
        player.playVideo?.();
      }
    }, 1200);
  } catch (e) {
    console.warn('YouTube load error:', e);
  }
}

// Unlock audio on any user click if browser forced muted autoplay
addEventListener(
  'pointerdown',
  () => {
    if (ready && player && isMuted && current?.vid) {
      try {
        player.unMute?.();
        player.setVolume?.(90);
        isMuted = false;
      } catch {}
    }
  },
  { passive: true }
);
