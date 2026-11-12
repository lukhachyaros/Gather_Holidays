// Ngai Vàng cung đình Huế – ghế đơn procedural, dựng theo ảnh tham chiếu.
// Drop-in thay buildSingleChair(): mặt ghế cao 0.44, quay mặt về -Z (Bắc), rộng ~1.0.
import * as THREE from 'three';

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

const BOX = new THREE.BoxGeometry(1, 1, 1);
const SPH = new THREE.SphereGeometry(1, 16, 12);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 14);
const CONE = new THREE.ConeGeometry(1, 1, 10);
const Z = new THREE.Vector3(0, 0, 1);

export function buildSingleChair() {
  const outer = new THREE.Group();
  const g = new THREE.Group();
  g.rotation.y = Math.PI;                 // mặt ghế hướng -Z
  outer.add(g);
  const rand = rng(1802);
  const rr = (a, b) => a + (b - a) * rand();

  const gold = new THREE.MeshStandardMaterial({ color: '#d4a017', metalness: 0.7, roughness: 0.32, emissive: '#3d2800', emissiveIntensity: 0.3 });
  const goldDeep = new THREE.MeshStandardMaterial({ color: '#b8860b', metalness: 0.65, roughness: 0.4 });
  const red = new THREE.MeshStandardMaterial({ color: '#9a1f14', roughness: 0.4, metalness: 0.1 });
  const redDark = new THREE.MeshStandardMaterial({ color: '#5e140d', roughness: 0.5 });
  const wood = new THREE.MeshStandardMaterial({ color: '#3e1812', roughness: 0.6 });
  const pearl = new THREE.MeshStandardMaterial({ color: '#ece6da', roughness: 0.25, metalness: 0.2 });

  const put = (geo, mat, p, s = [1, 1, 1], r = [0, 0, 0], parent = g) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(...p); m.scale.set(...s); m.rotation.set(...r);
    m.castShadow = true; m.receiveShadow = true;
    parent.add(m);
    return m;
  };

  // ---- hoa văn chạm nổi (các nút vàng nhỏ rải trên mặt hộp) ----
  const bumpList = [];
  const bumps = (cx, cy, cz, sx, sy, sz, faces, n) => {
    for (let i = 0; i < n; i++) {
      const f = faces[Math.floor(rand() * faces.length)];
      let x = cx + rr(-0.5, 0.5) * sx, y = cy + rr(-0.5, 0.5) * sy, z = cz + rr(-0.5, 0.5) * sz;
      if (f === 'f') z = cz + sz / 2 + 0.004;
      else if (f === 'b') z = cz - sz / 2 - 0.004;
      else if (f === 'l') x = cx - sx / 2 - 0.004;
      else if (f === 'r') x = cx + sx / 2 + 0.004;
      else y = cy + sy / 2 + 0.004;
      bumpList.push([x, y, z, rr(0.008, 0.017)]);
    }
  };

  // ================= BỆ =================
  const W = 0.98, D = 0.92;
  put(BOX, red, [0, 0.025, 0], [W, 0.05, D]);
  put(BOX, wood, [0, 0.082, 0], [W - 0.12, 0.026, D - 0.12]);                     // mặt bệ
  [[0, D / 2 - 0.03, W, 0.06], [0, -D / 2 + 0.03, W, 0.06]].forEach(([x, z, w, d]) => put(BOX, gold, [x, 0.07, z], [w, 0.065, d]));
  [-W / 2 + 0.03, W / 2 - 0.03].forEach(x => put(BOX, gold, [x, 0.07, 0], [0.06, 0.065, D - 0.12]));
  bumps(0, 0.07, D / 2 - 0.03, W, 0.065, 0.06, ['f', 't'], 70);
  bumps(0, 0.07, -D / 2 + 0.03, W, 0.065, 0.06, ['b', 't'], 40);
  bumps(-W / 2 + 0.03, 0.07, 0, 0.06, 0.065, D - 0.12, ['l', 't'], 45);
  bumps(W / 2 - 0.03, 0.07, 0, 0.06, 0.065, D - 0.12, ['r', 't'], 45);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {                       // núm góc bệ
    put(SPH, gold, [sx * (W / 2 - 0.03), 0.1, sz * (D / 2 - 0.03)], [0.05, 0.04, 0.05]);
    put(BOX, goldDeep, [sx * (W / 2 - 0.05), 0.02, sz * (D / 2 - 0.04)], [0.1, 0.04, 0.09]);   // chân bệ
  });

  // ================= CHÂN CONG =================
  [-1, 1].forEach(sx => [-1, 1].forEach(sz => {
    const curve = new THREE.CatmullRomCurve3([
      [0.29, 0.37, 0.24], [0.335, 0.28, 0.28], [0.3, 0.19, 0.3], [0.345, 0.12, 0.325],
    ].map(([x, y, z]) => new THREE.Vector3(sx * x, y, sz * z * (sz > 0 ? 1 : 0.95))));
    const leg = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.034, 8), gold);
    leg.castShadow = true; g.add(leg);
    put(SPH, gold, [sx * 0.345, 0.115, sz * 0.325 * (sz > 0 ? 1 : 0.95)], [0.055, 0.03, 0.055]);
    put(SPH, goldDeep, [sx * 0.3, 0.37, sz * 0.25], [0.05, 0.04, 0.05]);                 // đầu chân
  }));

  // ================= THÂN DƯỚI: DẢI CHẠM VÀNG =================
  put(BOX, gold, [0, 0.325, 0], [0.74, 0.085, 0.64]);
  bumps(0, 0.325, 0, 0.74, 0.085, 0.64, ['f', 'f', 'l', 'r', 'b'], 190);
  for (let i = -6; i <= 6; i++) {                                                        // diềm lượn sóng
    put(SPH, goldDeep, [i * 0.056, 0.272, 0.325], [0.032, 0.026, 0.014]);
    put(SPH, goldDeep, [0.375, 0.272, i * 0.047], [0.014, 0.026, 0.026]);
    put(SPH, goldDeep, [-0.375, 0.272, i * 0.047], [0.014, 0.026, 0.026]);
  }
  put(SPH, goldDeep, [0, 0.31, 0.33], [0.1, 0.055, 0.02]);                              // huy hiệu giữa
  put(SPH, gold, [0, 0.31, 0.342], [0.05, 0.03, 0.012]);

  // ================= DẢI ĐỎ KHẢM TRAI + MẶT NGỒI =================
  put(BOX, red, [0, 0.4, 0], [0.78, 0.07, 0.66]);
  [-0.23, 0, 0.23].forEach(x => put(BOX, pearl, [x, 0.4, 0.332], [0.16, 0.04, 0.006]));
  [-0.16, 0.16].forEach(z => [-1, 1].forEach(s => put(BOX, pearl, [s * 0.392, 0.4, z], [0.006, 0.04, 0.2])));
  put(BOX, gold, [0, 0.364, 0], [0.8, 0.014, 0.68]);
  put(BOX, gold, [0, 0.438, 0], [0.82, 0.014, 0.7]);
  bumps(0, 0.438, 0, 0.82, 0.014, 0.7, ['f', 'b', 'l', 'r'], 50);
  put(BOX, wood, [0, 0.43, 0], [0.76, 0.02, 0.64]);                                     // mặt ngồi (đỉnh y = 0.44)

  // ================= TAY VỊN / LƯNG CONG HÌNH MÓNG NGỰA =================
  const half = [[0.38, 0.74, 0.31], [0.405, 0.78, 0.18], [0.41, 0.86, 0.02], [0.4, 0.95, -0.14], [0.36, 1.03, -0.27], [0.26, 1.09, -0.35], [0.12, 1.12, -0.385], [0, 1.125, -0.39]];
  const pts = [...half.map(p => new THREE.Vector3(...p)), ...half.slice(0, -1).reverse().map(([x, y, z]) => new THREE.Vector3(-x, y, z))].reverse();
  const rail = new THREE.CatmullRomCurve3(pts);
  const railMesh = new THREE.Mesh(new THREE.TubeGeometry(rail, 90, 0.036, 10), red);
  railMesh.castShadow = true; g.add(railMesh);
  [0.07, 0.13, 0.19, 0.81, 0.87, 0.93, 0.5].forEach(t => {                               // đai vàng trên thanh tay vịn
    const p = rail.getPointAt(t), tg = rail.getTangentAt(t);
    const ring = put(new THREE.TorusGeometry(0.04, 0.009, 6, 14), gold, [p.x, p.y, p.z]);
    ring.quaternion.setFromUnitVectors(Z, tg);
  });

  // cột tiện
  [[0.37, 0.27, 0.73], [0.4, 0.02, 0.86], [0.33, -0.25, 1.02]].forEach(([x, z, top]) => [-1, 1].forEach(s => {
    const h = top - 0.44;
    put(CYL, red, [s * x, 0.44 + h / 2, z], [0.022, h, 0.022]);
    put(SPH, gold, [s * x, 0.5, z], [0.034, 0.026, 0.034]);
    put(SPH, gold, [s * x, 0.44 + h * 0.55, z], [0.03, 0.022, 0.03]);
    put(SPH, gold, [s * x, top - 0.03, z], [0.034, 0.022, 0.034]);
  }));

  // dải chạm vàng hai bên hông + lưng
  [-1, 1].forEach(s => {
    put(BOX, gold, [s * 0.385, 0.56, 0.0], [0.02, 0.085, 0.56]);
    bumps(s * 0.385, 0.56, 0, 0.02, 0.085, 0.56, [s > 0 ? 'r' : 'l'], 55);
  });
  put(BOX, red, [0, 0.64, -0.365], [0.7, 0.04, 0.035]);                                 // thanh ngang lưng
  put(BOX, red, [0, 0.86, -0.375], [0.15, 0.46, 0.03]);                                 // tấm lưng giữa
  put(BOX, gold, [0, 0.86, -0.355], [0.115, 0.4, 0.012]);
  put(BOX, redDark, [0, 0.86, -0.348], [0.07, 0.34, 0.01]);
  bumps(0, 0.86, -0.355, 0.115, 0.4, 0.012, ['f'], 90);
  [-1, 1].forEach(s => {                                                                // hoa văn vân mây hai bên lưng
    put(SPH, gold, [s * 0.2, 0.75, -0.36], [0.07, 0.02, 0.015]);
    put(SPH, gold, [s * 0.27, 0.9, -0.35], [0.05, 0.02, 0.015]);
  });

  // ================= ĐẦU RỒNG Ở HAI ĐẦU TAY VỊN =================
  [-1, 1].forEach(s => {
    const d = new THREE.Group();
    d.position.set(s * 0.385, 0.775, 0.335);
    g.add(d);
    put(SPH, gold, [0, 0, 0], [0.055, 0.05, 0.07], [0, 0, 0], d);                         // đầu
    put(SPH, gold, [0, -0.015, 0.075], [0.04, 0.03, 0.045], [0, 0, 0], d);                // mõm
    put(CONE, gold, [0, 0.0, 0.11], [0.018, 0.04, 0.018], [Math.PI / 2, 0, 0], d);        // mũi
    [-1, 1].forEach(e => {
      put(CONE, gold, [e * 0.03, 0.055, -0.02], [0.012, 0.06, 0.012], [-0.6, 0, e * 0.35], d);   // sừng
      put(SPH, new THREE.MeshStandardMaterial({ color: '#111' }), [e * 0.035, 0.015, 0.045], [0.009, 0.009, 0.009], [0, 0, 0], d);
    });
    for (let k = 0; k < 4; k++) put(SPH, gold, [0, 0.02 - k * 0.012, -0.06 - k * 0.04], [0.03, 0.026, 0.03], [0, 0, 0], d); // bờm
  });

  // ---- dựng instanced nút chạm ----
  const inst = new THREE.InstancedMesh(SPH, goldDeep, bumpList.length);
  const dummy = new THREE.Object3D();
  bumpList.forEach(([x, y, z, r], i) => {
    dummy.position.set(x, y, z); dummy.scale.set(r, r, r * 0.6); dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix(); inst.setMatrixAt(i, dummy.matrix);
  });
  g.add(inst);

  outer.userData.replacementScale = 1.2;
  return outer;
}
