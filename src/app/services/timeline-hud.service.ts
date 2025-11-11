import { Injectable } from '@angular/core';

export interface HudLayer {
  el: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  unit: number;
  id: string;
}

export interface DrawCenterlineParams {
  canvas: HTMLCanvasElement;
  canvasWidth: number;
  canvasHeight: number;
  dpr: number;
  screenWidth: number;
  currentZoomIdx: number;
  scrollY: number;
  scrollMin: number | null;
  scrollMax: number | null;
  entries: Array<{ yf: number }>;
  yearToY: (y: number) => number;
  formatLabel: (year: number, unit: number) => string;
  snapToUnit: (year: number, unit: number) => number;
}

export interface DrawHudLayerParams {
  ctx: CanvasRenderingContext2D;
  canvasWidth: number;
  canvasHeight: number;
  dpr: number;
  screenWidth: number;
  unitYears: number;
  yearToY: (y: number) => number;
  yToYearDev: (yDev: number) => number;
  nowYearFraction: () => number;
  formatLabelByUnit: (year: number, unit: number) => string;
  labelFromDayOfYear: (year: number, dayOfYear: number) => string;
  daysInYear: (year: number) => number;
  getMonthName: (month: number) => string;
}

@Injectable({
  providedIn: 'root',
})
export class TimelineHudService {
  private huds: HudLayer[] = [];
  private readonly grid = {
    spacingCSS: 0,
    targetVisible: 6,
    topGapCSS: 40,
    color: 'rgba(255,150,60,0.55)',
    thicknessCSS: 2,
  };

  constructor() {}

  addHudLayer(hud: HudLayer) {
    this.huds.push(hud);
  }

  getHuds(): HudLayer[] {
    return this.huds;
  }

  getHud(index: number): HudLayer | undefined {
    return this.huds[index];
  }

  clearHuds() {
    this.huds = [];
  }

  getGridSpacing(): number {
    return this.grid.spacingCSS;
  }

  getGridTopGap(): number {
    return this.grid.topGapCSS;
  }

  getGridColor(): string {
    return this.grid.color;
  }

  getGridThickness(): number {
    return this.grid.thicknessCSS;
  }

