// 우주망원경 스모크 테스트(전 모드·뷰 구동, 렌더 결과는 못 봄): node scripts/test-telescope-smoke.mjs
import fs from 'fs';
import os from 'os';
import path from 'path';
import { pathToFileURL } from 'url';
// ---- 최소 Three.js 스텁 (수학은 실제 구현, 렌더링은 무시) ----
class V3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  setScalar(s) { return this.set(s, s, s); }
  clone() { return new V3(this.x, this.y, this.z); }
  copy(v) { return this.set(v.x, v.y, v.z); }
  add(v) { return this.set(this.x + v.x, this.y + v.y, this.z + v.z); }
  sub(v) { return this.set(this.x - v.x, this.y - v.y, this.z - v.z); }
  subVectors(a, b) { return this.set(a.x - b.x, a.y - b.y, a.z - b.z); }
  addScaledVector(v, s) { return this.set(this.x + v.x * s, this.y + v.y * s, this.z + v.z * s); }
  multiplyScalar(s) { return this.set(this.x * s, this.y * s, this.z * s); }
  divideScalar(s) { return this.multiplyScalar(1 / s); }
  dot(v) { return this.x * v.x + this.y * v.y + this.z * v.z; }
  lengthSq() { return this.dot(this); }
  length() { return Math.sqrt(this.lengthSq()); }
  crossVectors(a, b) { return this.set(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x); }
  normalize() { const l = this.length() || 1; return this.divideScalar(l); }
}
class Obj {
  constructor() {
    this.position = new V3(); this.scale = new V3(1, 1, 1); this.children = []; this.visible = true; this.userData = {};
    this.rotation = { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } };
    this.quaternion = { setFromUnitVectors() { } };
  }
  add(...c) { for (const o of c) { if (o === undefined || o === null) throw new Error('add(undefined)'); this.children.push(o); } return this; }
  remove(c) { this.children = this.children.filter(o => o !== c); }
  computeLineDistances() { }
  lookAt() { }
  traverse(cb) { cb(this); for (const c of this.children) if (c.traverse) c.traverse(cb); }
}
class Geo {
  constructor() { this.attributes = {}; }
  computeVertexNormals() { } rotateX() { return this; } rotateY() { return this; } dispose() { } setIndex() { } computeLineDistances() { }
  setAttribute(n, a) { this.attributes[n] = a; return this; }
  setFromPoints() { return this; }
}
const generic = (...a) => ({ ...(typeof a[0] === 'object' ? a[0] : {}) });
const objs = ['Group', 'Mesh', 'Points', 'LineSegments', 'LineLoop', 'Line', 'Sprite'];
const geos = ['BufferGeometry', 'CylinderGeometry', 'SphereGeometry', 'BoxGeometry', 'CircleGeometry', 'ShapeGeometry', 'RingGeometry', 'PlaneGeometry'];
let renders = 0;
globalThis.__THREE = new Proxy({}, {
  get(_, k) {
    if (k === 'Vector3') return V3;
    if (k === 'Sprite') return class extends Obj { constructor(m) { super(); this.geometry = new Geo(); this.material = m; } };
    if (objs.includes(k)) return class extends Obj { constructor(g, m) { super(); this.geometry = g; this.material = m; } };
    if (geos.includes(k)) return Geo;
    if (k === 'Shape') return class { moveTo() { } lineTo() { } closePath() { } };
    if (k === 'BufferAttribute' || k === 'Float32BufferAttribute') return class { constructor(a) { this.array = a instanceof Float32Array ? a : new Float32Array(a); } };
    if (k === 'Box3') return class { setFromObject() { return this; } getSize() { return new V3(12, 14, 9); } getCenter() { return new V3(0, -1, 0); } };
    if (k === 'WebGLRenderer') return class { constructor() { this.domElement = {}; } setPixelRatio() { } setSize() { } render() { renders++; } };
    if (k === 'PMREMGenerator') return class { fromScene() { return { texture: {} }; } };
    if (k === 'Scene') return class extends Obj { };
    if (k === 'PerspectiveCamera') return class extends Obj { updateProjectionMatrix() { } setViewOffset() { } clearViewOffset() { } };
    if (k === 'DirectionalLight' || k === 'HemisphereLight') return class extends Obj { };
    if (k === 'Color') return class { multiplyScalar() { return this; } };
    if (k === 'CanvasTexture') return class { constructor(c) { this.image = c; this.repeat = { set() { } }; } };
    if (typeof k === 'string' && k.endsWith('Material')) return class { constructor(p) { Object.assign(this, p || {}); } };
    return 1;
  },
});
globalThis.__OC = class { constructor() { this.target = new V3(); } update() { } };
globalThis.__RE = class { };

