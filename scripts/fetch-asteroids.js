// JPL SBDB API 에서 소행성·왜행성 9개의 궤도요소를 받아 data/asteroids.json 으로 저장한다 (개발 단계에서 1회 실행).
// 사용: node scripts/fetch-asteroids.js
// 요소는 황도 J2000 기준: q(근일점 거리 AU), e, i, om(승교점 경도), w(근일점 인수), tp(근일점 통과 JD, TDB)
import { writeFileSync, mkdirSync } from 'node:fs';

const SBDB = 'https://ssd-api.jpl.nasa.gov/sbdb.api';

// [id, SBDB 검색어, 화면 이름]
const LIST = [
  ['ceres', '1', '세레스'], ['vesta', '4', '베스타'], ['pallas', '2', '팔라스'], ['hygiea', '10', '히기에이아'],
  ['eros', '433', '에로스'], ['itokawa', '25143', '이토카와'], ['ryugu', '162173', '류구'], ['bennu', '101955', '베누'],
  ['pluto', '134340', '명왕성'],
];

const failed = [];
const asteroids = [];
for (const [id, sstr, nameKo] of LIST) {
  try {
    const res = await fetch(`${SBDB}?sstr=${encodeURIComponent(sstr)}&full-prec=1&phys-par=1`);
    const j = await res.json();
    if (!j.orbit) throw new Error(j.message || `응답에 orbit 없음 (HTTP ${res.status})`);
    const el = Object.fromEntries(j.orbit.elements.map((x) => [x.name, Number(x.value)]));
    for (const k of ['e', 'q', 'a', 'i', 'om', 'w', 'tp']) if (!Number.isFinite(el[k])) throw new Error(`요소 ${k} 없음`);
    const phys = Object.fromEntries((j.phys_par ?? []).map((x) => [x.name, x.value]));
    asteroids.push({
      id, query: sstr, name_ko: nameKo, fullname: j.object.fullname.trim(),
      e: el.e, q_au: el.q, a_au: el.a, i_deg: el.i, node_deg: el.om, w_deg: el.w, tp_jd: el.tp,
      period_yr: Number.isFinite(el.per) ? el.per / 365.25 : null,
      diameter_km: phys.diameter ? Number(phys.diameter) : null,
      epoch_jd: Number(j.orbit.epoch), orbit_id: j.orbit.orbit_id,
    });
    console.log('OK  ', id.padEnd(8), j.object.fullname.trim().padEnd(28), `a=${el.a.toFixed(4)} e=${el.e.toFixed(4)} i=${el.i.toFixed(2)} tp=${el.tp.toFixed(1)} D=${phys.diameter ?? '?'} km`);
  } catch (err) {
    failed.push(`${id}(${sstr}): ${err.message}`);
    console.log('FAIL', id, err.message);
  }
}

mkdirSync('data', { recursive: true });
writeFileSync('data/asteroids.json', JSON.stringify({
  _sources: { api: SBDB, retrieved: new Date().toISOString().slice(0, 10) },
  _note: '황도 J2000 기준 궤도요소(JPL SBDB 현재 최적 해). 케플러 계산이라 해의 기준일에서 멀수록 오차가 커진다.',
  asteroids,
}, null, 1));
console.log(`\n저장: data/asteroids.json  ${asteroids.length}/${LIST.length}개`);
if (failed.length) { console.log('조회 실패:'); failed.forEach((f) => console.log(' -', f)); process.exitCode = 1; }
