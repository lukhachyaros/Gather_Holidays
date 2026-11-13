// ============================================================================
// AUDIO SYSTEM FOR GATHER_HOLIDAYS
// - Background Music (BGM) with Catbox MP3 tracks for each holiday theme
// - Web Audio API Procedural Sound Effects (SFX) per Theme (Christmas, Halloween, Tet, Valentine)
// ============================================================================

export const BGM_TRACKS = {
  valentine: 'https://files.catbox.moe/3m8tkc.mp3',
  tet: 'https://files.catbox.moe/87vqx2.mp3',
  halloween: 'https://files.catbox.moe/5b1qly.mp3',
  christmas: 'https://files.catbox.moe/n4lzai.mp3',
  casino: 'assets/bgm_casino.mp3',
};

let audioCtx = null;
let currentTheme = null;
let bgmAudio = null;
let jackpotAudio = null;
let truongGiangCatchAudio = null;
let bgmMuted = localStorage.getItem('gh_bgm_muted') === '1';
let bgmVolume = parseFloat(localStorage.getItem('gh_bgm_vol') || '0.35');
let audioUnlocked = false;
let bgmGain = null;
let bgmFallbackTimer = null;
let bgmFallbackTheme = null;
let bgmFallbackNodes = [];

// Initialize Web Audio Context on user gesture
export function getAudioContext() {
  if (!audioCtx && typeof window !== 'undefined') {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

// ----------------------------------------------------------------------------
// BGM PLAYBACK MANAGER
// ----------------------------------------------------------------------------
function stopFallbackMusic() {
  if (bgmFallbackTimer) clearInterval(bgmFallbackTimer);
  bgmFallbackTimer = null;
  bgmFallbackTheme = null;
  bgmFallbackNodes.forEach(node => { try { node.stop(); } catch {} });
  bgmFallbackNodes = [];
}
function ensureFallbackGain() {
  const ctx = getAudioContext();
  if (!ctx) return null;
  if (!bgmGain) {
    bgmGain = ctx.createGain();
    bgmGain.connect(ctx.destination);
  }
  bgmGain.gain.setTargetAtTime(bgmMuted ? 0 : bgmVolume * 0.52, ctx.currentTime, 0.08);
  return bgmGain;
}
function playFallbackTone(frequency, duration = 0.46, level = 0.04) {
  const ctx = audioCtx;
  if (!ctx || !bgmGain || bgmMuted) return;
  const now = ctx.currentTime;
  const oscillator = ctx.createOscillator();
  const envelope = ctx.createGain();
  oscillator.type = currentTheme === 'halloween' ? 'triangle' : 'sine';
  oscillator.frequency.setValueAtTime(frequency, now);
  envelope.gain.setValueAtTime(0.0001, now);
  envelope.gain.exponentialRampToValueAtTime(level, now + 0.035);
  envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  oscillator.connect(envelope);
  envelope.connect(bgmGain);
  oscillator.onended = () => { bgmFallbackNodes = bgmFallbackNodes.filter(node => node !== oscillator); };
  bgmFallbackNodes.push(oscillator);
  oscillator.start(now);
  oscillator.stop(now + duration + 0.02);
}
function startFallbackMusic(themeKey) {
  if (!audioUnlocked || bgmMuted || themeKey === 'casino') return;
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  if (bgmFallbackTimer && bgmFallbackTheme === themeKey) return;
  stopFallbackMusic();
  bgmFallbackTheme = themeKey;
  ensureFallbackGain();
  const melodies = {
    christmas: [659.25, 783.99, 987.77, 783.99, 698.46, 880, 1046.5, 880],
    halloween: [220, 261.63, 293.66, 261.63, 196, 233.08, 261.63, 233.08],
    tet: [523.25, 587.33, 659.25, 783.99, 659.25, 587.33, 523.25, 440],
    valentine: [392, 493.88, 587.33, 493.88, 440, 523.25, 659.25, 523.25]
  };
  const notes = melodies[themeKey] || melodies.christmas;
  let beat = 0;
  const playBeat = () => {
    const note = notes[beat % notes.length];
    playFallbackTone(note, 0.48, 0.045);
    if (beat % 4 === 0) playFallbackTone(note / 2, 0.82, 0.022);
    beat++;
  };
  playBeat();
  bgmFallbackTimer = setInterval(playBeat, 520);
}
function startBgmPlayback() {
  if (!bgmAudio || !bgmAudio.src || bgmMuted) return;
  try {
    const playback = bgmAudio.play();
    if (playback && typeof playback.then === 'function') {
      playback.then(() => stopFallbackMusic()).catch(() => startFallbackMusic(currentTheme));
    }
  } catch { startFallbackMusic(currentTheme); }
}
export function initAudio() {
  if (typeof window === 'undefined' || bgmAudio) return;
  bgmAudio = new Audio();
  // Avoid crossOrigin=anonymous: external MP3 hosts may not send CORS headers.
  bgmAudio.loop = true;
  bgmAudio.preload = 'auto';
  bgmAudio.volume = bgmMuted ? 0 : bgmVolume;
  bgmAudio.addEventListener('error', () => {
    if (audioUnlocked && !bgmMuted && currentTheme) startFallbackMusic(currentTheme);
  });
  const unlock = () => {
    if (audioUnlocked) return;
    audioUnlocked = true;
    getAudioContext();
    if (!bgmMuted && bgmAudio?.src) startBgmPlayback();
    else if (!bgmMuted && currentTheme) startFallbackMusic(currentTheme);
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('click', unlock);
    window.removeEventListener('keydown', unlock);
    window.removeEventListener('touchstart', unlock);
  };
  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('click', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });
  window.addEventListener('touchstart', unlock, { once: true });
  updateBgmButtonUI();
}
export function playBgm(themeKey) {
  if (!themeKey || !BGM_TRACKS[themeKey]) return false;
  if (!bgmAudio) initAudio();
  if (!bgmAudio) return false;
  const targetUrl = BGM_TRACKS[themeKey];
  const sameTrack = currentTheme === themeKey && bgmAudio.src.endsWith(targetUrl);
  currentTheme = themeKey;
  stopFallbackMusic();
  if (!sameTrack) {
    bgmAudio.pause();
    bgmAudio.src = targetUrl;
    bgmAudio.load();
  }
  bgmAudio.volume = bgmMuted ? 0 : bgmVolume;
  if (!bgmMuted && audioUnlocked) startBgmPlayback();
  return true;
}

export function toggleBgm() {
  if (!bgmAudio) initAudio();
  bgmMuted = !bgmMuted;
  localStorage.setItem('gh_bgm_muted', bgmMuted ? '1' : '0');
  if (bgmMuted) {
    if (bgmAudio) bgmAudio.volume = 0;
    if (bgmGain && audioCtx) bgmGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.04);
    stopFallbackMusic();
  } else {
    audioUnlocked = true;
    getAudioContext();
    if (bgmAudio?.src) {
      bgmAudio.volume = bgmVolume;
      startBgmPlayback();
    } else if (currentTheme) startFallbackMusic(currentTheme);
  }
  updateBgmButtonUI();
  return !bgmMuted;
}

