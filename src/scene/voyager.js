// 보이저 1·2호: NASA glTF 모델(models/voyager.glb, 쌍둥이라 복제), 항적선, 라벨.
// 모델을 못 읽으면 기본 도형 조립(접시 안테나, 10각형 버스, 붐)으로 대신한다. 안테나 접시는 지구 방향.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { voyagerState, voyagerTrail } from '../sim/voyager.js';
import { applyScale } from '../sim/scale.js';

export const VOYAGER_DISH_SIZE = 0.05; // 화면에서 접시 지름 (AU). 실제 3.7 m 는 점보다 작아서 크게 키운다 (확대 배율)
const DISH_DIAMETER_IN_MODEL = 3.8;     // models/voyager.glb 에서 접시 지름 (모델 단위)
// 모델 안에서 접시가 바라보는 방향(국소 좌표). 모델 구조 분석(접시 BODY.000 는 Y 축 대칭) 후 화면에서 확인해 정한 값.
export const DISH_AXIS = new THREE.Vector3(0, 1, 0);

function fallbackModel() {
  // 기본 도형 조립: 접시, 10각형 버스, 과학 붐, 자력계 붐, RTG 붐 3개 (모델 단위 = 접시 지름 3.8 기준, 접시는 +Y 방향을 바라봄)
  const g = new THREE.Group();
  const gold = new THREE.MeshStandardMaterial({ color: 0xd8b24a, roughness: 0.6, metalness: 0.6 });
  const white = new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.8 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.9 });
  const dish = new THREE.Mesh(new THREE.SphereGeometry(1.9, 24, 12, 0, Math.PI * 2, 0, 0.55), white);
  dish.position.y = -1.0; dish.scale.y = 0.6; dish.material.side = THREE.DoubleSide;
  const bus = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.9, 10), gold);
  bus.position.y = -1.7;
  g.add(dish, bus);
  const boom = (len, dir, y, mat) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, len, 6), mat);
    m.position.copy(dir).multiplyScalar(len / 2 + 0.9).setY(y); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    g.add(m);
  };
  boom(6, new THREE.Vector3(1, 0, 0), -1.7, dark);                 // 과학 붐
  boom(7, new THREE.Vector3(-0.8, 0, 0.6).normalize(), -1.7, dark); // 자력계 붐
  boom(3.5, new THREE.Vector3(-0.5, 0, -0.85).normalize(), -1.7, dark); // RTG 붐
  boom(3.5, new THREE.Vector3(-0.2, 0, -0.98).normalize(), -2.2, dark);
  boom(3.5, new THREE.Vector3(0.3, 0, -0.95).normalize(), -2.7, dark);
  return g;
}

export function createVoyager(scene, data, onModelStatus) {
  const items = new Map();
  const tmp = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const quat = new THREE.Quaternion();
  let template = null; // 읽어 온 모델 (복제해서 쓴다)

  // 모델 불러오기 (실패하면 기본 도형)
  const modelReady = new Promise((resolve) => {
    new GLTFLoader().load('models/voyager.glb',
      (gltf) => { template = gltf.scene; onModelStatus?.('glb'); resolve(); },
      undefined,
      () => { template = fallbackModel(); onModelStatus?.('fallback'); resolve(); });
  });

  for (const c of data.craft) {
    const group = new THREE.Group();
    const holder = new THREE.Group();            // 모델 방향·크기 조절용
    holder.scale.setScalar(VOYAGER_DISH_SIZE / DISH_DIAMETER_IN_MODEL);
    group.add(holder);

    const marker = new THREE.Points(
      new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3)),
      new THREE.PointsMaterial({ color: 0xffd36b, size: 7, sizeAttenuation: false })
    );
    marker.frustumCulled = false;
    const labelEl = Object.assign(document.createElement('div'), { className: 'label voyager', textContent: c.name_ko });
    const label = new CSS2DObject(labelEl);
    group.add(marker, label);
    group.visible = false;
    scene.add(group);

    const trail = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xffd36b, transparent: true, opacity: 0.55 }));
    trail.frustumCulled = false;
    trail.visible = false;
    scene.add(trail);

    items.set(c.id, {
      def: { id: c.id, name: c.name_ko }, data: c, group, holder, marker, label, labelEl, trail,
      enabled: false, state: { visible: false }, au: new THREE.Vector3(),
      isVoyager: true, radius: VOYAGER_DISH_SIZE * 0.6, radiusNow: VOYAGER_DISH_SIZE * 0.6, kind: 'solid', lastLabelMs: 0, hasModel: false,
    });
  }

  modelReady.then(() => {
    for (const it of items.values()) {
      const m = template.clone(true);
      // 모델 가운데를 원점으로 (접시 중심 기준이 아니라 전체 바운딩 박스 중심)
      const box = new THREE.Box3().setFromObject(m);
      m.position.sub(box.getCenter(new THREE.Vector3()));
      it.holder.add(m);
      it.hasModel = true;
    }
  });

  const earthPos = new THREE.Vector3();
  // flags: { voyager1, voyager2, label }, earth: 지구 그룹 위치
  function update(date, flags, earth, camera, viewportHeight) {
    earthPos.copy(earth);
    const k = viewportHeight / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    for (const it of items.values()) {
      const s = voyagerState(it.data, date);
      it.state = s;
      const on = !!flags[it.def.id] && s.visible;
      it.group.visible = on;
      it.trail.visible = on;
      it.label.visible = on && flags.label;
      if (!s.visible) continue;
      it.au.set(s.x, s.y, s.z);
      applyScale(s, tmp);
      it.group.position.copy(tmp);
      if (!on) continue;

      // 안테나 접시는 지구 방향
      tmp.copy(earthPos).sub(it.group.position);
      if (tmp.lengthSq() > 1e-12) {
        tmp.normalize();
        it.holder.quaternion.copy(quat.setFromUnitVectors(DISH_AXIS, tmp));
      }
      // 구체(모델)가 화면에서 너무 작으면 점으로
      const dist = camera.position.distanceTo(it.group.position);
      const px = (VOYAGER_DISH_SIZE / 2 / dist) * k;
      it.marker.visible = px < 4;
      it.holder.visible = it.hasModel && px >= 1;
      it.label.position.set(0, VOYAGER_DISH_SIZE * 0.9, 0);

      // 항적: 발사 후 현재까지 (거리 스케일 적용)
      const pts = voyagerTrail(it.data, date);
      const arr = new Float32Array((pts.length + 1) * 3);
      pts.forEach((p, i) => { applyScale(p, tmp); arr[i * 3] = tmp.x; arr[i * 3 + 1] = tmp.y; arr[i * 3 + 2] = tmp.z; });
      const n = pts.length;
      arr[n * 3] = it.group.position.x; arr[n * 3 + 1] = it.group.position.y; arr[n * 3 + 2] = it.group.position.z;
      it.trail.geometry.setAttribute('position', new THREE.BufferAttribute(arr, 3));
      it.trail.geometry.computeBoundingSphere();

      // 라벨 문구 (이름·거리·속도)
      const now = performance.now();
      if (now - it.lastLabelMs > 250) {
        it.lastLabelMs = now;
        it.labelEl.textContent = `${it.data.name_ko} · ${s.r.toFixed(1)} AU · ${s.speedKms.toFixed(1)} km/s${s.extrapolated ? ' · 외삽값' : ''}`;
      }
    }
  }

  return {
    items, update,
    all: () => [...items.values()],
    positionOf: (id) => items.get(id).group.position,
    modelReady,
  };
}
