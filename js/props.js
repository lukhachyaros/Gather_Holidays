// Low-poly props built procedurally (no external assets) + emoji-sprite fallback.
// To use a real model instead, register a GLB loader in PROP_GLB (emoji -> url) — see README.
import * as THREE from 'three';

const geoCache = new Map(), matCache = new Map(), texCache = new Map();
export const geo = (key, make) => { if (!geoCache.has(key)) geoCache.set(key, make()); return geoCache.get(key); };
export const mat = (color, opts = {}) => {
  const k = color + JSON.stringify(opts);
  if (!matCache.has(k)) matCache.set(k, new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0, ...opts }));
  return matCache.get(k);
};
const G = {
  sph: () => geo('sph', () => new THREE.SphereGeometry(0.5, 16, 12)),
  cyl: () => geo('cyl', () => new THREE.CylinderGeometry(0.5, 0.5, 1, 14)),
  cone: () => geo('cone', () => new THREE.ConeGeometry(0.5, 1, 14)),
  box: () => geo('box', () => new THREE.BoxGeometry(1, 1, 1)),
  oct: () => geo('oct', () => new THREE.OctahedronGeometry(0.5)),
};
function part(parent, g, material, pos = [0, 0, 0], scale = [1, 1, 1], rot) {
  const o = new THREE.Mesh(g, material);
  o.position.set(...pos); o.scale.set(...scale); if (rot) o.rotation.set(...rot);
  o.castShadow = true; o.receiveShadow = true; parent.add(o); return o;
}

export function emojiTexture(e) {
  if (!texCache.has(e)) {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d'); x.font = '100px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",serif';
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(e, 64, 70);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; texCache.set(e, t);
  }
  return texCache.get(e);
}
export function emojiSprite(e, size = 1) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTexture(e), transparent: true, depthWrite: false }));
  s.scale.set(size, size, 1); return s;
}

