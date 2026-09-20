/* ===== OHOO TAP - ADMIN.JS ===== */
/* Game ke ohoo_tap_users se connected */

// ===== KEYS (GAME WALI) =====
const USERS_KEY = "ohoo_tap_users";
const ADMIN_KEY = "ohoo_tap_admin";
const ADMIN_CONFIG_KEY = "ohoo_tap_admin_config";
const ADMIN_CREDENTIALS = { username: "admin", password: "admin123" };
const COINS_PER_PKR = 4500;

// ===== STATE =====
let currentWithdrawFilter = "all";
let currentEditingUser = null;
let confirmCallback = null;

// ===== INIT =====
document.addEventListener("DOMContentLoaded", () => {
    checkAdminLogin();
});

// ===== LOGIN =====
function adminLogin() {
    const username = document.getElementById("admin-username").value.trim();
    const password = document.getElementById("admin-password").value;

    if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
        localStorage.setItem(ADMIN_KEY, "logged_in");
        document.getElementById("admin-login-screen").classList.add("hidden");
        document.getElementById("admin-panel").classList.remove("hidden");
        loadAllData();
        showToast("Welcome Admin!", "success");
    } else {
        showToast("Galat username ya password!", "error");
    }
}

function adminLogout() {
    if (!confirm("Logout karna hai?")) return;
    localStorage.removeItem(ADMIN_KEY);
    location.reload();
}

function checkAdminLogin() {
    if (localStorage.getItem(ADMIN_KEY) === "logged_in") {
        document.getElementById("admin-login-screen").classList.add("hidden");
        document.getElementById("admin-panel").classList.remove("hidden");
        loadAllData();
    }
}

// ===== TABS =====
function adminTab(tab) {
    document.querySelectorAll(".admin-tab-view").forEach(t => t.classList.remove("active"));
    const target = document.getElementById(`admin-tab-${tab}`);
    if (target) target.classList.add("active");
    document.querySelectorAll(".admin-tab").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));

    if (tab === "dashboard") renderDashboard();
    if (tab === "users") renderUsers();
    if (tab === "withdrawals") renderWithdrawals();
    if (tab === "premium") renderPremiumList();
    if (tab === "upgrades") renderUpgradesList();
    if (tab === "announce") renderAnnouncements();
    if (tab === "settings") loadSettings();
}

// ===== DATA HELPERS =====
function getUsers() {
    return JSON.parse(localStorage.getItem(USERS_KEY) || "{}");
}

function saveUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function formatNum(n) {
    n = Math.floor(n || 0);
    if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
    if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
    return n.toString();
}

function formatDate(time) {
    if (!time) return "N/A";
    return new Date(time).toLocaleString();
}

// ===== LOAD ALL =====
function loadAllData() {
    updateHeaderStats();
    renderDashboard();
    renderUsers();
    renderWithdrawals();
    renderPremiumList();
    renderUpgradesList();
    renderAnnouncements();
    loadSettings();
}

function refreshData() {
    loadAllData();
    showToast("Data refreshed!", "success");
}

// ===== HEADER STATS =====
function updateHeaderStats() {
    const users = getUsers();
    const usernames = Object.keys(users);
    let totalCoins = 0;
    let premiumCount = 0;
    let pendingWithdraw = 0;

    usernames.forEach(u => {
        const d = users[u].data || {};
        totalCoins += d.coins || 0;
        if (d.premium) premiumCount++;
        (d.withdrawHistory || []).forEach(w => {
            if (w.status === "Pending") pendingWithdraw++;
        });
    });

    document.getElementById("stat-total-users").textContent = usernames.length;
    document.getElementById("stat-total-coins").textContent = formatNum(totalCoins);
    document.getElementById("stat-total-premium").textContent = premiumCount;
    document.getElementById("stat-pending-withdraw").textContent = pendingWithdraw;
}

