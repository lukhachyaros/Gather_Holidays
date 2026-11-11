// ============================================================================
// MULTIPLAYER THEMED MINIGAMES FOR GATHER_HOLIDAYS (OPTIMIZED & EXPANDED)
// - Christmas & Valentine: True 3D FPS Crosshair Raycast Combat, 100 HP & Safe Zone
// - Halloween: Creepy Vampire Boss Autonomous Hunting, Dynamic Safe Zone Sanctuary Escape
// - Tet: Spectacular Multi-Stage Fireworks Engine & Mythical Golden Dragon (Kim Long)
// ============================================================================

import * as THREE from 'three';
import { playSfx } from './audio.js';
import { buildAerialRing } from './props.js';
import { createDragon } from './dragon.js';

const TILE = 2;

// Check if coordinates (in tile space) are within the TV Cinema & Seating Safe Zone
export function isInSafeZone(x, y) {
  return x >= 9.0 && x <= 20.0 && y >= 1.5 && y <= 8.2;
}

// ----------------------------------------------------------------------------
// DRAGON SKINS (PALETTES MATCHING CRYSTAL ARTICULATED DRAGONS)
// ----------------------------------------------------------------------------
export const DRAGON_SKINS = {
  gold: {
    id: 'gold',
    name: 'Hoàng Long (Kim Tinh)',
    color: 0xfacc15,
    darkColor: 0xca8a04,
    accent: 0xdc2626,
    emissive: 0xfacc15,
    desc: 'Rồng Vàng Hoàng Gia quyền uy tối thượng (Mặc định)',
  },
  jade: {
    id: 'jade',
    name: 'Bích Long (Ngọc Lục Bảo)',
    color: 0x10b981,
    darkColor: 0x047857,
    accent: 0xfde047,
    emissive: 0x10b981,
    desc: 'Rồng Ngọc Bích mang lại tài lộc và sinh khí dồi dào',
  },
  ice: {
    id: 'ice',
    name: 'Băng Long (Hàn Tinh Thể)',
    color: 0x06b6d4,
    darkColor: 0x0891b2,
    accent: 0xffffff,
    emissive: 0x22d3ee,
    desc: 'Rồng Băng Giá tinh khiết toát khí lạnh buốt huyền ảo',
  },
  amethyst: {
    id: 'amethyst',
    name: 'Tử Long (Thạch Anh Tím)',
    color: 0x9333ea,
    darkColor: 0x6b21a8,
    accent: 0xf43f5e,
    emissive: 0xa855f7,
    desc: 'Rồng Tím Thần Bí mang năng lượng vũ trụ siêu phàm',
  },
  ruby: {
    id: 'ruby',
    name: 'Hỏa Long (Hỏa Diệm Hoàng Kim)',
    color: 0xef4444,
    darkColor: 0xb91c1c,
    accent: 0xfacc15,
    emissive: 0xf97316,
    desc: 'Rồng Lửa Rực Cháy thiêu rụi tà ma, ngập tràn phúc khí',
  },
  sapphire: {
    id: 'sapphire',
    name: 'Hải Long Thần (Lam Tinh Tối Thượng)',
    color: 0x2563eb,
    darkColor: 0x1e40af,
    accent: 0x38bdf8,
    emissive: 0x60a5fa,
    desc: 'Rồng Biển Thần Thoại thấu hiểu càn khôn quyền năng vô song',
  },
};

// ----------------------------------------------------------------------------
// AERIAL RING FLIGHT QUEST CHALLENGES
// ----------------------------------------------------------------------------
export const FLIGHT_QUESTS = [
  {
    stage: 1,
    ringCount: 5,
    targetSkin: 'jade',
    title: 'Thử Thách 1: Lướt Gió Xuân (5 Vòng Tròn)',
    desc: 'Bay qua 5 vòng tròn cơ bản để mở khóa skin Bích Long (Ngọc Lục Bảo)!',
  },
  {
    stage: 2,
    ringCount: 8,
    targetSkin: 'ice',
    title: 'Thử Thách 2: Hàn Băng Vút Cao (8 Vòng Tròn)',
    desc: 'Bay qua 8 vòng tròn trên cao mây gió mở khóa skin Băng Long (Hàn Tinh Thể)!',
  },
  {
    stage: 3,
    ringCount: 10,
    targetSkin: 'amethyst',
    title: 'Thử Thách 3: Tử Vân Uốn Lượn (10 Vòng Tròn)',
    desc: 'Bay qua 10 vòng tròn uốn lượn liên hoàn mở khóa skin Tử Long (Thạch Anh Tím)!',
  },
  {
    stage: 4,
    ringCount: 12,
    targetSkin: 'ruby',
    title: 'Thử Thách 4: Hỏa Diệm Xuyên Tán (12 Vòng Tròn)',
    desc: 'Bay qua 12 vòng tròn rực lửa xuyên qua tán Mai & Đền Thờ mở khóa skin Hỏa Long!',
  },
  {
    stage: 5,
    ringCount: 15,
    targetSkin: 'sapphire',
    title: 'Thử Thách 5: Vũ Trụ Lam Tinh (15 Vòng Tròn)',
    desc: 'Bay qua 15 vòng tròn tối thượng với tốc độ cao mở khóa skin Hải Long Thần!',
  },
];

