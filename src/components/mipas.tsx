import React, { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom';
import { getTheme, listColors } from '@/theme';
import { haversineKm, shortAddress, debounce, geocodeAddress } from '@/geocoding';
import { formatKm, formatMinutes } from '@/routing';
import { ROUTE_COLORS, coverPhoto } from '@/map';
import * as data from '@/data';
import { Button } from '@/components/ui/button';
import { AddButton } from '@/components/ui/add-button';
import VerticalthumbsSlider from '@/components/ui/vertical-thumbnail-slider';
import { WindowCard } from '@/components/ui/window-card';
import { cn } from '@/lib/utils';

function gradientForPlace(place, list) {
  const color = list ? list.color : '#FF5C38';
  return `linear-gradient(135deg, ${color}33, ${color}0D)`;
}

const RICH_ALLOWED = { B: 1, STRONG: 1, I: 1, EM: 1, U: 1, BR: 1, DIV: 1, P: 1, SPAN: 1, FONT: 1 };
const RICH_DROP = { SCRIPT: 1, STYLE: 1, IFRAME: 1, OBJECT: 1, EMBED: 1, TEMPLATE: 1, NOSCRIPT: 1 };
const RICH_FONT_SIZE = { 1: '12px', 2: '13px', 3: '14px', 4: '15px', 5: '17px', 6: '19px', 7: '20px' };
const RICH_MAX_PX = 20;
const RICH_SIZES = [12, 13, 14, 15, 16, 17, 18, 19, 20];
const RICH_FONTS = [
  { nome: 'Padrão', css: 'Inter, sans-serif' },
  { nome: 'Serifa', css: 'Georgia, serif' },
  { nome: 'Monoespaçada', css: '"Courier New", monospace' },
  { nome: 'Manuscrita', css: '"Comic Sans MS", cursive' },
];
const normalizaFonte = (v) => String(v || '').replace(/["']/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

export const sanitizeRichHtml = function (html) {
  if (!html) return '';
  const doc = new DOMParser().parseFromString('<div id="raiz"></div>', 'text/html');
  const root = doc.getElementById('raiz');
  root.innerHTML = html;

  const limpa = (pai) => {
    Array.from(pai.childNodes).forEach(no => {
      if (no.nodeType === 3) return;
      if (no.nodeType !== 1) { no.remove(); return; }

      if (RICH_DROP[no.tagName]) { no.remove(); return; }
      if (!RICH_ALLOWED[no.tagName]) {
        while (no.firstChild) pai.insertBefore(no.firstChild, no);
        no.remove();
        return;
      }

      let el = no;
      if (no.tagName === 'FONT') {
        const css = RICH_FONT_SIZE[no.getAttribute('size')];
        const span = doc.createElement('span');
        while (no.firstChild) span.appendChild(no.firstChild);
        no.replaceWith(span);
        el = span;
        if (css) el.setAttribute('data-size', css);
      }

      let tamanho = '';
      let fonte = '';
      if (el.tagName === 'SPAN') {
        tamanho = el.getAttribute('data-size') || (el.style && el.style.fontSize) || '';
        fonte = (el.style && el.style.fontFamily) || '';
      }
      Array.from(el.attributes).forEach(a => el.removeAttribute(a.name));

      const px = /^(\d+(?:\.\d+)?)px$/.exec(tamanho);
      if (px) el.style.fontSize = Math.min(parseFloat(px[1]), RICH_MAX_PX) + 'px';
      else if (/^[0-9.]+em$/.test(tamanho)) el.style.fontSize = tamanho;

      const permitida = RICH_FONTS.find(f => normalizaFonte(f.css) === normalizaFonte(fonte));
      if (permitida) el.style.fontFamily = permitida.css;

      limpa(el);
    });
  };
  limpa(root);
  return root.innerHTML;
};

function RichText({ html, style }) {
  const temTag = /<[a-z][\s\S]*>/i.test(html || '');
  if (!temTag) return <div style={{ whiteSpace: 'pre-wrap', ...style }}>{html}</div>;
  return <div style={style} dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(html) }} />;
}

function RichTextEditor({ value, onChange, placeholder, minHeight }) {
  const C = getTheme();
  const ref = useRef(null);
  const [vazio, setVazio] = React.useState(!value);

  useEffect(() => { if (ref.current) ref.current.innerHTML = value || ''; }, []);

  const cmd = (comando, arg) => {
    document.execCommand(comando, false, arg);
    if (ref.current) { ref.current.focus(); emitir(); }
  };

  const aplicarEstilo = (prop, valor) => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || sel.isCollapsed) return;
    const range = sel.getRangeAt(0);
    if (!ref.current || !ref.current.contains(range.commonAncestorContainer)) return;
    const span = document.createElement('span');
    span.style[prop] = valor;
    try {
      span.appendChild(range.extractContents());
      range.insertNode(span);
      const novo = document.createRange();
      novo.selectNodeContents(span);
      sel.removeAllRanges();
      sel.addRange(novo);
    } catch (e) {
      return;
    }
    emitir();
  };
  const emitir = () => {
    if (!ref.current) return;
    const html = ref.current.innerHTML;
    setVazio(!ref.current.textContent.trim() && !/<img/i.test(html));
    onChange(sanitizeRichHtml(html));
  };

  const botao = (rotulo, aoClicar, estilo) => (
    <Button type="button" onMouseDown={ev => ev.preventDefault()} onClick={aoClicar} className="rounded-3xl font-semibold cursor-pointer transition inline-flex items-center justify-center gap-1.5 border-none bg-cream text-sub hover:text-ink shadow-none w-7 h-7 p-0 !rounded-lg text-[13px]">{rotulo}</Button>
  );

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
        {botao('B', () => cmd('bold'), { fontWeight: 800 })}
        {botao('I', () => cmd('italic'), { fontStyle: 'italic', fontFamily: 'Georgia, serif' })}
        {botao('U', () => cmd('underline'), { textDecoration: 'underline' })}
        <select onMouseDown={ev => ev.stopPropagation()} value=""
          onChange={ev => { const v = ev.target.value; ev.target.value = ''; if (v) aplicarEstilo('fontSize', v + 'px'); }}
          title={`Tamanho do texto (máximo ${RICH_MAX_PX}px)`}
          style={{ border: `1px solid ${C.line}`, background: C.cream, color: C.sub, borderRadius: 8, height: 28, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
          <option value="">Tamanho</option>
          {RICH_SIZES.map(s => <option key={s} value={s}>{s} px</option>)}
        </select>
        <select onMouseDown={ev => ev.stopPropagation()} value=""
          onChange={ev => { const v = ev.target.value; ev.target.value = ''; if (v) aplicarEstilo('fontFamily', v); }}
          title="Fonte"
          style={{ border: `1px solid ${C.line}`, background: C.cream, color: C.sub, borderRadius: 8, height: 28, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
          <option value="">Fonte</option>
          {RICH_FONTS.map(f => <option key={f.nome} value={f.css}>{f.nome}</option>)}
        </select>
      </div>
      <div style={{ position: 'relative' }}>
        <div ref={ref} contentEditable suppressContentEditableWarning
          onInput={emitir} onBlur={emitir}
          style={{
            width: '100%', boxSizing: 'border-box', background: C.surface, border: `1.5px solid ${C.line}`,
            borderRadius: 12, padding: '12px 16px', fontSize: 14, fontWeight: 500, color: C.ink,
            minHeight: minHeight || 76, outline: 'none', lineHeight: 1.5, overflowWrap: 'anywhere',
          }} />
        {vazio && (
          <div style={{ position: 'absolute', top: 12, left: 16, color: C.sub, fontSize: 14, fontWeight: 500, pointerEvents: 'none' }}>
            {placeholder}
          </div>
        )}
      </div>
    </div>
  );
}

function Btn({ children, onClick, primary, style, disabled, icon, tooltip, className }) {
  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      icon={icon}
      tooltip={tooltip}
      variant={primary ? 'primary' : 'secondary'}
      className={cn('px-6 py-3.5 text-[15px]', className)}
      style={style}
    >
      {children}
    </Button>
  );
}

const temArquivo = (ev) => Array.from(ev.dataTransfer?.types || []).includes('Files');
const imagensSoltas = (ev): File[] => (ev.dataTransfer ? Array.from<File>(ev.dataTransfer.files) : [])
  .filter(f => f.type.startsWith('image/'));

function useFileDrop(onFiles, ativo = true): [boolean, any] {
  const [sobre, setSobre] = useState(false);
  const profundidade = useRef(0);

  useEffect(() => {
    const impedir = (ev) => { if (temArquivo(ev)) ev.preventDefault(); };
    window.addEventListener('dragover', impedir);
    window.addEventListener('drop', impedir);
    return () => {
      window.removeEventListener('dragover', impedir);
      window.removeEventListener('drop', impedir);
    };
  }, []);

  if (!ativo) return [false, {}];

  return [sobre, {
    onDragEnter: (ev) => {
      if (!temArquivo(ev)) return;
      ev.preventDefault();
      ev.stopPropagation();
      profundidade.current += 1;
      setSobre(true);
    },
    onDragOver: (ev) => {
      if (!temArquivo(ev)) return;
      ev.preventDefault();
      ev.stopPropagation();
      ev.dataTransfer.dropEffect = 'copy';
    },
    onDragLeave: (ev) => {
      if (!temArquivo(ev)) return;
      profundidade.current = Math.max(0, profundidade.current - 1);
      if (profundidade.current === 0) setSobre(false);
    },
    onDrop: (ev) => {
      if (!temArquivo(ev)) return;
      ev.preventDefault();
      ev.stopPropagation();
      profundidade.current = 0;
      setSobre(false);
      const arquivos = imagensSoltas(ev);
      if (arquivos.length) onFiles(arquivos);
    },
  }];
}

function DraftPhotos({ photos, onChange }) {
  const C = getTheme();
  const inputRef = useRef(null);

  const adicionar = (arquivos) => {
    if (!arquivos.length) return;
    onChange([...photos, ...arquivos.map(file => ({ file, preview: URL.createObjectURL(file), title: '' }))]);
  };
  const escolher = (ev) => {
    adicionar(Array.from(ev.target.files || []));
    ev.target.value = '';
  };
  const [sobre, dropProps] = useFileDrop(adicionar);
  const remover = (i) => {
    URL.revokeObjectURL(photos[i].preview);
    onChange(photos.filter((_, idx) => idx !== i));
  };
  const renomear = (i, title) => onChange(photos.map((p, idx) => (idx === i ? { ...p, title } : p)));

  return (
    <div {...dropProps} style={{
      display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 7, alignItems: 'flex-start',
      borderRadius: 12, transition: 'outline-color .15s, background .15s',
      outline: `2px dashed ${sobre ? C.coral : 'transparent'}`, outlineOffset: 6,
      background: sobre ? C.coral + '14' : 'transparent',
    }}>
      {photos.map((p, i) => (
        <div key={i} style={{ width: 96, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ position: 'relative', height: 72, borderRadius: 10, overflow: 'hidden', border: `1px solid ${C.line}` }}>
            <img src={p.preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            <button type="button" onClick={() => remover(i)} style={{ position: 'absolute', top: 3, right: 3, width: 20, height: 20, borderRadius: 99, border: 'none', background: 'rgba(0,0,0,.6)', color: '#fff', fontSize: 11, cursor: 'pointer', lineHeight: '20px', padding: 0 }}>✕</button>
          </div>
          <input value={p.title} onChange={e => renomear(i, e.target.value)} placeholder="Título"
            style={{ width: '100%', boxSizing: 'border-box', background: C.cream, border: `1px solid ${C.line}`, borderRadius: 8, padding: '4px 8px', fontSize: 11.5, fontWeight: 600, color: C.ink }} />
        </div>
      ))}
      <Button type="button" onClick={() => inputRef.current.click()} title="Clique pra escolher ou arraste fotos pra cá"
        className="rounded-3xl font-semibold cursor-pointer transition inline-flex items-center justify-center gap-1.5 border-none bg-surface text-coral border border-line shadow-sm hover:bg-cream px-4 py-2 text-[12px] border-dashed w-full !py-3">
        {sobre ? 'Solte as fotos aqui' : '+'}
      </Button>
      <input ref={inputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={escolher} />
    </div>
  );
}

function ListPicker({ lists, selecionadas, onAlternar, onNewList, compacto, inline }) {
  const C = getTheme();
  const [busca, setBusca] = useState('');
  const termo = busca.trim().toLowerCase();
  const filtradas = termo ? lists.filter(l => l.name.toLowerCase().includes(termo)) : lists;
  return (
    <div style={{ marginTop: 8 }}>
      {selecionadas.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {selecionadas.map(id => {
            const l = lists.find(x => x.id === id);
            if (!l) return null;
            return (
              <Button key={id} onClick={() => onAlternar(id)} title="Tirar desta lista" className="rounded-3xl font-semibold cursor-pointer transition inline-flex items-center justify-center gap-1.5 border-none px-2.5 py-1 text-[12px] shadow-none">{l.emoji} {l.name} <span style={{ opacity: .7 }}>✕</span></Button>
            );
          })}
        </div>
      )}
      {lists.length > 6 && (
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar lista…" style={{
          width: '100%', boxSizing: 'border-box', marginBottom: 6, background: C.surface,
          border: `1px solid ${C.line}`, borderRadius: 10, padding: '8px 12px', fontSize: 13, fontWeight: 600, color: C.ink,
        }} />
      )}
      <div style={{
        ...(inline ? null : { maxHeight: compacto ? 132 : 176, overflowY: 'auto' }),
        border: `1px solid ${C.line}`, borderRadius: 12, background: C.surface,
      }}>
        {filtradas.map(l => {
          const marcada = selecionadas.includes(l.id);
          return (
            <label key={l.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', cursor: 'pointer',
              borderBottom: `1px solid ${C.line}`, background: marcada ? l.color + '14' : 'transparent',
            }}>
              <input type="checkbox" checked={marcada} onChange={() => onAlternar(l.id)} style={{ accentColor: C.coral, width: 15, height: 15, cursor: 'pointer' }} />
              <span style={{ fontSize: 15 }}>{l.emoji}</span>
              <span style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 13.5, color: C.ink }}>{l.name}</span>
            </label>
          );
        })}
        {filtradas.length === 0 && (
          <div style={{ padding: '12px', fontSize: 13, fontWeight: 600, color: C.sub, textAlign: 'center' }}>Nenhuma lista com esse nome</div>
        )}
      </div>
      {onNewList && (
        <Button onClick={onNewList} className="rounded-3xl font-semibold cursor-pointer transition inline-flex items-center justify-center gap-1.5 border-none bg-surface text-coral border border-line shadow-sm hover:bg-cream px-4 py-2 text-[12px] w-full !py-4 !text-[15px] border-dashed">+ Nova lista</Button>
      )}
    </div>
  );
}

