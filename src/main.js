import * as THREE from 'three';
import { SUN, PLANETS, AU_KM, GM_SUN_KM3S2, EARTH_SPEED_KMS, SKY_FILE } from './data/planets.js';
import { Clock, sliderToSpeed, speedToSlider } from './sim/clock.js';
import { visViva } from './sim/ephemeris.js';
import { createWorld } from './scene/world.js';
import { createBodies } from './scene/bodies.js';
import { createOrbits } from './scene/orbits.js';
import { createTrails } from './scene/trails.js';
import { setScaleMode } from './sim/scale.js';
import { loadBodyTexture, loadPlainTexture } from './scene/textures.js';
import { createCards } from './ui/cards.js';
import { createMoons } from './scene/moons.js';
import { loadMoonData } from './sim/moons.js';
import { MOON_VISUAL, HOST_ORDER, HOST_NAME_KO } from './data/moons.js';
import { createComets } from './scene/comets.js';
import { loadCometData } from './sim/comets.js';
import { createAsteroids } from './scene/asteroids.js';
import { createBelt } from './scene/belt.js';
import { ASTEROID_VISUAL } from './data/asteroids.js';
import { createVoyager } from './scene/voyager.js';
import { loadVoyagerData } from './sim/voyager.js';

const $ = (id) => document.getElementById(id);
const stageEl = $('stage');

// ---------- 기본 구성 ----------
const clock = new Clock(new Date(), 10);
const world = createWorld(stageEl);
const bodies = createBodies(world.scene);
const orbits = createOrbits(world.scene, clock.date);
const trails = createTrails(world.scene);
bodies.update(clock.date);

// 위성 데이터(data/moons.json). 못 읽으면 위성 없이 계속 동작한다.
let moonData = { moons: [] };
try { moonData = await loadMoonData(); } catch (e) { console.warn('위성 데이터를 읽지 못했습니다:', e.message); }
const moons = createMoons(world.scene, moonData, (id) => bodies.items.get(id));

// 혜성 데이터(data/comets.json)
let cometData = { comets: [] };
try { cometData = await loadCometData(); } catch (e) { console.warn('혜성 데이터를 읽지 못했습니다:', e.message); }
const comets = createComets(world.scene, cometData);

// 소행성·왜행성 데이터(data/asteroids.json)와 장식용 소행성대
let asteroidData = { asteroids: [] };
try { asteroidData = await (await fetch('data/asteroids.json')).json(); } catch (e) { console.warn('소행성 데이터를 읽지 못했습니다:', e.message); }
const asteroids = createAsteroids(world.scene, asteroidData);
const belt = createBelt(world.scene);

// 보이저 1·2호 (data/voyager.json = JPL Horizons)
let voyagerData = { craft: [] };
try { voyagerData = await loadVoyagerData(); } catch (e) { console.warn('보이저 데이터를 읽지 못했습니다:', e.message); }
let voyagerModelStatus = '';
const voyager = createVoyager(world.scene, voyagerData, (st) => { voyagerModelStatus = st; if (st === 'fallback') console.warn('보이저 3D 모델을 못 읽어 기본 도형으로 대신합니다.'); });

// ---------- 패널: 시간 ----------
const speedEl = $('speed'), speedText = $('speedText'), pauseBtn = $('pauseBtn'), speedHint = $('speedHint');
function fmtSpeed(s) { return s < 10 ? s.toFixed(1) : Math.round(s).toLocaleString('en-US'); }
function refreshSpeedText() {
  speedText.textContent = `${fmtSpeed(clock.speed)}x`;
  speedHint.textContent = `현실 1초 = 시뮬레이션 ${fmtSpeed(clock.speed)}일 (1x = 1초에 1일)`;
}
speedEl.value = speedToSlider(clock.speed);
speedEl.addEventListener('input', () => { clock.speed = sliderToSpeed(Number(speedEl.value)); refreshSpeedText(); });
refreshSpeedText();
pauseBtn.addEventListener('click', () => {
  clock.paused = !clock.paused;
  pauseBtn.textContent = clock.paused ? '재생' : '일시정지';
});

