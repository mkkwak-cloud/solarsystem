import * as C from '../src/telescope/calc.js';   // 우주망원경 계산 검증: node scripts/test-telescope-calc.mjs
const eq = (a, b, m, tol = 1e-6) => { if (!(Math.abs(a - b) <= tol)) { console.log('FAIL', m, a, b); process.exitCode = 1; } else console.log('ok  ', m, a); };

// 1) 육각 배치: 2링 구멍 있음 = 18장 (JWST)
eq(C.hexLayout(2, 1.32, 0.02, true).length, 18, 'JWST형 분할거울 수');
eq(C.hexLayout(5, 1.8, 0.02, true).length, 90, '5링 구멍 = 90');
eq(C.hexLayout(3, 1.0, 0.02, false).length, 37, '3링 = 37');

// 2) 프리셋별 구경
for (const m of ['A', 'B', 'C']) {
  const P = { ...C.PRESETS[m], mode: m, gap: C.GAP };
  const hole = m === 'C' ? false : P.hole;
  const n = C.ringsForAperture(P.D, P.seg, P.gap, hole);
  const segs = C.hexLayout(n, P.seg, P.gap, hole);
  const Deff = C.apertureOf(segs, P.seg);
  const f = P.fn * Deff;
  const opt = C.makeOptics(m, f, Deff, P.delta / 100, P.bfrac);
  const rs = opt.cass ? C.secondaryRadius(segs, P.seg / C.SQ3, opt) : 0;
  const st = C.buildStats(P, segs, Deff, opt, rs);
  console.log(m, { n, N: segs.length, Deff: +Deff.toFixed(2), f: +f.toFixed(2), rs: +rs.toFixed(3), Aeff: +st.Aeff.toFixed(1), mas: +st.mas.toFixed(1), fEff: +st.fEff.toFixed(1), kg: Math.round(st.mTotal) });
  // 3) 반사 법칙 검증: 부경에서 반사된 광선이 F2로 가고 입사각=반사각
  if (opt.cass) {
    let worst = 0, cnt = 0;
    for (const g of segs) {
      const path = C.traceRay(g.x, g.z, opt);
      if (!path) continue; cnt++;
      const [, P1, X, F2] = path;
      const n1 = [-(X[0]) , 0, -(X[2])]; // placeholder
      // 쌍곡면 법선 = (F1-X)/|F1-X| 와 (F2-X)/|F2-X| 의 합 방향 → 반사 확인
      const u = v => { const l = Math.hypot(...v); return v.map(a => a / l); };
      const sub = (a, b) => a.map((v, i) => v - b[i]);
      const dIn = u(sub(X, P1)), dOut = u(sub(F2, X));
      const nrm = u(u(sub(opt.F1, X)).map((v, i) => v - u(sub(F2, X))[i]));
      const dot = dIn.reduce((s, v, i) => s + v * nrm[i], 0);
      const refl = dIn.map((v, i) => v - 2 * dot * nrm[i]);
      const err = Math.hypot(...refl.map((v, i) => v - dOut[i]));
      worst = Math.max(worst, err);
    }
    console.log('   반사 법칙 최대 오차', worst.toExponential(2), '추적 성공 광선', cnt);
    if (worst > 1e-6) process.exitCode = 1;
  } else {
    const g = segs[5]; const p = C.traceRay(g.x, g.z, opt);
    const sub = (a, b) => a.map((v, i) => v - b[i]);
    const dIn = [0, -1, 0], dOut = sub(p[2], p[1]); const l = Math.hypot(...dOut);
    const nn = [-p[1][0] / (2 * f), 1, -p[1][2] / (2 * f)]; const nl = Math.hypot(...nn);
    const nrm = nn.map(v => v / nl);
    const dot = dIn.reduce((s, v, i) => s + v * nrm[i], 0);
    const refl = dIn.map((v, i) => v - 2 * dot * nrm[i]);
    const err = Math.hypot(...refl.map((v, i) => v - dOut[i] / l));
    console.log('   오프액시스 반사 오차', err.toExponential(2));
    if (err > 1e-9) process.exitCode = 1;
  }
  const fit = C.fitCheck(m, P, Deff, 1.5 * Math.sqrt(3) / 2 * (P.seg + P.gap), segs.length);
  console.log('   적합성', JSON.stringify(fit));
}

