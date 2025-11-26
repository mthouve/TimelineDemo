import { Component, Input } from '@angular/core';
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
                  <button
                    *ngIf="src.type === 'youtube'"
                    class="yt-link icon-link"
                    [title]="src.title"
                    (click)="
                      showYoutube =
                        showYoutube === (src.youtubeId || '') ? null : src.youtubeId || ''
                    "
                    type="button"
                  >
                    <span class="icon youtube-icon" aria-label="YouTube">▶</span>
                    <span class="icon-title">{{ src.title }}</span>
                  </button>
                  <a
                    *ngIf="
                      src.type === 'link' &&
                      src.url &&
                      src.title.toLowerCase().includes('wikipedia')
                    "
                    class="ext-link icon-link"
                    [href]="src.url"
                    [title]="src.title"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span class="icon wikipedia-icon" aria-label="Wikipedia">🛈</span>
                    <span class="icon-title">{{ src.title }}</span>
                  </a>
                  <a
                    *ngIf="
                      src.type === 'link' &&
                      src.url &&
                      !src.title.toLowerCase().includes('wikipedia')
                    "
                    class="ext-link icon-link"
                    [href]="src.url"
                    [title]="src.title"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span class="icon web-icon" aria-label="Web">🌐</span>
                    <span class="icon-title">{{ src.title }}</span>
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
        <ng-template #emptyState></ng-template>
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
  showYoutube: string | null = null;

  trackByYoutubeOrLabel(index: number, entry: InfoBoxEntry): string {
    // Use label, or if sources exist, use label plus all source labels
    if (entry.sources && entry.sources.length) {
      return entry.label + '-' + entry.sources.map((s) => s.label).join('-');
    }
    return entry.label;
  }
}
