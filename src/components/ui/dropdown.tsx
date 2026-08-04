import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export type OpcaoDropdown = { valor: string; rotulo: string };

export function Dropdown({
  valor,
  opcoes,
  onEscolher,
  className = '',
}: {
  valor: string;
  opcoes: OpcaoDropdown[];
  onEscolher: (v: string) => void;
  className?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const atual = opcoes.find(o => o.valor === valor) || opcoes[0];

  useEffect(() => {
    if (!aberto) return;
    const foraOuEsc = (ev: MouseEvent | KeyboardEvent) => {
      if (ev instanceof KeyboardEvent) {
        if (ev.key === 'Escape') setAberto(false);
        return;
      }
      if (raiz.current && !raiz.current.contains(ev.target as Node)) setAberto(false);
    };
    document.addEventListener('mousedown', foraOuEsc);
    document.addEventListener('keydown', foraOuEsc);
    return () => {
      document.removeEventListener('mousedown', foraOuEsc);
      document.removeEventListener('keydown', foraOuEsc);
    };
  }, [aberto]);

  return (
    <div ref={raiz} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setAberto(a => !a)}
        aria-haspopup="listbox"
        aria-expanded={aberto}
        className={cn(
          'inline-flex cursor-pointer items-center gap-2 rounded-3xl border border-line bg-surface',
          'px-3.5 py-1.5 text-[12.5px] font-semibold text-ink shadow-sm transition hover:bg-cream',
        )}
      >
        {atual?.rotulo}
        <span className={cn('text-[10px] text-sub transition-transform', aberto && 'rotate-180')}>▾</span>
      </button>

      {aberto && (
        <div
          role="listbox"
          className={cn(
            'absolute left-0 top-[calc(100%+6px)] z-50 min-w-[150px] overflow-hidden',
            'rounded-xl border border-line bg-surface/95 shadow-2xl backdrop-blur-xl',
          )}
        >
          {opcoes.map(o => (
            <button
              key={o.valor}
              type="button"
              role="option"
              aria-selected={o.valor === valor}
              onClick={() => { onEscolher(o.valor); setAberto(false); }}
              className={cn(
                'block w-full cursor-pointer px-3.5 py-2.5 text-left text-[13px] font-semibold transition',
                o.valor === valor ? 'bg-cream text-coral' : 'text-ink hover:bg-cream',
              )}
            >
              {o.rotulo}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default Dropdown;
