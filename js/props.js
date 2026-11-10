// Procedural 3D models for themes, interactive stations, seats, ornaments, pumpkins, and NPCs.
import * as THREE from 'three';
import { PUMPKIN_HATS, ORNAMENTS, COSTUMES } from './themes.js';

const geoCache = new Map(), matCache = new Map(), texCache = new Map();
export const geo = (key, make) => { if (!geoCache.has(key)) geoCache.set(key, make()); return geoCache.get(key); };
export const mat = (color, opts = {}) => {
  const k = color + JSON.stringify(opts);
  if (!matCache.has(k)) matCache.set(k, new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.05, ...opts }));
  return matCache.get(k);
};

export const G = {
  sph: () => geo('sph', () => new THREE.SphereGeometry(0.5, 16, 12)),
  cyl: () => geo('cyl', () => new THREE.CylinderGeometry(0.5, 0.5, 1, 14)),
  cone: () => geo('cone', () => new THREE.ConeGeometry(0.5, 1, 14)),
  box: () => geo('box', () => new THREE.BoxGeometry(1, 1, 1)),
  oct: () => geo('oct', () => new THREE.OctahedronGeometry(0.5)),
  torus: () => geo('torus', () => new THREE.TorusGeometry(0.35, 0.1, 10, 20)),
};

export function part(parent, g, material, pos = [0, 0, 0], scale = [1, 1, 1], rot) {
  const o = new THREE.Mesh(g, material);
  o.position.set(...pos);
  o.scale.set(...scale);
  if (rot) o.rotation.set(...rot);
  o.castShadow = true;
  o.receiveShadow = true;
  parent.add(o);
  return o;
}

export function labelSprite(text, bg = 'rgba(15, 20, 35, 0.82)', fg = '#ffffff', worldH = 0.42) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 96;
  const x = c.getContext('2d');
  x.font = 'bold 34px system-ui, -apple-system, sans-serif';
  x.fillStyle = bg;
  x.beginPath();
  x.roundRect(16, 12, 480, 72, 22);
  x.fill();
  x.strokeStyle = 'rgba(255,255,255,0.28)';
  x.lineWidth = 3;
  x.stroke();
  x.fillStyle = fg;
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText(text, 256, 49, 450);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false }));
  s.scale.set(worldH * (c.width / c.height), worldH, 1);
  s.renderOrder = 8;
  return s;
}

export function emojiTexture(e) {
  if (!texCache.has(e)) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d');
    x.font = '96px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",serif';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(e, 64, 70);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    texCache.set(e, t);
  }
  return texCache.get(e);
}

export function emojiSprite(e, size = 1) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTexture(e), transparent: true, depthWrite: false }));
  s.scale.set(size, size, 1);
  return s;
}

// ============================================================================
// CARVED PUMPKINS (6 face styles, used on Halloween map & wearable hat)
// ============================================================================
export function buildCarvedPumpkin(styleKey = 'classic', scale = 1) {
  const cfg = PUMPKIN_HATS[styleKey] || PUMPKIN_HATS.classic;
  const g = new THREE.Group();
  const bodyMat = mat('#ff7300', { emissive: '#ff4500', emissiveIntensity: 0.28, roughness: 0.65 });
  const glowMat = mat(cfg.glow, { emissive: cfg.glow, emissiveIntensity: 1.6, roughness: 0.2 });

  // Ribbed pumpkin body
  part(g, G.sph(), bodyMat, [0, 0.36, 0], [0.82, 0.72, 0.82]);
  part(g, G.sph(), bodyMat, [0, 0.36, 0], [0.86, 0.68, 0.72]);
  part(g, G.sph(), bodyMat, [0, 0.36, 0], [0.72, 0.68, 0.86]);
  // Stem
  part(g, G.cyl(), mat('#2d5a27'), [0, 0.75, 0], [0.11, 0.18, 0.11], [0, 0, 0.15]);

  // Eyes based on styleKey
  if (cfg.eyeType === 'cyclops') {
    part(g, G.sph(), glowMat, [0, 0.45, 0.39], [0.22, 0.22, 0.06]);
  } else if (cfg.eyeType === 'slant') {
    part(g, G.box(), glowMat, [-0.16, 0.44, 0.38], [0.16, 0.08, 0.06], [0, 0, -0.35]);
    part(g, G.box(), glowMat, [0.16, 0.44, 0.38], [0.16, 0.08, 0.06], [0, 0, 0.35]);
  } else if (cfg.eyeType === 'round') {
    part(g, G.sph(), glowMat, [-0.15, 0.44, 0.38], [0.15, 0.16, 0.06]);
    part(g, G.sph(), glowMat, [0.15, 0.44, 0.38], [0.15, 0.16, 0.06]);
  } else if (cfg.eyeType === 'cat') {
    part(g, G.cone(), glowMat, [-0.16, 0.45, 0.38], [0.15, 0.16, 0.06], [0, 0, 0.25]);
    part(g, G.cone(), glowMat, [0.16, 0.45, 0.38], [0.15, 0.16, 0.06], [0, 0, -0.25]);
    // Cat ears on pumpkin
    part(g, G.cone(), bodyMat, [-0.24, 0.72, 0], [0.2, 0.24, 0.15], [0, 0, 0.3]);
    part(g, G.cone(), bodyMat, [0.24, 0.72, 0], [0.2, 0.24, 0.15], [0, 0, -0.3]);
  } else {
    // triangle / arc
    part(g, G.cone(), glowMat, [-0.15, 0.44, 0.38], [0.15, 0.15, 0.06]);
    part(g, G.cone(), glowMat, [0.15, 0.44, 0.38], [0.15, 0.15, 0.06]);
  }

  // Mouth based on styleKey
  if (cfg.mouthType === 'o') {
    part(g, G.sph(), glowMat, [0, 0.24, 0.39], [0.18, 0.2, 0.06]);
  } else if (cfg.mouthType === 'jagged') {
    for (let i = -2; i <= 2; i++) {
      part(g, G.box(), glowMat, [i * 0.08, 0.24 + (Math.abs(i) % 2) * 0.03, 0.39], [0.09, 0.08, 0.06], [0, 0, i * 0.15]);
    }
  } else {
    part(g, G.box(), glowMat, [0, 0.23, 0.39], [0.34, 0.09, 0.06]);
    part(g, G.box(), glowMat, [-0.19, 0.27, 0.37], [0.09, 0.09, 0.06], [0, 0, 0.4]);
    part(g, G.box(), glowMat, [0.19, 0.27, 0.37], [0.09, 0.09, 0.06], [0, 0, -0.4]);
  }

  g.scale.setScalar(scale);
  return g;
}

