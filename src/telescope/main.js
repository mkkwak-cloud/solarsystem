// ===== 심우주 망원경 3D 시뮬레이터 본체 (telescope.html) =====
// 계산은 ./calc.js, three.js 는 페이지의 import map(vendor/three) 에서 읽는다. 태양계·위성 페이지와 같은 라이브러리를 쓴다.
import { EACS, GAP, G_CORE, LAUNCHERS, MU_E, PHASING_REF, PHYS, PRESETS, R_E, SHIELD_DEF, SHIELD_TYPES, SIGMA, SQ3, TARGETS, annulusMean, apertureOf, buildStats, contrastStability, coronagraphFromPupil, detectPower, detectThreshold, detectionBudget, envelopeRadius, fft1, fft2, fitCheck, hexLayout, hexVerts, iwaHorizonPc, leoOrbit, limitingDistance, makeOptics, makePupil, normCdf, normInv, planetFluxRatio, psfFromPupil, radialMean, requiredSNR, ringsForAperture, sag, secondaryRadius, segsAcross, starPhotonFlux, sunshieldTemps, targetStar, toleranceFor, traceRay } from './calc.js';
const $ = id => document.getElementById(id);
let THREE;
try {
  THREE = await import('three');
} catch (e) { $('err').style.display = 'flex'; throw e; }

const V3 = THREE.Vector3, UP = new V3(0, 1, 0);

// ---------- 간단한 궤도 카메라 (OrbitControls 대체: 드래그=회전, 휠/핀치=확대, 우클릭/두 손가락=이동) ----------
class Orbit {
  constructor(cam, el) {
    this.cam = cam; this.el = el; this.target = new THREE.Vector3(); this.autoRotate = false; this.autoRotateSpeed = 0.8;
    this.maxDistance = 1e5; this.enableDamping = true; this.look = false; this.onTap = null; this.moved = 0;
    this.dTh = 0; this.dPh = 0; this.zv = 0; this.pan = new THREE.Vector3(); this.ptrs = new Map(); this.pinch = 0;
    el.addEventListener('pointerdown', e => { this.moved = 0; if (this.onTap) this.onTap(); this.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); try { el.setPointerCapture(e.pointerId); } catch (_) { } this.pinch = this.span(); });
    const up = e => { this.ptrs.delete(e.pointerId); this.pinch = this.span(); };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('pointermove', e => this.move(e));
    el.addEventListener('wheel', e => { e.preventDefault(); this.zv += Math.max(-200, Math.min(200, e.deltaY)) * 0.0009; }, { passive: false });
    el.addEventListener('contextmenu', e => e.preventDefault());
  }
  span() { if (this.ptrs.size < 2) return 0; const [a, b] = [...this.ptrs.values()]; return Math.hypot(a.x - b.x, a.y - b.y); }
  panBy(dx, dy) {
    const off = this.cam.position.clone().sub(this.target), r = off.length(), k = r * 0.0016;
    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), off).normalize();
    const upv = new THREE.Vector3().crossVectors(off, right).normalize();
    this.target.addScaledVector(right, -dx * k * -1).addScaledVector(upv, dy * k * -1);
    this.cam.position.addScaledVector(right, dx * k).addScaledVector(upv, dy * k);
  }
  move(e) {
    const p = this.ptrs.get(e.pointerId); if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    if (this.look) { if (this.ptrs.size >= 2) { const s2 = this.span(); if (this.pinch > 0 && s2 > 0) this.zv += Math.log(this.pinch / s2) * 0.9; this.pinch = s2; } else { this.dTh -= dx * 0.0035; this.dPh -= dy * 0.0035; } return; }
    if (this.ptrs.size >= 2) {
      const s = this.span(); if (this.pinch > 0 && s > 0) this.zv += Math.log(this.pinch / s) * 0.9; this.pinch = s;
      this.panBy(dx / 2, dy / 2);
    } else if (e.buttons & 2 || e.shiftKey || e.ctrlKey) this.panBy(dx, dy);
    else { this.dTh -= dx * 0.0055; this.dPh -= dy * 0.0055; }
  }
  update() {
    if (this.look) {
      const off = this.target.clone().sub(this.cam.position); const r = off.length() || 1;
      let th = Math.atan2(off.x, off.z), ph = Math.acos(Math.min(1, Math.max(-1, off.y / r)));
      th -= this.dTh; ph = Math.min(Math.PI - 0.05, Math.max(0.05, ph + this.dPh));
      this.dTh *= 0.86; this.dPh *= 0.86;
      this.target.set(this.cam.position.x + Math.sin(ph) * Math.sin(th), this.cam.position.y + Math.cos(ph), this.cam.position.z + Math.sin(ph) * Math.cos(th));
      if (Math.abs(this.zv) > 1e-5) { this.cam.fov = Math.min(70, Math.max(6, this.cam.fov * Math.exp(this.zv))); this.cam.updateProjectionMatrix(); }
      this.zv *= 0.8; this.cam.lookAt(this.target); return;
    }
    const off = this.cam.position.clone().sub(this.target); let r = off.length() || 1;
    let th = Math.atan2(off.x, off.z), ph = Math.acos(Math.min(1, Math.max(-1, off.y / r)));
    if (this.autoRotate) th -= 0.004 * this.autoRotateSpeed;
    th += this.dTh; ph = Math.min(Math.PI - 0.05, Math.max(0.05, ph + this.dPh));
    r = Math.min(this.maxDistance, Math.max(0.01, r * Math.exp(this.zv)));
    this.dTh *= 0.86; this.dPh *= 0.86; this.zv *= 0.8;
    if (Math.abs(this.dTh) < 1e-5) this.dTh = 0; if (Math.abs(this.dPh) < 1e-5) this.dPh = 0; if (Math.abs(this.zv) < 1e-5) this.zv = 0;
    this.cam.position.set(this.target.x + r * Math.sin(ph) * Math.sin(th), this.target.y + r * Math.cos(ph), this.target.z + r * Math.sin(ph) * Math.cos(th));
    this.cam.lookAt(this.target);
  }
}
function makeEnv(pm) {
  const room = new THREE.Scene();
  room.add(new THREE.Mesh(new THREE.BoxGeometry(30, 30, 30), new THREE.MeshBasicMaterial({ color: 0x1b2233, side: THREE.BackSide })));
  const panel = (w, h, x, y, z, k, col) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.lookAt(0, 0, 0); room.add(m);
  };
  panel(12, 12, 0, 14.5, 0, 6, 0xffffff); panel(8, 8, -14, 4, 6, 4, 0xffe2b0); panel(8, 8, 14, 3, -6, 3, 0xb0d0ff); panel(10, 4, 0, -6, 14, 2, 0xffffff);
  return pm.fromScene(room, 0.04).texture;
}

const S = { mode: 'A', ...PRESETS.A, gap: GAP, t: 0, playing: true, rays: true, photons: true, view: 'tel', auto: false, names: true, starshade: false, jwst: false, korea: false, nasa: true, pisLog: 4.3, ttLog: 4.3, struts: true, psfMode: 'raw', iwa: 3.5, dPc: 5, tLog: 2, drLog: 1.7, tau: 0.12, shieldTemp: false, leoH: 600, budTarget: 'sun', shieldType: 'jwst' };
const DUR = { A: 16, B: 24, C: 14 };
const MODE_NAME = { A: '접이식 전개형', B: '우주 조립형', C: 'HWO형', J: '제임스웹 실사', K: '한국형 우주망원경' };
const MODE_SUB = { A: 'JWST·Roman', B: 'iSAT류', C: '오프액시스', J: 'JWST 재현', K: '3.5mST·KASI' };
// 3.5mST 백서(KASI 2026, arXiv:2609.02571): 3.5 m·육각 18장·on-axis·시스템 f/4.5(부경 위치 25 %로 맞춤)·0.2–1.5 µm·3 m급 페어링
const KOREA = { D: 3.5, seg: 0.68, fn: 1.3, delta: 25, bfrac: 0.15, lambda: 0.55, dens: 25, hole: true, launcher: 'f3' };
const infoKey = () => S.jwst ? 'J' : S.korea ? 'K' : S.mode;
const INFO = {
  K: '<b>한국형 3.5 m 분할경 로봇 우주망원경(3.5mST)</b> — 한국천문연구원 등 백서(2026, arXiv 2609.02571·2609.02577, 개념 연구 단계·예산 미확보): 주경 3.5 m(육각 18장, on-axis, f/4.5), 0.2~1.5 µm, 광시야 10′~30′, 분광 R~1000(옵션 R~5000), 전용 코로나그래프(원시 대비 10⁻⁸ 목표, 후처리 10⁻⁹, IWA 3λ/D = 97 mas@550 nm, OWA 20λ/D), 수명 10년, 약 3 m 페어링. 궤도는 L2 또는 지구궤도 검토 중(🛰 LEO 뷰로 지구궤도안 확인). 지구형 행성은 태양형 별 주위(10⁻¹⁰)보다 늦은 K형 별 61 Cyg A·ε Ind A가 유력 대상입니다. 이전 제안(한정열 외 2021: 0.3~1.0 µm·LEO)도 참고.',
  J: '<b>제임스웹(JWST) 실물 재현</b> — NASA 3D Resources의 실제 3D 모델(약 10만 폴리곤, 실제 m 단위)을 표시합니다. 2021.12.25 발사(Ariane 5), 태양–지구 L2 헤일로 궤도. 금도금 베릴륨 육각 거울 18장(대변 1.32 m, 구경 6.5 m, 집광 25.4 m²) · 3개 지지대(삼각) 부경 · 5겹 칼톤 차양막(약 21.2×14.2 m) · 5장 단일 전지판(20° 기울임). ▶ 재생: 전지판 → 부경 지지대 → 차양막 → 날개 거울. 광학은 단순 카세그레인 근사(실제는 3반사경).',
  A: '<b>접이식 전개형</b> — 날개 거울·부경 붐·차광막을 접어 로켓 한 대에 싣고, 우주에서 펼칩니다(JWST·Roman 방식). ▶ 재생: 태양전지판 → 부경 붐 → 차광막 → 날개 거울 → 거울 정렬 순서.',
  B: '<b>우주 조립형</b> — 분할거울을 여러 번에 나눠 발사하고 궤도에서 로봇팔이 하나씩 조립합니다(NASA iSAT류 개념). 회색 윤곽은 아직 조립되지 않은 자리입니다.',
  C: '<b>HWO형(NASA 개념)</b> — 부경 가림이 없는 오프액시스 주경 + 코로나그래프(대비 ≤10⁻¹⁰, 96×96 변형거울)로 지구형 행성을 직접 촬영. ⚙에서 EAC1/4/5 구성을 고르고 스타셰이드(별도 우주선)도 켤 수 있습니다. 형상은 개념도 수준입니다.',
};

// ---------- 렌더러/씬 ----------
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05070d);
const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 2e5);
const controls = new Orbit(camera, canvas);
function hidePopups() { if (window.innerWidth < 760) { $('info').style.display = 'none'; $('panel').classList.add('hide'); } }   // 데스크톱은 돌려 보다가 닫히지 않게
controls.onTap = hidePopups;
$('info').addEventListener('click', () => { $('info').style.display = 'none'; });
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = makeEnv(pmrem);
const sun = new THREE.DirectionalLight(0xffffff, 2.0); sun.position.set(0.4, 1, 0.7); scene.add(sun);
scene.add(new THREE.HemisphereLight(0x8aa6ff, 0x1a1020, 0.35));

(function stars() {
  const n = 6000, a = new Float32Array(n * 3), c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    let u, th;
    if (i < 3200) { u = (Math.random() + Math.random() + Math.random() - 1.5) * 0.28; th = Math.random() * 6.2832; }   // 은하수 띠
    else { u = Math.random() * 2 - 1; th = Math.random() * 6.2832; }
    const r = Math.sqrt(1 - u * u), R = 4e4;
    // 은하면을 기울임
    const x0 = R * r * Math.cos(th), y0 = R * u, z0 = R * r * Math.sin(th), tilt = 0.9;
    a[3 * i] = x0; a[3 * i + 1] = y0 * Math.cos(tilt) - z0 * Math.sin(tilt); a[3 * i + 2] = y0 * Math.sin(tilt) + z0 * Math.cos(tilt);
    const k = Math.random(), b = (i < 3200 ? 0.35 : 0.55) + Math.random() * 0.45;
    const col = k < 0.2 ? [1, 0.82, 0.62] : k < 0.35 ? [0.7, 0.8, 1] : [0.92, 0.94, 1];
    c[3 * i] = col[0] * b; c[3 * i + 1] = col[1] * b; c[3 * i + 2] = col[2] * b;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(a, 3)); g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ vertexColors: true, size: 1.7, sizeAttenuation: false })));
})();

const holder = new THREE.Group(); scene.add(holder);
let tel = null, ctx = {};


