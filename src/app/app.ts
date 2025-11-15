import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  HostListener,
  Renderer2,
} from '@angular/core';
import { StarfieldRendererService } from './services/starfield-renderer.service';
import { TimelineDateService, ZoomSpec } from './services/timeline-date.service';
import { TimelineHudService } from './services/timeline-hud.service';
import { EarthGlobeService } from './services/earth-globe.service';
import { ZoomControlComponent } from './zoom-control/zoom-control.component';
import { SettingsControlComponent } from './settings-control/settings-control.component';
import { InfoBoxComponent, InfoBoxEntry } from './info-box/info-box.component';
import { BibleViewerComponent } from './bible-viewer/bible-viewer.component';
import { CommonModule } from '@angular/common';
import { TimelinePoint } from './data/timeline-points';

// Animation envelope (typed)
type ZoomAnim = {
  active: boolean;
  t0: number;
  dur: number;
  startUnit: number;
  endUnit: number;
  keepYear: number | null;
  targetIdx: number;

  // star tween endpoints
  starFromScale?: number;
  starToScale?: number;

  // HUD step pair
  hudFromIdx?: number;
  hudToIdx?: number;
  hudStartUnit?: number;
  hudEndUnit?: number;

  startIdx?: number;
  endIdx?: number;

  // piecewise path
  unitsSeq?: number[];
  stepDist?: number[];
  cumDist?: number[];
  totalDist?: number;
};

@Component({
  selector: 'app-root',
  standalone: true,
  templateUrl: './app.html',
  styleUrl: './app.scss',
  imports: [
    ZoomControlComponent,
    SettingsControlComponent,
    InfoBoxComponent,
    BibleViewerComponent,
    CommonModule,
  ],
})
export class App implements AfterViewInit, OnDestroy {
  constructor(
    private starRender: StarfieldRendererService,
    private dateService: TimelineDateService,
    private hudService: TimelineHudService,
    private earthGlobe: EarthGlobeService,
    private r2: Renderer2
  ) {
    // Ensure a sensible base page title for tests and initial load
    if (!document.title || document.title.trim() === '') {
      document.title = 'Timeline Demo';
    }
    this.zoomLevels = this.dateService.getZoomLevels();
    this.zoomLabels = this.dateService.getZoomLabels();
    this.TIMELINE_POINTS = this.dateService.getTimelinePoints();
  }

  // ── Info box state ──────────────────────────────────────────────────────────
  infoEntries: InfoBoxEntry[] = [];
  infoBoxHidden = true;

  private updateInfoBox() {
    const entries = this.getEntries();
    if (!entries.length || !this.CH || !this.GRID.spacingCSS || !this.TL.unitYears) {
      this.infoEntries = [];
      this.infoBoxHidden = true;
      return;
    }

    const centerYF = this.centerYF ?? this.yToYearDev(this.CH / 2);

    // One HUD spacing represents this.TL.unitYears (e.g., 1 year in Year view, 10 in Decade view)
    // Primary: within ~1 HUD line spacing (in years)
    // Secondary: within ~2 HUD line spacings (in years)
    const primaryRange = this.TL.unitYears * 1.0; // within 1 HUD spacing
    const secondaryRange = this.TL.unitYears * 2.0; // within 2 HUD spacings

    const nearbyEntries: InfoBoxEntry[] = [];
    let closestPrimaryWithLocation: (typeof entries)[0] | null = null;
    let closestDistance = Infinity;

    for (const e of entries) {
      const dy = Math.abs(e.yf - centerYF);
      if (dy <= secondaryRange) {
        const isPrimary = dy <= primaryRange;
        nearbyEntries.push({
          ...e,
          isPrimary,
        });

        // Track closest primary entry with location for Earth rotation
        if (isPrimary && e.location && dy < closestDistance) {
          closestPrimaryWithLocation = e;
          closestDistance = dy;
        }
      }
    }

    // Rotate Earth to show location if we have a primary entry with coordinates
    if (closestPrimaryWithLocation?.location) {
      this.earthGlobe.rotateTo(
        closestPrimaryWithLocation.location.lon,
        closestPrimaryWithLocation.location.lat
      );

      // Calculate marker opacity based on distance (fade out over 2x primary range)
      const fadeRange = primaryRange * 2.0;
      const opacity = fadeRange > 0 ? 1.0 - Math.min(closestDistance / fadeRange, 1.0) : 0;
      this.earthGlobe.setMarkerOpacity(opacity);
    } else {
      // No location in view, hide marker
      this.earthGlobe.setMarkerOpacity(0);
    }

    // Already in chronological order, just limit total count
    this.infoEntries = nearbyEntries.slice(0, 16);
    this.infoBoxHidden = this.infoEntries.length === 0;
  }

  private markActiveHudLayers() {
    for (let i = 0; i < this.HUDS.length; i++) {
      const el = this.HUDS[i].el;
      if (i === this.animFromIdx) el.style.outline = '1px dashed rgba(255,150,60,0.9)';
      else if (i === this.animToIdx) el.style.outline = '1px dashed rgba(80,200,255,0.9)';
      else el.style.outline = '';
    }
  }

  // ── View refs ─────────────────────────────────────────────────────────────────
  @ViewChild('starHost', { static: true }) starHost!: ElementRef<HTMLDivElement>;
  @ViewChild('starCanvas', { static: true }) starCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('earthCanvas', { static: false }) earthCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('centerline', { static: true }) centerline!: ElementRef<HTMLCanvasElement>;
  @ViewChild('timeline', { static: true }) timeline!: ElementRef<HTMLCanvasElement>;
  @ViewChild(ZoomControlComponent) zoomUi?: ZoomControlComponent;

  // ── Zoom tiers ────────────────────────────────────────────────────────────────
  zoomLevels: ZoomSpec[] = [];
  zoomLabels: string[] = [];
  currentZoomIdx = 3; // Year

  // Match #levels length
  private readonly starBaseScaleByLevel = [1.12, 1.08, 1.05, 1.0, 0.96, 0.93, 0.9];

  // Timing targets
  private readonly DUR_SINGLE_STEP_MS = 4000; // ~4s for 1-step jumps
  private readonly DUR_ACROSS_ALL_MS = 10000; // ~10s for full-range jumps

  // ── Starfield / zoom state ───────────────────────────────────────────────────
  private starEffectiveScale = this.starBaseScaleByLevel[this.currentZoomIdx];
  private starZoom = {
    active: false,
    from: this.starBaseScaleByLevel[this.currentZoomIdx],
    to: this.starBaseScaleByLevel[this.currentZoomIdx],
    lockOffX: 0,
    lockOffY: 0,
  };

