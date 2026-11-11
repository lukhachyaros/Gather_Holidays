// Builds the 3D scene, themed centerpieces, seats, Vampire NPC, fireworks, and tomato projectiles.
import * as THREE from 'three';
import { THEMES } from './themes.js';
import { getThemeFeatures } from './maps.js';
import {
  buildProp,
  buildTree,
  buildEnvelope,
  buildCinemaScreen,
  buildSingleChair,
  buildCoupleSofa,
  buildLogSeat,
  buildGiantChristmasTree,
  buildOrnamentTable,
  buildOrnamentMesh,
  buildCampfire,
  buildSnowman,
  buildGiantPumpkin,
  buildCarvedPumpkin,
  buildCostumeBooth,
  buildVampireNPC,
  buildGiantMaiTree,
  buildFireworkLauncher,
  buildFirecrackerTable,
  buildValentineHeartTree,
  buildLoveFountain,
  buildRoseArch,
  buildRouletteTable,
  buildDuckDerbyTrack,
  buildBlackjackTable,
  buildSlotMachine,
  buildPlinkoBoard,
  buildSecretPaperNote,
  buildSecretPassage,
  buildCasinoExitPortal,
  emojiTexture,
  geo,
  mat,
  G,
} from './props.js';

export const TILE = 2; // meters per grid tile
export const WALL_H = 1.6; // parkour-friendly wall height
const DARK = new Set(['halloween', 'tet', 'christmas', 'valentine', 'casino']);

const rnd = seed => {
  let s = 0;
  for (const c of String(seed)) s = (s * 31 + c.charCodeAt(0)) >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
};

export class World {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.dynamic = new THREE.Group();
    scene.add(this.dynamic);
    this.fxGroup = new THREE.Group();
    scene.add(this.fxGroup);

    this.decorObjs = new Map();
    this.cardObjs = new Map();
    this.ornamentGroup = new THREE.Group();
    this.scene.add(this.ornamentGroup);

