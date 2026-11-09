// Character loading, skeleton cloning, animation state machine, nametag + chat bubble.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const MODEL_URL = 'assets/models/RobotExpressive.glb'; // CC0 — see CREDITS.md
const HEIGHT = 1.7;
let gltfPromise;
export const loadCharacter = () => (gltfPromise ??= new GLTFLoader().loadAsync(MODEL_URL));

// Emoji used in the UI -> animation clip in the GLB
export const EMOTE_CLIP = { '👋': 'Wave', '🙌': 'ThumbsUp', '🤗': 'Dance', '🎁': 'Yes', '😂': 'Dance', '❤️': 'Yes', '🎉': 'Dance', '👎': 'No' };
const LOOPING = new Set(['Idle', 'Walking', 'Running', 'Dance', 'Sitting']);
const EMOTE_MS = { Dance: 4000 };

function textSprite(draw, w, h, worldH) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d'); draw(ctx, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false }));
  s.scale.set(worldH * w / h, worldH, 1); s.renderOrder = 10; return s;
}

export class Avatar {
  constructor(gltf, { name, hue }) {
    this.root = new THREE.Group();
    this.model = SkeletonUtils.clone(gltf.scene);
    // Measure the *original* scene once (a detached clone has stale bone matrices => wrong bounds).
    if (!gltf.userData.fit) { const b = new THREE.Box3().setFromObject(gltf.scene, true); gltf.userData.fit = { k: HEIGHT / (b.max.y - b.min.y), minY: b.min.y }; }
    const { k, minY } = gltf.userData.fit;
    this.model.scale.setScalar(k); this.model.position.y = -minY * k;
    const tint = new THREE.Color().setHSL(hue / 360, 0.7, 0.55);
    this.model.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = true; o.frustumCulled = false;
      o.material = o.material.clone();
      if (o.material.name === 'Main') o.material.color.copy(tint);
    });
    this.root.add(this.model);
    this.mixer = new THREE.AnimationMixer(this.model);
    this.actions = {};
    for (const clip of gltf.animations) {
      const a = this.mixer.clipAction(clip);
      if (!LOOPING.has(clip.name)) { a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; }
      this.actions[clip.name] = a;
    }
    this.cur = null; this.base = 'Idle'; this.emote = null; this.emoteUntil = 0; this.jumping = false;
    this.play('Idle');
    this.setName(name);
    this.bubble = null; this.bubbleUntil = 0;
  }
  setName(name) {
    if (this.label) this.root.remove(this.label);
    this.label = textSprite((x, w, h) => {
      x.font = 'bold 40px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.lineWidth = 8; x.strokeStyle = '#000'; x.strokeText(name, w / 2, h / 2); x.fillStyle = '#fff'; x.fillText(name, w / 2, h / 2);
    }, 256, 64, 0.35);
    this.label.position.y = HEIGHT + 0.35; this.root.add(this.label);
  }
  say(text) {
    if (this.bubble) this.root.remove(this.bubble);
    const t = text.length > 60 ? text.slice(0, 57) + '…' : text;
    this.bubble = textSprite((x, w, h) => {
      x.font = '34px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillStyle = '#fff'; x.beginPath(); x.roundRect(4, 4, w - 8, h - 8, 24); x.fill();
      x.fillStyle = '#111'; x.fillText(t, w / 2, h / 2, w - 30);
    }, 512, 80, 0.5);
    this.bubble.position.y = HEIGHT + 0.85; this.root.add(this.bubble); this.bubbleUntil = performance.now() + 5000;
  }
  play(name, fade = 0.2) {
    const next = this.actions[name]; if (!next || this.cur === name) return;
    const prev = this.actions[this.cur];
    next.reset().setEffectiveWeight(1).play();
    if (prev) prev.crossFadeTo(next, fade, false);
    this.cur = name;
  }
  /** Locomotion state from physics: 'idle' | 'walk' | 'run' | 'jump' */
  setLocomotion(s) { this.jumping = s === 'jump'; this.base = s === 'run' ? 'Running' : s === 'walk' ? 'Walking' : 'Idle'; }
  playEmote(clip) { if (!this.actions[clip]) return; this.emote = clip; this.emoteUntil = performance.now() + (EMOTE_MS[clip] || this.actions[clip].getClip().duration * 1000 + 300); this.cur = null; this.play(clip, 0.15); }
  update(dt) {
    const now = performance.now();
    if (this.emote && (now > this.emoteUntil || this.base !== 'Idle' || this.jumping)) this.emote = null;
    const want = this.jumping ? 'Jump' : this.emote || this.base;
    this.play(want);
    this.mixer.update(dt);
    if (this.bubble && now > this.bubbleUntil) { this.root.remove(this.bubble); this.bubble = null; }
  }
}

export function hueFor(str) { let h = 0; for (const c of str) h = (h * 31 + c.codePointAt(0)) % 360; return h; }
