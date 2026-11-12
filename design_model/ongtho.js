// js/ongtho.js — Model 3D "Ông Thọ" (procedural, three.js). Hướng mặt: +Z, chân đặt tại y=0.
import * as THREE from 'three';

const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0, ...o });

export function createOngTho({ height = 2.45 } = {}) {
  const g = new THREE.Group();
  g.name = 'OngTho';

  const M = {
    skin: mat(0xf0a3ab, { roughness: 0.5 }),
    gold: mat(0xe8b923, { roughness: 0.35, metalness: 0.45 }),
    goldDk: mat(0xb8860b, { roughness: 0.4, metalness: 0.5 }),
    white: mat(0xf5f5f0, { roughness: 0.9 }),
    pink: mat(0xe9a3b8),
    blue: mat(0x8fcbd8),
    base: mat(0x5a3b2e),
    wood: mat(0x6b4226, { roughness: 0.8 }),
    peach: mat(0xffb59a),
    green: mat(0x2e9e5b, { roughness: 0.3 }),
    red: mat(0xc0392b),
    dark: mat(0x2b1d1a),
  };

  const add = (geo, m, x = 0, y = 0, z = 0, parent = g) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  };
  const sph = (r, m, x, y, z, sx = 1, sy = 1, sz = 1) => {
    const s = add(new THREE.SphereGeometry(r, 24, 16), m, x, y, z);
    s.scale.set(sx, sy, sz);
    return s;
  };

  // ===== Đế sen =====
  add(new THREE.CylinderGeometry(0.95, 1.0, 0.09, 40), M.base, 0, 0.045, 0);
  add(new THREE.CylinderGeometry(0.8, 0.88, 0.15, 40), M.blue, 0, 0.165, 0);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const s = sph(0.1, M.pink, Math.cos(a) * 0.86, 0.17, Math.sin(a) * 0.86, 1, 1.3, 0.6);
    s.rotation.y = -a;
  }
  const petalRing = (n, r, y, tilt, sx, sy, sz, m, off = 0) => {
    for (let i = 0; i < n; i++) {
      const pv = new THREE.Group();
      pv.rotation.y = (i / n) * Math.PI * 2 + off;
      pv.position.y = y;
      const p = sph(1, m, r, 0, 0, sx, sy, sz);
      p.rotation.z = tilt;
      g.add(pv);
      pv.add(p);
    }
  };
  petalRing(12, 0.52, 0.27, 0.35, 0.36, 0.1, 0.22, M.pink);
  petalRing(9, 0.34, 0.38, 0.75, 0.3, 0.09, 0.2, M.pink, 0.3);
  sph(0.34, M.pink, 0, 0.36, 0, 1, 0.8, 1);

  // ===== Áo choàng =====
  const Y0 = 0.46;
  const prof = [[0.46, 0], [0.44, 0.08], [0.38, 0.4], [0.33, 0.8], [0.34, 1.0], [0.32, 1.15], [0.2, 1.22], [0.07, 1.26]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  add(new THREE.LatheGeometry(prof, 40), M.gold, 0, Y0, 0);
  const hem = add(new THREE.TorusGeometry(0.455, 0.02, 8, 48), M.goldDk, 0, Y0 + 0.03, 0);
  hem.rotation.x = Math.PI / 2;
  const sash = add(new THREE.TorusGeometry(0.335, 0.025, 8, 40), M.goldDk, 0, Y0 + 0.72, 0);
  sash.rotation.x = Math.PI / 2;
  // vạt áo chữ V (trắng)
  for (const s of [-1, 1]) {
    const v = add(new THREE.BoxGeometry(0.04, 0.55, 0.02), M.white, s * 0.07, Y0 + 0.95, 0.31);
    v.rotation.z = s * 0.25;
    v.rotation.x = -0.12;
  }
  // chữ Thọ (huy hiệu ngực)
  const emb = add(new THREE.TorusGeometry(0.075, 0.012, 8, 24), M.goldDk, 0, Y0 + 0.5, 0.335);
  emb.rotation.x = -0.05;
  // giày ngọc
  for (const s of [-1, 1]) sph(0.045, M.green, s * 0.2, Y0 + 0.04, 0.36);

  // ===== Cổ & đầu =====
  const HY = 2.0;
  add(new THREE.CylinderGeometry(0.07, 0.09, 0.14, 16), M.skin, 0, 1.76, 0);
  sph(1, M.skin, 0, HY, 0, 0.2, 0.25, 0.21);          // sọ
  sph(1, M.skin, 0, HY + 0.1, 0.01, 0.17, 0.2, 0.17); // trán dô đặc trưng
  for (const s of [-1, 1]) {
    sph(1, M.skin, s * 0.2, HY - 0.02, 0, 0.03, 0.06, 0.04);              // tai
    sph(1, M.pink, s * 0.1, HY - 0.07, 0.17, 0.05, 0.035, 0.03);          // má hồng
    const eye = add(new THREE.TorusGeometry(0.028, 0.005, 6, 14, Math.PI), M.dark, s * 0.075, HY, 0.2); // mắt cười ^
    eye.rotation.z = 0;
    const brow = sph(1, M.white, s * 0.08, HY + 0.062, 0.188, 0.045, 0.012, 0.02); // lông mày bạc
    brow.rotation.z = s * -0.25;
  }
  sph(0.035, M.skin, 0, HY - 0.05, 0.205);            // mũi
  const mouth = add(new THREE.TorusGeometry(0.045, 0.006, 6, 14, Math.PI), M.dark, 0, HY - 0.1, 0.188);
  mouth.rotation.z = Math.PI;                         // miệng cười ∪
  // ria + râu dài
  for (const s of [-1, 1]) {
    sph(1, M.white, s * 0.05, HY - 0.075, 0.19, 0.06, 0.022, 0.03);
    sph(1, M.white, s * 0.15, HY - 0.12, 0.1, 0.05, 0.1, 0.07);
  }
  const robeR = (y) => { const ly = y - Y0; for (let i = 0; i < prof.length - 1; i++) { const p = prof[i], q = prof[i + 1]; if (ly >= p.y && ly <= q.y) return p.x + (q.x - p.x) * (ly - p.y) / (q.y - p.y); } return 0.07; };
  sph(1, M.white, 0, 1.82, 0.12, 0.16, 0.09, 0.09);
  for (let i = 0; i < 14; i++) { // râu bám theo thân áo
    const t = i / 13, y = 1.8 - t * 0.78;
    sph(1, M.white, 0, y, Math.max(robeR(y), 0.1) + 0.015, 0.17 * Math.pow(1 - t, 0.7) + 0.025, 0.07, 0.04 + 0.03 * (1 - t));
  }

  // ===== Tay phải (-X): cầm đào =====
  const sleeve = (sx, rx, rz) => {
    const pv = new THREE.Group();
    pv.position.set(sx * 0.3, 1.6, 0.0);
    pv.rotation.set(rx, 0, rz);
    g.add(pv);
    add(new THREE.CylinderGeometry(0.1, 0.16, 0.56, 16), M.gold, 0, -0.28, 0, pv);
    add(new THREE.TorusGeometry(0.16, 0.02, 8, 20), M.white, 0, -0.56, 0, pv).rotation.x = Math.PI / 2;
  };
  sleeve(-1, -0.9, -0.1);
  sleeve(1, -0.5, 0.1);
  sph(0.055, M.skin, -0.31, 1.2, 0.5);                           // bàn tay phải (nằm dưới quả đào)
  sph(0.15, mat(0xff9d7d, { roughness: 0.4 }), -0.31, 1.38, 0.54);  // quả đào
  add(new THREE.ConeGeometry(0.04, 0.09, 12), mat(0xff9d7d), -0.31, 1.38, 0.69).rotation.x = Math.PI / 2; // chóp đào
  for (const s of [-1, 1]) {
    const lf = sph(1, M.green, -0.31 + s * 0.05, 1.53, 0.52, 0.07, 0.015, 0.035);
    lf.rotation.z = s * -0.5;
  }
  for (const x of [-0.37, -0.25]) sph(0.03, M.skin, x, 1.25, 0.62); // ngón tay ôm quả đào
  add(new THREE.CylinderGeometry(0.008, 0.008, 0.3, 6), M.gold, -0.38, 1.1, 0.52);        // dây tua
  add(new THREE.ConeGeometry(0.03, 0.14, 10), M.red, -0.38, 0.88, 0.52).rotation.x = Math.PI;

  // ===== Tay trái (+X): cầm gậy =====
  sph(0.065, M.skin, 0.38, 1.18, 0.26);                          // bàn tay trái
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.4, 0.45, 0.26),
    new THREE.Vector3(0.46, 0.9, 0.22),
    new THREE.Vector3(0.38, 1.4, 0.27),
    new THREE.Vector3(0.46, 1.85, 0.2),
    new THREE.Vector3(0.4, 2.25, 0.24),
    new THREE.Vector3(0.3, 2.42, 0.22),
  ]);
  add(new THREE.TubeGeometry(curve, 48, 0.032, 8, false), M.wood);
  sph(0.085, M.gold, 0.33, 2.3, 0.22, 1, 1.1, 1);               // hồ lô
  sph(0.06, M.gold, 0.26, 2.4, 0.22);
  sph(0.05, M.gold, 0.4, 2.2, 0.24);

  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.scale.setScalar(height / 2.45);
  return g;
}

export default createOngTho;

// Dùng: import { createOngTho } from './ongtho.js';
//   const tho = createOngTho({ height: 2.4 }); tho.position.set(x, 0, z); scene.add(tho);
