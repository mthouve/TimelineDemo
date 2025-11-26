import { Component, Input, Signal, signal, OnInit, ElementRef, ViewChild } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BibleService } from '../services/bible.service';
import { OriginalLanguageService } from '../services/original-language.service';
import {
  BibleBook,
  BibleVerse,
  BibleReference,
  SearchResult,
  BibleChapter,
} from '../models/bible.model';

@Component({
  selector: 'app-bible-viewer',
  standalone: true,
  templateUrl: './bible-viewer.component.html',
  styleUrls: ['./bible-viewer.component.scss'],
  imports: [CommonModule, FormsModule],
})
export class BibleViewerComponent implements OnInit {
  @ViewChild('bibleContent', { read: ElementRef }) bibleContentEl?: ElementRef<HTMLElement>;
  @ViewChild('searchResultsContainer', { read: ElementRef })
  searchResultsEl?: ElementRef<HTMLElement>;

  books = signal<BibleBook[]>([]);
  selectedBook = signal<BibleBook | null>(null);
  selectedChapter = signal<number | null>(null);
  verses = signal<BibleVerse[]>([]);
  searchResults = signal<SearchResult[]>([]);
  searchQueryText = ''; // Plain property for ngModel
  loading = signal<boolean>(false);

  showOriginals = signal<boolean>(true);
  constructor(
    private bibleService: BibleService,
    private originals: OriginalLanguageService,
    private sanitizer: DomSanitizer
  ) {}

  async ngOnInit() {
    this.loading.update(() => true);
    await Promise.all([this.bibleService.loadBible(), this.originals.load()]);
    this.books.update(() => this.bibleService.getBooks());
    this.loading.update(() => false);
    // Default to Genesis 1
    const genesis = this.books().find((b: BibleBook) => b.name === 'Genesis') ?? null;
    this.selectBook(genesis);
    this.selectChapter(1);
  }

  selectBook(book: BibleBook | null) {
    this.selectedBook.update(() => book);
    this.selectedChapter.update(() => 1);
    this.updateVerses();
  }

  onBookChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    const bookName = select.value;
    const book = this.books().find((b) => b.name === bookName) ?? null;
    this.selectBook(book);
  }

  selectChapter(chapter: number) {
    this.selectedChapter.update(() => Number(chapter));
    this.updateVerses();
  }

  onChapterChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    this.selectChapter(Number(select.value));
  }

  updateVerses() {
    const book = this.selectedBook();
    const chapterNum = this.selectedChapter();
    if (!book || !chapterNum) {
      this.verses.update(() => []);
      return;
    }
    const chapter = book.chapters.find((c: BibleChapter) => c.chapter === chapterNum);
    this.verses.update(() => (chapter ? chapter.verses : []));
  }

  search() {
    const query = this.searchQueryText.trim();
    if (!query) {
      this.searchResults.update(() => []);
      return;
    }
    this.searchResults.update(() => this.bibleService.searchText(query, 100));
  }

  clearSearch() {
    this.searchQueryText = '';
    this.searchResults.update(() => []);
  }

  // Highlight state
  highlightedVerses: { [key: number]: boolean } = {};
  highlightAnimTimeout?: any;
  highlightAnimFrame?: number;
  highlightOpacity = 0;
  highlightTargetOpacity = 0;
  highlightEaseDuration = 1600; // ms for ease in/out
  highlightColor = 'rgba(255, 170, 80, 0.25)'; // dim orange

  goToReference(ref: BibleReference) {
    const book = this.books().find((b: BibleBook) => b.name === ref.book);
    if (!book) return;
    this.selectBook(book);
    this.selectChapter(ref.chapter);

    // Wait for verses to render, then scroll/highlight
    setTimeout(() => {
      this.scrollAndHighlight(ref);
    }, 0);
  }

  scrollAndHighlight(ref: BibleReference) {
    // Clear previous highlight
    this.highlightedVerses = {};
    this.highlightOpacity = 0;
    this.highlightTargetOpacity = 1;
    if (this.highlightAnimTimeout) clearTimeout(this.highlightAnimTimeout);
    if (this.highlightAnimFrame) cancelAnimationFrame(this.highlightAnimFrame);

    // Determine range
    const start = ref.verse || 1;
    const end = ref.endVerse || start;
    for (let v = start; v <= end; v++) this.highlightedVerses[v] = true;

    // Find first verse element
    const container = this.bibleContentEl?.nativeElement;
    if (!container) return;
    const verseEls = Array.from(container.querySelectorAll('.bible-verse')) as HTMLElement[];
    const firstIdx = this.verses().findIndex((v) => v.verse === start);
    if (firstIdx < 0) return;
    const verseEl = verseEls[firstIdx];
    if (!verseEl) return;

    // Scroll smoothly to verse
    verseEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Animate highlight in
    const ease = (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);
    const startTime = performance.now();
    const animateIn = (now: number) => {
      const t = Math.min(1, (now - startTime) / this.highlightEaseDuration);
      this.highlightOpacity = ease(t) * this.highlightTargetOpacity;
      if (t < 1) {
        this.highlightAnimFrame = requestAnimationFrame(animateIn);
      } else {
        this.highlightOpacity = this.highlightTargetOpacity;
        // Hold highlight for 4s, then fade out
        this.highlightAnimTimeout = setTimeout(() => this.fadeOutHighlight(), 4000);
      }
    };
    this.highlightAnimFrame = requestAnimationFrame(animateIn);
  }

  fadeOutHighlight() {
    this.highlightTargetOpacity = 0;
    const ease = (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);
    const startTime = performance.now();
    const startOpacity = this.highlightOpacity;
    const animateOut = (now: number) => {
      const t = Math.min(1, (now - startTime) / this.highlightEaseDuration);
      this.highlightOpacity = startOpacity * (1 - ease(t));
      if (t < 1) {
        this.highlightAnimFrame = requestAnimationFrame(animateOut);
      } else {
        this.highlightOpacity = 0;
        this.highlightedVerses = {};
      }
    };
    this.highlightAnimFrame = requestAnimationFrame(animateOut);
  }

  formatReference(ref: BibleReference) {
    return this.bibleService.formatReference(ref);
  }

  onWheel(event: WheelEvent, element: HTMLElement) {
    // Prevent scroll from bubbling to document when at scroll boundaries
    const atTop = element.scrollTop === 0;
    const atBottom = element.scrollTop + element.clientHeight >= element.scrollHeight;

    if ((atTop && event.deltaY < 0) || (atBottom && event.deltaY > 0)) {
      event.preventDefault();
      return;
    }

    // Stop propagation to prevent timeline from scrolling
    event.stopPropagation();
  }

  getOriginalText(
    book: string,
    chapter: number,
    verse: number
  ): { hebrew?: string; greek?: string } {
    // Hebrew applies to OT, Greek to NT
    const b = this.books().find((b) => b.name === book);
    if (!b) return {};
    const hebrew =
      b.testament === 'OT' ? this.originals.getHebrew(book, chapter, verse) : undefined;
    const greek = b.testament === 'NT' ? this.originals.getGreek(book, chapter, verse) : undefined;
    return { hebrew, greek };
  }

  toggleOriginals() {
    this.showOriginals.update((v) => !v);
  }

  formatVerseHtml(text: string): SafeHtml {
    // Detect trailing glossary-style brackets: {word: definition} or {phrase: definition}
    // There can be multiple at the end; collect them.
    let working = text.trimEnd();
    const glosses: string[] = [];
    const glossRegex = /\s*\{([^{}]*?:[^{}]*?)\}\s*$/; // non-greedy inside, requires a colon
    while (glossRegex.test(working)) {
      const m = working.match(glossRegex);
      if (!m) break;
      glosses.unshift(m[1]); // preserve original order (left to right)
      working = working.replace(glossRegex, '').trimEnd();
    }

    // Italicize remaining bracket segments (non-gloss) inline.
    const body = working.replace(/\{([^{}]+)\}/g, (_m, inner) => `<em>${inner}</em>`);

    // Append glosses dimmed.
    const glossHtml = glosses
      .map((g) => ` <span class="gloss"><em>${g}</em></span>`) // keep colon content italic but dim via CSS
      .join('');
    const finalHtml = body + glossHtml;
    return this.sanitizer.bypassSecurityTrustHtml(finalHtml);
  }
}
