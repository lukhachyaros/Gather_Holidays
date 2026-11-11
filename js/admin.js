// Gather Holidays 3D — Admin Studio & Builder Script
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Avatar } from './avatar.js';
import { G, part, mat } from './props.js';

/* =========================================================================
   1. BẢO MẬT & XÁC THỰC TÀI KHOẢN ADMIN ĐƯỢC CẤP RIÊNG
   ========================================================================= */

const ADMIN_ACCOUNTS = [
  {
    user: 'admin',
    // SHA-256 của 'GatherAdmin2026@'
    hash: '5865b7b99b036a851472e1e1e085fa22239cd64c70d67974febfbff2eaabfd83',
    role: 'SuperAdmin'
  },
  {
    user: 'builder',
    // SHA-256 của 'Builder3D!Pro'
    hash: '01ae2a73cca8695cfbf7f930ca38d7984aed9fa1ff296d1a9ae6996b26600ee6',
    role: '3DModeler'
  }
];

async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function initAuth() {
  const overlay = document.getElementById('adminAuthOverlay');
  const app = document.getElementById('adminApp');
  const userIn = document.getElementById('adminUsername');
  const passIn = document.getElementById('adminPassword');
  const errBox = document.getElementById('authErrorMsg');
  const btnLogin = document.getElementById('btnLogin');
  const btnLogout = document.getElementById('btnAdminLogout');

  // Kiểm tra phiên đăng nhập đã lưu trong sessionStorage
  const savedToken = sessionStorage.getItem('gather_admin_auth');
  if (savedToken) {
    overlay.classList.add('hidden');
    app.classList.remove('hidden');
    setupStudio();
  }

  async function handleLogin() {
    const username = userIn.value.trim();
    const password = passIn.value.trim();
    errBox.classList.add('hidden');

    if (!username || !password) {
      errBox.textContent = 'Vui lòng nhập đầy đủ tài khoản và mật khẩu admin.';
      errBox.classList.remove('hidden');
      return;
    }

    const passHash = await sha256(password);
    const found = ADMIN_ACCOUNTS.find(acc => acc.user === username && acc.hash === passHash);

    if (found) {
      sessionStorage.setItem('gather_admin_auth', JSON.stringify({ user: found.user, role: found.role, time: Date.now() }));
      overlay.classList.add('hidden');
      app.classList.remove('hidden');
      setupStudio();
    } else {
      errBox.textContent = 'Tài khoản hoặc mật khẩu không chính xác hoặc chưa được cấp quyền.';
      errBox.classList.remove('hidden');
    }
  }

  btnLogin.addEventListener('click', handleLogin);
  passIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleLogin(); });

  btnLogout.addEventListener('click', () => {
    sessionStorage.removeItem('gather_admin_auth');
    location.reload();
  });
}

function showToast(msg) {
  const t = document.getElementById('adminToast');
  if (!t) return;
  t.textContent = msg;
  t.classList.remove('hidden');
  setTimeout(() => { t.classList.add('hidden'); }, 3000);
}

/* =========================================================================
   2. KHỞI TẠO 3D VIEWPORT & CAMERA ORBIT CONTROLS
   ========================================================================= */

let scene, camera, renderer, gridHelper;
let targetModel = null;
let currentPresetKey = 'human_rig';
let currentMode = 'avatar'; // 'avatar' | 'props'
let selectedObject = null;
let activeAnimations = [];
let mixer = null;
let isPlaying = false;
let animClock = new THREE.Clock();
let recordedKeyframes = [];
let avatarInstance = null;

