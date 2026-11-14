import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import useReveal from '../components/useReveal.js';
import { CATEGORIES, GALLERY, MORE_USES, FORMULAS, MIX_COLORS, DESIGN, PROPS, SRC } from '../products.js';
import { PUBLICATIONS } from '../site.js';

const BoardAssembler = lazy(() => import('../three/BoardAssembler.jsx'));

const ASSEMBLE = [
  { id: 'meja', t: 'Meja belajar + bangku' },
  { id: 'rak', t: 'Rak / lemari' },
  { id: 'sampah', t: 'Tempat sampah' },
];

function Lightbox({ item, onClose, onNav }) {
  useEffect(() => {
    if (!item) return;
    const k = (e) => { if (e.key === 'Escape') onClose(); if (e.key === 'ArrowRight') onNav(1); if (e.key === 'ArrowLeft') onNav(-1); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [item, onClose, onNav]);
  if (!item) return null;
  return (
    <div className="lb" onClick={(e) => e.target === e.currentTarget && onClose()} role="dialog" aria-modal="true" aria-label={item.title}>
      <div className="lb-in">
        <img src={item.img} alt={item.title} />
        <div className="lb-cap">
          <div>
            <b>{item.title}</b>
            <p>{item.desc}</p>
            <span className="src">Sumber foto: {SRC[item.src]}, {item.fig}</span>
          </div>
          <div className="lb-nav">
            <button className="btn sm" onClick={() => onNav(-1)} aria-label="Sebelumnya">←</button>
            <button className="btn sm" onClick={() => onNav(1)} aria-label="Berikutnya">→</button>
            <button className="btn sm" onClick={onClose}>Tutup</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Products() {
  const [cat, setCat] = useState('all');
  const [asm, setAsm] = useState('meja');
  const [open, setOpen] = useState(null);
  const { hash } = useLocation();
  useEffect(() => { if (hash) setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth' }), 150); }, [hash]);
  const items = useMemo(() => GALLERY.filter((g) => cat === 'all' || g.cat === cat), [cat]);
  useReveal([cat]);
  const webgl = useMemo(() => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; } }, []);
  const nav = (d) => setOpen((o) => { const i = items.findIndex((x) => x.id === o.id); return items[(i + d + items.length) % items.length]; });

  return (
    <main>
      <section className="phead">
        <div className="container">
          <span className="eyebrow">Pemanfaatan</span>
          <h1>Dari sampah plastik <span className="grad">menjadi barang berguna</span></h1>
          <p className="lead">Multi-purpose board hasil hot press dapat menggantikan kayu untuk furnitur, konstruksi ringan, dan berbagai peralatan sehari-hari. Contoh di halaman ini dirangkum dari dua artikel proyek.</p>
          <div className="prod-props">
            {PROPS.map(([i, t, d]) => <div key={t}><span>{i}</span><b>{t}</b><small>{d}</small></div>)}
          </div>
        </div>
      </section>

      {/* ===== 3D: papan → produk ===== */}
      <section className="section" style={{ paddingTop: 70 }}>
        <div className="container">
          <div className="asm reveal">
            <div className="asm-copy">
              <span className="eyebrow">Satu lembar, banyak kegunaan</span>
              <h2 className="h2">Papan 120 × 240 cm, <span className="grad">dipotong lalu dirakit</span></h2>
              <p className="lead" style={{ fontSize: 15.5 }}>Lembaran standar hasil cold press dan finishing dipotong sesuai pola, lalu dirakit menjadi produk. Pilih produk untuk melihat simulasi pola potong dan perakitannya.</p>
              <div className="asm-tabs">
                {ASSEMBLE.map((a) => <button key={a.id} className={'btn sm' + (asm === a.id ? ' primary' : '')} onClick={() => setAsm(a.id)}>{a.t}</button>)}
              </div>
              <ol className="asm-steps">
                <li><b>Lembar utuh</b> — papan 120 × 240 cm, tebal 10/12/16 mm</li>
                <li><b>Pola potong</b> — garis hijau menunjukkan komponen</li>
                <li><b>Komponen</b> — dipisahkan dari lembar</li>
                <li><b>Perakitan</b> — disambung dengan sekrup/rangka</li>
              </ol>
              <small style={{ color: 'var(--tx-3)' }}>Ilustrasi dimensi bersifat indikatif.</small>
            </div>
            <div className="asm-view">
              {webgl ? <Suspense fallback={null}><BoardAssembler product={asm} key={asm} /></Suspense> : <div style={{ padding: 30, color: 'var(--tx-3)' }}>Browser tidak mendukung WebGL.</div>}
              <div className="hint" style={{ position: 'absolute', left: 16, bottom: 12, fontSize: 12, color: 'var(--tx-3)' }}>⟲ seret untuk memutar</div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Galeri ===== */}
      <section className="section" style={{ paddingTop: 20 }} id="galeri">
        <div className="container center">
          <span className="eyebrow reveal">Galeri produk</span>
          <h2 className="h2 reveal">Contoh nyata dari <span className="grad">lapangan</span></h2>
          <p className="lead reveal">Foto produk yang dimuat dalam artikel Indra dkk. (2025) dan Supian dkk. (2025). Klik foto untuk memperbesar.</p>
          <div className="cats reveal">
            {CATEGORIES.map((c) => (
              <button key={c.id} className={cat === c.id ? 'on' : ''} onClick={() => setCat(c.id)}>
                {c.label} <span>{c.id === 'all' ? GALLERY.length : GALLERY.filter((g) => g.cat === c.id).length}</span>
              </button>
            ))}
          </div>
          <div className="gal">
            {items.map((g, i) => (
              <button key={g.id} className="gcard reveal" style={{ transitionDelay: `${(i % 6) * 50}ms` }} onClick={() => setOpen(g)}>
                <div className="gimg"><img src={g.img} alt={g.title} loading="lazy" /><span className="gtag">{CATEGORIES.find((c) => c.id === g.cat)?.label}</span></div>
                <div className="gbody">
                  <h3>{g.title}</h3>
                  <p>{g.desc}</p>
                  <span className="src">{SRC[g.src]} · {g.fig}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Aplikasi lain ===== */}
      <section className="section" style={{ paddingTop: 20 }}>
        <div className="container center">
          <span className="eyebrow reveal">Aplikasi lain</span>
          <h2 className="h2 reveal">Masih banyak lagi</h2>
          <p className="lead reveal">Aplikasi yang disebutkan dalam artikel, dari kebutuhan rumah tangga hingga konstruksi.</p>
          <div className="uses reveal">
            {MORE_USES.map((u) => <div key={u.t} className="use"><span>{u.icon}</span><b>{u.t}</b><small>{SRC[u.s]}</small></div>)}
          </div>
        </div>
      </section>

      {/* ===== Formulasi ===== */}
      <section className="section" style={{ paddingTop: 20 }}>
        <div className="container center">
          <span className="eyebrow reveal">Formulasi bahan</span>
          <h2 className="h2 reveal">Pilih campuran, <span className="grad">tentukan sifat papan</span></h2>
          <p className="lead reveal">Komposisi polimer menentukan karakter papan sehingga bisa disesuaikan dengan produk yang akan dibuat ({SRC.A}).</p>
          <div className="forms">
            {FORMULAS.map((f, k) => (
              <div key={f.id} className="fcard reveal" data-k={k}>
                <h3>{f.name}</h3>
                <div className="mixbar" aria-label={f.mix.map(([n, v]) => `${n} ${v}%`).join(', ')}>
                  {f.mix.map(([n, v]) => <i key={n} style={{ width: `${v}%`, background: MIX_COLORS[n] }} title={`${n} ${v}%`} />)}
                </div>
                <div className="mixleg">{f.mix.map(([n, v]) => <span key={n}><i style={{ background: MIX_COLORS[n] }} />{n} <b>{v}%</b></span>)}</div>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Pendekatan desain ===== */}
      <section className="section" style={{ paddingTop: 20 }}>
        <div className="container center">
          <span className="eyebrow reveal">Pendekatan desain</span>
          <h2 className="h2 reveal">Agar produk daur ulang <span className="grad">bernilai tinggi</span></h2>
          <div className="process" style={{ textAlign: 'left' }}>
            {DESIGN.map((d, i) => (
              <div key={d.t} className="pcard reveal" style={{ transitionDelay: `${i * 50}ms` }}>
                <div className="k">0{i + 1}</div>
                <h3>{d.t}</h3>
                <p>{d.d}</p>
                <p style={{ fontSize: 12, color: 'var(--tx-3)', marginTop: 10 }}>{SRC[d.s]}</p>
              </div>
            ))}
          </div>

          <div className="cta reveal" style={{ marginTop: 56, textAlign: 'left' }}>
            <div>
              <h3>Nilai ekonomi dari sampah</h3>
              <p>Dalam ilustrasi {SRC.B}, papan dijual sekitar Rp10.000/kg, jauh di atas harga sampah plastik ±Rp500/kg. Produksi yang efisien energi dengan PLTS membuat selisih nilai ini makin besar.</p>
            </div>
            <Link to="/scheduler" className="btn primary arrow">Optimalkan produksi</Link>
          </div>

          <div className="refs reveal">
            <b>Sumber</b>
            {PUBLICATIONS.map((p) => <p key={p.title}>{p.authors}. “{p.title}”. <i>{p.venue}</i>.</p>)}
          </div>
        </div>
      </section>

      <Lightbox item={open} onClose={() => setOpen(null)} onNav={nav} />
    </main>
  );
}
