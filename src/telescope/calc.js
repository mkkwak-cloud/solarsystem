// ===== 심우주 망원경 계산 모듈 (순수 수학, DOM/Three 무관) =====
export const SQ3 = Math.sqrt(3);
export const PHYS = { jwstArea: 25.4, hubbleArea: 4.0, massFactor: 8.8 };

// 개략 값(공개 자료 기반 근사치): 설계 전 반드시 확인 필요
export const LAUNCHERS = {
  fh:  { name: 'Falcon Heavy (페어링 5.2m)', usable: 4.6 },
  a6:  { name: 'Ariane 6 (페어링 5.4m)', usable: 4.6 },
  sls: { name: 'SLS Block 1B (페어링 8.4m)', usable: 7.5 },
  ss:  { name: 'Starship (적재함 ~8m급)', usable: 7.5 },
  ksl3:{ name: '국내 차세대 발사체(가정 · 가용폭 4.0m)', usable: 4.0 },
  f3:  { name: '3 m급 페어링 (3.5mST 백서 · 가용폭 2.6m 가정)', usable: 2.6 },
  ng:  { name: 'New Glenn 7m 페어링', usable: 6.4 },
  ss9: { name: 'Starship 9m 페어링(HWO 가정)', usable: 8.4 },
};

// HWO 탐색 구성(EAC) — Feinberg 등, arXiv:2601.11803 표를 개략 반영(구경은 외접 기준 환산, 근사)
export const EACS = {
  eac1: { name: 'EAC1 · 오프액시스 6m(내접), 날개형', D: 7.2, seg: 1.0, fn: 1.5, launcher: 'ng', massCap: 25 },
  eac4: { name: 'EAC4 · 오프액시스 6.5–7m, 고정 주경', D: 7.8, seg: 1.1, fn: 1.5, launcher: 'ss9', massCap: 25 },
  eac5: { name: 'EAC5 · 오프액시스 8–8.5m, 전개형', D: 9.4, seg: 1.02, fn: 1.5, launcher: 'ss9', massCap: 37.5 },
};

export const PRESETS = {
  A: { D: 6.6, seg: 1.32, fn: 1.2, delta: 7, bfrac: 0.45, lambda: 2.0, dens: 26, hole: true, launcher: 'fh' },
  B: { D: 20, seg: 1.8, fn: 1.2, delta: 7, bfrac: 0.35, lambda: 0.6, dens: 15, hole: true, launcher: 'ss' },
  C: { D: 7.2, seg: 1.0, fn: 1.5, delta: 7, bfrac: 0.35, lambda: 0.5, dens: 40, hole: false, launcher: 'ng', eac: 'eac1', massCap: 25 },
};

export const GAP = 0.02;

// 육각 분할거울 배치. 이웃 방향이 z축(열)과 평행하도록 JWST와 같은 모양.
export function hexLayout(n, s, gap, hole) {
  const p = s + gap, segs = [];
  for (let q = -n; q <= n; q++) {
    for (let r = -n; r <= n; r++) {
      const t = -q - r;
      if (Math.abs(t) > n) continue;
      if (hole && q === 0 && r === 0) continue;
      segs.push({ q, r, x: p * SQ3 / 2 * q, z: p * (r + q / 2), ring: Math.max(Math.abs(q), Math.abs(r), Math.abs(t)) });
    }
  }
  return segs;
}

export function hexVerts(x, z, s) {
  const R = s / SQ3, v = [];
  for (let k = 0; k < 6; k++) v.push([x + R * Math.cos(k * Math.PI / 3), z + R * Math.sin(k * Math.PI / 3)]);
  return v;
}

export function apertureOf(segs, s) {
  let m = 0;
  for (const g of segs) for (const [vx, vz] of hexVerts(g.x, g.z, s)) m = Math.max(m, Math.hypot(vx, vz));
  return 2 * m;
}

export function ringsForAperture(D, s, gap, hole) {
  let best = 1;
  for (let n = 1; n <= 11; n++) {
    const d = apertureOf(hexLayout(n, s, gap, hole), s);
    if (d <= D * 1.06 || n === 1) best = n; else break;
  }
  return best;
}

