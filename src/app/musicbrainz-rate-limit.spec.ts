import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MUSICBRAINZ_MIN_INTERVAL_MS,
  MUSICBRAINZ_RETRY_DELAY_MS,
  MUSICBRAINZ_RETRY_WINDOW_MS,
  musicBrainzRateLimit,
} from './musicbrainz-rate-limit';

describe('musicBrainzRateLimit', () => {
  let http: HttpClient;
  let backend: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([musicBrainzRateLimit])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    backend.verify();
    vi.useRealTimers();
  });

  const sent = (url: string) => backend.match(url).length;

  it('sends the first request immediately and spaces out the rest in order', () => {
    http.get('https://musicbrainz.org/ws/2/artist').subscribe();
    http.get('https://musicbrainz.org/ws/2/release').subscribe();
    http.get('https://musicbrainz.org/ws/2/release/abc').subscribe();

    expect(sent('https://musicbrainz.org/ws/2/artist')).toBe(1);
    expect(sent('https://musicbrainz.org/ws/2/release')).toBe(0);

    vi.advanceTimersByTime(MUSICBRAINZ_MIN_INTERVAL_MS - 1);
    expect(sent('https://musicbrainz.org/ws/2/release')).toBe(0);

    vi.advanceTimersByTime(1);
    expect(sent('https://musicbrainz.org/ws/2/release')).toBe(1);
    expect(sent('https://musicbrainz.org/ws/2/release/abc')).toBe(0);

    vi.advanceTimersByTime(MUSICBRAINZ_MIN_INTERVAL_MS);
    expect(sent('https://musicbrainz.org/ws/2/release/abc')).toBe(1);
  });

  it('does not delay a request once the interval has passed', () => {
    http.get('https://musicbrainz.org/ws/2/artist').subscribe();
    expect(sent('https://musicbrainz.org/ws/2/artist')).toBe(1);

    vi.advanceTimersByTime(MUSICBRAINZ_MIN_INTERVAL_MS * 3);
    http.get('https://musicbrainz.org/ws/2/release').subscribe();
    expect(sent('https://musicbrainz.org/ws/2/release')).toBe(1);
  });

  it('leaves non-MusicBrainz requests alone', () => {
    http.get('https://musicbrainz.org/ws/2/artist').subscribe();
    http.get('/assets/data.json').subscribe();

    expect(sent('https://musicbrainz.org/ws/2/artist')).toBe(1);
    expect(sent('/assets/data.json')).toBe(1);
  });

  describe('retrying busy requests', () => {
    const ARTIST = 'https://musicbrainz.org/ws/2/artist';
    const busy = { status: 503, statusText: 'Service Unavailable' };

    it('re-sends a 503 after the retry delay and delivers the eventual success', () => {
      const next = vi.fn();
      const error = vi.fn();
      http.get(ARTIST).subscribe({ next, error });

      backend.expectOne(ARTIST).flush(null, busy);
      expect(error).not.toHaveBeenCalled();

      vi.advanceTimersByTime(MUSICBRAINZ_RETRY_DELAY_MS - 1);
      expect(sent(ARTIST)).toBe(0);

      vi.advanceTimersByTime(1);
      backend.expectOne(ARTIST).flush({ artists: [] });

      expect(next).toHaveBeenCalledWith({ artists: [] });
      expect(error).not.toHaveBeenCalled();
    });

    it('gives up and reports the error once the retry window has passed', () => {
      const error = vi.fn();
      http.get(ARTIST).subscribe({ error });

      let attempts = 0;
      while (!error.mock.calls.length) {
        backend.expectOne(ARTIST).flush(null, busy);
        attempts++;
        vi.advanceTimersByTime(MUSICBRAINZ_RETRY_DELAY_MS);
      }

      // First try plus one retry every 3 s up to the 30 s mark.
      expect(attempts).toBe(MUSICBRAINZ_RETRY_WINDOW_MS / MUSICBRAINZ_RETRY_DELAY_MS + 1);
      expect(error.mock.calls[0][0].status).toBe(503);

      vi.advanceTimersByTime(MUSICBRAINZ_RETRY_WINDOW_MS);
      expect(sent(ARTIST)).toBe(0);
    });

    it('does not retry errors that are not "busy" responses', () => {
      const error = vi.fn();
      http.get(ARTIST).subscribe({ error });

      backend.expectOne(ARTIST).flush(null, { status: 404, statusText: 'Not Found' });
      expect(error).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(MUSICBRAINZ_RETRY_DELAY_MS);
      expect(sent(ARTIST)).toBe(0);
    });

    it('does not retry non-MusicBrainz requests', () => {
      const error = vi.fn();
      http.get('/assets/data.json').subscribe({ error });

      backend.expectOne('/assets/data.json').flush(null, busy);
      expect(error).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(MUSICBRAINZ_RETRY_DELAY_MS);
      expect(sent('/assets/data.json')).toBe(0);
    });
  });
});
