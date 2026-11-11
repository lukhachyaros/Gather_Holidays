/**
 * dragon.js — Rồng Á Đông (Long) procedural cho three.js r150+.
 * Không cần asset ngoài, chỉ phụ thuộc 'three'.
 *
 *   import { createDragon } from './dragon.js';
 *   const dragon = createDragon({ quality: 'high' });
 *   dragon.group.position.set(x, 0, z);   // gốc nằm trên mặt đất, đầu hướng +Z
 *   scene.add(dragon.group);
 *   // trong vòng lặp: dragon.update(dt);  // dt tính bằng giây
 *   // khi bỏ map:     scene.remove(dragon.group); dragon.dispose();
 *
 * Kích thước mặc định: dài ~14 đơn vị, cao ~2.6, rộng ~3.4 (đơn vị three).
 * Chỉnh cỡ bằng dragon.group.scale.setScalar(k).
 */
import * as THREE from 'three';

/* ───────────────────────── tiện ích ───────────────────────── */

const TAU = Math.PI * 2;
const UP = new THREE.Vector3(0, 1, 0);
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/** PRNG xác định (mulberry32) để dựng giống nhau mỗi lần. */
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

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _bx = new THREE.Vector3();
const _by = new THREE.Vector3();
const _bz = new THREE.Vector3();

