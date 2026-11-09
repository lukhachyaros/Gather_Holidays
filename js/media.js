// Shared YouTube player (music / video watch-together). Synced via {vid, playing, t, at}.
let player = null, ready = false, pending = null, current = null;

export function parseYouTube(input) {
  if (!input) return null;
  const s = input.trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  const m = s.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})/);
  return m ? m[1] : null;
}

export function initPlayer(containerId) {
  if (window.YT?.Player) return create(containerId);
  const tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  document.head.appendChild(tag);
  window.onYouTubeIframeAPIReady = () => create(containerId);
}

function create(id) {
  player = new YT.Player(id, {
    width: '100%', height: '100%',
    playerVars: { playsinline: 1, rel: 0, modestbranding: 1 },
    events: { onReady: () => { ready = true; if (pending) { const p = pending; pending = null; apply(p); } } },
  });
}

// Apply shared media state. Time is compensated by elapsed wall time since `at`.
export function apply(media) {
  current = media;
  if (!ready) { pending = media; return; }
  if (!media || !media.vid) { player.stopVideo(); return; }
  const target = media.t + (media.playing ? (Date.now() - media.at) / 1000 : 0);
  const loaded = player.getVideoData?.().video_id;
  if (loaded !== media.vid) {
    media.playing ? player.loadVideoById(media.vid, target) : player.cueVideoById(media.vid, target);
  } else {
    if (Math.abs(player.getCurrentTime() - target) > 2) player.seekTo(target, true);
    media.playing ? player.playVideo() : player.pauseVideo();
  }
}

export function snapshot(playing) {
  if (!ready || !current?.vid) return null;
  return { vid: current.vid, playing, t: player.getCurrentTime(), at: Date.now() };
}
