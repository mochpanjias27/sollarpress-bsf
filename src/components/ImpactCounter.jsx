import { useEffect, useRef, useState } from 'react';
import { IMPACT_CONFIG, batchesUntil, impactFrom, liveState } from '../impact.js';

const fmt = (v, d = 0) => (v ?? 0).toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d });

// Hook: nilai dampak kumulatif yang diperbarui tiap detik
export function useImpact(cfg = IMPACT_CONFIG) {
  const [st, setSt] = useState(() => ({ ...impactFrom(cfg, batchesUntil(cfg)), ...liveState(cfg) }));
  useEffect(() => {
    const id = setInterval(() => setSt({ ...impactFrom(cfg, batchesUntil(cfg)), ...liveState(cfg) }), 1000);
    return () => clearInterval(id);
  }, [cfg]);
  return st;
}

// Angka yang "berjalan" menuju nilai target (animasi saat pertama muncul)
export function Ticker({ value, d = 0 }) {
  const [shown, setShown] = useState(0);
  const from = useRef(0), t0 = useRef(0), first = useRef(true);
  useEffect(() => {
    from.current = first.current ? 0 : shown; t0.current = performance.now();
    const dur = first.current ? 1600 : 900; first.current = false;
    let raf;
    const tick = (now) => {
      const k = Math.min(1, (now - t0.current) / dur), e = 1 - Math.pow(1 - k, 3);
      setShown(from.current + (value - from.current) * e);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return <>{fmt(shown, d)}</>;
}

export default function ImpactStrip({ compact = false }) {
  const s = useImpact();
  const items = [
    ['♻️', s.kgWaste, 0, 'kg sampah plastik terolah'],
    ['🧱', s.boards, 0, 'papan multi-purpose'],
    ['☀️', s.kwhSolar, 0, 'kWh listrik surya dipakai'],
    ['🌱', s.co2 / 1000, 2, 't CO₂e dihindari'],
  ];
  return (
    <div className={'impact-strip' + (compact ? ' compact' : '')}>
      <div className="is-head">
        <span className={'live-dot' + (s.producing ? ' on' : '')} />
        {s.producing ? 'Produksi berjalan — angka bertambah real-time' : 'Di luar jam produksi (09.00–15.00, Sen–Sab)'}
        {IMPACT_CONFIG.isDemo && <span className="demo-tag">estimasi</span>}
      </div>
      <div className="is-grid">
        {items.map(([ic, v, d, l]) => (
          <div key={l} className="is-item"><span className="ic">{ic}</span><b><Ticker value={v} d={d} /></b><small>{l}</small></div>
        ))}
      </div>
    </div>
  );
}
