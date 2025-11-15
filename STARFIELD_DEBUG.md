# Starfield Rotation Debug Guide

## Expected Behavior

- Earth rotates at `0.0205` radians per frame (~1.17° per frame)
- One complete Earth rotation = `2π` radians = ~307 frames
- Starfield should rotate `1/365` the speed of Earth
- After 365 Earth rotations, starfield completes 1 full rotation (`2π` radians)

## Debug Output

When you run the app, check the browser console. Every 100 frames you'll see:

```
Rotation status: {
  frame: 100,
  currentY: "1.5500",           // Current Earth Y rotation (should cycle between -π and +π)
  lastY: "1.5295",              // Previous frame's rotation
  earthRotationCount: 0,        // How many complete Earth rotations
  starfieldRotation: "0.0000",  // Current starfield rotation in radians
  starfieldDegrees: "0.00",     // Current starfield rotation in degrees
  progress: "0.0%"              // Progress toward one full starfield rotation
}
```

## What to Look For

### Problem: Starfield resets too soon

**Symptoms:**

- `earthRotationCount` increases too frequently
- Starfield completes rotation before Earth has rotated 365 times
- Console shows "✓ Earth rotation complete!" messages too often

**Likely Causes:**

1. **False positive detection**: The boundary detection at `±π * 0.9` triggers incorrectly
2. **Normalization issue**: Values exceed `±π` before being normalized, causing missed detections
3. **Threshold too sensitive**: `0.9π` threshold catches values that aren't actually crossing the boundary

### Problem: Starfield never completes rotation

**Symptoms:**

- `earthRotationCount` never increases
- No "✓ Earth rotation complete!" messages
- `starfieldRotation` stays at 0

**Likely Causes:**

1. **Detection never triggers**: Threshold of `0.9π` is too strict
2. **Normalization happens too early**: `Math.atan2` prevents values from reaching detection threshold

## Manual Verification

Calculate expected values:

```javascript
// After N frames:
const framesElapsed = N;
const rotationDelta = 0.0205;
const totalEarthRotation = framesElapsed * rotationDelta;
const earthRotations = totalEarthRotation / (Math.PI * 2);
const expectedStarfieldRotation = (earthRotations / 365) * (Math.PI * 2);
const expectedStarfieldDegrees = (expectedStarfieldRotation * 180) / Math.PI;

console.log(`After ${N} frames:`);
console.log(`  Earth should have rotated: ${earthRotations.toFixed(2)} times`);
console.log(`  Starfield should be at: ${expectedStarfieldDegrees.toFixed(2)}°`);
```

## Testing Rotation Detection

The issue is likely in this logic:

```typescript
const currentY = this.earthGroup.rotation.y; // After adding 0.0205
if (this.lastEarthRotationY > Math.PI * 0.9 && currentY < -Math.PI * 0.9) {
  this.earthRotationCount++; // Wrapped from +π to -π
}
```

**Problem**:

- `currentY` might be > π (e.g., 3.2) before normalization
- Detection requires `currentY < -Math.PI * 0.9` (~-2.83)
- But if `currentY = 3.2`, it won't trigger
- Then `Math.atan2` normalizes `3.2` to `-3.08`
- Next frame compares `-3.08` (now in `lastY`) with new value
- This breaks the detection logic!

## Proposed Fix

Move the detection **after** normalization:

```typescript
// Add rotation
this.earthGroup.rotation.y += rotationDelta;

// Normalize FIRST
const normalizedY = Math.atan2(
  Math.sin(this.earthGroup.rotation.y),
  Math.cos(this.earthGroup.rotation.y)
);

// THEN detect crossing (both values are now normalized)
if (this.lastEarthRotationY > Math.PI * 0.9 && normalizedY < -Math.PI * 0.9) {
  this.earthRotationCount++;
}

this.lastEarthRotationY = normalizedY;
this.earthGroup.rotation.y = normalizedY;
```

Or use a better detection method that counts how many times we cross a specific angle (like 0):

```typescript
// Count zero crossings instead of π/-π boundary
const crossedZero =
  (this.lastEarthRotationY < 0 && normalizedY >= 0) ||
  (this.lastEarthRotationY >= 0 && normalizedY < 0);

if (crossedZero) {
  // Determine direction
  const delta = normalizedY - this.lastEarthRotationY;
  if (delta > Math.PI) {
    this.earthRotationCount--; // Wrapped backwards
  } else if (delta < -Math.PI) {
    this.earthRotationCount++; // Wrapped forwards
  }
}
```
