// Ghế đôi gỗ óc chó kiểu Á Đông (chân móng ngựa, nệm gấm đỏ họa tiết vàng, gối chữ 福) – procedural 3D.
// Drop-in thay buildCoupleSofa(): rộng ~1.8, mặt ngồi cao ~0.48, quay mặt về -Z (Bắc).
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

// Hộp bo tròn: nhóm vật liệu [0] = hai mặt lớn (±z), [1] = các cạnh
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

function canvasTex(draw, size = 256) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

const woodTex = (rand) => canvasTex((x, S) => {
  x.fillStyle = '#5b3b2a'; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 140; i++) {
    const py = rand() * S, l = 28 + rand() * 40;
    x.strokeStyle = `hsla(22, ${25 + rand() * 15}%, ${14 + rand() * 24}%, ${0.25 + rand() * 0.35})`;
    x.lineWidth = 0.6 + rand() * 2.2;
    x.beginPath(); x.moveTo(0, py);
    x.bezierCurveTo(S * 0.3, py + (rand() - 0.5) * l, S * 0.7, py + (rand() - 0.5) * l, S, py + (rand() - 0.5) * 10);
    x.stroke();
  }
});

const brocadeTex = () => canvasTex((x, S) => {
  x.fillStyle = '#9a1325'; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    const cx = 32 + i * 64 + (j % 2) * 32, cy = 32 + j * 64;
    x.strokeStyle = 'rgba(232,185,60,0.75)'; x.fillStyle = 'rgba(232,185,60,0.55)'; x.lineWidth = 2;
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      x.beginPath(); x.ellipse(cx + Math.cos(a) * 11, cy + Math.sin(a) * 11, 9, 5, a, 0, 7); x.fill();
    }
    x.beginPath(); x.arc(cx, cy, 6, 0, 7); x.stroke();
  }
});

const fuTex = () => canvasTex((x, S) => {
  x.fillStyle = '#a3142a'; x.fillRect(0, 0, S, S);
  x.strokeStyle = '#e8b93c'; x.lineWidth = 14; x.strokeRect(7, 7, S - 14, S - 14);
  x.lineWidth = 3; x.strokeRect(24, 24, S - 48, S - 48);
  x.fillStyle = '#d4a017'; x.beginPath(); x.arc(S / 2, S / 2, 78, 0, 7); x.fill();
  x.fillStyle = '#a3142a'; x.beginPath(); x.arc(S / 2, S / 2, 68, 0, 7); x.fill();
  x.fillStyle = '#f3c84a'; x.font = 'bold 96px serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText('福', S / 2, S / 2 + 6);
});

