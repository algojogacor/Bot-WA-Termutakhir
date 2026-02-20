// --- 1. IMPORT MODUL UTAMA (BAILEYS) ---
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    downloadMediaMessage,
    makeCacheableSignalKeyStore,
    fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');

const pino = require('pino');
const fs = require('fs');
const { connectToDB } = require('./helpers/mongodb');
const { MongoClient } = require('mongodb');
const ffmpeg = require('ffmpeg-static');
process.env.FFMPEG_PATH = ffmpeg;

// Database Lokal
const { connectToCloud, loadDB, saveDB, addQuestProgress } = require('./helpers/database');

// --- IMPORT COMMANDS ---
const timeMachineCmd = require('./commands/timemachine');
const economyCmd = require('./commands/economy');
const adminAbuseCmd = require('./commands/adminabuse');
const jobsCmd = require('./commands/jobs');
const chartCmd = require('./commands/chart');
const propertyCmd = require('./commands/property');
const pabrikCommand = require('./commands/pabrik');
const valasCmd = require('./commands/valas');
const stocksCmd = require('./commands/stocks');
const farmingCmd = require('./commands/farming');
const ternakCmd = require('./commands/ternak');
const miningCmd = require('./commands/mining');
const devCmd = require('./commands/developer');
const cryptoCmd = require('./commands/crypto');
const bolaCmd = require('./commands/bola');
const profileCmd = require('./commands/profile');
const battleCmd = require('./commands/battle');
const ttsCmd = require('./commands/tts');
const gameTebakCmd = require('./commands/gameTebak');
const nationCmd = require('./commands/nation');
const rouletteCmd = require('./commands/roulette');
const pdfCmd = require('./commands/pdf');
const robCmd = require('./commands/rob');
const wikiKnowCmd = require('./commands/WikiKnow');
const adminCmd = require('./commands/admin');
const aiCmd = require('./commands/ai');
const slitherCmd = require('./commands/slither_bridge');
const rpgCmd = require('./commands/rpg_bridge');
const minesCmd = require('./commands/mines');
const duelCmd = require('./commands/duel');
const toolsCmd = require('./commands/tools');
const caturCmd = require('./commands/catur');
const imageCmd = require('./commands/image');

// ─── IMPORT FITUR BARU (20 Fitur) ────────────────────────────
const aiToolsCmd   = require('./commands/aitools');
const moodCmd      = require('./commands/mood');
const triviaCmd    = require('./commands/trivia');
const wordleCmd    = require('./commands/wordle');
const akinatorCmd  = require('./commands/akinator');
const portoCmd     = require('./commands/portofolio');
const perkiraanCmd = require('./commands/prakiraan');
const bgToolsCmd   = require('./commands/bgtools');
const shortlinkCmd = require('./commands/shortlink');
const zodiakCmd    = require('./commands/zodiak');
const kreatifCmd   = require('./commands/kreatif');
const analitikCmd  = require('./commands/analitik');
const { trackCommand } = require('./commands/analitik');

// --- 2. KONFIGURASI WHITELIST GRUP ---
const ALLOWED_GROUPS = [
    "120363310599817766@g.us",       // Grup Sodara
    "6282140693010-1590052322@g.us", // Grup Keluarga Wonoboyo
    "120363253471284606@g.us",       // Grup Ambarya
    "120363328759898377@g.us",       // Grup Testingbot
    "120363422854499629@g.us",        // Grup English Area
    "120363426746650307@g.us"
];


// SERVER WEB & API
const express = require('express');
const cors = require('cors'); // Install dulu: npm install cors
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

app.use(cors()); // Biar web bisa akses
app.use(express.json()); // Biar bisa baca data JSON
app.use(express.urlencoded({ extended: true }));

// Folder tempat menyimpan file HTML/JS Catur
app.use('/game', express.static(path.join(__dirname, 'public_catur')));

// API: Web lapor hasil game ke sini
app.post('/api/catur-finish', async (req, res) => {
    const { user, result, bet, level } = req.body;

    // 2. Validasi Database
    const db = global.db;
    if (!db || !db.users) {
        return res.status(503).json({ status: 'error', message: 'Database bot belum siap. Coba lagi.' });
    }

    // 3. Validasi User
    if (!db.users[user]) {
        return res.status(404).json({ status: 'error', message: 'User tidak ditemukan' });
    }

    const userData = db.users[user];
    const taruhan = parseInt(bet) || 0;
    const difficulty = parseInt(level) || 2;

    let prize = 0;
    let text = "";

    // 4. LOGIKA HADIAH BARU (Medium vs Hard)
    if (result === 'win') {
        let multiplier = 1.2; // Default Medium: Untung 20%
        let modeName = "Medium";

        if (difficulty === 3) {
            multiplier = 1.3; // Hard: Untung 30%
            modeName = "Hard";
        }

        // Rumus: Taruhan x Multiplier (Pakai Math.floor biar angkanya bulat)
        prize = Math.floor(taruhan * multiplier);
        const profit = prize - taruhan;

        text = `🎉 MENANG (${modeName})!\n💰 Total Dapat: ${prize}\n📈 Profit Bersih: ${profit}`;

    } else if (result === 'draw') {
        prize = taruhan; // Balik modal
        text = `🤝 Seri! Koin ${prize} dikembalikan.`;
    } else {
        text = `💀 Kamu kalah catur. Koin ${taruhan} hangus.`;
    }

    // 5. Update Database & Save
    userData.balance += prize;

    // Pastikan fungsi saveDB ada (jika pakai helper)
    if (typeof saveDB === 'function') {
        await saveDB(global.db);
    }

    // 6. Kirim respon balik ke Web
    res.json({ status: 'ok', message: text, newBalance: userData.balance });

    console.log(`[CATUR] ${user} -> ${result} (Level: ${difficulty}, Bet: ${taruhan}, Prize: ${prize})`);
});

app.get('/', (req, res) => res.send('<h1>Bot Arya is Running! 🚀</h1>'));
app.listen(port, () => console.log(`Server jalan di port ${port}`));

// --- DI LUAR FUNGSI startBot() ---
const msgRetryCounterCache = new Map();

