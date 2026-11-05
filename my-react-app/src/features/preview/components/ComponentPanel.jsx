import { useMemo, useState } from 'react';
import { categories, componentMap, components } from '../data/components';
import { filterComponents } from '../lib/model';
import Icon from './Icon';

export default function ComponentPanel({ selected, onSelect, hidden, toggleHidden, showAll, canFocus, onFocus }) {
  const [category, setCategory] = useState('Semua');
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => filterComponents(components, category, query), [category, query]);
  const part = componentMap[selected];
  return <aside className="component-panel" aria-labelledby="preview-components-title">
    <div className="panel-heading"><div><h2 id="preview-components-title">Komponen perangkat <span>{components.length}</span></h2><p>Kenali fungsi di balik setiap bagian.</p></div></div>
    <div className="search-field"><Icon name="search" size={17} /><input type="search" aria-label="Cari komponen" placeholder="Cari komponen…" value={query} onChange={(event) => setQuery(event.target.value)} />{query && <button type="button" aria-label="Hapus pencarian" onClick={() => setQuery('')}><Icon name="close" size={15} /></button>}</div>
    <div className="category-tabs" aria-label="Kategori komponen">{categories.map((name) => <button type="button" key={name} aria-pressed={category === name} className={category === name ? 'active' : ''} onClick={() => setCategory(name)}>{name}</button>)}</div>
    <div className="list-summary"><span>{filtered.length} komponen{hidden.size > 0 ? ` · ${hidden.size} disembunyikan` : ''}</span>{hidden.size > 0 ? <button type="button" onClick={showAll}>Tampilkan semua</button> : <span className="list-tip">Klik untuk memilih</span>}</div>
    <ul className="component-list" aria-label="Daftar komponen">
      {filtered.map((item) => <li key={item.id} className={`component-row ${selected === item.id ? 'selected' : ''} ${hidden.has(item.id) ? 'is-hidden' : ''}`}>
        <button type="button" className="part-select" aria-label={`Pilih ${item.name}`} aria-pressed={selected === item.id} onClick={() => onSelect(item.id)}>
          <span className="part-icon" style={{ '--part-color': item.color }}><Icon name={item.icon} size={20} /></span>
          <span className="part-name"><strong>{item.name}</strong><small>{item.category}{hidden.has(item.id) ? ' · Tersembunyi' : ''}</small></span>
          <Icon name="chevron" size={15} />
        </button>
        <button type="button" className="part-visibility" title={`${hidden.has(item.id) ? 'Tampilkan' : 'Sembunyikan'} ${item.name}`} aria-label={`${hidden.has(item.id) ? 'Tampilkan' : 'Sembunyikan'} ${item.name}`} aria-pressed={!hidden.has(item.id)} onClick={() => toggleHidden(item.id)}><Icon name={hidden.has(item.id) ? 'eye-off' : 'eye'} size={17} /></button>
      </li>)}
      {filtered.length === 0 && <li className="empty-search"><Icon name="search" size={28} /><strong>Komponen tidak ditemukan</strong><p>Coba nama lain atau pilih kategori Semua.</p><button type="button" onClick={() => { setQuery(''); setCategory('Semua'); }}>Hapus filter</button></li>}
    </ul>
    <div className={`part-detail ${part ? 'has-selection' : ''}`} aria-live="polite" aria-atomic="true">
      {part ? <>
        <div className="detail-heading"><span className="detail-category">{part.category}</span><button type="button" aria-label="Tutup informasi komponen" onClick={() => onSelect(null)}><Icon name="close" size={17} /></button></div>
        <h3>{part.name}</h3><p>{part.description}</p>
        <dl>{part.facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        <button type="button" className="focus-button" onClick={() => onFocus(part.id)} disabled={!canFocus || hidden.has(part.id)}><Icon name="target" size={16} />Fokus ke komponen<Icon name="arrow" size={16} /></button>
        {!canFocus && <p className="detail-note">Fokus kamera tersedia ketika model 3D siap.</p>}
        {hidden.has(part.id) && <p className="detail-note">Tampilkan komponen terlebih dahulu untuk memfokuskan kamera.</p>}
        <p className="detail-note">{part.note}</p>
      </> : <div className="detail-intro"><span className="intro-icon"><Icon name="target" size={23} /></span><div><h3>Setiap bagian punya cerita.</h3><p>Pilih komponen pada model atau daftar untuk menjelajahi fungsinya.</p></div></div>}
    </div>
  </aside>;
}
