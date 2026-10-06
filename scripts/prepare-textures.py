#!/usr/bin/env python3
"""
raw/ 폴더의 원본 지도(.tif/.jpg/.png)를 2048x1024 JPG로 변환해 textures/ 에 저장한다.

사용: python3 prepare-textures.py [raw폴더=raw] [출력폴더=textures] [가로=2048]
필요: Pillow, numpy (큰 GeoTIFF가 Pillow로 안 열리면 gdal_translate 사용)

- 16비트/실수형 GeoTIFF는 상하위 0.5% 를 잘라내 8비트로 늘린다.
- 이미 JPG/PNG 인 파일은 크기만 줄인다. (토성 고리 알파 PNG는 변환하지 않고 복사)
"""
import os
import shutil
import subprocess
import sys

import numpy as np
from PIL import Image, ImageFile

Image.MAX_IMAGE_PIXELS = None
ImageFile.LOAD_TRUNCATED_IMAGES = True  # 레아처럼 마지막 한 줄이 모자란 파일 허용

RAW = sys.argv[1] if len(sys.argv) > 1 else "raw"
OUT = sys.argv[2] if len(sys.argv) > 2 else "textures"
W = int(sys.argv[3]) if len(sys.argv) > 3 else 2048
H = W // 2

# 원본 파일명 -> 출력 파일명(확장자 제외)
NAMES = {
    "Titan_ISS_P19658_Mosaic_Global_4km": "titan",
    "Enceladus_Cassini_mosaic_global_110m": "enceladus",
    "Ceres_Dawn_FC_DLR_global_20ppd_Oct2015": "ceres",
    "Vesta_Dawn_FC_HAMO_Mosaic_Global_74ppd": "vesta",
    "Pluto_NewHorizons_Global_Mosaic_300m_Jul2017_8bit": "pluto",
    "Charon_NewHorizons_Global_Mosaic_300m_Jul2017_8bit": "charon",
    "Dione_Cassini_Voyager_mosaic_global_154m": "dione",
    "Iapetus_Cassini_Voyager_mosaic_global_783m": "iapetus",
    "Tethys_Cassini_mosaic_global_293m": "tethys",
    "Triton_Voyager2_ClrMosaic_GlobalFill_600m": "triton",
    "Phobos_Viking_Mosaic_40ppd_DLRcontrol": "phobos",
    "Mimas_PIA18437_colorized": "mimas",
    "Io_GalileoSSI-Voyager_Global_Mosaic_ClrMerge_1km": "io",
    "Europa_Voyager_GalileoSSI_global_mosaic_500m": "europa",
    "Ganymede_Voyager_GalileoSSI_global_mosaic_1km": "ganymede",
    "Callisto_Voyager_GalileoSSI_global_mosaic_1km": "callisto",
}


def to_uint8(arr):
    """16비트/실수 배열을 8비트로 (퍼센타일 스트레칭)."""
    if arr.dtype == np.uint8:
        return arr
    a = arr.astype(np.float32)
    valid = a[np.isfinite(a)]
    if valid.size == 0:
        return np.zeros(a.shape, np.uint8)
    lo, hi = np.percentile(valid[:: max(1, valid.size // 2_000_000)], [0.5, 99.5])
    if hi <= lo:
        hi = lo + 1
    return np.clip((a - lo) / (hi - lo) * 255, 0, 255).astype(np.uint8)


def open_resized(path):
    """Pillow 로 열어 목표 크기로 축소. 실패하면 None."""
    try:
        im = Image.open(path)
        im.draft("RGB", (W, H))  # JPEG 일 때만 효과
        if im.mode in ("I;16", "I;16B", "I;16L", "I", "F"):
            im = Image.fromarray(to_uint8(np.array(im)))
        elif im.mode in ("RGBA", "LA", "P", "CMYK"):
            im = im.convert("RGB")
        if im.size[0] > W * 8:  # 아주 큰 이미지는 2단계로 축소해 메모리 절약
            im = im.resize((W * 2, H * 2), Image.BILINEAR)
        return im.resize((W, H), Image.LANCZOS)
    except Exception as e:  # noqa: BLE001
        print("  Pillow 로 열지 못함:", e)
        return None


def gdal_fallback(path, tmp_jpg):
    if not shutil.which("gdal_translate"):
        return None
    cmd = ["gdal_translate", "-of", "JPEG", "-ot", "Byte", "-scale",
           "-outsize", str(W), str(H), "-co", "QUALITY=88", path, tmp_jpg]
    print("  gdal_translate 사용")
    if subprocess.run(cmd, capture_output=True).returncode == 0:
        return Image.open(tmp_jpg).convert("RGB")
    return None


def main():
    os.makedirs(OUT, exist_ok=True)
    files = sorted(f for f in os.listdir(RAW) if not f.startswith("."))
    if not files:
        print(f"{RAW}/ 가 비어 있습니다. 원본을 먼저 받으세요.")
        return
    for f in files:
        stem, ext = os.path.splitext(f)
        src = os.path.join(RAW, f)
        if ext.lower() == ".png" and "ring" in stem.lower():
            shutil.copy(src, os.path.join(OUT, f))
            print("복사(알파 PNG):", f)
            continue
        if ext.lower() not in (".tif", ".tiff", ".jpg", ".jpeg", ".png"):
            continue
        name = NAMES.get(stem, stem)
        dst = os.path.join(OUT, f"2k_{name}.jpg")
        print("변환:", f, "->", dst)
        im = open_resized(src) or gdal_fallback(src, dst + ".tmp.jpg")
        if im is None:
            print("  실패: 이 파일은 건너뜁니다.")
            continue
        im.convert("RGB").save(dst, quality=88, optimize=True)
        tmp = dst + ".tmp.jpg"
        if os.path.exists(tmp):
            os.remove(tmp)
        print("  완료", os.path.getsize(dst) // 1024, "KB")


if __name__ == "__main__":
    main()
