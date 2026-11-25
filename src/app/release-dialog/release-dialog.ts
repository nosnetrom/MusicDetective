import { Component, ElementRef, afterRenderEffect, computed, inject, linkedSignal, model, output, viewChild } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { MusicSearch } from '../music-search/music-search';
import { Release } from '../release-search/release-search';
import { toTrackCredits } from './release-credits';

const RELEASE_INCLUDES = 'artist-credits+recordings+recording-level-rels+artist-rels';

/**
 * Modal showing details for one release, including who played what on each track.
 * Opens when `release` is set and clears `release` when closed (Esc, Close button or backdrop click).
 */
@Component({
  imports: [NgOptimizedImage],
  selector: 'app-release-dialog',
  template: `
    <dialog
      #dialog
      aria-labelledby="release-dialog-title"
      (close)="release.set(null)"
      (click)="closeOnBackdrop($event)"
    >
      @if (release(); as r) {
        <header>
          
          <div id="release-heading">
            <div>
              <h2 id="release-dialog-title">{{ r.title }}</h2>
              <dl>
                <dt>Release date</dt>
                <dd>{{ r.date ?? 'Unknown' }}</dd>
                <!-- <dt>MBID</dt>
                <dd><code>{{ r.id }}</code></dd> -->
              </dl>
            </div>
            <div class="media">
              <div class="cover-frame">
                @if (coverState() === 'missing') {
                  <span class="cover-missing">No cover art</span>
                } @else {
                  @if (coverState() === 'loading') {
                    <img class="cover-loading" ngSrc="assets/loading.gif" width="128" height="128" alt="Loading cover art" />
                  }
                  @if (coverUrl(); as cover) {
                    <img
                      class="cover"
                      [class.is-loading]="coverState() === 'loading'"
                      [ngSrc]="cover"
                      width="125"
                      height="125"
                      alt="Front cover of {{ r.title }}"
                      (load)="coverState.set('loaded')"
                      (error)="coverState.set('missing')"
                    />
                  }
                }
              </div>
            @if (youtubeUrl(); as url) {
              <p class="listen">
                <a [href]="url" target="_blank" rel="noopener">
  <svg aria-hidden="true" focusable="false" width="80px" height="80px" viewBox="0 -7 48 48" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
      <g id="Icons" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
          <g id="Color-" transform="translate(-200.000000, -368.000000)" fill="#CE1312">
              <path d="M219.044,391.269916 L219.0425,377.687742 L232.0115,384.502244 L219.044,391.269916 Z M247.52,375.334163 C247.52,375.334163 247.0505,372.003199 245.612,370.536366 C243.7865,368.610299 241.7405,368.601235 240.803,368.489448 C234.086,368 224.0105,368 224.0105,368 L223.9895,368 C223.9895,368 213.914,368 207.197,368.489448 C206.258,368.601235 204.2135,368.610299 202.3865,370.536366 C200.948,372.003199 200.48,375.334163 200.48,375.334163 C200.48,375.334163 200,379.246723 200,383.157773 L200,386.82561 C200,390.73817 200.48,394.64922 200.48,394.64922 C200.48,394.64922 200.948,397.980184 202.3865,399.447016 C204.2135,401.373084 206.612,401.312658 207.68,401.513574 C211.52,401.885191 224,402 224,402 C224,402 234.086,401.984894 240.803,401.495446 C241.7405,401.382148 243.7865,401.373084 245.612,399.447016 C247.0505,397.980184 247.52,394.64922 247.52,394.64922 C247.52,394.64922 248,390.73817 248,386.82561 L248,383.157773 C248,379.246723 247.52,375.334163 247.52,375.334163 L247.52,375.334163 Z" id="Youtube">

              </path>
          </g>
      </g>
  </svg><br />                
                  
                  <span>Listen on YouTube<span class="visually-hidden"> (opens in a new tab)</span></span>
                </a>
              </p>
            }
            </div>

          </div>
          <p style="margin-bottom: 1rem;">
            Click on any artist&rsquo;s name to start a new search on him/her.
          </p>
        </header>

        <section id="tracks-section">
          @if (tracks.isLoading()) {
            <p role="status"><span>Loading track details…</span></p>
          } @else if (tracks.error()) {
            <p role="alert">The server is too busy. 🥵</p>
            <button type="button" class="release-link try-again" (click)="tracks.reload()">Try again</button>
          } @else {
            <ol class="tracks">
              @for (track of tracks.value(); track track.id) {
                <li>
                  <span class="trackTitle">{{ track.title }}</span>
                  @if (track.performers.length) {
                    <ul>
                      @for (performer of track.performers; track performer.artistId) {
                        <li>
                          <button type="button" class="performer-link" (click)="searchPerformer(performer.name)">
                            <span class="visually-hidden">Search for </span><em>{{ performer.name }}</em>
                          </button>: {{ performer.instruments }}
                        </li>
                      }
                    </ul>
                  } @else {
                    <p class="none">No instrument credits listed.</p>
                  }
                </li>
              } @empty {
                <li>No tracks listed for this release.</li>
              }
            </ol>
          }
        </section>

        <form method="dialog">
          <button class="dialog-close" type="submit" autofocus>Close</button>
        </form>
      }
    </dialog>
  `,
  styles: `
    dialog {
      padding: 0;
      border: 0;
      border-radius: 0.75rem;
      width: min(36rem, calc(100vw - 2rem));
      max-height: calc(100dvh - 2rem);
      color: oklch(19.37% 0.006 300.98);
      background: #fff;
      box-shadow: 0 1rem 3rem rgb(0 0 0 / 0.3);
    }

    /* Header and Close button stay put; only the track list scrolls. */
    dialog[open] {
      display: flex;
      flex-direction: column;
    }

    dialog::backdrop {
      background: rgb(0 0 0 / 0.5);
    }

    header,
    .content,
    form {
      padding-inline: 1.5rem;
    }

    header {
      padding-top: 1.5rem;
      border-bottom: 1px solid oklch(90% 0.005 300);
    }

    h2 {
      margin: 0 0 1rem;
      font-size: 1.5rem;
    }

    h3 {
      margin: 1rem 0 0.5rem;
      font-size: 1.125rem;
    }

    dl {
      display: grid;
      grid-template-columns: max-content 1fr;
      gap: 0.5rem 1rem;
      margin: 0 0 1rem;
    }

    dt {
      font-weight: 600;
    }

    .listen {
      margin: 0 0 1rem;
      text-align: center;
    }

    /* Cover art beside the YouTube link */
    .media {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1rem;
    }

    .media .listen {
      margin: 0;
    }

    .cover-frame {
      position: relative;
      flex: none;
      display: grid;
      place-items: center;
      width: 128px;
      height: 128px;
      overflow: hidden;
      border-radius: 0.25rem;
      background: oklch(95% 0.005 300);
    }

    /* The loading GIF and the cover share the square; the cover stays invisible (but still loads) until it's ready. */
    .cover,
    .cover-loading {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: contain; /* not every cover is square; show it whole */
    }

    .cover.is-loading {
      opacity: 0;
    }

    .cover-missing {
      padding: 0.5rem;
      font-size: 0.875rem;
      text-align: center;
      color: oklch(36.98% 0.014 302.71); /* same gray as .none; passes AA on this background */
    }

    dd {
      margin: 0;
      overflow-wrap: anywhere;
    }

    .content {
      flex: 1;
      overflow-y: auto;
    }

    .trackTitle {
        font-weight: 600;
    }

    .tracks {
      margin: 0 0 1rem;
      padding-inline-start: 1.5rem;
    }

    .tracks > li {
      margin-bottom: 0.75rem;
    }

    .tracks ul {
      margin: 0.25rem 0 0;
      padding-inline-start: 1rem;
    }

    .none {
      margin: 0.25rem 0 0;
      color: oklch(36.98% 0.014 302.71);
    }

    form {
      display: flex;
      justify-content: flex-end;
      padding-block: 1rem 1.5rem;
      border-top: 1px solid oklch(90% 0.005 300);
    }

    button, button.dialog-close {
      font: inherit;
      padding: 0.5rem 1.25rem;
      border: 0;
      border-radius: 0.5rem;
      color: #fff;
      background: #55709a; /* white text on this passes WCAG AA (about 5:1) */
      cursor: pointer;
    }

    button:focus-visible {
      outline: 3px solid #55709a;
      outline-offset: 3px;
    }

    /* Performer names: buttons (keyboard accessible) styled as links, overriding the button rule above. */
    .performer-link {
      font: inherit;
      font-weight: 600;
      padding: 0;
      border: 0;
      border-radius: 2px;
      color: #55709a;
      background: none;
      text-decoration: underline;
      cursor: pointer;
    }
  `,
})
export class ReleaseDialog {
  /** The release to show; null keeps the dialog closed. Two-way bindable with [(release)]. */
  readonly release = model<Release | null>(null);

