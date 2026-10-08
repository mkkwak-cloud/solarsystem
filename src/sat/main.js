// 국내 위성 추적 페이지. 지구 중심 좌표(지구 반지름 = 1 단위), 위성 계산은 satellite.js(SGP4), 달·태양은 astronomy-engine.
// 장면 좌표: 지구 관성좌표 (x, y, z) -> 화면 (x, z, -y)  (북쪽이 +Y). 지구는 가운데에 있고 자전하며, 위성·달은 관성좌표에서 움직인다.
import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createWorld } from '../scene/world.js';
import { loadPlainTexture } from '../scene/textures.js';
import { Clock } from '../sim/clock.js';
import { INFO, GROUPS, SITES, DANURI, PENDING } from './info.js';
import { loadDanuri, jdOfMs } from './danuri.js';

const $ = (id) => document.getElementById(id);
const R_EQ = 6378.137;            // 지구 적도 반지름 km (= 화면 1 단위)
const AU_KM = 149597870.7;
const MU = 398600.4418;           // 지구 중력상수 km³/s²
const MOON_R_KM = 1737.4;
const TT_MINUS_UTC_S = 69.184;    // Horizons 는 TDB 시각. UTC 와의 차 약 69초 (윤초 37 + 32.184)
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const sceneOf = (x, y, z, k = 1 / R_EQ) => new THREE.Vector3(x * k, z * k, -y * k);

// ---------- 데이터 ----------
const kr = await (await fetch('data/kr-sats.json')).json();
let danuriEph = null;
loadDanuri().then((d) => { danuriEph = d; }).catch((e) => console.warn('다누리 자료를 읽지 못했습니다:', e.message));

const OPS = { '+': ['운용 중', 'on'], '-': ['비운용', 'off'], P: ['일부 운용', 'on'], B: ['예비', 'off'], S: ['대기', 'off'], X: ['연장 운용', 'on'], D: ['소멸', 'off'] };
const pendingNames = new Set();
function infoFor(s) {
  if (INFO[s.norad]) return INFO[s.norad];
  const p = PENDING.find((q) => q.match?.test(s.name));
  if (p) { pendingNames.add(p.key); return { ko: p.ko, owner: p.owner, use: p.use, group: p.group, rocket: '누리호 (나로우주센터)' }; }
  return {};
}

const sats = kr.sats.filter((s) => s.tle1).map((s) => {
  const info = infoFor(s);
  const satrec = satellite.twoline2satrec(s.tle1, s.tle2);
  const periodMin = (2 * Math.PI) / satrec.no;
  const a = Math.cbrt(MU / ((satrec.no / 60) ** 2));
  const isGeo = periodMin > 1300;
  const group = info.group ?? (isGeo ? 'geo' : 'other');
  const epochJd = satrec.jdsatepoch + (satrec.jdsatepochF ?? 0);
  return {
    id: 's' + s.norad, norad: s.norad, name: s.name, intl: s.intl, launch: s.launch, site: s.site, ops: s.ops, info,
    ko: info.ko ?? s.name, shortKo: (info.ko ?? s.name).split(' (')[0], group, satrec, isGeo, periodMin, epochJd,
    perigee: a * (1 - satrec.ecco) - R_EQ, apogee: a * (1 + satrec.ecco) - R_EQ, incl: satrec.inclo * 180 / Math.PI,
    pos: new THREE.Vector3(), eci: null, vel: null, valid: false, occluded: false, visible: true, label: null, orbitLine: null,
  };
});
const byId = new Map(sats.map((s) => [s.id, s]));
const ORDER = ['obs', 'geo', 'sci', 'cube', 'mil', 'other'];
const groupVisible = Object.fromEntries(Object.keys(GROUPS).map((g) => [g, true]));

// ---------- 무대 ----------
const stageEl = $('stage');
const world = createWorld(stageEl);
const { scene, camera, controls, renderer } = world;
controls.minDistance = 0.0006;
controls.maxDistance = 2500;
camera.position.set(0, 1.3, 3.6);
scene.add(new THREE.AmbientLight(0xffffff, 0.22));
const sunLight = new THREE.DirectionalLight(0xffffff, 3.2);
scene.add(sunLight);
const maxAniso = world.maxAnisotropy;

// 지구
const earthMat = new THREE.MeshStandardMaterial({ color: 0x3f7fd0, roughness: 0.9, metalness: 0 });
const sunDirView = { value: new THREE.Vector3(1, 0, 0) };
earthMat.onBeforeCompile = (sh) => {   // 밤 쪽에만 도시 불빛이 보이게
  sh.uniforms.sunDirView = sunDirView;
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 sunDirView;')
    .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance *= smoothstep(0.05, -0.25, dot(normalize(vNormal), sunDirView));');
};
const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 48), earthMat);
scene.add(earth);
const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false, roughness: 1 });
const clouds = new THREE.Mesh(new THREE.SphereGeometry(1.006, 96, 48), cloudMat);
scene.add(clouds);
const atmo = new THREE.Mesh(new THREE.SphereGeometry(1.03, 64, 32), new THREE.ShaderMaterial({
  side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  vertexShader: 'varying vec3 vN; void main(){ vN = normalize(normalMatrix*normal); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: 'varying vec3 vN; void main(){ float i = pow(max(0.0, 0.66 - dot(vN, vec3(0.0,0.0,1.0))), 3.0); gl_FragColor = vec4(0.35,0.62,1.0,1.0)*i*1.6; }',
}));
scene.add(atmo);

