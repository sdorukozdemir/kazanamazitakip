const jsConfetti = new JSConfetti();
let currentChartPeriod = 'weekly'; 
let activeRowIndex = 0; 

function triggerHaptic() { if (navigator.vibrate) navigator.vibrate(10); }

function hideLoader() {
    const loader = document.getElementById('loading-overlay');
    if (loader) { 
        loader.style.opacity = '0'; 
        setTimeout(() => { loader.style.visibility = 'hidden'; }, 500); 
    }
}

setTimeout(() => { hideLoader(); }, 5000); 

/* 
   NOT: Harici manifest.json dosyası oluşturduğumuz için 
   buradaki dinamik manifest oluşturma koduna artık gerek kalmadı.
   Tarayıcı direkt manifest.json dosyasını okuyacak.
*/

const firebaseConfig = {
    apiKey: "AIzaSyC7zdr3x8H--8piHR_1muAz2TVOOaebI54",
    authDomain: "kazanamazi-ser.firebaseapp.com",
    databaseURL: "https://kazanamazi-ser-default-rtdb.firebaseio.com",
    projectId: "kazanamazi-ser",
    storageBucket: "kazanamazi-ser.firebasestorage.app",
    messagingSenderId: "951730390034",
    appId: "1:951730390034:web:639f96ee859c10b0e944cb",
    measurementId: "G-5WGCDTL1RX"
};
const app = firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth();
const provider = new firebase.auth.GoogleAuthProvider();
let dbRef = null;

function getCurrentDateSimple() { const d = new Date(); return d.toLocaleDateString('tr-TR'); }
function getIsoDate(date) { 
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}
function formatDateTR(isoDate) {
    if(!isoDate) return "";
    if(isoDate.includes('.') && isoDate.split('.')[0].length <= 2) return isoDate; 
    const parts = isoDate.split('-');
    if(parts.length !== 3) return isoDate;
    const [y, m, d] = parts;
    return `${d}.${m}.${y}`;
}

const defaultData = {
    startDate: new Date().toISOString().split('T')[0],
    gender: null, 
    menstrualDaysPerMonth: 6,
    isMenstrualState: false, 
    daily: { date: getCurrentDateSimple(), counts: [0,0,0,0,0], target: 10 },
    weeklyTarget: 50,
    streak: { current: 0, lastAchievedDate: "" },
    calendar: {}, logs: {},
    counts: [{name:"Sabah",target:0,done:0},{name:"Öğle",target:0,done:0},{name:"İkindi",target:0,done:0},{name:"Akşam",target:0,done:0},{name:"Yatsı",target:0,done:0}],
    tesbihat: [
        { name: "Sübhanallah", arabic: "سُبْحَانَ ٱللَّٰهِ", current: 0, target: 33 },
        { name: "Elhamdülillah", arabic: "ٱلْحَمْدُ لِلَّٰهِ", current: 0, target: 33 },
        { name: "Allahu Ekber", arabic: "ٱللَّٰهُ أَكْبَرُ", current: 0, target: 33 },
        { name: "La ilahe İllallah", arabic: "لَا إِلَٰهَ إِلَّا ٱللَّٰهُ", current: 0, target: 100 }
    ],
    earnedBadges: [], history: []
};

let localData = JSON.parse(JSON.stringify(defaultData));
const saved = localStorage.getItem('offlineBackup');

if(saved) {
    localData = JSON.parse(saved);
    document.addEventListener('DOMContentLoaded', () => {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('app-wrapper').style.display = 'flex';
        if (localData.gender) applyGenderSettings();
        renderCalculatorRows();
        renderApp();
        renderStats();
        hideLoader();
    });
}

let chartCompletion = null, barChart = null, lineChart = null;

auth.onAuthStateChanged((user) => {
    if (user) {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('app-wrapper').style.display = 'flex';
        document.getElementById('sidebarUserInfo').innerText = user.displayName;
        
        dbRef = db.ref('users/' + user.uid + '/namazData');
        dbRef.on('value', (s) => {
            const d = s.val();
            if (d) {
                localData = d;
                localStorage.setItem('offlineBackup', JSON.stringify(localData));
            } else {
                if(!saved) {
                    localData = JSON.parse(JSON.stringify(defaultData));
                }
            }
            
            ensureDataStructure(); 
            checkDailyReset();
            
            if (!d && !saved) saveToCloud();
            
            if (!localData.gender) {
                if(document.getElementById('gender-selection-modal').style.display === 'none') openGenderModal(false);
            } else {
                applyGenderSettings();
            }

            try {
                renderCalculatorRows();
                renderApp();
                renderStats();
            } catch(e) {
                console.error("Render hatası:", e);
            }
            hideLoader();
        });
    } else { 
        if(!saved) { 
            document.getElementById('loading-overlay').style.display = 'none';
            document.getElementById('login-screen').style.display = 'flex'; 
            document.getElementById('app-wrapper').style.display = 'none'; 
            localData = JSON.parse(JSON.stringify(defaultData)); 
        }
    }
});

function loginWithGoogle() { auth.signInWithPopup(provider).catch(e => showModal("Hata", e.message)); }
function logout() { 
    auth.signOut().then(() => {
        localStorage.removeItem('offlineBackup');
        window.location.reload(); 
    });
}

function saveToCloud() { 
    if(dbRef) dbRef.set(localData); 
    localStorage.setItem('offlineBackup', JSON.stringify(localData));
}

