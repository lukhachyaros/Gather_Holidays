// Tượng Cỏ Bốn Lá Bằng Vàng & Bồn Nước - procedural model (three.js r128+; r170 OK)
// Dùng: import { createCloverFountain } from './clover_fountain.js';
//   const f = createCloverFountain(THREE); scene.add(f);
//   mỗi frame: f.userData.update(timeSeconds);   // 4 lá xoay như chong chóng, nước chảy, gợn sóng, lá rung nhẹ
// Kích thước ~ đường kính 4.7 · cao ~5.2 (đáy bồn ở y=0). Mặt trước hướng +z.
export function createCloverFountain(THREE) {
  const g = new THREE.Group(); g.name = 'CloverFountain';
  const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .5, metalness: 0, ...o });
  const gold = M(0x9a7a28, { metalness: .65, roughness: .35, emissive: 0x2a1c00 });
  const black = M(0x0f0f12, { roughness: .3, metalness: .2 });
  const mesh = (geo, mat, x = 0, y = 0, z = 0, p = g) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; p.add(m); return m; };
  const cyl = (rt, rb, h, y, mat, seg = 64) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat, 0, y, 0);
  const ringG = (r, t, y, mat = gold) => { const m = mesh(new THREE.TorusGeometry(r, t, 8, 96), mat, 0, y, 0); m.rotation.x = Math.PI / 2; return m; };
  const cnv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  // ---- Texture đá cẩm thạch (có/không có dải sóng chạm nổi) ----
  const marble = (w, h, waves) => {
    const [c, k] = cnv(w, h); k.fillStyle = '#bab8b0'; k.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) { k.strokeStyle = `rgba(70,72,78,${.05 + rnd() * .12})`; k.lineWidth = .5 + rnd() * 2; k.beginPath(); let px = rnd() * w, py = rnd() * h; k.moveTo(px, py); for (let j = 0; j < 6; j++) { px += (rnd() - .3) * w * .08; py += (rnd() - .5) * h * .3; k.lineTo(px, py); } k.stroke(); }
    if (waves) for (const [yy, a] of [[h * .42, h * .1], [h * .66, h * .08]]) for (let row = 0; row < 2; row++) { k.strokeStyle = row ? 'rgba(255,255,255,.55)' : 'rgba(60,64,70,.7)'; k.lineWidth = row ? 2 : 3; k.beginPath(); for (let px = 0; px <= w; px += 4) { const py = yy + Math.sin(px / (h * .5)) * a + Math.sin(px / (h * .17)) * a * .3 + row * 2; px ? k.lineTo(px, py) : k.moveTo(px, py); } k.stroke(); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t;
  };
  const wallMat = M(0xffffff, { map: marble(2048, 128, true), roughness: .3 }), stone = M(0xffffff, { map: marble(512, 512), roughness: .3 });

  // ---- Bồn nước ----
  cyl(2.15, 2.2, .1, .05, black); ringG(2.14, .03, .11);
  cyl(2.03, 2.03, .1, .15, black); ringG(2.04, .022, .2);
  cyl(2.0, 2.0, .62, .51, wallMat); ringG(2.04, .022, .82);
  cyl(2.03, 2.03, .1, .87, black); ringG(2.04, .022, .93);
  const rim = new THREE.Shape(); rim.absarc(0, 0, 2.08, 0, Math.PI * 2, false); const hole = new THREE.Path(); hole.absarc(0, 0, 1.82, 0, Math.PI * 2, true); rim.holes.push(hole);
  const rg = new THREE.ExtrudeGeometry(rim, { depth: .08, bevelEnabled: true, bevelThickness: .012, bevelSize: .012, bevelSegments: 3, curveSegments: 96 }); rg.rotateX(-Math.PI / 2); mesh(rg, stone, 0, .93, 0);
  ringG(2.09, .03, 1.03); ringG(1.82, .02, 1.03);
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(1.82, 1.82, .85, 64, 1, true), M(0xa6b4b8, { side: THREE.BackSide, roughness: .4 })); inner.position.y = .55; g.add(inner);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(1.82, 64), M(0x2f6a80, { roughness: .35 })); floor.rotation.x = -Math.PI / 2; floor.position.y = .13; g.add(floor);
  for (let i = 0; i < 46; i++) { const a = rnd() * 6.283, r = Math.sqrt(rnd()) * 1.6 + .1; if (r < .85) { i--; continue; } const c = mesh(new THREE.CylinderGeometry(.06, .06, .01, 16), gold, Math.cos(a) * r, .14 + rnd() * .02, Math.sin(a) * r); c.rotation.set((rnd() - .5) * .3, 0, (rnd() - .5) * .3); }
  const [wc, wk] = cnv(256, 256); wk.fillStyle = '#4a86a0'; wk.fillRect(0, 0, 256, 256); wk.strokeStyle = 'rgba(220,245,255,.35)'; wk.lineWidth = 2;
  for (let i = 0; i < 40; i++) { wk.beginPath(); wk.ellipse(rnd() * 256, rnd() * 256, 8 + rnd() * 28, 3 + rnd() * 10, rnd() * 3, 0, 6.3); wk.stroke(); }
  const waterTex = new THREE.CanvasTexture(wc); waterTex.wrapS = waterTex.wrapT = THREE.RepeatWrapping; waterTex.repeat.set(3, 3);
  const water = new THREE.Mesh(new THREE.CircleGeometry(1.82, 64), new THREE.MeshStandardMaterial({ map: waterTex, transparent: true, opacity: .4, roughness: .08, metalness: .1 })); water.rotation.x = -Math.PI / 2; water.position.y = .96; g.add(water);

  // ---- Bệ giữa ----
  cyl(.8, .8, 1.08, .66, stone); cyl(.83, .83, .08, 1.02, black); ringG(.83, .018, .98); ringG(.83, .018, 1.06); cyl(.86, .86, .06, 1.24, stone); ringG(.86, .025, 1.27);
  // ---- Đầu rồng ----
  const dragon = (px, py, pz, a, s = 1) => {
    const d = new THREE.Group(); d.position.set(px, py, pz); d.rotation.y = Math.PI / 2 - a; d.scale.setScalar(s); g.add(d);
    mesh(new THREE.SphereGeometry(.11, 16, 12), gold, 0, 0, 0, d).scale.set(1, .9, 1.1);
    mesh(new THREE.BoxGeometry(.11, .07, .16), gold, 0, -.03, .13, d);
    mesh(new THREE.BoxGeometry(.1, .025, .12), gold, 0, -.085, .12, d);
    for (const sx of [-1, 1]) { mesh(new THREE.ConeGeometry(.018, .16, 6), gold, sx * .07, .1, -.03, d).rotation.set(-.6, 0, -sx * .35); mesh(new THREE.SphereGeometry(.018, 8, 6), M(0xffffff), sx * .07, .035, .07, d); mesh(new THREE.ConeGeometry(.012, .1, 5), gold, sx * .045, -.1, .2, d).rotation.x = Math.PI; }
    return d;
  };
  // ---- Dòng nước ----
  const [sc, sk] = cnv(128, 16); sk.fillStyle = 'rgba(255,255,255,.35)'; sk.fillRect(0, 0, 128, 16); for (let i = 0; i < 26; i++) { sk.fillStyle = `rgba(255,255,255,${.4 + rnd() * .55})`; sk.fillRect(rnd() * 128, 0, 2 + rnd() * 8, 16); }
  const streamTex = new THREE.CanvasTexture(sc); streamTex.wrapS = streamTex.wrapT = THREE.RepeatWrapping; streamTex.repeat.set(5, 1);
  const streamMat = new THREE.MeshStandardMaterial({ map: streamTex, color: 0xa8dcff, transparent: true, opacity: .8, roughness: .1, depthWrite: false });
  const stream = (pts, rad, p = g) => mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))), 40, rad, 6), streamMat, 0, 0, 0, p);
  const ripples = [], rip = (px, py, pz, s = 1, p = g) => { const r = new THREE.Mesh(new THREE.RingGeometry(.03, .05, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .6, depthWrite: false })); r.rotation.x = -Math.PI / 2; r.position.set(px, py, pz); r.userData.s = s; p.add(r); ripples.push(r); };
  for (let k = 0; k < 4; k++) {                      // đầu rồng quanh thành bồn + nước xuống đất
    const a = k * Math.PI / 2, c = Math.cos(a), s = Math.sin(a); dragon(c * 2.05, .6, s * 2.05, a, 1.15);
    stream([[c * 2.18, .56, s * 2.18], [c * 2.3, .4, s * 2.3], [c * 2.4, .15, s * 2.4], [c * 2.42, .02, s * 2.42]], .02); rip(c * 2.42, .03, s * 2.42, .8);
  }
  dragon(0, 1.12, .88, Math.PI / 2, .9); stream([[0, 1.07, 1.0], [0, 1.0, 1.12], [0, .97, 1.2]], .014); rip(0, .965, 1.2, .6);
  ringG(2.4, .01, .02, M(0x9a7a28, { metalness: .6, roughness: .4 }));
  for (let k = 0; k < 4; k++) { const a = Math.PI / 4 + k * Math.PI / 2; const o = mesh(new THREE.OctahedronGeometry(.1), gold, Math.cos(a) * 2.45, .28, Math.sin(a) * 2.45); o.scale.set(.6, 1.8, .6); }

  // ---- Đá vàng + cỏ ----
  for (const [px, pz, sx, sy, sz] of [[.22, .22, .3, .2, .25], [-.25, .12, .22, .16, .2], [.1, -.28, .18, .14, .16], [.38, -.05, .15, .12, .14]]) mesh(new THREE.SphereGeometry(1, 20, 14), gold, px, 1.3 + sy * .5, pz).scale.set(sx, sy, sz);
  for (let i = 0; i < 22; i++) { const a = rnd() * 6.283, r = .15 + rnd() * .5, h = .3 + rnd() * .35, b = mesh(new THREE.ConeGeometry(.022, h, 4), gold, Math.cos(a) * r, 1.28 + h / 2, Math.sin(a) * r); b.rotation.set(Math.sin(a) * .4, 0, -Math.cos(a) * .4); }

  // ---- Thân cây + cỏ bốn lá (xoay quanh trục thân) ----
  const spin = new THREE.Group(); g.add(spin);
  const sp = [[0, 1.27, 0], [.12, 1.7, .06], [-.14, 2.2, .08], [.1, 2.75, .02], [-.02, 3.2, -.04], [0, 3.55, -.08]];
  mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(sp.map((p) => new THREE.Vector3(...p))), 80, .1, 12), gold, 0, 0, 0, spin);
  const goldB = M(0xb89636, { metalness: .75, roughness: .3, emissive: 0x2a1c00 });
  mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(sp.map((p, i) => new THREE.Vector3(p[0] + Math.sin(i * 1.7) * .07, p[1], p[2] + Math.cos(i * 1.7) * .07))), 80, .025, 6), goldB, 0, 0, 0, spin);
  mesh(new THREE.CylinderGeometry(.1, .22, .28, 16), gold, 0, 1.38, 0);

  // texture lá: gradient vàng + hạt + vân vảy chéo
  const [lc, lk] = cnv(512, 512), gr = lk.createLinearGradient(0, 512, 0, 0); gr.addColorStop(0, '#8a6a1e'); gr.addColorStop(1, '#b8932f'); lk.fillStyle = gr; lk.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 1500; i++) { lk.strokeStyle = `rgba(${rnd() > .5 ? '250,220,120' : '60,40,0'},.07)`; lk.lineWidth = 1; const px = rnd() * 512, py = rnd() * 512; lk.beginPath(); lk.moveTo(px, py); lk.lineTo(px + 6, py + 6); lk.stroke(); }
  lk.strokeStyle = 'rgba(60,40,0,.13)'; lk.lineWidth = 1; for (let i = -512; i < 1024; i += 12) { lk.beginPath(); lk.moveTo(i, 0); lk.lineTo(i + 512, 512); lk.moveTo(i + 512, 0); lk.lineTo(i, 512); lk.stroke(); }
  const leafTex = new THREE.CanvasTexture(lc); leafTex.anisotropy = 8;
  const leafMat = new THREE.MeshStandardMaterial({ map: leafTex, metalness: .5, roughness: .35, emissive: 0x241800 });

  // hình lá tim, mặt cong lõm + 2 mặt dày + viền
  const hs = new THREE.Shape(); hs.moveTo(0, 0); hs.bezierCurveTo(.35, .1, .72, .5, .64, .95); hs.bezierCurveTo(.56, 1.28, .15, 1.32, 0, 1.05); hs.bezierCurveTo(-.15, 1.32, -.56, 1.28, -.64, .95); hs.bezierCurveTo(-.72, .5, -.35, .1, 0, 0);
  const zf = (px, py) => .13 * px * px / .42 + .1 * py * py / 1.4 - .04 * Math.exp(-px * px / .012);
  const OUT = hs.getSpacedPoints(96).slice(0, 96), Mo = OUT.length, K = 10, cc = new THREE.Vector2(0, .52);
  const pos = [], uvs = [], idx = [];
  const pv = (px, py, pz) => { pos.push(px, py, pz); uvs.push((px + .7) / 1.4, py / 1.35); };
  const vi = (k, j) => (k === 0 ? 0 : 1 + (k - 1) * Mo + ((j % Mo) + Mo) % Mo);
  const grid = (dz) => { pv(cc.x, cc.y, zf(cc.x, cc.y) + dz); for (let k = 1; k <= K; k++) for (let j = 0; j < Mo; j++) { const px = cc.x + (OUT[j].x - cc.x) * k / K, py = cc.y + (OUT[j].y - cc.y) * k / K; pv(px, py, zf(px, py) + dz); } };
  grid(.015); grid(-.015); const nF = 1 + K * Mo;
  for (let j = 0; j < Mo; j++) { idx.push(0, vi(1, j), vi(1, j + 1), nF, nF + vi(1, j + 1), nF + vi(1, j)); }
  for (let k = 1; k < K; k++) for (let j = 0; j < Mo; j++) { const a = vi(k, j), b = vi(k, j + 1), c = vi(k + 1, j + 1), d = vi(k + 1, j); idx.push(a, d, c, a, c, b, nF + a, nF + c, nF + d, nF + a, nF + b, nF + c); }
  const R0 = 2 * nF; for (let j = 0; j < Mo; j++) pv(OUT[j].x, OUT[j].y, zf(OUT[j].x, OUT[j].y) + .015); for (let j = 0; j < Mo; j++) pv(OUT[j].x, OUT[j].y, zf(OUT[j].x, OUT[j].y) - .015);
  for (let j = 0; j < Mo; j++) { const j1 = (j + 1) % Mo; idx.push(R0 + j, R0 + Mo + j, R0 + Mo + j1, R0 + j, R0 + Mo + j1, R0 + j1); }
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); lg.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); lg.setIndex(idx); lg.computeVertexNormals();
  const leaf = new THREE.Group(), addL = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; leaf.add(m); return m; };
  addL(lg, leafMat);
  addL(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(OUT.map((p) => new THREE.Vector3(p.x, p.y, zf(p.x, p.y))), true), 192, .02, 8, true), goldB);
  const P3 = (px, py) => new THREE.Vector3(px, py, zf(px, py) + .02), tube = (pts, r) => addL(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, r, 5), goldB);
  tube([.06, .2, .35, .5, .65, .8, .95, 1.05].map((y) => P3(0, y)), .014);
  for (const sd of [-1, 1]) for (let k = 1; k <= 8; k++) { const y0 = .08 + k * .1, ey = Math.min(y0 + .3, 1.12), ex = Math.min(.2 + k * .045, ey > .95 ? .4 : .56); tube(new THREE.QuadraticBezierCurve(new THREE.Vector2(0, y0), new THREE.Vector2(sd * (.14 + k * .02), y0 + .1), new THREE.Vector2(sd * ex, ey)).getPoints(10).map((p) => P3(p.x, p.y)), .008); }
  const gi = []; for (let j = 5; j < Mo - 2; j += 6) gi.push(j);
  const gems = new THREE.InstancedMesh(new THREE.SphereGeometry(.024, 8, 6), M(0xf0f0ff, { roughness: .1, emissive: 0x2a2a38 }), gi.length), m4 = new THREE.Matrix4();
  gi.forEach((j, n) => { m4.setPosition(OUT[j].x, OUT[j].y, zf(OUT[j].x, OUT[j].y) + .025); gems.setMatrixAt(n, m4); }); leaf.add(gems);

  const tilt = new THREE.Group(); tilt.position.set(0, 3.6, -.05); tilt.rotation.x = -.3; spin.add(tilt);
  const wheel = new THREE.Group(); tilt.add(wheel); // 4 lá xoay trong mặt phẳng của chúng
  const leaves = [];
  for (let i = 0; i < 4; i++) { const lf = new THREE.Group(); lf.rotation.z = Math.PI / 4 + i * Math.PI / 2; lf.position.z = (i % 2) * .04; wheel.add(lf); const c = leaf.clone(true); c.scale.setScalar(1.05); lf.add(c); leaves.push(lf); }
  // ---- Cá cam nhỏ bơi trong bồn ----
  const fishM = M(0xe8620c, { roughness: .35, emissive: 0x4a1800 }), fishLight = M(0xf6a050, { roughness: .4, emissive: 0x3a1400 });
  const makeFish = (sc) => {
    const fish = new THREE.Group(); fish.scale.setScalar(sc); g.add(fish);
    const fbody = mesh(new THREE.SphereGeometry(.12, 20, 14), fishM, 0, 0, 0, fish); fbody.scale.set(.55, .8, 1.5);
    mesh(new THREE.SphereGeometry(.12, 16, 10), fishLight, 0, -.03, .02, fish).scale.set(.5, .5, 1.3);
    const tailP = new THREE.Group(); tailP.position.z = -.17; fish.add(tailP);
    const tail = mesh(new THREE.ConeGeometry(.1, .16, 3), fishM, 0, 0, -.08, tailP); tail.rotation.x = Math.PI / 2; tail.scale.x = .15;
    const dors = mesh(new THREE.ConeGeometry(.05, .11, 3), fishM, 0, .1, -.03, fish); dors.scale.x = .15; dors.rotation.x = -.5;
    const fins = [-1, 1].map((sx) => { const f = mesh(new THREE.SphereGeometry(.05, 10, 8), fishLight, sx * .06, -.04, .06, fish); f.scale.set(.2, .4, 1); f.rotation.y = sx * .5; return f; });
    for (const sx of [-1, 1]) { mesh(new THREE.SphereGeometry(.022, 10, 8), M(0xffffff, { roughness: .2 }), sx * .055, .035, .13, fish); mesh(new THREE.SphereGeometry(.011, 8, 6), black, sx * .064, .036, .142, fish); }
    return { fish, tailP, fbody, fins };
  };
  const swimmers = [                                   // 2 chú cá: cá cũ + cá mới bơi ngược chiều, sâu hơn
    { ...makeFish(1.5), spd: .5, r0: 1.3, amp: .22, k: 2, y0: .84, ph: 0, tf: 8 },
    { ...makeFish(1.2), spd: -.38, r0: 1.52, amp: .12, k: 3, y0: .68, ph: 2.1, tf: 10 },
  ];

  const coin = new THREE.Group();
  coin.name = 'FountainTossCoin';
  coin.position.set(1.1, 1.02, .25);
  coin.visible = false;
  const coinRadius = .18;
  mesh(new THREE.CylinderGeometry(coinRadius, coinRadius, .035, 32), gold, 0, 0, 0, coin);
  const coinFace = (label, background) => {
    const [canvas, context] = cnv(256, 256);
    context.fillStyle = background;
    context.fillRect(0, 0, 256, 256);
    context.strokeStyle = '#fff2b0';
    context.lineWidth = 9;
    context.beginPath();
    context.arc(128, 128, 108, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = '#422006';
    context.font = 'bold 42px sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(label, 128, 128);
    return new THREE.MeshStandardMaterial({
      map: new THREE.CanvasTexture(canvas),
      metalness: .45,
      roughness: .3,
      side: THREE.DoubleSide,
    });
  };
  const headsFace = new THREE.Mesh(new THREE.CircleGeometry(coinRadius * .86, 32), coinFace('NGỬA', '#facc15'));
  headsFace.rotation.x = -Math.PI / 2;
  headsFace.position.y = .018;
  coin.add(headsFace);
  const tailsFace = new THREE.Mesh(new THREE.CircleGeometry(coinRadius * .86, 32), coinFace('SẤP', '#fbbf24'));
  tailsFace.rotation.x = Math.PI / 2;
  tailsFace.position.y = -.018;
  coin.add(tailsFace);
  g.add(coin);
  const coinFlip = { active: false, startedAt: null, startRotation: 0, endRotation: 0 };
  g.userData.tossCoin = (side) => {
    if (side !== 'heads' && side !== 'tails') throw new TypeError('Coin side must be heads or tails.');
    coinFlip.active = true;
    coinFlip.startedAt = null;
    coinFlip.startRotation = coin.rotation.x;
    const targetRotation = side === 'tails' ? Math.PI : 0;
    const turns = Math.max(6, Math.ceil((coinFlip.startRotation - targetRotation) / (Math.PI * 2)) + 6);
    coinFlip.endRotation = targetRotation + turns * Math.PI * 2;
    coin.visible = true;
  };

  g.userData.update = (t) => {
    waterTex.offset.set(t * .008, t * .012); streamTex.offset.x = -t * 1.3;
    ripples.forEach((r, i) => { const p = (t * .8 + i * .23) % 1; r.scale.setScalar((1 + p * 5) * r.userData.s); r.material.opacity = .6 * (1 - p); });
    wheel.rotation.z = t * .6; tilt.rotation.x = -.3 + Math.sin(t * .7) * .04;
    leaves.forEach((l, i) => { l.rotation.x = Math.sin(t * 1.6 + i * 1.3) * .035; });
    swimmers.forEach((w, n) => {
      const fa = t * w.spd + w.ph, d = Math.sign(w.spd), fr = w.r0 + w.amp * Math.sin(fa * w.k), dr = w.amp * w.k * Math.cos(fa * w.k);
      w.fish.position.set(Math.cos(fa) * fr, w.y0 + Math.sin(t * 1.3 + n * 2) * .05, Math.sin(fa) * fr);
      w.fish.rotation.y = Math.atan2(d * (dr * Math.cos(fa) - fr * Math.sin(fa)), d * (dr * Math.sin(fa) + fr * Math.cos(fa)));
      w.tailP.rotation.y = Math.sin(t * w.tf) * .5; w.fbody.rotation.y = Math.sin(t * w.tf + 1) * .08;
      w.fins.forEach((f, i) => { f.rotation.z = Math.sin(t * 6 + i * 3) * .5; });
    });
    if (coinFlip.active) {
      if (coinFlip.startedAt === null) coinFlip.startedAt = t;
      const progress = Math.min(1, (t - coinFlip.startedAt) / 1.55);
      const eased = 1 - Math.pow(1 - progress, 3);
      coin.rotation.x = coinFlip.startRotation + (coinFlip.endRotation - coinFlip.startRotation) * eased;
      coin.rotation.z = Math.sin(progress * Math.PI) * .45;
      coin.position.y = 1.02 + Math.sin(progress * Math.PI) * .72;
      if (progress === 1) coinFlip.active = false;
    }
  };
  return g;
}
