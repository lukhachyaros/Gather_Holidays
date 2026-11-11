// Theme definitions, costumes, pumpkin hat carvings, ornaments, and Tet lucky money rewards.
export const THEMES = {
  christmas: {
    name: '🎄 Giáng sinh',
    bg: '#0b1d2e',
    floor: ['#e8f0f7', '#dbe7f1'],
    path: '#c8d6e5',
    wall: '#6d3b2e',
    water: '#7fb6e6',
    rug: '#b3202a',
    tree: '🌲',
    prop: '🎄',
    decor: ['🎄', '🎁', '⛄', '🦌', '🔔', '⭐', '🕯️', '🧦', '🍪', '❄️', '🎀'],
    particles: { emoji: ['❄️', '✨'], count: 42, vy: [0.4, 1.0], vx: [-0.3, 0.3] },
    music: 'yXQViqx6GMY',
  },
  halloween: {
    name: '🎃 Halloween',
    bg: '#12091c',
    floor: ['#261738', '#2f1d44'],
    path: '#3d2756',
    wall: '#4a2a1a',
    water: '#3d1a5c',
    rug: '#7a2e00',
    tree: '🌳',
    prop: '🎃',
    decor: ['🎃', '👻', '🦇', '🕷️', '🕸️', '💀', '🍬', '🧙', '🕯️', '🪦', '🧛', '🍭'],
    particles: { emoji: ['🦇', '🍂'], count: 22, vy: [0.2, 0.6], vx: [-0.5, 0.5] },
    music: 'xQ1bAJ0RAs8',
  },
  tet: {
    name: '🧧 Tết Nguyên Đán',
    bg: '#070617',
    floor: ['#fef08a', '#fde047'],
    path: '#f59e0b',
    wall: '#b91c1c',
    water: '#e11d48',
    rug: '#dc2626',
    tree: '🌸',
    prop: '🏮',
    decor: ['🌸', '🏮', '🧧', '🎆', '🎇', '🐉', '🍊', '🥮', '🎋', '🪭', '🏵️'],
    particles: { emoji: ['🌼', '🌸', '🧧', '✨'], count: 36, vy: [0.3, 0.8], vx: [-0.4, 0.4] },
    music: 'tUOJxCJxw1Q',
  },
  valentine: {
    name: '💝 Valentine',
    bg: '#210d24',
    floor: ['#fce7f3', '#fbcfe8'],
    path: '#f9a8d4',
    wall: '#7f1d4e',
    water: '#f472b6',
    rug: '#be185d',
    tree: '🌹',
    prop: '💗',
    decor: ['🌹', '🌷', '💝', '💌', '💘', '🕯️', '✨', '💗', '🦢', '💐'],
    particles: { emoji: ['🌸', '💗', '✨'], count: 34, vy: [0.25, 0.75], vx: [-0.35, 0.35] },
  },
  casino: {
    name: '🎰 Mật Thất Casino (Bí Mật)',
    secret: true,
    bg: '#0a0a1a',
    floor: ['#1e1b4b', '#181438'],
    path: '#2e1065',
    wall: '#451a03',
    water: '#0284c7',
    rug: '#7f1d1d',
    tree: '🌴',
    prop: '🎰',
    decor: ['🎰', '🎲', '🪙', '🃏', '🦆', '✨', '💎', '👑', '🍒', '🔔', '7️⃣'],
    particles: { emoji: ['🪙', '✨', '🎲', '💎'], count: 35, vy: [0.25, 0.75], vx: [-0.35, 0.35] },
  },
};

export const COSTUMES = {
  default: {
    name: '🧑 Trang phục thường',
    skin: '#ffdbb5',
    shirt: null, // uses player's unique hue
    pants: '#2b3a4a',
    shoes: '#1f242d',
    hair: '#3a2314',
  },
  frankenstein: {
    name: '🧟 Frankenstein',
    skin: '#6ab04c',
    shirt: '#2f3640',
    pants: '#1e272e',
    shoes: '#111111',
    hair: '#111111',
    bolts: true,
    flatHead: true,
  },
  zombie: {
    name: '🧟‍♂️ Zombie',
    skin: '#7f8fa6',
    shirt: '#485460',
    pants: '#2f3640',
    shoes: '#222222',
    hair: '#2d3436',
    redEyes: true,
    tattered: true,
  },
  vampire: {
    name: '🧛 Ma cà rồng',
    skin: '#f5f6fa',
    shirt: '#191924',
    pants: '#111118',
    shoes: '#0a0a0f',
    hair: '#0f0f1a',
    cape: '#b31217',
    redEyes: true,
    fangs: true,
  },
  witch: {
    name: '🧙 Phù thủy',
    skin: '#dcdde1',
    shirt: '#5f27cd',
    pants: '#341f97',
    shoes: '#19103b',
    hair: '#ff9f43',
    witchHat: true,
  },
  skeleton: {
    name: '💀 Bộ xương',
    skin: '#f1f2f6',
    shirt: '#1e272e',
    pants: '#1e272e',
    shoes: '#dcdde1',
    hair: null,
    ribs: true,
    skullEyes: true,
  },
};