  private animFromIdx = this.currentZoomIdx;
  private animToIdx = this.currentZoomIdx;

  private centerYF: number | null = null;
  private pendingZoomIdx: number | null = null;

  // Parallax drivers
  private starParallaxScrollX = 0;
  private starParallaxScrollY = 0;

  private settingScroll = false;
  private lastScrollY = 0;

  private readonly EDGE_PAD = 32;
  private readonly ONE_LEVEL_MS = 1660; // ~10s total across 6 steps

  // HUD canvas list
  private HUDS: Array<{
    el: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    unit: number;
    id: string;
  }> = [];

  // ── Data ──────────────────────────────────────────────────────────────────────
  private TIMELINE_POINTS: Record<string, TimelinePoint>;

  // ── Sizing ────────────────────────────────────────────────────────────────────
  private dpr = Math.max(1, window.devicePixelRatio || 1);
  private DPR = 1;
  private W = 0;
  private H = 0;
  private CW = 0;
  private CH = 0;
  private TW = 0;
  private TH = 0;

  private GRID = {
    spacingCSS: 0,
    targetVisible: 6,
    topGapCSS: 40,
    color: 'rgba(255,150,60,0.55)',
    thicknessCSS: 2,
  };

  private TL = {
    baseYear: 0,
    baselineOffsetIndex: 2,
    unitYears: 1,
    pointRcss: 10,
    pointGlow: 14,
    pointPast: 'rgba(255,230,160,0.98)',
    pointFuture: 'rgba(255,230,160,0.75)',
    lineWcss: 4,
    lineGlow: 6,
    linePast: 'rgba(255,210,120,0.95)',
    lineFuture: 'rgba(255,210,120,0.45)',
    lineDashCSS: [8, 6] as [number, number],
  };

  // ── Virtual window & bounds ───────────────────────────────────────────────────
  private GRID_K0: number | null = null;
  private SCROLL_SHIFT = 0;
  private SCROLL_MIN: number | null = null;
  private SCROLL_MAX: number | null = null;
  private DID_AUTO_CENTER = false;

  private readonly VWIN_MULT = 17;
  private readonly EDGE_EPS = 2;

  // Earth canvas resize observer
  private earthResizeObserver: ResizeObserver | null = null;
  private earthResizeTimer: any = null;
  private resizeDoneTimer: any = null;
  private readonly RESIZE_DEBOUNCE_MS = 150;

  // Raw listeners
  private wheelHandler?: (e: WheelEvent) => void;
  private tStartHandler?: (e: TouchEvent) => void;
  private tMoveHandler?: (e: TouchEvent) => void;
  private touchY0: number | null = null;

  // ── Animation envelope (typed + private backing) ──────────────────────────────
  private _ZOOM_ANIM: ZoomAnim = {
    active: false,
    t0: 0,
    dur: 2500,
    startUnit: 1,
    endUnit: 1,
    keepYear: null,
    targetIdx: this.currentZoomIdx,
  };
  get ZOOM_ANIM(): ZoomAnim {
    return this._ZOOM_ANIM;
  }
  get isZoomAnimating(): boolean {
    return this._ZOOM_ANIM.active;
  }

  // ── Interaction locks & UI progress (getters for template) ───────────────────
  private _scrollLocked = false;
  get scrollLocked(): boolean {
    return this._scrollLocked;
  }

  private _zoomVisualIndex = this.currentZoomIdx; // fractional allowed
  get zoomVisualIndex(): number {
    return this._zoomVisualIndex;
  }

