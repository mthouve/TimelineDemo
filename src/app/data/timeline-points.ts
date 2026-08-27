export interface TimelinePointLocation {
  lat: number;
  lon: number;
  name?: string;
}

export interface TimelineSource {
  type: 'youtube' | 'link' | 'bible';
  title: string;
  label: string;
  youtubeId?: string;
  reference?: string;
  url?: string;
}

export interface TimelinePoint {
  description: string;
  location?: TimelinePointLocation;
  sources?: TimelineSource[];
}

export const TIMELINE_POINTS: Record<string, TimelinePoint> = {
  '609 B.C.E.': {
    description: 'Battle of Megiddo: Pharaoh Necho II of Egypt defeats King Josiah of Judah.',
    location: { lat: 32.35, lon: 35.11, name: 'Megiddo, Judah (Israel)' },
    sources: [
      {
        type: 'youtube',
        title:
          "The Egyptian Army at Megiddo: A New Archaeological Window Into King Josiah's Last Stand",
        label: 'Watch video',
        youtubeId: 'd6wPX02JR0c',
      },
      {
        type: 'link',
        title: 'Wikipedia: Battle of Megiddo (609 BC)',
        label: 'Wikipedia',
        url: 'https://en.wikipedia.org/wiki/Battle_of_Megiddo_(609_BC)',
      },
    ],
  },
  '600 B.C.E.': {
    description: 'The oldest known map was created around this time.',
    location: { lat: 33.0332, lon: 44.1508, name: 'Sippar, Baghdad vilayet (Iraq)' },
    sources: [
      {
        type: 'youtube',
        title: 'History of the Oldest Map',
        label: 'Watch video',
        youtubeId: 'LUxFzh8r384',
      },
      {
        type: 'link',
        title: 'Wikipedia: Babylonian Map of the World',
        label: 'Wikipedia',
        url: 'https://en.wikipedia.org/wiki/Babylonian_Map_of_the_World',
      },
      {
        type: 'link',
        title: 'British Museum Exhibit',
        label: 'Museum',
        url: 'https://www.britishmuseum.org/collection/object/W_1984-1007-1',
      },
    ],
  },
  '599 B.C.E.': {
    description:
      'Approximate global context marker: Chavin de Huantar was an active ceremonial and pilgrimage center in the Andean highlands.',
    location: { lat: -9.5938, lon: -77.1772, name: 'Chavin de Huantar, Peru' },
    sources: [
      {
        type: 'link',
        title: 'UNESCO: Chavin Archaeological Site',
        label: 'UNESCO',
        url: 'https://whc.unesco.org/en/list/330/',
      },
      {
        type: 'link',
        title: 'Smarthistory: Chavin de Huantar',
        label: 'Smarthistory',
        url: 'https://smarthistory.org/chavin-de-huantar/',
      },
    ],
  },
  '598 B.C.E.': {
    description:
      'Approximate global context marker: La Venta remained a major Olmec ceremonial center in Mesoamerica.',
    location: { lat: 18.103, lon: -94.041, name: 'La Venta, Tabasco, Mexico' },
    sources: [
      {
        type: 'link',
        title: 'Wikipedia: La Venta',
        label: 'Wikipedia',
        url: 'https://en.wikipedia.org/wiki/La_Venta',
      },
      {
        type: 'link',
        title: 'Wikipedia: Olmec',
        label: 'Wikipedia',
        url: 'https://en.wikipedia.org/wiki/Olmecs',
      },
    ],
  },
  '597 B.C.E.': {
    description:
      'Approximate global context marker: Paracas communities were developing along the south coast of Peru.',
    location: { lat: -13.8667, lon: -76.2667, name: 'Paracas Peninsula, Peru' },
    sources: [
      {
        type: 'link',
        title: 'Wikipedia: Paracas culture',
        label: 'Wikipedia',
        url: 'https://en.wikipedia.org/wiki/Paracas_culture',
      },
    ],
  },
  '596 B.C.E.': {
    description:
      'Approximate global context marker: Chavin artistic and religious influence was spreading through coastal and highland Peru.',
    location: { lat: -12.0464, lon: -77.0428, name: 'Central coast of Peru' },
    sources: [
      {
        type: 'link',
        title: 'OpenStax: Early Cultures and Civilizations in the Americas',
        label: 'OpenStax',
        url: 'https://openstax.org/books/world-history-volume-1/pages/8-2-early-cultures-and-civilizations-in-the-americas',
      },
    ],
  },
  'c. 7 B.C.E.': {
    description: 'Announcement of Birth of John at the Temple (Luke 1:5-25).',
    location: { lat: 31.464, lon: 35.1408, name: 'Jerusalem' },
    sources: [
      {
        type: 'bible',
        title: 'Luke 1:5-25',
        label: 'Bible',
        reference: 'Luke 1:5-25',
      },
    ],
  },
  'c. 6 B.C.E.': {
    description:
      'Announcement of Birth of Jesus to Mary while in Nazareth (Luke 1:26-38). Foretold in Isaiah 7:14.',
    location: { lat: 32.4207, lon: 35.1812, name: 'Nazareth' },
    sources: [
      {
        type: 'bible',
        title: 'Luke 1:26-38',
        label: 'Bible',
        reference: 'Luke 1:26-38',
      },
    ],
  },
  'c. 27 C.E.': {
    description:
      "Jesus heals a paralytic (Luke 5:17-26, John 5:1-15). Foretold in Isaiah 35:5-6. Rediscovered during the repairs in 1888 near St. Anne's Church in Jerusalem.",
    location: { lat: 31.4653, lon: 35.1409, name: 'Old City of Jerusalem' },
    sources: [
      {
        type: 'youtube',
        title: 'Did Archaeologists Just Find Evidence of a Miracle by Jesus?!',
        label: 'YouTube',
        youtubeId: 'lX4GJ_zmwTE',
      },
      {
        type: 'link',
        title: 'Pool of Bethesda',
        label: 'Wikipedia',
        url: 'https://en.wikipedia.org/wiki/Pool_of_Bethesda',
      },
      {
        type: 'bible',
        title: 'Luke 5:17-26',
        label: 'Bible',
        reference: 'Luke 5:17-26',
      },
    ],
  },
  '1 B.C.E.': {
    description: 'A very important event happened this year.',
    location: { lat: 31.7683, lon: 35.2137, name: 'Jerusalem' },
    sources: [
      {
        type: 'link',
        title: '1 BC',
        label: 'Wikipedia',
        url: 'https://en.wikipedia.org/wiki/1_BC',
      },
    ],
  },
  '1 C.E.': {
    description: 'This was the beginning of the Common Era.',
    location: { lat: 31.7683, lon: 35.2137, name: 'Jerusalem' },
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
