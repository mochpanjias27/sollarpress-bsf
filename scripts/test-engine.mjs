// Uji cepat mesin optimisasi di Node: `npm run test:engine`
import { defaultParams, syntheticForecast, toSlots, optimize, baseline, allocate } from '../src/engine/engine.js';

const p = defaultParams();
const start = '2026-11-14';
const fc = syntheticForecast(p, start, 7, 61114);
const S = toSlots(p, fc, start, 7);
let t = Date.now();
const B = baseline(p, S);
const O = optimize(p, S);
console.log(`Harian  : PLN optimal ${O.total.gridE.toFixed(1)} kWh vs konvensional ${B.total.gridE.toFixed(1)} kWh (${Date.now() - t} ms)`);
t = Date.now();
const A = allocate(p, S, 36, 8);
const W = optimize({ ...p, targets: A.alloc }, S);
console.log(`Mingguan: alokasi [${A.alloc}] → PLN ${W.total.gridE.toFixed(1)} kWh (${Date.now() - t} ms)`);
if (O.total.violations || W.total.violations) { console.error('Pelanggaran suhu pada jadwal optimal!'); process.exit(1); }
if (O.total.batches !== B.total.batches) { console.error('Jumlah batch tidak sama!'); process.exit(1); }
console.log('OK');
