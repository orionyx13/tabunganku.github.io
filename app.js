// ==================== DATA & STATE ====================
let savings = []; // array of saving objects
let userStats = {
    totalTransactions: 0,
    maxStreak: 0,
    xp: 0,
    level: "Pemula"
};

let chartInstance = null;

// Konstanta untuk XP & level
const XP_PER_SAVE = 10;
const LEVELS = [
    { minXP: 0, name: "🥉 Pemula" },
    { minXP: 100, name: "🥈 Perintis" },
    { minXP: 300, name: "🥇 Pejuang" },
    { minXP: 600, name: "💎 Sultan Muda" },
    { minXP: 1000, name: "👑 Raja Nabung" }
];

// ==================== HELPER ====================
function formatRupiah(angka) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(angka);
}

function getCurrentDateStr() {
    return new Date().toISOString().slice(0, 10);
}

// Hitung apakah hari ini adalah hari nabung berdasarkan jadwal
function isSavingDay(scheduleType, date = new Date()) {
    const day = date.getDay(); // 0 Minggu - 6 Sabtu
    if (scheduleType === 'everyday') return true;
    if (scheduleType === 'weekday') return day >= 1 && day <= 5;
    if (scheduleType === 'weekend') return day === 0 || day === 6;
    return true;
}

// Hitung estimasi selesai (sederhana, tanpa kenaikan)
function estimateFinishDate(saving) {
    let totalNeeded = saving.targetAmount - saving.currentAmount;
    if (totalNeeded <= 0) return new Date();
    let daily = saving.dailyAmount;
    if (daily <= 0) return new Date(Date.now() + 365 * 86400000);
    
    let daysNeeded = Math.ceil(totalNeeded / daily);
    let start = new Date(saving.startDate);
    let current = new Date(start);
    let daysCounted = 0;
    let maxLoop = 3000;
    while (daysCounted < daysNeeded && maxLoop-- > 0) {
        if (isSavingDay(saving.scheduleType, current)) daysCounted++;
        current.setDate(current.getDate() + 1);
    }
    return current;
}

// Hitung estimasi waktu dalam hari & tahun
function getTimeEstimate(saving) {
    let finish = estimateFinishDate(saving);
    let today = new Date();
    let diffTime = finish - today;
    let diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return "Selesai!";
    let years = Math.floor(diffDays / 365);
    let days = diffDays % 365;
    return `${years} tahun ${days} hari`;
}

// Update level & XP
function updateLevelAndXP() {
    let foundLevel = LEVELS[0];
    for (let i = LEVELS.length - 1; i >= 0; i--) {
        if (userStats.xp >= LEVELS[i].minXP) {
            foundLevel = LEVELS[i];
            break;
        }
    }
    userStats.level = foundLevel.name;
    document.getElementById('userLevel').innerText = userStats.level;
    document.getElementById('userXP').innerText = userStats.xp;
    document.getElementById('maxStreak').innerText = userStats.maxStreak;
    document.getElementById('totalTransactions').innerText = userStats.totalTransactions;
}

// Tambah XP dan cek streak (sederhana: setiap nabung +xp, streak dilogic per hari)
function addXPAndStreak() {
    userStats.totalTransactions++;
    userStats.xp += XP_PER_SAVE;
    // streak sederhana: maxStreak hanya increment jika total nabung bertambah (simulasi)
    // lebih advance nanti
    if (userStats.totalTransactions > userStats.maxStreak) userStats.maxStreak = userStats.totalTransactions;
    updateLevelAndXP();
    saveToLocal();
}

// ==================== FUNGSI NABUNG (Tambah Saldo) ====================
function addMoney(savingId, amount) {
    const saving = savings.find(s => s.id === savingId);
    if (!saving) return;
    if (saving.currentAmount >= saving.targetAmount) {
        alert("Target sudah tercapai! Tidak bisa nabung lagi 🎉");
        return;
    }
    saving.currentAmount += amount;
    if (saving.currentAmount > saving.targetAmount) saving.currentAmount = saving.targetAmount;
    
    // Catat history sederhana di dalam objek (opsional)
    if (!saving.history) saving.history = [];
    saving.history.push({ date: getCurrentDateStr(), amount: amount });
    
    addXPAndStreak();
    renderAllSavings();
    updateChart();
    saveToLocal();
}

