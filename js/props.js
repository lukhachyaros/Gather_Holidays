// Procedural 3D models for themes, interactive stations, seats, ornaments, pumpkins, and NPCs.
import * as THREE from 'three';
import { PUMPKIN_HATS, ORNAMENTS, COSTUMES } from './themes.js';
import { geo, mat, G, part, labelSprite } from './modelUtils.js';
import { createOngPhuc } from '../design_model/ongPhuc.js';
import { createOngTho } from '../design_model/ongtho.js';
export { geo, mat, G, part, labelSprite } from './modelUtils.js';
export { buildGiantMaiTree } from '../design_model/maiTree.js';

const texCache = new Map();

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
  // Torso & ragged cloak with shadowy gradient
  part(g, G.box(), mat('#0a0a14'), [0, 0.9, 0], [0.48, 0.7, 0.28]);
  part(g, G.box(), mat('#880808'), [0, 0.85, -0.16], [0.72, 0.95, 0.05], [0.15, 0, 0]);
  // High vampire collar
  part(g, G.cone(), mat('#4a0404'), [0, 1.35, -0.08], [0.55, 0.38, 0.3], [Math.PI, 0, 0]);
  // Pale Head & glowing blood-red eyes with PointLight
  part(g, G.sph(), mat('#e2e8f0', { roughness: 0.8 }), [0, 1.44, 0], [0.42, 0.44, 0.42]);

  // Blood red glowing eyes
  const eyeMat = mat('#ff0033', { emissive: '#ff0033', emissiveIntensity: 3.5 });
  part(g, G.sph(), eyeMat, [-0.09, 1.46, 0.19], [0.07, 0.05, 0.05]);
  part(g, G.sph(), eyeMat, [0.09, 1.46, 0.19], [0.07, 0.05, 0.05]);

  // Sharp fangs
  const fangMat = mat('#ffffff', { roughness: 0.2 });
  part(g, G.cone(), fangMat, [-0.05, 1.35, 0.18], [0.03, 0.08, 0.03], [Math.PI, 0, 0]);
  part(g, G.cone(), fangMat, [0.05, 1.35, 0.18], [0.03, 0.08, 0.03], [Math.PI, 0, 0]);

  // Eye pointlight for creepy red glow
  const eyeLight = new THREE.PointLight(0xff0033, 1.4, 4.5);
  eyeLight.position.set(0, 1.46, 0.25);
  g.add(eyeLight);

  // Large ragged bat wings with multiple claw joints
  const leftWing = new THREE.Group();
  leftWing.position.set(-0.25, 1.15, -0.1);
  part(leftWing, G.box(), mat('#14101e'), [-0.55, 0, 0], [1.1, 0.52, 0.04], [0, 0, 0.18]);
  part(leftWing, G.cone(), mat('#2a0845'), [-1.1, 0.2, 0], [0.06, 0.2, 0.06], [0, 0, -0.6]);
  g.add(leftWing);

  const rightWing = new THREE.Group();
  rightWing.position.set(0.25, 1.15, -0.1);
  part(rightWing, G.box(), mat('#14101e'), [0.55, 0, 0], [1.1, 0.52, 0.04], [0, 0, -0.18]);
  part(rightWing, G.cone(), mat('#2a0845'), [1.1, 0.2, 0], [0.06, 0.2, 0.06], [0, 0, 0.6]);
  g.add(rightWing);

  const lbl = labelSprite('🧛 BÁ TƯỚC MA CÀ RỒNG (BOSS)', 'rgba(74,4,4,0.95)', '#fecaca', 0.38);
  lbl.position.set(0, 2.12, 0);
  g.add(lbl);

  g.userData.leftWing = leftWing;
  g.userData.rightWing = rightWing;
  return g;
}

