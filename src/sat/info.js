// 국내 위성 설명 정보. 궤도·발사일·발사장은 CelesTrak(data/kr-sats.json)에서 오고, 여기에는 이름·소유(운영)기관·용도만 적는다.
// 출처: 공개 자료(한국항공우주연구원 보도·나무위키 누리호 발사 문서·JPL Horizons 설명문 등)를 읽고 정리. 확실하지 않은 칸은 비워 두거나 '확인 중'으로 적는다.
// norad(번호)로 연결한다. 여기에 없는 위성은 카드에 CelesTrak 에서 받은 정보만 보여준다.

export const GROUPS = {
  obs:    { name: '지구 관측', color: '#6fe0a5' },
  geo:    { name: '정지궤도 (통신·기상·해양)', color: '#ffc86b' },
  sci:    { name: '과학·기술 실증', color: '#8fd3ff' },
  cube:   { name: '큐브위성·초소형 (대학·기업)', color: '#c9a7ff' },
  mil:    { name: '군 관련', color: '#ff8f8f' },
  lunar:  { name: '달 탐사', color: '#ffffff' },
  other:  { name: '기타 (정보 확인 중)', color: '#aab6c8' },
};

const ROCKET_NURI = '누리호 (나로우주센터)';

export const INFO = {
  22077: { ko: '우리별 1호 (KITSAT-A)', owner: 'KAIST 인공위성연구센터', use: '한국 최초의 위성. 위성 제작 기술을 배우고 우주 환경과 지구 촬영을 시험하는 실험 위성.', group: 'sci' },
  22828: { ko: '우리별 2호 (KITSAT-B)', owner: 'KAIST 인공위성연구센터', use: '우리별 1호의 뒤를 잇는 실험 위성. 국내 기술 비중을 높여 지구 촬영·우주 환경 측정을 시험.', group: 'sci' },
  23639: { ko: '무궁화 1호 (KOREASAT 1)', owner: 'KT SAT (당시 한국통신)', use: '통신·방송 중계 (정지궤도).', group: 'geo' },
  25756: { ko: '우리별 3호 (KITSAT-3)', owner: 'KAIST 인공위성연구센터', use: '지구 촬영과 우주과학 관측 실험.', group: 'sci' },
  26032: { ko: '아리랑 1호 (KOMPSAT-1)', owner: '한국항공우주연구원 (KARI)', use: '다목적 실용위성. 지도 제작 등 지구 관측과 해양·우주환경 관측.', group: 'obs' },
  27945: { ko: '과학기술위성 1호 (STSAT-1)', owner: 'KAIST 인공위성연구센터', use: '우주 과학 관측 (원자외선으로 우주를 관측하는 장비 등).', group: 'sci' },
  29268: { ko: '아리랑 2호 (KOMPSAT-2)', owner: '한국항공우주연구원 (KARI)', use: '1m급 고해상도 광학 지구 관측.', group: 'obs', rocket: '로콧 (러시아 플레세츠크)' },
  29349: { ko: '무궁화 5호 (KOREASAT 5)', owner: 'KT SAT', use: '통신·방송 중계 (군 통신 중계 겸용으로 알려짐).', group: 'geo' },
  36744: { ko: '천리안 1호 (COMS 1)', owner: '한국항공우주연구원 · 기상청 등', use: '우리나라 첫 정지궤도 복합위성: 기상·해양 관측과 통신 기술 시험. 임무는 끝나 폐기 궤도에 있음.', group: 'geo' },
  37265: { ko: '무궁화 6호 (KOREASAT 6)', owner: 'KT SAT', use: '통신·방송 중계.', group: 'geo' },
  38338: { ko: '아리랑 3호 (KOMPSAT-3)', owner: '한국항공우주연구원 (KARI)', use: '0.7m급 고해상도 광학 지구 관측.', group: 'obs', rocket: 'H-IIA (일본 다네가시마)' },
  39227: { ko: '아리랑 5호 (KOMPSAT-5)', owner: '한국항공우주연구원 (KARI)', use: '레이더(SAR) 관측. 밤이나 구름 낀 날에도 지표를 촬영.', group: 'obs' },
  39422: { ko: '과학기술위성 3호 (STSAT-3)', owner: 'KAIST 인공위성연구소', use: '소형 위성 기술 실증과 우주·지구 관측.', group: 'sci' },
  40536: { ko: '아리랑 3A호 (KOMPSAT-3A)', owner: '한국항공우주연구원 (KARI)', use: '고해상도 광학 + 적외선 지구 관측.', group: 'obs' },
  42691: { ko: '무궁화 7호 (KOREASAT 7)', owner: 'KT SAT', use: '통신·방송 중계.', group: 'geo' },
  42984: { ko: '무궁화 5A호 (KOREASAT 5A)', owner: 'KT SAT', use: '통신·방송 중계 (군 통신 중계 겸용으로 알려짐).', group: 'geo' },
  43782: { ko: '스누샛-2 (SNUSAT-2)', owner: '서울대학교', use: '대학 큐브위성 (우주 기술 실증).', group: 'cube' },
  43784: { ko: '스누글라이트 (SNUGLITE)', owner: '서울대학교', use: '대학 큐브위성 (우주 기술 실증).', group: 'cube' },
  43811: { ko: '차세대소형위성 1호 (NEXTSAT-1)', owner: 'KAIST 인공위성연구소', use: '소형위성 표준 플랫폼과 우주과학 장비 실증.', group: 'sci' },
  43823: { ko: '천리안 2A호 (GEO-KOMPSAT-2A)', owner: '한국항공우주연구원 · 기상청', use: '기상 관측 위성 (정지궤도). 태풍·구름·황사 등 감시.', group: 'geo' },
  45246: { ko: '천리안 2B호 (GEO-KOMPSAT-2B)', owner: '한국항공우주연구원 · 환경부 · 해양수산부', use: '해양·대기환경 관측 (정지궤도). 미세먼지·적조 등 감시.', group: 'geo' },
  45920: { ko: '코리아샛 116 (KOREASAT 116)', owner: 'KT SAT', use: '통신·방송 중계 (동경 116도 정지궤도).', group: 'geo' },
  47932: { ko: '차세대중형위성 1호 (CAS500-1)', owner: '한국항공우주연구원 · 한국항공우주산업(KAI)', use: '국토·자원·재해 관측용 광학 위성.', group: 'obs', rocket: '소유즈 (러시아 바이코누르)' },
  52894: { ko: '성능검증위성 (PVSAT)', owner: '한국항공우주연구원 (KARI)', use: '누리호 2차 발사에 실린 위성. 발사 성능과 위성 기능을 검증.', group: 'sci', rocket: ROCKET_NURI },
  52897: { ko: 'STEP Cube Lab-II', owner: '확인 중', use: '누리호 2차 발사 큐브위성.', group: 'cube', rocket: ROCKET_NURI },
  52898: { ko: 'RANDEV', owner: '확인 중', use: '누리호 2차 발사 큐브위성.', group: 'cube', rocket: ROCKET_NURI },
  52899: { ko: '스누글라이트-2 (SNUGLITE-II)', owner: '서울대학교', use: '누리호 2차 발사 큐브위성 (대학 우주 기술 실증).', group: 'cube', rocket: ROCKET_NURI },
  52900: { ko: 'MIMAN', owner: '확인 중', use: '누리호 2차 발사 큐브위성.', group: 'cube', rocket: ROCKET_NURI },
  56743: { ko: '차세대소형위성 2호 (NEXTSAT-2)', owner: 'KAIST 인공위성연구소', use: '누리호 3차 발사의 주탑재위성. 세부 임무는 확인 중.', group: 'sci', rocket: ROCKET_NURI },
  56744: { ko: '스닙 4호 (SNIPE 4)', owner: '한국천문연구원 (KASI)', use: '초소형 군집위성 4기 중 하나. 지구 자기권·전리권의 플라즈마(전기를 띤 가스)를 관측.', group: 'sci', rocket: ROCKET_NURI },
  56745: { ko: '스닙 2호 (SNIPE 2)', owner: '한국천문연구원 (KASI)', use: '초소형 군집위성 4기 중 하나. 지구 자기권·전리권의 플라즈마를 관측.', group: 'sci', rocket: ROCKET_NURI },
  56747: { ko: '(이름 미확정) 누리호 3차 발사 큐브위성', owner: '확인 중', use: 'CelesTrak 에 "OBJECT E" 로만 올라와 있어 어느 위성인지 아직 맞추지 못함.', group: 'other', rocket: ROCKET_NURI },
  56748: { ko: '(이름 미확정) 누리호 3차 발사 큐브위성', owner: '확인 중', use: 'CelesTrak 에 "OBJECT F" 로만 올라와 있어 어느 위성인지 아직 맞추지 못함.', group: 'other', rocket: ROCKET_NURI },
  56749: { ko: '(이름 미확정) 누리호 3차 발사 큐브위성', owner: '확인 중', use: 'CelesTrak 에 "OBJECT G" 로만 올라와 있어 어느 위성인지 아직 맞추지 못함.', group: 'other', rocket: ROCKET_NURI },
  58463: { ko: '425 사업 위성 (KORSAT-7)', owner: '국방부 · 국방과학연구소 (공식 세부 정보 비공개)', use: '군 정찰위성(425 사업)으로 알려짐. 공개된 세부 정보가 적음.', group: 'mil' },
  59452: { ko: '425 사업 위성 (KORSAT-1)', owner: '국방부 · 국방과학연구소 (공식 세부 정보 비공개)', use: '군 정찰위성(425 사업)으로 알려짐. 공개된 세부 정보가 적음.', group: 'mil' },
  62377: { ko: '425 사업 위성 (KORSAT-2)', owner: '국방부 · 국방과학연구소 (공식 세부 정보 비공개)', use: '군 정찰위성(425 사업)으로 알려짐. 공개된 세부 정보가 적음.', group: 'mil' },
  63630: { ko: '425 사업 위성 (KORSAT-3)', owner: '국방부 · 국방과학연구소 (공식 세부 정보 비공개)', use: '군 정찰위성(425 사업)으로 알려짐. 공개된 세부 정보가 적음.', group: 'mil' },
  66293: { ko: '425 사업 위성 (KORSAT-4)', owner: '국방부 · 국방과학연구소 (공식 세부 정보 비공개)', use: '군 정찰위성(425 사업)으로 알려짐. 공개된 세부 정보가 적음.', group: 'mil' },
  59587: { ko: '초소형군집위성 1호 (NEONSAT-1)', owner: 'KAIST 인공위성연구소', use: '한반도와 주변 해역을 자주 촬영하는 초소형 군집위성 시험 1호기. 재난·안보 관측용.', group: 'obs', rocket: '일렉트론 (뉴질랜드 마히아)' },
  61910: { ko: '무궁화 6A호 (KOREASAT 6A)', owner: 'KT SAT', use: '통신·방송 중계와 한국형 위성항법 보강시스템(KASS) 신호 중계 겸용.', group: 'geo' },
  63229: { ko: '스페이스아이-T (SPACEEYE-T1)', owner: '쎄트렉아이 (민간)', use: '고해상도 광학 지구 관측 상업 위성.', group: 'obs' },
  66650: { ko: 'BEE-1000', owner: '스페이스린텍', use: '우주 제약: 단백질 결정이 우주에서 자라는 모습을 관찰해 약 개발에 쓸 자료를 얻음 (6U 큐브위성).', group: 'cube', rocket: ROCKET_NURI },
  66651: { ko: '(이름 미확정) 누리호 4차 큐브위성', owner: '확인 중', use: 'CelesTrak 의 "OBJECT B". 세종4호·ETRI Sat·PERSAT 중 하나이나 어느 것인지 아직 맞추지 못함.', group: 'other', rocket: ROCKET_NURI },
  66652: { ko: '(이름 미확정) 누리호 4차 큐브위성', owner: '확인 중', use: 'CelesTrak 의 "OBJECT C". 세종4호·ETRI Sat·PERSAT 중 하나이나 어느 것인지 아직 맞추지 못함.', group: 'other', rocket: ROCKET_NURI },
  66653: { ko: '인하로샛 (INHA-RoSAT)', owner: '인하대학교', use: '돌돌 말았다가 펴는 롤러블 태양전지의 우주 환경 검증 (3U 큐브위성).', group: 'cube', rocket: ROCKET_NURI },
  66654: { ko: 'JACK-003 또는 JACK-004', owner: '코스모웍스', use: '5m급 가시광선 지구 관측 (3U 큐브위성). 두 위성 중 어느 쪽인지는 아직 맞추지 못함.', group: 'cube', rocket: ROCKET_NURI },
  66659: { ko: 'JACK-003 또는 JACK-004', owner: '코스모웍스', use: '5m급 가시광선 지구 관측 (3U 큐브위성). 두 위성 중 어느 쪽인지는 아직 맞추지 못함.', group: 'cube', rocket: ROCKET_NURI },
  66655: { ko: '차세대중형위성 3호 (CAS500-3)', owner: '한국항공우주산업(KAI) · 한국항공우주연구원', use: '누리호 4차 발사의 주탑재위성. 국토·재해 관측용 광학 위성.', group: 'obs', rocket: ROCKET_NURI },
  66656: { ko: '(이름 미확정) 누리호 4차 큐브위성', owner: '확인 중', use: 'CelesTrak 의 "OBJECT G". 세종4호·ETRI Sat·PERSAT 중 하나이나 어느 것인지 아직 맞추지 못함.', group: 'other', rocket: ROCKET_NURI },
  66657: { ko: '스파이론 (SPIRONE)', owner: '세종대학교', use: '적외선으로 바다의 플라스틱 쓰레기를 관측할 수 있는지 검증, 저궤도 항법신호 생성 시험 (2U 큐브위성).', group: 'cube', rocket: ROCKET_NURI },
  66658: { ko: '코스믹 (COSMIC)', owner: '우주로테크', use: '수명이 끝나면 스스로 낙하해 불타는 폐기 장치와 우주 쓰레기 회피 기능 검증 (3U 큐브위성).', group: 'cube', rocket: ROCKET_NURI },
  66660: { ko: 'K-HERO', owner: 'KAIST', use: '초소형 위성용 홀 추력기(전기로 가스를 뿜어 가는 엔진)의 우주 검증 (3U 큐브위성).', group: 'cube', rocket: ROCKET_NURI },
  66661: { ko: '스누글라이트-3 (SNUGLITE-III) 하나·두리', owner: '서울대학교', use: '쌍둥이 큐브위성 2기가 붙어서 나가 편대비행·랑데부를 시험, 날씨 예측 정확도 향상 연구 (3U). 두 기가 붙어 있어 CelesTrak 에는 한 개로 올라 있음.', group: 'cube', rocket: ROCKET_NURI },
  66662: { ko: '국산 소자·부품 검증위성 1호 (EEE Tester-1)', owner: '한국항공우주연구원 (KARI)', use: '국산 우주용 전자 소자·부품이 실제 우주 환경에서 잘 견디는지 검증.', group: 'sci', rocket: ROCKET_NURI },
  66771: { ko: '경기위성 1호 (GYEONGGISAT-1)', owner: '경기도', use: '경기도가 발사한 위성. 세부 임무는 확인 중.', group: 'other' },
  66820: { ko: '아리랑 7호 (KOMPSAT-7)', owner: '한국항공우주연구원 (KARI)', use: '고해상도 광학 지구 관측.', group: 'obs' },
  67614: { ko: '초소형군집위성 1A (NEONSAT-1A)', owner: '확인 중', use: '초소형군집위성 1호(NEONSAT-1)와 이름이 이어지는 위성. 세부 정보는 확인 중.', group: 'obs', rocket: '일렉트론 (뉴질랜드 마히아)' },
  68417: { ko: 'JACK-002', owner: '코스모웍스', use: '큐브위성. 세부 임무는 확인 중.', group: 'cube' },
  68989: { ko: '부산샛 (BUSANSAT)', owner: '확인 중 (이름으로 보아 부산 지역 위성)', use: '지역 위성. 세부 임무는 확인 중.', group: 'other' },
  69013: { ko: '차세대중형위성 2호 (CAS500-2)', owner: '한국항공우주산업(KAI) · 한국항공우주연구원', use: '국토·자원 관측용 위성 (차세대중형위성 시리즈).', group: 'obs' },
  69869: { ko: '차세대중형위성 4호 (CAS500-4)', owner: '한국항공우주산업(KAI) · 한국항공우주연구원', use: '국토·자원 관측용 위성 (차세대중형위성 시리즈).', group: 'obs' },
};

