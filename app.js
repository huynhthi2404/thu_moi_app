'use strict';
/* ================= 1. QUY ĐỊNH NGHIỆP VỤ (sửa tại đây khi cần) ================= */
const CFG = {
  W: 1810, H: 2560,                       // kích thước thư mời (pixel) - KHÔNG đổi, vị trí chữ tính theo số này
  MAX_LOGOS: 5, LOGO_H: 114, LOGO_GAP: 76, LOGO_MAX_W: 1300, LOGO_MIN_H: 70, LOGO_CX: 904, LOGO_CY: 172,
  IMG_MAX_BYTES: 3 * 1024 * 1024, LOGO_MIN_SIDE: 150, SIG_MIN_W: 300, MIN_ALPHA_RATIO: 0.03, // ảnh phải có ≥3% điểm trong suốt
  MIN_SCALE: 0.7,                         // chữ được tự thu nhỏ tối đa còn 70%; nhỏ hơn nữa => báo lỗi, không xuất
  GUEST_MAX_CHARS: 36, MAX_GUESTS: 500,
  CHUNK: { png: 50, jpeg: 150 },          // số thư mời tối đa trong 1 file zip (tránh tràn bộ nhớ)
  QUALITY: 0.93
};
const FONT = 'MontserratX';
// Vị trí / cỡ chữ từng mục: x,y = tâm và đường chân chữ; size = cỡ gốc; max = bề rộng tối đa
const T = {
  unit1: { x: 904, y: 552, size: 53, wt: 700, max: 1300, up: 1 },
  unit2: { x: 904, y: 624, size: 53, wt: 700, max: 1300, up: 1 },
  guest: { x: 904, y: 917.5, size: 63, wt: 700, max: 1250, up: 1 },
  ev1: { x: 904, y: 1309, size: 94, wt: 700, max: 1300, up: 1, sh: 1 },
  ev2: { x: 904, y: 1407, size: 71, wt: 700, max: 1300, up: 1, sh: 1 },
  ev3: { x: 904, y: 1506, size: 71, wt: 700, max: 1300, up: 1, sh: 1 },
  ev4: { x: 904, y: 1604, size: 71, wt: 700, max: 1300, up: 1, sh: 1 },
  time: { x: 907, y: 1796, size: 48, wt: 600, it: 1, max: 1500, pre: 'Thời gian: ' },
  place: { x: 906, y: 1864, size: 48, wt: 600, it: 1, max: 1500, pre: 'Địa điểm: ' },
  signDate: { x: 1211, y: 2076, size: 48, wt: 600, it: 1, max: 1078 },
  title: { x: 1211, y: 2145, size: 43, wt: 700, max: 1000, up: 1 },
  signer: { x: 1213, y: 2478, size: 48, wt: 600, it: 1, max: 520 }
};
const LABELS = [['Trân trọng kính mời', 912, 795], ['Đến tham dự', 904, 1172]]; // nhãn cố định, người dùng không sửa
// Các ô nhập chung cho mọi thư mời: k = khóa, g = nhóm, m = số ký tự tối đa, d = mặc định
const FIELDS = [
  { k: 'unit1', g: 'unit', l: 'Dòng 1', d: 'BAN THƯỜNG VỤ', m: 24 },
  { k: 'unit2', g: 'unit', l: 'Dòng 2', d: 'ĐOÀN KHOA CÔNG NGHỆ THÔNG TIN', m: 36 },
  { k: 'ev1', g: 'event', l: 'Dòng 1 (chữ to nhất)', d: 'ĐẠI HỘI CHI ĐOÀN', m: 24 },
  { k: 'ev2', g: 'event', l: 'Dòng 2', d: 'LỚP: DHKTPM20A_KSTN', m: 30 },
  { k: 'ev3', g: 'event', l: 'Dòng 3', d: 'KHOA CÔNG NGHỆ THÔNG TIN', m: 34 },
  { k: 'ev4', g: 'event', l: 'Dòng 4', d: 'NHIỆM KỲ 2026 - 2027', m: 30 },
  { k: 'time', g: 'when', l: 'Thời gian', d: '18g30 ngày 29/11/2026', m: 34 },
  { k: 'place', g: 'when', l: 'Địa điểm', d: 'Phòng Giảng viên Khoa Công nghệ Thông tin', m: 60 },
  { k: 'signDate', g: 'sign', l: 'Nơi, ngày ký thư mời', d: 'Thành phố Hồ Chí Minh, ngày 20/11/2026', m: 46 },
  { k: 'title', g: 'sign', l: 'Chức danh người ký', d: 'BÍ THƯ CHI ĐOÀN DHKTPM20A_KSTN', m: 38 },
  { k: 'signer', g: 'sign', l: 'Họ tên người ký', d: 'Lê Phước Tài', m: 28 }
];
const SAMPLE = 'Bí thư Phan Anh Tuấn';

