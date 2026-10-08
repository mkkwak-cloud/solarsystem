// 다누리 위치: data/danuri.json (JPL Horizons, 달 중심 ICRF 방향, km·km/s, 15분 간격)을 3차 에르미트 보간으로 채운다.
const J2000_JD = 2440587.5; // 1970-01-01 (유닉스 시각 -> 율리우스일)
export const jdOfMs = (ms) => ms / 86400000 + J2000_JD;

export async function loadDanuri() {
  const j = await (await fetch('data/danuri.json')).json();
  const stepDays = j.step_min / 1440;
  const first = j.jd0, last = j.jd0 + (j.count - 1) * stepDays;
  const h = j.step_min * 60; // 초
  // 달 중심 위치(km)와 속도(km/s). 범위 밖이면 null
  function at(jd, out = { r: [0, 0, 0], v: [0, 0, 0] }) {
    if (jd < first || jd > last) return null;
    const f = (jd - first) / stepDays;
    const i = Math.min(Math.floor(f), j.count - 2), s = f - i;
    const s2 = s * s, s3 = s2 * s;
    const h00 = 2 * s3 - 3 * s2 + 1, h10 = s3 - 2 * s2 + s, h01 = -2 * s3 + 3 * s2, h11 = s3 - s2;
    const d00 = 6 * s2 - 6 * s, d10 = 3 * s2 - 4 * s + 1, d01 = -6 * s2 + 6 * s, d11 = 3 * s2 - 2 * s;
    for (let k = 0; k < 3; k++) {
      const p0 = j.pos[i][k], p1 = j.pos[i + 1][k], m0 = j.vel[i][k] * h, m1 = j.vel[i + 1][k] * h;
      out.r[k] = h00 * p0 + h10 * m0 + h01 * p1 + h11 * m1;
      out.v[k] = (d00 * p0 + d10 * m0 + d01 * p1 + d11 * m1) / h; // 보간식의 미분 = 속도
    }
    return out;
  }
  return { at, firstJd: first, lastJd: last, stepDays };
}
