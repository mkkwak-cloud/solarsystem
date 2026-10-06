// 행성 꼬리·궤적.
//  이동(꼬리): 행성 바로 뒤에서 점점 사라지는 짧은 꼬리 (최근 공전 주기의 약 15%). 매 프레임 위치를 다시 계산한다.
//  궤적: 켠 순간부터 실제로 지나온 경로를 계속 쌓아 그린 선. 날짜를 새로 적용하면 비운다.
import * as THREE from 'three';
import { PLANETS } from '../data/planets.js';
import { helioPosition } from '../sim/ephemeris.js';
import { applyScale } from '../sim/scale.js';

const TAIL_POINTS = 28;
const TAIL_FRACTION = 0.15;   // 공전 주기 대비 꼬리 길이
const PATH_MAX = 1500;        // 행성당 궤적 점 최대 개수
const PATH_STEP_DIV = 240;    // 주기를 이 개수로 나눈 간격으로 점을 쌓는다
const MAX_SAMPLES_PER_FRAME = 300;
const DAY_MS = 86400000;

export function createTrails(scene) {
  const tailGroup = new THREE.Group();
  const pathGroup = new THREE.Group();
  scene.add(tailGroup, pathGroup);
  const tmp = new THREE.Vector3();
  const items = [];

  for (const def of PLANETS) {
    const base = new THREE.Color(def.color).lerp(new THREE.Color(0xffffff), 0.35);

    const tailGeo = new THREE.BufferGeometry();
    tailGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TAIL_POINTS * 3), 3));
    const colors = new Float32Array(TAIL_POINTS * 3);
    for (let k = 0; k < TAIL_POINTS; k++) {
      const f = Math.pow(k / (TAIL_POINTS - 1), 1.6); // 뒤쪽일수록 어둡게
      colors.set([base.r * f, base.g * f, base.b * f], k * 3);
    }
    tailGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const tail = new THREE.Line(tailGeo, new THREE.LineBasicMaterial({ vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    tail.frustumCulled = false;
    tailGroup.add(tail);

    const pathGeo = new THREE.BufferGeometry();
    pathGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((PATH_MAX + 1) * 3), 3));
    const path = new THREE.Line(pathGeo, new THREE.LineBasicMaterial({ color: base, transparent: true, opacity: 0.8 }));
    path.frustumCulled = false;
    pathGroup.add(path);

    items.push({ def, tail, path, pts: [], lastMs: null });
  }

  let pathDirty = true;
  tailGroup.visible = false;
  pathGroup.visible = false;

  function updateTail(dateMs) {
    for (const it of items) {
      const arr = it.tail.geometry.attributes.position.array;
      const len = it.def.periodDays * TAIL_FRACTION * DAY_MS;
      for (let k = 0; k < TAIL_POINTS; k++) {
        const t = dateMs - ((TAIL_POINTS - 1 - k) / (TAIL_POINTS - 1)) * len;
        applyScale(helioPosition(it.def.astro, new Date(t)), tmp);
        arr[k * 3] = tmp.x; arr[k * 3 + 1] = tmp.y; arr[k * 3 + 2] = tmp.z;
      }
      it.tail.geometry.attributes.position.needsUpdate = true;
    }
  }

  function updatePath(dateMs, currentPositions) {
    for (const it of items) {
      if (it.lastMs === null || dateMs < it.lastMs) { it.pts.length = 0; it.lastMs = dateMs; pathDirty = true; }
      const step = (it.def.periodDays / PATH_STEP_DIV) * DAY_MS;
      const span = dateMs - it.lastMs;
      if (span >= step) {
        const eff = Math.max(step, span / MAX_SAMPLES_PER_FRAME);
        let t = it.lastMs + eff;
        for (; t <= dateMs; t += eff) it.pts.push(helioPosition(it.def.astro, new Date(t)));
        it.lastMs = t - eff;
        if (it.pts.length > PATH_MAX) it.pts.splice(0, it.pts.length - PATH_MAX);
        pathDirty = true;
      }
    }
    if (!pathDirty && !currentPositions) return;
    // 현재 위치까지 이어 그려야 하므로 매 프레임 마지막 점은 새로 쓴다.
    for (const it of items) {
      const arr = it.path.geometry.attributes.position.array;
      let n = 0;
      for (const p of it.pts) { applyScale(p, tmp); arr[n * 3] = tmp.x; arr[n * 3 + 1] = tmp.y; arr[n * 3 + 2] = tmp.z; n++; }
      const cur = currentPositions?.get(it.def.id);
      if (cur) { arr[n * 3] = cur.x; arr[n * 3 + 1] = cur.y; arr[n * 3 + 2] = cur.z; n++; }
      it.path.geometry.setDrawRange(0, n);
      it.path.geometry.attributes.position.needsUpdate = true;
    }
    pathDirty = false;
  }

  return {
    // flags: { tail, path }, currentPositions: Map(id -> 화면 좌표 Vector3)
    update(dateMs, flags, currentPositions) {
      tailGroup.visible = flags.tail;
      pathGroup.visible = flags.path;
      if (flags.tail) updateTail(dateMs);
      if (flags.path) updatePath(dateMs, currentPositions);
      else for (const it of items) { it.pts.length = 0; it.lastMs = null; }
    },
    clear() { for (const it of items) { it.pts.length = 0; it.lastMs = null; } pathDirty = true; },
    markDirty() { pathDirty = true; },
  };
}
