import { Component, EventEmitter, Input, Output, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-zoom-control',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="zoomUI">
      <div class="zoomLabel">Zoom: {{ captionOverride ?? labelFor(value) }}</div>

      <div class="sliderWrap">
        <div class="inner">
          <!-- Base orange track -->
          <div class="track"></div>

          <!-- Progress bridge (solid orange) -->
          <div
            class="bridge"
            *ngIf="bridgeVisible"
            [style.left.%]="bridgeLeft"
            [style.width.%]="bridgeWidth"
          ></div>

          <!-- Ticks (allow slight overhang at ends) -->
          <div class="ticks">
            <div
              class="tick"
              *ngFor="let t of ticks"
              [style.left.%]="posFor(t)"
              [attr.title]="labels[t]"
            ></div>
          </div>
        </div>

        <!-- Native range (thumb only; track is transparent) -->
        <input
          class="slider"
          type="range"
          [min]="min"
          [max]="max"
          step="1"
          [value]="value"
          [disabled]="disabled"
          (input)="onInput($event)"
          (change)="onChange($event)"
        />
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: contents;
        --trackH: 6px; /* bar height */
        --thumb: 16px; /* thumb diameter */
        --padX: 12px; /* inner padding so bar isn’t edge-to-edge */
        --tickW: 2px; /* tick width */
        --thumbOffsetY: -3px; /* fine-tune vertical nudge (up = negative) */
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
        width: 240px;
        height: 30px;
      }
      .inner {
        position: absolute;
        left: var(--padX);
        right: var(--padX);
        top: 0;
        bottom: 0;
        /* allow ticks to overhang half their width so end ticks look same width */
        overflow: visible;
      }

      /* Square track, vertically centered */
      .track {
        position: absolute;
        left: 0;
        right: 0;
        top: 50%;
        transform: translateY(-50%);
        height: var(--trackH);
        background: rgba(255, 150, 60, 0.45);
        border-radius: 0; /* square ends */
        z-index: 1;
        pointer-events: none;
      }

      /* Orange progress bridge above track, below thumb */
      .bridge {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        height: var(--trackH);
        background: rgba(255, 150, 60, 0.95);
        border-radius: 0; /* square ends */
        z-index: 2;
        pointer-events: none;
      }

      /* Ticks occupy the bar height; square; slight overhang allowed */
      .ticks {
        position: absolute;
        left: calc(0px - var(--tickW) / 2);
        right: calc(0px - var(--tickW) / 2);
        top: 50%;
        transform: translateY(-50%);
        height: var(--trackH);
        z-index: 3;
        pointer-events: none;
      }
      .tick {
        position: absolute;
        top: 0;
        width: var(--tickW);
        height: 100%;
        transform: translateX(calc(-1 * var(--tickW) / 2)); /* center on x-position */
        background: rgba(255, 150, 60, 0.95);
        border-radius: 0; /* square */
        box-shadow: none;
      }

      /* Native slider, thumb centered on bar; no native track */
      .slider {
        position: absolute;
        left: calc(var(--padX) - 0.5 * var(--thumb));
        right: calc(var(--padX) - 0.5 * var(--thumb));
        top: 50%;
        transform: translateY(-50%);
        height: var(--trackH);
        z-index: 4;

        appearance: none;
        -webkit-appearance: none;
        background: transparent;
        outline: none;
        border: 0;
        margin: 0;
        padding: 0;
      }
      .slider::-webkit-slider-runnable-track {
        height: 0;
        background: transparent;
      }
      .slider::-moz-range-track {
        height: 0;
        background: transparent;
      }

      .slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: var(--thumb);
        height: var(--thumb);
        /* center over the track + fine nudge */
        margin-top: calc((var(--trackH) - var(--thumb)) / 2 + var(--thumbOffsetY));
        border-radius: 50%;
        background: rgba(255, 150, 60, 0.95);
        box-shadow: 0 0 10px rgba(255, 150, 60, 0.7);
        border: 1px solid rgba(140, 70, 10, 0.5);
        cursor: pointer;
      }
      .slider::-moz-range-thumb {
        width: var(--thumb);
        height: var(--thumb);
        border-radius: 50%;
        background: rgba(255, 150, 60, 0.95);
        box-shadow: 0 0 10px rgba(255, 150, 60, 0.7);
        border: 1px solid rgba(140, 70, 10, 0.5);
        cursor: pointer;
      }
    `,
  ],
})
export class ZoomControlComponent implements OnChanges {
  /** Settled index (integer) — THUMB USES THIS ONLY (no animation) */
  @Input() value = 0;
  /** Optional caption override */
  @Input() captionOverride: string | null = null;

  /** Progress bridge endpoints (fractional ok); when null → hide bridge */
  @Input() bridgeStart: number | null = null;
  @Input() bridgeEnd: number | null = null;

  /** inclusive min/max for the slider */
  @Input() min = 0;
  @Input() max = 5;
  /** Labels for stops */
  @Input() labels: string[] = [];
  /** Disable interaction */
  @Input() disabled = false;

  /** Emits on drag */
  @Output() inputValue = new EventEmitter<number>();
  /** Emits on release */
  @Output() valueChange = new EventEmitter<number>();

  ticks: number[] = [];

  // Bridge geometry (% of inner width)
  bridgeVisible = false;
  bridgeLeft = 0;
  bridgeWidth = 0;

  ngOnChanges(ch: SimpleChanges): void {
    if (ch['min'] || ch['max']) {
      this.ticks = [];
      for (let i = this.min; i <= this.max; i++) this.ticks.push(i);
    }
    if (ch['bridgeStart'] || ch['bridgeEnd'] || ch['min'] || ch['max']) {
      this.updateBridge();
    }
  }

  labelFor(v: number): string {
    return this.labels?.[v] ?? `${v}`;
  }

  onInput(evt: Event) {
    const el = evt.target as HTMLInputElement;
    const raw = el.valueAsNumber;
    const snapped = this.clamp(Math.round(raw));
    // force the thumb to the snapped tick immediately
    if (snapped !== raw) el.value = String(snapped);
    this.inputValue.emit(snapped);
  }

  onChange(evt: Event) {
    const el = evt.target as HTMLInputElement;
    const raw = el.valueAsNumber;
    const snapped = this.clamp(Math.round(raw));
    if (snapped !== raw) el.value = String(snapped);
    this.valueChange.emit(snapped);
  }

  private clamp(v: number) {
    if (v < this.min) return this.min;
    if (v > this.max) return this.max;
    return Math.round(v);
  }

  /** Map an index (can be fractional) → % position across inner track */
  posFor(v: number): number {
    if (!isFinite(v)) return 0;
    const span = this.max - this.min || 1;
    return ((v - this.min) / span) * 100;
  }

  private updateBridge() {
    const a = this.bridgeStart;
    const b = this.bridgeEnd;
    if (a == null || b == null || !isFinite(a) || !isFinite(b)) {
      this.bridgeVisible = false;
      this.bridgeLeft = 0;
      this.bridgeWidth = 0;
      return;
    }
    const pa = this.posFor(a);
    const pb = this.posFor(b);
    const left = Math.min(pa, pb);
    const width = Math.abs(pb - pa);
    this.bridgeVisible = width > 0.05;
    this.bridgeLeft = left;
    this.bridgeWidth = width;
  }
}
