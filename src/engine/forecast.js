// Mengambil prakiraan cuaca dengan urutan fallback:
// 1) /api/forecast (Vercel serverless, ter-cache)  2) Open-Meteo langsung (CORS)  3) data sintetis.
import { parseOpenMeteo, syntheticForecast } from './engine.js';
import { SITE } from '../site.js';

export function openMeteoUrl(p = {}) {
  const lat = p.lat ?? SITE.lat, lon = p.lon ?? SITE.lon, tilt = p.tilt ?? 10;
  return `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=global_tilted_irradiance,temperature_2m,cloud_cover&tilt=${tilt}&azimuth=180&forecast_days=8&timezone=Asia%2FJakarta`;
}

async function getJson(url, ms = 8000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}

export function todayJakarta() {
  return new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
}

export function synthetic(p) {
  const start = todayJakarta();
  const seed = parseInt(start.replace(/-/g, ''), 10) % 100000;
  return { fc: syntheticForecast(p, start, 7, seed), source: 'synthetic' };
}

export async function loadForecast(p) {
  const tilt = p.tilt ?? 10;
  try {
    const js = await getJson(`/api/forecast?lat=${p.lat}&lon=${p.lon}&tilt=${tilt}&days=8`);
    if (js && js.hourly) return { fc: parseOpenMeteo(js), source: 'live' };
  } catch (_) { /* lanjut */ }
  try {
    const js = await getJson(openMeteoUrl(p));
    if (js && js.hourly) return { fc: parseOpenMeteo(js), source: 'live' };
  } catch (_) { /* lanjut */ }
  return synthetic(p);
}