const pad = (n) => String(n).padStart(2, '0');
const toLocalInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const dateInput = $('dateInput');
dateInput.value = toLocalInput(clock.date);
$('applyDate').addEventListener('click', () => {
  const d = new Date(dateInput.value);
  if (!Number.isNaN(d.getTime())) { clock.date = d; trails.clear(); }
});

const simDateEl = $('simDate');
let lastDateText = '';
function showDate() {
  const d = clock.date;
  const t = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  if (t !== lastDateText) { simDateEl.textContent = t; lastDateText = t; }
}

// ---------- 패널: 거리 스케일 / 크기 / 표시 옵션 ----------
const SCALE_HINT = {
  linear: '실제 거리에 비례합니다. 바깥 행성이 매우 멀리 떨어집니다.',
  log: '거리를 로그로 줄입니다(r → 8.7·ln(1+r)). 안쪽과 바깥쪽을 한 화면에서 비교할 수 있습니다.',
  compress: '거리를 제곱근으로 줄입니다(r → 5.5·√r). 안쪽 행성이 상대적으로 넓게 펼쳐집니다.',
};
function applyScaleMode(mode) {
  setScaleMode(mode);
  $('scaleHint').textContent = SCALE_HINT[mode];
  orbits.rebuild();
  comets.rebuildOrbits();
  asteroids.rebuildOrbits();
  bodies.update(clock.date);
  trails.markDirty();
}
for (const r of document.querySelectorAll('input[name=scale]')) {
  r.addEventListener('change', () => { if (r.checked) applyScaleMode(r.value); });
}
applyScaleMode('linear');

$('sizeScale').addEventListener('input', (e) => {
  const m = Number(e.target.value);
  bodies.setSizeScale(m);
  moons.setSizeScale(m);
  asteroids.setSizeScale(m);
  $('sizeText').textContent = `x${m.toFixed(1)}`;
});
const opts = { orbit: true, label: true, tail: true, path: false, moons: true, comets: true, asteroids: true, belt: true, spin: true, voyager1: false, voyager2: false };
const bindOpt = (id, key, fn) => {
  const el = $(id);
  opts[key] = el.checked;
  el.addEventListener('change', () => { opts[key] = el.checked; fn?.(); });
  fn?.();
};
bindOpt('optOrbit', 'orbit', () => { orbits.group.visible = opts.orbit; });
bindOpt('optLabel', 'label', () => { bodies.setLabelsVisible(opts.label); });
bindOpt('optSpin', 'spin', () => { bodies.setSpin(opts.spin, clock.date); });
bindOpt('optMoons', 'moons');
bindOpt('optComets', 'comets');
bindOpt('optAsteroids', 'asteroids');
bindOpt('optBelt', 'belt');
bindOpt('optVoyager1', 'voyager1');
bindOpt('optVoyager2', 'voyager2');
bindOpt('optTail', 'tail');
bindOpt('optPath', 'path');

// ---------- 패널 접기/펼치기 ----------
$('panelToggle').addEventListener('click', () => {
  const c = document.body.classList.toggle('collapsed');
  $('panelToggle').textContent = c ? '▶' : '◀';
});

// ---------- 정보 카드 ----------
let selectedId = null;
const cards = createCards($('cards'), [SUN, ...PLANETS], select, focusOn);
cards.setKind('sun', 'solid');

// 위성 카드: 행성별로 접이식 묶음
const hostGroups = new Map();
for (const hid of HOST_ORDER) {
  const list = moonData.moons.filter((m) => m.planet === hid);
  if (!list.length) continue;
  const det = document.createElement('details');
  det.className = 'host';
  det.innerHTML = `<summary>${HOST_NAME_KO[hid]}의 위성 (${list.length})</summary><div class="cards-in"></div>`;
  $('moonCards').appendChild(det);
  hostGroups.set(hid, det.querySelector('.cards-in'));
}
const moonCards = createCards((def) => hostGroups.get(moons.items.get(def.id).data.planet), moons.all().map((it) => it.def), select, focusOn);
for (const it of moons.all()) moonCards.setKind(it.def.id, 'solid');

