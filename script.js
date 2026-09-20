/* ===== OHOO TAP - SCRIPT.JS (FINAL) ===== */
/* Firebase Connected | No Duplicates */

// ===== CONSTANTS =====
const COINS_PER_PKR = 4500;
const MIN_WITHDRAW_PKR = 200;
const MAX_WITHDRAW_PKR = 2000;
const MIN_OFFLINE_COINS = 10000;
const MAX_ENERGY = 5000;
const ENERGY_PER_TAP = 1;
const ENERGY_REGEN_PER_SEC = 1;
const PREMIUM_MULTIPLIER = 10;
const BASE_TAP_VALUE = 1;
const COMBO_TIMEOUT = 3000;
const FRENZY_DURATION = 10000;
const PREMIUM_WITHDRAW_HOURS = 1;
const NORMAL_WITHDRAW_HOURS = 24;
const LUCKYBOX_COOLDOWN = 4 * 60 * 60 * 1000;
const AUTOBOT_COINS_PER_LEVEL = 10;
const SPIN_COOLDOWN = 4 * 60 * 60 * 1000;
const SPIN_REWARD = 10000;
const SCRATCH_COOLDOWN = 4 * 60 * 60 * 1000;
const SCRATCH_REWARD = 10000;
const AD_REWARD = 3000;
const AD_DURATION = 60;
const AUTO_AD_COOLDOWN = 5 * 60 * 1000;
const AUTO_AD_DURATION = 5;
const AUTO_AD_REWARD = 1000;

const POWERUP_COSTS = { double: 10000, infinite: 15000, autotap: 20000, megatap: 25000 };
const POWERUP_DURATIONS = { double: 30000, infinite: 60000, autotap: 300000, megatap: 60000 };

// ===== STATE =====
let currentUser = null;
let firebaseUser = null;
let adInterval = null;
let autoAdInterval = null;
let currentChat = "global";
let currentLeaderboard = "coins";
let avatarFilter = "all";
let currentWithdrawFilter = "all";
let currentEditingUser = null;
let confirmCallback = null;
let currentPayment = null;

let gameState = {
    coins: 0, energy: MAX_ENERGY, maxEnergy: MAX_ENERGY,
    taps: 0, totalTaps: 0, level: 1, streak: 1,
    lastLogin: Date.now(), lastOnline: Date.now(),
    username: "", avatar: "🚀", bio: "",
    ownedAvatars: ["🚀", "👾", "🐱", "🦊", "🐼", "🐸"],
    ownedFrames: [], currentFrame: "", tapEffect: "default", ownedTapEffects: ["default"],
    autobotLevel: 0, referrals: 0, activeReferrals: 0, referralEarned: 0,
    referralCode: "", referredBy: null,
    friends: [], clan: null, clanMembers: [], clanScore: 0, clanWins: 0,
    lifetimeCoins: 0, bestCombo: 0, timePlayed: 0,
    dailyStartCoins: 0, lastDailyReset: Date.now(), dailyBonusClaimed: false,
    missionStreak: 0, lastMissionDate: null, missions: [],
    achievements: {}, withdrawHistory: [], levelBonusHistory: [], notifications: [],
    chatMessages: { global: [], clan: [], private: {} },
    luckyBoxLastOpen: 0, luckyBoxHistory: [],
    premium: false, premiumUntil: 0, prestige: 0,
    tournamentJoined: false, tournamentScore: 0,
    purchasedFeatures: [],
    lastSpinTime: 0, lastScratchTime: 0,
    lastAutoAdTime: Date.now(), coinsSinceLastAd: 0,
    adVideosWatched: 0, adTotalEarned: 0,
    banned: false,
    settings: { music: true, sfx: true, theme: "dark" },
    powerUps: {
        double: { active: false, until: 0 },
        infinite: { active: false, until: 0 },
        autotap: { active: false, until: 0 },
        megatap: { active: false, until: 0 }
    },
    combo: { count: 0, lastTap: 0, best: 0, frenzyActive: false, frenzyUntil: 0 },
    scratchPrize: 0,
    battleActive: false, battleMyTaps: 0, battleOppTaps: 0, battleTimer: 30, battleInterval: null
};

// ===== INIT =====
document.addEventListener("DOMContentLoaded", () => {
    loadTheme();
    if (window.FB) {
        window.FB.onAuthStateChanged(window.FB.auth, async (user) => {
            if (user) {
                firebaseUser = user;
                await loadUserFromFirestore(user.uid);
                if (gameState.banned) {
                    alert("🚫 Your account is banned!");
                    await window.FB.signOut(window.FB.auth);
                    return;
                }
                enterGame();
            } else {
                firebaseUser = null;
                currentUser = null;
                document.getElementById("login-screen").classList.remove("hidden");
                document.getElementById("game-container").classList.add("hidden");
            }
        });
    }
    setInterval(gameLoop, 1000);
    setInterval(updateStats, 5000);
    setInterval(() => { updateSpinTimer(); updateScratchTimer(); }, 1000);
});

// ===== FIRESTORE =====
async function loadUserFromFirestore(uid) {
    try {
        const userDoc = await window.FB.getDoc(window.FB.doc(window.FB.db, "users", uid));
        if (userDoc.exists()) {
            const data = userDoc.data();
            gameState = { ...gameState, ...data };
            currentUser = data.username;
        }
    } catch (err) { console.error("Load error:", err); }
}

async function saveUserToFirestore() {
    if (!firebaseUser) return;
    try {
        await window.FB.updateDoc(
            window.FB.doc(window.FB.db, "users", firebaseUser.uid),
            { ...gameState, updatedAt: window.FB.serverTimestamp() }
        );
    } catch (err) { console.error("Save error:", err); }
}

function saveUser() { saveUserToFirestore(); }

// ===== GAME LOOP =====
function gameLoop() {
    if (!currentUser) return;
    if (gameState.energy < gameState.maxEnergy) {
        const regen = gameState.premium ? ENERGY_REGEN_PER_SEC * 2 : ENERGY_REGEN_PER_SEC;
        gameState.energy = Math.min(gameState.maxEnergy, gameState.energy + regen);
    }
    gameState.timePlayed++;
    checkPowerUps();
    if (gameState.combo.count > 0 && Date.now() - gameState.combo.lastTap > COMBO_TIMEOUT) {
        gameState.combo.count = 0;
        updateComboDisplay();
    }
    if (gameState.combo.frenzyActive && Date.now() > gameState.combo.frenzyUntil) {
        gameState.combo.frenzyActive = false;
        const fb = document.getElementById("frenzy-banner");
        if (fb) fb.classList.add("hidden");
    }
    if (gameState.autobotLevel > 0) {
        const botCoins = gameState.autobotLevel * AUTOBOT_COINS_PER_LEVEL;
        const premiumMult = gameState.premium ? PREMIUM_MULTIPLIER : 1;
        addCoins(botCoins * premiumMult, false);
    }
    if (gameState.powerUps.autotap.active) {
        const val = calculateTapValue();
        addCoins(val * 5, false);
    }
    updateLuckyBoxTimer();
    checkMissionReset();
    if (gameState.timePlayed % 5 === 0) checkAutoAd();
    if (gameState.timePlayed % 10 === 0) saveUser();
    updateUI();
}

function checkPowerUps() {
    const now = Date.now();
    Object.keys(gameState.powerUps).forEach(key => {
        const pu = gameState.powerUps[key];
        if (pu.active && now > pu.until) {
            pu.active = false;
            document.querySelector(`.powerup-btn[onclick*="${key}"]`)?.classList.remove("active");
            const el = document.getElementById(`pu-${key}-time`);
            if (el) el.textContent = "";
        } else if (pu.active) {
            const left = Math.ceil((pu.until - now) / 1000);
            const el = document.getElementById(`pu-${key}-time`);
            if (el) el.textContent = `${left}s`;
        }
    });
}

// ===== AUTH =====
async function login() {
    const username = document.getElementById("login-username").value.trim();
    const password = document.getElementById("login-password").value;
    if (!username || !password) return showToast("Username aur password daalo!", "error");
    const email = `${username.toLowerCase()}@ohootap.com`;
    try {
        await window.FB.signInWithEmailAndPassword(window.FB.auth, email, password);
        showToast(`Welcome back, ${username}!`, "success");
    } catch (err) {
        if (err.code === "auth/user-not-found" || err.code === "auth/invalid-credential" || err.code === "auth/wrong-password") {
            showToast("Galat username ya password!", "error");
        } else {
            showToast("Login failed: " + err.message, "error");
        }
    }
}

