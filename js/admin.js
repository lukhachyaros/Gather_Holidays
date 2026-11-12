import * as THREE from 'three';
import {
  emptyModelLibrary,
  instantiateModelAsset,
  instantiateDefaultModel,
  loadModelLibrary,
  MODEL_LIBRARY_FORMAT,
  MODEL_LIBRARY_STORAGE_KEY,
  MODEL_MAPS,
} from './model-library.js';

const ADMIN_ACCOUNTS = [
  { user: 'admin', hash: '5865b7b99b036a851472e1e1e085fa22239cd64c70d67974febfbff2eaabfd83' },
  { user: 'builder', hash: '01ae2a73cca8695cfbf7f930ca38d7984aed9fa1ff296d1a9ae6996b26600ee6' },
];

let library;
let scene;
let camera;
let renderer;
let controls;
let previewModel;
let selectedAssetId = null;
let previewRequest = 0;

const $ = id => document.getElementById(id);

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}

function showToast(message) {
  const toast = $('adminToast');
  toast.textContent = message;
  toast.classList.remove('hidden');
  window.setTimeout(() => toast.classList.add('hidden'), 3500);
}

function setAuthenticated() {
  $('adminAuthOverlay').classList.add('hidden');
  $('adminApp').classList.remove('hidden');
  setupStudio();
}

function setupStudio() {
  if (renderer) return;
  const container = $('viewport3D');
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0f1d);
  camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 2.2, 5);
  renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x444455, 1.6));
  const light = new THREE.DirectionalLight(0xffffff, 2);
  light.position.set(4, 8, 5);
  scene.add(light);
  const grid = new THREE.GridHelper(12, 24, 0x38bdf8, 0x263244);
  scene.add(grid);
  controls = createOrbitControls(renderer.domElement);
  resizeViewport();
  window.addEventListener('resize', resizeViewport);
  renderer.setAnimationLoop(() => {
    controls.update();
    renderer.render(scene, camera);
  });
}

function createOrbitControls(element) {
  const target = new THREE.Vector3(0, 1, 0);
  const spherical = { radius: 5, theta: 0, phi: Math.PI / 2.5 };
  let dragging = false;
  let previousX = 0;
  let previousY = 0;
  const update = () => {
    spherical.phi = THREE.MathUtils.clamp(spherical.phi, 0.1, Math.PI - 0.1);
    spherical.radius = THREE.MathUtils.clamp(spherical.radius, 1.2, 20);
    camera.position.set(
      target.x + spherical.radius * Math.sin(spherical.phi) * Math.sin(spherical.theta),
      target.y + spherical.radius * Math.cos(spherical.phi),
      target.z + spherical.radius * Math.sin(spherical.phi) * Math.cos(spherical.theta)
    );
    camera.lookAt(target);
  };
  element.addEventListener('pointerdown', event => {
    dragging = true;
    previousX = event.clientX;
    previousY = event.clientY;
    element.setPointerCapture(event.pointerId);
  });
  element.addEventListener('pointerup', () => { dragging = false; });
  element.addEventListener('pointermove', event => {
    if (!dragging) return;
    spherical.theta -= (event.clientX - previousX) * 0.008;
    spherical.phi -= (event.clientY - previousY) * 0.008;
    previousX = event.clientX;
    previousY = event.clientY;
    update();
  });
  element.addEventListener('wheel', event => {
    event.preventDefault();
    spherical.radius += event.deltaY * 0.005;
    update();
  }, { passive: false });
  update();
  return { target, update, spherical };
}

