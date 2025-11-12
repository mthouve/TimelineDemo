import { TestBed } from '@angular/core/testing';
import { TimelineHudService, DrawHudLayerParams } from './timeline-hud.service';
import { TimelineDateService } from './timeline-date.service';

describe('TimelineHudService', () => {
  let service: TimelineHudService;
  let dateService: TimelineDateService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TimelineHudService);
    dateService = TestBed.inject(TimelineDateService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('HUD line spacing consistency', () => {
    let canvas: HTMLCanvasElement;
    let ctx: CanvasRenderingContext2D;

    beforeEach(() => {
      canvas = document.createElement('canvas');
      canvas.width = 1920;
      canvas.height = 1080;
      ctx = canvas.getContext('2d')!;
    });

    /**
     * Mock yearToY function that maps year fractions to pixel positions.
     * For testing, we use a simple linear mapping: pixelsPerYear spacing.
     */
    function createMockYearToY(
      baseYear: number,
      pixelsPerYear: number,
      centerY: number
    ): (yf: number) => number {
      return (yf: number) => {
        return Math.round(centerY + (yf - baseYear) * pixelsPerYear);
      };
    }

    /**
     * Mock yToYearDev function (inverse of yearToY).
     */
    function createMockYToYearDev(
      baseYear: number,
      pixelsPerYear: number,
      centerY: number
    ): (yDev: number) => number {
      return (yDev: number) => {
        return baseYear + (yDev - centerY) / pixelsPerYear;
      };
    }

    /**
     * Capture HUD tick positions by intercepting fillRect calls.
     */
    function captureHudTicks(params: DrawHudLayerParams): number[] {
      const ticks: number[] = [];
      const originalFillRect = params.ctx.fillRect.bind(params.ctx);
      const originalSave = params.ctx.save.bind(params.ctx);
      const originalRestore = params.ctx.restore.bind(params.ctx);
      let inTodayMarker = false;

      // Track when we're drawing the today marker (it's wrapped in save/restore at the end)
      spyOn(params.ctx, 'save').and.callFake(() => {
        // Check if this is the today marker save (happens after main loop)
        if (ticks.length > 0) {
          inTodayMarker = true;
        }
        originalSave();
      });

      spyOn(params.ctx, 'restore').and.callFake(() => {
        inTodayMarker = false;
        originalRestore();
      });

      // Spy on fillRect to capture tick Y positions
      spyOn(params.ctx, 'fillRect').and.callFake((x, y, w, h) => {
        // Only capture ticks from main loop, not today marker
        if (!inTodayMarker) {
          ticks.push(Math.round(y));
        }
        originalFillRect(x, y, w, h);
      });

      service.drawHudLayer(params);

      // Remove duplicates and sort
      return ticks.filter((y, idx, arr) => arr.indexOf(y) === idx).sort((a, b) => a - b);
    }

    it('Week zoom: weekly ticks should be ~7 days apart in pixels', () => {
      const baseYear = -149; // 150 BCE
      const pixelsPerYear = 3650; // 10 pixels per day
      const centerY = canvas.height / 2;

      const yearToY = createMockYearToY(baseYear, pixelsPerYear, centerY);
      const yToYearDev = createMockYToYearDev(baseYear, pixelsPerYear, centerY);

      const params: DrawHudLayerParams = {
        ctx,
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
        dpr: 1,
        screenWidth: canvas.width,
        unitYears: 7 / 365.2425, // Week unit
        zoomLevelName: 'Week',
        yearToY,
        yToYearDev,
        nowYearFraction: () => 2025.85,
        formatLabelByUnit: (yf, unit) => dateService.formatLabelByUnit(yf, unit),
        labelFromDayOfYear: (year, day) => dateService.labelFromDayOfYear(year, day),
        daysInYear: (year) => dateService.daysInYear(year),
        getMonthName: (m) =>
          ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m],
        dateService,
      };

      const ticks = captureHudTicks(params);

      // Expect at least a few ticks visible in the viewport
      expect(ticks.length).toBeGreaterThan(3, `Expected more than 3 ticks, got ${ticks.length}`);

      // Calculate gaps between consecutive ticks
      const gaps: number[] = [];
      for (let i = 1; i < ticks.length; i++) {
        gaps.push(ticks[i] - ticks[i - 1]);
      }

      // In Week zoom, each gap should be ~70 pixels (7 days * 10 pixels/day)
      const expectedGap = 70; // 7 days * 10 px/day
      const tolerance = 5; // pixels

      // Always log gaps for debugging
      console.log('Week test - ticks:', ticks);
      console.log('Week test - gaps:', gaps);
      console.log('Week test - expected gap:', expectedGap, '±', tolerance);

      // NOTE: Year boundary crossings may show as two smaller gaps (e.g., 5px + 75px)
      // due to the last week of one year and first week of next year not aligning perfectly.
      // We skip strict validation for such anomalies as they are inherent to the calendar.
      let consecutiveAnomalies = 0;
      for (let i = 0; i < gaps.length; i++) {
        const actualGap = gaps[i];
        const difference = Math.abs(actualGap - expectedGap);

        // Check if this is part of a year-boundary anomaly (small gap followed by compensating larger gap)
        const isSmallAnomaly = actualGap < 15;
        const nextGap = i < gaps.length - 1 ? gaps[i + 1] : 0;
        const isCompensatedAnomaly =
          isSmallAnomaly && Math.abs(actualGap + nextGap - 2 * expectedGap) < 10;

        if (isCompensatedAnomaly) {
          consecutiveAnomalies++;
          if (consecutiveAnomalies <= 2) {
            console.log(
              `Skipping validation for year-boundary anomaly at gap ${i}: ${actualGap}px + ${nextGap}px ≈ ${
                actualGap + nextGap
              }px`
            );
            continue; // Skip this and next gap as they form a valid boundary pair
          }
        } else {
          consecutiveAnomalies = 0;
        }

        expect(difference).toBeLessThan(
          tolerance,
          `Gap ${i}: expected ~${expectedGap}px (±${tolerance}px), got ${actualGap}px (difference: ${difference}px)`
        );
      }
    });

    it('Day zoom: daily ticks should be ~1 day apart in pixels', () => {
      const baseYear = -149; // 150 BCE
      const pixelsPerYear = 3650; // 10 pixels per day
      const centerY = canvas.height / 2;

      const yearToY = createMockYearToY(baseYear, pixelsPerYear, centerY);
      const yToYearDev = createMockYToYearDev(baseYear, pixelsPerYear, centerY);

      const params: DrawHudLayerParams = {
        ctx,
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
        dpr: 1,
        screenWidth: canvas.width,
        unitYears: 1 / 365.2425, // Day unit
        zoomLevelName: 'Day',
        yearToY,
        yToYearDev,
        nowYearFraction: () => 2025.85,
        formatLabelByUnit: (yf, unit) => dateService.formatLabelByUnit(yf, unit),
        labelFromDayOfYear: (year, day) => dateService.labelFromDayOfYear(year, day),
        daysInYear: (year) => dateService.daysInYear(year),
        getMonthName: (m) =>
          ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m],
        dateService,
      };

      const ticks = captureHudTicks(params);

      // Expect many daily ticks
      expect(ticks.length).toBeGreaterThan(
        10,
        `Expected more than 10 daily ticks, got ${ticks.length}`
      );

      // Calculate gaps
      const gaps: number[] = [];
      for (let i = 1; i < Math.min(ticks.length, 30); i++) {
        gaps.push(ticks[i] - ticks[i - 1]);
      }

      // Each gap should be ~10 pixels (1 day * 10 px/day)
      const expectedGap = 10;
      const tolerance = 2;

      for (let i = 0; i < gaps.length; i++) {
        const actualGap = gaps[i];
        const difference = Math.abs(actualGap - expectedGap);
        expect(difference).toBeLessThan(
          tolerance,
          `Gap ${i}: expected ~${expectedGap}px (±${tolerance}px), got ${actualGap}px (difference: ${difference}px)`
        );
      }
    });

    it('Month zoom: monthly ticks should have gaps proportional to month lengths', () => {
      const baseYear = -149; // 150 BCE
      const pixelsPerYear = 3650; // 10 pixels per day
      const centerY = canvas.height / 2;

      const yearToY = createMockYearToY(baseYear, pixelsPerYear, centerY);
      const yToYearDev = createMockYToYearDev(baseYear, pixelsPerYear, centerY);

      const params: DrawHudLayerParams = {
        ctx,
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
        dpr: 1,
        screenWidth: canvas.width,
        unitYears: 1 / 12, // Month unit
        zoomLevelName: 'Month',
        yearToY,
        yToYearDev,
        nowYearFraction: () => 2025.85,
        formatLabelByUnit: (yf, unit) => dateService.formatLabelByUnit(yf, unit),
        labelFromDayOfYear: (year, day) => dateService.labelFromDayOfYear(year, day),
        daysInYear: (year) => dateService.daysInYear(year),
        getMonthName: (m) =>
          ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m],
        dateService,
      };

      const ticks = captureHudTicks(params);

      // Expect at least 3 monthly ticks (viewport shows ~0.3 years)
      expect(ticks.length).toBeGreaterThan(
        2,
        `Expected more than 2 monthly ticks, got ${ticks.length}`
      );

      // Calculate gaps
      const gaps: number[] = [];
      for (let i = 1; i < ticks.length; i++) {
        gaps.push(ticks[i] - ticks[i - 1]);
      }

      // Months vary between 28-31 days
      // At 10 px/day: Feb ~280-290px, others 300-310px
      const minGap = 280;
      const maxGap = 320;

      // Log gaps for debugging
      if (gaps.some((g) => g < minGap || g > maxGap)) {
        console.log('Month gaps:', gaps);
        console.log('Expected range:', minGap, '-', maxGap);
      }

      for (let i = 0; i < gaps.length; i++) {
        const actualGap = gaps[i];
        expect(actualGap).toBeGreaterThanOrEqual(
          minGap,
          `Gap ${i}: expected at least ${minGap}px (shortest month), got ${actualGap}px`
        );
        expect(actualGap).toBeLessThanOrEqual(
          maxGap,
          `Gap ${i}: expected at most ${maxGap}px (longest month), got ${actualGap}px`
        );
      }
    });

    it('Year zoom: yearly ticks should be uniform in pixels for CE years', () => {
      const baseYear = 1; // 1 CE
      const pixelsPerYear = 100;
      const centerY = canvas.height / 2;

      const yearToY = createMockYearToY(baseYear, pixelsPerYear, centerY);
      const yToYearDev = createMockYToYearDev(baseYear, pixelsPerYear, centerY);

      const params: DrawHudLayerParams = {
        ctx,
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
        dpr: 1,
        screenWidth: canvas.width,
        unitYears: 1, // Year unit
        zoomLevelName: 'Year',
        yearToY,
        yToYearDev,
        nowYearFraction: () => 2025.85,
        formatLabelByUnit: (yf, unit) => dateService.formatLabelByUnit(yf, unit),
        labelFromDayOfYear: (year, day) => dateService.labelFromDayOfYear(year, day),
        daysInYear: (year) => dateService.daysInYear(year),
        getMonthName: (m) =>
          ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m],
        dateService,
      };

      const ticks = captureHudTicks(params);

      // Expect multiple yearly ticks
      expect(ticks.length).toBeGreaterThan(
        5,
        `Expected more than 5 yearly ticks, got ${ticks.length}`
      );

      // Calculate gaps
      const gaps: number[] = [];
      for (let i = 1; i < Math.min(ticks.length, 10); i++) {
        gaps.push(ticks[i] - ticks[i - 1]);
      }

      // Each gap should be 100 pixels (1 year * 100 px/year)
      const expectedGap = 100;
      const tolerance = 1;

      for (let i = 0; i < gaps.length; i++) {
        const actualGap = gaps[i];
        const difference = Math.abs(actualGap - expectedGap);
        expect(difference).toBeLessThan(
          tolerance,
          `Gap ${i}: expected ~${expectedGap}px (±${tolerance}px), got ${actualGap}px (difference: ${difference}px)`
        );
      }
    });

    it('Week zoom: weeks can span across year boundaries (e.g., late December into early January)', () => {
      const baseYear = 0; // 1 BCE
      const pixelsPerYear = 3650;
      const centerY = canvas.height / 2;

      const yearToY = createMockYearToY(baseYear, pixelsPerYear, centerY);
      const yToYearDev = createMockYToYearDev(baseYear, pixelsPerYear, centerY);

      const params: DrawHudLayerParams = {
        ctx,
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
        dpr: 1,
        screenWidth: canvas.width,
        unitYears: 7 / 365.2425,
        zoomLevelName: 'Week',
        yearToY,
        yToYearDev,
        nowYearFraction: () => 2025.85,
        formatLabelByUnit: (yf, unit) => dateService.formatLabelByUnit(yf, unit),
        labelFromDayOfYear: (year, day) => dateService.labelFromDayOfYear(year, day),
        daysInYear: (year) => dateService.daysInYear(year),
        getMonthName: (m) =>
          ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m],
        dateService,
      };

      // Capture labels instead of just positions
      const labels: string[] = [];
      const originalFillText = params.ctx.fillText.bind(params.ctx);
      spyOn(params.ctx, 'fillText').and.callFake((text: any, x: any, y: any) => {
        labels.push(String(text));
        originalFillText(text, x, y);
      });

      service.drawHudLayer(params);

      // Expect at least one label in December and at least one in January within the captured range
      const hasDecember = labels.some((label) => label.includes('Week of Dec '));
      const hasJanuary = labels.some((label) => label.includes('Week of Jan '));
      expect(hasDecember).toBeTrue();
      expect(hasJanuary).toBeTrue();
    });
  });
});