/* ================= 2. TRẠNG THÁI ================= */
const $ = s => document.querySelector(s);
const S = { vals: {}, logos: [], sig: { img: null, mode: 'white' }, rows: [], cur: 0, busy: false };
const KEY = 'thumoi_v1';
const mctx = document.createElement('canvas').getContext('2d'); // dùng để đo chữ
let IMG = {};

function loadSrc(src) { return new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; }); }
const fontStr = (s, size) => `${s.it ? 'italic ' : ''}${s.wt} ${size}px ${FONT}, sans-serif`;
function ratio(k, raw) {                    // tỉ lệ thu nhỏ cần thiết để vừa khung (1 = giữ nguyên)
  const s = T[k], t = (s.pre || '') + (s.up ? raw.toUpperCase() : raw);
  mctx.font = fontStr(s, s.size);
  return Math.min(1, s.max / mctx.measureText(t).width);
}
const slug = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
  .replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'thu_moi';

/* ================= 3. VẼ THƯ MỜI ================= */
function logoLayout(list) {
  let H = CFG.LOGO_H, gap = CFG.LOGO_GAP;
  const tot = () => list.reduce((a, l) => a + H * l.w / l.h, 0) + gap * Math.max(0, list.length - 1);
  const k = tot() > CFG.LOGO_MAX_W ? CFG.LOGO_MAX_W / tot() : 1;
  H *= k; gap *= k;
  let x = CFG.LOGO_CX - tot() / 2;
  return { H, items: list.map(l => { const w = H * l.w / l.h, it = { l, x, w }; x += w + gap; return it; } ) };
}
function drawText(ctx, k, raw) {
  raw = (raw || '').trim(); if (!raw) return;
  const s = T[k], t = (s.pre || '') + (s.up ? raw.toUpperCase() : raw);
  ctx.font = fontStr(s, s.size * ratio(k, raw));
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#fff';
  if (s.sh) { ctx.shadowColor = 'rgba(0,35,85,.78)'; ctx.shadowBlur = 6; ctx.shadowOffsetX = 4; ctx.shadowOffsetY = 6; }
  ctx.fillText(t, s.x, s.y);
  ctx.shadowColor = 'rgba(0,0,0,0)'; ctx.shadowBlur = ctx.shadowOffsetX = ctx.shadowOffsetY = 0;
}
function drawSig(ctx) {
  const im = S.sig.img; if (!im) return;
  let w = 400, h = w * im.naturalHeight / im.naturalWidth;
  if (h > 190) { h = 190; w = h * im.naturalWidth / im.naturalHeight; }
  const x = 1213 - w / 2, y = 2300 - h / 2;
  if (S.sig.mode !== 'white') return ctx.drawImage(im, x, y, w, h);
  const c = document.createElement('canvas'); c.width = Math.round(w); c.height = Math.round(h);
  const g = c.getContext('2d'); g.drawImage(im, 0, 0, c.width, c.height);
  g.globalCompositeOperation = 'source-in'; g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(c, x, y);
}
function render(cv, row) {
  cv.width = CFG.W; cv.height = CFG.H;
  const ctx = cv.getContext('2d'), V = S.vals;
  ctx.drawImage(IMG.bg, 0, 0, CFG.W, CFG.H);
  const L = logoLayout(S.logos);
  L.items.forEach(i => ctx.drawImage(i.l.img, i.x, CFG.LOGO_CY - L.H / 2, i.w, L.H));
  ctx.drawImage(IMG.title, IMG.titleX, IMG.titleY);
  drawText(ctx, 'unit1', V.unit1); drawText(ctx, 'unit2', V.unit2);
  ctx.font = fontStr({ it: 1, wt: 600 }, 48); ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
  LABELS.forEach(([t, x, y]) => ctx.fillText(t, x, y));
  drawText(ctx, 'guest', row.g);
  ['ev1', 'ev2', 'ev3', 'ev4'].forEach(k => drawText(ctx, k, V[k]));
  drawText(ctx, 'time', row.t || V.time); drawText(ctx, 'place', row.p || V.place);
  drawText(ctx, 'signDate', V.signDate); drawText(ctx, 'title', V.title);
  drawSig(ctx); drawText(ctx, 'signer', V.signer);
}

