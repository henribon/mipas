import React, { useState, useEffect, useMemo, useRef } from 'react';
import { getTheme, setTheme, initialTheme } from '@/theme';
import * as data from '@/data';
import * as mapa from '@/map';
import { auth, LoginForm } from '@/auth';
import { debounce, geocodeAddress, haversineKm } from '@/geocoding';
import { SaveSheet, NewListSheet, HomeSheet, PlaceCard, ListsPanel, ListDetail, WishPanel, WishSheet } from '@/components/mipas';

export default function App() {
  const C = getTheme();
  
  const sharedListId = useMemo(() => new URLSearchParams(window.location.search).get('list'), []);
  const sharedMode = !!sharedListId;

  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  const [lists, setLists] = useState([]);
  const [places, setPlaces] = useState([]);
  const [home, setHome] = useState(null);
  const [wishes, setWishes] = useState([]);
  const [wishDraft, setWishDraft] = useState(null);
  const [savingWish, setSavingWish] = useState(false);
  const [searchTarget, setSearchTarget] = useState('place');
  const [loadingData, setLoadingData] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [tab, setTab] = useState('map');
  const [openListId, setOpenListId] = useState(sharedMode ? sharedListId : null);
  const [selId, setSelId] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [newListOpen, setNewListOpen] = useState(false);
  const [creatingList, setCreatingList] = useState(false);
  const [pendingListPick, setPendingListPick] = useState(false);
  const [homeOpen, setHomeOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia('(min-width: 720px)').matches);
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [returnListId, setReturnListId] = useState(null);
  const [themeMode, setThemeMode] = useState(() => (document.body.classList.contains('light') ? 'light' : 'dark'));

  const toggleTheme = () => {
    const next = themeMode === 'dark' ? 'light' : 'dark';
    setTheme(next);
    setThemeMode(next);
  };

  const mapRef = useRef(null);
  const leafRef = useRef(null);
  const markersRef = useRef({});

  const canEdit = !sharedMode && !!session;

  useEffect(() => {
    auth.getSession().then(s => { setSession(s); setAuthReady(true); });
    const sub = auth.onChange(s => setSession(s));
    return () => sub.unsubscribe();
  }, []);

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
        setLoadError(sharedMode && ls.length === 0 ? 'Essa lista não está disponível.' : '');
      })
      .catch(() => setLoadError('Não deu pra carregar os dados. Confira o config.js e as políticas do Supabase.'))
      .finally(() => setLoadingData(false));
  }, [authReady, session]);

  useEffect(() => {
    if (!canEdit) { setHome(null); setWishes([]); return; }
    data.fetchHome().then(setHome).catch(() => setHome(null));
    data.fetchWishes().then(setWishes).catch(() => setWishes([]));
  }, [canEdit]);

  useEffect(() => {
    const m = mapa.initMap(mapRef.current);
    leafRef.current = m;
    m.on('click', () => { setSelId(null); setReturnListId(null); });
    setTimeout(() => m.invalidateSize(), 300);
    return () => m.remove();
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 720px)');
    const onChange = (e) => setIsDesktop(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (leafRef.current) setTimeout(() => leafRef.current.invalidateSize(), 250);
  }, [isDesktop]);

  useEffect(() => {
    const m = leafRef.current;
    if (!m) return;
    mapa.syncMarkers(m, markersRef, places, lists, (p) => {
      setSelId(p.id);
      setTab('map');
      setOpenListId(null);
      setReturnListId(null);
      m.flyTo([p.latitude, p.longitude], Math.max(m.getZoom(), 14), { duration: .6 });
    });
  }, [places, lists]);

  useEffect(() => {
    if (!sharedMode || places.length === 0) return;
    const m = leafRef.current;
    if (!m) return;
    const first = places[0];
    setTimeout(() => m.flyTo([first.latitude, first.longitude], 13, { duration: .6 }), 200);
  }, [sharedMode, places]);

  const debouncedSearch = useMemo(() => debounce(async (q) => {
    if (!q.trim()) { setResults([]); return; }
    setSearching(true);
    try {
      setResults(await geocodeAddress(q));
    } catch (e) {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, 600), []);

  useEffect(() => { debouncedSearch(query); }, [query]);

  const goToPlace = (p) => {
    setTab('map');
    if (isDesktop) {
      setSidebarHidden(true);
    } else {
      setReturnListId(openListId);
      setOpenListId(null);
    }
    setSelId(p.id);
    setTimeout(() => {
      leafRef.current.invalidateSize();
      leafRef.current.flyTo([p.latitude, p.longitude], 15, { duration: .8 });
    }, 60);
  };

  const backToSidebar = () => {
    setSidebarHidden(false);
    setSelId(null);
    setTimeout(() => leafRef.current.invalidateSize(), 60);
  };

  const savePlace = async (d) => {
    setSaving(true);
    try {
      const created = await data.createPlace({
        name: d.name.trim(),
        address: d.address,
        latitude: d.lat,
        longitude: d.lng,
        category: d.category?.trim() || null,
        rating: d.rating === '' || d.rating == null ? null : parseFloat(d.rating),
        description: d.description?.trim() || null,
        avg_price: d.avg_price === '' || d.avg_price == null ? null : parseFloat(d.avg_price),
        instagram: d.instagram?.trim().replace(/^@/, '') || null,
        list_ids: d.list_ids,
      });
      let comFotos = created;
      if (d.photos && d.photos.length) {
        try {
          const enviadas = [];
          for (const item of d.photos) {
            enviadas.push(await data.uploadPhoto(session.user.id, created.id, item.file, item.title));
            URL.revokeObjectURL(item.preview);
          }
          comFotos = { ...created, photos: [...(created.photos || []), ...enviadas] };
        } catch (err) {
          alert('O lugar foi guardado, mas não deu pra enviar as fotos.');
        }
      }
      setPlaces(ps => [...ps, comFotos]);
      if (d.wish_id) {
        try {
          await data.deleteWish(d.wish_id);
          setWishes(ws => ws.filter(w => w.id !== d.wish_id));
        } catch (err) {
          alert('O lugar foi guardado, mas ele continua no Quero ir.');
        }
      }
      setDraft(null);
      setSearchOpen(false);
      setQuery('');
      setResults([]);
      setTab('map');
      setTimeout(() => {
        leafRef.current.flyTo([created.latitude, created.longitude], 15, { duration: .9 });
        setSelId(created.id);
      }, 100);
    } catch (e) {
      alert('Não deu pra guardar esse lugar. Você está logado?');
    } finally {
      setSaving(false);
    }
  };

  const addList = async (l) => {
    setCreatingList(true);
    try {
      const created = await data.createList(l);
      setLists(ls => [...ls, created]);
      setNewListOpen(false);
      if (pendingListPick && draft) {
        setDraft(d => ({ ...d, list_ids: [...(d.list_ids || []), created.id] }));
        setPendingListPick(false);
      }
    } catch (e) {
      alert('Não deu pra criar a lista.');
    } finally {
      setCreatingList(false);
    }
  };

  const removePlace = async (id) => {
    const lugar = places.find(p => p.id === id);
    const nListas = (lugar?.list_ids || []).length;
    const aviso = nListas > 1
      ? `Excluir esse lugar? Ele sai das ${nListas} listas em que está.`
      : 'Excluir esse lugar?';
    if (!confirm(aviso)) return;
    try {
      await data.deletePlace(id);
      setPlaces(ps => ps.filter(p => p.id !== id));
      setSelId(null);
    } catch (e) {
      alert('Não deu pra excluir.');
    }
  };

  const saveWish = async () => {
    setSavingWish(true);
    try {
      const criado = await data.createWish({
        name: wishDraft.name.trim(),
        address: wishDraft.address,
        latitude: wishDraft.lat,
        longitude: wishDraft.lng,
        instagram: wishDraft.instagram?.trim().replace(/^@/, '') || null,
        note: wishDraft.note?.trim() || null,
      });
      setWishes(ws => [...ws, criado]);
      setWishDraft(null);
      setSearchOpen(false);
      setQuery('');
      setResults([]);
    } catch (e) {
      alert('Não deu pra guardar esse desejo.');
    } finally {
      setSavingWish(false);
    }
  };

  const removeWish = async (w) => {
    if (!confirm(`Tirar "${w.name}" do Quero ir?`)) return;
    try {
      await data.deleteWish(w.id);
      setWishes(ws => ws.filter(x => x.id !== w.id));
    } catch (e) {
      alert('Não deu pra excluir.');
    }
  };

  const marcarFui = (w) => {
    setDraft({
      address: w.address,
      lat: w.latitude,
      lng: w.longitude,
      name: w.name,
      category: '',
      rating: '',
      description: '',
      avg_price: '',
      instagram: w.instagram || '',
      photos: [],
      list_ids: [],
      wish_id: w.id,
    });
  };

  const removePlaceFromList = async (lugar, listId) => {
    const restantes = (lugar.list_ids || []).filter(id => id !== listId);
    if (restantes.length === 0) return;
    try {
      await data.setPlaceLists(lugar.id, restantes);
      setPlaces(ps => ps.map(p => (p.id === lugar.id ? { ...p, list_ids: restantes } : p)));
    } catch (e) {
      alert('Não deu pra tirar o lugar desta lista.');
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
      alert('Não deu pra gerar o link.');
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
      alert('Não deu pra salvar as alterações.');
      throw e;
    }
  };

  const addPhoto = async (placeId, file, title) => {
    try {
      const photo = await data.uploadPhoto(session.user.id, placeId, file, title);
      setPlaces(ps => ps.map(p => (p.id === placeId ? { ...p, photos: [...(p.photos || []), photo] } : p)));
    } catch (e) {
      alert('Não deu pra enviar a foto.');
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
      alert('Não deu pra salvar a ordem das fotos.');
    }
  };

  const removePhoto = async (placeId, photo) => {
    if (!confirm('Excluir essa foto?')) return;
    try {
      await data.deletePhoto(photo);
      setPlaces(ps => ps.map(p => (p.id === placeId ? { ...p, photos: (p.photos || []).filter(ph => ph.id !== photo.id) } : p)));
    } catch (e) {
      alert('Não deu pra excluir a foto.');
    }
  };

  const toggleRanking = async (list) => {
    try {
      const updated = await data.updateList(list.id, { ranking_enabled: !list.ranking_enabled });
      setLists(ls => ls.map(l => (l.id === updated.id ? updated : l)));
    } catch (e) {
      alert('Não deu pra atualizar a lista.');
    }
  };

  const saveHome = async ({ lat, lng }) => {
    const saved = await data.saveHome(session.user.id, { latitude: lat, longitude: lng });
    setHome(saved);
    setHomeOpen(false);
  };

  const removeHome = async () => {
    await data.clearHome(session.user.id);
    setHome(null);
    setHomeOpen(false);
  };

  const handleAuthButtonClick = () => {
    if (canEdit) auth.signOut();
    else setLoginOpen(true);
  };

  const sel = places.find(p => p.id === selId);
  const openList = lists.find(l => l.id === openListId);

  const showLoading = loadingData && lists.length === 0 && places.length === 0;

  return (
    <div style={{ position: 'fixed', inset: 0, background: C.paper, overflow: 'hidden', display: isDesktop ? 'flex' : 'block' }}>
    <div style={isDesktop ? { position: 'relative', flex: '1 1 auto', minWidth: 0, height: '100%' } : { position: 'absolute', inset: 0 }}>
      <div ref={mapRef} style={{ position: 'absolute', inset: 0 }} />
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 110, background: C.fade, pointerEvents: 'none', zIndex: 400 }} />

      <button onClick={toggleTheme} title={themeMode === 'dark' ? 'Mudar pro tema claro' : 'Mudar pro tema escuro'} style={{
        position: 'absolute', top: 16, left: 16, zIndex: 500, border: `1px solid ${C.line}`, borderRadius: 999,
        width: 34, height: 34, background: C.surface, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: C.sub, cursor: 'pointer', padding: 0,
      }}>
        {themeMode === 'dark' ? (
          <svg width="15" height="15" viewBox="0 0 16 16"><circle cx="8" cy="8" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.4" /><g stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><line x1="8" y1="0.8" x2="8" y2="2.6" /><line x1="8" y1="13.4" x2="8" y2="15.2" /><line x1="0.8" y1="8" x2="2.6" y2="8" /><line x1="13.4" y1="8" x2="15.2" y2="8" /><line x1="2.9" y1="2.9" x2="4.2" y2="4.2" /><line x1="11.8" y1="11.8" x2="13.1" y2="13.1" /><line x1="2.9" y1="13.1" x2="4.2" y2="11.8" /><line x1="11.8" y1="4.2" x2="13.1" y2="2.9" /></g></svg>
        ) : (
          <svg width="15" height="15" viewBox="0 0 16 16"><path d="M13.5 9.5A6 6 0 0 1 6.5 2.5 6 6 0 1 0 13.5 9.5Z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /></svg>
        )}
      </button>

      {isDesktop && sidebarHidden && (
        <button onClick={backToSidebar} style={{
          position: 'absolute', top: 16, left: 60, zIndex: 500, border: `1px solid ${C.line}`, borderRadius: 999,
          padding: '8px 14px', background: C.surface, fontFamily: 'Inter', fontWeight: 700, fontSize: 12.5,
          color: C.ink, cursor: 'pointer',
        }}>‹ Voltar</button>
      )}

      {showLoading && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 1000, background: C.paper, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter', fontWeight: 600, color: C.sub }}>
          Carregando…
        </div>
      )}

      {loadError && (
        <div style={{ position: 'absolute', top: 16, left: 16, right: 16, zIndex: 999, background: 'rgba(255,80,60,.15)', border: '1px solid rgba(255,80,60,.35)', color: '#FF6B5B', borderRadius: 12, padding: '10px 14px', fontWeight: 600, fontSize: 13 }}>{loadError}</div>
      )}

      {!sharedMode && (
        <button onClick={handleAuthButtonClick} style={{
          position: 'absolute', top: 16, right: 16, zIndex: 500, border: `1px solid ${C.line}`, borderRadius: 999,
          padding: '8px 14px', background: C.surface,
          fontFamily: 'Inter', fontWeight: 700, fontSize: 12.5, color: canEdit ? C.coral : C.sub, cursor: 'pointer',
        }}>
          {canEdit ? 'Sair' : 'Entrar'}
        </button>
      )}

      {canEdit && (
        <button onClick={() => setHomeOpen(true)} title="Definir minha casa (usada pra ordenar por distância)" style={{
          position: 'absolute', top: 16, right: 84, zIndex: 500, border: `1px solid ${C.line}`, borderRadius: 999,
          width: 34, height: 34, background: C.surface, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: home ? C.coral : C.sub, cursor: 'pointer', padding: 0,
        }}>
          <svg width="15" height="15" viewBox="0 0 16 16"><path d="M8 1.5L1.5 7v7.5h4.5v-4.5h4v4.5h4.5V7L8 1.5Z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /></svg>
        </button>
      )}

      {(isDesktop || tab === 'map') && !searchOpen && canEdit && (
        <div onClick={() => { setSearchTarget('place'); setSearchOpen(true); }} style={{
          position: 'absolute', top: 66, left: 16, right: 90, zIndex: 500, cursor: 'pointer',
          background: C.surface, borderRadius: 999, padding: '13px 18px', display: 'flex', alignItems: 'center', gap: 10,
          border: `1.5px solid ${C.line}`,
        }}>
          <svg width="18" height="18" viewBox="0 0 18 18"><circle cx="7.5" cy="7.5" r="5.5" fill="none" stroke={C.coral} strokeWidth="2.2" /><line x1="12" y1="12" x2="16" y2="16" stroke={C.coral} strokeWidth="2.2" strokeLinecap="round" /></svg>
          <span style={{ color: C.sub, fontSize: 15, fontWeight: 600 }}>Buscar um endereço pra guardar…</span>
        </div>
      )}

      {searchOpen && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 800, background: C.paper, display: 'flex', flexDirection: 'column', animation: 'fadeIn .15s' }}>
          <div style={{ padding: '66px 16px 10px', display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ flex: 1, background: C.surface, border: `1.5px solid ${C.line}`, borderRadius: 999, padding: '12px 18px', display: 'flex', gap: 10, alignItems: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 18 18"><circle cx="7.5" cy="7.5" r="5.5" fill="none" stroke={C.coral} strokeWidth="2.2" /><line x1="12" y1="12" x2="16" y2="16" stroke={C.coral} strokeWidth="2.2" strokeLinecap="round" /></svg>
              <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Rua, praça, avenida…" style={{ border: 'none', background: 'none', fontSize: 15, fontWeight: 600, color: C.ink, width: '100%' }} />
            </div>
            <button onClick={() => { setSearchOpen(false); setQuery(''); setResults([]); }} style={{ border: 'none', background: 'none', color: C.coral, fontFamily: 'Inter', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Cancelar</button>
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: '4px 16px 20px' }}>
            {!query.trim() && (
              <div style={{ textAlign: 'center', marginTop: 90, color: C.sub }}>
                <div style={{ fontFamily: 'Inter', fontSize: 18, fontWeight: 700, color: C.ink, marginTop: 10 }}>
                  {searchTarget === 'wish' ? 'Um lugar pra ir um dia' : 'Ache um lugar novo'}
                </div>
                <div style={{ fontSize: 13.5, fontWeight: 500, marginTop: 6, lineHeight: 1.5 }}>
                  {searchTarget === 'wish'
                    ? <React.Fragment>Busque o endereço e guarde na fila.<br />Só você vê, e não entra no mapa.</React.Fragment>
                    : <React.Fragment>Busque qualquer endereço,<br />dê um nome só seu e guarde numa lista.</React.Fragment>}
                </div>
              </div>
            )}
            {searching && <div style={{ textAlign: 'center', marginTop: 40, color: C.sub, fontWeight: 600 }}>Buscando…</div>}
            {query.trim() && !searching && results.length === 0 && (
              <div style={{ textAlign: 'center', marginTop: 80, color: C.sub, fontWeight: 600 }}>Nada por aqui... tenta outro endereço</div>
            )}
            {results.map((r, i) => (
              <div key={i} onClick={() => (searchTarget === 'wish'
                ? setWishDraft({ address: r.address, lat: r.lat, lng: r.lng, name: '', instagram: '', note: '' })
                : setDraft({ address: r.address, lat: r.lat, lng: r.lng, name: '', category: '', rating: '', description: '', avg_price: '', instagram: '', photos: [], list_ids: openListId && lists.some(l => l.id === openListId) ? [openListId] : (lists[0] ? [lists[0].id] : []) }))}
                style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '14px 6px', borderBottom: `1px solid ${C.line}`, cursor: 'pointer' }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: C.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="12" height="16" viewBox="0 0 12 16"><path d="M6 15.5C6 15.5 11 9.7 11 5.7C11 2.9 8.8 1 6 1C3.2 1 1 2.9 1 5.7C1 9.7 6 15.5 6 15.5Z" fill="none" stroke={C.coral} strokeWidth="1.4" /><circle cx="6" cy="5.6" r="1.8" fill={C.coral} /></svg>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, lineHeight: 1.35 }}>{r.address}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!isDesktop && tab === 'lists' && !openList && (
        <ListsPanel
          lists={lists}
          places={places}
          canEdit={canEdit}
          onOpenList={setOpenListId}
          onNewList={() => setNewListOpen(true)}
          onBack={() => setTab('map')}
          variant="overlay"
        />
      )}

      {!isDesktop && tab === 'wish' && canEdit && (
        <WishPanel
          wishes={wishes}
          home={home}
          onNew={() => { setSearchTarget('wish'); setSearchOpen(true); }}
          onFui={marcarFui}
          onRemove={removeWish}
          onBack={() => setTab('map')}
          variant="overlay"
        />
      )}

      {!isDesktop && openList && (
        <ListDetail
          list={openList}
          places={places.filter(p => (p.list_ids || []).includes(openList.id))}
          todasListas={lists}
          home={home}
          onBack={() => setOpenListId(null)}
          onOpen={goToPlace}
          onRemove={removePlace}
          onRemoveFromList={removePlaceFromList}
          onShare={() => shareList(openList)}
          onSavePlace={savePlaceEdits}
          onAddPhoto={addPhoto}
          onRemovePhoto={removePhoto}
          onReorderPhotos={reorderPhotos}
          onToggleRanking={() => toggleRanking(openList)}
          canEdit={canEdit}
          variant="overlay"
        />
      )}

      {!isDesktop && !searchOpen && !draft && (
        <div style={{ position: 'absolute', bottom: 30, left: '50%', transform: 'translateX(-50%)', zIndex: 700, display: 'flex', gap: 4, background: C.glass, backdropFilter: 'blur(14px)', borderRadius: 999, padding: 5, border: `1.5px solid ${C.line}` }}>
          {[['map', 'Mapa'], ['lists', 'Listas'], ...(canEdit ? [['wish', 'Quero ir']] : [])].map(([k, lb]) => (
            <button key={k} onClick={() => { setTab(k); setOpenListId(null); if (k === 'map') setTimeout(() => leafRef.current.invalidateSize(), 60); }} style={{
              border: 'none', cursor: 'pointer', borderRadius: 999, padding: '10px 26px',
              fontFamily: 'Inter', fontWeight: 700, fontSize: 14,
              background: tab === k ? C.coral : 'transparent', color: tab === k ? '#fff' : C.sub,
            }}>{lb}</button>
          ))}
        </div>
      )}

      {sel && (isDesktop || tab === 'map') && !draft && (
        <PlaceCard place={sel} list={lists.find(l => (sel.list_ids || []).includes(l.id))}
          onClose={() => {
            if (isDesktop && sidebarHidden) { backToSidebar(); return; }
            if (!isDesktop && returnListId) {
              setOpenListId(returnListId);
              setReturnListId(null);
              setTab('lists');
            }
            setSelId(null);
          }} />
      )}
    </div>

    {isDesktop && !sidebarHidden && (
      <div style={{ width: 380, flexShrink: 0, borderLeft: `1px solid ${C.line}`, background: C.paper, height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {canEdit && !openList && (
          <div style={{ display: 'flex', gap: 6, padding: '14px 20px 0', flexShrink: 0 }}>
            {[['lists', 'Listas'], ['wish', 'Quero ir']].map(([k, lb]) => {
              const ativa = k === 'wish' ? tab === 'wish' : tab !== 'wish';
              return (
                <button key={k} onClick={() => setTab(k)} style={{
                  border: `1.5px solid ${ativa ? C.coral : C.line}`, borderRadius: 999, padding: '6px 14px', cursor: 'pointer',
                  fontFamily: 'Inter', fontWeight: 700, fontSize: 12.5,
                  background: ativa ? C.coral + '22' : C.surface, color: ativa ? C.coral : C.sub,
                }}>{lb}</button>
              );
            })}
          </div>
        )}
        {!openList && tab === 'wish' && canEdit ? (
          <WishPanel
            wishes={wishes}
            home={home}
            onNew={() => { setSearchTarget('wish'); setSearchOpen(true); }}
            onFui={marcarFui}
            onRemove={removeWish}
            variant="panel"
          />
        ) : openList ? (
          <ListDetail
            list={openList}
            places={places.filter(p => (p.list_ids || []).includes(openList.id))}
          todasListas={lists}
            home={home}
            onBack={() => setOpenListId(null)}
            onOpen={goToPlace}
            onRemove={removePlace}
            onRemoveFromList={removePlaceFromList}
            onShare={() => shareList(openList)}
            onSavePlace={savePlaceEdits}
            onAddPhoto={addPhoto}
            onRemovePhoto={removePhoto}
          onReorderPhotos={reorderPhotos}
            onToggleRanking={() => toggleRanking(openList)}
            canEdit={canEdit}
            variant="panel"
          />
        ) : (
          <ListsPanel
            lists={lists}
            places={places}
            canEdit={canEdit}
            onOpenList={setOpenListId}
            onNewList={() => setNewListOpen(true)}
            variant="panel"
          />
        )}
      </div>
    )}

      {draft && (
        <SaveSheet
          draft={draft}
          setDraft={setDraft}
          lists={lists}
          saving={saving}
          onNewList={() => { setPendingListPick(true); setNewListOpen(true); }}
          onCancel={() => setDraft(null)}
          onSave={() => savePlace(draft)}
        />
      )}

      {wishDraft && (
        <WishSheet
          draft={wishDraft}
          setDraft={setWishDraft}
          saving={savingWish}
          onCancel={() => setWishDraft(null)}
          onSave={saveWish}
        />
      )}

      {newListOpen && (
        <NewListSheet
          creating={creatingList}
          onCancel={() => { setNewListOpen(false); setPendingListPick(false); }}
          onCreate={addList}
        />
      )}

      {loginOpen && <LoginForm onCancel={() => setLoginOpen(false)} />}

      {homeOpen && (
        <HomeSheet
          home={home}
          onCancel={() => setHomeOpen(false)}
          onSave={saveHome}
          onClear={removeHome}
        />
      )}
    </div>
  );
}

