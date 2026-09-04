import { useCallback, useEffect, useRef, useState } from 'react';

export type Posicao = { latitude: number; longitude: number; accuracy: number };

export type EstadoGps = 'off' | 'pedindo' | 'ligado' | 'negado' | 'erro' | 'indisponivel';

const CHAVE = 'mipas-gps';

const OPCOES: PositionOptions = { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 };

function lembrar(ligado: boolean) {
  try {
    if (ligado) localStorage.setItem(CHAVE, '1');
    else localStorage.removeItem(CHAVE);
  } catch (e) {
  }
}

export function useLiveLocation() {
  const [pos, setPos] = useState<Posicao | null>(null);
  const [estado, setEstado] = useState<EstadoGps>('off');
  const watchRef = useRef<number | null>(null);
  const temPosicaoRef = useRef(false);

  const parar = useCallback(() => {
    if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);
    watchRef.current = null;
    temPosicaoRef.current = false;
  }, []);

  const ligar = useCallback(() => {
    if (!navigator.geolocation) { setEstado('indisponivel'); return; }
    if (watchRef.current != null) return;
    setEstado('pedindo');
    watchRef.current = navigator.geolocation.watchPosition(
      p => {
        temPosicaoRef.current = true;
        setPos({ latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy });
        setEstado('ligado');
        lembrar(true);
      },
      err => {
        if (err.code === err.PERMISSION_DENIED) {
          parar();
          setPos(null);
          setEstado('negado');
          lembrar(false);
          return;
        }
        if (!temPosicaoRef.current) setEstado('erro');
      },
      OPCOES,
    );
  }, [parar]);

  const desligar = useCallback(() => {
    parar();
    setPos(null);
    setEstado('off');
    lembrar(false);
  }, [parar]);

  useEffect(() => {
    let ativo = true;
    let lembrado = false;
    try {
      lembrado = localStorage.getItem(CHAVE) === '1';
    } catch (e) {
      lembrado = false;
    }
    if (lembrado && navigator.geolocation) {
      const permissoes = navigator.permissions;
      if (permissoes && permissoes.query) {
        permissoes.query({ name: 'geolocation' as PermissionName })
          .then(p => { if (ativo && p.state === 'granted') ligar(); })
          .catch(() => {  });
      }
    }
    return () => { ativo = false; };
  }, [ligar]);

  useEffect(() => parar, [parar]);

  return { pos, estado, ligar, desligar };
}
