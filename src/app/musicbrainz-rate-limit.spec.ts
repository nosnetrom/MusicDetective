import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MUSICBRAINZ_MIN_INTERVAL_MS, musicBrainzRateLimit } from './musicbrainz-rate-limit';

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
});
