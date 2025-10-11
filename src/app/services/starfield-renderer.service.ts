import { Injectable } from '@angular/core';
import { StarfieldService } from '../starfield.service';

@Injectable({ providedIn: 'root' })
export class StarfieldRendererService {
  private dpr = Math.max(1, window.devicePixelRatio || 1);
  private patternSize = 512;
  private parallaxX = 0.06;
  private parallaxY = 0.14;

  private pattern!: CanvasPattern;
  private tile!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private canvas!: HTMLCanvasElement;

  // persistent phase to avoid jumps between programmatic scrolls
  private phaseBaseX = 0;
  private phaseBaseY = 0;

  // “effective” scroll (what parallax follows)
  private px = 0;
  private py = 0;

  // density scale
  private scale = 1;

  // zoom-phase lock
  private zoomLocked = false;
  private lockOffX = 0;
  private lockOffY = 0;

  constructor(private stars: StarfieldService) {}

  init(canvas: HTMLCanvasElement, patternSize = 512) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.patternSize = patternSize;
    this.tile = this.stars.createStarTile('SPT-1234', this.patternSize);
    this.pattern = this.ctx.createPattern(this.tile, 'repeat')!;
  }

  setDevicePixelRatio(dpr: number) {
    this.dpr = dpr;
  }
  setParallaxScroll(sx: number, sy: number) {
    this.px = sx;
    this.py = sy;
  }
  setScale(scale: number) {
    this.scale = scale;
  }

  /** Freeze current visible phase; return density endpoints for the tween. */
  freezePhaseForZoom(fromScale: number, toScale: number) {
    this.zoomLocked = true;
    const off = this.currentPhaseOffsets();
    this.lockOffX = off.x;
    this.lockOffY = off.y;
    return { lockOffX: this.lockOffX, lockOffY: this.lockOffY, fromScale, toScale };
  }

  /** Keep on-screen phase unchanged across a programmatic scroll jump. */
  rebasePhaseForProgrammaticScroll(newSx: number, newSy: number) {
    const mod = (a: number, m: number) => ((a % m) + m) % m;
    const { x, y } = this.currentPhaseOffsets();
    this.phaseBaseX = mod(x + newSx * this.parallaxX, this.patternSize);
    this.phaseBaseY = mod(y + newSy * this.parallaxY, this.patternSize);
  }

  /** End zoom lock; persist phase so stars don’t jump when zoom ends. */
  endZoomFreezeAndMatchPhase() {
    const mod = (a: number, m: number) => ((a % m) + m) % m;
    const sx = window.scrollX || window.pageXOffset || 0;
    const sy = window.scrollY || window.pageYOffset || 0;
    this.phaseBaseX = mod(this.lockOffX + sx * this.parallaxX, this.patternSize);
    this.phaseBaseY = mod(this.lockOffY + sy * this.parallaxY, this.patternSize);
    this.zoomLocked = false;
  }

  draw(viewportW: number, viewportH: number) {
    if (!this.pattern) return;
    const c = this.canvas,
      ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    const off = this.zoomLocked
      ? { x: this.lockOffX, y: this.lockOffY }
      : this.currentPhaseOffsets();

    // center-based scaling (prevents lateral drift while scaling)
    const cx = viewportW / 2,
      cy = viewportH / 2;
    const pat = this.pattern as any;

    if (typeof pat.setTransform === 'function') {
      const m = new DOMMatrix();
      m.translateSelf(cx, cy);
      m.scaleSelf(this.scale, this.scale);
      m.translateSelf(-cx, -cy);
      m.translateSelf(off.x, off.y);
      pat.setTransform(m);
      ctx.fillStyle = this.pattern!;
      ctx.fillRect(0, 0, viewportW, viewportH);
    } else {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(this.scale, this.scale);
      ctx.translate(-cx, -cy);
      ctx.translate(off.x, off.y);
      ctx.fillStyle = this.pattern!;
      const pad = this.patternSize * 2;
      ctx.fillRect(-pad, -pad, viewportW + pad * 2, viewportH + pad * 2);
      ctx.restore();
    }
  }

  private currentPhaseOffsets() {
    const mod = (a: number, m: number) => ((a % m) + m) % m;
    const sx = this.px,
      sy = this.py;
    return {
      x: mod(-(sx * this.parallaxX) + this.phaseBaseX, this.patternSize),
      y: mod(-(sy * this.parallaxY) + this.phaseBaseY, this.patternSize),
    };
  }
}