// 서울·나로우주센터 (지구에 붙어 같이 돈다)
const siteGroup = new THREE.Group();
earth.add(siteGroup);
function addSite(name, latDeg, lonDeg) {
  const la = latDeg * Math.PI / 180, lo = lonDeg * Math.PI / 180;   // 구체 국소좌표: 경도 0°=+X, 북극=+Y, 동쪽=-Z
  const p = new THREE.Vector3(Math.cos(la) * Math.cos(lo), Math.sin(la), -Math.cos(la) * Math.sin(lo)).multiplyScalar(1.002);
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.006, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffd27a }));
  dot.position.copy(p);
  const div = document.createElement('div'); div.className = 'label site'; div.textContent = name;
  const lab = new CSS2DObject(div); lab.position.copy(p);
  siteGroup.add(dot, lab);
}
addSite('서울', 37.5665, 126.978);
addSite('나로우주센터', 34.4319, 127.535);

// 달
const moonGroup = new THREE.Group();
scene.add(moonGroup);
const moonMesh = new THREE.Mesh(new THREE.SphereGeometry(MOON_R_KM / R_EQ, 64, 32), new THREE.MeshStandardMaterial({ color: 0xbbbbbb, roughness: 1 }));
moonGroup.add(moonMesh);
{ const d = document.createElement('div'); d.className = 'label moonlabel'; d.textContent = '달'; const l = new CSS2DObject(d); l.position.set(0, MOON_R_KM / R_EQ, 0); moonGroup.add(l); }
// 다누리 (달 중심 좌표를 지구 기준 화면 좌표로 바꿔 달 곁에 둔다)
const danuri = { id: 'danuri', ko: DANURI.ko, shortKo: '다누리', group: 'lunar', pos: new THREE.Vector3(), valid: false, occluded: false, label: null, relKm: null, speedKms: 0, isDanuri: true };
const danuriTrail = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }));
danuriTrail.frustumCulled = false;
moonGroup.add(danuriTrail);

// 위성 점
function dotTexture(ring) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  g.beginPath(); g.arc(32, 32, ring ? 26 : 28, 0, Math.PI * 2);
  if (ring) { g.lineWidth = 6; g.strokeStyle = '#fff'; g.stroke(); } else { g.fillStyle = '#fff'; g.fill(); }
  return new THREE.CanvasTexture(c);
}
const satGeo = new THREE.BufferGeometry();
const satPos = new Float32Array(sats.length * 3), satCol = new Float32Array(sats.length * 3);
sats.forEach((s, i) => { const c = new THREE.Color(GROUPS[s.group].color); satCol.set([c.r, c.g, c.b], i * 3); });
satGeo.setAttribute('position', new THREE.BufferAttribute(satPos, 3));
satGeo.setAttribute('color', new THREE.BufferAttribute(satCol, 3));
const satPoints = new THREE.Points(satGeo, new THREE.PointsMaterial({ size: 8, sizeAttenuation: false, vertexColors: true, map: dotTexture(false), alphaTest: 0.5, transparent: true }));
satPoints.frustumCulled = false;
scene.add(satPoints);
function singlePoint(size, color, ring) {
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3));
  const p = new THREE.Points(g, new THREE.PointsMaterial({ size, sizeAttenuation: false, color, map: dotTexture(ring), alphaTest: 0.4, transparent: true, depthTest: !ring }));
  p.frustumCulled = false; scene.add(p); return p;
}
const danuriPoint = singlePoint(9, 0xffffff, false);
const selRing = singlePoint(26, 0xffe066, true);
selRing.visible = false;

// 위성 이름표
for (const s of sats) {
  const d = document.createElement('div'); d.className = 'label sat'; d.textContent = s.shortKo;
  s.label = new CSS2DObject(d); scene.add(s.label);
}
{ const d = document.createElement('div'); d.className = 'label sat'; d.textContent = danuri.shortKo; danuri.label = new CSS2DObject(d); scene.add(danuri.label); }

// ---------- 시계 ----------
const clock = new Clock(new Date(), 1 / 86400);   // 실시간
let speedMult = 1;
function setSpeed(m) {
  speedMult = m; clock.speed = m / 86400;
  $('speedHint').textContent = m === 1 ? "1x = 현실과 같은 속도" : `현실 1초 = 시뮬레이션 ${m.toLocaleString('en-US')}초`;
}
for (const r of document.querySelectorAll('input[name=spd]')) r.addEventListener('change', () => { if (r.checked) setSpeed(Number(r.value)); });
setSpeed(10);
const quickPause = $('quickPause'), pauseBtn = $('pauseBtn');
function togglePause() { clock.paused = !clock.paused; pauseBtn.textContent = clock.paused ? '재생' : '일시정지'; quickPause.textContent = clock.paused ? '▶' : '⏸'; }
pauseBtn.addEventListener('click', togglePause); quickPause.addEventListener('click', togglePause);
const toLocalInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
$('dateInput').value = toLocalInput(clock.date);
$('applyDate').addEventListener('click', () => { const d = new Date($('dateInput').value); if (!Number.isNaN(d.getTime())) { clock.date = d; invalidateOrbits(); } });
$('nowBtn').addEventListener('click', () => { clock.date = new Date(); invalidateOrbits(); });