function setupStudio() {
  const container = document.getElementById('viewport3D');
  if (scene) return; // Đã khởi tạo

  const w = container.clientWidth || window.innerWidth - 700;
  const h = container.clientHeight || window.innerHeight - 100;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0f1d);

  camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
  camera.position.set(0, 1.8, 3.8);

  renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  container.appendChild(renderer.domElement);

  // Ánh sáng Studio
  const hemi = new THREE.HemisphereLight(0xffffff, 0x444455, 1.2);
  scene.add(hemi);

  const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
  dirLight.position.set(5, 8, 5);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(1024, 1024);
  scene.add(dirLight);

  const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.6);
  fillLight.position.set(-5, 3, -4);
  scene.add(fillLight);

  // Lưới sàn Studio (Grid & Floor)
  gridHelper = new THREE.GridHelper(10, 20, 0x38bdf8, 0x1f2937);
  gridHelper.position.y = 0;
  scene.add(gridHelper);

  const floorGeo = new THREE.PlaneGeometry(20, 20);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x070b14, roughness: 0.9, metalness: 0.1 });
  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.receiveShadow = true;
  scene.add(floorMesh);

  // Orbit controls đơn giản bằng chuột
  setupMouseOrbit(container);

  // Load Model mặc định
  loadModelPreset('human_rig');

  // Gắn các sự kiện UI
  bindUIEvents();

  // Vòng lặp Render
  function animate() {
    requestAnimationFrame(animate);
    const delta = animClock.getDelta();

    if (avatarInstance && isPlaying) {
      avatarInstance.update(delta);
    } else if (mixer && isPlaying) {
      mixer.update(delta);
      updateScrubberUI();
    }

    renderer.render(scene, camera);
  }
  animate();

  window.addEventListener('resize', () => {
    const nw = container.clientWidth;
    const nh = container.clientHeight;
    camera.aspect = nw / nh;
    camera.updateProjectionMatrix();
    renderer.setSize(nw, nh);
  });
}

function setupMouseOrbit(domElement) {
  let isDragging = false;
  let isPanning = false;
  let prevX = 0, prevY = 0;
  let spherical = { radius: 3.8, theta: 0, phi: Math.PI / 2.3 };
  const target = new THREE.Vector3(0, 0.9, 0);

  function updateCam() {
    spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));
    spherical.radius = Math.max(0.5, Math.min(15, spherical.radius));
    camera.position.x = target.x + spherical.radius * Math.sin(spherical.phi) * Math.sin(spherical.theta);
    camera.position.y = target.y + spherical.radius * Math.cos(spherical.phi);
    camera.position.z = target.z + spherical.radius * Math.sin(spherical.phi) * Math.cos(spherical.theta);
    camera.lookAt(target);
  }
  updateCam();

  domElement.addEventListener('mousedown', (e) => {
    if (e.button === 0) isDragging = true;
    if (e.button === 2) isPanning = true;
    prevX = e.clientX;
    prevY = e.clientY;
  });

  window.addEventListener('mouseup', () => { isDragging = false; isPanning = false; });
  domElement.addEventListener('contextmenu', e => e.preventDefault());

  window.addEventListener('mousemove', (e) => {
    const dx = e.clientX - prevX;
    const dy = e.clientY - prevY;
    prevX = e.clientX;
    prevY = e.clientY;

    if (isDragging) {
      spherical.theta -= dx * 0.008;
      spherical.phi -= dy * 0.008;
      updateCam();
    } else if (isPanning) {
      target.y += dy * 0.005;
      updateCam();
    }
  });

  domElement.addEventListener('wheel', (e) => {
    e.preventDefault();
    spherical.radius += e.deltaY * 0.003;
    updateCam();
  }, { passive: false });

  document.getElementById('btnResetCamera').addEventListener('click', () => {
    spherical = { radius: 3.8, theta: 0, phi: Math.PI / 2.3 };
    target.set(0, 0.9, 0);
    updateCam();
  });
}

/* =========================================================================
   3. NẠP VÀ BUILD CÁC MODEL (HUMAN RIG, GLB, PROPS)
   ========================================================================= */

function clearTargetModel() {
  if (targetModel) {
    scene.remove(targetModel);
    targetModel = null;
  }
  selectedObject = null;
  mixer = null;
  avatarInstance = null;
  isPlaying = false;
  recordedKeyframes = [];
  updateKeyframeListUI();
  updateHierarchyUI([]);
  updateInspectorUI();
}