export const sag = (x, z, f) => (x * x + z * z) / (4 * f);

// 광학계 구성. A/B: 카세그레인(주경 포물면 + 쌍곡면 부경), C: 오프액시스 포물면 + 초점
export function makeOptics(mode, f, Deff, deltaFrac, bfrac) {
  if (mode === 'C') return { cass: false, f, F: [0, f, 0], topY: f + 0.5 * Deff, x0: 0.72 * Deff };
  const Delta = deltaFrac * f, d = f - Delta, b = bfrac * Deff;
  const s2 = d + b, M = s2 / Delta;
  return { cass: true, f, d, Delta, b, s2, M, k: s2 - Delta, F1: [0, f, 0], F2: [0, -b, 0], topY: d + 0.5 * Deff, x0: 0 };
}

const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// (x,z)에서 입사한 평행광선 추적. 경로점 배열 반환(실패 시 null)
export function traceRay(x, z, opt) {
  const P = [x, sag(x, z, opt.f), z];
  const top = [x, opt.topY, z];
  if (!opt.cass) return [top, P, opt.F.slice()];
  const { F1, F2, k } = opt;
  const g = X => dist3(X, F2) - dist3(X, F1) - k;
  const at = t => [P[0] + (F1[0] - P[0]) * t, P[1] + (F1[1] - P[1]) * t, P[2] + (F1[2] - P[2]) * t];
  if (g(at(0)) > 0 || g(at(1)) < 0) return null;
  let lo = 0, hi = 1;
  for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2; if (g(at(m)) < 0) lo = m; else hi = m; }
  const X = at((lo + hi) / 2);
  return [top, P, X, F2.slice()];
}

// 부경 반경 = 모든 거울 꼭짓점에서의 반사 지점 중 최대 반경
export function secondaryRadius(segs, s, opt) {
  let m = 0;
  for (const g of segs) {
    const pts = hexVerts(g.x, g.z, s).concat([[g.x, g.z]]);
    for (const [vx, vz] of pts) {
      const path = traceRay(vx, vz, opt);
      if (path) m = Math.max(m, Math.hypot(path[2][0], path[2][2]));
    }
  }
  return Math.max(0.02, m * 1.03);
}

export function buildStats(P, segs, Deff, opt, rs) {
  const N = segs.length;
  const tile = 0.5 * SQ3 * P.seg * P.seg;
  const Atiles = N * tile;
  const obs = opt.cass ? Math.PI * rs * rs + 4 * 0.04 * Math.max(0, Deff / 2 - rs) : 0;
  const Aeff = Math.max(0, Atiles - obs);
  const lam = P.lambda * 1e-6;
  const theta = 1.22 * lam / Deff;               // rad
  const mas = theta * 206264.806 * 1000;         // 밀리초각
  const wfe = P.lambda * 1000 / 14;              // nm, Strehl≈0.8 (λ/14 rms)
  const mMirror = Atiles * P.dens;
  const mTotal = mMirror * PHYS.massFactor;
  return {
    N, Atiles, Aeff, obsFrac: Atiles > 0 ? obs / Atiles : 0, mas, wfe, mMirror, mTotal,
    vsJWST: Aeff / PHYS.jwstArea, vsHubble: Aeff / PHYS.hubbleArea,
    fEff: opt.cass ? opt.M * opt.f / Deff : opt.f / Deff, M: opt.M || 1,
  };
}

// 발사체 적합성: A(접이식)는 접힌 폭, C는 접지 않는 가정(주경 전체 폭), B는 모듈(분할거울 1장) 기준
export function fitCheck(mode, P, Deff, xh, N) {
  const usable = LAUNCHERS[P.launcher].usable;
  if (mode === 'A') {
    const w = 2 * (xh + 0.4);
    return { kind: 'fold', width: w, usable, ok: w <= usable };
  }
  if (mode === 'C') return { kind: 'rigid', width: Deff, usable, ok: Deff <= usable };
  const tooBig = P.seg + 0.2 > usable;
  const nPer = tooBig ? 0 : Math.max(1, Math.floor(0.6 * Math.PI * (usable / 2) ** 2 / (0.5 * SQ3 * P.seg * P.seg)) * 3);
  return { kind: 'asm', usable, ok: !tooBig, nPer, launches: tooBig ? Infinity : Math.ceil(N / nPer) + 1 };
}