// ---KONEKSI BAILEYS ---
async function startBot() {
    // 1. KONEKSI DATABASE
    try {
        console.log("🔄 Menghubungkan ke MongoDB Atlas...");
        await connectToCloud();
        global.db = await loadDB();
        if (!global.db.users) global.db.users = {};
        if (!global.db.groups) global.db.groups = {};
        console.log("✅ Database Terhubung!");
    } catch (err) {
        console.error("⚠️ GAGAL KONEK DB:", err.message);
        global.db = { users: {}, groups: {}, market: {}, settings: {} };
    }

    // 2. SETUP BAILEYS
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`🤖 WA Version: v${version.join('.')} (Latest: ${isLatest})`);

    const { state, saveCreds } = await useMultiFileAuthState('auth_baileys');

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false, // Ubah TRUE jika mau scan di terminal
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
        },
        browser: ['Ubuntu', 'Chrome', '20.0.04'],
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 10000,
        retryRequestDelayMs: 5000,
        syncFullHistory: false,
        generateHighQualityLinkPreview: true,
    });

    // --- EVENT HANDLERS ---
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('\n================================================');
            console.log('👇 KODE QR STRING (Copy ke goqr.me):');
            console.log(qr);
            console.log('================================================\n');
        }

        if (connection === 'close') {
            const reason = lastDisconnect.error?.output?.statusCode;
            console.log(`❌ Koneksi terputus. Reason: ${reason}`);

            // LOGIKA RECONNECT PINTAR
            if (reason === DisconnectReason.loggedOut) {
                console.log("⚠️ Sesi Log Out / Diblokir. Hapus folder auth...");
                if (fs.existsSync('./auth_baileys')) fs.rmSync('./auth_baileys', { recursive: true, force: true });
                startBot();
            } else if (reason === 515) {
                console.log("🔄 Restart Biasa (Stream Error). MENYAMBUNG KEMBALI TANPA HAPUS SESI...");
                setTimeout(() => startBot(), 2000);
            } else {
                console.log("🔄 Reconnecting in 5s...");
                setTimeout(() => startBot(), 5000);
            }

        } else if (connection === 'open') {
            console.log('✅ BOT SIAP! 🚀');
            console.log('🔒 Mode: Grup Whitelist');
        }
    });


    sock.ev.on('creds.update', saveCreds);

    // --- MESSAGE HANDLER ---
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        const m = messages[0];
        if (!m.message) return;

        try {
            const remoteJid = m.key.remoteJid;
            const isGroup = remoteJid.endsWith('@g.us');
            const sender = isGroup ? (m.key.participant || m.participant) : remoteJid;
            const pushName = m.pushName || "Tanpa Nama";

            const msgType = Object.keys(m.message)[0];
            const body = m.message.conversation ||
                m.message.extendedTextMessage?.text ||
                m.message.imageMessage?.caption || "";
            
             // ── ADMIN ABUSE INTERACTIVE ──
            if (isGroup) {
                await adminAbuseCmd.handleInteractive(body, sender, remoteJid, global.db)
                    .catch(e => console.error('Error AdminAbuse Interactive:', e.message));
            }

            if (body) console.log(`📨 PESAN DARI ${pushName}: ${body.slice(0, 30)}...`);

            const hasMedia = (msgType === 'imageMessage' || msgType === 'videoMessage' || msgType === 'documentMessage');

            // --- CHAT HELPER ---
            const chat = {
                id: { _serialized: remoteJid },
                isGroup: isGroup,
                sendMessage: async (content) => {
                    if (typeof content === 'string') {
                        await sock.sendMessage(remoteJid, { text: content });
                    } else {
                        await sock.sendMessage(remoteJid, content);
                    }
                }
            };

            // --- MSG HELPER ---
            const msg = {
                body: body,
                from: remoteJid,
                author: sender,
                pushName: pushName,
                hasMedia: hasMedia,
                type: msgType,
                getChat: async () => chat,
                react: async (emoji) => await sock.sendMessage(remoteJid, { react: { text: emoji, key: m.key } }),
                reply: async (text) => await sock.sendMessage(remoteJid, { text: text + "" }, { quoted: m }),
                key: m.key,
                message: m.message,
                extendedTextMessage: m.message.extendedTextMessage
            };
            // SECURITY CHECK
            if (!chat.isGroup) return; // Hanya respon di grup
            if (msg.body === '!idgrup') return msg.reply(`🆔 *ID GRUP:* \`${chat.id._serialized}\``);
            if (!ALLOWED_GROUPS.includes(chat.id._serialized)) return;

            // ==========================================================
            //  DATABASE & LOGIKA USER
            // ==========================================================
            const db = global.db;
            if (!db.users) db.users = {};
            if (!db.market) db.market = {};

            const today = new Date().toISOString().split("T")[0];
            const defaultQuest = {
                daily: [
                    { id: "chat", name: "Ngobrol Aktif", progress: 0, target: 10, reward: 200, claimed: false },
                    { id: "game", name: "Main Casino", progress: 0, target: 3, reward: 300, claimed: false },
                    { id: "sticker", name: "Bikin Stiker", progress: 0, target: 2, reward: 150, claimed: false }
                ],
                weekly: { id: "weekly", name: "Weekly Warrior", progress: 0, target: 100, reward: 2000, claimed: false },
                lastReset: today
            };


            // A. REGISTER NEW USER (Jika user belum ada di database)
            if (!db.users[sender]) {
                const totalUsers = Object.keys(db.users).length;

                db.users[sender] = {
                    // --- DATA UTAMA ---
                    id: totalUsers + 1,
                    name: pushName || "User",
                    balance: 15000000, // Modal Awal 15 Juta
                    bank: 0,
                    debt: 0,
                    xp: 0,
                    level: 1,
                    hp: 100,
    hunger: 100,
    energy: 100,
    lastLifeUpdate: Date.now(),
    isDead: false,

                    // --- FITUR LAMA (RPG/Gacha) ---
                    inv: [],
                    buffs: {},
                    lastDaily: 0,
                    bolaWin: 0, bolaTotal: 0, bolaProfit: 0,
                    crypto: {},
                    quest: typeof defaultQuest !== 'undefined' ? JSON.parse(JSON.stringify(defaultQuest)) : { daily: [], weekly: null },

                    // --- FITUR BARU (EKONOMI & SIMULASI) ---
                    // Wajib ada supaya bot tidak crash saat command dijalankan
                    forex: { usd: 0, eur: 0, jpy: 0, emas: 0 }, // Aset Valas
                    ternak: [], // List Hewan
                    ternak_inv: { dedak: 0, pelet: 0, premium: 0, obat: 0 }, // Pakan
                    farm: { plants: [], inventory: {}, machines: [], processing: [] }, // Pertanian
                    job: null, lastWork: 0, lastSkill: 0, // Profesi
                };
                console.log(`[NEW USER] ${pushName} registered with ID ${totalUsers + 1}`);
            }

            // B. LOAD USER & SAFETY CHECK (AUTO-FIX)
            // Bagian ini menjamin USER LAMA (Legacy) mendapatkan properti baru tanpa reset data.
            const user = db.users[sender];
            if (!user) return; // Safety check

            // Update info dasar
            user.lastSeen = Date.now();
            user.name = pushName || user.name || "User";

            // --- CEK & PERBAIKI DATA LAMA ---
            if (!user.id) user.id = Object.keys(db.users).indexOf(sender) + 1;
            if (typeof user.balance === 'undefined') user.balance = 0;
            if (typeof user.bank === 'undefined') user.bank = 0;
            if (typeof user.debt === 'undefined') user.debt = 0;
            if (!user.crypto) user.crypto = {};
            if (!user.quest && typeof defaultQuest !== 'undefined') user.quest = JSON.parse(JSON.stringify(defaultQuest));

            // --- CEK & PERBAIKI FITUR BARU---
            // 1. Valas & Emas
            if (!user.forex) user.forex = { usd: 0, eur: 0, jpy: 0, emas: 0 };

            // 2. Peternakan
            if (!user.ternak) user.ternak = [];
            if (!user.ternak_inv) user.ternak_inv = { dedak: 0, pelet: 0, premium: 0, obat: 0 };

            // 3. Pertanian & Industri
            if (!user.farm) user.farm = { plants: [], inventory: {}, machines: [], processing: [] };

            // 4. Mining 
            if (!user.mining) user.mining = { racks: [], lastClaim: 0, totalHash: 0 };

            // 4. Profesi & Kriminal
            if (!user.job) user.job = null;
            if (!user.lastWork) user.lastWork = 0;

            // 5. SISTEM KEHIDUPAN (AUTO DECAY)
            const now = Date.now();
            
            // Init jika user lama belum punya status
            if (typeof user.hp === 'undefined') user.hp = 100;
            if (typeof user.hunger === 'undefined') user.hunger = 100;
            if (typeof user.energy === 'undefined') user.energy = 100;
            if (typeof user.lastLifeUpdate === 'undefined') user.lastLifeUpdate = now;
            if (typeof user.isDead === 'undefined') user.isDead = false;

            // Cek Setting Admin (Jika admin matikan status, skip)
            if (db.settings && db.settings.lifeSystem !== false && !user.isDead) {
                const diffMs = now - user.lastLifeUpdate;
                const diffMinutes = Math.floor(diffMs / 60000); // Hitung selisih menit

                if (diffMinutes > 0) {
                    // KONFIGURASI PENGURANGAN (Samakan dengan economy.js)
                    const DECAY_LAPAR = 2;   // -2% per menit
                    const DECAY_ENERGI = 1;  // -1% per menit
                    const DECAY_HP = 5;      // -5% per menit (jika kelaparan)

                    user.hunger -= diffMinutes * DECAY_LAPAR;
                    user.energy -= diffMinutes * DECAY_ENERGI;

                    // Batas Min 0
                    if (user.hunger < 0) user.hunger = 0;
                    if (user.energy < 0) user.energy = 0;

                    // Jika Lapar 0, Darah berkurang
                    if (user.hunger === 0) {
                        user.hp -= diffMinutes * DECAY_HP;
                    }

                    // Cek Kematian
                    if (user.hp <= 0) {
                        user.hp = 0;
                        user.isDead = true;
                        // Denda mati (20%)
                        user.balance = Math.floor(user.balance * 0.8);
                        chat.sendMessage(`💀 *@${sender.split('@')[0]} MATI KELAPARAN/SAKIT!*\nSaldo dipotong 20% untuk biaya pemakaman.\nKetik !rs untuk hidup kembali.`);
                    }
                    
                    user.lastLifeUpdate = now; // Simpan waktu terakhir interaksi
                }
            }

            // ANTI TOXIC
            const toxicWords = ["anjing", "kontol", "memek", "goblok", "idiot", "babi", "tolol", "ppq", "jembut"];
            if (toxicWords.some(k => body.toLowerCase().includes(k))) return msg.reply("⚠️ Jaga ketikan bro, jangan toxic!");

            // DAILY RESET & BUFF CHECK
            if (user.quest?.lastReset !== today) {
                user.quest.daily.forEach(q => { q.progress = 0; q.claimed = false; });
                user.quest.lastReset = today;

                // --- TAMBAHAN BARU: RESET HARIAN ---
                user.dailyIncome = 0; // Reset pendapatan harian jadi 0
                user.dailyUsage = 0;  // Reset limit transfer harian jadi 0
                // -----------------------------------
            }
            // Pastikan variabel ada (Init)
            if (typeof user.dailyIncome === 'undefined') user.dailyIncome = 0;
            if (user.buffs) {
                for (let key in user.buffs) {
                    if (user.buffs[key].active && Date.now() >= user.buffs[key].until) user.buffs[key].active = false;
                }
            }

            // XP & LEVELING
            let xpGain = user.buffs?.xp?.active ? 5 : 2;
            user.xp += xpGain;
            if (user.quest.weekly && !user.quest.weekly.claimed) user.quest.weekly.progress++;
            let nextLvl = Math.floor(user.xp / 100) + 1;
            if (nextLvl > user.level) {
                user.level = nextLvl;
                msg.reply(`🎊 *LEVEL UP!* Sekarang kamu Level *${user.level}*`);
            }
            addQuestProgress(user, "chat");

            // ==========================================================
            //  🕵️ TIME MACHINE LOGGER
            // ==========================================================

            // Masukkan ID Grup Khusus Time Machine disini
            const LOGGING_GROUPS = [
                "120363310599817766@g.us",       // Grup Sodara
                "6282140693010-1590052322@g.us", // Grup Keluarga Wonoboyo
                "120363253471284606@g.us",       // Grup Ambarya
                "120363328759898377@g.us",       // Grup Testingbot
            ];

            // Cek apakah grup ini dipantau, ada teks, dan bukan command
            if (LOGGING_GROUPS.includes(remoteJid) && body && !body.startsWith('!') && !body.startsWith('.')) {

                // Init Database Logs
                if (!db.chatLogs) db.chatLogs = {};
                if (!db.chatLogs[remoteJid]) db.chatLogs[remoteJid] = [];

                // REKAM PESAN (Unlimited)
                db.chatLogs[remoteJid].push({
                    t: Date.now(),
                    u: pushName,
                    m: body
                });
            }

            // PARSE COMMAND
            const isCommand = body.startsWith('!');
            const args = isCommand ? body.slice(1).trim().split(/ +/) : [];
            const command = isCommand ? args.shift().toLowerCase() : "";

            // ─── TRACK ANALYTICS ──────────────────────────────
            if (command && db) {
                try { trackCommand(command, sender, db); } catch(e) {}
            }
            // ==========================================================

            // 1. MODUL NON-PREFIX (Interaktif)
            if (command === 'id' || command === 'cekid') {
                return msg.reply(`🆔 *ID INFO*\nChat: \`${remoteJid}\`\nUser: \`${sender}\``);
            }

            if (typeof pdfCmd !== 'undefined') {
                await pdfCmd(command, args, msg, sender, sock).catch(e => console.error("Error PDF:", e.message));
            }
            await gameTebakCmd(command, args, msg, user, db, body).catch(e => console.error("Error Game:", e.message));

            // 2. MODUL PREFIX (!)
            if (!isCommand) return;

            await ternakCmd(command, args, msg, user, db).catch(e => console.error("Error Ternak:", e.message));
            await adminAbuseCmd(command, args, msg, user, db, sock).catch(e => console.error('Error AdminAbuse:', e.message));
            await toolsCmd(command, args, msg, user, db, sock).catch(e => console.error("Error Tools:", e.message));
            await timeMachineCmd(command, args, msg, user, db, sock);
            await devCmd(command, args, msg, user, db, sock).catch(e => console.error("Error Dev:", e.message));
            await pabrikCommand(command, args, msg, user, db, sock).catch(e => console.error("Error Pabrik:", e.message));
            await economyCmd(command, args, msg, user, db).catch(e => console.error("Error Economy:", e.message));
            await chartCmd(command, args, msg, user, db, sock).catch(e => console.error("Error Chart:", e.message));
            await stocksCmd(command, args, msg, user, db, sock).catch(e => console.error("Error Stocks:", e.message));
            await cryptoCmd(command, args, msg, user, db).catch(e => console.error("Error Crypto:", e.message));
            await propertyCmd(command, args, msg, user, db).catch(e => console.error("Error Property:", e.message));
            await minesCmd(command, args, msg, user, db).catch(e => console.error("Error Mines:", e.message));
            await miningCmd(command, args, msg, user, db, sock).catch(e => console.error("Error Mining:", e.message));
            await duelCmd(command, args, msg, user, db).catch(e => console.error("Error Duel:", e.message));
            await bolaCmd(command, args, msg, user, db, sender).catch(e => console.error("Error Bola:", e.message));
            await nationCmd(command, args, msg, user, db, sock).catch(e => console.error("Error Nation:", e.message));
            await robCmd(command, args, msg, user, db, sock).catch(e => console.error("Error Rob:", e.message));
            await valasCmd(command, args, msg, user, db).catch(e => console.error("Error Valas:", e.message));
            await farmingCmd(command, args, msg, user, db).catch(e => console.error("Error Farming:", e.message));
            await jobsCmd(command, args, msg, user, db).catch(e => console.error("Error Jobs:", e.message));
            await rouletteCmd(command, args, msg, user, db).catch(e => console.error("Error Roulette:", e.message));
            await battleCmd(command, args, msg, user, db).catch(e => console.error("Error Battle:", e.message));
            await ttsCmd(command, args, msg).catch(e => console.error("Error TTS:", e.message));
            await wikiKnowCmd(command, args, msg).catch(e => console.error("Error WikiKnow:", e.message));
            await adminCmd(command, args, msg, user, db).catch(e => console.error("Error Admin:", e.message));
            await rpgCmd(command, args, msg, user, db).catch(e => console.error("Error RPG:", e.message));
            await slitherCmd(command, args, msg, user, db).catch(e => console.error("Error Slither:", e.message));
            await aiCmd(command, args, msg, user, db).catch(e => console.error("Error AI:", e.message));
            await caturCmd(command, args, msg, user, db, sock).catch(e => console.error("Error Catur:", e.message));
            await imageCmd(command, args, msg, user, db, sock).catch(e => console.error("Error Image:", e.message));

            // ─── DISPATCH FITUR BARU ──────────────────────────
            await aiToolsCmd(command, args, msg, user, db, sock, m).catch(e => console.error("Error AITools:", e.message));
            await moodCmd(command, args, msg, user, db).catch(e => console.error("Error Mood:", e.message));
            await triviaCmd(command, args, msg, user, db, body).catch(e => console.error("Error Trivia:", e.message));
            await wordleCmd(command, args, msg, user, db).catch(e => console.error("Error Wordle:", e.message));
            await akinatorCmd(command, args, msg, user, db).catch(e => console.error("Error Akinator:", e.message));
            await portoCmd(command, args, msg, user, db).catch(e => console.error("Error Porto:", e.message));
            await perkiraanCmd(command, args, msg, user, db).catch(e => console.error("Error Prakiraan:", e.message));
            await bgToolsCmd(command, args, msg, user, db, sock, m).catch(e => console.error("Error BGTools:", e.message));
            await shortlinkCmd(command, args, msg, user, db).catch(e => console.error("Error Shortlink:", e.message));
            await zodiakCmd(command, args, msg, user, db).catch(e => console.error("Error Zodiak:", e.message));
            await kreatifCmd(command, args, msg, user, db, sock, m).catch(e => console.error("Error Kreatif:", e.message));
            await analitikCmd(command, args, msg, user, db).catch(e => console.error("Error Analitik:", e.message));

            if (typeof profileCmd !== 'undefined') {
                await profileCmd(command, args, msg, user, db, chat, sock).catch(e => console.error("Error Profile:", e.message));
            }

            // ==========================================================
            //  FITUR STEGANOGRAFI
            // ==========================================================

            // COMMAND: !hide <pesan> (Reply/Kirim Gambar)
            if (command === 'hide') {
                const isImage = (msgType === 'imageMessage');
                const isQuotedImage = m.message.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;

                if (!isImage && !isQuotedImage) return msg.reply("⚠️ Kirim/Reply gambar dengan caption: !hide pesan rahasia");

                const pesanRahasia = args.join(" ");
                if (!pesanRahasia) return msg.reply("⚠️ Mana pesannya? Contoh: !hide Misi Rahasia 007");

                msg.reply("⏳ Sedang menyembunyikan pesan...");

                try {
                    let messageToDownload = m;
                    if (isQuotedImage) {
                        messageToDownload = {
                            key: m.message.extendedTextMessage.contextInfo.stanzaId,
                            message: m.message.extendedTextMessage.contextInfo.quotedMessage
                        };
                    }

                    const buffer = await downloadMediaMessage(
                        messageToDownload,
                        'buffer',
                        {},
                        { logger: pino({ level: 'silent' }) }
                    );

                    const inputPath = `./temp_input_${sender.split('@')[0]}.jpg`;
                    const outputPath = `./temp_output_${sender.split('@')[0]}.png`;

                    fs.writeFileSync(inputPath, buffer);

                    // Pakai 'python3' dan path 'commands/stegano.py'
                    const cmdPython = `python3 commands/stegano.py hide "${inputPath}" "${pesanRahasia}" "${outputPath}"`;

                    exec(cmdPython, async (error, stdout, stderr) => {
                        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);

                        if (error) {
                            console.error("Stegano Error:", error);
                            if (error.message.includes("not found")) {
                                return msg.reply("❌ Error: Python3 tidak terinstall/terdeteksi.");
                            }
                            return msg.reply("❌ Gagal. Pastikan gambar tidak rusak.");
                        }

                        await sock.sendMessage(remoteJid, {
                            document: fs.readFileSync(outputPath),
                            mimetype: 'image/png',
                            fileName: 'RAHASIA.png',
                            caption: '✅ SUKSES! Download file ini (Document) agar pesan aman.'
                        }, { quoted: m });

                        setTimeout(() => {
                            if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
                        }, 5000);
                    });

                } catch (err) {
                    console.log(err);
                    msg.reply("Gagal mendownload gambar.");
                }
            }

            // COMMAND: !reveal (Reply Gambar/Dokumen)
            if (command === 'reveal') {
                const quotedMsg = m.message.extendedTextMessage?.contextInfo?.quotedMessage;
                const isQuotedDoc = quotedMsg?.documentMessage;
                const isQuotedImg = quotedMsg?.imageMessage;

                if (!isQuotedDoc && !isQuotedImg) {
                    return msg.reply("⚠️ Reply gambar/dokumen rahasia dengan !reveal");
                }

                msg.reply("🔍 Sedang membaca pesan...");

                try {
                    const messageToDownload = {
                        key: m.message.extendedTextMessage.contextInfo.stanzaId,
                        message: quotedMsg
                    };

                    const buffer = await downloadMediaMessage(
                        messageToDownload,
                        'buffer',
                        {},
                        { logger: pino({ level: 'silent' }) }
                    );

                    const inputPath = `./temp_reveal_${sender.split('@')[0]}.png`;
                    fs.writeFileSync(inputPath, buffer);

                    // Pakai 'python3' dan path 'commands/stegano.py'
                    const cmdPython = `python3 commands/stegano.py reveal "${inputPath}"`;

                    exec(cmdPython, (error, stdout, stderr) => {
                        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);

                        if (error) return msg.reply("❌ Tidak ditemukan pesan rahasia di file ini (atau format salah).");

                        msg.reply(stdout);
                    });

                } catch (e) {
                    console.log(e);
                    msg.reply("Gagal mengambil media.");
                }
            }


            // MENU UTAMA
                        if (command === 'menu' || command === 'help') {
                const sub  = (args[0] || '').toLowerCase();
                const bal  = Math.floor(user?.balance || 0).toLocaleString('id-ID');
                const hp   = user?.hp   ?? 100;
                const nrg  = user?.energy ?? 100;
                const lvl  = user?.level  ?? 1;
                const xp   = (user?.xp   || 0).toLocaleString('id-ID');

                // ─── helper bar visual ───────────────────────────
                const bar = (val, max = 100, len = 8) => {
                    const fill = Math.round((Math.min(val, max) / max) * len);
                    return '█'.repeat(Math.max(0, fill)) + '░'.repeat(Math.max(0, len - fill));
                };

                // ════════════════════════════════════════════════
                //  MENU UTAMA — !menu
                // ════════════════════════════════════════════════
                if (!sub) {
                    return msg.reply(
`┌──────────────────────────────┐
│   ⚙️  *BOT MULTIFUNGSI*  ⚙️   │
└──────────────────────────────┘

👤 *!menu profil*  — Level, daily, inv, quest, ranking

🏦 *!menu bank*    — Saldo, transfer, pinjam, rob

❤️ *!menu nyawa*   — HP, makan, tidur, RS, AFK mode

🎮 *!menu game*    — Casino, slot, roulette, duel, mines

⚽ *!menu bola*    — Sport betting: 1X2, HDP, O/U, Parlay

🌾 *!menu farming* — Pertanian, pabrik, industri

🐄 *!menu ternak*  — Peternakan, pakan, jual hewan

⛏️ *!menu mining*  — VGA rig, BTC, trading crypto

📈 *!menu investasi*— Saham, valas, emas, properti

💼 *!menu jobs*    — Lowongan, gaji, skill

🏳️ *!menu negara*  — Buat negara, perang, militer

🎉 *!menu event*   — Admin Abuse 30 menit 12 event

🧠 *!menu ai*      — AI tiers, tanya apa saja

🛠️ *!menu tools*   — Stiker, PDF, TTS, steganografi

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💰 Saldo : *Rp ${bal}*
❤️ HP    : [${bar(hp)}] ${hp}%
⚡ Energi: [${bar(nrg)}] ${nrg}%
🎖️ Level : ${lvl}  |  XP: ${xp}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
_Ketik !menu <kategori> untuk detail_
_Contoh: !menu game  |  !menu bola_`
                    );
                }

                // ════════════════════════════════════════════════
                //  !menu profil
                // ════════════════════════════════════════════════
                if (['profil', 'profile', 'akun', 'user'].includes(sub)) {
                    return msg.reply(
`👤 *PROFIL & AKUN*
${'─'.repeat(30)}

📊 *CEK STATUS*
• !me / !profile      → Profil lengkap (HP, saldo, job, level)
• !rank               → XP, level & progress naik level
• !inv / !tas         → Inventory item & buff aktif
• !quest / !misi      → Misi harian & mingguan
• !skill              → Skill bonus dari pekerjaanmu

🎁 *KLAIM HARIAN*
• !daily              → Klaim bonus harian (reset tiap 24 jam)
• !kerja / !work      → Klaim gaji pekerjaan

🏆 *RANKING*
• !top / !leaderboard → Top 10 orang terkaya
• !topbola            → Ranking sport betting
• !topminer           → Ranking mining BTC
• !topnegara          → Ranking negara terkuat
• !dailyrank          → Ranking penghasilan hari ini

🛍️ *TOKO & ITEM*
• !shop               → Toko buff & item spesial
• !buy <id>           → Beli item dari toko
• !use <id>           → Aktifkan/gunakan item

🔗 *AKUN*
• !migrasi @akun_asli → Pindah data dari nomor lama
  _(Berguna saat ganti nomor WA)_

${'─'.repeat(30)}
↩️ Balik: *!menu*`
                    );
                }

                // ════════════════════════════════════════════════
                //  !menu bank
                // ════════════════════════════════════════════════
                if (['bank', 'keuangan', 'duit'].includes(sub)) {
                    return msg.reply(
`🏦 *BANK & KEUANGAN*
${'─'.repeat(30)}

💳 *CEK SALDO & ASET*
• !me / !bank         → Cek saldo, hutang & info akun
• !dompet / !coin     → Cek saldo koin saja
• !pf / !porto        → Portofolio lengkap
• !aset               → Portofolio aset valas

💸 *TRANSAKSI*
• !depo <jml>         → Setor saldo ke bank
• !tarik <jml>        → Tarik saldo dari bank
• !tf @user <jml>     → Transfer ke user
                        ⚠️ Pajak 5%, maks 10 Juta/hari
• !give @user <jml>   → Kirim koin langsung (tanpa pajak)

🏧 *PINJAMAN*
• !pinjam <jml>       → Pinjam koin (Maks 5 Juta, Bunga 20%)
• !bayar <jml>        → Lunasi hutang
• !margin             → Pinjam dana margin (crypto)
• !paydebt            → Lunasi margin debt

🦹 *KRIMINAL*
• !rob @user          → Rampok orang lain
                        ⚠️ Butuh energi, denda 10% jika gagal
• !maling             → Curi random tanpa target

📊 *RANKING*
• !top / !leaderboard → Top 10 orang terkaya
• !dailyrank          → Ranking penghasilan harian

${'─'.repeat(30)}
⚠️ _Hutang tidak dibayar = saldo dipotong otomatis_
↩️ Balik: *!menu*`
                    );
                }

                // ════════════════════════════════════════════════
                //  !menu nyawa
                // ════════════════════════════════════════════════
                if (['nyawa', 'survival', 'life', 'hp'].includes(sub)) {
                    return msg.reply(
`❤️ *LIFE & SURVIVAL SYSTEM*
${'─'.repeat(30)}

📊 *STATUS KAMU SAAT INI*
• ❤️ HP     : [${bar(hp)}] ${hp}%
• ⚡ Energi : [${bar(nrg)}] ${nrg}%

📋 *CEK & PANTAU*
• !me                 → Cek HP, Lapar, Energi & Level
• !hidupstatus        → Status nyawa detail

⚠️ *MEKANISME BAHAYA*
┌─────────────────────────────┐
│ HP ≤ 30%  → ⚠️ Bahaya!     │
│ HP = 0    → 💀 MATI!        │
│ Mati      → Saldo -20%      │
└─────────────────────────────┘
_HP turun jika kamu lapar & kelelahan_

🍽️ *MAKAN & MINUM*
• !makan / !eat       → Makan (Biaya 50 Juta, isi lapar & HP)

😴 *ISTIRAHAT*
• !tidur <jam>        → Tidur 1-10 jam (isi energi & HP)
• !bangun / !wake     → Bangun paksa sebelum waktu habis

🏥 *PENGOBATAN*
• !rs                 → Berobat di Rumah Sakit
                        _(Biaya 500 Juta, HP full seketika)_
• !revive             → Hidup kembali setelah mati

🔕 *MODE AFK*
• !matistatus         → Aktifkan mode AFK (HP tidak turun)
                        _(Gunakan saat mau lama offline)_
• !nyalastatus        → Matikan mode AFK, aktifkan HP normal

💡 *TIPS BERTAHAN HIDUP*
✅ Makan & tidur rutin agar HP stabil
✅ Aktifkan !matistatus sebelum offline lama
✅ HP di bawah 30%? Langsung ke !rs
✅ Jangan pernah biarkan HP mencapai 0!

${'─'.repeat(30)}
↩️ Balik: *!menu*`
                    );
                }

                // ════════════════════════════════════════════════
                //  !menu game
                // ════════════════════════════════════════════════
                if (['game', 'games', 'judi', 'hiburan'].includes(sub)) {
                    return msg.reply(
`🎮 *GAMES & JUDI*
${'─'.repeat(30)}

🎰 *CASINO SOLO*
• !casino <jml>       → Tebak kartu (35% menang, x2)
• !slot <jml>         → Mesin slot
                        Pair 2x = +50% | Jackpot 3x = x75!
• !rolet <pil> <jml>  → Roulette Eropa (0-36)
                        Pilihan: merah|hitam|ganjil|genap|0-36
                        x2 warna/sifat | x15 tebak angka pas
• !tembok <bet> <1-3> → Tebak di balik 3 tembok (x2.5)
• !gacha              → Gacha item (200 koin, jackpot 10.000!)

💣 *MINESWEEPER*
• !bom / !mines <bet> → Mulai Minesweeper (12 kotak, 3 bom)
• !gali / !open <1-12>→ Buka kotak
• !stop / !cashout    → Ambil kemenangan & berhenti kapan saja
  _Makin banyak kotak dibuka = multiplier makin besar!_

⚔️ *PvP (LAWAN PLAYER)*
• !duel @user <bet>   → Russian Roulette 50:50
  └ !terima / !tolak  → Respon tantangan duel
  └ ⚠️ Pajak 10%, duel bonus +2 Juta saat event!
• !battle @user <bet> → Battle RPG Turn-based
  └ !terima           → Terima challenge battle
  └ !nyerah           → Menyerah (kehilangan taruhan)

🧠 *TEBAK BERHADIAH*
• !tebakgambar        → Tebak gambar dari petunjuk
• !asahotak           → Tebak kata dari asah otak
• !susunkata          → Susun huruf acak jadi kata
  └ !hint             → Minta petunjuk (reward berkurang)
  └ !nyerah           → Menyerah & lihat jawaban

🕹️ *MINI GAMES (Browser)*
• !rpg                → RPG turn-based lawan musuh AI
  └ !claim <kode>     → Klaim reward setelah menang
• !slither / !snake   → Main Snake Game di browser
  └ !claimslither <kode> → Klaim skor snake
• !catur <bet>        → Catur online di browser

⚽ *SPORT BETTING*
→ Ketik *!menu bola* untuk panduan lengkap

📌 _Semua game casino dipengaruhi event Winrate Gila_
📌 _(Saat event aktif: winrate naik jadi 85%!)_

${'─'.repeat(30)}
↩️ Balik: *!menu*`
                    );
                }

                // ════════════════════════════════════════════════
                //  !menu bola  — Menu utama sportsbook
                // ════════════════════════════════════════════════
                if (['bola', 'sport', 'betting', 'parlay'].includes(sub)) {
                    return msg.reply(
`⚽ *SPORT BETTING — SPORTSBOOK*
${'─'.repeat(30)}

📚 *PANDUAN UNTUK PEMULA*
• *!menu bolaajar*    → 🔰 Apa itu judi bola? (BACA DULU!)
• *!menu odds*        → 📊 Cara baca odds & hitung untung
• *!menu 1x2*         → 🎯 Panduan taruhan 1X2 (termudah)
• *!menu hdp*         → ⚖️ Panduan Asian Handicap
• *!menu ou*          → 📈 Panduan Over/Under
• *!menu parlayajar*  → 🎰 Panduan Mix Parlay

${'─'.repeat(30)}
📋 *COMMAND TARUHAN*
• !bola               → Daftar semua match aktif
• !odds <ID>          → Detail odds suatu match
• !bet <ID> <jenis> <pil> <jml> → Pasang taruhan
• !parlay <ID> <jenis> <pil>    → Tambah leg parlay
• !parlaylihat        → Cek slip parlay kamu
• !parlaybet <jml>    → Pasang parlay
• !parlaybatal        → Kosongkan slip
• !mybets             → Riwayat taruhan
• !topbola            → Leaderboard profit

${'─'.repeat(30)}
🔧 *ADMIN*
• !updatebola | !addbola | !resultbola
• !tutupbola | !hapusbola

_Belum paham? Ketik *!menu bolaajar* dulu!_`
                    );
                }

                // ════════════════════════════════════════════════
                //  !menu bolaajar — Pengenalan judi bola untuk pemula
                // ════════════════════════════════════════════════
                if (sub === 'bolaajar') {
                    return msg.reply(
`🔰 *PANDUAN JUDI BOLA UNTUK PEMULA*
${'─'.repeat(30)}

*Apa itu Judi Bola?*
Kamu menebak hasil pertandingan sepak bola,
lalu memasang sejumlah uang. Jika tebakanmu
benar → kamu dapat uang berlipat.
Jika salah → uang yang dipasang hangus.

${'─'.repeat(30)}
🎯 *ADA 3 JENIS TARUHAN DI SINI:*

1️⃣ *1X2* (Paling mudah, cocok untuk pemula)
   → Tebak siapa yang menang/seri
   → Ketik *!menu 1x2* untuk penjelasan

2️⃣ *Asian Handicap (HDP)* (Menengah)
   → Sistem voor agar taruhan lebih seimbang
   → Ketik *!menu hdp* untuk penjelasan

3️⃣ *Over/Under (O/U)* (Menengah)
   → Tebak total gol lebih banyak atau sedikit
   → Ketik *!menu ou* untuk penjelasan

🎰 *Mix Parlay* (Lanjutan, potensi besar!)
   → Gabung beberapa pertandingan sekaligus
   → Ketik *!menu parlayajar* untuk penjelasan

${'─'.repeat(30)}
📊 *APA ITU ODDS?*
Odds = angka pengali kemenanganmu.

Contoh: kamu bet Rp 100.000 dengan odds *1.85*
→ Jika menang: dapat Rp 100.000 × 1.85 = *Rp 185.000*
→ Untung bersih: Rp 185.000 - Rp 100.000 = *Rp 85.000*
→ Jika kalah: Rp 100.000 hangus

Makin besar odds = makin besar untung,
tapi biasanya makin kecil kemungkinan menang.

→ Ketik *!menu odds* untuk penjelasan lebih dalam

${'─'.repeat(30)}
⚠️ *PERINGATAN PENTING!*
❗ Judi bola mengandung risiko kehilangan uang
❗ Jangan pasang uang yang tidak siap hilang
❗ Mulai dari taruhan kecil dulu untuk belajar

${'─'.repeat(30)}
*Navigasi Panduan:*
• !menu 1x2       → Mulai dari yang termudah
• !menu odds      → Cara baca odds
• !menu hdp       → Asian Handicap
• !menu ou        → Over/Under
• !menu parlayajar → Mix Parlay
↩️ Balik: *!menu bola*`
                    );
                }

                // ════════════════════════════════════════════════
                //  !menu odds — Cara baca dan hitung odds
                // ════════════════════════════════════════════════
                if (sub === 'odds') {
                    return msg.reply(
`📊 *CARA MEMBACA & MENGHITUNG ODDS*
${'─'.repeat(30)}

*Odds* adalah angka yang menunjukkan berapa
kali lipat uangmu jika menang.

${'─'.repeat(30)}
📐 *RUMUS SEDERHANA:*

  💰 Hasil = Taruhan × Odds
  📈 Untung = Hasil - Taruhan

${'─'.repeat(30)}
🧮 *CONTOH PERHITUNGAN:*

Pertandingan: *Man City vs Arsenal*
Odds yang tersedia:
  🏠 Man City menang : *1.75*
  🤝 Seri            : *3.50*
  ✈️ Arsenal menang  : *4.20*

Kamu bet *Rp 200.000* untuk Man City menang:
  ✅ Jika Man City menang:
     200.000 × 1.75 = *Rp 350.000*
     Untung bersih = *+Rp 150.000*
  ❌ Jika Seri atau Arsenal menang:
     Uang Rp 200.000 *hangus*

${'─'.repeat(30)}
🔍 *CARA BACA ODDS — ARTINYA APA?*

  Odds *1.10 - 1.40* → Favorit berat
  _(Kemungkinan menang besar, untung sedikit)_

  Odds *1.70 - 2.10* → Tim kuat tapi bisa kalah
  _(Kemungkinan menang lumayan, untung lumayan)_

  Odds *2.50 - 4.00* → Tim seimbang / underdog
  _(Kemungkinan menang kecil, untung besar)_

  Odds *5.00 ke atas* → Underdog besar
  _(Jarang menang tapi jika menang = jackpot!)_

${'─'.repeat(30)}
💡 *TIPS MEMBACA ODDS:*
✅ Odds rendah (1.xx) = tim lebih diunggulkan
✅ Odds tinggi (3.xx+) = tim kurang diunggulkan
✅ Seri selalu punya odds tinggi (~3.40)
   karena hasil seri lebih jarang terjadi
✅ Pakai !odds <ID> untuk lihat odds lengkap
   sebelum memasang taruhan

${'─'.repeat(30)}
*Lanjut belajar:*
• !menu 1x2        → Jenis taruhan termudah
• !menu hdp        → Asian Handicap
• !menu ou         → Over/Under
↩️ Balik: *!menu bola*`
                    );
                }

                // ════════════════════════════════════════════════
                //  !menu 1x2 — Panduan taruhan 1X2
                // ════════════════════════════════════════════════
                if (sub === '1x2') {
                    return msg.reply(
`🎯 *PANDUAN TARUHAN 1X2*
${'─'.repeat(30)}

*1X2 adalah jenis taruhan PALING MUDAH.*
Kamu hanya perlu tebak salah satu dari 3:
  *1* = Tim Home (tuan rumah) menang
  *X* = Seri / Draw
  *2* = Tim Away (tamu) menang

${'─'.repeat(30)}
📋 *CONTOH NYATA:*

Pertandingan: *Liverpool (H) vs Chelsea (A)*

Odds yang muncul di !odds:
  🏠 Liverpool menang : *1.85*
  🤝 Seri             : *3.40*
  ✈️ Chelsea menang   : *4.00*

${'─'.repeat(30)}
🧮 *SIMULASI TARUHAN Rp 500.000:*

Pilihan A → Liverpool menang (odds 1.85)
  ✅ Jika Liverpool menang:
     500.000 × 1.85 = *Rp 925.000*
     Untung = *+Rp 425.000*
  ❌ Jika seri/Chelsea menang = hangus

Pilihan B → Seri (odds 3.40)
  ✅ Jika seri:
     500.000 × 3.40 = *Rp 1.700.000*
     Untung = *+Rp 1.200.000*
  ❌ Jika ada yang menang = hangus

Pilihan C → Chelsea menang (odds 4.00)
  ✅ Jika Chelsea menang:
     500.000 × 4.00 = *Rp 2.000.000*
     Untung = *+Rp 1.500.000*
  ❌ Jika Liverpool/seri = hangus

${'─'.repeat(30)}
⌨️ *CARA PASANG TARUHAN 1X2:*

  Misal ID matchnya *LV12*
  !bet LV12 1x2 h 500000  → Bet Home menang
  !bet LV12 1x2 d 500000  → Bet Seri
  !bet LV12 1x2 a 500000  → Bet Away menang

  *h* = Home (tuan rumah)
  *d* = Draw (seri)
  *a* = Away (tamu)

${'─'.repeat(30)}
💡 *STRATEGI UNTUK PEMULA:*
✅ Pilih tim yang jelas lebih kuat (odds rendah)
   → Kemungkinan menang lebih besar
✅ Hindari bet seri jika tidak yakin
   → Seri paling susah diprediksi
✅ Jangan bet Away jika odds terlalu tinggi (>5)
   → Risiko terlalu besar

${'─'.repeat(30)}
*Lanjut belajar:*
• !menu hdp        → Asian Handicap
• !menu ou         → Over/Under
• !menu parlayajar → Mix Parlay
↩️ Balik: *!menu bola*`
                    );
                }

                // ════════════════════════════════════════════════
                //  !menu hdp — Panduan Asian Handicap
                // ════════════════════════════════════════════════
                if (sub === 'hdp') {
                    return msg.reply(
`⚖️ *PANDUAN ASIAN HANDICAP (HDP)*
${'─'.repeat(30)}

*Handicap* = sistem voor (keunggulan buatan)
yang diberikan kepada tim yang lebih lemah
supaya taruhan jadi lebih adil & menarik.

Tim favorit diberi *handicap minus (-)*
artinya mereka harus menang dengan selisih
gol tertentu agar kamu bisa menang.

${'─'.repeat(30)}
🔢 *JENIS-JENIS GARIS HANDICAP:*

*HDP 0 (Pur-pur)*
→ Tidak ada voor. Jika seri = taruhan refund.

*HDP -0.5 (Home voor 0.5)*
→ Home harus menang minimal 1 gol.
   Jika seri → bet Home KALAH, bet Away MENANG

*HDP -1 (Home voor 1)*
→ Home harus menang minimal 2 gol.
   Jika Home menang 1-0 → SERI = refund
   Jika Home menang 2-0 → bet Home MENANG

*HDP -1.5 (Home voor 1.5)*
→ Home harus menang minimal 2 gol.
   Tidak ada kemungkinan refund.

*HDP -0.25 (Home voor 0.25)*
→ Setengah kemenangan/kekalahan berlaku.
   Jika Seri → bet Home kalah SETENGAH (refund 50%)

${'─'.repeat(30)}
🧮 *CONTOH PRAKTEK:*

Match: *Real Madrid (H) vs Atletico (A)*
Odds HDP: Home -1 | Home odds 1.90 | Away odds 1.90
_(Artinya Real Madrid diunggulkan menang 2 gol+)_

Kamu bet *Rp 200.000* untuk Home (Real Madrid -1):

Skenario hasil pertandingan:
  Real Madrid menang 3-0 (selisih 3)
  → -1 sudah terpenuhi ✅ = *MENANG*
  → Dapat: 200.000 × 1.90 = *Rp 380.000*

  Real Madrid menang 2-1 (selisih 1)
  → -1 TIDAK terpenuhi ❌ = *KALAH*
  → Uang hangus

  Real Madrid menang 1-0 (selisih 1 tepat)
  → Adjusted score: 1-0-1 = 0-0 = SERI
  → *REFUND* (uang kembali penuh)

  Seri 0-0 atau Away menang
  → *KALAH*

${'─'.repeat(30)}
⌨️ *CARA PASANG HANDICAP:*

  !bet LV12 hdp h 200000  → Bet Home (tim unggul/diberi handicap)
  !bet LV12 hdp a 200000  → Bet Away (tim yang dapat voor)

💡 *TIPS HANDICAP:*
✅ Bet Away jika kamu pikir tim lemah bisa
   menahan atau menang melawan tim kuat
✅ HDP kecil (0 atau 0.25) = risiko lebih aman
✅ HDP besar (-1.5 ke atas) = butuh selisih gol banyak

${'─'.repeat(30)}
*Lanjut belajar:*
• !menu ou         → Over/Under
• !menu parlayajar → Mix Parlay
↩️ Balik: *!menu bola*`
                    );
                }

                // ════════════════════════════════════════════════
                //  !menu ou — Panduan Over/Under
                // ════════════════════════════════════════════════
                if (sub === 'ou') {
                    return msg.reply(
`📈 *PANDUAN OVER/UNDER (O/U)*
${'─'.repeat(30)}

*Over/Under* = menebak apakah TOTAL GOL
kedua tim lebih banyak (Over) atau lebih
sedikit (Under) dari garis yang ditentukan.

Kamu TIDAK perlu tebak siapa yang menang!
Yang penting total gol sesuai pilihanmu.

${'─'.repeat(30)}
🔢 *CONTOH GARIS O/U:*

Garis *2.5*:
  Over  → total gol MINIMAL 3 (✅ jika 3,4,5,6...)
  Under → total gol MAKSIMAL 2 (✅ jika 0,1,2)
  _(Tidak mungkin refund di garis .5)_

Garis *3.0*:
  Over  → total gol MINIMAL 4 (✅ jika 4,5,6...)
  Under → total gol MAKSIMAL 2 (✅ jika 0,1,2)
  *Tepat 3 gol → REFUND*

Garis *3.5*:
  Over  → total gol MINIMAL 4 (✅ jika 4,5,6...)
  Under → total gol MAKSIMAL 3 (✅ jika 0,1,2,3)
  _(Tidak mungkin refund di garis .5)_

${'─'.repeat(30)}
🧮 *CONTOH PRAKTEK:*

Match: *Barcelona vs PSG*
O/U Line: *2.5* | Over odds: 1.90 | Under odds: 1.90

Kamu bet *Rp 300.000* untuk Over 2.5:

Hasil pertandingan:
  Skor 2-1 (total 3 gol)   → 3 > 2.5 ✅ = *MENANG*
  Skor 3-2 (total 5 gol)   → 5 > 2.5 ✅ = *MENANG*
  Skor 1-1 (total 2 gol)   → 2 < 2.5 ❌ = *KALAH*
  Skor 0-0 (total 0 gol)   → 0 < 2.5 ❌ = *KALAH*
  Skor 1-0 (total 1 gol)   → 1 < 2.5 ❌ = *KALAH*

Jika MENANG: 300.000 × 1.90 = *Rp 570.000*
Untung bersih: *+Rp 270.000*

${'─'.repeat(30)}
⌨️ *CARA PASANG O/U:*

  !bet LV12 ou o 300000  → Bet Over (banyak gol)
  !bet LV12 ou u 300000  → Bet Under (sedikit gol)

💡 *TIPS OVER/UNDER:*
✅ Pertandingan dua tim ofensif → pilih Over
   (Contoh: PSG vs Man City, Liverpool vs Arsenal)
✅ Pertandingan defensive → pilih Under
   (Contoh: Atletico vs Juventus, final piala)
✅ Garis 2.5 paling populer — paling sering dipakai
✅ Garis desimal (.5) tidak ada refund, lebih simpel

${'─'.repeat(30)}
*Lanjut belajar:*
• !menu parlayajar → Mix Parlay
↩️ Balik: *!menu bola*`
                    );
                }

                // ════════════════════════════════════════════════
                //  !menu parlayajar — Panduan Mix Parlay
                // ════════════════════════════════════════════════
                if (sub === 'parlayajar') {
                    return msg.reply(
`🎰 *PANDUAN MIX PARLAY*
${'─'.repeat(30)}

*Mix Parlay* = menggabungkan BEBERAPA taruhan
dari pertandingan BERBEDA menjadi 1 tiket.

✅ Semua pilihan HARUS benar untuk menang
❌ Satu saja salah = SEMUA KALAH

Keunggulannya: Odds DIKALI semua!
→ Modal kecil bisa untung SANGAT besar!

${'─'.repeat(30)}
🧮 *CONTOH PERHITUNGAN PARLAY:*

Kamu pilih 3 pertandingan:
  Match 1: Man City menang   | odds *1.75*
  Match 2: Over 2.5 gol      | odds *1.90*
  Match 3: Real Madrid menang | odds *1.80*

Total odds parlay = 1.75 × 1.90 × 1.80 = *5.985*

Modal: *Rp 100.000*
  ✅ Jika SEMUA 3 benar:
     100.000 × 5.985 = *Rp 598.500*
     Untung bersih = *+Rp 498.500*
  ❌ Jika salah 1 saja:
     Rp 100.000 *hangus*

${'─'.repeat(30)}
📈 *POTENSI DENGAN 5 LEG:*

  Odds rata-rata 1.85 per leg:
  Total odds = 1.85⁵ = *22.18*
  Modal Rp 100.000 → Dapat *Rp 2.218.000*!

  Odds rata-rata 1.85 per leg (8 leg maksimal):
  Total odds = 1.85⁸ = *111*
  Modal Rp 100.000 → Dapat *Rp 11.100.000*!

${'─'.repeat(30)}
⌨️ *CARA PASANG MIX PARLAY STEP BY STEP:*

*Step 1:* Lihat match yang tersedia
  → !bola

*Step 2:* Tambah pertandingan ke slip satu per satu
  → !parlay AB12 1x2 h
  → !parlay CD34 ou o
  → !parlay EF56 hdp a

*Step 3:* Cek slip parlay kamu
  → !parlaylihat

*Step 4:* Jika sudah yakin, pasang taruhan
  → !parlaybet 100000

*Step 5:* Batal jika berubah pikiran
  → !parlaybatal

${'─'.repeat(30)}
📋 *ATURAN MIX PARLAY:*
• Minimal *2 leg* (2 pertandingan)
• Maksimal *8 leg* (8 pertandingan)
• Satu match hanya boleh masuk 1 kali
• Semua match harus belum dimulai
• Satu leg draw = leg tersebut dihapus,
  odds direcalculate dari leg lainnya

${'─'.repeat(30)}
💡 *STRATEGI PARLAY:*
✅ Pilih tim favorit jelas (odds 1.70-1.90)
   → Kemungkinan menang lebih tinggi
✅ Hindari terlalu banyak leg (8 leg sangat susah)
   → 2-4 leg = keseimbangan risiko dan reward
✅ Mix antara 1X2 favorit + Over yang cenderung
   banyak gol untuk odds yang seimbang
⚠️ Parlay sangat berisiko — modal bisa hangus!
   Hanya pasang uang yang siap hilang.

${'─'.repeat(30)}
*Sudah paham? Langsung coba:*
• !bola             → Lihat match tersedia
• !odds <ID>        → Cek odds detail
• !parlay <ID> <jenis> <pil> → Mulai bangun parlay
↩️ Balik: *!menu bola*`
                    );
                }

                // ════════════════════════════════════════════════
                //  !menu farming
                // ════════════════════════════════════════════════
                if (['farming', 'tani', 'pertanian', 'pabrik'].includes(sub)) {
                    return msg.reply(
`🌾 *FARMING & INDUSTRI*
${'─'.repeat(30)}

🌱 *PERTANIAN DASAR*
• !farming / !tani    → Panduan lengkap farming
• !tanam <nama>       → Mulai menanam
  Tanaman: padi | jagung | bawang | kopi | sawit
• !ladang             → Cek status kebun & panen
• !panen              → Ambil hasil yang sudah matang
• !pasar              → Cek harga jual komoditas hari ini
• !jual <nama> <jml>  → Jual hasil panen ke pasar
  _(Harga pasar berubah tiap waktu!)_

🏭 *MESIN PABRIK (Naikkan Nilai Jual)*
• !toko               → Daftar mesin + harga
• !beli <mesin>       → Beli mesin pabrik
  Contoh mesin:
  └ gilingan          → Padi jadi Beras
  └ popcorn_maker     → Jagung jadi Popcorn
  └ penggorengan      → Bawang jadi Bawang Goreng
  └ roaster           → Kopi jadi Kopi Premium
  └ pabrik_minyak     → Sawit jadi Minyak Goreng
• !olah <mesin> <jml> → Masukkan bahan ke mesin
• !pabrik             → Cek status & ambil hasil olahan
• !jual <produk> <jml>→ Jual produk jadi (harga jauh lebih tinggi!)

🏭 *SIXTEEN INDUSTRI (Pabrik Bersama)*
• !pabrik help        → Panduan sistem industri lengkap

  👑 *Bos (Owner Pabrik)*
  • !bangunpabrik <hewan> <tier> → Beli mesin
  • !hire @user                  → Rekrut karyawan
  • !fire @user                  → Pecat karyawan
  • !gudang                      → Cek stok bahan & produk
  • !jualproduk <kode>           → Jual produk ke pasar
  • !service                     → Perbaiki mesin rusak

  👷 *Karyawan (Buruh)*
  • !pabrik           → Cek stamina & info majikan
  • !craft <bahan> <jml> → Proses produksi
  • !ngopi            → Istirahat & isi stamina
  • !resign           → Keluar dari pabrik

💡 *TIPS FARMING*
✅ Sawit = paling menguntungkan, tapi lama
✅ Mesin pabrik = harga jual naik berkali lipat
✅ Cek !pasar sebelum jual — harga naik turun!
✅ Event Musim Panen = hasil jual 3x!
✅ Event Borong Pasar = beli mesin & benih diskon 50%!

${'─'.repeat(30)}
↩️ Balik: *!menu*`
                    );
                }

                // ════════════════════════════════════════════════
                //  !menu ternak
                // ════════════════════════════════════════════════
                if (['ternak', 'ranch', 'hewan', 'kandang'].includes(sub)) {
                    return msg.reply(
`🐄 *PETERNAKAN (RANCH)*
${'─'.repeat(30)}

📖 *INFO & KANDANG*
• !ternak             → Panduan lengkap peternakan
• !kandang            → Cek kondisi semua hewan
  _(lapar / sakit / berat / nilai jual)_

🛒 *BELI HEWAN*
• !belihewan          → Lihat katalog hewan + harga
• !belihewan <jenis>  → Beli hewan ternak
  ┌─────────────────────────────────┐
  │ ayam    •  50rb  → Jual ~180rb  │
  │ gurame  • 200rb  → Jual ~750rb  │
  │ kambing •   3jt  → Jual ~6jt    │
  │ sapi    •  15jt  → Jual ~35jt   │
  │ unta / kuda      → Tier premium  │
  └─────────────────────────────────┘

🌿 *PAKAN & PERAWATAN*
• !tokopakan          → Toko pakan & obat
• !pakan <no> <jenis> → Beri makan hewan
  └ dedak   → Murah, tumbuh lambat
  └ pelet   → Standar, tumbuh sedang
  └ premium → Mahal, tumbuh cepat!
• !obati <no>         → Obati hewan sakit

💰 *JUAL HEWAN*
• !jualhewan <no>     → Jual berdasarkan berat (kg × harga/kg)
  └ 🌟 Bonus +10% jika berat MAX & hewan sehat
  └ ☠️ Bangkai = dijual ke rongsok (sangat murah)

⚠️ *PERHATIAN PENTING!*
❗ Hewan tidak diberi makan lama = MATI
❗ Hewan sakit = tidak tumbuh optimal
❗ Maksimal 8 ekor per kandang
✅ Event Musim Panen = jual hewan 3x harga!
✅ Event Borong Pasar = beli hewan diskon 50%!

${'─'.repeat(30)}
↩️ Balik: *!menu*`
                    );
                }

                // ════════════════════════════════════════════════
                //  !menu mining
                // ════════════════════════════════════════════════
                if (['mining', 'tambang', 'btc', 'miner'].includes(sub)) {
                    return msg.reply(
`⛏️ *MINING & CRYPTO*
${'─'.repeat(30)}

⚠️ *WAJIB BACA DULU!*
→ Ketik *!panduanminer* sebelum mulai mining
  _(Agar tidak rugi beli alat yang salah)_

⛏️ *MINING BTC*
• !mining / !miner    → Dashboard rig, hashrate & listrik
• !claimmining        → Panen BTC (otomatis bayar listrik)
• !topminer           → Ranking hashrate & BTC terbanyak

🛒 *BELI ALAT MINING*
• !shopminer          → Toko VGA legal
  _(Harga naik-turun tiap jam berdasarkan pasar!)_
• !belivga <kode>     → Beli VGA legal
  Contoh: !belivga rtx4090
• !bm / !blackmarket  → Black Market — alat ilegal
  _(Lebih kencang, tapi ada risiko razia polisi!)_

🔧 *UPGRADE RIG*
• !upgrade cooling    → Kurangi risiko overheat
• !upgrade psu        → Hemat listrik 30%
• !upgrade firewall   → Kebal dari !hack orang lain

⚔️ *PvP MINING*
• !hack @user         → Curi BTC milik orang
  _(Perlu Firewall agar tidak bisa di-hack balik!)_

💹 *TRADING CRYPTO*
• !market             → Harga live semua koin crypto
• !buycrypto <koin> <jml>  → Beli crypto
• !sellcrypto <koin> <jml> → Jual crypto
• !pf / !porto        → Cek portofolio crypto + unrealized P/L
• !margin             → Pinjam dana trading (leverage)
• !paydebt            → Bayar margin debt

💡 *TIPS MINING*
✅ PSU upgrade = hemat listrik 30% (ROI cepat)
✅ Firewall = wajib jika punya banyak BTC
✅ Cek !shopminer rutin — harga VGA berubah tiap jam
✅ Alat illegal lebih kencang tapi bisa disita polisi
✅ Event Rush Tambang = cooldown 0, hasil 5x, listrik GRATIS!

${'─'.repeat(30)}
↩️ Balik: *!menu*`
                    );
                }

                // ════════════════════════════════════════════════
                //  !menu investasi
                // ════════════════════════════════════════════════
                if (['investasi', 'saham', 'valas', 'properti'].includes(sub)) {
                    return msg.reply(
`📈 *INVESTASI*
${'─'.repeat(30)}

📊 *PASAR SAHAM BEI*
• !saham / !stock     → Cek semua harga saham real-time
• !belisaham <kode> <jml>  → Beli saham
• !jualsaham <kode> <jml>  → Jual saham
• !pf / !porto        → Portofolio + unrealized P/L
• !chart <kode>       → Grafik pergerakan harga saham
• !dividen            → Klaim dividen (jika ada)
  _Contoh: !belisaham BBCA 100_

💱 *VALAS & EMAS*
• !kurs / !forex      → Kurs live: USD, EUR, JPY & Emas
• !beliemas <gram>    → Beli emas (safe haven, tahan inflasi)
• !jualemas <gram>    → Jual emas ke rupiah
• !beliusd <jml>      → Beli Dollar AS
• !belieur <jml>      → Beli Euro
• !belijpy <jml>      → Beli Yen Jepang
• !jualusd / !jualeur / !jualjpy → Jual kembali ke rupiah
• !aset / !dompetvalas→ Portofolio aset valas + valuasi saat ini

🏢 *PROPERTI & BISNIS*
• !properti           → Katalog bisnis + aset yang kamu punya
• !beliusaha <id> <jml> → Beli bisnis / properti baru
• !collect / !tagih   → Ambil pendapatan pasif dari bisnis
  _(Bisnis menghasilkan uang tiap jam otomatis!)_

💡 *TIPS INVESTASI*
✅ Emas = paling aman saat pasar bergejolak
✅ Saham bisa naik turun drastis — diversifikasi!
✅ Properti = pendapatan pasif tanpa kerja
✅ Crypto berisiko tinggi tapi potensi profit besar

${'─'.repeat(30)}
↩️ Balik: *!menu*`
                    );
                }

                // ════════════════════════════════════════════════
                //  !menu jobs
                // ════════════════════════════════════════════════
                if (['jobs', 'kerja', 'pekerjaan', 'job'].includes(sub)) {
                    return msg.reply(
`💼 *PEKERJAAN (JOBS)*
${'─'.repeat(30)}

📋 *CARI & LAMAR KERJA*
• !jobs               → Lihat semua lowongan + gaji + skill
• !lamar <nama>       → Lamar pekerjaan
  _(Level tertentu membuka pekerjaan bergaji lebih tinggi)_
• !skill              → Lihat skill aktif dari pekerjaanmu

⏱️ *KERJA HARIAN*
• !kerja / !work      → Ambil gaji (ada cooldown, sabarlah!)

🚪 *KELUAR KERJA*
• !resign             → Resign dari pekerjaan saat ini
  ⚠️ _Resign sebelum gajian = kehilangan gaji periode ini!_

📌 _Setiap pekerjaan punya keuntungan tersendiri:_
✅ Gaji berkala yang bisa diklaim rutin
✅ Skill khusus yang memperkuat karakter di game
✅ Beberapa job beri bonus di mining / farming / duel

${'─'.repeat(30)}
↩️ Balik: *!menu*`
                    );
                }

                // ════════════════════════════════════════════════
                //  !menu negara  (TERMUTAKHIR v3.0)
                // ════════════════════════════════════════════════
                if (['negara', 'war', 'perang', 'nation', 'spy', 'spion'].includes(sub)) {
                    // Sub-menu lanjutan
                    const sub2 = (args[1] || '').toLowerCase();

                    // !menu negara infra — Detail bangunan
                    if (['infra','bangunan','infrastruktur','bangun'].includes(sub2)) {
                        return msg.reply(
`🏗️ *PANDUAN INFRASTRUKTUR LENGKAP*
${'─'.repeat(32)}

📌 _Harga naik setiap level! Level 1 = harga dasar, Level 2 = 2x, dst._

🏦 *bank* — Bank Sentral (Maks Lv.5)
   Dasar: Rp 10.000.000.000
   ✅ Pajak +15% per level
   ✅ Kombinasikan dengan \`kilang\` untuk pajak maksimal

🏰 *benteng* — Benteng Pertahanan (Maks Lv.5)
   Dasar: Rp 25.000.000.000
   ✅ Defense +25% per level dari jumlah tentara
   ✅ Wajib dimiliki sebelum perang!

🏥 *rs* — Rumah Sakit (Maks Lv.5)
   Dasar: Rp 5.000.000.000
   ✅ Populasi tumbuh +2% per level per sesi pajak
   ✅ Kurangi korban sipil saat diserang

🕵️ *intel* — Markas Intelijen (Maks Lv.3)
   Dasar: Rp 15.000.000.000
   ✅ Buka SEMUA fitur spionase rahasia
   ✅ Tangkap agen musuh: +10% per level
   ⚠️ WAJIB untuk misi rahasia via DM bot!

🚀 *silo* — Silo Rudal (Maks Lv.2)
   Dasar: Rp 50.000.000.000
   ✅ Buka produksi rudal (\`!bangunrudal\`)
   ✅ Buka serangan udara (\`!serangangudara\`)

📡 *radar* — Radar Anti-Rudal (Maks Lv.3)
   Dasar: Rp 30.000.000.000
   ✅ Tangkis rudal musuh 15% per level
   ✅ Kurangi efek sabotase dari agen musuh

☢️  *nuklir* — Lab Nuklir (Maks Lv.1)
   Dasar: Rp 80.000.000.000
   ✅ Produksi bom nuklir (\`!bangunbom\`)
   ✅ Rudal biasa +50% damage

🏭 *kilang* — Kilang Industri (Maks Lv.3)
   Dasar: Rp 20.000.000.000
   ✅ Pajak +10% per level
   ✅ Populasi tumbuh lebih cepat

⚓ *dermaga* — Dermaga Militer (Maks Lv.2)
   Dasar: Rp 35.000.000.000
   ✅ Buka fitur Blokade Ekonomi
   ✅ Bonus serangan +10%

🎓 *univ* — Universitas Riset (Maks Lv.2)
   Dasar: Rp 12.000.000.000
   ✅ Buka menu \`!riset\` teknologi canggih

🌿 *kebun* — Kebun Rakyat (Maks Lv.5)
   Dasar: Rp 3.000.000.000
   ✅ Stabilitas +1 per jam otomatis per level
   ✅ Paling murah, wajib untuk menjaga ketenangan

⛓️  *penjara* — Penjara Negara (Maks Lv.2)
   Dasar: Rp 8.000.000.000
   ✅ Tangkap agen musuh +20% per level
   ✅ Kurangi efek teror dari spionase

${'─'.repeat(32)}
🛠️ \`!bangun <kode>\`     Bangun/upgrade
🔨 \`!demolish <kode>\`   Bongkar (refund 50%)
↩️ Balik: \`!menu negara\``
                        );
                    }

                    // !menu negara militer — Detail militer
                    if (['militer','perang','war','senjata'].includes(sub2)) {
                        return msg.reply(
`⚔️ *PANDUAN MILITER & PERANG LENGKAP*
${'─'.repeat(32)}

🪖 *REKRUTMEN TENTARA*
• !rekrut <jumlah>      → Rekrut tentara (Rp 50 Juta/orang)
• !demobilisasi <jml>   → Bubarkan tentara (refund 40%)

⚔️ *JENIS SERANGAN*

1️⃣ *Serangan Darat* — \`!serang @user\`
   • Pertempuran tentara vs tentara
   • Benteng meningkatkan pertahanan musuh
   • Menang: Rampas 30–50% kas + hancurkan bangunan
   • Kalah: Rugi logistik 5–13% kas
   • Cooldown: 30 menit

2️⃣ *Serangan Udara* — \`!serangangudara @user\`
   • Butuh Silo Rudal + minimal 1 rudal
   • Rudal bisa ditangkis oleh Radar musuh (15%/lv)
   • Damage: +20–50% lebih besar dari darat
   • Hancurkan bangunan musuh dengan probabilitas tinggi
   • Gunakan \`!serangangudara @user nuklir\` untuk bom nuklir!

☢️ *BOM NUKLIR* — \`!serangangudara @user nuklir\`
   • Damage 3x lipat dari rudal biasa
   • 80% chance hancurkan 2 level bangunan
   • Bypass radar pertahanan musuh
   • MAKSIMAL 3 bom, butuh Lab Nuklir + Silo

⛔ *BLOKADE EKONOMI* — \`!blokade @user\`
   • Bukan serangan langsung, tapi mematikan ekonomi
   • Pajak musuh berkurang 50% selama 4 jam
   • Butuh: Dermaga Militer + Rp 2 Miliar
   • Cooldown: 2 jam

🛡️ *PERTAHANAN*

• !perisai             → Aktifkan perisai 2 jam (Rp 5 Miliar)
  ✅ Kebal: serangan darat, udara, blokade, sabotase
• !bangun benteng      → Defense passif +25%/lv
• !bangun radar        → Tangkis rudal 15%/lv
• !bangun penjara      → Tangkap agen musuh

📊 *FORMULA KEKUATAN (Power Rating)*
\`Power = Tentara × (1 + 0.25×Benteng) × (1 + 0.10×Dermaga)\`
+ bonus Riset Armor Baja +15% jika sudah diriset

💡 *TIPS STRATEGI*
✅ Lakukan \`!spionase\` (DM bot) sebelum menyerang!
✅ Gunakan \`!serangangudara\` untuk bypass Benteng musuh
✅ Blokade musuh sambil kuatkan ekonomimu sendiri
✅ Aliansi = +20% power pertahanan dari sekutu!
✅ Perisai wajib jika kas negara besar & lagi tidak online

${'─'.repeat(32)}
↩️ Balik: \`!menu negara\``
                        );
                    }

                    // !menu negara ekonomi
                    if (['ekonomi','uang','kas','pajak'].includes(sub2)) {
                        return msg.reply(
`💰 *PANDUAN EKONOMI NEGARA LENGKAP*
${'─'.repeat(32)}

📋 *SUMBER PENDAPATAN*

1️⃣ \`!pajaknegara\` — Pajak Rakyat (Cooldown: 1 jam)
   Formula: Populasi × Rp 100.000 × Bonus Bank × Bonus Kilang
   Riset Ekonomi Maju = tambahan +25%
   ⚠️ Blokade aktif = pajak -50%
   ⚠️ Stabilitas < 20% = tidak bisa pungut pajak!

2️⃣ \`!serang @user\` — Rampas kas musuh (30–50%)

3️⃣ \`!serangangudara @user\` — Rampas + hancurkan bangunan

💸 *PENGELUARAN*
• Rekrut tentara: Rp 50 Juta/orang
• Bangun infrastruktur: Rp 3M–80M per lv
• Bangun rudal: Rp 20 Miliar/unit
• Bangun bom nuklir: Rp 100 Miliar/unit
• Perisai: Rp 5 Miliar (2 jam)
• Propaganda: Rp 500 Juta (stabilitas +10–25%)
• Blokade musuh: Rp 2 Miliar
• Gencatan senjata: Rp 1 Miliar
• Sensus negara: Rp 100 Juta
• Rename negara: Rp 1 Miliar

🏦 *KELOLA KAS*
• !subsidi <jml/all>   → Pribadi → Kas (stabilitas +3%)
• !tarikkas <jml/all>  → Kas → Pribadi (pajak -10%)
• !korupsi <jml/all>   → Kas → Pribadi (stabilitas -5–20%)
  ⚠️ Korupsi terlalu besar = REVOLUSI RAKYAT!

📈 *CARA MAKSIMALKAN PAJAK*
Bank Lv.5 (+75%) + Kilang Lv.3 (+30%) + Riset Ekonomi (+25%)
= Total bonus pajak hingga +130% dari basis!

🌿 *JAGA STABILITAS RAKYAT*
• Stabilitas turun = pajak terganggu, ada risiko revolusi
• Cara naikkan: !propaganda | !subsidi | !bangun kebun
• Kebun = +1 stab/jam/level otomatis tanpa biaya tambahan!

${'─'.repeat(32)}
↩️ Balik: \`!menu negara\``
                        );
                    }

                    // !menu negara spion — Panduan spionase
                    if (['spion','intel','rahasia','spy','mata','agen'].includes(sub2)) {
                        return msg.reply(
`🕵️ *PANDUAN SPIONASE RAHASIA*
${'─'.repeat(32)}

⚠️ *PENTING: SEMUA COMMAND SPIONASE HANYA DI DM BOT!*
Mengetik di grup = ketahuan lawan!

📋 *SYARAT SPIONASE*
1. Punya negara (buat: \`!buatnegara\`)
2. Bangun Markas Intelijen: \`!bangun intel\`
3. Chat LANGSUNG ke nomor bot secara pribadi

🔒 *DAFTAR MISI RAHASIA (via DM)*

🔍 \`!spionase @user\` — Intai Musuh
   Biaya: Rp 500 Juta | Sukses: 75%
   Hasil: Data LENGKAP (kas, tentara, rudal, bom, riset, aliansi)

📡 \`!sadap @user\` — Penyadapan
   Biaya: Rp 800 Juta | Sukses: 60%
   Hasil: Jaringan aliansi, history perang, bangunan detail

💣 \`!sabotase @user\` — Sabotase Bangunan
   Biaya: Rp 1,5 Miliar | Sukses: 50%
   Hasil: Turunkan 1 level bangunan acak musuh

💥 \`!teror @user\` — Operasi Teror
   Biaya: Rp 1 Miliar | Sukses: 55%
   Hasil: Stabilitas musuh -10–35%

👑 \`!kudeta @user\` — Picu Kudeta (Intel Lv.2+)
   Biaya: Rp 3 Miliar | Sukses: 30%
   Hasil: Def -20%, Kas -15%, Stab -20–50%
   🔥 Jika stabilitas target = 0: Negara HANCUR!

☠️  \`!racun @user\` — Operasi Racun (Intel Lv.2+)
   Biaya: Rp 2 Miliar | Sukses: 40%
   Hasil: Bunuh 10–20% tentara musuh diam-diam
   🧬 Combo Riset Bio-weapon = damage 2x!

💰 \`!suap @user\` — Suap Jenderal (Intel Lv.2+)
   Biaya: Rp 2,5 Miliar | Sukses: 35%
   Hasil: 5–13% tentara musuh membelot ke kita

💸 \`!curi @user\` — Curi Kas (Intel Lv.1)
   Biaya: Rp 1,2 Miliar | Sukses: 45%
   Hasil: Curi 5–13% kas musuh langsung ke kasmu

📋 *COMMAND LAPORAN (via DM)*
• \`!laporanmata\`       → 7 laporan misi terakhir
• \`!identitasagen\`     → Statistik operasi & profile agen
• \`!tarikagen\`         → Hentikan semua operasi aktif

🔐 *SISTEM KEAMANAN (COUNTER-INTEL)*
• Target punya Intel = ada chance agen TERTANGKAP
  (8% per level Intel + 10% per level Penjara)
• Jika tertangkap: biaya hangus + denda 5% kas
• Target dapat notif samar, identitasmu TIDAK bocor

💡 *TIPS SPIONASE*
✅ \`!spionase\` dulu sebelum misi lain agar tahu state musuh
✅ Riset \`agen_elite\` = sukses rate +15% semua misi
✅ Serang saat stabilitas musuh sudah rendah (efek teror)
✅ Cooldown antar misi: 15 menit

${'─'.repeat(32)}
↩️ Balik: \`!menu negara\``
                        );
                    }

                    // !menu negara riset — Panduan teknologi
                    if (['riset','teknologi','tech','research'].includes(sub2)) {
                        return msg.reply(
`🔬 *PANDUAN RISET TEKNOLOGI*
${'─'.repeat(32)}

📋 *SYARAT*
• Bangun Universitas Riset: \`!bangun univ\`
• Gunakan \`!riset <kode>\` untuk meneliti

🎯 *DAFTAR TEKNOLOGI (Univ Lv.1)*

🎯 \`rudal_pintar\` — Rudal Pintar
   Biaya: Rp 10 Miliar
   ✅ Rudal 30% lebih akurat + damage +45%

🕵️‍♂️ \`agen_elite\` — Agen Elite
   Biaya: Rp 15 Miliar
   ✅ Semua misi spionase +15% chance sukses

💹 \`ekonomi_maju\` — Ekonomi Maju
   Biaya: Rp 20 Miliar
   ✅ Bonus pajak +25% di atas semua multiplier

🛡️ *TEKNOLOGI LANJUTAN (Univ Lv.2)*

🛡️ \`armor_baja\` — Armor Baja
   Biaya: Rp 25 Miliar
   ✅ Defense pasif +15% (masuk formula Power Rating)

🛸 \`drone_serang\` — Drone Serang
   Biaya: Rp 30 Miliar
   ✅ Kerugian tentaramu di serangan darat -20%

🧬 \`bioweapon\` — Bio-weapon
   Biaya: Rp 50 Miliar
   ✅ Misi \`!racun\` = 2x lebih mematikan

💡 *TIPS RISET*
✅ Prioritas pertama: \`ekonomi_maju\` (langsung balik modal)
✅ Jika sering spionase: \`agen_elite\` wajib dimiliki
✅ Jika sering perang: \`armor_baja\` + \`drone_serang\`
✅ Riset permanen — tidak perlu diperpanjang!

${'─'.repeat(32)}
↩️ Balik: \`!menu negara\``
                        );
                    }

                    // !menu negara aliansi
                    if (['aliansi','sekutu','diplomasi','damai'].includes(sub2)) {
                        return msg.reply(
`🤝 *PANDUAN DIPLOMASI & ALIANSI*
${'─'.repeat(32)}

🤝 *SISTEM ALIANSI*
• Maksimal 3 aliansi aktif per negara
• Sekutu menyumbang +20% power saat kamu diserang
• Tidak bisa saling menyerang sesama sekutu

📋 *COMMAND ALIANSI*
• !aliansi @user         → Kirim tawaran aliansi
• !terimaliansi @user    → Terima tawaran
• !tolaklansi @user      → Tolak tawaran
• !listaliansi           → Lihat daftar sekutu
• !bubaraliansi @user    → Putuskan aliansi (DM ke target)

🕊️ *GENCATAN SENJATA*
• !gencatan @user        → Tawarkan gencatan (Rp 1 Miliar)
• !terimagencatan @user  → Terima gencatan
• Efek: Dilarang saling serang 24 jam
• Berguna: Jika negaramu lemah & butuh waktu pulih

📊 *STRATEGI ALIANSI*
Skenario terbaik: 3 sekutu kuat = power bertahan naik 60%

💡 *TIPS DIPLOMASI*
✅ Aliansi dengan negara kuat = tameng gratis
✅ Gencatan = beli waktu untuk rebuild pasca kalah perang
✅ Pantau \`!topnegara\` untuk cari kandidat sekutu ideal
✅ Aliansi bisa diputus kapan saja, tapi relasi bisa rusak!

${'─'.repeat(32)}
↩️ Balik: \`!menu negara\``
                        );
                    }

                    // Menu utama negara (default)
                    return msg.reply(
`🌍 *SISTEM NATION v3.0 — PANDUAN LENGKAP*
${'═'.repeat(32)}

🏛️ *KELOLA NEGARA*
• !negara / !nation       → Dashboard lengkap negaramu
• !buatnegara <nama>      → Dirikan negara (Rp 5 Miliar)
• !topnegara              → Peta kekuatan semua negara
• !statsnegara @user      → Intel publik negara lain (terbatas)
• !sensus                 → Laporan statistik negaramu (Rp 100 Juta)
• !renamekan <nama>       → Ganti nama negara (Rp 1 Miliar)

🏗️ *INFRASTRUKTUR*
• !bangun [kode]          → Katalog & bangun infrastruktur
• !demolish [kode]        → Bongkar bangunan (refund 50%)
  _12 jenis bangunan | Harga naik tiap level!_

🔬 *TEKNOLOGI*
• !riset [kode]           → Katalog & beli riset teknologi
  _6 teknologi permanent | Butuh Universitas_

🪖 *MILITER*
• !rekrut <jml>           → Rekrut tentara (Rp 50 Juta/org)
• !demobilisasi <jml>     → Bubarkan tentara (refund 40%)
• !bangunrudal            → Produksi rudal (Rp 20 Miliar/unit)
• !bangunbom              → Produksi bom nuklir (Rp 100 Miliar)

⚔️ *SERANGAN*
• !serang @user           → Serangan darat (CD: 30 menit)
• !serangangudara @user   → Serangan rudal/nuklir
• !blokade @user          → Blokade ekonomi 4 jam

🛡️ *PERTAHANAN*
• !perisai                → Aktifkan perisai 2 jam (Rp 5 Miliar)

💰 *EKONOMI*
• !pajaknegara            → Pungut pajak rakyat (CD: 1 jam)
• !subsidi <jml/all>      → Isi kas negara
• !tarikkas <jml/all>     → Tarik kas ke dompet pribadi
• !korupsi <jml/all>      → Korupsi! (risiko revolusi)
• !propaganda             → Tenangkan rakyat (Rp 500 Juta)

🤝 *DIPLOMASI*
• !aliansi @user          → Ajukan aliansi (maks 3)
• !terimaliansi @user     → Terima aliansi
• !bubaraliansi @user     → Putuskan aliansi
• !listaliansi            → Lihat sekutu aktif
• !gencatan @user         → Tawari gencatan (Rp 1 Miliar)
• !terimagencatan @user   → Terima gencatan (24 jam)

🔒 *SPIONASE RAHASIA*
  ⚠️ _Hanya di chat PRIBADI ke nomor bot!_
• !spionase @user         → Intai data lengkap musuh (75%)
• !sadap @user            → Sadap aliansi & aktivitas (60%)
• !sabotase @user         → Hancurkan bangunan musuh (50%)
• !teror @user            → Semai kerusuhan (55%)
• !kudeta @user           → Picu pemberontakan (30%)
• !racun @user            → Bunuh tentara diam-diam (40%)
• !suap @user             → Suap jenderal musuh (35%)
• !curi @user             → Curi dari kas negara (45%)
• !laporanmata            → Laporan semua misi
• !identitasagen          → Profil & statistik agenmu
• !tarikagen              → Hentikan semua operasi

${'─'.repeat(32)}
📖 *PANDUAN DETAIL:*
• \`!menu negara infra\`    → Panduan bangunan lengkap
• \`!menu negara militer\`  → Panduan perang & senjata
• \`!menu negara ekonomi\`  → Panduan ekonomi & pajak
• \`!menu negara spion\`    → Panduan spionase rahasia
• \`!menu negara riset\`    → Panduan teknologi
• \`!menu negara aliansi\`  → Panduan diplomasi

${'─'.repeat(32)}
💡 *TIPS AWAL:*
✅ Buat negara → Isi kas → Bangun bank & benteng
✅ Rekrut tentara sebelum diserang siapapun
✅ Bangun intel → chat bot secara pribadi untuk spionase
✅ Cari sekutu kuat sebelum mulai berperang
✅ Perisai wajib jika sering offline!

↩️ Balik: *!menu*`
                    );
                }

                // ════════════════════════════════════════════════
                //  !menu event
                // ════════════════════════════════════════════════
                if (['event', 'abuse', 'adminabuse'].includes(sub)) {
                    return msg.reply(
`🎉 *ADMIN ABUSE EVENT SYSTEM*
${'─'.repeat(30)}

⚡ *KONTROL EVENT (Admin Grup)*
• !adminabuseon       → 🟢 Mulai event (berlangsung 30 menit)
• !adminabuseoff      → 🔴 Matikan paksa event
• !abuseinfo          → ℹ️ Status event yang sedang aktif

🗓️ *CARA KERJA*
┌──────────────────────────────┐
│ ⏱️ Durasi total : 30 menit   │
│ 🔄 Ganti event  : tiap 5 mnt │
│ 🎲 Total event  : 12 (acak)  │
│ 🌐 Scope        : Semua grup │
└──────────────────────────────┘

📋 *12 EVENT RANDOM*
 1. 🌧️ *Hujan Uang*      — Semua dapat koin gratis
 2. 🎰 *Jackpot Bersama* — Taruh 50rb, 1 orang menang semua
 3. 🛒 *Borong Pasar*    — Diskon 50% semua item & hewan
 4. ☄️ *Meteor Langka*   — Ketik *KLAIM* tercepat = hadiah besar
 5. 🌾 *Musim Panen*     — Hasil tani & ternak 3x lipat
 6. ⛏️ *Rush Tambang*    — Cooldown 0 + hasil 5x + listrik gratis
 7. 🎲 *Winrate Gila*    — Casino/Slot/Rolet/Mines winrate 85%!
 8. ⚔️ *Duel Berhadiah*  — Menang duel dapat +2 Juta bonus
 9. 🧠 *Tebak Berhadiah* — Jawab soal pertama = menang besar
10. ⚡ *Balapan Klik*    — Ketik kata paling cepat = menang
11. 📊 *Lomba Aktif*     — Paling banyak chat 5 menit = menang
12. 👾 *Boss Raid*       — Serang boss dengan *!serang*, reward % damage

📌 _Hanya admin grup yang bisa aktifkan event_
📌 _Event interaktif: 1 pemenang per grup_

${'─'.repeat(30)}
↩️ Balik: *!menu*`
                    );
                }

                // ════════════════════════════════════════════════
                //  !menu ai
                // ════════════════════════════════════════════════
                if (['ai', 'tanya', 'bot', 'ask'].includes(sub)) {
                    return msg.reply(
`🧠 *AI SUPER TIERS*
${'─'.repeat(30)}

🤖 *PILIH TIER AI*
┌────────────────────────────────────┐
│ !ai0 <tanya> │ 💎 Priority         │
│              │ Paling pintar tapi  │
│              │ slot terbatas       │
├────────────────────────────────────┤
│ !ai1 <tanya> │ 🧠 Smart/Flagship  │
│              │ Untuk analisis &    │
│              │ pertanyaan serius   │
├────────────────────────────────────┤
│ !ai2 <tanya> │ 🎭 Roleplay        │
│              │ Asik, kreatif &     │
│              │ penuh kepribadian   │
├────────────────────────────────────┤
│ !ai3 <tanya> │ ⚡ Speed           │
│              │ Cepat & ringkas     │
│              │ untuk hal simple    │
├────────────────────────────────────┤
│ !ask <tanya> │ 🚀 Auto-Pilot      │
│ !ai <tanya>  │ Bot pilih tier      │
│              │ terbaik otomatis    │
└────────────────────────────────────┘

🔗 *FITUR LAIN*
• !sharechat / !history → Buat link share history chat dengan AI
  _(Berguna untuk share percakapan ke orang lain)_

💡 *REKOMENDASI PENGGUNAAN*
✅ Pelajaran / tugas   → !ai1 (paling akurat)
✅ Cerita / roleplay   → !ai2 (paling asik)
✅ Jawaban cepat       → !ai3 (paling ngebut)
✅ Tidak tahu tier mana → !ask (auto-pilot)
✅ Analisis mendalam   → !ai0 (terbatas, hemat!)

${'─'.repeat(30)}
↩️ Balik: *!menu*`
                    );
                }

                // ════════════════════════════════════════════════
                //  !menu tools
                // ════════════════════════════════════════════════
                if (['tools', 'media', 'editor', 'utilitas'].includes(sub)) {
                    return msg.reply(
`🛠️ *TOOLS & EDITOR MEDIA*
${'─'.repeat(30)}

🖼️ *STIKER & GAMBAR*
• !sticker            → Ubah gambar/video/GIF jadi stiker WA
• !toimg              → Ubah stiker jadi gambar biasa
• !img <deskripsi>    → 🎨 Generate gambar dengan AI
• !scan               → Ubah gambar jadi hitam-putih (B&W)

📄 *CONVERT KE PDF*
• !topdf              → Mulai mode convert gambar → PDF
  _(Kirim gambar satu per satu setelah aktifkan)_
• !pdfdone            → Selesai & buat file PDF-nya
  _(File PDF akan dikirim ke chat)_

🔊 *SUARA*
• !tts <teks>         → Text-to-Speech (teks jadi audio)

🕰️ *TIME MACHINE — ARSIP CHAT*
• !timemachine        → Buka arsip chat random masa lalu
• !flashback          → Kenangan chat pada jam ini di masa lalu
• !dejavu             → Sama seperti !flashback
• !timemachine <kode> → Navigasi (maju/mundur 1 jam)
  _(Kode didapat dari hasil !timemachine sebelumnya)_

🛠️ *TOOLS:*
• !summarize <link/teks>   → Ringkas artikel AI
• !translate <bhs> <teks>  → Terjemah AI
• !ocr                     → Baca teks dari gambar
• !short <url>             → Persingkat link
• !unshort <url>           → Reveal link asli
• !bg                      → Hapus background foto
• !compress [kualitas]     → Kompres foto
• !enhance                 → Perjelas foto otomatis
• !cuaca <kota>            → Cuaca + kualitas udara
• !prakiraan <kota>        → Prakiraan 5 hari
• !kurspro                 → Kurs lengkap real-time
• !porto                   → Tracker investasi

🎮 *GAME:*
• !trivia [kategori]       → Kuis berhadiah koin
• !wordle                  → Tebak kata 5 huruf
• !akinator                → Tebak karakter AI

🎨 *HIBURAN BARU:*
• !zodiak <tgl/nama>       → Horoskop harian AI
• !cocokan <z1> <z2>       → Cek kecocokan zodiak
• !shio <tahun>            → Shio kamu
• !cerita <tema>           → AI Story interaktif
• !lirik <judul artis>     → Info lirik lagu
• !meme <template>|<teks>  → Buat meme
• !voice <teks>            → Text to voice

📊 *TRACKING:*
• !mood <kata/emoji>       → Log mood harian
• !moodstat                → Grafik mood kamu
• !statbot                 → Status bot
• !topcmd                  → Command terpopuler

🆔 *UTILITAS*
• !id / !cekid        → Cek JID lengkap kamu & grup
• !idgrup             → Cek ID grup (untuk whitelist bot)

${'─'.repeat(30)}
↩️ Balik: *!menu*`
                    );
                }

                // ════════════════════════════════════════════════
                //  Sub-menu tidak dikenal → arahkan ke menu utama
                // ════════════════════════════════════════════════
                return msg.reply(
`❓ Kategori *"${sub}"* tidak ditemukan.

Pilihan yang tersedia:
profil | bank | nyawa | game | bola
farming | ternak | mining | investasi
jobs | negara | event | ai | tools

Contoh: *!menu game*  atau  *!menu bola*

Ketik *!menu* untuk menu utama.`
                );          // ← pastikan ada ) di sini
            }               // ← tutup blok menu

        } catch (e) {
            console.error("Critical Error di Index.js:", e.message);
        }
    });

    // AUTO SAVE (60 Detik)
    setInterval(() => {
        if (global.db) saveDB(global.db);
    }, 60000);
}

startBot();

// ==========================================================
//  PENANGANAN SHUTDOWN (Agar Data Tidak Hilang)
// ==========================================================

async function handleExit(signal) {
    console.log(`🛑 Menerima sinyal ${signal}. Mematikan bot...`);

    // 1. Simpan Database Terakhir (PENTING)
    if (global.db && typeof saveDB === 'function') {
        console.log("💾 Menyimpan database sebelum keluar...");
        await saveDB(global.db);
    }

    // 2. Tutup Koneksi Socket (Baileys) jika ada
    // (Opsional, karena process.exit akan mematikan socket juga)

    console.log("✅ Shutdown selesai. Bye!");
    process.exit(0);
}

// Tangkap sinyal mematikan dari Koyeb/Terminal
process.on('SIGINT', () => handleExit('SIGINT'));
process.on('SIGTERM', () => handleExit('SIGTERM'));
