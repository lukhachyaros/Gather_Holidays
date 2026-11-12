// plinko.js — Mô hình 3D bàn Plinko (three.js, procedural, không cần file ngoài)
// Dùng: import * as THREE from 'three';
//       import { createPlinkoTable } from './plinko.js';
//       const plinko = createPlinkoTable(THREE, { onScore:(v)=>console.log(v) });
//       scene.add(plinko); plinko.position.set(x,0,z);
//       // trong vòng lặp: plinko.userData.update(dt, performance.now()/1000);
//       // thả xu: plinko.userData.drop();
export function createPlinkoTable(THREE, opts = {}) {
  const o = Object.assign({ tilt: 12, title: 'PLINKO', onScore: null, slotCount: 20 }, opts);
  const NS = o.slotCount;
  const PAL = ['#f4f4f4', '#2a6fd6', '#27a98f', '#2fae4a', '#9ccb2a', '#f2c316', '#f2a516', '#f08a1c', '#e8451f', '#e0262b'];
  const SLOTS = [];
  for (let i = 0; i < NS; i++) {
    const d = NS === 1 ? 0 : Math.abs(i - (NS - 1) / 2) / ((NS - 1) / 2); // 0 giữa -> 1 mép
    SLOTS.push({ v: Math.round(100 * Math.pow(d, 1.3) / 10) * 10, c: PAL[Math.round(d * (PAL.length - 1))] });
  }
  const root = new THREE.Group();
  root.name = 'PlinkoTable';

  const mat = (c, r = 0.55, m = 0.1, extra = {}) =>
    new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: r, metalness: m }, extra));
  const box = (w, h, d, m, x, y, z, parent = root) => {
    const k = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    k.position.set(x, y, z); parent.add(k); return k;
  };
  const tex = (w, h, draw) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.anisotropy = 4;
    if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const rainbow = ['#ff3b3b', '#ff9f1c', '#ffe14d', '#3ddc6f', '#33c9ff', '#b36bff'];

  // ---------- Thân máy ----------
  const BW = 1.3, BD = 0.85, BH = 0.72;
  const dark = mat(0x2b2e35, 0.7, 0.2);
  box(BW, BH, BD, dark, 0, BH / 2, 0);

  const sideTex = tex(512, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h);
    gr.addColorStop(0, '#8a2be2'); gr.addColorStop(1, '#2a0f55');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 50; i++) {
      g.fillStyle = rainbow[i % 6]; g.beginPath();
      g.arc(Math.random() * w, Math.random() * h, 2 + Math.random() * 4, 0, 7); g.fill();
    }
    g.font = 'bold 110px "Arial Black", Impact, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 12; g.strokeStyle = '#3b1270'; g.strokeText(o.title, w / 2, h / 2);
    g.fillStyle = '#ffd23f'; g.fillText(o.title, w / 2, h / 2);
  });
  [-1, 1].forEach((s) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(BD - 0.06, BH - 0.1),
      new THREE.MeshStandardMaterial({ map: sideTex, roughness: 0.5 }));
    p.position.set(s * (BW / 2 + 0.002), BH / 2, 0);
    p.rotation.y = s * Math.PI / 2; root.add(p);
  });

  // Mặt trước: cửa, khay trả xu, cụm đếm
  box(0.5, 0.5, 0.02, mat(0x353943, 0.6, 0.2), -0.45, 0.35, BD / 2 + 0.005);
  box(0.36, 0.2, 0.06, mat(0x0c0d10, 0.9, 0), 0.0, 0.22, BD / 2);
  box(0.34, 0.03, 0.14, mat(0x1c1f26, 0.5, 0.4), 0.0, 0.14, BD / 2 + 0.05);
  box(0.12, 0.26, 0.02, mat(0x1a1c22, 0.6, 0.3), 0.36, 0.38, BD / 2 + 0.01);
  box(0.06, 0.03, 0.02, mat(0xff2222, 0.4, 0, { emissive: 0xff0000, emissiveIntensity: 0.45 }), 0.36, 0.46, BD / 2 + 0.025);
  box(0.06, 0.03, 0.02, mat(0xff2222, 0.4, 0, { emissive: 0xff0000, emissiveIntensity: 0.45 }), 0.36, 0.40, BD / 2 + 0.025);
  box(0.05, 0.015, 0.02, mat(0x000000), 0.36, 0.30, BD / 2 + 0.025);

  // Chi tiết thân: viền kim loại, ron chân, tay nắm, khe thoáng, ổ khoá, chân cao su
  const chrome = mat(0xb9bec8, 0.25, 0.9);
  box(BW + 0.012, 0.012, BD + 0.012, mat(0xd9a93a, 0.3, 0.8), 0, 0.075, 0);
  box(BW + 0.012, 0.012, BD + 0.012, mat(0xd9a93a, 0.3, 0.8), 0, BH - 0.015, 0);
  box(BW - 0.04, 0.06, BD - 0.04, mat(0x0d0e11, 0.9, 0), 0, 0.03, 0);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => {
    const f = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.03, 12), mat(0x111111, 0.9, 0));
    f.position.set(a * (BW / 2 - 0.06), 0.015, b * (BD / 2 - 0.06)); root.add(f);
  });
  for (let i = 0; i < 6; i++) box(0.34, 0.008, 0.01, mat(0x0a0a0c, 0.9, 0), -0.45, 0.52 + i * 0.016, BD / 2 + 0.018);
  box(0.02, 0.16, 0.03, chrome, -0.22, 0.33, BD / 2 + 0.03);
  const lock = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.012, 16), chrome);
  lock.rotation.x = Math.PI / 2; lock.position.set(-0.28, 0.16, BD / 2 + 0.02); root.add(lock);
  [[-0.69, 0.1], [-0.2, 0.1], [-0.69, 0.58], [-0.2, 0.58]].forEach(([x, y]) => {
    const sc = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.006, 8), chrome);
    sc.rotation.x = Math.PI / 2; sc.position.set(x + 0.22, y, BD / 2 + 0.017); root.add(sc);
  });
  // Mặt bàn điều khiển + viền neon
  const DECK_Y = BH + 0.05;
  box(BW + 0.04, 0.05, BD + 0.04, mat(0x3a2a5c, 0.4, 0.3), 0, BH + 0.025, 0);
  const neon = mat(0x46e6ff, 0.3, 0, { emissive: 0x46e6ff, emissiveIntensity: 0.7 });
  box(BW + 0.05, 0.016, 0.02, neon, 0, BH + 0.03, BD / 2 + 0.025);
  box(0.02, 0.016, BD + 0.05, neon, -BW / 2 - 0.025, BH + 0.03, 0);
  box(0.02, 0.016, BD + 0.05, neon, BW / 2 + 0.025, BH + 0.03, 0);
  box(0.36, 0.004, 0.14, mat(0x46e6ff, 0.3, 0, { emissive: 0x46e6ff, emissiveIntensity: 0.35 }), 0, DECK_Y + 0.002, 0.22);
  box(0.32, 0.006, 0.11, mat(0x0a0b0e, 0.8, 0), 0, DECK_Y + 0.004, 0.22);
  const btn = (c, x, z) => {
    const k = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.04, 0.03, 20),
      mat(c, 0.3, 0.1, { emissive: c, emissiveIntensity: 0.25 }));
    k.position.set(x, DECK_Y + 0.015, z); root.add(k);
  };
  const dc = document.createElement('canvas'); dc.width = 256; dc.height = 64;
  const dtex = new THREE.CanvasTexture(dc);
  let total = 0;
  const drawScore = () => {
    const g = dc.getContext('2d');
    g.fillStyle = '#04120a'; g.fillRect(0, 0, 256, 64);
    g.fillStyle = '#38d66b'; g.font = 'bold 18px monospace'; g.textBaseline = 'top'; g.fillText('SCORE', 10, 6);
    g.font = 'bold 36px monospace'; g.textAlign = 'right'; g.fillText(String(total).padStart(5, '0'), 246, 22);
    g.textAlign = 'left'; dtex.needsUpdate = true;
  };
  drawScore();
  const disp = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.055),
    new THREE.MeshStandardMaterial({ map: dtex, emissive: 0xffffff, emissiveMap: dtex, emissiveIntensity: 0.5 }));
  disp.rotation.x = -Math.PI / 2; disp.position.set(0, DECK_Y + 0.008, 0.35); root.add(disp);
  box(0.24, 0.006, 0.075, chrome, 0, DECK_Y + 0.004, 0.35);
  [[-0.5, 0.25], [0.42, 0.28], [0.53, 0.25]].forEach(([x, z]) => {
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.012, 24), chrome);
    ring.position.set(x, DECK_Y + 0.006, z); root.add(ring);
  });
  btn(0xe02020, -0.5, 0.25); btn(0x28c840, 0.42, 0.28); btn(0xf2c316, 0.53, 0.25);

  // ---------- Bảng chơi (nghiêng ra sau) ----------
  const W = 1.1, H = 1.5;
  const board = new THREE.Group();
  board.position.set(0, DECK_Y, -0.25);
  board.rotation.x = -o.tilt * Math.PI / 180;
  root.add(board);

  box(W + 0.3, H + 0.1, 0.22, mat(0x20232a, 0.8, 0.1), 0, H / 2 + 0.05, -0.12, board);
  const backTex = tex(512, 768, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#5f84a0'); gr.addColorStop(1, '#8fb1c8');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = 2;
    for (let i = -h; i < w; i += 48) {
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i + h, h); g.stroke();
      g.beginPath(); g.moveTo(i + h, 0); g.lineTo(i, h); g.stroke();
    }
    const v = g.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.28)');
    g.fillStyle = v; g.fillRect(0, 0, w, h);
  });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(W, H), mat(0xffffff, 0.45, 0, { map: backTex }));
  back.position.set(0, H / 2, 0.001); board.add(back);

  // Khung + đèn LED
  const frame = mat(0x4a2273, 0.4, 0.3);
  const gold = mat(0xd9a93a, 0.3, 0.8);
  [-1, 1].forEach((s) => {
    box(0.1, H + 0.1, 0.1, frame, s * (W / 2 + 0.05), H / 2 + 0.05, 0.03, board);
    box(0.012, H + 0.1, 0.11, gold, s * (W / 2 + 0.1), H / 2 + 0.05, 0.03, board);
    box(0.012, H + 0.1, 0.11, gold, s * (W / 2 + 0.002), H / 2 + 0.05, 0.03, board);
  });
  const NL = 26, N = NL * 2;
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.019, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xffffff }), N);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < N; i++) {
    const s = i < NL ? -1 : 1, k = i % NL;
    dummy.position.set(s * (W / 2 + 0.05), 0.06 + k * ((H - 0.02) / (NL - 1)), 0.082);
    dummy.updateMatrix(); bulbs.setMatrixAt(i, dummy.matrix);
  }
  board.add(bulbs);
  const col = new THREE.Color();
  let lastTick = -1;
  const paintLeds = (t) => {
    const tick = Math.floor(t * 8);
    if (tick === lastTick) return; lastTick = tick;
    for (let i = 0; i < N; i++) {
      col.set(rainbow[(i + tick) % 6]);
      col.multiplyScalar(((i + tick) % 4 === 0) ? 0.8 : 0.35);
      bulbs.setColorAt(i, col);
    }
    bulbs.instanceColor.needsUpdate = true;
  };
  paintLeds(0);

  // Vít trên khung
  const screwGeo = new THREE.CylinderGeometry(0.009, 0.009, 0.006, 8); screwGeo.rotateX(Math.PI / 2);
  const screws = new THREE.InstancedMesh(screwGeo, mat(0xc8ccd4, 0.3, 0.9), 12 * 2);
  for (let i = 0; i < 24; i++) {
    const s2 = i < 12 ? -1 : 1, k = i % 12;
    dummy.position.set(s2 * (W / 2 + 0.088), 0.1 + k * 0.125, 0.082); dummy.updateMatrix(); screws.setMatrixAt(i, dummy.matrix);
  }
  board.add(screws);
  // Thanh trên + khe thả
  box(W + 0.2, 0.14, 0.1, frame, 0, H + 0.07, 0.03, board);
  box(W + 0.22, 0.012, 0.11, gold, 0, H + 0.145, 0.03, board);
  const black = mat(0x0a0a0c, 0.6, 0.2);
  for (let i = 0; i <= 7; i++) box(0.035, 0.1, 0.07, black, -W / 2 + 0.04 + i * ((W - 0.08) / 7), H - 0.04, 0.035, board);
  const funnel = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.035, 0.09, 4, 1, true),
    mat(0x9aa3ad, 0.3, 0.8, { side: THREE.DoubleSide }));
  funnel.rotation.y = Math.PI / 4; funnel.position.set(0, H - 0.13, 0.04); board.add(funnel);

  // Marquee
  const mw = 0.62, mh = 0.36;
  const sh = new THREE.Shape();
  [[-mw, 0], [mw, 0], [mw, 0.2], [0.5, 0.27], [0.4, mh], [-0.4, mh], [-0.5, 0.27], [-mw, 0.2]]
    .forEach((p, i) => (i ? sh.lineTo(p[0], p[1]) : sh.moveTo(p[0], p[1])));
  const mq = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.08, bevelEnabled: false }), frame);
  mq.position.set(0, H + 0.15, -0.02); board.add(mq);
  const mgeo = new THREE.ShapeGeometry(sh);
  const uv = mgeo.attributes.uv, pos = mgeo.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + mw) / (2 * mw), pos.getY(i) / mh);
  const mTex = tex(1024, 300, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h);
    gr.addColorStop(0, '#9b3be8'); gr.addColorStop(1, '#4a1a8c');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.lineWidth = 14; g.strokeStyle = '#ffcf3f'; g.strokeRect(7, 7, w - 14, h - 14);
    for (let i = 0; i < 40; i++) {
      g.fillStyle = rainbow[i % 6]; g.beginPath();
      g.arc(20 + i * 25, 22, 6, 0, 7); g.arc(20 + i * 25, h - 22, 6, 0, 7); g.fill();
    }
    const face = (cx) => {
      g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(cx, h / 2, 58, 0, 7); g.fill();
      g.strokeStyle = '#3b1270'; g.lineWidth = 6; g.stroke();
      g.fillStyle = '#3b1270';
      g.beginPath(); g.arc(cx - 20, h / 2 - 12, 7, 0, 7); g.arc(cx + 20, h / 2 - 12, 7, 0, 7); g.fill();
      g.beginPath(); g.arc(cx, h / 2 + 6, 28, 0.15, Math.PI - 0.15); g.stroke();
    };
    face(110); face(w - 110);
    g.font = 'bold 190px "Arial Black", Impact, sans-serif';
    g.textBaseline = 'middle'; g.textAlign = 'left';
    const letters = o.title.split('');
    const total = letters.reduce((a, l) => a + g.measureText(l).width, 0);
    let x = (w - total) / 2;
    letters.forEach((l, i) => {
      g.lineWidth = 16; g.strokeStyle = '#2a0f55'; g.strokeText(l, x, h / 2 + 6);
      g.fillStyle = rainbow[i % 6]; g.fillText(l, x, h / 2 + 6);
      x += g.measureText(l).width;
    });
  });
  const mf = new THREE.Mesh(mgeo, new THREE.MeshStandardMaterial({
    map: mTex, emissive: 0xffffff, emissiveMap: mTex, emissiveIntensity: 0.28, roughness: 0.4,
  }));
  mf.position.set(0, H + 0.15, 0.062); board.add(mf);

  // Đáy + ngăn + nhãn điểm
  const sw = W / SLOTS.length, BIN_TOP = 0.24;
  box(W, 0.04, 0.1, black, 0, 0.02, 0.04, board);
  for (let i = 0; i <= SLOTS.length; i++)
    box(0.007, BIN_TOP - 0.04, 0.09, mat(0xe8e8ee, 0.3, 0.6), -W / 2 + i * sw, 0.04 + (BIN_TOP - 0.04) / 2, 0.04, board);
  const labelMats = SLOTS.map((s, i) => {
    const t = tex(64, 128, (g, w, h) => {
      g.fillStyle = s.c; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(0, 0, w, 16);
      g.font = 'bold ' + (s.v >= 100 ? 26 : 32) + 'px "Arial Black", Impact, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = ['#f4f4f4', '#f2c316', '#f2a516', '#9ccb2a'].includes(s.c) ? '#222' : '#fff';
      g.fillText(String(s.v), w / 2, h / 2 + 8);
    });
    const m = mat(0xffffff, 0.4, 0.05, { map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.05 });
    box(sw - 0.007, 0.12, 0.02, m, -W / 2 + (i + 0.5) * sw, 0.085, 0.1, board);
    return m;
  });

  // Đinh (instanced)
  const R = Math.min(0.028, sw * 0.23), PR = Math.min(0.008, sw * 0.08), G = -3.2, E = 0.5;
  const pegPos = [];
  const dx = sw, dy = sw * 0.85;
  for (let r = 0, y = 0.38; y <= H - 0.22; r++, y += dy) {
    if (r % 2 === 0) for (let k = 1; k < NS - 1; k++) pegPos.push([-W / 2 + dx * (k + 0.5), y]); // bỏ đinh sát tường (tránh kẹt)
    else for (let k = 1; k < NS; k++) pegPos.push([-W / 2 + dx * k, y]);
  }
  const pg = new THREE.CylinderGeometry(PR, PR, 0.06, 8);
  pg.rotateX(Math.PI / 2); pg.translate(0, 0, 0.03);
  const pegs = new THREE.InstancedMesh(pg, mat(0xdddddd, 0.25, 0.7), pegPos.length);
  pegPos.forEach((p, i) => { dummy.position.set(p[0], p[1], 0); dummy.updateMatrix(); pegs.setMatrixAt(i, dummy.matrix); });
  board.add(pegs);
  const capGeo = new THREE.SphereGeometry(PR * 1.5, 8, 6);
  const caps = new THREE.InstancedMesh(capGeo, new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.5 }), pegPos.length);
  pegPos.forEach((p, i) => {
    dummy.position.set(p[0], p[1], 0.06); dummy.updateMatrix(); caps.setMatrixAt(i, dummy.matrix);
    caps.setColorAt(i, col.set(rainbow[Math.round((p[1] - 0.38) / dy) % 6]).multiplyScalar(0.8));
  });
  board.add(caps);

  // Kính
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(W + 0.02, H),
    new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.06, roughness: 0.05, metalness: 0.1, depthWrite: false }));
  glass.position.set(0, H / 2, 0.075); board.add(glass);

  root.updateMatrixWorld(true);
  // Dây điện phía sau
  const cable = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    board.localToWorld(new THREE.Vector3(0.3, 0.7, -0.24)), new THREE.Vector3(0.36, BH + 0.35, -0.5),
    new THREE.Vector3(0.5, BH + 0.1, -0.52), new THREE.Vector3(0.55, 0.45, -BD / 2 - 0.02), new THREE.Vector3(0.55, 0.3, -BD / 2 - 0.0),
  ]), 24, 0.008, 6), mat(0x050505, 0.8, 0));
  root.add(cable);
  // Chân chống phía sau
  root.updateMatrixWorld(true);
  const strut = (a, b, r, m) => {
    const d = new THREE.Vector3().subVectors(b, a);
    const k = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), 8), m);
    k.position.copy(a).addScaledVector(d, 0.5);
    k.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
    root.add(k);
  };
  const steel = mat(0x666b75, 0.4, 0.8);
  [-0.42, 0.42].forEach((x) => {
    strut(board.localToWorld(new THREE.Vector3(x, 1.25, -0.24)), new THREE.Vector3(x, BH + 0.05, -BD / 2 + 0.04), 0.014, steel);
  });
  strut(new THREE.Vector3(-0.42, BH + 0.25, -BD / 2 + 0.05), new THREE.Vector3(0.42, BH + 0.25, -BD / 2 + 0.05), 0.012, steel);

  // ---------- Xu + vật lý 2D trên mặt bảng ----------
  const coinGeo = new THREE.CylinderGeometry(R, R, 0.007, 24); coinGeo.rotateX(Math.PI / 2);
  const coinMat = mat(0xf2c33a, 0.25, 0.9, { emissive: 0x553300, emissiveIntensity: 0.2 });
  const balls = [];
  const FLOOR = 0.04 + R;

  function drop(x) {
    if (x === undefined) x = (Math.random() - 0.5) * 0.3;
    const m = new THREE.Mesh(coinGeo, coinMat);
    board.add(m);
    balls.push({ m, x, y: H - 0.12, vx: (Math.random() - 0.5) * 0.15, vy: 0, st: 0, t: 0, lo: null, hi: 0, cell: 0, still: 0, age: 0 });
  }

  function step(b, h) {
    b.vy += G * h; b.x += b.vx * h; b.y += b.vy * h;
    if (b.x < -W / 2 + R) { b.x = -W / 2 + R; b.vx = Math.abs(b.vx) * E; }
    if (b.x > W / 2 - R) { b.x = W / 2 - R; b.vx = -Math.abs(b.vx) * E; }
    if (b.lo === null && b.y < BIN_TOP + R) {
      b.cell = Math.max(0, Math.min(SLOTS.length - 1, Math.floor((b.x + W / 2) / sw)));
      b.lo = -W / 2 + b.cell * sw; b.hi = b.lo + sw;
    }
    if (b.lo !== null) {
      const a = b.lo + R + 0.004, z = b.hi - R - 0.004;
      if (b.x < a) { b.x = a; b.vx = Math.abs(b.vx) * 0.3; }
      if (b.x > z) { b.x = z; b.vx = -Math.abs(b.vx) * 0.3; }
      if (b.y < FLOOR) {
        b.y = FLOOR; b.vy = -b.vy * 0.3; b.vx *= 0.9;
        if (Math.abs(b.vy) < 0.15) b.vy = 0;
      }
      return;
    }
    for (let i = 0; i < pegPos.length; i++) {
      const p = pegPos[i];
      if (Math.abs(p[1] - b.y) > R + PR) continue;
      const ddx = b.x - p[0], ddy = b.y - p[1], d2 = ddx * ddx + ddy * ddy, rr = R + PR;
      if (d2 < rr * rr) {
        const d = Math.sqrt(d2) || 1e-4, nx = ddx / d, ny = ddy / d;
        b.x = p[0] + nx * rr; b.y = p[1] + ny * rr;
        const vn = b.vx * nx + b.vy * ny;
        if (vn < 0) {
          b.vx -= (1 + E) * vn * nx; b.vy -= (1 + E) * vn * ny;
          b.vx += (Math.random() - 0.5) * 0.05;
          if (Math.abs(nx) < 0.25) b.vx += (ddx === 0 ? (Math.random() < 0.5 ? -1 : 1) : Math.sign(ddx)) * 0.25; // chống cân bằng trên đỉnh đinh
        }
      }
    }
  }

  function update(dt, t = 0) {
    paintLeds(t);
    dt = Math.min(dt, 0.033);
    for (let i = balls.length - 1; i >= 0; i--) {
      const b = balls[i];
      if (b.st === 0) {
        const n = 4; for (let k = 0; k < n; k++) step(b, dt / n);
        b.age += dt;
        if (b.lo === null) {
          b.still = (b.vx * b.vx + b.vy * b.vy < 0.0064) ? b.still + dt : 0;
          if (b.still > 0.2) { // kẹt -> đẩy ra
            b.vx += (Math.random() < 0.5 ? -1 : 1) * (0.3 + Math.random() * 0.3); b.vy += 0.15; b.still = 0;
          }
          if (b.age > 12) { // failsafe: ép rơi xuống ô gần nhất
            b.y = BIN_TOP + R - 0.001; b.vy = -0.5;
          }
        }
        if (b.lo !== null && b.y <= FLOOR + 0.002 && Math.abs(b.vy) < 0.01) {
          b.st = 1; b.t = 0;
          const m = labelMats[b.cell]; m.emissiveIntensity = 0.7;
          total += SLOTS[b.cell].v; drawScore();
          if (o.onScore) o.onScore(SLOTS[b.cell].v, b.cell);
        }
      } else if ((b.t += dt) > 1.2) {
        board.remove(b.m); balls.splice(i, 1); continue;
      }
      b.m.position.set(b.x, b.y, 0.035);
      b.m.rotation.z -= b.vx * dt * 20;
    }
    labelMats.forEach((m) => { if (m.emissiveIntensity > 0.05) m.emissiveIntensity = Math.max(0.05, m.emissiveIntensity - dt * 1.5); });
  }

  root.traverse((k) => { if (k.isMesh) { k.castShadow = true; k.receiveShadow = true; } });
  glass.castShadow = false;
  root.userData = { update, drop, setScore: (v) => { total = v; drawScore(); }, board, slots: SLOTS, size: { w: BW, d: BD, h: 2.3 }, replacementScale: 0.4 };
  return root;
}
export default createPlinkoTable;