// ---------- 계산: 지구 자전·태양·달·위성·다누리 ----------
let rotEQD = null, curTime = null, gmst = 0;
const moonPos = new THREE.Vector3();
function eqjToSceneKm(xKm, yKm, zKm) {          // J2000 적도좌표(km) -> 날짜 적도좌표(관성) -> 화면
  const v = Astronomy.RotateVector(rotEQD, new Astronomy.Vector(xKm, yKm, zKm, curTime));
  return sceneOf(v.x, v.y, v.z);
}
function updateEnvironment(date) {
  curTime = Astronomy.MakeTime(date);
  rotEQD = Astronomy.Rotation_EQJ_EQD(curTime);
  gmst = satellite.gstime(date);
  earth.rotation.y = gmst;
  clouds.rotation.y = gmst + (clock.ms / 86400000) * 0.01;
  const sun = Astronomy.RotateVector(rotEQD, Astronomy.GeoVector('Sun', curTime, true));
  const sd = sceneOf(sun.x, sun.y, sun.z, 1).normalize();
  sunLight.position.copy(sd).multiplyScalar(400);
  sunDirView.value.copy(sd).transformDirection(camera.matrixWorldInverse);
  const m = Astronomy.RotateVector(rotEQD, Astronomy.GeoMoon(curTime));
  moonPos.copy(sceneOf(m.x, m.y, m.z, AU_KM / R_EQ));
  moonGroup.position.copy(moonPos);
  // 달의 앞면(경도 0°)은 항상 지구를 본다
  const x = moonPos.clone().negate().normalize(), up = new THREE.Vector3(0, 1, 0);
  const y = up.clone().sub(x.clone().multiplyScalar(up.dot(x))).normalize(), z = new THREE.Vector3().crossVectors(x, y);
  moonMesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}
function occludedByEarth(p) {                    // 카메라에서 p 가 지구에 가려지는가
  const c = camera.position, d = p.clone().sub(c), t = -c.dot(d) / d.dot(d);
  if (t <= 0 || t >= 1) return false;
  return c.clone().addScaledVector(d, t).lengthSq() < 0.998;
}
function updateSats(date) {
  sats.forEach((s, i) => {
    const pv = satellite.propagate(s.satrec, date);
    if (pv && pv.position) {
      s.eci = pv.position; s.vel = pv.velocity; s.valid = true;
      s.pos.set(pv.position.x / R_EQ, pv.position.z / R_EQ, -pv.position.y / R_EQ);
    } else s.valid = false;
    const show = s.valid && groupVisible[s.group];
    s.visible = show;
    if (show) satPos.set([s.pos.x, s.pos.y, s.pos.z], i * 3); else satPos.set([1e5, 1e5, 1e5], i * 3);
    s.label.position.copy(s.pos);
  });
  satGeo.attributes.position.needsUpdate = true;
}
const DAN = { cur: { r: [0, 0, 0], v: [0, 0, 0] } };
function danuriJd(ms) { return jdOfMs(ms) + TT_MINUS_UTC_S / 86400; }
function updateDanuri() {
  const eph = danuriEph && danuriEph.at(danuriJd(clock.ms), DAN.cur);
  danuri.valid = !!eph && groupVisible.lunar;
  if (!eph) { danuriPoint.position.set(1e5, 1e5, 1e5); return; }
  const rel = eqjToSceneKm(eph.r[0], eph.r[1], eph.r[2]);
  danuri.relKm = Math.hypot(...eph.r);
  danuri.speedKms = Math.hypot(...eph.v);
  danuri.pos.copy(moonPos).add(rel);
  danuriPoint.position.copy(danuri.pos);
  danuri.label.position.copy(danuri.pos);
}
// 다누리 궤도선: 지금 기준 앞뒤 1시간을 달 중심 좌표로 그린다 (선택했거나 달 보기일 때만 갱신)
let lastTrailMs = -1e18;
function updateDanuriTrail(force) {
  if (!danuriEph || (!force && Math.abs(clock.ms - lastTrailMs) < 20000 * Math.max(1, speedMult / 60))) return;
  lastTrailMs = clock.ms;
  const pts = [], N = 120;
  for (let i = 0; i <= N; i++) {
    const e = danuriEph.at(danuriJd(clock.ms + (i / N - 0.5) * 7200000));
    if (!e) continue;
    pts.push(eqjToSceneKm(e.r[0], e.r[1], e.r[2]));
  }
  danuriTrail.geometry.setFromPoints(pts);
}

let selected = null;   // 지금 고른 위성(없으면 null)
// ---------- 궤도선 ----------
const orbitMat = new THREE.LineBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.9 });
const selOrbit = new THREE.Line(new THREE.BufferGeometry(), orbitMat);
selOrbit.frustumCulled = false; selOrbit.visible = false; scene.add(selOrbit);
const allOrbits = new THREE.Group(); scene.add(allOrbits); allOrbits.visible = false;
let orbitsBuiltMs = -1e18;
function orbitPoints(s, ms, n) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const pv = satellite.propagate(s.satrec, new Date(ms + (i / n) * s.periodMin * 60000));
    if (pv && pv.position) pts.push(new THREE.Vector3(pv.position.x / R_EQ, pv.position.z / R_EQ, -pv.position.y / R_EQ));
  }
  return pts;
}
function rebuildSelectedOrbit() {
  if (!selected || selected.isDanuri) { selOrbit.visible = false; return; }
  selOrbit.geometry.setFromPoints(orbitPoints(selected, clock.ms, selected.isGeo ? 90 : 200));
  selOrbit.visible = opts.orbit;
}
function rebuildAllOrbits() {
  for (const l of [...allOrbits.children]) { allOrbits.remove(l); l.geometry.dispose(); }
  if (!opts.allOrbits) return;
  for (const s of sats) {
    if (s.isGeo || !s.valid) continue;
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(orbitPoints(s, clock.ms, 120)),
      new THREE.LineBasicMaterial({ color: new THREE.Color(GROUPS[s.group].color), transparent: true, opacity: 0.35 }));
    l.frustumCulled = false; l.userData.group = s.group; allOrbits.add(l);
  }
}
function invalidateOrbits() { orbitsBuiltMs = -1e18; lastTrailMs = -1e18; }

