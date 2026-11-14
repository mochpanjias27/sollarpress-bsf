import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import ChartCanvas from '../components/ChartCanvas.jsx';
import { defaultParams } from '../engine/engine.js';
import { loadForecast, todayJakarta } from '../engine/forecast.js';
import { runTwin, energyStats } from '../telemetry/twin.js';
import { parseTelemetryCsv } from '../telemetry/csv.js';

const TwinScene = lazy(() => import('../three/TwinScene.jsx'));

const fmt = (v, d = 0) => (v ?? 0).toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d });
const tooltipBase = { backgroundColor: '#111', padding: 10, cornerRadius: 8, titleFont: { weight: '700' }, boxPadding: 4 };
const C = { act: '#2a78d6', twin: '#1f5c33', plan: '#9aa8a0', pv: '#eda100', pvfc: '#c3cdc4', pln: '#e34948', grid: '#e3e8e1' };
const P = defaultParams();
const SPEEDS = [[1, 'Real-time'], [60, '60×'], [240, '240×']];

function nowSlotJakarta() {
  const d = new Date(Date.now() + 7 * 3600e3);
  return d.getUTCHours() * 4 + Math.floor(d.getUTCMinutes() / 15) + (d.getUTCMinutes() % 15) / 15;
}

function seriesFromApi(points) {
  const S = { t: [], temp: [], heater: [], pv: [], pvFc: [], pln: [], load: [], soc: [], press: [], tamb: [] };
  points.forEach((p) => {
    S.t.push(p.waktu); S.temp.push(p.suhu_pelat); S.heater.push(p.daya_heater ?? 0); S.pv.push(p.daya_pv ?? 0);
    S.pvFc.push(p.prakiraan_pv ?? null); S.pln.push(p.daya_pln ?? 0); S.load.push(p.beban_total ?? p.daya_heater ?? 0);
    S.soc.push(p.soc ?? null); S.press.push(p.menekan ? 1 : 0); S.tamb.push(p.suhu_lingkungan ?? null);
  });
  return S;
}

