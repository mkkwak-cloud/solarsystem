// 지구 시점: 지표의 관측 지점(기본 서울)에 서서 하늘을 올려다본다. 위성은 실제 계산 위치 그대로라 하늘을 가로질러 지나가고,
// 지평선 아래 위성은 땅(어두운 구)에 가려진다. 카메라는 지구 자전을 따라 같이 돈다.
// 조작: 드래그 = 둘러보기(방위·고도), 휠 = 시야 확대/축소. 방위는 북쪽 0°에서 시계 방향(동 90°, 남 180°, 서 270°).
//
// 왜 위성이 잘 안 움직여 보이나: 서울 하늘에 늘 떠 있는 것은 정지궤도 위성(천리안·무궁화)이라 땅에서 보면 원래 멈춰 있다.
// 움직이는 저궤도 위성(아리랑 등)은 한 번 지나가는 데 10분 안팎이고, 동시에 떠 있는 것은 평균 1~2개뿐이다.
// 그래서 (1) 하늘 경로선으로 지나갈 길을 보여 주고 (2) 앞으로 24시간 "통과 예보"를 계산해 그 시각으로 바로 갈 수 있게 한다.
import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

export const PLACES = [
  { id: 'seoul', name: '서울', lat: 37.5665, lon: 126.978 },
  { id: 'daejeon', name: '대전 (한국천문연구원)', lat: 36.3724, lon: 127.3604 },
  { id: 'busan', name: '부산', lat: 35.1796, lon: 129.0756 },
  { id: 'jeju', name: '제주', lat: 33.4996, lon: 126.5312 },
  { id: 'naro', name: '나로우주센터', lat: 34.4319, lon: 127.535 },
];
const H = 0.0002;            // 관측 높이 (지구 반지름 단위, 약 1.3 km)
const R_EQ = 6378.137;
const D2R = Math.PI / 180;
const TRACK_MIN = 12;        // 하늘 경로선: 지금 앞뒤 몇 분
const PASS_HOURS = 24;       // 통과 예보 범위
const PASS_MIN_ALT = 10;     // 이 고도 이상 올라오는 통과만
const DIRS = ['북', '북북동', '북동', '동북동', '동', '동남동', '남동', '남남동', '남', '남남서', '남서', '서남서', '서', '서북서', '북서', '북북서'];
export const dirName = (azDeg) => DIRS[Math.round(((azDeg % 360) + 360) % 360 / 22.5) % 16];
const pad = (n) => String(n).padStart(2, '0');
const hm = (ms) => { const t = new Date(ms); return `${pad(t.getHours())}:${pad(t.getMinutes())}`; };
const md = (ms) => { const t = new Date(ms); return `${t.getMonth() + 1}/${t.getDate()}`; };

// 지구 구체의 국소 좌표: 경도 0° = +X, 북극 = +Y, 동쪽 = -Z (main.js 의 addSite 와 같은 규칙)
const localOf = (lat, lon) => new THREE.Vector3(Math.cos(lat * D2R) * Math.cos(lon * D2R), Math.sin(lat * D2R), -Math.cos(lat * D2R) * Math.sin(lon * D2R));
const isLeo = (s) => !s.isGeo && s.periodMin < 225;   // 하루 6바퀴 이상 (예보·경로선 대상)

