import { Service, computed, inject, linkedSignal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { rxResource } from '@angular/core/rxjs-interop';
import { EMPTY, Observable, expand, filter, map, of } from 'rxjs';
import { MusicSearch } from '../music-search/music-search';

/** The subset of release data the app uses. */
export interface Release {
  id: string;
  /** Partial ISO date string, e.g. "1959", "1959-08" or "1959-08-17"; null if unknown. */
  date: string | null;
  title: string;
}

/** An artist's releases, newest first, plus how many MusicBrainz has in all. */
export interface ReleaseList {
  releases: Release[];
  /** Official US/GB releases MusicBrainz reports for the artist; more than `releases.length` when capped. */
  total: number;
}

/** The shape of a release as returned by the API (only the fields we read). */
interface ApiRelease {
  id: string;
  title: string;
  date?: string | 'Undated';
  status?: string | null;
  country?: string | null;
}

interface ReleaseSearchResponse {
  count: number;
  releases: ApiRelease[];
}

const RELEASE_SEARCH_URL = 'https://musicbrainz.org/ws/2/release';
const ALLOWED_COUNTRIES = new Set(['US', 'GB']);

/** Releases per request; MusicBrainz's maximum. */
export const PAGE_SIZE = 100;
/** The most releases the app keeps for one artist (the newest ones). */
export const MAX_RELEASES = 500;
/** Hard stop on requests per artist (~11 s at one request per second). */
export const MAX_REQUESTS = 10;
/** Size of each date window when an artist has more than MAX_RELEASES releases. */
export const WINDOW_YEARS = 10;
/** The date-window walk stops before going earlier than this. */
export const EARLIEST_YEAR = 1900;
/** Releases shown per page of the on-screen list. */
export const RELEASES_PER_SCREEN = 25;

const EMPTY_LIST: ReleaseList = { releases: [], total: 0 };

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

/**
 * Keeps only official US/GB releases (search matches a little more loosely than this),
 * drops duplicates, trims each one to id, date and title, and sorts them newest first.
 */
function toOfficialReleases(releases: ApiRelease[]): Release[] {
  const byId = new Map<string, Release>();
  for (const r of releases) {
    if (r.status === 'Official' && ALLOWED_COUNTRIES.has(r.country ?? '')) {
      byId.set(r.id, { id: r.id, date: r.date || null, title: r.title });
    }
  }
  return [...byId.values()].sort(compareReleases);
}

/**
 * MusicBrainz search query for an artist's official US/GB releases, optionally limited to
 * release dates from `fromYear` to `toYear` (null = no upper bound, so future and partial dates count).
 */
export function releaseQuery(artistId: string, fromYear?: number, toYear: number | null = null): string {
  const base = `arid:"${artistId}" AND status:official AND (country:US OR country:GB)`;
  return fromYear === undefined ? base : `${base} AND date:[${fromYear} TO ${toYear ?? '*'}]`;
}

/** Where the fetch has got to. Each step makes one request and returns the next state. */
interface FetchState {
  /** The query being paged through: the whole catalog, or one date window. */
  query: string;
  offset: number;
  /** First year of the current date window; null while fetching the whole catalog. */
  windowStart: number | null;
  collected: ApiRelease[];
  requests: number;
  total: number;
  done: boolean;
}

/**
 * Fetches an artist's official US/GB releases and emits them once, newest first.
 *
 * Up to MAX_RELEASES releases, it simply pages through them all. With more, search results
 * aren't in date order, so it instead walks backward through WINDOW_YEARS-long date windows
 * (newest first) until it has at least MAX_RELEASES, then keeps the newest MAX_RELEASES.
 * Every request goes through HttpClient, so the MusicBrainz rate-limit/retry interceptor applies,
 * and unsubscribing cancels whatever is still pending.
 */
export function fetchNewestReleases(
  http: HttpClient,
  artistId: string,
  currentYear: number,
): Observable<ReleaseList> {
  const fetchPage = (query: string, offset: number) =>
    http.get<ReleaseSearchResponse>(RELEASE_SEARCH_URL, {
      params: { query, fmt: 'json', limit: String(PAGE_SIZE), offset: String(offset) },
    });

  const advance = (state: FetchState, page: ReleaseSearchResponse): FetchState => {
    const requests = state.requests + 1;
    const count = page.count ?? 0;

    // First response: we now know how many releases there are, and so which strategy to use.
    if (state.requests === 0) {
      if (count > MAX_RELEASES) {
        const windowStart = currentYear - WINDOW_YEARS + 1;
        return {
          query: releaseQuery(artistId, windowStart),
          offset: 0,
          windowStart,
          collected: [],
          requests,
          total: count,
          done: requests >= MAX_REQUESTS,
        };
      }
      return {
        ...state,
        offset: PAGE_SIZE,
        collected: page.releases ?? [],
        requests,
        total: count,
        done: PAGE_SIZE >= count || requests >= MAX_REQUESTS,
      };
    }

    const collected = [...state.collected, ...(page.releases ?? [])];
    const offset = state.offset + PAGE_SIZE;
    const base = { ...state, collected, requests };
    if (requests >= MAX_REQUESTS) {
      return { ...base, done: true };
    }
    // More pages left in this query (the whole catalog, or the current window).
    if (offset < count) {
      return { ...base, offset };
    }
    // Finished the whole catalog, or have enough from the windows so far.
    if (state.windowStart === null || collected.length >= MAX_RELEASES) {
      return { ...base, done: true };
    }
    // Move on to the previous window.
    const toYear = state.windowStart - 1;
    if (toYear < EARLIEST_YEAR) {
      return { ...base, done: true };
    }
    const windowStart = state.windowStart - WINDOW_YEARS;
    return { ...base, query: releaseQuery(artistId, windowStart, toYear), offset: 0, windowStart };
  };

  const start: FetchState = {
    query: releaseQuery(artistId),
    offset: 0,
    windowStart: null,
    collected: [],
    requests: 0,
    total: 0,
    done: false,
  };

  return of(start).pipe(
    expand((state) => (state.done ? EMPTY : fetchPage(state.query, state.offset).pipe(map((page) => advance(state, page))))),
    filter((state) => state.done),
    map((state) => ({
      releases: toOfficialReleases(state.collected).slice(0, MAX_RELEASES),
      total: state.total,
    })),
  );
}

@Service()
export class ReleaseSearch {
  private readonly musicSearch = inject(MusicSearch);
  private readonly http = inject(HttpClient);

  /**
   * The MusicBrainz artist id to look up releases for.
   * Follows the artist found by MusicSearch automatically, but can still be set directly.
   */
  readonly artistId = linkedSignal(() => {
    const artistResults = this.musicSearch.results;
    return artistResults.hasValue() ? (artistResults.value()?.id ?? '') : '';
  });

  /** The artist's official US/GB releases, newest first (at most MAX_RELEASES). */
  readonly results = rxResource({
    // Returning undefined means "don't fetch yet".
    params: () => this.artistId().trim() || undefined,
    stream: ({ params: artistId }) => fetchNewestReleases(this.http, artistId, new Date().getFullYear()),
    defaultValue: EMPTY_LIST,
  });

  /** The loaded releases, or none while loading or after an error. */
  private readonly releases = computed(() => (this.results.hasValue() ? this.results.value().releases : []));

  /** Which page of RELEASES_PER_SCREEN releases is shown (0-based). Back to the first page on new results. */
  readonly screen = linkedSignal({ source: this.releases, computation: () => 0 });

  readonly screenCount = computed(() => Math.ceil(this.releases().length / RELEASES_PER_SCREEN));

  readonly screenReleases = computed(() => {
    const start = this.screen() * RELEASES_PER_SCREEN;
    return this.releases().slice(start, start + RELEASES_PER_SCREEN);
  });

  nextScreen() {
    this.screen.update((s) => Math.min(s + 1, Math.max(this.screenCount() - 1, 0)));
  }

  previousScreen() {
    this.screen.update((s) => Math.max(s - 1, 0));
  }
}
