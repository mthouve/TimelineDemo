![Timeline Demo banner](docs/assets/timeline-demo-readme-banner.png)

# TimelineDemo

Renders a vertical biblical timeline beside a Three.js earth, sun, moon, and starfield scene.

The long-term goal is a searchable biblical archive through time and space: selecting a passage or
event should move the timeline to the approximate date and rotate the globe toward the approximate
place.

> "The heavens declare the glory of God; and the firmament sheweth his handywork."
>
> Psalm 19:1, KJV

## Project Status

TimelineDemo is still a proof of concept. The current app demonstrates the core interaction model:
Bible passages, approximate timeline anchors, and geographic locations can drive the timeline and
globe together. The data model, historical coverage, astronomy accuracy, and long-term archive
architecture are still evolving.

Today, the prototype includes:

- a KJV Bible reader with Hebrew or Greek text beneath each verse;
- clickable chapter-level timeline anchors for selected passages;
- a vertical timeline HUD with zoom levels from day to millennium;
- a Three.js earth scene with clouds, atmosphere, sun, moon, starfield, and location markers;
- deterministic time progression that can move the celestial scene and timeline together;
- early NASA eclipse reference data for validating future eclipse-path calculations.

## Tech Stack

- Angular for the application shell, component structure, routing state, and UI controls.
- TypeScript for application logic, timeline indexing, astronomy calculations, and rendering state.
- Three.js for the interactive earth, sun, moon, cloud layer, starfield, lighting, and markers.
- HTML canvas for the vertical timeline HUD and zoom-level tick rendering.
- Static project data for the current proof-of-concept Bible timeline anchors, timeline entries, and
  NASA eclipse reference fixtures.

## Live Application Screenshot

![Genesis 22 live application preview](docs/assets/genesis-22-preview.png)

## Current Astronomy Model

The space scene is a visual reconstruction layer, not a full observatory-grade ephemeris. It is
designed to stay performant while giving biblical and historical events plausible celestial context.

- The sun position is deterministic from the current timeline date and simulates day/night without
  continuously rotating the earth relative to the viewer.
- The visible starfield follows the earth orientation and uses only a small seasonal wobble. This
  preserves a sense of time passing without making the background visibly loop on a yearly cycle.
- The moon uses a compact Meeus-style geocentric lunar position calculation derived from periodic
  terms for lunar longitude, latitude, and distance.
- The scene uses Earth-radius units for celestial movement: Earth radius is `1`, the Moon's rendered
  radius is about `0.273`, the Moon's center distance comes from calculated Earth-Moon distance in
  kilometers, and the Sun is placed about one astronomical unit away with its proportional radius.
  With the current close Earth camera, the Moon and Sun are therefore often out of frame or small by
  design.
- The moon's north/south position comes from calculated lunar ecliptic latitude, which is important
  for eclipse alignment.
- Solar eclipse shadows are represented with a cheap visual approximation: one transparent radial
  texture on a small plane near Earth's surface when the sun and moon align closely.
- The cloud layer uses a cosmetic drift model. Its baseline assumes about 8 mph cloud movement,
  scaled through the Time control rather than attempting to simulate weather systems.
- NASA solar eclipse reference data is stored separately under `src/app/data/astronomy/`. This data
  should be used as a ground-truth fixture for validating future eclipse-path calculations before
  replacing the current visual approximation.

### Accuracy Notes

The lunar calculation is intended to make phases, distance changes, and node crossings line up
reasonably well with real dates. For ancient BCE dates, exact eclipse visibility still needs explicit
event metadata and historical eclipse catalog validation because calendar conversions and long-term
Earth rotation uncertainty matter.

Future event metadata should distinguish between:

- ordinary astronomical events, such as solar eclipses, lunar eclipses, moon phases, and local solar
  time;
- textual sign or miracle events, such as the shadow moving backward in 2 Kings 20 and Isaiah 38.

### NASA Eclipse References

The first imported reference is NASA's Total Solar Eclipse of 2027 Aug 02. It includes:

- greatest-eclipse location and timing;
- sampled central-line path coordinates;
- Besselian polynomial coefficients;
- source URLs for NASA's path table and Besselian elements table.

This reference intentionally confirms that the total path is near North Africa, Egypt, the Red Sea
region, Yemen, Somalia, and the Indian Ocean. Israel is outside the totality path but within the
broader partial-visibility region.

## Roadmap

1. Strengthen the proof of concept by making the Bible, timeline, globe, and search interactions
   feel coherent and reliable.
2. Harden the event data model with explicit support for approximate dates, date ranges,
   uncertainty, locations, regions, routes, and source confidence.
3. Move large timeline and archive data into a searchable database/API once static frontend data is
   no longer enough.
4. Improve the astronomy layer with stronger calendar handling, validated eclipse fixtures, and a
   clear distinction between ordinary astronomical events and textual sign or miracle events.
5. Add regional geography and historical overlays for journeys, kingdoms, battles, boundaries,
   vegetation, ice, volcanic disruption, flood coverage, and other non-point events.
6. Expand the archive layer with museum links, media, manuscripts, archaeological notes, maps,
   videos, and verse- or chapter-linked supplemental research.
7. Explore immersive reconstruction views for historical places such as Jerusalem, the Temple Mount,
   Rome, Ephesus, and other ancient locations.
8. Scale performance with timeline virtualization, lazy-loaded data, level-of-detail rendering, and
   focused tests for indexing, URL state, and astronomy fixtures.

## Development server

To start a local development server, run:

```bash
nvm use 22
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Karma](https://karma-runner.github.io) test runner, use the following command:

```bash
ng test
```
