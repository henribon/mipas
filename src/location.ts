import { useCallback, useEffect, useRef, useState } from 'react';

export type Posicao = { latitude: number; longitude: number; accuracy: number };

/**
 * off        — desligado, nunca pediu
 * pedindo    — esperando o navegador (permissão ou primeiro sinal)
 * ligado     — acompanhando, já tem posição
 * negado     — o usuário recusou a permissão
 * erro       — GPS falhou (sinal, timeout) sem nunca ter dado posição
 * indisponivel — navegador sem geolocalização
 */
export type EstadoGps = 'off' | 'pedindo' | 'ligado' | 'negado' | 'erro' | 'indisponivel';

const CHAVE = 'mipas-gps';

// Alta precisão porque a graça é medir distância de quem está andando na rua;
// maximumAge deixa reaproveitar uma leitura de poucos segundos atrás.
const OPCOES: PositionOptions = { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 };

function lembrar(ligado: boolean) {
  try {
    if (ligado) localStorage.setItem(CHAVE, '1');
    else localStorage.removeItem(CHAVE);
  } catch (e) {
    /* modo privado */
  }
}

/**
 * Posição ao vivo do usuário. Fica desligado até alguém chamar `ligar()`, e
 * volta sozinho na sessão seguinte só se a permissão já estiver concedida —
 * abrir o site nunca deve disparar o pedido de localização por conta própria.
 */
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
        // Falha de sinal ou timeout: o watch continua vivo e pode se recuperar,
        // então só reclama quem ainda não tinha conseguido nenhuma posição.
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
          .catch(() => { /* sem Permissions API dá pra viver sem religar sozinho */ });
      }
    }
    return () => { ativo = false; };
  }, [ligar]);

  useEffect(() => parar, [parar]);

  return { pos, estado, ligar, desligar };
}
