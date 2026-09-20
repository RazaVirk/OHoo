/* ===== OHOO TAP - ADMIN.JS ===== */
/* Firebase Firestore Connected */

const ADMIN_KEY = "ohoo_tap_admin";
const ADMIN_CONFIG_KEY = "ohoo_tap_admin_config";
const ADMIN_CREDENTIALS = { username: "admin", password: "admin123" };
const COINS_PER_PKR = 4500;

let currentWithdrawFilter = "all";
let currentEditingUser = null;
let confirmCallback = null;
let cachedUsers = {};

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

// ===== HELPERS =====
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

// ===== FIRESTORE HELPERS =====
async function fetchAllUsers() {
    if (!window.FB) {
        console.error("Firebase not loaded!");
        return {};
    }
    try {
        const snapshot = await window.FB.getDocs(window.FB.collection(window.FB.db, "users"));
        const users = {};
        snapshot.forEach(doc => {
            const data = doc.data();
            users[data.username || doc.id] = {
                uid: doc.id,
                data: data
            };
        });
        cachedUsers = users;
        return users;
    } catch (err) {
        console.error("Fetch error:", err);
        showToast("Data fetch nahi hua!", "error");
        return {};
    }
}

async function updateUserInFirestore(uid, updates) {
    if (!window.FB) return false;
    try {
        await window.FB.updateDoc(window.FB.doc(window.FB.db, "users", uid), updates);
        return true;
    } catch (err) {
        console.error("Update error:", err);
        showToast("Update failed!", "error");
        return false;
    }
}

async function deleteUserFromFirestore(uid) {
    if (!window.FB) return false;
    try {
        await window.FB.deleteDoc(window.FB.doc(window.FB.db, "users", uid));
        return true;
    } catch (err) {
        console.error("Delete error:", err);
        return false;
    }
}

// ===== LOAD ALL =====
async function loadAllData() {
    showToast("Loading data...", "info");
    await fetchAllUsers();
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
}