async function signup() {
    const username = document.getElementById("signup-username").value.trim();
    const password = document.getElementById("signup-password").value;
    const referral = document.getElementById("signup-referral").value.trim();
    if (!username || !password) return showToast("Sab fields bharo!", "error");
    if (username.length < 3) return showToast("Username min 3 chars!", "error");
    if (password.length < 6) return showToast("Password min 6 chars!", "error");
    if (!/^[a-zA-Z0-9_]+$/.test(username)) return showToast("Sirf letters, numbers, underscore!", "error");
    const email = `${username.toLowerCase()}@ohootap.com`;
    try {
        const usersRef = window.FB.collection(window.FB.db, "users");
        const snapshot = await window.FB.getDocs(usersRef);
        let usernameTaken = false;
        snapshot.forEach(doc => {
            if (doc.data().username?.toLowerCase() === username.toLowerCase()) usernameTaken = true;
        });
        if (usernameTaken) return showToast("Username already exists!", "error");
        const userCredential = await window.FB.createUserWithEmailAndPassword(window.FB.auth, email, password);
        const uid = userCredential.user.uid;
        const refCode = "OHOO" + Math.random().toString(36).substring(2, 8).toUpperCase();
        const initialData = {
            coins: 0, energy: MAX_ENERGY, maxEnergy: MAX_ENERGY,
            taps: 0, totalTaps: 0, level: 1, streak: 1,
            lastLogin: Date.now(), lastOnline: Date.now(),
            username, avatar: "🚀", bio: "",
            ownedAvatars: ["🚀", "👾", "🐱", "🦊", "🐼", "🐸"],
            ownedFrames: [], currentFrame: "", tapEffect: "default", ownedTapEffects: ["default"],
            autobotLevel: 0, referrals: 0, activeReferrals: 0, referralEarned: 0,
            referralCode: refCode, referredBy: referral || null,
            friends: [], clan: null, clanMembers: [], clanScore: 0, clanWins: 0,
            lifetimeCoins: 0, bestCombo: 0, timePlayed: 0,
            dailyStartCoins: 0, lastDailyReset: Date.now(), dailyBonusClaimed: false,
            missionStreak: 0, lastMissionDate: null, missions: [],
            achievements: {}, withdrawHistory: [], levelBonusHistory: [], notifications: [],
            chatMessages: { global: [], clan: [], private: {} },
            luckyBoxLastOpen: 0, luckyBoxHistory: [],
            premium: false, premiumUntil: 0, prestige: 0,
            tournamentJoined: false, tournamentScore: 0,
            purchasedFeatures: [],
            lastSpinTime: 0, lastScratchTime: 0,
            lastAutoAdTime: Date.now(), coinsSinceLastAd: 0,
            adVideosWatched: 0, adTotalEarned: 0,
            banned: false,
            settings: { music: true, sfx: true, theme: "dark" },
            powerUps: {
                double: { active: false, until: 0 },
                infinite: { active: false, until: 0 },
                autotap: { active: false, until: 0 },
                megatap: { active: false, until: 0 }
            },
            combo: { count: 0, lastTap: 0, best: 0, frenzyActive: false, frenzyUntil: 0 },
            scratchPrize: 0,
            battleActive: false, battleMyTaps: 0, battleOppTaps: 0, battleTimer: 30, battleInterval: null,
            uid, createdAt: window.FB.serverTimestamp()
        };
        await window.FB.setDoc(window.FB.doc(window.FB.db, "users", uid), initialData);
        if (referral) {
            let referrerUid = null;
            let referrerData = null;
            snapshot.forEach(doc => {
                if (doc.data().referralCode === referral) { referrerUid = doc.id; referrerData = doc.data(); }
            });
            if (referrerUid) {
                await window.FB.updateDoc(window.FB.doc(window.FB.db, "users", referrerUid), {
                    coins: (referrerData.coins || 0) + 50000,
                    referrals: (referrerData.referrals || 0) + 1,
                    activeReferrals: (referrerData.activeReferrals || 0) + 1,
                    referralEarned: (referrerData.referralEarned || 0) + 50000
                });
                await window.FB.updateDoc(window.FB.doc(window.FB.db, "users", uid), { coins: 25000 });
            }
        }
        gameState = initialData;
        currentUser = username;
        showToast("Account ban gaya! Welcome!", "success");
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    } catch (err) {
        if (err.code === "auth/email-already-in-use") showToast("Username already taken!", "error");
        else showToast("Signup failed: " + err.message, "error");
    }
}

async function logout() {
    if (!confirm("Logout karna hai?")) return;
    try {
        await saveUserToFirestore();
        await window.FB.signOut(window.FB.auth);
        showToast("Logged out!", "info");
    } catch (err) { showToast("Logout failed!", "error"); }
}

// ===== ENTER GAME =====
function enterGame() {
    document.getElementById("login-screen").classList.add("hidden");
    document.getElementById("game-container").classList.remove("hidden");
    if (!gameState.purchasedFeatures) gameState.purchasedFeatures = [];
    if (!gameState.ownedAvatars) gameState.ownedAvatars = ["🚀", "👾", "🐱", "🦊", "🐼", "🐸"];
    if (!gameState.ownedFrames) gameState.ownedFrames = [];
    if (!gameState.ownedTapEffects) gameState.ownedTapEffects = ["default"];
    if (!gameState.withdrawHistory) gameState.withdrawHistory = [];
    if (!gameState.levelBonusHistory) gameState.levelBonusHistory = [];
    if (!gameState.notifications) gameState.notifications = [];
    if (!gameState.achievements) gameState.achievements = {};
    if (!gameState.luckyBoxHistory) gameState.luckyBoxHistory = [];
    if (!gameState.missions) gameState.missions = [];

    document.getElementById("profile-username").textContent = gameState.username;
    document.getElementById("profile-name").value = gameState.username;
    document.getElementById("profile-bio").value = gameState.bio || "";
    document.getElementById("header-avatar").textContent = gameState.avatar;
    document.getElementById("avatar-display").textContent = gameState.avatar;
    document.getElementById("referral-code-display").textContent = gameState.referralCode || "OHOO123";

    checkDailyReset();
    generateMissions();
    initAvatars();
    initUpgrades();
    initShop();
    initAchievements();
    initRoadmap();
    initLuckyBox();
    initAvatarShop();
    initFrames();
    initTapEffects();
    initReferralMilestones();
    initMissions();
    initNews();
    initFAQ();
    initLeaderboard("coins");
    renderChat("global");
    renderHistory();
    renderNotifications();
    renderLevelBonusHistory();
    updateAdStats();
    checkPremiumExpiry();
    updateUI();
}

// ===== HELPERS =====
function formatNum(n) {
    n = Math.floor(n || 0);
    if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
    if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
    if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
    return n.toString();
}

function showToast(msg, type = "info") {
    const colors = { success: "bg-emerald-500 text-white", error: "bg-rose-500 text-white", warning: "bg-amber-500 text-slate-950", info: "bg-cyan-500 text-slate-950" };
    const icons = { success: "fa-check-circle", error: "fa-exclamation-circle", warning: "fa-triangle-exclamation", info: "fa-info-circle" };
    const container = document.getElementById("toast-container");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = `toast-item ${colors[type]} px-4 py-3 rounded-xl shadow-2xl font-bold text-sm flex items-center gap-2`;
    toast.innerHTML = `<i class="fa-solid ${icons[type]}"></i> ${msg}`;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = "0"; setTimeout(() => toast.remove(), 300); }, 3000);
}

function toggleTheme() {
    const isLight = document.body.classList.toggle("light-theme");
    const icon = document.getElementById("theme-icon");
    if (icon) icon.className = isLight ? "fa-solid fa-moon text-purple-400" : "fa-solid fa-sun text-yellow-400";
    gameState.settings.theme = isLight ? "light" : "dark";
    saveUser();
}

function loadTheme() {
    if (gameState.settings?.theme === "light") {
        document.body.classList.add("light-theme");
        const icon = document.getElementById("theme-icon");
        if (icon) icon.className = "fa-solid fa-moon text-purple-400";
    }
}

function toggleMusic() {
    gameState.settings.music = !gameState.settings.music;
    const icon = document.getElementById("music-icon");
    if (icon) icon.className = gameState.settings.music ? "fa-solid fa-volume-high text-cyan-400" : "fa-solid fa-volume-xmark text-slate-500";
    showToast(gameState.settings.music ? "Music ON" : "Music OFF", "info");
    saveUser();
}

function showSignup() { document.getElementById("login-form").classList.add("hidden"); document.getElementById("signup-form").classList.remove("hidden"); }
function showLogin() { document.getElementById("signup-form").classList.add("hidden"); document.getElementById("login-form").classList.remove("hidden"); }
function showTerms() { const m = document.getElementById("terms-modal"); if (m) m.classList.remove("hidden"); }
function closeTerms() { const m = document.getElementById("terms-modal"); if (m) m.classList.add("hidden"); }

function switchTab(tab) {
    document.querySelectorAll(".tab-view").forEach(t => t.classList.remove("active"));
    const target = document.getElementById(`tab-${tab}`);
    if (target) target.classList.add("active");
    document.querySelectorAll(".nav-side-btn").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
    document.querySelectorAll(".mb-nav-btn").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
    if (tab === "history") renderHistory();
    if (tab === "leaderboard") renderLeaderboard();
    if (tab === "missions") renderMissions();
    if (tab === "friends") renderFriends();
    if (tab === "clan") renderClan();
    if (tab === "chat") renderChat(currentChat);
    if (tab === "luckybox") updateLuckyBoxTimer();
    if (tab === "tournament") renderTournament();
    if (tab === "referral") renderReferralMilestones();
    if (tab === "premium") updatePremiumUI();
    if (tab === "news") renderNews();
    if (tab === "achievements") renderAchievements();
    if (tab === "upgrades") renderUpgrades();
    if (tab === "shop") renderShop();
    if (tab === "avatar-shop") renderAvatarShop();
    if (tab === "rewards") { updateSpinTimer(); updateScratchTimer(); }
}

function updateUI() {
    if (!currentUser) return;
    const pkr = (gameState.coins / COINS_PER_PKR).toFixed(2);
    document.getElementById("header-balance").textContent = formatNum(gameState.coins);
    document.getElementById("header-pkr").textContent = pkr;
    document.getElementById("header-energy").textContent = `${Math.floor(gameState.energy)} / ${gameState.maxEnergy}`;
    document.getElementById("streak-days").textContent = gameState.streak;
    document.getElementById("level-display").textContent = gameState.level;
    document.getElementById("tap-coins-display").textContent = `${formatNum(gameState.coins)} COINS`;
    document.getElementById("tap-pkr-display").textContent = pkr;
    document.getElementById("profile-coins").textContent = formatNum(gameState.coins);
    document.getElementById("profile-pkr").textContent = pkr;
    document.getElementById("profile-taps").textContent = formatNum(gameState.taps);
    document.getElementById("profile-autobot").textContent = gameState.autobotLevel;
    document.getElementById("refs-total").textContent = gameState.referrals;
    document.getElementById("refs-active").textContent = gameState.activeReferrals;
    document.getElementById("refs-earned").textContent = formatNum(gameState.referralEarned);
    const perTap = calculateTapValue();
    const perTapEl = document.getElementById("per-tap-value");
    if (perTapEl) perTapEl.textContent = formatNum(perTap);
    if (gameState.prestige > 0) {
        const pb = document.getElementById("prestige-badge");
        if (pb) { pb.classList.remove("hidden"); pb.classList.add("flex"); document.getElementById("prestige-level").textContent = gameState.prestige; }
    }
}

// ===== TAP =====
function calculateTapValue() {
    let base = BASE_TAP_VALUE;
    if (gameState.autobotLevel > 0) base += gameState.autobotLevel;
    if (gameState.powerUps.megatap.active) base *= 100;
    if (gameState.powerUps.double.active) base *= 2;
    if (gameState.premium) base *= PREMIUM_MULTIPLIER;
    if (gameState.prestige > 0) base *= (1 + gameState.prestige * 0.5);
    return Math.floor(base);
}

function getComboMultiplier() {
    const c = gameState.combo.count;
    if (c >= 50) return 5;
    if (c >= 30) return 4;
    if (c >= 20) return 3;
    if (c >= 10) return 2;
    return 1;
}