/* ================= 4. KIỂM TRA DỮ LIỆU ================= */
function fieldErrors() {
  const e = [];
  FIELDS.forEach(f => { const v = (S.vals[f.k] || '').trim(); if (v && ratio(f.k, v) < CFG.MIN_SCALE) e.push(`“${f.l}” quá rộng, hãy rút ngắn.`); });
  return e;
}
function parseRows() {
  return $('#list').value.split(/\r?\n/).map(l => l.trim()).filter(Boolean).map((l, i) => {
    const [g = '', t = '', p = ''] = l.split(/\t|\||;/).map(x => x.trim()); return { n: i + 1, g, t, p };
  });
}
function rowError(r) {
  if (!r.g) return 'thiếu tên';
  if (r.g.length > CFG.GUEST_MAX_CHARS) return `tên dài ${r.g.length}/${CFG.GUEST_MAX_CHARS} ký tự`;
  if (ratio('guest', r.g) < CFG.MIN_SCALE) return 'tên quá rộng so với khung';
  for (const [v, k, m] of [[r.t, 'time', 34], [r.p, 'place', 60]]) {
    if (v.length > m) return `${k === 'time' ? 'thời gian' : 'địa điểm'} dài quá ${m} ký tự`;
    if (v && ratio(k, v) < CFG.MIN_SCALE) return `${k === 'time' ? 'thời gian' : 'địa điểm'} quá rộng`;
  }
  return '';
}
/* ================= 5. ẢNH TẢI LÊN (logo, chữ ký) ================= */
async function readImage(file, minSide, minW) {
  if (!/^image\/(png|webp|svg\+xml)$/.test(file.type)) throw 'chỉ nhận PNG, WebP hoặc SVG nền trong suốt (không nhận JPG).';
  if (file.size > CFG.IMG_MAX_BYTES) throw 'file quá nặng (tối đa 3 MB).';
  const url = URL.createObjectURL(file);
  let img; try { img = await loadSrc(url); } catch { throw 'không đọc được ảnh.'; }
  const w = img.naturalWidth, h = img.naturalHeight;
  if (!w || !h) throw 'ảnh SVG thiếu width/height.';
  if (minSide && Math.min(w, h) < minSide) throw `ảnh quá nhỏ (${w}×${h}px), cạnh ngắn cần ≥ ${minSide}px.`;
  if (minW && w < minW) throw `ảnh quá nhỏ (rộng ${w}px, cần ≥ ${minW}px).`;
  if (w / h > 8 || h / w > 8) throw 'tỉ lệ ảnh quá dẹt hoặc quá dài.';
  if (file.type !== 'image/svg+xml') {
    const c = document.createElement('canvas'), k = Math.min(1, 300 / Math.max(w, h));
    c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
    const g = c.getContext('2d'); g.drawImage(img, 0, 0, c.width, c.height);
    const d = g.getImageData(0, 0, c.width, c.height).data; let tr = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] < 250) tr++;
    if (tr / (d.length / 4) < CFG.MIN_ALPHA_RATIO) throw 'ảnh KHÔNG có nền trong suốt. Hãy xóa nền rồi lưu lại dạng PNG.';
  }
  return { img, w, h };
}
const say = (msg, cls) => { const s = $('#status'); s.textContent = msg; s.className = cls || ''; };

