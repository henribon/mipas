import { useEffect, useRef, useState } from 'react';
import * as data from '@/data';
import { errorDetail } from '@/errors';
import { readSnapshot, snapshotKey, writeSnapshot } from '@/cache';

const REFRESH_AFTER_MS = 30 * 60 * 1000;
const REFRESH_CHECK_MS = 5 * 60 * 1000;

const sameJson = (a, b) => a === b || JSON.stringify(a) === JSON.stringify(b);

// Keeps the objects the server sent back unchanged, so a refresh that changed nothing
// doesn't re-render the panels or redraw the pins.
function reconcile(prev, next) {
  const byId = new Map(prev.map(item => [item.id, item]));
  let changed = prev.length !== next.length;
  const out = next.map((item, i) => {
    const old = byId.get(item.id);
    const kept = old && sameJson(old, item) ? old : item;
    if (kept !== prev[i]) changed = true;
    return kept;
  });
  return changed ? out : prev;
}

const keepIfSame = (prev, next) => (sameJson(prev, next) ? prev : next);

export function useMipasData({ sharedMode, sharedListId, authReady, session, canEdit, fail }) {
  const userId = session?.user?.id ?? null;
  const cacheKey = snapshotKey(sharedMode ? sharedListId : null, userId);

  const [snapshot] = useState(() => readSnapshot(cacheKey));
  const [lists, setListsRaw] = useState(snapshot?.lists ?? []);
  const [places, setPlacesRaw] = useState(snapshot?.places ?? []);
  const [home, setHomeRaw] = useState(snapshot?.home ?? null);
  const [wishes, setWishesRaw] = useState(snapshot?.wishes ?? []);
  const [loadingData, setLoadingData] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [loadId, setLoadId] = useState(snapshot ? 1 : 0);
  const [refreshTick, setRefreshTick] = useState(0);

  const shownKey = useRef(snapshot ? cacheKey : null);
  const shownUserId = useRef(snapshot ? userId : null);
  const confirmedKey = useRef(null);
  const loading = useRef(false);
  const lastLoadAt = useRef(0);
  const saved = useRef({ lists, places, home, wishes });
  const placesNow = useRef(places);
  placesNow.current = places;

  // Local changes bump these, so a load that started before them doesn't undo them.
  const edits = useRef({ lists: 0, places: 0, home: 0, wishes: 0 });
  const [setters] = useState(() => {
    const tracked = (slice, set) => (value) => { edits.current[slice] += 1; set(value); };
    return {
      setLists: tracked('lists', setListsRaw),
      setPlaces: tracked('places', setPlacesRaw),
      setHome: tracked('home', setHomeRaw),
      setWishes: tracked('wishes', setWishesRaw),
    };
  });
  const { setLists, setPlaces, setHome, setWishes } = setters;

  useEffect(() => {
    if (!authReady) return;
    let cancelled = false;

    if (shownKey.current !== cacheKey) {
      setLoadError('');
      const cached = readSnapshot(cacheKey);
      if (cached || shownUserId.current) {
        setListsRaw(cached?.lists ?? []);
        setPlacesRaw(cached?.places ?? []);
        setHomeRaw(cached?.home ?? null);
        setWishesRaw(cached?.wishes ?? []);
        shownKey.current = cached ? cacheKey : null;
        shownUserId.current = cached ? userId : null;
        if (cached) setLoadId(n => n + 1);
      }
    }

    loading.current = true;
    setLoadingData(true);
    const editsAtStart = { ...edits.current };
    const unchanged = (slice) => edits.current[slice] === editsAtStart[slice];
    const loadPromise = sharedMode
      ? Promise.all([
          data.fetchListById(sharedListId).then(l => (l ? [l] : [])),
          data.fetchPlacesByListId(sharedListId),
        ])
      : Promise.all([data.fetchLists(), data.fetchPlaces()]);

    loadPromise
      .then(([ls, ps]) => {
        if (cancelled) return;
        const fresh = shownKey.current !== cacheKey;
        if (fresh || unchanged('lists')) setListsRaw(prev => (fresh ? ls : reconcile(prev, ls)));
        if (fresh || unchanged('places')) setPlacesRaw(prev => (fresh ? ps : reconcile(prev, ps)));
        if (fresh) setLoadId(n => n + 1);
        shownKey.current = cacheKey;
        shownUserId.current = userId;
        confirmedKey.current = cacheKey;
        lastLoadAt.current = Date.now();
        setLoadError(sharedMode && ls.length === 0 ? 'Essa lista não está disponível.' : '');
        data.signMissingPhotoUrls([...ps, ...placesNow.current])
          .then(urls => { if (!cancelled && urls) setPlacesRaw(cur => data.applyPhotoUrls(cur, urls)); })
          .catch(e => console.error('[Mipas] não deu pra assinar URLs de foto:', e));
      })
      .catch(e => {
        if (cancelled) return;
        console.error('[Mipas] não deu pra carregar os dados:', e);
        if (confirmedKey.current === cacheKey) return;
        setLoadError(shownKey.current === cacheKey
          ? 'Não deu pra atualizar os dados — mostrando a última versão salva neste aparelho. ' + errorDetail(e)
          : 'Não deu pra carregar os dados: ' + errorDetail(e));
      })
      .finally(() => {
        if (cancelled) return;
        loading.current = false;
        setLoadingData(false);
      });

    return () => { cancelled = true; };
  }, [authReady, cacheKey, refreshTick]);

  useEffect(() => {
    if (!authReady) return;
    if (!canEdit) {
      setHomeRaw(null);
      setWishesRaw(prev => (prev.length ? [] : prev));
      return;
    }
    let cancelled = false;
    const editsAtStart = { ...edits.current };
    const apply = (slice, set, merge) => (value) => {
      if (!cancelled && edits.current[slice] === editsAtStart[slice]) set(prev => merge(prev, value));
    };
    data.fetchHome().then(apply('home', setHomeRaw, keepIfSame)).catch(() => {});
    data.fetchWishes().then(apply('wishes', setWishesRaw, reconcile)).catch(() => {});
    return () => { cancelled = true; };
  }, [authReady, canEdit, refreshTick]);

  useEffect(() => {
    const refreshIfStale = () => {
      if (document.visibilityState !== 'visible' || loading.current) return;
      if (Date.now() - lastLoadAt.current < REFRESH_AFTER_MS) return;
      setRefreshTick(n => n + 1);
    };
    const timer = setInterval(refreshIfStale, REFRESH_CHECK_MS);
    document.addEventListener('visibilitychange', refreshIfStale);
    window.addEventListener('online', refreshIfStale);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshIfStale);
      window.removeEventListener('online', refreshIfStale);
    };
  }, []);

  useEffect(() => {
    if (shownKey.current !== cacheKey) return;
    const last = saved.current;
    if (last.lists === lists && last.places === places && last.home === home && last.wishes === wishes) return;
    const timer = setTimeout(() => {
      saved.current = { lists, places, home, wishes };
      writeSnapshot(cacheKey, userId, { lists, places, home, wishes });
    }, 300);
    return () => clearTimeout(timer);
  }, [cacheKey, lists, places, home, wishes]);

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
