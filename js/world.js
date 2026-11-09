// Builds the 3D scene from the shared room state (map grid, theme, decor, cards).
import * as THREE from 'three';
import { THEMES } from './themes.js';
import { buildProp, buildTree, buildEnvelope, emojiTexture, geo, mat } from './props.js';

export const TILE = 2;          // meters per grid tile; tile i is centered at i*TILE
export const WALL_H = 2.6;
const DARK = new Set(['halloween', 'midautumn', 'newyear']);
const rnd = seed => { let s = 0; for (const c of seed) s = (s * 31 + c.charCodeAt(0)) >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };

export class World {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group(); scene.add(this.group);
    this.dynamic = new THREE.Group(); scene.add(this.dynamic);
    this.decorObjs = new Map(); this.cardObjs = new Map();
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x445566, 0.9); scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 1); this.sun.position.set(20, 40, 10);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera; sc.left = sc.bottom = -26; sc.right = sc.top = 26; sc.near = 1; sc.far = 120;
    this.sun.shadow.bias = -0.0004; scene.add(this.sun, this.sun.target);
    this.mapKey = ''; this.themeKey = ''; this.particles = []; this.t = 0;
  }

  /** Reconcile scene with state. Cheap when nothing changed. */
  sync(state) {
    const mk = state.map.rows.join('|') + state.map.w;
    if (mk !== this.mapKey || state.theme !== this.themeKey) {
      this.mapKey = mk;
      if (state.theme !== this.themeKey) { this.themeKey = state.theme; this.applyTheme(state.theme); }
      this.buildMap(state.map, state.theme);
    }
    this.syncList(state.decor, this.decorObjs, d => { const o = buildProp(d.e); const r = rnd(d.id); o.rotation.y = r() * 6.28; return o; });
    this.syncList(state.cards, this.cardObjs, () => buildEnvelope());
  }

  syncList(list, objs, make) {
    const ids = new Set(list.map(i => i.id));
    for (const [id, o] of objs) if (!ids.has(id)) { this.dynamic.remove(o); objs.delete(id); }
    for (const it of list) {
      let o = objs.get(it.id);
      if (!o) { o = make(it); objs.set(it.id, o); this.dynamic.add(o); }
      o.position.set(it.x * TILE, 0, it.y * TILE);
    }
  }

  applyTheme(key) {
    const th = THEMES[key], dark = DARK.has(key);
    const bg = new THREE.Color(th.bg);
    this.scene.background = bg;
    this.scene.fog = new THREE.Fog(bg, 30, 85);
    this.hemi.color.set(dark ? '#8f9bff' : '#ffffff'); this.hemi.groundColor.set(dark ? '#201836' : '#8a7f70');
    this.hemi.intensity = dark ? 0.75 : 1.0;
    this.sun.color.set(dark ? '#a9b4ff' : '#fff1d6'); this.sun.intensity = dark ? 0.7 : 1.3;
    this.initParticles(th.particles);
  }

  buildMap(map, themeKey) {
    const th = THEMES[themeKey];
    this.scene.remove(this.group); this.group = new THREE.Group(); this.scene.add(this.group);
    const cells = { floor: [], wall: [], water: [], rug: [], screen: [], tree: [] };
    for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) {
      const c = map.rows[y][x];
      if (c === '#') { cells.wall.push([x, y]); }
      else if (c === '~') cells.water.push([x, y]);
      else if (c === 'R') cells.rug.push([x, y]);
      else { cells.floor.push([x, y]); if (c === 'S') cells.screen.push([x, y]); if (c === 'T') cells.tree.push([x, y]); }
    }
    const inst = (g, m, list, fn) => {
      if (!list.length) return null;
      const im = new THREE.InstancedMesh(g, m, list.length); const d = new THREE.Object3D(), col = new THREE.Color();
      list.forEach(([x, y], i) => { const r = fn(x, y, d, col); d.updateMatrix(); im.setMatrixAt(i, d.matrix); if (r) im.setColorAt(i, r); });
      im.castShadow = im.receiveShadow = true; this.group.add(im); return im;
    };
    const slab = geo('slab', () => new THREE.BoxGeometry(TILE, 0.2, TILE));
    const wallG = geo('wall', () => new THREE.BoxGeometry(TILE, WALL_H, TILE));
    const white = mat('#ffffff');
    const f0 = new THREE.Color(th.floor[0]), f1 = new THREE.Color(th.floor[1]);
    inst(slab, white, cells.floor, (x, y, d, col) => { d.position.set(x * TILE, -0.1, y * TILE); return col.copy((x + y) & 1 ? f1 : f0); });
    inst(slab, white, cells.rug, (x, y, d, col) => { d.position.set(x * TILE, -0.08, y * TILE); return col.set(th.rug); });
    inst(slab, mat('#ffffff', { roughness: 0.2, metalness: 0.2, emissive: th.water, emissiveIntensity: 0.15 }), cells.water,
      (x, y, d, col) => { d.position.set(x * TILE, -0.25, y * TILE); return col.set(th.water); });
    inst(wallG, white, cells.wall, (x, y, d, col) => { d.position.set(x * TILE, WALL_H / 2, y * TILE); return col.set(th.wall).multiplyScalar(0.85 + ((x * 7 + y * 13) % 5) * 0.05); });
    // Shared screens: dark slab with glowing face
    inst(geo('screen', () => new THREE.BoxGeometry(TILE, 2.0, 0.35)), mat('#0b1020', { emissive: '#2a5a9a', emissiveIntensity: 0.9 }), cells.screen,
      (x, y, d) => { d.position.set(x * TILE, 1.4, y * TILE); });
    inst(geo('screenBase', () => new THREE.BoxGeometry(TILE, 0.4, 0.6)), mat('#222'), cells.screen, (x, y, d) => { d.position.set(x * TILE, 0.2, y * TILE); });
    cells.tree.forEach(([x, y]) => { const t = buildTree(themeKey); t.position.set(x * TILE, 0, y * TILE); t.rotation.y = ((x * 31 + y * 17) % 7); this.group.add(t); });
    // roof props on walls
    cells.wall.forEach(([x, y]) => { if ((x + y) % 5 === 0 && x > 0 && y > 0 && x < map.w - 1 && y < map.h - 1 || (x + y) % 6 === 0) { const p = buildProp(th.prop); p.position.set(x * TILE, WALL_H, y * TILE); this.group.add(p); } });
    // ground beyond the map
    const ground = new THREE.Mesh(geo('ground', () => new THREE.PlaneGeometry(600, 600)), new THREE.MeshStandardMaterial({ color: new THREE.Color(th.bg).multiplyScalar(0.9), roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.4; ground.receiveShadow = true; this.group.add(ground);
    this.bounds = { w: map.w * TILE, h: map.h * TILE };
  }

  initParticles(cfg) {
    for (const p of this.particles) this.scene.remove(p.s);
    this.particles = []; this.pcfg = cfg;
    cfg.emoji.forEach(e => emojiTexture(e));
    for (let i = 0; i < cfg.count * 1.5; i++) {
      const e = cfg.emoji[i % cfg.emoji.length];
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTexture(e), transparent: true, depthWrite: false, opacity: 0.9 }));
      s.scale.setScalar(0.35 + Math.random() * 0.25);
      s.position.set((Math.random() - 0.5) * 40, Math.random() * 14, (Math.random() - 0.5) * 40);
      this.scene.add(s);
      this.particles.push({ s, vy: -(cfg.vy[0] + Math.random() * (cfg.vy[1] - cfg.vy[0])) * 2, vx: (cfg.vx[0] + Math.random() * (cfg.vx[1] - cfg.vx[0])) * 1.5 });
    }
  }

  update(dt, focus) {
    this.t += dt;
    // Follow light/shadow frustum around the player
    this.sun.target.position.set(focus.x, 0, focus.z);
    this.sun.position.set(focus.x + 20, 40, focus.z + 10);
    for (const p of this.particles) {
      const s = p.s; s.position.y += p.vy * dt; s.position.x += p.vx * dt + Math.sin(this.t + s.position.z) * dt * 0.3;
      if (s.position.y < 0) { s.position.set(focus.x + (Math.random() - 0.5) * 40, 14, focus.z + (Math.random() - 0.5) * 40); }
      if (Math.abs(s.position.x - focus.x) > 22) s.position.x = focus.x + (Math.random() - 0.5) * 40;
      if (Math.abs(s.position.z - focus.z) > 22) s.position.z = focus.z + (Math.random() - 0.5) * 40;
    }
    // idle animations for props
    const anim = o => o.traverse(c => {
      if (c.userData.spin) c.rotation.y += dt;
      if (c.userData.bob) { c.userData.y0 ??= c.position.y; c.position.y = c.userData.y0 + Math.sin(this.t * 2 + c.id) * 0.08; }
    });
    this.cardObjs.forEach(anim); this.decorObjs.forEach(anim);
  }
}
