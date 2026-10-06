#!/usr/bin/env bash
# 태양계 시뮬레이터 텍스처/모델 다운로드 (Mac/Linux/Git Bash). 사용: bash download-textures.sh
# 받은 원본은 raw/ (USGS 지도), textures/ (Solar System Scope), models/ (NASA 보이저)에 저장된다.
# 이어받기(-C -)를 쓰므로 중간에 끊겨도 다시 실행하면 이어서 받는다.
# 실패한 파일은 마지막에 목록으로 보여준다. 그 파일은 브라우저로 직접 받아 같은 폴더에 넣으면 된다.
set -u
mkdir -p raw textures models
FAILED=()

get() { # get <URL> <저장경로>
  local url="$1" dest="$2"
  if [ -s "$dest" ]; then echo "SKIP $dest (이미 있음)"; return; fi
  if curl -fL --retry 3 -C - -o "$dest" "$url"; then
    echo "OK   $dest ($(du -h "$dest" | cut -f1))"
  else
    echo "FAIL $dest"; rm -f "$dest"; FAILED+=("$url")
  fi
}

# --- 1. Solar System Scope (CC BY 4.0, 출처 표기 필수) ---
SSS=https://www.solarsystemscope.com/textures/download
for f in 2k_sun.jpg 2k_mercury.jpg 2k_venus_surface.jpg 2k_earth_daymap.jpg \
         2k_earth_nightmap.jpg 2k_earth_clouds.jpg 2k_moon.jpg 2k_mars.jpg \
         2k_jupiter.jpg 2k_saturn.jpg 2k_saturn_ring_alpha.png 2k_uranus.jpg \
         2k_neptune.jpg 2k_stars_milky_way.jpg; do
  get "$SSS/$f" "textures/$f"
done

# --- 2. NASA 보이저 3D 모델 (glTF/GLB, 2.98 MB) ---
get "https://assets.science.nasa.gov/content/dam/science/psd/solar/2023/09/v/Voyager.glb" "models/voyager.glb"

# --- 3. USGS Astropedia 지도 (원본 GeoTIFF, 용량 큼) ---
USGS=https://planetarymaps.usgs.gov/mosaic
# 작은 것부터 (필요 없는 것은 줄을 지우거나 주석 처리)
get "$USGS/Titan_ISS_P19658_Mosaic_Global_4km.tif" "raw/Titan_ISS_P19658_Mosaic_Global_4km.tif"
get "$USGS/Ceres_Dawn_FC_DLR_global_20ppd_Oct2015.tif" "raw/Ceres_Dawn_FC_DLR_global_20ppd_Oct2015.tif" # 26 MB
get "$USGS/Charon_NewHorizons_Global_Mosaic_300m_Jul2017_8bit.tif" "raw/Charon_NewHorizons_Global_Mosaic_300m_Jul2017_8bit.tif" # 77 MB
get "$USGS/Enceladus_Cassini_mosaic_global_110m.tif" "raw/Enceladus_Cassini_mosaic_global_110m.tif" # 99 MB
get "$USGS/Phobos_Viking_Mosaic_40ppd_DLRcontrol.tif" "raw/Phobos_Viking_Mosaic_40ppd_DLRcontrol.tif" # 99 MB
get "$USGS/Triton_Voyager2_ClrMosaic_GlobalFill_600m.tif" "raw/Triton_Voyager2_ClrMosaic_GlobalFill_600m.tif" # 287 MB
get "$USGS/Pluto_NewHorizons_Global_Mosaic_300m_Jul2017_8bit.tif" "raw/Pluto_NewHorizons_Global_Mosaic_300m_Jul2017_8bit.tif" # 296 MB
get "$USGS/Vesta_Dawn_FC_HAMO_Mosaic_Global_74ppd.tif" "raw/Vesta_Dawn_FC_HAMO_Mosaic_Global_74ppd.tif" # 341 MB
get "$USGS/Dione_Cassini_Voyager_mosaic_global_154m.tif" "raw/Dione_Cassini_Voyager_mosaic_global_154m.tif"
get "$USGS/Iapetus_Cassini_Voyager_mosaic_global_783m.tif" "raw/Iapetus_Cassini_Voyager_mosaic_global_783m.tif"
get "$USGS/Tethys_Cassini_mosaic_global_293m.tif" "raw/Tethys_Cassini_mosaic_global_293m.tif"

# 2026-10-06 각 Astropedia 페이지에서 확인한 주소 (모두 Simple Cylindrical, 경도는 서쪽이 +)
# 레아: .tif(Rhea_Voyager_mosaic_global_833m.tif)는 보이저만으로 만든 부분 지도라 쓰지 않는다(2026-10-06 확인).
#   대신 Astropedia 417m 지도 페이지의 1024px 샘플(전역, equirectangular)을 textures/1k_rhea.jpg 로 사용:
get "https://astrogeology.usgs.gov/ckan/dataset/22bc1015-d9c9-4212-86c3-e42061b204d4/resource/77fa77f8-6d6b-4072-9360-17138caa6e7d/download/full.jpg" "textures/1k_rhea.jpg"
# 미마스: NASA PIA18437 색 강조 컬러 지도 (Wikimedia Commons 공개 자료, 6356x3178). 받은 뒤 prepare-textures.py 가 2K 로 줄인다.
get "https://upload.wikimedia.org/wikipedia/commons/4/4f/Map_of_Mimas_colorized_2014-04_PIA18437.jpg" "raw/Mimas_PIA18437_colorized.jpg"
# 이오 (페이지: .../search/map/io_galileo_ssi_voyager_color_merged_global_mosaic_1km)
get "$USGS/Io_GalileoSSI-Voyager_Global_Mosaic_ClrMerge_1km.tif" "raw/Io_GalileoSSI-Voyager_Global_Mosaic_ClrMerge_1km.tif" # 189 MB
# 유로파 (페이지: .../search/map/europa_voyager_galileo_ssi_global_mosaic_500m)
get "$USGS/Europa_Voyager_GalileoSSI_global_mosaic_500m.tif" "raw/Europa_Voyager_GalileoSSI_global_mosaic_500m.tif" # 184 MB
# 가니메데 (페이지: .../search/map/ganymede_voyager_galileo_ssi_global_mosaic_1km)
get "$USGS/Ganymede_Voyager_GalileoSSI_global_mosaic_1km.tif" "raw/Ganymede_Voyager_GalileoSSI_global_mosaic_1km.tif" # 131 MB
# 칼리스토 (페이지: .../search/map/callisto_galileo_voyager_global_mosaic_1km)
get "$USGS/Callisto_Voyager_GalileoSSI_global_mosaic_1km.tif" "raw/Callisto_Voyager_GalileoSSI_global_mosaic_1km.tif" # 110 MB

echo
if [ ${#FAILED[@]} -gt 0 ]; then
  echo "=== 받지 못한 파일 (브라우저로 직접 받아 저장 후 다시 실행) ==="
  printf '%s\n' "${FAILED[@]}"
else
  echo "모두 완료"
fi
echo "다음 단계: python3 prepare-textures.py raw textures (USGS 원본을 2K JPG로 변환)"
