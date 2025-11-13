import { Injectable } from '@angular/core';
import { TIMELINE_POINTS, TimelinePoint } from '../data/timeline-points';

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

  getTimelinePoints(): Record<string, TimelinePoint> {
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

    // Day-aligned snapping (use actual year's length)
    const calYear = yf >= 0 ? Math.floor(yf) : Math.ceil(yf);
    const diy = this.daysInYear(calYear);

    // Day tier (1/diy or ~1/365 or mean year fraction)
    const isDayTier =
      Math.abs(unit - 1 / diy) < 1e-7 ||
      Math.abs(unit - 1 / 365) < 1e-5 ||
      this.isApproximatelyEqual(unit, 1 / this.MEAN_YEAR, 0.02);

    if (isDayTier) {
      // Snap to exact start-of-day (no epsilon)
      const yr = Math.floor(yf);
      const diy0 = this.daysInYear(yr);
      const frac = yf - yr;
      const dayOfYear = Math.floor(frac * diy0);
      return yr + dayOfYear / diy0;
    }

    // Week tier (~7/mean year)
    if (this.isApproximatelyEqual(unit, 7 / this.MEAN_YEAR, 0.02)) {
      // Snap to start of the current week with Sunday as week start (USA convention)
      const idx = this.dayIndexFromYf(yf);
      const w = this.weekdayFromYf(yf); // 0=Sun..6=Sat
      const deltaToStart = (w - 0 + 7) % 7; // days since Sunday
      const weekStartIdx = idx - deltaToStart;
      return this.yfFromDayIndex(weekStartIdx);
    }

    // Month tier (~1/12); compute by month boundaries for given year
    if (Math.abs(unit - 1 / 12) < 1e-7) {
      const yr = Math.floor(yf);
      const diy0 = this.daysInYear(yr);
      const frac = yf - yr;
      const dayOfYear = Math.floor(frac * diy0);
      const febDays = diy0 === 366 ? 29 : 28;
      const md = [31, febDays, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
      let cum = 0;
      let currentMonth = 11;
      for (let m = 0; m < 12; m++) {
        cum += md[m];
        if (dayOfYear < cum) {
          currentMonth = m;
          break;
        }
      }
      // Start of current month
      const startOfMonth = cum - md[currentMonth];
      // Snap to exact start of month (no epsilon)
      return yr + startOfMonth / diy0;
    }

    // Year and larger units: use historical rounding rules implemented for next/previous
    const fromHistorical = this.astronomicalToHistorical(Math.floor(yf));

    // Year
    if (Math.abs(unit - 1) < 1e-9) {
      // Snap down to the start of historical year
      const astro = this.historicalToAstronomical(fromHistorical);
      return astro;
    }

    // Decade ~10 years
    if (Math.abs(unit - 10) < 1e-6) {
      if (fromHistorical < 0) {
        const absH = Math.abs(fromHistorical);
        const decadeAbs = Math.floor((absH - 1) / 10) * 10; // e.g., 150 -> 140, 11 -> 10, 10 -> 0
        return decadeAbs <= 0 ? 1 : this.historicalToAstronomical(-decadeAbs);
      } else {
        const decade = Math.floor(fromHistorical / 10) * 10; // 1..10 -> 0, 11..20 -> 10, etc.
        return this.historicalToAstronomical(Math.max(decade, 1));
      }
    }

    // Century ~100 years
    if (Math.abs(unit - 100) < 1e-6) {
      if (fromHistorical < 0) {
        const absH = Math.abs(fromHistorical);
        const centAbs = Math.floor((absH - 1) / 100) * 100;
        return centAbs <= 0 ? 1 : this.historicalToAstronomical(-centAbs);
      } else {
        const cent = Math.floor(fromHistorical / 100) * 100;
        return this.historicalToAstronomical(Math.max(cent, 1));
      }
    }

    // Millennium ~1000 years
    if (Math.abs(unit - 1000) < 1e-6) {
      if (fromHistorical < 0) {
        const absH = Math.abs(fromHistorical);
        const milAbs = Math.floor((absH - 1) / 1000) * 1000;
        return milAbs <= 0 ? 1 : this.historicalToAstronomical(-milAbs);
      } else {
        const mil = Math.floor(fromHistorical / 1000) * 1000;
        return this.historicalToAstronomical(Math.max(mil, 1));
      }
    }

    // Default fallback
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

  /**
   * Move to the next date boundary based on the zoom level.
   * Returns { yf: yearFraction, days: actualDaysBetween }
   */
  nextDate(fromYf: number, zoomLevel: string): { yf: number; days: number } {
    switch (zoomLevel) {
      case 'Day': {
        // Move forward by exactly 1 absolute day
        const idx = this.dayIndexFromYf(fromYf);
        const nextIdx = idx + 1;
        return { yf: this.yfFromDayIndex(nextIdx), days: 1 };
      }

      case 'Week': {
        // Move forward to the next week boundary with Sunday as the week start
        const idx = this.dayIndexFromYf(fromYf);
        const w = this.weekdayFromYf(fromYf); // 0=Sun..6=Sat
        const deltaToStart = (w - 0 + 7) % 7;
        const weekStart = idx - deltaToStart;
        const nextIdx = weekStart + 7;
        return { yf: this.yfFromDayIndex(nextIdx), days: 7 };
      }

      case 'Month': {
        // Move to the start of the next month
        const yr = Math.floor(fromYf);
        const diy = this.daysInYear(yr);
        const frac = fromYf - yr;
        const dayOfYear = Math.floor(frac * diy + 1e-9);

        const febDays = diy === 366 ? 29 : 28;
        const monthDays = [31, febDays, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

        // Find current month by checking which month contains dayOfYear
        let currentMonth = 11; // Default to December
        let monthStartDay = 0;
        for (let m = 0; m < 12; m++) {
          const monthEndDay = monthStartDay + monthDays[m];
          if (dayOfYear <= monthEndDay - 1) {
            // Day is in month m (e.g., days 0-30 are in month 0)
            currentMonth = m;
            break;
          }
          monthStartDay = monthEndDay;
        }

        // Calculate days in current month
        const daysInCurrentMonth = monthDays[currentMonth];

        // Next month
        const nextMonth = currentMonth + 1;

        if (nextMonth >= 12) {
          // Moving to January of next year
          const nextYear = yr === 0 ? 1 : yr + 1;
          // Start of next year (exact boundary)
          return { yf: nextYear, days: daysInCurrentMonth };
        } else {
          // Same year, calculate start of next month
          let cumToNextMonth = 0;
          for (let m = 0; m < nextMonth; m++) {
            cumToNextMonth += monthDays[m];
          }
          // Exact start of next month (no epsilon)
          const result = yr + cumToNextMonth / diy;
          return { yf: result, days: daysInCurrentMonth };
        }
      }

      case 'Year': {
        // Move to the next year start
        const yr = Math.floor(fromYf);
        const fromHistorical = this.astronomicalToHistorical(yr);

        if (fromHistorical === -1) {
          // From 1 BCE (astronomical 0) to 1 CE (astronomical 1)
          return { yf: 1, days: 366 }; // 1 BCE was a leap year
        }

        const nextHistorical = fromHistorical + 1;
        const nextAstro = this.historicalToAstronomical(nextHistorical);
        const daysInCurrentYear = this.daysInYear(yr);

        return { yf: nextAstro, days: daysInCurrentYear };
      }

      case 'Decade': {
        const yr = Math.floor(fromYf);
        const fromHistorical = this.astronomicalToHistorical(yr);

        if (fromHistorical < 0) {
          // For BCE dates, use rounded boundaries: 10, 20, 30, etc.
          const absHistorical = Math.abs(fromHistorical);
          const nextDecadeAbs = Math.floor((absHistorical - 1) / 10) * 10; // Next smaller rounded value

          if (nextDecadeAbs <= 0) {
            // From 10 BCE or less to 1 CE (astronomical 1)
            return { yf: 1, days: this.daysBetween(yr, 1) };
          } else {
            const nextHistorical = -nextDecadeAbs;
            const nextAstro = this.historicalToAstronomical(nextHistorical);
            return { yf: nextAstro, days: this.daysBetween(yr, nextAstro) };
          }
        } else {
          // For CE dates, use rounded boundaries: 10, 20, 30, etc.
          const nextDecade = Math.floor(fromHistorical / 10) * 10 + 10;
          return { yf: nextDecade, days: this.daysBetween(yr, nextDecade) };
        }
      }

      case 'Century': {
        const yr = Math.floor(fromYf);
        const fromHistorical = this.astronomicalToHistorical(yr);

        if (fromHistorical < 0) {
          // For BCE dates, use rounded boundaries: 100, 200, 300, etc.
          const absHistorical = Math.abs(fromHistorical);
          const nextCenturyAbs = Math.floor((absHistorical - 1) / 100) * 100; // Next smaller rounded value

          if (nextCenturyAbs <= 0) {
            // From 100 BCE or less to 1 CE (astronomical 1)
            return { yf: 1, days: this.daysBetween(yr, 1) };
          } else {
            const nextHistorical = -nextCenturyAbs;
            const nextAstro = this.historicalToAstronomical(nextHistorical);
            return { yf: nextAstro, days: this.daysBetween(yr, nextAstro) };
          }
        } else {
          // For CE dates, use rounded boundaries: 100, 200, 300, etc.
          const nextCentury = Math.floor(fromHistorical / 100) * 100 + 100;
          return { yf: nextCentury, days: this.daysBetween(yr, nextCentury) };
        }
      }

      case 'Milennium': {
        const yr = Math.floor(fromYf);
        const fromHistorical = this.astronomicalToHistorical(yr);

        if (fromHistorical < 0) {
          // For BCE dates, use rounded boundaries: 1000, 2000, 3000, etc.
          const absHistorical = Math.abs(fromHistorical);
          const nextMilenniumAbs = Math.floor((absHistorical - 1) / 1000) * 1000; // Next smaller rounded value

          if (nextMilenniumAbs <= 0) {
            // From 1000 BCE or less to 1 CE (astronomical 1)
            return { yf: 1, days: this.daysBetween(yr, 1) };
          } else {
            const nextHistorical = -nextMilenniumAbs;
            const nextAstro = this.historicalToAstronomical(nextHistorical);
            return { yf: nextAstro, days: this.daysBetween(yr, nextAstro) };
          }
        } else {
          // For CE dates, use rounded boundaries: 1000, 2000, 3000, etc.
          const nextMilennium = Math.floor(fromHistorical / 1000) * 1000 + 1000;
          return { yf: nextMilennium, days: this.daysBetween(yr, nextMilennium) };
        }
      }

      default:
        return { yf: fromYf + 1, days: 365 };
    }
  }

  /**
   * Move to the previous date boundary based on the zoom level.
   * Returns { yf: yearFraction, days: actualDaysBetween }
   */
  previousDate(fromYf: number, zoomLevel: string): { yf: number; days: number } {
    const fromAstro = Math.round(fromYf);
    const fromHistorical = this.astronomicalToHistorical(fromAstro);
    const isBCE = fromHistorical < 0;

    switch (zoomLevel) {
      case 'Day': {
        // Move back by exactly 1 absolute day
        const idx = this.dayIndexFromYf(fromYf);
        const prevIdx = idx - 1;
        return { yf: this.yfFromDayIndex(prevIdx), days: 1 };
      }

      case 'Week': {
        // Move back to the previous week boundary with Sunday as the week start
        const idx = this.dayIndexFromYf(fromYf);
        const w = this.weekdayFromYf(fromYf); // 0=Sun..6=Sat
        const deltaToStart = (w - 0 + 7) % 7;
        const weekStart = idx - deltaToStart;
        const prevIdx = weekStart - 7;
        return { yf: this.yfFromDayIndex(prevIdx), days: 7 };
      }

      case 'Month': {
        // Move to the start of the previous month
        const yr = Math.floor(fromYf);
        const diy = this.daysInYear(yr);
        const frac = fromYf - yr;
        const dayOfYear = Math.floor(frac * diy + 1e-9);

        // Month day lengths for the current year
        const febDays = diy === 366 ? 29 : 28;
        const monthDays = [31, febDays, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

        // Find current month (handle boundaries robustly)
        let cumDays = 0;
        let currentMonth = 11; // default to December
        for (let m = 0; m < 12; m++) {
          cumDays += monthDays[m];
          if (dayOfYear < cumDays) {
            currentMonth = m;
            break;
          }
        }

        // Previous month within the same year
        const previousMonth = currentMonth - 1;
        if (previousMonth >= 0) {
          let cumToPrev = 0;
          for (let m = 0; m < previousMonth; m++) cumToPrev += monthDays[m];
          // Exact start of previous month (no epsilon)
          return { yf: yr + cumToPrev / diy, days: monthDays[previousMonth] };
        }

        // Crossing into previous year → December of previous year
        const prevYear = yr - 1;
        const prevDiy = this.daysInYear(prevYear);
        const prevFebDays = prevDiy === 366 ? 29 : 28;
        const prevMonthDays = [31, prevFebDays, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

        let cumToDec = 0; // start of December
        for (let m = 0; m < 11; m++) cumToDec += prevMonthDays[m];

        return { yf: prevYear + cumToDec / prevDiy, days: prevMonthDays[11] };
      }

      case 'Year': {
        // Move to the previous year
        if (fromHistorical === 1) {
          // From 1 CE (astronomical 1) to 1 BCE (astronomical 0)
          return { yf: 0, days: 366 }; // 1 BCE was a leap year
        } else {
          const prevHistorical = fromHistorical - 1;
          const prevAstro = this.historicalToAstronomical(prevHistorical);
          const daysInPrevYear = this.daysInYear(prevAstro);

          return { yf: prevAstro, days: daysInPrevYear };
        }
      }

      case 'Decade': {
        // Move to the previous decade boundary
        if (fromHistorical === 1) {
          // From 1 CE to 10 BCE (astronomical -9)
          return { yf: -9, days: this.daysBetween(-9, 1) };
        } else if (isBCE) {
          const absHistorical = Math.abs(fromHistorical);
          const currentDecade = Math.ceil(absHistorical / 10) * 10;
          const prevDecade = currentDecade + 10; // Moving backward means larger absolute value

          const prevHistorical = -prevDecade;
          const prevAstro = this.historicalToAstronomical(prevHistorical);
          return { yf: prevAstro, days: this.daysBetween(prevAstro, fromAstro) };
        } else {
          const currentDecade = Math.ceil(fromHistorical / 10) * 10;
          const prevDecade = currentDecade - 10;
          const prevAstro = prevDecade <= 0 ? -9 : prevDecade;
          return { yf: prevAstro, days: this.daysBetween(prevAstro, fromAstro) };
        }
      }

      case 'Century': {
        // Move to the previous century boundary
        if (fromHistorical === 1) {
          // From 1 CE to 100 BCE (astronomical -99)
          return { yf: -99, days: this.daysBetween(-99, 1) };
        } else if (isBCE) {
          const absHistorical = Math.abs(fromHistorical);
          const currentCentury = Math.ceil(absHistorical / 100) * 100;
          const prevCentury = currentCentury + 100; // Moving backward means larger absolute value

          const prevHistorical = -prevCentury;
          const prevAstro = this.historicalToAstronomical(prevHistorical);
          return { yf: prevAstro, days: this.daysBetween(prevAstro, fromAstro) };
        } else {
          const currentCentury = Math.ceil(fromHistorical / 100) * 100;
          const prevCentury = currentCentury - 100;
          const prevAstro = prevCentury <= 0 ? -99 : prevCentury;
          return { yf: prevAstro, days: this.daysBetween(prevAstro, fromAstro) };
        }
      }

      case 'Milennium': {
        // Move to the previous millennium boundary
        if (fromHistorical === 1) {
          // From 1 CE to 1000 BCE (astronomical -999)
          return { yf: -999, days: this.daysBetween(-999, 1) };
        } else if (isBCE) {
          const absHistorical = Math.abs(fromHistorical);
          const currentMilennium = Math.ceil(absHistorical / 1000) * 1000;
          const prevMilennium = currentMilennium + 1000; // Moving backward means larger absolute value

          const prevHistorical = -prevMilennium;
          const prevAstro = this.historicalToAstronomical(prevHistorical);
          return { yf: prevAstro, days: this.daysBetween(prevAstro, fromAstro) };
        } else {
          const currentMilennium = Math.ceil(fromHistorical / 1000) * 1000;
          const prevMilennium = currentMilennium - 1000;
          const prevAstro = prevMilennium <= 0 ? -999 : prevMilennium;
          return { yf: prevAstro, days: this.daysBetween(prevAstro, fromAstro) };
        }
      }

      default:
        return { yf: fromYf - 1, days: 365 };
    }
  }

  /**
   * Calculate the actual number of days between two astronomical year fractions.
   * This accounts for leap years and the fact that year 0 (1 BCE) exists in astronomical system.
   */
  private daysBetween(fromYf: number, toYf: number): number {
    const start = Math.min(fromYf, toYf);
    const end = Math.max(fromYf, toYf);

    let totalDays = 0;
    let y = Math.floor(start);

    while (y < Math.floor(end)) {
      totalDays += this.daysInYear(y);
      y++;
    }

    return Math.abs(totalDays);
  }

  // Reimplement the formatLabelByUnit logic here so callers can get formatted labels
  formatLabelByUnit(yf: number, unit: number): string {
    const isBCE = yf < 0;
    const calYear = yf >= 0 ? Math.floor(yf) : Math.ceil(yf);
    let diy = this.daysInYear(calYear);

    // DAY tier detection
    const isDayTier =
      Math.abs(unit - 1 / diy) < 1e-7 ||
      Math.abs(unit - 1 / 365) < 1e-7 ||
      this.isApproximatelyEqual(unit, 1 / this.MEAN_YEAR, 0.02);

    if (isDayTier) {
      // Derive day within the correct astronomical year using floor decomposition (works for BCE too)
      const yr = Math.floor(yf);
      const diy0 = this.daysInYear(yr);
      let dayOfYear = Math.floor((yf - yr) * diy0 + 1e-9);
      if (dayOfYear < 0) dayOfYear = 0;
      if (dayOfYear >= diy0) dayOfYear = diy0 - 1;
      const md = [31, this.isLeapYear(yr) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
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

      // Convert astronomical year to historical year for display using yr
      const historicalYear = this.astronomicalToHistorical(yr);
      const absYear = Math.abs(historicalYear);
      const tail2 = historicalYear < 0 ? ' B.C.E.' : ' C.E.';
      // Compute weekday using proleptic Gregorian anchored to 1970-01-01 (Thursday)
      const weekdayIdx = this.weekdayFromYMD(yr, mi, day);
      const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const weekday = weekdays[weekdayIdx];
      return `${weekday}, ${months2[mi]} ${day}, ${absYear}${tail2}`;
    }

    if (this.isApproximatelyEqual(unit, 7 / this.MEAN_YEAR, 0.02)) {
      // Anchor labels to Sunday-start week boundaries
      const idx = this.dayIndexFromYf(yf);
      const w = this.weekdayFromYf(yf); // 0=Sun..6=Sat
      const deltaToStart = (w - 0 + 7) % 7;
      const weekStartIdx = idx - deltaToStart;
      const yfWeekStart = this.yfFromDayIndex(weekStartIdx);
      const yr = Math.floor(yfWeekStart);
      const diy = this.daysInYear(yr);
      const dayOfYear = Math.floor((yfWeekStart - yr) * diy);
      return this.labelFromDayOfYear(yr, dayOfYear);
    }

    if (Math.abs(unit - 1 / 12) < 1e-7) {
      // Derive month index from actual day-of-year to ensure consistency in BCE
      const yr0 = Math.floor(yf);
      const diy0 = this.daysInYear(yr0);
      const frac0 = yf - yr0;
      // Add tiny epsilon so exact month-boundary yfs label the new month, not the prior one
      let dayOfYear0 = Math.floor(frac0 * diy0 + 1e-9);
      if (dayOfYear0 < 0) dayOfYear0 = 0; // safety
      if (dayOfYear0 >= diy0) dayOfYear0 = diy0 - 1;

      const md = [31, this.isLeapYear(yr0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
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
      let mi = 0,
        dleft = dayOfYear0;
      while (mi < 12) {
        if (dleft < md[mi]) break;
        dleft -= md[mi];
        mi++;
      }
      if (mi > 11) mi = 11;

      const historicalYear = this.astronomicalToHistorical(yr0);
      const absYear = Math.abs(historicalYear);
      const tail = historicalYear < 0 ? ' B.C.E.' : ' C.E.';
      return `${months[mi]} ${absYear}${tail}`;
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

  // Compute weekday index (0=Sun..6=Sat) from astronomical Y, month index (0..11), day-of-month (1..31)
  private weekdayFromYMD(year: number, monthIndex0: number, day: number): number {
    // Zeller's congruence for Gregorian calendar
    let m = monthIndex0 + 1; // 1..12
    let Y = year;
    if (m <= 2) {
      m += 12; // Jan/Feb as 13/14 of previous year
      Y -= 1;
    }
    const q = day; // day of month
    const K = ((Y % 100) + 100) % 100; // year of century, positive modulo
    const J = Math.floor(Y / 100); // zero-based century (can be negative)
    const h =
      (q + Math.floor((13 * (m + 1)) / 5) + K + Math.floor(K / 4) + Math.floor(J / 4) + 5 * J) % 7;
    // h: 0=Saturday, 1=Sunday, 2=Monday, ..., 6=Friday
    const weekdaySun0 = (h + 6) % 7; // convert to 0=Sun..6=Sat
    return weekdaySun0;
  }

  // ---------- Absolute day indexing helpers (exact boundary stepping) ----------
  // Cumulative days from astronomical year 0 to start of astronomical year y
  private cumulativeDaysToYear(y: number): number {
    if (y === 0) return 0;
    let total = 0;
    if (y > 0) {
      for (let yy = 0; yy < y; yy++) total += this.daysInYear(yy);
    } else {
      for (let yy = -1; yy >= y; yy--) total -= this.daysInYear(yy);
    }
    return total;
  }

  // Convert fractional astronomical year to absolute day index (integer, start-of-day)
  private dayIndexFromYf(yf: number): number {
    const yr = Math.floor(yf);
    const diy = this.daysInYear(yr);
    const frac = yf - yr;
    // Add tiny epsilon so exact boundary values produced by yfFromDayIndex
    // map back to the same integer day (avoid off-by-one due to FP underflow)
    const dayOfYear = Math.floor(frac * diy + 1e-9);
    return this.cumulativeDaysToYear(yr) + dayOfYear;
  }

  // Convert absolute day index back to fractional astronomical year at start-of-day
  private yfFromDayIndex(dayIndex: number): number {
    // Find astronomical year containing this day index
    // Walk years forward/backward; steps are small in our use (week/day stepping)
    if (dayIndex === 0) return 0; // start of year 0

    // Choose a starting guess near current year 0 and walk
    let y = 0;
    let cum = 0;
    if (dayIndex > 0) {
      while (true) {
        const diy = this.daysInYear(y);
        if (dayIndex < cum + diy) {
          const dayOfYear = dayIndex - cum;
          return y + dayOfYear / diy;
        }
        cum += diy;
        y++;
      }
    } else {
      // dayIndex < 0, walk backwards into negative years
      y = -1;
      cum = -this.daysInYear(y); // cumulative days to start of year y
      while (true) {
        const diy = this.daysInYear(y);
        // For negative cum, dayIndex in [cum, cum + diy)
        if (dayIndex >= cum) {
          const dayOfYear = dayIndex - cum;
          return y + dayOfYear / diy;
        }
        y--;
        cum -= this.daysInYear(y);
      }
    }
  }

  // Compute weekday (0=Sun..6=Sat) directly from a year fraction
  private weekdayFromYf(yf: number): number {
    const yr = Math.floor(yf);
    const diy = this.daysInYear(yr);
    // Add tiny epsilon to stabilize exact-boundary values
    let dayOfYear = Math.floor((yf - yr) * diy + 1e-9);
    if (dayOfYear < 0) dayOfYear = 0;
    if (dayOfYear >= diy) dayOfYear = diy - 1;
    const feb = diy === 366 ? 29 : 28;
    const md = [31, feb, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let mi = 0,
      dleft = dayOfYear;
    while (mi < 12 && dleft >= md[mi]) {
      dleft -= md[mi];
      mi++;
    }
    if (mi > 11) mi = 11;
    const day = dleft + 1;
    return this.weekdayFromYMD(yr, mi, day);
  }
}
