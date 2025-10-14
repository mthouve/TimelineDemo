import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-zoom-control',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="zoomUI">
      <div class="zoomLabel">Zoom: {{ captionOverride ?? labelFor(value) }}</div>

      <div class="sliderWrap">
        <!-- Visual track -->
        <div class="track"></div>

        <!-- Ticks (aligned to track, centered vertically) -->
        <div class="ticks">
          <div
            class="tick"
            *ngFor="let t of ticks"
            [style.left.%]="pctFor(t)"
            [attr.title]="labels && labels[t] !== undefined ? labels[t] : t"
          ></div>
        </div>

        <!-- Native range (thumb only) -->
        <input
          class="slider"
          type="range"
          [min]="min"
          [max]="max"
          step="any"
          [value]="visualIndex ?? value"
          [disabled]="disabled"
          (input)="onInput($event)"
          (change)="onChange($event)"
        />
      </div>
    </div>
  `,
  styles: [
    `
      /* --- sizing + spacing knobs --- */
      :host {
        --track-w: 240px; /* visible track length (between side gaps) */
        --track-h: 6px; /* visible track thickness */
        --thumb-d: 16px; /* thumb diameter */
        --side-gap: 12px; /* padding left/right around track so thumb doesn't hit the box edge */
        --wrap-h: 30px; /* overall control box height for comfortable hit area */
        display: contents;
      }

      .zoomUI {
        position: fixed;
        left: 12px;
        bottom: 12px;
        z-index: 6;
        padding: 8px 10px;
        background: rgba(0, 0, 0, 0.35);
        border: 1px solid rgba(255, 150, 60, 0.55);
        border-radius: 8px;
        pointer-events: auto;
      }
      .zoomLabel {
        color: rgba(255, 170, 80, 0.95);
        font-family: system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell;
        font-size: 13px;
        margin-bottom: 6px;
      }

      .sliderWrap {
        position: relative;
        width: calc(var(--track-w) + 2 * var(--side-gap));
        height: var(--wrap-h);
      }

      /* Visible track (centered vertically) */
      .track {
        position: absolute;
        left: var(--side-gap);
        right: var(--side-gap);
        top: 50%;
        transform: translateY(-50%);
        height: var(--track-h);
        background: rgba(255, 150, 60, 0.45);
        border-radius: 0; /* no rounding per your request */
        pointer-events: none;
        z-index: 1;
      }

      /* Ticks: sit above track; each tick is centered on its x-position */
      .ticks {
        position: absolute;
        left: var(--side-gap);
        right: var(--side-gap);
        top: 50%;
        transform: translateY(-50%); /* exact vertical center */
        height: 12px; /* extends above & below the track */
        pointer-events: none;
        z-index: 2;
      }
      .tick {
        position: absolute;
        top: 50%;
        width: 2px;
        height: 12px;
        transform: translate(-1px, -50%); /* center the 2px tick on its x-position */
        background: rgba(255, 150, 60, 0.9);
        box-shadow: 0 0 6px rgba(255, 150, 60, 0.45);
        border-radius: 0;
      }

      /* The native range input: thumb only */
      .slider {
        position: absolute;
        /* Inset by half the thumb so the thumb CENTER aligns with the track ends */
        left: calc(var(--side-gap) - var(--thumb-d) / 2);
        right: calc(var(--side-gap) - var(--thumb-d) / 2);

        top: 50%;
        transform: translateY(-50%);
        width: auto; /* don't stretch to wrapper; we control with left/right */
        height: var(--track-h); /* keep vertical centering */
        appearance: none;
        -webkit-appearance: none;
        background: transparent;
        outline: none;
        margin: 0;
        padding: 0;
        z-index: 3; /* thumb above track & ticks */
      }

      /* Neutralize the native track so it doesn't affect layout/centering */
      .slider::-webkit-slider-runnable-track {
        height: var(--track-h);
        background: transparent;
      }
      .slider::-moz-range-track {
        height: var(--track-h);
        background: transparent;
      }

      /* Thumb perfectly centered on the visible track:
       margin-top = (track-h - thumb-d) / 2  */
      .slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: var(--thumb-d);
        height: var(--thumb-d);
        margin-top: calc((var(--track-h) - var(--thumb-d)) / 2);
        border-radius: 50%;
        background: rgba(255, 150, 60, 0.95);
        box-shadow: 0 0 10px rgba(255, 150, 60, 0.7);
        border: 1px solid rgba(140, 70, 10, 0.5);
        cursor: pointer;
      }
      .slider::-moz-range-thumb {
        width: var(--thumb-d);
        height: var(--thumb-d);
        border-radius: 50%;
        background: rgba(255, 150, 60, 0.95);
        box-shadow: 0 0 10px rgba(255, 150, 60, 0.7);
        border: 1px solid rgba(140, 70, 10, 0.5);
        cursor: pointer;
      }
    `,
  ],
})
export class ZoomControlComponent {
  /** Current *settled* index (integer) */
  @Input() value = 0;
  /** Optional fractional thumb position during animation */
  @Input() visualIndex: number | null = null;
  /** Optional caption override during transitions (e.g., "Month > Week") */
  @Input() captionOverride: string | null = null;

  /** inclusive min/max for the slider */
  @Input() min = 0;
  @Input() max = 5;
  /** Labels to show for each index (e.g., ["Day","Week","Month","Year",...]) */
  @Input() labels: string[] = [];
  /** Disable interaction */
  @Input() disabled = false;

  /** Fires on every drag (live update) */
  @Output() inputValue = new EventEmitter<number>();
  /** Fires on commit (mouseup / change) */
  @Output() valueChange = new EventEmitter<number>();

  /** Ticks: one per stop */
  get ticks(): number[] {
    const out: number[] = [];
    for (let i = this.min; i <= this.max; i++) out.push(i);
    return out;
  }

  /** Position along the track in percent (0..100), inclusive */
  pctFor(idx: number): number {
    if (this.max <= this.min) return 0;
    return ((idx - this.min) / (this.max - this.min)) * 100;
  }

  labelFor(v: number): string {
    return this.labels?.[v] ?? `${v}`;
  }

  onInput(evt: Event) {
    const v = (evt.target as HTMLInputElement).valueAsNumber;
    this.inputValue.emit(this.clamp(v));
  }
  onChange(evt: Event) {
    const v = (evt.target as HTMLInputElement).valueAsNumber;
    this.valueChange.emit(this.clamp(v));
  }
  private clamp(v: number) {
    if (v < this.min) return this.min;
    if (v > this.max) return this.max;
    return Math.round(v);
  }
}