// ===== 별 회절상(PSF) · 분할경 위상 오차 (Fraunhofer 근사: 동공 → FFT) =====
// 근거: Leboulleux 외(arXiv:2608.16479) — 분할거울 piston/tip/tilt 오차는 분할 1장의 PSF가 만드는 "저차 포락선"
//   (첫 영점 1.22·N·λ/D, N = 동공 지름 방향 분할 수)에 곱해져 나타남. Sahoo 외(arXiv:2607.28393) — 분할경 허용 오차는 pm 단위.
export function fft1(re, im, inv) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = 2 * Math.PI / len * (inv ? 1 : -1), wr = Math.cos(ang), wi = Math.sin(ang), h = len >> 1;
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < h; k++) {
        const a = i + k, b = a + h;
        const xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
}

export function fft2(re, im, N, inv) {
  const rr = new Float64Array(N), ri = new Float64Array(N);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) { rr[x] = re[y * N + x]; ri[x] = im[y * N + x]; }
    fft1(rr, ri, inv);
    for (let x = 0; x < N; x++) { re[y * N + x] = rr[x]; im[y * N + x] = ri[x]; }
  }
  for (let x = 0; x < N; x++) {
    for (let y = 0; y < N; y++) { rr[y] = re[y * N + x]; ri[y] = im[y * N + x]; }
    fft1(rr, ri, inv);
    for (let y = 0; y < N; y++) { re[y * N + x] = rr[y]; im[y * N + x] = ri[y]; }
  }
}

function mulberry32(a) {
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

// 동공 진폭(A)과 위상(φ, rad) 격자. segs 좌표는 동공 중심 기준(오프액시스는 호출 전에 x0를 빼 둘 것).
// o: { N, Dpx, lambdaNm, pistonNm, tiptiltNm, seed, struts, strutW }  — 오차는 모두 "파면(OPD) rms", nm
export function makePupil(segs, s, Deff, o) {
  const N = o.N || 512, dx = Deff / (o.Dpx || 160), half = s / 2, R = s / SQ3;
  const A = new Float64Array(N * N), W = new Float64Array(N * N);
  const rnd = mulberry32(o.seed == null ? 7 : o.seed);
  const gauss = () => Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());
  const k = 2 * Math.PI / o.lambdaNm;
  const nx = [Math.cos(Math.PI / 6), 0, -Math.cos(Math.PI / 6)], nz = [Math.sin(Math.PI / 6), 1, Math.sin(Math.PI / 6)];
  for (const g of segs) {
    const pis = (o.pistonNm || 0) * gauss();
    const tx = (o.tiptiltNm || 0) * gauss() / R, tz = (o.tiptiltNm || 0) * gauss() / R;  // 분할거울 모서리(외접 반경)에서의 OPD 편차 = tiptiltNm rms
    const i0 = Math.floor((g.x - R) / dx + N / 2), i1 = Math.ceil((g.x + R) / dx + N / 2);
    const j0 = Math.floor((g.z - R) / dx + N / 2), j1 = Math.ceil((g.z + R) / dx + N / 2);
    for (let j = Math.max(0, j0); j <= Math.min(N - 1, j1); j++) {
      for (let i = Math.max(0, i0); i <= Math.min(N - 1, i1); i++) {
        const px = (i - N / 2) * dx - g.x, pz = (j - N / 2) * dx - g.z;
        if (Math.abs(px * nx[0] + pz * nz[0]) > half || Math.abs(pz) > half || Math.abs(px * nx[2] + pz * nz[2]) > half) continue;
        A[j * N + i] = 1; W[j * N + i] = k * (pis + tx * px + tz * pz);
      }
    }
  }
  if (o.struts) {   // 부경 지지대 3개(120° 간격) — 그림자로 빼냄
    const w = Math.max(o.strutW || 0.1, dx) / 2;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      if (!A[j * N + i]) continue;
      const px = (i - N / 2) * dx, pz = (j - N / 2) * dx;
      for (let a = 0; a < 3; a++) {
        const th = Math.PI / 2 + a * 2 * Math.PI / 3, ux = Math.cos(th), uz = Math.sin(th);
        if (px * ux + pz * uz > 0 && Math.abs(-px * uz + pz * ux) < w) { A[j * N + i] = 0; break; }
      }
    }
  }
  return { N, A, W, dx };
}

