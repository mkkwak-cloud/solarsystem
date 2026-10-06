#!/usr/bin/env python3
"""
JPL 위성 자료를 받아 data/moons.json 으로 저장한다 (개발 단계에서 1회 실행, 실행 시점에는 인터넷 불필요).

 - 반지름: JPL Planetary Satellite Physical Parameters  https://ssd.jpl.nasa.gov/sats/phys_par/
 - 궤도(주): JPL Horizons API 의 기준일 궤도요소 (황도 J2000 기준, 행성 중심) + 여러 날짜의 값으로 맞춘 공전 속도.
   ※ JPL Planetary Satellite Mean Elements 표(https://ssd.jpl.nasa.gov/sats/elem/)는 읽어서 "jpl_mean_table" 로 같이 기록만 한다.
     검증 결과 그 표는 주기가 3~5자리로 반올림돼 있고(포보스 0.3187일) 토성·천왕성 위성은 기준 방향 정의가 달라서,
     기준일에서 멀어지면 위치가 맞지 않았다 (2026-10-06 에 정밀 계산과 최대 반대편까지 어긋남).
 - 목성 4대 위성·달은 astronomy-engine 이 계산하므로 궤도요소는 쓰지 않는다.

사용: py scripts/fetch-moons.py [출력=data/moons.json]
"""
import html
import json
import math
import re
import sys
import urllib.parse
import urllib.request
from datetime import date

ELEM_URL = "https://ssd.jpl.nasa.gov/sats/elem/"
PHYS_URL = "https://ssd.jpl.nasa.gov/sats/phys_par/"
OUT = sys.argv[1] if len(sys.argv) > 1 else "data/moons.json"

# 표시할 위성 22개 (PRD 3.7). 한글 이름은 화면용.
WANT = {
    "Moon": "달", "Phobos": "포보스", "Deimos": "데이모스",
    "Io": "이오", "Europa": "유로파", "Ganymede": "가니메데", "Callisto": "칼리스토",
    "Mimas": "미마스", "Enceladus": "엔셀라두스", "Tethys": "테티스", "Dione": "디오네",
    "Rhea": "레아", "Titan": "타이탄", "Iapetus": "이아페투스",
    "Miranda": "미란다", "Ariel": "아리엘", "Umbriel": "움브리엘", "Titania": "티타니아", "Oberon": "오베론",
    "Triton": "트리톤", "Proteus": "프로테우스",
}
# astronomy-engine 이 직접 계산하는 위성 (PRD 3.7: 목성 4대 위성은 JupiterMoons, 달은 정확도를 위해 GeoMoon)
ENGINE = {"Moon": "GeoMoon", "Io": "io", "Europa": "europa", "Ganymede": "ganymede", "Callisto": "callisto"}

HORIZONS = "https://ssd.jpl.nasa.gov/api/horizons.api"
EPOCH_JD = 2461320.0            # 2026-10-06 12:00 (TDB) 기준일
EPOCH_LABEL = "2026-10-06 12:00 TDB"
# Horizons 천체 코드와 행성 중심 코드 (엔진 계산 위성 제외)
HZ = {"phobos": ("401", "500@499"), "deimos": ("402", "500@499"),
      "mimas": ("601", "500@699"), "enceladus": ("602", "500@699"), "tethys": ("603", "500@699"), "dione": ("604", "500@699"),
      "rhea": ("605", "500@699"), "titan": ("606", "500@699"), "iapetus": ("608", "500@699"),
      "ariel": ("701", "500@799"), "umbriel": ("702", "500@799"), "titania": ("703", "500@799"), "oberon": ("704", "500@799"),
      "miranda": ("705", "500@799"), "triton": ("801", "500@899"), "proteus": ("808", "500@899")}
OFFSETS_DAYS = [0, 5, 40, 320, 2560, 10000]   # 기준일로부터. 앞 간격으로 공전 횟수를 확정하고 점점 긴 간격으로 속도를 정밀하게 맞춘다


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "solarsystem-sim/0.1"})
    return urllib.request.urlopen(req, timeout=60).read().decode("utf-8", errors="ignore")


