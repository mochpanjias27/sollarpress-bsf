# SolarPress — Website Optimisasi Mesin Press Plastik Bertenaga Surya

Website untuk riset **optimisasi jadwal siklus mesin press plastik low-value menjadi multi-purpose board** bertenaga surya
(Bening Saguling Foundation × Departemen Matematika FMIPA Universitas Padjadjaran).

Fitur utama:

- **Beranda** — hero diorama 3D isometrik (matahari → panel surya → baterai → mesin hot press; sampah plastik → hopper → konveyor → pencacah → press → papan), HUD simulasi live, alur proses, *exploded view* 3D komponen (hot press, panel surya, baterai & kontrol), dan teaser prakiraan energi surya 7 hari.
- **Scheduler** — aplikasi optimisasi: prakiraan iradiasi → daya PV, model termal pelat + oli, dynamic programming per 15 menit, mode target harian / mingguan fleksibel, perbandingan dengan jadwal konvensional, instruksi operator (salin/unduh CSV).
- **Pemanfaatan** — galeri foto produk dari kedua artikel (lemari, pintu, tempat sampah terpilah, meja–kursi, panel atap, gerobak, partisi, atap), animasi 3D papan 120 × 240 cm dipotong lalu dirakit menjadi produk, formulasi bahan, daftar aplikasi, dan pendekatan desain.
- **Monitoring & digital twin** — telemetri (simulasi live / unggah CSV / perangkat IoT via API), twin 3D yang mengikuti data, suhu terukur vs prediksi model, residual ±3σ, log anomali, RMSE & MAPE.
- **Tekno-ekonomi & risiko** — arus kas 20 tahun, NPV, IRR, payback, BCR, LCOE PLTS, NPV inkremental PLTS, Monte Carlo dengan VaR/CVaR 5%, tornado sensitivitas, emisi dihindari.
- **Dampak** — penghitung kumulatif real-time (sampah terolah, papan, kWh surya, CO₂e), kesetaraan, grafik bulanan, peta SDGs.
- **Metodologi** — formulasi matematika lengkap (KaTeX).
- **Tentang** — latar belakang, lokasi, publikasi, tim.
- **API** `/api/forecast` — Vercel Serverless Function yang mem-proxy & meng-cache prakiraan Open-Meteo (30 menit).
- **API** `/api/telemetry` — penerima data sensor mesin (POST, dengan API key) dan penyedia data untuk halaman Monitoring (GET).

## Teknologi

| Lapisan | Pustaka |
|---|---|
| Build | Vite 5 |
| UI | React 18, React Router 6 |
| 3D | three.js, @react-three/fiber, @react-three/drei |
| Grafik | Chart.js 4 |
| Rumus | KaTeX |
| Komputasi | Web Worker (optimisasi berjalan di browser) |
| Backend | Vercel Serverless Function (`api/forecast.js`) |

## Struktur proyek

```
solarpress-web/
├── api/
│   ├── forecast.js          # proxy + cache Open-Meteo (Vercel Function)
│   └── telemetry.js         # penerima/penyedia telemetri (Upstash Redis opsional)
├── public/
│   ├── favicon.svg
│   └── images/produk/       # foto produk dari figur artikel
├── scripts/
│   └── test-engine.mjs      # uji cepat mesin optimisasi (Node)
├── src/
│   ├── engine/
│   │   ├── engine.js        # model PV, termal, baterai, DP, baseline, alokasi mingguan
│   │   ├── worker.js        # Web Worker untuk optimisasi
│   │   └── forecast.js      # pengambilan prakiraan: /api → Open-Meteo → sintetis
│   ├── three/
│   │   ├── HeroScene.jsx    # diorama 3D hero
│   │   ├── TechExplorer.jsx # exploded view komponen
│   │   ├── BoardAssembler.jsx # animasi papan → produk
│   │   └── materials.js     # palet, tekstur prosedural, state animasi
│   ├── components/          # Nav, Footer, ChartCanvas, Tex, useReveal
│   ├── pages/               # Home, Scheduler, Monitoring, Economics, Impact, Products, Methodology, About
│   ├── styles/              # global.css, scheduler.css
│   ├── site.js              # konfigurasi situs: lokasi, publikasi, alur proses
│   ├── products.js          # data halaman Pemanfaatan (galeri, formulasi, aplikasi)
│   ├── impact.js            # konfigurasi & rumus penghitung dampak
│   ├── econ/model.js        # model tekno-ekonomi, Monte Carlo, VaR, tornado
│   ├── telemetry/           # model digital twin & parser CSV
│   ├── App.jsx
│   └── main.jsx
├── .github/workflows/ci.yml # CI: uji engine + build
├── index.html
├── package.json
├── vercel.json              # SPA rewrites + cache header
└── vite.config.js
```

