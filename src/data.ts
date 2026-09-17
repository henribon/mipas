import { createClient } from '@supabase/supabase-js';
import { config } from '@/theme';

// Same key supabase-js derives by default, pinned so the session can be read synchronously.
export const AUTH_STORAGE_KEY = `sb-${new URL(config.supabaseUrl).hostname.split('.')[0]}-auth-token`;

const client = createClient(config.supabaseUrl, config.supabasePublishableKey, {
  auth: { storageKey: AUTH_STORAGE_KEY },
});
export { client as supabase };

const LIST_PUBLIC_COLS = 'id, name, emoji, color, is_public, hidden_for_visitor, created_at';
const PHOTO_PUBLIC_COLS = 'id, place_id, storage_path, title, description, position, created_at';
const FOTOS_DO_LUGAR = 'place_photos!place_photos_place_id_fkey';
const PLACE_PUBLIC_COLS = 'id, name, address, latitude, longitude, category, '
  + 'rating, description, avg_price, instagram, cover_photo_id, created_at, '
  + `place_lists(list_id), ${FOTOS_DO_LUGAR}(${PHOTO_PUBLIC_COLS})`;
const PLACE_OWNER_COLS = `*, place_lists(list_id), ${FOTOS_DO_LUGAR}(*)`;

async function isOwner() {
  const { data } = await client.auth.getSession();
  return !!data.session;
}

async function listCols() { return (await isOwner()) ? '*' : LIST_PUBLIC_COLS; }
async function placeCols() { return (await isOwner()) ? PLACE_OWNER_COLS : PLACE_PUBLIC_COLS; }

async function fetchLists() {
  const { data, error } = await client.from('lists').select(await listCols()).order('created_at');
  if (error) throw error;
  return data;
}

async function fetchPlaces() {
  const { data, error } = await client.from('places').select(await placeCols()).order('created_at');
  if (error) throw error;
  return withCachedPhotoUrls(data.map(shapePlace));
}

