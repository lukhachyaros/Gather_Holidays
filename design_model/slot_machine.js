import * as THREE from 'three';

// Máy slot. Dùng: const slot = createSlotMachine(); scene.add(slot); mỗi frame: slot.userData.update(giây);
// slot.userData.pull() để kéo cần gạt thủ công (update tự kéo mỗi ~6s nếu auto = true).
const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, metalness: 0.3, ...o });
const tex = (w, h, draw) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); draw(x, w, h);
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return { t, c, x };
};
const rr = (x, a, b, w, h, r) => { x.beginPath(); x.roundRect ? x.roundRect(a, b, w, h, r) : x.rect(a, b, w, h); };
const SYM = ['7', '💎', '🍒', '🍋', '🍓', '🍇', 'J', 'K', 'A', '⭐'];

function drawReels(x, w, h, grid) {
  const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#24103f'); g.addColorStop(1, '#4e1a72');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  const cw = w / 3, ch = h;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 1; j++) {
    x.fillStyle = '#c9c3d6'; rr(x, i * cw + 8, j * ch + 8, cw - 16, ch - 16, 12); x.fill();
    const s = grid[i][j]; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = 'bold ' + ch * 0.6 + 'px sans-serif';
    x.fillStyle = s === '7' ? '#b01010' : s === 'J' ? '#244fb5' : s === 'K' ? '#a98000' : '#a83226';
    x.fillText(s, i * cw + cw / 2, j * ch + ch / 2 + 4);
  }
}

