/* =====================================================================
   TABUNGAN HEBAT - LOGIKA APLIKASI
   -----------------------------------------------------------------
   Semua data (profil, target, transaksi, misi, badge, dll) disimpan
   dalam SATU objek besar "data" yang otomatis disimpan ke localStorage
   setiap kali ada perubahan. Ini membuat pengelolaan data jadi lebih
   sederhana dibanding menyimpan banyak key terpisah.
   ===================================================================== */

const KEY_STORAGE = 'tabunganhebat_data';

// Formatter mata uang Rupiah
const formatRupiah = new Intl.NumberFormat('id-ID', { style:'currency', currency:'IDR', minimumFractionDigits:0 });

// Daftar maskot yang bisa dipilih
const DAFTAR_MASKOT = ['🐼','🐱','🐶','🦊','🐸','🐵','🦁','🐹'];

// Definisi level berdasarkan XP
const DAFTAR_LEVEL = [
  { nama:'Pemula', minXP:0 },
  { nama:'Rajin', minXP:100 },
  { nama:'Hebat', minXP:300 },
  { nama:'Sultan Kecil', minXP:700 }
];

// Definisi badge / pencapaian yang bisa didapat
const DAFTAR_BADGE = [
  { id:'setor_pertama', ikon:'🥉', judul:'Setoran Pertama', desk:'Berhasil setor pertama kali' },
  { id:'seratus_ribu', ikon:'💯', judul:'Rp100.000 Pertama', desk:'Total setoran mencapai Rp100.000' },
  { id:'lima_ratus_ribu', ikon:'🥈', judul:'Setengah Juta', desk:'Total setoran mencapai Rp500.000' },
  { id:'satu_juta', ikon:'🥇', judul:'Sejuta Rupiah', desk:'Total setoran mencapai Rp1.000.000' },
  { id:'streak_3', ikon:'🔥', judul:'Streak 3 Hari', desk:'Menabung 3 hari berturut-turut' },
  { id:'streak_7', ikon:'🔥🔥', judul:'Streak 7 Hari', desk:'Menabung 7 hari berturut-turut' },
  { id:'target_pertama', ikon:'🎯', judul:'Target Pertama', desk:'Membuat target tabungan pertama' },
  { id:'target_tercapai', ikon:'🏆', judul:'Target Tercapai', desk:'Berhasil mencapai satu target tabungan' },
  { id:'misi_10', ikon:'🎮', judul:'Misi Master', desk:'Menyelesaikan 10 misi harian' },
  { id:'level_hebat', ikon:'⭐', judul:'Naik Level Hebat', desk:'Mencapai level Hebat' }
];

// Tema yang bisa dibuka dengan poin koin
const DAFTAR_TEMA = [
  { id:'terang', nama:'Terang', harga:0, kelas:'' },
  { id:'gelap', nama:'Gelap', harga:0, kelas:'dark' },
  { id:'sunset', nama:'Sunset', harga:50, kelas:'tema-sunset' },
  { id:'galaksi', nama:'Galaksi', harga:100, kelas:'tema-galaksi' }
];

// ---------------------------------------------------------------------
// STRUKTUR DATA DEFAULT (dipakai jika belum ada data tersimpan)
// ---------------------------------------------------------------------
function dataDefault(){
  return {
    profil: {
      nama: 'Penabung Hebat',
      maskot: '🐼',
      xp: 0,
      koin: 0,
      streak: 0,
      tanggalTerakhirNabung: null, // dipakai untuk hitung streak harian
      temaTerbuka: ['terang','gelap'],
      temaAktif: 'terang'
    },
    target: [],       // array of {id, emoji, nama, nominal, tanggal, tercapaiBadge}
    transaksi: [],     // array of {id, targetId, jenis, nominal, keterangan, tanggal, status}
    badgeTerbuka: [],  // array of id badge
    misiHarian: { tanggal:null, daftar:[] }, // di-generate ulang tiap hari
    misiSelesaiTotal: 0,
    tantanganMingguan: { minggu:null, targetHemat:20000, terkumpul:0 },
    spin: { tanggalTerakhir:null },
    tebak: { tanggal:null, sisaMain:3 },
    pinOrtu: '1234',
    approvalPending: [], // array of transaksi id yang perlu disetujui ortu
    leaderboardDummy: [
      { nama:'Bintang', poin: 180 },
      { nama:'Cahaya', poin: 140 },
      { nama:'Rafi', poin: 95 },
      { nama:'Zahra', poin: 60 }
    ]
  };
}

// Variabel data utama yang dipakai di seluruh aplikasi
let data = ambilData();

// ---------------------------------------------------------------------
// FUNGSI BACA & SIMPAN DATA KE LOCALSTORAGE
// ---------------------------------------------------------------------
function ambilData(){
  const mentah = localStorage.getItem(KEY_STORAGE);
  if(!mentah) return dataDefault();
  try{
    const parsed = JSON.parse(mentah);
    // Gabungkan dengan default agar field baru tetap ada jika update aplikasi
    return Object.assign(dataDefault(), parsed);
  }catch(e){
    return dataDefault();
  }
}

function simpanData(){
  localStorage.setItem(KEY_STORAGE, JSON.stringify(data));
}

// Fungsi kecil anti-XSS untuk teks yang diketik pengguna
function escapeHTML(teks){
  const div = document.createElement('div');
  div.textContent = teks == null ? '' : teks;
  return div.innerHTML;
}

// Buat ID unik sederhana
function buatId(){
  return Date.now().toString(36) + Math.random().toString(36).slice(2,7);
}

