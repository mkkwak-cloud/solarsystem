// JPL Horizons API 에서 보이저 1호(-31)·2호(-32)의 태양 중심 위치·속도를 받아 data/voyager.json 으로 저장한다.
// 개발 단계에서 1회 실행 (브라우저에서 Horizons 를 직접 부르면 CORS 로 막히므로 미리 받아 내장한다).  사용: node scripts/fetch-voyager.js
// 좌표: 황도 J2000(ICRF), 단위 AU 와 AU/일.  간격 30일 (월 단위에 가까움).
// 발사 직후부터 2060-01-01 까지: Horizons 가 가진 궤적 중 현재(2026년) 이후는 추적 자료로 이어 예측한 값이다.
import { writeFileSync, mkdirSync } from 'node:fs';

const HORIZONS = 'https://ssd.jpl.nasa.gov/api/horizons.api';
const STEP_DAYS = 30;
const STOP = '2060-01-01';
// Horizons 가 궤적을 시작하는 날(발사 직후). 발사일: 1호 1977-09-05, 2호 1977-08-20
const CRAFT = [
  { id: 'voyager1', cmd: '-31', name_ko: '보이저 1호', start: '1977-09-07', launch: '1977-09-05' },
  { id: 'voyager2', cmd: '-32', name_ko: '보이저 2호', start: '1977-08-22', launch: '1977-08-20' },
];

const out = [];
for (const c of CRAFT) {
  const p = new URLSearchParams({
    format: 'json', COMMAND: `'${c.cmd}'`, OBJ_DATA: "'NO'", MAKE_EPHEM: "'YES'", EPHEM_TYPE: "'VECTORS'", CENTER: "'500@10'",
    START_TIME: `'${c.start}'`, STOP_TIME: `'${STOP}'`, STEP_SIZE: `'${STEP_DAYS} d'`,
    REF_PLANE: "'ECLIPTIC'", REF_SYSTEM: "'ICRF'", OUT_UNITS: "'AU-D'", VEC_TABLE: "'2'", CSV_FORMAT: "'YES'",
  });
  const j = await (await fetch(`${HORIZONS}?${p}`)).json();
  const m = j.result.match(/\$\$SOE([\s\S]*?)\$\$EOE/);
  if (!m) { console.log('FAIL', c.id, j.result.slice(0, 300)); process.exitCode = 1; continue; }
  const rows = m[1].trim().split('\n').map((l) => l.split(',').map((s) => s.trim()));
  // 열: JDTDB, 날짜, X, Y, Z, VX, VY, VZ
  const pos = rows.map((r) => [r[2], r[3], r[4]].map((v) => Number(Number(v).toPrecision(10))));
  const vel = rows.map((r) => [r[5], r[6], r[7]].map((v) => Number(Number(v).toPrecision(10))));
  const jd0 = Number(rows[0][0]);
  const jdN = Number(rows.at(-1)[0]);
  // 간격이 일정한지 확인
  for (let i = 1; i < rows.length; i++) if (Math.abs(Number(rows[i][0]) - jd0 - i * STEP_DAYS) > 1e-6) throw new Error(`${c.id}: ${i}번째 시각 간격이 일정하지 않음`);
  const r0 = Math.hypot(...pos.at(-1));
  out.push({ id: c.id, horizons_id: c.cmd, name_ko: c.name_ko, launch: c.launch, jd0, step_days: STEP_DAYS, jd_end: jdN, count: rows.length, pos, vel });
  console.log('OK  ', c.id, `${rows.length}행  ${rows[0][1]} ~ ${rows.at(-1)[1]}  마지막 태양 거리 ${r0.toFixed(1)} AU`);
}

mkdirSync('data', { recursive: true });
writeFileSync('data/voyager.json', JSON.stringify({
  _sources: { api: HORIZONS, retrieved: new Date().toISOString().slice(0, 10), targets: 'Voyager 1 (-31), Voyager 2 (-32)' },
  _note: '황도 J2000(ICRF) 태양 중심, AU·AU/일, 30일 간격. 위치·속도로 3차 에르미트 보간한다. 마지막 시각 이후는 마지막 속도로 직선 외삽(화면에 "외삽값" 표기).',
  craft: out,
}));
console.log(`저장: data/voyager.json  ${out.length}/${CRAFT.length}개`);
