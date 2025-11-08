import { Injectable } from '@angular/core';

export type ZoomSpec = {
  id: string;
  name: string;
  unit: number;
};

@Injectable({
  providedIn: 'root'
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

  private readonly TIMELINE_POINTS: Record<string, string> = {
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

  constructor() {}

  getZoomLevels(): ZoomSpec[] {
    return this.zoomLevels;
  }

  getZoomLabels(): string[] {
    return this.zoomLabels;
  }

  getTimelinePoints(): Record<string, string> {
    return this.TIMELINE_POINTS;
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
}