  /** Emits a performer's name after the dialog closes and a search for them starts. */
  readonly performerSearched = output<string>();

  private readonly musicSearch = inject(MusicSearch);
  private readonly artistResult = this.musicSearch.results;

  /**
   * YouTube search for "<artist name>, <release title>", e.g.
   * https://youtube.com/results?search_query=Miles+Davis%2C+Kind+of+Blue
   * Falls back to the title alone if the artist isn't available.
   */
  protected readonly youtubeUrl = computed(() => {
    const release = this.release();
    if (!release) {
      return null;
    }
    const artistName = this.artistResult.hasValue() ? this.artistResult.value()?.name : undefined;
    const query = artistName ? `${artistName}, ${release.title}` : release.title;
    return `https://youtube.com/results?${new URLSearchParams({ search_query: query })}`;
  });

  /**
   * Front cover thumbnail from the Cover Art Archive (redirects to the image; 404 if there's none).
   * The 250px version stays sharp at 128px on high-density screens, at a fraction of the original's size.
   * Loading .GIF courtesy of By ING Kutzi - Own work, CC BY-SA 4.0, https://commons.wikimedia.org/wiki/Special:Redirect/page/85272465
   */
  protected readonly coverUrl = computed(() => {
    const id = this.release()?.id;
    return id ? `https://coverartarchive.org/release/${encodeURIComponent(id)}/front-250` : null;
  });