// ===== DASHBOARD =====
function renderDashboard() {
    const users = getUsers();
    const usernames = Object.keys(users);
    let totalCoins = 0;
    let premiumCount = 0;
    let totalPaid = 0;
    const pendingList = [];

    usernames.forEach(u => {
        const d = users[u].data || {};
        totalCoins += d.coins || 0;
        if (d.premium) premiumCount++;
        (d.withdrawHistory || []).forEach(w => {
            if (w.status === "Completed") totalPaid += parseInt(w.pkr || 0);
            if (w.status === "Pending") pendingList.push({ ...w, username: u });
        });
    });

    document.getElementById("dash-total-users").textContent = usernames.length;
    document.getElementById("dash-total-coins").textContent = formatNum(totalCoins);
    document.getElementById("dash-premium-users").textContent = premiumCount;
    document.getElementById("dash-total-paid").textContent = formatNum(totalPaid) + " PKR";

    // Pending list
    const pendingContainer = document.getElementById("dash-pending-list");
    if (pendingList.length === 0) {
        pendingContainer.innerHTML = '<p class="text-xs text-slate-500 text-center py-4">Koi pending withdrawal nahi</p>';
    } else {
        pendingContainer.innerHTML = pendingList.slice(0, 5).map(w => `
            <div class="flex items-center justify-between bg-slate-800/60 p-3 rounded-xl">
                <div>
                    <p class="text-xs font-black text-white">${w.username}</p>
                    <p class="text-[10px] text-slate-400">${w.pkr} PKR • ${w.method}</p>
                </div>
                <span class="text-[10px] font-black bg-amber-500/20 text-amber-400 px-2 py-1 rounded-full">PENDING</span>
            </div>
        `).join("");
    }

    // Recent users
    const recentContainer = document.getElementById("dash-recent-users");
    const recent = usernames.slice(-5).reverse();
    if (recent.length === 0) {
        recentContainer.innerHTML = '<p class="text-xs text-slate-500 text-center py-4">Koi user nahi</p>';
    } else {
        recentContainer.innerHTML = recent.map(u => {
            const d = users[u].data || {};
            return `
                <div class="flex items-center justify-between bg-slate-800/60 p-3 rounded-xl">
                    <div class="flex items-center gap-2">
                        <span class="text-xl">${d.avatar || "🚀"}</span>
                        <div>
                            <p class="text-xs font-black text-white">${u}</p>
                            <p class="text-[10px] text-slate-400">${formatNum(d.coins || 0)} coins</p>
                        </div>
                    </div>
                    ${d.premium ? '<span class="text-[10px] font-black bg-purple-500/20 text-purple-400 px-2 py-1 rounded-full">👑 PREMIUM</span>' : ''}
                </div>
            `;
        }).join("");
    }
}

