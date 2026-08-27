import { Component, Input, Output, EventEmitter } from '@angular/core';
import { YoutubeEmbedComponent } from '../components/youtube-embed/youtube-embed.component';
import { CommonModule } from '@angular/common';

import { TimelineSource } from '../data/timeline-points';
export interface InfoBoxEntry {
  label: string;
  when: string;
  yf: number;
  isPrimary: boolean;
  sources?: TimelineSource[];
}

@Component({
  selector: 'app-info-box',
  standalone: true,
  imports: [CommonModule, YoutubeEmbedComponent],
  template: `
    <div class="info-box" [class.hidden]="hidden">
      <div class="inner">
        <ng-container *ngIf="entries.length; else emptyState">
          <div
            class="entry"
            *ngFor="let e of entries; trackBy: trackByYoutubeOrLabel"
            [class.primary]="e.isPrimary"
            [class.secondary]="!e.isPrimary"
          >
            <div class="when">{{ e.label }}</div>
            <div class="desc">{{ e.when }}</div>
            <ng-container *ngIf="e.sources && e.sources.length">
              <div class="sources-list">
                <ng-container *ngFor="let src of e.sources">
                  <!-- Bible link -->
                  <button
                    *ngIf="src.type === 'bible' && src.reference"
                    class="bible-link icon-link"
                    [title]="src.title || src.label"
                    (click)="openBiblePassage.emit(src.reference)"
                    type="button"
                  >
                    <span class="icon bible-icon" aria-label="Bible">📖</span>
                    <span class="icon-title">{{ src.label }}</span>
                  </button>
                  <!-- YouTube link -->
                  <a
                    *ngIf="src.type === 'youtube' && src.youtubeId"
                    class="icon-link youtube-link"
                    [title]="src.title || src.label"
                    (click)="showYoutube = showYoutube === src.youtubeId ? null : src.youtubeId"
                    href="javascript:void(0);"
                  >
                    <span class="icon youtube-icon" aria-label="YouTube">▶️</span>
                    <span class="icon-title">{{ src.label }}</span>
                  </a>
                  <!-- Wikipedia or Web link (type: 'link') -->
                  <a
                    *ngIf="src.type === 'link' && src.url"
                    class="icon-link web-link"
                    [href]="src.url"
                    [title]="src.title || src.label"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span class="icon web-icon" aria-label="Web">🌐</span>
                    <span class="icon-title">{{ src.label }}</span>
                  </a>
                  <div
                    class="yt-embed"
                    [hidden]="showYoutube !== src.youtubeId"
                    *ngIf="src.type === 'youtube' && src.youtubeId"
                  >
                    <app-youtube-embed [videoId]="src.youtubeId"></app-youtube-embed>
                  </div>
                </ng-container>
              </div>
            </ng-container>
          </div>
        </ng-container>
        <ng-template #emptyState><div class="empty">No entries</div></ng-template>
      </div>
    </div>
  `,

  styles: [
    `
      .icon-link {
        pointer-events: auto;
        margin-top: 8px;
        background: #222;
        color: #ff5555;
        border: none;
        border-radius: 4px;
        padding: 4px 10px;
        font-size: 15px;
        cursor: pointer;
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        transition: background 0.2s, color 0.2s;
        margin-left: 6px;
      }
      .icon-link:hover {
        background: #333;
        color: #fff;
      }
      .icon {
        font-size: 18px;
        vertical-align: middle;
      }
      .youtube-icon {
        color: rgba(255, 200, 150, 0.92);
      }
      .wikipedia-icon {
        color: rgba(255, 200, 150, 0.92);
      }
      .web-icon {
        color: rgba(255, 200, 150, 0.92);
      }
      .icon-title {
        font-family: system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell;
        font-size: 13px;
        color: rgba(255, 200, 150, 0.92);
        white-space: nowrap;
      }
      .sources-list {
        margin-top: 8px;
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
      }
      .yt-embed {
        pointer-events: auto;
        margin-top: 10px;
        width: 100%;
      }
      .info-box {
        position: fixed;
        left: 50%;
        top: 16px;
        transform: translateX(-50%);
        width: min(720px, 52vw);
        max-height: 33vh;
        overflow-y: auto;
        background: #000;
        border: 1px solid rgba(255, 150, 60, 0.5);
        box-shadow: 0 0 12px rgba(255, 150, 60, 0.25);
        border-radius: 8px;
        padding: 10px 12px;
        z-index: 25;
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
      @media (max-width: 900px) {
        .info-box {
          top: 8px;
          width: calc(100vw - 32px);
          max-height: 28vh;
        }
      }
    `,
  ],
})
export class InfoBoxComponent {
  @Input() entries: InfoBoxEntry[] = [];
  @Input() hidden = true;
  @Output() openBiblePassage = new EventEmitter<string>();
  showYoutube: string | null = null;

  trackByYoutubeOrLabel(index: number, entry: InfoBoxEntry): string {
    if (entry.sources && entry.sources.length) {
      return entry.label + '-' + entry.sources.map((s) => s.label).join('-');
    }
    return entry.label;
  }
}
