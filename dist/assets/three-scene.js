/* 太虚官网首页场景：渲染器、模型装载、交互与穿越动画。
   文案在 content.js，星野/水纹/浮尘在 environment.js。 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { content, sceneKey } from './content.js';
import { buildEnvironment, CYAN, VIOLET } from './environment.js';

const $ = s => document.querySelector(s);
const canvas = $('#universe'), loading = $('#loading'), bigBang = $('#big-bang'), intro = $('#intro'), panel = $('#panel');
const titleEl = $('#panel-title'), indexEl = $('#panel-index'), bodyEl = $('#panel-body'), actionsEl = $('#panel-actions');
const fpsEl = $('#fps'), coordsEl = $('#coordinates'), progressEl = $('#progress');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile = matchMedia('(max-width:760px)').matches;
const CDN = 'https://cdn.jsdelivr.net/npm/three@0.180.0';

/* ---------------- 渲染器与场景 ---------------- */
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.25 : 1.8));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x030508);
scene.fog = new THREE.FogExp2(0x030508, 0.02);
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 160);
camera.position.set(0, 0.5, 12.4);
const rig = new THREE.Group(); rig.add(camera); scene.add(rig);

// 环境反射（金属质感来源）
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.06).texture;
scene.environmentIntensity = 0.5;

// 点缀光
scene.add(new THREE.HemisphereLight(0x6f91a5, 0x050609, 0.5));
const cyanLight = new THREE.PointLight(CYAN, 60, 24); cyanLight.position.set(4, 2.5, 5); scene.add(cyanLight);
const violetLight = new THREE.PointLight(VIOLET, 42, 22); violetLight.position.set(-5.5, -2.5, -2); scene.add(violetLight);

// 星野、网格、门心水纹、浮尘
const env = buildEnvironment(scene, { mobile });

/* ---------------- 泛光后期（桌面且未开启减动效） ---------------- */
const useBloom = !mobile && !reduced;
let composer = null;
if (useBloom) {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.55, 0.45, 0.82));
  composer.addPass(new OutputPass());
}

/* ---------------- 模型装载 ---------------- */
const artifacts = [];   // { mesh, key, baseY, spin }
let gate = null, ringMid = null, ringOuter = null, rimRing = null;
let ringAxisMid = null, ringAxisOuter = null, ringAxisRim = null, loaded = false;
const clickTargets = [];

function setupModel(gltf) {
  const model = gltf.scene;
  model.rotation.y = -0.12;
  // 钳制发光强度，保住泛光层次（Blender 里的强度是给 EEVEE 的）
  const cap = { TX_Emit_Seam: 2.4, TX_Emit_Cyan: 1.5, TX_Emit_Violet: 1.3, TX_Emit_CyanDim: 1.0, TX_Emit_VioletDim: 0.9 };
  model.traverse(o => {
    if (!o.material) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach(m => {
      if (m.emissiveIntensity != null) {
        m.emissiveIntensity = cap[m.name] ?? Math.min(m.emissiveIntensity, 1.2);
      }
    });
  });
  scene.add(model);
  gate = model.getObjectByName('TX_Portal_Gate');
  ringMid = model.getObjectByName('TX_Portal_RingMid');
  ringOuter = model.getObjectByName('TX_Portal_RingOuter');
  rimRing = model.getObjectByName('TX_Portal_RimRing');
  // 环体节点可能带基准旋转：运行时探测“指向世界的门面法线”的局部轴，保证反向旋转始终在环面内
  model.updateMatrixWorld(true);
  const faceAxis = obj => {
    const q = obj.getWorldQuaternion(new THREE.Quaternion());
    const candidates = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];
    let best = candidates[2], bestDot = -2;
    for (const a of candidates) {
      const d = Math.abs(a.clone().applyQuaternion(q).z);
      if (d > bestDot) { bestDot = d; best = a; }
    }
    return best.clone();
  };
  ringAxisMid = faceAxis(ringMid);
  ringAxisOuter = faceAxis(ringOuter);
  ringAxisRim = faceAxis(rimRing);
  for (const [name, key] of Object.entries(sceneKey)) {
    const mesh = model.getObjectByName(name);
    if (!mesh) continue;
    mesh.userData.scene = key;
    artifacts.push({ mesh, key, baseY: mesh.position.y, spin: { TX_Perf: 1.15, TX_AI: 0.45, TX_Lang: 0.22, TX_Learn: 0.32 }[name] });
    clickTargets.push(mesh);
  }
  env.setMembraneVisible(true);
  loaded = true;
  window.__txRings = { gate, ringMid, ringOuter, rimRing, ringAxisMid, ringAxisOuter, ringAxisRim };
  reveal(true);
}

