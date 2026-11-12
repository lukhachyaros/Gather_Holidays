import * as THREE from 'three';
import createOngPhuc from './ongPhuc.js';
import { buildOngLoc } from './ongLoc.js';
import createOngTho from './ongtho.js';

/* Điện thờ Phúc Lộc Thọ (Đền thờ Tam Đa) - model procedural, không cần file ngoài.
   Dùng:  import { createShrineModel } from './shrine.js';
          const shrine = createShrineModel({ scale: 0.35 });  scene.add(shrine);
   Đơn vị gốc ~ 1 = 1m. Mặt tiền hướng +Z. Gốc toạ độ ở giữa nền, y=0 là mặt đất. */

const srgb = (t) => { if ('SRGBColorSpace' in THREE) t.colorSpace = THREE.SRGBColorSpace; else t.encoding = THREE.sRGBEncoding; return t; };
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0, ...o });
const canvasTex = (w, h, draw, repeat) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return srgb(t);
};
const box = (parent, w, h, d, x, y, z, mat, ry = 0) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.rotation.y = ry; parent.add(m); return m;
};
const cyl = (parent, rt, rb, h, x, y, z, mat, seg = 16) => {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat); m.position.set(x, y, z); parent.add(m); return m;
};
const tube = (parent, pts, r, mat, seg) => {
  const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), seg || pts.length * 8, r, 8), mat); parent.add(m); return m;
};

class Helix extends THREE.Curve {
  constructor(r, h, turns) { super(); this.r = r; this.h = h; this.turns = turns; }
  getPoint(t, target = new THREE.Vector3()) {
    const a = t * this.turns * Math.PI * 2;
    return target.set(Math.cos(a) * this.r, t * this.h, Math.sin(a) * this.r);
  }
}

