import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { defer, retry, switchMap, throwError, timer } from 'rxjs';

/** MusicBrainz allows about one request per second per client; the extra 100 ms is a safety margin. */
export const MUSICBRAINZ_MIN_INTERVAL_MS = 1100;

/** How long to wait before re-sending a request the server was too busy to answer. */
export const MUSICBRAINZ_RETRY_DELAY_MS = 3000;

/** How long to keep retrying a busy request before giving up and reporting the error. */
export const MUSICBRAINZ_RETRY_WINDOW_MS = 30000;

const MUSICBRAINZ_API = 'https://musicbrainz.org/ws/2/';

/**
 * Statuses that mean "busy, try again later": 503 (overloaded / rate-limited), 429 (too many
 * requests) and 0 (the browser hid the response, which happens when a busy reply lacks CORS headers).
 */
const RETRYABLE_STATUSES = new Set([0, 429, 503]);

function isRetryable(err: unknown): boolean {
  return err instanceof HttpErrorResponse && RETRYABLE_STATUSES.has(err.status);
}

/** Hands out send times for MusicBrainz requests, spaced at least MUSICBRAINZ_MIN_INTERVAL_MS apart. */
@Service()
export class MusicBrainzQueue {
  /** Earliest time (epoch ms) the next request may be sent. */
  private nextSlot = 0;

  /** Reserves the next free send time and returns how many ms to wait for it. */
  reserve(now = Date.now()): number {
    const slot = Math.max(now, this.nextSlot);
    this.nextSlot = slot + MUSICBRAINZ_MIN_INTERVAL_MS;
    return slot - now;
  }
}

/**
 * Queues MusicBrainz requests so they go out in order, no faster than the API's rate limit, and
 * re-sends a request every MUSICBRAINZ_RETRY_DELAY_MS while the server is busy, for up to
 * MUSICBRAINZ_RETRY_WINDOW_MS. Until then the caller just sees a request still in progress.
 * Other requests pass straight through.
 */
export const musicBrainzRateLimit: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(MUSICBRAINZ_API)) {
    return next(req);
  }

  const queue = inject(MusicBrainzQueue);

  // defer: the slot is reserved when the request is actually sent (subscribed), not when it's built.
  // Each retry resubscribes, so it takes a fresh slot in the queue.
  const queued = defer(() => {
    const wait = queue.reserve();
    return wait > 0 ? timer(wait).pipe(switchMap(() => next(req))) : next(req);
  });

  return defer(() => {
    const start = Date.now();
    return queued.pipe(
      retry({
        delay: (err: unknown) =>
          isRetryable(err) && Date.now() - start + MUSICBRAINZ_RETRY_DELAY_MS <= MUSICBRAINZ_RETRY_WINDOW_MS
            ? timer(MUSICBRAINZ_RETRY_DELAY_MS)
            : throwError(() => err),
      }),
    );
  });
};
