import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { faGear } from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'app-settings-control',
  standalone: true,
  imports: [CommonModule, FontAwesomeModule],
  template: `
    <div class="settingsUI" [class.minimized]="minimized">
      <ng-container *ngIf="!minimized; else minimizedIcon">
        <ng-content></ng-content>
        <button class="minimizeBtn" (click)="minimize()" title="Minimize">&minus;</button>
      </ng-container>
      <ng-template #minimizedIcon>
        <button class="gearBtn" (click)="restore()" title="Show Settings">
          <fa-icon [icon]="faGear" class="gear-fa" />
        </button>
      </ng-template>
    </div>
  `,
  styles: [
    `
      .settingsUI {
        position: fixed;
        left: 12px;
        bottom: 12px;
        z-index: 10;
        padding: 10px 14px;
        background: rgba(0, 0, 0, 0.35);
        border: 1px solid rgba(255, 150, 60, 0.55);
        border-radius: 10px;
        min-width: 260px;
        min-height: 48px;
        transition: box-shadow 0.2s;
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.12);
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .settingsUI.minimized {
        padding: 0;
        min-width: 0;
        min-height: 0;
        background: none;
        border: none;
        box-shadow: none;
        align-items: flex-end;
      }
      .minimizeBtn {
        margin-left: auto;
        background: none;
        border: none;
        color: orange;
        font-size: 20px;
        cursor: pointer;
        padding: 2px 8px;
        border-radius: 4px;
        transition: background 0.2s;
      }
      .minimizeBtn:hover {
        background: rgba(255, 150, 60, 0.15);
      }
      .gearBtn {
        background: none;
        border: none;
        cursor: pointer;
        padding: 6px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 1px 4px rgba(255, 150, 60, 0.1);
        transition: background 0.2s;
      }
      .gearBtn:hover {
        background: rgba(255, 150, 60, 0.12);
      }
      .gear-fa {
        color: orange;
        font-size: 18px;
        width: 18px;
        height: 18px;
        display: inline-block;
        vertical-align: middle;
      }
    `,
  ],
})
export class SettingsControlComponent {
  minimized = false;
  faGear = faGear;

  minimize() {
    this.minimized = true;
  }

  restore() {
    this.minimized = false;
  }
}
