
const CWS_URL = 'https://chromewebstore.google.com/detail/nambhklnancmjlcnccecogmfdloaeodg';
document.querySelectorAll('[data-cws]').forEach((a) => { a.href = CWS_URL; a.target = '_blank'; a.rel = 'noopener'; });


/* Tab */
const tab = [...document.querySelectorAll('[role="tab"]')];
function pilihTab(t, fokus) {
  tab.forEach((x) => {
    const pada = x === t;
    x.setAttribute('aria-selected', pada);
    x.tabIndex = pada ? 0 : -1;
    document.getElementById(x.getAttribute('aria-controls')).hidden = !pada;
  });
  if (fokus) t.focus();
}
tab.forEach((t, i) => {
  t.addEventListener('click', () => pilihTab(t));
  t.addEventListener('keydown', (e) => {
    const arah = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (arah) { e.preventDefault(); pilihTab(tab[(i + arah + tab.length) % tab.length], true); }
  });
});
pilihTab(tab[0]);
document.querySelectorAll('[data-ke-tab]').forEach((a) => a.addEventListener('click', () => pilihTab(document.getElementById(a.dataset.keTab))));

/* Kalkulator */
const $ = (id) => document.getElementById(id);
const MINIT_EXTENSION = 2;
function kira() {
  const [guru, sesi, manual] = ['guru', 'sesi', 'manual'].map((k) => +$(k).value);
  const auto = MINIT_EXTENSION;
  ['guru', 'sesi', 'manual'].forEach((k) => { $(k + 'Out').textContent = $(k).value; });
  const jam = (guru * sesi * (manual - auto)) / 60;
  $('jam').textContent = jam >= 100 ? Math.round(jam) : jam.toFixed(1).replace(/\.0$/, '');
  $('klik').textContent = (guru * sesi * S4Tukar.JUMLAH).toLocaleString('ms-MY');
  $('simpan').textContent = (guru * sesi * S4Tukar.SUB.length).toLocaleString('ms-MY');
}
document.querySelectorAll('input[type=range]').forEach((r) => r.addEventListener('input', kira));
kira();

/* Alat tukar */
const lepas = $('lepas');
const fail = $('fail');
const status = $('status');
const senarai = $('hasil');
const alatHasil = $('hasilAlat');
let rekod = [];

const PERANAN = { '4.1': 'Perancang', '4.2': 'Pengawal', '4.3': 'Pembimbing', '4.4': 'Pendorong', '4.5': 'Penilai', '4.6': 'Pembelajar aktif' };
const el = (tag, cls, teks) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (teks !== undefined) e.textContent = teks;
  return e;
};

function jadualSkor(baris) {
  const t = el('table', 'skor');
  const kepala = t.createTHead().insertRow();
  [['Sub-aspek'], ['Peranan', 'peranan'], ...'abcdefg'.split('').map((h) => [h, 'num'])].forEach(([k, c]) => {
    const th = el('th', c, k); th.scope = 'col'; kepala.append(th);
  });
  const badan = t.createTBody();
  S4Tukar.SUB.forEach(([kod]) => {
    const r = badan.insertRow();
    r.append(el('td', '', kod), el('td', 'peranan', PERANAN[kod.slice(0, 3)]));
    'abcdefg'.split('').forEach((h) => {
      const b = baris.find((x) => x.sub === kod && x.item === h);
      const kosong = b && b.skor === '';
      r.append(el('td', kosong ? 'num tiada' : 'num', b ? (kosong ? '?' : b.skor) : ''));
    });
  });
  return t;
}

function kemasNama() {
  const dipakai = new Set();
  rekod.forEach((r) => {
    if (r.ralat) return;
    const lengkap = r.sesi.trim() && r.guru.trim();
    r.nama = lengkap ? S4Tukar.namaUnik(S4Tukar.namaFail(r.sesi, r.guru), dipakai) : '';
    r.ui.tajuk.textContent = r.nama || 'Nama fail menunggu maklumat';
    r.ui.muat.disabled = !lengkap;
  });
  const sedia = rekod.filter((r) => r.nama);
  alatHasil.hidden = rekod.length === 0;
  $('muatSemua').hidden = sedia.length < 2;
}

