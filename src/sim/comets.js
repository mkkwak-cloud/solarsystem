// 혜성 위치 (data/comets.json 의 JPL SBDB 궤도요소 + 케플러). 태양 중심, 화면 좌표(황도 기준), 단위 AU.
import { orbitPosition, orbitCurve, semiMajorAxis, jdFromDate, dateFromJD } from './kepler.js';

export async function loadCometData(url = 'data/comets.json') {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
}

export function prepareComet(c) {
  c.el = { q: c.q_au, e: c.e, i: c.i_deg, node: c.node_deg, w: c.w_deg, tp: c.tp_jd };
  c.aAU = semiMajorAxis(c.el); // 쌍곡선은 음수
  c.perihelionDate = dateFromJD(c.tp_jd);
  return c;
}

// {x,y,z,r}
export function cometPositionAU(c, date) {
  const p = orbitPosition(c.el, jdFromDate(date));
  return { x: p.x, y: p.z, z: -p.y, r: p.r };
}

// 궤도선용 점들 (태양 거리 rmaxAU 이내 구간)
export function cometOrbitAU(c, rmaxAU) {
  return orbitCurve(c.el, rmaxAU).points.map((p) => ({ x: p.x, y: p.z, z: -p.y }));
}

// 소행성도 같은 형식(el: q, e, i, node, w, tp)이라 같은 계산을 쓴다.
export const smallBodyPositionAU = cometPositionAU;
export const smallBodyOrbitAU = cometOrbitAU;
export function prepareSmallBody(b) { return prepareComet(b); }