  private _zoomStepLabel = '';
  get zoomStepLabel(): string {
    return this._zoomStepLabel;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────────
  ngAfterViewInit(): void {
    this.buildHudLayers();

    this.starRender.init(this.starCanvas.nativeElement, 512);
    this.starRender.setDevicePixelRatio(this.DPR);

    // Initialize Earth globe - canvas now fills timeline panel for full starfield view
    if (this.earthCanvas && this.earthCanvas.nativeElement) {
      const canvas = this.earthCanvas.nativeElement;
      // Calculate timeline panel dimensions (60vw x 100vh on desktop)
      const canvasWidth = window.innerWidth * 0.6;
      const canvasHeight = window.innerHeight;
      
      this.earthGlobe.init(canvas, canvasWidth, canvasHeight);

      // Watch for canvas size changes with ResizeObserver
      this.earthResizeObserver = new ResizeObserver(() => {
        // Debounce the resize
        if (this.earthResizeTimer) clearTimeout(this.earthResizeTimer);

        this.earthResizeTimer = setTimeout(() => {
          const w = this.earthCanvas.nativeElement.offsetWidth;
          const h = this.earthCanvas.nativeElement.offsetHeight;
          if (w > 0 && h > 0) {
            this.earthGlobe.resize(w, h);
          }
        }, 150);
      });
      this.earthResizeObserver.observe(this.earthCanvas.nativeElement);
    } else {
      console.error('Earth canvas not found!');
    }

    this.sizeAll();

    this.TL.unitYears = this.zoomLevels[this.currentZoomIdx].unit;
    const entries = this.getEntries();
    if (entries.length) this.TL.baseYear = entries[0].yf;

    this.anchorGrid();
    this.updateScrollBounds();
    this.ensureScrollRoomFromBounds();
    this.centerFirstPoint();
    this.updateScrollBounds();
    this.ensureScrollRoomFromBounds();
    this.clampScroll();

    this.starParallaxScrollX = window.scrollX || window.pageXOffset || 0;
    this.starParallaxScrollY = window.scrollY || window.pageYOffset || 0;
    this.lastScrollY = this.starParallaxScrollY;

    // show active tier
    for (const h of this.HUDS) {
      h.el.classList.add('hud-hidden', 'no-anim');
      h.el.classList.remove('hud-visible');
    }
    this.redraw();
    setTimeout(() => this.updateInfoBox(), 0);
    setTimeout(() => {
      const el = this.HUDS[this.currentZoomIdx]?.el;
      if (el) {
        el.classList.remove('no-anim', 'hud-hidden');
        el.classList.add('hud-visible');
      }
      setTimeout(() => this.HUDS.forEach((h) => h.el.classList.remove('no-anim')), 50);
    }, 30);

    // keyboard + raw (trackpad) edge guards
    window.addEventListener('keydown', this.onKeyDown, { passive: false });
    this.wheelHandler = this.onWheelRaw;
    this.tStartHandler = this.onTouchStartRaw;
    this.tMoveHandler = this.onTouchMoveRaw;
    window.addEventListener('wheel', this.wheelHandler, { passive: false });
    window.addEventListener('touchstart', this.tStartHandler, { passive: true });
    window.addEventListener('touchmove', this.tMoveHandler, { passive: false });
  }

  ngOnDestroy(): void {
    this.earthGlobe.dispose();
    if (this.earthResizeObserver) {
      this.earthResizeObserver.disconnect();
      this.earthResizeObserver = null;
    }
    if (this.earthResizeTimer) clearTimeout(this.earthResizeTimer);
    window.removeEventListener('keydown', this.onKeyDown as any);
    if (this.resizeDoneTimer) clearTimeout(this.resizeDoneTimer);
    if (this.wheelHandler) window.removeEventListener('wheel', this.wheelHandler as any);
    if (this.tStartHandler) window.removeEventListener('touchstart', this.tStartHandler as any);
    if (this.tMoveHandler) window.removeEventListener('touchmove', this.tMoveHandler as any);
  }

  // ── Input / edge guards ───────────────────────────────────────────────────────
  private onWheelRaw = (e: WheelEvent) => {
    if (this._scrollLocked || this._ZOOM_ANIM.active) {
      e.preventDefault();
      return;
    }
    const pushingUp = e.deltaY < 0;
    const pushingDown = e.deltaY > 0;
    if ((this.atDatasetStart() && pushingUp) || (this.atDatasetEnd() && pushingDown)) {
      e.preventDefault();
    }
  };
  private onTouchStartRaw = (e: TouchEvent) => {
    this.touchY0 = e.touches?.[0]?.clientY ?? null;
  };
  private onTouchMoveRaw = (e: TouchEvent) => {
    if (this._scrollLocked || this._ZOOM_ANIM.active) {
      e.preventDefault();
      return;
    }
    if (this.touchY0 == null) return;
    const y = e.touches?.[0]?.clientY ?? this.touchY0;
    const dy = y - this.touchY0;
    const pushingUp = dy > 0;
    const pushingDown = dy < 0;
    if ((this.atDatasetStart() && pushingUp) || (this.atDatasetEnd() && pushingDown)) {
      e.preventDefault();
    }
  };

  // ── Zoom Control handlers (wired from template) ───────────────────────────────
  onZoomInput(idx: number) {
    this.pendingZoomIdx = this.clampZoomIndex(idx);
  }
  onZoomChange(idx: number) {
    const target = this.pendingZoomIdx ?? idx;
    this.pendingZoomIdx = null;
    this.setZoomIndex(target);
  }

  private onKeyDown = (e: KeyboardEvent) => {
    const ae = document.activeElement as HTMLElement | null;
    const tn = ae?.tagName?.toUpperCase?.() ?? '';
    const typing =
      tn === 'INPUT' || tn === 'TEXTAREA' || tn === 'SELECT' || !!ae?.isContentEditable;
    if (typing) return;
    const key = e.key || e.code;
    if (key === 'ArrowRight') {
      e.preventDefault();
      this.setZoomIndex(this.currentZoomIdx + 1);
    } else if (key === 'ArrowLeft') {
      e.preventDefault();
      this.setZoomIndex(this.currentZoomIdx - 1);
    }
  };

  // ── Host listeners ────────────────────────────────────────────────────────────
  @HostListener('window:resize')
  onResize() {
    const keepYear = this.yToYearDev(this.CH / 2);
    if (this.resizeDoneTimer) clearTimeout(this.resizeDoneTimer);

    this.resizeDoneTimer = setTimeout(() => {
      if (this._ZOOM_ANIM.active) {
        this.TL.unitYears = this._ZOOM_ANIM.endUnit;
        this.currentZoomIdx = this._ZOOM_ANIM.targetIdx;
        this._ZOOM_ANIM.active = false;
      }

      // Resize Earth globe and update canvas CSS size
      if (this.earthCanvas && this.earthCanvas.nativeElement) {
        const size = Math.min(window.innerWidth, window.innerHeight) * 0.8;

        // Update CSS dimensions so ResizeObserver can detect the change
        const canvas = this.earthCanvas.nativeElement;
        canvas.style.width = size + 'px';
        canvas.style.height = size + 'px';
      }

      this.applySize(this.viewportW(), this.viewportH());
      this.reanchorGridForCenter(keepYear);
      this.updateScrollBounds();
      this.ensureScrollRoomFromBounds();

      if (this.useVirtualWindow) {
        const mid = ((this.SCROLL_MIN ?? 0) + (this.SCROLL_MAX ?? 0)) * 0.5;
        const sx = window.scrollX || window.pageXOffset || 0;
        this.starRender.rebasePhaseForProgrammaticScroll(sx, mid);
        window.scrollTo(0, mid);
        this.reanchorGridForCenter(keepYear);
        this.starParallaxScrollX = sx;
        this.starParallaxScrollY = mid;
      } else {
        const y = this.scrollForYear(keepYear) + this.SCROLL_SHIFT;
        window.scrollTo(0, y);
        this.starParallaxScrollX = window.scrollX || window.pageXOffset || 0;
        this.starParallaxScrollY = y;
      }
      this.clampScroll();
      this.redraw();
    }, this.RESIZE_DEBOUNCE_MS);
  }

  @HostListener('window:scroll')
  onScroll() {
    if (this._scrollLocked || this._ZOOM_ANIM.active) {
      this.settingScroll = true;
      window.scrollTo(0, this.lastScrollY);
      this.settingScroll = false;
      return;
    }
    if (this.settingScroll) return;

    const s = window.scrollY || window.pageYOffset || 0;

    if (this.SCROLL_MIN != null && s < this.SCROLL_MIN - 1) {
      window.scrollTo(0, this.SCROLL_MIN);
      return;
    } else if (this.SCROLL_MAX != null && s > this.SCROLL_MAX + 1) {
      window.scrollTo(0, this.SCROLL_MAX);
      return;
    }

    const kyRaw = this.yToYearDev(this.CH / 2);
    const kyClamped = this.clampCenterToData(kyRaw);

    const es = this.getEntries();
    const EPS = 1e-7;
    let pushingPastTop = false;
    let pushingPastBottom = false;
    if (es.length) {
      const minY = es[0].yf,
        maxY = es[es.length - 1].yf;
      pushingPastTop = kyClamped <= minY + EPS && kyRaw < kyClamped - EPS;
      pushingPastBottom = kyClamped >= maxY - EPS && kyRaw > kyClamped + EPS;
    }

    if (pushingPastTop || pushingPastBottom) {
      const keep = kyClamped;
      const target = pushingPastTop ? this.SCROLL_MIN ?? s : this.SCROLL_MAX ?? s;

      const sx = window.scrollX || window.pageXOffset || 0;
      this.starRender.rebasePhaseForProgrammaticScroll(sx, target);

      this.settingScroll = true;
      window.scrollTo(0, target);
      this.settingScroll = false;

      this.reanchorGridForCenter(keep);
      this.starParallaxScrollX = sx;
      this.starParallaxScrollY = target;
      this.lastScrollY = target;

      this.redraw();
      return;
    }

    this.centerYF = kyClamped;
    this.reanchorGridForCenter(kyClamped);

    const rawSx = window.scrollX || window.pageXOffset || 0;
    const rawSy = s;
    let effSy = rawSy;

    if (pushingPastTop || pushingPastBottom) {
      effSy = this.starParallaxScrollY;
    } else {
      if (this.SCROLL_MIN != null && rawSy <= this.SCROLL_MIN + 0.5) {
        if (rawSy < this.starParallaxScrollY) effSy = this.starParallaxScrollY;
      }
      if (this.SCROLL_MAX != null && rawSy >= this.SCROLL_MAX - 0.5) {
        if (rawSy > this.starParallaxScrollY) effSy = this.starParallaxScrollY;
      }
    }

    this.starParallaxScrollX = rawSx;
    this.starParallaxScrollY = effSy;

    if (!(pushingPastTop && s < this.lastScrollY) && !(pushingPastBottom && s > this.lastScrollY)) {
      this.lastScrollY = s;
    }

    this.redraw();
    setTimeout(() => this.updateInfoBox(), 0);
    this.recenterVirtualWindowIfNeeded();
  }

  // ── HUD building / sizing ─────────────────────────────────────────────────────
  private buildHudLayers() {
    const before = this.centerline?.nativeElement as HTMLCanvasElement | null;
    const parent = (before?.parentNode ?? null) as (Node & ParentNode) | null;

    this.hudService.clearHuds(); // Clear service layers
    this.HUDS = []; // Clear local array

    for (const spec of this.zoomLevels) {
      let el = document.getElementById(spec.id) as HTMLCanvasElement | null;
      if (!el) {
        el = this.r2.createElement('canvas') as HTMLCanvasElement;
        el.id = spec.id;
        this.r2.addClass(el, 'layer');
        this.r2.addClass(el, 'hud');
        if (parent && before) parent.insertBefore(el, before);
        else (before?.ownerDocument?.body ?? document.body).appendChild(el);
      }
      el.classList.add('hud-hidden', 'no-anim');
      const ctx = el.getContext('2d', { alpha: true }) as CanvasRenderingContext2D;
      const hudLayer = { el, ctx, unit: spec.unit, id: spec.id };
      this.HUDS.push(hudLayer);
      this.hudService.addHudLayer(hudLayer);
    }
  }
  private viewportW() {
    const host = this.starHost?.nativeElement;
    if (host) return host.clientWidth || window.innerWidth;
    const vv = (window as any).visualViewport;
    if (vv?.width) return vv.width;
    return window.innerWidth;
  }
  private viewportH() {
    const host = this.starHost?.nativeElement;
    if (host) return host.clientHeight || window.innerHeight;
    const vv = (window as any).visualViewport;
    if (vv?.height) return vv.height;
    return window.innerHeight;
  }
  private sizeAll() {
    this.applySize(this.viewportW(), this.viewportH());
  }
  private applySize(cssW: number, cssH: number) {
    this.DPR = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    this.starRender.setDevicePixelRatio(this.DPR);
    const Wn = Math.floor(cssW * this.DPR),
      Hn = Math.floor(cssH * this.DPR);
    this.W = Wn;
    this.H = Hn;

    const star = this.starCanvas.nativeElement;
    star.width = this.W;
    star.height = this.H;
    star.style.width = cssW + 'px';
    star.style.height = cssH + 'px';

    for (const h of this.HUDS) {
      h.el.width = this.W;
      h.el.height = this.H;
      h.el.style.width = cssW + 'px';
      h.el.style.height = cssH + 'px';
    }

    const ccv = this.centerline.nativeElement;
    const tcv = this.timeline.nativeElement;
    ccv.width = this.CW = this.W;
    ccv.height = this.CH = this.H;
    ccv.style.width = cssW + 'px';
    ccv.style.height = cssH + 'px';
    tcv.width = this.TW = this.W;
    tcv.height = this.TH = this.H;
    tcv.style.width = cssW + 'px';
    tcv.style.height = cssH + 'px';

    this.GRID.spacingCSS = Math.max(12, cssH / this.GRID.targetVisible);
    this.dpr = this.DPR;
  }

  // ── Easing: accel→cruise→decel (non-recursive, area-normalized) ───────────────
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
    const vmax = 1 / (c + 0.5 * (a + d)); // area=1

    if (t <= a) {
      return (vmax * (t * t)) / (2 * Math.max(a, 1e-6));
    }
    if (t <= a + c) {
      const f_acc = vmax * (a / 2);
      return f_acc + vmax * (t - a);
    }
    const f_acc_cruise = vmax * (a / 2 + c);
    const s = (t - (a + c)) / Math.max(d, 1e-6); // 0..1
    return f_acc_cruise + vmax * (d * (s - 0.5 * s * s));
  }

