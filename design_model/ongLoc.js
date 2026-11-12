// Tượng Ông Lộc (Lộc Tinh) trên đài sen – procedural 3D, dựng theo ảnh tham chiếu.
// Tự chứa (chỉ cần three). Gốc tọa độ = đáy đài sen, mặt tượng hướng +Z. Cao ≈ 2.0 đơn vị.
// Dùng: const loc = buildOngLoc(); loc.position.set(0, 1.25, -0.35); shrine.add(loc);
import * as THREE from 'three';

const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, metalness: 0.05, ...o });
const SPH = new THREE.SphereGeometry(1, 20, 14);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 16);
const CONE = new THREE.ConeGeometry(1, 1, 12);
const BOX = new THREE.BoxGeometry(1, 1, 1);

function put(parent, geo, mat, pos = [0, 0, 0], sc = [1, 1, 1], rot = [0, 0, 0]) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...pos); m.scale.set(...sc); m.rotation.set(...rot);
  m.castShadow = true; m.receiveShadow = true;
  parent.add(m);
  return m;
}

// Hình trụ thon nối 2 điểm
function limb(parent, a, b, r0, r1, mat) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
  const len = A.distanceTo(B);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, len, 12), mat);
  m.position.copy(A).add(B).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
  m.castShadow = true;
  parent.add(m);
  return m;
}

// Râu/tóc dài: nón dẹt bám theo thân (z điều chỉnh theo độ cong áo)
function hairStrand(parent, mat, { x, yTop, yBot, w, d, zTop, zBot }) {
  const geo = new THREE.ConeGeometry(1, 1, 10, 14, true);
  geo.rotateX(Math.PI);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = 0.5 - p.getY(i);                       // 0 ở gốc → 1 ở chóp
    const k = t * t * (3 - 2 * t);
    const px = p.getX(i) * w, pz = p.getZ(i) * d;
    p.setXYZ(i, x + px * (1 - 0.2 * t), yTop + (yBot - yTop) * t, zTop + (zBot - zTop) * k + pz);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  parent.add(m);
}