function AddressPicker({ onPick, autoFocus }) {
  const C = getTheme();
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

  const buscar = (v) => { setQuery(v); debouncedSearch(v); };

  return (
    <div>
      <input autoFocus={autoFocus} value={query} onChange={e => buscar(e.target.value)} placeholder="Rua, praça, avenida…"
        style={{ width: '100%', boxSizing: 'border-box', marginTop: 7, background: C.surface, border: `1.5px solid ${C.line}`, borderRadius: 12, padding: '13px 16px', fontSize: 15, fontWeight: 600, color: C.ink }} />
      {searching && <div style={{ textAlign: 'center', marginTop: 12, color: C.sub, fontWeight: 600, fontSize: 13 }}>Buscando…</div>}
      {!searching && query.trim() && results.length === 0 && (
        <div style={{ textAlign: 'center', marginTop: 12, color: C.sub, fontWeight: 600, fontSize: 13 }}>Nada por aqui... tenta outro endereço</div>
      )}
      {results.map((r, i) => (
        <div key={i} onClick={() => onPick(r)}
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 4px', borderBottom: `1px solid ${C.line}`, cursor: 'pointer' }}>
          <svg width="12" height="16" viewBox="0 0 12 16" style={{ flexShrink: 0 }}>
            <path d="M6 15.5C6 15.5 11 9.7 11 5.7C11 2.9 8.8 1 6 1C3.2 1 1 2.9 1 5.7C1 9.7 6 15.5 6 15.5Z" fill="none" stroke={C.coral} strokeWidth="1.4" />
            <circle cx="6" cy="5.6" r="1.8" fill={C.coral} />
          </svg>
          <span style={{ fontSize: 14, fontWeight: 600, color: C.ink, lineHeight: 1.35 }}>{r.address}</span>
        </div>
      ))}
    </div>
  );
}

function ContextMenu({ x, y, itens, onClose }) {
  const C = getTheme();
  const ref = useRef(null);
  const [pos, setPos] = useState({ left: x, top: y, pronto: false });
  const [submenu, setSubmenu] = useState(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({
      left: Math.max(8, Math.min(x, window.innerWidth - r.width - 8)),
      top: Math.max(8, Math.min(y, window.innerHeight - r.height - 8)),
      pronto: true,
    });
  }, [x, y]);

  useEffect(() => {
    const fechar = () => onClose();
    const naTecla = (ev) => { if (ev.key === 'Escape') onClose(); };
    const tique = setTimeout(() => {
      window.addEventListener('pointerdown', fechar);
      window.addEventListener('contextmenu', fechar);
      window.addEventListener('resize', fechar);
      window.addEventListener('scroll', fechar, true);
      window.addEventListener('keydown', naTecla);
    }, 0);
    return () => {
      clearTimeout(tique);
      window.removeEventListener('pointerdown', fechar);
      window.removeEventListener('contextmenu', fechar);
      window.removeEventListener('resize', fechar);
      window.removeEventListener('scroll', fechar, true);
      window.removeEventListener('keydown', naTecla);
    };
  }, [onClose]);

  const estiloItem = {
    width: '100%', boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 8,
    background: 'transparent', border: 'none', borderRadius: 8, padding: '8px 10px',
    fontFamily: 'inherit', fontSize: 13, fontWeight: 600, color: C.ink,
    cursor: 'pointer', textAlign: 'left',
  } as React.CSSProperties;
  const realce = (ev, ligado) => { ev.currentTarget.style.background = ligado ? C.cream : 'transparent'; };

  const paraEsquerda = pos.left > window.innerWidth - 400;

  return ReactDOM.createPortal(
    <div ref={ref}
      onPointerDown={ev => ev.stopPropagation()}
      onContextMenu={ev => { ev.preventDefault(); ev.stopPropagation(); }}
      style={{
        position: 'fixed', left: pos.left, top: pos.top, zIndex: 4000, minWidth: 196,
        visibility: pos.pronto ? 'visible' : 'hidden', background: C.surface,
        border: `1px solid ${C.line}`, borderRadius: 12, padding: 5,
        boxShadow: '0 18px 45px rgba(0,0,0,.45)', animation: 'fadeIn .12s',
      }}>
      {itens.filter(Boolean).map((it, i) => (
        <React.Fragment key={i}>
          {it.separadorAntes && <div style={{ height: 1, background: C.line, margin: '5px 6px' }} />}
          {it.cores ? (
            <div style={{ position: 'relative' }} onMouseEnter={() => setSubmenu(i)}>
              <button type="button"
                onClick={ev => { ev.stopPropagation(); setSubmenu(submenu === i ? null : i); }}
                onMouseEnter={ev => realce(ev, true)} onMouseLeave={ev => realce(ev, false)}
                style={estiloItem}>
                <span style={{ width: 12, height: 12, borderRadius: 99, background: it.cores.atual, flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{it.rotulo}</span>
                <span style={{ opacity: .5, fontSize: 15, lineHeight: 1 }}>{paraEsquerda ? '\u2039' : '\u203A'}</span>
              </button>
              {submenu === i && (
                <div onPointerDown={ev => ev.stopPropagation()}
                  style={{
                    position: 'absolute', top: -5, [paraEsquerda ? 'right' : 'left']: '100%',
                    marginLeft: paraEsquerda ? 0 : 6, marginRight: paraEsquerda ? 6 : 0,
                    display: 'flex', gap: 7, padding: 9, background: C.surface,
                    border: `1px solid ${C.line}`, borderRadius: 12,
                    boxShadow: '0 18px 45px rgba(0,0,0,.45)', animation: 'fadeIn .12s',
                  }}>
                  {it.cores.opcoes.map(cor => (
                    <button key={cor} type="button" title={cor}
                      onClick={ev => { ev.stopPropagation(); it.cores.onEscolher(cor); }}
                      style={{
                        width: 24, height: 24, borderRadius: 99, background: cor, cursor: 'pointer',
                        border: `2.5px solid ${it.cores.atual === cor ? C.ink : 'transparent'}`,
                      }} />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <button type="button"
              onClick={ev => { ev.stopPropagation(); onClose(); it.onClick(); }}
              onMouseEnter={ev => { realce(ev, true); setSubmenu(null); }}
              onMouseLeave={ev => realce(ev, false)}
              style={{ ...estiloItem, color: it.perigo ? '#FF6B5B' : C.ink }}>
              {it.rotulo}
            </button>
          )}
        </React.Fragment>
      ))}
    </div>,
    document.body,
  );
}

function useContextMenu() {
  const [menu, setMenu] = useState(null);
  const abrir = (id) => (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    setMenu({ id, x: ev.clientX, y: ev.clientY });
  };
  return [menu, abrir, () => setMenu(null)];
}

function SaveSheet({ draft, setDraft, lists, onNewList, onCancel, onSave, saving }) {
  const C = getTheme();
  const set = (k, v) => setDraft(d => ({ ...d, [k]: v }));
  const listIds = draft.list_ids || [];
  const alternaLista = (id) => set('list_ids', listIds.includes(id) ? listIds.filter(x => x !== id) : [...listIds, id]);
  const temEndereco = draft.lat != null && draft.lng != null;
  const canSave = draft.name.trim() && listIds.length > 0 && temEndereco && !saving;
  const trocarEndereco = () => setDraft(d => ({ ...d, address: '', lat: null, lng: null }));
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 850 }}>
      <div onClick={onCancel} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.55)', animation: 'fadeIn .2s' }} />
      <div className="mipas-sheet" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, background: C.paper, border: `1px solid ${C.line}`, borderRadius: '20px 20px 0 0', padding: '10px 20px 28px', maxHeight: '86%', overflow: 'auto', animation: 'sheetUp .3s cubic-bezier(.2,.9,.3,1)' }}>
        <div style={{ width: 36, height: 4, borderRadius: 99, background: C.line, margin: '0 auto 14px' }} />
        <div style={{ fontFamily: 'var(--display-font)', fontSize: 19, fontWeight: 400, color: C.ink }}>{temEndereco ? 'Guardar esse lugar' : 'Novo lugar'}</div>
        {temEndereco ? (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 3 }}>
            <div style={{ flex: 1, color: C.sub, fontWeight: 500, fontSize: 13, lineHeight: 1.4 }}>{draft.address}</div>
            <Button onClick={trocarEndereco} variant="plain" size="xs" className="shrink-0 !px-0">trocar</Button>
          </div>
        ) : (
          <React.Fragment>
            <div style={{ color: C.sub, fontWeight: 500, fontSize: 13, marginTop: 3, lineHeight: 1.4 }}>
              Comece pelo endereço — é ele que põe o pin no mapa.
            </div>
            <div style={{ marginTop: 16, fontWeight: 700, fontSize: 13, color: C.ink }}>Endereço</div>
            <AddressPicker autoFocus onPick={r => setDraft(d => ({ ...d, address: r.address, lat: r.lat, lng: r.lng }))} />
          </React.Fragment>
        )}
        <div style={{ marginTop: 16, fontWeight: 700, fontSize: 13, color: C.ink }}>Dê um nome só seu</div>
        <input autoFocus={temEndereco} value={draft.name} onChange={e => set('name', e.target.value)} placeholder='Ex: "Melhor pastel da cidade"'
          style={{ width: '100%', boxSizing: 'border-box', marginTop: 7, background: C.surface, border: `1.5px solid ${C.line}`, borderRadius: 12, padding: '13px 16px', fontSize: 15, fontWeight: 600, color: C.ink }} />
        <div style={{ marginTop: 14, fontWeight: 700, fontSize: 13, color: C.ink }}>Em quais listas? <span style={{ color: C.sub, fontWeight: 500 }}>(pode ser mais de uma)</span></div>
        <ListPicker lists={lists} selecionadas={listIds} onAlternar={alternaLista} onNewList={onNewList} inline />
        <div style={{ marginTop: 14, fontWeight: 700, fontSize: 13, color: C.ink }}>Categoria <span style={{ color: C.sub, fontWeight: 500 }}>(opcional, você escolhe o nome)</span></div>
        <input value={draft.category || ''} onChange={e => set('category', e.target.value)} placeholder='Ex: "Bar", "Pizzaria", "Mirante"…'
          style={{ width: '100%', boxSizing: 'border-box', marginTop: 7, background: C.surface, border: `1.5px solid ${C.line}`, borderRadius: 12, padding: '13px 16px', fontSize: 15, fontWeight: 600, color: C.ink }} />
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: C.ink }}>Nota <span style={{ color: C.sub, fontWeight: 500 }}>(0 a 10)</span></div>
            <input type="number" min="0" max="10" step="0.5" value={draft.rating ?? ''} onChange={e => set('rating', e.target.value)} placeholder="—"
              style={{ width: '100%', boxSizing: 'border-box', marginTop: 7, background: C.surface, border: `1.5px solid ${C.line}`, borderRadius: 12, padding: '13px 16px', fontSize: 15, fontWeight: 600, color: C.ink }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: C.ink }}>Média de valor <span style={{ color: C.sub, fontWeight: 500 }}>(R$)</span></div>
            <input type="number" min="0" step="0.01" value={draft.avg_price ?? ''} onChange={e => set('avg_price', e.target.value)} placeholder="—"
              style={{ width: '100%', boxSizing: 'border-box', marginTop: 7, background: C.surface, border: `1.5px solid ${C.line}`, borderRadius: 12, padding: '13px 16px', fontSize: 15, fontWeight: 600, color: C.ink }} />
          </div>
        </div>
        <div style={{ marginTop: 14, fontWeight: 700, fontSize: 13, color: C.ink }}>Instagram <span style={{ color: C.sub, fontWeight: 500 }}>(opcional)</span></div>
        <input value={draft.instagram || ''} onChange={e => set('instagram', e.target.value)} placeholder="@dolugar"
          style={{ width: '100%', boxSizing: 'border-box', marginTop: 7, background: C.surface, border: `1.5px solid ${C.line}`, borderRadius: 12, padding: '13px 16px', fontSize: 15, fontWeight: 600, color: C.ink }} />
        <div style={{ marginTop: 14, fontWeight: 700, fontSize: 13, color: C.ink }}>Descrição <span style={{ color: C.sub, fontWeight: 500 }}>(opcional, visível pra quem ver a lista)</span></div>
        <div style={{ marginTop: 7 }}>
          <RichTextEditor value={draft.description} onChange={v => set('description', v)} placeholder="Como é o lugar, o que pedir, vibe geral…" />
        </div>

        <div style={{ marginTop: 14, fontWeight: 700, fontSize: 13, color: C.ink }}>Fotos <span style={{ color: C.sub, fontWeight: 500 }}>(opcional)</span></div>
        <DraftPhotos photos={draft.photos || []} onChange={v => set('photos', v)} />
        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <Btn onClick={onCancel} style={{ flex: 1 }}>Cancelar</Btn>
          <Btn primary disabled={!canSave} onClick={onSave} style={{ flex: 2 }}>{saving ? 'Guardando…' : 'Guardar lugar'}</Btn>
        </div>
      </div>
    </div>
  );
}

