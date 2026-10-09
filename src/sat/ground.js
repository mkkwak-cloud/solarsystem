// 지구 시점: 지표의 관측 지점(기본 서울)에 서서 하늘을 올려다본다. 위성은 실제 계산 위치 그대로라 하늘을 가로질러 지나가고,
// 지평선 아래 위성은 지구에 가려진다. 카메라는 지구 자전을 따라 같이 돈다.
// 조작: 드래그 = 둘러보기(방위·고도), 휠 = 시야 확대/축소. 방위는 북쪽 0°에서 시계 방향(동 90°, 남 180°, 서 270°).
import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

export const PLACES = [
  { id: 'seoul', name: '서울', lat: 37.5665, lon: 126.978 },
  { id: 'daejeon', name: '대전 (한국천문연구원)', lat: 36.3724, lon: 127.3604 },
  { id: 'busan', name: '부산', lat: 35.1796, lon: 129.0756 },
  { id: 'jeju', name: '제주', lat: 33.4996, lon: 126.5312 },
  { id: 'naro', name: '나로우주센터', lat: 34.4319, lon: 127.535 },
];
const H = 0.0002;            // 관측 높이 (지구 반지름 단위, 약 1.3 km): 지표 텍스처에 묻히지 않게
const D2R = Math.PI / 180;
const DIRS = ['북', '북북동', '북동', '동북동', '동', '동남동', '남동', '남남동', '남', '남남서', '남서', '서남서', '서', '서북서', '북서', '북북서'];
export const dirName = (azDeg) => DIRS[Math.round(((azDeg % 360) + 360) % 360 / 22.5) % 16];

// 지구 구체의 국소 좌표: 경도 0° = +X, 북극 = +Y, 동쪽 = -Z (main.js 의 addSite 와 같은 규칙)
const localOf = (lat, lon) => new THREE.Vector3(Math.cos(lat * D2R) * Math.cos(lon * D2R), Math.sin(lat * D2R), -Math.cos(lat * D2R) * Math.sin(lon * D2R));

