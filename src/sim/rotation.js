// 천체의 자전 방향(쿼터니언). 구체(three.js SphereGeometry)의 지도 가운데(경도 0°)가 +X, 북극이 +Y, 동쪽이 -Z 이다.
import * as THREE from 'three';
import { ROTATION } from '../data/rotation.js';
import { eqjToScene } from './ephemeris.js';

const DEG = Math.PI / 180;
const J2000_JD = 2451545.0;

// J2000 적도 좌표(EQJ) -> 화면 좌표 변환 행렬 (EQJ 의 x, y, z 축이 화면에서 가리키는 방향이 열)
const toVec = (v) => new THREE.Vector3(v.x, v.y, v.z);
const B = new THREE.Matrix4().makeBasis(
  toVec(eqjToScene({ x: 1, y: 0, z: 0 })), toVec(eqjToScene({ x: 0, y: 1, z: 0 })), toVec(eqjToScene({ x: 0, y: 0, z: 1 })));
// 구체 국소 좌표(X=경도 0°, Y=북극, Z=서쪽) -> IAU 천체 고정 좌표(x=경도 0°, y=동쪽, z=북극)
const LOCAL_TO_BODY = new THREE.Matrix4().makeBasis(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, -1, 0));

const mRaise = new THREE.Matrix4(), mTilt = new THREE.Matrix4(), mSpin = new THREE.Matrix4(), mTmp = new THREE.Matrix4();

// 북극 방향 (화면 좌표 단위벡터)
export function poleDirection(id) {
  const r = ROTATION[id], a = r.ra * DEG, d = r.dec * DEG;
  return toVec(eqjToScene({ x: Math.cos(d) * Math.cos(a), y: Math.cos(d) * Math.sin(a), z: Math.sin(d) }));
}

// 자전 위상 W (도)
export function spinAngleDeg(id, jd) {
  const r = ROTATION[id];
  return r.W0 + r.rate * (jd - J2000_JD);
}

// 자전을 반영한 방향. jd: 율리우스일 (자전을 멈추려면 고정된 jd 를 넘긴다)
export function orientation(id, jd, out = new THREE.Quaternion()) {
  const r = ROTATION[id];
  mRaise.makeRotationZ((r.ra + 90) * DEG);
  mTilt.makeRotationX((90 - r.dec) * DEG);
  mSpin.makeRotationZ(spinAngleDeg(id, jd) * DEG);
  mTmp.copy(B).multiply(mRaise).multiply(mTilt).multiply(mSpin).multiply(LOCAL_TO_BODY);
  return out.setFromRotationMatrix(mTmp);
}
