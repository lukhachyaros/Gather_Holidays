// ============================================================================
// AVATAR CUSTOMIZATION STUDIO (ROBLOX STYLE 3D CHARACTER CUSTOMIZER)
// - Body: Skin per body part (Roblox palette), Head shapes, 2D Classic Faces,
//         Proportions & Body rig presets (Standard, Classic Blocky, Buff, Slender, Chibi)
// - Hair: 3D Layered & mesh hairstyles with rich color palette
// - Clothing: Layered Clothing 3D (Jackets, Sweaters, Skirts, Shoes) &
//             Classic Clothing 2D (Graphic Shirts, T-Shirts, Pants)
// ============================================================================

import * as THREE from 'three';
import { Avatar } from './avatar.js';

export const AVATAR_CUSTOM_STORAGE_KEY = 'gh_avatar_customization';

// Default Customization Configuration
export function getDefaultCustomization() {
  return {
    skin: {
      mode: 'all', // 'all' | 'advanced'
      all: '#ffdbb5',
      head: '#ffdbb5',
      torso: '#3b82f6',
      leftArm: '#ffdbb5',
      rightArm: '#ffdbb5',
      leftLeg: '#2b3a4a',
      rightLeg: '#2b3a4a',
    },
    headShape: 'classic_round', // 'classic_round' | 'classic_block' | 'dynamic_head' | 'chibi_head'
    classicFace: 'smile', // 'default' | 'smile' | 'troll' | 'chill' | 'smug' | 'anime_cute' | 'epic' | 'sunglasses' | 'wink'
    hairStyle: 'short_classic', // 'bald' | 'short_classic' | 'spiky_anime' | 'layered_messy' | 'ponytail' | 'long_wavy' | 'curly_afro' | 'beanie_cap'
    hairColor: '#3a2314',
    bodyPreset: 'standard', // 'standard' | 'blocky_classic' | 'buff_muscular' | 'slender' | 'chibi_cute'
    heightScale: 1.0,
    widthScale: 1.0,
    headScale: 1.0,
    layeredClothing: {
      jacket: 'none', // 'none' | 'bomber_jacket' | 'trench_coat' | 'leather_jacket' | 'varsity_jacket'
      sweater: 'none', // 'none' | 'cozy_hoodie' | 'xmas_sweater' | 'turtleneck'
      dressSkirt: 'none', // 'none' | 'flared_skirt' | 'party_dress'
      shoes: 'sneakers', // 'sneakers' | 'boots' | 'oxford' | 'canvas'
    },
    classicClothing: {
      shirt: 'classic_blue', // 'classic_blue' | 'classic_tuxedo' | 'classic_hoodie_print' | 'classic_striped' | 'classic_gaming' | 'classic_heart' | 'classic_troll'
      pants: 'classic_jeans', // 'classic_jeans' | 'classic_black_slacks' | 'classic_camo' | 'classic_shorts' | 'classic_sweatpants'
    },
  };
}

export function loadAvatarCustomization() {
  try {
    const raw = localStorage.getItem(AVATAR_CUSTOM_STORAGE_KEY);
    if (!raw) return getDefaultCustomization();
    const parsed = JSON.parse(raw);
    return {
      ...getDefaultCustomization(),
      ...parsed,
      skin: { ...getDefaultCustomization().skin, ...(parsed.skin || {}) },
      layeredClothing: { ...getDefaultCustomization().layeredClothing, ...(parsed.layeredClothing || {}) },
      classicClothing: { ...getDefaultCustomization().classicClothing, ...(parsed.classicClothing || {}) },
    };
  } catch (e) {
    console.warn('Failed to parse avatar customization, using default', e);
    return getDefaultCustomization();
  }
}

export function saveAvatarCustomization(cfg) {
  try {
    localStorage.setItem(AVATAR_CUSTOM_STORAGE_KEY, JSON.stringify(cfg));
  } catch (e) {
    console.warn(e);
  }
}

// ============================================================================
// 1. PALETTES & CATALOG OPTIONS
// ============================================================================
export const SKIN_PALETTE = [
  { name: 'Vàng Roblox', color: '#f5cd2f' },
  { name: 'Xanh Roblox', color: '#0d69ac' },
  { name: 'Xanh Lá', color: '#27c93f' },
  { name: 'Đỏ Rực', color: '#c4281c' },
  { name: 'Sáng Tự Nhiên', color: '#ffdbb5' },
  { name: 'Trắng Sáng', color: '#ffe4c9' },
  { name: 'Bánh Mật (Tan)', color: '#e0ac69' },
  { name: 'Nâu Râm (Brown)', color: '#8d5524' },
  { name: 'Nâu Đậm', color: '#523016' },
  { name: 'Ma Cà Rồng', color: '#f1f5f9' },
  { name: 'Xanh Alien', color: '#86efac' },
  { name: 'Tím Cyber', color: '#c084fc' },
  { name: 'Hồng Đào', color: '#fbcfe8' },
  { name: 'Xanh Biển Neon', color: '#38bdf8' },
  { name: 'Đen Huyền', color: '#18181b' },
  { name: 'Trắng Sứ', color: '#ffffff' },
];

export const HAIR_COLORS = [
  { name: 'Đen Tự Nhiên', color: '#171717' },
  { name: 'Nâu Trầm', color: '#3a2314' },
  { name: 'Nâu Hạt Dẻ', color: '#6d4c41' },
  { name: 'Vàng Kim', color: '#f59e0b' },
  { name: 'Bạch Kim', color: '#f1f5f9' },
  { name: 'Đỏ Lửa', color: '#dc2626' },
  { name: 'Hồng Pastel', color: '#ec4899' },
  { name: 'Xanh Neon', color: '#06b6d4' },
  { name: 'Xanh Rêu', color: '#10b981' },
  { name: 'Tím Khói', color: '#8b5cf6' },
];

export const HEAD_SHAPES = [
  { id: 'classic_round', name: 'Đầu Tròn Mịn', desc: 'Đầu tròn bo góc hiện đại dễ thương', icon: '👤' },
  { id: 'classic_block', name: 'Đầu Khối Classic', desc: 'Đầu hộp vuông phong cách Roblox cổ điển', icon: '🟩' },
  { id: 'dynamic_head', name: 'Đầu Động Anime', desc: 'Đầu cằm V-line cách điệu Manga', icon: '✨' },
  { id: 'chibi_head', name: 'Đầu To Chibi', desc: 'Tỷ lệ đầu to ngộ nghĩnh cực kỳ đáng yêu', icon: '👶' },
];