def table_rows(page):
    out = []
    for r in re.findall(r"<tr[^>]*>(.*?)</tr>", page, flags=re.S):
        cells = [html.unescape(re.sub(r"<[^>]+>", "", c)).replace("\xa0", " ").strip()
                 for c in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", r, flags=re.S)]
        if cells:
            out.append(cells)
    return out


def num(s):
    s = s.split()[0] if s.split() else ""
    return float(s) if re.fullmatch(r"-?\d+\.?\d*(e-?\d+)?", s) else None


def horizons_elements(cmd, center, jds):
    """황도 J2000 기준 궤도요소. 반환: [(jd, e, i, node, w, M, a_km, n_deg_per_day), ...]"""
    q = dict(format="json", COMMAND=f"'{cmd}'", OBJ_DATA="'NO'", MAKE_EPHEM="'YES'", EPHEM_TYPE="'ELEMENTS'",
             CENTER=f"'{center}'", TLIST="'" + " ".join(f"{j:.6f}" for j in jds) + "'", REF_PLANE="'ECLIPTIC'",
             REF_SYSTEM="'ICRF'", OUT_UNITS="'KM-S'", CSV_FORMAT="'YES'")
    res = json.load(urllib.request.urlopen(HORIZONS + "?" + urllib.parse.urlencode(q), timeout=90))["result"]
    block = re.search(r"\$\$SOE\s*(.*?)\s*\$\$EOE", res, re.S).group(1).strip().splitlines()
    rows = []
    for line in block:
        c = [x.strip() for x in line.split(",")]
        # JDTDB, 날짜, EC, QR, IN, OM, W, Tp, N, MA, TA, A, AD, PR
        rows.append((float(c[0]), float(c[2]), float(c[4]), float(c[5]), float(c[6]), float(c[9]), float(c[11]), float(c[8]) * 86400))
    return rows


def fit_orbit(cmd, center):
    """기준일 요소 + 평균 진행 속도(평균 위도인수 U = ω + M 의 증가율, 도/일).
    U 는 천천히 변하므로 여러 간격(5일~약 27년)의 값으로 공전 횟수를 차례로 확정한다."""
    rows = horizons_elements(cmd, center, [EPOCH_JD + d for d in OFFSETS_DAYS])
    U = [(r[4] + r[5]) % 360 for r in rows]
    rate = rows[0][7]                      # 시작값: 기준일의 순간 평균운동 (도/일)
    for k in range(1, len(rows)):
        dt = rows[k][0] - rows[0][0]
        turns = round((rate * dt - ((U[k] - U[0]) % 360)) / 360)   # 이미 알고 있는 속도로 예측해 공전 횟수 확정
        rate = (360 * turns + ((U[k] - U[0]) % 360)) / dt
    return rows[0], rate


def main():
    elem = table_rows(fetch(ELEM_URL))
    phys = table_rows(fetch(PHYS_URL))

    radius, gm = {}, {}
    for c in phys:
        if len(c) >= 5 and c[1] in WANT:
            gm[c[1]] = num(c[3])      # 첫 숫자 = 값 (뒤는 오차·참고문헌)
            radius[c[1]] = num(c[4])

    moons = []
    seen = set()
    for c in elem:
        if len(c) < 19 or c[2] not in WANT or c[2] in seen:
            continue
        seen.add(c[2])
        f = lambda i: num(c[i]) if i < len(c) else None
        ra, dec = f(16), f(17)
        pole = {"ra_deg": ra, "dec_deg": dec, "tilt_deg": f(18)} if ra is not None and dec is not None else None
        osc = None
        if c[2].lower() in HZ:
            r0, rate = fit_orbit(*HZ[c[2].lower()])
            osc = {"epoch": EPOCH_LABEL, "epoch_jd": EPOCH_JD, "frame": "ecliptic J2000 (ICRF), 행성 중심",
                   "a_km": r0[6], "e": r0[1], "i_deg": r0[2], "node_deg": r0[3], "w_deg": r0[4], "M_deg": r0[5],
                   "U_rate_deg_per_day": rate, "note": "U=ω+M 의 평균 증가율. 모델은 ω, Ω, i, e, a 를 고정하고 M 만 이 속도로 진행시킨다."}
        moons.append({
            "id": c[2].lower(), "name_ko": WANT[c[2]], "name": c[2], "planet": c[1].lower(),
            "engine": ENGINE.get(c[2]),
            "osc": osc,
            "radius_km": radius.get(c[2]), "gm_km3s2": gm.get(c[2]),
            "jpl_mean_table": {                  # 참고용 (계산에는 쓰지 않음)
                "frame": c[5], "epoch": c[6],
                "a_km": f(7), "e": f(8), "w_deg": f(9), "M_deg": f(10), "i_deg": f(11), "node_deg": f(12),
                "P_days": f(13), "P_apsis_yr": f(14), "P_node_yr": f(15), "pole": pole,
            },
        })
    missing = [k for k in WANT if k not in seen]
    data = {
        "_note": "JPL 평균 궤도요소는 궤도의 일반적 모양·방향을 나타내는 값이며 정밀 위치 계산용이 아니다(JPL 경고). 목성 4대 위성과 달은 astronomy-engine 으로 계산한다.",
        "_sources": {"orbit": HORIZONS, "mean_elements_table_reference_only": ELEM_URL, "physical": PHYS_URL, "retrieved": date.today().isoformat()},
        "_definitions": {
            "osc": "Horizons 기준일 궤도요소 (황도 J2000, 행성 중심). 위치는 기준일 부근에서 가장 정확하다.",
        },
        "moons": moons,
    }
    with open(OUT, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=1)
    print(f"저장: {OUT}  위성 {len(moons)}개")
    if missing:
        print("조회 실패:", ", ".join(missing))
    bad = [m["id"] for m in moons if m["radius_km"] is None or (m["engine"] is None and m["osc"] is None)]
    if bad:
        print("값이 빠진 위성:", ", ".join(bad))


if __name__ == "__main__":
    main()
