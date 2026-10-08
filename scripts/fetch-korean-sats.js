// CelesTrak 에서 국내(소유국 SKOR) 위성 목록과 궤도 정보(TLE)를 받아 data/kr-sats.json 으로 저장한다.
// 사용: node scripts/fetch-korean-sats.js   (몇 주에 한 번 다시 돌리면 궤도 정보가 새로 바뀐다)
// 목록: https://celestrak.org/pub/satcat.csv (전체 위성 대장)  /  궤도: gp.php?CATNR=번호&FORMAT=tle
// 다누리(53365)는 지구 궤도 정보가 없어 여기서 빠지고, scripts/fetch-danuri.js 가 따로 받는다.
import { writeFileSync, mkdirSync } from 'node:fs';

function parseCsv(text) {
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line) continue;
    const cells = []; let cur = '', q = false;
    for (const ch of line) {
      if (ch === '"') q = !q;
      else if (ch === ',' && !q) { cells.push(cur); cur = ''; } else cur += ch;
    }
    cells.push(cur);
    rows.push(cells);
  }
  return rows;
}

const csv = await (await fetch('https://celestrak.org/pub/satcat.csv')).text();
const [head, ...rows] = parseCsv(csv);
const ix = Object.fromEntries(head.map((h, i) => [h, i]));
const pick = (r) => ({
  norad: Number(r[ix.NORAD_CAT_ID]), name: r[ix.OBJECT_NAME], intl: r[ix.OBJECT_ID], type: r[ix.OBJECT_TYPE],
  ops: r[ix.OPS_STATUS_CODE], owner: r[ix.OWNER], launch: r[ix.LAUNCH_DATE], site: r[ix.LAUNCH_SITE], decay: r[ix.DECAY_DATE],
});

// 국내 소유 + 아직 궤도에 있음 + 로켓 잔해·시험용 모형 제외. 누리호 5차(2026-10-07)는 소유국 표기가 늦을 수 있어 발사일로도 잡는다.
const NURI5_FROM = '2026-10-07';
const list = rows.map(pick).filter((s) =>
  (s.owner === 'SKOR' || (s.site === 'NSC' && s.launch >= NURI5_FROM)) &&
  !s.decay && s.norad !== 53365 &&
  !/R\/B|DEB|DUMMY/i.test(s.name) && s.type !== 'DEB' && s.type !== 'R/B');
console.log(`대상 ${list.length}개`);

const out = [];
for (const s of list) {
  let tle = null;
  try {
    const t = (await (await fetch(`https://celestrak.org/NORAD/elements/gp.php?CATNR=${s.norad}&FORMAT=tle`)).text()).trim().split(/\r?\n/);
    if (t.length >= 3 && t[1].startsWith('1 ')) tle = [t[1].trim(), t[2].trim()];
  } catch (e) { console.log('실패', s.norad, e.message); }
  out.push({ ...s, tle1: tle?.[0] ?? null, tle2: tle?.[1] ?? null });
  console.log(tle ? 'OK  ' : '없음', s.norad, s.name);
  await new Promise((r) => setTimeout(r, 250));
}
mkdirSync('data', { recursive: true });
writeFileSync('data/kr-sats.json', JSON.stringify({ fetched: new Date().toISOString(), source: 'CelesTrak SATCAT + GP(TLE)', sats: out }, null, 0));
console.log('저장: data/kr-sats.json');
