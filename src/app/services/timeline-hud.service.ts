import { Injectable } from '@angular/core';

export interface HudLayer {
  el: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  unit: number;
  id: string;
}

@Injectable({
  providedIn: 'root',
})
export class TimelineHudService {
  private huds: HudLayer[] = [];
  private readonly grid = {
    spacingCSS: 0,
    targetVisible: 6,
    topGapCSS: 40,
    color: 'rgba(255,150,60,0.55)',
    thicknessCSS: 2,
  };

  constructor() {}

  addHudLayer(hud: HudLayer) {
    this.huds.push(hud);
  }

  getHuds(): HudLayer[] {
    return this.huds;
  }

  getHud(index: number): HudLayer | undefined {
    return this.huds[index];
  }

  clearHuds() {
    this.huds = [];
  }

  getGridSpacing(): number {
    return this.grid.spacingCSS;
  }

  getGridTopGap(): number {
    return this.grid.topGapCSS;
  }

  getGridColor(): string {
    return this.grid.color;
  }

  getGridThickness(): number {
    return this.grid.thicknessCSS;
  }
}
