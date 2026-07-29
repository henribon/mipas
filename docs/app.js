window.Mipas = window.Mipas || {};

function App() {
  const { useState, useEffect, useRef, useMemo } = React;
  const C = window.Mipas.theme;
  const data = window.Mipas.data;

  // ?list=<uuid> na URL => modo compartilhamento: sempre somente-leitura, mesmo
  // que o dono esteja logado no mesmo navegador, e restrito a essa lista só.
  const sharedListId = useMemo(() => new URLSearchParams(window.location.search).get('list'), []);
  const sharedMode = !!sharedListId;

  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  const [lists, setLists] = useState([]);
  const [places, setPlaces] = useState([]);
  const [home, setHome] = useState(null);
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
  const [themeMode, setThemeMode] = useState(() => (document.body.classList.contains('light') ? 'light' : 'dark'));

  const toggleTheme = () => {
    const next = themeMode === 'dark' ? 'light' : 'dark';
    window.Mipas.setTheme(next);
    setThemeMode(next);
  };

  const mapRef = useRef(null);
  const leafRef = useRef(null);
  const markersRef = useRef({});

  const canEdit = !sharedMode && !!session;

  useEffect(() => {
    window.Mipas.auth.getSession().then(s => { setSession(s); setAuthReady(true); });
    const sub = window.Mipas.auth.onChange(s => setSession(s));
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
    if (!canEdit) { setHome(null); return; }
    data.fetchHome().then(setHome).catch(() => setHome(null));
  }, [canEdit]);

  useEffect(() => {
    const m = window.Mipas.map.initMap(mapRef.current);
    leafRef.current = m;
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
    window.Mipas.map.syncMarkers(m, markersRef, places, lists, (p) => {
      setSelId(p.id);
      setTab('map');
      setOpenListId(null);
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

  const debouncedSearch = useMemo(() => window.Mipas.debounce(async (q) => {
    if (!q.trim()) { setResults([]); return; }
    setSearching(true);
    try {
      setResults(await window.Mipas.geocodeAddress(q));
    } catch (e) {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, 600), []);

  useEffect(() => { debouncedSearch(query); }, [query]);

  const goToPlace = (p) => {
    setTab('map');
    // Desktop: esconde a lateral (mapa vira tela cheia) mas mantém a lista
    // aberta, pro "Voltar" devolver exatamente onde a pessoa estava.
    // Mobile: fecha o overlay da lista, como sempre.
    if (isDesktop) setSidebarHidden(true);
    else setOpenListId(null);
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
        note: d.note || null,
        category: d.category?.trim() || null,
        rating: d.rating === '' || d.rating == null ? null : parseFloat(d.rating),
        description: d.description?.trim() || null,
        avg_price: d.avg_price === '' || d.avg_price == null ? null : parseFloat(d.avg_price),
        instagram: d.instagram?.trim().replace(/^@/, '') || null,
        list_id: d.list_id,
      });
      setPlaces(ps => [...ps, created]);
      setDraft(null);
      setSearchOpen(false);
      setQuery('');
      setResults([]);
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
        setDraft(d => ({ ...d, list_id: created.id }));
        setPendingListPick(false);
      }
    } catch (e) {
      alert('Não deu pra criar a lista.');
    } finally {
      setCreatingList(false);
    }
  };

  const removePlace = async (id) => {
    if (!confirm('Excluir esse lugar?')) return;
    try {
      await data.deletePlace(id);
      setPlaces(ps => ps.filter(p => p.id !== id));
      setSelId(null);
    } catch (e) {
      alert('Não deu pra excluir.');
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

  const updateRank = async (placeId, rank) => {
    try {
      const updated = await data.updatePlace(placeId, { rank });
      setPlaces(ps => ps.map(p => (p.id === placeId ? updated : p)));
    } catch (e) {
      alert('Não deu pra salvar o rank.');
    }
  };

  const updateCategory = async (placeId, category) => {
    try {
      const updated = await data.updatePlace(placeId, { category });
      setPlaces(ps => ps.map(p => (p.id === placeId ? updated : p)));
    } catch (e) {
      alert('Não deu pra salvar a categoria.');
    }
  };

  const updateRating = async (placeId, rating) => {
    try {
      const updated = await data.updatePlace(placeId, { rating });
      setPlaces(ps => ps.map(p => (p.id === placeId ? updated : p)));
    } catch (e) {
      alert('Não deu pra salvar a nota.');
    }
  };

  const updateDescription = async (placeId, description) => {
    try {
      const updated = await data.updatePlace(placeId, { description });
      setPlaces(ps => ps.map(p => (p.id === placeId ? updated : p)));
    } catch (e) {
      alert('Não deu pra salvar a descrição.');
    }
  };

  // Preenche o rank da lista inteira a partir da nota (maior nota = rank 1).
  // Lugares sem nota perdem o rank (ficam fora do ranking até ganharem nota).
  const autoRankByRating = async (list) => {
    const listPlaces = places.filter(p => p.list_id === list.id);
    const rated = listPlaces
      .filter(p => p.rating != null)
      .sort((a, b) => (b.rating - a.rating) || a.created_at.localeCompare(b.created_at));
    const updates = [
      ...rated.map((p, i) => ({ id: p.id, rank: i + 1 })),
      ...listPlaces.filter(p => p.rating == null && p.rank != null).map(p => ({ id: p.id, rank: null })),
    ].filter(u => { const cur = listPlaces.find(p => p.id === u.id); return cur.rank !== u.rank; });
    if (updates.length === 0) return;
    try {
      const results = await Promise.all(updates.map(u => data.updatePlace(u.id, { rank: u.rank })));
      setPlaces(ps => ps.map(p => results.find(r => r.id === p.id) || p));
    } catch (e) {
      alert('Não deu pra rankear por nota.');
    }
  };

  const updateInstagram = async (placeId, instagram) => {
    try {
      const updated = await data.updatePlace(placeId, { instagram: instagram ? instagram.replace(/^@/, '') : null });
      setPlaces(ps => ps.map(p => (p.id === placeId ? updated : p)));
    } catch (e) {
      alert('Não deu pra salvar o Instagram.');
    }
  };

  const updateAvgPrice = async (placeId, avg_price) => {
    try {
      const updated = await data.updatePlace(placeId, { avg_price });
      setPlaces(ps => ps.map(p => (p.id === placeId ? updated : p)));
    } catch (e) {
      alert('Não deu pra salvar o valor médio.');
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

  const updatePhotoMeta = async (placeId, photoId, patch) => {
    try {
      const updated = await data.updatePhoto(photoId, patch);
      setPlaces(ps => ps.map(p => (p.id === placeId
        ? { ...p, photos: (p.photos || []).map(ph => (ph.id === photoId ? updated : ph)) }
        : p)));
    } catch (e) {
      alert('Não deu pra salvar os dados da foto.');
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
    if (canEdit) window.Mipas.auth.signOut();
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
        <div onClick={() => setSearchOpen(true)} style={{
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
                <div style={{ fontFamily: 'Inter', fontSize: 18, fontWeight: 700, color: C.ink, marginTop: 10 }}>Ache um lugar novo</div>
                <div style={{ fontSize: 13.5, fontWeight: 500, marginTop: 6, lineHeight: 1.5 }}>Busque qualquer endereço,<br />dê um nome só seu e guarde numa lista.</div>
              </div>
            )}
            {searching && <div style={{ textAlign: 'center', marginTop: 40, color: C.sub, fontWeight: 600 }}>Buscando…</div>}
            {query.trim() && !searching && results.length === 0 && (
              <div style={{ textAlign: 'center', marginTop: 80, color: C.sub, fontWeight: 600 }}>Nada por aqui... tenta outro endereço</div>
            )}
            {results.map((r, i) => (
              <div key={i} onClick={() => setDraft({ address: r.address, lat: r.lat, lng: r.lng, name: '', note: '', category: '', rating: '', description: '', avg_price: '', instagram: '', list_id: lists[0]?.id })}
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

      {!isDesktop && openList && (
        <ListDetail
          list={openList}
          places={places.filter(p => p.list_id === openList.id)}
          home={home}
          onBack={() => setOpenListId(null)}
          onOpen={goToPlace}
          onRemove={removePlace}
          onShare={() => shareList(openList)}
          onUpdateRank={updateRank}
          onUpdateCategory={updateCategory}
          onUpdateRating={updateRating}
          onUpdateDescription={updateDescription}
          onUpdateAvgPrice={updateAvgPrice}
          onUpdateInstagram={updateInstagram}
          onAddPhoto={addPhoto}
          onRemovePhoto={removePhoto}
          onUpdatePhoto={updatePhotoMeta}
          onToggleRanking={() => toggleRanking(openList)}
          onAutoRank={() => autoRankByRating(openList)}
          canEdit={canEdit}
          variant="overlay"
        />
      )}

      {!isDesktop && !searchOpen && !draft && (
        <div style={{ position: 'absolute', bottom: 30, left: '50%', transform: 'translateX(-50%)', zIndex: 700, display: 'flex', gap: 4, background: C.glass, backdropFilter: 'blur(14px)', borderRadius: 999, padding: 5, border: `1.5px solid ${C.line}` }}>
          {[['map', 'Mapa'], ['lists', 'Listas']].map(([k, lb]) => (
            <button key={k} onClick={() => { setTab(k); setOpenListId(null); if (k === 'map') setTimeout(() => leafRef.current.invalidateSize(), 60); }} style={{
              border: 'none', cursor: 'pointer', borderRadius: 999, padding: '10px 26px',
              fontFamily: 'Inter', fontWeight: 700, fontSize: 14,
              background: tab === k ? C.coral : 'transparent', color: tab === k ? '#fff' : C.sub,
            }}>{lb}</button>
          ))}
        </div>
      )}

      {sel && (isDesktop || tab === 'map') && !draft && (
        <PlaceCard place={sel} list={lists.find(l => l.id === sel.list_id)}
          onClose={() => { if (isDesktop && sidebarHidden) backToSidebar(); else setSelId(null); }} />
      )}
    </div>

    {isDesktop && !sidebarHidden && (
      <div style={{ width: 380, flexShrink: 0, borderLeft: `1px solid ${C.line}`, background: C.paper, height: '100%', overflow: 'hidden' }}>
        {openList ? (
          <ListDetail
            list={openList}
            places={places.filter(p => p.list_id === openList.id)}
            home={home}
            onBack={() => setOpenListId(null)}
            onOpen={goToPlace}
            onRemove={removePlace}
            onShare={() => shareList(openList)}
            onUpdateRank={updateRank}
            onUpdateCategory={updateCategory}
            onUpdateRating={updateRating}
            onUpdateDescription={updateDescription}
            onUpdateAvgPrice={updateAvgPrice}
          onUpdateInstagram={updateInstagram}
            onAddPhoto={addPhoto}
            onRemovePhoto={removePhoto}
          onUpdatePhoto={updatePhotoMeta}
            onToggleRanking={() => toggleRanking(openList)}
          onAutoRank={() => autoRankByRating(openList)}
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

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
