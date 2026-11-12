import * as THREE from 'three';
import { THEMES } from './themes.js';
import {
  buildCampfire,
  buildCarvedPumpkin,
  buildCasinoExitPortal,
  buildCasinoPubBar,
  buildCinemaScreen,
  buildCostumeBooth,
  buildCoupleSofa,
  buildDragonAltar,
  buildDuckDerbyTrack,
  buildFirecrackerTable,
  buildFireworkLauncher,
  buildGiantChristmasTree,
  buildGiantMaiTree,
  buildGiantPumpkin,
  buildIllusionWall,
  buildLoveFountain,
  buildLogSeat,
  buildOngLocStatue,
  buildOngPhucStatue,
  buildOngThoStatue,
  buildOrnamentTable,
  buildPhucLocThoShrine,
  buildPlinkoBoard,
  buildBlackjackTable,
  buildProp,
  buildRoseArch,
  buildRouletteTable,
  buildSecretPaperNote,
  buildSecretPassage,
  buildSingleChair,
  buildSnowman,
  buildSlotMachine,
  buildTree,
  buildValentineHeartTree,
  buildVampireNPC,
} from './props.js';

export const MODEL_LIBRARY_STORAGE_KEY = 'gather_model_library_v1';
export const MODEL_LIBRARY_FORMAT = 'gather-model-library';

const COMMON_MAP_TARGETS = {
  map_tree: 'Cây cảnh trên bản đồ',
  roof_prop: 'Đồ trang trí trên tường',
  cinema_screen: 'Màn hình rạp chiếu phim',
  single_chair: 'Ghế đơn',
  couple_sofa: 'Ghế sofa đôi',
};

export const MODEL_MAPS = {
  christmas: {
    label: 'Giáng sinh',
    targets: {
      ...COMMON_MAP_TARGETS,
      xmas_tree: 'Cây thông Noel',
      ornament_table: 'Bàn trang trí',
      campfire: 'Lửa trại',
      log_seat: 'Ghế khúc gỗ',
      snowman: 'Người tuyết',
      illusion_wall: 'Bức tường ảo ảnh',
      secret_passage: 'Lối đi bí mật',
      secret_note: 'Mảnh giấy bí mật',
    },
  },
  halloween: {
    label: 'Halloween',
    targets: {
      ...COMMON_MAP_TARGETS,
      giant_pumpkin: 'Đại bí ngô',
      small_pumpkin: 'Bí ngô nhỏ',
      costume_booth: 'Quầy trang phục',
      illusion_wall: 'Bức tường ảo ảnh',
      secret_passage: 'Lối đi bí mật',
      secret_note: 'Mảnh giấy bí mật',
      vampire_npc: 'Ma cà rồng bay',
    },
  },
  tet: {
    label: 'Tết',
    targets: {
      ...COMMON_MAP_TARGETS,
      mai_tree: 'Cây mai',
      phuc_loc_tho_shrine: 'Điện Phúc Lộc Thọ',
      ong_phuc_statue: 'Tượng Ông Phúc',
      ong_loc_statue: 'Tượng Ông Lộc',
      ong_tho_statue: 'Tượng Ông Thọ',
      dragon_altar: 'Đài triệu hồi rồng',
      firework_launcher: 'Bệ phóng pháo hoa',
      firecracker_table: 'Bàn pháo tép',
      illusion_wall: 'Bức tường ảo ảnh',
      secret_passage: 'Lối đi bí mật',
      secret_note: 'Mảnh giấy bí mật',
    },
  },
  valentine: {
    label: 'Valentine',
    targets: {
      ...COMMON_MAP_TARGETS,
      heart_tree: 'Cây trái tim',
      love_fountain: 'Suối ước nguyện',
      rose_arch: 'Cổng hoa hồng',
      illusion_wall: 'Bức tường ảo ảnh',
      secret_passage: 'Lối đi bí mật',
      secret_note: 'Mảnh giấy bí mật',
    },
  },
  casino: {
    label: 'Casino',
    targets: {
      ...COMMON_MAP_TARGETS,
      casino_pub: 'Quầy pub',
      roulette: 'Bàn roulette',
      duck_derby: 'Đường đua vịt',
      blackjack: 'Bàn blackjack',
      slot_machine: 'Máy slot',
      plinko: 'Bàn plinko',
      casino_exit: 'Cửa thoát hiểm',
    },
  },
};

export function emptyModelLibrary() {
  return { format: MODEL_LIBRARY_FORMAT, version: 1, assets: [], replacements: [] };
}

