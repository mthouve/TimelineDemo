import { Component, Input, Signal, signal, OnInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BibleService } from '../services/bible.service';
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
  @ViewChild('searchResultsContainer', { read: ElementRef }) searchResultsEl?: ElementRef<HTMLElement>;

  books = signal<BibleBook[]>([]);
  selectedBook = signal<BibleBook | null>(null);
  selectedChapter = signal<number | null>(null);
  verses = signal<BibleVerse[]>([]);
  searchResults = signal<SearchResult[]>([]);
  searchQueryText = ''; // Plain property for ngModel
  loading = signal<boolean>(false);

  constructor(private bibleService: BibleService) {}

  async ngOnInit() {
    this.loading.update(() => true);
    await this.bibleService.loadBible();
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

  goToReference(ref: BibleReference) {
    const book = this.books().find((b: BibleBook) => b.name === ref.book);
    if (!book) return;
    this.selectBook(book);
    this.selectChapter(ref.chapter);
    // Optionally scroll to verse
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
}
