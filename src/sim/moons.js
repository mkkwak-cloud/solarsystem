// 위성의 행성 중심 위치(실제 AU, 화면 좌표).
//  - 달: astronomy-engine GeoMoon, 목성 4대 위성: astronomy-engine JupiterMoons (정확도가 높아서 JPL 평균요소 대신 사용)
//  - 그 외: JPL Horizons 의 기준일(2026-10-06) 궤도요소 + 케플러 방정식. 기준일 부근에서 가장 정확한 어림값이다.
//    (JPL 평균요소 표는 검증에서 기준일에서 멀어지면 어긋나 쓰지 않았다. 이유는 scripts/fetch-moons.py 머리말 참고)
import { perifocal, toReferenceFrame } from './kepler.js';
import { geoMoonOffset, jupiterMoonOffset } from './ephemeris.js';

const DEG = Math.PI / 180;
const AU_KM = 149597870.7;

export async function loadMoonData(url = 'data/moons.json') {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
}

// 위성 정의에 계산용 값을 덧붙인다. (periodDays: 궤도선 샘플링용 공전 주기, gmEff: 속도 표시용 유효 중력상수)
export function prepareMoon(m) {
  const t = m.jpl_mean_table;
  m.periodDays = m.osc ? 360 / m.osc.U_rate_deg_per_day : t.P_days; // 엔진 계산 위성은 JPL 표의 주기(궤도선 길이용으로만 사용)
  const aKm = m.osc ? m.osc.a_km : t.a_km;
  const n = (2 * Math.PI) / (m.periodDays * 86400); // rad/s
  m.gmEff = n * n * Math.pow(aKm, 3);               // 케플러 제3법칙으로 맞춘 값 (km³/s²)
  return m;
}

// date: Date -> {x,y,z} 행성 중심 위치, 단위 AU, 화면 좌표(황도 기준)
// 궤도요소는 JPL Horizons 기준일 값이다. a, e, i, Ω, ω 는 고정하고 평균근점이각 M 만 맞춰 둔 속도로 진행시킨다.
// (스크립트 fetch-moons.py 의 설명 참고. 기준일에서 멀어질수록 위치 오차가 커진다.)
export function moonOffsetAU(m, date) {
  if (m.engine === 'GeoMoon') return geoMoonOffset(date);
  if (m.engine) return jupiterMoonOffset(m.engine, date);

  const o = m.osc;
  const t = date.getTime() / 86400000 + 2440587.5 - o.epoch_jd; // 기준일 이후 일수
  const M = (o.M_deg + o.U_rate_deg_per_day * t) * DEG;
  const p = perifocal(o.a_km / AU_KM, o.e, M);
  const r = toReferenceFrame(p, o.w_deg, o.i_deg, o.node_deg); // 황도 좌표 (x: 춘분점, z: 황도 북극)
  return { x: r.x, y: r.z, z: -r.y };
}

// 궤도선용: 한 주기를 n개 점으로 샘플링 (행성 중심, 실제 AU)
export function sampleMoonOrbit(m, date, n = 96) {
  const pts = [];
  const t0 = date.getTime();
  for (let i = 0; i < n; i++) pts.push(moonOffsetAU(m, new Date(t0 + (i / n) * m.periodDays * 86400000)));
  return pts;
}