// ============================================================================
// CHRISTMAS ORNAMENTS & CENTERPIECE TREE
// ============================================================================
export function buildOrnamentMesh(ornKey = 'ball_red', scale = 1) {
  const cfg = ORNAMENTS.find(o => o.key === ornKey) || ORNAMENTS[0];
  const g = new THREE.Group();
  const m = mat(cfg.color, { emissive: cfg.color, emissiveIntensity: 0.45, metalness: 0.35, roughness: 0.3 });
  if (cfg.shape === 'star') {
    part(g, G.oct(), m, [0, 0, 0], [0.38, 0.38, 0.18]);
  } else if (cfg.shape === 'bell') {
    part(g, G.cone(), m, [0, 0.02, 0], [0.32, 0.34, 0.32]);
    part(g, G.sph(), mat('#ffffff'), [0, -0.15, 0], [0.12, 0.12, 0.12]);
  } else if (cfg.shape === 'cane') {
    part(g, G.cyl(), m, [0, 0, 0], [0.09, 0.36, 0.09]);
    part(g, G.sph(), mat('#ffffff'), [0.06, 0.16, 0], [0.14, 0.1, 0.1]);
  } else if (cfg.shape === 'gift') {
    part(g, G.box(), m, [0, 0, 0], [0.28, 0.28, 0.28]);
    part(g, G.box(), mat('#ffd166'), [0, 0, 0], [0.3, 0.08, 0.3]);
  } else {
    part(g, G.sph(), m, [0, 0, 0], [0.3, 0.3, 0.3]);
    part(g, G.cyl(), mat('#ffd166'), [0, 0.16, 0], [0.08, 0.06, 0.08]);
  }
  g.scale.setScalar(scale);
  return g;
}

export function buildGiantChristmasTree() {
  const g = new THREE.Group();
  // Pedestal base
  part(g, G.cyl(), mat('#8c2d19'), [0, 0.25, 0], [2.2, 0.5, 2.2]);
  part(g, G.cyl(), mat('#d4af37', { metalness: 0.5 }), [0, 0.52, 0], [2.3, 0.08, 2.3]);
  // Trunk
  part(g, G.cyl(), mat('#4a2c11'), [0, 1.4, 0], [0.85, 2.4, 0.85]);

  // 4 lush pine tiers with snow rims
  const tiers = [
    { y: 2.3, r: 3.4, h: 2.2, c: '#14532d' },
    { y: 3.7, r: 2.75, h: 2.0, c: '#1b6b3a' },
    { y: 4.9, r: 2.05, h: 1.75, c: '#155d31' },
    { y: 5.95, r: 1.3, h: 1.45, c: '#1f7a42' },
  ];
  const slots = [];
  tiers.forEach((t, ti) => {
    part(g, G.cone(), mat(t.c), [0, t.y, 0], [t.r, t.h, t.r]);
    // Snow ring on bottom of each cone
    part(g, G.cyl(), mat('#f1f5f9'), [0, t.y - t.h * 0.45, 0], [t.r * 0.96, 0.14, t.r * 0.96]);

    // Precompute ornament attachment slots around each tier
    const count = 8 - ti;
    const slotY = t.y - t.h * 0.25;
    const slotR = t.r * 0.43;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + ti * 0.4;
      slots.push([Math.cos(a) * slotR, slotY, Math.sin(a) * slotR]);
    }
  });

  // Hanging red Christmas Stockings (Tất Giáng sinh) around lower tier for stuffing cards!
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.25;
    const sx = Math.cos(a) * 1.72, sz = Math.sin(a) * 1.72;
    const st = new THREE.Group();
    part(st, G.box(), mat('#ffffff'), [0, 0.18, 0], [0.18, 0.1, 0.14]);
    part(st, G.box(), mat('#d62828'), [0, 0.0, 0], [0.16, 0.28, 0.12]);
    part(st, G.box(), mat('#d62828'), [0.07, -0.1, 0], [0.22, 0.12, 0.12]);
    st.position.set(sx, 1.45, sz);
    st.rotation.y = -a + Math.PI / 2;
    g.add(st);
  }

  // Giant glowing Star on top
  const star = part(g, G.oct(), mat('#ffd60a', { emissive: '#ffd60a', emissiveIntensity: 1.8 }), [0, 6.95, 0], [0.85, 0.85, 0.35]);
  star.userData.spin = true;

  const light = new THREE.PointLight('#ffd166', 3.5, 14);
  light.position.set(0, 4.5, 0);
  g.add(light);

  const lbl = labelSprite('🎄 Cây Thông Lớn · [E] Treo đồ / Bỏ thiệp vào tất', 'rgba(20,83,45,0.88)', '#fef08a', 0.48);
  lbl.position.set(0, 7.75, 0);
  g.add(lbl);

  return { group: g, slots };
}

