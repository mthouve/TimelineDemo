import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  HostListener,
  Renderer2,
  NgZone,
} from '@angular/core';
import { TimelineDateService, ZoomSpec } from './services/timeline-date.service';
import { TimelineEntryService } from './services/timeline-entry.service';
import { TimelineHudService } from './services/timeline-hud.service';
import { TimelineRendererService } from './services/timeline-renderer.service';
import { TimelineZoomService, ZoomAnimationState } from './services/timeline-zoom.service';
import { SpaceSceneComponent } from './components/space-scene/space-scene.component';
import { ZoomControlComponent } from './zoom-control/zoom-control.component';
import { SettingsControlComponent } from './settings-control/settings-control.component';
import { BibleViewerComponent } from './bible-viewer/bible-viewer.component';
import { CommonModule } from '@angular/common';
import { TimelineEntry } from './models/timeline-entry.model';

@Component({
  selector: 'app-root',
  standalone: true,
  templateUrl: './app.html',
  styleUrl: './app.scss',
  imports: [
    ZoomControlComponent,
    SettingsControlComponent,
    BibleViewerComponent,
    SpaceSceneComponent,
    CommonModule,
  ],
})
export class App implements AfterViewInit, OnDestroy {
  constructor(
    private dateService: TimelineDateService,
    private timelineEntryService: TimelineEntryService,
    private hudService: TimelineHudService,
    private timelineRenderer: TimelineRendererService,
    private zoomService: TimelineZoomService,
    private r2: Renderer2,
    private ngZone: NgZone,
  ) {
    // Ensure a sensible base page title for tests and initial load
    if (!document.title || document.title.trim() === '') {
      document.title = 'Timeline Demo';
    }
    this.zoomLevels = this.dateService.getZoomLevels();
    this.zoomLabels = this.dateService.getZoomLabels();
  }

  // ── Bible supplemental data ─────────────────────────────────────────────────
  bibleSupplementalEntries: TimelineEntry[] = [];
  @ViewChild(BibleViewerComponent) bibleViewer?: BibleViewerComponent;

  private updateTimelineTarget() {
    const allEntries = this.getEntries();
    if (!allEntries.length || !this.CH || !this.GRID.spacingCSS || !this.TL.unitYears) {
      return;
    }

    const centerYF = this.centerYF ?? this.yToYearDev(this.CH / 2);

    // One HUD spacing represents this.TL.unitYears. The globe target follows
    // nearby data points without driving a floating info box during animation.
    const visibleRange = this.TL.unitYears;

    const entries = this.getEntriesNearYear(centerYF, visibleRange);
    let closestPrimaryWithLocation: (typeof entries)[0] | null = null;
    let closestDistance = Infinity;

    for (const e of entries) {
      const dy = Math.abs(e.yf - centerYF);
      if (dy <= visibleRange) {
        // Track closest visible entry with location for Earth rotation
        if (e.location && dy < closestDistance) {
          closestPrimaryWithLocation = e;
          closestDistance = dy;
        }
      }
    }

    // Rotate Earth to show location if we have a primary entry with coordinates
    if (closestPrimaryWithLocation?.location) {
      if (this.spaceScene) {
        const targetKey = this.spaceSceneEntryKey(closestPrimaryWithLocation);

        if (targetKey !== this.activeSpaceSceneEntryKey) {
          const elapsedYears =
            this.activeSpaceSceneEntryYear == null
              ? 0
              : closestPrimaryWithLocation.yf - this.activeSpaceSceneEntryYear;
          const durationMs = this.spaceSceneTransitionDurationMs(elapsedYears);

          this.activeSpaceSceneEntryKey = targetKey;
          this.activeSpaceSceneEntryYear = closestPrimaryWithLocation.yf;
          this.spaceScene.rotateTo(
            closestPrimaryWithLocation.location.lon,
            closestPrimaryWithLocation.location.lat,
            durationMs,
            this.timeProgressionMultiplier ? elapsedYears : 0,
            closestPrimaryWithLocation.yf,
            closestPrimaryWithLocation.localTimeHours,
          );
        }
      }

      // Calculate marker opacity based on distance within the one-line visibility range.
      const fadeRange = visibleRange;
      const opacity = fadeRange > 0 ? 1.0 - Math.min(closestDistance / fadeRange, 1.0) : 0;
      if (this.spaceScene) {
        this.spaceScene.setMarkerOpacity(opacity);
      }
    } else {
      // No location in view, hide marker
      if (this.spaceScene) {
        this.spaceScene.setMarkerOpacity(0);
      }
    }
  }

