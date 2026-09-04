import { useState } from 'react';
import { MAX_PARADAS, type Modo } from '@/routing';

export function useItinerary() {
  const [itineraryOpen, setItineraryOpen] = useState(false);
  const [stopIds, setStopIds] = useState([]);
  const [itineraryMode, setItineraryMode] = useState<Modo>('driving');
  const [optimize, setOptimize] = useState(true);
  const [fromOrigin, setFromOrigin] = useState(false);

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

  return {
    itineraryOpen, setItineraryOpen,
    stopIds, setStopIds,
    itineraryMode, setItineraryMode,
    optimize, setOptimize,
    fromOrigin, setFromOrigin,
    toggleStop, moveStop,
  };
}