// ===== USERS =====
function renderUsers() {
    const users = getUsers();
    const search = (document.getElementById("user-search")?.value || "").toLowerCase();
    const container = document.getElementById("users-list");
    if (!container) return;

    let usernames = Object.keys(users);
    if (search) usernames = usernames.filter(u => u.toLowerCase().includes(search));

    if (usernames.length === 0) {
        container.innerHTML = '<p class="text-xs text-slate-500 text-center py-8">Koi user nahi mila</p>';
        return;
    }

    container.innerHTML = usernames.map(u => {
        const d = users[u].data || {};
        const pkrVal = ((d.coins || 0) / COINS_PER_PKR).toFixed(2);
        const banned = d.banned;
        const premium = d.premium;
        const botLvl = d.autobotLevel || 0;

        return `
            <div class="bg-slate-900/80 border ${banned ? "border-rose-500/40" : "border-slate-800"} rounded-2xl p-4">
                <div class="flex items-center justify-between gap-3 flex-wrap">
                    <div class="flex items-center gap-3">
                        <div class="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-2xl">${d.avatar || "🚀"}</div>
                        <div>
                            <div class="flex items-center gap-2 flex-wrap">
                                <p class="font-black text-white">${u}</p>
                                ${premium ? '<span class="text-[9px] font-black bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full">👑 PREMIUM</span>' : ''}
                                ${banned ? '<span class="text-[9px] font-black bg-rose-500/20 text-rose-400 px-2 py-0.5 rounded-full">🚫 BANNED</span>' : ''}
                                ${botLvl > 0 ? `<span class="text-[9px] font-black bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">🤖 L${botLvl}</span>` : ''}
                            </div>
                            <p class="text-[10px] text-slate-400 mt-1">Taps: ${formatNum(d.totalTaps || 0)} • Refs: ${d.referrals || 0} • Level: ${d.level || 1}</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <p class="text-lg font-black text-yellow-400">${formatNum(d.coins || 0)}</p>
                        <p class="text-[10px] text-emerald-400 font-bold">≈ ${pkrVal} PKR</p>
                    </div>
                </div>
                <div class="flex gap-2 mt-3 flex-wrap">
                    <button onclick="openCoinsModal('${u}')" class="flex-1 min-w-[100px] bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/40 text-yellow-400 font-black py-2 rounded-xl text-xs">
                        <i class="fa-solid fa-coins"></i> Edit Coins
                    </button>
                    <button onclick="toggleBan('${u}')" class="flex-1 min-w-[100px] ${banned ? "bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-500/40 text-emerald-400" : "bg-rose-500/20 hover:bg-rose-500/30 border-rose-500/40 text-rose-400"} border font-black py-2 rounded-xl text-xs">
                        <i class="fa-solid fa-${banned ? "unlock" : "ban"}"></i> ${banned ? "Unban" : "Ban"}
                    </button>
                    ${premium ? `
                        <button onclick="removePremium('${u}')" class="flex-1 min-w-[100px] bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 text-purple-400 font-black py-2 rounded-xl text-xs">
                            <i class="fa-solid fa-crown"></i> Remove Premium
                        </button>
                    ` : `
                        <button onclick="quickPremium('${u}')" class="flex-1 min-w-[100px] bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 text-purple-400 font-black py-2 rounded-xl text-xs">
                            <i class="fa-solid fa-crown"></i> Give Premium
                        </button>
                    `}
                    <button onclick="viewUserDetail('${u}')" class="flex-1 min-w-[100px] bg-slate-700/50 hover:bg-slate-700 border border-slate-700 text-slate-300 font-black py-2 rounded-xl text-xs">
                        <i class="fa-solid fa-eye"></i> Details
                    </button>
                    <button onclick="deleteUser('${u}')" class="flex-1 min-w-[100px] bg-rose-600/20 hover:bg-rose-600/30 border border-rose-600/40 text-rose-400 font-black py-2 rounded-xl text-xs">
                        <i class="fa-solid fa-trash"></i> Delete
                    </button>
                </div>
            </div>
        `;
    }).join("");
}

// ===== WITHDRAWALS =====
function filterWithdrawals(filter) {
    currentWithdrawFilter = filter;
    document.querySelectorAll(".wd-filter").forEach(b => b.classList.toggle("active", b.dataset.filter === filter));
    renderWithdrawals();
}

function renderWithdrawals() {
    const users = getUsers();
    const container = document.getElementById("withdrawals-list");
    if (!container) return;

    // Saare withdrawals collect karo
    const allWithdrawals = [];
    Object.keys(users).forEach(u => {
        const history = users[u].data?.withdrawHistory || [];
        history.forEach(w => {
            allWithdrawals.push({ ...w, username: u });
        });
    });

    allWithdrawals.sort((a, b) => (b.time || 0) - (a.time || 0));

    const filtered = currentWithdrawFilter === "all"
        ? allWithdrawals
        : allWithdrawals.filter(w => w.status === currentWithdrawFilter);

    if (filtered.length === 0) {
        container.innerHTML = '<p class="text-xs text-slate-500 text-center py-8">Koi withdrawal nahi</p>';
        return;
    }

    container.innerHTML = filtered.map(w => {
        const statusColor = w.status === "Completed" ? "emerald" : w.status === "Rejected" ? "rose" : "amber";
        const statusIcon = w.status === "Completed" ? "check-circle" : w.status === "Rejected" ? "times-circle" : "clock";
        return `
            <div class="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
                <div class="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                        <p class="font-black text-white">${w.username}</p>
                        <p class="text-[10px] text-slate-400">${formatDate(w.time)}</p>
                    </div>
                    <span class="bg-${statusColor}-500/20 text-${statusColor}-400 border border-${statusColor}-500/40 px-3 py-1 rounded-full text-[10px] font-black">
                        <i class="fa-solid fa-${statusIcon}"></i> ${w.status}
                    </span>
                </div>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 text-xs">
                    <div class="bg-slate-800/60 p-2 rounded-lg">
                        <p class="text-[10px] text-slate-400">Amount</p>
                        <p class="font-black text-emerald-400">${w.pkr} PKR</p>
                    </div>
                    <div class="bg-slate-800/60 p-2 rounded-lg">
                        <p class="text-[10px] text-slate-400">Method</p>
                        <p class="font-black text-cyan-400">${w.method}</p>
                    </div>
                    <div class="bg-slate-800/60 p-2 rounded-lg">
                        <p class="text-[10px] text-slate-400">Account</p>
                        <p class="font-black text-white text-[11px]">${w.number}</p>
                    </div>
                    <div class="bg-slate-800/60 p-2 rounded-lg">
                        <p class="text-[10px] text-slate-400">Name</p>
                        <p class="font-black text-white text-[11px]">${w.name}</p>
                    </div>
                </div>
                ${w.status === "Pending" ? `
                    <div class="flex gap-2 mt-3">
                        <button onclick="approveWithdraw('${w.username}', '${w.id}')" class="flex-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-2 rounded-xl text-xs">
                            <i class="fa-solid fa-check"></i> APPROVE
                        </button>
                        <button onclick="rejectWithdraw('${w.username}', '${w.id}')" class="flex-1 bg-rose-500 hover:bg-rose-400 text-white font-black py-2 rounded-xl text-xs">
                            <i class="fa-solid fa-times"></i> REJECT
                        </button>
                    </div>
                ` : ""}
            </div>
        `;
    }).join("");
}