  private spaceSceneEntryKey(entry: TimelineEntry): string {
    return `${entry.label}|${entry.location?.lat ?? ''}|${entry.location?.lon ?? ''}`;
  }

  private spaceSceneTransitionDurationMs(elapsedYears: number): number {
    const spanYears = Math.abs(elapsedYears);
    if (!spanYears) return this.SPACE_SCENE_MIN_TRANSITION_MS;

    const speedAdjustedDuration = this.clamp(
      this.SPACE_SCENE_MIN_TRANSITION_MS + Math.log1p(spanYears) * 1200,
      this.SPACE_SCENE_MIN_TRANSITION_MS,
      this.SPACE_SCENE_MAX_TRANSITION_MS,
    );
    return this.timeProgressionMultiplier
      ? speedAdjustedDuration / this.timeProgressionMultiplier
      : this.SPACE_SCENE_MIN_TRANSITION_MS;
  }

  private scheduleTimelineTargetUpdate() {
    if (this.timelineTargetRafId !== null) return;
    this.timelineTargetRafId = requestAnimationFrame(() => {
      this.timelineTargetRafId = null;
      this.updateTimelineTarget();
    });
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
  @ViewChild(SpaceSceneComponent, { static: false }) spaceScene!: SpaceSceneComponent;
  @ViewChild('centerline', { static: true }) centerline!: ElementRef<HTMLCanvasElement>;
  @ViewChild('timeline', { static: true }) timeline!: ElementRef<HTMLCanvasElement>;
  @ViewChild(ZoomControlComponent) zoomUi?: ZoomControlComponent;

  // ── Zoom tiers ────────────────────────────────────────────────────────────────
  zoomLevels: ZoomSpec[] = [];
  zoomLabels: string[] = [];
  currentZoomIdx = 3; // Year
  timeProgressionOptions = [
    { label: 'Off', multiplier: 0 },
    { label: '0.5x', multiplier: 0.5 },
    { label: '1x', multiplier: 1 },
    { label: '2x', multiplier: 2 },
    { label: '4x', multiplier: 4 },
  ];
  timeProgressionMultiplier = 0;

  // Timing targets
  private readonly DUR_SINGLE_STEP_MS = 4000; // ~4s for 1-step jumps
  private readonly DUR_ACROSS_ALL_MS = 10000; // ~10s for full-range jumps

  private animFromIdx = this.currentZoomIdx;
  private animToIdx = this.currentZoomIdx;

  private centerYF: number | null = null;
  private pendingZoomIdx: number | null = null;

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
  private timelineTargetRafId: number | null = null;
  private activeSpaceSceneEntryKey: string | null = null;
  private activeSpaceSceneEntryYear: number | null = null;
  private timeProgressionRafId: number | null = null;
  private lastTimeProgressionMs: number | null = null;
  private lastProgressionTimelineDrawYf: number | null = null;
  private lastProgressionTimelineDrawMs = 0;
  private readonly TIME_PROGRESSION_DAY_SECONDS = 15;
  private readonly PROGRESSION_TIMELINE_MIN_DRAW_PX = 24;
  private readonly PROGRESSION_TIMELINE_MIN_DRAW_INTERVAL_MS = 180;
  private readonly SPACE_SCENE_MIN_TRANSITION_MS = 2200;
  private readonly SPACE_SCENE_MAX_TRANSITION_MS = 9000;

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
  private _ZOOM_ANIM: ZoomAnimationState = {
    active: false,
    t0: 0,
    dur: 2500,
    startUnit: 1,
    endUnit: 1,
    keepYear: null,
    targetIdx: this.currentZoomIdx,
  };
  get ZOOM_ANIM(): ZoomAnimationState {
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

    // Space scene component handles its own initialization
    this.updateSpaceSceneTimeSpeed();

    this.sizeAll();

    this.TL.unitYears = this.zoomLevels[this.currentZoomIdx].unit;
    const entries = this.getEntries();
    this.bibleSupplementalEntries = entries.filter((entry) =>
      entry.sources?.some((source) => source.type === 'bible' && source.reference)
    );
    if (entries.length) this.TL.baseYear = entries[0].yf;

    this.anchorGrid();
    this.updateScrollBounds();
    this.ensureScrollRoomFromBounds();
    this.centerFirstPoint();
    this.updateScrollBounds();
    this.ensureScrollRoomFromBounds();
    this.clampScroll();
    this.updateSpaceSceneTimeSpeed(true);

    this.lastScrollY = window.scrollY || window.pageYOffset || 0;

    // show active tier
    for (const h of this.HUDS) {
      h.el.classList.add('hud-hidden', 'no-anim');
      h.el.classList.remove('hud-visible');
    }
    this.redraw();
    this.scheduleTimelineTargetUpdate();
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
    // Space scene component handles its own cleanup
    if (this.earthResizeObserver) {
      this.earthResizeObserver.disconnect();
      this.earthResizeObserver = null;
    }
    if (this.earthResizeTimer) clearTimeout(this.earthResizeTimer);
    if (this.timelineTargetRafId !== null) cancelAnimationFrame(this.timelineTargetRafId);
    this.stopTimelineTimeProgression();
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

  onTimeProgressionChange(event: Event) {
    const select = event.target as HTMLSelectElement | null;
    const nextMultiplier = Number(select?.value ?? 1);
    this.timeProgressionMultiplier = Number.isFinite(nextMultiplier) ? nextMultiplier : 1;
    this.updateSpaceSceneTimeSpeed(false);
    if (this.timeProgressionMultiplier) {
      this.startTimelineTimeProgression();
    } else {
      this.stopTimelineTimeProgression();
    }
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

      // Space scene component handles its own resize via ResizeObserver

      this.applySize(this.viewportW(), this.viewportH());
      this.reanchorGridForCenter(keepYear);
      this.updateScrollBounds();
      this.ensureScrollRoomFromBounds();

      if (this.useVirtualWindow) {
        const mid = ((this.SCROLL_MIN ?? 0) + (this.SCROLL_MAX ?? 0)) * 0.5;
        window.scrollTo(0, mid);
        this.reanchorGridForCenter(keepYear);
        this.lastScrollY = mid;
      } else {
        const y = this.scrollForYear(keepYear) + this.SCROLL_SHIFT;
        window.scrollTo(0, y);
        this.lastScrollY = y;
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
      const target = pushingPastTop ? (this.SCROLL_MIN ?? s) : (this.SCROLL_MAX ?? s);

      this.settingScroll = true;
      window.scrollTo(0, target);
      this.settingScroll = false;

      this.reanchorGridForCenter(keep);
      this.lastScrollY = target;

      this.redraw();
      return;
    }

    this.centerYF = kyClamped;
    this.reanchorGridForCenter(kyClamped);

    if (!(pushingPastTop && s < this.lastScrollY) && !(pushingPastBottom && s > this.lastScrollY)) {
      this.lastScrollY = s;
    }

    this.redraw();
    this.scheduleTimelineTargetUpdate();
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
    const vv = (window as any).visualViewport;
    const width = vv?.width || window.innerWidth;
    return Math.max(1, width - this.timelineRailLeftCSS(width));
  }
  private viewportH() {
    const vv = (window as any).visualViewport;
    if (vv?.height) return vv.height;
    return window.innerHeight;
  }

  private timelineRailLeftCSS(viewportWidth: number = window.innerWidth) {
    return viewportWidth <= 900 ? 0 : Math.max(0, viewportWidth - 320);
  }
  private sizeAll() {
    this.applySize(this.viewportW(), this.viewportH());
  }
  private applySize(cssW: number, cssH: number) {
    this.DPR = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    const Wn = Math.floor(cssW * this.DPR),
      Hn = Math.floor(cssH * this.DPR);
    this.W = Wn;
    this.H = Hn;

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

  private getEntries(): TimelineEntry[] {
    return this.timelineEntryService.getEntries();
  }

  private lowerBoundByDrawYf(target: number): number {
    return this.timelineEntryService.lowerBoundByDrawYf(target);
  }

  private getEntriesNearYear(centerYf: number, radiusYears: number): TimelineEntry[] {
    return this.timelineEntryService.getEntriesNearYear(centerYf, radiusYears);
  }

  private nowYearFraction() {
    return this.dateService.nowYearFraction();
  }

  updateSpaceSceneTimeSpeed(anchorToTimeline = false) {
    if (!this.spaceScene) return;
    if (anchorToTimeline) {
      const centeredYear = this.currentTimelineYearFraction();
      if (centeredYear != null) {
        this.spaceScene.setCelestialYearFraction(centeredYear);
      }
    }
    this.spaceScene.setEarthRotationsPerSecond(0);
    this.spaceScene.setCloudDriftMultiplier(this.timeProgressionMultiplier);
  }

  private currentTimelineYearFraction(): number | null {
    if (this.centerYF != null && Number.isFinite(this.centerYF)) return this.centerYF;
    if (!this.CH || !this.TL.unitYears || !this.GRID.spacingCSS) return null;
    return this.yToYearDev(this.CH / 2);
  }

  private startTimelineTimeProgression() {
    if (this.timeProgressionRafId !== null) return;
    this.lastTimeProgressionMs = performance.now();
    this.lastProgressionTimelineDrawYf = this.currentTimelineYearFraction();
    this.lastProgressionTimelineDrawMs = 0;
    this.ngZone.runOutsideAngular(() => {
      this.timeProgressionRafId = requestAnimationFrame(this.timelineTimeProgressionTick);
    });
  }

  private stopTimelineTimeProgression() {
    if (this.timeProgressionRafId !== null) {
      cancelAnimationFrame(this.timeProgressionRafId);
      this.timeProgressionRafId = null;
    }
    this.lastTimeProgressionMs = null;
    this.lastProgressionTimelineDrawYf = null;
    this.lastProgressionTimelineDrawMs = 0;
    this.clearProgressionCanvasTransform();
  }

  private timelineTimeProgressionTick = (now: number) => {
    this.timeProgressionRafId = null;
    const previous = this.lastTimeProgressionMs ?? now;
    this.lastTimeProgressionMs = now;

    if (!this.timeProgressionMultiplier) return;

    if (!this._ZOOM_ANIM.active && !this._scrollLocked) {
      const dtSeconds = Math.min((now - previous) / 1000, 0.1);
      const yearsPerSecond =
        this.timeProgressionMultiplier /
        (this.TIME_PROGRESSION_DAY_SECONDS * this.dateService.meanYear);
      const currentYear = this.currentTimelineYearFraction();

      if (currentYear != null) {
        const targetYear = this.clampCenterToData(currentYear + yearsPerSecond * dtSeconds);
        this.centerYF = targetYear;
        this.spaceScene?.setCelestialYearFraction(targetYear);
        this.applyProgressionCanvasTransform(targetYear);

        if (this.shouldRedrawTimelineForProgression(targetYear, now)) {
          this.lastProgressionTimelineDrawYf = targetYear;
          this.lastProgressionTimelineDrawMs = now;
          this.reanchorGridForCenter(targetYear);
          this.redraw();
        }
      }
    }

    this.timeProgressionRafId = requestAnimationFrame(this.timelineTimeProgressionTick);
  };

  private shouldRedrawTimelineForProgression(targetYear: number, now: number): boolean {
    if (this.lastProgressionTimelineDrawYf == null) return true;
    if (!this.GRID.spacingCSS || !this.TL.unitYears || !this.DPR) return true;
    if (
      this.lastProgressionTimelineDrawMs &&
      now - this.lastProgressionTimelineDrawMs < this.PROGRESSION_TIMELINE_MIN_DRAW_INTERVAL_MS
    ) {
      return false;
    }

    const yearsSinceLastDraw = Math.abs(targetYear - this.lastProgressionTimelineDrawYf);
    const cssPixelsSinceLastDraw =
      (yearsSinceLastDraw * this.GRID.spacingCSS) / this.TL.unitYears;
    return cssPixelsSinceLastDraw >= this.PROGRESSION_TIMELINE_MIN_DRAW_PX;
  }

  private applyProgressionCanvasTransform(targetYear: number): void {
    if (this.lastProgressionTimelineDrawYf == null || !this.GRID.spacingCSS || !this.TL.unitYears) {
      return;
    }

    const offsetCss =
      ((this.lastProgressionTimelineDrawYf - targetYear) * this.GRID.spacingCSS) /
      this.TL.unitYears;
    const transform = `translate3d(0, ${offsetCss}px, 0)`;

    this.timeline.nativeElement.style.transform = transform;
    for (const hud of this.HUDS) {
      hud.el.style.transform = transform;
    }
  }

  private clearProgressionCanvasTransform(): void {
    this.timeline.nativeElement.style.transform = '';
    for (const hud of this.HUDS) {
      hud.el.style.transform = '';
    }
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
    this.clearProgressionCanvasTransform();
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
    zoomIdx?: number,
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
      formatLabelByZoomLevel: this.formatLabelByZoomLevel.bind(this),
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
      this.currentZoomIdx,
    );
  }

  private formatLabelByUnit(yf: number, unit: number) {
    return this.dateService.formatLabelByUnit(yf, unit);
  }

  private formatLabelByZoomLevel(yf: number, zoomLevelName: string) {
    return this.dateService.formatLabelByZoomLevel(yf, zoomLevelName);
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
      formatLabelByZoomLevel: this.formatLabelByZoomLevel.bind(this),
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
    this.timelineRenderer.drawTimeline({
      canvas: this.timeline.nativeElement,
      canvasWidth: this.TW,
      canvasHeight: this.TH,
      dpr: this.DPR,
      entries: this.getEntries(),
      nowYearFraction: this.nowYearFraction(),
      style: this.TL,
      zoomLevelName: this.zoomLevels[this.currentZoomIdx]?.name ?? 'Year',
      formatLabelByZoomLevel: this.formatLabelByZoomLevel.bind(this),
      yearToY: this.yearToY.bind(this),
      yToYearDev: this.yToYearDev.bind(this),
      lowerBoundByDrawYf: this.lowerBoundByDrawYf.bind(this),
    });
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

    this.settingScroll = true;
    window.scrollTo(0, target);
    this.settingScroll = false;

    this.reanchorGridForCenter(keepYear);
    this.lastScrollY = target;

    this.clampScroll();
    this.redraw();
  }

  private recenterToVirtualMid(keepYear: number, mid?: number) {
    const m = mid ?? ((this.SCROLL_MIN ?? 0) + (this.SCROLL_MAX ?? 0)) * 0.5;

    this.settingScroll = true;
    window.scrollTo(0, m);
    this.settingScroll = false;

    this.reanchorGridForCenter(keepYear);
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
    const scrollbounds = document.querySelector('.scrollbounds') as HTMLElement | null;
    if (!scrollbounds) return;
    const vv = (window as any).visualViewport;
    const vh = vv?.height || window.innerHeight || this.H / this.DPR;

    if (this.useVirtualWindow) {
      const vwinPx = Math.max(this.VWIN_MULT * vh, vh);
      scrollbounds.style.minHeight = `${vwinPx}px`;
      this.SCROLL_MIN = 0;
      this.SCROLL_MAX = Math.max(0, vwinPx - vh);
      this.SCROLL_SHIFT = 0;
    } else {
      const needed = Math.ceil((this.SCROLL_MAX ?? 0) - (this.SCROLL_MIN ?? 0) + vh);
      scrollbounds.style.minHeight = Math.max(needed, vh) + 'px';
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
    const dir = endIdx > startIdx ? 1 : -1;

    // 1) LOCK SCROLL during the whole animation
    this.lockScrollingHard();

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

    // Live caption during transition
    this._zoomStepLabel = this.zoomLevels[startIdx].name;

    // Set document.title hint
    const oldTitle = document.title;
    document.title = `${this._zoomStepLabel} — ${oldTitle.replace(/^(.*?)( — )?/, '')}`;

    this._ZOOM_ANIM = this.zoomService.createAnimation({
      startIdx,
      endIdx,
      keepYear,
      zoomLevels: this.zoomLevels,
      durationSingleStepMs: this.DUR_SINGLE_STEP_MS,
      durationAcrossAllMs: this.DUR_ACROSS_ALL_MS,
      nowMs: performance && performance.now ? performance.now() : Date.now(),
    });

    this.animFromIdx = fromIdxSeed;
    this.animToIdx = toIdxSeed;

    // First frame
    this.TL.unitYears = this._ZOOM_ANIM.startUnit;
    this._zoomVisualIndex = startIdx;
    this.redraw(1, 0);

    requestAnimationFrame(this.zoomTick);
  }

  private zoomTick = () => {
    if (!this._ZOOM_ANIM.active) return;

    const now = performance && performance.now ? performance.now() : Date.now();
    const frame = this.zoomService.getFrame(this._ZOOM_ANIM, now);

    // Apply mapping
    this.TL.unitYears = frame.unitYears;

    // Center anchoring
    const ky = this._ZOOM_ANIM.keepYear!;
    this.centerYF = this.clampCenterToData(ky);
    this.reanchorGridForCenter(ky);

    // Active HUD pair & fade
    if (frame.fromIdx !== this.animFromIdx || frame.toIdx !== this.animToIdx) {
      this._ZOOM_ANIM.hudFromIdx = frame.fromIdx;
      this._ZOOM_ANIM.hudToIdx = frame.toIdx;
      this._ZOOM_ANIM.hudStartUnit = this.zoomLevels[frame.fromIdx].unit;
      this._ZOOM_ANIM.hudEndUnit = this.zoomLevels[frame.toIdx].unit;
      this.animFromIdx = frame.fromIdx;
      this.animToIdx = frame.toIdx;
      this.HUDS[this.animFromIdx].el.style.opacity = '1';
      this.HUDS[this.animToIdx].el.style.opacity = '0';
    }

    this._zoomVisualIndex = frame.visualIndex;
    // (Keep the thumb parked: no need to call setSliderVisualIndex here)

    this._zoomStepLabel = this.zoomLevels[frame.liveIdx].name;

    // Draw frame
    this.redraw(frame.fadeFrom, frame.fadeTo);

    // Keep bounds aligned while mapping changes
    this.updateScrollBounds();
    this.ensureScrollRoomFromBounds();

    if (!frame.done) {
      requestAnimationFrame(this.zoomTick);
      return;
    }

    // ── Finish ──
    this.TL.unitYears = this._ZOOM_ANIM.endUnit;
    this.currentZoomIdx = this._ZOOM_ANIM.targetIdx;
    this.updateSpaceSceneTimeSpeed(false);

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
      this.lastScrollY = yTarget;
    }

    // Unlock scroll AFTER the final frame
    this.unlockScrollingHard();

    this.redraw();
    this.scheduleTimelineTargetUpdate();

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
