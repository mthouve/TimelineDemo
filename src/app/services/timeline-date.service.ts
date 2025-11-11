import { Injectable } from '@angular/core';
import { TIMELINE_POINTS } from '../data/timeline-points';

export type ZoomSpec = {
  id: string;
  name: string;
  unit: number;
};

@Injectable({
  providedIn: 'root',
})
export class TimelineDateService {
  private readonly MEAN_YEAR = 365.2425; // Gregorian mean

  readonly zoomLevels: ZoomSpec[] = [
    { id: 'guidesDay', name: 'Day', unit: 1 / this.MEAN_YEAR },
    { id: 'guidesWeek', name: 'Week', unit: 7 / this.MEAN_YEAR },
    { id: 'guidesMonth', name: 'Month', unit: 1 / 12 },
    { id: 'guidesYear', name: 'Year', unit: 1 },
    { id: 'guidesDecade', name: 'Decade', unit: 10 },
    { id: 'guidesCentury', name: 'Century', unit: 100 },
    { id: 'guidesMilennium', name: 'Milennium', unit: 1000 },
  ];

  readonly zoomLabels: string[] = this.zoomLevels.map((z) => z.name);

  // Timeline points are now imported from a separate data file

  constructor() {}

  getZoomLevels(): ZoomSpec[] {
    return this.zoomLevels;
  }

  getZoomLabels(): string[] {
    return this.zoomLabels;
  }

  getTimelinePoints(): Record<string, string> {
    return TIMELINE_POINTS;
  }

  getUnitForZoomLevel(zoomIndex: number): number {
    if (zoomIndex < 0 || zoomIndex >= this.zoomLevels.length) {
      throw new Error('Invalid zoom level index');
    }
    return this.zoomLevels[zoomIndex].unit;
  }

  get meanYear(): number {
    return this.MEAN_YEAR;
  }

  isApproximatelyEqual(a: number, b: number, relTolerance: number): boolean {
    return Math.abs(a - b) / Math.max(1e-9, Math.abs(b)) < relTolerance;
  }

  isDayUnit(unit: number): boolean {
    return (
      Math.abs(unit - 1 / 365) < 1e-6 ||
      Math.abs(unit - 1 / 366) < 1e-6 ||
      this.isApproximatelyEqual(unit, 1 / this.MEAN_YEAR, 0.01)
    );
  }

  isWeekUnit(unit: number): boolean {
    return this.isApproximatelyEqual(unit, 7 / this.MEAN_YEAR, 0.02);
  }

  // ---------- Date helpers moved from App ----------
  isLeapYear(y: number): boolean {
    const a = Math.abs(y);
    return a % 4 === 0 && (a % 100 !== 0 || a % 400 === 0);
  }

  daysInYear(y: number): number {
    return this.isLeapYear(y) ? 366 : 365;
  }

  startOfYearInt(yf: number): number {
    return yf >= 0 ? Math.floor(yf) : Math.ceil(yf);
  }

