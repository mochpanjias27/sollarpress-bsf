import { useEffect, useState } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { SITE } from '../site.js';

export function BrandMark({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="9" r="3.6" />
      <path d="M12 1.8v1.6M12 14.6v1.2M4.8 9H3.2M20.8 9h-1.6M6.9 3.9l1.1 1.1M16 13.1l1.1 1.1M6.9 14.1 8 13M16 5l1.1-1.1" />
      <path d="M3 21h18M5 21l1.2-3.4h11.6L19 21" />
    </svg>
  );
}

export default function Nav() {
  const [solid, setSolid] = useState(false);
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => {
    const on = () => setSolid(window.scrollY > 20 || pathname !== '/');
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, [pathname]);
  useEffect(() => setOpen(false), [pathname]);

  return (
    <header className={'nav' + (solid ? ' solid' : '')}>
      <div className="nav-in">
        <Link to="/" className="brand" aria-label={`${SITE.name} beranda`}>
          <span className="brand-mark"><BrandMark /></span>
          <span>{SITE.name}<small>Bening Saguling × Unpad</small></span>
        </Link>
        <nav className={'nav-links' + (open ? ' open' : '')}>
          <NavLink to="/" end>Beranda</NavLink>
          <NavLink to="/scheduler">Scheduler</NavLink>
          <NavLink to="/pemanfaatan">Pemanfaatan</NavLink>
          <NavLink to="/metodologi">Metodologi</NavLink>
          <NavLink to="/tentang">Tentang</NavLink>
        </nav>
        <Link to="/scheduler" className="btn primary sm arrow nav-cta">Scheduler</Link>
        <button className="nav-burger" onClick={() => setOpen((o) => !o)} aria-label="Menu">☰</button>
      </div>
    </header>
  );
}