// 4) PSF: FFT 항등성, 무수차 Strehl=1, Maréchal 근사, 육각 분할경의 회절 스파이크
{
  const re = new Float64Array(64 * 64).map((_, i) => Math.sin(i * 0.37) + 0.3), im = new Float64Array(64 * 64);
  const e0 = re.reduce((s, v) => s + v * v, 0), r0 = Float64Array.from(re);
  C.fft2(re, im, 64, false);
  const e1 = re.reduce((s, v, i) => s + v * v + im[i] * im[i], 0) / (64 * 64);
  eq(e1 / e0, 1, 'FFT 파스발(에너지 보존)', 1e-9);
  C.fft2(re, im, 64, true);
  eq(re[1234] / (64 * 64), r0[1234], 'FFT 역변환', 1e-9);

  const segs = C.hexLayout(4, 1.0, 0.02, false), Deff = C.apertureOf(segs, 1.0);
  const base = { N: 512, Dpx: 160, lambdaNm: 500 };
  const p0 = C.makePupil(segs, 1.0, Deff, base);
  const f0 = C.psfFromPupil(p0, true);
  eq(f0.strehl, 1, '무수차 Strehl', 1e-9);
  const sig = 500 / 20;   // λ/20 rms piston
  const p1 = C.makePupil(segs, 1.0, Deff, { ...base, pistonNm: sig });
  const f1 = C.psfFromPupil(p1, true);
  const mar = Math.exp(-((2 * Math.PI * sig / 500) ** 2));
  eq(f1.strehl, mar, `Maréchal exp(-σ²) 근사 (실측 ${f1.strehl.toFixed(3)})`, 0.08);
  // 무수차 PSF 에너지 대비 피크가 1로 정규화됐는지, 6방향 스파이크가 대각보다 밝은지
  const img = C.psfFromPupil(p0, false).img;
  eq(img[256 * 512 + 256], 1, '무수차 PSF 중심 = 1', 1e-6);
  const rr = 8 / (160 / 512), at = (th) => img[Math.round(256 + rr * Math.sin(th)) * 512 + Math.round(256 + rr * Math.cos(th))];
  let mx = 0, mn = Infinity, asym = 0;
  for (let d = 0; d < 180; d += 2) { const th = d * Math.PI / 180, v = at(th); mx = Math.max(mx, v); mn = Math.min(mn, v); asym = Math.max(asym, Math.abs(v - at(th + Math.PI)) / (v + 1e-12)); }
  console.log('   r=8λ/D 방위각 최대/최소 세기비', (mx / mn).toFixed(0), ' 점대칭 오차', asym.toExponential(1));
  if (!(mx > 10 * mn)) { console.log('FAIL 회절 스파이크 이방성'); process.exitCode = 1; }
  if (asym > 1e-3) { console.log('FAIL 점대칭'); process.exitCode = 1; }
}

// 5) 이상적 코로나그래프: 무수차면 0, 작은 오차에서 대비 ∝ σ²
{
  const segs = C.hexLayout(1, 2.0, 0.006, false), Deff = C.apertureOf(segs, 2.0);
  const o = { N: 512, Dpx: 160, lambdaNm: 500 };
  const c0 = C.coronagraphFromPupil(C.makePupil(segs, 2.0, Deff, o));
  eq(C.annulusMean(c0.img, 512, 160, 3.5, 12), 0, '무수차 암부 대비 = 0', 1e-25);
  const ca = C.annulusMean(C.coronagraphFromPupil(C.makePupil(segs, 2.0, Deff, { ...o, pistonNm: 0.01 })).img, 512, 160, 3.5, 12);
  const cb = C.annulusMean(C.coronagraphFromPupil(C.makePupil(segs, 2.0, Deff, { ...o, pistonNm: 0.02 })).img, 512, 160, 3.5, 12);
  eq(cb / ca, 4, `대비 ∝ σ² (10 pm piston 7장 → ${ca.toExponential(2)})`, 1e-3);
  eq(C.toleranceFor(0.01, ca, ca * 4), 0.02, '허용 오차 환산', 1e-12);
}