/** Texture vảy cá (xám, nhân với màu da) – sinh bằng code, không cần canvas/DOM. */
function makeScaleTexture(size = 128) {
  const data = new Uint8Array(size * size * 4);
  const W = 32;
  const H = 16;
  const Rr = W * 0.55;
  const shade = (s) => {
    const base = 0.62 + 0.38 * (1 - s * s);
    return base * (1 - 0.45 * smooth(0.82, 1.0, s));
  };
  for (let y = 0; y < size; y++) {
    const row = Math.floor(y / H);
    const xo = row & 1 ? W / 2 : 0;
    const ly = y % H;
    for (let x = 0; x < size; x++) {
      const lx = (x + xo) % W;
      const dNext = Math.min(Math.hypot(lx, ly - H), Math.hypot(lx - W, ly - H));
      const dOwn = Math.hypot(lx - W / 2, ly);
      const dPrev = Math.min(Math.hypot(lx, ly + H), Math.hypot(lx - W, ly + H));
      let v = 0.4;
      if (dNext < Rr) v = shade(dNext / Rr);
      else if (dOwn < Rr) v = shade(dOwn / Rr);
      else if (dPrev < Rr) v = shade(dPrev / Rr);
      const g = Math.round(clamp(v, 0, 1) * 255);
      const k = (y * size + x) * 4;
      data[k] = data[k + 1] = data[k + 2] = g;
      data[k + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

/** Ống thon dọc theo đường cong (tĩnh): dùng cho sừng, râu. */
function taperedTube(points, radiusAt, tubular = 16, radial = 8) {
  const curve = new THREE.CatmullRomCurve3(points);
  const fr = curve.computeFrenetFrames(tubular, false);
  const vc = (tubular + 1) * (radial + 1);
  const pos = new Float32Array(vc * 3);
  const nor = new Float32Array(vc * 3);
  const uv = new Float32Array(vc * 2);
  const idx = [];
  const P = new THREE.Vector3();
  for (let i = 0; i <= tubular; i++) {
    const u = i / tubular;
    curve.getPointAt(u, P);
    const r = radiusAt(u);
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * TAU;
      const c = Math.cos(a);
      const s = Math.sin(a);
      const nx = fr.normals[i].x * c + fr.binormals[i].x * s;
      const ny = fr.normals[i].y * c + fr.binormals[i].y * s;
      const nz = fr.normals[i].z * c + fr.binormals[i].z * s;
      const k = (i * (radial + 1) + j) * 3;
      pos[k] = P.x + nx * r;
      pos[k + 1] = P.y + ny * r;
      pos[k + 2] = P.z + nz * r;
      nor[k] = nx;
      nor[k + 1] = ny;
      nor[k + 2] = nz;
      uv[(i * (radial + 1) + j) * 2] = j / radial;
      uv[(i * (radial + 1) + j) * 2 + 1] = u;
    }
  }
  for (let i = 0; i < tubular; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j;
      const b = (i + 1) * (radial + 1) + j;
      const c = a + 1;
      const d = b + 1;
      idx.push(a, c, b, c, d, b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/** InstancedMesh tĩnh từ danh sách {p, q, s}. */
function staticInstances(geo, mat, specs, colors) {
  const mesh = new THREE.InstancedMesh(geo, mat, specs.length);
  const col = new THREE.Color();
  specs.forEach((sp, i) => {
    _p.set(sp.p[0], sp.p[1], sp.p[2]);
    if (sp.dir) _q.setFromUnitVectors(UP, _bx.set(sp.dir[0], sp.dir[1], sp.dir[2]).normalize());
    else _q.identity();
    if (typeof sp.s === 'number') _s.setScalar(sp.s);
    else _s.set(sp.s[0], sp.s[1], sp.s[2]);
    _m.compose(_p, _q, _s);
    mesh.setMatrixAt(i, _m);
    if (colors) mesh.setColorAt(i, col.setHex(colors[i % colors.length]));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.frustumCulled = false;
  return mesh;
}

/** Đặt một "lưỡi" (cone dẹt) vào InstancedMesh: gốc tại base, hướng dir, dẹt theo `flat`. */
function setBlade(mesh, i, base, flat, dir, len, halfW, thick) {
  _by.copy(dir).normalize();
  _bz.crossVectors(flat, _by);
  if (_bz.lengthSq() < 1e-8) _bz.set(1, 0, 0);
  _bz.normalize();
  _bx.crossVectors(_by, _bz).normalize();
  _bx.multiplyScalar(thick);
  _by.multiplyScalar(len);
  _bz.multiplyScalar(halfW);
  _m.makeBasis(_bx, _by, _bz);
  _m.setPosition(base);
  mesh.setMatrixAt(i, _m);
}

/* ───────────────────────── hình dáng thân ───────────────────────── */

const LEN = 14; // chiều dài thân (đầu → đuôi)
const GROUND = 0.0;
const PROFILE = [
  [0.0, 0.27],
  [0.06, 0.3],
  [0.16, 0.36],
  [0.3, 0.44],
  [0.45, 0.42],
  [0.62, 0.34],
  [0.8, 0.21],
  [0.93, 0.11],
  [1.0, 0.035],
];

function profileRadius(s) {
  for (let i = 1; i < PROFILE.length; i++) {
    if (s <= PROFILE[i][0]) {
      const [s0, r0] = PROFILE[i - 1];
      const [s1, r1] = PROFILE[i];
      return lerp(r0, r1, (s - s0) / (s1 - s0));
    }
  }
  return PROFILE[PROFILE.length - 1][1];
}

/** Xương sống: s=0 là đầu, s=1 là chóp đuôi; sóng lan từ đầu về đuôi.
 * moveIntensity: 0 khi đứng yên (chỉ thở nhẹ), 1 khi bay bình thường, >1 khi bay nhanh (uốn lượn mạnh).
 */
function spine(s, t, out, moveIntensity = 1.0) {
  const ph = t * (0.8 + 1.2 * moveIntensity);
  // Biên độ uốn lượn ngang (lat): mở rộng mạnh khi đang di chuyển (1.1), co gọn khi đứng yên (0.12)
  const latAmp = (0.12 + 0.98 * moveIntensity) * smooth(0.12, 0.55, s);
  const lat = latAmp * Math.sin(TAU * 1.35 * s - ph);
  // Nhấp nhô dọc (bob)
  const bobAmp = (0.04 + 0.22 * moveIntensity) * smooth(0.1, 0.6, s);
  const bob = bobAmp * Math.sin(TAU * 1.8 * s - ph * 1.3 + 1.1);
  const y = 0.62 + 1.0 * Math.exp(-s * 9) + 1.55 * s * s * s + bob;
  return out.set(lat, y, (0.5 - s) * LEN);
}

const _fa = new THREE.Vector3();
const _fb = new THREE.Vector3();
/** Hệ trục tại s: P (tâm), T (hướng về đuôi), S (ngang), U (lên). */
function frameAt(s, t, P, T, S, U, moveIntensity = 1.0) {
  spine(s, t, P, moveIntensity);
  spine(Math.min(s + 0.004, 1), t, _fb, moveIntensity);
  spine(Math.max(s - 0.004, 0), t, _fa, moveIntensity);
  T.subVectors(_fb, _fa).normalize();
  S.set(T.z, 0, -T.x).normalize();
  U.crossVectors(T, S);
}

/* ───────────────────────── tạo rồng ───────────────────────── */

export function createDragon(options = {}) {
  const { quality = 'high', castShadow = true, pearlLight = true, seed = 7, colors = null } = options;
  const R = quality === 'low' ? 56 : 96; // số vòng dọc thân
  const N = quality === 'low' ? 14 : 24; // số điểm quanh thân
  const rand = rng(seed);

  const group = new THREE.Group();
  group.name = 'Dragon';

  /* ── bảng màu có thể tùy chỉnh theo skin ── */
  const cTopHex = colors?.top ?? 0xca8a04;
  const cSideHex = colors?.side ?? 0xfacc15;
  const cBellyHex = colors?.belly ?? 0xfef08a;
  const skinHex = colors?.skin ?? 0xfacc15;
  const maneHex = colors?.mane ?? 0xffffff;
  const finHex = colors?.fin ?? 0xdc2626;

  /* ── vật liệu & texture ── */
  const scaleTex = makeScaleTexture(128);
  const headTex = scaleTex.clone();
  headTex.repeat.set(8, 4);
  headTex.needsUpdate = true;

  const bodyMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    map: scaleTex,
    bumpMap: scaleTex,
    bumpScale: 1.5,
    roughness: 0.45,
    metalness: 0.15,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: skinHex,
    map: headTex,
    bumpMap: headTex,
    bumpScale: 1.5,
    roughness: 0.45,
    metalness: 0.15,
  });
  const finMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.45,
    emissive: 0x5a3c00,
    emissiveIntensity: 0.6,
    flatShading: true,
  });
  const maneMat = new THREE.MeshStandardMaterial({ color: maneHex, roughness: 0.7, flatShading: true });
  const ivoryMat = new THREE.MeshStandardMaterial({ color: 0xf0e4bc, roughness: 0.4 });
  const mouthMat = new THREE.MeshStandardMaterial({ color: 0xa01c1c, roughness: 0.5 });
  const tongueMat = new THREE.MeshStandardMaterial({ color: 0xe0687a, roughness: 0.5 });
  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0xfff0b0,
    emissive: 0x9a7000,
    emissiveIntensity: 0.6,
    roughness: 0.2,
  });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x120a08, roughness: 0.6 });
  const whiskerMat = new THREE.MeshStandardMaterial({ color: 0x9fd0bd, roughness: 0.5 });
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const pearlMat = new THREE.MeshStandardMaterial({
    color: 0xd8200f,
    emissive: 0xff3a0a,
    emissiveIntensity: 1.6,
    roughness: 0.35,
  });

  /* ── hình học dùng chung ── */
  const unitSphere = new THREE.SphereGeometry(1, 18, 12);
  const bladeGeo = new THREE.ConeGeometry(1, 1, 4, 1);
  bladeGeo.translate(0, 0.5, 0);
  const toothGeo = new THREE.ConeGeometry(0.026, 0.11, 5);
  toothGeo.translate(0, 0.055, 0);
  const fangGeo = new THREE.ConeGeometry(0.042, 0.2, 6);
  fangGeo.translate(0, 0.1, 0);
  const clawGeo = new THREE.ConeGeometry(0.032, 0.2, 5);
  clawGeo.translate(0, 0.1, 0);
  const upperLegGeo = new THREE.CylinderGeometry(0.085, 0.125, 1, 10, 1);
  const lowerLegGeo = new THREE.CylinderGeometry(0.05, 0.085, 1, 10, 1);

  /* ═════════════════ THÂN (ống động) ═════════════════ */

  const rad = new Float32Array(R + 1);
  for (let i = 0; i <= R; i++) rad[i] = profileRadius(i / R);
  for (let pass = 0; pass < 3; pass++) {
    const c = rad.slice();
    for (let i = 1; i < R; i++) rad[i] = (c[i - 1] + 2 * c[i] + c[i + 1]) / 4;
  }

  const vCount = (R + 1) * (N + 1);
  const bPos = new Float32Array(vCount * 3);
  const bNor = new Float32Array(vCount * 3);
  const bCol = new Float32Array(vCount * 3);
  const bUv = new Float32Array(vCount * 2);
  const bIdx = new Uint16Array(R * N * 6);
  const COS = new Float32Array(N + 1);
  const SIN = new Float32Array(N + 1);
  for (let j = 0; j <= N; j++) {
    COS[j] = Math.cos((j / N) * TAU);
    SIN[j] = Math.sin((j / N) * TAU);
  }

  {
    const cTop = new THREE.Color(cTopHex);
    const cSide = new THREE.Color(cSideHex);
    const cBelly = new THREE.Color(cBellyHex);
    const c = new THREE.Color();
    for (let i = 0; i <= R; i++) {
      const s = i / R;
      for (let j = 0; j <= N; j++) {
        const sn = SIN[j];
        const top = smooth(0.35, 0.95, sn);
        const belly = smooth(-0.3, -0.8, sn) * (1 - smooth(0.82, 0.97, s)) * smooth(0.0, 0.05, s);
        c.lerpColors(cSide, cTop, top).lerp(cBelly, belly);
        c.multiplyScalar(1 - 0.07 * (i & 1) * belly);
        const k = i * (N + 1) + j;
        bCol[k * 3] = c.r;
        bCol[k * 3 + 1] = c.g;
        bCol[k * 3 + 2] = c.b;
        bUv[k * 2] = (j / N) * 5;
        bUv[k * 2 + 1] = (s * LEN) / 0.5;
      }
    }
    let w = 0;
    for (let i = 0; i < R; i++) {
      for (let j = 0; j < N; j++) {
        const a = i * (N + 1) + j;
        const b = (i + 1) * (N + 1) + j;
        const cc = a + 1;
        const d = b + 1;
        bIdx[w++] = a;
        bIdx[w++] = cc;
        bIdx[w++] = b;
        bIdx[w++] = cc;
        bIdx[w++] = d;
        bIdx[w++] = b;
      }
    }
  }

  const bodyGeo = new THREE.BufferGeometry();
  const bPosAttr = new THREE.BufferAttribute(bPos, 3);
  const bNorAttr = new THREE.BufferAttribute(bNor, 3);
  bPosAttr.setUsage(THREE.DynamicDrawUsage);
  bNorAttr.setUsage(THREE.DynamicDrawUsage);
  bodyGeo.setAttribute('position', bPosAttr);
  bodyGeo.setAttribute('normal', bNorAttr);
  bodyGeo.setAttribute('color', new THREE.BufferAttribute(bCol, 3));
  bodyGeo.setAttribute('uv', new THREE.BufferAttribute(bUv, 2));
  bodyGeo.setIndex(new THREE.BufferAttribute(bIdx, 1));
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.name = 'DragonBody';
  body.frustumCulled = false;
  group.add(body);

  const P = new THREE.Vector3();
  const T = new THREE.Vector3();
  const S = new THREE.Vector3();
  const U = new THREE.Vector3();

  let moveIntensity = 1.0;

  function updateBody(t) {
    const ry = 0.92;
    for (let i = 0; i <= R; i++) {
      frameAt(i / R, t, P, T, S, U, moveIntensity);
      const r = rad[i];
      for (let j = 0; j <= N; j++) {
        const c = COS[j];
        const sn = SIN[j];
        const ex = c * r;
        const ey = sn * r * ry;
        const k = (i * (N + 1) + j) * 3;
        bPos[k] = P.x + S.x * ex + U.x * ey;
        bPos[k + 1] = P.y + S.y * ex + U.y * ey;
        bPos[k + 2] = P.z + S.z * ex + U.z * ey;
        const nsn = sn / ry;
        const il = 1 / Math.hypot(c, nsn);
        bNor[k] = (S.x * c + U.x * nsn) * il;
        bNor[k + 1] = (S.y * c + U.y * nsn) * il;
        bNor[k + 2] = (S.z * c + U.z * nsn) * il;
      }
    }
    bPosAttr.needsUpdate = true;
    bNorAttr.needsUpdate = true;
  }

  /* ═════════════════ VÂY LƯNG + LỬA ĐUÔI (1 InstancedMesh) ═════════════════ */

  const DORSAL = quality === 'low' ? 44 : 72;
  const FAN = 14;
  const finCount = DORSAL + FAN;
  const fins = new THREE.InstancedMesh(bladeGeo, finMat, finCount);
  fins.frustumCulled = false;
  {
    const yellows = [0xf6c41a, 0xffd23c, 0xf2b705, 0xffdc55];
    const col = new THREE.Color();
    for (let i = 0; i < finCount; i++) {
      fins.setColorAt(i, col.setHex(yellows[Math.floor(rand() * yellows.length)]));
    }
    fins.instanceColor.needsUpdate = true;
  }
  const finPhase = Float32Array.from({ length: finCount }, () => rand() * TAU);
  const _dir = new THREE.Vector3();
  const _base = new THREE.Vector3();

  function updateFins(t) {
    for (let k = 0; k < DORSAL; k++) {
      const s = 0.035 + 0.96 * (k / (DORSAL - 1));
      frameAt(s, t, P, T, S, U, moveIntensity);
      const r = profileRadius(s);
      const tailW = smooth(0.7, 1.0, s);
      const lean = (0.55 + 0.3 * tailW * Math.sin(t * 3 + finPhase[k] + s * 9)) * (0.3 + 0.7 * moveIntensity);
      _dir.copy(U).addScaledVector(T, lean).normalize();
      _base.copy(P).addScaledVector(U, r * 0.84);
      const h =
        0.2 + 0.42 * Math.exp(-(((s - 0.06) / 0.07) ** 2)) + 0.25 * smooth(0.55, 0.95, s) + 0.9 * smooth(0.93, 1.0, s);
      const w = 0.11 + 0.05 * smooth(0.85, 1, s);
      setBlade(fins, k, _base, S, _dir, h, w, 0.035);
    }
    frameAt(1, t, P, T, S, U, moveIntensity);
    for (let k = 0; k < FAN; k++) {
      const a = (k / (FAN - 1) - 0.5) * 2.3;
      const sway = 0.25 * Math.sin(t * 2.4 + k * 0.9) * (0.2 + 0.8 * moveIntensity);
      _dir
        .set(0, 0, 0)
        .addScaledVector(T, Math.cos(a) * 0.9)
        .addScaledVector(U, Math.sin(a) * 0.9 + 0.12)
        .addScaledVector(S, sway)
        .normalize();
      _base.copy(P).addScaledVector(T, -0.1);
      const len = 0.75 + 0.7 * Math.cos(a * 0.8) + 0.12 * Math.sin(t * 4 + k);
      setBlade(fins, DORSAL + k, _base, S, _dir, len, 0.1, 0.03);
    }
    fins.instanceMatrix.needsUpdate = true;
  }
  group.add(fins);

  /* ═════════════════ LỬA HÔNG (vai + đùi) ═════════════════ */

  const FLAME_SPOTS = [0.27, 0.66];
  const TUFTS = 5;
  const flameCount = FLAME_SPOTS.length * 2 * TUFTS;
  const sideFlames = new THREE.InstancedMesh(bladeGeo, flameMat, flameCount);
  sideFlames.frustumCulled = false;
  {
    const palette = [0xd8321a, 0xff6a1a, 0xff9a24, 0xffc23a];
    const col = new THREE.Color();
    for (let i = 0; i < flameCount; i++) {
      sideFlames.setColorAt(i, col.setHex(palette[i % palette.length]).multiplyScalar(1.5));
    }
    sideFlames.instanceColor.needsUpdate = true;
  }

  function updateSideFlames(t) {
    let n = 0;
    for (const spot of FLAME_SPOTS) {
      for (const side of [-1, 1]) {
        for (let k = 0; k < TUFTS; k++) {
          const s = spot + (k - (TUFTS - 1) / 2) * 0.014;
          frameAt(s, t, P, T, S, U, moveIntensity);
          const r = profileRadius(s);
          _base.copy(P).addScaledVector(S, side * r * 0.95).addScaledVector(U, r * 0.08);
          _dir.copy(U).multiplyScalar(0.9).addScaledVector(T, 0.7).addScaledVector(S, side * 0.35);
          const flick = 0.8 + 0.25 * Math.sin(t * 9 + n * 1.7);
          const h = (0.42 + 0.14 * (k % 3)) * flick;
          setBlade(sideFlames, n, _base, S, _dir, h, 0.09, 0.03);
          n++;
        }
      }
    }
    sideFlames.instanceMatrix.needsUpdate = true;
  }
  group.add(sideFlames);

  /* ═════════════════ ĐẦU ═════════════════ */

  const head = new THREE.Group();
  head.name = 'DragonHead';

  const skull = new THREE.Mesh(unitSphere, skinMat);
  skull.scale.set(0.44, 0.38, 0.52);
  head.add(skull);

  const snout = new THREE.Mesh(unitSphere, skinMat);
  snout.scale.set(0.3, 0.2, 0.42);
  snout.position.set(0, -0.08, 0.5);
  head.add(snout);

  const palate = new THREE.Mesh(unitSphere, mouthMat);
  palate.scale.set(0.2, 0.03, 0.34);
  palate.position.set(0, -0.285, 0.5);
  head.add(palate);

  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(unitSphere, eyeMat);
    eye.scale.setScalar(0.075);
    eye.position.set(sx * 0.25, 0.12, 0.27);
    head.add(eye);
    const pupil = new THREE.Mesh(unitSphere, darkMat);
    pupil.scale.set(0.02, 0.05, 0.035);
    pupil.position.set(sx * 0.315, 0.12, 0.3);
    head.add(pupil);
    const brow = new THREE.Mesh(unitSphere, skinMat);
    brow.scale.set(0.13, 0.05, 0.2);
    brow.position.set(sx * 0.22, 0.205, 0.28);
    brow.rotation.z = -sx * 0.35;
    head.add(brow);
    const nostril = new THREE.Mesh(unitSphere, darkMat);
    nostril.scale.set(0.03, 0.025, 0.035);
    nostril.position.set(sx * 0.085, -0.05, 0.905);
    head.add(nostril);
  }

  // Răng hàm trên
  {
    const specs = [];
    for (const sx of [-1, 1]) {
      for (const x of [0.07, 0.125, 0.175]) {
        for (const z of [0.4, 0.58, 0.75]) {
          const dz = z - 0.5;
          specs.push({ p: [sx * x, -0.27 + 1.5 * x * x + 0.6 * dz * dz, z], dir: [0, -1, 0], s: 1 });
        }
      }
    }
    head.add(staticInstances(toothGeo, ivoryMat, specs));
    const fangs = [];
    for (const sx of [-1, 1]) fangs.push({ p: [sx * 0.2, -0.24, 0.62], dir: [sx * 0.12, -1, 0.1], s: 1 });
    head.add(staticInstances(fangGeo, ivoryMat, fangs));
  }

  // Hàm dưới (xoay quanh khớp)
  const jawPivot = new THREE.Group();
  jawPivot.position.set(0, -0.14, 0.08);
  head.add(jawPivot);
  {
    const jaw = new THREE.Mesh(unitSphere, skinMat);
    jaw.scale.set(0.25, 0.08, 0.4);
    jaw.position.set(0, -0.02, 0.38);
    jawPivot.add(jaw);
    const inner = new THREE.Mesh(unitSphere, mouthMat);
    inner.scale.set(0.22, 0.04, 0.36);
    inner.position.set(0, 0.05, 0.38);
    jawPivot.add(inner);
    const tongue = new THREE.Mesh(unitSphere, tongueMat);
    tongue.scale.set(0.09, 0.03, 0.28);
    tongue.position.set(0, 0.075, 0.36);
    jawPivot.add(tongue);
    const lower = [];
    for (const sx of [-1, 1]) {
      for (const x of [0.08, 0.14]) {
        for (const z of [0.3, 0.5, 0.65]) {
          lower.push({ p: [sx * x, 0.035, z], dir: [0, 1, 0], s: 1 });
        }
      }
    }
    jawPivot.add(staticInstances(toothGeo, ivoryMat, lower));
    const lowerFangs = [];
    for (const sx of [-1, 1]) lowerFangs.push({ p: [sx * 0.15, 0.035, 0.72], dir: [-sx * 0.1, 1, 0.1], s: 0.85 });
    jawPivot.add(staticInstances(fangGeo, ivoryMat, lowerFangs));

    // Râu cằm
    const greens = [0x2f7d46, 0x3f9a4a, 0x5ab35a];
    const beard = [];
    for (let k = 0; k < 7; k++) {
      const x = (k - 3) * 0.045;
      beard.push({ p: [x, -0.08, 0.3 + 0.04 * Math.abs(k - 3)], dir: [x * 2, -0.4, -1], s: [0.05, 0.22 + 0.05 * rand(), 0.05] });
    }
    jawPivot.add(staticInstances(bladeGeo, maneMat, beard, greens));
  }

  // Sừng
  for (const sx of [-1, 1]) {
    const pts = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(sx * 0.05, 0.26, -0.12),
      new THREE.Vector3(sx * 0.13, 0.5, -0.32),
      new THREE.Vector3(sx * 0.22, 0.68, -0.6),
    ];
    const horn = new THREE.Mesh(taperedTube(pts, (u) => lerp(0.075, 0.012, Math.pow(u, 0.8)), 14, 8), ivoryMat);
    horn.position.set(sx * 0.18, 0.28, -0.02);
    head.add(horn);
  }

  // Râu mép (lắc nhẹ)
  const whiskers = [];
  for (const sx of [-1, 1]) {
    const pts = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(sx * 0.3, 0.06, 0.12),
      new THREE.Vector3(sx * 0.7, -0.05, -0.1),
      new THREE.Vector3(sx * 1.05, -0.25, -0.55),
      new THREE.Vector3(sx * 1.3, -0.5, -1.1),
    ];
    const w = new THREE.Mesh(taperedTube(pts, (u) => lerp(0.016, 0.004, u), 24, 6), whiskerMat);
    const holder = new THREE.Group();
    holder.position.set(sx * 0.17, -0.05, 0.82);
    holder.add(w);
    head.add(holder);
    whiskers.push({ holder, sx });
  }

  // Bờm sau đầu
  {
    const specs = [];
    const colors = [];
    const greens = [0x2c7440, 0x3a9148, 0x4fae55, 0x7bc45a];
    for (let row = 0; row < 3; row++) {
      const count = 11 + row * 2;
      for (let k = 0; k < count; k++) {
        const th = lerp(-2.3, 2.3, k / (count - 1));
        const x = Math.sin(th) * 0.38;
        const y = Math.cos(th) * 0.33;
        const z = -0.1 - row * 0.18;
        const len = 0.32 + 0.1 * row + 0.12 * rand();
        specs.push({
          p: [x, y, z],
          dir: [x * 1.4, y * 1.4, -1],
          s: [0.06, len, 0.06],
        });
        colors.push(greens[Math.floor(rand() * greens.length)]);
      }
    }
    head.add(staticInstances(bladeGeo, maneMat, specs, colors));
  }
  group.add(head);

  /* ═════════════════ CHÂN (IK 2 xương + bước chân) ═════════════════ */

  const LEG_DEFS = [
    { s: 0.215, side: 1, zBias: 0.25, front: true },
    { s: 0.215, side: -1, zBias: 0.25, front: true },
    { s: 0.6, side: 1, zBias: 0.1, front: false },
    { s: 0.6, side: -1, zBias: 0.1, front: false },
  ];
  const L1 = 0.5;
  const L2 = 0.5;
  const ANKLE = 0.07;
  const STEP_DIST_SQ = 0.32 * 0.32;
  const STEP_TIME = 0.4;
  const STEP_LIFT = 0.22;

  const legs = LEG_DEFS.map((d, i) => {
    const hip = new THREE.Mesh(unitSphere, skinMat);
    hip.scale.set(0.16, 0.16, 0.16);
    const upper = new THREE.Mesh(upperLegGeo, skinMat);
    const lower = new THREE.Mesh(lowerLegGeo, skinMat);
    const knee = new THREE.Mesh(unitSphere, skinMat);
    knee.scale.setScalar(0.095);
    const foot = new THREE.Group();
    const pad = new THREE.Mesh(unitSphere, skinMat);
    pad.scale.set(0.13, 0.055, 0.19);
    pad.position.set(0, 0.03, 0.05);
    foot.add(pad);
    const claws = [];
    for (const x of [-0.07, 0, 0.07]) claws.push({ p: [x, 0.03, 0.15], dir: [x * 4, -0.4, 1], s: 1 });
    claws.push({ p: [-d.side * 0.09, 0.05, -0.04], dir: [-d.side * 1, -0.3, -0.7], s: 0.8 });
    foot.add(staticInstances(clawGeo, ivoryMat, claws));
    foot.rotation.y = -d.side * 0.2;
    group.add(hip, upper, lower, knee, foot);
    return {
      ...d,
      hip,
      upper,
      lower,
      knee,
      foot,
      pos: new THREE.Vector3(),
      from: new THREE.Vector3(),
      to: new THREE.Vector3(),
      k: 0,
      stepping: false,
      init: false,
      phase: i,
    };
  });

  const _H = new THREE.Vector3();
  const _K = new THREE.Vector3();
  const _A = new THREE.Vector3();
  const _D = new THREE.Vector3();
  const _PP = new THREE.Vector3();
  const _pole = new THREE.Vector3();
  const _rest = new THREE.Vector3();

  function placeLimb(mesh, a, b) {
    _D.subVectors(b, a);
    const len = _D.length() || 1e-6;
    mesh.position.addVectors(a, b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(UP, _D.multiplyScalar(1 / len));
    mesh.scale.set(1, len, 1);
  }

  function updateLegs(t, dt) {
    for (const leg of legs) {
      frameAt(leg.s, t, P, T, S, U);
      const r = profileRadius(leg.s);
      _H.copy(P);
      _H.x += leg.side * r * 0.8;
      _H.addScaledVector(U, -r * 0.3);
      _rest.set(P.x + leg.side * 0.8, GROUND, P.z + leg.zBias);

      if (!leg.init) {
        leg.pos.copy(_rest);
        leg.init = true;
      }
      if (!leg.stepping) {
        const dx = leg.pos.x - _rest.x;
        const dz = leg.pos.z - _rest.z;
        if (dx * dx + dz * dz > STEP_DIST_SQ) {
          leg.from.copy(leg.pos);
          leg.to.copy(_rest);
          leg.k = 0;
          leg.stepping = true;
        }
      }
      if (leg.stepping) {
        leg.k = Math.min(leg.k + dt / STEP_TIME, 1);
        leg.pos.lerpVectors(leg.from, leg.to, leg.k);
        leg.pos.y = GROUND + Math.sin(leg.k * Math.PI) * STEP_LIFT;
        if (leg.k >= 1) leg.stepping = false;
      }

      // IK
      _A.copy(leg.pos);
      _A.y += ANKLE;
      _D.subVectors(_A, _H);
      const dist = _D.length() || 1e-6;
      const dc = clamp(dist, Math.abs(L1 - L2) + 1e-3, L1 + L2 - 1e-3);
      _D.multiplyScalar(1 / dist);
      const a = (L1 * L1 - L2 * L2 + dc * dc) / (2 * dc);
      const h = Math.sqrt(Math.max(L1 * L1 - a * a, 0));
      _pole.set(leg.side, 0.7, 0).addScaledVector(T, leg.front ? 0.3 : -0.3);
      _PP.copy(_pole).addScaledVector(_D, -_pole.dot(_D));
      if (_PP.lengthSq() < 1e-6) _PP.set(leg.side, 1, 0);
      _PP.normalize();
      _K.copy(_H).addScaledVector(_D, a).addScaledVector(_PP, h);
      _A.copy(_H).addScaledVector(_D, dc);

      leg.hip.position.copy(_H);
      leg.knee.position.copy(_K);
      leg.foot.position.copy(leg.pos);
      placeLimb(leg.upper, _H, _K);
      placeLimb(leg.lower, _K, _A);
    }
  }

  /* ═════════════════ NGỌC RỒNG ═════════════════ */

  const pearl = new THREE.Group();
  pearl.name = 'DragonPearl';
  const orb = new THREE.Mesh(unitSphere, pearlMat);
  orb.scale.setScalar(0.2);
  pearl.add(orb);
  const swirl = new THREE.Group();
  {
    const specs = [];
    const colors = [0xff7a1a, 0xffa42a, 0xffcf4a, 0xe83a14];
    const n = 10;
    for (let k = 0; k < n; k++) {
      const y = 1 - (2 * (k + 0.5)) / n;
      const rr = Math.sqrt(1 - y * y);
      const th = k * 2.399963;
      const pnt = new THREE.Vector3(Math.cos(th) * rr, y, Math.sin(th) * rr);
      const tang = new THREE.Vector3().crossVectors(pnt, UP).addScaledVector(UP, 0.3);
      const dir = pnt.clone().multiplyScalar(0.6).add(tang.multiplyScalar(0.8));
      specs.push({
        p: [pnt.x * 0.18, pnt.y * 0.18, pnt.z * 0.18],
        dir: [dir.x, dir.y, dir.z],
        s: [0.07, 0.3 + 0.08 * (k % 3), 0.07],
      });
    }
    const flames = staticInstances(bladeGeo, flameMat, specs);
    const col = new THREE.Color();
    for (let k = 0; k < n; k++) flames.setColorAt(k, col.setHex(colors[k % colors.length]).multiplyScalar(1.6));
    flames.instanceColor.needsUpdate = true;
    swirl.add(flames);
  }
  pearl.add(swirl);
  let light = null;
  if (pearlLight) {
    light = new THREE.PointLight(0xff7a30, 6, 9, 2);
    pearl.add(light);
  }
  group.add(pearl);

  /* ═════════════════ ANIMATION ═════════════════ */

  let time = 0;
  const _f = new THREE.Vector3();
  const _r = new THREE.Vector3();
  const _u = new THREE.Vector3();
  const _hm = new THREE.Matrix4();

  function updateHead(t) {
    frameAt(0, t, P, T, S, U, moveIntensity);
    _f.set(-T.x * 0.8 + 0.14 * Math.sin(t * 0.45) * moveIntensity, -0.08 + 0.05 * Math.sin(t * 0.9 + 0.5) * moveIntensity, 1).normalize();
    _r.crossVectors(UP, _f).normalize();
    _u.crossVectors(_f, _r);
    _hm.makeBasis(_r, _u, _f);
    head.quaternion.setFromRotationMatrix(_hm);
    head.position.copy(P).addScaledVector(_f, 0.28);
    head.position.y += 0.04;

    jawPivot.rotation.x = 0.34 + (0.12 * Math.sin(t * 1.4) + 0.06 * Math.sin(t * 3.1)) * (0.2 + 0.8 * moveIntensity);
    for (const w of whiskers) {
      w.holder.rotation.y = w.sx * 0.06 * Math.sin(t * 1.7 + w.sx) * (0.3 + 0.7 * moveIntensity);
      w.holder.rotation.z = 0.05 * Math.sin(t * 1.3 + w.sx * 2) * (0.3 + 0.7 * moveIntensity);
    }

    pearl.position.copy(head.position).addScaledVector(_f, 1.55);
    pearl.position.y += 0.1 + 0.08 * Math.sin(t * 1.3);
    swirl.rotation.y = t * 1.2;
    swirl.scale.setScalar(1 + 0.08 * Math.sin(t * 7));
    pearlMat.emissiveIntensity = 1.5 + 0.25 * Math.sin(t * 5);
  }

  function update(dt = 0, speed = 1.0) {
    dt = clamp(dt, 0, 0.1);
    // Smoothly interpolate moveIntensity towards target speed (0 = idle, 1.5 = moving fast)
    moveIntensity += (speed - moveIntensity) * Math.min(1, dt * 6);
    time += dt * (0.4 + 0.9 * moveIntensity);
    updateBody(time);
    updateFins(time);
    updateSideFlames(time);
    updateHead(time);
    updateLegs(time, dt);
  }
  update(0);

  group.traverse((o) => {
    if (!o.isMesh) return;
    const emissiveOnly = o.material === flameMat || o.material === pearlMat;
    o.castShadow = castShadow && !emissiveOnly;
    o.receiveShadow = !emissiveOnly;
  });

  function dispose() {
    const mats = new Set();
    group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.isInstancedMesh) o.dispose();
      if (o.material) mats.add(o.material);
    });
    mats.forEach((m) => m.dispose());
    scaleTex.dispose();
    headTex.dispose();
    if (light) light.dispose?.();
    group.removeFromParent();
  }

  const mountPoint = new THREE.Object3D();
  mountPoint.name = 'DragonMountPoint';
  mountPoint.position.set(0, 0.45, -0.6);
  head.add(mountPoint);

  return { group, update, dispose, head, pearl, mountPoint };
}