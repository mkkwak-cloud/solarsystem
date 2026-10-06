// 시뮬레이션 시계. 배속 1x = 현실 1초에 시뮬레이션 1일 (어림 정의, 슬라이더 범위 0.1x ~ 32000x).
export const SPEED_MIN = 0.1;
export const SPEED_MAX = 32000;
const DAY_MS = 86400000;

export class Clock {
  constructor(date = new Date(), speed = 10) {
    this.ms = date.getTime();
    this.speed = speed; // 일/초
    this.paused = false;
  }
  get date() { return new Date(this.ms); }
  set date(d) { this.ms = d.getTime(); }
  tick(dtSec) {
    if (!this.paused) this.ms += dtSec * this.speed * DAY_MS;
  }
}

// 로그 슬라이더(0~1000) <-> 배속
const LOG_SPAN = Math.log10(SPEED_MAX / SPEED_MIN);
export function sliderToSpeed(v) { return SPEED_MIN * Math.pow(10, (v / 1000) * LOG_SPAN); }
export function speedToSlider(s) { return Math.round((Math.log10(s / SPEED_MIN) / LOG_SPAN) * 1000); }