export function buildOrnamentTable() {
  const g = new THREE.Group();
  // Table legs & top
  part(g, G.box(), mat('#5c3a21'), [0, 0.42, 0], [1.7, 0.84, 1.0]);
  // Festive red tablecloth
  part(g, G.box(), mat('#b3202a'), [0, 0.86, 0], [1.82, 0.12, 1.12]);
  part(g, G.box(), mat('#ffd166'), [0, 0.87, 0], [1.84, 0.04, 1.14]);
  // Sample ornaments on top of the table
  ORNAMENTS.slice(0, 5).forEach((o, i) => {
    const m = buildOrnamentMesh(o.key, 0.9);
    m.position.set((i - 2) * 0.34, 1.06, (i % 2 === 0 ? -0.15 : 0.15));
    g.add(m);
  });
  const lbl = labelSprite('🎁 Bàn Đồ Trang Trí · [E] Nhặt đồ treo cây', 'rgba(179,32,42,0.88)', '#ffffff', 0.38);
  lbl.position.set(0, 1.75, 0);
  g.add(lbl);
  return g;
}

export function buildCampfire() {
  const g = new THREE.Group();
  // Stone ring
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    part(g, G.sph(), mat('#64748b'), [Math.cos(a) * 0.72, 0.12, Math.sin(a) * 0.72], [0.32, 0.24, 0.32]);
  }
  // Crossed wood logs in fire
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI;
    part(g, G.cyl(), mat('#4a2c11'), [0, 0.16, 0], [0.18, 1.15, 0.18], [Math.PI / 2, a, 0]);
  }
  // Flames
  const f1 = part(g, G.cone(), mat('#ff5400', { emissive: '#ff5400', emissiveIntensity: 2.0 }), [0, 0.55, 0], [0.65, 0.9, 0.65]);
  const f2 = part(g, G.cone(), mat('#ffb703', { emissive: '#ffb703', emissiveIntensity: 2.2 }), [0.08, 0.48, -0.05], [0.42, 0.65, 0.42]);
  g.userData.flames = [f1, f2];

  const light = new THREE.PointLight('#ff7b00', 4.5, 11);
  light.position.set(0, 1.1, 0);
  g.add(light);

  const lbl = labelSprite('🔥 Lửa Trại · [E] Nướng Marshmallow / Uống Ca Cao', 'rgba(154,52,18,0.88)', '#ffedd5', 0.38);
  lbl.position.set(0, 1.9, 0);
  g.add(lbl);
  return g;
}

export function buildLogSeat(rotY = 0) {
  const g = new THREE.Group();
  part(g, G.cyl(), mat('#5c3a21'), [0, 0.26, 0], [0.42, 1.5, 0.42], [0, 0, Math.PI / 2]);
  part(g, G.cyl(), mat('#d6b88e'), [-0.76, 0.26, 0], [0.38, 0.04, 0.38], [0, 0, Math.PI / 2]);
  part(g, G.cyl(), mat('#d6b88e'), [0.76, 0.26, 0], [0.38, 0.04, 0.38], [0, 0, Math.PI / 2]);
  g.rotation.y = rotY;
  return g;
}

export function buildSnowman(variant = 0) {
  const g = new THREE.Group();
  const w = mat('#f8fafc');
  const scarfCols = ['#e63946', '#2a9d8f', '#f4a261', '#8338ec'];
  const sc = scarfCols[variant % scarfCols.length];
  part(g, G.sph(), w, [0, 0.42, 0], [0.85, 0.82, 0.85]);
  part(g, G.sph(), w, [0, 1.02, 0], [0.6, 0.58, 0.6]);
  part(g, G.sph(), w, [0, 1.48, 0], [0.42, 0.42, 0.42]);
  // Scarf
  part(g, G.cyl(), mat(sc), [0, 1.28, 0], [0.46, 0.1, 0.46]);
  part(g, G.box(), mat(sc), [0.16, 1.12, 0.2], [0.1, 0.28, 0.06]);
  // Carrot nose & eyes
  part(g, G.cone(), mat('#fb8500'), [0, 1.48, 0.26], [0.09, 0.28, 0.09], [Math.PI / 2, 0, 0]);
  part(g, G.sph(), mat('#111'), [-0.08, 1.54, 0.19], [0.06, 0.06, 0.06]);
  part(g, G.sph(), mat('#111'), [0.08, 1.54, 0.19], [0.06, 0.06, 0.06]);
  // Top hat
  part(g, G.cyl(), mat('#1e293b'), [0, 1.7, 0], [0.45, 0.05, 0.45]);
  part(g, G.cyl(), mat('#1e293b'), [0, 1.88, 0], [0.28, 0.32, 0.28]);
  return g;
}