// ---- 가짜 DOM ----
const els = {};
function el() {
  const e = { style: {}, dataset: {}, innerHTML: '', textContent: '', value: '', checked: false, handlers: {}, children: [],
    classList: { toggle() { }, add() { }, remove() { }, contains() { return false; } },
    addEventListener(ev, fn) { this.handlers[ev] = fn; }, appendChild(c) { this.children.push(c); }, add() { },
    getBoundingClientRect() { return { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 }; }, offsetWidth: 330,
    querySelector() { return el(); }, getContext() { return new Proxy({}, { get: (o, k) => (k in o ? o[k] : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => ({ addColorStop() { } })), set: (o, k, v) => { o[k] = v; return true; } }); } };
  return e;
}
globalThis.document = { body: { appendChild() { } }, getElementById: id => (els[id] ||= el()), createElement: () => el(), querySelectorAll: () => [] };
globalThis.Option = class { };
globalThis.window = { innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1, addEventListener() { } };
globalThis.performance = { now: () => 0 };
let rafFn = null; globalThis.requestAnimationFrame = fn => { rafFn = fn; };

// src/telescope/{calc,main}.js 를 실제 import 구조 그대로 임시 폴더에 복사해 실행 (three.js 만 위 스텁으로 바꿈).
// 파일을 합치지 않으므로, main.js 가 calc.js 에서 가져오기(import)를 빠뜨린 이름은 여기서 ReferenceError 로 잡힌다.
const root = new URL('../src/telescope/', import.meta.url);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'telescope-smoke-'));
fs.copyFileSync(new URL('calc.js', root), path.join(dir, 'calc.js'));
let main = fs.readFileSync(new URL('main.js', root), 'utf8');
if (!main.includes("THREE = await import('three');")) throw new Error('main.js 의 three 불러오기 줄을 찾지 못함');
main = main.replace("THREE = await import('three');", 'THREE = globalThis.__THREE;');
fs.writeFileSync(path.join(dir, 'main.mjs'), main + '\nglobalThis.__T = { S, setMode, setView, getCtx: () => ctx, applyT, build, frame, PRESETS };\n');
try { await import(pathToFileURL(path.join(dir, 'main.mjs')).href); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
const T = globalThis.__T;
let fails = 0;
const check = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } };
const strip = h => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

for (const m of ['A', 'B', 'C', 'J', 'K']) {
  T.setMode(m); T.S.playing = false;
  for (let t = 0; t <= 1.0001; t += 0.05) { T.S.t = Math.min(1, t); T.frame(1000 + t * 1000); }
  const c = T.getCtx();
  console.log(`[${m}] 분할거울 ${c.segs.length}, 광선경로 ${c.photonPaths.length}, 렌더 ${renders}회`);
  console.log('   ', strip(els.stats.innerHTML).slice(0, 380));
  check(c.photonPaths.length > 0, m + ' 광선 존재');
  check(c.rayGroup.visible, m + ' 완료 시 광선 표시');
  T.S.t = 0.3; T.frame(5000); check(m === 'B' || !c.rayGroup.visible, m + ' 전개 중 광선 숨김');
  // 파라미터 변경 시나리오
  for (const patch of [{ D: 12 }, { seg: 0.8 }, { fn: 2.2 }, { hole: false }, { D: 30, seg: 3 }, { lambda: 10 }, { shieldType: 'saltus', shieldTemp: true }, { shieldType: 'vgroove' }, { shieldType: 'jwst', shieldTemp: false }]) {
    Object.assign(T.S, patch); T.build(false); T.S.t = 1; T.frame(9000);
  }
  T.setView('leo'); T.frame(9150); T.frame(21000); T.setView('earth'); T.frame(9200); T.S.t = 0.4; T.build(false); T.frame(9300); T.setView('tel');
}
console.log(fails ? `\n실패 ${fails}건` : '\n스모크 테스트 통과');
process.exitCode = fails ? 1 : 0;
