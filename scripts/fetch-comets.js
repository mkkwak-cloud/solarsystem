// JPL SBDB API 에서 혜성 21개(주기 12 + 장주기·대혜성 8 + 성간천체 3I/ATLAS)의 궤도요소를 받아 data/comets.json 으로 저장한다.
// 개발 단계에서 1회 실행 (실행 시점에는 인터넷 불필요).  사용: node scripts/fetch-comets.js
// 요소는 황도 J2000 기준: q(근일점 거리 AU), e(이심률), i, om(승교점 경도), w(근일점 인수), tp(근일점 통과 JD, TDB)
import { writeFileSync, mkdirSync } from 'node:fs';

const SBDB = 'https://ssd-api.jpl.nasa.gov/sbdb.api';

// [SBDB 검색어, 화면 이름, 종류]
const LIST = [
  ['1P', '핼리', 'periodic'], ['2P', '엔케', 'periodic'], ['9P', '템펠 1', 'periodic'], ['12P', '폰스-브룩스', 'periodic'],
  ['17P', '홈스', 'periodic'], ['19P', '보렐리', 'periodic'], ['21P', '자코비니-지너', 'periodic'], ['55P', '템펠-터틀', 'periodic'],
  ['67P', '추류모프-게라시멘코', 'periodic'], ['81P', '빌트 2', 'periodic'], ['103P', '하틀리 2', 'periodic'], ['109P', '스위프트-터틀', 'periodic'],
  ['C/1995 O1', '헤일-밥', 'longperiod'], ['C/1996 B2', '햐쿠타케', 'longperiod'], ['C/2006 P1', '맥노트', 'longperiod'],
  ['C/2011 W3', '러브조이', 'longperiod'], ['C/2012 S1', '아이손', 'longperiod'], ['C/2020 F3', '니오와이즈', 'longperiod'],
  ['C/2023 A3', '쯔진산-아틀라스', 'longperiod'], ['C/2013 A1', '사이딩 스프링', 'longperiod'],
  ['3I', '3I/ATLAS', 'interstellar'],
];

const failed = [];
const comets = [];
for (const [sstr, nameKo, kind] of LIST) {
  try {
    const url = `${SBDB}?sstr=${encodeURIComponent(sstr)}&full-prec=1`;
    const res = await fetch(url);
    const j = await res.json();
    if (!j.orbit) throw new Error(j.message || `응답에 orbit 없음 (HTTP ${res.status})`);
    const el = Object.fromEntries(j.orbit.elements.map((x) => [x.name, Number(x.value)]));
    for (const k of ['e', 'q', 'i', 'om', 'w', 'tp']) if (!Number.isFinite(el[k])) throw new Error(`요소 ${k} 없음`);
    comets.push({
      id: sstr.replace(/[^A-Za-z0-9]+/g, '').toLowerCase(),
      query: sstr, name_ko: nameKo, fullname: j.object.fullname.trim(), kind,
      e: el.e, q_au: el.q, i_deg: el.i, node_deg: el.om, w_deg: el.w, tp_jd: el.tp,
      a_au: Number.isFinite(el.a) ? el.a : null, period_yr: Number.isFinite(el.per) ? el.per / 365.25 : null,
      epoch_jd: Number(j.orbit.epoch), orbit_id: j.orbit.orbit_id, solution_date: j.orbit.soln_date ?? null,
    });
    console.log('OK  ', sstr.padEnd(10), j.object.fullname.trim().padEnd(40), `e=${el.e.toFixed(5)} q=${el.q.toFixed(4)} tp=${el.tp}`);
  } catch (err) {
    failed.push(`${sstr}: ${err.message}`);
    console.log('FAIL', sstr, err.message);
  }
}

mkdirSync('data', { recursive: true });
writeFileSync('data/comets.json', JSON.stringify({
  _sources: { api: SBDB, retrieved: new Date().toISOString().slice(0, 10) },
  _note: '황도 J2000 기준 궤도요소(JPL SBDB 현재 최적 해). 케플러 계산이라 근일점에서 멀수록, 해의 기준일에서 멀수록 오차가 커진다. 비중력 효과는 반영하지 않음.',
  comets,
}, null, 1));
console.log(`\n저장: data/comets.json  ${comets.length}/${LIST.length}개`);
if (failed.length) { console.log('조회 실패:'); failed.forEach((f) => console.log(' -', f)); process.exitCode = 1; }
