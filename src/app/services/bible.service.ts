import { Injectable } from '@angular/core';
import { Bible, BibleBook, BibleVerse, BibleReference, SearchResult } from '../models/bible.model';

interface RawBibleBook {
  name: string;
  abbrev: string;
  chapters: string[][];
}

@Injectable({
  providedIn: 'root',
})
export class BibleService {
  private bible: Bible | null = null;
  private loaded = false;

  constructor() {}

  async loadBible(version: string = 'KJV'): Promise<void> {
    if (this.loaded) return;

    // Load KJV Bible JSON
    const response = await fetch(`/assets/bible/${version.toLowerCase()}.json`);
    const rawData = (await response.json()) as RawBibleBook[];

    // Transform the data to match our model
    this.bible = {
      version,
      books: rawData.map((book) => this.transformBook(book)),
    };
    this.loaded = true;
  }

  private transformBook(raw: RawBibleBook): BibleBook {
    const testament = this.determineTestament(raw.name);

    return {
      name: raw.name,
      abbreviation: raw.abbrev,
      testament,
      chapters: raw.chapters.map((verses: string[], chapterIndex: number) => ({
        chapter: chapterIndex + 1,
        verses: verses.map((text: string, verseIndex: number) => ({
          book: raw.name,
          chapter: chapterIndex + 1,
          verse: verseIndex + 1,
          text,
        })),
      })),
    };
  }

  private determineTestament(bookName: string): 'OT' | 'NT' {
    const otBooks = [
      'Genesis',
      'Exodus',
      'Leviticus',
      'Numbers',
      'Deuteronomy',
      'Joshua',
      'Judges',
      'Ruth',
      '1 Samuel',
      '2 Samuel',
      '1 Kings',
      '2 Kings',
      '1 Chronicles',
      '2 Chronicles',
      'Ezra',
      'Nehemiah',
      'Esther',
      'Job',
      'Psalms',
      'Proverbs',
      'Ecclesiastes',
      'Song of Solomon',
      'Isaiah',
      'Jeremiah',
      'Lamentations',
      'Ezekiel',
      'Daniel',
      'Hosea',
      'Joel',
      'Amos',
      'Obadiah',
      'Jonah',
      'Micah',
      'Nahum',
      'Habakkuk',
      'Zephaniah',
      'Haggai',
      'Zechariah',
      'Malachi',
    ];
    return otBooks.includes(bookName) ? 'OT' : 'NT';
  }

  getBible(): Bible | null {
    return this.bible;
  }

  getBooks(): BibleBook[] {
    return this.bible?.books ?? [];
  }

  getBook(nameOrAbbr: string): BibleBook | undefined {
    return this.bible?.books.find(
      (b) =>
        b.name.toLowerCase() === nameOrAbbr.toLowerCase() ||
        b.abbreviation.toLowerCase() === nameOrAbbr.toLowerCase()
    );
  }

  getVerse(ref: BibleReference): BibleVerse | null {
    const book = this.getBook(ref.book);
    if (!book || !ref.verse) return null;

    const chapter = book.chapters.find((c) => c.chapter === ref.chapter);
    if (!chapter) return null;

    return chapter.verses.find((v) => v.verse === ref.verse) ?? null;
  }

  getVerseRange(ref: BibleReference): BibleVerse[] {
    const book = this.getBook(ref.book);
    if (!book || !ref.verse) return [];

    const chapter = book.chapters.find((c) => c.chapter === ref.chapter);
    if (!chapter) return [];

    const endVerse = ref.endVerse ?? ref.verse;
    return chapter.verses.filter((v) => v.verse >= ref.verse! && v.verse <= endVerse);
  }

  searchText(query: string, maxResults: number = 100): SearchResult[] {
    if (!this.bible || !query.trim()) return [];

    const results: SearchResult[] = [];
    const queryLower = query.toLowerCase();

    for (const book of this.bible.books) {
      for (const chapter of book.chapters) {
        for (const verse of chapter.verses) {
          const textLower = verse.text.toLowerCase();
          if (textLower.includes(queryLower)) {
            const matchCount = (textLower.match(new RegExp(queryLower, 'g')) || []).length;
            const preview = this.createPreview(verse.text, query);

            results.push({
              reference: {
                book: book.name,
                chapter: chapter.chapter,
                verse: verse.verse,
              },
              text: verse.text,
              matchCount,
              preview,
            });

            if (results.length >= maxResults) return results;
          }
        }
      }
    }

    return results;
  }

  private createPreview(text: string, query: string, contextChars: number = 80): string {
    const index = text.toLowerCase().indexOf(query.toLowerCase());
    if (index === -1) return text.substring(0, contextChars) + '...';

    const start = Math.max(0, index - contextChars / 2);
    const end = Math.min(text.length, index + query.length + contextChars / 2);

    let preview = text.substring(start, end);
    if (start > 0) preview = '...' + preview;
    if (end < text.length) preview = preview + '...';

    // Highlight the match
    const regex = new RegExp(`(${query})`, 'gi');
    return preview.replace(regex, '<mark>$1</mark>');
  }

  formatReference(ref: BibleReference): string {
    let result = `${ref.book} ${ref.chapter}`;
    if (ref.verse) {
      result += `:${ref.verse}`;
      if (ref.endVerse && ref.endVerse !== ref.verse) {
        result += `-${ref.endVerse}`;
      }
    }
    return result;
  }
}
