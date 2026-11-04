/* Standard4Helper: tukar borang Standard 4 (.xlsm/.xlsx) kepada CSV.
 * Berjalan sepenuhnya dalam pelayar: hanya XML nilai sel dibaca daripada fail,
 * vbaProject.bin tidak pernah dibuka, jadi makro tidak dijalankan. */
const S4Tukar = (() => {
  const SUB = [
    ['4.1.1', 'abc'],
    ['4.2.1', 'abc'],
    ['4.2.2', 'abcd'],
    ['4.3.1', 'abcde'],
    ['4.4.1', 'abcdefg'],
    ['4.4.2', 'abcd'],
    ['4.5.1', 'abcde'],
    ['4.6.1', 'abcdefg'],
  ];
  const JUMLAH = SUB.reduce((n, s) => n + s[1].length, 0);
  const NILAI_SKOR = /^[0-4](\.0+)?$/;

  const colNum = (c) => [...c].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
  const colName = (n) => {
    let s = '';
    while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = (n - r - 1) / 26; }
    return s;
  };
  const nyah = (s) => s.replace(/&(lt|gt|quot|apos|amp|#\d+|#x[0-9a-f]+);/gi, (m, e) => {
    const k = e.toLowerCase();
    if (k[0] === '#') return String.fromCodePoint(k[1] === 'x' ? parseInt(k.slice(2), 16) : +k.slice(1));
    return { lt: '<', gt: '>', quot: '"', apos: "'", amp: '&' }[k];
  });

  async function inflate(bytes) {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  /* Direktori pusat ZIP. Isi fail hanya dinyahmampat apabila diminta. */
  function bukaZip(buf) {
    const u8 = new Uint8Array(buf);
    const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    let eocd = -1;
    for (let i = u8.length - 22; i >= 0 && i >= u8.length - 65557; i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('bukan-xlsx');
    const n = dv.getUint16(eocd + 10, true);
    let p = dv.getUint32(eocd + 16, true);
    const fail = new Map();
    const td = new TextDecoder();
    for (let i = 0; i < n; i++) {
      if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('bukan-xlsx');
      const kaedah = dv.getUint16(p + 10, true);
      const saizZ = dv.getUint32(p + 20, true);
      const nl = dv.getUint16(p + 28, true);
      const xl = dv.getUint16(p + 30, true);
      const cl = dv.getUint16(p + 32, true);
      const off = dv.getUint32(p + 42, true);
      fail.set(td.decode(u8.subarray(p + 46, p + 46 + nl)).replace(/\\/g, '/'), { kaedah, saizZ, off });
      p += 46 + nl + xl + cl;
    }
    return {
      async baca(nama) {
        const f = fail.get(nama);
        if (!f) return null;
        if (f.kaedah !== 0 && f.kaedah !== 8) throw new Error('bukan-xlsx');
        const mula = f.off + 30 + dv.getUint16(f.off + 26, true) + dv.getUint16(f.off + 28, true);
        const data = u8.subarray(mula, mula + f.saizZ);
        return td.decode(f.kaedah === 0 ? data : await inflate(data));
      },
    };
  }

  function teksKaya(xml) {
    const tanpaFonetik = xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '');
    return nyah([...tanpaFonetik.matchAll(/<t(?:\s[^>]*)?>([^<]*)<\/t>/g)].map((m) => m[1]).join(''));
  }

  function bacaHelaian(xml, kongsi) {
    const sel = new Map();
    for (const m of xml.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = (m[1].match(/\br="([A-Z]+\d+)"/) || [])[1];
      if (!ref) continue;
      const jenis = (m[1].match(/\bt="(\w+)"/) || [])[1] || 'n';
      const isi = m[2] || '';
      const f = (isi.match(/<f\b[^>]*>([^<]*)<\/f>/) || [])[1] || '';
      let v = (isi.match(/<v>([^<]*)<\/v>/) || [])[1];
      if (jenis === 's') v = v === undefined ? undefined : kongsi[+v];
      else if (jenis === 'inlineStr') v = teksKaya(isi);
      else if (v !== undefined) v = nyah(v);
      sel.set(ref, { v: v === undefined ? '' : String(v), jenis, f: nyah(f) });
    }
    return sel;
  }

  async function bacaBuku(buf) {
    const zip = bukaZip(buf);
    const wbXml = await zip.baca('xl/workbook.xml');
    const rels = await zip.baca('xl/_rels/workbook.xml.rels');
    if (!wbXml || !rels) throw new Error('bukan-xlsx');
    const sasaran = {};
    for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) {
      const id = (m[0].match(/\bId="([^"]+)"/) || [])[1];
      const t = (m[0].match(/\bTarget="([^"]+)"/) || [])[1];
      if (id && t) sasaran[id] = t[0] === '/' ? t.slice(1) : 'xl/' + t;
    }
    const kongsiXml = await zip.baca('xl/sharedStrings.xml');
    const kongsi = kongsiXml
      ? [...kongsiXml.matchAll(/<si>([\s\S]*?)<\/si>|<si\/>/g)].map((m) => teksKaya(m[1] || ''))
      : [];
    const helaian = {};
    for (const m of wbXml.matchAll(/<sheet\b[^>]*>/g)) {
      const nama = nyah((m[0].match(/\bname="([^"]*)"/) || [])[1] || '').trim().toUpperCase();
      const id = (m[0].match(/\s\w+:id="([^"]+)"/) || [])[1];
      if (nama === 'MUKA DEPAN' || nama === 'STANDARD 4') {
        const xml = await zip.baca(sasaran[id]);
        if (xml) helaian[nama] = bacaHelaian(xml, kongsi);
      }
    }
    return helaian;
  }

  /* Cari lajur skor melalui label "Aspek 4.x.x", bukan alamat sel semata-mata. */
  function petaLajur(s4, nota) {
    let baris = 0;
    let jumpa = [];
    for (let r = 8; r <= 14 && !jumpa.length; r++) {
      const c = [...s4].filter(([k, x]) => k.replace(/[A-Z]+/, '') === String(r) && /^\s*Aspek\s+4\.\d\.\d/i.test(x.v));
      if (c.length === SUB.length) { baris = r; jumpa = c; }
    }
    if (!jumpa.length) return null;
    jumpa.sort((a, b) => colNum(a[0].replace(/\d+/, '')) - colNum(b[0].replace(/\d+/, '')));
    return SUB.map(([kod, items], i) => {
      const lajur = jumpa[i][0].replace(/\d+/, '');
      const label = (jumpa[i][1].v.match(/4\.\d\.\d/) || [])[0];
      if (label !== kod) nota.push(`Label ${jumpa[i][0]} tertulis ${label}, dibaca sebagai ${kod} mengikut turutan borang.`);
      // Lajur pilihan wujud hanya jika formula lajur tengah merujuk kepadanya (borang butang pilihan).
      const pil = colName(colNum(lajur) - 2);
      const tengah = s4.get(colName(colNum(lajur) - 1) + (baris + 1));
      const adaPilihan = !!tengah && new RegExp(`\\b${pil}${baris + 1}\\b`).test(tengah.f);
      return { kod, items, lajur, pil: adaPilihan ? pil : null, mula: baris + 1 };
    });
  }

  const kemas = (s) => s.replace(/%20/gi, ' ').replace(/\s+/g, ' ').trim();

  function namaFail(sesi, guru) {
    const bersih = (s) => kemas(s.replace(/%20/gi, ' ').replace(/[\\/:*?"<>|]/g, '-'));
    return `${bersih(sesi)}-${bersih(guru)}.csv`;
  }

  async function tukar(buf) {
    let h;
    try {
      h = await bacaBuku(buf);
    } catch (e) {
      return { ralat: 'Fail ini tidak dapat dibaca sebagai borang Excel. Fail mungkin berkata laluan, rosak, atau format .xls lama. Simpan semula sebagai .xlsx dan cuba lagi.' };
    }
    if (!h['MUKA DEPAN'] || !h['STANDARD 4']) {
      return { ralat: 'Helaian “MUKA DEPAN” atau “STANDARD 4” tiada. Fail ini bukan borang Standard 4 PdP.' };
    }
    const nota = [];
    const perhatian = [];
    const s4 = h['STANDARD 4'];
    const peta = petaLajur(s4, nota);
    if (!peta) {
      return { ralat: 'Label “Aspek 4.1.1” hingga “Aspek 4.6.1” tidak ditemui. Struktur borang ini berbeza, jadi skor tidak diekstrak.' };
    }

    const baris = [];
    for (const { kod, items, lajur, pil, mula } of peta) {
      [...items].forEach((item, i) => {
        const r = mula + i;
        const sel = s4.get(lajur + r);
        const ref = `${kod} ${item}`;
        const simpan = sel && sel.jenis !== 'e' ? sel.v.trim() : '';
        const sah = NILAI_SKOR.test(simpan) ? String(parseInt(simpan, 10)) : '';
        const pilih = pil && s4.get(pil + r) ? s4.get(pil + r).v.trim() : '';
        const dariPilihan = /^[1-5]$/.test(pilih) ? String(5 - +pilih) : '';
        let skor = sah;
        if (dariPilihan && sah && dariPilihan !== sah) {
          skor = dariPilihan;
          perhatian.push(`${ref}: sel ${lajur}${r} menyimpan ${sah}, tetapi pilihan ${pilih} bermaksud skor ${dariPilihan}. Skor ${dariPilihan} digunakan.`);
        } else if (dariPilihan && !sah) {
          skor = dariPilihan;
          nota.push(`${ref}: skor dikira daripada pilihan ${pilih} kerana hasil formula tiada.`);
        }
        if (!skor) {
          perhatian.push(simpan
            ? `${ref}: nilai “${simpan}” dalam ${lajur}${r} bukan skor 0 hingga 4. Ruangan skor dibiarkan kosong.`
            : `${ref}: tiada skor dalam ${lajur}${r}. Ruangan skor dibiarkan kosong.`);
        }
        baris.push({ sub: kod, item, skor });
      });
    }
    const diisi = baris.filter((b) => b.skor !== '').length;
    if (diisi === JUMLAH && baris.every((b) => b.skor === '4')) {
      perhatian.push('Semua 38 skor bernilai 4. Templat kosong juga begini, jadi pastikan borang sudah diisi.');
    }
    const md = h['MUKA DEPAN'];
    return {
      guru: kemas(md.get('G24') ? md.get('G24').v : ''),
      sesi: kemas(md.get('G30') ? md.get('G30').v : ''),
      baris, diisi, jumlah: JUMLAH, perhatian, nota,
    };
  }

  const keCsv = (baris) => ['sub_aspek,item,skor', ...baris.map((b) => `${b.sub},${b.item},${b.skor}`)].join('\n');

  /* Akhiran (2), (3) supaya fail senama dalam satu kelompok tidak saling menindih. */
  function namaUnik(nama, dipakai) {
    if (!dipakai.has(nama.toLowerCase())) { dipakai.add(nama.toLowerCase()); return nama; }
    const asas = nama.replace(/\.csv$/i, '');
    for (let n = 2; ; n++) {
      const c = `${asas} (${n}).csv`;
      if (!dipakai.has(c.toLowerCase())) { dipakai.add(c.toLowerCase()); return c; }
    }
  }

  return { SUB, JUMLAH, tukar, keCsv, namaFail, namaUnik };
})();
if (typeof module !== 'undefined') module.exports = S4Tukar;
