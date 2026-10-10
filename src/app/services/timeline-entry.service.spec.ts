import { TestBed } from '@angular/core/testing';
import { TimelineEntryService } from './timeline-entry.service';

describe('TimelineEntryService', () => {
  let service: TimelineEntryService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TimelineEntryService);
  });

  it('should build timeline entries in chronological order', () => {
    const entries = service.getEntries();

    expect(entries.length).toBeGreaterThan(0);
    for (let i = 1; i < entries.length; i++) {
      expect(entries[i].yf).toBeGreaterThanOrEqual(entries[i - 1].yf);
    }
  });

  it('should expose a lower bound index for drawing windows', () => {
    const entries = service.getEntries();
    const target = entries[Math.floor(entries.length / 2)].drawYf;
    const index = service.lowerBoundByDrawYf(target);

    expect(index).toBeGreaterThanOrEqual(0);
    expect(index).toBeLessThan(entries.length);
    expect(entries[index].drawYf).toBeGreaterThanOrEqual(target);
    if (index > 0) {
      expect(entries[index - 1].drawYf).toBeLessThan(target);
    }
  });

  it('should return only entries inside a requested year radius', () => {
    const centerYf = 1;
    const radiusYears = 10;
    const entries = service.getEntriesNearYear(centerYf, radiusYears);

    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      expect(Math.abs(entry.yf - centerYf)).toBeLessThanOrEqual(radiusYears);
    }
  });

  it('should search timeline entries by location and description text', () => {
    const results = service.searchEntries('megiddo josiah');

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].location?.name).toContain('Megiddo');
  });

  it('should include Bible timeline anchors in the indexed timeline range', () => {
    const results = service.searchEntries('Abram Haran');

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].label).toBe('2091 B.C.E.');
    expect(results[0].location?.name).toBe('Haran region');
  });

  it('should return no search results for unrelated terms', () => {
    expect(service.searchEntries('notarealtimelineevent')).toEqual([]);
  });
});