export const CLASSIC_FACES = [
  { id: 'default', name: 'Mặt 3D Ban Đầu', desc: 'Khuôn mặt 3D bo tròn với má hồng', icon: '😊' },
  { id: 'smile', name: 'Roblox Classic Smile', desc: 'Nụ cười thân thiện huyền thoại của Roblox', icon: '🙂' },
  { id: 'chill', name: 'Man Face / Chill Face', desc: 'Mặt ngầu lòi thư thái vạn người mê', icon: '😎' },
  { id: 'troll', name: 'Trollface Kinh Điển', desc: 'Nụ cười răng khểnh bựa troll cả server', icon: '🤡' },
  { id: 'smug', name: 'Smug Nhếch Mép', desc: 'Nụ cười nhếch mép ranh mãnh bí hiểm', icon: '😏' },
  { id: 'anime_cute', name: 'Mắt Long Lanh Kawaii', desc: 'Đôi mắt to tròn long lanh hoạt hình Nhật Bản', icon: '🥺' },
  { id: 'epic', name: 'Epic Face', desc: 'Mặt cười há mồm mắt sao phấn khích', icon: '🤩' },
  { id: 'sunglasses', name: 'Kính Râm Sành Điệu', desc: 'Kính râm phi công cực ngầu', icon: '🕶️' },
  { id: 'wink', name: 'Nháy Mắt Tinh Nghịch', desc: 'Một mắt nháy duyên dáng kèm nụ cười tươi', icon: '😉' },
];

export const HAIR_STYLES = [
  { id: 'bald', name: 'Đầu Trọc / Không Tóc', desc: 'Phong cách tối giản hoặc đội mũ bảo hiểm', icon: '🥚' },
  { id: 'short_classic', name: 'Tóc Ngắn Cổ Điển', desc: 'Kiểu tóc nam sinh ngắn gọn gàng', icon: '💇‍♂️' },
  { id: 'spiky_anime', name: 'Tóc Chôm Chôm Anime', desc: 'Tóc vuốt dựng gai góc siêu ngầu', icon: '⚡' },
  { id: 'layered_messy', name: 'Tóc Layer Hàn Quốc', desc: 'Tóc tỉa layer bồng bềnh lãng tử', icon: '✨' },
  { id: 'ponytail', name: 'Tóc Buộc Đuôi Ngựa', desc: 'Buộc cao năng động phía sau gáy', icon: '👱‍♀️' },
  { id: 'long_wavy', name: 'Tóc Dài Gợn Sóng', desc: 'Mái tóc dài thướt tha chạm vai', icon: '👩' },
  { id: 'curly_afro', name: 'Tóc Xù Bồng Afro', desc: 'Tóc xoăn tròn phồng cá tính', icon: '🧑‍🦱' },
  { id: 'beanie_cap', name: 'Mũ Len Beanie', desc: 'Mũ len ấm áp trùm đầu dạo phố', icon: '🧢' },
];

export const BODY_PRESETS = [
  { id: 'standard', name: 'Chuẩn Mực Cân Đối', desc: 'Chiều cao và bề ngang chuẩn chỉnh', height: 1.0, width: 1.0, head: 1.0, icon: '🧍' },
  { id: 'blocky_classic', name: 'Roblox R6 Khối Hộp', desc: 'Vuông vức, tay chân khối hộp Roblox', height: 1.0, width: 1.15, head: 1.05, icon: '🧱' },
  { id: 'buff_muscular', name: 'Vạm Vỡ Lực Sĩ', desc: 'Vai rộng, ngực đô, cơ bắp cuồn cuộn', height: 1.15, width: 1.25, head: 0.9, icon: '💪' },
  { id: 'slender', name: 'Mảnh Mai Thanh Lịch', desc: 'Cao ráo, vóc dáng thon gọn', height: 1.12, width: 0.88, head: 0.95, icon: '💃' },
  { id: 'chibi_cute', name: 'Tí Nị Chibi', desc: 'Lùn mập, đầu to siêu dễ thương', height: 0.85, width: 1.1, head: 1.25, icon: '🧸' },
];

export const LAYERED_JACKETS = [
  { id: 'none', name: 'Không Mặc', desc: 'Để lộ áo phía trong', icon: '🚫' },
  { id: 'bomber_jacket', name: 'Áo Khoác Bomber', desc: 'Áo bomber phi công có bo gấu cổ áo', icon: '🧥' },
  { id: 'trench_coat', name: 'Áo Măng Tô Dạ Dài', desc: 'Áo khoác dài cổ bẻ sang trọng quý phái', icon: '🥼' },
  { id: 'leather_jacket', name: 'Áo Da Biker Gai Góc', desc: 'Áo da đen phong trần khóa chéo', icon: '🖤' },
  { id: 'varsity_jacket', name: 'Áo Bóng Chày Varsity', desc: 'Áo khoác bóng chày học đường Mỹ', icon: '⚾' },
];

export const LAYERED_SWEATERS = [
  { id: 'none', name: 'Không Mặc', desc: 'Không mặc áo len/hoodie 3D', icon: '🚫' },
  { id: 'cozy_hoodie', name: 'Áo Hoodie Mũ Trùm', desc: 'Áo nỉ ấm áp có túi trước bụng và mũ sau', icon: '🥷' },
  { id: 'xmas_sweater', name: 'Áo Len Dệt Giáng Sinh', desc: 'Áo len hoa văn tuyết rơi mùa đông', icon: '🎄' },
  { id: 'turtleneck', name: 'Áo Len Cổ Lọ', desc: 'Áo len cổ cao lịch lãm', icon: '🧣' },
];

export const LAYERED_DRESS_SKIRTS = [
  { id: 'none', name: 'Không Mặc', desc: 'Mặc quần thông thường', icon: '🚫' },
  { id: 'flared_skirt', name: 'Chân Váy Xòe Nữ Sinh', desc: 'Váy xếp ly ngắn năng động duyên dáng', icon: '👗' },
  { id: 'party_dress', name: 'Váy Dạ Hội Xếp Tầng', desc: 'Đầm dạ hội lung linh nổi bật', icon: '✨' },
];

export const LAYERED_SHOES = [
  { id: 'sneakers', name: 'Giày Sneaker Thể Thao', desc: 'Giày thể thao trắng cổ thấp năng động', icon: '👟' },
  { id: 'boots', name: 'Ủng Da Cao Cổ', desc: 'Ủng da đanh thép bảo vệ đôi chân', icon: '👢' },
  { id: 'oxford', name: 'Giày Tây Bóng Loáng', desc: 'Giày da đen lịch thiệp quý ông', icon: '👞' },
  { id: 'canvas', name: 'Giày Vải Converse', desc: 'Giày vải trẻ trung dạo phố', icon: '🛹' },
];

export const CLASSIC_SHIRTS = [
  { id: 'classic_blue', name: 'Áo Thun Xanh Basic', desc: 'Áo thun xanh da trời cổ tròn truyền thống', color: '#0284c7', icon: '👕' },
  { id: 'classic_tuxedo', name: 'Complet Tuxedo Nơ Đen', desc: 'Bộ vest lịch lãm nơ đen đĩnh đạc', color: '#090d16', icon: '👔' },
  { id: 'classic_hoodie_print', name: 'Áo In Ngọn Lửa Bốc Cháy', desc: 'Họa tiết lửa cháy rừng rực cá tính', color: '#18181b', icon: '🔥' },
  { id: 'classic_striped', name: 'Áo Kẻ Sọc Ngang Thủy Thủ', desc: 'Sọc ngang trắng xanh phong cách thủy thủ', color: '#1e3a8a', icon: '🦓' },
  { id: 'classic_gaming', name: 'Áo Game Thủ Retro', desc: 'Logo tay cầm Console pixel 8-bit', color: '#312e81', icon: '🎮' },
  { id: 'classic_heart', name: 'Áo Trái Tim Tình Yêu', desc: 'Trái tim đỏ thắm giữa ngực ngập tràn yêu thương', color: '#881337', icon: '💖' },
  { id: 'classic_troll', name: 'Áo Trollface Meme', desc: 'Hình in Trollface kinh điển', color: '#27272a', icon: '🤪' },
];

