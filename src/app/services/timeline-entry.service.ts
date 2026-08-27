import { Injectable } from '@angular/core';
import { TIMELINE_POINTS, TimelinePoint } from '../data/timeline-points';
import { TimelineEntry } from '../models/timeline-entry.model';
import { TimelineDateService } from './timeline-date.service';

@Injectable({
  providedIn: 'root',
})
export class TimelineEntryService {
  private readonly entries: TimelineEntry[];

  constructor(private dateService: TimelineDateService) {
    this.entries = this.buildEntries(TIMELINE_POINTS);
  }

  getEntries(): TimelineEntry[] {
    return this.entries;
  }

  lowerBoundByYf(target: number): number {
    return this.lowerBound(target, (entry) => entry.yf);
  }

  lowerBoundByDrawYf(target: number): number {
    return this.lowerBound(target, (entry) => entry.drawYf);
  }

  getEntriesNearYear(centerYf: number, radiusYears: number): TimelineEntry[] {
    const start = this.lowerBoundByYf(centerYf - radiusYears);
    const end = this.lowerBoundByYf(centerYf + radiusYears + Number.EPSILON);
    return this.entries.slice(start, end);
  }

  private buildEntries(points: Record<string, TimelinePoint>): TimelineEntry[] {
    const entries: TimelineEntry[] = [];

    for (const key of Object.keys(points)) {
      const point = points[key];
      const { yf, yearOnly } = this.dateService.yearParseWithFlag(key);
      if (isNaN(yf)) continue;

      entries.push({
        label: key,
        when: point.description,
        yf,
        yearOnly,
        drawYf: yearOnly ? this.dateService.startOfYearInt(yf) : yf,
        localTimeHours: point.localTimeHours,
        location: point.location,
        sources: point.sources,
        isPrimary: false,
      });
    }

    entries.sort((a, b) => a.yf - b.yf);
    return entries;
  }

  private lowerBound(target: number, valueFor: (entry: TimelineEntry) => number): number {
    let lo = 0;
    let hi = this.entries.length;

    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (valueFor(this.entries[mid]) < target) lo = mid + 1;
      else hi = mid;
    }

    return lo;
  }
}
