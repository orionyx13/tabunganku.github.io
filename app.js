// ============================================
// TabunganKu - app.js
// Main application logic
// ============================================

import { db } from './firebase-config.js';
import {
  loginWithGoogle, logoutUser, initAuthObserver, getUserInfo, checkRedirectResult
} from './auth.js';
import {
  collection, doc, addDoc, setDoc, getDoc, deleteDoc,
  query, orderBy, onSnapshot, updateDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// ===== STATE =====
let currentUser  = null;
let savings      = [];
let history      = [];
let userData     = { xp: 0, streak: 0, lastSave: null, bestStreak: 0, badges: [] };
let currentSavingId  = null;
let confirmCallback  = null;
let chartInstance    = null;
let selectedEmoji    = '🏠';
let isDark           = false;
let notifEnabled     = true;

// ===== CONSTANTS =====
const MOTIVATIONS = [
  '"Menabung bukan soal berapa banyak, tapi soal konsistensi." 💪',
  '"Seribu rupiah hari ini = impian yang lebih dekat esok hari." 🌟',
  '"Orang kaya beli aset, orang pintar nabung dulu." 🧠',
  '"Setiap rupiah yang ditabung adalah langkah menuju kebebasan." 🦋',
  '"Jangan tunda nabung sampai banyak uang. Mulai dari yang kecil!" 🌱',
  '"Tabungan adalah doa untuk masa depan diri sendiri." 🙏',
  '"Konsisten itu kunci. Nabung sedikit tiap hari lebih baik daripada banyak tapi sekali." ✨',
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
  { id: 'first_save',   icon: '🌱', name: 'First Step',      desc: 'Nabung pertama kali',               check: () => history.length >= 1 },
  { id: 'streak_3',     icon: '🔥', name: '3 Hari Streak',   desc: 'Nabung 3 hari berturut-turut',      check: () => (userData.bestStreak || 0) >= 3 },
  { id: 'streak_7',     icon: '💫', name: '7 Hari Streak',   desc: 'Nabung seminggu penuh!',            check: () => (userData.bestStreak || 0) >= 7 },
  { id: 'streak_30',    icon: '🏅', name: '30 Hari Streak',  desc: 'Nabung sebulan penuh!',             check: () => (userData.bestStreak || 0) >= 30 },
  { id: 'first_target', icon: '💎', name: 'Target Pertama',  desc: 'Selesaikan 1 target tabungan',      check: () => savings.some(s => (s.currentAmount || 0) >= s.targetAmount) },
  { id: 'save_100k',    icon: '💰', name: '100K Collector',  desc: 'Kumpulkan Rp 100.000',              check: () => totalSaved() >= 100000 },
  { id: 'save_1m',      icon: '🤑', name: 'Millionaire',     desc: 'Kumpulkan Rp 1.000.000',           check: () => totalSaved() >= 1000000 },
  { id: 'save_10m',     icon: '🏆', name: 'Big Saver',       desc: 'Kumpulkan Rp 10.000.000',          check: () => totalSaved() >= 10000000 },
  { id: 'xp_100',       icon: '⭐', name: 'XP Hunter',       desc: 'Raih 100 XP',                      check: () => (userData.xp || 0) >= 100 },
  { id: 'xp_500',       icon: '🌟', name: 'XP Master',       desc: 'Raih 500 XP',                      check: () => (userData.xp || 0) >= 500 },
  { id: 'multi_target', icon: '🎯', name: 'Multi Target',    desc: 'Punya 3 tabungan aktif',            check: () => savings.length >= 3 },
  { id: 'sultan',       icon: '👑', name: 'Sultan',          desc: 'Raih 2000 XP',                     check: () => (userData.xp || 0) >= 2000 },
  { id: 'consistent',   icon: '📅', name: 'Konsisten',       desc: 'Nabung 10 kali total',              check: () => history.length >= 10 },
  { id: 'hundred_days', icon: '🎖️', name: '100 Hari',        desc: 'Nabung 100 kali total',             check: () => history.length >= 100 },
];

// ===== HELPERS =====
const totalSaved = () => savings.reduce((a, s) => a + (s.currentAmount || 0), 0);

const formatRp = (n) => 'Rp ' + Math.round(n || 0).toLocaleString('id-ID');
const formatRpShort = (n) => {
  if (n >= 1e9) return 'Rp ' + (n / 1e9).toFixed(1) + 'M';
  if (n >= 1e6) return 'Rp ' + (n / 1e6).toFixed(1) + 'jt';
  if (n >= 1e3) return 'Rp ' + (n / 1e3).toFixed(0) + 'k';
  return 'Rp ' + n;
};
const formatDate = (d) => {
  if (!d) return '-';
  try {
    return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return '-'; }
};
const formatDateShort = (d) => {
  if (!d) return '-';
  try { return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: '2-digit' }); }
  catch { return '-'; }
};
const hariLabel = (h) => ({ daily: 'Tiap hari', weekday: 'Sen–Jum', weekend: 'Weekend' })[h] || 'Tiap hari';

