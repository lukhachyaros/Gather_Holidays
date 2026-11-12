// Ghế Xương Halloween (chi tiết cao, xương màu ngà cũ) – bộ xương ngồi làm ghế.
// Xương đùi/chày/mác có khớp gối + bánh chè, bàn chân đủ xương cổ chân/bàn chân/đốt ngón + vuốt, cột sống 17 đốt (có gai, mấu ngang, đĩa đệm),
// 10 cặp xương sườn + sụn sườn + xương ức, xương đòn, xương bả vai, xương chậu, cánh tay/cẳng tay (trụ + quay) làm tay vịn, bàn tay đủ xương đốt ngón,
// sọ chi tiết (gờ mày, hốc mắt, gò má, xương hàm, 20 răng), nệm rách có nút bấm, mạng nhện nhiều lớp + nhện 8 chân.
// Tất cả hình học được gộp theo vật liệu (≈10 mesh) nên nhẹ. Drop-in thay buildSingleChair(): mặt ghế cao 0.44, quay mặt về -Z.
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
  const g = new THREE.ExtrudeGeometry(s, { depth: d - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 4, curveSegments: 8 });
  g.translate(0, 0, -(d - 2 * b) / 2);
  return g;
}

function boneTexture(rand) {
  if (typeof document === 'undefined') return null;
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d');
  x.fillStyle = '#d3c59b'; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 900; i++) {                                   // lốm đốm xỉn màu
    x.fillStyle = `rgba(${110 + rand() * 40},${85 + rand() * 30},${50 + rand() * 25},${0.03 + rand() * 0.06})`;
    x.beginPath(); x.arc(rand() * S, rand() * S, 1 + rand() * 6, 0, 7); x.fill();
  }
  for (let i = 0; i < 14; i++) {                                    // vệt ố nâu
    const g = x.createRadialGradient(rand() * S, rand() * S, 2, rand() * S, rand() * S, 40);
    g.addColorStop(0, 'rgba(120,90,45,0.14)'); g.addColorStop(1, 'rgba(110,80,40,0)');
    x.fillStyle = g; x.fillRect(0, 0, S, S);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// ---- bộ gộp hình học theo vật liệu ----
class Merge {
  constructor() { this.m = {}; this.st = [new THREE.Matrix4()]; this.nm = new THREE.Matrix3(); this.v = new THREE.Vector3(); }
  push(M) { this.st.push(this.st[this.st.length - 1].clone().multiply(M)); }
  pop() { this.st.pop(); }
  add(key, geo, M) {
    const mat = this.st[this.st.length - 1].clone().multiply(M);
    const a = this.m[key] || (this.m[key] = { p: [], n: [], u: [], i: [], c: 0 });
    const p = geo.attributes.position, n = geo.attributes.normal, u = geo.attributes.uv, v = this.v;
    this.nm.getNormalMatrix(mat);
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(mat); a.p.push(v.x, v.y, v.z);
      v.fromBufferAttribute(n, i).applyMatrix3(this.nm).normalize(); a.n.push(v.x, v.y, v.z);
      a.u.push(u ? u.getX(i) : 0, u ? u.getY(i) : 0);
    }
    if (geo.index) for (let i = 0; i < geo.index.count; i++) a.i.push(geo.index.getX(i) + a.c);
    else for (let i = 0; i < p.count; i++) a.i.push(i + a.c);
    a.c += p.count;
  }
  build(mats, parent) {
    for (const k in this.m) {
      const a = this.m[k], g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(a.p, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(a.n, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(a.u, 2));
      g.setIndex(a.i);
      const mesh = new THREE.Mesh(g, mats[k]); mesh.castShadow = true; mesh.receiveShadow = true;
      parent.add(mesh);
    }
  }
}

export function buildSkeletonChair() {
  const outer = new THREE.Group();
  const g = new THREE.Group();
  g.rotation.y = Math.PI;                       // mặt ghế hướng -Z
  outer.add(g);
  const rand = rng(1031);
  const rr = (a, b) => a + (b - a) * rand();

  const bt = boneTexture(rand);
  const mats = {
    bone: new THREE.MeshStandardMaterial({ color: bt ? '#ffffff' : '#cfc29a', map: bt, bumpMap: bt, bumpScale: 0.25, roughness: 0.88 }),
    cart: new THREE.MeshStandardMaterial({ color: '#b9a77c', roughness: 0.8 }),
    tooth: new THREE.MeshStandardMaterial({ color: '#efe6c6', roughness: 0.55 }),
    black: new THREE.MeshStandardMaterial({ color: '#09090b', roughness: 1 }),
    stain: new THREE.MeshStandardMaterial({ color: '#5a0d14', roughness: 0.9 }),
  };
  const M = new Merge();

  // ---- thư viện hình ----
  const SPH = new THREE.SphereGeometry(1, 8, 6);
  const SPHL = new THREE.SphereGeometry(1, 16, 12);
  const CYL = new THREE.CylinderGeometry(1, 1, 1, 8);
  const CONE = new THREE.ConeGeometry(1, 1, 7);
  const BOX = new THREE.BoxGeometry(1, 1, 1);
  const TOR = new THREE.TorusGeometry(1, 0.2, 6, 16);
  const UP = new THREE.Vector3(0, 1, 0);
  const V = (a) => new THREE.Vector3(...a);
  const T = (p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) =>
    new THREE.Matrix4().compose(V(p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)), V(s));
  const S = (key, geo, p, s = [1, 1, 1], r = [0, 0, 0]) => M.add(key, geo, T(p, r, s));
  const ball = (key, p, rad, sc = [1, 1, 1], hi = false) => S(key, hi ? SPHL : SPH, p, [rad * sc[0], rad * sc[1], rad * sc[2]]);

  // thân xương dài: hai đầu khớp phình, thắt giữa
  const shaftCache = {};
  const shaft = (L, r) => {
    const k = `${L.toFixed(3)}_${r.toFixed(4)}`;
    if (shaftCache[k]) return shaftCache[k];
    const e = Math.min(r * 3, L * 0.3);
    const pts = [[0.45, 0], [1.7, 0.3 * e], [1.9, 0.6 * e], [1.2, 1.2 * e], [0.95, e * 2], [0.9, L * 0.35], [0.82, L * 0.5], [0.9, L * 0.65], [0.96, L - e * 2], [1.25, L - 1.2 * e], [1.9, L - 0.6 * e], [1.7, L - 0.3 * e], [0.45, L]]
      .map(([m, y]) => new THREE.Vector2(r * m, y));
    return (shaftCache[k] = new THREE.LatheGeometry(pts, 9));
  };
  const bone = (a, b, r, key = 'bone', condyle = true) => {
    const A = V(a), B = V(b), dir = B.clone().sub(A), L = dir.length(); dir.normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(UP, dir);
    M.add(key, shaft(L, r), new THREE.Matrix4().compose(A, q, new THREE.Vector3(1, 1, 1)));
    if (!condyle) return;
    let side = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
    if (Math.abs(dir.x) > 0.9) side = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
    [A.clone().addScaledVector(dir, r * 0.9), B.clone().addScaledVector(dir, -r * 0.9)].forEach((E, i) => [-1, 1].forEach(sg =>
      ball(key, E.clone().addScaledVector(side, sg * r * 0.85).toArray(), r * (1.35 - 0.1 * i)))); // lồi cầu
  };
  const tube = (pts, rad, key = 'bone', seg = 18) => M.add(key, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(V)), seg, rad, 5), new THREE.Matrix4());
  const claw = (p, dir, len, r) => {
    const d = V(dir).normalize();
    M.add('bone', CONE, new THREE.Matrix4().compose(V(p).addScaledVector(d, len / 2), new THREE.Quaternion().setFromUnitVectors(UP, d), new THREE.Vector3(r, len, r)));
  };

  // ================= CHÂN: đùi → gối (bánh chè) → chày + mác → bàn chân =================
  const foot = (fx, fz) => {
    ball('bone', [fx, 0.05, fz - 0.025], 0.03, [1, 0.9, 1.3]);                 // xương gót
    ball('bone', [fx, 0.068, fz + 0.005], 0.024, [1, 0.8, 1.1]);               // xương sên
    for (let k = 0; k < 5; k++) {
      const ox = fx + (k - 2) * 0.021, a = (k - 2) * 0.14;
      const p0 = [ox * 1 + 0, 0.045, fz + 0.01];
      const p1 = [ox + Math.sin(a) * 0.065, 0.027, fz + 0.01 + Math.cos(a) * 0.065];
      bone(p0, p1, 0.0072, 'bone', false);                                    // xương bàn chân
      const d = [Math.sin(a), -0.15, Math.cos(a)];
      const q1 = [p1[0] + d[0] * 0.032, 0.022, p1[2] + d[2] * 0.032];
      bone(p1, q1, 0.0062, 'bone', false);                                    // đốt 1
      const q2 = [q1[0] + d[0] * 0.025, 0.016, q1[2] + d[2] * 0.025];
      bone(q1, q2, 0.0055, 'bone', false);                                    // đốt 2
      ball('bone', q1, 0.0085); ball('bone', q2, 0.0075);
      claw(q2, [d[0], -0.5, d[2]], 0.028, 0.0058);                            // vuốt
    }
  };
  [-1, 1].forEach(s => {
    const x = s * 0.4;
    bone([x, 0.64, 0.33], [x, 0.37, 0.35], 0.03);                              // xương đùi
    ball('bone', [x, 0.655, 0.33], 0.04, [1, 0.8, 1]);                          // chỏm xương đùi
    ball('bone', [x + s * 0.02, 0.62, 0.325], 0.02);                            // mấu chuyển
    ball('bone', [x, 0.37, 0.385], 0.028, [1, 1, 0.8], true);                   // bánh chè
    bone([x, 0.37, 0.35], [x, 0.065, 0.36], 0.024);                             // xương chày
    bone([x + s * 0.034, 0.34, 0.345], [x + s * 0.036, 0.09, 0.352], 0.011);    // xương mác
    foot(x, 0.36);
    bone([x, 0.45, -0.34], [x, 0.25, -0.37], 0.027);                            // chân sau: đùi
    ball('bone', [x, 0.25, -0.395], 0.024, [1, 1, 0.8], true);
    bone([x, 0.25, -0.37], [x, 0.065, -0.4], 0.022);
    bone([x + s * 0.03, 0.23, -0.375], [x + s * 0.032, 0.1, -0.395], 0.01);
    foot(x, -0.4);
  });

  // ================= KHUNG ĐẾ BẰNG XƯƠNG =================
  bone([-0.4, 0.34, 0.37], [0.4, 0.34, 0.37], 0.021);
  bone([-0.4, 0.34, -0.37], [0.4, 0.34, -0.37], 0.021);
  [-1, 1].forEach(s => bone([s * 0.4, 0.34, -0.37], [s * 0.4, 0.34, 0.37], 0.021));
  bone([-0.4, 0.215, 0.37], [0.4, 0.215, -0.37], 0.011);
  for (let i = 0; i < 12; i++) ball('cart', [rr(-0.38, 0.38), 0.34, rr(-0.37, 0.37) > 0 ? 0.37 : -0.37], 0.01);  // sụn nối

  // ================= XƯƠNG CHẬU + CỘT SỐNG =================
  const spineZ = (y) => -0.3 - 0.012 * Math.sin((y - 0.5) * 5);
  [-1, 1].forEach(s => {
    S('bone', SPHL, [s * 0.105, 0.535, -0.285], [0.085, 0.075, 0.03], [0.1, s * 0.5, s * 0.5]);    // cánh chậu
    ball('bone', [s * 0.07, 0.48, -0.27], 0.03, [1, 1.2, 0.8]);                                      // xương ngồi
    ball('bone', [s * 0.03, 0.47, -0.235], 0.014, [1, 0.8, 1]);                                      // xương mu
    S('black', SPH, [s * 0.075, 0.5, -0.256], [0.014, 0.016, 0.006], [0, s * 0.5, 0]);               // lỗ bịt
  });
  S('bone', CONE, [0, 0.47, -0.31], [0.036, 0.09, 0.02], [Math.PI, 0, 0]);                          // xương cùng
  for (let i = 0; i < 17; i++) {
    const y = 0.51 + i * 0.037, z = spineZ(y), rv = i < 5 ? 0.03 : i < 13 ? 0.025 : 0.018;
    S('bone', CYL, [0, y, z], [rv, 0.024, rv]);
    S('cart', CYL, [0, y + 0.0185, z], [rv * 0.9, 0.009, rv * 0.9]);                                 // đĩa đệm
    S('bone', CONE, [0, y - 0.004, z - rv - 0.014], [0.008, 0.038, 0.008], [-2.0, 0, 0]);            // gai sống
    [-1, 1].forEach(s => S('bone', CONE, [s * (rv + 0.012), y, z - 0.012], [0.006, 0.026, 0.006], [0, 0, -s * Math.PI / 2]));  // mấu ngang
  }

  // ================= LỒNG NGỰC: xương sườn + sụn + xương ức =================
  const A = [0.05, 0.075, 0.098, 0.115, 0.126, 0.13, 0.128, 0.12, 0.105, 0.09];
  const Bd = [0.04, 0.055, 0.068, 0.078, 0.085, 0.088, 0.086, 0.08, 0.07, 0.06];
  const front = [];
  for (let i = 0; i < 10; i++) {
    const y0 = 1.04 - i * 0.036, a = A[i], b = Bd[i], zc = spineZ(y0) - 0.004 + b, floating = i >= 7;
    const th1 = (floating ? 0.62 : 0.72) * Math.PI, th2 = (floating ? 0.82 : 1.0) * Math.PI;
    [-1, 1].forEach(s => {
      const P = (th) => [s * a * Math.sin(th) + s * 0.016 * Math.sin(th) * 0, y0 - 0.055 * (th / Math.PI) ** 1.4, zc - b * Math.cos(th)];
      const rib = [], cart = [];
      for (let k = 0; k <= 10; k++) rib.push(P(0.06 * Math.PI + (th1 - 0.06 * Math.PI) * (k / 10)));
      for (let k = 0; k <= 4; k++) cart.push(P(th1 + (th2 - th1) * (k / 4)));
      tube(rib, 0.0115 - i * 0.0003, 'bone', 22);
      tube(cart, 0.009, 'cart', 8);
      ball('bone', rib[0], 0.014);                                                                    // đầu sườn nối đốt sống
    });
    if (!floating) front.push([0, y0 - 0.055, zc + b]);
  }
  for (let i = 0; i < front.length - 1; i++) {                                                       // xương ức
    const A0 = V(front[i]), B0 = V(front[i + 1]), d = B0.clone().sub(A0), L = d.length();
    M.add('bone', BOX, new THREE.Matrix4().compose(A0.clone().add(B0).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()), new THREE.Vector3(i === 0 ? 0.05 : 0.036, L, 0.013)));
  }
  S('bone', CONE, [0, front[front.length - 1][1] - 0.03, front[front.length - 1][2]], [0.012, 0.05, 0.009], [Math.PI, 0, 0]);   // mũi ức
  [-1, 1].forEach(s => {
    tube([[s * 0.014, 1.06, front[0][2] + 0.005], [s * 0.07, 1.075, -0.23], [s * 0.13, 1.065, -0.27], [s * 0.2, 1.05, -0.3]], 0.0115, 'bone', 14);   // xương đòn
    S('bone', SPHL, [s * 0.14, 1.0, -0.345], [0.07, 0.09, 0.012], [0.2, s * 0.3, s * 0.4]);           // xương bả vai
    S('bone', BOX, [s * 0.15, 1.03, -0.357], [0.09, 0.012, 0.01], [0, s * 0.3, s * 0.15]);             // gai bả vai
    ball('bone', [s * 0.205, 1.045, -0.3], 0.034);                                                     // chỏm xương cánh tay
  });

  // ================= TAY: cánh tay → khuỷu → trụ + quay (tay vịn) → bàn tay =================
  [-1, 1].forEach(s => {
    bone([s * 0.205, 1.04, -0.3], [s * 0.385, 0.69, -0.3], 0.025);                                     // xương cánh tay
    ball('bone', [s * 0.395, 0.675, -0.3], 0.036, [1, 1, 1.1]);                                        // mỏm khuỷu
    bone([s * 0.39, 0.685, -0.3], [s * 0.405, 0.625, 0.335], 0.02);                                    // xương trụ
    bone([s * 0.365, 0.68, -0.29], [s * 0.372, 0.635, 0.33], 0.016);                                   // xương quay
    [[0.4, 0], [0.37, 0.022], [0.43, 0.02], [0.385, 0.045], [0.415, 0.047]].forEach(([x, z]) => ball('bone', [s * x, 0.618, 0.355 + z], 0.0115));  // xương cổ tay
    for (let f = 0; f < 4; f++) {                                                                      // 4 ngón + ngón cái
      const kx = s * (0.38 + f * 0.016), P0 = [kx, 0.62, 0.395];
      let pos = V(P0), ang = -0.2;
      const lens = [0.038, 0.027, 0.022, 0.017];
      for (let j = 0; j < (f === 0 ? 3 : 4); j++) {
        const d = V([f * 0.015 * s * 0.2, Math.sin(ang), Math.cos(ang)]).normalize();
        const nx = pos.clone().addScaledVector(d, lens[j]);
        bone(pos.toArray(), nx.toArray(), 0.0068 - j * 0.0009, 'bone', false);
        ball('bone', nx.toArray(), 0.0085 - j * 0.001);
        pos = nx; ang -= 0.55;
      }
      claw(pos.toArray(), [0, Math.sin(ang + 0.2), Math.cos(ang + 0.2)], 0.014, 0.005);
    }
  });

  // ================= SỌ =================
  M.push(T([0, 1.235, -0.285]));
  S('bone', SPHL, [0, 0.025, -0.005], [0.098, 0.108, 0.118]);                                    // hộp sọ
  S('bone', SPHL, [0, 0.005, -0.07], [0.08, 0.075, 0.055]);                                      // xương chẩm
  S('bone', SPHL, [0, 0.0, 0.104], [0.09, 0.018, 0.024]);                                        // gờ trên ổ mắt
  S('bone', SPHL, [0, 0.078, 0.08], [0.075, 0.05, 0.05]);                                        // xương trán
  S('bone', SPHL, [0, -0.074, 0.083], [0.062, 0.038, 0.046]);                                    // xương hàm trên
  [-1, 1].forEach(s => {
    S('black', SPHL, [s * 0.043, -0.012, 0.1], [0.03, 0.034, 0.024]);                            // hốc mắt
    S('bone', TOR, [s * 0.043, -0.012, 0.115], [0.034, 0.038, 0.03]);                            // vành ổ mắt
    ball('bone', [s * 0.07, -0.046, 0.08], 0.02, [1, 0.8, 1]);                                   // gò má
    tube([[s * 0.075, -0.045, 0.07], [s * 0.098, -0.035, 0.03], [s * 0.099, -0.02, -0.01]], 0.0072, 'bone', 8);   // cung gò má
    ball('black', [s * 0.1, -0.006, -0.012], 0.01);                                              // lỗ tai
    S('bone', SPHL, [s * 0.082, 0.048, 0.03], [0.02, 0.05, 0.05]);                               // xương thái dương
    ball('bone', [s * 0.085, -0.085, 0.088], 0.014);                                             // xương hàm trên (bên)
  });
  S('black', CONE, [0, -0.052, 0.116], [0.014, 0.034, 0.012], [Math.PI, 0, 0]);                  // hốc mũi
  S('bone', BOX, [0, -0.022, 0.12], [0.01, 0.034, 0.008]);                                        // xương mũi
  const jaw = [[-0.087, -0.015, -0.012], [-0.085, -0.075, 0.0], [-0.065, -0.118, 0.05], [-0.03, -0.131, 0.088], [0, -0.134, 0.098], [0.03, -0.131, 0.088], [0.065, -0.118, 0.05], [0.085, -0.075, 0.0], [0.087, -0.015, -0.012]];
  tube(jaw, 0.0105, 'bone', 28);                                                                  // xương hàm dưới
  ball('bone', [0, -0.131, 0.099], 0.022, [1, 0.7, 0.8]);                                         // cằm
  [-1, 1].forEach(s => ball('bone', [s * 0.087, -0.012, -0.012], 0.016));                         // khớp thái dương – hàm
  for (let k = 0; k < 10; k++) {                                                                   // răng trên + dưới
    const x = (k - 4.5) * 0.0098, zz = 0.118 - (x / 0.05) ** 2 * 0.06, canine = k === 2 || k === 7;
    S('tooth', CYL, [x, -0.104, zz], [0.0042, canine ? 0.02 : 0.016, 0.0036]);
    const x2 = x * 0.92, z2 = 0.108 - (x2 / 0.05) ** 2 * 0.055;
    S('tooth', CYL, [x2, -0.122, z2], [0.0038, canine ? 0.019 : 0.014, 0.0034]);
  }
  for (let k = 0; k < 3; k++) S('black', SPH, [(k - 1) * 0.03, -0.109, 0.105], [0.012, 0.004, 0.004]);   // khe răng
  M.pop();
  bone([0, 1.1, -0.298], [0, 1.15, -0.292], 0.017);                                              // đốt sống cổ

  // ================= vài mảnh xương rơi dưới chân =================
  for (let i = 0; i < 4; i++) {
    const x = rr(-0.5, 0.5), z = rr(0.45, 0.62);
    bone([x, 0.012, z], [x + rr(-0.08, 0.08), 0.012, z + rr(0.04, 0.1)], 0.008, 'bone', false);
  }
  M.build(mats, g);

  // ================= NỆM RÁCH (nút bấm, vết rách, tua rua) =================
  const dark = new THREE.MeshStandardMaterial({ color: '#2b2b31', roughness: 1 });
  const red = new THREE.MeshStandardMaterial({ color: '#6a0f18', roughness: 0.95 });
  const cush = new THREE.Mesh(rbox(0.86, 0.78, 0.11, 0.09, 0.04), [dark, red]);
  cush.rotation.x = -Math.PI / 2; cush.position.set(0, 0.388, 0); cush.castShadow = cush.receiveShadow = true; g.add(cush);
  const sm = new Merge();
  const sput = (key, geo, p, s, r) => sm.add(key, geo, T(p, r, s));
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {                                    // nút bấm + nếp lõm
    const x = i * 0.24, z = j * 0.22;
    sput('dark2', SPH, [x, 0.4415, z], [0.016, 0.008, 0.016]);
    sput('black', SPH, [x, 0.4405, z], [0.007, 0.005, 0.007]);
    for (let k = 0; k < 4; k++) { const a = (k / 4) * 6.28; sput('dark2', SPH, [x + Math.cos(a) * 0.04, 0.4425, z + Math.sin(a) * 0.04], [0.028, 0.004, 0.005], [0, -a, 0]); }
  }
  for (let i = 0; i < 7; i++) {                                                                      // vết rách lộ ruột
    const x = rr(-0.32, 0.32), z = rr(-0.3, 0.3), w = rr(0.05, 0.1), d = rr(0.02, 0.045), ry = rr(0, 3);
    sput('stain', SPH, [x, 0.4435, z], [w, 0.004, d], [0, ry, 0]);
    sput('black', SPH, [x, 0.4455, z], [w * 0.6, 0.002, d * 0.55], [0, ry, 0]);
    for (let k = 0; k < 5; k++) sput('dark2', BOX, [x + Math.cos(ry) * (k - 2) * w * 0.4, 0.445, z - Math.sin(ry) * (k - 2) * w * 0.4], [0.012, 0.004, rr(0.01, 0.025)], [0, ry + rr(-0.5, 0.5), 0]);  // mép rách
  }
  for (let i = 0; i < 46; i++) {                                                                     // tua rua sờn mép
    const a = rand() * 6.28, onX = Math.cos(a) > 0 ? 1 : -1, t = rr(-0.38, 0.38);
    const side = rand() < 0.5;
    const p = side ? [onX * 0.43, 0.345, t] : [t * 1.05, 0.345, (Math.sin(a) > 0 ? 1 : -1) * 0.39];
    sput(rand() < 0.5 ? 'dark2' : 'stain', CONE, p, [0.007, rr(0.03, 0.07), 0.007], [Math.PI, 0, 0]);
  }
  sm.build({ dark2: dark, black: mats.black, stain: red }, g);

  // ================= MẠNG NHỆN NHIỀU LỚP =================
  const pts = [];
  const web = (c, u, v, rad, spokes = 10, rings = 5, sag = 0.015) => {
    const P = (a, r) => V([c[0] + (u[0] * Math.cos(a) + v[0] * Math.sin(a)) * r, Math.max(0.01, c[1] + (u[1] * Math.cos(a) + v[1] * Math.sin(a)) * r), c[2] + (u[2] * Math.cos(a) + v[2] * Math.sin(a)) * r]);
    const rim = [];
    for (let i = 0; i < spokes; i++) {
      const a = (i / spokes) * Math.PI * 2 + rr(-0.1, 0.1), r = rad * rr(0.7, 1.0);
      rim.push([a, r]); pts.push(V(c), P(a, r));
    }
    for (let k = 1; k <= rings; k++) for (let i = 0; i < spokes; i++) {
      const [a0, r0] = rim[i], [a1, r1] = rim[(i + 1) % spokes], f = Math.pow(k / (rings + 1), 0.9);
      const Aa = P(a0, r0 * f), Bb = P(a1, r1 * f), mid = Aa.clone().add(Bb).multiplyScalar(0.5);
      mid.y -= sag * (1 - f * 0.5); mid.addScaledVector(V(c).sub(mid), 0.04);
      pts.push(Aa, mid, mid, Bb);
    }
  };
  [-1, 1].forEach(s => {
    web([s * 0.4, 0.22, 0.0], [0, 0, 1], [0, 1, 0], 0.36, 12, 6);          // giữa chân trước–sau (to)
    web([s * 0.405, 0.47, 0.05], [0, 0, 1], [0, 1, 0], 0.27, 10, 5);        // dưới tay vịn
    web([s * 0.3, 0.85, -0.29], [0, 0, 1], [0, 1, 0], 0.2, 9, 4);           // giữa sườn và tay
    web([s * 0.25, 1.08, -0.36], [1, 0, 0], [0, 1, 0], 0.13, 8, 3);         // góc vai
  });
  web([0, 1.0, -0.37], [1, 0, 0], [0, 1, 0], 0.36, 14, 6);                   // sau lưng
  web([0, 0.78, -0.39], [1, 0, 0], [0, 1, 0], 0.3, 12, 5);
  web([0, 1.18, -0.36], [1, 0, 0], [0, 1, 0], 0.15, 9, 3);                   // quanh sọ
  web([0, 0.2, 0.39], [1, 0, 0], [0, 1, 0], 0.3, 10, 4);                     // dưới ghế phía trước
  web([0, 0.2, -0.43], [1, 0, 0], [0, 1, 0], 0.3, 10, 4);
  for (let i = 0; i < 26; i++) {                                              // sợi tơ dài giăng ngẫu nhiên
    const a = V([rr(-0.42, 0.42), rr(0.1, 1.1), rr(-0.4, 0.4)]), b = a.clone().add(V([rr(-0.2, 0.2), rr(-0.25, 0.1), rr(-0.2, 0.2)]));
    b.y = Math.max(0.03, b.y); const m = a.clone().add(b).multiplyScalar(0.5); m.y -= 0.02;
    pts.push(a, m, m, b);
  }
  g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#f2f2f2', transparent: true, opacity: 0.55 })));

  // nhện 8 chân
  const sp = new Merge();
  [[0.43, 0.62, 0.1], [0.0, 1.03, -0.385], [0.19, 0.28, 0.4], [-0.41, 0.4, -0.1]].forEach(([x, y, z], n) => {
    const k = 0.9 + n * 0.12;
    sp.add('black', SPH, T([x, y, z], [0, 0, 0], [0.011 * k, 0.011 * k, 0.014 * k]));
    sp.add('black', SPH, T([x, y + 0.004, z + 0.015 * k], [0, 0, 0], [0.007 * k, 0.007 * k, 0.007 * k]));
    for (let l = 0; l < 8; l++) {
      const sd = l < 4 ? -1 : 1, i = l % 4, zz = (i - 1.5) * 0.007 * k;
      const knee = V([x + sd * 0.022 * k, y + 0.014 * k, z + zz * 1.5]), foot2 = V([x + sd * 0.04 * k, y - 0.012 * k, z + zz * 3]);
      [[V([x, y, z + zz]), knee], [knee, foot2]].forEach(([p, q]) => {
        const d = q.clone().sub(p);
        sp.add('black', CYL, new THREE.Matrix4().compose(p.clone().add(q).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(UP, d.clone().normalize()), new THREE.Vector3(0.0012, d.length(), 0.0012)));
      });
    }
  });
  sp.build({ black: mats.black }, g);

  outer.userData.replacementScale = 1.2;
  return outer;
}

export { buildSkeletonChair as buildSingleChair };
