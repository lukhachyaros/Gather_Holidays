// Builds the 3D scene, themed centerpieces, seats, Vampire NPC, fireworks, and tomato projectiles.
import * as THREE from 'three';
import { THEMES } from './themes.js';
import { getThemeFeatures } from './maps.js?v=20261114seasonalphase2';
import { instantiateReplacement } from './model-library.js?v=2026111217';
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
  buildPhucLocThoShrine,
  buildDragonAltar,
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
  buildIllusionWall,
  buildCasinoPubBar,
  emojiTexture,
  geo,
  mat,
  G,
} from './props.js';

const seededRandom = seed => {
  let value = (Number(seed) >>> 0) || 1;
  return () => { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value / 4294967296; };
};

export const TILE = 2; // meters per grid tile
export const WALL_H = 1.6; // parkour-friendly wall height

function buildSeasonalLandmark(type, variant = '') {
  const group = new THREE.Group();
  const addBox = (x, y, z, sx, sy, sz, material) => {
    const mesh = new THREE.Mesh(G.box(), material);
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };
  const addCylinder = (x, y, z, radius, height, material) => {
    const mesh = new THREE.Mesh(G.cyl(), material);
    mesh.position.set(x, y, z);
    mesh.scale.set(radius * 2, height, radius * 2);
    mesh.castShadow = true;
    group.add(mesh);
    return mesh;
  };
  const warm = mat('#fbbf24', { emissive: '#f59e0b', emissiveIntensity: 0.65, roughness: 0.35 });
  const cool = mat('#38bdf8', { emissive: '#0ea5e9', emissiveIntensity: 0.55, roughness: 0.3 });
  const pink = mat('#f472b6', { emissive: '#ec4899', emissiveIntensity: 0.7, roughness: 0.3 });
  const dark = mat('#24152f', { roughness: 0.85 });
  const wood = mat('#7c4a2d', { roughness: 0.8 });
  const white = mat('#f8fafc', { roughness: 0.55 });

  if (type === 'community_tree') {
    const evergreen = mat('#0f766e', { roughness: 0.76 });
    addBox(0, 0.16, 0, 2.1, 0.32, 1.15, wood);
    addBox(0, 0.36, 0, 1.7, 0.12, 0.92, warm);
    addBox(0, 0.76, 0, 1.45, 0.92, 1.08, evergreen);
    addBox(0, 1.32, 0, 1.08, 0.82, 0.84, evergreen);
    addBox(0, 1.86, 0, 0.7, 0.68, 0.58, evergreen);
    addCylinder(0, 2.3, 0, 0.13, 0.28, warm);
    [-0.48, 0, 0.48].forEach((x, i) => addBox(x, 0.86 + (i % 2) * 0.22, 0.57, 0.16, 0.16, 0.12, i === 1 ? warm : pink));
  } else if (type === 'sled_race') {
    [-1.35, 1.35].forEach(x => {
      addCylinder(x, 1.25, 0, 0.12, 2.5, cool);
      addBox(x, 2.45, 0, 0.28, 0.18, 0.28, white);
    });
    addBox(0, 2.42, 0, 2.95, 0.16, 0.18, cool);
    addBox(0, 1.2, 0, 2.55, 0.08, 0.08, warm);
    addBox(0, 0.46, 1.0, 1.12, 0.2, 1.5, wood);
    addBox(0, 0.62, 0.86, 0.82, 0.22, 0.72, warm);
    [-0.48, 0.48].forEach(x => {
      const runner = addCylinder(x, 0.13, 1.0, 0.065, 1.72, cool);
      runner.rotation.x = Math.PI / 2;
    });
    addBox(0, 0.8, 0.28, 0.84, 0.18, 0.18, white);
  } else if (type === 'haunted_mansion') {
    addBox(-2.55, 1.55, 0, 0.5, 3.1, 4.4, dark);
    addBox(2.55, 1.55, 0, 0.5, 3.1, 4.4, dark);
    addBox(0, 1.55, 2.05, 5.6, 3.1, 0.35, dark);
    addBox(-1.9, 1.55, -2.05, 1.8, 3.1, 0.35, dark);
    addBox(1.9, 1.55, -2.05, 1.8, 3.1, 0.35, dark);
    addBox(0, 2.95, -2.05, 2.1, 0.5, 0.35, dark);
    addBox(0, 3.2, 0, 6.0, 0.32, 4.8, wood);
    addBox(0, 0.08, 0, 5.35, 0.16, 4.15, wood);
    [-1.02, 1.02].forEach(x => {
      addBox(x, 1.2, -2.18, 0.18, 2.4, 0.22, warm);
      addBox(x * 1.8, 2.0, -2.2, 0.7, 0.78, 0.12, warm);
    });
    addBox(0, 1.35, -1.98, 1.45, 0.12, 0.16, wood);
    addBox(0, 2.78, -2.0, 1.75, 0.18, 0.2, warm);
  } else if (type === 'costume_runway') {
    addBox(0, 0.18, 0, 4.3, 0.36, 2.25, dark);
    addBox(0, 0.39, 0, 3.9, 0.08, 1.9, pink);
    [-1.75, 1.75].forEach(x => {
      addCylinder(x, 1.35, -0.55, 0.1, 2.5, pink);
      addBox(x, 2.63, -0.55, 0.32, 0.18, 0.32, warm);
    });
  } else if (type === 'photo_hunt') {
    addBox(0, 0.75, 0, 2.3, 1.5, 0.16, wood);
    addBox(0, 0.75, 0.1, 1.95, 1.15, 0.08, pink);
    addBox(0, 1.65, 0, 2.55, 0.12, 0.2, warm);
  } else if (type === 'photo_spot') {
    [-0.95, 0.95].forEach(x => addCylinder(x, 1.25, 0, 0.09, 2.5, pink));
    addBox(0, 2.42, 0, 2.15, 0.16, 0.18, warm);
    addBox(0, 1.1, 0, 1.8, 0.08, 0.1, cool);
  } else if (type === 'dance_stage') {
    addBox(0, 0.2, 0, 5.2, 0.4, 4.2, dark);
    addBox(0, 0.43, 0, 4.9, 0.08, 3.9, pink);
    [[-2, -1.45], [2, -1.45], [-2, 1.45], [2, 1.45]].forEach(([x, z]) => {
      addCylinder(x, 1.65, z, 0.1, 2.4, cool);
      addCylinder(x, 2.9, z, 0.22, 0.26, warm);
    });
  } else if (type === 'mansion_key') {
    const keyColor = variant === 'candle' ? '#fbbf24' : variant === 'bat' ? '#a78bfa' : '#fb7185';
    const keyMat = mat(keyColor, { emissive: keyColor, emissiveIntensity: 0.85, metalness: 0.55, roughness: 0.25 });
    const shaft = addCylinder(0, 0.38, 0, 0.09, 0.58, keyMat);
    shaft.rotation.z = Math.PI / 2;
    addCylinder(0.36, 0.38, 0, 0.2, 0.12, keyMat);
    addBox(-0.32, 0.2, 0, 0.16, 0.22, 0.12, keyMat);
    addBox(-0.08, 0.2, 0, 0.14, 0.22, 0.12, keyMat);
    const gem = addBox(0, 0.78, 0, 0.22, 0.22, 0.22, warm);
    gem.rotation.y = Math.PI / 4;
  } else if (type === 'photo_collectible') {
    const colors = { rose_locket: '#fb7185', star_charm: '#facc15', moon_crystal: '#a5b4fc', heart_ribbon: '#f472b6' };
    const color = colors[variant] || '#f9a8d4';
    const crystal = mat(color, { emissive: color, emissiveIntensity: 0.9, metalness: 0.35, roughness: 0.22 });
    const core = addBox(0, 0.48, 0, 0.42, 0.42, 0.22, crystal);
    core.rotation.y = Math.PI / 4;
    addCylinder(0, 0.86, 0, 0.16, 0.1, warm);
    addBox(0, 0.16, 0, 0.5, 0.08, 0.5, pink);
  } else if (type === 'christmas_gift') {
    const rare = String(variant).includes('sleigh');
    const goldGift = String(variant).includes('pine');
    const ribbon = mat(rare ? '#facc15' : goldGift ? '#ef4444' : '#38bdf8', { metalness: 0.2, roughness: 0.36 });
    const boxMat = mat(rare ? '#7c3aed' : goldGift ? '#047857' : '#dc2626', { roughness: 0.56 });
    addBox(0, 0.38, 0, 0.68, 0.62, 0.58, boxMat);
    addBox(0, 0.4, 0.3, 0.12, 0.66, 0.035, ribbon);
    addBox(0, 0.4, 0, 0.72, 0.11, 0.62, ribbon);
    [-0.16, 0.16].forEach(x => { const bow = addCylinder(x, 0.75, 0, 0.13, 0.08, ribbon); bow.rotation.z = x < 0 ? -0.4 : 0.4; });
    addCylinder(0, 0.06, 0, 0.5, 0.05, warm);
  } else if (type === 'halloween_treasure') {
    const relic = mat('#a78bfa', { emissive: '#7c3aed', emissiveIntensity: 0.8, metalness: 0.45, roughness: 0.25 });
    addBox(0, 0.26, 0, 0.78, 0.46, 0.55, wood);
    addBox(0, 0.5, 0, 0.82, 0.16, 0.6, warm);
    addBox(0, 0.29, 0.3, 0.12, 0.5, 0.04, relic);
    addBox(0, 0.32, 0.34, 0.18, 0.18, 0.05, gold);
    addCylinder(0, 0.88, 0, 0.08, 0.45, relic);
  } else if (type === 'tet_exploration_item') {
    const jade = mat('#34d399', { emissive: '#10b981', emissiveIntensity: 0.7, metalness: 0.35, roughness: 0.28 });
    const paper = mat('#fef3c7', { roughness: 0.68 });
    addBox(0, 0.38, 0, 0.48, 0.58, 0.16, paper);
    addBox(0, 0.4, 0.1, 0.1, 0.42, 0.035, mat('#dc2626', { roughness: 0.55 }));
    const seal = addBox(0, 0.42, 0.13, 0.18, 0.18, 0.05, jade);
    seal.rotation.y = Math.PI / 4;
    addCylinder(0, 0.07, 0, 0.48, 0.05, warm);
  }
  group.traverse(object => { if (object.isMesh) object.frustumCulled = true; });
  return group;
}
const DARK = new Set(['halloween', 'tet', 'christmas', 'valentine', 'casino']);

