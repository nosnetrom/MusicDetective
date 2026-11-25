import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_RELEASES, MAX_REQUESTS, PAGE_SIZE, ReleaseSearch, releaseQuery } from './release-search';

const URL = 'https://musicbrainz.org/ws/2/release';

/** An official US release as the API returns it. */
const apiRelease = (id: string, date: string, extra: Record<string, string> = {}) => ({
  id,
  title: `Title ${id}`,
  date,
  status: 'Official',
  country: 'US',
  ...extra,
});

/** `n` official releases, all dated `date`, with ids starting at `prefix-0`. */
const many = (prefix: string, n: number, date: string) =>
  Array.from({ length: n }, (_, i) => apiRelease(`${prefix}-${i}`, date));

describe('ReleaseSearch', () => {
  let service: ReleaseSearch;
  let backend: HttpTestingController;

  beforeEach(() => {
    // Only Date is faked: the date windows count back from the current year.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-06-01T12:00:00Z'));

    // No rate-limit interceptor here: each request is issued as soon as the previous one is answered.
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ReleaseSearch);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    backend.verify();
    vi.useRealTimers();
  });

  /** Starts a search for `artistId` and returns its first request. */
  function start(artistId: string): TestRequest {
    service.artistId.set(artistId);
    TestBed.tick();
    return next();
  }

  const next = () => backend.expectOne((req) => req.url === URL);

  /** Answers `req` with one page of search results. */
  function answer(req: TestRequest, count: number, releases: unknown[]) {
    req.flush({ count, releases });
  }

  /** The resource delivers its result asynchronously, so let the app settle before reading it. */
  const settle = () => TestBed.inject(ApplicationRef).whenStable();

  const value = async () => {
    await settle();
    return service.results.value();
  };

  it('fetches one page when the artist has 100 or fewer releases, newest first', async () => {
    const req = start('a1');
    expect(req.request.params.get('query')).toBe(releaseQuery('a1'));
    expect(req.request.params.get('query')).toBe('arid:"a1" AND status:official AND (country:US OR country:GB)');
    expect(req.request.params.get('offset')).toBe('0');
    expect(req.request.params.get('limit')).toBe(String(PAGE_SIZE));

    answer(req, 4, [
      apiRelease('old', '1990'),
      apiRelease('new', '2005'),
      apiRelease('bootleg', '2010', { status: 'Bootleg' }),
      apiRelease('uk', '2000-05', { country: 'GB' }),
    ]);

    const list = await value();
    expect(list.releases.map((r) => r.id)).toEqual(['new', 'uk', 'old']);
    expect(list.total).toBe(4);
  });

  it('pages through every result when there are up to 500', async () => {
    let req = start('a1');
    answer(req, 250, many('p0', 100, '1970'));

    req = next();
    expect(req.request.params.get('offset')).toBe('100');
    answer(req, 250, many('p1', 100, '1980'));

    req = next();
    expect(req.request.params.get('offset')).toBe('200');
    answer(req, 250, many('p2', 50, '1990'));

    const list = await value();
    expect(list.releases.length).toBe(250);
    expect(list.releases[0].date).toBe('1990');
    expect(list.total).toBe(250);
  });

  it('walks back through 10-year date windows when there are more than 500, keeping the newest 500', async () => {
    answer(start('a1'), 600, many('ignored', 100, '1960'));

    let req = next();
    expect(req.request.params.get('query')).toBe(`${releaseQuery('a1')} AND date:[2017 TO *]`);
    expect(req.request.params.get('offset')).toBe('0');
    answer(req, 27, many('w1', 27, '2020'));

    req = next();
    expect(req.request.params.get('query')).toBe(`${releaseQuery('a1')} AND date:[2007 TO 2016]`);
    answer(req, 150, many('w2a', 100, '2010'));
    req = next();
    expect(req.request.params.get('offset')).toBe('100');
    answer(req, 150, many('w2b', 50, '2010'));

    // The whole of the last window is fetched, because search results aren't in date order.
    for (let page = 0; page < 4; page++) {
      req = next();
      expect(req.request.params.get('query')).toBe(`${releaseQuery('a1')} AND date:[1997 TO 2006]`);
      expect(req.request.params.get('offset')).toBe(String(page * 100));
      answer(req, 400, many(`w3-${page}`, 100, page === 0 ? '2006' : '1998'));
    }

    // 27 + 150 + 400 = 577 collected, so no further window is requested.
    const list = await value();
    expect(list.releases.length).toBe(MAX_RELEASES);
    expect(list.releases[0].date).toBe('2020');
    expect(list.releases.filter((r) => r.date === '2006').length).toBe(100);
    expect(list.releases.at(-1)?.date).toBe('1998');
    expect(list.total).toBe(600);
  });

  it(`stops after ${MAX_REQUESTS} requests`, async () => {
    answer(start('a1'), 5000, []);
    for (let i = 1; i < MAX_REQUESTS; i++) {
      answer(next(), 1000, many(`p${i}`, 100, '2020'));
    }
    // backend.verify() in afterEach confirms no request after the limit.
    const list = await value();
    expect(list.releases.length).toBe(MAX_RELEASES);
    expect(list.total).toBe(5000);
  });

  it('cancels the remaining requests when the artist changes', async () => {
    const first = start('a1');
    answer(first, 250, many('a1', 100, '1970'));
    const pending = next();

    service.artistId.set('a2');
    TestBed.tick();
    expect(pending.cancelled).toBe(true);

    const req = next();
    expect(req.request.params.get('query')).toBe(releaseQuery('a2'));
    answer(req, 1, [apiRelease('b', '2001')]);
    expect((await value()).releases.map((r) => r.id)).toEqual(['b']);
  });

  describe('paging', () => {
    beforeEach(async () => {
      answer(start('a1'), 60, many('r', 60, '2000'));
      await settle();
    });

    it('shows 25 releases per page', async () => {
      expect(service.screenCount()).toBe(3);
      expect(service.screenReleases().length).toBe(25);
      expect(service.screenReleases()[0].id).toBe('r-0');
    });

    it('stays within the first and last page', async () => {
      service.nextScreen();
      service.nextScreen();
      service.nextScreen();
      expect(service.screen()).toBe(2);
      expect(service.screenReleases().length).toBe(10);

      service.previousScreen();
      service.previousScreen();
      service.previousScreen();
      expect(service.screen()).toBe(0);
    });

    it('goes back to the first page when new results arrive', async () => {
      service.nextScreen();
      expect(service.screen()).toBe(1);

      service.artistId.set('a2');
      TestBed.tick();
      answer(next(), 30, many('s', 30, '2001'));
      await settle();

      expect(service.screen()).toBe(0);
      expect(service.screenReleases()[0].id).toBe('s-0');
    });
  });
});