function approveWithdraw(username, withdrawId) {
    const users = getUsers();
    if (!users[username]) return showToast("User not found!", "error");

    const w = users[username].data.withdrawHistory.find(x => x.id === withdrawId);
    if (!w) return showToast("Withdrawal not found!", "error");

    w.status = "Completed";

    // Notification
    if (!users[username].data.notifications) users[username].data.notifications = [];
    users[username].data.notifications.unshift({
        text: `💸 Withdrawal ${w.pkr} PKR approved!`,
        time: Date.now(),
        read: false
    });

    saveUsers(users);
    showToast(`✅ ${username} ka withdrawal approve!`, "success");
    loadAllData();
}

function rejectWithdraw(username, withdrawId) {
    showConfirm(
        "Reject Withdrawal",
        `${username} ka ${withdrawId} reject karna hai? Coins wapas ho jayenge.`,
        () => {
            const users = getUsers();
            if (!users[username]) return;

            const w = users[username].data.withdrawHistory.find(x => x.id === withdrawId);
            if (!w) return;

            w.status = "Rejected";

            // Coins refund
            const coinsToRefund = (w.pkr || 0) * COINS_PER_PKR;
            users[username].data.coins = (users[username].data.coins || 0) + coinsToRefund;

            // Notification
            if (!users[username].data.notifications) users[username].data.notifications = [];
            users[username].data.notifications.unshift({
                text: `❌ Withdrawal ${w.pkr} PKR rejected. ${formatNum(coinsToRefund)} coins refunded.`,
                time: Date.now(),
                read: false
            });

            saveUsers(users);
            showToast(`❌ Rejected & ${formatNum(coinsToRefund)} coins refunded`, "warning");
            loadAllData();
        }
    );
}

// ===== PREMIUM =====
function renderPremiumList() {
    const users = getUsers();
    const container = document.getElementById("premium-list");
    if (!container) return;

    const premiumUsers = Object.keys(users).filter(u => users[u].data?.premium);

    if (premiumUsers.length === 0) {
        container.innerHTML = '<p class="text-xs text-slate-500 text-center py-4">Koi premium member nahi</p>';
        return;
    }

    container.innerHTML = premiumUsers.map(u => {
        const d = users[u].data;
        const daysLeft = Math.max(0, Math.ceil((d.premiumUntil - Date.now()) / (1000 * 60 * 60 * 24)));
        return `
            <div class="flex items-center justify-between bg-slate-800/60 p-3 rounded-xl">
                <div class="flex items-center gap-2">
                    <span class="text-xl">${d.avatar || "🚀"}</span>
                    <div>
                        <p class="text-xs font-black text-white">${u}</p>
                        <p class="text-[10px] text-purple-400">${daysLeft} days left</p>
                    </div>
                </div>
                <button onclick="removePremium('${u}')" class="bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-400 text-[10px] font-black px-3 py-1.5 rounded-lg">
                    Remove
                </button>
            </div>
        `;
    }).join("");
}

