// 장식용 소행성대: 시각 연출용 가짜 점 구름. 실제 데이터가 아니다. (PRD 3.10)
// 점 BELT_COUNT 개, 반지름 2.1~3.3 AU, 궤도 경사는 작은 무작위, 공전은 케플러 주기(P ∝ a^1.5)에 비례해 천천히 돈다.
import * as THREE from 'three';
import { scaleRadius } from '../sim/scale.js';

export const BELT_COUNT = 4000;   // 개수 조절용 상수 (PRD: 3,000~5,000)
export const BELT_A_MIN = 2.1;    // AU
export const BELT_A_MAX = 3.3;    // AU
export const BELT_MAX_INC_DEG = 12;

const DEG = Math.PI / 180;
const J2000_MS = Date.UTC(2000, 0, 1, 12);

export function createBelt(scene) {
  let seed = 987654321;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

  const n = BELT_COUNT;
  const a = new Float32Array(n), phi0 = new Float32Array(n), cn = new Float32Array(n), sn = new Float32Array(n);
  const ci = new Float32Array(n), si = new Float32Array(n), omega = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    a[k] = BELT_A_MIN + (BELT_A_MAX - BELT_A_MIN) * (rnd() + rnd()) / 2; // 가운데가 조금 더 촘촘
    phi0[k] = rnd() * Math.PI * 2;
    const node = rnd() * Math.PI * 2;
    const inc = Math.min(Math.abs((rnd() + rnd() + rnd() - 1.5) * 8), BELT_MAX_INC_DEG) * DEG; // 대부분 작은 경사
    cn[k] = Math.cos(node); sn[k] = Math.sin(node); ci[k] = Math.cos(inc); si[k] = Math.sin(inc);
    omega[k] = (Math.PI * 2) / (365.25 * Math.pow(a[k], 1.5)); // rad/일 (원궤도 가정)
  }

  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(n * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xb0a595, size: 1.7, sizeAttenuation: false, transparent: true, opacity: 0.7, depthWrite: false }));
  pts.frustumCulled = false;
  pts.visible = false;
  scene.add(pts);

  return {
    points: pts,
    update(date, enabled) {
      pts.visible = enabled;
      if (!enabled) return;
      const t = (date.getTime() - J2000_MS) / 86400000; // J2000 이후 일수
      for (let k = 0; k < n; k++) {
        const ph = phi0[k] + omega[k] * t;
        const c = Math.cos(ph), s = Math.sin(ph);
        // 궤도면 -> 황도 (승교점 경도 + 경사). 원궤도라 태양 거리 = a 이므로 거리 스케일 계수는 점마다 a 만으로 정해진다.
        const X = a[k] * (c * cn[k] - s * ci[k] * sn[k]);
        const Y = a[k] * (c * sn[k] + s * ci[k] * cn[k]);
        const Z = a[k] * s * si[k];
        const f = scaleRadius(a[k]) / a[k];
        pos[k * 3] = X * f; pos[k * 3 + 1] = Z * f; pos[k * 3 + 2] = -Y * f; // 화면 좌표 (x, 위, -y)
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}
