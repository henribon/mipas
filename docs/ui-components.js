window.Mipas = window.Mipas || {};

window.Mipas.computeRanks = function (places) {
  const comNota = (places || []).filter(p => p.rating != null)
    .sort((a, b) => (b.rating - a.rating) || String(a.name).localeCompare(String(b.name), 'pt-BR'));
  const ranks = {};
  let posicao = 0;
  let notaAnterior = null;
  comNota.forEach((p, i) => {
    if (notaAnterior === null || Number(p.rating) !== Number(notaAnterior)) {
      posicao = i + 1;
      notaAnterior = p.rating;
    }
    ranks[p.id] = posicao;
  });
  return ranks;
};

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

window.Mipas.sanitizeRichHtml = function (html) {
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
  return <div style={style} dangerouslySetInnerHTML={{ __html: window.Mipas.sanitizeRichHtml(html) }} />;
}

function RichTextEditor({ value, onChange, placeholder, minHeight }) {
  const { useRef, useEffect } = React;
  const C = window.Mipas.theme;
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
    onChange(window.Mipas.sanitizeRichHtml(html));
  };

  const botao = (rotulo, aoClicar, estilo) => (
    <button type="button" onMouseDown={ev => ev.preventDefault()} onClick={aoClicar} style={{
      border: `1px solid ${C.line}`, background: C.cream, color: C.ink, borderRadius: 8,
      minWidth: 30, height: 28, cursor: 'pointer', fontFamily: 'Inter', fontSize: 13, padding: '0 8px', ...estilo,
    }}>{rotulo}</button>
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

function Btn({ children, onClick, primary, style, disabled }) {
  const C = window.Mipas.theme;
  return (
    <button onClick={onClick} disabled={disabled} style={{
      border: 'none', cursor: disabled ? 'default' : 'pointer', borderRadius: 12, padding: '14px 18px',
      fontFamily: 'Inter', fontSize: 15, fontWeight: 700,
      background: primary ? C.coral : C.cream, color: primary ? '#fff' : C.ink,
      opacity: disabled ? .5 : 1, ...style,
    }}>{children}</button>
  );
}

function DraftPhotos({ photos, onChange }) {
  const { useRef } = React;
  const C = window.Mipas.theme;
  const inputRef = useRef(null);

  const escolher = (ev) => {
    const arquivos = Array.from(ev.target.files || []);
    if (arquivos.length) {
      onChange([...photos, ...arquivos.map(file => ({ file, preview: URL.createObjectURL(file), title: '' }))]);
    }
    ev.target.value = '';
  };
  const remover = (i) => {
    URL.revokeObjectURL(photos[i].preview);
    onChange(photos.filter((_, idx) => idx !== i));
  };
  const renomear = (i, title) => onChange(photos.map((p, idx) => (idx === i ? { ...p, title } : p)));

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 7, alignItems: 'flex-start' }}>
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
      <button type="button" onClick={() => inputRef.current.click()} style={{
        width: 96, height: 72, borderRadius: 10, border: `1.5px dashed ${C.coral}66`,
        background: 'none', color: C.coral, fontSize: 22, fontWeight: 700, cursor: 'pointer',
      }}>+</button>
      <input ref={inputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={escolher} />
    </div>
  );
}

