import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { SearchBar } from '@/components/ui/search-bar';
import { Dropdown } from '@/components/ui/dropdown';
import { cn } from '@/lib/utils';
import { getTheme, listColors } from '@/theme';
import * as data from '@/data';
import * as mapa from '@/map';
import { LoginForm } from '@/auth';
import { haversineKm } from '@/geocoding';
import { MAX_PARADAS } from '@/routing';
import { clearDraft } from '@/drafts';
import { telaGrande, useIsDesktop } from '@/hooks/useIsDesktop';
import { useThemeMode } from '@/hooks/useThemeMode';
import { useSession } from '@/hooks/useSession';
import { useMipasData } from '@/hooks/useMipasData';
import { usePlaceFilters } from '@/hooks/usePlaceFilters';
import { useOrigin } from '@/hooks/useOrigin';
import { useDrafts } from '@/hooks/useDrafts';
import { useSearch } from '@/hooks/useSearch';
import { useItinerary } from '@/hooks/useItinerary';
import { useMipasMap } from '@/hooks/useMipasMap';
import { SaveSheet, ListSheet, HomeSheet, PlaceCard, ListsPanel, ListDetail, WishPanel, WishSheet, MapLayersPanel, ItineraryPanel, OriginPanel, PlaceHit, HomeButton } from '@/components/mipas';