// 발사장 코드(CelesTrak) → 한글
export const SITES = {
  AFETR: '미국 케이프커내버럴', AFWTR: '미국 반덴버그', FRGUI: '기아나우주센터(프랑스령 기아나)', NSC: '나로우주센터 (고흥)',
  SRILR: '인도 사티시다완', PLMSC: '러시아 플레세츠크', TYMSC: '러시아 바이코누르', DLS: '러시아 돔바롭스키', RLLB: '뉴질랜드 마히아(로켓랩)',
  TANSC: '일본 다네가시마', JJSLA: '발사장 코드 JJSLA',
};

// 다누리 (CelesTrak 에 지구 궤도 정보가 없고, JPL Horizons -155 로 따로 그린다)
export const DANURI = {
  ko: '다누리 (KPLO)', en: 'Korea Pathfinder Lunar Orbiter', norad: 53365, intl: '2022-094A',
  owner: '한국항공우주연구원 (KARI)',
  use: '우리나라 첫 달 탐사선. 달 궤도를 돌며 달 표면 촬영·자원 탐사·자기장 측정, 우주인터넷(지연·단절에 강한 통신) 시험.',
  launch: '2022-08-04', site: '미국 케이프커내버럴 (팰컨9)',
  extra: '2022-12-16 달 궤도 진입. 임무는 2027-12까지 연장, 2025-09에 연료를 거의 쓰지 않는 동결 궤도로 전환됐다고 보도됨.',
};