// ---------- 옵션 ----------
const opts = { orbit: true, allOrbits: false, labels: false, clouds: true, sites: true, moon: true };
const bindOpt = (id, key, fn) => { const el = $(id); opts[key] = el.checked; el.addEventListener('change', () => { opts[key] = el.checked; fn?.(); }); fn?.(); };
bindOpt('optOrbit', 'orbit', () => { selOrbit.visible = opts.orbit && !!selected && !selected.isDanuri; });
bindOpt('optAllOrbits', 'allOrbits', () => { allOrbits.visible = opts.allOrbits; rebuildAllOrbits(); orbitsBuiltMs = clock.ms; });
bindOpt('optLabels', 'labels');
bindOpt('optClouds', 'clouds', () => { clouds.visible = opts.clouds; });
bindOpt('optSites', 'sites', () => { siteGroup.visible = opts.sites; });
bindOpt('optMoon', 'moon', () => { moonGroup.visible = opts.moon; });

// ---------- 패널 접기 (폰) ----------
const narrow = window.matchMedia('(max-width: 800px)');
const isMobile = () => narrow.matches;
function setPanelCollapsed(c) { document.body.classList.toggle('collapsed', c); $('panelToggle').textContent = isMobile() ? (c ? '☰' : '✕') : (c ? '▶' : '◀'); }
$('panelToggle').addEventListener('click', () => setPanelCollapsed(!document.body.classList.contains('collapsed')));
setPanelCollapsed(isMobile());
narrow.addEventListener('change', () => setPanelCollapsed(isMobile()));

// ---------- 카메라: 따라가기 ----------
const origin = new THREE.Object3D();
let followObj = null;           // 따라갈 위치(Vector3 를 가진 것)
let approach = null;            // { dir, dist } 가까이 가는 중
const tmpV = new THREE.Vector3();
function followTarget() { return followObj === 'moon' ? moonPos : followObj === 'origin' ? origin.position : followObj?.pos ?? null; }
function flyTo(obj, dist, dir) {
  followObj = obj;
  const t = followTarget() ?? origin.position;
  const d = dir ?? t.clone().normalize();
  if (d.lengthSq() < 1e-6) d.set(0, 0.3, 1);
  approach = { dir: d.clone().normalize().add(new THREE.Vector3(0, 0.35, 0)).normalize(), dist };
  updateFollowButton();
}
function stepCamera() {
  const t = followTarget();
  if (!t) return;
  const goal = t, next = approach ? controls.target.clone().lerp(goal, 0.12) : goal.clone();
  camera.position.add(tmpV.copy(next).sub(controls.target));
  controls.target.copy(next);
  if (approach) {
    const off = camera.position.clone().sub(controls.target);
    const want = approach.dir.clone().multiplyScalar(approach.dist);
    off.lerp(want, 0.1);
    camera.position.copy(controls.target).add(off);
    if (off.distanceTo(want) < want.length() * 0.02 && next.distanceTo(goal) < approach.dist * 0.02) approach = null;
  }
}
controls.addEventListener('start', () => { if (approach) approach = null; });
function viewEarth() { selectNone(true); flyTo('origin', 4.2, new THREE.Vector3(0, 0.2, 1)); }
function viewMoon() { flyTo('moon', 1.1, moonPos.clone().negate().normalize().multiplyScalar(-1)); selectItem(danuri, { fly: false }); lastTrailMs = -1e18; }
$('viewEarth').addEventListener('click', () => { viewEarth(); closePanelOnMobile(); });
$('viewMoon').addEventListener('click', () => { viewMoon(); closePanelOnMobile(); });
function closePanelOnMobile() { if (isMobile()) setPanelCollapsed(true); }