function adminActivatePremium() {
    const username = document.getElementById("premium-username").value.trim();
    const days = parseInt(document.getElementById("premium-days").value);

    if (!username) return showToast("Username daalo!", "warning");

    const users = getUsers();
    if (!users[username]) return showToast("User not found!", "error");

    users[username].data.premium = true;
    users[username].data.premiumUntil = Date.now() + (days * 24 * 60 * 60 * 1000);

    if (!users[username].data.purchasedFeatures) users[username].data.purchasedFeatures = [];
    if (!users[username].data.purchasedFeatures.includes("premium")) {
        users[username].data.purchasedFeatures.push("premium");
    }

    if (!users[username].data.notifications) users[username].data.notifications = [];
    users[username].data.notifications.unshift({
        text: `👑 Premium activated for ${days} days!`,
        time: Date.now(),
        read: false
    });

    saveUsers(users);
    document.getElementById("premium-username").value = "";
    showToast(`👑 ${username} ko Premium diya (${days} days)!`, "success");
    loadAllData();
}

function quickPremium(username) {
    const users = getUsers();
    if (!users[username]) return;

    users[username].data.premium = true;
    users[username].data.premiumUntil = Date.now() + (30 * 24 * 60 * 60 * 1000);

    if (!users[username].data.purchasedFeatures) users[username].data.purchasedFeatures = [];
    if (!users[username].data.purchasedFeatures.includes("premium")) {
        users[username].data.purchasedFeatures.push("premium");
    }

    if (!users[username].data.notifications) users[username].data.notifications = [];
    users[username].data.notifications.unshift({
        text: `👑 Premium activated for 30 days!`,
        time: Date.now(),
        read: false
    });

    saveUsers(users);
    showToast(`👑 ${username} ko Premium diya!`, "success");
    loadAllData();
}

function removePremium(username) {
    showConfirm("Remove Premium", `${username} ka premium hatana hai?`, () => {
        const users = getUsers();
        if (!users[username]) return;

        users[username].data.premium = false;
        users[username].data.premiumUntil = 0;
        users[username].data.purchasedFeatures = (users[username].data.purchasedFeatures || []).filter(f => f !== "premium");

        if (!users[username].data.notifications) users[username].data.notifications = [];
        users[username].data.notifications.unshift({
            text: `❌ Premium removed by admin.`,
            time: Date.now(),
            read: false
        });

        saveUsers(users);
        showToast(`Premium removed from ${username}`, "warning");
        loadAllData();
    });
}

// ===== UPGRADES =====
function renderUpgradesList() {
    const users = getUsers();
    const container = document.getElementById("upgrades-list");
    if (!container) return;

    const upgradedUsers = Object.keys(users).filter(u => (users[u].data?.autobotLevel || 0) > 0);

    if (upgradedUsers.length === 0) {
        container.innerHTML = '<p class="text-xs text-slate-500 text-center py-4">Koi upgraded user nahi</p>';
        return;
    }

    container.innerHTML = upgradedUsers.map(u => {
        const d = users[u].data;
        return `
            <div class="flex items-center justify-between bg-slate-800/60 p-3 rounded-xl">
                <div class="flex items-center gap-2">
                    <span class="text-xl">${d.avatar || "🚀"}</span>
                    <div>
                        <p class="text-xs font-black text-white">${u}</p>
                        <p class="text-[10px] text-emerald-400">Auto-Bot Level ${d.autobotLevel}</p>
                    </div>
                </div>
                <button onclick="removeUpgrade('${u}')" class="bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-400 text-[10px] font-black px-3 py-1.5 rounded-lg">
                    Remove
                </button>
            </div>
        `;
    }).join("");
}

