import { useEffect, useMemo, useState } from 'react';

// "Comida de boteco" and "Comida de Boteco" are the same category for filtering.
const categoryKey = (c) => (c || '').trim().toLocaleLowerCase('pt-BR');

export function usePlaceFilters(places) {
  const [layersOpen, setLayersOpen] = useState(false);
  const [hiddenListIds, setHiddenListIds] = useState([]);
  const [pickedCategory, setPickedCategory] = useState(null);
  const [minRating, setMinRating] = useState(null);

  // One option per category key, shown with the first spelling found.
  const categories = useMemo(() => {
    const porChave = new Map();
    places.forEach(p => {
      const nome = (p.category || '').trim();
      const chave = categoryKey(nome);
      if (chave && !porChave.has(chave)) porChave.set(chave, nome);
    });
    return [...porChave]
      .map(([valor, rotulo]) => ({ valor, rotulo }))
      .sort((a, b) => a.rotulo.localeCompare(b.rotulo, 'pt-BR'));
  }, [places]);

  // A category whose last place was deleted or renamed would keep filtering with no option to undo it.
  useEffect(() => {
    if (pickedCategory != null && !categories.some(c => c.valor === pickedCategory)) setPickedCategory(null);
  }, [categories, pickedCategory]);

  const filtrando = hiddenListIds.length > 0 || pickedCategory != null || minRating != null;

  const cabeNoFiltro = (p) => {
    const listasDoLugar = p.list_ids || [];
    if (listasDoLugar.length > 0 && listasDoLugar.every(id => hiddenListIds.includes(id))) return false;
    if (pickedCategory != null && categoryKey(p.category) !== pickedCategory) return false;
    if (minRating != null && !(p.rating != null && Number(p.rating) >= minRating)) return false;
    return true;
  };

  const visiblePlaces = useMemo(
    () => places.filter(cabeNoFiltro),
    [places, hiddenListIds, pickedCategory, minRating],
  );

  const revelarLugar = (p) => {
    setHiddenListIds(ids => ids.filter(id => !(p.list_ids || []).includes(id)));
    setPickedCategory(c => (c != null && c !== categoryKey(p.category) ? null : c));
    setMinRating(r => (r != null && !(p.rating != null && Number(p.rating) >= r) ? null : r));
  };

  const mostrarSomente = (listId, todasAsListas) => {
    setHiddenListIds(todasAsListas.filter(l => l.id !== listId).map(l => l.id));
    setPickedCategory(null);
    setMinRating(null);
  };

  return {
    layersOpen, setLayersOpen,
    hiddenListIds, setHiddenListIds,
    pickedCategory, setPickedCategory,
    minRating, setMinRating,
    categories, filtrando, visiblePlaces,
    revelarLugar, mostrarSomente,
  };
}