function ensureDataStructure() {
    if (!localData.counts) localData.counts = JSON.parse(JSON.stringify(defaultData.counts));
    if (!localData.tesbihat) localData.tesbihat = JSON.parse(JSON.stringify(defaultData.tesbihat));
    if (!localData.calendar) localData.calendar = {};
    if (!localData.logs) localData.logs = {}; 
    if (localData.weeklyTarget === undefined) localData.weeklyTarget = 50;
    if (localData.menstrualDaysPerMonth === undefined) localData.menstrualDaysPerMonth = 6;
    if (localData.isMenstrualState === undefined) localData.isMenstrualState = false;
    
    const t = new Date().toLocaleDateString('tr-TR');
    if (!localData.daily || localData.daily.date !== t) { 
        localData.daily = { date: t, counts: [0,0,0,0,0], target: localData.daily?.target || 10 }; 
        saveToCloud(); 
    }
    if (!localData.streak) localData.streak = { current: 0, lastAchievedDate: "" };
    if (!localData.history) localData.history = [];
    if (!localData.earnedBadges) localData.earnedBadges = [];
    if (!localData.startDate) localData.startDate = new Date().toISOString().split('T')[0];
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `custom-toast toast-${type}`;
    const icon = type === 'success' ? '<i class="fas fa-check-circle"></i>' : (type === 'warning' ? '<i class="fas fa-wifi"></i>' : '<i class="fas fa-exclamation-circle"></i>');
    toast.innerHTML = `${icon}<span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'toastFadeOut 0.4s forwards';
        setTimeout(() => {
            if(toast.parentElement) toast.parentElement.removeChild(toast);
        }, 400);
    }, 3000);
}

function openGenderModal(force) { document.getElementById('gender-selection-modal').style.display = 'flex'; }
function selectGender(g) { localData.gender = g; if (g === 'male') { localData.isMenstrualState = false; localData.menstrualDaysPerMonth = 0; } else { if(!localData.menstrualDaysPerMonth) localData.menstrualDaysPerMonth = 6; } saveToCloud(); document.getElementById('gender-selection-modal').style.display = 'none'; applyGenderSettings(); renderCalculatorRows(); renderApp(); }

function applyGenderSettings() {
    const toggleArea = document.getElementById('menstrualToggleArea');
    const calcInfo = document.getElementById('femaleCalcInfo');
    const genderText = document.getElementById('currentGenderDisplay');
    const userInfoBox = document.getElementById('sidebarUserInfoBox');
    const settingsCard = document.getElementById('genderSettingsCard');
    
    document.querySelectorAll('.gender-option').forEach(el => el.classList.remove('selected'));
    if(settingsCard) settingsCard.classList.remove('settings-gender-male', 'settings-gender-female');
    if(userInfoBox) userInfoBox.classList.remove('user-info-male', 'user-info-female');

    if (localData.gender === 'female') {
        toggleArea.style.display = 'flex';
        calcInfo.style.display = 'block';
        genderText.innerText = "Kadın";
        document.getElementById('menstrualSwitch').checked = localData.isMenstrualState;
        document.getElementById('menstrualDaysInput').value = localData.menstrualDaysPerMonth;
        if(userInfoBox) userInfoBox.classList.add('user-info-female');
        if(settingsCard) settingsCard.classList.add('settings-gender-female');
        document.getElementById('genderOptFemale').classList.add('selected');
    } else {
        toggleArea.style.display = 'none';
        calcInfo.style.display = 'none';
        genderText.innerText = "Erkek";
        if(userInfoBox) userInfoBox.classList.add('user-info-male');
        if(settingsCard) settingsCard.classList.add('settings-gender-male');
        document.getElementById('genderOptMale').classList.add('selected');
    }
}

function toggleMenstrualState(isChecked) { localData.isMenstrualState = isChecked; saveToCloud(); renderApp(); }
window.updateMenstrualDays = function(val) { localData.menstrualDaysPerMonth = parseInt(val) || 0; saveToCloud(); for(let i=0; i<5; i++) { window.calcRow(i); } }

window.showSection = function(id) {
    if(!id) id = 'dashboard';
    document.querySelectorAll('#sidebar ul li').forEach(li => li.classList.remove('active'));
    const menuItem = document.getElementById('menu-' + id);
    if(menuItem) menuItem.classList.add('active');
    const sections = ['dashboard', 'stats', 'tesbihat', 'calculator', 'settings'];
    sections.forEach(sec => { const el = document.getElementById('section-' + sec); if(el) el.style.display = 'none'; });
    const activeSec = document.getElementById('section-' + id);
    if(activeSec) activeSec.style.display = 'block';
    if(window.innerWidth < 768) { document.getElementById('sidebar').classList.remove('active'); document.getElementById('overlay').classList.remove('active'); }
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const navMap = { 'dashboard': 0, 'stats': 1, 'tesbihat': 2, 'calculator': 3 };
    if (navMap[id] !== undefined) document.querySelectorAll('.nav-item')[navMap[id]].classList.add('active');
    try { if(id === 'dashboard') renderApp(); if(id === 'stats') renderStats(); if(id === 'tesbihat') renderTesbihat(); if(id === 'calculator') renderCalculatorRows(); } catch(e) { console.log("Render error:", e); }
};

function toggleSidebar() { triggerHaptic(); document.getElementById('sidebar').classList.toggle('active'); document.getElementById('overlay').classList.toggle('active'); }
function activateNav(element) { triggerHaptic(); document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active')); if(element) element.classList.add('active'); }

function renderApp() {
    if(!localData.counts) return;
    const todayISO = getIsoDate(new Date());
    const todayTotal = localData.daily.counts.reduce((a, b) => a + b, 0);
    if (localData.logs[todayISO] !== todayTotal) {
        localData.logs[todayISO] = todayTotal;
        if(dbRef) dbRef.child('logs').update({ [todayISO]: todayTotal });
    }
    recalculateStreak();
    
    const dateInput = document.getElementById('startDate');
    if(dateInput.type !== 'date') { dateInput.value = formatDateTR(localData.startDate); } else { dateInput.value = localData.startDate; }
    
    const isPaused = localData.gender === 'female' && localData.isMenstrualState;
    const pausedBadge = document.getElementById('pausedBadge');
    const goalCard = document.getElementById('goalCard');
    const weeklyCard = document.getElementById('weeklyCard');
    const splitContainer = document.getElementById('prayerSplitContainer');

    if (isPaused) { pausedBadge.style.display = 'block'; goalCard.classList.add('paused-mode-overlay'); weeklyCard.classList.add('paused-mode-overlay'); splitContainer.classList.add('paused-mode-overlay'); } else { pausedBadge.style.display = 'none'; goalCard.classList.remove('paused-mode-overlay'); weeklyCard.classList.remove('paused-mode-overlay'); splitContainer.classList.remove('paused-mode-overlay'); }

    document.getElementById('dailyCountDisplay').innerText = todayTotal;
    document.getElementById('dailyGoalInput').value = localData.daily.target;
    let p = (todayTotal / localData.daily.target) * 100; if(p>100) p=100;
    document.getElementById('dailyProgressBar').style.width = p + "%";
    if(todayTotal >= localData.daily.target) { document.getElementById('goalCard').classList.add('success-mode'); document.getElementById('goalSuccessMessage').style.display='block'; } else { document.getElementById('goalCard').classList.remove('success-mode'); document.getElementById('goalSuccessMessage').style.display='none'; }
    document.getElementById('streakValue').innerText = localData.streak.current;

    const weeklyTotal = getWeeklyProgress();
    const weeklyTarget = localData.weeklyTarget || 50;
    document.getElementById('weeklyCountDisplay').innerText = weeklyTotal;
    document.getElementById('weeklyGoalInput').value = weeklyTarget;
    let wp = (weeklyTotal / weeklyTarget) * 100; if (wp > 100) wp = 100;
    document.getElementById('weeklyProgressBar').style.width = wp + "%";
    const wCard = document.getElementById('weeklyCard'); const wMsg = document.getElementById('weeklySuccessMessage');
    if (weeklyTotal >= weeklyTarget) { wCard.classList.add('success-mode'); wMsg.style.display = 'block'; } else { wCard.classList.remove('success-mode'); wMsg.style.display = 'none'; }

    
    if(document.getElementById('prayerDetailCard')) {
        updateCardUI(activeRowIndex);
    } else {
        splitContainer.innerHTML = ""; 
        let menuHTML = `<div class="prayer-side-menu">`;
        const iconList = ["fa-cloud-sun", "fa-sun", "fa-cloud-sun", "fa-moon", "fa-star"]; 
        const themeList = ["theme-sabah", "theme-ogle", "theme-ikindi", "theme-aksam", "theme-yatsi"];
        
        localData.counts.forEach((item, i) => {
            const isActive = (i === activeRowIndex) ? 'active' : '';
            const flipClass = (i === 2) ? 'flip-icon' : ''; 
            
            menuHTML += `
            <div id="menuItem${i}" class="side-menu-item ${isActive} ${themeList[i]}" onclick="setActivePrayer(${i})">
                <i class="fas ${iconList[i]} side-menu-icon ${flipClass}"></i>
                <div class="side-menu-label">${item.name}</div>
            </div>`;
        });
        menuHTML += `</div>`;
        
        let cardHTML = `
        <div id="prayerDetailCard" class="prayer-detail-card">
            <div class="pd-content">
                <div class="pd-header">
                    <div class="pd-title"><i id="pdTitleIcon" class="fas"></i> <span id="pdTitleText"></span></div>
                    <div id="pdRemainingBadge" class="pd-remaining-badge"></div>
                </div>
                
                <div class="pd-stats-row">
                    <div class="pd-input-group">
                        <span class="pd-label">KILINACAK</span>
                        <input type="number" id="pdInputTarget" class="pd-input">
                    </div>
                    <div class="pd-input-group">
                        <span class="pd-label text-success">KILINAN</span>
                        <input type="number" id="pdInputDone" class="pd-input text-success">
                    </div>
                </div>
                
                <div class="pd-progress-container">
                    <div class="pd-progress-track">
                        <div id="pdProgressFill" class="pd-progress-fill"></div>
                    </div>
                    <div id="pdProgressText" class="pd-progress-text"></div>
                </div>

                <div class="pd-actions">
                    <button id="btnMinus" class="pd-btn pd-btn-minus"><i class="fas fa-minus"></i></button>
                    <button id="btnPlus" class="pd-btn pd-btn-plus"><i class="fas fa-plus"></i></button>
                </div>
            </div>
        </div>`;
        
        splitContainer.innerHTML = menuHTML + cardHTML;
        document.getElementById('pdInputTarget').onchange = (e) => window.upT(activeRowIndex, e.target.value);
        document.getElementById('pdInputDone').onchange = (e) => window.upD(activeRowIndex, e.target.value);
        document.getElementById('btnMinus').onclick = () => window.chC(activeRowIndex, -1);
        document.getElementById('btnPlus').onclick = () => window.chC(activeRowIndex, 1);
        updateCardUI(activeRowIndex);
    }
    
    let tt=0, td=0; 
    localData.counts.forEach(c => { tt += parseInt(c.target); td += parseInt(c.done); });
    const days = getElapsedDays(); 
    document.getElementById('elapsedDays').value = days; 
    
    document.getElementById('sumTarget').innerText = tt;
    document.getElementById('sumDone').innerText = td;
    document.getElementById('sumRemaining').innerText = tt - td;

    renderBadges(td); calculateEstFinish(td, days); 
}

function updateCardUI(index) {
    const item = localData.counts[index];
    const remaining = Math.max(0, item.target - item.done);
    const percent = item.target > 0 ? (item.done / item.target) * 100 : 0;
    const bgList = ["bg-sabah", "bg-ogle", "bg-ikindi", "bg-aksam", "bg-yatsi"];
    const iconList = ["fa-cloud-sun", "fa-sun", "fa-cloud-sun", "fa-moon", "fa-star"];

    const card = document.getElementById('prayerDetailCard');
    if(card) card.className = `prayer-detail-card ${bgList[index]}`;

    const iconEl = document.getElementById('pdTitleIcon');
    if(iconEl) {
        iconEl.className = `fas ${iconList[index]}`;
        if(index === 2) iconEl.classList.add('flip-icon');
        else iconEl.classList.remove('flip-icon');
    }
    
    const titleText = document.getElementById('pdTitleText');
    if(titleText) titleText.innerText = item.name;
    
    const badge = document.getElementById('pdRemainingBadge');
    if(badge) badge.innerText = `Kalan: ${remaining}`;

    const inpTarget = document.getElementById('pdInputTarget');
    if(inpTarget) inpTarget.value = item.target;
    
    const inpDone = document.getElementById('pdInputDone');
    if(inpDone) inpDone.value = item.done;

    const progFill = document.getElementById('pdProgressFill');
    if(progFill) progFill.style.width = `${percent}%`;
    
    const progText = document.getElementById('pdProgressText');
    if(progText) progText.innerText = `%${percent.toFixed(1)} Tamamlandı`;

    document.querySelectorAll('.side-menu-item').forEach((el, i) => {
        if(i === index) el.classList.add('active');
        else el.classList.remove('active');
    });

    if(inpTarget) inpTarget.onchange = (e) => window.upT(index, e.target.value);
    if(inpDone) inpDone.onchange = (e) => window.upD(index, e.target.value);
    
    const btnMinus = document.getElementById('btnMinus');
    if(btnMinus) btnMinus.onclick = () => window.chC(index, -1);
    
    const btnPlus = document.getElementById('btnPlus');
    if(btnPlus) btnPlus.onclick = () => window.chC(index, 1);
}

window.setActivePrayer = function(index) {
    activeRowIndex = index;
    triggerHaptic();
    updateCardUI(index); 
    setTimeout(() => {
        const activeEl = document.getElementById(`menuItem${index}`);
        if(activeEl) activeEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }, 100);
}

window.renderCalculatorRows = function() { const c = document.getElementById('calcRowsContainer'); if(!c || c.innerHTML.trim()) return; const prayerTypes = ["Sabah", "Öğle", "İkindi", "Akşam", "Yatsı"]; prayerTypes.forEach((p, i) => { c.innerHTML += `<div class="calc-row" id="row-${i}"><div class="calc-header">${p}</div><div class="calc-body"><div class="calc-item"><div class="calc-group-box"><span class="calc-label-small">Sorumluluk Başlangıcı</span><input type="text" class="form-control date-input" placeholder="gg.aa.yyyy" onfocus="(this.type='date')" onblur="(this.type='text'); this.value = formatDateTR(this.value);" onchange="window.calcRow(${i})"></div></div><div class="calc-item"><div class="calc-group-box"><span class="calc-label-small">Düzenli Başlama Tarihi</span><input type="text" class="form-control date-input" placeholder="gg.aa.yyyy" onfocus="(this.type='date')" onblur="(this.type='text'); this.value = formatDateTR(this.value);" onchange="window.calcRow(${i})"></div></div><div class="calc-item"><div class="calc-group-box" style="justify-content:center;"><span class="calc-label-small">Hesaplanan Gün</span><input type="number" class="form-control calc-result-input" id="res-${i}" value="0"></div></div></div></div>`; }); };
window.calcRow = function(i) { const r = document.getElementById(`row-${i}`); const inputs = r.querySelectorAll('input'); let s = inputs[0].value; let e = inputs[1].value; function parseDateTR(val) { if(!val) return null; if(val.includes('.') && val.split('.').length === 3) { const parts = val.split('.'); return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`); } return new Date(val); } if(s && e) { const startDate = parseDateTR(s); const endDate = parseDateTR(e); if(startDate && endDate && !isNaN(startDate) && !isNaN(endDate)) { let totalDays = Math.ceil((endDate - startDate)/(86400000)); if(localData.gender === 'female') { const totalMonths = totalDays / 30.44; const menstrualDeduction = Math.floor(totalMonths * (localData.menstrualDaysPerMonth || 6)); totalDays = totalDays - menstrualDeduction; } document.getElementById(`res-${i}`).value = Math.max(0, totalDays); } } };

