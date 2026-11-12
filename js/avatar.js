// Articulated 3D Human Character with Costumes, Wearable Pumpkin Hats, Held Props & Rich Animations.
import * as THREE from 'three';
import { COSTUMES } from './themes.js';
import { buildCarvedPumpkin, buildOrnamentMesh, buildAccessoryMesh, buildAuraMesh, G, mat, part } from './props.js';
import { getFaceCanvasTexture } from './avatar_customizer.js';

const HEIGHT = 1.72;
const _headPos = new THREE.Vector3();
export const loadCharacter = async () => true;

// Social & Interactive Emote Mapping
export const EMOTE_CLIP = {
  '👋': 'wave',
  '🤝': 'handshake',
  '🤗': 'hug',
  '🍬': 'trickOrTreat',
  '🍅': 'throwTomato',
  '🍡': 'roast',
  '☕': 'cocoa',
  '😱': 'scared',
  '✨': 'interact',
  '💪': 'flex',
  '🕺': 'cheer_jump',
  '⭐': 'starfish',
  '🙆': 'head_heart',
  '🙇': 'despair',
  '😎': 'dab',
  '🛌': 'lay_chill',
  '🧎': 'kneel',
};

const EMOTE_DURATION = {
  wave: 2600,
  handshake: 2800,
  hug: 3000,
  trickOrTreat: 2800,
  throwTomato: 1600,
  roast: 4500,
  cocoa: 4200,
  scared: 2400,
  interact: 1800,
  flex: 6000,
  cheer_jump: 6000,
  starfish: 6000,
  head_heart: 6000,
  despair: 6500,
  dab: 6000,
  lay_chill: 7000,
  kneel: 7000,
};

export const NAMETAG_STYLES = {
  rainbow: { rainbow: true, border: '#f43f5e' },
  tag_gold: { color: '#facc15', border: '#eab308' },
  tag_emerald: { color: '#34d399', border: '#10b981' },
  tag_amethyst: { color: '#c084fc', border: '#a855f7' },
  tag_ice: { color: '#38bdf8', border: '#0284c7' },
  tag_rainbow: { rainbow: true, border: '#f43f5e' },
  tag_neon_pink: { color: '#f472b6', border: '#ec4899' },
  tag_cyber_cyan: { color: '#22d3ee', border: '#06b6d4' },
  tag_crimson_fire: { color: '#fb7185', border: '#e11d48' },
  tag_phantom_purple: { color: '#e879f9', border: '#c026d3' },
  gold: { color: '#facc15', border: '#eab308' },
  emerald: { color: '#34d399', border: '#10b981' },
  amethyst: { color: '#c084fc', border: '#a855f7' },
  ice: { color: '#38bdf8', border: '#0284c7' },
};

export function resolveNametagStyle(s) {
  if (!s) return null;
  if (typeof s === 'object') return s;
  const key = String(s).toLowerCase().trim();
  return NAMETAG_STYLES[key] || NAMETAG_STYLES[key.replace(/^tag_/, '')] || { color: s };
}

function textSprite(draw, w, h, worldH) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  draw(ctx, w, h, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false }));
  s.scale.set((worldH * w) / h, worldH, 1);
  s.renderOrder = 10;
  s.userData = { canvas: c, ctx, draw, w, h, texture: t };
  return s;
}

export function isAdminUser(name) {
  if (!name) return false;
  const n = String(name).trim().toLowerCase();
  return (
    n.includes('chu0n6') ||
    n.includes('chuong') ||
    n.includes('trung') ||
    n.includes('lukhachyaros') ||
    n.includes('khoa')
  );
}

// ============================================================================
// PROCEDURAL CANVAS TEXTURES FOR CLASSIC FACES & CLOTHING
// ============================================================================

