// Derived from PicaSim by Danny Chapman (https://github.com/Rowlhouse/PicaSim), PolyForm Noncommercial License 1.0.0.
// Required Notice: Copyright (c) 2026 Danny Chapman (https://www.rowlhouse.co.uk/PicaSim). See NOTICE.
// Port of AerofoilDefinition.cpp (CL/CD/CM curves with stall, drag bucket, Reynolds scaling, aspect-ratio corrections) and the
// per-element force calculation (prop wash, wing wash, ground effect, shadowing, downwash).
import * as THREE from "three";
import { DEG, clamp, smoothStep } from "./math.js";

const PI = Math.PI, TWO_PI = 2 * PI, HALF_PI = PI / 2, KIN_VISC = 1.5e-5;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export const AEROFOIL_DEFAULTS = {
  liftPositionOffsetFractionForwards: 0.5, liftPositionOffsetFractionReverse: -0.5,
  CDFlying: 0.01, CDStalled: 1.7, CM0: 0, CMPerDeg: 0, refRe: 200000, CDPower: -0.15, minReFrac: 0.1,
  CL0: 0, CLPerDeg: 0.1, positiveAttachedAngle: 9, positiveStallRange: 10, negativeAttachedAngle: -9, negativeStallRange: -10,
  dragBucketFactor: 0.2,
};

export class AerofoilDefinition {
  constructor(p = {}) {
    const d = { ...AEROFOIL_DEFAULTS, ...p };
    d.dragBucketLowerAngle = p.dragBucketLowerAngle ?? d.negativeAttachedAngle;
    d.dragBucketUpperAngle = p.dragBucketUpperAngle ?? d.positiveAttachedAngle;
    Object.assign(this, d);
    const pts = [];
    const add = (angle, CL, flying, turb) => pts.push({ angle: angle * DEG, CL, flying, turb });
    const numPts = 32;
    const stallRegion = (start, range) => {
      for (let i = 0; i !== numPts; i++) {
        const frac = i / (numPts - 1), angle = start + frac * range, CL = d.CL0 + d.CLPerDeg * angle;
        const flying = 0.5 + 0.5 * Math.cos(frac * PI);
        const drag = d.dragBucketFactor + (1 - d.dragBucketFactor) * (1 - flying);
        add(angle, CL, flying, drag);
      }
    };
    const midRange = (start, end, trans) => {
      const midBucket = 0.5 * (d.dragBucketLowerAngle + d.dragBucketUpperAngle), half = 0.5 * (d.dragBucketUpperAngle - d.dragBucketLowerAngle);
      for (let i = 1; i < numPts - 1; i++) {
        const frac = i / (numPts - 1), angle = start + frac * (end - start), CL = d.CL0 + d.CLPerDeg * angle;
        const t = (Math.abs(angle - midBucket) - half) / trans;
        add(angle, CL, 1, smoothStep(t) * d.dragBucketFactor);
      }
    };
    const CL0Rev = -d.CL0 * 0.25;                                       // reversed flow
    add(160, -0.1, 0, 1); add(170, CL0Rev - 1, -1, 1); add(-180, CL0Rev, -1, 1); add(-170, CL0Rev + 1, -1, 1); add(-160, 0.1, 0, 1);
    const trans = 0.2 * (d.dragBucketUpperAngle - d.dragBucketLowerAngle);
    add(-90, 0, 0, 1);
    stallRegion(d.negativeAttachedAngle, d.negativeStallRange);
    midRange(d.negativeAttachedAngle, d.positiveAttachedAngle, trans);
    stallRegion(d.positiveAttachedAngle, d.positiveStallRange);
    add(90, 0, 0, 1);
    pts.sort((a, b) => a.angle - b.angle);
    const N = 512; this.graph = new Array(N);
    for (let i = 0; i !== N; i++) this.graph[i] = interpolate((i * TWO_PI) / N, pts);
  }

  // Returns { CL, flying, turb, angle } (angle normalised to the graph)
  graphData(angleOfAttack, effectiveAR) {
    const CLSlope = 0.1 * 180 / PI;
    let CLScale = 1 / (1 + CLSlope / (PI * effectiveAR));
    const aoaScale = clamp(CLScale, 0.3, 1);
    CLScale = CLScale / aoaScale;
    let a = angleOfAttack;
    if (a < -HALF_PI) a += TWO_PI; else if (a > 3 * HALF_PI) a -= TWO_PI;
    a = a < HALF_PI ? a * aoaScale : PI + (a - PI) * aoaScale;
    a += 8 * PI;
    const n = this.graph.length, da = TWO_PI / n, i = Math.floor(a / da), fi = (a - i * da) / da;
    const d0 = this.graph[i % n], d1 = this.graph[(i % n + 1) % n];
    let angle = (i % n + fi) * da; if (angle > PI) angle -= TWO_PI;
    return { CL: (fi * d1.CL + (1 - fi) * d0.CL) * CLScale, flying: fi * d1.flying + (1 - fi) * d0.flying, turb: fi * d1.turb + (1 - fi) * d0.turb, angle };
  }