const tileTex = (base) => canvasTex(128, 128, (g, w, h) => {
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  for (let r = 0; r < 8; r++) {
    const y = r * 16, gr = g.createLinearGradient(0, y, 0, y + 16);
    gr.addColorStop(0, 'rgba(255,255,255,0.14)'); gr.addColorStop(0.65, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.5)');
    g.fillStyle = gr; g.fillRect(0, y, w, 16);
  }
  g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 2;
  for (let x = 0; x <= w; x += 16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
}, [1, 1]);

const plaqueTex = (text, w = 512, h = 192, fs = 120) => canvasTex(w, h, (g) => {
  g.fillStyle = '#d9a21b'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#6b1410'; g.fillRect(14, 14, w - 28, h - 28);
  g.strokeStyle = '#f3d27a'; g.lineWidth = 3; g.strokeRect(22, 22, w - 44, h - 44);
  g.fillStyle = '#f0c24a'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `bold ${fs}px "KaiTi","STKaiti","Noto Serif CJK SC","Noto Serif TC","SimSun",serif`;
  g.fillText(text, w / 2, h / 2 + 6);
});

const latticeTex = (rx, ry) => canvasTex(64, 64, (g, w, h) => {
  g.fillStyle = '#2a1610'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#8a5530'; g.lineWidth = 5; g.strokeRect(2, 2, w - 4, h - 4);
  g.lineWidth = 3; g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
}, [rx, ry]);

/* ---------- Mái hai đầu đao có đao cong ---------- */
function buildRoof(p, M) {
  const { W, D, R, H, U, orange } = p;
  const g = new THREE.Group();
  const hf = (x, z) => {
    const az = Math.abs(z) / D, sx = Math.max(Math.abs(x) - R, 0) / (W - R);
    const s = Math.min(1, Math.max(az, sx));
    return H * Math.pow(1 - s, 1.7) + U * Math.pow((Math.abs(x) / W) * az, 8);
  };
  const lin = (a, b, n) => Array.from({ length: n + 1 }, (_, i) => a + (b - a) * i / n);
  const xs = [...lin(-W, -R, 16), ...lin(-R, R, 4).slice(1), ...lin(R, W, 16).slice(1)];
  const zs = [...lin(-D, 0, 18), ...lin(0, D, 18).slice(1)];
  const cls = (x, z) => {
    const sz = Math.abs(z) / D, sx = Math.max(Math.abs(x) - R, 0) / (W - R);
    return sz >= sx ? (z > 0 ? 'front' : 'back') : (x > 0 ? 'right' : 'left');
  };
  const parts = {};
  ['front', 'back', 'left', 'right'].forEach((c) => { parts[c] = { p: [], u: [], i: [], m: new Map() }; });
  const lenZ = Math.hypot(D, H), lenX = Math.hypot(W - R, H);
  const vid = (c, i, j) => {
    const P = parts[c], k = i * 1000 + j;
    if (!P.m.has(k)) {
      const x = xs[i], z = zs[j];
      const sz = Math.abs(z) / D, sx = Math.max(Math.abs(x) - R, 0) / (W - R), s = Math.min(1, Math.max(sz, sx));
      P.p.push(x, hf(x, z), z);
      const fb = c === 'front' || c === 'back';
      P.u.push((fb ? x : z) / 2.2, s * (fb ? lenZ : lenX) / 2.4);
      P.m.set(k, P.p.length / 3 - 1);
    }
    return P.m.get(k);
  };
  for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < zs.length - 1; j++) {
    const c = cls((xs[i] + xs[i + 1]) / 2, (zs[j] + zs[j + 1]) / 2), P = parts[c];
    const a = vid(c, i, j), b = vid(c, i, j + 1), cc = vid(c, i + 1, j), d = vid(c, i + 1, j + 1);
    P.i.push(a, b, cc, b, d, cc);
  }
  const mO = std(0xffffff, { map: tileTex('#c4501f'), roughness: 0.7 });
  const mG = std(0xffffff, { map: tileTex('#5a5e63'), roughness: 0.75 });
  Object.keys(parts).forEach((c) => {
    const P = parts[c], geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(P.p, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(P.u, 2));
    geo.setIndex(P.i); geo.computeVertexNormals();
    g.add(new THREE.Mesh(geo, orange.includes(c) ? mO : mG));
  });
  // mặt dưới mái (ván lót)
  const up = [], ui = [];
  xs.forEach((x) => zs.forEach((z) => up.push(x, hf(x, z) - 0.2, z)));
  const nz = zs.length;
  for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < nz - 1; j++) {
    const a = i * nz + j, b = a + 1, c = a + nz, d = c + 1;
    ui.push(a, c, b, b, c, d);
  }
  const ug = new THREE.BufferGeometry();
  ug.setAttribute('position', new THREE.Float32BufferAttribute(up, 3)); ug.setIndex(ui); ug.computeVertexNormals();
  g.add(new THREE.Mesh(ug, M.woodD));
  // ván diềm bốn cạnh
  const edge = (pts) => tube(g, pts.map(([x, z]) => new THREE.Vector3(x, hf(x, z) - 0.09, z)), 0.14, M.wood, pts.length * 3);
  edge(xs.map((x) => [x, D])); edge(xs.map((x) => [x, -D]));
  edge(zs.map((z) => [W, z])); edge(zs.map((z) => [-W, z]));
  // nóc + bốn bờ dải có đầu đao cong
  box(g, 2 * R + 0.3, 0.26, 0.38, 0, H + 0.1, 0, mG);
  [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sx, sz]) => {
    const pts = [];
    for (let t = 0; t <= 1.0001; t += 0.1) { const x = sx * (R + t * (W - R)), z = sz * t * D; pts.push(new THREE.Vector3(x, hf(x, z) + 0.1, z)); }
    [[0.3, 0.3], [0.55, 0.7], [0.55, 1.1], [0.3, 1.25]].forEach(([d, dy]) => pts.push(new THREE.Vector3(sx * (W + d * 0.8), U + dy, sz * (D + d * 0.8))));
    tube(g, pts, 0.11, M.ornament, 90);
    const e = pts[pts.length - 1]; const s = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), M.gold); s.position.copy(e); g.add(s);
  });
  g.userData.hf = hf;
  return g;
}