  drawHudLayer(params: DrawHudLayerParams) {
    const {
      ctx,
      canvasWidth: Wc,
      canvasHeight: Hc,
      dpr,
      screenWidth,
      unitYears: u,
      yearToY,
      yToYearDev,
      nowYearFraction,
      formatLabelByUnit,
      labelFromDayOfYear,
      daysInYear,
    } = params;

    ctx.clearRect(0, 0, Wc, Hc);

    const thick = Math.max(1, Math.round(this.grid.thicknessCSS * dpr));
    const segLen = Math.max(2, Math.round((screenWidth || Wc) * 0.1 * dpr));
    const x0 = Math.round((Wc - segLen) / 2);

    ctx.font = `${Math.max(11, Math.round(13 * dpr))}px system-ui, sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'right';
    const labelMargin = Math.round(6 * dpr);

    const yTopYear = yToYearDev(0);
    const yBotYear = yToYearDev(Hc);

    const isDayTier = u < 1 / 300; // Approximately less than a day
    const isWeekTier = u >= 1 / 300 && u <= 1 / 50; // Approximately week-scale

    const nextStepAtOrAbove = (y: number, step: number) =>
      y >= 0 ? Math.ceil(y / step) * step : -Math.floor(Math.abs(y) / step) * step;

    if (isDayTier && !isWeekTier) {
      const step = 1 / 365;
      let yTick = nextStepAtOrAbove(yTopYear - 1e-9, step);
      const visibleYears = Math.max(0, yBotYear - yTopYear);
      const maxTicks = Math.min(15000, Math.ceil(visibleYears / step) + 20);
      let safety = 0;
      while (yTick <= yBotYear + 1e-7 && safety++ < maxTicks) {
        const yPx = yearToY(yTick);
        ctx.fillStyle = this.grid.color;
        ctx.fillRect(x0, Math.round(yPx - Math.floor(thick / 2)), segLen, thick);
        const yr = yTick >= 0 ? Math.floor(yTick) : Math.ceil(yTick);
        const diy = daysInYear(yr);
        const label = formatLabelByUnit(yTick, 1 / diy);
        if (label) {
          ctx.fillStyle = 'rgba(255,170,80,0.95)';
          ctx.fillText(label, x0 - labelMargin, Math.round(yPx));
        }
        yTick += step;
      }
    } else if (isWeekTier) {
      const step = 7 / 365;
      let yTick = nextStepAtOrAbove(yTopYear - 1e-9, step);
      const visibleYears = Math.max(0, yBotYear - yTopYear);
      const maxTicks = Math.min(6000, Math.ceil(visibleYears / step) + 20);
      let safety = 0;
      while (yTick <= yBotYear + 1e-7 && safety++ < maxTicks) {
        const yPx = yearToY(yTick);
        ctx.fillStyle = this.grid.color;
        ctx.fillRect(x0, Math.round(yPx - Math.floor(thick / 2)), segLen, thick);

        const yr = yTick >= 0 ? Math.floor(yTick) : Math.ceil(yTick);
        const diy = daysInYear(yr);
        const frac = yTick - (yTick >= 0 ? Math.floor(yTick) : Math.ceil(yTick));
        let dayOfYear = Math.floor(frac * diy);
        dayOfYear = dayOfYear - (dayOfYear % 7); // week start
        const label = labelFromDayOfYear(yr, dayOfYear);
        if (label) {
          ctx.fillStyle = 'rgba(255,170,80,0.95)';
          ctx.fillText(label, x0 - labelMargin, Math.round(yPx));
        }
        yTick += step;
      }
    } else {
      let yTick = nextStepAtOrAbove(yTopYear - 1e-9, u);
      let safety = 0;
      while (yTick <= yBotYear + 1e-7 && safety++ < 4000) {
        const yPx = yearToY(yTick);
        ctx.fillStyle = this.grid.color;
        ctx.fillRect(x0, Math.round(yPx - Math.floor(thick / 2)), segLen, thick);

        const label = formatLabelByUnit(yTick, u);
        ctx.fillStyle = 'rgba(255,170,80,0.95)';
        if (label) ctx.fillText(label, x0 - labelMargin, Math.round(yPx));

        yTick += u;
      }
    }

    // Today marker
    const yToday = Math.round(yearToY(nowYearFraction()));
    if (yToday >= -4 && yToday <= Hc + 4) {
      const ySeg = yToday - Math.floor(thick / 2);
      ctx.save();
      ctx.fillStyle = 'rgba(255,70,70,0.9)';
      ctx.fillRect(x0, ySeg, segLen, thick);

      // Today's date label
      const d = new Date();
      const todayLabel = `${params.getMonthName(
        d.getUTCMonth()
      )} ${d.getUTCDate()}, ${d.getUTCFullYear()} C.E.`;
      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(255,70,70,0.95)';
      ctx.fillText(todayLabel, x0 - labelMargin, Math.round(yToday));

      ctx.restore();
    }
  }

  drawCenterline(params: DrawCenterlineParams) {
    const {
      canvas,
      canvasWidth,
      canvasHeight,
      dpr,
      screenWidth,
      currentZoomIdx,
      scrollY,
      scrollMin,
      scrollMax,
      entries,
      yearToY,
      formatLabel,
      snapToUnit,
    } = params;

    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    const y = Math.round(canvasHeight / 2);
    const unit = this.huds[currentZoomIdx]?.unit ?? 1;

    const yfCenter = yearToY(canvasHeight / 2);
    let snapped = snapToUnit(yfCenter, unit);

    if (scrollMin != null && scrollMax != null) {
      const THRESH = 1;
      if (entries.length) {
        if (scrollY <= scrollMin + THRESH) {
          snapped = snapToUnit(entries[0].yf, unit);
        } else if (scrollY >= scrollMax - THRESH) {
          snapped = snapToUnit(entries[entries.length - 1].yf, unit);
        }
      }
    }

    const label = formatLabel(snapped, unit);
    const thick = Math.max(1, Math.round(this.grid.thicknessCSS * dpr));
    const segLen = Math.max(2, Math.round((screenWidth || canvasWidth) * 0.1 * dpr));
    const x0 = Math.round((canvasWidth - segLen) / 2);
    const labelMargin = Math.round(6 * dpr);

    ctx.save();
    ctx.fillStyle = 'rgba(200,200,210,0.65)';
    ctx.fillRect(x0, y - Math.floor(thick / 2), segLen, thick);

    ctx.font = `${Math.max(11, Math.round(13 * dpr))}px system-ui, sans-serif`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    const metrics = ctx.measureText(label);
    const labelWidth = metrics.width;
    const labelX = x0 - labelMargin;

    if (labelX - labelWidth > labelMargin) {
      ctx.fillText(label, labelX, y);
    }

    ctx.restore();
  }
}