function ListSheet({ list = null, onCancel, onCreate, creating }) {
  const C = getTheme();
  const editando = !!list;
  const [name, setName] = useState(list ? list.name : '');
  const [emoji, setEmoji] = useState(list ? list.emoji : '📍');
  const [color, setColor] = useState(list ? list.color : listColors[0]);
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 900 }}>
      <div onClick={onCancel} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.55)', animation: 'fadeIn .2s' }} />
      <div className="mipas-sheet" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, background: C.paper, border: `1px solid ${C.line}`, borderRadius: '20px 20px 0 0', padding: '10px 20px 28px', animation: 'sheetUp .3s cubic-bezier(.2,.9,.3,1)' }}>
        <div style={{ width: 36, height: 4, borderRadius: 99, background: C.line, margin: '0 auto 14px' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: color + '22', border: `1px solid ${color}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{emoji || '?'}</div>
          <div style={{ fontFamily: 'var(--display-font)', fontSize: 19, fontWeight: 400, color: C.ink }}>{editando ? 'Editar lista' : 'Nova lista'}</div>
        </div>
        <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder='Ex: "Sorveterias pra testar"'
          style={{ width: '100%', boxSizing: 'border-box', marginTop: 14, background: C.surface, border: `1.5px solid ${C.line}`, borderRadius: 12, padding: '13px 16px', fontSize: 15, fontWeight: 600, color: C.ink }} />
        <div style={{ marginTop: 14, fontWeight: 700, fontSize: 13, color: C.ink }}>Emoji</div>
        <input value={emoji} onChange={e => setEmoji(e.target.value)} placeholder="📍"
          style={{ width: 80, boxSizing: 'border-box', marginTop: 7, background: C.surface, border: `1.5px solid ${C.line}`, borderRadius: 12, padding: '10px 14px', fontSize: 20, textAlign: 'center', color: C.ink }} />
        <div style={{ color: C.sub, fontWeight: 500, fontSize: 12, marginTop: 6 }}>
          Cole ou digite qualquer emoji do teclado do seu sistema (no Windows: tecla Win + ponto).
        </div>
        <div style={{ marginTop: 14, fontWeight: 700, fontSize: 13, color: C.ink }}>Cor</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 8 }}>
          {listColors.map(c => (
            <button key={c} onClick={() => setColor(c)} style={{
              width: 32, height: 32, borderRadius: 99, background: c, cursor: 'pointer',
              border: `3px solid ${color === c ? C.ink : C.surface}`,
            }} />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <Btn onClick={onCancel} style={{ flex: 1 }}>Cancelar</Btn>
          <Btn primary disabled={!name.trim() || !emoji.trim() || creating} onClick={() => name.trim() && onCreate({ name: name.trim(), emoji: emoji.trim(), color })} style={{ flex: 2 }}>
            {creating ? (editando ? 'Salvando…' : 'Criando…') : (editando ? 'Salvar' : 'Criar lista')}
          </Btn>
        </div>
      </div>
    </div>
  );
}

function HomeSheet({ home, onCancel, onSave, onClear }) {
  const C = getTheme();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');

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

  const pick = async (lat, lng) => {
    setSaving(true);
    setError('');
    try {
      await onSave({ lat, lng });
    } catch (e) {
      setError('Não deu pra salvar. Tenta de novo.');
    } finally {
      setSaving(false);
    }
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) { setError('Este navegador não suporta geolocalização.'); return; }
    setLocating(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      pos => { setLocating(false); pick(pos.coords.latitude, pos.coords.longitude); },
      () => { setLocating(false); setError('Não deu pra pegar sua localização. Tenta buscar o endereço.'); },
    );
  };

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 900 }}>
      <div onClick={onCancel} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.55)', animation: 'fadeIn .2s' }} />
      <div className="mipas-sheet" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, background: C.paper, border: `1px solid ${C.line}`, borderRadius: '20px 20px 0 0', padding: '10px 20px 28px', maxHeight: '86%', overflow: 'auto', animation: 'sheetUp .3s cubic-bezier(.2,.9,.3,1)' }}>
        <div style={{ width: 36, height: 4, borderRadius: 99, background: C.line, margin: '0 auto 14px' }} />
        <div style={{ fontFamily: 'var(--display-font)', fontSize: 19, fontWeight: 400, color: C.ink }}>Sua casa</div>
        <div style={{ color: C.sub, fontWeight: 500, fontSize: 13, marginTop: 3, lineHeight: 1.4 }}>
          Usada só pra calcular distância nas suas listas. Nunca aparece pra quem visualiza uma lista pública.
        </div>

        {home && (
          <div style={{ marginTop: 14, background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12, padding: '10px 14px', fontSize: 13, fontWeight: 600, color: C.ink, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Casa definida ({home.latitude.toFixed(4)}, {home.longitude.toFixed(4)})</span>
            <Button onClick={onClear} className="rounded-3xl font-semibold cursor-pointer transition inline-flex items-center justify-center gap-1.5 border-none bg-transparent text-[#FF6B5B] hover:bg-[#FF6B5B]/10 px-3 py-1.5 text-[12px] shadow-none">Remover</Button>
          </div>
        )}

        <Button onClick={useCurrentLocation} disabled={locating || saving} className="rounded-3xl font-semibold cursor-pointer transition inline-flex items-center justify-center gap-1.5 border-none bg-coral text-white shadow-md hover:opacity-85 px-5 py-2.5 text-[13px] w-full mt-3.5 !py-3.5 !text-[14.5px]">{locating ? 'Localizando…' : 'Usar minha localização atual'}</Button>

        <div style={{ marginTop: 16, fontWeight: 700, fontSize: 13, color: C.ink }}>Ou busque um endereço</div>
        <input autoFocus value={query} onChange={e => { setQuery(e.target.value); debouncedSearch(e.target.value); }} placeholder="Rua, praça, avenida…"
          style={{ width: '100%', boxSizing: 'border-box', marginTop: 7, background: C.surface, border: `1.5px solid ${C.line}`, borderRadius: 12, padding: '13px 16px', fontSize: 15, fontWeight: 600, color: C.ink }} />

        {searching && <div style={{ textAlign: 'center', marginTop: 16, color: C.sub, fontWeight: 600, fontSize: 13 }}>Buscando…</div>}
        {error && <div style={{ marginTop: 12, color: '#FF6B5B', fontWeight: 600, fontSize: 13 }}>{error}</div>}

        <div style={{ marginTop: 8 }}>
          {results.map((r, i) => (
            <div key={i} onClick={() => pick(r.lat, r.lng)} style={{ padding: '12px 4px', borderBottom: `1px solid ${C.line}`, cursor: 'pointer', fontSize: 14, fontWeight: 600, color: C.ink }}>
              {r.address}
            </div>
          ))}
        </div>

        <Btn onClick={onCancel} style={{ width: '100%', boxSizing: 'border-box', marginTop: 18 }}>Fechar</Btn>
      </div>
    </div>
  );
}

function AddressLink({ place, fontSize }) {
  const C = getTheme();
  const query = encodeURIComponent(`${place.name}, ${place.address}`);
  return (
    <a href={`https://www.google.com/maps/search/?api=1&query=${query}`}
      target="_blank" rel="noopener noreferrer" onClick={ev => ev.stopPropagation()}
      title="Abrir no Google Maps"
      style={{ color: C.sub, fontWeight: 500, fontSize, textDecoration: 'none', cursor: 'pointer' }}
      onMouseEnter={e => { e.target.style.textDecoration = 'underline'; }}
      onMouseLeave={e => { e.target.style.textDecoration = 'none'; }}>
      {shortAddress(place.address)} ↗
    </a>
  );
}

function InstagramButton({ handle, compacto = false }) {
  const C = getTheme();
  const url = /^https?:\/\//i.test(handle) ? handle : 'https://instagram.com/' + handle.replace(/^@/, '');
  if (compacto) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" onClick={ev => ev.stopPropagation()}
        title="Abrir no Instagram"
        style={{ color: C.sub, fontWeight: 600, fontSize: 11.5, textDecoration: 'none' }}
        onMouseEnter={e => { e.currentTarget.style.textDecoration = 'underline'; }}
        onMouseLeave={e => { e.currentTarget.style.textDecoration = 'none'; }}>
        @{String(handle).replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/\/$/, '')}
      </a>
    );
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" onClick={ev => ev.stopPropagation()} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none',
      background: 'linear-gradient(45deg,#F58529,#DD2A7B,#8134AF)', color: '#fff',
      borderRadius: 999, padding: '5px 12px', fontSize: 12, fontWeight: 800, letterSpacing: .4,
    }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
        <rect x="2" y="2" width="20" height="20" rx="5.5" stroke="currentColor" strokeWidth="2.4" />
        <circle cx="12" cy="12" r="4.6" stroke="currentColor" strokeWidth="2.4" />
        <circle cx="17.4" cy="6.6" r="1.5" fill="currentColor" />
      </svg>
      INSTAGRAM
    </a>
  );
}