// 동공 → 초점면 세기(무수차 최대값 = 1로 정규화). 반환 img 는 FFT 중심(0,0)을 N/2로 옮긴 배열
export function psfFromPupil(pup, aberrated) {
  const { N, A, W } = pup, re = new Float64Array(N * N), im = new Float64Array(N * N);
  let sumA = 0, cr = 0, ci = 0;
  for (let q = 0; q < N * N; q++) {
    if (!A[q]) continue;
    const ph = aberrated ? W[q] : 0;
    re[q] = Math.cos(ph); im[q] = Math.sin(ph); sumA++; cr += re[q]; ci += im[q];
  }
  fft2(re, im, N, false);
  const img = new Float32Array(N * N), norm = 1 / (sumA * sumA);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const sx = (x + N / 2) % N, sy = (y + N / 2) % N, q = sy * N + sx;
    img[y * N + x] = (re[q] * re[q] + im[q] * im[q]) * norm;
  }
  return { img, strehl: (cr * cr + ci * ci) * norm, area: sumA };
}

// 중심 기준 반경 r(λ/D 단위, 폭 ±hw)의 방위각 평균 세기. 격자 간격 = Dpx/N (λ/D / 픽셀)
export function radialMean(img, N, Dpx, r, hw = 0.5) {
  const sc = Dpx / N, c = N / 2; let s = 0, n = 0;
  const m = Math.ceil((r + hw) / sc) + 1;
  for (let y = -m; y <= m; y++) for (let x = -m; x <= m; x++) {
    const rr = Math.hypot(x, y) * sc;
    if (rr >= r - hw && rr <= r + hw) { s += img[(c + y) * N + c + x]; n++; }
  }
  return n ? s / n : 0;
}

// 지름 방향 분할 수(링 n, 중앙 포함): 2n+1. 수동 강건 조건: N ≤ IWA(λ/D) — Leboulleux 외(2026)
export const segsAcross = n => 2 * n + 1;
// 분할 오차 포락선의 첫 영점 반경(λ/D): 1.22·N
export const envelopeRadius = n => 1.22 * segsAcross(n);

// 문헌 기준값(비교용)
export const PHASING_REF = [
  { name: 'JWST 분할 정렬 달성(≈50 nm rms)', nm: 50 },
  { name: 'HWO 코로나그래프 목표(≈10 pm rms)', nm: 0.01 },
];

// ===== 이상적 코로나그래프(Cavarroc 외 2006) — 무수차 별빛을 완전히 제거하고 위상 오차로 생긴 스펙클만 남김 =====
// E_after = A·(e^{iφ} − ⟨e^{iφ}⟩_A). 세기는 가리지 않은 별의 최대값으로 정규화(= 대비). 실제 APLC의 설계 바닥(~10⁻¹¹)과 아포다이저 효과는 포함하지 않음.
export function coronagraphFromPupil(pup) {
  const { N, A, W } = pup, re = new Float64Array(N * N), im = new Float64Array(N * N);
  let sumA = 0, cr = 0, ci = 0;
  for (let q = 0; q < N * N; q++) if (A[q]) { sumA++; cr += Math.cos(W[q]); ci += Math.sin(W[q]); }
  cr /= sumA; ci /= sumA;
  for (let q = 0; q < N * N; q++) if (A[q]) { re[q] = Math.cos(W[q]) - cr; im[q] = Math.sin(W[q]) - ci; }
  fft2(re, im, N, false);
  const img = new Float32Array(N * N), norm = 1 / (sumA * sumA);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const q = ((y + N / 2) % N) * N + (x + N / 2) % N;
    img[y * N + x] = (re[q] * re[q] + im[q] * im[q]) * norm;
  }
  return { img };
}

