// Theme definitions: palette, props, decorations, particles, default music.
// Add a new holiday by adding one entry here — nothing else needs to change.
export const THEMES = {
  halloween: {
    name: '🎃 Halloween',
    bg: '#120a1f', floor: ['#2b1a3d', '#33204a'], wall: '#4a2a1a', water: '#3d1a5c', rug: '#7a2e00',
    tree: '🌳', screen: '📺', prop: '🎃',
    decor: ['🎃', '👻', '🦇', '🕷️', '🕸️', '💀', '🍬', '🧙', '🕯️', '🪦', '🧛', '🍭'],
    particles: { emoji: ['🦇', '🍂'], count: 18, vy: [0.2, 0.6], vx: [-0.5, 0.5] },
    music: 'xQ1bAJ0RAs8',
  },
  christmas: {
    name: '🎄 Giáng sinh',
    bg: '#0b1d2e', floor: ['#e8f0f7', '#dbe7f1'], wall: '#7a3b2e', water: '#7fb6e6', rug: '#b3202a',
    tree: '🌲', screen: '📺', prop: '🎄',
    decor: ['🎄', '🎁', '⛄', '🎅', '🦌', '🔔', '⭐', '🕯️', '🧦', '🍪', '❄️', '🎀'],
    particles: { emoji: ['❄️', '✨'], count: 40, vy: [0.4, 1.0], vx: [-0.3, 0.3] },
    music: 'yXQViqx6GMY',
  },
  tet: {
    name: '🧧 Tết Nguyên Đán',
    bg: '#3a0a0a', floor: ['#f6d58a', '#f0c870'], wall: '#8c1c13', water: '#d62828', rug: '#c1121f',
    tree: '🌸', screen: '📺', prop: '🏮',
    decor: ['🌸', '🏮', '🧧', '🎆', '🎇', '🐉', '🍊', '🥮', '🎋', '🪭', '🏵️', '🐎'],
    particles: { emoji: ['🌸', '🧧', '✨'], count: 28, vy: [0.3, 0.8], vx: [-0.4, 0.4] },
    music: 'tUOJxCJxw1Q',
  },
  midautumn: {
    name: '🥮 Trung thu',
    bg: '#10143a', floor: ['#2a2f6b', '#30367a'], wall: '#6b4a1f', water: '#1d3b8a', rug: '#e9a23b',
    tree: '🎋', screen: '📺', prop: '🏮',
    decor: ['🏮', '🥮', '🌕', '🐇', '🌟', '🏵️', '🐉', '🍵', '🎐', '🪅'],
    particles: { emoji: ['✨', '🌟'], count: 22, vy: [0.1, 0.4], vx: [-0.2, 0.2] },
    music: '',
  },
  newyear: {
    name: '🎆 Năm mới',
    bg: '#05050f', floor: ['#1c1c3a', '#22224a'], wall: '#3a3a6b', water: '#2b2b8f', rug: '#d4af37',
    tree: '🌴', screen: '📺', prop: '🎇',
    decor: ['🎆', '🎇', '🥂', '🍾', '🎉', '🎊', '⏰', '🎈', '✨', '🪩'],
    particles: { emoji: ['🎊', '✨', '🎉'], count: 30, vy: [0.5, 1.2], vx: [-0.5, 0.5] },
    music: '',
  },
  valentine: {
    name: '💝 Valentine',
    bg: '#2a0a1a', floor: ['#ffd6e0', '#ffc2d1'], wall: '#9d174d', water: '#f472b6', rug: '#e11d48',
    tree: '🌹', screen: '📺', prop: '💖',
    decor: ['💖', '🌹', '💌', '🍫', '🧸', '💍', '💘', '🕊️', '🍷', '🎀'],
    particles: { emoji: ['💖', '🌸'], count: 22, vy: [0.2, 0.6], vx: [-0.3, 0.3] },
    music: '',
  },
};

export const AVATARS = ['😀', '😎', '🥳', '🤠', '🧑‍🎄', '🧙', '👻', '🐱', '🐶', '🦊', '🐼', '🐸', '🐉', '🧚', '🤖', '👽'];

export const CARD_STYLES = {
  classic: { name: 'Cổ điển', bg: '#fff8e7', fg: '#5a3e1b', border: '#c9a227' },
  halloween: { name: 'Halloween', bg: '#2b1a3d', fg: '#ffb347', border: '#ff7518' },
  christmas: { name: 'Giáng sinh', bg: '#fdf2f2', fg: '#14532d', border: '#b3202a' },
  tet: { name: 'Tết', bg: '#c1121f', fg: '#ffd166', border: '#ffd166' },
  love: { name: 'Tình yêu', bg: '#ffe4ec', fg: '#9d174d', border: '#f472b6' },
};
