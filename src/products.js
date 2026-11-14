// Data pemanfaatan multi-purpose board — dirangkum dari dua artikel proyek:
//  [A] Indra dkk. (2025) Engineering a Circular Economy … Multipurpose Board. J. Cyber Security 7(11).
//  [B] Supian dkk. (2025) Mathematical Model for Circular Economy Prospect Analysis … J. Cyber Security 7(12).

export const SRC = {
  A: 'Indra dkk. (2025)',
  B: 'Supian dkk. (2025)',
};

export const CATEGORIES = [
  { id: 'all', label: 'Semua' },
  { id: 'furnitur', label: 'Furnitur' },
  { id: 'konstruksi', label: 'Konstruksi & interior' },
  { id: 'utilitas', label: 'Utilitas & lainnya' },
];

// Produk dengan foto (gambar diambil dari figur artikel)
export const GALLERY = [
  { id: 'lemari', cat: 'furnitur', title: 'Lemari & rak', img: '/images/produk/lemari.jpg', src: 'A', fig: 'Fig. 3a',
    desc: 'Rak bertingkat dan lemari dari papan rigid. Tahan lembap sehingga cocok untuk dapur, gudang, maupun ruang kelas.' },
  { id: 'pintu', cat: 'konstruksi', title: 'Daun pintu', img: '/images/produk/pintu.jpg', src: 'A', fig: 'Fig. 3b',
    desc: 'Papan padat sebagai daun pintu: tidak lapuk, tidak dimakan rayap, dan tahan percikan air di kamar mandi.' },
  { id: 'tempat-sampah', cat: 'utilitas', title: 'Tempat sampah terpilah', img: '/images/produk/tempat-sampah.jpg', src: 'A', fig: 'Fig. 3c',
    desc: 'Tempat sampah tiga kompartemen (organik, anorganik, B3) — sampah plastik kembali menjadi sarana pemilahan sampah.' },
  { id: 'meja-kursi', cat: 'furnitur', title: 'Meja & kursi', img: '/images/produk/meja-kursi.jpg', src: 'A', fig: 'Fig. 3d',
    desc: 'Daun meja dan dudukan dari papan, rangka baja. Untuk meja belajar, meja lipat, meja tamu, atau komponen modular.' },
  { id: 'panel-atap', cat: 'konstruksi', title: 'Panel atap', img: '/images/produk/panel-atap.jpg', src: 'A', fig: 'Fig. 3e',
    desc: 'Lembaran atap datar/bergelombang mirip uPVC atau polikarbonat. Ringan dan tahan cuaca sehingga mudah dipasang.' },
  { id: 'gerobak', cat: 'utilitas', title: 'Gerobak', img: '/images/produk/gerobak.jpg', src: 'A', fig: 'Fig. 3f',
    desc: 'Bak gerobak dorong dari papan — kuat, tahan air, dan mudah dibersihkan untuk angkutan sampah atau hasil kebun.' },
  { id: 'lembaran', cat: 'konstruksi', title: 'Lembaran multi-purpose board', img: '/images/produk/lembaran-papan.jpg', src: 'B', fig: 'Fig. 1',
    desc: 'Bahan baku utama: lembaran 120 × 240 cm dengan motif bintik warna alami plastik, siap dipotong untuk berbagai produk.' },
  { id: 'meja-taman', cat: 'furnitur', title: 'Set meja–kursi taman', img: '/images/produk/meja-kursi-taman.jpg', src: 'B', fig: 'Fig. 2',
    desc: 'Komposit plastik–baja: kekuatan rangka baja dipadu daya tahan papan daur ulang untuk furnitur luar ruang dan decking.' },
  { id: 'meja-bundar', cat: 'furnitur', title: 'Meja bundar', img: '/images/produk/meja-bundar.jpg', src: 'B', fig: 'Fig. 3',
    desc: 'Daun meja bundar berdiameter besar untuk area komunal, kafe, atau balai warga.' },
  { id: 'partisi', cat: 'konstruksi', title: 'Partisi dinding', img: '/images/produk/partisi-dinding.jpg', src: 'B', fig: 'Fig. 3',
    desc: 'Panel partisi interior/eksterior yang ringan dan tahan air, juga dapat dipakai sebagai panel dinding atau plafon.' },
  { id: 'atap-rangka', cat: 'konstruksi', title: 'Atap pada rangka baja', img: '/images/produk/atap-rangka.jpg', src: 'B', fig: 'Fig. 4',
    desc: 'Sandwich board daur ulang dipasang pada rangka baja ringan sebagai penutup atap bangunan.' },
  { id: 'atap-bangunan', cat: 'konstruksi', title: 'Atap bangunan sederhana', img: '/images/produk/atap-bangunan.jpg', src: 'B', fig: 'Fig. 4',
    desc: 'Penerapan pada bangunan sederhana: atap, pelapis dinding tahan air, dan panel dekoratif eksterior.' },
];

