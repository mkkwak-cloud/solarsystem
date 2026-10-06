// 케플러 궤도 계산 (위성·소행성·혜성 공용). 타원, 쌍곡선, 거의 포물선 궤도를 모두 처리한다.
const DEG = Math.PI / 180;
const TWO_PI = Math.PI * 2;
export const GAUSS_K = 0.01720209895; // 태양 중력상수의 제곱근 (AU^1.5 / 일). GM_태양 = K² AU³/일²

// 단조 증가 함수 f 의 근을 구간 [lo, hi] 안에서 뉴턴법으로 찾는다. 뉴턴 걸음이 구간 밖이면 이분법으로 대신한다.
function bracketedNewton(f, fp, x0, lo, hi) {
  let x = Math.min(Math.max(x0, lo), hi);
  for (let k = 0; k < 200; k++) {
    const fx = f(x);
    if (fx > 0) hi = x; else lo = x;
    let nx = x - fx / fp(x);
    if (!(nx > lo && nx < hi)) nx = (lo + hi) / 2;
    if (Math.abs(nx - x) < 1e-14 * Math.max(1, Math.abs(x))) return nx;
    x = nx;
  }
  return x;
}

// 타원: M = E - e·sinE (M: 라디안). 이심률이 1 에 가까워도 수렴한다.
export function solveKepler(M, e) {
  M = ((M + Math.PI) % TWO_PI + TWO_PI) % TWO_PI - Math.PI; // -π ~ π
  return bracketedNewton(
    (E) => E - e * Math.sin(E) - M,
    (E) => 1 - e * Math.cos(E),
    M + 0.85 * e * Math.sign(Math.sin(M) || 1), -Math.PI, Math.PI
  );
}

// 쌍곡선: M = e·sinH - H
export function solveHyperbolic(M, e) {
  const f = (H) => e * Math.sinh(H) - H - M;
  let hi = Math.max(1, Math.abs(Math.asinh(M / e)) * 2 + 1);
  while (f(hi) < 0) hi *= 2; // f(hi) > 0 > f(-hi) 가 되는 구간을 잡는다
  return bracketedNewton(f, (H) => e * Math.cosh(H) - 1, Math.asinh(M / e), -hi, hi);
}

// 궤도면 안의 위치(근점 방향이 x): a 와 같은 단위 (타원 전용; 위성용)
export function perifocal(a, e, M) {
  const E = solveKepler(M, e);
  return { x: a * (Math.cos(E) - e), y: a * Math.sqrt(1 - e * e) * Math.sin(E) };
}

// 궤도면 -> 기준 좌표계 (근점인수 ω, 경사 i, 승교점 경도 Ω; 도 단위)
export function toReferenceFrame(p, wDeg, iDeg, nodeDeg) {
  const w = wDeg * DEG, i = iDeg * DEG, o = nodeDeg * DEG;
  const x1 = p.x * Math.cos(w) - p.y * Math.sin(w);
  const y1 = p.x * Math.sin(w) + p.y * Math.cos(w);
  const y2 = y1 * Math.cos(i), z2 = y1 * Math.sin(i);
  return {
    x: x1 * Math.cos(o) - y2 * Math.sin(o),
    y: x1 * Math.sin(o) + y2 * Math.cos(o),
    z: z2,
  };
}

// ---- 태양 중심 궤도 (혜성·소행성) ----
// el: { q (근일점 거리 AU), e, i (도), node (도), w (도), tp (근일점 통과 시각, JD) }
// 반환: { x, y, z (황도 좌표 AU), r (태양 거리 AU) }
const PARABOLIC_LIMIT = 2e-3; // |e-1| 가 이보다 작으면 포물선 공식(Barker)을 쓴다

export function orbitPosition(el, jd) {
  const { q, e } = el;
  const dt = jd - el.tp;
  let x, y, r;
  if (Math.abs(e - 1) < PARABOLIC_LIMIT) {
    // 포물선: dt = √(2q³)/k · (D + D³/3), D = tan(ν/2)  ->  D = 2·sinh( asinh(1.5·W)/3 )
    const W = (dt * GAUSS_K) / Math.sqrt(2 * q * q * q);
    const D = 2 * Math.sinh(Math.asinh(1.5 * W) / 3);
    const nu = 2 * Math.atan(D);
    r = q * (1 + D * D);
    x = r * Math.cos(nu); y = r * Math.sin(nu);
  } else if (e < 1) {
    const a = q / (1 - e);
    const E = solveKepler((GAUSS_K / Math.pow(a, 1.5)) * dt, e);
    x = a * (Math.cos(E) - e); y = a * Math.sqrt(1 - e * e) * Math.sin(E);
    r = a * (1 - e * Math.cos(E));
  } else {
    const a = q / (e - 1);
    const H = solveHyperbolic((GAUSS_K / Math.pow(a, 1.5)) * dt, e);
    x = a * (e - Math.cosh(H)); y = a * Math.sqrt(e * e - 1) * Math.sinh(H);
    r = a * (e * Math.cosh(H) - 1);
  }
  const p = toReferenceFrame({ x, y }, el.w, el.i, el.node);
  p.r = r;
  return p;
}

// 부호 있는 긴반지름 (타원 > 0, 쌍곡선 < 0, 포물선 ∞): 속도(vis-viva) 계산용
export function semiMajorAxis(el) {
  return Math.abs(el.e - 1) < 1e-12 ? Infinity : el.q / (1 - el.e);
}

// 궤도선용: 태양 거리 rmax 이내의 구간만 참인수 ν 로 샘플링 (장주기 혜성이나 쌍곡선이 화면을 뒤덮지 않게)
// 반환: 황도 좌표 AU 배열 [{x,y,z}, ...]
export function orbitCurve(el, rmax, n = 400) {
  const p = el.q * (1 + el.e);
  const c = (p / rmax - 1) / el.e;
  const nuMax = c <= -1 ? Math.PI : Math.max(Math.acos(Math.min(c, 1)), 0.05);
  const pts = [];
  for (let k = 0; k < n; k++) {
    const nu = -nuMax + (2 * nuMax * k) / (n - 1);
    const r = p / (1 + el.e * Math.cos(nu));
    pts.push(toReferenceFrame({ x: r * Math.cos(nu), y: r * Math.sin(nu) }, el.w, el.i, el.node));
  }
  return { points: pts, closed: c <= -1 };
}

export function jdFromDate(date) { return date.getTime() / 86400000 + 2440587.5; }
export function dateFromJD(jd) { return new Date((jd - 2440587.5) * 86400000); }