// 혜성 카드 (체크박스로 개별 켜고 끄기, 전체 켜기/끄기)
const cometCards = createCards($('cometCards'), comets.all().map((it) => ({ ...it.def, checkable: true })), select, focusOn,
  (id, v) => comets.setEnabled(id, v));
for (const it of comets.all()) {
  const k = it.data.kind;
  cometCards.setBadge(it.def.id, k === 'interstellar' ? '성간천체' : k === 'periodic' ? '주기혜성' : '장주기', k === 'interstellar' ? 'inter' : 'comet');
}
$('cometSummary').textContent = `혜성 목록 (${comets.all().length})`;
$('cometsAll').addEventListener('click', () => { comets.setAllEnabled(true); for (const it of comets.all()) cometCards.setChecked(it.def.id, true); });
$('cometsNone').addEventListener('click', () => { comets.setAllEnabled(false); for (const it of comets.all()) cometCards.setChecked(it.def.id, false); });

// 소행성 카드
const astCards = createCards($('astCards'), asteroids.all().map((it) => ({ ...it.def, checkable: true })), select, focusOn,
  (id, v) => asteroids.setEnabled(id, v));
for (const it of asteroids.all()) astCards.setKind(it.def.id, 'solid');
$('astSummary').textContent = `소행성·왜행성 목록 (${asteroids.all().length})`;
$('astAll').addEventListener('click', () => { asteroids.setAllEnabled(true); for (const it of asteroids.all()) astCards.setChecked(it.def.id, true); });
$('astNone').addEventListener('click', () => { asteroids.setAllEnabled(false); for (const it of asteroids.all()) astCards.setChecked(it.def.id, false); });

// 탐사선 카드
const vgCards = createCards($('vgCards'), voyager.all().map((it) => it.def), select, focusOn);
for (const it of voyager.all()) vgCards.setBadge(it.def.id, '탐사선', 'comet');

const itemOf = (id) => bodies.items.get(id) ?? moons.items.get(id) ?? comets.items.get(id) ?? asteroids.items.get(id) ?? voyager.items.get(id);

function select(id) {
  selectedId = id;
  cards.setSelected(id);
  moonCards.setSelected(id);
  cometCards.setSelected(id);
  astCards.setSelected(id);
  vgCards.setSelected(id);
  for (const it of [...bodies.all(), ...moons.all(), ...comets.all(), ...asteroids.all(), ...voyager.all()]) it.label.element.classList.toggle('sel', it.def.id === id);
}

