import { Component, ElementRef, inject, viewChild } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MusicSearch } from './music-search/music-search';
import { ReleaseSearch } from './release-search/release-search';
import { ReleaseSelection } from './release-selection/release-selection';
import { ReleaseDialog } from './release-dialog/release-dialog';
import { AppInfo } from './app-info';
import { Footer } from './footer/footer';

@Component({
  imports: [RouterOutlet, Footer, ReleaseDialog],
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

  private readonly resultsArea = viewChild.required<ElementRef<HTMLElement>>('resultsArea');

  /** Moves focus to the results area, e.g. after a search started from the release dialog. */
  protected focusResults() {
    this.resultsArea().nativeElement.focus();
  }
}
