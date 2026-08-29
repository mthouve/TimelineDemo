import { Injectable } from '@angular/core';
import { TimelineEntry } from '../models/timeline-entry.model';

export interface TimelineStyle {
  pointRcss: number;
  pointGlow: number;
  pointPast: string;
  pointFuture: string;
  lineWcss: number;
  lineGlow: number;
  linePast: string;
  lineFuture: string;
  lineDashCSS: [number, number];
}

export interface DrawTimelineParams {
  canvas: HTMLCanvasElement;
  canvasWidth: number;
  canvasHeight: number;
  dpr: number;
  entries: TimelineEntry[];
  nowYearFraction: number;
  style: TimelineStyle;
  zoomLevelName: string;
  formatLabelByZoomLevel: (year: number, zoomLevelName: string) => string;
  yearToY: (year: number) => number;
  yToYearDev: (yDev: number) => number;
  lowerBoundByDrawYf: (target: number) => number;
}

interface DrawSegmentsParams {
  ctx: CanvasRenderingContext2D;
  entries: TimelineEntry[];
  firstVisible: number;
  lastVisible: number;
  x: number;
  pad: number;
  canvasHeight: number;
  dpr: number;
  nowYearFraction: number;
  style: TimelineStyle;
  yearToY: (year: number) => number;
}

interface DrawPointsParams extends DrawSegmentsParams {
  zoomLevelName: string;
  formatLabelByZoomLevel: (year: number, zoomLevelName: string) => string;
}

@Injectable({
  providedIn: 'root',
})
export class TimelineRendererService {
  drawTimeline(params: DrawTimelineParams): void {
    const {
      canvas,
      canvasWidth,
      canvasHeight,
      dpr,
      entries,
      nowYearFraction,
      style,
      zoomLevelName,
      formatLabelByZoomLevel,
      yearToY,
      yToYearDev,
      lowerBoundByDrawYf,
    } = params;

    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    if (!entries.length) return;

    const x = Math.round(canvasWidth / 2);
    const pad = Math.max(96 * dpr, style.pointGlow * dpr + 48);
    const topYf = yToYearDev(-pad);
    const bottomYf = yToYearDev(canvasHeight + pad);
    const minVisibleYf = Math.min(topYf, bottomYf);
    const maxVisibleYf = Math.max(topYf, bottomYf);
    const firstVisible = Math.max(0, lowerBoundByDrawYf(minVisibleYf) - 1);
    const lastVisible = Math.min(
      entries.length - 1,
      lowerBoundByDrawYf(maxVisibleYf + Number.EPSILON),
    );

    this.drawSegments({
      ctx,
      entries,
      firstVisible,
      lastVisible,
      x,
      pad,
      canvasHeight,
      dpr,
      nowYearFraction,
      style,
      yearToY,
    });

    this.drawPoints({
      ctx,
      entries,
      firstVisible,
      lastVisible,
      x,
      pad,
      canvasHeight,
      dpr,
      nowYearFraction,
      style,
      zoomLevelName,
      formatLabelByZoomLevel,
      yearToY,
    });
  }

  private drawSegments(params: DrawSegmentsParams): void {
    const {
      ctx,
      entries,
      firstVisible,
      lastVisible,
      x,
      pad,
      canvasHeight,
      dpr,
      nowYearFraction,
      style,
      yearToY,
    } = params;
    const lw = Math.max(1, Math.round(style.lineWcss * dpr));
    const glow = Math.max(0, Math.round(style.lineGlow * dpr));
    const nowY = yearToY(nowYearFraction);
    const segmentStart = Math.max(0, firstVisible);
    const segmentEnd = Math.min(entries.length - 2, lastVisible);

    for (let i = segmentStart; i <= segmentEnd; i++) {
      const a = entries[i];
      const b = entries[i + 1];
      const y1 = yearToY(a.drawYf);
      const y2 = yearToY(b.drawYf);
      const lo = Math.min(y1, y2);
      const hi = Math.max(y1, y2);
      if (hi < -pad || lo > canvasHeight + pad) continue;

      if (hi <= nowY) {
        this.drawSegment(ctx, x, y1, y2, style.linePast, false, lw, glow, style.lineDashCSS, dpr);
      } else if (lo >= nowY) {
        this.drawSegment(ctx, x, y1, y2, style.lineFuture, true, lw, glow, style.lineDashCSS, dpr);
      } else {
        this.drawSegment(ctx, x, y1, nowY, style.linePast, false, lw, glow, style.lineDashCSS, dpr);
        this.drawSegment(ctx, x, nowY, y2, style.lineFuture, true, lw, glow, style.lineDashCSS, dpr);
      }
    }
  }

  private drawSegment(
    ctx: CanvasRenderingContext2D,
    x: number,
    y1: number,
    y2: number,
    color: string,
    dash: boolean,
    lineWidth: number,
    glow: number,
    lineDashCSS: [number, number],
    dpr: number,
  ): void {
    ctx.save();
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = color;
    ctx.shadowBlur = glow;
    ctx.shadowColor = color;
    ctx.setLineDash(
      dash ? [Math.round(lineDashCSS[0] * dpr), Math.round(lineDashCSS[1] * dpr)] : [],
    );
    ctx.beginPath();
    ctx.moveTo(x, y1);
    ctx.lineTo(x, y2);
    ctx.stroke();
    ctx.restore();
  }

  private drawPoints(params: DrawPointsParams): void {
    const {
      ctx,
      entries,
      firstVisible,
      lastVisible,
      x,
      pad,
      canvasHeight,
      dpr,
      nowYearFraction,
      style,
      zoomLevelName,
      formatLabelByZoomLevel,
      yearToY,
    } = params;
    const r = Math.max(2, Math.round(style.pointRcss * dpr));
    const pGlow = Math.max(0, Math.round(style.pointGlow * dpr));
    const font = `${Math.max(10, Math.round(12 * dpr))}px system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell`;
    const pointStart = Math.max(0, firstVisible);
    const pointEnd = Math.min(entries.length - 1, lastVisible);

    for (let i = pointStart; i <= pointEnd; i++) {
      const point = entries[i];
      const y = yearToY(point.drawYf);
      if (y < -pad || y > canvasHeight + pad) continue;

      const isFuture = point.yf > nowYearFraction;
      const color = isFuture ? style.pointFuture : style.pointPast;
      ctx.save();
      ctx.shadowBlur = pGlow;
      ctx.shadowColor = color;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.font = font;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255,235,200,0.96)';
      const labelX = x + r + Math.round(8 * dpr);
      const labelMaxWidth = Math.max(24 * dpr, ctx.canvas.width - labelX - Math.round(6 * dpr));
      ctx.fillText(
        formatLabelByZoomLevel(point.drawYf, zoomLevelName),
        labelX,
        y,
        labelMaxWidth,
      );
      ctx.restore();
    }
  }
}
