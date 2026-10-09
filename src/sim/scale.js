// 거리 스케일 변환. 좌표 벡터의 "길이"만 바꾸고 방향은 그대로 두므로 궤도 경사가 유지된다.
//  선형: 실제 AU 비례
//  로그: r_screen = K_LOG · ln(1 + r)
//  압축: r_screen = K_SQRT · √r  (안쪽 행성은 상대적으로 펼쳐지고 바깥쪽은 눌린다)
// 두 압축 방식 모두 30 AU(해왕성)가 화면상 약 30 이 되도록 상수를 잡았다.
export const MODES = { linear: '선형', log: '로그', compress: '압축' };
export const scaleState = { mode: 'linear' };

const K_LOG = 8.7;
const K_SQRT = 5.5;

export function setScaleMode(mode) {
  if (MODES[mode]) scaleState.mode = mode;
}

export function scaleRadius(r) {
  switch (scaleState.mode) {
    case 'log': return K_LOG * Math.log(1 + r);
    case 'compress': return K_SQRT * Math.sqrt(r);
    default: return r;
  }
}

export function applyScale(p, out) {
  const r = Math.hypot(p.x, p.y, p.z);
  if (r < 1e-12) return out.set(0, 0, 0);
  const f = scaleRadius(r) / r;
  return out.set(p.x * f, p.y * f, p.z * f);
}