async function loadModelPreset(type) {
  clearTargetModel();
  currentPresetKey = type;
  const nameInput = document.getElementById('modelCustomName');

  if (type === 'human_rig') {
    currentMode = 'avatar';
    nameInput.value = 'HumanRig_Character';
    document.getElementById('avatarOptionsGroup').style.display = 'block';
    document.getElementById('boneQuickPoses').style.display = 'block';

    avatarInstance = new Avatar(null, { name: 'AdminRig', hue: 200, costume: 'default' });
    targetModel = avatarInstance.root;
    targetModel.name = 'HumanRig_Root';
    scene.add(targetModel);

    setupRigHierarchy(avatarInstance);
    populateClips(['Idle', 'wave', 'handshake', 'hug', 'trickOrTreat', 'cheer_jump', 'flex', 'dab', 'starfish', 'head_heart', 'kneel']);
  }
  else if (type === 'robot_expressive') {
    currentMode = 'avatar';
    nameInput.value = 'RobotExpressive_Model';
    document.getElementById('avatarOptionsGroup').style.display = 'none';
    document.getElementById('boneQuickPoses').style.display = 'none';

    const loader = new GLTFLoader();
    loader.load('./assets/models/RobotExpressive.glb', (gltf) => {
      targetModel = gltf.scene;
      targetModel.name = 'RobotExpressive_Root';
      targetModel.scale.set(0.65, 0.65, 0.65);
      scene.add(targetModel);

      if (gltf.animations && gltf.animations.length) {
        mixer = new THREE.AnimationMixer(targetModel);
        activeAnimations = gltf.animations;
        populateClips(gltf.animations.map(a => a.name));
        playClip(gltf.animations[0].name);
      }
      setupGenericHierarchy(targetModel);
    });
  }
  else if (type === 'pumpkin_hat') {
    currentMode = 'props';
    nameInput.value = 'Pumpkin_Hat_Prop';
    document.getElementById('avatarOptionsGroup').style.display = 'none';
    document.getElementById('boneQuickPoses').style.display = 'none';

    targetModel = new THREE.Group();
    targetModel.name = 'Pumpkin_Hat_Root';

    const pumpkinMat = new THREE.MeshStandardMaterial({ color: 0xff6600, roughness: 0.6 });
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.9 });
    const baseP = part(targetModel, G.sph(), pumpkinMat, [0, 0.5, 0], [1, 0.75, 1]);
    baseP.name = 'Pumpkin_Body';
    const stem = part(targetModel, G.cyl(), stemMat, [0, 0.95, 0], [0.15, 0.4, 0.15]);
    stem.name = 'Pumpkin_Stem';

    scene.add(targetModel);
    setupGenericHierarchy(targetModel);
    populateClips([]);
  }
  else if (type === 'gift_box') {
    currentMode = 'props';
    nameInput.value = 'Christmas_GiftBox_Prop';
    document.getElementById('avatarOptionsGroup').style.display = 'none';
    document.getElementById('boneQuickPoses').style.display = 'none';

    targetModel = new THREE.Group();
    targetModel.name = 'GiftBox_Root';

    const boxMat = new THREE.MeshStandardMaterial({ color: 0xd32f2f, roughness: 0.4 });
    const ribbonMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.3, roughness: 0.3 });
    const b = part(targetModel, G.box(), boxMat, [0, 0.5, 0], [0.8, 0.8, 0.8]);
    b.name = 'Gift_Box_Base';
    const r1 = part(targetModel, G.box(), ribbonMat, [0, 0.5, 0], [0.85, 0.82, 0.2]);
    r1.name = 'Ribbon_Horizontal';
    const r2 = part(targetModel, G.box(), ribbonMat, [0, 0.5, 0], [0.2, 0.82, 0.85]);
    r2.name = 'Ribbon_Vertical';

    scene.add(targetModel);
    setupGenericHierarchy(targetModel);
    populateClips([]);
  }
  else if (type === 'pine_tree') {
    currentMode = 'props';
    nameInput.value = 'Christmas_PineTree_Prop';
    document.getElementById('avatarOptionsGroup').style.display = 'none';
    document.getElementById('boneQuickPoses').style.display = 'none';

    targetModel = new THREE.Group();
    targetModel.name = 'PineTree_Root';

    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.9 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x1b5e20, roughness: 0.7 });

    const trunk = part(targetModel, G.cyl(), trunkMat, [0, 0.35, 0], [0.25, 0.7, 0.25]);
    trunk.name = 'Trunk';
    const leaf1 = part(targetModel, G.cone(), leafMat, [0, 0.9, 0], [1.4, 0.9, 1.4]);
    leaf1.name = 'Pine_Leaves_Layer1';
    const leaf2 = part(targetModel, G.cone(), leafMat, [0, 1.4, 0], [1.1, 0.8, 1.1]);
    leaf2.name = 'Pine_Leaves_Layer2';
    const leaf3 = part(targetModel, G.cone(), leafMat, [0, 1.85, 0], [0.75, 0.7, 0.75]);
    leaf3.name = 'Pine_Leaves_Top';

    scene.add(targetModel);
    setupGenericHierarchy(targetModel);
    populateClips([]);
  }
  else if (type === 'custom_prop') {
    currentMode = 'props';
    nameInput.value = 'Custom_NewModel_Prop';
    document.getElementById('avatarOptionsGroup').style.display = 'none';
    document.getElementById('boneQuickPoses').style.display = 'none';

    targetModel = new THREE.Group();
    targetModel.name = 'Custom_Object_Root';
    scene.add(targetModel);
    setupGenericHierarchy(targetModel);
    populateClips([]);
  }

  document.getElementById('targetTypeTag').textContent = currentMode === 'avatar' ? 'Nhân vật (Rig)' : 'Vật thể (Prop)';
}

