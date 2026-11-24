import { Service, inject, linkedSignal } from '@angular/core';
import { Release, ReleaseSearch } from '../release-search/release-search';

/** Tracks which release (if any) is open in the details modal. */
@Service()
export class ReleaseSelection {
  private readonly releaseSearch = inject(ReleaseSearch);

  /**
   * The release shown in the details modal; null when the modal is closed.
   * Set it to open the modal. It resets to null automatically whenever the artist changes
   * (a new search, or MusicSearch.clear()), so a stale release never stays open.
   */
  readonly selected = linkedSignal<string, Release | null>({
    source: this.releaseSearch.artistId,
    computation: () => null,
  });
}
