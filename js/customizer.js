// Gather Holidays 3D - Roblox-Style Avatar Customization System
// Includes Body (Skin per limb, Heads, Dynamic Heads, Hair, Faces, Scaling)
// and Clothing (3D Layered Clothing & 2D Classic Clothing) with Real-time 3D Preview.

import * as THREE from 'three';
import { Avatar } from './avatar.js';
import { CASINO_SHOP_ITEMS, getInventory } from './casino.js';

// ============================================================================
// 1. DATA CATALOG & COLOR PALETTES
// ============================================================================

export const ROBLOX_PALETTE = [
  { name: 'Vàng Roblox (Noob)', hex: '#f5cd30' },
  { name: 'Xanh Lam (Noob)', hex: '#0d69ac' },
  { name: 'Xanh Lá (Noob)', hex: '#5b9c37' },
  { name: 'Da Trắng Hồng', hex: '#ffdbb5' },
  { name: 'Da Trắng Sáng', hex: '#f8d4bc' },
  { name: 'Da Bánh Mật', hex: '#b47a50' },
  { name: 'Da Socola Đậm', hex: '#56341f' },
  { name: 'Đỏ Rực Rỡ', hex: '#dc2626' },
  { name: 'Tím Neon Quý Tộc', hex: '#a855f7' },
  { name: 'Hồng Kẹo Ngọt', hex: '#f43f5e' },
  { name: 'Xanh Troll / Goblin', hex: '#10b981' },
  { name: 'Xanh Cyan Tương Lai', hex: '#06b6d4' },
  { name: 'Cam Nắng Chiều', hex: '#ea580c' },
  { name: 'Đen Huyền Bí', hex: '#1e293b' },
  { name: 'Xám Kim Loại', hex: '#64748b' },
  { name: 'Trắng Tuyết', hex: '#f8fafc' },
];

export const HAIR_COLORS = [
  { name: 'Đen Tuyền', hex: '#18181b' },
  { name: 'Nâu Hạt Dẻ', hex: '#543310' },
  { name: 'Vàng Kim Anime', hex: '#facc15' },
  { name: 'Bạch Kim Băng Giá', hex: '#e2e8f0' },
  { name: 'Hồng Pastel', hex: '#f472b6' },
  { name: 'Đỏ Rực Lửa', hex: '#e11d48' },
  { name: 'Xanh Neon Cyber', hex: '#06b6d4' },
  { name: 'Tím Ma Thuật', hex: '#9333ea' },
];

export const HEAD_TYPES = [
  { id: 'classic', name: 'Đầu Vuông Classic', icon: '🧱', desc: 'Đầu khối hộp bo góc kinh điển Roblox R6' },
  { id: 'round', name: 'Đầu Tròn Chibi', icon: '👦', desc: 'Đầu bo tròn mềm mại phong cách Chibi' },
  { id: 'dynamic', name: 'Đầu Động (Dynamic)', icon: '✨', desc: 'Cử động chớp mắt & chuyển động cơ mặt sinh động' },
];

export const CLASSIC_FACES = [
  { id: 'default', name: 'Mắt Mũi 3D', icon: '😊', desc: 'Mắt tròn 3D và má hồng nguyên bản' },
  { id: 'smile', name: 'Classic Smile', icon: '🙂', desc: 'Nụ cười kinh điển Roblox huyền thoại từ 2006' },
  { id: 'man', name: 'Man Face (Bảnh)', icon: '😏', desc: 'Khuôn mặt lãng tử nam tính siêu viral 😎' },
  { id: 'troll', name: 'Troll Face', icon: '🤪', desc: 'Nụ cười trêu chọc nghịch ngợm kinh điển' },
  { id: 'chills', name: 'Winning Smile', icon: '😁', desc: 'Nụ cười tự tin rạng rỡ hở răng trắng sáng' },
  { id: 'joy', name: 'Cười Tít Mắt', icon: '😄', desc: 'Khuôn mặt híp mắt cười hạnh phúc siêu đáng yêu' },
  { id: 'checkit', name: 'Check It', icon: '😉', desc: 'Nháy mắt tinh nghịch tự tin đầy cá tính' },
  { id: 'silly', name: 'Thè Lưỡi Hài', icon: '😛', desc: 'Thè lưỡi mắt to mắt nhỏ siêu nhí nhố' },
  { id: 'sinister', name: 'Cười Nham Hiểm', icon: '😈', desc: 'Mặt cười ma quái nham hiểm bí ẩn' },
];

export const HAIR_STYLES = [
  { id: 'classic_part', name: 'Tóc Nhựa Chẻ Ngôi', type: 'classic', icon: '💇', desc: 'Tóc khối nhựa chẻ ngôi retro' },
  { id: 'spiky', name: 'Tóc Nhựa Gai Nhọn', type: 'classic', icon: '🦔', desc: 'Tóc gai nhọn mảng khối Anime Shonen' },
  { id: 'boy_messy', name: 'Tóc Nhựa Rối Mái', type: 'classic', icon: '🧑', desc: 'Tóc mảng đánh rối lãng tử' },
  { id: 'ponytail', name: 'Tóc Nhựa Đuôi Ngựa', type: 'classic', icon: '👱‍♀️', desc: 'Tóc buộc cao năng động cá tính' },
  { id: 'layered_curls', name: 'Tóc Xoăn 3D Layered', type: 'layered', icon: '✨', desc: 'Tóc sợi 3D uốn xoăn bồng bềnh nhiều lớp' },
  { id: 'layered_waves', name: 'Tóc Dài 3D Layered', type: 'layered', icon: '🌊', desc: 'Tóc sợi 3D gợn sóng buông vai mềm mại' },
  { id: 'layered_cyber', name: 'Tóc Layer Cyberpunk', type: 'layered', icon: '⚡', desc: 'Tóc tỉa layer 3D tương lai line màu nổi' },
  { id: 'none', name: 'Đầu Trọc Bóng', type: 'none', icon: '🧑‍🦲', desc: 'Không đội tóc phong cách Noob' },
];

