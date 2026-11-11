// ============================================================================
// MULTIPLAYER THEMED MINIGAMES FOR GATHER_HOLIDAYS (OPTIMIZED & EXPANDED)
// - Christmas & Valentine: True 3D FPS Crosshair Raycast Combat, 100 HP & Safe Zone
// - Halloween: Creepy Vampire Boss Autonomous Hunting, Dynamic Safe Zone Sanctuary Escape
// - Tet: Spectacular Multi-Stage Fireworks Engine & Mythical Golden Dragon (Kim Long)
// ============================================================================

import * as THREE from 'three';
import { playSfx } from './audio.js';

const TILE = 2;

// Check if coordinates (in tile space) are within the TV Cinema & Seating Safe Zone
export function isInSafeZone(x, y) {
  return x >= 9.0 && x <= 20.0 && y >= 1.5 && y <= 8.2;
}

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

    // Tet Golden Dragon State
    this.dragon = null;

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
  // TET: MYTHICAL GOLDEN DRAGON (KIM LONG) ARTICULATION - MATCHING IMAGE 2
  // --------------------------------------------------------------------------
  spawnGoldenDragon() {
    this.dragonGroup = new THREE.Group();
    this.group.add(this.dragonGroup);

    // Color palette based directly on image_2.png:
    // Bright Mai Flower Yellow (#facc15 / #fde047), Fiery Crimson (#dc2626 / #ef4444)
    const brightGoldMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.3, metalness: 0.25 });
    const maiYellowMat = new THREE.MeshStandardMaterial({ color: 0xfde047, roughness: 0.25, metalness: 0.2 });
    const darkGoldMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.35, metalness: 0.3 });
    const crimsonMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.35, metalness: 0.2 });
    const darkCrimsonMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.4, metalness: 0.25 });
    const blackMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    const whiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const fangMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });

    // Majestic Dragon Head (Origami Low-Poly Style from image_2.png)
    const head = new THREE.Group();

    // Central Snout & Diamond Facets (Mũi & Mặt Vàng Hoa Mai)
    const snoutCore = new THREE.Mesh(new THREE.ConeGeometry(0.85, 2.2, 4), brightGoldMat);
    snoutCore.rotation.y = Math.PI / 4;
    snoutCore.rotation.x = Math.PI / 2.2;
    snoutCore.position.set(0, 0, 0.6);
    head.add(snoutCore);

    // Cheek facets (2 má vàng hoa mai đa giác)
    [-0.55, 0.55].forEach(cx => {
      const cheek = new THREE.Mesh(new THREE.ConeGeometry(0.65, 1.6, 4), maiYellowMat);
      cheek.position.set(cx, 0.15, 0.4);
      cheek.rotation.z = cx > 0 ? -0.4 : 0.4;
      cheek.rotation.x = Math.PI / 2.3;
      head.add(cheek);
    });

    // Chin / Lower Jaw (Cằm dưới vàng viền đỏ)
    const chin = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.1, 4), darkGoldMat);
    chin.position.set(0, -0.65, 0.6);
    chin.rotation.x = Math.PI / 2.1;
    head.add(chin);

    // Black Nostril Diamonds (2 lỗ mũi hình thoi đen)
    [-0.22, 0.22].forEach(nx => {
      const nostril = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 4), blackMat);
      nostril.position.set(nx, 0.08, 1.45);
      nostril.rotation.x = Math.PI / 2;
      head.add(nostril);
    });

    // Intense Stylized Diamond Eyes (Đôi mắt hình thoi viền đỏ đồng tử đen)
    [-0.52, 0.52].forEach(ex => {
      const eyeSocket = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.6, 4), crimsonMat);
      eyeSocket.position.set(ex, 0.45, 0.65);
      eyeSocket.rotation.z = ex > 0 ? -0.5 : 0.5;
      eyeSocket.rotation.x = Math.PI / 2.2;

      const eyePupil = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.4, 4), blackMat);
      eyePupil.position.set(ex > 0 ? 0.05 : -0.05, 0.05, 0.12);
      eyeSocket.add(eyePupil);

      head.add(eyeSocket);
    });

    // Central Forehead Crest Spikes (Chỏm sừng trung tâm màu đỏ giữa trán)
    const centerHorn = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.4, 4), crimsonMat);
    centerHorn.position.set(0, 1.25, 0.1);
    centerHorn.rotation.x = -0.3;
    head.add(centerHorn);

    // Two Majestic Curved Crimson Horns (Đôi sừng rồng đỏ uốn lượn vút cao như ảnh 2)
    [-0.65, 0.65].forEach(hx => {
      const mainHorn = new THREE.Mesh(new THREE.ConeGeometry(0.26, 1.9, 5), crimsonMat);
      mainHorn.position.set(hx, 1.45, -0.15);
      mainHorn.rotation.x = -0.45;
      mainHorn.rotation.z = hx > 0 ? 0.45 : -0.45;

      // Horn tip sharp branch
      const tipBranch = new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.1, 4), darkCrimsonMat);
      tipBranch.position.set(hx > 0 ? 0.25 : -0.25, 0.75, 0.1);
      tipBranch.rotation.z = hx > 0 ? 0.65 : -0.65;
      mainHorn.add(tipBranch);

      head.add(mainHorn);
    });

    // Red Side Spikes & Flaring Mane (Các gai nhọn bờm đỏ xòe 2 bên má y hệt ảnh 2)
    [-1, 1].forEach(side => {
      [
        { y: 0.85, z: 0.1, len: 1.1, rotZ: 0.8 },
        { y: 0.45, z: 0.2, len: 1.3, rotZ: 1.2 },
        { y: 0.05, z: 0.3, len: 0.9, rotZ: 1.5 },
      ].forEach(sp => {
        const maneSpike = new THREE.Mesh(new THREE.ConeGeometry(0.2, sp.len, 4), crimsonMat);
        maneSpike.position.set(side * 0.9, sp.y, sp.z);
        maneSpike.rotation.z = side * -sp.rotZ;
        maneSpike.rotation.x = -0.2;
        head.add(maneSpike);
      });
    });

    // Long Flowing Red Whiskers (Đôi râu rồng đỏ dài uốn lượn mềm mại từ mép)
    [-0.55, 0.55].forEach(wx => {
      const whiskerBase = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.03, 1.6, 6), crimsonMat);
      whiskerBase.position.set(wx, -0.35, 1.05);
      whiskerBase.rotation.x = Math.PI / 2.3;
      whiskerBase.rotation.z = wx > 0 ? -0.55 : 0.55;

      const whiskerCurl = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.015, 1.2, 5), crimsonMat);
      whiskerCurl.position.set(wx > 0 ? 0.25 : -0.25, -0.7, 0.2);
      whiskerCurl.rotation.z = wx > 0 ? 0.7 : -0.7;
      whiskerBase.add(whiskerCurl);

      head.add(whiskerBase);
    });

    // Ivory Fangs (Răng nanh trắng ngà)
    [-0.38, 0.38].forEach(fx => {
      const fangUpper = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.45, 4), fangMat);
      fangUpper.position.set(fx, -0.4, 1.1);
      fangUpper.rotation.x = Math.PI;
      head.add(fangUpper);
    });

    this.dragonGroup.add(head);

    // Orbiting Glowing Dragon Pearl (Dạ Minh Châu hộ thân)
    const pearlGroup = new THREE.Group();
    const pearlMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x38bdf8,
      emissiveIntensity: 2.2,
      roughness: 0.1,
    });
    const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 16), pearlMat);
    const pearlLight = new THREE.PointLight(0x38bdf8, 3.8, 14);
    pearlGroup.add(pearl, pearlLight);
    this.dragonGroup.add(pearlGroup);

    // 14 Majestic Body Segments (Thân rồng vàng tươi hoa mai xen kẽ vây lưng đỏ)
    const bodySegments = [];
    for (let i = 0; i < 14; i++) {
      const segGroup = new THREE.Group();
      const radius = Math.max(0.42, 1.18 - i * 0.055);
      const segMesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 12, 12), i % 2 === 0 ? brightGoldMat : maiYellowMat);
      segGroup.add(segMesh);

      // Dorsal spine fin (Vây lưng đỏ rực)
      const spine = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.38, radius * 1.2, 4), crimsonMat);
      spine.position.set(0, radius * 0.95, 0);
      segGroup.add(spine);

      segGroup.position.set(0, 0, -(i + 1) * 1.35);
      this.dragonGroup.add(segGroup);
      bodySegments.push(segGroup);
    }

    // Dragon Tail Flukes (Đuôi rồng xòe quạt đỏ vàng lộng lẫy)
    const tailFluke = new THREE.Mesh(new THREE.ConeGeometry(0.95, 1.9, 4), crimsonMat);
    tailFluke.position.set(0, 0, -1.2);
    tailFluke.rotation.x = -Math.PI / 2;
    bodySegments[bodySegments.length - 1].add(tailFluke);

    this.dragon = {
      group: this.dragonGroup,
      head,
      pearlGroup,
      bodySegments,
      glowUntil: 0,
    };
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
  update(dt) {
    const now = performance.now();
    const me = this.getMe();

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

    // 5. Update Golden Dragon Aerial Undulation (Tet)
    if (this.dragon?.group) {
      const angle = now * 0.00045;
      const tx = (14.5 + Math.sin(angle) * 8.5) * TILE;
      const tz = (11.5 + Math.cos(angle * 2) * 5.5) * TILE;
      const ty = 8.8 + Math.sin(angle * 3) * 1.8;

      const curPos = this.dragon.group.position;
      curPos.x += (tx - curPos.x) * Math.min(1, dt * 2.5);
      curPos.y += (ty - curPos.y) * Math.min(1, dt * 2.5);
      curPos.z += (tz - curPos.z) * Math.min(1, dt * 2.5);

      const dx = tx - curPos.x;
      const dz = tz - curPos.z;
      if (dx * dx + dz * dz > 0.001) {
        this.dragon.group.rotation.y = Math.atan2(dx, dz);
      }

      // Animate Orbiting Dạ Minh Châu (Dragon Pearl) ahead of the mouth
      if (this.dragon.pearlGroup) {
        const pAngle = now * 0.003;
        this.dragon.pearlGroup.position.set(
          Math.sin(pAngle) * 0.8,
          Math.cos(pAngle * 1.5) * 0.4 + 0.2,
          2.6 + Math.cos(pAngle) * 0.5
        );
      }

      // Majestic wave undulation across 14 segments with dynamic banking
      for (let s = 0; s < this.dragon.bodySegments.length; s++) {
        const seg = this.dragon.bodySegments[s];
        seg.position.x = Math.sin(now * 0.004 + s * 0.45) * 0.85;
        seg.position.y = Math.cos(now * 0.0035 + s * 0.45) * 0.55;
        seg.rotation.z = Math.sin(now * 0.004 + s * 0.45) * 0.25;
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