## Menjalankan secara lokal

Butuh Node.js 18+ (disarankan 20).

```bash
npm install
npm run dev          # http://localhost:5173
npm run test:engine  # uji mesin optimisasi
npm run build        # hasil di dist/
npm run preview      # pratinjau hasil build
```

> Saat `npm run dev`, endpoint `/api/forecast` belum tersedia (itu fungsi Vercel). Situs otomatis
> mencoba Open-Meteo langsung, lalu jatuh ke data sintetis. Untuk menjalankan fungsi API secara lokal:
> `npm i -g vercel` lalu `vercel dev`.

## Push ke GitHub

```bash
cd solarpress-web
git init
git add .
git commit -m "SolarPress website"
git branch -M main
git remote add origin https://github.com/<akun-anda>/solarpress-web.git
git push -u origin main
```

## Deploy ke Vercel

1. Masuk ke [vercel.com](https://vercel.com) → **Add New… → Project** → impor repositori GitHub `solarpress-web`.
2. Vercel mendeteksi **Vite** otomatis (Build Command `npm run build`, Output `dist`) — tidak perlu diubah.
3. Klik **Deploy**. Folder `api/` otomatis menjadi Serverless Function di `/api/forecast`.
4. Setiap `git push` ke `main` akan men-deploy ulang secara otomatis.

Tidak ada environment variable yang wajib — Open-Meteo gratis tanpa API key untuk penggunaan non-komersial.

### Mengaktifkan telemetri perangkat (opsional)

1. Di dashboard Vercel → **Storage / Marketplace** → tambahkan **Upstash for Redis** ke proyek.
2. Pastikan environment variable `UPSTASH_REDIS_REST_URL` dan `UPSTASH_REDIS_REST_TOKEN` tersedia, lalu buat `TELEMETRY_KEY` (string rahasia bebas).
3. Panel kontrol / ESP32 / gateway mengirim JSON tiap 15 menit dengan metode POST ke `/api/telemetry` dan header `x-api-key` berisi `TELEMETRY_KEY`. Contoh isi: `{"waktu":"2026-11-16T10:15","suhu_pelat":192.4,"daya_heater":22.5,"daya_pv":41.2,"daya_pln":0,"soc":0.82,"menekan":1}`.
4. Buka halaman **Monitoring → Perangkat IoT (API)**. Tanpa konfigurasi ini, halaman tetap berjalan dengan mode simulasi dan unggah CSV (template: `public/data/template-telemetri.csv`).

## Menyesuaikan parameter

- **Lokasi, alamat, publikasi** → `src/site.js`
- **Asumsi bawaan model** (kWp, baterai, heater, massa pelat, tarif, dll.) → `defaultParams()` di `src/engine/engine.js`
- Pengguna juga dapat mengubah semua parameter langsung di halaman Scheduler (tersimpan di browser).

## Asumsi bawaan (ganti dengan data lapangan)

| Komponen | Nilai |
|---|---|
| PLTS (Rp1,5 M) | PV 70 kWp, baterai LiFePO₄ 60 kWh, inverter hybrid 60 kW |
| Heater oli | 30 kW, efisiensi 0,95 |
| Massa termal | pelat baja 2.500 kg + oli 150 kg (C ≈ 1,56 MJ/K), UA 22 W/K |
| Batch | 5 cetakan × 30 kg, tekan 45 menit pada 185–200 °C |
| Beban lain | 6 kW pada jam kerja, pompa hidrolik 2 kW saat menekan |
| Tarif | B-2/TR Rp1.444,70/kWh (triwulan IV-2026) |
| Emisi | 0,87 kg CO₂/kWh |

## Lisensi data

Data cuaca dari [Open-Meteo](https://open-meteo.com) (CC BY 4.0).