const rnd = seed => {
  let s = 0;
  for (const c of String(seed)) s = (s * 31 + c.charCodeAt(0)) >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
};

export class World {
  constructor(scene, onMapLoadProgress = null) {
    this.scene = scene;
    this.onMapLoadProgress = onMapLoadProgress;
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
    this.builderBlocksGroup = new THREE.Group();
    this.scene.add(this.builderBlocksGroup);
    this.builderBlocks = new Map();

    this.hemi = new THREE.HemisphereLight(0xffffff, 0x445566, 0.9);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 1);
    this.sun.position.set(22, 42, 16);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(512, 512);
    const sc = this.sun.shadow.camera;
    sc.left = sc.bottom = -34;
    sc.right = sc.top = 34;
    sc.near = 1;
    sc.far = 130;
    this.sun.shadow.bias = -0.0004;
    scene.add(this.sun, this.sun.target);

    this.mapKey = '';
    this.themeKey = '';
    this.appliedThemeKey = '';
    this.pendingMapBuild = null;
    this.mapBuildPromise = null;
    this.isLoadingMap = false;
    this.latestState = null;
    this.latestRoomSeed = 'lobby';
    this.modelReplacementPromises = [];
    this.replacementTemplates = new Map();
    this.ornamentKey = '';
    this.mediaBannerKey = '';
    this.communityTreeGroup = null;
    this.communityTreeDecorationMesh = null;
    this.communityTreeProgressGroup = null;
    this.seasonalVisualKey = '';
    this.particles = [];
    this.particleBatches = [];
    this.particleScale = 1;
    this.particleDummy = new THREE.Object3D();
    this.fireworks = []; // active rockets & bursts
    this.tomatoes = []; // flying tomato projectiles
    this.campfires = [];
    this.animatedModels = [];
    this.maiEnvelopes = [];
    this.valentineObjs = [];
    this.treeSlots = [];
    this.vampireNPC = null;
    this.vampireSwoop = null; // { tx, tz, until }
    this.screenObj = null;
    this.casinoObjs = [];
    this.features = { hotspots: [], seats: [], colliders: [], extraProps: [] };
    this.t = 0;
    this.timeOfDay = 'day';
  }

  /** Reconcile scene with shared room state. */
  sync(state, roomSeed = 'lobby') {
    this.latestState = state;
    this.latestRoomSeed = roomSeed;
    const mk = state.map.rows.join('|') + state.map.w + state.theme;
    let mapBuildPromise = null;
    if (mk !== this.mapKey || state.theme !== this.themeKey) {
      this.mapKey = mk;
      this.themeKey = state.theme;
      mapBuildPromise = this.requestMapBuild(state.map, state.theme, roomSeed);
    }
    if (this.appliedThemeKey) this.setDayNightTime(state.timeOfDay || this.timeOfDay);
    else this.timeOfDay = state.timeOfDay || this.timeOfDay;

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

    this.syncSeasonalEventVisuals(state.seasonalEvents || {}, state.theme);

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
    return mapBuildPromise;
  }

  syncSeasonalEventVisuals(events, themeKey) {
    const contributors = themeKey === 'christmas' ? events?.christmas?.tree?.contributors || [] : [];
    const count = Math.min(24, contributors.length);
    const key = themeKey + ':' + contributors.slice(0, 24).map(item => item?.decorationType || 'bell').join(',');
    if (key === this.seasonalVisualKey) return;
    this.seasonalVisualKey = key;

    if (this.communityTreeDecorationMesh) {
      this.communityTreeGroup?.remove(this.communityTreeDecorationMesh);
      this.communityTreeDecorationMesh.geometry.dispose();
      this.communityTreeDecorationMesh.material.dispose();
      this.communityTreeDecorationMesh = null;
    }
    if (this.communityTreeProgressGroup) {
      this.communityTreeGroup?.remove(this.communityTreeProgressGroup);
      this.communityTreeProgressGroup.traverse(object => {
        object.geometry?.dispose?.();
        if (Array.isArray(object.material)) object.material.forEach(material => material.dispose?.());
        else object.material?.dispose?.();
      });
      this.communityTreeProgressGroup = null;
    }
    if (!count || !this.communityTreeGroup) return;

    const geometry = new THREE.SphereGeometry(0.105, 10, 8);
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff, roughness: 0.28, metalness: 0.18,
      emissive: 0x332211, emissiveIntensity: 0.28,
    });
    const bulbs = new THREE.InstancedMesh(geometry, material, count);
    const transform = new THREE.Object3D();
    const palette = { star: '#fbbf24', bell: '#38bdf8', ribbon: '#f472b6' };
    for (let i = 0; i < count; i++) {
      const tier = Math.floor(i / 8);
      const slot = i % 8;
      const angle = (slot / 8) * Math.PI * 2 + tier * 0.27;
      const radius = 0.42 + tier * 0.07;
      const decorationType = contributors[i]?.decorationType || 'bell';
      transform.position.set(Math.cos(angle) * radius, 0.72 + tier * 0.54 + (slot % 2) * 0.14, Math.sin(angle) * radius);
      transform.scale.setScalar((decorationType === 'star' ? 1.22 : decorationType === 'ribbon' ? 0.92 : 1) * (0.88 + (slot % 3) * 0.12));
      transform.updateMatrix();
      bulbs.setMatrixAt(i, transform.matrix);
      bulbs.setColorAt(i, new THREE.Color(palette[decorationType] || palette.bell));
    }
    bulbs.instanceMatrix.needsUpdate = true;
    if (bulbs.instanceColor) bulbs.instanceColor.needsUpdate = true;
    bulbs.castShadow = false;
    bulbs.receiveShadow = false;
    this.communityTreeGroup.add(bulbs);
    this.communityTreeDecorationMesh = bulbs;

    const stage = Math.min(5, 1 + Math.floor(count / 6));
    const progress = new THREE.Group();
    progress.name = 'CommunityChristmasTreeStage' + stage;
    if (stage >= 2) {
      const lightGeometry = new THREE.SphereGeometry(0.055, 8, 6);
      const lightMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.85, roughness: 0.25 });
      const lights = new THREE.InstancedMesh(lightGeometry, lightMaterial, 24);
      const dummy = new THREE.Object3D();
      const colors = [0xffd166, 0x67e8f9, 0xf9a8d4, 0xa7f3d0];
      for (let i = 0; i < 24; i++) {
        const angle = i / 24 * Math.PI * 2;
        const y = 0.32 + (i / 24) * 1.9;
        const radius = 0.62 - (y / 1.9) * 0.27;
        dummy.position.set(Math.cos(angle * 3) * radius, y, Math.sin(angle * 3) * radius);
        dummy.updateMatrix();
        lights.setMatrixAt(i, dummy.matrix);
        lights.setColorAt(i, new THREE.Color(colors[i % colors.length]));
      }
      lights.instanceMatrix.needsUpdate = true;
      if (lights.instanceColor) lights.instanceColor.needsUpdate = true;
      progress.add(lights);
    }
    if (stage >= 3) {
      for (let tier = 0; tier < 3; tier++) {
        const ribbon = new THREE.Mesh(
          new THREE.TorusGeometry(0.58 - tier * 0.13, 0.035, 6, 48),
          new THREE.MeshStandardMaterial({ color: [0xf472b6, 0xfbbf24, 0xf472b6][tier], roughness: 0.55 })
        );
        ribbon.rotation.x = Math.PI / 2;
        ribbon.position.y = 0.48 + tier * 0.55;
        ribbon.scale.z = 0.78;
        progress.add(ribbon);
      }
    }
    if (stage >= 4) {
      const glow = new THREE.PointLight(0xffc85c, 1.35, 5.5, 2);
      glow.position.set(0, 1.25, 0);
      progress.add(glow);
    }
    if (stage >= 5) {
      const topper = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.28, 0),
        new THREE.MeshStandardMaterial({ color: 0xffdf70, emissive: 0xffb000, emissiveIntensity: 1.8, metalness: 0.25, roughness: 0.25 })
      );
      topper.position.y = 2.48;
      progress.add(topper);
    }
    this.communityTreeGroup.add(progress);
    this.communityTreeProgressGroup = progress;
  }

  requestMapBuild(map, themeKey, roomSeed) {
    this.pendingMapBuild = { map, themeKey, roomSeed };
    if (!this.mapBuildPromise) {
      this.mapBuildPromise = this.processMapBuildQueue()
        .catch(error => {
          this.mapKey = '';
          this.isLoadingMap = true;
          console.error('Failed to build map:', error);
          this.onMapLoadProgress?.({ active: true, error, themeKey: this.themeKey });
        })
        .finally(() => {
          this.mapBuildPromise = null;
        });
    }
    return this.mapBuildPromise;
  }

  async processMapBuildQueue() {
    this.isLoadingMap = true;
    try {
      while (this.pendingMapBuild) {
        const request = this.pendingMapBuild;
        this.pendingMapBuild = null;
        await this.yieldMapBuild(2, 'Chuẩn bị dữ liệu bản đồ...', request.themeKey);
        await this.buildMap(request.map, request.themeKey, request.roomSeed);
      }
      if (this.pendingMapBuild) return this.processMapBuildQueue();
      if (this.latestState) {
        this.ornamentKey = '';
        this.sync(this.latestState, this.latestRoomSeed);
      }
      this.onMapLoadProgress?.({ active: false, progress: 100 });
    } finally {
      if (!this.pendingMapBuild) this.isLoadingMap = false;
    }
  }

  async yieldMapBuild(progress, message, themeKey = this.themeKey) {
    this.onMapLoadProgress?.({ active: true, progress, message, themeKey });
    await new Promise(resolve => requestAnimationFrame(resolve));
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
    this.scene.fog = new THREE.Fog(bg, key === 'tet' ? 38 : 34, key === 'tet' ? 120 : 92);
    this.hemi.color.set(key === 'halloween' ? '#a78bfa' : key === 'tet' ? '#fde68a' : key === 'valentine' ? '#fbcfe8' : '#e0f2fe');
    this.hemi.groundColor.set(key === 'tet' ? '#070617' : dark ? '#1e1b2e' : '#8a7f70');
    this.hemi.intensity = key === 'halloween' ? 0.72 : key === 'tet' ? 1.02 : key === 'valentine' ? 0.88 : 0.92;
    this.sun.color.set(key === 'halloween' ? '#c4b5fd' : key === 'tet' ? '#fef08a' : key === 'valentine' ? '#fecdd3' : '#fff1d6');
    this.sun.intensity = key === 'halloween' ? 0.68 : key === 'tet' ? 1.08 : key === 'valentine' ? 0.96 : 1.15;
    this.dayHemiIntensity = this.hemi.intensity;
    this.daySunIntensity = this.sun.intensity;
    this.dayFogColor = bg.clone();
    this.setDayNightTime(this.timeOfDay);
    this.initParticles(th.particles);

    // Tet Night Sky with Glowing Moon (Optimized: Removed heavy stars for maximum performance)
    if (this.nightSkyGroup) {
      this.scene.remove(this.nightSkyGroup);
      this.nightSkyGroup = null;
    }
    if (key === 'tet') {
      this.nightSkyGroup = new THREE.Group();

      // Glowing Lunar Moon Sphere
      const moonGroup = new THREE.Group();
      moonGroup.position.set(-28, 48, -48);
      const moonMat = new THREE.MeshStandardMaterial({
        color: 0xfffbeb,
        emissive: 0xfef08a,
        emissiveIntensity: 2.5,
        roughness: 0.18,
      });
      const moonMesh = new THREE.Mesh(new THREE.SphereGeometry(4.0, 48, 48), moonMat);
      moonGroup.add(moonMesh);

      // Warm Moon Light
      const moonLight = new THREE.PointLight(0xfef08a, 3.1, 100);
      moonGroup.add(moonLight);
      this.nightSkyGroup.add(moonGroup);

      this.scene.add(this.nightSkyGroup);
    }
  }

  setGraphicsQuality(profile) {
    this.particleScale = profile.particleScale;
    this.sun.castShadow = profile.shadows;
    this.sun.shadow.mapSize.set(profile.shadowMapSize, profile.shadowMapSize);
    this.sun.shadow.needsUpdate = true;
    if (this.pcfg) this.initParticles(this.pcfg);
  }

  setDayNightTime(time) {
    const mode = String(time || '').toLowerCase();
    if (mode !== 'day' && mode !== 'night') return false;
    this.timeOfDay = mode;
    const factor = mode === 'night' ? 0.3 : 1;
    this.hemi.intensity = this.dayHemiIntensity * factor;
    this.sun.intensity = this.daySunIntensity * factor;
    this.scene.fog.color.copy(this.dayFogColor).multiplyScalar(factor);
    return true;
  }

  async buildMap(map, themeKey, roomSeed = 'lobby') {
    const th = THEMES[themeKey] || THEMES.christmas;
    if (this.communityTreeDecorationMesh) {
      this.communityTreeDecorationMesh.geometry.dispose();
      this.communityTreeDecorationMesh.material.dispose();
      this.communityTreeDecorationMesh = null;
    }
    if (this.communityTreeProgressGroup) {
      this.communityTreeProgressGroup.traverse(object => {
        object.geometry?.dispose?.();
        if (Array.isArray(object.material)) object.material.forEach(material => material.dispose?.());
        else object.material?.dispose?.();
      });
      this.communityTreeProgressGroup = null;
    }
    this.scene.remove(this.group);
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.communityTreeGroup = null;
    this.communityTreeDecorationMesh = null;
    this.seasonalVisualKey = '';
    if (themeKey !== this.appliedThemeKey) {
      this.applyTheme(themeKey);
      this.appliedThemeKey = themeKey;
    }
    this.replacementTemplates = new Map();
    this.modelReplacementPromises = [];

    this.campfires = [];
    this.animatedModels = [];
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
      if (y % 4 === 3 && y < map.h - 1) {
        await this.yieldMapBuild(4 + (y / map.h) * 10, 'Phân tích bố cục bản đồ...', themeKey);
      }
    }

    const inst = async (g, m, list, fn, progressStart, progressEnd, message) => {
      if (!list.length) return null;
      const im = new THREE.InstancedMesh(g, m, list.length);
      const d = new THREE.Object3D(),
        col = new THREE.Color();
      for (let i = 0; i < list.length; i++) {
        const [x, y] = list[i];
        const r = fn(x, y, d, col);
        d.updateMatrix();
        im.setMatrixAt(i, d.matrix);
        if (r) im.setColorAt(i, r);
        if ((i + 1) % 256 === 0 && i + 1 < list.length) {
          const progress = progressStart + ((progressEnd - progressStart) * (i + 1)) / list.length;
          await this.yieldMapBuild(progress, message, themeKey);
        }
      }
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

    await inst(slab, white, cells.floor, (x, y, d, col) => {
      d.position.set(x * TILE, -0.1, y * TILE);
      return col.copy((x + y) & 1 ? f1 : f0);
    }, 14, 31, 'Dựng mặt nền...');
    await inst(slab, white, cells.path, (x, y, d, col) => {
      d.position.set(x * TILE, -0.09, y * TILE);
      return col.copy(pCol);
    }, 31, 35, 'Dựng lối đi...');
    await inst(slab, white, cells.rug, (x, y, d, col) => {
      d.position.set(x * TILE, -0.07, y * TILE);
      return col.set(th.rug);
    }, 35, 38, 'Dựng khu vực trang trí...');
    await inst(
      slab,
      mat('#ffffff', { roughness: 0.2, metalness: 0.2, emissive: th.water, emissiveIntensity: 0.18 }),
      cells.water,
      (x, y, d, col) => {
        d.position.set(x * TILE, -0.22, y * TILE);
        return col.set(th.water);
      },
      38,
      41,
      'Dựng khu vực mặt nước...'
    );
    await inst(wallG, white, cells.wall, (x, y, d, col) => {
      d.position.set(x * TILE, WALL_H / 2, y * TILE);
      return col.set(th.wall).multiplyScalar(0.85 + ((x * 7 + y * 13) % 5) * 0.05);
    }, 41, 54, 'Dựng tường và công trình...');

    for (let i = 0; i < cells.tree.length; i++) {
      const [x, y] = cells.tree[i];
      const t = buildTree(themeKey);
      t.position.set(x * TILE, 0, y * TILE);
      t.rotation.y = (x * 31 + y * 17) % 7;
      this.group.add(t);
      this.applyModelReplacement(themeKey, 'map_tree', t);
      if ((i + 1) % 4 === 0 && i + 1 < cells.tree.length) {
        await this.yieldMapBuild(54 + ((i + 1) / cells.tree.length) * 6, 'Đặt cây và cảnh quan...', themeKey);
      }
    }

    // Roof props on perimeter walls
    for (let i = 0; i < cells.wall.length; i++) {
      const [x, y] = cells.wall[i];
      if ((x + y) % 5 === 0) {
        const p = buildProp(th.prop);
        p.position.set(x * TILE, WALL_H, y * TILE);
        this.group.add(p);
        this.applyModelReplacement(themeKey, 'roof_prop', p);
      }
      if ((i + 1) % 32 === 0 && i + 1 < cells.wall.length) {
        await this.yieldMapBuild(60 + ((i + 1) / cells.wall.length) * 7, 'Hoàn thiện cảnh quan...', themeKey);
      }
    }

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
    await this.yieldMapBuild(68, 'Dựng các khu vực lễ hội...', themeKey);

    // 1. Cinema Screen
    this.screenObj = buildCinemaScreen();
    this.screenObj.position.set(14.5 * TILE, 0, 2.0 * TILE);
    this.group.add(this.screenObj);
    this.applyModelReplacement(themeKey, 'cinema_screen', this.screenObj);
    this.mediaBannerKey = '';

    // 2. Seats (Single chairs, Couple sofas, Campfire logs)
    for (let i = 0; i < this.features.seats.length; i++) {
      const s = this.features.seats[i];
      let mesh;
      if (s.kind === 'single') mesh = buildSingleChair();
      else if (s.kind === 'couple') mesh = buildCoupleSofa();
      else if (s.kind === 'log') mesh = buildLogSeat(s.meshRot || 0);
      if (mesh) {
        if (s.kind === 'single') mesh.scale.multiplyScalar(1.1);
        mesh.position.set(s.x * TILE, 0, s.y * TILE);
        if (s.kind !== 'log') mesh.rotation.y = 0; // faces North (-Z)
        this.group.add(mesh);
        s.mesh = mesh;
        const target = s.kind === 'single' ? 'single_chair' : s.kind === 'couple' ? 'couple_sofa' : 'log_seat';
        this.applyModelReplacement(themeKey, target, mesh);
      }
      if ((i + 1) % 8 === 0 && i + 1 < this.features.seats.length) {
        await this.yieldMapBuild(68 + ((i + 1) / this.features.seats.length) * 8, 'Đặt ghế và điểm nghỉ...', themeKey);
      }
    }

    // 3. Hotspots & Theme Centerpieces
    const addMapModel = (target, object) => {
      this.group.add(object);
      this.applyModelReplacement(themeKey, target, object);
    };
    for (let i = 0; i < this.features.hotspots.length; i++) {
      const h = this.features.hotspots[i];
      if (h.type === 'xmas_tree') {
        const { group, slots } = buildGiantChristmasTree();
        group.position.set(h.x * TILE, 0, h.y * TILE);
        addMapModel(h.type, group);
        this.treeSlots = slots;
      } else if (h.type === 'ornament_table') {
        const tb = buildOrnamentTable();
        tb.position.set(h.x * TILE, 0, h.y * TILE);
        addMapModel(h.type, tb);
      } else if (h.type === 'campfire') {
        const cf = buildCampfire();
        cf.position.set(h.x * TILE, 0, h.y * TILE);
        addMapModel(h.type, cf);
        this.campfires.push(cf);
      } else if (h.type === 'giant_pumpkin') {
        const gp = buildGiantPumpkin();
        gp.position.set(h.x * TILE, 0, h.y * TILE);
        addMapModel(h.type, gp);
      } else if (h.type === 'small_pumpkin') {
        const sp = buildCarvedPumpkin(h.styleKey, 1.15);
        sp.position.set(h.x * TILE, 0, h.y * TILE);
        sp.rotation.y = h.rot || 0;
        addMapModel(h.type, sp);
      } else if (h.type === 'costume_booth') {
        const cb = buildCostumeBooth(h.costumeKey);
        cb.position.set(h.x * TILE, 0, h.y * TILE);
        addMapModel(h.type, cb);
      } else if (h.type === 'mai_tree') {
        const mt = buildGiantMaiTree();
        mt.position.set(h.x * TILE, 0, h.y * TILE);
        addMapModel(h.type, mt);
        this.maiEnvelopes = mt.userData.envelopes || [];
      } else if (h.type === 'phuc_loc_tho_shrine') {
        const pls = buildPhucLocThoShrine();
        pls.position.set(h.x * TILE, 0, h.y * TILE);
        addMapModel(h.type, pls);
        for (const [statueName, target] of [
          ['statue-ong-phuc', 'ong_phuc_statue'],
          ['statue-ong-loc', 'ong_loc_statue'],
          ['statue-ong-tho', 'ong_tho_statue'],
        ]) {
          const statue = pls.getObjectByName(statueName);
          if (statue) this.applyModelReplacement(themeKey, target, statue);
        }
      } else if (h.type === 'dragon_altar') {
        const da = buildDragonAltar();
        da.position.set(h.x * TILE, 0, h.y * TILE);
        addMapModel(h.type, da);
        if (typeof da.userData.update === 'function') {
          this.animatedModels.push({ model: da, update: da.userData.update });
        }
      } else if (h.type === 'firework_launcher') {
        const fl = buildFireworkLauncher();
        fl.position.set(h.x * TILE, 0, h.y * TILE);
        addMapModel(h.type, fl);
      } else if (h.type === 'firecracker_table') {
        const ft = buildFirecrackerTable();
        ft.position.set(h.x * TILE, 0, h.y * TILE);
        addMapModel(h.type, ft);
      } else if (h.type === 'heart_tree') {
        const ht = buildValentineHeartTree();
        ht.position.set(h.x * TILE, 0, h.y * TILE);
        addMapModel(h.type, ht);
        this.valentineObjs.push(ht);
      } else if (h.type === 'love_fountain') {
        const lf = buildLoveFountain();
        lf.position.set(h.x * TILE, 0, h.y * TILE);
        addMapModel(h.type, lf);
        this.valentineObjs.push(lf);
      } else if (h.type === 'clover_fountain') {
        const cf = new THREE.Group();
        cf.name = 'CloverFountainAnchor';
        cf.userData.type = h.type;
        cf.position.set(h.x * TILE, 0, h.y * TILE);
        addMapModel(h.type, cf);
        this.casinoObjs.push(cf);
      } else if (h.type === 'roulette') {
        const rt = buildRouletteTable();
        rt.position.set(h.x * TILE, 0, h.y * TILE);
        addMapModel(h.type, rt);
        this.casinoObjs.push(rt);
      } else if (h.type === 'duck_derby') {
        const dd = buildDuckDerbyTrack();
        dd.position.set(h.x * TILE, 0, h.y * TILE);
        addMapModel(h.type, dd);
        this.casinoObjs.push(dd);
      } else if (h.type === 'blackjack') {
        const bj = buildBlackjackTable();
        bj.position.set(h.x * TILE, 0, h.y * TILE);
        addMapModel(h.type, bj);
        this.casinoObjs.push(bj);
      } else if (h.type === 'slot_machine') {
        [-0.85, 0, 0.85].forEach(ox => {
          const sm = buildSlotMachine();
          sm.position.set((h.x + ox) * TILE, 0, h.y * TILE);
          sm.rotation.y = Math.PI;
          addMapModel(h.type, sm);
          this.casinoObjs.push(sm);
        });
      } else if (h.type === 'plinko') {
        [-0.8, 0, 0.8].forEach(ox => {
          const pk = buildPlinkoBoard();
          pk.position.set((h.x + ox) * TILE, 0, h.y * TILE);
          pk.rotation.y = Math.PI;
          addMapModel(h.type, pk);
          this.casinoObjs.push(pk);
        });
      } else if (h.type === 'secret_passage') {
        const sp = buildSecretPassage(themeKey);
        sp.position.set(h.x * TILE, 0, h.y * TILE);
        addMapModel(h.type, sp);
      } else if (h.type === 'secret_note') {
        const sn = buildSecretPaperNote(h.code);
        sn.position.set(h.x * TILE, 0, h.y * TILE);
        addMapModel(h.type, sn);
      } else if (h.type === 'casino_exit') {
        const ce = buildCasinoExitPortal();
        ce.position.set(h.x * TILE, 0, h.y * TILE);
        addMapModel(h.type, ce);
      } else if (h.type === 'casino_pub') {
        const pub = buildCasinoPubBar();
        pub.position.set(h.x * TILE, 0, h.y * TILE);
        addMapModel(h.type, pub);
        this.casinoObjs.push(pub);
      } else if (['community_tree', 'sled_race', 'haunted_mansion', 'costume_runway', 'photo_hunt', 'photo_spot', 'dance_stage', 'mansion_key', 'photo_collectible', 'christmas_gift', 'halloween_treasure', 'tet_exploration_item'].includes(h.type)) {
        const landmark = buildSeasonalLandmark(h.type, h.keyId || h.itemId || h.giftId || h.treasureId || '');
        landmark.position.set(h.x * TILE, 0, h.y * TILE);
        this.group.add(landmark);
        if (h.type === 'community_tree') this.communityTreeGroup = landmark;
      }
      if ((i + 1) % 2 === 0 && i + 1 < this.features.hotspots.length) {
        await this.yieldMapBuild(76 + ((i + 1) / this.features.hotspots.length) * 16, 'Dựng công trình và điểm tương tác...', themeKey);
      }
    }

    // 4. Extra props (Random Snowmen, Rose Arch, Illusion Walls)
    for (let i = 0; i < this.features.extraProps.length; i++) {
      const ep = this.features.extraProps[i];
      if (ep.type === 'snowman') {
        const sm = buildSnowman(ep.variant);
        sm.position.set(ep.x * TILE, 0, ep.y * TILE);
        sm.rotation.y = ep.rot || 0;
        addMapModel(ep.type, sm);
      } else if (ep.type === 'rose_arch') {
        const arch = buildRoseArch();
        arch.position.set(ep.x * TILE, 0, ep.y * TILE);
        arch.rotation.y = ep.rot || 0;
        addMapModel(ep.type, arch);
        this.valentineObjs.push(arch);
      } else if (ep.type === 'illusion_wall') {
        const iw = buildIllusionWall(themeKey);
        iw.position.set(ep.x * TILE, 0, ep.y * TILE);
        iw.rotation.y = ep.rot || 0;
        addMapModel(ep.type, iw);
      }
      if ((i + 1) % 4 === 0 && i + 1 < this.features.extraProps.length) {
        await this.yieldMapBuild(92 + ((i + 1) / this.features.extraProps.length) * 4, 'Hoàn thiện chi tiết...', themeKey);
      }
    }

    // 5. Flying Vampire NPC in Halloween
    if (themeKey === 'halloween') {
      this.vampireNPC = buildVampireNPC();
      this.vampireNPC.position.set(14.5 * TILE, 3.8, 11.5 * TILE);
      this.group.add(this.vampireNPC);
      this.applyModelReplacement(themeKey, 'vampire_npc', this.vampireNPC);
    }

    this. sun.target.position.set((map.w * TILE) / 2, 0, (map.h * TILE) / 2);
    if (this.modelReplacementPromises.length) {
      await this.yieldMapBuild(94, 'Đang tải mô hình 3D...', themeKey);
      while (this.modelReplacementPromises.length) {
        const pending = this.modelReplacementPromises.splice(0);
        await Promise.all(pending);
      }
    }
    await this.yieldMapBuild(98, 'Hoàn tất bản đồ...', themeKey);
  }

  applyModelReplacement(map, target, group) {
    const operation = this.loadAndApplyModelReplacement(map, target, group);
    this.modelReplacementPromises.push(operation);
    return operation;
  }

  async loadAndApplyModelReplacement(map, target, group) {
    try {
      const key = `${map}:${target}`;
      if (!this.replacementTemplates.has(key)) {
        this.replacementTemplates.set(key, instantiateReplacement(map, target));
      }
      const template = await this.replacementTemplates.get(key);
      if (!template || !this.group.getObjectById(group.id)) return;
      const hasAnimation = typeof template.userData.update === 'function';
      const replacement = hasAnimation
        ? (template.parent ? await instantiateReplacement(map, target) : template)
        : template.clone(true);
      if (!replacement || !this.group.getObjectById(group.id)) return;
      if (map === 'casino' && target === 'roulette') {
        group.userData.rotor = replacement.userData.rotor;
        group.userData.ballGroup = replacement.userData.ballGroup;
        group.userData.customAnimation = true;
        replacement.userData.casinoState = group.userData;
      } else if (map === 'casino' && target === 'duck_derby') {
        group.userData.replacementModel = replacement;
        replacement.userData.racing = !!group.userData.isRacing;
        const startRace = group.userData.startRace;
        group.userData.startRace = function (onFinish) {
          startRace.call(this, onFinish);
          replacement.userData.racing = !!this.isRacing;
        };
      } else if (map === 'casino' && target === 'clover_fountain') {
        group.userData.replacementModel = replacement;
      } else if (map === 'casino' && target === 'slot_machine') {
        replacement.userData.auto = false;
        const pullLever = group.userData.pullLever;
        group.userData.pullLever = function (onResult) {
          if (this.isSpinning) return;
          pullLever.call(this, onResult);
          replacement.userData.pull?.();
        };
      } else if (map === 'casino' && target === 'plinko') {
        const dropBall = group.userData.dropBall;
        group.userData.dropBall = function (onLand) {
          if (dropBall.call(this, onLand) === false) return false;
          replacement.userData.drop?.();
          return true;
        };
      }
      if (hasAnimation) {
        this.animatedModels = this.animatedModels.filter(({ model: animatedModel }) => animatedModel !== group);
        if (!this.animatedModels.some(({ model }) => model === replacement)) {
          const update = map === 'casino' && target === 'plinko'
            ? (t, dt) => replacement.userData.update(dt, t)
            : replacement.userData.update;
          this.animatedModels.push({ model: replacement, update });
        }
      }

      group.updateWorldMatrix(true, true);
      const originalBounds = new THREE.Box3().setFromObject(group);
      const originalSize = originalBounds.getSize(new THREE.Vector3());
      const replacementBounds = new THREE.Box3().setFromObject(replacement);
      const replacementSize = replacementBounds.getSize(new THREE.Vector3());
      const hasOriginalBounds = !originalBounds.isEmpty();
      const targetSize = hasOriginalBounds ? Math.max(originalSize.x, originalSize.y, originalSize.z) : 0;
      const sourceSize = Math.max(replacementSize.x, replacementSize.y, replacementSize.z);
      const requestedScale = Number(replacement.userData.replacementScale);
      const scaleMultiplier = Number.isFinite(requestedScale) && requestedScale > 0 ? requestedScale : 1;
      const fitScale = (targetSize > 0 && sourceSize > 0 ? targetSize / sourceSize : 1) * scaleMultiplier;
      replacement.scale.multiplyScalar(fitScale);
      replacement.position.y = hasOriginalBounds
        ? originalBounds.min.y - group.getWorldPosition(new THREE.Vector3()).y - replacementBounds.min.y * fitScale
        : -replacementBounds.min.y * fitScale;

      const preservedObjects = new Set(group.userData.envelopes || []);
      for (const child of group.children) child.visible = preservedObjects.has(child);
      group.add(replacement);
    } catch (error) {
      console.error(`Could not apply model replacement for ${map}/${target}:`, error);
    }
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

  spawnFireworksShow(tileX, tileZ, seed = Date.now(), elapsedMs = 0) {
    const bx = tileX * TILE,
      bz = tileZ * TILE;
    const colors = ['#f43f5e', '#facc15', '#10b981', '#38bdf8', '#c084fc', '#fb923c', '#ffffff'];
    const shapes = ['classic', 'heart', 'star', 'blossom', 'ring', 'willow'];
    const count = 9;
    const random = seededRandom(seed);
    for (let i = 0; i < count; i++) {
      const col = colors[i % colors.length];
      const shape = shapes[Math.floor(random() * shapes.length)];
      const rx = bx + (random() - 0.5) * 1.8;
      const rz = bz + (random() - 0.5) * 1.8;
      const vx = (random() - 0.5) * 3.2;
      const vy = 14 + random() * 5.5;
      const vz = (random() - 0.5) * 3.2;
      const maxAge = 0.95 + random() * 0.35;
      const launchAt = i * 280;
      if (launchAt + maxAge * 1000 < elapsedMs) continue;
      const age = Math.max(0, elapsedMs - launchAt) / 1000;
      const rocketSeed = (Number(seed) + Math.imul(i + 1, 0x9e3779b1)) >>> 0;
      setTimeout(() => {
        if (age >= maxAge) {
          this.explodeRocket(rx + vx * age, 1.2 + vy * age, rz + vz * age, col, shape, rocketSeed);
          return;
        }
        const rocket = new THREE.Mesh(G.sph(), mat(col, { emissive: col, emissiveIntensity: 2.5 }));
        rocket.scale.setScalar(0.28);
        rocket.position.set(rx + vx * age, 1.2 + vy * age, rz + vz * age);
        this.fxGroup.add(rocket);
        this.fireworks.push({
          kind: 'rocket',
          mesh: rocket,
          vx, vy, vz,
          color: col,
          shape,
          age,
          seed: rocketSeed,
          maxAge,
        });
      }, Math.max(0, launchAt - elapsedMs));
    }
  }

  spawnFirecrackers(tileX, tileZ, seed = Date.now()) {
    const bx = tileX * TILE,
      bz = tileZ * TILE;
    const colors = ['#ff2a2a', '#ffd166', '#ff9f1c'];
    const random = seededRandom(seed);
    for (let i = 0; i < 26; i++) {
      const col = colors[i % colors.length];
      const spark = new THREE.Mesh(G.box(), mat(col, { emissive: col, emissiveIntensity: 2.2 }));
      spark.scale.setScalar(0.11);
      spark.position.set(bx + (random() - 0.5) * 0.8, 1.05, bz + (random() - 0.5) * 0.8);
      this.fxGroup.add(spark);
      const a = random() * Math.PI * 2;
      const sp = 1.5 + random() * 3.5;
      this.fireworks.push({
        kind: 'spark',
        mesh: spark,
        vx: Math.cos(a) * sp,
        vy: 2.5 + random() * 4.0,
        vz: Math.sin(a) * sp,
        age: 0,
        maxAge: 0.55 + random() * 0.4,
      });
    }
  }

  explodeRocket(x, y, z, color, shape = 'classic', seed = Date.now()) {
    const random = seededRandom(seed);
    const m = mat(color, { emissive: color, emissiveIntensity: 2.6 });
    const flash = new THREE.PointLight(color, 12, 38);
    flash.position.set(x, y, z);
    this.fxGroup.add(flash);
    setTimeout(() => this.fxGroup.remove(flash), 600);

    const makeSpark = (vx, vy, vz, maxAge = 1.3, gravMod = 1.0, scale = 0.22) => {
      const p = new THREE.Mesh(G.sph(), m);
      p.scale.setScalar(scale);
      p.position.set(x, y, z);
      this.fxGroup.add(p);
      this.fireworks.push({
        kind: 'spark',
        mesh: p,
        vx,
        vy,
        vz,
        age: 0,
        maxAge,
        gravMod,
      });
    };

    if (shape === 'heart') {
      // Parametric 3D Heart Burst ❤️
      const num = 46;
      for (let i = 0; i < num; i++) {
        const t = (i / num) * Math.PI * 2;
        const hx = 16 * Math.pow(Math.sin(t), 3);
        const hy = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
        const sp = 0.48;
        makeSpark(
          hx * sp + (random() - 0.5) * 0.8,
          hy * sp + (random() - 0.5) * 0.8,
          (random() - 0.5) * 1.8,
          1.5 + random() * 0.35,
          0.7,
          0.26
        );
      }
    } else if (shape === 'star') {
      // 5-Pointed Star Burst ⭐️
      const num = 45;
      for (let i = 0; i < num; i++) {
        const t = (i / num) * Math.PI * 2;
        const r = (i % 2 === 0 ? 8.5 : 3.4) * (0.85 + random() * 0.3);
        makeSpark(
          Math.cos(t) * r,
          Math.sin(t) * r,
          (random() - 0.5) * 1.8,
          1.4 + random() * 0.3,
          0.8,
          0.25
        );
      }
    } else if (shape === 'blossom') {
      // 5-Petal Apricot Blossom Bloom 🌸
      const num = 50;
      for (let i = 0; i < num; i++) {
        const t = (i / num) * Math.PI * 2;
        const r = (6.2 + 2.8 * Math.cos(5 * t)) * (0.9 + random() * 0.2);
        makeSpark(
          Math.cos(t) * r,
          Math.sin(t) * r,
          (random() - 0.5) * 2.2,
          1.5 + random() * 0.3,
          0.75,
          0.24
        );
      }
    } else if (shape === 'ring') {
      // Saturn Concentric Expanding Ring ⭕️
      const num = 44;
      const tilt = random() * Math.PI;
      for (let i = 0; i < num; i++) {
        const t = (i / num) * Math.PI * 2;
        const speed = 7.5 + (i % 2 === 0 ? 0 : -2.8);
        const rx = Math.cos(t) * speed;
        const rz = Math.sin(t) * speed;
        makeSpark(
          rx,
          Math.sin(tilt) * rz * 0.45 + (random() - 0.5) * 1.2,
          Math.cos(tilt) * rz,
          1.4 + random() * 0.3,
          0.85,
          0.23
        );
      }
    } else if (shape === 'willow') {
      // Golden Brocade Waterfall ✨
      const num = 42;
      for (let i = 0; i < num; i++) {
        const theta = random() * Math.PI * 2;
        const sp = 2.5 + random() * 5.0;
        makeSpark(
          Math.cos(theta) * sp,
          3.8 + random() * 3.5,
          Math.sin(theta) * sp,
          2.2 + random() * 0.6,
          0.4, // Slow graceful downward drift
          0.2
        );
      }
    } else {
      // Classic Spherical Fireworks Burst
      for (let i = 0; i < 38; i++) {
        const theta = random() * Math.PI * 2;
        const phi = Math.acos(2 * random() - 1);
        const speed = 5.2 + random() * 5.8;
        makeSpark(
          Math.sin(phi) * Math.cos(theta) * speed,
          Math.cos(phi) * speed,
          Math.sin(phi) * Math.sin(theta) * speed,
          1.25 + random() * 0.4,
          1.0,
          0.22
        );
      }
    }
  }

  initParticles(cfg) {
    for (const batch of this.particleBatches) {
      this.scene.remove(batch.mesh);
      batch.mesh.geometry.dispose();
      batch.mesh.material.dispose();
    }
    this.particles = [];
    this.particleBatches = [];
    this.pcfg = cfg;
    const particleCount = Math.ceil(cfg.count * this.particleScale);
    const batchByEmoji = new Map(cfg.emoji.map(emoji => {
      const count = Math.ceil(particleCount / cfg.emoji.length);
      const mesh = new THREE.InstancedMesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({
          map: emojiTexture(emoji),
          transparent: true,
          opacity: 0.85,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
        count
      );
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      this.scene.add(mesh);
      const batch = { mesh, count: 0 };
      this.particleBatches.push(batch);
      return [emoji, batch];
    }));
    for (let i = 0; i < particleCount; i++) {
      const e = cfg.emoji[i % cfg.emoji.length];
      const batch = batchByEmoji.get(e);
      const index = batch.count++;
      const position = new THREE.Vector3(
        (Math.random() - 0.5) * 44,
        Math.random() * 14 + 1,
        (Math.random() - 0.5) * 44
      );
      const scale = 0.35 + Math.random() * 0.3;
      this.particleDummy.position.copy(position);
      this.particleDummy.scale.set(scale, scale, 1);
      this.particleDummy.updateMatrix();
      batch.mesh.setMatrixAt(index, this.particleDummy.matrix);
      this.particles.push({
        position,
        scale,
        batch,
        index,
        vy: cfg.vy[0] + Math.random() * (cfg.vy[1] - cfg.vy[0]),
        vx: cfg.vx[0] + Math.random() * (cfg.vx[1] - cfg.vx[0]),
        phase: Math.random() * 6.28,
      });
    }
    for (const batch of this.particleBatches) {
      batch.mesh.count = batch.count;
      batch.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  update(dt, center, camera) {
    this.t += dt;
    for (const animation of this.animatedModels) animation.update.call(animation.model.userData, this.t, dt);
    const now = performance.now();

    // 1. Ambient theme particles
    for (const p of this.particles) {
      p.position.y -= p.vy * dt;
      p.position.x += (p.vx + Math.sin(this.t + p.phase) * 0.25) * dt;
      if (p.position.y < 0.2) {
        p.position.y = 14;
        p.position.x = center.x + (Math.random() - 0.5) * 42;
        p.position.z = center.z + (Math.random() - 0.5) * 42;
      }
      this.particleDummy.position.copy(p.position);
      if (camera) this.particleDummy.quaternion.copy(camera.quaternion);
      else this.particleDummy.quaternion.identity();
      this.particleDummy.scale.set(p.scale, p.scale, 1);
      this.particleDummy.updateMatrix();
      p.batch.mesh.setMatrixAt(p.index, this.particleDummy.matrix);
    }
    for (const batch of this.particleBatches) batch.mesh.instanceMatrix.needsUpdate = true;

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
        fw.vy -= (9.8 * (fw.gravMod ?? 1.0)) * dt;
        const s = Math.max(0.01, (1 - fw.age / fw.maxAge) * 0.22);
        fw.mesh.scale.setScalar(s);
      }
      if (fw.age >= fw.maxAge) {
        if (fw.kind === 'rocket') {
          this.explodeRocket(fw.mesh.position.x, fw.mesh.position.y, fw.mesh.position.z, fw.color, fw.shape, fw.seed);
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
          if (!u.customAnimation) u.rotor.rotation.y += 0.25 * dt;
        }
      } else if (u.type === 'duck_derby') {
        if (u.replacementModel) u.replacementModel.userData.racing = !!u.isRacing;
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

          if (b.y > 0.48 && b.x < -1.015) {
            b.x = -1.015;
            b.vx = Math.abs(b.vx) * 0.65;
          } else if (b.y > 0.48 && b.x > 1.015) {
            b.x = 1.015;
            b.vx = -Math.abs(b.vx) * 0.65;
          }

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
            // Award only when the ball lands inside a visible bin, not on dividers or outside.
            const binW = 2.1 / 11;
            const relativeX = b.x + 1.05;
            const binIdx = Math.floor(relativeX / binW);
            const binOffset = relativeX - binIdx * binW;
            const mults = ['5x', '3x', '2x', '1.2x', '0.5x', '0.2x', '0.5x', '1.2x', '2x', '3x', '5x'];
            const landedInBin = binIdx >= 0 && binIdx < mults.length &&
              binOffset >= binW * 0.05 && binOffset < binW * 0.95;
            b.onLand?.(landedInBin ? mults[binIdx] : null);
            co.remove(b.mesh);
            u.activeBalls.splice(bi, 1);
          }
        }
      }
    }
  }

  addBuilderBlock(block) {
    if (this.builderBlocks.has(block.id)) return;
    const boxGeo = new THREE.BoxGeometry(block.sx || 1.0, block.sy || 1.0, block.sz || 1.0);
    const boxMat = new THREE.MeshStandardMaterial({
      color: block.color || 0xfacc15,
      roughness: 0.35,
      metalness: 0.1,
    });
    const mesh = new THREE.Mesh(boxGeo, boxMat);
    mesh.position.set(block.x, block.y, block.z);
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.userData = { blockId: block.id, isBuilderBlock: true };
    this.builderBlocksGroup.add(mesh);
    this.builderBlocks.set(block.id, mesh);
  }

  removeBuilderBlock(blockId) {
    const mesh = this.builderBlocks.get(blockId);
    if (mesh) {
      this.builderBlocksGroup.remove(mesh);
      this.builderBlocks.delete(blockId);
    }
  }

  clearBuilderBlocks() {
    this.builderBlocksGroup.clear();
    this.builderBlocks.clear();
  }
}
