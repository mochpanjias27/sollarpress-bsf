import { Link } from 'react-router-dom';
import { PUBLICATIONS, SITE } from '../site.js';

const TEAM = [
  ['Indra', 'Bening Saguling Foundation'],
  ['Prof. Sukono', 'Departemen Matematika FMIPA Unpad'],
  ['Sudradjat Supian', 'Departemen Matematika FMIPA Unpad'],
  ['Riaman', 'Departemen Matematika FMIPA Unpad'],
  ['Dr. Moch Panji Agung Saputra', 'Departemen Matematika FMIPA Unpad'],
  ['Aceng Sambas', 'UniSZA Malaysia · Univ. Muhammadiyah Tasikmalaya'],
  ['Astrid Sulistya Azahra', 'Program Doktor Matematika Unpad'],
  ['Mugi Lestari', 'Program Magister Matematika Unpad'],
  ['Audrey Ariij Sya’imaa HS', 'Program Magister Matematika Unpad'],
];

export default function About() {
  const bbox = `${SITE.lon - 0.012},${SITE.lat - 0.008},${SITE.lon + 0.012},${SITE.lat + 0.008}`;
  return (
    <main>
      <section className="phead">
        <div className="container">
          <span className="eyebrow">Tentang proyek</span>
          <h1>Riset terapan untuk <span className="grad">ekonomi sirkular</span> di Saguling</h1>
          <p className="lead">Kolaborasi Bening Saguling Foundation dan Departemen Matematika FMIPA Universitas Padjadjaran: rekayasa mesin, model matematika, dan energi surya untuk mengolah sampah plastik low-value.</p>
        </div>
      </section>
      <section className="section" style={{ paddingTop: 50 }}>
        <div className="container prose" style={{ maxWidth: 'var(--maxw)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 40 }}>
            <div>
              <h2 style={{ marginTop: 0 }}>Latar belakang</h2>
              <p>
                Plastik low-value — sachet multilapis, kantong kresek, kemasan fleksibel — sulit didaur ulang karena biaya prosesnya melebihi nilai jualnya.
                Tingkat daur ulang plastik di Indonesia hanya sekitar 10%, sehingga sebagian besar berakhir di TPA atau mencemari lingkungan, termasuk perairan Waduk Saguling.
              </p>
              <p>
                Bening Saguling Foundation mengembangkan mesin <strong>sheet press</strong> yang mengubah plastik tersebut menjadi <strong>multi-purpose board</strong>:
                papan tahan air dan cuaca untuk lemari, meja, kursi, pintu, partisi, hingga panel atap. Kini mesin tersebut ditenagai PLTS senilai Rp1,5 miliar.
              </p>
              <h2>Pertanyaan riset</h2>
              <p>
                Bagaimana menjadwalkan siklus hot press — pemanasan, pengepresan, dan pembagian produksi antarhari — berdasarkan prakiraan cuaca,
                agar pemakaian listrik PLN dan emisi minimum, di bawah kendala suhu, waktu kerja, dan kualitas produk?
              </p>
            </div>
            <div>
              <h2 style={{ marginTop: 0 }}>Lokasi</h2>
              <div className="mapbox">
                <iframe title="Peta lokasi Bening Saguling Foundation" loading="lazy"
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${SITE.lat},${SITE.lon}`} />
              </div>
              <p style={{ fontSize: 14 }}>{SITE.address}<br />
                <a href={SITE.mapsUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--green)', fontWeight: 600 }}>Buka di Google Maps ↗</a> ·{' '}
                <a href={SITE.website} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--green)', fontWeight: 600 }}>beningsaguling.org ↗</a></p>
            </div>
          </div>

          <h2>Publikasi</h2>
          {PUBLICATIONS.map((p) => (
            <div className="pub" key={p.title}>
              <h3>{p.title}</h3>
              <div className="meta">{p.authors} · <i>{p.venue}</i></div>
              <p style={{ marginBottom: 0 }}>{p.summary}</p>
            </div>
          ))}

          <h2>Tim peneliti</h2>
          <div className="team">{TEAM.map(([n, a]) => <div className="member" key={n}><b>{n}</b><span>{a}</span></div>)}</div>

          <div className="cta" style={{ marginTop: 60 }}>
            <div><h3>Lihat bagaimana model bekerja</h3><p>Formulasi termal, neraca energi, dan algoritma dynamic programming dijelaskan lengkap.</p></div>
            <Link to="/metodologi" className="btn primary arrow">Metodologi</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