const B = {
  '🎃': g => { part(g, G.sph(), mat('#ff7a00', { emissive: '#ff4d00', emissiveIntensity: 0.35 }), [0, 0.4, 0], [0.9, 0.75, 0.9]);
    part(g, G.cyl(), mat('#3b5d1a'), [0, 0.83, 0], [0.1, 0.2, 0.1]);
    part(g, G.box(), mat('#ffe066', { emissive: '#ffcc00', emissiveIntensity: 1 }), [-0.17, 0.45, 0.4], [0.14, 0.14, 0.05]);
    part(g, G.box(), mat('#ffe066', { emissive: '#ffcc00', emissiveIntensity: 1 }), [0.17, 0.45, 0.4], [0.14, 0.14, 0.05]);
    part(g, G.box(), mat('#ffe066', { emissive: '#ffcc00', emissiveIntensity: 1 }), [0, 0.25, 0.42], [0.35, 0.1, 0.05]); },
  '👻': g => { part(g, G.sph(), mat('#f4f4ff', { emissive: '#aab', emissiveIntensity: 0.4 }), [0, 0.8, 0], [0.8, 0.9, 0.8]);
    part(g, G.cone(), mat('#f4f4ff', { emissive: '#aab', emissiveIntensity: 0.4 }), [0, 0.35, 0], [0.8, 0.7, 0.8], [Math.PI, 0, 0]);
    part(g, G.sph(), mat('#111'), [-0.15, 0.9, 0.33], [0.1, 0.14, 0.1]); part(g, G.sph(), mat('#111'), [0.15, 0.9, 0.33], [0.1, 0.14, 0.1]); },
  '💀': g => { part(g, G.sph(), mat('#eee'), [0, 0.5, 0], [0.7, 0.7, 0.7]); part(g, G.box(), mat('#eee'), [0, 0.2, 0.05], [0.4, 0.25, 0.4]);
    part(g, G.sph(), mat('#111'), [-0.14, 0.55, 0.3], [0.16, 0.2, 0.1]); part(g, G.sph(), mat('#111'), [0.14, 0.55, 0.3], [0.16, 0.2, 0.1]); },
  '🎄': g => tree(g, '#1f6b34', '#0f4d23', true),
  '🎁': g => { const c = ['#c1121f', '#1b7f3b', '#1d4ed8'][Math.floor(Math.random() * 3)];
    part(g, G.box(), mat(c), [0, 0.3, 0], [0.6, 0.6, 0.6]); part(g, G.box(), mat('#ffd166'), [0, 0.3, 0], [0.64, 0.12, 0.64]);
    part(g, G.box(), mat('#ffd166'), [0, 0.3, 0], [0.12, 0.64, 0.64]); part(g, G.sph(), mat('#ffd166'), [0, 0.68, 0], [0.22, 0.14, 0.22]); },
  '⛄': g => { const w = mat('#fff'); part(g, G.sph(), w, [0, 0.4, 0], [0.8, 0.8, 0.8]); part(g, G.sph(), w, [0, 0.98, 0], [0.55, 0.55, 0.55]);
    part(g, G.sph(), w, [0, 1.4, 0], [0.4, 0.4, 0.4]); part(g, G.cone(), mat('#ff7a00'), [0, 1.4, 0.25], [0.08, 0.25, 0.08], [Math.PI / 2, 0, 0]);
    part(g, G.cyl(), mat('#222'), [0, 1.65, 0], [0.4, 0.05, 0.4]); part(g, G.cyl(), mat('#222'), [0, 1.8, 0], [0.26, 0.28, 0.26]); },
  '🏮': g => { part(g, G.cyl(), mat('#d62828', { emissive: '#ff3b1f', emissiveIntensity: 0.9 }), [0, 0.7, 0], [0.55, 0.55, 0.55]);
    part(g, G.cyl(), mat('#ffd166'), [0, 1.0, 0], [0.3, 0.06, 0.3]); part(g, G.cyl(), mat('#ffd166'), [0, 0.4, 0], [0.3, 0.06, 0.3]);
    part(g, G.cyl(), mat('#ffd166'), [0, 0.1, 0], [0.04, 0.5, 0.04]); },
  '🧧': g => { part(g, G.box(), mat('#d00000', { emissive: '#600', emissiveIntensity: 0.4 }), [0, 0.7, 0], [0.45, 0.7, 0.06]);
    part(g, G.cyl(), mat('#ffd166'), [0, 0.72, 0.04], [0.2, 0.02, 0.2], [Math.PI / 2, 0, 0]); },
  '🌸': g => blossom(g, '#ffb7c5'),
  '🌹': g => blossom(g, '#e11d48'),
  '🕯️': g => { part(g, G.cyl(), mat('#f8f1dc'), [0, 0.3, 0], [0.14, 0.6, 0.14]); part(g, G.cone(), mat('#ffb703', { emissive: '#ffb703', emissiveIntensity: 2 }), [0, 0.7, 0], [0.1, 0.22, 0.1]); },
  '⭐': g => { const s = part(g, G.oct(), mat('#ffd60a', { emissive: '#ffd60a', emissiveIntensity: 1.2 }), [0, 1.0, 0], [0.7, 0.7, 0.25]); s.userData.spin = true; },
  '🌕': g => { const s = part(g, G.sph(), mat('#fff3b0', { emissive: '#fff3b0', emissiveIntensity: 0.9 }), [0, 1.2, 0], [0.9, 0.9, 0.9]); s.userData.bob = true; },
  '🎈': g => { part(g, G.sph(), mat(['#ef476f', '#06d6a0', '#118ab2', '#ffd166'][Math.floor(Math.random() * 4)]), [0, 1.3, 0], [0.55, 0.65, 0.55]);
    part(g, G.cyl(), mat('#ddd'), [0, 0.6, 0], [0.01, 1.0, 0.01]); },
  '🎆': g => firework(g), '🎇': g => firework(g),
  '🎋': g => { for (let i = 0; i < 3; i++) part(g, G.cyl(), mat('#5aa13a'), [(i - 1) * 0.18, 0.9, (i % 2) * 0.12], [0.1, 1.8 - i * 0.2, 0.1]); },
  '🥮': g => { part(g, G.cyl(), mat('#c98a3d'), [0, 0.15, 0], [0.55, 0.3, 0.55]); },
  '🧸': g => { const b = mat('#a47148'); part(g, G.sph(), b, [0, 0.35, 0], [0.5, 0.55, 0.45]); part(g, G.sph(), b, [0, 0.8, 0], [0.4, 0.4, 0.4]);
    part(g, G.sph(), b, [-0.17, 1.0, 0], [0.16, 0.16, 0.16]); part(g, G.sph(), b, [0.17, 1.0, 0], [0.16, 0.16, 0.16]); },
};
function tree(g, c1, c2, star) {
  part(g, G.cyl(), mat('#5b3a1e'), [0, 0.25, 0], [0.25, 0.5, 0.25]);
  part(g, G.cone(), mat(c1), [0, 0.9, 0], [1.2, 1.0, 1.2]); part(g, G.cone(), mat(c2), [0, 1.5, 0], [0.95, 0.9, 0.95]); part(g, G.cone(), mat(c1), [0, 2.05, 0], [0.7, 0.8, 0.7]);
  if (star) part(g, G.oct(), mat('#ffd60a', { emissive: '#ffd60a', emissiveIntensity: 1.2 }), [0, 2.55, 0], [0.3, 0.3, 0.15]);
}
function blossom(g, c) {
  part(g, G.cyl(), mat('#4a7c2f'), [0, 0.2, 0], [0.08, 0.4, 0.08]);
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; part(g, G.sph(), mat(c), [Math.cos(a) * 0.18, 0.5, Math.sin(a) * 0.18], [0.22, 0.12, 0.22]); }
  part(g, G.sph(), mat('#ffd166'), [0, 0.52, 0], [0.12, 0.12, 0.12]);
}
function firework(g) {
  const cols = ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#c77dff'];
  part(g, G.cyl(), mat('#5b3a1e'), [0, 0.5, 0], [0.06, 1.0, 0.06]);
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; part(g, G.sph(), mat(cols[i % 5], { emissive: cols[i % 5], emissiveIntensity: 1.2 }), [Math.cos(a) * 0.5, 1.5 + Math.sin(a) * 0.5, 0], [0.12, 0.12, 0.12]); }
}

