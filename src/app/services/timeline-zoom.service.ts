import { Injectable } from '@angular/core';
import { ZoomSpec } from './timeline-date.service';

export interface ZoomAnimationState {
  active: boolean;
  t0: number;
  dur: number;
  startUnit: number;
  endUnit: number;
  keepYear: number | null;
  targetIdx: number;
  hudFromIdx?: number;
  hudToIdx?: number;
  hudStartUnit?: number;
  hudEndUnit?: number;
  startIdx?: number;
  endIdx?: number;
  unitsSeq?: number[];
  stepDist?: number[];
  cumDist?: number[];
  totalDist?: number;
}

export interface CreateZoomAnimationParams {
  startIdx: number;
  endIdx: number;
  keepYear: number;
  zoomLevels: ZoomSpec[];
  durationSingleStepMs: number;
  durationAcrossAllMs: number;
  nowMs: number;
}

export interface ZoomFrame {
  elapsedMs: number;
  totalMs: number;
  unitYears: number;
  segmentIndex: number;
  segmentT: number;
  fadeFrom: number;
  fadeTo: number;
  visualIndex: number;
  liveIdx: number;
  fromIdx: number;
  toIdx: number;
  done: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class TimelineZoomService {
  createAnimation(params: CreateZoomAnimationParams): ZoomAnimationState {
    const {
      startIdx,
      endIdx,
      keepYear,
      zoomLevels,
      durationSingleStepMs,
      durationAcrossAllMs,
      nowMs,
    } = params;
    const startUnit = zoomLevels[startIdx].unit;
    const endUnit = zoomLevels[endIdx].unit;
    const dir = endIdx > startIdx ? 1 : -1;
    const unitsSeq = this.buildUnitSequence(startIdx, endIdx, dir, zoomLevels);
    const stepDist = this.buildStepDistances(unitsSeq);
    const cumDist = this.buildCumulativeDistances(stepDist);
    const totalDist = cumDist[cumDist.length - 1] || 1;
    const dur = this.calculateDuration(
      startIdx,
      endIdx,
      zoomLevels.length,
      durationSingleStepMs,
      durationAcrossAllMs,
    );
    const hudToIdx = startIdx + dir;

    return {
      active: true,
      t0: nowMs,
      dur,
      startUnit,
      endUnit,
      keepYear,
      targetIdx: endIdx,
      hudFromIdx: startIdx,
      hudToIdx,
      hudStartUnit: zoomLevels[startIdx]?.unit ?? startUnit,
      hudEndUnit: zoomLevels[hudToIdx]?.unit ?? endUnit,
      startIdx,
      endIdx,
      unitsSeq,
      stepDist,
      cumDist,
      totalDist,
    };
  }

  getFrame(state: ZoomAnimationState, nowMs: number): ZoomFrame {
    const elapsedMs = Math.max(0, nowMs - state.t0);
    const totalMs = state.dur;
    const g = this.clamp(elapsedMs / totalMs, 0, 1);
    const eased = this.accelCruiseDecel(g, 0.36, 0.36);

    const unitsSeq = state.unitsSeq!;
    const stepDist = state.stepDist!;
    const cumDist = state.cumDist!;
    const totalDist = state.totalDist || 1;
    const dTarget = eased * totalDist;

    let segmentIndex = 0;
    while (segmentIndex < stepDist.length - 1 && dTarget > cumDist[segmentIndex + 1]) {
      segmentIndex++;
    }

    const dSeg = stepDist[segmentIndex] || 1e-6;
    const segmentT = this.clamp((dTarget - cumDist[segmentIndex]) / dSeg, 0, 1);
    const a = unitsSeq[segmentIndex];
    const b = unitsSeq[segmentIndex + 1];
    const r = b > 0 && a > 0 ? b / a : 1;
    const unitYears =
      r > 0 && isFinite(r) ? a * Math.exp(Math.log(r) * segmentT) : this.lerp(a, b, segmentT);

    const startIdx = state.startIdx!;
    const endIdx = state.endIdx!;
    const dir = endIdx > startIdx ? 1 : -1;
    const visualIndex = startIdx + dir * (segmentIndex + segmentT);
    const liveIdx =
      dir > 0
        ? Math.min(endIdx, Math.floor(visualIndex + 1e-6))
        : Math.max(endIdx, Math.ceil(visualIndex - 1e-6));

    return {
      elapsedMs,
      totalMs,
      unitYears,
      segmentIndex,
      segmentT,
      fadeFrom: 1 - segmentT,
      fadeTo: segmentT,
      visualIndex,
      liveIdx,
      fromIdx: startIdx + segmentIndex * dir,
      toIdx: startIdx + (segmentIndex + 1) * dir,
      done: elapsedMs >= totalMs,
    };
  }

  private buildUnitSequence(
    startIdx: number,
    endIdx: number,
    dir: number,
    zoomLevels: ZoomSpec[],
  ): number[] {
    const unitsSeq: number[] = [];
    for (let i = startIdx; i !== endIdx; i += dir) unitsSeq.push(zoomLevels[i].unit);
    unitsSeq.push(zoomLevels[endIdx].unit);
    return unitsSeq;
  }

  private buildStepDistances(unitsSeq: number[]): number[] {
    const stepDist: number[] = [];
    for (let i = 0; i < unitsSeq.length - 1; i++) {
      const a = unitsSeq[i];
      const b = unitsSeq[i + 1];
      const r = b / a;
      stepDist.push(r > 0 && isFinite(r) ? Math.abs(Math.log(r)) : Math.abs(b - a));
    }
    return stepDist;
  }

  private buildCumulativeDistances(stepDist: number[]): number[] {
    const cumDist: number[] = [0];
    for (let i = 0; i < stepDist.length; i++) cumDist.push(cumDist[i] + stepDist[i]);
    return cumDist;
  }

  private calculateDuration(
    startIdx: number,
    endIdx: number,
    zoomLevelCount: number,
    durationSingleStepMs: number,
    durationAcrossAllMs: number,
  ): number {
    const steps = Math.max(1, Math.abs(endIdx - startIdx));
    const allSteps = Math.max(1, zoomLevelCount - 1);
    const norm = allSteps > 1 ? (steps - 1) / (allSteps - 1) : 0;
    const emph = norm * norm;
    return Math.round(durationSingleStepMs + (durationAcrossAllMs - durationSingleStepMs) * emph);
  }

  private accelCruiseDecel(t: number, accelFrac: number = 0.18, decelFrac: number = 0.18): number {
    t = this.clamp(t, 0, 1);
    let a = Math.max(0, Math.min(0.45, accelFrac));
    let d = Math.max(0, Math.min(0.45, decelFrac));
    if (a + d > 0.95) {
      const s = a + d;
      a = (a / s) * 0.95;
      d = (d / s) * 0.95;
    }
    const c = Math.max(0, 1 - a - d);
    const vmax = 1 / (c + 0.5 * (a + d));

    if (t <= a) {
      return (vmax * (t * t)) / (2 * Math.max(a, 1e-6));
    }
    if (t <= a + c) {
      const fAcc = vmax * (a / 2);
      return fAcc + vmax * (t - a);
    }
    const fAccCruise = vmax * (a / 2 + c);
    const s = (t - (a + c)) / Math.max(d, 1e-6);
    return fAccCruise + vmax * (d * (s - 0.5 * s * s));
  }

  private clamp(v: number, a: number, b: number): number {
    return v < a ? a : v > b ? b : v;
  }

  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }
}
