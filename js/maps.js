// Theme map layouts, collision helpers, and interactive hotspots for Christmas, Halloween & Tet.
import { PUMPKIN_HATS } from './themes.js';

export const TILES = [
  { ch: '.', label: 'Sàn', solid: false },
  { ch: 'P', label: 'Đường lát', solid: false },
  { ch: '#', label: 'Tường', solid: true },
  { ch: 'T', label: 'Cây cảnh', solid: true },
  { ch: '~', label: 'Nước', solid: true },
  { ch: 'R', label: 'Thảm', solid: false },
];

const SOLID = new Set(TILES.filter(t => t.solid).map(t => t.ch));
export const isSolid = ch => SOLID.has(ch);

export function buildThemeMap(themeKey = 'christmas') {
  const w = 30, h = 22;
  const grid = Array.from({ length: h }, (_, y) =>
    Array.from({ length: w }, (_, x) => (x === 0 || y === 0 || x === w - 1 || y === h - 1 ? '#' : '.'))
  );
  const set = (x, y, c) => {
    if (x > 0 && y > 0 && x < w - 1 && y < h - 1) grid[y][x] = c;
  };
  const rect = (x0, y0, x1, y1, c) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, c);
  };

  // 1. Common North Cinema Area (Rugs for seating area in front of Giant TV Screen)
  rect(10, 3, 19, 7, 'R');

  // 2. Main Walkway from Spawn (South) to Centerpiece Plaza & Cinema
  rect(13, 8, 16, 19, 'P');
  rect(11, 9, 18, 14, 'P');
  rect(6, 11, 23, 12, 'P');

  // 3. Perimeter Decorative Trees
  const borderTrees = [
    [2, 2], [5, 2], [24, 2], [27, 2],
    [2, 6], [27, 6],
    [2, 10], [27, 10],
    [2, 15], [27, 15],
    [2, 19], [6, 19], [23, 19], [27, 19],
  ];
  for (const [tx, ty] of borderTrees) set(tx, ty, 'T');

  if (themeKey === 'christmas') {
    // Cozy carpets around the two campfires
    rect(5, 14, 8, 16, 'P');
    rect(21, 14, 24, 16, 'P');
    // Frozen pond corners
    rect(3, 4, 5, 5, '~');
    rect(24, 4, 26, 5, '~');
  } else if (themeKey === 'halloween') {
    // Spooky dark carpet around the Giant Pumpkin & Spawn Costume Plaza
    rect(12, 10, 17, 13, 'R');
    rect(9, 16, 20, 18, 'P');
    // Mystic purple ponds
    rect(4, 13, 6, 15, '~');
    rect(23, 13, 25, 15, '~');
  } else if (themeKey === 'tet') {
    // Red festive carpet under Giant Mai Tree & Firework Zones
    rect(12, 10, 17, 13, 'R');
    rect(4, 13, 9, 16, 'R');
    rect(20, 13, 25, 16, 'R');
  }

  if (themeKey === 'valentine') {
    // A rose-pink heart plaza, with two garden wings connected to the main path.
    rect(12, 10, 17, 13, 'R');
    rect(4, 13, 9, 16, 'R');
    rect(20, 13, 25, 16, 'R');
    rect(7, 8, 10, 10, 'P');
    rect(19, 8, 22, 10, 'P');
    // Decorative reflecting pools in the outer corners.
    rect(3, 4, 5, 5, '~');
    rect(24, 4, 26, 5, '~');
  } else if (themeKey === 'casino') {
    // Luxurious velvet carpets for the 5 arcade stations
    rect(11, 10, 18, 14, 'R'); // Central Duck Derby water canal
    rect(4, 10, 10, 13, 'R');  // West Roulette Plaza
    rect(19, 10, 25, 13, 'R'); // East Blackjack Plaza
    rect(4, 15, 10, 19, 'R');  // Southwest Slots row
    rect(19, 15, 25, 19, 'R'); // Southeast Plinko tower
    // Walkways connecting all game plazas
    rect(6, 16, 23, 17, 'P');
  }

  return {
    w,
    h,
    theme: themeKey,
    rows: grid.map(r => r.join('')),
    spawn: [14.5, 18.5],
  };
}

export function defaultMap(themeKey = 'christmas') {
  return buildThemeMap(themeKey);
}

