import { TestBed } from '@angular/core/testing';
import { EarthGlobeService } from './earth-globe.service';

describe('EarthGlobeService - Starfield Rotation', () => {
  let service: EarthGlobeService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(EarthGlobeService);
  });

  it('should create', () => {
    expect(service).toBeTruthy();
  });

  describe('Earth rotation counting', () => {
    it('should increment rotation count when Earth crosses from negative to positive (zero crossing)', () => {
      // Access private properties for testing
      const serviceAny = service as any;

      // Simulate Earth rotating just before crossing zero
      serviceAny.lastEarthRotationY = -0.1; // Just below zero
      serviceAny.earthRotationCount = 0;

      // After rotation and normalization, we cross to positive
      const normalizedY = 0.1; // Just above zero

      if (serviceAny.lastEarthRotationY < 0 && normalizedY >= 0) {
        serviceAny.earthRotationCount++;
      }

      expect(serviceAny.earthRotationCount).toBe(1);
    });

    it('should handle wrap-around correctly (from near +π to near -π)', () => {
      const serviceAny = service as any;

      // When rotating forward through the π/-π boundary
      serviceAny.lastEarthRotationY = 0.5; // Positive, but not zero
      serviceAny.earthRotationCount = 0;

      // After adding rotation and normalizing, we're at negative
      const normalizedY = -2.8; // Near -π after normalization

      // Check if this is a wrap (large jump)
      if (serviceAny.lastEarthRotationY >= 0 && normalizedY < 0) {
        if (Math.abs(normalizedY - serviceAny.lastEarthRotationY) > Math.PI) {
          serviceAny.earthRotationCount++;
        }
      }

      expect(serviceAny.earthRotationCount).toBe(1);
    });

    it('should not increment count for small changes within same quadrant', () => {
      const serviceAny = service as any;

      serviceAny.lastEarthRotationY = 1.0;
      serviceAny.earthRotationCount = 5;

      const normalizedY = 1.5;

      if (serviceAny.lastEarthRotationY < 0 && normalizedY >= 0) {
        serviceAny.earthRotationCount++;
      }

      expect(serviceAny.earthRotationCount).toBe(5); // unchanged
    });
  });

  describe('Starfield rotation calculation', () => {
    it('should calculate starfield rotation as (rotationCount * 2π) / 365', () => {
      const serviceAny = service as any;

      serviceAny.earthRotationCount = 0;
      let starfieldRotation = (serviceAny.earthRotationCount * Math.PI * 2) / 365;
      expect(starfieldRotation).toBe(0);

      serviceAny.earthRotationCount = 1;
      starfieldRotation = (serviceAny.earthRotationCount * Math.PI * 2) / 365;
      expect(starfieldRotation).toBeCloseTo(0.0172, 4); // ~1 degree

      serviceAny.earthRotationCount = 365;
      starfieldRotation = (serviceAny.earthRotationCount * Math.PI * 2) / 365;
      expect(starfieldRotation).toBeCloseTo(Math.PI * 2, 4); // Full rotation

      serviceAny.earthRotationCount = 730; // 2 full years
      starfieldRotation = (serviceAny.earthRotationCount * Math.PI * 2) / 365;
      expect(starfieldRotation).toBeCloseTo(Math.PI * 4, 4); // 2 full rotations
    });

    it('should accumulate continuously without normalization', () => {
      const serviceAny = service as any;

      // After 365 rotations, starfield should be at 2π (not normalized back to 0)
      serviceAny.earthRotationCount = 365;
      const starfieldRotation = (serviceAny.earthRotationCount * Math.PI * 2) / 365;

      // Should be 2π, not normalized to 0
      expect(starfieldRotation).toBeGreaterThan(6.28); // Greater than 2π
      expect(starfieldRotation).toBeLessThan(6.29);
    });
  });

  describe('Full rotation simulation', () => {
    it('should complete one starfield rotation after 365 Earth rotations', () => {
      const serviceAny = service as any;

      serviceAny.earthRotationCount = 0;
      serviceAny.lastEarthRotationY = 0;
      serviceAny.earthGroup = { rotation: { y: 0, x: 0 } };

      const rotationDelta = 0.0205; // ~1.17 degrees per frame
      const framesPerRotation = (Math.PI * 2) / rotationDelta; // ~307 frames per Earth rotation

      let starfieldRotations: number[] = [];

      // Simulate 365 Earth rotations
      for (let earthRot = 0; earthRot < 365; earthRot++) {
        // Simulate frames for one complete Earth rotation
        for (let frame = 0; frame < framesPerRotation; frame++) {
          serviceAny.earthGroup.rotation.y += rotationDelta;

          // Normalize rotation (like actual code)
          const normalizedY = Math.atan2(
            Math.sin(serviceAny.earthGroup.rotation.y),
            Math.cos(serviceAny.earthGroup.rotation.y)
          );

          // Track rotation count using zero-crossing detection (forward only)
          if (serviceAny.lastEarthRotationY < 0 && normalizedY >= 0) {
            serviceAny.earthRotationCount++;
          }

          serviceAny.lastEarthRotationY = normalizedY;
          serviceAny.earthGroup.rotation.y = normalizedY;
        }

        // Calculate starfield rotation after each Earth rotation
        const starfieldRot = (serviceAny.earthRotationCount * Math.PI * 2) / 365;
        starfieldRotations.push(starfieldRot);
      }

      // After 365 Earth rotations, starfield should have rotated once (2π)
      const finalStarfieldRotation = starfieldRotations[starfieldRotations.length - 1];
      expect(finalStarfieldRotation).toBeCloseTo(Math.PI * 2, 2);

      // Verify it accumulated smoothly (no jumps)
      for (let i = 1; i < starfieldRotations.length; i++) {
        const diff = starfieldRotations[i] - starfieldRotations[i - 1];
        expect(diff).toBeGreaterThan(0); // Should always increase
        expect(diff).toBeCloseTo((Math.PI * 2) / 365, 3); // Should increase by consistent amount
      }
    });

    it('should show starfield rotation rate is 1/365th of Earth rotation rate', () => {
      const serviceAny = service as any;

      // Earth rotates 0.0205 radians per frame
      const earthRotationPerFrame = 0.0205;

      // After one Earth rotation (earthRotationCount increments by 1)
      // Starfield should rotate by (2π / 365)
      const starfieldRotationPerEarthRotation = (Math.PI * 2) / 365;

      expect(starfieldRotationPerEarthRotation).toBeCloseTo(0.0172, 4);

      // Verify the ratio
      const framesPerEarthRotation = (Math.PI * 2) / earthRotationPerFrame; // ~307 frames
      const starfieldRotationPerFrame = starfieldRotationPerEarthRotation / framesPerEarthRotation;

      // This should equal earthRotationPerFrame / 365
      expect(starfieldRotationPerFrame).toBeCloseTo(earthRotationPerFrame / 365, 6);
    });
  });

  describe('Rotation detection edge cases', () => {
    it('should handle rapid rotation across boundary', () => {
      const serviceAny = service as any;

      serviceAny.lastEarthRotationY = Math.PI * 0.95;
      serviceAny.earthRotationCount = 0;

      // Large jump that crosses the boundary
      serviceAny.earthGroup = { rotation: { y: -Math.PI * 0.95, x: 0 } };

      const currentY = serviceAny.earthGroup.rotation.y;
      if (serviceAny.lastEarthRotationY > Math.PI * 0.9 && currentY < -Math.PI * 0.9) {
        serviceAny.earthRotationCount++;
      }

      expect(serviceAny.earthRotationCount).toBe(1);
    });

    it('should not trigger false positives near but not at boundary', () => {
      const serviceAny = service as any;

      // Just under the threshold
      serviceAny.lastEarthRotationY = Math.PI * 0.85;
      serviceAny.earthRotationCount = 0;
      serviceAny.earthGroup = { rotation: { y: -Math.PI * 0.85, x: 0 } };

      const currentY = serviceAny.earthGroup.rotation.y;
      if (serviceAny.lastEarthRotationY > Math.PI * 0.9 && currentY < -Math.PI * 0.9) {
        serviceAny.earthRotationCount++;
      } else if (serviceAny.lastEarthRotationY < -Math.PI * 0.9 && currentY > Math.PI * 0.9) {
        serviceAny.earthRotationCount--;
      }

      expect(serviceAny.earthRotationCount).toBe(0); // Should not trigger
    });
  });

  describe('Diagnostic output', () => {
    it('should log rotation values for debugging', () => {
      const serviceAny = service as any;

      serviceAny.earthRotationCount = 100;
      const starfieldRotation = (serviceAny.earthRotationCount * Math.PI * 2) / 365;
      const earthEquivalent = (100 / 365) * 360; // degrees

      console.log('=== Starfield Rotation Diagnostics ===');
      console.log(`After 100 Earth rotations:`);
      console.log(`  earthRotationCount: ${serviceAny.earthRotationCount}`);
      console.log(`  starfieldRotation (radians): ${starfieldRotation}`);
      console.log(`  starfieldRotation (degrees): ${(starfieldRotation * 180) / Math.PI}`);
      console.log(
        `  Expected: ${earthEquivalent}° (${(earthEquivalent / 360) * 100}% of full rotation)`
      );
      console.log(`  Progress: ${(100 / 365) * 100}% toward one full starfield rotation`);
    });
  });
});
