// Componentes visuais do Mipas: minimalista, escuro, uma única fonte (Inter),
// sem emojis decorativos no texto. O emoji da lista é uma exceção — é dado
// pelo próprio usuário (via input de texto, aceita qualquer emoji do teclado
// do sistema) e funciona como ícone funcional da lista/pin no mapa.
window.Mipas = window.Mipas || {};

function gradientForPlace(place, list) {
  const color = list ? list.color : '#FF5C38';
  return `linear-gradient(135deg, ${color}33, ${color}0D)`;
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

function SaveSheet({ draft, setDraft, lists, onNewList, onCancel, onSave, saving }) {
  const C = window.Mipas.theme;
  const set = (k, v) => setDraft(d => ({ ...d, [k]: v }));
  const canSave = draft.name.trim() && draft.list_id && !saving;
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
        <div style={{ marginTop: 14, fontWeight: 700, fontSize: 13, color: C.ink }}>Em qual lista?</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          {lists.map(l => (
            <button key={l.id} onClick={() => set('list_id', l.id)} style={{
              border: `1.5px solid ${draft.list_id === l.id ? l.color : C.line}`, borderRadius: 999, padding: '8px 13px', cursor: 'pointer',
              fontFamily: 'Inter', fontWeight: 700, fontSize: 13, display: 'flex', gap: 6, alignItems: 'center',
              background: draft.list_id === l.id ? l.color + '22' : C.surface, color: draft.list_id === l.id ? l.color : C.sub,
            }}>{l.emoji} {l.name}</button>
          ))}
          <button onClick={onNewList} style={{ border: `1.5px dashed ${C.coral}88`, borderRadius: 999, padding: '8px 13px', cursor: 'pointer', fontFamily: 'Inter', fontWeight: 700, fontSize: 13, background: 'none', color: C.coral }}>+ Nova</button>
        </div>
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
        <textarea value={draft.description || ''} onChange={e => set('description', e.target.value)} placeholder="Como é o lugar, o que pedir, vibe geral…" rows={2}
          style={{ width: '100%', boxSizing: 'border-box', marginTop: 7, background: C.surface, border: `1.5px solid ${C.line}`, borderRadius: 12, padding: '12px 16px', fontSize: 14, fontWeight: 500, color: C.ink, resize: 'none' }} />
        <div style={{ marginTop: 14, fontWeight: 700, fontSize: 13, color: C.ink }}>Uma nota pra você do futuro <span style={{ color: C.sub, fontWeight: 500 }}>(opcional)</span></div>
        <textarea value={draft.note} onChange={e => set('note', e.target.value)} placeholder="Ex: pedir a mesa da janela…" rows={2}
          style={{ width: '100%', boxSizing: 'border-box', marginTop: 7, background: C.surface, border: `1.5px solid ${C.line}`, borderRadius: 12, padding: '12px 16px', fontSize: 14, fontWeight: 500, color: C.ink, resize: 'none' }} />
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

// Botão "INSTAGRAM" com o logo — aceita "@handle", "handle" ou URL completa.
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
  const C = window.Mipas.theme;
  return (
    <div style={{ position: 'absolute', left: 12, right: 12, bottom: 96, zIndex: 750, background: C.surface, border: `1px solid ${C.line}`, borderRadius: 18, boxShadow: '0 14px 40px rgba(0,0,0,.5)', overflow: 'hidden', animation: 'sheetUp .28s cubic-bezier(.2,.9,.3,1)' }}>
      <div style={place.photos?.[0]
        ? { height: 72, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, backgroundImage: `url(${place.photos[0].url})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }
        : { height: 72, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, background: gradientForPlace(place, list) }}>
        {!place.photos?.[0] && (list?.emoji || '📍')}
        <button onClick={onClose} style={{ position: 'absolute', top: 10, right: 10, width: 28, height: 28, borderRadius: 99, border: 'none', background: 'rgba(0,0,0,.4)', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: C.ink }}>✕</button>
      </div>
      <div style={{ padding: '14px 18px 16px' }}>
        <div style={{ fontFamily: 'Inter', fontSize: 17, fontWeight: 700, color: C.ink }}>{place.name}</div>
        <div style={{ color: C.sub, fontWeight: 500, fontSize: 13, marginTop: 3 }}>{place.address}</div>
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
        </div>
        {place.description && <div style={{ marginTop: 10, fontSize: 13.5, fontWeight: 500, color: C.ink, background: C.cream, borderRadius: 12, padding: '10px 14px', lineHeight: 1.45 }}>{place.description}</div>}
        {place.note && <div style={{ marginTop: 10, fontSize: 13.5, fontWeight: 500, color: C.ink, background: C.cream, borderRadius: 12, padding: '10px 14px', lineHeight: 1.45 }}>{place.note}</div>}
      </div>
    </div>
  );
}

function InlineEdit({ value, placeholder, width, type, step, onCommit }) {
  const { useState, useEffect } = React;
  const C = window.Mipas.theme;
  const [val, setVal] = useState(value ?? '');
  useEffect(() => { setVal(value ?? ''); }, [value]);
  const commit = () => {
    const next = type === 'number' ? (val === '' ? null : parseFloat(val)) : (val.trim() || null);
    if (next !== (value ?? null)) onCommit(next);
  };
  if (type === 'textarea') {
    return (
      <textarea value={val} placeholder={placeholder} rows={2} onClick={ev => ev.stopPropagation()}
        onChange={e => setVal(e.target.value)}
        onBlur={commit}
        style={{
          width: '100%', boxSizing: 'border-box', background: C.cream, border: `1px solid ${C.line}`, borderRadius: 10,
          padding: '8px 12px', fontSize: 13, fontWeight: 500, color: C.ink, resize: 'none',
        }} />
    );
  }
  return (
    <input type={type || 'text'} step={step} value={val} placeholder={placeholder} onClick={ev => ev.stopPropagation()}
      onChange={e => setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }}
      style={{
        width, background: C.cream, border: `1px solid ${C.line}`, borderRadius: 999, padding: '4px 10px',
        fontSize: 12, fontWeight: 700, color: C.ink, textAlign: type === 'number' ? 'center' : 'left',
      }} />
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
          const count = places.filter(p => p.list_id === l.id).length;
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

function PhotoStrip({ photos, canEdit, onAdd, onRemove }) {
  const { useRef } = React;
  const C = window.Mipas.theme;
  const inputRef = useRef(null);
  if (!canEdit && (!photos || photos.length === 0)) return null;
  const handleFile = (e) => {
    const file = e.target.files[0];
    if (file) onAdd(file);
    e.target.value = '';
  };
  return (
    <div onClick={ev => ev.stopPropagation()} style={{ display: 'flex', gap: 8, overflowX: 'auto', marginTop: 10 }}>
      {(photos || []).map(ph => (
        <div key={ph.id} style={{ position: 'relative', flexShrink: 0, width: 64, height: 64, borderRadius: 10, overflow: 'hidden', border: `1px solid ${C.line}` }}>
          <img src={ph.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          {canEdit && (
            <button onClick={() => onRemove(ph)} style={{ position: 'absolute', top: 2, right: 2, width: 18, height: 18, borderRadius: 99, border: 'none', background: 'rgba(0,0,0,.6)', color: '#fff', fontSize: 10, cursor: 'pointer', lineHeight: '18px', padding: 0 }}>✕</button>
          )}
        </div>
      ))}
      {canEdit && (
        <React.Fragment>
          <button onClick={() => inputRef.current.click()} style={{ flexShrink: 0, width: 64, height: 64, borderRadius: 10, border: `1.5px dashed ${C.coral}66`, background: 'none', color: C.coral, fontSize: 22, fontWeight: 700, cursor: 'pointer' }}>+</button>
          <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
        </React.Fragment>
      )}
    </div>
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
  rank: p => p.rank,
  distancia: p => p.distanceKm,
  nota: p => p.rating,
  valor: p => p.avg_price,
};

function ListDetail({ list, places, home, onBack, onOpen, onRemove, onShare, onUpdateRank, onUpdateCategory, onUpdateRating, onUpdateDescription, onUpdateAvgPrice, onUpdateInstagram, onAddPhoto, onRemovePhoto, onToggleRanking, canEdit, variant }) {
  const { useState, useMemo, useEffect } = React;
  const C = window.Mipas.theme;
  const isPanel = variant === 'panel';
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
        <button onClick={onToggleRanking} style={{ marginTop: 14, border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, padding: 0 }}>
          <div style={{ width: 34, height: 20, borderRadius: 999, background: list.ranking_enabled ? C.coral : C.line, position: 'relative', transition: 'background .15s' }}>
            <div style={{ position: 'absolute', top: 2, left: list.ranking_enabled ? 16 : 2, width: 16, height: 16, borderRadius: 999, background: '#fff', transition: 'left .15s' }} />
          </div>
          <span style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 12.5, color: C.sub }}>Ranking nesta lista {list.ranking_enabled ? 'ativado' : 'desativado'}</span>
        </button>
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
        {sortedPlaces.map(p => (
          <div key={p.id} onClick={() => onOpen(p)} style={{ background: C.surface, borderRadius: 16, border: `1px solid ${C.line}`, overflow: 'hidden', cursor: 'pointer' }}>
            <div style={p.photos?.[0]
              ? { height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, backgroundImage: `url(${p.photos[0].url})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }
              : { height: 64, background: gradientForPlace(p, list), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>
              {!p.photos?.[0] && list.emoji}
            </div>
            <div style={{ padding: '12px 14px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: C.ink }}>{p.name}</div>
                {canEdit && <button onClick={ev => { ev.stopPropagation(); onRemove(p.id); }} style={{ border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'Inter', fontWeight: 700, fontSize: 12, color: '#FF6B5B', padding: '4px 6px' }}>Excluir</button>}
              </div>
              <div style={{ color: C.sub, fontWeight: 500, fontSize: 12.5, marginTop: 3 }}>{p.address}</div>
              {canEdit ? (
                <div style={{ marginTop: 8 }} onClick={ev => ev.stopPropagation()}>
                  <InlineEdit value={p.description} placeholder="Descrição (visível pra quem vê a lista)" type="textarea" onCommit={v => onUpdateDescription(p.id, v)} />
                </div>
              ) : p.description && (
                <div style={{ marginTop: 8, fontSize: 13, fontWeight: 500, color: C.ink, background: C.cream, borderRadius: 10, padding: '8px 12px' }}>{p.description}</div>
              )}
              {p.note && <div style={{ marginTop: 8, fontSize: 13, fontWeight: 500, color: C.ink, background: C.cream, borderRadius: 10, padding: '8px 12px' }}>{p.note}</div>}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 10 }}>
                {p.distanceKm != null && (
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.sub, background: C.cream, borderRadius: 999, padding: '4px 10px' }}>
                    {p.distanceKm < 1 ? `${Math.round(p.distanceKm * 1000)} m` : `${p.distanceKm.toFixed(1)} km`}
                  </div>
                )}
                {canEdit ? (
                  <InlineEdit value={p.category} placeholder="Categoria" width={90} onCommit={v => onUpdateCategory(p.id, v)} />
                ) : p.category && (
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.sub, background: C.cream, borderRadius: 999, padding: '4px 10px' }}>{p.category}</div>
                )}
                {canEdit ? (
                  <div onClick={ev => ev.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: C.sub }}>Nota</span>
                    <InlineEdit value={p.rating} placeholder="—" width={44} type="number" step="0.5" onCommit={v => onUpdateRating(p.id, v)} />
                  </div>
                ) : p.rating != null && (
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.coral, background: C.coral + '1E', borderRadius: 999, padding: '4px 10px' }}>★ {p.rating}</div>
                )}
                {canEdit ? (
                  <div onClick={ev => ev.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: C.sub }}>R$</span>
                    <InlineEdit value={p.avg_price} placeholder="—" width={56} type="number" step="0.01" onCommit={v => onUpdateAvgPrice(p.id, v)} />
                  </div>
                ) : p.avg_price != null && (
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.sub, background: C.cream, borderRadius: 999, padding: '4px 10px' }}>
                    R$ {Number(p.avg_price).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                )}
                {canEdit ? (
                  <InlineEdit value={p.instagram} placeholder="@instagram" width={90} onCommit={v => onUpdateInstagram(p.id, v)} />
                ) : p.instagram && (
                  <InstagramButton handle={p.instagram} />
                )}
                {list.ranking_enabled && canEdit && (
                  <div onClick={ev => ev.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: C.sub }}>Rank</span>
                    <InlineEdit value={p.rank} placeholder="—" width={48} type="number" onCommit={v => onUpdateRank(p.id, v)} />
                  </div>
                )}
                {list.ranking_enabled && !canEdit && p.rank != null && (
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.coral, background: C.coral + '1E', borderRadius: 999, padding: '4px 10px' }}>#{p.rank}</div>
                )}
              </div>
              <PhotoStrip photos={p.photos} canEdit={canEdit} onAdd={file => onAddPhoto(p.id, file)} onRemove={photo => onRemovePhoto(p.id, photo)} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { Btn, SaveSheet, NewListSheet, HomeSheet, PlaceCard, ListsPanel, ListDetail, gradientForPlace });
