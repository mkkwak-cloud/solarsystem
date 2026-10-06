// 텍스처 불러오기. 우선순위: 실제 지도 → 가상 텍스처 → (없음 = 단색 구체)
import * as THREE from 'three';

const loader = new THREE.TextureLoader();
const KIND_LABEL = { real: '실제 지도', fictional: '가상 텍스처(실제 표면 아님)', solid: '단색' };
export const kindLabel = (k) => KIND_LABEL[k] ?? k;

async function tryLoad(url, maxAnisotropy) {
  const tex = await loader.loadAsync(url);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

// def: { id, files: [...] }  → { texture|null, kind: 'real'|'fictional'|'solid' }
export async function loadBodyTexture(def, maxAnisotropy = 4) {
  const files = def.files ?? [`2k_${def.id}.jpg`, `1k_${def.id}.jpg`];
  for (const f of files) {
    try { return { texture: await tryLoad(`textures/${f}`, maxAnisotropy), kind: 'real' }; } catch { /* 다음 후보 */ }
  }
  if (def.fictional !== false) {
    try {
      return { texture: await tryLoad(`textures/fictional/1k_${def.id}_fictional.jpg`, maxAnisotropy), kind: 'fictional' };
    } catch { /* 단색 */ }
  }
  return { texture: null, kind: 'solid' };
}

export async function loadPlainTexture(file, maxAnisotropy = 4) {
  try { return await tryLoad(`textures/${file}`, maxAnisotropy); } catch { return null; }
}
