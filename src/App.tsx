import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { SearchBar } from '@/components/ui/search-bar';
import { Dropdown } from '@/components/ui/dropdown';
import { cn } from '@/lib/utils';
import { getTheme, setTheme, initialTheme, listColors } from '@/theme';
import * as data from '@/data';
import * as mapa from '@/map';
import { auth, LoginForm } from '@/auth';
import { debounce, geocodeAddress, haversineKm } from '@/geocoding';
import { errorDetail, isSessionError } from '@/errors';
import { fetchRoutes, fetchItinerary, MAX_PARADAS, type Modo } from '@/routing';
import { useLiveLocation } from '@/location';
import { loadDraft, saveDraft, clearDraft, draftPreenchido } from '@/drafts';
import { SaveSheet, ListSheet, HomeSheet, PlaceCard, ListsPanel, ListDetail, WishPanel, WishSheet, MapLayersPanel, ItineraryPanel, OriginPanel, PlaceHit, HomeButton } from '@/components/mipas';

// Busca sem acento: "acai" tem que achar "Açaí".
const semAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const semTags = (s) => String(s || '').replace(/<[^>]*>/g, ' ');

// A largura decide o layout inteiro (mapa + barra lateral de um lado, telas
// cheias do outro), e ela precisa ser conhecida já no primeiro render.
const MQ_DESKTOP = '(min-width: 720px)';
const telaGrande = () => window.matchMedia(MQ_DESKTOP).matches;

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

  // No celular a tela inicial é a lista, não o mapa: quem abre o Mipas no
  // telefone quer primeiro ver o que tem guardado, e só depois olhar onde
  // fica. No desktop nada muda — lá o mapa e a barra lateral aparecem juntos.
  const [tab, setTab] = useState(() => (telaGrande() ? 'map' : 'lists'));
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
  const [editingList, setEditingList] = useState(null);
  const [homeOpen, setHomeOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(telaGrande);
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [returnListId, setReturnListId] = useState(null);
  const [themeMode, setThemeMode] = useState(() => (document.documentElement.classList.contains('dark') ? 'dark' : 'light'));

  const toggleTheme = () => {
    const next = themeMode === 'dark' ? 'light' : 'dark';
    setTheme(next);
    setThemeMode(next);
  };

  const [routePlaceId, setRoutePlaceId] = useState(null);
  const [route, setRoute] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);

  const [layersOpen, setLayersOpen] = useState(false);
  const [hiddenListIds, setHiddenListIds] = useState([]);
  const [pickedCategories, setPickedCategories] = useState([]);
  const [minRating, setMinRating] = useState(null);

  const gps = useLiveLocation();
  const [origemPref, setOrigemPref] = useState('gps');
  const [originOpen, setOriginOpen] = useState(false);
  const [origemRota, setOrigemRota] = useState(null);

  const [itineraryOpen, setItineraryOpen] = useState(false);
  const [stopIds, setStopIds] = useState([]);
  const [itineraryMode, setItineraryMode] = useState<Modo>('driving');
  const [optimize, setOptimize] = useState(true);
  const [fromOrigin, setFromOrigin] = useState(false);
  const [itinerary, setItinerary] = useState(null);
  const [itineraryLoading, setItineraryLoading] = useState(false);

  const mapRef = useRef(null);
  const leafRef = useRef(null);
  const markersRef = useRef({});
  const routeLayerRef = useRef(null);
  const itineraryLayerRef = useRef(null);
  const meLayerRef = useRef(null);

  const canEdit = !sharedMode && !!session;

  // Fechar a aba sem querer no meio do formulário não pode custar o que já foi
  // digitado: o rascunho fica guardado e volta sozinho no próximo login.
  useEffect(() => {
    if (!canEdit) return;
    setDraft(d => d || loadDraft('place'));
    setWishDraft(d => d || loadDraft('wish'));
  }, [canEdit]);

  useEffect(() => {
    if (draftPreenchido(draft)) saveDraft('place', draft);
    else if (draft) clearDraft('place');
  }, [draft]);

  useEffect(() => {
    if (draftPreenchido(wishDraft)) saveDraft('wish', wishDraft);
    else if (wishDraft) clearDraft('wish');
  }, [wishDraft]);

  const descartarDraft = () => {
    if (draftPreenchido(draft) && !confirm('Descartar o que você preencheu sobre esse lugar?')) return;
    clearDraft('place');
    setDraft(null);
  };

  const descartarWishDraft = () => {
    if (draftPreenchido(wishDraft) && !confirm('Descartar o que você preencheu sobre esse lugar?')) return;
    clearDraft('wish');
    setWishDraft(null);
  };

  // De onde tudo é medido. A posição ao vivo manda; a casa entra quando é ela a
  // escolhida — ou quando o GPS ainda não pegou sinal, pra distância nunca
  // sumir de quem já tinha casa definida.
  const origem = useMemo(() => {
    const doGps = gps.pos ? { tipo: 'gps', latitude: gps.pos.latitude, longitude: gps.pos.longitude } : null;
    const daCasa = home ? { tipo: 'home', latitude: home.latitude, longitude: home.longitude } : null;
    return origemPref === 'home' ? (daCasa || doGps) : (doGps || daCasa);
  }, [origemPref, gps.pos, home]);

  // Andar meio metro não pode virar requisição nova pro roteador: o trajeto só
  // é refeito quando a origem se move mais de 50 m.
  useEffect(() => {
    setOrigemRota(anterior => {
      if (!origem) return null;
      const perto = anterior && anterior.tipo === origem.tipo
        && haversineKm(anterior.latitude, anterior.longitude, origem.latitude, origem.longitude) < 0.05;
      return perto ? anterior : origem;
    });
  }, [origem]);

  const categories = useMemo(() => {
    const nomes = [];
    places.forEach(p => {
      const c = (p.category || '').trim();
      if (c && !nomes.includes(c)) nomes.push(c);
    });
    return nomes.sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [places]);

  const filtrando = hiddenListIds.length > 0 || pickedCategories.length > 0 || minRating != null;

  // Um lugar em várias listas continua no mapa enquanto ALGUMA delas estiver
  // visível — esconder uma lista nunca some com o que também está em outra.
  const cabeNoFiltro = (p) => {
    const listasDoLugar = p.list_ids || [];
    if (listasDoLugar.length > 0 && listasDoLugar.every(id => hiddenListIds.includes(id))) return false;
    if (pickedCategories.length > 0 && !pickedCategories.includes((p.category || '').trim())) return false;
    if (minRating != null && !(p.rating != null && Number(p.rating) >= minRating)) return false;
    return true;
  };

  const visiblePlaces = useMemo(
    () => places.filter(cabeNoFiltro),
    [places, hiddenListIds, pickedCategories, minRating],
  );

  const revelarLugar = (p) => {
    setHiddenListIds(ids => ids.filter(id => !(p.list_ids || []).includes(id)));
    setPickedCategories(cs => (cs.length && !cs.includes((p.category || '').trim()) ? [] : cs));
    setMinRating(r => (r != null && !(p.rating != null && Number(p.rating) >= r) ? null : r));
  };

  const toggleStop = (id) => setStopIds(ids => (
    ids.includes(id) ? ids.filter(x => x !== id) : (ids.length >= MAX_PARADAS ? ids : [...ids, id])
  ));

  const moveStop = (id, passo) => setStopIds(ids => {
    const i = ids.indexOf(id);
    const destino = i + passo;
    if (i < 0 || destino < 0 || destino >= ids.length) return ids;
    const novo = [...ids];
    novo.splice(destino, 0, novo.splice(i, 1)[0]);
    return novo;
  });

  const abrirRoteiro = () => {
    setItineraryOpen(true);
    setLayersOpen(false);
    setRoutePlaceId(null);
    setSelId(null);
  };

  // Roteiro a partir de uma lista: o mapa passa a mostrar só ela, e as paradas
  // saem daí — o painel escolhe entre o que está visível.
  const montarRoteiroDaLista = (list) => {
    setHiddenListIds(lists.filter(l => l.id !== list.id).map(l => l.id));
    setPickedCategories([]);
    setMinRating(null);
    setStopIds([]);
    setOpenListId(null);
    setTab('map');
    abrirRoteiro();
    setTimeout(() => leafRef.current && leafRef.current.invalidateSize(), 60);
  };

  const offsetRoteiro = (itineraryOpen && fromOrigin && origemRota) ? 1 : 0;

  // Com a ordem otimizada, quem manda na numeração é o que o roteador devolveu;
  // sem roteiro traçado ainda, vale a ordem em que as paradas foram escolhidas.
  const stopIdsEmOrdem = useMemo(() => {
    if (!itinerary || itinerary.order.length !== stopIds.length + offsetRoteiro) return stopIds;
    return itinerary.order.filter(i => i >= offsetRoteiro).map(i => stopIds[i - offsetRoteiro]);
  }, [itinerary, stopIds, offsetRoteiro]);

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
        // Lista marcada como oculta comeca fora do mapa. E so o ponto de
        // partida: o painel de Camadas continua podendo revelar na sessao.
        // Link direto e excecao — quem abriu a lista pelo link quer ve-la.
        if (!sharedMode) {
          const campo = canEdit ? 'hidden_for_owner' : 'hidden_for_visitor';
          // O cast existe só pro TypeScript: o parser de tipos do supabase-js
          // desiste de inferir a linha do select depois que ela ficou longa.
          setHiddenListIds((ls as any[]).filter(l => l[campo]).map(l => l.id));
        }
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

  useEffect(() => {
    const m = mapa.initMap(mapRef.current);
    leafRef.current = m;
    m.on('click', () => { setSelId(null); setReturnListId(null); });
    setTimeout(() => m.invalidateSize(), 300);
    return () => m.remove();
  }, []);

  useEffect(() => {
    const mq = window.matchMedia(MQ_DESKTOP);
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
    mapa.syncMarkers(m, markersRef, visiblePlaces, lists, (p) => {
      // Montando roteiro, tocar no pin é escolher a parada — o card do lugar
      // sairia na frente do painel e roubaria o gesto.
      if (itineraryOpen) { toggleStop(p.id); return; }
      setSelId(p.id);
      setTab('map');
      setOpenListId(null);
      setReturnListId(null);
      m.flyTo([p.latitude, p.longitude], Math.max(m.getZoom(), 14), { duration: .6 });
    });
  }, [visiblePlaces, lists, itineraryOpen]);

  // O mapa abria sempre no mesmo ponto fixo de São Paulo, num zoom que
  // amontoava os pins num canto (ou deixava tudo fora da tela). Na primeira
  // carga ele passa a enquadrar os seus lugares. Uma vez só: depois disso a
  // câmera é sua, e mexer nela sozinho no meio do uso seria pior que o zoom fixo.
  const enquadrouAoAbrir = useRef(false);
  useEffect(() => {
    const m = leafRef.current;
    if (!m || enquadrouAoAbrir.current) return;
    // Lista aberta por link compartilhado já tem quem a enquadre.
    if (openListId) return;
    const doMiolo = mapa.semExtremos(visiblePlaces);
    if (doMiolo.length === 0) return;
    enquadrouAoAbrir.current = true;
    mapa.fitPlaces(m, doMiolo);
  }, [visiblePlaces, openListId]);

  // Abrir uma lista no desktop enquadra a lista inteira: a câmera vai pro meio
  // dos lugares e abre o zoom até todos caberem. Só no desktop porque no
  // celular a lista ocupa a tela e o mapa nem está à vista.
  //
  // O ref evita reenquadrar a cada mudança em places: quem está mexendo na
  // lista aberta (guardando foto, editando lugar) não pode ver a câmera pular.
  // Enquadra uma vez por lista aberta, e de novo se a lista for reaberta.
  const listaEnquadrada = useRef(null);
  useEffect(() => {
    const m = leafRef.current;
    if (!m || !isDesktop || !openListId) {
      listaEnquadrada.current = null;
      return;
    }
    if (listaEnquadrada.current === openListId) return;
    const daLista = visiblePlaces.filter(p => (p.list_ids || []).includes(openListId));
    // Lista ainda carregando (ou toda escondida por filtro): tenta de novo
    // quando os lugares chegarem, em vez de marcar como enquadrada.
    if (daLista.length === 0) return;
    listaEnquadrada.current = openListId;
    mapa.fitPlaces(m, daLista, selId ? 240 : 60);
  }, [openListId, isDesktop, visiblePlaces]);

  // Filtrar até esconder o lugar aberto deixaria um card solto na tela, sem pin.
  useEffect(() => {
    if (selId && !visiblePlaces.some(p => p.id === selId)) setSelId(null);
  }, [visiblePlaces, selId]);

  // Parada que sumiu do mapa (ou do banco) não pode continuar contando no roteiro.
  useEffect(() => {
    setStopIds(ids => {
      const validos = ids.filter(id => visiblePlaces.some(p => p.id === id));
      return validos.length === ids.length ? ids : validos;
    });
  }, [visiblePlaces]);

  useEffect(() => {
    if (!sharedMode || places.length === 0) return;
    const m = leafRef.current;
    if (!m) return;
    const first = places[0];
    setTimeout(() => m.flyTo([first.latitude, first.longitude], 13, { duration: .6 }), 200);
  }, [sharedMode, places]);

  // Trocar de lugar (ou fechar o card) descarta o caminho traçado, senão ele
  // ficaria no mapa apontando pra um lugar que não está mais aberto.
  useEffect(() => { setRoutePlaceId(null); }, [selId]);

  useEffect(() => {
    const m = leafRef.current;
    if (!m) return;
    mapa.clearRoute(routeLayerRef);
    setRoute(null);
    const place = places.find(p => p.id === routePlaceId);
    if (!place || !origemRota) return;
    let cancelado = false;
    setRouteLoading(true);
    fetchRoutes([origemRota.latitude, origemRota.longitude], [place.latitude, place.longitude])
      .then(r => {
        if (cancelado || !leafRef.current) return;
        setRoute(r);
        mapa.drawRoute(leafRef.current, routeLayerRef, r, 240, origemRota.tipo);
      })
      .catch(e => { if (!cancelado) fail('Não deu pra traçar o caminho até esse lugar', e); })
      .finally(() => { if (!cancelado) setRouteLoading(false); });
    return () => { cancelado = true; };
  }, [routePlaceId, origemRota]);

  useEffect(() => {
    if (leafRef.current) mapa.syncMe(leafRef.current, meLayerRef, gps.pos);
  }, [gps.pos]);

  // O roteiro se redesenha sozinho a cada mudança, mas com uma pausa antes de
  // sair pedindo: o Valhalla público é de cortesia e marcar cinco paradas
  // seguidas não pode virar cinco requisições.
  useEffect(() => {
    const m = leafRef.current;
    if (!m) return;
    mapa.clearRoute(itineraryLayerRef);
    setItinerary(null);
    if (!itineraryOpen) return;

    const paradas = stopIds.map(id => places.find(p => p.id === id)).filter(Boolean);
    const pontos: [number, number][] = [
      ...(fromOrigin && origemRota ? [[origemRota.latitude, origemRota.longitude] as [number, number]] : []),
      ...paradas.map(p => [p.latitude, p.longitude] as [number, number]),
    ];
    if (pontos.length < 2) { setItineraryLoading(false); return; }

    let cancelado = false;
    setItineraryLoading(true);
    const espera = setTimeout(() => {
      fetchItinerary(pontos, itineraryMode, optimize)
        .then(r => {
          if (cancelado || !leafRef.current) return;
          setItinerary(r);
          mapa.drawItinerary(leafRef.current, itineraryLayerRef, r, isDesktop ? 40 : 300);
        })
        .catch(e => { if (!cancelado) fail('Não deu pra montar o roteiro', e); })
        .finally(() => { if (!cancelado) setItineraryLoading(false); });
    }, 700);

    return () => { cancelado = true; clearTimeout(espera); };
  }, [itineraryOpen, stopIds, itineraryMode, optimize, fromOrigin, origemRota, places]);

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

  // Endereço novo só interessa a quem pode guardar; quem abriu por link busca
  // dentro da lista e não precisa acordar o Nominatim.
  useEffect(() => {
    if (canEdit) debouncedSearch(query);
    else setResults([]);
  }, [query, canEdit]);

  const matchPlaces = useMemo(() => {
    const termo = semAcento(query).trim();
    if (!termo) return [];
    return places.filter(p => {
      const listas = (p.list_ids || []).map(id => lists.find(l => l.id === id)?.name || '').join(' ');
      const alvo = semAcento([p.name, p.address, p.category, semTags(p.description), listas].join(' '));
      return termo.split(/\s+/).every(palavra => alvo.includes(palavra));
    }).slice(0, 12);
  }, [query, places, lists]);

  // Todo alerta de erro passa por aqui: o motivo real vai junto (antes a tela
  // só chutava "você está logado?", que escondia qualquer outra causa), e
  // quando o problema é sessão vencida o login volta a ser oferecido.
  const fail = (acao, e) => {
    console.error(`[Mipas] ${acao}:`, e);
    const semSessao = isSessionError(e);
    alert(`${acao}.\n\nMotivo: ${errorDetail(e)}`
      + (semSessao ? '\n\nParece que sua sessão expirou — entre de novo e tente outra vez.' : ''));
    if (!semSessao) return;
    auth.getSession().then(s => {
      setSession(s);
      if (!s) setLoginOpen(true);
    });
  };

  // O invalidateSize é o de sempre: o Leaflet remede o container depois
  // que ele volta a aparecer.
  const showMap = () => {
    setTab('map');
    setOpenListId(null);
    setTimeout(() => leafRef.current && leafRef.current.invalidateSize(), 60);
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
    setTimeout(() => {
      leafRef.current.invalidateSize();
      leafRef.current.flyTo([p.latitude, p.longitude], 15, { duration: .8 });
    }, 60);
  };

  const abrirLugarDaBusca = (p) => {
    revelarLugar(p);
    setSearchOpen(false);
    setQuery('');
    setResults([]);
    goToPlace(p);
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
          fail('O lugar foi guardado, mas não deu pra enviar as fotos', err);
        }
      }
      setPlaces(ps => [...ps, comFotos]);
      // Guardar um lugar e ele não aparecer por causa de um filtro ligado antes
      // pareceria erro — o que acabou de ser criado sempre volta pro mapa.
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
      setSearchOpen(false);
      setQuery('');
      setResults([]);
      setTab('map');
      setTimeout(() => {
        leafRef.current.flyTo([created.latitude, created.longitude], 15, { duration: .9 });
        // No celular a lista aberta cobre o mapa inteiro: o cartão do lugar
        // apareceria flutuando por cima dela, sem mapa nenhum atrás.
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

  // A cor vem do menu do botão direito, onde a graça é ver a mudança na hora:
  // pinta primeiro, e só desfaz se o banco recusar.
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

  // As duas visibilidades sao independentes: uma vale pro mapa do dono, a outra
  // pro mapa de quem visita o site. Pinta primeiro e desfaz se o banco recusar.
  const toggleListHidden = async (list, campo) => {
    const valor = !list[campo];
    const antes = lists;
    setLists(ls => ls.map(l => (l.id === list.id ? { ...l, [campo]: valor } : l)));
    // Só mexe no mapa que estou vendo agora se for o campo do meu ponto de vista.
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

  // Comandos do botão direito numa lista. Montados aqui porque quem sabe fazer
  // as coisas é o App; o menu lá embaixo só desenha o que receber.
  const menuDaLista = (l) => [
    openListId !== l.id && { rotulo: 'Abrir lista', onClick: () => setOpenListId(l.id) },
    { rotulo: 'Editar lista…', onClick: () => setEditingList(l) },
    // Listas antigas podem ter cor fora da paleta; sem ela na fila, nenhuma
    // bolinha apareceria marcada e a cor atual sumiria ao trocar sem querer.
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

  // Excluir a lista leva junto os lugares que só existiam nela — quem também
  // está em outra lista continua lá. O aviso diz quantos vão sumir antes de
  // qualquer coisa acontecer, porque isso aqui não tem desfazer.
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

  // Cadastro que começa dentro da lista: a folha abre já marcada nela e sem
  // endereço — quem escolhe o endereço (e o pin) é a busca de dentro da folha.
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
      setSearchOpen(false);
      setQuery('');
      setResults([]);
    } catch (e) {
      fail('Não deu pra guardar esse desejo', e);
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
      fail('Não deu pra tirar esse lugar do Quero ir', e);
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
      // O banco já zera o cover_photo_id nesse caso (on delete set null); aqui
      // é só não deixar o estado local apontando pra uma foto que não existe.
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

  // No celular as listas cobrem o mapa inteiro; painel flutuando por cima delas
  // seria painel sobre o que ele nem controla.
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
        {/* Fora dos painéis de propósito: assim a saída pro bonbap continua
            no lugar quando a barra troca de conteúdo (listas, quero ir, lista
            aberta). No celular ela vive no topo da tela de listas. */}
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