/* =========================================================================
   4. QUẢN LÝ CÂY PHÂN CẤP (HIERARCHY TREE) & INSPECTOR
   ========================================================================= */

function setupRigHierarchy(av) {
  const parts = [
    { name: 'Hips (Khớp háng/Gốc)', obj: av.hips },
    { name: 'Spine (Cột sống)', obj: av.spine },
    { name: 'Chest (Ngực)', obj: av.chest },
    { name: 'Head (Đầu)', obj: av.head },
    { name: 'Left Shoulder (Vai trái)', obj: av.lShoulder },
    { name: 'Right Shoulder (Vai phải)', obj: av.rShoulder },
    { name: 'Left Arm (Cánh tay trái)', obj: av.lArm },
    { name: 'Right Arm (Cánh tay phải)', obj: av.rArm },
    { name: 'Left Hand (Bàn tay trái)', obj: av.lHand },
    { name: 'Right Hand (Bàn tay phải)', obj: av.rHand },
    { name: 'Left UpLeg (Đùi trái)', obj: av.lUpLeg },
    { name: 'Right UpLeg (Đùi phải)', obj: av.rUpLeg },
    { name: 'Left Leg (Cẳng chân trái)', obj: av.lLeg },
    { name: 'Right Leg (Cẳng chân phải)', obj: av.rLeg }
  ];
  updateHierarchyUI(parts);
}

function setupGenericHierarchy(root) {
  const list = [];
  root.traverse((node) => {
    if (node.isMesh || (node.isGroup && node !== root)) {
      list.push({ name: node.name || `Node_${node.id}`, obj: node });
    }
  });
  updateHierarchyUI(list);
}

function updateHierarchyUI(list) {
  const container = document.getElementById('hierarchyTree');
  container.innerHTML = '';

  if (!list.length) {
    container.innerHTML = '<span class="empty-hint" style="padding:10px;">Chưa có bộ phận nào. Hãy bấm "Thêm khối" ở trên.</span>';
    return;
  }

  list.forEach(item => {
    const el = document.createElement('div');
    el.className = 'tree-node';
    el.innerHTML = `<span>🔹 ${item.name}</span>`;
    el.addEventListener('click', () => {
      document.querySelectorAll('.tree-node').forEach(n => n.classList.remove('active'));
      el.classList.add('active');
      selectPart(item.obj, item.name);
    });
    container.appendChild(el);
  });
}

function selectPart(obj, displayName) {
  selectedObject = obj;
  document.getElementById('selectedPartLabel').textContent = displayName || obj.name || 'Đã chọn';
  updateInspectorUI();
}

function updateInspectorUI() {
  if (!selectedObject) {
    document.getElementById('selectedPartLabel').textContent = 'Chưa chọn';
    return;
  }

  // Tọa độ
  document.getElementById('posX').value = selectedObject.position.x.toFixed(2);
  document.getElementById('posY').value = selectedObject.position.y.toFixed(2);
  document.getElementById('posZ').value = selectedObject.position.z.toFixed(2);

  // Góc quay (đổi sang độ)
  const degX = Math.round(THREE.MathUtils.radToDeg(selectedObject.rotation.x));
  const degY = Math.round(THREE.MathUtils.radToDeg(selectedObject.rotation.y));
  const degZ = Math.round(THREE.MathUtils.radToDeg(selectedObject.rotation.z));

  document.getElementById('rotX').value = degX;
  document.getElementById('rotY').value = degY;
  document.getElementById('rotZ').value = degZ;

  document.getElementById('rotSliderX').value = degX;
  document.getElementById('rotSliderY').value = degY;
  document.getElementById('rotSliderZ').value = degZ;

  // Tỉ lệ scale
  document.getElementById('scaleX').value = selectedObject.scale.x.toFixed(2);
  document.getElementById('scaleY').value = selectedObject.scale.y.toFixed(2);
  document.getElementById('scaleZ').value = selectedObject.scale.z.toFixed(2);

  // Màu sắc & Material nếu là mesh
  if (selectedObject.material) {
    const col = selectedObject.material.color;
    if (col) {
      document.getElementById('partColor').value = `#${col.getHexString()}`;
    }
    if (selectedObject.material.roughness !== undefined) {
      document.getElementById('partRoughness').value = selectedObject.material.roughness;
    }
    if (selectedObject.material.metalness !== undefined) {
      document.getElementById('partMetalness').value = selectedObject.material.metalness;
    }
  }
}

