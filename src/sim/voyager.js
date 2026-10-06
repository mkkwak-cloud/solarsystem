// 보이저 위치: data/voyager.json (JPL Horizons, 30일 간격 위치·속도)을 3차 에르미트 보간한다.
// 마지막 시각 이후는 마지막 속도로 직선 외삽(extrapolated=true), 첫 시각 이전(발사 전)은 visible=false.
import { jdFromDate } from './kepler.js';

const AU_KM = 149597870.7;

export async function loadVoyagerData(url = 'data/voyager.json') {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
}

// 반환: { x, y, z (화면 좌표 AU), r (태양 거리 AU), speedKms, extrapolated, visible }
export function voyagerState(c, date) {
  const jd = jdFromDate(date);
  const step = c.step_days;
  const f = (jd - c.jd0) / step;
  let p, v, extrapolated = false;
  if (f < 0) return { visible: false };
  if (jd >= c.jd_end) {
    // 직선 외삽: 마지막 점 + 마지막 속도 × 경과 일수
    const n = c.count - 1, dt = jd - c.jd_end;
    p = c.pos[n].map((x, k) => x + c.vel[n][k] * dt);
    v = c.vel[n];
    extrapolated = dt > 0;
  } else {
    const i = Math.min(Math.floor(f), c.count - 2);
    const t = f - i, t2 = t * t, t3 = t2 * t;
    const h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t, h01 = -2 * t3 + 3 * t2, h11 = t3 - t2;
    const d00 = 6 * t2 - 6 * t, d10 = 3 * t2 - 4 * t + 1, d01 = -6 * t2 + 6 * t, d11 = 3 * t2 - 2 * t;
    const p0 = c.pos[i], p1 = c.pos[i + 1], v0 = c.vel[i], v1 = c.vel[i + 1];
    p = [0, 1, 2].map((k) => h00 * p0[k] + h10 * step * v0[k] + h01 * p1[k] + h11 * step * v1[k]);
    v = [0, 1, 2].map((k) => (d00 * p0[k] + d10 * step * v0[k] + d01 * p1[k] + d11 * step * v1[k]) / step);
  }
  const speedKms = (Math.hypot(v[0], v[1], v[2]) * AU_KM) / 86400;
  return { x: p[0], y: p[2], z: -p[1], r: Math.hypot(p[0], p[1], p[2]), speedKms, extrapolated, visible: true };
}

// 항적선용: 발사 후 현재(date)까지의 표본 점들 (화면 좌표 AU). 현재 위치는 호출한 쪽에서 덧붙인다.
export function voyagerTrail(c, date) {
  const jd = jdFromDate(date);
  const last = Math.min(Math.floor((jd - c.jd0) / c.step_days), c.count - 1);
  const pts = [];
  for (let i = 0; i <= last; i++) pts.push({ x: c.pos[i][0], y: c.pos[i][2], z: -c.pos[i][1] });
  return pts;
}
