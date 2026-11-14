// Vercel Serverless Function: penerima & penyedia data telemetri mesin press.
//
//   POST /api/telemetry      (header  x-api-key: <TELEMETRY_KEY>)
//        body JSON satu titik atau array titik:
//        { "waktu": "2026-11-16T10:15", "suhu_pelat": 192.4, "daya_heater": 22.5, "daya_pv": 41.2,
//          "daya_pln": 0, "beban_total": 30.1, "soc": 0.82, "menekan": 1, "suhu_lingkungan": 29 }
//   GET  /api/telemetry?n=96 → { configured, points:[...] } (terbaru di akhir)
//
// Penyimpanan: Upstash Redis (Vercel Marketplace → Upstash for Redis). Setel env:
//   UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN, TELEMETRY_KEY
// Tanpa env tersebut endpoint menjawab { configured:false } dan situs memakai mode simulasi/CSV.

const KEY = 'solarpress:telemetry';
const MAX = 2880; // ±30 hari data per 15 menit

async function redis(cmd) {
  const url = process.env.UPSTASH_REDIS_REST_URL, token = process.env.UPSTASH_REDIS_REST_TOKEN;
  const r = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(cmd) });
  if (!r.ok) throw new Error('Redis HTTP ' + r.status);
  return (await r.json()).result;
}

const FIELDS = ['waktu', 'suhu_pelat', 'daya_heater', 'daya_pv', 'prakiraan_pv', 'daya_pln', 'beban_total', 'soc', 'menekan', 'suhu_lingkungan'];
function clean(p) {
  const o = {};
  for (const f of FIELDS) if (p[f] !== undefined && p[f] !== null) o[f] = f === 'waktu' ? String(p[f]).slice(0, 25) : Number(p[f]);
  if (!o.waktu) o.waktu = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 16);
  if (!Number.isFinite(o.suhu_pelat)) throw new Error('suhu_pelat wajib berupa angka');
  return o;
}

export default async function handler(req, res) {
  const configured = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
  res.setHeader('Cache-Control', 'no-store');
  if (!configured) { res.status(200).json({ configured: false, points: [] }); return; }
  try {
    if (req.method === 'POST') {
      if (!process.env.TELEMETRY_KEY || req.headers['x-api-key'] !== process.env.TELEMETRY_KEY) { res.status(401).json({ error: 'API key salah' }); return; }
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const pts = (Array.isArray(body) ? body : [body]).slice(0, 500).map(clean);
      await redis(['RPUSH', KEY, ...pts.map((p) => JSON.stringify(p))]);
      await redis(['LTRIM', KEY, -MAX, -1]);
      res.status(200).json({ ok: true, stored: pts.length });
      return;
    }
    const n = Math.min(MAX, Math.max(1, parseInt(req.query?.n, 10) || 96));
    const raw = await redis(['LRANGE', KEY, -n, -1]);
    res.status(200).json({ configured: true, points: (raw || []).map((s) => JSON.parse(s)) });
  } catch (e) {
    res.status(500).json({ configured: true, error: String(e && e.message ? e.message : e) });
  }
}