// ---------------------------------------------------------------------
// TOAST NOTIFIKASI (untuk kasih tahu dapat koin/XP/badge dll)
// ---------------------------------------------------------------------
function tampilkanToast(pesan){
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = pesan;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// =====================================================================
// LOGIKA GAMIFIKASI: XP, LEVEL, KOIN, STREAK, BADGE
// =====================================================================

// Hitung level saat ini berdasarkan XP
function hitungLevel(xp){
  let levelSaatIni = DAFTAR_LEVEL[0];
  for(const lv of DAFTAR_LEVEL){
    if(xp >= lv.minXP) levelSaatIni = lv;
  }
  return levelSaatIni;
}

// Cari level berikutnya (untuk progress bar XP)
function levelBerikutnya(xp){
  for(const lv of DAFTAR_LEVEL){
    if(xp < lv.minXP) return lv;
  }
  return null; // sudah level maksimal
}

// Tambahkan XP & koin ke profil, cek kenaikan level
function tambahXPdanKoin(xp, koin){
  const levelSebelum = hitungLevel(data.profil.xp).nama;
  data.profil.xp += xp;
  data.profil.koin += koin;

  const levelSesudah = hitungLevel(data.profil.xp).nama;
  if(levelSesudah !== levelSebelum){
    tampilkanToast(`🎉 Naik level jadi "${levelSesudah}"!`);
    if(levelSesudah === 'Hebat') bukaBadge('level_hebat');
  }
}

// Update streak harian: dipanggil setiap kali user setor tabungan
function updateStreak(){
  const hariIni = new Date().toDateString();
  const kemarin = new Date(Date.now() - 86400000).toDateString();

  if(data.profil.tanggalTerakhirNabung === hariIni){
    // Sudah nabung hari ini, streak tidak berubah
    return;
  }
  if(data.profil.tanggalTerakhirNabung === kemarin){
    data.profil.streak += 1;
  } else {
    data.profil.streak = 1;
  }
  data.profil.tanggalTerakhirNabung = hariIni;

  if(data.profil.streak === 3) bukaBadge('streak_3');
  if(data.profil.streak === 7) bukaBadge('streak_7');
}

// Buka badge tertentu (jika belum terbuka) dan tampilkan toast
function bukaBadge(id){
  if(data.badgeTerbuka.includes(id)) return;
  data.badgeTerbuka.push(id);
  const badge = DAFTAR_BADGE.find(b => b.id === id);
  if(badge) tampilkanToast(`🏆 Badge baru: ${badge.judul}!`);
}

// Cek badge berbasis total setoran & target
function cekBadgeOtomatis(){
  const totalSetor = data.transaksi
    .filter(t => t.jenis === 'setor' && t.status !== 'pending')
    .reduce((s,t) => s + t.nominal, 0);

  const jumlahSetor = data.transaksi.filter(t => t.jenis === 'setor' && t.status !== 'pending').length;

  if(jumlahSetor >= 1) bukaBadge('setor_pertama');
  if(totalSetor >= 100000) bukaBadge('seratus_ribu');
  if(totalSetor >= 500000) bukaBadge('lima_ratus_ribu');
  if(totalSetor >= 1000000) bukaBadge('satu_juta');
  if(data.target.length >= 1) bukaBadge('target_pertama');
  if(data.misiSelesaiTotal >= 10) bukaBadge('misi_10');
}

// =====================================================================
// LOGIKA TARGET TABUNGAN (MULTI TARGET)
// =====================================================================

// Hitung saldo terkumpul untuk 1 target tertentu
function hitungSaldoTarget(targetId){
  return data.transaksi
    .filter(t => t.targetId === targetId && t.status !== 'pending')
    .reduce((saldo,t) => t.jenis === 'setor' ? saldo + t.nominal : saldo - t.nominal, 0);
}

// Hitung ringkasan total semua target (saldo, total setor, total tarik)
function hitungRingkasanTotal(){
  let totalSetor = 0, totalTarik = 0;
  data.transaksi.forEach(t => {
    if(t.status === 'pending') return;
    if(t.jenis === 'setor') totalSetor += t.nominal; else totalTarik += t.nominal;
  });
  return { saldo: totalSetor - totalTarik, totalSetor, totalTarik };
}

// =====================================================================
// MISI HARIAN (DI-GENERATE ULANG SETIAP HARI)
// =====================================================================
const TEMPLATE_MISI = [
  { teks:'Nabung minimal Rp2.000 hari ini', jenis:'nabung_minimal', nilai:2000, xp:10, koin:5 },
  { teks:'Nabung 2x hari ini (transaksi berbeda)', jenis:'jumlah_transaksi', nilai:2, xp:15, koin:8 },
  { teks:'Isi keterangan transaksi dengan lengkap', jenis:'isi_keterangan', nilai:1, xp:5, koin:3 },
  { teks:'Nabung minimal Rp5.000 hari ini', jenis:'nabung_minimal', nilai:5000, xp:20, koin:10 },
  { teks:'Cek progress salah satu targetmu', jenis:'lihat_target', nilai:1, xp:5, koin:3 }
];

function pastikanMisiHariIni(){
  const hariIni = new Date().toDateString();
  if(data.misiHarian.tanggal === hariIni) return;

  // Ambil 3 misi acak dari template setiap hari baru
  const acak = [...TEMPLATE_MISI].sort(() => Math.random() - 0.5).slice(0,3);
  data.misiHarian = {
    tanggal: hariIni,
    daftar: acak.map(m => ({ ...m, id: buatId(), selesai:false, progres:0 }))
  };
  simpanData();
}

// Perbarui progres misi berdasarkan aksi yang baru terjadi
function perbaruiProgresMisi(aksi){
  let adaPerubahan = false;
  data.misiHarian.daftar.forEach(misi => {
    if(misi.selesai) return;
    if(misi.jenis === aksi.jenis){
      if(aksi.jenis === 'nabung_minimal' && aksi.nominal >= misi.nilai){
        misi.selesai = true; adaPerubahan = true;
      } else if(aksi.jenis === 'jumlah_transaksi'){
        misi.progres += 1;
        if(misi.progres >= misi.nilai){ misi.selesai = true; adaPerubahan = true; }
      } else if(aksi.jenis === 'isi_keterangan' && aksi.adaKeterangan){
        misi.selesai = true; adaPerubahan = true;
      } else if(aksi.jenis === 'lihat_target'){
        misi.selesai = true; adaPerubahan = true;
      }
    }
  });
  if(adaPerubahan){
    data.misiHarian.daftar.forEach(misi => {
      if(misi.selesai && !misi._hadiahDiberikan){
        tambahXPdanKoin(misi.xp, misi.koin);
        data.misiSelesaiTotal += 1;
        misi._hadiahDiberikan = true;
        tampilkanToast(`✅ Misi selesai: ${misi.teks} (+${misi.xp} XP, +${misi.koin} koin)`);
      }
    });
    cekBadgeOtomatis();
  }
}

// =====================================================================
// RENDER: PROFIL / LEVEL / XP / KOIN / STREAK
// =====================================================================
function renderProfil(){
  document.getElementById('maskot-header').textContent = data.profil.maskot;
  document.getElementById('maskot-profil').textContent = data.profil.maskot;
  document.getElementById('nama-anak-tampil').textContent = data.profil.nama || 'Penabung Hebat';

  const level = hitungLevel(data.profil.xp);
  const next = levelBerikutnya(data.profil.xp);
  document.getElementById('label-level').textContent = `Level: ${level.nama}`;

  let persenXP;
  if(next){
    const rentang = next.minXP - level.minXP;
    const progres = data.profil.xp - level.minXP;
    persenXP = Math.min(100, (progres / rentang) * 100);
    document.getElementById('label-xp').textContent = `${data.profil.xp} / ${next.minXP} XP`;
  } else {
    persenXP = 100;
    document.getElementById('label-xp').textContent = `${data.profil.xp} XP (MAX)`;
  }
  document.getElementById('xp-bar-fill').style.width = persenXP + '%';
  const barStatistik = document.getElementById('xp-bar-fill-statistik');
  if(barStatistik) barStatistik.style.width = persenXP + '%';

  document.getElementById('tampil-koin').textContent = data.profil.koin;
  document.getElementById('tampil-streak').textContent = data.profil.streak;
  document.getElementById('tampil-jumlah-badge').textContent = data.badgeTerbuka.length;
}

// =====================================================================
// RENDER: DAFTAR TARGET (TAB TARGET & RINGKASAN BERANDA)
// =====================================================================
function renderDaftarTarget(){
  const container = document.getElementById('daftar-target');
  const ringkasBeranda = document.getElementById('beranda-target-ringkas');

  if(data.target.length === 0){
    container.innerHTML = '<div class="empty-state">Belum ada target. Yuk buat target tabungan pertamamu!</div>';
    ringkasBeranda.innerHTML = '<div class="empty-state">Belum ada target aktif.</div>';
    return;
  }

  const htmlList = data.target.map(t => {
    const saldo = hitungSaldoTarget(t.id);
    let persen = (saldo / t.nominal) * 100;
    if(persen < 0) persen = 0;
    const persenTampil = Math.min(100, persen);
    const sisa = Math.max(0, t.nominal - saldo);
    const tanggalFormatted = new Date(t.tanggal).toLocaleDateString('id-ID', { day:'numeric', month:'long', year:'numeric' });

    // Cek & beri badge jika target sudah tercapai
    if(persen >= 100 && !t.tercapaiBadge){
      t.tercapaiBadge = true;
      bukaBadge('target_tercapai');
      tampilkanToast(`🎁 Selamat! Target "${t.nama}" tercapai!`);
    }

    return `
      <div class="target-card">
        <div class="head">
          <div class="info">
            <strong>${t.emoji} ${escapeHTML(t.nama)}</strong>
            <div class="sub">Target: ${tanggalFormatted}</div>
          </div>
          <button class="btn btn-outline btn-sm" onclick="hapusTarget('${t.id}')">Hapus</button>
        </div>
        <div class="progress-bar-bg"><div class="progress-bar-fill" style="width:${persenTampil}%;"></div></div>
        <div class="progress-info"><span>Progress</span><span>${persen.toFixed(1)}%</span></div>
        <div class="target-detail">
          <span>Terkumpul: <b>${formatRupiah.format(Math.max(0,saldo))}</b></span>
          <span>Target: <b>${formatRupiah.format(t.nominal)}</b></span>
          <span>Sisa: <b>${formatRupiah.format(sisa)}</b></span>
        </div>
        ${persen >= 100 ? '<div class="hint" style="color:var(--hijau); font-weight:600; margin-top:8px;">🎉 Target tercapai! Hebat sekali!</div>' : ''}
      </div>
    `;
  }).join('');

  container.innerHTML = htmlList;
  // Ringkasan di beranda hanya menampilkan maksimal 2 target teratas
  ringkasBeranda.innerHTML = data.target.slice(0,2).map(t => {
    const saldo = hitungSaldoTarget(t.id);
    const persen = Math.min(100, Math.max(0,(saldo / t.nominal) * 100));
    return `
      <div style="margin-bottom:12px;">
        <div style="display:flex; justify-content:space-between; font-size:.85rem; margin-bottom:4px;">
          <span>${t.emoji} ${escapeHTML(t.nama)}</span><span>${persen.toFixed(0)}%</span>
        </div>
        <div class="progress-bar-bg"><div class="progress-bar-fill" style="width:${persen}%;"></div></div>
      </div>
    `;
  }).join('');

  simpanData();
}

// Dropdown pilihan target (dipakai di form transaksi & form bonus ortu)
function renderDropdownTarget(){
  const opsi = data.target.length === 0
    ? '<option value="">(Belum ada target - buat dulu di tab Target)</option>'
    : data.target.map(t => `<option value="${t.id}">${t.emoji} ${escapeHTML(t.nama)}</option>`).join('');

  document.getElementById('pilih-target-transaksi').innerHTML = opsi;
  document.getElementById('bonus-target').innerHTML = opsi;
}

function hapusTarget(id){
  if(!confirm('Yakin ingin menghapus target ini? Riwayat transaksinya tetap tersimpan di daftar umum.')) return;
  data.target = data.target.filter(t => t.id !== id);
  simpanData();
  renderSemua();
}

// =====================================================================
// RENDER: TRANSAKSI / RIWAYAT
// =====================================================================
function namaTarget(targetId){
  const t = data.target.find(x => x.id === targetId);
  return t ? `${t.emoji} ${t.nama}` : '(Target dihapus)';
}

function renderRiwayat(){
  const urut = [...data.transaksi].sort((a,b) => new Date(b.tanggal) - new Date(a.tanggal));

  const baris = (trx) => {
    const tanggalFormatted = new Date(trx.tanggal).toLocaleDateString('id-ID', { day:'2-digit', month:'short', year:'numeric' });
    const badgeClass = trx.jenis === 'setor' ? 'badge-setor' : 'badge-tarik';
    const badgeText = trx.jenis === 'setor' ? 'Setor' : 'Tarik';
    const nominalClass = trx.jenis === 'setor' ? 'jumlah-setor' : 'jumlah-tarik';
    const tanda = trx.jenis === 'setor' ? '+' : '-';
    const statusText = trx.status === 'pending' ? '⏳ Menunggu ortu' : (trx.status === 'ditolak' ? '❌ Ditolak' : '✅ Disetujui');
    return `
      <tr>
        <td>${tanggalFormatted}</td>
        <td>${namaTarget(trx.targetId)}</td>
        <td><span class="badge ${badgeClass}">${badgeText}</span></td>
        <td class="${nominalClass}">${tanda} ${formatRupiah.format(trx.nominal)}</td>
        <td>${escapeHTML(trx.keterangan || '-')}</td>
        <td>${statusText}</td>
      </tr>
    `;
  };

  const tbodyLengkap = document.getElementById('tabungan-riwayat-tbody');
  const emptyLengkap = document.getElementById('tabungan-riwayat-empty');
  if(urut.length === 0){
    tbodyLengkap.innerHTML = '';
    emptyLengkap.style.display = 'block';
  } else {
    emptyLengkap.style.display = 'none';
    tbodyLengkap.innerHTML = urut.map(baris).join('');
  }

  // Versi ringkas untuk beranda (tanpa kolom status, 5 baris terakhir)
  const tbodyBeranda = document.getElementById('beranda-riwayat-tbody');
  const emptyBeranda = document.getElementById('beranda-riwayat-empty');
  const lima = urut.slice(0,5);
  if(lima.length === 0){
    tbodyBeranda.innerHTML = '';
    emptyBeranda.style.display = 'block';
  } else {
    emptyBeranda.style.display = 'none';
    tbodyBeranda.innerHTML = lima.map(trx => {
      const tanggalFormatted = new Date(trx.tanggal).toLocaleDateString('id-ID', { day:'2-digit', month:'short' });
      const badgeClass = trx.jenis === 'setor' ? 'badge-setor' : 'badge-tarik';
      const badgeText = trx.jenis === 'setor' ? 'Setor' : 'Tarik';
      const nominalClass = trx.jenis === 'setor' ? 'jumlah-setor' : 'jumlah-tarik';
      const tanda = trx.jenis === 'setor' ? '+' : '-';
      return `<tr><td>${tanggalFormatted}</td><td>${namaTarget(trx.targetId)}</td><td><span class="badge ${badgeClass}">${badgeText}</span></td><td class="${nominalClass}">${tanda} ${formatRupiah.format(trx.nominal)}</td><td>${escapeHTML(trx.keterangan || '-')}</td></tr>`;
    }).join('');
  }
}

// =====================================================================
// RENDER: STATISTIK
// =====================================================================
function renderStatistik(){
  const { saldo, totalSetor, totalTarik } = hitungRingkasanTotal();
  document.getElementById('statistik-grid').innerHTML = `
    <div class="stat-box"><div class="label">Saldo Saat Ini</div><div class="value">${formatRupiah.format(saldo)}</div></div>
    <div class="stat-box"><div class="label">Total Setoran</div><div class="value" style="color:var(--hijau);">${formatRupiah.format(totalSetor)}</div></div>
    <div class="stat-box"><div class="label">Total Penarikan</div><div class="value" style="color:var(--merah);">${formatRupiah.format(totalTarik)}</div></div>
  `;
}

// =====================================================================
// RENDER: MISI HARIAN
// =====================================================================
function renderMisi(){
  pastikanMisiHariIni();
  const container = document.getElementById('misi-list');
  const beranda = document.getElementById('beranda-misi-list');

  const htmlMisi = data.misiHarian.daftar.map(m => `
    <div class="misi-item ${m.selesai ? 'selesai' : ''}">
      <div class="teks">
        <div class="judul">${m.selesai ? '✅' : '⬜'} ${escapeHTML(m.teks)}</div>
        <div class="hadiah">Hadiah: +${m.xp} XP, +${m.koin} koin</div>
      </div>
    </div>
  `).join('');

  container.innerHTML = htmlMisi;
  beranda.innerHTML = htmlMisi;

  // Tantangan hemat mingguan
  const minggu = getNomorMingguIni();
  if(data.tantanganMingguan.minggu !== minggu){
    data.tantanganMingguan = { minggu, targetHemat: 20000, terkumpul: 0 };
    simpanData();
  }
  const persenHemat = Math.min(100, (data.tantanganMingguan.terkumpul / data.tantanganMingguan.targetHemat) * 100);
  document.getElementById('tantangan-mingguan').innerHTML = `
    <div class="hint" style="margin-bottom:8px;">Kumpulkan total ${formatRupiah.format(data.tantanganMingguan.targetHemat)} minggu ini dari semua setoranmu.</div>
    <div class="progress-bar-bg"><div class="progress-bar-fill" style="width:${persenHemat}%;"></div></div>
    <div class="progress-info"><span>${formatRupiah.format(data.tantanganMingguan.terkumpul)}</span><span>${persenHemat.toFixed(0)}%</span></div>
  `;
}

function getNomorMingguIni(){
  const now = new Date();
  const start = new Date(now.getFullYear(),0,1);
  const hari = Math.floor((now - start) / 86400000);
  return now.getFullYear() + '-W' + Math.ceil((hari + start.getDay() + 1) / 7);
}

// =====================================================================
// RENDER: BADGE / PENCAPAIAN
// =====================================================================
function renderBadge(){
  document.getElementById('badge-grid').innerHTML = DAFTAR_BADGE.map(b => {
    const terbuka = data.badgeTerbuka.includes(b.id);
    return `
      <div class="pencapaian ${terbuka ? 'terbuka' : ''}">
        <div class="ikon">${b.ikon}</div>
        <div class="judul">${b.judul}</div>
        <div class="desk">${b.desk}</div>
      </div>
    `;
  }).join('');
}

// =====================================================================
// RENDER: LEADERBOARD DUMMY (SIMULASI LOKAL, BUKAN DATA ONLINE ASLI)
// =====================================================================
function renderLeaderboard(){
  const poinKamu = data.profil.xp + data.profil.koin;
  const daftar = [...data.leaderboardDummy, { nama: data.profil.nama || 'Kamu', poin: poinKamu, kamu:true }]
    .sort((a,b) => b.poin - a.poin);

  document.getElementById('leaderboard-list').innerHTML = daftar.map((p,i) => `
    <div class="lb-row ${p.kamu ? 'kamu' : ''}">
      <div class="lb-rank">${i+1}</div>
      <div class="lb-nama">${p.kamu ? '👉 ' : ''}${escapeHTML(p.nama)}</div>
      <div class="lb-poin">${p.poin} pts</div>
    </div>
  `).join('') + '<p class="hint" style="margin-top:8px;">*Leaderboard ini contoh simulasi di 1 perangkat, belum terhubung ke pemain lain secara online.</p>';
}

// =====================================================================
// RENDER: MASKOT & TEMA (TAB PROFIL)
// =====================================================================
function renderMaskotDanTema(){
  document.getElementById('input-nama-anak').value = data.profil.nama || '';

  document.getElementById('maskot-grid').innerHTML = DAFTAR_MASKOT.map(m => `
    <div class="maskot-item ${data.profil.maskot === m ? 'dipilih' : ''}" onclick="pilihMaskot('${m}')">${m}</div>
  `).join('');
  document.getElementById('maskot-hint').textContent = 'Maskotmu akan tumbuh semangat seiring tabungan bertambah!';

  document.getElementById('tema-grid').innerHTML = DAFTAR_TEMA.map(t => {
    const terbuka = data.profil.temaTerbuka.includes(t.id);
    const kelasPreview = t.id === 'terang' ? 'tema-terang' : (t.id === 'gelap' ? 'tema-gelap' : 'tema-' + t.id);
    return `
      <div class="tema-item">
        <div class="tema-preview ${kelasPreview}"></div>
        <div style="font-weight:600; font-size:.85rem;">${t.nama}</div>
        <div class="hint">${terbuka ? 'Terbuka' : `🪙 ${t.harga} koin`}</div>
        <button class="btn ${data.profil.temaAktif === t.id ? 'btn-primary' : 'btn-hijau'} btn-sm" style="width:100%; margin-top:8px;" onclick="pilihAtauBukaTema('${t.id}')">
          ${data.profil.temaAktif === t.id ? 'Aktif' : (terbuka ? 'Pakai' : 'Buka')}
        </button>
      </div>
    `;
  }).join('');
}

function pilihMaskot(m){
  data.profil.maskot = m;
  simpanData();
  renderProfil();
  renderMaskotDanTema();
  tampilkanToast('Maskot berhasil diganti!');
}

function pilihAtauBukaTema(id){
  const tema = DAFTAR_TEMA.find(t => t.id === id);
  const sudahTerbuka = data.profil.temaTerbuka.includes(id);

  if(!sudahTerbuka){
    if(data.profil.koin < tema.harga){
      tampilkanToast(`Koin belum cukup. Butuh ${tema.harga} koin.`);
      return;
    }
    data.profil.koin -= tema.harga;
    data.profil.temaTerbuka.push(id);
    tampilkanToast(`🌈 Tema "${tema.nama}" terbuka!`);
  }
  data.profil.temaAktif = id;
  terapkanTema();
  simpanData();
  renderProfil();
  renderMaskotDanTema();
}

function terapkanTema(){
  const tema = DAFTAR_TEMA.find(t => t.id === data.profil.temaAktif) || DAFTAR_TEMA[0];
  document.body.className = tema.kelas;
  document.getElementById('btn-tema-toggle').textContent = tema.kelas === 'dark' ? '☀️' : '🌙';
}

// =====================================================================
// SPIN WHEEL (HADIAH MINGGUAN)
// =====================================================================
const HADIAH_SPIN = [
  { teks:'+10 koin', koin:10, xp:0 },
  { teks:'+5 koin', koin:5, xp:0 },
  { teks:'+20 XP', koin:0, xp:20 },
  { teks:'+15 koin', koin:15, xp:5 },
  { teks:'Coba lagi minggu depan', koin:0, xp:0 },
  { teks:'+30 koin JACKPOT!', koin:30, xp:10 }
];

function renderSpin(){
  const minggu = getNomorMingguIni();
  const sudahSpin = data.spin.tanggalTerakhir === minggu;
  const status = document.getElementById('spin-status');
  const tombol = document.getElementById('btn-spin');

  if(sudahSpin){
    status.textContent = 'Kamu sudah putar roda minggu ini. Sampai jumpa minggu depan!';
    tombol.disabled = true;
    tombol.style.opacity = .5;
  } else {
    status.textContent = `Koin kamu: ${data.profil.koin}`;
    tombol.disabled = false;
    tombol.style.opacity = 1;
  }
}

document.getElementById('btn-spin').addEventListener('click', function(){
  const minggu = getNomorMingguIni();
  if(data.spin.tanggalTerakhir === minggu) return;
  if(data.profil.koin < 20){
    tampilkanToast('Koin tidak cukup untuk putar roda (butuh 20 koin).');
    return;
  }
  data.profil.koin -= 20;
  const roda = document.getElementById('spin-roda');
  roda.style.transform = `rotate(${1080 + Math.random()*360}deg)`;

  setTimeout(() => {
    const hadiah = HADIAH_SPIN[Math.floor(Math.random() * HADIAH_SPIN.length)];
    tambahXPdanKoin(hadiah.xp, hadiah.koin);
    data.spin.tanggalTerakhir = minggu;
    simpanData();
    tampilkanToast(`🎡 Hasil spin: ${hadiah.teks}`);
    renderProfil();
    renderSpin();
  }, 2000);
});

// =====================================================================
// MINI GAME: TEBAK KOIN
// =====================================================================
function pastikanTebakHariIni(){
  const hariIni = new Date().toDateString();
  if(data.tebak.tanggal !== hariIni){
    data.tebak = { tanggal: hariIni, sisaMain: 3 };
    simpanData();
  }
}

function renderTebak(){
  pastikanTebakHariIni();
  const grid = document.getElementById('tebak-grid');
  const status = document.getElementById('tebak-status');
  status.textContent = `Sisa kesempatan hari ini: ${data.tebak.sisaMain}x`;

  // Buat 8 kotak, salah satu berisi koin (posisi acak setiap render ulang halaman)
  if(!window._posisiKoinTebak) window._posisiKoinTebak = Math.floor(Math.random()*8);

  grid.innerHTML = '';
  for(let i=0;i<8;i++){
    const kotak = document.createElement('div');
    kotak.className = 'tebak-kotak';
    kotak.textContent = '❓';
    kotak.onclick = () => bukaKotakTebak(i, kotak);
    grid.appendChild(kotak);
  }
}

function bukaKotakTebak(index, el){
  if(data.tebak.sisaMain <= 0){
    tampilkanToast('Kesempatan main hari ini sudah habis. Coba lagi besok!');
    return;
  }
  if(el.classList.contains('terbuka')) return;

  el.classList.add('terbuka');
  data.tebak.sisaMain -= 1;

  if(index === window._posisiKoinTebak){
    const koinDapat = Math.floor(Math.random()*8) + 3;
    el.textContent = '🪙';
    tambahXPdanKoin(2, koinDapat);
    tampilkanToast(`🎉 Ketemu koin! +${koinDapat} koin`);
  } else {
    el.textContent = '💨';
  }
  window._posisiKoinTebak = Math.floor(Math.random()*8); // acak ulang posisi utk sesi berikutnya
  simpanData();
  renderProfil();
  document.getElementById('tebak-status').textContent = `Sisa kesempatan hari ini: ${data.tebak.sisaMain}x`;
}

// =====================================================================
// RENDER SEMUA (dipanggil setiap ada perubahan data)
// =====================================================================
function renderSemua(){
  renderProfil();
  renderDropdownTarget();
  renderDaftarTarget();
  renderRiwayat();
  renderStatistik();
  renderMisi();
  renderBadge();
  renderLeaderboard();
  renderMaskotDanTema();
  renderSpin();
  renderTebak();
  renderApprovalOrtu();
  renderRingkasOrtu();
}

// =====================================================================
// NAVIGASI TAB
// =====================================================================
document.getElementById('nav-menu').addEventListener('click', function(e){
  const btn = e.target.closest('button[data-tab]');
  if(!btn) return;
  document.querySelectorAll('.nav-menu button').forEach(b => b.classList.remove('aktif'));
  btn.classList.add('aktif');
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('aktif'));
  document.getElementById('tab-' + btn.dataset.tab).classList.add('aktif');

  // Misi "lihat target" terpenuhi saat user membuka tab target
  if(btn.dataset.tab === 'target'){
    perbaruiProgresMisi({ jenis:'lihat_target' });
  }
});