// ---------- 선택·정보 카드 ----------
const infoCard = $('infoCard');
function orbitClass(s) { return s.isGeo ? '정지궤도 부근' : s.apogee < 2000 ? '저궤도' : s.apogee < 30000 ? '중궤도·타원궤도' : '고타원궤도'; }
const fmtKm = (v) => Math.round(v).toLocaleString('en-US');
function launchText(s) {
  const site = SITES[s.site] ?? s.site ?? '';
  return [s.launch, s.info.rocket, site].filter(Boolean).join(' · ');
}
function cardHtml(s) {
  if (s.isDanuri) {
    return `<button type="button" class="closex" data-act="close" title="닫기">✕</button><h3>${esc(DANURI.ko)}</h3><div class="en">${esc(DANURI.en)}</div>
      <table>
        <tr><td>소유·운영</td><td>${esc(DANURI.owner)}</td></tr>
        <tr><td>용도</td><td>${esc(DANURI.use)}</td></tr>
        <tr><td>발사</td><td>${esc(DANURI.launch)} · ${esc(DANURI.site)}</td></tr>
        <tr><td>식별번호</td><td>${DANURI.intl} / NORAD ${DANURI.norad}</td></tr>
        <tr><td>상태</td><td><span class="badge on">운용 중</span></td></tr>
        <tr><td>궤도</td><td>달 둘레를 도는 궤도 (약 2시간에 한 바퀴)</td></tr>
        <tbody class="live"><tr><td>달 중심에서</td><td id="lv1">-</td></tr><tr><td>달 표면 위</td><td id="lv2">-</td></tr><tr><td>달에 대한 속도</td><td id="lv3">-</td></tr></tbody>
      </table>
      <div class="note">${esc(DANURI.extra)}<br>위치: NASA JPL Horizons(번호 -155) 자료. 지구 위성용 궤도 정보(TLE)는 쓰지 않습니다. 자료가 있는 기간: 2026-09-01 ~ 2027-05-06.</div>
      <div class="modelnote">${esc(modelNote(s))}</div>
      <div class="btns"><button type="button" data-act="fly">달 곁으로 가기</button></div>`;
  }
  const ops = OPS[s.ops] ?? ['확인 중', 'off'];
  const g = GROUPS[s.group];
  return `<button type="button" class="closex" data-act="close" title="닫기">✕</button><h3>${esc(s.ko)}</h3><div class="en">${esc(s.name)}</div>
    <table>
      <tr><td>분류</td><td><span class="gdot" style="background:${g.color}"></span>${esc(g.name)}</td></tr>
      <tr><td>소유·운영</td><td>${esc(s.info.owner ?? '확인 중')}</td></tr>
      <tr><td>용도</td><td>${esc(s.info.use ?? '확인 중 (CelesTrak 에서는 이름과 발사일만 알 수 있음)')}</td></tr>
      <tr><td>발사</td><td>${esc(launchText(s))}</td></tr>
      <tr><td>식별번호</td><td>${esc(s.intl)} / NORAD ${s.norad}</td></tr>
      <tr><td>상태</td><td><span class="badge ${ops[1]}">${ops[0]}</span> <span class="hint" style="display:inline">(CelesTrak 표기)</span></td></tr>
      <tr><td>궤도</td><td>${orbitClass(s)}<br>고도 ${fmtKm(s.perigee)} ~ ${fmtKm(s.apogee)} km · 경사 ${s.incl.toFixed(1)}° · 주기 ${s.periodMin.toFixed(1)}분</td></tr>
      <tbody class="live"><tr><td>지금 위치</td><td id="lv1">-</td></tr><tr><td>지금 고도</td><td id="lv2">-</td></tr><tr><td>지금 속도</td><td id="lv3">-</td></tr></tbody>
      <tr><td>궤도 정보</td><td id="tleAge">-</td></tr>
    </table>
    <div class="modelnote">${esc(modelNote(s))}</div>
    <div class="btns"><button type="button" data-act="fly">따라가기</button><button type="button" data-act="stop">따라가기 해제</button></div>`;
}
function showCard(s) {
  infoCard.innerHTML = cardHtml(s);
  infoCard.hidden = false;
  infoCard.scrollTop = 0;
  infoCard.querySelector('[data-act=close]')?.addEventListener('click', () => selectNone(true));
  infoCard.querySelector('[data-act=fly]')?.addEventListener('click', () => { flyToItem(s); closePanelOnMobile(); });
  infoCard.querySelector('[data-act=stop]')?.addEventListener('click', () => { followObj = null; approach = null; updateFollowButton(); });
  updateFollowButton();
  updateLive(true);
}
function updateFollowButton() {
  const b = infoCard.querySelector('[data-act=stop]'); if (b) b.disabled = !followObj;
}
function selectItem(s, { fly = false } = {}) {
  selected = s;
  for (const el of document.querySelectorAll('.satitem.sel')) el.classList.remove('sel');
  document.querySelector(`.satitem[data-id="${s.id}"]`)?.classList.add('sel');
  for (const x of sats) x.label.element.classList.toggle('sel', x === s);
  danuri.label.element.classList.toggle('sel', s === danuri);
  showCard(s);
  setSelectedModel(s);
  rebuildSelectedOrbit();
  if (s.isDanuri) { updateDanuriTrail(true); }
  if (fly) flyToItem(s);
}
function selectNone(keepCamera) {
  selected = null; selOrbit.visible = false; selRing.visible = false;
  infoCard.hidden = true; infoCard.innerHTML = ''; setSelectedModel(null);
  for (const el of document.querySelectorAll('.satitem.sel')) el.classList.remove('sel');
  for (const x of sats) x.label.element.classList.remove('sel');
  if (!keepCamera) { followObj = null; approach = null; }
}
function flyToItem(s) {
  if (s.isDanuri) { flyTo('moon', 0.9, moonPos.clone().normalize()); lastTrailMs = -1e18; return; }
  flyTo(s, s.isGeo ? 1.2 : 0.5, s.pos.clone());
}
let lastLiveMs = 0;
function updateLive(force) {
  const now = performance.now();
  if (!force && now - lastLiveMs < 250) return;
  lastLiveMs = now;
  const s = selected; if (!s) return;
  const set = (id, t) => { const e = $(id); if (e && e.textContent !== t) e.textContent = t; };
  if (s.isDanuri) {
    if (!danuri.relKm) { set('lv1', '자료 범위 밖'); set('lv2', '-'); set('lv3', '-'); return; }
    set('lv1', `${fmtKm(danuri.relKm)} km`);
    set('lv2', `${fmtKm(danuri.relKm - MOON_R_KM)} km`);
    set('lv3', `${danuri.speedKms.toFixed(2)} km/s`);
    return;
  }
  if (!s.valid || !s.eci) { set('lv1', '계산할 수 없음 (궤도 정보가 너무 오래됨)'); return; }
  const geo = satellite.eciToGeodetic(s.eci, gmst);
  const lat = satellite.degreesLat(geo.latitude), lon = satellite.degreesLong(geo.longitude);
  set('lv1', `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? '북위' : '남위'}, ${Math.abs(lon).toFixed(2)}° ${lon >= 0 ? '동경' : '서경'}`);
  set('lv2', `${fmtKm(geo.height)} km`);
  set('lv3', `${Math.hypot(s.vel.x, s.vel.y, s.vel.z).toFixed(2)} km/s`);
  const age = jdOfMs(clock.ms) - s.epochJd;
  set('tleAge', `${new Date((s.epochJd - 2440587.5) * 86400000).toISOString().slice(0, 10)} 기준 (${age >= 0 ? `${age.toFixed(1)}일 전` : `${(-age).toFixed(1)}일 뒤`})${Math.abs(age) > 14 ? ' — 기준일에서 멀어 위치 오차가 큽니다' : ''}`);
}