export function buildOngLoc({ scale = 0.9 } = {}) {
  const root = new THREE.Group();
  const g = new THREE.Group();
  root.add(g);

  const gold = M('#e8b93c', { metalness: 0.65, roughness: 0.3 });
  const robe = M('#c4514b', { roughness: 0.6, side: THREE.DoubleSide });
  const robeDark = M('#8f2f2f');
  const skin = M('#eaa89f', { roughness: 0.5 });
  const cheek = M('#e48484');
  const black = M('#0d0d10', { roughness: 0.25 });
  const jade = M('#3fae6a', { roughness: 0.2, metalness: 0.1 });
  const cream = M('#efe0d2');
  const lilac = M('#d3c6dc');
  const FIG = 0.4; // độ cao chân tượng so với đáy đài

  // ================= ĐÀI SEN =================
  const base = new THREE.Group(); g.add(base);
  put(base, CYL, M('#7c9fb3'), [0, 0.05, 0], [0.62, 0.1, 0.62]);               // đế xanh xám
  put(base, CYL, M('#8fd0c8'), [0, 0.14, 0], [0.56, 0.1, 0.56]);               // vòng ngọc lam
  put(base, new THREE.TorusGeometry(0.56, 0.018, 8, 40), gold, [0, 0.14, 0], [1, 1, 1], [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 16; i++) {                                                // hoa văn cuộn vàng
    const a = (i / 16) * Math.PI * 2;
    put(base, SPH, gold, [Math.sin(a) * 0.565, 0.14, Math.cos(a) * 0.565], [0.032, 0.032, 0.02], [0, a, 0]);
  }
  put(base, CYL, M('#e7a1b4'), [0, 0.22, 0], [0.5, 0.06, 0.5]);                  // vòng hồng
  if (typeof document !== 'undefined') {                                        // bảng chữ 福
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d');
    x.fillStyle = '#7c9fb3'; x.fillRect(0, 0, 64, 64);
    x.fillStyle = '#f3c84a'; x.font = 'bold 46px serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('福', 32, 34);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.08), new THREE.MeshStandardMaterial({ map: tex }));
    pl.position.set(0, 0.05, 0.625);
    base.add(pl);
  }
  // Cánh sen 3 tầng
  const petalMats = [M('#e592a6'), M('#ef9fb2'), M('#f3b3c1')];
  const layers = [[12, 0.46, 0.27, 0.45, [0.22, 0.075, 0.12]], [9, 0.34, 0.31, 0.85, [0.2, 0.07, 0.11]], [7, 0.22, 0.36, 1.15, [0.17, 0.065, 0.1]]];
  layers.forEach(([n, r, y, tilt, s], li) => {
    for (let i = 0; i < n; i++) {
      const pv = new THREE.Group();
      pv.rotation.y = (i / n) * Math.PI * 2 + li * 0.3;
      put(pv, SPH, petalMats[(i + li) % 3], [r, y, 0], s, [0, 0, tilt]);
      base.add(pv);
    }
  });
  put(base, CYL, M('#5f8f3d', { roughness: 1 }), [0, FIG - 0.02, 0], [0.3, 0.04, 0.3]); // rêu/đài trong

  // ================= THÂN ÁO =================
  const fig = new THREE.Group(); fig.position.y = FIG; g.add(fig);
  const PROF = [[0, 0.43], [0.1, 0.42], [0.3, 0.37], [0.5, 0.34], [0.7, 0.35], [0.85, 0.33], [1.0, 0.30], [1.12, 0.27], [1.22, 0.23], [1.29, 0.13], [1.32, 0.07]];
  const R = (y) => {
    for (let i = 1; i < PROF.length; i++) if (y <= PROF[i][0]) {
      const [y0, r0] = PROF[i - 1], [y1, r1] = PROF[i];
      return r0 + (r1 - r0) * ((y - y0) / (y1 - y0));
    }
    return PROF[PROF.length - 1][1];
  };
  // Vạt áo xòe hình chuông, gợn sóng cong cong như áo Ông Phúc
  const warp = (geo) => {
    const p = geo.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const k = Math.min(1, Math.max(0, (0.45 - v.y) / 0.45)), th = Math.atan2(v.x, v.z);
      const f = 1 + 0.32 * Math.pow(k, 1.4) + 0.07 * k * Math.cos(7 * th);
      p.setXYZ(i, v.x * f, v.y + 0.06 * k * k * Math.cos(7 * th), v.z * f);
    }
    geo.computeVertexNormals();
    return geo;
  };
  const body = new THREE.Mesh(warp(new THREE.LatheGeometry(PROF.map(([y, r]) => new THREE.Vector2(r, y)), 84)), robe);
  body.scale.x = 1.08; body.castShadow = true; fig.add(body);

  const strip = (y0, y1, half, color, off, extra = {}) => {
    const pts = [];
    for (let i = 0; i <= 14; i++) { const y = y0 + (y1 - y0) * (i / 14); pts.push(new THREE.Vector2(R(y) + off, y)); }
    const m = new THREE.Mesh(warp(new THREE.LatheGeometry(pts, 14, -half, half * 2)), M(color, { side: THREE.DoubleSide, ...extra }));
    m.scale.x = 1.08; fig.add(m);
  };
  strip(0.02, 1.1, 0.3, '#ecdcc0', 0.004);                 // nền kem giữa áo
  strip(0.02, 1.1, 0.13, '#3f5f93', 0.008);                // dải xanh
  strip(0.02, 1.1, 0.02, '#e8b93c', 0.012, { metalness: 0.6 });
  [-0.3, 0.3].forEach(p => {                               // viền vàng hai bên dải kem
    const pts = []; for (let i = 0; i <= 14; i++) { const y = 0.02 + 1.08 * (i / 14); pts.push(new THREE.Vector2(R(y) + 0.012, y)); }
    const m = new THREE.Mesh(warp(new THREE.LatheGeometry(pts, 2, p - 0.015, 0.03)), gold); m.scale.x = 1.08; fig.add(m);
  });
  const ring = (y, mat, tube) => {                         // viền gợn theo vạt áo
    const pts = [], r = R(y) + 0.012;
    for (let i = 0; i < 96; i++) {
      const a = (i / 96) * Math.PI * 2, v = new THREE.BufferAttribute(new Float32Array([Math.sin(a) * r, y, Math.cos(a) * r]), 3);
      const gq = { attributes: { position: v }, computeVertexNormals() {} }; warp(gq);
      pts.push(new THREE.Vector3(v.getX(0) * 1.08, v.getY(0), v.getZ(0)));
    }
    const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 192, tube, 6, true), mat);
    m.castShadow = true; fig.add(m);
  };
  ring(0.03, gold, 0.016); ring(0.17, robeDark, 0.013); ring(0.3, gold, 0.011);

  // Huy hiệu tròn vàng trên áo
  const decal = (phi, y, r = 0.04) => {
    const pv = new THREE.Group(); pv.rotation.y = phi;
    put(pv, CYL, gold, [0, y, R(y) * 1.08 + 0.012], [r, 0.01, r], [Math.PI / 2, 0, 0]);
    fig.add(pv);
  };
  [[-0.7, 0.95], [0.7, 0.95], [-0.9, 0.65], [0.9, 0.65], [-0.75, 0.4], [0.75, 0.4], [-1.2, 0.95], [1.2, 0.95], [-0.5, 1.12], [0.5, 1.12]].forEach(([p, y]) => decal(p, y));
  decal(0, 1.1, 0.05);                                      // huy hiệu ngực

  // Đai lưng vàng + ngọc
  put(fig, new THREE.TorusGeometry(R(0.78) * 1.03, 0.03, 8, 40), gold, [0, 0.78, 0], [1.08, 1, 1], [Math.PI / 2, 0, 0]);
  put(fig, SPH, jade, [0, 0.78, R(0.78) * 1.08 + 0.03], [0.07, 0.045, 0.03]);

  // Cổ áo, vai vàng
  put(fig, new THREE.TorusGeometry(0.15, 0.022, 8, 24), gold, [0, 1.28, 0.02], [1, 1, 1], [Math.PI / 2 - 0.2, 0, 0]);
  [-1, 1].forEach(s => put(fig, SPH, gold, [s * 0.3, 1.2, 0], [0.12, 0.05, 0.12], [0, 0, -s * 0.3]));

  // ================= TAY & NHƯ Ý =================
  [-1, 1].forEach(s => {
    // Tay áo ống tròn trơn, cong ở khuỷu (vai → khuỷu → cổ tay), có mũ vai tròn và cổ tay vàng
    const pts = [[0.31, 1.2, 0.0], [0.4, 1.08, 0.02], [0.44, 0.92, 0.07], [0.38, 0.84, 0.2], [0.25, 0.82, 0.31], [0.15, 0.82, 0.37]]
      .map(([x, y, z]) => new THREE.Vector3(s * x, y, z));
    const curve = new THREE.CatmullRomCurve3(pts);
    const sleeve = new THREE.Mesh(new THREE.TubeGeometry(curve, 28, 0.108, 14), robe);
    sleeve.castShadow = true; fig.add(sleeve);
    put(fig, SPH, robe, [s * 0.31, 1.2, 0], [0.108, 0.108, 0.108]);                      // mũ vai tròn
    const end = curve.getPointAt(1), tan = curve.getTangentAt(1);
    const cuff = put(fig, CYL, gold, [end.x, end.y, end.z], [0.118, 0.045, 0.118]);       // cổ tay vàng
    cuff.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tan);
    put(fig, SPH, skin, [s * 0.115, 0.8, 0.415], [0.065, 0.055, 0.07]);                  // bàn tay
  });
  const ruyi = new THREE.CatmullRomCurve3([[0.1, 0.8, 0.42], [0.2, 0.92, 0.4], [0.32, 1.08, 0.36], [0.39, 1.22, 0.31], [0.35, 1.31, 0.28], [0.3, 1.28, 0.27]].map(a => new THREE.Vector3(...a)));
  const ruyiMesh = new THREE.Mesh(new THREE.TubeGeometry(ruyi, 24, 0.03, 8), jade); ruyiMesh.castShadow = true; fig.add(ruyiMesh);
  put(fig, SPH, jade, [0.1, 0.78, 0.43], [0.05, 0.05, 0.06]);
  put(fig, SPH, gold, [0.31, 1.31, 0.27], [0.055, 0.05, 0.05]);

  // ================= ĐẦU =================
  const head = new THREE.Group(); head.position.y = 1.42; fig.add(head);
  put(head, SPH, skin, [0, 0, 0], [0.17, 0.18, 0.16]);
  [-1, 1].forEach(s => {
    put(head, SPH, skin, [s * 0.17, 0, 0], [0.03, 0.045, 0.025]);                    // tai
    put(head, SPH, cheek, [s * 0.1, -0.035, 0.125], [0.045, 0.035, 0.02]);            // má hồng
    put(head, new THREE.TorusGeometry(0.024, 0.006, 6, 12, Math.PI), black, [s * 0.065, 0.045, 0.148]); // mắt cười
    put(head, CYL, black, [s * 0.065, 0.09, 0.136], [0.004, 0.05, 0.004], [0, 0, Math.PI / 2 + s * 0.15]); // lông mày
    put(head, CONE, black, [s * 0.052, -0.088, 0.155], [0.02, 0.07, 0.014], [0, 0, s * -1.35]); // ria mép
  });
  put(head, SPH, M('#e89a90'), [0, -0.015, 0.165], [0.028, 0.03, 0.03]);               // mũi
  put(head, SPH, M('#c8302f'), [0, -0.085, 0.145], [0.04, 0.014, 0.012]);              // môi

  // Râu dài + tóc mai
  hairStrand(fig, black, { x: 0, yTop: 1.31, yBot: 0.8, w: 0.1, d: 0.04, zTop: 0.14, zBot: R(0.82) * 1.0 + 0.045 });
  [-1, 1].forEach(s => hairStrand(fig, black, { x: s * 0.15, yTop: 1.42, yBot: 0.95, w: 0.028, d: 0.016, zTop: 0.05, zBot: R(0.97) * 1.0 + 0.02 }));

  // ================= MŨ QUAN =================
  const hat = new THREE.Group(); hat.position.y = 1.42; head.parent.add(hat);
  put(hat, new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), M('#c4514b'), [0, 0.16, 0], [0.19, 0.14, 0.17]);
  put(hat, CYL, robeDark, [0, 0.14, 0], [0.19, 0.06, 0.172]);
  put(hat, new THREE.TorusGeometry(0.19, 0.012, 6, 36), gold, [0, 0.17, 0], [1, 0.9, 0.9], [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 16; i++) {                                                      // hạt vàng quanh mũ
    const a = (i / 16) * Math.PI * 2;
    put(hat, SPH, gold, [Math.sin(a) * 0.17, 0.215, Math.cos(a) * 0.152], [0.014, 0.014, 0.014]);
  }
  put(hat, SPH, jade, [0, 0.19, 0.175], [0.026, 0.026, 0.014]);                        // ngọc trước mũ
  put(hat, CONE, gold, [0, 0.35, 0], [0.035, 0.11, 0.035]);                            // chóp vàng
  put(hat, SPH, gold, [0, 0.29, 0], [0.04, 0.04, 0.04]);
  put(hat, BOX, M('#a93c3c'), [0, 0.27, -0.14], [0.2, 0.22, 0.07]);                    // cánh mũ sau
  put(hat, BOX, gold, [0, 0.38, -0.14], [0.21, 0.02, 0.075]);
  [-1, 1].forEach(s => {
    // cánh mũ cong vút hai bên
    const c = new THREE.CatmullRomCurve3([[s * 0.17, 0.1, 0], [s * 0.26, 0.03, 0], [s * 0.33, 0.0, 0], [s * 0.39, 0.05, 0], [s * 0.4, 0.11, 0]].map(a => new THREE.Vector3(...a)));
    const t = new THREE.Mesh(new THREE.TubeGeometry(c, 16, 0.02, 6), M('#c4514b')); t.castShadow = true; hat.add(t);
    put(hat, SPH, gold, [s * 0.4, 0.12, 0], [0.032, 0.032, 0.03]);
    for (let k = -1; k <= 1; k++)                                                      // lá vàng hai bên
      put(hat, CONE, gold, [s * 0.21, 0.15, 0.02], [0.022, 0.1, 0.008], [0, 0, -s * (1.0 + k * 0.4)]);
  });

  root.scale.setScalar(scale);
  root.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return root;
}
