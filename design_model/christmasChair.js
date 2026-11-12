// Ghế bành Giáng Sinh (nhung đỏ, viền lông trắng, gối caro "Merry", chuông & nón thông) – procedural 3D.
// Drop-in thay buildSingleChair(): mặt ghế cao 0.44, quay mặt về -Z (Bắc), rộng ~1.0.
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

// Hộp bo tròn mềm (nệm nhung)
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

function tartanTexture() {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#b3121c'; x.fillRect(0, 0, 256, 256);
  const bands = (vertical) => {
    for (let i = 0; i < 4; i++) {
      const p = i * 64;
      x.fillStyle = 'rgba(24,100,52,0.85)';
      vertical ? x.fillRect(p + 12, 0, 22, 256) : x.fillRect(0, p + 12, 256, 22);
      x.fillStyle = 'rgba(10,28,18,0.7)';
      vertical ? x.fillRect(p + 36, 0, 6, 256) : x.fillRect(0, p + 36, 256, 6);
      x.fillStyle = 'rgba(245,220,120,0.9)';
      vertical ? x.fillRect(p + 4, 0, 2, 256) : x.fillRect(0, p + 4, 256, 2);
    }
  };
  bands(true); bands(false);
  x.fillStyle = '#1f6b3a';                                       // cây thông nhỏ
  x.beginPath(); x.moveTo(128, 56); x.lineTo(98, 112); x.lineTo(158, 112); x.fill();
  x.beginPath(); x.moveTo(128, 82); x.lineTo(92, 136); x.lineTo(164, 136); x.fill();
  x.fillStyle = '#e8b93c'; x.beginPath(); x.arc(128, 54, 5, 0, 7); x.fill();
  x.fillStyle = '#f3c84a'; x.font = 'italic bold 44px serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText('Merry', 128, 168);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildChristmasChair() {
  const outer = new THREE.Group();
  const g = new THREE.Group();
  g.rotation.y = Math.PI;                       // mặt ghế hướng -Z
  outer.add(g);
  const rand = rng(2512);
  const rr = (a, b) => a + (b - a) * rand();

  const velvet = new THREE.MeshStandardMaterial({ color: '#8d0f20', roughness: 0.95 });
  const velvetLight = new THREE.MeshStandardMaterial({ color: '#a3142a', roughness: 0.95 });
  const velvetDark = new THREE.MeshStandardMaterial({ color: '#5c0914', roughness: 0.95 });
  const wood = new THREE.MeshStandardMaterial({ color: '#4a2a1a', roughness: 0.45 });
  const brass = new THREE.MeshStandardMaterial({ color: '#d4a017', metalness: 0.75, roughness: 0.3 });
  const fur = new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 1 });
  const green = new THREE.MeshStandardMaterial({ color: '#1e6b3a', roughness: 0.8 });

  const put = (geo, mat, p, s = [1, 1, 1], r = [0, 0, 0], parent = g) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(...p); m.scale.set(...s); m.rotation.set(...r);
    m.castShadow = true; m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const SPH = new THREE.SphereGeometry(1, 14, 10);
  const CYL = new THREE.CylinderGeometry(1, 1, 1, 16);
  const CONE = new THREE.ConeGeometry(1, 1, 8);
  const BOX = new THREE.BoxGeometry(1, 1, 1);

  // ---------- Chân tiện + bánh xe đồng ----------
  const legGeo = new THREE.LatheGeometry([[0.022, 0], [0.03, 0.035], [0.04, 0.075], [0.03, 0.115], [0.042, 0.165]].map(([r, y]) => new THREE.Vector2(r, y)), 14);
  [-1, 1].forEach(s => {
    put(legGeo, wood, [s * 0.36, 0, 0.33]);
    put(SPH, brass, [s * 0.36, 0.022, 0.33], [0.026, 0.026, 0.026]);
    put(new THREE.TorusGeometry(0.022, 0.007, 6, 12), brass, [s * 0.36, 0.014, 0.33], [1, 1, 1], [0, Math.PI / 2, 0]);
    // chân sau xiên ra sau
    put(CYL, wood, [s * 0.34, 0.085, -0.37], [0.03, 0.18, 0.03], [-0.22, 0, 0]);
  });

  // ---------- Khung đế + nệm ngồi ----------
  put(rbox(0.88, 0.2, 0.84, 0.05), velvet, [0, 0.26, 0]);
  put(new THREE.BoxGeometry(0.885, 0.006, 0.845), velvetDark, [0, 0.215, 0]);                // đường may
  put(rbox(0.7, 0.11, 0.68, 0.05), velvetLight, [0, 0.385, 0.04]);                           // nệm
  put(new THREE.BoxGeometry(0.705, 0.005, 0.685), velvetDark, [0, 0.358, 0.04]);              // viền nệm

  // ---------- Tay vịn cuộn ----------
  [-1, 1].forEach(s => {
    const x = s * 0.405;
    put(rbox(0.14, 0.3, 0.8, 0.05), velvet, [x, 0.45, 0]);
    put(CYL, velvet, [x, 0.6, 0], [0.085, 0.8, 0.085], [Math.PI / 2, 0, 0]);                 // cuộn trên
    put(SPH, velvet, [x, 0.6, 0.4], [0.085, 0.085, 0.04]);                                    // mặt cuộn trước
    put(new THREE.TorusGeometry(0.05, 0.008, 6, 20), velvetDark, [x, 0.6, 0.44]);
    put(new THREE.TorusGeometry(0.025, 0.006, 6, 14), velvetDark, [x, 0.6, 0.442]);
    // họa tiết bông tuyết thêu vàng trên tay vịn
    const flake = new THREE.Group(); flake.position.set(x, 0.688, 0.02); g.add(flake);
    for (let k = 0; k < 3; k++) put(BOX, brass, [0, 0, 0], [0.1, 0.002, 0.008], [0, (k * Math.PI) / 3, 0], flake);
    [0, 1, 2, 3, 4, 5].forEach(k => put(SPH, brass, [Math.cos((k * Math.PI) / 3) * 0.05, 0, Math.sin((k * Math.PI) / 3) * 0.05], [0.007, 0.004, 0.007], [0, 0, 0], flake));
  });

  // ---------- Lưng cao bọc nhung, bấm nút ----------
  const back = put(rbox(0.9, 0.76, 0.17, 0.08), velvet, [0, 0.74, -0.32], [1, 1, 1], [-0.1, 0, 0]);
  const btnGeo = new THREE.SphereGeometry(0.016, 8, 6);
  const rows = [[0.58, [-0.26, -0.13, 0, 0.13, 0.26]], [0.69, [-0.195, -0.065, 0.065, 0.195]], [0.8, [-0.26, -0.13, 0, 0.13, 0.26]], [0.91, [-0.195, -0.065, 0.065, 0.195]]];
  rows.forEach(([y, xs]) => xs.forEach(x => {
    const z = -0.32 + 0.085 + 0.012 - (y - 0.74) * 0.1;
    put(btnGeo, velvetDark, [x, y, z]);
    // nếp lõm nhẹ quanh nút
    put(new THREE.TorusGeometry(0.026, 0.006, 6, 12), velvetLight, [x, y, z - 0.004], [1, 1, 0.5], [-0.1, 0, 0]);
  }));

  // ---------- Viền lông trắng trên đỉnh lưng ----------
  const furG = new THREE.Group(); furG.position.set(0, 1.115, -0.34); furG.rotation.x = -0.1; g.add(furG);
  put(CYL, fur, [0, 0, 0], [0.105, 0.86, 0.105], [0, 0, Math.PI / 2], furG);
  put(SPH, fur, [0.43, 0, 0], [0.105, 0.105, 0.105], [0, 0, 0], furG);
  put(SPH, fur, [-0.43, 0, 0], [0.105, 0.105, 0.105], [0, 0, 0], furG);
  const FUZZ = 260;
  const fuzz = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 7, 5), fur, FUZZ);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < FUZZ; i++) {
    const a = rand() * Math.PI * 2, x = rr(-0.45, 0.45), R = 0.105;
    dummy.position.set(x, Math.sin(a) * R * rr(0.9, 1.15), Math.cos(a) * R * rr(0.9, 1.15) * 1.1);
    dummy.scale.setScalar(rr(0.03, 0.06));
    dummy.updateMatrix(); fuzz.setMatrixAt(i, dummy.matrix);
  }
  fuzz.castShadow = true; furG.add(fuzz);

  // ---------- Gối caro "Merry" ----------
  const tex = tartanTexture();
  const side = new THREE.MeshStandardMaterial({ color: '#b3121c', roughness: 0.9 });
  const face = new THREE.MeshStandardMaterial({ color: tex ? '#ffffff' : '#b3121c', map: tex, roughness: 0.9 });
  const pillow = new THREE.Mesh(rbox(0.32, 0.3, 0.09, 0.05, 0.03), [side, side, side, side, face, face]);
  pillow.position.set(0, 0.6, -0.17); pillow.rotation.x = -0.42; pillow.castShadow = true; g.add(pillow);

  // ---------- Chuông vàng + nón thông + cành thông bên hông ----------
  [-1, 1].forEach(s => {
    const d = new THREE.Group(); d.position.set(s * 0.485, 0.54, 0.3); g.add(d);
    // cành thông
    for (let k = 0; k < 5; k++) put(CONE, green, [s * 0.01 * k, 0.03 + k * 0.004, -0.03 + k * 0.02], [0.012, 0.11, 0.012], [0.2 * (k - 2), 0, s * (0.8 + 0.2 * k)], d);
    [[0.04, 0.02], [-0.02, 0.05]].forEach(([x, z]) => put(SPH, new THREE.MeshStandardMaterial({ color: '#c1121f' }), [s * x, 0.045, z], [0.012, 0.012, 0.012], [0, 0, 0], d));
    // dây + 2 chuông
    [[0.0, 0.05, 0.036], [s * 0.04, 0.0, 0.03]].forEach(([x, z, r], i) => {
      const bell = new THREE.Group(); bell.position.set(x, -0.04 - i * 0.015, z); d.add(bell);
      put(new THREE.CylinderGeometry(0.003, 0.003, 0.05), brass, [0, 0.045, 0], [1, 1, 1], [0, 0, 0], bell);
      put(new THREE.SphereGeometry(1, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.72), brass, [0, 0, 0], [r * 0.9, r * 1.0, r * 0.9], [Math.PI, 0, 0], bell);
      put(SPH, wood, [0, -0.03, 0], [0.008, 0.008, 0.008], [0, 0, 0], bell);
    });
    // nón thông
    const cone = new THREE.Group(); cone.position.set(s * 0.02, -0.12, -0.01); d.add(cone);
    put(SPH, new THREE.MeshStandardMaterial({ color: '#6b4a2a', roughness: 0.8 }), [0, 0, 0], [0.026, 0.05, 0.026], [0, 0, 0], cone);
    for (let k = 0; k < 18; k++) {
      const a = (k / 18) * Math.PI * 2 * 2, yy = -0.04 + (k / 18) * 0.08;
      put(SPH, new THREE.MeshStandardMaterial({ color: '#8a6238', roughness: 0.7 }), [Math.cos(a) * 0.022, yy, Math.sin(a) * 0.022], [0.011, 0.008, 0.011], [0, 0, 0], cone);
    }
  });

  outer.userData.replacementScale = 1.2;
  return outer;
}

export { buildChristmasChair as buildSingleChair };
