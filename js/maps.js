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
  for (let sx = 12; sx <= 17; sx += 1) colliders.push({ x: sx, y: 2.1, r: 0.65 });

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
      slots: [{ id: `${c.id}_0`, x: c.x, y: c.y, rot: Math.PI, lean: 0 }],
    });
  });

  // Couple Sofas (2 seats per sofa, players sitting together trigger Couple Heart mode!)
  const coupleSofas = [
    { id: 'couple_front', x: 14.5, y: 4.5 },
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
        { id: `${cs.id}_L`, sofaId: cs.id, x: cs.x - 0.24, y: cs.y, rot: Math.PI, lean: -1 },
        { id: `${cs.id}_R`, sofaId: cs.id, x: cs.x + 0.24, y: cs.y, rot: Math.PI, lean: 1 },
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
    colliders.push({ x: 14.5, y: 11.5, r: 1.15 });

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
      colliders.push({ x: tb.x, y: tb.y, r: 0.6 });
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
      colliders.push({ x: cf.x, y: cf.y, r: 0.55 });

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
        colliders.push({ x: jx, y: jy, r: 0.4 });
      }
    });
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
    colliders.push({ x: 14.5, y: 11.5, r: 1.25 });

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
      colliders.push({ x: bx, y: by, r: 0.42 });
    });
  } else if (themeKey === 'tet') {
    // Centerpiece: Giant Golden Apricot Blossom Tree (Cây Mai Đại Thụ)
    hotspots.push({
      id: 'mai_tree',
      type: 'mai_tree',
      x: 14.5,
      y: 11.5,
      radius: 2.9,
      prompt: '🧧 Cây Mai Đại Thụ · [E] Hái Bao Lì Xì (Ngẫu nhiên 1k–500k hoặc Câu chúc Tết)',
    });
    colliders.push({ x: 14.5, y: 11.5, r: 1.15 });

    // 2 Firework Launcher Machines & surrounding Small Firecracker Tables
    [
      { id: 'fw_launcher_left', x: 6.5, y: 14.5 },
      { id: 'fw_launcher_right', x: 22.5, y: 14.5 },
    ].forEach(fw => {
      hotspots.push({
        id: fw.id,
        type: 'firework_launcher',
        x: fw.x,
        y: fw.y,
        radius: 2.1,
        prompt: '🎆 Máy Bắn Pháo Hoa · [E] Khởi động giàn phóng pháo hoa rực rỡ!',
      });
      colliders.push({ x: fw.x, y: fw.y, r: 0.65 });

      // 2 Small firecracker tables flanking each launcher
      [-1.9, 1.9].forEach((dx, ti) => {
        const tx = fw.x + dx;
        const ty = fw.y;
        hotspots.push({
          id: `${fw.id}_table_${ti}`,
          type: 'firecracker_table',
          x: tx,
          y: ty,
          radius: 1.5,
          prompt: '🧨 Bàn Pháo Nổ Nhỏ · [E] Đốt pháo nổ lách tách vui xuân',
        });
        colliders.push({ x: tx, y: ty, r: 0.5 });
      });
    });
  }

  return { hotspots, seats, colliders, extraProps };
}