  // ── Helpers: parsing / mapping ────────────────────────────────────────────────
  private clamp(v: number, a: number, b: number) {
    return v < a ? a : v > b ? b : v;
  }
  private isLeapYear(y: number) {
    return this.dateService.isLeapYear(y);
  }
  private daysInYear(y: number) {
    return this.dateService.daysInYear(y);
  }
  private startOfYearInt(yf: number) {
    return this.dateService.startOfYearInt(yf);
  }

  private yearParseWithFlag(input: string | number): { yf: number; yearOnly: boolean } {
    return this.dateService.yearParseWithFlag(input);
  }

  private yearFractionFromInput(input: string | number): number {
    return this.dateService.yearFractionFromInput(input);
  }

  private getEntries() {
    const out: {
      label: string;
      when: string;
      yf: number;
      yearOnly: boolean;
      location?: { lat: number; lon: number; name?: string };
    }[] = [];
    for (const key of Object.keys(this.TIMELINE_POINTS)) {
      const point = this.TIMELINE_POINTS[key];
      const { yf, yearOnly } = this.yearParseWithFlag(key);
      if (!isNaN(yf)) {
        out.push({
          label: key,
          when: point.description,
          yf,
          yearOnly,
          location: point.location,
        });
      }
    }
    out.sort((a, b) => a.yf - b.yf);
    return out;
  }

  private nowYearFraction() {
    return this.dateService.nowYearFraction();
  }