// ============================================================================
// TET CENTERPIECE (GIANT MAI TREE WITH BAO LI XI) & FIREWORKS ZONE
// ============================================================================
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
// SACRED SHRINE OF THE 3 STAR GODS: PHÚC - LỘC - THỌ (TAM ĐA TÀI LỘC)
// ============================================================================
function buildLegacyPhucLocThoShrine() {
  const g = new THREE.Group();

  // 1. Temple Pavilion Base & Stone Terrace
  part(g, G.box(), mat('#780000'), [0, 0.2, 0], [4.4, 0.4, 3.4]);
  part(g, G.box(), mat('#ffd166', { metalness: 0.35 }), [0, 0.42, 0], [4.5, 0.06, 3.5]);

  // Red lacquered temple pillars (4 corners)
  const pillarMat = mat('#9b111e');
  const goldMat = mat('#facc15', { metalness: 0.4, roughness: 0.25 });
  [-1.9, 1.9].forEach(px => {
    [-1.4, 1.4].forEach(pz => {
      part(g, G.cyl(), pillarMat, [px, 1.6, pz], [0.18, 2.4, 0.18]);
      part(g, G.cyl(), goldMat, [px, 2.82, pz], [0.24, 0.1, 0.24]);
    });
  });

  // Oriental Pagoda Roof with sweeping eaves
  const roofMat = mat('#b91c1c');
  part(g, G.box(), roofMat, [0, 3.05, 0], [4.8, 0.22, 3.8]);
  part(g, G.box(), goldMat, [0, 3.22, 0], [4.2, 0.14, 3.2]);
  part(g, G.box(), roofMat, [0, 3.42, 0], [3.2, 0.28, 2.2]);
  // Roof ridge golden ornament
  part(g, G.box(), goldMat, [0, 3.62, 0], [1.8, 0.15, 0.3]);

  // Altar Table (Bàn thờ gỗ sơn son thếp vàng)
  const altarWood = mat('#450a0a');
  part(g, G.box(), altarWood, [0, 0.8, -0.3], [3.8, 0.72, 1.4]);
  part(g, G.box(), mat('#dc2626'), [0, 1.18, -0.3], [3.9, 0.08, 1.48]);
  part(g, G.box(), goldMat, [0, 1.18, 0.44], [3.9, 0.12, 0.04]);

  // --------------------------------------------------------------------------
  // 2. THE THREE DEITIES: PHÚC - LỘC - THỌ (Distinct Majestic Models & Nametags)
  // --------------------------------------------------------------------------
  const skinTone = mat('#fed7aa', { roughness: 0.45 });
  const silkRed = mat('#b91c1c', { roughness: 0.35, metalness: 0.15 });
  const silkGreen = mat('#047857', { roughness: 0.35, metalness: 0.15 });
  const silkAmber = mat('#b45309', { roughness: 0.35, metalness: 0.15 });
  const haloMat = mat('#fef08a', { emissive: '#facc15', emissiveIntensity: 0.6, transparent: true, opacity: 0.85 });

  // --- STATUE 1: ÔNG PHÚC (Left: x = -1.35) ---
  // Robe: Crimson Imperial silk with gold cloud dragon trim. Holding baby boy in left arm & gold ingot in right!
  const phucGroup = new THREE.Group();
  phucGroup.name = 'legacy-ong-phuc';
  phucGroup.position.set(-1.35, 1.22, -0.35);

  // Triple-tiered Lotus Throne (Đài sen 3 tầng dát vàng)
  part(phucGroup, G.cyl(), goldMat, [0, 0.05, 0], [0.68, 0.1, 0.68]);
  part(phucGroup, G.cyl(), silkRed, [0, 0.13, 0], [0.62, 0.08, 0.62]);
  part(phucGroup, G.cyl(), goldMat, [0, 0.19, 0], [0.55, 0.06, 0.55]);

  // Flowing Bell-shaped Ceremonial Robe Body
  part(phucGroup, G.cyl(), silkRed, [0, 0.72, 0], [0.54, 0.98, 0.54]);
  // Golden Imperial Sash & Chest Cloud Embroidery
  part(phucGroup, G.box(), goldMat, [0, 0.72, 0.28], [0.22, 0.96, 0.03]);
  part(phucGroup, G.box(), goldMat, [0, 1.05, 0.28], [0.42, 0.18, 0.03]);

  // Wide Flowing Silk Sleeves
  [-0.38, 0.38].forEach(sx => {
    part(phucGroup, G.cyl(), silkRed, [sx, 0.82, 0.08], [0.24, 0.55, 0.24], [0.2, 0, sx > 0 ? -0.35 : 0.35]);
    part(phucGroup, G.cyl(), goldMat, [sx > 0 ? sx + 0.08 : sx - 0.08, 0.62, 0.12], [0.25, 0.08, 0.25], [0.2, 0, sx > 0 ? -0.35 : 0.35]);
  });

  // Face with warm joyful smile
  part(phucGroup, G.sph(), skinTone, [0, 1.35, 0], [0.28, 0.3, 0.28]);
  // Rosy cheeks
  [-0.14, 0.14].forEach(cx => {
    part(phucGroup, G.sph(), mat('#fda4af'), [cx, 1.32, 0.24], [0.06, 0.04, 0.04]);
  });
  // Imperial Official Hat (Mũ quan triều đình cao quý)
  part(phucGroup, G.box(), mat('#0f172a'), [0, 1.56, 0], [0.42, 0.18, 0.38]);
  part(phucGroup, G.cyl(), mat('#0f172a'), [0, 1.68, 0], [0.22, 0.16, 0.22]);
  part(phucGroup, G.sph(), goldMat, [0, 1.78, 0], [0.08, 0.08, 0.08]); // Gold pinnacle bead

  // Elegant Black Mustache & Beard (Râu ba chòm uy nghiêm)
  part(phucGroup, G.cone(), mat('#09090b'), [0, 1.15, 0.26], [0.1, 0.38, 0.08], [0.25, 0, 0]);
  [-0.08, 0.08].forEach(mx => {
    part(phucGroup, G.cyl(), mat('#09090b'), [mx, 1.25, 0.26], [0.02, 0.12, 0.02], [0, 0, mx > 0 ? -0.7 : 0.7]);
  });

  // Left Arm: Holding happy chubby baby boy (Đứa bé mũm mĩm tay cầm ngọc)
  const babyGroup = new THREE.Group();
  babyGroup.position.set(0.25, 0.88, 0.28);
  babyGroup.rotation.z = -0.32;
  part(babyGroup, G.cyl(), mat('#10b981'), [0, 0.18, 0], [0.18, 0.42, 0.18]); // Emerald swaddle
  part(babyGroup, G.sph(), skinTone, [0, 0.45, 0], [0.14, 0.14, 0.14]); // Chubby head
  part(babyGroup, G.sph(), goldMat, [0, 0.58, 0], [0.09, 0.1, 0.09]); // Golden cap
  part(babyGroup, G.sph(), mat('#ef4444'), [0.08, 0.22, 0.14], [0.06, 0.06, 0.06]); // Lucky red packet
  phucGroup.add(babyGroup);

  // Right Hand: Holding large Gold Ingot (Kim Nguyên Bảo)
  const ingotGroup = new THREE.Group();
  ingotGroup.position.set(-0.35, 0.88, 0.3);
  part(ingotGroup, G.box(), goldMat, [0, 0, 0], [0.18, 0.08, 0.12]);
  part(ingotGroup, G.sph(), goldMat, [0, 0.04, 0], [0.09, 0.07, 0.07]);
  phucGroup.add(ingotGroup);

  // Radiant Golden Halo behind head (Vòng hào quang cát tường)
  part(phucGroup, G.torus(), haloMat, [0, 1.45, -0.22], [0.65, 0.65, 0.65]);

  // Nametag Ông Phúc
  const lblPhuc = labelSprite('✨ ÔNG PHÚC ✨', 'rgba(185,28,28,0.92)', '#fef08a', 0.40);
  lblPhuc.position.set(0, 2.15, 0);
  phucGroup.add(lblPhuc);
  g.add(phucGroup);

  // --- STATUE 2: ÔNG LỘC (Center: x = 0, Tallest & Grandest) ---
  // Robe: Emerald Jade silk with golden dragon sash. Imperial Hat with wing flaps, holding Jade Ruyi & Pearl!
  const locGroup = new THREE.Group();
  locGroup.position.set(0, 1.25, -0.35);

  // Triple Lotus Throne (Đài sen hoàng gia)
  part(locGroup, G.cyl(), goldMat, [0, 0.05, 0], [0.72, 0.1, 0.72]);
  part(locGroup, G.cyl(), silkGreen, [0, 0.13, 0], [0.65, 0.08, 0.65]);
  part(locGroup, G.cyl(), goldMat, [0, 0.19, 0], [0.58, 0.06, 0.58]);

  // Regal Emerald Robe Body
  part(locGroup, G.cyl(), silkGreen, [0, 0.8, 0], [0.58, 1.15, 0.58]);
  // Golden Imperial Dragon Panel & Jade Belt
  part(locGroup, G.box(), goldMat, [0, 0.8, 0.3], [0.26, 1.1, 0.03]);
  part(locGroup, G.cyl(), mat('#10b981', { roughness: 0.2 }), [0, 0.72, 0.3], [0.28, 0.06, 0.04], [Math.PI / 2, 0, 0]); // Jade buckle
  part(locGroup, G.box(), goldMat, [0, 1.15, 0.3], [0.46, 0.22, 0.03]); // Dragon chest badge

  // Wide Minister Sleeves
  [-0.42, 0.42].forEach(sx => {
    part(locGroup, G.cyl(), silkGreen, [sx, 0.9, 0.08], [0.26, 0.62, 0.26], [0.2, 0, sx > 0 ? -0.38 : 0.38]);
    part(locGroup, G.cyl(), goldMat, [sx > 0 ? sx + 0.09 : sx - 0.09, 0.68, 0.12], [0.27, 0.08, 0.27], [0.2, 0, sx > 0 ? -0.38 : 0.38]);
  });

  // Head of Imperial Prime Minister
  part(locGroup, G.sph(), skinTone, [0, 1.48, 0], [0.29, 0.31, 0.29]);

  // Grand Imperial Minister Hat with Side Wings (Mũ Cánh Chuồn Đại Thần)
  part(locGroup, G.box(), mat('#0f172a'), [0, 1.7, 0], [0.46, 0.24, 0.38]);
  part(locGroup, G.box(), goldMat, [0, 1.83, 0], [0.18, 0.09, 0.18]);
  [-0.55, 0.55].forEach(wx => {
    // Extended horizontal wing flaps
    part(locGroup, G.box(), mat('#0f172a'), [wx, 1.7, 0], [0.65, 0.07, 0.14]);
    part(locGroup, G.box(), goldMat, [wx > 0 ? wx + 0.32 : wx - 0.32, 1.7, 0], [0.08, 0.1, 0.16]); // Golden wingtip
  });

  // Long Dignified Black Beard (Râu dài đen óng mượt)
  part(locGroup, G.cone(), mat('#09090b'), [0, 1.25, 0.28], [0.12, 0.48, 0.09], [0.2, 0, 0]);
  [-0.09, 0.09].forEach(mx => {
    part(locGroup, G.cyl(), mat('#09090b'), [mx, 1.36, 0.28], [0.02, 0.14, 0.02], [0, 0, mx > 0 ? -0.6 : 0.6]);
  });

  // Left Hand: Imperial Golden & Emerald Jade Ruyi Scepter (Gậy Như Ý Đại Cát)
  const ruyiGroup = new THREE.Group();
  ruyiGroup.position.set(-0.35, 0.98, 0.32);
  ruyiGroup.rotation.z = -0.45;
  ruyiGroup.rotation.x = 0.25;
  part(ruyiGroup, G.cyl(), mat('#10b981', { roughness: 0.15 }), [0, 0, 0], [0.05, 0.85, 0.05]); // Jade rod
  part(ruyiGroup, G.sph(), goldMat, [0, 0.45, 0], [0.16, 0.14, 0.1]); // Golden cloud head
  part(ruyiGroup, G.sph(), mat('#ef4444'), [0, 0.45, 0.08], [0.06, 0.06, 0.06]); // Ruby inlay
  part(ruyiGroup, G.cone(), mat('#dc2626'), [0, -0.48, 0], [0.08, 0.24, 0.08]); // Red silk tassel
  locGroup.add(ruyiGroup);

  // Right Hand: Golden Wealth Casket / Scroll (Sớ ban tài lộc)
  const scrollGroup = new THREE.Group();
  scrollGroup.position.set(0.35, 0.98, 0.32);
  scrollGroup.rotation.z = 0.45;
  part(scrollGroup, G.cyl(), goldMat, [0, 0, 0], [0.08, 0.65, 0.08], [0, 0, Math.PI / 4]);
  part(scrollGroup, G.sph(), mat('#dc2626'), [0.24, 0.24, 0], [0.09, 0.09, 0.09]);
  part(scrollGroup, G.sph(), mat('#dc2626'), [-0.24, -0.24, 0], [0.09, 0.09, 0.09]);
  locGroup.add(scrollGroup);

  // Radiant Golden Halo
  part(locGroup, G.torus(), haloMat, [0, 1.58, -0.22], [0.75, 0.75, 0.75]);

  // Nametag Ông Lộc
  const lblLoc = labelSprite('💰 ÔNG LỘC 💰', 'rgba(5,150,105,0.92)', '#fef08a', 0.42);
  lblLoc.position.set(0, 2.3, 0);
  locGroup.add(lblLoc);
  g.add(locGroup);

  // --- STATUE 3: ÔNG THỌ (Right: x = 1.35) ---
  // High Cranial Forehead, Snowy White Beard, Dragon Staff with Gourd & Giant Celestial Peach!
  const thoGroup = new THREE.Group();
  thoGroup.name = 'legacy-ong-tho';
  thoGroup.position.set(1.35, 1.22, -0.35);

  // Triple Lotus Throne
  part(thoGroup, G.cyl(), goldMat, [0, 0.05, 0], [0.68, 0.1, 0.68]);
  part(thoGroup, G.cyl(), silkAmber, [0, 0.13, 0], [0.62, 0.08, 0.62]);
  part(thoGroup, G.cyl(), goldMat, [0, 0.19, 0], [0.55, 0.06, 0.55]);

  // Warm Amber Golden Robe Body
  part(thoGroup, G.cyl(), silkAmber, [0, 0.72, 0], [0.52, 0.98, 0.52]);
  part(thoGroup, G.box(), goldMat, [0, 0.72, 0.28], [0.2, 0.96, 0.03]);

  // Wide Sleeves
  [-0.38, 0.38].forEach(sx => {
    part(thoGroup, G.cyl(), silkAmber, [sx, 0.82, 0.08], [0.24, 0.55, 0.24], [0.2, 0, sx > 0 ? -0.35 : 0.35]);
    part(thoGroup, G.cyl(), goldMat, [sx > 0 ? sx + 0.08 : sx - 0.08, 0.62, 0.12], [0.25, 0.08, 0.25], [0.2, 0, sx > 0 ? -0.35 : 0.35]);
  });

  // Face & Iconic High Elongated Cranial Dome (Trán Dô Tiên Ông Trường Thọ)
  part(thoGroup, G.sph(), skinTone, [0, 1.32, 0], [0.28, 0.28, 0.28]);
  part(thoGroup, G.sph(), skinTone, [0, 1.58, 0.04], [0.24, 0.38, 0.24]); // High bald dome

  // Long Flowing Snowy White Beard & Eyebrows (Râu tóc bạc phơ tiên phong đạo cốt)
  part(thoGroup, G.cone(), mat('#ffffff', { roughness: 0.3 }), [0, 1.1, 0.26], [0.15, 0.58, 0.12], [0.22, 0, 0]);
  [-0.11, 0.11].forEach(ex => {
    part(thoGroup, G.box(), mat('#ffffff'), [ex, 1.4, 0.26], [0.12, 0.04, 0.04], [0, 0, ex > 0 ? 0.2 : -0.2]); // White bushy brows
  });

  // Right Hand: Dragon Head Walking Staff with Celestial Wine Gourd (Gậy đầu rồng buộc Hồ Lô Tiên)
  const staffGroup = new THREE.Group();
  staffGroup.position.set(-0.38, 0.72, 0.22);
  part(staffGroup, G.cyl(), mat('#5c2b0e'), [0, 0.45, 0], [0.045, 1.8, 0.045]); // Wooden staff
  part(staffGroup, G.cone(), goldMat, [0, 1.35, 0.08], [0.12, 0.25, 0.12], [0.65, 0, 0]); // Dragon head crook
  part(staffGroup, G.sph(), goldMat, [0, 1.45, 0.15], [0.08, 0.08, 0.08]);

  // Hanging Wine Gourd (Hồ Lô Tiên thắt dây đỏ)
  const gourdGroup = new THREE.Group();
  gourdGroup.position.set(0.12, 1.12, 0.06);
  part(gourdGroup, G.sph(), mat('#d97706'), [0, 0.12, 0], [0.1, 0.11, 0.1]);
  part(gourdGroup, G.sph(), mat('#d97706'), [0, -0.04, 0], [0.14, 0.15, 0.14]);
  part(gourdGroup, G.torus(), mat('#ef4444'), [0, 0.04, 0], [0.08, 0.08, 0.08], [Math.PI / 2, 0, 0]); // Red silk ribbon
  staffGroup.add(gourdGroup);
  thoGroup.add(staffGroup);

  // Left Hand: Celestial Peach of Immortality (Đào Tiên ngậm sương phúc thọ)
  const peachGroup = new THREE.Group();
  peachGroup.position.set(0.3, 0.88, 0.3);
  part(peachGroup, G.sph(), mat('#fb7185', { roughness: 0.25 }), [0, 0, 0], [0.15, 0.18, 0.15]);
  part(peachGroup, G.cone(), mat('#e11d48'), [0, 0.16, 0], [0.08, 0.14, 0.08]); // Rosy peach tip
  // Emerald Jade Leaves
  [-0.1, 0.1].forEach(lx => {
    part(peachGroup, G.box(), mat('#15803d'), [lx, -0.06, 0], [0.11, 0.03, 0.08], [0, 0, lx > 0 ? 0.35 : -0.35]);
  });
  thoGroup.add(peachGroup);

  // Radiant Golden Halo
  part(thoGroup, G.torus(), haloMat, [0, 1.5, -0.22], [0.65, 0.65, 0.65]);

  // Nametag Ông Thọ
  const lblTho = labelSprite('🍑 ÔNG THỌ 🍑', 'rgba(217,119,6,0.92)', '#fef08a', 0.40);
  lblTho.position.set(0, 2.15, 0);
  thoGroup.add(lblTho);
  g.add(thoGroup);

  // --------------------------------------------------------------------------
  // 3. ALTAR OFFERINGS: INCENSE BURNER, FRUITS, CANDLES & SMOKE
  // --------------------------------------------------------------------------
  // Bronze Incense Burner (Lư hương đồng)
  const burnerGroup = new THREE.Group();
  burnerGroup.position.set(0, 1.25, 0.18);
  part(burnerGroup, G.cyl(), goldMat, [0, 0.12, 0], [0.26, 0.22, 0.26]);
  part(burnerGroup, G.sph(), goldMat, [0, 0.05, 0], [0.28, 0.14, 0.28]);
  // 3 Incense sticks with glowing burning tips
  [-0.06, 0, 0.06].forEach((ix, idx) => {
    part(burnerGroup, G.cyl(), mat('#b91c1c'), [ix, 0.36, (idx % 2) * 0.03], [0.015, 0.35, 0.015]);
    part(burnerGroup, G.sph(), mat('#ff4500', { emissive: '#ff4500', emissiveIntensity: 2.2 }), [ix, 0.54, (idx % 2) * 0.03], [0.02, 0.02, 0.02]);
  });
  g.add(burnerGroup);

  // 5-Fruit Tray (Mâm Ngũ Quả May Mắn)
  const fruitTray = new THREE.Group();
  fruitTray.position.set(-0.75, 1.25, 0.18);
  part(fruitTray, G.cyl(), goldMat, [0, 0.03, 0], [0.32, 0.05, 0.32]); // Platter
  part(fruitTray, G.sph(), mat('#15803d'), [0, 0.15, 0], [0.16, 0.14, 0.16]); // Watermelon
  part(fruitTray, G.sph(), mat('#facc15'), [0.12, 0.1, 0.08], [0.08, 0.08, 0.08]); // Mango
  part(fruitTray, G.sph(), mat('#ea580c'), [-0.12, 0.1, -0.06], [0.08, 0.08, 0.08]); // Orange
  part(fruitTray, G.sph(), mat('#e11d48'), [0.06, 0.12, -0.1], [0.07, 0.07, 0.07]); // Dragonfruit
  g.add(fruitTray);

  // Stacks of Gold Ingots (Thỏi vàng nén thần tài)
  const goldTray = new THREE.Group();
  goldTray.position.set(0.75, 1.25, 0.18);
  part(goldTray, G.cyl(), goldMat, [0, 0.03, 0], [0.28, 0.05, 0.28]);
  [-0.06, 0.06].forEach(gx => {
    part(goldTray, G.box(), goldMat, [gx, 0.08, 0], [0.12, 0.06, 0.08]);
  });
  part(goldTray, G.box(), goldMat, [0, 0.14, 0], [0.1, 0.05, 0.07]);
  g.add(goldTray);

  // 2 Red Temple Candles
  [-1.4, 1.4].forEach(cx => {
    part(g, G.cyl(), mat('#991b1b'), [cx, 1.35, 0.18], [0.06, 0.3, 0.06]);
    const flame = part(g, G.cone(), mat('#ffedd5', { emissive: '#f97316', emissiveIntensity: 2.5 }), [cx, 1.54, 0.18], [0.035, 0.1, 0.035]);
    const flameLight = new THREE.PointLight('#f97316', 1.8, 4);
    flameLight.position.set(cx, 1.55, 0.18);
    g.add(flameLight);
  });

  // 3 Silk Prayer Cushions in front of Altar (Đệm quỳ lạy hoa sen)
  [-1.0, 0, 1.0].forEach(kx => {
    part(g, G.cyl(), mat('#b91c1c'), [kx, 0.12, 1.35], [0.42, 0.15, 0.42]);
    part(g, G.cyl(), goldMat, [kx, 0.18, 1.35], [0.34, 0.03, 0.34]);
  });

  // Hanging Lanterns on eaves
  [-2.2, 2.2].forEach(lx => {
    const lantern = part(g, G.cyl(), mat('#dc2626', { emissive: '#b91c1c', emissiveIntensity: 0.5 }), [lx, 2.7, 1.5], [0.24, 0.45, 0.24]);
    part(g, G.cone(), goldMat, [lx, 2.45, 1.5], [0.08, 0.18, 0.08]);
  });

  // Grand Signboard above temple entrance
  const mainLabel = labelSprite(
    '🏮 ĐIỆN THỜ PHÚC LỘC THỌ 🏮\n[E] Chiêm Bái',
    'rgba(153,27,27,0.95)',
    '#fef08a',
    0.52
  );
  mainLabel.position.set(0, 3.8, 0.3);
  g.add(mainLabel);

  return g;
}

