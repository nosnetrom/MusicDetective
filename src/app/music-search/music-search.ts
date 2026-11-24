import { Service, signal } from '@angular/core';
import { httpResource } from '@angular/common/http';

/** An artist's active period. Dates are partial ISO strings, e.g. "1926", "1926-05" or "1926-05-26". */
export interface LifeSpan {
  begin: string | null;
  end: string | null;
}

/** The subset of artist data the app uses. */
export interface Artist {
  id: string;
  name: string;
  lifeSpan: LifeSpan;
}

/** The shape of an artist as returned by the API (only the fields we read). */
interface ApiArtist {
  id: string;
  name: string;
  'life-span'?: { begin?: string | null; end?: string | null };
}

interface ArtistSearchResponse {
  artists: ApiArtist[];
}

/** Picks only the first artist's id, name and life-span dates from the API response. */
function toFirstArtist(raw: unknown): Artist | null {
  const first = (raw as ArtistSearchResponse).artists?.[0];
  if (!first) {
    return null;
  }
  const lifeSpan = first['life-span'];
  return {
    id: first.id,
    name: first.name,
    lifeSpan: {
      begin: lifeSpan?.begin ?? null,
      end: lifeSpan?.end ?? null,
    },
  };
}

@Service()
export class MusicSearch {
  readonly query = signal('');

  /**
   * Searches for `term`. Repeating the current search re-sends the request (e.g. after the
   * interceptor has given up retrying a busy server);
   * setting a signal to the value it already holds wouldn't trigger a new fetch.
   */
  search(term: string) {
    if (term.trim() === this.query().trim()) {
      this.results.reload();
    } else {
      this.query.set(term);
    }
  }

  /**
   * Clears the search. The artist result, release list and open release all derive from
   * `query`, so resetting it clears everything; in-flight or queued requests are cancelled.
   */
  clear() {
    this.query.set('');
  }

  readonly results = httpResource(
    () => {
      const q = this.query().trim();
      // Returning undefined means "don't fetch yet"
      return q
        ? { url: 'https://musicbrainz.org/ws/2/artist', params: { query: q, fmt: 'json' } }
        : undefined;
    },
    { parse: toFirstArtist },
  );
}