window.upT = function(i, v) { localData.counts[i].target = parseInt(v) || 0; saveToCloud(); renderApp(); };
window.upD = function(i, v) { 
    const val = parseInt(v) || 0;
    const item = localData.counts[i];
    if (val > item.target) {
        showModal("Uyarı", `${item.name} namazı için girilen sayı hedeften büyük olamaz.`);
        document.getElementById('pdInputDone').value = item.done; 
        return;
    }
    if (item.done !== val) { 
        const o = item.done;
        item.done = val; 
        addHistory(item.name, o, val); 
        saveToCloud(); 
        renderApp(); 
    } 
};

window.chC = function(i, d) { 
    triggerHaptic(); 
    const item = localData.counts[i];
    const remaining = Math.max(0, item.target - item.done);

    if (d > 0 && remaining <= 0) {
        showModal("Bilgi", `${item.name} namazı için kaza borcunuz bulunmamaktadır.`);
        return;
    }

    const o = item.done; 
    const n = o + d; 
    
    if (n >= 0) { 
        item.done = n; 
        if (d > 0) { 
            localData.daily.counts[i]++; 
            const todayISO = getIsoDate(new Date()); 
            localData.logs[todayISO] = (localData.logs[todayISO] || 0) + 1; 
            const ct = localData.daily.counts.reduce((a, b) => a + b, 0); 
            if (ct >= localData.daily.target) { 
                localData.calendar[todayISO] = true; 
                if (ct === localData.daily.target) jsConfetti.addConfetti(); 
            } else { 
                delete localData.calendar[todayISO]; 
            } 
            
            const wTotal = getWeeklyProgress();
            const wTarget = localData.weeklyTarget || 50;
            if(wTotal === wTarget) {
                jsConfetti.addConfetti({
                    emojis: ['🌙', '⭐'],
                    emojiSize: 35,
                    confettiNumber: 60
                });
                showToast("Haftalık Hedef Tamamlandı! 🏆", "success");
            }

            let totalDebt = 0;
            localData.counts.forEach(c => totalDebt += Math.max(0, c.target - c.done));
            if(totalDebt <= 0) {
                    showModal("Tebrikler!", "Kaza namaz borcunuz bulunmamaktadır. Allah kabul etsin!");
            }

            recalculateStreak(); 
        } else if (localData.daily.counts[i] > 0) { 
            localData.daily.counts[i]--; 
            const todayISO = getIsoDate(new Date()); 
            if(localData.logs && localData.logs[todayISO] > 0) localData.logs[todayISO]--; 
            const ct = localData.daily.counts.reduce((a, b) => a + b, 0); 
            if (ct < localData.daily.target) { delete localData.calendar[todayISO]; } 
            recalculateStreak(); 
        } 
        addHistory(localData.counts[i].name, o, n); 
        saveToCloud(); 
        renderApp(); 
    } 
};

