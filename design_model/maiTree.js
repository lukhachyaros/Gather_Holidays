// Cây Mai Vàng (Ochna integerrima) – procedural 3D model, dựng theo ảnh tham chiếu.
// Drop-in thay cho buildGiantMaiTree() cũ: giữ nguyên API (userData.envelopes, PointLight, label).
import * as THREE from 'three';
import { part, mat, G, labelSprite } from '../js/modelUtils.js';

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

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

// ---------- Texture vỏ cây ----------
function barkTexture(rand) {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#6e5a46';
  x.fillRect(0, 0, 128, 256);
  for (let i = 0; i < 260; i++) {
    const px = rand() * 128, py = rand() * 256, h = 20 + rand() * 70;
    const l = 25 + rand() * 30;
    x.strokeStyle = `hsla(28, 22%, ${l}%, ${0.25 + rand() * 0.35})`;
    x.lineWidth = 1 + rand() * 2.5;
    x.beginPath();
    x.moveTo(px, py);
    x.quadraticCurveTo(px + (rand() - 0.5) * 8, py + h / 2, px + (rand() - 0.5) * 6, py + h);
    x.stroke();
  }
  for (let i = 0; i < 60; i++) {
    x.strokeStyle = 'rgba(20,14,8,0.35)';
    x.lineWidth = 1;
    const py = rand() * 256, px = rand() * 128;
    x.beginPath(); x.moveTo(px, py); x.lineTo(px + 8 + rand() * 20, py + (rand() - 0.5) * 4); x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------- Bộ dựng ống thon (một geometry duy nhất cho toàn bộ thân/cành) ----------
class WoodBuilder {
  constructor() { this.pos = []; this.uv = []; this.col = []; this.idx = []; this.n = 0; }

  tube(points, r0, r1, { seg = 8, gnarl = 0.07, mossBelow = 0, rand = Math.random } = {}) {
    const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.5);
    const rings = Math.max(6, points.length * 3);
    const frames = curve.computeFrenetFrames(rings, false);
    const len = curve.getLength();
    const phase = rand() * 6.28;
    for (let i = 0; i <= rings; i++) {
      const t = i / rings;
      const p = curve.getPointAt(t);
      const r = (r0 + (r1 - r0) * Math.pow(t, 0.85)) * (1 + gnarl * Math.sin(t * 14 + phase));
      for (let j = 0; j <= seg; j++) {
        const a = (j / seg) * Math.PI * 2;
        const nx = frames.normals[i], bn = frames.binormals[i];
        const cx = Math.cos(a), sy = Math.sin(a);
        this.pos.push(
          p.x + (nx.x * cx + bn.x * sy) * r,
          p.y + (nx.y * cx + bn.y * sy) * r,
          p.z + (nx.z * cx + bn.z * sy) * r,
        );
        this.uv.push((j / seg) * Math.max(1, Math.round(r * 5)), t * len * 0.7);
        const moss = mossBelow > 0 ? THREE.MathUtils.clamp((mossBelow - p.y) / mossBelow, 0, 1) * 0.6 : 0;
        this.col.push(1 - moss * 0.55, 1 - moss * 0.1, 1 - moss * 0.6);
      }
    }
    const row = seg + 1;
    for (let i = 0; i < rings; i++) {
      for (let j = 0; j < seg; j++) {
        const a = this.n + i * row + j, b = a + row;
        this.idx.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
    this.n += (rings + 1) * row;
  }

  build(material) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.idx);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, material);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }
}

// ---------- Geometry hoa mai 5 cánh (có nhụy) ----------
function flowerGeometry() {
  const shape = new THREE.Shape();
  const N = 30;
  for (let i = 0; i <= N; i++) {
    const th = (i / N) * Math.PI * 2;
    const r = 0.5 * (0.72 + 0.28 * Math.abs(Math.cos(2.5 * th)));
    const px = Math.cos(th + Math.PI / 2) * r, py = Math.sin(th + Math.PI / 2) * r;
    i ? shape.lineTo(px, py) : shape.moveTo(px, py);
  }
  const petals = new THREE.ShapeGeometry(shape);
  const center = new THREE.CircleGeometry(0.13, 6);
  center.translate(0, 0, 0.004);
  const paint = (g, r, gr, b) => {
    const n = g.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = r; a[i * 3 + 1] = gr; a[i * 3 + 2] = b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  };
  paint(petals, 1, 1, 1);
  paint(center, 0.42, 0.26, 0.04);
  const merge = (a, b) => {
    const g = new THREE.BufferGeometry();
    const cat = (k, s) => {
      const A = a.attributes[k].array, B = b.attributes[k].array, o = new Float32Array(A.length + B.length);
      o.set(A); o.set(B, A.length);
      g.setAttribute(k, new THREE.BufferAttribute(o, s));
    };
    cat('position', 3); cat('color', 3); cat('normal', 3);
    const off = a.attributes.position.count;
    const ia = Array.from(a.index.array), ib = Array.from(b.index.array, v => v + off);
    g.setIndex([...ia, ...ib]);
    return g;
  };
  return merge(petals, center);
}