  // cfg: { ext: Vector3 (x = chord), spanEff, controlHalfSpeed }; control: { extraCL, extraCM, extraCD, extraCamber, extraAngle, CDScale }
  flightData(cfg, control, effectiveAR, speedSq, aoa) {
    const controlFrac = cfg.controlHalfSpeed > 0 ? 1 / (1 + speedSq / (cfg.controlHalfSpeed ** 2)) : 1;
    aoa += control.extraAngle * controlFrac;
    const sinAoA = Math.sin(aoa), sin2AoA = Math.sin(2 * aoa);
    const g = this.graphData(aoa, effectiveAR);
    let CL = g.CL; const flying = g.flying, turbulentDrag = g.turb, f = Math.abs(flying);
    let CLFortyFive = 1.1; CLFortyFive *= 1 / (1 + 1 / effectiveAR);
    CL = f * CL + (1 - f) * CLFortyFive * sin2AoA;
    const effectiveness = 1 - (1 - 0.3) * (1 - f);
    CL += control.extraCL * controlFrac * effectiveness;
    const speed = Math.sqrt(speedSq), re = speed * cfg.ext.x / KIN_VISC;
    const reFrac = Math.max(re / this.refRe, this.minReFrac);
    const CDScale = control.CDScale * Math.pow(reFrac, this.CDPower);
    const AR = effectiveAR > 1 ? effectiveAR : 1 / effectiveAR;
    let CDStalled = 2 - 0.82 * (1 - Math.exp(-17 / AR));
    const extraCDFromCamber = 1 * control.extraCamber / (90 * DEG);
    CDStalled += aoa > 0 ? extraCDFromCamber : -extraCDFromCamber;
    const stalledCD = 0.1 + (CDStalled - 0.1) * Math.abs(sinAoA);
    const CDInduced = f * CDScale * CL * CL / (PI * effectiveAR * cfg.spanEff);
    const CDControl = f * CDScale * control.extraCD;
    const CDForm = (1 - turbulentDrag) * this.CDFlying * CDScale + turbulentDrag * stalledCD;
    const CD = CDForm + CDInduced + CDControl;
    let CM = this.CM0 + control.extraCM;
    if (aoa < 0.5 * PI && aoa > -0.5 * PI) CM += this.CMPerDeg * (aoa / DEG);
    CM *= flying;
    const CLAdjusted = CL / (1 + Math.abs(CL) / (PI * effectiveAR));
    CL += f * (CLAdjusted - CL);
    return { CL, CD, CM, flying };
  }
}

function interpolate(angle, pts) {
  if (angle > PI) angle -= TWO_PI; else if (angle < -PI) angle += TWO_PI;
  const n = pts.length;
  for (let i = 0; i !== n; i++) {
    const d0 = pts[i];
    if (d0.angle <= angle) {
      const d1 = pts[(i + 1) % n]; let a1 = d1.angle; if (i === n - 1) a1 += TWO_PI;
      if (a1 >= angle) {
        const frac = (angle - d0.angle) / (a1 - d0.angle);
        return { CL: frac * d1.CL + (1 - frac) * d0.CL, flying: frac * d1.flying + (1 - frac) * d0.flying, turb: clamp(frac * d1.turb + (1 - frac) * d0.turb, 0, 1) };
      }
    }
  }
  return { CL: 0, flying: 0, turb: 1 };
}

