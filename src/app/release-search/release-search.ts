import { Service, inject, linkedSignal } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { MusicSearch } from '../music-search/music-search';

/** The subset of release data the app uses. */
export interface Release {
  id: string;
  /** Partial ISO date string, e.g. "1959", "1959-08" or "1959-08-17"; null if unknown. */
  date: string | null;
  title: string;
}

/** The shape of a release as returned by the API (only the fields we read). */
interface ApiRelease {
  id: string;
  title: string;
  date?: string | 'Undated';
  status?: string | null;
  country?: string | null;
}

interface ReleaseBrowseResponse {
  releases: ApiRelease[];
}

const ALLOWED_COUNTRIES = new Set(['US', 'GB']);

/**
 * Orders releases by date (newest first), then by title.
 * Dates are partial ISO strings, so plain string comparison sorts them chronologically;
 * reversing it puts the newest first ("1959-08-17" comes before "1959"). Releases with no date go last.
 */
function compareReleases(a: Release, b: Release): number {
  if (a.date !== b.date) {
    if (a.date === null) return 1;
    if (b.date === null) return -1;
    return a.date < b.date ? 1 : -1;
  }
  return a.title.localeCompare(b.title);
}

/** Keeps only official US/GB releases, trims each one to id, date and title, and sorts them. */
function toOfficialReleases(raw: unknown): Release[] {
  const releases = (raw as ReleaseBrowseResponse).releases ?? [];
  return releases
    .filter((r) => r.status === 'Official' && ALLOWED_COUNTRIES.has(r.country ?? ''))
    .map((r) => ({ id: r.id, date: r.date || null, title: r.title }))
    .sort(compareReleases);
}

@Service()
export class ReleaseSearch {
  private readonly musicSearch = inject(MusicSearch);

  /**
   * The MusicBrainz artist id to look up releases for.
   * Follows the artist found by MusicSearch automatically, but can still be set directly.
   */
  readonly artistId = linkedSignal(() => {
    const artistResults = this.musicSearch.results;
    return artistResults.hasValue() ? (artistResults.value()?.id ?? '') : '';
  });

  readonly results = httpResource(
    () => {
      const artist = this.artistId().trim();
      // Returning undefined means "don't fetch yet"
      return artist
        ? { url: 'https://musicbrainz.org/ws/2/release', params: { artist, fmt: 'json', limit: '100' } }
        : undefined;
    },
    { parse: toOfficialReleases, defaultValue: [] },
  );
}