export function buildPhucLocThoShrine() {
  const g = buildLegacyPhucLocThoShrine();
  const phucPosition = new THREE.Vector3(-1.35, 1.22, -0.35);
  const thoPosition = new THREE.Vector3(1.35, 1.22, -0.35);

  for (const child of [...g.children]) {
    if (child.name === 'legacy-ong-phuc' || child.name === 'legacy-ong-tho') g.remove(child);
  }

  const phuc = createOngPhuc({ height: 1.8, pedestal: true });
  phuc.position.copy(phucPosition);
  const lblPhuc = labelSprite('✨ ÔNG PHÚC ✨', 'rgba(185,28,28,0.92)', '#fef08a', 0.40);
  lblPhuc.position.set(0, 2.05, 0);
  phuc.add(lblPhuc);
  g.add(phuc);

  const tho = createOngTho({ height: 1.8 });
  tho.position.copy(thoPosition);
  const lblTho = labelSprite('🍑 ÔNG THỌ 🍑', 'rgba(217,119,6,0.92)', '#fef08a', 0.40);
  lblTho.position.set(0, 2.05, 0);
  tho.add(lblTho);
  g.add(tho);

  return g;
}

// ============================================================================
// DRAGON SUMMONING ALTAR (ĐÀI TRIỆU HỒI KIM LONG & CƯỠI RỒNG BAY)
// ============================================================================
export function buildDragonAltar() {
  const g = new THREE.Group();

  // Octagonal Dragon Dais (Đài đá rồng chạm trổ hoa văn)
  const stoneMat = mat('#1e293b', { roughness: 0.5 });
  const goldTrim = mat('#facc15', { metalness: 0.5, roughness: 0.25 });
  part(g, G.cyl(), stoneMat, [0, 0.18, 0], [2.1, 0.36, 2.1]);
  part(g, G.cyl(), goldTrim, [0, 0.38, 0], [2.2, 0.06, 2.2]);

  // Inner Rune Circle (Vòng tròn ấn phù triệu hồi)
  part(g, G.cyl(), mat('#b91c1c'), [0, 0.42, 0], [1.75, 0.04, 1.75]);
  part(g, G.cyl(), goldTrim, [0, 0.45, 0], [1.4, 0.03, 1.4]);

  // 4 Golden Dragon Guardian Pillars
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const px = Math.cos(a) * 1.5;
    const pz = Math.sin(a) * 1.5;
    part(g, G.cyl(), stoneMat, [px, 0.85, pz], [0.16, 1.1, 0.16]);
    part(g, G.sph(), goldTrim, [px, 1.45, pz], [0.18, 0.18, 0.18]);
  }

  // Floating Mystic Dragon Pearl above central pedestal
  part(g, G.cyl(), goldTrim, [0, 0.65, 0], [0.45, 0.45, 0.45]);
  const pearlMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xfacc15,
    emissiveIntensity: 2.5,
    roughness: 0.1,
    metalness: 0.2,
  });
  const floatingPearl = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 16), pearlMat);
  floatingPearl.position.set(0, 1.35, 0);
  g.add(floatingPearl);

  const pearlLight = new THREE.PointLight('#facc15', 3.5, 10);
  pearlLight.position.set(0, 1.35, 0);
  g.add(pearlLight);

  const lbl = labelSprite(
    '🐉 ĐÀI TRIỆU HỒI RỒNG 🐉\n[E] Cưỡi Rồng · Bay Thử Thách',
    'rgba(180,83,9,0.92)',
    '#fde047',
    0.50
  );
  lbl.position.set(0, 2.3, 0);
  g.add(lbl);

  return g;
}

