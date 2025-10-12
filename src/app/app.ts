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
import { ZoomControlComponent } from './zoom-control/zoom-control.component';

type ZoomSpec = { id: string; name: string; unit: number };

@Component({
  selector: 'app-root',
  standalone: true,
  templateUrl: './app.html',
  styleUrl: './app.scss',
  imports: [ZoomControlComponent],
})
export class App implements AfterViewInit, OnDestroy {
  constructor(private starRender: StarfieldRendererService, private r2: Renderer2) {}

  // ── Debug helpers ─────────────────────────────────────────────────────────────
  private DEBUG_ZOOM = true; // flip to false to silence logs
  private _dbgLast = 0;
  private dbg(...args: any[]) {
    if (!this.DEBUG_ZOOM) return;
    const now = (performance && performance.now ? performance.now() : Date.now()) as number;
    // throttle so we can read logs
    if (now - this._dbgLast > 100) {
      // eslint-disable-next-line no-console
      console.log('[zoom]', ...args);
      this._dbgLast = now;
    }
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
  @ViewChild('centerline', { static: true }) centerline!: ElementRef<HTMLCanvasElement>;
  @ViewChild('timeline', { static: true }) timeline!: ElementRef<HTMLCanvasElement>;

  // ── Zoom tiers ────────────────────────────────────────────────────────────────
  zoomLevels: ZoomSpec[] = [
    { id: 'guidesDay', name: 'Day', unit: 1 / 365 },
    { id: 'guidesMonth', name: 'Month', unit: 1 / 12 },
    { id: 'guidesYear', name: 'Year', unit: 1 },
    { id: 'guidesDecade', name: 'Decade', unit: 10 },
    { id: 'guidesCentury', name: 'Century', unit: 100 },
    { id: 'guidesMilennium', name: 'Milennium', unit: 1000 },
  ];
  zoomLabels: string[] = this.zoomLevels.map((z) => z.name);
  currentZoomIdx = 2; // Year

  private readonly starBaseScaleByLevel = [1.1, 1.06, 1.0, 0.96, 0.93, 0.9];

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

  // Canonical center date
  private centerYF: number | null = null;
  private pendingZoomIdx: number | null = null;

  // Parallax drivers
  private starParallaxScrollX = 0;
  private starParallaxScrollY = 0;

  private settingScroll = false;
  private lastScrollY = 0;

  private readonly EDGE_PAD = 32;

  private readonly ONE_LEVEL_MS = 2500; // same feel as your single-level zoom

  // HUD canvas list
  private HUDS: Array<{
    el: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    unit: number;
    id: string;
  }> = [];

  // ── Data ──────────────────────────────────────────────────────────────────────
  private TIMELINE_POINTS: Record<string, string> = {
    'January 1, 150 B.C.E.': 'January 1, 150 B.C.E.',
    '0 C.E.': '0 C.E.',
    '1 C.E.': '1 C.E.',
    '10 C.E.': '10 C.E.',
    '100 C.E.': '100 C.E.',
    'February 27, 501 C.E.': 'February 27, 501 C.E.',
    'February 28, 501 C.E.': 'February 28, 501 C.E.',
    'February 28, 2024 C.E.': 'February 28, 2024 C.E.',
    'February 29, 2024 C.E.': 'February 29, 2024 C.E.',
    '1000 C.E.': '1000 C.E.',
    '2000 C.E.': '2000 C.E.',
    'June 1, 2025 C.E.': 'June 1, 2025 C.E.',
    'September 30, 2025 C.E.': 'September 30, 2025 C.E.',
    '2050 C.E.': '2050 C.E.',
  };

  // ── Sizing ────────────────────────────────────────────────────────────────────
  private dpr = Math.max(1, window.devicePixelRatio || 1);
  private DPR = 1;
  private W = 0;
  private H = 0;
  private CW = 0;
  private CH = 0;
  private TW = 0;
  private TH = 0;

  // Grid/HUD config — 6 visible lines target
  private GRID = {
    spacingCSS: 0,
    targetVisible: 6, // <— requested tweak
    topGapCSS: 40,
    color: 'rgba(255,150,60,0.55)',
    thicknessCSS: 2,
  };

  // Timeline style
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
  private resizeDoneTimer: any = null;
  private readonly RESIZE_DEBOUNCE_MS = 250;

  // Raw listeners
  private wheelHandler?: (e: WheelEvent) => void;
  private tStartHandler?: (e: TouchEvent) => void;
  private tMoveHandler?: (e: TouchEvent) => void;
  private touchY0: number | null = null;

  // ── Zoom envelope (plus HUD step fields) ──────────────────────────────────────
  private ZOOM_ANIM: {
    active: boolean;
    t0: number;
    dur: number;
    startUnit: number;
    endUnit: number;
    keepYear: number | null;
    targetIdx: number;

    // star tween endpoints (single smooth tween end-to-end)
    starFromScale?: number;
    starToScale?: number;

    // HUD step pair
    hudFromIdx?: number;
    hudToIdx?: number;
    hudStartUnit?: number;
    hudEndUnit?: number;

    startIdx?: number;
    endIdx?: number;
  } = {
    active: false,
    t0: 0,
    dur: 2500,
    startUnit: 1,
    endUnit: 1,
    keepYear: null,
    targetIdx: this.currentZoomIdx,
  };

  // ── Helpers ───────────────────────────────────────────────────────────────────
  private get useVirtualWindow() {
    return true;
  }

  private yearsPerCssPx() {
    return this.TL.unitYears / this.GRID.spacingCSS;
  }

  ngAfterViewInit(): void {
    this.buildHudLayers();

    this.starRender.init(this.starCanvas.nativeElement, 512);
    this.starRender.setDevicePixelRatio(this.DPR);

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
    this.lastScrollY = this.starParallaxScrollY; // <— seed last “good” position

    // show active tier
    for (const h of this.HUDS) {
      h.el.classList.add('hud-hidden', 'no-anim');
      h.el.classList.remove('hud-visible');
    }
    this.redraw();
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
    window.removeEventListener('keydown', this.onKeyDown as any);
    if (this.resizeDoneTimer) clearTimeout(this.resizeDoneTimer);
    if (this.wheelHandler) window.removeEventListener('wheel', this.wheelHandler as any);
    if (this.tStartHandler) window.removeEventListener('touchstart', this.tStartHandler as any);
    if (this.tMoveHandler) window.removeEventListener('touchmove', this.tMoveHandler as any);
  }

  // ── Input / edge guards (blocks momentum on trackpad) ─────────────────────────
  private onWheelRaw = (e: WheelEvent) => {
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
    if (this.touchY0 == null) return;
    const y = e.touches?.[0]?.clientY ?? this.touchY0;
    const dy = y - this.touchY0;
    const pushingUp = dy > 0;
    const pushingDown = dy < 0;
    if ((this.atDatasetStart() && pushingUp) || (this.atDatasetEnd() && pushingDown)) {
      e.preventDefault();
    }
  };

  // ── Zoom Control handlers ─────────────────────────────────────────────────────
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
      if (this.ZOOM_ANIM.active) {
        this.TL.unitYears = this.ZOOM_ANIM.endUnit;
        this.currentZoomIdx = this.ZOOM_ANIM.targetIdx;
        this.ZOOM_ANIM.active = false;
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
    // Ignore our own programmatic jumps
    if (this.settingScroll) return;

    const s = window.scrollY || window.pageYOffset || 0;

    // Clamp to virtual-window bounds (safety)
    if (this.SCROLL_MIN != null && s < this.SCROLL_MIN - 1) {
      window.scrollTo(0, this.SCROLL_MIN);
      return;
    } else if (this.SCROLL_MAX != null && s > this.SCROLL_MAX + 1) {
      window.scrollTo(0, this.SCROLL_MAX);
      return;
    }

    // Compute center-year raw vs clamped
    const kyRaw = this.yToYearDev(this.CH / 2);
    const kyClamped = this.clampCenterToData(kyRaw);

    // Are we *pushing past* dataset edges? (i.e., raw trying to go beyond the clamp)
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

    // If user is pushing past the dataset, snap to the nearest virtual edge
    // and preserve star phase + center-year anchoring.
    if (pushingPastTop || pushingPastBottom) {
      const keep = kyClamped; // keep the edge date under the centerline
      const target = pushingPastTop ? this.SCROLL_MIN ?? s : this.SCROLL_MAX ?? s;

      // preserve on-screen star phase across this programmatic jump
      const sx = window.scrollX || window.pageXOffset || 0;
      this.starRender.rebasePhaseForProgrammaticScroll(sx, target);

      // perform the snap-to-edge without re-entrancy
      this.settingScroll = true;
      window.scrollTo(0, target);
      this.settingScroll = false;

      // keep the same date under the centerline and freeze parallax at the edge
      this.reanchorGridForCenter(keep);
      this.starParallaxScrollX = sx;
      this.starParallaxScrollY = target;
      this.lastScrollY = target;

      this.redraw();
      return;
    }

    // Commit the clamped center and keep grid locked to it
    this.centerYF = kyClamped;
    this.reanchorGridForCenter(kyClamped);

    // Effective parallax scroll (freeze when hard-clamped or at virtual edges)
    const rawSx = window.scrollX || window.pageXOffset || 0;
    const rawSy = s;
    let effSy = rawSy;

    if (pushingPastTop || pushingPastBottom) {
      // Freeze parallax completely while hard-clamped at dataset bounds.
      effSy = this.starParallaxScrollY;
    } else {
      // Directional freeze at virtual-window edges
      if (this.SCROLL_MIN != null && rawSy <= this.SCROLL_MIN + 0.5) {
        if (rawSy < this.starParallaxScrollY) effSy = this.starParallaxScrollY;
      }
      if (this.SCROLL_MAX != null && rawSy >= this.SCROLL_MAX - 0.5) {
        if (rawSy > this.starParallaxScrollY) effSy = this.starParallaxScrollY;
      }
    }

    // Commit parallax drivers
    this.starParallaxScrollX = rawSx;
    this.starParallaxScrollY = effSy;

    // Only update "last good" scroll when we are NOT pushing outward past an edge.
    // (If pushing inward/back toward data, s will move toward lastScrollY and this is fine.)
    if (!(pushingPastTop && s < this.lastScrollY) && !(pushingPastBottom && s > this.lastScrollY)) {
      this.lastScrollY = s;
    }

    // Draw everything
    this.redraw();

    // Flip to opposite side of the virtual window when needed
    this.recenterVirtualWindowIfNeeded();
  }

  // ── HUD building / sizing ─────────────────────────────────────────────────────
  private buildHudLayers() {
    const before = this.centerline?.nativeElement as HTMLCanvasElement | null;
    const parent = (before?.parentNode ?? null) as (Node & ParentNode) | null;

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
      this.HUDS.push({ el, ctx, unit: spec.unit, id: spec.id });
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

  // ── Data helpers / parsing ────────────────────────────────────────────────────
  private clamp(v: number, a: number, b: number) {
    return v < a ? a : v > b ? b : v;
  }
  private isLeapYear(y: number) {
    const a = Math.abs(y);
    return a % 4 === 0 && (a % 100 !== 0 || a % 400 === 0);
  }
  private daysInYear(y: number) {
    return this.isLeapYear(y) ? 366 : 365;
  }
  private startOfYearInt(yf: number) {
    return yf >= 0 ? Math.floor(yf) : Math.ceil(yf);
  }

  private yearParseWithFlag(input: string | number) {
    if (typeof input === 'number' && isFinite(input))
      return { yf: input, yearOnly: Math.floor(input) === input };
    if (typeof input !== 'string') return { yf: NaN, yearOnly: false };

    const raw = input.normalize ? input.normalize('NFKC').trim() : String(input).trim();
    const U = raw.toUpperCase();
    const months = [
      'JAN',
      'FEB',
      'MAR',
      'APR',
      'MAY',
      'JUN',
      'JUL',
      'AUG',
      'SEP',
      'SEPT',
      'OCT',
      'NOV',
      'DEC',
    ];
    let hasMonth = false;
    if (U) {
      const p0 = U.split(',').join(' ').split(' ');
      if (p0.length) {
        const t0 = p0[0];
        for (const m of months)
          if (t0.indexOf(m) === 0) {
            hasMonth = true;
            break;
          }
      }
    }
    const yf = this.yearFractionFromInput(raw);
    const yearOnly = !hasMonth && isFinite(yf) && Math.floor(Math.abs(yf)) === Math.abs(yf);
    return { yf, yearOnly };
  }

  private yearFractionFromInput(input: string | number): number {
    if (typeof input === 'number' && isFinite(input)) return input;
    if (typeof input !== 'string') return NaN;

    const raw = input.normalize ? input.normalize('NFKC').trim() : String(input).trim();
    const U = raw.toUpperCase();
    const hasBCE =
      U.includes('BCE') ||
      U.includes('B.C.E') ||
      U.endsWith(' BC') ||
      /BC\s*$/i.test(U) ||
      U.includes('B.C.');

    const lastInt = (str: string) => {
      let num: number | null = null,
        cur = '';
      for (const c of str) {
        if (c >= '0' && c <= '9') cur += c;
        else if (cur) {
          num = parseInt(cur, 10);
          cur = '';
        }
      }
      if (cur) num = parseInt(cur, 10);
      return num === null ? NaN : num;
    };

    const months = [
      'JAN',
      'FEB',
      'MAR',
      'APR',
      'MAY',
      'JUN',
      'JUL',
      'AUG',
      'SEP',
      'SEPT',
      'OCT',
      'NOV',
      'DEC',
    ];
    const mdays = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    const parts = raw.split(',').join(' ').split(' ').filter(Boolean);
    let mi = -1;
    if (parts.length) {
      const t0 = parts[0].toUpperCase();
      for (let j = 0; j < months.length; j++)
        if (t0.indexOf(months[j]) === 0) {
          mi = j % 12;
          break;
        }
    }

    if (mi >= 0 && parts.length >= 2) {
      const day = parseInt(parts[1], 10);
      const yAbs = lastInt(raw);
      if (!isNaN(day) && !isNaN(yAbs)) {
        let doy = day;
        for (let k = 0; k < mi; k++) doy += mdays[k];
        const frac = this.clamp((doy - 1) / 365, 0, 0.999999);
        return hasBCE ? -Math.abs(yAbs) + frac : yAbs + frac;
      }
    }

    const yOnly = lastInt(raw);
    if (!isNaN(yOnly)) return hasBCE ? -Math.abs(yOnly) : yOnly;
    return NaN;
  }

  private getEntries() {
    const out: { label: string; when: string; yf: number; yearOnly: boolean }[] = [];
    for (const key of Object.keys(this.TIMELINE_POINTS)) {
      const when = this.TIMELINE_POINTS[key];
      const { yf, yearOnly } = this.yearParseWithFlag(when);
      if (!isNaN(yf)) out.push({ label: key, when, yf, yearOnly });
    }
    out.sort((a, b) => a.yf - b.yf);
    return out;
  }

  private nowYearFraction() {
    const d = new Date();
    const y = d.getUTCFullYear();
    const a = Date.UTC(y, 0, 1),
      b = Date.UTC(y + 1, 0, 1);
    return y + (d.getTime() - a) / (b - a);
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
    if (!unit) return yf;
    return yf >= 0 ? Math.floor(yf / unit) * unit : -Math.ceil(Math.abs(yf) / unit) * unit;
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

  private drawHudLayer(ctx: CanvasRenderingContext2D, Wc: number, Hc: number, unitYears: number) {
    ctx.clearRect(0, 0, Wc, Hc);

    const thick = Math.max(1, Math.round(this.GRID.thicknessCSS * this.DPR));
    const segLen = Math.max(2, Math.round((window.innerWidth || Wc) * 0.1 * this.DPR));
    const x0 = Math.round((Wc - segLen) / 2);

    ctx.font = `${Math.max(
      10,
      Math.round(12 * this.DPR)
    )}px system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'right';
    const labelMargin = Math.round(6 * this.DPR);

    const u = unitYears;
    const yTopYear = this.yToYearDev(0);
    const yBotYear = this.yToYearDev(Hc);

    // ── helpers ─────────────────────────────────────────────────────────────
    // tolerant day-tier detector
    const isDayTier = Math.abs(u - 1 / 365) < 1e-6 || Math.abs(u - 1 / 366) < 1e-6;

    const nextMonthOrYearAtOrAbove = (y: number, stepYears: number) =>
      y >= 0
        ? Math.ceil(y / stepYears) * stepYears
        : -Math.floor(Math.abs(y) / stepYears) * stepYears;

    const nextStepAtOrAbove = (y: number, step: number) =>
      y >= 0 ? Math.ceil(y / step) * step : -Math.floor(Math.abs(y) / step) * step;

    // ── ticks ───────────────────────────────────────────────────────────────
    if (isDayTier) {
      // Uniform placement every 1/365 year to avoid gaps/stalls.
      // Labels still use per-year day units (1/daysInYear(year)) for leap-year correctness.
      const step = 1 / 365;

      let yTick = nextStepAtOrAbove(yTopYear - 1e-9, step);

      // Cap loop count based on visible span (prevents runaway loops).
      const visibleYears = Math.max(0, yBotYear - yTopYear);
      const maxTicks = Math.min(15000, Math.ceil(visibleYears / step) + 20);

      let safety = 0;
      while (yTick <= yBotYear + 1e-7 && safety++ < maxTicks) {
        const yPx = this.yearToY(yTick);

        // tick
        ctx.fillStyle = this.GRID.color;
        ctx.fillRect(x0, Math.round(yPx - Math.floor(thick / 2)), segLen, thick);

        // label (use per-year unit for leap correctness)
        const yr = yTick >= 0 ? Math.floor(yTick) : Math.ceil(yTick);
        const diy = this.daysInYear(yr);
        const label = this.formatLabelByUnit(yTick, 1 / diy);
        if (label) {
          ctx.fillStyle = 'rgba(255,170,80,0.95)';
          ctx.fillText(label, x0 - labelMargin, Math.round(yPx));
        }

        yTick += step;
      }
    } else {
      // Original non-day path (Month/Year/Decade/Century/Millennium)
      let yTick = nextMonthOrYearAtOrAbove(yTopYear - 1e-9, u);

      let safety = 0;
      while (yTick <= yBotYear + 1e-7 && safety++ < 4000) {
        const yPx = this.yearToY(yTick);
        ctx.fillStyle = this.GRID.color;
        ctx.fillRect(x0, Math.round(yPx - Math.floor(thick / 2)), segLen, thick);

        const label = this.formatLabelByUnit(yTick, u);
        ctx.fillStyle = 'rgba(255,170,80,0.95)';
        if (label) ctx.fillText(label, x0 - labelMargin, Math.round(yPx));

        yTick += u;
      }
    }

    // ── Today marker (unchanged) ────────────────────────────────────────────
    const yToday = Math.round(this.yearToY(this.nowYearFraction()));
    if (yToday >= -4 && yToday <= Hc + 4) {
      const ySeg = yToday - Math.floor(thick / 2);
      ctx.save();
      ctx.fillStyle = 'rgba(255,70,70,0.9)';
      ctx.fillRect(x0, ySeg, segLen, thick);
      ctx.restore();

      const d = new Date();
      const monthsT = [
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
      const todayLabel = `${
        monthsT[d.getUTCMonth()]
      } ${d.getUTCDate()}, ${d.getUTCFullYear()} C.E.`;
      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(255,70,70,0.95)';
      ctx.fillText(todayLabel, x0 - labelMargin, Math.round(yToday));
    }
  }

  private drawHuds(fadeFrom = 1, fadeTo = 0) {
    if (this.ZOOM_ANIM.active) {
      const from = this.HUDS[this.animFromIdx];
      const to = this.HUDS[this.animToIdx];

      // Use the *current step's* units, not the whole-jump units
      const fromUnit = this.ZOOM_ANIM.hudStartUnit ?? this.ZOOM_ANIM.startUnit;
      const toUnit = this.ZOOM_ANIM.hudEndUnit ?? this.ZOOM_ANIM.endUnit;

      // Debug visibility
      this.dbg('drawHuds(active)', {
        fromIdx: this.animFromIdx,
        toIdx: this.animToIdx,
        fromUnit,
        toUnit,
        fadeFrom: +fadeFrom.toFixed(2),
        fadeTo: +fadeTo.toFixed(2),
      });

      // Clear only the two active layers
      from.ctx.clearRect(0, 0, this.W, this.H);
      to.ctx.clearRect(0, 0, this.W, this.H);

      // Draw ticks using the *current step's* pair units.
      // TL.unitYears (set in zoomTick) controls the mapping/stretching.
      this.drawHudLayer(from.ctx, this.W, this.H, fromUnit);
      this.drawHudLayer(to.ctx, this.W, this.H, toUnit);

      // Programmatic opacities for the active pair
      from.el.style.opacity = String(fadeFrom); // 1 → 0
      to.el.style.opacity = String(fadeTo); // 0 → 1
      return;
    }

    // ── Non-anim: single active layer ──
    for (let i = 0; i < this.HUDS.length; i++) {
      const h = this.HUDS[i];
      h.ctx.clearRect(0, 0, this.W, this.H);
      h.el.style.opacity = i === this.currentZoomIdx ? '1' : '0';
    }
    const cur = this.HUDS[this.currentZoomIdx];
    this.drawHudLayer(cur.ctx, this.W, this.H, this.zoomLevels[this.currentZoomIdx].unit);
  }

  private formatLabelByUnit(yf: number, unit: number) {
    const isBCE = yf < 0;
    let abs = isBCE ? -yf : yf;
    let yInt = Math.floor(abs);
    let frac = abs - yInt;
    const calYear = yf >= 0 ? Math.floor(yf) : Math.ceil(yf);
    let diy = this.daysInYear(calYear);

    if (Math.abs(unit - 1 / diy) < 1e-7 || Math.abs(unit - 1 / 365) < 1e-7) {
      let dayOfYear = Math.round(frac * diy);
      if (dayOfYear === diy) {
        dayOfYear = 0;
        yInt += 1;
        diy = this.daysInYear(calYear + 1);
      }
      const md = [31, this.isLeapYear(calYear) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
      const months2 = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
      ];
      let mi = 0,
        dleft = dayOfYear;
      while (mi < 12) {
        if (dleft < md[mi]) break;
        dleft -= md[mi];
        mi++;
      }
      if (mi > 11) {
        mi = 11;
        dleft = md[11] - 1;
      }
      const day = dleft + 1;
      let yr3 = isBCE ? -yInt : yInt;
      const tail2 = yr3 < 0 ? ' B.C.E.' : ' C.E.';
      if (yr3 < 0) yr3 = -yr3;
      return `${months2[mi]} ${day}, ${yr3}${tail2}`;
    }

    if (Math.abs(unit - 1 / 12) < 1e-7) {
      let m = Math.round(frac * 12);
      if (m === 12) {
        m = 0;
        yInt += 1;
      }
      const months = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
      ];
      let yr2 = isBCE ? -yInt : yInt;
      const tail = yr2 < 0 ? ' B.C.E.' : ' C.E.';
      if (yr2 < 0) yr2 = -yr2;
      return `${months[m]} ${yr2}${tail}`;
    }

    if (unit >= 1) {
      const yr = isBCE ? -Math.round(abs) : Math.round(abs);
      return yr < 0 ? `${-yr} B.C.E.` : `${yr} C.E.`;
    }
    return '';
  }

  private drawCenterline() {
    const ccv = this.centerline.nativeElement;
    const clx = ccv.getContext('2d')!;
    clx.clearRect(0, 0, this.CW, this.CH);

    const y = Math.round(this.CH / 2);
    const unit = this.HUDS[this.currentZoomIdx]?.unit ?? 1;

    const yfCenter = this.yToYearDev(this.CH / 2);
    let snapped = this.snapToUnit(yfCenter, unit);

    const s = window.scrollY || window.pageYOffset || 0;
    if (this.SCROLL_MIN != null && this.SCROLL_MAX != null) {
      const es = this.getEntries();
      if (es.length) {
        const THRESH = 1;
        if (s <= this.SCROLL_MIN + THRESH) snapped = this.snapToUnit(es[0].yf, unit);
        else if (s >= this.SCROLL_MAX - THRESH)
          snapped = this.snapToUnit(es[es.length - 1].yf, unit);
      }
    }

    const label = this.formatLabelByUnit(snapped, unit);
    const thick = Math.max(1, Math.round(this.GRID.thicknessCSS * this.DPR));
    const segLen = Math.max(2, Math.round((window.innerWidth || this.TW) * 0.1 * this.DPR));
    const x0 = Math.round((this.CW - segLen) / 2);
    const labelMargin = Math.round(6 * this.DPR);

    clx.save();
    clx.fillStyle = 'rgba(200,200,210,0.65)';
    clx.fillRect(x0, y - Math.floor(thick / 2), segLen, thick);
    clx.font = `${Math.max(
      10,
      Math.round(12 * this.DPR)
    )}px system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell`;
    clx.textAlign = 'right';
    clx.textBaseline = 'middle';
    clx.fillStyle = 'rgba(200,200,210,0.9)';
    clx.fillText(label, x0 - labelMargin, y);
    clx.restore();
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
        y2 = b.y,
        lo = Math.min(y1, y2),
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

  // ── Virtual window flipping ───────────────────────────────────────────────────
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
    if (!this.useVirtualWindow || this.ZOOM_ANIM.active) return;
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

  // ── Zoom logic (stepwise HUD pairs, single smooth star/timeline) ──────────────
  private clampZoomIndex(idx: number) {
    if (idx < 0) idx = 0;
    else if (idx >= this.zoomLevels.length) idx = this.zoomLevels.length - 1;
    return idx;
  }

  // ── Zoom logic: chained HUD steps @ capped speed; single smooth star/timeline ──
  private setZoomIndex(idx: number) {
    idx = this.clampZoomIndex(idx);
    if (idx === this.currentZoomIdx) return;

    // If a tween is running, snap to end first
    if (this.ZOOM_ANIM.active) {
      this.TL.unitYears = this.ZOOM_ANIM.endUnit;
      this.currentZoomIdx = this.ZOOM_ANIM.targetIdx;
      this.ZOOM_ANIM.active = false;
    }

    const keepYear = this.centerYF ?? this.yToYearDev(this.CH / 2);
    this.centerYF = this.clampCenterToData(keepYear);

    const startIdx = this.currentZoomIdx;
    const endIdx = idx;
    const startUnit = this.zoomLevels[startIdx].unit;
    const endUnit = this.zoomLevels[endIdx].unit;

    const stepDir = endIdx > startIdx ? 1 : -1;
    const steps = Math.abs(endIdx - startIdx); // number of HUD transitions
    if (steps === 0) return;

    // Freeze star phase ONCE for whole jump (single smooth star tween)
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

    // Prepare HUD layers: disable CSS transitions; seed first pair opacities
    const fromIdxSeed = startIdx;
    const toIdxSeed = startIdx + stepDir;
    for (let i = 0; i < this.HUDS.length; i++) {
      const el = this.HUDS[i].el;
      el.classList.add('no-anim');
      el.classList.remove('hud-visible', 'hud-hidden');
      if (i === fromIdxSeed) el.style.opacity = '1';
      else if (i === toIdxSeed) el.style.opacity = '0';
    }

    // Duration scales with number of steps so per-level speed matches single-level
    const totalDur = this.ONE_LEVEL_MS * steps;

    this.ZOOM_ANIM = {
      active: true,
      t0: (performance && performance.now ? performance.now() : Date.now()) as number,
      dur: totalDur,
      startUnit,
      endUnit,
      keepYear,
      targetIdx: endIdx,

      // store step bookkeeping
      startIdx,
      endIdx,
      hudFromIdx: fromIdxSeed,
      hudToIdx: toIdxSeed,
      hudStartUnit: this.zoomLevels[fromIdxSeed].unit,
      hudEndUnit: this.zoomLevels[toIdxSeed].unit,
      starFromScale: this.starZoom.from,
      starToScale: this.starZoom.to,
    };

    this.animFromIdx = fromIdxSeed;
    this.animToIdx = toIdxSeed;

    // First exact frame
    this.TL.unitYears = startUnit;
    this.redraw(1, 0);
    requestAnimationFrame(this.zoomTick);
  }

  private easeOutCubic(t: number) {
    return 1 - Math.pow(1 - t, 3);
  }
  private lerp(a: number, b: number, t: number) {
    return a + (b - a) * t;
  }

  private zoomTick = () => {
    if (!this.ZOOM_ANIM.active) return;

    const now = (performance && performance.now ? performance.now() : Date.now()) as number;
    let t = (now - this.ZOOM_ANIM.t0) / this.ZOOM_ANIM.dur;
    if (t < 0) t = 0;
    if (t > 1) t = 1;

    // Star/timeline: single smooth ease-out across the whole jump
    const moveP = this.easeOutCubic(t);
    const unit = this.lerp(this.ZOOM_ANIM.startUnit, this.ZOOM_ANIM.endUnit, moveP);
    this.TL.unitYears = unit;

    const ky = this.ZOOM_ANIM.keepYear!;
    this.centerYF = this.clampCenterToData(ky);
    this.reanchorGridForCenter(ky);
    this.updateScrollBounds();
    this.ensureScrollRoomFromBounds();

    // Star density tween (phase frozen)
    this.starEffectiveScale = this.lerp(
      this.ZOOM_ANIM.starFromScale!,
      this.ZOOM_ANIM.starToScale!,
      moveP
    );

    // ── HUD chaining ──
    const steps = Math.abs(this.ZOOM_ANIM.endIdx! - this.ZOOM_ANIM.startIdx!);
    const stepDir = this.ZOOM_ANIM.endIdx! > this.ZOOM_ANIM.startIdx! ? 1 : -1;

    // Use *linear time* to march through HUD steps so earlier steps don't ease
    const s = t * steps; // 0..steps
    let k = Math.floor(s); // current completed steps
    if (k >= steps) k = steps - 1; // clamp to last segment
    const local = s - k; // progress in current segment (0..1)

    const curFromIdx = this.ZOOM_ANIM.startIdx! + k * stepDir;
    const curToIdx = curFromIdx + stepDir;

    // If we moved into a new pair, reset indices and opacities for the new pair
    if (curFromIdx !== this.animFromIdx || curToIdx !== this.animToIdx) {
      this.animFromIdx = curFromIdx;
      this.animToIdx = curToIdx;
      this.ZOOM_ANIM.hudFromIdx = curFromIdx;
      this.ZOOM_ANIM.hudToIdx = curToIdx;
      this.ZOOM_ANIM.hudStartUnit = this.zoomLevels[curFromIdx].unit;
      this.ZOOM_ANIM.hudEndUnit = this.zoomLevels[curToIdx].unit;

      // lock visibilities before starting this segment fade
      this.HUDS[this.animFromIdx].el.style.opacity = '1';
      this.HUDS[this.animToIdx].el.style.opacity = '0';
    }

    // Fade rule: linear for all intermediate steps; ease-out only for the final step
    const isFinalStep = k === steps - 1;
    const localFade = isFinalStep ? this.easeOutCubic(local) : local;

    const fadeFrom = 1 - localFade;
    const fadeTo = localFade;

    // Draw frame (stars + cross-fading HUDs + overlays)
    this.redraw(fadeFrom, fadeTo);

    if (t < 1) {
      requestAnimationFrame(this.zoomTick);
      return;
    }

    // ── Finish ──
    this.TL.unitYears = this.ZOOM_ANIM.endUnit;
    this.currentZoomIdx = this.ZOOM_ANIM.targetIdx;
    this.ZOOM_ANIM.active = false;

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

    // Final draw
    this.redraw();

    // Restore CSS-driven visibility for steady state
    for (let i = 0; i < this.HUDS.length; i++) {
      const el = this.HUDS[i].el;
      el.classList.remove('no-anim');
      el.style.opacity = '';
      if (i === this.currentZoomIdx) el.classList.add('hud-visible');
      else el.classList.add('hud-hidden');
    }
  };
}