const getDaysLeft = (deadline) => Math.ceil((new Date(deadline) - new Date()) / 86400000);
const isDeadlineClose = (deadline) => deadline && getDaysLeft(deadline) <= 7;

function calcEstSelesai(s) {
  const remaining = Math.max(0, s.targetAmount - (s.currentAmount || 0));
  if (remaining <= 0) return '✅ Selesai!';
  const days = Math.ceil(remaining / s.perHari);
  const d = new Date(); d.setDate(d.getDate() + days);
  return formatDateShort(d.toISOString());
}

function getLevelInfo(xp) {
  let lv = LEVELS[0], next = LEVELS[1];
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].min) { lv = LEVELS[i]; next = LEVELS[i + 1] || LEVELS[i]; break; }
  }
  const pct = next !== lv ? Math.min(100, ((xp - lv.min) / (next.min - lv.min)) * 100) : 100;
  return { lv, next, pct };
}

// ===== AUTH =====
window.loginGoogle = async () => {
  const result = await loginWithGoogle();
  if (!result.success && result.error) {
    showToast('Login gagal: ' + result.error, 'error', '❌');
  }
};

window.logout = async () => {
  const result = await logoutUser();
  if (result.success) {
    document.getElementById('app').style.display = 'none';
    document.getElementById('authScreen').style.display = 'flex';
    document.getElementById('fab').classList.remove('show');
    savings = []; history = [];
  }
};

// Cek redirect result saat pertama load (fallback dari popup blocked)
checkRedirectResult().then(result => {
  if (result.success) console.log('Login via redirect:', result.user?.displayName);
});

// Observer: pantau perubahan status login
initAuthObserver(
  // onUserLogin
  async (user) => {
    currentUser = user;
    document.getElementById('authScreen').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    document.getElementById('fab').classList.add('show');
    await loadUserData();
    setupRealtimeListeners();
    checkResponsive();
    checkReminder();
  },
  // onUserLogout
  () => {
    currentUser = null;
  }
);

// ===== USER DATA =====
async function loadUserData() {
  const snap = await getDoc(doc(db, 'users', currentUser.uid));
  if (snap.exists()) userData = { ...userData, ...snap.data() };

  // Pakai getUserInfo dari auth.js
  const info = getUserInfo(currentUser);
  document.getElementById('sidebarName').textContent   = info.name;
  document.getElementById('settingsName').textContent  = info.name;
  document.getElementById('settingsEmail').textContent = info.email;

  const avatarEl = document.getElementById('sidebarAvatar');
  if (info.photoURL) {
    avatarEl.outerHTML = `<img src="${info.photoURL}" class="user-avatar" id="sidebarAvatar" alt="avatar" onerror="this.outerHTML='<div class=user-avatar-placeholder id=sidebarAvatar>${info.initial}</div>'">`;
  } else {
    avatarEl.textContent = info.initial;
  }
}

window.saveUserData = async () => {
  await setDoc(doc(db, 'users', currentUser.uid), userData, { merge: true });
};

// ===== REALTIME LISTENERS =====
function setupRealtimeListeners() {
  // Savings
  onSnapshot(query(collection(db, 'users', currentUser.uid, 'savings'), orderBy('createdAt', 'desc')), (snap) => {
    savings = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderSavings();
    renderDashboard();
  });

  // History
  onSnapshot(query(collection(db, 'users', currentUser.uid, 'history'), orderBy('timestamp', 'desc')), (snap) => {
    history = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderHistory();
    // Re-render stats if on stats page
    if (document.getElementById('page-statistik').classList.contains('active')) renderStats();
  });
}