function RouteLegend({ route, C }) {
  const linha = (cor, icone, rotulo, leg) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 700, color: C.ink }}>
      <span style={{ width: 14, height: 3, borderRadius: 2, background: cor, flexShrink: 0 }} />
      <span>{icone} {rotulo}</span>
      <span style={{ color: C.sub, fontWeight: 600 }}>{formatMinutes(leg.minutes)} · {formatKm(leg.km)}</span>
    </div>
  );
  const estimado = route.walking.estimated || route.driving.estimated;
  return (
    <div style={{ marginTop: 10, background: C.cream, borderRadius: 12, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      {linha(ROUTE_COLORS.walking, '🚶', 'A pé', route.walking)}
      {linha(ROUTE_COLORS.driving, '🚗', 'De carro', route.driving)}
      {estimado && (
        <div style={{ fontSize: 11.5, fontWeight: 600, color: C.sub, lineHeight: 1.35 }}>
          O roteador não respondeu — isto é estimativa por linha reta.
        </div>
      )}
    </div>
  );
}

function PlaceCard({ place, list, onClose, refKm, refTipo, route, routeLoading, routeOpen, onToggleRoute }) {
  const C = getTheme();
  const [openId, setOpenId] = useState(null);
  const photos = place.photos || [];
  return (
    <WindowCard style={{ position: 'absolute', left: 12, right: 12, bottom: 96, zIndex: 750, boxShadow: '0 14px 40px rgba(0,0,0,.5)', animation: 'sheetUp .28s cubic-bezier(.2,.9,.3,1)' }}>
      <div style={{ height: 64, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', background: gradientForPlace(place, list) }}>
        <div style={{ fontFamily: 'var(--display-font)', fontWeight: 400, fontSize: 16, letterSpacing: .5, textTransform: 'uppercase', color: '#fff', textShadow: '0 1px 10px rgba(0,0,0,.5)', padding: '0 52px', maxWidth: '100%', boxSizing: 'border-box', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>
          {place.name}
        </div>
        <button onClick={onClose} style={{ position: 'absolute', top: 10, right: 10, width: 28, height: 28, borderRadius: 99, border: 'none', background: 'rgba(0,0,0,.4)', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: C.ink }}>✕</button>
      </div>
      <div style={{ padding: '14px 18px 16px' }}>
        <AddressLink place={place} fontSize={13} />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
          {list && <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center', background: list.color + '1E', color: list.color, borderRadius: 999, padding: '5px 12px', fontSize: 12.5, fontWeight: 700 }}>{list.emoji} {list.name}</div>}
          {place.category && <div style={{ fontSize: 12.5, fontWeight: 700, color: C.sub, background: C.cream, borderRadius: 999, padding: '5px 12px' }}>{place.category}</div>}
          {place.rating != null && <div style={{ fontSize: 12.5, fontWeight: 700, color: C.coral, background: C.coral + '1E', borderRadius: 999, padding: '5px 12px' }}>★ {place.rating}</div>}
          {place.avg_price != null && (
            <div style={{ fontSize: 12.5, fontWeight: 700, color: C.sub, background: C.cream, borderRadius: 999, padding: '5px 12px' }}>
              R$ {Number(place.avg_price).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          )}
          {place.instagram && <InstagramButton handle={place.instagram} />}
          {onToggleRoute && (
            <button onClick={onToggleRoute}
              title={routeOpen
                ? 'Esconder o caminho'
                : (refTipo === 'gps' ? 'Ver o caminho desde onde você está' : 'Ver o caminho desde a sua casa')}
              style={{
                fontSize: 12.5, fontWeight: 700, cursor: 'pointer', borderRadius: 999, padding: '5px 12px',
                background: routeOpen ? C.coral + '1E' : C.cream, color: routeOpen ? C.coral : C.sub,
                border: `1px solid ${routeOpen ? C.coral + '55' : 'transparent'}`,
              }}>
              {refTipo === 'gps' ? '📍' : '🏠'} {routeLoading ? 'traçando…' : formatKm(refKm)}
            </button>
          )}
          {photos.length > 0 && (
            <Button onClick={() => setOpenId(photos[0].id)} title="Ver as fotos" className="rounded-3xl font-semibold cursor-pointer transition inline-flex items-center justify-center gap-1.5 border-none bg-surface text-coral border border-line shadow-sm hover:bg-cream px-4 py-2 text-[12px]">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h1.9l1.2-2h6.8l1.2 2h1.9A2.5 2.5 0 0 1 21 8.5v9A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5v-9Z" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
                <circle cx="12" cy="13" r="3.6" stroke="currentColor" strokeWidth="1.9" />
              </svg>
              FOTOS{photos.length > 1 ? ` (${photos.length})` : ''}
            </Button>
          )}
        </div>
        {routeOpen && route && <RouteLegend route={route} C={C} />}
        {place.description && <RichText html={place.description} style={{ marginTop: 10, fontSize: 13.5, fontWeight: 500, color: C.ink, background: C.cream, borderRadius: 12, padding: '10px 14px', lineHeight: 1.45 }} />}
      </div>

      {openId && <PhotoLightbox photos={photos} openId={openId} onSetId={setOpenId} onClose={() => setOpenId(null)} />}
    </WindowCard>
  );
}

function WishSheet({ draft, setDraft, saving, onCancel, onSave }) {
  const C = getTheme();
  const set = (k, v) => setDraft(d => ({ ...d, [k]: v }));
  const canSave = draft.name.trim() && !saving;
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 850 }}>
      <div onClick={onCancel} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.55)', animation: 'fadeIn .2s' }} />
      <div className="mipas-sheet" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, background: C.paper, border: `1px solid ${C.line}`, borderRadius: '20px 20px 0 0', padding: '10px 20px 28px', maxHeight: '86%', overflow: 'auto', animation: 'sheetUp .3s cubic-bezier(.2,.9,.3,1)' }}>
        <div style={{ width: 36, height: 4, borderRadius: 99, background: C.line, margin: '0 auto 14px' }} />
        <div style={{ fontFamily: 'var(--display-font)', fontSize: 19, fontWeight: 400, color: C.ink }}>Quero ir aqui</div>
        <div style={{ color: C.sub, fontWeight: 500, fontSize: 13, marginTop: 3, lineHeight: 1.4 }}>{draft.address}</div>

        <div style={{ marginTop: 16, fontWeight: 700, fontSize: 13, color: C.ink }}>Nome do lugar</div>
        <input autoFocus value={draft.name} onChange={e => set('name', e.target.value)} placeholder='Ex: "Aquele japonês do centro"'
          style={{ width: '100%', boxSizing: 'border-box', marginTop: 7, background: C.surface, border: `1.5px solid ${C.line}`, borderRadius: 12, padding: '13px 16px', fontSize: 15, fontWeight: 600, color: C.ink }} />

        <div style={{ marginTop: 14, fontWeight: 700, fontSize: 13, color: C.ink }}>Instagram <span style={{ color: C.sub, fontWeight: 500 }}>(opcional)</span></div>
        <input value={draft.instagram || ''} onChange={e => set('instagram', e.target.value)} placeholder="@dolugar"
          style={{ width: '100%', boxSizing: 'border-box', marginTop: 7, background: C.surface, border: `1.5px solid ${C.line}`, borderRadius: 12, padding: '13px 16px', fontSize: 15, fontWeight: 600, color: C.ink }} />

        <div style={{ marginTop: 14, fontWeight: 700, fontSize: 13, color: C.ink }}>Por que quer ir? <span style={{ color: C.sub, fontWeight: 500 }}>(opcional)</span></div>
        <textarea value={draft.note || ''} onChange={e => set('note', e.target.value)} rows={2} placeholder="Quem indicou, o que querem provar…"
          style={{ width: '100%', boxSizing: 'border-box', marginTop: 7, background: C.surface, border: `1.5px solid ${C.line}`, borderRadius: 12, padding: '12px 16px', fontSize: 14, fontWeight: 500, color: C.ink, resize: 'none' }} />

        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <Btn onClick={onCancel} style={{ flex: 1 }}>Cancelar</Btn>
          <Btn primary disabled={!canSave} onClick={onSave} style={{ flex: 2 }}>{saving ? 'Guardando…' : 'Guardar desejo'}</Btn>
        </div>
      </div>
    </div>
  );
}

export function HomeButton({ className = '' }) {
  const C = getTheme();
  return (
    <a href="https://bonbap.com.br" title="Ir para o bonbap.com.br"
      className={cn('inline-flex shrink-0 items-center gap-1.5 no-underline transition hover:opacity-65', className)}>
      <span style={{ fontFamily: 'var(--display-font)', fontWeight: 400, fontSize: 16, lineHeight: 1, letterSpacing: .5, color: C.sub }}>
        bonbap
      </span>
      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" style={{ marginTop: -2 }}>
        <path d="M3.4 8.6 8.6 3.4M4.4 3.4h4.2v4.2" stroke={C.sub} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </a>
  );
}

function OverlayTopRow({ onViewMap }) {
  return (
    <div className="mb-3.5 flex items-center gap-2">
      <HomeButton />
      <div className="flex-1" />
      {onViewMap && (
        <Button onClick={onViewMap} variant="outline" size="sm" className="shrink-0"
          icon={(
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <path d="M8 14.5S13 9 13 5.6A5 5 0 0 0 3 5.6C3 9 8 14.5 8 14.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
              <circle cx="8" cy="5.5" r="1.8" fill="currentColor" />
            </svg>
          )}>
          Ver no mapa
        </Button>
      )}
    </div>
  );
}

function WishPanel({ wishes, origem, onNew, onFui, onRemove, onViewMap, seletor, variant }) {
  const C = getTheme();
  const isPanel = variant === 'panel';

  const comDistancia = (wishes || []).map(w => ({
    ...w,
    distanceKm: (origem && w.latitude != null && w.longitude != null)
      ? haversineKm(origem.latitude, origem.longitude, w.latitude, w.longitude)
      : null,
  }));

  return (
    <div style={isPanel
      ? { position: 'relative', height: '100%', boxSizing: 'border-box', background: C.paper, overflow: 'auto', padding: '20px 20px 40px' }
      : { position: 'absolute', inset: 0, zIndex: 600, background: C.paper, overflow: 'auto', padding: '70px 20px 120px' }}>
      {!isPanel && <OverlayTopRow onViewMap={onViewMap} />}
      {seletor && <div style={{ marginBottom: 12 }}>{seletor}</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div className="section-title" style={{ fontFamily: 'var(--display-font)', fontSize: isPanel ? 20 : 24, fontWeight: 400, color: C.ink, flex: 1 }}>Quero ir</div>
        <AddButton rotulo="Quero ir num lugar novo" onClick={onNew} />
      </div>
      <div style={{ color: C.sub, fontWeight: 600, fontSize: 13, marginTop: 2 }}>
        {comDistancia.length === 0 ? 'nenhum lugar na fila ainda' : `${comDistancia.length} ${comDistancia.length === 1 ? 'lugar na fila' : 'lugares na fila'}`}
      </div>
      <div style={{ color: C.sub, fontWeight: 500, fontSize: 12, marginTop: 6, lineHeight: 1.4 }}>
        Só você vê esta aba, e estes lugares não aparecem no mapa.
      </div>


      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
        {comDistancia.map(w => (
          <WindowCard key={w.id} bodyClassName="px-3.5 py-3">
            <div style={{ fontFamily: 'var(--display-font)', fontWeight: 400, fontSize: 15, color: C.ink }}>{w.name}</div>
            <div style={{ marginTop: 3 }}>
              <AddressLink place={w} fontSize={12.5} />
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 9 }}>
              {w.distanceKm != null && (
                <div style={{ fontSize: 12, fontWeight: 700, color: C.sub, background: C.cream, borderRadius: 999, padding: '4px 10px' }}>
                  {w.distanceKm < 1 ? `${Math.round(w.distanceKm * 1000)} m` : `${w.distanceKm.toFixed(1)} km`}
                </div>
              )}
              {w.instagram && <InstagramButton handle={w.instagram} />}
            </div>
            {w.note && (
              <div style={{ marginTop: 9, fontSize: 12.5, fontWeight: 500, color: C.sub, lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>{w.note}</div>
            )}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.line}` }}>
              <Button onClick={() => onFui(w)} className="rounded-3xl font-semibold cursor-pointer transition inline-flex items-center justify-center gap-1.5 border-none bg-coral text-white shadow-md hover:opacity-85 px-5 py-2.5 text-[13px] !px-6 !py-2.5 tracking-wide">FUI!</Button>
              <span style={{ fontSize: 11.5, fontWeight: 500, color: C.sub }}>vira um lugar numa lista</span>
              <div style={{ flex: 1 }} />
              <Button onClick={() => onRemove(w)} className="rounded-3xl font-semibold cursor-pointer transition inline-flex items-center justify-center gap-1.5 border-none bg-transparent text-[#FF6B5B] hover:bg-[#FF6B5B]/10 px-3 py-1.5 text-[12px] shadow-none">Excluir</Button>
            </div>
          </WindowCard>
        ))}
      </div>
    </div>
  );
}

function ListsPanel({ lists, places, canEdit, onOpenList, onNewList, onViewMap, seletor, variant, menuDaLista }) {
  const C = getTheme();
  const isPanel = variant === 'panel';
  const [menu, abrirMenu, fecharMenu] = useContextMenu();
  const listaDoMenu = menu ? lists.find(l => l.id === menu.id) : null;
  return (
    <div style={isPanel
      ? { position: 'relative', height: '100%', boxSizing: 'border-box', background: C.paper, overflow: 'auto', padding: '20px 20px 40px' }
      : { position: 'absolute', inset: 0, zIndex: 600, background: C.paper, overflow: 'auto', padding: '70px 20px 120px' }}>
      {!isPanel && <OverlayTopRow onViewMap={onViewMap} />}
      {seletor && <div style={{ marginBottom: 12 }}>{seletor}</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div className="section-title" style={{ fontFamily: 'var(--display-font)', fontSize: 24, fontWeight: 400, color: C.ink, flex: 1 }}>{canEdit ? 'Minhas listas' : 'Lista do Bon'}</div>
        {canEdit && <AddButton rotulo="Criar lista" onClick={onNewList} />}
      </div>
      <div style={{ color: C.sub, fontWeight: 600, fontSize: 13.5, marginTop: 2, marginBottom: 20 }}>{places.length} lugares guardados</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {lists.map(l => {
          const count = places.filter(p => (p.list_ids || []).includes(l.id)).length;
          return (
            <WindowCard key={l.id} onClick={() => onOpenList(l.id)} bodyClassName="flex items-center gap-3.5 p-4"
              onContextMenu={menuDaLista ? abrirMenu(l.id) : undefined}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: l.color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>{l.emoji}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15.5, color: C.ink }}>{l.name}</div>
                <div style={{ color: C.sub, fontWeight: 600, fontSize: 13 }}>{count} {count === 1 ? 'lugar' : 'lugares'}</div>
                {canEdit && (l.hidden_for_owner || l.hidden_for_visitor) && (
                  <div style={{ marginTop: 3, fontSize: 11, fontWeight: 600, color: C.sub, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                      <path d="M2 8s2.4-4 6-4 6 4 6 4-2.4 4-6 4-6-4-6-4Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                      <path d="M3 3l10 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                    </svg>
                    {[l.hidden_for_owner && 'fora do seu mapa', l.hidden_for_visitor && 'fora do mapa dos visitantes']
                      .filter(Boolean).join(' · ')}
                  </div>
                )}
              </div>
              <div style={{ width: 10, height: 10, borderRadius: 99, background: l.color }} />
            </WindowCard>
          );
        })}
      </div>

      {listaDoMenu && menuDaLista && (
        <ContextMenu x={menu.x} y={menu.y} itens={menuDaLista(listaDoMenu)} onClose={fecharMenu} />
      )}
    </div>
  );
}

function PhotoDropRow({ onFiles, ativo, style, children }) {
  const C = getTheme();
  const [sobre, dropProps] = useFileDrop(onFiles, ativo);
  return (
    <div {...dropProps} style={{
      ...style, borderRadius: 12, transition: 'outline-color .15s, background .15s',
      outline: `2px dashed ${sobre ? C.coral : 'transparent'}`, outlineOffset: 3,
      background: sobre ? C.coral + '14' : 'transparent',
    }}>
      {children}
    </div>
  );
}

function PhotoGallery({ photos, canEdit, edits, onEdit, onAdd, onRemove, onReorder, coverId, onSetCover }) {
  const C = getTheme();
  const inputRef = useRef(null);
  const pendingTitleRef = useRef(null);
  const [openId, setOpenId] = useState(null);
  const [dragId, setDragId] = useState(null);
  const [overId, setOverId] = useState(null);
  const dragRef = useRef({ id: null, timer: null, ativo: false });

  useEffect(() => () => clearTimeout(dragRef.current.timer), []);

  if (!canEdit && (!photos || photos.length === 0)) return null;

  const val = (ph, campo) => {
    const e = (edits || {})[ph.id] || {};
    return campo in e ? e[campo] : (ph[campo] ?? '');
  };

  const podeEscolherCapa = canEdit && !!onSetCover;
  const ehCapa = (ph) => podeEscolherCapa && ph.id === coverId;

  const handleFile = (e) => {
    Array.from(e.target.files || []).forEach(file => onAdd(file, pendingTitleRef.current));
    pendingTitleRef.current = null;
    e.target.value = '';
  };
  const pickFile = (title) => { pendingTitleRef.current = title || null; inputRef.current.click(); };

  const all = photos || [];
  const titles = [];
  all.forEach(ph => { const t = (ph.title || '').trim(); if (t && !titles.includes(t)) titles.push(t); });
  const groups = titles.map(t => ({ title: t, items: all.filter(ph => (ph.title || '').trim() === t) }));
  const untitled = all.filter(ph => !(ph.title || '').trim());
  const ordered = [...groups.flatMap(g => g.items), ...untitled];

  const LONG_PRESS = 280;

  const comecarArrasto = (id) => { dragRef.current.ativo = true; setDragId(id); };

  const aoApontar = (ev, ph) => {
    if (!canEdit || ordered.length < 2) return;
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;
    dragRef.current.id = ph.id;
    dragRef.current.ativo = false;
    ev.currentTarget.setPointerCapture(ev.pointerId);
    if (ev.pointerType === 'mouse') comecarArrasto(ph.id);
    else dragRef.current.timer = setTimeout(() => comecarArrasto(ph.id), LONG_PRESS);
  };

  const aoMover = (ev) => {
    if (!dragRef.current.ativo) return;
    ev.preventDefault();
    const alvo = document.elementFromPoint(ev.clientX, ev.clientY);
    const cartao = alvo && alvo.closest ? alvo.closest('[data-foto-id]') : null;
    const id = cartao && cartao.getAttribute('data-foto-id');
    if (id && id !== dragRef.current.id) setOverId(id);
  };

  const aoSoltar = () => {
    clearTimeout(dragRef.current.timer);
    const arrastado = dragRef.current.id;
    const sobre = overId;
    const eraArrasto = dragRef.current.ativo;
    dragRef.current = { id: null, timer: null, ativo: false };
    setDragId(null);
    setOverId(null);
    if (!eraArrasto || !arrastado || !sobre || arrastado === sobre) return;
    const ids = ordered.map(p => p.id);
    const de = ids.indexOf(arrastado);
    const para = ids.indexOf(sobre);
    if (de < 0 || para < 0) return;
    ids.splice(para, 0, ids.splice(de, 1)[0]);
    onReorder(ids);
  };

  const thumb = (ph) => (
    <div key={ph.id} data-foto-id={ph.id}
      onPointerDown={ev => aoApontar(ev, ph)}
      onPointerMove={aoMover}
      onPointerUp={aoSoltar}
      onPointerCancel={aoSoltar}
      style={{
        position: 'relative', flexShrink: 0, touchAction: canEdit ? 'none' : 'auto',
        opacity: dragId === ph.id ? .4 : 1,
        transform: overId === ph.id ? 'scale(1.06)' : 'none',
        transition: 'transform .12s',
      }}>
      <img src={ph.url} alt={ph.title || ''} loading="lazy" draggable={false}
        onClick={() => { if (!dragRef.current.ativo) setOpenId(ph.id); }}
        title={canEdit && ordered.length > 1 ? 'Clique pra ver, arraste pra reordenar' : 'Ver foto'}
        style={{
          width: 72, height: 72, objectFit: 'cover', display: 'block', borderRadius: 10,
          border: `${overId === ph.id || ehCapa(ph) ? 2 : 1}px solid ${overId === ph.id || ehCapa(ph) ? C.coral : C.line}`,
          background: C.cream, cursor: canEdit && ordered.length > 1 ? 'grab' : 'zoom-in',
        }} />
      {canEdit && (
        <button onClick={() => onRemove(ph)} onPointerDown={ev => ev.stopPropagation()} style={{ position: 'absolute', top: 3, right: 3, width: 19, height: 19, borderRadius: 99, border: 'none', background: 'rgba(0,0,0,.6)', color: '#fff', fontSize: 10, cursor: 'pointer', lineHeight: '19px', padding: 0 }}>✕</button>
      )}
      {podeEscolherCapa && ehCapa(ph) && (
        <div style={{
          position: 'absolute', left: 1, right: 1, bottom: 1, background: C.coral, color: 'var(--coral-texto)',
          fontSize: 9, fontWeight: 800, letterSpacing: .6, textAlign: 'center', padding: '2px 0',
          borderRadius: '0 0 9px 9px', pointerEvents: 'none',
        }}>📍 CAPA</div>
      )}
      {podeEscolherCapa && !ehCapa(ph) && (
        <button
          onClick={() => onSetCover(ph.id)}
          onPointerDown={ev => ev.stopPropagation()}
          title="Usar esta foto como capa do pin no mapa"
          style={{
            position: 'absolute', left: 1, right: 1, bottom: 1, background: 'rgba(0,0,0,.62)', color: '#fff',
            fontSize: 9, fontWeight: 700, letterSpacing: .3, textAlign: 'center', padding: '2px 0',
            border: 'none', borderRadius: '0 0 9px 9px', cursor: 'pointer',
          }}>usar de capa</button>
      )}
    </div>
  );

  const addBtn = (title) => (
    <Button onClick={() => pickFile(title)} title="Adicionar foto (clique ou arraste pra cá)" className="rounded-3xl font-semibold cursor-pointer transition inline-flex items-center justify-center gap-1.5 border-none bg-surface text-coral border border-line shadow-sm hover:bg-cream px-4 py-2 text-[12px] border-dashed shrink-0 w-[72px] h-[72px] !rounded-xl text-[22px]">+</Button>
  );

  const draftInput = {
    width: '100%', boxSizing: 'border-box', background: C.cream, border: `1px solid ${C.line}`,
    borderRadius: 8, padding: '5px 10px', fontSize: 12, fontWeight: 600, color: C.ink,
  };

  return (
    <div onClick={ev => ev.stopPropagation()} style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {podeEscolherCapa && all.length > 0 && (
        <div style={{ fontSize: 11.5, fontWeight: 600, color: C.sub, lineHeight: 1.4 }}>
          A foto marcada como <strong style={{ color: C.ink }}>📍 CAPA</strong> é a que aparece no pin do mapa
          {all.length > 1 ? ' — toque em "usar de capa" em outra pra trocar' : ''}
        </div>
      )}
      {groups.map(g => {
        const desc = (g.items.find(i => i.description && i.description.trim()) || {}).description || '';
        return (
          <div key={g.title} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {canEdit ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <input value={val(g.items[0], 'title')} placeholder="Título"
                  onChange={e => g.items.forEach(ph => onEdit(ph.id, { title: e.target.value }))}
                  style={draftInput} />
                <input value={val(g.items[0], 'description')} placeholder="Descrição dessas fotos"
                  onChange={e => g.items.forEach(ph => onEdit(ph.id, { description: e.target.value }))}
                  style={draftInput} />
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: C.ink }}>{g.title}</div>
                {desc && <div style={{ fontSize: 12, fontWeight: 500, color: C.sub, marginTop: 1, lineHeight: 1.4 }}>{desc}</div>}
              </div>
            )}
            <PhotoDropRow ativo={canEdit} onFiles={fs => fs.forEach(f => onAdd(f, g.title))}
              style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
              {g.items.map(thumb)}
              {canEdit && addBtn(g.title)}
            </PhotoDropRow>
          </div>
        );
      })}

      {(untitled.length > 0 || canEdit) && (
        <PhotoDropRow ativo={canEdit} onFiles={fs => fs.forEach(f => onAdd(f, null))}
          style={{ display: 'flex', gap: 6, overflowX: 'auto', alignItems: 'flex-start' }}>
          {untitled.map(ph => (
            canEdit ? (
              <div key={ph.id} style={{ flexShrink: 0, width: 110, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {thumb(ph)}
                <input value={val(ph, 'title')} placeholder="Título"
                  onChange={e => onEdit(ph.id, { title: e.target.value })} style={draftInput} />
              </div>
            ) : thumb(ph)
          ))}
          {canEdit && addBtn(null)}
        </PhotoDropRow>
      )}

      {canEdit && <input ref={inputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleFile} />}

      {openId && <PhotoLightbox photos={ordered} openId={openId} onSetId={setOpenId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function PhotoLightbox({ photos, openId, onSetId, onClose }) {
  const idx = Math.max(0, photos.findIndex(p => p.id === openId));
  const ph = photos[idx];

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!ph) return null;

  return ReactDOM.createPortal(
    <div onClick={onClose} className="fixed inset-0 z-[3000] box-border flex flex-col items-center justify-center bg-black/90 p-6" style={{ animation: 'fadeIn .15s' }}>
      <div onClick={ev => ev.stopPropagation()} className="w-full max-w-4xl">
        <VerticalthumbsSlider fotos={photos} startIndex={idx} alturaClasse="h-[min(70vh,520px)]" />

        {(ph.title || ph.description) && (
          <div className="mx-auto mt-3.5 max-w-[620px] text-center">
            {ph.title && <div className="text-[15px] font-extrabold text-white">{ph.title}</div>}
            {ph.description && <div className="mt-1 text-[13px] font-medium leading-relaxed text-white/70">{ph.description}</div>}
          </div>
        )}
      </div>

      <button onClick={onClose} className="absolute top-4 right-4 h-9 w-9 cursor-pointer rounded-full border-none bg-white/15 text-[15px] font-bold text-white">✕</button>
    </div>,
    document.body
  );
}

const SORT_LABELS = {
  padrao: 'Padrão',
  nota: 'Nota',
  categoria: 'Categoria',
  distancia: 'Distância',
  valor: 'Valor',
};

const NUMERIC_SORT_ACCESSORS = {
  distancia: p => p.distanceKm,
  nota: p => p.rating,
  valor: p => p.avg_price,
};

function PlaceThumb({ place, list, onClick }) {
  const C = getTheme();
  const capa = coverPhoto(place);
  const nFotos = (place.photos || []).length;
  return (
    <div onClick={onClick || undefined} title={capa ? 'Ver as fotos' : undefined}
      style={{
        flex: 1, minHeight: 118, position: 'relative', overflow: 'hidden',
        background: gradientForPlace(place, list),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: capa && onClick ? 'zoom-in' : undefined,
      }}>
      {capa
        ? <img src={capa.url} alt={capa.title || place.name} loading="lazy"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        : <span style={{ fontSize: 34, opacity: .8 }}>{(list && list.emoji) || '📍'}</span>}
      {nFotos > 1 && (
        <span style={{
          position: 'absolute', right: 6, bottom: 6, borderRadius: 999, padding: '1px 7px',
          background: 'rgba(0,0,0,.6)', color: '#fff', fontSize: 10.5, fontWeight: 800,
        }}>{nFotos}</span>
      )}
    </div>
  );
}

function PlaceRow({ place: p, list, todasListas, canEdit, expanded, onToggle, onOpenMap, onRemove, onRemoveFromList, onSave, onAddPhoto, onRemovePhoto, onReorderPhotos, onSetCover }) {
  const C = getTheme();

  const fromPlace = () => ({
    description: p.description ?? '',
    category: p.category ?? '',
    rating: p.rating ?? '',
    avg_price: p.avg_price ?? '',
    instagram: p.instagram ?? '',
    list_ids: [...(p.list_ids || [])],
  });
  const [draft, setDraft] = useState(fromPlace);
  const [photoEdits, setPhotoEdits] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!saving) { setDraft(fromPlace()); setPhotoEdits({}); }
  }, [p.id, p.description, p.category, p.rating, p.avg_price, p.instagram, (p.list_ids || []).join(',')]);

  const set = (k, v) => setDraft(d => ({ ...d, [k]: v }));
  const editPhoto = (photoId, patch) => setPhotoEdits(m => ({ ...m, [photoId]: { ...(m[photoId] || {}), ...patch } }));

  const NORM = {
    description: v => (String(v).trim() || null),
    category: v => (String(v).trim() || null),
    instagram: v => (String(v).trim().replace(/^@/, '') || null),
    rating: v => (v === '' || v == null ? null : parseFloat(v)),
    avg_price: v => (v === '' || v == null ? null : parseFloat(v)),
  };

  const patch = useMemo(() => {
    const out = {};
    Object.keys(NORM).forEach(k => {
      const next = NORM[k](draft[k]);
      const cur = p[k] ?? null;
      const igual = (next === null && cur === null) || (next !== null && cur !== null && String(next) === String(cur));
      if (!igual) out[k] = next;
    });
    return out;
  }, [draft, p]);

  const photoPatches = useMemo(() => Object.entries(photoEdits).map(([id, patch]) => {
    const ph = (p.photos || []).find(x => x.id === id);
    if (!ph) return null;
    const out = {};
    ['title', 'description'].forEach(k => {
      if (!(k in patch)) return;
      const next = String(patch[k] ?? '').trim() || null;
      if (next !== (ph[k] ?? null)) out[k] = next;
    });
    return Object.keys(out).length ? { id, patch: out } : null;
  }).filter(Boolean), [photoEdits, p.photos]);

  const listasMudaram = useMemo(() => {
    const antes = [...(p.list_ids || [])].sort().join(',');
    const agora = [...draft.list_ids].sort().join(',');
    return antes !== agora;
  }, [draft.list_ids, p.list_ids]);

  const dirty = Object.keys(patch).length > 0 || photoPatches.length > 0 || listasMudaram;

  const save = async () => {
    if (draft.list_ids.length === 0) {
      alert('O lugar precisa estar em pelo menos uma lista. Para apagá-lo de vez, use Excluir.');
      return;
    }
    setSaving(true);
    try {
      await onSave(p.id, patch, photoPatches, listasMudaram ? draft.list_ids : null);
      setPhotoEdits({});
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => { setDraft(fromPlace()); setPhotoEdits({}); };

  const inputStyle = {
    width: '100%', boxSizing: 'border-box', background: C.cream, border: `1px solid ${C.line}`,
    borderRadius: 10, padding: '8px 11px', fontSize: 13, fontWeight: 600, color: C.ink,
  };
  const field = (label, node) => (
    <div style={{ flex: 1, minWidth: 92 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.sub, marginBottom: 4 }}>{label}</div>
      {node}
    </div>
  );

  const chip = (texto, cor) => (
    <div key={texto} style={{ fontSize: 12, fontWeight: 700, color: cor || C.sub, background: cor ? cor + '1E' : C.cream, borderRadius: 999, padding: '4px 10px' }}>{texto}</div>
  );

  const tagMini = (texto, cor = null) => (
    <span key={texto} style={{
      fontSize: 9.5, fontWeight: 700, lineHeight: 1.5, letterSpacing: .2, whiteSpace: 'nowrap',
      color: cor || C.sub, background: cor ? cor + '1E' : C.cream, borderRadius: 999, padding: '1px 6px',
    }}>{texto}</span>
  );

  const nFotos = (p.photos || []).length;

  const cliqueRef = useRef(null);
  useEffect(() => () => clearTimeout(cliqueRef.current), []);
  const clique = () => {
    clearTimeout(cliqueRef.current);
    cliqueRef.current = setTimeout(onToggle, 220);
  };
  const duploClique = () => {
    clearTimeout(cliqueRef.current);
    onOpenMap(p);
  };

  const [fotoAberta, setFotoAberta] = useState(null);
  const capa = coverPhoto(p);
  const abrirFotos = capa
    ? (ev) => { ev.stopPropagation(); clearTimeout(cliqueRef.current); setFotoAberta(capa.id); }
    : null;

  const outrasListas = (p.list_ids || []).filter(id => id !== list.id)
    .map(id => (todasListas || []).find(l => l.id === id))
    .filter(Boolean);
  const semNadaNoRodape = p.rating == null && !p.category && p.avg_price == null
    && p.distanceKm == null && outrasListas.length === 0;

  return (
    <WindowCard>
      <div onClick={expanded ? undefined : clique} onDoubleClick={expanded ? undefined : duploClique}
        title={expanded ? undefined : 'Clique para abrir, duplo clique para ver no mapa'}
        style={{ display: 'flex', alignItems: 'stretch', height: 208, cursor: expanded ? 'default' : 'pointer' }}>

        <div style={{ width: '40%', maxWidth: 200, minWidth: 112, flexShrink: 0, display: 'flex', flexDirection: 'column', borderRight: `1px solid ${C.line}` }}>
          <PlaceThumb place={p} list={list} onClick={abrirFotos} />
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center', padding: '7px 9px', borderTop: `1px solid ${C.line}` }}>
            {p.rating != null && (
              <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 3, color: C.coral, lineHeight: 1, marginRight: 2 }}>
                <span style={{ fontSize: 11 }}>★</span>
                <span style={{ fontFamily: 'var(--display-font)', fontSize: 16, fontWeight: 400 }}>{p.rating}</span>
              </div>
            )}
            {p.category && tagMini(p.category)}
            {p.avg_price != null && tagMini(`R$ ${Number(p.avg_price).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)}
            {p.distanceKm != null && tagMini(p.distanceKm < 1 ? `${Math.round(p.distanceKm * 1000)} m` : `${p.distanceKm.toFixed(1)} km`)}
            {outrasListas.map(outra => tagMini(`${outra.emoji} ${outra.name}`, outra.color))}
            {semNadaNoRodape && <span style={{ fontSize: 9.5, fontWeight: 600, color: C.sub }}>sem nota ainda</span>}
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', padding: '11px 13px 10px' }}>
          <div style={{ fontFamily: 'var(--display-font)', fontWeight: 400, fontSize: 15.5, letterSpacing: .3, textTransform: 'uppercase', color: C.ink, lineHeight: 1.15, overflowWrap: 'anywhere' }}>
            {p.name}
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, flexWrap: 'wrap', marginTop: 3 }}>
            <AddressLink place={p} fontSize={11.5} />
            {p.instagram && (
              <React.Fragment>
                <span style={{ color: C.sub, fontSize: 11.5, fontWeight: 500 }}>/</span>
                <InstagramButton handle={p.instagram} compacto />
              </React.Fragment>
            )}
          </div>

          <div className="resenha-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', marginTop: 8, paddingRight: 4 }}>
            {!expanded && p.description && (
              <RichText html={p.description} style={{ fontSize: 13, fontWeight: 500, color: C.ink, lineHeight: 1.45 }} />
            )}
          </div>

          <div style={{ display: 'flex', gap: 5, alignItems: 'center', justifyContent: 'flex-end', marginTop: 7 }}>
            {nFotos > 0 && (
              <span style={{ marginRight: 'auto', fontSize: 9.5, fontWeight: 700, color: C.sub }}>
                {nFotos} {nFotos === 1 ? 'foto' : 'fotos'}
              </span>
            )}
            <Button onClick={ev => { ev.stopPropagation(); onOpenMap(p); }} title="Ver no mapa" className="rounded-3xl font-semibold cursor-pointer transition inline-flex items-center justify-center gap-1.5 border-none bg-surface text-coral border border-line shadow-sm hover:bg-cream px-2.5 py-1 text-[10.5px] shrink-0">
              <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                <path d="M8 14.5S13 9 13 5.6A5 5 0 0 0 3 5.6C3 9 8 14.5 8 14.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                <circle cx="8" cy="5.5" r="1.8" fill="currentColor" />
              </svg>
            </Button>
            <Button onClick={ev => { ev.stopPropagation(); onToggle(); }} title={expanded ? 'Fechar' : (canEdit ? 'Editar este lugar' : 'Ver detalhes')} className="rounded-3xl font-semibold cursor-pointer transition inline-flex items-center justify-center gap-1.5 border-none bg-surface text-coral border border-line shadow-sm hover:bg-cream px-2.5 py-1 text-[10.5px] shrink-0">{expanded ? 'fechar ▴' : (canEdit ? 'editar ▾' : 'detalhes ▾')}</Button>
          </div>
        </div>
      </div>

      <div style={{ padding: expanded ? '2px 14px 12px' : 0 }}>
        {expanded && (
          <React.Fragment>
            <div style={{ maxHeight: 340, overflowY: 'auto', marginTop: 10, paddingRight: 2 }}>
              {canEdit ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {field('Descrição', (
                    <RichTextEditor value={p.description} onChange={v => set('description', v)}
                      placeholder="Como é o lugar, o que pedir, vibe geral…" minHeight={64} />
                  ))}
                  <div style={{ display: 'flex', gap: 8 }}>
                    {field('Categoria', <input value={draft.category} onChange={e => set('category', e.target.value)} placeholder="Ex: Bar" style={inputStyle} />)}
                    {field('Nota', <input type="number" min="0" max="10" step="0.5" value={draft.rating} onChange={e => set('rating', e.target.value)} placeholder="—" style={inputStyle} />)}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {field('Valor médio (R$)', <input type="number" min="0" step="0.01" value={draft.avg_price} onChange={e => set('avg_price', e.target.value)} placeholder="—" style={inputStyle} />)}
                  </div>
                  {field('Instagram', <input value={draft.instagram} onChange={e => set('instagram', e.target.value)} placeholder="@dolugar" style={inputStyle} />)}
                  {field('Listas', (
                    <ListPicker lists={todasListas} selecionadas={draft.list_ids} compacto
                      onAlternar={id => set('list_ids', draft.list_ids.includes(id) ? draft.list_ids.filter(x => x !== id) : [...draft.list_ids, id])} />
                  ))}
                </div>
              ) : p.description && (
                <RichText html={p.description} style={{ fontSize: 13, fontWeight: 500, color: C.ink, background: C.cream, borderRadius: 10, padding: '8px 12px', lineHeight: 1.45 }} />
              )}

              <PhotoGallery photos={p.photos} canEdit={canEdit} edits={photoEdits} onEdit={editPhoto}
                onReorder={ids => onReorderPhotos(p.id, ids)}
                onAdd={(file, title) => onAddPhoto(p.id, file, title)}
                onRemove={photo => onRemovePhoto(p.id, photo)}
                coverId={(coverPhoto(p) || {}).id}
                onSetCover={onSetCover && (photoId => onSetCover(p.id, photoId))} />
            </div>

            {canEdit && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.line}` }}>
                <Button onClick={save} disabled={!dirty || saving} className="rounded-3xl font-semibold cursor-pointer transition inline-flex items-center justify-center gap-1.5 border-none bg-coral text-white shadow-md hover:opacity-85 px-5 py-2.5 text-[13px] disabled:opacity-45 disabled:cursor-default">{saving ? 'Salvando…' : 'Salvar'}</Button>
                {dirty && !saving && (
                  <Button onClick={cancel} className="rounded-3xl font-semibold cursor-pointer transition inline-flex items-center justify-center gap-1.5 border-none bg-cream text-ink shadow-md hover:opacity-80 px-5 py-2.5 text-[13px]">Desfazer</Button>
                )}
                <div style={{ flex: 1 }} />
                {(p.list_ids || []).length > 1 && (
                  <Button onClick={() => onRemoveFromList(p)} title={`Continua nas outras ${(p.list_ids || []).length - 1} listas`} className="rounded-3xl font-semibold cursor-pointer transition inline-flex items-center justify-center gap-1.5 border-none bg-cream text-ink shadow-md hover:opacity-80 px-5 py-2.5 text-[13px] !text-sub">Tirar desta lista</Button>
                )}
                <Button onClick={() => onRemove(p.id)} title="Apaga o lugar de todas as listas" className="rounded-3xl font-semibold cursor-pointer transition inline-flex items-center justify-center gap-1.5 border-none bg-transparent text-[#FF6B5B] hover:bg-[#FF6B5B]/10 px-3 py-1.5 text-[12px] shadow-none">Excluir</Button>
              </div>
            )}
          </React.Fragment>
        )}
      </div>

      {fotoAberta && (
        <PhotoLightbox photos={p.photos} openId={fotoAberta} onSetId={setFotoAberta} onClose={() => setFotoAberta(null)} />
      )}
    </WindowCard>
  );
}

function ListDetail({ list, places, todasListas, origem, onBack, onOpen, onRemove, onRemoveFromList, onShare, onSavePlace, onAddPhoto, onRemovePhoto, onReorderPhotos, onSetCover, onBuildItinerary, onAddPlace, onDeleteList, menuDaLista, canEdit, variant }) {
  const C = getTheme();
  const isPanel = variant === 'panel';
  const [menu, abrirMenu, fecharMenu] = useContextMenu();
  const [expandedId, setExpandedId] = useState(null);
  const [sortBy, setSortBy] = useState('padrao');
  const [sortDir, setSortDir] = useState('asc');

  const hasCategories = places.some(p => p.category);
  const hasRatings = places.some(p => p.rating != null);
  const hasPrices = places.some(p => p.avg_price != null);

  const sortOptions = useMemo(() => {
    const opts = ['padrao'];
    if (hasRatings) opts.push('nota');
    if (hasCategories) opts.push('categoria');
    if (hasPrices) opts.push('valor');
    if (origem) opts.push('distancia');
    return opts;
  }, [hasCategories, hasRatings, hasPrices, origem]);

  useEffect(() => {
    if (!sortOptions.includes(sortBy)) setSortBy('padrao');
  }, [sortOptions]);

  const withDistance = useMemo(() => places.map(p => ({
    ...p,
    distanceKm: origem ? haversineKm(origem.latitude, origem.longitude, p.latitude, p.longitude) : null,
  })), [places, origem]);

  const sortedPlaces = useMemo(() => {
    if (sortBy === 'padrao') return withDistance;
    const dir = sortDir === 'asc' ? 1 : -1;
    const sorted = [...withDistance];
    if (NUMERIC_SORT_ACCESSORS[sortBy]) {
      const accessor = NUMERIC_SORT_ACCESSORS[sortBy];
      sorted.sort((a, b) => {
        const av = accessor(a), bv = accessor(b);
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        return (av - bv) * dir;
      });
    } else if (sortBy === 'categoria') {
      sorted.sort((a, b) => {
        if (!a.category && !b.category) return 0;
        if (!a.category) return 1;
        if (!b.category) return -1;
        return a.category.localeCompare(b.category, 'pt-BR') * dir;
      });
    }
    return sorted;
  }, [withDistance, sortBy, sortDir]);

  const SEM_CATEGORIA = 'Sem categoria';
  const nomeCategoria = (p) => ((p.category || '').trim() || SEM_CATEGORIA);

  const secoes = useMemo(() => {
    if (sortBy !== 'categoria') return [{ titulo: null, itens: sortedPlaces }];
    const nomes = [];
    sortedPlaces.forEach(p => {
      const c = nomeCategoria(p);
      if (!nomes.includes(c)) nomes.push(c);
    });
    return nomes.map(c => ({ titulo: c, itens: sortedPlaces.filter(p => nomeCategoria(p) === c) }));
  }, [sortedPlaces, sortBy]);

  return (
    <div style={isPanel
      ? { position: 'relative', height: '100%', boxSizing: 'border-box', background: C.paper, overflow: 'auto', padding: '20px 20px 40px' }
      : { position: 'absolute', inset: 0, zIndex: 650, background: C.paper, overflow: 'auto', padding: '62px 20px 120px' }}>
      <Button onClick={onBack} className="rounded-3xl font-semibold cursor-pointer transition inline-flex items-center justify-center gap-1.5 border-none bg-transparent text-coral hover:opacity-70 px-3 py-1.5 text-[14px] shadow-none mb-3 self-start">‹ Listas</Button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}
        onContextMenu={menuDaLista ? abrirMenu(list.id) : undefined}>
        <div style={{ width: 52, height: 52, borderRadius: 16, background: list.color + '22', border: `1px solid ${list.color}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>{list.emoji}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--display-font)', fontSize: 21, fontWeight: 400, color: C.ink, lineHeight: 1.15 }}>{list.name}</div>
          <div style={{ color: C.sub, fontWeight: 500, fontSize: 13 }}>{places.length} {places.length === 1 ? 'lugar' : 'lugares'}</div>
        </div>
        {canEdit && onAddPlace && <AddButton rotulo="Adicionar novo lugar" onClick={onAddPlace} />}
        {canEdit && (
          <Button onClick={onShare} className="rounded-3xl font-semibold cursor-pointer transition inline-flex items-center justify-center gap-1.5 border-none bg-surface text-coral border border-line shadow-sm hover:bg-cream px-4 py-2 text-[12px]">
            {list.is_public ? 'Copiar link' : 'Tornar pública e compartilhar'}
          </Button>
        )}
      </div>

      {onBuildItinerary && places.length > 1 && (
        <Button onClick={onBuildItinerary} variant="outline" size="sm" className="mt-3.5">
          🧭 Montar roteiro com esta lista
        </Button>
      )}

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 16 }}>
        <span style={{ fontWeight: 700, fontSize: 13.5, color: C.sub }}>Ordenar por</span>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{
          border: `1.5px solid ${C.line}`, background: C.surface, borderRadius: 10, padding: '7px 10px',
          fontFamily: 'Inter', fontWeight: 700, fontSize: 13, color: C.ink, cursor: 'pointer',
        }}>
          {sortOptions.map(opt => <option key={opt} value={opt}>{SORT_LABELS[opt]}</option>)}
        </select>
        {sortBy !== 'padrao' && (
          <Button onClick={() => setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))} title={sortDir === 'asc' ? 'Crescente' : 'Decrescente'} className="rounded-3xl font-semibold cursor-pointer transition inline-flex items-center justify-center gap-1.5 border-none bg-surface text-coral border border-line shadow-sm hover:bg-cream w-8 h-8 p-0">{sortDir === 'asc' ? '↑' : '↓'}</Button>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 18 }}>
        {sortedPlaces.length === 0 && <div style={{ textAlign: 'center', color: C.sub, fontWeight: 600, marginTop: 40 }}>Nenhum lugar aqui ainda</div>}
        {secoes.map(sec => (
          <React.Fragment key={sec.titulo || 'todos'}>
            {sec.titulo && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
                <span style={{ fontFamily: 'Inter', fontWeight: 800, fontSize: 12, letterSpacing: .6, textTransform: 'uppercase', color: sec.titulo === SEM_CATEGORIA ? C.sub : C.coral, flexShrink: 0 }}>
                  {sec.titulo}
                </span>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: C.sub, flexShrink: 0 }}>{sec.itens.length}</span>
                <div style={{ flex: 1, height: 1, background: C.line }} />
              </div>
            )}
            {sec.itens.map(p => (
              <PlaceRow key={p.id} place={p} list={list} todasListas={todasListas} canEdit={canEdit}
                expanded={expandedId === p.id}
                onToggle={() => setExpandedId(id => (id === p.id ? null : p.id))}
                onOpenMap={onOpen}
                onRemove={onRemove}
                onRemoveFromList={lugar => onRemoveFromList(lugar, list.id)}
                onSave={onSavePlace}
                onAddPhoto={onAddPhoto}
                onRemovePhoto={onRemovePhoto}
                onReorderPhotos={onReorderPhotos}
                onSetCover={onSetCover} />
            ))}
          </React.Fragment>
        ))}
      </div>

      {canEdit && onAddPlace && (
        <Button onClick={onAddPlace} variant="outline" size="md" className="mt-3 w-full border-dashed !py-4 !text-[14px]">
          + Adicionar novo lugar nesta lista
        </Button>
      )}

      {canEdit && onDeleteList && (
        <div style={{ marginTop: 28, paddingTop: 14, borderTop: `1px solid ${C.line}` }}>
          <Button onClick={onDeleteList} variant="danger" size="sm">Excluir esta lista</Button>
          <div style={{ marginTop: 4, fontSize: 11.5, fontWeight: 500, color: C.sub, lineHeight: 1.4 }}>
            Os lugares que só estão nesta lista são apagados junto; os que também estão em outra continuam lá.
          </div>
        </div>
      )}

      {menu && menuDaLista && (
        <ContextMenu x={menu.x} y={menu.y} itens={menuDaLista(list)} onClose={fecharMenu} />
      )}
    </div>
  );
}