// ---------- 목록 ----------
const groupsEl = $('groups');
const listItems = [];
function itemHtml(s) {
  const ops = OPS[s.ops] ?? ['', 'off'];
  const alt = s.isGeo ? '정지궤도 (고도 약 35,786 km)' : `고도 약 ${fmtKm((s.perigee + s.apogee) / 2)} km`;
  return `<div class="name"><span>${esc(s.ko)}</span><span class="badge ${ops[1]}">${ops[0]}</span></div><div class="stats">${esc(s.launch)} 발사 · ${alt}</div>`;
}
function buildList() {
  groupsEl.innerHTML = '';
  const entries = [...ORDER, 'lunar'];
  for (const gk of entries) {
    const items = gk === 'lunar' ? [danuri] : sats.filter((s) => s.group === gk);
    if (!items.length) continue;
    const det = document.createElement('details'); det.className = 'host'; det.dataset.group = gk;
    if (gk === 'obs' || gk === 'lunar') det.open = true;
    det.innerHTML = `<summary><span class="gdot" style="background:${GROUPS[gk].color}"></span>${GROUPS[gk].name} (${items.length})<label title="이 분류를 화면에 표시"><input type="checkbox" checked data-g="${gk}"> 표시</label></summary><div class="cards-in"></div>`;
    const box = det.querySelector('.cards-in');
    for (const s of items) {
      const el = document.createElement('div'); el.className = 'card satitem'; el.dataset.id = s.id;
      el.innerHTML = s.isDanuri
        ? `<div class="name"><span>${esc(DANURI.ko)}</span><span class="badge on">운용 중</span></div><div class="stats">${DANURI.launch} 발사 · 달 궤도</div>`
        : itemHtml(s);
      el._text = (s.isDanuri ? 'danuri 다누리 kplo 53365 ' : `${s.ko} ${s.name} ${s.norad} ${s.info.owner ?? ''}`).toLowerCase();
      el.addEventListener('click', () => { selectItem(s); flyToItem(s); closePanelOnMobile(); });
      box.appendChild(el); listItems.push(el);
    }
    det.querySelector('input[data-g]').addEventListener('click', (e) => e.stopPropagation());
    det.querySelector('input[data-g]').addEventListener('change', (e) => {
      groupVisible[gk] = e.target.checked;
      for (const l of allOrbits.children) if (l.userData.group === gk) l.visible = e.target.checked;
    });
    groupsEl.appendChild(det);
  }
  $('countText').textContent = `(지구 위성 ${sats.length}개 + 다누리)`;
}
buildList();
$('search').addEventListener('input', (e) => {
  const q = e.target.value.trim().toLowerCase();
  for (const el of listItems) el.style.display = !q || el._text.includes(q) ? '' : 'none';
  if (q) for (const d of groupsEl.querySelectorAll('details')) d.open = true;
});

// 누리호 5차 대기 목록
{
  const box = $('pending');
  for (const p of PENDING) {
    if (pendingNames.has(p.key)) continue;
    const el = document.createElement('div'); el.className = 'card'; el.style.cursor = 'default'; el.style.marginBottom = '6px';
    el.innerHTML = `<div class="name"><span>${esc(p.ko)}</span><span class="badge ${p.failed ? 'fail' : 'off'}">${p.failed ? '투입 실패' : '데이터 대기 중'}</span></div>
      <div class="stats">${esc(p.owner)}<br>${esc(p.use)}<br><b>${esc(p.status)}</b></div>`;
    box.appendChild(el);
  }
}

// ---------- 클릭으로 위성 고르기 ----------
const stageRect = () => renderer.domElement.getBoundingClientRect();
function pickAt(cx, cy, touch) {
  const r = stageRect(), th = touch ? 24 : 14;
  let best = null, bd = th;
  const test = (s) => {
    if (!s.valid || (s.visible === false)) return;
    const v = s.pos.clone().project(camera);
    if (v.z > 1 || v.z < -1) return;
    const px = (v.x * 0.5 + 0.5) * r.width + r.left, py = (-v.y * 0.5 + 0.5) * r.height + r.top;
    const d = Math.hypot(px - cx, py - cy);
    if (d < bd && !occludedByEarth(s.pos)) { bd = d; best = s; }
  };
  for (const s of sats) test(s);
  if (danuri.valid) test(danuri);
  return best;
}
let down = null;
renderer.domElement.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
  const hit = pickAt(e.clientX, e.clientY, e.pointerType === 'touch');
  if (hit) selectItem(hit);
});
renderer.domElement.addEventListener('dblclick', (e) => {
  const hit = pickAt(e.clientX, e.clientY, false);
  if (hit) { selectItem(hit); flyToItem(hit); }
});