function validateModelLibrary(value) {
  if (
    !value ||
    value.format !== MODEL_LIBRARY_FORMAT ||
    value.version !== 1 ||
    !Array.isArray(value.assets) ||
    !Array.isArray(value.replacements)
  ) {
    throw new Error('Tệp thư viện model không đúng định dạng.');
  }
  return value;
}

function mergeLibraries(base, overrides) {
  const assets = new Map(base.assets.map(asset => [asset.id, asset]));
  for (const asset of overrides.assets) assets.set(asset.id, asset);
  const replacements = new Map(base.replacements.map(item => [`${item.map}:${item.target}`, item]));
  for (const item of overrides.replacements) replacements.set(`${item.map}:${item.target}`, item);
  return {
    format: MODEL_LIBRARY_FORMAT,
    version: 1,
    assets: [...assets.values()],
    replacements: [...replacements.values()],
  };
}

let staticLibraryPromise;

export async function loadModelLibrary() {
  if (!staticLibraryPromise) {
    staticLibraryPromise = fetch('./design_model/model-library.json')
      .then(response => {
        if (!response.ok) throw new Error(`Không tải được thư viện model (${response.status}).`);
        return response.json();
      })
      .then(validateModelLibrary);
  }
  const base = await staticLibraryPromise;
  const localValue = localStorage.getItem(MODEL_LIBRARY_STORAGE_KEY);
  if (!localValue) return structuredClone(base);
  return mergeLibraries(base, validateModelLibrary(JSON.parse(localValue)));
}