function resizeViewport() {
  if (!renderer) return;
  const container = $('viewport3D');
  const width = Math.max(1, container.clientWidth);
  const height = Math.max(1, container.clientHeight);
  renderer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function mapTargetKey(map, target) {
  return `${map}:${target}`;
}

function getReplacement(map, target) {
  return library.replacements.find(item => item.map === map && item.target === target);
}

function getAsset(id) {
  return library.assets.find(asset => asset.id === id);
}

function saveLocalLibrary() {
  localStorage.setItem(MODEL_LIBRARY_STORAGE_KEY, JSON.stringify(library));
}

function populateMaps() {
  const select = $('mapSelector');
  select.replaceChildren();
  for (const [key, map] of Object.entries(MODEL_MAPS)) {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = map.label;
    select.append(option);
  }
  populateTargets();
}

function populateTargets() {
  const map = $('mapSelector').value;
  const select = $('targetSelector');
  select.replaceChildren();
  for (const [key, label] of Object.entries(MODEL_MAPS[map].targets)) {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = label;
    select.append(option);
  }
  updateCurrentReplacement();
  renderLibraryList();
}

function updateCurrentReplacement() {
  const map = $('mapSelector').value;
  const target = $('targetSelector').value;
  const replacement = getReplacement(map, target);
  const asset = replacement && getAsset(replacement.assetId);
  $('currentReplacement').textContent = asset
    ? `Đang dùng: ${asset.name}`
    : 'Đang dùng model mặc định của game.';
  $('btnClearReplacement').disabled = !replacement;
  previewCurrentTarget();
}

function renderLibraryList() {
  const list = $('libraryList');
  list.replaceChildren();
  let count = 0;
  for (const [mapKey, map] of Object.entries(MODEL_MAPS)) {
    const replacements = library.replacements.filter(item => item.map === mapKey);
    if (!replacements.length) continue;
    const heading = document.createElement('div');
    heading.className = 'library-map-heading';
    heading.textContent = map.label;
    list.append(heading);
    for (const replacement of replacements) {
      const asset = getAsset(replacement.assetId);
      if (!asset) continue;
      const button = document.createElement('button');
      button.className = 'library-item';
      button.type = 'button';
      button.classList.toggle('active', asset.id === selectedAssetId);
      button.textContent = `${MODEL_MAPS[mapKey].targets[replacement.target] || replacement.target} · ${asset.name}`;
      button.addEventListener('click', () => selectAsset(asset.id));
      list.append(button);
      count++;
    }
  }
  const unassigned = library.assets.filter(asset =>
    !library.replacements.some(replacement => replacement.assetId === asset.id)
  );
  if (unassigned.length) {
    const heading = document.createElement('div');
    heading.className = 'library-map-heading';
    heading.textContent = 'Chưa gán bản đồ';
    list.append(heading);
    for (const asset of unassigned) {
      const button = document.createElement('button');
      button.className = 'library-item';
      button.type = 'button';
      button.classList.toggle('active', asset.id === selectedAssetId);
      button.textContent = asset.name;
      button.addEventListener('click', () => selectAsset(asset.id));
      list.append(button);
      count++;
    }
  }
  if (!count) {
    const empty = document.createElement('div');
    empty.className = 'library-empty';
    empty.textContent = 'Chưa có model. Thả tệp .js hoặc .json vào khu vực phía trên.';
    list.append(empty);
  }
}

async function selectAsset(assetId, preparedModel = null) {
  selectedAssetId = assetId;
  const asset = getAsset(assetId);
  if (!asset) return;
  $('selectedModelName').textContent = asset.name;
  $('selectedModelInfo').textContent = `Định dạng ${asset.format.toUpperCase()} · Tải lên thư viện model`;
  $('btnAssignModel').disabled = false;
  $('btnRemoveModel').disabled = false;
  renderLibraryList();
  await previewAsset(asset, preparedModel);
}

async function previewAsset(asset, preparedModel = null) {
  const requestId = ++previewRequest;
  $('emptyPreview').classList.add('hidden');
  try {
    const model = preparedModel || await instantiateModelAsset(asset);
    showPreviewModel(model, `Thư viện: ${asset.name}`, requestId);
  } catch (error) {
    $('emptyPreview').textContent = `Không xem trước được model: ${error.message}`;
    $('emptyPreview').classList.remove('hidden');
    console.error('Could not preview model:', error);
  }
}

function showPreviewModel(model, label, requestId) {
  if (requestId !== previewRequest) return;
  if (previewModel) scene.remove(previewModel);
  previewModel = model;
  const bounds = new THREE.Box3().setFromObject(previewModel);
  const size = bounds.getSize(new THREE.Vector3());
  const maxSize = Math.max(size.x, size.y, size.z);
  if (maxSize > 0) previewModel.scale.multiplyScalar(2.4 / maxSize);
  bounds.setFromObject(previewModel);
  const previewSize = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  previewModel.position.x -= center.x;
  previewModel.position.y -= bounds.min.y;
  previewModel.position.z -= center.z;
  scene.add(previewModel);
  controls.target.set(0, Math.max(0.5, previewSize.y * 0.35), 0);
  controls.update();
  $('previewLabel').textContent = label;
  $('emptyPreview').classList.add('hidden');
}

async function previewCurrentTarget(showDefault = false) {
  const requestId = ++previewRequest;
  const map = $('mapSelector').value;
  const target = $('targetSelector').value;
  if (!map || !target || !scene) return;

  try {
    const replacement = !showDefault && getReplacement(map, target);
    const asset = replacement && getAsset(replacement.assetId);
    const model = asset
      ? await instantiateModelAsset(asset)
      : instantiateDefaultModel(map, target);
    const mapName = MODEL_MAPS[map].label;
    const targetName = MODEL_MAPS[map].targets[target];
    const label = asset && !showDefault
      ? `${mapName} · ${targetName} · Model thay thế: ${asset.name}`
      : `${mapName} · ${targetName} · Model gốc`;
    showPreviewModel(model, label, requestId);
  } catch (error) {
    if (requestId !== previewRequest) return;
    $('emptyPreview').textContent = `Không xem trước được model gốc: ${error.message}`;
    $('emptyPreview').classList.remove('hidden');
    console.error(`Could not preview default model for ${map}/${target}:`, error);
  }
}

async function addModelFile(file) {
  const extension = file.name.split('.').pop().toLowerCase();
  if (!['js', 'json'].includes(extension)) throw new Error('Chỉ nhận tệp .js hoặc .json.');
  const baseName = file.name.replace(/\.[^.]+$/, '');
  const asset = {
    id: crypto.randomUUID(),
    name: baseName,
    format: extension,
  };
  const content = await file.text();
  if (extension === 'js') {
    asset.source = content;
  } else {
    asset.data = JSON.parse(content);
  }
  const model = await instantiateModelAsset(asset);
  library.assets.push(asset);
  selectedAssetId = asset.id;
  const replacement = {
    map: $('mapSelector').value,
    target: $('targetSelector').value,
    assetId: asset.id,
  };
  library.replacements = library.replacements.filter(
    item => mapTargetKey(item.map, item.target) !== mapTargetKey(replacement.map, replacement.target)
  );
  library.replacements.push(replacement);
  saveLocalLibrary();
  renderLibraryList();
  updateCurrentReplacement();
  await selectAsset(asset.id, model);
  showToast(`Đã thêm và gán model "${asset.name}".`);
}

async function handleModelFiles(files) {
  for (const file of files) {
    try {
      await addModelFile(file);
    } catch (error) {
      console.error(`Could not import ${file.name}:`, error);
      showToast(`Không nạp được ${file.name}: ${error.message}`);
    }
  }
}

function assignSelectedAsset() {
  if (!selectedAssetId || !getAsset(selectedAssetId)) return;
  const replacement = {
    map: $('mapSelector').value,
    target: $('targetSelector').value,
    assetId: selectedAssetId,
  };
  library.replacements = library.replacements.filter(
    item => mapTargetKey(item.map, item.target) !== mapTargetKey(replacement.map, replacement.target)
  );
  library.replacements.push(replacement);
  saveLocalLibrary();
  renderLibraryList();
  updateCurrentReplacement();
  showToast('Đã thay model cho bản đồ này.');
}

function removeSelectedAsset() {
  if (!selectedAssetId) return;
  const asset = getAsset(selectedAssetId);
  library.assets = library.assets.filter(item => item.id !== selectedAssetId);
  library.replacements = library.replacements.filter(item => item.assetId !== selectedAssetId);
  selectedAssetId = null;
  if (previewModel) scene.remove(previewModel);
  previewModel = null;
  $('selectedModelName').textContent = 'Chưa chọn model';
  $('selectedModelInfo').textContent = 'Model đã được xóa khỏi thư viện.';
  $('btnAssignModel').disabled = true;
  $('btnRemoveModel').disabled = true;
  saveLocalLibrary();
  renderLibraryList();
  updateCurrentReplacement();
  showToast(`Đã xóa model "${asset.name}".`);
}

function clearCurrentReplacement() {
  const map = $('mapSelector').value;
  const target = $('targetSelector').value;
  library.replacements = library.replacements.filter(
    item => mapTargetKey(item.map, item.target) !== mapTargetKey(map, target)
  );
  saveLocalLibrary();
  renderLibraryList();
  updateCurrentReplacement();
  showToast('Đã khôi phục model mặc định.');
}

function downloadLibrary() {
  const blob = new Blob([JSON.stringify(library, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'model-library.json';
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast('Đã xuất model-library.json. Hãy lưu tệp này vào design_model/ rồi push repo.');
}

async function importLibraryFile(file) {
  const imported = JSON.parse(await file.text());
  if (
    imported?.format !== MODEL_LIBRARY_FORMAT ||
    imported.version !== 1 ||
    !Array.isArray(imported.assets) ||
    !Array.isArray(imported.replacements)
  ) {
    throw new Error('Tệp không phải cấu hình Gather Model Library hợp lệ.');
  }
  const assetIds = new Set();
  for (const asset of imported.assets) {
    if (
      typeof asset.id !== 'string' ||
      typeof asset.name !== 'string' ||
      !['js', 'json'].includes(asset.format) ||
      (asset.format === 'js' && typeof asset.source !== 'string') ||
      (asset.format === 'json' && !asset.data)
    ) {
      throw new Error('Cấu hình chứa model không hợp lệ.');
    }
    if (assetIds.has(asset.id)) throw new Error(`ID model bị trùng: ${asset.id}.`);
    assetIds.add(asset.id);
  }
  for (const replacement of imported.replacements) {
    if (
      !MODEL_MAPS[replacement.map]?.targets[replacement.target] ||
      !assetIds.has(replacement.assetId)
    ) {
      throw new Error('Cấu hình chứa gán model không hợp lệ.');
    }
  }
  library = imported;
  saveLocalLibrary();
  selectedAssetId = null;
  renderLibraryList();
  updateCurrentReplacement();
  showToast('Đã nạp cấu hình thư viện model.');
}

function bindUI() {
  $('mapSelector').addEventListener('change', populateTargets);
  $('targetSelector').addEventListener('change', updateCurrentReplacement);
  $('btnAssignModel').addEventListener('click', assignSelectedAsset);
  $('btnRemoveModel').addEventListener('click', removeSelectedAsset);
  $('btnClearReplacement').addEventListener('click', clearCurrentReplacement);
  $('btnPreviewDefault').addEventListener('click', () => previewCurrentTarget(true));
  $('btnPreviewActive').addEventListener('click', () => previewCurrentTarget());
  $('btnResetCamera').addEventListener('click', () => {
    controls.spherical.radius = 5;
    controls.spherical.theta = 0;
    controls.spherical.phi = Math.PI / 2.5;
    controls.target.set(0, 1, 0);
    controls.update();
  });
  $('btnSaveLibrary').addEventListener('click', () => {
    try {
      saveLocalLibrary();
      showToast('Đã lưu thư viện trên trình duyệt này.');
    } catch (error) {
      console.error('Could not save model library:', error);
      showToast(`Không lưu được thư viện: ${error.message}`);
    }
  });
  $('btnExportLibrary').addEventListener('click', downloadLibrary);
  $('btnImportLibrary').addEventListener('click', () => $('libraryConfigInput').click());
  $('libraryConfigInput').addEventListener('change', async event => {
    const [file] = event.target.files;
    event.target.value = '';
    if (!file) return;
    try {
      await importLibraryFile(file);
    } catch (error) {
      console.error('Could not import model library:', error);
      showToast(`Không nạp được cấu hình: ${error.message}`);
    }
  });
  $('modelFileInput').addEventListener('change', event => {
    const files = [...event.target.files];
    event.target.value = '';
    handleModelFiles(files);
  });
  const dropZone = $('modelDropZone');
  dropZone.addEventListener('dragover', event => {
    event.preventDefault();
    dropZone.classList.add('drag-over');
  });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', event => {
    event.preventDefault();
    dropZone.classList.remove('drag-over');
    handleModelFiles([...event.dataTransfer.files]);
  });
}

async function startStudio() {
  setAuthenticated();
  library = emptyModelLibrary();
  populateMaps();
  bindUI();
  try {
    library = await loadModelLibrary();
    renderLibraryList();
    updateCurrentReplacement();
  } catch (error) {
    console.error('Could not load model library:', error);
    showToast(`Không tải được cấu hình mẫu: ${error.message}. Bạn vẫn có thể chọn bản đồ và nạp model.`);
  }
}

function initAuth() {
  $('adminLoginForm').addEventListener('submit', async event => {
    event.preventDefault();
    const username = $('adminUsername').value.trim();
    const password = $('adminPassword').value;
    const passHash = await sha256(password);
    const found = ADMIN_ACCOUNTS.find(item => item.user === username && item.hash === passHash);
    if (!found) {
      $('authErrorMsg').textContent = 'Tài khoản hoặc mật khẩu không chính xác.';
      $('authErrorMsg').classList.remove('hidden');
      return;
    }
    sessionStorage.setItem('gather_admin_auth', JSON.stringify({ user: found.user, time: Date.now() }));
    startStudio();
  });
  $('btnAdminLogout').addEventListener('click', () => {
    sessionStorage.removeItem('gather_admin_auth');
    location.reload();
  });
  if (sessionStorage.getItem('gather_admin_auth')) startStudio();
}

window.addEventListener('DOMContentLoaded', initAuth);