// 고리 영역 [r0, r1] (λ/D) 평균 세기 — 암부 평균 대비
export function annulusMean(img, N, Dpx, r0, r1) {
  const sc = Dpx / N, c = N / 2, m = Math.ceil(r1 / sc) + 1; let s = 0, n = 0;
  for (let y = -m; y <= m; y++) for (let x = -m; x <= m; x++) {
    const r = Math.hypot(x, y) * sc;
    if (r >= r0 && r <= r1) { s += img[(c + y) * N + c + x]; n++; }
  }
  return n ? s / n : 0;
}

// 작은 위상 오차에서 대비 ∝ σ² → 목표 대비를 맞추는 허용 오차 배율
export const toleranceFor = (sigma, contrast, target) => contrast > 0 ? sigma * Math.sqrt(target / contrast) : Infinity;

// ===== 지구형 행성 검출 예산 — Turyshev(arXiv:2609.32023)의 해석적 모델을 단순화 =====
// 행성 신호 → 필요 FRN(검출 검정) → 광자·스펙클 안정도·보정 잡음 → 적분 시간. 입력값은 논문 Table IV 기본값, 처리율 τ는 가정.
const HC = 6.62607015e-34 * 2.99792458e8, KB = 1.380649e-23, PC = 3.0857e16, AU = 1.495978707e11;
export function normCdf(x) {   // Φ(x), erfc 근사(Numerical Recipes, 상대오차 ~1e-7)
  const z = Math.abs(x) / Math.SQRT2, t = 1 / (1 + 0.5 * z);
  const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? 1 - r / 2 : r / 2;
}
export function normInv(p) {   // Φ⁻¹(p), Acklam 근사 + 뉴턴 1회
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const q = Math.min(p, 1 - p); let x;
  if (q < 0.02425) { const u = Math.sqrt(-2 * Math.log(q)); x = (((((c[0] * u + c[1]) * u + c[2]) * u + c[3]) * u + c[4]) * u + c[5]) / ((((d[0] * u + d[1]) * u + d[2]) * u + d[3]) * u + 1); if (p > 0.5) x = -x; }
  else { const u = p - 0.5, r = u * u; x = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * u / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1); }
  const e = normCdf(x) - p; x -= e * Math.sqrt(2 * Math.PI) * Math.exp(x * x / 2);
  return x;
}
// 람베르트 행성 밝기비: Ag·Φ(α)·(Rp/a)², Φ(α) = [sinα + (π−α)cosα]/π
export function planetFluxRatio(Ag = 0.2, RpKm = 6371, aAU = 1, alphaDeg = 90) {
  const al = alphaDeg * Math.PI / 180, phi = (Math.sin(al) + (Math.PI - al) * Math.cos(al)) / Math.PI;
  return Ag * phi * (RpKm * 1e3 / (aAU * AU)) ** 2;
}
// 검출 검정: 탐색 지점 nTrial, 전체 오경보 pfa, 미검출 fMiss → 필요 SNR. 주어진 SNR의 검출 확률
export const detectThreshold = (nTrial = 30000, pfa = 1e-3) => normInv(1 - pfa / nTrial);
export const requiredSNR = (nTrial = 30000, pfa = 1e-3, fMiss = 0.01) => detectThreshold(nTrial, pfa) + normInv(1 - fMiss);
export const detectPower = (snr, nTrial = 30000, pfa = 1e-3) => normCdf(snr - detectThreshold(nTrial, pfa));
// 흑체 별의 광자율(광자/s/m²), 대역 [λc ± Δλ/2]
// withG: 측광 구멍(고정 0.7λc/D)의 대역 평균 ḡ = ∫R·g·(λc/λ)² dλ / ∫R dλ 도 함께 반환
export function starPhotonFlux(lamNm, dLamNm, dPc, Tstar = 5772, RstarM = 6.957e8, withG = false) {
  let s = 0, sg = 0; const n = 80, dl = dLamNm * 1e-9 / n;
  for (let i = 0; i < n; i++) {
    const l = (lamNm - dLamNm / 2) * 1e-9 + (i + 0.5) * dl;
    const r = (RstarM / (dPc * PC)) ** 2 * 2 * Math.PI * 2.99792458e8 / l ** 4 / (Math.exp(HC / (l * KB * Tstar)) - 1) * dl;
    s += r; sg += r * G_CORE * (lamNm * 1e-9 / l) ** 2;
  }
  return withG ? { flux: s, g: sg / s } : s;
}
// 두 롤 ADI(OS-1) 기준. p: { area(m²), lamNm, dLamNm, dPc, aAU, cRaw, cStab, tauCore, qe, tWallH, live, calPpt, fp }
// 별 기준 전자율 C⋆(코로나그래프 전), 행성 C_p = f_p·τ_core·C⋆, 누설 C_leak = ḡ·C⋆·C_raw, 광자 분산 V = C_p + 2(C_leak + C_b)
// FRN_ph = √(V/t)/(C⋆τ_core), FRN_speck = κ_c·C_stab (κ_c = ḡ/τ_core), FRN² = FRN_ph² + FRN_speck² + FRN_cal²
export const G_CORE = Math.PI * Math.PI * 0.49 / 4;   // 측광 구멍 반경 0.7λ/D 의 PSF_pk·Ω
export function detectionBudget(p) {
  const qe = p.qe ?? 0.2, live = p.live ?? 0.8, cal = (p.calPpt ?? 3.5) * 1e-12;
  const sf = starPhotonFlux(p.lamNm, p.dLamNm, p.dPc, p.Tstar ?? 5772, p.RstarM ?? 6.957e8, true), g = sf.g;
  const Cstar = sf.flux * p.area * qe;
  const ex = Cstar * p.tauCore, Cp = p.fp * ex, leak = g * Cstar * p.cRaw;
  const Cb = 0.02 * (p.dLamNm / 100) * (p.lamNm / 500) ** 2 + 0.001;
  const V = Cp + 2 * (leak + Cb), t = (p.tWallH ?? 100) * 3600 * live;
  const frnPh = Math.sqrt(V / t) / ex, frnSt = g / p.tauCore * p.cStab, frn = Math.sqrt(frnPh ** 2 + frnSt ** 2 + cal ** 2);
  const snrReq = requiredSNR(), frnReq = p.fp / snrReq, snr = p.fp / frn;
  const rest = frnReq ** 2 - cal ** 2 - frnSt ** 2;
  const tReqH = rest > 0 ? V / (ex * ex * rest) / 3600 / live : Infinity;
  const specAllow = Math.sqrt(Math.max(0, frnReq ** 2 - cal ** 2 - frnPh ** 2));   // 이 관측 시간에서 광학 잔여에 남는 FRN
  return { fp: p.fp, Cstar, Cp, leak, Cb, V, frnPh, frnSt, frn, snr, power: detectPower(snr), snrReq, frnReq, tReqH,
    specAllow, cStabAllow: specAllow * p.tauCore / g, g, sepMas: (p.aAU ?? 1) / p.dPc * 1000 };
}
// 광자+보정 잡음만으로 광학 잔여가 0이 되는 거리(pc) — 이분법
export function limitingDistance(p) {
  let lo = 0.5, hi = 100;
  if (detectionBudget({ ...p, dPc: hi, cStab: 0 }).specAllow > 0) return hi;
  for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (detectionBudget({ ...p, dPc: m, cStab: 0 }).specAllow > 0) lo = m; else hi = m; }
  return lo;
}
// 롤 사이 드리프트의 대비 안정도: 정적 잔여장 E0와 드리프트장 ΔE의 결맞음 혼합(위상 무작위 평균) + 2차 항
//   ⟨ΔI²⟩ ≈ 2·C_raw·c_d + c_d²  (Turyshev Eq. 62 와 같은 구조), c_d = 드리프트장만의 암부 세기
export const contrastStability = (cRaw, cDrift) => Math.sqrt(2 * cRaw * cDrift + cDrift * cDrift);