/* =========================================================================
   5. XÂY DỰNG & ĐIỀU KHIỂN ANIMATION
   ========================================================================= */

let currentAction = null;

function populateClips(names) {
  const sel = document.getElementById('clipSelector');
  sel.innerHTML = '';
  if (!names.length) {
    sel.innerHTML = '<option value="">(Không có animation)</option>';
    return;
  }
  names.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    sel.appendChild(opt);
  });
}

function playClip(name) {
  if (avatarInstance) {
    avatarInstance.playEmote(name, true);
    isPlaying = true;
    document.getElementById('btnAnimPlayPause').textContent = '⏸ Tạm Dừng';
    document.getElementById('timeDuration').textContent = 'Looping';
    return;
  }

  if (!mixer || !activeAnimations.length) return;
  const clip = THREE.AnimationClip.findByName(activeAnimations, name);
  if (clip) {
    if (currentAction) currentAction.stop();
    currentAction = mixer.clipAction(clip);
    currentAction.play();
    isPlaying = true;
    document.getElementById('btnAnimPlayPause').textContent = '⏸ Tạm Dừng';
    document.getElementById('timeDuration').textContent = clip.duration.toFixed(2) + 's';
  }
}

function updateScrubberUI() {
  if (!currentAction || !currentAction.getClip()) return;
  const dur = currentAction.getClip().duration;
  const time = currentAction.time % dur;
  document.getElementById('timeCurrent').textContent = time.toFixed(2) + 's';
  document.getElementById('animScrubber').value = ((time / dur) * 100).toFixed(1);
}

function resetHumanPose() {
  if (!avatarInstance) return;
  avatarInstance.emote = null;
  avatarInstance.animTime = 0;
  // Reset các khớp xương về 0
  const bones = [
    avatarInstance.hips, avatarInstance.spine, avatarInstance.chest, avatarInstance.head,
    avatarInstance.lShoulder, avatarInstance.rShoulder, avatarInstance.lArm, avatarInstance.rArm,
    avatarInstance.lHand, avatarInstance.rHand, avatarInstance.lUpLeg, avatarInstance.rUpLeg,
    avatarInstance.lLeg, avatarInstance.rLeg
  ];
  bones.forEach(b => {
    if (b) {
      b.rotation.set(0, 0, 0);
    }
  });
  if (avatarInstance.hips) avatarInstance.hips.position.set(0, 0.78, 0);
  isPlaying = false;
  document.getElementById('btnAnimPlayPause').textContent = '▶ Xem Diễn Hoạt';
  updateInspectorUI();
  showToast('Đã đưa nhân vật về tư thế gốc (T-Pose)!');
}

function applyQuickPose(poseKey) {
  if (!avatarInstance) return;
  resetHumanPose();

  if (poseKey === 'wave_arm') {
    avatarInstance.rShoulder.rotation.z = THREE.MathUtils.degToRad(-140);
    avatarInstance.rArm.rotation.z = THREE.MathUtils.degToRad(-40);
  } else if (poseKey === 'sit_down') {
    avatarInstance.hips.position.y = 0.42;
    avatarInstance.lUpLeg.rotation.x = THREE.MathUtils.degToRad(85);
    avatarInstance.rUpLeg.rotation.x = THREE.MathUtils.degToRad(85);
    avatarInstance.lLeg.rotation.x = THREE.MathUtils.degToRad(-85);
    avatarInstance.rLeg.rotation.x = THREE.MathUtils.degToRad(-85);
  } else if (poseKey === 'salute') {
    avatarInstance.rShoulder.rotation.z = THREE.MathUtils.degToRad(-100);
    avatarInstance.rArm.rotation.z = THREE.MathUtils.degToRad(-80);
    avatarInstance.rHand.rotation.y = THREE.MathUtils.degToRad(45);
  }
  updateInspectorUI();
  showToast(`Đã áp dụng tư thế [${poseKey}]!`);
}

