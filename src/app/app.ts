import { Component, ElementRef, inject, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { MusicSearch } from './music-search/music-search';
import { ReleaseSearch } from './release-search/release-search';
import { ReleaseSelection } from './release-selection/release-selection';
import { ReleaseDialog } from './release-dialog/release-dialog';
import { AppInfo } from './app-info';
import { Footer } from './footer/footer';

@Component({
  imports: [RouterOutlet, RouterLink, Footer, ReleaseDialog],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly title = inject(AppInfo).title;
  protected readonly year = inject(AppInfo).year;
  protected readonly author = inject(AppInfo).author;

  protected readonly search = inject(MusicSearch);
  protected readonly releaseSearch = inject(ReleaseSearch);
  protected readonly selection = inject(ReleaseSelection);

  private readonly router = inject(Router);

  /** True on the search (home) page, the only page that shows search results. */
  protected readonly isHome = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.isHomeUrl()),
    ),
    { initialValue: this.isHomeUrl() },
  );

  // Optional: the results area exists only on the home page.
  private readonly resultsArea = viewChild<ElementRef<HTMLElement>>('resultsArea');

  private readonly releaseList = viewChild<ElementRef<HTMLElement>>('releaseList');

  /** Moves focus to the results area, e.g. after a search started from the release dialog. */
  protected focusResults() {
    this.resultsArea()?.nativeElement.focus();
  }

  /** The current path, without any query string or fragment, is the home page. */
  private isHomeUrl() {
    return this.router.url.split(/[?#]/)[0] === '/';
  }

  protected showPreviousScreen() {
    this.releaseSearch.previousScreen();
    this.focusReleaseList();
  }

  protected showNextScreen() {
    this.releaseSearch.nextScreen();
    this.focusReleaseList();
  }

  /** After a page change, start keyboard and screen-reader users at the top of the new page. */
  private focusReleaseList() {
    this.releaseList()?.nativeElement.focus();
  }
}