export const BODY_SCALE_PRESETS = [
  { id: 'classic', name: 'Chuẩn R6 / R15', icon: '⚖️', scale: { height: 1.0, width: 1.0, depth: 1.0, head: 1.0 } },
  { id: 'slender', name: 'Cao Gầy (Slender)', icon: '🧍', scale: { height: 1.18, width: 0.85, depth: 0.85, head: 0.95 } },
  { id: 'buff', name: 'Cơ Bắp (Buff)', icon: '💪', scale: { height: 1.08, width: 1.32, depth: 1.25, head: 1.0 } },
  { id: 'chibi', name: 'Chibi Hạt Tiêu', icon: '👶', scale: { height: 0.82, width: 0.95, depth: 0.95, head: 1.28 } },
  { id: 'cartoon', name: 'Hoạt Hình (Cartoon)', icon: '🎨', scale: { height: 1.1, width: 1.15, depth: 1.0, head: 1.15 } },
];

// Layered Clothing (3D co giãn)
export const LAYERED_ITEMS = {
  jackets: [
    { id: 'none', name: 'Không Mặc', icon: '🚫' },
    { id: 'leather_jacket', name: 'Áo Khoác Da Biker 3D', icon: '🧥', desc: 'Áo da đen bóng ve áo kim loại sang trọng' },
    { id: 'bomber_jacket', name: 'Áo Bomber Streetwear', icon: '🔴', desc: 'Áo gió dù bo gấu đỏ phối trắng nổi bật' },
    { id: 'winter_parka', name: 'Áo Phao Lông Cừu Đại Hàn', icon: '❄️', desc: 'Áo phao mùa đông cổ lông cừu ấm áp' },
  ],
  sweaters: [
    { id: 'none', name: 'Không Mặc', icon: '🚫' },
    { id: 'xmas_sweater', name: 'Áo Len Giáng Sinh 3D', icon: '🎄', desc: 'Áo len đỏ dệt hoa tuyết Giáng Sinh ấm cúng' },
    { id: 'turtleneck', name: 'Áo Len Cổ Lọ Màu Be', icon: '🧶', desc: 'Áo len cổ lọ dệt kim thanh lịch' },
  ],
  shirts3d: [
    { id: 'none', name: 'Không Mặc', icon: '🚫' },
    { id: 'hoodie_3d', name: 'Áo Hoodie Mũ Trùm 3D', icon: '🛹', desc: 'Hoodie nỉ form rộng có mũ trùm sau lưng' },
    { id: 'denim_vest', name: 'Áo Gile Bò Denim', icon: '🤠', desc: 'Áo gile jean phong trần đường phố' },
  ],
  pants3d: [
    { id: 'none', name: 'Không Mặc', icon: '🚫' },
    { id: 'cargo_pants', name: 'Quần Túi Hộp Cargo 3D', icon: '👖', desc: 'Quần túi hộp hầm hố có 2 túi phồng bên đùi' },
    { id: 'baggy_jeans', name: 'Quần Bò Ống Rộng 3D', icon: '🛹', desc: 'Quần jean thụng streetwear thời thượng' },
  ],
  skirts: [
    { id: 'none', name: 'Không Mặc', icon: '🚫' },
    { id: 'pleated_skirt', name: 'Chân Váy Xếp Ly Nhật Bản', icon: '👗', desc: 'Váy ngắn xếp ly nữ sinh xòe tự nhiên' },
    { id: 'princess_dress', name: 'Váy Dạ Hội Công Chúa 3D', icon: '👑', desc: 'Váy dài xòe bồng bềnh lộng lẫy' },
  ],
  shoes3d: [
    { id: 'none', name: 'Mặc Định', icon: '👞' },
    { id: 'sneakers_chunky', name: 'Giày Thể Thao Chunky 3D', icon: '👟', desc: 'Sneaker đế bánh mì hầm hố cá tính' },
    { id: 'combat_boots', name: 'Bốt Quân Đội Da Bóng 3D', icon: '🥾', desc: 'Giày bốt cao cổ dây thắt da bóng' },
    { id: 'classic_slipon', name: 'Giày Lười Trắng Năng Động', icon: '🤍', desc: 'Giày lười trắng canvas năng động' },
  ],
};

