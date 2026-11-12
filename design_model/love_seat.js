// Ghế Đôi Tình Yêu - procedural model (three.js r128+; r170 OK)
// Dùng: import { createLoveSeat } from './love_seat.js';
//   const seat = createLoveSeat(THREE, { color: 0x7a1020 }); scene.add(seat);
// Kích thước ~ rộng 2.0 (x) · sâu 1.9 (z) · cao 1.0 (y). Mặt trước hướng +z.
export function createLoveSeat(THREE, opt = {}) {
  const g = new THREE.Group(); g.name = 'LoveSeat';
  g.rotation.y = Math.PI;
  g.userData.replacementScale = 0.84;
  const V = (x, y) => new THREE.Vector2(x, y);
  const leather = new THREE.MeshPhysicalMaterial({ color: opt.color ?? 0x7a1020, roughness: .38, clearcoat: .6, clearcoatRoughness: .35 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x0e0e0e, roughness: .5, metalness: .3 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: .3, metalness: .9 });
  const btn = new THREE.MeshStandardMaterial({ color: 0x4a0a14, roughness: .4 });
  const mesh = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; g.add(m); return m; };

  // Biên dạng cạnh (x = chiều sâu, trước = +, y = cao) - đường cong chữ S
  const top = [V(.84, .42), V(.6, .46), V(.25, .38), V(-.1, .42), V(-.4, .64), V(-.68, .93), V(-.86, 1.0), V(-.95, .9)];
  const back = [V(-.97, .6), V(-.95, .3)];
  const sh = new THREE.Shape(); sh.moveTo(.92, .12); sh.lineTo(.92, .3); sh.splineThru(top); sh.splineThru(back); sh.lineTo(-.95, .12); sh.lineTo(.92, .12);
  const curve = new THREE.SplineCurve([V(.92, .3), ...top]);

  // 2 nửa ghế
  for (const s of [-1, 1]) {
    const geo = new THREE.ExtrudeGeometry(sh, { depth: .86, bevelEnabled: true, bevelThickness: .07, bevelSize: .06, bevelSegments: 6, curveSegments: 24 });
    geo.translate(0, 0, -.43); geo.rotateY(-Math.PI / 2);
    mesh(geo, leather, s * .5, 0, 0);
    // nút bấm (tufting) trên mặt ghế
    for (let r = 0; r <= 12; r++) {
      const u = .04 + r / 12 * .92, p = curve.getPoint(u), t = curve.getTangent(u), n = V(t.y, -t.x), off = .075 + .0;
      const cols = r % 2 ? [-.28, 0, .28] : [-.42, -.14, .14, .42];
      for (const c of cols) mesh(new THREE.SphereGeometry(.022, 10, 8), btn, s * .5 + c * .9, p.y + n.y * off, p.x + n.x * off).scale.set(1, .6, 1);
    }
  }
  // Đường nối giữa 2 nửa
  const edge = (x, dy, rad, mat) => { const pts = curve.getPoints(60).map(p => new THREE.Vector3(x, p.y - dy, p.x)); mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, rad, 6), mat); };
  // Viền đen + vàng dọc hai bên hông
  for (const x of [-1.0, 1.0]) { edge(x * 1.075, .12, .028, dark); edge(x * 1.08, .17, .012, gold); }
  // Đế đen + chân vàng
  mesh(new THREE.BoxGeometry(1.9, .1, 1.7), dark, 0, .09, -.02);
  for (const x of [-.85, .85]) for (const z of [-.7, .7]) {
    const f = mesh(new THREE.BoxGeometry(.16, .1, .3), dark, x, .05, z); f.rotation.z = Math.sign(x) * -.15;
    mesh(new THREE.BoxGeometry(.17, .012, .31), gold, x, .1, z);
  }
  g.userData.update = () => {};
  return g;
}
