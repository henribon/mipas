import { auth } from '@/auth';
import * as data from '@/data';

// Last data each map showed on this device, drawn at startup while the server is asked again.
const PREFIX = 'mipas-snapshot:';
const VERSION = 1;
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export type Snapshot = { lists: any[]; places: any[]; home: any; wishes: any[] };

export function snapshotKey(sharedListId: string | null, userId: string | null) {
  return `${PREFIX}${sharedListId ? `list:${sharedListId}` : 'map'}:${userId || 'anon'}`;
}

export function readSnapshot(key: string): Snapshot | null {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || 'null');
    if (!saved || saved.v !== VERSION || !Array.isArray(saved.lists) || !Array.isArray(saved.places)) return null;
    return {
      lists: saved.lists,
      places: data.withCachedPhotoUrls(saved.places),
      home: saved.home ?? null,
      wishes: Array.isArray(saved.wishes) ? saved.wishes : [],
    };
  } catch {
    return null;
  }
}

export function writeSnapshot(key: string, userId: string | null, snapshot: Snapshot) {
  // A late write must not bring back an owner's data after sign-out.
  if (userId && auth.storedSession()?.user?.id !== userId) return;
  if (snapshot.lists.length === 0 && snapshot.places.length === 0) {
    removeKey(key);
    return;
  }
  const places = snapshot.places.map(p => ({
    ...p,
    photos: (p.photos || []).map(({ url, ...photo }) => photo),
  }));
  try {
    localStorage.setItem(key, JSON.stringify({ v: VERSION, savedAt: Date.now(), ...snapshot, places }));
  } catch {
  }
  pruneOldSnapshots();
}

const privateSnapshotKeys = () => snapshotKeys().filter(key => !key.endsWith(':anon'));

export function clearPrivateCaches() {
  data.clearPhotoUrlCache();
  privateSnapshotKeys().forEach(removeKey);
}

// For sessions that ended while the app was closed, when no SIGNED_OUT reaches the app.
export function clearCachesOfOtherUsers(userId: string | null) {
  const stale = privateSnapshotKeys().filter(key => !(userId && key.endsWith(`:${userId}`)));
  if (stale.length === 0) return;
  data.clearPhotoUrlCache();
  stale.forEach(removeKey);
}

let pruned = false;

function pruneOldSnapshots() {
  if (pruned) return;
  pruned = true;
  snapshotKeys().forEach(key => {
    let savedAt = 0;
    try {
      savedAt = JSON.parse(localStorage.getItem(key) || '{}').savedAt;
    } catch {
    }
    if (!(Date.now() - savedAt < MAX_AGE_MS)) removeKey(key);
  });
}

function snapshotKeys() {
  try {
    return Object.keys(localStorage).filter(key => key.startsWith(PREFIX));
  } catch {
    return [];
  }
}

function removeKey(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
  }
}