// ===== RENDER SAVINGS =====
function renderSavings() {
  const container = document.getElementById('savingsList');
  if (!savings.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🏦</div>
        <h3>Belum ada tabungan</h3>
        <p>Yuk mulai tabungan pertama kamu!</p>
        <button class="btn btn-primary" onclick="openAddModal()">➕ Tambah Tabungan</button>
      </div>`;
    return;
  }
  const grid = document.createElement('div');
  grid.className = 'savings-grid';
  savings.forEach(s => grid.appendChild(buildSavingCard(s)));
  container.innerHTML = '';
  container.appendChild(grid);
}

function buildSavingCard(s) {
  const pct        = Math.min(100, ((s.currentAmount || 0) / s.targetAmount) * 100);
  const remaining  = Math.max(0, s.targetAmount - (s.currentAmount || 0));
  const deadlineBad = isDeadlineClose(s.deadline);
  const daysLeft   = s.deadline ? getDaysLeft(s.deadline) : null;
  const isDone     = pct >= 100;

  const card = document.createElement('div');
  card.className = 'saving-card';
  card.innerHTML = `
    <div class="saving-card-top">
      <div class="saving-emoji-wrap">${s.emoji || '💰'}</div>
      <div class="saving-badges">
        <span class="badge-pill ${s.prioritas === 'utama' ? 'utama' : 'sampingan'}">
          ${s.prioritas === 'utama' ? '⭐ Utama' : '📌 Sampingan'}
        </span>
        ${isDone ? '<span class="badge-pill done">✅ Selesai</span>' : ''}
        ${(s.streak || 0) >= 7 ? `<span class="badge-pill streak">🔥 ${s.streak}d</span>` : ''}
      </div>
    </div>
    <div class="saving-title">${s.title}</div>
    <div class="saving-amount-row">
      <span class="saving-current">${formatRp(s.currentAmount || 0)}</span>
      <span class="saving-sep">/</span>
      <span class="saving-target-val">${formatRp(s.targetAmount)}</span>
    </div>
    ${deadlineBad ? `<div class="deadline-warn" style="display:block">⚠️ Deadline ${daysLeft <= 0 ? 'sudah lewat!' : `${daysLeft} hari lagi!`}</div>` : ''}
    <div class="progress-wrap">
      <div class="progress-label-row">
        <span>Progress</span>
        <span>${pct.toFixed(1)}%</span>
      </div>
      <div class="progress-bar-track">
        <div class="progress-bar-fill ${isDone ? 'done' : ''}" style="width:${pct}%"></div>
      </div>
    </div>
    <div class="saving-info-grid">
      <div class="saving-info-item">
        <div class="saving-info-lbl">Sisa</div>
        <div class="saving-info-val">${formatRp(remaining)}</div>
      </div>
      <div class="saving-info-item">
        <div class="saving-info-lbl">Per hari</div>
        <div class="saving-info-val">${formatRp(s.perHari)}</div>
      </div>
      <div class="saving-info-item">
        <div class="saving-info-lbl">Jadwal</div>
        <div class="saving-info-val">${hariLabel(s.hariNabung)}</div>
      </div>
      <div class="saving-info-item">
        <div class="saving-info-lbl">Est. Selesai</div>
        <div class="saving-info-val">${calcEstSelesai(s)}</div>
      </div>
    </div>
    <div class="saving-actions">
      ${!isDone
        ? `<button class="btn btn-success" onclick="openNabung('${s.id}')">💸 Nabung</button>`
        : `<button class="btn btn-success" disabled>✅ Lunas!</button>`
      }
      <button class="btn btn-danger-outline" onclick="deleteSaving('${s.id}')">🗑️</button>
    </div>
  `;
  return card;
}

// ===== RENDER DASHBOARD =====
function renderDashboard() {
  // Stats
  document.getElementById('statTotal').textContent   = formatRp(totalSaved());
  document.getElementById('statTarget').textContent  = savings.length;
  document.getElementById('statStreak').textContent  = (userData.streak || 0) + ' hari';
  document.getElementById('statBadges').textContent  = (userData.badges || []).length;

  // Motivasi
  document.getElementById('motivasiText').textContent = MOTIVATIONS[new Date().getDay() % MOTIVATIONS.length];

  // Dashboard savings preview (max 4)
  const container = document.getElementById('dashboardSavings');
  if (!savings.length) {
    container.innerHTML = `<div class="empty-state" style="padding:30px 20px"><div class="empty-icon">🏦</div><h3>Belum ada tabungan</h3><p>Yuk tambah tabungan pertama kamu!</p></div>`;
  } else {
    const grid = document.createElement('div');
    grid.className = 'savings-grid';
    savings.slice(0, 4).forEach(s => grid.appendChild(buildSavingCard(s)));
    container.innerHTML = '';
    container.appendChild(grid);
  }

  updateLevelUI();
  checkBadges();
}

function updateLevelUI() {
  const { lv, next, pct } = getLevelInfo(userData.xp || 0);
  document.getElementById('levelEmoji').textContent    = lv.emoji;
  document.getElementById('levelTitle').textContent    = lv.title;
  document.getElementById('levelDesc').textContent     = lv.desc;
  document.getElementById('sidebarLevel').textContent  = lv.emoji + ' ' + lv.title;
  document.getElementById('xpFill').style.width        = pct + '%';
  document.getElementById('xpLabel').textContent       = `${userData.xp || 0} XP${next !== lv ? ' / ' + next.min + ' XP menuju ' + next.title : ' (MAX!)'}`;
}

// ===== ADD SAVING =====
window.openAddModal = () => {
  document.getElementById('inputMulai').value     = new Date().toISOString().split('T')[0];
  document.getElementById('inputJudul').value     = '';
  document.getElementById('inputTarget').value    = '';
  document.getElementById('inputPerHari').value   = '';
  document.getElementById('inputDeadline').value  = '';
  document.getElementById('inputKenaikan').value  = '';
  document.getElementById('calcPreview').classList.remove('show');
  openModal('addModal');
};

window.selectEmoji = (el) => {
  document.querySelectorAll('.emoji-opt').forEach(e => e.classList.remove('selected'));
  el.classList.add('selected');
  selectedEmoji = el.dataset.emoji;
};

window.calcPreview = () => {
  const target  = parseFloat(document.getElementById('inputTarget').value);
  const perHari = parseFloat(document.getElementById('inputPerHari').value);
  if (!target || !perHari || perHari <= 0) { document.getElementById('calcPreview').classList.remove('show'); return; }
  const hari     = Math.ceil(target / perHari);
  const selesai  = new Date(); selesai.setDate(selesai.getDate() + hari);
  const tahun    = Math.floor(hari / 365);
  const bulan    = Math.floor((hari % 365) / 30);
  const sHari    = hari % 30;
  let lamaStr    = '';
  if (tahun > 0) lamaStr += tahun + ' tahun ';
  if (bulan > 0) lamaStr += bulan + ' bulan ';
  if (sHari > 0 || !lamaStr) lamaStr += sHari + ' hari';
  document.getElementById('previewLama').textContent    = lamaStr.trim();
  document.getElementById('previewSelesai').textContent = selesai.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  document.getElementById('previewHari').textContent    = hari.toLocaleString('id-ID') + ' hari';
  document.getElementById('calcPreview').classList.add('show');
};

window.saveSaving = async () => {
  const title   = document.getElementById('inputJudul').value.trim();
  const target  = parseFloat(document.getElementById('inputTarget').value);
  const perHari = parseFloat(document.getElementById('inputPerHari').value);
  if (!title)   { showToast('Masukkan judul tabungan!', 'warning', '⚠️'); return; }
  if (!target || target <= 0)  { showToast('Masukkan target uang yang valid!', 'warning', '⚠️'); return; }
  if (!perHari || perHari <= 0){ showToast('Masukkan jumlah nabung per hari!', 'warning', '⚠️'); return; }

  const saving = {
    title, emoji: selectedEmoji,
    targetAmount: target, perHari,
    currentAmount: 0,
    mulai:       document.getElementById('inputMulai').value || new Date().toISOString().split('T')[0],
    deadline:    document.getElementById('inputDeadline').value || null,
    hariNabung:  document.getElementById('inputHariNabung').value,
    kenaikan:    parseFloat(document.getElementById('inputKenaikan').value) || 0,
    prioritas:   document.getElementById('inputPrioritas').value,
    streak: 0, lastSave: null,
    createdAt: serverTimestamp()
  };

  await addDoc(collection(db, 'users', currentUser.uid, 'savings'), saving);
  addXP(20);
  showToast('Tabungan berhasil dibuat! +20 XP ⭐', 'xp', '⭐');
  closeModal('addModal');
};

// ===== NABUNG =====
window.openNabung = (id) => {
  const s = savings.find(x => x.id === id);
  if (!s) return;
  currentSavingId = id;
  document.getElementById('nabungTitle').textContent      = s.emoji + ' ' + s.title;
  document.getElementById('nabungCurrent').textContent    = formatRp(s.currentAmount || 0);
  document.getElementById('nabungTargetShow').textContent = formatRp(s.targetAmount);
  document.getElementById('inputNabung').value            = s.perHari;
  document.getElementById('inputNabungNote').value        = '';
  openModal('nabungModal');
};

window.setQuick = (v) => { document.getElementById('inputNabung').value = v; };

window.doNabung = async () => {
  const amount = parseFloat(document.getElementById('inputNabung').value);
  if (!amount || amount <= 0) { showToast('Masukkan jumlah yang valid!', 'warning', '⚠️'); return; }
  const note = document.getElementById('inputNabungNote').value.trim();
  const s = savings.find(x => x.id === currentSavingId);
  if (!s) return;

  const newAmount = (s.currentAmount || 0) + amount;
  const today     = new Date().toDateString();
  let newStreak   = s.streak || 0;

  if (s.lastSave !== today) {
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    newStreak = s.lastSave === yesterday.toDateString() ? newStreak + 1 : 1;
  }

  await updateDoc(doc(db, 'users', currentUser.uid, 'savings', currentSavingId), {
    currentAmount: newAmount, lastSave: today, streak: newStreak
  });

  await addDoc(collection(db, 'users', currentUser.uid, 'history'), {
    savingId: currentSavingId, savingTitle: s.title, savingEmoji: s.emoji || '💰',
    amount, note, timestamp: serverTimestamp(), date: new Date().toISOString()
  });

  // Update user streak
  if (userData.lastSave !== today) {
    const yd = new Date(); yd.setDate(yd.getDate() - 1);
    userData.streak = userData.lastSave === yd.toDateString() ? (userData.streak || 0) + 1 : 1;
    if (userData.streak > (userData.bestStreak || 0)) userData.bestStreak = userData.streak;
    userData.lastSave = today;
  }

  addXP(10);
  await saveUserData();

  if (newAmount >= s.targetAmount) {
    showToast(`🎉 TARGET "${s.title}" TERCAPAI! +100 XP`, 'success', '🏆');
    addXP(100);
  } else {
    showToast(`+${formatRp(amount)} ke ${s.emoji} ${s.title}! +10 XP`, 'xp', '⭐');
  }
  closeModal('nabungModal');
};

// ===== DELETE =====
window.deleteSaving = (id) => {
  const s = savings.find(x => x.id === id);
  confirmCallback = async () => {
    await deleteDoc(doc(db, 'users', currentUser.uid, 'savings', id));
    showToast('Tabungan dihapus.', 'info', 'ℹ️');
  };
  document.getElementById('confirmTitle').textContent = 'Hapus Tabungan?';
  document.getElementById('confirmMsg').textContent   = `Hapus "${s?.title}"? Saldo yang sudah terkumpul juga akan hilang.`;
  openModal('confirmModal');
};

window.confirmReset = () => {
  confirmCallback = async () => {
    for (const s of savings) await deleteDoc(doc(db, 'users', currentUser.uid, 'savings', s.id));
    showToast('Semua tabungan direset!', 'info', 'ℹ️');
  };
  document.getElementById('confirmTitle').textContent = 'Reset Semua Data?';
  document.getElementById('confirmMsg').textContent   = 'Semua tabungan akan dihapus permanen. Yakin?';
  openModal('confirmModal');
};

window.confirmOk = async () => {
  closeModal('confirmModal');
  if (confirmCallback) { await confirmCallback(); confirmCallback = null; }
};

// ===== RENDER HISTORY =====
function renderHistory() {
  const el = document.getElementById('historyList');
  if (!history.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><h3>Belum ada riwayat</h3><p>Mulai nabung buat lihat history di sini!</p></div>`;
    return;
  }
  el.innerHTML = history.slice(0, 60).map(h => `
    <div class="history-item">
      <div class="history-icon-wrap">${h.savingEmoji || '💰'}</div>
      <div class="history-info">
        <div class="history-title">${h.savingTitle || 'Tabungan'}</div>
        <div class="history-meta">${h.note ? h.note + ' · ' : ''}${formatDate(h.date)}</div>
      </div>
      <div class="history-amount">+${formatRp(h.amount)}</div>
    </div>
  `).join('');
}

