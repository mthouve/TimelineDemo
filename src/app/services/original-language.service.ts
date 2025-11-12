import { Injectable } from '@angular/core';

interface WlcStructure {
  translation: string;
  books: {
    name: string;
    chapters: { chapter: number; verses: { verse: number; text: string }[] }[];
  }[];
}
interface ByzStructure {
  translation: string;
  books: {
    name: string;
    chapters: { chapter: number; verses: { verse: number; text: string }[] }[];
  }[];
}

@Injectable({ providedIn: 'root' })
export class OriginalLanguageService {
  private wlc: WlcStructure | null = null;
  private byz: ByzStructure | null = null;
  private loaded = false;

  async load(): Promise<void> {
    if (this.loaded) return;
    // Hebrew OT
    const wlcResp = await fetch('/assets/bible/wlc.json');
    this.wlc = await wlcResp.json();
    // Greek NT
    const byzResp = await fetch('/assets/bible/byz.json');
    this.byz = await byzResp.json();
    this.loaded = true;
  }

  getHebrew(book: string, chapter: number, verse: number): string | undefined {
    if (!this.wlc) return undefined;
    const b = this.wlc.books.find((b) => b.name === book);
    if (!b) return undefined;
    const c = b.chapters.find((c) => c.chapter === chapter);
    if (!c) return undefined;
    const v = c.verses.find((v) => v.verse === verse);
    const text = v?.text?.trim();
    return text ? text : undefined;
  }

  getGreek(book: string, chapter: number, verse: number): string | undefined {
    if (!this.byz) return undefined;
    const b = this.byz.books.find((b) => b.name === book);
    if (!b) return undefined;
    const c = b.chapters.find((c) => c.chapter === chapter);
    if (!c) return undefined;
    const v = c.verses.find((v) => v.verse === verse);
    const text = v?.text?.trim();
    // Byz JSON includes empty strings for OT books; treat empty as undefined
    return text ? text : undefined;
  }
}
