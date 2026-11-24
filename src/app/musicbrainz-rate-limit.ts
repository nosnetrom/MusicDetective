import { HttpInterceptorFn } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { defer, switchMap, timer } from 'rxjs';

/** MusicBrainz allows about one request per second per client; the extra 100 ms is a safety margin. */
export const MUSICBRAINZ_MIN_INTERVAL_MS = 1100;

const MUSICBRAINZ_API = 'https://musicbrainz.org/ws/2/';

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
 * Queues MusicBrainz requests so they go out in order, no faster than the API's rate limit.
 * Other requests pass straight through.
 */
export const musicBrainzRateLimit: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(MUSICBRAINZ_API)) {
    return next(req);
  }

  const queue = inject(MusicBrainzQueue);

  // defer: the slot is reserved when the request is actually sent (subscribed), not when it's built.
  return defer(() => {
    const wait = queue.reserve();
    return wait > 0 ? timer(wait).pipe(switchMap(() => next(req))) : next(req);
  });
};
