// Konfigurasi situs & data proyek (ubah di sini).
export const SITE = {
  name: 'SolarPress',
  org: 'Bening Saguling Foundation',
  partner: 'Departemen Matematika FMIPA Universitas Padjadjaran',
  address: 'Jl. SDN Cianjur, Babakan, Cihampelas, Kec. Cihampelas, Kab. Bandung Barat, Jawa Barat 40562',
  lat: -6.9183,
  lon: 107.4739,
  mapsUrl: 'https://maps.app.goo.gl/Y14T6HHQrxMUQeRn6',
  website: 'https://beningsaguling.org',
  investment: 1_500_000_000,
};

export const PUBLICATIONS = [
  {
    title: 'Engineering a Circular Economy: Designing a Machine to Transform Low-Value Plastic Waste into Multipurpose Board',
    authors: 'Indra, Sukono, M. P. A. Saputra, A. Sambas, A. S. Azahra, M. Lestari, A. A. Sya’imaa HS',
    venue: 'Journal of Cyber Security, Vol. 7, Issue 11, 2025',
    summary: 'Desain mesin sheet press (rangka WF400, hidrolik, pemanas oli ±30 kW) beserta model pemanasan Q = m·c·ΔT, dT/dt = P/(mc) dan model kompaksi F = P·A.',
  },
  {
    title: 'Mathematical Model for Circular Economy Prospect Analysis: Processing Low-Value Plastic Waste into High-Value Products and Minimizing Environmental Impacts',
    authors: 'Sudradjat Supian, Sukono, Riaman, M. P. A. Saputra, A. S. Azahra, M. Lestari, A. A. Sya’imaa HS, Indra',
    venue: 'Journal of Cyber Security, Vol. 7, Issue 12, 2025',
    summary: 'Model neraca massa, analisis biaya–manfaat (BCR) dan minimisasi emisi berbasis LCA untuk konversi sampah plastik menjadi papan multiguna.',
  },
];

export const PROCESS = [
  { k: '01', t: 'Pengumpulan & pemilahan', d: 'Sampah plastik low-value (PP, HDPE, LDPE, MLP/sachet) dikumpulkan lalu dipilah per jenis dan warna.' },
  { k: '02', t: 'Pencacahan & pencucian', d: 'Plastik dicacah menjadi serpihan kecil dan dicuci untuk menghilangkan kontaminan.' },
  { k: '03', t: 'Pengeringan & pencampuran', d: 'Serpihan dikeringkan, lalu dicampur sesuai formula: rigid, fleksibel, atau halus.' },
  { k: '04', t: 'Hot press 185–200 °C', d: 'Bahan ditimbang ke cetakan, ditekan hidrolik di antara pelat baja berpemanas oli selama 30–45 menit.' },
  { k: '05', t: 'Cold press & finishing', d: 'Papan didinginkan agar dimensinya stabil, lalu dipotong ke ukuran komersial 120 × 240 cm.' },
  { k: '06', t: 'Produk bernilai tinggi', d: 'Lemari, meja, kursi, pintu, partisi, panel atap — pengganti kayu yang tahan air dan cuaca.' },
];