// ---------- 실감용 절차적 텍스처 ----------
function mkTex(w, h, draw, rep) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const x = cv.getContext('2d'); draw(x, w, h);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); }
  return t;
}
const rr = Math.random;
const crinkleTex = base => mkTex(256, 256, (x, w, h) => {
  x.fillStyle = base; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 260; i++) {
    const cx = rr() * w, cy = rr() * h, r = 6 + rr() * 26, l = rr() < 0.5 ? 255 : 0, a = 0.04 + rr() * 0.09;
    x.fillStyle = `rgba(${l},${l},${l},${a})`; x.beginPath(); x.moveTo(cx, cy);
    for (let k = 0; k < 5; k++) { const ang = rr() * 6.283; x.lineTo(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r); }
    x.closePath(); x.fill();
  }
}, 0.35);
const cellTex = mkTex(512, 400, (x, w, h) => {
  x.fillStyle = '#c9ced8'; x.fillRect(0, 0, w, h);                 // 알루미늄 프레임
  const m = 14, cols = 12, rows = 9, cw = (w - 2 * m) / cols, ch = (h - 2 * m) / rows;
  x.fillStyle = '#05102e'; x.fillRect(m, m, w - 2 * m, h - 2 * m);
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const X = m + i * cw, Y = m + j * ch, g = x.createLinearGradient(X, Y, X + cw, Y + ch);
    g.addColorStop(0, '#244aa8'); g.addColorStop(0.55, '#14307d'); g.addColorStop(1, '#0c2160');
    x.fillStyle = g; x.beginPath(); x.moveTo(X + 5, Y + 1.5); x.lineTo(X + cw - 1.5, Y + 1.5); x.lineTo(X + cw - 1.5, Y + ch - 5); x.lineTo(X + cw - 5, Y + ch - 1.5); x.lineTo(X + 1.5, Y + ch - 1.5); x.lineTo(X + 1.5, Y + 5); x.closePath(); x.fill();
    x.strokeStyle = 'rgba(200,215,245,.7)'; x.lineWidth = 1.2;                    // 은색 그리드 핑거
    for (let k = 1; k <= 6; k++) { const yy = Y + 3 + k * (ch - 6) / 7; x.beginPath(); x.moveTo(X + 3, yy); x.lineTo(X + cw - 3, yy); x.stroke(); }
    x.strokeStyle = 'rgba(235,240,255,.9)'; x.lineWidth = 2;                       // 버스바
    x.beginPath(); x.moveTo(X + cw * 0.33, Y + 2); x.lineTo(X + cw * 0.33, Y + ch - 2); x.moveTo(X + cw * 0.66, Y + 2); x.lineTo(X + cw * 0.66, Y + ch - 2); x.stroke();
  }
  const sh = x.createLinearGradient(0, 0, w, h); sh.addColorStop(0, 'rgba(255,255,255,.10)'); sh.addColorStop(0.5, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(255,255,255,.05)');
  x.fillStyle = sh; x.fillRect(0, 0, w, h);
});
const mliTex = crinkleTex('#c9a45a');
const M = {
  mirror: new THREE.MeshStandardMaterial({ color: 0xf2c355, metalness: 1, roughness: 0.22, side: THREE.DoubleSide }),
  back: new THREE.MeshStandardMaterial({ color: 0x2b2f38, metalness: 0.6, roughness: 0.5 }),
  bp: new THREE.MeshStandardMaterial({ color: 0x3b4150, metalness: 0.5, roughness: 0.6 }),
  strut: new THREE.MeshStandardMaterial({ color: 0x9aa3b5, metalness: 0.8, roughness: 0.35 }),
  sec: new THREE.MeshStandardMaterial({ color: 0xf2c355, metalness: 1, roughness: 0.2 }),
  inst: new THREE.MeshStandardMaterial({ color: 0x5a6a86, metalness: 0.7, roughness: 0.4 }),
  bus: new THREE.MeshStandardMaterial({ color: 0xaab3c4, metalness: 0.8, roughness: 0.4 }),
  panel: new THREE.MeshStandardMaterial({ map: cellTex, color: 0xffffff, metalness: 0.25, roughness: 0.22, emissive: 0x0a1a45 }),
  panelBack: new THREE.MeshStandardMaterial({ color: 0xd8dbe2, metalness: 0.4, roughness: 0.5 }),
  shield: new THREE.MeshStandardMaterial({ map: crinkleTex('#9aa3c4'), color: 0xdfe4f5, metalness: 0.7, roughness: 0.32, transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
  shieldJ: new THREE.MeshStandardMaterial({ map: crinkleTex('#a79fc9'), color: 0xe6e0f7, metalness: 0.75, roughness: 0.3, transparent: true, opacity: 0.86, side: THREE.DoubleSide }),
  mli: new THREE.MeshStandardMaterial({ map: mliTex, color: 0xffffff, metalness: 0.6, roughness: 0.45 }),
  dish: new THREE.MeshStandardMaterial({ color: 0xe9ecf2, metalness: 0.7, roughness: 0.3, side: THREE.DoubleSide }),
  rad: new THREE.MeshStandardMaterial({ color: 0x20242e, metalness: 0.3, roughness: 0.7 }),
  arm: new THREE.MeshStandardMaterial({ color: 0xff8a3d, metalness: 0.5, roughness: 0.4 }),
  ghost: new THREE.MeshBasicMaterial({ color: 0x4de3ff, wireframe: true, transparent: true, opacity: 0.22 }),
  line: new THREE.LineBasicMaterial({ color: 0x6b7388 }),
};
const rnd = (() => { let a = 12345; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })();

// ---------- 기하 도우미 ----------
function hexMirrorGeom(R, sub, f, cx, cz) {
  const pos = [], nor = [], idx = [], y0 = sag(cx, cz, f);
  const corner = k => [R * Math.cos(k * Math.PI / 3), R * Math.sin(k * Math.PI / 3)];
  const addV = (lx, lz) => {
    const gx = cx + lx, gz = cz + lz;
    pos.push(lx, sag(gx, gz, f) - y0, lz);
    const nx = -gx / (2 * f), nz = -gz / (2 * f), l = Math.hypot(nx, 1, nz);
    nor.push(nx / l, 1 / l, nz / l);
    return pos.length / 3 - 1;
  };
  for (let k = 0; k < 6; k++) {
    const c0 = corner(k), c1 = corner((k + 1) % 6), rows = [];
    for (let i = 0; i <= sub; i++) {
      const row = [];
      for (let j = 0; j <= i; j++) {
        const a = (i - j) / sub, b = j / sub;
        row.push(addV(a * c0[0] + b * c1[0], a * c0[1] + b * c1[1]));
      }
      rows.push(row);
    }
    for (let i = 0; i < sub; i++) for (let j = 0; j <= i; j++) {
      idx.push(rows[i][j], rows[i + 1][j], rows[i + 1][j + 1]);
      if (j < i) idx.push(rows[i][j], rows[i + 1][j + 1], rows[i][j + 1]);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
}
const cylGeom = new THREE.CylinderGeometry(1, 1, 1, 8);
function makeCyl(r, mat) { const m = new THREE.Mesh(cylGeom, mat); m.userData.r = r; return m; }
function setCyl(m, a, b) {
  const d = new V3().subVectors(b, a), len = d.length() || 1e-6, r = m.userData.r;
  m.position.copy(a).addScaledVector(d, 0.5);
  m.scale.set(r, len, r);
  m.quaternion.setFromUnitVectors(UP, d.normalize());
}
const ph = (t, a, b) => { const x = Math.min(1, Math.max(0, (t - a) / (b - a))); return x * x * (3 - 2 * x); };
const lerp = (a, b, t) => a + (b - a) * t;

// ---------- 망원경 생성 ----------

// ---------- NASA 실제 3D 모델 (NASA 3D Resources, "James Webb Space Telescope (B)") ----------
// 원본 GLB(Draco 압축)를 미리 풀어 위치 Int16·법선 Int8로 양자화한 jwstB.bin/json을 같은 폴더에서 불러옴. 단위 m, y축 위, 망원경 시선 +z.
const NASA_DIR = 'models/jwst/';   // NASA JWST (B) 모델 데이터 위치 (models/CREDITS.md)
const NASA = { state: 'idle', root: null, foils: [], names: null };
function nasaLook(n) {
  if (/TopReflector/.test(n)) return { col: [0.93, 0.70, 0.28], metal: 0.8, rough: 0.28, em: 0x2a1700 };          // 금도금 주경
  if (/gold-fl/.test(n)) return { col: [0.93, 0.70, 0.28], metal: 0.8, rough: 0.28, em: 0x2a1700 };                // 부경
  if (/FoilLayer[1-4]/.test(n)) return { col: [0.80, 0.80, 0.86], metal: 0.55, rough: 0.38 };                      // 차양막(실리콘 코팅 칼톤)
  if (/PURPLEY/.test(n)) return { col: [0.62, 0.48, 0.62], metal: 0.5, rough: 0.4 };                              // 태양쪽 층(보라빛)
  if (/Solar/.test(n)) return { col: [0.16, 0.24, 0.62], metal: 0.35, rough: 0.3, em: 0x060c26 };
  if (/silver/.test(n)) return { metal: 0.6, rough: 0.4 };
  return { metal: 0.25, rough: 0.7 };
}
async function loadNasa() {
  if (NASA.state !== 'idle') return; NASA.state = 'loading';
  try {
    const [meta, bin] = await Promise.all([fetch(NASA_DIR + 'jwstB.json').then(r => { if (!r.ok) throw 0; return r.json(); }), fetch(NASA_DIR + 'jwstB.gz.b64.txt').then(r => { if (!r.ok) throw 0; return r.text(); }).then(t => {      // gzip + base64 텍스트로 배포
      const raw = atob(t.trim()), u8 = new Uint8Array(raw.length); for (let i = 0; i < raw.length; i++) u8[i] = raw.charCodeAt(i);
      return new Response(new Blob([u8]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
    })]);
    const mn = meta.bmin, mx = meta.bmax, half = [0, 1, 2].map(a => (mx[a] - mn[a]) / 2), mid = [0, 1, 2].map(a => (mx[a] + mn[a]) / 2);
    const root = new THREE.Group(), g = new THREE.Group(); root.add(g);
    g.scale.set(half[0], half[1], half[2]); g.position.set(mid[0], mid[1], mid[2]);
    for (const m of meta.groups) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Int16Array(bin, m.pos, m.nv * 3), 3, true));
      geo.setAttribute('normal', new THREE.BufferAttribute(new Int8Array(bin, m.nor, m.nv * 3), 3, true));
      geo.setIndex(new THREE.BufferAttribute(m.i32 ? new Uint32Array(bin, m.idx, m.ni) : new Uint16Array(bin, m.idx, m.ni), 1));
      const lk = nasaLook(m.name), col = lk.col || m.color;
      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: new THREE.Color(col[0], col[1], col[2]), metalness: lk.metal, roughness: lk.rough, emissive: lk.em || 0, side: THREE.DoubleSide }));
      mesh.userData.keep = true; g.add(mesh);
      if (/Foil|PURPLEY/.test(m.name) && m.size[0] > 5) NASA.foils.push({ mesh, cq: [0, 1, 2].map(a => (m.c[a] - mid[a]) / half[a]) });
    }
    const byName = k => meta.groups.find(q => q.name === k);
    const nm = new THREE.Group(); NASA.names = nm; root.add(nm);
    const put = (txt, p, sc = 0.45) => { const l = label(txt, sc); l.position.set(p[0], p[1], p[2]); l.userData.keep = true; nm.add(l); };
    const tr = byName('JWST-TopReflector'), sm = byName('JWST-gold-fl'), sp = byName('JWST-SolarPanel-22'), rd = byName('sc_rad_smli1');
    if (tr) put('주경 · 금도금 베릴륨 18장 (6.5 m)', [tr.c[0], tr.c[1] + 4.6, tr.c[2]]);
    if (sm) put('부경 (0.74 m)', [sm.c[0], sm.c[1] + 1.4, sm.c[2]], 0.35);
    put('차양막 5겹 (약 21 × 14 m)', [5.2, 0.6, 6.5]);
    if (sp) put('태양전지판', [sp.c[0], sp.c[1] - 1.6, sp.c[2] - 1.5], 0.35);
    if (rd) put('버스 (자세제어·통신·방열판)', [rd.c[0], rd.c[1] - 1.8, rd.c[2]], 0.35);
    root.traverse(o => { o.userData.keep = true; });
    NASA.root = root; NASA.box = new THREE.Box3(new V3(mn[0], mn[1], mn[2]), new V3(mx[0], mx[1], mx[2]));
    NASA.state = 'ok';
    if (S.jwst && S.nasa) build(S.view === 'tel');
  } catch (e) { NASA.state = 'fail'; console.warn('NASA 모델을 불러오지 못해 근사 모델을 사용합니다.', e); if (typeof syncUI === 'function') try { syncUI(); } catch (_) { } }
}
function build(fit = true) {
  if (NASA.root && NASA.root.parent) NASA.root.parent.remove(NASA.root);
  if (tel) { holder.remove(tel); tel.traverse(o => { if (o.geometry && !o.userData.keep) o.geometry.dispose(); }); }
  tel = new THREE.Group(); holder.add(tel);
  const mode = S.mode, hole = mode === 'C' ? false : S.hole;
  const n = ringsForAperture(S.D, S.seg, S.gap, hole);
  const segs = hexLayout(n, S.seg, S.gap, hole);
  const Deff = apertureOf(segs, S.seg);
  const R = S.seg / SQ3, f = S.fn * Deff;
  const opt = makeOptics(mode, f, Deff, S.delta / 100, S.bfrac);
  if (mode === 'C') segs.forEach(g => { g.x += opt.x0; });
  const rs = opt.cass ? secondaryRadius(segs, R, opt) : 0;
  const yBP = -0.05 * Deff, th = Math.max(0.05, 0.08 * S.seg), sub = segs.length > 150 ? 1 : 2;
  const p = S.seg + S.gap, qFold = Math.max(1, Math.floor(n / 2));
  const xh = (qFold + 0.5) * SQ3 / 2 * p;
  ctx = { mode, segs, Deff, R, f, opt, rs, n, xh, yBP, count: 0, lastCount: -1 };
  const wingOf = g => (mode === 'A' && Math.abs(g.q) > qFold) ? (g.q > 0 ? 1 : -1) : 0;

  let wingR = null, wingL = null;
  if (mode === 'A') {
    wingR = new THREE.Group(); wingR.position.set(xh, yBP, 0);
    wingL = new THREE.Group(); wingL.position.set(-xh, yBP, 0);
    tel.add(wingR, wingL);
  }
  ctx.wingR = wingR; ctx.wingL = wingL;

  // 분할거울
  const backGeom = new THREE.CylinderGeometry(R * 0.97, R * 0.97, th, 6).rotateY(Math.PI / 2);
  const order = [...segs].sort((a, b) => a.ring - b.ring || Math.atan2(a.z, a.x) - Math.atan2(b.z, b.x));
  ctx.order = []; ctx.ghosts = [];
  for (const g of order) {
    const w = wingOf(g), grp = w === 1 ? wingR : w === -1 ? wingL : tel;
    const gm = new THREE.Group(), y0 = sag(g.x, g.z, f);
    const geo = hexMirrorGeom(R, sub, f, g.x, g.z);
    gm.add(new THREE.Mesh(geo, M.mirror));
    const nrm = new V3(-g.x / (2 * f), 1, -g.z / (2 * f)).normalize();
    const bg = new THREE.Group(); bg.quaternion.setFromUnitVectors(UP, nrm);
    const back = new THREE.Mesh(backGeom, M.back); back.position.y = -th / 2 - 0.01; bg.add(back); gm.add(bg);
    const lp = [];
    for (const a of [90, 210, 330]) {
      const ox = R * 0.5 * Math.cos(a * Math.PI / 180), oz = R * 0.5 * Math.sin(a * Math.PI / 180);
      lp.push(ox, -th - 0.01, oz, ox, yBP - y0, oz);
    }
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
    gm.add(new THREE.LineSegments(lg, M.line));
    const px = w === 1 ? xh : w === -1 ? -xh : 0, py = w ? yBP : 0;
    gm.position.set(g.x - px, y0 - py, g.z);
    gm.userData = { seg: g, base: gm.position.clone(), jit: [(rnd() - 0.5) * 0.09, (rnd() - 0.5) * 0.09, (rnd() - 0.5) * 0.06 * Deff * 0.1] };
    grp.add(gm); ctx.order.push(gm);
    if (mode === 'B') {
      const gh = new THREE.Mesh(geo, M.ghost); gh.position.set(g.x, y0, g.z); tel.add(gh); ctx.ghosts.push(gh);
    }
  }

  // 후면 구조(백플레인)
  if (mode === 'A') {
    const cs = segs.filter(g => !wingOf(g));
    const z0 = Math.min(...cs.map(g => g.z)) - S.seg / 2, z1 = Math.max(...cs.map(g => g.z)) + S.seg / 2;
    const bc = new THREE.Mesh(new THREE.BoxGeometry(2 * xh - 0.02, th * 1.2, z1 - z0), M.bp);
    bc.position.set(0, yBP, (z0 + z1) / 2); tel.add(bc);
    for (const sgn of [1, -1]) {
      const ws = segs.filter(g => wingOf(g) === sgn);
      if (!ws.length) continue;
      const wz0 = Math.min(...ws.map(g => g.z)) - S.seg / 2, wz1 = Math.max(...ws.map(g => g.z)) + S.seg / 2;
      const xm = Math.max(...ws.map(g => Math.abs(g.x))) + R, wlen = xm - xh;
      const bw = new THREE.Mesh(new THREE.BoxGeometry(wlen, th * 1.2, wz1 - wz0), M.bp);
      bw.position.set(sgn * wlen / 2, 0, (wz0 + wz1) / 2); (sgn === 1 ? wingR : wingL).add(bw);
    }
  } else {
    const cx = mode === 'C' ? opt.x0 : 0;
    const d = new THREE.Mesh(new THREE.CylinderGeometry(Deff / 2 + 0.05, Deff / 2 + 0.05, th * 1.2, 48), M.bp);
    d.position.set(cx, yBP, 0); tel.add(d);
  }

  // 부경/붐 (A, B)
  ctx.struts = [];
  if (opt.cass) {
    ctx.sec = new THREE.Mesh(new THREE.CylinderGeometry(rs, rs, Math.max(0.03, rs * 0.12), 32), M.sec);
    tel.add(ctx.sec); ctx.yStow = 0.22 * opt.d;
    const sr = Math.max(0.015, 0.006 * Deff);
    if (S.jwst) {                                                   // JWST: 3개 지지대(위 1, 아래 좌우 2)
      for (const ang of [90, 210, 330]) {
        const ca = Math.cos(ang * Math.PI / 180), sa = Math.sin(ang * Math.PI / 180), ax = ca * 0.46 * Deff, az = sa * 0.46 * Deff;
        const m = makeCyl(sr * 1.3, M.strut); tel.add(m);
        ctx.struts.push({ m, a: new V3(ax, sag(ax, az, f) + 0.05, az), dx: ca * 0.5 * rs, dz: sa * 0.5 * rs });
      }
    } else for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const ax = sx * 0.12 * Deff, az = sz * 0.46 * Deff;
      const m = makeCyl(sr, M.strut); tel.add(m);
      ctx.struts.push({ m, a: new V3(ax, sag(ax, az, f) + 0.05, az), dx: sx * 0.5 * rs, dz: sz * 0.5 * rs });
    }
    // 초점면 기기
    const ib = new THREE.Mesh(new THREE.BoxGeometry(0.30 * Deff, 0.16 * Deff, 0.30 * Deff), M.inst);
    ib.position.set(0, -opt.b - 0.04 * Deff, 0); tel.add(ib);
  } else {
    const cb = new THREE.Mesh(new THREE.BoxGeometry(0.2 * Deff, 0.2 * Deff, 0.2 * Deff), M.inst);
    cb.position.set(0, f + 0.10 * Deff, 0); tel.add(cb);
    const sr = Math.max(0.015, 0.006 * Deff);
    for (const sz of [-1, 1]) {
      const m = makeCyl(sr, M.strut); tel.add(m);
      setCyl(m, new V3(opt.x0 - Deff / 2 + 0.04 * Deff, yBP, sz * 0.3 * Deff), new V3(0.02 * Deff, f + 0.04 * Deff, sz * 0.08 * Deff));
    }
  }

  // 차광막/버스/태양전지판
  const bb = opt.cass ? opt.b : 0.10 * Deff;
  const st = S.jwst ? 'jwst' : S.shieldType;   // 차양막 종류(JWST형 기본 / SALTUS형 / V-groove형)
  const nL = st === 'saltus' ? 2 : st === 'vgroove' ? 3 : mode === 'A' ? (S.korea ? 2 : 5) : mode === 'B' ? 3 : 2;
  const spc = (st === 'saltus' ? 0.14 : st === 'vgroove' ? 0.08 : mode === 'C' ? 0.02 : 0.045) * Deff;
  const ySS0 = -bb - (opt.cass ? 0.30 : 0.06) * Deff, yLast = ySS0 - (nL - 1) * spc;
  const sx0 = mode === 'C' ? opt.x0 * 0.5 : 0;
  ctx.layers = [];
  const Ws = S.jwst ? 14.162 : (mode === 'A' ? (S.korea ? 1.5 * Deff : 2.15 * Deff) : 1.7 * Deff);   // JWST 실제: 14.162 × 21.197 m
  const Ls = S.jwst ? 21.197 : (mode === 'A' ? (S.korea ? 2.0 * Deff : 3.2 * Deff) : 2.4 * Deff);
  ctx.shieldSize = mode === 'C' ? Deff * 2 : Ls;
  // 연 모양(끝이 잘린 마름모) 막: 가장자리는 평평, 안쪽은 팽팽한 막이 처지는 형상 + 잔주름
  const kiteGeom = (W, L, sag) => {
    const poly = [[-0.06 * W, 0.58 * L], [0.06 * W, 0.58 * L], [0.5 * W, 0.06 * L], [0.1 * W, -0.42 * L], [-0.1 * W, -0.42 * L], [-0.5 * W, 0.06 * L]];
    const per = []; let tot = 0;
    for (let i = 0; i < 6; i++) { const p = poly[i], q = poly[(i + 1) % 6], d = Math.hypot(q[0] - p[0], q[1] - p[1]); per.push(d); tot += d; }
    const N = 96, bd = [];
    for (let j = 0; j < N; j++) {
      let t = j / N * tot, i = 0; while (t > per[i]) { t -= per[i]; i++; }
      const p = poly[i], q = poly[(i + 1) % 6], u = t / per[i]; bd.push([p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u]);
    }
    const c = [0, 0.06 * L], R = 7, pos = [], uv = [], idx = [];
    const ripple = (x, z, tt) => 0.0035 * Deff * tt * (Math.sin(x * 2.3 / Deff * 3 + z * 1.1 / Deff * 3) + 0.6 * Math.sin(z * 4.1 / Deff * 3 - x * 1.7 / Deff * 3));
    pos.push(c[0], -sag, c[1]); uv.push(c[0] / Deff * 0.8, c[1] / Deff * 0.8);
    for (let k = 1; k <= R; k++) {
      const tt = k / R;
      for (let j = 0; j < N; j++) {
        const x = c[0] + (bd[j][0] - c[0]) * tt, z = c[1] + (bd[j][1] - c[1]) * tt;
        pos.push(x, -sag * (1 - tt * tt) + ripple(x, z, tt), z); uv.push(x / Deff * 0.8, z / Deff * 0.8);
      }
    }
    for (let j = 0; j < N; j++) idx.push(0, 1 + j, 1 + (j + 1) % N);
    for (let k = 1; k < R; k++) for (let j = 0; j < N; j++) {
      const a0 = 1 + (k - 1) * N + j, a1 = 1 + (k - 1) * N + (j + 1) % N, b0 = 1 + k * N + j, b1 = 1 + k * N + (j + 1) % N;
      idx.push(a0, b0, b1, a0, b1, a1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    const edge = new THREE.BufferGeometry().setFromPoints(bd.map(p => new V3(p[0], 0, p[1])));
    return { g, edge };
  };
  const edgeMat = new THREE.LineBasicMaterial({ color: 0x59607a });
  for (let i = 0; i < nL; i++) {
    let m;
    if (st === 'saltus') {   // SALTUS: 50 × 20 m 직사각 막(14 m 주경 대비 3.57D × 1.43D), 위층이 약간 작음
      const fz = 1 - 0.03 * (nL - 1 - i), w = 0.715 * Deff * fz, l = 1.785 * Deff * fz;
      m = new THREE.Mesh(new THREE.PlaneGeometry(2 * w, 2 * l).rotateX(-Math.PI / 2), M.shield); m.userData.bs = 1;
      m.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([new V3(-w, 0, -l), new V3(w, 0, -l), new V3(w, 0, l), new V3(-w, 0, l)]), edgeMat));
    } else if (st === 'vgroove') {   // V-groove: 서로 다른 각도로 기울인 원판 3장(바깥으로 벌어지는 V자 틈)
      m = new THREE.Mesh(new THREE.CircleGeometry(0.75 * Deff * (1 + 0.07 * i), 56).rotateX(Math.PI / 2), M.shield);
      m.rotation.z = (i % 2 ? -1 : 1) * (0.05 + 0.05 * i); m.userData.bs = 1;
    } else if (mode === 'C') { m = new THREE.Mesh(new THREE.CircleGeometry(1, 56).rotateX(Math.PI / 2), S.jwst ? M.shieldJ : M.shield); m.scale.set(Deff, 1, Deff); }
    else {
      const fz = 1 - 0.012 * (nL - 1 - i), kg = kiteGeom(Ws * fz, Ls * fz, 0.016 * Deff);   // 층마다 크기 약간 다르게
      m = new THREE.Mesh(kg.g, S.jwst ? M.shieldJ : M.shield); m.add(new THREE.LineLoop(kg.edge, edgeMat));
    }
    m.position.set(sx0, ySS0 - i * spc, 0); tel.add(m); ctx.layers.push(m);
  }
  ctx.shield = { nL, type: st, meshes: ctx.layers.slice(0, nL), lbl: new THREE.Group(), side: st === 'saltus' ? [0.75 * Deff, 0] : st === 'vgroove' ? [0.95 * Deff, 0] : mode === 'C' ? [Deff * 1.08, 0] : [0.5 * Ws + 0.05 * Deff, 0.06 * Ls] };
  ctx.shield.lbl.position.set(sx0, 0, 0); tel.add(ctx.shield.lbl);
  if (S.jwst && mode === 'A') {                                   // 차양막 중간 지지 붐(좌우 가로대)
    const Ws2 = Ws, Ls2 = Ls;
    for (const zi of [0.06, -0.2]) {
      const bg = new THREE.Group(); bg.position.set(sx0, yLast - 0.006 * Deff, 0);
      const bm = makeCyl(0.007 * Deff, M.strut); bg.add(bm); const wz = zi * Ls2, wx = (zi === 0.06 ? 0.5 : 0.28) * Ws2;
      setCyl(bm, new V3(-wx, 0, wz), new V3(wx, 0, wz)); tel.add(bg); ctx.layers.push(bg);
    }
  }
  const yBus = yLast - 0.14 * Deff;
  const bus = new THREE.Mesh(new THREE.BoxGeometry(0.42 * Deff, 0.14 * Deff, 0.42 * Deff), M.mli);
  bus.position.set(sx0, yBus, 0); tel.add(bus);
  // 고이득 안테나(HGA) + 마스트, 라디에이터 패널, 별추적기
  const hga = new THREE.Mesh(new THREE.CylinderGeometry(0.075 * Deff, 0.012 * Deff, 0.035 * Deff, 32, 1, true), M.dish);
  hga.position.set(sx0 + 0.12 * Deff, yBus - 0.07 * Deff - 0.14 * Deff, 0.1 * Deff); tel.add(hga);
  const mast = makeCyl(0.006 * Deff, M.strut); tel.add(mast);
  setCyl(mast, new V3(sx0 + 0.12 * Deff, yBus - 0.07 * Deff, 0.1 * Deff), new V3(sx0 + 0.12 * Deff, yBus - 0.07 * Deff - 0.13 * Deff, 0.1 * Deff));
  const rad = new THREE.Mesh(new THREE.BoxGeometry(0.30 * Deff, 0.004 * Deff + 0.004, 0.30 * Deff), M.rad);
  rad.position.set(sx0, yBus + 0.073 * Deff, 0); tel.add(rad);
  for (const sz of [-1, 1]) {
    const st = new THREE.Mesh(new THREE.BoxGeometry(0.03 * Deff, 0.03 * Deff, 0.03 * Deff), M.rad);
    st.position.set(sx0 - 0.15 * Deff, yBus - 0.085 * Deff, sz * 0.14 * Deff); tel.add(st);
  }
  if (S.jwst) {                                                   // 버스 좌우 방열판 + 전개식 타워
    for (const sz of [-1, 1]) {
      const rd = new THREE.Mesh(new THREE.BoxGeometry(0.42 * Deff, 0.005 * Deff + 0.005, 0.30 * Deff), M.dish);
      rd.position.set(sx0, yBus + 0.02 * Deff, sz * 0.36 * Deff); tel.add(rd);
    }
    const dta = makeCyl(0.03 * Deff, M.strut); tel.add(dta); setCyl(dta, new V3(0, yBP - 0.05 * Deff, 0), new V3(0, ySS0, 0));
  }
  // 부품 이름표
  const nm = new THREE.Group(); ctx.names = nm; tel.add(nm);
  const addName = (txt, x, y, z) => { const l = label(txt, 0.06 * Deff); l.position.set(x, y, z); nm.add(l); return l; };
  addName('주경 (분할 거울)', 0, 0.16 * Deff, 0.62 * Deff);
  if (opt.cass) { ctx.secName = addName('부경', 0, opt.d + 0.14 * Deff, 0); addName('과학 기기 (초점면)', 0, -opt.b - 0.04 * Deff - 0.15 * Deff, 0); }
  else addName('코로나그래프·기기', 0, f + 0.10 * Deff + 0.2 * Deff, 0);
  addName(st === 'saltus' ? 'SALTUS형 차양막 2겹 (간격 넓음)' : st === 'vgroove' ? 'V-groove 3단 (Planck·FOSSIL형)' : mode === 'C' ? '차광막(원판)' : `차양막 ${nL}겹`, sx0, yLast - 0.04 * Deff, ctx.shieldSize * 0.3);
  addName('버스(자세제어·통신)', sx0 - 0.1 * Deff, yBus - 0.2 * Deff, -0.15 * Deff);
  addName('고이득 안테나', sx0 + 0.12 * Deff, yBus - 0.32 * Deff, 0.1 * Deff);
  // 태양전지판: 실제 설계 참조
  //  A = JWST형: 5장짜리 단일 고정 배열(길이 ≈5.9 m/구경 6.5 m ≈ 0.9D), 차양막 쪽으로 20° 기울임, 접어 발사 후 순차 전개
  //  B·C = Roman형(SASS): 6장 — 중앙 2장 고정 + 외곽 4장 전개, 태양쪽에서 차광 겸용 (HWO는 규격 미공개 → 개념 크기)
  const mkPanel = (w, l) => new THREE.Mesh(new THREE.BoxGeometry(w, 0.006 * Deff + 0.006, l), [M.panelBack, M.panelBack, M.panelBack, M.panel, M.panelBack, M.panelBack]);
  ctx.solarAnim = null; ctx.solarArea = 0;
  if (mode === 'A') {
    const nP = 5, PWd = 0.21 * Deff, PLn = 0.88 * Deff / nP, root = new THREE.Group();
    root.position.set(sx0 + 0.24 * Deff, yBus + 0.01 * Deff, 0.05 * Deff); root.rotation.z = 20 * Math.PI / 180;   // 20° 기울임
    const hinges = []; let parent = root;
    for (let k = 0; k < nP; k++) {
      const hg = new THREE.Group(); hg.position.z = k === 0 ? 0 : -PLn; parent.add(hg);
      const pm = mkPanel(PWd, PLn - 0.01 * Deff); pm.position.set(PWd / 2, 0, -PLn / 2); hg.add(pm);
      hinges.push(hg); parent = hg;
    }
    tel.add(root); ctx.solarArea = nP * PWd * PLn;
    ctx.solarAnim = pw => hinges.forEach((hg, k) => { hg.rotation.x = k === 0 ? 0 : (k % 2 ? 1 : -1) * Math.PI * 0.98 * (1 - pw); });
    ctx.solarLabel = 'JWST형 태양전지판 5장 (고정 배열 · 20° 기울임)';
  } else {
    const PWd = 0.17 * Deff, PLn = 0.40 * Deff, y0 = yBus - 0.075 * Deff, wings = [];
    for (const sgn of [1, -1]) {                                   // 중앙 고정 2장
      const pm = mkPanel(PWd, PLn); pm.position.set(sx0 + sgn * PWd / 2, y0, 0); tel.add(pm);
    }
    for (const sgn of [1, -1]) {                                   // 외곽 전개 2장씩
      const h1 = new THREE.Group(); h1.position.set(sx0 + sgn * PWd, y0, 0); tel.add(h1);
      const p1 = mkPanel(PWd, PLn); p1.position.x = sgn * PWd / 2; h1.add(p1);
      const h2 = new THREE.Group(); h2.position.x = sgn * PWd; h1.add(h2);
      const p2 = mkPanel(PWd, PLn); p2.position.x = sgn * PWd / 2; h2.add(p2);
      wings.push({ h1, h2, sgn });
    }
    ctx.solarArea = 6 * PWd * PLn;
    ctx.solarAnim = pw => wings.forEach(({ h1, h2, sgn }) => { h1.rotation.z = sgn * (Math.PI / 2) * (1 - pw); h2.rotation.z = -sgn * Math.PI * 0.98 * (1 - pw); });
    ctx.solarLabel = 'Roman형 태양전지판 6장 (중앙 2 고정 + 외곽 4 전개)';
  }
  if (ctx.names) { const ln = label(ctx.solarLabel, 0.06 * Deff); ln.position.set(sx0 + (mode === 'A' ? 0.78 : 0.62) * Deff, yBus + 0.02 * Deff, 0); ctx.names.add(ln); }
  if (mode === 'B') {
    const keel = makeCyl(0.015 * Deff, M.strut); tel.add(keel);
    setCyl(keel, new V3(0, yBus, 0), new V3(0, yBP, 0));
    const L = 0.42 * Deff;
    ctx.arm = { base: new V3(0, 0.0, 0), L1: L, L2: L, l1: makeCyl(0.012 * Deff, M.arm), l2: makeCyl(0.010 * Deff, M.arm),
      j: new THREE.Mesh(new THREE.SphereGeometry(0.02 * Deff, 12, 8), M.arm), tip: new THREE.Mesh(new THREE.SphereGeometry(0.015 * Deff, 12, 8), M.arm) };
    tel.add(ctx.arm.l1, ctx.arm.l2, ctx.arm.j, ctx.arm.tip);
  }
  ctx.rayGroup = null; ctx.photons = null; ctx.photonPaths = [];

  // 카메라 맞춤 (완전 전개 상태 기준)
  applyT(1);
  const bx = new THREE.Box3().setFromObject(tel), size = bx.getSize(new V3()), c = bx.getCenter(new V3());
  ctx.extent = Math.max(size.x, size.y, size.z); ctx.center = c;
  // 스타셰이드: 별도 우주선(실제는 수만 km 앞). 꽃잎형 차폐판, 지름 약 35 m(축척 아님)
  ctx.ssh = null;
  if (mode === 'C') {
    const Rs = 2.2 * Deff, sh2 = new THREE.Shape(), NP = 16, NS = 400;
    for (let i = 0; i <= NS; i++) {
      const a = i / NS * 6.2832, pet = Math.pow(Math.abs(Math.cos(NP / 2 * a)), 0.7), r = Rs * (0.38 + 0.62 * pet);
      if (i === 0) sh2.moveTo(r, 0); else sh2.lineTo(r * Math.cos(a), r * Math.sin(a));
    }
    sh2.closePath();
    const sm = new THREE.Mesh(new THREE.ShapeGeometry(sh2).rotateX(-Math.PI / 2), M.rad);
    const g2 = new THREE.Group(); g2.add(sm);
    const lb = label('스타셰이드 (별도 우주선 · 약 35 m · 수만 km 앞, 축척 아님)', 0.09 * Deff); lb.position.set(0, 0.2 * Deff, Rs * 1.1); g2.add(lb);
    g2.position.set(opt.x0 * 0.4, f + 4.5 * Deff, 0); tel.add(g2); ctx.ssh = g2;
  }
  ctx.nasa = false;
  if (S.jwst && S.nasa) {
    if (NASA.state === 'idle') loadNasa();
    if (NASA.state === 'ok') {                                       // 근사 모델은 숨기고 NASA 실제 모델로 교체
      const proc = new THREE.Group(); proc.visible = false;
      for (const ch of [...tel.children]) proc.add(ch);
      tel.add(proc, NASA.root); ctx.nasa = true; ctx.proc = proc;
      const sz = NASA.box.getSize(new V3()); ctx.extent = Math.max(sz.x, sz.y, sz.z); ctx.center = NASA.box.getCenter(new V3());
    }
  }
  if (S.view === 'tel') { if (fit) fitCamera(); else { holder.position.set(0, 0, 0); holder.rotation.set(0, 0, 0); holder.scale.setScalar(1); } }
  else if (S.view === 'leo') applyHolderLEO(); else applyHolderEarthView();
  applyT(S.t);
  applyShieldTemp();
  updateStats();
}