function fallbackPortal() {
  const g = new THREE.Group();
  [[2.0, 0.06, CYAN], [1.66, 0.02, VIOLET], [2.62, 0.012, CYAN]].forEach(([r, t, c], i) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(r, t, 12, 140),
      new THREE.MeshStandardMaterial({ color: c, metalness: 0.85, roughness: 0.3, emissive: c, emissiveIntensity: i ? 0.5 : 0.25 }));
    m.rotation.x = i * 0.4; g.add(m);
  });
  scene.add(g); gate = g;
  env.setMembraneVisible(true); loaded = true;
  reveal(false);
}

const draco = new DRACOLoader().setDecoderPath(CDN + '/examples/jsm/libs/draco/gltf/');
new GLTFLoader().setDRACOLoader(draco).load(
  './assets/taixu-portal.glb?v=3',
  setupModel,
  undefined,
  err => { console.warn('GLB 加载失败，启用后备门体', err); fallbackPortal(); }
);
setTimeout(() => { if (!loaded) fallbackPortal(); }, 8000);

function reveal(withBang) {
  if (reduced) { loading.classList.add('done'); return; }
  loading.classList.add('collapse');
  setTimeout(() => { if (withBang) bigBang.classList.add('ignite'); loading.classList.add('done'); }, 600);
  setTimeout(() => loading.remove(), 2200);
}
if (reduced) setTimeout(() => loading.classList.add('done'), 420);

/* ---------------- 交互与场景切换 ---------------- */
const targetPosition = new THREE.Vector3(0, 0.5, 12.4), targetLook = new THREE.Vector3(), currentLook = new THREE.Vector3();
const pointer = new THREE.Vector2(-2, -2);
let dragging = false, lastX = 0, lastY = 0, yaw = 0, pitch = 0, active = 'origin';
const raycaster = new THREE.Raycaster(), clock = new THREE.Clock();

function show(name) {
  active = name;
  intro.classList.remove('active');
  panel.classList.add('open');
  document.querySelectorAll('.scene-nav button').forEach(b => b.classList.toggle('active', b.dataset.scene === name));
  const c = content[name];
  indexEl.textContent = c.index; titleEl.textContent = c.title; bodyEl.innerHTML = c.body; actionsEl.innerHTML = c.actions;
  // 面板内的站内跳转按钮接入穿越动画（外链不受影响）
  actionsEl.querySelectorAll('a[href^="./"]').forEach(a => {
    a.addEventListener('click', ev => { ev.preventDefault(); startWarp(a.getAttribute('href')); });
  });
  const target = (artifacts.find(a => a.key === name)?.mesh.position) || new THREE.Vector3();
  const radial = target.clone().setY(0).normalize();
  targetPosition.copy(target).addScaledVector(radial, 4.4);
  targetPosition.y = Math.max(target.y, 0.6);
  targetLook.copy(target).multiplyScalar(0.25);
  yaw = 0; pitch = 0;
  progressEl.style.width = ({ language: 25, performance: 50, ai: 75, learn: 100 }[name] || 0) + '%';
}
function origin() {
  active = 'origin';
  panel.classList.remove('open');
  intro.classList.add('active');
  document.querySelectorAll('.scene-nav button').forEach(b => b.classList.remove('active'));
  targetPosition.set(0, 0.5, 12.4); targetLook.set(0, 0, 0);
  progressEl.style.width = '0%';
}

/* ---------------- 穿越跃迁（回正 → 加速穿门 → 黑屏 → 跳转） ---------------- */
let warp = null;
const veil = document.createElement('div');
veil.style.cssText = 'position:fixed;inset:0;background:#000;opacity:0;pointer-events:none;z-index:80';
document.body.appendChild(veil);

function startWarp(url) {
  if (warp) return;
  panel.classList.remove('open');
  intro.classList.remove('active');
  document.querySelectorAll('.scene-nav button').forEach(b => b.classList.remove('active'));
  if (reduced) {
    warp = { url, fired: true };
    veil.style.transition = 'opacity .28s linear';
    requestAnimationFrame(() => { veil.style.opacity = '1'; });
    setTimeout(() => { location.href = url; }, 300);
    return;
  }
  targetPosition.set(0, 0.5, 12.4); targetLook.set(0, 0, 0);
  yaw = 0; pitch = 0;
  warp = { url, phase: 'align', t0: performance.now(), fired: false };
}

$('#enter').addEventListener('click', () => startWarp('./learn/'));
$('.panel-close').addEventListener('click', origin);
document.querySelectorAll('[data-scene]').forEach(el =>
  el.addEventListener('click', () => el.dataset.scene === 'origin' ? origin() : show(el.dataset.scene)));