// Aplikasi lain yang disebutkan dalam teks artikel
export const MORE_USES = [
  { icon: '🗄️', t: 'Rak & kabinet', s: 'A' },
  { icon: '🍳', t: 'Kitchen set', s: 'A' },
  { icon: '📚', t: 'Meja baca / belajar', s: 'A' },
  { icon: '🪑', t: 'Kursi kafe & taman', s: 'A' },
  { icon: '🧱', t: 'Paving block', s: 'A' },
  { icon: '📦', t: 'Kotak penyimpanan', s: 'A' },
  { icon: '🪴', t: 'Pot & polybag', s: 'A' },
  { icon: '🏠', t: 'Rumah sederhana', s: 'A' },
  { icon: '🧩', t: 'Panel plafon & dinding', s: 'A' },
  { icon: '🎨', t: 'Panel dekoratif eksterior', s: 'A' },
  { icon: '🪵', t: 'Decking (lantai luar)', s: 'B' },
  { icon: '🛣️', t: 'Material konstruksi jalan', s: 'B' },
];

export const FORMULAS = [
  { id: 'rigid', name: 'Papan rigid', mix: [['MLP', 40], ['HDPE', 30], ['PP bening', 30]],
    desc: 'Kandungan MLP tinggi → kekakuan dan kuat tekan tinggi. Ideal untuk aplikasi struktural: lemari, partisi, atap.' },
  { id: 'flex', name: 'Papan fleksibel', mix: [['HDPE', 50], ['PP bening', 25], ['MLP', 25]],
    desc: 'Didominasi HDPE → lebih elastis dan tahan benturan. Cocok untuk kursi, gerobak, dan furnitur luar ruang.' },
  { id: 'smooth', name: 'Papan halus & lentur', mix: [['HDPE', 75], ['PP bening', 25]],
    desc: 'Permukaan paling halus dan paling lentur. Untuk daun meja, pintu, dan panel dekoratif.' },
];

export const MIX_COLORS = { MLP: '#c27a3a', HDPE: '#2e7d46', 'PP bening': '#9cc7a6' };

export const DESIGN = [
  { t: 'Komposit plastik–baja', d: 'Rangka baja memberi kekuatan, papan daur ulang memberi daya tahan — untuk decking dan furnitur taman.', s: 'B' },
  { t: 'Desain modular', d: 'Ukuran standar yang bisa dikombinasikan dan mudah dibongkar-pasang, dari meja hingga elemen arsitektur.', s: 'B' },
  { t: 'Estetika & tekstur', d: 'Memanfaatkan warna alami plastik atau pigmen tambahan agar tampil menarik, bukan sekadar “plastik bekas”.', s: 'B' },
  { t: 'Sandwich board', d: 'Inti plastik daur ulang dengan lapisan luar material lain untuk kekuatan dan estetika, misalnya atap.', s: 'B' },
  { t: 'Komposit serat alam', d: 'Serpihan HDPE/LDPE dicampur bambu, sekam, atau serbuk kayu untuk menambah kekuatan.', s: 'A' },
  { t: 'Desain partisipatif', d: 'Melibatkan masyarakat dan sekolah dalam desain & produksi untuk menumbuhkan rasa memiliki.', s: 'B' },
];

export const PROPS = [
  ['💧', 'Tahan air', 'tidak menyerap air, cocok untuk area basah'],
  ['☀️', 'Tahan cuaca', 'untuk penggunaan dalam dan luar ruang'],
  ['🪶', 'Ringan & kuat', 'mudah diangkut dan dipasang'],
  ['🐜', 'Tidak lapuk', 'tidak dimakan rayap, pengganti kayu'],
];