function recalculateStreak() { let currentStreak = 0; const today = new Date(); const isoToday = getIsoDate(today); if (localData.calendar && localData.calendar[isoToday]) { currentStreak++; } for (let i = 1; i < 1000; i++) { const d = new Date(); d.setDate(today.getDate() - i); const iso = getIsoDate(d); if (localData.calendar && localData.calendar[iso]) { currentStreak++; } else { if (i === 1 && currentStreak === 0) {} else { break; } } } localData.streak.current = currentStreak; }

window.updateDailyGoal = function(v) { 
    let totalDebt = 0;
    localData.counts.forEach(c => totalDebt += Math.max(0, c.target - c.done));
    
    if(totalDebt <= 0) {
        showModal("Bilgi", "Kaza namaz borcunuz bulunmamaktadır.");
        document.getElementById('dailyGoalInput').value = localData.daily.target;
        return;
    }
    localData.daily.target = parseInt(v)||10; 
    saveToCloud(); 
    renderApp(); 
};

window.updateWeeklyGoal = function(v) { 
    let totalDebt = 0;
    localData.counts.forEach(c => totalDebt += Math.max(0, c.target - c.done));
    
    if(totalDebt <= 0) {
        showModal("Bilgi", "Kaza namaz borcunuz bulunmamaktadır.");
        document.getElementById('weeklyGoalInput').value = localData.weeklyTarget;
        return;
    }
    localData.weeklyTarget = parseInt(v)||50; 
    saveToCloud(); 
    renderApp(); 
};

function getWeeklyProgress() { if (!localData.logs) return 0; const today = new Date(); const day = today.getDay(); const diff = today.getDate() - day + (day == 0 ? -6 : 1); const monday = new Date(today.setDate(diff)); monday.setHours(0,0,0,0); let weeklyTotal = 0; Object.keys(localData.logs).forEach(dateKey => { const logDate = new Date(dateKey); if (logDate >= monday) { weeklyTotal += localData.logs[dateKey]; } }); return weeklyTotal; }