export default function Monitoring() {
  const [mode, setMode] = useState('sim');       // sim | csv | api
  const [series, setSeries] = useState(null);
  const [fault, setFault] = useState(true);
  const [speed, setSpeed] = useState(60);
  const [cursor, setCursor] = useState(0);       // indeks slot "sekarang" (pecahan)
  const [status, setStatus] = useState('');
  const [apiInfo, setApiInfo] = useState(null);
  const live = useRef({});
  const worker = useRef(null);
  const clock = useRef({ t0: 0, k0: 0 });

  /* ---------- sumber data ---------- */
  const loadSim = useCallback(async (withFault) => {
    setStatus('Membangkitkan telemetri simulasi dari jadwal optimal hari ini…');
    const p = { ...defaultParams(), tilt: 10 };
    const { fc } = await loadForecast(p);
    const start = fc.time.some((t) => t.startsWith(todayJakarta())) ? todayJakarta() : fc.time[0].slice(0, 10);
    if (!worker.current) worker.current = new Worker(new URL('../engine/worker.js', import.meta.url), { type: 'module' });
    worker.current.onmessage = (e) => {
      if (e.data.error) { setStatus('Gagal: ' + e.data.error); return; }
      if (!e.data.series) return;
      setSeries(e.data.series); setStatus('');
      const k0 = Math.max(24, Math.min(80, nowSlotJakarta()));
      clock.current = { t0: performance.now(), k0 };
      setCursor(k0);
    };
    worker.current.postMessage({ kind: 'telemetry', p, fc, start, fault: withFault, seed: 7 });
  }, []);

  useEffect(() => { if (mode === 'sim') loadSim(fault); }, [mode, fault, loadSim]);
  useEffect(() => () => worker.current?.terminate(), []);

  // jam virtual
  useEffect(() => {
    if (mode !== 'sim' || !series) return;
    clock.current = { t0: performance.now(), k0: cursor };
    const id = setInterval(() => {
      const dtMin = ((performance.now() - clock.current.t0) / 60000) * speed;
      let k = clock.current.k0 + dtMin / 15;
      if (k >= series.t.length - 1) { k = 24; clock.current = { t0: performance.now(), k0: 24 }; }
      setCursor(k);
    }, 400);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, series, speed]);

  // mode API: polling
  useEffect(() => {
    if (mode !== 'api') return;
    let alive = true;
    const poll = async () => {
      try {
        const r = await fetch('/api/telemetry?n=192');
        const js = await r.json();
        if (!alive) return;
        setApiInfo(js);
        if (js.configured && js.points?.length > 3) { const S = seriesFromApi(js.points); setSeries(S); setCursor(S.t.length - 1); }
        else setSeries(null);
      } catch { if (alive) setApiInfo({ configured: false, error: 'Endpoint tidak tersedia (jalankan di Vercel)' }); }
    };
    poll();
    const id = setInterval(poll, 30000);
    return () => { alive = false; clearInterval(id); };
  }, [mode]);

  const onCsv = async (file) => {
    try {
      const S = parseTelemetryCsv(await file.text());
      setSeries(S); setCursor(S.t.length - 1); setStatus('');
    } catch (e) { setStatus('CSV tidak valid: ' + e.message); }
  };
  const loadExample = async () => {
    const txt = await (await fetch('/data/contoh-telemetri.csv')).text();
    const S = parseTelemetryCsv(txt); setSeries(S); setCursor(S.t.length - 1);
  };

  /* ---------- analisis twin ---------- */
  const twin = useMemo(() => (series ? runTwin(series) : null), [series]);
  const K = series ? Math.min(series.t.length - 1, Math.floor(cursor)) : 0;
  const stats = useMemo(() => (series ? energyStats(series, K + 1) : null), [series, K]);

  useEffect(() => {
    if (!series || !twin) return;
    live.current = { temp: series.temp[K], twin: twin.open[K], heater: series.heater[K], pv: series.pv[K], soc: series.soc[K] ?? 0.5, press: !!series.press[K] };
  }, [series, twin, K]);

  const shownAnoms = twin ? twin.anomalies.filter((a) => a.k <= K) : [];
  // metrik akurasi hanya dari data yang sudah "terjadi" (sampai kursor waktu)
  const acc = useMemo(() => {
    if (!series || !twin) return null;
    let s1 = 0, s2 = 0, n = 0, mS = 0, mN = 0;
    for (let k = 1; k <= K; k++) { s1 += twin.resid[k] ** 2; s2 += (series.temp[k] - twin.open[k]) ** 2; n++;
      const f = series.pvFc?.[k], a = series.pv[k]; if (f != null && a > 2) { mS += Math.abs(f - a) / a; mN++; } }
    return { rmse: n ? Math.sqrt(s1 / n) : 0, openRmse: n ? Math.sqrt(s2 / n) : 0, mape: mN ? (100 * mS) / mN : null };
  }, [series, twin, K]);
  const phase = series ? (series.press[K] ? 'Menekan' : series.heater[K] > 0.5 ? 'Memanaskan' : series.temp[K] > 150 ? 'Siaga panas' : 'Mati / dingin') : '—';
  let batchNo = 0; if (series) for (let k = 0; k <= K; k++) if (series.press[k] && !series.press[k - 1]) batchNo++;

  /* ---------- grafik ---------- */
  const labels = useMemo(() => (series ? series.t.map((t) => t.slice(11, 16)) : []), [series]);
  const cut = (arr) => arr.map((v, k) => (k <= K ? v : null));
  const tempCfg = useMemo(() => {
    if (!series) return null;
    const anomPts = series.temp.map((v, k) => (shownAnoms.some((a) => a.k === k) ? v : null));
    return {
      type: 'line',
      data: { labels, datasets: [
        { label: 'Suhu terukur', data: cut(series.temp), borderColor: C.act, borderWidth: 2, pointRadius: 0, tension: 0.2 },
        { label: 'Digital twin', data: cut(twin.open), borderColor: C.twin, borderWidth: 1.5, borderDash: [5, 4], pointRadius: 0, tension: 0.2 },
        ...(series.planTemp ? [{ label: 'Rencana optimal', data: series.planTemp, borderColor: C.plan, borderWidth: 1, pointRadius: 0, borderDash: [2, 3] }] : []),
        { label: 'Anomali', data: anomPts, borderColor: '#d03b3b', backgroundColor: '#d03b3b', pointRadius: 5, showLine: false },
      ] },
      options: { responsive: true, maintainAspectRatio: false, animation: false, interaction: { mode: 'index', intersect: false }, spanGaps: false,
        plugins: { legend: { display: false }, tooltip: { ...tooltipBase, callbacks: { label: (c) => c.parsed.y == null ? null : ` ${c.dataset.label}: ${fmt(c.parsed.y, 1)} °C` } } },
        scales: { x: { grid: { display: false }, ticks: { autoSkip: false, maxRotation: 0, callback: (v, i) => (i % 8 === 0 ? labels[i] : null) } }, y: { suggestedMin: 20, suggestedMax: 215, grid: { color: C.grid }, border: { display: false }, title: { display: true, text: '°C' } } } },
      plugins: [{ id: 'band', beforeDatasetsDraw(ch) {
        const { ctx, chartArea: a, scales: { x, y } } = ch; ctx.save();
        ctx.fillStyle = 'rgba(19,144,106,.12)'; const t = y.getPixelForValue(P.thMaxPress), b = y.getPixelForValue(P.thMin); ctx.fillRect(a.left, t, a.right - a.left, b - t);
        const w = x.getPixelForValue(1) - x.getPixelForValue(0); ctx.fillStyle = 'rgba(235,104,52,.28)';
        series.press.forEach((m, i) => { if (m && i <= K) ctx.fillRect(x.getPixelForValue(i) - w / 2, a.bottom - 5, w, 5); });
        const xn = x.getPixelForValue(K); ctx.strokeStyle = '#1f5c33'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(xn, a.top); ctx.lineTo(xn, a.bottom); ctx.stroke();
        ctx.restore();
      } }],
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, twin, K]);
  const pvCfg = useMemo(() => {
    if (!series) return null;
    return {
      type: 'line',
      data: { labels, datasets: [
        { label: 'PV aktual', data: cut(series.pv), borderColor: C.pv, backgroundColor: 'rgba(237,161,0,.12)', fill: 'origin', borderWidth: 2, pointRadius: 0, tension: 0.2 },
        ...(series.pvFc.some((v) => v != null) ? [{ label: 'PV prakiraan', data: series.pvFc, borderColor: C.pvfc, borderWidth: 1.5, borderDash: [4, 3], pointRadius: 0 }] : []),
        { label: 'Impor PLN', data: cut(series.pln), borderColor: C.pln, borderWidth: 1.5, pointRadius: 0, stepped: true },
      ] },
      options: { responsive: true, maintainAspectRatio: false, animation: false, interaction: { mode: 'index', intersect: false },
        plugins: { legend: { display: false }, tooltip: { ...tooltipBase, callbacks: { label: (c) => c.parsed.y == null ? null : ` ${c.dataset.label}: ${fmt(c.parsed.y, 1)} kW` } } },
        scales: { x: { grid: { display: false }, ticks: { autoSkip: false, maxRotation: 0, callback: (v, i) => (i % 8 === 0 ? labels[i] : null) } }, y: { beginAtZero: true, grid: { color: C.grid }, border: { display: false }, title: { display: true, text: 'kW' } } } },
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, K]);
  const resCfg = useMemo(() => {
    if (!series) return null;
    const s3 = 3 * twin.sigma;
    return {
      type: 'bar',
      data: { labels, datasets: [{ label: 'Residual', data: cut(twin.resid).map((v, k) => (k === 0 ? 0 : v)), backgroundColor: twin.resid.map((v) => (Math.abs(v) > s3 ? '#d03b3b' : 'rgba(42,120,214,.55)')), borderRadius: 2 }] },
      options: { responsive: true, maintainAspectRatio: false, animation: false,
        plugins: { legend: { display: false }, tooltip: { ...tooltipBase, callbacks: { label: (c) => ` residual: ${fmt(c.parsed.y, 2)} °C` } } },
        scales: { x: { grid: { display: false }, ticks: { autoSkip: false, maxRotation: 0, callback: (v, i) => (i % 8 === 0 ? labels[i] : null) } }, y: { suggestedMin: -s3 * 1.6, suggestedMax: s3 * 1.6, grid: { color: C.grid }, border: { display: false }, title: { display: true, text: '°C' } } } },
      plugins: [{ id: 'sig', beforeDatasetsDraw(ch) { const { ctx, chartArea: a, scales: { y } } = ch; ctx.save(); ctx.fillStyle = 'rgba(19,144,106,.10)'; ctx.fillRect(a.left, y.getPixelForValue(s3), a.right - a.left, y.getPixelForValue(-s3) - y.getPixelForValue(s3)); ctx.restore(); } }],
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, twin, K]);

  const webgl = useMemo(() => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; } }, []);
  const timeLabel = series ? series.t[K]?.replace('T', ' · ') : '—';

  return (
    <main className="mon">
      <section className="phead" style={{ paddingBottom: 30 }}>
        <div className="container">
          <span className="eyebrow">Monitoring & digital twin</span>
          <h1>Mesin press, <span className="grad">kembar digitalnya</span>, dan data lapangan</h1>
          <p className="lead">Data sensor (suhu pelat, daya heater, PV, PLN, baterai) dibandingkan setiap 15 menit dengan prediksi model termal. Penyimpangan di luar 3σ ditandai sebagai anomali — misalnya kebocoran panas atau heater melemah.</p>
          <div className="mon-modes">
            {[['sim', '🟢 Simulasi live'], ['csv', '📄 Unggah CSV'], ['api', '📡 Perangkat IoT (API)']].map(([v, t]) => (
              <button key={v} className={mode === v ? 'on' : ''} onClick={() => { setMode(v); setSeries(null); }}>{t}</button>
            ))}
          </div>
        </div>
      </section>

      <section className="container" style={{ paddingTop: 26, paddingBottom: 80 }}>
        {mode === 'sim' && (
          <div className="note-demo">
            <b>Mode demo.</b> Telemetri dibangkitkan dari jadwal optimal hari ini, dijalankan pada “mesin virtual” yang parameternya sedikit berbeda dari model, ditambah fluktuasi PV dan derau sensor.
            <label className="chk"><input type="checkbox" checked={fault} onChange={(e) => setFault(e.target.checked)} /> Suntikkan gangguan (insulasi terbuka 12.30–13.30)</label>
            <span className="speed">{SPEEDS.map(([s, t]) => <button key={s} className={speed === s ? 'on' : ''} onClick={() => setSpeed(s)}>{t}</button>)}</span>
          </div>
        )}
        {mode === 'csv' && (
          <div className="note-demo">
            <b>Unggah log telemetri (CSV, interval 15 menit).</b> Kolom wajib: <span className="mono">waktu, suhu_pelat, daya_heater</span>; opsional: daya_pv, prakiraan_pv, daya_pln, beban_total, soc, menekan, suhu_lingkungan.
            <span className="speed">
              <label className="btn sm">📂 Pilih file<input type="file" accept=".csv,text/csv" hidden onChange={(e) => e.target.files[0] && onCsv(e.target.files[0])} /></label>
              <button className="btn sm" onClick={loadExample}>Pakai contoh</button>
              <a className="btn sm" href="/data/template-telemetri.csv" download>⬇ Template</a>
            </span>
          </div>
        )}
        {mode === 'api' && (
          <div className="note-demo">
            {apiInfo?.configured
              ? <><b>Terhubung ke /api/telemetry.</b> {apiInfo.points?.length || 0} titik data, diperbarui otomatis tiap 30 detik.</>
              : <><b>Endpoint belum dikonfigurasi.</b> Setelah deploy ke Vercel, tambahkan Upstash Redis dan variabel <span className="mono">UPSTASH_REDIS_REST_URL</span>, <span className="mono">UPSTASH_REDIS_REST_TOKEN</span>, <span className="mono">TELEMETRY_KEY</span>. Panel kontrol/ESP32 lalu mengirim data:</>}
            <pre className="code">{`curl -X POST https://<domain>/api/telemetry \\
  -H "x-api-key: $TELEMETRY_KEY" -H "Content-Type: application/json" \\
  -d '{"waktu":"2026-11-16T10:15","suhu_pelat":192.4,"daya_heater":22.5,
       "daya_pv":41.2,"daya_pln":0,"soc":0.82,"menekan":1}'`}</pre>
          </div>
        )}
        {status && <div className="note-demo" style={{ color: status.startsWith('Gagal') || status.startsWith('CSV') ? 'var(--crit)' : undefined }}>{status}</div>}

        {series && twin && (
          <>
            <div className="mon-top">
              <div className="mon-twin">
                {webgl ? <Suspense fallback={null}><TwinScene live={live} /></Suspense> : null}
                <div className="mon-clock"><span className="dot" />{timeLabel}</div>
                <div className="mon-phase">{phase}{series.press[K] ? ` · batch ${batchNo}` : ''}</div>
              </div>
              <div className="mon-gauges">
                <Gauge label="Suhu pelat" value={series.temp[K]} unit="°C" d={1} sub={`twin ${fmt(twin.open[K], 1)} °C`} max={220} band={[P.thMin, P.thMaxPress]} color="#ef7a35" />
                <Gauge label="Daya PV" value={series.pv[K]} unit="kW" d={1} sub={series.pvFc?.[K] != null ? `prakiraan ${fmt(series.pvFc[K], 1)} kW` : ''} max={P.invMax} color="#eda100" />
                <Gauge label="Impor PLN" value={series.pln[K]} unit="kW" d={1} sub={`heater ${fmt(series.heater[K], 1)} kW`} max={40} color="#e34948" />
                <Gauge label="Baterai" value={(series.soc[K] ?? 0) * 100} unit="%" d={0} sub="state of charge" max={100} color="#1baf7a" />
                <div className="mon-day">
                  <div><b>{fmt(stats.pv, 0)}</b><span>kWh PV</span></div>
                  <div><b>{fmt(stats.pln, 1)}</b><span>kWh PLN</span></div>
                  <div><b>{fmt(stats.solarShare * 100, 0)}%</b><span>porsi surya</span></div>
                  <div><b>{stats.batches}</b><span>batch</span></div>
                </div>
              </div>
            </div>

            <div className="mon-acc">
              <Acc t="RMSE prediksi 1-langkah" v={`${fmt(acc.rmse, 2)} °C`} s="akurasi model termal tiap 15 menit" />
              <Acc t="RMSE twin (asimilasi per jam)" v={`${fmt(acc.openRmse, 1)} °C`} s="twin berjalan bebas, disinkronkan tiap jam" />
              <Acc t="MAPE prakiraan PV" v={acc.mape != null ? `${fmt(acc.mape, 1)}%` : '—'} s="galat prakiraan vs PV aktual (siang)" />
              <Acc t="Ambang anomali (3σ)" v={`± ${fmt(3 * twin.sigma, 1)} °C`} s="σ robust dari median deviasi absolut" alert={shownAnoms.length > 0} />
            </div>

            <div className="mon-grid">
              <div className="card-w span2">
                <h3>Suhu pelat: terukur vs digital twin</h3>
                <div className="legend"><span><i className="sw line" style={{ background: C.act }} />Terukur</span><span><i className="sw line" style={{ background: C.twin }} />Digital twin</span>{series.planTemp && <span><i className="sw line" style={{ background: C.plan }} />Rencana optimal</span>}<span><i className="sw" style={{ background: '#d03b3b', borderRadius: '50%' }} />Anomali</span><span><i className="sw" style={{ background: 'rgba(19,144,106,.2)' }} />Jendela 185–200 °C</span></div>
                <ChartCanvas config={tempCfg} label="Grafik suhu terukur dan digital twin" height={280} />
              </div>
              <div className="card-w">
                <h3>Energi: PV aktual vs prakiraan</h3>
                <div className="legend"><span><i className="sw line" style={{ background: C.pv }} />PV aktual</span><span><i className="sw line" style={{ background: C.pvfc }} />PV prakiraan</span><span><i className="sw line" style={{ background: C.pln }} />PLN</span></div>
                <ChartCanvas config={pvCfg} label="Grafik PV dan PLN" height={230} />
              </div>
              <div className="card-w">
                <h3>Residual model (terukur − prediksi)</h3>
                <div className="legend"><span><i className="sw" style={{ background: 'rgba(42,120,214,.55)' }} />Normal</span><span><i className="sw" style={{ background: '#d03b3b' }} />&gt; 3σ</span><span><i className="sw" style={{ background: 'rgba(19,144,106,.2)' }} />±3σ</span></div>
                <ChartCanvas config={resCfg} label="Grafik residual" height={230} />
              </div>
              <div className="card-w span2">
                <h3>Log anomali & peringatan {shownAnoms.length > 0 && <span className="pill-bad">{shownAnoms.length}</span>}</h3>
                {shownAnoms.length === 0
                  ? <p className="muted">✅ Tidak ada anomali sampai {timeLabel}. Mesin berperilaku sesuai model.</p>
                  : <ul className="alog">{shownAnoms.slice().reverse().map((a, i) => (
                    <li key={i} className={a.type}><span className="mono">{series.t[a.k].slice(11, 16)}</span><b>{a.type === 'residual' ? 'Penyimpangan model' : 'Kualitas suhu'}</b>{a.msg}</li>
                  ))}</ul>}
              </div>
            </div>
          </>
        )}
        {!series && mode !== 'sim' && <div className="card-w" style={{ marginTop: 18 }}><p className="muted">{mode === 'csv' ? 'Pilih file CSV atau klik “Pakai contoh”.' : 'Menunggu data dari perangkat…'}</p></div>}

        <div className="card-w" style={{ marginTop: 18 }}>
          <h3>Cara kerja digital twin</h3>
          <p className="muted">Twin memakai model termal yang sama dengan Scheduler, <span className="mono">C·dθ/dt = η·P_heater − UA(θ − T_amb) − q_leleh</span>, diberi input daya heater dan status menekan yang terukur. Prediksi satu langkah dipakai untuk deteksi anomali (|residual| &gt; 3σ), sedangkan twin berjalan bebas disinkronkan ke pengukuran setiap jam. Detail model di <Link to="/metodologi#termal" style={{ color: 'var(--green)', fontWeight: 600 }}>Metodologi</Link>.</p>
        </div>
      </section>
    </main>
  );
}

function Gauge({ label, value, unit, d, sub, max, band, color }) {
  const v = Number.isFinite(value) ? value : 0;
  const pct = Math.max(0, Math.min(1, v / max));
  const R = 34, Cc = 2 * Math.PI * R, arc = 0.75;
  const inBand = band ? v >= band[0] && v <= band[1] : null;
  return (
    <div className="gauge">
      <svg viewBox="0 0 84 84" width="78" height="78" aria-hidden="true">
        <circle cx="42" cy="42" r={R} fill="none" stroke="#e7ede5" strokeWidth="8" strokeDasharray={`${Cc * arc} ${Cc}`} transform="rotate(135 42 42)" strokeLinecap="round" />
        <circle cx="42" cy="42" r={R} fill="none" stroke={color} strokeWidth="8" strokeDasharray={`${Cc * arc * pct} ${Cc}`} transform="rotate(135 42 42)" strokeLinecap="round" style={{ transition: 'stroke-dasharray .4s' }} />
      </svg>
      <div>
        <div className="gl">{label}{inBand != null && <span className={'gb ' + (inBand ? 'ok' : '')}>{inBand ? 'dalam jendela' : 'di luar jendela'}</span>}</div>
        <div className="gv">{fmt(v, d)}<small>{unit}</small></div>
        <div className="gs">{sub}</div>
      </div>
    </div>
  );
}
function Acc({ t, v, s, alert }) {
  return <div className={'acc' + (alert ? ' alert' : '')}><span>{t}</span><b>{v}</b><small>{s}</small></div>;
}
