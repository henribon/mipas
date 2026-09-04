import { useEffect, useState } from 'react';
import * as data from '@/data';
import { errorDetail } from '@/errors';

export function useMipasData({ sharedMode, sharedListId, authReady, session, canEdit, fail }) {
  const [lists, setLists] = useState([]);
  const [places, setPlaces] = useState([]);
  const [home, setHome] = useState(null);
  const [wishes, setWishes] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [loadId, setLoadId] = useState(0);

  useEffect(() => {
    if (!authReady) return;
    setLoadingData(true);
    const loadPromise = sharedMode
      ? Promise.all([
          data.fetchListById(sharedListId).then(l => (l ? [l] : [])),
          data.fetchPlacesByListId(sharedListId),
        ])
      : Promise.all([data.fetchLists(), data.fetchPlaces()]);

    loadPromise
      .then(([ls, ps]) => {
        setLists(ls);
        setPlaces(ps);
        setLoadId(n => n + 1);
        setLoadError(sharedMode && ls.length === 0 ? 'Essa lista não está disponível.' : '');
      })
      .catch(e => {
        console.error('[Mipas] não deu pra carregar os dados:', e);
        setLoadError('Não deu pra carregar os dados: ' + errorDetail(e));
      })
      .finally(() => setLoadingData(false));
  }, [authReady, session]);

  useEffect(() => {
    if (!canEdit) { setHome(null); setWishes([]); return; }
    data.fetchHome().then(setHome).catch(() => setHome(null));
    data.fetchWishes().then(setWishes).catch(() => setWishes([]));
  }, [canEdit]);

  const setListColor = async (list, color) => {
    if (color === list.color) return;
    const antes = list.color;
    setLists(ls => ls.map(l => (l.id === list.id ? { ...l, color } : l)));
    try {
      await data.updateList(list.id, { color });
    } catch (e) {
      setLists(ls => ls.map(l => (l.id === list.id ? { ...l, color: antes } : l)));
      fail('Não deu pra mudar a cor da lista', e);
    }
  };

  const removePlaceFromList = async (lugar, listId) => {
    const restantes = (lugar.list_ids || []).filter(id => id !== listId);
    if (restantes.length === 0) return;
    try {
      await data.setPlaceLists(lugar.id, restantes);
      setPlaces(ps => ps.map(p => (p.id === lugar.id ? { ...p, list_ids: restantes } : p)));
    } catch (e) {
      fail('Não deu pra tirar o lugar desta lista', e);
    }
  };

  const shareList = async (list) => {
    try {
      let target = list;
      if (!list.is_public) {
        target = await data.updateList(list.id, { is_public: true });
        setLists(ls => ls.map(l => (l.id === target.id ? target : l)));
      }
      const url = `${window.location.origin}${window.location.pathname}?list=${target.id}`;
      await navigator.clipboard.writeText(url);
      alert('Link copiado:\n' + url);
    } catch (e) {
      fail('Não deu pra gerar o link', e);
    }
  };

  const savePlaceEdits = async (placeId, patch, photoPatches, listIds) => {
    try {
      let updated = null;
      if (listIds) {
        await data.setPlaceLists(placeId, listIds);
      }
      if (patch && Object.keys(patch).length > 0) {
        updated = await data.updatePlace(placeId, patch);
      } else if (listIds) {
        setPlaces(ps => ps.map(p => (p.id === placeId ? { ...p, list_ids: listIds } : p)));
      }
      const photos = await Promise.all((photoPatches || []).map(pp => data.updatePhoto(pp.id, pp.patch)));
      setPlaces(ps => ps.map(p => {
        if (p.id !== placeId) return p;
        const base = updated || p;
        if (photos.length === 0) return base;
        return { ...base, photos: (base.photos || []).map(ph => photos.find(n => n.id === ph.id) || ph) };
      }));
    } catch (e) {
      fail('Não deu pra salvar as alterações', e);
      throw e;
    }
  };

  const addPhoto = async (placeId, file, title) => {
    try {
      const photo = await data.uploadPhoto(session.user.id, placeId, file, title);
      setPlaces(ps => ps.map(p => (p.id === placeId ? { ...p, photos: [...(p.photos || []), photo] } : p)));
    } catch (e) {
      fail('Não deu pra enviar a foto', e);
    }
  };

  const reorderPhotos = async (placeId, ids) => {
    const antes = places.find(p => p.id === placeId)?.photos || [];
    const novas = ids.map(id => antes.find(ph => ph.id === id)).filter(Boolean);
    setPlaces(ps => ps.map(p => (p.id === placeId ? { ...p, photos: novas } : p)));
    try {
      await data.reorderPhotos(ids);
    } catch (e) {
      setPlaces(ps => ps.map(p => (p.id === placeId ? { ...p, photos: antes } : p)));
      fail('Não deu pra salvar a ordem das fotos', e);
    }
  };

  const removePhoto = async (placeId, photo) => {
    if (!confirm('Excluir essa foto?')) return;
    try {
      await data.deletePhoto(photo);
      setPlaces(ps => ps.map(p => (p.id === placeId ? {
        ...p,
        photos: (p.photos || []).filter(ph => ph.id !== photo.id),
        cover_photo_id: p.cover_photo_id === photo.id ? null : p.cover_photo_id,
      } : p)));
    } catch (e) {
      fail('Não deu pra excluir a foto', e);
    }
  };

  const setCoverPhoto = async (placeId, photoId) => {
    const antes = places.find(p => p.id === placeId)?.cover_photo_id ?? null;
    setPlaces(ps => ps.map(p => (p.id === placeId ? { ...p, cover_photo_id: photoId } : p)));
    try {
      await data.updatePlace(placeId, { cover_photo_id: photoId });
    } catch (e) {
      setPlaces(ps => ps.map(p => (p.id === placeId ? { ...p, cover_photo_id: antes } : p)));
      fail('Não deu pra escolher a foto do mapa', e);
    }
  };

  const removeWish = async (w) => {
    if (!confirm(`Tirar "${w.name}" do Quero ir?`)) return;
    try {
      await data.deleteWish(w.id);
      setWishes(ws => ws.filter(x => x.id !== w.id));
    } catch (e) {
      fail('Não deu pra tirar esse lugar do Quero ir', e);
    }
  };

  const saveHome = async ({ lat, lng }) => {
    const saved = await data.saveHome(session.user.id, { latitude: lat, longitude: lng });
    setHome(saved);
  };

  const removeHome = async () => {
    await data.clearHome(session.user.id);
    setHome(null);
  };

  return {
    lists, setLists,
    places, setPlaces,
    home, wishes, setWishes,
    loadingData, loadError, loadId,
    setListColor, removePlaceFromList, shareList, savePlaceEdits,
    addPhoto, reorderPhotos, removePhoto, setCoverPhoto,
    removeWish, saveHome, removeHome,
  };
}