/* ================= 6. GIAO DIỆN ================= */
function save() { try { localStorage.setItem(KEY, JSON.stringify({ v: S.vals, m: S.sig.mode })); } catch (e) { } }
function drawLogosUI() {
  const box = $('#logos'); box.innerHTML = '';
  S.logos.forEach((l, i) => {
    const d = document.createElement('div'); d.className = 'logo';
    d.innerHTML = `<img src="${l.src}"><b title="${l.name}">${l.name}</b><button class="btn">←</button><button class="btn">→</button><button class="btn">✕</button>`;
    const [a, b, c] = d.querySelectorAll('button');
    a.onclick = () => { if (i > 0) { [S.logos[i - 1], S.logos[i]] = [S.logos[i], S.logos[i - 1]]; refresh(); drawLogosUI(); } };
    b.onclick = () => { if (i < S.logos.length - 1) { [S.logos[i + 1], S.logos[i]] = [S.logos[i], S.logos[i + 1]]; refresh(); drawLogosUI(); } };
    c.onclick = () => { S.logos.splice(i, 1); refresh(); drawLogosUI(); };
    box.append(d);
  });
}
function buildForm() {
  FIELDS.forEach(f => {
    const w = document.createElement('label'); w.className = 'f';
    w.innerHTML = `<span>${f.l}<small id="c-${f.k}"></small></span><input id="i-${f.k}" maxlength="${f.m}">`;
    $('#g-' + f.g).append(w);
    const i = w.querySelector('input'); i.value = S.vals[f.k];
    i.oninput = () => { S.vals[f.k] = i.value; refresh(); };
  });
}
function refresh() {
  FIELDS.forEach(f => { $('#c-' + f.k).textContent = `${(S.vals[f.k] || '').length}/${f.m}`; });
  S.rows = parseRows();
  const bad = S.rows.map(r => [r, rowError(r)]).filter(x => x[1]);
  const fe = fieldErrors(), tooMany = S.rows.length > CFG.MAX_GUESTS;
  const msgs = [...fe, ...(tooMany ? [`Tối đa ${CFG.MAX_GUESTS} thư mời mỗi lần.`] : []), ...bad.slice(0, 6).map(([r, m]) => `Dòng ${r.n}: ${m}`)];
  if (bad.length > 6) msgs.push(`… và ${bad.length - 6} dòng lỗi khác.`);
  say(msgs.join('\n'), msgs.length ? 'err' : '');
  $('#count').textContent = S.rows.length ? `${S.rows.length} thư mời, ${bad.length} dòng lỗi.` : 'Chưa có danh sách: đang xem bản mẫu.';
  S.ok = S.rows.length > 0 && !msgs.length;
  $('#go').disabled = !S.ok || S.busy;
  S.cur = Math.min(S.cur, Math.max(0, S.rows.length - 1));
  const row = S.rows[S.cur] || { g: SAMPLE, t: '', p: '' };
  $('#who').textContent = S.rows.length ? `Thư mời ${S.cur + 1}/${S.rows.length}: ${row.g}` : 'Bản xem mẫu';
  $('#exp').textContent = S.rows.length ? `Tên file: ${String(S.cur + 1).padStart(3, '0')}_${slug(row.g)}.${$('#fmt').value === 'png' ? 'png' : 'jpg'}` : '';
  save(); render($('#cv'), row);
}

/* ================= 7. XUẤT HÀNG LOẠT ================= */
function download(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 5000);
}
async function exportAll() {
  const fmt = $('#fmt').value, ext = fmt === 'png' ? 'png' : 'jpg', mime = 'image/' + fmt;
  const rows = S.rows.slice(), size = CFG.CHUNK[fmt], parts = Math.ceil(rows.length / size);
  const ev = slug(S.vals.ev1 || 'su_kien'), day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const cv = document.createElement('canvas'); S.busy = true; S.stop = false;
  $('#go').disabled = true; $('#stop').hidden = false; $('#bar').hidden = false; $('#bar').max = rows.length; $('#bar').value = 0;
  try {
    for (let p = 0; p < parts && !S.stop; p++) {
      const zip = new JSZip(), part = rows.slice(p * size, (p + 1) * size);
      for (const r of part) {
        render(cv, r);
        const blob = await new Promise(ok => cv.toBlob(ok, mime, CFG.QUALITY));
        zip.file(`${String(r.n).padStart(3, '0')}_${slug(r.g)}.${ext}`, blob);
        $('#bar').value = r.n; $('#exp').textContent = `Đang tạo ${r.n}/${rows.length}…`;
        await new Promise(requestAnimationFrame);
      }
      if (S.stop) break;
      $('#exp').textContent = `Đang nén file zip ${p + 1}/${parts}…`;
      const z = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
      download(z, `ThuMoi_${ev}_${day}_${rows.length}thu${parts > 1 ? `_phan${p + 1}-${parts}` : ''}.zip`);
      await new Promise(r => setTimeout(r, 800));
    }
    $('#exp').textContent = S.stop ? 'Đã dừng.' : `Xong ${rows.length} thư mời${parts > 1 ? ` (${parts} file zip; nếu trình duyệt hỏi, hãy cho phép tải nhiều file)` : ''}.`;
  } catch (e) { say('Lỗi khi xuất: ' + e, 'err'); }
  S.busy = false; $('#stop').hidden = true; $('#bar').hidden = true; refresh();
}