function FloatingPanel({ anchor, isDesktop, children }) {
  const C = getTheme();
  const posicao = anchor === 'bottom'
    ? (isDesktop ? { bottom: 20, left: 16, width: 340 } : { bottom: 92, left: 10, right: 10 })
    : anchor === 'top-right'
      ? (isDesktop ? { top: 112, right: 16, width: 320 } : { top: 106, left: 12, right: 12 })
      : (isDesktop ? { top: 112, left: 16, width: 320 } : { top: 106, left: 12, right: 12 });
  return (
    <div style={{
      position: 'absolute', zIndex: 700, ...posicao,
      maxHeight: isDesktop ? 'calc(100% - 150px)' : '54vh',
      display: 'flex', flexDirection: 'column',
      background: C.glass, backdropFilter: 'blur(14px)',
      border: `1.5px solid ${C.line}`, borderRadius: 16,
      boxShadow: '0 14px 40px rgba(0,0,0,.35)', overflow: 'hidden',
      animation: 'sheetUp .22s cubic-bezier(.2,.9,.3,1)',
    }}>
      {children}
    </div>
  );
}

function PanelHeader({ titulo, subtitulo, acoes = null, onClose }) {
  const C = getTheme();
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '12px 14px 10px', borderBottom: `1px solid ${C.line}`, flexShrink: 0 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'var(--display-font)', fontWeight: 400, fontSize: 15, color: C.ink }}>{titulo}</div>
        {subtitulo && <div style={{ fontSize: 12, fontWeight: 600, color: C.sub, marginTop: 2 }}>{subtitulo}</div>}
      </div>
      {acoes}
      <Button onClick={onClose} variant="ghost" size="sm" className="!px-2 !py-1 shrink-0">✕</Button>
    </div>
  );
}

