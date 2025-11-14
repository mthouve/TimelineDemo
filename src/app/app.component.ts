import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import { StarfieldService } from './starfield.service';
import { EarthGlobeService } from './services/earth-globe.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements AfterViewInit, OnDestroy {
  @ViewChild('starCanvas', { static: true }) starCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('earthCanvas', { static: false }) earthCanvas!: ElementRef<HTMLCanvasElement>;
  private ctx!: CanvasRenderingContext2D;
  private dpr = Math.max(1, window.devicePixelRatio || 1);

  private tile!: HTMLCanvasElement;
  private pattern!: CanvasPattern;
  private patternSize = 512;

  private parallaxX = 0.08;
  private parallaxY = 0.28;

  private rafId: number | null = null;

  constructor(private stars: StarfieldService, private earthGlobe: EarthGlobeService) {}

  ngAfterViewInit(): void {
    this.ctx = this.starCanvas.nativeElement.getContext('2d')!;
    this.tile = this.stars.createStarTile('SPT-1234', this.patternSize);
    this.pattern = this.ctx.createPattern(this.tile, 'repeat')!;
    this.resizeCanvas();

    // Initialize Earth globe
    if (this.earthCanvas && this.earthCanvas.nativeElement) {
      const earthCanvas = this.earthCanvas.nativeElement;
      this.earthGlobe.init(earthCanvas, 400, 400);
    } else {
      console.error('Earth canvas not found!');
    }

    // center the scroll (≈10× up and down)
    setTimeout(() => {
      const middle = ((2100 / 2) * window.innerHeight) / 100;
      window.scrollTo({ top: middle, behavior: 'instant' as ScrollBehavior });
      this.queueRedraw();
    }, 0);

    this.queueRedraw();
  }

  ngOnDestroy(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.earthGlobe.dispose();
  }

  @HostListener('window:resize') onResize() {
    this.resizeCanvas();
    this.queueRedraw();
  }
  @HostListener('window:scroll') onScroll() {
    this.queueRedraw();
  }

  private resizeCanvas() {
    const c = this.starCanvas.nativeElement;
    const w = Math.floor(window.innerWidth * this.dpr);
    const h = Math.floor(window.innerHeight * this.dpr);
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
      c.style.width = '100%';
      c.style.height = '100%';
    }
  }

  private queueRedraw() {
    if (this.rafId === null) {
      this.rafId = requestAnimationFrame(() => {
        this.rafId = null;
        this.draw();
      });
    }
  }

  private draw() {
    const c = this.starCanvas.nativeElement,
      ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);

    const sy = window.scrollY || document.documentElement.scrollTop || 0;
    const sx = window.scrollX || 0;

    ctx.save();
    ctx.scale(this.dpr, this.dpr);

    const offX = -((sx * this.parallaxX) % this.patternSize);
    const offY = -((sy * this.parallaxY) % this.patternSize);

    ctx.fillStyle = this.pattern!;
    ctx.translate(offX, offY);

    const pad = this.patternSize * 2;
    ctx.fillRect(-pad, -pad, window.innerWidth + pad * 2, window.innerHeight + pad * 2);

    ctx.restore();
  }
}