function fitCamera() {
  const r = ctx.extent / 2, c = ctx.center;
  holder.position.set(0, 0, 0); holder.rotation.set(0, 0, 0); holder.scale.setScalar(1);
  camera.near = Math.max(0.05, r * 0.01);
  const k = camera.aspect < 1 ? Math.max(1, 0.78 / camera.aspect) : 1;   // 세로 화면(휴대폰)은 더 멀리
  camera.position.set(c.x + 1.25 * r * k, c.y + 0.9 * r * k, c.z + 1.6 * r * k);
  controls.target.copy(c); camera.updateProjectionMatrix();
}

// ---------- 레이 / 광자 ----------
function buildRays() {
  if (ctx.rayGroup) { tel.remove(ctx.rayGroup); ctx.rayGroup.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
  const rg = new THREE.Group(); ctx.rayGroup = rg; tel.add(rg); ctx.photons = null; ctx.photonPaths = [];
  const { opt, rs, R } = ctx;
  const list = ctx.mode === 'B' ? ctx.order.slice(0, ctx.count).map(g => g.userData.seg) : ctx.segs;
  const per4 = list.length * 4 <= 720, offs = [[0, 0]];
  if (per4) for (const a of [90, 210, 330]) offs.push([0.5 * R * Math.cos(a * Math.PI / 180), 0.5 * R * Math.sin(a * Math.PI / 180)]);
  const paths = [];
  for (const g of list) for (const [ox, oz] of offs) {
    const x = g.x + ox, z = g.z + oz;
    if (opt.cass && Math.hypot(x, z) <= rs * 1.05) continue;
    const pa = traceRay(x, z, opt); if (pa) paths.push(pa);
  }
  if (!paths.length) return;
  const cols = [[1, 0.9, 0.4], [1, 0.62, 0.25], [0.3, 0.9, 1]], pos = [], col = [];
  for (const pa of paths) { const ci = pa.length === 3 ? [0, 2] : [0, 1, 2]; for (let i = 0; i < pa.length - 1; i++) { pos.push(...pa[i], ...pa[i + 1]); col.push(...cols[ci[i]], ...cols[ci[i]]); } }
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); lg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  rg.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.5 })));
  const use = paths.slice(0, 240);
  ctx.photonPaths = use.map(pa => {
    const lens = []; let total = 0;
    for (let i = 0; i < pa.length - 1; i++) { const d = Math.hypot(pa[i + 1][0] - pa[i][0], pa[i + 1][1] - pa[i][1], pa[i + 1][2] - pa[i][2]); lens.push(d); total += d; }
    return { pts: pa, lens, total };
  });
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(use.length * 3), 3));
  ctx.photons = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xffffff, size: 4, sizeAttenuation: false, transparent: true, depthWrite: false }));
  ctx.photons.frustumCulled = false; rg.add(ctx.photons);
}