function ListPicker({ lists, selecionadas, onAlternar, onNewList, compacto }) {
  const { useState } = React;
  const C = window.Mipas.theme;
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
              <button key={id} onClick={() => onAlternar(id)} title="Tirar desta lista" style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${l.color}66`,
                background: l.color + '1E', color: l.color, borderRadius: 999, padding: '4px 10px',
                fontFamily: 'Inter', fontWeight: 700, fontSize: 12, cursor: 'pointer',
              }}>{l.emoji} {l.name} <span style={{ opacity: .7 }}>✕</span></button>
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
      <div style={{ maxHeight: compacto ? 132 : 176, overflowY: 'auto', border: `1px solid ${C.line}`, borderRadius: 12, background: C.surface }}>
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
        <button onClick={onNewList} style={{
          marginTop: 6, width: '100%', boxSizing: 'border-box', border: `1.5px dashed ${C.coral}66`,
          borderRadius: 10, padding: '9px', background: 'none', color: C.coral,
          fontFamily: 'Inter', fontWeight: 700, fontSize: 13, cursor: 'pointer',
        }}>+ Nova lista</button>
      )}
    </div>
  );
}

function SaveSheet({ draft, setDraft, lists, onNewList, onCancel, onSave, saving }) {
  const C = window.Mipas.theme;
  const set = (k, v) => setDraft(d => ({ ...d, [k]: v }));
  const listIds = draft.list_ids || [];
  const alternaLista = (id) => set('list_ids', listIds.includes(id) ? listIds.filter(x => x !== id) : [...listIds, id]);
  const canSave = draft.name.trim() && listIds.length > 0 && !saving;
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 850 }}>
      <div onClick={onCancel} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.55)', animation: 'fadeIn .2s' }} />
      <div className="mipas-sheet" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, background: C.paper, border: `1px solid ${C.line}`, borderRadius: '20px 20px 0 0', padding: '10px 20px 28px', maxHeight: '86%', overflow: 'auto', animation: 'sheetUp .3s cubic-bezier(.2,.9,.3,1)' }}>
        <div style={{ width: 36, height: 4, borderRadius: 99, background: C.line, margin: '0 auto 14px' }} />
        <div style={{ fontFamily: 'Inter', fontSize: 19, fontWeight: 700, color: C.ink }}>Guardar esse lugar</div>
        <div style={{ color: C.sub, fontWeight: 500, fontSize: 13, marginTop: 3, lineHeight: 1.4 }}>{draft.address}</div>
        <div style={{ marginTop: 16, fontWeight: 700, fontSize: 13, color: C.ink }}>Dê um nome só seu</div>
        <input autoFocus value={draft.name} onChange={e => set('name', e.target.value)} placeholder='Ex: "Melhor pastel da cidade"'
          style={{ width: '100%', boxSizing: 'border-box', marginTop: 7, background: C.surface, border: `1.5px solid ${C.line}`, borderRadius: 12, padding: '13px 16px', fontSize: 15, fontWeight: 600, color: C.ink }} />
        <div style={{ marginTop: 14, fontWeight: 700, fontSize: 13, color: C.ink }}>Em quais listas? <span style={{ color: C.sub, fontWeight: 500 }}>(pode ser mais de uma)</span></div>
        <ListPicker lists={lists} selecionadas={listIds} onAlternar={alternaLista} onNewList={onNewList} />
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

function NewListSheet({ onCancel, onCreate, creating }) {
  const { useState } = React;
  const C = window.Mipas.theme;
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('📍');
  const [color, setColor] = useState(window.Mipas.listColors[0]);
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 900 }}>
      <div onClick={onCancel} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.55)', animation: 'fadeIn .2s' }} />
      <div className="mipas-sheet" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, background: C.paper, border: `1px solid ${C.line}`, borderRadius: '20px 20px 0 0', padding: '10px 20px 28px', animation: 'sheetUp .3s cubic-bezier(.2,.9,.3,1)' }}>
        <div style={{ width: 36, height: 4, borderRadius: 99, background: C.line, margin: '0 auto 14px' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: color + '22', border: `1px solid ${color}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{emoji || '?'}</div>
          <div style={{ fontFamily: 'Inter', fontSize: 19, fontWeight: 700, color: C.ink }}>Nova lista</div>
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
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          {window.Mipas.listColors.map(c => (
            <button key={c} onClick={() => setColor(c)} style={{
              width: 32, height: 32, borderRadius: 99, background: c, cursor: 'pointer',
              border: `3px solid ${color === c ? C.ink : C.surface}`,
            }} />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <Btn onClick={onCancel} style={{ flex: 1 }}>Cancelar</Btn>
          <Btn primary disabled={!name.trim() || !emoji.trim() || creating} onClick={() => name.trim() && onCreate({ name: name.trim(), emoji: emoji.trim(), color })} style={{ flex: 2 }}>{creating ? 'Criando…' : 'Criar lista'}</Btn>
        </div>
      </div>
    </div>
  );
}

function HomeSheet({ home, onCancel, onSave, onClear }) {
  const { useState, useMemo } = React;
  const C = window.Mipas.theme;
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');

  const debouncedSearch = useMemo(() => window.Mipas.debounce(async (q) => {
    if (!q.trim()) { setResults([]); return; }
    setSearching(true);
    try {
      setResults(await window.Mipas.geocodeAddress(q));
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
        <div style={{ fontFamily: 'Inter', fontSize: 19, fontWeight: 700, color: C.ink }}>Sua casa</div>
        <div style={{ color: C.sub, fontWeight: 500, fontSize: 13, marginTop: 3, lineHeight: 1.4 }}>
          Usada só pra calcular distância nas suas listas. Nunca aparece pra quem visualiza uma lista pública.
        </div>

        {home && (
          <div style={{ marginTop: 14, background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12, padding: '10px 14px', fontSize: 13, fontWeight: 600, color: C.ink, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Casa definida ({home.latitude.toFixed(4)}, {home.longitude.toFixed(4)})</span>
            <button onClick={onClear} style={{ border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'Inter', fontWeight: 700, fontSize: 12, color: '#FF6B5B' }}>Remover</button>
          </div>
        )}

        <button onClick={useCurrentLocation} disabled={locating || saving} style={{
          width: '100%', boxSizing: 'border-box', marginTop: 14, border: 'none', cursor: locating ? 'default' : 'pointer',
          borderRadius: 12, padding: '13px 16px', fontFamily: 'Inter', fontSize: 14.5, fontWeight: 700,
          background: C.coral, color: '#fff', opacity: locating || saving ? .6 : 1,
        }}>{locating ? 'Localizando…' : 'Usar minha localização atual'}</button>

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
  const C = window.Mipas.theme;
  const query = encodeURIComponent(`${place.name}, ${place.address}`);
  return (
    <a href={`https://www.google.com/maps/search/?api=1&query=${query}`}
      target="_blank" rel="noopener noreferrer" onClick={ev => ev.stopPropagation()}
      title="Abrir no Google Maps"
      style={{ color: C.sub, fontWeight: 500, fontSize, textDecoration: 'none', cursor: 'pointer' }}
      onMouseEnter={e => { e.target.style.textDecoration = 'underline'; }}
      onMouseLeave={e => { e.target.style.textDecoration = 'none'; }}>
      {window.Mipas.shortAddress(place.address)} ↗
    </a>
  );
}

function InstagramButton({ handle }) {
  const url = /^https?:\/\//i.test(handle) ? handle : 'https://instagram.com/' + handle.replace(/^@/, '');
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

function PlaceCard({ place, list, onClose }) {
  const { useState } = React;
  const C = window.Mipas.theme;
  const [openId, setOpenId] = useState(null);
  const photos = place.photos || [];
  return (
    <div style={{ position: 'absolute', left: 12, right: 12, bottom: 96, zIndex: 750, background: C.surface, border: `1px solid ${C.line}`, borderRadius: 18, boxShadow: '0 14px 40px rgba(0,0,0,.5)', overflow: 'hidden', animation: 'sheetUp .28s cubic-bezier(.2,.9,.3,1)' }}>
      <div style={{ height: 64, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', background: gradientForPlace(place, list) }}>
        <div style={{ fontFamily: 'Inter', fontWeight: 800, fontSize: 16, letterSpacing: .5, textTransform: 'uppercase', color: '#fff', textShadow: '0 1px 10px rgba(0,0,0,.5)', padding: '0 52px', maxWidth: '100%', boxSizing: 'border-box', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>
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
          {photos.length > 0 && (
            <button onClick={() => setOpenId(photos[0].id)} title="Ver as fotos" style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${C.line}`,
              background: C.cream, color: C.ink, borderRadius: 999, padding: '5px 12px',
              fontFamily: 'Inter', fontSize: 12, fontWeight: 800, letterSpacing: .4, cursor: 'pointer',
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h1.9l1.2-2h6.8l1.2 2h1.9A2.5 2.5 0 0 1 21 8.5v9A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5v-9Z" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
                <circle cx="12" cy="13" r="3.6" stroke="currentColor" strokeWidth="1.9" />
              </svg>
              FOTOS{photos.length > 1 ? ` (${photos.length})` : ''}
            </button>
          )}
        </div>
        {place.description && <RichText html={place.description} style={{ marginTop: 10, fontSize: 13.5, fontWeight: 500, color: C.ink, background: C.cream, borderRadius: 12, padding: '10px 14px', lineHeight: 1.45 }} />}
      </div>

      {openId && <PhotoLightbox photos={photos} openId={openId} onSetId={setOpenId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function ListsPanel({ lists, places, canEdit, onOpenList, onNewList, onBack, variant }) {
  const C = window.Mipas.theme;
  const isPanel = variant === 'panel';
  return (
    <div style={isPanel
      ? { position: 'relative', height: '100%', boxSizing: 'border-box', background: C.paper, overflow: 'auto', padding: '20px 20px 40px' }
      : { position: 'absolute', inset: 0, zIndex: 600, background: C.paper, overflow: 'auto', padding: '70px 20px 120px' }}>
      {onBack && (
        <button onClick={onBack} style={{ border: 'none', background: 'none', color: C.coral, fontFamily: 'Inter', fontWeight: 700, fontSize: 14, cursor: 'pointer', padding: 0, marginBottom: 12 }}>‹ Mapa</button>
      )}
      <div className="section-title" style={{ fontFamily: 'Inter', fontSize: 24, fontWeight: 700, color: C.ink }}>Minhas listas</div>
      <div style={{ color: C.sub, fontWeight: 600, fontSize: 13.5, marginTop: 2, marginBottom: 20 }}>{places.length} lugares guardados</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {lists.map(l => {
          const count = places.filter(p => (p.list_ids || []).includes(l.id)).length;
          return (
            <div key={l.id} onClick={() => onOpenList(l.id)} style={{
              display: 'flex', alignItems: 'center', gap: 14, background: C.surface, borderRadius: 16,
              padding: '16px 16px', border: `1.5px solid ${C.line}`, cursor: 'pointer',
            }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: l.color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>{l.emoji}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15.5, color: C.ink }}>{l.name}</div>
                <div style={{ color: C.sub, fontWeight: 600, fontSize: 13 }}>{count} {count === 1 ? 'lugar' : 'lugares'}</div>
              </div>
              <div style={{ width: 10, height: 10, borderRadius: 99, background: l.color }} />
            </div>
          );
        })}
        {canEdit && (
          <button onClick={onNewList} style={{
            border: `2px dashed ${C.coral}66`, background: 'none', borderRadius: 16, padding: '18px',
            fontFamily: 'Inter', fontWeight: 700, fontSize: 15, color: C.coral, cursor: 'pointer',
          }}>+ Nova lista</button>
        )}
      </div>
    </div>
  );
}

function PhotoGallery({ photos, canEdit, edits, onEdit, onAdd, onRemove, onReorder }) {
  const { useRef, useState, useEffect } = React;
  const C = window.Mipas.theme;
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

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (file) onAdd(file, pendingTitleRef.current);
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
          border: `${overId === ph.id ? 2 : 1}px solid ${overId === ph.id ? C.coral : C.line}`,
          background: C.cream, cursor: canEdit && ordered.length > 1 ? 'grab' : 'zoom-in',
        }} />
      {canEdit && (
        <button onClick={() => onRemove(ph)} onPointerDown={ev => ev.stopPropagation()} style={{ position: 'absolute', top: 3, right: 3, width: 19, height: 19, borderRadius: 99, border: 'none', background: 'rgba(0,0,0,.6)', color: '#fff', fontSize: 10, cursor: 'pointer', lineHeight: '19px', padding: 0 }}>✕</button>
      )}
    </div>
  );

  const addBtn = (title) => (
    <button onClick={() => pickFile(title)} title="Adicionar foto" style={{
      flexShrink: 0, width: 72, height: 72, borderRadius: 10,
      border: `1.5px dashed ${C.coral}66`, background: 'none', color: C.coral,
      fontSize: 22, fontWeight: 700, cursor: 'pointer',
    }}>+</button>
  );

  const draftInput = {
    width: '100%', boxSizing: 'border-box', background: C.cream, border: `1px solid ${C.line}`,
    borderRadius: 8, padding: '5px 10px', fontSize: 12, fontWeight: 600, color: C.ink,
  };

  return (
    <div onClick={ev => ev.stopPropagation()} style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
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
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
              {g.items.map(thumb)}
              {canEdit && addBtn(g.title)}
            </div>
          </div>
        );
      })}

      {(untitled.length > 0 || canEdit) && (
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', alignItems: 'flex-start' }}>
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
        </div>
      )}

      {canEdit && <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />}

      {openId && <PhotoLightbox photos={ordered} openId={openId} onSetId={setOpenId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function PhotoLightbox({ photos, openId, onSetId, onClose }) {
  const { useEffect, useState, useRef } = React;
  const [dx, setDx] = useState(0);
  const arrasto = useRef({ x0: 0, ativo: false });
  const C = window.Mipas.theme;
  const idx = Math.max(0, photos.findIndex(p => p.id === openId));
  const ph = photos[idx];
  const go = (delta) => {
    const next = photos[(idx + delta + photos.length) % photos.length];
    if (next) onSetId(next.id);
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [idx, photos.length]);

  if (!ph) return null;

  const LIMIAR = 60;
  const aoArrastarInicio = (ev) => {
    if (photos.length < 2) return;
    arrasto.current = { x0: ev.clientX, ativo: true };
    ev.currentTarget.setPointerCapture(ev.pointerId);
  };
  const aoArrastar = (ev) => {
    if (!arrasto.current.ativo) return;
    setDx(ev.clientX - arrasto.current.x0);
  };
  const aoArrastarFim = () => {
    if (!arrasto.current.ativo) return;
    const d = dx;
    arrasto.current.ativo = false;
    setDx(0);
    if (Math.abs(d) > LIMIAR) go(d < 0 ? 1 : -1);
  };

  const arrow = (dir, glyph) => (
    <button onClick={ev => { ev.stopPropagation(); go(dir); }} style={{
      position: 'absolute', top: '50%', transform: 'translateY(-50%)', [dir < 0 ? 'left' : 'right']: 14,
      width: 40, height: 40, borderRadius: 99, border: 'none', background: 'rgba(0,0,0,.55)',
      color: '#fff', fontSize: 20, fontWeight: 700, cursor: 'pointer', lineHeight: '40px', padding: 0,
    }}>{glyph}</button>
  );

  return ReactDOM.createPortal(
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(0,0,0,.9)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 24, boxSizing: 'border-box', animation: 'fadeIn .15s',
    }}>
      <img src={ph.url} alt={ph.title || ''} draggable={false}
        onClick={ev => ev.stopPropagation()}
        onPointerDown={aoArrastarInicio}
        onPointerMove={aoArrastar}
        onPointerUp={aoArrastarFim}
        onPointerCancel={aoArrastarFim}
        style={{
          maxWidth: '100%', maxHeight: 'calc(100% - 90px)', objectFit: 'contain', borderRadius: 10, display: 'block',
          touchAction: 'pan-y', transform: `translateX(${dx}px)`,
          transition: arrasto.current.ativo ? 'none' : 'transform .18s',
          cursor: photos.length > 1 ? 'grab' : 'default',
        }} />

      {(ph.title || ph.description) && (
        <div onClick={ev => ev.stopPropagation()} style={{ marginTop: 14, maxWidth: 620, textAlign: 'center' }}>
          {ph.title && <div style={{ fontFamily: 'Inter', fontSize: 15, fontWeight: 800, color: '#fff' }}>{ph.title}</div>}
          {ph.description && <div style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,.72)', marginTop: 3, lineHeight: 1.45 }}>{ph.description}</div>}
        </div>
      )}

      {photos.length > 1 && (
        <div onClick={ev => ev.stopPropagation()} style={{ marginTop: 10, fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,.55)' }}>
          {idx + 1} / {photos.length}
        </div>
      )}

      <button onClick={onClose} style={{
        position: 'absolute', top: 16, right: 16, width: 36, height: 36, borderRadius: 99, border: 'none',
        background: 'rgba(255,255,255,.15)', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', padding: 0,
      }}>✕</button>

      {photos.length > 1 && arrow(-1, '‹')}
      {photos.length > 1 && arrow(1, '›')}
    </div>,
    document.body
  );
}

const SORT_LABELS = {
  padrao: 'Padrão',
  rank: 'Rank',
  categoria: 'Categoria',
  distancia: 'Distância',
  nota: 'Nota',
  valor: 'Valor',
};

const NUMERIC_SORT_ACCESSORS = {
  distancia: p => p.distanceKm,
  nota: p => p.rating,
  valor: p => p.avg_price,
};

function PlaceRow({ place: p, list, todasListas, rank, canEdit, expanded, onToggle, onOpenMap, onRemove, onRemoveFromList, onSave, onAddPhoto, onRemovePhoto, onReorderPhotos }) {
  const { useState, useEffect, useMemo, useRef } = React;
  const C = window.Mipas.theme;

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

  return (
    <div style={{ background: C.surface, borderRadius: 16, border: `1px solid ${C.line}`, overflow: 'hidden' }}>
      <div onClick={clique} onDoubleClick={duploClique} title="Clique para abrir, duplo clique para ver no mapa"
        style={{ height: 56, background: gradientForPlace(p, list), display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', cursor: 'pointer' }}>
        <div style={{ fontFamily: 'Inter', fontWeight: 800, fontSize: 15, letterSpacing: .5, textTransform: 'uppercase', color: '#fff', textShadow: '0 1px 10px rgba(0,0,0,.5)', padding: '0 20px', maxWidth: '100%', boxSizing: 'border-box', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>
          {p.name}
        </div>
      </div>

      <div onClick={expanded ? undefined : clique} onDoubleClick={expanded ? undefined : duploClique}
        style={{ padding: '10px 14px 12px', cursor: expanded ? 'default' : 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
          <AddressLink place={p} fontSize={12.5} />
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
            <button onClick={ev => { ev.stopPropagation(); onOpenMap(p); }} title="Ver no mapa" style={{
              border: `1px solid ${C.line}`, background: C.cream, borderRadius: 999, width: 26, height: 26,
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.coral, cursor: 'pointer', padding: 0,
            }}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <path d="M8 14.5S13 9 13 5.6A5 5 0 0 0 3 5.6C3 9 8 14.5 8 14.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                <circle cx="8" cy="5.5" r="1.8" fill="currentColor" />
              </svg>
            </button>
            <button onClick={ev => { ev.stopPropagation(); onToggle(); }} title={expanded ? 'Fechar' : (canEdit ? 'Editar este lugar' : 'Ver detalhes')} style={{
              border: `1px solid ${expanded ? C.coral : C.line}`, background: expanded ? C.coral + '1E' : C.cream, borderRadius: 999, padding: '3px 10px',
              fontFamily: 'Inter', fontWeight: 700, fontSize: 11.5, color: C.coral, cursor: 'pointer',
            }}>{expanded ? 'fechar ▴' : (canEdit ? 'editar ▾' : 'detalhes ▾')}</button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
          {p.distanceKm != null && chip(p.distanceKm < 1 ? `${Math.round(p.distanceKm * 1000)} m` : `${p.distanceKm.toFixed(1)} km`)}
          {p.category && chip(p.category)}
          {p.rating != null && chip(`★ ${p.rating}`, C.coral)}
          {p.avg_price != null && chip(`R$ ${Number(p.avg_price).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)}
          {list.ranking_enabled && rank != null && chip(`#${rank}`, C.coral)}
          {p.instagram && <InstagramButton handle={p.instagram} />}
          {nFotos > 0 && chip(`${nFotos} ${nFotos === 1 ? 'foto' : 'fotos'}`)}
          {(p.list_ids || []).filter(id => id !== list.id).map(id => {
            const outra = (todasListas || []).find(l => l.id === id);
            return outra ? (
              <div key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700, color: outra.color, background: outra.color + '1E', borderRadius: 999, padding: '4px 10px' }}>
                {outra.emoji} {outra.name}
              </div>
            ) : null;
          })}
        </div>

        {!expanded && p.description && (
          <RichText html={p.description} style={{ marginTop: 8, fontSize: 12.5, fontWeight: 500, color: C.sub, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }} />
        )}

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
                onRemove={photo => onRemovePhoto(p.id, photo)} />
            </div>

            {canEdit && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.line}` }}>
                <button onClick={save} disabled={!dirty || saving} style={{
                  border: 'none', borderRadius: 10, padding: '9px 18px', fontFamily: 'Inter', fontWeight: 700, fontSize: 13,
                  background: C.coral, color: '#fff', cursor: dirty && !saving ? 'pointer' : 'default', opacity: dirty && !saving ? 1 : .45,
                }}>{saving ? 'Salvando…' : 'Salvar'}</button>
                {dirty && !saving && (
                  <button onClick={cancel} style={{ border: `1px solid ${C.line}`, background: 'none', borderRadius: 10, padding: '9px 14px', fontFamily: 'Inter', fontWeight: 700, fontSize: 13, color: C.sub, cursor: 'pointer' }}>Desfazer</button>
                )}
                <div style={{ flex: 1 }} />
                {(p.list_ids || []).length > 1 && (
                  <button onClick={() => onRemoveFromList(p)} title={`Continua nas outras ${(p.list_ids || []).length - 1} listas`} style={{
                    border: `1px solid ${C.line}`, background: 'none', borderRadius: 10, padding: '7px 12px',
                    fontFamily: 'Inter', fontWeight: 700, fontSize: 12, color: C.sub, cursor: 'pointer',
                  }}>Tirar desta lista</button>
                )}
                <button onClick={() => onRemove(p.id)} title="Apaga o lugar de todas as listas" style={{ border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'Inter', fontWeight: 700, fontSize: 12, color: '#FF6B5B', padding: '4px 6px' }}>Excluir</button>
              </div>
            )}
          </React.Fragment>
        )}
      </div>
    </div>
  );
}

function ListDetail({ list, places, todasListas, home, onBack, onOpen, onRemove, onRemoveFromList, onShare, onSavePlace, onAddPhoto, onRemovePhoto, onReorderPhotos, onToggleRanking, canEdit, variant }) {
  const { useState, useMemo, useEffect } = React;
  const C = window.Mipas.theme;
  const isPanel = variant === 'panel';
  const [expandedId, setExpandedId] = useState(null);
  const [sortBy, setSortBy] = useState('padrao');
  const [sortDir, setSortDir] = useState('asc');

  const hasCategories = places.some(p => p.category);
  const hasRatings = places.some(p => p.rating != null);
  const hasPrices = places.some(p => p.avg_price != null);

  const sortOptions = useMemo(() => {
    const opts = ['padrao'];
    if (list.ranking_enabled) opts.push('rank');
    if (hasCategories) opts.push('categoria');
    if (hasRatings) opts.push('nota');
    if (hasPrices) opts.push('valor');
    if (home) opts.push('distancia');
    return opts;
  }, [list.ranking_enabled, hasCategories, hasRatings, hasPrices, home]);

  useEffect(() => {
    if (!sortOptions.includes(sortBy)) setSortBy('padrao');
  }, [sortOptions]);

  const withDistance = useMemo(() => places.map(p => ({
    ...p,
    distanceKm: home ? window.Mipas.haversineKm(home.latitude, home.longitude, p.latitude, p.longitude) : null,
  })), [places, home]);

  const ranks = useMemo(() => window.Mipas.computeRanks(places), [places]);

  const sortedPlaces = useMemo(() => {
    if (sortBy === 'padrao') return withDistance;
    const dir = sortDir === 'asc' ? 1 : -1;
    const sorted = [...withDistance];
    if (sortBy === 'rank') {
      sorted.sort((a, b) => {
        const ra = ranks[a.id], rb = ranks[b.id];
        if (ra == null && rb == null) return String(a.name).localeCompare(String(b.name), 'pt-BR');
        if (ra == null) return 1;
        if (rb == null) return -1;
        if (ra !== rb) return (ra - rb) * dir;
        return String(a.name).localeCompare(String(b.name), 'pt-BR');
      });
    } else if (NUMERIC_SORT_ACCESSORS[sortBy]) {
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
  }, [withDistance, sortBy, sortDir, ranks]);

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
      <button onClick={onBack} style={{ border: 'none', background: 'none', color: C.coral, fontFamily: 'Inter', fontWeight: 700, fontSize: 14, cursor: 'pointer', padding: 0, marginBottom: 12 }}>‹ Listas</button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ width: 52, height: 52, borderRadius: 16, background: list.color + '22', border: `1px solid ${list.color}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>{list.emoji}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'Inter', fontSize: 21, fontWeight: 700, color: C.ink, lineHeight: 1.15 }}>{list.name}</div>
          <div style={{ color: C.sub, fontWeight: 500, fontSize: 13 }}>{places.length} {places.length === 1 ? 'lugar' : 'lugares'}</div>
        </div>
        {canEdit && (
          <button onClick={onShare} style={{ border: `1.5px solid ${C.line}`, background: C.surface, borderRadius: 999, padding: '8px 14px', fontFamily: 'Inter', fontWeight: 700, fontSize: 12.5, color: C.coral, cursor: 'pointer' }}>
            {list.is_public ? 'Copiar link' : 'Tornar pública e compartilhar'}
          </button>
        )}
      </div>

      {canEdit && (
        <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button onClick={onToggleRanking} style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, padding: 0 }}>
            <div style={{ width: 34, height: 20, borderRadius: 999, background: list.ranking_enabled ? C.coral : C.line, position: 'relative', transition: 'background .15s' }}>
              <div style={{ position: 'absolute', top: 2, left: list.ranking_enabled ? 16 : 2, width: 16, height: 16, borderRadius: 999, background: '#fff', transition: 'left .15s' }} />
            </div>
            <span style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 12.5, color: C.sub }}>Ranking nesta lista {list.ranking_enabled ? 'ativado' : 'desativado'}</span>
          </button>
          {list.ranking_enabled && (
            <span style={{ fontSize: 11.5, fontWeight: 600, color: C.sub }}>a posição vem da nota; notas iguais empatam</span>
          )}
        </div>
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
          <button onClick={() => setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))} title={sortDir === 'asc' ? 'Crescente' : 'Decrescente'} style={{
            border: `1.5px solid ${C.line}`, background: C.surface, borderRadius: 10, width: 32, height: 32, cursor: 'pointer',
            fontFamily: 'Inter', fontWeight: 700, fontSize: 15, color: C.coral,
          }}>{sortDir === 'asc' ? '↑' : '↓'}</button>
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
              <PlaceRow key={p.id} place={p} list={list} todasListas={todasListas} rank={ranks[p.id]} canEdit={canEdit}
                expanded={expandedId === p.id}
                onToggle={() => setExpandedId(id => (id === p.id ? null : p.id))}
                onOpenMap={onOpen}
                onRemove={onRemove}
                onRemoveFromList={lugar => onRemoveFromList(lugar, list.id)}
                onSave={onSavePlace}
                onAddPhoto={onAddPhoto}
                onRemovePhoto={onRemovePhoto}
                onReorderPhotos={onReorderPhotos} />
            ))}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { Btn, SaveSheet, NewListSheet, HomeSheet, PlaceCard, ListsPanel, ListDetail, gradientForPlace });
