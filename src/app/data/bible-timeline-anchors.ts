export type BibleTimelineAnchorViewScale = 'global' | 'regional' | 'local';

export interface BibleTimelineAnchor {
  id: string;
  book: string;
  chapter: number;
  title: string;
  dateLabel: string;
  uncertaintyYears?: number;
  location: {
    lat: number;
    lon: number;
    name: string;
  };
  localTimeHours?: number;
  viewScale?: BibleTimelineAnchorViewScale;
}

export const BIBLE_TIMELINE_ANCHORS: BibleTimelineAnchor[] = [
  {
    id: 'genesis-12-abram-called',
    book: 'Genesis',
    chapter: 12,
    title: 'Abram called from Haran toward Canaan',
    dateLabel: '2091 B.C.E.',
    uncertaintyYears: 40,
    location: { lat: 36.8667, lon: 39.0333, name: 'Haran region' },
    localTimeHours: 12,
    viewScale: 'regional',
  },
  {
    id: 'genesis-13-abram-bethel-ai',
    book: 'Genesis',
    chapter: 13,
    title: 'Abram near Bethel and Ai',
    dateLabel: '2090 B.C.E.',
    uncertaintyYears: 40,
    location: { lat: 31.93, lon: 35.22, name: 'Bethel highlands' },
    localTimeHours: 12,
    viewScale: 'regional',
  },
  {
    id: 'genesis-14-abram-rescues-lot',
    book: 'Genesis',
    chapter: 14,
    title: 'Abram pursues the eastern kings',
    dateLabel: '2089 B.C.E.',
    uncertaintyYears: 40,
    location: { lat: 33.246, lon: 35.652, name: 'Dan region' },
    localTimeHours: 12,
    viewScale: 'regional',
  },
  {
    id: 'genesis-18-mamre',
    book: 'Genesis',
    chapter: 18,
    title: 'The LORD appears to Abraham by Mamre',
    dateLabel: '2067 B.C.E.',
    uncertaintyYears: 40,
    location: { lat: 31.5326, lon: 35.0998, name: 'Hebron / Mamre' },
    localTimeHours: 12,
    viewScale: 'regional',
  },
  {
    id: 'genesis-21-isaac-born',
    book: 'Genesis',
    chapter: 21,
    title: 'Isaac born to Abraham and Sarah',
    dateLabel: '2066 B.C.E.',
    uncertaintyYears: 40,
    location: { lat: 31.2439, lon: 34.8409, name: 'Beersheba region' },
    localTimeHours: 12,
    viewScale: 'regional',
  },
  {
    id: 'genesis-22-moriah',
    book: 'Genesis',
    chapter: 22,
    title: 'Abraham goes to the land of Moriah',
    dateLabel: '2050 B.C.E.',
    uncertaintyYears: 40,
    location: { lat: 31.778, lon: 35.2354, name: 'Jerusalem / Moriah' },
    localTimeHours: 12,
    viewScale: 'regional',
  },
];
