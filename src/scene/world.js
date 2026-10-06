// 3D 무대: 렌더러, 카메라, 마우스 조작, 라벨 레이어, 별 하늘.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';

export function createWorld(stageEl) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  stageEl.prepend(renderer.domElement);

  const labelRenderer = new CSS2DRenderer();
  labelRenderer.domElement.id = 'labels';
  stageEl.insertBefore(labelRenderer.domElement, renderer.domElement.nextSibling);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x02030a);

  // far 를 넉넉히: 해왕성 30 AU 이상. 보이저(M6)는 200 AU 이상까지 필요하므로 미리 크게 잡는다.
  const camera = new THREE.PerspectiveCamera(50, 1, 0.0005, 6000);
  camera.position.set(0, 14, 26);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 0.003;
  controls.maxDistance = 2500;
  controls.zoomSpeed = 1.3;

  function resize() {
    const w = stageEl.clientWidth, h = stageEl.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h);
    labelRenderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(stageEl);
  resize();

  scene.add(new THREE.AmbientLight(0xffffff, 0.12));

  // 별 하늘: 카메라를 따라다니는 큰 구 (텍스처는 나중에 setSkyTexture 로 입힌다)
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(3000, 48, 24),
    new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide, depthWrite: false, fog: false })
  );
  sky.renderOrder = -10;
  scene.add(sky);
  function setSkyTexture(tex) {
    sky.material.map = tex;
    sky.material.color.setScalar(0.6);
    sky.material.needsUpdate = true;
  }

  function render() {
    sky.position.copy(camera.position);
    controls.update();
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
  }

  return { THREE, renderer, labelRenderer, scene, camera, controls, setSkyTexture, render, maxAnisotropy: renderer.capabilities.getMaxAnisotropy() };
}
