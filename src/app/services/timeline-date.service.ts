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
      for (let j = 0; j < months.length; j++) if (t0.indexOf(months[j]) === 0) {
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
    let mi = 0,
      dleft = dayOfYear0;
    while (mi < 12 && dleft >= md[mi]) {
      dleft -= md[mi];
      mi++;
    }
    if (mi > 11) {
      mi = 11;
      dleft = md[11] - 1;
    }
    const day = dleft + 1;
    const yr = year < 0 ? -year : year;
    const tail = year < 0 ? ' B.C.E.' : ' C.E.';
    return `${months2[mi]} ${day}, ${yr}${tail}`;
  }

  snapToUnit(yf: number, unit: number) {
    if (!unit) return yf;
    return yf >= 0 ? Math.floor(yf / unit) * unit : -Math.ceil(Math.abs(yf) / unit) * unit;
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
      let yr3 = isBCE ? -yInt : yInt;
      const tail2 = yr3 < 0 ? ' B.C.E.' : ' C.E.';
      if (yr3 < 0) yr3 = -yr3;
      return `${months2[mi]} ${day}, ${yr3}${tail2}`;
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

  // small clamp helper for internal use
  private clamp(v: number, a: number, b: number) {
    return v < a ? a : v > b ? b : v;
  }

}