function bindUIEvents() {
  // Preset selector
  document.getElementById('presetSelector').addEventListener('change', (e) => {
    loadModelPreset(e.target.value);
  });

  // Costume selector
  document.getElementById('costumeSelector').addEventListener('change', (e) => {
    if (avatarInstance) {
      avatarInstance.applyCostume(e.target.value);
      showToast(`Đã đổi trang phục: ${e.target.value}`);
    }
  });

  // Reset Pose button
  document.getElementById('btnResetPose').addEventListener('click', resetHumanPose);

  // Quick Poses
  document.querySelectorAll('.btn-pose').forEach(btn => {
    btn.addEventListener('click', () => {
      applyQuickPose(btn.dataset.pose);
    });
  });

  // Thêm khối hình mới
  document.querySelectorAll('.btn-geo').forEach(btn => {
    btn.addEventListener('click', () => {
      const shape = btn.dataset.shape;
      if (!targetModel) loadModelPreset('custom_prop');

      let g;
      if (shape === 'box') g = G.box();
      else if (shape === 'sph') g = G.sph();
      else if (shape === 'cyl') g = G.cyl();
      else if (shape === 'cone') g = G.cone();
      else if (shape === 'torus') g = G.torus();
      else if (shape === 'oct') g = G.oct();

      const m = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.5, metalness: 0.1 });
      const newPart = part(targetModel, g, m, [0, 0.5, 0], [0.5, 0.5, 0.5]);
      newPart.name = `Part_${shape}_${Date.now().toString().slice(-4)}`;

      setupGenericHierarchy(targetModel);
      selectPart(newPart, newPart.name);
      showToast(`Đã thêm khối ${shape}!`);
    });
  });

  // Xóa phần đang chọn
  document.getElementById('btnDeleteSelectedPart').addEventListener('click', () => {
    if (selectedObject && targetModel && selectedObject !== targetModel) {
      if (confirm(`Bạn có chắc muốn xóa "${selectedObject.name}" khỏi mô hình?`)) {
        selectedObject.parent.remove(selectedObject);
        setupGenericHierarchy(targetModel);
        selectedObject = null;
        updateInspectorUI();
        showToast('Đã xóa bộ phận được chọn.');
      }
    }
  });

  // Đồng bộ Rotation giữa Slider và Number Input
  const bindRotSync = (axis) => {
    const slider = document.getElementById(`rotSlider${axis}`);
    const num = document.getElementById(`rot${axis}`);

    const applyRot = (deg) => {
      if (!selectedObject) return;
      selectedObject.rotation[axis.toLowerCase()] = THREE.MathUtils.degToRad(deg);
    };

    slider.addEventListener('input', () => {
      num.value = slider.value;
      applyRot(parseFloat(slider.value));
    });

    num.addEventListener('input', () => {
      slider.value = num.value;
      applyRot(parseFloat(num.value));
    });
  };
  ['X', 'Y', 'Z'].forEach(bindRotSync);

  // Position & Scale Inputs
  const updateTransformFromInputs = () => {
    if (!selectedObject) return;
    selectedObject.position.set(
      parseFloat(document.getElementById('posX').value) || 0,
      parseFloat(document.getElementById('posY').value) || 0,
      parseFloat(document.getElementById('posZ').value) || 0
    );
    selectedObject.scale.set(
      parseFloat(document.getElementById('scaleX').value) || 1,
      parseFloat(document.getElementById('scaleY').value) || 1,
      parseFloat(document.getElementById('scaleZ').value) || 1
    );
  };
  ['posX', 'posY', 'posZ', 'scaleX', 'scaleY', 'scaleZ'].forEach(id => {
    document.getElementById(id).addEventListener('input', updateTransformFromInputs);
  });

  // Color & Material
  document.getElementById('partColor').addEventListener('input', (e) => {
    if (selectedObject && selectedObject.material && selectedObject.material.color) {
      selectedObject.material.color.set(e.target.value);
    }
  });

  document.getElementById('partRoughness').addEventListener('input', (e) => {
    if (selectedObject && selectedObject.material) {
      selectedObject.material.roughness = parseFloat(e.target.value);
    }
  });

  document.getElementById('partMetalness').addEventListener('input', (e) => {
    if (selectedObject && selectedObject.material) {
      selectedObject.material.metalness = parseFloat(e.target.value);
    }
  });

  // Animation Play/Pause
  const btnPlay = document.getElementById('btnAnimPlayPause');
  btnPlay.addEventListener('click', () => {
    const clipName = document.getElementById('clipSelector').value;
    if (isPlaying) {
      if (avatarInstance) {
        avatarInstance.emote = null;
      } else if (currentAction) {
        currentAction.pause();
      }
      isPlaying = false;
      btnPlay.textContent = '▶ Xem Diễn Hoạt';
    } else {
      playClip(clipName);
    }
  });

  document.getElementById('btnAnimStop').addEventListener('click', () => {
    if (avatarInstance) {
      resetHumanPose();
    } else if (currentAction) {
      currentAction.stop();
    }
    isPlaying = false;
    btnPlay.textContent = '▶ Xem Diễn Hoạt';
    document.getElementById('animScrubber').value = 0;
    document.getElementById('timeCurrent').textContent = '0.00s';
  });

  document.getElementById('clipSelector').addEventListener('change', (e) => {
    playClip(e.target.value);
  });

  document.getElementById('animSpeed').addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    document.getElementById('speedVal').textContent = val.toFixed(1) + 'x';
    if (mixer) mixer.timeScale = val;
  });

  // Viewport Toggle buttons
  document.getElementById('btnToggleGrid').addEventListener('click', function() {
    gridHelper.visible = !gridHelper.visible;
    this.classList.toggle('active', gridHelper.visible);
  });

  document.getElementById('btnToggleWireframe').addEventListener('click', function() {
    const active = this.classList.toggle('active');
    if (targetModel) {
      targetModel.traverse(node => {
        if (node.isMesh && node.material) {
          node.material.wireframe = active;
        }
      });
    }
  });

  // Chụp Keyframe & Tạo Animation mới
  document.getElementById('btnCaptureKeyframe').addEventListener('click', () => {
    if (!selectedObject) {
      alert('Vui lòng chọn một bộ phận hoặc khớp xương cần lưu khung hình.');
      return;
    }
    const frameData = {
      targetName: selectedObject.name,
      pos: selectedObject.position.toArray(),
      rot: [selectedObject.rotation.x, selectedObject.rotation.y, selectedObject.rotation.z],
      scale: selectedObject.scale.toArray(),
      time: recordedKeyframes.length * 0.5
    };
    recordedKeyframes.push(frameData);
    updateKeyframeListUI();
    showToast(`Đã chụp Frame ${recordedKeyframes.length} (${frameData.targetName})`);
  });

  document.getElementById('btnClearKeyframes').addEventListener('click', () => {
    recordedKeyframes = [];
    updateKeyframeListUI();
    showToast('Đã xóa tất cả keyframes đã lưu.');
  });

  // Thử chạy Animation tự tạo
  document.getElementById('btnTestAnimation').addEventListener('click', () => {
    if (recordedKeyframes.length < 2) {
      alert('Cần ít nhất 2 Keyframe để chạy thử chuyển động.');
      return;
    }
    let curIdx = 0;
    const interval = setInterval(() => {
      if (curIdx >= recordedKeyframes.length) {
        clearInterval(interval);
        showToast('Hoàn thành chạy thử animation!');
        return;
      }
      const kf = recordedKeyframes[curIdx];
      if (selectedObject) {
        selectedObject.rotation.set(...kf.rot);
        selectedObject.position.set(...kf.pos);
        updateInspectorUI();
      }
      curIdx++;
    }, 450);
  });

  // Xuất file Animation đặt tên theo model/animation
  document.getElementById('btnSaveNewAnimation').addEventListener('click', () => {
    const modelName = document.getElementById('modelCustomName').value.trim() || 'Model';
    const animName = document.getElementById('newAnimName').value.trim() || 'CustomMotion';

    if (recordedKeyframes.length < 2) {
      alert('Cần chụp ít nhất 2 Keyframe để tạo file animation hoàn chỉnh.');
      return;
    }

    const animConfig = {
      modelName,
      animationName: animName,
      fps: 30,
      totalDuration: recordedKeyframes[recordedKeyframes.length - 1].time,
      keyframes: recordedKeyframes,
      createdAt: new Date().toISOString()
    };

    const fileName = `${modelName}_${animName}.anim.json`;
    downloadJSON(animConfig, fileName);
    showToast(`Đã xuất Animation [${fileName}] thành công!`);
  });

  // 1. Lưu chỉnh sửa vào kho trình duyệt (LocalStorage)
  document.getElementById('btnSaveToStorage').addEventListener('click', () => {
    if (!targetModel) return;
    const modelName = document.getElementById('modelCustomName').value.trim() || 'Custom_Model';

    let exportData = null;
    if (avatarInstance) {
      // Lưu toàn bộ cấu hình nhân vật (Costume, Hue, Pos/Rot từng khớp)
      exportData = exportAvatarConfig(avatarInstance, modelName);
    } else {
      exportData = targetModel.toJSON();
    }

    try {
      localStorage.setItem(`gather_model_${modelName}`, JSON.stringify(exportData));
      showToast(`Đã lưu "${modelName}" vào kho dữ liệu game!`);
    } catch (e) {
      alert('Không đủ dung lượng bộ nhớ: ' + e.message);
    }
  });

  // 2. Xuất toàn bộ Model ra file JSON đặt tên cụ thể theo Model
  document.getElementById('btnExportJSON').addEventListener('click', () => {
    if (!targetModel) return;
    const modelName = document.getElementById('modelCustomName').value.trim() || 'Gather_Model';

    let exportData = null;
    if (avatarInstance) {
      exportData = exportAvatarConfig(avatarInstance, modelName);
    } else {
      exportData = targetModel.toJSON();
    }

    const fileName = `${modelName}.model.json`;
    downloadJSON(exportData, fileName);
    showToast(`Đã xuất file [${fileName}] thành công!`);
  });

  // 3. Nạp Model/JSON vào
  const fileIn = document.getElementById('fileImporter');
  document.getElementById('btnImportJSON').addEventListener('click', () => fileIn.click());
  fileIn.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Tự động lấy tên file làm tên model
    const baseName = file.name.replace(/\.[^/.]+$/, "");
    document.getElementById('modelCustomName').value = baseName;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target.result);

        if (json.type === 'AvatarRigConfig') {
          // Nạp cấu hình avatar rig
          loadModelPreset('human_rig');
          setTimeout(() => {
            applyAvatarConfig(avatarInstance, json);
            showToast(`Đã nạp nhân vật [${baseName}] thành công!`);
          }, 100);
        } else {
          // Nạp Three.js Object JSON thông thường
          const loader = new THREE.ObjectLoader();
          const obj = loader.parse(json);
          clearTargetModel();
          targetModel = obj;
          scene.add(targetModel);
          setupGenericHierarchy(targetModel);
          showToast(`Đã nạp mô hình [${baseName}] thành công!`);
        }
      } catch (err) {
        alert('Lỗi khi đọc file: ' + err.message);
      }
    };
    reader.readAsText(file);
  });
}