const planetById = new Map(PLANETS.map((p) => [p.id, p]));
let lastCardUpdate = 0;
function updateCards(nowMs) {
  if (nowMs - lastCardUpdate < 250) return;
  lastCardUpdate = nowMs;
  cards.setStats('sun', { speedPct: null });
  for (const def of PLANETS) {
    const rAU = bodies.items.get(def.id).au.length(); // 화면 좌표가 아닌 실제 AU
    const v = visViva(GM_SUN_KM3S2, rAU * AU_KM, def.aAU * AU_KM);
    cards.setStats(def.id, { speedPct: (v / EARTH_SPEED_KMS) * 100, speedKms: v, distAU: rAU });
  }
  for (const it of moons.all()) {
    const s = moons.stats(it.def.id, clock.date);
    moonCards.setMoonStats(it.def.id, { ...s, hostName: HOST_NAME_KO[it.data.planet] });
  }
  for (const it of comets.all()) {
    const c = it.data;
    const v = visViva(GM_SUN_KM3S2, it.rAU * AU_KM, c.aAU * AU_KM);
    cometCards.setCometStats(it.def.id, {
      speedKms: v, speedPct: (v / EARTH_SPEED_KMS) * 100, rAU: it.rAU, qAU: c.q_au, e: c.e, hyperbolic: c.e > 1.005,
      perihelion: c.perihelionDate.toISOString().slice(0, 10),
    });
  }
  for (const it of asteroids.all()) {
    const a = it.data;
    const v = visViva(GM_SUN_KM3S2, it.rAU * AU_KM, a.a_au * AU_KM);
    const note = ASTEROID_VISUAL[a.id]?.note ?? '';
    astCards.setHtml(it.def.id,
      `속도: 지구 대비 ${((v / EARTH_SPEED_KMS) * 100).toFixed(0)}% (${v.toFixed(1)} km/s)<br>태양과의 거리: ${it.rAU.toFixed(3)} AU<br>` +
      `궤도: a=${a.a_au.toFixed(2)} AU, e=${a.e.toFixed(2)}, 공전 ${a.period_yr ? a.period_yr.toFixed(a.period_yr < 10 ? 2 : 0) : '-'}년` +
      (note ? `<br><span style="color:var(--dim)">${note}</span>` : ''));
  }
  for (const it of voyager.all()) {
    const s = it.state;
    if (!s.visible) { vgCards.setHtml(it.def.id, `발사 전입니다 (발사 ${it.data.launch}).`); continue; }
    const v = s.speedKms;
    vgCards.setHtml(it.def.id,
      `속도: 지구 대비 ${((v / EARTH_SPEED_KMS) * 100).toFixed(0)}% (${v.toFixed(1)} km/s)<br>태양과의 거리: ${s.r.toFixed(2)} AU` +
      `<br>발사: ${it.data.launch}` + (s.extrapolated ? '<br><b>외삽값</b>: 자료 범위(2059년) 이후라 마지막 속도로 직선 연장한 값' : '') +
      (it.group.visible ? '' : '<br><span style="color:var(--dim)">꺼져 있음 (표시 옵션에서 켜세요)</span>'));
  }
  // 하단 상태: 선택한 천체의 지구 거리
  const st = $('status');
  const earthAU = bodies.items.get('earth').au;
  const mo = selectedId && moons.items.get(selectedId);
  const co = selectedId && comets.items.get(selectedId);
  const ao = selectedId && asteroids.items.get(selectedId);
  const vo = selectedId && voyager.items.get(selectedId);
  if (vo) {
    st.textContent = vo.state.visible ? `선택: ${vo.def.name} · 지구와의 거리 ${vo.au.distanceTo(earthAU).toFixed(2)} AU` : `선택: ${vo.def.name} (발사 전)`;
  } else if (ao) {
    st.textContent = `선택: ${ao.def.name} (${ao.data.fullname}) · 지구와의 거리 ${ao.au.distanceTo(earthAU).toFixed(3)} AU`;
  } else if (co) {
    st.textContent = `선택: ${co.def.name} (${co.data.fullname}) · 지구와의 거리 ${co.au.distanceTo(earthAU).toFixed(3)} AU`;
  } else if (mo) {
    const d = v3.copy(mo.host.au).add(mo.offAU).distanceTo(earthAU);
    st.textContent = `선택: ${mo.def.name} (${HOST_NAME_KO[mo.data.planet]}의 위성) · 지구와의 거리 ${d.toFixed(3)} AU`;
  } else if (selectedId && selectedId !== 'earth') {
    const d = selectedId === 'sun' ? earthAU.length() : bodies.items.get(selectedId).au.distanceTo(earthAU);
    const name = selectedId === 'sun' ? SUN.name : planetById.get(selectedId).name;
    st.textContent = `선택: ${name} · 지구와의 거리 ${d.toFixed(3)} AU`;
  } else {
    st.textContent = selectedId === 'earth' ? '선택: 지구' : '';
  }
}