// ===== 차양막 층별 온도 — 1차원 복사 평형(층 간 복사 교환 + 열린 가장자리로 우주 방출) =====
// u_i = σT_i⁴ 에 대해 삼중대각 선형계. 1층 = 태양 쪽. 태양쪽 면(1층 앞면)은 도핑 실리콘 코팅, 나머지 면은 알루미늄 증착.
// 층 사이 간격: 복사 교환 (1−f)·E·(u_a − u_b), E = 1/(1/ε_a + 1/ε_b − 1); 각 면은 f·ε·u 만큼 가장자리로 우주에 방출.
// 기본값 aSi/eSi·fEdge 는 JWST 공개 온도(태양쪽 약 383 K, 망원경쪽 약 36 K)에 맞춘 보정값이며 재료 측정값이 아님.
export const SIGMA = 5.670374419e-8;
export const SHIELD_DEF = { S0: 1361 / 1.01 ** 2, cosI: 1, aSi: 0.652, eSi: 0.68, eAl: 0.05, fEdge: 0.68 };
export function sunshieldTemps(n, o = {}) {
  const p = { ...SHIELD_DEF, ...o }, E = 1 / (2 / p.eAl - 1), f = p.fEdge, k = (1 - f) * E;
  const a = new Float64Array(n), b = new Float64Array(n), c = new Float64Array(n), d = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const front = i === 0 ? p.eSi : f * p.eAl + k, back = i === n - 1 ? p.eAl : f * p.eAl + k;
    b[i] = front + back; a[i] = i > 0 ? -k : 0; c[i] = i < n - 1 ? -k : 0;
    d[i] = i === 0 ? p.aSi * p.S0 * p.cosI : 0;
  }
  for (let i = 1; i < n; i++) { const m = a[i] / b[i - 1]; b[i] -= m * c[i - 1]; d[i] -= m * d[i - 1]; }   // Thomas 알고리즘
  const u = new Float64Array(n); u[n - 1] = d[n - 1] / b[n - 1];
  for (let i = n - 2; i >= 0; i--) u[i] = (d[i] - c[i] * u[i + 1]) / b[i];
  const T = Array.from(u, v => Math.pow(v / SIGMA, 0.25));
  return { T, qIn: p.aSi * p.S0 * p.cosI, qLeak: p.eAl * u[n - 1] };   // 흡수 태양열, 망원경 쪽으로 나가는 열(W/m²)
}

