import * as THREE from 'three';

// Trường đua vịt cao su – đường đua nước dạng vòng quanh đảo giữa.
// Dùng: const derby = createDuckDerby(); scene.add(derby); mỗi frame: derby.userData.update(timeSeconds);
const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, metalness: 0.05, ...o });

function rrect(w, d, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -d / 2, P = Math.PI;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.absarc(x + w - r, y + r, r, -P / 2, 0, false);
  s.lineTo(x + w, y + d - r); s.absarc(x + w - r, y + d - r, r, 0, P / 2, false);
  s.lineTo(x + r, y + d); s.absarc(x + r, y + d - r, r, P / 2, P, false);
  s.lineTo(x, y + r); s.absarc(x + r, y + r, r, P, P * 1.5, false);
  return s;
}
function flat(shape, depth, material, y = 0, bevel = 0) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1, curveSegments: 16 });
  g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, material); m.position.y = y; m.castShadow = m.receiveShadow = true;
  return m;
}
function textTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t;
}

// ---- đường đua: tâm kênh (nửa rộng a, nửa sâu b, bán kính góc r) ----
const A = 4.2, B = 1.7, R = 1.0;
const SEG = [
  { len: 2 * (A - R), at: (u) => ({ x: A - R - u, z: B, dx: -1, dz: 0 }) },
  { len: Math.PI * R / 2, at: (u) => arc(-(A - R), B - R, Math.PI / 2, u) },
  { len: 2 * (B - R), at: (u) => ({ x: -A, z: B - R - u, dx: 0, dz: -1 }) },
  { len: Math.PI * R / 2, at: (u) => arc(-(A - R), -(B - R), Math.PI, u) },
  { len: 2 * (A - R), at: (u) => ({ x: -(A - R) + u, z: -B, dx: 1, dz: 0 }) },
  { len: Math.PI * R / 2, at: (u) => arc(A - R, -(B - R), Math.PI * 1.5, u) },
  { len: 2 * (B - R), at: (u) => ({ x: A, z: -(B - R) + u, dx: 0, dz: 1 }) },
  { len: Math.PI * R / 2, at: (u) => arc(A - R, B - R, 0, u) },
];
function arc(cx, cz, t0, u) {
  const t = t0 + u / R;
  return { x: cx + R * Math.cos(t), z: cz + R * Math.sin(t), dx: -Math.sin(t), dz: Math.cos(t) };
}
const LOOP = SEG.reduce((s, g) => s + g.len, 0);
function pathAt(s) {
  s = ((s % LOOP) + LOOP) % LOOP;
  for (const g of SEG) { if (s <= g.len) return g.at(s); s -= g.len; }
  return SEG[0].at(0);
}

function makeDuck(color, num) {
  const g = new THREE.Group(), body = mat(color, { roughness: 0.45 }), orange = mat(0xff8a1f), black = mat(0x111111);
  const add = (geo, m, p, sc, rot) => {
    const o = new THREE.Mesh(geo, m); o.position.set(...p);
    if (sc) o.scale.set(...sc); if (rot) o.rotation.set(...rot);
    o.castShadow = true; g.add(o); return o;
  };
  const sph = new THREE.SphereGeometry(1, 20, 14);
  add(sph, body, [0, 0.3, 0], [0.4, 0.3, 0.32]);
  add(sph, body, [0.3, 0.62, 0], [0.2, 0.2, 0.2]);
  add(sph, orange, [0.5, 0.57, 0], [0.13, 0.04, 0.1]);
  add(sph, orange, [0.49, 0.53, 0], [0.11, 0.03, 0.09]);
  add(sph, black, [0.42, 0.68, 0.1], [0.035, 0.035, 0.035]);
  add(sph, black, [0.42, 0.68, -0.1], [0.035, 0.035, 0.035]);
  add(sph, body, [-0.04, 0.34, 0.28], [0.22, 0.14, 0.05], [0, 0.15, 0]);
  add(sph, body, [-0.04, 0.34, -0.28], [0.22, 0.14, 0.05], [0, -0.15, 0]);
  add(new THREE.ConeGeometry(0.1, 0.25, 10), body, [-0.42, 0.42, 0], null, [0, 0, Math.PI / 2 + 0.5]);
  const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: textTex(64, 64, (c) => {
    c.fillStyle = '#1b1b1b'; c.fillRect(0, 0, 64, 64); c.fillStyle = '#fff'; c.font = 'bold 40px sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('#' + num, 32, 34);
  }) }));
  tag.scale.set(0.3, 0.3, 1); tag.position.set(0, 1.0, 0); g.add(tag);
  return g;
}

