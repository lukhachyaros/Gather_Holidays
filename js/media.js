// Shared YouTube player with No-Cookie Privacy Mode, Auto Ad-Guard Bypass, Queue auto-advance & anti-stall protection.
let player = null,
  ready = false,
  pending = null,
  current = null,
  loadedKey = '',
  endedCb = null,
  userHidden = false,
  isMuted = false,
  lastAdBypassAt = 0,
  initStarted = false,
  webKey = '';

export function parseYouTube(input) {
  if (!input) return null;
  const s = input.trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  const m = s.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})/);
  return m ? m[1] : null;
}

export function isVideoVisible() {
  return !!(current && (current.vid || current.url) && !userHidden);
}

const ytEl = () => document.getElementById('yt');
const webEl = () => document.getElementById('webTv');

function setSurface(kind) {
  const w = webEl(),
    y = ytEl();
  if (w) w.style.display = kind === 'web' ? 'block' : 'none';
  if (y) y.style.display = kind === 'web' ? 'none' : 'block';
}

// Completely stop & clear the shared TV (used when leaving / closing / being kicked out of a room)
export function stopMedia() {
  current = null;
  pending = null;
  loadedKey = '';
  webKey = '';
  try {
    player?.stopVideo?.();
  } catch {}
  const w = webEl();
  if (w) w.src = 'about:blank';
  setSurface('yt');
}

// ---------- Smart link recognition: YouTube / any website (Android-TV style browser) ----------
export function normalizeWebUrl(input) {
  let s = (input || '').trim();
  if (!s || /\s/.test(s)) return null;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) {
    if (!/^[\w-]+(\.[\w-]+)+(:\d+)?([\/?#].*)?$/i.test(s)) return null;
    s = 'https://' + s;
  }
  let u;
  try {
    u = new URL(s.replace(/^http:\/\//i, 'https://'));
  } catch {
    return null;
  }
  if (u.protocol !== 'https:') return null; // blocks javascript:, data:, file: ...
  const h = u.hostname.replace(/^www\./, '');
  let m;
  if (h === 'vimeo.com' && (m = u.pathname.match(/^\/(\d+)/))) return 'https://player.vimeo.com/video/' + m[1];
  if (h === 'dailymotion.com' && (m = u.pathname.match(/\/video\/(\w+)/))) return 'https://www.dailymotion.com/embed/video/' + m[1];
  if (h === 'twitch.tv' && (m = u.pathname.match(/^\/(\w+)\/?$/))) {
    return 'https://player.twitch.tv/?channel=' + m[1] + '&parent=' + (location.hostname || 'localhost');
  }
  if (h === 'drive.google.com' && (m = u.pathname.match(/\/file\/d\/([\w-]+)/))) return 'https://drive.google.com/file/d/' + m[1] + '/preview';
  if (h === 'open.spotify.com' && (m = u.pathname.match(/^\/(track|album|playlist|episode|show|artist)\/(\w+)/))) {
    return 'https://open.spotify.com/embed/' + m[1] + '/' + m[2];
  }
  return u.href;
}

// Returns { kind:'yt', vid } | { kind:'web', url, title } | null
export function classifyMediaInput(input) {
  const raw = (input || '').trim();
  const vid = parseYouTube(raw);
  if (vid && (/youtu/i.test(raw) || /^[\w-]{11}$/.test(raw))) return { kind: 'yt', vid };
  const url = normalizeWebUrl(raw);
  if (!url) return null;
  return { kind: 'web', url, title: new URL(url).hostname.replace(/^www\./, '') };
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
  if (!current || (!current.vid && !current.url)) return;
  loadedKey = '';
  apply(current, true);
}

// Instantly skip any active YouTube pre-roll or mid-roll ad by reloading at the synced room timestamp (>= 1s)
export function bypassAdNow() {
  if (!ready || !player || !current?.vid || current.kind === 'web') return false;
  const elapsed = current.playing && current.at ? Math.max(1, (Date.now() - current.at) / 1000) : 1;
  const targetSec = Math.max(1, Math.floor((current.t || 0) + elapsed));
  try {
    player.loadVideoById({
      videoId: current.vid,
      startSeconds: targetSec,
    });
    if (!isMuted) {
      player.unMute?.();
      player.setVolume?.(90);
    }
    return true;
  } catch {
    return false;
  }
}

export function initPlayer(containerId, onTrackEnded) {
  endedCb = onTrackEnded;
  // Create the YouTube iframe only once (re-creating it on every room join left a zombie player playing audio)
  if (initStarted) return;
  initStarted = true;
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
    host: 'https://www.youtube-nocookie.com',
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
        // Check if YouTube injected an ad video instead of the requested videoId
        checkAndBypassInjectedAd();
        if (e.data === S.ENDED) {
          endedCb?.(current);
        } else if (e.data === S.CUED && current?.playing && current.kind !== 'web') {
          player.playVideo?.();
        }
      },
      onError: () => {
        // If a video is restricted or fails to load, advance to next in queue after 1.5s
        setTimeout(() => {
          if (current?.vid && current.kind !== 'web') endedCb?.(current);
        }, 1500);
      },
    },
  });
}

// Automatic Ad-Guard Watchdog: detects when YT IFrame swaps in an ad video_id and skips it automatically
function checkAndBypassInjectedAd() {
  if (!ready || !player || !current?.vid || current.kind === 'web') return;
  const now = Date.now();
  if (now - lastAdBypassAt < 1800) return;
  try {
    const data = player.getVideoData?.();
    if (data && data.video_id && data.video_id !== current.vid) {
      lastAdBypassAt = now;
      bypassAdNow();
    }
  } catch {}
}

setInterval(checkAndBypassInjectedAd, 700);

// Apply shared media state without interrupting active buffering/playback of the same track.
export function apply(media, force = false) {
  current = media;

  // ---- Web / Browser mode (Android-TV style): show any embeddable website on the big screen ----
  if (media && media.kind === 'web' && media.url) {
    pending = null;
    loadedKey = '';
    try {
      player?.stopVideo?.();
    } catch {}
    setSurface('web');
    const key = (media.id || '') + ':' + media.url;
    const w = webEl();
    if (w && (force || key !== webKey)) {
      webKey = key;
      w.src = media.url;
    }
    return;
  }
  if (webKey) {
    webKey = '';
    const w = webEl();
    if (w) w.src = 'about:blank';
  }
  setSurface('yt');

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
  // Start at >= 1s instead of 0s to bypass YouTube's 0:00 pre-roll ad trigger!
  const rawStart = elapsed < 4 ? (media.t || 1) : (media.t || 0) + elapsed;
  const startSeconds = Math.max(1, Math.floor(rawStart));

  try {
    player.loadVideoById({
      videoId: media.vid,
      startSeconds,
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