// ---------- 클릭 / 더블클릭 ----------
const { camera, controls, renderer } = world;
const v3 = new THREE.Vector3();
function pickAt(clientX, clientY) {
  const rect = renderer.domElement.getBoundingClientRect();
  let best = null, bestD = 18; // 화면에서 18px 이내
  for (const it of [...bodies.all(), ...moons.all(), ...comets.all(), ...asteroids.all(), ...voyager.all()]) {
    if (!it.group.visible) continue; // 줌 연동으로 숨겨진 위성은 건너뜀
    v3.copy(it.group.position).project(camera);
    if (v3.z > 1) continue;
    const sx = rect.left + (v3.x * 0.5 + 0.5) * rect.width;
    const sy = rect.top + (-v3.y * 0.5 + 0.5) * rect.height;
    const d = Math.hypot(sx - clientX, sy - clientY);
    if (d < bestD) { bestD = d; best = it.def.id; }
  }
  return best;
}
let down = null;
renderer.domElement.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
renderer.domElement.addEventListener('click', (e) => {
  if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return; // 드래그는 클릭이 아님
  const id = pickAt(e.clientX, e.clientY);
  if (id) select(id);
});
renderer.domElement.addEventListener('dblclick', (e) => {
  const id = pickAt(e.clientX, e.clientY);
  if (id) { select(id); focusOn(id); }
});

