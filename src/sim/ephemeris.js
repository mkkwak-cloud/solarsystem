// 행성 위치 (astronomy-engine). 태양 중심, 황도 기준, 단위 AU.
// 화면 좌표: x = 황도 x, y = 위(황도 북쪽), z = -황도 y  (위에서 내려다보면 공전이 반시계 방향)
const A = window.Astronomy;
const rotToEcliptic = A.Rotation_EQJ_ECL();

// J2000 적도 좌표(EQJ) 벡터 -> 화면 좌표(황도 기준). 단위는 입력과 같다.
export function eqjToScene(v) {
  const e = A.RotateVector(rotToEcliptic, v);
  return { x: e.x, y: e.z, z: -e.y };
}

export function helioPosition(astroName, date) {
  const v = A.HelioVector(A.Body[astroName], A.MakeTime(date));
  const e = A.RotateVector(rotToEcliptic, v);
  return { x: e.x, y: e.z, z: -e.y };
}

// 달: 지구 중심 위치(AU), 목성 4대 위성: 목성 중심 위치(AU). 모두 화면 좌표.
export function geoMoonOffset(date) {
  return eqjToScene(A.GeoMoon(A.MakeTime(date)));
}
export function jupiterMoonOffset(name, date) {
  const m = A.JupiterMoons(A.MakeTime(date))[name];
  return eqjToScene({ x: m.x, y: m.y, z: m.z });
}

// 궤도선용: 한 주기를 n개 점으로 샘플링한 AU 좌표 배열 [{x,y,z}, ...]
export function sampleOrbit(astroName, startDate, periodDays, n = 360) {
  const pts = [];
  const t0 = startDate.getTime();
  for (let i = 0; i < n; i++) {
    pts.push(helioPosition(astroName, new Date(t0 + (i / n) * periodDays * 86400000)));
  }
  return pts;
}

// vis-viva 식으로 계산한 공전 속도 (km/s). r: 태양 거리(km), a: 긴반지름(km)
export function visViva(gm, rKm, aKm) {
  return Math.sqrt(gm * (2 / rKm - 1 / aKm));
}
