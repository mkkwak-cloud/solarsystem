// 제임스웹 우주망원경(JWST): 태양-지구 L2 (지구에서 태양 반대쪽 약 150만 km = 0.01 AU).
// 실제 거리는 지구를 크게 그린 반지름보다 작아서, 화면에서는 달 궤도보다 조금 바깥(거리 과장)에 그린다. 방향(태양 반대쪽)은 실제와 같다.
// 카드에서 우주망원경 시뮬레이터(telescope.html)로 이동할 수 있다.
import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

export const L2_AU = 0.01;   // 지구–L2 거리 (약 150만 km)

export function createJwst(scene) {
  const group = new THREE.Group();
  const marker = new THREE.Points(
    new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3)),
    new THREE.PointsMaterial({ color: 0xf2c355, size: 7, sizeAttenuation: false })
  );
  marker.frustumCulled = false;
  const labelEl = Object.assign(document.createElement('div'), { className: 'label voyager', textContent: '제임스웹 (L2 · 거리 과장)' });
  const label = new CSS2DObject(labelEl);
  group.add(marker, label);
  scene.add(group);

  const link = new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3)),
    new THREE.LineDashedMaterial({ color: 0xf2c355, dashSize: 0.004, gapSize: 0.003, transparent: true, opacity: 0.6 }));
  link.frustumCulled = false;
  scene.add(link);

  const it = {
    def: { id: 'jwst', name: '제임스웹 우주망원경 (L2)' }, group, marker, label, labelEl, link,
    au: new THREE.Vector3(), isVoyager: true, radius: 0.004, radiusNow: 0.004, kind: 'solid',
  };
  const items = new Map([['jwst', it]]);
  const dir = new THREE.Vector3();

  // earthAU: 지구 실제 위치(AU), earthPos: 지구 화면 위치, screenDist: 화면에서 지구–JWST 거리
  function update(on, showLabel, earthAU, earthPos, screenDist) {
    group.visible = on; link.visible = on; label.visible = on && showLabel;
    if (!on) return;
    dir.copy(earthAU).normalize();                       // 태양 → 지구 방향 = 지구 → L2 방향
    it.au.copy(earthAU).addScaledVector(dir, L2_AU);
    group.position.copy(earthPos).addScaledVector(dir, screenDist);
    label.position.set(0, 0.01, 0);
    const a = link.geometry.attributes.position.array;
    a[0] = earthPos.x; a[1] = earthPos.y; a[2] = earthPos.z; a[3] = group.position.x; a[4] = group.position.y; a[5] = group.position.z;
    link.geometry.attributes.position.needsUpdate = true; link.computeLineDistances();
  }
  return { items, all: () => [...items.values()], update };
}
