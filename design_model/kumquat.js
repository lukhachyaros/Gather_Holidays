import * as THREE from 'three';

/* Cây quất Tết trong chậu men nâu đỏ - model procedural (không cần file ngoài).
   Dùng:  import { createKumquatTree } from './kumquat.js';
          const tree = createKumquatTree({ scale: 0.8, seed: 7 });  scene.add(tree);
   Đơn vị gốc ~ 1 = 1m, gốc toạ độ ở đáy chậu (y=0), cao ~2.3.
   Options: scale, seed, leafCount (mặc định 1800), fruitCount (mặc định 170). */

const V = (x, y, z) => new THREE.Vector3(x, y, z);

function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/* ống thuôn dần (thân/cành), có xoắn vỏ nhẹ */
function taperTube(pts, r0, r1, rough = 0.1, rad = 7) {
  const curve = new THREE.CatmullRomCurve3(pts), n = Math.max(8, pts.length * 4);
  const fr = curve.computeFrenetFrames(n, false), pos = [], idx = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, p = curve.getPoint(t), r = r0 + (r1 - r0) * t;
    for (let k = 0; k < rad; k++) {
      const a = k / rad * Math.PI * 2, rr = r * (1 + rough * Math.sin(a * 3 + i * 0.7));
      const c = Math.cos(a) * rr, s = Math.sin(a) * rr;
      pos.push(p.x + fr.normals[i].x * c + fr.binormals[i].x * s, p.y + fr.normals[i].y * c + fr.binormals[i].y * s, p.z + fr.normals[i].z * c + fr.binormals[i].z * s);
    }
  }
  for (let i = 0; i < n; i++) for (let k = 0; k < rad; k++) {
    const a = i * rad + k, b = i * rad + (k + 1) % rad, c = a + rad, d = b + rad;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}

function mergeGeos(list) {
  let off = 0; const pos = [], nor = [], idx = [];
  list.forEach((g) => {
    const p = g.attributes.position.array, n = g.attributes.normal.array;
    for (let i = 0; i < p.length; i++) { pos.push(p[i]); nor.push(n[i]); }
    g.index.array.forEach((i) => idx.push(i + off)); off += p.length / 3;
  });
  const m = new THREE.BufferGeometry();
  m.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); m.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); m.setIndex(idx);
  return m;
}

function buildPot() {
  const g = new THREE.Group();
  const prof = [[0, 0], [0.3, 0], [0.32, 0.03], [0.32, 0.08], [0.27, 0.1], [0.27, 0.13], [0.38, 0.18], [0.5, 0.3], [0.55, 0.44], [0.56, 0.5],
    [0.52, 0.53], [0.48, 0.5], [0.46, 0.46], [0, 0.46]].map(([x, y]) => new THREE.Vector2(x, y));
  const mat = new THREE.MeshStandardMaterial({ color: 0x8a2f26, roughness: 0.35, metalness: 0.1, side: THREE.DoubleSide });
  g.add(new THREE.Mesh(new THREE.LatheGeometry(prof, 48), mat));
  const dark = new THREE.MeshStandardMaterial({ color: 0x6e231c, roughness: 0.4 });
  for (let i = 0; i < 24; i++) {   // hoa văn nổi quanh thân chậu
    const a = i / 24 * Math.PI * 2, b = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), dark);
    b.position.set(Math.cos(a) * 0.525, 0.37, Math.sin(a) * 0.525); b.scale.set(1, 1.2, 0.7); b.rotation.y = -a; g.add(b);
  }
  const r1 = new THREE.Mesh(new THREE.TorusGeometry(0.535, 0.015, 6, 48), dark); r1.rotation.x = Math.PI / 2; r1.position.y = 0.43; g.add(r1);
  const soil = new THREE.Mesh(new THREE.CircleGeometry(0.46, 32), new THREE.MeshStandardMaterial({ color: 0x2f4a1f, roughness: 1 }));
  soil.rotation.x = -Math.PI / 2; soil.position.y = 0.455; g.add(soil);
  return g;
}