export function createSlotMachine() {
  const root = new THREE.Group(); root.name = 'SlotMachine';
  const dark = M(0x23242a, { roughness: 0.6 }), steel = M(0xc4c8d2, { metalness: 0.7, roughness: 0.4 });
  const W = 1.3;

  // thân (mặt cắt bên → đùn theo chiều rộng)
  const sh = new THREE.Shape();
  [[-0.5, 0], [0.4, 0], [0.4, 1.25], [0.62, 1.45], [0.62, 1.6], [0.3, 1.7], [0.15, 3.3], [-0.5, 3.4]].forEach(([z, y], i) => i ? sh.lineTo(z, y) : sh.moveTo(z, y));
  const bg = new THREE.ExtrudeGeometry(sh, { depth: W, bevelEnabled: false });
  bg.rotateY(-Math.PI / 2); bg.translate(W / 2, 0, 0);
  const body = new THREE.Mesh(bg, dark); body.castShadow = body.receiveShadow = true; root.add(body);

  // viền chrome cầu vồng hai bên mặt trước
  const rb = tex(8, 256, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); ['#ff4d4d', '#ffd24d', '#4dff88', '#4dc3ff', '#b04dff'].forEach((c, i, a) => g.addColorStop(i / 3 % 1.01, c)); x.fillStyle = g; x.fillRect(0, 0, w, h); });
  [-1, 1].forEach((s) => {
    const e = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.75, 0.03), new THREE.MeshStandardMaterial({ map: rb.t, emissiveMap: rb.t, emissive: 0xffffff, emissiveIntensity: 0.12, metalness: 0.6, roughness: 0.3 }));
    e.position.set(s * (W / 2 - 0.03), 2.52, 0.24); e.rotation.x = -0.094; root.add(e);
    const e2 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.2, 0.03), steel); e2.position.set(s * (W / 2 - 0.03), 0.62, 0.41); root.add(e2);
  });

  // màn hình (mặt trước hơi nghiêng ra sau)
  const tilt = -0.094, zAt = (y) => 0.3 - (y - 1.7) * (0.15 / 1.6) + 0.012;
  const plane = (w, h, map, y, emi = 0.4) => {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.08, h + 0.08, 0.03), M(0x0b0b0e)); frame.position.set(0, y, zAt(y) - 0.005); frame.rotation.x = tilt; root.add(frame);
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map, emissiveMap: map, emissive: 0xffffff, emissiveIntensity: emi, roughness: 0.2 }));
    p.position.set(0, y, zAt(y) + 0.015); p.rotation.x = tilt; root.add(p);
  };
  const jp = tex(512, 280, (x, w, h) => {
    const g = x.createRadialGradient(w / 2, h / 2, 20, w / 2, h / 2, w / 1.4); g.addColorStop(0, '#7a2fb5'); g.addColorStop(1, '#1f0a42');
    x.fillStyle = g; x.fillRect(0, 0, w, h); x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = 'bold 68px sans-serif'; x.fillStyle = '#e8b81a'; x.strokeStyle = '#8a5200'; x.lineWidth = 5; x.strokeText('JACKPOT777', w / 2, 46); x.fillText('JACKPOT777', w / 2, 46);
    x.fillStyle = '#5e0b11'; rr(x, 100, 86, 312, 42, 12); x.fill(); x.fillStyle = '#e6c25a'; x.font = 'bold 34px sans-serif'; x.fillText('$89,891.00', w / 2, 108);
    [['MINI', '$22,300'], ['MAJOR', '$61,400'], ['GRAND', '$89,000']].forEach((r, i) => { x.fillStyle = 'rgba(0,0,0,.45)'; x.fillRect(120, 142 + i * 38, 272, 31); x.font = 'bold 20px sans-serif'; x.fillStyle = '#e07fb4'; x.textAlign = 'left'; x.fillText(r[0], 130, 158 + i * 38); x.fillStyle = '#e6c25a'; x.textAlign = 'right'; x.fillText(r[1], 382, 158 + i * 38); x.textAlign = 'center'; });
    for (let i = 0; i < 14; i++) { x.fillStyle = '#d9a820'; x.beginPath(); x.arc(20 + i * 12, h - 12 - (i % 3) * 7, 13, 0, 7); x.arc(w - 20 - i * 12, h - 12 - (i % 3) * 7, 13, 0, 7); x.fill(); }
  });
  plane(1.1, 0.6, jp.t, 2.98, 0.4);
  let grid = [['7'], ['7'], ['7']];
  const reel = tex(480, 224, (x, w, h) => drawReels(x, w, h, grid));
  plane(0.9, 0.42, reel.t, 2.13, 0.35);
  plane(1.1, 0.52, reel.t, 2.2, 0.8);

  // bảng điều khiển
  const con = new THREE.Group(); con.position.set(0, 1.575, 0.46); con.rotation.x = 0.3; root.add(con);
  const top = new THREE.Mesh(new THREE.BoxGeometry(W - 0.04, 0.05, 0.36), M(0x3b3d45, { metalness: 0.5 })); con.add(top);
  const lcd = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.07), new THREE.MeshStandardMaterial({ color: 0x4fb6ff, emissive: 0x2a8fe0, emissiveIntensity: 0.45 }));
  lcd.rotation.x = -Math.PI / 2; lcd.position.set(-0.12, 0.03, -0.1); con.add(lcd);
  for (let i = 0; i < 5; i++) for (let j = 0; j < 1; j++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.035, 0.07), M(0xd9dbe0)); b.position.set(-0.38 + i * 0.12, 0.04, 0.02 + j * 0.09); con.add(b); }
  [[0.3, 0xffcc00], [0.42, 0xff8a1f]].forEach(([x, c]) => { const b = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.04, 0.08), M(c, { emissive: c, emissiveIntensity: 0.3 })); b.position.set(x, 0.04, -0.08); con.add(b); const b2 = b.clone(); b2.position.z = 0.04; con.add(b2); });
  const bill = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.04, 0.1), M(0x111)); bill.position.set(0.45, 0.035, 0.12); con.add(bill);
  const slotG = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.03, 0.02), M(0x2ecc71, { emissive: 0x2ecc71, emissiveIntensity: 0.6 })); slotG.position.set(0.45, 0.058, 0.12); con.add(slotG);
  // khay + cửa dưới
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.5, 0.03), M(0x15161a)); door.position.set(0, 0.95, 0.41); root.add(door);
  const hole = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.04), M(0x050505)); hole.position.set(0.2, 0.95, 0.43); root.add(hole);
  const tray = new THREE.Group(); tray.position.set(0, 0.28, 0.5); root.add(tray);
  const tb = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.06, 0.42), steel); tray.add(tb);
  [[0, 0.1, 0.2, 1.08, 0.2, 0.04], [-0.52, 0.06, 0, 0.04, 0.14, 0.42], [0.52, 0.06, 0, 0.04, 0.14, 0.42]].forEach(([x, y, z, w, h, d]) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), steel); m.position.set(x, y, z); tray.add(m); });

  // vent lưng
  [0.9, 1.5, 2.1].forEach((y) => [-0.3, 0.3].forEach((x) => { const v = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.14, 0.02), M(0x0a0a0c)); v.position.set(x, y + (y > 1.2 ? 0.8 : 0), -0.505); if (y < 1.2 || y > 1.4) root.add(v); }));

  // đèn topper MEGA WIN + bóng đèn nhấp nháy
  const tp = new THREE.Group(); tp.position.set(0, 3.7, -0.1); root.add(tp);
  const tbox = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.6, 0.3), dark); tp.add(tbox);
  const mw = tex(512, 240, (x, w, h) => { x.fillStyle = '#12091f'; x.fillRect(0, 0, w, h); x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = 'bold 110px sans-serif'; x.shadowBlur = 25; x.shadowColor = '#ff2d2d'; x.fillStyle = '#d9503f'; x.fillText('MEGA', w / 2, 70); x.shadowColor = '#2dc8ff'; x.fillStyle = '#4fb8d9'; x.fillText('WIN', w / 2, 175); });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(1.14, 0.5), new THREE.MeshStandardMaterial({ map: mw.t, emissiveMap: mw.t, emissive: 0xffffff, emissiveIntensity: 0.5 }));
  face.position.z = 0.16; tp.add(face);
  const bulbs = [];
  for (let i = 0; i < 26; i++) {
    const t = i / 26, per = 2 * (1.22 + 0.56); let d = t * per, x, y;
    if (d < 1.22) { x = -0.61 + d; y = 0.28; } else if ((d -= 1.22) < 0.56) { x = 0.61; y = 0.28 - d; } else if ((d -= 0.56) < 1.22) { x = 0.61 - d; y = -0.28; } else { d -= 1.22; x = -0.61; y = -0.28 + d; }
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff }));
    b.position.set(x, y, 0.17); tp.add(b); bulbs.push(b);
  }
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.18, 14), new THREE.MeshStandardMaterial({ color: 0xffb800, emissive: 0xffb800, emissiveIntensity: 0.5 }));
  beacon.position.set(0, 4.1, -0.1); root.add(beacon);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 14), steel); cap.position.set(0, 4.0, -0.1); root.add(cap);

  // cần gạt (bên phải)
  const lever = new THREE.Group(); lever.position.set(0.82, 1.9, 0.0); root.add(lever);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.14, 16), M(0xc8a02a, { metalness: 0.8 })); hub.rotation.z = Math.PI / 2; lever.add(hub);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.3, 10), steel); arm.position.y = 0.7; lever.add(arm);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.14, 20, 16), M(0xd01818, { roughness: 0.25, metalness: 0.1 })); ball.position.y = 1.4; lever.add(ball);
  const link = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.1), M(0x8a8d96)); link.position.set(-0.1, 0, 0); lever.add(link);

  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });

  // ---- chi tiết thêm ----
  const blk = M(0x050505), gold = M(0xc8a02a, { metalness: 0.85, roughness: 0.3 });
  const add = (g, m, p, parent = root, rot) => { const o = new THREE.Mesh(g, m); o.position.set(...p); if (rot) o.rotation.set(...rot); parent.add(o); return o; };
  const Bx = (w, h, d) => new THREE.BoxGeometry(w, h, d), Cy = (r, h, n = 14) => new THREE.CylinderGeometry(r, r, h, n);
  add(Bx(W + 0.06, 0.1, 0.96), M(0x15161a), [0, 0.05, -0.05]);                       // chân đế
  add(Bx(W + 0.07, 0.025, 0.97), steel, [0, 0.11, -0.05]);
  add(Bx(W + 0.04, 0.04, 0.7), steel, [0, 3.42, -0.18]);                                // viền nóc
  // loa 2 đầu bảng điều khiển
  [-0.56, 0.56].forEach((x) => { add(Bx(0.12, 0.025, 0.12), M(0x111114), [x, 0.03, -0.08], con); for (let k = 0; k < 4; k++) add(Bx(0.1, 0.01, 0.01), blk, [x, 0.045, -0.12 + k * 0.03], con); });
  add(Cy(0.075, 0.03, 20), M(0x1fa34a, { emissive: 0x1fa34a, emissiveIntensity: 0.25 }), [-0.52, 0.045, 0.1], con);   // nút SPIN
  add(Cy(0.09, 0.015, 20), steel, [-0.52, 0.03, 0.1], con);
  add(Bx(0.14, 0.03, 0.08), M(0x1a1b20), [0.45, 0.03, -0.08], con); add(Bx(0.02, 0.01, 0.02), M(0xff2a2a, { emissive: 0xff2a2a, emissiveIntensity: 0.5 }), [0.5, 0.05, -0.08], con); // đầu đọc thẻ + LED
  // cửa dưới: máy in vé, bảng hiệu, tay nắm
  add(Bx(0.3, 0.04, 0.03), blk, [-0.25, 0.98, 0.43]); add(Bx(0.2, 0.12, 0.006), M(0xeeeeee, { roughness: 0.9 }), [-0.25, 0.9, 0.436]);
  const lg = tex(256, 48, (x, w, h) => { x.fillStyle = '#b8901f'; x.fillRect(0, 0, w, h); x.fillStyle = '#2a1a00'; x.font = 'bold 34px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('LUCKY 777', w / 2, h / 2 + 2); });
  add(new THREE.PlaneGeometry(0.4, 0.075), new THREE.MeshStandardMaterial({ map: lg.t, metalness: 0.6, roughness: 0.4 }), [0, 1.14, 0.426]);
  add(Cy(0.03, 0.05), steel, [0.42, 0.78, 0.43], root, [Math.PI / 2, 0, 0]);
  // lỗ thông gió + khóa hai bên hông
  [-1, 1].forEach((s) => { for (let k = 0; k < 6; k++) add(Bx(0.012, 0.035, 0.5), blk, [s * 0.653, 0.55 + k * 0.07, 0.0]); });
  add(Cy(0.04, 0.02), steel, [-0.656, 1.3, 0.2], root, [0, 0, Math.PI / 2]); add(Bx(0.012, 0.05, 0.01), blk, [-0.667, 1.3, 0.2]);
  // lưng: khóa + tay nắm + khe tản nhiệt
  add(Cy(0.04, 0.02), steel, [0.4, 1.75, -0.51], root, [Math.PI / 2, 0, 0]); add(Bx(0.05, 0.3, 0.03), steel, [-0.4, 1.7, -0.52]);
  add(Bx(1.1, 0.02, 0.01), blk, [0, 1.25, -0.505]); add(Bx(0.01, 1.7, 0.01), blk, [0, 2.2, -0.5]);
  // dây nguồn + phích cắm
  const cable = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0.3, 0.25, -0.51), new THREE.Vector3(0.3, 0.03, -0.7), new THREE.Vector3(0.7, 0.02, -0.75), new THREE.Vector3(0.5, 0.02, -1.0), new THREE.Vector3(0.9, 0.02, -1.1)]), 40, 0.018, 8), M(0x0a0a0a, { roughness: 0.8, metalness: 0 })); root.add(cable);
  add(Bx(0.08, 0.05, 0.1), M(0x0a0a0a), [0.94, 0.03, -1.12]);
  // giá đỡ cần gạt
  add(Bx(0.05, 0.4, 0.3), steel, [0.675, 1.9, 0]); add(Cy(0.025, 0.2), steel, [0.74, 1.9, 0], root, [0, 0, Math.PI / 2]);
  [-0.1, 0.1].forEach((z) => add(Cy(0.015, 0.02), gold, [0.705, 1.9, z], root, [0, 0, Math.PI / 2]));
  add(Cy(0.045, 0.06), gold, [0.82, 2.55, 0], lever, [0, 0, 0]).position.set(0, 0.35, 0);   // vòng đệm vàng trên cần
  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });

  // animation
  let seed = 1; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  let lastDraw = -1, pullT = -1;
  root.userData.auto = true;
  root.userData.pull = () => { pullT = -2; };
  root.userData.update = (t) => {
    if (root.userData.auto && pullT === -1 && t % 6 < 0.05) pullT = t;
    if (pullT === -2) pullT = t;
    const e = pullT >= 0 ? t - pullT : 9;
    lever.rotation.x = e < 0.6 ? Math.sin((e / 0.6) * Math.PI) * 0.9 : 0;
    const spinning = e > 0.2 && e < 1.8;
    if (spinning && t - lastDraw > 0.07) {
      grid = grid.map(() => [0].map(() => SYM[Math.floor(rnd() * 10)])); drawReels(reel.x, 480, 224, grid); reel.t.needsUpdate = true; lastDraw = t;
    } else if (e >= 1.8 && e < 2) {
      grid = grid.map((c) => ['7']); drawReels(reel.x, 480, 224, grid); reel.t.needsUpdate = true; pullT = -1; lastDraw = -1;
    }
    bulbs.forEach((b, i) => { const on = Math.floor(t * 4 + i) % 2 === 0; b.material.emissiveIntensity = on ? 0.7 : 0.08; b.material.color.setHex(i % 2 ? 0xffd24d : 0x6fe0ff); b.material.emissive.setHex(i % 2 ? 0xffd24d : 0x6fe0ff); });
    mw.t.needsUpdate = false; face.material.emissiveIntensity = 0.45 + Math.sin(t * 5) * 0.1;
    beacon.material.emissiveIntensity = 0.25 + 0.35 * Math.abs(Math.sin(t * 3));
  };
  root.userData.update(0);
  root.userData.replacementScale = 0.4;
  return root;
}