// ===== RENDER STATS =====
window.renderStats = () => {
  const totalAmount = history.reduce((a, h) => a + (h.amount || 0), 0);
  const totalDays   = history.length;
  document.getElementById('statRataRata').textContent  = totalDays ? formatRp(totalAmount / totalDays) : 'Rp 0';
  document.getElementById('statHariNabung').textContent = totalDays;
  document.getElementById('statBestStreak').textContent = (userData.bestStreak || 0) + ' hari';

  // Chart
  const { labels, data } = getLast30DaysData();
  if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
  const ctx = document.getElementById('savingsChart');
  if (ctx) {
    const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor  = isDarkMode ? '#7a9acc' : '#5a6f9a';
    const gridColor  = isDarkMode ? 'rgba(122,154,204,0.1)' : 'rgba(37,99,235,0.08)';
    chartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Nabung (Rp)',
          data,
          backgroundColor: data.map(v => v > 0 ? 'rgba(37,99,235,0.75)' : 'rgba(37,99,235,0.12)'),
          borderRadius: 7,
          borderSkipped: false,
          hoverBackgroundColor: 'rgba(37,99,235,0.9)',
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: { label: ctx => ' ' + formatRp(ctx.parsed.y) }
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 10, family: 'Plus Jakarta Sans' }, color: textColor } },
          y: { grid: { color: gridColor }, border: { display: false }, ticks: { font: { size: 10 }, color: textColor, callback: v => formatRpShort(v) } }
        }
      }
    });
  }

  // Per target progress
  const tl = document.getElementById('statsTargetList');
  if (tl) {
    if (!savings.length) { tl.innerHTML = '<p style="color:var(--text2);font-size:0.9rem;padding:8px 0">Belum ada tabungan.</p>'; return; }
    tl.innerHTML = savings.map(s => {
      const pct = Math.min(100, ((s.currentAmount || 0) / s.targetAmount) * 100);
      return `
        <div style="margin-bottom:18px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:7px">
            <span style="font-weight:700;display:flex;align-items:center;gap:8px">${s.emoji} ${s.title}</span>
            <span style="color:var(--blue);font-weight:800;font-family:'Outfit',sans-serif">${pct.toFixed(1)}%</span>
          </div>
          <div class="progress-bar-track">
            <div class="progress-bar-fill ${pct >= 100 ? 'done' : ''}" style="width:${pct}%"></div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:0.78rem;color:var(--text2);margin-top:5px">
            <span>${formatRp(s.currentAmount || 0)}</span>
            <span>${formatRp(s.targetAmount)}</span>
          </div>
        </div>`;
    }).join('');
  }
};