function updatePhotons(time) {
  const phs = ctx.photons; if (!phs) return;
  phs.visible = S.photons;
  if (!S.photons || !ctx.rayGroup.visible) return;
  const arr = phs.geometry.attributes.position.array, P = ctx.photonPaths;
  for (let i = 0; i < P.length; i++) {
    const pa = P[i], u = ((time * 0.35 + (i * 0.6180339) % 1) % 1) * pa.total;
    let k = 0, acc = 0;
    while (k < pa.lens.length - 1 && u > acc + pa.lens[k]) { acc += pa.lens[k]; k++; }
    const tt = Math.min(1, (u - acc) / (pa.lens[k] || 1)), a = pa.pts[k], b = pa.pts[k + 1];
    arr[3 * i] = a[0] + (b[0] - a[0]) * tt; arr[3 * i + 1] = a[1] + (b[1] - a[1]) * tt; arr[3 * i + 2] = a[2] + (b[2] - a[2]) * tt;
  }
  phs.geometry.attributes.position.needsUpdate = true;
}

// ---------- 애니메이션 상태 ----------
function updateStruts(yS) {
  for (const s of ctx.struts) setCyl(s.m, s.a, new V3(s.dx, yS, s.dz));
}
function updateArm(T) {
  const A = ctx.arm, B = A.base, v = T.clone().sub(B), d = v.length() || 1e-6, dir = v.clone().divideScalar(d);
  const dd = Math.min(d, A.L1 + A.L2 - 1e-3), a = (A.L1 * A.L1 - A.L2 * A.L2 + dd * dd) / (2 * dd), h = Math.sqrt(Math.max(0, A.L1 * A.L1 - a * a));
  const pole = new V3(0, 1, 0); pole.addScaledVector(dir, -pole.dot(dir));
  if (pole.lengthSq() < 1e-4) pole.set(1, 0, 0); pole.normalize();
  const E = B.clone().addScaledVector(dir, a).addScaledVector(pole, h), tip = B.clone().addScaledVector(dir, dd);
  setCyl(A.l1, B, E); setCyl(A.l2, E, tip); A.j.position.copy(E); A.tip.position.copy(tip);
}
function applyT(t) {
  if (!tel) return;
  const mode = ctx.mode, Deff = ctx.Deff;
  // 태양전지판
  const pw = mode === 'B' ? 1 : ph(t, 0, 0.25);
  if (ctx.solarAnim) ctx.solarAnim(pw);
  // 차광막
  ctx.layers.forEach((m, i) => {
    const k = mode === 'B' ? 1 : 0.12 + 0.88 * ph(t, 0.28 + 0.04 * i, 0.55 + 0.04 * i);
    const b = m.userData.bs ?? (mode === 'C' ? Deff : 1);
    m.scale.set(b * k, 1, b * k);
  });
  // 부경 붐
  if (ctx.names) ctx.names.visible = S.names;
  if (ctx.ssh) ctx.ssh.visible = !!S.starshade;
  if (ctx.sec) {
    const bm = mode === 'B' ? 1 : ph(t, 0.15, 0.55), yS = lerp(ctx.yStow, ctx.opt.d, bm);
    ctx.sec.position.y = yS; updateStruts(yS); if (ctx.secName) ctx.secName.position.y = yS + 0.14 * Deff;
  }
  if (mode === 'B') { updateAssembly(t); }
  else {
    const w = mode === 'A' ? ph(t, 0.55, 0.9) : 1;
    if (ctx.wingR) { ctx.wingR.rotation.z = -(Math.PI / 2) * (1 - w); ctx.wingL.rotation.z = (Math.PI / 2) * (1 - w); }
    const al = ph(t, 0.86, 1.0);
    for (const gm of ctx.order) {
      const j = gm.userData.jit, b = gm.userData.base;
      gm.rotation.set(j[0] * (1 - al), 0, j[1] * (1 - al)); gm.position.y = b.y + j[2] * (1 - al);
    }
    if (!ctx.rayGroup) buildRays();
  }
  if (ctx.rayGroup) ctx.rayGroup.visible = S.rays && (mode === 'B' ? true : t > 0.985);
  if (ctx.nasa) {
    if (ctx.rayGroup) ctx.rayGroup.visible = false;               // 실제 모델 형상과 단순 광선 모델이 맞지 않아 숨김
    if (NASA.names) NASA.names.visible = S.names;
    NASA.foils.forEach(({ mesh, cq }, i) => {                       // 차양막 전개: 층별로 순차 확장
      const k = 0.08 + 0.92 * ph(t, 0.25 + 0.03 * i, 0.6 + 0.03 * i);
      mesh.scale.set(k, 1, k); mesh.position.set(cq[0] * (1 - k), 0, cq[2] * (1 - k));
    });
  }
}
function updateAssembly(t) {
  const N = ctx.order.length, tt = t * N, k = Math.min(N, Math.floor(tt)), fr = tt - k, A = ctx.arm;
  let tip = null;
  ctx.order.forEach((gm, i) => {
    const home = gm.userData.base;
    if (i < k) { gm.visible = true; gm.position.copy(home); gm.rotation.set(0, 0, 0); ctx.ghosts[i].visible = false; }
    else if (i === k && t > 0 && t < 1) {
      const e = 1 - Math.pow(1 - fr, 3), dir = new V3(home.x, 0, home.z); if (dir.lengthSq() < 1e-6) dir.set(1, 0, 0);
      dir.normalize().multiplyScalar(ctx.Deff * 0.9); dir.y = ctx.Deff * 0.5;
      gm.visible = true; gm.position.set(home.x + dir.x * (1 - e), home.y + dir.y * (1 - e), home.z + dir.z * (1 - e));
      gm.rotation.set(0, (1 - e) * Math.PI, (1 - e) * 0.6); ctx.ghosts[i].visible = true; tip = gm.position.clone();
    } else { gm.visible = false; ctx.ghosts[i].visible = true; }
  });
  if (!tip) tip = new V3(A.L1 * 0.35, A.L1 * 0.9, 0);
  updateArm(tip);
  ctx.count = k;
  if (k !== ctx.lastCount) { ctx.lastCount = k; buildRays(); }
}

