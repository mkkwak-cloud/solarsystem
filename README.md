# 태양계 시뮬레이터 (3D)

브라우저에서 보는 3D 태양계입니다. 같은 폴더에 국내 위성 추적(`satellites.html`)과 우주망원경 설계 시뮬레이터(`telescope.html`) 페이지도 있습니다. 행성 8개, 위성 21개, 소행성·왜행성 9개, 혜성 21개(성간천체 3I/ATLAS 포함), 보이저 1·2호를 실제 천문 자료로 계산해 보여 줍니다. 요구사항은 `PRD.md`(v0.4)입니다.

## 실행 방법

1. 이 폴더에서 터미널을 엽니다.
2. 서버를 켭니다. (아래 둘 중 하나)
   - `py -m http.server 8000`  (Windows, 파이썬 설치 필요)
   - `npx serve`  (Node.js 설치 필요)
3. 브라우저(최신 Chrome / Edge / Safari)에서 http://localhost:8000 을 엽니다.

파일을 더블클릭해서 여는 방식(`file://`)은 브라우저가 텍스처 읽기를 막아서 동작하지 않습니다. 반드시 위처럼 서버를 켜세요.
라이브러리와 텍스처가 모두 이 폴더 안에 있어서, 한 번 받아 두면 인터넷 없이 실행됩니다.

## 쓰는 법

| 하고 싶은 것 | 방법 |
|---|---|
| 시간 빠르게/느리게 | 왼쪽 패널 "시간 배속" 슬라이더 (0.1x ~ 32000x). 1x = 현실 1초에 시뮬레이션 1일 |
| 특정 날짜 보기 | "날짜 설정"에 날짜·시간 입력 후 "적용" |
| 일시정지 | "일시정지" 버튼 |
| 멀리 있는 행성을 한 화면에 | "거리 스케일"을 로그 또는 입축으로 |
| 천체 정보 | 천체를 클릭(또는 오른쪽 목록의 카드 클릭) |
| 천체에 접근해서 따라가기 | 천체를 더블클릭. 행성에 접근하면 위성이 나타납니다 |
| 처음 화면으로 | "태양계 전체 보기" 또는 `Esc` |
| 보이저 보기 | 표시 옵션에서 보이저 1호/2호를 켜고 "보이저 뷰" |
| 발표용으로 화면 넓게 | 패널 옆 ◀ 버튼으로 패널 접기 |
| 마우스 | 드래그 = 회전, 휠 = 확대/축소, 오른쪽 드래그 = 이동 |

## 폴더 구조

```
index.html, style.css      화면 (태양계)
satellites.html/.css       국내 위성 추적 페이지
telescope.html/.css        우주망원경 시뮬레이터 페이지 (코드: src/telescope/)
src/data/                  표시 설정, 행성 값, 자전 요소
src/sim/                   시계, 행성·위성·혜성·소행성·보이저 위치 계산, 케플러 풀이, 거리 스케일, 자전
src/scene/                 3D 천체, 궤도선, 꼬리, 위성 줌 연동, 소행성대, 보이저
src/ui/                    정보 카드
data/                      사전 조회한 자료 (JSON): moons, comets, asteroids, voyager
textures/ (+ fictional/)   텍스처 (출처: textures/CREDITS.md)
models/                    보이저·위성·제임스웹 3D 모델 (출처: models/CREDITS.md)
vendor/                    three.js, astronomy-engine
scripts/                   자료·텍스처 수집/변환 도구
plan/                      계획·결정·검증 기록
```

## 우주망원경 시뮬레이터 (telescope.html)

- 망원경을 설계값(구경·분할거울·초점비·파장 등)으로 만들고 전개 과정·광선 경로·성능을 보여 줍니다. 모드: 접이식(JWST·Roman), 우주 조립형, HWO형, 제임스웹 실사(NASA 3D 모델), 한국형 3.5 m(KASI 3.5mST 백서).
- ⚙ 설계 패널: 별 회절상(PSF)·분할경 오차, 코로나그래프 암부 대비, 지구형 행성 검출 예산, 차양막 비교(JWST·SALTUS·V-groove)와 층별 온도.
- 태양계 화면의 "제임스웹 (L2)" 카드 버튼으로도 열 수 있습니다(`telescope.html?mode=J`).
- 개략 설계·교육용이며 정밀 구조·열·광학 해석이 아닙니다. 검증: `node scripts/test-telescope-calc.mjs`, `node scripts/test-telescope-smoke.mjs`.

## 자료·텍스처를 다시 받으려면 (개발용)

필요 없습니다. 이미 폴더에 들어 있습니다. 다시 만들고 싶을 때만 쓰세요.

| 목적 | 명령 (프로젝트 폴더에서) |
|---|---|
| 텍스처·보이저 모델 다운로드 (실패한 파일은 마지막에 목록으로 나옴. 그 파일은 브라우저로 직접 받아 같은 폴더에 넣기) | `bash scripts/download-textures.sh` |
| USGS 원본(`raw/`)을 2K 이미지로 변환 | `py scripts/prepare-textures.py raw textures` |
| 가상 텍스처 13개 생성 | `py scripts/gen_fictional_textures.py textures/fictional` |
| 위성 자료 (JPL) | `py scripts/fetch-moons.py` |
| 혜성 자료 (JPL SBDB) | `node scripts/fetch-comets.js` |
| 소행성 자료 (JPL SBDB) | `node scripts/fetch-asteroids.js` |
| 보이저 궤적 (JPL Horizons) | `node scripts/fetch-voyager.js` |

`raw/`(USGS 원본, 약 2.2GB)는 용량이 커서 저장소에 올리지 않습니다.

## 알아 둘 점 (정확도와 한계)

- **행성 위치**는 astronomy-engine이 계산합니다 (정밀).
- **위성·혜성·소행성·보이저 위치**는 NASA JPL 자료로 계산한 어림값입니다. 자료의 기준일(2026-10-06) 부근이 가장 정확하고, 멀어질수록 어긋납니다. 목성 4대 위성·달은 정밀 계산입니다. 자세한 오차는 `plan/phase-1/04-검증.md`.
- 보이저는 2059년까지는 JPL 궤적이고, 그 이후는 마지막 속도로 직선 연장한 "외삽값"입니다.
- **크기와 거리는 보기 좋게 조정**했습니다. 실제 비율이면 행성·위성이 점보다 작아 보이지 않으므로 반지름을 키웠고, 위성은 행성 가까이 모아 그렸습니다. 소행성은 불규칙한 모양이 아니라 구체로 표현합니다.
- **소행성대의 점 구름은 장식용**이며 실제 데이터가 아닙니다 (9개 대표 소행성만 실제 궤도).
- **텍스처 종류**: 카드의 배지로 구분합니다. "실제 지도"(실제 자료 기반), "가상 텍스처(실제 표면 아님)", "단색". Solar System Scope 텍스처는 지도가 비어 있는 부분을 가상 지형으로 채웠다고 밝히고 있습니다(`textures/CREDITS.md`).
- 위성 지도의 경도 정렬(어느 쪽이 행성을 향하는지)은 눈으로 검증하지 못했습니다.

## 출처 (화면 하단에도 표시)

- 텍스처: Solar System Scope (CC BY 4.0), USGS Astrogeology / NASA, 일부 천체는 가상 텍스처
- 위치 계산: astronomy-engine, NASA JPL (Horizons, SBDB)
- 보이저 3D 모델: NASA VTAD
- 자세한 파일별 출처와 이용 조건: `textures/CREDITS.md`, `models/CREDITS.md`
