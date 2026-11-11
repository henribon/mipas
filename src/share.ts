// Links a place's share card points at, and how a link leaves the device.

export const SHARE_PARAM = 'place';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function sharedPlaceIdFromUrl(): string | null {
  const id = new URLSearchParams(window.location.search).get(SHARE_PARAM);
  return id ? id.trim() : null;
}

export function isPlaceId(id: string) {
  return UUID.test(id);
}

export function placeShareUrl(placeId: string) {
  return `${window.location.origin}${window.location.pathname}?${SHARE_PARAM}=${placeId}`;
}

export function appUrl(params = '') {
  return `${window.location.origin}${window.location.pathname}${params}`;
}

// The same search the app's address links use, so both open the same Google result.
export function googleMapsSearchUrl(place) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place.name}, ${place.address}`)}`;
}

// Coordinates, not the name: a name Google doesn't know would route somewhere else.
export function googleMapsDirectionsUrl(place) {
  return `https://www.google.com/maps/dir/?api=1&destination=${place.latitude},${place.longitude}`;
}

// The keyless embed. Searching by name leaves the map without a pin when Google
// doesn't know the place, so it gets the pin's own coordinates.
export function googleMapsEmbedUrl(place, zoom = 16) {
  return `https://maps.google.com/maps?q=${place.latitude},${place.longitude}&z=${zoom}&hl=pt-BR&output=embed`;
}

// The field holds either a handle ("bardoze", "@bardoze") or a profile link.
export function instagramHandle(raw: string) {
  return String(raw || '').trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/^@/, '')
    .replace(/[/?#].*$/, '');
}

export function instagramUrl(raw: string) {
  const value = String(raw || '').trim();
  return /^https?:\/\//i.test(value) ? value : `https://instagram.com/${instagramHandle(value)}`;
}

export type ShareOutcome = 'shared' | 'copied' | 'cancelled';

// Phones get the system share sheet (WhatsApp & co.); elsewhere the link goes to the clipboard.
// Call it straight from the click: Safari refuses the sheet once the gesture has been awaited away.
export async function shareOrCopy({ title, text, url }: { title: string; text?: string; url: string }): Promise<ShareOutcome> {
  const touch = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  if (touch && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, text, url });
      return 'shared';
    } catch (e) {
      if (e?.name === 'AbortError') return 'cancelled';
    }
  }
  await navigator.clipboard.writeText(url);
  return 'copied';
}