function Chip({ ativo, onClick, children, cor = null }) {
  const C = getTheme();
  const destaque = cor || C.coral;
  return (
    <button type="button" onClick={onClick} style={{
      fontSize: 12, fontWeight: 700, cursor: 'pointer', borderRadius: 999, padding: '5px 11px',
      background: ativo ? destaque + '26' : C.cream, color: ativo ? destaque : C.sub,
      border: `1px solid ${ativo ? destaque + '66' : 'transparent'}`, transition: 'background .12s',
    }}>{children}</button>
  );
}

const RECADO_GPS = {
  off: 'desligado',
  pedindo: 'procurando sinal…',
  negado: 'o navegador bloqueou — libere a localização nas permissões do site',
  erro: 'não deu pra pegar o sinal agora',
  indisponivel: 'este navegador não tem geolocalização',
};

function OriginPanel({
  origem, onOrigem, gpsEstado, gpsPos, onLigarGps, onDesligarGps,
  home, canEdit, onDefinirCasa, onCentralizar, onClose, isDesktop,
}) {
  const C = getTheme();
  const gpsLigado = gpsEstado === 'ligado';

  const opcao = (valor, icone, titulo, situacao, acoes, aoEscolher) => {
    const escolhida = origem === valor;
    return (
      <div style={{
        border: `1.5px solid ${escolhida ? C.coral + '66' : C.line}`, borderRadius: 12, padding: '10px 12px',
        background: escolhida ? C.coral + '12' : C.surface,
      }}>
        <button type="button" onClick={aoEscolher} style={{
          display: 'flex', alignItems: 'center', gap: 9, width: '100%', background: 'transparent',
          border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left',
        }}>
          <span style={{ fontSize: 17, flexShrink: 0 }}>{icone}</span>
          <span style={{ flex: 1, fontFamily: 'Inter', fontWeight: 700, fontSize: 13.5, color: C.ink }}>{titulo}</span>
          {escolhida && <span style={{ fontSize: 13, fontWeight: 800, color: C.coral, flexShrink: 0 }}>✓</span>}
        </button>
        <div style={{ fontSize: 11.5, fontWeight: 600, color: C.sub, marginTop: 4, lineHeight: 1.4 }}>{situacao}</div>
        {acoes && <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>{acoes}</div>}
      </div>
    );
  };

  return (
    <FloatingPanel anchor="top-right" isDesktop={isDesktop}>
      <PanelHeader titulo="Referência" subtitulo="de onde o Mipas mede as distâncias" onClose={onClose} />

      <div style={{ overflow: 'auto', padding: '12px 14px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {opcao(
          'gps', '📍', 'Onde estou',
          gpsLigado
            ? `ligado · precisão de ${gpsPos && gpsPos.accuracy ? Math.round(gpsPos.accuracy) : '?'} m`
            : RECADO_GPS[gpsEstado] || RECADO_GPS.off,
          gpsLigado ? (
            <React.Fragment>
              <Button onClick={onCentralizar} variant="outline" size="xs">Centralizar no mapa</Button>
              <Button onClick={onDesligarGps} variant="ghost" size="xs">Desligar</Button>
            </React.Fragment>
          ) : (gpsEstado !== 'indisponivel' && (
            <Button onClick={onLigarGps} variant="outline" size="xs" disabled={gpsEstado === 'pedindo'}>
              {gpsEstado === 'pedindo' ? 'Procurando…' : 'Ligar localização'}
            </Button>
          )),
          () => { onOrigem('gps'); if (gpsEstado === 'off' || gpsEstado === 'erro') onLigarGps(); },
        )}

        {canEdit && opcao(
          'home', '🏠', 'Minha casa',
          home ? `definida em ${home.latitude.toFixed(4)}, ${home.longitude.toFixed(4)}` : 'ainda não definida',
          <Button onClick={onDefinirCasa} variant="outline" size="xs">{home ? 'Alterar' : 'Definir casa'}</Button>,
          () => onOrigem('home'),
        )}

        <div style={{ fontSize: 11.5, fontWeight: 600, color: C.sub, lineHeight: 1.45 }}>
          {canEdit
            ? 'A localização nunca é guardada no banco — vive só neste navegador, enquanto estiver ligada.'
            : 'Sua localização fica só neste navegador: o Mipas não guarda e nem manda pra ninguém.'}
        </div>
      </div>
    </FloatingPanel>
  );
}