// ===== 저궤도(LEO) 원궤도 — 한국형 우주망원경 배치 검토용 =====
// 주기 T = 2π√(a³/μ), 식(지구 그림자) 최대 시간은 β=0(태양이 궤도면 안)·원통 그림자 근사: 2·asin(R/a)/2π·T
// 태양동기 경사: cos i = −(a / 12352 km)^3.5 (J2, 원궤도 근사)
export const MU_E = 398600.4418, R_E = 6378.137;   // 고도는 적도 반지름 기준
export function leoOrbit(hKm) {
  const a = R_E + hKm, T = 2 * Math.PI * Math.sqrt(a ** 3 / MU_E), half = Math.asin(R_E / a);
  return {
    a, periodMin: T / 60, vKms: Math.sqrt(MU_E / a), eclipseFrac: half / Math.PI, eclipseMin: half / Math.PI * T / 60,
    earthHalfDeg: half * 180 / Math.PI, skyBlocked: (1 - Math.cos(half)) / 2, orbitsPerDay: 86400 / T,
    ssoIncDeg: Math.acos(-Math.pow(a / 12352, 3.5)) * 180 / Math.PI,
  };
}

// ===== 검출 대상 별 — 3.5mST 백서 III(arXiv:2609.02577) =====
// 지구형 행성은 지구와 같은 복사를 받는 거리(EEID) a = √(L/L☉) AU 에 둠. 반지름은 R = √L·(5772/T)² R☉ (흑체 근사).
// Ag: 태양형은 Turyshev(arXiv:2609.32023)의 0.2, K형 두 별은 백서 대비값(1.2e-9, 6.9e-10)을 재현하는 0.3.
export const TARGETS = {
  sun:    { name: '태양형 별 (G2V, 거리 조절)', T: 5772, L: 1, Ag: 0.2, d: null },
  cyg61A: { name: '61 Cyg A (K5V · 3.49 pc)', T: 4400, L: 0.1444, Ag: 0.3, d: 3.49 },
  epsIndA:{ name: 'ε Ind A (K5V · 3.64 pc)', T: 4650, L: 0.25, Ag: 0.3, d: 3.64 },
};
export function targetStar(key) {
  const t = TARGETS[key], aAU = Math.sqrt(t.L);
  return { ...t, aAU, RstarM: 6.957e8 * Math.sqrt(t.L) * (5772 / t.T) ** 2, fp: planetFluxRatio(t.Ag, 6371, aAU, 90) };
}
// 행성 궤도 a(AU)가 IWA(λ/D 단위) 밖에 놓이는 최대 거리(pc) — 백서 III Eq.(III.14)
export const iwaHorizonPc = (aAU, iwaLD, lamNm, D) => aAU / (iwaLD * lamNm * 1e-9 / D * 206264.806);