function getLast30DaysData() {
  const labels = [], data = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    labels.push(i % 5 === 0 ? d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }) : '');
    const dayTotal = history.filter(h => h.date && new Date(h.date).toDateString() === d.toDateString()).reduce((a, h) => a + (h.amount || 0), 0);
    data.push(dayTotal);
  }
  return { labels, data };
}

// ===== BADGES =====
window.renderBadges = () => {
  const earned = userData.badges || [];
  const grid   = document.getElementById('badgesGrid');
  const total  = ALL_BADGES.length;
  const count  = earned.length;

  grid.innerHTML = `
    <div style="grid-column:1/-1;margin-bottom:8px">
      <div style="display:flex;align-items:center;gap:10px;background:var(--blue-soft);border:1px solid var(--blue-light);border-radius:12px;padding:14px 18px">
        <span style="font-size:1.5rem">🏆</span>
        <div>
          <div style="font-weight:800;font-size:0.95rem">${count} / ${total} Badge Didapat</div>
          <div style="font-size:0.78rem;color:var(--text2);margin-top:2px">Terus nabung buat unlock semua badge!</div>
        </div>
      </div>
    </div>
    ` + ALL_BADGES.map(b => {
    const isEarned = earned.includes(b.id);
    return `
      <div class="badge-card ${isEarned ? 'earned' : 'locked'}">
        ${isEarned ? '<div class="badge-earned-mark">✓</div>' : ''}
        <div class="badge-icon">${b.icon}</div>
        <div class="badge-name">${b.name}</div>
        <div class="badge-desc">${b.desc}</div>
      </div>`;
  }).join('');
};