// ============================================================================
// HALLOWEEN CENTERPIECE, COSTUME BOOTHS & FLYING VAMPIRE NPC
// ============================================================================
export function buildGiantPumpkin() {
  const g = new THREE.Group();
  // Dark gothic pedestal
  part(g, G.cyl(), mat('#261c35'), [0, 0.3, 0], [3.2, 0.6, 3.2]);
  part(g, G.cyl(), mat('#3c2a52'), [0, 0.65, 0], [2.7, 0.2, 2.7]);
  const big = buildCarvedPumpkin('evil', 3.4);
  big.position.y = 0.65;
  g.add(big);

  const light = new THREE.PointLight('#ff6d00', 5.0, 16);
  light.position.set(0, 2.8, 0);
  g.add(light);

  const lbl = labelSprite('🎃 Đại Bí Ngô Halloween · Xung quanh có Bí Ngô nhỏ để đội lên đầu!', 'rgba(59,20,84,0.9)', '#ffb703', 0.48);
  lbl.position.set(0, 4.3, 0);
  g.add(lbl);
  return g;
}

export function buildCostumeBooth(costumeKey) {
  const cfg = COSTUMES[costumeKey] || COSTUMES.default;
  const g = new THREE.Group();
  // Pedestal + arch
  part(g, G.cyl(), mat('#311b47'), [0, 0.12, 0], [1.1, 0.24, 1.1]);
  part(g, G.cyl(), mat('#f77f00', { emissive: '#f77f00', emissiveIntensity: 0.4 }), [0, 0.25, 0], [1.14, 0.04, 1.14]);
  // Mini mannequin preview
  part(g, G.box(), mat(cfg.shirt || '#4a69bd'), [0, 0.78, 0], [0.42, 0.52, 0.24]);
  part(g, G.sph(), mat(cfg.skin), [0, 1.24, 0], [0.34, 0.34, 0.34]);
  if (cfg.witchHat) {
    part(g, G.cyl(), mat('#19103b'), [0, 1.42, 0], [0.55, 0.04, 0.55]);
    part(g, G.cone(), mat('#19103b'), [0, 1.62, 0], [0.3, 0.42, 0.3]);
  } else if (cfg.cape) {
    part(g, G.box(), mat(cfg.cape), [0, 0.78, -0.15], [0.52, 0.68, 0.05]);
  } else if (cfg.bolts) {
    part(g, G.cyl(), mat('#95a5a6'), [0, 1.2, 0], [0.06, 0.48, 0.06], [0, 0, Math.PI / 2]);
  }
  const lbl = labelSprite(`${cfg.name} · [E] Mặc`, 'rgba(40,18,68,0.9)', '#fde047', 0.34);
  lbl.position.set(0, 1.95, 0);
  g.add(lbl);
  return g;
}

export function buildVampireNPC() {
  const g = new THREE.Group();
  // Torso & cloak
  part(g, G.box(), mat('#14141f'), [0, 0.9, 0], [0.48, 0.65, 0.26]);
  part(g, G.box(), mat('#b31217'), [0, 0.85, -0.16], [0.68, 0.85, 0.05], [0.15, 0, 0]);
  // High vampire collar
  part(g, G.cone(), mat('#b31217'), [0, 1.32, -0.08], [0.52, 0.32, 0.28], [Math.PI, 0, 0]);
  // Head & glowing red eyes
  part(g, G.sph(), mat('#f1f2f6'), [0, 1.42, 0], [0.42, 0.44, 0.42]);
  part(g, G.sph(), mat('#ff0033', { emissive: '#ff0033', emissiveIntensity: 2 }), [-0.09, 1.45, 0.19], [0.07, 0.05, 0.05]);
  part(g, G.sph(), mat('#ff0033', { emissive: '#ff0033', emissiveIntensity: 2 }), [0.09, 1.45, 0.19], [0.07, 0.05, 0.05]);

  // Articulated Bat Wings
  const leftWing = new THREE.Group();
  leftWing.position.set(-0.24, 1.1, -0.1);
  part(leftWing, G.box(), mat('#1e1b2e'), [-0.45, 0, 0], [0.9, 0.42, 0.04], [0, 0, 0.15]);
  g.add(leftWing);

  const rightWing = new THREE.Group();
  rightWing.position.set(0.24, 1.1, -0.1);
  part(rightWing, G.box(), mat('#1e1b2e'), [0.45, 0, 0], [0.9, 0.42, 0.04], [0, 0, -0.15]);
  g.add(rightWing);

  const lbl = labelSprite('🧛 Bá Tước Ma Cà Rồng', 'rgba(127,29,29,0.9)', '#fecaca', 0.36);
  lbl.position.set(0, 2.05, 0);
  g.add(lbl);

  g.userData.leftWing = leftWing;
  g.userData.rightWing = rightWing;
  return g;
}

