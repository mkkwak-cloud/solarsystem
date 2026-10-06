// 위성의 화면 표현 설정 (궤도 계산 값은 data/moons.json).
// files: 실제 지도 후보 ([] 이면 실제 지도 없음). 지정하지 않으면 textures/2k_<id>.jpg → 1k_<id>.jpg 순으로 찾고,
//        없으면 textures/fictional/1k_<id>_fictional.jpg(가상) → 단색 순서로 대체한다.
// color: 단색 구체일 때와 멀리서 보이는 점의 색
// lonCenterW: 지도 가운데가 가리키는 서경(도). 위성은 한쪽 면이 항상 행성을 향하므로 서경 0° 쪽을 행성으로 돌린다.
//   0..360 범위 지도(유로파·가니메데·칼리스토)는 가운데가 180° 이므로 180. 나머지는 0 으로 가정했고 눈으로 검증하지 못했다.
// atmosphere: 타이탄처럼 표면이 안 보이는 천체에 겹치는 대기 구체
export const MOON_VISUAL = {
  moon:      { color: 0xb5b5b5, files: ['2k_moon.jpg'] },
  phobos:    { color: 0x9a8f86 },
  deimos:    { files: [], color: 0xa39a90 },
  io:        { color: 0xe0c85a },
  europa:    { color: 0xd8d2c4, lonCenterW: 180 },
  ganymede:  { color: 0x9c9488, lonCenterW: 180 },
  callisto:  { color: 0x6f675f, lonCenterW: 180 },
  mimas:     { color: 0xbdbdbd, note: '색 강조 컬러 지도' },
  enceladus: { color: 0xf0f4f8 },
  tethys:    { color: 0xdedede },
  dione:     { color: 0xd2d2d2 },
  rhea:      { color: 0xc8c8c8, files: ['1k_rhea.jpg'] },
  titan:     { color: 0xe39a45, note: '적외선 지도 + 주황 대기',
               atmosphere: { color: 0xe8923a, opacity: 0.72, scale: 1.06 } },
  iapetus:   { color: 0x9b9288 },
  miranda:   { files: [], fictional: false, color: 0xb0b0b0 }, // 지도가 부분(약 39%)뿐이라 단색
  ariel:     { files: [], color: 0xb8b6b0 },
  umbriel:   { files: [], color: 0x6a6a6a },
  titania:   { files: [], color: 0xa09890 },
  oberon:    { files: [], color: 0x8a7e76 },
  triton:    { color: 0xd8cfc4 },
  proteus:   { files: [], color: 0x6c6a68 },
};

export const HOST_ORDER = ['earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];
export const HOST_NAME_KO = { earth: '지구', mars: '화성', jupiter: '목성', saturn: '토성', uranus: '천왕성', neptune: '해왕성' };

// 화면 표현용 상수 (실제 비율로는 위성이 행성 표면 안쪽에 들어가 버리므로 줄여서 보여 준다)
export const MOON_RADIUS_BASE = 0.028;   // 위성 반지름 = 이 값 × (실제 반지름/지구 반지름)^0.45 × 크기 배율 (AU)
export const MOON_ORBIT_START = 1.5;     // 가장 안쪽 궤도가 시작하는 위치 (행성 화면 반지름의 배수)
export const MOON_ORBIT_SPREAD = 1.2;    // 바깥 궤도가 벌어지는 정도 (√(실제 거리/행성 반지름 − 1) 에 곱함)
export const MOON_LOD_FACTOR = 3;        // 카메라가 (가장 바깥 위성 궤도 반지름 × 이 값) 안으로 들어오면 위성 표시