  // Parse an input like "February 28, 2024" or a number into a fractional year.
  yearFractionFromInput(input: string | number): number {
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
        // Convert historical year to astronomical: B.C.E. years need +1
        const astronomicalYear = hasBCE ? this.historicalToAstronomical(-Math.abs(yAbs)) : yAbs;
        return astronomicalYear + frac;
      }
    }

    const yOnly = lastInt(raw);
    if (!isNaN(yOnly)) {
      // Convert historical year to astronomical: B.C.E. years need +1
      return hasBCE ? this.historicalToAstronomical(-Math.abs(yOnly)) : yOnly;
    }
    return NaN;
  }

  yearParseWithFlag(input: string | number): { yf: number; yearOnly: boolean } {
    if (typeof input === 'number' && isFinite(input)) {
      return { yf: input, yearOnly: Math.floor(input) === input };
    }
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
      const p0 = U.split(',').join(' ').split(' ').filter(Boolean);
      if (p0.length) {
        const t0 = p0[0];
        for (const m of months) {
          if (t0.indexOf(m) === 0) {
            hasMonth = true;
            break;
          }
        }
      }
    }

    const yf = this.yearFractionFromInput(raw);
    const yearOnly = !hasMonth && isFinite(yf) && Math.floor(Math.abs(yf)) === Math.abs(yf);
    return { yf, yearOnly };
  }

  nowYearFraction(): number {
    const d = new Date();
    const y = d.getUTCFullYear();
    const a = Date.UTC(y, 0, 1),
      b = Date.UTC(y + 1, 0, 1);
    return y + (d.getTime() - a) / (b - a);
  }

  labelFromDayOfYear(year: number, dayOfYear0: number): string {
    const md = [31, this.isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
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

    // Ensure dayOfYear is in valid range [0, daysInYear)
    let dayOfYear = Math.max(0, dayOfYear0);
    const diy = this.daysInYear(year);
    if (dayOfYear >= diy) {
      dayOfYear = diy - 1;
    }

    let mi = 0,
      dleft = dayOfYear;
    while (mi < 12 && dleft >= md[mi]) {
      dleft -= md[mi];
      mi++;
    }
    if (mi > 11) {
      mi = 11;
      dleft = md[11] - 1;
    }
    const day = dleft + 1;
    const historicalYear = this.astronomicalToHistorical(year);
    const yr = historicalYear < 0 ? -historicalYear : historicalYear;
    const tail = historicalYear < 0 ? ' B.C.E.' : ' C.E.';
    return `Week of ${months2[mi]} ${day}, ${yr}${tail}`;
  }

  snapToUnit(yf: number, unit: number) {
    if (!unit) return yf;
    return yf >= 0 ? Math.floor(yf / unit) * unit : -Math.ceil(Math.abs(yf) / unit) * unit;
  }

  // Convert from astronomical year (includes 0) to historical year (1 BCE -> 1 CE)
  astronomicalToHistorical(year: number): number {
    if (year <= 0) {
      return year - 1; // 0 -> -1, -1 -> -2, etc.
    }
    return year; // Positive years unchanged
  }

  // Convert from historical year to astronomical year
  historicalToAstronomical(year: number): number {
    if (year < 0) {
      return year + 1; // -1 -> 0, -2 -> -1, etc.
    }
    return year; // Positive years unchanged
  }

  // Reimplement the formatLabelByUnit logic here so callers can get formatted labels
  formatLabelByUnit(yf: number, unit: number): string {
    const isBCE = yf < 0;
    let abs = isBCE ? -yf : yf;
    let yInt = Math.floor(abs);
    let frac = abs - yInt;
    const calYear = yf >= 0 ? Math.floor(yf) : Math.ceil(yf);
    let diy = this.daysInYear(calYear);

    // DAY tier detection
    const isDayTier =
      Math.abs(unit - 1 / diy) < 1e-7 ||
      Math.abs(unit - 1 / 365) < 1e-7 ||
      this.isApproximatelyEqual(unit, 1 / this.MEAN_YEAR, 0.02);

    if (isDayTier) {
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

      // Convert astronomical year to historical year for display
      const astronomicalYear = isBCE ? -yInt : yInt;
      const historicalYear = this.astronomicalToHistorical(astronomicalYear);
      const absYear = Math.abs(historicalYear);
      const tail2 = historicalYear < 0 ? ' B.C.E.' : ' C.E.';
      return `${months2[mi]} ${day}, ${absYear}${tail2}`;
    }

    if (this.isApproximatelyEqual(unit, 7 / this.MEAN_YEAR, 0.02)) {
      const year = calYear;
      const diyL = this.daysInYear(year);
      let dayOfYear = Math.floor(frac * diyL);
      dayOfYear = dayOfYear - (dayOfYear % 7);
      return this.labelFromDayOfYear(year, dayOfYear);
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

      // Convert astronomical year to historical year for display
      const astronomicalYear = isBCE ? -yInt : yInt;
      const historicalYear = this.astronomicalToHistorical(astronomicalYear);
      const absYear = Math.abs(historicalYear);
      const tail = historicalYear < 0 ? ' B.C.E.' : ' C.E.';
      return `${months[m]} ${absYear}${tail}`;
    }

    if (unit >= 1) {
      // Convert astronomical year (may include 0) to historical year for display
      const historicalYear = this.astronomicalToHistorical(Math.round(yf));
      const absYear = Math.abs(historicalYear);
      return historicalYear < 0 ? `${absYear} B.C.E.` : `${absYear} C.E.`;
    }
    return '';
  }

  // small clamp helper for internal use
  private clamp(v: number, a: number, b: number) {
    return v < a ? a : v > b ? b : v;
  }
}
