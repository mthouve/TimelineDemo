import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class StarfieldService {
  private xmur3(str: string) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return () => {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      h ^= h >>> 16;
      return h >>> 0;
    };
  }
  private sfc32(a: number, b: number, c: number, d: number) {
    return () => {
      a >>>= 0;
      b >>>= 0;
      c >>>= 0;
      d >>>= 0;
      let t = (a + b) | 0;
      a = b ^ (b >>> 9);
      b = (c + (c << 3)) | 0;
      c = (c << 21) | (c >>> 11);
      d = (d + 1) | 0;
      t = (t + d) | 0;
      c = (c + t) | 0;
      return (t >>> 0) / 4294967296;
    };
  }
  private makeRng(seed: string) {
    const h = this.xmur3(seed);
    return this.sfc32(h(), h(), h(), h());
  }
  createStarTile(seed = 'SPT-1234', tileSize = 512): HTMLCanvasElement {
    const rng = this.makeRng(seed);
    const tile = document.createElement('canvas');
    tile.width = tileSize;
    tile.height = tileSize;
    const ctx = tile.getContext('2d')!;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, tileSize, tileSize);

    const starCount = Math.floor(0.25 * tileSize);
    for (let i = 0; i < starCount; i++) {
      const x = Math.floor(rng() * tileSize);
      const y = Math.floor(rng() * tileSize);
      const mag = rng() * 0.8 + 0.2;
      const r = rng() * 0.9 + 0.1;
      ctx.save();
      ctx.globalAlpha = 0.6 * mag;
      ctx.shadowBlur = 2 + 4 * rng();
      ctx.shadowColor = 'white';
      ctx.fillStyle = 'white';
      ctx.beginPath();
      ctx.arc(x + 0.5, y + 0.5, 0.5 + r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    const dustDots = Math.floor(0.06 * tileSize);
    ctx.save();
    for (let i = 0; i < dustDots; i++) {
      const x = Math.floor(rng() * tileSize);
      const y = Math.floor(rng() * tileSize);
      ctx.globalAlpha = 0.035 * (rng() * 0.6 + 0.4);
      ctx.fillStyle = '#fff';
      ctx.fillRect(x, y, 1, 1);
    }
    ctx.restore();
    return tile;
  }
}