export function createKumquatTree(options = {}) {
  const rnd0 = mulberry32(options.seed || 7), rnd = (a, b) => a + (b - a) * rnd0();
  const root = new THREE.Group(); root.name = 'CayQuatTet';
  root.add(buildPot());

  const barkGeos = [], nodes = [];
  const trunkPts = [V(0, 0.46, 0), V(0.06, 0.62, 0.04), V(-0.03, 0.78, 0.06), V(0.04, 0.95, 0), V(0, 1.08, -0.03)];
  barkGeos.push(taperTube(trunkPts, 0.1, 0.05, 0.18, 9));
  for (let i = 0; i < 5; i++) {   // rễ nổi trên mặt đất
    const a = i / 5 * Math.PI * 2 + rnd(-0.3, 0.3), L = rnd(0.2, 0.32);
    barkGeos.push(taperTube([V(0, 0.55, 0), V(Math.cos(a) * L * 0.5, 0.5, Math.sin(a) * L * 0.5), V(Math.cos(a) * L, 0.45, Math.sin(a) * L)], 0.06, 0.012, 0.1, 6));
  }

  const grow = (p0, dir, len, r0, depth) => {
    const pts = [p0.clone()], p = p0.clone(), d = dir.clone().normalize();
    for (let i = 1; i <= 4; i++) {
      d.add(V(rnd(-0.2, 0.2), rnd(-0.06, 0.12), rnd(-0.2, 0.2))).normalize();
      p.add(d.clone().multiplyScalar(len / 4)); pts.push(p.clone());
    }
    barkGeos.push(taperTube(pts, r0, r0 * 0.5, 0.06, 5));
    nodes.push(pts[2].clone(), p.clone());
    if (depth >= 3) return;
    const kids = depth === 1 ? 3 : 2;
    for (let k = 0; k < kids; k++) {
      const src = k === 0 ? pts[2] : p, nd = d.clone().add(V(rnd(-0.8, 0.8), rnd(-0.2, 0.5), rnd(-0.8, 0.8)));
      grow(src, nd, len * rnd(0.55, 0.7), r0 * 0.5, depth + 1);
    }
    if (depth === 1) grow(pts[2], d.clone().add(V(rnd(-0.8, 0.8), 0.2, rnd(-0.8, 0.8))), len * 0.55, r0 * 0.5, depth + 1);
  };
  for (let i = 0; i < 6; i++) {   // 6 cành cấp 1 toả đều quanh thân
    const a = i / 6 * Math.PI * 2 + rnd(-0.3, 0.3), e = rnd(0.5, 1.0), t = trunkPts[2 + (i % 3)];
    grow(t, V(Math.cos(a) * Math.sin(e), Math.cos(e), Math.sin(a) * Math.sin(e)), rnd(0.8, 1.0), 0.04, 1);
  }
  const bark = new THREE.Mesh(mergeGeos(barkGeos), new THREE.MeshStandardMaterial({ color: 0x4b3f2c, roughness: 1 }));
  root.add(bark);

  /* lá: InstancedMesh */
  const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.bezierCurveTo(0.2, 0.45, 0.7, 0.4, 1, 0); sh.bezierCurveTo(0.7, -0.4, 0.2, -0.45, 0, 0);
  const lg = new THREE.ShapeGeometry(sh, 6); lg.scale(0.17, 0.17, 0.17);
  const LN = options.leafCount || 1800;
  const leaves = new THREE.InstancedMesh(lg, new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide, roughness: 0.55 }), LN);
  const dm = new THREE.Object3D(), col = new THREE.Color();
  for (let i = 0; i < LN; i++) {
    const n = nodes[i % nodes.length];
    dm.position.set(n.x + rnd(-0.24, 0.24), n.y + rnd(-0.2, 0.24), n.z + rnd(-0.24, 0.24));
    dm.rotation.set(rnd(0, 6.28), rnd(0, 6.28), rnd(0, 6.28)); dm.scale.setScalar(rnd(0.75, 1.3)); dm.updateMatrix();
    leaves.setMatrixAt(i, dm.matrix);
    col.setHSL(rnd(0.25, 0.32), rnd(0.5, 0.7), rnd(0.15, 0.3) + Math.max(0, dm.position.y - 1.6) * 0.06); leaves.setColorAt(i, col);
  }
  root.add(leaves);

  /* quả quất */
  const FN = options.fruitCount || 170;
  const fruits = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 14, 10), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, emissive: 0x3a1a00 }), FN);
  const outer = nodes.filter((n) => Math.hypot(n.x, n.z) > 0.35 || n.y > 1.5);
  for (let i = 0; i < FN; i++) {
    const n = outer[Math.floor(rnd0() * outer.length)], s = rnd(0.06, 0.09);
    dm.position.set(n.x + rnd(-0.2, 0.2), n.y + rnd(-0.18, 0.05), n.z + rnd(-0.2, 0.2));
    dm.rotation.set(0, 0, 0); dm.scale.set(s, s * 0.92, s); dm.updateMatrix(); fruits.setMatrixAt(i, dm.matrix);
    col.setHSL(rnd(0.07, 0.11), 1, rnd(0.45, 0.55)); fruits.setColorAt(i, col);
  }
  root.add(fruits);

  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  root.scale.setScalar(options.scale || 1);
  root.userData.size = { width: 2.6, depth: 2.6, height: 2.3 };
  return root;
}

export default createKumquatTree;
