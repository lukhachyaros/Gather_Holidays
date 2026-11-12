// Ghế đôi Giáng Sinh (nhung đỏ bấm nút, viền lông trắng, 2 gối caro "Merry", chăn len xanh, chuông & nón thông) – procedural 3D.
// Drop-in thay buildCoupleSofa(): rộng ~1.9, mặt ngồi cao ~0.48, quay mặt về -Z (Bắc).
import * as THREE from 'three';

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rbox(w, h, d, r = 0.04, b = 0.02) {
  const W = w - 2 * b, H = h - 2 * b, x = -W / 2, y = -H / 2, rr = Math.min(r, W / 2, H / 2);
  const s = new THREE.Shape();
  s.moveTo(x + rr, y); s.lineTo(x + W - rr, y); s.quadraticCurveTo(x + W, y, x + W, y + rr);
  s.lineTo(x + W, y + H - rr); s.quadraticCurveTo(x + W, y + H, x + W - rr, y + H);
  s.lineTo(x + rr, y + H); s.quadraticCurveTo(x, y + H, x, y + H - rr);
  s.lineTo(x, y + rr); s.quadraticCurveTo(x, y, x + rr, y);
  const g = new THREE.ExtrudeGeometry(s, { depth: d - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 3, curveSegments: 6 });
  g.translate(0, 0, -(d - 2 * b) / 2);
  return g;
}

function canvasTex(draw) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = c.height = 256;
  draw(c.getContext('2d'));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const tartan = () => canvasTex((x) => {
  x.fillStyle = '#b3121c'; x.fillRect(0, 0, 256, 256);
  for (const v of [true, false]) for (let i = 0; i < 4; i++) {
    const p = i * 64;
    x.fillStyle = 'rgba(24,100,52,0.85)'; v ? x.fillRect(p + 12, 0, 22, 256) : x.fillRect(0, p + 12, 256, 22);
    x.fillStyle = 'rgba(10,28,18,0.7)'; v ? x.fillRect(p + 36, 0, 6, 256) : x.fillRect(0, p + 36, 256, 6);
    x.fillStyle = 'rgba(245,220,120,0.9)'; v ? x.fillRect(p + 4, 0, 2, 256) : x.fillRect(0, p + 4, 256, 2);
  }
  x.fillStyle = '#1f6b3a';
  x.beginPath(); x.moveTo(128, 56); x.lineTo(98, 112); x.lineTo(158, 112); x.fill();
  x.beginPath(); x.moveTo(128, 82); x.lineTo(92, 136); x.lineTo(164, 136); x.fill();
  x.fillStyle = '#e8b93c'; x.beginPath(); x.arc(128, 54, 5, 0, 7); x.fill();
  x.fillStyle = '#f3c84a'; x.font = 'italic bold 44px serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText('Merry', 128, 168);
});
const throwTex = () => canvasTex((x) => {
  x.fillStyle = '#1d5a35'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++) {
    if ((i + j) % 2) continue;
    x.fillStyle = (i + j) % 4 ? '#c1121f' : '#f3efe0';
    x.beginPath(); x.arc(14 + i * 28, 14 + j * 28, 4, 0, 7); x.fill();
  }
  x.strokeStyle = 'rgba(245,220,120,0.8)'; x.lineWidth = 3; x.strokeRect(6, 6, 244, 244);
});