function muatTurun(r) {
  const url = URL.createObjectURL(new Blob([S4Tukar.keCsv(r.baris)], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = r.nama;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  $('seterusnya').hidden = false;
}

function medan(label, r, kunci) {
  const l = el('label', 'medan', label);
  const i = document.createElement('input');
  i.type = 'text';
  i.name = kunci;
  i.autocomplete = 'off';
  i.addEventListener('input', () => { r[kunci] = i.value; kemasNama(); });
  l.append(i);
  return l;
}

function kadHasil(r) {
  if (r.ralat) {
    const k = el('div', 'kad__ralat');
    k.append(el('strong', '', r.asal), el('p', '', r.ralat));
    return k;
  }
  const kad = el('article', 'kad');
  const sheet = el('div', 'sheet');
  const kepala = el('div', 'sheet__kepala');
  const tajuk = el('h3', 'sheet__tajuk');
  kepala.append(tajuk);
  const kaki = el('div', 'sheet__kaki');
  kaki.append(el('span', '', `Daripada ${r.asal}`));
  sheet.append(kepala, jadualSkor(r.baris), kaki);

  const sisi = el('div', 'kad__sisi');
  sisi.append(el('p', 'kad__kira', `${r.diisi} daripada ${r.jumlah} skor`));
  if (!r.sesi) sisi.append(medan('Sesi Penilaian (sel G30 kosong), contoh KENDIRI', r, 'sesi'));
  if (!r.guru) sisi.append(medan('Nama Guru (sel G24 kosong)', r, 'guru'));
  if (r.perhatian.length) {
    const ul = el('ul', 'perhatian');
    r.perhatian.slice(0, 8).forEach((p) => ul.append(el('li', '', p)));
    if (r.perhatian.length > 8) ul.append(el('li', '', `Dan ${r.perhatian.length - 8} perkara lagi.`));
    sisi.append(ul);
  }
  if (r.nota.length) {
    const ul = el('ul', 'nota');
    r.nota.slice(0, 4).forEach((p) => ul.append(el('li', '', p)));
    sisi.append(ul);
  }
  const muat = el('button', 'btn btn-primary', 'Muat turun CSV');
  muat.type = 'button';
  muat.addEventListener('click', () => muatTurun(r));
  sisi.append(muat);
  kad.append(sheet, sisi);
  r.ui = { tajuk, muat };
  return kad;
}

async function proses(senaraiFail) {
  if (typeof DecompressionStream === 'undefined') {
    status.textContent = 'Pelayar ini terlalu lama untuk alat ini. Kemas kini Chrome atau gunakan borang Google Sheet.';
    return;
  }
  const files = [...senaraiFail];
  if (!files.length) return;
  status.textContent = `Membaca ${files.length} fail…`;
  for (const f of files) {
    let r;
    if (/\.xls$/i.test(f.name)) r = { ralat: 'Format .xls lama tidak disokong. Buka dalam Excel dan simpan sebagai .xlsx.' };
    else if (!/\.xls[xm]$/i.test(f.name)) r = { ralat: 'Hanya fail .xlsm atau .xlsx diterima.' };
    else r = await S4Tukar.tukar(await f.arrayBuffer());
    r.asal = f.name;
    rekod.push(r);
    senarai.append(kadHasil(r));
    kemasNama();
  }
  const ok = rekod.filter((r) => !r.ralat);
  status.textContent = `${ok.length} daripada ${rekod.length} fail berjaya dibaca.`;
  senarai.scrollIntoView({ block: 'nearest' });
}

fail.addEventListener('change', () => { proses(fail.files); fail.value = ''; });
['dragenter', 'dragover'].forEach((t) => lepas.addEventListener(t, (e) => { e.preventDefault(); lepas.classList.add('seret'); }));
['dragleave', 'drop'].forEach((t) => lepas.addEventListener(t, (e) => { e.preventDefault(); lepas.classList.remove('seret'); }));
lepas.addEventListener('drop', (e) => proses(e.dataTransfer.files));

$('muatSemua').addEventListener('click', async () => {
  for (const r of rekod.filter((x) => x.nama)) {
    muatTurun(r);
    await new Promise((s) => setTimeout(s, 350));
  }
});
$('kosongkan').addEventListener('click', () => {
  rekod = [];
  senarai.replaceChildren();
  $('seterusnya').hidden = true;
  status.textContent = '';
  kemasNama();
  fail.focus();
});

/* Salin no. akaun kopi */
const salinAkaun = $('salinAkaun');
salinAkaun.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText($('noAkaun').textContent);
    salinAkaun.textContent = 'No. akaun disalin';
  } catch (e) {
    salinAkaun.textContent = $('noAkaun').textContent;
  }
  setTimeout(() => { salinAkaun.textContent = 'Salin no. akaun'; }, 2500);
});