// d: { scene, camera, controls, renderer, earth, hide: [Object3D...], stageEl, sats, getGmst, getSunDir, onPick }
export function createGroundView(d) {
  const { camera, controls, renderer, earth } = d;
  const st = { on: false, place: PLACES[0], az: 180, alt: 35, fov: 70 };
  let saved = null, origUpdate = null;
  const U = new THREE.Vector3(), N = new THREE.Vector3(), E = new THREE.Vector3(), site = new THREE.Vector3(), look = new THREE.Vector3();

  // 동서남북·천정 표시 (지평선 위에 떠 있는 이름표)
  const compass = new THREE.Group(); d.scene.add(compass);
  const marks = [['북', 0, 0], ['동', 90, 0], ['남', 180, 0], ['서', 270, 0], ['북동', 45, 0], ['남동', 135, 0], ['남서', 225, 0], ['북서', 315, 0], ['천정', 0, 90]].map(([t, az, alt]) => {
    const el = Object.assign(document.createElement('div'), { className: 'label compass' + (t.length === 1 ? ' main' : ''), textContent: t });
    const o = new CSS2DObject(el); o.visible = false; compass.add(o); return { o, az, alt };
  });

  // 낮 하늘: 해 고도에 따라 파랗게 덮는 막 (캔버스와 이름표 사이)
  const day = Object.assign(document.createElement('div'), { id: 'groundSky' });
  const labelsEl = d.stageEl.querySelector('#labels');
  d.stageEl.insertBefore(day, labelsEl ?? null);
  const panel = Object.assign(document.createElement('div'), { id: 'skyList', hidden: true });
  d.stageEl.appendChild(panel);

  function dirOf(az, alt, out) {
    const ca = Math.cos(alt * D2R);
    return out.copy(N).multiplyScalar(ca * Math.cos(az * D2R)).addScaledVector(E, ca * Math.sin(az * D2R)).addScaledVector(U, Math.sin(alt * D2R));
  }
  function updateFrame() {
    earth.updateMatrixWorld(true);
    site.copy(localOf(st.place.lat, st.place.lon)).multiplyScalar(1 + H).applyMatrix4(earth.matrixWorld);
    U.copy(site).normalize();
    N.set(0, 1, 0).addScaledVector(U, -U.y).normalize();          // 북극 방향을 지평면에 내린 것
    E.crossVectors(N, U);                                            // 동쪽 (북 × 위)
  }
  // 위성의 방위·고도 (satellite.js, 지구 고정 좌표 기준 — 화면과 독립적인 계산)
  function lookAngles(s) {
    if (!s.valid || !s.eci) return null;
    const ecf = satellite.eciToEcf(s.eci, d.getGmst());
    const la = satellite.ecfToLookAngles({ latitude: st.place.lat * D2R, longitude: st.place.lon * D2R, height: H * 6378.137 }, ecf);
    return { az: la.azimuth / D2R, alt: la.elevation / D2R, range: la.rangeSat };
  }
  function sunlit(p, sd) {                                           // 지구 원통 그림자 밖인가 (위성이 햇빛을 받는가)
    const t = p.dot(sd);
    return t > 0 || p.lengthSq() - t * t > 1;
  }

  let lastList = 0;
  function updateList(now) {
    if (now - lastList < 500) return;
    lastList = now;
    const sd = d.getSunDir(), sunAlt = Math.asin(Math.max(-1, Math.min(1, sd.dot(U)))) / D2R, dark = sunAlt < -6;
    const rows = [];
    for (const s of d.sats) {
      if (!s.visible) continue;
      const a = lookAngles(s);
      if (a && a.alt > 0) rows.push({ s, ...a, lit: sunlit(s.pos, sd) });
    }
    rows.sort((x, y) => y.alt - x.alt);
    const sky = sunAlt > 0 ? `낮 (해 고도 ${sunAlt.toFixed(0)}°)` : dark ? `밤 (해 고도 ${sunAlt.toFixed(0)}°)` : `박명 (해 고도 ${sunAlt.toFixed(0)}°)`;
    panel.innerHTML = `<div class="hd"><b>${st.place.name} 하늘의 국내 위성 ${rows.length}개 <span class="fold">${panel.classList.contains('folded') ? '▸ 펴기' : '▾ 접기'}</span></b><span>${sky}</span></div>` +
      (rows.length ? '' : '<div class="row dim">지금 지평선 위에 있는 위성이 없습니다. 시간을 빠르게 해 보세요.</div>') +
      rows.slice(0, 12).map((r) => `<div class="row" data-id="${r.s.id}"><span class="nm">${r.s.shortKo ?? r.s.ko}</span>` +
        `<span>${dirName(r.az)} ${r.az.toFixed(0)}° · 고도 ${r.alt.toFixed(0)}°</span>` +
        `<span class="tag ${r.lit && dark ? 'eye' : ''}">${r.lit ? (dark ? '맨눈 가능' : '햇빛') : '그림자'}</span></div>`).join('') +
      (rows.length > 12 ? `<div class="row dim">… 외 ${rows.length - 12}개 (고도 순)</div>` : '') +
      '<div class="row dim">"맨눈 가능" = 하늘이 어둡고 위성이 햇빛을 받음 (밝기는 위성마다 다름)</div>';
    day.style.opacity = String(Math.max(0, Math.min(1, (sunAlt + 6) / 12)) * 0.82);
  }
  panel.addEventListener('click', (e) => {
    if (e.target.closest('.hd')) { panel.classList.toggle('folded'); return; }   // 제목을 누르면 목록 접기/펴기
    const id = e.target.closest('.row[data-id]')?.dataset.id;
    const s = id && d.sats.find((x) => String(x.id) === id);
    if (s) { d.onPick(s); aimAt(s); }
  });

  function aimAt(s) {
    const a = lookAngles(s);
    if (!a || a.alt < 0) return false;
    st.az = a.az; st.alt = Math.min(85, a.alt); return true;
  }

  // 둘러보기 조작 (지구 시점일 때만)
  let drag = null;
  const el = renderer.domElement;
  el.addEventListener('pointerdown', (e) => { if (st.on) drag = { x: e.clientX, y: e.clientY }; });
  window.addEventListener('pointerup', () => { drag = null; });
  el.addEventListener('pointermove', (e) => {
    if (!st.on || !drag) return;
    const k = st.fov / el.clientHeight;                              // 화면 1픽셀 = 몇 도
    st.az = (st.az - (e.clientX - drag.x) * k + 360) % 360;
    st.alt = Math.max(-10, Math.min(89, st.alt + (e.clientY - drag.y) * k));
    drag = { x: e.clientX, y: e.clientY };
  });
  el.addEventListener('wheel', (e) => {
    if (!st.on) return;
    e.preventDefault(); e.stopImmediatePropagation();
    st.fov = Math.max(15, Math.min(100, st.fov * Math.exp(e.deltaY * 0.001)));
  }, { passive: false, capture: true });

  function enter(place) {
    if (place) st.place = place;
    if (st.on) { lastList = 0; return; }
    saved = { pos: camera.position.clone(), target: controls.target.clone(), up: camera.up.clone(), near: camera.near, fov: camera.fov };
    origUpdate = controls.update; controls.update = () => false; controls.enabled = false;   // OrbitControls 가 카메라를 끌고 가지 않게
    camera.near = 0.00001;
    st.on = true; for (const m of marks) m.o.visible = true; panel.hidden = false; day.style.display = 'block'; lastList = 0;
  }
  function exit() {
    if (!st.on) return;
    st.on = false; for (const m of marks) m.o.visible = false; panel.hidden = true; day.style.display = 'none';
    for (const o of d.hide) o.traverse((c) => { c.visible = true; });   // 원래 보이던 상태로 (구름 등은 main.js 가 옵션대로 다시 맞춤)
    controls.update = origUpdate; controls.enabled = true;
    camera.up.copy(saved.up); camera.near = saved.near; camera.fov = saved.fov; camera.position.copy(saved.pos); controls.target.copy(saved.target);
    camera.updateProjectionMatrix();
  }
  // 매 프레임 (위성 위치 계산 뒤, 그리기 전)
  function frame(now) {
    if (!st.on) return;
    for (const o of d.hide) o.traverse((c) => { c.visible = false; });   // 이름표(CSS2D)는 부모를 숨겨도 보이므로 자식까지
    updateFrame();
    camera.position.copy(site);
    camera.up.copy(U);
    camera.lookAt(look.copy(site).add(dirOf(st.az, st.alt, look.clone())));
    if (camera.fov !== st.fov) { camera.fov = st.fov; }
    camera.updateProjectionMatrix();
    for (const m of marks) m.o.position.copy(site).add(dirOf(m.az, m.alt, look).multiplyScalar(0.5));
    updateList(now);
  }
  return { st, enter, exit, frame, aimAt, lookAngles, get on() { return st.on; } };
}