// 6) 검출 예산: Turyshev(arXiv:2609.32023) 수치 재현 — 115.46 ppt, 99% 검출 FRN 14.94 ppt, 20 ppt에서 64.55%
{
  const fp = C.planetFluxRatio();
  eq(fp * 1e12, 115.46, '지구형 행성 밝기비(ppt)', 0.05);
  eq(fp / C.requiredSNR() * 1e12, 14.94, '99% 검출 필요 FRN(ppt)', 0.01);
  eq(C.detectPower(fp / 20e-12) * 100, 64.55, '20 ppt 검출 확률(%)', 0.02);
  eq(C.normInv(C.normCdf(1.234)), 1.234, '정규분포 역함수', 1e-6);
  const P0 = { area: Math.PI * 9, lamNm: 500, dLamNm: 100, dPc: 5, aAU: 1, cRaw: 3e-10, cStab: 0, tauCore: 0.12, fp };
  const b = C.detectionBudget(P0);
  eq(b.g, 1.2127344, '대역 평균 ḡ (Eq.93)', 1e-5);
  eq(b.Cstar / 1e9, 2.3665863, '별 전자율 C⋆ (10⁹ e/s, 논문 Eq.93)', 2e-4);
  eq(b.Cp, 0.0327905, '행성 전자율 C_p', 2e-6);
  eq(b.leak, 0.8610122, '별빛 누설 C_leak', 1e-4);
  eq(b.frnPh * 1e12, 8.7953, '100 h 광자 FRN (ppt)', 2e-3);
  eq(b.specAllow * 1e12, 11.5641, '광학 잔여 허용 FRN (ppt, Eq.94)', 2e-3);
  eq(b.cStabAllow * 1e12, 1.1443, '허용 대비 안정도 (10⁻¹² NI)', 1e-3);
  eq(C.limitingDistance(P0), 8.1065, '100 h 한계 거리 (pc)', 2e-3);
  const b10 = C.detectionBudget({ ...P0, dPc: 10 });
  eq(b10.frnPh * 1e12, 18.197, '10 pc 광자 FRN (ppt)', 2e-2);
  eq(C.detectionBudget({ ...P0, cStab: 10e-12 / (b.g / 0.12) }).tReqH, 69.64, '광학 잔여 10 ppt 필요 시간 (h)', 0.05);
}

// 7) 차양막 층별 온도: JWST 공개 온도 근사, 단조 감소, 에너지 보존
{
  const r = C.sunshieldTemps(5), p = C.SHIELD_DEF, T = r.T;
  eq(T[0], 383, `JWST 태양쪽 층 온도 ≈ 383 K (${T.map(t => t.toFixed(0)).join('→')})`, 3);
  eq(T[4], 36, 'JWST 망원경쪽 층 온도 ≈ 36 K', 3);
  if (!T.every((t, i) => i === 0 || t < T[i - 1])) { console.log('FAIL 온도 단조 감소'); process.exitCode = 1; }
  const u = T.map(t => C.SIGMA * t ** 4);
  let out = p.eSi * u[0] + p.eAl * u[4];
  for (let i = 0; i < 5; i++) out += p.fEdge * p.eAl * ((i > 0) + (i < 4)) * u[i];   // 가장자리 방출
  eq(out / r.qIn, 1, '차양막 에너지 보존(흡수 = 방출)', 1e-9);
}

// 8) 저궤도: 600 km 원궤도 주기·속도·태양동기 경사
{
  const o = C.leoOrbit(600);
  eq(o.periodMin, 96.7, `LEO 600 km 주기(분) — 식 ${o.eclipseMin.toFixed(1)}분, 하늘 가림 ${(o.skyBlocked * 100).toFixed(0)}%`, 0.1);
  eq(o.vKms, 7.56, 'LEO 600 km 속도(km/s)', 0.01);
  eq(o.ssoIncDeg, 97.8, '태양동기 경사(°)', 0.1);
  eq(C.leoOrbit(400).periodMin, 92.6, 'ISS 고도 400 km 주기(분)', 0.1);
}