// ---------- 최신 궤도 정보 받아오기 (CelesTrak 은 브라우저 직접 호출을 허용) ----------
$('dataInfo').textContent = `저장본: ${kr.fetched.slice(0, 10)}에 CelesTrak 에서 받은 ${sats.length}개. 위성 궤도 정보는 며칠~몇 주마다 새로 올라옵니다.`;
$('refreshBtn').addEventListener('click', async () => {
  const btn = $('refreshBtn'), st = $('refreshStatus');
  btn.disabled = true; let done = 0, ok = 0, idx = 0;
  const worker = async () => {
    while (idx < sats.length) {
      const s = sats[idx++];
      try {
        const t = (await (await fetch(`https://celestrak.org/NORAD/elements/gp.php?CATNR=${s.norad}&FORMAT=tle`)).text()).trim().split(/\r?\n/);
        if (t.length >= 3 && t[1].startsWith('1 ')) {
          s.satrec = satellite.twoline2satrec(t[1].trim(), t[2].trim());
          s.epochJd = s.satrec.jdsatepoch + (s.satrec.jdsatepochF ?? 0); ok++;
        }
      } catch { /* 한 개 실패해도 계속 */ }
      st.textContent = `받는 중… ${++done}/${sats.length}`;
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  st.textContent = ok ? `${ok}개 갱신 완료 (${new Date().toLocaleString('ko-KR')}). 새로고침하면 저장본으로 돌아갑니다.` : '받지 못했습니다. 인터넷 연결이나 CelesTrak 상태를 확인하세요. (저장본을 계속 씁니다)';
  btn.disabled = false; invalidateOrbits(); rebuildSelectedOrbit(); updateLive(true);
});

// ---------- 텍스처 ----------
(async () => {
  const fill = $('loadingFill'); let n = 0; const total = 5;
  const tick = () => { fill.style.width = `${(++n / total) * 100}%`; };
  const [day, night, cloud, moon, sky] = await Promise.all([
    loadPlainTexture('2k_earth_daymap.jpg', maxAniso), loadPlainTexture('2k_earth_nightmap.jpg', maxAniso), loadPlainTexture('2k_earth_clouds.jpg', maxAniso),
    loadPlainTexture('2k_moon.jpg', maxAniso), loadPlainTexture('2k_stars_milky_way.jpg', maxAniso),
  ].map((p) => p.then((t) => { tick(); return t; })));
  if (day) { earthMat.map = day; earthMat.color.set(0xffffff); }
  if (night) { earthMat.emissiveMap = night; earthMat.emissive.set(0xffffff); earthMat.emissiveIntensity = 0.9; }
  earthMat.needsUpdate = true;
  if (cloud) { cloudMat.alphaMap = cloud; cloudMat.needsUpdate = true; } else clouds.visible = false;
  if (moon) { moonMesh.material.map = moon; moonMesh.material.color.set(0xffffff); moonMesh.material.needsUpdate = true; }
  if (sky) world.setSkyTexture(sky);
  $('loading').classList.add('done');
})();

// ---------- 위성 3D 모형 (선택한 위성 하나만, 보기 쉽게 크게) ----------
// 국내 위성의 공개 3D 모델은 없어서 NASA 공개 모델 중 같은 종류를 대표 모형으로 쓴다. 그 밖에는 본체+날개 도형. (출처: models/CREDITS.md)
const MODEL_FILES = { cube: 'cubesat2u.glb', geo: 'goes.glb', obs: 'landsat8.glb', danuri: 'lro.glb' };
const MODEL_LABEL = { cube: 'NASA 일반 큐브위성(2U) 모형', geo: 'NASA 정지궤도 위성(GOES) 모형', obs: 'NASA 지구관측위성(Landsat 8) 모형', danuri: 'NASA 달 궤도선(LRO) 모형' };
function modelKey(s) { return s.isDanuri ? 'danuri' : MODEL_FILES[s.group] ? s.group : null; }
function modelNote(s) {
  const k = modelKey(s);
  return k ? `3D 모형: ${MODEL_LABEL[k]} — 같은 종류의 대표 모형이며 실제 모습이 아닙니다. 크기도 보기 쉽게 키웠습니다.` : '3D 모형: 간단한 도형(본체+날개) — 실제 모습이 아닙니다. 크기도 보기 쉽게 키웠습니다.';
}
const modelHolder = new THREE.Group(); modelHolder.visible = false; scene.add(modelHolder);
const modelCache = new Map();
function normalize(obj) {                       // 가장 긴 변이 1이 되도록 크기를 맞추고 가운데로
  const box = new THREE.Box3().setFromObject(obj), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  const g = new THREE.Group(); obj.position.sub(c); g.add(obj); g.scale.setScalar(1 / Math.max(size.x, size.y, size.z, 1e-6));
  const w = new THREE.Group(); w.add(g); return w;
}
function genericModel(color) {
  const g = new THREE.Group(), mat = new THREE.MeshStandardMaterial({ color: 0xcfd6e0, metalness: 0.5, roughness: 0.5 });
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.5), mat));
  const pm = new THREE.MeshStandardMaterial({ color: 0x1d3f8f, metalness: 0.3, roughness: 0.4, side: THREE.DoubleSide });
  for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.02, 0.36), pm); p.position.set(sx * 0.5, 0, 0); g.add(p); }
  const tag = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.05, 0.52), new THREE.MeshStandardMaterial({ color: new THREE.Color(color) })); tag.position.y = 0.2; g.add(tag);
  return normalize(g);
}
function getModel(key, color) {                 // Promise<Object3D 복제본>
  if (!key) return Promise.resolve(genericModel(color));
  if (!modelCache.has(key)) modelCache.set(key, new Promise((res) => new GLTFLoader().load('models/sat/' + MODEL_FILES[key], (gl) => res(normalize(gl.scene)), undefined, () => res(null))));
  return modelCache.get(key).then((m) => (m ? m.clone(true) : genericModel(color)));
}
let modelFor = null;
function setSelectedModel(s) {
  modelFor = s; modelHolder.visible = false;
  for (const c of [...modelHolder.children]) modelHolder.remove(c);
  if (!s) return;
  getModel(modelKey(s), GROUPS[s.group]?.color ?? '#ffffff').then((m) => { if (modelFor === s) { modelHolder.add(m); modelHolder.visible = true; } });
}
const Y_AXIS = new THREE.Vector3(0, 1, 0);
function updateModel() {
  const s = modelFor; if (!s) return;
  const ok = s.isDanuri ? danuri.valid && opts.moon : s.visible;
  if (!ok) { modelHolder.visible = false; return; }
  const dist = camera.position.distanceTo(s.pos);
  modelHolder.position.copy(s.pos);
  modelHolder.scale.setScalar(s.isDanuri ? Math.min(dist * 0.1, 0.03) : Math.min(dist * 0.12, s.isGeo ? 0.15 : 0.06));
  const radial = s.isDanuri ? s.pos.clone().sub(moonPos) : s.pos.clone();
  if (radial.lengthSq() > 0) modelHolder.quaternion.setFromUnitVectors(Y_AXIS, radial.normalize());
}