const NOTAS_MINIMAS = [6, 7, 8, 9];

function MapLayersPanel({
  lists, places, hiddenListIds, onToggleList, onSetHidden, categories, pickedCategories,
  onToggleCategory, minRating, onMinRating, visibleCount, onReset, onClose, isDesktop, filtrando,
}) {
  const C = getTheme();
  const temNotas = places.some(p => p.rating != null);
  const semLista = places.filter(p => (p.list_ids || []).length === 0).length;

  return (
    <FloatingPanel anchor="top" isDesktop={isDesktop}>
      <PanelHeader
        titulo="Camadas do mapa"
        subtitulo={`${visibleCount} de ${places.length} ${places.length === 1 ? 'lugar aparecendo' : 'lugares aparecendo'}`}
        onClose={onClose} />

      <div style={{ overflow: 'auto', padding: '10px 14px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: .5, textTransform: 'uppercase', color: C.sub, flex: 1 }}>Listas</div>
          <Button onClick={() => onSetHidden([])} variant="plain" size="xs" disabled={hiddenListIds.length === 0}>Todas</Button>
          <Button onClick={() => onSetHidden(lists.map(l => l.id))} variant="plain" size="xs" disabled={hiddenListIds.length === lists.length}>Nenhuma</Button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {lists.map(l => {
            const visivel = !hiddenListIds.includes(l.id);
            const quantos = places.filter(p => (p.list_ids || []).includes(l.id)).length;
            return (
              <label key={l.id} style={{
                display: 'flex', alignItems: 'center', gap: 9, padding: '7px 8px', cursor: 'pointer',
                borderRadius: 10, background: visivel ? l.color + '14' : 'transparent', opacity: visivel ? 1 : .5,
              }}>
                <input type="checkbox" checked={visivel} onChange={() => onToggleList(l.id)}
                  style={{ accentColor: l.color, width: 15, height: 15, cursor: 'pointer' }} />
                <span style={{ fontSize: 15 }}>{l.emoji}</span>
                <span style={{ flex: 1, minWidth: 0, fontFamily: 'Inter', fontWeight: 700, fontSize: 13, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name}</span>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: C.sub }}>{quantos}</span>
              </label>
            );
          })}
          {semLista > 0 && (
            <div style={{ fontSize: 11.5, fontWeight: 600, color: C.sub, padding: '6px 8px 0' }}>
              {semLista} {semLista === 1 ? 'lugar sem lista continua no mapa' : 'lugares sem lista continuam no mapa'}
            </div>
          )}
        </div>

        {categories.length > 0 && (
          <React.Fragment>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: .5, textTransform: 'uppercase', color: C.sub, margin: '14px 0 7px' }}>Categoria</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {categories.map(c => (
                <Chip key={c} ativo={pickedCategories.includes(c)} onClick={() => onToggleCategory(c)}>{c}</Chip>
              ))}
            </div>
          </React.Fragment>
        )}

        {temNotas && (
          <React.Fragment>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: .5, textTransform: 'uppercase', color: C.sub, margin: '14px 0 7px' }}>Nota mínima</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Chip ativo={minRating == null} onClick={() => onMinRating(null)}>Qualquer</Chip>
              {NOTAS_MINIMAS.map(n => (
                <Chip key={n} ativo={minRating === n} onClick={() => onMinRating(minRating === n ? null : n)}>★ {n}+</Chip>
              ))}
            </div>
            {minRating != null && (
              <div style={{ fontSize: 11.5, fontWeight: 600, color: C.sub, marginTop: 6, lineHeight: 1.4 }}>
                Lugares sem nota ficam de fora enquanto isto estiver ligado.
              </div>
            )}
          </React.Fragment>
        )}

        {filtrando && (
          <Button onClick={onReset} variant="secondary" size="sm" className="mt-3.5 w-full">Limpar filtros</Button>
        )}
      </div>
    </FloatingPanel>
  );
}