function renderTesbihat() { const c = document.getElementById('tesbihatContainer'); c.innerHTML = ""; if (!localData.tesbihat) localData.tesbihat = JSON.parse(JSON.stringify(defaultData.tesbihat)); localData.tesbihat.forEach((item, i) => { let p = item.target > 0 ? (item.current / item.target) * 100 : 0; c.innerHTML += `<div class="col-md-6"><div class="zikr-card"><h5>${item.name}</h5><div class="arabic-text">${item.arabic}</div><div class="zikr-count">${item.current}</div><div class="progress mb-3" style="height: 8px;"><div class="progress-bar bg-success" style="width: ${p}%"></div></div><div class="zikr-btn-group"><button class="zikr-btn z-minus" onclick="window.upTes(${i},-1)"><i class="fas fa-minus"></i></button><button class="zikr-btn z-plus" onclick="window.upTes(${i},1)"><i class="fas fa-plus"></i></button><button class="zikr-btn z-reset" onclick="window.resTes(${i})"><i class="fas fa-undo"></i></button></div><div class="tesbihat-target-box"><span class="tesbihat-target-label">HEDEF</span><input type="number" class="tesbihat-target-input" value="${item.target}" onchange="window.setTesTarget(${i}, this.value)"></div><div class="manual-zikr-container"><input type="number" id="manZ-${i}" class="manual-zikr-input-clean" placeholder="+Adet"><button class="btn-add-clean" onclick="window.addTes(${i})">EKLE</button></div></div></div>`; }); }
function formatTime(d) { if (!isFinite(d) || d <= 0) return "Tamamlandı"; const y = Math.floor(d/365); const r = d % 365; const m = Math.floor(r/30); const fd = Math.floor(r%30); let res = ""; if (y > 0) res += `${y} Yıl `; if (m > 0) res += `${m} Ay `; if (y===0 && m===0) res += `${fd} Gün`; else if (fd > 0 && y < 10) res += `${fd} G.`; return res || "Bugün"; }

const BADGES = [ 
    {id:100,title:"Bismillah",icon:"🤲", desc:"100 Namaz"}, 
    {id:500,title:"Gayret",icon:"🔥", desc:"500 Namaz"}, 
    {id:1000,title:"Sebat",icon:"🏔️", desc:"1.000 Namaz"}, 
    {id:2500,title:"İstikrar",icon:"💎", desc:"2.500 Namaz"}, 
    {id:5000,title:"Sadakat",icon:"🌹", desc:"5.000 Namaz"}, 
    {id:10000,title:"Huzur",icon:"🕊️", desc:"10.000 Namaz"}, 
    {id:15000,title:"Vuslat",icon:"🕌", desc:"15.000 Namaz"} 
];

function renderBadges(total) { 
    const c = document.getElementById('badgeContainer'); 
    c.innerHTML = ""; 
    let next=false; 
    BADGES.forEach(b => { 
        let unlockedClass = '';
        if(total >= b.id) { 
            if(!localData.earnedBadges.includes(b.id)) { localData.earnedBadges.push(b.id); jsConfetti.addConfetti(); saveToCloud(); } 
            unlockedClass = 'unlocked';
            c.innerHTML += `<div class="badge-item ${unlockedClass}"><span class="badge-icon">${b.icon}</span><div class="badge-title">${b.title}</div><div class="badge-desc">${b.desc}</div></div>`; 
        } else if (!next) { 
            c.innerHTML += `<div class="badge-item locked"><span class="badge-icon">${b.icon}</span><div class="badge-title">${b.title}</div><div class="badge-desc">Hedef: ${b.id.toLocaleString()}</div></div>`; 
            next=true; 
        } 
    }); 
}

function renderHistory(filterDate = null) { 
    const container = document.getElementById('historyListContainer'); 
    container.innerHTML = ""; 

    if (!localData.history || localData.history.length === 0) {
        container.innerHTML = '<div class="text-center text-muted small py-4">Henüz işlem geçmişi yok.</div>';
        return;
    }

    let displayData = [];
    if (filterDate) {
        const parts = filterDate.split('-'); 
        if(parts.length === 3) {
            const filterStr = `${parts[2]}.${parts[1]}.${parts[0]}`; 
            displayData = localData.history.filter(r => r.time.split(' ')[0] === filterStr);
        } else if(filterDate.includes('.')) {
                displayData = localData.history.filter(r => r.time.split(' ')[0] === filterDate);
        }
    } else {
        displayData = localData.history.slice(0, 50);
    }

    if(displayData.length === 0) {
            container.innerHTML = '<div class="text-center text-muted small py-4">Bu tarihte işlem bulunamadı.</div>';
            return;
    }

    displayData.forEach(r => { 
        const o = parseFloat(r.oldVal); 
        const n = parseFloat(r.newVal); 
        const diff = n - o;
        const diffSign = diff > 0 ? '+' : '';
        const statusClass = diff > 0 ? 'up' : (diff < 0 ? 'down' : ''); 

        container.innerHTML += `
        <div class="metallic-card ${statusClass}" onclick="toggleHistoryCard(this)">
            <div class="card-summary">
                <span class="summary-prayer">${r.namaz}</span>
                <div class="summary-right-group">
                    <span class="change-badge">${diffSign}${diff}</span>
                    <i class="fas fa-chevron-down toggle-icon"></i>
                </div>
            </div>
            <div class="card-detail">
                <div class="detail-values">
                    <span>${o}</span>
                    <i class="fas fa-arrow-right"></i>
                    <span>${n}</span>
                </div>
                <div class="detail-full-date"><i class="far fa-clock me-1"></i> ${r.time}</div>
            </div>
        </div>`; 
    }); 

    if(!filterDate && localData.history.length > 50) {
            container.innerHTML += '<div class="text-center text-muted small py-2">Daha eski kayıtlar için tarih filtresini kullanınız...</div>';
    }
}

window.toggleHistoryCard = function(el) {
    const allOpen = document.querySelectorAll('.metallic-card.open');
    allOpen.forEach(card => {
        if(card !== el) {
            card.classList.remove('open');
            card.querySelector('.card-detail').style.display = 'none';
        }
    });

    const detail = el.querySelector('.card-detail');
    if (el.classList.contains('open')) {
        el.classList.remove('open');
        detail.style.display = 'none';
    } else {
        el.classList.add('open');
        detail.style.display = 'block';
    }
}

window.filterHistoryByDate = function() {
    const val = document.getElementById('historyFilterDate').value;
    const resetBtn = document.getElementById('resetHistoryDateBtn');
    if(val) {
            resetBtn.style.display = 'block';
            renderHistory(val);
    } else {
        resetBtn.style.display = 'none';
        renderHistory();
    }
}