// ---------- Cây mai ----------
export function buildGiantMaiTree() {
  const g = new THREE.Group();
  const rand = rng(20260212);
  const rr = (a, b) => a + (b - a) * rand();

  // --- Nền đất + rêu + cỏ ---
  const soilMat = mat('#4a3b2a', { roughness: 1 });
  const mound = new THREE.Mesh(
    new THREE.LatheGeometry([
      V3(0.0, 0.32), V3(1.2, 0.26), V3(2.2, 0.14), V3(3.0, 0.04), V3(3.3, 0),
    ].map(v => new THREE.Vector2(v.x, v.y)), 28),
    soilMat);
  mound.receiveShadow = true;
  g.add(mound);
  part(g, G.cyl(), mat('#5f8a3a', { roughness: 1 }), [0, 0.30, 0], [2.4, 0.05, 2.4]);

  const grassGeo = new THREE.ConeGeometry(0.035, 0.28, 4);
  const grass = new THREE.InstancedMesh(grassGeo, mat('#5aa02c', { roughness: 1 }), 160);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 160; i++) {
    const a = rand() * 6.28, d = 0.9 + rand() * 2.1;
    dummy.position.set(Math.cos(a) * d, 0.3 * (1 - d / 3.4) + 0.1, Math.sin(a) * d);
    dummy.rotation.set((rand() - 0.5) * 0.5, 0, (rand() - 0.5) * 0.5);
    dummy.scale.setScalar(0.7 + rand() * 0.9);
    dummy.updateMatrix();
    grass.setMatrixAt(i, dummy.matrix);
  }
  g.add(grass);

  // --- Thân, rễ, cành ---
  const wood = new WoodBuilder();
  const tubeOpt = (extra = {}) => ({ rand, ...extra });
  const up = V3(0, 1, 0);

  // Rễ nổi tỏa quanh gốc
  const rootN = 9;
  for (let i = 0; i < rootN; i++) {
    const a = (i / rootN) * Math.PI * 2 + rr(-0.2, 0.2), L = rr(1.5, 2.4);
    const dx = Math.cos(a), dz = Math.sin(a);
    wood.tube([
      V3(dx * 0.1, 0.9, dz * 0.1),
      V3(dx * L * 0.25, 0.55, dz * L * 0.25),
      V3(dx * L * 0.6 + rr(-0.15, 0.15), 0.3, dz * L * 0.6 + rr(-0.15, 0.15)),
      V3(dx * L, 0.2, dz * L),
    ], rr(0.2, 0.28), 0.04, tubeOpt({ seg: 7, gnarl: 0.12, mossBelow: 0.9 }));
  }

  // Thân chính xoắn nhẹ
  const trunkPts = [V3(0, 0.1, 0), V3(0.18, 1.0, 0.08), V3(-0.12, 1.9, 0.2), V3(0.14, 2.7, 0.0), V3(0.0, 3.3, -0.08)];
  wood.tube(trunkPts, 0.62, 0.3, tubeOpt({ seg: 12, gnarl: 0.1, mossBelow: 1.4 }));

  const anchors = []; // điểm gắn hoa
  const grow = (start, dir, len, r, depth, maxDepth) => {
    const segs = 5;
    const pts = [start.clone()];
    const d = dir.clone();
    const jit = 0.2 + depth * 0.08;
    for (let s = 1; s <= segs; s++) {
      d.add(V3(rr(-1, 1), rr(-1, 1), rr(-1, 1)).multiplyScalar(jit))
        .add(V3(0, 0.1 - depth * 0.02, 0)).normalize();
      pts.push(pts[s - 1].clone().addScaledVector(d, len / segs));
    }
    const rEnd = Math.max(0.012, r * 0.5);
    wood.tube(pts, r, rEnd, tubeOpt({ seg: r > 0.1 ? 8 : 5, gnarl: 0.05 }));
    if (depth >= 1) for (let i = 2; i < pts.length; i++) anchors.push(pts[i]);
    if (depth >= maxDepth) return;
    const kids = depth === 0 ? 5 : depth === 1 ? 3 : 2;
    for (let k = 0; k < kids; k++) {
      const i = 1 + Math.floor(rr(0.25, 1) * (segs - 1));
      const local = pts[Math.min(i + 1, segs)].clone().sub(pts[i - 1]).normalize();
      const axis = local.clone().cross(V3(rr(-1, 1), rr(-1, 1), rr(-1, 1))).normalize();
      const cd = local.clone().applyAxisAngle(axis, rr(0.6, 1.1));
      cd.add(V3(0, 0.12, 0)).normalize();
      grow(pts[i], cd, len * rr(0.55, 0.7), Math.max(0.02, r * 0.55), depth + 1, maxDepth);
    }
  };

  // Cành lớn tầng thấp (vươn rộng) + tầng cao
  const limbs = [
    // [y gắn, góc phương vị, nghiêng lên, dài, bán kính]
    [1.7, 0.2, 0.30, 2.6, 0.2],
    [1.9, 2.3, 0.35, 2.7, 0.2],
    [1.8, 4.2, 0.28, 2.5, 0.19],
    [2.5, 1.2, 0.55, 2.3, 0.18],
    [2.6, 3.4, 0.5, 2.3, 0.18],
    [2.7, 5.3, 0.6, 2.2, 0.17],
    [3.2, 0.7, 1.0, 2.2, 0.16],
    [3.3, 2.9, 1.05, 2.1, 0.16],
    [3.3, 4.9, 1.0, 2.2, 0.15],
    [3.3, 0, 99, 2.6, 0.17], // ngọn
  ];
  limbs.forEach(([y, az, lift, L, r]) => {
    const base = trunkPts[Math.min(4, Math.floor(y / 0.85))].clone();
    base.y = y;
    base.x *= 0.6; base.z *= 0.6;
    const dir = lift === 99
      ? V3(rr(-0.15, 0.15), 1, rr(-0.15, 0.15))
      : V3(Math.cos(az), lift, Math.sin(az)).normalize();
    grow(base, dir, L, r, 0, 3);
  });

  const barkMap = barkTexture(rand);
  const woodMat = new THREE.MeshStandardMaterial({
    color: '#ffffff', map: barkMap, vertexColors: true, roughness: 0.95, metalness: 0,
  });
  g.add(wood.build(woodMat));

  // --- Hoa mai (InstancedMesh) ---
  const MAX_FLOWERS = 1700;
  const flowerMat = new THREE.MeshStandardMaterial({
    vertexColors: true, side: THREE.DoubleSide, roughness: 0.55,
    emissive: '#b87800', emissiveIntensity: 0.3,
  });
  const flowers = new THREE.InstancedMesh(flowerGeometry(), flowerMat, MAX_FLOWERS);
  const budMat = mat('#5d9a2e', { roughness: 0.7 });
  const buds = new THREE.InstancedMesh(new THREE.SphereGeometry(0.05, 6, 5), budMat, 320);
  const shuffled = anchors.slice().sort(() => rand() - 0.5);
  const center = V3(0, 3.2, 0);
  const col = new THREE.Color();
  const Z = V3(0, 0, 1);
  let fi = 0, bi = 0, topY = 0;
  for (const a of shuffled) {
    topY = Math.max(topY, a.y);
    const cnt = 1 + Math.floor(rand() * 2.6);
    for (let k = 0; k < cnt && fi < MAX_FLOWERS; k++, fi++) {
      const off = V3(rr(-1, 1), rr(-1, 1), rr(-1, 1)).multiplyScalar(0.26);
      dummy.position.copy(a).add(off);
      const n = a.clone().sub(center).normalize().multiplyScalar(0.8).add(V3(rr(-1, 1), rr(-0.5, 1), rr(-1, 1))).normalize();
      dummy.quaternion.setFromUnitVectors(Z, n);
      dummy.rotateZ(rand() * 6.28);
      dummy.scale.setScalar(rr(0.24, 0.38));
      dummy.updateMatrix();
      flowers.setMatrixAt(fi, dummy.matrix);
      col.setHSL(rr(0.125, 0.145), 1, rr(0.48, 0.55));
      flowers.setColorAt(fi, col);
    }
    if (bi < 320 && rand() < 0.2) {
      dummy.position.copy(a).add(V3(rr(-1, 1), rr(-1, 1), rr(-1, 1)).multiplyScalar(0.3));
      dummy.quaternion.identity();
      dummy.rotation.set(rr(-1, 1), 0, rr(-1, 1));
      dummy.scale.set(1, rr(1.3, 1.9), 1);
      dummy.updateMatrix();
      buds.setMatrixAt(bi++, dummy.matrix);
    }
  }
  flowers.count = fi;
  buds.count = bi;
  flowers.instanceMatrix.needsUpdate = true;
  if (flowers.instanceColor) flowers.instanceColor.needsUpdate = true;
  g.add(flowers, buds);

  // --- Cánh hoa rụng dưới gốc ---
  const fallen = new THREE.InstancedMesh(flowerGeometry(), flowerMat, 110);
  for (let i = 0; i < 110; i++) {
    const ang = rand() * 6.28, d = 0.6 + Math.pow(rand(), 0.8) * 2.6;
    dummy.position.set(Math.cos(ang) * d, 0.32 * Math.max(0.2, 1 - d / 3.3) + 0.03, Math.sin(ang) * d);
    dummy.rotation.set(-Math.PI / 2 + rr(-0.15, 0.15), 0, rand() * 6.28);
    dummy.scale.setScalar(rr(0.12, 0.2));
    dummy.updateMatrix();
    fallen.setMatrixAt(i, dummy.matrix);
    fallen.setColorAt(i, col.setHSL(rr(0.12, 0.15), 1, rr(0.45, 0.55)));
  }
  g.add(fallen);

  // --- Bao lì xì & đèn lồng đỏ treo trên cành (giữ API cũ: userData.envelopes) ---
  const redMat = mat('#d90429', { emissive: '#9b0000', emissiveIntensity: 0.45 });
  const goldMat = mat('#ffd166', { metalness: 0.4 });
  const envelopes = [];
  const hangAnchors = anchors.filter(a => a.y > 2.8 && Math.hypot(a.x, a.z) > 0.9);
  const used = new Set();
  const COUNT = 14;
  for (let i = 0; i < COUNT; i++) {
    const ang = (i / COUNT) * Math.PI * 2;
    const ty = i % 2 === 0 ? 3.7 : 5.0;
    let best = null, bs = -1e9;
    for (const a of hangAnchors) {
      if (used.has(a)) continue;
      let da = Math.abs(Math.atan2(a.z, a.x) - (ang - Math.PI));
      da = Math.min(da, Math.PI * 2 - da);
      const s = -da * 3 - Math.abs(a.y - ty);
      if (s > bs) { bs = s; best = a; }
    }
    if (!best) break;
    used.add(best);
    const env = new THREE.Group();
    // Dây + nút vàng
    part(env, G.cyl(), goldMat, [0, -0.12, 0], [0.012, 0.26, 0.012]);
    if (i % 2 === 0) {
      // Đèn lồng/chuỗi đỏ dài có tua vàng (như trong ảnh)
      part(env, G.sph(), goldMat, [0, -0.27, 0], [0.09, 0.09, 0.09]);
      part(env, G.cyl(), redMat, [0, -0.55, 0], [0.12, 0.5, 0.12]);
      part(env, G.cone(), goldMat, [0, -0.88, 0], [0.12, 0.2, 0.12], [Math.PI, 0, 0]);
    } else {
      part(env, G.box(), redMat, [0, -0.46, 0], [0.24, 0.36, 0.04]);
      part(env, G.box(), goldMat, [0, -0.45, 0.025], [0.12, 0.12, 0.02]);
    }
    env.position.copy(best);
    env.rotation.y = -ang;
    g.add(env);
    envelopes.push(env);
  }
  g.userData.envelopes = envelopes;

  const light = new THREE.PointLight('#ffd166', 4.0, 15);
  light.position.set(0, 4.8, 0);
  g.add(light);

  // Thu nhỏ cho vừa map (cao ~7 đơn vị), nhãn đặt sau để không bị scale
  g.children.forEach(c => c.scale.multiplyScalar(0.82));
  g.children.forEach(c => c.position.multiplyScalar(0.82));
  topY *= 0.82;
  const lbl = labelSprite('🌸 Cây Mai Đại Thụ · [E] Hái Bao Lì Xì Đầu Năm 🧧', 'rgba(185,28,28,0.9)', '#fef08a', 0.48);
  lbl.position.set(0, topY + 1.0, 0);
  g.add(lbl);
  return g;
}