export async function instantiateModelAsset(asset) {
  let object;
  if (asset.format === 'json') {
    object = new THREE.ObjectLoader().parse(asset.data);
    if (!object?.isObject3D) throw new Error('Tệp JSON phải là một Three.js Object JSON.');
  } else if (asset.format !== 'js' || typeof asset.source !== 'string') {
    throw new Error('Model phải là Three.js Object JSON hoặc module JavaScript.');
  } else {
    const url = URL.createObjectURL(new Blob([asset.source], { type: 'text/javascript' }));
    try {
      const module = await import(url);
      const exports = Object.entries(module);
      const modelName = asset.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      const namedFactories = exports.filter(([name, value]) =>
        typeof value === 'function' && /^(create|build|make)/i.test(name)
      );
      const matchingFactory = namedFactories.find(([name]) =>
        name.toLowerCase().replace(/^(create|build|make)/, '').replace(/[^a-z0-9]/g, '').startsWith(modelName)
      );
      const genericFactories = namedFactories.filter(([name]) =>
        /^(create|build|make)(model|object|group)$/i.test(name)
      );
      const factory = module.createModel ||
        module.default ||
        matchingFactory?.[1] ||
        (genericFactories.length === 1 ? genericFactories[0][1] : null) ||
        (namedFactories.length === 1 ? namedFactories[0][1] : null) ||
        (exports.filter(([, value]) => typeof value === 'function').length === 1
          ? exports.find(([, value]) => typeof value === 'function')[1]
          : null);
      if (typeof factory !== 'function') {
        const exportNames = exports.map(([name]) => name).join(', ') || 'không có export';
        throw new Error(
          `Module .js cần export createModel(), export default, hoặc hàm create${asset.name}/build${asset.name}(). Export tìm thấy: ${exportNames}.`
        );
      }
      const modelContext = { ...THREE, THREE };
      object = await factory(modelContext);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  if (!object?.isObject3D) throw new Error('Hàm tạo model phải trả về một THREE.Object3D.');
  const bounds = new THREE.Box3().setFromObject(object);
  if (bounds.isEmpty() || ![bounds.min.x, bounds.min.y, bounds.min.z, bounds.max.x, bounds.max.y, bounds.max.z].every(Number.isFinite)) {
    throw new Error('Model cần có hình học 3D với kích thước hợp lệ.');
  }
  return object;
}

export async function instantiateReplacement(map, target) {
  const library = await loadModelLibrary();
  const isShrineStatue = ['ong_phuc_statue', 'ong_loc_statue', 'ong_tho_statue'].includes(target);
  if (
    map === 'tet' &&
    isShrineStatue &&
    library.replacements.some(item => item.map === map && item.target === 'phuc_loc_tho_shrine')
  ) {
    return null;
  }
  const replacement = library.replacements.find(item => item.map === map && item.target === target);
  if (!replacement) return null;
  const asset = library.assets.find(item => item.id === replacement.assetId);
  if (!asset) throw new Error(`Không tìm thấy model được gán cho ${map}/${target}.`);
  return instantiateModelAsset(asset);
}

export function instantiateDefaultModel(map, target) {
  const builders = {
    'christmas:map_tree': () => buildTree('christmas'),
    'halloween:map_tree': () => buildTree('halloween'),
    'tet:map_tree': () => buildTree('tet'),
    'valentine:map_tree': () => buildTree('valentine'),
    'casino:map_tree': () => buildTree('casino'),
    'christmas:roof_prop': () => buildProp(THEMES.christmas.prop),
    'halloween:roof_prop': () => buildProp(THEMES.halloween.prop),
    'tet:roof_prop': () => buildProp(THEMES.tet.prop),
    'valentine:roof_prop': () => buildProp(THEMES.valentine.prop),
    'casino:roof_prop': () => buildProp(THEMES.casino.prop),
    'christmas:cinema_screen': buildCinemaScreen,
    'halloween:cinema_screen': buildCinemaScreen,
    'tet:cinema_screen': buildCinemaScreen,
    'valentine:cinema_screen': buildCinemaScreen,
    'casino:cinema_screen': buildCinemaScreen,
    'christmas:single_chair': buildSingleChair,
    'halloween:single_chair': buildSingleChair,
    'tet:single_chair': buildSingleChair,
    'valentine:single_chair': buildSingleChair,
    'casino:single_chair': buildSingleChair,
    'christmas:couple_sofa': buildCoupleSofa,
    'halloween:couple_sofa': buildCoupleSofa,
    'tet:couple_sofa': buildCoupleSofa,
    'valentine:couple_sofa': buildCoupleSofa,
    'casino:couple_sofa': buildCoupleSofa,
    'christmas:xmas_tree': () => buildGiantChristmasTree().group,
    'christmas:ornament_table': buildOrnamentTable,
    'christmas:campfire': buildCampfire,
    'christmas:log_seat': buildLogSeat,
    'christmas:snowman': () => buildSnowman(0),
    'christmas:illusion_wall': () => buildIllusionWall('christmas'),
    'christmas:secret_passage': () => buildSecretPassage('christmas'),
    'christmas:secret_note': () => buildSecretPaperNote('Preview'),
    'halloween:giant_pumpkin': buildGiantPumpkin,
    'halloween:small_pumpkin': () => buildCarvedPumpkin('classic', 1.15),
    'halloween:costume_booth': () => buildCostumeBooth('default'),
    'halloween:illusion_wall': () => buildIllusionWall('halloween'),
    'halloween:secret_passage': () => buildSecretPassage('halloween'),
    'halloween:secret_note': () => buildSecretPaperNote('Preview'),
    'halloween:vampire_npc': buildVampireNPC,
    'tet:mai_tree': buildGiantMaiTree,
    'tet:phuc_loc_tho_shrine': buildPhucLocThoShrine,
    'tet:ong_phuc_statue': buildOngPhucStatue,
    'tet:ong_loc_statue': buildOngLocStatue,
    'tet:ong_tho_statue': buildOngThoStatue,
    'tet:dragon_altar': buildDragonAltar,
    'tet:firework_launcher': buildFireworkLauncher,
    'tet:firecracker_table': buildFirecrackerTable,
    'tet:illusion_wall': () => buildIllusionWall('tet'),
    'tet:secret_passage': () => buildSecretPassage('tet'),
    'tet:secret_note': () => buildSecretPaperNote('Preview'),
    'valentine:heart_tree': buildValentineHeartTree,
    'valentine:love_fountain': buildLoveFountain,
    'valentine:rose_arch': buildRoseArch,
    'valentine:illusion_wall': () => buildIllusionWall('valentine'),
    'valentine:secret_passage': () => buildSecretPassage('valentine'),
    'valentine:secret_note': () => buildSecretPaperNote('Preview'),
    'casino:casino_pub': buildCasinoPubBar,
    'casino:roulette': buildRouletteTable,
    'casino:duck_derby': buildDuckDerbyTrack,
    'casino:blackjack': buildBlackjackTable,
    'casino:slot_machine': buildSlotMachine,
    'casino:plinko': buildPlinkoBoard,
    'casino:casino_exit': buildCasinoExitPortal,
  };
  const builder = builders[`${map}:${target}`];
  if (!builder) throw new Error(`Không có model mặc định cho ${map}/${target}.`);
  return builder();
}