// =====================================================================
// EVENT: FORM TARGET BARU
// =====================================================================
document.getElementById('form-target').addEventListener('submit', function(e){
  e.preventDefault();
  const errorEl = document.getElementById('error-target');
  errorEl.style.display = 'none';

  const emoji = document.getElementById('emoji-target').value;
  const nama = document.getElementById('nama-target').value.trim();
  const nominal = parseFloat(document.getElementById('nominal-target').value);
  const tanggal = document.getElementById('tanggal-target').value;

  if(!nama || isNaN(nominal) || nominal <= 0 || !tanggal){
    errorEl.textContent = 'Nominal target harus lebih dari 0 dan semua data harus diisi.';
    errorEl.style.display = 'block';
    return;
  }

  data.target.push({ id:buatId(), emoji, nama, nominal, tanggal, tercapaiBadge:false });
  simpanData();
  cekBadgeOtomatis();
  this.reset();
  renderSemua();
  tampilkanToast('🎯 Target baru berhasil dibuat!');
});

// =====================================================================
// EVENT: FORM CATAT TRANSAKSI
// =====================================================================
document.getElementById('form-transaksi').addEventListener('submit', function(e){
  e.preventDefault();
  const errorEl = document.getElementById('error-transaksi');
  errorEl.style.display = 'none';

  const targetId = document.getElementById('pilih-target-transaksi').value;
  const jenis = document.getElementById('jenis-transaksi').value;
  const nominal = parseFloat(document.getElementById('nominal-transaksi').value);
  const keterangan = document.getElementById('keterangan-transaksi').value.trim();

  if(!targetId){
    errorEl.textContent = 'Buat target tabungan dulu sebelum mencatat transaksi.';
    errorEl.style.display = 'block';
    return;
  }
  if(isNaN(nominal) || nominal <= 0){
    errorEl.textContent = 'Nominal transaksi harus lebih dari 0.';
    errorEl.style.display = 'block';
    return;
  }

  if(jenis === 'tarik'){
    const saldoTarget = hitungSaldoTarget(targetId);
    if(nominal > saldoTarget){
      errorEl.textContent = `Saldo target tidak cukup. Saldo saat ini: ${formatRupiah.format(saldoTarget)}.`;
      errorEl.style.display = 'block';
      return;
    }
  }

  // Penarikan di atas Rp20.000 butuh persetujuan orang tua dulu (status pending)
  const perluApproval = jenis === 'tarik' && nominal > 20000;
  const trxBaru = {
    id: buatId(),
    targetId, jenis, nominal, keterangan,
    tanggal: new Date().toISOString(),
    status: perluApproval ? 'pending' : 'disetujui'
  };

  data.transaksi.push(trxBaru);

  if(perluApproval){
    data.approvalPending.push(trxBaru.id);
    tampilkanToast('⏳ Penarikan menunggu persetujuan Orang Tua.');
  } else if(jenis === 'setor'){
    // Setor langsung dapat XP & koin + update streak & misi
    updateStreak();
    tambahXPdanKoin(Math.min(20, Math.ceil(nominal/1000)), Math.min(10, Math.ceil(nominal/2000)));
    perbaruiProgresMisi({ jenis:'nabung_minimal', nominal });
    perbaruiProgresMisi({ jenis:'jumlah_transaksi' });
    perbaruiProgresMisi({ jenis:'isi_keterangan', adaKeterangan: !!keterangan });
    data.tantanganMingguan.terkumpul += nominal;
    tampilkanToast(`💰 Setoran tercatat! +koin & XP didapat.`);
  } else {
    tampilkanToast('Penarikan tercatat.');
  }

  simpanData();
  cekBadgeOtomatis();
  document.getElementById('nominal-transaksi').value = '';
  document.getElementById('keterangan-transaksi').value = '';
  renderSemua();
});

