# HUD Line Spacing Issues - Analysis & Fixes Needed

## Issues Identified

### 1. Week Zoom: Uneven spacing near year boundaries

**Problem**: Week of Dec 25, 151 B.C.E. appears very close to Jan 1, 150 B.C.E.
**Root Cause**:

- Week clamping logic `if (weekStart > diy - 7) weekStart = diy - 7` prevents weeks from starting in the last 6 days of the year
- This creates a ~6-day gap instead of 7 days between the last week of one year and Jan 1 of the next
- The clamping was added to prevent "Week of Dec 31" labels, but it breaks uniform spacing

**Fix Required**:

1. Remove the clamping logic entirely from `nextDate('Week')`
2. Instead, simply add 7 days and let it naturally cross year boundaries
3. The label generation should handle edge cases, not the stepping logic

### 2. Day Zoom: Jan 1 closer to Jan 2 than Dec 30

**Problem**: Jan 1, 150 B.C.E. appears spatially closer to Jan 2 than to Dec 30, 149 B.C.E.
**Root Cause**:

- The `+0.5/diy` epsilon offset in nextDate causes Jan 1 to be positioned at `year + 0.5/366`
- This is ~0.00137 year fraction, which places it slightly after the true Jan 1 boundary
- Dec 30 is at the end of the previous year (different diy), creating asymmetric spacing

**Fix Required**:

1. Remove all `+0.5` epsilon offsets from Day/Week/Month in `nextDate`
2. Use exact day boundaries: `yr + dayOfYear / diy`
3. The epsilon was intended to avoid floating-point ambiguity, but it creates worse visual problems

### 3. Day Zoom: Duplicate Jan 2 HUD lines

**Problem**: Two HUD lines for Jan 2, 150 B.C.E.
**Root Cause**:

- Year boundary crossing in nextDate returns integer year (e.g., `yf: 1` for Jan 1)
- Next iteration adds +0.5 offset: `yr + (1 + 0.5) / diy`
- But this rounds to day 1 (Jan 2) when floored, while the previous day's offset also rounds to day 1
- Creates two ticks that convert to "Jan 2" when labeled

**Fix Required**:

1. Make year-boundary crossing consistent: always return exact boundary (no offset)
2. Or consistently use offset everywhere (including year-crossing)
3. Current mix of offset/no-offset causes duplicates

## Core Problem

The fundamental issue is **inconsistent epsilon handling**:

- Within a year: `yr + (day + 0.5) / diy`
- Crossing years: `yr + 1` (no offset)

This creates:

- Uneven spacing (5-10px gaps where 70px expected)
- Visual misalignment (points don't align with their HUD lines)
- Duplicate labels (same day computed two different ways)

## Recommended Solution

**Remove all epsilon offsets from nextDate for Day/Week/Month**:

```typescript
case 'Day': {
  const yr = Math.floor(fromYf);
  const diy = this.daysInYear(yr);
  const frac = fromYf - yr;
  const dayOfYear = Math.floor(frac * diy);
  const nextDay = dayOfYear + 1;

  if (nextDay >= diy) {
    return { yf: yr === 0 ? 1 : yr + 1, days: 1 };
  } else {
    return { yf: yr + nextDay / diy, days: 1 }; // NO +0.5
  }
}

case 'Week': {
  const yr = Math.floor(fromYf);
  const diy = this.daysInYear(yr);
  const frac = fromYf - yr;
  const dayOfYear = Math.floor(frac * diy);
  const nextDay = dayOfYear + 7; // Just add 7, no alignment/clamping

  if (nextDay >= diy) {
    const daysIntoNext = nextDay - diy;
    const nextYr = yr === 0 ? 1 : yr + 1;
    const nextDiy = this.daysInYear(nextYr);
    return { yf: nextYr + daysIntoNext / nextDiy, days: 7 };
  } else {
    return { yf: yr + nextDay / diy, days: 7 }; // NO +0.5
  }
}
```

**Also remove clamping from**:

- `snapToUnit` (Week case)
- `formatLabelByUnit` (Week case)
- `timeline-hud.service.ts` drawing code

**Benefits**:

- Uniform 7-day spacing for weeks (no 5-6 day gaps)
- Jan 1 aligns exactly with data points
- No duplicate day labels
- Simpler, more predictable code

## Test Results Expected After Fix

Week test gaps should be: `[70, 70, 70, 70, 70, 70, 70, 70, 70, ...]` (all 70px)
Day test gaps should be: `[10, 10, 10, 10, 10, ...]` (all 10px)
No duplicate labels in any zoom level.
