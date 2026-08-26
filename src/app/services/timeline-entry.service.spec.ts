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
});