// ---------- 포커스(더블클릭 시 접근 후 따라가기) ----------
let focusId = null, focusAnim = null;
const lastFocusPos = new THREE.Vector3();
function focusOn(id) {
  select(id);
  const it = itemOf(id);
  let dist = Math.max((it.radiusNow ?? it.radius) * 7, (it.isMoon || it.isAsteroid || it.isVoyager) ? 0.01 : 0.06);
  if (!it.isMoon && !it.isSun) dist = Math.max(dist, moons.outerOrbit(id) * 2.1); // 위성 궤도가 한눈에 보이게
  const dir = camera.position.clone().sub(controls.target).normalize();
  focusId = id;
  focusAnim = { t: 0, fromT: controls.target.clone(), fromP: camera.position.clone(), offset: dir.multiplyScalar(dist) };
  lastFocusPos.copy(it.group.position);
}
// 보이저 뷰: 켜 둔 보이저와 태양이 한 화면에 들어오게 카메라를 뒤로 뺀다
function voyagerView() {
  const pts = [new THREE.Vector3(0, 0, 0)];
  for (const it of voyager.all()) if (it.group.visible) pts.push(it.group.position.clone());
  if (pts.length === 1) { $('status').textContent = '보이저가 꺼져 있습니다. 표시 옵션에서 보이저 1호·2호를 켜 주세요.'; return; }
  const box = new THREE.Box3().setFromPoints(pts);
  const center = box.getCenter(new THREE.Vector3());
  const radius = Math.max(...pts.map((p) => p.distanceTo(center)), 1);
  focusId = null; focusAnim = null;
  controls.target.copy(center);
  const dir = new THREE.Vector3(0.3, 0.55, 1).normalize();
  camera.position.copy(center).addScaledVector(dir, (radius * 1.25) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
}
$('voyagerView').addEventListener('click', voyagerView);
function resetView() {
  focusId = null; focusAnim = null;
  controls.target.set(0, 0, 0);
  camera.position.set(0, 14, 26);
}
$('resetView').addEventListener('click', resetView);
window.addEventListener('keydown', (e) => { if (e.key === 'Escape') resetView(); });

function updateFocus(dt) {
  if (!focusId) return;
  const p = itemOf(focusId).group.position;
  if (focusAnim) {
    focusAnim.t = Math.min(1, focusAnim.t + dt / 0.9);
    const e = 1 - Math.pow(1 - focusAnim.t, 3);
    controls.target.lerpVectors(focusAnim.fromT, p, e);
    camera.position.lerpVectors(focusAnim.fromP, v3.copy(p).add(focusAnim.offset), e);
    if (focusAnim.t >= 1) focusAnim = null;
  } else {
    v3.copy(p).sub(lastFocusPos);
    camera.position.add(v3);
    controls.target.add(v3);
  }
  lastFocusPos.copy(p);
}

// ---------- 텍스처 불러오기 (태양·지구 먼저) ----------
const loadingEl = $('loading'), fillEl = $('loadingFill'), loadingText = $('loadingText');
async function loadAllTextures() {
  const order = ['sun', 'earth', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];
  const total = order.length + 2; // + 별 하늘 + 토성 고리
  let done = 0;
  const step = () => { done++; fillEl.style.width = `${(done / total) * 100}%`; };
  const aniso = world.maxAnisotropy;

  const jobs = order.map(async (id) => {
    const def = bodies.items.get(id).def;
    const { texture, kind } = await loadBodyTexture(def, aniso);
    bodies.setTexture(id, texture, kind);
    cards.setKind(id, kind);
    step();
  });
  jobs.push((async () => {
    const t = await loadPlainTexture(SKY_FILE, aniso);
    if (t) world.setSkyTexture(t);
    step();
  })());
  jobs.push((async () => {
    const t = await loadPlainTexture(PLANETS.find((p) => p.id === 'saturn').ring.file, aniso);
    bodies.addRing(bodies.items.get('saturn'), t); // 못 읽으면 t=null → 단색 고리
    step();
  })());
  await Promise.all(jobs);
  loadingText.textContent = '완료';
  setTimeout(() => loadingEl.classList.add('done'), 250);
}
for (const def of PLANETS) cards.setKind(def.id, 'solid');

// 위성 텍스처는 행성 다음에 조용히 불러온다 (동시 3개)
async function loadMoonTextures() {
  const ids = [...moons.items.keys()];
  let next = 0;
  const worker = async () => {
    while (next < ids.length) {
      const id = ids[next++];
      const vis = MOON_VISUAL[id] ?? {};
      const { texture, kind } = await loadBodyTexture({ id, files: vis.files, fictional: vis.fictional }, world.maxAnisotropy);
      moons.setTexture(id, texture, kind);
      moonCards.setKind(id, kind, vis.note);
    }
  };
  await Promise.all([worker(), worker(), worker()]);
}
// 소행성 텍스처 (세레스·베스타·명왕성은 실제 지도, 나머지는 가상 텍스처)
async function loadAsteroidTextures() {
  for (const it of asteroids.all()) {
    const id = it.def.id, vis = ASTEROID_VISUAL[id] ?? {};
    const { texture, kind } = await loadBodyTexture({ id, files: vis.files }, world.maxAnisotropy);
    asteroids.setTexture(id, texture, kind);
    astCards.setKind(id, kind);
  }
}
loadAllTextures().then(loadMoonTextures).then(loadAsteroidTextures);

// ---------- 반복 ----------
const trailMap = new Map();
function trailPositions() {
  for (const def of PLANETS) trailMap.set(def.id, bodies.positionOf(def.id));
  return trailMap;
}
let prev = performance.now();
function frame(now) {
  const dt = Math.min((now - prev) / 1000, 0.1);
  prev = now;
  clock.tick(dt);
  bodies.update(clock.date);
  moons.update(clock.date, camera, opts);
  comets.update(clock.date, opts);
  asteroids.update(clock.date, opts);
  voyager.update(clock.date, opts, bodies.positionOf('earth'), camera, renderer.domElement.clientHeight);
  belt.update(clock.date, opts.belt);
  trails.update(clock.ms, opts, trailPositions());
  updateFocus(dt);
  bodies.updateMarkers(camera, renderer.domElement.clientHeight);
  moons.updateMarkers(camera, renderer.domElement.clientHeight);
  asteroids.updateMarkers(camera, renderer.domElement.clientHeight);
  showDate();
  updateCards(now);
  world.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// 개발·검증용 접근점
window.solar = { clock, bodies, moons, comets, asteroids, belt, voyager, voyagerView, world, orbits, trails, select, focusOn, resetView, applyScaleMode, THREE };
