import * as THREE from 'three';

// Ghế sofa Halloween chắp vá. Mặt trước hướng +z, đáy chân ở y=0, rộng ~2.8, cao ~2.3.
// Dùng: const sofa = createHalloweenSofa(); scene.add(sofa); mỗi frame: sofa.userData.update(giây);
const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, metalness: 0, ...o });
const tex = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); draw(x, w, h); const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t; };
const rrect = (w, d, r) => { const s = new THREE.Shape(), x = -w / 2, y = -d / 2, P = Math.PI; s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.absarc(x + w - r, y + r, r, -P / 2, 0, false); s.lineTo(x + w, y + d - r); s.absarc(x + w - r, y + d - r, r, 0, P / 2, false); s.lineTo(x + r, y + d); s.absarc(x + r, y + d - r, r, P / 2, P, false); s.lineTo(x, y + r); s.absarc(x + r, y + r, r, P, P * 1.5, false); return s; };
function ext(shape, depth, bevel) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 14 });
  g.computeBoundingBox(); const b = g.boundingBox, uv = g.attributes.uv, p = g.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) - b.min.x) / (b.max.x - b.min.x), (p.getY(i) - b.min.y) / (b.max.y - b.min.y));
  return g;
}
const fab = (o) => M(0xffffff, { bumpMap: o.map, bumpScale: 2, ...o });
const patchTex = (w, h, seed, opt = {}) => tex(w, h, (x) => {
  let s = seed; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const pal = opt.pal || ['#5a2d6b', '#1b1a1f', '#c8641a', '#7a4a86', '#2a2030', '#8a3a86'];
  x.fillStyle = pal[0]; x.fillRect(0, 0, w, h);
  for (let i = 0; i < (opt.n || 9); i++) {
    const a = r() * w * .8, b = r() * h * .8, cw = w * (.2 + r() * .35), ch = h * (.25 + r() * .4);
    x.fillStyle = pal[Math.floor(r() * pal.length)]; x.fillRect(a, b, cw, ch);
    x.strokeStyle = 'rgba(230,200,150,.5)'; x.lineWidth = 2; x.setLineDash([8, 6]); x.strokeRect(a + 5, b + 5, cw - 10, ch - 10); x.setLineDash([]);
  }
  for (let i = 0; i < w * h / 60; i++) { x.fillStyle = r() > .5 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.07)'; x.fillRect(r() * w, r() * h, 2, 2); }
  if (opt.after) opt.after(x, w, h);
});
const stripeTex = (c1, c2, n = 10, vertical = false) => tex(256, 256, (x, w, h) => {
  x.fillStyle = c1; x.fillRect(0, 0, w, h); x.fillStyle = c2;
  for (let i = 0; i < n; i += 2) vertical ? x.fillRect(i * w / n, 0, w / n, h) : x.fillRect(0, i * h / n, w, h / n);
  x.globalAlpha = .45; x.fillStyle = '#000'; for (let i = 1; i < n; i += 2) vertical ? x.fillRect(i * w / n, 0, w / n, h) : x.fillRect(0, i * h / n, w, h / n);
});
const webTex = tex(256, 256, (x, w, h) => {
  x.strokeStyle = 'rgba(235,235,240,.8)'; x.lineWidth = 1.5;
  for (let k = 0; k <= 8; k++) { const a = k / 8 * Math.PI / 2; x.beginPath(); x.moveTo(0, 0); x.lineTo(Math.cos(a) * w, Math.sin(a) * h); x.stroke(); }
  for (let r = 1; r <= 7; r++) { x.beginPath(); for (let k = 0; k <= 8; k++) { const a = k / 8 * Math.PI / 2, rr = r * 34 * (1 - (k % 2) * .08); k ? x.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : x.moveTo(rr, 0); } x.stroke(); }
});

