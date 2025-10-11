import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  HostListener,
  Renderer2,
} from '@angular/core';
import { StarfieldService } from './starfield.service';
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
  constructor(private stars: StarfieldService, private r2: Renderer2) {}

  @ViewChild('starHost', { static: true }) starHost!: ElementRef<HTMLDivElement>;
  @ViewChild('starCanvas', { static: true }) starCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('centerline', { static: true }) centerline!: ElementRef<HTMLCanvasElement>;
  @ViewChild('timeline', { static: true }) timeline!: ElementRef<HTMLCanvasElement>;

  // ----- Zoom tiers (Day..Milennium) -----
  zoomLevels: ZoomSpec[] = [
    { id: 'guidesDay', name: 'Day', unit: 1 / 365 }, // ~, we handle leap in formatter
    { id: 'guidesMonth', name: 'Month', unit: 1 / 12 },
    { id: 'guidesYear', name: 'Year', unit: 1 },
    { id: 'guidesDecade', name: 'Decade', unit: 10 },
    { id: 'guidesCentury', name: 'Century', unit: 100 },
    { id: 'guidesMilennium', name: 'Milennium', unit: 1000 },
  ];
  zoomLabels: string[] = this.zoomLevels.map((z) => z.name);
  currentZoomIdx = 2; // Year

  // Per-zoom base densities: larger scale = "closer" (less dense)
  // Tune to taste; these *stack* by level. Example set:
  private readonly starBaseScaleByLevel = [
    1.1, // Day      (closest, least dense)
    1.06, // Month
    1.0, // Year     (neutral)
    0.96, // Decade
    0.93, // Century
    0.9, // Milennium (farthest, most dense)
  ];

  // Effective scale applied right now (non-anim = base of current level)
  private starEffectiveScale = this.starBaseScaleByLevel[this.currentZoomIdx];

  // Freeze the parallax phase during zoom so there’s no visible slide
  private starZoom = {
    active: false,
    from: this.starBaseScaleByLevel[this.currentZoomIdx],
    to: this.starBaseScaleByLevel[this.currentZoomIdx],
    // Scroll position at zoom start (informational)
    startSx: 0,
    startSy: 0,
    // Locked parallax phase to avoid any drift during zoom
    lockOffX: 0,
    lockOffY: 0,
  };

  // --- Step 1: zoom tween state (add these) ---
  private animFromIdx = this.currentZoomIdx;
  private animToIdx = this.currentZoomIdx;
  private centerYF: number | null = null; // canonical date under the grey center line
  private pendingZoomIdx: number | null = null;
  // Persistent phase base so we can resume parallax with no jump
  private starPhaseBaseX = 0; // in CSS px modulo patternSize
  private starPhaseBaseY = 0;

  // Starfield “depth” pulse amplitude during zoom (0.03–0.10 feels good)
  private readonly STAR_ZOOM_MAX = 0.06;

  private starParallaxScrollX = 0;
  private starParallaxScrollY = 0;

  // Prevent re-entrant work when we programmatically jump the scrollbar
  private settingScroll = false;

  // Tracks the last committed scrollY we consider "authoritative"
  private lastScrollY = 0;

  // Runtime-created HUD canvases
  private HUDS: {
    el: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    unit: number;
    id: string;
  }[] = [];

  // Timeline data (label -> when). You can edit these freely.
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

  // ---------- Starfield (reuse previous parallax approach) ----------
  private dpr = Math.max(1, window.devicePixelRatio || 1);
  private patternSize = 512;
  private pattern!: CanvasPattern;
  private parallaxX = 0.06; // match the HTML sample
  private parallaxY = 0.14;

  // Starfield tile
  private tile!: HTMLCanvasElement;

  // ---------- Drawing sizes ----------
  private DPR = 1;
  private W = 0;
  private H = 0; // device px
  private CW = 0;
  private CH = 0;
  private TW = 0;
  private TH = 0;

  private GRID = {
    spacingCSS: 0,
    targetVisible: 4,
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

  // Scroll anchoring
  private GRID_K0: number | null = null;
  private SCROLL_SHIFT = 0;
  private SCROLL_MIN: number | null = null;
  private SCROLL_MAX: number | null = null;
  private DID_AUTO_CENTER = false;

  // Raw listener refs so we can remove them
  private wheelHandler?: (e: WheelEvent) => void;
  private tStartHandler?: (e: TouchEvent) => void;
  private tMoveHandler?: (e: TouchEvent) => void;

  // Touch state
  private touchY0: number | null = null;

  // Zoom animation
  private ZOOM_ANIM = {
    active: false,
    t0: 0,
    dur: 2500,
    startUnit: 1,
    endUnit: 1,
    keepYear: null as number | null,
    targetIdx: this.currentZoomIdx,
  };

  private resizeDoneTimer: any = null;
  private readonly RESIZE_DEBOUNCE_MS = 250;

  // ===== Zoom Paging Config =====

  // ---- Virtual window config (tweak freely) ----
  // Total virtual scroll height = VWIN_MULT × viewport height.
  // With 17, user can scroll ~8×vh above/below before we recenter.
  private readonly VWIN_MULT = 17;

  // Tiny threshold so we don’t ping-pong on sub-pixel noise.
  private readonly EDGE_EPS = 2; // px

  // Years per *CSS* pixel at the current zoom (used for conversions if needed)
  private yearsPerCssPx() {
    // spacingCSS = CSS px between ticks when unitYears = TL.unitYears
    // ppy_css = CSS px per year = spacingCSS / unitYears
    // => years per CSS px = unitYears / spacingCSS
    return this.TL.unitYears / this.GRID.spacingCSS;
  }

  // Are we virtually paging this zoom? (Yes, for all tiers.)
  private get useVirtualWindow(): boolean {
    return true;
  }

  private onWheelRaw = (e: WheelEvent) => {
    // Only care if user is pushing beyond the dataset
    // Negative deltaY = scrolling up; positive = down (typical)
    const pushingUp = e.deltaY < 0;
    const pushingDown = e.deltaY > 0;

    if ((this.atDatasetStart() && pushingUp) || (this.atDatasetEnd() && pushingDown)) {
      e.preventDefault(); // stop scrollbar from moving at edges
    }
  };

  private onTouchStartRaw = (e: TouchEvent) => {
    this.touchY0 = e.touches?.[0]?.clientY ?? null;
  };

  private onTouchMoveRaw = (e: TouchEvent) => {
    if (this.touchY0 == null) return;
    const y = e.touches?.[0]?.clientY ?? this.touchY0;
    const dy = y - this.touchY0; // down = positive; up = negative
    const pushingUp = dy > 0;
    const pushingDown = dy < 0;

    if ((this.atDatasetStart() && pushingUp) || (this.atDatasetEnd() && pushingDown)) {
      e.preventDefault(); // block momentum/scrollbar at edges
    }
  };

  // Quick helpers for “data edges”
  private atDatasetStart(): boolean {
    const es = this.getEntries();
    if (!es.length) return true;
    // centerYF is the canonical lock; if null, compute it from current screen center
    const cy = this.centerYF ?? this.yToYearDev(this.CH / 2);
    return cy <= es[0].yf;
  }
  private atDatasetEnd(): boolean {
    const es = this.getEntries();
    if (!es.length) return true;
    const cy = this.centerYF ?? this.yToYearDev(this.CH / 2);
    return cy >= es[es.length - 1].yf;
  }

  // Keep parallax phase continuous when we programmatically change scroll.
  // newSx/newSy are the *target* window scrolls (CSS px).
  private rebaseStarPhaseForProgrammaticScroll(newSx: number, newSy: number) {
    const mod = (a: number, m: number) => ((a % m) + m) % m;

    // What offset (phase) is currently on-screen?
    let offX: number;
    let offY: number;

    if (this.starZoom.active) {
      // During zoom we’re already frozen to lockOffX/Y
      offX = this.starZoom.lockOffX;
      offY = this.starZoom.lockOffY;
    } else {
      const sx = window.scrollX || window.pageXOffset || 0;
      const sy = window.scrollY || window.pageYOffset || 0;
      offX = mod(-(sx * this.parallaxX) + this.starPhaseBaseX, this.patternSize);
      offY = mod(-(sy * this.parallaxY) + this.starPhaseBaseY, this.patternSize);
    }

    // Choose a new base so that with the *new* scroll we get the *same* on-screen phase.
    this.starPhaseBaseX = mod(offX + newSx * this.parallaxX, this.patternSize);
    this.starPhaseBaseY = mod(offY + newSy * this.parallaxY, this.patternSize);
  }

  // ===== Lifecycle =====
  ngAfterViewInit(): void {
    // build HUD layers (insert before centerline so z-order is correct)
    this.buildHudLayers();

    // init starfield pattern
    const sctx = this.starCanvas.nativeElement.getContext('2d')!;
    this.tile = this.stars.createStarTile('SPT-1234', this.patternSize);
    this.pattern = sctx.createPattern(this.tile, 'repeat')!;

    // size everything
    this.sizeAll();

    // zoom unit
    this.TL.unitYears = this.zoomLevels[this.currentZoomIdx].unit;

    // base year = first entry
    const entries = this.getEntries();
    if (entries.length) this.TL.baseYear = entries[0].yf;

    // anchor, bounds, room, center (same as before)
    this.anchorGrid();
    this.updateScrollBounds();
    this.ensureScrollRoomFromBounds();
    this.centerFirstPoint();
    this.updateScrollBounds();
    this.ensureScrollRoomFromBounds();
    this.clampScroll();

    // track initial parallax scroll
    this.starParallaxScrollX = window.scrollX || window.pageXOffset || 0;
    this.starParallaxScrollY = window.scrollY || window.pageYOffset || 0;

    // --- Virtual window normalization ---
    if (this.useVirtualWindow) {
      const keep = this.centerYF ?? this.yToYearDev(this.CH / 2);
      const mid = ((this.SCROLL_MIN ?? 0) + (this.SCROLL_MAX ?? 0)) * 0.5;

      this.rebaseStarPhaseForProgrammaticScroll(window.scrollX || window.pageXOffset || 0, mid);
      window.scrollTo(0, mid);

      this.starParallaxScrollX = window.scrollX || window.pageXOffset || 0;
      this.starParallaxScrollY = mid;

      this.reanchorGridForCenter(keep);
      this.clampScroll();
      this.redraw();
    }

    // show active HUD (unchanged)
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

    // Keyboard zoom
    window.addEventListener('keydown', this.onKeyDown, { passive: false });

    // --- Raw non-passive listeners so we can block scrolling at dataset edges ---
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

    // Remove raw listeners
    if (this.wheelHandler) window.removeEventListener('wheel', this.wheelHandler as any);
    if (this.tStartHandler) window.removeEventListener('touchstart', this.tStartHandler as any);
    if (this.tMoveHandler) window.removeEventListener('touchmove', this.tMoveHandler as any);
  }

  // ======= Template events =======
  onZoomInput(idx: number) {
    // Do NOT change layout on mousedown/drag; just remember the target.
    this.pendingZoomIdx = this.clampZoomIndex(idx);
    // (ZoomControlComponent updates its own label/thumb; no redraw here.)
  }
  onZoomChange(idx: number) {
    const target = this.pendingZoomIdx ?? idx;
    this.pendingZoomIdx = null;
    this.setZoomIndex(target);
  }

  // ======= Host listeners =======
  @HostListener('window:resize')
  onResize() {
    const keepYear = this.yToYearDev(this.CH / 2);

    if (this.resizeDoneTimer) clearTimeout(this.resizeDoneTimer);
    this.resizeDoneTimer = setTimeout(() => {
      // If a zoom is running, snap to its end state
      if (this.ZOOM_ANIM.active) {
        this.TL.unitYears = this.ZOOM_ANIM.endUnit;
        this.currentZoomIdx = this.ZOOM_ANIM.targetIdx;
        this.ZOOM_ANIM.active = false;
      }

      // Recompute canvas sizes from the starHost (viewport-fixed container)
      this.applySize(this.viewportW(), this.viewportH());

      // Preserve the date under the center line
      this.reanchorGridForCenter(keepYear);

      // Recompute bounds and the fixed-height virtual window
      this.updateScrollBounds();
      this.ensureScrollRoomFromBounds();

      if (this.useVirtualWindow) {
        // --- Virtual-window branch ---
        const mid = ((this.SCROLL_MIN ?? 0) + (this.SCROLL_MAX ?? 0)) * 0.5;

        // Keep the star phase visually continuous when we recenter the scrollbar
        this.rebaseStarPhaseForProgrammaticScroll(window.scrollX || window.pageXOffset || 0, mid);

        // Center the scrollbar within the virtual window
        window.scrollTo(0, mid);

        // Re-anchor once more so 'keepYear' is still under the center line after the jump
        this.reanchorGridForCenter(keepYear);

        // Update effective parallax scroll trackers
        this.starParallaxScrollX = window.scrollX || window.pageXOffset || 0;
        this.starParallaxScrollY = mid;
      } else {
        // --- Classic branch ---
        const y = this.scrollForYear(keepYear) + this.SCROLL_SHIFT;
        window.scrollTo(0, y);

        // Track the effective parallax scroll so the starfield stays in lockstep
        this.starParallaxScrollX = window.scrollX || window.pageXOffset || 0;
        this.starParallaxScrollY = y;
      }

      this.clampScroll();
      this.redraw();
    }, this.RESIZE_DEBOUNCE_MS);
  }

  @HostListener('window:scroll')
  onScroll() {
    // Ignore scroll events caused by our own programmatic jumps
    if (this.settingScroll) return;

    const s = window.scrollY || window.pageYOffset || 0;

    // Clamp to virtual window bounds (prevents runaway scrollbar).
    if (this.SCROLL_MIN != null && s < this.SCROLL_MIN - 1) {
      window.scrollTo(0, this.SCROLL_MIN);
      return;
    } else if (this.SCROLL_MAX != null && s > this.SCROLL_MAX + 1) {
      window.scrollTo(0, this.SCROLL_MAX);
      return;
    }

    // Raw center-year from current mapping (before clamp) and its clamped version.
    const kyRaw = this.yToYearDev(this.CH / 2);
    const kyClamped = this.clampCenterToData(kyRaw);
    this.centerYF = kyClamped;

    // Keep the grid anchored to the clamped center date
    this.reanchorGridForCenter(this.centerYF);

    // Determine if the user is pushing *past* dataset bounds.
    const es = this.getEntries();
    const EPS = 1e-7;
    let pushingPastTop = false;
    let pushingPastBottom = false;
    if (es.length) {
      const minY = es[0].yf;
      const maxY = es[es.length - 1].yf;
      pushingPastTop = kyClamped <= minY + EPS && kyRaw < kyClamped - EPS;
      pushingPastBottom = kyClamped >= maxY - EPS && kyRaw > kyClamped + EPS;
    }

    // Update *effective* parallax scroll, freezing when pushing past dataset
    // OR at the virtual window edges in the outward direction.
    const rawSx = window.scrollX || window.pageXOffset || 0;
    const rawSy = s;
    let effSy = rawSy;

    if (pushingPastTop || pushingPastBottom) {
      // Freeze parallax completely while hard-clamped at dataset bounds.
      effSy = this.starParallaxScrollY;
    } else {
      // Directional freeze at the virtual window edges
      if (this.SCROLL_MIN != null && rawSy <= this.SCROLL_MIN + 0.5) {
        if (rawSy < this.starParallaxScrollY) effSy = this.starParallaxScrollY;
      }
      if (this.SCROLL_MAX != null && rawSy >= this.SCROLL_MAX - 0.5) {
        if (rawSy > this.starParallaxScrollY) effSy = this.starParallaxScrollY;
      }
    }

    // Commit parallax positions
    this.starParallaxScrollX = rawSx;
    this.starParallaxScrollY = effSy;

    // Track "last good" scroll for other helpers
    this.lastScrollY = s;

    // Draw immediately
    this.redraw();

    // After drawing, recenter if we’ve hit the virtual edges (unless at dataset edge)
    this.recenterVirtualWindowIfNeeded();
  }

  // ======= Keyboard handler =======
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

  // ======= Building HUD canvases =======
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

        if (parent && before) {
          parent.insertBefore(el, before); // ✅ insert in the same container as centerline
        } else {
          // fallback if something odd happens
          (before?.ownerDocument?.body ?? document.body).appendChild(el);
        }
      }

      el.classList.add('hud-hidden', 'no-anim');
      const ctx = el.getContext('2d', { alpha: true }) as CanvasRenderingContext2D;
      this.HUDS.push({ el, ctx, unit: spec.unit, id: spec.id });
    }
  }

  // ======= Sizing helpers =======
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
    const Wn = Math.floor(cssW * this.DPR);
    const Hn = Math.floor(cssH * this.DPR);
    this.W = Wn;
    this.H = Hn;

    // Starfield canvas (we draw pattern each frame)
    const star = this.starCanvas.nativeElement;
    star.width = this.W;
    star.height = this.H;
    star.style.width = cssW + 'px';
    star.style.height = cssH + 'px';

    // HUD canvases
    for (const h of this.HUDS) {
      h.el.width = this.W;
      h.el.height = this.H;
      h.el.style.width = cssW + 'px';
      h.el.style.height = cssH + 'px';
    }

    // Centerline + timeline
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

    // grid spacing
    this.GRID.spacingCSS = Math.max(12, cssH / this.GRID.targetVisible);

    // starfield DPR for pattern draw
    this.dpr = this.DPR;
  }

  private clampCenterToData(yf: number): number {
    const es = this.getEntries();
    if (!es.length) return yf;
    const min = es[0].yf;
    const max = es[es.length - 1].yf;
    if (yf < min) return min;
    if (yf > max) return max;
    return yf;
  }

  // ======= Timeline utils =======
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

  private nowYearFraction() {
    const d = new Date();
    const y = d.getUTCFullYear();
    const a = Date.UTC(y, 0, 1),
      b = Date.UTC(y + 1, 0, 1);
    return y + (d.getTime() - a) / (b - a);
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

  // ======= Grid & mapping =======
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
  private baselineYDev() {
    const sY = (window.scrollY || window.pageYOffset || 0) - this.SCROLL_SHIFT;
    return (this.GRID.topGapCSS + this.baselineGridK() * this.GRID.spacingCSS - sY) * this.DPR;
  }
  private ppy() {
    return (this.GRID.spacingCSS * this.DPR) / this.TL.unitYears;
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

  // ======= Drawing =======
  private redraw(fadeFrom = 1, fadeTo = 0) {
    this.drawStarfield(fadeFrom, fadeTo); // includes subtle depth pulse during tween
    this.drawHuds(fadeFrom, fadeTo);
    this.drawCenterline();
    this.drawTimeline();
  }

  private drawStarfield(_fadeFrom = 1, _fadeTo = 0) {
    const star = this.starCanvas.nativeElement;
    const ctx = star.getContext('2d')!;
    if (!this.pattern) return;

    // Clear in device px, then render in CSS px
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.W, this.H);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    // Use the fixed host for all sizing — independent from document height
    const host = this.starHost?.nativeElement;
    const vw = (host?.clientWidth ?? window.innerWidth) || this.W / this.dpr;
    const vh = (host?.clientHeight ?? window.innerHeight) || this.H / this.dpr;
    const cx = vw / 2;
    const cy = vh / 2;

    // helper
    const mod = (a: number, m: number) => ((a % m) + m) % m;

    // Parallax phase (CSS px)
    let offX: number;
    let offY: number;

    if (this.starZoom.active) {
      // During zoom: frozen phase so nothing drifts
      offX = this.starZoom.lockOffX;
      offY = this.starZoom.lockOffY;
    } else {
      // After zoom (and normally): parallax + persistent base for continuity
      const sx = this.starParallaxScrollX;
      const sy = this.starParallaxScrollY;
      offX = mod(-(sx * this.parallaxX) + this.starPhaseBaseX, this.patternSize);
      offY = mod(-(sy * this.parallaxY) + this.starPhaseBaseY, this.patternSize);
    }

    // Effective density scale (precomputed in tick / start / end)
    const scale = this.starEffectiveScale || 1;

    // Pattern transform centered in the viewport — no lateral motion when scaling
    const pat = this.pattern;
    const canSet = typeof (pat as any).setTransform === 'function';

    if (canSet) {
      const m = new DOMMatrix();
      m.translateSelf(cx, cy);
      m.scaleSelf(scale, scale);
      m.translateSelf(-cx, -cy);
      m.translateSelf(offX, offY);
      (pat as any).setTransform(m);
      ctx.fillStyle = pat;
      ctx.fillRect(0, 0, vw, vh);
    } else {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);
      ctx.translate(-cx, -cy);
      ctx.translate(offX, offY);
      ctx.fillStyle = pat;
      const pad = this.patternSize * 2;
      ctx.fillRect(-pad, -pad, vw + pad * 2, vh + pad * 2);
      ctx.restore();
    }
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

    const isDayTier = Math.abs(u - 1 / 365) < 1e-7 || Math.abs(u - 1 / 366) < 1e-7;

    const nextMonthOrYearAtOrAbove = (y: number, stepYears: number) =>
      y >= 0
        ? Math.ceil(y / stepYears) * stepYears
        : -Math.floor(Math.abs(y) / stepYears) * stepYears;
    const nextDayBoundaryAtOrAbove = (y: number) => {
      const y0 = this.startOfYearInt(y);
      const diy = this.daysInYear(y0);
      let frac = y - y0;
      frac = this.clamp(frac, 0, 0.999999999);
      const idx = Math.ceil(frac * diy);
      return y0 + idx / diy;
    };

    let yTick = isDayTier
      ? nextDayBoundaryAtOrAbove(yTopYear - 1e-9)
      : nextMonthOrYearAtOrAbove(yTopYear - 1e-9, u);

    let safety = 0;
    while (yTick <= yBotYear + 1e-7 && safety++ < 4000) {
      const yPx = this.yearToY(yTick);
      ctx.fillStyle = this.GRID.color;
      ctx.fillRect(x0, Math.round(yPx - Math.floor(thick / 2)), segLen, thick);

      let label = this.formatLabelByUnit(yTick, u);
      if (isDayTier) {
        const yForTick = yTick >= 0 ? Math.floor(yTick) : Math.ceil(yTick);
        label = this.formatLabelByUnit(yTick, 1 / this.daysInYear(yForTick));
      }
      ctx.fillStyle = 'rgba(255,170,80,0.95)';
      if (label) ctx.fillText(label, x0 - labelMargin, Math.round(yPx));

      if (isDayTier) {
        const yYear = yTick >= 0 ? Math.floor(yTick) : Math.ceil(yTick);
        const step = 1 / this.daysInYear(yYear);
        yTick += step;
        const yYearNext = yTick >= 0 ? Math.floor(yTick) : Math.ceil(yTick);
        if (yYearNext !== yYear) yTick = this.startOfYearInt(yTick);
      } else {
        yTick += u;
      }
    }

    // Today marker
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

      from.ctx.clearRect(0, 0, this.W, this.H);
      to.ctx.clearRect(0, 0, this.W, this.H);

      this.drawHudLayer(from.ctx, this.W, this.H, this.ZOOM_ANIM.startUnit);
      this.drawHudLayer(to.ctx, this.W, this.H, this.ZOOM_ANIM.endUnit);

      // Programmatic, linear cross-fade (no CSS transitions)
      from.el.style.opacity = String(fadeFrom);
      to.el.style.opacity = String(fadeTo);

      // Hide all other tiers
      for (let i = 0; i < this.HUDS.length; i++) {
        if (i !== this.animFromIdx && i !== this.animToIdx) {
          this.HUDS[i].el.style.opacity = '0';
        }
      }
    } else {
      // Single, current tier
      for (let i = 0; i < this.HUDS.length; i++) {
        const h = this.HUDS[i];
        h.ctx.clearRect(0, 0, this.W, this.H);
        h.el.style.opacity = i === this.currentZoomIdx ? '1' : '0';
      }
      const cur = this.HUDS[this.currentZoomIdx];
      this.drawHudLayer(cur.ctx, this.W, this.H, this.zoomLevels[this.currentZoomIdx].unit);
    }
  }

  private formatLabelByUnit(yf: number, unit: number) {
    const isBCE = yf < 0;
    let abs = isBCE ? -yf : yf;
    let yInt = Math.floor(abs);
    let frac = abs - yInt;
    const calYear = yf >= 0 ? Math.floor(yf) : Math.ceil(yf);
    let diy = this.daysInYear(calYear);

    // Day tier
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

    // Month tier
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

    // Year/Decade/Century/Millennium
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
    const sTarget = this.scrollForYear(target);
    window.scrollTo(0, sTarget + this.SCROLL_SHIFT);
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

  // ======= Paging =======
  private recenterVirtualWindowIfNeeded() {
    if (!this.useVirtualWindow || this.ZOOM_ANIM.active) return;

    const s = window.scrollY || window.pageYOffset || 0;
    const min = this.SCROLL_MIN ?? 0;
    const max = this.SCROLL_MAX ?? 0;

    const nearTop = s <= min + this.EDGE_EPS;
    const nearBot = s >= max - this.EDGE_EPS;

    // If we’re parked at dataset edges, don’t recenter (we want a frozen feel)
    if ((nearTop && this.atDatasetStart()) || (nearBot && this.atDatasetEnd())) return;

    // Keep the same date under the centerline
    const keep = this.centerYF ?? this.yToYearDev(this.CH / 2);

    if (nearTop || nearBot) {
      this.recenterToVirtualMid(keep);
    }
  }

  private recenterToVirtualMid(keepYear: number, mid?: number) {
    const m = mid ?? ((this.SCROLL_MIN ?? 0) + (this.SCROLL_MAX ?? 0)) * 0.5;

    const sxNew = window.scrollX || window.pageXOffset || 0;

    // Keep the on-screen star phase identical after the jump
    this.rebaseStarPhaseForProgrammaticScroll(sxNew, m);

    // Prevent our own onScroll from reacting mid-jump
    this.settingScroll = true;
    window.scrollTo(0, m);
    this.settingScroll = false;

    // Re-anchor so `keepYear` remains under the centerline
    this.reanchorGridForCenter(keepYear);

    // Update parallax trackers and "last good" scroll to the new position
    this.starParallaxScrollX = sxNew;
    this.starParallaxScrollY = m;
    this.lastScrollY = m;

    this.clampScroll();
    this.redraw();
  }

  // ======= Scroll area sizing =======
  private ensureScrollRoomFromBounds() {
    const demo = document.querySelector('.demo') as HTMLElement | null;
    if (!demo) return;

    const vv = (window as any).visualViewport;
    const vh = vv?.height || window.innerHeight || this.H / this.DPR;

    if (this.useVirtualWindow) {
      // Fixed, viewport-anchored scroll zone
      const vwinPx = Math.max(this.VWIN_MULT * vh, vh);
      demo.style.minHeight = `${vwinPx}px`;

      // Virtual scroll bounds are just this fixed window
      this.SCROLL_MIN = 0;
      this.SCROLL_MAX = Math.max(0, vwinPx - vh);

      // No dataset-shift here
      this.SCROLL_SHIFT = 0;
    } else {
      // (fallback: previous dataset-based sizing)
      const needed = Math.ceil((this.SCROLL_MAX ?? 0) - (this.SCROLL_MIN ?? 0) + vh);
      demo.style.minHeight = Math.max(needed, vh) + 'px';
    }
  }

  // ======= Zoom tween & cross-fade =======
  private clampZoomIndex(idx: number) {
    if (idx < 0) idx = 0;
    else if (idx >= this.zoomLevels.length) idx = this.zoomLevels.length - 1;
    return idx;
  }
  private setZoomIndex(idx: number) {
    idx = this.clampZoomIndex(idx);
    if (idx === this.currentZoomIdx) return;

    if (this.ZOOM_ANIM.active) {
      this.TL.unitYears = this.ZOOM_ANIM.endUnit;
      this.currentZoomIdx = this.ZOOM_ANIM.targetIdx;
      this.ZOOM_ANIM.active = false;
    }

    const keepYear = this.centerYF ?? this.yToYearDev(this.CH / 2);
    this.centerYF = this.clampCenterToData(keepYear);

    const startUnit = this.zoomLevels[this.currentZoomIdx].unit;
    const endUnit = this.zoomLevels[idx].unit;

    this.animFromIdx = this.currentZoomIdx;
    this.animToIdx = idx;

    // ----- Starfield: freeze parallax phase and set density tween -----
    {
      const sx = window.scrollX || window.pageXOffset || 0;
      const sy = window.scrollY || window.pageYOffset || 0;
      const mod = (a: number, m: number) => ((a % m) + m) % m;

      this.starZoom.active = true;
      this.starZoom.from = this.starBaseScaleByLevel[this.currentZoomIdx];
      this.starZoom.to = this.starBaseScaleByLevel[idx];

      // record scroll at start (optional)
      this.starZoom.startSx = sx;
      this.starZoom.startSy = sy;

      // Freeze to the *current rendered* phase (includes persistent base)
      const currentOffX = mod(-(sx * this.parallaxX) + this.starPhaseBaseX, this.patternSize);
      const currentOffY = mod(-(sy * this.parallaxY) + this.starPhaseBaseY, this.patternSize);

      this.starZoom.lockOffX = currentOffX;
      this.starZoom.lockOffY = currentOffY;

      this.starEffectiveScale = this.starZoom.from;
    }

    // --- PREVENT FLASH: use inline opacity only during the tween
    this.animFromIdx = this.currentZoomIdx;
    this.animToIdx = idx;

    // Remove class-driven opacity (it has !important)
    for (let i = 0; i < this.HUDS.length; i++) {
      const el = this.HUDS[i].el;
      el.classList.add('no-anim');
      el.classList.remove('hud-visible', 'hud-hidden');
      // Set initial inline opacity for the cross-fade
      el.style.opacity = i === this.animFromIdx ? '1' : '0';
    }

    this.ZOOM_ANIM = {
      active: true,
      t0: performance && performance.now ? performance.now() : Date.now(),
      dur: 2500,
      startUnit,
      endUnit,
      keepYear,
      targetIdx: idx,
    };

    // draw exact first frame (from=1, to=0) BEFORE rAF
    this.redraw(1, 0);
    requestAnimationFrame(this.zoomTick);
  }

  private easeInOutCubic(t: number) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
  private lerp(a: number, b: number, t: number) {
    return a + (b - a) * t;
  }

  private zoomTick = () => {
    if (!this.ZOOM_ANIM.active) return;

    const now = performance && performance.now ? performance.now() : Date.now();
    let t = (now - this.ZOOM_ANIM.t0) / this.ZOOM_ANIM.dur;
    if (t < 0) t = 0;
    if (t > 1) t = 1;

    // Easing & fades
    const moveP = this.easeInOutCubic(t);
    const fadeFrom = 1 - t;
    const fadeTo = t;

    // Interpolate HUD/timeline scale
    this.TL.unitYears = this.lerp(this.ZOOM_ANIM.startUnit, this.ZOOM_ANIM.endUnit, moveP);

    // Keep the same date under the centerline
    const ky = this.ZOOM_ANIM.keepYear!;
    this.centerYF = this.clampCenterToData(ky);
    this.reanchorGridForCenter(ky);
    this.updateScrollBounds();
    this.ensureScrollRoomFromBounds();

    // During tween:
    // - Classic: keep the screen centered on ky by scrolling each frame
    // - Virtual: do NOT scroll here; we'll re-center once at the end
    if (!this.useVirtualWindow) {
      const yTarget = this.scrollForYear(ky) + this.SCROLL_SHIFT;
      window.scrollTo(0, yTarget);
      this.clampScroll();
    }

    // Star density tween (pattern scale) — phase is frozen via starZoom.lockOff*
    this.starEffectiveScale = this.lerp(this.starZoom.from, this.starZoom.to, moveP);

    // Draw two tiers with cross-fade + stars
    this.redraw(fadeFrom, fadeTo);

    if (t < 1) {
      requestAnimationFrame(this.zoomTick);
      return;
    }

    // ===== Finish =====
    this.TL.unitYears = this.ZOOM_ANIM.endUnit;
    this.currentZoomIdx = this.ZOOM_ANIM.targetIdx;
    this.ZOOM_ANIM.active = false;

    // Re-lock anchors & bounds at the final scale
    this.reanchorGridForCenter(ky);
    this.updateScrollBounds();
    this.ensureScrollRoomFromBounds();

    if (this.useVirtualWindow) {
      // IMPORTANT: recenter to virtual mid WHILE starZoom.active is still true
      // so rebase uses the frozen lockOff phase.
      this.recenterToVirtualMid(ky); // handles scrollTo(mid), reanchor, star phase rebase, redraw
    } else {
      // Classic mode: scroll to the exact position for ky
      const yTarget = this.scrollForYear(ky) + this.SCROLL_SHIFT;
      window.scrollTo(0, yTarget);
      this.clampScroll();

      // Keep parallax tracker consistent with the programmatic scroll
      this.starParallaxScrollX = window.scrollX || window.pageXOffset || 0;
      this.starParallaxScrollY = yTarget;
    }

    // Starfield: end tween, lock to target level density
    // (Do this AFTER any recenter so we can compute phase for the final scroll.)
    this.starZoom.active = false;
    this.starEffectiveScale = this.starBaseScaleByLevel[this.currentZoomIdx];

    // Match phase so there is no jump when we leave the frozen phase
    {
      const sx = window.scrollX || window.pageXOffset || 0;
      const sy = window.scrollY || window.pageYOffset || 0;
      const mod = (a: number, m: number) => ((a % m) + m) % m;

      this.starPhaseBaseX = mod(this.starZoom.lockOffX + sx * this.parallaxX, this.patternSize);
      this.starPhaseBaseY = mod(this.starZoom.lockOffY + sy * this.parallaxY, this.patternSize);
    }

    // Final single-tier draw (virtual branch already drew during recenter; harmless to draw again)
    this.redraw();

    // Restore class-driven opacity and remove inline styles for ALL tiers
    for (let i = 0; i < this.HUDS.length; i++) {
      const el = this.HUDS[i].el;
      el.classList.remove('no-anim');
      el.style.opacity = '';
      if (i === this.currentZoomIdx) el.classList.add('hud-visible');
      else el.classList.add('hud-hidden');
    }
  };
}