function checkBadges() {
  const earned   = userData.badges || [];
  let newEarned  = false;
  ALL_BADGES.forEach(b => {
    if (!earned.includes(b.id) && b.check()) {
      earned.push(b.id);
      showToast(`🏆 Badge baru: ${b.name} ${b.icon}! +50 XP`, 'success', '🏆');
      addXP(50);
      newEarned = true;
    }
  });
  if (newEarned) {
    userData.badges = earned;
    saveUserData();
    document.getElementById('statBadges').textContent = earned.length;
  }
}

// ===== XP =====
function addXP(amount) {
  userData.xp = (userData.xp || 0) + amount;
  saveUserData();
  updateLevelUI();
}

// ===== REMINDER =====
function checkReminder() {
  if (!notifEnabled || !savings.length) return;
  const today = new Date().toDateString();
  if (userData.lastSave !== today) {
    setTimeout(() => showToast('🔔 Hai! Jangan lupa nabung hari ini ya!', 'info', '🔔'), 2500);
  }
}

// ===== UI NAVIGATION =====
window.showPage = (page) => {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const pageEl = document.getElementById('page-' + page);
  if (pageEl) pageEl.classList.add('active');

  const titles = { dashboard: 'Dashboard', tabungan: 'Tabungan Saya', history: 'History', statistik: 'Statistik', badges: 'Badges 🏆', settings: 'Pengaturan' };
  document.getElementById('pageTitle').textContent = titles[page] || page;

  const navOrder = ['dashboard', 'tabungan', 'history', 'statistik', 'badges', 'settings'];
  const idx      = navOrder.indexOf(page);
  if (idx >= 0) document.querySelectorAll('.nav-item')[idx]?.classList.add('active');

  if (page === 'statistik') renderStats();
  if (page === 'badges')    renderBadges();

  if (window.innerWidth <= 900) document.getElementById('sidebar').classList.remove('open');
};

