// 행성 궤도선: 한 주기를 샘플링해 닫힌 선으로 그린다.
import * as THREE from 'three';
import { PLANETS } from '../data/planets.js';
import { sampleOrbit } from '../sim/ephemeris.js';
import { applyScale } from '../sim/scale.js';

export function createOrbits(scene, startDate) {
  const group = new THREE.Group();
  const mat = new THREE.LineBasicMaterial({ color: 0x2f8aa0, transparent: true, opacity: 0.55 });
  const orbits = [];
  const tmp = new THREE.Vector3();

  for (const def of PLANETS) {
    const au = sampleOrbit(def.astro, startDate, def.periodDays, 360); // AU 좌표 원본 (스케일 모드 변경 시 다시 변환)
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(au.length * 3), 3));
    const line = new THREE.LineLoop(geo, mat);
    line.frustumCulled = false;
    group.add(line);
    orbits.push({ id: def.id, au, line });
  }

  // 현재 스케일 모드로 선 좌표 다시 계산 (M2 에서 모드 전환 시 호출)
  function rebuild() {
    for (const o of orbits) {
      const arr = o.line.geometry.attributes.position.array;
      o.au.forEach((p, i) => {
        applyScale(p, tmp);
        arr[i * 3] = tmp.x; arr[i * 3 + 1] = tmp.y; arr[i * 3 + 2] = tmp.z;
      });
      o.line.geometry.attributes.position.needsUpdate = true;
    }
  }
  rebuild();
  scene.add(group);
  return { group, rebuild };
}