// ==================== CRUD TABUNGAN ====================
function createSaving(title, targetAmount, dailyAmount, startDate, scheduleType, monthlyIncrease = 0) {
    const newId = Date.now().toString();
    const newSaving = {
        id: newId,
        title: title.trim(),
        targetAmount: Number(targetAmount),
        currentAmount: 0,
        dailyAmount: Number(dailyAmount),
        startDate: startDate,
        scheduleType: scheduleType,
        monthlyIncrease: Number(monthlyIncrease),
        history: [],
        createdAt: new Date().toISOString()
    };
    savings.push(newSaving);
    renderAllSavings();
    updateChart();
    saveToLocal();
}

function deleteSaving(id) {
    savings = savings.filter(s => s.id !== id);
    renderAllSavings();
    updateChart();
    saveToLocal();
}

// Render semua tabungan ke dalam grid
function renderAllSavings() {
    const container = document.getElementById('savingsListContainer');
    if (!savings.length) {
        container.innerHTML = `<div class="empty-state"><i class="fas fa-coins"></i> Belum ada tabungan. Buat target pertama! 🚀</div>`;
        return;
    }
    
    container.innerHTML = savings.map(saving => {
        const progressPercent = (saving.currentAmount / saving.targetAmount) * 100;
        const remaining = saving.targetAmount - saving.currentAmount;
        const estimate = getTimeEstimate(saving);
        return `
            <div class="saving-card">
                <div class="saving-title">
                    ${escapeHtml(saving.title)}
                    <span class="tag">${saving.scheduleType === 'everyday' ? '📅 Setiap hari' : saving.scheduleType === 'weekday' ? '📆 Senin-Jumat' : '🎉 Weekend'}</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${progressPercent}%;"></div>
                </div>
                <div class="info-row"><span>💵 Terkumpul:</span> <strong>${formatRupiah(saving.currentAmount)}</strong> / ${formatRupiah(saving.targetAmount)}</div>
                <div class="info-row"><span>💰 Nabung per hari:</span> ${formatRupiah(saving.dailyAmount)}</div>
                <div class="info-row"><span>⏳ Estimasi selesai:</span> ${estimate}</div>
                <div class="info-row"><span>📅 Mulai:</span> ${saving.startDate}</div>
                ${saving.monthlyIncrease > 0 ? `<div class="info-row"><span>📈 Kenaikan bulanan:</span> +${saving.monthlyIncrease}%</div>` : ''}
                <div class="action-buttons">
                    <button class="btn-deposit" data-id="${saving.id}" data-amount="${saving.dailyAmount}"><i class="fas fa-hand-holding-usd"></i> Nabung (${formatRupiah(saving.dailyAmount)})</button>
                    <button class="btn-deposit-custom" data-id="${saving.id}"><i class="fas fa-plus-circle"></i> Isi Manual</button>
                    <button class="btn-delete" data-id="${saving.id}"><i class="fas fa-trash"></i> Hapus</button>
                </div>
            </div>
        `;
    }).join('');
    
    // Attach event listeners
    document.querySelectorAll('.btn-deposit').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = btn.dataset.id;
            const amount = parseInt(btn.dataset.amount);
            addMoney(id, amount);
        });
    });
    document.querySelectorAll('.btn-deposit-custom').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = btn.dataset.id;
            let customAmount = prompt("Masukkan nominal nabung (Rp):", "50000");
            if (customAmount && !isNaN(parseInt(customAmount))) {
                addMoney(id, parseInt(customAmount));
            } else alert("Nominal tidak valid");
        });
    });
    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (confirm("Hapus tabungan ini?")) deleteSaving(btn.dataset.id);
        });
    });
}