window.clearHistoryFilter = function() {
    const input = document.getElementById('historyFilterDate');
    input.value = "";
    input.type = "text"; 
    document.getElementById('resetHistoryDateBtn').style.display = 'none';
    renderHistory();
}

function calculateEstFinish(totalDoneInput, elapsedDaysInput) { const dailyTarget = localData.daily.target || 10; let totalDebt = 0; localData.counts.forEach(c => totalDebt += (c.target - c.done)); const elContainer = document.getElementById('prediction-container'); const elSuccess = document.getElementById('prediction-success'); if (totalDebt <= 0) { elContainer.style.display = 'none'; elSuccess.style.display = 'block'; return; } elContainer.style.display = 'block'; elSuccess.style.display = 'none'; if (dailyTarget > 0) { const daysLeft = Math.ceil(totalDebt / dailyTarget); const today = new Date(); const finishDate = new Date(); finishDate.setDate(today.getDate() + daysLeft); const options = { year: 'numeric', month: 'long', day: 'numeric' }; document.getElementById('estFinishDate').innerText = finishDate.toLocaleDateString('tr-TR', options); document.getElementById('estDaysLeft').innerText = `${daysLeft} Gün Kaldı`; } else { document.getElementById('estFinishDate').innerText = "Belirlenmedi"; document.getElementById('estDaysLeft').innerText = "-"; } const avgDaily = totalDoneInput > 0 ? (totalDoneInput / elapsedDaysInput) : 0; const elDateAvg = document.getElementById('estFinishDateAvg'); const elDaysAvg = document.getElementById('estDaysLeftAvg'); if(avgDaily > 0) { const daysLeftAvg = Math.ceil(totalDebt / avgDaily); const todayAvg = new Date(); const finishDateAvg = new Date(); finishDateAvg.setDate(todayAvg.getDate() + daysLeftAvg); elDateAvg.innerText = finishDateAvg.toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric' }); elDaysAvg.innerText = `(${daysLeftAvg} Gün)`; } else { elDateAvg.innerText = "Veri Yok"; elDaysAvg.innerText = "Henüz kazaya başlanmadı"; } }
function showModal(title, message, onConfirm) { document.getElementById('modalTitle').innerText = title; document.getElementById('modalMessage').innerText = message; const btnGroup = document.getElementById('modalButtons'); btnGroup.innerHTML = ''; if (onConfirm) { btnGroup.innerHTML = `<button class="modal-btn btn-cancel" onclick="closeModal()">İptal</button><button class="modal-btn btn-confirm" id="modalConfirmBtn">Onayla</button>`; document.getElementById('modalConfirmBtn').onclick = () => { triggerHaptic(); onConfirm(); closeModal(); }; } else { btnGroup.innerHTML = `<button class="modal-btn btn-ok" onclick="closeModal()">Tamam</button>`; } document.getElementById('customModal').style.display = 'flex'; }
function closeModal() { document.getElementById('customModal').style.display = 'none'; }
window.upTes = function(i, d) { triggerHaptic(); const item = localData.tesbihat[i]; const target = item.target; if (d > 0 && item.current >= target) { showModal("Tebrikler", "Bu tesbihat için günlük hedef tamamlandı."); return; } const newVal = item.current + d; if (newVal < 0) return; item.current = newVal; saveToCloud(); renderTesbihat(); if (d > 0 && newVal === target) { jsConfetti.addConfetti(); setTimeout(() => { showModal("Hedef Tamamlandı!", "Allah kabul etsin, gönlüne şifa olsun. 🌹"); }, 800); } };
window.addTes = function(i) { triggerHaptic(); const valInput = document.getElementById(`manZ-${i}`); const v = parseInt(valInput.value) || 0; if(v > 0) { const item = localData.tesbihat[i]; const target = item.target; if (item.current >= target) { showModal("Tebrikler", "Zaten hedef tamamlandı."); return; } const newVal = item.current + v; item.current = newVal; saveToCloud(); renderTesbihat(); valInput.value = ""; if (newVal >= target) { jsConfetti.addConfetti(); setTimeout(() => { showModal("Hedef Tamamlandı!", "Allah kabul etsin, gönlüne şifa olsun. 🌹"); }, 800); } } };
window.resTes = function(i) { showModal("Sıfırla", "Sıfırlansın mı?", () => { localData.tesbihat[i].current = 0; saveToCloud(); renderTesbihat(); }); };
window.setTesTarget = function(i, v) { localData.tesbihat[i].target = parseInt(v)||33; saveToCloud(); renderTesbihat(); };
window.switchChartPeriod = function(period) { currentChartPeriod = period; updatePerformanceChart(); }

window.switchStatsTab = function(tab) {
    document.querySelectorAll('.stats-tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('tabBtn-' + tab).classList.add('active');
    document.getElementById('stats-view-analysis').style.display = 'none';
    document.getElementById('stats-view-history').style.display = 'none';
    document.getElementById('stats-view-' + tab).style.display = 'block';
    if(tab === 'history') {
        renderHistory(document.getElementById('historyFilterDate').value);
    }
}

function updatePerformanceChart() { const periodStats = calculatePeriodStats(); let chartLabels = []; let chartData = []; let pointRadiusVal = 3; if(currentChartPeriod === 'weekly') { chartLabels = periodStats.last7Labels; chartData = periodStats.last7Data; pointRadiusVal = 3; } else { chartLabels = periodStats.last30Labels; chartData = periodStats.last30Data; pointRadiusVal = 2; } if (lineChart) { lineChart.data.labels = chartLabels; lineChart.data.datasets[0].data = chartData; lineChart.data.datasets[0].label = currentChartPeriod === 'weekly' ? 'Günlük Kılınan (Son 7 Gün)' : 'Günlük Kılınan (Son 30 Gün)'; lineChart.data.datasets[0].pointRadius = pointRadiusVal; lineChart.update(); } }

function renderStats() { 
    let totalTarget = 0, totalDone = 0; 
    let labels = [], remainingData = [], doneData = []; 
    let maxRemaining = -1, maxName = "", maxDone = -1, bestName = ""; 
    const days = getElapsedDays();

    const gridContainer = document.getElementById('prayer-analysis-grid');
    gridContainer.innerHTML = "";

    localData.counts.forEach((c, index) => { 
        totalTarget += c.target; 
        totalDone += c.done; 
        const remaining = Math.max(0, c.target - c.done); 
        labels.push(c.name); 
        remainingData.push(remaining); 
        doneData.push(c.done); 
        
        if (remaining > maxRemaining) { maxRemaining = remaining; maxName = c.name; } 
        if (c.done > maxDone) { maxDone = c.done; bestName = c.name; }

        const avg = (c.done / days).toFixed(2);
        const estText = formatTime(avg > 0 ? Math.ceil(remaining/avg) : 0);
        
        gridContainer.innerHTML += `
        <div class="stat-accordion-item">
            <div class="stat-accordion-header" onclick="toggleStatDetails(${index})">
                <div class="stat-header-content">
                    <div class="stat-icon-wrapper"><i class="fas fa-mosque"></i></div>
                    <div class="stat-title">${c.name}</div>
                </div>
                <i class="fas fa-chevron-down stat-arrow" id="icon-stat-${index}"></i>
            </div>
            <div class="stat-accordion-body" id="detail-stat-${index}">
                <div class="stat-detail-grid">
                    <div class="stat-detail-item">
                        <span class="stat-detail-label">KILINAN</span>
                        <div class="stat-detail-value text-done">${c.done}</div>
                    </div>
                    <div class="stat-detail-item">
                        <span class="stat-detail-label">KALAN</span>
                        <div class="stat-detail-value text-rem">${remaining}</div>
                    </div>
                    <div class="stat-detail-item">
                        <span class="stat-detail-label">GÜNLÜK ORT.</span>
                        <div class="stat-detail-value text-primary">${avg}</div>
                    </div>
                    <div class="stat-detail-item">
                        <span class="stat-detail-label">TAHMİNİ BİTİŞ</span>
                        <div class="stat-detail-value text-warning" style="font-size:0.9rem;">${estText}</div>
                    </div>
                </div>
            </div>
        </div>`;
    }); 
    
    const periodStats = calculatePeriodStats(); 
    const avg = (totalDone / days).toFixed(2); 

    const dailyDone = localData.daily.counts.reduce((a,b)=>a+b,0); 
    const weeklyDone = getWeeklyProgress(); 

    document.getElementById('statToday').innerText = dailyDone; 
    document.getElementById('statWeekly').innerText = weeklyDone; 
    document.getElementById('statMonthly').innerText = periodStats.monthly; 
    document.getElementById('stat3Months').innerText = periodStats.months3;
    document.getElementById('stat6Months').innerText = periodStats.months6;
    document.getElementById('statYearly').innerText = periodStats.yearly;
    document.getElementById('statAverage').innerText = avg;
    
    document.getElementById('bestPrayer').innerText = totalDone === 0 ? "-" : `${bestName} (${maxDone})`; 
    document.getElementById('worstPrayer').innerText = totalDone === 0 ? "-" : `${maxName} (${maxRemaining})`; 
    
    const ctx1 = document.getElementById('completionChart').getContext('2d'); if (chartCompletion) chartCompletion.destroy(); const isDark = document.body.classList.contains('dark-mode'); const lc = isDark ? '#fff' : '#666'; chartCompletion = new Chart(ctx1, { type: 'doughnut', data: { labels: ['Kılınan', 'Kalan'], datasets: [{ data: [totalDone, totalTarget - totalDone], backgroundColor: ['#609979', '#d9534f'], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: lc, font: { family: 'Poppins' } } }, datalabels: { color: '#fff', font: { weight: 'bold', family: 'Poppins' }, formatter: (v, c) => (v*100 / (totalTarget||1)).toFixed(1)+"%" } } } }); const ctx2 = document.getElementById('barChart').getContext('2d'); if (barChart) barChart.destroy(); barChart = new Chart(ctx2, { type: 'bar', data: { labels: labels, datasets: [ { label: 'Kılınan', data: doneData, backgroundColor: '#609979', borderRadius: 5 }, { label: 'Kalan', data: remainingData, backgroundColor: '#fd7e14', borderRadius: 5 } ] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top', labels: { color: lc } }, datalabels: { display: false } }, scales: { y: { beginAtZero: true, grid: { display: false }, ticks:{ color: lc } }, x: { grid: { display: false }, ticks: { color: lc, font: { family: 'Poppins' } } } } } }); const ctx3 = document.getElementById('lineChart').getContext('2d'); if (lineChart) lineChart.destroy(); const gradientLine = ctx3.createLinearGradient(0, 0, 0, 200); gradientLine.addColorStop(0, 'rgba(96, 153, 121, 0.5)'); gradientLine.addColorStop(1, 'rgba(96, 153, 121, 0.0)'); let chartLabels = []; let chartData = []; let pointRadiusVal = 3; if(currentChartPeriod === 'weekly') { chartLabels = periodStats.last7Labels; chartData = periodStats.last7Data; pointRadiusVal = 3; } else { chartLabels = periodStats.last30Labels; chartData = periodStats.last30Data; pointRadiusVal = 2; } lineChart = new Chart(ctx3, { type: 'line', data: { labels: chartLabels, datasets: [{ label: currentChartPeriod === 'weekly' ? 'Günlük Kılınan (Son 7 Gün)' : 'Günlük Kılınan (Son 30 Gün)', data: chartData, borderColor: '#609979', backgroundColor: gradientLine, tension: 0.4, fill: true, pointRadius: pointRadiusVal }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, datalabels: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: isDark?'#333':'#eee' }, ticks:{ color: lc, stepSize: 1 } }, x: { grid: { display: false }, ticks: { color: lc, font: { size: 10 } } } } } }); 
    
    renderHistory();
}

window.toggleStatDetails = function(index) {
    const detail = document.getElementById(`detail-stat-${index}`);
    const icon = document.getElementById(`icon-stat-${index}`);
    const item = detail.parentElement;

    if(item.classList.contains('open')) {
        item.classList.remove('open');
        icon.className = 'fas fa-chevron-down stat-arrow';
    } else {
        document.querySelectorAll('.stat-accordion-item').forEach(el => {
            el.classList.remove('open');
            const i = el.querySelector('.stat-arrow');
            if(i) i.className = 'fas fa-chevron-down stat-arrow';
        });

        item.classList.add('open');
        icon.className = 'fas fa-chevron-up stat-arrow';
    }
}

function calculatePeriodStats() { 
    if (!localData.logs) return { weekly: 0, monthly: 0, months3: 0, months6: 0, yearly: 0, last7Data: [], last7Labels: [], last30Data: [], last30Labels: [] }; 
    const today = new Date(); 
    
    const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    let monthlyTotal = 0;

    let weeklyTotal = 0, m3 = 0, m6 = 0, y1 = 0; 
    let last7Data = [], last7Labels = []; 
    let last30Data = [], last30Labels = []; 
    
    for(let i=6; i>=0; i--) { 
        const d = new Date(); 
        d.setDate(today.getDate() - i); 
        const iso = getIsoDate(d); 
        const val = localData.logs[iso] || 0; 
        last7Data.push(val); 
        last7Labels.push(d.toLocaleDateString('tr-TR', {weekday: 'short'})); 
    } 
    for(let i=29; i>=0; i--) { 
        const d = new Date(); 
        d.setDate(today.getDate() - i); 
        const iso = getIsoDate(d); 
        const val = localData.logs[iso] || 0; 
        last30Data.push(val); 
        last30Labels.push(d.toLocaleDateString('tr-TR', {day: 'numeric', month: 'short'})); 
    } 
    
    const threeMonthsAgo = new Date(); threeMonthsAgo.setMonth(today.getMonth() - 3); 
    const sixMonthsAgo = new Date(); sixMonthsAgo.setMonth(today.getMonth() - 6); 
    const oneYearAgo = new Date(); oneYearAgo.setFullYear(today.getFullYear() - 1); 
    
    Object.keys(localData.logs).forEach(dateKey => { 
        const d = new Date(dateKey); 
        const val = localData.logs[dateKey]; 
        if(d >= currentMonthStart) monthlyTotal += val;
        if(d >= threeMonthsAgo) m3 += val; 
        if(d >= sixMonthsAgo) m6 += val; 
        if(d >= oneYearAgo) y1 += val; 
    }); 
    
    return { monthly: monthlyTotal, months3: m3, months6: m6, yearly: y1, last7Data, last7Labels, last30Data, last30Labels }; 
}
window.copyStartDate = function() { const v = document.querySelector('#row-0 input').value; for(let i=1;i<5;i++) { document.querySelectorAll(`#row-${i} input`)[0].value = v; window.calcRow(i); } };
window.copyEndDate = function() { const v = document.querySelectorAll('#row-0 input')[1].value; for(let i=1;i<5;i++) { document.querySelectorAll(`#row-${i} input`)[1].value = v; window.calcRow(i); } };
window.applyAdvancedCalculation = function() { showModal("Onay", "Kılınacak sayılar güncellensin mi?", () => { for(let i=0;i<5;i++) localData.counts[i].target = parseInt(document.getElementById(`res-${i}`).value)||0; saveToCloud(); showSection('dashboard'); }); };
window.downloadDataAsCSV = function() { let csv = "\uFEFFNamaz;Hedef;Kılınan\n"; localData.counts.forEach(c => { csv += `${c.name};${c.target};${c.done}\n`; }); const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' }); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "kaza_takip.csv"; link.click(); };
window.downloadBackupJSON = function() { const jsonStr = JSON.stringify(localData); const blob = new Blob([jsonStr], { type: 'application/json' }); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "ibadet_yedek_" + new Date().toISOString().split('T')[0] + ".json"; link.click(); };
window.importBackupJSON = function(input) { 
    const file = input.files[0]; 
    if (!file) return; 
    const reader = new FileReader(); 
    reader.onload = function(e) { 
        try { 
            const newData = JSON.parse(e.target.result); 
            if (newData.counts && newData.tesbihat) { 
                localData = newData; 
                saveToCloud(); 
                renderApp(); 
                renderTesbihat(); 
                showToast("Yedek dosyası başarıyla yüklendi! 🚀", "success");
            } else { 
                showToast("Geçersiz yedek dosyası.", "error"); 
            } 
        } catch (err) { 
            showToast("Dosya okunamadı: " + err, "error"); 
        } 
    }; 
    reader.readAsText(file); 
    input.value = ""; 
};

window.toggleDarkMode = function() { 
    document.body.classList.toggle('dark-mode'); 
    const isDark = document.body.classList.contains('dark-mode'); 
    localStorage.setItem('theme', isDark ? 'dark' : 'light'); 
    document.getElementById('darkModeText').innerText = isDark ? "Gündüz Modu" : "Gece Modu"; 
    
    if(window.innerWidth < 768 && document.getElementById('sidebar').classList.contains('active')) {
            toggleSidebar();
    }
    
    renderApp(); 
    renderStats(); 
};

if(localStorage.getItem('theme')==='dark') { document.body.classList.add('dark-mode'); document.getElementById('darkModeText').innerText = "Gündüz Modu"; }
document.getElementById('startDate').addEventListener('change', (e) => { localData.startDate = e.target.value; saveToCloud(); renderApp(); });
const dInput = document.getElementById('startDate'); dInput.onfocus = function() { this.type='date'; }; dInput.onblur = function() { this.type='text'; this.value = formatDateTR(this.value); }; dInput.placeholder = 'gg.aa.yyyy';
function checkDailyReset() { const t = getCurrentDateSimple(); if (localData.daily.date !== t) { localData.daily.date = t; localData.daily.counts = [0,0,0,0,0]; saveToCloud(); } }
function getElapsedDays() { if (!localData.startDate) return 1; const s = new Date(localData.startDate); const n = new Date(); s.setHours(0,0,0,0); n.setHours(0,0,0,0); return Math.ceil(Math.abs(n - s) / (1000 * 60 * 60 * 24)) || 1; }
function getCurrentTime() { return new Date().toLocaleString('tr-TR'); }
function addHistory(n, o, nv) { const r = { namaz: n, oldVal: parseInt(o), newVal: parseInt(nv), time: getCurrentTime() }; if (!localData.history) localData.history = []; localData.history.unshift(r); 
saveToCloud(); }

function forceResetData() { 
    const savedGender = localData.gender;
    const savedMenstrualDays = localData.menstrualDaysPerMonth;
    const savedMenstrualState = localData.isMenstrualState;
    localData = JSON.parse(JSON.stringify(defaultData)); 
    if(savedGender) {
        localData.gender = savedGender;
        localData.menstrualDaysPerMonth = savedMenstrualDays;
        localData.isMenstrualState = savedMenstrualState;
    }
    saveToCloud(); 
    renderApp();
    renderStats();
    renderCalculatorRows();
    applyGenderSettings(); 
    showModal("Bilgi", "Kaza namaz borcunuz bulunmamaktadır.");
}

function confirmResetData() { showModal("Dikkat!", "Tüm veriler silinecek. Emin misiniz?", forceResetData); }

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then((registration) => {
                console.log('Service Worker başarıyla kaydedildi:', registration.scope);
            })
            .catch((error) => {
                console.log('Service Worker kaydı başarısız:', error);
            });
    });
}

window.addEventListener('offline', () => {
    showToast("İnternet bağlantısı kesildi. Çevrimdışı moddasınız.", "error");
    document.body.style.filter = "grayscale(100%)";
});

window.addEventListener('online', () => {
    showToast("Tekrar çevrimiçi oldunuz!", "success");
    document.body.style.filter = "none";
});