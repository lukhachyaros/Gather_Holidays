// js/ongPhuc.js — Ông Phúc (Phúc Thần) procedural model, three.js r170 (ES module)
// Dùng: import { createOngPhuc } from './ongPhuc.js'; scene.add(createOngPhuc({ height: 2.2, pedestal: true }));
// Hướng mặt: +Z. Gốc (0,0,0) nằm ở đáy bệ sen.
import * as THREE from 'three';

const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0, ...o });

export function createOngPhuc(opts = {}) {
  const { height = 2.2, pedestal = true, castShadow = true } = opts;
  const root = new THREE.Group();
  root.name = 'OngPhuc';
  const g = new THREE.Group(); // build in units where total height ≈ 2.2
  root.add(g);

  // ---------- materials ----------
  const robe = M(0x8fa6b8), robeDark = M(0x6d869b), gold = M(0xd9a93a, { metalness: 0.55, roughness: 0.35 });
  const skin = M(0xf0a89d, { roughness: 0.75 }), black = M(0x141414, { roughness: 0.9 });
  const pink = M(0xd98b96), teal = M(0x7fc3b6), base = M(0x6d8aa3), green = M(0x35a56a, { roughness: 0.25 });
  const red = M(0xb3262a), fanY = M(0xf2c230), fanB = M(0x7ea0c6), cheek = M(0xe3706f);
  const robeSide = M(0x8fa6b8, { side: THREE.DoubleSide });

  const add = (parent, geo, mat, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = castShadow; m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const limb = (a, b, r0, r1, mat) => {
    const d = new THREE.Vector3().subVectors(b, a), len = d.length();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, len, 14), mat);
    m.position.copy(a).addScaledVector(d, 0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    m.castShadow = castShadow;
    return m;
  };

  // ---------- lotus pedestal ----------
  const BASE_Y = pedestal ? 0.5 : 0;
  if (pedestal) {
    const ped = new THREE.Group(); g.add(ped);
    add(ped, new THREE.CylinderGeometry(0.62, 0.64, 0.1, 48), base, 0, 0.05, 0);
    add(ped, new THREE.CylinderGeometry(0.52, 0.56, 0.12, 48), teal, 0, 0.16, 0);
    for (let i = 0; i < 20; i++) { // scalloped pink ornaments
      const a = (i / 20) * Math.PI * 2;
      const s = add(ped, new THREE.SphereGeometry(1, 12, 8), pink, Math.sin(a) * 0.54, 0.16, Math.cos(a) * 0.54);
      s.scale.set(0.07, 0.05, 0.035); s.rotation.y = a;
    }
    const ring = (n, R, y, tilt, w, l, t, mat, off = 0) => {
      for (let i = 0; i < n; i++) {
        const piv = new THREE.Group();
        piv.rotation.y = (i / n) * Math.PI * 2 + off; piv.position.y = y;
        const lean = new THREE.Group(); lean.position.z = R; lean.rotation.x = tilt;
        piv.add(lean);
        const p = add(lean, new THREE.SphereGeometry(1, 20, 14), mat, 0, l, 0);
        p.scale.set(w, l, t);
        ped.add(piv);
      }
    };
    ring(14, 0.44, 0.22, 1.1, 0.13, 0.17, 0.04, pink);
    ring(10, 0.36, 0.28, 0.62, 0.17, 0.26, 0.05, pink, 0.15);
    ring(8, 0.24, 0.36, 0.28, 0.14, 0.22, 0.045, M(0xe3a0a8), 0.3);
    add(ped, new THREE.CylinderGeometry(0.3, 0.32, 0.05, 32), M(0x4f9a5a), 0, 0.47, 0);
    // chữ 福 trên bệ
    if (typeof document !== 'undefined') {
      const c = document.createElement('canvas'); c.width = 256; c.height = 128;
      const x = c.getContext('2d'); x.fillStyle = 'rgba(0,0,0,0)'; x.clearRect(0, 0, 256, 128);
      x.fillStyle = '#e0b040'; x.font = 'bold 96px serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText('福', 128, 68);
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
      const plate = add(ped, new THREE.PlaneGeometry(0.2, 0.1), new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.4 }), 0, 0.05, 0.645);
      plate.castShadow = false;
    }
  }

  // ---------- robe ----------
  const prof = [[0.4, 0.0], [0.38, 0.12], [0.3, 0.5], [0.26, 0.8], [0.27, 1.1], [0.25, 1.28], [0.15, 1.34], [0.06, 1.37], [0.0, 1.38]];
  const rY = (y) => { // robe radius at absolute y
    const t = y - BASE_Y;
    for (let i = 0; i < prof.length - 1; i++) {
      const [r0, y0] = prof[i], [r1, y1] = prof[i + 1];
      if (t >= y0 && t <= y1) return r0 + ((r1 - r0) * (t - y0)) / (y1 - y0);
    }
    return 0.05;
  };
  const SX = 1.08, SZ = 0.72;
  const bg = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y + BASE_Y)), 56);
  {
    const p = bg.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const w = Math.max(0, 1 - (y - BASE_Y) / 1.0), th = Math.atan2(x, z), b = (1 - Math.cos(th)) / 2;
      const k = 1 + w * b * (0.05 * Math.sin(8 * th) + 0.025);
      p.setXYZ(i, x * k, y, z * k);
    }
    bg.computeVertexNormals();
  }
  const body = new THREE.Mesh(bg, robeSide);
  body.scale.set(SX, 1, SZ); body.castShadow = castShadow; g.add(body);
  // viền gấu áo
  const hem = [[0.405, 0.0], [0.405, 0.07], [0.39, 0.075], [0.385, 0.0]];
  const hemM = new THREE.Mesh(new THREE.LatheGeometry(hem.map(([r, y]) => new THREE.Vector2(r + 0.005, y + BASE_Y)), 40), gold);
  hemM.scale.set(SX, 1, SZ); g.add(hemM);

  // dải vàng bám theo mặt áo
  const strip = (xFn, w, y0, y1, mat, off = 0.012, n = 14) => {
    const pos = [], idx = [];
    for (let j = 0; j <= n; j++) {
      const y = y0 + ((y1 - y0) * j) / n, xc = xFn(y), r = rY(y);
      for (const s of [-1, 1]) {
        const x = xc + s * w / 2, z = SZ * Math.sqrt(Math.max(r * r - (x / SX) ** 2, 0)) + (typeof off === 'function' ? off(y) : off);
        pos.push(x, y, z);
      }
      if (j < n) { const k = j * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: mat.color, metalness: mat.metalness, roughness: mat.roughness, side: THREE.DoubleSide }));
    g.add(m); return m;
  };
  const fl = (y) => 0.075 * Math.pow(Math.max(0, (1.3 - y) / 0.8), 1.4); // độ loe của tà áo
  strip(() => 0, 0.2, BASE_Y + 0.08, 1.36, M(0x7f98ab), (y) => 0.008 + fl(y), 18);          // tà áo trước
  strip(() => 0, 0.2, BASE_Y + 0.08, BASE_Y + 0.14, gold, (y) => 0.016 + fl(y), 2);          // viền gấu tà
  for (const s of [-1, 1]) {
    strip((y) => s * (0.05 + ((y - 1.38) / 0.47) * 0.07), 0.05, 1.38, 1.84, gold, 0.014);   // cổ áo chữ V
    strip(() => s * 0.1, 0.05, BASE_Y + 0.08, 1.36, gold, (y) => 0.014 + fl(y), 18);          // viền vàng mép tà
    strip(() => s * 0.1, 0.012, BASE_Y + 0.08, 1.36, M(0x9c7420, { metalness: 0.5 }), (y) => 0.02 + fl(y), 18);
  }
  // đai lưng
  const belt = add(g, new THREE.TorusGeometry(rY(1.38) + 0.005, 0.03, 10, 40), robeDark, 0, 1.38, 0);
  belt.rotation.x = Math.PI / 2; belt.scale.set(SX, SZ, 1);
  // giày vàng + ngọc xanh
  for (const s of [-1, 1]) {
    const sh = add(g, new THREE.SphereGeometry(1, 14, 10), gold, s * 0.17, BASE_Y + 0.03, 0.36); sh.scale.set(0.07, 0.045, 0.1);
    add(g, new THREE.SphereGeometry(0.022, 10, 8), green, s * 0.17, BASE_Y + 0.07, 0.38);
  }
  // tua đỏ treo đai
  for (const x of [-0.16, -0.11]) {
    const z = SZ * Math.sqrt(Math.max(rY(1.3) ** 2 - (x / SX) ** 2, 0)) + 0.03;
    g.add(limb(new THREE.Vector3(x, 1.36, z), new THREE.Vector3(x, 1.02, z + 0.01), 0.008, 0.008, red));
    add(g, new THREE.SphereGeometry(0.02, 10, 8), gold, x, 1.02, z + 0.01);
    add(g, new THREE.ConeGeometry(0.026, 0.2, 12), red, x, 0.9, z + 0.01).rotation.x = Math.PI;
  }

  // ---------- đầu ----------
  const head = new THREE.Group(); head.position.set(0, 1.97, 0); g.add(head);
  add(g, new THREE.CylinderGeometry(0.055, 0.065, 0.1, 14), skin, 0, 1.82, 0);
  add(head, new THREE.SphereGeometry(0.11, 28, 20), skin).scale.set(1, 1.08, 0.95);
  for (const s of [-1, 1]) {
    add(head, new THREE.SphereGeometry(0.03, 10, 8), skin, s * 0.108, 0, 0).scale.set(0.5, 1, 0.8);
    add(head, new THREE.SphereGeometry(0.022, 10, 8), cheek, s * 0.06, -0.03, 0.082).scale.set(1.2, 0.8, 0.5);
    const eye = add(head, new THREE.TorusGeometry(0.018, 0.0055, 6, 14, Math.PI), black, s * 0.04, 0.02, 0.097); // mắt cười
    const brow = add(head, new THREE.CapsuleGeometry(0.004, 0.032, 4, 6), black, s * 0.043, 0.055, 0.094);
    brow.rotation.z = Math.PI / 2 + s * 0.18;
    // tóc mai
    g.add(limb(new THREE.Vector3(s * 0.108, 1.99, 0.01), new THREE.Vector3(s * 0.1, 1.74, 0.13), 0.013, 0.01, black));
  }
  add(head, new THREE.SphereGeometry(0.014, 10, 8), M(0xe08f88), 0, -0.012, 0.106);
  const mouth = add(head, new THREE.TorusGeometry(0.028, 0.006, 6, 14, Math.PI), M(0xc0302f), 0, -0.035, 0.099);
  mouth.rotation.z = Math.PI;
  for (const s of [-1, 1]) {
    const mu = add(head, new THREE.SphereGeometry(1, 10, 8), black, s * 0.035, -0.022, 0.104);
    mu.scale.set(0.05, 0.014, 0.02); mu.rotation.z = -s * 0.3;
  }
  // râu dài
  const bs = new THREE.Shape();
  bs.moveTo(-0.085, 0);
  bs.bezierCurveTo(-0.1, -0.15, -0.07, -0.3, 0, -0.42);
  bs.bezierCurveTo(0.07, -0.3, 0.1, -0.15, 0.085, 0);
  bs.bezierCurveTo(0.04, 0.03, -0.04, 0.03, -0.085, 0);
  const beard = new THREE.Mesh(new THREE.ExtrudeGeometry(bs, { depth: 0.04, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 2 }), black);
  beard.position.set(0, 1.88, 0.085); beard.rotation.x = -0.5; beard.castShadow = castShadow; g.add(beard);

  // mũ
  const hat = new THREE.Group(); hat.position.set(0, 2.0, 0); g.add(hat);
  add(hat, new THREE.CylinderGeometry(0.118, 0.125, 0.1, 28), robe, 0, 0.1, 0);
  add(hat, new THREE.SphereGeometry(0.118, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), robe, 0, 0.15, 0).scale.set(1, 0.55, 1);
  add(hat, new THREE.TorusGeometry(0.123, 0.009, 8, 32), gold, 0, 0.055, 0).rotation.x = Math.PI / 2;
  add(hat, new THREE.TorusGeometry(0.119, 0.006, 8, 32), gold, 0, 0.15, 0).rotation.x = Math.PI / 2;
  add(hat, new THREE.BoxGeometry(0.08, 0.035, 0.012), gold, 0, 0.1, 0.12);
  add(hat, new THREE.SphereGeometry(0.02, 12, 8), green, 0, 0.1, 0.128).scale.set(1, 0.8, 0.5);
  for (const s of [-1, 1]) {
    const w = add(hat, new THREE.BoxGeometry(0.05, 0.016, 0.01), gold, s * 0.055, 0.135, 0.118);
    w.rotation.z = s * 0.4;
  }

  // ---------- tay áo ----------
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const tube = (pts, rFn, mat, cuff = true) => {
    const curve = new THREE.CatmullRomCurve3(pts), seg = 20, rad = 18;
    const fr = curve.computeFrenetFrames(seg, false), pos = [], idx = [];
    for (let i = 0; i <= seg; i++) {
      const p = curve.getPointAt(i / seg), N = fr.normals[i], B = fr.binormals[i], r = rFn(i / seg);
      for (let j = 0; j <= rad; j++) {
        const a = (j / rad) * Math.PI * 2, c = Math.cos(a) * r, s = Math.sin(a) * r;
        pos.push(p.x + N.x * c + B.x * s, p.y + N.y * c + B.y * s, p.z + N.z * c + B.z * s);
      }
    }
    for (let i = 0; i < seg; i++) for (let j = 0; j < rad; j++) { const a = i * (rad + 1) + j, b = a + rad + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat); m.castShadow = castShadow; g.add(m);
    if (cuff) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(rFn(1), 0.011, 8, 28), gold);
      ring.position.copy(curve.getPointAt(1));
      ring.quaternion.setFromUnitVectors(V(0, 0, 1), curve.getTangentAt(1));
      g.add(ring);
    }
  };
  for (const s of [-1, 1]) add(g, new THREE.SphereGeometry(0.095, 16, 12), robe, s * 0.24, 1.73, 0);
  // tay phải nhân vật (−x): gập lên cầm quạt
  tube([V(-0.24, 1.74, 0), V(-0.31, 1.55, 0.03), V(-0.33, 1.38, 0.09), V(-0.27, 1.36, 0.18), V(-0.21, 1.38, 0.22)], (t) => 0.07 + 0.05 * t, robeSide);
  const hR = V(-0.16, 1.38, 0.29);
  g.add(limb(V(-0.21, 1.38, 0.22), hR, 0.04, 0.036, skin));
  add(g, new THREE.SphereGeometry(0.048, 14, 10), skin, hR.x, hR.y, hR.z);
  // tay trái nhân vật (+x): cầm nguyên bảo
  tube([V(0.24, 1.74, 0), V(0.31, 1.55, 0.03), V(0.33, 1.4, 0.08), V(0.3, 1.3, 0.16), V(0.23, 1.29, 0.21)], (t) => 0.07 + 0.05 * t, robeSide);
  const hL = V(0.17, 1.29, 0.3);
  g.add(limb(V(0.23, 1.29, 0.21), hL, 0.04, 0.036, skin));
  add(g, new THREE.SphereGeometry(0.048, 14, 10), skin, hL.x, hL.y, hL.z);
  add(g, new THREE.SphereGeometry(1, 14, 10), gold, hL.x, hL.y + 0.04, hL.z + 0.03).scale.set(0.045, 0.022, 0.03);
  add(g, new THREE.SphereGeometry(0.02, 10, 8), gold, hL.x, hL.y + 0.06, hL.z + 0.03);

  // ---------- quạt như ý ----------
  const fan = new THREE.Group();
  fan.position.set(-0.4, 1.2, 0.29); fan.rotation.z = -0.907; g.add(fan);
  fan.add(limb(new THREE.Vector3(0, -0.02, 0), new THREE.Vector3(0, 0.52, 0), 0.013, 0.013, gold));
  add(fan, new THREE.SphereGeometry(0.024, 10, 8), gold, 0, -0.02, 0);
  const fs = new THREE.Shape();
  fs.moveTo(0, 0);
  fs.bezierCurveTo(0.04, 0.05, 0.15, 0.1, 0.14, 0.22);
  fs.bezierCurveTo(0.13, 0.36, 0.05, 0.42, 0, 0.4);
  fs.bezierCurveTo(-0.05, 0.42, -0.13, 0.36, -0.14, 0.22);
  fs.bezierCurveTo(-0.15, 0.1, -0.04, 0.05, 0, 0);
  const fanG = new THREE.Group(); fanG.position.y = 0.5; fan.add(fanG);
  const bord = add(fanG, new THREE.ExtrudeGeometry(fs, { depth: 0.014, bevelEnabled: false }), gold, 0, -0.022, -0.004);
  bord.scale.set(1.12, 1.1, 1);
  add(fanG, new THREE.ExtrudeGeometry(fs, { depth: 0.014, bevelEnabled: false }), fanY, 0, 0, 0.004);
  add(fanG, new THREE.CircleGeometry(0.07, 28), fanB, 0, 0.14, 0.021);
  for (const [dx, dy, r] of [[-0.02, 0.13, 0.03], [0.025, 0.16, 0.025], [0, 0.11, 0.035]]) {
    const t = add(fanG, new THREE.TorusGeometry(r, 0.004, 6, 20, Math.PI * 1.4), M(0xdbe8f5), dx, dy, 0.023);
    t.rotation.z = dx * 20;
  }
  for (const [dx, dy] of [[-0.06, 0.3], [0.06, 0.3], [0, 0.34]]) // hoa văn mây vàng đậm
    add(fanG, new THREE.CircleGeometry(0.018, 12), M(0xd69a1e), dx, dy, 0.02);
  add(fanG, new THREE.SphereGeometry(0.032, 12, 10), red, 0, 0.44, 0.01);
  add(fanG, new THREE.CylinderGeometry(0.02, 0.026, 0.025, 12), gold, 0, 0.405, 0.01);

  // ---------- hoàn thiện ----------
  const sc = height / 2.2;
  g.scale.setScalar(sc);
  root.userData = { name: 'Ông Phúc', height };
  return root;
}

export default createOngPhuc;