// ============================================================================
// AERIAL HOOP RING FOR DRAGON FLIGHT QUEST (VÒNG BAY LƠ LỬNG)
// ============================================================================
export function buildAerialRing(color = '#facc15', radius = 2.8) {
  const g = new THREE.Group();
  const ringMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    emissive: new THREE.Color(color),
    emissiveIntensity: 1.8,
    roughness: 0.2,
    metalness: 0.3,
  });
  // Torus ring
  const torus = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.22, 12, 36), ringMat);
  g.add(torus);

  // Soft glowing center portal aura
  const auraMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(color),
    transparent: true,
    opacity: 0.28,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const portalDisk = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.94, 28), auraMat);
  g.add(portalDisk);

  // Point light for illumination in night sky
  const light = new THREE.PointLight(color, 2.5, radius * 3.5);
  g.add(light);

  g.userData.radius = radius;
  return g;
}

// ============================================================================
 // VALENTINE CENTERPIECES: HEART TREE, WISHING FOUNTAIN & ROSE ARCH
 // ============================================================================
function valentineHeartGeometry() {
  return geo('valentine-heart', () => {
    const shape = new THREE.Shape();
    shape.moveTo(0, -1.12);
    shape.bezierCurveTo(-0.28, -0.72, -1.34, -0.02, -1.34, 0.62);
    shape.bezierCurveTo(-1.34, 1.38, -0.34, 1.52, 0, 0.82);
    shape.bezierCurveTo(0.34, 1.52, 1.34, 1.38, 1.34, 0.62);
    shape.bezierCurveTo(1.34, -0.02, 0.28, -0.72, 0, -1.12);
    return new THREE.ExtrudeGeometry(shape, {
      depth: 0.18,
      bevelEnabled: true,
      bevelSegments: 3,
      steps: 1,
      bevelSize: 0.055,
      bevelThickness: 0.055,
    });
  });
}

export function buildValentineHeartTree() {
  const g = new THREE.Group();
  // Tiered rose-gold pedestal and sculpted trunk.
  part(g, G.cyl(), mat('#7f1d4e'), [0, 0.2, 0], [2.45, 0.4, 2.45]);
  part(g, G.cyl(), mat('#f9a8d4', { metalness: 0.38 }), [0, 0.43, 0], [2.55, 0.09, 2.55]);
  part(g, G.cyl(), mat('#8b5e68'), [0, 1.48, 0], [0.34, 2.1, 0.34]);
  part(g, G.cyl(), mat('#b77986'), [0, 2.2, 0], [0.22, 1.15, 0.22], [0, 0, -0.34]);

  const heartGeo = valentineHeartGeometry();
  const rose = mat('#e11d48', { emissive: '#9f1239', emissiveIntensity: 0.48, roughness: 0.48 });
  const blush = mat('#f9a8d4', { emissive: '#be185d', emissiveIntensity: 0.32, roughness: 0.42 });
  const gold = mat('#fbbf24', { metalness: 0.42, emissive: '#f59e0b', emissiveIntensity: 0.55 });
  part(g, heartGeo, rose, [0, 3.55, 0], [1.28, 1.18, 1]);
  const centerHeart = part(g, heartGeo, blush, [0, 3.58, 0.22], [0.72, 0.68, 0.75]);
  centerHeart.userData.spin = true;

  // Smaller floating hearts and rose clusters around the crown.
  const floaters = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const heart = part(
      g,
      heartGeo,
      i % 2 ? blush : gold,
      [Math.cos(a) * 1.55, 3.35 + (i % 3) * 0.48, Math.sin(a) * 0.72],
      [0.22, 0.22, 0.32]
    );
    heart.userData.spin = true;
    floaters.push(heart);
  }
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const x = Math.cos(a) * 1.05;
    const z = Math.sin(a) * 1.05;
    part(g, G.sph(), rose, [x, 0.78 + (i % 2) * 0.18, z], [0.22, 0.16, 0.22]);
    part(g, G.sph(), mat('#4d7c50'), [x * 1.12, 0.68, z * 1.12], [0.2, 0.07, 0.11]);
  }

  const light = new THREE.PointLight('#fb7185', 4.2, 18);
  light.position.set(0, 4.0, 0);
  g.add(light);
  const lbl = labelSprite('💗 Cây Trái Tim · [E] Viết thiệp yêu thương', 'rgba(131,24,67,0.92)', '#fff1f2', 0.46);
  lbl.position.set(0, 6.0, 0);
  g.add(lbl);
  g.userData.floaters = floaters;
  return g;
}

export function buildLoveFountain() {
  const g = new THREE.Group();
  part(g, G.cyl(), mat('#9d4770'), [0, 0.18, 0], [1.65, 0.36, 1.65]);
  part(g, G.cyl(), mat('#fbcfe8', { metalness: 0.28, roughness: 0.32 }), [0, 0.48, 0], [1.42, 0.22, 1.42]);
  part(g, G.cyl(), mat('#db2777', { emissive: '#be185d', emissiveIntensity: 0.24 }), [0, 0.66, 0], [0.82, 0.18, 0.82]);
  part(g, G.cyl(), mat('#f9a8d4'), [0, 1.12, 0], [0.2, 0.92, 0.2]);
  const heart = part(
    g,
    valentineHeartGeometry(),
    mat('#fb7185', { emissive: '#e11d48', emissiveIntensity: 1.0, metalness: 0.18 }),
    [0, 1.8, 0],
    [0.48, 0.46, 0.65]
  );
  heart.userData.spin = true;

  // Softly glowing water jets around the central heart.
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const jet = part(
      g,
      G.cyl(),
      mat('#fce7f3', { emissive: '#f9a8d4', emissiveIntensity: 0.65 }),
      [Math.cos(a) * 0.54, 0.95, Math.sin(a) * 0.54],
      [0.035, 0.68, 0.035],
      [0, 0, (i % 2 ? -1 : 1) * 0.25]
    );
    jet.userData.bob = true;
  }
  const light = new THREE.PointLight('#f472b6', 2.4, 8);
  light.position.set(0, 1.6, 0);
  g.add(light);
  const lbl = labelSprite('⛲ Suối Ước Nguyện · [E] Gửi thiệp', 'rgba(157,23,77,0.9)', '#fff1f2', 0.32);
  lbl.position.set(0, 2.55, 0);
  g.add(lbl);
  return g;
}