export const PUMPKIN_HATS = {
  classic: { name: '🎃 Mặt Cười Cổ Điển', eyeType: 'triangle', mouthType: 'grin', glow: '#ffcc00' },
  evil: { name: '😈 Mặt Quỷ Dữ', eyeType: 'slant', mouthType: 'jagged', glow: '#ff3b00' },
  happy: { name: '😄 Mặt Vui Vẻ', eyeType: 'arc', mouthType: 'smile', glow: '#ffe066' },
  shock: { name: '😱 Mặt Kinh Ngạc', eyeType: 'round', mouthType: 'o', glow: '#70e000' },
  cat: { name: '🐱 Mặt Mèo Ma', eyeType: 'cat', mouthType: 'cat', glow: '#ff8500' },
  cyclops: { name: '👁️ Độc Nhãn Quỷ', eyeType: 'cyclops', mouthType: 'jagged', glow: '#00f5d4' },
};

export const ORNAMENTS = [
  { key: 'ball_red', name: '🔴 Quả châu đỏ', color: '#e63946', shape: 'sphere' },
  { key: 'ball_gold', name: '🟡 Quả châu vàng', color: '#ffb703', shape: 'sphere' },
  { key: 'ball_blue', name: '🔵 Quả châu xanh', color: '#00b4d8', shape: 'sphere' },
  { key: 'star', name: '⭐ Ngôi sao lấp lánh', color: '#ffd60a', shape: 'star' },
  { key: 'bell', name: '🔔 Chuông vàng', color: '#f4a261', shape: 'bell' },
  { key: 'cane', name: '🍬 Kẹo gậy Giáng sinh', color: '#ff4d6d', shape: 'cane' },
  { key: 'gift', name: '🎁 Hộp quà nhỏ', color: '#2a9d8f', shape: 'gift' },
];

export const LIXI_MONEY = [
  { label: '100 Xu', amount: 100, weight: 50, color: '#facc15' },
  { label: '200 Xu', amount: 200, weight: 28, color: '#38bdf8' },
  { label: '500 Xu', amount: 500, weight: 14, color: '#4ade80' },
  { label: '1.000 Xu', amount: 1000, weight: 7, color: '#c084fc' },
  { label: 'JACKPOT 10.000 XU', amount: 10000, weight: 1, color: '#f43f5e', isJackpot: true },
];

export const LIXI_WISHES = [
  '🌸 Chúc bạn năm mới Vạn Sự Như Ý, Tỷ Sự Như Mơ, Triệu Điều Bất Ngờ!',
  '💰 Tiền vào như nước sông Đà, tiền ra nhỏ giọt như cà phê phin!',
  '🐎 Mã đáo thành công — Sự nghiệp thăng tiến vượt bậc!',
  '❤️ Gia đình hạnh phúc, sức khỏe dồi dào, tình duyên phơi phới!',
  '🌟 An khang thịnh vượng — Lộc biếc mai vàng, xuân sang đắc lộc!',
  '🎊 Hay ăn chóng giàu, cười tươi suốt năm, may mắn ngập tràn!',
];

export function rollLixiReward() {
  const total = LIXI_MONEY.reduce((s, i) => s + i.weight, 0);
  let r = Math.random() * total;
  let selected = LIXI_MONEY[0];
  for (const item of LIXI_MONEY) {
    r -= item.weight;
    if (r <= 0) {
      selected = item;
      break;
    }
  }

  const wish = LIXI_WISHES[Math.floor(Math.random() * LIXI_WISHES.length)];
  return {
    type: 'money',
    amount: selected.amount,
    label: selected.label,
    isJackpot: !!selected.isJackpot,
    color: selected.color,
    wish,
    title: selected.isJackpot ? '💥 NỔ HŨ JACKPOT 10.000 XU! 💥' : `🧧 Lộc Xuân: ${selected.label}`,
    detail: selected.isJackpot
      ? `ĐẠI PHÚ QUÝ! Bạn đã may mắn nổ hũ Jackpot cực hiếm 10.000 Xu từ Cây Mai Đại Thụ! Số Xu đã được nạp thẳng vào Ví của bạn!`
      : `Chúc mừng bạn vừa hái được bao lì xì trị giá ${selected.label} từ Cây Mai Đại Thụ! Số Xu đã được cộng thẳng vào Ví!`,
    short: selected.isJackpot ? `nổ hũ JACKPOT 10.000 Xu 💥` : `hái được lì xì ${selected.label} 🧧`,
  };
}

export const CARD_STYLES = {
  christmas: { name: '🎄 Giáng sinh', bg: '#fdf2f2', fg: '#14532d', border: '#b3202a' },
  halloween: { name: '🎃 Halloween', bg: '#2b1a3d', fg: '#ffb347', border: '#ff7518' },
  tet: { name: '🧧 Tết Đoàn Viên', bg: '#c1121f', fg: '#ffd166', border: '#ffd166' },
  classic: { name: '✨ Cổ điển', bg: '#fff8e7', fg: '#5a3e1b', border: '#c9a227' },
  love: { name: '💝 Tình yêu', bg: '#ffe4ec', fg: '#9d174d', border: '#f472b6' },
};