canvas.addEventListener('pointerdown', e => {
  dragging = true; lastX = e.clientX; lastY = e.clientY;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', e => {
  pointer.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  if (dragging) {
    yaw += (e.clientX - lastX) * 0.003;
    pitch = Math.max(-0.3, Math.min(0.3, pitch + (e.clientY - lastY) * 0.002));
    lastX = e.clientX; lastY = e.clientY;
  }
});
canvas.addEventListener('pointerup', e => {
  if (Math.abs(e.clientX - lastX) < 5 && Math.abs(e.clientY - lastY) < 5) {
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(clickTargets, false)[0];
    if (hit) show(hit.object.userData.scene);
  }
  dragging = false;
  canvas.releasePointerCapture(e.pointerId);
});
const keys = {};
addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true; if (e.key === 'Escape') origin(); });
addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 760 ? 1.25 : 1.8));
  if (composer) composer.setSize(innerWidth, innerHeight);
});

const requestedScene = new URLSearchParams(location.search).get('scene');
if (content[requestedScene]) setTimeout(() => show(requestedScene), 720);

/* ---------------- 主循环 ---------------- */
let frames = 0, fpsTime = performance.now();
function animate(now) {
  const elapsed = clock.getDelta(), dt = Math.min(elapsed, 0.04);
  const t = now * 0.001;
  frames++;
  if (now - fpsTime > 1000) { fpsEl.textContent = frames; frames = 0; fpsTime = now; }

  env.update(t, dt);
  if (gate) {
    // 呼吸 + 三环交替缓旋（内圈逆时针 / 中圈顺时针 / 外圈逆时针，空间站旋转结构意象）
    const breathe = 1 + Math.sin(t * 0.5) * 0.007;
    gate.scale.setScalar(breathe);
    const spin = reduced ? 0 : 1;
    if (ringMid) {
      ringMid.scale.setScalar(breathe);
      ringMid.rotateOnAxis(ringAxisMid, dt * 0.05 * spin);
    }
    if (ringOuter) {
      ringOuter.scale.setScalar(breathe);
      ringOuter.rotateOnAxis(ringAxisOuter, -dt * 0.036 * spin);
    }
    if (rimRing) {
      rimRing.scale.setScalar(breathe);
      rimRing.rotateOnAxis(ringAxisRim, dt * 0.026 * spin);
    }
  }
  artifacts.forEach((a, i) => {
    a.mesh.rotation.y += dt * a.spin;
    a.mesh.position.y = a.baseY + Math.sin(t * 0.7 + i * 1.7) * 0.12;
  });

  const speed = dt * 3;
  if (keys.w) targetPosition.z -= speed;
  if (keys.s) targetPosition.z += speed;
  if (keys.a) targetPosition.x -= speed;
  if (keys.d) targetPosition.x += speed;

  const travelEase = reduced ? 1 : 1 - Math.exp(-elapsed * 1.45);
  if (warp && warp.phase === 'align') {
    // 阶段一：回到正面初始位
    camera.position.lerp(targetPosition, travelEase);
    currentLook.lerp(targetLook, travelEase);
    camera.lookAt(currentLook);
    if (performance.now() - warp.t0 > 1150 || camera.position.distanceTo(targetPosition) < 0.1) {
      warp.phase = 'accel';
      warp.t0 = performance.now();
      warp.from = camera.position.clone();
      warp.hole = new THREE.Vector3(0, 0.42, -2.8);
    }
  } else if (warp && warp.phase === 'accel') {
    // 阶段二：飞船推力加速穿门，临近门心渐入黑屏
    const p = Math.min((now - warp.t0) / 2400, 1);
    const e = p * p * p;
    camera.position.lerpVectors(warp.from, warp.hole, e);
    camera.fov = 50 + 26 * e;
    camera.updateProjectionMatrix();
    camera.lookAt(0, 0.32, 0);
    veil.style.opacity = Math.max(0, Math.min(1, (3.8 - camera.position.z) / 3.1)).toFixed(2);
    if ((p >= 1 || camera.position.z < 0.45) && !warp.fired) {
      warp.fired = true;
      veil.style.opacity = '1';
      setTimeout(() => { location.href = warp.url; }, 150);
    }
  } else {
    camera.position.lerp(targetPosition, travelEase);
    currentLook.lerp(targetLook, reduced ? 1 : 1 - Math.exp(-elapsed * 1.35));
    camera.lookAt(currentLook.clone().add(new THREE.Vector3(yaw, pitch, 0)));
  }

  coordsEl.innerHTML = `X ${camera.position.x.toFixed(2)}&nbsp;&nbsp;Y ${camera.position.y.toFixed(2)}&nbsp;&nbsp;Z ${camera.position.z.toFixed(2)}`;

  raycaster.setFromCamera(pointer, camera);
  const hover = clickTargets.length && raycaster.intersectObjects(clickTargets, false).length > 0;
  canvas.style.cursor = hover ? 'pointer' : dragging ? 'grabbing' : 'grab';

  if (composer) composer.render(); else renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
