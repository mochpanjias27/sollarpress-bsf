import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <main className="phead" style={{ minHeight: '70vh', display: 'grid', placeItems: 'center', textAlign: 'center' }}>
      <div>
        <div className="grad" style={{ fontSize: 96, fontWeight: 800, letterSpacing: '-.04em' }}>404</div>
        <p className="lead" style={{ margin: '0 auto 24px' }}>Halaman tidak ditemukan — mungkin sedang mendinginkan pelat.</p>
        <Link to="/" className="btn primary arrow">Kembali ke beranda</Link>
      </div>
    </main>
  );
}