// Classic Clothing (2D dán truyền thống)
export const CLASSIC_ITEMS = {
  shirts: [
    { id: 'none', name: 'Mặc Định (Theo màu da/áo)', icon: '👕' },
    { id: 'noob_shirt', name: 'Áo Noob Roblox 2006', icon: '🟡', desc: 'Áo xanh lam kinh điển của Roblox Noob' },
    { id: 'tuxedo', name: 'Áo Tuxedo Cà Vạt Lịch Lãm', icon: '🤵', desc: 'Bộ vest comple đen nơ cổ sang trọng' },
    { id: 'striped_polo', name: 'Áo Polo Sọc Ngang Retro', icon: '👔', desc: 'Áo polo cam trắng cổ điển' },
    { id: 'cyber_neon', name: 'Áo Mạch Điện Cyber Neon', icon: '⚡', desc: 'Áo đen vi mạch phát sáng công nghệ' },
  ],
  pants: [
    { id: 'none', name: 'Mặc Định', icon: '🩳' },
    { id: 'noob_pants', name: 'Quần Noob Xanh Lá', icon: '🟢', desc: 'Quần xanh lá cây Roblox Noob kinh điển' },
    { id: 'ripped_jeans', name: 'Quần Jeans Rách Gối', icon: '👖', desc: 'Quần jean xanh rách gối bụi bặm' },
    { id: 'black_slacks', name: 'Quần Âu Đen Công Sở', icon: '🖤', desc: 'Quần tây phẳng phiu đứng dáng' },
  ],
  tshirts: [
    { id: 'none', name: 'Không Dán Decal', icon: '🚫' },
    { id: 'roblox_logo', name: 'Logo Chữ R Roblox', icon: '🟥', desc: 'Logo chữ R đỏ nghiêng huyền thoại 2006' },
    { id: 'doge', name: 'Meme Chó Vàng Doge', icon: '🐕', desc: 'Doge hài hước "Much festive, very swag"' },
    { id: 'flame_heart', name: 'Trái Tim Rực Lửa Y2K', icon: '🔥', desc: 'Họa tiết trái tim lửa cháy bập bùng' },
    { id: 'supreme', name: 'Hộp Đỏ Supreme', icon: '🔴', desc: 'Box logo Supreme đỏ thời thượng' },
    { id: 'pikachu', name: 'Mặt Chuột Điện Vàng', icon: '⚡', desc: 'Mặt cười má đỏ đáng yêu' },
  ],
};

// ============================================================================
// 2. DEFAULT STATE & LOCAL STORAGE
// ============================================================================

export function getDefaultAvatarConfig() {
  return {
    skinMode: 'all', // 'all' | 'limbs'
    skin: {
      all: '#f5cd30',      // Roblox Noob yellow default or fair
      head: '#f5cd30',
      torso: '#0d69ac',    // Noob blue shirt
      leftArm: '#f5cd30',
      rightArm: '#f5cd30',
      leftLeg: '#5b9c37',  // Noob green legs
      rightLeg: '#5b9c37',
    },
    headType: 'classic',   // 'classic' | 'round' | 'dynamic'
    classicFace: 'smile',  // 'default' | 'smile' | 'man' | 'troll' | 'chills' | ...
    hairStyle: 'classic_part',
    hairColor: '#543310',
    bodyScale: {
      preset: 'classic',
      height: 1.0,
      width: 1.0,
      depth: 1.0,
      head: 1.0,
    },
    layered: {
      jacket: 'none',
      sweater: 'none',
      shirt3d: 'none',
      pants3d: 'none',
      skirt: 'none',
      shoes3d: 'none',
    },
    classic: {
      shirt: 'noob_shirt',
      pants: 'noob_pants',
      tshirt: 'roblox_logo',
    },
    // Accessories from boutique/casino if equipped
    accessory: null,
    aura: null,
  };
}

export function loadSavedAvatarConfig() {
  try {
    const raw = localStorage.getItem('gh_custom_avatar');
    if (!raw) return getDefaultAvatarConfig();
    const parsed = JSON.parse(raw);
    const def = getDefaultAvatarConfig();
    return {
      ...def,
      ...parsed,
      skin: { ...def.skin, ...(parsed.skin || {}) },
      bodyScale: { ...def.bodyScale, ...(parsed.bodyScale || {}) },
      layered: { ...def.layered, ...(parsed.layered || {}) },
      classic: { ...def.classic, ...(parsed.classic || {}) },
    };
  } catch (e) {
    console.warn('Failed to parse saved avatar config:', e);
    return getDefaultAvatarConfig();
  }
}

export function saveAvatarConfig(cfg) {
  try {
    localStorage.setItem('gh_custom_avatar', JSON.stringify(cfg));
  } catch (e) {
    console.error('Failed to save avatar config:', e);
  }
}

// ============================================================================
// 3. 3D LIVE PREVIEW CONTROLLER
// ============================================================================

