// ...existing code...
import {
  Component,
  Input,
  Signal,
  signal,
  OnInit,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
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
import { TimelineEntry } from '../models/timeline-entry.model';
import { TimelineSource } from '../data/timeline-points';

interface BibleSupplementalReference {
  book: string;
  chapter: number;
  verse?: number;
  endVerse?: number;
}

@Component({
  selector: 'app-bible-viewer',
  standalone: true,
  templateUrl: './bible-viewer.component.html',
  styleUrls: ['./bible-viewer.component.scss'],
  imports: [CommonModule, FormsModule],
})
export class BibleViewerComponent implements OnInit, AfterViewInit, OnChanges {
  // Animation state for page slide
  pageSlideDirection: 'left' | 'right' | null = null;
  lastBookIndex: number | null = null;
  lastChapter: number | null = null;
  isFirstLoad: boolean = true;
  // ...existing code...
  /**
   * Optionally set this input to highlight a passage on load (e.g. { book: 'Luke', chapter: 5, verse: 17, endVerse: 26 })
   */
  @Input() initialHighlightReference?: BibleReference;
  @Input() supplementalEntries: TimelineEntry[] = [];
  private initialHighlightTriggered = false;
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
  supplementalByVerse = new Map<number, TimelineEntry[]>();
  activeSupplementalVerse: number | null = null;
  activeSupplementalEntries: TimelineEntry[] = [];

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

  ngAfterViewInit() {
    // If initialHighlightReference is set, trigger highlight after view is ready
    if (this.initialHighlightReference && !this.initialHighlightTriggered) {
      setTimeout(() => {
        this.goToReference(this.initialHighlightReference!);
        this.initialHighlightTriggered = true;
      }, 0);
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['supplementalEntries']) {
      this.rebuildSupplementalIndex();
    }
  }

  selectBook(book: BibleBook | null) {
    const booksArr = this.books();
    const newBookIdx = book ? booksArr.findIndex((b) => b.name === book.name) : -1;
    let direction: 'left' | 'right' | null = null;
    if (this.lastBookIndex !== null && newBookIdx !== -1) {
      direction = newBookIdx > this.lastBookIndex ? 'left' : 'right';
    }
    this.pageSlideDirection = direction;
    this.selectedBook.update(() => book);
    this.selectedChapter.update(() => 1);
    this.updateVerses();
    this.hideSupplementalPanel();
    this.resetScrollToTop();
    this.lastBookIndex = newBookIdx;
    this.lastChapter = 1;
    this.isFirstLoad = false;
    setTimeout(() => (this.pageSlideDirection = null), 600);
  }

  onBookChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    const bookName = select.value;
    const book = this.books().find((b) => b.name === bookName) ?? null;
    this.selectBook(book);
  }

  selectChapter(chapter: number) {
    const prevChapter = this.lastChapter;
    let direction: 'left' | 'right' | null = null;
    if (prevChapter !== null && chapter !== prevChapter) {
      direction = chapter > prevChapter ? 'left' : 'right';
    }
    this.pageSlideDirection = direction;
    this.selectedChapter.update(() => Number(chapter));
    this.updateVerses();
    this.hideSupplementalPanel();
    this.resetScrollToTop();
    this.lastChapter = chapter;
    this.isFirstLoad = false;
    setTimeout(() => (this.pageSlideDirection = null), 600);
  }
  resetScrollToTop() {
    // Reset scroll position to top of bible content
    setTimeout(() => {
      if (this.bibleContentEl?.nativeElement) {
        this.bibleContentEl.nativeElement.scrollTop = 0;
      }
    }, 0);
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
      this.rebuildSupplementalIndex();
      return;
    }
    const chapter = book.chapters.find((c: BibleChapter) => c.chapter === chapterNum);
    this.verses.update(() => (chapter ? chapter.verses : []));
    this.rebuildSupplementalIndex();
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

  hasSupplementalForVerse(verse: number): boolean {
    return (this.supplementalByVerse.get(verse)?.length ?? 0) > 0;
  }

  toggleSupplementalForVerse(verse: number) {
    if (this.activeSupplementalVerse === verse) {
      this.hideSupplementalPanel();
      return;
    }

    this.activeSupplementalVerse = verse;
    this.activeSupplementalEntries = this.supplementalByVerse.get(verse) ?? [];
  }

  hideSupplementalPanel() {
    this.activeSupplementalVerse = null;
    this.activeSupplementalEntries = [];
  }

  supplementalPanelTitle(): string {
    const book = this.selectedBook();
    const chapter = this.selectedChapter();
    if (!book || !chapter || this.activeSupplementalVerse == null) return 'Supplemental Notes';
    return `${book.abbreviation} ${chapter}:${this.activeSupplementalVerse}`;
  }

  externalSourceUrl(source: TimelineSource): string | null {
    if (source.type === 'link') return source.url ?? null;
    if (source.type === 'youtube' && source.youtubeId) {
      return `https://www.youtube.com/watch?v=${source.youtubeId}`;
    }
    return null;
  }

  private rebuildSupplementalIndex() {
    this.supplementalByVerse.clear();

    const book = this.selectedBook();
    const chapter = this.selectedChapter();
    const verses = this.verses();
    if (!book || !chapter || !verses.length || !this.supplementalEntries.length) return;

    const verseNumbers = new Set(verses.map((verse) => verse.verse));
    for (const entry of this.supplementalEntries) {
      const refs = entry.sources
        ?.filter((source) => source.type === 'bible' && source.reference)
        .map((source) => this.parseSupplementalReference(source.reference!))
        .filter((ref): ref is BibleSupplementalReference => !!ref);

      if (!refs?.length) continue;

      for (const ref of refs) {
        if (ref.book !== book.name || ref.chapter !== chapter) continue;

        const start = ref.verse ?? Math.min(...verseNumbers);
        const end = ref.endVerse ?? start;
        for (let verse = start; verse <= end; verse++) {
          if (!verseNumbers.has(verse)) continue;
          const entries = this.supplementalByVerse.get(verse) ?? [];
          if (!entries.includes(entry)) entries.push(entry);
          this.supplementalByVerse.set(verse, entries);
        }
      }
    }
  }

  private parseSupplementalReference(reference: string): BibleSupplementalReference | null {
    const match = reference.match(/^(.*?)\s+(\d+)(?::(\d+)(?:-(\d+))?)?$/);
    if (!match) return null;

    return {
      book: match[1],
      chapter: Number(match[2]),
      verse: match[3] ? Number(match[3]) : undefined,
      endVerse: match[4] ? Number(match[4]) : undefined,
    };
  }

  // Highlight state
  highlightedVerses: { [key: number]: boolean } = {};
  highlightAnimTimeout?: any;
  highlightAnimFrame?: number;
  highlightOpacity = 0;
  highlightTargetOpacity = 0;
  highlightEaseDuration = 2000; // ms for ease in/out (slower)
  scrollDuration = 3500; // ms for custom smooth scroll (3.5s)
  highlightColor = 'rgba(80, 50, 0, 0.32)'; // darker, less saturated orange

  goToReference(ref: BibleReference) {
    const booksArr = this.books();
    const book = booksArr.find((b: BibleBook) => b.name === ref.book);
    if (!book) return;
    const currentBook = this.selectedBook();
    const currentChapter = this.selectedChapter();
    const newBookIdx = booksArr.findIndex((b) => b.name === book.name);
    const currentBookIdx = currentBook
      ? booksArr.findIndex((b) => b.name === currentBook.name)
      : -1;
    const changingBook = !currentBook || currentBook.name !== book.name;
    const changingChapter = currentChapter !== ref.chapter;

    // Only animate if not first load
    if (!this.isFirstLoad && (changingBook || changingChapter)) {
      let direction: 'left' | 'right' | null = null;
      if (changingBook && currentBookIdx !== -1 && newBookIdx !== -1) {
        direction = newBookIdx > currentBookIdx ? 'left' : 'right';
      } else if (changingChapter && currentChapter !== null) {
        direction = ref.chapter > currentChapter ? 'left' : 'right';
      }
      this.pageSlideDirection = direction;
      setTimeout(() => (this.pageSlideDirection = null), 600);
    }

    if (changingBook) {
      this.selectedBook.update(() => book);
      this.selectedChapter.update(() => 1);
      this.updateVerses();
      this.resetScrollToTop();
      this.lastBookIndex = newBookIdx;
      this.lastChapter = 1;
    }
    if (changingBook || changingChapter) {
      this.selectedChapter.update(() => Number(ref.chapter));
      this.updateVerses();
      this.hideSupplementalPanel();
      this.resetScrollToTop();
      this.lastChapter = ref.chapter;
    }
    this.isFirstLoad = false;

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
    // Highlight all verses in the range that exist in the current chapter
    const versesArr = this.verses();
    for (const v of versesArr) {
      if (v.verse >= start && v.verse <= end) {
        this.highlightedVerses[v.verse] = true;
      }
    }

    // Start highlight animation immediately for all verses in range
    this.animateHighlightIn(start, end);

    // Find first verse element
    const container = this.bibleContentEl?.nativeElement;
    if (!container) return;
    const verseEls = Array.from(container.querySelectorAll('.bible-verse')) as HTMLElement[];
    const firstIdx = versesArr.findIndex((v) => v.verse === start);
    if (firstIdx < 0) return;
    const verseEl = verseEls[firstIdx];
    if (!verseEl) return;

    // Custom smooth scroll to verse (centered)
    const containerRect = container.getBoundingClientRect();
    const verseRect = verseEl.getBoundingClientRect();
    const scrollTop = container.scrollTop;
    const offset =
      verseRect.top - containerRect.top - container.clientHeight / 2 + verseRect.height / 2;
    const targetScroll = scrollTop + offset;
    const startScroll = scrollTop;
    const duration = this.scrollDuration;
    // Smoother ease: cubic ease in/out (slower start and end)
    const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const scrollStartTime = performance.now();
    const animateScroll = (now: number) => {
      const t = Math.min(1, (now - scrollStartTime) / duration);
      container.scrollTop = startScroll + (targetScroll - startScroll) * ease(t);
      if (t < 1) {
        requestAnimationFrame(animateScroll);
      } else {
        container.scrollTop = targetScroll;
      }
    };
    animateScroll(scrollStartTime);
  }

  animateHighlightIn(start: number, end: number) {
    // Animate highlight in for all highlighted verses
    const ease = (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);
    const startTime = performance.now();
    const animateIn = (now: number) => {
      const t = Math.min(1, (now - startTime) / this.highlightEaseDuration);
      this.highlightOpacity = ease(t) * this.highlightTargetOpacity;
      // Update all highlighted verses' opacity
      for (let v = start; v <= end; v++) {
        if (this.highlightedVerses[v]) {
          // No-op: the template uses highlightOpacity for all highlighted
        }
      }
      if (t < 1) {
        this.highlightAnimFrame = requestAnimationFrame(animateIn);
      } else {
        this.highlightOpacity = this.highlightTargetOpacity;
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