// =====================================================================
// KALKULATOR WAKTU TARGET
// =====================================================================
document.getElementById('btn-hitung-kalkulator').addEventListener('click', function(){
  const sisaInput = parseFloat(document.getElementById('kalkulator-sisa').value);
  const harian = parseFloat(document.getElementById('kalkulator-harian').value);
  const hasilEl = document.getElementById('hasil-kalkulator');

  if(isNaN(harian) || harian <= 0){
    hasilEl.textContent = 'Masukkan rencana nabung per hari terlebih dahulu.';
    return;
  }

  let sisa = sisaInput;
  if(isNaN(sisa) || sisa <= 0){
    // Jika kosong, otomatis ambil dari sisa target pertama yang belum tercapai
    const targetBelumSelesai = data.target.find(t => hitungSaldoTarget(t.id) < t.nominal);
    if(targetBelumSelesai){
      sisa = targetBelumSelesai.nominal - hitungSaldoTarget(targetBelumSelesai.id);
    } else {
      hasilEl.textContent = 'Masukkan jumlah sisa yang ingin dihitung.';
      return;
    }
  }

  const hariDibutuhkan = Math.ceil(sisa / harian);
  const bulan = Math.floor(hariDibutuhkan / 30);
  const hariSisa = hariDibutuhkan % 30;
  hasilEl.textContent = `Dengan menabung ${formatRupiah.format(harian)}/hari, target akan tercapai dalam sekitar ${hariDibutuhkan} hari` +
    (bulan > 0 ? ` (± ${bulan} bulan ${hariSisa} hari).` : '.');
});

