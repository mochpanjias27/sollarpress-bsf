// Vercel Serverless Function: proxy + cache prakiraan Open-Meteo.
// GET /api/forecast?lat=-6.9183&lon=107.4739&tilt=10&days=8
// Keuntungan: tidak tergantung CORS di browser, respons di-cache di edge Vercel (30 menit).

const DEFAULTS = { lat: -6.9183, lon: 107.4739, tilt: 10, azimuth: 180, days: 8 };

function num(v, d, min, max) {
  const x = Number(v);
  if (!Number.isFinite(x)) return d;
  return Math.min(max, Math.max(min, x));
}

export default async function handler(req, res) {
  const q = req.query || {};
  const lat = num(q.lat, DEFAULTS.lat, -90, 90);
  const lon = num(q.lon, DEFAULTS.lon, -180, 180);
  const tilt = num(q.tilt, DEFAULTS.tilt, 0, 90);
  const azimuth = num(q.azimuth, DEFAULTS.azimuth, -180, 180); // 180 = menghadap utara
  const days = Math.round(num(q.days, DEFAULTS.days, 1, 16));

  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.search = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    hourly: 'global_tilted_irradiance,shortwave_radiation,temperature_2m,cloud_cover',
    tilt: String(tilt),
    azimuth: String(azimuth),
    forecast_days: String(days),
    timezone: 'Asia/Jakarta',
  }).toString();

  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'solarpress-web/1.0' } });
    if (!r.ok) {
      res.status(502).json({ error: `Open-Meteo HTTP ${r.status}` });
      return;
    }
    const data = await r.json();
    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');
    res.status(200).json({ ...data, _source: 'open-meteo', _fetchedAt: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ error: String(e && e.message ? e.message : e) });
  }
}