const faceTexCache = new Map();
export function getFaceTexture(key) {
  if (faceTexCache.has(key)) return faceTexCache.get(key);
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 256, 256);

  if (key === 'smile') {
    // Classic Roblox Smile (2006)
    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.arc(80, 95, 14, 0, Math.PI * 2);
    ctx.arc(176, 95, 14, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(128, 130, 50, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  } else if (key === 'man') {
    // Roblox Man Face 😎
    ctx.fillStyle = '#111827';
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    // Sharp masculine brows
    ctx.beginPath();
    ctx.moveTo(45, 75);
    ctx.lineTo(105, 60);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(151, 60);
    ctx.lineTo(211, 75);
    ctx.stroke();

    // Seductive eyes with white sparkle
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.ellipse(78, 100, 24, 11, 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(178, 100, 24, 11, -0.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(84, 98, 4.5, 0, Math.PI * 2);
    ctx.arc(184, 98, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // Half smirking mouth
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(142, 142, 38, 0.05 * Math.PI, 0.72 * Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(182, 144);
    ctx.lineTo(194, 134);
    ctx.stroke();

    // Chiseled chin
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(128, 205, 14, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.stroke();
  } else if (key === 'troll') {
    // Troll Face
    ctx.fillStyle = '#111827';
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    // Forehead wrinkles
    ctx.beginPath();
    ctx.arc(128, 65, 42, 1.1 * Math.PI, 1.9 * Math.PI);
    ctx.stroke();

    // Eyes
    ctx.beginPath();
    ctx.arc(80, 95, 11, 0, Math.PI * 2);
    ctx.arc(176, 95, 11, 0, Math.PI * 2);
    ctx.fill();

    // Wide grin
    ctx.beginPath();
    ctx.arc(128, 132, 66, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.lineTo(60, 142);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.stroke();

    ctx.lineWidth = 3.5;
    for (let x = 80; x <= 176; x += 16) {
      ctx.beginPath();
      ctx.moveTo(x, 138);
      ctx.lineTo(x, 172);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(68, 154);
    ctx.lineTo(188, 154);
    ctx.stroke();
  } else if (key === 'chills') {
    // Winning Smile (Chills)
    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.arc(76, 90, 15, 0, Math.PI * 2);
    ctx.arc(180, 90, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(80, 88, 4, 0, Math.PI * 2);
    ctx.arc(184, 88, 4, 0, Math.PI * 2);
    ctx.fill();

    // Open teeth grin
    ctx.beginPath();
    ctx.arc(128, 125, 54, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 9;
    ctx.stroke();

    ctx.lineWidth = 3.5;
    for (let x = 94; x <= 162; x += 17) {
      ctx.beginPath();
      ctx.moveTo(x, 130);
      ctx.lineTo(x, 160);
      ctx.stroke();
    }
  } else if (key === 'joy') {
    // Super Happy Face ^ ^
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 11;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(78, 105, 24, 1.15 * Math.PI, 1.85 * Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(178, 105, 24, 1.15 * Math.PI, 1.85 * Math.PI);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(128, 130, 48, 0.12 * Math.PI, 0.88 * Math.PI);
    ctx.closePath();
    ctx.fillStyle = '#991b1b';
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#f43f5e';
    ctx.beginPath();
    ctx.arc(128, 160, 24, 0.8 * Math.PI, 0.2 * Math.PI);
    ctx.fill();

    ctx.fillStyle = '#fb7185';
    ctx.beginPath();
    ctx.ellipse(48, 130, 16, 10, 0, 0, Math.PI * 2);
    ctx.ellipse(208, 130, 16, 10, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (key === 'checkit') {
    // Check It
    ctx.fillStyle = '#111827';
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';

    ctx.beginPath();
    ctx.moveTo(50, 68);
    ctx.lineTo(105, 52);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(78, 92, 14, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(156, 92);
    ctx.lineTo(178, 102);
    ctx.lineTo(202, 90);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(138, 136, 42, 0.1 * Math.PI, 0.76 * Math.PI);
    ctx.stroke();
  } else if (key === 'silly') {
    // Silly Tongue :P
    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.arc(75, 90, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(181, 94, 9, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(128, 132, 38, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.closePath();
    ctx.fillStyle = '#7f1d1d';
    ctx.fill();

    ctx.fillStyle = '#f43f5e';
    ctx.beginPath();
    ctx.ellipse(140, 164, 18, 26, 0.15, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(128, 132, 38, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  } else if (key === 'sinister') {
    // Sinister Grin
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(50, 65);
    ctx.lineTo(105, 88);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(206, 65);
    ctx.lineTo(151, 88);
    ctx.stroke();

    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.moveTo(58, 98);
    ctx.lineTo(98, 105);
    ctx.lineTo(65, 114);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(198, 98);
    ctx.lineTo(158, 105);
    ctx.lineTo(191, 114);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(128, 138, 48, 0.12 * Math.PI, 0.88 * Math.PI);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  faceTexCache.set(key, tex);
  return tex;
}

const tshirtTexCache = new Map();
export function getTshirtDecalTexture(key) {
  if (tshirtTexCache.has(key)) return tshirtTexCache.get(key);
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 256, 256);

  if (key === 'roblox_logo') {
    // Classic Roblox Red "R" tilt logo
    ctx.save();
    ctx.translate(128, 128);
    ctx.rotate(-0.16);
    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.roundRect(-86, -86, 172, 172, 28);
    ctx.fill();

    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.roundRect(-78, -78, 156, 156, 24);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(-24, -24, 48, 48, 8);
    ctx.fill();
    ctx.restore();
  } else if (key === 'doge') {
    // Doge Meme
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(128, 128, 80, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(60, 80);
    ctx.lineTo(80, 25);
    ctx.lineTo(105, 65);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(196, 80);
    ctx.lineTo(176, 25);
    ctx.lineTo(151, 65);
    ctx.fill();

    ctx.fillStyle = '#fef3c7';
    ctx.beginPath();
    ctx.ellipse(128, 142, 38, 28, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.ellipse(128, 130, 14, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(95, 110, 9, 0, Math.PI * 2);
    ctx.arc(161, 110, 9, 0, Math.PI * 2);
    ctx.fill();
  } else if (key === 'flame_heart') {
    // Flame Heart
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.moveTo(128, 20);
    ctx.quadraticCurveTo(80, 80, 90, 140);
    ctx.quadraticCurveTo(128, 170, 166, 140);
    ctx.quadraticCurveTo(176, 80, 128, 20);
    ctx.fill();

    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.moveTo(128, 90);
    ctx.bezierCurveTo(128, 60, 68, 60, 68, 105);
    ctx.bezierCurveTo(68, 140, 128, 185, 128, 210);
    ctx.bezierCurveTo(128, 185, 188, 140, 188, 105);
    ctx.bezierCurveTo(188, 60, 128, 60, 128, 90);
    ctx.fill();
  } else if (key === 'supreme') {
    // Supreme box
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.roundRect(18, 92, 220, 72, 10);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'italic bold 40px Futura, Arial Black, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Supreme', 128, 128);
  } else if (key === 'pikachu') {
    // Pikachu face
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.roundRect(28, 28, 200, 200, 36);
    ctx.fill();

    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(65, 145, 22, 0, Math.PI * 2);
    ctx.arc(191, 145, 22, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.arc(78, 105, 16, 0, Math.PI * 2);
    ctx.arc(178, 105, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(82, 101, 6, 0, Math.PI * 2);
    ctx.arc(182, 101, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(114, 138, 14, 0, 0.9 * Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(142, 138, 14, 0.1 * Math.PI, Math.PI);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  tshirtTexCache.set(key, tex);
  return tex;
}

const shirtTexCache = new Map();
export function getClassicShirtTexture(key) {
  if (shirtTexCache.has(key)) return shirtTexCache.get(key);
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');

  if (key === 'noob_shirt') {
    ctx.fillStyle = '#0d69ac';
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#f5cd30';
    ctx.beginPath();
    ctx.arc(128, 0, 50, 0, Math.PI);
    ctx.fill();
  } else if (key === 'tuxedo') {
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, 256, 256);
    // White shirt V-neck
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.moveTo(60, 0);
    ctx.lineTo(196, 0);
    ctx.lineTo(128, 140);
    ctx.closePath();
    ctx.fill();

    // Red bow tie
    ctx.fillStyle = '#b91c1c';
    ctx.beginPath();
    ctx.moveTo(128, 30);
    ctx.lineTo(95, 15);
    ctx.lineTo(95, 45);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(128, 30);
    ctx.lineTo(161, 15);
    ctx.lineTo(161, 45);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.arc(128, 30, 8, 0, Math.PI * 2);
    ctx.fill();

    // Gold buttons
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(128, 70, 5, 0, Math.PI * 2);
    ctx.arc(128, 100, 5, 0, Math.PI * 2);
    ctx.arc(128, 175, 6, 0, Math.PI * 2);
    ctx.fill();
  } else if (key === 'striped_polo') {
    ctx.fillStyle = '#ffedd5';
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#f97316';
    for (let y = 0; y < 256; y += 40) {
      ctx.fillRect(0, y, 256, 20);
    }
  } else if (key === 'cyber_neon') {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(40, 20);
    ctx.lineTo(100, 100);
    ctx.lineTo(100, 200);
    ctx.lineTo(160, 240);
    ctx.stroke();

    ctx.strokeStyle = '#a855f7';
    ctx.beginPath();
    ctx.moveTo(216, 20);
    ctx.lineTo(156, 100);
    ctx.lineTo(156, 200);
    ctx.stroke();

    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(100, 100, 8, 0, Math.PI * 2);
    ctx.arc(156, 100, 8, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  shirtTexCache.set(key, tex);
  return tex;
}

const pantsTexCache = new Map();
export function getClassicPantsTexture(key) {
  if (pantsTexCache.has(key)) return pantsTexCache.get(key);
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');

  if (key === 'noob_pants') {
    ctx.fillStyle = '#5b9c37';
    ctx.fillRect(0, 0, 256, 256);
  } else if (key === 'ripped_jeans') {
    ctx.fillStyle = '#1d4ed8';
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 3;
    ctx.strokeRect(30, 20, 60, 50);
    ctx.strokeRect(166, 20, 60, 50);
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(40, 140, 45, 12);
    ctx.fillRect(170, 140, 45, 12);
  } else if (key === 'black_slacks') {
    ctx.fillStyle = '#18181b';
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = '#3f3f46';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(64, 0);
    ctx.lineTo(64, 256);
    ctx.moveTo(192, 0);
    ctx.lineTo(192, 256);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  pantsTexCache.set(key, tex);
  return tex;
}

export class Avatar {
  constructor(_unused, { name, hue = 200, costume = 'default', pumpkinHat = null }) {
    this.root = new THREE.Group();
    this.hue = hue;
    this.name = name;
    this.costumeKey = costume || 'default';
    this.pumpkinHatKey = pumpkinHat || null;
    this.heldKey = null;
    this.accessoryKey = null;
    this.auraKey = null;
    this.nametagStyle = null;
    this.limbState = { head: true, leftArm: true, rightArm: true, legs: true };
    this.legoBricks = [];
    this.customConfig = null;
    this.blinkTimer = 2.0;
    this.isBlinking = false;

    this.body = new THREE.Group();
    this.root.add(this.body);

    this.auraGroup = new THREE.Group();
    this.root.add(this.auraGroup);

    this.adminAuraGroup = new THREE.Group();
    this.root.add(this.adminAuraGroup);

    this.buildHumanRig();
    this.applyCostume(this.costumeKey);
    this.setPumpkinHat(this.pumpkinHatKey);

    this.base = 'Idle';
    this.jumping = false;
    this.sitting = null; // null | { type: 'single'|'couple'|'log', lean: -1|0|1 }
    this.emote = null;
    this.emoteStart = 0;
    this.emoteUntil = 0;
    this.splatUntil = 0;
    this.animTime = Math.random() * 10;

    this.setName(name);
    this.bubbleEl = null;
    this.bubbleUntil = 0;
  }

  buildHumanRig() {
    // Pelvis / Hips pivot (y = 0.78m when standing)
    this.hips = new THREE.Group();
    this.hips.position.set(0, 0.78, 0);
    this.body.add(this.hips);

    // Upper Torso
    this.torso = new THREE.Group();
    this.hips.add(this.torso);

    this.shirtMesh = part(this.torso, G.box(), mat('#3b82f6'), [0, 0.28, 0], [0.46, 0.54, 0.25]);
    this.pelvisMesh = part(this.hips, G.box(), mat('#2b3a4a'), [0, -0.04, 0], [0.44, 0.16, 0.24]);

    // Classic 2D T-Shirt Decal Mount on Chest
    const tDecalGeo = new THREE.PlaneGeometry(0.24, 0.24);
    const tDecalMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.99, side: THREE.DoubleSide });
    this.tshirtDecal = new THREE.Mesh(tDecalGeo, tDecalMat);
    this.tshirtDecal.position.set(0, 0.28, 0.128);
    this.tshirtDecal.visible = false;
    this.torso.add(this.tshirtDecal);

    // Costume extra container on torso (cape, ribs, tattered strips)
    this.torsoExtras = new THREE.Group();
    this.torso.add(this.torsoExtras);

    // Layered 3D Clothing Containers
    this.layeredClothingGroup = new THREE.Group();
    this.torso.add(this.layeredClothingGroup);

    this.layeredLegsClothingGroup = new THREE.Group();
    this.hips.add(this.layeredLegsClothingGroup);

    // Tomato Splat overlay on chest/face (hidden unless hit by tomato)
    this.splatGroup = new THREE.Group();
    this.splatGroup.visible = false;
    const redMat = mat('#e63946', { emissive: '#9b0000', emissiveIntensity: 0.4, roughness: 0.3 });
    part(this.splatGroup, G.sph(), redMat, [0.06, 0.32, 0.14], [0.22, 0.2, 0.05]);
    part(this.splatGroup, G.sph(), redMat, [-0.1, 0.2, 0.14], [0.14, 0.16, 0.05]);
    part(this.splatGroup, G.sph(), redMat, [0.02, 0.72, 0.21], [0.16, 0.16, 0.05]);
    this.torso.add(this.splatGroup);

    // Neck & Head Group
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 0.58, 0);
    this.torso.add(this.headGroup);

    // Face / Head (supports classic boxy or sphere)
    this.headMesh = part(this.headGroup, G.sph(), mat('#ffdbb5'), [0, 0.2, 0], [0.42, 0.44, 0.42]);
    // Eyes
    this.leftEye = part(this.headGroup, G.sph(), mat('#111827'), [-0.085, 0.22, 0.19], [0.055, 0.065, 0.04]);
    this.rightEye = part(this.headGroup, G.sph(), mat('#111827'), [0.085, 0.22, 0.19], [0.055, 0.065, 0.04]);
    // Blush cheeks
    this.blushLeft = part(this.headGroup, G.sph(), mat('#ff8fa3'), [-0.13, 0.16, 0.18], [0.055, 0.035, 0.03]);
    this.blushRight = part(this.headGroup, G.sph(), mat('#ff8fa3'), [0.13, 0.16, 0.18], [0.055, 0.035, 0.03]);
    // Smile mouth
    this.mouthMesh = part(this.headGroup, G.box(), mat('#7f1d1d'), [0, 0.12, 0.2], [0.09, 0.025, 0.03]);

    // 2D Classic Face Decal Plane
    const faceDecalGeo = new THREE.PlaneGeometry(0.38, 0.38);
    const faceDecalMat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false });
    this.faceDecalMesh = new THREE.Mesh(faceDecalGeo, faceDecalMat);
    this.faceDecalMesh.position.set(0, 0.2, 0.222);
    this.faceDecalMesh.visible = false;
    this.headGroup.add(this.faceDecalMesh);
    this.leftCheek = this.blushLeft;
    this.rightCheek = this.blushRight;
    this.faceDecal = this.faceDecalMesh;

    // Hair & Head Costume Extras
    this.hairGroup = new THREE.Group();
    this.headGroup.add(this.hairGroup);

    // Wearable Pumpkin Hat Mount (covers head when worn)
    this.pumpkinMount = new THREE.Group();
    this.pumpkinMount.position.set(0, -0.08, 0);
    this.headGroup.add(this.pumpkinMount);

    // Head Accessories Mount (Crown, Cowboy Hat, Top Hat, Cat Ears, Shades, etc.)
    this.accessoryGroup = new THREE.Group();
    this.accessoryGroup.position.set(0, 0.24, 0);
    this.headGroup.add(this.accessoryGroup);

    // Back Accessories Mount on Torso (Wings, Capes)
    this.backAccessoryGroup = new THREE.Group();
    this.torso.add(this.backAccessoryGroup);

    // Left Arm (Shoulder pivot at [-0.3, 0.48, 0])
    this.leftArm = new THREE.Group();
    this.leftArm.position.set(-0.3, 0.48, 0);
    this.torso.add(this.leftArm);
    this.leftSleeve = part(this.leftArm, G.cyl(), mat('#3b82f6'), [0, -0.13, 0], [0.14, 0.28, 0.14]);
    this.leftForearm = part(this.leftArm, G.cyl(), mat('#ffdbb5'), [0, -0.34, 0], [0.12, 0.24, 0.12]);
    this.leftHand = part(this.leftArm, G.sph(), mat('#ffdbb5'), [0, -0.48, 0], [0.14, 0.14, 0.14]);

    // Right Arm (Shoulder pivot at [0.3, 0.48, 0])
    this.rightArm = new THREE.Group();
    this.rightArm.position.set(0.3, 0.48, 0);
    this.torso.add(this.rightArm);
    this.rightSleeve = part(this.rightArm, G.cyl(), mat('#3b82f6'), [0, -0.13, 0], [0.14, 0.28, 0.14]);
    this.rightForearm = part(this.rightArm, G.cyl(), mat('#ffdbb5'), [0, -0.34, 0], [0.12, 0.24, 0.12]);
    this.rightHand = part(this.rightArm, G.sph(), mat('#ffdbb5'), [0, -0.48, 0], [0.14, 0.14, 0.14]);

    // Held Item Mount on Right Hand
    this.handMount = new THREE.Group();
    this.handMount.position.set(0, -0.5, 0.1);
    this.rightArm.add(this.handMount);

    // Temporary Emote Prop Mount (marshmallow stick, cocoa cup, candy basket)
    this.emotePropMount = new THREE.Group();
    this.emotePropMount.position.set(0, -0.5, 0.12);
    this.rightArm.add(this.emotePropMount);

    // Left Leg (Hip pivot at [-0.13, -0.08, 0])
    this.leftLeg = new THREE.Group();
    this.leftLeg.position.set(-0.13, -0.08, 0);
    this.hips.add(this.leftLeg);
    this.leftThigh = part(this.leftLeg, G.cyl(), mat('#2b3a4a'), [0, -0.28, 0], [0.16, 0.56, 0.16]);
    this.leftShoe = part(this.leftLeg, G.box(), mat('#1f242d'), [0, -0.62, 0.04], [0.17, 0.14, 0.26]);

    // Right Leg (Hip pivot at [0.13, -0.08, 0])
    this.rightLeg = new THREE.Group();
    this.rightLeg.position.set(0.13, -0.08, 0);
    this.hips.add(this.rightLeg);
    this.rightThigh = part(this.rightLeg, G.cyl(), mat('#2b3a4a'), [0, -0.28, 0], [0.16, 0.56, 0.16]);
    this.rightShoe = part(this.rightLeg, G.box(), mat('#1f242d'), [0, -0.62, 0.04], [0.17, 0.14, 0.26]);

    // Layered 3D Clothing Containers (scaled automatically with body bones)
    this.layeredClothing = {
      torso: new THREE.Group(),
      leftArm: new THREE.Group(),
      rightArm: new THREE.Group(),
      hips: new THREE.Group(),
      leftLeg: new THREE.Group(),
      rightLeg: new THREE.Group(),
    };
    this.torso.add(this.layeredClothing.torso);
    this.leftArm.add(this.layeredClothing.leftArm);
    this.rightArm.add(this.layeredClothing.rightArm);
    this.hips.add(this.layeredClothing.hips);
    this.leftLeg.add(this.layeredClothing.leftLeg);
    this.rightLeg.add(this.layeredClothing.rightLeg);
  }

// ============================================================================
// HAIR & LAYERED CLOTHING 3D BUILDERS
// ============================================================================

  buildAvatarHair(hairGroup, style, color) {
  hairGroup.clear();
  const m = mat(color, { roughness: 0.45 });
  const mGloss = mat(color, { roughness: 0.25 });

  if (style === 'classic_part') {
    // Classic plastic molded hair with part
    part(hairGroup, G.sph(), mGloss, [0, 0.25, -0.02], [0.45, 0.38, 0.45]);
    part(hairGroup, G.box(), mGloss, [0.06, 0.34, 0.14], [0.36, 0.13, 0.16], [0.18, 0, -0.08]);
    part(hairGroup, G.box(), mGloss, [-0.14, 0.31, 0.13], [0.16, 0.12, 0.15], [0.15, 0, 0.12]);
  } else if (style === 'spiky') {
    // Anime spiky hair
    part(hairGroup, G.sph(), m, [0, 0.24, 0], [0.44, 0.36, 0.44]);
    part(hairGroup, G.cone(), m, [0, 0.52, 0], [0.15, 0.34, 0.15]);
    part(hairGroup, G.cone(), m, [-0.14, 0.48, 0.05], [0.13, 0.30, 0.13], [0.2, 0, 0.35]);
    part(hairGroup, G.cone(), m, [0.14, 0.48, 0.05], [0.13, 0.30, 0.13], [-0.2, 0, -0.35]);
    part(hairGroup, G.cone(), m, [0, 0.46, -0.15], [0.13, 0.28, 0.13], [-0.35, 0, 0]);
    part(hairGroup, G.cone(), m, [0, 0.42, 0.16], [0.12, 0.24, 0.12], [0.38, 0, 0]);
    part(hairGroup, G.cone(), m, [-0.16, 0.36, 0.14], [0.10, 0.22, 0.10], [0.3, 0, 0.4]);
    part(hairGroup, G.cone(), m, [0.16, 0.36, 0.14], [0.10, 0.22, 0.10], [0.3, 0, -0.4]);
  } else if (style === 'boy_messy') {
    // Messy boy fringe
    part(hairGroup, G.sph(), m, [0, 0.25, -0.01], [0.45, 0.37, 0.45]);
    part(hairGroup, G.box(), m, [-0.05, 0.33, 0.15], [0.28, 0.13, 0.15], [0.25, 0.1, -0.15]);
    part(hairGroup, G.box(), m, [0.12, 0.32, 0.14], [0.22, 0.12, 0.14], [0.22, -0.1, 0.18]);
    part(hairGroup, G.box(), m, [-0.15, 0.24, 0.12], [0.12, 0.18, 0.12], [0.1, 0, 0.25]);
    part(hairGroup, G.box(), m, [0.15, 0.24, 0.12], [0.12, 0.18, 0.12], [0.1, 0, -0.25]);
  } else if (style === 'ponytail') {
    // Ponytail
    part(hairGroup, G.sph(), m, [0, 0.25, -0.01], [0.45, 0.38, 0.45]);
    part(hairGroup, G.box(), m, [0, 0.33, 0.13], [0.34, 0.12, 0.16], [0.2, 0, 0]);
    part(hairGroup, G.torus(), mat('#ef4444'), [0, 0.34, -0.22], [0.22, 0.22, 0.22], [Math.PI / 4, 0, 0]);
    part(hairGroup, G.cone(), m, [0, 0.26, -0.36], [0.15, 0.48, 0.15], [-Math.PI / 3.5, 0, 0]);
    part(hairGroup, G.cone(), m, [0, 0.08, -0.44], [0.12, 0.38, 0.12], [-Math.PI / 3, 0, 0]);
  } else if (style === 'layered_curls') {
    // 3D Layered bouncy curls
    part(hairGroup, G.sph(), m, [0, 0.25, -0.02], [0.44, 0.38, 0.44]);
    const curlAngles = [-1.4, -0.9, -0.4, 0, 0.4, 0.9, 1.4];
    curlAngles.forEach((a) => {
      const rx = Math.sin(a) * 0.21;
      const rz = Math.cos(a) * 0.20;
      part(hairGroup, G.sph(), m, [rx, 0.36, rz], [0.16, 0.16, 0.16]);
      part(hairGroup, G.sph(), m, [rx * 1.15, 0.25, rz * 1.15], [0.18, 0.18, 0.18]);
      part(hairGroup, G.sph(), m, [rx * 1.25, 0.14, rz * 1.25], [0.17, 0.17, 0.17]);
    });
  } else if (style === 'layered_waves') {
    // 3D Layered long flowing waves
    part(hairGroup, G.sph(), m, [0, 0.25, -0.02], [0.45, 0.38, 0.45]);
    part(hairGroup, G.box(), m, [0, 0.34, 0.14], [0.38, 0.12, 0.16], [0.2, 0, 0]);
    part(hairGroup, G.cyl(), m, [-0.22, 0.12, 0.06], [0.14, 0.42, 0.14], [0.2, 0, -0.15]);
    part(hairGroup, G.cyl(), m, [0.22, 0.12, 0.06], [0.14, 0.42, 0.14], [0.2, 0, 0.15]);
    part(hairGroup, G.cyl(), m, [-0.22, -0.10, 0.08], [0.12, 0.36, 0.12], [0.1, 0, 0.05]);
    part(hairGroup, G.cyl(), m, [0.22, -0.10, 0.08], [0.12, 0.36, 0.12], [0.1, 0, -0.05]);
    part(hairGroup, G.box(), m, [0, 0.08, -0.21], [0.42, 0.52, 0.12], [-0.08, 0, 0]);
  } else if (style === 'layered_cyber') {
    // Cyberpunk layered two-tone hair
    const mNeon = mat('#06b6d4', { emissive: '#06b6d4', emissiveIntensity: 0.35, roughness: 0.3 });
    part(hairGroup, G.sph(), m, [0, 0.25, -0.02], [0.45, 0.38, 0.45]);
    part(hairGroup, G.box(), m, [-0.10, 0.34, 0.15], [0.24, 0.13, 0.15], [0.22, 0.1, -0.2]);
    part(hairGroup, G.box(), mNeon, [0.12, 0.33, 0.16], [0.16, 0.14, 0.14], [0.24, -0.1, 0.18]);
    part(hairGroup, G.box(), mNeon, [-0.21, 0.22, 0.11], [0.08, 0.24, 0.11], [0.1, 0, 0.25]);
    part(hairGroup, G.cone(), mNeon, [0.15, 0.48, 0.02], [0.11, 0.26, 0.11], [-0.1, 0, -0.3]);
  }
}

  buildAvatarLayeredClothing(layered, cfg = {}) {
  // 1. Jackets
  if (cfg.jacket === 'leather_jacket') {
    const lMat = mat('#18181b', { roughness: 0.28, metalness: 0.2 });
    const silverMat = mat('#94a3b8', { metalness: 0.8, roughness: 0.2 });
    part(layered.torso, G.box(), lMat, [0, 0.28, 0.015], [0.49, 0.55, 0.27]);
    part(layered.torso, G.box(), silverMat, [-0.16, 0.34, 0.14], [0.11, 0.22, 0.04], [0, 0, 0.18]);
    part(layered.torso, G.box(), silverMat, [0.16, 0.34, 0.14], [0.11, 0.22, 0.04], [0, 0, -0.18]);
    part(layered.torso, G.box(), silverMat, [0.03, 0.24, 0.142], [0.03, 0.32, 0.02], [0, 0, 0.12]);
    part(layered.torso, G.box(), silverMat, [-0.22, 0.53, 0], [0.12, 0.03, 0.14]);
    part(layered.torso, G.box(), silverMat, [0.22, 0.53, 0], [0.12, 0.03, 0.14]);
    part(layered.leftArm, G.cyl(), lMat, [0, -0.15, 0], [0.165, 0.32, 0.165]);
    part(layered.rightArm, G.cyl(), lMat, [0, -0.15, 0], [0.165, 0.32, 0.165]);
  } else if (cfg.jacket === 'bomber_jacket') {
    const bMat = mat('#991b1b', { roughness: 0.5 });
    const ribMat = mat('#f8fafc', { roughness: 0.7 });
    part(layered.torso, G.box(), bMat, [0, 0.30, 0.015], [0.51, 0.50, 0.29]);
    part(layered.torso, G.box(), ribMat, [0, 0.04, 0.01], [0.48, 0.08, 0.27]);
    part(layered.torso, G.box(), ribMat, [0, 0.54, 0], [0.38, 0.06, 0.24]);
    part(layered.leftArm, G.cyl(), ribMat, [0, -0.15, 0], [0.165, 0.32, 0.165]);
    part(layered.rightArm, G.cyl(), ribMat, [0, -0.15, 0], [0.165, 0.32, 0.165]);
  } else if (cfg.jacket === 'winter_parka') {
    const pMat = mat('#1e3a8a', { roughness: 0.6 });
    const furMat = mat('#f8fafc', { roughness: 0.95 });
    part(layered.torso, G.box(), pMat, [0, 0.28, 0.02], [0.52, 0.58, 0.30]);
    part(layered.torso, G.box(), mat('#172554'), [0, 0.38, 0.025], [0.525, 0.04, 0.305]);
    part(layered.torso, G.box(), mat('#172554'), [0, 0.22, 0.025], [0.525, 0.04, 0.305]);
    part(layered.torso, G.sph(), furMat, [0, 0.56, -0.04], [0.46, 0.18, 0.36]);
    part(layered.leftArm, G.cyl(), pMat, [0, -0.15, 0], [0.17, 0.32, 0.17]);
    part(layered.rightArm, G.cyl(), pMat, [0, -0.15, 0], [0.17, 0.32, 0.17]);
  }

  // 2. Sweaters
  if (cfg.sweater === 'xmas_sweater') {
    const sMat = mat('#b91c1c', { roughness: 0.85 });
    const wMat = mat('#fef08a', { roughness: 0.8 });
    part(layered.torso, G.box(), sMat, [0, 0.28, 0.01], [0.48, 0.54, 0.26]);
    part(layered.torso, G.box(), wMat, [0, 0.30, 0.133], [0.14, 0.14, 0.02]);
    part(layered.torso, G.box(), wMat, [-0.14, 0.30, 0.133], [0.08, 0.08, 0.02]);
    part(layered.torso, G.box(), wMat, [0.14, 0.30, 0.133], [0.08, 0.08, 0.02]);
  } else if (cfg.sweater === 'turtleneck') {
    const tMat = mat('#f5f5f4', { roughness: 0.75 });
    part(layered.torso, G.box(), tMat, [0, 0.28, 0.01], [0.48, 0.54, 0.26]);
    part(layered.torso, G.cyl(), tMat, [0, 0.56, 0], [0.26, 0.14, 0.26]);
  }

  // 3. Shirts 3D
  if (cfg.shirt3d === 'hoodie_3d') {
    const hMat = mat('#475569', { roughness: 0.7 });
    part(layered.torso, G.box(), hMat, [0, 0.28, 0.01], [0.485, 0.545, 0.265]);
    part(layered.torso, G.box(), hMat, [0, 0.12, 0.14], [0.32, 0.14, 0.04]);
    part(layered.torso, G.sph(), hMat, [0, 0.52, -0.12], [0.34, 0.24, 0.22]);
  } else if (cfg.shirt3d === 'denim_vest') {
    const dMat = mat('#1d4ed8', { roughness: 0.65 });
    const brassMat = mat('#f59e0b', { metalness: 0.7, roughness: 0.3 });
    part(layered.torso, G.box(), dMat, [0, 0.28, 0.015], [0.48, 0.52, 0.265]);
    for (let i = 0; i < 3; i++) {
      part(layered.torso, G.sph(), brassMat, [0, 0.16 + i * 0.12, 0.14], [0.03, 0.03, 0.03]);
    }
  }

  // 4. Pants 3D
  if (cfg.pants3d === 'cargo_pants') {
    const cMat = mat('#3f3f46', { roughness: 0.8 });
    part(layered.leftLeg, G.box(), cMat, [-0.10, -0.24, 0], [0.07, 0.18, 0.15]);
    part(layered.leftLeg, G.box(), mat('#27272a'), [-0.105, -0.16, 0], [0.065, 0.04, 0.14]);
    part(layered.rightLeg, G.box(), cMat, [0.10, -0.24, 0], [0.07, 0.18, 0.15]);
    part(layered.rightLeg, G.box(), mat('#27272a'), [0.105, -0.16, 0], [0.065, 0.04, 0.14]);
  } else if (cfg.pants3d === 'baggy_jeans') {
    const jMat = mat('#2563eb', { roughness: 0.7 });
    part(layered.leftLeg, G.cyl(), jMat, [0, -0.32, 0], [0.19, 0.54, 0.19]);
    part(layered.rightLeg, G.cyl(), jMat, [0, -0.32, 0], [0.19, 0.54, 0.19]);
  }

  // 5. Skirts
  if (cfg.skirt === 'pleated_skirt') {
    const sMat = mat('#1e293b', { roughness: 0.75 });
    part(layered.hips, G.cone(), sMat, [0, -0.16, 0], [0.55, 0.28, 0.42], [Math.PI, 0, 0]);
  } else if (cfg.skirt === 'princess_dress') {
    const dMat = mat('#f472b6', { roughness: 0.5, metalness: 0.1 });
    part(layered.hips, G.cone(), dMat, [0, -0.34, 0], [0.72, 0.64, 0.58], [Math.PI, 0, 0]);
    part(layered.hips, G.torus(), mat('#ffffff'), [0, -0.06, 0], [0.38, 0.38, 0.04], [Math.PI / 2, 0, 0]);
  }

  // 6. Shoes 3D
  if (cfg.shoes3d === 'sneakers_chunky') {
    const wMat = mat('#ffffff', { roughness: 0.4 });
    const cMat = mat('#06b6d4', { roughness: 0.5 });
    part(layered.leftLeg, G.box(), wMat, [0, -0.66, 0.05], [0.20, 0.09, 0.30]);
    part(layered.leftLeg, G.box(), cMat, [0, -0.61, 0.04], [0.18, 0.08, 0.26]);
    part(layered.rightLeg, G.box(), wMat, [0, -0.66, 0.05], [0.20, 0.09, 0.30]);
    part(layered.rightLeg, G.box(), cMat, [0, -0.61, 0.04], [0.18, 0.08, 0.26]);
  } else if (cfg.shoes3d === 'combat_boots') {
    const bMat = mat('#0f172a', { roughness: 0.3, metalness: 0.2 });
    part(layered.leftLeg, G.box(), bMat, [0, -0.63, 0.05], [0.19, 0.16, 0.28]);
    part(layered.leftLeg, G.cyl(), bMat, [0, -0.48, 0], [0.175, 0.18, 0.175]);
    part(layered.rightLeg, G.box(), bMat, [0, -0.63, 0.05], [0.19, 0.16, 0.28]);
    part(layered.rightLeg, G.cyl(), bMat, [0, -0.48, 0], [0.175, 0.18, 0.175]);
  } else if (cfg.shoes3d === 'classic_slipon') {
    const sMat = mat('#f8fafc', { roughness: 0.6 });
    part(layered.leftLeg, G.box(), sMat, [0, -0.63, 0.04], [0.18, 0.12, 0.27]);
    part(layered.rightLeg, G.box(), sMat, [0, -0.63, 0.04], [0.18, 0.12, 0.27]);
  }
}

  applyCustomization(cfg) {
    if (!cfg) return;
    this.customConfig = cfg;

    // A. Skin colors for individual limbs & body
    const sHead = cfg.skin?.head || cfg.skin?.all || '#f5cd30';
    const sTorso = cfg.skin?.torso || cfg.skin?.all || '#0d69ac';
    const sLArm = cfg.skin?.leftArm || cfg.skin?.all || '#f5cd30';
    const sRArm = cfg.skin?.rightArm || cfg.skin?.all || '#f5cd30';
    const sLLeg = cfg.skin?.leftLeg || cfg.skin?.all || '#5b9c37';
    const sRLeg = cfg.skin?.rightLeg || cfg.skin?.all || '#5b9c37';

    this.headMesh.material = mat(sHead);
    this.leftForearm.material = mat(sLArm);
    this.leftHand.material = mat(sLArm);
    this.rightForearm.material = mat(sRArm);
    this.rightHand.material = mat(sRArm);

    this.shirtMesh.material = mat(sTorso);
    this.leftSleeve.material = mat(sLArm);
    this.rightSleeve.material = mat(sRArm);

    this.pelvisMesh.material = mat(sLLeg);
    this.leftThigh.material = mat(sLLeg);
    this.rightThigh.material = mat(sRLeg);

    // B. Head Type (Classic Boxy vs Round / Dynamic)
    const hType = cfg.headType || 'classic';
    if (hType === 'classic') {
      this.headMesh.geometry = G.box();
      this.headMesh.scale.set(0.42, 0.42, 0.42);
      this.faceDecal.position.z = 0.218;
    } else {
      this.headMesh.geometry = G.sph();
      this.headMesh.scale.set(0.42, 0.44, 0.42);
      this.faceDecal.position.z = 0.222;
    }

    // C. Classic 2D Faces vs 3D Eyes
    const faceKey = cfg.classicFace || 'smile';
    if (faceKey && faceKey !== 'default') {
      const fTex = getFaceTexture(faceKey);
      this.faceDecal.material.map = fTex;
      this.faceDecal.material.needsUpdate = true;
      this.faceDecal.visible = true;
      this.leftEye.visible = false;
      this.rightEye.visible = false;
      if (this.leftCheek) this.leftCheek.visible = false;
      if (this.rightCheek) this.rightCheek.visible = false;
      this.mouthMesh.visible = false;
    } else {
      this.faceDecal.visible = false;
      this.leftEye.visible = true;
      this.rightEye.visible = true;
      if (this.leftCheek) this.leftCheek.visible = true;
      if (this.rightCheek) this.rightCheek.visible = true;
      this.mouthMesh.visible = true;
    }

    // D. Hair
    const hStyle = cfg.hairStyle || 'classic_part';
    const hColor = cfg.hairColor || '#543310';
    if (hStyle && hStyle !== 'none') {
      this.buildAvatarHair(this.hairGroup, hStyle, hColor);
    } else {
      this.hairGroup.clear();
    }

    // E. Body Scaling & Proportions
    const sc = cfg.bodyScale || { height: 1.0, width: 1.0, depth: 1.0, head: 1.0 };
    const h = sc.height || 1.0;
    const w = sc.width || 1.0;
    const d = sc.depth || 1.0;
    const hd = sc.head || 1.0;

    this.torso.scale.set(w, h, d);
    this.headGroup.scale.set(hd, hd, hd);
    this.leftArm.scale.set(w * 0.95, h, d);
    this.rightArm.scale.set(w * 0.95, h, d);
    this.leftLeg.scale.set(w * 0.95, h, d);
    this.rightLeg.scale.set(w * 0.95, h, d);

    this.leftArm.position.x = -0.3 * w;
    this.rightArm.position.x = 0.3 * w;
    this.leftLeg.position.x = -0.13 * w;
    this.rightLeg.position.x = 0.13 * w;

    // F. Layered Clothing 3D
    this.layeredClothing.torso.clear();
    this.layeredClothing.leftArm.clear();
    this.layeredClothing.rightArm.clear();
    this.layeredClothing.hips.clear();
    this.layeredClothing.leftLeg.clear();
    this.layeredClothing.rightLeg.clear();
    if (cfg.layered) {
      this.buildAvatarLayeredClothing(this.layeredClothing, cfg.layered);
    }

    // G. Classic 2D Clothing
    if (cfg.classic?.shirt && cfg.classic.shirt !== 'none') {
      const sTex = getClassicShirtTexture(cfg.classic.shirt);
      const sMat = new THREE.MeshStandardMaterial({ map: sTex, roughness: 0.65 });
      this.shirtMesh.material = sMat;
      this.leftSleeve.material = sMat;
      this.rightSleeve.material = sMat;
    }
    if (cfg.classic?.pants && cfg.classic.pants !== 'none') {
      const pTex = getClassicPantsTexture(cfg.classic.pants);
      const pMat = new THREE.MeshStandardMaterial({ map: pTex, roughness: 0.7 });
      this.pelvisMesh.material = pMat;
      this.leftThigh.material = pMat;
      this.rightThigh.material = pMat;
    }
    if (cfg.classic?.tshirt && cfg.classic.tshirt !== 'none') {
      const tTex = getTshirtDecalTexture(cfg.classic.tshirt);
      this.tshirtDecal.material.map = tTex;
      this.tshirtDecal.material.needsUpdate = true;
      this.tshirtDecal.visible = true;
    } else {
      this.tshirtDecal.visible = false;
    }

    // Accessories & Auras if present
    if (cfg.accessory) this.setAccessory(cfg.accessory);
    if (cfg.aura) this.setAura(cfg.aura);
  }

  applyCostume(costumeKey = 'default') {
    this.costumeKey = COSTUMES[costumeKey] ? costumeKey : 'default';
    const cfg = COSTUMES[this.costumeKey];
    const defaultShirtColor = new THREE.Color().setHSL((this.hue % 360) / 360, 0.72, 0.52).getStyle();
    const shirtCol = cfg.shirt || defaultShirtColor;

    const skinM = mat(cfg.skin);
    const shirtM = mat(shirtCol);
    const pantsM = mat(cfg.pants);
    const shoesM = mat(cfg.shoes);
    const eyeM = cfg.redEyes
      ? mat('#ff0033', { emissive: '#ff0033', emissiveIntensity: 1.5 })
      : cfg.skullEyes
      ? mat('#050505')
      : mat('#111827');

    this.headMesh.material = skinM;
    this.leftForearm.material = skinM;
    this.rightForearm.material = skinM;
    this.leftHand.material = skinM;
    this.rightHand.material = skinM;

    this.shirtMesh.material = shirtM;
    this.leftSleeve.material = shirtM;
    this.rightSleeve.material = shirtM;

    this.pelvisMesh.material = pantsM;
    this.leftThigh.material = pantsM;
    this.rightThigh.material = pantsM;

    this.leftShoe.material = shoesM;
    this.rightShoe.material = shoesM;

    this.leftEye.material = eyeM;
    this.rightEye.material = eyeM;

    // Clear and rebuild hair & costume extras
    this.hairGroup.clear();
    this.torsoExtras.clear();

    if (cfg.hair) {
      const hm = mat(cfg.hair);
      if (cfg.flatHead) {
        // Frankenstein flat top hair + neck bolts
        part(this.hairGroup, G.cyl(), hm, [0, 0.34, 0], [0.43, 0.18, 0.43]);
        part(this.hairGroup, G.cyl(), mat('#95a5a6', { metalness: 0.6 }), [0, 0.12, 0], [0.06, 0.56, 0.06], [0, 0, Math.PI / 2]);
      } else {
        // Stylish rounded hair cap + bangs
        part(this.hairGroup, G.sph(), hm, [0, 0.25, -0.02], [0.45, 0.38, 0.45]);
        part(this.hairGroup, G.box(), hm, [0, 0.34, 0.14], [0.34, 0.12, 0.16], [0.2, 0, 0]);
      }
    }

    if (cfg.witchHat) {
      const hatM = mat('#19103b');
      part(this.hairGroup, G.cyl(), hatM, [0, 0.38, 0], [0.72, 0.05, 0.72]);
      part(this.hairGroup, G.cyl(), mat('#f59e0b'), [0, 0.42, 0], [0.36, 0.06, 0.36]);
      part(this.hairGroup, G.cone(), hatM, [0, 0.68, 0], [0.36, 0.55, 0.36], [-0.12, 0, 0]);
    }

    if (cfg.cape) {
      part(this.torsoExtras, G.box(), mat(cfg.cape), [0, 0.18, -0.15], [0.56, 0.75, 0.04], [0.12, 0, 0]);
      part(this.torsoExtras, G.cone(), mat(cfg.cape), [0, 0.58, -0.06], [0.46, 0.24, 0.22], [Math.PI, 0, 0]);
    }

    if (cfg.ribs) {
      const boneM = mat('#f1f2f6');
      for (let i = 0; i < 3; i++) {
        part(this.torsoExtras, G.box(), boneM, [0, 0.18 + i * 0.11, 0.13], [0.32, 0.045, 0.03]);
      }
      part(this.torsoExtras, G.box(), boneM, [0, 0.28, 0.135], [0.06, 0.3, 0.03]);
    }

    if (cfg.tattered) {
      part(this.torsoExtras, G.box(), mat('#c0392b'), [0.08, 0.28, 0.13], [0.14, 0.18, 0.02], [0, 0, 0.3]);
    }

    if (this.customConfig) {
      this.applyCustomization(this.customConfig);
    }
  }

  applyCustomization(cfg) {
    if (!cfg) return;
    this.customConfig = cfg;
    this.shirtMesh.material = mat('#3b82f6');
    this.leftSleeve.material = mat('#3b82f6');
    this.rightSleeve.material = mat('#3b82f6');
    this.pelvisMesh.material = mat('#2b3a4a');
    this.leftThigh.material = mat('#2b3a4a');
    this.rightThigh.material = mat('#2b3a4a');
    this.leftShoe.material = mat('#1f242d');
    this.rightShoe.material = mat('#1f242d');

    // 1. Skin Color
    if (cfg.skin) {
      if (cfg.skin.mode === 'advanced') {
        const headSkin = cfg.skin.head || '#ffdbb5';
        this.headMesh.material = mat(headSkin);
        if (cfg.skin.leftArm) {
          const laMat = mat(cfg.skin.leftArm);
          this.leftForearm.material = laMat;
          this.leftHand.material = laMat;
        }
        if (cfg.skin.rightArm) {
          const raMat = mat(cfg.skin.rightArm);
          this.rightForearm.material = raMat;
          this.rightHand.material = raMat;
        }
        if (cfg.skin.leftLeg) {
          this.leftThigh.material = mat(cfg.skin.leftLeg);
        }
        if (cfg.skin.rightLeg) {
          this.rightThigh.material = mat(cfg.skin.rightLeg);
        }
        if (cfg.skin.torso) {
          this.shirtMesh.material = mat(cfg.skin.torso);
        }
      } else {
        const skinM = mat(cfg.skin.all || '#ffdbb5');
        this.headMesh.material = skinM;
        this.leftForearm.material = skinM;
        this.rightForearm.material = skinM;
        this.leftHand.material = skinM;
        this.rightHand.material = skinM;
      }
    }

    // 2. Head Shape
    const hShape = cfg.headShape || 'classic_round';
    if (hShape === 'classic_block') {
      this.headMesh.geometry = G.box();
      this.headMesh.scale.set(0.42, 0.44, 0.42);
      if (this.faceDecalMesh) this.faceDecalMesh.position.z = 0.215;
    } else if (hShape === 'dynamic_head') {
      this.headMesh.geometry = G.cyl();
      this.headMesh.scale.set(0.38, 0.44, 0.38);
      if (this.faceDecalMesh) this.faceDecalMesh.position.z = 0.222;
    } else if (hShape === 'chibi_head') {
      this.headMesh.geometry = G.sph();
      this.headMesh.scale.set(0.50, 0.48, 0.48);
      if (this.faceDecalMesh) this.faceDecalMesh.position.z = 0.245;
    } else {
      // classic_round
      this.headMesh.geometry = G.sph();
      this.headMesh.scale.set(0.42, 0.44, 0.42);
      if (this.faceDecalMesh) this.faceDecalMesh.position.z = 0.222;
    }

    // 3. Face Decal vs Default Eyes/Mouth
    const classicFace = cfg.classicFace || 'smile';
    const headSkinColor = (cfg.skin?.mode === 'advanced' ? cfg.skin?.head : cfg.skin?.all) || '#ffdbb5';
    if (classicFace && classicFace !== 'default') {
      this.leftEye.visible = false;
      this.rightEye.visible = false;
      this.mouthMesh.visible = false;
      if (this.blushLeft) this.blushLeft.visible = false;
      if (this.blushRight) this.blushRight.visible = false;

      const tex = getFaceCanvasTexture(classicFace, headSkinColor);
      this.faceDecalMesh.material.map = tex;
      this.faceDecalMesh.material.needsUpdate = true;
      this.faceDecalMesh.visible = true;
    } else {
      this.leftEye.visible = true;
      this.rightEye.visible = true;
      this.mouthMesh.visible = true;
      if (this.blushLeft) this.blushLeft.visible = true;
      if (this.blushRight) this.blushRight.visible = true;
      this.faceDecalMesh.visible = false;
    }

    // 4. Hairstyles (3D Mesh Hair)
    this.hairGroup.clear();
    this.hairGroup.scale.set(
      this.headMesh.scale.x / 0.42,
      this.headMesh.scale.y / 0.44,
      this.headMesh.scale.z / 0.42
    );
    const hStyle = cfg.hairStyle || 'short_classic';
    const hColor = cfg.hairColor || '#3a2314';
    const hm = mat(hColor, { roughness: 0.65 });
    if (hStyle === 'short_classic') {
      part(this.hairGroup, G.sph(), hm, [0, 0.26, -0.02], [0.45, 0.38, 0.45]);
      part(this.hairGroup, G.box(), hm, [0, 0.34, 0.14], [0.36, 0.12, 0.16], [0.2, 0, 0]);
      part(this.hairGroup, G.box(), hm, [-0.19, 0.22, 0], [0.08, 0.22, 0.34]);
      part(this.hairGroup, G.box(), hm, [0.19, 0.22, 0], [0.08, 0.22, 0.34]);
    } else if (hStyle === 'spiky_anime') {
      part(this.hairGroup, G.sph(), hm, [0, 0.26, -0.02], [0.44, 0.36, 0.44]);
      for (let i = -2; i <= 2; i++) {
        part(this.hairGroup, G.cone(), hm, [i * 0.08, 0.42, 0.05], [0.08, 0.25, 0.08], [0.35, 0, -i * 0.2]);
      }
      part(this.hairGroup, G.cone(), hm, [0, 0.46, -0.1], [0.14, 0.28, 0.14], [-0.3, 0, 0]);
      part(this.hairGroup, G.cone(), hm, [-0.16, 0.38, -0.12], [0.12, 0.25, 0.12], [-0.3, 0, 0.4]);
      part(this.hairGroup, G.cone(), hm, [0.16, 0.38, -0.12], [0.12, 0.25, 0.12], [-0.3, 0, -0.4]);
    } else if (hStyle === 'layered_messy') {
      part(this.hairGroup, G.sph(), hm, [0, 0.26, -0.02], [0.46, 0.4, 0.46]);
      part(this.hairGroup, G.box(), hm, [-0.08, 0.32, 0.16], [0.22, 0.16, 0.14], [0.25, 0.2, -0.1]);
      part(this.hairGroup, G.box(), hm, [0.1, 0.31, 0.15], [0.22, 0.15, 0.14], [0.2, -0.15, 0.1]);
      part(this.hairGroup, G.box(), hm, [-0.2, 0.18, 0.04], [0.1, 0.32, 0.35]);
      part(this.hairGroup, G.box(), hm, [0.2, 0.18, 0.04], [0.1, 0.32, 0.35]);
      part(this.hairGroup, G.box(), hm, [0, 0.15, -0.18], [0.38, 0.35, 0.14]);
    } else if (hStyle === 'ponytail') {
      part(this.hairGroup, G.sph(), hm, [0, 0.26, -0.02], [0.45, 0.38, 0.45]);
      part(this.hairGroup, G.box(), hm, [0, 0.33, 0.14], [0.36, 0.11, 0.15], [0.2, 0, 0]);
      part(this.hairGroup, G.cyl(), mat('#f43f5e'), [0, 0.28, -0.23], [0.08, 0.06, 0.08], [Math.PI / 3, 0, 0]);
      part(this.hairGroup, G.cyl(), hm, [0, 0.12, -0.32], [0.12, 0.38, 0.12], [0.3, 0, 0]);
      part(this.hairGroup, G.cone(), hm, [0, -0.12, -0.38], [0.1, 0.25, 0.1], [0.3, 0, 0]);
    } else if (hStyle === 'long_wavy') {
      part(this.hairGroup, G.sph(), hm, [0, 0.26, -0.02], [0.46, 0.39, 0.46]);
      part(this.hairGroup, G.box(), hm, [-0.18, 0.08, 0.04], [0.11, 0.52, 0.34], [0, 0, -0.08]);
      part(this.hairGroup, G.box(), hm, [0.18, 0.08, 0.04], [0.11, 0.52, 0.34], [0, 0, 0.08]);
      part(this.hairGroup, G.box(), hm, [0, 0.04, -0.18], [0.42, 0.6, 0.15]);
      part(this.hairGroup, G.box(), hm, [0, 0.32, 0.15], [0.34, 0.12, 0.14], [0.2, 0, 0]);
    } else if (hStyle === 'curly_afro') {
      part(this.hairGroup, G.sph(), hm, [0, 0.3, -0.02], [0.58, 0.52, 0.56]);
    } else if (hStyle === 'beanie_cap') {
      part(this.hairGroup, G.cyl(), mat(hColor, { roughness: 0.8 }), [0, 0.32, 0], [0.46, 0.22, 0.46]);
      part(this.hairGroup, G.sph(), mat(hColor, { roughness: 0.8 }), [0, 0.44, 0], [0.4, 0.2, 0.4]);
      part(this.hairGroup, G.sph(), mat('#ffffff'), [0, 0.55, 0], [0.1, 0.1, 0.1]);
    }

    // 5. Body Proportions & Presets
    const clampScale = (value, min, max) => {
      const scale = Number(value);
      return Number.isFinite(scale) ? Math.min(max, Math.max(min, scale)) : 1.0;
    };
    let hScale = clampScale(cfg.heightScale, 0.75, 1.35);
    let wScale = clampScale(cfg.widthScale, 0.75, 1.45);
    let hdScale = clampScale(cfg.headScale, 0.75, 1.4);

    const preset = cfg.bodyPreset || 'standard';
    if (preset === 'blocky_classic') {
      wScale *= 1.25;
      hdScale *= 1.15;
    } else if (preset === 'buff_muscular') {
      hScale *= 1.12;
      wScale *= 1.35;
      hdScale *= 0.95;
    } else if (preset === 'slender') {
      hScale *= 1.15;
      wScale *= 0.85;
      hdScale *= 0.92;
    } else if (preset === 'chibi_cute') {
      hScale *= 0.78;
      wScale *= 1.1;
      hdScale *= 1.4;
    }

    this.body.scale.set(wScale, hScale, wScale);
    this.headGroup.scale.set(hdScale / wScale, hdScale / hScale, hdScale / wScale);

    // 6. Classic 2D Clothing
    const shirtId = cfg.classicClothing?.shirt;
    if (shirtId && shirtId !== 'none') {
      const sTex = getClassicShirtTexture(shirtId);
      const sMat = new THREE.MeshStandardMaterial({ map: sTex, roughness: 0.65 });
      this.shirtMesh.material = sMat;
      this.leftSleeve.material = sMat;
      this.rightSleeve.material = sMat;
    }
    const pantsId = cfg.classicClothing?.pants;
    if (pantsId && pantsId !== 'none') {
      const pTex = getClassicPantsTexture(pantsId);
      const pMat = new THREE.MeshStandardMaterial({ map: pTex, roughness: 0.7 });
      this.pelvisMesh.material = pMat;
      this.leftThigh.material = pMat;
      this.rightThigh.material = pMat;
    }

    // 7. Layered 3D Clothing
    this.layeredClothingGroup.clear();
    this.layeredLegsClothingGroup.clear();
    const lc = cfg.layeredClothing || {};
    const jacketLayer = new THREE.Group();
    jacketLayer.scale.setScalar(1.04);
    this.layeredClothingGroup.add(jacketLayer);
    const sweaterLayer = new THREE.Group();
    sweaterLayer.scale.setScalar(1.02);
    this.layeredClothingGroup.add(sweaterLayer);
    const dressLayer = new THREE.Group();
    dressLayer.scale.setScalar(1.01);
    this.layeredClothingGroup.add(dressLayer);

    if (lc.jacket && lc.jacket !== 'none') {
      if (lc.jacket === 'bomber_jacket') {
        const jMat = mat('#1e293b', { roughness: 0.4 });
        part(jacketLayer, G.box(), jMat, [0, 0.28, 0], [0.5, 0.56, 0.28]);
        part(jacketLayer, G.box(), mat('#ea580c'), [0, 0.48, 0.08], [0.24, 0.1, 0.14]);
      } else if (lc.jacket === 'trench_coat') {
        const coatMat = mat('#78350f', { roughness: 0.7 });
        part(jacketLayer, G.box(), coatMat, [0, 0.28, 0], [0.5, 0.56, 0.28]);
        part(jacketLayer, G.box(), coatMat, [0, -0.22, 0], [0.52, 0.48, 0.3]);
        part(jacketLayer, G.box(), coatMat, [-0.15, 0.52, 0.08], [0.14, 0.14, 0.14], [0, 0, 0.3]);
        part(jacketLayer, G.box(), coatMat, [0.15, 0.52, 0.08], [0.14, 0.14, 0.14], [0, 0, -0.3]);
      } else if (lc.jacket === 'leather_jacket') {
        const lMat = mat('#0f172a', { roughness: 0.25, metalness: 0.15 });
        part(jacketLayer, G.box(), lMat, [0, 0.28, 0], [0.49, 0.56, 0.27]);
        part(jacketLayer, G.box(), mat('#cbd5e1', { metalness: 0.8 }), [0.03, 0.28, 0.14], [0.02, 0.54, 0.02]);
        part(jacketLayer, G.sph(), mat('#cbd5e1', { metalness: 0.8 }), [-0.12, 0.48, 0.14], [0.03, 0.03, 0.03]);
        part(jacketLayer, G.sph(), mat('#cbd5e1', { metalness: 0.8 }), [0.12, 0.48, 0.14], [0.03, 0.03, 0.03]);
      } else if (lc.jacket === 'varsity_jacket') {
        const vBody = mat('#b91c1c');
        const vSleeve = mat('#f8fafc');
        part(jacketLayer, G.box(), vBody, [0, 0.28, 0], [0.5, 0.56, 0.28]);
        part(jacketLayer, G.box(), vSleeve, [0, 0.02, 0], [0.48, 0.05, 0.27]);
        part(jacketLayer, G.box(), vSleeve, [-0.14, 0.38, 0.145], [0.08, 0.08, 0.02]);
      }
    }

    if (lc.sweater && lc.sweater !== 'none') {
      if (lc.sweater === 'cozy_hoodie') {
        const hMat = mat('#334155');
        part(sweaterLayer, G.box(), hMat, [0, 0.28, 0], [0.48, 0.55, 0.27]);
        part(sweaterLayer, G.sph(), hMat, [0, 0.54, -0.14], [0.3, 0.2, 0.18], [-0.3, 0, 0]);
        part(sweaterLayer, G.box(), mat('#1e293b'), [0, 0.14, 0.14], [0.32, 0.16, 0.04]);
      } else if (lc.sweater === 'xmas_sweater') {
        const xMat = mat('#047857');
        part(sweaterLayer, G.box(), xMat, [0, 0.28, 0], [0.48, 0.55, 0.27]);
        part(sweaterLayer, G.box(), mat('#dc2626'), [0, 0.32, 0], [0.49, 0.14, 0.28]);
        part(sweaterLayer, G.box(), mat('#ffffff'), [0, 0.32, 0.145], [0.16, 0.1, 0.02]);
      } else if (lc.sweater === 'turtleneck') {
        const tMat = mat('#18181b');
        part(sweaterLayer, G.box(), tMat, [0, 0.28, 0], [0.47, 0.55, 0.26]);
        part(sweaterLayer, G.cyl(), tMat, [0, 0.58, 0], [0.26, 0.16, 0.24]);
      }
    }

    if (lc.dressSkirt && lc.dressSkirt !== 'none') {
      if (lc.dressSkirt === 'flared_skirt') {
        const skirtMat = mat('#db2777');
        part(this.layeredLegsClothingGroup, G.cone(), skirtMat, [0, -0.16, 0], [0.42, 0.38, 0.36], [Math.PI, 0, 0]);
      } else if (lc.dressSkirt === 'party_dress') {
        const dressMat = mat('#7c3aed');
        part(dressLayer, G.box(), dressMat, [0, 0.24, 0], [0.48, 0.48, 0.26]);
        part(this.layeredLegsClothingGroup, G.cone(), dressMat, [0, -0.22, 0], [0.46, 0.52, 0.4], [Math.PI, 0, 0]);
      }
    }

    if (lc.shoes) {
      const sMat = lc.shoes === 'boots' ? mat('#451a03') :
                   lc.shoes === 'oxford' ? mat('#0f172a', { roughness: 0.2 }) :
                   lc.shoes === 'canvas' ? mat('#e11d48') :
                   mat('#ffffff');
      this.leftShoe.material = sMat;
      this.rightShoe.material = sMat;
    }
  }

  setPumpkinHat(styleKey) {
    this.pumpkinHatKey = styleKey || null;
    this.pumpkinMount.clear();
    if (this.pumpkinHatKey) {
      const p = buildCarvedPumpkin(this.pumpkinHatKey, 0.78);
      this.pumpkinMount.add(p);
      this.hairGroup.visible = false;
    } else {
      this.hairGroup.visible = true;
    }
  }

  setHeldItem(ornKey) {
    if (this.heldKey === ornKey) return;
    this.heldKey = ornKey || null;
    this.handMount.clear();
    if (this.heldKey) {
      const m = buildOrnamentMesh(this.heldKey, 0.85);
      this.handMount.add(m);
    }
  }

  buildEmoteProp(clip) {
    this.emotePropMount.clear();
    if (clip === 'roast') {
      // Wooden skewer stick + marshmallow on tip
      part(this.emotePropMount, G.cyl(), mat('#8d5524'), [0, 0, 0.28], [0.025, 0.65, 0.025], [Math.PI / 2, 0, 0]);
      part(this.emotePropMount, G.cyl(), mat('#fff8f0', { emissive: '#ffb703', emissiveIntensity: 0.25 }), [0, 0, 0.62], [0.11, 0.15, 0.11], [Math.PI / 2, 0, 0]);
    } else if (clip === 'cocoa') {
      // Warm red mug of hot cocoa + whipped cream
      part(this.emotePropMount, G.cyl(), mat('#b3202a'), [0, 0, 0.06], [0.16, 0.2, 0.16]);
      part(this.emotePropMount, G.sph(), mat('#fff8e7'), [0, 0.1, 0.06], [0.14, 0.08, 0.14]);
    } else if (clip === 'trickOrTreat') {
      // Small candy pumpkin bucket
      const bucket = buildCarvedPumpkin('happy', 0.36);
      bucket.position.set(0, -0.12, 0.08);
      this.emotePropMount.add(bucket);
    } else if (clip === 'throwTomato') {
      part(this.emotePropMount, G.sph(), mat('#e63946'), [0, 0, 0.05], [0.18, 0.18, 0.18]);
    }
  }

  triggerSplat(durationMs = 4000) {
    this.splatUntil = performance.now() + durationMs;
    this.splatGroup.visible = true;
  }

  setDinnerbone(active) {
    this.isDinnerbone = !!active;
    if (this.isDinnerbone) {
      this.body.rotation.z = Math.PI;
      this.body.position.y = 1.6;
    } else {
      this.body.rotation.z = 0;
      this.body.position.y = 0;
    }
  }

  setName(name, title = this.title, style = this.nametagStyle) {
    this.name = name;
    this.title = title || null;
    this.nametagStyle = style || null;
    if (this.label) this.root.remove(this.label);

    const isAdmin = isAdminUser(name);
    const displayTitle = this.title || (isAdmin ? '👑 ADMIN' : null);
    const resolvedStyle = resolveNametagStyle(style);
    const isRainbow = !!(displayTitle && (displayTitle === 'GAY' || displayTitle.includes('GAY'))) || !!resolvedStyle?.rainbow;
    this.isRainbowNametag = isRainbow;

    this.label = textSprite(
      (x, w, h, animOffset = 0) => {
        const bgFill = isAdmin ? 'rgba(88, 28, 28, 0.92)' : 'rgba(15, 23, 42, 0.88)';
        x.fillStyle = bgFill;
        x.beginPath();
        x.roundRect(8, 8, w - 16, h - 16, 22);
        x.fill();

        // Border styling
        if (isRainbow) {
          const hue = Math.floor(((animOffset * 60) % 360 + 360) % 360);
          x.strokeStyle = `hsl(${hue}, 100%, 65%)`;
          x.lineWidth = 4;
        } else if (resolvedStyle?.border) {
          x.strokeStyle = resolvedStyle.border;
          x.lineWidth = 3.5;
        } else {
          x.strokeStyle = isAdmin ? 'rgba(250, 204, 21, 0.95)' : 'rgba(56, 189, 248, 0.85)';
          x.lineWidth = isAdmin ? 4 : 3;
        }
        x.stroke();

        x.textAlign = 'center';
        x.textBaseline = 'middle';

        // Title
        if (displayTitle) {
          x.font = 'bold 22px system-ui, sans-serif';
          if (isRainbow) {
            const h1 = Math.floor(((animOffset * 90) % 360 + 360) % 360);
            const grad = x.createLinearGradient(40, 0, w - 40, 0);
            grad.addColorStop(0, `hsl(${h1}, 100%, 65%)`);
            grad.addColorStop(0.5, `hsl(${(h1 + 120) % 360}, 100%, 65%)`);
            grad.addColorStop(1, `hsl(${(h1 + 240) % 360}, 100%, 65%)`);
            x.fillStyle = grad;
          } else {
            x.fillStyle = isAdmin ? '#fde047' : (resolvedStyle?.color || '#facc15');
          }
          x.fillText(displayTitle, w / 2, 28);

          x.font = resolvedStyle?.font ? `bold 26px ${resolvedStyle.font}` : 'bold 26px system-ui, sans-serif';
          if (isRainbow) {
            const h2 = Math.floor(((animOffset * 90 + 60) % 360 + 360) % 360);
            const grad = x.createLinearGradient(40, 0, w - 40, 0);
            grad.addColorStop(0, `hsl(${h2}, 100%, 75%)`);
            grad.addColorStop(0.5, `hsl(${(h2 + 120) % 360}, 100%, 75%)`);
            grad.addColorStop(1, `hsl(${(h2 + 240) % 360}, 100%, 75%)`);
            x.fillStyle = grad;
          } else if (resolvedStyle?.color) {
            x.fillStyle = resolvedStyle.color;
          } else {
            x.fillStyle = '#f8fafc';
          }
          x.fillText(name, w / 2, 60);
        } else {
          x.font = resolvedStyle?.font ? `bold 32px ${resolvedStyle.font}` : 'bold 32px system-ui, sans-serif';
          if (resolvedStyle?.color) {
            x.fillStyle = resolvedStyle.color;
          } else {
            x.fillStyle = '#f8fafc';
          }
          x.fillText(name, w / 2, h / 2);
        }
      },
      360,
      86,
      0.44
    );
    this.label.position.y = HEIGHT + 0.42;
    this.root.add(this.label);
  }

  setAccessory(accKey) {
    this.accessoryKey = accKey || null;
    this.accessoryGroup.clear();
    this.backAccessoryGroup.clear();
    if (!accKey) return;

    const accMesh = buildAccessoryMesh(accKey);
    if (accKey === 'devil_wings') {
      this.backAccessoryGroup.add(accMesh);
    } else {
      this.accessoryGroup.add(accMesh);
    }
  }

  setAura(auraKey) {
    this.auraKey = auraKey || null;
    this.auraGroup.clear();
    if (!auraKey) return;
    const aMesh = buildAuraMesh(auraKey);
    this.auraGroup.add(aMesh);
    this.auraGroup.userData = aMesh.userData;
  }

  setAdminAura(enabled) {
    this.adminAuraGroup.clear();
    if (!enabled) return;
    const adminMesh = buildAuraMesh('admin');
    this.adminAuraGroup.add(adminMesh);
    this.adminAuraGroup.userData = adminMesh.userData;
  }

  setLimbState(limbs = {}) {
    if (limbs.head !== undefined) {
      if (this.headGroup.visible && !limbs.head) this.spawnLegoPop(0, 1.4, 0);
      this.headGroup.visible = !!limbs.head;
      this.limbState.head = !!limbs.head;
    }
    if (limbs.leftArm !== undefined) {
      if (this.leftArm.visible && !limbs.leftArm) this.spawnLegoPop(-0.35, 1.1, 0);
      this.leftArm.visible = !!limbs.leftArm;
      this.limbState.leftArm = !!limbs.leftArm;
    }
    if (limbs.rightArm !== undefined) {
      if (this.rightArm.visible && !limbs.rightArm) this.spawnLegoPop(0.35, 1.1, 0);
      this.rightArm.visible = !!limbs.rightArm;
      this.limbState.rightArm = !!limbs.rightArm;
    }
    if (limbs.legs !== undefined) {
      if (this.leftLeg.visible && !limbs.legs) {
        this.spawnLegoPop(-0.15, 0.4, 0);
        this.spawnLegoPop(0.15, 0.4, 0);
      }
      this.leftLeg.visible = !!limbs.legs;
      this.rightLeg.visible = !!limbs.legs;
      this.limbState.legs = !!limbs.legs;
    }
  }

  setMidasGolden(active = true) {
    this.isMidasGolden = !!active;
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      metalness: 0.95,
      roughness: 0.15,
      emissive: 0x553300,
      emissiveIntensity: 0.3
    });
    this.root.traverse(child => {
      if (child.isMesh && child !== this.nameSprite && child !== this.bubbleSprite && child !== this.speakingBadge) {
        if (active) {
          if (!child.userData.origMaterial) child.userData.origMaterial = child.material;
          child.material = goldMat;
        } else if (child.userData.origMaterial) {
          child.material = child.userData.origMaterial;
          delete child.userData.origMaterial;
        }
      }
    });
  }

  setGhostMode(active = true) {
    this.isGhostMode = !!active;
    this.root.traverse(child => {
      if (child.isMesh && child !== this.nameSprite && child !== this.bubbleSprite && child !== this.speakingBadge) {
        if (active) {
          if (child.material) {
            child.material.transparent = true;
            child.material.opacity = 0.35;
          }
        } else {
          if (child.material) {
            child.material.transparent = false;
            child.material.opacity = 1.0;
          }
        }
      }
    });
  }

  spawnLegoPop(ox, oy, oz) {
    const colors = ['#dc2626', '#2563eb', '#facc15', '#16a34a', '#9333ea', '#ea580c'];
    for (let i = 0; i < 5; i++) {
      const col = colors[Math.floor(Math.random() * colors.length)];
      const m = new THREE.Mesh(G.box(), mat(col, { roughness: 0.3 }));
      m.scale.set(0.14, 0.1, 0.14);
      m.position.set(ox + (Math.random() - 0.5) * 0.1, oy + (Math.random() - 0.5) * 0.1, oz + (Math.random() - 0.5) * 0.1);
      this.root.add(m);
      this.legoBricks.push({
        mesh: m,
        vx: (Math.random() - 0.5) * 2.8,
        vy: 1.8 + Math.random() * 2.5,
        vz: (Math.random() - 0.5) * 2.8,
        rx: (Math.random() - 0.5) * 10,
        ry: (Math.random() - 0.5) * 10,
        life: 0,
        maxLife: 2.2,
      });
    }
  }

  setTitle(title) {
    this.title = title;
    this.setName(this.name, title);
  }

  setSpeaking(speaking) {
    if (this.isSpeaking === speaking && this.speakingBadge) return;
    this.isSpeaking = speaking;
    if (!this.speakingBadge) {
      this.speakingBadge = textSprite(
        (x, w, h) => {
          // Circular green badge with white border and animated soundwave / mic
          x.fillStyle = 'rgba(16, 185, 129, 0.95)';
          x.beginPath();
          x.arc(w / 2, h / 2, h * 0.44, 0, Math.PI * 2);
          x.fill();
          x.strokeStyle = '#ffffff';
          x.lineWidth = 5;
          x.stroke();
          x.font = '36px system-ui, sans-serif';
          x.textAlign = 'center';
          x.textBaseline = 'middle';
          x.fillStyle = '#ffffff';
          x.fillText('🎙️', w / 2, h / 2);
        },
        96,
        96,
        0.32
      );
      this.speakingBadge.position.y = HEIGHT + 0.74;
      this.root.add(this.speakingBadge);
    }
    this.speakingBadge.visible = !!speaking;
  }

  say(text) {
    const t = text.length > 70 ? text.slice(0, 67) + '…' : text;
    this.bubbleUntil = performance.now() + 6500;
    if (!this.bubbleEl) {
      this.bubbleEl = document.createElement('div');
      this.bubbleEl.className = 'speech-bubble';
      document.getElementById('speechLayer')?.appendChild(this.bubbleEl);
    }
    this.bubbleEl.textContent = t;
    this.bubbleEl.style.display = 'block';
  }

  updateBubble(camera) {
    if (!this.bubbleEl) return;
    if (performance.now() > this.bubbleUntil) {
      this.bubbleEl.remove();
      this.bubbleEl = null;
      return;
    }
    const layer = document.getElementById('speechLayer');
    if (!camera || !this.root.visible || layer?.classList.contains('safe-hidden')) {
      this.bubbleEl.style.display = 'none';
      return;
    }
    _headPos.set(0, HEIGHT + 0.35, 0);
    this.root.localToWorld(_headPos);
    _headPos.project(camera);

    if (_headPos.z > 1 || _headPos.z < -1) {
      this.bubbleEl.style.display = 'none';
      return;
    }
    const sx = Math.round((_headPos.x * 0.5 + 0.5) * innerWidth);
    const sy = Math.round((-_headPos.y * 0.5 + 0.5) * innerHeight);
    this.bubbleEl.style.display = 'block';
    this.bubbleEl.style.left = `${sx}px`;
    this.bubbleEl.style.top = `${sy}px`;
  }

  destroy() {
    if (this.bubbleEl) {
      this.bubbleEl.remove();
      this.bubbleEl = null;
    }
    if (this.root.parent) {
      this.root.parent.remove(this.root);
    }
  }

  /** Locomotion state: 'idle' | 'walk' | 'run' | 'jump' | 'sit' | 'couple_sit' */
  setLocomotion(s, sitInfo = null) {
    this.jumping = s === 'jump';
    this.sitting = s === 'sit' || s === 'couple_sit' ? (sitInfo || { type: s }) : null;
    this.base = s === 'run' ? 'Running' : s === 'walk' ? 'Walking' : s === 'sit' || s === 'couple_sit' ? 'Sitting' : 'Idle';
  }

  playEmote(clipKey, hold = true) {
    const clip = EMOTE_CLIP[clipKey] || clipKey || 'wave';
    const dur = EMOTE_DURATION[clip] || 2500;
    this.emote = clip;
    this.emoteHold = !!hold;
    this.emoteStart = performance.now();
    this.emoteUntil = hold ? Infinity : (this.emoteStart + dur);
    this.buildEmoteProp(clip);
  }

  update(dt) {
    const now = performance.now();
    this.animTime += dt;
    const t = this.animTime;

    if (this.splatGroup.visible && now > this.splatUntil) {
      this.splatGroup.visible = false;
    }

    // Dynamic Head Blinking & Breathing Expressions
    if (this.customConfig?.headType === 'dynamic' && this.leftEye?.visible) {
      this.blinkTimer = (this.blinkTimer || 2.5) - dt;
      if (this.blinkTimer <= 0) {
        this.isBlinking = true;
        this.blinkTimer = 2.4 + Math.random() * 3.2;
      }
      if (this.isBlinking) {
        this.leftEye.scale.y = 0.01;
        this.rightEye.scale.y = 0.01;
        if (Math.abs(this.blinkTimer - 2.3) > 0.14) {
          this.isBlinking = false;
        }
      } else {
        this.leftEye.scale.y = 0.065;
        this.rightEye.scale.y = 0.065;
      }
      if (this.mouthMesh) {
        this.mouthMesh.scale.x = 0.09 + Math.sin(t * 2.2) * 0.012;
      }
    }

    if (this.speakingBadge && this.speakingBadge.visible) {
      const s = 0.32 + Math.sin(now * 0.012) * 0.04;
      this.speakingBadge.scale.set(s, s, 1);
    }

    // Dynamic 24/7 Rainbow RGB update for nametag
    if (this.isRainbowNametag && this.label && this.label.userData) {
      this.rainbowTimer = (this.rainbowTimer || 0) + dt;
      if (this.rainbowTimer >= 0.06) {
        this.rainbowTimer = 0;
        const { ctx, draw, w, h, texture } = this.label.userData;
        ctx.clearRect(0, 0, w, h);
        draw(ctx, w, h, now * 0.003);
        texture.needsUpdate = true;
      }
    }

    // Update Lego Brick physics
    for (let i = this.legoBricks.length - 1; i >= 0; i--) {
      const b = this.legoBricks[i];
      b.life += dt;
      b.vy -= 9.8 * dt;
      b.mesh.position.x += b.vx * dt;
      b.mesh.position.y += b.vy * dt;
      b.mesh.position.z += b.vz * dt;
      b.mesh.rotation.x += b.rx * dt;
      b.mesh.rotation.y += b.ry * dt;
      if (b.mesh.position.y < 0.05) {
        b.mesh.position.y = 0.05;
        b.vy = -b.vy * 0.35;
        b.vx *= 0.7;
        b.vz *= 0.7;
      }
      if (b.life >= b.maxLife) {
        this.root.remove(b.mesh);
        this.legoBricks.splice(i, 1);
      }
    }

    // Update Aura Particles & Ring
    if (this.auraGroup?.userData?.update) {
      this.auraGroup.userData.update(this.animTime);
    }
    if (this.adminAuraGroup?.userData?.update) {
      this.adminAuraGroup.userData.update(this.animTime);
    }

    // Cancel emote if non-held emote expired or player started walking/running/jumping
    if (this.emote && ((!this.emoteHold && now > this.emoteUntil) || (this.base !== 'Idle' && this.base !== 'Sitting') || this.jumping)) {
      this.emote = null;
      this.emoteHold = false;
      this.emotePropMount.clear();
    }

    // Reset transforms before procedural pose
    this.hips.position.set(0, 0.78, 0);
    this.hips.rotation.set(0, 0, 0);
    this.torso.rotation.set(0, 0, 0);
    this.headGroup.rotation.set(0, 0, 0);
    this.leftArm.rotation.set(0, 0, 0);
    this.rightArm.rotation.set(0, 0, 0);
    this.leftLeg.rotation.set(0, 0, 0);
    this.rightLeg.rotation.set(0, 0, 0);

    // 1. Base Locomotion or Sitting Pose
    if (this.jumping) {
      // Dynamic parkour airborne leaping silhouette
      this.hips.position.y = 0.82;
      this.torso.rotation.x = 0.18;
      this.leftArm.rotation.set(-2.3, 0.2, 0.45);
      this.rightArm.rotation.set(-2.1, -0.2, -0.45);
      this.leftLeg.rotation.set(-0.65, 0, -0.1);
      this.rightLeg.rotation.set(0.42, 0, 0.1);
      this.headGroup.rotation.x = -0.12;
    } else if (this.base === 'Sitting') {
      // Sitting on Chair / Couple Sofa / Campfire Log
      this.hips.position.set(0, 0.40, 0.04);
      this.leftLeg.rotation.x = -Math.PI / 2 + 0.05;
      this.rightLeg.rotation.x = -Math.PI / 2 + 0.05;
      this.leftArm.rotation.x = -0.32;
      this.rightArm.rotation.x = -0.32;
      // Couple Seat Lean!
      if (this.sitting?.lean) {
        this.torso.rotation.z = this.sitting.lean * 0.14;
        this.headGroup.rotation.z = this.sitting.lean * 0.18;
      }
    } else if (this.base === 'Walking' || this.base === 'Running') {
      const speed = this.base === 'Running' ? 12 : 7.5;
      const amp = this.base === 'Running' ? 0.85 : 0.52;
      const s = Math.sin(t * speed);
      this.hips.position.y = 0.78 + Math.abs(Math.cos(t * speed)) * (this.base === 'Running' ? 0.08 : 0.04);
      this.leftLeg.rotation.x = s * amp;
      this.rightLeg.rotation.x = -s * amp;
      this.leftArm.rotation.x = -s * amp * 0.85;
      this.rightArm.rotation.x = s * amp * 0.85;
      // Natural shoulder / torso twist
      this.torso.rotation.x = this.base === 'Running' ? 0.16 : 0.06;
      this.torso.rotation.y = -s * (this.base === 'Running' ? 0.14 : 0.06);
      this.headGroup.rotation.y = s * (this.base === 'Running' ? 0.06 : 0.03);
    } else {
      // Idle gentle breathing with natural weight shift
      const b = Math.sin(t * 2.2);
      this.hips.position.y = 0.78 + b * 0.015;
      this.hips.rotation.z = Math.sin(t * 1.1) * 0.02;
      this.leftArm.rotation.z = 0.08 + b * 0.02;
      this.rightArm.rotation.z = -0.08 - b * 0.02;
      this.torso.rotation.z = -Math.sin(t * 1.1) * 0.015;
      this.headGroup.rotation.y = Math.sin(t * 0.8) * 0.09;
      this.headGroup.rotation.x = Math.sin(t * 1.6) * 0.03;
    }

    // If holding an ornament, raise right forearm slightly
    if (this.heldKey && !this.emote) {
      this.rightArm.rotation.x = -0.95;
    }

    // 2. Active Emote / Action Override
    if (this.emote) {
      const elapsed = (now - this.emoteStart) / 1000;
      switch (this.emote) {
        case 'wave': {
          this.rightArm.rotation.x = -2.55;
          this.rightArm.rotation.z = -0.35 + Math.sin(elapsed * 12) * 0.38;
          this.headGroup.rotation.z = 0.1;
          break;
        }
        case 'handshake': {
          this.rightArm.rotation.x = -1.35 + Math.sin(elapsed * 10) * 0.22;
          this.rightArm.rotation.y = -0.15;
          this.torso.rotation.x = 0.12;
          break;
        }
        case 'hug': {
          const close = Math.min(1, elapsed * 2.5);
          this.leftArm.rotation.x = -1.45;
          this.rightArm.rotation.x = -1.45;
          this.leftArm.rotation.y = 0.45 * close;
          this.rightArm.rotation.y = -0.45 * close;
          this.torso.rotation.z = Math.sin(elapsed * 5) * 0.08;
          break;
        }
        case 'roast': {
          // Extending marshmallow stick toward campfire
          this.rightArm.rotation.x = -1.25 + Math.sin(elapsed * 4) * 0.08;
          this.leftArm.rotation.x = -0.45;
          break;
        }
        case 'cocoa': {
          // Raising hot cocoa mug to mouth to sip
          const sip = Math.sin(elapsed * 3) * 0.5 + 0.5;
          this.rightArm.rotation.x = -1.35 - sip * 0.55;
          this.rightArm.rotation.y = -0.35;
          this.headGroup.rotation.x = -sip * 0.22;
          break;
        }
        case 'trickOrTreat': {
          this.rightArm.rotation.x = -1.2;
          this.leftArm.rotation.x = -2.1 + Math.sin(elapsed * 10) * 0.3;
          this.hips.position.y += Math.abs(Math.sin(elapsed * 8)) * 0.12;
          break;
        }
        case 'throwTomato': {
          const p = Math.min(1, elapsed / 0.5);
          this.rightArm.rotation.x = -2.6 + p * 2.2;
          this.torso.rotation.y = (0.5 - p) * 0.6;
          break;
        }
        case 'scared': {
          this.leftArm.rotation.x = -2.7;
          this.rightArm.rotation.x = -2.7;
          this.leftArm.rotation.z = 0.35;
          this.rightArm.rotation.z = -0.35;
          this.torso.rotation.x = -0.22;
          this.hips.position.y += Math.abs(Math.sin(elapsed * 18)) * 0.16;
          this.headGroup.rotation.y = Math.sin(elapsed * 22) * 0.25;
          break;
        }
        case 'interact': {
          this.leftArm.rotation.x = -1.5 + Math.sin(elapsed * 10) * 0.25;
          this.rightArm.rotation.x = -1.5 - Math.sin(elapsed * 10) * 0.25;
          break;
        }
        case 'flex': {
          // Double biceps flex! Upper arms horizontal out, forearms bent up 90 deg
          this.torso.rotation.x = -0.06;
          this.leftArm.rotation.set(-1.15, 0.25, 1.35);
          this.rightArm.rotation.set(-1.15, -0.25, -1.35);
          this.hips.position.y = 0.8 + Math.sin(elapsed * 5) * 0.015;
          break;
        }
        case 'cheer_jump': {
          // Joyful cheer V-arms and one leg lifted
          this.leftArm.rotation.set(-2.55, 0, 0.55);
          this.rightArm.rotation.set(-2.55, 0, -0.55);
          this.leftLeg.rotation.set(-0.85, 0, -0.2);
          this.rightLeg.rotation.set(0.1, 0, 0.05);
          this.hips.position.y = 0.88 + Math.abs(Math.sin(elapsed * 7)) * 0.12;
          this.headGroup.rotation.z = Math.sin(elapsed * 6) * 0.12;
          break;
        }
        case 'starfish': {
          // Jumping Jack X-Pose
          this.leftArm.rotation.set(-1.6, 0, 0.95);
          this.rightArm.rotation.set(-1.6, 0, -0.95);
          this.leftLeg.rotation.set(0, 0, 0.42);
          this.rightLeg.rotation.set(0, 0, -0.42);
          this.hips.position.y = 0.9 + Math.abs(Math.sin(elapsed * 6)) * 0.08;
          break;
        }
        case 'head_heart': {
          // Heart arch over crown
          this.leftArm.rotation.set(-2.85, 0, -0.65);
          this.rightArm.rotation.set(-2.85, 0, 0.65);
          this.hips.rotation.z = Math.sin(elapsed * 4) * 0.06;
          this.headGroup.rotation.y = Math.sin(elapsed * 4) * 0.1;
          break;
        }
        case 'despair': {
          // Cowering / Defeated Fetal OTL pose
          this.hips.position.set(0, 0.22, 0.1);
          this.torso.rotation.x = 1.35;
          this.leftLeg.rotation.set(-1.75, 0, -0.15);
          this.rightLeg.rotation.set(-1.75, 0, 0.15);
          this.leftArm.rotation.set(0.65, 0, -0.2);
          this.rightArm.rotation.set(0.65, 0, 0.2);
          this.headGroup.rotation.x = 0.65;
          break;
        }
        case 'dab': {
          // Classic cool hip-hop Dab
          this.rightArm.rotation.set(-1.95, -0.2, -0.95);
          this.leftArm.rotation.set(-2.15, 0.45, 0.75);
          this.torso.rotation.set(0.22, 0.42, -0.2);
          this.headGroup.rotation.set(0.35, -0.4, 0.2);
          this.leftLeg.rotation.set(-0.25, 0, -0.2);
          this.rightLeg.rotation.set(0.35, 0, 0.2);
          break;
        }
        case 'lay_chill': {
          // Lying down sideways on the floor propped by hand
          this.hips.position.set(0, 0.2, 0);
          this.hips.rotation.z = Math.PI / 2 - 0.15;
          this.leftLeg.rotation.set(0.12, 0, 0.1);
          this.rightLeg.rotation.set(-0.12, 0, -0.1);
          this.leftArm.rotation.set(-1.6, 0, 0.65);
          this.rightArm.rotation.set(-0.35, 0, -0.35);
          this.headGroup.rotation.z = -0.35;
          break;
        }
        case 'kneel': {
          // Polite Seiza kneeling pose
          this.hips.position.set(0, 0.38, 0.04);
          this.leftLeg.rotation.set(-1.45, 0, 0.05);
          this.rightLeg.rotation.set(-1.45, 0, -0.05);
          this.torso.rotation.x = -0.05;
          this.leftArm.rotation.set(-0.65, 0, -0.1);
          this.rightArm.rotation.set(-0.65, 0, 0.1);
          this.headGroup.rotation.x = Math.sin(elapsed * 2) * 0.05;
          break;
        }
      }
    }
  }
}

export function hueFor(str = '') {
  let h = 0;
  for (const c of str) h = (h * 31 + c.codePointAt(0)) % 360;
  return h;
}