export function createDuckDerby() {
  const root = new THREE.Group(); root.name = 'DuckDerby';
  const W = 12, D = 7, H = 1.0;

  // thân + khung (khoét kênh vòng)
  const frame = rrect(W, D, 0.6); frame.holes.push(rrect(10.4, 5.4, 1.2));
  root.add(flat(frame, H, mat(0x8a4a22), 0, 0.04));
  // đáy kênh + đảo giữa
  root.add(flat(rrect(10.4, 5.4, 1.2), 0.35, mat(0x3a5a6a), 0));
  root.add(flat(rrect(6.4, 1.4, 0.4), H, mat(0xa65d2a), 0, 0.04));
  // viền trên
  const trim = rrect(W, D, 0.6); trim.holes.push(rrect(10.4, 5.4, 1.2));
  root.add(flat(trim, 0.05, mat(0xc27a3a), H + 0.04));

  // nước (ring)
  const wShape = rrect(10.4, 5.4, 1.2); wShape.holes.push(rrect(6.4, 1.4, 0.4));
  const wTex = textTex(256, 256, (c, w, h) => {
    const gr = c.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#3aa7e0'); gr.addColorStop(1, '#6fd0f0');
    c.fillStyle = gr; c.fillRect(0, 0, w, h); c.strokeStyle = 'rgba(255,255,255,.45)'; c.lineWidth = 3;
    for (let i = 0; i < 8; i++) { c.beginPath(); for (let x = 0; x <= w; x += 8) c.lineTo(x, i * 32 + 16 + Math.sin(x / 20 + i) * 6); c.stroke(); }
  });
  wTex.wrapS = wTex.wrapT = THREE.RepeatWrapping; wTex.repeat.set(0.25, 0.25);
  const water = new THREE.Mesh(new THREE.ShapeGeometry(wShape, 24), new THREE.MeshStandardMaterial({ map: wTex, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.92 }));
  water.rotation.x = -Math.PI / 2; water.position.y = 0.72; root.add(water);

  // vạch xuất phát (caro) trên làn trước
  const chk = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 2), new THREE.MeshBasicMaterial({ map: textTex(32, 128, (c) => {
    for (let i = 0; i < 8; i++) for (let j = 0; j < 2; j++) { c.fillStyle = (i + j) % 2 ? '#111' : '#fff'; c.fillRect(j * 16, i * 16, 16, 16); }
  }), transparent: true, opacity: 0.9 }));
  chk.rotation.x = -Math.PI / 2; chk.position.set(1.6, 0.74, B); root.add(chk);

  // cổng + bảng hiệu
  const wood = mat(0x9a5a2a);
  [-4.4, 4.4].forEach((x) => {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 3.4, 12), wood);
    p.position.set(x, H + 1.7, -3.1); p.castShadow = true; root.add(p);
  });
  const boardTex = textTex(1024, 160, (c, w, h) => {
    c.fillStyle = '#b8742f'; c.fillRect(0, 0, w, h); c.strokeStyle = '#f0c060'; c.lineWidth = 8; c.strokeRect(6, 6, w - 12, h - 12);
    c.fillStyle = '#fff3d0'; c.font = 'bold 70px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('🐤 TRƯỜNG ĐUA VỊT CAO SU', w / 2, h / 2 + 4);
  });
  const faces = [wood, wood, wood, wood, new THREE.MeshStandardMaterial({ map: boardTex }), wood];
  const board = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.95, 0.15), faces);
  board.position.set(0, H + 2.7, -3.1); board.castShadow = true; root.add(board);
  const bannerTex = textTex(512, 80, (c, w, h) => {
    c.fillStyle = '#2f6fb0'; c.fillRect(0, 0, w, h); c.strokeStyle = '#bfe0ff'; c.lineWidth = 5; c.strokeRect(4, 4, w - 8, h - 8);
    c.fillStyle = '#fff'; c.font = 'bold 40px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('XUẤT PHÁT · START', w / 2, h / 2 + 2);
  });
  const bf = [wood, wood, wood, wood, new THREE.MeshStandardMaterial({ map: bannerTex }), wood];
  const banner = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.45, 0.12), bf);
  banner.position.set(0, H + 3.45, -3.1); root.add(banner);
  [-3.9, 3.9].forEach((x) => { // trang trí đầu bảng
    const c = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.07, 8, 16, Math.PI * 1.5), mat(0xd8641e));
    c.position.set(x, H + 3.2, -3.1); c.rotation.z = x < 0 ? 0.3 : Math.PI - 0.3; root.add(c);
  });

  // 2 đĩa trước (giữ lại), đã bỏ mũ + đốm sáng tím
  [-4.2, 4.2].forEach((x) => {
    const d = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.12, 24), mat(0x2b1d14)); d.position.set(x, 0.06, 4.4); d.receiveShadow = true;
    const r = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.05, 8, 24), mat(0xb5651d)); r.rotation.x = Math.PI / 2; r.position.y = 0.13; d.add(r);
    root.add(d);
  });

  // 4 chú vịt
  const colors = [0xffd21f, 0xe0338a, 0x1fb37a, 0x8a4fd1];
  const ducks = colors.map((c, i) => {
    const d = makeDuck(c, i + 1);
    d.userData = { s0: 3.2 - 1.6 - i * 0.62 + 1.6, lane: i % 2 ? -0.38 : 0.38, v: 0.9 + i * 0.07, ph: i * 1.7 };
    root.add(d); return d;
  });
  const place = (d, s, t) => {
    const p = pathAt(s);
    d.position.set(p.x - p.dz * d.userData.lane, 0.6 + Math.sin(t * 2.2 + d.userData.ph) * 0.03, p.z + p.dx * d.userData.lane);
    d.rotation.y = Math.atan2(-p.dz, p.dx);
    d.rotation.z = Math.sin(t * 2.2 + d.userData.ph) * 0.04;
  };
  ducks.forEach((d) => place(d, d.userData.s0 + 1.6, 0));

  root.userData.racing = false;
  let raceStartedAt = 0, lastRaceTime = 0, wasRacing = false;
  root.userData.update = (t) => {
    wTex.offset.set(t * 0.02, t * 0.01);
    const racing = root.userData.racing;
    if (racing && !wasRacing) raceStartedAt = t;
    if (!racing && wasRacing) lastRaceTime = Math.max(0, t - raceStartedAt);
    const raceTime = racing ? t - raceStartedAt : lastRaceTime;
    wasRacing = racing;
    ducks.forEach((d) => {
      const u = d.userData;
      const s = u.s0 + 1.6 + raceTime * u.v + (racing ? Math.sin(t * 0.7 + u.ph) * 0.6 : 0);
      place(d, s, t);
    });
  };
  root.userData.update(0);
  root.traverse((o) => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
  return root;
}