function adminUnlockUpgrade() {
    const username = document.getElementById("upgrade-username").value.trim();
    const level = parseInt(document.getElementById("upgrade-level").value);

    if (!username) return showToast("Username daalo!", "warning");

    const users = getUsers();
    if (!users[username]) return showToast("User not found!", "error");

    const key = `autobot-level-${level}`;
    if (!users[username].data.purchasedFeatures) users[username].data.purchasedFeatures = [];
    if (!users[username].data.purchasedFeatures.includes(key)) {
        users[username].data.purchasedFeatures.push(key);
    }

    users[username].data.autobotLevel = Math.max(users[username].data.autobotLevel || 0, level);

    if (!users[username].data.notifications) users[username].data.notifications = [];
    users[username].data.notifications.unshift({
        text: `✅ Auto-Bot Level ${level} unlocked! ${level * 10} coins/sec`,
        time: Date.now(),
        read: false
    });

    saveUsers(users);
    document.getElementById("upgrade-username").value = "";
    showToast(`✅ ${username} ko Level ${level} diya!`, "success");
    loadAllData();
}

function removeUpgrade(username) {
    showConfirm("Remove Upgrade", `${username} ka Auto-Bot hatana hai?`, () => {
        const users = getUsers();
        if (!users[username]) return;

        users[username].data.autobotLevel = 0;
        users[username].data.purchasedFeatures = (users[username].data.purchasedFeatures || []).filter(f => !f.startsWith("autobot-level-"));

        saveUsers(users);
        showToast(`Upgrade removed from ${username}`, "warning");
        loadAllData();
    });
}

// ===== ANNOUNCEMENTS =====
let announcements = [];

function renderAnnouncements() {
    const container = document.getElementById("announcements-list");
    if (!container) return;

    announcements = JSON.parse(localStorage.getItem("ohoo_tap_announcements") || "[]");

    if (announcements.length === 0) {
        container.innerHTML = '<p class="text-xs text-slate-500 text-center py-4">Koi announcement nahi</p>';
        return;
    }

    container.innerHTML = announcements.slice(0, 10).map(a => `
        <div class="bg-slate-800/60 p-3 rounded-xl">
            <p class="text-xs text-white">${a.text}</p>
            <p class="text-[10px] text-slate-500 mt-1">${formatDate(a.time)} • ${a.sentTo} users</p>
        </div>
    `).join("");
}

function sendAnnouncement() {
    const text = document.getElementById("announcement-text").value.trim();
    if (!text) return showToast("Announcement likho!", "warning");

    const users = getUsers();
    const usernames = Object.keys(users);

    usernames.forEach(u => {
        if (!users[u].data.notifications) users[u].data.notifications = [];
        users[u].data.notifications.unshift({
            text: `📢 ${text}`,
            time: Date.now(),
            read: false
        });
    });

    saveUsers(users);

    announcements.unshift({ text, time: Date.now(), sentTo: usernames.length });
    localStorage.setItem("ohoo_tap_announcements", JSON.stringify(announcements));

    document.getElementById("announcement-text").value = "";
    showToast(`📢 Announcement sent to ${usernames.length} users!`, "success");
    renderAnnouncements();
}

// ===== SETTINGS =====
function loadSettings() {
    const config = JSON.parse(localStorage.getItem(ADMIN_CONFIG_KEY) || "{}");
    document.getElementById("setting-coins-rate").value = config.coinsPerPkr || 4500;
    document.getElementById("setting-min-withdraw").value = config.minWithdraw || 200;
    document.getElementById("setting-premium-price").value = config.premiumPrice || 500;
}

function saveSettings() {
    const config = {
        coinsPerPkr: parseInt(document.getElementById("setting-coins-rate").value) || 4500,
        minWithdraw: parseInt(document.getElementById("setting-min-withdraw").value) || 200,
        premiumPrice: parseInt(document.getElementById("setting-premium-price").value) || 500
    };
    localStorage.setItem(ADMIN_CONFIG_KEY, JSON.stringify(config));
    showToast("Settings saved!", "success");
}

