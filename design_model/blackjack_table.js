// Blackjack table model for the casino map.
export function createBlackjackTable(THREE) {
  const g = new THREE.Group();
  g.name = 'BlackjackTable';
  const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .5, metalness: 0, ...o });
  const wood = M(0x3a150c, { roughness: .4 }), woodRed = M(0x55200f, { roughness: .4 });
  const leather = M(0x120d0b, { roughness: .5 }), felt = M(0x073a1c, { roughness: .97 });
  const gold = M(0xa88430, { metalness: .8, roughness: .35 }), steel = M(0x8a8e95, { metalness: .85, roughness: .3 }), black = M(0x101010, { roughness: .5 });
  const mesh = (geo, mat, x = 0, y = 0, z = 0, p = g) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    p.add(m);
    return m;
  };
  const box = (w, h, d, mat, x, y, z) => mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z);
  const flat = (shape, depth, mat, y, bevel = 0) => {
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: bevel > 0,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: 4,
      curveSegments: 48,
    });
    geo.rotateX(-Math.PI / 2);
    return mesh(geo, mat, 0, y, 0);
  };
  const half = (path, cx, cy, r) => {
    path.moveTo(cx - r, cy);
    path.absarc(cx, cy, r, Math.PI, Math.PI * 2, false);
    path.closePath();
    return path;
  };
  const canvas = (w, h) => {
    const element = document.createElement('canvas');
    element.width = w;
    element.height = h;
    return [element, element.getContext('2d')];
  };
  const R = 1.3, TOP = .75, CZ = .12;
  g.userData.replacementScale = .6;

  flat(half(new THREE.Shape(), 0, 0, R - .04), .07, wood, TOP - .13);
  flat(half(new THREE.Shape(), 0, 0, R), .06, woodRed, TOP - .06);
  flat(half(new THREE.Shape(), 0, -CZ, 1.0), .004, felt, TOP);
  const ring = half(new THREE.Shape(), 0, 0, R);
  ring.holes.push(half(new THREE.Path(), 0, -.06, 1.1));
  flat(ring, .035, leather, TOP, .015);
  const trim = [];
  for (let i = 0; i <= 48; i++) {
    const angle = Math.PI * i / 48;
    trim.push(new THREE.Vector3(Math.cos(angle) * 1.1, TOP + .012, .06 + Math.sin(angle) * 1.1));
  }
  mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(trim), 96, .007, 6), gold);
  for (let i = 0; i < 7; i++) {
    const angle = Math.PI * (.14 + .72 * i / 6), px = Math.cos(angle) * 1.2, pz = Math.sin(angle) * 1.2;
    const holder = mesh(new THREE.TorusGeometry(.032, .009, 8, 24), steel, px, TOP + .053, pz);
    holder.rotation.x = Math.PI / 2;
    mesh(new THREE.CylinderGeometry(.027, .027, .004, 20), black, px, TOP + .05, pz);
    if (i < 6) {
      const beadAngle = Math.PI * (.14 + .72 * (i + .5) / 6);
      mesh(new THREE.SphereGeometry(.009, 8, 6), steel, Math.cos(beadAngle) * 1.2, TOP + .052, Math.sin(beadAngle) * 1.2);
    }
  }

  const canvasSize = 512, [feltCanvas, ctx] = canvas(1024, 512);
  const arcText = (text, radius, fontSize, color) => {
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const widths = [...text].map(char => ctx.measureText(char).width * 1.08);
    const total = widths.reduce((sum, width) => sum + width, 0) / radius;
    let theta = Math.PI / 2 + total / 2;
    [...text].forEach((char, i) => {
      const angle = theta - widths[i] / 2 / radius;
      ctx.save();
      ctx.translate(canvasSize + radius * Math.cos(angle), radius * Math.sin(angle));
      ctx.rotate(angle - Math.PI / 2);
      ctx.fillText(char, 0, 0);
      ctx.restore();
      theta -= widths[i] / radius;
    });
  };
  arcText('BLACKJACK PAYS 3 TO 2', 220, 40, '#e8e8dc');
  arcText('INSURANCE PAYS 2 TO 1', 295, 34, '#d8c040');
  arcText('DEALER MUST DRAW ON 16 AND STAND ON ALL 17s', 250, 15, '#b8b8a8');
  ctx.strokeStyle = '#d8c040';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(canvasSize, 0, 335, .08 * Math.PI, .92 * Math.PI);
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(canvasSize, 0, 345, .09 * Math.PI, .91 * Math.PI);
  ctx.stroke();
  for (let i = 0; i < 7; i++) {
    const angle = Math.PI * (.14 + .72 * i / 6);
    ctx.save();
    ctx.translate(canvasSize + 430 * Math.cos(angle), 430 * Math.sin(angle));
    ctx.rotate(angle - Math.PI / 2);
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.rect(-34, -42, 68, 84);
    ctx.stroke();
    ctx.font = 'bold 22px sans-serif';
    ctx.fillStyle = '#d8c040';
    ctx.textAlign = 'center';
    ctx.fillText(String(i + 1), 0, 62);
    ctx.restore();
  }
  const feltTexture = new THREE.CanvasTexture(feltCanvas);
  feltTexture.anisotropy = 8;
  const feltPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 1),
    new THREE.MeshStandardMaterial({ map: feltTexture, transparent: true, roughness: .95 })
  );
  feltPlane.rotation.x = -Math.PI / 2;
  feltPlane.position.set(0, TOP + .0025, CZ + .5);
  g.add(feltPlane);

  const suitColors = { '♠': '#111', '♣': '#111', '♥': '#b01020', '♦': '#b01020' };
  const pips = {
    2: [[96, 62], [96, 208]],
    3: [[96, 62], [96, 135], [96, 208]],
    4: [[62, 62], [130, 62], [62, 208], [130, 208]],
    5: [[62, 62], [130, 62], [96, 135], [62, 208], [130, 208]],
    6: [[62, 62], [130, 62], [62, 135], [130, 135], [62, 208], [130, 208]],
    7: [[62, 62], [130, 62], [96, 98], [62, 135], [130, 135], [62, 208], [130, 208]],
    8: [[62, 62], [130, 62], [96, 98], [62, 135], [130, 135], [96, 172], [62, 208], [130, 208]],
    9: [[62, 62], [130, 62], [62, 112], [130, 112], [96, 135], [62, 158], [130, 158], [62, 208], [130, 208]],
    10: [[62, 62], [130, 62], [96, 88], [62, 112], [130, 112], [62, 158], [130, 158], [96, 182], [62, 208], [130, 208]],
  };
  const faceCache = {};
  const faceMaterial = (rank, suit) => faceCache[rank + suit] || (faceCache[rank + suit] = (() => {
    const [element, draw] = canvas(192, 270);
    draw.fillStyle = '#f2efe4';
    draw.fillRect(0, 0, 192, 270);
    draw.strokeStyle = '#a8a496';
    draw.lineWidth = 4;
    draw.strokeRect(2, 2, 188, 266);
    draw.fillStyle = suitColors[suit];
    draw.textAlign = 'center';
    draw.textBaseline = 'middle';
    const corner = () => {
      draw.font = `bold ${rank === '10' ? 34 : 42}px serif`;
      draw.fillText(rank, 24, 32);
      draw.font = '36px serif';
      draw.fillText(suit, 24, 72);
    };
    corner();
    draw.save();
    draw.translate(192, 270);
    draw.rotate(Math.PI);
    corner();
    draw.restore();
    const number = +rank;
    if (number >= 2) {
      pips[number].forEach(([px, py]) => {
        draw.save();
        draw.translate(px, py);
        if (py > 135) draw.rotate(Math.PI);
        draw.font = '44px serif';
        draw.fillText(suit, 0, 0);
        draw.restore();
      });
    } else if (rank === 'A') {
      draw.font = '120px serif';
      draw.fillText(suit, 96, 138);
    } else {
      draw.strokeStyle = suitColors[suit];
      draw.lineWidth = 3;
      draw.strokeRect(44, 50, 104, 170);
      draw.font = 'bold 96px serif';
      draw.fillText(rank, 96, 135);
      draw.font = '34px serif';
      draw.fillText(suit, 96, 72);
      draw.save();
      draw.translate(96, 198);
      draw.rotate(Math.PI);
      draw.fillText(suit, 0, 0);
      draw.restore();
    }
    return new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(element), roughness: .6 });
  })());
  const backMaterial = (() => {
    const [element, draw] = canvas(192, 270);
    draw.fillStyle = '#f2efe4';
    draw.fillRect(0, 0, 192, 270);
    draw.fillStyle = '#7a1420';
    draw.fillRect(10, 10, 172, 250);
    draw.strokeStyle = '#e8d8a8';
    draw.lineWidth = 2;
    for (let i = -270; i < 270; i += 18) {
      draw.beginPath();
      draw.moveTo(10, 135 + i);
      draw.lineTo(182, 135 + i + 172);
      draw.moveTo(10, 135 + i + 172);
      draw.lineTo(182, 135 + i);
      draw.stroke();
    }
    draw.lineWidth = 3;
    draw.strokeRect(10, 10, 172, 250);
    return new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(element), roughness: .6 });
  })();
  const cardEdge = M(0xe8e4d8, { roughness: .6 });
  const card = (rank, suit, faceDown) => new THREE.Mesh(
    new THREE.BoxGeometry(.062, .0015, .088),
    [cardEdge, cardEdge, faceDown ? backMaterial : faceMaterial(rank, suit), cardEdge, cardEdge, cardEdge]
  );
  const hand = (x, z, rotation, cards, faceDown = -1) => {
    const group = new THREE.Group();
    group.position.set(x, TOP + .0045, z);
    group.rotation.y = rotation;
    g.add(group);
    cards.forEach(([rank, suit], index) => {
      const meshCard = card(rank, suit, index === faceDown);
      const offset = index - (cards.length - 1) / 2;
      meshCard.position.set(offset * .042, .00075 + index * .0016, index * .006);
      meshCard.rotation.y = -offset * .09;
      meshCard.castShadow = meshCard.receiveShadow = true;
      group.add(meshCard);
    });
  };

  const chipColors = [0xc01818, 0x1f55c0, 0x1c8a48, 0xd8b820, 0x7a2a98, 0xd87818, 0x1aa0b8, 0xe8e8e8, 0xc84090, 0x303030];
  const sideTextures = chipColors.map(color => {
    const [element, draw] = canvas(128, 16);
    draw.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
    draw.fillRect(0, 0, 128, 16);
    draw.fillStyle = '#f0f0f0';
    for (let i = 0; i < 4; i++) draw.fillRect(i * 32 + 4, 2, 10, 12);
    draw.fillStyle = 'rgba(0,0,0,.55)';
    draw.fillRect(0, 14, 128, 2);
    const texture = new THREE.CanvasTexture(element);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    return texture;
  });
  const stack = (colorIndex, count, x, y, z) => {
    const height = .0036 * count;
    const texture = sideTextures[colorIndex].clone();
    texture.needsUpdate = true;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, count);
    const cap = M(chipColors[colorIndex], { roughness: .4 });
    mesh(
      new THREE.CylinderGeometry(.019, .019, height, 24),
      [new THREE.MeshStandardMaterial({ map: texture, roughness: .4 }), cap, cap],
      x, y + height / 2, z
    );
  };
  box(.52, .014, .12, steel, 0, TOP + .007, .2);
  for (const dz of [-.057, .057]) box(.52, .03, .006, steel, 0, TOP + .025, .2 + dz);
  for (let i = 0; i <= 10; i++) box(.004, .03, .11, steel, -.222 + i * .0444, TOP + .025, .2);
  box(.012, .03, .12, steel, -.26, TOP + .025, .2);
  box(.012, .03, .12, steel, .26, TOP + .025, .2);
  chipColors.forEach((color, i) => stack(i, 7 + ((i * 5) % 6), -.2 + i * .0444, TOP + .014, .2));
  const spot = (index, radius) => {
    const angle = Math.PI * (.14 + .72 * index / 6);
    return [Math.cos(angle) * radius, CZ + Math.sin(angle) * radius, angle];
  };
  const bets = { 1: [[0, 4], [3, 3]], 2: [[1, 5]], 4: [[2, 3], [6, 4]], 5: [[7, 2], [4, 3]] };
  for (const [index, stacks] of Object.entries(bets)) {
    const [x, z] = spot(+index, .84);
    stacks.forEach(([colorIndex, count], i) => stack(colorIndex, count, x + (i ? .03 : -.012), TOP + .004, z + (i ? .02 : 0)));
  }

  hand(0, CZ + .3, 0, [['K', '♠'], ['A', '♦']], 1);
  const presetHands = { 1: [['7', '♣'], ['9', '♥']], 2: [['A', '♠'], ['K', '♦']], 4: [['10', '♦'], ['6', '♠'], ['5', '♥']], 5: [['Q', '♣'], ['8', '♦']] };
  for (const [index, cards] of Object.entries(presetHands)) {
    const [x, z, angle] = spot(+index, .6);
    hand(x, z, Math.PI / 2 - angle, cards);
  }

  const shoe = new THREE.Group();
  shoe.position.set(.78, TOP, .22);
  shoe.rotation.y = -.5;
  g.add(shoe);
  mesh(new THREE.BoxGeometry(.2, .1, .14), black, 0, .05, 0, shoe);
  mesh(new THREE.BoxGeometry(.2, .012, .1), gold, 0, .106, .01, shoe).rotation.x = -.15;
  mesh(new THREE.BoxGeometry(.12, .06, .085), [cardEdge, cardEdge, backMaterial, cardEdge, cardEdge, cardEdge], -.01, .13, -.01, shoe).rotation.x = -.15;
  box(.08, .09, .06, black, -.88, TOP + .045, .2);
  box(.14, .006, .05, steel, -.68, TOP + .003, .2);
  box(.07, .03, .095, cardEdge, -.68, TOP + .018, .2);

  for (const side of [-1, 1]) {
    const x = side * .8, z = .55;
    mesh(new THREE.CylinderGeometry(.4, .42, .06, 8), wood, x, .03, z);
    mesh(new THREE.CylinderGeometry(.3, .36, .66, 8), woodRed, x, .36, z);
    for (const y of [.08, .64]) {
      const ring = mesh(new THREE.TorusGeometry(.33, .012, 6, 8), gold, x, y, z);
      ring.rotation.x = Math.PI / 2;
    }
    for (let i = 0; i < 8; i++) {
      const angle = Math.PI / 8 + i * Math.PI / 4;
      box(.14, .36, .012, wood, x + Math.sin(angle) * .312, .37, z + Math.cos(angle) * .312).rotation.y = angle;
    }
  }
  box(1.1, .12, .22, wood, 0, .42, .55);
  box(1.1, .012, .222, gold, 0, .42, .55);
  box(1.1, .5, .16, black, 0, .45, .1);
  box(.2, .014, .016, gold, 0, .5, .185);
  box(1.12, .01, .01, gold, 0, .21, .185);

  g.userData.type = 'blackjack';
  g.userData.update = () => {};
  return g;
}
