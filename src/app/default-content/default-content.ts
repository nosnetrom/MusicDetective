import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AppInfo } from '../app-info';
import { MusicSearch } from '../music-search/music-search';

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

  protected onSearch(term: string) {
    this.search.search(term);
  }

  /** Runs on the form's reset event: the browser empties the input; this clears the results. */
  protected onClear(input: HTMLInputElement) {
    this.search.clear();
    // Return keyboard and screen-reader users to where a new search starts.
    input.focus();
  }

}