// ===== HEADER STATS =====
function updateHeaderStats() {
    const usernames = Object.keys(cachedUsers);
    let totalCoins = 0;
    let premiumCount = 0;
    let pendingWithdraw = 0;

    usernames.forEach(u => {
        const d = cachedUsers[u].data || {};
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
    const usernames = Object.keys(cachedUsers);
    let totalCoins = 0;
    let premiumCount = 0;
    let totalPaid = 0;
    const pendingList = [];

    usernames.forEach(u => {
        const d = cachedUsers[u].data || {};
        totalCoins += d.coins || 0;
        if (d.premium) premiumCount++;
        (d.withdrawHistory || []).forEach(w => {
            if (w.status === "Completed") totalPaid += parseInt(w.pkr || 0);
            if (w.status === "Pending") pendingList.push({ ...w, username: u });
        });
    });

    const el1 = document.getElementById("dash-total-users");
    const el2 = document.getElementById("dash-total-coins");
    const el3 = document.getElementById("dash-premium-users");
    const el4 = document.getElementById("dash-total-paid");
    if (el1) el1.textContent = usernames.length;
    if (el2) el2.textContent = formatNum(totalCoins);
    if (el3) el3.textContent = premiumCount;
    if (el4) el4.textContent = formatNum(totalPaid) + " PKR";

    const pendingContainer = document.getElementById("dash-pending-list");
    if (pendingContainer) {
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
    }

    const recentContainer = document.getElementById("dash-recent-users");
    if (recentContainer) {
        const recent = usernames.slice(-5).reverse();
        if (recent.length === 0) {
            recentContainer.innerHTML = '<p class="text-xs text-slate-500 text-center py-4">Koi user nahi</p>';
        } else {
            recentContainer.innerHTML = recent.map(u => {
                const d = cachedUsers[u].data || {};
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
}

// ===== USERS =====
function renderUsers() {
    const searchInput = document.getElementById("user-search");
    const search = (searchInput?.value || "").toLowerCase();
    const container = document.getElementById("users-list");
    if (!container) return;

    let usernames = Object.keys(cachedUsers);
    if (search) usernames = usernames.filter(u => u.toLowerCase().includes(search));

    if (usernames.length === 0) {
        container.innerHTML = '<p class="text-xs text-slate-500 text-center py-8">Koi user nahi mila</p>';
        return;
    }

    container.innerHTML = usernames.map(u => {
        const d = cachedUsers[u].data || {};
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
    const container = document.getElementById("withdrawals-list");
    if (!container) return;

    const allWithdrawals = [];
    Object.keys(cachedUsers).forEach(u => {
        const history = cachedUsers[u].data?.withdrawHistory || [];
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

async function approveWithdraw(username, withdrawId) {
    const user = cachedUsers[username];
    if (!user) return showToast("User not found!", "error");

    const w = (user.data.withdrawHistory || []).find(x => x.id === withdrawId);
    if (!w) return showToast("Withdrawal not found!", "error");

    const history = user.data.withdrawHistory.map(x =>
        x.id === withdrawId ? { ...x, status: "Completed" } : x
    );

    const notifications = [
        { text: `💸 Withdrawal ${w.pkr} PKR approved!`, time: Date.now(), read: false },
        ...(user.data.notifications || [])
    ];

    const success = await updateUserInFirestore(user.uid, {
        withdrawHistory: history,
        notifications
    });

    if (success) {
        showToast(`✅ ${username} ka withdrawal approve!`, "success");
        await fetchAllUsers();
        updateHeaderStats();
        renderDashboard();
        renderWithdrawals();
        renderUsers();
    }
}

function rejectWithdraw(username, withdrawId) {
    showConfirm(
        "Reject Withdrawal",
        `${username} ka ${withdrawId} reject karna hai? Coins wapas ho jayenge.`,
        async () => {
            const user = cachedUsers[username];
            if (!user) return;

            const w = (user.data.withdrawHistory || []).find(x => x.id === withdrawId);
            if (!w) return;

            const coinsToRefund = (w.pkr || 0) * COINS_PER_PKR;

            const history = user.data.withdrawHistory.map(x =>
                x.id === withdrawId ? { ...x, status: "Rejected" } : x
            );

            const notifications = [
                { text: `❌ Withdrawal ${w.pkr} PKR rejected. ${formatNum(coinsToRefund)} coins refunded.`, time: Date.now(), read: false },
                ...(user.data.notifications || [])
            ];

            const success = await updateUserInFirestore(user.uid, {
                withdrawHistory: history,
                coins: (user.data.coins || 0) + coinsToRefund,
                notifications
            });

            if (success) {
                showToast(`❌ Rejected & ${formatNum(coinsToRefund)} coins refunded`, "warning");
                await fetchAllUsers();
                updateHeaderStats();
                renderDashboard();
                renderWithdrawals();
                renderUsers();
            }
        }
    );
}

// ===== PREMIUM =====
function renderPremiumList() {
    const container = document.getElementById("premium-list");
    if (!container) return;

    const premiumUsers = Object.keys(cachedUsers).filter(u => cachedUsers[u].data?.premium);

    if (premiumUsers.length === 0) {
        container.innerHTML = '<p class="text-xs text-slate-500 text-center py-4">Koi premium member nahi</p>';
        return;
    }

    container.innerHTML = premiumUsers.map(u => {
        const d = cachedUsers[u].data;
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

async function adminActivatePremium() {
    const username = document.getElementById("premium-username").value.trim();
    const days = parseInt(document.getElementById("premium-days").value);

    if (!username) return showToast("Username daalo!", "warning");

    const user = cachedUsers[username];
    if (!user) return showToast("User not found!", "error");

    const purchasedFeatures = user.data.purchasedFeatures || [];
    if (!purchasedFeatures.includes("premium")) purchasedFeatures.push("premium");

    const notifications = [
        { text: `👑 Premium activated for ${days} days!`, time: Date.now(), read: false },
        ...(user.data.notifications || [])
    ];

    const success = await updateUserInFirestore(user.uid, {
        premium: true,
        premiumUntil: Date.now() + (days * 24 * 60 * 60 * 1000),
        purchasedFeatures,
        notifications
    });

    if (success) {
        document.getElementById("premium-username").value = "";
        showToast(`👑 ${username} ko Premium diya (${days} days)!`, "success");
        await fetchAllUsers();
        updateHeaderStats();
        renderDashboard();
        renderPremiumList();
        renderUsers();
    }
}

async function quickPremium(username) {
    const user = cachedUsers[username];
    if (!user) return;

    const purchasedFeatures = user.data.purchasedFeatures || [];
    if (!purchasedFeatures.includes("premium")) purchasedFeatures.push("premium");

    const notifications = [
        { text: `👑 Premium activated for 30 days!`, time: Date.now(), read: false },
        ...(user.data.notifications || [])
    ];

    const success = await updateUserInFirestore(user.uid, {
        premium: true,
        premiumUntil: Date.now() + (30 * 24 * 60 * 60 * 1000),
        purchasedFeatures,
        notifications
    });

    if (success) {
        showToast(`👑 ${username} ko Premium diya!`, "success");
        await fetchAllUsers();
        updateHeaderStats();
        renderDashboard();
        renderPremiumList();
        renderUsers();
    }
}

function removePremium(username) {
    showConfirm("Remove Premium", `${username} ka premium hatana hai?`, async () => {
        const user = cachedUsers[username];
        if (!user) return;

        const purchasedFeatures = (user.data.purchasedFeatures || []).filter(f => f !== "premium");

        const notifications = [
            { text: `❌ Premium removed by admin.`, time: Date.now(), read: false },
            ...(user.data.notifications || [])
        ];

        const success = await updateUserInFirestore(user.uid, {
            premium: false,
            premiumUntil: 0,
            purchasedFeatures,
            notifications
        });

        if (success) {
            showToast(`Premium removed from ${username}`, "warning");
            await fetchAllUsers();
            updateHeaderStats();
            renderDashboard();
            renderPremiumList();
            renderUsers();
        }
    });
}

// ===== UPGRADES =====
function renderUpgradesList() {
    const container = document.getElementById("upgrades-list");
    if (!container) return;

    const upgradedUsers = Object.keys(cachedUsers).filter(u => (cachedUsers[u].data?.autobotLevel || 0) > 0);

    if (upgradedUsers.length === 0) {
        container.innerHTML = '<p class="text-xs text-slate-500 text-center py-4">Koi upgraded user nahi</p>';
        return;
    }

    container.innerHTML = upgradedUsers.map(u => {
        const d = cachedUsers[u].data;
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

async function adminUnlockUpgrade() {
    const username = document.getElementById("upgrade-username").value.trim();
    const level = parseInt(document.getElementById("upgrade-level").value);

    if (!username) return showToast("Username daalo!", "warning");

    const user = cachedUsers[username];
    if (!user) return showToast("User not found!", "error");

    const key = `autobot-level-${level}`;
    const purchasedFeatures = user.data.purchasedFeatures || [];
    if (!purchasedFeatures.includes(key)) purchasedFeatures.push(key);

    const notifications = [
        { text: `✅ Auto-Bot Level ${level} unlocked! ${level * 10} coins/sec`, time: Date.now(), read: false },
        ...(user.data.notifications || [])
    ];

    const success = await updateUserInFirestore(user.uid, {
        autobotLevel: Math.max(user.data.autobotLevel || 0, level),
        purchasedFeatures,
        notifications
    });

    if (success) {
        document.getElementById("upgrade-username").value = "";
        showToast(`✅ ${username} ko Level ${level} diya!`, "success");
        await fetchAllUsers();
        renderUpgradesList();
        renderUsers();
    }
}

function removeUpgrade(username) {
    showConfirm("Remove Upgrade", `${username} ka Auto-Bot hatana hai?`, async () => {
        const user = cachedUsers[username];
        if (!user) return;

        const purchasedFeatures = (user.data.purchasedFeatures || []).filter(f => !f.startsWith("autobot-level-"));

        const success = await updateUserInFirestore(user.uid, {
            autobotLevel: 0,
            purchasedFeatures
        });

        if (success) {
            showToast(`Upgrade removed from ${username}`, "warning");
            await fetchAllUsers();
            renderUpgradesList();
            renderUsers();
        }
    });
}

// ===== ANNOUNCEMENTS =====
function renderAnnouncements() {
    const container = document.getElementById("announcements-list");
    if (!container) return;

    const announcements = JSON.parse(localStorage.getItem("ohoo_tap_announcements") || "[]");

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

async function sendAnnouncement() {
    const text = document.getElementById("announcement-text").value.trim();
    if (!text) return showToast("Announcement likho!", "warning");

    const usernames = Object.keys(cachedUsers);
    showToast(`Sending to ${usernames.length} users...`, "info");

    let successCount = 0;
    for (const u of usernames) {
        const user = cachedUsers[u];
        const notifications = [
            { text: `📢 ${text}`, time: Date.now(), read: false },
            ...(user.data.notifications || []).slice(0, 19)
        ];
        const ok = await updateUserInFirestore(user.uid, { notifications });
        if (ok) successCount++;
    }

    const announcements = JSON.parse(localStorage.getItem("ohoo_tap_announcements") || "[]");
    announcements.unshift({ text, time: Date.now(), sentTo: successCount });
    localStorage.setItem("ohoo_tap_announcements", JSON.stringify(announcements));

    document.getElementById("announcement-text").value = "";
    showToast(`📢 Sent to ${successCount} users!`, "success");
    await fetchAllUsers();
    renderAnnouncements();
}

// ===== SETTINGS =====
function loadSettings() {
    const config = JSON.parse(localStorage.getItem(ADMIN_CONFIG_KEY) || "{}");
    const rateEl = document.getElementById("setting-coins-rate");
    const minEl = document.getElementById("setting-min-withdraw");
    const premEl = document.getElementById("setting-premium-price");
    if (rateEl) rateEl.value = config.coinsPerPkr || 4500;
    if (minEl) minEl.value = config.minWithdraw || 200;
    if (premEl) premEl.value = config.premiumPrice || 500;
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
    const data = JSON.stringify(cachedUsers, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ohoo_users_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Data exported!", "success");
}

function importData() {
    showToast("Import feature coming soon!", "info");
}

function seedSampleData() {
    showToast("Sample data feature Firebase mein manually karo.", "info");
}

function resetAllData() {
    showConfirm("⚠️ RESET ALL", "SAARE users delete ho jayenge! Pakka?", async () => {
        const usernames = Object.keys(cachedUsers);
        for (const u of usernames) {
            await deleteUserFromFirestore(cachedUsers[u].uid);
        }
        localStorage.removeItem("ohoo_tap_announcements");
        showToast("All users deleted!", "warning");
        await loadAllData();
    });
}

// ===== USER ACTIONS =====
function openCoinsModal(username) {
    const user = cachedUsers[username];
    if (!user) return;
    currentEditingUser = username;
    document.getElementById("coins-modal-user").textContent = `User: ${username}`;
    document.getElementById("coins-modal-input").value = user.data.coins || 0;
    document.getElementById("coins-modal").classList.remove("hidden");
}

function closeCoinsModal() {
    document.getElementById("coins-modal").classList.add("hidden");
    currentEditingUser = null;
}

async function saveUserCoins() {
    if (!currentEditingUser) return;
    const newCoins = parseInt(document.getElementById("coins-modal-input").value) || 0;
    const user = cachedUsers[currentEditingUser];
    if (user) {
        const success = await updateUserInFirestore(user.uid, { coins: newCoins });
        if (success) {
            showToast(`Coins updated to ${formatNum(newCoins)}`, "success");
            await fetchAllUsers();
            updateHeaderStats();
            renderDashboard();
            renderUsers();
        }
    }
    closeCoinsModal();
}

function toggleBan(username) {
    const user = cachedUsers[username];
    if (!user) return;
    const banned = !user.data.banned;

    showConfirm(
        banned ? "Ban User" : "Unban User",
        `${username} ko ${banned ? "ban" : "unban"} karna hai?`,
        async () => {
            const notifications = [
                { text: banned ? "🚫 Your account has been banned by admin." : "✅ Your account has been unbanned!", time: Date.now(), read: false },
                ...(user.data.notifications || [])
            ];
            const success = await updateUserInFirestore(user.uid, { banned, notifications });
            if (success) {
                showToast(banned ? `${username} banned!` : `${username} unbanned!`, banned ? "warning" : "success");
                await fetchAllUsers();
                renderUsers();
            }
        }
    );
}

function viewUserDetail(username) {
    const user = cachedUsers[username];
    if (!user) return;
    const d = user.data;
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
            <div class="bg-slate-800/60 p-3 rounded-lg"><p class="text-slate-400 text-[10px]">Auto-Bot</p><p class="font-black text-emerald-400">${d.autobotLevel || 0}</p></div>
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
    const user = cachedUsers[username];
    if (!user) return;

    showConfirm("Delete User", `${username} ko permanently delete karna hai?`, async () => {
        const success = await deleteUserFromFirestore(user.uid);
        if (success) {
            showToast(`${username} deleted!`, "warning");
            await loadAllData();
        }
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