function triggerTap(e) {
    if (!currentUser) return;
    if (gameState.energy < ENERGY_PER_TAP) return showToast("Energy khatam! Ad dekho ya wait karo.", "warning");
    const now = Date.now();
    if (now - gameState.combo.lastTap < COMBO_TIMEOUT) gameState.combo.count++;
    else gameState.combo.count = 1;
    gameState.combo.lastTap = now;
    if (gameState.combo.count > gameState.combo.best) {
        gameState.combo.best = gameState.combo.count;
        gameState.bestCombo = gameState.combo.count;
    }
    if (gameState.combo.count === 10 && !gameState.combo.frenzyActive) activateFrenzy();
    let value = calculateTapValue();
    value *= getComboMultiplier();
    if (gameState.combo.frenzyActive) value *= 2;
    value = Math.floor(value);
    if (!gameState.powerUps.infinite.active) gameState.energy -= ENERGY_PER_TAP;
    gameState.taps++;
    gameState.totalTaps++;
    addCoins(value, false);
    showFloatingCoin(e, value);
    playTapSound();
    updateComboDisplay();
    checkLevelUp();
    checkAchievements();
    progressMission("tap", 1);
    if (gameState.totalTaps % 10 === 0) saveUser();
}

function handleMultiTouch(e) {
    e.preventDefault();
    if (e.touches) for (let i = 0; i < e.touches.length; i++) triggerTap(e.touches[i]);
}

function activateFrenzy() {
    gameState.combo.frenzyActive = true;
    gameState.combo.frenzyUntil = Date.now() + FRENZY_DURATION;
    const fb = document.getElementById("frenzy-banner");
    if (fb) { fb.classList.remove("hidden"); setTimeout(() => fb.classList.add("hidden"), FRENZY_DURATION); }
    showToast("🔥 FRENZY MODE! 2X Coins for 10s!", "warning");
    confetti({ particleCount: 50, spread: 60, origin: { y: 0.5 } });
}

function updateComboDisplay() {
    const display = document.getElementById("combo-display");
    const count = document.getElementById("combo-count");
    if (!display) return;
    if (gameState.combo.count >= 5) {
        display.classList.remove("hidden");
        count.textContent = gameState.combo.count;
        display.classList.add("combo-pop");
        setTimeout(() => display.classList.remove("combo-pop"), 300);
    } else display.classList.add("hidden");
}

function showFloatingCoin(e, value) {
    const x = (e.clientX || (e.touches && e.touches[0]?.clientX) || window.innerWidth / 2);
    const y = (e.clientY || (e.touches && e.touches[0]?.clientY) || window.innerHeight / 2);
    const el = document.createElement("div");
    el.className = "floating-coin";
    el.style.left = (x - 20) + "px";
    el.style.top = y + "px";
    el.textContent = `+${formatNum(value)}`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1000);
}

function playTapSound() {
    if (!gameState.settings.sfx) return;
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = 800 + Math.random() * 200;
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
        osc.start(); osc.stop(ctx.currentTime + 0.1);
    } catch (e) {}
}

function addCoins(amount, showFloat = true) {
    gameState.coins += amount;
    gameState.lifetimeCoins = (gameState.lifetimeCoins || 0) + amount;
    gameState.coinsSinceLastAd = (gameState.coinsSinceLastAd || 0) + amount;
    updateUI();
}

function checkLevelUp() {
    const levelThresholds = [];
    for (let i = 1; i <= 100; i++) levelThresholds.push(450000 + (i - 1) * 50000);
    let newLevel = 1;
    for (let i = 0; i < 100; i++) if (gameState.lifetimeCoins >= levelThresholds[i]) newLevel = i + 1;
    if (newLevel > gameState.level) {
        const oldLevel = gameState.level;
        gameState.level = newLevel;
        const bonusPkr = (newLevel - oldLevel) * 200;
        gameState.levelBonusHistory.unshift({ level: newLevel, pkr: bonusPkr, time: Date.now() });
        showToast(`🎉 LEVEL ${newLevel}! +${bonusPkr} PKR Bonus!`, "success");
        confetti({ particleCount: 200, spread: 90, origin: { y: 0.5 } });
        saveUser();
        renderLevelBonusHistory();
        initRoadmap();
    }
}

function renderLevelBonusHistory() {
    const container = document.getElementById("level-bonus-container");
    if (!container) return;
    if (!gameState.levelBonusHistory || gameState.levelBonusHistory.length === 0) {
        container.innerHTML = '<p class="text-xs text-slate-500">Abhi koi bonus nahi</p>';
        return;
    }
    container.innerHTML = gameState.levelBonusHistory.slice(0, 10).map(h => `
        <div class="flex justify-between items-center bg-slate-800/60 p-2 rounded-lg text-xs">
            <span class="text-purple-400 font-bold">Level ${h.level}</span>
            <span class="text-emerald-400 font-black">+${h.pkr} PKR</span>
        </div>
    `).join("");
}

// ===== POWER-UPS =====
function activatePowerUp(type) {
    const pu = gameState.powerUps[type];
    if (pu.active && Date.now() < pu.until) return showToast("Already active!", "warning");
    const cost = POWERUP_COSTS[type];
    if (gameState.coins < cost) return showToast(`Coins kam hain! Chahiye: ${formatNum(cost)} coins`, "error");
    gameState.coins -= cost;
    pu.active = true;
    pu.until = Date.now() + POWERUP_DURATIONS[type];
    document.querySelector(`.powerup-btn[onclick*="${type}"]`)?.classList.add("active");
    const msgs = {
        double: `🔥 2x Coins! -${formatNum(cost)} coins`,
        infinite: `♾️ Infinite Energy! -${formatNum(cost)} coins`,
        autotap: `🤖 Auto-Tap! -${formatNum(cost)} coins`,
        megatap: `💥 Mega Tap! -${formatNum(cost)} coins`
    };
    showToast(msgs[type], "success");
    saveUser(); updateUI();
}

// ===== DAILY BONUS =====
function claimDailyBonus() {
    if (gameState.dailyBonusClaimed) return showToast("Aaj ka bonus claim ho chuka!", "warning");
    const bonus = 1000 + (gameState.streak - 1) * 500;
    addCoins(bonus, true);
    gameState.dailyBonusClaimed = true;
    showToast(`Daily bonus: +${formatNum(bonus)} coins!`, "success");
    confetti({ particleCount: 50, spread: 60 });
    saveUser();
}

function watchAd(type) {
    showToast("Ad loading... (simulated)", "info");
    setTimeout(() => {
        if (type === "energy") { gameState.energy = gameState.maxEnergy; showToast("Energy full!", "success"); }
        else if (type === "coins") { addCoins(5000, true); showToast("+5000 coins!", "success"); }
        updateUI(); saveUser();
    }, 1500);
}

function checkDailyReset() {
    const now = Date.now();
    const lastReset = gameState.lastDailyReset || 0;
    const dayMs = 24 * 60 * 60 * 1000;
    if (now - lastReset >= dayMs) {
        gameState.dailyStartCoins = gameState.coins;
        gameState.lastDailyReset = now;
        gameState.dailyBonusClaimed = false;
        const daysDiff = Math.floor((now - lastReset) / dayMs);
        if (daysDiff === 1) gameState.streak = (gameState.streak || 1) + 1;
        else if (daysDiff > 1) gameState.streak = 1;
        saveUser();
    }
}

function checkPremiumExpiry() {
    if (gameState.premium && Date.now() > gameState.premiumUntil) {
        gameState.premium = false;
        gameState.premiumUntil = 0;
        showToast("Premium expire ho gaya!", "warning");
        saveUser(); updateUI();
    }
}

// ===== SPIN + SCRATCH =====
function spinWheel() {
    const now = Date.now();
    const lastSpin = gameState.lastSpinTime || 0;
    if (now < lastSpin + SPIN_COOLDOWN) {
        const left = (lastSpin + SPIN_COOLDOWN) - now;
        const h = Math.floor(left / 3600000);
        const m = Math.floor((left % 3600000) / 60000);
        const s = Math.floor((left % 60000) / 1000);
        return showToast(`Spin ready nahi! ${h}h ${m}m ${s}s baad aao`, "warning");
    }
    gameState.lastSpinTime = now;
    addCoins(SPIN_REWARD, true);
    showToast(`🎉 You won ${formatNum(SPIN_REWARD)} coins!`, "success");
    confetti({ particleCount: 200, spread: 90, origin: { y: 0.6 } });
    saveUser(); updateSpinTimer(); updateUI();
}

function updateSpinTimer() {
    const el = document.getElementById("spin-timer");
    if (!el) return;
    const now = Date.now();
    const last = gameState.lastSpinTime || 0;
    const next = last + SPIN_COOLDOWN;
    if (now >= next) { el.textContent = "Ready!"; el.className = "text-[10px] text-emerald-400 font-bold mt-1"; }
    else {
        const left = next - now;
        const h = Math.floor(left / 3600000);
        const m = Math.floor((left % 3600000) / 60000);
        const s = Math.floor((left % 60000) / 1000);
        el.textContent = `${h}h ${m}m ${s}s`;
        el.className = "text-[10px] text-slate-400 font-bold mt-1";
    }
}

function openScratchModal() {
    const now = Date.now();
    const last = gameState.lastScratchTime || 0;
    if (now < last + SCRATCH_COOLDOWN) {
        const left = (last + SCRATCH_COOLDOWN) - now;
        const h = Math.floor(left / 3600000);
        const m = Math.floor((left % 3600000) / 60000);
        const s = Math.floor((left % 60000) / 1000);
        return showToast(`Scratch ready nahi! ${h}h ${m}m ${s}s baad aao`, "warning");
    }
    gameState.lastScratchTime = now;
    gameState.scratchPrize = SCRATCH_REWARD;
    addCoins(SCRATCH_REWARD, true);
    showToast(`🎉 You won ${formatNum(SCRATCH_REWARD)} coins!`, "success");
    confetti({ particleCount: 200, spread: 90, origin: { y: 0.6 } });
    document.getElementById("scratch-prize-text").textContent = `+${formatNum(SCRATCH_REWARD)} COINS`;
    document.getElementById("scratch-modal").classList.remove("hidden");
    initScratchCanvas();
    saveUser(); updateScratchTimer(); updateUI();
}

function closeScratchModal() { document.getElementById("scratch-modal").classList.add("hidden"); }