// =====================================================================
// EVENT: SIMPAN NAMA & TOGGLE TEMA GELAP/TERANG
// =====================================================================
document.getElementById('btn-simpan-nama').addEventListener('click', function(){
  const nama = document.getElementById('input-nama-anak').value.trim();
  data.profil.nama = nama || 'Penabung Hebat';
  simpanData();
  renderProfil();
  renderLeaderboard();
  tampilkanToast('Nama berhasil disimpan!');
});

document.getElementById('btn-tema-toggle').addEventListener('click', function(){
  const tujuId = data.profil.temaAktif === 'gelap' ? 'terang' : 'gelap';
  pilihAtauBukaTema(tujuId);
});

document.getElementById('btn-pengingat').addEventListener('click', function(){
  if(!('Notification' in window)){
    tampilkanToast('Browser ini tidak mendukung notifikasi pengingat.');
    return;
  }
  Notification.requestPermission().then(izin => {
    if(izin === 'granted'){
      tampilkanToast('🔔 Pengingat harian aktif! Kami akan ingatkan kamu menabung (selama tab ini terbuka).');
      aturPengingatHarian();
    } else {
      tampilkanToast('Izin notifikasi ditolak. Pengingat tidak bisa diaktifkan.');
    }
  });
});

function aturPengingatHarian(){
  // Pengingat sederhana: cek tiap 1 jam apakah user belum nabung hari ini
  setInterval(() => {
    const hariIni = new Date().toDateString();
    if(data.profil.tanggalTerakhirNabung !== hariIni && Notification.permission === 'granted'){
      new Notification('Tabungan Hebat', { body: 'Yuk jangan lupa menabung hari ini! 🐼💰' });
    }
  }, 60 * 60 * 1000);
}

