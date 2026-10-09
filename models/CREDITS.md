# 3D 모델 출처

## voyager.glb (보이저 탐사선)
- 파일: models/voyager.glb (3.0 MB). 접시 안테나·몸체·붐 등 4개 부품, 텍스처 포함. 한 모델이 쌍둥이 탐사선을 표현하므로 1호·2호를 복제해 쓴다.
- 다운로드 주소: https://assets.science.nasa.gov/content/dam/science/psd/solar/2023/09/v/Voyager.glb
- 페이지: https://science.nasa.gov/resource/voyager-3d-model/ (glTF 2.98 MB, 2023-09-09 갱신)
- 크레딧(페이지에 적힌 문구): "NASA Visualization Technology Applications and Development (VTAD)"
- 이용 조건 (2026-10-06 페이지 확인, 페이지 내용을 요약 도구로 읽은 것이라 원문 약관을 직접 대조한 것은 아님):
  - 이 모델 페이지에는 별도의 재사용 제한 문구가 없고 크레딧 표기만 있다.
  - NASA 미디어 이용 지침: NASA 자료는 미국에서 일반적으로 저작권 대상이 아니며 출처를 밝히면 비상업 용도(교육 등)로 쓸 수 있다. NASA 로고·휘장은 공용 자료가 아니고, NASA 가 상품·서비스를 보증하는 것처럼 보이게 쓰면 안 된다.
  - 이 프로그램은 교육·시연용이며 NASA 로고를 쓰지 않는다. 화면 하단에 "보이저 3D 모델: NASA VTAD" 로 출처를 표기한다. 상업 용도로 쓰게 되면 NASA 지침을 다시 확인할 것.
- 모델 크기·방향: 접시 지름 3.8(모델 단위) 기준으로 화면에서 0.05 AU 로 키워 쓴다 (실제 3.7 m 는 점보다 작아 확대 배율 적용). 접시는 모델의 +Y 방향이 바라보는 쪽이며, 지구를 향하도록 회전시킨다(지구 쪽에서 보면 오목한 면과 부반사판이 보임을 화면으로 확인).
- 모델을 읽지 못하면 기본 도형 조립(접시, 10각형 버스, 과학 붐·자력계 붐·RTG 붐)으로 대신한다 (화면으로 동작 확인함).

## 궤적 데이터 (data/voyager.json)
- 출처: JPL Horizons API (https://ssd.jpl.nasa.gov/api/horizons.api), 천체 -31(보이저 1호), -32(보이저 2호). scripts/fetch-voyager.js 로 생성.
- 30일 간격 위치·속도, 1977년 발사 직후부터 2060-01-01 까지. 그 이후는 마지막 속도로 직선 외삽하고 화면에 "외삽값" 표기.

## models/sat/*.glb (국내 위성 추적 페이지의 "대표 모형")
- 출처: NASA 3D Resources (https://github.com/nasa/NASA-3D-Resources, 저장소 설명: "free and without copyright"). 2026-10-08 받음.
  - cubesat2u.glb ← CubeSat - 2 RU Generic (큐브위성 일반 모형)
  - goes.glb ← Geostationary Operational Environmental Satellites (GOES, 정지궤도 위성 대표)
  - landsat8.glb ← Landsat 8 (지구 관측 위성 대표)
  - lro.glb ← Lunar Reconnaissance Orbiter (A) (달 궤도선 대표, 다누리 자리)
- 국내 위성(아리랑·천리안·다누리 등)의 공개 3D 모델은 찾지 못했다. 그래서 같은 종류의 NASA 모델을 "대표 모형"으로 쓰고, 화면 카드에 "실제 모습이 아님"을 적는다. 그 밖의 위성은 본체+날개의 간단한 도형.
- NASA 가 상품·서비스를 보증하는 것처럼 보이지 않게 하고 NASA 로고는 쓰지 않는다.

## models/jwst/ (우주망원경 시뮬레이터의 제임스웹 실사 모델)
- 출처: NASA 3D Resources (https://github.com/nasa/NASA-3D-Resources) → `3D Models/James Webb Space Telescope (B)/James Webb Space Telescope (B).glb` (Draco 압축).
- 변환: Draco 해제 → 위치 Int16·법선 Int8 양자화 → gzip → base64 텍스트(jwstB.gz.b64.txt, 1.5 MB) + 메타(jwstB.json, 재질 그룹 36개·약 10만 삼각형·단위 m). 변환 도구는 Test1 저장소 deep-space-telescope-sim/tools/decode.cjs.
- 이용 조건은 위 models/sat 과 같음(NASA 3D Resources, 출처 표기, NASA 로고 안 씀, 보증처럼 보이지 않게).
