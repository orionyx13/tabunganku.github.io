// app.js
// Main application logic
// Tidak pakai ES Module - kompatibel semua hosting

const App = (() => {

  // ===== STATE =====
  let currentUser     = null;
  let savings         = [];
  let history         = [];
  let userData        = { xp: 0, streak: 0, lastSave: null, bestStreak: 0, badges: [] };
  let currentSavingId = null;
  let confirmCallback = null;
  let chartInstance   = null;
  let selectedEmoji   = '🏠';
  let isDark          = false;
  let notifEnabled    = true;

  // ===== CONSTANTS =====
  const MOTIVATIONS = [
    '"Menabung bukan soal berapa banyak, tapi soal konsistensi." 💪',
    '"Seribu rupiah hari ini = impian yang lebih dekat esok hari." 🌟',
    '"Orang kaya beli aset, orang pintar nabung dulu." 🧠',
    '"Setiap rupiah yang ditabung adalah langkah menuju kebebasan." 🦋',
    '"Jangan tunda nabung sampai banyak uang. Mulai dari yang kecil!" 🌱',
    '"Tabungan adalah doa untuk masa depan diri sendiri." 🙏',
    '"Konsisten itu kunci. Nabung sedikit tiap hari > banyak tapi sekali." ✨',
    '"Masa depanmu dimulai dari keputusan kecil hari ini." 🎯',
    '"Nabung hari ini, sultan esok hari." 👑',
    '"Kalau nunggu siap, ga bakal pernah mulai." 🚀',
  ];

  const LEVELS = [
    { min: 0,    title: 'Beginner Saver', emoji: '🌱', desc: 'Terus nabung buat naik level!' },
    { min: 100,  title: 'Bronze Saver',   emoji: '🥉', desc: 'Bagus! Kamu mulai terbiasa nabung.' },
    { min: 300,  title: 'Silver Saver',   emoji: '🥈', desc: 'Kamu makin konsisten nih!' },
    { min: 600,  title: 'Gold Saver',     emoji: '🥇', desc: 'Keren! Kamu Sultan level Gold!' },
    { min: 1000, title: 'Platinum Saver', emoji: '💎', desc: 'Luar biasa! Kamu ahli menabung!' },
    { min: 2000, title: 'Sultan 💰',      emoji: '👑', desc: 'SULTAN! Kamu legenda tabungan!' },
  ];

  const ALL_BADGES = [
    { id: 'first_save',   icon: '🌱', name: 'First Step',     desc: 'Nabung pertama kali',          check: () => history.length >= 1 },
    { id: 'streak_3',     icon: '🔥', name: '3 Hari Streak',  desc: 'Nabung 3 hari berturut-turut', check: () => (userData.bestStreak||0) >= 3 },
    { id: 'streak_7',     icon: '💫', name: '7 Hari Streak',  desc: 'Nabung seminggu penuh!',       check: () => (userData.bestStreak||0) >= 7 },
    { id: 'streak_30',    icon: '🏅', name: '30 Hari Streak', desc: 'Nabung sebulan penuh!',        check: () => (userData.bestStreak||0) >= 30 },
    { id: 'first_target', icon: '💎', name: 'Target Pertama', desc: 'Selesaikan 1 target tabungan', check: () => savings.some(s => (s.currentAmount||0) >= s.targetAmount) },
    { id: 'save_100k',    icon: '💰', name: '100K Collector', desc: 'Kumpulkan Rp 100.000',         check: () => totalSaved() >= 100000 },
    { id: 'save_1m',      icon: '🤑', name: 'Millionaire',    desc: 'Kumpulkan Rp 1.000.000',      check: () => totalSaved() >= 1000000 },
    { id: 'save_10m',     icon: '🏆', name: 'Big Saver',      desc: 'Kumpulkan Rp 10.000.000',     check: () => totalSaved() >= 10000000 },
    { id: 'xp_100',       icon: '⭐', name: 'XP Hunter',      desc: 'Raih 100 XP',                 check: () => (userData.xp||0) >= 100 },
    { id: 'xp_500',       icon: '🌟', name: 'XP Master',      desc: 'Raih 500 XP',                 check: () => (userData.xp||0) >= 500 },
    { id: 'multi_target', icon: '🎯', name: 'Multi Target',   desc: 'Punya 3 tabungan aktif',      check: () => savings.length >= 3 },
    { id: 'sultan',       icon: '👑', name: 'Sultan',         desc: 'Raih 2000 XP',                check: () => (userData.xp||0) >= 2000 },
    { id: 'consistent',   icon: '📅', name: 'Konsisten',      desc: 'Nabung 10 kali total',        check: () => history.length >= 10 },
    { id: 'hundred',      icon: '🎖️', name: '100 Kali Nabung',desc: 'Nabung 100 kali total',       check: () => history.length >= 100 },
  ];

  // ===== HELPERS =====
  const db          = () => window._fbDb;
  const totalSaved  = () => savings.reduce((a, s) => a + (s.currentAmount || 0), 0);
  const fRp         = n  => 'Rp ' + Math.round(n || 0).toLocaleString('id-ID');
  const fRpS        = n  => {
    if (n >= 1e9) return 'Rp ' + (n/1e9).toFixed(1) + 'M';
    if (n >= 1e6) return 'Rp ' + (n/1e6).toFixed(1) + 'jt';
    if (n >= 1e3) return 'Rp ' + (n/1e3).toFixed(0) + 'k';
    return 'Rp ' + n;
  };
  const fDate = d => {
    if (!d) return '-';
    try { return new Date(d).toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }); }
    catch { return '-'; }
  };
  const fDateS = d => {
    if (!d) return '-';
    try { return new Date(d).toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'2-digit' }); }
    catch { return '-'; }
  };
  const hariLbl        = h  => ({ daily:'Tiap hari', weekday:'Sen–Jum', weekend:'Weekend' })[h] || 'Tiap hari';
  const getDaysLeft    = d  => Math.ceil((new Date(d) - new Date()) / 86400000);
  const isDeadlineBad  = d  => d && getDaysLeft(d) <= 7;

  function calcEst(s) {
    const r = Math.max(0, s.targetAmount - (s.currentAmount || 0));
    if (r <= 0) return '✅ Selesai!';
    const days = Math.ceil(r / s.perHari);
    const d = new Date(); d.setDate(d.getDate() + days);
    return fDateS(d.toISOString());
  }

  function getLvInfo(xp) {
    let lv = LEVELS[0], next = LEVELS[1];
    for (let i = LEVELS.length - 1; i >= 0; i--) {
      if (xp >= LEVELS[i].min) { lv = LEVELS[i]; next = LEVELS[i+1] || LEVELS[i]; break; }
    }
    const pct = next !== lv ? Math.min(100, ((xp - lv.min) / (next.min - lv.min)) * 100) : 100;
    return { lv, next, pct };
  }

  // ===== INIT (dipanggil setelah DOM ready) =====
  function init() {
    Auth.init(
      async (user) => {
        currentUser = user;
        document.getElementById('authScreen').style.display = 'none';
        document.getElementById('app').style.display        = 'block';
        document.getElementById('fab').classList.add('show');
        await loadUserData();
        setupListeners();
        checkResponsive();
        checkReminder();
      },
      () => { currentUser = null; savings = []; history = []; }
    );
  }

  // ===== USER DATA =====
  async function loadUserData() {
    const snap = await db().collection('users').doc(currentUser.uid).get();
    if (snap.exists) userData = { ...userData, ...snap.data() };

    const info = Auth.getUserInfo(currentUser);
    document.getElementById('sidebarName').textContent   = info.name;
    document.getElementById('settingsName').textContent  = info.name;
    document.getElementById('settingsEmail').textContent = info.email;

    const av = document.getElementById('sidebarAvatar');
    if (info.photoURL) {
      av.outerHTML = `<img src="${info.photoURL}" class="u-avatar" id="sidebarAvatar" alt="avatar" onerror="this.outerHTML='<div class=u-avatar-ph id=sidebarAvatar>${info.initial}</div>'">`;
    } else {
      av.textContent = info.initial;
    }
  }

  async function saveUserData() {
    await db().collection('users').doc(currentUser.uid).set(userData, { merge: true });
  }

  // ===== REALTIME LISTENERS =====
  function setupListeners() {
    db().collection('users').doc(currentUser.uid).collection('savings')
      .orderBy('createdAt', 'desc')
      .onSnapshot(snap => {
        savings = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderSavings();
        renderDashboard();
      });

    db().collection('users').doc(currentUser.uid).collection('history')
      .orderBy('timestamp', 'desc')
      .onSnapshot(snap => {
        history = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderHistory();
        if (document.getElementById('page-statistik').classList.contains('active')) renderStats();
      });
  }

  // ===== RENDER SAVINGS =====
  function renderSavings() {
    const c = document.getElementById('savingsList');
    if (!savings.length) {
      c.innerHTML = `<div class="empty-state">
        <div class="empty-ico">🏦</div>
        <h3>Belum ada tabungan</h3>
        <p>Yuk mulai tabungan pertama kamu!</p>
        <button class="btn btn-primary" onclick="App.openAddModal()">➕ Tambah Tabungan</button>
      </div>`;
      return;
    }
    const g = document.createElement('div');
    g.className = 'savings-grid';
    savings.forEach(s => g.appendChild(buildCard(s)));
    c.innerHTML = '';
    c.appendChild(g);
  }

  function buildCard(s) {
    const pct   = Math.min(100, ((s.currentAmount||0) / s.targetAmount) * 100);
    const rem   = Math.max(0, s.targetAmount - (s.currentAmount||0));
    const dlBad = isDeadlineBad(s.deadline);
    const dLeft = s.deadline ? getDaysLeft(s.deadline) : null;
    const done  = pct >= 100;
    const el    = document.createElement('div');
    el.className = 'saving-card';
    el.innerHTML = `
      <div class="sc-top">
        <div class="sc-emoji">${s.emoji||'💰'}</div>
        <div class="sc-badges">
          <span class="bp ${s.prioritas==='utama'?'utama':'samp'}">${s.prioritas==='utama'?'⭐ Utama':'📌 Sampingan'}</span>
          ${done ? '<span class="bp done">✅ Selesai</span>' : ''}
          ${(s.streak||0) >= 7 ? `<span class="bp streak">🔥 ${s.streak}d</span>` : ''}
        </div>
      </div>
      <div class="sc-title">${s.title}</div>
      <div class="sc-amt">
        <span class="sc-cur">${fRp(s.currentAmount||0)}</span>
        <span class="sc-sep">/</span>
        <span class="sc-tgt">${fRp(s.targetAmount)}</span>
      </div>
      ${dlBad ? `<div class="dl-warn" style="display:block">⚠️ Deadline ${dLeft<=0?'sudah lewat!':`${dLeft} hari lagi!`}</div>` : ''}
      <div class="prog-wrap">
        <div class="prog-lbl"><span>Progress</span><span>${pct.toFixed(1)}%</span></div>
        <div class="prog-track"><div class="prog-fill ${done?'done':''}" style="width:${pct}%"></div></div>
      </div>
      <div class="sc-info-grid">
        <div class="sc-info-item"><div class="sc-info-lbl">Sisa</div><div class="sc-info-val">${fRp(rem)}</div></div>
        <div class="sc-info-item"><div class="sc-info-lbl">Per hari</div><div class="sc-info-val">${fRp(s.perHari)}</div></div>
        <div class="sc-info-item"><div class="sc-info-lbl">Jadwal</div><div class="sc-info-val">${hariLbl(s.hariNabung)}</div></div>
        <div class="sc-info-item"><div class="sc-info-lbl">Est. Selesai</div><div class="sc-info-val">${calcEst(s)}</div></div>
      </div>
      <div class="sc-actions">
        ${!done
          ? `<button class="btn btn-success" onclick="App.openNabung('${s.id}')">💸 Nabung</button>`
          : `<button class="btn btn-success" disabled>✅ Lunas!</button>`}
        <button class="btn btn-danger-ol" onclick="App.deleteSaving('${s.id}')">🗑️</button>
      </div>`;
    return el;
  }

  // ===== RENDER DASHBOARD =====
  function renderDashboard() {
    document.getElementById('statTotal').textContent  = fRp(totalSaved());
    document.getElementById('statTarget').textContent = savings.length;
    document.getElementById('statStreak').textContent = (userData.streak||0) + ' hari';
    document.getElementById('statBadges').textContent = (userData.badges||[]).length;
    document.getElementById('motivasiText').textContent = MOTIVATIONS[new Date().getDay() % MOTIVATIONS.length];

    const c = document.getElementById('dashboardSavings');
    if (!savings.length) {
      c.innerHTML = `<div class="empty-state" style="padding:30px 20px"><div class="empty-ico">🏦</div><h3>Belum ada tabungan</h3><p>Yuk tambah tabungan pertama!</p></div>`;
    } else {
      const g = document.createElement('div');
      g.className = 'savings-grid';
      savings.slice(0, 4).forEach(s => g.appendChild(buildCard(s)));
      c.innerHTML = '';
      c.appendChild(g);
    }
    updateLvUI();
    checkBadges();
  }

  function updateLvUI() {
    const { lv, next, pct } = getLvInfo(userData.xp || 0);
    document.getElementById('levelEmoji').textContent   = lv.emoji;
    document.getElementById('levelTitle').textContent   = lv.title;
    document.getElementById('levelDesc').textContent    = lv.desc;
    document.getElementById('sidebarLevel').textContent = lv.emoji + ' ' + lv.title;
    document.getElementById('xpFill').style.width       = pct + '%';
    document.getElementById('xpLabel').textContent      = `${userData.xp||0} XP${next !== lv ? ' / ' + next.min + ' XP' : ' (MAX!)'}`;
  }

  // ===== ADD SAVING =====
  function openAddModal() {
    document.getElementById('inputMulai').value = new Date().toISOString().split('T')[0];
    ['inputJudul','inputTarget','inputPerHari','inputDeadline','inputKenaikan'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('calcPreview').classList.remove('show');
    openModal('addModal');
  }

  function selectEmoji(el) {
    document.querySelectorAll('.emoji-opt').forEach(e => e.classList.remove('selected'));
    el.classList.add('selected');
    selectedEmoji = el.dataset.emoji;
  }

  function calcPreview() {
    const t = parseFloat(document.getElementById('inputTarget').value);
    const p = parseFloat(document.getElementById('inputPerHari').value);
    if (!t || !p || p <= 0) { document.getElementById('calcPreview').classList.remove('show'); return; }
    const h = Math.ceil(t / p);
    const d = new Date(); d.setDate(d.getDate() + h);
    const y = Math.floor(h/365), m = Math.floor((h%365)/30), dy = h%30;
    let s = '';
    if (y > 0) s += y + ' tahun ';
    if (m > 0) s += m + ' bulan ';
    if (dy > 0 || !s) s += dy + ' hari';
    document.getElementById('previewLama').textContent    = s.trim();
    document.getElementById('previewSelesai').textContent = d.toLocaleDateString('id-ID', { day:'numeric', month:'long', year:'numeric' });
    document.getElementById('previewHari').textContent    = h.toLocaleString('id-ID') + ' hari';
    document.getElementById('calcPreview').classList.add('show');
  }

  async function saveSaving() {
    const title   = document.getElementById('inputJudul').value.trim();
    const target  = parseFloat(document.getElementById('inputTarget').value);
    const perHari = parseFloat(document.getElementById('inputPerHari').value);
    if (!title)              { showToast('Masukkan judul tabungan!',      'warning', '⚠️'); return; }
    if (!target  || target  <= 0) { showToast('Masukkan target yang valid!',  'warning', '⚠️'); return; }
    if (!perHari || perHari <= 0) { showToast('Masukkan jumlah nabung/hari!', 'warning', '⚠️'); return; }

    await db().collection('users').doc(currentUser.uid).collection('savings').add({
      title, emoji: selectedEmoji,
      targetAmount: target, perHari, currentAmount: 0,
      mulai:      document.getElementById('inputMulai').value || new Date().toISOString().split('T')[0],
      deadline:   document.getElementById('inputDeadline').value || null,
      hariNabung: document.getElementById('inputHariNabung').value,
      kenaikan:   parseFloat(document.getElementById('inputKenaikan').value) || 0,
      prioritas:  document.getElementById('inputPrioritas').value,
      streak: 0, lastSave: null,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    addXP(20);
    showToast('Tabungan berhasil dibuat! +20 XP ⭐', 'xp', '⭐');
    closeModal('addModal');
  }

  // ===== NABUNG =====
  function openNabung(id) {
    const s = savings.find(x => x.id === id);
    if (!s) return;
    currentSavingId = id;
    document.getElementById('nabungTitle').textContent      = s.emoji + ' ' + s.title;
    document.getElementById('nabungCurrent').textContent    = fRp(s.currentAmount||0);
    document.getElementById('nabungTargetShow').textContent = fRp(s.targetAmount);
    document.getElementById('inputNabung').value            = s.perHari;
    document.getElementById('inputNabungNote').value        = '';
    openModal('nabungModal');
  }

  function setQuick(v) { document.getElementById('inputNabung').value = v; }

  async function doNabung() {
    const amt = parseFloat(document.getElementById('inputNabung').value);
    if (!amt || amt <= 0) { showToast('Masukkan jumlah yang valid!', 'warning', '⚠️'); return; }
    const note = document.getElementById('inputNabungNote').value.trim();
    const s    = savings.find(x => x.id === currentSavingId);
    if (!s) return;

    const newAmt  = (s.currentAmount||0) + amt;
    const today   = new Date().toDateString();
    let newStreak = s.streak || 0;
    if (s.lastSave !== today) {
      const yd = new Date(); yd.setDate(yd.getDate() - 1);
      newStreak = s.lastSave === yd.toDateString() ? newStreak + 1 : 1;
    }

    await db().collection('users').doc(currentUser.uid).collection('savings').doc(currentSavingId)
      .update({ currentAmount: newAmt, lastSave: today, streak: newStreak });

    await db().collection('users').doc(currentUser.uid).collection('history').add({
      savingId: currentSavingId, savingTitle: s.title, savingEmoji: s.emoji||'💰',
      amount: amt, note,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      date: new Date().toISOString()
    });

    if (userData.lastSave !== today) {
      const yd = new Date(); yd.setDate(yd.getDate() - 1);
      userData.streak    = userData.lastSave === yd.toDateString() ? (userData.streak||0) + 1 : 1;
      if (userData.streak > (userData.bestStreak||0)) userData.bestStreak = userData.streak;
      userData.lastSave  = today;
    }
    addXP(10);
    await saveUserData();

    if (newAmt >= s.targetAmount) {
      showToast(`🎉 TARGET "${s.title}" TERCAPAI! +100 XP`, 'success', '🏆');
      addXP(100);
    } else {
      showToast(`+${fRp(amt)} ke ${s.emoji} ${s.title}! +10 XP`, 'xp', '⭐');
    }
    closeModal('nabungModal');
  }

  // ===== DELETE =====
  function deleteSaving(id) {
    const s = savings.find(x => x.id === id);
    confirmCallback = async () => {
      await db().collection('users').doc(currentUser.uid).collection('savings').doc(id).delete();
      showToast('Tabungan dihapus.', 'info', 'ℹ️');
    };
    document.getElementById('confirmTitle').textContent = 'Hapus Tabungan?';
    document.getElementById('confirmMsg').textContent   = `Hapus "${s?.title}"? Saldo tidak bisa dikembalikan.`;
    openModal('confirmModal');
  }

  function confirmReset() {
    confirmCallback = async () => {
      for (const s of savings) {
        await db().collection('users').doc(currentUser.uid).collection('savings').doc(s.id).delete();
      }
      showToast('Semua tabungan direset!', 'info', 'ℹ️');
    };
    document.getElementById('confirmTitle').textContent = 'Reset Semua Data?';
    document.getElementById('confirmMsg').textContent   = 'Semua tabungan dihapus permanen. Yakin?';
    openModal('confirmModal');
  }

  async function confirmOk() {
    closeModal('confirmModal');
    if (confirmCallback) { await confirmCallback(); confirmCallback = null; }
  }

  // ===== RENDER HISTORY =====
  function renderHistory() {
    const el = document.getElementById('historyList');
    if (!history.length) {
      el.innerHTML = `<div class="empty-state"><div class="empty-ico">📋</div><h3>Belum ada riwayat</h3><p>Mulai nabung buat lihat history!</p></div>`;
      return;
    }
    el.innerHTML = history.slice(0, 60).map(h => `
      <div class="history-item">
        <div class="h-ico">${h.savingEmoji||'💰'}</div>
        <div class="h-info">
          <div class="h-title">${h.savingTitle||'Tabungan'}</div>
          <div class="h-meta">${h.note ? h.note + ' · ' : ''}${fDate(h.date)}</div>
        </div>
        <div class="h-amt">+${fRp(h.amount)}</div>
      </div>`).join('');
  }

  // ===== RENDER STATS =====
  function renderStats() {
    const tot  = history.reduce((a, h) => a + (h.amount||0), 0);
    const days = history.length;
    document.getElementById('statRataRata').textContent   = days ? fRp(tot/days) : 'Rp 0';
    document.getElementById('statHariNabung').textContent = days;
    document.getElementById('statBestStreak').textContent = (userData.bestStreak||0) + ' hari';

    const { labels, data } = getLast30();
    if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
    const ctx = document.getElementById('savingsChart');
    if (ctx) {
      const dark = document.documentElement.getAttribute('data-theme') === 'dark';
      const tc   = dark ? '#7a9acc' : '#5a6f9a';
      const gc   = dark ? 'rgba(122,154,204,.1)' : 'rgba(37,99,235,.08)';
      chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'Nabung (Rp)', data,
            backgroundColor: data.map(v => v > 0 ? 'rgba(37,99,235,.75)' : 'rgba(37,99,235,.12)'),
            borderRadius: 7, borderSkipped: false,
            hoverBackgroundColor: 'rgba(37,99,235,.9)',
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ' ' + fRp(c.parsed.y) } } },
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 10 }, color: tc } },
            y: { grid: { color: gc }, border: { display: false }, ticks: { font: { size: 10 }, color: tc, callback: v => fRpS(v) } }
          }
        }
      });
    }

    const tl = document.getElementById('statsTargetList');
    if (!savings.length) { tl.innerHTML = '<p style="color:var(--text2);font-size:.9rem;padding:8px 0">Belum ada tabungan.</p>'; return; }
    tl.innerHTML = savings.map(s => {
      const pct = Math.min(100, ((s.currentAmount||0) / s.targetAmount) * 100);
      return `<div style="margin-bottom:18px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:7px">
          <span style="font-weight:700">${s.emoji} ${s.title}</span>
          <span style="color:var(--blue);font-weight:800;font-family:'Outfit',sans-serif">${pct.toFixed(1)}%</span>
        </div>
        <div class="prog-track"><div class="prog-fill ${pct>=100?'done':''}" style="width:${pct}%"></div></div>
        <div style="display:flex;justify-content:space-between;font-size:.78rem;color:var(--text2);margin-top:5px">
          <span>${fRp(s.currentAmount||0)}</span><span>${fRp(s.targetAmount)}</span>
        </div>
      </div>`;
    }).join('');
  }

  function getLast30() {
    const labels = [], data = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      labels.push(i % 5 === 0 ? d.toLocaleDateString('id-ID', { day:'2-digit', month:'short' }) : '');
      data.push(history.filter(h => h.date && new Date(h.date).toDateString() === d.toDateString()).reduce((a, h) => a + (h.amount||0), 0));
    }
    return { labels, data };
  }

  // ===== BADGES =====
  function renderBadges() {
    const earned = userData.badges || [];
    document.getElementById('badgesGrid').innerHTML =
      `<div style="grid-column:1/-1;margin-bottom:8px">
        <div style="display:flex;align-items:center;gap:10px;background:var(--blue-soft);border:1px solid var(--blue-light);border-radius:12px;padding:14px 18px">
          <span style="font-size:1.5rem">🏆</span>
          <div>
            <div style="font-weight:800;font-size:.95rem">${earned.length} / ${ALL_BADGES.length} Badge Didapat</div>
            <div style="font-size:.78rem;color:var(--text2);margin-top:2px">Terus nabung buat unlock semua badge!</div>
          </div>
        </div>
      </div>`
      + ALL_BADGES.map(b => {
        const ok = earned.includes(b.id);
        return `<div class="badge-card ${ok ? 'earned' : 'locked'}">
          ${ok ? '<div class="badge-check">✓</div>' : ''}
          <div class="badge-ico">${b.icon}</div>
          <div class="badge-name">${b.name}</div>
          <div class="badge-desc">${b.desc}</div>
        </div>`;
      }).join('');
  }

  function checkBadges() {
    const earned = userData.badges || [];
    let changed  = false;
    ALL_BADGES.forEach(b => {
      if (!earned.includes(b.id) && b.check()) {
        earned.push(b.id);
        showToast(`🏆 Badge baru: ${b.name} ${b.icon}! +50 XP`, 'success', '🏆');
        addXP(50);
        changed = true;
      }
    });
    if (changed) {
      userData.badges = earned;
      saveUserData();
      document.getElementById('statBadges').textContent = earned.length;
    }
  }

  function addXP(n) { userData.xp = (userData.xp||0) + n; saveUserData(); updateLvUI(); }

  // ===== REMINDER =====
  function checkReminder() {
    if (!notifEnabled || !savings.length) return;
    if (userData.lastSave !== new Date().toDateString()) {
      setTimeout(() => showToast('🔔 Hai! Jangan lupa nabung hari ini ya!', 'info', '🔔'), 2500);
    }
  }

  // ===== NAVIGATION =====
  function showPage(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('page-' + page).classList.add('active');
    const titles = { dashboard:'Dashboard', tabungan:'Tabungan Saya', history:'History', statistik:'Statistik', badges:'Badges 🏆', settings:'Pengaturan' };
    document.getElementById('pageTitle').textContent = titles[page] || page;
    const idx = ['dashboard','tabungan','history','statistik','badges','settings'].indexOf(page);
    if (idx >= 0) document.querySelectorAll('.nav-item')[idx]?.classList.add('active');
    if (page === 'statistik') renderStats();
    if (page === 'badges')    renderBadges();
    if (window.innerWidth <= 900) document.getElementById('sidebar').classList.remove('open');
  }

  function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); }

  function toggleTheme() {
    isDark = !isDark;
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : '');
    document.getElementById('themeBtn').textContent = isDark ? '☀️' : '🌙';
    document.getElementById('darkToggle').classList.toggle('on', isDark);
    if (document.getElementById('page-statistik').classList.contains('active')) renderStats();
  }

  function toggleNotif() {
    notifEnabled = !notifEnabled;
    document.getElementById('notifToggle').classList.toggle('on', notifEnabled);
    showToast(notifEnabled ? 'Notifikasi aktif!' : 'Notifikasi mati.', 'info', notifEnabled ? '🔔' : '🔕');
  }

  // ===== MODAL =====
  function openModal(id)  { document.getElementById(id).classList.add('open'); }
  function closeModal(id) { document.getElementById(id).classList.remove('open'); }

  // ===== TOAST =====
  const TICONS = { success:'✅', info:'ℹ️', warning:'⚠️', xp:'⭐', error:'❌' };
  function showToast(msg, type = 'info', icon) {
    const c  = document.getElementById('toastContainer');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span class="toast-ico">${icon||TICONS[type]||'ℹ️'}</span><span class="toast-msg">${msg}</span><button class="toast-x" onclick="this.parentElement.remove()">✕</button>`;
    c.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateX(60px)'; setTimeout(() => el.remove(), 320); }, 3800);
  }

  // ===== RESPONSIVE =====
  function checkResponsive() {
    const t = document.getElementById('menuToggle');
    if (t) t.style.display = window.innerWidth <= 900 ? 'flex' : 'none';
  }
  window.addEventListener('resize', checkResponsive);

  // ===== CLOSE MODAL ON BACKDROP =====
  document.addEventListener('click', e => {
    if (e.target.classList.contains('modal-ov')) e.target.classList.remove('open');
  });

  // Expose public API
  return {
    init, showToast,
    showPage, toggleSidebar, toggleTheme, toggleNotif,
    openAddModal, selectEmoji, calcPreview, saveSaving,
    openNabung, setQuick, doNabung,
    deleteSaving, confirmReset, confirmOk,
    openModal, closeModal,
    renderStats, renderBadges,
    loginGoogle: () => Auth.loginWithGoogle(),
    logout:      () => Auth.logout(),
  };
})();

window.App = App;
console.log('%cTabunganKu 💰 ready!', 'color:#2563eb;font-weight:800;font-size:14px');
