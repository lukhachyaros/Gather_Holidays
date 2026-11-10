// Articulated 3D Human Character with Costumes, Wearable Pumpkin Hats, Held Props & Rich Animations.
import * as THREE from 'three';
import { COSTUMES } from './themes.js';
import { buildCarvedPumpkin, buildOrnamentMesh, G, mat, part } from './props.js';

const HEIGHT = 1.72;
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
};

function textSprite(draw, w, h, worldH) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  draw(ctx, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false }));
  s.scale.set((worldH * w) / h, worldH, 1);
  s.renderOrder = 10;
  return s;
}

export class Avatar {
  constructor(_unused, { name, hue = 200, costume = 'default', pumpkinHat = null }) {
    this.root = new THREE.Group();
    this.hue = hue;
    this.name = name;
    this.costumeKey = costume || 'default';
    this.pumpkinHatKey = pumpkinHat || null;
    this.heldKey = null;

    this.body = new THREE.Group();
    this.root.add(this.body);

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
    this.bubble = null;
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

  setName(name) {
    this.name = name;
    if (this.label) this.root.remove(this.label);
    this.label = textSprite(
      (x, w, h) => {
        // Sleek modern glassmorphic name pill
        x.fillStyle = 'rgba(15, 23, 42, 0.88)';
        x.beginPath();
        x.roundRect(8, 8, w - 16, h - 16, 20);
        x.fill();
        x.strokeStyle = 'rgba(56, 189, 248, 0.85)';
        x.lineWidth = 3.5;
        x.stroke();
        x.font = 'bold 32px system-ui, sans-serif';
        x.textAlign = 'center';
        x.textBaseline = 'middle';
        x.fillStyle = '#f8fafc';
        x.fillText(name, w / 2, h / 2);
      },
      320,
      64,
      0.38
    );
    this.label.position.y = HEIGHT + 0.38;
    this.root.add(this.label);
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
    if (this.bubble) this.root.remove(this.bubble);
    const t = text.length > 60 ? text.slice(0, 57) + '…' : text;
    this.bubble = textSprite(
      (x, w, h) => {
        x.font = 'bold 32px system-ui, sans-serif';
        x.textAlign = 'center';
        x.textBaseline = 'middle';
        x.fillStyle = 'rgba(255, 255, 255, 0.96)';
        x.beginPath();
        x.roundRect(6, 6, w - 12, h - 12, 24);
        x.fill();
        x.strokeStyle = '#38bdf8';
        x.lineWidth = 4;
        x.stroke();
        x.fillStyle = '#0f172a';
        x.fillText(t, w / 2, h / 2, w - 34);
      },
      512,
      82,
      0.48
    );
    this.bubble.position.y = HEIGHT + 0.88;
    this.root.add(this.bubble);
    this.bubbleUntil = performance.now() + 5500;
  }

  /** Locomotion state: 'idle' | 'walk' | 'run' | 'jump' | 'sit' | 'couple_sit' */
  setLocomotion(s, sitInfo = null) {
    this.jumping = s === 'jump';
    this.sitting = s === 'sit' || s === 'couple_sit' ? (sitInfo || { type: s }) : null;
    this.base = s === 'run' ? 'Running' : s === 'walk' ? 'Walking' : s === 'sit' || s === 'couple_sit' ? 'Sitting' : 'Idle';
  }

  playEmote(clipKey) {
    const clip = EMOTE_CLIP[clipKey] || clipKey || 'wave';
    const dur = EMOTE_DURATION[clip] || 2500;
    this.emote = clip;
    this.emoteStart = performance.now();
    this.emoteUntil = this.emoteStart + dur;
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

    // Cancel emote if expired or started walking/running/jumping
    if (this.emote && (now > this.emoteUntil || (this.base !== 'Idle' && this.base !== 'Sitting') || this.jumping)) {
      this.emote = null;
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
      this.hips.position.set(0, 0.48, 0.06);
      this.leftLeg.rotation.x = -Math.PI / 2 + 0.15;
      this.rightLeg.rotation.x = -Math.PI / 2 + 0.15;
      this.leftArm.rotation.x = -0.35;
      this.rightArm.rotation.x = -0.35;
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
      }
    }

    if (this.bubble && now > this.bubbleUntil) {
      this.root.remove(this.bubble);
      this.bubble = null;
    }
  }
}

export function hueFor(str = '') {
  let h = 0;
  for (const c of str) h = (h * 31 + c.codePointAt(0)) % 360;
  return h;
}