// simple escape html
function escapeHtml(str) {
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// ==================== GRAFIK ====================
function updateChart() {
    const ctx = document.getElementById('progressChart').getContext('2d');
    const labels = savings.map(s => s.title.length > 12 ? s.title.slice(0,10)+'..' : s.title);
    const dataPercent = savings.map(s => (s.currentAmount / s.targetAmount) * 100);
    
    if (chartInstance) chartInstance.destroy();
    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Persentase Tercapai (%)',
                data: dataPercent,
                backgroundColor: '#2b6e4f',
                borderRadius: 12,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                y: { max: 100, title: { display: true, text: 'Progress (%)' } }
            }
        }
    });
}

// ==================== LOCALSTORAGE ====================
function saveToLocal() {
    const dataToStore = {
        savings: savings,
        userStats: userStats
    };
    localStorage.setItem('piggyMateData', JSON.stringify(dataToStore));
}

function loadFromLocal() {
    const stored = localStorage.getItem('piggyMateData');
    if (stored) {
        try {
            const parsed = JSON.parse(stored);
            savings = parsed.savings || [];
            if (parsed.userStats) userStats = parsed.userStats;
            updateLevelAndXP();
            renderAllSavings();
            updateChart();
        } catch(e) { console.warn(e); }
    } else {
        // Demo data
        const today = getCurrentDateStr();
        createSaving("HP Impian", 5000000, 50000, today, "everyday", 0);
        createSaving("Liburan ke Bali", 3000000, 75000, today, "weekday", 5);
    }
}

// Reset demo data
function resetAllData() {
    if (confirm("⚠️ Reset akan menghapus SEMUA tabungan dan progres. Lanjutkan?")) {
        localStorage.removeItem('piggyMateData');
        savings = [];
        userStats = { totalTransactions: 0, maxStreak: 0, xp: 0, level: "Pemula" };
        updateLevelAndXP();
        renderAllSavings();
        updateChart();
        saveToLocal();
        // buat demo fresh
        const today = getCurrentDateStr();
        createSaving("HP Impian", 5000000, 50000, today, "everyday", 0);
        createSaving("Liburan ke Bali", 3000000, 75000, today, "weekday", 5);
    }
}

// ==================== DARK MODE ====================
function initDarkMode() {
    const isDark = localStorage.getItem('darkMode') === 'true';
    if (isDark) document.body.classList.add('dark-mode');
    const btn = document.getElementById('darkModeBtn');
    const themeSpan = document.getElementById('themeText');
    btn.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const nowDark = document.body.classList.contains('dark-mode');
        localStorage.setItem('darkMode', nowDark);
        themeSpan.innerText = nowDark ? "Mode Terang" : "Mode Gelap";
        btn.innerHTML = nowDark ? '<i class="fas fa-sun"></i> Mode Terang' : '<i class="fas fa-moon"></i> Mode Gelap';
    });
    themeSpan.innerText = isDark ? "Mode Terang" : "Mode Gelap";
    btn.innerHTML = isDark ? '<i class="fas fa-sun"></i> Mode Terang' : '<i class="fas fa-moon"></i> Mode Gelap';
}

// ==================== INITIALIZE ====================
document.addEventListener('DOMContentLoaded', () => {
    loadFromLocal();
    initDarkMode();
    
    document.getElementById('createSavingBtn').addEventListener('click', () => {
        const title = document.getElementById('savingTitle').value;
        const target = document.getElementById('targetAmount').value;
        const daily = document.getElementById('dailyAmount').value;
        const start = document.getElementById('startDate').value;
        const schedule = document.getElementById('scheduleType').value;
        const monthlyInc = document.getElementById('monthlyIncrease').value;
        
        if (!title || !target || !daily || !start) {
            alert("Harap isi semua field (judul, target, nabung per hari, tanggal mulai)");
            return;
        }
        createSaving(title, target, daily, start, schedule, monthlyInc);
        // reset form sedikit
        document.getElementById('savingTitle').value = '';
        document.getElementById('targetAmount').value = '';
        document.getElementById('dailyAmount').value = '';
    });
    
    document.getElementById('resetDemoBtn').addEventListener('click', resetAllData);
});
