import { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';

Chart.defaults.font.family = '"Plus Jakarta Sans", system-ui, sans-serif';
Chart.defaults.font.size = 11;
Chart.defaults.color = '#898781';

// Kanvas Chart.js yang dibuat ulang ketika `config` berubah.
export default function ChartCanvas({ config, label, height = 250 }) {
  const ref = useRef(null);
  const chart = useRef(null);
  useEffect(() => {
    if (!ref.current || !config) return;
    chart.current?.destroy();
    chart.current = new Chart(ref.current, config);
    return () => { chart.current?.destroy(); chart.current = null; };
  }, [config]);
  return (
    <div className="chartbox" style={{ height }}>
      <canvas ref={ref} role="img" aria-label={label} />
    </div>
  );
}