  // ── Grid & mapping ────────────────────────────────────────────────────────────
  private gridKStart() {
    const sY = (window.scrollY || window.pageYOffset || 0) - this.SCROLL_SHIFT;
    return Math.ceil((sY - this.GRID.topGapCSS) / this.GRID.spacingCSS);
  }
  private anchorGrid() {
    if (this.GRID_K0 == null) this.GRID_K0 = this.gridKStart();
  }
  private baselineGridK() {
    this.anchorGrid();
    return (this.GRID_K0 as number) + (this.TL.baselineOffsetIndex | 0);
  }
  private ppy() {
    return (this.GRID.spacingCSS * this.DPR) / this.TL.unitYears;
  }
  private baselineYDev() {
    const sY = (window.scrollY || window.pageYOffset || 0) - this.SCROLL_SHIFT;
    return (this.GRID.topGapCSS + this.baselineGridK() * this.GRID.spacingCSS - sY) * this.DPR;
  }
  private yearToY(y: number) {
    return Math.round(this.baselineYDev() + (y - this.TL.baseYear) * this.ppy());
  }
  private yToYearDev(yDev: number) {
    return this.TL.baseYear + (yDev - this.baselineYDev()) / this.ppy();
  }
  private snapToUnit(yf: number, unit: number) {
    return this.dateService.snapToUnit(yf, unit);
  }
  private reanchorGridForCenter(yf: number) {
    const sY = (window.scrollY || window.pageYOffset || 0) - this.SCROLL_SHIFT;
    const spacing = this.GRID.spacingCSS;
    if (!spacing || !isFinite(spacing)) return;
    const val =
      this.CH / (2 * this.DPR) -
      this.GRID.topGapCSS +
      sY -
      (yf - this.TL.baseYear) * (spacing / this.TL.unitYears);
    this.GRID_K0 = val / spacing - (this.TL.baselineOffsetIndex | 0);
  }
  private scrollForYear(yf: number) {
    return (
      this.GRID.topGapCSS +
      this.baselineGridK() * this.GRID.spacingCSS +
      (yf - this.TL.baseYear) * (this.GRID.spacingCSS / this.TL.unitYears) -
      this.CH / (2 * this.DPR)
    );
  }
  private clampCenterToData(yf: number) {
    const es = this.getEntries();
    if (!es.length) return yf;
    const min = es[0].yf,
      max = es[es.length - 1].yf;
    if (yf < min) return min;
    if (yf > max) return max;
    return yf;
  }
  private updateScrollBounds() {
    const es = this.getEntries();
    if (!es.length) {
      this.SCROLL_MIN = this.SCROLL_MAX = null;
      this.SCROLL_SHIFT = 0;
      return;
    }
    this.anchorGrid();
    const first = es[0].yf,
      last = es[es.length - 1].yf;
    const minL = this.scrollForYear(first),
      maxL = this.scrollForYear(last);
    if (!isFinite(minL) || !isFinite(maxL)) {
      this.SCROLL_MIN = this.SCROLL_MAX = null;
      return;
    }
    this.SCROLL_SHIFT = -minL;
    const maxP = maxL + this.SCROLL_SHIFT;
    this.SCROLL_MIN = 0;
    this.SCROLL_MAX = Math.max(0, maxP);
    if (this.SCROLL_MAX < this.SCROLL_MIN)
      [this.SCROLL_MIN, this.SCROLL_MAX] = [this.SCROLL_MAX, this.SCROLL_MIN];
  }
  private clampScroll() {
    if (this.SCROLL_MIN == null || this.SCROLL_MAX == null) return;
    const s = window.scrollY || window.pageYOffset || 0;
    if (s < this.SCROLL_MIN) window.scrollTo(0, this.SCROLL_MIN);
    else if (s > this.SCROLL_MAX) window.scrollTo(0, this.SCROLL_MAX);
  }

  // ── Redraw ────────────────────────────────────────────────────────────────────
  private redraw(fadeFrom = 1, fadeTo = 0) {
    this.starRender.setParallaxScroll(this.starParallaxScrollX, this.starParallaxScrollY);
    this.starRender.setScale(this.starEffectiveScale);
    this.starRender.draw(this.viewportW(), this.viewportH());

    this.drawHuds(fadeFrom, fadeTo);
    this.drawCenterline();
    this.drawTimeline();
  }

  private readonly MONTHS = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  private getMonthName(monthIndex: number): string {
    return this.MONTHS[monthIndex];
  }

  private drawHudLayer(
    ctx: CanvasRenderingContext2D,
    Wc: number,
    Hc: number,
    unitYears: number,
    zoomIdx?: number
  ) {
    const idx = zoomIdx ?? this.currentZoomIdx;
    const zoomLevelName = this.zoomLevels[idx]?.name ?? 'Year';

    this.hudService.drawHudLayer({
      ctx,
      canvasWidth: Wc,
      canvasHeight: Hc,
      dpr: this.DPR,
      screenWidth: window.innerWidth,
      unitYears,
      zoomLevelName,
      yearToY: this.yearToY.bind(this),
      yToYearDev: this.yToYearDev.bind(this),
      nowYearFraction: this.nowYearFraction.bind(this),
      formatLabelByUnit: this.formatLabelByUnit.bind(this),
      labelFromDayOfYear: this.labelFromDayOfYear.bind(this),
      daysInYear: this.daysInYear.bind(this),
      getMonthName: this.getMonthName.bind(this),
      dateService: this.dateService,
    });
  }

  private labelFromDayOfYear(year: number, dayOfYear0: number): string {
    return this.dateService.labelFromDayOfYear(year, dayOfYear0);
  }

  private drawHuds(fadeFrom = 1, fadeTo = 0) {
    if (this._ZOOM_ANIM.active) {
      const from = this.HUDS[this.animFromIdx];
      const to = this.HUDS[this.animToIdx];

      const fromUnit = this._ZOOM_ANIM.hudStartUnit ?? this._ZOOM_ANIM.startUnit;
      const toUnit = this._ZOOM_ANIM.hudEndUnit ?? this._ZOOM_ANIM.endUnit;

      from.ctx.clearRect(0, 0, this.W, this.H);
      to.ctx.clearRect(0, 0, this.W, this.H);

      this.drawHudLayer(from.ctx, this.W, this.H, fromUnit, this.animFromIdx);
      this.drawHudLayer(to.ctx, this.W, this.H, toUnit, this.animToIdx);

      from.el.style.opacity = String(fadeFrom);
      to.el.style.opacity = String(fadeTo);
      return;
    }

    for (let i = 0; i < this.HUDS.length; i++) {
      const h = this.HUDS[i];
      h.ctx.clearRect(0, 0, this.W, this.H);
      h.el.style.opacity = i === this.currentZoomIdx ? '1' : '0';
    }
    const cur = this.HUDS[this.currentZoomIdx];
    this.drawHudLayer(
      cur.ctx,
      this.W,
      this.H,
      this.zoomLevels[this.currentZoomIdx].unit,
      this.currentZoomIdx
    );
  }