export function buildCoupleSofa() {
  const outer = new THREE.Group();
  const g = new THREE.Group();
  g.rotation.y = Math.PI;                       // mặt ghế hướng -Z
  outer.add(g);
  const rand = rng(2513);
  const rr = (a, b) => a + (b - a) * rand();

  const velvet = new THREE.MeshStandardMaterial({ color: '#8d0f20', roughness: 0.95 });
  const velvetLight = new THREE.MeshStandardMaterial({ color: '#a3142a', roughness: 0.95 });
  const velvetDark = new THREE.MeshStandardMaterial({ color: '#5c0914', roughness: 0.95 });
  const wood = new THREE.MeshStandardMaterial({ color: '#4a2a1a', roughness: 0.45 });
  const brass = new THREE.MeshStandardMaterial({ color: '#d4a017', metalness: 0.75, roughness: 0.3 });
  const gold = new THREE.MeshStandardMaterial({ color: '#e8c25a', metalness: 0.5, roughness: 0.35 });
  const fur = new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 1 });
  const green = new THREE.MeshStandardMaterial({ color: '#1e6b3a', roughness: 0.8 });

  const SPH = new THREE.SphereGeometry(1, 14, 10);
  const CYL = new THREE.CylinderGeometry(1, 1, 1, 16);
  const CONE = new THREE.ConeGeometry(1, 1, 8);
  const BOX = new THREE.BoxGeometry(1, 1, 1);
  const put = (geo, mat, p, s = [1, 1, 1], r = [0, 0, 0], parent = g) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(...p); m.scale.set(...s); m.rotation.set(...r);
    m.castShadow = true; m.receiveShadow = true;
    parent.add(m);
    return m;
  };

  const W = 1.7;               // rộng thân
  const AX = W / 2;            // vị trí tay vịn

  // ---------- Chân tiện (6 chân) ----------
  const legGeo = new THREE.LatheGeometry([[0.022, 0], [0.03, 0.035], [0.04, 0.075], [0.03, 0.115], [0.042, 0.165]].map(([r, y]) => new THREE.Vector2(r, y)), 14);
  [-1, 1].forEach(s => {
    put(legGeo, wood, [s * 0.77, 0, 0.33]);
    put(SPH, brass, [s * 0.77, 0.022, 0.33], [0.026, 0.026, 0.026]);
    put(new THREE.TorusGeometry(0.022, 0.007, 6, 12), brass, [s * 0.77, 0.014, 0.33], [1, 1, 1], [0, Math.PI / 2, 0]);
    put(legGeo, wood, [s * 0.25, 0, 0.35]);
    put(CYL, wood, [s * 0.75, 0.085, -0.37], [0.03, 0.18, 0.03], [-0.22, 0, 0]);
  });
  put(CYL, wood, [0, 0.085, -0.37], [0.03, 0.18, 0.03], [-0.22, 0, 0]);

  // ---------- Khung đế + 2 nệm ngồi ----------
  put(rbox(W, 0.2, 0.86, 0.05), velvet, [0, 0.26, 0]);
  put(new THREE.BoxGeometry(W + 0.005, 0.006, 0.865), velvetDark, [0, 0.215, 0]);
  [-1, 1].forEach(s => {
    put(rbox(0.74, 0.12, 0.7, 0.05), velvetLight, [s * 0.38, 0.42, 0.05]);
    put(new THREE.BoxGeometry(0.745, 0.005, 0.705), velvetDark, [s * 0.38, 0.385, 0.05]);
  });

  // ---------- Tay vịn cuộn ----------
  [-1, 1].forEach(s => {
    const x = s * (AX - 0.01);
    put(rbox(0.14, 0.32, 0.84, 0.05), velvet, [x, 0.46, 0]);
    put(CYL, velvet, [x, 0.62, 0], [0.085, 0.84, 0.085], [Math.PI / 2, 0, 0]);
    put(SPH, velvet, [x, 0.62, 0.42], [0.085, 0.085, 0.04]);
    put(new THREE.TorusGeometry(0.05, 0.008, 6, 20), velvetDark, [x, 0.62, 0.46]);
    put(new THREE.TorusGeometry(0.025, 0.006, 6, 14), velvetDark, [x, 0.62, 0.462]);
    // thêu bông tuyết + dây hoa văn vàng trên mặt ngoài tay vịn
    [[0.44, 0.14], [0.44, -0.16]].forEach(([y, z]) => {
      const f = new THREE.Group(); f.position.set(s * (AX + 0.067), y - 0.1, z); g.add(f);
      for (let k = 0; k < 3; k++) put(BOX, gold, [0, 0, 0], [0.002, 0.1, 0.008], [(k * Math.PI) / 3, 0, 0], f);
    });
    for (let k = -8; k <= 8; k++) put(SPH, gold, [s * (AX + 0.067), 0.27 + 0.025 * Math.sin(k * 0.8) * (1 - Math.abs(k) / 10), k * 0.035], [0.006, 0.006, 0.006]);
  });

  // ---------- Lưng cao bấm nút (2 hàng so le) ----------
  put(rbox(W + 0.02, 0.76, 0.17, 0.08), velvet, [0, 0.76, -0.33], [1, 1, 1], [-0.1, 0, 0]);
  const btnGeo = new THREE.SphereGeometry(0.016, 8, 6);
  const rowsY = [0.6, 0.71, 0.82, 0.93];
  rowsY.forEach((y, ri) => {
    const n = ri % 2 ? 11 : 12, off = ri % 2 ? 0.07 : 0;
    for (let i = 0; i < n; i++) {
      const x = -0.77 + i * (1.54 / (n - 1)) + 0 * off;
      const z = -0.33 + 0.085 + 0.012 - (y - 0.76) * 0.1;
      put(btnGeo, velvetDark, [x, y, z]);
      put(new THREE.TorusGeometry(0.026, 0.006, 6, 12), velvetLight, [x, y, z - 0.004], [1, 1, 0.5], [-0.1, 0, 0]);
    }
  });

  // ---------- Viền lông trắng ----------
  const furG = new THREE.Group(); furG.position.set(0, 1.135, -0.35); furG.rotation.x = -0.1; g.add(furG);
  put(CYL, fur, [0, 0, 0], [0.105, W + 0.1, 0.105], [0, 0, Math.PI / 2], furG);
  put(SPH, fur, [AX + 0.05, 0, 0], [0.105, 0.105, 0.105], [0, 0, 0], furG);
  put(SPH, fur, [-AX - 0.05, 0, 0], [0.105, 0.105, 0.105], [0, 0, 0], furG);
  const FUZZ = 480;
  const fuzz = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 7, 5), fur, FUZZ);
  const d = new THREE.Object3D();
  for (let i = 0; i < FUZZ; i++) {
    const a = rand() * Math.PI * 2, R = 0.105;
    d.position.set(rr(-AX - 0.05, AX + 0.05), Math.sin(a) * R * rr(0.9, 1.15), Math.cos(a) * R * rr(0.9, 1.15) * 1.1);
    d.scale.setScalar(rr(0.03, 0.06)); d.updateMatrix(); fuzz.setMatrixAt(i, d.matrix);
  }
  fuzz.castShadow = true; furG.add(fuzz);

  // ---------- 2 gối caro "Merry" ----------
  const tex = tartan();
  const side = new THREE.MeshStandardMaterial({ color: '#b3121c', roughness: 0.9 });
  const face = new THREE.MeshStandardMaterial({ color: tex ? '#ffffff' : '#b3121c', map: tex, roughness: 0.9 });
  [-1, 1].forEach(s => {
    const p = new THREE.Mesh(rbox(0.32, 0.3, 0.09, 0.05, 0.03), [side, side, side, side, face, face]);
    p.position.set(s * 0.5, 0.62, -0.2); p.rotation.set(-0.42, s * -0.08, 0); p.castShadow = true; g.add(p);
  });

  // ---------- Chăn len xanh vắt qua tay vịn phải ----------
  const tt = throwTex();
  const throwMat = new THREE.MeshStandardMaterial({ color: tt ? '#ffffff' : '#1d5a35', map: tt, roughness: 1 });
  const tr = (w, h, dd, p, r) => put(rbox(w, h, dd, 0.015, 0.008), throwMat, p, [1, 1, 1], r);
  tr(0.5, 0.03, 0.62, [0.5, 0.488, 0.12], [0, 0.12, -0.06]);          // nằm trên nệm
  tr(0.3, 0.03, 0.86, [0.66, 0.6, 0.06], [0, 0, 0.62]);                // dốc xuống từ tay vịn
  tr(0.22, 0.03, 0.8, [AX - 0.0, 0.73, 0.1], [0, 0, 0]);               // vắt trên tay vịn
  tr(0.03, 0.4, 0.46, [AX + 0.086, 0.55, 0.22], [0, 0, 0]);            // rủ mặt ngoài
  for (let k = 0; k < 7; k++) put(CYL, throwMat, [AX + 0.086, 0.34, 0.0 + k * 0.065], [0.01, 0.06, 0.01]);

  // ---------- Chuông + nón thông + cành thông ở hông ----------
  [-1, 1].forEach(s => {
    const dg = new THREE.Group(); dg.position.set(s * (AX + 0.075), 0.54, 0.36); g.add(dg);
    for (let k = 0; k < 5; k++) put(CONE, green, [s * 0.01 * k, 0.03 + k * 0.004, -0.03 + k * 0.02], [0.012, 0.11, 0.012], [0.2 * (k - 2), 0, s * (0.8 + 0.2 * k)], dg);
    [[0.04, 0.02], [-0.02, 0.05]].forEach(([x, z]) => put(SPH, new THREE.MeshStandardMaterial({ color: '#c1121f' }), [s * x, 0.045, z], [0.012, 0.012, 0.012], [0, 0, 0], dg));
    [[0.0, 0.05, 0.036], [s * 0.04, 0.0, 0.03]].forEach(([x, z, r], i) => {
      const bell = new THREE.Group(); bell.position.set(x, -0.04 - i * 0.015, z); dg.add(bell);
      put(new THREE.CylinderGeometry(0.003, 0.003, 0.05), brass, [0, 0.045, 0], [1, 1, 1], [0, 0, 0], bell);
      put(new THREE.SphereGeometry(1, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.72), brass, [0, 0, 0], [r * 0.9, r, r * 0.9], [Math.PI, 0, 0], bell);
      put(SPH, wood, [0, -0.03, 0], [0.008, 0.008, 0.008], [0, 0, 0], bell);
    });
    const cone = new THREE.Group(); cone.position.set(s * 0.02, -0.12, -0.01); dg.add(cone);
    put(SPH, new THREE.MeshStandardMaterial({ color: '#6b4a2a', roughness: 0.8 }), [0, 0, 0], [0.026, 0.05, 0.026], [0, 0, 0], cone);
    for (let k = 0; k < 18; k++) {
      const a = (k / 18) * Math.PI * 4, yy = -0.04 + (k / 18) * 0.08;
      put(SPH, new THREE.MeshStandardMaterial({ color: '#8a6238', roughness: 0.7 }), [Math.cos(a) * 0.022, yy, Math.sin(a) * 0.022], [0.011, 0.008, 0.011], [0, 0, 0], cone);
    }
  });

  outer.scale.y = 0.5;
  return outer;
}
