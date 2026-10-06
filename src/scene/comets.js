// 혜성: 머리(점+빛무리), 꼬리(태양 반대 방향, 근일점에 가까울수록 길고 밝게), 이름표, 궤도선.
import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { prepareComet, cometPositionAU, cometOrbitAU } from '../sim/comets.js';
import { applyScale } from '../sim/scale.js';

const TAIL_POINTS = 160;
const TAIL_MAX = 3.0;          // 꼬리 최대 길이 (화면 단위). 실제 태양 거리 1 AU 에서 약 절반
const TAIL_R0 = 1.0;           // 꼬리 활동도 = 1 / (1 + (r/R0)²)
const TAIL_HIDE_BELOW = 0.02;  // 활동도가 이보다 낮으면 꼬리를 그리지 않음 (r ≈ 7 AU 이상)
const ORBIT_RMAX = 60;         // 궤도선은 태양 거리 60 AU 이내 구간만 (장주기 혜성이 화면을 뒤덮지 않게)
const ORBIT_RMAX_INTERSTELLAR = 25; // 성간천체는 근일점 전후만

const COLORS = { periodic: 0x9fd8ff, longperiod: 0xcfe9ff, interstellar: 0xffa94d };

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 1, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,0.95)');
  grad.addColorStop(0.3, 'rgba(255,255,255,0.35)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export function createComets(scene, cometData) {
  const items = new Map();
  const glowTex = glowTexture();
  const tmp = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const p1 = new THREE.Vector3(), p2 = new THREE.Vector3();

  // 꼬리 입자의 고정된 흩어짐 (프레임마다 흔들리지 않게 미리 정함)
  let seed = 12345;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

  for (const c of cometData.comets) {
    prepareComet(c);
    const color = new THREE.Color(COLORS[c.kind] ?? 0xcfe9ff);
    const group = new THREE.Group();

    const head = new THREE.Points(
      new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3)),
      new THREE.PointsMaterial({ color, size: c.kind === 'interstellar' ? 8 : 6, sizeAttenuation: false })
    );
    head.frustumCulled = false;
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, sizeAttenuation: false }));
    glow.scale.setScalar(0.03);

    const tailGeo = new THREE.BufferGeometry();
    tailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TAIL_POINTS * 3), 3));
    tailGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(TAIL_POINTS * 3), 3));
    const tail = new THREE.Points(tailGeo, new THREE.PointsMaterial({
      map: glowTex, size: 12, sizeAttenuation: false, vertexColors: true, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
    }));
    tail.frustumCulled = false;
    const spread = Array.from({ length: TAIL_POINTS }, () => ({ phi: rnd() * Math.PI * 2, k: rnd() }));

    const label = new CSS2DObject(Object.assign(document.createElement('div'), {
      className: 'label comet', textContent: c.kind === 'interstellar' ? `${c.name_ko} (성간천체)` : c.name_ko,
    }));
    group.add(head, glow, tail, label);
    scene.add(group);

    const orbit = new THREE.Line(new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: c.kind === 'interstellar' ? 0.7 : 0.35 }));
    orbit.frustumCulled = false;
    scene.add(orbit);
    const orbitAU = cometOrbitAU(c, c.kind === 'interstellar' ? ORBIT_RMAX_INTERSTELLAR : ORBIT_RMAX);

    items.set(c.id, {
      def: { id: c.id, name: c.kind === 'interstellar' ? c.name_ko : c.name_ko }, data: c, group, head, glow, tail, label, orbit, orbitAU,
      color, spread, enabled: true, rAU: 0, activity: 0, au: new THREE.Vector3(), isComet: true, radius: 0.04, radiusNow: 0.04, kind: 'solid',
    });
  }

  function rebuildOrbits() {
    for (const it of items.values()) {
      const arr = new Float32Array(it.orbitAU.length * 3);
      it.orbitAU.forEach((p, i) => { applyScale(p, tmp); arr[i * 3] = tmp.x; arr[i * 3 + 1] = tmp.y; arr[i * 3 + 2] = tmp.z; });
      it.orbit.geometry.setAttribute('position', new THREE.BufferAttribute(arr, 3));
      it.orbit.geometry.computeBoundingSphere();
    }
  }
  rebuildOrbits();

  // flags: { comets, orbit, label }
  function update(date, flags) {
    for (const it of items.values()) {
      const on = flags.comets && it.enabled;
      it.group.visible = on;
      it.orbit.visible = on && flags.orbit;
      it.label.visible = on && flags.label;

      // 숨겨져도 위치는 갱신 (카드·포커스용). 21개라 가볍다.
      const p = cometPositionAU(it.data, date);
      it.rAU = p.r;
      it.au.set(p.x, p.y, p.z);
      applyScale(p, tmp);
      it.group.position.copy(tmp);
      if (!on) continue;

      // 꼬리: 태양 반대 방향. 활동도(근일점에 가까울수록 1) 에 비례해 길고 밝게
      const act = 1 / (1 + (p.r / TAIL_R0) ** 2);
      it.activity = act;
      it.glow.scale.setScalar(0.022 + 0.05 * act);
      const showTail = act >= TAIL_HIDE_BELOW;
      it.tail.visible = showTail;
      if (!showTail) continue;
      const len = TAIL_MAX * act;
      tmp.normalize(); // 화면 좌표의 태양→혜성 방향 = 꼬리 방향
      p1.crossVectors(tmp, up); if (p1.lengthSq() < 1e-8) p1.set(1, 0, 0); p1.normalize();
      p2.crossVectors(tmp, p1);
      const pos = it.tail.geometry.attributes.position.array;
      const col = it.tail.geometry.attributes.color.array;
      for (let k = 0; k < TAIL_POINTS; k++) {
        const u = (k + 1) / TAIL_POINTS;           // 0(머리) → 1(꼬리 끝)
        const s = it.spread[k];
        const along = len * Math.pow(u, 1.15);
        const lat = len * u * 0.1 * s.k;
        const cx = Math.cos(s.phi) * lat, cy = Math.sin(s.phi) * lat;
        pos[k * 3] = tmp.x * along + p1.x * cx + p2.x * cy;
        pos[k * 3 + 1] = tmp.y * along + p1.y * cx + p2.y * cy;
        pos[k * 3 + 2] = tmp.z * along + p1.z * cx + p2.z * cy;
        const f = 0.45 * Math.pow(1 - u, 1.5) * Math.min(1, 0.35 + act);
        col[k * 3] = it.color.r * f; col[k * 3 + 1] = it.color.g * f; col[k * 3 + 2] = it.color.b * f;
      }
      it.tail.geometry.attributes.position.needsUpdate = true;
      it.tail.geometry.attributes.color.needsUpdate = true;
    }
  }

  return {
    items, update, rebuildOrbits,
    all: () => [...items.values()],
    setEnabled(id, v) { items.get(id).enabled = v; },
    setAllEnabled(v) { for (const it of items.values()) it.enabled = v; },
    positionOf: (id) => items.get(id).group.position,
  };
}