  private formatLabelByUnit(yf: number, unit: number) {
    return this.dateService.formatLabelByUnit(yf, unit);
  }

  private drawCenterline() {
    const canvas = this.centerline.nativeElement;
    this.hudService.drawCenterline({
      canvas,
      canvasWidth: this.CW,
      canvasHeight: this.CH,
      dpr: this.DPR,
      screenWidth: window.innerWidth,
      currentZoomIdx: this.currentZoomIdx,
      scrollY: window.scrollY || window.pageYOffset || 0,
      scrollMin: this.SCROLL_MIN,
      scrollMax: this.SCROLL_MAX,
      entries: this.getEntries(),
      yearToY: this.yToYearDev.bind(this),
      formatLabel: this.formatLabelByUnit.bind(this),
      snapToUnit: this.snapToUnit.bind(this),
      dateService: this.dateService,
    });
  }

  private centerFirstPoint() {
    if (this.DID_AUTO_CENTER) return;
    const es = this.getEntries();
    if (!es.length) return;
    const target = es[0].yf;

    if (this.useVirtualWindow) {
      this.centerYF = target;
      this.reanchorGridForCenter(target);
      this.updateScrollBounds();
      this.ensureScrollRoomFromBounds();
    } else {
      const sTarget = this.scrollForYear(target);
      window.scrollTo(0, sTarget + this.SCROLL_SHIFT);
    }
    this.DID_AUTO_CENTER = true;
  }

