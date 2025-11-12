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
  dateService: any;
}

export interface DrawHudLayerParams {
  ctx: CanvasRenderingContext2D;
  canvasWidth: number;
  canvasHeight: number;
  dpr: number;
  screenWidth: number;
  unitYears: number;
  zoomLevelName: string;
  yearToY: (y: number) => number;
  yToYearDev: (yDev: number) => number;
  nowYearFraction: () => number;
  formatLabelByUnit: (year: number, unit: number) => string;
  labelFromDayOfYear: (year: number, dayOfYear: number) => string;
  daysInYear: (year: number) => number;
  getMonthName: (month: number) => string;
  dateService: any;
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
      unitYears,
      zoomLevelName,
      yearToY,
      yToYearDev,
      nowYearFraction,
      formatLabelByUnit,
      dateService,
    } = params;

    const thick = Math.max(1, Math.round(this.grid.thicknessCSS * dpr));
    const segLen = Math.max(2, Math.round((screenWidth || Wc) * 0.1 * dpr));
    const x0 = Math.round((Wc - segLen) / 2);
    const labelMargin = Math.round(6 * dpr);

    // Ensure readable label size on HiDPI canvases (match centerline and today label)
    ctx.font = `${Math.max(11, Math.round(13 * dpr))}px system-ui, sans-serif`;
    const yTopYear = yToYearDev(0);
    const yBotYear = yToYearDev(Hc);

    // Find first visible boundary by snapping the top to the unit
    let yTick: number;
    try {
      yTick = dateService.snapToUnit(yTopYear, unitYears);
    } catch {
      yTick = yTopYear;
    }

    // Advance until we reach the top of the viewport
    let guard = 0;
    while (yTick < yTopYear - 1e-9 && guard++ < 10000) {
      const next = dateService.nextDate(yTick, zoomLevelName);
      if (!(next.yf > yTick + 1e-12)) break; // guard against non-advancing
      yTick = next.yf;
    }

    // Draw all visible ticks
    let safety = 0;
    const maxTicks = 20000;
    while (yTick <= yBotYear + 1e-7 && safety++ < maxTicks) {
      if (yTick >= yTopYear - 1e-9) {
        const yPx = yearToY(yTick);
        ctx.fillStyle = this.grid.color;
        ctx.fillRect(x0, Math.round(yPx - Math.floor(thick / 2)), segLen, thick);

        const label = formatLabelByUnit(yTick, unitYears);
        if (label) {
          ctx.fillStyle = 'rgba(255,170,80,0.95)';
          ctx.textAlign = 'right';
          ctx.textBaseline = 'middle';
          ctx.fillText(label, x0 - labelMargin, Math.round(yPx));
        }
      }

      const next = dateService.nextDate(yTick, zoomLevelName);
      if (!(next.yf > yTick + 1e-12)) break;
      yTick = next.yf;
    }

    // Today marker (red)
    const nowYF = nowYearFraction();
    const yToday = Math.round(yearToY(nowYF));
    if (yToday >= -4 && yToday <= Hc + 4) {
      const ySeg = yToday - Math.floor(thick / 2);
      ctx.save();
      ctx.fillStyle = 'rgba(255,70,70,0.9)';
      ctx.fillRect(x0, ySeg, segLen, thick);

      const dayUnit = 1 / params.dateService.meanYear;
      const todayLabel = formatLabelByUnit(nowYF, dayUnit);
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
    const snappedDown = snapToUnit(yfCenter, unit);
    // For all tiers (Day/Week/Month), keep labeling the current period until the boundary is crossed.
    // We intentionally avoid switching at midpoint to prevent premature announcements.
    let snapped = snappedDown;

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