    this.hemi = new THREE.HemisphereLight(0xffffff, 0x445566, 0.9);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 1);
    this.sun.position.set(22, 42, 16);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = sc.bottom = -34;
    sc.right = sc.top = 34;
    sc.near = 1;
    sc.far = 130;
    this.sun.shadow.bias = -0.0004;
    scene.add(this.sun, this.sun.target);

    this.mapKey = '';
    this.themeKey = '';
    this.ornamentKey = '';
    this.mediaBannerKey = '';
    this.particles = [];
    this.fireworks = []; // active rockets & bursts
    this.tomatoes = []; // flying tomato projectiles
    this.campfires = [];
    this.maiEnvelopes = [];
    this.valentineObjs = [];
    this.treeSlots = [];
    this.vampireNPC = null;
    this.vampireSwoop = null; // { tx, tz, until }
    this.screenObj = null;
    this.casinoObjs = [];
    this.features = { hotspots: [], seats: [], colliders: [], extraProps: [] };
    this.t = 0;
  }

  /** Reconcile scene with shared room state. */
  sync(state, roomSeed = 'lobby') {
    const mk = state.map.rows.join('|') + state.map.w + state.theme;
    if (mk !== this.mapKey || state.theme !== this.themeKey) {
      this.mapKey = mk;
      if (state.theme !== this.themeKey) {
        this.themeKey = state.theme;
        this.applyTheme(state.theme);
      }
      this.buildMap(state.map, state.theme, roomSeed);
    }

    // Sync user-placed decorations & ground cards
    this.syncList(state.decor || [], this.decorObjs, d => {
      const o = buildProp(d.e);
      const r = rnd(d.id);
      o.rotation.y = r() * 6.28;
      return o;
    });
    this.syncList(state.cards || [], this.cardObjs, () => buildEnvelope());

    // Sync Christmas Tree Ornaments
    const orns = state.treeOrnaments || [];
    const ok = state.theme + ':' + orns.map(o => `${o.id}:${o.key}`).join(',');
    if (ok !== this.ornamentKey) {
      this.ornamentKey = ok;
      this.ornamentGroup.clear();
      if (state.theme === 'christmas' && this.treeSlots.length) {
        orns.forEach((o, idx) => {
          const slot = this.treeSlots[idx % this.treeSlots.length];
          const mesh = buildOrnamentMesh(o.key, 1.15);
          mesh.position.set(14.5 * TILE + slot[0], slot[1], 11.5 * TILE + slot[2]);
          this.ornamentGroup.add(mesh);
        });
      }
    }

    // Sync Cinema Screen Banner
    if (this.screenObj?.userData?.updateBanner) {
      const q = state.mediaQueue || [];
      const cur = state.mediaCurrent;
      const bk = JSON.stringify({ v: cur?.id, t: cur?.title, by: cur?.addedByName, q: q.map(i => i.id) });
      if (bk !== this.mediaBannerKey) {
        this.mediaBannerKey = bk;
        this.screenObj.userData.updateBanner(cur, q);
      }
    }
  }

  syncList(list, objs, make) {
    const ids = new Set(list.map(i => i.id));
    for (const [id, o] of objs) {
      if (!ids.has(id)) {
        this.dynamic.remove(o);
        objs.delete(id);
      }
    }
    for (const it of list) {
      let o = objs.get(it.id);
      if (!o) {
        o = make(it);
        objs.set(it.id, o);
        this.dynamic.add(o);
      }
      o.position.set(it.x * TILE, 0, it.y * TILE);
    }
  }

  applyTheme(key) {
    const th = THEMES[key] || THEMES.christmas;
    const dark = DARK.has(key);
    const bg = new THREE.Color(th.bg);
    this.bgColor = bg;
    this.scene.background = null;
    this.scene.fog = new THREE.Fog(bg, 34, 92);
    this.hemi.color.set(key === 'halloween' ? '#a78bfa' : key === 'tet' ? '#fde68a' : key === 'valentine' ? '#fbcfe8' : '#e0f2fe');
    this.hemi.groundColor.set(dark ? '#1e1b2e' : '#8a7f70');
    this.hemi.intensity = key === 'halloween' ? 0.72 : key === 'valentine' ? 0.88 : 0.92;
    this.sun.color.set(key === 'halloween' ? '#c4b5fd' : key === 'valentine' ? '#fecdd3' : '#fff1d6');
    this.sun.intensity = key === 'halloween' ? 0.68 : key === 'valentine' ? 0.96 : 1.15;
    this.initParticles(th.particles);
  }

  buildMap(map, themeKey, roomSeed = 'lobby') {
    const th = THEMES[themeKey] || THEMES.christmas;
    this.scene.remove(this.group);
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.campfires = [];
    this.maiEnvelopes = [];
    this.valentineObjs = [];
    this.casinoObjs = [];
    this.treeSlots = [];
    this.vampireNPC = null;
    this.ornamentKey = '';

    const cells = { floor: [], path: [], wall: [], water: [], rug: [], tree: [] };
    for (let y = 0; y < map.h; y++) {
      for (let x = 0; x < map.w; x++) {
        const c = map.rows[y][x];
        if (c === '#') cells.wall.push([x, y]);
        else if (c === '~') cells.water.push([x, y]);
        else if (c === 'R') cells.rug.push([x, y]);
        else if (c === 'P') cells.path.push([x, y]);
        else {
          cells.floor.push([x, y]);
          if (c === 'T') cells.tree.push([x, y]);
        }
      }
    }

    const inst = (g, m, list, fn) => {
      if (!list.length) return null;
      const im = new THREE.InstancedMesh(g, m, list.length);
      const d = new THREE.Object3D(),
        col = new THREE.Color();
      list.forEach(([x, y], i) => {
        const r = fn(x, y, d, col);
        d.updateMatrix();
        im.setMatrixAt(i, d.matrix);
        if (r) im.setColorAt(i, r);
      });
      im.castShadow = im.receiveShadow = true;
      this.group.add(im);
      return im;
    };

    const slab = geo('slab', () => new THREE.BoxGeometry(TILE, 0.2, TILE));
    const wallG = geo('wall', () => new THREE.BoxGeometry(TILE, WALL_H, TILE));
    const white = mat('#ffffff');
    const f0 = new THREE.Color(th.floor[0]),
      f1 = new THREE.Color(th.floor[1]),
      pCol = new THREE.Color(th.path || th.floor[0]);

    inst(slab, white, cells.floor, (x, y, d, col) => {
      d.position.set(x * TILE, -0.1, y * TILE);
      return col.copy((x + y) & 1 ? f1 : f0);
    });
    inst(slab, white, cells.path, (x, y, d, col) => {
      d.position.set(x * TILE, -0.09, y * TILE);
      return col.copy(pCol);
    });
    inst(slab, white, cells.rug, (x, y, d, col) => {
      d.position.set(x * TILE, -0.07, y * TILE);
      return col.set(th.rug);
    });
    inst(
      slab,
      mat('#ffffff', { roughness: 0.2, metalness: 0.2, emissive: th.water, emissiveIntensity: 0.18 }),
      cells.water,
      (x, y, d, col) => {
        d.position.set(x * TILE, -0.22, y * TILE);
        return col.set(th.water);
      }
    );
    inst(wallG, white, cells.wall, (x, y, d, col) => {
      d.position.set(x * TILE, WALL_H / 2, y * TILE);
      return col.set(th.wall).multiplyScalar(0.85 + ((x * 7 + y * 13) % 5) * 0.05);
    });

    cells.tree.forEach(([x, y]) => {
      const t = buildTree(themeKey);
      t.position.set(x * TILE, 0, y * TILE);
      t.rotation.y = (x * 31 + y * 17) % 7;
      this.group.add(t);
    });

    // Roof props on perimeter walls
    cells.wall.forEach(([x, y]) => {
      if ((x + y) % 5 === 0) {
        const p = buildProp(th.prop);
        p.position.set(x * TILE, WALL_H, y * TILE);
        this.group.add(p);
      }
    });

    // Ground plane beyond map
    const ground = new THREE.Mesh(
      geo('ground', () => new THREE.PlaneGeometry(600, 600)),
      new THREE.MeshStandardMaterial({ color: new THREE.Color(th.bg).multiplyScalar(0.85), roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.4;
    ground.receiveShadow = true;
    this.group.add(ground);

    // ========================================================================
    // BUILD THEMED HOTSPOTS, CINEMA SCREEN, SEATS & CENTERPIECES
    // ========================================================================
    this.features = getThemeFeatures(themeKey, roomSeed);

    // 1. Cinema Screen
    this.screenObj = buildCinemaScreen();
    this.screenObj.position.set(14.5 * TILE, 0, 2.0 * TILE);
    this.group.add(this.screenObj);
    this.mediaBannerKey = '';

    // 2. Seats (Single chairs, Couple sofas, Campfire logs)
    for (const s of this.features.seats) {
      let mesh;
      if (s.kind === 'single') mesh = buildSingleChair();
      else if (s.kind === 'couple') mesh = buildCoupleSofa();
      else if (s.kind === 'log') mesh = buildLogSeat(s.meshRot || 0);
      if (mesh) {
        mesh.position.set(s.x * TILE, 0, s.y * TILE);
        if (s.kind !== 'log') mesh.rotation.y = 0; // faces North (-Z)
        this.group.add(mesh);
        s.mesh = mesh;
      }
    }

    // 3. Hotspots & Theme Centerpieces
    for (const h of this.features.hotspots) {
      if (h.type === 'xmas_tree') {
        const { group, slots } = buildGiantChristmasTree();
        group.position.set(h.x * TILE, 0, h.y * TILE);
        this.group.add(group);
        this.treeSlots = slots;
      } else if (h.type === 'ornament_table') {
        const tb = buildOrnamentTable();
        tb.position.set(h.x * TILE, 0, h.y * TILE);
        this.group.add(tb);
      } else if (h.type === 'campfire') {
        const cf = buildCampfire();
        cf.position.set(h.x * TILE, 0, h.y * TILE);
        this.group.add(cf);
        this.campfires.push(cf);
      } else if (h.type === 'giant_pumpkin') {
        const gp = buildGiantPumpkin();
        gp.position.set(h.x * TILE, 0, h.y * TILE);
        this.group.add(gp);
      } else if (h.type === 'small_pumpkin') {
        const sp = buildCarvedPumpkin(h.styleKey, 1.15);
        sp.position.set(h.x * TILE, 0, h.y * TILE);
        sp.rotation.y = h.rot || 0;
        this.group.add(sp);
      } else if (h.type === 'costume_booth') {
        const cb = buildCostumeBooth(h.costumeKey);
        cb.position.set(h.x * TILE, 0, h.y * TILE);
        this.group.add(cb);
      } else if (h.type === 'mai_tree') {
        const mt = buildGiantMaiTree();
        mt.position.set(h.x * TILE, 0, h.y * TILE);
        this.group.add(mt);
        this.maiEnvelopes = mt.userData.envelopes || [];
      } else if (h.type === 'firework_launcher') {
        const fl = buildFireworkLauncher();
        fl.position.set(h.x * TILE, 0, h.y * TILE);
        this.group.add(fl);
      } else if (h.type === 'firecracker_table') {
        const ft = buildFirecrackerTable();
        ft.position.set(h.x * TILE, 0, h.y * TILE);
        this.group.add(ft);
      } else if (h.type === 'heart_tree') {
        const ht = buildValentineHeartTree();
        ht.position.set(h.x * TILE, 0, h.y * TILE);
        this.group.add(ht);
        this.valentineObjs.push(ht);
      } else if (h.type === 'love_fountain') {
        const lf = buildLoveFountain();
        lf.position.set(h.x * TILE, 0, h.y * TILE);
        this.group.add(lf);
        this.valentineObjs.push(lf);
      } else if (h.type === 'roulette') {
        const rt = buildRouletteTable();
        rt.position.set(h.x * TILE, 0, h.y * TILE);
        this.group.add(rt);
        this.casinoObjs.push(rt);
      } else if (h.type === 'duck_derby') {
        const dd = buildDuckDerbyTrack();
        dd.position.set(h.x * TILE, 0, h.y * TILE);
        this.group.add(dd);
        this.casinoObjs.push(dd);
      } else if (h.type === 'blackjack') {
        const bj = buildBlackjackTable();
        bj.position.set(h.x * TILE, 0, h.y * TILE);
        this.group.add(bj);
        this.casinoObjs.push(bj);
      } else if (h.type === 'slot_machine') {
        [-0.85, 0, 0.85].forEach(ox => {
          const sm = buildSlotMachine();
          sm.position.set((h.x + ox) * TILE, 0, h.y * TILE);
          sm.rotation.y = Math.PI;
          this.group.add(sm);
          this.casinoObjs.push(sm);
        });
      } else if (h.type === 'plinko') {
        const pk = buildPlinkoBoard();
        pk.position.set(h.x * TILE, 0, h.y * TILE);
        pk.rotation.y = Math.PI;
        this.group.add(pk);
        this.casinoObjs.push(pk);
      } else if (h.type === 'secret_passage') {
        const sp = buildSecretPassage(themeKey);
        sp.position.set(h.x * TILE, 0, h.y * TILE);
        this.group.add(sp);
      } else if (h.type === 'secret_note') {
        const sn = buildSecretPaperNote(h.code);
        sn.position.set(h.x * TILE, 0, h.y * TILE);
        this.group.add(sn);
      } else if (h.type === 'casino_exit') {
        const ce = buildCasinoExitPortal();
        ce.position.set(h.x * TILE, 0, h.y * TILE);
        this.group.add(ce);
      }
    }

    // 4. Extra props (Random Snowmen in Christmas)
    for (const ep of this.features.extraProps) {
      if (ep.type === 'snowman') {
        const sm = buildSnowman(ep.variant);
        sm.position.set(ep.x * TILE, 0, ep.y * TILE);
        sm.rotation.y = ep.rot || 0;
        this.group.add(sm);
      } else if (ep.type === 'rose_arch') {
        const arch = buildRoseArch();
        arch.position.set(ep.x * TILE, 0, ep.y * TILE);
        arch.rotation.y = ep.rot || 0;
        this.group.add(arch);
        this.valentineObjs.push(arch);
      }
    }

    // 5. Flying Vampire NPC in Halloween
    if (themeKey === 'halloween') {
      this.vampireNPC = buildVampireNPC();
      this.vampireNPC.position.set(14.5 * TILE, 3.8, 11.5 * TILE);
      this.group.add(this.vampireNPC);
    }

    this. sun.target.position.set((map.w * TILE) / 2, 0, (map.h * TILE) / 2);
  }

  // ==========================================================================
  // SPECIAL EFFECTS: FIREWORKS, SMALL FIRECRACKERS, TOMATO THROW & VAMPIRE SWOOP
  // ==========================================================================
  triggerVampireSwoop(tx, tz) {
    this.vampireSwoop = { tx: tx * TILE, tz: tz * TILE, until: performance.now() + 2600 };
  }

  spawnTomatoThrow(fromX, fromZ, toX, toZ, onHit) {
    const mesh = new THREE.Mesh(G.sph(), mat('#e63946', { emissive: '#9b0000', emissiveIntensity: 0.4 }));
    mesh.scale.setScalar(0.32);
    const sx = fromX * TILE,
      sz = fromZ * TILE,
      ex = toX * TILE,
      ez = toZ * TILE;
    mesh.position.set(sx, 1.35, sz);
    this.fxGroup.add(mesh);
    this.tomatoes.push({ mesh, sx, sz, ex, ez, t: 0, dur: 0.55, onHit });
  }

  spawnFireworksShow(tileX, tileZ) {
    const bx = tileX * TILE,
      bz = tileZ * TILE;
    const colors = ['#ff595e', '#ffca3a', '#8ac926', '#00bbf9', '#f15bb5', '#ffd166'];
    for (let i = 0; i < 7; i++) {
      setTimeout(() => {
        const col = colors[i % colors.length];
        const rocket = new THREE.Mesh(G.sph(), mat(col, { emissive: col, emissiveIntensity: 2 }));
        rocket.scale.setScalar(0.24);
        const rx = bx + (Math.random() - 0.5) * 1.4;
        const rz = bz + (Math.random() - 0.5) * 1.4;
        rocket.position.set(rx, 1.2, rz);
        this.fxGroup.add(rocket);
        this.fireworks.push({
          kind: 'rocket',
          mesh: rocket,
          vx: (Math.random() - 0.5) * 2.5,
          vy: 13 + Math.random() * 4,
          vz: (Math.random() - 0.5) * 2.5,
          color: col,
          age: 0,
          maxAge: 0.85 + Math.random() * 0.25,
        });
      }, i * 320);
    }
  }

  spawnFirecrackers(tileX, tileZ) {
    const bx = tileX * TILE,
      bz = tileZ * TILE;
    const colors = ['#ff2a2a', '#ffd166', '#ff9f1c'];
    for (let i = 0; i < 26; i++) {
      const col = colors[i % colors.length];
      const spark = new THREE.Mesh(G.box(), mat(col, { emissive: col, emissiveIntensity: 2.2 }));
      spark.scale.setScalar(0.11);
      spark.position.set(bx + (Math.random() - 0.5) * 0.8, 1.05, bz + (Math.random() - 0.5) * 0.8);
      this.fxGroup.add(spark);
      const a = Math.random() * Math.PI * 2;
      const sp = 1.5 + Math.random() * 3.5;
      this.fireworks.push({
        kind: 'spark',
        mesh: spark,
        vx: Math.cos(a) * sp,
        vy: 2.5 + Math.random() * 4.0,
        vz: Math.sin(a) * sp,
        age: 0,
        maxAge: 0.55 + Math.random() * 0.4,
      });
    }
  }

  explodeRocket(x, y, z, color) {
    const m = mat(color, { emissive: color, emissiveIntensity: 2.4 });
    const light = new THREE.PointLight(color, 8, 28);
    light.position.set(x, y, z);
    this.fxGroup.add(light);
    setTimeout(() => this.fxGroup.remove(light), 550);

    for (let i = 0; i < 28; i++) {
      const p = new THREE.Mesh(G.sph(), m);
      p.scale.setScalar(0.22);
      p.position.set(x, y, z);
      this.fxGroup.add(p);
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const speed = 4.5 + Math.random() * 5.5;
      this.fireworks.push({
        kind: 'spark',
        mesh: p,
        vx: Math.sin(phi) * Math.cos(theta) * speed,
        vy: Math.cos(phi) * speed,
        vz: Math.sin(phi) * Math.sin(theta) * speed,
        age: 0,
        maxAge: 1.1 + Math.random() * 0.4,
      });
    }
  }

  initParticles(cfg) {
    for (const p of this.particles) this.scene.remove(p.s);
    this.particles = [];
    this.pcfg = cfg;
    cfg.emoji.forEach(e => emojiTexture(e));
    for (let i = 0; i < cfg.count; i++) {
      const e = cfg.emoji[i % cfg.emoji.length];
      const s = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: emojiTexture(e), transparent: true, opacity: 0.85, depthWrite: false })
      );
      const sc = 0.35 + Math.random() * 0.3;
      s.scale.set(sc, sc, 1);
      s.position.set((Math.random() - 0.5) * 44, Math.random() * 14 + 1, (Math.random() - 0.5) * 44);
      this.scene.add(s);
      this.particles.push({
        s,
        vy: cfg.vy[0] + Math.random() * (cfg.vy[1] - cfg.vy[0]),
        vx: cfg.vx[0] + Math.random() * (cfg.vx[1] - cfg.vx[0]),
        phase: Math.random() * 6.28,
      });
    }
  }

  update(dt, center) {
    this.t += dt;
    const now = performance.now();

    // 1. Ambient theme particles
    for (const p of this.particles) {
      p.s.position.y -= p.vy * dt;
      p.s.position.x += (p.vx + Math.sin(this.t + p.phase) * 0.25) * dt;
      if (p.s.position.y < 0.2) {
        p.s.position.y = 14;
        p.s.position.x = center.x + (Math.random() - 0.5) * 42;
        p.s.position.z = center.z + (Math.random() - 0.5) * 42;
      }
    }

    // 2. Campfire flame flicker
    for (const cf of this.campfires) {
      const fl = cf.userData.flames;
      if (fl) {
        fl[0].scale.y = 0.85 + Math.sin(this.t * 14) * 0.16;
        fl[1].scale.y = 0.6 + Math.cos(this.t * 18) * 0.15;
      }
    }

    // 3. Mai Tree hanging red envelopes gentle breeze sway
    for (let i = 0; i < this.maiEnvelopes.length; i++) {
      this.maiEnvelopes[i].rotation.z = Math.sin(this.t * 2.5 + i) * 0.14;
    }

    // 4. Flying Vampire NPC patrol & scare swoop (Halloween)
    if (this.vampireNPC) {
      const v = this.vampireNPC;
      const wingFlap = Math.sin(this.t * 15) * 0.55;
      if (v.userData.leftWing) v.userData.leftWing.rotation.y = wingFlap;
      if (v.userData.rightWing) v.userData.rightWing.rotation.y = -wingFlap;

      if (this.vampireSwoop && now < this.vampireSwoop.until) {
        // Swoop down right next to the target player!
        const sw = this.vampireSwoop;
        const a = Math.min(1, dt * 6);
        v.position.x += (sw.tx - v.position.x) * a;
        v.position.z += (sw.tz - 0.9 - v.position.z) * a;
        v.position.y += (1.1 - v.position.y) * a;
        v.rotation.y = Math.atan2(sw.tx - v.position.x, sw.tz - v.position.z);
      } else {
        this.vampireSwoop = null;
        // Figure-8 aerial patrol over the Halloween plaza
        const angle = this.t * 0.45;
        const tx = (14.5 + Math.sin(angle) * 7.5) * TILE;
        const tz = (11.5 + Math.sin(angle * 2) * 4.5) * TILE;
        const ty = 3.6 + Math.cos(this.t * 2.2) * 0.45;
        const dx = tx - v.position.x,
          dz = tz - v.position.z;
        v.position.set(tx, ty, tz);
        if (dx * dx + dz * dz > 0.0001) v.rotation.y = Math.atan2(dx, dz);
      }
    }

    // 5. Thrown Tomato Projectiles
    for (let i = this.tomatoes.length - 1; i >= 0; i--) {
      const tm = this.tomatoes[i];
      tm.t += dt;
      const u = Math.min(1, tm.t / tm.dur);
      tm.mesh.position.x = tm.sx + (tm.ex - tm.sx) * u;
      tm.mesh.position.z = tm.sz + (tm.ez - tm.sz) * u;
      tm.mesh.position.y = 1.3 + Math.sin(u * Math.PI) * 2.1;
      if (u >= 1) {
        this.fxGroup.remove(tm.mesh);
        this.spawnFirecrackers(tm.ex / TILE, tm.ez / TILE);
        tm.onHit?.();
        this.tomatoes.splice(i, 1);
      }
    }

    // 6. Fireworks Rockets & Burst Sparks
    for (let i = this.fireworks.length - 1; i >= 0; i--) {
      const fw = this.fireworks[i];
      fw.age += dt;
      fw.mesh.position.x += fw.vx * dt;
      fw.mesh.position.y += fw.vy * dt;
      fw.mesh.position.z += fw.vz * dt;
      if (fw.kind === 'spark') {
        fw.vy -= 9.8 * dt;
        const s = Math.max(0.01, (1 - fw.age / fw.maxAge) * 0.2);
        fw.mesh.scale.setScalar(s);
      }
      if (fw.age >= fw.maxAge) {
        if (fw.kind === 'rocket') {
          this.explodeRocket(fw.mesh.position.x, fw.mesh.position.y, fw.mesh.position.z, fw.color);
        }
        this.fxGroup.remove(fw.mesh);
        this.fireworks.splice(i, 1);
      }
    }

    // 7. Bobbing/spinning user decor & cards
    const anim = o => {
      o.traverse(c => {
        if (c.userData.spin) c.rotation.y = this.t * 1.5;
        if (c.userData.bob) c.position.y = 0.85 + Math.sin(this.t * 2.2) * 0.1;
      });
    };
    this.decorObjs.forEach(anim);
    this.cardObjs.forEach(anim);
    this.valentineObjs.forEach(anim);

    // 8. Casino Arcade 3D models animation & physics
    for (const co of this.casinoObjs) {
      const u = co.userData;
      if (!u) continue;
      if (u.type === 'roulette') {
        if (u.isSpinning) {
          u.rotor.rotation.y += u.speed * dt;
          u.ballGroup.rotation.y += u.ballSpeed * dt;
          u.speed *= Math.pow(0.965, dt * 60);
          u.ballSpeed *= Math.pow(0.962, dt * 60);
          if (Math.abs(u.speed) < 0.25) {
            u.isSpinning = false;
            u.speed = 0;
            u.ballSpeed = 0;
            u.onComplete?.();
          }
        } else {
          u.rotor.rotation.y += 0.25 * dt;
        }
      } else if (u.type === 'duck_derby') {
        u.ducks.forEach((d, i) => {
          if (u.isRacing) {
            d.progress += d.speed * dt * 0.12;
            const theta = d.progress * Math.PI * 2;
            const rx = 3.2, rz = 1.35;
            d.group.position.x = Math.sin(theta) * rx + (Math.sin(theta * 2) * 0.1);
            d.group.position.z = Math.cos(theta) * rz + (d.laneOffset * 0.25);
            d.group.position.y = 0.85 + Math.sin(this.t * 12 + i) * 0.04;
            d.group.rotation.y = theta + Math.PI / 2;
            if (d.progress >= 1.0) {
              u.isRacing = false;
              u.onFinish?.(d.cfg);
            }
          } else {
            d.group.position.y = 0.85 + Math.sin(this.t * 3.0 + i) * 0.025;
          }
        });
      } else if (u.type === 'slot_machine') {
        u.reels.forEach(r => {
          if (!r.stopped) {
            r.group.rotation.x += r.speed * dt;
          }
        });
      } else if (u.type === 'plinko') {
        for (let bi = u.activeBalls.length - 1; bi >= 0; bi--) {
          const b = u.activeBalls[bi];
          b.vy -= 9.8 * dt;
          b.x += b.vx * dt;
          b.y += b.vy * dt;

          // Check collisions against pegs
          for (const peg of u.pegs) {
            const dx = b.x - peg.x;
            const dy = b.y - peg.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 0.09) {
              b.vx = (dx > 0 ? 1 : -1) * (0.45 + Math.random() * 0.55);
              b.vy = Math.abs(b.vy) * 0.42 + 0.2;
              b.y = peg.y + 0.09;
              break;
            }
          }

          b.mesh.position.x = b.x;
          b.mesh.position.y = b.y;

          if (b.y <= 0.48) {
            // Reached reward bin! Calculate bin index
            const binW = 2.1 / 11;
            const binIdx = Math.max(0, Math.min(10, Math.floor((b.x + 1.05) / binW)));
            const mults = ['100x', '29x', '5x', '2x', '0.5x', '0.2x', '0.5x', '2x', '5x', '29x', '100x'];
            b.onLand?.(mults[binIdx] || '1x');
            setTimeout(() => {
              co.remove(b.mesh);
            }, 1200);
            u.activeBalls.splice(bi, 1);
          }
        }
      }
    }
  }
}