function updateScratchTimer() {
    const el = document.getElementById("scratch-timer");
    if (!el) return;
    const now = Date.now();
    const last = gameState.lastScratchTime || 0;
    const next = last + SCRATCH_COOLDOWN;
    if (now >= next) { el.textContent = "Ready!"; el.className = "text-[10px] text-emerald-400 font-bold mt-1"; }
    else {
        const left = next - now;
        const h = Math.floor(left / 3600000);
        const m = Math.floor((left % 3600000) / 60000);
        const s = Math.floor((left % 60000) / 1000);
        el.textContent = `${h}h ${m}m ${s}s`;
        el.className = "text-[10px] text-slate-400 font-bold mt-1";
    }
}

function initScratchCanvas() {
    const canvas = document.getElementById("scratch-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const w = canvas.offsetWidth, h = canvas.offsetHeight;
    canvas.width = w; canvas.height = h;
    ctx.fillStyle = "#22c55e";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#166534";
    ctx.font = "bold 20px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("SCRATCH HERE", w / 2, h / 2);
    let isDrawing = false;
    const scratch = (e) => {
        if (!isDrawing) return;
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
        const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top;
        ctx.globalCompositeOperation = "destination-out";
        ctx.beginPath(); ctx.arc(x, y, 20, 0, Math.PI * 2); ctx.fill();
    };
    canvas.onmousedown = () => isDrawing = true;
    canvas.onmouseup = () => isDrawing = false;
    canvas.onmousemove = scratch;
    canvas.ontouchstart = (e) => { isDrawing = true; scratch(e); e.preventDefault(); };
    canvas.ontouchend = () => isDrawing = false;
    canvas.ontouchmove = (e) => { scratch(e); e.preventDefault(); };
}

function luckyDraw() {
    const rand = Math.random();
    let prize, label;
    if (rand < 0.01) { prize = 100000; label = "JACKPOT!"; }
    else if (rand < 0.1) { prize = 10000; label = "Big Win!"; }
    else if (rand < 0.4) { prize = 2500; label = "Nice!"; }
    else { prize = 500; label = "Better luck next time!"; }
    addCoins(prize, true);
    showToast(`${label} +${formatNum(prize)} coins`, prize > 5000 ? "success" : "info");
    if (prize >= 10000) confetti({ particleCount: 150, spread: 90 });
    saveUser();
}

// ===== MISSIONS =====
function generateMissions() {
    const today = new Date().toDateString();
    if (gameState.lastMissionDate === today && gameState.missions && gameState.missions.length > 0) return;
    gameState.missions = [
        { id: "m1", text: "500 taps karo", target: 500, progress: 0, reward: 5000, type: "tap" },
        { id: "m2", text: "3 ads dekho", target: 3, progress: 0, reward: 10000, type: "ad" },
        { id: "m3", text: "1 referral karo", target: 1, progress: 0, reward: 50000, type: "referral" },
        { id: "m4", text: "1000 taps karo", target: 1000, progress: 0, reward: 15000, type: "tap" },
        { id: "m5", text: "5 ads dekho", target: 5, progress: 0, reward: 20000, type: "ad" }
    ];
    gameState.lastMissionDate = today;
    saveUser();
}

function checkMissionReset() {
    const today = new Date().toDateString();
    if (gameState.lastMissionDate !== today) { generateMissions(); renderMissions(); }
}

function progressMission(type, amount) {
    let changed = false;
    (gameState.missions || []).forEach(m => {
        if (m.type === type && m.progress < m.target) { m.progress = Math.min(m.target, m.progress + amount); changed = true; }
    });
    if (changed) renderMissions();
}

function claimMission(id) {
    const m = gameState.missions.find(x => x.id === id);
    if (!m || m.progress < m.target || m.claimed) return;
    m.claimed = true;
    addCoins(m.reward, true);
    showToast(`Mission complete! +${formatNum(m.reward)} coins`, "success");
    confetti({ particleCount: 50 });
    saveUser(); renderMissions();
}

function renderMissions() {
    const container = document.getElementById("missions-container");
    if (!container) return;
    if (!gameState.missions || !gameState.missions.length) generateMissions();
    container.innerHTML = gameState.missions.map(m => {
        const pct = Math.min(100, (m.progress / m.target) * 100);
        const done = m.progress >= m.target;
        return `
            <div class="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl">
                <div class="flex justify-between items-center mb-2">
                    <h3 class="font-black text-sm text-cyan-300">${m.text}</h3>
                    <span class="text-xs font-black text-yellow-400">+${formatNum(m.reward)}</span>
                </div>
                <div class="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div class="h-full bg-gradient-to-r from-cyan-400 to-purple-500" style="width:${pct}%"></div>
                </div>
                <div class="flex justify-between items-center mt-2">
                    <span class="text-[10px] text-slate-400">${m.progress}/${m.target}</span>
                    <button onclick="claimMission('${m.id}')" ${!done || m.claimed ? "disabled" : ""} class="text-xs font-black px-3 py-1 rounded-lg ${done && !m.claimed ? "bg-emerald-500 text-slate-950" : "bg-slate-700 text-slate-500"}">
                        ${m.claimed ? "CLAIMED" : done ? "CLAIM" : "IN PROGRESS"}
                    </button>
                </div>
            </div>
        `;
    }).join("");
}

function initMissions() {
    renderMissions();
    const streakContainer = document.getElementById("mission-streak-days");
    if (streakContainer) {
        streakContainer.innerHTML = Array.from({ length: 7 }, (_, i) => `
            <div class="flex-1 aspect-square rounded-xl flex items-center justify-center text-xs font-black ${i < gameState.missionStreak ? "bg-emerald-500 text-slate-950" : "bg-slate-800 text-slate-500"}">${i + 1}</div>
        `).join("");
    }
}

// ===== LUCKY BOX =====
function initLuckyBox() { updateLuckyBoxTimer(); renderLuckyBoxHistory(); }

function updateLuckyBoxTimer() {
    const el = document.getElementById("luckybox-timer");
    const status = document.getElementById("luckybox-status");
    if (!el) return;
    const now = Date.now();
    const next = (gameState.luckyBoxLastOpen || 0) + LUCKYBOX_COOLDOWN;
    if (now >= next) {
        el.textContent = "Ready to open!";
        status.textContent = "Tap to Open!";
        status.className = "mt-4 text-sm font-black text-emerald-400";
    } else {
        const left = next - now;
        const h = Math.floor(left / 3600000);
        const m = Math.floor((left % 3600000) / 60000);
        const s = Math.floor((left % 60000) / 1000);
        el.textContent = `Next box in: ${h}h ${m}m ${s}s`;
        status.textContent = "Come back later!";
        status.className = "mt-4 text-sm font-black text-slate-500";
    }
}

function openLuckyBox() {
    const now = Date.now();
    if (now < (gameState.luckyBoxLastOpen || 0) + LUCKYBOX_COOLDOWN) return showToast("Box ready nahi hai!", "warning");
    const rand = Math.random();
    let rarity, prize, icon, title;
    if (rand < 0.01) { rarity = "LEGENDARY"; prize = 100000; icon = "👑"; title = "LEGENDARY!"; }
    else if (rand < 0.1) { rarity = "EPIC"; prize = 25000; icon = "🔮"; title = "EPIC!"; }
    else if (rand < 0.4) { rarity = "RARE"; prize = 10000; icon = "💎"; title = "RARE!"; }
    else { rarity = "COMMON"; prize = 2500; icon = "📦"; title = "COMMON"; }
    gameState.luckyBoxLastOpen = now;
    if (!gameState.luckyBoxHistory) gameState.luckyBoxHistory = [];
    gameState.luckyBoxHistory.unshift({ rarity, prize, time: now });
    if (gameState.luckyBoxHistory.length > 20) gameState.luckyBoxHistory.pop();
    addCoins(prize, true);
    document.getElementById("luckybox-result-icon").textContent = icon;
    document.getElementById("luckybox-result-title").textContent = title;
    document.getElementById("luckybox-result-text").textContent = `Tumhe mila: ${formatNum(prize)} Coins`;
    document.getElementById("luckybox-modal").classList.remove("hidden");
    if (rarity === "LEGENDARY" || rarity === "EPIC") confetti({ particleCount: 200, spread: 90 });
    saveUser(); renderLuckyBoxHistory(); updateLuckyBoxTimer();
}

function closeLuckyBoxModal() { document.getElementById("luckybox-modal").classList.add("hidden"); }

function renderLuckyBoxHistory() {
    const container = document.getElementById("luckybox-history");
    if (!container) return;
    if (!gameState.luckyBoxHistory || gameState.luckyBoxHistory.length === 0) {
        container.innerHTML = '<p class="text-xs text-slate-500">Abhi koi box nahi khola</p>';
        return;
    }
    container.innerHTML = gameState.luckyBoxHistory.slice(0, 10).map(h => `
        <div class="flex justify-between items-center bg-slate-800/60 p-2 rounded-lg text-xs">
            <span class="font-black ${h.rarity === "LEGENDARY" ? "text-yellow-400" : h.rarity === "EPIC" ? "text-purple-400" : h.rarity === "RARE" ? "text-blue-400" : "text-slate-400"}">${h.rarity}</span>
            <span class="text-yellow-400 font-black">+${formatNum(h.prize)}</span>
        </div>
    `).join("");
}

// ===== AVATARS =====
const ALL_AVATARS = [
    { emoji: "🚀", rarity: "common", price: 0 },
    { emoji: "👾", rarity: "common", price: 0 },
    { emoji: "🐱", rarity: "common", price: 0 },
    { emoji: "🦊", rarity: "common", price: 0 },
    { emoji: "🐼", rarity: "common", price: 0 },
    { emoji: "🐸", rarity: "common", price: 0 },
    { emoji: "🦁", rarity: "rare", price: 10000 },
    { emoji: "🐯", rarity: "rare", price: 10000 },
    { emoji: "🦄", rarity: "rare", price: 15000 },
    { emoji: "🐉", rarity: "epic", price: 50000 },
    { emoji: "👽", rarity: "epic", price: 50000 },
    { emoji: "🤖", rarity: "epic", price: 50000 },
    { emoji: "👑", rarity: "legendary", price: 200000 },
    { emoji: "🔥", rarity: "legendary", price: 200000 },
    { emoji: "⚡", rarity: "legendary", price: 200000 },
    { emoji: "🌙", rarity: "seasonal", price: 75000 },
    { emoji: "⭐", rarity: "seasonal", price: 75000 },
    { emoji: "🎄", rarity: "seasonal", price: 100000 },
    { emoji: "🎃", rarity: "seasonal", price: 100000 },
    { emoji: "💎", rarity: "legendary", price: 500000 }
];

function initAvatars() {
    const container = document.getElementById("avatar-list");
    if (!container) return;
    container.innerHTML = gameState.ownedAvatars.map(a => `
        <button onclick="selectAvatar('${a}')" class="aspect-square rounded-xl bg-slate-800 hover:bg-slate-700 text-2xl flex items-center justify-center ${gameState.avatar === a ? "ring-2 ring-cyan-400" : ""}">${a}</button>
    `).join("");
}

function selectAvatar(emoji) {
    gameState.avatar = emoji;
    document.getElementById("header-avatar").textContent = emoji;
    document.getElementById("avatar-display").textContent = emoji;
    initAvatars(); saveUser();
    showToast("Avatar set!", "success");
}

function filterAvatars(f) {
    avatarFilter = f;
    document.querySelectorAll(".avatar-filter").forEach(b => b.classList.toggle("active", b.textContent.trim().toLowerCase() === f));
    renderAvatarShop();
}

function renderAvatarShop() {
    const container = document.getElementById("avatar-shop-container");
    if (!container) return;
    const filtered = avatarFilter === "all" ? ALL_AVATARS : ALL_AVATARS.filter(a => a.rarity === avatarFilter);
    container.innerHTML = filtered.map(a => {
        const owned = gameState.ownedAvatars.includes(a.emoji);
        const rarityColor = { common: "border-slate-600", rare: "border-blue-500", epic: "border-purple-500", legendary: "border-yellow-500", seasonal: "border-pink-500" }[a.rarity];
        return `
            <div class="bg-slate-900/90 border-2 ${rarityColor} p-3 rounded-2xl text-center">
                <div class="text-4xl mb-2">${a.emoji}</div>
                <p class="text-[10px] font-black text-slate-400 uppercase">${a.rarity}</p>
                ${owned
                    ? `<button onclick="selectAvatar('${a.emoji}')" class="w-full mt-2 bg-emerald-500 text-slate-950 font-black py-1.5 rounded-lg text-[10px]">SELECT</button>`
                    : `<button onclick="buyAvatar('${a.emoji}', ${a.price})" class="w-full mt-2 bg-yellow-500 text-slate-950 font-black py-1.5 rounded-lg text-[10px]">${formatNum(a.price)} 🪙</button>`
                }
            </div>
        `;
    }).join("");
}

function buyAvatar(emoji, price) {
    if (gameState.coins < price) return showToast("Coins kam hain!", "error");
    gameState.coins -= price;
    gameState.ownedAvatars.push(emoji);
    showToast(`${emoji} unlocked!`, "success");
    saveUser(); renderAvatarShop(); initAvatars(); updateUI();
}

function initAvatarShop() { renderAvatarShop(); }

// ===== FRAMES =====
const ALL_FRAMES = [
    { id: "gold", name: "Gold", price: 100000, class: "ring-4 ring-yellow-400" },
    { id: "diamond", name: "Diamond", price: 500000, class: "ring-4 ring-cyan-400" },
    { id: "fire", name: "Fire", price: 250000, class: "ring-4 ring-orange-500" },
    { id: "rainbow", name: "Rainbow", price: 1000000, class: "ring-4 ring-pink-500" }
];

function initFrames() {
    const container = document.getElementById("frame-shop-container");
    if (!container) return;
    container.innerHTML = ALL_FRAMES.map(f => {
        const owned = gameState.ownedFrames.includes(f.id);
        return `
            <div class="text-center">
                <div class="w-16 h-16 rounded-full bg-slate-800 mx-auto flex items-center justify-center text-2xl ${f.class}">${gameState.avatar}</div>
                <p class="text-[10px] font-black text-slate-400 mt-1">${f.name}</p>
                ${owned
                    ? `<button onclick="setFrame('${f.id}')" class="w-full mt-1 bg-emerald-500 text-slate-950 font-black py-1 rounded text-[9px]">USE</button>`
                    : `<button onclick="buyFrame('${f.id}', ${f.price})" class="w-full mt-1 bg-yellow-500 text-slate-950 font-black py-1 rounded text-[9px]">${formatNum(f.price)}</button>`
                }
            </div>
        `;
    }).join("");
}

function buyFrame(id, price) {
    if (gameState.coins < price) return showToast("Coins kam hain!", "error");
    gameState.coins -= price;
    gameState.ownedFrames.push(id);
    showToast("Frame unlocked!", "success");
    saveUser(); initFrames(); updateUI();
}

function setFrame(id) {
    gameState.currentFrame = id;
    const frame = ALL_FRAMES.find(f => f.id === id);
    const avatarDisplay = document.getElementById("avatar-display");
    if (avatarDisplay) avatarDisplay.className = `w-20 h-20 rounded-full bg-gradient-to-br from-cyan-400 to-purple-600 flex items-center justify-center text-4xl shadow-xl ${frame.class}`;
    showToast("Frame set!", "success");
    saveUser();
}

// ===== TAP EFFECTS =====
const ALL_TAP_EFFECTS = [
    { id: "default", name: "Default", icon: "👆", price: 0 },
    { id: "coin", name: "Coin Blast", icon: "💰", price: 50000 },
    { id: "star", name: "Star Burst", icon: "⭐", price: 75000 },
    { id: "fire", name: "Fire Blast", icon: "🔥", price: 100000 }
];

function initTapEffects() {
    const container = document.getElementById("tap-effect-container");
    if (!container) return;
    container.innerHTML = ALL_TAP_EFFECTS.map(e => {
        const owned = gameState.ownedTapEffects.includes(e.id);
        const active = gameState.tapEffect === e.id;
        return `
            <div class="text-center">
                <div class="text-3xl">${e.icon}</div>
                <p class="text-[10px] font-black text-slate-400 mt-1">${e.name}</p>
                ${owned
                    ? `<button onclick="setTapEffect('${e.id}')" class="w-full mt-1 ${active ? "bg-emerald-500 text-slate-950" : "bg-slate-700 text-white"} font-black py-1 rounded text-[9px]">${active ? "ACTIVE" : "USE"}</button>`
                    : `<button onclick="buyTapEffect('${e.id}', ${e.price})" class="w-full mt-1 bg-yellow-500 text-slate-950 font-black py-1 rounded text-[9px]">${formatNum(e.price)}</button>`
                }
            </div>
        `;
    }).join("");
}

function buyTapEffect(id, price) {
    if (gameState.coins < price) return showToast("Coins kam hain!", "error");
    gameState.coins -= price;
    gameState.ownedTapEffects.push(id);
    showToast("Tap effect unlocked!", "success");
    saveUser(); initTapEffects(); updateUI();
}

function setTapEffect(id) {
    gameState.tapEffect = id;
    showToast("Tap effect set!", "success");
    saveUser(); initTapEffects();
}

// ===== UPGRADES =====
function initUpgrades() { renderUpgrades(); }

function renderUpgrades() {
    const container = document.getElementById("upgrades-container");
    if (!container) return;
    const upgrades = [];
    for (let i = 1; i <= 10; i++) {
        upgrades.push({
            name: `Auto-Bot Level ${i}`,
            price: i * 100,
            desc: `${i * AUTOBOT_COINS_PER_LEVEL} coins/sec + offline bonus`,
            level: i
        });
    }
    container.innerHTML = upgrades.map(u => {
        const owned = (gameState.purchasedFeatures || []).includes(`autobot-level-${u.level}`);
        return `
            <div class="bg-slate-900/90 border ${owned ? "border-emerald-500/40" : "border-slate-800"} p-4 rounded-2xl">
                <div class="flex justify-between items-center">
                    <h3 class="font-black text-sm ${owned ? "text-emerald-400" : "text-cyan-300"}">${u.name}</h3>
                    <span class="text-xs font-black text-yellow-400">${u.price} PKR</span>
                </div>
                <p class="text-[10px] text-slate-400 mt-1">${u.desc}</p>
                <button onclick="buyUpgrade('${u.name}', ${u.price}, ${u.level})" ${owned ? "disabled" : ""} class="w-full mt-2 ${owned ? "bg-slate-700 text-slate-500" : "bg-purple-500 text-white"} font-black py-2 rounded-xl text-xs">
                    ${owned ? "✓ OWNED" : "BUY"}
                </button>
            </div>
        `;
    }).join("");
}

function buyUpgrade(name, price, level) {
    const featureKey = `autobot-level-${level}`;
    if ((gameState.purchasedFeatures || []).includes(featureKey)) return showToast("Yeh upgrade already kharida hua hai!", "info");
    showPaymentModal(name, level, price);
}

// ===== SHOP =====
function initShop() { renderShop(); }

function renderShop() {
    const container = document.getElementById("shop-container");
    if (!container) return;
    const items = [
        { name: "Energy Refill", icon: "⚡", price: 5000, type: "energy" },
        { name: "2x Booster (30s)", icon: "🔥", price: 10000, type: "double" },
        { name: "Mega Tap (1min)", icon: "💥", price: 25000, type: "megatap" },
        { name: "Auto Tap (5min)", icon: "🤖", price: 20000, type: "autotap" },
        { name: "Lucky Box", icon: "📦", price: 50000, type: "luckybox" },
        { name: "Scratch Card", icon: "🎫", price: 20000, type: "scratch" }
    ];
    container.innerHTML = items.map(i => `
        <div class="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl text-center">
            <div class="text-4xl mb-2">${i.icon}</div>
            <p class="font-black text-xs text-white">${i.name}</p>
            <button onclick="buyShopItem('${i.type}', ${i.price})" class="w-full mt-2 bg-emerald-500 text-slate-950 font-black py-2 rounded-xl text-[10px]">${formatNum(i.price)} 🪙</button>
        </div>
    `).join("");
}

function buyShopItem(type, price) {
    if (gameState.coins < price) return showToast(`Coins kam hain! Chahiye: ${formatNum(price)} coins`, "error");
    gameState.coins -= price;
    if (type === "energy") { gameState.energy = gameState.maxEnergy; showToast("⚡ Energy full!", "success"); }
    else if (type === "double") { gameState.powerUps.double.active = true; gameState.powerUps.double.until = Date.now() + 30000; showToast("🔥 2x Coins activated!", "success"); }
    else if (type === "megatap") { gameState.powerUps.megatap.active = true; gameState.powerUps.megatap.until = Date.now() + 60000; showToast("💥 Mega Tap activated!", "success"); }
    else if (type === "autotap") { gameState.powerUps.autotap.active = true; gameState.powerUps.autotap.until = Date.now() + 300000; showToast("🤖 Auto-Tap activated!", "success"); }
    else if (type === "luckybox") { gameState.luckyBoxLastOpen = 0; showToast("📦 Lucky Box ready!", "success"); }
    else if (type === "scratch") openScratchModal();
    saveUser(); updateUI();
}

// ===== ACHIEVEMENTS =====
const ALL_ACHIEVEMENTS = [
    { id: "tap1", name: "First Tap", icon: "👆", target: 1, type: "taps" },
    { id: "tap100", name: "Tap Master", icon: "💪", target: 100, type: "taps" },
    { id: "tap1000", name: "Tap King", icon: "👑", target: 1000, type: "taps" },
    { id: "tap10000", name: "Tap Legend", icon: "🐉", target: 10000, type: "taps" },
    { id: "coin1m", name: "Millionaire", icon: "💰", target: 1000000, type: "coins" },
    { id: "coin10m", name: "Multi-Millionaire", icon: "💎", target: 10000000, type: "coins" },
    { id: "ref1", name: "Referrer", icon: "🤝", target: 1, type: "refs" },
    { id: "ref10", name: "Referrer King", icon: "👑", target: 10, type: "refs" },
    { id: "ref50", name: "Referrer God", icon: "🐉", target: 50, type: "refs" },
    { id: "lvl10", name: "Level 10", icon: "⭐", target: 10, type: "level" },
    { id: "lvl50", name: "Level 50", icon: "🌟", target: 50, type: "level" },
    { id: "lvl100", name: "Level 100", icon: "👑", target: 100, type: "level" }
];

function initAchievements() { renderAchievements(); }

function renderAchievements() {
    const container = document.getElementById("achievements-container");
    if (!container) return;
    container.innerHTML = ALL_ACHIEVEMENTS.map(a => {
        let current = 0;
        if (a.type === "taps") current = gameState.totalTaps || 0;
        if (a.type === "coins") current = gameState.lifetimeCoins || 0;
        if (a.type === "refs") current = gameState.referrals || 0;
        if (a.type === "level") current = gameState.level || 0;
        const done = current >= a.target;
        const claimed = gameState.achievements?.[a.id];
        return `
            <div class="bg-slate-900/90 border ${done ? "border-emerald-500/40" : "border-slate-800"} p-3 rounded-2xl text-center">
                <div class="text-3xl mb-1">${a.icon}</div>
                <p class="text-[10px] font-black ${done ? "text-emerald-400" : "text-slate-400"}">${a.name}</p>
                <p class="text-[9px] text-slate-500 mt-1">${formatNum(current)} / ${formatNum(a.target)}</p>
                ${done && !claimed
                    ? `<button onclick="claimAchievement('${a.id}')" class="w-full mt-2 bg-emerald-500 text-slate-950 font-black py-1 rounded text-[9px]">CLAIM</button>`
                    : claimed ? `<p class="text-[9px] text-emerald-400 font-black mt-2">✓ CLAIMED</p>` : ""
                }
            </div>
        `;
    }).join("");
}

function claimAchievement(id) {
    if (!gameState.achievements) gameState.achievements = {};
    if (gameState.achievements[id]) return;
    gameState.achievements[id] = true;
    addCoins(50000, true);
    showToast("Achievement unlocked! +50,000 coins", "success");
    confetti({ particleCount: 100 });
    saveUser(); renderAchievements();
}

function checkAchievements() { renderAchievements(); }

// ===== LEADERBOARD =====
function initLeaderboard(type) { currentLeaderboard = type; renderLeaderboard(); }

function switchLeaderboard(type) {
    currentLeaderboard = type;
    document.querySelectorAll(".lb-tab").forEach(b => b.classList.toggle("active", b.dataset.lb === type));
    renderLeaderboard();
}

async function renderLeaderboard() {
    const container = document.getElementById("leaderboard-container");
    if (!container) return;
    try {
        const snapshot = await window.FB.getDocs(window.FB.collection(window.FB.db, "users"));
        let arr = [];
        snapshot.forEach(doc => {
            const d = doc.data();
            arr.push({
                username: d.username || "Unknown",
                avatar: d.avatar || "🚀",
                coins: d.coins || 0,
                taps: d.totalTaps || 0,
                refs: d.referrals || 0,
                isYou: doc.id === firebaseUser?.uid
            });
        });
        arr.sort((a, b) => currentLeaderboard === "coins" ? b.coins - a.coins : currentLeaderboard === "taps" ? b.taps - a.taps : b.refs - a.refs);
        arr = arr.slice(0, 20);
        container.innerHTML = arr.map((u, i) => {
            const val = currentLeaderboard === "coins" ? u.coins : currentLeaderboard === "taps" ? u.taps : u.refs;
            const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`;
            return `
                <div class="flex items-center gap-3 bg-slate-900/90 border ${u.isYou ? "border-cyan-500/50" : "border-slate-800"} p-3 rounded-2xl">
                    <span class="text-lg font-black w-8 text-center">${medal}</span>
                    <span class="text-2xl">${u.avatar}</span>
                    <span class="flex-1 font-bold text-sm ${u.isYou ? "text-cyan-400" : "text-white"}">${u.username} ${u.isYou ? "(You)" : ""}</span>
                    <span class="font-black text-yellow-400 text-xs">${formatNum(val)}</span>
                </div>
            `;
        }).join("");
    } catch (err) {
        container.innerHTML = '<p class="text-xs text-slate-500 text-center py-4">Leaderboard load nahi hua</p>';
    }
}

// ===== ROADMAP =====
function initRoadmap() {
    const container = document.getElementById("roadmap-container");
    if (!container) return;
    const milestones = [1, 10, 25, 50, 75, 100];
    container.innerHTML = milestones.map(m => {
        const done = gameState.level >= m;
        return `
            <div class="shrink-0 w-24 text-center ${done ? "opacity-100" : "opacity-50"}">
                <div class="w-12 h-12 rounded-full mx-auto flex items-center justify-center text-lg font-black ${done ? "bg-emerald-500 text-slate-950" : "bg-slate-800 text-slate-400"}">${m}</div>
                <p class="text-[10px] font-black mt-1 ${done ? "text-emerald-400" : "text-slate-500"}">Level ${m}</p>
                <p class="text-[9px] text-slate-500">${m === 100 ? "10K PKR" : "200 PKR"}</p>
            </div>
        `;
    }).join("");
}

// ===== STATS =====
function updateStats() {
    if (!currentUser) return;
    const st = document.getElementById("stat-total-taps");
    if (st) st.textContent = formatNum(gameState.totalTaps || 0);
    const lc = document.getElementById("stat-lifetime-coins");
    if (lc) lc.textContent = formatNum(gameState.lifetimeCoins || 0);
    const bc = document.getElementById("stat-best-combo");
    if (bc) bc.textContent = gameState.bestCombo || 0;
    const tp = document.getElementById("stat-time-played");
    if (tp) tp.textContent = Math.floor((gameState.timePlayed || 0) / 60) + "m";
    const ch = document.getElementById("stat-coins-hour");
    if (ch) {
        const hours = (gameState.timePlayed || 1) / 3600;
        ch.textContent = formatNum(Math.floor(gameState.lifetimeCoins / Math.max(hours, 1)));
    }
    const da = document.getElementById("stat-daily-avg");
    if (da) {
        const days = Math.max(1, Math.floor((Date.now() - (gameState.lastLogin || Date.now())) / 86400000) + 1);
        da.textContent = formatNum(Math.floor(gameState.lifetimeCoins / days));
    }
}

function saveProfile() {
    const name = document.getElementById("profile-name").value.trim();
    const bio = document.getElementById("profile-bio").value.trim();
    if (name) gameState.username = name;
    gameState.bio = bio;
    document.getElementById("profile-username").textContent = gameState.username;
    showToast("Profile saved!", "success");
    saveUser();
}

// ===== FRIENDS =====
function searchFriend() {
    const q = document.getElementById("friend-search").value.trim();
    if (!q) return showToast("Username daalo!", "warning");
    if (q === currentUser) return showToast("Khud ko add nahi kar sakte!", "warning");
    if (!gameState.friends) gameState.friends = [];
    if (gameState.friends.includes(q)) return showToast("Already friend!", "info");
    gameState.friends.push(q);
    showToast(`${q} ko friend add kiya!`, "success");
    saveUser(); renderFriends();
}

function renderFriends() {
    const container = document.getElementById("friends-list");
    if (!container) return;
    const count = document.getElementById("friends-count");
    if (count) count.textContent = (gameState.friends || []).length;
    if (!gameState.friends || gameState.friends.length === 0) {
        container.innerHTML = '<p class="text-xs text-slate-500">Abhi koi friend nahi</p>';
        return;
    }
    container.innerHTML = gameState.friends.map(f => `
        <div class="flex items-center gap-2 bg-slate-800/60 p-2 rounded-lg">
            <span class="text-xl">🚀</span>
            <span class="flex-1 text-xs font-bold">${f}</span>
            <button onclick="challengeFriend('${f}')" class="bg-rose-500 text-white text-[10px] font-black px-2 py-1 rounded">BATTLE</button>
            <button onclick="giftFriend('${f}')" class="bg-emerald-500 text-slate-950 text-[10px] font-black px-2 py-1 rounded">GIFT</button>
        </div>
    `).join("");
}

function challengeFriend(name) { startBattle(name); }
function giftFriend(name) { showToast(`${name} ko 500 energy gift bheja!`, "success"); }
function sendAllGifts() { showToast("Sab friends ko gift bheja!", "success"); }

// ===== BATTLE =====
function startBattle(opponent = "Bot") {
    gameState.battleActive = true;
    gameState.battleMyTaps = 0; gameState.battleOppTaps = 0; gameState.battleTimer = 30;
    document.getElementById("battle-modal").classList.remove("hidden");
    document.getElementById("battle-my-taps").textContent = "0";
    document.getElementById("battle-opp-taps").textContent = "0";
    document.getElementById("battle-timer").textContent = "30";
    gameState.battleInterval = setInterval(() => {
        gameState.battleTimer--;
        document.getElementById("battle-timer").textContent = gameState.battleTimer;
        if (Math.random() < 0.7) {
            gameState.battleOppTaps += Math.floor(Math.random() * 3) + 1;
            document.getElementById("battle-opp-taps").textContent = gameState.battleOppTaps;
        }
        if (gameState.battleTimer <= 0) endBattle(opponent);
    }, 1000);
}

function battleTap() {
    if (!gameState.battleActive) return;
    gameState.battleMyTaps++;
    document.getElementById("battle-my-taps").textContent = gameState.battleMyTaps;
}

function endBattle(opponent) {
    clearInterval(gameState.battleInterval);
    gameState.battleActive = false;
    const win = gameState.battleMyTaps > gameState.battleOppTaps;
    const prize = win ? 20000 : 2000;
    addCoins(prize, true);
    showToast(win ? `🏆 You beat ${opponent}! +${prize} coins` : `😢 You lost! +${prize} coins`, win ? "success" : "warning");
    if (win) confetti({ particleCount: 150 });
    saveUser();
}

function closeBattle() {
    clearInterval(gameState.battleInterval);
    gameState.battleActive = false;
    document.getElementById("battle-modal").classList.add("hidden");
}

// ===== CLAN =====
function createClan() {
    const name = document.getElementById("clan-name-input").value.trim();
    if (!name) return showToast("Clan name daalo!", "warning");
    if (gameState.coins < 50000) return showToast("50,000 coins chahiye!", "error");
    gameState.coins -= 50000;
    gameState.clan = name;
    gameState.clanMembers = [currentUser];
    showToast(`Clan "${name}" banaya!`, "success");
    saveUser(); renderClan(); updateUI();
}

function showClanList() { showToast("Clan browser soon!", "info"); }

function leaveClan() {
    if (!confirm("Clan leave karna hai?")) return;
    gameState.clan = null; gameState.clanMembers = [];
    saveUser(); renderClan();
    showToast("Clan left", "info");
}

function joinClanWar() { showToast("Clan war join kiya!", "success"); }

function renderClan() {
    const noClan = document.getElementById("clan-no-clan");
    const info = document.getElementById("clan-info");
    if (!noClan || !info) return;
    if (gameState.clan) {
        noClan.classList.add("hidden"); info.classList.remove("hidden");
        document.getElementById("clan-display-name").textContent = gameState.clan;
        document.getElementById("clan-member-count").textContent = (gameState.clanMembers || []).length;
        document.getElementById("clan-score").textContent = formatNum(gameState.clanScore || 0);
        document.getElementById("clan-wins").textContent = gameState.clanWins || 0;
        document.getElementById("clan-members-list").innerHTML = (gameState.clanMembers || []).map(m => `
            <div class="flex items-center gap-2 bg-slate-800/60 p-2 rounded-lg">
                <span class="text-lg">🚀</span>
                <span class="text-xs font-bold">${m}</span>
                ${m === currentUser ? '<span class="text-[9px] text-cyan-400 font-black">(You)</span>' : ""}
            </div>
        `).join("");
    } else {
        noClan.classList.remove("hidden"); info.classList.add("hidden");
    }
}

// ===== CHAT =====
function switchChat(type) {
    currentChat = type;
    document.querySelectorAll(".chat-tab-btn").forEach(b => b.classList.toggle("active", b.dataset.chat === type));
    renderChat(type);
}

function renderChat(type) {
    const container = document.getElementById("chat-messages");
    if (!container) return;
    const messages = gameState.chatMessages?.[type] || [];
    container.innerHTML = messages.slice(-50).map(m => `
        <div class="flex gap-2 items-start">
            <span class="text-lg">${m.avatar}</span>
            <div class="flex-1">
                <p class="text-[10px] font-black ${m.user === currentUser ? "text-cyan-400" : "text-slate-400"}">${m.user}</p>
                <p class="text-xs text-white">${m.text}</p>
            </div>
            <span class="text-[9px] text-slate-500">${new Date(m.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
    `).join("");
    container.scrollTop = container.scrollHeight;
}

function sendChat() {
    const input = document.getElementById("chat-input");
    const text = input.value.trim();
    if (!text) return;
    if (!gameState.chatMessages) gameState.chatMessages = { global: [], clan: [], private: {} };
    if (!gameState.chatMessages[currentChat]) gameState.chatMessages[currentChat] = [];
    gameState.chatMessages[currentChat].push({ user: currentUser, avatar: gameState.avatar, text, time: Date.now() });
    input.value = "";
    renderChat(currentChat); saveUser();
    setTimeout(() => {
        const bots = ["Ahmed", "Sara", "Bilal", "Ayesha"];
        const replies = ["Nice!", "GG", "🔥🔥", "Kya baat hai!", "Mashallah"];
        if (!gameState.chatMessages[currentChat]) gameState.chatMessages[currentChat] = [];
        gameState.chatMessages[currentChat].push({ user: bots[Math.floor(Math.random() * bots.length)], avatar: "🚀", text: replies[Math.floor(Math.random() * replies.length)], time: Date.now() });
        renderChat(currentChat);
    }, 1500);
}

function sendQuickEmoji(emoji) {
    const input = document.getElementById("chat-input");
    if (input) { input.value = emoji; sendChat(); }
}

// ===== REFERRAL =====
function copyReferralLink() {
    const link = `https://razavirk.github.io/OHoo/?ref=${gameState.referralCode}`;
    navigator.clipboard.writeText(link).then(() => showToast("Referral link copied!", "success")).catch(() => showToast("Link: " + link, "info"));
}

function initReferralMilestones() { renderReferralMilestones(); }

function renderReferralMilestones() {
    const container = document.getElementById("ref-milestones");
    if (!container) return;
    const milestones = [
        { count: 5, reward: 100 }, { count: 10, reward: 500 },
        { count: 25, reward: 2000 }, { count: 50, reward: 5000 }
    ];
    container.innerHTML = milestones.map(m => {
        const done = gameState.referrals >= m.count;
        return `
            <div class="flex justify-between items-center bg-slate-800/60 p-3 rounded-xl">
                <div>
                    <p class="text-xs font-black ${done ? "text-emerald-400" : "text-slate-300"}">${m.count} Referrals</p>
                    <p class="text-[10px] text-slate-500">${m.reward} PKR bonus</p>
                </div>
                <span class="text-xs font-black ${done ? "text-emerald-400" : "text-slate-500"}">${done ? "✓ DONE" : `${gameState.referrals || 0}/${m.count}`}</span>
            </div>
        `;
    }).join("");
}

// ===== TOURNAMENT =====
function joinTournament() {
    if (gameState.coins < 10000) return showToast("10,000 coins chahiye!", "error");
    if (gameState.tournamentJoined) return showToast("Already joined!", "warning");
    gameState.coins -= 10000;
    gameState.tournamentJoined = true;
    showToast("Tournament join kiya!", "success");
    saveUser(); updateUI(); renderTournament();
}

function renderTournament() {
    const playersEl = document.getElementById("tourney-players");
    if (playersEl) playersEl.textContent = gameState.tournamentJoined ? "1" : "0";
    const poolEl = document.getElementById("tourney-pool");
    if (poolEl) poolEl.textContent = gameState.tournamentJoined ? "5 PKR" : "0 PKR";
}

// ===== WITHDRAW =====
function openWithdrawModal() {
    document.getElementById("withdraw-curr-coins").textContent = formatNum(gameState.coins) + " Coins";
    document.getElementById("withdraw-curr-pkr").textContent = (gameState.coins / COINS_PER_PKR).toFixed(2) + " PKR";
    document.getElementById("withdraw-modal").classList.remove("hidden");
}

function closeWithdrawModal() { document.getElementById("withdraw-modal").classList.add("hidden"); }

function submitWithdrawal() {
    const pkr = parseInt(document.getElementById("withdraw-amount-select").value);
    const method = document.getElementById("withdraw-method").value;
    const name = document.getElementById("withdraw-account-name").value.trim();
    const number = document.getElementById("withdraw-account-number").value.trim();
    if (!name || !number) return showToast("Account details bharo!", "error");
    const coinsNeeded = pkr * COINS_PER_PKR;
    if (gameState.coins < coinsNeeded) return showToast("Coins kam hain!", "error");
    gameState.coins -= coinsNeeded;
    const time = gameState.premium ? PREMIUM_WITHDRAW_HOURS : NORMAL_WITHDRAW_HOURS;
    const record = { id: "W" + Date.now(), pkr, method, name, number, status: "Pending", time: Date.now(), eta: time + " hour(s)" };
    if (!gameState.withdrawHistory) gameState.withdrawHistory = [];
    gameState.withdrawHistory.unshift(record);
    showToast(`Withdrawal submitted! ${time} hour(s) mein process hoga.`, "success");
    closeWithdrawModal(); saveUser(); updateUI(); renderHistory();
}

function renderHistory() {
    const container = document.getElementById("history-container");
    if (!container) return;
    if (!gameState.withdrawHistory || gameState.withdrawHistory.length === 0) {
        container.innerHTML = '<p class="text-xs text-slate-500">Abhi koi withdrawal nahi</p>';
        return;
    }
    container.innerHTML = gameState.withdrawHistory.map(h => `
        <div class="bg-slate-900/90 border border-slate-800 p-3 rounded-xl">
            <div class="flex justify-between">
                <span class="text-xs font-black text-emerald-400">${h.pkr} PKR</span>
                <span class="text-[10px] font-black ${h.status === "Pending" ? "text-amber-400" : h.status === "Completed" ? "text-emerald-400" : "text-rose-400"}">${h.status}</span>
            </div>
            <p class="text-[10px] text-slate-400 mt-1">${h.method} - ${h.number}</p>
            <p class="text-[10px] text-slate-500">${new Date(h.time).toLocaleString()} • ETA: ${h.eta}</p>
        </div>
    `).join("");
}

// ===== PAYMENT =====
function showPaymentModal(name, level, price) {
    currentPayment = { name, level, price };
    document.getElementById("pay-upgrade-name").textContent = name;
    document.getElementById("pay-level").textContent = level;
    document.getElementById("pay-amount").textContent = price + " PKR";
    document.getElementById("payment-modal").classList.remove("hidden");
}

function closePayment() { document.getElementById("payment-modal").classList.add("hidden"); }

function sendWhatsApp() {
    if (!currentPayment) return;
    const msg = `Assalam o Alaikum!%0A%0AMujhe upgrade chahiye:%0AUser: ${currentUser}%0AUpgrade: ${currentPayment.name}%0ALevel: ${currentPayment.level}%0APrice: ${currentPayment.price} PKR%0A%0APayment bhej di hai. Please verify karein.`;
    window.open(`https://wa.me/923270450914?text=${msg}`, "_blank");
    closePayment();
}

// ===== PREMIUM =====
function buyPremium() {
    if (gameState.premium) return showToast("Tum already Premium ho!", "info");
    if ((gameState.purchasedFeatures || []).includes("premium")) { activatePremium(); return; }
    const msg = `Assalam o Alaikum!%0A%0APremium activate karwana hai.%0AUser: ${currentUser}%0APrice: 500 PKR/month%0A%0APayment bhej di hai. Please verify.`;
    window.open(`https://wa.me/923270450914?text=${msg}`, "_blank");
    showToast("Admin ko WhatsApp bhejo. Payment ke baad activate hoga.", "info");
}

function activatePremium() {
    gameState.premium = true;
    gameState.premiumUntil = Date.now() + (30 * 24 * 60 * 60 * 1000);
    if (!gameState.purchasedFeatures) gameState.purchasedFeatures = [];
    if (!gameState.purchasedFeatures.includes("premium")) gameState.purchasedFeatures.push("premium");
    showToast("👑 PREMIUM ACTIVATED! 10x coins!", "success");
    confetti({ particleCount: 300, spread: 120 });
    saveUser(); updateUI();
}

function updatePremiumUI() {
    const el = document.getElementById("premium-status");
    if (!el) return;
    if (gameState.premium) {
        const left = Math.ceil((gameState.premiumUntil - Date.now()) / (1000 * 60 * 60 * 24));
        el.innerHTML = `<span class="text-emerald-400 font-black">ACTIVE</span> - ${left} days left`;
    } else {
        el.innerHTML = `<span class="text-slate-400">Not Active</span>`;
    }
}

// ===== NOTIFICATIONS =====
function toggleNotifications() {
    const c = document.getElementById("notification-center");
    if (!c) return;
    c.classList.toggle("hidden");
    if (!c.classList.contains("hidden")) renderNotifications();
}

function renderNotifications() {
    const container = document.getElementById("notification-list");
    const badge = document.getElementById("notif-badge");
    if (!container) return;
    if (!gameState.notifications || gameState.notifications.length === 0) {
        container.innerHTML = '<p class="text-xs text-slate-500 text-center py-4">No notifications</p>';
        if (badge) badge.classList.add("hidden");
        return;
    }
    const unread = gameState.notifications.filter(n => !n.read).length;
    if (badge) {
        if (unread > 0) { badge.classList.remove("hidden"); badge.textContent = unread; }
        else badge.classList.add("hidden");
    }
    container.innerHTML = gameState.notifications.slice(0, 20).map(n => `
        <div class="bg-slate-800/60 p-2 rounded-lg text-xs ${n.read ? "opacity-60" : ""}">
            <p class="text-white">${n.text}</p>
            <p class="text-[9px] text-slate-500 mt-1">${new Date(n.time).toLocaleString()}</p>
        </div>
    `).join("");
}

function clearNotifications() {
    gameState.notifications = [];
    saveUser(); renderNotifications();
}

function checkNotifications() {}

// ===== NEWS + FAQ + BUG =====
function initNews() { renderNews(); }

function renderNews() {
    const container = document.getElementById("news-container");
    if (!container) return;
    const news = [
        { title: "🎉 Welcome to OhOO Tap!", body: "Naya game launch ho gaya! Khelo aur kamao.", date: "Today" },
        { title: "👑 Premium Launch", body: "Sirf 500 PKR/month mein 10x coins kamayo!", date: "Today" },
        { title: "🏆 Weekly Tournament", body: "Har hafte 500 PKR prize! Join karo.", date: "Today" }
    ];
    container.innerHTML = news.map(n => `
        <div class="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl">
            <h3 class="font-black text-sm text-cyan-300">${n.title}</h3>
            <p class="text-xs text-slate-400 mt-1">${n.body}</p>
            <p class="text-[10px] text-slate-500 mt-2">${n.date}</p>
        </div>
    `).join("");
}

function initFAQ() {
    const container = document.getElementById("faq-container");
    if (!container) return;
    const faqs = [
        { q: "Withdrawal kitne time mein aati hai?", a: "Premium: 1 hour, Normal: 24 hours." },
        { q: "Minimum withdrawal kya hai?", a: "200 PKR (900,000 coins)." },
        { q: "Rate kya hai?", a: "450,000 coins = 100 PKR." },
        { q: "Premium ke fayde?", a: "10x coins, no ads, 1 hour withdrawal." }
    ];
    container.innerHTML = faqs.map(f => `
        <div class="bg-slate-800/60 p-3 rounded-xl">
            <p class="text-xs font-black text-cyan-300">${f.q}</p>
            <p class="text-[11px] text-slate-400 mt-1">${f.a}</p>
        </div>
    `).join("");
}

function submitBug() {
    const text = document.getElementById("bug-report").value.trim();
    if (!text) return showToast("Bug describe karo!", "warning");
    if (!gameState.notifications) gameState.notifications = [];
    gameState.notifications.unshift({ text: "Bug report received. Thanks!", time: Date.now(), read: false });
    document.getElementById("bug-report").value = "";
    showToast("Bug report submit ho gaya!", "success");
    saveUser();
}

// ===== WATCH & EARN =====
function openWatchEarn() {
    document.getElementById("watch-earn-modal").classList.remove("hidden");
    updateAdStats();
    resetAdUI();
}

function closeWatchEarn() {
    if (adInterval) clearInterval(adInterval);
    document.getElementById("watch-earn-modal").classList.add("hidden");
    resetAdUI();
}

function resetAdUI() {
    const placeholder = document.getElementById("ad-video-placeholder");
    const countdown = document.getElementById("ad-countdown");
    if (placeholder) placeholder.classList.remove("hidden");
    if (countdown) countdown.classList.add("hidden");
    const btn = document.getElementById("ad-start-btn");
    if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<i class="fa-solid fa-play"></i> START AD (3000 COINS)`;
    }
}

function startAd() {
    const btn = document.getElementById("ad-start-btn");
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> WATCHING...`;
    }
    const placeholder = document.getElementById("ad-video-placeholder");
    const countdown = document.getElementById("ad-countdown");
    if (placeholder) placeholder.classList.add("hidden");
    if (countdown) countdown.classList.remove("hidden");
    let timeLeft = AD_DURATION;
    document.getElementById("ad-timer-display").textContent = timeLeft;
    adInterval = setInterval(() => {
        timeLeft--;
        document.getElementById("ad-timer-display").textContent = timeLeft;
        if (timeLeft <= 0) {
            clearInterval(adInterval); adInterval = null;
            completeAd();
        }
    }, 1000);
}

function completeAd() {
    addCoins(AD_REWARD, true);
    gameState.adVideosWatched = (gameState.adVideosWatched || 0) + 1;
    gameState.adTotalEarned = (gameState.adTotalEarned || 0) + AD_REWARD;
    showToast(`🎉 +${formatNum(AD_REWARD)} coins! Video complete!`, "success");
    confetti({ particleCount: 150, spread: 80 });
    saveUser(); updateAdStats(); resetAdUI();
}

function updateAdStats() {
    const w = document.getElementById("ad-videos-watched");
    const e = document.getElementById("ad-total-earned");
    if (w) w.textContent = gameState.adVideosWatched || 0;
    if (e) e.textContent = formatNum(gameState.adTotalEarned || 0);
}

// ===== AUTO AD =====
function checkAutoAd() {
    if (!currentUser) return;
    const now = Date.now();
    const lastAd = gameState.lastAutoAdTime || 0;
    if (now >= lastAd + AUTO_AD_COOLDOWN) {
        if ((gameState.coinsSinceLastAd || 0) >= 1000) showAutoAd();
    }
}

function showAutoAd() {
    const modal = document.getElementById("auto-ad-modal");
    if (!modal || !modal.classList.contains("hidden")) return;
    modal.classList.remove("hidden");
    let timeLeft = AUTO_AD_DURATION;
    document.getElementById("auto-ad-timer").textContent = timeLeft;
    autoAdInterval = setInterval(() => {
        timeLeft--;
        document.getElementById("auto-ad-timer").textContent = timeLeft;
        if (timeLeft <= 0) {
            clearInterval(autoAdInterval); autoAdInterval = null;
            finishAutoAd();
        }
    }, 1000);
}

function finishAutoAd() {
    gameState.lastAutoAdTime = Date.now();
    gameState.coinsSinceLastAd = 0;
    addCoins(AUTO_AD_REWARD, true);
    showToast(`+${formatNum(AUTO_AD_REWARD)} coins from ad!`, "success");
    const modal = document.getElementById("auto-ad-modal");
    if (modal) modal.classList.add("hidden");
    saveUser();
}

function skipAutoAd() {
    if (autoAdInterval) clearInterval(autoAdInterval);
    autoAdInterval = null;
    gameState.lastAutoAdTime = Date.now();
    gameState.coinsSinceLastAd = 0;
    const modal = document.getElementById("auto-ad-modal");
    if (modal) modal.classList.add("hidden");
    showToast("Ad skipped. +0 coins", "warning");
    saveUser();
}

// ===== KEYBOARD =====
document.addEventListener("keydown", (e) => {
    const gc = document.getElementById("game-container");
    if (e.code === "Space" && gc && !gc.classList.contains("hidden")) {
        e.preventDefault();
        const btn = document.getElementById("mascot-btn");
        if (btn) {
            const rect = btn.getBoundingClientRect();
            triggerTap({ clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 });
        }
    }
});

// ===== SAVE ON EXIT =====
window.addEventListener("beforeunload", () => {
    if (currentUser && firebaseUser) {
        gameState.lastOnline = Date.now();
        window.FB.updateDoc(
            window.FB.doc(window.FB.db, "users", firebaseUser.uid),
            { ...gameState, updatedAt: window.FB.serverTimestamp() }
        ).catch(() => {});
    }
});

// ===== PRESTIGE =====
function offerPrestige() {
    if (confirm("🎉 Level 100 complete! Prestige karna chahte ho? Sab reset hoga lekin permanent 10x multiplier milega!")) doPrestige();
}

function doPrestige() {
    gameState.prestige = (gameState.prestige || 0) + 1;
    gameState.coins = 0; gameState.lifetimeCoins = 0; gameState.level = 1; gameState.taps = 0;
    gameState.autobotLevel = 0; gameState.energy = MAX_ENERGY;
    showToast(`👑 PRESTIGE ${gameState.prestige}! 10x Multiplier unlocked!`, "success");
    confetti({ particleCount: 300, spread: 120 });
    saveUser(); updateUI();
}

// ===== TERMS (Single Definition) =====
function showTerms() { 
    const m = document.getElementById("terms-modal");
    if (m) m.classList.remove("hidden");
}

function closeTerms() { 
    const m = document.getElementById("terms-modal");
    if (m) m.classList.add("hidden");
}