// ============================================================================
// TET CENTERPIECE (GIANT MAI TREE WITH BAO LI XI) & FIREWORKS ZONE
// ============================================================================
export function buildGiantMaiTree() {
  const g = new THREE.Group();
  // Festive red/gold octagonal pot base
  part(g, G.cyl(), mat('#9b111e'), [0, 0.4, 0], [2.4, 0.8, 2.4]);
  part(g, G.cyl(), mat('#ffd166', { metalness: 0.4 }), [0, 0.82, 0], [2.52, 0.1, 2.52]);

  // Gnarled brown trunk & main branches
  const trunkMat = mat('#5c3a1e');
  part(g, G.cyl(), trunkMat, [0, 2.1, 0], [0.75, 2.8, 0.75]);
  const branchCoords = [
    { pos: [0.9, 3.3, 0.4], rot: [0.2, 0, -0.6], s: [0.35, 2.0, 0.35] },
    { pos: [-0.9, 3.4, -0.3], rot: [-0.2, 0, 0.6], s: [0.35, 2.0, 0.35] },
    { pos: [0.3, 3.5, -0.9], rot: [-0.6, 0, -0.2], s: [0.32, 1.9, 0.32] },
    { pos: [-0.3, 3.4, 0.9], rot: [0.6, 0, 0.2], s: [0.32, 1.9, 0.32] },
  ];
  branchCoords.forEach(b => part(g, G.cyl(), trunkMat, b.pos, b.s, b.rot));

  // Golden Apricot Blossom clusters (Hoa Mai Vàng)
  const yellowMat = mat('#ffd60a', { emissive: '#ffb703', emissiveIntensity: 0.35 });
  const blossomClusters = [
    [0, 5.1, 0, 2.2],
    [1.5, 4.1, 0.7, 1.65],
    [-1.5, 4.2, -0.6, 1.65],
    [0.6, 4.3, -1.5, 1.6],
    [-0.6, 4.1, 1.5, 1.6],
    [1.2, 4.6, -1.1, 1.4],
    [-1.2, 4.5, 1.1, 1.4],
  ];
  blossomClusters.forEach(([x, y, z, r]) => {
    part(g, G.sph(), yellowMat, [x, y, z], [r, r * 0.72, r]);
  });

  // Hanging Red Envelopes (Bao lì xì 🧧) around the canopy
  const envelopes = [];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const rad = i % 2 === 0 ? 1.85 : 1.35;
    const y = i % 2 === 0 ? 3.25 : 4.15;
    const env = new THREE.Group();
    part(env, G.cyl(), mat('#ffd166'), [0, 0.18, 0], [0.02, 0.2, 0.02]);
    part(env, G.box(), mat('#d90429', { emissive: '#9b0000', emissiveIntensity: 0.45 }), [0, -0.05, 0], [0.24, 0.36, 0.04]);
    part(env, G.box(), mat('#ffd166'), [0, -0.04, 0.025], [0.12, 0.12, 0.02]);
    env.position.set(Math.cos(a) * rad, y, Math.sin(a) * rad);
    env.rotation.y = -a;
    g.add(env);
    envelopes.push(env);
  }
  g.userData.envelopes = envelopes;

  const light = new THREE.PointLight('#ffd166', 4.0, 15);
  light.position.set(0, 4.5, 0);
  g.add(light);

  const lbl = labelSprite('🌸 Cây Mai Đại Thụ · [E] Hái Bao Lì Xì Đầu Năm 🧧', 'rgba(185,28,28,0.9)', '#fef08a', 0.48);
  lbl.position.set(0, 6.6, 0);
  g.add(lbl);
  return g;
}

export function buildFireworkLauncher() {
  const g = new THREE.Group();
  // Base platform
  part(g, G.box(), mat('#780000'), [0, 0.15, 0], [1.6, 0.3, 1.6]);
  part(g, G.box(), mat('#ffb703'), [0, 0.32, 0], [1.3, 0.08, 1.3]);
  // 9 Launch mortar tubes
  for (let x = -1; x <= 1; x++) {
    for (let z = -1; z <= 1; z++) {
      part(g, G.cyl(), mat('#d62828', { metalness: 0.3 }), [x * 0.32, 0.72, z * 0.32], [0.22, 0.75, 0.22]);
      part(g, G.cyl(), mat('#ffd166'), [x * 0.32, 1.1, z * 0.32], [0.24, 0.05, 0.24]);
    }
  }
  const lbl = labelSprite('🎆 Máy Bắn Pháo Hoa · [E] Khởi động giàn phóng!', 'rgba(185,28,28,0.9)', '#fde047', 0.38);
  lbl.position.set(0, 1.85, 0);
  g.add(lbl);
  return g;
}

