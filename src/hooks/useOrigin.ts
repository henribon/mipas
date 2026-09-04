import { useEffect, useMemo, useState } from 'react';
import { haversineKm } from '@/geocoding';
import { useLiveLocation } from '@/location';

export function useOrigin(home) {
  const gps = useLiveLocation();
  const [origemPref, setOrigemPref] = useState('gps');
  const [originOpen, setOriginOpen] = useState(false);
  const [origemRota, setOrigemRota] = useState(null);

  const origem = useMemo(() => {
    const doGps = gps.pos ? { tipo: 'gps', latitude: gps.pos.latitude, longitude: gps.pos.longitude } : null;
    const daCasa = home ? { tipo: 'home', latitude: home.latitude, longitude: home.longitude } : null;
    return origemPref === 'home' ? (daCasa || doGps) : (doGps || daCasa);
  }, [origemPref, gps.pos, home]);

  useEffect(() => {
    setOrigemRota(anterior => {
      if (!origem) return null;
      const perto = anterior && anterior.tipo === origem.tipo
        && haversineKm(anterior.latitude, anterior.longitude, origem.latitude, origem.longitude) < 0.05;
      return perto ? anterior : origem;
    });
  }, [origem]);

  return { gps, origem, origemRota, origemPref, setOrigemPref, originOpen, setOriginOpen };
}