async function fetchListById(id) {
  const { data, error } = await client.from('lists').select(await listCols()).eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

async function fetchPlacesByListId(listId) {
  const cols = (await placeCols()).replace('place_lists(list_id)', 'place_lists!inner(list_id)');
  const { data, error } = await client.from('places')
    .select(cols)
    .eq('place_lists.list_id', listId)
    .order('created_at');
  if (error) throw error;
  return withCachedPhotoUrls(data.map(shapePlace));
}

async function createList({ name, emoji, color }) {
  const { data, error } = await client.from('lists').insert({ name, emoji, color }).select().single();
  if (error) throw error;
  return data;
}

async function updateList(id, patch) {
  const { data, error } = await client.from('lists').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

async function deleteList(id) {
  const { data: vinculos, error: readError } = await client.from('place_lists').select('place_id').eq('list_id', id);
  if (readError) throw readError;
  const candidatos = (vinculos || []).map(v => v.place_id);

  const { error } = await client.from('lists').delete().eq('id', id);
  if (error) throw error;

  if (candidatos.length === 0) return [];
  const { data: sobraram, error: restError } = await client.from('place_lists').select('place_id').in('place_id', candidatos);
  if (restError) throw restError;
  const aindaEmLista = new Set((sobraram || []).map(v => v.place_id));
  const orfaos = candidatos.filter(pid => !aindaEmLista.has(pid));
  if (orfaos.length) {
    const { error: delError } = await client.from('places').delete().in('id', orfaos);
    if (delError) throw delError;
  }
  return orfaos;
}

async function createPlace({ name, address, latitude, longitude, category, rating, description, avg_price, instagram, list_ids }) {
  const { data, error } = await client.from('places')
    .insert({ name, address, latitude, longitude, category, rating, description, avg_price, instagram })
    .select(`*, ${FOTOS_DO_LUGAR}(*)`).single();
  if (error) throw error;
  const ids = (list_ids || []).filter(Boolean);
  if (ids.length) {
    const { error: linkError } = await client.from('place_lists')
      .insert(ids.map(list_id => ({ place_id: data.id, list_id })));
    if (linkError) {
      await client.from('places').delete().eq('id', data.id);
      throw linkError;
    }
  }
  const [pronto] = await attachPhotoUrls([{ ...data, place_lists: ids.map(list_id => ({ list_id })) }]);
  return pronto;
}

async function setPlaceLists(placeId, listIds) {
  const ids = (listIds || []).filter(Boolean);
  const { data: atuais, error: readError } = await client.from('place_lists').select('list_id').eq('place_id', placeId);
  if (readError) throw readError;
  const antigos = (atuais || []).map(v => v.list_id);
  const remover = antigos.filter(id => !ids.includes(id));
  const inserir = ids.filter(id => !antigos.includes(id));
  if (remover.length) {
    const { error } = await client.from('place_lists').delete().eq('place_id', placeId).in('list_id', remover);
    if (error) throw error;
  }
  if (inserir.length) {
    const { error } = await client.from('place_lists').insert(inserir.map(list_id => ({ place_id: placeId, list_id })));
    if (error) throw error;
  }
  return ids;
}

async function updatePlace(id, patch) {
  const { data, error } = await client.from('places').update(patch).eq('id', id)
    .select(PLACE_OWNER_COLS).single();
  if (error) throw error;
  return withPhotoUrls(data);
}

async function deletePlace(id) {
  const { error } = await client.from('places').delete().eq('id', id);
  if (error) throw error;
}

// Signed URLs are reused across visits so the browser can serve the photos from its
// cache; a reused URL still has MIN_URL_LIFETIME_MS left, like the old 8h TTL gave, and
// points at the current project (one saved before a project move would break).
const SIGNED_URL_TTL = 60 * 60 * 24;
const MIN_URL_LIFETIME_MS = 8 * 60 * 60 * 1000;
const PHOTO_URLS_KEY = 'mipas-photo-urls';

let photoUrls: Record<string, { url: string; exp: number }> = readPhotoUrls();

function readPhotoUrls() {
  try {
    const saved = JSON.parse(localStorage.getItem(PHOTO_URLS_KEY) || '{}');
    return saved && typeof saved === 'object' ? saved : {};
  } catch {
    return {};
  }
}

function cachedPhotoUrl(path) {
  const saved = photoUrls[path];
  const usable = saved && saved.url.startsWith(`${config.supabaseUrl}/`) && saved.exp - Date.now() > MIN_URL_LIFETIME_MS;
  return usable ? saved.url : null;
}

function savePhotoUrls() {
  photoUrls = Object.fromEntries(Object.entries(photoUrls).filter(([path]) => cachedPhotoUrl(path)));
  try {
    localStorage.setItem(PHOTO_URLS_KEY, JSON.stringify(photoUrls));
  } catch {
  }
}

function clearPhotoUrlCache() {
  photoUrls = {};
  try {
    localStorage.removeItem(PHOTO_URLS_KEY);
  } catch {
  }
}

async function signedUrlMap(paths) {
  const map = {};
  const missing = new Set<string>();
  paths.forEach(path => {
    const url = cachedPhotoUrl(path);
    if (url) map[path] = url;
    else missing.add(path);
  });
  if (missing.size === 0) return map;
  const signedAt = Date.now();
  const { data, error } = await client.storage.from('place-photos').createSignedUrls([...missing], SIGNED_URL_TTL);
  if (error) {
    console.error('[Mipas] não deu pra assinar URLs de foto:', error);
    return map;
  }
  data.forEach(d => {
    const url = d.signedUrl || d.signedURL;
    if (!url) return;
    map[d.path] = url;
    photoUrls[d.path] = { url, exp: signedAt + SIGNED_URL_TTL * 1000 };
  });
  savePhotoUrls();
  return map;
}

function byPosition(a, b) {
  const pa = a.position == null ? Infinity : a.position;
  const pb = b.position == null ? Infinity : b.position;
  if (pa !== pb) return pa - pb;
  return String(a.created_at).localeCompare(String(b.created_at));
}

function shapePlace(row) {
  const { place_photos, place_lists, ...rest } = row;
  const photos = [...(place_photos || [])].sort(byPosition);
  return { ...rest, photos, list_ids: (place_lists || []).map(v => v.list_id) };
}

const photoPaths = (places) => places.flatMap(p => (p.photos || []).map(ph => ph.storage_path));

function withUrls(places, urls) {
  return places.map(p => ({
    ...p,
    photos: (p.photos || []).map(ph => ({ ...ph, url: urls[ph.storage_path] || null })),
  }));
}

async function attachPhotoUrls(rows) {
  const places = rows.map(shapePlace);
  return withUrls(places, await signedUrlMap(photoPaths(places)));
}

// Only URLs already signed; signMissingPhotoUrls fetches the rest without holding up the places.
function withCachedPhotoUrls(places) {
  return withUrls(places, Object.fromEntries(photoPaths(places).map(path => [path, cachedPhotoUrl(path)])));
}

async function signMissingPhotoUrls(places) {
  const paths = places.flatMap(p => (p.photos || []).filter(ph => !ph.url).map(ph => ph.storage_path));
  return paths.length ? signedUrlMap(paths) : null;
}

function applyPhotoUrls(places, urls) {
  const missing = (ph) => !ph.url && urls[ph.storage_path];
  let changed = false;
  const out = places.map(p => {
    if (!(p.photos || []).some(missing)) return p;
    changed = true;
    return { ...p, photos: p.photos.map(ph => (missing(ph) ? { ...ph, url: urls[ph.storage_path] } : ph)) };
  });
  return changed ? out : places;
}

async function withPhotoUrls(place) {
  const [out] = await attachPhotoUrls([place]);
  return out;
}

async function photoUrl(path) {
  return (await signedUrlMap([path]))[path] || null;
}

const MAX_LADO = 1600;
const JPEG_QUALIDADE = 0.82;

async function comprimirImagem(file) {
  if (!file.type || !file.type.startsWith('image/') || /svg|gif/.test(file.type)) return file;
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch (e) {
    try { bitmap = await createImageBitmap(file); } catch (e2) { return file; }
  }
  const escala = Math.min(1, MAX_LADO / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * escala));
  const h = Math.max(1, Math.round(bitmap.height * escala));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  if (bitmap.close) bitmap.close();
  const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', JPEG_QUALIDADE));
  if (!blob || blob.size >= file.size) return file;
  return blob;
}

async function uploadPhoto(ownerId, placeId, file, title) {
  const enviar = await comprimirImagem(file);
  const ext = enviar.type === 'image/jpeg' ? 'jpg' : ((file.name || '').split('.').pop() || 'jpg').toLowerCase();
  const path = `${ownerId}/${placeId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error: uploadError } = await client.storage.from('place-photos').upload(path, enviar, {
    contentType: enviar.type || file.type,
    // The path is unique and never overwritten, so the browser may keep the file for good.
    cacheControl: String(60 * 60 * 24 * 365),
  });
  if (uploadError) throw uploadError;
  const { data, error } = await client.from('place_photos')
    .insert({ place_id: placeId, storage_path: path, title: title || null })
    .select().single();
  if (error) throw error;
  return { ...data, url: await photoUrl(data.storage_path) };
}

async function reorderPhotos(ids) {
  const results = await Promise.all(ids.map((id, i) =>
    client.from('place_photos').update({ position: i }).eq('id', id).select().single()));
  const erro = results.find(r => r.error);
  if (erro) throw erro.error;
  return results.map(r => r.data);
}

async function updatePhoto(id, patch) {
  const { data, error } = await client.from('place_photos').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return { ...data, url: await photoUrl(data.storage_path) };
}

async function deletePhoto(photo) {
  await client.storage.from('place-photos').remove([photo.storage_path]);
  const { error } = await client.from('place_photos').delete().eq('id', photo.id);
  if (error) throw error;
}

async function fetchWishes() {
  const { data, error } = await client.from('wish_places').select('*').order('created_at');
  if (error) throw error;
  return data;
}

async function createWish({ name, address, latitude, longitude, instagram, note }) {
  const { data, error } = await client.from('wish_places')
    .insert({ name, address, latitude, longitude, instagram, note })
    .select().single();
  if (error) throw error;
  return data;
}

async function updateWish(id, patch) {
  const { data, error } = await client.from('wish_places').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

async function deleteWish(id) {
  const { error } = await client.from('wish_places').delete().eq('id', id);
  if (error) throw error;
}

async function fetchHome() {
  const { data, error } = await client.from('user_home').select('*').maybeSingle();
  if (error) throw error;
  return data;
}

async function saveHome(ownerId, { latitude, longitude }) {
  const { data, error } = await client.from('user_home')
    .upsert({ owner_id: ownerId, latitude, longitude }, { onConflict: 'owner_id' })
    .select().single();
  if (error) throw error;
  return data;
}

async function clearHome(ownerId) {
  const { error } = await client.from('user_home').delete().eq('owner_id', ownerId);
  if (error) throw error;
}


export {
  fetchLists,
  fetchPlaces,
  fetchListById,
  fetchPlacesByListId,
  createList,
  updateList,
  deleteList,
  createPlace,
  updatePlace,
  deletePlace,
  fetchHome,
  saveHome,
  clearHome,
  uploadPhoto,
  updatePhoto,
  deletePhoto,
  reorderPhotos,
  setPlaceLists,
  fetchWishes,
  createWish,
  updateWish,
  deleteWish,
  withCachedPhotoUrls,
  signMissingPhotoUrls,
  applyPhotoUrls,
  clearPhotoUrlCache,
};
