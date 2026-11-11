// Articulated 3D Human Character with Costumes, Wearable Pumpkin Hats, Held Props & Rich Animations.
import * as THREE from 'three';
import { COSTUMES } from './themes.js';
import { buildCarvedPumpkin, buildOrnamentMesh, buildAccessoryMesh, buildAuraMesh, G, mat, part } from './props.js';

const HEIGHT = 1.72;
const _headPos = new THREE.Vector3();
export const loadCharacter = async () => true;

// Social & Interactive Emote Mapping
export const EMOTE_CLIP = {
  '👋': 'wave',
  '🤝': 'handshake',
  '🤗': 'hug',
  '🍬': 'trickOrTreat',
  '🍅': 'throwTomato',
  '🍡': 'roast',
  '☕': 'cocoa',
  '😱': 'scared',
  '✨': 'interact',
  '💪': 'flex',
  '🕺': 'cheer_jump',
  '⭐': 'starfish',
  '🙆': 'head_heart',
  '🙇': 'despair',
  '😎': 'dab',
  '🛌': 'lay_chill',
  '🧎': 'kneel',
};

const EMOTE_DURATION = {
  wave: 2600,
  handshake: 2800,
  hug: 3000,
  trickOrTreat: 2800,
  throwTomato: 1600,
  roast: 4500,
  cocoa: 4200,
  scared: 2400,
  interact: 1800,
  flex: 6000,
  cheer_jump: 6000,
  starfish: 6000,
  head_heart: 6000,
  despair: 6500,
  dab: 6000,
  lay_chill: 7000,
  kneel: 7000,
};

function textSprite(draw, w, h, worldH) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  draw(ctx, w, h, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false }));
  s.scale.set((worldH * w) / h, worldH, 1);
  s.renderOrder = 10;
  s.userData = { canvas: c, ctx, draw, w, h, texture: t };
  return s;
}

export function isAdminUser(name) {
  if (!name) return false;
  const n = String(name).trim().toLowerCase();
  return (
    n.includes('chu0n6') ||
    n.includes('chuong') ||
    n.includes('trung') ||
    n.includes('lukhachyaros') ||
    n.includes('khoa')
  );
}

export class Avatar {
  constructor(_unused, { name, hue = 200, costume = 'default', pumpkinHat = null }) {
    this.root = new THREE.Group();
    this.hue = hue;
    this.name = name;
    this.costumeKey = costume || 'default';
    this.pumpkinHatKey = pumpkinHat || null;
    this.heldKey = null;
    this.accessoryKey = null;
    this.auraKey = null;
    this.nametagStyle = null;
    this.limbState = { head: true, leftArm: true, rightArm: true, legs: true };
    this.legoBricks = [];

    this.body = new THREE.Group();
    this.root.add(this.body);

    this.auraGroup = new THREE.Group();
    this.root.add(this.auraGroup);

    this.adminAuraGroup = new THREE.Group();
    this.root.add(this.adminAuraGroup);

    this.buildHumanRig();
    this.applyCostume(this.costumeKey);
    this.setPumpkinHat(this.pumpkinHatKey);

    this.base = 'Idle';
    this.jumping = false;
    this.sitting = null; // null | { type: 'single'|'couple'|'log', lean: -1|0|1 }
    this.emote = null;
    this.emoteStart = 0;
    this.emoteUntil = 0;
    this.splatUntil = 0;
    this.animTime = Math.random() * 10;

    this.setName(name);
    this.bubbleEl = null;
    this.bubbleUntil = 0;
  }

  buildHumanRig() {
    // Pelvis / Hips pivot (y = 0.78m when standing)
    this.hips = new THREE.Group();
    this.hips.position.set(0, 0.78, 0);
    this.body.add(this.hips);

    // Upper Torso
    this.torso = new THREE.Group();
    this.hips.add(this.torso);

    this.shirtMesh = part(this.torso, G.box(), mat('#3b82f6'), [0, 0.28, 0], [0.46, 0.54, 0.25]);
    this.pelvisMesh = part(this.hips, G.box(), mat('#2b3a4a'), [0, -0.04, 0], [0.44, 0.16, 0.24]);

    // Costume extra container on torso (cape, ribs, tattered strips)
    this.torsoExtras = new THREE.Group();
    this.torso.add(this.torsoExtras);

    // Tomato Splat overlay on chest/face (hidden unless hit by tomato)
    this.splatGroup = new THREE.Group();
    this.splatGroup.visible = false;
    const redMat = mat('#e63946', { emissive: '#9b0000', emissiveIntensity: 0.4, roughness: 0.3 });
    part(this.splatGroup, G.sph(), redMat, [0.06, 0.32, 0.14], [0.22, 0.2, 0.05]);
    part(this.splatGroup, G.sph(), redMat, [-0.1, 0.2, 0.14], [0.14, 0.16, 0.05]);
    part(this.splatGroup, G.sph(), redMat, [0.02, 0.72, 0.21], [0.16, 0.16, 0.05]);
    this.torso.add(this.splatGroup);

    // Neck & Head Group
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 0.58, 0);
    this.torso.add(this.headGroup);

