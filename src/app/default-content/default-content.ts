import { Component, DOCUMENT, DestroyRef, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AppInfo } from '../app-info';
import { MusicSearch } from '../music-search/music-search';

/** Matches the buttons' `transition-duration` in default-content.css; keep the two in sync. */
const CLEAR_ANIMATION_MS = 333;

@Component({
  imports: [RouterLink],
  selector: 'app-default-content',
  styleUrl: './default-content.css',
  templateUrl: './default-content.html',
})
export class DefaultContent {
  protected readonly title = inject(AppInfo).title;
  protected readonly year = inject(AppInfo).year;
  protected readonly author = inject(AppInfo).author; 

  protected readonly search = inject(MusicSearch);

  private readonly reducedMotion =
    inject(DOCUMENT).defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  /** A clear waiting for the Clear button's animation to finish. */
  private pendingClear?: ReturnType<typeof setTimeout>;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.cancelPendingClear());
  }

  protected onSearch(term: string) {
    // A new search wins over a clear that hasn't happened yet.
    this.cancelPendingClear();
    this.search.search(term);
  }

  /**
   * Runs on the form's reset event: the browser empties the input; this clears the results.
   * The clear waits for the button's transition to finish, unless the user prefers reduced motion
   * (the transition is turned off then, so there's nothing to wait for).
   */
  protected onClear(input: HTMLInputElement) {
    // Return keyboard and screen-reader users to where a new search starts.
    input.focus();

    this.cancelPendingClear();
    if (this.reducedMotion) {
      this.search.clear();
      return;
    }
    this.pendingClear = setTimeout(() => {
      this.pendingClear = undefined;
      this.search.clear();
    }, CLEAR_ANIMATION_MS);
  }

  private cancelPendingClear() {
    clearTimeout(this.pendingClear);
    this.pendingClear = undefined;
  }

}
