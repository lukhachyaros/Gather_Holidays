// ============================================================================
// MULTIPLAYER THEMED MINIGAMES FOR GATHER_HOLIDAYS (OPTIMIZED & EXPANDED)
// - Christmas & Valentine: Realtime PvP Combat with Aim Raycasting, HP, KOs & Safe Zones
// - Halloween: Creepy Vampire Boss Autonomous Hunting, Red Warning Circle & 3D Jumpscare
// - Tet: Festival Lion/Dragon Dance & Firecracker Tag (Pháo Thần Tài)
// ============================================================================

import * as THREE from 'three';
import { playSfx } from './audio.js';

const TILE = 2;

// Check if a point is within the TV Cinema & Seating Safe Zone
export function isInSafeZone(x, y) {
  return x >= 9.2 && x <= 19.8 && y >= 1.5 && y <= 8.2;
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
    this.projectiles = []; // active flying objects (snowballs, arrows, firecrackers)
    this.pickups = []; // ground coins, envelopes
    this.scores = new Map(); // id -> { name, score, title }
    this.lastActionTime = 0;

    // PvP Health State for Local Player
    this.hp = 100;
    this.maxHp = 100;
    this.isDead = false;

    // Vampire Hunt State (Halloween)
    this.vampireHunt = null; // { targetId, targetName, x, z, startTime, circleMesh }
    this.nextVampireCheck = performance.now() + 12000;
    this.isBeingJumpscared = false;

    // Tet Festive Lion State
    this.tetLion = null;

    // Shared raycaster for 3D cursor aiming
    this.raycaster = new THREE.Raycaster();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
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
      sphere: new THREE.SphereGeometry(0.2, 10, 10),
      arrowShaft: new THREE.CylinderGeometry(0.025, 0.025, 0.75, 6),
      heartHead: new THREE.ConeGeometry(0.14, 0.24, 6),
      firecracker: new THREE.CylinderGeometry(0.08, 0.08, 0.32, 6),
      coin: new THREE.CylinderGeometry(0.18, 0.18, 0.04, 8),
      circleRing: new THREE.RingGeometry(1.9, 2.2, 24),
    };
    this.geos.arrowShaft.rotateX(Math.PI / 2);
    this.geos.heartHead.rotateX(Math.PI / 2);
    this.geos.circleRing.rotateX(-Math.PI / 2);

    this.mats = {
      snow: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }),
      gold: new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.6, roughness: 0.3 }),
      pink: new THREE.MeshStandardMaterial({ color: 0xff4d88, emissive: 0xff1493, emissiveIntensity: 0.3 }),
      redFirecracker: new THREE.MeshStandardMaterial({ color: 0xd62828, roughness: 0.4 }),
      redRing: new THREE.MeshBasicMaterial({ color: 0xff0033, side: THREE.DoubleSide, transparent: true, opacity: 0.75 }),
      shieldAura: new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.35, wireframe: true }),
    };

    // Projectile Object Pool to eliminate GC lag
    this.projectilePool = [];
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

    // Halloween specific: schedule vampire hunt
    if (this.theme === 'halloween') {
      this.nextVampireCheck = performance.now() + 10000;
    }
  }

  clearAll() {
    for (const p of this.projectiles) {
      if (p.mesh) this.group.remove(p.mesh);
    }
    for (const item of this.pickups) {
      if (item.mesh) this.group.remove(item.mesh);
    }
    if (this.vampireHunt?.circleMesh) {
      this.group.remove(this.vampireHunt.circleMesh);
    }
    if (this.tetLion?.mesh) {
      this.group.remove(this.tetLion.mesh);
    }
    this.projectiles = [];
    this.pickups = [];
    this.vampireHunt = null;
    this.tetLion = null;
    this.scores.clear();

    const scareOverlay = document.getElementById('jumpscareOverlay');
    if (scareOverlay) scareOverlay.classList.add('hidden');
    this.isBeingJumpscared = false;
  }

  updateHUDButton() {
    const btn = document.getElementById('btnMinigame');
    if (!btn) return;

    switch (this.theme) {
      case 'christmas':
        btn.textContent = '❄️ Ném Tuyết PvP [G]';
        btn.title = 'Minigame Giáng Sinh: Đại Chiến Bắn Tuyết PvP Hạ Gục Đối Thủ (Phím G)';
        break;
      case 'halloween':
        btn.textContent = '🧛 Boss Vampire (Tự Động)';
        btn.title = 'Halloween: Boss Vampire bay rình mồi & vồ Jumpscare (Trú ẩn trong Vùng Ghế TV)';
        break;
      case 'tet':
        btn.textContent = '🧨 Pháo Múa Lân [G]';
        btn.title = 'Minigame Tết: Ném Pháo Thần Tài & Múa Lân Rước Lộc (Phím G)';
        break;
      case 'valentine':
        btn.textContent = '💘 Cung Cupid PvP [G]';
        btn.title = 'Minigame Valentine: Đấu Cung Cupid & Đo Nhân Duyên (Phím G)';
        break;
      default:
        btn.textContent = '🎮 Minigame [G]';
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
    hpFill.style.background = pct > 50 ? 'linear-gradient(90deg,#22c55e,#4ade80)' : pct > 25 ? 'linear-gradient(90deg,#eab308,#fde047)' : 'linear-gradient(90deg,#dc2626,#f87171)';
  }

  // --------------------------------------------------------------------------
  // ACCURATE 3D RAYCAST AIMING
  // Projects line of sight from camera crosshair into 3D world
  // --------------------------------------------------------------------------
  getAimTarget() {
    const me = this.getMe();
    if (!me) return { x: 0, y: 1, z: 0 };

    const ndc = document.pointerLockElement ? new THREE.Vector2(0, 0) : this.mouseNdc;
    this.raycaster.setFromCamera(ndc, this.camera);
    const hitPoint = new THREE.Vector3();

    // Intersect horizontal character plane or ground
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(me.h + 0.6));
    if (this.raycaster.ray.intersectPlane(plane, hitPoint)) {
      // Check reasonable distance
      const dist = hitPoint.distanceTo(this.camera.position);
      if (dist > 1.5 && dist < 45) {
        return hitPoint;
      }
    }

    // Fallback: 20 meters along camera forward vector
    this.raycaster.ray.at(22, hitPoint);
    return hitPoint;
  }

  // --------------------------------------------------------------------------
  // USER TRIGGER ACTION (CLICK HUD BUTTON OR PRESS PHÍM 'G')
  // --------------------------------------------------------------------------
  triggerAction() {
    if (this.isDead || this.isBeingJumpscared) return;

    const now = performance.now();
    if (now - this.lastActionTime < 500) return;
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

  // --------------------------------------------------------------------------
  // 1. CHRISTMAS: PVP SNOWBALL BLASTER
  // --------------------------------------------------------------------------
  actionPvPSnowball() {
    const me = this.getMe();
    const aim = this.getAimTarget();

    me.av?.playEmote('interact');
    playSfx('snow_throw', 'christmas');

    const sx = me.x * TILE;
    const sy = me.h + 1.35;
    const sz = me.y * TILE;

    this.emitOp({
      k: 'mg_snowball_throw',
      fromId: me.name,
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
  // 2. VALENTINE: PVP CUPID ARROW DUEL
  // --------------------------------------------------------------------------
  actionPvPCupid() {
    const me = this.getMe();
    const aim = this.getAimTarget();

    me.av?.playEmote('interact');
    playSfx('cupid_arrow_shoot', 'valentine');

    const sx = me.x * TILE;
    const sy = me.h + 1.35;
    const sz = me.y * TILE;

    this.emitOp({
      k: 'mg_cupid_shoot',
      fromId: me.name,
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
  // 3. TET: FESTIVAL LION & FIRECRACKER CANNON
  // --------------------------------------------------------------------------
  actionTetFirecracker() {
    const me = this.getMe();
    const aim = this.getAimTarget();

    me.av?.playEmote('interact');
    playSfx('firecracker', 'tet');

    const sx = me.x * TILE;
    const sy = me.h + 1.35;
    const sz = me.y * TILE;

    this.emitOp({
      k: 'mg_tet_cannon',
      fromName: me.name,
      sx,
      sy,
      sz,
      tx: aim.x,
      ty: Math.max(0.2, aim.y),
      tz: aim.z,
    });
  }

  // --------------------------------------------------------------------------
  // SPAWN PROJECTILES
  // --------------------------------------------------------------------------
  spawnProjectile(data, type) {
    let mesh;
    if (type === 'snowball') {
      mesh = new THREE.Mesh(this.geos.sphere, this.mats.snow);
    } else if (type === 'cupid') {
      mesh = new THREE.Group();
      const shaft = new THREE.Mesh(this.geos.arrowShaft, this.mats.gold);
      const head = new THREE.Mesh(this.geos.heartHead, this.mats.pink);
      head.position.z = -0.38;
      mesh.add(shaft, head);
      mesh.lookAt(data.tx, data.ty, data.tz);
    } else if (type === 'firecracker') {
      mesh = new THREE.Mesh(this.geos.firecracker, this.mats.redFirecracker);
      mesh.rotation.x = Math.PI / 4;
    }

    mesh.position.set(data.sx, data.sy, data.sz);
    this.group.add(mesh);

    const dx = data.tx - data.sx;
    const dy = data.ty - data.sy;
    const dz = data.tz - data.sz;
    const dist = Math.hypot(dx, dy, dz);
    const speed = type === 'firecracker' ? 14 : 20;
    const duration = Math.max(0.2, dist / speed);

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
      apexH: type === 'snowball' || type === 'firecracker' ? Math.max(0.6, dist * 0.16) : 0,
    });
  }

  // --------------------------------------------------------------------------
  // HIT & DAMAGE RESOLUTION (SAFE ZONE SHIELDING & PVP KOS)
  // --------------------------------------------------------------------------
  checkProjectileImpact(proj) {
    const { data, type } = proj;
    const me = this.getMe();
    if (!me) return;

    // Check hit against local player
    const myX = me.x * TILE;
    const myY = me.h + 0.9;
    const myZ = me.y * TILE;

    const hitDist = Math.hypot(proj.mesh.position.x - myX, proj.mesh.position.z - myZ);
    const hitHeight = Math.abs(proj.mesh.position.y - myY);

    if (data.fromName !== me.name && hitDist < 0.95 && hitHeight < 1.4) {
      // Local player was hit!
      const inSafe = isInSafeZone(me.x, me.y) || !!me.seatSlot;

      if (inSafe) {
        // Safe Zone Shielded!
        playSfx('xmas_bell', this.theme);
        this.toast('🛡️ BỤP! VÙNG AN TOÀN ĐÃ CHẶN ĐẠN! Miễn toàn bộ sát thương!');
        if (this.floaters) this.floaters.push({ e: '🛡️ Miễn Sát Thương', who: 'me', t: Date.now() });
        return;
      }

      // Outside Safe Zone: TAKE PVP DAMAGE!
      const dmg = 34;
      this.hp = Math.max(0, this.hp - dmg);
      this.updateHpUI();

      if (type === 'snowball') {
        playSfx('snow_hit', 'christmas');
        me.av?.playEmote('stumble');
        if (this.floaters) this.floaters.push({ e: `❄️ -${dmg} HP`, who: 'me', t: Date.now() });
      } else if (type === 'cupid') {
        playSfx('cupid_arrow_hit', 'valentine');
        playSfx('valentine_harp', 'valentine');
        me.av?.playEmote('stumble');
        if (this.floaters) this.floaters.push({ e: `💘 -${dmg} HP`, who: 'me', t: Date.now() });
      }

      if (this.hp <= 0 && !this.isDead) {
        // KNOCKED OUT!
        this.isDead = true;
        this.toast(`💥 BẠN ĐÃ BỊ HẠ GỤC BỞI ${data.fromName}! Đang hồi sinh sau 3s…`);
        me.av?.playEmote('stumble');

        // Notify room of KO
        this.emitOp({
          k: 'mg_pvp_ko',
          killer: data.fromName,
          victim: me.name,
        });

        // Respawn after 3 seconds at safe map center
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

    // Festive firecracker explosion (Tet)
    if (type === 'firecracker') {
      playSfx('firework_rocket', 'tet');
      this.spawnTetFestiveCoins(proj.mesh.position.x, proj.mesh.position.z, data.fromName);
    }
  }

  // --------------------------------------------------------------------------
  // TET FESTIVAL LION & GOLD COINS RAIN
  // --------------------------------------------------------------------------
  spawnTetFestiveCoins(worldX, worldZ, byName) {
    const me = this.getMe();
    this.toast(`🧧 Pháo nổ tưng bừng! Thỏi Vàng May Mắn của ${byName} rơi quanh sân!`);

    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + Math.random() * 0.3;
      const d = 1.0 + Math.random() * 3.5;
      const coinMesh = new THREE.Mesh(this.geos.coin, this.mats.gold);
      coinMesh.rotation.x = Math.PI / 2;

      const cx = worldX + Math.cos(angle) * d;
      const cz = worldZ + Math.sin(angle) * d;
      coinMesh.position.set(cx, 0.22, cz);
      this.group.add(coinMesh);

      this.pickups.push({
        id: `coin_${Date.now()}_${i}`,
        type: 'tet_coin',
        val: 188,
        x: cx / TILE,
        y: cz / TILE,
        mesh: coinMesh,
        baseY: 0.22,
        rotSpeed: 3.0,
      });
    }

    this.updateScoreboardUI('🧧 BẢNG TÀI LỘC NĂM MỚI', 'Xu Vàng May Mắn');
  }

  // --------------------------------------------------------------------------
  // HALLOWEEN: VAMPIRE AUTONOMOUS HUNTING & JUMPSCARE SWOOP
  // --------------------------------------------------------------------------
  updateVampireAI(now, dt) {
    if (this.theme !== 'halloween') return;

    const me = this.getMe();
    if (!me) return;

    // Check if ready to initiate a hunting attack
    if (!this.vampireHunt && now > this.nextVampireCheck) {
      this.nextVampireCheck = now + 18000 + Math.random() * 7000;

      // Only target player if they are OUTSIDE the Safe Zone!
      const inSafe = isInSafeZone(me.x, me.y) || !!me.seatSlot;
      if (!inSafe) {
        // Start hunting local player!
        const circleMesh = new THREE.Mesh(this.geos.circleRing, this.mats.redRing);
        circleMesh.position.set(me.x * TILE, 0.08, me.y * TILE);
        this.group.add(circleMesh);

        playSfx('ghost_boo', 'halloween');
        this.toast('⚠️ NGUY HIỂM! BÁ TƯỚC MA CÀ RỒNG ĐANG VỒ BẠN! CHẠY NGAY HOẶC VÀO VÙNG GHẾ TV! ⚠️');

        this.vampireHunt = {
          targetName: me.name,
          targetTileX: me.x,
          targetTileY: me.y,
          worldX: me.x * TILE,
          worldZ: me.y * TILE,
          startTime: now,
          warnDuration: 3200, // 3.2 seconds warning
          circleMesh,
        };
      }
    }

    // Active Hunt Warning & Swoop
    if (this.vampireHunt) {
      const vh = this.vampireHunt;
      const elapsed = now - vh.startTime;

      // Pulsate red danger circle
      if (vh.circleMesh) {
        const pulse = 1.0 + Math.sin(now * 0.012) * 0.15;
        vh.circleMesh.scale.set(pulse, pulse, pulse);
      }

      if (elapsed >= vh.warnDuration) {
        // THE SWOOP STRIKE!
        if (vh.circleMesh) this.group.remove(vh.circleMesh);

        const currentDist = Math.hypot(me.x * TILE - vh.worldX, me.y * TILE - vh.worldZ);
        const inSafe = isInSafeZone(me.x, me.y) || !!me.seatSlot;

        if (currentDist < 2.4 && !inSafe) {
          // CAUGHT BY VAMPIRE -> JUMPSCARE!
          this.executeVampireJumpscare();
        } else {
          // ESCAPED!
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

    // Lift player up into dark sky (5.5m)
    me.h = 5.2;
    me.vy = 0;
    me.av?.playEmote('scared');

    // Fullscreen Jumpscare Overlay
    const scareOverlay = document.getElementById('jumpscareOverlay');
    if (scareOverlay) scareOverlay.classList.remove('hidden');

    setTimeout(() => {
      if (scareOverlay) scareOverlay.classList.add('hidden');
      this.isBeingJumpscared = false;

      // Drop player safely to ground clamped inside map bounds
      me.h = 0;
      me.vy = 0;
      me.x = Math.max(2.0, Math.min(26.0, me.x));
      me.y = Math.max(2.0, Math.min(26.0, me.y));
      this.toast('😱 Bạn vừa được thả xuống đất an toàn sau cơn ác mộng!');
    }, 1900);
  }

  // --------------------------------------------------------------------------
  // FRAME UPDATE LOOP
  // --------------------------------------------------------------------------
  update(dt) {
    const now = performance.now();
    const me = this.getMe();

    // 1. Safe Zone Detection
    if (me) {
      const inSafe = isInSafeZone(me.x, me.y) || !!me.seatSlot;
      const badge = document.getElementById('safeZoneBadge');
      if (badge) badge.classList.toggle('hidden', !inSafe);
    }

    // 2. Halloween Vampire AI
    this.updateVampireAI(now, dt);

    // 3. Update Flying Projectiles
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
      const curZ = p.startZ + (p.targetZ - p.startZ) * t;
      const arcY = Math.sin(t * Math.PI) * p.apexH;
      const curY = p.startY + (p.targetY - p.startY) * t + arcY;

      if (p.mesh) {
        p.mesh.position.set(curX, curY, curZ);
        if (p.type === 'snowball') {
          p.mesh.rotation.x += dt * 8;
        } else if (p.type === 'cupid') {
          p.mesh.lookAt(p.targetX, p.targetY, p.targetZ);
        } else if (p.type === 'firecracker') {
          p.mesh.rotation.x += dt * 10;
          p.mesh.rotation.z += dt * 10;
        }
      }

      // Check early hit against local player
      if (me && p.data.fromName !== me.name) {
        const hitDist = Math.hypot(curX - me.x * TILE, curZ - me.y * TILE);
        if (hitDist < 0.75 && Math.abs(curY - (me.h + 0.9)) < 0.95) {
          if (p.mesh) this.group.remove(p.mesh);
          this.checkProjectileImpact(p);
          this.projectiles.splice(i, 1);
        }
      }
    }

    // 4. Update Ground Coins / Items
    const nowSec = now / 1000;
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const item = this.pickups[i];
      if (item.mesh) {
        item.mesh.rotation.y += dt * item.rotSpeed;
        item.mesh.position.y = item.baseY + Math.sin(nowSec * 3 + item.x) * 0.05;
      }

      if (me) {
        const d = Math.hypot(item.x - me.x, item.y - me.y);
        if (d < 0.65) {
          if (item.mesh) this.group.remove(item.mesh);
          this.pickups.splice(i, 1);

          playSfx('tet_lixi', 'tet');
          if (this.floaters) this.floaters.push({ e: `🪙 +${item.val} Xu`, who: 'me', t: Date.now() });
          this.toast(`🧧 +${item.val} Xu Vàng May Mắn! Phát Tài Phát Lộc! ✨`);

          const s = this.scores.get(me.name) || { name: me.name, score: 0 };
          s.score += item.val;
          this.scores.set(me.name, s);
          this.updateScoreboardUI('🧧 BẢNG TÀI LỘC NĂM MỚI', 'Xu Vàng May Mắn');
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