export function validMap(m) {
  return (
    m &&
    Number.isInteger(m.w) &&
    Number.isInteger(m.h) &&
    m.w >= 8 &&
    m.h >= 8 &&
    m.w <= 80 &&
    m.h <= 80 &&
    Array.isArray(m.rows) &&
    m.rows.length === m.h &&
    m.rows.every(r => typeof r === 'string' && r.length === m.w)
  );
}

// Deterministic pseudo-random generator for snowmen placement
function makeRng(seedStr = 'gather') {
  let s = 2166136261 >>> 0;
  for (const c of String(seedStr)) {
    s ^= c.charCodeAt(0);
    s = Math.imul(s, 16777619) >>> 0;
  }
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * Returns all interactive stations, seats, solid colliders, and NPCs for a given theme.
 */
export function getThemeFeatures(themeKey = 'christmas', seedStr = 'room') {
  const hotspots = [];
  const seats = [];
  const colliders = []; // { x, y, r } in tile coordinates

  // ==========================================================================
  // 1. COMMON CINEMA TV STAGE & SEATING (NORTH AREA)
  // ==========================================================================
  hotspots.push({
    id: 'cinema_screen',
    type: 'screen',
    x: 14.5,
    y: 2.2,
    radius: 3.8,
    prompt: '🎬 Màn Hình Lớn · [E] Mở Hàng Chờ Video YouTube',
  });
  // Solid stage collider for TV screen
  for (let sx = 12; sx <= 17; sx += 1) colliders.push({ x: sx, y: 2.1, r: 0.18 });

  // Row 1 (y = 4.5): Single chairs on sides + 1 Couple Sofa in center
  const singleCoords = [
    { id: 'chair_1', x: 11.2, y: 4.5 },
    { id: 'chair_2', x: 12.4, y: 4.5 },
    { id: 'chair_3', x: 16.6, y: 4.5 },
    { id: 'chair_4', x: 17.8, y: 4.5 },
  ];
  singleCoords.forEach(c => {
    seats.push({
      id: c.id,
      kind: 'single',
      x: c.x,
      y: c.y,
      rot: Math.PI, // face north toward TV
      slots: [{ id: `${c.id}_0`, x: c.x, y: c.y + 0.08, rot: Math.PI, lean: 0 }],
    });
  });

  // Couple Sofas (2 seats per sofa, players sitting together trigger Couple Heart mode!)
  const coupleSofas = [
    { id: 'sofa_row1', x: 14.5, y: 4.5 },
    { id: 'couple_left', x: 11.8, y: 6.1 },
    { id: 'couple_center', x: 14.5, y: 6.1 },
    { id: 'couple_right', x: 17.2, y: 6.1 },
  ];
  coupleSofas.forEach(cs => {
    seats.push({
      id: cs.id,
      kind: 'couple',
      x: cs.x,
      y: cs.y,
      rot: Math.PI,
      slots: [
        { id: `${cs.id}_L`, sofaId: cs.id, x: cs.x - 0.24, y: cs.y + 0.08, rot: Math.PI, lean: -1, pose: themeKey === 'valentine' ? 'recline' : null },
        { id: `${cs.id}_R`, sofaId: cs.id, x: cs.x + 0.24, y: cs.y + 0.08, rot: Math.PI, lean: 1, pose: themeKey === 'valentine' ? 'recline' : null },
      ],
    });
  });

  // ==========================================================================
  // 2. THEME-SPECIFIC CENTERPIECE & INTERACTIVE STATIONS
  // ==========================================================================
  const extraProps = [];

  if (themeKey === 'christmas') {
    // Centerpiece: Giant Christmas Tree
    hotspots.push({
      id: 'xmas_tree',
      type: 'xmas_tree',
      x: 14.5,
      y: 11.5,
      radius: 2.9,
      prompt: '🎄 Cây Thông Giáng Sinh · [E] Treo đồ trang trí / Viết & đọc thiệp trong tất 🧦',
    });
    colliders.push({ x: 14.5, y: 11.5, r: 0.42 });

    // 2 Ornament Pickup Tables near the tree
    [
      { id: 'orn_table_left', x: 10.4, y: 11.5 },
      { id: 'orn_table_right', x: 18.6, y: 11.5 },
    ].forEach(tb => {
      hotspots.push({
        id: tb.id,
        type: 'ornament_table',
        x: tb.x,
        y: tb.y,
        radius: 1.75,
        prompt: '🎁 Bàn Đồ Trang Trí · [E] Nhặt đồ trang trí đem treo lên cây thông',
      });
      colliders.push({ x: tb.x, y: tb.y, r: 0.22 });
    });

    // 2 Campfire Zones with surrounding Log Seats
    [
      { id: 'campfire_left', x: 6.5, y: 15.0 },
      { id: 'campfire_right', x: 22.5, y: 15.0 },
    ].forEach(cf => {
      hotspots.push({
        id: cf.id,
        type: 'campfire',
        x: cf.x,
        y: cf.y,
        radius: 2.5,
        prompt: '🔥 Lửa Trại Ấm Áp · [E] Nướng Marshmallow 🍡 / Uống Ca Cao Nóng ☕',
      });
      colliders.push({ x: cf.x, y: cf.y, r: 0.24 });

      // 4 Log seats around each campfire
      const offsets = [
        { dx: 0, dy: -1.25, rot: 0, meshRot: 0 },
        { dx: 0, dy: 1.25, rot: Math.PI, meshRot: 0 },
        { dx: -1.25, dy: 0, rot: Math.PI / 2, meshRot: Math.PI / 2 },
        { dx: 1.25, dy: 0, rot: -Math.PI / 2, meshRot: Math.PI / 2 },
      ];
      offsets.forEach((o, idx) => {
        const lid = `${cf.id}_log_${idx}`;
        const lx = cf.x + o.dx, ly = cf.y + o.dy;
        seats.push({
          id: lid,
          kind: 'log',
          x: lx,
          y: ly,
          rot: o.rot,
          meshRot: o.meshRot,
          campfireId: cf.id,
          slots: [{ id: `${lid}_0`, x: lx, y: ly, rot: o.rot, lean: 0, campfire: true }],
        });
      });
    });

    // Random Snowmen scattered across the map
    const rng = makeRng(seedStr + '_xmas');
    const candidateSpots = [
      [4.2, 8.5], [7.8, 8.2], [21.5, 8.3], [25.2, 8.6],
      [4.0, 11.8], [25.0, 11.8], [9.8, 16.5], [19.2, 16.5],
      [11.0, 18.8], [18.0, 18.8], [4.5, 18.2], [24.5, 18.2],
    ];
    candidateSpots.forEach(([sx, sy], i) => {
      if (rng() > 0.25 || i < 7) {
        const jx = sx + (rng() - 0.5) * 0.6;
        const jy = sy + (rng() - 0.5) * 0.6;
        extraProps.push({
          type: 'snowman',
          x: jx,
          y: jy,
          rot: rng() * Math.PI * 2,
          variant: i,
        });
        colliders.push({ x: jx, y: jy, r: 0.12 });
      }
    });

    // Illusion wall concealing secret passage at NW corner
    extraProps.push({ type: 'illusion_wall', x: 3.2, y: 3.5, rot: 0 });

    // Secret Passage to Casino: In hidden nook behind frost illusion wall (x: 2.2, y: 2.6)
    hotspots.push({
      id: 'secret_passage_xmas',
      type: 'secret_passage',
      target: 'casino',
      x: 2.2,
      y: 2.6,
      radius: 2.0,
      prompt: '❄️ Mật Đạo Băng Giá · [E] Vào Mật Thất Casino',
    });

    // Secret Paper Notes (Code: Chu0n6, Raumania)
    hotspots.push(
      {
        id: 'note_chu0n6_xmas',
        type: 'secret_note',
        code: 'Chu0n6',
        x: 2.2,
        y: 2.2,
        radius: 1.6,
        prompt: '📌 Mảnh Giấy Bí Mật · [E] Đọc mật mã nhận 500 xu',
      },
      {
        id: 'note_raumania_xmas',
        type: 'secret_note',
        code: 'Raumania',
        x: 11.2,
        y: 4.8,
        radius: 1.6,
        prompt: '📌 Mảnh Giấy Bí Mật · [E] Đọc mật mã nhận 500 xu',
      }
    );
  } else if (themeKey === 'halloween') {
    // Centerpiece: Giant Carved Jack-O'-Lantern
    hotspots.push({
      id: 'giant_pumpkin',
      type: 'giant_pumpkin',
      x: 14.5,
      y: 11.5,
      radius: 2.5,
      prompt: '🎃 Đại Bí Ngô Khổng Lồ · Hãy lại gần các quả bí ngô nhỏ xung quanh để đội lên đầu!',
    });
    colliders.push({ x: 14.5, y: 11.5, r: 0.48 });

    // 6 Small Carved Pumpkins with distinct faces around the centerpiece
    const styleKeys = Object.keys(PUMPKIN_HATS);
    styleKeys.forEach((styleKey, idx) => {
      const angle = (idx / styleKeys.length) * Math.PI * 2 + 0.3;
      const px = 14.5 + Math.cos(angle) * 2.55;
      const py = 11.5 + Math.sin(angle) * 2.35;
      const cfg = PUMPKIN_HATS[styleKey];
      hotspots.push({
        id: `pumpkin_${styleKey}`,
        type: 'small_pumpkin',
        styleKey,
        x: px,
        y: py,
        rot: angle + Math.PI / 2,
        radius: 1.25,
        prompt: `${cfg.name} · [E] Đội quả bí ngô này lên đầu`,
      });
    });

    // 5 Costume Booths right near Spawn (y = 16.8)
    const boothCostumes = ['frankenstein', 'zombie', 'vampire', 'witch', 'skeleton'];
    boothCostumes.forEach((costumeKey, idx) => {
      const bx = 10.5 + idx * 2.0;
      const by = 16.5;
      hotspots.push({
        id: `booth_${costumeKey}`,
        type: 'costume_booth',
        costumeKey,
        x: bx,
        y: by,
        radius: 1.35,
        prompt: `🎭 Tủ Hóa Trang · [E] Đổi trang phục (${costumeKey.toUpperCase()})`,
      });
      colliders.push({ x: bx, y: by, r: 0.18 });
    });

    // 2 Gothic Couple Sofas in the garden wings
    [
      { id: 'halloween_sofa_left', x: 6.5, y: 16.5 },
      { id: 'halloween_sofa_right', x: 22.5, y: 16.5 },
    ].forEach(cs => {
      seats.push({
        id: cs.id,
        kind: 'couple',
        x: cs.x,
        y: cs.y,
        rot: Math.PI,
        slots: [
          { id: cs.id + '_L', sofaId: cs.id, x: cs.x - 0.24, y: cs.y, rot: Math.PI, lean: -1 },
          { id: cs.id + '_R', sofaId: cs.id, x: cs.x + 0.24, y: cs.y, rot: Math.PI, lean: 1 },
        ],
      });
    });

    // Illusion wall concealing secret crypt passage at NE corner
    extraProps.push({ type: 'illusion_wall', x: 26.5, y: 3.5, rot: 0 });

    // Secret Passage to Casino: Hidden Crypt Trapdoor behind illusion wall (x: 27.5, y: 2.5)
    hotspots.push({
      id: 'secret_passage_halloween',
      type: 'secret_passage',
      target: 'casino',
      x: 27.5,
      y: 2.5,
      radius: 2.0,
      prompt: '⚰️ Quan Tài Hầm Ngầm Cổ · [E] Vào Mật Thất Casino',
    });

    // Secret Paper Notes (Code: toilagay, BoKho)
    hotspots.push(
      {
        id: 'note_gay_hw',
        type: 'secret_note',
        code: 'toilagay',
        x: 14.5,
        y: 12.8,
        radius: 1.6,
        prompt: '📌 Mảnh Giấy Bí Mật · [E] Đọc mật mã nhận 500 xu',
      },
      {
        id: 'note_bokho_hw',
        type: 'secret_note',
        code: 'BoKho',
        x: 18.5,
        y: 16.5,
        radius: 1.6,
        prompt: '📌 Mảnh Giấy Bí Mật · [E] Đọc mật mã nhận 500 xu',
      }
    );
  } else if (themeKey === 'tet') {
    // Centerpiece: Giant Golden Apricot Blossom Tree (Cây Mai Đại Thụ)
    hotspots.push({
      id: 'mai_tree',
      type: 'mai_tree',
      x: 14.5,
      y: 11.5,
      radius: 2.9,
      prompt: '🧧 Cây Mai Đại Thụ · [E] Hái Lộc Lì Xì (Cứ 15p mở 1 lần trong 5p - Mini Game Canh Nhịp)',
    });
    colliders.push({ x: 14.5, y: 11.5, r: 0.42 });

    // Dragon Summoning Altar (Đài Triệu Hồi Rồng Thần)
    hotspots.push({
      id: 'dragon_altar',
      type: 'dragon_altar',
      x: 10.5,
      y: 11.5,
      radius: 2.4,
      prompt: '🐉 Đài Triệu Hồi Rồng Thần · [E] Cưỡi Rồng Bay (30s) / Nhận Thử Thách Mở Khóa Skin',
    });
    colliders.push({ x: 10.5, y: 11.5, r: 0.4 });

    // Sacred Shrine of the 3 Star Gods: Phúc - Lộc - Thọ (Replaces left firecracker area)
    hotspots.push({
      id: 'phuc_loc_tho_shrine',
      type: 'phuc_loc_tho_shrine',
      x: 6.5,
      y: 14.5,
      radius: 2.8,
      prompt: '🏮 Điện Thờ Tam Đa Phúc - Lộc - Thọ · [E] Thắp Hương · Lạy Cầu May · Ngồi Đọc Kinh',
    });
    const shrineBackY = 13.78;
    [-1.2, -0.8, -0.4, 0, 0.4, 0.8, 1.2].forEach(dx => {
      colliders.push({ x: 6.5 + dx, y: shrineBackY, r: 0.42 });
    });
    [-1.25, 1.25].forEach(dx => {
      [14.0, 14.4, 14.8, 15.2].forEach(y => {
        colliders.push({ x: 6.5 + dx, y, r: 0.42 });
      });
    });
    [-1.25, -0.84, -0.43, 0.43, 0.84, 1.25].forEach(dx => {
      colliders.push({ x: 6.5 + dx, y: 15.18, r: 0.22 });
    });
    // Right Fireworks Launcher Machine & surrounding Small Firecracker Tables
    hotspots.push({
      id: 'fw_launcher_right',
      type: 'firework_launcher',
      x: 22.5,
      y: 14.5,
      radius: 2.1,
      prompt: '🎆 Máy Bắn Pháo Hoa · [E] Khởi động giàn phóng pháo hoa rực rỡ!',
    });
    colliders.push({ x: 22.5, y: 14.5, r: 0.22 });

    // 2 Small firecracker tables flanking right launcher
    [-1.9, 1.9].forEach((dx, ti) => {
      const tx = 22.5 + dx;
      const ty = 14.5;
      hotspots.push({
        id: `fw_launcher_right_table_${ti}`,
        type: 'firecracker_table',
        x: tx,
        y: ty,
        radius: 1.5,
        prompt: '🧨 Bàn Pháo Nổ Nhỏ · [E] Đốt pháo nổ lách tách vui xuân',
      });
      colliders.push({ x: tx, y: ty, r: 0.18 });
    });

    // 2 Festive Couple Sofas beside the firework plazas
    [
      { id: 'tet_sofa_right', x: 22.5, y: 17.5 },
    ].forEach(cs => {
      seats.push({
        id: cs.id,
        kind: 'couple',
        x: cs.x,
        y: cs.y,
        rot: Math.PI,
        slots: [
          { id: cs.id + '_L', sofaId: cs.id, x: cs.x - 0.24, y: cs.y, rot: Math.PI, lean: -1 },
          { id: cs.id + '_R', sofaId: cs.id, x: cs.x + 0.24, y: cs.y, rot: Math.PI, lean: 1 },
        ],
      });
    });
    // Illusion wall concealing secret passage at SW corner
    extraProps.push({ type: 'illusion_wall', x: 3.5, y: 18.5, rot: Math.PI / 2 });

    // Secret Passage to Casino: Imperial Screen behind illusion wall (x: 2.2, y: 18.5)
    hotspots.push({
      id: 'secret_passage_tet',
      type: 'secret_passage',
      target: 'casino',
      x: 2.2,
      y: 18.5,
      radius: 2.0,
      prompt: '🏮 Bức Bình Phong Kim Long · [E] Vào Mật Thất Casino',
    });

    // Secret Paper Notes (Code: Trung Legit, Chu0n6)
    hotspots.push(
      {
        id: 'note_trung_tet',
        type: 'secret_note',
        code: 'Trung Legit',
        x: 14.5,
        y: 12.3,
        radius: 1.6,
        prompt: '📌 Mảnh Giấy Bí Mật · [E] Đọc mật mã nhận 500 xu',
      },
      {
        id: 'note_chu0n6_tet',
        type: 'secret_note',
        code: 'Chu0n6',
        x: 22.5,
        y: 14.8,
        radius: 1.6,
        prompt: '📌 Mảnh Giấy Bí Mật · [E] Đọc mật mã nhận 500 xu',
      }
    );
  } else if (themeKey === 'valentine') {
    // Centerpiece: a glowing heart tree where visitors can compose love notes.
    hotspots.push({
      id: 'valentine_heart_tree',
      type: 'heart_tree',
      x: 14.5,
      y: 11.5,
      radius: 2.9,
      prompt: '💗 Cây Trái Tim · [E] Viết thiệp tình yêu và gửi lời thương',
    });
    colliders.push({ x: 14.5, y: 11.5, r: 0.42 });

    // Two wishing fountains make the garden wings feel like intimate date spots.
    [
      { id: 'love_fountain_left', x: 6.5, y: 14.5 },
      { id: 'love_fountain_right', x: 22.5, y: 14.5 },
    ].forEach(f => {
      hotspots.push({
        id: f.id,
        type: 'love_fountain',
        x: f.x,
        y: f.y,
        radius: 2.2,
        prompt: '⛲ Suối Nguyện Ước Tình Yêu · [E] Tung Đồng Xu Ước Nguyện & Nhận Ban Phúc',
      });
      colliders.push({ x: f.x, y: f.y, r: 0.26 });
    });

    // Rose arches frame the two garden entrances.
    extraProps.push(
      { type: 'rose_arch', x: 9.5, y: 9.6, rot: 0 },
      { type: 'rose_arch', x: 19.5, y: 9.6, rot: 0 }
    );
    [9.5, 19.5].forEach(ax => {
      colliders.push({ x: ax - 0.78, y: 9.6, r: 0.12 }, { x: ax + 0.78, y: 9.6, r: 0.12 });
    });

    // Couple sofas let visitors recline together beside each fountain.
    [
      { id: 'valentine_sofa_left', x: 8.6, y: 16.9 },
      { id: 'valentine_sofa_right', x: 20.4, y: 16.9 },
    ].forEach(cs => {
      seats.push({
        id: cs.id,
        kind: 'couple',
        x: cs.x,
        y: cs.y,
        rot: Math.PI,
        slots: [
          { id: cs.id + '_L', sofaId: cs.id, x: cs.x - 0.24, y: cs.y, rot: Math.PI, lean: -1, pose: 'recline' },
          { id: cs.id + '_R', sofaId: cs.id, x: cs.x + 0.24, y: cs.y, rot: Math.PI, lean: 1, pose: 'recline' },
        ],
      });
    });

    // Illusion wall concealing secret passage behind east rose garden (x: 26.5, y: 18.5)
    extraProps.push({ type: 'illusion_wall', x: 26.5, y: 18.5, rot: Math.PI / 2 });

    // Secret Passage to Casino: In hidden nook behind East Illusion Wall (x: 27.5, y: 18.5)
    hotspots.push({
      id: 'secret_passage_valentine',
      type: 'secret_passage',
      target: 'casino',
      x: 27.5,
      y: 18.5,
      radius: 2.0,
      prompt: '🌹 Thác Hoa Hồng Bí Ẩn · [E] Vào Mật Thất Casino',
    });

    // Secret Paper Notes (Code: BoKho, Raumania)
    hotspots.push(
      {
        id: 'note_bokho_val',
        type: 'secret_note',
        code: 'BoKho',
        x: 6.5,
        y: 14.8,
        radius: 1.6,
        prompt: '📌 Mảnh Giấy Bí Mật · [E] Đọc mật mã nhận 500 xu',
      },
      {
        id: 'note_raumania_val',
        type: 'secret_note',
        code: 'Raumania',
        x: 9.5,
        y: 9.8,
        radius: 1.6,
        prompt: '📌 Mảnh Giấy Bí Mật · [E] Đọc mật mã nhận 500 xu',
      }
    );
  } else if (themeKey === 'casino') {
    // 0. VIP Pub & Boutique Fashion Counter (Northwest Corner, Left of TV Screen, x=6.5, y=4.2)
    hotspots.push({
      id: 'casino_pub_shop',
      type: 'casino_pub',
      x: 6.5,
      y: 4.2,
      radius: 2.8,
      prompt: '🍸 Quầy Pub & Boutique VIP · [E] Mua Sắm Phụ Kiện, Hào Quang & Nametag',
    });
    colliders.push({ x: 6.5, y: 4.2, r: 1.4 });

    // 1. Roulette Table (West Plaza, x=7.0, y=11.5)
    hotspots.push({
      id: 'casino_roulette',
      type: 'roulette',
      x: 7.0,
      y: 11.5,
      radius: 2.4,
      prompt: '🎡 Vòng Quay Roulette · [E] Đặt cược & Quay bánh xe má hồng',
    });
    colliders.push({ x: 7.0, y: 11.5, r: 0.95 });

    // 2. Duck Derby Raceway (Central Plaza, x=14.5, y=12.0)
    hotspots.push({
      id: 'casino_duck_derby',
      type: 'duck_derby',
      x: 14.5,
      y: 12.0,
      radius: 3.2,
      prompt: '🦆 Đua Vịt Duck Derby · [E] Bắt đầu chặng đua kịch tính 4 chú vịt',
    });
    colliders.push({ x: 14.5, y: 12.0, r: 1.15 });

    // 3. Blackjack Table (East Plaza, x=22.0, y=11.5)
    hotspots.push({
      id: 'casino_blackjack',
      type: 'blackjack',
      x: 22.0,
      y: 11.5,
      radius: 2.4,
      prompt: '🃏 Bàn Xì Dách Blackjack · [E] Chia bài 21 điểm (Hit/Stand)',
    });
    colliders.push({ x: 22.0, y: 11.5, r: 0.95 });

    // Blackjack Barstools (3 seats)
    const bjSeats = [
      { id: 'casino_bj_seat_1', x: 21.25, y: 12.4 },
      { id: 'casino_bj_seat_2', x: 22.0, y: 12.65 },
      { id: 'casino_bj_seat_3', x: 22.75, y: 12.4 },
    ];
    bjSeats.forEach(s => {
      seats.push({
        id: s.id,
        kind: 'single',
        x: s.x,
        y: s.y,
        rot: Math.PI,
        slots: [{ id: `${s.id}_0`, x: s.x, y: s.y + 0.05, rot: Math.PI, lean: 0 }],
      });
    });

    // 4. Slot Machines (Southwest Plaza, x=7.0, y=17.5)
    hotspots.push({
      id: 'casino_slot_machine',
      type: 'slot_machine',
      x: 7.0,
      y: 17.5,
      radius: 2.2,
      prompt: '🎰 Máy Đánh Bạc Slot Machine · [E] Gạt cần quay Jackpot 777',
    });
    colliders.push({ x: 7.0, y: 17.5, r: 0.8 });

    // 5. Plinko Board (Southeast Plaza, x=22.0, y=17.5)
    hotspots.push({
      id: 'casino_plinko',
      type: 'plinko',
      x: 22.0,
      y: 17.5,
      radius: 2.2,
      prompt: '⚡ Tháp Đinh Plinko · [E] Thả bóng chông nảy 100x',
    });
    colliders.push({ x: 22.0, y: 17.5, r: 0.8 });

    // VIP Lounge Sofas in front of southern arcade
    [
      { id: 'casino_sofa_left', x: 11.0, y: 17.5 },
      { id: 'casino_sofa_right', x: 18.0, y: 17.5 },
    ].forEach(cs => {
      seats.push({
        id: cs.id,
        kind: 'couple',
        x: cs.x,
        y: cs.y,
        rot: Math.PI,
        slots: [
          { id: cs.id + '_L', sofaId: cs.id, x: cs.x - 0.24, y: cs.y, rot: Math.PI, lean: -1 },
          { id: cs.id + '_R', sofaId: cs.id, x: cs.x + 0.24, y: cs.y, rot: Math.PI, lean: 1 },
        ],
      });
    });

    // Secret Exit Door (South, x: 14.5, y: 19.5)
    hotspots.push({
      id: 'casino_exit_door',
      type: 'casino_exit',
      x: 14.5,
      y: 19.5,
      radius: 2.2,
      prompt: '🚪 Cửa Thoát Hiểm Bí Mật · [E] Trở về thế giới bên trên',
    });
  }

  return { hotspots, seats, colliders, extraProps };
}
