import { TestBed } from '@angular/core/testing';
import { TimelineDateService } from './timeline-date.service';

describe('TimelineDateService', () => {
  let service: TimelineDateService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TimelineDateService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Date Navigation', () => {
    describe('nextDate from Jan 1, 150 BCE (astronomical -149)', () => {
      const testYf = -149;

      it('should move to next day correctly', () => {
        const result = service.nextDate(testYf, 'Day');
        expect(result.days).toBe(1);
        // Should move forward to Jan 2, 150 BCE
        expect(result.yf).toBeGreaterThan(testYf);
        expect(result.yf).toBeLessThan(testYf + 0.01); // Should be very close, just 1 day forward
      });

      it('should move to next week correctly', () => {
        const result = service.nextDate(testYf, 'Week');
        expect(result.days).toBe(7);
        expect(result.yf).toBeGreaterThan(testYf);
      });

      it('should move to next month correctly', () => {
        const result = service.nextDate(testYf, 'Month');
        // From January to February
        expect(result.yf).toBeGreaterThan(testYf);
        const historical = service.astronomicalToHistorical(Math.round(result.yf));
        expect(historical).toBe(-150); // Still in 150 BCE
      });

      it('should move to next year correctly', () => {
        const result = service.nextDate(testYf, 'Year');
        expect(result.yf).toBe(-148); // 149 BCE (astronomical -148)
        const historical = service.astronomicalToHistorical(Math.round(result.yf));
        expect(historical).toBe(-149); // Display as 149 BCE
      });

      it('should move to next decade correctly', () => {
        const result = service.nextDate(testYf, 'Decade');
        expect(result.yf).toBe(-139); // 140 BCE (astronomical -139)
        const historical = service.astronomicalToHistorical(Math.round(result.yf));
        expect(historical).toBe(-140); // Display as 140 BCE
      });

      it('should move to next century correctly', () => {
        const result = service.nextDate(testYf, 'Century');
        expect(result.yf).toBe(-99); // 100 BCE (astronomical -99)
        const historical = service.astronomicalToHistorical(Math.round(result.yf));
        expect(historical).toBe(-100); // Display as 100 BCE
      });

      it('should move to next millennium correctly', () => {
        const result = service.nextDate(testYf, 'Milennium');
        expect(result.yf).toBe(1); // 1 CE (astronomical 1)
        const historical = service.astronomicalToHistorical(Math.round(result.yf));
        expect(historical).toBe(1); // Display as 1 CE
      });
    });

    describe('nextDate from Jan 1, 1 BCE (astronomical 0)', () => {
      const testYf = 0;

      it('should move to next day correctly', () => {
        const result = service.nextDate(testYf, 'Day');
        expect(result.days).toBe(1);
        expect(result.yf).toBeGreaterThan(testYf);
      });

      it('should move to next year correctly (1 BCE to 1 CE)', () => {
        const result = service.nextDate(testYf, 'Year');
        expect(result.yf).toBe(1); // 1 CE
        expect(result.days).toBe(366); // 1 BCE was a leap year
      });

      it('should move to next decade correctly (10 BCE to 1 CE)', () => {
        const result = service.nextDate(testYf, 'Decade');
        expect(result.yf).toBe(1); // Skips to 1 CE (no year 0 in historical calendar)
      });
    });

    describe('nextDate from Jan 1, 1 CE (astronomical 1)', () => {
      const testYf = 1;

      it('should move to next day correctly', () => {
        const result = service.nextDate(testYf, 'Day');
        expect(result.days).toBe(1);
        expect(result.yf).toBeGreaterThan(testYf);
      });

      it('should move to next year correctly', () => {
        const result = service.nextDate(testYf, 'Year');
        expect(result.yf).toBe(2); // 2 CE
      });

      it('should move to next decade correctly', () => {
        const result = service.nextDate(testYf, 'Decade');
        expect(result.yf).toBe(10); // 10 CE (next decade boundary)
      });

      it('should move to next century correctly', () => {
        const result = service.nextDate(testYf, 'Century');
        expect(result.yf).toBe(100); // 100 CE
      });
    });

    describe('previousDate from Jan 1, 150 BCE (astronomical -149)', () => {
      const testYf = -149;

      it('should move to previous day correctly', () => {
        const result = service.previousDate(testYf, 'Day');
        expect(result.days).toBe(1);
        // Should move backward to Dec 31, 151 BCE
        expect(result.yf).toBeLessThan(testYf);
      });

      it('should move to previous year correctly', () => {
        const result = service.previousDate(testYf, 'Year');
        expect(result.yf).toBe(-150); // 151 BCE (astronomical -150)
        const historical = service.astronomicalToHistorical(Math.round(result.yf));
        expect(historical).toBe(-151); // Display as 151 BCE
      });

      it('should move to previous decade correctly', () => {
        const result = service.previousDate(testYf, 'Decade');
        expect(result.yf).toBe(-159); // 160 BCE (astronomical -159)
        const historical = service.astronomicalToHistorical(Math.round(result.yf));
        expect(historical).toBe(-160); // Display as 160 BCE
      });
    });

    describe('previousDate from Jan 1, 1 BCE (astronomical 0)', () => {
      const testYf = 0;

      it('should move to previous day correctly', () => {
        const result = service.previousDate(testYf, 'Day');
        expect(result.days).toBe(1);
        expect(result.yf).toBeLessThan(testYf);
      });

      it('should move to previous year correctly', () => {
        const result = service.previousDate(testYf, 'Year');
        expect(result.yf).toBe(-1); // 2 BCE (astronomical -1)
        const historical = service.astronomicalToHistorical(Math.round(result.yf));
        expect(historical).toBe(-2); // Display as 2 BCE
      });
    });

    describe('previousDate from Jan 1, 1 CE (astronomical 1)', () => {
      const testYf = 1;

      it('should move to previous day correctly', () => {
        const result = service.previousDate(testYf, 'Day');
        expect(result.days).toBe(1);
        expect(result.yf).toBeLessThan(testYf);
      });

      it('should move to previous year correctly (1 CE to 1 BCE)', () => {
        const result = service.previousDate(testYf, 'Year');
        expect(result.yf).toBe(0); // 1 BCE
        expect(result.days).toBe(366); // 1 BCE was a leap year
      });

      it('should move to previous decade correctly (1 CE to 10 BCE)', () => {
        const result = service.previousDate(testYf, 'Decade');
        expect(result.yf).toBe(-9); // 10 BCE (astronomical -9)
        const historical = service.astronomicalToHistorical(Math.round(result.yf));
        expect(historical).toBe(-10); // Display as 10 BCE
      });

      it('should move to previous century correctly (1 CE to 100 BCE)', () => {
        const result = service.previousDate(testYf, 'Century');
        expect(result.yf).toBe(-99); // 100 BCE (astronomical -99)
      });
    });
  });

  describe('Historical/Astronomical Year Conversion', () => {
    it('should convert astronomical to historical correctly for BCE', () => {
      expect(service.astronomicalToHistorical(0)).toBe(-1); // 1 BCE
      expect(service.astronomicalToHistorical(-1)).toBe(-2); // 2 BCE
      expect(service.astronomicalToHistorical(-9)).toBe(-10); // 10 BCE
      expect(service.astronomicalToHistorical(-99)).toBe(-100); // 100 BCE
      expect(service.astronomicalToHistorical(-149)).toBe(-150); // 150 BCE
    });

    it('should convert astronomical to historical correctly for CE', () => {
      expect(service.astronomicalToHistorical(1)).toBe(1); // 1 CE
      expect(service.astronomicalToHistorical(10)).toBe(10); // 10 CE
      expect(service.astronomicalToHistorical(100)).toBe(100); // 100 CE
    });

    it('should convert historical to astronomical correctly for BCE', () => {
      expect(service.historicalToAstronomical(-1)).toBe(0); // 1 BCE
      expect(service.historicalToAstronomical(-2)).toBe(-1); // 2 BCE
      expect(service.historicalToAstronomical(-10)).toBe(-9); // 10 BCE
      expect(service.historicalToAstronomical(-100)).toBe(-99); // 100 BCE
      expect(service.historicalToAstronomical(-150)).toBe(-149); // 150 BCE
    });

    it('should convert historical to astronomical correctly for CE', () => {
      expect(service.historicalToAstronomical(1)).toBe(1); // 1 CE
      expect(service.historicalToAstronomical(10)).toBe(10); // 10 CE
      expect(service.historicalToAstronomical(100)).toBe(100); // 100 CE
    });
  });

  describe('Date Direction Consistency', () => {
    it('should always move forward in time with nextDate', () => {
      const dates = [-149, -10, 0, 1, 10, 100];
      const zoomLevels = ['Day', 'Week', 'Month', 'Year', 'Decade', 'Century', 'Milennium'];

      for (const date of dates) {
        for (const zoom of zoomLevels) {
          const result = service.nextDate(date, zoom);
          expect(result.yf).toBeGreaterThan(
            date,
            `nextDate(${date}, '${zoom}') should move forward, but got ${result.yf}`
          );
        }
      }
    });

    it('should always move backward in time with previousDate', () => {
      const dates = [-149, -10, 0, 1, 10, 100];
      const zoomLevels = ['Day', 'Week', 'Month', 'Year', 'Decade', 'Century', 'Milennium'];

      for (const date of dates) {
        for (const zoom of zoomLevels) {
          const result = service.previousDate(date, zoom);
          expect(result.yf).toBeLessThan(
            date,
            `previousDate(${date}, '${zoom}') should move backward, but got ${result.yf}`
          );
        }
      }
    });
  });

  describe('Month Navigation in BCE', () => {
    it('should navigate months forward correctly in 150 BCE', () => {
      let current = -149; // Jan 1, 150 BCE
      const months: number[] = [];

      // Navigate through 12 months
      for (let i = 0; i < 12; i++) {
        months.push(current);
        const result = service.nextDate(current, 'Month');
        current = result.yf;
      }

      // Verify all months are within the same year (150 BCE = astronomical -149)
      for (const month of months) {
        const yr = Math.floor(month);
        expect(yr).toBe(-149, `Month ${month} should be in year -149 (150 BCE)`);
      }

      // Verify months are ascending
      for (let i = 1; i < months.length; i++) {
        expect(months[i]).toBeGreaterThan(
          months[i - 1],
          `Month ${i} (${months[i]}) should be after month ${i - 1} (${months[i - 1]})`
        );
      }
    });

    it('should navigate months backward correctly in 150 BCE', () => {
      let current = -149; // Jan 1, 150 BCE
      const months: number[] = [];

      // Navigate through 12 months backward
      for (let i = 0; i < 12; i++) {
        const result = service.previousDate(current, 'Month');
        months.push(result.yf);
        current = result.yf;
      }

      // Verify months are descending
      for (let i = 1; i < months.length; i++) {
        expect(months[i]).toBeLessThan(
          months[i - 1],
          `Month ${i} (${months[i]}) should be before month ${i - 1} (${months[i - 1]})`
        );
      }
    });
  });

  describe('HUD label uniqueness and order near 1 BCE', () => {
    it('should not duplicate month labels (e.g., only one "Nov 149 B.C.E.")', () => {
      let current = -149; // Jan 1, 150 BCE (astronomical -149)
      const labels: string[] = [];

      // Collect 24 month labels across 150 BCE and into 149 BCE
      for (let i = 0; i < 24; i++) {
        labels.push(service.formatLabelByUnit(current, 1 / 12));
        current = service.nextDate(current, 'Month').yf;
      }

      const dup = labels.filter((l) => l === 'Nov 149 B.C.E.');
      expect(dup.length).toBeLessThanOrEqual(1);
    });

    it('months should progress forward across 2 BCE → 1 BCE', () => {
      // From Dec 2 BCE to Jan 1 BCE to Feb 1 BCE via previous/next
      const fromJan1_1BCE = 0; // astronomical 0

      const prev = service.previousDate(fromJan1_1BCE, 'Month');
      const prevLabel = service.formatLabelByUnit(prev.yf, 1 / 12);
      expect(prevLabel).toBe('Dec 2 B.C.E.');

      const next = service.nextDate(fromJan1_1BCE, 'Month');
      const nextLabel = service.formatLabelByUnit(next.yf, 1 / 12);
      expect(nextLabel).toBe('Feb 1 B.C.E.');
    });

    it('should not duplicate week labels around Jan 1, 1 B.C.E.', () => {
      // Walk weeks across the BCE boundary
      let current = -0.1; // slightly before 1 BCE
      const labels: string[] = [];
      const WEEK_UNIT = 7 / 365.2425; // approximate mean year

      for (let i = 0; i < 40; i++) {
        labels.push(service.formatLabelByUnit(current, WEEK_UNIT));
        current = service.nextDate(current, 'Week').yf;
      }

      const jan1_1bce = labels.filter((l) => l === 'Week of Jan 1, 1 B.C.E.');
      expect(jan1_1bce.length).toBeLessThanOrEqual(1);
    });
  });

  describe('Month edge cases around 1 BCE', () => {
    it('previous month from Jan 1, 1 BCE (astronomical 0) should be Dec 2 BCE', () => {
      const fromYf = 0; // Jan 1, 1 BCE (astronomical year 0)
      const result = service.previousDate(fromYf, 'Month');

      // Determine astronomical year and month of the result
      const yr = Math.floor(result.yf);
      const diy = service.daysInYear(yr);
      const frac = result.yf - yr;
      const dayOfYear = Math.floor(frac * diy);
      const febDays = diy === 366 ? 29 : 28;
      const md = [31, febDays, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

      let cum = 0;
      let monthIndex = 11; // default December
      for (let m = 0; m < 12; m++) {
        cum += md[m];
        if (dayOfYear < cum) {
          monthIndex = m;
          break;
        }
      }

      const histYear = service.astronomicalToHistorical(yr);

      // Expect December of 2 BCE
      expect(monthIndex).toBe(11, `Expected December month index 11, got ${monthIndex}`);
      expect(histYear).toBe(-2, `Expected historical year -2 (2 B.C.E.), got ${histYear}`);
    });
  });

  describe('Day Navigation in BCE', () => {
    it('should navigate days forward correctly in 150 BCE', () => {
      let current = -149; // Jan 1, 150 BCE
      const days: number[] = [];

      // Navigate through 10 days
      for (let i = 0; i < 10; i++) {
        days.push(current);
        const result = service.nextDate(current, 'Day');
        current = result.yf;
      }

      // Verify days are ascending
      for (let i = 1; i < days.length; i++) {
        expect(days[i]).toBeGreaterThan(
          days[i - 1],
          `Day ${i} (${days[i]}) should be after day ${i - 1} (${days[i - 1]})`
        );
      }
    });

    it('should navigate days backward correctly in 150 BCE', () => {
      let current = -149; // Jan 1, 150 BCE
      const days: number[] = [];

      // Navigate through 10 days backward
      for (let i = 0; i < 10; i++) {
        const result = service.previousDate(current, 'Day');
        days.push(result.yf);
        current = result.yf;
      }

      // Verify days are descending
      for (let i = 1; i < days.length; i++) {
        expect(days[i]).toBeLessThan(
          days[i - 1],
          `Day ${i} (${days[i]}) should be before day ${i - 1} (${days[i - 1]})`
        );
      }
    });
  });

  describe('Day label monotonicity across BCE/CE boundary', () => {
    function parseDayLabel(
      label: string,
      svc: TimelineDateService
    ): { aYear: number; day0: number } {
      // Example: "Wed, Dec 30, 1 B.C.E." or "Thu, Jan 1, 1 C.E."
      const m = label.match(
        /^([A-Za-z]{3}),\s+([A-Za-z]{3})\s+(\d+),\s+(\d+)\s+(B\.C\.E\.|C\.E\.)$/
      );
      if (!m) {
        throw new Error(`Unparsable day label: ${label}`);
      }
      const monthStr = m[2];
      const day = parseInt(m[3], 10);
      const yearAbs = parseInt(m[4], 10);
      const era = m[5];
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
      const mi = months.indexOf(monthStr);
      const histYear = era.startsWith('B') ? -yearAbs : yearAbs;
      const astroYear = svc.historicalToAstronomical(histYear);
      const diy = svc.daysInYear(astroYear);
      const feb = diy === 366 ? 29 : 28;
      const md = [31, feb, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
      let cum = 0;
      for (let i = 0; i < mi; i++) cum += md[i];
      const day0 = cum + (day - 1);
      return { aYear: astroYear, day0 };
    }

    it('Day labels move forward across 1 B.C.E. → 1 C.E.', () => {
      const dayUnit = 1 / service.meanYear;
      const yr = 0; // 1 B.C.E. (astronomical 0)
      const diy = service.daysInYear(yr); // 366
      // Start 5 days before end of 1 B.C.E. and step forward across into 1 C.E.
      let current = yr + (diy - 5) / diy;

      const ordinals: Array<{ aYear: number; day0: number; label: string }> = [];
      for (let i = 0; i < 12; i++) {
        const label = service.formatLabelByUnit(current, dayUnit);
        const ord = parseDayLabel(label, service);
        ordinals.push({ ...ord, label });
        current = service.nextDate(current, 'Day').yf;
      }

      for (let i = 1; i < ordinals.length; i++) {
        const prev = ordinals[i - 1];
        const cur = ordinals[i];
        const nonDecreasing =
          cur.aYear > prev.aYear || (cur.aYear === prev.aYear && cur.day0 > prev.day0);
        if (!nonDecreasing) {
          fail(`Day label moved backwards at step ${i}: '${prev.label}' -> '${cur.label}'`);
        }
        expect(nonDecreasing).toBeTrue();
      }
    });
  });

  describe('Leap Year Handling', () => {
    it('should recognize 1 BCE (year 0) as a leap year', () => {
      expect(service.daysInYear(0)).toBe(366);
    });

    it('should recognize leap years correctly', () => {
      expect(service.daysInYear(2000)).toBe(366); // Leap year
      expect(service.daysInYear(2024)).toBe(366); // Leap year
      expect(service.daysInYear(1900)).toBe(365); // Not a leap year (century exception)
      expect(service.daysInYear(2023)).toBe(365); // Not a leap year
    });
  });
});
