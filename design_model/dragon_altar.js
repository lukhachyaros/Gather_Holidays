// Đài Triệu Hồi Rồng - procedural model (three.js r128+; r170 OK)
// Dùng: import { createDragonAltar } from './dragon_altar.js';
//   const altar = createDragonAltar(THREE); scene.add(altar);
//   mỗi frame: altar.userData.update(timeSeconds);
export function createDragonAltar(THREE) {
  const g = new THREE.Group(); g.name = 'DragonSummonAltar';
  const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .85, metalness: .1, ...o });
  const stone = M(0x45423c), dark = M(0x2a2823), red = M(0x5a2a18), chain = M(0x1c1b19, { metalness: .8, roughness: .5 });
  const gold = M(0xc9a227, { metalness: .85, roughness: .35 });
  const add = (map, op = 1) => new THREE.MeshBasicMaterial({ map, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const put = (geo, mat, x, y, z, p = g) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; p.add(m); return m; };
  const cyl = (a, b, h, y, mat, p = g, s = 48) => put(new THREE.CylinderGeometry(a, b, h, s), mat, 0, y, 0, p);
  const ring = (r, t, y, mat, p = g) => { const m = put(new THREE.TorusGeometry(r, t, 8, 64), mat, 0, y, 0, p); m.rotation.x = Math.PI / 2; return m; };
  const cv = (n, fn) => { const c = document.createElement('canvas'); c.width = c.height = n; fn(c.getContext('2d'), n); return new THREE.CanvasTexture(c); };

  // ---- Bệ 3 tầng ----
  cyl(5.6, 5.8, .9, .45, stone); cyl(5.65, 5.65, .3, .5, red); ring(5.6, .06, .9, gold); ring(5.8, .05, .05, gold);
  cyl(4.5, 4.6, .35, 1.075, stone); ring(4.5, .05, 1.25, gold);
  cyl(3.7, 3.8, .3, 1.4, dark); ring(3.7, .05, 1.55, gold);
  // Hoa văn đỏ quanh tầng 1
  for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; put(new THREE.BoxGeometry(.35, .18, .08), gold, Math.cos(a) * 5.68, .5, Math.sin(a) * 5.68).rotation.y = -a + Math.PI / 2; }

  // ---- Vòng pháp trận ----
  const magic = cv(1024, (c, n) => {
    c.translate(n / 2, n / 2); c.strokeStyle = '#ffc040'; c.fillStyle = '#ffb030'; c.shadowColor = '#ff8a00'; c.shadowBlur = 14;
    [490, 450, 360, 250].forEach((r, i) => { c.lineWidth = i ? 5 : 8; c.beginPath(); c.arc(0, 0, r, 0, 7); c.stroke(); });
    c.lineWidth = 5;
    for (const o of [0, Math.PI]) { c.beginPath(); for (let i = 0; i <= 3; i++) { const a = o + i * 2 * Math.PI / 3 - Math.PI / 2; c[i ? 'lineTo' : 'moveTo'](Math.cos(a) * 360, Math.sin(a) * 360); } c.stroke(); }
    for (let i = 0; i < 48; i++) { const a = i / 48 * 7; c.save(); c.rotate(a); c.fillRect(466, -7, i % 2 ? 14 : 26, 14); c.restore(); }
    for (let i = 0; i < 12; i++) { c.beginPath(); c.arc(Math.cos(i * .524) * 405, Math.sin(i * .524) * 405, 12, 0, 7); c.fill(); }
  });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(3.7, 64), add(magic)); disc.rotation.x = -Math.PI / 2; disc.position.y = 1.58; g.add(disc);
  const disc2 = disc.clone(); disc2.scale.setScalar(1.45); disc2.position.y = 1.27; disc2.material = add(magic, .55); g.add(disc2);

  // ---- Cầu thang 4 hướng ----
  for (let k = 0; k < 4; k++) {
    const s = new THREE.Group(); s.rotation.y = k * Math.PI / 2; g.add(s);
    for (let i = 0; i < 4; i++) { const h = .225 * (i + 1); put(new THREE.BoxGeometry(2.4, h, .5), stone, 0, h / 2, 6.55 - i * .45, s); }
    for (const x of [-1.3, 1.3]) put(new THREE.BoxGeometry(.25, 1.1, 2), dark, x, .55, 5.9, s);
  }

  // ---- Bệ trung tâm + rồng cuộn ----
  cyl(1.15, 1.3, .8, 1.95, dark); ring(1.2, .06, 2.3, gold); ring(1.3, .05, 1.6, gold);
  const dr = put(new THREE.TorusKnotGeometry(.75, .2, 160, 14, 2, 3), stone, 0, 2.75, 0); dr.rotation.x = Math.PI / 2; dr.scale.z = .7;
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + .6; const h = new THREE.Group(); h.position.set(Math.cos(a) * 1.05, 3.0, Math.sin(a) * 1.05); h.rotation.y = -a; g.add(h); put(new THREE.SphereGeometry(.22, 12, 10), stone, 0, 0, 0, h).scale.set(1.4, 1, 1); const sn = put(new THREE.ConeGeometry(.12, .3, 8), stone, .3, -.03, 0, h); sn.rotation.z = -Math.PI / 2; }

  // ---- Quả cầu lửa ----
  const swirl = cv(512, (c, n) => {
    const gr = c.createRadialGradient(n / 2, n / 2, 20, n / 2, n / 2, n / 2); gr.addColorStop(0, '#fff2a0'); gr.addColorStop(.6, '#ffb020'); gr.addColorStop(1, '#ff6a00'); c.fillStyle = gr; c.fillRect(0, 0, n, n);
    c.strokeStyle = 'rgba(200,70,0,.55)'; c.lineWidth = 22; for (let i = 0; i < 6; i++) { c.beginPath(); c.arc(n / 2, n / 2, 50 + i * 38, i, i + 2.4); c.stroke(); }
  });
  const orb = put(new THREE.SphereGeometry(1.3, 48, 32), new THREE.MeshBasicMaterial({ map: swirl }), 0, 4.4, 0);
  const halo = new THREE.Mesh(new THREE.SphereGeometry(1.75, 32, 24), new THREE.MeshBasicMaterial({ color: 0xff9a20, transparent: true, opacity: .22, blending: THREE.AdditiveBlending, depthWrite: false })); halo.position.y = 4.4; g.add(halo);
  const gm = new THREE.MeshBasicMaterial({ color: 0xffc860 }), rings = [];
  [[2.3, .035, .35], [2.8, .03, -.5]].forEach(([r, t, tilt]) => { const p = new THREE.Group(); p.position.y = 4.4; p.rotation.z = tilt; g.add(p); const m = new THREE.Mesh(new THREE.TorusGeometry(r, t, 8, 96), gm); m.rotation.x = Math.PI / 2; p.add(m); rings.push(p); });
  const light = new THREE.PointLight(0xff9a30, 3, 30); light.position.y = 4.4; g.add(light);

  // ---- 4 trụ rồng quấn ----
  const flames = [], top = [];
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + k * Math.PI / 2, P = new THREE.Group(); P.position.set(Math.cos(a) * 6.9, 0, Math.sin(a) * 6.9); g.add(P);
    cyl(.8, .9, .45, .22, dark, P, 24); cyl(.55, .6, .3, .6, gold, P, 24); cyl(.45, .5, 5.2, 3.3, stone, P, 24);
    for (const y of [1.2, 3.2, 5.9]) ring(.52, .07, y, gold, P);
    const pts = []; for (let i = 0; i <= 80; i++) { const u = i / 80, t = u * Math.PI * 5; pts.push(new THREE.Vector3(Math.cos(t) * .55, 1 + u * 4.6, Math.sin(t) * .55)); }
    put(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, .12, 8), gold, 0, 0, 0, P);
    cyl(.62, .45, .3, 6.05, gold, P, 24);
    for (let i = 0; i < 8; i++) { const pa = i / 8 * Math.PI * 2, pt = put(new THREE.ConeGeometry(.17, .55, 6), M(0x7a5a60, { roughness: .6 }), Math.cos(pa) * .38, 6.45, Math.sin(pa) * .38, P); pt.rotation.set(Math.sin(pa) * .5, 0, -Math.cos(pa) * .5); }
    const fl = put(new THREE.ConeGeometry(.3, .9, 10), new THREE.MeshBasicMaterial({ color: 0xff7a10 }), 0, 6.95, 0, P); flames.push(fl);
    const fc = put(new THREE.SphereGeometry(.2, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffd060 }), 0, 6.7, 0, P);
    const pl = new THREE.PointLight(0xff7a20, 1.2, 9); pl.position.y = 7; P.add(pl);
    top.push(new THREE.Vector3(P.position.x, 7, P.position.z));
    // xích nối về bệ trung tâm
    const s = top[k], mid = new THREE.Vector3(s.x * .5, 3.6, s.z * .5), e = new THREE.Vector3(0, 3.4, 0);
    put(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(new THREE.Vector3(s.x, 6.2, s.z), mid, e), 40, .05, 6), chain, 0, 0, 0);
    // đầu rồng + tia lửa ở 2 trụ phía trước
    if (k < 2) {
      const h = new THREE.Group(); h.position.set(0, 6.5, 0); h.rotation.y = -a + Math.PI; P.add(h);
      put(new THREE.BoxGeometry(.5, .35, .7), dark, 0, 0, .2, h); put(new THREE.ConeGeometry(.16, .5, 8), dark, 0, -.02, .72, h).rotation.x = Math.PI / 2;
      for (const x of [-.15, .15]) { const hn = put(new THREE.ConeGeometry(.05, .45, 6), gold, x, .3, -.05, h); hn.rotation.x = -.8; }
      const sp = [new THREE.Vector3(s.x, 6.5, s.z), new THREE.Vector3(s.x * .6, 7.6, s.z * .6), new THREE.Vector3(s.x * .25, 6.3, s.z * .25), new THREE.Vector3(0, 4.6, 0)];
      const beam = put(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(sp), 60, .16, 8), new THREE.MeshBasicMaterial({ color: 0xff8a20, transparent: true, opacity: .75, blending: THREE.AdditiveBlending, depthWrite: false }), 0, 0, 0);
      beam.userData.beam = true; flames.push(beam);
    }
  }

  // ---- Hạt lửa bay lên ----
  const N = 260, pos = new Float32Array(N * 3), seed = [];
  for (let i = 0; i < N; i++) seed.push([Math.random() * 6.28, Math.random() * 3.6, Math.random()]);
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.add(new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xffc050, size: .09, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })));

  g.userData.update = (t) => {
    disc.rotation.z = t * .15; disc2.rotation.z = -t * .1; orb.rotation.y = t * .6; orb.rotation.x = t * .2;
    halo.scale.setScalar(1 + Math.sin(t * 3) * .05); light.intensity = 3 + Math.sin(t * 7) * .5 + Math.sin(t * 13) * .3;
    rings.forEach((r, i) => { r.rotation.y = t * (i ? -.8 : .6); });
    flames.forEach((f, i) => { if (f.userData.beam) f.material.opacity = .6 + Math.sin(t * 9 + i) * .15; else { f.scale.set(1 + Math.sin(t * 8 + i) * .12, 1 + Math.sin(t * 11 + i * 2) * .25, 1); } });
    for (let i = 0; i < N; i++) { const [a, r0, s] = seed[i], u = (t * .3 * (.5 + s) + s * 9) % 1, r = r0 * (1 - u * .5) + .4; pos[i * 3] = Math.cos(a + t * .3) * r; pos[i * 3 + 1] = 1.7 + u * 6; pos[i * 3 + 2] = Math.sin(a + t * .3) * r; }
    pg.attributes.position.needsUpdate = true;
  };
  return g;
}