// ---------- 통계 패널 ----------
const fmtM = kg => kg >= 1000 ? (kg / 1000).toFixed(1) + ' t' : Math.round(kg) + ' kg';
function updateStats() {
  const st = buildStats(S, ctx.segs, ctx.Deff, ctx.opt, ctx.rs), fit = fitCheck(S.mode, S, ctx.Deff, ctx.xh, st.N), o = ctx.opt;
  ctx.Aeff = st.Aeff;
  const rows = [
    ['분할거울', `${st.N}장 (${ctx.n}링)`],
    ['실제 구경(외접)', `${ctx.Deff.toFixed(2)} m`],
    ['주경 초점거리', `${ctx.f.toFixed(2)} m (f/${S.fn.toFixed(2)})`],
    ['유효 집광면적', `${st.Aeff.toFixed(1)} m²`],
    ['  JWST / 허블 대비', `${st.vsJWST.toFixed(2)}× / ${st.vsHubble.toFixed(1)}×`],
  ];
  if (o.cass) rows.push(['부경 지름', `${(2 * ctx.rs).toFixed(2)} m`], ['중앙 가림', `${(st.obsFrac * 100).toFixed(1)} %`], ['합성 초점비', `f/${st.fEff.toFixed(1)} (M=${o.M.toFixed(1)})`]);
  else rows.push(['중앙 가림', '없음 (오프액시스)']);
  rows.push(['회절 한계 1.22λ/D', `${st.mas.toFixed(1)} 밀리초각`], ['파면 정밀도(λ/14)', `${st.wfe.toFixed(0)} nm rms`]);
  if (S.mode === 'C') rows.push(['코로나그래프 대비', '≤10⁻¹⁰ (96×96 변형거울)'], ['파면 안정성 목표', '피코미터(pm)급'], ['열 안정성 목표', '~mK급 (ULE 유리, 약 20°C)'], ['질량 한도(공개 자료)', `≤${S.massCap || 25} t`]);
  if (S.korea) rows.push(['3.5mST 백서 제원', '3.5 m · 육각 18장 · f/4.5 · 0.2~1.5 µm · 시야 10′~30′ · 10년 · 3 m 페어링'],
    ['  코로나그래프 목표(백서)', '원시 10⁻⁸ · 후처리 10⁻⁹ · IWA 3λ/D · OWA 20λ/D'], ['  궤도', 'L2 또는 지구궤도 (검토 중)']);
  if (S.jwst) rows.push(['실제 JWST 제원', '구경 6.5 m · 거울 18장 · 집광 25.4 m² · 차양막 21.2×14.2 m · 약 6.2 t']);
  if (ctx.shield) {
    const sh = sunshieldTemps(ctx.shield.nL), pubT = SHIELD_TYPES[ctx.shield.type].pubT;
    rows.push([`차양막 ${ctx.shield.nL}${pubT ? '단 온도(공개값)' : '겹 온도(개략 모델)'}`, (pubT || sh.T).map(t => t.toFixed(0)).join(' → ') + ' K'],
      ['  태양 흡수 → 망원경 쪽 방출', `${sh.qIn.toFixed(0)} → ${sh.qLeak < 0.1 ? (sh.qLeak * 1000).toFixed(1) + ' m' : sh.qLeak.toFixed(2) + ' '}W/m² (${(sh.qIn / sh.qLeak).toExponential(0)}배 감쇠)`]);
    if (S.korea) rows.push(['  (저궤도 참고)', '지구 적외선·알베도 미포함 — L2 기준 값']);
  }
  if (S.korea) {
    const lo = leoOrbit(S.leoH);
    rows.push([`저궤도 ${S.leoH} km`, `주기 ${lo.periodMin.toFixed(1)}분 · ${lo.vKms.toFixed(2)} km/s · 하루 ${lo.orbitsPerDay.toFixed(1)}바퀴`],
      ['  식(그림자) 최대 · 하늘 가림', `${lo.eclipseMin.toFixed(1)}분/궤도 · 지구가 하늘의 ${(lo.skyBlocked * 100).toFixed(0)}%`],
      ['  태양동기 궤도 경사', `${lo.ssoIncDeg.toFixed(1)}°`]);
  }
  rows.push(['전지판 면적 / 발전(개략)', `${ctx.solarArea.toFixed(1)} m² / ${(ctx.solarArea * 0.25).toFixed(1)} kW`]);
  rows.push(['거울 질량(개략)', fmtM(st.mMirror)], ['총 질량(개략)', fmtM(st.mTotal)]);
  let fitTxt, ok = fit.ok;
  if (fit.kind === 'fold') fitTxt = `접힘 폭 ${fit.width.toFixed(1)} m / 가용 ${fit.usable} m → ${ok ? '적합' : '초과'}`;
  else if (fit.kind === 'rigid') fitTxt = `비접힘 가정 폭 ${fit.width.toFixed(1)} m / ${fit.usable} m → ${ok ? '적합' : '초과(접이식 필요)'}`;
  else fitTxt = ok ? `모듈 ${fit.nPer}장/회 → 약 ${fit.launches}회 발사` : '분할거울이 적재함보다 큼';
  $('stats').innerHTML = '<table>' + rows.map(r => `<tr><td class="mu">${r[0]}</td><td>${r[1]}</td></tr>`).join('') +
    `<tr><td class="mu">발사체 적합</td><td class="${ok ? 'ok' : 'bad'}">${fitTxt}</td></tr></table>`;
  schedulePSF();
}


