import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-zoom-control',
  standalone: true,
  template: `
    <div class="zoomUI">
      <div class="zoomLabel">Zoom: {{ labelFor(value) }}</div>
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
  `,
  styles: [
    `
      /* Themeable orange */
      :host {
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

      .slider {
        appearance: none;
        -webkit-appearance: none;
        width: 240px;
        height: 6px;
        background: rgba(255, 150, 60, 0.45);
        border-radius: 999px;
        outline: none;
        accent-color: rgba(255, 150, 60, 0.95); /* fallback */
      }
      .slider::-webkit-slider-runnable-track {
        height: 6px;
        background: rgba(255, 150, 60, 0.45);
        border-radius: 999px;
      }
      .slider::-moz-range-track {
        height: 6px;
        background: rgba(255, 150, 60, 0.45);
        border-radius: 999px;
      }
      /* Force orange thumb (replaces the blue) */
      .slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 16px;
        height: 16px;
        margin-top: -5px;
        border-radius: 50%;
        background: rgba(255, 150, 60, 0.95);
        box-shadow: 0 0 10px rgba(255, 150, 60, 0.7);
        border: 1px solid rgba(140, 70, 10, 0.5);
        cursor: pointer;
      }
      .slider::-moz-range-thumb {
        width: 16px;
        height: 16px;
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
  /** 0-based current index */
  @Input() value = 0;
  /** inclusive min/max for the slider */
  @Input() min = 0;
  @Input() max = 5;
  /** Labels to show for each index (e.g., ["Day","Month","Year",...]) */
  @Input() labels: string[] = [];
  /** Disable interaction */
  @Input() disabled = false;

  /** Fires on every drag (live update) */
  @Output() inputValue = new EventEmitter<number>();
  /** Fires on commit (mouseup / change) */
  @Output() valueChange = new EventEmitter<number>();

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
