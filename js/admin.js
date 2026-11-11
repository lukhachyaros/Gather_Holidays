// Gather Holidays 3D — Admin Studio & Builder Script
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Avatar } from './avatar.js';
import { G, part, mat } from './props.js';

/* =========================================================================
   1. BẢO MẬT & XÁC THỰC TÀI KHOẢN ADMIN ĐƯỢC CẤP RIÊNG
   ========================================================================= */

// Danh sách tài khoản Admin được cấp phép (lưu dưới dạng SHA-256 hash an toàn)
// Tài khoản mặc định ban đầu:
// Username: admin
// Password mặc định: GatherAdmin2026@
const ADMIN_ACCOUNTS = [
  {
    user: 'admin',
    // SHA-256 của 'GatherAdmin2026@'
    hash: '5731b8a786227fc64a51ebbb22d326fbe7fbba678396c0ca8ef00ae09e53ce86',
    role: 'SuperAdmin'
  },
  {
    user: 'builder',
    // SHA-256 của 'Builder3D!Pro'
    hash: 'f04faae9484379ca269b61d365fdfeb547d6f51cb3298c8c51a0ae652df5c832',
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

/* =========================================================================
   2. KHỞI TẠO 3D VIEWPORT & CAMERA ORBIT CONTROLS
   ========================================================================= */

let scene, camera, renderer, gridHelper, boneHelpers = [];
let targetModel = null;
let currentMode = 'avatar'; // 'avatar' | 'props'
let selectedObject = null;
let activeAnimations = [];
let mixer = null;
let isPlaying = false;
let animClock = new THREE.Clock();
let recordedKeyframes = [];

function setupStudio() {
  const container = document.getElementById('viewport3D');
  if (scene) return; // Đã khởi tạo

  const w = container.clientWidth || window.innerWidth - 680;
  const h = container.clientHeight || window.innerHeight - 100;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0f1d);

  camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
  camera.position.set(0, 1.8, 3.8);

  renderer = new THREE.WebGLRenderer({ antialias: true });
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

    if (mixer && isPlaying) {
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
  recordedKeyframes = [];
  updateKeyframeListUI();
  updateHierarchyUI([]);
  updateInspectorUI();
}

async function loadModelPreset(type) {
  clearTargetModel();

  if (type === 'human_rig') {
    currentMode = 'avatar';
    const av = new Avatar(null, { name: 'AdminRig', hue: 200, costume: 'default' });
    targetModel = av.root;
    targetModel.userData = { isAvatar: true, avatarInstance: av };
    scene.add(targetModel);

    // Thu thập các khớp xương rig
    setupRigHierarchy(av);
    populateClips(['Idle', 'wave', 'handshake', 'hug', 'cheer_jump', 'flex', 'dab']);
  }
  else if (type === 'robot_expressive') {
    currentMode = 'avatar';
    const loader = new GLTFLoader();
    loader.load('./assets/models/RobotExpressive.glb', (gltf) => {
      targetModel = gltf.scene;
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
    targetModel = new THREE.Group();
    // Tạo quả bí ngô mẫu
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
    targetModel = new THREE.Group();
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
    targetModel = new THREE.Group();
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
  document.getElementById('rotX').value = Math.round(THREE.MathUtils.radToDeg(selectedObject.rotation.x));
  document.getElementById('rotY').value = Math.round(THREE.MathUtils.radToDeg(selectedObject.rotation.y));
  document.getElementById('rotZ').value = Math.round(THREE.MathUtils.radToDeg(selectedObject.rotation.z));

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

function bindUIEvents() {
  // Preset selector
  document.getElementById('presetSelector').addEventListener('change', (e) => {
    loadModelPreset(e.target.value);
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
      }
    }
  });

  // Inputs liên kết trực tiếp với 3D
  const updateTransformFromInputs = () => {
    if (!selectedObject) return;
    selectedObject.position.set(
      parseFloat(document.getElementById('posX').value) || 0,
      parseFloat(document.getElementById('posY').value) || 0,
      parseFloat(document.getElementById('posZ').value) || 0
    );
    selectedObject.rotation.set(
      THREE.MathUtils.degToRad(parseFloat(document.getElementById('rotX').value) || 0),
      THREE.MathUtils.degToRad(parseFloat(document.getElementById('rotY').value) || 0),
      THREE.MathUtils.degToRad(parseFloat(document.getElementById('rotZ').value) || 0)
    );
    selectedObject.scale.set(
      parseFloat(document.getElementById('scaleX').value) || 1,
      parseFloat(document.getElementById('scaleY').value) || 1,
      parseFloat(document.getElementById('scaleZ').value) || 1
    );
  };

  ['posX', 'posY', 'posZ', 'rotX', 'rotY', 'rotZ', 'scaleX', 'scaleY', 'scaleZ'].forEach(id => {
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
    if (!mixer) {
      // Nếu là avatar rig, test động tác
      if (targetModel && targetModel.userData.avatarInstance) {
        const clipName = document.getElementById('clipSelector').value;
        const av = targetModel.userData.avatarInstance;
        av.triggerEmote(clipName);
      }
      return;
    }
    isPlaying = !isPlaying;
    btnPlay.textContent = isPlaying ? '⏸ Tạm Dừng' : '▶ Phát';
  });

  document.getElementById('btnAnimStop').addEventListener('click', () => {
    if (currentAction) currentAction.stop();
    isPlaying = false;
    btnPlay.textContent = '▶ Phát';
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
      alert('Vui lòng chọn một bộ phận/khớp xương cần lưu khung hình.');
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
  });

  document.getElementById('btnSaveNewAnimation').addEventListener('click', () => {
    const name = document.getElementById('newAnimName').value.trim() || `CustomAnim_${Date.now().toString().slice(-4)}`;
    if (recordedKeyframes.length < 2) {
      alert('Cần ít nhất 2 Keyframe để tạo chuyển động hoàn chỉnh.');
      return;
    }

    // Xuất cấu hình animation dạng JSON
    const animConfig = {
      name,
      fps: 30,
      duration: recordedKeyframes[recordedKeyframes.length - 1].time,
      keyframes: recordedKeyframes
    };

    const blob = new Blob([JSON.stringify(animConfig, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}.anim.json`;
    a.click();
    URL.revokeObjectURL(url);
    alert(`Đã xuất Animation [${name}] thành công!`);
  });

  // Xuất toàn bộ Model ra JSON
  document.getElementById('btnExportJSON').addEventListener('click', () => {
    if (!targetModel) return;
    const modelData = targetModel.toJSON();
    const blob = new Blob([JSON.stringify(modelData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GatherModel_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // Nạp Model/JSON vào
  const fileIn = document.getElementById('fileImporter');
  document.getElementById('btnImportJSON').addEventListener('click', () => fileIn.click());
  fileIn.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target.result);
        const loader = new THREE.ObjectLoader();
        const obj = loader.parse(json);
        clearTargetModel();
        targetModel = obj;
        scene.add(targetModel);
        setupGenericHierarchy(targetModel);
        alert('Đã tải mô hình JSON thành công!');
      } catch (err) {
        alert('Lỗi khi đọc file: ' + err.message);
      }
    };
    reader.readAsText(file);
  });
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
    pill.textContent = `Frame ${idx + 1} (${kf.time.toFixed(1)}s)`;
    container.appendChild(pill);
  });
}

// Khởi động Auth ban đầu
window.addEventListener('DOMContentLoaded', initAuth);