export const CLASSIC_PANTS = [
  { id: 'classic_jeans', name: 'Quần Jeans Xanh Bò', desc: 'Quần bò denim với đường chỉ vàng túi sau', color: '#1d4ed8', icon: '👖' },
  { id: 'classic_black_slacks', name: 'Quần Âu Đen Công Sở', desc: 'Quần tây đen thẳng thớm sang trọng', color: '#0f172a', icon: '🤵' },
  { id: 'classic_camo', name: 'Quần Rằn Ri Rừng Rậm', desc: 'Họa tiết quân đội dã ngoại hầm hố', color: '#14532d', icon: '🪖' },
  { id: 'classic_shorts', name: 'Quần Đùi Dạo Phố', desc: 'Quần short lửng thoáng mát mùa hè', color: '#0369a1', icon: '🩳' },
  { id: 'classic_sweatpants', name: 'Quần Nỉ Jogger Xám', desc: 'Quần nỉ thể thao thoải mái vận động', color: '#475569', icon: '🏃' },
];

// ============================================================================
// 2. CANVAS TEXTURE GENERATORS (2D DECALS FOR FACES & CLOTHES)
// ============================================================================
const faceTextureCache = new Map();
const clothingTextureCache = new Map();

export function getFaceCanvasTexture(faceId, skinColor = '#ffdbb5') {
  const cacheKey = `${faceId}_${skinColor}`;
  if (faceTextureCache.has(cacheKey)) return faceTextureCache.get(cacheKey);

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  // Fill transparent background
  ctx.clearRect(0, 0, 256, 256);

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  switch (faceId) {
    case 'smile': {
      // Classic Roblox Smile
      // Eyes
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(80, 95, 12, 0, Math.PI * 2);
      ctx.arc(176, 95, 12, 0, Math.PI * 2);
      ctx.fill();
      // Eye reflection shines
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(77, 92, 4, 0, Math.PI * 2);
      ctx.arc(173, 92, 4, 0, Math.PI * 2);
      ctx.fill();
      // Smile arc
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.arc(128, 125, 45, 0.25 * Math.PI, 0.75 * Math.PI);
      ctx.stroke();
      // Cute blush
      ctx.fillStyle = 'rgba(255, 105, 135, 0.45)';
      ctx.beginPath();
      ctx.ellipse(65, 128, 16, 9, 0, 0, Math.PI * 2);
      ctx.ellipse(191, 128, 16, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'chill': {
      // "Man Face" Roblox
      // Confident Eyebrows
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.moveTo(55, 78);
      ctx.lineTo(105, 70);
      ctx.lineTo(105, 78);
      ctx.lineTo(55, 84);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(201, 78);
      ctx.lineTo(151, 70);
      ctx.lineTo(151, 78);
      ctx.lineTo(201, 84);
      ctx.fill();

      // Sharp Eyes
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.moveTo(60, 96);
      ctx.quadraticCurveTo(80, 88, 102, 96);
      ctx.quadraticCurveTo(80, 106, 60, 96);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(154, 96);
      ctx.quadraticCurveTo(176, 88, 196, 96);
      ctx.quadraticCurveTo(176, 106, 154, 96);
      ctx.fill();

      // Pupils
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(82, 96, 3, 0, Math.PI * 2);
      ctx.arc(174, 96, 3, 0, Math.PI * 2);
      ctx.fill();

      // Smug Man Smile
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.moveTo(85, 142);
      ctx.quadraticCurveTo(128, 165, 172, 140);
      ctx.stroke();
      // Chin line
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(118, 185);
      ctx.lineTo(138, 185);
      ctx.stroke();
      break;
    }
    case 'troll': {
      // Iconic Trollface
      ctx.strokeStyle = '#000000';
      ctx.fillStyle = '#000000';
      ctx.lineWidth = 7;

      // Wrinkly eyes
      ctx.beginPath();
      ctx.arc(80, 95, 14, 0, Math.PI * 2);
      ctx.arc(170, 90, 13, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(82, 95, 6, 0, Math.PI * 2);
      ctx.arc(168, 90, 5, 0, Math.PI * 2);
      ctx.fill();

      // Wrinkles
      ctx.beginPath();
      ctx.moveTo(65, 75);
      ctx.lineTo(100, 72);
      ctx.moveTo(155, 70);
      ctx.lineTo(185, 65);
      ctx.stroke();

      // Huge Creepy Grin
      ctx.beginPath();
      ctx.moveTo(55, 125);
      ctx.quadraticCurveTo(128, 185, 205, 120);
      ctx.quadraticCurveTo(130, 205, 55, 125);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      // Teeth lines
      ctx.beginPath();
      for (let tx = 75; tx <= 185; tx += 18) {
        ctx.moveTo(tx, 135);
        ctx.lineTo(tx + 2, 160);
      }
      ctx.stroke();
      break;
    }
    case 'smug': {
      // Sly half-smile
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 7;
      // Eyes half closed
      ctx.beginPath();
      ctx.moveTo(65, 102);
      ctx.quadraticCurveTo(85, 88, 105, 100);
      ctx.moveTo(150, 98);
      ctx.quadraticCurveTo(172, 85, 192, 100);
      ctx.stroke();

      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(85, 101, 7, 0, Math.PI);
      ctx.arc(171, 99, 7, 0, Math.PI);
      ctx.fill();

      // One eyebrow raised high
      ctx.beginPath();
      ctx.moveTo(60, 80);
      ctx.lineTo(105, 82);
      ctx.moveTo(150, 74);
      ctx.quadraticCurveTo(175, 60, 195, 72);
      ctx.stroke();

      // Sideways smirk
      ctx.beginPath();
      ctx.moveTo(105, 145);
      ctx.quadraticCurveTo(140, 155, 175, 135);
      ctx.stroke();
      break;
    }
    case 'anime_cute': {
      // Big sparkling anime eyes
      // Left eye
      ctx.fillStyle = '#3b82f6';
      ctx.beginPath();
      ctx.ellipse(82, 100, 22, 32, 0, 0, Math.PI * 2);
      ctx.ellipse(174, 100, 22, 32, 0, 0, Math.PI * 2);
      ctx.fill();

      // Dark upper gradient
      ctx.fillStyle = '#1e1b4b';
      ctx.beginPath();
      ctx.ellipse(82, 88, 22, 16, 0, 0, Math.PI * 2);
      ctx.ellipse(174, 88, 22, 16, 0, 0, Math.PI * 2);
      ctx.fill();

      // White big shines
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(75, 86, 9, 0, Math.PI * 2);
      ctx.arc(167, 86, 9, 0, Math.PI * 2);
      ctx.arc(90, 112, 5, 0, Math.PI * 2);
      ctx.arc(182, 112, 5, 0, Math.PI * 2);
      ctx.fill();

      // Cat mouth :3
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(116, 142, 12, 0, Math.PI);
      ctx.arc(140, 142, 12, 0, Math.PI);
      ctx.stroke();

      // Pink blush
      ctx.fillStyle = 'rgba(244, 63, 94, 0.55)';
      ctx.beginPath();
      ctx.ellipse(55, 130, 18, 10, -0.1, 0, Math.PI * 2);
      ctx.ellipse(201, 130, 18, 10, 0.1, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'epic': {
      // Roblox Epic Face
      // Star Eyes
      function drawStar(cx, cy, spikes, outerRadius, innerRadius) {
        let rot = (Math.PI / 2) * 3;
        let x = cx;
        let y = cy;
        const step = Math.PI / spikes;
        ctx.beginPath();
        ctx.moveTo(cx, cy - outerRadius);
        for (let i = 0; i < spikes; i++) {
          x = cx + Math.cos(rot) * outerRadius;
          y = cy + Math.sin(rot) * outerRadius;
          ctx.lineTo(x, y);
          rot += step;
          x = cx + Math.cos(rot) * innerRadius;
          y = cy + Math.sin(rot) * innerRadius;
          ctx.lineTo(x, y);
          rot += step;
        }
        ctx.lineTo(cx, cy - outerRadius);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = '#000000';
      drawStar(80, 92, 5, 18, 8);
      drawStar(176, 92, 5, 18, 8);

      // Huge open mouth D:
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(128, 128, 48, 0.1 * Math.PI, 0.9 * Math.PI);
      ctx.closePath();
      ctx.fill();

      // Tongue inside
      ctx.fillStyle = '#f43f5e';
      ctx.beginPath();
      ctx.arc(128, 158, 22, Math.PI, 0);
      ctx.fill();
      break;
    }
    case 'sunglasses': {
      // Cool black shades
      ctx.fillStyle = '#111827';
      ctx.beginPath();
      // Left glass
      ctx.roundRect(50, 78, 65, 45, [6, 6, 20, 20]);
      // Right glass
      ctx.roundRect(141, 78, 65, 45, [6, 6, 20, 20]);
      ctx.fill();

      // Bridge
      ctx.fillRect(115, 86, 26, 8);

      // Reflection stripe
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(60, 115);
      ctx.lineTo(85, 84);
      ctx.moveTo(151, 115);
      ctx.lineTo(176, 84);
      ctx.stroke();

      // Confident smile
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(128, 138, 32, 0.2 * Math.PI, 0.8 * Math.PI);
      ctx.stroke();
      break;
    }
    case 'wink': {
      // Left eye open, right eye winking
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(80, 95, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(77, 91, 5, 0, Math.PI * 2);
      ctx.fill();

      // Right eye wink arc
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.arc(176, 102, 18, 1.1 * Math.PI, 1.9 * Math.PI);
      ctx.stroke();

      // Sparkle on wink
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(205, 86, 7, 0, Math.PI * 2);
      ctx.fill();

      // Smile
      ctx.beginPath();
      ctx.arc(128, 128, 38, 0.2 * Math.PI, 0.8 * Math.PI);
      ctx.stroke();
      break;
    }
    default:
      break;
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  faceTextureCache.set(cacheKey, texture);
  return texture;
}

export function getClassicShirtTexture(shirtId) {
  if (clothingTextureCache.has(shirtId)) return clothingTextureCache.get(shirtId);

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  switch (shirtId) {
    case 'classic_tuxedo': {
      // Black jacket base
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, 256, 256);
      // White shirt V-shape
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(96, 0);
      ctx.lineTo(160, 0);
      ctx.lineTo(128, 180);
      ctx.closePath();
      ctx.fill();
      // Bowtie
      ctx.fillStyle = '#b91c1c';
      ctx.beginPath();
      ctx.moveTo(112, 36);
      ctx.lineTo(144, 48);
      ctx.lineTo(112, 60);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(144, 36);
      ctx.lineTo(112, 48);
      ctx.lineTo(144, 60);
      ctx.closePath();
      ctx.fill();
      // Buttons
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(128, 85, 4, 0, Math.PI * 2);
      ctx.arc(128, 115, 4, 0, Math.PI * 2);
      ctx.arc(128, 145, 4, 0, Math.PI * 2);
      ctx.fill();
      // Lapel lines
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(90, 0);
      ctx.lineTo(128, 180);
      ctx.lineTo(166, 0);
      ctx.stroke();
      break;
    }
    case 'classic_striped': {
      // Sailor Blue and White stripes
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 256, 256);
      ctx.fillStyle = '#1e3a8a';
      for (let y = 0; y < 256; y += 32) {
        ctx.fillRect(0, y, 256, 16);
      }
      break;
    }
    case 'classic_hoodie_print': {
      // Dark shirt with roaring fire logo
      ctx.fillStyle = '#18181b';
      ctx.fillRect(0, 0, 256, 256);
      // Flame
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.moveTo(128, 50);
      ctx.quadraticCurveTo(175, 120, 150, 180);
      ctx.quadraticCurveTo(128, 155, 106, 180);
      ctx.quadraticCurveTo(81, 120, 128, 50);
      ctx.fill();
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.moveTo(128, 90);
      ctx.quadraticCurveTo(155, 135, 140, 175);
      ctx.quadraticCurveTo(128, 160, 116, 175);
      ctx.quadraticCurveTo(101, 135, 128, 90);
      ctx.fill();
      break;
    }
    case 'classic_gaming': {
      // Console Gamepad
      ctx.fillStyle = '#1e1b4b';
      ctx.fillRect(0, 0, 256, 256);
      // Gamepad body
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.roundRect(75, 95, 106, 65, 20);
      ctx.fill();
      // D-Pad
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(92, 115, 20, 7);
      ctx.fillRect(98, 109, 7, 20);
      // Buttons
      ctx.fillStyle = '#f43f5e';
      ctx.beginPath();
      ctx.arc(155, 116, 5, 0, Math.PI * 2);
      ctx.arc(167, 126, 5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'classic_heart': {
      // Valentine Pixel Heart
      ctx.fillStyle = '#4c0519';
      ctx.fillRect(0, 0, 256, 256);
      ctx.fillStyle = '#f43f5e';
      ctx.beginPath();
      ctx.moveTo(128, 165);
      ctx.bezierCurveTo(75, 125, 75, 70, 105, 70);
      ctx.bezierCurveTo(120, 70, 128, 85, 128, 85);
      ctx.bezierCurveTo(128, 85, 136, 70, 151, 70);
      ctx.bezierCurveTo(181, 70, 181, 125, 128, 165);
      ctx.fill();
      break;
    }
    case 'classic_troll': {
      ctx.fillStyle = '#09090b';
      ctx.fillRect(0, 0, 256, 256);
      // White troll text
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 26px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PROBLEM?', 128, 85);
      // Meme smile
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(128, 130, 40, 0.1 * Math.PI, 0.9 * Math.PI);
      ctx.stroke();
      break;
    }
    default: {
      // Classic Blue
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(0, 0, 256, 256);
      // Collar neckline
      ctx.fillStyle = '#0369a1';
      ctx.beginPath();
      ctx.arc(128, 0, 42, 0, Math.PI);
      ctx.fill();
      break;
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  clothingTextureCache.set(shirtId, texture);
  return texture;
}

export function getClassicPantsTexture(pantsId) {
  if (clothingTextureCache.has(pantsId)) return clothingTextureCache.get(pantsId);

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  switch (pantsId) {
    case 'classic_jeans': {
      ctx.fillStyle = '#1d4ed8';
      ctx.fillRect(0, 0, 256, 256);
      // Stitch lines & pockets
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(35, 45);
      ctx.quadraticCurveTo(75, 75, 115, 45);
      ctx.moveTo(141, 45);
      ctx.quadraticCurveTo(181, 75, 221, 45);
      ctx.stroke();
      // Belt loops
      ctx.fillStyle = '#1e3a8a';
      for (let x = 30; x <= 220; x += 45) {
        ctx.fillRect(x, 5, 8, 25);
      }
      break;
    }
    case 'classic_camo': {
      ctx.fillStyle = '#3f6212';
      ctx.fillRect(0, 0, 256, 256);
      const blotches = ['#14532d', '#713f12', '#1c1917', '#4d7c0f'];
      for (let i = 0; i < 35; i++) {
        ctx.fillStyle = blotches[i % blotches.length];
        const bx = (i * 47) % 256;
        const by = (i * 61) % 256;
        ctx.beginPath();
        ctx.ellipse(bx, by, 18 + (i % 12), 12 + (i % 8), i * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'classic_shorts': {
      // Top denim shorts, bottom transparent / bare skin
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(0, 0, 256, 110);
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(0, 105, 256, 5); // Frayed hem
      break;
    }
    case 'classic_sweatpants': {
      ctx.fillStyle = '#64748b';
      ctx.fillRect(0, 0, 256, 256);
      // White side stripes
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(8, 0, 10, 256);
      ctx.fillRect(238, 0, 10, 256);
      break;
    }
    default: {
      // Classic Black Slacks
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, 256, 256);
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(128, 0);
      ctx.lineTo(128, 256);
      ctx.stroke();
      break;
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  clothingTextureCache.set(pantsId, texture);
  return texture;
}

// ============================================================================
// 3. 3D AVATAR CUSTOMIZER STUDIO PREVIEW SCENE
// ============================================================================
let previewRenderer = null;
let previewScene = null;
let previewCamera = null;
let previewAvatar = null;
let previewAnimFrame = null;
let isDraggingPreview = false;
let prevMouseX = 0;
let avatarRotY = 0;

export function initAvatarStudioScene(canvas) {
  if (!canvas) return;

  if (previewAnimFrame) cancelAnimationFrame(previewAnimFrame);

  previewScene = new THREE.Scene();
  previewScene.background = new THREE.Color('#0b0f19');

  const width = canvas.clientWidth || 320;
  const height = canvas.clientHeight || 420;

  previewCamera = new THREE.PerspectiveCamera(40, width / height, 0.1, 50);
  previewCamera.position.set(0, 1.15, 3.2);

  previewRenderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  });
  previewRenderer.setSize(width, height, false);
  previewRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  previewRenderer.shadowMap.enabled = true;

  // Studio Lighting
  const ambient = new THREE.AmbientLight(0xffffff, 1.1);
  previewScene.add(ambient);

  const keyLight = new THREE.DirectionalLight(0xfffbeb, 1.8);
  keyLight.position.set(2.5, 4.0, 3.5);
  keyLight.castShadow = true;
  previewScene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0x38bdf8, 1.2);
  fillLight.position.set(-2.5, 2.0, -1.5);
  previewScene.add(fillLight);

  const rimLight = new THREE.DirectionalLight(0xf472b6, 1.0);
  rimLight.position.set(0, 3.0, -3.0);
  previewScene.add(rimLight);

  // Studio Pedestal Floor
  const floorGeo = new THREE.CylinderGeometry(1.2, 1.3, 0.08, 36);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.25,
    metalness: 0.4,
  });
  const pedestal = new THREE.Mesh(floorGeo, floorMat);
  pedestal.position.set(0, -0.04, 0);
  pedestal.receiveShadow = true;
  previewScene.add(pedestal);

  const ringGeo = new THREE.RingGeometry(1.05, 1.15, 36);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.set(0, 0.002, 0);
  previewScene.add(ring);

  // Drag rotation interaction
  canvas.onmousedown = (e) => {
    isDraggingPreview = true;
    prevMouseX = e.clientX;
  };
  window.addEventListener('mouseup', () => { isDraggingPreview = false; });
  window.addEventListener('mousemove', (e) => {
    if (!isDraggingPreview || !previewAvatar) return;
    const delta = e.clientX - prevMouseX;
    prevMouseX = e.clientX;
    avatarRotY += delta * 0.015;
    if (previewAvatar.root) previewAvatar.root.rotation.y = avatarRotY;
  });

  // Touch controls for mobile
  canvas.ontouchstart = (e) => {
    if (e.touches.length === 1) {
      isDraggingPreview = true;
      prevMouseX = e.touches[0].clientX;
    }
  };
  canvas.ontouchend = () => { isDraggingPreview = false; };
  canvas.ontouchmove = (e) => {
    if (!isDraggingPreview || !previewAvatar || e.touches.length !== 1) return;
    const delta = e.touches[0].clientX - prevMouseX;
    prevMouseX = e.touches[0].clientX;
    avatarRotY += delta * 0.015;
    if (previewAvatar.root) previewAvatar.root.rotation.y = avatarRotY;
  };

  // Render loop
  let clock = 0;
  function animatePreview() {
    clock += 0.025;
    if (previewAvatar) {
      previewAvatar.update(0.025);
      // Gentle breathing idle sway
      if (previewAvatar.hips) {
        previewAvatar.hips.position.y = 0.78 + Math.sin(clock * 1.8) * 0.015;
      }
    }
    previewRenderer.render(previewScene, previewCamera);
    previewAnimFrame = requestAnimationFrame(animatePreview);
  }
  animatePreview();
}

export function updatePreviewAvatar(cfg) {
  if (!previewScene) return;
  if (!previewAvatar) {
    previewAvatar = new Avatar(null, {
      name: 'Preview',
      hue: 200,
    });
    if (previewAvatar.label) previewAvatar.label.visible = false;
    previewScene.add(previewAvatar.root);
  }

  previewAvatar.applyCustomization(cfg);
  previewAvatar.root.position.set(0, 0, 0);
  previewAvatar.root.rotation.y = avatarRotY;
  fitPreviewCamera();
}

function fitPreviewCamera() {
  if (!previewAvatar || !previewCamera) return;

  previewAvatar.body.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(previewAvatar.body);
  if (bounds.isEmpty()) return;

  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const verticalFov = THREE.MathUtils.degToRad(previewCamera.fov);
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * previewCamera.aspect);
  const heightDistance = size.y / (2 * Math.tan(verticalFov / 2));
  const widthDistance = size.x / (2 * Math.tan(horizontalFov / 2));
  const distance = Math.max(heightDistance, widthDistance) * 1.25;

  previewCamera.position.set(center.x, center.y + size.y * 0.04, center.z + distance);
  previewCamera.lookAt(center);
}

// ============================================================================
// 4. AVATAR STUDIO MODAL & TAB CONTROLLER
// ============================================================================
let workingConfig = null;
let currentTab = 'body';
let currentSkinSubpart = 'head';
let studioSaveCallback = null;

export function openAvatarStudioModal(customConfig, onSave) {
  workingConfig = JSON.parse(JSON.stringify(customConfig || loadAvatarCustomization()));
  studioSaveCallback = onSave || null;

  const modal = document.getElementById('dlgAvatarCustomizer');
  if (!modal) return;
  modal.classList.remove('hidden');

  const canvas = document.getElementById('avatarPreviewCanvas');
  initAvatarStudioScene(canvas);
  updatePreviewAvatar(workingConfig);

  bindStudioGlobalEvents();
  setStudioTab(currentTab);
}

export function closeAvatarStudioModal() {
  const modal = document.getElementById('dlgAvatarCustomizer');
  if (modal) modal.classList.add('hidden');
  if (previewAnimFrame) cancelAnimationFrame(previewAnimFrame);
}

function setStudioTab(tabId) {
  currentTab = tabId;
  const tabBtns = document.querySelectorAll('.avatar-tab-btn');
  tabBtns.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });
  renderStudioContent();
}

function bindStudioGlobalEvents() {
  const modal = document.getElementById('dlgAvatarCustomizer');
  if (!modal || modal.dataset.bound) return;
  modal.dataset.bound = 'true';

  document.getElementById('btnCloseAvatarStudio')?.addEventListener('click', closeAvatarStudioModal);
  document.getElementById('btnCancelAvatarStudio')?.addEventListener('click', closeAvatarStudioModal);

  document.getElementById('btnSaveAvatarStudio')?.addEventListener('click', () => {
    saveAvatarCustomization(workingConfig);
    if (typeof studioSaveCallback === 'function') {
      studioSaveCallback(workingConfig);
    }
    closeAvatarStudioModal();
  });

  document.getElementById('btnResetAvatarDefault')?.addEventListener('click', () => {
    workingConfig = getDefaultCustomization();
    updatePreviewAvatar(workingConfig);
    renderStudioContent();
  });

  document.getElementById('btnRandomizeAvatar')?.addEventListener('click', () => {
    randomizeCustomization();
    updatePreviewAvatar(workingConfig);
    renderStudioContent();
  });

  const tabBtns = modal.querySelectorAll('.avatar-tab-btn');
  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      setStudioTab(btn.dataset.tab);
    });
  });
}

function randomizeCustomization() {
  const randEl = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const randSkin = randEl(SKIN_PALETTE).color;
  workingConfig.skin = {
    mode: Math.random() > 0.4 ? 'all' : 'advanced',
    all: randSkin,
    head: randSkin,
    torso: randEl(SKIN_PALETTE).color,
    leftArm: randSkin,
    rightArm: randSkin,
    leftLeg: randEl(SKIN_PALETTE).color,
    rightLeg: randEl(SKIN_PALETTE).color,
  };
  workingConfig.headShape = randEl(HEAD_SHAPES).id;
  workingConfig.classicFace = randEl(CLASSIC_FACES).id;
  workingConfig.hairStyle = randEl(HAIR_STYLES).id;
  workingConfig.hairColor = randEl(HAIR_COLORS).color;
  workingConfig.bodyPreset = randEl(BODY_PRESETS).id;
  workingConfig.heightScale = +(0.85 + Math.random() * 0.35).toFixed(2);
  workingConfig.widthScale = +(0.85 + Math.random() * 0.35).toFixed(2);
  workingConfig.headScale = +(0.9 + Math.random() * 0.3).toFixed(2);
  workingConfig.layeredClothing = {
    jacket: randEl(LAYERED_JACKETS).id,
    sweater: randEl(LAYERED_SWEATERS).id,
    dressSkirt: randEl(LAYERED_DRESS_SKIRTS).id,
    shoes: randEl(LAYERED_SHOES).id,
  };
  workingConfig.classicClothing = {
    shirt: randEl(CLASSIC_SHIRTS).id,
    pants: randEl(CLASSIC_PANTS).id,
  };
}

function renderStudioContent() {
  const container = document.getElementById('avatarTabContent');
  if (!container || !workingConfig) return;
  container.innerHTML = '';

  if (currentTab === 'body') {
    renderBodyTab(container);
  } else if (currentTab === 'face') {
    renderFaceTab(container);
  } else if (currentTab === 'hair') {
    renderHairTab(container);
  } else if (currentTab === 'layered') {
    renderLayeredTab(container);
  } else if (currentTab === 'classic') {
    renderClassicTab(container);
  }
}

function renderBodyTab(container) {
  // 1. Skin Mode Toggle
  const skinSec = document.createElement('div');
  skinSec.className = 'avatar-section';
  skinSec.innerHTML = `
    <div class="avatar-section-title">🎨 Màu Da Nhân Vật</div>
    <div class="avatar-subtabs">
      <button class="avatar-subtab-btn ${workingConfig.skin.mode === 'all' ? 'active' : ''}" id="btnSkinModeAll">Toàn Thân</button>
      <button class="avatar-subtab-btn ${workingConfig.skin.mode === 'advanced' ? 'active' : ''}" id="btnSkinModeAdv">Từng Bộ Phận (Roblox)</button>
    </div>
  `;
  container.appendChild(skinSec);

  skinSec.querySelector('#btnSkinModeAll').onclick = () => {
    workingConfig.skin.mode = 'all';
    updatePreviewAvatar(workingConfig);
    renderStudioContent();
  };
  skinSec.querySelector('#btnSkinModeAdv').onclick = () => {
    workingConfig.skin.mode = 'advanced';
    updatePreviewAvatar(workingConfig);
    renderStudioContent();
  };

  if (workingConfig.skin.mode === 'advanced') {
    const advParts = [
      { id: 'head', name: 'Đầu' },
      { id: 'torso', name: 'Thân' },
      { id: 'leftArm', name: 'Tay Trái' },
      { id: 'rightArm', name: 'Tay Phải' },
      { id: 'leftLeg', name: 'Chân Trái' },
      { id: 'rightLeg', name: 'Chân Phải' },
    ];
    const subPartBar = document.createElement('div');
    subPartBar.className = 'avatar-subtabs';
    subPartBar.style.marginTop = '6px';
    advParts.forEach((p) => {
      const b = document.createElement('button');
      b.className = `avatar-subtab-btn ${currentSkinSubpart === p.id ? 'active' : ''}`;
      b.innerText = p.name;
      b.onclick = () => {
        currentSkinSubpart = p.id;
        renderStudioContent();
      };
      subPartBar.appendChild(b);
    });
    skinSec.appendChild(subPartBar);
  }

  // Swatches
  const swatchesGrid = document.createElement('div');
  swatchesGrid.className = 'color-swatches-grid';
  const activeColor =
    workingConfig.skin.mode === 'advanced'
      ? workingConfig.skin[currentSkinSubpart]
      : workingConfig.skin.all;

  SKIN_PALETTE.forEach((item) => {
    const sw = document.createElement('button');
    sw.className = `color-swatch-item ${activeColor === item.color ? 'active' : ''}`;
    sw.style.backgroundColor = item.color;
    sw.title = item.name;
    sw.onclick = () => {
      if (workingConfig.skin.mode === 'advanced') {
        workingConfig.skin[currentSkinSubpart] = item.color;
      } else {
        workingConfig.skin.all = item.color;
        workingConfig.skin.head = item.color;
        workingConfig.skin.leftArm = item.color;
        workingConfig.skin.rightArm = item.color;
      }
      updatePreviewAvatar(workingConfig);
      renderStudioContent();
    };
    swatchesGrid.appendChild(sw);
  });
  skinSec.appendChild(swatchesGrid);

  // 2. Body Rig Presets
  const presetSec = document.createElement('div');
  presetSec.className = 'avatar-section';
  presetSec.innerHTML = `<div class="avatar-section-title">🧍 Khung Vóc Dáng & Thể Hình</div>`;
  const presetGrid = document.createElement('div');
  presetGrid.className = 'catalog-grid';
  BODY_PRESETS.forEach((bp) => {
    const card = document.createElement('div');
    card.className = `catalog-card ${workingConfig.bodyPreset === bp.id ? 'active' : ''}`;
    card.innerHTML = `
      <div class="catalog-card-icon">${bp.icon}</div>
      <div class="catalog-card-name">${bp.name}</div>
      <div class="catalog-card-desc">${bp.desc}</div>
    `;
    card.onclick = () => {
      workingConfig.bodyPreset = bp.id;
      updatePreviewAvatar(workingConfig);
      renderStudioContent();
    };
    presetGrid.appendChild(card);
  });
  presetSec.appendChild(presetGrid);
  container.appendChild(presetSec);

  // 3. Proportions Sliders
  const sliderSec = document.createElement('div');
  sliderSec.className = 'avatar-section';
  sliderSec.innerHTML = `
    <div class="avatar-section-title">📐 Tinh Chỉnh Tỷ Lệ Cơ Thể</div>
    <div class="slider-group">
      <div class="slider-row">
        <span class="slider-label">Chiều cao</span>
        <input type="range" class="slider-input" id="slideHeight" min="0.75" max="1.35" step="0.05" value="${workingConfig.heightScale}">
        <span class="slider-value" id="valHeight">${Math.round(workingConfig.heightScale * 100)}%</span>
      </div>
      <div class="slider-row">
        <span class="slider-label">Bề ngang thân</span>
        <input type="range" class="slider-input" id="slideWidth" min="0.75" max="1.45" step="0.05" value="${workingConfig.widthScale}">
        <span class="slider-value" id="valWidth">${Math.round(workingConfig.widthScale * 100)}%</span>
      </div>
      <div class="slider-row">
        <span class="slider-label">Tỷ lệ đầu</span>
        <input type="range" class="slider-input" id="slideHead" min="0.75" max="1.4" step="0.05" value="${workingConfig.headScale}">
        <span class="slider-value" id="valHead">${Math.round(workingConfig.headScale * 100)}%</span>
      </div>
    </div>
  `;
  container.appendChild(sliderSec);

  const sH = sliderSec.querySelector('#slideHeight');
  sH.oninput = (e) => {
    workingConfig.heightScale = parseFloat(e.target.value);
    sliderSec.querySelector('#valHeight').innerText = `${Math.round(workingConfig.heightScale * 100)}%`;
    updatePreviewAvatar(workingConfig);
  };
  const sW = sliderSec.querySelector('#slideWidth');
  sW.oninput = (e) => {
    workingConfig.widthScale = parseFloat(e.target.value);
    sliderSec.querySelector('#valWidth').innerText = `${Math.round(workingConfig.widthScale * 100)}%`;
    updatePreviewAvatar(workingConfig);
  };
  const sHd = sliderSec.querySelector('#slideHead');
  sHd.oninput = (e) => {
    workingConfig.headScale = parseFloat(e.target.value);
    sliderSec.querySelector('#valHead').innerText = `${Math.round(workingConfig.headScale * 100)}%`;
    updatePreviewAvatar(workingConfig);
  };
}

function renderFaceTab(container) {
  // 1. Head Shapes
  const headSec = document.createElement('div');
  headSec.className = 'avatar-section';
  headSec.innerHTML = `<div class="avatar-section-title">👤 Kiểu Dáng Đầu (Head Shape)</div>`;
  const headGrid = document.createElement('div');
  headGrid.className = 'catalog-grid';
  HEAD_SHAPES.forEach((hs) => {
    const card = document.createElement('div');
    card.className = `catalog-card ${workingConfig.headShape === hs.id ? 'active' : ''}`;
    card.innerHTML = `
      <div class="catalog-card-icon">${hs.icon}</div>
      <div class="catalog-card-name">${hs.name}</div>
      <div class="catalog-card-desc">${hs.desc}</div>
    `;
    card.onclick = () => {
      workingConfig.headShape = hs.id;
      updatePreviewAvatar(workingConfig);
      renderStudioContent();
    };
    headGrid.appendChild(card);
  });
  headSec.appendChild(headGrid);
  container.appendChild(headSec);

  // 2. Classic Faces (2D Decal Faces)
  const faceSec = document.createElement('div');
  faceSec.className = 'avatar-section';
  faceSec.innerHTML = `<div class="avatar-section-title">😀 Khuôn Mặt Kinh Điển (Classic Faces)</div>`;
  const faceGrid = document.createElement('div');
  faceGrid.className = 'catalog-grid';
  CLASSIC_FACES.forEach((cf) => {
    const card = document.createElement('div');
    card.className = `catalog-card ${workingConfig.classicFace === cf.id ? 'active' : ''}`;
    card.innerHTML = `
      <div class="catalog-card-icon">${cf.icon}</div>
      <div class="catalog-card-name">${cf.name}</div>
      <div class="catalog-card-desc">${cf.desc}</div>
    `;
    card.onclick = () => {
      workingConfig.classicFace = cf.id;
      updatePreviewAvatar(workingConfig);
      renderStudioContent();
    };
    faceGrid.appendChild(card);
  });
  faceSec.appendChild(faceGrid);
  container.appendChild(faceSec);
}

function renderHairTab(container) {
  // 1. Hair Styles
  const hairSec = document.createElement('div');
  hairSec.className = 'avatar-section';
  hairSec.innerHTML = `<div class="avatar-section-title">💇 Kiểu Tóc 3D (Hairstyles)</div>`;
  const hairGrid = document.createElement('div');
  hairGrid.className = 'catalog-grid';
  HAIR_STYLES.forEach((hs) => {
    const card = document.createElement('div');
    card.className = `catalog-card ${workingConfig.hairStyle === hs.id ? 'active' : ''}`;
    card.innerHTML = `
      <div class="catalog-card-icon">${hs.icon}</div>
      <div class="catalog-card-name">${hs.name}</div>
      <div class="catalog-card-desc">${hs.desc}</div>
    `;
    card.onclick = () => {
      workingConfig.hairStyle = hs.id;
      updatePreviewAvatar(workingConfig);
      renderStudioContent();
    };
    hairGrid.appendChild(card);
  });
  hairSec.appendChild(hairGrid);
  container.appendChild(hairSec);

  // 2. Hair Color Swatches
  const colorSec = document.createElement('div');
  colorSec.className = 'avatar-section';
  colorSec.innerHTML = `<div class="avatar-section-title">🎨 Bảng Màu Nhuộm Tóc</div>`;
  const colorGrid = document.createElement('div');
  colorGrid.className = 'color-swatches-grid';
  HAIR_COLORS.forEach((hc) => {
    const sw = document.createElement('button');
    sw.className = `color-swatch-item ${workingConfig.hairColor === hc.color ? 'active' : ''}`;
    sw.style.backgroundColor = hc.color;
    sw.title = hc.name;
    sw.onclick = () => {
      workingConfig.hairColor = hc.color;
      updatePreviewAvatar(workingConfig);
      renderStudioContent();
    };
    colorGrid.appendChild(sw);
  });
  colorSec.appendChild(colorGrid);
  container.appendChild(colorSec);
}

function renderLayeredTab(container) {
  // 1. Jackets
  const jacketSec = document.createElement('div');
  jacketSec.className = 'avatar-section';
  jacketSec.innerHTML = `<div class="avatar-section-title">🧥 Áo Khoác Ngoài 3D (Jackets)</div>`;
  const jacketGrid = document.createElement('div');
  jacketGrid.className = 'catalog-grid';
  LAYERED_JACKETS.forEach((item) => {
    const card = document.createElement('div');
    card.className = `catalog-card ${workingConfig.layeredClothing?.jacket === item.id ? 'active' : ''}`;
    card.innerHTML = `
      <div class="catalog-card-icon">${item.icon}</div>
      <div class="catalog-card-name">${item.name}</div>
      <div class="catalog-card-desc">${item.desc}</div>
    `;
    card.onclick = () => {
      workingConfig.layeredClothing.jacket = item.id;
      updatePreviewAvatar(workingConfig);
      renderStudioContent();
    };
    jacketGrid.appendChild(card);
  });
  jacketSec.appendChild(jacketGrid);
  container.appendChild(jacketSec);

  // 2. Sweaters & Hoodies
  const swSec = document.createElement('div');
  swSec.className = 'avatar-section';
  swSec.innerHTML = `<div class="avatar-section-title">🧶 Áo Len & Hoodie 3D (Sweaters)</div>`;
  const swGrid = document.createElement('div');
  swGrid.className = 'catalog-grid';
  LAYERED_SWEATERS.forEach((item) => {
    const card = document.createElement('div');
    card.className = `catalog-card ${workingConfig.layeredClothing?.sweater === item.id ? 'active' : ''}`;
    card.innerHTML = `
      <div class="catalog-card-icon">${item.icon}</div>
      <div class="catalog-card-name">${item.name}</div>
      <div class="catalog-card-desc">${item.desc}</div>
    `;
    card.onclick = () => {
      workingConfig.layeredClothing.sweater = item.id;
      updatePreviewAvatar(workingConfig);
      renderStudioContent();
    };
    swGrid.appendChild(card);
  });
  swSec.appendChild(swGrid);
  container.appendChild(swSec);

  // 3. Dresses & Skirts
  const skirtSec = document.createElement('div');
  skirtSec.className = 'avatar-section';
  skirtSec.innerHTML = `<div class="avatar-section-title">👗 Đầm & Chân Váy 3D (Dresses & Skirts)</div>`;
  const skirtGrid = document.createElement('div');
  skirtGrid.className = 'catalog-grid';
  LAYERED_DRESS_SKIRTS.forEach((item) => {
    const card = document.createElement('div');
    card.className = `catalog-card ${workingConfig.layeredClothing?.dressSkirt === item.id ? 'active' : ''}`;
    card.innerHTML = `
      <div class="catalog-card-icon">${item.icon}</div>
      <div class="catalog-card-name">${item.name}</div>
      <div class="catalog-card-desc">${item.desc}</div>
    `;
    card.onclick = () => {
      workingConfig.layeredClothing.dressSkirt = item.id;
      updatePreviewAvatar(workingConfig);
      renderStudioContent();
    };
    skirtGrid.appendChild(card);
  });
  skirtSec.appendChild(skirtGrid);
  container.appendChild(skirtSec);

  // 4. Shoes
  const shoeSec = document.createElement('div');
  shoeSec.className = 'avatar-section';
  shoeSec.innerHTML = `<div class="avatar-section-title">👟 Giày Dép 3D (Shoes)</div>`;
  const shoeGrid = document.createElement('div');
  shoeGrid.className = 'catalog-grid';
  LAYERED_SHOES.forEach((item) => {
    const card = document.createElement('div');
    card.className = `catalog-card ${workingConfig.layeredClothing?.shoes === item.id ? 'active' : ''}`;
    card.innerHTML = `
      <div class="catalog-card-icon">${item.icon}</div>
      <div class="catalog-card-name">${item.name}</div>
      <div class="catalog-card-desc">${item.desc}</div>
    `;
    card.onclick = () => {
      workingConfig.layeredClothing.shoes = item.id;
      updatePreviewAvatar(workingConfig);
      renderStudioContent();
    };
    shoeGrid.appendChild(card);
  });
  shoeSec.appendChild(shoeGrid);
  container.appendChild(shoeSec);
}

function renderClassicTab(container) {
  // 1. Classic Shirts
  const shirtSec = document.createElement('div');
  shirtSec.className = 'avatar-section';
  shirtSec.innerHTML = `<div class="avatar-section-title">👕 Áo Phông & Sơ Mi 2D (Classic Shirts)</div>`;
  const shirtGrid = document.createElement('div');
  shirtGrid.className = 'catalog-grid';
  CLASSIC_SHIRTS.forEach((item) => {
    const card = document.createElement('div');
    card.className = `catalog-card ${workingConfig.classicClothing?.shirt === item.id ? 'active' : ''}`;
    card.innerHTML = `
      <div class="catalog-card-icon">${item.icon}</div>
      <div class="catalog-card-name">${item.name}</div>
      <div class="catalog-card-desc">${item.desc}</div>
    `;
    card.onclick = () => {
      workingConfig.classicClothing.shirt = item.id;
      updatePreviewAvatar(workingConfig);
      renderStudioContent();
    };
    shirtGrid.appendChild(card);
  });
  shirtSec.appendChild(shirtGrid);
  container.appendChild(shirtSec);

  // 2. Classic Pants
  const pantsSec = document.createElement('div');
  pantsSec.className = 'avatar-section';
  pantsSec.innerHTML = `<div class="avatar-section-title">👖 Quần Vải & Jeans 2D (Classic Pants)</div>`;
  const pantsGrid = document.createElement('div');
  pantsGrid.className = 'catalog-grid';
  CLASSIC_PANTS.forEach((item) => {
    const card = document.createElement('div');
    card.className = `catalog-card ${workingConfig.classicClothing?.pants === item.id ? 'active' : ''}`;
    card.innerHTML = `
      <div class="catalog-card-icon">${item.icon}</div>
      <div class="catalog-card-name">${item.name}</div>
      <div class="catalog-card-desc">${item.desc}</div>
    `;
    card.onclick = () => {
      workingConfig.classicClothing.pants = item.id;
      updatePreviewAvatar(workingConfig);
      renderStudioContent();
    };
    pantsGrid.appendChild(card);
  });
  pantsSec.appendChild(pantsGrid);
  container.appendChild(pantsSec);
}
