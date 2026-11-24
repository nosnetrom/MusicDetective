/** One performer on a track, with every instrument they're credited for on it. */
export interface Performer {
  artistId: string;
  name: string;
  /** Comma-separated instruments and vocal parts, e.g. "piano, celesta" or "guitar, lead vocals". */
  instruments: string;
}

/** A track on the release and who played what on it. */
export interface TrackCredits {
  id: string;
  title: string;
  performers: Performer[];
}

/* Shapes returned by GET /ws/2/release/{mbid}?inc=...recording-level-rels+artist-rels (only the fields we read). */
interface ApiRelation {
  type: string;
  artist?: { id: string; name: string };
  /** Instrument names plus modifiers like "guest" or "solo". */
  attributes?: string[];
  /** How the release credits an attribute when it differs from the standard name, e.g. { "double bass": "bass" }. */
  'attribute-credits'?: Record<string, string>;
}

interface ApiTrack {
  id: string;
  title: string;
  recording?: { relations?: ApiRelation[] };
}

interface ApiReleaseDetails {
  media?: { tracks?: ApiTrack[] }[];
}

/** Attributes on a performance relationship that describe the role, not the instrument or voice. */
const NON_INSTRUMENT_ATTRIBUTES = new Set(['additional', 'guest', 'solo']);

/**
 * Performance relation types we show, with the label to use when a relation carries no specific attribute.
 * A plain "vocal" relation (no "lead vocals", "background vocals", etc.) still means the artist sang.
 */
const PERFORMANCE_FALLBACKS: Record<string, string> = {
  instrument: 'instrument not specified',
  vocal: 'vocals',
};

/**
 * Labels a part with its standard name, adding how the release credits it when that differs,
 * e.g. "bass guitar (1964 Rickenbacker 4001 S)". Differences in letter case alone are ignored.
 */
function partLabel(attribute: string, credited: string | undefined): string {
  const showCredit = credited && credited.toLowerCase() !== attribute.toLowerCase();
  return showCredit ? `${attribute} (${credited})` : attribute;
}

/**
 * What the artist performed in one relation, e.g. ["piano"] or ["lead vocals"],
 * including the release's own credited names where given. Never empty.
 */
function performedParts(relation: ApiRelation): string[] {
  const credits = relation['attribute-credits'] ?? {};
  const parts = (relation.attributes ?? [])
    .filter((attribute) => !NON_INSTRUMENT_ATTRIBUTES.has(attribute))
    .map((attribute) => partLabel(attribute, credits[attribute]));
  return parts.length ? parts : [PERFORMANCE_FALLBACKS[relation.type]];
}

/** Collects a track's instrument and vocal relations into one entry per artist. */
function performersFor(track: ApiTrack): Performer[] {
  const byArtist = new Map<string, { name: string; instruments: Set<string> }>();

  for (const relation of track.recording?.relations ?? []) {
    if (!(relation.type in PERFORMANCE_FALLBACKS) || !relation.artist) {
      continue;
    }
    const entry = byArtist.get(relation.artist.id) ?? {
      name: relation.artist.name,
      instruments: new Set<string>(),
    };
    performedParts(relation).forEach((part) => entry.instruments.add(part));
    byArtist.set(relation.artist.id, entry);
  }

  return [...byArtist].map(([artistId, { name, instruments }]) => ({
    artistId,
    name,
    instruments: [...instruments].join(', '),
  }));
}

/** Flattens every disc's tracks into a single list of track credits. */
export function toTrackCredits(raw: unknown): TrackCredits[] {
  const media = (raw as ApiReleaseDetails).media ?? [];
  return media.flatMap((medium) =>
    (medium.tracks ?? []).map((track) => ({
      id: track.id,
      title: track.title,
      performers: performersFor(track),
    })),
  );
}