// ---------- 별 회절상(PSF) ----------
// 근거: Leboulleux 외 arXiv:2608.16479 (분할 오차 포락선 1.22·N·λ/D, N ≤ IWA 이면 수동 강건) ·
//       Sahoo 외 arXiv:2607.28393 (분할경 허용 오차 pm 수준). Fraunhofer 근사(동공 FFT)이며 코로나그래프는 포함하지 않음.
const PSF_N = 512, PSF_DPX = 160, PSF_HALF = 16;   // 격자, 동공 지름 픽셀, 표시 반경(λ/D)
let psfT = null, psfPerfect = { key: '', f: null };
const advOpen = () => !!($('advPsf')?.open || $('advBud')?.open);   // 고급 상자를 하나라도 펼쳤을 때만 계산
function schedulePSF() { clearTimeout(psfT); if (advOpen()) psfT = setTimeout(updatePSF, 140); }
const fmtOpd = nm => !isFinite(nm) ? '∞' : nm >= 1000 ? (nm / 1000).toFixed(1) + ' µm' : nm >= 1 ? nm.toFixed(nm < 10 ? 1 : 0) + ' nm' : nm >= 1e-3 ? (nm * 1000).toFixed(nm < 0.01 ? 1 : 0) + ' pm' : (nm * 1e6).toFixed(nm < 1e-5 ? 1 : 0) + ' fm';
function updatePSF() {
  if (!ctx.segs) return;
  const cv = $('psf'); if (!cv) return;
  const pisNm = Math.pow(10, S.pisLog) / 1000, ttNm = Math.pow(10, S.ttLog) / 1000;   // 슬라이더: 로그(pm)
  $('pisV').textContent = fmtOpd(pisNm); $('ttV').textContent = fmtOpd(ttNm);
  const segs = ctx.segs.map(g => ({ ...g, x: g.x - (ctx.opt.x0 || 0) }));   // 오프액시스는 동공 중심으로 되돌림
  const lamNm = S.lambda * 1000, hasStruts = !!ctx.opt.cass && S.struts;
  $('strutRow').style.display = ctx.opt.cass ? '' : 'none';
  const base = { N: PSF_N, Dpx: PSF_DPX, lambdaNm: lamNm, struts: hasStruts, strutW: Math.max(0.05, 0.015 * ctx.Deff) };
  const pup = makePupil(segs, S.seg, ctx.Deff, { ...base, pistonNm: pisNm, tiptiltNm: ttNm });
  const ab = psfFromPupil(pup, true);
  const key = [ctx.n, S.seg, S.hole, S.mode, hasStruts, ctx.Deff.toFixed(3)].join('|');
  if (psfPerfect.key !== key) psfPerfect = { key, f: psfFromPupil(pup, false) };
  const pf = psfPerfect.f;
  const IWA = S.iwa, OWA = S.korea ? 20 : 12, cor = coronagraphFromPupil(pup);   // 3.5mST 백서 OWA 20λ/D
  const cDZ = annulusMean(cor.img, PSF_N, PSF_DPX, IWA, OWA), cNear = annulusMean(cor.img, PSF_N, PSF_DPX, IWA, IWA + 1);
  $('iwaV').textContent = IWA.toFixed(1) + ' λ/D';
  // 그리기: 원시 PSF는 10⁻⁵~1, 코로나그래프 후는 (암부 평균 ×10⁻²)~(암부 평균 ×10⁴) 로그 스케일
  const showCor = S.psfMode === 'cor', src = showCor ? cor.img : ab.img;
  const lo = showCor ? Math.log10(Math.max(cDZ, 1e-30)) - 2 : -5, span = showCor ? 6 : 5;
  const W = 2 * Math.round(PSF_HALF * PSF_N / PSF_DPX) + 1, c0 = PSF_N / 2, h = (W - 1) / 2;
  cv.width = cv.height = W;
  const g = cv.getContext('2d'), im = g.createImageData(W, W);
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) {
    const v = src[(c0 + y - h) * PSF_N + (c0 + x - h)];
    const t = Math.min(1, Math.max(0, (Math.log10(v + 1e-30) - lo) / span)), o = 4 * (y * W + x);
    im.data[o] = 255 * Math.min(1, t * 2.2); im.data[o + 1] = 255 * Math.min(1, Math.max(0, t * 2.2 - 0.7)); im.data[o + 2] = 255 * Math.min(1, 0.25 + t * 1.2 - Math.max(0, t - 0.6) * 1.6); im.data[o + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  if (showCor) {   // 암부 경계(IWA, OWA) 표시
    const pxPer = PSF_N / PSF_DPX; g.strokeStyle = 'rgba(77,227,255,.7)'; g.lineWidth = 0.6;
    for (const r of [IWA, OWA]) { g.beginPath(); g.arc(h + 0.5, h + 0.5, r * pxPer, 0, 2 * Math.PI); g.stroke(); }
  }
  // 수치
  const r3 = radialMean(ab.img, PSF_N, PSF_DPX, 3), r10 = radialMean(ab.img, PSF_N, PSF_DPX, 10);
  const p3 = radialMean(pf.img, PSF_N, PSF_DPX, 3), p10 = radialMean(pf.img, PSF_N, PSF_DPX, 10);
  const tot = Math.hypot(pisNm, ttNm), N = segsAcross(ctx.n), env = envelopeRadius(ctx.n);
  const mar = Math.exp(-Math.pow(2 * Math.PI * tot / lamNm, 2));
  const lamD = S.lambda * 1e-6 / ctx.Deff * 206264806;   // λ/D (밀리초각)
  const ex = e => e < 1e-12 ? '< 10⁻¹²' : e.toExponential(1).replace('e-', '×10⁻').replace('e+', '×10');
  const rows = [
    ['Strehl 비 (계산)', `${ab.strehl.toFixed(3)}`],
    ['  Maréchal exp(−σ²) 근사', `${mar.toFixed(3)} (σ=${fmtOpd(tot)})`],
    ['λ/D (화면 반경 16λ/D)', `${lamD.toFixed(1)} 밀리초각`],
    ['무수차 PSF 3λ/D · 10λ/D', `${ex(p3)} · ${ex(p10)}`],
    ['오차 포함 3λ/D · 10λ/D', `${ex(r3)} · ${ex(r10)}`],
    ['코로나그래프 암부 평균 대비', `${ex(cDZ)} (${IWA.toFixed(1)}–${OWA} λ/D)`],
    ['  IWA 근처 대비', `${ex(cNear)} (${IWA.toFixed(1)}–${(IWA + 1).toFixed(1)} λ/D)`],
    ['  10⁻¹⁰ 달성 허용 오차(암부·IWA 근처)', tot > 0 ? `${fmtOpd(toleranceFor(tot, cDZ, 1e-10))} · ${fmtOpd(toleranceFor(tot, cNear, 1e-10))}` : '—'],
    ['지름 방향 분할 수 N', `${N}장 (링 ${ctx.n})`],
    ['분할 오차 포락선 첫 영점', `${env.toFixed(1)} λ/D`],
  ];
  const cls = { '코로나그래프 암부 평균 대비': cDZ <= 1e-10 ? 'ok' : 'bad', '지름 방향 분할 수 N': N <= IWA ? 'ok' : 'bad' };
  ctx.psf = { cDZ, tot, IWA, OWA, lamD };
  updateBudget();
  $('psfStats').innerHTML = '<table>' + rows.map(r => `<tr><td class="mu">${r[0]}</td><td class="${cls[r[0]] || ''}">${r[1]}</td></tr>`).join('') + '</table>' +
    `<p class="note">코로나그래프는 이상적 모델(Cavarroc 외 2006): 수차 없는 별빛은 완전히 지우고 위상 오차가 만든 스펙클만 남깁니다. 실제 APLC의 설계 바닥(~4×10⁻¹¹)·아포다이저 효과는 빠져 있어 낙관적입니다. 작은 오차에서 대비 ∝ σ²라 허용 오차는 현재 piston:tip/tilt 비율을 유지한 총 rms입니다. 초록 N = 지름 방향 분할 수가 IWA 이하(수동 강건).</p>` +
    `<p class="note">오차는 파면(OPD) rms, 분할거울마다 무작위(고정 시드). 비교 기준: JWST 분할 정렬 ≈50 nm rms, HWO 코로나그래프 목표 ≈10 pm rms.
 코로나그래프 없는 원시 PSF입니다. 논문 가이드: 목표 IWA(λ/D) ≥ N이면 분할 오차가 암부 대비에 덜 새어 듭니다(IWA 3λ/D → 지름 방향 3장·총 7장 이하가 유리, <a href="https://arxiv.org/abs/2608.16479" target="_blank" rel="noopener" style="color:var(--ac2)">arXiv 2608.16479</a>). 분할 수가 많을수록 허용 오차가 엄격해지고, 같은 가이드 기준 85장→7장이면 piston 허용치가 최대 약 2배 완화됩니다. 분할경 허용 오차는 pm 수준입니다(<a href="https://arxiv.org/abs/2607.28393" target="_blank" rel="noopener" style="color:var(--ac2)">arXiv 2607.28393</a>).</p>`;
}



// ---------- 차양막 층별 온도 색 ----------
// sunshieldTemps(): 1차원 복사 평형, JWST 공개 온도(태양쪽 ~383 K, 망원경쪽 ~36 K)에 맞춘 보정 모델
const tempColor = T => { const t = Math.min(1, Math.max(0, Math.log(T / 30) / Math.log(400 / 30))); return new THREE.Color().setHSL(0.66 * (1 - t), 0.9, 0.34 + 0.14 * t); };
function applyShieldTemp() {
  const sh = ctx.shield; if (!sh) return;
  const T = SHIELD_TYPES[sh.type].pubT || sunshieldTemps(sh.nL).T, on = !!S.shieldTemp;
  while (sh.lbl.children.length) sh.lbl.remove(sh.lbl.children[0]);
  sh.lbl.visible = on;
  sh.meshes.forEach((m, i) => {
    if (!m.isMesh) return;
    const Ti = T[sh.nL - 1 - i];   // ctx.layers[0] = 망원경 쪽, T[0] = 태양 쪽
    if (!m.userData.mat0) m.userData.mat0 = m.material;
    if (on) {
      const c = tempColor(Ti);
      m.material = new THREE.MeshStandardMaterial({ color: c, emissive: c.clone().multiplyScalar(0.22), metalness: 0.2, roughness: 0.6, side: THREE.DoubleSide });
      const lb = label(`${sh.nL - i}층 ${Ti.toFixed(0)} K (${(Ti - 273.15).toFixed(0)}°C)`, 0.06 * ctx.Deff);
      lb.position.set(sh.side[0] + 0.3 * ctx.Deff, sh.meshes[0].position.y - i * 0.22 * ctx.Deff, sh.side[1]); sh.lbl.add(lb);   // 층 간격이 좁아 라벨은 벌려 놓음
    } else m.material = m.userData.mat0;
  });
}


// ---------- 차양막 비교표 ----------
function renderShieldCmp() {
  const R = SHIELD_TYPES;
  const items = [['mission', '미션'], ['layers', '구성'], ['size', '크기'], ['film', '재료'], ['coat', '코팅'], ['deploy', '전개'], ['mass', '질량'], ['target', '식히는 대상'], ['pub', '온도(공개)']];
  const model = k => R[k].pubT ? '(같은 모델 적용 안 함)' : sunshieldTemps(R[k].n).T.map(t => t.toFixed(0)).join(' → ') + ' K';
  $('shCmp').innerHTML = Object.keys(R).map(k => `<div class="shcard${k === S.shieldType ? ' on' : ''}"><b>${R[k].name}</b><dl>` +
    items.map(([id, nm]) => `<dt>${nm}</dt><dd>${R[k].rows[id]}</dd>`).join('') + `<dt>이 시뮬 모델</dt><dd>${model(k)}</dd></dl></div>`).join('') +
    `<p class="note">출처: JWST — NASA 공개값, 층 면적은 <a href="https://arxiv.org/abs/2405.12394" target="_blank" rel="noopener" style="color:var(--ac2)">SALTUS 논문</a> 표 10 · SALTUS — Harding 외 arXiv 2405.12394 · V-groove — <a href="https://arxiv.org/abs/2608.13185" target="_blank" rel="noopener" style="color:var(--ac2)">FOSSIL 열 구조(arXiv 2608.13185)</a>. "이 시뮬 모델"은 JWST 공개 온도에 맞춘 1차원 복사 모델에 겹 수만 바꾼 값입니다. SALTUS가 2겹으로 &lt;45 K를 내는 것은 모델에 없는 요소(주경을 태양선과 약 90°로 두는 자세, 층당 ~1,000 m²의 넓은 면적, 2 m 층 간격의 측면 방열, 뒷면 고방출 코팅) 덕분이라 모델값(2층 ~209 K)과 다릅니다. V-groove는 태양이 아니라 293 K 위성 본체를 막는 구조라 공개값만 표시합니다.</p>`;
}

// ---------- 지구형 행성 검출 예산 ----------
// Turyshev(arXiv:2609.32023) 단순화: 두 롤 ADI, 지구형 행성(Ag 0.2, 1 au, 위상각 90°), 탐색 30,000곳·오경보 10⁻³·검출 99%.
// 원시 대비 = 설계 바닥 3×10⁻¹⁰(논문 Table VI 가시광) + 정적 분할 오차(위 PSF). 롤 간 안정도 = 결맞음 혼합 + 2차 항.
const C_FLOOR = 3e-10, C_FLOOR_K = 1e-8;   // HWO형 설계 바닥(Turyshev Table VI) / 3.5mST 원시 대비 목표(백서)
function updateBudget() {
  const P = ctx.psf; if (!P || !$('budStats')) return;
  const tH = Math.pow(10, S.tLog), drNm = Math.pow(10, S.drLog) * 1e-6;   // 드리프트 슬라이더: 로그(fm)
  $('dpcV').textContent = S.dPc.toFixed(1) + ' pc'; $('thV').textContent = tH.toFixed(0) + ' h';
  $('drV').textContent = fmtOpd(drNm); $('tauV').textContent = S.tau.toFixed(2);
  const tg = targetStar(S.budTarget), dPc = tg.d ?? S.dPc;
  $('dpcRow').style.display = tg.d ? 'none' : '';
  const lamNm = S.lambda * 1000, cRaw = (S.korea ? C_FLOOR_K : C_FLOOR) + P.cDZ;
  const cD = P.cDZ * (drNm / P.tot) ** 2, cStab = contrastStability(cRaw, cD);
  const base = { area: ctx.Aeff || Math.PI * ctx.Deff ** 2 / 4, lamNm, dLamNm: 0.2 * lamNm, dPc, aAU: tg.aAU, Tstar: tg.T, RstarM: tg.RstarM, cRaw, cStab, tauCore: S.tau, tWallH: tH, fp: tg.fp };
  const b = detectionBudget(base), dLim = limitingDistance({ ...base, dPc: 5 });
  const cdA = -cRaw + Math.sqrt(cRaw * cRaw + b.cStabAllow ** 2), drA = P.cDZ > 0 ? P.tot * Math.sqrt(cdA / P.cDZ) : Infinity;
  const iwaMas = P.IWA * P.lamD, owaMas = P.OWA * P.lamD, geoOk = b.sepMas >= iwaMas && b.sepMas <= owaMas;
  const ppt = v => (v * 1e12).toFixed(v * 1e12 < 10 ? 2 : 1) + ' ppt';
  const rows = [
    ['행성 밝기비 (지구형, 직각 위상)', `${b.fp.toExponential(2)} (Ag ${tg.Ag}, a ${tg.aAU.toFixed(2)} AU)`],
    ['행성 이격 / 암부 범위', `${b.sepMas.toFixed(0)} mas / ${iwaMas.toFixed(0)}–${owaMas.toFixed(0)} mas`, geoOk ? 'ok' : 'bad'],
    ['별 · 행성 전자율', `${b.Cstar.toExponential(2)} · ${b.Cp.toFixed(3)} e⁻/s`],
    ['원시 대비 (설계 바닥 + 정적 오차)', `${cRaw.toExponential(2)}`],
    ['IWA 밖에 들어오는 최대 거리', `${iwaHorizonPc(tg.aAU, P.IWA, lamNm, ctx.Deff).toFixed(1)} pc (현재 ${dPc.toFixed(2)} pc)`],
    ['필요 FRN (99% 검출)', ppt(b.frnReq)],
    ['FRN 광자 · 스펙클 · 보정', `${ppt(b.frnPh)} · ${ppt(b.frnSt)} · 3.5`],
    ['FRN 합계 → 검출 확률', `${ppt(b.frn)} → ${(b.power * 100).toFixed(1)} %`, b.power >= 0.99 ? 'ok' : 'bad'],
    ['99% 검출 필요 관측 시간', isFinite(b.tReqH) ? `${b.tReqH.toFixed(b.tReqH < 10 ? 1 : 0)} h` : '불가 (안정도·보정 천장)', b.tReqH <= tH ? 'ok' : 'bad'],
    ['허용 대비 안정도 · 드리프트', b.specAllow > 0 ? `${b.cStabAllow.toExponential(2)} · ${fmtOpd(drA)}` : '없음 (광자+보정만으로 초과)'],
    [`${tH.toFixed(0)} h 한계 거리 (광학 잔여 0)`, tg.d ? '— (고정 대상)' : `${dLim.toFixed(1)} pc`],
  ];
  const verdict = !geoOk ? ['bad', '행성이 별빛을 가리는 범위(암부) 밖에 있어 볼 수 없습니다. 더 가까운 별을 고르거나 IWA를 바꿔 보세요.']
    : b.power >= 0.99 ? ['ok', `이 관측 시간(${tH.toFixed(0)}시간)이면 찾을 수 있습니다.`]
    : isFinite(b.tReqH) ? ['bad', `지금 시간으로는 부족합니다. 약 ${b.tReqH.toFixed(b.tReqH < 10 ? 1 : 0)}시간 보면 찾을 수 있습니다.`]
    : ['bad', '남은 별빛의 흔들림(거울 정렬 오차 드리프트)이나 보정 잡음이 커서 시간을 늘려도 찾기 어렵습니다. 드리프트를 줄이거나 다른 별을 골라 보세요.'];
  $('budStats').innerHTML = `<p class="verdict ${verdict[0]}">판정: ${verdict[1]}</p>` + '<table>' + rows.map(r => `<tr><td class="mu">${r[0]}</td><td class="${r[2] || ''}">${r[1]}</td></tr>`).join('') + '</table>' +
    `<p class="note">근거: <a href="https://arxiv.org/abs/2609.32023" target="_blank" rel="noopener" style="color:var(--ac2)">Turyshev, arXiv 2609.32023</a>의 해석적 모델을 단순화했습니다. 61 Cyg A·ε Ind A는 <a href="https://arxiv.org/abs/2609.02577" target="_blank" rel="noopener" style="color:var(--ac2)">3.5mST 백서 III</a>의 지구형(EEID) 대상(대비 1.2×10⁻⁹·6.9×10⁻¹⁰ 재현)이며 별 반지름은 흑체 근사입니다. 한국형 모드는 원시 대비를 백서 목표 10⁻⁸로 둡니다(6 m·500 nm·5 pc 기준값 재현: 광자 FRN 8.80 ppt, 한계 거리 8.11 pc). 대역 20%, QE 0.2, 하늘 배경 0.02 e⁻/s, 보정 잔차 3.5 ppt, 측광 구멍 0.7λ/D. 집광면적은 위 설계의 유효 집광면적을 씁니다. 드리프트→대비 안정도는 이상적 코로나그래프와 무작위 위상 결맞음 혼합(√(2·C_raw·c_d + c_d²)) 근사라 실제 자코비안 기반 값과 다를 수 있습니다. 스펙클 FRN은 롤 사이에 평균되지 않는 잔여로 봅니다(보수적).</p>`;
}

// ---------- UI ----------
const CONTROLS = [
  ['D', '주경 구경 목표', 'm', 2, 30, 0.1, 'ABC'],
  ['seg', '분할거울 크기(대변)', 'm', 0.5, 3, 0.05, 'ABC'],
  ['fn', '주경 초점비 f/', '', 0.8, 3, 0.05, 'ABC'],
  ['delta', '부경 위치(초점 앞)', '%', 3, 30, 0.5, 'AB'],
  ['bfrac', '초점면 깊이(×D)', '', 0.15, 0.9, 0.01, 'AB'],
  ['lambda', '관측 파장(로그)', 'µm', -0.8, 1.5, 0.01, 'ABC', true],
  ['dens', '거울 면밀도', 'kg/m²', 8, 120, 1, 'ABC'],
];
const CE = {};
(function buildPanel() {
  const pn = $('panel');
  pn.innerHTML = '<h2>설계 파라미터</h2><div id="sl"></div>' +
    '<div class="chk" id="holeRow"><input type="checkbox" id="hole"><label for="hole">중앙 분할거울 제외(부경 광로)</label></div>' +
    '<div class="row" id="eacRow"><label><span>HWO 구성(EAC)</span></label><select id="eac"></select></div>' +
    '<div class="row"><label><span>발사체</span></label><select id="launcher"></select></div>' +
    '<div class="chk" id="ssRow"><input type="checkbox" id="ssh"><label for="ssh">스타셰이드(별도 우주선) 표시</label></div>' +
    '<h2>성능 요약</h2><div id="stats"></div>' +
    '<h2>표시</h2><div class="chk"><input type="checkbox" id="rays" checked><label for="rays">광선 경로</label></div>' +
    '<div class="chk" id="nasaRow"><input type="checkbox" id="nasa" checked><label for="nasa">NASA 실제 3D 모델 사용 <span id="nasaSt" style="color:var(--mu)"></span></label></div>' +
    '<div class="row"><label><span>저궤도 고도 (🛰 LEO 뷰·한국형)</span><span id="leoHV"></span></label><input type="range" id="leoH" min="350" max="1200" step="10"></div>' +
    '<div class="chk"><input type="checkbox" id="shT"><label for="shT">차양막 층별 온도 색 표시</label></div>' +
    '<div class="chk"><input type="checkbox" id="names" checked><label for="names">부품 이름</label></div>' +
    '<div class="chk"><input type="checkbox" id="phot" checked><label for="phot">광자 애니메이션</label></div>' +
    '<div class="chk"><input type="checkbox" id="auto"><label for="auto">자동 회전</label></div>' +
    '<p class="note">근거(최신 논문): <a href="https://arxiv.org/abs/2601.11803" target="_blank" rel="noopener" style="color:var(--ac2)">HWO 개념·기술 성숙(arXiv 2601.11803)</a> · <a href="https://arxiv.org/abs/2607.02773" target="_blank" rel="noopener" style="color:var(--ac2)">HWO 기술개발계획(arXiv 2607.02773)</a> · <a href="https://arxiv.org/abs/2507.02812" target="_blank" rel="noopener" style="color:var(--ac2)">액체거울 FLUTE(arXiv 2507.02812)</a></p><p class="note">거울 크기×링 수로 구경이 결정됩니다(최대 약 400장). 질량·적합성은 공개 자료 기반 개략치이며 구조·열·광학 정밀 해석을 대체하지 않습니다. 광학계는 카세그레인 단순화(JWST의 3반사경 아님).</p>' +
    '<h2>더 알아보기 (고급 계산)</h2><p class="easy">아래 상자를 누르면 펼쳐집니다. 접혀 있는 동안은 계산하지 않아 화면이 가볍습니다.</p>' +
    '<details class="adv" id="advPsf"><summary>⭐ 별빛 번짐 무늬 · 거울 정렬 오차</summary><p class="easy">거울 조각들이 아주 조금씩 어긋나면 별 사진이 얼마나 흐려지는지, 별빛을 가리는 장치(코로나그래프)를 쓰면 별 바로 옆이 얼마나 어두워지는지 어림 계산합니다. 용어: PSF = 별 하나가 찍힌 모양, piston·tip/tilt = 거울 조각의 높이·기울기 어긋남, IWA = 별빛을 가리는 원의 반지름, λ/D = 망원경이 구분할 수 있는 가장 작은 각도, Strehl = 1에 가까울수록 선명.</p>' +
    '<canvas id="psf" width="206" height="206" style="width:100%;max-width:260px;aspect-ratio:1;display:block;margin:0 auto;background:#000;border:1px solid var(--bd);border-radius:8px"></canvas>' +
    '<div class="row"><label><span>표시</span></label><select id="psfMode"><option value="raw">원시 PSF (코로나그래프 없음)</option><option value="cor">코로나그래프 후 (이상적, 별빛 제거)</option></select></div>' +
    '<div class="row"><label><span>코로나그래프 IWA (초점면 마스크 반경)</span><span id="iwaV"></span></label><input type="range" id="iwa" min="2" max="8" step="0.1"></div>' +
    '<div class="row"><label><span>분할 거울 piston 오차 (rms)</span><span id="pisV"></span></label><input type="range" id="pis" min="0" max="6" step="0.05"></div>' +
    '<div class="row"><label><span>분할 거울 tip/tilt 오차 (rms)</span><span id="ttV"></span></label><input type="range" id="tt" min="0" max="6" step="0.05"></div>' +
    '<div class="chk" id="strutRow"><input type="checkbox" id="strutC" checked><label for="strutC">부경 지지대 3개 그림자 포함</label></div>' +
    '<div id="psfStats"></div>' +
    '</details>' +
    '<details class="adv" id="advBud"><summary>🌍 지구 닮은 행성 찾기 어림 계산</summary><p class="easy">별 옆의 아주 어두운 행성을 이 망원경으로 찾을 수 있는지, 몇 시간 봐야 하는지 어림 계산합니다. 용어: ppt = 1조분의 1, FRN = 행성 밝기를 잴 때 섞이는 잡음(작을수록 좋음), τ = 행성 빛이 검출기까지 살아남는 비율, mas = 1000분의 1 각초.</p>' +
    '<div class="row"><label><span>대상 별</span></label><select id="budT"></select></div>' +
    '<div class="row" id="dpcRow"><label><span>별까지 거리 (태양형 별)</span><span id="dpcV"></span></label><input type="range" id="dpc" min="2" max="20" step="0.1"></div>' +
    '<div class="row"><label><span>관측 시간 (전체, 가동률 80%)</span><span id="thV"></span></label><input type="range" id="th" min="1" max="3" step="0.01"></div>' +
    '<div class="row"><label><span>롤 사이 분할경 드리프트 (rms)</span><span id="drV"></span></label><input type="range" id="dr" min="0" max="4" step="0.05"></div>' +
    '<div class="row"><label><span>행성 코어 처리율 τ</span><span id="tauV"></span></label><input type="range" id="tau" min="0.02" max="0.4" step="0.01"></div>' +
    '<div id="budStats"></div>' +
    '</details>' +
    '<details class="adv" id="advSh"><summary>☂ 차양막 비교 (최근 논문 vs 제임스웹)</summary>' +
    '<div class="row"><label><span>3D 차양막 종류 (제임스웹 실사 제외)</span></label><select id="shType"></select></div>' +
    '<div id="shCmp"></div>' +
    '</details>';
  const sl = $('sl');
  for (const [k, name, unit, min, max, step, modes, lg] of CONTROLS) {
    const row = document.createElement('div'); row.className = 'row';
    row.innerHTML = `<label><span>${name}</span><span></span></label><input type="range" min="${min}" max="${max}" step="${step}">`;
    const inp = row.querySelector('input'), val = row.querySelector('label span:last-child');
    CE[k] = { row, inp, val, unit, modes, lg, step };
    inp.addEventListener('input', () => {
      S[k] = lg ? Math.pow(10, +inp.value) : +inp.value; showVal(k);
      if (k === 'lambda' || k === 'dens') updateStats(); else scheduleBuild();
    });
    sl.appendChild(row);
  }
  const ls = $('launcher');
  for (const [k, v] of Object.entries(LAUNCHERS)) ls.add(new Option(v.name, k));
  ls.addEventListener('change', () => { S.launcher = ls.value; updateStats(); });
  const es = $('eac');
  for (const k in EACS) { const o = document.createElement('option'); o.value = k; o.textContent = EACS[k].name; es.appendChild(o); }
  es.addEventListener('change', () => { Object.assign(S, EACS[es.value], { eac: es.value }); syncUI(); build(false); });
  $('pis').value = S.pisLog; $('tt').value = S.ttLog; $('iwa').value = S.iwa; $('psfMode').value = S.psfMode;
  for (const id of ['advPsf', 'advBud']) $(id).addEventListener('toggle', () => schedulePSF());
  for (const k in TARGETS) $('budT').add(new Option(TARGETS[k].name, k));
  $('budT').value = S.budTarget; $('budT').addEventListener('change', e => { S.budTarget = e.target.value; updateBudget(); });
  for (const [id, k] of [['dpc', 'dPc'], ['th', 'tLog'], ['dr', 'drLog'], ['tau', 'tau']]) {
    $(id).value = S[k]; $(id).addEventListener('input', e => { S[k] = +e.target.value; updateBudget(); });
  }
  $('iwa').addEventListener('input', e => { S.iwa = +e.target.value; schedulePSF(); });
  $('psfMode').addEventListener('change', e => { S.psfMode = e.target.value; schedulePSF(); });
  $('pis').addEventListener('input', e => { S.pisLog = +e.target.value; schedulePSF(); });
  $('tt').addEventListener('input', e => { S.ttLog = +e.target.value; schedulePSF(); });
  $('strutC').addEventListener('change', e => { S.struts = e.target.checked; schedulePSF(); });
  $('ssh').addEventListener('change', e => { S.starshade = e.target.checked; });
  $('hole').addEventListener('change', e => { S.hole = e.target.checked; scheduleBuild(); });
  $('rays').addEventListener('change', e => { S.rays = e.target.checked; });
  $('phot').addEventListener('change', e => { S.photons = e.target.checked; });
  $('names').addEventListener('change', e => { S.names = e.target.checked; });
  $('leoH').value = S.leoH; $('leoHV').textContent = S.leoH + ' km';
  $('leoH').addEventListener('input', e => { S.leoH = +e.target.value; $('leoHV').textContent = S.leoH + ' km'; if (leoS) buildLEOOrbit(); updateStats(); });
  for (const k in SHIELD_TYPES) $('shType').add(new Option(SHIELD_TYPES[k].name, k));
  $('shType').value = S.shieldType; $('shType').addEventListener('change', e => { S.shieldType = e.target.value; build(false); renderShieldCmp(); });
  renderShieldCmp();
  $('shT').addEventListener('change', e => { S.shieldTemp = e.target.checked; applyShieldTemp(); });
  $('nasa').addEventListener('change', e => { S.nasa = e.target.checked; build(false); });
  $('auto').addEventListener('change', e => { S.auto = e.target.checked; });
})();
function showVal(k) {
  const c = CE[k], v = S[k];
  c.val.textContent = (k === 'lambda' ? v.toFixed(2) : c.step < 0.1 ? v.toFixed(2) : c.step >= 1 ? v.toFixed(0) : v.toFixed(1)) + (c.unit ? ' ' + c.unit : '');
}
function syncUI() {
  for (const k in CE) {
    const c = CE[k]; c.row.style.display = c.modes.includes(S.mode) ? '' : 'none';
    c.inp.value = c.lg ? Math.log10(S[k]) : S[k]; showVal(k);
  }
  $('hole').checked = S.hole; $('holeRow').style.display = S.mode === 'C' ? 'none' : '';
  $('launcher').value = S.launcher; $('eac').value = S.eac || 'eac1'; $('eacRow').style.display = S.mode === 'C' ? '' : 'none'; $('ssRow').style.display = S.mode === 'C' ? '' : 'none'; $('ssh').checked = !!S.starshade;
  $('nasaRow').style.display = S.jwst ? '' : 'none'; $('nasa').checked = !!S.nasa; $('nasaSt').textContent = NASA.state === 'fail' ? '(불러오기 실패 → 근사 모델)' : NASA.state === 'loading' ? '(불러오는 중…)' : '';
  $('info').innerHTML = INFO[infoKey()]; $('info').style.display = '';
  document.querySelectorAll('.tab[data-m]').forEach(b => b.classList.toggle('on', b.dataset.m === infoKey()));
  $('tlab').textContent = S.mode === 'B' ? '조립 진행' : '전개 진행';
}
let bt = null;
function scheduleBuild() { clearTimeout(bt); bt = setTimeout(() => { build(false); }, 120); }
function setMode(m) {
  const mm = (m === 'J' || m === 'K') ? 'A' : m;
  Object.assign(S, PRESETS[mm], m === 'K' ? KOREA : {}, { mode: mm, jwst: m === 'J', korea: m === 'K', t: 0, playing: true });
  S.iwa = m === 'K' ? 3 : 3.5; S.budTarget = m === 'K' ? 'cyg61A' : 'sun';
  if ($('iwa')) { $('iwa').value = S.iwa; $('budT').value = S.budTarget; }
  syncUI(); build(); syncBar();
}
const tabs = $('tabs');
for (const m of ['A', 'B', 'C', 'J', 'K']) {
  const b = document.createElement('button'); b.className = 'tab'; b.dataset.m = m;
  b.textContent = `${MODE_NAME[m]} (${MODE_SUB[m]})`; b.onclick = () => setMode(m); tabs.appendChild(b);
}
const eb = document.createElement('button'); eb.className = 'btn'; eb.textContent = '🌍 지구에서 본 심우주';
const lb = document.createElement('button'); lb.className = 'btn'; lb.textContent = '🛰 저궤도(LEO)';
const ib = document.createElement('button'); ib.className = 'btn'; ib.textContent = 'ⓘ 설명';
function toggleView(v) { setView(S.view === v ? 'tel' : v); eb.classList.toggle('on', S.view === 'earth'); lb.classList.toggle('on', S.view === 'leo'); }
eb.onclick = () => toggleView('earth'); lb.onclick = () => toggleView('leo');
ib.onclick = () => { const i = $('info'); i.style.display = i.style.display === 'none' ? '' : 'none'; };
{ const sep = document.createElement('span'); sep.className = 'sep'; sep.title = '왼쪽: 망원경 종류 · 오른쪽: 보기 전환'; tabs.appendChild(sep); }
tabs.appendChild(eb); tabs.appendChild(lb); tabs.appendChild(ib);
$('gear').onclick = () => $('panel').classList.toggle('hide');
if (window.innerWidth < 760) $('panel').classList.add('hide');
$('play').onclick = () => { $('info').style.display = 'none'; if (S.t >= 1) S.t = 0; S.playing = !S.playing; syncBar(); };
$('tl').addEventListener('input', e => { S.t = +e.target.value / 1000; S.playing = false; syncBar(); });
function syncBar() {
  $('tl').value = Math.round(S.t * 1000); $('play').textContent = S.playing ? '⏸ 일시정지' : (S.t >= 1 ? '↺ 다시' : '▶ 재생');
  const extra = S.mode === 'B' && ctx.order ? ` ${ctx.count || 0}/${ctx.order.length}` : ` ${Math.round(S.t * 100)}%`;
  $('tlab').textContent = (S.mode === 'B' ? '조립' : '전개') + extra;
}

// ---------- 이름표·절차적 텍스처 (지구·구름: 저궤도 뷰에서 사용) ----------
const L2X = 16;   // "지구에서 본 심우주" 뷰에서 망원경(L2)을 두는 거리 (축척 아님)
function label(text, sc = 1) {
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 128;
  const x = cv.getContext('2d'); x.font = 'bold 44px "Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif';
  x.fillStyle = '#e6ecf8'; x.textAlign = 'center'; x.fillText(text, 512, 76);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthTest: false }));
  sp.scale.set(16 * sc, 2 * sc, 1); return sp;
}
// 3D 값 잡음 (구면 좌표에서 샘플링해 경도 이음매가 없음)
const hash3 = (x, y, z) => { let h = (x * 374761393 + y * 668265263 + z * 1274126177) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const L = (a, b, t) => a + (b - a) * t;
  return L(L(L(hash3(xi, yi, zi), hash3(xi + 1, yi, zi), u), L(hash3(xi, yi + 1, zi), hash3(xi + 1, yi + 1, zi), u), v),
           L(L(hash3(xi, yi, zi + 1), hash3(xi + 1, yi, zi + 1), u), L(hash3(xi, yi + 1, zi + 1), hash3(xi + 1, yi + 1, zi + 1), u), v), w);
}
const fbm3 = (x, y, z, o = 5) => { let a = 0.5, f = 1, s = 0, n = 0; for (let i = 0; i < o; i++) { s += a * vnoise(x * f, y * f, z * f); n += a; a *= 0.5; f *= 2.03; } return s / n; };
function sphereTex(w, h, fn, alpha) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const x = cv.getContext('2d');
  const im = x.createImageData(w, h), d = im.data;
  for (let j = 0; j < h; j++) {
    const lat = (0.5 - (j + 0.5) / h) * Math.PI, cl = Math.cos(lat), sl = Math.sin(lat);
    for (let i = 0; i < w; i++) {
      const lon = ((i + 0.5) / w * 2 - 1) * Math.PI, c = fn(cl * Math.cos(lon), sl, cl * Math.sin(lon), lat), k = 4 * (j * w + i);
      d[k] = c[0]; d[k + 1] = c[1]; d[k + 2] = c[2]; d[k + 3] = alpha ? c[3] : 255;
    }
  }
  x.putImageData(im, 0, 0);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
