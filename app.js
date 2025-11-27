// --- KONFETİ BAŞLATMA ---
    const jsConfetti = new JSConfetti();

    // --- YARDIMCI FONKSİYONLAR ---
    function triggerHaptic() { if (navigator.vibrate) navigator.vibrate(10); }
    function hideLoader() {
        const loader = document.getElementById('loading-overlay');
        if (loader) { loader.style.opacity = '0'; setTimeout(() => { loader.style.visibility = 'hidden'; }, 500); }
    }
    setTimeout(() => { hideLoader(); }, 5000); 

    // --- MANIFEST ---
    const pwaIcon = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'%3E%3Cpath fill='%23198754' d='M256 0C114.6 0 0 114.6 0 256s114.6 256 256 256 256-114.6 256-256S401.4 0 256 0zm-46.8 389L68.6 248.4c-4.7-4.7-4.7-12.3 0-17l28.3-28.3c4.7-4.7 12.3-4.7 17 0L209.2 298l188.8-188.8c4.7-4.7 12.3-4.7 17 0l28.3 28.3c4.7 4.7 4.7 12.3 0 17L226.2 389c-4.7 4.7-12.3 4.7-17 0z'/%3E%3C/svg%3E";
    const manifestBlob = new Blob([JSON.stringify({ 
        "name": "İbadet Takip v9", "short_name": "İbadet", "start_url": ".", "display": "minimal-ui",  
        "orientation": "any", "background_color": "#f8f9fa", "theme_color": "#198754", 
        "icons": [{ "src": pwaIcon, "sizes": "192x192", "type": "image/svg+xml" }] 
    })], {type: 'application/json'});
    document.querySelector('#my-manifest').href = URL.createObjectURL(manifestBlob);

    // --- FIREBASE AYARLARI ---
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

    // --- VERİ MODELİ ---
    function getCurrentDateSimple() { const d = new Date(); return d.toLocaleDateString('tr-TR'); }
    function getYesterdayDateSimple() { const d = new Date(); d.setDate(d.getDate() - 1); return d.toLocaleDateString('tr-TR'); }
    function getIsoDate(date) { return date.toISOString().split('T')[0]; }

    const defaultData = {
        startDate: new Date().toISOString().split('T')[0],
        daily: { date: getCurrentDateSimple(), counts: [0,0,0,0,0], target: 10 },
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
    let chartCompletion = null;
    let barChart = null;
    let lineChart = null;

    // --- AUTH & DATA LOAD ---
    auth.onAuthStateChanged((user) => {
        if (user) {
            document.getElementById('login-screen').style.display = 'none';
            document.getElementById('app-wrapper').style.display = 'flex';
            document.getElementById('sidebarUserInfo').innerText = user.displayName;
            
            dbRef = db.ref('users/' + user.uid + '/namazData');
            dbRef.on('value', (s) => {
                try {
                    const d = s.val();
                    if (d) localData = d;
                    ensureDataStructure(); 
                    checkDailyReset();
                    if (!d) saveToCloud();
                    
                    renderCalculatorRows();
                    const activeId = document.querySelector('.components li.active') ? document.querySelector('.components li.active').id.replace('menu-', '') : 'dashboard';
                    showSection(activeId); 
                } catch (err) { console.error(err); } 
                finally { hideLoader(); }
            });
        } else { 
            document.getElementById('loading-overlay').style.display = 'none';
            document.getElementById('login-screen').style.display = 'flex'; 
            document.getElementById('app-wrapper').style.display = 'none'; 
        }
    });

    function loginWithGoogle() { auth.signInWithPopup(provider).catch(e => showModal("Hata", e.message)); }
    function logout() { auth.signOut(); }
    function saveToCloud() { if(dbRef) dbRef.set(localData); }
    
    function ensureDataStructure() {
        if (!localData.counts) localData.counts = JSON.parse(JSON.stringify(defaultData.counts));
        if (!localData.tesbihat) localData.tesbihat = JSON.parse(JSON.stringify(defaultData.tesbihat));
        if (!localData.calendar) localData.calendar = {};
        if (!localData.logs) localData.logs = {}; 
        const t = new Date().toLocaleDateString('tr-TR');
        if (!localData.daily || localData.daily.date !== t) { localData.daily = { date: t, counts: [0,0,0,0,0], target: localData.daily?.target || 10 }; saveToCloud(); }
        if (!localData.streak) localData.streak = { current: 0, lastAchievedDate: "" };
        if (!localData.history) localData.history = [];
        if (!localData.earnedBadges) localData.earnedBadges = [];
        if (!localData.startDate) localData.startDate = new Date().toISOString().split('T')[0];
    }

    // --- UI & NAVIGATION ---
    window.showSection = function(id) {
        if(!id) id = 'dashboard';
        
        document.querySelectorAll('#sidebar ul li').forEach(li => li.classList.remove('active'));
        const menuItem = document.getElementById('menu-' + id);
        if(menuItem) menuItem.classList.add('active');
        
        const sections = ['dashboard', 'stats', 'tesbihat', 'calculator', 'settings'];
        sections.forEach(sec => { const el = document.getElementById('section-' + sec); if(el) el.style.display = 'none'; });
        
        const activeSec = document.getElementById('section-' + id);
        if(activeSec) activeSec.style.display = 'block';

        if(window.innerWidth < 768) {
            document.getElementById('sidebar').classList.remove('active');
            document.getElementById('overlay').classList.remove('active');
        }

        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        const navMap = { 'dashboard': 0, 'stats': 1, 'tesbihat': 2, 'calculator': 3 };
        const navIndex = navMap[id];
        if (navIndex !== undefined) {
             const navItems = document.querySelectorAll('.nav-item');
             if(navItems[navIndex]) navItems[navIndex].classList.add('active');
        }
        
        try {
            if(id === 'dashboard') renderApp();
            if(id === 'stats') renderStats();
            if(id === 'tesbihat') renderTesbihat();
            if(id === 'calculator') renderCalculatorRows(); 
        } catch(e) { console.log("Render error:", e); }
    };

    function toggleSidebar() {
        triggerHaptic();
        document.getElementById('sidebar').classList.toggle('active');
        document.getElementById('overlay').classList.toggle('active');
    }
    
    function activateNav(element) {
        triggerHaptic();
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        if(element) element.classList.add('active');
    }

    // --- İŞLEM FONKSİYONLARI ---
    window.upT = function(i, v) { localData.counts[i].target = parseInt(v) || 0; saveToCloud(); renderApp(); };
    window.upD = function(i, v) { const o = localData.counts[i].done; const n = parseInt(v) || 0; if (o !== n) { localData.counts[i].done = n; addHistory(localData.counts[i].name, o, n); saveToCloud(); renderApp(); } };
    
    window.chC = function(i, d) { 
        triggerHaptic(); 
        const o = localData.counts[i].done; const n = o + d; 
        if (n >= 0) { 
            localData.counts[i].done = n; 
            if (d > 0) {
                localData.daily.counts[i]++;
                // LOG & CALENDAR
                if (!localData.logs) localData.logs = {};
                const todayISO = getIsoDate(new Date());
                localData.logs[todayISO] = (localData.logs[todayISO] || 0) + 1;

                const ct = localData.daily.counts.reduce((a, b) => a + b, 0);
                if (ct >= localData.daily.target) {
                    localData.calendar[todayISO] = true; 
                    if (ct === localData.daily.target) jsConfetti.addConfetti();
                } else { delete localData.calendar[todayISO]; }
                
                recalculateStreak();
            } else if (localData.daily.counts[i] > 0) {
                localData.daily.counts[i]--;
                const todayISO = getIsoDate(new Date());
                if(localData.logs && localData.logs[todayISO] > 0) localData.logs[todayISO]--;
                
                const ct = localData.daily.counts.reduce((a, b) => a + b, 0);
                if (ct < localData.daily.target) {
                     delete localData.calendar[todayISO];
                }
                recalculateStreak();
            }
            addHistory(localData.counts[i].name, o, n); saveToCloud(); renderApp(); 
        } 
    };
    
    function recalculateStreak() {
        let currentStreak = 0;
        const today = new Date();
        
        const isoToday = getIsoDate(today);
        if (localData.calendar && localData.calendar[isoToday]) {
            currentStreak++;
        }
        
        for (let i = 1; i < 1000; i++) { 
            const d = new Date();
            d.setDate(today.getDate() - i);
            const iso = getIsoDate(d);
            
            if (localData.calendar && localData.calendar[iso]) {
                currentStreak++;
            } else {
                if (i === 1 && currentStreak === 0) {
                } else {
                    break; 
                }
            }
        }
        localData.streak.current = currentStreak;
    }
    
    window.updateDailyGoal = function(v) { localData.daily.target = parseInt(v)||10; saveToCloud(); renderApp(); };

    // --- RENDER FONKSİYONLARI ---
    function renderApp() {
        if(!localData.counts) return;
        recalculateStreak();
        document.getElementById('startDate').value = localData.startDate;
        const c = localData.daily.counts.reduce((a,b)=>a+b,0);
        document.getElementById('dailyCountDisplay').innerText = c;
        document.getElementById('dailyGoalInput').value = localData.daily.target;
        let p = (c / localData.daily.target) * 100; if(p>100) p=100;
        document.getElementById('dailyProgressBar').style.width = p + "%";
        
        if(c >= localData.daily.target) { 
            document.getElementById('goalCard').classList.add('success-mode'); 
            document.getElementById('goalSuccessMessage').style.display='block'; 
        } else { 
            document.getElementById('goalCard').classList.remove('success-mode'); 
            document.getElementById('goalSuccessMessage').style.display='none'; 
        }
        document.getElementById('streakValue').innerText = localData.streak.current;

        const tbody = document.getElementById('prayerTableBody');
        const tfoot = document.getElementById('prayerTableFoot');
        tbody.innerHTML = "";
        let tt=0, td=0, tr=0;
        const days = getElapsedDays(); document.getElementById('elapsedDays').value = days; 
        
        localData.counts.forEach((item, i) => {
            tt += parseInt(item.target); td += parseInt(item.done);
            const rem = item.target - item.done; tr += rem;
            const avg = (item.done / days).toFixed(2);
            const estText = formatTime(avg > 0 ? Math.ceil(rem/avg) : 0);
            let pp = item.target > 0 ? (item.done / item.target) * 100 : 0;
            
            // "spacer-box" sınıfları eklendi
            tbody.innerHTML += `<tr>
                <td class="col-namaz">${item.name}</td>
                <td class="col-input-area">
                    <input type="number" class="table-input" value="${item.target}" onchange="window.upT(${i},this.value)">
                    <div class="spacer-box"></div>
                </td>
                <td class="col-input-area">
                    <input type="number" class="table-input" value="${item.done}" onchange="window.upD(${i},this.value)">
                    <div class="progress-container">
                        <div class="progress">
                            <div class="progress-bar bg-success" style="width: ${pp}%"></div>
                        </div>
                        <div class="progress-text text-center">%${pp.toFixed(1)}</div>
                    </div>
                </td>
                <td class="col-action">
                    <div class="action-wrapper">
                        <button class="btn-action btn-plus" onclick="window.chC(${i},1)">+</button>
                        <button class="btn-action btn-minus" onclick="window.chC(${i},-1)">-</button>
                    </div>
                    <div class="spacer-box"></div>
                </td>
                <td>
                    <div class="table-value-box">${avg}</div>
                    <div class="spacer-box"></div>
                </td>
                <td>
                    <div class="table-value-box">${estText}</div>
                    <div class="spacer-box"></div>
                </td>
            </tr>`;
        });
        const oa = (td/days).toFixed(2);
        tfoot.innerHTML = `<tr><td>Toplam</td><td>${tt}</td><td>${td}</td><td></td><td>${oa}</td><td>${formatTime(oa > 0 ? Math.ceil(tr/oa) : 0)}</td></tr>`;
        
        renderBadges(td); 
        renderHistory(); 
        calculateEstFinish(td, days); 
        // renderHeatmap() ÇAĞRISI KALDIRILDI
    }

    function renderTesbihat() {
        const c = document.getElementById('tesbihatContainer'); c.innerHTML = "";
        if (!localData.tesbihat) localData.tesbihat = JSON.parse(JSON.stringify(defaultData.tesbihat));
        localData.tesbihat.forEach((item, i) => {
            let p = item.target > 0 ? (item.current / item.target) * 100 : 0;
            c.innerHTML += `
            <div class="col-md-6">
                <div class="zikr-card">
                    <h5>${item.name}</h5>
                    <div class="arabic-text">${item.arabic}</div>
                    <div class="zikr-count">${item.current}</div>
                    <div class="progress mb-3" style="height: 8px;"><div class="progress-bar bg-success" style="width: ${p}%"></div></div>
                    
                    <div class="zikr-btn-group">
                        <button class="zikr-btn z-minus" onclick="window.upTes(${i},-1)"><i class="fas fa-minus"></i></button>
                        <button class="zikr-btn z-plus" onclick="window.upTes(${i},1)"><i class="fas fa-plus"></i></button>
                        <button class="zikr-btn z-reset" onclick="window.resTes(${i})"><i class="fas fa-undo"></i></button>
                    </div>
                    
                    <div class="tesbihat-target-box">
                        <span class="tesbihat-target-label">HEDEF</span>
                        <input type="number" class="tesbihat-target-input" value="${item.target}" onchange="window.setTesTarget(${i}, this.value)">
                    </div>
                    
                    <div class="manual-zikr-container">
                        <input type="number" id="manZ-${i}" class="manual-zikr-input-clean" placeholder="+Adet">
                        <button class="btn-add-clean" onclick="window.addTes(${i})">EKLE</button>
                    </div>
                </div>
            </div>`;
        });
    }

    // --- YARDIMCI VE HESAPLAMALAR ---
    function formatTime(d) { if (!isFinite(d) || d <= 0) return "Tamamlandı"; const y = Math.floor(d/365); const r = d % 365; const m = Math.floor(r/30); const fd = Math.floor(r%30); let res = ""; if (y > 0) res += `${y} Yıl `; if (m > 0) res += `${m} Ay `; if (y===0 && m===0) res += `${fd} Gün`; else if (fd > 0 && y < 10) res += `${fd} G.`; return res || "Bugün"; }
    
    const BADGES = [
        {id:100,title:"Bismillah",icon:"🤲", desc:"100 Namaz"},
        {id:500,title:"Gayret",icon:"🏃", desc:"500 Namaz"},
        {id:1000,title:"Sebat",icon:"🏔️", desc:"1.000 Namaz"},
        {id:2500,title:"İstikrar",icon:"💎", desc:"2.500 Namaz"},
        {id:5000,title:"Sadakat",icon:"🌹", desc:"5.000 Namaz"},
        {id:10000,title:"Huzur",icon:"🕊️", desc:"10.000 Namaz"},
        {id:15000,title:"Vuslat",icon:"🕌", desc:"15.000 Namaz"}
    ];
    
    function renderBadges(total) { const c = document.getElementById('badgeContainer'); c.innerHTML = ""; let next=false; BADGES.forEach(b => { if(total >= b.id) { if(!localData.earnedBadges.includes(b.id)) { localData.earnedBadges.push(b.id); jsConfetti.addConfetti(); saveToCloud(); } c.innerHTML += `<div class="badge-item"><span class="badge-icon">${b.icon}</span><div class="badge-title">${b.title}</div><div class="badge-desc">${b.desc}</div></div>`; } else if (!next) { c.innerHTML += `<div class="badge-item locked"><span class="badge-icon">${b.icon}</span><div class="badge-title">${b.title}</div><div class="badge-desc">Hedef: ${b.id.toLocaleString()}</div></div>`; next=true; } }); }
    function renderHistory() { const hb = document.getElementById('historyTableBody'); hb.innerHTML = ""; if (!localData.history) return; localData.history.forEach(r => { const o = parseFloat(r.oldVal); const n = parseFloat(r.newVal); let cls = n > o ? 'history-row-up' : (n < o ? 'history-row-down' : ''); hb.innerHTML += `<tr class="${cls}"><td>${r.namaz}</td><td>${r.oldVal}</td><td>${r.newVal}</td><td>${r.time.split(' ')[1]}</td></tr>`; }); }

    function calculateEstFinish(totalDoneInput, elapsedDaysInput) {
        const dailyTarget = localData.daily.target || 10;
        let totalDebt = 0;
        localData.counts.forEach(c => totalDebt += (c.target - c.done));
        
        const elContainer = document.getElementById('prediction-container');
        const elSuccess = document.getElementById('prediction-success');
        
        if (totalDebt <= 0) {
            elContainer.style.display = 'none'; elSuccess.style.display = 'block'; return;
        }
        elContainer.style.display = 'block'; elSuccess.style.display = 'none';

        if (dailyTarget > 0) {
            const daysLeft = Math.ceil(totalDebt / dailyTarget);
            const today = new Date();
            const finishDate = new Date();
            finishDate.setDate(today.getDate() + daysLeft);
            const options = { year: 'numeric', month: 'long', day: 'numeric' };
            document.getElementById('estFinishDate').innerText = finishDate.toLocaleDateString('tr-TR', options);
            document.getElementById('estDaysLeft').innerText = `${daysLeft} Gün Kaldı`;
        } else {
            document.getElementById('estFinishDate').innerText = "Belirlenmedi";
            document.getElementById('estDaysLeft').innerText = "-";
        }

        const avgDaily = totalDoneInput > 0 ? (totalDoneInput / elapsedDaysInput) : 0;
        const elDateAvg = document.getElementById('estFinishDateAvg');
        const elDaysAvg = document.getElementById('estDaysLeftAvg');

        if(avgDaily > 0) {
            const daysLeftAvg = Math.ceil(totalDebt / avgDaily);
            const todayAvg = new Date();
            const finishDateAvg = new Date();
            finishDateAvg.setDate(todayAvg.getDate() + daysLeftAvg);
            
            elDateAvg.innerText = finishDateAvg.toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric' });
            elDaysAvg.innerText = `(${daysLeftAvg} Gün)`;
        } else {
            elDateAvg.innerText = "Veri Yok";
            elDaysAvg.innerText = "Henüz kazaya başlanmadı";
        }
    }

    // renderHeatmap FONKSİYONU KALDIRILDI

    function showModal(title, message, onConfirm) {
        document.getElementById('modalTitle').innerText = title;
        document.getElementById('modalMessage').innerText = message;
        const btnGroup = document.getElementById('modalButtons');
        btnGroup.innerHTML = '';
        if (onConfirm) {
            btnGroup.innerHTML = `<button class="modal-btn btn-cancel" onclick="closeModal()">İptal</button><button class="modal-btn btn-confirm" id="modalConfirmBtn">Onayla</button>`;
            document.getElementById('modalConfirmBtn').onclick = () => { triggerHaptic(); onConfirm(); closeModal(); };
        } else { btnGroup.innerHTML = `<button class="modal-btn btn-ok" onclick="closeModal()">Tamam</button>`; }
        document.getElementById('customModal').style.display = 'flex';
    }
    function closeModal() { document.getElementById('customModal').style.display = 'none'; }

    // --- TESBİHAT FONKSİYONLARI ---
    window.upTes = function(i, d) { 
        triggerHaptic(); 
        const item = localData.tesbihat[i];
        const target = item.target;

        if (d > 0 && item.current >= target) {
            showModal("Tebrikler", "Bu tesbihat için günlük hedef tamamlandı.");
            return;
        }

        const newVal = item.current + d;
        if (newVal < 0) return;

        item.current = newVal;
        saveToCloud();
        renderTesbihat(); 

        if (d > 0 && newVal === target) {
            jsConfetti.addConfetti(); 
            setTimeout(() => {
                showModal("Hedef Tamamlandı!", "Allah kabul etsin, gönlüne şifa olsun. 🌹");
            }, 800);
        }
    };

    window.addTes = function(i) { 
        triggerHaptic(); 
        const valInput = document.getElementById(`manZ-${i}`);
        const v = parseInt(valInput.value) || 0;
        
        if(v > 0) { 
            const item = localData.tesbihat[i];
            const target = item.target;
            
            if (item.current >= target) {
                showModal("Tebrikler", "Zaten hedef tamamlandı.");
                return;
            }
            
            const newVal = item.current + v;
            item.current = newVal;
            saveToCloud();
            renderTesbihat(); 
            valInput.value = "";

            if (newVal >= target) {
                 jsConfetti.addConfetti();
                 setTimeout(() => {
                    showModal("Hedef Tamamlandı!", "Allah kabul etsin, gönlüne şifa olsun. 🌹");
                }, 800);
            }
        } 
    };
    
    window.resTes = function(i) { showModal("Sıfırla", "Sıfırlansın mı?", () => { localData.tesbihat[i].current = 0; saveToCloud(); renderTesbihat(); }); };
    window.setTesTarget = function(i, v) { localData.tesbihat[i].target = parseInt(v)||33; saveToCloud(); renderTesbihat(); };

    // --- İSTATİSTİK FONKSİYONLARI ---
    function renderStats() {
        let totalTarget = 0, totalDone = 0;
        let labels = [], remainingData = [], doneData = [];
        let maxRemaining = -1, maxName = "", maxDone = -1, bestName = "";

        localData.counts.forEach(c => {
            totalTarget += c.target; totalDone += c.done;
            const remaining = Math.max(0, c.target - c.done);
            labels.push(c.name); 
            remainingData.push(remaining);
            doneData.push(c.done);

            if (remaining > maxRemaining) { maxRemaining = remaining; maxName = c.name; }
            if (c.done > maxDone) { maxDone = c.done; bestName = c.name; }
        });

        const periodStats = calculatePeriodStats();
        const days = getElapsedDays();
        const avg = (totalDone / days).toFixed(2);
        
        document.getElementById('statAverage').innerText = avg;
        document.getElementById('statWeekly').innerText = periodStats.weekly;
        document.getElementById('statMonthly').innerText = periodStats.monthly;
        document.getElementById('stat3Months').innerText = periodStats.months3;
        document.getElementById('stat6Months').innerText = periodStats.months6;
        document.getElementById('statYearly').innerText = periodStats.yearly;

        document.getElementById('bestPrayer').innerText = totalDone === 0 ? "-" : `${bestName} (${maxDone})`;
        document.getElementById('worstPrayer').innerText = totalDone === 0 ? "-" : `${maxName} (${maxRemaining})`;

        const ctx1 = document.getElementById('completionChart').getContext('2d');
        if (chartCompletion) chartCompletion.destroy();
        const isDark = document.body.classList.contains('dark-mode');
        const lc = isDark ? '#fff' : '#666';
        chartCompletion = new Chart(ctx1, { 
            type: 'doughnut', 
            data: { 
                labels: ['Kılınan', 'Kalan'], 
                datasets: [{ data: [totalDone, totalTarget - totalDone], backgroundColor: ['#198754', '#d9534f'], borderWidth: 0 }] 
            }, 
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: lc, font: { family: 'Poppins' } } }, datalabels: { color: '#fff', font: { weight: 'bold', family: 'Poppins' }, formatter: (v, c) => (v*100 / (totalTarget||1)).toFixed(1)+"%" } } } 
        });

        const ctx2 = document.getElementById('barChart').getContext('2d');
        if (barChart) barChart.destroy();
        
        barChart = new Chart(ctx2, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    { label: 'Kılınan', data: doneData, backgroundColor: '#198754', borderRadius: 5 },
                    { label: 'Kalan', data: remainingData, backgroundColor: '#fd7e14', borderRadius: 5 }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { position: 'top', labels: { color: lc } }, datalabels: { display: false } },
                scales: { y: { beginAtZero: true, grid: { display: false }, ticks:{ color: lc } }, x: { grid: { display: false }, ticks: { color: lc, font: { family: 'Poppins' } } } }
            }
        });

        const ctx3 = document.getElementById('lineChart').getContext('2d');
        if (lineChart) lineChart.destroy();
        const gradientLine = ctx3.createLinearGradient(0, 0, 0, 200);
        gradientLine.addColorStop(0, 'rgba(25, 135, 84, 0.5)'); gradientLine.addColorStop(1, 'rgba(25, 135, 84, 0.0)');
        lineChart = new Chart(ctx3, {
            type: 'line',
            data: {
                labels: periodStats.last7Labels,
                datasets: [{ label: 'Günlük Kılınan', data: periodStats.last7Data, borderColor: '#198754', backgroundColor: gradientLine, tension: 0.4, fill: true, pointRadius: 3 }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false }, datalabels: { display: false } },
                scales: { y: { beginAtZero: true, grid: { color: isDark?'#333':'#eee' }, ticks:{ color: lc, stepSize: 1 } }, x: { grid: { display: false }, ticks: { color: lc, font: { size: 10 } } } }
            }
        });
    }

    function calculatePeriodStats() {
        if (!localData.logs) return { weekly: 0, monthly: 0, months3: 0, months6: 0, yearly: 0, last7Data: [], last7Labels: [] };
        const today = new Date();
        let weeklyTotal = 0, monthlyTotal = 0, m3 = 0, m6 = 0, y1 = 0;
        let last7Data = [], last7Labels = [];
        for(let i=6; i>=0; i--) {
            const d = new Date(); d.setDate(today.getDate() - i);
            const iso = getIsoDate(d); const val = localData.logs[iso] || 0;
            weeklyTotal += val; last7Data.push(val); last7Labels.push(d.toLocaleDateString('tr-TR', {weekday: 'short'}));
        }
        const oneMonthAgo = new Date(); oneMonthAgo.setMonth(today.getMonth() - 1);
        const threeMonthsAgo = new Date(); threeMonthsAgo.setMonth(today.getMonth() - 3);
        const sixMonthsAgo = new Date(); sixMonthsAgo.setMonth(today.getMonth() - 6);
        const oneYearAgo = new Date(); oneYearAgo.setFullYear(today.getFullYear() - 1);
        Object.keys(localData.logs).forEach(dateKey => {
            const d = new Date(dateKey); const val = localData.logs[dateKey];
            if(d >= oneMonthAgo) monthlyTotal += val; if(d >= threeMonthsAgo) m3 += val; if(d >= sixMonthsAgo) m6 += val; if(d >= oneYearAgo) y1 += val;
        });
        return { weekly: weeklyTotal, monthly: monthlyTotal, months3: m3, months6: m6, yearly: y1, last7Data, last7Labels };
    }

    // --- HESAPLAMA SİHİRBAZI ---
    window.renderCalculatorRows = function() { const c = document.getElementById('calcRowsContainer'); if(!c || c.innerHTML.trim()) return; const prayerTypes = ["Sabah", "Öğle", "İkindi", "Akşam", "Yatsı"]; prayerTypes.forEach((p, i) => { c.innerHTML += `<div class="calc-row" id="row-${i}"><div class="calc-header">${p}</div><div class="calc-body"><div class="calc-item"><small class="calc-label-small">Sorumluluk Başlangıcı</small><input type="text" class="form-control date-input" placeholder="gg.aa.yyyy" onfocus="(this.type='date')" onblur="(this.type='text')" onchange="window.calcRow(${i})"></div><div class="calc-item"><small class="calc-label-small">Düzenli Başlama Tarihi</small><input type="text" class="form-control date-input" placeholder="gg.aa.yyyy" onfocus="(this.type='date')" onblur="(this.type='text')" onchange="window.calcRow(${i})"></div><div class="calc-item"><small class="calc-label-small">Hesaplanan Gün</small><input type="number" class="form-control calc-result-input" id="res-${i}" value="0"></div></div></div>`; }); };
    window.calcRow = function(i) { const r=document.getElementById(`row-${i}`); const inputs=r.querySelectorAll('input'); const s=inputs[0].value; const e=inputs[1].value; if(s&&e) document.getElementById(`res-${i}`).value = Math.max(0, Math.ceil((new Date(e)-new Date(s))/(86400000))); };
    window.copyStartDate = function() { const v = document.querySelector('#row-0 input').value; for(let i=1;i<5;i++) { document.querySelectorAll(`#row-${i} input`)[0].value = v; window.calcRow(i); } };
    window.copyEndDate = function() { const v = document.querySelectorAll('#row-0 input')[1].value; for(let i=1;i<5;i++) { document.querySelectorAll(`#row-${i} input`)[1].value = v; window.calcRow(i); } };
    window.applyAdvancedCalculation = function() { showModal("Onay", "Kılınacak sayılar güncellensin mi?", () => { for(let i=0;i<5;i++) localData.counts[i].target = parseInt(document.getElementById(`res-${i}`).value)||0; saveToCloud(); showSection('dashboard'); }); };

    // --- AYARLAR & YEDEKLEME ---
    window.downloadDataAsCSV = function() { let csv = "\uFEFFNamaz;Hedef;Kılınan\n"; localData.counts.forEach(c => { csv += `${c.name};${c.target};${c.done}\n`; }); const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' }); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "kaza_takip.csv"; link.click(); };
    window.downloadBackupJSON = function() { const jsonStr = JSON.stringify(localData); const blob = new Blob([jsonStr], { type: 'application/json' }); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "ibadet_yedek_" + new Date().toISOString().split('T')[0] + ".json"; link.click(); };
    window.importBackupJSON = function(input) { const file = input.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = function(e) { try { const newData = JSON.parse(e.target.result); if (newData.counts && newData.tesbihat) { showModal("Yedek Bulundu", "Veriler geri yüklensin mi? Mevcut veriler silinecektir.", () => { localData = newData; saveToCloud(); renderApp(); renderTesbihat(); showModal("Başarılı", "Yedek başarıyla yüklendi."); }); } else { showModal("Hata", "Geçersiz yedek dosyası."); } } catch (err) { showModal("Hata", "Dosya okunamadı: " + err); } }; reader.readAsText(file); input.value = ""; };
    window.toggleDarkMode = function() { document.body.classList.toggle('dark-mode'); const isDark = document.body.classList.contains('dark-mode'); localStorage.setItem('theme', isDark ? 'dark' : 'light'); document.getElementById('darkModeText').innerText = isDark ? "Gündüz Modu" : "Gece Modu"; renderApp(); };
    if(localStorage.getItem('theme')==='dark') { document.body.classList.add('dark-mode'); document.getElementById('darkModeText').innerText = "Gündüz Modu"; }
    document.getElementById('startDate').addEventListener('change', (e) => { localData.startDate = e.target.value; saveToCloud(); renderApp(); });
    const dInput = document.getElementById('startDate'); dInput.onfocus = function() { this.type='date'; }; dInput.onblur = function() { this.type='text'; }; dInput.placeholder = 'gg.aa.yyyy';
    function checkDailyReset() { const t = getCurrentDateSimple(); if (localData.daily.date !== t) { localData.daily.date = t; localData.daily.counts = [0,0,0,0,0]; saveToCloud(); } }
    function getElapsedDays() { if (!localData.startDate) return 1; const s = new Date(localData.startDate); const n = new Date(); s.setHours(0,0,0,0); n.setHours(0,0,0,0); return Math.ceil(Math.abs(n - s) / (1000 * 60 * 60 * 24)) || 1; }
    function getCurrentTime() { return new Date().toLocaleString('tr-TR'); }
    function addHistory(n, o, nv) { const r = { namaz: n, oldVal: parseInt(o), newVal: parseInt(nv), time: getCurrentTime() }; if (!localData.history) localData.history = []; localData.history.unshift(r); if (localData.history.length > 20) localData.history.pop(); saveToCloud(); }
    function forceResetData() { localData=JSON.parse(JSON.stringify(defaultData)); saveToCloud(); showModal("Başarılı", "Tüm veriler sıfırlandı ve onarıldı."); setTimeout(() => location.reload(), 1500); }
    function confirmResetData() { showModal("Dikkat!", "Tüm veriler silinecek. Emin misiniz?", forceResetData); }