export class Avatar3DPreview {
  constructor(canvasEl) {
    this.canvas = canvasEl;
    this.width = canvasEl.clientWidth || 320;
    this.height = canvasEl.clientHeight || 420;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(36, this.width / this.height, 0.1, 50);
    this.camera.position.set(0, 1.15, 3.4);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
    });
    this.renderer.setSize(this.width, this.height, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    // Lights
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x334155, 1.4);
    this.scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xfff5ea, 1.6);
    dirLight.position.set(2, 4, 3);
    this.scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.6);
    fillLight.position.set(-3, 2, -1);
    this.scene.add(fillLight);

    // Pedestal floor disc
    const discGeo = new THREE.CylinderGeometry(0.9, 0.95, 0.06, 32);
    const discMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.6,
      roughness: 0.3,
    });
    const disc = new THREE.Mesh(discGeo, discMat);
    disc.position.y = -0.03;
    this.scene.add(disc);

    // Rotating Pedestal Ring
    const ringGeo = new THREE.RingGeometry(0.82, 0.88, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.005;
    this.scene.add(ring);

    // Avatar preview instance
    this.avatar = new Avatar(null, { name: 'Preview', hue: 200, costume: 'default' });
    this.avatar.label.visible = false;
    this.scene.add(this.avatar.root);

    // Interactive Drag to Rotate
    this.rotationY = 0;
    this.autoRotate = true;
    this.isDragging = false;
    this.lastPointerX = 0;
    this.clock = new THREE.Clock();

    this.bindEvents();
    this.running = false;
    this.rafId = null;
  }

  bindEvents() {
    const onDown = (e) => {
      this.isDragging = true;
      this.autoRotate = false;
      this.lastPointerX = e.clientX || e.touches?.[0]?.clientX || 0;
    };
    const onMove = (e) => {
      if (!this.isDragging) return;
      const x = e.clientX || e.touches?.[0]?.clientX || 0;
      const dx = x - this.lastPointerX;
      this.lastPointerX = x;
      this.rotationY += dx * 0.015;
      if (this.avatar) {
        this.avatar.root.rotation.y = this.rotationY;
      }
    };
    const onUp = () => {
      this.isDragging = false;
    };

    this.canvas.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);

    this.canvas.addEventListener('touchstart', onDown, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onUp, { passive: true });
  }

  resize() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (w && h && (w !== this.width || h !== this.height)) {
      this.width = w;
      this.height = h;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h, false);
    }
  }

  applyConfig(cfg) {
    if (this.avatar?.applyCustomization) {
      this.avatar.applyCustomization(cfg);
    }
  }

  playEmote(emote) {
    if (this.avatar?.playEmote) {
      this.avatar.playEmote(emote, true);
    }
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.clock.start();
    const loop = () => {
      if (!this.running) return;
      const dt = this.clock.getDelta();
      this.resize();

      if (this.autoRotate && !this.isDragging && this.avatar) {
        this.rotationY += dt * 0.45;
        this.avatar.root.rotation.y = this.rotationY;
      }

      if (this.avatar?.update) {
        this.avatar.update(dt);
      }

      this.renderer.render(this.scene, this.camera);
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  destroy() {
    this.stop();
    this.renderer.dispose();
  }
}

// ============================================================================
// 4. MODAL UI CONTROLLER (CUSTOMIZER DIALOG)
// ============================================================================

export class AvatarCustomizerModal {
  constructor({ onApply }) {
    this.onApply = onApply || (() => {});
    this.config = loadSavedAvatarConfig();
    this.activeMainTab = 'body';       // 'body' | 'clothing'
    this.activeBodyTab = 'skin';       // 'skin' | 'heads' | 'hair' | 'scale'
    this.activeClothingTab = 'layered'; // 'layered' | 'classic'
    this.selectedLimb = 'all';         // 'all' | 'head' | 'torso' | 'leftArm' | 'rightArm' | 'leftLeg' | 'rightLeg'

    this.dlg = document.getElementById('dlgCustomizeAvatar');
    this.preview = null;
    this.initDOM();
  }

  initDOM() {
    if (!this.dlg) return;
    const canvas = this.dlg.querySelector('#avatarPreviewCanvas');
    if (canvas) {
      this.preview = new Avatar3DPreview(canvas);
      this.preview.applyConfig(this.config);
    }
    this.bindUIEvents();
  }

  open() {
    this.config = loadSavedAvatarConfig();
    if (this.dlg) {
      this.dlg.classList.remove('hidden');
    }
    this.preview?.start();
    this.preview?.applyConfig(this.config);
    this.renderTabs();
    this.renderContent();
  }

  close() {
    if (this.dlg) {
      this.dlg.classList.add('hidden');
    }
    this.preview?.stop();
  }

  bindUIEvents() {
    if (!this.dlg) return;

    // Close button
    this.dlg.querySelectorAll('[data-custom-close]').forEach((btn) => {
      btn.onclick = () => this.close();
    });

    // Save & Wear button
    const btnSave = this.dlg.querySelector('#btnSaveCustomize');
    if (btnSave) {
      btnSave.onclick = () => {
        saveAvatarConfig(this.config);
        this.onApply(this.config);
        this.close();
        if (typeof window.toast === 'function') {
          window.toast('✨ Đã khoác lên người trang phục mới thành công!');
        }
      };
    }

    // Randomize button
    const btnRandom = this.dlg.querySelector('#btnRandomCustomize');
    if (btnRandom) {
      btnRandom.onclick = () => this.randomize();
    }

    // Reset button
    const btnReset = this.dlg.querySelector('#btnResetCustomize');
    if (btnReset) {
      btnReset.onclick = () => {
        this.config = getDefaultAvatarConfig();
        this.preview?.applyConfig(this.config);
        this.renderContent();
      };
    }

    // Preview rotation controls
    const btnRotL = this.dlg.querySelector('#btnPreviewRotLeft');
    if (btnRotL) {
      btnRotL.onclick = () => {
        this.preview.autoRotate = false;
        this.preview.rotationY -= 0.6;
        if (this.preview.avatar) this.preview.avatar.root.rotation.y = this.preview.rotationY;
      };
    }
    const btnRotR = this.dlg.querySelector('#btnPreviewRotRight');
    if (btnRotR) {
      btnRotR.onclick = () => {
        this.preview.autoRotate = false;
        this.preview.rotationY += 0.6;
        if (this.preview.avatar) this.preview.avatar.root.rotation.y = this.preview.rotationY;
      };
    }
    const btnRotAuto = this.dlg.querySelector('#btnPreviewAutoRot');
    if (btnRotAuto) {
      btnRotAuto.onclick = () => {
        this.preview.autoRotate = !this.preview.autoRotate;
        btnRotAuto.classList.toggle('active', this.preview.autoRotate);
      };
    }

    // Preview Pose Emotes
    this.dlg.querySelectorAll('[data-preview-emote]').forEach((btn) => {
      btn.onclick = () => {
        const em = btn.getAttribute('data-preview-emote');
        this.preview?.playEmote(em);
      };
    });
  }

  renderTabs() {
    const mainTabBody = this.dlg.querySelector('#tabMainBody');
    const mainTabCloth = this.dlg.querySelector('#tabMainClothing');
    const subTabsBody = this.dlg.querySelector('#subTabsBody');
    const subTabsClothing = this.dlg.querySelector('#subTabsClothing');

    if (mainTabBody && mainTabCloth) {
      mainTabBody.classList.toggle('active', this.activeMainTab === 'body');
      mainTabCloth.classList.toggle('active', this.activeMainTab === 'clothing');
      if (subTabsBody) subTabsBody.classList.toggle('hidden', this.activeMainTab !== 'body');
      if (subTabsClothing) subTabsClothing.classList.toggle('hidden', this.activeMainTab !== 'clothing');

      mainTabBody.onclick = () => {
        this.activeMainTab = 'body';
        this.renderTabs();
        this.renderContent();
      };
      mainTabCloth.onclick = () => {
        this.activeMainTab = 'clothing';
        this.renderTabs();
        this.renderContent();
      };
    }

    // Sub tabs for Body
    this.dlg.querySelectorAll('[data-body-tab]').forEach((btn) => {
      const tab = btn.getAttribute('data-body-tab');
      btn.classList.toggle('active', this.activeBodyTab === tab);
      btn.onclick = () => {
        this.activeBodyTab = tab;
        this.renderTabs();
        this.renderContent();
      };
    });

    // Sub tabs for Clothing
    this.dlg.querySelectorAll('[data-clothing-tab]').forEach((btn) => {
      const tab = btn.getAttribute('data-clothing-tab');
      btn.classList.toggle('active', this.activeClothingTab === tab);
      btn.onclick = () => {
        this.activeClothingTab = tab;
        this.renderTabs();
        this.renderContent();
      };
    });
  }

  renderContent() {
    const container = this.dlg.querySelector('#customizeTabContent');
    if (!container) return;
    container.innerHTML = '';

    if (this.activeMainTab === 'body') {
      if (this.activeBodyTab === 'skin') this.renderSkinTab(container);
      else if (this.activeBodyTab === 'heads') this.renderHeadsTab(container);
      else if (this.activeBodyTab === 'hair') this.renderHairTab(container);
      else if (this.activeBodyTab === 'scale') this.renderScaleTab(container);
    } else {
      if (this.activeClothingTab === 'layered') this.renderLayeredClothingTab(container);
      else if (this.activeClothingTab === 'classic') this.renderClassicClothingTab(container);
    }
  }

  // A1. Skin (Màu da theo từng bộ phận)
  renderSkinTab(c) {
    const wrap = document.createElement('div');
    wrap.className = 'custom-section';
    wrap.innerHTML = `
      <div class="custom-sec-header">
        <h4>🎨 Màu Da Nhân Vật (Roblox Skin Palette)</h4>
        <p class="hint">Chọn đổi màu toàn thân (All) hoặc đổi màu da riêng cho từng bộ phận (Đầu, Tay, Thân, Chân).</p>
      </div>
      <div class="limb-picker-bar">
        <button class="limb-chip ${this.selectedLimb === 'all' ? 'active' : ''}" data-limb="all">Toàn Thân (All)</button>
        <button class="limb-chip ${this.selectedLimb === 'head' ? 'active' : ''}" data-limb="head">Đầu</button>
        <button class="limb-chip ${this.selectedLimb === 'torso' ? 'active' : ''}" data-limb="torso">Thân</button>
        <button class="limb-chip ${this.selectedLimb === 'leftArm' ? 'active' : ''}" data-limb="leftArm">Tay Trái</button>
        <button class="limb-chip ${this.selectedLimb === 'rightArm' ? 'active' : ''}" data-limb="rightArm">Tay Phải</button>
        <button class="limb-chip ${this.selectedLimb === 'leftLeg' ? 'active' : ''}" data-limb="leftLeg">Chân Trái</button>
        <button class="limb-chip ${this.selectedLimb === 'rightLeg' ? 'active' : ''}" data-limb="rightLeg">Chân Phải</button>
      </div>
      <div class="color-swatch-grid" id="skinSwatchGrid"></div>
    `;

    wrap.querySelectorAll('.limb-chip').forEach((btn) => {
      btn.onclick = () => {
        this.selectedLimb = btn.getAttribute('data-limb');
        this.renderSkinTab(c);
      };
    });

    const grid = wrap.querySelector('#skinSwatchGrid');
    const curColor = this.selectedLimb === 'all' ? this.config.skin.all : (this.config.skin[this.selectedLimb] || this.config.skin.all);

    ROBLOX_PALETTE.forEach((item) => {
      const sw = document.createElement('button');
      sw.className = `color-swatch ${curColor.toLowerCase() === item.hex.toLowerCase() ? 'selected' : ''}`;
      sw.style.backgroundColor = item.hex;
      sw.title = item.name;
      sw.innerHTML = `<span class="swatch-check">✓</span>`;
      sw.onclick = () => {
        if (this.selectedLimb === 'all') {
          this.config.skin.all = item.hex;
          this.config.skin.head = item.hex;
          this.config.skin.torso = item.hex;
          this.config.skin.leftArm = item.hex;
          this.config.skin.rightArm = item.hex;
          this.config.skin.leftLeg = item.hex;
          this.config.skin.rightLeg = item.hex;
        } else {
          this.config.skin[this.selectedLimb] = item.hex;
        }
        this.preview?.applyConfig(this.config);
        this.renderSkinTab(c);
      };
      grid.appendChild(sw);
    });

    c.appendChild(wrap);
  }

  // A2. Heads & Classic Faces (Đầu & Khuôn mặt)
  renderHeadsTab(c) {
    const wrap = document.createElement('div');
    wrap.className = 'custom-section';
    wrap.innerHTML = `
      <div class="custom-sec-header">
        <h4>👦 Kiểu Đầu (Classic / Chibi / Dynamic)</h4>
        <p class="hint">Đầu vuông Classic hoài niệm hoặc Đầu Động (Dynamic Head) cử động nháy mắt biểu cảm.</p>
      </div>
      <div class="item-card-grid" id="headTypeGrid"></div>

      <div class="custom-sec-header" style="margin-top:20px">
        <h4>🎭 Khuôn Mặt 2D Truyền Thống (Classic Faces)</h4>
        <p class="hint">Bộ sưu tập khuôn mặt 2D dán huyền thoại của Roblox (Smile, Man Face, Troll, Winning Smile...).</p>
      </div>
      <div class="item-card-grid" id="facesGrid"></div>
    `;

    // Render Head Types
    const hGrid = wrap.querySelector('#headTypeGrid');
    HEAD_TYPES.forEach((h) => {
      const card = document.createElement('button');
      card.className = `custom-card ${this.config.headType === h.id ? 'active' : ''}`;
      card.innerHTML = `
        <div class="card-icon">${h.icon}</div>
        <div class="card-name">${h.name}</div>
        <div class="card-desc">${h.desc}</div>
      `;
      card.onclick = () => {
        this.config.headType = h.id;
        this.preview?.applyConfig(this.config);
        this.renderHeadsTab(c);
      };
      hGrid.appendChild(card);
    });

    // Render Classic Faces
    const fGrid = wrap.querySelector('#facesGrid');
    CLASSIC_FACES.forEach((f) => {
      const card = document.createElement('button');
      card.className = `custom-card ${this.config.classicFace === f.id ? 'active' : ''}`;
      card.innerHTML = `
        <div class="card-icon">${f.icon}</div>
        <div class="card-name">${f.name}</div>
        <div class="card-desc">${f.desc}</div>
      `;
      card.onclick = () => {
        this.config.classicFace = f.id;
        this.preview?.applyConfig(this.config);
        this.renderHeadsTab(c);
      };
      fGrid.appendChild(card);
    });

    c.appendChild(wrap);
  }

  // A3. Hair (Tóc nhựa mảng & Tóc sợi 3D Layered)
  renderHairTab(c) {
    const wrap = document.createElement('div');
    wrap.className = 'custom-section';
    wrap.innerHTML = `
      <div class="custom-sec-header">
        <h4>💇 Kiểu Tóc (Molded Plastic Hair & 3D Layered Hair)</h4>
        <p class="hint">Tóc nhựa mảng khối truyền thống hoặc tóc sợi 3D Layered mềm mại.</p>
      </div>
      <div class="item-card-grid" id="hairStyleGrid"></div>

      <div class="custom-sec-header" style="margin-top:20px">
        <h4>🎨 Màu Tóc (Hair Color)</h4>
        <p class="hint">Nhuộm màu tóc cho nhân vật.</p>
      </div>
      <div class="color-swatch-grid" id="hairColorGrid"></div>
    `;

    // Render Hair Styles
    const hGrid = wrap.querySelector('#hairStyleGrid');
    HAIR_STYLES.forEach((h) => {
      const card = document.createElement('button');
      card.className = `custom-card ${this.config.hairStyle === h.id ? 'active' : ''}`;
      card.innerHTML = `
        <div class="card-icon">${h.icon}</div>
        <div class="card-name">${h.name}</div>
        <div class="card-desc">${h.desc}</div>
      `;
      card.onclick = () => {
        this.config.hairStyle = h.id;
        this.preview?.applyConfig(this.config);
        this.renderHairTab(c);
      };
      hGrid.appendChild(card);
    });

    // Render Hair Colors
    const hcGrid = wrap.querySelector('#hairColorGrid');
    HAIR_COLORS.forEach((item) => {
      const sw = document.createElement('button');
      sw.className = `color-swatch ${this.config.hairColor.toLowerCase() === item.hex.toLowerCase() ? 'selected' : ''}`;
      sw.style.backgroundColor = item.hex;
      sw.title = item.name;
      sw.innerHTML = `<span class="swatch-check">✓</span>`;
      sw.onclick = () => {
        this.config.hairColor = item.hex;
        this.preview?.applyConfig(this.config);
        this.renderHairTab(c);
      };
      hcGrid.appendChild(sw);
    });

    c.appendChild(wrap);
  }

  // A4. Khung cơ thể & Tỷ lệ Scaling (Torso, Arms, Legs)
  renderScaleTab(c) {
    const wrap = document.createElement('div');
    wrap.className = 'custom-section';
    wrap.innerHTML = `
      <div class="custom-sec-header">
        <h4>📏 Khung Cơ Thể (Body Proportions & Presets)</h4>
        <p class="hint">Thay đổi phom dáng: Cao gầy (Slender), Cơ bắp (Buff), Chibi bé hạt tiêu hoặc chuẩn R6.</p>
      </div>
      <div class="item-card-grid" id="scalePresetsGrid"></div>

      <div class="sliders-box" style="margin-top:20px">
        <label>
          <div class="slider-row-header">
            <span>Chiều cao (Height)</span>
            <b id="lblValHeight">${Math.round(this.config.bodyScale.height * 100)}%</b>
          </div>
          <input id="sliderHeight" type="range" min="80" max="130" value="${Math.round(this.config.bodyScale.height * 100)}">
        </label>
        <label>
          <div class="slider-row-header">
            <span>Bề ngang / Độ rộng (Width)</span>
            <b id="lblValWidth">${Math.round(this.config.bodyScale.width * 100)}%</b>
          </div>
          <input id="sliderWidth" type="range" min="70" max="140" value="${Math.round(this.config.bodyScale.width * 100)}">
        </label>
        <label>
          <div class="slider-row-header">
            <span>Độ dày ngực / Bắp thịt (Depth)</span>
            <b id="lblValDepth">${Math.round(this.config.bodyScale.depth * 100)}%</b>
          </div>
          <input id="sliderDepth" type="range" min="70" max="135" value="${Math.round(this.config.bodyScale.depth * 100)}">
        </label>
        <label>
          <div class="slider-row-header">
            <span>Tỉ lệ Đầu (Head Scale)</span>
            <b id="lblValHead">${Math.round(this.config.bodyScale.head * 100)}%</b>
          </div>
          <input id="sliderHead" type="range" min="80" max="135" value="${Math.round(this.config.bodyScale.head * 100)}">
        </label>
      </div>
    `;

    // Presets
    const pGrid = wrap.querySelector('#scalePresetsGrid');
    BODY_SCALE_PRESETS.forEach((p) => {
      const card = document.createElement('button');
      card.className = `custom-card ${this.config.bodyScale.preset === p.id ? 'active' : ''}`;
      card.innerHTML = `
        <div class="card-icon">${p.icon}</div>
        <div class="card-name">${p.name}</div>
      `;
      card.onclick = () => {
        this.config.bodyScale = { ...p.scale, preset: p.id };
        this.preview?.applyConfig(this.config);
        this.renderScaleTab(c);
      };
      pGrid.appendChild(card);
    });

    // Sliders event binding
    const updateSlider = (id, lblId, key) => {
      const sl = wrap.querySelector(id);
      const lb = wrap.querySelector(lblId);
      if (sl && lb) {
        sl.oninput = () => {
          const val = parseFloat(sl.value) / 100;
          this.config.bodyScale[key] = val;
          this.config.bodyScale.preset = 'custom';
          lb.textContent = `${sl.value}%`;
          this.preview?.applyConfig(this.config);
        };
      }
    };
    updateSlider('#sliderHeight', '#lblValHeight', 'height');
    updateSlider('#sliderWidth', '#lblValWidth', 'width');
    updateSlider('#sliderDepth', '#lblValDepth', 'depth');
    updateSlider('#sliderHead', '#lblValHead', 'head');

    c.appendChild(wrap);
  }

  // B1. Layered Clothing (Trang phục 3D co giãn nhiều lớp)
  renderLayeredClothingTab(c) {
    const wrap = document.createElement('div');
    wrap.className = 'custom-section';

    const renderCategory = (title, hint, catKey, items) => {
      const sec = document.createElement('div');
      sec.className = 'clothing-cat-group';
      sec.innerHTML = `
        <div class="custom-sec-header">
          <h4>${title}</h4>
          <p class="hint">${hint}</p>
        </div>
        <div class="item-card-grid"></div>
      `;
      const grid = sec.querySelector('.item-card-grid');
      items.forEach((it) => {
        const card = document.createElement('button');
        const isEquipped = (this.config.layered[catKey] || 'none') === it.id;
        card.className = `custom-card ${isEquipped ? 'active' : ''}`;
        card.innerHTML = `
          <div class="card-icon">${it.icon}</div>
          <div class="card-name">${it.name}</div>
          ${it.desc ? `<div class="card-desc">${it.desc}</div>` : ''}
        `;
        card.onclick = () => {
          this.config.layered[catKey] = it.id;
          this.preview?.applyConfig(this.config);
          this.renderLayeredClothingTab(c);
        };
        grid.appendChild(card);
      });
      wrap.appendChild(sec);
    };

    renderCategory('🧥 Áo Khoác Ngoài 3D (Jackets)', 'Trang phục 3D có thể mặc đè lên áo khác, tự co giãn theo phom cơ thể.', 'jacket', LAYERED_ITEMS.jackets);
    renderCategory('🧶 Áo Len Ấm Áp (Sweaters)', 'Áo len Giáng Sinh và áo cổ lọ mềm mại dệt 3D.', 'sweater', LAYERED_ITEMS.sweaters);
    renderCategory('🛹 Áo 3D / Hoodie (Shirts 3D)', 'Áo Hoodie có mũ trùm sau lưng hoặc Gile jean bụi bặm.', 'shirt3d', LAYERED_ITEMS.shirts3d);
    renderCategory('👖 Quần 3D (Pants 3D)', 'Quần túi hộp Cargo Pants hoặc Quần bò thụng Streetwear.', 'pants3d', LAYERED_ITEMS.pants3d);
    renderCategory('👗 Váy Xòe 3D (Dresses & Skirts)', 'Chân váy xếp ly nữ sinh Nhật hoặc Váy dạ hội công chúa.', 'skirt', LAYERED_ITEMS.skirts);
    renderCategory('👟 Giày Thể Thao 3D (Shoes 3D)', 'Sneakers Chunky đế bánh mì hoặc Bốt quân đội da bóng.', 'shoes3d', LAYERED_ITEMS.shoes3d);

    c.appendChild(wrap);
  }

  // B2. Classic Clothing (Trang phục 2D dán truyền thống)
  renderClassicClothingTab(c) {
    const wrap = document.createElement('div');
    wrap.className = 'custom-section';

    const renderClassicCat = (title, hint, catKey, items) => {
      const sec = document.createElement('div');
      sec.className = 'clothing-cat-group';
      sec.innerHTML = `
        <div class="custom-sec-header">
          <h4>${title}</h4>
          <p class="hint">${hint}</p>
        </div>
        <div class="item-card-grid"></div>
      `;
      const grid = sec.querySelector('.item-card-grid');
      items.forEach((it) => {
        const card = document.createElement('button');
        const isEquipped = (this.config.classic[catKey] || 'none') === it.id;
        card.className = `custom-card ${isEquipped ? 'active' : ''}`;
        card.innerHTML = `
          <div class="card-icon">${it.icon}</div>
          <div class="card-name">${it.name}</div>
          ${it.desc ? `<div class="card-desc">${it.desc}</div>` : ''}
        `;
        card.onclick = () => {
          this.config.classic[catKey] = it.id;
          this.preview?.applyConfig(this.config);
          this.renderClassicClothingTab(c);
        };
        grid.appendChild(card);
      });
      wrap.appendChild(sec);
    };

    renderClassicCat('👕 Classic Shirts (Áo 2D Dán)', 'Họa tiết 2D in phẳng lên ngực, lưng và tay áo nhân vật.', 'shirt', CLASSIC_ITEMS.shirts);
    renderClassicCat('🩳 Classic Pants (Quần 2D Dán)', 'Quần 2D dán trực tiếp lên chân (Noob, Jean rách, Quần âu).', 'pants', CLASSIC_ITEMS.pants);
    renderClassicCat('🖼️ Classic T-Shirts (Hình In Decal Ngực)', 'Hình in decal dán phẳng trước ngực áo (Logo Roblox, Doge, Flame Heart...).', 'tshirt', CLASSIC_ITEMS.tshirts);

    c.appendChild(wrap);
  }

  // 🎲 Randomize look
  randomize() {
    const randItem = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const randColor = randItem(ROBLOX_PALETTE).hex;

    this.config.skin.all = randColor;
    this.config.skin.head = randColor;
    this.config.skin.torso = randItem(ROBLOX_PALETTE).hex;
    this.config.skin.leftArm = randColor;
    this.config.skin.rightArm = randColor;
    this.config.skin.leftLeg = randItem(ROBLOX_PALETTE).hex;
    this.config.skin.rightLeg = this.config.skin.leftLeg;

    this.config.headType = randItem(HEAD_TYPES).id;
    this.config.classicFace = randItem(CLASSIC_FACES).id;
    this.config.hairStyle = randItem(HAIR_STYLES).id;
    this.config.hairColor = randItem(HAIR_COLORS).hex;

    const pr = randItem(BODY_SCALE_PRESETS);
    this.config.bodyScale = { ...pr.scale, preset: pr.id };

    this.config.layered.jacket = randItem(LAYERED_ITEMS.jackets).id;
    this.config.layered.sweater = randItem(LAYERED_ITEMS.sweaters).id;
    this.config.layered.pants3d = randItem(LAYERED_ITEMS.pants3d).id;
    this.config.layered.shoes3d = randItem(LAYERED_ITEMS.shoes3d).id;

    this.config.classic.shirt = randItem(CLASSIC_ITEMS.shirts).id;
    this.config.classic.pants = randItem(CLASSIC_ITEMS.pants).id;
    this.config.classic.tshirt = randItem(CLASSIC_ITEMS.tshirts).id;

    this.preview?.applyConfig(this.config);
    this.renderContent();
  }
}