export function createHalloweenSofa() {
  const root = new THREE.Group(); root.name = 'HalloweenSofa';
  root.rotation.y = Math.PI;
  root.scale.y = 0.52;
  const woodTex = tex(256, 256, (x, w, h) => { x.fillStyle = '#4a2c1c'; x.fillRect(0, 0, w, h); for (let i = 0; i < 110; i++) { x.strokeStyle = i % 2 ? 'rgba(20,10,5,.3)' : 'rgba(130,85,50,.22)'; x.lineWidth = 1 + (i * 7 % 3); const y = (i * 37) % h; x.beginPath(); x.moveTo(0, y); for (let k = 1; k <= 8; k++) x.lineTo(k * w / 8, y + Math.sin(k + i) * 6); x.stroke(); } });
  const wood = M(0xffffff, { map: woodTex, bumpMap: woodTex, bumpScale: 1.5, roughness: 0.55 }), vine = M(0x2a1a10, { roughness: 0.8 });
  const add = (geo, mat, p, parent = root, rot, sc) => { const o = new THREE.Mesh(geo, mat); o.position.set(...p); if (rot) o.rotation.set(...rot); if (sc) o.scale.set(...sc); o.castShadow = o.receiveShadow = true; parent.add(o); return o; };
  const Bx = (w, h, d) => new THREE.BoxGeometry(w, h, d), Cy = (r, h, n = 14) => new THREE.CylinderGeometry(r, r, h, n), Sp = (r = 1, n = 16) => new THREE.SphereGeometry(r, n, Math.round(n * .75));

  // ---- khung gỗ + chân vuốt ----
  add(Bx(2.5, 0.14, 1.05), wood, [0, 0.33, 0]);
  [[-1.12, .42], [1.12, .42], [-1.12, -.4], [1.12, -.4]].forEach(([x, z]) => {
    add(new THREE.CylinderGeometry(.1, .06, .32, 10), wood, [x, .2, z]);
    add(Sp(1, 12), wood, [x, .06, z + .04], root, null, [.11, .07, .16]);
    [-1, 0, 1].forEach((k) => add(Sp(1, 8), wood, [x + k * .06, .035, z + .17], root, null, [.03, .03, .05]));
  });
  // ---- đế bọc + 2 đệm ngồi ----
  const seatTex = patchTex(512, 128, 7, { n: 7 });
  add(Bx(2.3, 0.3, 0.98), fab({ map: seatTex }), [0, 0.5, 0.0]);
  [[-.52, 21, 3], [.52, 5, 9]].forEach(([x, sd, n]) => {
    const g = ext(rrect(1.0, .86, .1), .13, .045); g.rotateX(-Math.PI / 2);
    add(g, fab({ map: patchTex(256, 256, sd, { n, pal: ['#1b1a1f', '#c8641a', '#5a2d6b', '#2a2030', '#7a4a86'] }), roughness: 0.9 }), [x, .665, .08]);
  });
  // ---- lưng ghế (mặt cười chắp vá) ----
  const bs = new THREE.Shape();
  bs.moveTo(-1.1, 0); bs.lineTo(1.1, 0); bs.lineTo(1.1, 1.3); bs.quadraticCurveTo(1.12, 1.5, 0.92, 1.5);
  bs.bezierCurveTo(.5, 1.5, .4, 1.25, 0, 1.25); bs.bezierCurveTo(-.4, 1.25, -.5, 1.5, -.92, 1.5); bs.quadraticCurveTo(-1.12, 1.5, -1.1, 1.3); bs.lineTo(-1.1, 0);
  const faceTex = patchTex(1024, 640, 13, { n: 8, pal: ['#6a3a7a', '#1b1a1f', '#7a4a86', '#5a2d6b', '#2a2030'], after: (x, w, h) => {
    x.fillStyle = '#85828a'; x.fillRect(w * .82, h * .08, w * .15, h * .2);
    x.fillStyle = '#c8641a'; x.fillRect(w * .02, h * .55, w * .14, h * .3);
    x.strokeStyle = '#0d0d10'; x.lineWidth = 16; x.lineCap = 'round'; x.beginPath(); x.moveTo(w * .2, h * .52); x.quadraticCurveTo(w * .5, h * .95, w * .8, h * .52); x.stroke();
    x.lineWidth = 5; x.strokeStyle = '#d8c9a0';
    for (let i = 0; i <= 16; i++) { const t = i / 16, a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t, px = a * w * .2 + b * w * .5 + c * w * .8, py = a * h * .52 + b * h * .95 + c * h * .52; x.beginPath(); x.moveTo(px, py - 22); x.lineTo(px, py + 22); x.stroke(); }
    x.fillStyle = '#0d0d10'; x.beginPath(); x.moveTo(w * .5, h * .38); x.lineTo(w * .47, h * .5); x.lineTo(w * .53, h * .5); x.fill();
  } });
  const bg = ext(bs, .22, .04); const back = add(bg, fab({ map: faceTex, roughness: 0.9 }), [0, .55, -.55]);
  // nút áo làm mắt
  const button = (x, c, cross) => {
    const b = add(Cy(.15, .05, 24), M(c, { roughness: .35 }), [x, 1.55, -.27], root, [Math.PI / 2, 0, 0]);
    if (cross) [.7, -.7].forEach((r) => add(Bx(.2, .02, .02), M(0x2a2018), [x, 1.55, -.24], root, [0, 0, r]));
    else [[-.04, -.04], [.04, -.04], [-.04, .04], [.04, .04]].forEach(([a, d]) => add(Cy(.016, .02, 8), M(0x555555), [x + a, 1.55 + d, -.24], root, [Math.PI / 2, 0, 0]));
    return b;
  };
  button(-.45, 0x222226, false); button(.35, 0xd9c9a2, true);
  // viền gỗ cong + dây leo quanh lưng
  const outline = [[-1.12, .55], [-1.12, 1.85], [-1.0, 2.04], [-.5, 1.94], [0, 1.8], [.5, 1.94], [1.0, 2.04], [1.12, 1.85], [1.12, .55]];
  const path = new THREE.CatmullRomCurve3(outline.map(([x, y]) => new THREE.Vector3(x, y, -.43)), false, 'catmullrom', .3);
  add(new THREE.TubeGeometry(path, 90, .05, 8), wood, [0, 0, 0]);
  const vp = []; for (let i = 0; i <= 120; i++) { const t = i / 120, p = path.getPoint(t), a = t * 60; vp.push(new THREE.Vector3(p.x, p.y + Math.cos(a) * .08, p.z + Math.sin(a) * .08)); }
  add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(vp), 240, .014, 5), vine, [0, 0, 0]);
  // dây leo quanh chân/khung đế
  const vb = []; for (let i = 0; i <= 80; i++) { const t = i / 80; vb.push(new THREE.Vector3(-1.2 + t * 2.4, .36 + Math.sin(t * 40) * .05, .5 + Math.cos(t * 40) * .05)); }
  add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(vb), 160, .012, 5), vine, [0, 0, 0]);

  // ---- tay vịn cuộn ----
  const armTex = patchTex(256, 256, 31, { n: 6, pal: ['#5a2d6b', '#1b1a1f', '#c8641a', '#7a4a86'] });
  [-1, 1].forEach((s, i) => {
    const x = s * 1.2; add(Bx(.3, .6, .96), fab({ map: i ? armTex : patchTex(256, 256, 44, { n: 6 }) }), [x, .8, 0]);
    add(Cy(.17, .98, 20), M(0x5a2d6b), [x, 1.14, 0], root, [Math.PI / 2, 0, 0]);
    add(Cy(.17, .03, 20), M(0x4a2358), [x, 1.14, .5], root, [Math.PI / 2, 0, 0]);
    add(new THREE.TorusGeometry(.1, .03, 8, 20), wood, [x, 1.14, .52]);
    add(Sp(1, 8), wood, [x, 1.14, .55], root, null, [.035, .035, .035]);
  });
  // dải vải rách đỏ cam đen rủ bên tay trái
  [[.95, .35, 0xc8641a], [.85, .3, 0x1b1a1f], [.9, .45, 0xc8641a], [.7, .3, 0x1b1a1f], [.8, .38, 0xc8641a]].forEach(([y, z, c], k) => add(Bx(.03, .22 + k * .02, .06), M(c), [-1.38 + k * .004, y - .1, .18 + k * .09], root, [0, 0, (k - 2) * .04]));

  // ---- đầu lâu trên nóc lưng ----
  const skull = new THREE.Group(); skull.position.set(-.82, 2.12, -.42); skull.rotation.y = .25; skull.scale.setScalar(.2); root.add(skull);
  const bone = M(0xe0d6bc, { roughness: .7 }), hollow = M(0x0a0a0a);
  add(Sp(1, 18), bone, [0, 0, 0], skull, null, [1, .95, 1.05]); add(Bx(.7, .35, .75), bone, [0, -.82, .2], skull);
  [-1, 1].forEach((s) => add(Sp(1, 10), hollow, [s * .38, -.08, .78], skull, null, [.28, .3, .15]));
  add(new THREE.ConeGeometry(.12, .24, 3), hollow, [0, -.4, .95], skull, [Math.PI, 0, 0]);
  for (let k = -2; k <= 2; k++) add(Bx(.1, .16, .05), M(0xf2ead2), [k * .13, -.95, .58], skull);

  // ---- búp bê vải voodoo ----
  const doll = new THREE.Group(); doll.position.set(-.75, .83, .08); doll.rotation.set(-.12, .35, .05); root.add(doll);
  const burlap = M(0xc49a63), brown = M(0x8a5a2a), thread = M(0x1a120a);
  add(Sp(1, 14), M(0xb8742f), [0, .3, 0], doll, null, [.18, .24, .15]);
  add(Bx(.1, .1, .01), M(0x5a2d6b), [.05, .28, .15], doll);
  add(Sp(1, 18), burlap, [0, .65, 0], doll, null, [.2, .19, .18]);
  [-1, 1].forEach((s) => {
    add(Sp(1, 10), M(0xf3ead2), [s * .075, .69, .17], doll, null, [.045, .045, .02]); add(Sp(1, 8), thread, [s * .075, .69, .185], doll, null, [.02, .02, .01]);
    add(Cy(.045, .3, 8), burlap, [s * .24, .3, .05], doll, [.4, 0, -s * 1.1]); add(Cy(.05, .3, 8), brown, [s * .1, .06, .22], doll, [Math.PI / 2 - .2, 0, 0]);
    add(Cy(.012, .1, 6), thread, [s * .13, .22, .13], doll, [0, 0, 1.57]);
  });
  for (let k = -3; k <= 3; k++) add(Bx(.015, .05, .008), thread, [k * .028, .58 + Math.abs(k) * -.012 * -1, .18], doll, [0, 0, 0]);
  add(Bx(.015, .1, .008), thread, [.01, .78, .15], doll); [-.1, 0, .1].forEach((x) => add(Cy(.012, .09, 5), M(0x6a3a1a), [x, .82, 0], doll, [0, 0, x * 3]));

  // ---- gối sọc cam đen ----
  add(Bx(.46, .46, .16), fab({ map: stripeTex('#c8641a', '#1b1a1f', 8, true) }), [-.98, 1.02, -.12], root, [0, .3, .35]);

  // ---- bí ngô điêu khắc ----
  const pk = new THREE.Group(); pk.position.set(.48, 1.1, -.02); pk.rotation.y = -.25; root.add(pk);
  const orange = M(0xe2711d, { roughness: .55 });
  for (let k = 0; k < 6; k++) add(Sp(1, 18), M(k % 2 ? 0xe2711d : 0xcf610f, { roughness: .5 }), [0, 0, 0], pk, [0, k * Math.PI / 6, 0], [.15, .25, .27]);
  add(Cy(.04, .12, 8), M(0x4a5a22), [.02, .27, 0], pk, [.2, 0, .25]);
  const faceT = tex(256, 256, (x, w, h) => {
    x.shadowColor = '#ffb020'; x.shadowBlur = 24; x.fillStyle = '#ffe06a';
    [[.3, .38], [.7, .38]].forEach(([u, v]) => { x.beginPath(); x.moveTo(w * u, h * (v - .12)); x.lineTo(w * (u - .11), h * (v + .08)); x.lineTo(w * (u + .11), h * (v + .08)); x.fill(); });
    x.beginPath(); x.moveTo(w * .5, h * .5); x.lineTo(w * .46, h * .58); x.lineTo(w * .54, h * .58); x.fill();
    x.beginPath(); x.moveTo(w * .2, h * .64); for (let i = 0; i <= 8; i++) x.lineTo(w * (.2 + i * .075), h * (.64 + (i % 2 ? .12 : .04) + Math.sin(i / 8 * Math.PI) * .08)); for (let i = 8; i >= 0; i--) x.lineTo(w * (.2 + i * .075), h * (.64 + Math.sin(i / 8 * Math.PI) * .1)); x.fill();
  });
  const decal = new THREE.Mesh(new THREE.SphereGeometry(.272, 32, 20, Math.PI / 2 - .85, 1.7, Math.PI / 2 - .7, 1.4), new THREE.MeshBasicMaterial({ map: faceT, transparent: true, depthWrite: false }));
  decal.scale.set(.74, 1, 1); decal.scale.set(1, .92, 1); pk.add(decal);
  const glow = new THREE.PointLight(0xff8a2a, 1, 3.2); glow.position.set(0, .02, .05); pk.add(glow);

  const cloth = (w, l, sd) => { const g = new THREE.PlaneGeometry(w, l, 18, 22); g.rotateX(-Math.PI / 2); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, Math.sin(x * 11 + sd) * .02 + Math.sin(z * 7 + x * 3 + sd * 2) * .016 + Math.cos(x * 23 + z * 5) * .006); } g.computeVertexNormals(); return g; };
  // ---- chăn sọc cam đen vắt qua tay phải ----
  const blTex = stripeTex('#c8641a', '#17171b', 10, false);
  const bl = new THREE.MeshStandardMaterial({ map: blTex, roughness: .95, side: THREE.DoubleSide });
  add(cloth(.58, .82, 1), bl, [1.2, 1.32, .02], root, [0, 0, -.06]);
  add(cloth(.62, .95, 3), bl, [.88, .74, .43], root, [.85, 0, 0]);
  for (let k = 0; k < 11; k++) add(Bx(.02, .13 + (k % 3) * .03, .01), M(k % 2 ? 0xc8641a : 0x17171b), [.62 + k * .056, .36, .74], root, [.85, 0, (k % 3 - 1) * .05]);

  // ---- mạng nhện + nhện ----
  const wm = new THREE.MeshBasicMaterial({ map: webTex, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  [[-.98, 1.9, -.26, .55, 0], [1.02, 1.55, -.26, .5, Math.PI / 2], [-1.36, 1.3, .1, .4, 0]].forEach(([x, y, z, s, r], i) => { const w = new THREE.Mesh(new THREE.PlaneGeometry(s, s), wm); w.position.set(x + s / 2 * (i === 1 ? -1 : 1), y - s / 2 * (i === 0 ? 1 : 1), z); w.rotation.z = r; w.scale.y = -1; if (i === 2) w.rotation.y = Math.PI / 2; root.add(w); });
  const spider = (x, y, z, s) => {
    const g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(s); root.add(g); const bk = M(0x050505, { roughness: .4 });
    add(Sp(1, 10), bk, [0, 0, 0], g, null, [.06, .05, .08]); add(Sp(1, 8), bk, [0, .01, .09], g, null, [.035, .03, .035]);
    for (let k = 0; k < 8; k++) { const sd = k < 4 ? 1 : -1, j = k % 4, a = (j - 1.5) * .45; add(Cy(.005, .16, 4), bk, [sd * .1, -.02, (j - 1.5) * .045], g, [a * .2, 0, sd * 1.0]); add(Cy(.004, .12, 4), bk, [sd * .2, -.05, (j - 1.5) * .06], g, [0, 0, -sd * .6]); }
    return g;
  };
  const sp1 = spider(-1.3, 1.34, -.05, 1.2), sp2 = spider(1.14, 2.0, -.3, 1);

  // ===== chi tiết thêm =====
  const dark = M(0x120d0a), gold = M(0xc8a02a, { metalness: .8, roughness: .3 });
  const inst = (geo, mat, n, fn) => { const im = new THREE.InstancedMesh(geo, mat, n), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(1, 1, 1), ps = new THREE.Vector3(); for (let i = 0; i < n; i++) { fn(i, ps, e, sc); q.setFromEuler(e); m4.compose(ps, q, sc); im.setMatrixAt(i, m4); } im.castShadow = true; root.add(im); return im; };
  // viền piping + nút cúc trên đệm
  const pipePts = rrect(1.09, .95, .14).getSpacedPoints(90).slice(0, 90);
  [-.52, .52].forEach((x) => { [.84, .625].forEach((y) => add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pipePts.map((p) => new THREE.Vector3(x + p.x, y, .08 - p.y)), true), 90, .016, 6, true), dark, [0, 0, 0]));
    [[-.22, -.12], [.22, -.12], [0, .2]].forEach(([a, b]) => { add(Sp(1, 8), dark, [x + a, .835, .08 + b], root, null, [.03, .014, .03]); [.78, -.78].forEach((r) => add(Bx(.07, .004, .008), M(0xd8c9a0), [x + a, .85, .08 + b], root, [0, r, 0])); }); });
  // viền rách quanh đáy ghế (trước + lưng)
  const hemC = [0x5a2d6b, 0x1b1a1f, 0xc8641a, 0x7a4a86];
  for (let k = 0; k < 24; k++) add(Bx(.07, .1 + (k * 7 % 5) * .025, .008), M(hemC[k % 4]), [-1.12 + k * .098, .3, .495], root, [0, 0, ((k * 13) % 7 - 3) * .035]);
  for (let k = 0; k < 22; k++) add(Bx(.08, .09 + (k * 5 % 4) * .03, .008), M(hemC[(k + 1) % 4]), [-1.05 + k * .1, .47, -.6], root, [0, 0, ((k * 11) % 7 - 3) * .03]);
  // đinh tán vàng dọc mép lưng ghế
  inst(Sp(1, 6), gold, 70, (i, p, e, sc) => { const t = path.getPoint(i / 69); p.set(t.x, t.y - .1, -.255); sc.set(.02, .02, .02); });
  // gai trên dây leo
  inst(new THREE.ConeGeometry(.011, .06, 4), vine, 80, (i, p, e) => { const v = vp[Math.floor(i / 80 * (vp.length - 1))]; p.copy(v); e.set(Math.sin(i * 7) * 1.5, 0, Math.cos(i * 5) * 1.5); });
  // dây leo quấn chân
  [[-1.12, .42], [1.12, .42], [-1.12, -.4], [1.12, -.4]].forEach(([x, z]) => { const pts = []; for (let i = 0; i <= 30; i++) { const t = i / 30, a = t * 14; pts.push(new THREE.Vector3(x + Math.cos(a) * .1, .04 + t * .3, z + Math.sin(a) * .1)); } add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, .01, 5), vine, [0, 0, 0]); });
  [-1.25, 1.25].forEach((x) => [-.5, .5].forEach((z) => add(Sp(1, 12), wood, [x, .33, z], root, null, [.075, .075, .075])));
  // tay vịn: viền gỗ chân tay, vòng chỉ khâu, cuộn xoắn
  [-1, 1].forEach((s) => { const x = s * 1.2; add(Bx(.36, .08, 1.02), wood, [x, .5, 0]);
    [-.35, -.12, .3].forEach((z) => add(new THREE.TorusGeometry(.172, .009, 6, 24), M(0xd8c9a0), [x, 1.14, z]));
    add(new THREE.TorusGeometry(.065, .02, 8, 16), wood, [x, 1.14, .535]); add(new THREE.TorusGeometry(.14, .012, 6, 20), M(0xc8a02a, { metalness: .7 }), [x, 1.14, .515]); });
  // đầu lâu: gò má, nứt, hàm răng dưới
  [-1, 1].forEach((sd) => add(Sp(1, 10), bone, [sd * .62, -.4, .52], skull, null, [.22, .2, .2]));
  add(Bx(.035, .5, .02), M(0x3a3020), [.32, .55, .9], skull, [.3, 0, .25]); add(Bx(.03, .3, .02), M(0x3a3020), [.2, .75, .8], skull, [.3, 0, -.5]);
  for (let k = -2; k <= 2; k++) add(Bx(.1, .13, .05), M(0xf2ead2), [k * .13, -.72, .6], skull);
  add(new THREE.TorusGeometry(.3, .04, 6, 16), bone, [-.38, -.08, .74], skull); add(new THREE.TorusGeometry(.3, .04, 6, 16), bone, [.38, -.08, .74], skull);
  // búp bê: tay chân, chỉ cổ, nút ngực, miếng vá má
  [-1, 1].forEach((sd) => { add(Sp(1, 8), burlap, [sd * .375, .37, .07], doll, null, [.05, .05, .05]); add(Sp(1, 8), M(0x6a3a1a), [sd * .1, .05, .38], doll, null, [.065, .05, .075]); });
  add(new THREE.TorusGeometry(.11, .012, 6, 16), thread, [0, .5, 0], doll, [Math.PI / 2, 0, 0]); add(Cy(.025, .01, 10), M(0x222226), [0, .36, .15], doll, [Math.PI / 2, 0, 0]);
  add(Bx(.08, .08, .01), M(0xb8742f), [-.13, .6, .165], doll, [0, .5, .2]); [.7, -.7].forEach((r) => add(Bx(.1, .008, .008), thread, [-.13, .6, .175], doll, [0, .5, r]));
  add(Sp(1, 8), brown, [0, .63, .19], doll, null, [.03, .025, .03]);
  // bí ngô: tua cuốn + lá
  { const pts = []; for (let i = 0; i <= 24; i++) { const t = i / 24, a = t * 9; pts.push(new THREE.Vector3(.06 + Math.cos(a) * .03 * (1 - t), .26 + t * .1, Math.sin(a) * .03 * (1 - t) + t * .1)); } add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, .006, 5), M(0x4a5a22), [0, 0, 0], pk); }
  add(Sp(1, 8), M(0x4a5a22), [-.09, .22, .02], pk, [0, 0, .5], [.09, .012, .06]);
  // thêm mạng nhện
  [[-1.05, 1.96, -.255, 1, -1], [1.1, 1.72, -.255, -1, -1], [-.3, 2.08, -.43, 1, -1]].forEach(([x, y, z, sx, sy], i) => { const w = new THREE.Mesh(new THREE.PlaneGeometry(.75, .75), wm); w.position.set(x, y, z); w.scale.set(sx * (i === 2 ? .45 : 1) * (i === 2 ? 1 : 1), sy * (i === 2 ? .45 : 1), 1); w.position.x += sx * .375 * (i === 2 ? .45 : 1); w.position.y += sy * .375 * (i === 2 ? .45 : 1); root.add(w); });
  const thr = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(1.14, 2.0, -.3), new THREE.Vector3(1.14, 2.4, -.3)]), new THREE.LineBasicMaterial({ color: 0xdddddd })); root.add(thr);

  root.traverse((o) => { if (o.isMesh && o.material && o.material.transparent) o.castShadow = false; });
  let sp2y = sp2.position.y;
  root.userData.update = (t) => {
    glow.intensity = 0.9 + Math.sin(t * 9) * .15 + Math.sin(t * 23) * .1;
    sp1.rotation.y = Math.sin(t * .7) * .3; sp2.position.y = sp2y + Math.sin(t * 1.2) * .06; sp2.rotation.y = t * .5;
    doll.rotation.z = .05 + Math.sin(t * .8) * .01;
  };
  root.userData.update(0);
  return root;
}