// =====================================================================
// AREA ORANG TUA: PIN GATE, APPROVAL, BONUS
// =====================================================================
document.getElementById('hint-pin-default').textContent = 'PIN awal default: 1234 (bisa diganti setelah masuk).';

document.getElementById('btn-buka-ortu').addEventListener('click', function(){
  const pinInput = document.getElementById('input-pin-ortu').value;
  const errorEl = document.getElementById('error-pin');
  if(pinInput !== data.pinOrtu){
    errorEl.textContent = 'PIN salah. Coba lagi.';
    errorEl.style.display = 'block';
    return;
  }
  errorEl.style.display = 'none';
  document.getElementById('ortu-pin-gate').style.display = 'none';
  document.getElementById('ortu-dashboard').style.display = 'block';
  renderApprovalOrtu();
  renderRingkasOrtu();
});

function renderRingkasOrtu(){
  const el = document.getElementById('ortu-ringkas');
  if(!el) return;
  const { saldo, totalSetor, totalTarik } = hitungRingkasanTotal();
  el.innerHTML = `
    <div class="stat-box"><div class="label">Saldo Anak</div><div class="value">${formatRupiah.format(saldo)}</div></div>
    <div class="stat-box"><div class="label">Total Setoran</div><div class="value" style="color:var(--hijau);">${formatRupiah.format(totalSetor)}</div></div>
    <div class="stat-box"><div class="label">Streak Menabung</div><div class="value">🔥 ${data.profil.streak} hari</div></div>
  `;
}