function ridgeOrnaments(g, R, H, M, finial) {
  [-1, 1].forEach((s) => {
    const pts = [[R, H, 0], [R + 0.12, H + 0.45, 0], [R + 0.02, H + 0.9, 0], [R - 0.3, H + 1.0, 0], [R - 0.45, H + 0.8, 0]]
      .map(([x, y, z]) => new THREE.Vector3(s * x, y, z));
    tube(g, pts, 0.1, M.ornament, 30);
  });
  if (!finial) return;
  box(g, 0.5, 0.2, 0.5, 0, H + 0.32, 0, M.ornament);
  cyl(g, 0.12, 0.2, 0.25, 0, H + 0.55, 0, M.gold, 12);
  const gourd = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), M.gold); gourd.position.set(0, H + 0.85, 0); gourd.scale.y = 1.2; g.add(gourd);
  const top = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.4, 10), M.gold); top.position.set(0, H + 1.3, 0); g.add(top);
  [-1, 1].forEach((s) => {   // hai con rồng chầu hai bên
    const pts = []; for (let k = 0; k < 10; k++) pts.push(new THREE.Vector3(s * (0.75 + k * 0.22), H + 0.38 + 0.13 * Math.sin(k * 1.2) + 0.03 * k, 0));
    tube(g, pts, 0.075, M.ornament, 40);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), M.ornament); head.position.set(s * 0.62, H + 0.5, 0); head.scale.set(1.3, 1, 1); g.add(head);
    [-1, 1].forEach((h) => { const horn = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.25, 6), M.ornament); horn.position.set(s * 0.62, H + 0.68, h * 0.07); horn.rotation.z = -s * 0.5; g.add(horn); });
  });
}

