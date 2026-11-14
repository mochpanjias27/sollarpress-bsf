import { Link } from 'react-router-dom';
import { SITE } from '../site.js';
import { BrandMark } from './Nav.jsx';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <div className="brand" style={{ marginBottom: 12 }}>
              <span className="brand-mark"><BrandMark /></span>
              <span>{SITE.name}<small>Bening Saguling × Unpad</small></span>
            </div>
            <p style={{ maxWidth: 380, margin: 0 }}>
              Riset optimisasi jadwal mesin press plastik low-value menjadi multi-purpose board bertenaga surya —
              ekonomi sirkular dari Waduk Saguling.
            </p>
          </div>
          <div>
            <h5>Navigasi</h5>
            <ul>
              <li><Link to="/scheduler">Scheduler</Link></li>
              <li><Link to="/metodologi">Metodologi & model</Link></li>
              <li><Link to="/tentang">Tentang proyek</Link></li>
            </ul>
          </div>
          <div>
            <h5>Lokasi</h5>
            <p style={{ margin: '0 0 8px' }}>{SITE.address}</p>
            <a href={SITE.mapsUrl} target="_blank" rel="noopener noreferrer">Buka di Google Maps ↗</a>
          </div>
        </div>
        <div className="copy">
          <span>© {new Date().getFullYear()} {SITE.org} · {SITE.partner}</span>
          <span>Data cuaca: <a href="https://open-meteo.com" target="_blank" rel="noopener noreferrer">Open-Meteo</a> (CC BY 4.0)</span>
        </div>
      </div>
    </footer>
  );
}