  /** Where the cover image is in loading; starts over at 'loading' for each release. */
  protected readonly coverState = linkedSignal<Release | null, 'loading' | 'loaded' | 'missing'>({
    source: this.release,
    computation: () => 'loading',
  });

  /** Tracks with performer/instrument credits, fetched whenever a release is shown. */
  protected readonly tracks = httpResource(
    () => {
      const id = this.release()?.id;
      // The "+" separators go straight into the URL; passing them via params would encode them as %2B.
      return id
        ? `https://musicbrainz.org/ws/2/release/${encodeURIComponent(id)}?inc=${RELEASE_INCLUDES}&fmt=json`
        : undefined;
    },
    { parse: toTrackCredits, defaultValue: [] },
  );

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    // Runs after rendering, so the dialog's contents (and its autofocus button) exist before it opens.
    afterRenderEffect(() => {
      const el = this.dialog().nativeElement;
      if (this.release()) {
        if (!el.open) el.showModal();
      } else if (el.open) {
        el.close();
      }
    });
  }

  /** Closes the dialog and replaces the current results with a search for the clicked performer. */
  protected searchPerformer(name: string) {
    // Close right away: the browser returns focus to the opener as the dialog closes,
    // so this must happen before anything else moves focus.
    this.dialog().nativeElement.close();
    this.release.set(null);
    // A new search clears the old artist and releases while it loads.
    this.musicSearch.search(name);
    this.performerSearched.emit(name);
  }

  /** Clicks on the dialog element itself (not its contents) land on the backdrop. */
  protected closeOnBackdrop(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      this.dialog().nativeElement.close();
    }
  }
}
