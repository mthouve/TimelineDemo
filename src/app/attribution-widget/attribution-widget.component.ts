import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-attribution-widget',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './attribution-widget.component.html',
  styleUrls: ['./attribution-widget.component.scss'],
})
export class AttributionWidgetComponent {
  open = signal(false);
  toggle() {
    this.open.update((v) => !v);
  }
}
