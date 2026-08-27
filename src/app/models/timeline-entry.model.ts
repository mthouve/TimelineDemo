import { TimelinePointLocation, TimelineSource } from '../data/timeline-points';

export interface TimelineEntry {
  label: string;
  when: string;
  yf: number;
  yearOnly: boolean;
  drawYf: number;
  isPrimary: boolean;
  localTimeHours?: number;
  location?: TimelinePointLocation;
  sources?: TimelineSource[];
}
