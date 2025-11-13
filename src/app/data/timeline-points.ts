export interface TimelinePointLocation {
  lat: number;
  lon: number;
  name?: string;
}

export interface TimelinePoint {
  description: string;
  location?: TimelinePointLocation;
}

export const TIMELINE_POINTS: Record<string, TimelinePoint> = {
  'January 1, 150 B.C.E.': { 
    description: 'Something happened on this date.',
  },
  '1 B.C.E.': { 
    description: 'A very important event happened this year.',
    location: { lat: 31.7683, lon: 35.2137, name: 'Jerusalem' }
  },
  '1 C.E.': { 
    description: 'This was the beginning of the Common Era.',
    location: { lat: 31.7683, lon: 35.2137, name: 'Jerusalem' }
  },
  '10 C.E.': { 
    description: 'Did you know? Something interesting happened in 10 C.E.',
  },
  '100 C.E.': { 
    description: 'Wait until you hear about what happened in 100 C.E.!',
  },
  'February 27, 501 C.E.': { 
    description: 'Believe it or not, something happened on this day.',
  },
  'February 28, 501 C.E.': { 
    description: 'Another event occurred on this date.',
  },
  'February 28, 2024 C.E.': { 
    description: 'A truly remarkable event took place on this day.',
  },
  'February 29, 2024 C.E.': { 
    description: 'Discover the significance of this leap day event!',
  },
  '1000 C.E.': { 
    description: 'What a millennium! Something noteworthy happened this year.',
  },
  '2000 C.E.': { 
    description: 'Tragic events unfolded in this year.',
  },
  'June 1, 2025 C.E.': { 
    description: 'On this day, something extraordinary occurred.',
  },
  'September 30, 2025 C.E.': { 
    description: 'This is when something memorable happened.',
  },
  '2050 C.E.': { 
    description: 'In the future, something incredible is set to happen this year.',
  },
  '2060 C.E.': { 
    description: 'Resurrection of the dead - 1 Cor 15:22-24',
  },
};
