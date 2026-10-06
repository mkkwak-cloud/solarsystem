// 태양과 행성: 구체, 라벨, 토성 고리, 위치 갱신.
import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { SUN, PLANETS, displayRadius, SUN_DISPLAY_RADIUS } from '../data/planets.js';
import { helioPosition } from '../sim/ephemeris.js';
import { applyScale } from '../sim/scale.js';
import { orientation, poleDirection } from '../sim/rotation.js';
import { jdFromDate } from '../sim/kepler.js';

function makeLabel(text) {
  const div = document.createElement('div');
  div.className = 'label';
  div.textContent = text;
  return new CSS2DObject(div);
}

// 멀리서 볼 때 행성이 점보다 작아 안 보이는 문제를 막는 고정 크기(화면 픽셀) 점
function makeMarker(color) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color, size: 7, sizeAttenuation: false }));
  pts.frustumCulled = false;
  return pts;
}

function glowSprite() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,230,160,0.95)');
  grad.addColorStop(0.25, 'rgba(255,190,90,0.45)');
  grad.addColorStop(1, 'rgba(255,150,40,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const mat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  const s = new THREE.Sprite(mat);
  s.scale.setScalar(0.9);
  return s;
}

const ROTATION_IDS = new Set(['sun', 'mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune']);

export function createBodies(scene) {
  const items = new Map(); // id -> { def, group, mesh, label, radius, kind, astro }

  // --- 태양 ---
  const sunGroup = new THREE.Group();
  const sunMesh = new THREE.Mesh(
    new THREE.SphereGeometry(SUN_DISPLAY_RADIUS, 64, 32),
    new THREE.MeshBasicMaterial({ color: SUN.color })
  );
  sunGroup.add(sunMesh, glowSprite());
  const sunLabel = makeLabel(SUN.name);
  sunLabel.position.set(0, SUN_DISPLAY_RADIUS, 0);
  sunGroup.add(sunLabel);
  const light = new THREE.PointLight(0xffffff, 3, 0, 0); // decay 0: 먼 행성도 어둡지 않게
  sunGroup.add(light);
  scene.add(sunGroup);
  items.set('sun', { def: SUN, group: sunGroup, mesh: sunMesh, label: sunLabel, radius: SUN_DISPLAY_RADIUS, kind: 'solid', isSun: true });

  // --- 행성 ---
  for (const def of PLANETS) {
    const radius = displayRadius(def.radiusKm);
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 48, 24),
      new THREE.MeshStandardMaterial({ color: def.color, roughness: 1, metalness: 0 })
    );
    group.add(mesh);
    const marker = makeMarker(def.color);
    group.add(marker);
    const label = makeLabel(def.name);
    label.position.set(0, radius, 0);
    group.add(label);
    scene.add(group);
    items.set(def.id, { def, group, mesh, label, marker, radius, kind: 'solid', astro: def.astro, au: new THREE.Vector3(), ringGroup: null });
  }

  // 토성 고리: 반지름 방향으로 띠 텍스처를 입힌다.
  function addRing(saturn, ringTex) {
    const { inner, outer, tiltDeg } = saturn.def.ring;
    const r0 = saturn.radius * inner, r1 = saturn.radius * outer;
    const geo = new THREE.RingGeometry(r0, r1, 128, 1);
    const pos = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const r = Math.hypot(pos.getX(i), pos.getY(i));
      uv.setXY(i, (r - r0) / (r1 - r0), 0.5);
    }
    // 고리 텍스처를 못 읽으면 반투명 단색 고리로 대신한다
    const mat = new THREE.MeshStandardMaterial({ map: ringTex ?? null, color: ringTex ? 0xffffff : 0xcdbb94, transparent: true, opacity: ringTex ? 1 : 0.55, side: THREE.DoubleSide, roughness: 1, depthWrite: false });
    const ring = new THREE.Mesh(geo, mat);
    ring.rotation.x = -Math.PI / 2; // 수평으로 눕힘
    const tilt = new THREE.Group();
    // 고리면 = 토성 적도면: 고리 법선(+Y)을 토성 북극 방향으로 돌린다 (IAU 자전축). tiltDeg 는 쓰지 않음
    tilt.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), poleDirection('saturn'));
    tilt.add(ring);
    tilt.scale.setScalar(sizeScale);
    saturn.ringGroup = tilt;
    saturn.group.add(tilt);
  }

  const tmp = new THREE.Vector3();
  // 자전: 켜 있으면 시뮬레이션 시각의 위상, 꺼 있으면 끈 순간의 위상으로 고정 (자전축 기울기는 항상 반영)
  let spinOn = true, frozenJD = 0;
  function setSpin(enabled, date) {
    spinOn = enabled;
    frozenJD = jdFromDate(date);
  }

  function update(date) {
    const jd = spinOn ? jdFromDate(date) : frozenJD;
    for (const it of items.values()) {
      if (ROTATION_IDS.has(it.def.id)) orientation(it.def.id, jd, it.mesh.quaternion);
      if (it.isSun) continue;
      const p = helioPosition(it.astro, date);
      it.au.set(p.x, p.y, p.z); // 실제 AU 좌표 (카드의 거리·속도 계산용)
      applyScale(p, tmp);
      it.group.position.copy(tmp);
    }
  }

  // 행성 크기 배율 (태양은 그대로). 라벨·고리도 같이 맞춘다.
  let sizeScale = 1;
  function setSizeScale(m) {
    sizeScale = m;
    for (const it of items.values()) {
      if (it.isSun) continue;
      it.mesh.scale.setScalar(m);
      it.label.position.set(0, it.radius * m, 0);
      it.ringGroup?.scale.setScalar(m);
    }
  }
  function setLabelsVisible(v) { for (const it of items.values()) it.label.visible = v; }

  // 구체가 화면에서 6픽셀보다 작을 때만 점 표시를 켠다.
  function updateMarkers(camera, viewportHeight) {
    const k = viewportHeight / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    for (const it of items.values()) {
      if (!it.marker) continue;
      const dist = camera.position.distanceTo(it.group.position);
      it.marker.visible = (it.radius * sizeScale / dist) * k < 3;
    }
  }

  function setTexture(id, texture, kind) {
    const it = items.get(id);
    it.kind = kind;
    if (texture) {
      it.mesh.material.map = texture;
      it.mesh.material.color.set(0xffffff);
      it.mesh.material.needsUpdate = true;
    }
  }

  return {
    items, update, updateMarkers, setTexture, addRing, setSizeScale, setLabelsVisible, setSpin,
    positionOf: (id) => items.get(id).group.position,
    // 화면에서 id 천체와 가장 가까운 천체 찾기용 (클릭 판정)
    all: () => [...items.values()],
  };
}