  private drawTimeline() {
    const tcv = this.timeline.nativeElement;
    const ttx = tcv.getContext('2d')!;
    ttx.clearRect(0, 0, this.TW, this.TH);

    const x = Math.round(this.TW / 2);
    const nowYF = this.nowYearFraction();
    const pts = this.getEntries().map((p) => {
      const yLogical = p.yearOnly ? this.startOfYearInt(p.yf) : p.yf;
      return { ...p, x, y: this.yearToY(yLogical) };
    });

    const lw = Math.max(1, Math.round(this.TL.lineWcss * this.DPR));
    const glow = Math.max(0, Math.round(this.TL.lineGlow * this.DPR));
    const seg = (y1: number, y2: number, color: string, dash: boolean) => {
      ttx.save();
      ttx.lineWidth = lw;
      ttx.strokeStyle = color;
      ttx.shadowBlur = glow;
      ttx.shadowColor = color;
      ttx.setLineDash(
        dash
          ? [
              Math.round(this.TL.lineDashCSS[0] * this.DPR),
              Math.round(this.TL.lineDashCSS[1] * this.DPR),
            ]
          : []
      );
      ttx.beginPath();
      ttx.moveTo(x, y1);
      ttx.lineTo(x, y2);
      ttx.stroke();
      ttx.restore();
    };

    const ny = this.yearToY(nowYF);
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i],
        b = pts[i + 1];
      const y1 = a.y,
        y2 = b.y;
      const lo = Math.min(y1, y2),
        hi = Math.max(y1, y2);
      if (hi <= ny) seg(y1, y2, this.TL.linePast, false);
      else if (lo >= ny) seg(y1, y2, this.TL.lineFuture, true);
      else {
        seg(y1, ny, this.TL.linePast, false);
        seg(ny, y2, this.TL.lineFuture, true);
      }
    }

    const r = Math.max(2, Math.round(this.TL.pointRcss * this.DPR));
    const pGlow = Math.max(0, Math.round(this.TL.pointGlow * this.DPR));
    const font = `${Math.max(
      10,
      Math.round(12 * this.DPR)
    )}px system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell`;

    for (const p of pts) {
      const isFuture = p.yf > nowYF;
      const color = isFuture ? this.TL.pointFuture : this.TL.pointPast;
      ttx.save();
      ttx.shadowBlur = pGlow;
      ttx.shadowColor = color;
      ttx.fillStyle = color;
      ttx.beginPath();
      ttx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ttx.fill();
      ttx.restore();

      ttx.save();
      ttx.font = font;
      ttx.textAlign = 'left';
      ttx.textBaseline = 'middle';
      ttx.fillStyle = 'rgba(255,235,200,0.96)';
      ttx.fillText(p.label, p.x + r + Math.round(8 * this.DPR), p.y);
      ttx.restore();
    }
  }

  // ── Virtual window helpers ────────────────────────────────────────────────────
  private atDatasetStart(): boolean {
    const es = this.getEntries();
    if (!es.length) return true;
    const cy = this.centerYF ?? this.yToYearDev(this.CH / 2);
    return cy <= es[0].yf;
  }
  private atDatasetEnd(): boolean {
    const es = this.getEntries();
    if (!es.length) return true;
    const cy = this.centerYF ?? this.yToYearDev(this.CH / 2);
    return cy >= es[es.length - 1].yf;
  }

  private jumpVirtualWindow(keepYear: number, towards: 'top' | 'bottom') {
    const min = this.SCROLL_MIN ?? 0;
    const max = this.SCROLL_MAX ?? 0;
    const vv = (window as any).visualViewport;
    const vh = vv?.height || window.innerHeight || this.H / this.DPR;
    const pad = Math.max(this.EDGE_PAD, Math.round(vh * 0.02));
    const target = towards === 'top' ? min + pad : max - pad;
    const sxNew = window.scrollX || window.pageXOffset || 0;

    this.starRender.rebasePhaseForProgrammaticScroll(sxNew, target);

    this.settingScroll = true;
    window.scrollTo(0, target);
    this.settingScroll = false;

    this.reanchorGridForCenter(keepYear);
    this.starParallaxScrollX = sxNew;
    this.starParallaxScrollY = target;
    this.lastScrollY = target;

    this.clampScroll();
    this.redraw();
  }

  private recenterToVirtualMid(keepYear: number, mid?: number) {
    const m = mid ?? ((this.SCROLL_MIN ?? 0) + (this.SCROLL_MAX ?? 0)) * 0.5;
    const sxNew = window.scrollX || window.pageXOffset || 0;

    this.starRender.rebasePhaseForProgrammaticScroll(sxNew, m);

    this.settingScroll = true;
    window.scrollTo(0, m);
    this.settingScroll = false;

    this.reanchorGridForCenter(keepYear);
    this.starParallaxScrollX = sxNew;
    this.starParallaxScrollY = m;
    this.lastScrollY = m;

    this.clampScroll();
    this.redraw();
  }

  private recenterVirtualWindowIfNeeded() {
    if (!this.useVirtualWindow || this._ZOOM_ANIM.active) return;
    const s = window.scrollY || window.pageYOffset || 0;
    const min = this.SCROLL_MIN ?? 0;
    const max = this.SCROLL_MAX ?? 0;

    const nearTop = s <= min + this.EDGE_EPS;
    const nearBot = s >= max - this.EDGE_EPS;

    if ((nearTop && this.atDatasetStart()) || (nearBot && this.atDatasetEnd())) return;
    const keep = this.centerYF ?? this.yToYearDev(this.CH / 2);
    if (nearTop) this.jumpVirtualWindow(keep, 'bottom');
    else if (nearBot) this.jumpVirtualWindow(keep, 'top');
  }

  private ensureScrollRoomFromBounds() {
    const demo = document.querySelector('.demo') as HTMLElement | null;
    if (!demo) return;
    const vv = (window as any).visualViewport;
    const vh = vv?.height || window.innerHeight || this.H / this.DPR;

    if (this.useVirtualWindow) {
      const vwinPx = Math.max(this.VWIN_MULT * vh, vh);
      demo.style.minHeight = `${vwinPx}px`;
      this.SCROLL_MIN = 0;
      this.SCROLL_MAX = Math.max(0, vwinPx - vh);
      this.SCROLL_SHIFT = 0;
    } else {
      const needed = Math.ceil((this.SCROLL_MAX ?? 0) - (this.SCROLL_MIN ?? 0) + vh);
      demo.style.minHeight = Math.max(needed, vh) + 'px';
    }
  }

  private get useVirtualWindow() {
    return true;
  }

  // ── Zoom logic ────────────────────────────────────────────────────────────────
  private clampZoomIndex(idx: number) {
    if (idx < 0) idx = 0;
    else if (idx >= this.zoomLevels.length) idx = this.zoomLevels.length - 1;
    return idx;
  }

  private setZoomIndex(idx: number) {
    idx = this.clampZoomIndex(idx);
    if (idx === this.currentZoomIdx) return;

    // Finish any running anim instantly
    if (this._ZOOM_ANIM.active) {
      this.TL.unitYears = this._ZOOM_ANIM.endUnit;
      this.currentZoomIdx = this._ZOOM_ANIM.targetIdx;
      this._ZOOM_ANIM.active = false;
      this.unlockScrollingHard();
    }

    const keepYear = this.centerYF ?? this.yToYearDev(this.CH / 2);
    this.centerYF = this.clampCenterToData(keepYear);

    const startIdx = this.currentZoomIdx;
    const endIdx = idx;
    const startUnit = this.zoomLevels[startIdx].unit;
    const endUnit = this.zoomLevels[endIdx].unit;
    const dir = endIdx > startIdx ? 1 : -1;

    // 1) LOCK SCROLL during the whole animation
    this.lockScrollingHard();

    // 2) Freeze star phase once for the entire jump
    const lock = this.starRender.freezePhaseForZoom(
      this.starBaseScaleByLevel[startIdx],
      this.starBaseScaleByLevel[endIdx]
    );
    this.starZoom.active = true;
    this.starZoom.from = lock.fromScale;
    this.starZoom.to = lock.toScale;
    this.starZoom.lockOffX = lock.lockOffX;
    this.starZoom.lockOffY = lock.lockOffY;
    this.starEffectiveScale = this.starZoom.from;

    // First HUD pair opacities only
    const fromIdxSeed = startIdx;
    const toIdxSeed = startIdx + dir;
    for (let i = 0; i < this.HUDS.length; i++) {
      const el = this.HUDS[i].el;
      el.classList.add('no-anim');
      el.classList.remove('hud-visible', 'hud-hidden');
      if (i === fromIdxSeed) el.style.opacity = '1';
      else if (i === toIdxSeed) el.style.opacity = '0';
    }

    // Build path across units
    const unitsSeq: number[] = [];
    for (let i = startIdx; i !== endIdx; i += dir) unitsSeq.push(this.zoomLevels[i].unit);
    unitsSeq.push(this.zoomLevels[endIdx].unit);

    const stepDist: number[] = [];
    for (let i = 0; i < unitsSeq.length - 1; i++) {
      const a = unitsSeq[i],
        b = unitsSeq[i + 1];
      const r = b / a;
      const d = r > 0 && isFinite(r) ? Math.abs(Math.log(r)) : Math.abs(b - a);
      stepDist.push(d);
    }
    const cumDist: number[] = [0];
    for (let i = 0; i < stepDist.length; i++) cumDist.push(cumDist[i] + stepDist[i]);
    const totalDist = cumDist[cumDist.length - 1] || 1;

    // Duration proportional to steps
    const steps = Math.max(1, Math.abs(endIdx - startIdx));
    // Duration scales from ~4s (1 step) up to ~10s (max steps) with convex compression.
    const allSteps = Math.max(1, this.zoomLevels.length - 1);
    const norm = allSteps > 1 ? (steps - 1) / (allSteps - 1) : 0; // 0..1
    const emph = norm * norm; // bias more compression for longer jumps
    const totalDur = Math.round(
      this.DUR_SINGLE_STEP_MS + (this.DUR_ACROSS_ALL_MS - this.DUR_SINGLE_STEP_MS) * emph
    );

    // Live caption during transition
    this._zoomStepLabel = this.zoomLevels[startIdx].name;

    // Set document.title hint
    const oldTitle = document.title;
    document.title = `${this._zoomStepLabel} — ${oldTitle.replace(/^(.*?)( — )?/, '')}`;

    // Seed animation state
    this._ZOOM_ANIM = {
      active: true,
      t0: performance && performance.now ? performance.now() : Date.now(),
      dur: totalDur,
      startUnit,
      endUnit,
      keepYear,
      targetIdx: endIdx,

      starFromScale: this.starZoom.from,
      starToScale: this.starZoom.to,

      hudFromIdx: fromIdxSeed,
      hudToIdx: toIdxSeed,
      hudStartUnit: this.zoomLevels[fromIdxSeed]?.unit ?? startUnit,
      hudEndUnit: this.zoomLevels[toIdxSeed]?.unit ?? endUnit,

      startIdx,
      endIdx,

      unitsSeq,
      stepDist,
      cumDist,
      totalDist,
    };

    this.animFromIdx = fromIdxSeed;
    this.animToIdx = toIdxSeed;

    // First frame
    this.TL.unitYears = startUnit;
    this._zoomVisualIndex = startIdx;
    this.redraw(1, 0);

    requestAnimationFrame(this.zoomTick);
  }

  private lerp(a: number, b: number, t: number) {
    return a + (b - a) * t;
  }

  private zoomTick = () => {
    if (!this._ZOOM_ANIM.active) return;

    const now = performance && performance.now ? performance.now() : Date.now();
    const elapsed = Math.max(0, now - this._ZOOM_ANIM.t0);
    const totalMs = this._ZOOM_ANIM.dur;

    // Global progress 0..1
    const g = this.clamp(elapsed / totalMs, 0, 1);

    // Spaceship profile for BOTH stars and HUD path
    const ship = this.accelCruiseDecel(g, 0.36, 0.36);

    // Path info
    const unitsSeq: number[] = this._ZOOM_ANIM.unitsSeq!;
    const stepDist: number[] = this._ZOOM_ANIM.stepDist!;
    const cumDist: number[] = this._ZOOM_ANIM.cumDist!;
    const totalDist: number = this._ZOOM_ANIM.totalDist || 1;

    // Target distance along the piecewise-log path
    const dTarget = ship * totalDist;

    // Find current segment
    let i = 0;
    while (i < stepDist.length - 1 && dTarget > cumDist[i + 1]) i++;

    const dSeg = stepDist[i] || 1e-6;
    const segT = this.clamp((dTarget - cumDist[i]) / dSeg, 0, 1);

    const a = unitsSeq[i];
    const b = unitsSeq[i + 1];
    const r = b > 0 && a > 0 ? b / a : 1;
    const unitThisFrame =
      r > 0 && isFinite(r) ? a * Math.exp(Math.log(r) * segT) : this.lerp(a, b, segT);

    // Apply mapping
    this.TL.unitYears = unitThisFrame;

    // Center anchoring
    const ky = this._ZOOM_ANIM.keepYear!;
    this.centerYF = this.clampCenterToData(ky);
    this.reanchorGridForCenter(ky);

    // Stars follow the same "ship" progress
    this.starEffectiveScale = this.lerp(
      this._ZOOM_ANIM.starFromScale!,
      this._ZOOM_ANIM.starToScale!,
      ship
    );

    // Active HUD pair & fade
    const startIdx = this._ZOOM_ANIM.startIdx!;
    const endIdx = this._ZOOM_ANIM.endIdx!;
    const dir = endIdx > startIdx ? 1 : -1;

    const curFromIdx = startIdx + i * dir;
    const curToIdx = curFromIdx + dir;

    if (curFromIdx !== this.animFromIdx || curToIdx !== this.animToIdx) {
      this._ZOOM_ANIM.hudFromIdx = curFromIdx;
      this._ZOOM_ANIM.hudToIdx = curToIdx;
      this._ZOOM_ANIM.hudStartUnit = this.zoomLevels[curFromIdx].unit;
      this._ZOOM_ANIM.hudEndUnit = this.zoomLevels[curToIdx].unit;
      this.animFromIdx = curFromIdx;
      this.animToIdx = curToIdx;
      this.HUDS[this.animFromIdx].el.style.opacity = '1';
      this.HUDS[this.animToIdx].el.style.opacity = '0';
    }

    const fadeTo = segT;
    const fadeFrom = 1 - fadeTo;

    // Decide which level we’re effectively “at” this frame.
    // Visual slider position (fractional)
    const visualIndex = startIdx + dir * (i + segT);
    this._zoomVisualIndex = visualIndex;
    // (Keep the thumb parked: no need to call setSliderVisualIndex here)

    // — Caption changes exactly at tick crossings —
    const EPS = 1e-6;
    // When zooming in (dir=+1), show the level at/behind the progress edge:
    // stays "from" until the edge reaches the next tick, then flips.
    const liveIdx =
      dir > 0
        ? Math.min(endIdx, Math.floor(visualIndex + EPS))
        : Math.max(endIdx, Math.ceil(visualIndex - EPS));

    this._zoomStepLabel = this.zoomLevels[liveIdx].name;

    // Draw frame
    this.redraw(fadeFrom, fadeTo);

    // Keep bounds aligned while mapping changes
    this.updateScrollBounds();
    this.ensureScrollRoomFromBounds();

    if (elapsed < totalMs) {
      requestAnimationFrame(this.zoomTick);
      return;
    }

    // ── Finish ──
    this.TL.unitYears = this._ZOOM_ANIM.endUnit;
    this.currentZoomIdx = this._ZOOM_ANIM.targetIdx;

    // Snap final slider position & restore caption to the settled level
    this._zoomStepLabel = ''; // template can show current level name

    this._ZOOM_ANIM.active = false;

    // Restore title
    document.title = document.title.replace(/^[^—]+ —\s*/, '');

    // Re-anchor & finalize
    this.reanchorGridForCenter(ky);
    this.updateScrollBounds();
    this.ensureScrollRoomFromBounds();

    if (this.useVirtualWindow) {
      this.recenterToVirtualMid(ky);
    } else {
      const yTarget = this.scrollForYear(ky) + this.SCROLL_SHIFT;
      window.scrollTo(0, yTarget);
      this.clampScroll();
      this.starParallaxScrollX = window.scrollX || window.pageXOffset || 0;
      this.starParallaxScrollY = yTarget;
    }

    this.starZoom.active = false;
    this.starEffectiveScale = this.starBaseScaleByLevel[this.currentZoomIdx];
    this.starRender.endZoomFreezeAndMatchPhase();

    // Unlock scroll AFTER the final frame
    this.unlockScrollingHard();

    this.redraw();

    // Restore CSS-driven visibility
    for (let j = 0; j < this.HUDS.length; j++) {
      const el = this.HUDS[j].el;
      el.classList.remove('no-anim');
      el.style.opacity = '';
      if (j === this.currentZoomIdx) el.classList.add('hud-visible');
      else el.classList.add('hud-hidden');
    }
  };

  // ── Scroll locks ──────────────────────────────────────────────────────────────
  private lockScrollingHard() {
    if (this._scrollLocked) return;
    this._scrollLocked = true;

    const de = document.documentElement as HTMLElement;
    this.prevDocOverflow = de.style.overflowY ?? '';
    this.prevDocOverscroll = (de.style as any).overscrollBehavior ?? '';

    de.style.overflowY = 'hidden';
    (de.style as any).overscrollBehavior = 'none';
  }
  private unlockScrollingHard() {
    if (!this._scrollLocked) return;
    this._scrollLocked = false;

    const de = document.documentElement as HTMLElement;
    if (this.prevDocOverflow != null) de.style.overflowY = this.prevDocOverflow;
    if (this.prevDocOverscroll != null)
      (de.style as any).overscrollBehavior = this.prevDocOverscroll;
  }
  private prevDocOverflow: string | null = null;
  private prevDocOverscroll: string | null = null;
}