function exportAvatarConfig(av, modelName) {
  const bonesData = {};
  const bones = [
    { k: 'hips', obj: av.hips },
    { k: 'spine', obj: av.spine },
    { k: 'chest', obj: av.chest },
    { k: 'head', obj: av.head },
    { k: 'lShoulder', obj: av.lShoulder },
    { k: 'rShoulder', obj: av.rShoulder },
    { k: 'lArm', obj: av.lArm },
    { k: 'rArm', obj: av.rArm },
    { k: 'lHand', obj: av.lHand },
    { k: 'rHand', obj: av.rHand },
    { k: 'lUpLeg', obj: av.lUpLeg },
    { k: 'rUpLeg', obj: av.rUpLeg },
    { k: 'lLeg', obj: av.lLeg },
    { k: 'rLeg', obj: av.rLeg }
  ];

  bones.forEach(b => {
    if (b.obj) {
      bonesData[b.k] = {
        pos: b.obj.position.toArray(),
        rot: [b.obj.rotation.x, b.obj.rotation.y, b.obj.rotation.z],
        scale: b.obj.scale.toArray()
      };
    }
  });

  return {
    type: 'AvatarRigConfig',
    modelName: modelName,
    costume: av.costumeKey || 'default',
    hue: av.hue || 200,
    bones: bonesData,
    exportedAt: new Date().toISOString()
  };
}

function applyAvatarConfig(av, config) {
  if (!av || !config.bones) return;
  if (config.costume) av.applyCostume(config.costume);

  for (const [key, data] of Object.entries(config.bones)) {
    if (av[key]) {
      if (data.pos) av[key].position.fromArray(data.pos);
      if (data.rot) av[key].rotation.set(...data.rot);
      if (data.scale) av[key].scale.fromArray(data.scale);
    }
  }
  updateInspectorUI();
}

function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function updateKeyframeListUI() {
  const container = document.getElementById('keyframesList');
  container.innerHTML = '';
  if (!recordedKeyframes.length) {
    container.innerHTML = '<span class="empty-hint">Chưa có keyframe nào được ghi lại.</span>';
    return;
  }
  recordedKeyframes.forEach((kf, idx) => {
    const pill = document.createElement('div');
    pill.className = 'frame-pill';
    pill.textContent = `F${idx + 1}: ${kf.targetName} (${kf.time.toFixed(1)}s)`;
    container.appendChild(pill);
  });
}

// Khởi động Auth ban đầu
window.addEventListener('DOMContentLoaded', initAuth);
