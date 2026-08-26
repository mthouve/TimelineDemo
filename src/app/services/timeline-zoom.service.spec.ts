import { TestBed } from '@angular/core/testing';
import { ZoomSpec } from './timeline-date.service';
import { TimelineZoomService } from './timeline-zoom.service';

describe('TimelineZoomService', () => {
  let service: TimelineZoomService;

  const zoomLevels: ZoomSpec[] = [
    { id: 'day', name: 'Day', unit: 1 / 365.2425 },
    { id: 'week', name: 'Week', unit: 7 / 365.2425 },
    { id: 'month', name: 'Month', unit: 1 / 12 },
    { id: 'year', name: 'Year', unit: 1 },
    { id: 'decade', name: 'Decade', unit: 10 },
    { id: 'century', name: 'Century', unit: 100 },
    { id: 'millennium', name: 'Millennium', unit: 1000 },
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TimelineZoomService);
  });

  it('should create a one-step animation with the single-step duration', () => {
    const state = service.createAnimation({
      startIdx: 3,
      endIdx: 4,
      keepYear: 1,
      zoomLevels,
      durationSingleStepMs: 4000,
      durationAcrossAllMs: 10000,
      nowMs: 100,
    });

    expect(state.dur).toBe(4000);
    expect(state.startUnit).toBe(1);
    expect(state.endUnit).toBe(10);
    expect(state.hudFromIdx).toBe(3);
    expect(state.hudToIdx).toBe(4);
    expect(state.unitsSeq).toEqual([1, 10]);
  });

  it('should scale duration for jumps across all zoom levels', () => {
    const state = service.createAnimation({
      startIdx: 0,
      endIdx: 6,
      keepYear: 1,
      zoomLevels,
      durationSingleStepMs: 4000,
      durationAcrossAllMs: 10000,
      nowMs: 100,
    });

    expect(state.dur).toBe(10000);
    expect(state.unitsSeq?.length).toBe(7);
  });

  it('should report the first frame at the starting zoom level', () => {
    const state = service.createAnimation({
      startIdx: 3,
      endIdx: 4,
      keepYear: 1,
      zoomLevels,
      durationSingleStepMs: 4000,
      durationAcrossAllMs: 10000,
      nowMs: 100,
    });

    const frame = service.getFrame(state, 100);

    expect(frame.unitYears).toBeCloseTo(1, 8);
    expect(frame.fromIdx).toBe(3);
    expect(frame.toIdx).toBe(4);
    expect(frame.fadeFrom).toBe(1);
    expect(frame.fadeTo).toBe(0);
    expect(frame.visualIndex).toBe(3);
    expect(frame.liveIdx).toBe(3);
    expect(frame.done).toBeFalse();
  });

  it('should report the final frame at the target zoom level', () => {
    const state = service.createAnimation({
      startIdx: 3,
      endIdx: 4,
      keepYear: 1,
      zoomLevels,
      durationSingleStepMs: 4000,
      durationAcrossAllMs: 10000,
      nowMs: 100,
    });

    const frame = service.getFrame(state, 4100);

    expect(frame.unitYears).toBeCloseTo(10, 8);
    expect(frame.fadeFrom).toBe(0);
    expect(frame.fadeTo).toBe(1);
    expect(frame.visualIndex).toBe(4);
    expect(frame.liveIdx).toBe(4);
    expect(frame.done).toBeTrue();
  });
});