// d: { scene, camera, controls, renderer, earth, stageEl, sats, satPoints, hide: [Object3D], hideLabels: [Object3D],
//      getGmst, getSunDir, getMs, getSelected, colorOf(s), onPick(s), jumpTo(ms, s) }
export function createGroundView(d) {
  const { camera, controls, renderer, earth } = d;
  const st = { on: false, place: PLACES[0], az: 180, alt: 35, fov: 70 };
  let saved = null, origUpdate = null;
  const U = new THREE.Vector3(), N = new THREE.Vector3(), E = new THREE.Vector3(), site = new THREE.Vector3(), look = new THREE.Vector3();
  const observer = () => ({ latitude: st.place.lat * D2R, longitude: st.place.lon * D2R, height: H * R_EQ });

  // 땅: 지구 지도 대신 어두운 구 (지평선 아래를 가림) + 지평선 선
  const ground = new THREE.Mesh(new THREE.SphereGeometry(1 + H * 0.4, 128, 64), new THREE.MeshBasicMaterial({ color: 0x05080c }));
  ground.visible = false; d.scene.add(ground);
  const HN = 180;
  const horizon = new THREE.LineLoop(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(HN * 3), 3)),
    new THREE.LineBasicMaterial({ color: 0x5a6b8a, transparent: true, opacity: 0.8 }));
  horizon.frustumCulled = false; horizon.visible = false; d.scene.add(horizon);

  // 동서남북·천정 표시
  const marks = [['북', 0, 0], ['동', 90, 0], ['남', 180, 0], ['서', 270, 0], ['북동', 45, 0], ['남동', 135, 0], ['남서', 225, 0], ['북서', 315, 0], ['천정', 0, 90]].map(([t, az, alt]) => {
    const el = Object.assign(document.createElement('div'), { className: 'label compass' + (t.length === 1 ? ' main' : ''), textContent: t });
    const o = new CSS2DObject(el); o.visible = false; d.scene.add(o); return { o, az, alt };
  });
  // 정지궤도 위성 묶음 이름표 (10여 개가 한곳에 겹치므로 하나로)
  const geoEl = Object.assign(document.createElement('div'), { className: 'label geogroup' });
  const geoLabel = new CSS2DObject(geoEl); geoLabel.visible = false; d.scene.add(geoLabel);

  // 하늘 경로선 (저궤도 위성이 하늘에서 지나갈 길. 지나온 쪽은 흐리게)
  const tracks = new THREE.Group(); tracks.visible = false; d.scene.add(tracks);

  // 낮 하늘(파란 막)과 목록 상자
  const day = Object.assign(document.createElement('div'), { id: 'groundSky' });
  d.stageEl.insertBefore(day, d.stageEl.querySelector('#labels') ?? null);
  const panel = Object.assign(document.createElement('div'), { id: 'skyList', hidden: true });
  panel.innerHTML = '<div id="skyNow"></div><div id="skyPass"></div>';
  d.stageEl.appendChild(panel);
  const nowEl = panel.querySelector('#skyNow'), passEl = panel.querySelector('#skyPass');

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
  function anglesOfEci(eci, gmst) {
    const la = satellite.ecfToLookAngles(observer(), satellite.eciToEcf(eci, gmst));
    return { az: la.azimuth / D2R, alt: la.elevation / D2R, range: la.rangeSat };
  }
  function lookAngles(s) { return s.valid && s.eci ? anglesOfEci(s.eci, d.getGmst()) : null; }
  function sunlit(p, sd) {                                           // 지구 원통 그림자 밖인가 (p: 지구 반지름 단위)
    const t = p.dot(sd);
    return t > 0 || p.lengthSq() - t * t > 1;
  }
  const sunAltNow = () => Math.asin(Math.max(-1, Math.min(1, d.getSunDir().dot(U)))) / D2R;

  // ---------- 지금 하늘의 위성 ----------
  let lastList = 0;
  function updateList(now) {
    if (now - lastList < 500) return;
    lastList = now;
    const sd = d.getSunDir(), sunAlt = sunAltNow(), dark = sunAlt < -6;
    const rows = [], geo = [];
    for (const s of d.sats) {
      if (!s.visible) continue;
      const a = lookAngles(s);
      if (!a || a.alt <= 0) continue;
      if (s.isGeo) geo.push({ s, ...a }); else rows.push({ s, ...a, lit: sunlit(s.pos, sd) });
    }
    rows.sort((x, y) => y.alt - x.alt);
    const sky = sunAlt > 0 ? `낮 (해 고도 ${sunAlt.toFixed(0)}°)` : dark ? `밤 (해 고도 ${sunAlt.toFixed(0)}°)` : `박명 (해 고도 ${sunAlt.toFixed(0)}°)`;
    const geoTxt = geo.length ? `정지궤도 ${geo.length}개 (천리안·무궁화 등)는 ${dirName(geo.reduce((a, g) => a + g.az, 0) / geo.length)}쪽 고도 약 ${Math.round(geo.reduce((a, g) => a + g.alt, 0) / geo.length)}°에 늘 떠 있어 움직이지 않습니다.` : '';
    nowEl.innerHTML = `<div class="hd"><b>${st.place.name} 하늘 · 움직이는 위성 ${rows.length}개 <span class="fold">${panel.classList.contains('folded') ? '▸ 펴기' : '▾ 접기'}</span></b><span>${sky}</span></div>` +
      (rows.length ? rows.slice(0, 8).map((r) => `<div class="row" data-id="${r.s.id}"><span class="nm">${r.s.shortKo ?? r.s.ko}</span>` +
        `<span>${dirName(r.az)} ${r.az.toFixed(0)}° · 고도 ${r.alt.toFixed(0)}°</span>` +
        `<span class="tag ${r.lit && dark ? 'eye' : ''}">${r.lit ? (dark ? '맨눈 가능' : '햇빛') : '그림자'}</span></div>`).join('')
        : '<div class="row dim">지금은 지나가는 저궤도 위성이 없습니다. 아래 통과 예보에서 시각을 골라 보세요.</div>') +
      (geoTxt ? `<div class="row dim">${geoTxt}</div>` : '');
    day.style.opacity = String(Math.max(0, Math.min(1, (sunAlt + 6) / 12)) * 0.82);
    // 정지궤도 묶음 이름표: 가운데 위치
    if (geo.length) {
      const c = new THREE.Vector3(); for (const g of geo) c.add(g.s.pos); c.divideScalar(geo.length);
      geoLabel.position.copy(c); geoEl.textContent = `정지궤도 위성 ${geo.length}개 (멈춰 보임)`; geoLabel.visible = true;
    } else geoLabel.visible = false;
  }

  // ---------- 하늘 경로선 ----------
  // 미래·과거 시각의 위성 위치를 "지금의 지구 회전"으로 옮겨 그린다(관측자도 지구와 같이 돌기 때문)
  let lastTrackMs = -1e18, lastTrackReal = 0;
  function sceneAtNow(eci, gmstThen, gmstNow) {
    const p = satellite.ecfToEci(satellite.eciToEcf(eci, gmstThen), gmstNow);
    return new THREE.Vector3(p.x / R_EQ, p.z / R_EQ, -p.y / R_EQ);
  }
  function updateTracks(now) {
    const ms = d.getMs();
    if (now - lastTrackReal < 400 && Math.abs(ms - lastTrackMs) < 15000) return;
    lastTrackReal = now; lastTrackMs = ms;
    for (const c of tracks.children) c.geometry.dispose();
    tracks.clear();
    const gNow = d.getGmst(), sel = d.getSelected();
    for (const s of d.sats) {
      if (!s.visible || !isLeo(s)) continue;
      const a = lookAngles(s);
      if (!a || (a.alt < -15 && s !== sel)) continue;                // 지금 떠 있거나 곧 뜰 것만
      const past = [], fut = [];
      for (let k = -TRACK_MIN * 2; k <= TRACK_MIN * 2; k++) {        // 30초 간격
        const t = new Date(ms + k * 30000), pv = satellite.propagate(s.satrec, t);
        if (!pv || !pv.position) continue;
        const p = sceneAtNow(pv.position, satellite.gstime(t), gNow);
        if (k <= 0) past.push(p); if (k >= 0) fut.push(p);
      }
      const col = new THREE.Color(d.colorOf(s) ?? '#9fd0ff');
      if (past.length > 1) tracks.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(past), new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.25 })));
      if (fut.length > 1) tracks.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(fut), new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: s === sel ? 1 : 0.75 })));
    }
  }

  // ---------- 통과 예보 (앞으로 24시간, 1분 간격으로 고도를 계산해 지평선 위로 올라오는 구간을 찾음) ----------
  let passes = [], passBase = null, passJob = 0;
  function sunAltAt(ms) {
    const t = Astronomy.MakeTime(new Date(ms)), ob = new Astronomy.Observer(st.place.lat, st.place.lon, 0);
    const eq = Astronomy.Equator('Sun', t, ob, true, true);
    return Astronomy.Horizon(t, ob, eq.ra, eq.dec, 'normal').altitude;
  }
  function litAt(eci, ms) {                                         // 그 시각 위성이 햇빛을 받는가 (J2000 태양 방향, 근사)
    const v = Astronomy.GeoVector('Sun', Astronomy.MakeTime(new Date(ms)), true), n = Math.hypot(v.x, v.y, v.z);
    const sd = new THREE.Vector3(v.x / n, v.z / n, -v.y / n), p = new THREE.Vector3(eci.x / R_EQ, eci.z / R_EQ, -eci.y / R_EQ);
    return sunlit(p, sd);
  }
  function computePasses() {
    const job = ++passJob, t0 = d.getMs(), list = d.sats.filter(isLeo), found = [];
    passBase = { ms: t0, place: st.place };
    passEl.innerHTML = `<div class="hd2">다음 통과 예보 · 계산 중… (0/${list.length})</div>`;
    let i = 0;
    const step = () => {
      if (job !== passJob) return;                                   // 위치·시각이 바뀌어 새 계산이 시작됨
      const end = Math.min(list.length, i + 4);
      for (; i < end; i++) {
        const s = list[i]; let cur = null;
        for (let k = 0; k <= PASS_HOURS * 60; k++) {
          const ms = t0 + k * 60000, pv = satellite.propagate(s.satrec, new Date(ms));
          if (!pv || !pv.position) { cur = null; continue; }
          const a = anglesOfEci(pv.position, satellite.gstime(new Date(ms)));
          if (a.alt > 0) {
            if (!cur) cur = { s, start: ms, azStart: a.az, max: a.alt, maxMs: ms, azMax: a.az, eciMax: pv.position };
            if (a.alt > cur.max) Object.assign(cur, { max: a.alt, maxMs: ms, azMax: a.az, eciMax: pv.position });
            cur.end = ms; cur.azEnd = a.az;
          } else if (cur) { if (cur.max >= PASS_MIN_ALT && cur.start > t0) found.push(cur); cur = null; }
        }
      }
      passEl.querySelector('.hd2').textContent = `다음 통과 예보 · 계산 중… (${i}/${list.length})`;
      if (i < list.length) { setTimeout(step, 0); return; }
      found.sort((a, b) => a.start - b.start);
      for (const p of found) p.eye = sunAltAt(p.maxMs) < -6 && litAt(p.eciMax, p.maxMs);
      passes = found; renderPasses();
    };
    setTimeout(step, 0);
  }
  function renderPasses() {
    const ms = d.getMs(), up = passes.filter((p) => p.end > ms).slice(0, 6);
    passEl.innerHTML = `<div class="hd2">다음 통과 예보 (${PASS_HOURS}시간, 최고 고도 ${PASS_MIN_ALT}° 이상, 1분 간격 어림)</div>` +
      (up.length ? up.map((p) => `<div class="prow"><div class="pl"><span class="pt">${md(p.start)} ${hm(p.start)}</span> <span class="nm">${p.s.shortKo}</span>` +
        (p.eye ? ' <span class="tag eye">맨눈 가능</span>' : p.start <= ms ? ' <span class="tag">지나는 중</span>' : '') +
        `<div class="pd">최고 ${p.max.toFixed(0)}° · ${dirName(p.azStart)}→${dirName(p.azEnd)} · ${Math.max(1, Math.round((p.end - p.start) / 60000))}분</div></div>` +
        `<button type="button" data-pass="${passes.indexOf(p)}">이 시간으로</button></div>`).join('')
        : '<div class="row dim">앞으로 24시간 안에 이 위치 위로 높이 지나가는 저궤도 위성이 없습니다.</div>') +
      '<div class="row dim">"이 시간으로" = 통과 1분 전으로 이동하고 60배속으로 그 위성 쪽 하늘을 봅니다.</div>';
  }
  panel.addEventListener('click', (e) => {
    if (e.target.closest('#skyNow .hd')) { panel.classList.toggle('folded'); lastList = 0; return; }   // 제목을 누르면 접기/펴기
    const pb = e.target.closest('button[data-pass]');
    if (pb) {
      const p = passes[Number(pb.dataset.pass)]; if (!p) return;
      d.jumpTo(p.start - 60000, p.s);
      st.az = p.azMax; st.alt = Math.min(80, Math.max(15, p.max * 0.8));   // 최고점 쪽 하늘을 넓게
      lastList = 0; lastTrackReal = 0; return;
    }
    const id = e.target.closest('.row[data-id]')?.dataset.id;
    const s = id && d.sats.find((x) => String(x.id) === id);
    if (s) { d.onPick(s); aimAt(s); lastTrackReal = 0; }
  });

  function aimAt(s) {
    const a = lookAngles(s);
    if (!a || a.alt < 0) return false;
    st.az = a.az; st.alt = Math.min(85, a.alt); return true;
  }

  // ---------- 둘러보기 조작 (지구 시점일 때만) ----------
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

  // ---------- 켜기 / 끄기 / 매 프레임 ----------
  let hidden = [];
  function enter(place) {
    const moved = place && place !== st.place;
    if (place) st.place = place;
    if (st.on) { lastList = 0; lastTrackReal = 0; if (moved) computePasses(); return; }
    saved = { pos: camera.position.clone(), target: controls.target.clone(), up: camera.up.clone(), near: camera.near, fov: camera.fov, dot: d.satPoints.material.size };
    origUpdate = controls.update; controls.update = () => false; controls.enabled = false;   // OrbitControls 가 카메라를 끌고 가지 않게
    camera.near = 0.00001;
    hidden = d.hide.map((o) => [o, o.visible]);                     // 끌 때 원래대로 되돌리려고 기억
    d.satPoints.material.size = 12;
    st.on = true; for (const m of marks) m.o.visible = true; ground.visible = horizon.visible = tracks.visible = true;
    panel.hidden = false; day.style.display = 'block'; lastList = 0; lastTrackReal = 0;
    if (!passBase || passBase.place !== st.place || Math.abs(d.getMs() - passBase.ms) > 6 * 3600000) computePasses(); else renderPasses();
  }
  function exit() {
    if (!st.on) return;
    st.on = false; passJob++;
    for (const m of marks) m.o.visible = false;
    ground.visible = horizon.visible = tracks.visible = geoLabel.visible = false;
    panel.hidden = true; day.style.display = 'none';
    for (const [o, v] of hidden) o.visible = v;
    d.satPoints.material.size = saved.dot;
    controls.update = origUpdate; controls.enabled = true;
    camera.up.copy(saved.up); camera.near = saved.near; camera.fov = saved.fov; camera.position.copy(saved.pos); controls.target.copy(saved.target);
    camera.updateProjectionMatrix();
  }
  // 매 프레임 (위성 위치·이름표 계산 뒤, 그리기 전)
  let lastPassRender = 0;
  function frame(now) {
    if (!st.on) return;
    for (const o of d.hide) o.visible = false;
    for (const o of d.hideLabels) o.traverse((c) => { c.visible = false; });   // 이름표(CSS2D)는 부모를 숨겨도 보이므로 자식까지
    const sel = d.getSelected();
    for (const s of d.sats) if (s.isGeo && s !== sel) s.label.visible = false;   // 정지궤도는 묶음 이름표 하나로
    updateFrame();
    camera.position.copy(site);
    camera.up.copy(U);
    camera.lookAt(look.copy(site).add(dirOf(st.az, st.alt, look.clone())));
    camera.fov = st.fov; camera.updateProjectionMatrix();
    for (const m of marks) m.o.position.copy(site).add(dirOf(m.az, m.alt, look).multiplyScalar(0.5));
    const hp = horizon.geometry.attributes.position.array;
    for (let i = 0; i < HN; i++) { dirOf(i * 360 / HN, 0, look).multiplyScalar(0.5).add(site); hp[i * 3] = look.x; hp[i * 3 + 1] = look.y; hp[i * 3 + 2] = look.z; }
    horizon.geometry.attributes.position.needsUpdate = true;
    updateList(now);
    updateTracks(now);
    if (passBase && Math.abs(d.getMs() - passBase.ms) > 6 * 3600000) computePasses();   // 시각을 크게 옮기면 예보를 다시 계산
    else if (now - lastPassRender > 2000 && passes.length) { lastPassRender = now; renderPasses(); }
  }
  return { st, enter, exit, frame, aimAt, lookAngles, get on() { return st.on; } };
}
