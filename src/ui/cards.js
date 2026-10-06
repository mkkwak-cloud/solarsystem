// 천체 정보 카드 목록
import { kindLabel } from '../scene/textures.js';

export function createCards(container, defs, onSelect, onFocus, onCheck) {
  const els = new Map();
  for (const def of defs) {
    const el = document.createElement('div');
    el.className = 'card';
    const check = def.checkable ? '<input type="checkbox" checked title="표시 켜기/끄기"> ' : '';
    el.innerHTML = `<div class="name"><span>${check}${def.name}</span><span class="badge"></span></div><div class="stats"></div>`;
    const cb = el.querySelector('input[type=checkbox]');
    if (cb) {
      cb.addEventListener('click', (e) => e.stopPropagation());
      cb.addEventListener('dblclick', (e) => e.stopPropagation());
      cb.addEventListener('change', () => onCheck?.(def.id, cb.checked));
    }
    el.addEventListener('click', () => onSelect(def.id));
    el.addEventListener('dblclick', () => onFocus(def.id));
    (typeof container === 'function' ? container(def) : container).appendChild(el);
    els.set(def.id, { el, badge: el.querySelector('.badge'), stats: el.querySelector('.stats') });
  }

  return {
    setHtml(id, html) { els.get(id).stats.innerHTML = html; },
    setChecked(id, v) { const c = els.get(id).el.querySelector('input[type=checkbox]'); if (c) c.checked = v; },
    setBadge(id, text, cls = '') { const b = els.get(id).badge; b.textContent = text; b.className = `badge ${cls}`; },
    // 혜성: { speedKms, speedPct, rAU, perihelion(문자열), qAU, hyperbolic, e }
    setCometStats(id, info) {
      els.get(id).stats.innerHTML = `속도: 지구 대비 ${info.speedPct.toFixed(0)}% (${info.speedKms.toFixed(1)} km/s)<br>` +
        `태양과의 거리: ${info.rAU.toFixed(info.rAU < 10 ? 3 : 1)} AU<br>` +
        `근일점: ${info.perihelion} (${info.qAU.toFixed(3)} AU)` + (info.hyperbolic ? `<br>쌍곡선 궤도 (e=${info.e.toFixed(2)}): 태양계를 지나쳐 갑니다` : '');
    },
    setSelected(id) { for (const [k, v] of els) v.el.classList.toggle('sel', k === id); },
    setKind(id, kind, note) {
      const b = els.get(id).badge;
      b.textContent = kindLabel(kind) + (note && kind !== 'solid' ? ` · ${note}` : '');
      b.className = `badge ${kind}`;
    },
    // 위성: { speedKms, hostName, hostDistKm, sunDistAU }
    setMoonStats(id, info) {
      els.get(id).stats.innerHTML = `속도: ${info.speedKms.toFixed(2)} km/s (${info.hostName} 기준)<br>` +
        `${info.hostName}까지 거리: ${Math.round(info.hostDistKm).toLocaleString('en-US')} km<br>태양과의 거리: ${info.sunDistAU.toFixed(3)} AU`;
    },
    // info: { speedPct, speedKms, distAU } (태양은 속도 없음)
    setStats(id, info) {
      const s = els.get(id).stats;
      s.innerHTML = info.speedPct == null
        ? '공전 속도: -<br>태양과의 거리: 0 AU'
        : `속도: 지구 대비 ${info.speedPct.toFixed(0)}% (${info.speedKms.toFixed(1)} km/s)<br>태양과의 거리: ${info.distAU.toFixed(3)} AU`;
    },
  };
}