// ===== 차양막 종류 비교 — 공개 논문 수치(모델 값과 구분) =====
// JWST: NASA 공개(5겹 Kapton, 태양쪽 ~383 K · 망원경쪽 ~36 K), 층 면적 145–166 m²는 SALTUS 논문 Table 10 인용.
// SALTUS: Harding 외 arXiv:2405.12394 (2겹 직사각 CP1, 층 간격 ~2 m, M1 < 45 K, 따뜻한 쪽 ~310 K, 차양막 모듈 145 kg).
// V-groove: FOSSIL(Sauvage 외 arXiv:2608.13185, Planck·ARIEL 계승) — MLI + V-groove 3단 ~130/90/50 K + 25 K 능동 차폐.
export const SHIELD_TYPES = {
  jwst: {
    name: 'JWST형 (연 모양 5겹)', n: 5, ref: 'NASA · arXiv:2405.12394 Table 10',
    rows: { mission: 'JWST (2021 발사, 운용 중)', layers: '5겹', size: '약 21.2 × 14.2 m · 층당 145–166 m²', film: 'Kapton 25–50 µm', coat: '알루미늄 증착 + 태양쪽 1·2층 도핑 실리콘', deploy: '6점 코너 당김 (복잡한 전개)', mass: '—', target: '거울·기기 < 50 K', pub: '태양쪽 ~383 K → 망원경쪽 ~36 K' },
  },
  saltus: {
    name: 'SALTUS형 (직사각 2겹)', n: 2, ref: 'Harding 외 arXiv:2405.12394',
    rows: { mission: 'SALTUS (NASA 프로브 제안, 2032 목표)', layers: '2겹 · 간격 ~2 m', size: '48.5 × 19.2 m(931 m²) · 50 × 20 m(1,000 m²)', film: 'CP1 12.7 µm (미소 운석 고려)', coat: '알루미늄 증착 + 뒷면 고방출 실리콘', deploy: 'TRAC 복합재 붐 4개로 당김 · 층당 <60분', mass: '145 kg (모듈 전체)', target: '14 m 주경 < 45 K', pub: '따뜻한 쪽 ~310 K → 주경 < 45 K' },
  },
  vgroove: {
    name: 'V-groove형 (3단, Planck·FOSSIL)', n: 3, ref: 'Sauvage 외 arXiv:2608.13185', pubT: [130, 90, 50],
    rows: { mission: 'FOSSIL (ESA M8 제안, 2040년대) · Planck 계승', layers: 'MLI 20겹 + V-groove 3단 + 25 K 능동 차폐', size: '지름 ~2–3.2 m (소형)', film: '알루미늄 허니컴 패널', coat: 'VDA 뜨거운 면 · 저방출 차가운 면 · 고방출 우주쪽 면', deploy: '고정형 (전개 없음)', mass: '—', target: '기기 4.5 K · 검출기 50 mK (냉동기)', pub: '~130 K → ~90 K → ~50 K' },
  },
};