export function buildRoseArch() {
  const g = new THREE.Group();
  const stone = mat('#9d4770');
  const trim = mat('#fbcfe8', { metalness: 0.3 });
  // Two columns and a rose-covered oval crown.
  part(g, G.cyl(), stone, [-1.55, 1.18, 0], [0.24, 2.36, 0.24]);
  part(g, G.cyl(), stone, [1.55, 1.18, 0], [0.24, 2.36, 0.24]);
  part(g, G.cyl(), trim, [-1.55, 0.12, 0], [0.54, 0.16, 0.54]);
  part(g, G.cyl(), trim, [1.55, 0.12, 0], [0.54, 0.16, 0.54]);
  part(g, G.torus(), trim, [0, 2.25, 0], [5.1, 1.25, 0.9]);

  const petals = [mat('#e11d48'), mat('#fb7185'), mat('#f9a8d4')];
  for (let i = 0; i < 13; i++) {
    const t = i / 12;
    const x = -1.85 + t * 3.7;
    const y = 2.3 + Math.sin(t * Math.PI) * 0.92;
    const rose = part(g, G.sph(), petals[i % petals.length], [x, y, 0.12], [0.22, 0.18, 0.2]);
    rose.userData.spin = i % 4 === 0;
    part(g, G.sph(), mat('#4d7c50'), [x + 0.12, y - 0.15, 0.04], [0.16, 0.045, 0.08]);
  }
  part(g, valentineHeartGeometry(), mat('#fbbf24', { emissive: '#f59e0b', emissiveIntensity: 0.5 }), [0, 2.34, 0.22], [0.25, 0.25, 0.5]);
  const lbl = labelSprite('🌹 Cổng Hoa Hồng', 'rgba(131,24,67,0.88)', '#fff1f2', 0.3);
  lbl.position.set(0, 3.65, 0);
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
  g.userData.label = lbl;
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

// ============================================================================
// 1. ROULETTE TABLE (VÒNG QUAY ROULETTE)
// ============================================================================
export function buildRouletteTable() {
  const g = new THREE.Group();

  // Table base & legs
  const woodMat = mat('#3b1a0a', { roughness: 0.35, metalness: 0.1 });
  const brassMat = mat('#d97706', { roughness: 0.2, metalness: 0.85 });
  const feltMat = mat('#047857', { roughness: 0.85 }); // Green casino felt

  // Main table top slab (rounded rectangle)
  part(g, G.box(), woodMat, [0, 0.88, 0], [4.4, 0.14, 2.2]);
  part(g, G.box(), feltMat, [0.45, 0.96, 0], [3.2, 0.03, 1.9]);

  // 4 Brass trimmed wooden legs
  [[-1.9, 0.44, -0.85], [1.9, 0.44, -0.85], [-1.9, 0.44, 0.85], [1.9, 0.44, 0.85]].forEach(p => {
    part(g, G.cyl(), woodMat, p, [0.18, 0.88, 0.18]);
    part(g, G.torus(), brassMat, [p[0], 0.1, p[2]], [0.28, 0.28, 0.28], [Math.PI / 2, 0, 0]);
  });

  // Brass footrest rail around bottom
  part(g, G.box(), brassMat, [0, 0.16, -0.85], [3.8, 0.05, 0.05]);
  part(g, G.box(), brassMat, [0, 0.16, 0.85], [3.8, 0.05, 0.05]);

  // Roulette Wheel Assembly (Left side of table)
  const wheelBase = new THREE.Group();
  wheelBase.position.set(-1.25, 0.96, 0);

  // Outer wooden bowl
  part(wheelBase, G.cyl(), woodMat, [0, 0.06, 0], [1.4, 0.12, 1.4]);
  // Brass outer track ring
  part(wheelBase, G.torus(), brassMat, [0, 0.14, 0], [1.32, 1.32, 1.32], [Math.PI / 2, 0, 0]);

  // Spinning Rotor Group
  const rotor = new THREE.Group();
  rotor.position.set(0, 0.14, 0);

  // Rotor cylinder
  part(rotor, G.cyl(), brassMat, [0, 0, 0], [1.1, 0.06, 1.1]);

  // 37 Number Pockets (Red & Black alternating, 0 green)
  const redMat = mat('#dc2626', { roughness: 0.4 });
  const blackMat = mat('#18181b', { roughness: 0.4 });
  const greenMat = mat('#16a34a', { roughness: 0.4 });
  const pockets = 37;
  for (let i = 0; i < pockets; i++) {
    const angle = (i / pockets) * Math.PI * 2;
    const pMat = i === 0 ? greenMat : (i % 2 === 1 ? redMat : blackMat);
    const px = Math.cos(angle) * 0.48;
    const pz = Math.sin(angle) * 0.48;
    part(rotor, G.box(), pMat, [px, 0.035, pz], [0.07, 0.02, 0.07], [0, -angle, 0]);
  }

  // Center Brass Turret & 4 Spoke Crosshead
  part(rotor, G.cyl(), brassMat, [0, 0.08, 0], [0.16, 0.12, 0.16]);
  part(rotor, G.sph(), brassMat, [0, 0.16, 0], [0.12, 0.12, 0.12]);
  part(rotor, G.box(), brassMat, [0, 0.12, 0], [0.46, 0.03, 0.03]);
  part(rotor, G.box(), brassMat, [0, 0.12, 0], [0.03, 0.03, 0.46]);

  wheelBase.add(rotor);

  // Ivory Ball on circular track
  const ballGroup = new THREE.Group();
  ballGroup.position.set(0, 0.16, 0);
  const ball = part(ballGroup, G.sph(), mat('#ffffff', { roughness: 0.1, metalness: 0.05 }), [0.55, 0, 0], [0.055, 0.055, 0.055]);
  wheelBase.add(ballGroup);

  g.add(wheelBase);

  // Felt Betting Grid Canvas Texture (Numbers 1-36, Red, Black, Even, Odd)
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#065f46';
  ctx.fillRect(0, 0, 512, 256);
  ctx.strokeStyle = '#fef08a';
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, 492, 236);

  // Draw 0 green spot
  ctx.fillStyle = '#16a34a';
  ctx.fillRect(16, 16, 50, 224);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 32px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('0', 41, 128);

  // Draw 12 rows of 3 numbers
  for (let col = 0; col < 12; col++) {
    for (let row = 0; row < 3; row++) {
      const num = col * 3 + (3 - row);
      const isRed = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36].includes(num);
      const x = 70 + col * 35;
      const y = 16 + row * 62;
      ctx.fillStyle = isRed ? '#b91c1c' : '#18181b';
      ctx.fillRect(x + 2, y + 2, 31, 58);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 19px sans-serif';
      ctx.fillText(String(num), x + 17, y + 31);
    }
  }

  // Draw Red / Black / Even / Odd side bets
  ctx.fillStyle = '#b91c1c';
  ctx.fillRect(70, 206, 100, 36);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('RED', 120, 224);

  ctx.fillStyle = '#18181b';
  ctx.fillRect(175, 206, 100, 36);
  ctx.fillStyle = '#ffffff';
  ctx.fillText('BLACK', 225, 224);

  ctx.fillStyle = '#047857';
  ctx.strokeStyle = '#fef08a';
  ctx.strokeRect(280, 206, 100, 36);
  ctx.fillText('EVEN', 330, 224);
  ctx.strokeRect(385, 206, 100, 36);
  ctx.fillText('ODD', 435, 224);

  const feltTex = new THREE.CanvasTexture(c);
  feltTex.colorSpace = THREE.SRGBColorSpace;
  const gridPlane = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 1.5), new THREE.MeshStandardMaterial({ map: feltTex, roughness: 0.85 }));
  gridPlane.rotation.x = -Math.PI / 2;
  gridPlane.position.set(0.65, 0.98, 0);
  g.add(gridPlane);

  // Stack of poker chips on betting layout
  const chipColors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#18181b'];
  [ [0.3, 0.2], [0.8, -0.3], [1.4, 0.1], [1.8, -0.2] ].forEach((cp, ci) => {
    for (let h = 0; h < 5; h++) {
      part(g, G.cyl(), mat(chipColors[(ci + h) % chipColors.length], { metalness: 0.2 }), [cp[0], 0.99 + h * 0.015, cp[1]], [0.1, 0.012, 0.1]);
    }
  });

  // Overhead Brass Lamp
  const lamp = new THREE.Group();
  lamp.position.set(0, 3.2, 0);
  part(lamp, G.cyl(), brassMat, [0, 0, 0], [0.03, 1.2, 0.03]);
  part(lamp, G.cone(), brassMat, [0, -0.6, 0], [0.85, 0.45, 0.85]);
  const light = new THREE.PointLight(0xfff1d6, 1.6, 6);
  light.position.set(0, -0.7, 0);
  lamp.add(light);
  g.add(lamp);

  // Floating 3D Title
  const tag = labelSprite('🎰 VÒNG QUAY ROULETTE', 'rgba(15,23,42,0.92)', '#fef08a', 0.55);
  tag.position.set(0, 2.3, 0);
  g.add(tag);

  g.userData = {
    type: 'roulette',
    rotor,
    ballGroup,
    isSpinning: false,
    speed: 0,
    ballSpeed: 0,
    spin(onComplete) {
      if (this.isSpinning) return;
      this.isSpinning = true;
      this.speed = 18.0 + Math.random() * 8.0;
      this.ballSpeed = -24.0 - Math.random() * 8.0;
      this.onComplete = onComplete;
    }
  };

  return g;
}

// ============================================================================
// 2. DUCK DERBY TRACK (TRƯỜNG ĐUA VỊT)
// ============================================================================
export function buildDuckDerbyTrack() {
  const g = new THREE.Group();

  const woodMat = mat('#78350f', { roughness: 0.5 });
  const waterMat = mat('#0284c7', { roughness: 0.1, metalness: 0.25, transparent: true, opacity: 0.88 });
  const brassMat = mat('#f59e0b', { roughness: 0.2, metalness: 0.8 });

  // Outer basin boundary (8m x 4.2m oval)
  part(g, G.box(), woodMat, [0, 0.42, 0], [8.4, 0.84, 4.4]);
  // Water canal surface
  const water = part(g, G.box(), waterMat, [0, 0.78, 0], [7.8, 0.1, 3.8]);

  // Center island divider
  part(g, G.box(), woodMat, [0, 0.55, 0], [4.6, 0.88, 1.2]);

  // Start / Finish Line Gantry Arch
  const arch = new THREE.Group();
  arch.position.set(0, 0.88, 1.3);
  part(arch, G.cyl(), brassMat, [-1.3, 1.2, 0], [0.08, 2.4, 0.08]);
  part(arch, G.cyl(), brassMat, [1.3, 1.2, 0], [0.08, 2.4, 0.08]);
  part(arch, G.box(), brassMat, [0, 2.35, 0], [2.7, 0.1, 0.1]);

  const archBanner = labelSprite('🏁 DUCK DERBY · XUẤT PHÁT 🏁', 'rgba(2,132,199,0.92)', '#ffffff', 0.52);
  archBanner.position.set(0, 2.7, 0);
  arch.add(archBanner);
  g.add(arch);

  // Build a cute Rubber Duck
  function createDuck(colorHex, numberStr) {
    const duck = new THREE.Group();
    const dMat = mat(colorHex, { roughness: 0.35, metalness: 0.05 });
    const beakMat = mat('#ea580c', { roughness: 0.4 });
    const eyeMat = mat('#09090b');

    // Body
    part(duck, G.sph(), dMat, [0, 0.18, 0], [0.42, 0.34, 0.52]);
    // Tail flip
    part(duck, G.cone(), dMat, [0, 0.24, -0.26], [0.18, 0.25, 0.18], [-0.85, 0, 0]);
    // Head
    part(duck, G.sph(), dMat, [0, 0.42, 0.16], [0.28, 0.28, 0.28]);
    // Beak
    part(duck, G.cone(), beakMat, [0, 0.38, 0.35], [0.18, 0.22, 0.1], [Math.PI / 2, 0, 0]);
    // Eyes
    part(duck, G.sph(), eyeMat, [-0.11, 0.46, 0.26], [0.04, 0.04, 0.04]);
    part(duck, G.sph(), eyeMat, [0.11, 0.46, 0.26], [0.04, 0.04, 0.04]);

    // Number Bib on chest
    const bib = labelSprite(`#${numberStr}`, 'rgba(15,23,42,0.85)', '#ffffff', 0.22);
    bib.position.set(0, 0.22, 0.28);
    duck.add(bib);

    duck.scale.setScalar(0.75);
    return duck;
  }

  // 4 Colorful Ducks positioned in starting lanes
  const duckConfigs = [
    { color: '#facc15', num: '1', name: 'Vịt Vàng Tia Chớp' },
    { color: '#ec4899', num: '2', name: 'Vịt Hồng Kiêu Kỳ' },
    { color: '#10b981', num: '3', name: 'Vịt Xanh Bão Tố' },
    { color: '#8b5cf6', num: '4', name: 'Vịt Tím Thần Tốc' },
  ];

  const ducks = [];
  duckConfigs.forEach((cfg, idx) => {
    const d = createDuck(cfg.color, cfg.num);
    const laneX = -0.75 + idx * 0.5;
    d.position.set(laneX, 0.85, 1.3);
    d.rotation.y = Math.PI / 2; // facing forward along canal
    g.add(d);
    ducks.push({
      group: d,
      cfg,
      progress: 0,
      laneOffset: laneX,
      speed: 0,
    });
  });

  // Floating Title
  const tag = labelSprite('🦆 TRƯỜNG ĐUA VỊT CAO SU', 'rgba(120,53,15,0.95)', '#fef08a', 0.55);
  tag.position.set(0, 3.2, 0);
  g.add(tag);

  g.userData = {
    type: 'duck_derby',
    ducks,
    isRacing: false,
    startRace(onFinish) {
      if (this.isRacing) return;
      this.isRacing = true;
      this.onFinish = onFinish;
      this.ducks.forEach(d => {
        d.progress = 0;
        d.speed = 0.8 + Math.random() * 0.4;
      });
    }
  };

  return g;
}