// One aerofoil element. cfg: { offset: Tm (in the aeroplane frame), ext, shadow, area, AR, spanEff, controlHalfSpeed, groundEffect,
// washEngine: {name, fraction}, washWings: [{name, fraction}] }. par: { tm: Tm (world), vel }. ctx = the aeroplane.
export function applyAerofoilForces(def, cfg, par, control, ctx, st) {
  const pos = par.tm.p;
  let globalWind = ctx.windAt(pos);
  let effectiveAR = cfg.AR;
  if (cfg.groundEffect) {
    const height = pos.z, span = cfg.ext.x * cfg.AR, heightRatio0 = 3 * height / span;
    if (heightRatio0 < 1) effectiveAR *= 1 / Math.max(heightRatio0, 0.5);
  }
  if (cfg.washEngine && cfg.washEngine.fraction !== 0) {
    const engine = ctx.getEngine(cfg.washEngine.name);
    if (engine) {
      const engineTM = engine.tm, washAngVel = V();
      let engineWash = engine.getLastWash(washAngVel);
      let offset = pos.clone().sub(engineTM.p);
      if (engineWash.dot(offset) > 0) {
        const washSpeed = engineWash.length(), offsetLength = offset.length();
        if (offsetLength * washSpeed > 0) {
          const overall = 0.5 * (cfg.washEngine.fraction + 1);
          const airflow = engineWash.clone().multiplyScalar(overall).add(globalWind).sub(par.vel);
          const d = airflow.dot(offset);
          if (d > 0) {
            const washDir = engineWash.clone().divideScalar(washSpeed);
            const lagTime = offset.lengthSq() / d;
            offset.add(globalWind.clone().sub(par.vel).multiplyScalar(lagTime));
            const sideOffset = offset.clone().sub(washDir.clone().multiplyScalar(offset.dot(washDir))).length();
            const radius = engine.radius + offsetLength * 0.5;
            engineWash.multiplyScalar(clamp(1 - (sideOffset - radius) / radius, 0, 1));
            const angVel = ctx.angularVelocityWorld(), rot = angVel.length() * lagTime;
            if (rot > 0) engineWash.applyQuaternion(new THREE.Quaternion().setFromAxisAngle(angVel.clone().normalize(), rot));
            globalWind = globalWind.clone().add(engineWash.multiplyScalar(cfg.washEngine.fraction));
          }
          if (washAngVel.lengthSq() > 0) {
            const washDir = washAngVel.clone().normalize();
            const off2 = pos.clone().sub(engineTM.p); off2.sub(washDir.clone().multiplyScalar(off2.dot(washDir)));
            globalWind = globalWind.clone().add(washAngVel.clone().cross(off2).multiplyScalar(cfg.washEngine.fraction));
          }
        }
      }
    }
  }
  for (const w of cfg.washWings || []) {
    if (!w.fraction) continue;
    const wing = ctx.getWing(w.name);
    if (!wing) continue;
    const wingPos = wing.worldPos();
    const airflow0 = globalWind.clone().sub(par.vel), offset = pos.clone().sub(wingPos), d = airflow0.dot(offset);
    const wash = wing.lastWash.clone();
    if (d > 0) {
      const lagTime = offset.lengthSq() / d, angVel = ctx.angularVelocityWorld(), rot = angVel.length() * lagTime;
      if (rot > 0) wash.applyQuaternion(new THREE.Quaternion().setFromAxisAngle(angVel.clone().normalize(), rot));
    }
    const dot = offset.clone().normalize().dot(airflow0.clone().normalize());
    if (dot > 0) globalWind = globalWind.clone().add(wash.multiplyScalar(dot * w.fraction));
  }
  // Airflow in the aerofoil frame (+x forward along the chord, +y left, +z up)
  let airflow = par.tm.rotateInv(globalWind.clone().sub(par.vel));
  const airflowDir = airflow.clone().normalize();
  const shadowAmount = Math.min(airflowDir.dot(cfg.shadow), 1);
  if (shadowAmount > 0) airflow.multiplyScalar(1 - shadowAmount);
  let speedSq = airflow.lengthSq();
  const minSpeed = 1e-6;
  if (speedSq < minSpeed * minSpeed) { speedSq = minSpeed * minSpeed; airflow.x = -minSpeed; }
  const beta = Math.atan2(Math.abs(airflow.y), Math.abs(airflow.x));
  const span0 = effectiveAR * cfg.ext.x, area0 = span0 * cfg.ext.x;
  const effSpan = span0 * Math.cos(beta) + cfg.ext.x * Math.sin(beta);
  effectiveAR = effSpan * effSpan / area0;
  let tangential = Math.hypot(airflow.x, airflow.y); tangential = airflow.x > 0 ? tangential : -tangential;
  const aoa = Math.atan2(airflow.z, -tangential);
  const { CL, CD, CM, flying } = def.flightData(cfg, control, effectiveAR, speedSq, aoa);
  st.lastAoA = aoa;
  const fap = pos.clone();                                              // force application point
  const rx = par.tm.rowX();
  if (flying > 0) fap.add(rx.clone().multiplyScalar(flying * def.liftPositionOffsetFractionForwards * cfg.ext.x * 0.5));
  else fap.sub(rx.clone().multiplyScalar(flying * def.liftPositionOffsetFractionReverse * cfg.ext.x * 0.5));
  const dynP = 0.5 * ctx.airDensity * speedSq;
  const liftForce = cfg.area * dynP * CL, dragForce = cfg.area * dynP * CD, pitchingMoment = -CM * cfg.area * dynP * cfg.ext.x;
  const dragDir = par.tm.rotate(airflow.clone().normalize());
  const rightDir = par.tm.rowZ().cross(dragDir).normalize();
  let liftDir = dragDir.clone().cross(rightDir).normalize();
  if (airflow.x > 0) liftDir.negate();
  const pitchingDir = dragDir.clone().cross(liftDir);
  const force = liftDir.clone().multiplyScalar(liftForce).add(dragDir.clone().multiplyScalar(dragForce));
  ctx.applyForceAtPoint(force, fap);
  ctx.applyTorque(pitchingDir.multiplyScalar(pitchingMoment));
  const downwashAngle = (2 / PI) * CL / effectiveAR;
  const wash = liftDir.multiplyScalar(downwashAngle * airflow.x);
  return { flying, wash, force, aoa, CL, CD };
}