// ===== DANGER ZONE =====
function exportData() {
    const users = getUsers();
    const data = JSON.stringify(users, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ohoo_tap_users_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Data exported!", "success");
}

function importData() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                localStorage.setItem(USERS_KEY, JSON.stringify(data));
                showToast("Data imported!", "success");
                loadAllData();
            } catch (err) {
                showToast("Invalid file!", "error");
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

function seedSampleData() {
    showConfirm("Seed Sample Data", "Test data add karna hai? (Purana data overwrite hoga)", () => {
        const sample = {
            "AliRaza_Pro": {
                password: btoa("test123"),
                data: {
                    username: "AliRaza_Pro", avatar: "🚀", coins: 520000,
                    premium: false, banned: false, autobotLevel: 2,
                    totalTaps: 5200, referrals: 3, level: 2,
                    withdrawHistory: [{
                        id: "W" + Date.now(), pkr: 100, method: "Easypaisa",
                        name: "Ali Raza", number: "03001234567", status: "Pending",
                        time: Date.now(), eta: "24 hour(s)"
                    }],
                    notifications: []
                }
            },
            "HamzaTapper": {
                password: btoa("test123"),
                data: {
                    username: "HamzaTapper", avatar: "👾", coins: 980000,
                    premium: true, premiumUntil: Date.now() + 30 * 24 * 60 * 60 * 1000,
                    banned: false, autobotLevel: 5, totalTaps: 9800, referrals: 12, level: 3,
                    withdrawHistory: [{
                        id: "W" + (Date.now() - 1000), pkr: 200, method: "JazzCash",
                        name: "Hamza Khan", number: "03129876543", status: "Completed",
                        time: Date.now() - 86400000, eta: "1 hour(s)"
                    }],
                    notifications: []
                }
            },
            "CheatBot_007": {
                password: btoa("test123"),
                data: {
                    username: "CheatBot_007", avatar: "🤖", coins: 8500000,
                    premium: false, banned: true, autobotLevel: 0,
                    totalTaps: 999999, referrals: 0, level: 50,
                    withdrawHistory: [], notifications: []
                }
            }
        };
        localStorage.setItem(USERS_KEY, JSON.stringify(sample));
        showToast("Sample data added!", "success");
        loadAllData();
    });
}

function resetAllData() {
    showConfirm("⚠️ RESET ALL", "SAARE users delete ho jayenge! Pakka?", () => {
        localStorage.removeItem(USERS_KEY);
        localStorage.removeItem("ohoo_tap_announcements");
        showToast("All data reset!", "warning");
        loadAllData();
    });
}

// ===== USER ACTIONS =====
function openCoinsModal(username) {
    const users = getUsers();
    if (!users[username]) return;
    currentEditingUser = username;
    document.getElementById("coins-modal-user").textContent = `User: ${username}`;
    document.getElementById("coins-modal-input").value = users[username].data.coins || 0;
    document.getElementById("coins-modal").classList.remove("hidden");
}

function closeCoinsModal() {
    document.getElementById("coins-modal").classList.add("hidden");
    currentEditingUser = null;
}

function saveUserCoins() {
    if (!currentEditingUser) return;
    const newCoins = parseInt(document.getElementById("coins-modal-input").value) || 0;
    const users = getUsers();
    if (users[currentEditingUser]) {
        users[currentEditingUser].data.coins = newCoins;
        saveUsers(users);
        showToast(`Coins updated to ${formatNum(newCoins)}`, "success");
    }
    closeCoinsModal();
    loadAllData();
}

function toggleBan(username) {
    const users = getUsers();
    if (!users[username]) return;
    const banned = !users[username].data.banned;
    users[username].data.banned = banned;

    if (!users[username].data.notifications) users[username].data.notifications = [];
    users[username].data.notifications.unshift({
        text: banned ? "🚫 Your account has been banned by admin." : "✅ Your account has been unbanned!",
        time: Date.now(),
        read: false
    });

    saveUsers(users);
    showToast(banned ? `${username} banned!` : `${username} unbanned!`, banned ? "warning" : "success");
    loadAllData();
}

function viewUserDetail(username) {
    const users = getUsers();
    if (!users[username]) return;
    const d = users[username].data;
    const pkrVal = ((d.coins || 0) / COINS_PER_PKR).toFixed(2);

    document.getElementById("user-detail-content").innerHTML = `
        <div class="bg-slate-800/60 p-4 rounded-xl text-center">
            <div class="text-5xl mb-2">${d.avatar || "🚀"}</div>
            <p class="font-black text-lg text-white">${username}</p>
            ${d.bio ? `<p class="text-xs text-slate-400 mt-1">${d.bio}</p>` : ""}
        </div>
        <div class="grid grid-cols-2 gap-2 text-xs">
            <div class="bg-slate-800/60 p-3 rounded-lg"><p class="text-slate-400 text-[10px]">Coins</p><p class="font-black text-yellow-400">${formatNum(d.coins || 0)}</p></div>
            <div class="bg-slate-800/60 p-3 rounded-lg"><p class="text-slate-400 text-[10px]">PKR Value</p><p class="font-black text-emerald-400">${pkrVal}</p></div>
            <div class="bg-slate-800/60 p-3 rounded-lg"><p class="text-slate-400 text-[10px]">Level</p><p class="font-black text-purple-400">${d.level || 1}</p></div>
            <div class="bg-slate-800/60 p-3 rounded-lg"><p class="text-slate-400 text-[10px]">Total Taps</p><p class="font-black text-cyan-400">${formatNum(d.totalTaps || 0)}</p></div>
            <div class="bg-slate-800/60 p-3 rounded-lg"><p class="text-slate-400 text-[10px]">Referrals</p><p class="font-black text-pink-400">${d.referrals || 0}</p></div>
            <div class="bg-slate-800/60 p-3 rounded-lg"><p class="text-slate-400 text-[10px]">Auto-Bot Level</p><p class="font-black text-emerald-400">${d.autobotLevel || 0}</p></div>
        </div>
        <div class="bg-slate-800/60 p-3 rounded-lg text-xs">
            <p class="text-slate-400 text-[10px] mb-1">Referral Code</p>
            <p class="font-black text-cyan-400">${d.referralCode || "N/A"}</p>
        </div>
        <div class="bg-slate-800/60 p-3 rounded-lg text-xs">
            <p class="text-slate-400 text-[10px] mb-2">Recent Withdrawals (${(d.withdrawHistory || []).length})</p>
            ${(d.withdrawHistory || []).slice(0, 5).map(w => `
                <div class="flex justify-between items-center py-1 border-b border-slate-700/40 last:border-0">
                    <span class="text-[10px] text-slate-300">${w.pkr} PKR - ${w.method}</span>
                    <span class="text-[10px] font-black ${w.status === "Completed" ? "text-emerald-400" : w.status === "Rejected" ? "text-rose-400" : "text-amber-400"}">${w.status}</span>
                </div>
            `).join("") || '<p class="text-[10px] text-slate-500">Koi withdrawal nahi</p>'}
        </div>
    `;
    document.getElementById("user-detail-modal").classList.remove("hidden");
}

function closeUserDetail() {
    document.getElementById("user-detail-modal").classList.add("hidden");
}

function deleteUser(username) {
    showConfirm("Delete User", `${username} ko permanently delete karna hai?`, () => {
        const users = getUsers();
        delete users[username];
        saveUsers(users);
        showToast(`${username} deleted!`, "warning");
        loadAllData();
    });
}

// ===== CONFIRM MODAL =====
function showConfirm(title, message, callback) {
    document.getElementById("confirm-title").textContent = title;
    document.getElementById("confirm-message").textContent = message;
    document.getElementById("confirm-modal").classList.remove("hidden");
    confirmCallback = callback;
}

function confirmYes() {
    document.getElementById("confirm-modal").classList.add("hidden");
    if (confirmCallback) confirmCallback();
    confirmCallback = null;
}

function confirmNo() {
    document.getElementById("confirm-modal").classList.add("hidden");
    confirmCallback = null;
}

// ===== TOAST =====
function showToast(msg, type = "info") {
    const colors = {
        success: "bg-emerald-500 text-white",
        error: "bg-rose-500 text-white",
        warning: "bg-amber-500 text-slate-950",
        info: "bg-cyan-500 text-slate-950"
    };
    const icons = {
        success: "fa-check-circle",
        error: "fa-exclamation-circle",
        warning: "fa-triangle-exclamation",
        info: "fa-info-circle"
    };
    const container = document.getElementById("toast-container");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = `toast-item ${colors[type]} px-4 py-3 rounded-xl shadow-2xl font-bold text-sm flex items-center gap-2`;
    toast.innerHTML = `<i class="fa-solid ${icons[type]}"></i> ${msg}`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = "0";
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}