// ============================================================================
// 3. BLACKJACK TABLE (BÀN XÌ DÁCH CASINO VIP)
// ============================================================================
export function buildBlackjackTable() {
  const g = new THREE.Group();

  const woodMat = mat('#3b1a0a', { roughness: 0.35, metalness: 0.1 });
  const leatherMat = mat('#18181b', { roughness: 0.55 });
  const feltMat = mat('#064e3b', { roughness: 0.9 });
  const brassMat = mat('#d97706', { roughness: 0.2, metalness: 0.85 });

  // Semi-circular table top
  const tableCyl = part(g, G.cyl(), woodMat, [0, 0.88, 0], [4.2, 0.14, 2.6]);
  // Green felt top
  part(g, G.cyl(), feltMat, [0, 0.96, 0.05], [3.9, 0.03, 2.35]);
  // Padded leather armrest bumper
  part(g, G.torus(), leatherMat, [0, 0.97, 0], [2.05, 2.05, 2.05], [Math.PI / 2, 0, 0]);

  // Center Pedestal Base with brass ring
  part(g, G.cyl(), woodMat, [0, 0.44, 0], [1.1, 0.88, 1.1]);
  part(g, G.torus(), brassMat, [0, 0.08, 0], [0.95, 0.95, 0.95], [Math.PI / 2, 0, 0]);

  // Blackjack Felt Markings Canvas
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#064e3b';
  ctx.fillRect(0, 0, 512, 256);

  ctx.strokeStyle = '#fef08a';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(256, 40, 190, 0, Math.PI);
  ctx.stroke();

  ctx.fillStyle = '#fef08a';
  ctx.font = 'bold 22px serif';
  ctx.textAlign = 'center';
  ctx.fillText('BLACKJACK PAYS 3 TO 2', 256, 110);
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText('Dealer must draw to 16 and stand on all 17s', 256, 135);
  ctx.fillText('INSURANCE PAYS 2 TO 1', 256, 155);

  // 3 Player betting circles
  [120, 256, 392].forEach(bx => {
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(bx, 195, 28, 0, Math.PI * 2);
    ctx.stroke();
  });

  const feltTex = new THREE.CanvasTexture(c);
  feltTex.colorSpace = THREE.SRGBColorSpace;
  const feltMesh = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.8), new THREE.MeshStandardMaterial({ map: feltTex, roughness: 0.85 }));
  feltMesh.rotation.x = -Math.PI / 2;
  feltMesh.position.set(0, 0.98, 0.15);
  g.add(feltMesh);

  // Acrylic Dealing Shoe & Discard Holder
  const acrylicMat = mat('#38bdf8', { transparent: true, opacity: 0.65, roughness: 0.1 });
  part(g, G.box(), acrylicMat, [-1.2, 1.05, -0.4], [0.25, 0.18, 0.5], [0, 0.4, 0.2]);
  part(g, G.box(), acrylicMat, [1.2, 1.03, -0.4], [0.22, 0.15, 0.35]);

  // Dealer Chip Tray
  part(g, G.box(), mat('#09090b', { metalness: 0.4 }), [0, 1.0, -0.55], [1.1, 0.08, 0.28]);
  for (let ci = 0; ci < 6; ci++) {
    const cx = -0.4 + ci * 0.16;
    const chipCol = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#18181b', '#8b5cf6'][ci];
    for (let h = 0; h < 6; h++) {
      part(g, G.cyl(), mat(chipCol, { metalness: 0.2 }), [cx, 1.03 + h * 0.015, -0.55], [0.08, 0.012, 0.08]);
    }
  }

  // 3 Casino Swivel Barstools (Opposite dealer side)
  [-1.25, 0, 1.25].forEach(sx => {
    const stool = new THREE.Group();
    stool.position.set(sx, 0, 1.35);
    part(stool, G.cyl(), brassMat, [0, 0.32, 0], [0.06, 0.64, 0.06]);
    part(stool, G.cyl(), brassMat, [0, 0.02, 0], [0.45, 0.04, 0.45]);
    part(stool, G.cyl(), leatherMat, [0, 0.66, 0], [0.44, 0.12, 0.44]);
    g.add(stool);
  });

  // Floating Title
  const tag = labelSprite('🃏 BÀN XÌ DÁCH CASINO (BLACKJACK)', 'rgba(6,78,59,0.95)', '#fef08a', 0.55);
  tag.position.set(0, 2.4, 0);
  g.add(tag);

  g.userData = {
    type: 'blackjack',
    dealHand(onResult) {
      if (onResult) onResult();
    }
  };

  return g;
}

// ============================================================================
// 4. SLOT MACHINE (MÁY ĐÁNH BẠC 777)
// ============================================================================
export function buildSlotMachine() {
  const g = new THREE.Group();

  const chromeMat = mat('#cbd5e1', { roughness: 0.15, metalness: 0.85 });
  const darkMat = mat('#0f172a', { roughness: 0.4 });
  const neonPink = mat('#f43f5e', { emissive: '#e11d48', emissiveIntensity: 0.8 });
  const neonCyan = mat('#06b6d4', { emissive: '#0891b2', emissiveIntensity: 0.8 });
  const goldMat = mat('#f59e0b', { roughness: 0.2, metalness: 0.85 });

  // Main Cabinet Body (approx 1.2m wide, 2.2m tall, 0.9m deep)
  part(g, G.box(), darkMat, [0, 1.1, 0], [1.1, 2.2, 0.85]);
  part(g, G.box(), chromeMat, [0, 1.1, 0.43], [1.14, 2.24, 0.06]); // Chrome trim frame

  // Top Lightbox Marquee: "777 JACKPOT"
  part(g, G.box(), goldMat, [0, 2.05, 0.46], [1.02, 0.35, 0.12]);
  const marqueeTag = labelSprite('💎 777 JACKPOT 💎', 'rgba(245,158,11,0.95)', '#ffffff', 0.38);
  marqueeTag.position.set(0, 2.05, 0.53);
  g.add(marqueeTag);

  // Side Neon Glow Strip Bars
  part(g, G.box(), neonPink, [-0.56, 1.1, 0.44], [0.04, 2.0, 0.04]);
  part(g, G.box(), neonCyan, [0.56, 1.1, 0.44], [0.04, 2.0, 0.04]);

  // Display Window Glass
  const glassMat = mat('#38bdf8', { transparent: true, opacity: 0.4, roughness: 0.1 });
  part(g, G.box(), glassMat, [0, 1.45, 0.44], [0.88, 0.55, 0.04]);

  // 3 Spinning Cylindrical Reels
  const reels = [];
  const reelMat = mat('#ffffff', { roughness: 0.3 });
  [-0.26, 0, 0.26].forEach(rx => {
    const reel = new THREE.Group();
    reel.position.set(rx, 1.45, 0.36);
    reel.rotation.z = Math.PI / 2; // spin around X axis

    const cyl = part(reel, G.cyl(), reelMat, [0, 0, 0], [0.38, 0.22, 0.38]);

    // Add colorful symbol bands
    const symbols = ['7️⃣', '💎', '🍒', '🔔', '🍀', '⭐'];
    symbols.forEach((sym, sIdx) => {
      const sAngle = (sIdx / symbols.length) * Math.PI * 2;
      const spr = emojiSprite(sym, 0.18);
      spr.position.set(Math.cos(sAngle) * 0.21, 0, Math.sin(sAngle) * 0.21);
      spr.rotation.y = -sAngle;
      reel.add(spr);
    });

    g.add(reel);
    reels.push({ group: reel, angle: 0, speed: 0, targetAngle: 0, stopped: true });
  });

  // Pull Lever Assembly (Right Side)
  const leverGroup = new THREE.Group();
  leverGroup.position.set(0.62, 1.35, 0);

  // Base pivot
  part(leverGroup, G.cyl(), chromeMat, [0, 0, 0], [0.12, 0.12, 0.12], [0, 0, Math.PI / 2]);

  // Lever Shaft & Red Knob
  const leverArm = new THREE.Group();
  part(leverArm, G.cyl(), chromeMat, [0, 0.32, 0], [0.03, 0.64, 0.03]);
  part(leverArm, G.sph(), mat('#dc2626', { roughness: 0.2, metalness: 0.2 }), [0, 0.66, 0], [0.12, 0.12, 0.12]);
  leverGroup.add(leverArm);
  g.add(leverGroup);

  // Coin Tray at the bottom
  part(g, G.box(), chromeMat, [0, 0.25, 0.48], [0.85, 0.22, 0.25]);
  // Golden coins in tray
  for (let ci = 0; ci < 8; ci++) {
    const cx = -0.28 + (ci % 4) * 0.18;
    const cz = 0.42 + Math.floor(ci / 4) * 0.1;
    part(g, G.cyl(), goldMat, [cx, 0.32, cz], [0.07, 0.015, 0.07]);
  }

  // Floating Title
  const tag = labelSprite('🎰 MÁY ĐÁNH BẠC 777', 'rgba(15,23,42,0.95)', '#fef08a', 0.52);
  tag.position.set(0, 2.5, 0);
  g.add(tag);

  g.userData = {
    type: 'slot_machine',
    reels,
    leverArm,
    isSpinning: false,
    pullLever(onResult) {
      if (this.isSpinning) return;
      this.isSpinning = true;
      this.leverArm.rotation.x = 0.85; // pull forward/down
      setTimeout(() => { this.leverArm.rotation.x = 0; }, 320);

      this.reels.forEach((r, idx) => {
        r.speed = 22.0 + idx * 4.0;
        r.stopped = false;
        setTimeout(() => {
          r.stopped = true;
        }, 1200 + idx * 600);
      });

      setTimeout(() => {
        this.isSpinning = false;
        if (onResult) onResult();
      }, 2600);
    }
  };

  return g;
}

