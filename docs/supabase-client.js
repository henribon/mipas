// Camada de acesso a dados: isola as chamadas ao Supabase do resto do app.
window.Mipas = window.Mipas || {};

(function () {
  const client = supabase.createClient(window.Mipas.config.supabaseUrl, window.Mipas.config.supabaseAnonKey);
  window.Mipas.supabase = client;

  // Visitante anônimo não tem SELECT na tabela inteira (ver supabase-schema.sql):
  // "note" e "owner_id" ficaram fora do que o banco concede pra ele. Por isso a
  // leitura pública pede colunas explícitas — um select('*') aqui daria erro de
  // permissão, e é justamente essa a intenção.
  const LIST_PUBLIC_COLS = 'id, name, emoji, color, is_public, ranking_enabled, created_at';
  const PHOTO_PUBLIC_COLS = 'id, place_id, storage_path, title, description, created_at';
  const PLACE_PUBLIC_COLS = 'id, list_id, name, address, latitude, longitude, rank, category, '
    + `rating, description, avg_price, instagram, created_at, place_photos(${PHOTO_PUBLIC_COLS})`;

  async function isOwner() {
    const { data } = await client.auth.getSession();
    return !!data.session;
  }

  async function listCols() { return (await isOwner()) ? '*' : LIST_PUBLIC_COLS; }
  async function placeCols() { return (await isOwner()) ? '*, place_photos(*)' : PLACE_PUBLIC_COLS; }

  async function fetchLists() {
    const { data, error } = await client.from('lists').select(await listCols()).order('created_at');
    if (error) throw error;
    return data;
  }

  async function fetchPlaces() {
    const { data, error } = await client.from('places').select(await placeCols()).order('created_at');
    if (error) throw error;
    return attachPhotoUrls(data);
  }

  async function fetchListById(id) {
    const { data, error } = await client.from('lists').select(await listCols()).eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  }

  async function fetchPlacesByListId(listId) {
    const { data, error } = await client.from('places').select(await placeCols()).eq('list_id', listId).order('created_at');
    if (error) throw error;
    return attachPhotoUrls(data);
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
    const { error } = await client.from('lists').delete().eq('id', id);
    if (error) throw error;
  }

  async function createPlace({ name, address, latitude, longitude, note, category, rating, description, avg_price, instagram, list_id }) {
    const { data, error } = await client.from('places')
      .insert({ name, address, latitude, longitude, note, category, rating, description, avg_price, instagram, list_id })
      .select('*, place_photos(*)').single();
    if (error) throw error;
    return withPhotoUrls(data);
  }

  // Traz as fotos junto: sem isso, salvar qualquer campo devolvia o lugar sem
  // place_photos e a interface apagava as fotos do card até recarregar.
  async function updatePlace(id, patch) {
    const { data, error } = await client.from('places').update(patch).eq('id', id)
      .select('*, place_photos(*)').single();
    if (error) throw error;
    return withPhotoUrls(data);
  }

  async function deletePlace(id) {
    const { error } = await client.from('places').delete().eq('id', id);
    if (error) throw error;
  }

  // O bucket é privado, então a imagem é servida por URL assinada temporária.
  // Quem pode assinar é decidido pelas policies do storage (dono, ou qualquer
  // um se a foto pertence a uma lista pública) — não pelo sigilo do caminho.
  const SIGNED_URL_TTL = 60 * 60 * 8;

  async function signedUrlMap(paths) {
    if (paths.length === 0) return {};
    const { data, error } = await client.storage.from('place-photos').createSignedUrls(paths, SIGNED_URL_TTL);
    if (error) {
      // Sem isto a imagem some da tela sem nenhum aviso — o <img> fica com
      // src vazio e não há erro visível em lugar nenhum.
      console.error('[Mipas] não deu pra assinar URLs de foto:', error);
      return {};
    }
    const map = {};
    // Versões do supabase-js divergem entre "signedUrl" e "signedURL" nesta
    // resposta; aceitar os dois evita quebrar quando o CDN sobe de versão.
    data.forEach(d => {
      const url = d.signedUrl || d.signedURL;
      if (url) map[d.path] = url;
    });
    return map;
  }

  async function attachPhotoUrls(places) {
    const paths = [];
    places.forEach(p => (p.place_photos || []).forEach(ph => paths.push(ph.storage_path)));
    const urls = await signedUrlMap(paths);
    return places.map(p => {
      const photos = (p.place_photos || []).map(ph => ({ ...ph, url: urls[ph.storage_path] || null }));
      const { place_photos, ...rest } = p;
      return { ...rest, photos };
    });
  }

  async function withPhotoUrls(place) {
    const [out] = await attachPhotoUrls([place]);
    return out;
  }

  async function photoUrl(path) {
    return (await signedUrlMap([path]))[path] || null;
  }

  async function uploadPhoto(ownerId, placeId, file, title) {
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${ownerId}/${placeId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error: uploadError } = await client.storage.from('place-photos').upload(path, file);
    if (uploadError) throw uploadError;
    const { data, error } = await client.from('place_photos')
      .insert({ place_id: placeId, storage_path: path, title: title || null })
      .select().single();
    if (error) throw error;
    return { ...data, url: await photoUrl(data.storage_path) };
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

  window.Mipas.data = {
    fetchLists, fetchPlaces, fetchListById, fetchPlacesByListId,
    createList, updateList, deleteList,
    createPlace, updatePlace, deletePlace,
    fetchHome, saveHome, clearHome,
    uploadPhoto, updatePhoto, deletePhoto,
  };
})();