// 9) 3.5mST 백서(arXiv:2609.02577) 수치: 늦은 K형 대상 대비·이격, IWA 거리 한계(Table III.3)
{
  const a = C.targetStar('cyg61A'), b = C.targetStar('epsIndA');
  eq(a.fp * 1e9, 1.2, `61 Cyg A 지구형 대비(10⁻⁹) a=${a.aAU.toFixed(2)} AU`, 0.05);
  eq(a.aAU / a.d * 1000, 108, '61 Cyg A 이격(mas)', 2);
  eq(b.fp * 1e10, 6.9, 'ε Ind A 지구형 대비(10⁻¹⁰)', 0.1);
  eq(b.aAU / b.d * 1000, 137, 'ε Ind A 이격(mas)', 1);
  eq(C.iwaHorizonPc(1, 3, 550, 3.5), 10.3, '지구 쌍둥이 한계 거리 3λ/D (pc)', 0.05);
  eq(C.iwaHorizonPc(1, 2, 550, 3.5), 15.4, '지구 쌍둥이 한계 거리 2λ/D (pc)', 0.05);
  eq(C.iwaHorizonPc(5.2, 3, 550, 3.5), 53.5, '목성 쌍둥이 한계 거리 3λ/D (pc)', 0.1);
  const bud = C.detectionBudget({ area: 8.5, lamNm: 550, dLamNm: 110, dPc: a.d, aAU: a.aAU, Tstar: a.T, RstarM: a.RstarM, cRaw: 1e-8, cStab: 0, tauCore: 0.12, fp: a.fp });
  console.log('   3.5mST·61 Cyg A 예시', { 이격mas: +bud.sepMas.toFixed(0), FRN_ppt: +(bud.frn * 1e12).toFixed(1), 검출확률: +bud.power.toFixed(3), 필요시간h: +bud.tReqH.toFixed(0) });
}

// 10) 거울 맞추기: 다 맞으면 Strehl 1, 한 조각을 옮기면 그 점이 (dx, dy) 위치에 생김, 높이 반 파장 어긋남은 선명도를 떨어뜨림
{
  const segs = C.hexLayout(2, 1.32, C.GAP, true), D = C.apertureOf(segs, 1.32), N = 256, Dpx = 96, c = N / 2, pp = N / Dpx;
  const zero = segs.map(() => ({ dx: 0, dy: 0, p: 0 }));
  const ok = C.psfFromPupil(C.makeAlignPupil(segs, 1.32, D, { N, Dpx, err: zero }), true);
  eq(ok.strehl, 1, '거울 맞추기: 다 맞으면 Strehl 1', 1e-9);
  const e1 = zero.map(e => ({ ...e })); e1[0] = { dx: 20, dy: -10, p: 0 };
  const im = C.psfFromPupil(C.makeAlignPupil(segs, 1.32, D, { N, Dpx, err: e1 }), true).img;
  let bx = 0, by = 0, bv = -1;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const r = Math.hypot(x - c, y - c); if (r > 8 * pp && im[y * N + x] > bv) { bv = im[y * N + x]; bx = x; by = y; } }
  eq((bx - c) / pp, 20, '옮긴 조각의 점 위치 x (λ/D)', 1.2);
  eq((by - c) / pp, -10, '옮긴 조각의 점 위치 y (λ/D)', 1.2);
  const ep = zero.map((e, i) => ({ ...e, p: i % 2 ? 0.25 : -0.25 }));
  const sp = C.psfFromPupil(C.makeAlignPupil(segs, 1.32, D, { N, Dpx, err: ep }), true).strehl;
  if (!(sp < 0.2)) { console.log('FAIL 높이 반 파장 어긋남이면 선명도 낮아야 함', sp); process.exitCode = 1; } else console.log('ok   높이 ±¼파장 어긋남 Strehl', sp.toFixed(3));
  const sd = C.psfFromPupil(C.makeAlignPupil(segs, 1.32, D, { N, Dpx, err: zero, defocus: 1 }), true).strehl;
  if (!(sd < 0.5)) { console.log('FAIL 초점 1파장 어긋남이면 흐려져야 함', sd); process.exitCode = 1; } else console.log('ok   초점 1파장 어긋남 Strehl', sd.toFixed(3));
  const b = C.alignBase(segs.length);
  eq(C.alignTarget(b, 4).reduce((m, e) => Math.max(m, Math.abs(e.p)), 0) <= 0.02 ? 1 : 0, 1, '정밀 맞춤 단계 높이 어긋남 ≤ 0.02파장', 0);
}
