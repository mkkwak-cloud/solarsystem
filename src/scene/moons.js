// 위성: 구체, 궤도선, 라벨, 줌 연동(LOD). 위치는 행성 중심 오프셋을 압축해서 행성 근처에 그린다.
import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { AU_KM } from '../data/planets.js';
import {
  MOON_VISUAL, MOON_RADIUS_BASE, MOON_ORBIT_START, MOON_ORBIT_SPREAD, MOON_LOD_FACTOR,
} from '../data/moons.js';
import { moonOffsetAU, sampleMoonOrbit, prepareMoon } from '../sim/moons.js';

function makeLabel(text) {
  const div = document.createElement('div');
  div.className = 'label moon';
  div.textContent = text;
  return new CSS2DObject(div);
}

export function createMoons(scene, moonData, hostOf) {
  // hostOf(planetId) -> 행성 항목 { def, group, radius }  (scene/bodies.js)
  const items = new Map();
  const orbitMat = new THREE.LineBasicMaterial({ color: 0x6f8fb0, transparent: true, opacity: 0.45 });
  const sphereGeo = new THREE.SphereGeometry(1, 40, 20);
  let sizeScale = 1;

  const hostInfo = new Map(); // planetId -> { maxRatio, lod: bool }
  for (const m of moonData.moons) {
    prepareMoon(m);
    const host = hostOf(m.planet);
    const vis = MOON_VISUAL[m.id] ?? {};
    const radius = MOON_RADIUS_BASE * Math.pow(m.radius_km / 6371, 0.45); // 크기 배율 1 일 때 화면 반지름(AU)

    const group = new THREE.Group();
    const mesh = new THREE.Mesh(sphereGeo, new THREE.MeshStandardMaterial({ color: vis.color ?? 0xaaaaaa, roughness: 1, metalness: 0 }));
    mesh.scale.setScalar(radius);
    group.add(mesh);

    let atmos = null;
    if (vis.atmosphere) {
      atmos = new THREE.Mesh(sphereGeo, new THREE.MeshStandardMaterial({
        color: vis.atmosphere.color, transparent: true, opacity: vis.atmosphere.opacity, roughness: 1,
        emissive: 0x3a1a05, depthWrite: false,
      }));
      atmos.scale.setScalar(radius * vis.atmosphere.scale);
      group.add(atmos);
    }

    const marker = new THREE.Points(
      new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3)),
      new THREE.PointsMaterial({ color: vis.color ?? 0xaaaaaa, size: 5, sizeAttenuation: false })
    );
    marker.frustumCulled = false;
    group.add(marker);

    const label = makeLabel(m.name_ko);
    group.add(label);
    group.visible = false;
    scene.add(group);

    const orbit = new THREE.LineLoop(new THREE.BufferGeometry(), orbitMat);
    orbit.frustumCulled = false;
    orbit.visible = false;
    scene.add(orbit);

    const item = {
      def: { id: m.id, name: m.name_ko }, data: m, host, group, mesh, atmos, marker, label, orbit,
      radius, radiusNow: radius, kind: 'solid', isMoon: true, spinDeg: vis.lonCenterW ?? 0,
      offAU: new THREE.Vector3(), lastOrbitMs: null,
    };
    items.set(m.id, item);

    const hi = hostInfo.get(m.planet) ?? { maxRatio: 0, lod: false };
    hi.maxRatio = Math.max(hi.maxRatio, (m.osc ? m.osc.a_km : m.jpl_mean_table.a_km) / host.def.radiusKm);
    hostInfo.set(m.planet, hi);
  }

  // 실제 거리 -> 화면 거리 (행성 화면 반지름 기준으로 압축)
  const hostRd = (host) => host.radius * sizeScale;
  function displayDistance(host, rAU) {
    const ratio = (rAU * AU_KM) / host.def.radiusKm;
    return hostRd(host) * (MOON_ORBIT_START + MOON_ORBIT_SPREAD * Math.sqrt(Math.max(ratio - 1, 0)));
  }
  function compressInto(host, off, out) {
    const r = Math.hypot(off.x, off.y, off.z);
    if (r < 1e-12) return out.set(0, 0, 0);
    const k = displayDistance(host, r) / r;
    return out.set(off.x * k, off.y * k, off.z * k);
  }
  function lodRadius(planetId) {
    const host = hostOf(planetId);
    const hi = hostInfo.get(planetId);
    const rAU = (hi.maxRatio * host.def.radiusKm) / AU_KM;
    return displayDistance(host, rAU) * MOON_LOD_FACTOR;
  }

  const tmp = new THREE.Vector3();
  const basisX = new THREE.Vector3(), basisY = new THREE.Vector3(), basisZ = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const rot = new THREE.Matrix4();
  const spin = new THREE.Quaternion();

  function rebuildOrbit(it, date) {
    const pts = sampleMoonOrbit(it.data, date, 96);
    const arr = new Float32Array(pts.length * 3);
    pts.forEach((p, i) => { compressInto(it.host, p, tmp); arr[i * 3] = tmp.x; arr[i * 3 + 1] = tmp.y; arr[i * 3 + 2] = tmp.z; });
    it.orbit.geometry.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    it.orbit.geometry.computeBoundingSphere();
    it.lastOrbitMs = date.getTime();
  }

  let dirty = true;
  // flags: { moons, orbit, label }
  function update(date, camera, flags) {
    for (const [pid, hi] of hostInfo) {
      const host = hostOf(pid);
      hi.lod = flags.moons && camera.position.distanceTo(host.group.position) < lodRadius(pid);
    }
    for (const it of items.values()) {
      const hi = hostInfo.get(it.data.planet);
      const show = hi.lod;
      it.group.visible = show;
      it.orbit.visible = show && flags.orbit;
      it.label.visible = show && flags.label; // CSS2D 라벨은 부모 그룹이 숨겨져도 따로 그려지므로 직접 끈다

      // 숨겨진 위성도 위치는 갱신한다 (멀리서 위성을 선택해 포커스할 때 카메라가 가야 할 곳을 알아야 함)
      const off = moonOffsetAU(it.data, date);
      it.offAU.set(off.x, off.y, off.z);
      compressInto(it.host, off, tmp);
      it.group.position.copy(it.host.group.position).add(tmp);
      if (!show) continue;

      // 한쪽 면이 항상 행성을 향한다 (지도 가운데가 행성 쪽). 자전축은 궤도면 법선이 아니라 화면 위쪽을 쓴다.
      basisX.copy(it.host.group.position).sub(it.group.position).normalize();
      basisZ.crossVectors(basisX, up).normalize();
      basisY.crossVectors(basisZ, basisX);
      rot.makeBasis(basisX, basisY, basisZ);
      it.mesh.quaternion.setFromRotationMatrix(rot);
      if (it.spinDeg) it.mesh.quaternion.multiply(spin.setFromAxisAngle(up, THREE.MathUtils.degToRad(it.spinDeg)));
      if (it.atmos) it.atmos.quaternion.copy(it.mesh.quaternion);

      if (it.orbit.visible) {
        if (dirty || it.lastOrbitMs === null || Math.abs(date.getTime() - it.lastOrbitMs) > it.data.periodDays * 86400000 * 0.03) rebuildOrbit(it, date);
        it.orbit.position.copy(it.host.group.position);
      }
      it.label.position.set(0, it.radiusNow * 1.2, 0);
    }
    dirty = false;
  }

  function setSizeScale(m) {
    sizeScale = m;
    for (const it of items.values()) {
      it.radiusNow = it.radius * m;
      it.mesh.scale.setScalar(it.radiusNow);
      if (it.atmos) it.atmos.scale.setScalar(it.radiusNow * (MOON_VISUAL[it.data.id].atmosphere.scale));
    }
    dirty = true;
  }

  // 멀리서 볼 때 구체가 너무 작으면 점으로 보이게
  function updateMarkers(camera, viewportHeight) {
    const k = viewportHeight / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    for (const it of items.values()) {
      if (!it.group.visible) continue;
      const dist = camera.position.distanceTo(it.group.position);
      it.marker.visible = (it.radiusNow / dist) * k < 3;
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

  // 카드용: 행성 기준 속도(km/s)와 거리(km). vis-viva 식 v² = GM(2/r − 1/a)
  function stats(id, date) {
    const it = items.get(id);
    const m = it.data;
    const off = moonOffsetAU(m, date);
    it.offAU.set(off.x, off.y, off.z);
    const rKm = it.offAU.length() * AU_KM;
    const aKm = m.osc ? m.osc.a_km : m.jpl_mean_table.a_km;
    const v = Math.sqrt(Math.max(m.gmEff * (2 / rKm - 1 / aKm), 0));
    const hostAU = it.host.au ?? new THREE.Vector3();
    return { speedKms: v, hostDistKm: rKm, sunDistAU: tmp.copy(hostAU).add(it.offAU).length() };
  }

  // 행성의 가장 바깥 위성 궤도의 화면 반지름 (위성 없는 행성은 0). 포커스 거리 계산용
  function outerOrbit(planetId) {
    if (!hostInfo.has(planetId)) return 0;
    const host = hostOf(planetId);
    return displayDistance(host, (hostInfo.get(planetId).maxRatio * host.def.radiusKm) / AU_KM);
  }

  return {
    items, update, setSizeScale, updateMarkers, setTexture, stats, outerOrbit,
    all: () => [...items.values()],
    positionOf: (id) => items.get(id).group.position,
    markDirty() { dirty = true; },
  };
}