export class MinigameManager {
  constructor(scene, camera, getMe, getPeers, emitOp, toast, floaters) {
    this.scene = scene;
    this.camera = camera;
    this.getMe = getMe;
    this.getPeers = getPeers;
    this.emitOp = emitOp;
    this.toast = toast;
    this.floaters = floaters;

    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.theme = 'christmas';
    this.projectiles = []; // active flying projectiles
    this.particles = []; // firework spark particles
    this.scores = new Map(); // name -> { name, score }
    this.lastActionTime = 0;

    // PvP Health State for Local Player
    this.hp = 100;
    this.maxHp = 100;
    this.isDead = false;

    // Halloween Vampire Hunt State
    this.vampireHunt = null;
    this.nextVampireCheck = performance.now() + 10000;
    this.isBeingJumpscared = false;

    // Tet Crystal Dragon State & Flight Mount
    this.dragon = null;
    this.currentDragonSkin = localStorage.getItem('gh_dragon_active_skin') || 'gold';
    try {
      this.unlockedDragonSkins = JSON.parse(localStorage.getItem('gh_unlocked_dragon_skins') || '["gold"]');
    } catch (_) {
      this.unlockedDragonSkins = ['gold'];
    }
    this.isRidingDragon = false;
    this.dragonFlightTimer = 0;
    this.dragonSpeed = 18.0;
    this.dragonYaw = 0;
    this.dragonPitch = 0;
    this.dragonRoll = 0;
    this.dragonVelocity = new THREE.Vector3();
    this.activeQuest = null;
    this.flightRings = [];
    this.ringsCollected = 0;
    this.dragonKeys = { forward: false, backward: false, left: false, right: false, up: false, down: false };

    // Cache elements for safe zone check
    this.lastInSafe = null;
    this.badgeEl = null;
    this.speechLayerEl = null;

    // Shared raycaster for 3D cursor & crosshair aiming
    this.raycaster = new THREE.Raycaster();
    this.mouseNdc = new THREE.Vector2(0, 0);

    window.addEventListener(
      'pointermove',
      e => {
        this.mouseNdc.x = (e.clientX / window.innerWidth) * 2 - 1;
        this.mouseNdc.y = -(e.clientY / window.innerHeight) * 2 + 1;
      },
      { passive: true }
    );

    // Optimized Geometries & Materials Cache
    this.geos = {
      snowball: new THREE.SphereGeometry(0.22, 10, 10),
      arrowShaft: new THREE.CylinderGeometry(0.025, 0.025, 0.85, 6),
      heartHead: new THREE.ConeGeometry(0.14, 0.26, 6),
      firecracker: new THREE.CylinderGeometry(0.07, 0.07, 0.38, 6),
      spark: new THREE.SphereGeometry(0.09, 6, 6),
      circleRing: new THREE.RingGeometry(1.9, 2.3, 32),
      safeFloor: new THREE.PlaneGeometry(11.0 * TILE, 6.7 * TILE),
    };
    this.geos.arrowShaft.rotateX(Math.PI / 2);
    this.geos.heartHead.rotateX(Math.PI / 2);
    this.geos.circleRing.rotateX(-Math.PI / 2);
    this.geos.safeFloor.rotateX(-Math.PI / 2);

    this.mats = {
      snow: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }),
      gold: new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.8, roughness: 0.2 }),
      pink: new THREE.MeshStandardMaterial({ color: 0xff3377, emissive: 0xff1493, emissiveIntensity: 0.6 }),
      redFirecracker: new THREE.MeshStandardMaterial({ color: 0xd62828, roughness: 0.3 }),
      sparkRed: new THREE.MeshBasicMaterial({ color: 0xff2222 }),
      sparkGold: new THREE.MeshBasicMaterial({ color: 0xffdd44 }),
      sparkGreen: new THREE.MeshBasicMaterial({ color: 0x22ee66 }),
      sparkPink: new THREE.MeshBasicMaterial({ color: 0xff44aa }),
      redRing: new THREE.MeshBasicMaterial({ color: 0xff0033, side: THREE.DoubleSide, transparent: true, opacity: 0.75 }),
      safeFloor: new THREE.MeshBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.07, side: THREE.DoubleSide }),
      safeBorder: new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.45 }),
    };

    // Build the 3D Safe Zone visual barrier
    this.buildSafeZoneField();
  }

  // --------------------------------------------------------------------------
  // 3D SAFE ZONE VISUAL SHIELD FIELD
  // --------------------------------------------------------------------------
  buildSafeZoneField() {
    this.safeZoneGroup = new THREE.Group();
    this.group.add(this.safeZoneGroup);

    // Center of safe zone in world coords: x: 14.5 * TILE, z: 4.85 * TILE
    const cx = 14.5 * TILE;
    const cz = 4.85 * TILE;

    // Subtle floor perimeter (removed intrusive green border outline)
    const floorMesh = new THREE.Mesh(this.geos.safeFloor, this.mats.safeFloor);
    floorMesh.position.set(cx, 0.03, cz);
    this.safeZoneGroup.add(floorMesh);

    // Overhead floating 3D holographic title
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 96;
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'rgba(6, 78, 59, 0.88)';
    ctx.beginPath();
    ctx.roundRect(10, 10, 492, 76, 24);
    ctx.fill();
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.font = 'bold 34px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#a7f3d0';
    ctx.fillText('🛡️ VÙNG AN TOÀN · SAFE ZONE', 256, 48);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
    sprite.scale.set(4.2, 0.8, 1);
    sprite.position.set(cx, 4.2, cz - 2.5);
    this.safeZoneGroup.add(sprite);
  }

  setTheme(themeKey) {
    if (this.theme === themeKey) return;
    this.theme = themeKey;
    this.clearAll();
    this.hp = 100;
    this.isDead = false;
    this.updateHUDButton();
    this.updateHpUI();
    this.updateScoreboardUI();

    if (this.theme === 'halloween') {
      this.nextVampireCheck = performance.now() + 8000;
    } else if (this.theme === 'tet') {
      this.spawnGoldenDragon();
    }
  }

  clearAll() {
    for (const p of this.projectiles) {
      if (p.mesh) this.group.remove(p.mesh);
    }
    for (const pt of this.particles) {
      if (pt.mesh) this.group.remove(pt.mesh);
    }
    if (this.vampireHunt?.circleMesh) {
      this.group.remove(this.vampireHunt.circleMesh);
    }
    if (this.dragon?.group) {
      this.group.remove(this.dragon.group);
    }
    this.projectiles = [];
    this.particles = [];
    this.vampireHunt = null;
    this.dragon = null;
    this.scores.clear();

    const scareOverlay = document.getElementById('jumpscareOverlay');
    if (scareOverlay) scareOverlay.classList.add('hidden');
    this.isBeingJumpscared = false;
  }

  updateHUDButton() {
    const btn = document.getElementById('btnMinigame');
    if (!btn) return;
    const lbl = btn.querySelector('.item-label');
    const setTxt = (txt, fullTxt) => {
      if (lbl) lbl.textContent = fullTxt || txt;
      else btn.textContent = txt;
    };

    switch (this.theme) {
      case 'christmas':
        setTxt('❄️ Tuyết [G]', 'Minigame Bắn Tuyết PvP');
        btn.title = 'Minigame Giáng Sinh: Đấu Súng Cầu Tuyết FPS ngắm tâm (Chuột Trái / phím G)';
        break;
      case 'halloween':
        setTxt('🧛 Boss', 'Tránh Vampire Boss');
        btn.title = 'Halloween: Boss Vampire bay rình mồi & vồ Jumpscare (Chạy vào Vùng Ghế TV để an toàn)';
        break;
      case 'tet':
        setTxt('🎆 Pháo [G]', 'Minigame Pháo Thần Công');
        btn.title = 'Minigame Tết: Bắn Pháo Hoa Thần Công ngắm Kim Long rước phúc lộc (Chuột Trái / G)';
        break;
      case 'valentine':
        setTxt('💘 Cung [G]', 'Minigame Cung Cupid');
        btn.title = 'Minigame Valentine: Đấu Cung Cupid PvP ngắm tâm chuẩn xác (Chuột Trái / phím G)';
        break;
      default:
        setTxt('🎮 Minigame', 'Minigame Lễ Hội');
        break;
    }
  }

  updateHpUI() {
    const hpBar = document.getElementById('playerHpBar');
    const hpVal = document.getElementById('hpValue');
    const hpFill = document.getElementById('hpFill');
    if (!hpBar || !hpVal || !hpFill) return;

    const isPvpTheme = this.theme === 'christmas' || this.theme === 'valentine';
    hpBar.classList.toggle('hidden', !isPvpTheme);

    hpVal.textContent = `${Math.max(0, this.hp)} / ${this.maxHp}`;
    const pct = Math.max(0, Math.min(100, (this.hp / this.maxHp) * 100));
    hpFill.style.width = `${pct}%`;
    hpFill.style.background =
      pct > 50
        ? 'linear-gradient(90deg,#22c55e,#4ade80)'
        : pct > 25
        ? 'linear-gradient(90deg,#eab308,#fde047)'
        : 'linear-gradient(90deg,#dc2626,#f87171)';
  }

  // --------------------------------------------------------------------------
  // TRUE 3D FPS CROSSHAIR RAYCAST AIMING
  // --------------------------------------------------------------------------
  getAimTarget() {
    const me = this.getMe();
    if (!me) return new THREE.Vector3(0, 1, 0);

    const ndc = document.pointerLockElement ? new THREE.Vector2(0, 0) : this.mouseNdc;
    this.raycaster.setFromCamera(ndc, this.camera);

    // 1. Raycast against peer player avatars
    const peers = this.getPeers();
    if (peers) {
      for (const p of peers.values()) {
        if (p.av?.root) {
          const hits = this.raycaster.intersectObjects(p.av.root.children, true);
          if (hits && hits.length > 0) {
            return hits[0].point;
          }
        }
      }
    }

    // 2. Raycast against scene objects (walls, obstacles, ground)
    const hits = this.raycaster.intersectObjects(this.scene.children, true);
    if (hits && hits.length > 0) {
      for (const h of hits) {
        if (h.object === this.safeZoneGroup || this.safeZoneGroup.getObjectById(h.object.id)) continue;
        if (me.av?.root && (h.object === me.av.root || me.av.root.getObjectById(h.object.id))) continue;
        const d = h.point.distanceTo(this.camera.position);
        if (d > 0.8 && d < 65) {
          return h.point;
        }
      }
    }

    // 3. Fallback: Project straight 40 meters forward along the sight line
    const fallback = new THREE.Vector3();
    this.raycaster.ray.at(42, fallback);
    return fallback;
  }

  // --------------------------------------------------------------------------
  // TRIGGER ACTION (LEFT-CLICK OR 'G' KEY)
  // --------------------------------------------------------------------------
  triggerAction() {
    if (this.isDead || this.isBeingJumpscared) return;

    const now = performance.now();
    // Fast responsive firing rate (0.28s cooldown)
    if (now - this.lastActionTime < 280) return;
    this.lastActionTime = now;

    const me = this.getMe();
    if (!me) return;

    switch (this.theme) {
      case 'christmas':
        this.actionPvPSnowball();
        break;
      case 'halloween':
        this.toast('🧛 Boss Vampire đang rình mò trên bầu trời! Chạy vào Vùng Ghế TV để an toàn!');
        break;
      case 'tet':
        this.actionTetFirecracker();
        break;
      case 'valentine':
        this.actionPvPCupid();
        break;
    }
  }

  actionPvPSnowball() {
    const me = this.getMe();
    const aim = this.getAimTarget();

    me.av?.playEmote('interact');
    playSfx('snow_throw', 'christmas');

    const sx = me.x * TILE;
    const sy = me.h + 1.25;
    const sz = me.y * TILE;

    this.emitOp({
      k: 'mg_snowball_throw',
      fromName: me.name,
      sx,
      sy,
      sz,
      tx: aim.x,
      ty: aim.y,
      tz: aim.z,
    });
  }

  actionPvPCupid() {
    const me = this.getMe();
    const aim = this.getAimTarget();

    me.av?.playEmote('interact');
    playSfx('cupid_arrow_shoot', 'valentine');

    const sx = me.x * TILE;
    const sy = me.h + 1.25;
    const sz = me.y * TILE;

    this.emitOp({
      k: 'mg_cupid_shoot',
      fromName: me.name,
      sx,
      sy,
      sz,
      tx: aim.x,
      ty: aim.y,
      tz: aim.z,
    });
  }

  actionTetFirecracker() {
    const me = this.getMe();
    const aim = this.getAimTarget();

    me.av?.playEmote('interact');
    playSfx('firecracker', 'tet');

    const sx = me.x * TILE;
    const sy = me.h + 1.25;
    const sz = me.y * TILE;

    this.emitOp({
      k: 'mg_tet_cannon',
      fromName: me.name,
      sx,
      sy,
      sz,
      tx: aim.x,
      ty: aim.y,
      tz: aim.z,
    });
  }

  // --------------------------------------------------------------------------
  // SPAWN PROJECTILE (STRAIGHT HIGH-SPEED FPS TRAJECTORY)
  // --------------------------------------------------------------------------
  spawnProjectile(data, type) {
    let mesh;
    if (type === 'snowball') {
      mesh = new THREE.Mesh(this.geos.snowball, this.mats.snow);
    } else if (type === 'cupid') {
      mesh = new THREE.Group();
      const shaft = new THREE.Mesh(this.geos.arrowShaft, this.mats.pink);
      const head = new THREE.Mesh(this.geos.heartHead, this.mats.pink);
      head.position.z = 0.42;
      mesh.add(shaft, head);
    } else if (type === 'firecracker') {
      mesh = new THREE.Mesh(this.geos.firecracker, this.mats.redFirecracker);
    }

    if (!mesh) return;
    mesh.position.set(data.sx, data.sy, data.sz);
    mesh.lookAt(data.tx, data.ty, data.tz);
    this.group.add(mesh);

    const dx = data.tx - data.sx;
    const dy = data.ty - data.sy;
    const dz = data.tz - data.sz;
    const dist = Math.hypot(dx, dy, dz);
    // Fast high-speed muzzle velocity (38 m/s)
    const speed = type === 'firecracker' ? 32 : 40;
    const duration = Math.max(0.18, dist / speed);

    this.projectiles.push({
      type,
      mesh,
      data,
      startX: data.sx,
      startY: data.sy,
      startZ: data.sz,
      targetX: data.tx,
      targetY: data.ty,
      targetZ: data.tz,
      progress: 0,
      duration,
    });
  }

  // --------------------------------------------------------------------------
  // HIT RESOLUTION (PVP DAMAGE & SAFE ZONE SHIELDING)
  // --------------------------------------------------------------------------
  checkProjectileImpact(proj) {
    const { data, type } = proj;
    const me = this.getMe();
    if (!me) return;

    const myX = me.x * TILE;
    const myY = me.h + 0.9;
    const myZ = me.y * TILE;

    const hitDist = Math.hypot(proj.mesh.position.x - myX, proj.mesh.position.z - myZ);
    const hitHeight = Math.abs(proj.mesh.position.y - myY);

    if (data.fromName !== me.name && hitDist < 0.95 && hitHeight < 1.45) {
      const inSafe = isInSafeZone(me.x, me.y) || !!me.seatSlot;

      if (inSafe) {
        // Safe Zone Shielded!
        playSfx('xmas_bell', this.theme);
        this.toast('🛡️ BỤP! VÙNG AN TOÀN ĐÃ CHẶN ĐẠN! Miễn sát thương!');
        if (this.floaters) this.floaters.push({ e: '🛡️ Miễn Sát Thương', who: 'me', t: Date.now() });
        return;
      }

      // Outside Safe Zone: TAKE PVP DAMAGE!
      if (window.adminGodMode) {
        this.toast('🛡️ BẤT TỬ ADMIN (God Mode): Miễn mọi sát thương!');
        if (this.floaters) this.floaters.push({ e: '🛡️ GOD MODE', who: 'me', t: Date.now() });
        return;
      }
      const dmg = 34;
      this.hp = Math.max(0, this.hp - dmg);
      this.updateHpUI();

      if (type === 'snowball') {
        playSfx('snow_hit', 'christmas');
        me.av?.playEmote('scared');
        if (this.floaters) this.floaters.push({ e: `❄️ -${dmg} HP`, who: 'me', t: Date.now() });
      } else if (type === 'cupid') {
        playSfx('cupid_arrow_hit', 'valentine');
        playSfx('valentine_harp', 'valentine');
        me.av?.playEmote('scared');
        if (this.floaters) this.floaters.push({ e: `💘 -${dmg} HP`, who: 'me', t: Date.now() });
      }

      if (this.hp <= 0 && !this.isDead) {
        this.isDead = true;
        this.toast(`💥 BẠN ĐÃ BỊ HẠ GỤC BỞI ${data.fromName}! Đang hồi sinh sau 3s…`);
        me.av?.playEmote('scared');

        this.emitOp({
          k: 'mg_pvp_ko',
          killer: data.fromName,
          victim: me.name,
        });

        setTimeout(() => {
          this.hp = 100;
          this.isDead = false;
          me.h = 0;
          me.vy = 0;
          this.updateHpUI();
          this.toast('✨ Bạn đã hồi sinh đầy 100% máu tại sảnh an toàn!');
        }, 3000);
      }
    }

    // Spectacular Tet Fireworks Burst on detonation
    if (type === 'firecracker') {
      this.triggerSpectacularFireworks(proj.mesh.position.x, proj.mesh.position.y, proj.mesh.position.z, data.fromName);
    }
  }

  // --------------------------------------------------------------------------
  // TET: SPECTACULAR MULTI-STAGE FIREWORKS ENGINE & DRAGON HIT
  // --------------------------------------------------------------------------
  triggerSpectacularFireworks(x, y, z, byName) {
    playSfx('firework_rocket', 'tet');
    playSfx('firecracker', 'tet');

    // Dynamic Flash Light illuminates map for 0.4s
    const flash = new THREE.PointLight(0xffd700, 4.5, 26);
    flash.position.set(x, y, z);
    this.group.add(flash);
    setTimeout(() => this.group.remove(flash), 400);

    // 32 sparkling star particles radiating outwards
    const mats = [this.mats.sparkGold, this.mats.sparkRed, this.mats.sparkGreen, this.mats.sparkPink];
    for (let i = 0; i < 32; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = (Math.random() - 0.5) * Math.PI;
      const spd = 4.5 + Math.random() * 6.5;

      const pMesh = new THREE.Mesh(this.geos.spark, mats[i % mats.length]);
      pMesh.position.set(x, y, z);
      this.group.add(pMesh);

      this.particles.push({
        mesh: pMesh,
        vx: Math.cos(phi) * Math.cos(theta) * spd,
        vy: Math.sin(phi) * spd + 2.0,
        vz: Math.cos(phi) * Math.sin(theta) * spd,
        life: 0,
        maxLife: 0.8 + Math.random() * 0.4,
      });
    }

    // Check hit against Golden Dragon
    if (this.dragon?.group) {
      const dDist = this.dragon.group.position.distanceTo(new THREE.Vector3(x, y, z));
      if (dDist < 5.2) {
        // DRAGON AWAKENING BLESSING!
        this.dragon.glowUntil = performance.now() + 1500;
        playSfx('firework_rocket', 'tet');
        this.toast(`🐲 ${byName} ĐÃ BẮN TRÚNG KIM LONG HOÀNG KIM! KÍCH HOẠT ĐẠI CÁT ĐẠI LỢI! 🎉`);
        if (this.floaters) this.floaters.push({ e: '🐲 KIM LONG PHÁT TÀI!', who: 'me', t: Date.now() });

        const s = this.scores.get(byName) || { name: byName, score: 0 };
        s.score += 200;
        this.scores.set(byName, s);
        this.updateScoreboardUI('🧧 PHÁO HOA THẦN LONG', 'Điểm Cát Tường');
      }
    }
  }

  // --------------------------------------------------------------------------
  // TET: ARTICULATED CRYSTAL GEM DRAGON (MATCHING CRYSTAL DRAGON PHOTO)
  // --------------------------------------------------------------------------
  setDragonSkin(skinKey) {
    if (!DRAGON_SKINS[skinKey]) return;
    this.currentDragonSkin = skinKey;
    localStorage.setItem('gh_dragon_active_skin', skinKey);
    if (this.theme === 'tet') {
      this.spawnGoldenDragon(skinKey);
    }
  }

  getUnlockedDragonSkins() {
    return this.unlockedDragonSkins;
  }

  spawnGoldenDragon(skinKey = null) {
    if (this.dragon?.group) {
      if (this.dragonInstance?.dispose) {
        this.dragonInstance.dispose();
      } else {
        this.group.remove(this.dragon.group);
      }
      this.dragon = null;
      this.dragonInstance = null;
    }

    const key = skinKey || this.currentDragonSkin || 'gold';
    const skin = DRAGON_SKINS[key] || DRAGON_SKINS.gold;

    // Use the realistic procedural oriental dragon model from dragon.js
    const dragonSkinColors = {
      gold: { top: 0xca8a04, side: 0xfacc15, belly: 0xfef08a, skin: 0xfacc15, mane: 0xffffff, fin: 0xdc2626 },
      jade: { top: 0x047857, side: 0x10b981, belly: 0xa7f3d0, skin: 0x10b981, mane: 0xfde047, fin: 0xfacc15 },
      ice: { top: 0x0891b2, side: 0x06b6d4, belly: 0xcffafe, skin: 0x22d3ee, mane: 0xffffff, fin: 0x67e8f9 },
      amethyst: { top: 0x6b21a8, side: 0x9333ea, belly: 0xf3e8ff, skin: 0xa855f7, mane: 0xf43f5e, fin: 0xc084fc },
      ruby: { top: 0xb91c1c, side: 0xef4444, belly: 0xfee2e2, skin: 0xef4444, mane: 0xfacc15, fin: 0xf97316 },
      sapphire: { top: 0x1e40af, side: 0x2563eb, belly: 0xdbeafe, skin: 0x3b82f6, mane: 0x38bdf8, fin: 0x60a5fa },
    };

    const inst = createDragon({
      quality: 'high',
      castShadow: true,
      pearlLight: true,
      colors: dragonSkinColors[key] || dragonSkinColors.gold,
    });

    this.dragonInstance = inst;
    this.dragonGroup = inst.group;
    this.group.add(this.dragonGroup);

    this.dragon = {
      group: this.dragonGroup,
      head: inst.head,
      mountPoint: inst.mountPoint,
      pearl: inst.pearl,
      skinKey: skin.id,
      update: inst.update,
    };
  }

  // --------------------------------------------------------------------------
  // DRAGON MOUNT & FLIGHT CONTROLS (30S FLIGHT MODE)
  // --------------------------------------------------------------------------
  startDragonRide(questStage = 0) {
    if (!this.dragon?.group) {
      this.spawnGoldenDragon();
    }
    const me = this.getMe();
    if (!me) return;

    this.isRidingDragon = true;
    this.dragonFlightTimer = 30.0;
    this.dragonSpeed = 18.0;
    this.dragonYaw = this.camera?.rotation?.y || 0;
    this.dragonPitch = 0;
    this.dragonRoll = 0;
    this.dragonVelocity.set(0, 0, 0);

    // Position dragon right at player's location
    this.dragon.group.position.set(me.x * TILE, 3.8, me.y * TILE);

    // Show Flight HUD
    const hud = document.getElementById('dragonFlightHud');
    if (hud) {
      hud.classList.remove('hidden');
      const timeTxt = hud.querySelector('#dragonFlightTimeText');
      if (timeTxt) timeTxt.textContent = '30s';
      const questProg = hud.querySelector('#dragonFlightQuestProgress');
      if (questProg) questProg.textContent = '';
    }

    if (questStage > 0) {
      this.startFlightQuest(questStage);
    } else {
      this.clearFlightRings();
      this.activeQuest = null;
    }

    playSfx('tet_lixi', 'tet');
    this.toast('🐉 BẠN ĐÃ CƯỠI LÊN RỒNG THẦN! Dùng W/S/A/D/Space để bay lượn trên bầu trời (30s)!');
    this.emitOp?.('dragon_mount', { riding: true, skin: this.currentDragonSkin, questStage });
  }

  stopDragonRide() {
    if (!this.isRidingDragon) return;
    this.isRidingDragon = false;
    this.dragonFlightTimer = 0;

    const hud = document.getElementById('dragonFlightHud');
    if (hud) hud.classList.add('hidden');

    if (this.activeQuest && this.ringsCollected < this.activeQuest.ringCount) {
      this.toast('⏳ Thử thách bay đã hết thời gian! Hãy thử lại ở Đài Triệu Hồi Rồng nhé!');
      this.clearFlightRings();
      this.activeQuest = null;
    }

    const me = this.getMe();
    if (me && this.dragon?.group) {
      me.x = Math.max(3, Math.min(26, this.dragon.group.position.x / TILE));
      me.y = Math.max(3, Math.min(20, this.dragon.group.position.z / TILE));
      if (me.av?.root) {
        me.av.root.position.set(me.x * TILE, 0, me.y * TILE);
      }
    }

    this.toast('🎉 Chuyến bay kết thúc! Rồng Thần đã đưa bạn hạ cánh an toàn.');
    this.emitOp?.('dragon_mount', { riding: false });
  }

  isRiding() {
    return this.isRidingDragon;
  }

  // --------------------------------------------------------------------------
  // AERIAL RING FLIGHT QUEST SYSTEM (UNLOCK DRAGON SKINS)
  // --------------------------------------------------------------------------
  startFlightQuest(stageIndex) {
    const quest = FLIGHT_QUESTS[stageIndex - 1] || FLIGHT_QUESTS[0];
    this.activeQuest = quest;
    this.ringsCollected = 0;
    this.spawnQuestRings(quest);

    const hud = document.getElementById('dragonFlightHud');
    if (hud) {
      const questProg = hud.querySelector('#dragonFlightQuestProgress');
      if (questProg) {
        questProg.textContent = `🎯 Vòng bay: 0 / ${quest.ringCount} · Mở khóa: ${DRAGON_SKINS[quest.targetSkin]?.name}`;
      }
    }
    this.toast(`🎯 BẮT ĐẦU: ${quest.title}! Hãy bay xuyên qua ${quest.ringCount} vòng tròn lơ lửng trên trời!`);
  }

  spawnQuestRings(quest) {
    this.clearFlightRings();

    const targetSkin = DRAGON_SKINS[quest.targetSkin] || DRAGON_SKINS.jade;
    const ringColor = targetSkin.accent || '#facc15';

    // Scenic aerial waypoints soaring around the Tet plaza
    const waypoints = [
      { x: 14.5 * TILE, y: 12.0, z: 16.5 * TILE },
      { x: 19.5 * TILE, y: 16.5, z: 14.5 * TILE },
      { x: 22.5 * TILE, y: 20.0, z: 11.5 * TILE },
      { x: 18.5 * TILE, y: 25.0, z: 6.5 * TILE },
      { x: 14.5 * TILE, y: 22.0, z: 4.5 * TILE },
      { x: 9.5 * TILE, y: 18.0, z: 7.0 * TILE },
      { x: 6.5 * TILE, y: 14.5, z: 11.5 * TILE },
      { x: 6.5 * TILE, y: 11.5, z: 16.5 * TILE },
      { x: 10.5 * TILE, y: 16.0, z: 19.5 * TILE },
      { x: 14.5 * TILE, y: 28.0, z: 17.5 * TILE },
      { x: 20.5 * TILE, y: 24.0, z: 12.5 * TILE },
      { x: 16.5 * TILE, y: 30.0, z: 8.5 * TILE },
      { x: 11.5 * TILE, y: 21.0, z: 12.5 * TILE },
      { x: 14.5 * TILE, y: 15.0, z: 11.5 * TILE },
      { x: 18.5 * TILE, y: 19.0, z: 15.5 * TILE },
    ];

    for (let i = 0; i < quest.ringCount; i++) {
      const wp = waypoints[i % waypoints.length];
      const ring = buildAerialRing(ringColor, 3.4);
      ring.position.set(wp.x, wp.y, wp.z);
      ring.userData.collected = false;
      ring.userData.radius = 3.4;
      this.group.add(ring);
      this.flightRings.push(ring);
    }
  }

  clearFlightRings() {
    for (const r of this.flightRings) {
      if (r) this.group.remove(r);
    }
    this.flightRings = [];
  }

  completeFlightQuest() {
    if (!this.activeQuest) return;
    const targetSkin = this.activeQuest.targetSkin;
    const skinInfo = DRAGON_SKINS[targetSkin];

    if (!this.unlockedDragonSkins.includes(targetSkin)) {
      this.unlockedDragonSkins.push(targetSkin);
      localStorage.setItem('gh_unlocked_dragon_skins', JSON.stringify(this.unlockedDragonSkins));
    }
    this.setDragonSkin(targetSkin);

    playSfx('plinko_win', 'casino');
    this.toast(`🏆 CHÚC MỪNG! BẠN ĐÃ MỞ KHÓA THÀNH CÔNG SKIN RỒNG: ${skinInfo?.name}!`);

    const hud = document.getElementById('dragonFlightHud');
    if (hud) {
      const questProg = hud.querySelector('#dragonFlightQuestProgress');
      if (questProg) questProg.textContent = `🎉 ĐÃ MỞ KHÓA: ${skinInfo?.name}!`;
    }

    this.clearFlightRings();
    this.activeQuest = null;
  }

  // --------------------------------------------------------------------------
  // HALLOWEEN: VAMPIRE AUTONOMOUS HUNTING & DYNAMIC SANCTUARY ESCAPE
  // --------------------------------------------------------------------------
  updateVampireAI(now, dt) {
    if (this.theme !== 'halloween') return;

    const me = this.getMe();
    if (!me) return;

    // Check if player enters Safe Zone while being hunted -> INSTANT SANCTUARY ESCAPE!
    if (this.vampireHunt) {
      const inSafe = isInSafeZone(me.x, me.y) || !!me.seatSlot;
      if (inSafe) {
        // Escaped safely into TV Seating sanctuary!
        if (this.vampireHunt.circleMesh) this.group.remove(this.vampireHunt.circleMesh);
        this.vampireHunt = null;
        playSfx('xmas_bell', 'halloween');
        this.toast('🛡️ BẠN ĐÃ KỊP TRÚ ẨN VÀO VÙNG AN TOÀN! Bá Tước Ma Cà Rồng phải bay lui!');
        if (this.floaters) this.floaters.push({ e: '🛡️ Trú Ẩn An Toàn!', who: 'me', t: Date.now() });
        return;
      }
    }

    // Schedule next hunt
    if (!this.vampireHunt && now > this.nextVampireCheck) {
      this.nextVampireCheck = now + 16000 + Math.random() * 7000;

      const inSafe = isInSafeZone(me.x, me.y) || !!me.seatSlot;
      if (!inSafe) {
        // Target player outside Safe Zone!
        const circleMesh = new THREE.Mesh(this.geos.circleRing, this.mats.redRing);
        circleMesh.position.set(me.x * TILE, 0.08, me.y * TILE);
        this.group.add(circleMesh);

        playSfx('spooky_laugh', 'halloween');
        playSfx('ghost_boo', 'halloween');
        this.toast('⚠️ NGUY HIỂM! BÁ TƯỚC MA CÀ RỒNG ĐANG VỒ BẠN! CHẠY NGAY VÀO VÙNG GHẾ TV! ⚠️');

        this.vampireHunt = {
          worldX: me.x * TILE,
          worldZ: me.y * TILE,
          startTime: now,
          warnDuration: 3200,
          circleMesh,
        };
      }
    }

    // Active Hunt warning & strike
    if (this.vampireHunt) {
      const vh = this.vampireHunt;
      const elapsed = now - vh.startTime;

      if (vh.circleMesh) {
        const pulse = 1.0 + Math.sin(now * 0.015) * 0.18;
        vh.circleMesh.scale.set(pulse, pulse, pulse);
      }

      if (elapsed >= vh.warnDuration) {
        if (vh.circleMesh) this.group.remove(vh.circleMesh);

        const currentDist = Math.hypot(me.x * TILE - vh.worldX, me.y * TILE - vh.worldZ);
        const inSafe = isInSafeZone(me.x, me.y) || !!me.seatSlot;

        if (currentDist < 2.5 && !inSafe && !window.adminGodMode) {
          this.executeVampireJumpscare();
        } else {
          this.toast('💨 THOÁT HIỂM NGOẠN MỤC! Bạn đã né được cú vồ của Bá Tước Ma Cà Rồng!');
        }

        this.vampireHunt = null;
      }
    }
  }

  executeVampireJumpscare() {
    const me = this.getMe();
    if (!me || this.isBeingJumpscared) return;

    this.isBeingJumpscared = true;
    playSfx('spooky_laugh', 'halloween');
    playSfx('ghost_boo', 'halloween');

    // Lift player into dark sky
    me.h = 5.2;
    me.vy = 0;
    me.av?.playEmote('scared');

    const scareOverlay = document.getElementById('jumpscareOverlay');
    if (scareOverlay) scareOverlay.classList.remove('hidden');

    setTimeout(() => {
      if (scareOverlay) scareOverlay.classList.add('hidden');
      this.isBeingJumpscared = false;

      // Drop player safely to ground clamped inside map bounds
      me.h = 0;
      me.vy = 0;
      me.x = Math.max(2.0, Math.min(26.0, me.x));
      me.y = Math.max(2.0, Math.min(20.0, me.y));
      this.toast('😱 Bạn vừa được thả xuống đất an toàn sau cơn ác mộng!');
    }, 1800);
  }

  // --------------------------------------------------------------------------
  // FRAME UPDATE LOOP (PROJECTILES, PARTICLES, DRAGON)
  // --------------------------------------------------------------------------
  update(dt, playerYaw = null) {
    const now = performance.now();
    const me = this.getMe();
    if (playerYaw !== null) this.playerYaw = playerYaw;

    // 1. Safe Zone Detection (Auto-hide speech bubbles in Safe Zone & update indicator only when state changes)
    if (me) {
      const inSafe = isInSafeZone(me.x, me.y) || !!me.seatSlot;
      if (inSafe !== this.lastInSafe) {
        this.lastInSafe = inSafe;
        if (!this.badgeEl) this.badgeEl = document.getElementById('safeZoneBadge');
        if (this.badgeEl) this.badgeEl.classList.toggle('hidden', !inSafe);
        if (!this.speechLayerEl) this.speechLayerEl = document.getElementById('speechLayer');
        if (this.speechLayerEl) this.speechLayerEl.classList.toggle('safe-hidden', inSafe);
      }
    }

    // 2. Halloween Vampire AI
    this.updateVampireAI(now, dt);

    // 3. Update Flying Projectiles (Straight High-Speed Trajectory)
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.progress += dt / p.duration;

      if (p.progress >= 1.0) {
        if (p.mesh) this.group.remove(p.mesh);
        this.checkProjectileImpact(p);
        this.projectiles.splice(i, 1);
        continue;
      }

      const t = p.progress;
      const curX = p.startX + (p.targetX - p.startX) * t;
      const curY = p.startY + (p.targetY - p.startY) * t;
      const curZ = p.startZ + (p.targetZ - p.startZ) * t;

      if (p.mesh) {
        p.mesh.position.set(curX, curY, curZ);
        if (p.type === 'snowball') {
          p.mesh.rotation.x += dt * 10;
        } else if (p.type === 'cupid') {
          p.mesh.lookAt(p.targetX, p.targetY, p.targetZ);
        } else if (p.type === 'firecracker') {
          p.mesh.rotation.x += dt * 12;
        }
      }

      // Continuous swept hit check against local player
      if (me && p.data.fromName !== me.name) {
        const hitDist = Math.hypot(curX - me.x * TILE, curZ - me.y * TILE);
        if (hitDist < 0.85 && Math.abs(curY - (me.h + 0.9)) < 1.1) {
          if (p.mesh) this.group.remove(p.mesh);
          this.checkProjectileImpact(p);
          this.projectiles.splice(i, 1);
        }
      }
    }

    // 4. Update Firework Particles (Tet)
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.life += dt;
      if (pt.life >= pt.maxLife) {
        if (pt.mesh) this.group.remove(pt.mesh);
        this.particles.splice(i, 1);
        continue;
      }

      pt.mesh.position.x += pt.vx * dt;
      pt.mesh.position.y += pt.vy * dt;
      pt.mesh.position.z += pt.vz * dt;
      pt.vy -= 5.0 * dt; // gravity deceleration

      const scale = (1 - pt.life / pt.maxLife) * 1.4;
      pt.mesh.scale.set(scale, scale, scale);
    }

    // 5. Update Crystal Dragon (Patrol OR Player-Controlled Flight)
    if (this.dragon?.group) {
      if (this.isRidingDragon) {
        // Player Controlled Flight Mode (30s)
        this.dragonFlightTimer -= dt;
        const hud = document.getElementById('dragonFlightHud');
        if (hud) {
          const timeTxt = hud.querySelector('#dragonFlightTimeText');
          if (timeTxt) {
            timeTxt.textContent = `${Math.max(0, Math.ceil(this.dragonFlightTimer))}s`;
          }
        }

        if (this.dragonFlightTimer <= 0) {
          this.stopDragonRide();
          return;
        }

        // Flight Steer & Kinematics: Direct player movement control (only moves when input is pressed)
        const keys = this.dragonKeys;
        const curYaw = this.playerYaw !== undefined && this.playerYaw !== null ? this.playerYaw : (this.camera?.rotation?.y || 0);

        let fwd = (keys.forward ? 1 : 0) - (keys.backward ? 1 : 0);
        let str = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
        const isMoving = fwd !== 0 || str !== 0;

        let vy = 0;
        if (keys.up) vy = 11.0;
        else if (keys.down) vy = -11.0;

        const curPos = this.dragon.group.position;

        if (isMoving) {
          // Camera-relative movement (just like normal player walking/running)
          let dx = -Math.sin(curYaw) * fwd + Math.cos(curYaw) * str;
          let dz = -Math.cos(curYaw) * fwd - Math.sin(curYaw) * str;
          const len = Math.hypot(dx, dz);
          dx /= len;
          dz /= len;

          const targetYaw = Math.atan2(dx, dz);
          // Smoothly rotate dragon toward move direction
          let diff = targetYaw - this.dragonYaw;
          while (diff < -Math.PI) diff += Math.PI * 2;
          while (diff > Math.PI) diff -= Math.PI * 2;
          this.dragonYaw += diff * Math.min(1, dt * 10);

          const moveSpeed = keys.forward ? 20.0 : 14.0;
          curPos.x += dx * moveSpeed * dt;
          curPos.z += dz * moveSpeed * dt;

          this.dragonPitch = THREE.MathUtils.lerp(this.dragonPitch, keys.forward ? 0.15 : -0.15, dt * 6);
          this.dragonRoll = THREE.MathUtils.lerp(this.dragonRoll, -str * 0.35, dt * 6);
        } else {
          // Idle hovering in place - no auto flight!
          this.dragonPitch = THREE.MathUtils.lerp(this.dragonPitch, 0, dt * 5);
          this.dragonRoll = THREE.MathUtils.lerp(this.dragonRoll, 0, dt * 5);
          // Gentle hovering vertical wave
          curPos.y += Math.sin(now * 0.003) * 0.012;
        }

        curPos.y += vy * dt;

        // Boundaries clamp (smooth airspace ceiling & floor)
        curPos.y = Math.max(3.2, Math.min(46.0, curPos.y));
        curPos.x = Math.max(3.5 * TILE, Math.min(26.5 * TILE, curPos.x));
        curPos.z = Math.max(3.5 * TILE, Math.min(20.5 * TILE, curPos.z));

        this.dragon.group.rotation.y = this.dragonYaw;
        this.dragon.head.rotation.x = this.dragonPitch;
        this.dragon.head.rotation.z = this.dragonRoll;

        // Update procedural Dragon animation (spine wave, whiskers, jaw, fins, legs)
        if (this.dragon.update) {
          this.dragon.update(dt);
        }

        // Mount local player avatar on dragon neck facing forward
        const me = this.getMe();
        if (me?.av?.root && this.dragon.mountPoint) {
          const mountWorld = this.dragon.mountPoint.getWorldPosition(new THREE.Vector3());
          me.av.root.position.copy(mountWorld);
          me.av.root.rotation.y = this.dragonYaw;
          me.r = this.dragonYaw;
          me.x = mountWorld.x / TILE;
          me.y = mountWorld.z / TILE;
          me.h = mountWorld.y;
          me.loco = 'sit';
        }

        // Check aerial ring collection
        if (this.activeQuest && this.flightRings.length > 0) {
          const headPos = this.dragon.head.getWorldPosition(new THREE.Vector3());
          for (const ring of this.flightRings) {
            if (!ring.userData.collected) {
              const d = headPos.distanceTo(ring.position);
              if (d < ring.userData.radius + 1.4) {
                ring.userData.collected = true;
                ring.visible = false;
                this.ringsCollected++;
                playSfx('plinko_win', 'casino');
                this.toast(`🎯 Thu thập vòng bay (${this.ringsCollected}/${this.activeQuest.ringCount})!`);
                const progEl = document.getElementById('dragonFlightQuestProgress');
                if (progEl) {
                  progEl.textContent = `🎯 Vòng bay: ${this.ringsCollected} / ${this.activeQuest.ringCount} · Mở khóa: ${DRAGON_SKINS[this.activeQuest.targetSkin]?.name}`;
                }
                if (this.ringsCollected >= this.activeQuest.ringCount) {
                  this.completeFlightQuest();
                }
              }
            }
          }
        }
      } else {
        // Autonomous figure-8 sky patrol
        const angle = now * 0.00045;
        const tx = (14.5 + Math.sin(angle) * 8.5) * TILE;
        const tz = (11.5 + Math.cos(angle * 2) * 5.5) * TILE;
        const ty = 9.5 + Math.sin(angle * 3) * 2.2;

        const curPos = this.dragon.group.position;
        curPos.x += (tx - curPos.x) * Math.min(1, dt * 2.5);
        curPos.y += (ty - curPos.y) * Math.min(1, dt * 2.5);
        curPos.z += (tz - curPos.z) * Math.min(1, dt * 2.5);

        const dx = tx - curPos.x;
        const dz = tz - curPos.z;
        if (dx * dx + dz * dz > 0.001) {
          this.dragon.group.rotation.y = Math.atan2(dx, dz);
        }

        // Update procedural Dragon animation (spine wave, whiskers, jaw, fins, legs)
        if (this.dragon.update) {
          this.dragon.update(dt);
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // HANDLE NETWORK OPS FROM PEERS
  // --------------------------------------------------------------------------
  handleNetworkOp(op) {
    switch (op.k) {
      case 'mg_snowball_throw':
        this.spawnProjectile(op, 'snowball');
        break;
      case 'mg_cupid_shoot':
        this.spawnProjectile(op, 'cupid');
        break;
      case 'mg_tet_cannon':
        this.spawnProjectile(op, 'firecracker');
        break;
      case 'mg_pvp_ko': {
        const killer = op.killer;
        const victim = op.victim;
        this.toast(`💥 ${killer} đã hạ gục ${victim}! (+1 Điểm Chiến Công 🏆)`);

        const s = this.scores.get(killer) || { name: killer, score: 0 };
        s.score += 1;
        this.scores.set(killer, s);
        this.updateScoreboardUI('🏆 BẢNG PHONG THẦN PVP', 'Hạ gục (Kills)');
        break;
      }
    }
  }

  // --------------------------------------------------------------------------
  // SCOREBOARD UI
  // --------------------------------------------------------------------------
  updateScoreboardUI(title = null, metric = 'Điểm') {
    let board = document.getElementById('minigameBoard');
    if (!board) {
      board = document.createElement('div');
      board.id = 'minigameBoard';
      board.className = 'minigame-board';
      document.body.appendChild(board);
    }

    if (this.scores.size === 0) {
      board.classList.add('hidden');
      return;
    }

    board.classList.remove('hidden');
    const sorted = [...this.scores.values()].sort((a, b) => b.score - a.score);

    let html = `<h4>🏆 ${title || 'BẢNG CHIẾN ĐẤU'}</h4><div class="mg-list">`;
    sorted.slice(0, 5).forEach((entry, idx) => {
      const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '•';
      html += `<div class="mg-row"><span>${medal} ${entry.name}</span><b>${entry.score}</b></div>`;
    });
    html += `</div>`;
    board.innerHTML = html;
  }
}