function renderApprovalOrtu(){
  const el = document.getElementById('ortu-approval-list');
  if(!el) return;
  const pendingList = data.transaksi.filter(t => t.status === 'pending');

  if(pendingList.length === 0){
    el.innerHTML = '<div class="empty-state">Tidak ada penarikan yang menunggu persetujuan.</div>';
    return;
  }

  el.innerHTML = pendingList.map(t => `
    <div class="approval-item">
      <div>
        <div><b>${namaTarget(t.targetId)}</b> &middot; ${formatRupiah.format(t.nominal)}</div>
        <div class="hint">${escapeHTML(t.keterangan || '-')}</div>
      </div>
      <div>
        <button class="btn btn-hijau btn-sm" onclick="setujuiPenarikan('${t.id}')">Setujui</button>
        <button class="btn btn-outline btn-sm" onclick="tolakPenarikan('${t.id}')">Tolak</button>
      </div>
    </div>
  `).join('');
}

function setujuiPenarikan(id){
  const trx = data.transaksi.find(t => t.id === id);
  if(!trx) return;
  trx.status = 'disetujui';
  data.approvalPending = data.approvalPending.filter(pid => pid !== id);
  simpanData();
  renderSemua();
  tampilkanToast('✅ Penarikan disetujui.');
}

function tolakPenarikan(id){
  const trx = data.transaksi.find(t => t.id === id);
  if(!trx) return;
  trx.status = 'ditolak';
  data.approvalPending = data.approvalPending.filter(pid => pid !== id);
  simpanData();
  renderSemua();
  tampilkanToast('❌ Penarikan ditolak.');
}

