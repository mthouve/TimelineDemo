import {
  findNasaSolarEclipseByDate,
  interpolateNasaSolarEclipsePathSample,
  NASA_SOLAR_ECLIPSES,
} from './nasa-solar-eclipses';

describe('NASA solar eclipse reference data', () => {
  it('includes the 2027 Aug 02 total solar eclipse reference', () => {
    const eclipse = findNasaSolarEclipseByDate('2027-08-02');

    expect(eclipse).toBeTruthy();
    expect(eclipse?.type).toBe('total');
    expect(eclipse?.besselian.sarosSeries).toBe(136);
    expect(eclipse?.besselian.magnitude).toBeCloseTo(1.079, 3);
    expect(eclipse?.besselian.gamma).toBeCloseTo(0.1421, 4);
  });

  it('anchors the 2027 Aug 02 greatest eclipse near Egypt, not southern Africa', () => {
    const eclipse = findNasaSolarEclipseByDate('2027-08-02');
    expect(eclipse).toBeTruthy();

    const greatest = eclipse!.greatestEclipse.location;
    expect(greatest.lat).toBeCloseTo(25.505, 3);
    expect(greatest.lon).toBeCloseTo(33.183333, 3);
    expect(greatest.lat).toBeGreaterThan(20);
    expect(greatest.lon).toBeGreaterThan(25);
    expect(greatest.lon).toBeLessThan(40);
  });

  it('keeps the sampled central line in chronological order from west to east', () => {
    const eclipse = findNasaSolarEclipseByDate('2027-08-02')!;
    expect(eclipse.centralLineSamples.length).toBeGreaterThan(4);

    for (let i = 1; i < eclipse.centralLineSamples.length; i++) {
      const prev = eclipse.centralLineSamples[i - 1];
      const current = eclipse.centralLineSamples[i];
      expect(minutesFromUt(current.timeUt)).toBeGreaterThan(minutesFromUt(prev.timeUt));
      expect(current.centralLine.lon).toBeGreaterThan(prev.centralLine.lon);
    }
  });

  it('provides a close central-line sample for NASA greatest eclipse', () => {
    const eclipse = findNasaSolarEclipseByDate('2027-08-02')!;
    const nearest = eclipse.centralLineSamples.reduce((best, sample) => {
      const distance = greatCircleDistanceKm(sample.centralLine, eclipse.greatestEclipse.location);
      return distance < best.distanceKm ? { sample, distanceKm: distance } : best;
    }, { sample: eclipse.centralLineSamples[0], distanceKm: Number.POSITIVE_INFINITY });

    expect(nearest.sample.timeUt).toBe('10:06');
    expect(nearest.distanceKm).toBeLessThan(35);
  });

  it('exposes Besselian polynomial coefficients for model validation', () => {
    const eclipse = NASA_SOLAR_ECLIPSES[0];

    expect(eclipse.besselian.t0TdtDecimalHours).toBe(10);
    expect(eclipse.besselian.julianDay).toBeCloseTo(2461619.922, 6);
    expect(eclipse.besselian.polynomialCoefficients.x).toEqual([
      -0.019772,
      0.5447123,
      -0.0000446,
      -0.0000092,
    ]);
    expect(eclipse.besselian.polynomialCoefficients.y).toEqual([
      0.160061,
      -0.2111582,
      -0.0001217,
      0.0000038,
    ]);
  });

  it('interpolates the 2027 Aug 02 eclipse path along northern Africa', () => {
    const sample = interpolateNasaSolarEclipsePathSample('2027-08-02', 9 * 60 + 50);

    expect(sample).toBeTruthy();
    expect(sample!.location.lat).toBeGreaterThan(28);
    expect(sample!.location.lat).toBeLessThan(30);
    expect(sample!.location.lon).toBeGreaterThan(27);
    expect(sample!.location.lon).toBeLessThan(28);
    expect(sample!.pathWidthKm).toBeCloseTo(256, 0);
  });

  it('does not expose a NASA eclipse path outside the sampled event time', () => {
    expect(interpolateNasaSolarEclipsePathSample('2027-08-02', 3 * 60)).toBeNull();
  });
});

function minutesFromUt(timeUt: string): number {
  const [hours, minutes] = timeUt.split(':').map(Number);
  return hours * 60 + minutes;
}

function greatCircleDistanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const earthRadiusKm = 6371;
  const lat1 = degreesToRadians(a.lat);
  const lat2 = degreesToRadians(b.lat);
  const dLat = degreesToRadians(b.lat - a.lat);
  const dLon = degreesToRadians(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  return 2 * earthRadiusKm * Math.asin(Math.min(1, Math.sqrt(h)));
}

function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}