// ============================================================================
// 5. PLINKO BOARD (THÁP THẢ BÓNG PLINKO)
// ============================================================================
export function buildPlinkoBoard() {
  const g = new THREE.Group();

  const darkMat = mat('#0b0f19', { roughness: 0.35 });
  const brassMat = mat('#fbbf24', { roughness: 0.15, metalness: 0.9 });
  const neonCyan = mat('#06b6d4', { emissive: '#0891b2', emissiveIntensity: 0.85 });
  const neonPink = mat('#f43f5e', { emissive: '#e11d48', emissiveIntensity: 0.85 });
  const acrylicMat = mat('#38bdf8', { transparent: true, opacity: 0.35, roughness: 0.1 });

  // Stand & Backboard (Approx 2.4m wide, 3.4m tall, 0.4m deep)
  part(g, G.box(), darkMat, [0, 1.8, 0], [2.6, 3.5, 0.22]);
  part(g, G.box(), acrylicMat, [0, 1.8, 0.14], [2.4, 3.3, 0.04]); // Clear acrylic front plate

  // Triangular Neon Borders
  part(g, G.box(), neonCyan, [-1.22, 1.8, 0.14], [0.06, 3.3, 0.06]);
  part(g, G.box(), neonPink, [1.22, 1.8, 0.14], [0.06, 3.3, 0.06]);

  // Top Drop Funnel
  part(g, G.cone(), brassMat, [0, 3.4, 0.12], [0.45, 0.35, 0.45], [Math.PI, 0, 0]);

  // Triangular Grid of Brass Pegs / Pins (9 Rows, staggered)
  const pegs = [];
  const rows = 9;
  for (let r = 0; r < rows; r++) {
    const pinsInRow = r + 3;
    const y = 3.1 - r * 0.28;
    const spacing = 0.22;
    const startX = -((pinsInRow - 1) * spacing) / 2;
    for (let c = 0; c < pinsInRow; c++) {
      const px = startX + c * spacing;
      const pegMesh = part(g, G.cyl(), brassMat, [px, y, 0.1], [0.028, 0.1, 0.028], [Math.PI / 2, 0, 0]);
      pegs.push({ x: px, y, mesh: pegMesh });
    }
  }

  // Bottom Reward Bins with Multipliers: [100x, 29x, 5x, 2x, 0.5x, 0.2x, 0.5x, 2x, 5x, 29x, 100x]
  const multipliers = ['100x', '29x', '5x', '2x', '0.5x', '0.2x', '0.5x', '2x', '5x', '29x', '100x'];
  const binColors = ['#dc2626', '#ea580c', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#06b6d4', '#22c55e', '#eab308', '#ea580c', '#dc2626'];
  const binW = 2.1 / multipliers.length;
  multipliers.forEach((mult, bi) => {
    const bx = -1.05 + bi * binW + binW / 2;
    part(g, G.box(), mat(binColors[bi], { emissive: binColors[bi], emissiveIntensity: 0.35 }), [bx, 0.36, 0.12], [binW * 0.9, 0.24, 0.15]);
    part(g, G.box(), darkMat, [bx - binW / 2, 0.38, 0.12], [0.02, 0.3, 0.16]); // divider nail
  });

  // Floating Title
  const tag = labelSprite('🟡 THÁP THẢ BÓNG PLINKO', 'rgba(11,15,25,0.95)', '#fef08a', 0.55);
  tag.position.set(0, 3.8, 0);
  g.add(tag);

  g.userData = {
    type: 'plinko',
    pegs,
    activeBalls: [],
    dropBall(onLand) {
      const ballMat = mat('#facc15', { emissive: '#eab308', emissiveIntensity: 0.75, roughness: 0.2 });
      const b = part(g, G.sph(), ballMat, [ (Math.random() - 0.5) * 0.08, 3.35, 0.12 ], [0.07, 0.07, 0.07]);
      this.activeBalls.push({
        mesh: b,
        x: b.position.x,
        y: b.position.y,
        vx: (Math.random() - 0.5) * 0.3,
        vy: 0,
        onLand,
      });
    }
  };

  return g;
}

// ============================================================================
// 6. SECRET CASINO ENTRANCES & PAPER NOTES
// ============================================================================
let pinNoteTex = null;
function getPinNoteTexture() {
  if (!pinNoteTex) {
    pinNoteTex = new THREE.TextureLoader().load('assets/pin_note.jpg');
    pinNoteTex.colorSpace = THREE.SRGBColorSpace;
  }
  return pinNoteTex;
}

export function buildSecretPaperNote(code) {
  const g = new THREE.Group();
  const tex = getPinNoteTexture();
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(0.65, 0.65, 1);
  sprite.position.y = 0.95;
  g.add(sprite);

  // Floating label indicator
  const lbl = labelSprite('📌 MẢNH GIẤY BÍ MẬT', 'rgba(120,53,15,0.85)', '#fef08a', 0.28);
  lbl.position.y = 1.45;
  g.add(lbl);

  g.userData = { type: 'secret_note', code };
  return g;
}

export function buildSecretPassage(theme) {
  const g = new THREE.Group();
  const colors = {
    christmas: 0x38bdf8,
    halloween: 0xa855f7,
    tet: 0xfacc15,
    valentine: 0xf43f5e,
  };
  const col = colors[theme] || 0xfacc15;

  // Swirling magic ring portal on floor
  const ringGeom = new THREE.RingGeometry(0.6, 1.15, 24);
  ringGeom.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({
    color: col,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.75,
  });
  const ring = new THREE.Mesh(ringGeom, ringMat);
  ring.position.y = 0.04;
  g.add(ring);

  // Soft glowing column light
  const light = new THREE.PointLight(col, 2.2, 5);
  light.position.y = 1.1;
  g.add(light);

  // Floating title tag
  const tag = labelSprite('🗝️ LỐI VÀO MẬT THẤT', 'rgba(15,23,42,0.92)', '#fef08a', 0.42);
  tag.position.y = 1.95;
  g.add(tag);

  g.userData = { type: 'secret_passage', ring };
  return g;
}

export function buildCasinoExitPortal() {
  const g = new THREE.Group();
  // Classic brass framed speakeasy exit door
  const doorMat = mat('#3b1a0a', { roughness: 0.4 });
  const brassMat = mat('#f59e0b', { roughness: 0.2, metalness: 0.8 });
  part(g, G.box(), doorMat, [0, 1.3, 0], [1.4, 2.6, 0.15]);
  part(g, G.box(), brassMat, [0, 2.6, 0.1], [1.2, 0.35, 0.08]);

  const tag = labelSprite('🚪 LỐI RA THẾ GIỚI TRÊN', 'rgba(15,23,42,0.92)', '#fef08a', 0.45);
  tag.position.set(0, 2.6, 0.16);
  g.add(tag);

  g.userData = { type: 'casino_exit' };
  return g;
}

// ============================================================================
// 7. ILLUSION WALL (BỨC TƯỜNG ẢO ẢNH ĐI XUYÊN QUA)
// ============================================================================
export function buildIllusionWall(themeKey) {
  const g = new THREE.Group();
  const themeColors = {
    christmas: { base: '#cbd5e1', glow: '#38bdf8', rune: '❄️' },
    halloween: { base: '#18181b', glow: '#a855f7', rune: '💀' },
    tet: { base: '#7f1d1d', glow: '#facc15', rune: '🏮' },
    valentine: { base: '#831843', glow: '#f43f5e', rune: '💖' },
  };
  const cfg = themeColors[themeKey] || themeColors.christmas;

  const wallMat = mat(cfg.base, {
    roughness: 0.45,
    transparent: true,
    opacity: 0.94,
  });
  part(g, G.box(), wallMat, [0, 0.8, 0], [2.1, 1.6, 0.35]);

  const runeMat = mat(cfg.glow, {
    emissive: cfg.glow,
    emissiveIntensity: 0.85,
    roughness: 0.2,
  });
  part(g, G.box(), runeMat, [-1.02, 0.8, 0.18], [0.06, 1.58, 0.04]);
  part(g, G.box(), runeMat, [1.02, 0.8, 0.18], [0.06, 1.58, 0.04]);
  part(g, G.box(), runeMat, [0, 1.58, 0.18], [2.1, 0.06, 0.04]);

  const spr = emojiSprite(cfg.rune, 0.32);
  spr.position.set(0, 1.0, 0.2);
  g.add(spr);

  g.userData = { type: 'illusion_wall' };
  return g;
}

// ============================================================================
// 8. CASINO VIP PUB & BOUTIQUE COUNTER
// ============================================================================
export function buildCasinoPubBar() {
  const g = new THREE.Group();

  const woodMat = mat('#3b1a0a', { roughness: 0.35 });
  const marbleMat = mat('#0f172a', { roughness: 0.15, metalness: 0.1 });
  const brassMat = mat('#f59e0b', { roughness: 0.2, metalness: 0.85 });
  const glassMat = mat('#38bdf8', { transparent: true, opacity: 0.45, roughness: 0.1 });

  part(g, G.box(), woodMat, [0, 0.52, 0], [5.4, 1.04, 1.2]);
  part(g, G.box(), marbleMat, [0, 1.06, 0], [5.6, 0.08, 1.35]);
  part(g, G.box(), brassMat, [0, 0.08, 0.65], [5.4, 0.06, 0.06]);

  const backShelf = new THREE.Group();
  backShelf.position.set(0, 0, -1.2);
  part(backShelf, G.box(), woodMat, [0, 1.4, 0], [5.2, 2.6, 0.4]);
  const bottleColors = ['#ef4444', '#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#06b6d4'];
  for (let s = 0; s < 3; s++) {
    const sy = 0.8 + s * 0.7;
    part(backShelf, G.box(), brassMat, [0, sy, 0.18], [5.0, 0.04, 0.32]);
    for (let b = 0; b < 12; b++) {
      const bx = -2.2 + b * 0.4;
      const col = bottleColors[(b + s) % bottleColors.length];
      const botMat = mat(col, { transparent: true, opacity: 0.75, roughness: 0.1 });
      part(backShelf, G.cyl(), botMat, [bx, sy + 0.18, 0.18], [0.08, 0.32, 0.08]);
      part(backShelf, G.cyl(), brassMat, [bx, sy + 0.36, 0.18], [0.03, 0.08, 0.03]);
    }
  }
  g.add(backShelf);

  [-2.0, -0.68, 0.68, 2.0].forEach(sx => {
    const stool = new THREE.Group();
    stool.position.set(sx, 0, 1.15);
    part(stool, G.cyl(), brassMat, [0, 0.36, 0], [0.06, 0.72, 0.06]);
    part(stool, G.cyl(), brassMat, [0, 0.02, 0], [0.42, 0.04, 0.42]);
    part(stool, G.cyl(), mat('#831843', { roughness: 0.5 }), [0, 0.74, 0], [0.44, 0.12, 0.44]);
    g.add(stool);
  });

  const sign = labelSprite('🍸 VIP PUB & FASHION BOUTIQUE 👑', 'rgba(120,53,15,0.95)', '#fef08a', 0.56);
  sign.position.set(0, 3.1, 0);
  g.add(sign);

  part(g, G.cyl(), mat('#cbd5e1', { metalness: 0.9, roughness: 0.1 }), [-0.6, 1.25, 0.15], [0.12, 0.32, 0.12]);
  part(g, G.cone(), glassMat, [0.6, 1.22, 0.15], [0.12, 0.16, 0.12]);

  g.userData = { type: 'casino_pub' };
  return g;
}

// ============================================================================
// 9. 3D AVATAR ACCESSORIES & WEARABLES
// ============================================================================
export function buildAccessoryMesh(type) {
  const g = new THREE.Group();
  const goldMat = mat('#f59e0b', { roughness: 0.15, metalness: 0.85 });
  const rubyMat = mat('#ef4444', { emissive: '#dc2626', emissiveIntensity: 0.5 });
  const blackMat = mat('#18181b', { roughness: 0.4 });
  const whiteMat = mat('#f8fafc', { roughness: 0.3 });

  switch (type) {
    case 'crown': {
      part(g, G.cyl(), goldMat, [0, 0.06, 0], [0.42, 0.1, 0.42]);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const cx = Math.cos(a) * 0.19;
        const cz = Math.sin(a) * 0.19;
        part(g, G.cone(), goldMat, [cx, 0.18, cz], [0.08, 0.18, 0.08]);
        part(g, G.sph(), rubyMat, [cx, 0.28, cz], [0.04, 0.04, 0.04]);
      }
      break;
    }
    case 'cowboy_hat': {
      const leather = mat('#78350f', { roughness: 0.6 });
      part(g, G.cyl(), leather, [0, 0.04, 0], [0.68, 0.04, 0.58]);
      part(g, G.cyl(), leather, [0, 0.22, 0], [0.38, 0.32, 0.34]);
      part(g, G.torus(), goldMat, [0, 0.08, 0], [0.39, 0.39, 0.39], [Math.PI / 2, 0, 0]);
      break;
    }
    case 'top_hat': {
      part(g, G.cyl(), blackMat, [0, 0.03, 0], [0.62, 0.04, 0.62]);
      part(g, G.cyl(), blackMat, [0, 0.28, 0], [0.38, 0.46, 0.38]);
      part(g, G.cyl(), mat('#dc2626'), [0, 0.08, 0], [0.39, 0.07, 0.39]);
      break;
    }
    case 'cat_ears': {
      const earMat = mat('#1e293b');
      const pinkMat = mat('#f472b6');
      [-0.14, 0.14].forEach(x => {
        part(g, G.cone(), earMat, [x, 0.15, 0], [0.12, 0.24, 0.08], [0, 0, x > 0 ? -0.2 : 0.2]);
        part(g, G.cone(), pinkMat, [x, 0.14, 0.02], [0.07, 0.18, 0.04], [0, 0, x > 0 ? -0.2 : 0.2]);
      });
      break;
    }
    case 'shades': {
      const frameMat = mat('#f59e0b', { metalness: 0.9, roughness: 0.1 });
      const lensMat = mat('#020617', { metalness: 0.8, roughness: 0.1 });
      part(g, G.box(), lensMat, [-0.09, 0, 0.2], [0.14, 0.09, 0.03]);
      part(g, G.box(), lensMat, [0.09, 0, 0.2], [0.14, 0.09, 0.03]);
      part(g, G.box(), frameMat, [0, 0.02, 0.2], [0.26, 0.015, 0.03]);
      break;
    }
    case 'hacker_mask': {
      part(g, G.sph(), whiteMat, [0, -0.04, 0.18], [0.38, 0.38, 0.14]);
      part(g, G.box(), mat('#dc2626'), [0, -0.14, 0.26], [0.18, 0.04, 0.02]);
      part(g, G.box(), blackMat, [-0.08, 0.02, 0.26], [0.08, 0.03, 0.02]);
      part(g, G.box(), blackMat, [0.08, 0.02, 0.26], [0.08, 0.03, 0.02]);
      break;
    }
    case 'astronaut_helmet': {
      const domeMat = mat('#f1f5f9', { roughness: 0.2 });
      const visorMat = mat('#fbbf24', { metalness: 0.95, roughness: 0.05 });
      part(g, G.sph(), domeMat, [0, 0.05, 0], [0.52, 0.52, 0.52]);
      part(g, G.sph(), visorMat, [0, 0.05, 0.14], [0.42, 0.34, 0.32]);
      break;
    }
    case 'halo': {
      const haloMat = mat('#fef08a', { emissive: '#facc15', emissiveIntensity: 1.2 });
      part(g, G.torus(), haloMat, [0, 0.42, 0], [0.28, 0.28, 0.28], [Math.PI / 2, 0, 0]);
      break;
    }
    case 'devil_wings': {
      const wingMat = mat('#450a0a', { roughness: 0.4 });
      const boneMat = mat('#991b1b', { metalness: 0.6 });
      [-1, 1].forEach(side => {
        const wing = new THREE.Group();
        wing.position.set(side * 0.15, 0.2, -0.16);
        wing.rotation.y = side * 0.45;
        part(wing, G.cone(), boneMat, [side * 0.4, 0.28, 0], [0.05, 0.85, 0.05], [0, 0, -side * 0.9]);
        part(wing, G.box(), wingMat, [side * 0.35, 0.05, 0], [0.65, 0.45, 0.03]);
        g.add(wing);
      });
      break;
    }
    case 'viking_helmet': {
      const ironMat = mat('#64748b', { metalness: 0.8, roughness: 0.3 });
      const hornMat = mat('#fef08a', { roughness: 0.4 });
      part(g, G.sph(), ironMat, [0, 0.1, 0], [0.42, 0.28, 0.42]);
      part(g, G.torus(), goldMat, [0, 0.04, 0], [0.42, 0.42, 0.42], [Math.PI / 2, 0, 0]);
      [-1, 1].forEach(side => {
        part(g, G.cone(), hornMat, [side * 0.28, 0.22, 0], [0.08, 0.36, 0.08], [0, 0, -side * 0.6]);
      });
      break;
    }
    case 'party_hat': {
      const coneMat = mat('#ec4899', { roughness: 0.3 });
      const pomMat = mat('#38bdf8', { roughness: 0.4 });
      part(g, G.cone(), coneMat, [0, 0.26, 0], [0.24, 0.52, 0.24]);
      part(g, G.sph(), pomMat, [0, 0.54, 0], [0.07, 0.07, 0.07]);
      part(g, G.torus(), goldMat, [0, 0.02, 0], [0.24, 0.24, 0.24], [Math.PI / 2, 0, 0]);
      break;
    }
    case 'golden_laurel': {
      const leafMat = mat('#fbbf24', { metalness: 0.9, roughness: 0.1 });
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 1.6 - Math.PI * 0.8;
        const lx = Math.sin(a) * 0.36;
        const lz = Math.cos(a) * 0.36;
        part(g, G.box(), leafMat, [lx, 0.08, lz], [0.08, 0.04, 0.02], [0, a, 0.2]);
      }
      break;
    }
    case 'cyber_visor': {
      const neonCyan = mat('#06b6d4', { emissive: '#22d3ee', emissiveIntensity: 1.4 });
      const frameDark = mat('#09090b', { roughness: 0.2, metalness: 0.9 });
      part(g, G.box(), frameDark, [0, 0.02, 0.2], [0.38, 0.08, 0.06]);
      part(g, G.box(), neonCyan, [0, 0.02, 0.23], [0.34, 0.05, 0.02]);
      break;
    }
  }

  return g;
}

