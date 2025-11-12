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
      zoomLevelName,
      yearToY,
      yToYearDev,
      nowYearFraction,
      formatLabelByUnit,
      unitYears: u,
      dateService,
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

    // Find the first HUD line position
    // Start slightly before the visible area to ensure we catch the first tick
    let yTick: number;

    // Find first boundary by walking forward from a safe point before the viewport.
    // This guarantees we start exactly on a real boundary for all units.
    let cursor = Math.floor(yTopYear) - 2; // start a bit above
    let boundary = dateService.nextDate(cursor, zoomLevelName);
    // Guard against non-advancing nextDate to avoid infinite loops
    let guard = 0;
    const GUARD_MAX = 5000;
    let prev = Number.NEGATIVE_INFINITY;
    while (boundary.yf < yTopYear - 1e-9 && guard++ < GUARD_MAX) {
      const next = dateService.nextDate(boundary.yf, zoomLevelName);
      // If no progress, break to avoid freeze
      if (!(next.yf > boundary.yf + 1e-12)) break;
      prev = boundary.yf;
      boundary = next;
    }
    // If we failed to reach the first visible boundary due to non-advancing step,
    // fall back to snapping the top to a valid boundary to ensure we draw something.
    if (boundary.yf < yTopYear - 1e-9) {
      try {
        yTick = dateService.snapToUnit(yTopYear, u);
      } catch {
        yTick = yTopYear; // last resort
      }
    } else {
      yTick = boundary.yf;
    }

    // Now navigate forward through all visible dates
    let safety = 0;
    const maxTicks = 15000;

    while (yTick <= yBotYear + 1e-7 && safety++ < maxTicks) {
      if (yTick >= yTopYear - 1e-9) {
        // Use yTick directly for drawing; it already represents the exact boundary
        // from nextDate (no epsilon)
        const yPx = yearToY(yTick);
        ctx.fillStyle = this.grid.color;
        ctx.fillRect(x0, Math.round(yPx - Math.floor(thick / 2)), segLen, thick);

        const label = formatLabelByUnit(yTick, u);
        if (label) {
          ctx.fillStyle = 'rgba(255,170,80,0.95)';
          ctx.fillText(label, x0 - labelMargin, Math.round(yPx));
        }
      }

      // Move to next date boundary
      const next = dateService.nextDate(yTick, zoomLevelName);
      yTick = next.yf;
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
