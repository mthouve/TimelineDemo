import { Injectable } from '@angular/core';
import { TIMELINE_POINTS, TimelinePoint } from '../data/timeline-points';
import { BIBLE_TIMELINE_ANCHORS, BibleTimelineAnchor } from '../data/bible-timeline-anchors';
import { TimelineEntry } from '../models/timeline-entry.model';
import { TimelineDateService } from './timeline-date.service';

@Injectable({
  providedIn: 'root',
})
export class TimelineEntryService {
  private readonly entries: TimelineEntry[];

  constructor(private dateService: TimelineDateService) {
    this.entries = this.buildEntries(TIMELINE_POINTS, BIBLE_TIMELINE_ANCHORS);
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

  searchEntries(query: string, limit = 8): TimelineEntry[] {
    const terms = this.normalizeSearchText(query).split(' ').filter(Boolean);
    if (!terms.length) return [];

    return this.entries
      .map((entry) => ({ entry, score: this.scoreEntry(entry, terms) }))
      .filter((match) => match.score > 0)
      .sort((a, b) => b.score - a.score || a.entry.yf - b.entry.yf)
      .slice(0, limit)
      .map((match) => match.entry);
  }

  private buildEntries(
    points: Record<string, TimelinePoint>,
    bibleAnchors: BibleTimelineAnchor[]
  ): TimelineEntry[] {
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

    for (const anchor of bibleAnchors) {
      const { yf, yearOnly } = this.dateService.yearParseWithFlag(anchor.dateLabel);
      if (isNaN(yf)) continue;

      const uncertainty = anchor.uncertaintyYears
        ? ` Approximate anchor (+/- ${anchor.uncertaintyYears} years).`
        : ' Approximate anchor.';

      entries.push({
        label: anchor.dateLabel,
        when: `${anchor.title}.${uncertainty}`,
        yf,
        yearOnly,
        drawYf: yearOnly ? this.dateService.startOfYearInt(yf) : yf,
        localTimeHours: anchor.localTimeHours,
        location: anchor.location,
        sources: [
          {
            type: 'bible',
            title: `${anchor.book} ${anchor.chapter}`,
            label: 'Bible',
            reference: `${anchor.book} ${anchor.chapter}`,
          },
        ],
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

  private scoreEntry(entry: TimelineEntry, terms: string[]): number {
    const haystack = this.searchHaystack(entry);
    let score = 0;

    for (const term of terms) {
      if (entry.label.toLowerCase().includes(term)) score += 6;
      if (entry.location?.name && this.normalizeSearchText(entry.location.name).includes(term)) {
        score += 5;
      }
      if (haystack.includes(term)) score += 1;
      else return 0;
    }

    return score;
  }

  private searchHaystack(entry: TimelineEntry): string {
    return this.normalizeSearchText(
      [
        entry.label,
        entry.when,
        entry.location?.name,
        entry.location?.lat,
        entry.location?.lon,
        ...(entry.sources ?? []).flatMap((source) => [
          source.title,
          source.label,
          source.reference,
          source.url,
        ]),
      ]
        .filter((part) => part != null)
        .join(' ')
    );
  }

  private normalizeSearchText(value: unknown): string {
    return String(value ?? '')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }
}
