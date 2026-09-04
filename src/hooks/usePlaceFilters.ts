import { useMemo, useState } from 'react';

export function usePlaceFilters(places) {
  const [layersOpen, setLayersOpen] = useState(false);
  const [hiddenListIds, setHiddenListIds] = useState([]);
  const [pickedCategories, setPickedCategories] = useState([]);
  const [minRating, setMinRating] = useState(null);

  const categories = useMemo(() => {
    const nomes = [];
    places.forEach(p => {
      const c = (p.category || '').trim();
      if (c && !nomes.includes(c)) nomes.push(c);
    });
    return nomes.sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [places]);

  const filtrando = hiddenListIds.length > 0 || pickedCategories.length > 0 || minRating != null;

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

  const mostrarSomente = (listId, todasAsListas) => {
    setHiddenListIds(todasAsListas.filter(l => l.id !== listId).map(l => l.id));
    setPickedCategories([]);
    setMinRating(null);
  };

  return {
    layersOpen, setLayersOpen,
    hiddenListIds, setHiddenListIds,
    pickedCategories, setPickedCategories,
    minRating, setMinRating,
    categories, filtrando, visiblePlaces,
    revelarLugar, mostrarSomente,
  };
}
