export type SolarEclipseType = 'partial' | 'annular' | 'total' | 'hybrid';

export interface GeoPoint {
  lat: number;
  lon: number;
}

export interface NasaSolarEclipsePathSample {
  timeUt: string;
  centralLine: GeoPoint;
  pathWidthKm: number;
  durationSeconds: number;
  sunAltitudeDeg?: number;
  sunAzimuthDeg?: number;
  moonSunDiameterRatio?: number;
}

export interface NasaSolarEclipseBesselianElements {
  t0TdtDecimalHours: number;
  greatestEclipseUt: string;
  julianDay: number;
  deltaTSeconds: number;
  gamma: number;
  magnitude: number;
  sarosSeries: number;
  lunarRadiusK1Penumbra: number;
  lunarRadiusK2Umbra: number;
  tanF1: number;
  tanF2: number;
  polynomialCoefficients: {
    x: number[];
    y: number[];
    d: number[];
    l1: number[];
    l2: number[];
    mu: number[];
  };
}

export interface NasaSolarEclipseReference {
  id: string;
  date: string;
  type: SolarEclipseType;
  title: string;
  source: {
    name: string;
    pathTableUrl: string;
    besselianElementsUrl: string;
  };
  ephemerides: string;
  pathTableDeltaTSeconds: number;
  greatestEclipse: {
    timeUt: string;
    location: GeoPoint;
    sunAltitudeDeg: number;
    sunAzimuthDeg: number;
    pathWidthKm: number;
    centralDurationSeconds: number;
  };
  besselian: NasaSolarEclipseBesselianElements;
  centralLineSamples: NasaSolarEclipsePathSample[];
  visibilitySummary: string;
}