// 누리호 5차 발사(2026-10-07)로 올라간 위성. CelesTrak 에 궤도 정보가 올라오면 자동으로 지도에 나타난다(scripts/fetch-korean-sats.js 다시 실행).
export const PENDING = [
  ...[2, 3, 4, 5, 6].map((n) => ({
    key: `neon${n}`, match: new RegExp(`NEONSAT-?${n}\\b`, 'i'), ko: `초소형군집위성 ${n}호 (NEONSAT-${n})`, owner: 'KAIST 인공위성연구소',
    use: '한반도 주변을 자주 촬영하는 초소형 군집위성(총 5기 중 하나). 재난·안보 관측.', status: '분리·교신 성공 (2026-10-07)', group: 'obs',
  })),
  { key: 'e3t2', ko: '국산 소자·부품 검증위성 2호', owner: '한국항공우주연구원 (KARI)', use: '국산 우주용 소자·부품의 우주 환경 검증.', status: '분리 성공 (2026-10-07)', group: 'sci' },
  { key: 'daejeon1', ko: '대전샛-1호', owner: '대전광역시', use: '교육, 대전 지역 도시 변화 관측, 지역 우주기업 장비 검증 (16U 큐브위성).', status: '분리 성공 (2026-10-07)', group: 'cube' },
  { key: 'bee1012', ko: 'BEE-1012', owner: '스페이스린텍', use: '우주에서 면역항암제·단백질 의약품 결정 성장 관찰 (12U).', status: '교신 성공 (2026-10-07)', group: 'cube' },
  { key: 'sd1', ko: 'SD-1 SAT', owner: '스페이스앤빈', use: '세부 임무 확인 중 (3U).', status: '교신 성공 (2026-10-07)', group: 'cube' },
  { key: 'uely', ko: 'UEL-Y-Sys (율리시스)', owner: '무인탐사연구소', use: '미세먼지 관측, 달 탐사 로버용 장비 시험 (6U).', status: '교신 성공 (2026-10-07)', group: 'cube' },
  { key: 'sledge', ko: 'SLEDGE', owner: '오앤비스페이스', use: '위성항법신호로 전리권 관측, 전파방해 자료 수집 (3U).', status: '교신 성공 (2026-10-07)', group: 'cube' },
  { key: 'jack007', ko: 'JACK-007', owner: '코스모웍스', use: '세부 임무 확인 중.', status: '교신 성공 (2026-10-07)', group: 'cube' },
  { key: 'cpsat', ko: 'CPSat', owner: '조선대학교 · 부산대학교', use: '우주 레이저 통신으로 데이터를 주고받는 기술 검증 (3U).', status: '교신 성공 (2026-10-07)', group: 'cube' },
  { key: 'gbsat', ko: 'GBSAT', owner: 'KAIST', use: '태양 활동이 큰 시기에 지구 자기장을 따라 도는 고에너지 양성자 관측 (3U).', status: '교신 성공 (2026-10-07)', group: 'cube' },
  { key: 'persat2', ko: 'PERSAT-02', owner: '쿼터니언', use: '제주도 해양쓰레기·해류 분석 (3U).', status: '궤도 투입 실패: 사출관 뚜껑이 열리지 않아 위성이 나가지 못함', group: 'cube', failed: true },
];
