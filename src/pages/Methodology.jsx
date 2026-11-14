import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Tex from '../components/Tex.jsx';

const TOC = [
  ['ringkas', 'Ringkasan'], ['prakiraan', '1. Prakiraan PV'], ['termal', '2. Model termal'], ['daya', '3. Neraca daya'],
  ['optimisasi', '4. Masalah optimisasi'], ['dp', '5. Algoritma DP'], ['mingguan', '6. Dekomposisi mingguan'],
  ['robust', '7. Ketidakpastian'], ['asumsi', '8. Asumsi & parameter'], ['lanjut', '9. Pengembangan'],
];

export default function Methodology() {
  const { hash } = useLocation();
  useEffect(() => { if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth' }); }, [hash]);
  return (
    <main>
      <section className="phead">
        <div className="container">
          <span className="eyebrow">Metodologi</span>
          <h1>Model matematika <span className="grad">optimisasi jadwal siklus press</span></h1>
          <p className="lead">Dari prakiraan iradiasi hingga instruksi jam operator: model termal, neraca energi, dan dynamic programming dengan dekomposisi dua tingkat.</p>
        </div>
      </section>
      <section className="section" style={{ paddingTop: 50 }}>
        <div className="container with-toc">
          <nav className="toc" aria-label="Daftar isi">{TOC.map(([id, t]) => <a key={id} href={`#${id}`}>{t}</a>)}</nav>
          <article className="prose">
            <h2 id="ringkas" style={{ marginTop: 0 }}>Ringkasan</h2>
            <p>
              Mesin hot press adalah beban yang <strong>hampir seluruhnya termal</strong>: listrik dipakai heater oli 30 kW untuk menjaga pelat baja pada
              185–200 °C. Massa pelat dan oli (≈1,56 MJ/K) dapat diperlakukan sebagai <strong>penyimpan panas</strong>, sehingga pemanasan bisa
              digeser ke jam ketika panel surya paling produktif. Masalahnya: memilih kapan heater menyala dan kapan setiap batch dimulai agar impor
              listrik PLN minimum, dengan tetap memenuhi kendala suhu (kualitas), waktu (jam kerja), dan target produksi.
            </p>
            <p>Model ini memperluas model pemanasan <Tex>{'Q = m c \\Delta T'}</Tex> dan <Tex>{'dT/dt = P/(mc)'}</Tex> serta model kompaksi <Tex>{'F = P \\cdot A'}</Tex> dari Indra dkk. (2025).</p>

            <h2 id="prakiraan">1. Prakiraan matahari → daya PV</h2>
            <p>Iradiasi pada bidang panel <Tex>{'G_{POA,t}'}</Tex> (Open-Meteo, per jam, kemiringan 10°, menghadap utara) diinterpolasi ke slot <Tex>{'\\Delta t = 15'}</Tex> menit. Daya PV:</p>
            <Tex block>{'P^{PV}_t = \\mathrm{kWp}\\cdot\\frac{G_{POA,t}}{1000}\\cdot PR\\cdot\\bigl[1+\\gamma\\,(T^{cell}_t-25)\\bigr],\\qquad T^{cell}_t = T^{amb}_t + G_{POA,t}\\,\\frac{NOCT-20}{800}'}</Tex>
            <p>dengan <Tex>{'PR = 0{,}80'}</Tex>, <Tex>{'\\gamma = -0{,}0035/^{\\circ}\\mathrm{C}'}</Tex>, <Tex>{'NOCT = 45^{\\circ}\\mathrm{C}'}</Tex>, dan pemotongan pada kapasitas inverter.</p>

            <h2 id="termal">2. Model termal pelat + oli (lumped RC)</h2>
            <p>Model <Tex>{'dT/dt = P/(mc)'}</Tex> diperluas dengan massa termal pelat dan oli, rugi panas ke lingkungan, serta beban leleh plastik:</p>
            <Tex block>{'C_{th}\\,\\frac{\\theta_{t+1}-\\theta_t}{\\Delta t} = \\eta_H\\,u_t\\,P_H - UA\\,(\\theta_t - T^{amb}_t) - q_t'}</Tex>
            <Tex block>{'C_{th} = m_{baja}c_{baja} + m_{oli}c_{oli},\\qquad E_b = m_b\\bigl[c_p\\,(T_{leleh}-T_0) + L_f\\bigr]'}</Tex>
            <p>
              <Tex>{'u_t\\in\\{0,\\tfrac14,\\tfrac12,\\tfrac34,1\\}'}</Tex> adalah tingkat daya heater; <Tex>{'q_t'}</Tex> adalah energi leleh batch <Tex>{'E_b'}</Tex> yang
              disebar ke slot tekan (proporsi 0,5 : 0,3 : 0,2 untuk tekan 45 menit). Untuk batch 5 × 30 kg diperoleh <Tex>{'E_b \\approx 19{,}8'}</Tex> kWh — lebih besar
              dari kapasitas heater selama 45 menit, sehingga pelat <strong>harus dipanaskan di atas batas bawah</strong> sebelum batch masuk.
            </p>
            <table className="tbl"><thead><tr><th>Besaran</th><th>Nilai</th></tr></thead><tbody>
              <tr><td>Massa pelat baja / oli</td><td>2.500 kg / 150 kg</td></tr>
              <tr><td>Kapasitas panas <Tex>{'C_{th}'}</Tex></td><td>1,56 MJ/K</td></tr>
              <tr><td>Koefisien rugi panas <Tex>{'UA'}</Tex></td><td>22 W/K (≈3,6 kW pada 190 °C)</td></tr>
              <tr><td>Konstanta waktu pendinginan <Tex>{'C_{th}/UA'}</Tex></td><td>≈ 19,6 jam</td></tr>
            </tbody></table>

            <h2 id="daya">3. Neraca daya listrik & baterai</h2>
            <Tex block>{'\\tilde P^{PV}_t + g_t + b^d_t = u_t P_H + L^{aux}_t + b^c_t + c_t'}</Tex>
            <Tex block>{'SOC_{t+1} = SOC_t + \\frac{\\bigl(\\eta_c\\, b^c_t - b^d_t/\\eta_d\\bigr)\\Delta t}{E_{bat}},\\qquad SOC_{min}\\le SOC_t\\le SOC_{max}'}</Tex>
            <p><Tex>{'g_t'}</Tex> = impor PLN, <Tex>{'c_t'}</Tex> = PV terbuang (diasumsikan tidak dikompensasi), <Tex>{'L^{aux}_t'}</Tex> = beban fasilitas lain dan pompa hidrolik. Baterai bekerja dengan aturan self-consumption.</p>

            <h2 id="optimisasi">4. Masalah optimisasi</h2>
            <Tex block>{'\\min\\; \\sum_t \\Bigl[(\\pi_t + \\lambda\\,EF)\\,g_t + \\tfrac{\\kappa_{bat}}{2}(b^c_t+b^d_t)\\Bigr]\\Delta t \\; + \\; M\\sum_d \\max(0, N_d - n_d)'}</Tex>
            <p>dengan kendala:</p>
            <ul>
              <li>dinamika termal (2) dan SOC (3);</li>
              <li>kualitas: <Tex>{'185 \\le \\theta_t \\le 200\\,^{\\circ}\\mathrm{C}'}</Tex> pada awal dan akhir setiap slot tekan; <Tex>{'\\theta_t \\le 210\\,^{\\circ}\\mathrm{C}'}</Tex> setiap saat;</li>
              <li>batch hanya dimulai pada jam kerja dan selesai sebelum jam kerja berakhir; satu batch pada satu waktu (tekan + ganti cetakan);</li>
              <li>heater hanya pada jendela jam yang diizinkan;</li>
              <li>target produksi <Tex>{'N_d'}</Tex> per hari (mode harian) atau <Tex>{'\\sum_d n_d = N_{total}'}</Tex> (mode mingguan).</li>
            </ul>
            <p>
              <Tex>{'\\pi_t'}</Tex> tarif PLN (B-2/TR Rp1.444,70/kWh, opsi WBP), <Tex>{'EF'}</Tex> faktor emisi jaringan (0,87 kg CO₂/kWh), <Tex>{'\\lambda'}</Tex> harga karbon,
              <Tex>{'\\kappa_{bat}'}</Tex> biaya degradasi baterai, <Tex>{'M'}</Tex> penalti batch yang tidak tercapai. Dengan tarif datar dan <Tex>{'EF'}</Tex> konstan,
              minimisasi biaya dan emisi menjadi ekuivalen; keduanya berbeda bila tarif WBP aktif.
            </p>

            <h2 id="dp">5. Algoritma: dynamic programming</h2>
            <p>State pada slot <Tex>{'t'}</Tex>: <Tex>{'s_t = (\\theta_t, SOC_t, k_t, \\phi_t)'}</Tex> — suhu, SOC, batch selesai hari itu, dan fase batch berjalan. Persamaan Bellman:</p>
            <Tex block>{'V_t(s) = \\min_{a\\in\\mathcal A(s,t)} \\Bigl\\{ c_t(s,a) + V_{t+1}\\bigl(f_t(s,a)\\bigr) \\Bigr\\}'}</Tex>
            <ul>
              <li><Tex>{'\\theta'}</Tex> didiskretisasi tiap 3 °C (20–212 °C) dan SOC tiap 8,5%; nilai di antara titik grid diperoleh dengan <strong>interpolasi bilinear</strong>.</li>
              <li>Backward pass per hari dengan <strong>checkpoint</strong> nilai di awal hari (memori kecil), lalu forward pass dengan state kontinu dan one-step lookahead.</li>
              <li>Pemangkasan state yang tak terjangkau (mis. <Tex>{'k>0'}</Tex> sebelum jam kerja). Horizon 7 hari diselesaikan ±6 detik di browser (Web Worker).</li>
            </ul>

            <h2 id="mingguan">6. Dekomposisi dua tingkat (mode mingguan)</h2>
            <p>
              Tingkat atas memilih jumlah batch per hari <Tex>{'n_d'}</Tex>. Kurva biaya harian <Tex>{'c_d(n)'}</Tex> untuk semua <Tex>{'n'}</Tex> diperoleh dari <strong>satu</strong> DP per hari
              dengan state "sisa batch" <Tex>{'r = n - k'}</Tex>: nilai <Tex>{'V_0(\\theta_0, SOC_0, r=n)'}</Tex> langsung memberi <Tex>{'c_d(n)'}</Tex>. Alokasi lalu diselesaikan dengan DP knapsack:
            </p>
            <Tex block>{'\\min_{n_1,\\dots,n_D}\\; \\sum_{d=1}^{D} c_d(n_d)\\quad\\text{s.t.}\\quad \\sum_d n_d = N_{total},\\;\\; 0\\le n_d\\le n_{max}'}</Tex>
            <p>Tingkat bawah kemudian menjalankan DP penuh dengan target <Tex>{'n_d^*'}</Tex> per hari, termasuk keterkaitan antarhari (SOC dan sisa panas pelat).</p>

            <h2 id="robust">7. Ketidakpastian prakiraan</h2>
            <p>Galat prakiraan PV dimodelkan sebagai himpunan ketidakpastian kotak dengan simpangan bergantung tutupan awan:</p>
            <Tex block>{'\\sigma_t = P^{PV}_t\\,(0{,}08 + 0{,}35\\,\\tfrac{\\text{awan}_t}{100}),\\qquad \\tilde P^{PV}_t = P^{PV}_t - \\Gamma\\,\\sigma_t'}</Tex>
            <p><Tex>{'\\Gamma = 0'}</Tex> memberi jadwal nominal; <Tex>{'\\Gamma = 1'}</Tex> jadwal konservatif yang tetap layak saat matahari lebih redup dari prakiraan. Jadwal selalu dievaluasi ulang dengan PV nominal.</p>

            <h2 id="asumsi">8. Asumsi & parameter bawaan</h2>
            <table className="tbl"><thead><tr><th>Komponen</th><th>Asumsi</th><th>Sumber</th></tr></thead><tbody>
              <tr><td>PLTS (Rp1,5 M)</td><td>PV 70 kWp, baterai LiFePO₄ 60 kWh, inverter hybrid 60 kW</td><td>asumsi wajar</td></tr>
              <tr><td>Heater oli</td><td>30 kW, efisiensi 0,95</td><td>Indra dkk. (2025)</td></tr>
              <tr><td>Batch</td><td>5 cetakan × 30 kg (papan 130×250×1 cm, ρ≈920 kg/m³), tekan 45 menit</td><td>Indra dkk. (2025), dihitung ulang</td></tr>
              <tr><td>Beban lain</td><td>6 kW selama jam kerja; pompa hidrolik 2 kW saat menekan</td><td>asumsi</td></tr>
              <tr><td>Tarif</td><td>B-2/TR Rp1.444,70/kWh (triwulan IV-2026)</td><td>PLN</td></tr>
              <tr><td>Faktor emisi</td><td>0,87 kg CO₂/kWh (jaringan Jawa-Bali)</td><td>asumsi umum</td></tr>
              <tr><td>Jadwal konvensional</td><td>heater penuh dari jam kerja, batch berurutan saat θ ≥ 190 °C, termostat 195–198 °C</td><td>pembanding</td></tr>
            </tbody></table>
            <p>Catatan: Indra dkk. (2025) menyebut ±3,2 kg bahan per cetakan 130 × 250 cm; perhitungan volume × densitas memberi ±30 kg untuk tebal 10 mm, sehingga model memakai 30 kg.</p>

            <h2 id="lanjut">9. Pengembangan berikutnya</h2>
            <ul>
              <li>Kalibrasi model PV dengan data historis inverter (regresi/ML koreksi bias prakiraan).</li>
              <li>Identifikasi parameter termal (<Tex>{'C_{th}, UA'}</Tex>) dari uji pemanasan aktual mesin.</li>
              <li>Optimisasi robust / stokastik berbasis skenario prakiraan ensemble; chance constraint pada kualitas suhu.</li>
              <li>Integrasi IoT: panel kontrol menerima jadwal otomatis dan mengirim data suhu & energi kembali (MPC loop tertutup).</li>
            </ul>
            <p><Link to="/scheduler" className="btn primary arrow" style={{ marginTop: 16 }}>Coba model di Scheduler</Link></p>
          </article>
        </div>
      </section>
    </main>
  );
}