// ============================================================================
// 10. 3D AVATAR AURAS & PARTICLES
// ============================================================================
export function buildAuraMesh(auraType) {
  const g = new THREE.Group();
  const rawKey = String(auraType || 'gold').toLowerCase().trim();
  const key = rawKey.replace(/^aura_/, '');
  const auraConfigs = {
    gold: { col: 0xfacc15, count: 18, radius: 0.85 },
    fire: { col: 0xef4444, count: 20, radius: 0.8 },
    frost: { col: 0x38bdf8, count: 18, radius: 0.85 },
    hearts: { col: 0xf43f5e, count: 16, radius: 0.75 },
    lightning: { col: 0xa855f7, count: 22, radius: 0.9 },
    cosmic: { col: 0x8b5cf6, count: 24, radius: 0.95 },
    nature: { col: 0x10b981, count: 20, radius: 0.85 },
    sakura: { col: 0xf472b6, count: 20, radius: 0.85 },
    void: { col: 0x991b1b, count: 26, radius: 1.0 },
    admin: { col: 0xffd700, count: 28, radius: 1.1 },
  };
  const cfg = auraConfigs[key] || auraConfigs[rawKey] || auraConfigs.gold;

  const particles = [];
  const pMat = new THREE.MeshBasicMaterial({ color: cfg.col });
  for (let i = 0; i < cfg.count; i++) {
    const mesh = new THREE.Mesh(G.sph(), pMat);
    const sz = auraType === 'admin' ? 0.08 : 0.06;
    mesh.scale.set(sz, sz, sz);
    g.add(mesh);
    particles.push({
      mesh,
      angle: (i / cfg.count) * Math.PI * 2,
      speed: 1.5 + (i % 3) * 0.4,
      yOffset: (i / cfg.count) * 1.6,
      radius: cfg.radius * (0.8 + (i % 4) * 0.1),
    });
  }

  const ringGeo = new THREE.RingGeometry(cfg.radius * 0.8, cfg.radius * 1.15, 24);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({
    color: cfg.col,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.55,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.position.y = 0.04;
  g.add(ring);

  g.userData = {
    type: 'aura',
    particles,
    ring,
    update(time) {
      ring.rotation.y = time * 0.6;
      particles.forEach(p => {
        p.angle += 0.04 * p.speed;
        p.mesh.position.set(
          Math.cos(p.angle) * p.radius,
          0.2 + ((p.yOffset + time * 0.5) % 1.7),
          Math.sin(p.angle) * p.radius
        );
      });
    },
  };

  return g;
}
