// 태양과 행성 8개의 기본 값.
// 반지름·긴반지름·공전주기는 널리 쓰이는 표준값(NASA/JPL 행성 자료표 수준)이며, 정밀 계산에는 쓰지 않는다.
// 위치는 astronomy-engine 이 계산하고, 여기 값은 크기·속도 표시·궤도선 샘플링에만 쓴다.

export const AU_KM = 149597870.7;
export const GM_SUN_KM3S2 = 1.32712440018e11; // 태양 중력상수
export const EARTH_SPEED_KMS = Math.sqrt(GM_SUN_KM3S2 / AU_KM); // 지구 평균 공전속도(약 29.78 km/s)

export const SUN = {
  id: 'sun', name: '태양', radiusKm: 695700,
  color: 0xffc766, files: ['2k_sun.jpg'],
};

// files: 실제 지도 후보 파일(textures/ 아래). 없으면 가상 텍스처 → 단색 순서로 대체한다.
export const PLANETS = [
  { id: 'mercury', name: '수성', astro: 'Mercury', radiusKm: 2439.7, aAU: 0.38710, periodDays: 87.969,  color: 0xa8a39d, files: ['2k_mercury.jpg'] },
  { id: 'venus',   name: '금성', astro: 'Venus',   radiusKm: 6051.8, aAU: 0.72333, periodDays: 224.701, color: 0xe0c28a, files: ['2k_venus_surface.jpg'] },
  { id: 'earth',   name: '지구', astro: 'Earth',   radiusKm: 6371.0, aAU: 1.00000, periodDays: 365.256, color: 0x3f7fd0, files: ['2k_earth_daymap.jpg'] },
  { id: 'mars',    name: '화성', astro: 'Mars',    radiusKm: 3389.5, aAU: 1.52368, periodDays: 686.980, color: 0xc1623a, files: ['2k_mars.jpg'] },
  { id: 'jupiter', name: '목성', astro: 'Jupiter', radiusKm: 69911,  aAU: 5.20336, periodDays: 4332.59, color: 0xd0a47a, files: ['2k_jupiter.jpg'] },
  { id: 'saturn',  name: '토성', astro: 'Saturn',  radiusKm: 58232,  aAU: 9.53707, periodDays: 10759.22, color: 0xdcc58f, files: ['2k_saturn.jpg'],
    ring: { inner: 1.24, outer: 2.27, file: '2k_saturn_ring_alpha.png', tiltDeg: 26.7 } }, // 고리 반지름은 행성 반지름의 배수(어림값)
  { id: 'uranus',  name: '천왕성', astro: 'Uranus', radiusKm: 25362, aAU: 19.1913, periodDays: 30688.5, color: 0x8fd6df, files: ['2k_uranus.jpg'] },
  { id: 'neptune', name: '해왕성', astro: 'Neptune', radiusKm: 24622, aAU: 30.0690, periodDays: 60182, color: 0x4a6fe0, files: ['2k_neptune.jpg'] },
];

export const SKY_FILE = '2k_stars_milky_way.jpg';

// 화면에 그릴 반지름(AU 단위). 실제 비율이면 점보다 작아 보이지 않으므로 완만하게 키운다. 크기 슬라이더는 M2에서 이 값에 곱한다.
export function displayRadius(radiusKm) {
  return 0.035 * Math.pow(radiusKm / 6371, 0.45);
}
export const SUN_DISPLAY_RADIUS = 0.11;