export function setBgmVolume(val) {
  bgmVolume = Math.max(0, Math.min(1, Number(val) || 0));
  localStorage.setItem('gh_bgm_vol', bgmVolume.toFixed(2));
  if (!bgmMuted && bgmAudio) bgmAudio.volume = bgmVolume;
  if (bgmGain && audioCtx) {
    bgmGain.gain.setTargetAtTime(bgmMuted ? 0 : bgmVolume * 0.52, audioCtx.currentTime, 0.08);
  }
}

export function isBgmMuted() {
  return bgmMuted;
}

export function getBgmVolume() {
  return bgmVolume;
}

function updateBgmButtonUI() {
  const btn = document.getElementById('btnBgm');
  if (btn) {
    btn.textContent = bgmMuted ? '🔇 Nhạc' : '🎵 Nhạc';
    btn.classList.toggle('bgm-active', !bgmMuted);
    btn.classList.toggle('bgm-muted', bgmMuted);
    btn.title = bgmMuted ? 'Nhạc nền đang TẮT · Nhấn để Bật' : 'Nhạc nền đang BẬT · Nhấn để Tắt';
  }
}

// ----------------------------------------------------------------------------
// THEMED SOUND EFFECTS (SFX) SYNTHESIZER
// High fidelity procedural synthesis via Web Audio API (zero network latency)
// ----------------------------------------------------------------------------
export function playSfx(name, theme = currentTheme) {
  const ctx = getAudioContext();
  if (!ctx || bgmMuted) return;

  const now = ctx.currentTime;

  try {
    switch (name) {
      // ===== CHRISTMAS THEME SFX =====
      case 'xmas_bell':
      case 'jingle_bells': {
        // Crisp Christmas bell harmonics (E5, G5, B5)
        [659.25, 783.99, 987.77].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + idx * 0.08);
          gain.gain.setValueAtTime(0.18, now + idx * 0.08);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.45);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.08);
          osc.stop(now + idx * 0.08 + 0.5);
        });
        break;
      }
      case 'snow_throw': {
        // Whoosh of thrown snowball
        const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < noiseBuffer.length; i++) output[i] = Math.random() * 2 - 1;
        const whiteNoise = ctx.createBufferSource();
        whiteNoise.buffer = noiseBuffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(400, now);
        filter.frequency.exponentialRampToValueAtTime(1400, now + 0.18);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.2);
        whiteNoise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        whiteNoise.start(now);
        break;
      }
      case 'snow_hit': {
        // Crunchy impact of snowball hitting character
        const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.25, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < noiseBuffer.length; i++) output[i] = Math.random() * 2 - 1;
        const whiteNoise = ctx.createBufferSource();
        whiteNoise.buffer = noiseBuffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(600, now);
        filter.frequency.linearRampToValueAtTime(120, now + 0.22);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.45, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.24);
        whiteNoise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        whiteNoise.start(now);
        break;
      }
      case 'marshmallow': {
        // Soft sizzle crackle of marshmallow over campfire
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.exponentialRampToValueAtTime(350, now + 0.15);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.26);
        break;
      }

      // ===== HALLOWEEN THEME SFX =====
      case 'spooky_laugh': {
        // Modulated witch/vampire eerie cackle
        [320, 260, 200, 160].forEach((f, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(f, now + idx * 0.12);
          osc.frequency.linearRampToValueAtTime(f * 0.8, now + idx * 0.12 + 0.1);
          gain.gain.setValueAtTime(0.2, now + idx * 0.12);
          gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.12 + 0.15);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.12);
          osc.stop(now + idx * 0.12 + 0.16);
        });
        break;
      }
      case 'ghost_boo': {
        // Swept spooky theremin ghost sound
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(540, now);
        osc.frequency.exponentialRampToValueAtTime(110, now + 0.65);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.7);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.72);
        break;
      }
      case 'candy_crunch':
      case 'halloween_candy': {
        // Sweet candy crunch blip
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
        gain.gain.setValueAtTime(0.24, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.22);
        break;
      }

      // ===== TET NGUYEN DAN THEME SFX =====
      case 'firecracker': {
        // Rapid staccato firecracker pops (Pháo nổ tưng bừng)
        for (let i = 0; i < 7; i++) {
          const t = now + i * 0.055 + Math.random() * 0.015;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(280 + Math.random() * 120, t);
          osc.frequency.exponentialRampToValueAtTime(60, t + 0.035);
          gain.gain.setValueAtTime(0.32, t);
          gain.gain.exponentialRampToValueAtTime(0.005, t + 0.04);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t);
          osc.stop(t + 0.045);
        }
        break;
      }
      case 'firework_rocket': {
        // Launching rocket whistle + boom
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(1400, now + 0.4);
        gain.gain.setValueAtTime(0.22, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.42);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.43);

        // Boom at apex
        setTimeout(() => {
          const boomCtx = getAudioContext();
          if (!boomCtx) return;
          const bNow = boomCtx.currentTime;
          const boomOsc = boomCtx.createOscillator();
          const boomGain = boomCtx.createGain();
          boomOsc.type = 'triangle';
          boomOsc.frequency.setValueAtTime(120, bNow);
          boomOsc.frequency.exponentialRampToValueAtTime(35, bNow + 0.5);
          boomGain.gain.setValueAtTime(0.4, bNow);
          boomGain.gain.exponentialRampToValueAtTime(0.01, bNow + 0.55);
          boomOsc.connect(boomGain);
          boomGain.connect(boomCtx.destination);
          boomOsc.start(bNow);
          boomOsc.stop(bNow + 0.6);
        }, 380);
        break;
      }
      case 'tet_lixi': {
        // Vietnamese pentatonic festival chime (C5, D5, E5, G5, A5)
        [523.25, 659.25, 783.99, 880.0, 1046.5].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.07);
          gain.gain.setValueAtTime(0.22, now + idx * 0.07);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.55);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.07);
          osc.stop(now + idx * 0.07 + 0.6);
        });
        break;
      }

      // ===== VALENTINE THEME SFX =====
      case 'valentine_harp': {
        // Romantic ascending harp glissando (C-E-G-B-D-G)
        [261.63, 329.63, 392.0, 493.88, 587.33, 783.99].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.075);
          gain.gain.setValueAtTime(0.2, now + idx * 0.075);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.075 + 0.7);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.075);
          osc.stop(now + idx * 0.075 + 0.75);
        });
        break;
      }
      case 'cupid_arrow_shoot': {
        // Twang of Cupid's golden bow
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(580, now);
        osc.frequency.exponentialRampToValueAtTime(180, now + 0.16);
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.22);
        break;
      }
      case 'cupid_arrow_hit':
      case 'love_sparkle': {
        // Sparkle chime on Cupid arrow hit
        [1046.5, 1318.5, 1567.98, 2093.0].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.05);
          gain.gain.setValueAtTime(0.22, now + idx * 0.05);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.45);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.05);
          osc.stop(now + idx * 0.05 + 0.5);
        });
        break;
      }
      case 'kiss_pop': {
        // Soft bubble kiss pop
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(260, now);
        osc.frequency.exponentialRampToValueAtTime(740, now + 0.09);
        gain.gain.setValueAtTime(0.28, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.14);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.16);
        break;
      }
      case 'wishing_fountain': {
        // Water droplet splash
        [680, 920, 1150].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.06);
          osc.frequency.exponentialRampToValueAtTime(freq * 1.3, now + idx * 0.06 + 0.08);
          gain.gain.setValueAtTime(0.18, now + idx * 0.06);
          gain.gain.exponentialRampToValueAtTime(0.005, now + idx * 0.06 + 0.18);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.06);
          osc.stop(now + idx * 0.06 + 0.2);
        });
        break;
      }
      // ===== CASINO & ARCADE THEME SFX =====
      case 'roulette_spin': {
        // Ball rolling in wheel track (rapid diminishing clicks)
        for (let i = 0; i < 12; i++) {
          const t = now + i * 0.08 + Math.pow(i * 0.04, 1.4);
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(800 + (12 - i) * 30, t);
          gain.gain.setValueAtTime(0.2, t);
          gain.gain.exponentialRampToValueAtTime(0.005, t + 0.025);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t);
          osc.stop(t + 0.03);
        }
        break;
      }
      case 'duck_quack': {
        // Comic duck quack (wa-wa pitch sweep)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(460, now + 0.08);
        osc.frequency.exponentialRampToValueAtTime(280, now + 0.22);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.26);
        break;
      }
      case 'blackjack_deal': {
        // Snappy card sliding and chip clink
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(1400, now);
        osc.frequency.exponentialRampToValueAtTime(600, now + 0.06);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.09);
        break;
      }
      case 'slot_lever': {
        // Heavy mechanical lever pull
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.exponentialRampToValueAtTime(70, now + 0.18);
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.22);
        break;
      }
      case 'slot_win':
      case 'plinko_win': {
        // Vegas Casino Jackpot celebratory arpeggio (C-E-G-C-E-G)
        [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.07);
          gain.gain.setValueAtTime(0.25, now + idx * 0.07);
          gain.gain.exponentialRampToValueAtTime(0.005, now + idx * 0.07 + 0.45);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.07);
          osc.stop(now + idx * 0.07 + 0.5);
        });
        break;
      }
      case 'plinko_peg': {
        // High-pitched crystal ping on nail contact
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        const freqs = [1046.5, 1174.66, 1318.51, 1567.98, 1760.0, 2093.0];
        const f = freqs[Math.floor(Math.random() * freqs.length)];
        osc.frequency.setValueAtTime(f, now);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.005, now + 0.09);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.1);
        break;
      }
      case 'jackpot_voice': {
        if (jackpotAudio && !jackpotAudio.ended && !jackpotAudio.paused) return;
        const audio = new Audio('assets/jackpot.mp3');
        jackpotAudio = audio;
        audio.volume = Math.max(0.04, Math.min(0.28, bgmVolume * 0.45));
        audio.addEventListener('ended', () => {
          if (jackpotAudio === audio) jackpotAudio = null;
        }, { once: true });
        audio.addEventListener('error', () => {
          if (jackpotAudio === audio) jackpotAudio = null;
        }, { once: true });
        audio.play().catch(err => {
          if (jackpotAudio === audio) jackpotAudio = null;
          console.warn('[SFX] Jackpot audio playback failed:', err);
        });
        break;
      }
      case 'truonggiang_catch': {
        if (!truongGiangCatchAudio) {
          truongGiangCatchAudio = new Audio('assets/freaky-giang.mp3');
        }
        truongGiangCatchAudio.volume = Math.max(0.04, Math.min(0.3, bgmVolume * 0.5));
        truongGiangCatchAudio.currentTime = 0;
        truongGiangCatchAudio.play().catch(err => {
          console.warn('[SFX] Trường Giang catch audio playback failed:', err);
        });
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.warn('[SFX] Audio synthesis error:', err);
  }
}
