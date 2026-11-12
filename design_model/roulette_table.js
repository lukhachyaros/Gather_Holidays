// Roulette table model and display animation.
export function createRouletteTable(THREE) {
  const g = new THREE.Group();
  g.name = 'RouletteTable';
  const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .5, metalness: 0, ...o });
  const wood = M(0x461a0f, { roughness: .4 });
  const woodD = M(0x3a170d, { roughness: .45 });
  const leather = M(0x1b1411, { roughness: .45 });
  const felt = M(0x0a4a24, { roughness: .95 });
  const gold = M(0xb8923a, { metalness: .8, roughness: .35 });
  const steel = M(0x9a9ea5, { metalness: .85, roughness: .3 });
  const mesh = (geo, material, x = 0, y = 0, z = 0, parent = g) => {
    const object = new THREE.Mesh(geo, material);
    object.position.set(x, y, z);
    object.castShadow = object.receiveShadow = true;
    parent.add(object);
    return object;
  };
  const box = (w, h, d, material, x, y, z, parent) =>
    mesh(new THREE.BoxGeometry(w, h, d), material, x, y, z, parent);
  const canvasTexture = (w, h, draw) => {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    draw(canvas.getContext('2d'), w, h);
    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = 8;
    return texture;
  };
  const roundedRect = (path, x, z, w, d, r) => {
    const x0 = x - w / 2, x1 = x + w / 2;
    const y0 = -(z + d / 2), y1 = -(z - d / 2);
    path.moveTo(x0 + r, y0);
    path.lineTo(x1 - r, y0);
    path.quadraticCurveTo(x1, y0, x1, y0 + r);
    path.lineTo(x1, y1 - r);
    path.quadraticCurveTo(x1, y1, x1 - r, y1);
    path.lineTo(x0 + r, y1);
    path.quadraticCurveTo(x0, y1, x0, y1 - r);
    path.lineTo(x0, y0 + r);
    path.quadraticCurveTo(x0, y0, x0 + r, y0);
    return path;
  };
  const flat = (shape, depth, material, y, bevel = 0) => {
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: bevel > 0,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: 4,
      curveSegments: 10,
    });
    geometry.rotateX(-Math.PI / 2);
    return mesh(geometry, material, 0, y, 0);
  };

  for (const x of [-.95, .95]) for (const z of [-.4, .4]) {
    box(.15, .6, .15, wood, x, .33, z);
    box(.2, .05, .2, gold, x, .025, z);
    box(.18, .04, .18, woodD, x, .62, z);
  }
  for (const z of [-.4, .4]) box(1.9, .07, .07, woodD, 0, .3, z);
  for (const x of [-.95, .95]) box(.07, .07, .8, woodD, x, .3, 0);
  box(1.9, .07, .07, woodD, 0, .3, 0);

  flat(roundedRect(new THREE.Shape(), 0, 0, 2.8, 1.3, .16), .06, wood, .66);
  const feltShape = new THREE.Shape();
  [[-1.3, -.55], [1.3, -.55], [1.3, .55], [-.5, .55], [-.5, 0], [-1.3, 0]]
    .forEach(([x, z], i) => feltShape[i ? 'lineTo' : 'moveTo'](x, -z));
  flat(feltShape, .004, felt, .72);
  const trim = roundedRect(new THREE.Shape(), 0, 0, 2.8, 1.3, .16);
  trim.holes.push(roundedRect(new THREE.Path(), 0, 0, 2.6, 1.1, .08));
  flat(trim, .035, leather, .72, .015);
  box(.03, .04, .55, leather, -.5, .74, .275);
  box(.8, .04, .03, leather, -.9, .74, 0);

  const redNumbers = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
  const layout = canvasTexture(1400, 510, (ctx) => {
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#f2f2e6';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const cell = (x, y, w, h, text, fill, size = 52, color = '#fff') => {
      if (fill) {
        ctx.fillStyle = fill;
        ctx.fillRect(x, y, w, h);
      }
      ctx.strokeRect(x, y, w, h);
      ctx.fillStyle = color;
      ctx.font = `bold ${size}px sans-serif`;
      ctx.fillText(text, x + w / 2, y + h / 2 + 3);
    };
    cell(2, 0, 98, 330, '0', 'rgba(0,80,30,.9)', 64);
    for (let i = 0; i < 12; i++) for (let row = 0; row < 3; row++) {
      const number = 3 * i + 3 - row;
      cell(100 + i * 100, row * 110, 100, 110, String(number), redNumbers.has(number) ? '#b81414' : '#0d0d0d');
    }
    for (let row = 0; row < 3; row++) cell(1300, row * 110, 98, 110, '2:1', null, 36);
    ['1st 12', '2nd 12', '3rd 12'].forEach((text, i) => cell(100 + i * 400, 330, 400, 90, text, null, 44));
    ['1-18', 'EVEN', '◆', '◆', 'ODD', '19-36'].forEach((text, i) =>
      cell(100 + i * 200, 420, 200, 90, text, null, 44, i === 2 ? '#d02020' : i === 3 ? '#050505' : '#fff')
    );
  });
  const layoutPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(1.4, .51),
    new THREE.MeshStandardMaterial({ map: layout, transparent: true, roughness: .95 })
  );
  layoutPlane.rotation.x = -Math.PI / 2;
  layoutPlane.position.set(.55, .7275, -.03);
  layoutPlane.scale.setScalar(.93);
  g.add(layoutPlane);

  for (const x of [-1.2, -1.08, -.96]) {
    box(.1, .035, .2, steel, x, .74, -.4);
    box(.07, .01, .17, M(0x222222), x, .76, -.4);
  }
  for (const [x, rotation] of [[-.78, .55], [-.66, .55]]) {
    const chipTray = box(.1, .035, .2, steel, x, .74, -.2);
    chipTray.rotation.y = rotation;
  }

  const wheel = new THREE.Group();
  wheel.position.set(-.95, .72, .33);
  g.add(wheel);
  mesh(new THREE.CylinderGeometry(.37, .4, .1, 48), wood, 0, .05, 0, wheel);
  const rim = mesh(new THREE.TorusGeometry(.36, .02, 8, 64), steel, 0, .105, 0, wheel);
  rim.rotation.x = Math.PI / 2;
  const track = mesh(new THREE.RingGeometry(.28, .34, 64), M(0x7a3a1c, { roughness: .25 }), 0, .1, 0, wheel);
  track.rotation.x = -Math.PI / 2;

  const order = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
  const pockets = canvasTexture(512, 512, (ctx, size) => {
    ctx.translate(size / 2, size / 2);
    const angle = Math.PI * 2 / 37;
    const innerRadius = size / 2 * .6, outerRadius = size / 2 - 4;
    order.forEach((number, i) => {
      ctx.fillStyle = number === 0 ? '#0a7a2e' : redNumbers.has(number) ? '#b81414' : '#0d0d0d';
      ctx.beginPath();
      ctx.arc(0, 0, outerRadius, i * angle - angle / 2, i * angle + angle / 2);
      ctx.arc(0, 0, innerRadius, i * angle + angle / 2, i * angle - angle / 2, true);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#d8b84a';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.save();
      ctx.rotate(i * angle);
      ctx.translate((innerRadius + outerRadius) / 2 + 22, 0);
      ctx.rotate(Math.PI / 2);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(number), 0, 0);
      ctx.restore();
    });
  });
  const rotor = new THREE.Group();
  rotor.position.y = .088;
  wheel.add(rotor);
  const pocketRing = new THREE.Mesh(new THREE.RingGeometry(.17, .28, 64), new THREE.MeshStandardMaterial({ map: pockets, roughness: .3 }));
  pocketRing.rotation.x = -Math.PI / 2;
  rotor.add(pocketRing);
  mesh(new THREE.ConeGeometry(.17, .09, 40), gold, 0, .045, 0, rotor);
  mesh(new THREE.CylinderGeometry(.015, .02, .12, 12), gold, 0, .13, 0, rotor);
  mesh(new THREE.SphereGeometry(.03, 16, 12), gold, 0, .2, 0, rotor);
  for (let i = 0; i < 4; i++) {
    const spoke = box(.16, .012, .012, gold, 0, .15, 0, rotor);
    spoke.rotation.y = i * Math.PI / 4;
  }
  const ballGroup = new THREE.Group();
  wheel.add(ballGroup);
  const ball = mesh(
    new THREE.SphereGeometry(.011, 12, 10),
    M(0xffffff, { roughness: .1, metalness: .3 }),
    .3, .112, 0, ballGroup
  );

  g.userData = {
    type: 'roulette',
    replacementScale: .6,
    rotor,
    ballGroup,
    isSpinning: false,
    speed: 0,
    ballSpeed: 0,
    update(t) {
      const state = this.casinoState;
      if (state?.isSpinning) {
        const progress = Math.min(Math.max(1 - Math.abs(state.speed) / 26, 0), 1);
        const radius = .315 - .09 * progress * progress;
        ball.position.set(radius, .112 - .022 * progress, 0);
        return;
      }
      rotor.rotation.y = t * .7;
      ballGroup.rotation.y = -t * 5;
      const progress = (t % 14) / 14;
      const settle = Math.min(Math.max((progress - .6) / .4, 0), 1);
      const radius = .315 - .09 * settle * settle;
      ball.position.set(radius, .112 - .022 * settle, 0);
    },
  };
  return g;
}