window.toggleSidebar = () => { document.getElementById('sidebar').classList.toggle('open'); };

window.toggleTheme = () => {
  isDark = !isDark;
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : '');
  document.getElementById('themeBtn').textContent   = isDark ? '☀️' : '🌙';
  document.getElementById('darkToggle').classList.toggle('on', isDark);
  // Re-render chart with new colors
  if (document.getElementById('page-statistik').classList.contains('active')) renderStats();
};

window.toggleNotif = () => {
  notifEnabled = !notifEnabled;
  document.getElementById('notifToggle').classList.toggle('on', notifEnabled);
  showToast(notifEnabled ? 'Notifikasi diaktifkan!' : 'Notifikasi dimatikan.', 'info', notifEnabled ? '🔔' : '🔕');
};

// ===== MODAL HELPERS =====
window.openModal  = (id) => document.getElementById(id).classList.add('open');
window.closeModal = (id) => document.getElementById(id).classList.remove('open');

// Click outside to close
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
  }
});

// ===== TOAST =====
const TOAST_ICONS = { success: '✅', info: 'ℹ️', warning: '⚠️', xp: '⭐', error: '❌' };
window.showToast = (msg, type = 'info', icon) => {
  const container = document.getElementById('toastContainer');
  const el        = document.createElement('div');
  el.className    = `toast ${type}`;
  el.innerHTML    = `
    <span class="toast-icon">${icon || TOAST_ICONS[type] || 'ℹ️'}</span>
    <span class="toast-msg">${msg}</span>
    <button class="toast-close" onclick="this.parentElement.remove()">✕</button>
  `;
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity   = '0';
    el.style.transform = 'translateX(60px)';
    setTimeout(() => el.remove(), 320);
  }, 3800);
};

// ===== RESPONSIVE =====
function checkResponsive() {
  const toggle = document.getElementById('menuToggle');
  if (toggle) toggle.style.display = window.innerWidth <= 900 ? 'flex' : 'none';
}
window.addEventListener('resize', checkResponsive);

console.log('%cTabunganKu 💰 loaded!', 'color:#2563eb;font-weight:800;font-size:14px');
