// Camada de acesso a dados: isola as chamadas ao Supabase do resto do app.
window.Mipas = window.Mipas || {};

(function () {
  const client = supabase.createClient(window.Mipas.config.supabaseUrl, window.Mipas.config.supabaseAnonKey);
  window.Mipas.supabase = client;

  async function fetchLists() {
    const { data, error } = await client.from('lists').select('*').order('created_at');
    if (error) throw error;
    return data;
  }

  function withPhotoUrls(place) {
    const photos = (place.place_photos || []).map(ph => ({ ...ph, url: photoUrl(ph.storage_path) }));
    const { place_photos, ...rest } = place;
    return { ...rest, photos };
  }

  async function fetchPlaces() {
    const { data, error } = await client.from('places').select('*, place_photos(*)').order('created_at');
    if (error) throw error;
    return data.map(withPhotoUrls);
  }

  async function fetchListById(id) {
    const { data, error } = await client.from('lists').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  }

  async function fetchPlacesByListId(listId) {
    const { data, error } = await client.from('places').select('*, place_photos(*)').eq('list_id', listId).order('created_at');
    if (error) throw error;
    return data.map(withPhotoUrls);
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

  async function createPlace({ name, address, latitude, longitude, note, category, rating, description, avg_price, list_id }) {
    const { data, error } = await client.from('places')
      .insert({ name, address, latitude, longitude, note, category, rating, description, avg_price, list_id })
      .select().single();
    if (error) throw error;
    return withPhotoUrls(data);
  }

  async function updatePlace(id, patch) {
    const { data, error } = await client.from('places').update(patch).eq('id', id).select().single();
    if (error) throw error;
    return withPhotoUrls(data);
  }

  async function deletePlace(id) {
    const { error } = await client.from('places').delete().eq('id', id);
    if (error) throw error;
  }

  function photoUrl(path) {
    return client.storage.from('place-photos').getPublicUrl(path).data.publicUrl;
  }

  async function uploadPhoto(ownerId, placeId, file) {
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${ownerId}/${placeId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error: uploadError } = await client.storage.from('place-photos').upload(path, file);
    if (uploadError) throw uploadError;
    const { data, error } = await client.from('place_photos')
      .insert({ place_id: placeId, storage_path: path })
      .select().single();
    if (error) throw error;
    return { ...data, url: photoUrl(data.storage_path) };
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
    uploadPhoto, deletePhoto,
  };
})();