const MODOS_ROTEIRO = [
  { valor: 'walking', rotulo: '🚶 A pé' },
  { valor: 'driving', rotulo: '🚗 De carro' },
];

function Toggle({ ligado, onClick, children }) {
  const C = getTheme();
  return (
    <button type="button" onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none',
      padding: 0, cursor: 'pointer', textAlign: 'left',
    }}>
      <div style={{ width: 32, height: 19, borderRadius: 999, background: ligado ? C.coral : C.line, position: 'relative', transition: 'background .15s', flexShrink: 0 }}>
        <div style={{ position: 'absolute', top: 2, left: ligado ? 15 : 2, width: 15, height: 15, borderRadius: 999, background: '#fff', transition: 'left .15s' }} />
      </div>
      <span style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 12.5, color: C.sub }}>{children}</span>
    </button>
  );
}

function ItineraryPanel({
  candidatos, lists, stopIds, ordenados, offset, onToggleStop, onMoveStop, onClearStops,
  mode, onMode, optimize, onOptimize, fromOrigin, onFromOrigin, origemTipo, itinerary, loading,
  onClose, isDesktop, maxParadas,
}) {
  const C = getTheme();
  const [busca, setBusca] = useState('');

  const paradas = ordenados.map(id => candidatos.find(p => p.id === id)).filter(Boolean);
  const cheio = stopIds.length >= maxParadas;

  const termo = busca.trim().toLowerCase();
  const disponiveis = candidatos
    .filter(p => !stopIds.includes(p.id))
    .filter(p => !termo || `${p.name} ${p.category || ''}`.toLowerCase().includes(termo));

  const trechoAte = (posicao) => (itinerary && posicao > 0 ? itinerary.legs[posicao - 1] : null);

  const linhaPonto = (posicao, icone, titulo, subtitulo, acoes) => {
    const leg = trechoAte(posicao);
    return (
      <React.Fragment key={`${posicao}-${titulo}`}>
        {leg && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0 3px 13px', fontSize: 11.5, fontWeight: 700, color: C.sub }}>
            <span style={{ width: 2, height: 14, background: C.line, borderRadius: 2 }} />
            {formatMinutes(leg.minutes)} · {formatKm(leg.km)}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{
            width: 24, height: 24, borderRadius: 999, flexShrink: 0, background: ROUTE_COLORS[mode], color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800,
          }}>{posicao + 1}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 13, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {icone} {titulo}
            </div>
            {subtitulo && <div style={{ fontSize: 11.5, fontWeight: 600, color: C.sub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subtitulo}</div>}
          </div>
          {acoes}
        </div>
      </React.Fragment>
    );
  };

  return (
    <FloatingPanel anchor="bottom" isDesktop={isDesktop}>
      <PanelHeader
        titulo="Roteiro"
        subtitulo={itinerary
          ? `${paradas.length} ${paradas.length === 1 ? 'parada' : 'paradas'} · ${formatKm(itinerary.km)} · ${formatMinutes(itinerary.minutes)}`
          : (loading ? 'traçando…' : 'escolha as paradas e o Mipas liga os pontos')}
        acoes={stopIds.length > 0 && (
          <Button onClick={onClearStops} variant="ghost" size="sm" className="!px-2 !py-1 shrink-0" tooltip="Apagar o roteiro do mapa">Limpar</Button>
        )}
        onClose={onClose} />

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', padding: '10px 14px', borderBottom: `1px solid ${C.line}`, flexShrink: 0 }}>
        {MODOS_ROTEIRO.map(m => (
          <Chip key={m.valor} ativo={mode === m.valor} cor={ROUTE_COLORS[m.valor]} onClick={() => onMode(m.valor)}>{m.rotulo}</Chip>
        ))}
        <div style={{ flex: 1 }} />
        <Toggle ligado={optimize} onClick={() => onOptimize(!optimize)}>Melhor ordem</Toggle>
        {origemTipo && (
          <Toggle ligado={fromOrigin} onClick={() => onFromOrigin(!fromOrigin)}>
            {origemTipo === 'gps' ? 'Sair daqui' : 'Sair de casa'}
          </Toggle>
        )}
      </div>

      <div style={{ overflow: 'auto', padding: '12px 14px 14px' }}>
        {stopIds.length === 0 && !fromOrigin && (
          <div style={{ fontSize: 12.5, fontWeight: 600, color: C.sub, lineHeight: 1.5, marginBottom: 12 }}>
            Toque nos pins do mapa ou escolha abaixo. A partir de duas paradas o trajeto aparece desenhado.
          </div>
        )}

        {(paradas.length > 0 || fromOrigin) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 14 }}>
            {fromOrigin && origemTipo && linhaPonto(
              0,
              origemTipo === 'gps' ? '📍' : '🏠',
              origemTipo === 'gps' ? 'Onde estou' : 'Sua casa',
              'ponto de partida',
              null,
            )}
            {paradas.map((p, i) => linhaPonto(i + offset, '', p.name, p.category || shortAddress(p.address), (
              <div style={{ display: 'flex', gap: 2, alignItems: 'center', flexShrink: 0 }}>
                {!optimize && (
                  <React.Fragment>
                    <Button onClick={() => onMoveStop(p.id, -1)} disabled={i === 0} variant="ghost" size="sm" className="!px-1.5 !py-1" tooltip="Subir">↑</Button>
                    <Button onClick={() => onMoveStop(p.id, 1)} disabled={i === paradas.length - 1} variant="ghost" size="sm" className="!px-1.5 !py-1" tooltip="Descer">↓</Button>
                  </React.Fragment>
                )}
                <Button onClick={() => onToggleStop(p.id)} variant="ghost" size="sm" className="!px-1.5 !py-1" tooltip="Tirar do roteiro">✕</Button>
              </div>
            )))}
          </div>
        )}

        {itinerary && itinerary.estimated && (
          <div style={{ fontSize: 11.5, fontWeight: 600, color: C.sub, lineHeight: 1.4, marginBottom: 12 }}>
            O roteador não respondeu — os trechos tracejados são estimativa por linha reta.
          </div>
        )}

        {optimize && paradas.length > 2 && (
          <div style={{ fontSize: 11.5, fontWeight: 600, color: C.sub, lineHeight: 1.4, marginBottom: 12 }}>
            A ordem é calculada pra encurtar o caminho. Desligue "Melhor ordem" pra montar na mão.
          </div>
        )}

        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: .5, textTransform: 'uppercase', color: C.sub, marginBottom: 7 }}>
          {cheio ? `Máximo de ${maxParadas} paradas` : 'Adicionar parada'}
        </div>

        {!cheio && (
          <React.Fragment>
            {candidatos.length > 6 && (
              <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar lugar…" style={{
                width: '100%', boxSizing: 'border-box', marginBottom: 6, background: C.surface,
                border: `1px solid ${C.line}`, borderRadius: 10, padding: '8px 12px', fontSize: 13, fontWeight: 600, color: C.ink,
              }} />
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {disponiveis.slice(0, 30).map(p => {
                const lista = lists.find(l => (p.list_ids || []).includes(l.id));
                return (
                  <button key={p.id} type="button" onClick={() => onToggleStop(p.id)} style={{
                    display: 'flex', alignItems: 'center', gap: 9, padding: '7px 8px', borderRadius: 10,
                    background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%',
                  }}>
                    <span style={{ fontSize: 15, flexShrink: 0 }}>{lista ? lista.emoji : '📍'}</span>
                    <span style={{ flex: 1, minWidth: 0, fontFamily: 'Inter', fontWeight: 700, fontSize: 13, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: C.coral, flexShrink: 0 }}>＋</span>
                  </button>
                );
              })}
              {disponiveis.length === 0 && (
                <div style={{ fontSize: 12.5, fontWeight: 600, color: C.sub, padding: '8px 0' }}>
                  {candidatos.length === 0 ? 'Nenhum lugar visível no mapa — reveja as camadas.' : 'Todos os lugares visíveis já estão no roteiro.'}
                </div>
              )}
            </div>
          </React.Fragment>
        )}
      </div>
    </FloatingPanel>
  );
}

function PlaceHit({ place, lists, onClick }) {
  const C = getTheme();
  const doLugar = (place.list_ids || []).map(id => lists.find(l => l.id === id)).filter(Boolean);
  return (
    <div onClick={onClick} className="flex cursor-pointer items-center gap-3 rounded-lg border-b border-line px-2 py-3 last:border-b-0 hover:bg-cream">
      <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px]"
        style={{ background: (doLugar[0] ? doLugar[0].color : C.coral) + '22', fontSize: 17 }}>
        {doLugar[0] ? doLugar[0].emoji : '📍'}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="truncate text-[14px] font-bold text-ink">{place.name}</div>
        <div className="truncate text-[12px] font-medium text-sub">
          {[place.category, doLugar.map(l => l.name).join(', '), shortAddress(place.address)].filter(Boolean).join(' · ')}
        </div>
      </div>
      {place.rating != null && (
        <div style={{ flexShrink: 0, fontSize: 12, fontWeight: 700, color: C.coral }}>★ {place.rating}</div>
      )}
    </div>
  );
}

export {
  Btn,
  SaveSheet,
  ListSheet,
  HomeSheet,
  PlaceCard,
  ListsPanel,
  ListDetail,
  WishPanel,
  WishSheet,
  MapLayersPanel,
  ItineraryPanel,
  OriginPanel,
  PlaceHit,
  gradientForPlace,
};
