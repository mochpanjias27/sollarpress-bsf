// Parser CSV telemetri. Kolom wajib: waktu, suhu_pelat, daya_heater
// Kolom opsional: daya_pv, prakiraan_pv, daya_pln, beban_total, soc, menekan, suhu_lingkungan
const ALIAS = {
  waktu: ['waktu', 'time', 'timestamp', 'ts'],
  suhu_pelat: ['suhu_pelat', 'plate_temp', 'temp', 'suhu'],
  daya_heater: ['daya_heater', 'heater_kw', 'heater'],
  daya_pv: ['daya_pv', 'pv_kw', 'pv'],
  prakiraan_pv: ['prakiraan_pv', 'pv_forecast', 'pv_fc'],
  daya_pln: ['daya_pln', 'grid_kw', 'pln'],
  beban_total: ['beban_total', 'load_kw', 'load'],
  soc: ['soc', 'battery_soc'],
  menekan: ['menekan', 'pressing', 'press'],
  suhu_lingkungan: ['suhu_lingkungan', 'ambient', 'tamb'],
};

export function parseTelemetryCsv(text) {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 3) throw new Error('CSV terlalu pendek');
  const sep = lines[0].includes(';') && !lines[0].includes(',') ? ';' : ',';
  const head = lines[0].split(sep).map((h) => h.trim().toLowerCase());
  const col = {};
  for (const [k, al] of Object.entries(ALIAS)) { const i = head.findIndex((h) => al.includes(h)); if (i >= 0) col[k] = i; }
  for (const req of ['waktu', 'suhu_pelat', 'daya_heater']) if (col[req] == null) throw new Error(`Kolom wajib "${req}" tidak ditemukan`);
  const num = (v) => { if (v == null || v === '') return null; const x = parseFloat(String(v).replace(',', '.')); return Number.isFinite(x) ? x : null; };
  const S = { t: [], temp: [], heater: [], pv: [], pvFc: [], pln: [], load: [], soc: [], press: [], tamb: [] };
  for (const line of lines.slice(1)) {
    const c = line.split(sep);
    S.t.push(c[col.waktu].trim());
    S.temp.push(num(c[col.suhu_pelat]) ?? NaN);
    S.heater.push(num(c[col.daya_heater]) ?? 0);
    S.pv.push(col.daya_pv != null ? num(c[col.daya_pv]) ?? 0 : 0);
    S.pvFc.push(col.prakiraan_pv != null ? num(c[col.prakiraan_pv]) : null);
    S.pln.push(col.daya_pln != null ? num(c[col.daya_pln]) ?? 0 : 0);
    S.load.push(col.beban_total != null ? num(c[col.beban_total]) : null);
    const so = col.soc != null ? num(c[col.soc]) : null; S.soc.push(so != null && so > 1 ? so / 100 : so);
    S.press.push(col.menekan != null ? (num(c[col.menekan]) ? 1 : 0) : 0);
    S.tamb.push(col.suhu_lingkungan != null ? num(c[col.suhu_lingkungan]) : null);
  }
  // isi NaN suhu dengan nilai sebelumnya
  for (let k = 0; k < S.temp.length; k++) if (!Number.isFinite(S.temp[k])) S.temp[k] = k ? S.temp[k - 1] : 27;
  S.load = S.load.map((v, k) => v ?? S.heater[k]);
  return S;
}