export function buildFirecrackerTable() {
  const g = new THREE.Group();
  part(g, G.box(), mat('#5c3a21'), [0, 0.42, 0], [1.4, 0.84, 0.9]);
  part(g, G.box(), mat('#c1121f'), [0, 0.86, 0], [1.5, 0.08, 1.0]);
  // Small red firecrackers on top
  for (let i = -2; i <= 2; i++) {
    part(g, G.cyl(), mat('#e63946'), [i * 0.22, 1.0, (i % 2) * 0.12], [0.1, 0.26, 0.1]);
    part(g, G.cyl(), mat('#ffd166'), [i * 0.22, 1.14, (i % 2) * 0.12], [0.11, 0.03, 0.11]);
  }
  const lbl = labelSprite('🧨 Bàn Pháo Nổ Nhỏ · [E] Đốt pháo tép', 'rgba(153,27,27,0.88)', '#fef08a', 0.34);
  lbl.position.set(0, 1.65, 0);
  g.add(lbl);
  return g;
}

// ============================================================================
// CINEMA SCREEN, SINGLE CHAIRS & COUPLE SOFAS
// ============================================================================
export function buildSingleChair() {
  const g = new THREE.Group();
  const c = mat('#3b82f6');
  part(g, G.box(), c, [0, 0.25, 0], [0.78, 0.24, 0.74]);
  part(g, G.box(), c, [0, 0.58, 0.28], [0.78, 0.56, 0.16]);
  part(g, G.box(), mat('#1e3a8a'), [-0.36, 0.38, 0], [0.12, 0.3, 0.74]);
  part(g, G.box(), mat('#1e3a8a'), [0.36, 0.38, 0], [0.12, 0.3, 0.74]);
  return g;
}

export function buildCoupleSofa() {
  const g = new THREE.Group();
  const pink = mat('#e11d48');
  const trim = mat('#fda4af');
  // Wide 2-person seat
  part(g, G.box(), pink, [0, 0.26, 0], [1.68, 0.26, 0.82]);
  part(g, G.box(), pink, [0, 0.64, 0.32], [1.68, 0.62, 0.18]);
  part(g, G.box(), trim, [-0.82, 0.42, 0], [0.14, 0.36, 0.82]);
  part(g, G.box(), trim, [0.82, 0.42, 0], [0.14, 0.36, 0.82]);
  // Cute heart accent in the center of the backrest
  part(g, G.sph(), trim, [-0.08, 0.85, 0.24], [0.18, 0.18, 0.1]);
  part(g, G.sph(), trim, [0.08, 0.85, 0.24], [0.18, 0.18, 0.1]);
  const lbl = labelSprite('💑 Ghế Couple · [E] Ngồi bắt cặp', 'rgba(190,18,60,0.88)', '#ffe4e6', 0.3);
  lbl.position.set(0, 1.35, 0);
  g.add(lbl);
  return g;
}

