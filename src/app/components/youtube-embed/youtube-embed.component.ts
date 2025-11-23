import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-youtube-embed',
  standalone: true,
  template: `
    <div class="youtube-embed-wrapper">
      <iframe
        [width]="width"
        [height]="height"
        [src]="sanitizedUrl"
        title="YouTube video player"
        frameborder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerpolicy="strict-origin-when-cross-origin"
        allowfullscreen
      ></iframe>
    </div>
  `,
  styles: [
    `
      .youtube-embed-wrapper {
        position: relative;
        width: 100%;
        max-width: 560px;
        aspect-ratio: 16/9;
        margin: 0 auto;
      }
      iframe {
        width: 100%;
        height: 100%;
        border: none;
        display: block;
      }
    `,
  ],
})
export class YoutubeEmbedComponent {
  @Input() videoId!: string;
  @Input() width: number = 560;
  @Input() height: number = 315;

  constructor(private sanitizer: DomSanitizer) {}

  safeUrl?: SafeResourceUrl;

  ngOnChanges(changes: SimpleChanges) {
    if (changes['videoId'] && this.videoId) {
      this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
        `https://www.youtube.com/embed/${this.videoId}?autoplay=1`
      );
    }
  }

  get sanitizedUrl(): SafeResourceUrl {
    // Always return a SafeResourceUrl, fallback to an empty safe URL if undefined
    return this.safeUrl ?? this.sanitizer.bypassSecurityTrustResourceUrl('about:blank');
  }
}