export function buildCoupleSofa() {
  const outer = new THREE.Group();
  const g = new THREE.Group();
  g.rotation.y = Math.PI;                       // mặt ghế hướng -Z
  outer.add(g);
  const rand = rng(88);
  const rr = (a, b) => a + (b - a) * rand();

  const wt = woodTex(rand);
  const wood = new THREE.MeshStandardMaterial({ color: wt ? '#ffffff' : '#5b3b2a', map: wt, roughness: 0.55, metalness: 0.03 });
  const woodDark = new THREE.MeshStandardMaterial({ color: '#4a2e20', roughness: 0.6 });
  const woodLight = new THREE.MeshStandardMaterial({ color: '#6d4731', roughness: 0.5 });
  const gold = new THREE.MeshStandardMaterial({ color: '#d4a017', metalness: 0.6, roughness: 0.4 });
  const BOX = new THREE.BoxGeometry(1, 1, 1);
  const SPH = new THREE.SphereGeometry(1, 8, 6);

  const put = (geo, mat, p, s = [1, 1, 1], r = [0, 0, 0], parent = g) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(...p); m.scale.set(...s); m.rotation.set(...r);
    m.castShadow = true; m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const box = (w, h, d, p, mat = wood, r) => put(BOX, mat, p, [w, h, d], r);

  // ---------- Chân móng ngựa (cong, đầu móng quặp vào trong) ----------
  const prof = new THREE.Shape();
  prof.moveTo(-0.05, 0.3); prof.lineTo(0.05, 0.3);
  prof.quadraticCurveTo(0.052, 0.18, 0.068, 0.1);
  prof.quadraticCurveTo(0.085, 0.05, 0.07, 0.015);
  prof.quadraticCurveTo(0.065, 0, 0.045, 0);
  prof.lineTo(-0.075, 0);
  prof.quadraticCurveTo(-0.115, 0.002, -0.115, 0.03);
  prof.quadraticCurveTo(-0.112, 0.06, -0.085, 0.075);
  prof.quadraticCurveTo(-0.045, 0.1, -0.04, 0.17);
  prof.lineTo(-0.05, 0.3);
  const legGeo = new THREE.ExtrudeGeometry(prof, { depth: 0.09, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2, curveSegments: 8 });
  legGeo.translate(0, 0, -0.045);
  [-1, 1].forEach(sx => [-1, 1].forEach(sz => {
    const leg = new THREE.Group(); leg.position.set(sx * 0.775, 0, sz * 0.36); g.add(leg);
    put(legGeo, wood, [0, 0, 0], [sx, 1, 1], [0, 0, 0], leg);                              // móng theo mặt trước
    put(legGeo, wood, [0, 0, 0], [1, 1, 1], [0, sz > 0 ? -Math.PI / 2 : Math.PI / 2, 0], leg); // móng theo mặt hông
  }));

  // ---------- Khung đế ----------
  box(1.66, 0.08, 0.76, [0, 0.34, 0], wood);                                  // dải yếm
  box(1.8, 0.045, 0.86, [0, 0.4025, 0], wood);                                // bản mặt đế
  box(1.82, 0.012, 0.88, [0, 0.43, 0], woodLight);                            // gờ phào
  box(1.7, 0.012, 0.8, [0, 0.376, 0], woodDark);                              // đường chỉ
  // hoa văn chạm nổi giữa dải yếm (trước + sau)
  const carve = new THREE.InstancedMesh(SPH, woodLight, 190);
  const d = new THREE.Object3D(); let ci = 0;
  const addCarve = (cx, z, sgn) => {
    box(0.34, 0.052, 0.014, [cx, 0.34, z + sgn * 0.007], woodDark);
    for (let i = 0; i < 46 && ci < 190; i++, ci++) {
      const t = (i / 45) * 2 - 1;
      d.position.set(cx + t * 0.15, 0.34 + 0.014 * Math.sin(t * 9) * (1 - Math.abs(t) * 0.4), z + sgn * 0.017);
      d.scale.set(rr(0.006, 0.011), rr(0.006, 0.011), 0.006); d.updateMatrix(); carve.setMatrixAt(ci, d.matrix);
    }
    for (let k = 0; k < 40 && ci < 190; k++, ci++) {
      d.position.set(cx + rr(-0.15, 0.15), 0.34 + rr(-0.02, 0.02), z + sgn * 0.017);
      d.scale.set(0.007, 0.007, 0.005); d.updateMatrix(); carve.setMatrixAt(ci, d.matrix);
    }
  };
  addCarve(0, 0.38, 1); addCarve(0, -0.38, -1);
  carve.count = ci; g.add(carve);

  // ---------- Tay vịn khối đặc có ô hộp chạm ----------
  [-1, 1].forEach(s => {
    const x = s * 0.85;
    box(0.1, 0.295, 0.84, [x, 0.5725, 0], wood);
    box(0.14, 0.03, 0.88, [x, 0.7375, 0], wood);                              // mặt tay vịn
    box(0.15, 0.012, 0.89, [x, 0.757, 0], woodLight);
    const ox = s * (0.9 + 0.006);
    put(BOX, woodDark, [ox, 0.5725, 0], [0.01, 0.21, 0.6]);                   // ô lõm
    box(0.014, 0.026, 0.66, [ox + s * 0.002, 0.5725 + 0.118, 0], woodLight);   // khung ô
    box(0.014, 0.026, 0.66, [ox + s * 0.002, 0.5725 - 0.118, 0], woodLight);
    box(0.014, 0.25, 0.026, [ox + s * 0.002, 0.5725, 0.316], woodLight);
    box(0.014, 0.25, 0.026, [ox + s * 0.002, 0.5725, -0.316], woodLight);
  });

  // ---------- Lưng ghế (hơi ngả ra sau) ----------
  const back = new THREE.Group(); back.position.set(0, 0.43, -0.4); back.rotation.x = -0.07; g.add(back);
  const by = (y) => y - 0.43;
  [-1, 1].forEach(s => put(BOX, wood, [s * 0.815, by(0.79), 0], [0.1, 0.72, 0.06], [0, 0, 0], back)); // cột đứng
  put(BOX, wood, [0, by(1.1), 0], [1.72, 0.12, 0.07], [0, 0, 0], back);                              // thanh ngang trên
  put(BOX, woodLight, [0, by(1.165), 0], [1.74, 0.012, 0.08], [0, 0, 0], back);
  put(BOX, wood, [0, by(0.51), 0], [1.64, 0.1, 0.06], [0, 0, 0], back);                              // thanh ngang dưới
  put(BOX, woodLight, [0, by(0.8), -0.004], [1.56, 0.47, 0.03], [0, 0, 0], back);                    // tấm lưng
  put(BOX, woodDark, [0, by(0.8), 0.014], [1.5, 0.43, 0.012], [0, 0, 0], back);
  put(BOX, woodDark, [0, by(0.8), -0.022], [1.5, 0.43, 0.012], [0, 0, 0], back);
  // hoa văn chữ hồi (fret) trên thanh ngang trên – trước & sau
  const FR = 72;
  const fret = new THREE.InstancedMesh(BOX, woodDark, FR * 3);
  let fi = 0;
  for (const zf of [0.039, -0.039]) for (let i = 0; i < FR / 2; i++) {
    const x = -0.82 + i * (1.64 / (FR / 2 - 1)), up = i % 4 < 2;
    d.position.set(x, by(1.1) + (up ? 0.026 : -0.026), zf); d.scale.set(0.03, 0.014, 0.01); d.updateMatrix(); fret.setMatrixAt(fi++, d.matrix);
    d.position.set(x, by(1.1), zf); d.scale.set(0.012, 0.06, 0.01); d.updateMatrix(); fret.setMatrixAt(fi++, d.matrix);
  }
  fret.count = fi; back.add(fret);
  // ---------- Nệm gấm đỏ ----------
  const bt = brocadeTex();
  const brocade = new THREE.MeshStandardMaterial({ color: bt ? '#ffffff' : '#9a1325', map: bt, roughness: 0.7 });
  const piping = new THREE.MeshStandardMaterial({ color: '#7a0f1d', roughness: 0.8 });
  [-1, 1].forEach(s => {
    const c = new THREE.Mesh(rbox(0.8, 0.74, 0.065, 0.05, 0.022), [brocade, piping]);
    c.rotation.x = -Math.PI / 2; c.position.set(s * 0.4, 0.4575, 0.0); c.castShadow = c.receiveShadow = true; g.add(c);
  });

  // ---------- Hai gối 福 ----------
  const ft = fuTex();
  const fuFace = new THREE.MeshStandardMaterial({ color: ft ? '#ffffff' : '#a3142a', map: ft, roughness: 0.75 });
  const fuSide = new THREE.MeshStandardMaterial({ color: '#c8921a', roughness: 0.6 });
  [-1, 1].forEach(s => {
    const p = new THREE.Mesh(rbox(0.34, 0.34, 0.09, 0.05, 0.03), [fuFace, fuSide]);
    p.position.set(s * 0.52, 0.66, -0.25); p.rotation.set(-0.3, s * -0.1, s * 0.04); p.castShadow = true; g.add(p);
  });

  outer.scale.y = 0.5;
  return outer;
}