/* ================= 8. KHỞI ĐỘNG ================= */
async function init() {
  FIELDS.forEach(f => S.vals[f.k] = f.d);
  try { const o = JSON.parse(localStorage.getItem(KEY) || '{}'); Object.assign(S.vals, o.v || {}); if (o.m) S.sig.mode = o.m; } catch (e) { }
  const A = window.ASSETS;
  for (const [src, style] of [[A.fontN, 'normal'], [A.fontI, 'italic']]) {
    const f = new FontFace(FONT, `url(${src})`, { weight: '100 900', style }); await f.load(); document.fonts.add(f);
  }
  IMG.bg = await loadSrc(A.bg); IMG.title = await loadSrc(A.title.src); IMG.titleX = A.title.x; IMG.titleY = A.title.y;
  for (const l of A.logos) { const img = await loadSrc(l.src); S.logos.push({ name: l.name, src: l.src, img, w: img.naturalWidth, h: img.naturalHeight }); }
  S.sig.img = await loadSrc(A.sig);
  $('#sigMode').value = S.sig.mode;
  buildForm(); drawLogosUI();

  $('#list').oninput = () => { S.cur = 0; refresh(); };
  $('#fmt').onchange = refresh;
  $('#sigMode').onchange = e => { S.sig.mode = e.target.value; refresh(); };
  $('#prev').onclick = () => { S.cur = Math.max(0, S.cur - 1); refresh(); };
  $('#next').onclick = () => { S.cur = Math.min(S.rows.length - 1, S.cur + 1); refresh(); };
  $('#go').onclick = exportAll; $('#stop').onclick = () => { S.stop = true; };
  $('#sigDel').onclick = () => { S.sig.img = null; refresh(); };
  $('#reset').onclick = () => { if (!confirm('Khôi phục toàn bộ nội dung về mặc định?')) return; try { localStorage.removeItem(KEY); } catch (e) { } location.reload(); };
  $('#logoIn').onchange = async e => {
    const out = []; let bad = false;
    for (const f of e.target.files) {
      try {
        if (S.logos.length >= CFG.MAX_LOGOS) throw `đã đủ ${CFG.MAX_LOGOS} logo.`;
        const r = await readImage(f, CFG.LOGO_MIN_SIDE), item = { name: f.name, src: r.img.src, img: r.img, w: r.w, h: r.h };
        if (logoLayout([...S.logos, item]).H < CFG.LOGO_MIN_H) throw 'hết chỗ trên đầu thư, logo sẽ bị quá nhỏ. Hãy bớt logo hoặc dùng logo ít dài hơn.';
        S.logos.push(item); out.push(`Đã thêm logo ${f.name}.`);
      } catch (err) { bad = true; out.push(`Logo “${f.name}”: ${err}`); }
    }
    e.target.value = ''; drawLogosUI(); refresh(); say(out.join('\n'), bad ? 'err' : 'ok');
  };
  $('#sigIn').onchange = async e => {
    const f = e.target.files[0]; if (!f) return; let m = 'Đã đổi chữ ký.', c = 'ok';
    try { S.sig.img = (await readImage(f, 0, CFG.SIG_MIN_W)).img; } catch (err) { m = `Chữ ký: ${err}`; c = 'err'; }
    e.target.value = ''; refresh(); say(m, c);
  };
  refresh();
}
init().catch(e => say('Không khởi động được: ' + e, 'err'));