export default function App() {
  const C = getTheme();

  const sharedListId = useMemo(() => new URLSearchParams(window.location.search).get('list'), []);
  const sharedMode = !!sharedListId;

  const isDesktop = useIsDesktop();
  const { themeMode, toggleTheme } = useThemeMode();
  const { session, authReady, canEdit, loginOpen, setLoginOpen, fail, handleAuthButtonClick } = useSession(sharedMode);

  const [tab, setTab] = useState(() => (telaGrande() ? 'map' : 'lists'));
  const [openListId, setOpenListId] = useState(sharedMode ? sharedListId : null);
  const [selId, setSelId] = useState(null);
  const [returnListId, setReturnListId] = useState(null);
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [routePlaceId, setRoutePlaceId] = useState(null);

  const [newListOpen, setNewListOpen] = useState(false);
  const [creatingList, setCreatingList] = useState(false);
  const [pendingListPick, setPendingListPick] = useState(false);
  const [editingList, setEditingList] = useState(null);
  const [homeOpen, setHomeOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingWish, setSavingWish] = useState(false);

  const {
    lists, setLists, places, setPlaces, home, wishes, setWishes,
    loadingData, loadError, loadId,
    setListColor, removePlaceFromList, shareList, savePlaceEdits,
    addPhoto, reorderPhotos, removePhoto, setCoverPhoto, removeWish,
    saveHome: gravarCasa, removeHome: apagarCasa,
  } = useMipasData({ sharedMode, sharedListId, authReady, session, canEdit, fail });

  const {
    layersOpen, setLayersOpen,
    hiddenListIds, setHiddenListIds,
    pickedCategories, setPickedCategories,
    minRating, setMinRating,
    categories, filtrando, visiblePlaces, revelarLugar, mostrarSomente,
  } = usePlaceFilters(places);

  const { gps, origem, origemRota, origemPref, setOrigemPref, originOpen, setOriginOpen } = useOrigin(home);
  const { draft, setDraft, wishDraft, setWishDraft, descartarDraft, descartarWishDraft } = useDrafts(canEdit);

  const {
    searchOpen, setSearchOpen, searchTarget, setSearchTarget,
    query, setQuery, results, setResults, searching,
    debouncedSearch, matchPlaces, fecharBusca,
  } = useSearch({ places, lists, canEdit });

  const {
    itineraryOpen, setItineraryOpen, stopIds, setStopIds,
    itineraryMode, setItineraryMode, optimize, setOptimize,
    fromOrigin, setFromOrigin, toggleStop, moveStop,
  } = useItinerary();

  const {
    mapRef, leafRef, route, routeLoading, itinerary, itineraryLoading,
    invalidarTamanho, voarPara,
  } = useMipasMap({
    places, visiblePlaces, lists, isDesktop, sharedMode,
    openListId, selId, setSelId, gpsPos: gps.pos, routePlaceId, origemRota,
    itineraryOpen, stopIds, itineraryMode, optimize, fromOrigin,
    onEscolherParada: (p) => toggleStop(p.id),
    onAbrirLugar: (p) => {
      setSelId(p.id);
      setTab('map');
      setOpenListId(null);
      setReturnListId(null);
    },
    onCliqueNoMapa: () => { setSelId(null); setReturnListId(null); },
    fail,
  });

  useEffect(() => {
    if (sharedMode || loadId === 0) return;
    const campo = canEdit ? 'hidden_for_owner' : 'hidden_for_visitor';
    setHiddenListIds((lists as any[]).filter(l => l[campo]).map(l => l.id));
  }, [loadId]);

  useEffect(() => {
    setStopIds(ids => {
      const validos = ids.filter(id => visiblePlaces.some(p => p.id === id));
      return validos.length === ids.length ? ids : validos;
    });
  }, [visiblePlaces]);

  useEffect(() => { setRoutePlaceId(null); }, [selId]);

  const offsetRoteiro = (itineraryOpen && fromOrigin && origemRota) ? 1 : 0;

  const stopIdsEmOrdem = useMemo(() => {
    if (!itinerary || itinerary.order.length !== stopIds.length + offsetRoteiro) return stopIds;
    return itinerary.order.filter(i => i >= offsetRoteiro).map(i => stopIds[i - offsetRoteiro]);
  }, [itinerary, stopIds, offsetRoteiro]);

  const showMap = () => {
    setTab('map');
    setOpenListId(null);
    invalidarTamanho();
  };

  const goToPlace = (p) => {
    setTab('map');
    if (isDesktop) {
      setSidebarHidden(true);
    } else {
      setReturnListId(openListId);
      setOpenListId(null);
    }
    setSelId(p.id);
    voarPara(p.latitude, p.longitude, { zoom: 15, duracao: .8, atraso: 60, remedir: true });
  };

  const abrirLugarDaBusca = (p) => {
    revelarLugar(p);
    fecharBusca();
    goToPlace(p);
  };

  const backToSidebar = () => {
    setSidebarHidden(false);
    setSelId(null);
    invalidarTamanho();
  };

  const abrirRoteiro = () => {
    setItineraryOpen(true);
    setLayersOpen(false);
    setRoutePlaceId(null);
    setSelId(null);
  };

  const montarRoteiroDaLista = (list) => {
    mostrarSomente(list.id, lists);
    setStopIds([]);
    setOpenListId(null);
    setTab('map');
    abrirRoteiro();
    invalidarTamanho();
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
          fail('O lugar foi guardado, mas não deu pra enviar as fotos', err);
        }
      }
      setPlaces(ps => [...ps, comFotos]);
      revelarLugar(comFotos);
      if (d.wish_id) {
        try {
          await data.deleteWish(d.wish_id);
          setWishes(ws => ws.filter(w => w.id !== d.wish_id));
        } catch (err) {
          fail('O lugar foi guardado, mas ele continua no Quero ir', err);
        }
      }
      clearDraft('place');
      setDraft(null);
      fecharBusca();
      setTab('map');
      setTimeout(() => {
        voarPara(created.latitude, created.longitude, { zoom: 15, duracao: .9 });
        if (isDesktop || !openListId) setSelId(created.id);
      }, 100);
    } catch (e) {
      fail('Não deu pra guardar esse lugar', e);
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
      fail('Não deu pra criar a lista', e);
    } finally {
      setCreatingList(false);
    }
  };

  const saveListEdits = async (patch) => {
    setCreatingList(true);
    try {
      const updated = await data.updateList(editingList.id, patch);
      setLists(ls => ls.map(l => (l.id === updated.id ? updated : l)));
      setEditingList(null);
    } catch (e) {
      fail('Não deu pra salvar a lista', e);
    } finally {
      setCreatingList(false);
    }
  };

  const toggleListHidden = async (list, campo) => {
    const valor = !list[campo];
    const antes = lists;
    setLists(ls => ls.map(l => (l.id === list.id ? { ...l, [campo]: valor } : l)));
    if (campo === (canEdit ? 'hidden_for_owner' : 'hidden_for_visitor')) {
      setHiddenListIds(ids => (valor
        ? (ids.includes(list.id) ? ids : [...ids, list.id])
        : ids.filter(id => id !== list.id)));
    }
    try {
      await data.updateList(list.id, { [campo]: valor });
    } catch (e) {
      setLists(antes);
      fail('Não deu pra mudar a visibilidade da lista', e);
    }
  };

  const menuDaLista = (l) => [
    openListId !== l.id && { rotulo: 'Abrir lista', onClick: () => setOpenListId(l.id) },
    { rotulo: 'Editar lista…', onClick: () => setEditingList(l) },
    { rotulo: 'Mudar a cor', cores: {
      atual: l.color,
      opcoes: listColors.includes(l.color) ? listColors : [l.color, ...listColors],
      onEscolher: (cor) => setListColor(l, cor),
    } },
    { rotulo: l.hidden_for_owner ? 'Mostrar no meu mapa' : 'Ocultar do meu mapa',
      separadorAntes: true, onClick: () => toggleListHidden(l, 'hidden_for_owner') },
    { rotulo: l.hidden_for_visitor ? 'Mostrar no mapa dos visitantes' : 'Ocultar do mapa dos visitantes',
      onClick: () => toggleListHidden(l, 'hidden_for_visitor') },
    { rotulo: l.is_public ? 'Copiar link' : 'Tornar pública e copiar link', separadorAntes: true, onClick: () => shareList(l) },
    { rotulo: 'Adicionar novo lugar…', onClick: () => novoLugarNaLista(l) },
    { rotulo: 'Excluir lista', perigo: true, separadorAntes: true, onClick: () => removeList(l) },
  ];

  const removeList = async (list) => {
    const soNesta = places.filter(p => (p.list_ids || []).length === 1 && p.list_ids[0] === list.id);
    const nota = soNesta.length === 0 ? ''
      : soNesta.length === 1
        ? '\n\n1 lugar que só está nela vai ser apagado junto.'
        : `\n\n${soNesta.length} lugares que só estão nela vão ser apagados junto.`;
    if (!confirm(`Excluir a lista "${list.name}"?${nota}`)) return;
    try {
      const orfaos = await data.deleteList(list.id);
      setLists(ls => ls.filter(l => l.id !== list.id));
      setPlaces(ps => ps
        .filter(p => !orfaos.includes(p.id))
        .map(p => ((p.list_ids || []).includes(list.id)
          ? { ...p, list_ids: p.list_ids.filter(id => id !== list.id) }
          : p)));
      setHiddenListIds(ids => ids.filter(id => id !== list.id));
      setSelId(id => (orfaos.includes(id) ? null : id));
      setReturnListId(id => (id === list.id ? null : id));
      setOpenListId(null);
      setTab('lists');
    } catch (e) {
      fail('Não deu pra excluir a lista', e);
    }
  };

  const novoLugarNaLista = (list) => {
    setDraft({
      address: '', lat: null, lng: null, name: '', category: '', rating: '',
      description: '', avg_price: '', instagram: '', photos: [], list_ids: [list.id],
    });
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
      fail('Não deu pra excluir esse lugar', e);
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
      clearDraft('wish');
      setWishDraft(null);
      fecharBusca();
    } catch (e) {
      fail('Não deu pra guardar esse desejo', e);
    } finally {
      setSavingWish(false);
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

  const saveHome = async ({ lat, lng }) => {
    await gravarCasa({ lat, lng });
    setHomeOpen(false);
  };

  const removeHome = async () => {
    await apagarCasa();
    setHomeOpen(false);
  };

  const sel = places.find(p => p.id === selId);
  const openList = lists.find(l => l.id === openListId);

  const showLoading = loadingData && lists.length === 0 && places.length === 0;

  const mapaAparecendo = isDesktop || (tab === 'map' && !openList);

  return (
    <div style={{ position: 'fixed', inset: 0, background: C.paper, overflow: 'hidden', display: isDesktop ? 'flex' : 'block' }}>
    <div style={isDesktop ? { position: 'relative', flex: '1 1 auto', minWidth: 0, height: '100%' } : { position: 'absolute', inset: 0 }}>
      <div ref={mapRef} style={{ position: 'absolute', inset: 0 }} />
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 110, background: C.fade, pointerEvents: 'none', zIndex: 400 }} />

      <Button onClick={toggleTheme} variant="outline" size="icon"
        tooltip={themeMode === 'dark' ? 'Tema claro' : 'Tema escuro'}
        className="!absolute top-4 left-4 z-[500] !text-sub">
        {themeMode === 'dark' ? (
          <svg width="15" height="15" viewBox="0 0 16 16"><circle cx="8" cy="8" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.4" /><g stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><line x1="8" y1="0.8" x2="8" y2="2.6" /><line x1="8" y1="13.4" x2="8" y2="15.2" /><line x1="0.8" y1="8" x2="2.6" y2="8" /><line x1="13.4" y1="8" x2="15.2" y2="8" /><line x1="2.9" y1="2.9" x2="4.2" y2="4.2" /><line x1="11.8" y1="11.8" x2="13.1" y2="13.1" /><line x1="2.9" y1="13.1" x2="4.2" y2="11.8" /><line x1="11.8" y1="4.2" x2="13.1" y2="2.9" /></g></svg>
        ) : (
          <svg width="15" height="15" viewBox="0 0 16 16"><path d="M13.5 9.5A6 6 0 0 1 6.5 2.5 6 6 0 1 0 13.5 9.5Z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /></svg>
        )}
      </Button>

      {places.length > 1 && (
        <Button onClick={() => { setLayersOpen(o => !o); }} variant="outline" size="icon"
          tooltip="Camadas do mapa"
          className={cn('!absolute top-4 left-[60px] z-[500]', !(layersOpen || filtrando) && '!text-sub')}>
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
            <path d="M8 1.6 14.4 5 8 8.4 1.6 5 8 1.6Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
            <path d="M2.6 8 8 10.9 13.4 8M2.6 11 8 13.9 13.4 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {filtrando && <span style={{ position: 'absolute', top: 4, right: 4, width: 7, height: 7, borderRadius: 99, background: C.coral }} />}
        </Button>
      )}

      {places.length > 1 && (
        <Button onClick={() => (itineraryOpen ? setItineraryOpen(false) : abrirRoteiro())} variant="outline" size="icon"
          tooltip="Montar roteiro"
          className={cn('!absolute top-4 left-[108px] z-[500]', !itineraryOpen && '!text-sub')}>
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
            <circle cx="3.6" cy="12.4" r="2.1" stroke="currentColor" strokeWidth="1.4" />
            <circle cx="12.4" cy="3.6" r="2.1" stroke="currentColor" strokeWidth="1.4" />
            <path d="M10.3 3.6H6.6a2.6 2.6 0 0 0 0 5.2h2.8a2.6 2.6 0 0 1 0 5.2H5.7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          {stopIds.length > 0 && (
            <span style={{ position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, borderRadius: 99, background: C.coral, color: '#fff', fontSize: 10, fontWeight: 800, lineHeight: '16px', textAlign: 'center', padding: '0 3px' }}>{stopIds.length}</span>
          )}
        </Button>
      )}

      {isDesktop && sidebarHidden && (
        <Button onClick={backToSidebar} variant="outline" size="sm" className="!absolute top-4 left-[156px] z-[500] !text-ink">‹ Voltar</Button>
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
        <Button onClick={handleAuthButtonClick} variant="outline" size="sm"
          className={cn('!absolute top-4 right-4 z-[500]', !canEdit && '!text-sub')}>
          {canEdit ? 'Sair' : 'Entrar'}
        </Button>
      )}

      <Button onClick={() => setOriginOpen(o => !o)} variant="outline" size="icon"
        tooltip="De onde medir as distâncias"
        className={cn('!absolute top-4 z-[500]', sharedMode ? 'right-4' : 'right-[84px]', !origem && '!text-sub')}>
        {origem && origem.tipo === 'home' ? (
          <svg width="15" height="15" viewBox="0 0 16 16"><path d="M8 1.5L1.5 7v7.5h4.5v-4.5h4v4.5h4.5V7L8 1.5Z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /></svg>
        ) : (
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="2.6" fill="currentColor" />
            <circle cx="8" cy="8" r="5.4" stroke="currentColor" strokeWidth="1.3" />
            <g stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
              <line x1="8" y1="0.9" x2="8" y2="2.6" /><line x1="8" y1="13.4" x2="8" y2="15.1" />
              <line x1="0.9" y1="8" x2="2.6" y2="8" /><line x1="13.4" y1="8" x2="15.1" y2="8" />
            </g>
          </svg>
        )}
        {gps.estado === 'ligado' && (
          <span style={{ position: 'absolute', top: 3, right: 3, width: 7, height: 7, borderRadius: 99, background: mapa.ME_COLOR }} />
        )}
      </Button>

      {(isDesktop || tab === 'map') && !searchOpen && (canEdit || places.length > 0) && (
        <SearchBar
          readOnly
          onClick={() => { setSearchTarget('place'); setSearchOpen(true); }}
          placeholder={canEdit ? 'Buscar um lugar ou endereço…' : 'Buscar nesta lista…'}
          className="absolute top-[66px] left-1/2 -translate-x-1/2 z-[500] w-[240px] max-w-[calc(100%-32px)] transition-[width] duration-300 hover:w-[440px] focus-within:w-[440px]"
        />
      )}

      {searchOpen && (
        <div
          onClick={() => { setSearchOpen(false); setQuery(''); setResults([]); }}
          className={cn(
            'absolute inset-0 z-[800]',
            isDesktop ? 'bg-paper/35 backdrop-blur-[2px]' : 'bg-paper',
          )}
          style={{ animation: 'fadeIn .15s' }}
        >
          <div
            onClick={ev => ev.stopPropagation()}
            className={cn(
              'flex flex-col',
              isDesktop
                ? 'absolute left-1/2 top-[60px] w-[min(560px,calc(100%-32px))] -translate-x-1/2 overflow-hidden rounded-xl border border-line bg-surface/90 shadow-2xl backdrop-blur-xl'
                : 'h-full',
            )}
          >
            <div className={cn('flex items-center gap-2.5', isDesktop ? 'p-3' : 'px-4 pb-2.5 pt-[66px]')}>
              <SearchBar
                autoFocus
                value={query}
                onChange={setQuery}
                onSubmit={() => debouncedSearch(query)}
                placeholder={searchTarget === 'wish'
                  ? 'Rua, praça, avenida…'
                  : (canEdit ? 'Nome, categoria ou endereço…' : 'Buscar nesta lista…')}
                className="min-w-0 flex-1"
              />
              <Button onClick={() => { setSearchOpen(false); setQuery(''); setResults([]); }} variant="plain" size="sm">Cancelar</Button>
            </div>

            <div className={cn('overflow-auto', isDesktop ? 'max-h-[min(60vh,420px)] px-3 pb-3' : 'flex-1 px-4 pb-5')}>
              {!query.trim() && (
                <div className={cn('text-center text-sub', isDesktop ? 'py-6' : 'mt-[90px]')}>
                  <div className="font-display text-[17px] font-normal text-ink">
                    {searchTarget === 'wish' ? 'Um lugar pra ir um dia' : (canEdit ? 'Ache um lugar' : 'Buscar nesta lista')}
                  </div>
                  <div className="mt-1.5 text-[13.5px] font-medium leading-relaxed">
                    {searchTarget === 'wish'
                      ? <React.Fragment>Busque o endereço e guarde na fila.<br />Só você vê, e não entra no mapa.</React.Fragment>
                      : canEdit
                        ? <React.Fragment>Procure entre os lugares que você já guardou,<br />ou busque um endereço novo pra guardar.</React.Fragment>
                        : <React.Fragment>Procure pelo nome, categoria<br />ou endereço de um lugar da lista.</React.Fragment>}
                  </div>
                </div>
              )}

              {searchTarget === 'place' && matchPlaces.length > 0 && (
                <React.Fragment>
                  <div className="px-2 pb-1 pt-1 text-[11px] font-extrabold uppercase tracking-wide text-sub">
                    {canEdit ? 'Nos seus lugares' : 'Nesta lista'}
                  </div>
                  {matchPlaces.map(p => (
                    <PlaceHit key={p.id} place={p} lists={lists} onClick={() => abrirLugarDaBusca(p)} />
                  ))}
                </React.Fragment>
              )}

              {searching && <div className="py-6 text-center font-semibold text-sub">Buscando…</div>}
              {query.trim() && !searching && results.length === 0 && matchPlaces.length === 0 && (
                <div className="py-6 text-center font-semibold text-sub">
                  {canEdit ? 'Nada por aqui... tenta outro nome ou endereço' : 'Nenhum lugar com esse nome nesta lista'}
                </div>
              )}
              {results.length > 0 && searchTarget === 'place' && matchPlaces.length > 0 && (
                <div className="px-2 pb-1 pt-3 text-[11px] font-extrabold uppercase tracking-wide text-sub">Endereços novos</div>
              )}
              {results.map((r, i) => (
                <div key={i} onClick={() => (searchTarget === 'wish'
                  ? setWishDraft({ address: r.address, lat: r.lat, lng: r.lng, name: '', instagram: '', note: '' })
                  : setDraft({ address: r.address, lat: r.lat, lng: r.lng, name: '', category: '', rating: '', description: '', avg_price: '', instagram: '', photos: [], list_ids: openListId && lists.some(l => l.id === openListId) ? [openListId] : (lists[0] ? [lists[0].id] : []) }))}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border-b border-line px-2 py-3.5 last:border-b-0 hover:bg-cream">
                  <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] bg-cream">
                    <svg width="12" height="16" viewBox="0 0 12 16"><path d="M6 15.5C6 15.5 11 9.7 11 5.7C11 2.9 8.8 1 6 1C3.2 1 1 2.9 1 5.7C1 9.7 6 15.5 6 15.5Z" fill="none" stroke={C.coral} strokeWidth="1.4" /><circle cx="6" cy="5.6" r="1.8" fill={C.coral} /></svg>
                  </div>
                  <div className="text-[14px] font-semibold leading-snug text-ink">{r.address}</div>
                </div>
              ))}
            </div>
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
          menuDaLista={canEdit ? menuDaLista : null}
          onViewMap={showMap}
          seletor={canEdit ? <Dropdown valor={tab === 'wish' ? 'wish' : 'lists'} opcoes={[{ valor: 'lists', rotulo: 'Minhas listas' }, { valor: 'wish', rotulo: 'Quero ir' }]} onEscolher={setTab} /> : null}
          variant="overlay"
        />
      )}

      {!isDesktop && tab === 'wish' && canEdit && (
        <WishPanel
          wishes={wishes}
          origem={origem}
          onNew={() => { setSearchTarget('wish'); setSearchOpen(true); }}
          onFui={marcarFui}
          onRemove={removeWish}
          onViewMap={showMap}
          seletor={canEdit ? <Dropdown valor={tab === 'wish' ? 'wish' : 'lists'} opcoes={[{ valor: 'lists', rotulo: 'Minhas listas' }, { valor: 'wish', rotulo: 'Quero ir' }]} onEscolher={setTab} /> : null}
          variant="overlay"
        />
      )}

      {!isDesktop && openList && (
        <ListDetail
          list={openList}
          places={places.filter(p => (p.list_ids || []).includes(openList.id))}
          todasListas={lists}
          origem={origem}
          onBack={() => setOpenListId(null)}
          onOpen={goToPlace}
          onRemove={removePlace}
          onRemoveFromList={removePlaceFromList}
          onShare={() => shareList(openList)}
          onSavePlace={savePlaceEdits}
          onAddPhoto={addPhoto}
          onRemovePhoto={removePhoto}
          onReorderPhotos={reorderPhotos}
          onSetCover={setCoverPhoto}
          onBuildItinerary={() => montarRoteiroDaLista(openList)}
          onAddPlace={() => novoLugarNaLista(openList)}
          onDeleteList={() => removeList(openList)}
          menuDaLista={canEdit ? menuDaLista : null}
          canEdit={canEdit}
          variant="overlay"
        />
      )}

      {!isDesktop && !searchOpen && !draft && (
        <div style={{ position: 'absolute', bottom: 30, left: '50%', transform: 'translateX(-50%)', zIndex: 700, display: 'flex', gap: 4, background: C.glass, backdropFilter: 'blur(14px)', borderRadius: 999, padding: 5, border: `1.5px solid ${C.line}` }}>
          {[['map', 'Mapa'], ['lists', 'Listas']].map(([k, lb]) => {
            const ativa = k === 'map' ? tab === 'map' : tab !== 'map';
            return (
              <Button key={k} onClick={() => { if (k === 'map') { showMap(); return; } setTab(k); setOpenListId(null); }} variant={ativa ? 'primary' : 'ghost'} size="md" className="!px-7 !shadow-none">{lb}</Button>
            );
          })}
        </div>
      )}

      {originOpen && mapaAparecendo && (
        <OriginPanel
          origem={origemPref}
          onOrigem={setOrigemPref}
          gpsEstado={gps.estado}
          gpsPos={gps.pos}
          onLigarGps={gps.ligar}
          onDesligarGps={gps.desligar}
          home={home}
          canEdit={canEdit}
          onDefinirCasa={() => { setOriginOpen(false); setHomeOpen(true); }}
          onCentralizar={() => {
            if (!gps.pos || !leafRef.current) return;
            leafRef.current.flyTo([gps.pos.latitude, gps.pos.longitude], Math.max(leafRef.current.getZoom(), 15), { duration: .7 });
          }}
          onClose={() => setOriginOpen(false)}
          isDesktop={isDesktop}
        />
      )}

      {layersOpen && mapaAparecendo && (
        <MapLayersPanel
          lists={lists}
          places={places}
          hiddenListIds={hiddenListIds}
          onToggleList={id => setHiddenListIds(ids => (ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]))}
          onSetHidden={setHiddenListIds}
          categories={categories}
          pickedCategories={pickedCategories}
          onToggleCategory={c => setPickedCategories(cs => (cs.includes(c) ? cs.filter(x => x !== c) : [...cs, c]))}
          minRating={minRating}
          onMinRating={setMinRating}
          visibleCount={visiblePlaces.length}
          filtrando={filtrando}
          onReset={() => { setHiddenListIds([]); setPickedCategories([]); setMinRating(null); }}
          onClose={() => setLayersOpen(false)}
          isDesktop={isDesktop}
        />
      )}

      {itineraryOpen && mapaAparecendo && (
        <ItineraryPanel
          candidatos={visiblePlaces}
          lists={lists}
          stopIds={stopIds}
          ordenados={stopIdsEmOrdem}
          offset={offsetRoteiro}
          onToggleStop={toggleStop}
          onMoveStop={moveStop}
          onClearStops={() => setStopIds([])}
          mode={itineraryMode}
          onMode={setItineraryMode}
          optimize={optimize}
          onOptimize={setOptimize}
          fromOrigin={fromOrigin}
          onFromOrigin={setFromOrigin}
          origemTipo={origemRota ? origemRota.tipo : null}
          itinerary={itinerary}
          loading={itineraryLoading}
          maxParadas={MAX_PARADAS}
          onClose={() => setItineraryOpen(false)}
          isDesktop={isDesktop}
        />
      )}

      {sel && (isDesktop || tab === 'map') && !draft && !itineraryOpen && (
        <PlaceCard place={sel} list={lists.find(l => (sel.list_ids || []).includes(l.id))}
          refKm={origem ? haversineKm(origem.latitude, origem.longitude, sel.latitude, sel.longitude) : null}
          refTipo={origem ? origem.tipo : null}
          route={route}
          routeLoading={routeLoading}
          routeOpen={routePlaceId === sel.id}
          onToggleRoute={origem
            ? () => setRoutePlaceId(id => (id === sel.id ? null : sel.id))
            : null}
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
      <div style={{ width: 'clamp(360px, 38%, 620px)', flexShrink: 0, borderLeft: `1px solid ${C.line}`, background: C.paper, height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '14px 20px 0', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          <HomeButton />
          {canEdit && !openList && (
            <Dropdown
              valor={tab === 'wish' ? 'wish' : 'lists'}
              opcoes={[{ valor: 'lists', rotulo: 'Minhas listas' }, { valor: 'wish', rotulo: 'Quero ir' }]}
              onEscolher={setTab}
            />
          )}
        </div>
        {!openList && tab === 'wish' && canEdit ? (
          <WishPanel
            wishes={wishes}
            origem={origem}
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
            origem={origem}
            onBack={() => setOpenListId(null)}
            onOpen={goToPlace}
            onRemove={removePlace}
            onRemoveFromList={removePlaceFromList}
            onShare={() => shareList(openList)}
            onSavePlace={savePlaceEdits}
            onAddPhoto={addPhoto}
            onRemovePhoto={removePhoto}
            onReorderPhotos={reorderPhotos}
            onSetCover={setCoverPhoto}
            onBuildItinerary={() => montarRoteiroDaLista(openList)}
            onAddPlace={() => novoLugarNaLista(openList)}
            onDeleteList={() => removeList(openList)}
            menuDaLista={canEdit ? menuDaLista : null}
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
            menuDaLista={canEdit ? menuDaLista : null}
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
          onCancel={descartarDraft}
          onSave={() => savePlace(draft)}
        />
      )}

      {wishDraft && (
        <WishSheet
          draft={wishDraft}
          setDraft={setWishDraft}
          saving={savingWish}
          onCancel={descartarWishDraft}
          onSave={saveWish}
        />
      )}

      {newListOpen && (
        <ListSheet
          creating={creatingList}
          onCancel={() => { setNewListOpen(false); setPendingListPick(false); }}
          onCreate={addList}
        />
      )}

      {editingList && (
        <ListSheet
          list={editingList}
          creating={creatingList}
          onCancel={() => setEditingList(null)}
          onCreate={saveListEdits}
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

