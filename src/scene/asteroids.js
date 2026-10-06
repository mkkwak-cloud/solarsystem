// 소행성·왜행성 9개: 구체(텍스처), 이름표, 궤도선. 위치는 JPL SBDB 궤도요소 + 케플러.
import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { prepareSmallBody, smallBodyPositionAU, smallBodyOrbitAU } from '../sim/comets.js';
import { applyScale } from '../sim/scale.js';
import { ASTEROID_VISUAL, AST_RADIUS_BASE, AST_RADIUS_SPAN, ASTEROID_ORBIT_RMAX } from '../data/asteroids.js';

export function createAsteroids(scene, data) {
  const items = new Map();
  const sphereGeo = new THREE.SphereGeometry(1, 36, 18);
  const tmp = new THREE.Vector3();

  for (const a of data.asteroids) {
    prepareSmallBody(a);
    const vis = ASTEROID_VISUAL[a.id] ?? {};
    const radiusKm = vis.radiusKm ?? (a.diameter_km ? a.diameter_km / 2 : 1);
    const radius = AST_RADIUS_BASE + AST_RADIUS_SPAN * Math.sqrt(radiusKm / 1188);

    const group = new THREE.Group();
    const mesh = new THREE.Mesh(sphereGeo, new THREE.MeshStandardMaterial({ color: vis.color ?? 0x999999, roughness: 1, metalness: 0 }));
    mesh.scale.setScalar(radius);
    const marker = new THREE.Points(
      new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3)),
      new THREE.PointsMaterial({ color: vis.color ?? 0x999999, size: 6, sizeAttenuation: false })
    );
    marker.frustumCulled = false;
    const label = new CSS2DObject(Object.assign(document.createElement('div'), { className: 'label asteroid', textContent: a.name_ko }));
    group.add(mesh, marker, label);
    scene.add(group);

    const orbit = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xb59a6a, transparent: true, opacity: 0.4 }));
    orbit.frustumCulled = false;
    scene.add(orbit);

    items.set(a.id, {
      def: { id: a.id, name: a.name_ko }, data: a, group, mesh, marker, label, orbit, orbitAU: smallBodyOrbitAU(a, ASTEROID_ORBIT_RMAX),
      enabled: true, rAU: 0, au: new THREE.Vector3(), isAsteroid: true, radius, radiusNow: radius, kind: 'solid',
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

  // flags: { asteroids, orbit, label }
  function update(date, flags) {
    for (const it of items.values()) {
      const on = flags.asteroids && it.enabled;
      it.group.visible = on;
      it.orbit.visible = on && flags.orbit;
      it.label.visible = on && flags.label;
      const p = smallBodyPositionAU(it.data, date); // 숨겨져도 위치는 갱신 (카드·포커스용)
      it.rAU = p.r;
      it.au.set(p.x, p.y, p.z);
      applyScale(p, tmp);
      it.group.position.copy(tmp);
      if (on) it.label.position.set(0, it.radiusNow * 1.3, 0);
    }
  }

  function setSizeScale(m) {
    for (const it of items.values()) { it.radiusNow = it.radius * m; it.mesh.scale.setScalar(it.radiusNow); }
  }

  // 구체가 화면에서 너무 작으면 점으로 보이게
  function updateMarkers(camera, viewportHeight) {
    const k = viewportHeight / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    for (const it of items.values()) {
      if (!it.group.visible) continue;
      it.marker.visible = (it.radiusNow / camera.position.distanceTo(it.group.position)) * k < 3;
    }
  }

  function setTexture(id, texture, kind) {
    const it = items.get(id);
    it.kind = kind;
    if (texture) { it.mesh.material.map = texture; it.mesh.material.color.set(0xffffff); it.mesh.material.needsUpdate = true; }
  }

  return {
    items, update, setSizeScale, updateMarkers, setTexture, rebuildOrbits,
    all: () => [...items.values()],
    setEnabled(id, v) { items.get(id).enabled = v; },
    setAllEnabled(v) { for (const it of items.values()) it.enabled = v; },
    positionOf: (id) => items.get(id).group.position,
  };
}