document.getElementById('btn-beri-bonus').addEventListener('click', function(){
  const errorEl = document.getElementById('error-bonus');
  errorEl.style.display = 'none';
  const targetId = document.getElementById('bonus-target').value;
  const nominal = parseFloat(document.getElementById('bonus-nominal').value);
  const keterangan = document.getElementById('bonus-keterangan').value.trim();

  if(!targetId){
    errorEl.textContent = 'Pilih target tabungan dulu (buat target di tab Target jika belum ada).';
    errorEl.style.display = 'block';
    return;
  }
  if(isNaN(nominal) || nominal <= 0){
    errorEl.textContent = 'Nominal bonus harus lebih dari 0.';
    errorEl.style.display = 'block';
    return;
  }

  data.transaksi.push({
    id: buatId(), targetId, jenis:'setor', nominal,
    keterangan: keterangan ? `Bonus: ${keterangan}` : 'Bonus dari Orang Tua',
    tanggal: new Date().toISOString(), status:'disetujui'
  });
  tambahXPdanKoin(15, 10);
  simpanData();
  cekBadgeOtomatis();
  document.getElementById('bonus-nominal').value = '';
  document.getElementById('bonus-keterangan').value = '';
  renderSemua();
  tampilkanToast('💸 Bonus berhasil diberikan ke anak!');
});

document.getElementById('btn-ganti-pin').addEventListener('click', function(){
  const pinBaru = document.getElementById('pin-baru').value;
  if(!/^\d{4}$/.test(pinBaru)){
    tampilkanToast('PIN harus 4 digit angka.');
    return;
  }
  data.pinOrtu = pinBaru;
  simpanData();
  document.getElementById('pin-baru').value = '';
  tampilkanToast('PIN berhasil diganti.');
});

// =====================================================================
// INISIALISASI SAAT HALAMAN DIMUAT PERTAMA KALI
// =====================================================================
terapkanTema();
renderSemua();