    // Face / Head
    this.headMesh = part(this.headGroup, G.sph(), mat('#ffdbb5'), [0, 0.2, 0], [0.42, 0.44, 0.42]);
    // Eyes
    this.leftEye = part(this.headGroup, G.sph(), mat('#111827'), [-0.085, 0.22, 0.19], [0.055, 0.065, 0.04]);
    this.rightEye = part(this.headGroup, G.sph(), mat('#111827'), [0.085, 0.22, 0.19], [0.055, 0.065, 0.04]);
    // Blush cheeks
    part(this.headGroup, G.sph(), mat('#ff8fa3'), [-0.13, 0.16, 0.18], [0.055, 0.035, 0.03]);
    part(this.headGroup, G.sph(), mat('#ff8fa3'), [0.13, 0.16, 0.18], [0.055, 0.035, 0.03]);
    // Smile mouth
    this.mouthMesh = part(this.headGroup, G.box(), mat('#7f1d1d'), [0, 0.12, 0.2], [0.09, 0.025, 0.03]);

    // Hair & Head Costume Extras
    this.hairGroup = new THREE.Group();
    this.headGroup.add(this.hairGroup);

    // Wearable Pumpkin Hat Mount (covers head when worn)
    this.pumpkinMount = new THREE.Group();
    this.pumpkinMount.position.set(0, -0.08, 0);
    this.headGroup.add(this.pumpkinMount);

    // Head Accessories Mount (Crown, Cowboy Hat, Top Hat, Cat Ears, Shades, etc.)
    this.accessoryGroup = new THREE.Group();
    this.accessoryGroup.position.set(0, 0.24, 0);
    this.headGroup.add(this.accessoryGroup);

    // Back Accessories Mount on Torso (Wings, Capes)
    this.backAccessoryGroup = new THREE.Group();
    this.torso.add(this.backAccessoryGroup);

    // Left Arm (Shoulder pivot at [-0.3, 0.48, 0])
    this.leftArm = new THREE.Group();
    this.leftArm.position.set(-0.3, 0.48, 0);
    this.torso.add(this.leftArm);
    this.leftSleeve = part(this.leftArm, G.cyl(), mat('#3b82f6'), [0, -0.13, 0], [0.14, 0.28, 0.14]);
    this.leftForearm = part(this.leftArm, G.cyl(), mat('#ffdbb5'), [0, -0.34, 0], [0.12, 0.24, 0.12]);
    this.leftHand = part(this.leftArm, G.sph(), mat('#ffdbb5'), [0, -0.48, 0], [0.14, 0.14, 0.14]);

    // Right Arm (Shoulder pivot at [0.3, 0.48, 0])
    this.rightArm = new THREE.Group();
    this.rightArm.position.set(0.3, 0.48, 0);
    this.torso.add(this.rightArm);
    this.rightSleeve = part(this.rightArm, G.cyl(), mat('#3b82f6'), [0, -0.13, 0], [0.14, 0.28, 0.14]);
    this.rightForearm = part(this.rightArm, G.cyl(), mat('#ffdbb5'), [0, -0.34, 0], [0.12, 0.24, 0.12]);
    this.rightHand = part(this.rightArm, G.sph(), mat('#ffdbb5'), [0, -0.48, 0], [0.14, 0.14, 0.14]);

    // Held Item Mount on Right Hand
    this.handMount = new THREE.Group();
    this.handMount.position.set(0, -0.5, 0.1);
    this.rightArm.add(this.handMount);

    // Temporary Emote Prop Mount (marshmallow stick, cocoa cup, candy basket)
    this.emotePropMount = new THREE.Group();
    this.emotePropMount.position.set(0, -0.5, 0.12);
    this.rightArm.add(this.emotePropMount);

    // Left Leg (Hip pivot at [-0.13, -0.08, 0])
    this.leftLeg = new THREE.Group();
    this.leftLeg.position.set(-0.13, -0.08, 0);
    this.hips.add(this.leftLeg);
    this.leftThigh = part(this.leftLeg, G.cyl(), mat('#2b3a4a'), [0, -0.28, 0], [0.16, 0.56, 0.16]);
    this.leftShoe = part(this.leftLeg, G.box(), mat('#1f242d'), [0, -0.62, 0.04], [0.17, 0.14, 0.26]);

