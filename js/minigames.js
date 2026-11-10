// ============================================================================
// MULTIPLAYER THEMED MINIGAMES FOR GATHER_HOLIDAYS
// - Christmas: Snowball Battle (Đại Chiến Ném Tuyết)
// - Halloween: Spooky Candy Rush (Thu Thập Kẹo Bí Ngô)
// - Tet: Lucky Money Rain (Cơn Mưa Bao Lì Xì)
// - Valentine: Cupid's Arrow & Love Matcher (Mũi Tên Thần Tình Yêu)
// ============================================================================

import * as THREE from 'three';
import { playSfx } from './audio.js';

const TILE = 2;

export class MinigameManager {
  constructor(scene, getMe, getPeers, emitOp, toast, floaters) {
    this.scene = scene;
    this.getMe = getMe;
    this.getPeers = getPeers;
    this.emitOp = emitOp;
    this.toast = toast;
    this.floaters = floaters;

    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.theme = 'christmas';
    this.projectiles = []; // active flying objects (snowballs, arrows)
    this.pickups = []; // ground items (candies, lucky money envelopes)
    this.scores = new Map(); // id -> { name, score, extra }
    this.lastActionTime = 0;

    // Materials cache
    this.materials = {
      snow: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }),
      gold: new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.6, roughness: 0.3 }),
      red: new THREE.MeshStandardMaterial({ color: 0xd62828, roughness: 0.4 }),
      pink: new THREE.MeshStandardMaterial({ color: 0xff4d88, roughness: 0.3, emissive: 0xff1493, emissiveIntensity: 0.2 }),
      orange: new THREE.MeshStandardMaterial({ color: 0xff7b00, roughness: 0.5 }),
      purple: new THREE.MeshStandardMaterial({ color: 0x8a2be2, roughness: 0.5 }),
    };

    this.initUI();
  }

  setTheme(themeKey) {
    if (this.theme === themeKey) return;
    this.theme = themeKey;
    this.clearAll();
    this.updateHUDButton();
    this.updateScoreboardUI();
  }

  clearAll() {
    // Remove all 3D meshes from scene
    for (const p of this.projectiles) {
      if (p.mesh) this.group.remove(p.mesh);
    }
    for (const item of this.pickups) {
      if (item.mesh) this.group.remove(item.mesh);
    }
    this.projectiles = [];
    this.pickups = [];
    this.scores.clear();
  }

  initUI() {
    this.updateHUDButton();
  }

  updateHUDButton() {
    const btn = document.getElementById('btnMinigame');
    if (!btn) return;

    switch (this.theme) {
      case 'christmas':
        btn.textContent = '❄️ Ném Tuyết [G]';
        btn.title = 'Minigame Giáng Sinh: Đại Chiến Ném Tuyết Đồng Đội (Phím G)';
        break;
      case 'halloween':
        btn.textContent = '🎃 Săn Kẹo [G]';
        btn.title = 'Minigame Halloween: Thả & Thu Thập Kẹo Ma Quái (Phím G)';
        break;
      case 'tet':
        btn.textContent = '🧧 Mưa Lì Xì [G]';
        btn.title = 'Minigame Tết: Cơn Mưa Bao Lì Xì Lộc Đầu Năm (Phím G)';
        break;
      case 'valentine':
        btn.textContent = '💘 Cung Cupid [G]';
        btn.title = 'Minigame Valentine: Bắn Mũi Tên Thần Cupid & Đo Độ Hợp Nhau (Phím G)';
        break;
      default:
        btn.textContent = '🎮 Minigame [G]';
        break;
    }
  }

  // Find nearest peer to target
  findNearestPeer(maxDist = 18) {
    const me = this.getMe();
    const peers = this.getPeers();
    if (!me || !peers || peers.size === 0) return null;

    let nearest = null;
    let minDist = maxDist;
    for (const [id, p] of peers) {
      const d = Math.hypot(p.x - me.x, p.y - me.y);
      if (d < minDist) {
        minDist = d;
        nearest = { id, ...p, dist: d };
      }
    }
    return nearest;
  }

  // --------------------------------------------------------------------------
  // USER TRIGGER ACTION (CLICK HUD BUTTON OR PRESS PHÍM 'G')
  // --------------------------------------------------------------------------
  triggerAction() {
    const now = performance.now();
    if (now - this.lastActionTime < 650) {
      this.toast('⏳ Thao tác quá nhanh, hãy chờ một chút nhé!');
      return;
    }
    this.lastActionTime = now;

    const me = this.getMe();
    if (!me) return;

    switch (this.theme) {
      case 'christmas':
        this.actionSnowball();
        break;
      case 'halloween':
        this.actionHalloweenCandy();
        break;
      case 'tet':
        this.actionTetLixiRain();
        break;
      case 'valentine':
        this.actionCupidArrow();
        break;
    }
  }

  // --------------------------------------------------------------------------
  // 1. CHRISTMAS: SNOWBALL BATTLE
  // --------------------------------------------------------------------------
  actionSnowball() {
    const me = this.getMe();
    const targetPeer = this.findNearestPeer(24);

    let targetX, targetY, targetZ, targetId, targetName;
    if (targetPeer) {
      targetId = targetPeer.id;
      targetName = targetPeer.name;
      targetX = targetPeer.x * TILE;
      targetY = (targetPeer.h || 0) + 1.2;
      targetZ = targetPeer.y * TILE;
    } else {
      // Throw straight ahead if alone
      targetId = null;
      targetName = null;
      const dist = 9;
      targetX = me.x * TILE - Math.sin(me.r) * dist;
      targetY = me.h + 0.4;
      targetZ = me.y * TILE - Math.cos(me.r) * dist;
    }

    me.av?.playEmote('interact');
    playSfx('snow_throw', 'christmas');

    this.emitOp({
      k: 'mg_snowball_throw',
      fromId: me.name,
      fromName: me.name,
      toId: targetId,
      toName: targetName,
      sx: me.x * TILE,
      sy: me.h + 1.4,
      sz: me.y * TILE,
      tx: targetX,
      ty: targetY,
      tz: targetZ,
    });
  }

  spawnSnowballProjectile(data) {
    const geo = new THREE.SphereGeometry(0.18, 12, 12);
    const mesh = new THREE.Mesh(geo, this.materials.snow);
    mesh.position.set(data.sx, data.sy, data.sz);
    this.group.add(mesh);

    const dx = data.tx - data.sx;
    const dy = data.ty - data.sy;
    const dz = data.tz - data.sz;
    const dist = Math.hypot(dx, dz);
    const speed = 14;
    const duration = Math.max(0.3, dist / speed);

    this.projectiles.push({
      type: 'snowball',
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
      apexH: Math.max(1.5, dist * 0.28),
    });
  }

  handleSnowballImpact(proj) {
    const { data } = proj;
    playSfx('snow_hit', 'christmas');

    // Floater
    if (this.floaters) {
      const me = this.getMe();
      if (data.toName && (data.toId === me?.name || data.toName === me?.name)) {
        this.floaters.push({ e: '❄️ Bụp!', who: 'me', t: Date.now() });
        this.toast(`❄️ Bạn vừa bị trúng bóng tuyết từ ${data.fromName}! Brrr lạnh quá! 🥶`);
        me.av?.playEmote('stumble');
      }
    }

    // Add score
    const s = this.scores.get(data.fromName) || { name: data.fromName, score: 0 };
    s.score += 1;
    this.scores.set(data.fromName, s);
    this.updateScoreboardUI('❄️ ĐẠI CHIẾN NÉM TUYẾT', 'Bóng trúng đích');
  }

  // --------------------------------------------------------------------------
  // 2. HALLOWEEN: SPOOKY CANDY RUSH
  // --------------------------------------------------------------------------
  actionHalloweenCandy() {
    const me = this.getMe();
    me.av?.playEmote('interact');
    playSfx('spooky_laugh', 'halloween');

    // Spawn 10 candies around me/center
    const candies = [];
    const count = 10;
    const baseCX = 14.5;
    const baseCY = 14.5;

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      const dist = 2.5 + Math.random() * 6.5;
      const x = Math.max(6, Math.min(23, baseCX + Math.cos(angle) * dist));
      const y = Math.max(7, Math.min(22, baseCY + Math.sin(angle) * dist));
      const kind = Math.random() < 0.35 ? 'pumpkin' : Math.random() < 0.65 ? 'candy' : 'lollipop';
      candies.push({ id: `candy_${Date.now()}_${i}`, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, kind });
    }

    this.toast('🎃 Kẹo Halloween đã xuất hiện quanh quảng trường! Hãy chạy lại nhặt kẹo nào!');
    this.emitOp({ k: 'mg_candy_spawn', candies, byName: me.name });
  }

  spawnCandies(candies) {
    for (const c of candies) {
      if (this.pickups.some(p => p.id === c.id)) continue;

      const group = new THREE.Group();
      if (c.kind === 'pumpkin') {
        const pGeo = new THREE.SphereGeometry(0.24, 10, 10);
        pGeo.scale(1, 0.75, 1);
        const pMesh = new THREE.Mesh(pGeo, this.materials.orange);
        const stemGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.12, 6);
        const stemMesh = new THREE.Mesh(stemGeo, new THREE.MeshStandardMaterial({ color: 0x2e7d32 }));
        stemMesh.position.y = 0.22;
        group.add(pMesh, stemMesh);
      } else {
        const cGeo = new THREE.BoxGeometry(0.3, 0.18, 0.18);
        const cMesh = new THREE.Mesh(cGeo, Math.random() < 0.5 ? this.materials.purple : this.materials.pink);
        group.add(cMesh);
      }

      group.position.set(c.x * TILE, 0.35, c.y * TILE);
      this.group.add(group);

      this.pickups.push({
        id: c.id,
        type: 'candy',
        x: c.x,
        y: c.y,
        mesh: group,
        baseY: 0.35,
        rotSpeed: 1.5 + Math.random() * 1.5,
      });
    }
    this.updateScoreboardUI('🍬 SĂN KẸO HALLOWEEN', 'Kẹo đã nhặt');
  }

  // --------------------------------------------------------------------------
  // 3. TET: LUCKY MONEY RAIN (CƠN MƯA BAO LÌ XÌ)
  // --------------------------------------------------------------------------
  actionTetLixiRain() {
    const me = this.getMe();
    me.av?.playEmote('interact');
    playSfx('firework_rocket', 'tet');
    playSfx('firecracker', 'tet');

    const envelopes = [];
    const count = 12;
    const baseCX = 14.5;
    const baseCY = 14.5;

    const wishes = [
      'Vạn Sự Như Ý',
      'Tấn Tài Tấn Lộc',
      'Phát Tài Phát Lộc',
      'An Khang Thịnh Vượng',
      'Cung Hỷ Phát Tài',
      'Sức Khỏe Dồi Dào',
      'Mã Đáo Thành Công',
    ];
    const amounts = [68, 88, 168, 288, 388, 688, 888, 999];

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.3;
      const dist = 2.0 + Math.random() * 7.0;
      const x = Math.max(6, Math.min(23, baseCX + Math.cos(angle) * dist));
      const y = Math.max(7, Math.min(22, baseCY + Math.sin(angle) * dist));
      const val = amounts[Math.floor(Math.random() * amounts.length)];
      const wish = wishes[Math.floor(Math.random() * wishes.length)];
      envelopes.push({
        id: `lixi_${Date.now()}_${i}`,
        x: Math.round(x * 10) / 10,
        y: Math.round(y * 10) / 10,
        val,
        wish,
      });
    }

    this.toast(`🧧 Pháo hoa nổ vang trời! Cơn Mưa Bao Lì Xì của ${me.name} đã rơi xuống sân! Mau nhặt nào! 🧨`);
    this.emitOp({ k: 'mg_tet_rain', envelopes, byName: me.name });
  }

  spawnEnvelopes(envelopes) {
    for (const env of envelopes) {
      if (this.pickups.some(p => p.id === env.id)) continue;

      const group = new THREE.Group();
      // Red envelope body
      const bodyGeo = new THREE.BoxGeometry(0.32, 0.44, 0.04);
      const bodyMesh = new THREE.Mesh(bodyGeo, this.materials.red);
      // Gold seal
      const sealGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.05, 8);
      sealGeo.rotateX(Math.PI / 2);
      const sealMesh = new THREE.Mesh(sealGeo, this.materials.gold);
      sealMesh.position.z = 0.02;
      group.add(bodyMesh, sealMesh);

      group.position.set(env.x * TILE, 0.25, env.y * TILE);
      group.rotation.x = -Math.PI / 2 + 0.1;
      group.rotation.z = Math.random() * Math.PI;
      this.group.add(group);

      this.pickups.push({
        id: env.id,
        type: 'lixi',
        x: env.x,
        y: env.y,
        val: env.val,
        wish: env.wish,
        mesh: group,
        baseY: 0.25,
        rotSpeed: 0.8,
      });
    }
    this.updateScoreboardUI('🧧 LỘC ĐẦU NĂM', 'Xu Vàng May Mắn');
  }

  // --------------------------------------------------------------------------
  // 4. VALENTINE: CUPID'S ARROW & LOVE MATCHER
  // --------------------------------------------------------------------------
  actionCupidArrow() {
    const me = this.getMe();
    const targetPeer = this.findNearestPeer(26);

    let targetX, targetY, targetZ, targetId, targetName;
    if (targetPeer) {
      targetId = targetPeer.id;
      targetName = targetPeer.name;
      targetX = targetPeer.x * TILE;
      targetY = (targetPeer.h || 0) + 1.25;
      targetZ = targetPeer.y * TILE;
    } else {
      targetId = null;
      targetName = null;
      const dist = 10;
      targetX = me.x * TILE - Math.sin(me.r) * dist;
      targetY = me.h + 0.8;
      targetZ = me.y * TILE - Math.cos(me.r) * dist;
    }

    me.av?.playEmote('interact');
    playSfx('cupid_arrow_shoot', 'valentine');

    const loveScore = Math.floor(88 + Math.random() * 13); // 88% - 100%
    const titles = [
      'Duyên Trời Tác Hợp 💕',
      'Tâm Đầu Ý Hợp 💖',
      'Cặp Đôi Hoàn Hảo 🦢',
      'Tình Nồng Như Rượu 🍷',
      'Định Mệnh Gắn Kết 💍',
    ];
    const title = titles[Math.floor(Math.random() * titles.length)];

    this.emitOp({
      k: 'mg_cupid_shoot',
      fromName: me.name,
      toId: targetId,
      toName: targetName,
      loveScore,
      title,
      sx: me.x * TILE,
      sy: me.h + 1.3,
      sz: me.y * TILE,
      tx: targetX,
      ty: targetY,
      tz: targetZ,
    });
  }

  spawnCupidArrowProjectile(data) {
    const group = new THREE.Group();

    // Shaft
    const shaftGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.7, 8);
    shaftGeo.rotateX(Math.PI / 2);
    const shaftMesh = new THREE.Mesh(shaftGeo, this.materials.gold);

    // Glowing Heart Head
    const heartGeo = new THREE.ConeGeometry(0.12, 0.22, 8);
    heartGeo.rotateX(Math.PI / 2);
    const heartMesh = new THREE.Mesh(heartGeo, this.materials.pink);
    heartMesh.position.z = -0.38;

    group.add(shaftMesh, heartMesh);
    group.position.set(data.sx, data.sy, data.sz);
    this.group.add(group);

    const dx = data.tx - data.sx;
    const dy = data.ty - data.sy;
    const dz = data.tz - data.sz;
    const dist = Math.hypot(dx, dz);
    const speed = 16;
    const duration = Math.max(0.25, dist / speed);

    group.lookAt(data.tx, data.ty, data.tz);

    this.projectiles.push({
      type: 'cupid',
      mesh: group,
      data,
      startX: data.sx,
      startY: data.sy,
      startZ: data.sz,
      targetX: data.tx,
      targetY: data.ty,
      targetZ: data.tz,
      progress: 0,
      duration,
      apexH: Math.max(0.6, dist * 0.12),
    });
  }

  handleCupidImpact(proj) {
    const { data } = proj;
    playSfx('valentine_harp', 'valentine');
    playSfx('cupid_arrow_hit', 'valentine');

    const me = this.getMe();
    if (data.toName) {
      this.toast(`💘 Mũi tên Cupid đã kết nối ${data.fromName} & ${data.toName}! Độ hòa hợp: ${data.loveScore}% (${data.title})`);
      if (this.floaters) {
        this.floaters.push({ e: '💖', who: 'me', t: Date.now() });
        this.floaters.push({ e: '💕', who: 'me', t: Date.now() + 200 });
      }
    } else {
      this.toast(`💘 Mũi tên Thần Tình Yêu đã ghim xuống đất, gieo rắc ngàn bông hồng tình yêu! 🌹`);
    }

    // Score
    const key = `${data.fromName} & ${data.toName || 'Ẩn danh'}`;
    this.scores.set(key, { name: key, score: data.loveScore, title: data.title });
    this.updateScoreboardUI('💘 ĐỘ HÒA HỢP TÌNH YÊU', 'Điểm Duyên Phận (%)');
  }

  // --------------------------------------------------------------------------
  // FRAME UPDATE LOOP
  // --------------------------------------------------------------------------
  update(dt) {
    const me = this.getMe();

    // 1. Update Projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.progress += dt / p.duration;

      if (p.progress >= 1.0) {
        if (p.mesh) this.group.remove(p.mesh);
        this.projectiles.splice(i, 1);
        if (p.type === 'snowball') this.handleSnowballImpact(p);
        else if (p.type === 'cupid') this.handleCupidImpact(p);
        continue;
      }

      // Parabolic flight interpolation
      const t = p.progress;
      const curX = p.startX + (p.targetX - p.startX) * t;
      const curZ = p.startZ + (p.targetZ - p.startZ) * t;
      const arcY = Math.sin(t * Math.PI) * p.apexH;
      const curY = p.startY + (p.targetY - p.startY) * t + arcY;

      if (p.mesh) {
        p.mesh.position.set(curX, curY, curZ);
        if (p.type === 'snowball') {
          p.mesh.rotation.x += dt * 6;
          p.mesh.rotation.y += dt * 8;
        } else if (p.type === 'cupid') {
          p.mesh.lookAt(p.targetX, p.targetY, p.targetZ);
        }
      }
    }

    // 2. Update Ground Pickups (Candies, Lucky Money Envelopes)
    const now = performance.now() / 1000;
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const item = this.pickups[i];
      if (item.mesh) {
        item.mesh.rotation.y += dt * item.rotSpeed;
        item.mesh.position.y = item.baseY + Math.sin(now * 3 + item.x) * 0.08;
      }

      // Check collision with Local Player
      if (me) {
        const d = Math.hypot(item.x - me.x, item.y - me.y);
        if (d < 0.65) {
          // Player collected item!
          if (item.mesh) this.group.remove(item.mesh);
          this.pickups.splice(i, 1);

          if (item.type === 'candy') {
            playSfx('candy_crunch', 'halloween');
            if (this.floaters) this.floaters.push({ e: '🍬', who: 'me', t: Date.now() });
            this.toast('🍬 Bụp! Bạn đã nhặt được 1 kẹo ma quái!');
            this.emitOp({ k: 'mg_candy_collect', id: item.id, byName: me.name });
          } else if (item.type === 'lixi') {
            playSfx('tet_lixi', 'tet');
            if (this.floaters) this.floaters.push({ e: '🧧', who: 'me', t: Date.now() });
            this.toast(`🧧 +${item.val} Xu Vàng! Lời chúc năm mới: "${item.wish}" ✨`);
            this.emitOp({ k: 'mg_lixi_collect', id: item.id, byName: me.name, val: item.val, wish: item.wish });
          }
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
        this.spawnSnowballProjectile(op);
        break;
      case 'mg_candy_spawn':
        this.spawnCandies(op.candies || []);
        break;
      case 'mg_candy_collect': {
        const idx = this.pickups.findIndex(p => p.id === op.id);
        if (idx !== -1) {
          if (this.pickups[idx].mesh) this.group.remove(this.pickups[idx].mesh);
          this.pickups.splice(idx, 1);
        }
        const s = this.scores.get(op.byName) || { name: op.byName, score: 0 };
        s.score += 1;
        this.scores.set(op.byName, s);
        this.updateScoreboardUI('🍬 SĂN KẸO HALLOWEEN', 'Kẹo đã nhặt');
        break;
      }
      case 'mg_tet_rain':
        this.spawnEnvelopes(op.envelopes || []);
        break;
      case 'mg_lixi_collect': {
        const idx = this.pickups.findIndex(p => p.id === op.id);
        if (idx !== -1) {
          if (this.pickups[idx].mesh) this.group.remove(this.pickups[idx].mesh);
          this.pickups.splice(idx, 1);
        }
        const s = this.scores.get(op.byName) || { name: op.byName, score: 0 };
        s.score += op.val || 100;
        this.scores.set(op.byName, s);
        this.updateScoreboardUI('🧧 LỘC ĐẦU NĂM', 'Xu Vàng May Mắn');
        break;
      }
      case 'mg_cupid_shoot':
        this.spawnCupidArrowProjectile(op);
        break;
    }
  }

  // --------------------------------------------------------------------------
  // LEADERBOARD UI
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

    let html = `<h4>🏆 ${title || 'BẢNG XẾP HẠNG'}</h4><div class="mg-list">`;
    sorted.slice(0, 5).forEach((entry, idx) => {
      const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '•';
      html += `<div class="mg-row"><span>${medal} ${entry.name}</span><b>${entry.score} ${entry.title ? `<small style="font-weight:400;opacity:0.8">(${entry.title})</small>` : ''}</b></div>`;
    });
    html += `</div>`;
    board.innerHTML = html;
  }
}