export function buildCinemaScreen() {
  const g = new THREE.Group();
  // Stage platform & frame
  part(g, G.box(), mat('#1e293b'), [0, 0.25, 0], [12.5, 0.5, 2.2]);
  part(g, G.box(), mat('#0f172a'), [0, 3.2, 0], [11.6, 5.4, 0.45]);
  part(g, G.box(), mat('#38bdf8', { emissive: '#0284c7', emissiveIntensity: 0.9 }), [0, 3.2, 0.02], [11.8, 5.6, 0.35]);

  // Overhead LED Marquee Board above the screen (shows current video owner & queue count while video plays on screen!)
  part(g, G.box(), mat('#0f172a'), [0, 6.45, 0.05], [11.6, 0.85, 0.3]);
  const topCanvas = document.createElement('canvas');
  topCanvas.width = 1024;
  topCanvas.height = 96;
  const topTex = new THREE.CanvasTexture(topCanvas);
  topTex.colorSpace = THREE.SRGBColorSpace;
  const topMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(11.3, 0.72),
    new THREE.MeshBasicMaterial({ map: topTex })
  );
  topMesh.position.set(0, 6.45, 0.22);
  g.add(topMesh);

  // Dynamic Canvas Texture on the 3D Screen face (visible when idle)
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const bannerMat = new THREE.MeshBasicMaterial({ map: tex });

  // Depth-buffered transparent punch-out material so 3D characters in front of the screen occlude the video!
  const holeMat = new THREE.ShaderMaterial({
    vertexShader: `void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `void main() { gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0); }`,
    blending: THREE.NoBlending,
    depthTest: true,
    depthWrite: true,
  });

  const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(11.1, 4.9), bannerMat);
  screenMesh.position.set(0, 3.2, 0.27);
  screenMesh.renderOrder = 1;
  g.add(screenMesh);

  g.userData.setHoleMode = active => {
    const want = active ? holeMat : bannerMat;
    if (screenMesh.material !== want) screenMesh.material = want;
  };

  function updateBanner(mediaCurrent, queue = []) {
    // 1. Update Overhead LED Marquee
    const tctx = topCanvas.getContext('2d');
    tctx.fillStyle = '#090d16';
    tctx.fillRect(0, 0, 1024, 96);
    tctx.strokeStyle = '#38bdf8';
    tctx.lineWidth = 4;
    tctx.strokeRect(4, 4, 1016, 88);
    tctx.font = 'bold 30px system-ui, sans-serif';
    tctx.textAlign = 'center';
    tctx.textBaseline = 'middle';
    if (mediaCurrent && (mediaCurrent.vid || mediaCurrent.url || mediaCurrent.kind === 'screen')) {
      tctx.fillStyle = '#4ade80';
      const label =
        mediaCurrent.kind === 'screen'
          ? `🖥️ Đang chiếu Màn hình máy tính: ${mediaCurrent.title || 'Screen Share'}`
          : mediaCurrent.kind === 'web'
          ? '🌐 ' + (mediaCurrent.title || 'Trang web')
          : mediaCurrent.vid;
      tctx.fillText(
        `▶ Đang phát: ${label}  ·  Người chiếu: ${mediaCurrent.addedByName || 'Ẩn danh'}  ·  📋 Hàng chờ: ${queue.length}`,
        512,
        48
      );
    } else {
      tctx.fillStyle = '#38bdf8';
      tctx.fillText('🎬 RẠP CHIẾU YOUTUBE & MÀN HÌNH CHUNG  ·  Nhấn [E] hoặc [P] để chiếu màn hình/video lên TV!', 512, 48);
    }
    topTex.needsUpdate = true;

    // 2. Update Main Screen Idle Backdrop
    const ctx = canvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, '#090d16');
    grad.addColorStop(1, '#111c33');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 512);

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 6;
    ctx.strokeRect(18, 18, 988, 476);

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 42px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🎬 RẠP CHIẾU YOUTUBE & MÀN HÌNH CHUNG', 512, 85);

    if (mediaCurrent && (mediaCurrent.vid || mediaCurrent.url || mediaCurrent.kind === 'screen')) {
      ctx.fillStyle = '#4ade80';
      ctx.font = 'bold 34px system-ui, sans-serif';
      const title =
        mediaCurrent.kind === 'screen'
          ? `🖥️ Màn hình đang chiếu: ${mediaCurrent.title || 'Screen Share'}`
          : mediaCurrent.title || mediaCurrent.vid;
      ctx.fillText(`▶ Đang chiếu: ${title}`, 512, 175);
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '28px system-ui, sans-serif';
      const roleText =
        mediaCurrent.kind === 'screen'
          ? `Người chia sẻ: ${mediaCurrent.addedByName || 'Ẩn danh'} (Nhấn [P] để dừng)`
          : `Người thêm: ${mediaCurrent.addedByName || 'Ẩn danh'} (Có quyền Skip ⏭)`;
      ctx.fillText(roleText, 512, 230);
    } else {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '32px system-ui, sans-serif';
      ctx.fillText('TV đang trống', 512, 190);
      ctx.font = '26px system-ui, sans-serif';
      ctx.fillText('Nhấn [P] để chia sẻ màn hình máy tính hoặc [E] để thêm YouTube/Website!', 512, 240);
    }

    // Queue list
    ctx.fillStyle = '#facc15';
    ctx.font = 'bold 28px system-ui, sans-serif';
    ctx.fillText(`📋 Hàng chờ tiếp theo (${queue.length} video):`, 512, 315);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '24px system-ui, sans-serif';
    if (!queue.length) {
      ctx.fillText('Hàng chờ đang trống — Thêm video để nối tiếp!', 512, 365);
    } else {
      queue.slice(0, 3).forEach((item, idx) => {
        ctx.fillText(`${idx + 1}. Video [${item.vid}] — thêm bởi ${item.addedByName}`, 512, 360 + idx * 36);
      });
    }
    tex.needsUpdate = true;
  }

  updateBanner(null, []);
  g.userData.updateBanner = updateBanner;
  return g;
}

// ============================================================================
// STANDARD DECOR PROPS & TREES
// ============================================================================
const B = {
  '🎃': g => g.add(buildCarvedPumpkin('classic', 1)),
  '👻': g => {
    part(g, G.sph(), mat('#f4f4ff', { emissive: '#aab', emissiveIntensity: 0.4 }), [0, 0.8, 0], [0.8, 0.9, 0.8]);
    part(g, G.cone(), mat('#f4f4ff', { emissive: '#aab', emissiveIntensity: 0.4 }), [0, 0.35, 0], [0.8, 0.7, 0.8], [Math.PI, 0, 0]);
    part(g, G.sph(), mat('#111'), [-0.15, 0.9, 0.33], [0.1, 0.14, 0.1]);
    part(g, G.sph(), mat('#111'), [0.15, 0.9, 0.33], [0.1, 0.14, 0.1]);
  },
  '💀': g => {
    part(g, G.sph(), mat('#eee'), [0, 0.5, 0], [0.7, 0.7, 0.7]);
    part(g, G.box(), mat('#eee'), [0, 0.2, 0.05], [0.4, 0.25, 0.4]);
    part(g, G.sph(), mat('#111'), [-0.14, 0.55, 0.3], [0.16, 0.2, 0.1]);
    part(g, G.sph(), mat('#111'), [0.14, 0.55, 0.3], [0.16, 0.2, 0.1]);
  },
  '🎄': g => smallPine(g, '#1f6b34', '#0f4d23', true),
  '🎁': g => {
    const c = ['#c1121f', '#1b7f3b', '#1d4ed8'][Math.floor(Math.random() * 3)];
    part(g, G.box(), mat(c), [0, 0.3, 0], [0.6, 0.6, 0.6]);
    part(g, G.box(), mat('#ffd166'), [0, 0.3, 0], [0.64, 0.12, 0.64]);
    part(g, G.box(), mat('#ffd166'), [0, 0.3, 0], [0.12, 0.64, 0.64]);
  },
  '⛄': g => g.add(buildSnowman(0)),
  '🏮': g => {
    part(g, G.cyl(), mat('#d62828', { emissive: '#ff3b1f', emissiveIntensity: 0.9 }), [0, 0.7, 0], [0.55, 0.55, 0.55]);
    part(g, G.cyl(), mat('#ffd166'), [0, 1.0, 0], [0.3, 0.06, 0.3]);
    part(g, G.cyl(), mat('#ffd166'), [0, 0.4, 0], [0.3, 0.06, 0.3]);
  },
  '🧧': g => {
    part(g, G.box(), mat('#d00000', { emissive: '#600', emissiveIntensity: 0.4 }), [0, 0.7, 0], [0.45, 0.7, 0.06]);
    part(g, G.cyl(), mat('#ffd166'), [0, 0.72, 0.04], [0.2, 0.02, 0.2], [Math.PI / 2, 0, 0]);
  },
  '🌸': g => blossom(g, '#ffd60a'),
  '🕯️': g => {
    part(g, G.cyl(), mat('#f8f1dc'), [0, 0.3, 0], [0.14, 0.6, 0.14]);
    part(g, G.cone(), mat('#ffb703', { emissive: '#ffb703', emissiveIntensity: 2 }), [0, 0.7, 0], [0.1, 0.22, 0.1]);
  },
  '⭐': g => {
    const s = part(g, G.oct(), mat('#ffd60a', { emissive: '#ffd60a', emissiveIntensity: 1.2 }), [0, 1.0, 0], [0.7, 0.7, 0.25]);
    s.userData.spin = true;
  },
};

function smallPine(g, c1, c2, star) {
  part(g, G.cyl(), mat('#5b3a1e'), [0, 0.25, 0], [0.25, 0.5, 0.25]);
  part(g, G.cone(), mat(c1), [0, 0.9, 0], [1.2, 1.0, 1.2]);
  part(g, G.cone(), mat(c2), [0, 1.5, 0], [0.95, 0.9, 0.95]);
  part(g, G.cone(), mat(c1), [0, 2.05, 0], [0.7, 0.8, 0.7]);
  if (star) part(g, G.oct(), mat('#ffd60a', { emissive: '#ffd60a', emissiveIntensity: 1.2 }), [0, 2.55, 0], [0.3, 0.3, 0.15]);
}

function blossom(g, c) {
  part(g, G.cyl(), mat('#4a7c2f'), [0, 0.2, 0], [0.08, 0.4, 0.08]);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    part(g, G.sph(), mat(c), [Math.cos(a) * 0.18, 0.5, Math.sin(a) * 0.18], [0.22, 0.12, 0.22]);
  }
  part(g, G.sph(), mat('#d62828'), [0, 0.52, 0], [0.12, 0.12, 0.12]);
}

export function buildProp(e) {
  const g = new THREE.Group();
  const b = B[e];
  if (b) b(g);
  else {
    const s = emojiSprite(e, 1.15);
    s.position.y = 0.8;
    s.userData.bob = true;
    g.add(s);
  }
  g.userData.emoji = e;
  return g;
}

export function buildTree(themeKey) {
  const g = new THREE.Group();
  const trunk = mat('#5b3a1e');
  if (themeKey === 'halloween') {
    part(g, G.cyl(), mat('#2a1a10'), [0, 1.2, 0], [0.35, 2.4, 0.35]);
    part(g, G.cyl(), mat('#2a1a10'), [0.4, 2.0, 0], [0.15, 1.2, 0.15], [0, 0, -0.9]);
    part(g, G.cyl(), mat('#2a1a10'), [-0.4, 2.2, 0.1], [0.12, 1.0, 0.12], [0, 0, 0.9]);
  } else if (themeKey === 'christmas') {
    smallPine(g, '#1f6b34', '#14532d', false);
    [[-0.3, 0.9, 0.4], [0.35, 1.5, 0.25], [0, 2.0, 0.3]].forEach(p => part(g, G.sph(), mat('#fff'), p, [0.3, 0.18, 0.3]));
    g.scale.setScalar(1.25);
  } else {
    part(g, G.cyl(), trunk, [0, 0.9, 0], [0.3, 1.8, 0.3]);
    const c = '#ffd60a';
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      part(g, G.sph(), mat(c), [Math.cos(a) * 0.6, 1.8 + (i % 3) * 0.25, Math.sin(a) * 0.6], [0.8, 0.7, 0.8]);
    }
    part(g, G.sph(), mat(c), [0, 2.4, 0], [1, 0.8, 1]);
  }
  return g;
}

export function buildEnvelope() {
  const g = new THREE.Group();
  part(g, G.box(), mat('#fff8e7', { emissive: '#ffd166', emissiveIntensity: 0.35 }), [0, 0.9, 0], [0.7, 0.45, 0.06]);
  part(g, G.sph(), mat('#e63946'), [0, 0.9, 0.06], [0.12, 0.12, 0.05]);
  g.userData.bob = true;
  return g;
}