export const NASA_SOLAR_ECLIPSES: NasaSolarEclipseReference[] = [
  {
    id: 'nasa-se-2027-08-02-total',
    date: '2027-08-02',
    type: 'total',
    title: 'Total Solar Eclipse of 2027 Aug 02',
    source: {
      name: "Fred Espenak, NASA's GSFC Eclipse Web Site",
      pathTableUrl: 'https://eclipse.gsfc.nasa.gov/SEpath/SEpath2001/SE2027Aug02Tpath.html',
      besselianElementsUrl: 'https://eclipse.gsfc.nasa.gov/SEsearch/SEdata.php?Ecl=20270802',
    },
    ephemerides: 'VSOP87/ELP2000',
    pathTableDeltaTSeconds: 71.7,
    greatestEclipse: {
      timeUt: '10:06:37.7',
      location: { lat: 25.505, lon: 33.183333 },
      sunAltitudeDeg: 81.7,
      sunAzimuthDeg: 202,
      pathWidthKm: 257.7,
      centralDurationSeconds: 382.6,
    },
    besselian: {
      t0TdtDecimalHours: 10,
      greatestEclipseUt: '10:06:34',
      julianDay: 2461619.922,
      deltaTSeconds: 76,
      gamma: 0.1421,
      magnitude: 1.079,
      sarosSeries: 136,
      lunarRadiusK1Penumbra: 0.272488,
      lunarRadiusK2Umbra: 0.272281,
      tanF1: 0.0046064,
      tanF2: 0.0045834,
      polynomialCoefficients: {
        x: [-0.019772, 0.5447123, -0.0000446, -0.0000092],
        y: [0.160061, -0.2111582, -0.0001217, 0.0000038],
        d: [17.7624702, -0.010181, -0.000004],
        l1: [0.530596, 0.0000138, -0.0000128],
        l2: [-0.015464, 0.0000137, -0.0000128],
        mu: [328.422546, 15.0021, 0],
      },
    },
    centralLineSamples: [
      {
        timeUt: '08:26',
        centralLine: { lat: 30.488333, lon: -36.233333 },
        moonSunDiameterRatio: 1.063,
        sunAltitudeDeg: 8,
        sunAzimuthDeg: 74,
        pathWidthKm: 213,
        durationSeconds: 204.6,
      },
      {
        timeUt: '08:40',
        centralLine: { lat: 35.243333, lon: -12.46 },
        moonSunDiameterRatio: 1.07,
        sunAltitudeDeg: 31,
        sunAzimuthDeg: 89,
        pathWidthKm: 232,
        durationSeconds: 270.3,
      },
      {
        timeUt: '09:00',
        centralLine: { lat: 35.476667, lon: 3.818333 },
        moonSunDiameterRatio: 1.074,
        sunAltitudeDeg: 48,
        sunAzimuthDeg: 104,
        pathWidthKm: 243,
        durationSeconds: 322.4,
      },
      {
        timeUt: '09:20',
        centralLine: { lat: 33.618333, lon: 15.08 },
        moonSunDiameterRatio: 1.077,
        sunAltitudeDeg: 61,
        sunAzimuthDeg: 117,
        pathWidthKm: 250,
        durationSeconds: 356.8,
      },
      {
        timeUt: '09:40',
        centralLine: { lat: 30.638333, lon: 23.808333 },
        moonSunDiameterRatio: 1.078,
        sunAltitudeDeg: 73,
        sunAzimuthDeg: 135,
        pathWidthKm: 255,
        durationSeconds: 376.7,
      },
      {
        timeUt: '10:00',
        centralLine: { lat: 26.888333, lon: 31.013333 },
        moonSunDiameterRatio: 1.079,
        sunAltitudeDeg: 81,
        sunAzimuthDeg: 177,
        pathWidthKm: 257,
        durationSeconds: 383.2,
      },
      {
        timeUt: '10:06',
        centralLine: { lat: 25.638333, lon: 32.98 },
        moonSunDiameterRatio: 1.079,
        sunAltitudeDeg: 82,
        sunAzimuthDeg: 199,
        pathWidthKm: 258,
        durationSeconds: 382.7,
      },
      {
        timeUt: '10:20',
        centralLine: { lat: 22.513333, lon: 37.351667 },
        moonSunDiameterRatio: 1.079,
        sunAltitudeDeg: 79,
        sunAzimuthDeg: 247,
        pathWidthKm: 259,
        durationSeconds: 377.5,
      },
      {
        timeUt: '10:40',
        centralLine: { lat: 17.533333, lon: 43.383333 },
        moonSunDiameterRatio: 1.078,
        sunAltitudeDeg: 69,
        sunAzimuthDeg: 274,
        pathWidthKm: 259,
        durationSeconds: 360.8,
      },
      {
        timeUt: '11:00',
        centralLine: { lat: 11.851667, lon: 49.768333 },
        moonSunDiameterRatio: 1.076,
        sunAltitudeDeg: 57,
        sunAzimuthDeg: 284,
        pathWidthKm: 257,
        durationSeconds: 334,
      },
      {
        timeUt: '11:20',
        centralLine: { lat: 5.138333, lon: 57.651667 },
        moonSunDiameterRatio: 1.073,
        sunAltitudeDeg: 43,
        sunAzimuthDeg: 290,
        pathWidthKm: 251,
        durationSeconds: 296.3,
      },
      {
        timeUt: '11:40',
        centralLine: { lat: -3.906667, lon: 70.86 },
        moonSunDiameterRatio: 1.068,
        sunAltitudeDeg: 23,
        sunAzimuthDeg: 291,
        pathWidthKm: 233,
        durationSeconds: 241.1,
      },
    ],
    visibilitySummary:
      'Total path crosses the Atlantic, North Africa, Egypt, the Red Sea region, Yemen, Somalia, and the Indian Ocean; broader partial visibility includes Europe, the Middle East, and western/southern Asia.',
  },
];

export function findNasaSolarEclipseByDate(date: string): NasaSolarEclipseReference | undefined {
  return NASA_SOLAR_ECLIPSES.find((eclipse) => eclipse.date === date);
}