// Registry hook: emoji -> GLB url. Loaded lazily by world.js if present.
export const PROP_GLB = {};

/** Build a decoration for an emoji; unknown emojis become a billboard sprite on a pole. */
export function buildProp(e) {
  const g = new THREE.Group();
  const b = B[e];
  if (b) b(g);
  else { const s = emojiSprite(e, 1.2); s.position.y = 0.8; s.userData.bob = true; g.add(s); }
  g.userData.emoji = e;
  return g;
}

/** Large themed tree for 'T' tiles. */
export function buildTree(themeKey) {
  const g = new THREE.Group();
  const trunk = mat('#5b3a1e');
  if (themeKey === 'halloween') {
    part(g, G.cyl(), mat('#2a1a10'), [0, 1.2, 0], [0.35, 2.4, 0.35]);
    part(g, G.cyl(), mat('#2a1a10'), [0.4, 2.0, 0], [0.15, 1.2, 0.15], [0, 0, -0.9]);
    part(g, G.cyl(), mat('#2a1a10'), [-0.4, 2.2, 0.1], [0.12, 1.0, 0.12], [0, 0, 0.9]);
  } else if (themeKey === 'christmas') { tree(g, '#1f6b34', '#14532d', false); [[-.3, .9, .4], [.35, 1.5, .25], [0, 2.0, .3]].forEach((p, i) => part(g, G.sph(), mat('#fff'), p, [.3, .18, .3])); g.scale.setScalar(1.3); }
  else if (themeKey === 'tet' || themeKey === 'valentine') {
    part(g, G.cyl(), trunk, [0, 0.9, 0], [0.3, 1.8, 0.3]);
    const c = themeKey === 'tet' ? '#ffb7c5' : '#f472b6';
    for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; part(g, G.sph(), mat(c), [Math.cos(a) * 0.6, 1.8 + (i % 3) * 0.25, Math.sin(a) * 0.6], [0.8, 0.7, 0.8]); }
    part(g, G.sph(), mat(c), [0, 2.4, 0], [1, 0.8, 1]);
  } else {
    part(g, G.cyl(), trunk, [0, 0.9, 0], [0.3, 1.8, 0.3]);
    const c = themeKey === 'midautumn' ? '#e9a23b' : '#2f8f4e';
    part(g, G.sph(), mat(c), [0, 2.2, 0], [1.6, 1.4, 1.6]);
  }
  return g;
}

export function buildEnvelope() {
  const g = new THREE.Group();
  part(g, G.box(), mat('#fff8e7', { emissive: '#ffd166', emissiveIntensity: 0.35 }), [0, 0.9, 0], [0.7, 0.45, 0.06]);
  part(g, G.cone(), mat('#e9c46a'), [0, 1.0, 0.04], [0.7, 0.3, 0.02], [0, 0, Math.PI]).rotation.x = 0;
  part(g, G.sph(), mat('#e63946'), [0, 0.9, 0.06], [0.12, 0.12, 0.05]);
  g.userData.bob = true; return g;
}
