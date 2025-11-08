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
