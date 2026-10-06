// 소행성·왜행성의 화면 표현 설정 (궤도 값은 data/asteroids.json).
// files: 실제 지도 후보. 지정하지 않으면 textures/2k_<id>.jpg → 1k_<id>.jpg 순.
//        [] 이면 실제 지도 없음 → 가상 텍스처(textures/fictional/) → 단색 순서로 찾는다.
// 세레스는 Solar System Scope 의 "fictional" 텍스처를 쓰지 않는다 (PRD 3.9): 실제 Dawn 지도(2k_ceres.jpg)만 쓰고, 세레스용 가상 파일은 없다.
export const ASTEROID_VISUAL = {
  ceres:   { color: 0xb3aea6, note: 'Dawn 탐사선 지도' },
  vesta:   { color: 0xa8a29a, note: 'Dawn 탐사선 지도' },
  pallas:  { color: 0x9a9288, files: [], note: '구체 + 가상 질감' },
  hygiea:  { color: 0x6f6b66, files: [], note: '구체 + 가상 질감' },
  eros:    { color: 0xb08a62, files: [], note: '구체 + 가상 질감 (실제는 길쭉한 모양)' },
  itokawa: { color: 0x9a7a5a, files: [], note: '구체 + 가상 질감 (실제는 땅콩 모양)' },
  ryugu:   { color: 0x555350, files: [], note: '구체 + 가상 질감' },
  bennu:   { color: 0x4f4d4a, files: [], note: '구체 + 가상 질감' },
  pluto:   { color: 0xd8b89a, radiusKm: 1188.3, note: 'New Horizons 지도' }, // SBDB 에 지름이 없어 반지름을 직접 적음 (IAU 2015 값)
};

// 화면 반지름(AU) = BASE + SPAN·√(실제 반지름 / 1188 km). 실제 비율이면 점보다 작아서 크게 키워 보이되 크기 순서는 유지한다.
export const AST_RADIUS_BASE = 0.004;
export const AST_RADIUS_SPAN = 0.006;
export const ASTEROID_ORBIT_RMAX = 60; // 궤도선은 태양 거리 60 AU 이내 구간
