import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface InfoBoxEntry {
  label: string;
  when: string;
  yf: number;
  isPrimary: boolean;
}

@Component({
  selector: 'app-info-box',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="info-box" [class.hidden]="hidden">
      <div class="inner">
        <ng-container *ngIf="entries.length; else emptyState">
          <div
            class="entry"
            *ngFor="let e of entries"
            [class.primary]="e.isPrimary"
            [class.secondary]="!e.isPrimary"
          >
            <div class="when">{{ e.label }}</div>
            <div class="desc">{{ e.when }}</div>
          </div>
        </ng-container>
        <ng-template #emptyState></ng-template>
      </div>
    </div>
  `,
  styles: [
    `
      .info-box {
        position: fixed;
        right: 16px;
        top: 50%;
        transform: translateY(-50%);
        max-width: 360px;
        background: rgba(20, 12, 6, 0.6);
        border: 1px solid rgba(255, 150, 60, 0.5);
        box-shadow: 0 0 12px rgba(255, 150, 60, 0.25);
        border-radius: 10px;
        padding: 10px 12px;
        z-index: 5;
        color: rgba(255, 230, 200, 0.95);
        transition: opacity 220ms ease, visibility 220ms ease;
        opacity: 1;
        visibility: visible;
        pointer-events: none;
      }
      .info-box.hidden {
        opacity: 0;
        visibility: hidden;
      }
      .info-box .inner {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .info-box .entry {
        border-left: 3px solid rgba(255, 150, 60, 0.95);
        padding-left: 8px;
      }
      .info-box .entry .when {
        font-family: system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell;
        font-size: 13px;
        color: rgba(255, 170, 80, 0.98);
      }
      .info-box .entry .desc {
        font-family: system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell;
        font-size: 12px;
        color: rgba(255, 200, 150, 0.92);
      }
      .info-box .entry.secondary {
        border-left-color: rgba(255, 150, 60, 0.45);
      }
      .info-box .entry.secondary .when {
        color: rgba(255, 170, 80, 0.6);
      }
      .info-box .entry.secondary .desc {
        color: rgba(255, 200, 150, 0.6);
      }
    `,
  ],
})
export class InfoBoxComponent {
  @Input() entries: InfoBoxEntry[] = [];
  @Input() hidden = true;
}
