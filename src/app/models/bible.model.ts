export interface BibleVerse {
  book: string;
  chapter: number;
  verse: number;
  text: string;
  // Optional timeline event references
  timelineEvents?: string[];
}

export interface BibleChapter {
  chapter: number;
  verses: BibleVerse[];
}

export interface BibleBook {
  name: string;
  abbreviation: string;
  chapters: BibleChapter[];
  testament: 'OT' | 'NT';
}

export interface Bible {
  version: string; // "KJV", "Torah", "Quran", etc.
  books: BibleBook[];
}

export interface BibleReference {
  book: string;
  chapter: number;
  verse?: number; // Optional for whole chapter references
  endVerse?: number; // For verse ranges
}

export interface SearchResult {
  reference: BibleReference;
  text: string;
  matchCount: number;
  preview: string; // Highlighted excerpt
}