/* Borang daftar ringkas */
const borang = $('borangDaftar');
const mesej = $('mesejDaftar');
const hantar = $('hantarDaftar');
const GAGAL = 'Pendaftaran tidak berjaya dihantar. Cuba lagi sebentar nanti.';
borang.addEventListener('submit', async (e) => {
  e.preventDefault();
  mesej.textContent = '';
  const salah = [...borang.querySelectorAll('input[required]')].filter((i) => {
    const ok = i.value.trim() !== '' && i.checkValidity();
    i.toggleAttribute('aria-invalid', !ok);
    return !ok;
  })[0];
  if (salah) {
    mesej.textContent = salah.type === 'email' && salah.value
      ? 'Emel ini nampak tidak lengkap. Tulis seperti nama@moe-dl.edu.my.'
      : 'Sila isi nama, sekolah dan emel.';
    salah.focus();
    return;
  }
  hantar.disabled = true;
  hantar.setAttribute('aria-busy', 'true');
  hantar.textContent = 'Menghantar…';
  try {
    // text/plain: permintaan ringkas tanpa preflight CORS
    const res = await fetch(borang.dataset.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(Object.fromEntries(new FormData(borang))),
    });
    const r = await res.json();
    if (r.ok) {
      const nama = borang.elements.nama.value.trim();
      mesej.textContent = 'Terima kasih, ' + nama + '. Anda sudah didaftarkan.';
      $('ucapan').textContent = 'Terima kasih, ' + nama + '. Ini dia, tukar borang anda di bawah.';
      $('ucapan').hidden = false;
      borang.reset();
      bukaAlat();
    } else {
      mesej.textContent = r.mesej || GAGAL;
    }
  } catch (err) {
    mesej.textContent = GAGAL;
  }
  hantar.disabled = false;
  hantar.removeAttribute('aria-busy');
  hantar.textContent = 'Daftar untuk berita kemas kini';
});

/* Penutup dua langkah: kopi dan borang (pilihan), kemudian pasang */
const langkah1 = $('langkah1');
const langkah2 = $('langkah2');
langkah2.hidden = true;
$('alat').hidden = true;
function bukaAlat() {
  langkah1.hidden = true;
  langkah2.hidden = false;
  $('alat').hidden = false;
  $('alat').scrollIntoView({ block: 'start' });
  $('t1').focus({ preventScroll: true });
}
$('keLangkah2').addEventListener('click', () => {
  $('ucapan').hidden = true;
  bukaAlat();
});
$('keLangkah1').addEventListener('click', () => {
  langkah2.hidden = true;
  langkah1.hidden = false;
  $('keLangkah2').focus({ preventScroll: true });
  $('daftar').scrollIntoView({ block: 'start' });
});

/* Semua pautan ke #daftar bermula dari langkah pertama */
document.querySelectorAll('a[href="#daftar"]').forEach((a) => a.addEventListener('click', () => {
  langkah2.hidden = true;
  langkah1.hidden = false;
}));
