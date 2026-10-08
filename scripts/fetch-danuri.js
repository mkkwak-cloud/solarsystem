// JPL Horizons 에서 다누리(KPLO, 번호 -155)의 달 중심 위치·속도를 받아 data/danuri.json 으로 저장한다.
// 사용: node scripts/fetch-danuri.js   (Horizons 에 있는 마지막 날은 2027-05-06. 기간 상수를 바꿔 다시 받을 수 있다)
// 좌표: 지구 적도 기준 J2000(ICRF) 방향, 달 중심, km 와 km/s. 간격 15분. 페이지가 3차 에르미트 보간으로 사이를 채운다.
import { writeFileSync } from 'node:fs';

const START = '2026-09-01', STOP = '2027-05-06 12:00', STEP_MIN = 15;
const rows = [];
let cur = new Date(START + 'T00:00:00Z');
const stop = new Date(STOP.replace(' ', 'T') + ':00Z');
while (cur < stop) {
  const next = new Date(Math.min(cur.getTime() + 40 * 86400000, stop.getTime()));
  const f = (d) => d.toISOString().slice(0, 16).replace('T', ' ');
  const p = new URLSearchParams({
    format: 'json', COMMAND: "'-155'", OBJ_DATA: "'NO'", MAKE_EPHEM: "'YES'", EPHEM_TYPE: "'VECTORS'", CENTER: "'500@301'",
    START_TIME: `'${f(cur)}'`, STOP_TIME: `'${f(next)}'`, STEP_SIZE: `'${STEP_MIN} m'`, REF_PLANE: "'FRAME'", REF_SYSTEM: "'ICRF'",
    OUT_UNITS: "'KM-S'", VEC_TABLE: "'2'", CSV_FORMAT: "'YES'",
  });
  const j = await (await fetch('https://ssd.jpl.nasa.gov/api/horizons.api?' + p)).json();
  const m = j.result.match(/\$\$SOE([\s\S]*?)\$\$EOE/);
  if (!m) throw new Error(j.result.slice(-400));
  const part = m[1].trim().split('\n').map((l) => l.split(',').map((s) => s.trim()));
  for (const r of part) {
    const jd = Number(r[0]);
    if (rows.length && jd <= rows.at(-1)[0] + 1e-6) continue; // 구간 이음새 중복 제거
    rows.push([jd, ...r.slice(2, 8).map(Number)]);
  }
  console.log('받음', f(cur), '~', f(next), rows.length);
  cur = next;
}
const jd0 = rows[0][0];
for (let i = 1; i < rows.length; i++) if (Math.abs(rows[i][0] - jd0 - i * STEP_MIN / 1440) > 1e-5) throw new Error(`${i}번째 시각 간격이 일정하지 않음`);
const r2 = (v) => Math.round(v * 100) / 100, r5 = (v) => Math.round(v * 1e5) / 1e5;
writeFileSync('data/danuri.json', JSON.stringify({
  horizons_id: '-155', center: 'Moon(500@301)', frame: 'ICRF equatorial', units: 'km, km/s', jd0, step_min: STEP_MIN, count: rows.length,
  pos: rows.map((r) => [r2(r[1]), r2(r[2]), r2(r[3])]), vel: rows.map((r) => [r5(r[4]), r5(r[5]), r5(r[6])]),
}));
console.log('저장: data/danuri.json', rows.length, '행');
