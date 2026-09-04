import { useEffect, useMemo, useState } from 'react';
import { debounce, geocodeAddress } from '@/geocoding';

const semAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const semTags = (s) => String(s || '').replace(/<[^>]*>/g, ' ');

export function useSearch({ places, lists, canEdit }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTarget, setSearchTarget] = useState('place');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

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

  const fecharBusca = () => {
    setSearchOpen(false);
    setQuery('');
    setResults([]);
  };

  return {
    searchOpen, setSearchOpen,
    searchTarget, setSearchTarget,
    query, setQuery,
    results, setResults,
    searching, debouncedSearch, matchPlaces, fecharBusca,
  };
}
