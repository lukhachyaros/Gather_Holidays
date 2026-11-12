import * as THREE from 'three';

const geoCache = new Map(), matCache = new Map();
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
  const vol = Math.abs(scale[0] * scale[1] * scale[2]);
  o.castShadow = vol > 0.02;
  o.receiveShadow = vol > 0.05;
  parent.add(o);
  return o;
}

export function labelSprite(text, bg = 'rgba(15, 20, 35, 0.82)', fg = '#ffffff', worldH = 0.42) {
  const lines = text.split('\n');
  const lineCount = lines.length;
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = lineCount > 1 ? 160 : 96;
  const x = c.getContext('2d');
  const fontSize = lineCount > 1 ? 38 : 44;
  x.font = `bold ${fontSize}px system-ui, -apple-system, sans-serif`;

  let maxW = 0;
  for (const ln of lines) maxW = Math.max(maxW, x.measureText(ln).width);
  const pillW = Math.min(c.width - 32, maxW + 64);
  const pillH = c.height - 24;
  const pillX = (c.width - pillW) / 2;

  x.fillStyle = bg;
  x.beginPath();
  x.roundRect(pillX, 12, pillW, pillH, 22);
  x.fill();
  x.strokeStyle = 'rgba(255,255,255,0.28)';
  x.lineWidth = 3;
  x.stroke();
  x.fillStyle = fg;
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  if (lineCount > 1) {
    const lineH = pillH / (lineCount + 0.4);
    for (let i = 0; i < lineCount; i++) {
      const ly = 12 + lineH * (i + 0.7);
      x.fillText(lines[i], c.width / 2, ly, pillW - 32);
    }
  } else {
    x.fillText(text, c.width / 2, c.height / 2, pillW - 32);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false }));
  s.scale.set(worldH * (c.width / c.height), worldH, 1);
  s.renderOrder = 8;
  return s;
}