    // Right Leg (Hip pivot at [0.13, -0.08, 0])
    this.rightLeg = new THREE.Group();
    this.rightLeg.position.set(0.13, -0.08, 0);
    this.hips.add(this.rightLeg);
    this.rightThigh = part(this.rightLeg, G.cyl(), mat('#2b3a4a'), [0, -0.28, 0], [0.16, 0.56, 0.16]);
    this.rightShoe = part(this.rightLeg, G.box(), mat('#1f242d'), [0, -0.62, 0.04], [0.17, 0.14, 0.26]);
  }

  applyCostume(costumeKey = 'default') {
    this.costumeKey = COSTUMES[costumeKey] ? costumeKey : 'default';
    const cfg = COSTUMES[this.costumeKey];
    const defaultShirtColor = new THREE.Color().setHSL((this.hue % 360) / 360, 0.72, 0.52).getStyle();
    const shirtCol = cfg.shirt || defaultShirtColor;

    const skinM = mat(cfg.skin);
    const shirtM = mat(shirtCol);
    const pantsM = mat(cfg.pants);
    const shoesM = mat(cfg.shoes);
    const eyeM = cfg.redEyes
      ? mat('#ff0033', { emissive: '#ff0033', emissiveIntensity: 1.5 })
      : cfg.skullEyes
      ? mat('#050505')
      : mat('#111827');

    this.headMesh.material = skinM;
    this.leftForearm.material = skinM;
    this.rightForearm.material = skinM;
    this.leftHand.material = skinM;
    this.rightHand.material = skinM;

    this.shirtMesh.material = shirtM;
    this.leftSleeve.material = shirtM;
    this.rightSleeve.material = shirtM;

    this.pelvisMesh.material = pantsM;
    this.leftThigh.material = pantsM;
    this.rightThigh.material = pantsM;

    this.leftShoe.material = shoesM;
    this.rightShoe.material = shoesM;

    this.leftEye.material = eyeM;
    this.rightEye.material = eyeM;

    // Clear and rebuild hair & costume extras
    this.hairGroup.clear();
    this.torsoExtras.clear();

    if (cfg.hair) {
      const hm = mat(cfg.hair);
      if (cfg.flatHead) {
        // Frankenstein flat top hair + neck bolts
        part(this.hairGroup, G.cyl(), hm, [0, 0.34, 0], [0.43, 0.18, 0.43]);
        part(this.hairGroup, G.cyl(), mat('#95a5a6', { metalness: 0.6 }), [0, 0.12, 0], [0.06, 0.56, 0.06], [0, 0, Math.PI / 2]);
      } else {
        // Stylish rounded hair cap + bangs
        part(this.hairGroup, G.sph(), hm, [0, 0.25, -0.02], [0.45, 0.38, 0.45]);
        part(this.hairGroup, G.box(), hm, [0, 0.34, 0.14], [0.34, 0.12, 0.16], [0.2, 0, 0]);
      }
    }

    if (cfg.witchHat) {
      const hatM = mat('#19103b');
      part(this.hairGroup, G.cyl(), hatM, [0, 0.38, 0], [0.72, 0.05, 0.72]);
      part(this.hairGroup, G.cyl(), mat('#f59e0b'), [0, 0.42, 0], [0.36, 0.06, 0.36]);
      part(this.hairGroup, G.cone(), hatM, [0, 0.68, 0], [0.36, 0.55, 0.36], [-0.12, 0, 0]);
    }

    if (cfg.cape) {
      part(this.torsoExtras, G.box(), mat(cfg.cape), [0, 0.18, -0.15], [0.56, 0.75, 0.04], [0.12, 0, 0]);
      part(this.torsoExtras, G.cone(), mat(cfg.cape), [0, 0.58, -0.06], [0.46, 0.24, 0.22], [Math.PI, 0, 0]);
    }

    if (cfg.ribs) {
      const boneM = mat('#f1f2f6');
      for (let i = 0; i < 3; i++) {
        part(this.torsoExtras, G.box(), boneM, [0, 0.18 + i * 0.11, 0.13], [0.32, 0.045, 0.03]);
      }
      part(this.torsoExtras, G.box(), boneM, [0, 0.28, 0.135], [0.06, 0.3, 0.03]);
    }

    if (cfg.tattered) {
      part(this.torsoExtras, G.box(), mat('#c0392b'), [0.08, 0.28, 0.13], [0.14, 0.18, 0.02], [0, 0, 0.3]);
    }
  }

  setPumpkinHat(styleKey) {
    this.pumpkinHatKey = styleKey || null;
    this.pumpkinMount.clear();
    if (this.pumpkinHatKey) {
      const p = buildCarvedPumpkin(this.pumpkinHatKey, 0.78);
      this.pumpkinMount.add(p);
      this.hairGroup.visible = false;
    } else {
      this.hairGroup.visible = true;
    }
  }

  setHeldItem(ornKey) {
    if (this.heldKey === ornKey) return;
    this.heldKey = ornKey || null;
    this.handMount.clear();
    if (this.heldKey) {
      const m = buildOrnamentMesh(this.heldKey, 0.85);
      this.handMount.add(m);
    }
  }

  buildEmoteProp(clip) {
    this.emotePropMount.clear();
    if (clip === 'roast') {
      // Wooden skewer stick + marshmallow on tip
      part(this.emotePropMount, G.cyl(), mat('#8d5524'), [0, 0, 0.28], [0.025, 0.65, 0.025], [Math.PI / 2, 0, 0]);
      part(this.emotePropMount, G.cyl(), mat('#fff8f0', { emissive: '#ffb703', emissiveIntensity: 0.25 }), [0, 0, 0.62], [0.11, 0.15, 0.11], [Math.PI / 2, 0, 0]);
    } else if (clip === 'cocoa') {
      // Warm red mug of hot cocoa + whipped cream
      part(this.emotePropMount, G.cyl(), mat('#b3202a'), [0, 0, 0.06], [0.16, 0.2, 0.16]);
      part(this.emotePropMount, G.sph(), mat('#fff8e7'), [0, 0.1, 0.06], [0.14, 0.08, 0.14]);
    } else if (clip === 'trickOrTreat') {
      // Small candy pumpkin bucket
      const bucket = buildCarvedPumpkin('happy', 0.36);
      bucket.position.set(0, -0.12, 0.08);
      this.emotePropMount.add(bucket);
    } else if (clip === 'throwTomato') {
      part(this.emotePropMount, G.sph(), mat('#e63946'), [0, 0, 0.05], [0.18, 0.18, 0.18]);
    }
  }

  triggerSplat(durationMs = 4000) {
    this.splatUntil = performance.now() + durationMs;
    this.splatGroup.visible = true;
  }

  setDinnerbone(active) {
    this.isDinnerbone = !!active;
    if (this.isDinnerbone) {
      this.body.rotation.z = Math.PI;
      this.body.position.y = 1.6;
    } else {
      this.body.rotation.z = 0;
      this.body.position.y = 0;
    }
  }

  setName(name, title = this.title, style = this.nametagStyle) {
    this.name = name;
    this.title = title || null;
    this.nametagStyle = style || null;
    if (this.label) this.root.remove(this.label);

    const isAdmin = isAdminUser(name);
    const displayTitle = this.title || (isAdmin ? '👑 ADMIN' : null);
    const isRainbow = !!(displayTitle && (displayTitle === 'GAY' || displayTitle.includes('GAY'))) || !!style?.rainbow;
    this.isRainbowNametag = isRainbow;

    this.label = textSprite(
      (x, w, h, animOffset = 0) => {
        const bgFill = isAdmin ? 'rgba(88, 28, 28, 0.92)' : 'rgba(15, 23, 42, 0.88)';
        x.fillStyle = bgFill;
        x.beginPath();
        x.roundRect(8, 8, w - 16, h - 16, 22);
        x.fill();

        // Border styling
        if (isRainbow) {
          const hue = Math.floor(((animOffset * 60) % 360 + 360) % 360);
          x.strokeStyle = `hsl(${hue}, 100%, 65%)`;
          x.lineWidth = 4;
        } else if (style?.border) {
          x.strokeStyle = style.border;
          x.lineWidth = 3.5;
        } else {
          x.strokeStyle = isAdmin ? 'rgba(250, 204, 21, 0.95)' : 'rgba(56, 189, 248, 0.85)';
          x.lineWidth = isAdmin ? 4 : 3;
        }
        x.stroke();

        x.textAlign = 'center';
        x.textBaseline = 'middle';

        // Title
        if (displayTitle) {
          x.font = 'bold 22px system-ui, sans-serif';
          if (isRainbow) {
            const h1 = Math.floor(((animOffset * 90) % 360 + 360) % 360);
            const grad = x.createLinearGradient(40, 0, w - 40, 0);
            grad.addColorStop(0, `hsl(${h1}, 100%, 65%)`);
            grad.addColorStop(0.5, `hsl(${(h1 + 120) % 360}, 100%, 65%)`);
            grad.addColorStop(1, `hsl(${(h1 + 240) % 360}, 100%, 65%)`);
            x.fillStyle = grad;
          } else {
            x.fillStyle = isAdmin ? '#fde047' : (style?.color || '#facc15');
          }
          x.fillText(displayTitle, w / 2, 28);

          x.font = style?.font ? `bold 26px ${style.font}` : 'bold 26px system-ui, sans-serif';
          if (isRainbow) {
            const h2 = Math.floor(((animOffset * 90 + 60) % 360 + 360) % 360);
            const grad = x.createLinearGradient(40, 0, w - 40, 0);
            grad.addColorStop(0, `hsl(${h2}, 100%, 75%)`);
            grad.addColorStop(0.5, `hsl(${(h2 + 120) % 360}, 100%, 75%)`);
            grad.addColorStop(1, `hsl(${(h2 + 240) % 360}, 100%, 75%)`);
            x.fillStyle = grad;
          } else if (style?.color) {
            x.fillStyle = style.color;
          } else {
            x.fillStyle = '#f8fafc';
          }
          x.fillText(name, w / 2, 60);
        } else {
          x.font = style?.font ? `bold 32px ${style.font}` : 'bold 32px system-ui, sans-serif';
          if (style?.color) {
            x.fillStyle = style.color;
          } else {
            x.fillStyle = '#f8fafc';
          }
          x.fillText(name, w / 2, h / 2);
        }
      },
      360,
      86,
      0.44
    );
    this.label.position.y = HEIGHT + 0.42;
    this.root.add(this.label);
  }

  setAccessory(accKey) {
    this.accessoryKey = accKey || null;
    this.accessoryGroup.clear();
    this.backAccessoryGroup.clear();
    if (!accKey) return;

    const accMesh = buildAccessoryMesh(accKey);
    if (accKey === 'devil_wings') {
      this.backAccessoryGroup.add(accMesh);
    } else {
      this.accessoryGroup.add(accMesh);
    }
  }

  setAura(auraKey) {
    this.auraKey = auraKey || null;
    this.auraGroup.clear();
    if (!auraKey) return;
    const aMesh = buildAuraMesh(auraKey);
    this.auraGroup.add(aMesh);
    this.auraGroup.userData = aMesh.userData;
  }

  setAdminAura(enabled) {
    this.adminAuraGroup.clear();
    if (!enabled) return;
    const adminMesh = buildAuraMesh('admin');
    this.adminAuraGroup.add(adminMesh);
    this.adminAuraGroup.userData = adminMesh.userData;
  }

  setLimbState(limbs = {}) {
    if (limbs.head !== undefined) {
      if (this.headGroup.visible && !limbs.head) this.spawnLegoPop(0, 1.4, 0);
      this.headGroup.visible = !!limbs.head;
      this.limbState.head = !!limbs.head;
    }
    if (limbs.leftArm !== undefined) {
      if (this.leftArm.visible && !limbs.leftArm) this.spawnLegoPop(-0.35, 1.1, 0);
      this.leftArm.visible = !!limbs.leftArm;
      this.limbState.leftArm = !!limbs.leftArm;
    }
    if (limbs.rightArm !== undefined) {
      if (this.rightArm.visible && !limbs.rightArm) this.spawnLegoPop(0.35, 1.1, 0);
      this.rightArm.visible = !!limbs.rightArm;
      this.limbState.rightArm = !!limbs.rightArm;
    }
    if (limbs.legs !== undefined) {
      if (this.leftLeg.visible && !limbs.legs) {
        this.spawnLegoPop(-0.15, 0.4, 0);
        this.spawnLegoPop(0.15, 0.4, 0);
      }
      this.leftLeg.visible = !!limbs.legs;
      this.rightLeg.visible = !!limbs.legs;
      this.limbState.legs = !!limbs.legs;
    }
  }

  setMidasGolden(active = true) {
    this.isMidasGolden = !!active;
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      metalness: 0.95,
      roughness: 0.15,
      emissive: 0x553300,
      emissiveIntensity: 0.3
    });
    this.root.traverse(child => {
      if (child.isMesh && child !== this.nameSprite && child !== this.bubbleSprite && child !== this.speakingBadge) {
        if (active) {
          if (!child.userData.origMaterial) child.userData.origMaterial = child.material;
          child.material = goldMat;
        } else if (child.userData.origMaterial) {
          child.material = child.userData.origMaterial;
          delete child.userData.origMaterial;
        }
      }
    });
  }

  setGhostMode(active = true) {
    this.isGhostMode = !!active;
    this.root.traverse(child => {
      if (child.isMesh && child !== this.nameSprite && child !== this.bubbleSprite && child !== this.speakingBadge) {
        if (active) {
          if (child.material) {
            child.material.transparent = true;
            child.material.opacity = 0.35;
          }
        } else {
          if (child.material) {
            child.material.transparent = false;
            child.material.opacity = 1.0;
          }
        }
      }
    });
  }

  spawnLegoPop(ox, oy, oz) {
    const colors = ['#dc2626', '#2563eb', '#facc15', '#16a34a', '#9333ea', '#ea580c'];
    for (let i = 0; i < 5; i++) {
      const col = colors[Math.floor(Math.random() * colors.length)];
      const m = new THREE.Mesh(G.box(), mat(col, { roughness: 0.3 }));
      m.scale.set(0.14, 0.1, 0.14);
      m.position.set(ox + (Math.random() - 0.5) * 0.1, oy + (Math.random() - 0.5) * 0.1, oz + (Math.random() - 0.5) * 0.1);
      this.root.add(m);
      this.legoBricks.push({
        mesh: m,
        vx: (Math.random() - 0.5) * 2.8,
        vy: 1.8 + Math.random() * 2.5,
        vz: (Math.random() - 0.5) * 2.8,
        rx: (Math.random() - 0.5) * 10,
        ry: (Math.random() - 0.5) * 10,
        life: 0,
        maxLife: 2.2,
      });
    }
  }

  setTitle(title) {
    this.title = title;
    this.setName(this.name, title);
  }

  setSpeaking(speaking) {
    if (this.isSpeaking === speaking && this.speakingBadge) return;
    this.isSpeaking = speaking;
    if (!this.speakingBadge) {
      this.speakingBadge = textSprite(
        (x, w, h) => {
          // Circular green badge with white border and animated soundwave / mic
          x.fillStyle = 'rgba(16, 185, 129, 0.95)';
          x.beginPath();
          x.arc(w / 2, h / 2, h * 0.44, 0, Math.PI * 2);
          x.fill();
          x.strokeStyle = '#ffffff';
          x.lineWidth = 5;
          x.stroke();
          x.font = '36px system-ui, sans-serif';
          x.textAlign = 'center';
          x.textBaseline = 'middle';
          x.fillStyle = '#ffffff';
          x.fillText('🎙️', w / 2, h / 2);
        },
        96,
        96,
        0.32
      );
      this.speakingBadge.position.y = HEIGHT + 0.74;
      this.root.add(this.speakingBadge);
    }
    this.speakingBadge.visible = !!speaking;
  }

  say(text) {
    const t = text.length > 70 ? text.slice(0, 67) + '…' : text;
    this.bubbleUntil = performance.now() + 6500;
    if (!this.bubbleEl) {
      this.bubbleEl = document.createElement('div');
      this.bubbleEl.className = 'speech-bubble';
      document.getElementById('speechLayer')?.appendChild(this.bubbleEl);
    }
    this.bubbleEl.textContent = t;
    this.bubbleEl.style.display = 'block';
  }

  updateBubble(camera) {
    if (!this.bubbleEl) return;
    if (performance.now() > this.bubbleUntil) {
      this.bubbleEl.remove();
      this.bubbleEl = null;
      return;
    }
    const layer = document.getElementById('speechLayer');
    if (!camera || !this.root.visible || layer?.classList.contains('safe-hidden')) {
      this.bubbleEl.style.display = 'none';
      return;
    }
    _headPos.set(0, HEIGHT + 0.35, 0);
    this.root.localToWorld(_headPos);
    _headPos.project(camera);

    if (_headPos.z > 1 || _headPos.z < -1) {
      this.bubbleEl.style.display = 'none';
      return;
    }
    const sx = Math.round((_headPos.x * 0.5 + 0.5) * innerWidth);
    const sy = Math.round((-_headPos.y * 0.5 + 0.5) * innerHeight);
    this.bubbleEl.style.display = 'block';
    this.bubbleEl.style.left = `${sx}px`;
    this.bubbleEl.style.top = `${sy}px`;
  }

  destroy() {
    if (this.bubbleEl) {
      this.bubbleEl.remove();
      this.bubbleEl = null;
    }
    if (this.root.parent) {
      this.root.parent.remove(this.root);
    }
  }

  /** Locomotion state: 'idle' | 'walk' | 'run' | 'jump' | 'sit' | 'couple_sit' */
  setLocomotion(s, sitInfo = null) {
    this.jumping = s === 'jump';
    this.sitting = s === 'sit' || s === 'couple_sit' ? (sitInfo || { type: s }) : null;
    this.base = s === 'run' ? 'Running' : s === 'walk' ? 'Walking' : s === 'sit' || s === 'couple_sit' ? 'Sitting' : 'Idle';
  }

  playEmote(clipKey, hold = true) {
    const clip = EMOTE_CLIP[clipKey] || clipKey || 'wave';
    const dur = EMOTE_DURATION[clip] || 2500;
    this.emote = clip;
    this.emoteHold = !!hold;
    this.emoteStart = performance.now();
    this.emoteUntil = hold ? Infinity : (this.emoteStart + dur);
    this.buildEmoteProp(clip);
  }

  update(dt) {
    const now = performance.now();
    this.animTime += dt;
    const t = this.animTime;

    if (this.splatGroup.visible && now > this.splatUntil) {
      this.splatGroup.visible = false;
    }

    if (this.speakingBadge && this.speakingBadge.visible) {
      const s = 0.32 + Math.sin(now * 0.012) * 0.04;
      this.speakingBadge.scale.set(s, s, 1);
    }

    // Dynamic 24/7 Rainbow RGB update for nametag
    if (this.isRainbowNametag && this.label && this.label.userData) {
      this.rainbowTimer = (this.rainbowTimer || 0) + dt;
      if (this.rainbowTimer >= 0.06) {
        this.rainbowTimer = 0;
        const { ctx, draw, w, h, texture } = this.label.userData;
        ctx.clearRect(0, 0, w, h);
        draw(ctx, w, h, now * 0.003);
        texture.needsUpdate = true;
      }
    }

    // Update Lego Brick physics
    for (let i = this.legoBricks.length - 1; i >= 0; i--) {
      const b = this.legoBricks[i];
      b.life += dt;
      b.vy -= 9.8 * dt;
      b.mesh.position.x += b.vx * dt;
      b.mesh.position.y += b.vy * dt;
      b.mesh.position.z += b.vz * dt;
      b.mesh.rotation.x += b.rx * dt;
      b.mesh.rotation.y += b.ry * dt;
      if (b.mesh.position.y < 0.05) {
        b.mesh.position.y = 0.05;
        b.vy = -b.vy * 0.35;
        b.vx *= 0.7;
        b.vz *= 0.7;
      }
      if (b.life >= b.maxLife) {
        this.root.remove(b.mesh);
        this.legoBricks.splice(i, 1);
      }
    }

    // Update Aura Particles & Ring
    if (this.auraGroup?.userData?.update) {
      this.auraGroup.userData.update(this.animTime);
    }
    if (this.adminAuraGroup?.userData?.update) {
      this.adminAuraGroup.userData.update(this.animTime);
    }

    // Cancel emote if non-held emote expired or player started walking/running/jumping
    if (this.emote && ((!this.emoteHold && now > this.emoteUntil) || (this.base !== 'Idle' && this.base !== 'Sitting') || this.jumping)) {
      this.emote = null;
      this.emoteHold = false;
      this.emotePropMount.clear();
    }

    // Reset transforms before procedural pose
    this.hips.position.set(0, 0.78, 0);
    this.hips.rotation.set(0, 0, 0);
    this.torso.rotation.set(0, 0, 0);
    this.headGroup.rotation.set(0, 0, 0);
    this.leftArm.rotation.set(0, 0, 0);
    this.rightArm.rotation.set(0, 0, 0);
    this.leftLeg.rotation.set(0, 0, 0);
    this.rightLeg.rotation.set(0, 0, 0);

    // 1. Base Locomotion or Sitting Pose
    if (this.jumping) {
      // Dynamic parkour airborne leaping silhouette
      this.hips.position.y = 0.82;
      this.torso.rotation.x = 0.18;
      this.leftArm.rotation.set(-2.3, 0.2, 0.45);
      this.rightArm.rotation.set(-2.1, -0.2, -0.45);
      this.leftLeg.rotation.set(-0.65, 0, -0.1);
      this.rightLeg.rotation.set(0.42, 0, 0.1);
      this.headGroup.rotation.x = -0.12;
    } else if (this.base === 'Sitting') {
      // Sitting on Chair / Couple Sofa / Campfire Log
      this.hips.position.set(0, 0.40, 0.04);
      this.leftLeg.rotation.x = -Math.PI / 2 + 0.05;
      this.rightLeg.rotation.x = -Math.PI / 2 + 0.05;
      this.leftArm.rotation.x = -0.32;
      this.rightArm.rotation.x = -0.32;
      // Couple Seat Lean!
      if (this.sitting?.lean) {
        this.torso.rotation.z = this.sitting.lean * 0.14;
        this.headGroup.rotation.z = this.sitting.lean * 0.18;
      }
    } else if (this.base === 'Walking' || this.base === 'Running') {
      const speed = this.base === 'Running' ? 12 : 7.5;
      const amp = this.base === 'Running' ? 0.85 : 0.52;
      const s = Math.sin(t * speed);
      this.hips.position.y = 0.78 + Math.abs(Math.cos(t * speed)) * (this.base === 'Running' ? 0.08 : 0.04);
      this.leftLeg.rotation.x = s * amp;
      this.rightLeg.rotation.x = -s * amp;
      this.leftArm.rotation.x = -s * amp * 0.85;
      this.rightArm.rotation.x = s * amp * 0.85;
      // Natural shoulder / torso twist
      this.torso.rotation.x = this.base === 'Running' ? 0.16 : 0.06;
      this.torso.rotation.y = -s * (this.base === 'Running' ? 0.14 : 0.06);
      this.headGroup.rotation.y = s * (this.base === 'Running' ? 0.06 : 0.03);
    } else {
      // Idle gentle breathing with natural weight shift
      const b = Math.sin(t * 2.2);
      this.hips.position.y = 0.78 + b * 0.015;
      this.hips.rotation.z = Math.sin(t * 1.1) * 0.02;
      this.leftArm.rotation.z = 0.08 + b * 0.02;
      this.rightArm.rotation.z = -0.08 - b * 0.02;
      this.torso.rotation.z = -Math.sin(t * 1.1) * 0.015;
      this.headGroup.rotation.y = Math.sin(t * 0.8) * 0.09;
      this.headGroup.rotation.x = Math.sin(t * 1.6) * 0.03;
    }

    // If holding an ornament, raise right forearm slightly
    if (this.heldKey && !this.emote) {
      this.rightArm.rotation.x = -0.95;
    }

    // 2. Active Emote / Action Override
    if (this.emote) {
      const elapsed = (now - this.emoteStart) / 1000;
      switch (this.emote) {
        case 'wave': {
          this.rightArm.rotation.x = -2.55;
          this.rightArm.rotation.z = -0.35 + Math.sin(elapsed * 12) * 0.38;
          this.headGroup.rotation.z = 0.1;
          break;
        }
        case 'handshake': {
          this.rightArm.rotation.x = -1.35 + Math.sin(elapsed * 10) * 0.22;
          this.rightArm.rotation.y = -0.15;
          this.torso.rotation.x = 0.12;
          break;
        }
        case 'hug': {
          const close = Math.min(1, elapsed * 2.5);
          this.leftArm.rotation.x = -1.45;
          this.rightArm.rotation.x = -1.45;
          this.leftArm.rotation.y = 0.45 * close;
          this.rightArm.rotation.y = -0.45 * close;
          this.torso.rotation.z = Math.sin(elapsed * 5) * 0.08;
          break;
        }
        case 'roast': {
          // Extending marshmallow stick toward campfire
          this.rightArm.rotation.x = -1.25 + Math.sin(elapsed * 4) * 0.08;
          this.leftArm.rotation.x = -0.45;
          break;
        }
        case 'cocoa': {
          // Raising hot cocoa mug to mouth to sip
          const sip = Math.sin(elapsed * 3) * 0.5 + 0.5;
          this.rightArm.rotation.x = -1.35 - sip * 0.55;
          this.rightArm.rotation.y = -0.35;
          this.headGroup.rotation.x = -sip * 0.22;
          break;
        }
        case 'trickOrTreat': {
          this.rightArm.rotation.x = -1.2;
          this.leftArm.rotation.x = -2.1 + Math.sin(elapsed * 10) * 0.3;
          this.hips.position.y += Math.abs(Math.sin(elapsed * 8)) * 0.12;
          break;
        }
        case 'throwTomato': {
          const p = Math.min(1, elapsed / 0.5);
          this.rightArm.rotation.x = -2.6 + p * 2.2;
          this.torso.rotation.y = (0.5 - p) * 0.6;
          break;
        }
        case 'scared': {
          this.leftArm.rotation.x = -2.7;
          this.rightArm.rotation.x = -2.7;
          this.leftArm.rotation.z = 0.35;
          this.rightArm.rotation.z = -0.35;
          this.torso.rotation.x = -0.22;
          this.hips.position.y += Math.abs(Math.sin(elapsed * 18)) * 0.16;
          this.headGroup.rotation.y = Math.sin(elapsed * 22) * 0.25;
          break;
        }
        case 'interact': {
          this.leftArm.rotation.x = -1.5 + Math.sin(elapsed * 10) * 0.25;
          this.rightArm.rotation.x = -1.5 - Math.sin(elapsed * 10) * 0.25;
          break;
        }
        case 'flex': {
          // Double biceps flex! Upper arms horizontal out, forearms bent up 90 deg
          this.torso.rotation.x = -0.06;
          this.leftArm.rotation.set(-1.15, 0.25, 1.35);
          this.rightArm.rotation.set(-1.15, -0.25, -1.35);
          this.hips.position.y = 0.8 + Math.sin(elapsed * 5) * 0.015;
          break;
        }
        case 'cheer_jump': {
          // Joyful cheer V-arms and one leg lifted
          this.leftArm.rotation.set(-2.55, 0, 0.55);
          this.rightArm.rotation.set(-2.55, 0, -0.55);
          this.leftLeg.rotation.set(-0.85, 0, -0.2);
          this.rightLeg.rotation.set(0.1, 0, 0.05);
          this.hips.position.y = 0.88 + Math.abs(Math.sin(elapsed * 7)) * 0.12;
          this.headGroup.rotation.z = Math.sin(elapsed * 6) * 0.12;
          break;
        }
        case 'starfish': {
          // Jumping Jack X-Pose
          this.leftArm.rotation.set(-1.6, 0, 0.95);
          this.rightArm.rotation.set(-1.6, 0, -0.95);
          this.leftLeg.rotation.set(0, 0, 0.42);
          this.rightLeg.rotation.set(0, 0, -0.42);
          this.hips.position.y = 0.9 + Math.abs(Math.sin(elapsed * 6)) * 0.08;
          break;
        }
        case 'head_heart': {
          // Heart arch over crown
          this.leftArm.rotation.set(-2.85, 0, -0.65);
          this.rightArm.rotation.set(-2.85, 0, 0.65);
          this.hips.rotation.z = Math.sin(elapsed * 4) * 0.06;
          this.headGroup.rotation.y = Math.sin(elapsed * 4) * 0.1;
          break;
        }
        case 'despair': {
          // Cowering / Defeated Fetal OTL pose
          this.hips.position.set(0, 0.22, 0.1);
          this.torso.rotation.x = 1.35;
          this.leftLeg.rotation.set(-1.75, 0, -0.15);
          this.rightLeg.rotation.set(-1.75, 0, 0.15);
          this.leftArm.rotation.set(0.65, 0, -0.2);
          this.rightArm.rotation.set(0.65, 0, 0.2);
          this.headGroup.rotation.x = 0.65;
          break;
        }
        case 'dab': {
          // Classic cool hip-hop Dab
          this.rightArm.rotation.set(-1.95, -0.2, -0.95);
          this.leftArm.rotation.set(-2.15, 0.45, 0.75);
          this.torso.rotation.set(0.22, 0.42, -0.2);
          this.headGroup.rotation.set(0.35, -0.4, 0.2);
          this.leftLeg.rotation.set(-0.25, 0, -0.2);
          this.rightLeg.rotation.set(0.35, 0, 0.2);
          break;
        }
        case 'lay_chill': {
          // Lying down sideways on the floor propped by hand
          this.hips.position.set(0, 0.2, 0);
          this.hips.rotation.z = Math.PI / 2 - 0.15;
          this.leftLeg.rotation.set(0.12, 0, 0.1);
          this.rightLeg.rotation.set(-0.12, 0, -0.1);
          this.leftArm.rotation.set(-1.6, 0, 0.65);
          this.rightArm.rotation.set(-0.35, 0, -0.35);
          this.headGroup.rotation.z = -0.35;
          break;
        }
        case 'kneel': {
          // Polite Seiza kneeling pose
          this.hips.position.set(0, 0.38, 0.04);
          this.leftLeg.rotation.set(-1.45, 0, 0.05);
          this.rightLeg.rotation.set(-1.45, 0, -0.05);
          this.torso.rotation.x = -0.05;
          this.leftArm.rotation.set(-0.65, 0, -0.1);
          this.rightArm.rotation.set(-0.65, 0, 0.1);
          this.headGroup.rotation.x = Math.sin(elapsed * 2) * 0.05;
          break;
        }
      }
    }
  }
}

export function hueFor(str = '') {
  let h = 0;
  for (const c of str) h = (h * 31 + c.codePointAt(0)) % 360;
  return h;
}