/* ---------- Model chính ---------- */
export function createShrineModel(options = {}) {
  const root = new THREE.Group(); root.name = 'PhucLocThoShrine';
  const M = {
    stone: std(0xbdbab0, { roughness: 0.9 }), stoneD: std(0x9d9a90, { roughness: 0.95 }), stoneL: std(0xcfccc2),
    wood: std(0x6a2c1c), woodD: std(0x3a2016), wall: std(0x35201a),
    gold: std(0xd9a21b, { metalness: 0.6, roughness: 0.35 }), red: std(0xa3231a, { roughness: 0.7 }),
    drape: std(0xe0763f, { roughness: 0.9 }), ornament: std(0x8a9096),
    flame: new THREE.MeshStandardMaterial({ color: 0xffc060, emissive: 0xff8a1f, emissiveIntensity: 2 }),
  };
  const FY = 1.1; // cao độ nền

  /* nền đá 3 lớp */
  box(root, 14.8, 0.35, 11.6, 0, 0.175, 0, M.stoneD);
  box(root, 14.2, 0.62, 11.0, 0, 0.66, 0, M.stone);
  box(root, 14.6, 0.13, 11.4, 0, FY - 0.065, 0, M.stoneL);

  /* 3 thang đá phía trước + tay vịn dốc */
  const flights = [[0, 3.2], [-4.6, 2.6], [4.6, 2.6]];
  flights.forEach(([xc, w]) => {
    for (let i = 0; i < 4; i++) { const top = FY - 0.22 * (i + 1); box(root, w, top, 0.55, xc, top / 2, 5.7 + 0.275 + i * 0.55, M.stoneL); }
  });
  [-5.9, -3.3, -1.6, 1.6, 3.3, 5.9].forEach((x) => {
    const m = box(root, 0.3, 0.55, 2.67, x, 0.85, 6.675, M.stone); m.rotation.x = Math.atan(1.05 / 2.45);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), M.stoneL); cap.position.set(x, 1.45, 5.45); root.add(cap);
  });
  // phiến đá chạm rồng ở chân thang giữa
  box(root, 1.9, 0.06, 1.9, 0, 0.03, 8.8, M.stoneD); box(root, 1.5, 0.08, 1.5, 0, 0.04, 8.8, M.stoneL);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.05, 8, 28), M.stoneD); ring.rotation.x = Math.PI / 2; ring.position.set(0, 0.09, 8.8); root.add(ring);
  box(root, 0.5, 0.06, 0.5, 0, 0.09, 8.8, M.stoneD, Math.PI / 4);

  /* lan can quanh nền */
  const rail = (x1, z1, x2, z2) => {
    const dx = x2 - x1, dz = z2 - z1, L = Math.hypot(dx, dz), n = Math.max(1, Math.round(L / 0.9)), ry = Math.atan2(dx, dz);
    box(root, 0.2, 0.12, L, (x1 + x2) / 2, FY + 0.75, (z1 + z2) / 2, M.stoneL, ry);
    box(root, 0.12, 0.1, L, (x1 + x2) / 2, FY + 0.15, (z1 + z2) / 2, M.stone, ry);
    box(root, 0.08, 0.36, L, (x1 + x2) / 2, FY + 0.42, (z1 + z2) / 2, M.stone, ry);
    for (let i = 0; i <= n; i++) {
      const x = x1 + dx * i / n, z = z1 + dz * i / n;
      box(root, 0.2, 0.75, 0.2, x, FY + 0.375, z, M.stoneL);
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), M.stoneL); b.position.set(x, FY + 0.88, z); root.add(b);
    }
  };
  const RX = 7.05, RZ = 5.45;
  rail(-RX, -RZ, RX, -RZ); rail(-RX, -RZ, -RX, RZ); rail(RX, -RZ, RX, RZ);
  rail(-RX, RZ, -5.9, RZ); rail(-3.3, RZ, -1.6, RZ); rail(1.6, RZ, 3.3, RZ); rail(5.9, RZ, RX, RZ);

  /* cột + xà + diềm đỏ */
  const colXs = [-5.6, -3.9, -2.0, 2.0, 3.9, 5.6];
  const column = (x, z, gold) => {
    cyl(root, 0.36, 0.4, 0.3, x, FY + 0.15, z, M.stoneD);
    cyl(root, 0.24, 0.26, 3.15, x, FY + 0.3 + 1.575, z, M.wood);
    cyl(root, 0.3, 0.25, 0.2, x, 4.45, z, gold ? M.gold : M.woodD);
    if (gold) {
      const h = new THREE.Mesh(new THREE.TubeGeometry(new Helix(0.29, 2.9, 3.2), 140, 0.065, 8), M.gold);
      h.position.set(x, 1.5, z); root.add(h);
      const a = 3.2 * Math.PI * 2, hd = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), M.gold);
      hd.position.set(x + Math.cos(a) * 0.29, 4.4, z + Math.sin(a) * 0.29); hd.scale.set(1.3, 1, 1); root.add(hd);
    }
  };
  colXs.forEach((x) => { column(x, 3.2, true); column(x, -3.2, false); });
  [-5.6, 5.6].forEach((x) => column(x, 0, false));
  box(root, 12.4, 0.4, 0.35, 0, 4.55, 3.2, M.wood); box(root, 12.4, 0.4, 0.35, 0, 4.55, -3.2, M.wood);
  [-5.6, 5.6].forEach((x) => box(root, 0.35, 0.4, 6.8, x, 4.55, 0, M.wood));
  [[-5.6, -3.9], [-3.9, -2.0], [2.0, 3.9], [3.9, 5.6]].forEach(([a, b]) => {
    box(root, b - a - 0.5, 0.5, 0.08, (a + b) / 2, 4.1, 3.42, M.red);
    box(root, b - a - 0.5, 0.07, 0.1, (a + b) / 2, 3.82, 3.42, M.gold);
  });
  box(root, 3.5, 0.5, 0.12, 0, 4.1, 3.42, M.gold); box(root, 3.2, 0.3, 0.14, 0, 4.1, 3.42, M.red);
  [-5.25, -4.25, -3.55, -2.35, 2.35, 3.55, 4.25, 5.25].forEach((x) => {
    const d = cyl(root, 0.2, 0.1, 2.3, x, 2.9, 3.28, M.drape, 8); d.scale.z = 0.4;
  });

  /* tường sau + hai tường hông */
  box(root, 12.2, 3.45, 0.25, 0, 2.825, -3.35, M.wall);
  box(root, 0.2, 3.45, 3.35, -5.75, 2.825, -1.65, M.wall); box(root, 0.2, 3.45, 3.35, 5.75, 2.825, -1.65, M.wall);
  const painting = canvasTex(512, 256, (g, w, h) => {
    const s = g.createLinearGradient(0, 0, 0, h); s.addColorStop(0, '#cfd8d0'); s.addColorStop(1, '#e9e2cf'); g.fillStyle = s; g.fillRect(0, 0, w, h);
    [['rgba(80,100,90,.5)', 0], ['rgba(40,60,50,.7)', 50]].forEach(([c, o]) => {
      g.fillStyle = c; g.beginPath(); g.moveTo(0, h);
      [[60, 150], [130, 90], [210, 160], [300, 70], [390, 150], [460, 100], [512, 140]].forEach(([x, y]) => g.lineTo(x, y + o)); g.lineTo(w, h); g.fill();
    });
  });
  const pb = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 2.2), new THREE.MeshStandardMaterial({ map: painting, roughness: 0.9 }));
  pb.position.set(0, 2.9, -3.485); pb.rotation.y = Math.PI; root.add(pb);
  box(root, 4.9, 2.5, 0.06, 0, 2.9, -3.46, M.woodD);

  /* hậu cung: khung vàng + hoành phi 福祿壽 */
  box(root, 5.2, 3.2, 0.1, 0, 2.95, -3.17, M.gold);
  const bd = new THREE.Mesh(new THREE.PlaneGeometry(4.7, 2.7), new THREE.MeshStandardMaterial({ map: plaqueTex('福祿壽', 512, 300, 150), roughness: 0.6 }));
  bd.position.set(0, 2.95, -3.115); root.add(bd);
  const plant = canvasTex(128, 256, (g, w, h) => {
    g.fillStyle = '#d9a63a'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#5a3a1a'; g.fillRect(52, 170, 24, 12); g.fillRect(40, 182, 48, 60);
    [[64, 90, 44, '#6b7a2a'], [40, 120, 30, '#8a9a35'], [90, 125, 30, '#f0c24a'], [64, 60, 28, '#a8b040']].forEach(([x, y, r, c]) => { g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); });
  });
  [-3.7, 3.7].forEach((x) => {
    box(root, 1.2, 2.3, 0.08, x, 2.8, -3.16, M.gold);
    const pn = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 2.1), new THREE.MeshStandardMaterial({ map: plant, roughness: 0.8 })); pn.position.set(x, 2.8, -3.11); root.add(pn);
    box(root, 1.4, 0.9, 0.7, x * 1.15, FY + 0.45, -2.7, M.woodD);
  });

  /* bàn thờ: lư hương, đèn, mâm quả */
  const AY = FY + 0.95, AZ = -2.4;
  box(root, 3.0, 0.1, 1.0, 0, AY, AZ, M.wood); box(root, 3.0, 0.22, 0.08, 0, AY - 0.18, AZ + 0.5, M.gold);
  [[-1.4, -0.4], [1.4, -0.4], [-1.4, 0.4], [1.4, 0.4]].forEach(([x, z]) => box(root, 0.12, 0.9, 0.12, x, FY + 0.45, AZ + z, M.wood));
  cyl(root, 0.22, 0.16, 0.25, 0, AY + 0.17, AZ, M.gold, 14); cyl(root, 0.26, 0.26, 0.04, 0, AY + 0.31, AZ, M.gold, 14);
  [-1.25, 1.25].forEach((x) => {
    cyl(root, 0.09, 0.09, 0.5, x, AY + 0.3, AZ, M.red, 10);
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), M.flame); f.position.set(x, AY + 0.65, AZ); f.scale.y = 1.7; root.add(f);
  });
  [-0.6, 0.6].forEach((x, i) => {
    cyl(root, 0.28, 0.2, 0.08, x, AY + 0.09, AZ, M.gold, 14);
    [[0, 0], [0.12, 0.1], [-0.12, 0.08]].forEach(([dx, dz], k) => {
      const fr = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), std(i ? 0xe2a82a : 0xc23a24)); fr.position.set(x + dx, AY + 0.2 + (k ? 0 : 0.08), AZ + dz); root.add(fr);
    });
  });

  /* three star gods centered inside the expanded shrine */
  const statues = [
    [createOngPhuc({ height: 2.4, pedestal: true }), -2.6, 'statue-ong-phuc'],
    [buildOngLoc({ scale: 1 }), 0, 'statue-ong-loc'],
    [createOngTho({ height: 2.4 }), 2.6, 'statue-ong-tho'],
  ];
  statues.forEach(([statue, x, name]) => {
    statue.name = name;
    statue.position.set(x, FY, 0.15);
    root.add(statue);
  });
  const shrineLight = new THREE.PointLight(0xffd49a, 18, 30);
  shrineLight.position.set(0, 6, 0.5);
  root.add(shrineLight);

  /* tầng trên: tường chấm song + bảng hiệu */
  const UW = 8.8, UH = 2.3, UD = 5.0, UY = 5.0 + UH / 2;
  const mats = [std(0xffffff, { map: latticeTex(12, 6) }), std(0xffffff, { map: latticeTex(12, 6) }), M.woodD, M.woodD,
    std(0xffffff, { map: latticeTex(22, 6) }), M.wall];
  const uw = new THREE.Mesh(new THREE.BoxGeometry(UW, UH, UD), mats); uw.position.set(0, UY, 0); root.add(uw);
  [-4.3, -2.2, 2.2, 4.3].forEach((x) => cyl(root, 0.13, 0.13, UH, x, UY, UD / 2 + 0.08, M.wood, 10));
  box(root, 9.0, 0.16, 0.2, 0, UY + UH / 2 - 0.1, UD / 2 + 0.08, M.wood);
  box(root, 9.0, 0.16, 0.2, 0, UY - UH / 2 + 0.2, UD / 2 + 0.08, M.wood);
  const pl = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.0), new THREE.MeshStandardMaterial({ map: plaqueTex('福祿壽', 512, 192, 120), roughness: 0.6, metalness: 0.2 }));
  pl.position.set(0, UY + 0.1, UD / 2 + 0.2); root.add(pl);
  box(root, 2.8, 1.2, 0.12, 0, UY + 0.1, UD / 2 + 0.12, M.gold);

  /* hai tầng mái */
  const lower = buildRoof({ W: 7.6, D: 5.2, R: 2.0, H: 2.0, U: 0.7, orange: ['front', 'left', 'right'] }, M);
  lower.position.y = 4.95; root.add(lower); ridgeOrnaments(lower, 2.0, 2.0, M, false);
  const upper = buildRoof({ W: 5.8, D: 3.9, R: 2.5, H: 2.1, U: 0.6, orange: ['front'] }, M);
  upper.position.y = 7.35; root.add(upper); ridgeOrnaments(upper, 2.5, 2.1, M, true);

  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = false;
      o.receiveShadow = true;
    }
  });
  root.scale.setScalar(options.scale || 1);
  root.userData.replacementScale = 1.45;
  root.userData.size = { width: 15.2, depth: 22, height: 10.6 };
  return root;
}

export default createShrineModel;