function earthTexture() {
  return sphereTex(768, 384, (x, y, z, lat) => {
    const h = fbm3(x * 2.1 + 7, y * 2.1, z * 2.1, 6), al = Math.abs(lat) * 180 / Math.PI, sea = 0.52;
    let c;
    if (h > sea) {
      const m = fbm3(x * 3.3 + 20, y * 3.3, z * 3.3, 4), e = (h - sea) / (1 - sea);
      const hot = Math.max(0, 1 - al / 45);
      c = mix([44, 98, 46], [196, 168, 106], Math.min(1, Math.max(0, (0.55 - m) * 4 * hot + 0.0)));          // 숲 ↔ 사막
      if (al > 52) c = mix(c, [150, 160, 140], Math.min(1, (al - 52) / 20));                              // 아한대
      c = mix(c, [122, 104, 84], Math.min(1, e * 2.2));                                                    // 산지
      if (e > 0.55) c = mix(c, [235, 238, 242], Math.min(1, (e - 0.55) * 3));
    } else {
      const dp = (sea - h) / sea;
      c = mix([30, 100, 170], [6, 28, 78], Math.min(1, dp * 2.4));
    }
    if (al > 74) c = mix(c, [240, 244, 250], Math.min(1, (al - 74) / 6));                                  // 극지방 얼음
    return c;
  });
}
function cloudTexture() {
  return sphereTex(512, 256, (x, y, z) => {
    const n = fbm3(x * 3.2 + 40, y * 5.5, z * 3.2, 5), a = Math.min(1, Math.max(0, (n - 0.5) * 4.2));
    return [255, 255, 255, a * 235];
  }, true);
}
function applyHolderEarthView() {   // 지구에서 본 심우주: 망원경을 L2 쪽(축척 아님)에 작게
  const sc = (S.view === 'earth' ? 5.5 : 3.4) / ctx.extent; holder.scale.setScalar(sc); holder.rotation.set(0, 0, -Math.PI / 2);
}
function updateEarthView(time) {   // 망원경이 L2 헤일로 궤도를 따라 천천히 돎(보기용)
  const a = time * 0.35; holder.position.set(L2X, 1.5 * Math.sin(a), 3.2 * Math.cos(a));
}
// ---------- 지구에서 본 심우주 뷰 ----------
// 지구 표면(관측자)에서 anti-태양 방향(+x)으로 바라본 모습: 달 · L2의 망원경 · 먼 천체 순서로 거리감을 보여 줌 (축척 아님)
const ed = new THREE.Group(); ed.visible = false; scene.add(ed);
const EDIR = (az, el, R) => { const a = az * Math.PI / 180, e = el * Math.PI / 180; return new V3(R * Math.cos(e) * Math.cos(a), R * Math.sin(e), R * Math.cos(e) * Math.sin(a)); };
function galaxyTex(hue) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const x = cv.getContext('2d');
  const g = x.createRadialGradient(64, 64, 2, 64, 64, 60);
  g.addColorStop(0, `hsla(${hue},90%,95%,1)`); g.addColorStop(0.18, `hsla(${hue},85%,75%,.75)`); g.addColorStop(0.6, `hsla(${hue},80%,50%,.18)`); g.addColorStop(1, `hsla(${hue},80%,40%,0)`);
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(cv);
}
(function buildEarthView() {
  const earth = new THREE.Mesh(new THREE.SphereGeometry(3, 64, 40), new THREE.MeshStandardMaterial({ color: 0x2a62c4, roughness: 0.85 })); earth.position.set(0, -3, 0);
  const atm = new THREE.Mesh(new THREE.SphereGeometry(3.07, 64, 40), new THREE.MeshBasicMaterial({ color: 0x7ab8ff, transparent: true, opacity: 0.22, side: THREE.BackSide })); atm.position.copy(earth.position);
  const moon = new THREE.Mesh(new THREE.SphereGeometry(0.55, 32, 20), new THREE.MeshStandardMaterial({ color: 0xb9b6ae, roughness: 1 })); moon.position.set(4.2, 3.4, -4.4);
  const lm = label('달 (약 38만 km)', 0.45); lm.position.set(4.2, 4.5, -4.4);
  const lt = label('제임스웹(JWST) · L2 · 지구 반대편 약 150만 km', 0.6); lt.position.set(L2X, -2.4, 0);
  ed.add(earth, atm, moon, lm, lt);
  const T = [
    { az: -26, el: 9, hue: 35, name: '외계행성계 (수십~수백 광년)', R: 260 },
    { az: 9, el: 15, hue: 210, name: '이웃 은하 (수백만~수억 광년)', R: 300 },
    { az: 28, el: 4, hue: 0, name: '초기우주 은하 (약 130억 광년)', R: 340 },
  ];
  T.forEach((t, i) => {
    const p = EDIR(t.az, t.el, t.R);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: galaxyTex(t.hue), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    sp.scale.set(26 + i * 8, 26 + i * 8, 1); sp.position.copy(p);
    const lb = label(t.name, 6.2); lb.position.set(p.x, p.y - 22, p.z);
    ed.add(sp, lb);
    if (i === 1) {
      const sight = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new V3(L2X, 0, 0), p]), new THREE.LineDashedMaterial({ color: 0x4de3ff, dashSize: 6, gapSize: 4 }));
      sight.computeLineDistances(); ed.add(sight);
    }
  });
  const ground = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new V3(0, 0.02, 0), new V3(L2X, 0, 0)]), new THREE.LineDashedMaterial({ color: 0x556080, dashSize: 0.6, gapSize: 0.4 }));
  ground.computeLineDistances(); ed.add(ground);
})();
const INFO_VIEW = {
  leo: '<b>저궤도(LEO) 배치</b> — 한국형 우주망원경 제안안처럼 지구 상공 수백 km를 약 90분마다 도는 배치입니다. 지구와 궤도 고도는 실제 축척이고 망원경만 크게 그렸습니다. 태양동기·정오–자정 궤도면이라 매 바퀴 지구 그림자(식)를 지납니다(회색 구간). 망원경은 천정(지구 반대쪽)을 향합니다. ⚙의 "저궤도 고도"로 고도를 바꿀 수 있습니다. L2와 달리 지구가 하늘의 약 30%를 가리고, 낮·밤이 바뀔 때마다 열 환경이 크게 변합니다.',
  earth: '<b>지구에서 본 심우주</b> — 지구 표면에 서서 태양 반대쪽(밤하늘)을 바라본 시점입니다. 가까운 달 → 150만 km 밖 L2의 제임스웹 망원경(JWST 실사 모델) → 수십 광년~130억 광년 천체 순으로 거리가 멀어집니다. 점선 하늘색은 망원경의 관측 시선입니다. 드래그=둘러보기, 핀치/휠=시야각 확대·축소. (거리는 축척 아님)',
};
function setView(v) {
  S.view = v;
  $('bar').style.display = v === 'tel' ? '' : 'none';   // 전개 막대는 망원경 화면에서만 의미 있음
  if (v === 'earth') { if (!S.jwst) { S.prevMode = S.mode; setMode('J'); } S.t = 1; S.playing = false; syncBar(); }
  else if (S.prevMode && S.jwst) { const pm = S.prevMode; S.prevMode = null; if (v === 'tel') setMode(pm); }
  if (v === 'leo' && !leoS) buildLEO();
  ed.visible = v === 'earth'; leo.visible = v === 'leo'; controls.look = v === 'earth';
  if (leoS) leoS.info.style.display = v === 'leo' ? '' : 'none';
  camera.fov = 45; camera.updateProjectionMatrix();
  if (v === 'earth') {
    applyHolderEarthView(); sun.position.set(-1, 0.3, 0.4); camera.near = 0.05;
    camera.position.set(0, 0.25, 0); controls.target.set(1, 0.42, 0); camera.fov = 50; camera.updateProjectionMatrix();
    $('info').innerHTML = INFO_VIEW.earth; $('info').style.display = '';
  } else if (v === 'leo') {
    applyHolderLEO(); sun.position.set(-1, 0, 0); camera.near = 0.05;
    const k = camera.aspect < 1 ? Math.max(1, 0.85 / camera.aspect) : 1;   // 세로 화면(휴대폰)은 더 멀리
    camera.position.set(-9 * k, 10 * k, 32 * k); controls.target.set(-3, -0.5, 0); camera.updateProjectionMatrix();
    $('info').innerHTML = INFO_VIEW.leo; $('info').style.display = '';
  } else { sun.position.set(0.4, 1, 0.7); fitCamera(); $('info').innerHTML = INFO[infoKey()]; }
}


