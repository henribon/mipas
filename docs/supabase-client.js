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

  async function fetchPlaces() {
    const { data, error } = await client.from('places').select('*').order('created_at');
    if (error) throw error;
    return data;
  }

  async function fetchListById(id) {
    const { data, error } = await client.from('lists').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data;
  }

  async function fetchPlacesByListId(listId) {
    const { data, error } = await client.from('places').select('*').eq('list_id', listId).order('created_at');
    if (error) throw error;
    return data;
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

  async function createPlace({ name, address, latitude, longitude, note, list_id }) {
    const { data, error } = await client.from('places')
      .insert({ name, address, latitude, longitude, note, list_id })
      .select().single();
    if (error) throw error;
    return data;
  }

  async function updatePlace(id, patch) {
    const { data, error } = await client.from('places').update(patch).eq('id', id).select().single();
    if (error) throw error;
    return data;
  }

  async function deletePlace(id) {
    const { error } = await client.from('places').delete().eq('id', id);
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
  };
})();