// ---------- 반복 ----------
const dateEl = $('simDate'), statusEl = $('status');
let lastDateText = '', last = performance.now(), statusAt = 0;
const medianEpoch = [...sats.map((s) => s.epochJd)].sort((a, b) => a - b)[Math.floor(sats.length / 2)];
function updateStatus() {
  const msgs = [];
  const off = jdOfMs(clock.ms) - medianEpoch;
  if (Math.abs(off) > 14) msgs.push(`시뮬레이션 날짜가 궤도 정보 기준일에서 약 ${Math.round(Math.abs(off))}일 떨어져 있어 위성 위치 오차가 큽니다.`);
  if (danuriEph && (jdOfMs(clock.ms) < danuriEph.firstJd - 0.1 || jdOfMs(clock.ms) > danuriEph.lastJd)) msgs.push('다누리 자료 범위(2026-09-01 ~ 2027-05-06) 밖이라 다누리는 표시하지 않습니다.');
  const t = msgs.join(' ');
  if (statusEl.textContent !== t) statusEl.textContent = t;
}
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.1); last = now;
  clock.tick(dt);
  const date = clock.date;
  updateEnvironment(date);
  updateSats(date);
  updateDanuri();
  if (selected?.isDanuri) updateDanuriTrail(false);
  stepCamera();

  // 궤도선은 어느 정도 시간이 지나면 새로 계산 (궤도면 변화·기준 시각 이동)
  if (Math.abs(clock.ms - orbitsBuiltMs) > 3 * 3600000) { orbitsBuiltMs = clock.ms; rebuildSelectedOrbit(); if (opts.allOrbits) rebuildAllOrbits(); }

  // 이름표: 선택·정지궤도는 항상, 나머지는 옵션. 지구 뒤에 가려진 것은 숨김
  const farFromEarth = camera.position.length() > 25;   // 달 쪽을 보고 있으면 지구 주변 이름표는 숨김
  siteGroup.visible = opts.sites && !farFromEarth;
  for (const s of sats) {
    const on = s.visible && !occludedByEarth(s.pos) && (opts.labels || s === selected || s.isGeo) && (!farFromEarth || s === selected);
    if (s.label.visible !== on) s.label.visible = on;
  }
  const dOn = danuri.valid && opts.moon && (opts.labels || selected === danuri || (camera.position.distanceTo(moonPos) < 40));
  if (danuri.label.visible !== dOn) danuri.label.visible = dOn;
  danuriPoint.visible = danuri.valid && opts.moon;
  danuriTrail.visible = danuri.valid && opts.moon && (selected === danuri || camera.position.distanceTo(moonPos) < 6);

  // 선택 표시 고리
  const sp = selected && (selected.isDanuri ? danuri.valid : selected.visible) ? selected.pos : null;
  selRing.visible = !!sp;
  if (sp) selRing.position.copy(sp);

  updateModel();
  updateLive(false);
  const d = date, t = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  if (t !== lastDateText) { dateEl.textContent = t; lastDateText = t; }
  if (now - statusAt > 1000) { statusAt = now; updateStatus(); }
  world.render();
  requestAnimationFrame(frame);
}
updateEnvironment(clock.date);
invalidateOrbits();   // 첫 프레임에서 위성 위치가 계산된 뒤 궤도선을 새로 그리게 함
requestAnimationFrame(frame);
window.__sat = { sats, danuri, clock, camera, controls, selectItem, flyToItem, viewMoon, viewEarth };   // 시험용