// ---------- 저궤도(LEO) 뷰 ----------
// 지구 반지름·궤도 고도는 실제 축척(장면 단위 LEO_R = 6378 km), 망원경만 과장. 태양은 −x, 궤도면은 태양 방향을 포함(β = 0).
const leo = new THREE.Group(); leo.visible = false; scene.add(leo);
const LEO_R = 6, LEO_VIS_S = 24;   // 지구 반지름(장면 단위), 화면상 한 바퀴 시간(초)
let leoS = null;
function leoPos(th, a) {   // 궤도 위치: 승교점 = 태양 방향(−x 쪽 시작), 경사 i(태양동기)
  const inc = leoOrbit(S.leoH).ssoIncDeg * Math.PI / 180;
  return new V3(-a * Math.cos(th), a * Math.sin(th) * Math.sin(inc), a * Math.sin(th) * Math.cos(inc));
}
function buildLEOOrbit() {
  if (leoS.orbit) { leo.remove(leoS.orbit); leoS.orbit.traverse(o => o.geometry && o.geometry.dispose()); }
  const o = leoOrbit(S.leoH), a = LEO_R * o.a / R_E, g = new THREE.Group(), N = 240;
  let seg = [], lit = null;
  const flush = () => { if (seg.length > 1) g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(seg), new THREE.LineBasicMaterial({ color: lit ? 0x4de3ff : 0x5a6178, transparent: true, opacity: lit ? 0.9 : 0.7 }))); };
  for (let i = 0; i <= N; i++) {
    const p = leoPos(i / N * 2 * Math.PI, a), l = !(p.x > 0 && Math.hypot(p.y, p.z) < LEO_R);   // 원통 그림자(+x 쪽)
    if (lit !== null && l !== lit) { seg.push(p); flush(); seg = [p]; } else seg.push(p);
    lit = l;
  }
  flush();
  const lab = label(`궤도 고도 ${S.leoH} km · 주기 ${o.periodMin.toFixed(1)}분 · 경사 ${o.ssoIncDeg.toFixed(1)}°`, 0.9);
  lab.position.set(LEO_R * 0.9, -a - 3.9, 0); g.add(lab);
  leoS.orbit = g; leoS.a = a; leo.add(g);
}
function buildLEO() {
  leoS = {};
  // 환경맵 조명을 줄여 태양(−x) 쪽만 밝게 — 낮·밤 경계가 식 구간과 맞도록
  const earth = new THREE.Mesh(new THREE.SphereGeometry(LEO_R, 128, 80), new THREE.MeshStandardMaterial({ map: earthTexture(), roughness: 0.78, metalness: 0, envMapIntensity: 0.04 }));
  const cloud = new THREE.Mesh(new THREE.SphereGeometry(LEO_R * 1.006, 128, 80), new THREE.MeshStandardMaterial({ map: cloudTexture(), transparent: true, depthWrite: false, roughness: 1, envMapIntensity: 0.04 }));
  const atm = new THREE.Mesh(new THREE.SphereGeometry(LEO_R * 1.03, 64, 40), new THREE.ShaderMaterial({
    transparent: true, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false,
    vertexShader: 'varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'varying vec3 vN; void main(){ float i = pow(max(0.0, 0.62 - dot(vN, vec3(0.0,0.0,1.0))), 3.0); gl_FragColor = vec4(0.32,0.58,1.0,1.0) * i * 2.0; }',
  }));
  leoS.earth = earth; leoS.cloud = cloud;
  const sunDir = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new V3(-LEO_R * 3.2, 0, 0), new V3(-LEO_R * 1.25, 0, 0)]), new THREE.LineDashedMaterial({ color: 0xffb84d, dashSize: 0.6, gapSize: 0.4 }));
  sunDir.computeLineDistances();
  const ls = label('← 태양 방향', 0.8); ls.position.set(-LEO_R * 2.6, 0.9, 0);
  const le = label('지구 (궤도 고도와 같은 실제 축척)', 0.9); le.position.set(-LEO_R * 0.9, -LEO_R - 1.4, 0);
  const lt = label('망원경 (크기 과장)', 0.6); leoS.lt = lt;
  leo.add(earth, cloud, atm, sunDir, ls, le, lt);
  buildLEOOrbit();
  leoS.info = document.createElement('div');
  leoS.info.style.cssText = 'position:fixed;left:16px;bottom:calc(74px + env(safe-area-inset-bottom,0px));background:var(--pn);border:1px solid var(--bd);border-radius:10px;padding:6px 10px;font-size:12px;color:var(--ink2);display:none';
  document.body.appendChild(leoS.info);
}
function applyHolderLEO() { holder.scale.setScalar(1.3 / ctx.extent); holder.rotation.set(0, 0, 0); }
const Y_UP = new V3(0, 1, 0);
function updateLEO(time) {
  if (!leoS) return;
  const o = leoOrbit(S.leoH), ph = (time / LEO_VIS_S) % 1, p = leoPos(ph * 2 * Math.PI, leoS.a);
  holder.position.copy(p); holder.quaternion.setFromUnitVectors(Y_UP, p.clone().normalize());   // 망원경 시선 = 천정
  leoS.lt.position.copy(p.clone().multiplyScalar(1 + 1.6 / leoS.a));
  leoS.earth.rotation.y = time * 0.02; leoS.cloud.rotation.y = time * 0.024;
  const dark = p.x > 0 && Math.hypot(p.y, p.z) < LEO_R, m = ph * o.periodMin;
  leoS.info.textContent = `궤도 시각 ${m.toFixed(0)} / ${o.periodMin.toFixed(1)}분 · ${dark ? '🌑 지구 그림자(식) — 전력은 배터리' : '☀ 햇빛'} · 화면에서는 한 바퀴 ${LEO_VIS_S}초로 빠르게 표시`;
}

// ---------- 루프 ----------
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize); resize();
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.max(0, Math.min(0.1, (now - last) / 1000)); last = now;   // 첫 프레임 시각이 앞설 때 음수가 되지 않게
  if (S.playing) {
    S.t = Math.min(1, S.t + dt / DUR[S.mode]);
    if (S.t >= 1) S.playing = false;
  }
  syncBar();
  applyT(S.t);
  if (S.view === 'leo') updateLEO(now / 1000); else if (S.view === 'earth') updateEarthView(now / 1000);
  updatePhotons(now / 1000);
  controls.autoRotate = S.auto; controls.update();
  renderer.render(scene, camera);
}
// 주소에 ?mode=J (제임스웹) · K (한국형) 등을 붙이면 그 모드로 시작 (태양계 페이지의 제임스웹 카드에서 사용)
const startMode = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('mode') : null;
if (startMode && MODE_NAME[startMode]) setMode(startMode); else { syncUI(); build(); }
requestAnimationFrame(frame);
