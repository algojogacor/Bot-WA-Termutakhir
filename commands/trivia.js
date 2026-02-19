/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║           TRIVIA BATTLE — Fitur 8                           ║
 * ║  !trivia [kategori]  — Mulai trivia kuis berhadiah koin     ║
 * ║  !triviastop         — Stop sesi trivia                     ║
 * ║  !triviaskor         — Lihat leaderboard trivia             ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

const { saveDB } = require('../helpers/database');

// ─── BANK SOAL TRIVIA ─────────────────────────────────────────
const SOAL_TRIVIA = {
    umum: [
        { q: 'Apa ibu kota Australia?', a: 'canberra', hint: 'Bukan Sydney atau Melbourne!' },
        { q: 'Berapa jumlah planet di tata surya kita?', a: '8', hint: 'Pluto sudah tidak dihitung' },
        { q: 'Siapa penemu lampu pijar?', a: 'thomas edison', hint: 'Orang Amerika yang terkenal' },
        { q: 'Apa nama gunung tertinggi di dunia?', a: 'everest', hint: 'Ada di perbatasan Nepal-Tibet' },
        { q: 'Berapa sisi yang dimiliki segi enam?', a: '6', hint: 'Segi enam = hex' },
        { q: 'Apa unsur kimia dengan simbol Au?', a: 'emas', hint: 'Logam mulia berwarna kuning' },
        { q: 'Negara mana yang memiliki populasi terbanyak di dunia?', a: 'india', hint: 'Melewati China di 2023' },
        { q: 'Apa nama organ yang memompa darah ke seluruh tubuh?', a: 'jantung', hint: 'Ada di dada sebelah kiri' },
    ],
    indonesia: [
        { q: 'Siapa presiden pertama Indonesia?', a: 'soekarno', hint: 'Proklamator kemerdekaan' },
        { q: 'Apa nama danau terbesar di Indonesia?', a: 'danau toba', hint: 'Ada di Sumatera Utara' },
        { q: 'Indonesia merdeka pada tanggal berapa?', a: '17 agustus 1945', hint: 'Sudah ada di lagu nasional' },
        { q: 'Apa nama gunung berapi paling aktif di Indonesia?', a: 'merapi', hint: 'Ada di Jawa Tengah' },
        { q: 'Suku apa yang menghuni pulau Kalimantan?', a: 'dayak', hint: 'Suku asli Borneo' },
        { q: 'Apa nama alat musik tradisional Jawa yang terbuat dari logam?', a: 'gamelan', hint: 'Dimainkan dipukul' },
        { q: 'Siapa pahlawan nasional yang dijuluki "Singa Podium"?', a: 'bung tomo', hint: 'Pemimpin pertempuran Surabaya 10 Nov' },
    ],
    sains: [
        { q: 'Apa rumus kimia air?', a: 'h2o', hint: '2 Hidrogen + 1 Oksigen' },
        { q: 'Berapa kecepatan cahaya dalam km/s?', a: '300000', hint: '3 x 10^5 km/s' },
        { q: 'Apa nama proses tanaman membuat makanan menggunakan cahaya matahari?', a: 'fotosintesis', hint: 'Foto = cahaya' },
        { q: 'Apa nama planet terdekat dari matahari?', a: 'merkurius', hint: 'Planet paling kecil di tata surya' },
        { q: 'Berapa derajat titik didih air pada tekanan normal?', a: '100', hint: 'Dalam satuan Celsius' },
        { q: 'Apa nama ilmuwan yang menemukan gravitasi saat melihat apel jatuh?', a: 'newton', hint: 'Sir Isaac ...' },
    ],
    sepakbola: [
        { q: 'Siapa pencetak gol terbanyak sepanjang masa di Piala Dunia?', a: 'miroslav klose', hint: 'Pemain Jerman' },
        { q: 'Negara mana yang paling sering juara Piala Dunia?', a: 'brasil', hint: '5 kali juara' },
        { q: 'Apa nama stadion milik Arsenal?', a: 'emirates', hint: 'Disponsori maskapai Timur Tengah' },
        { q: 'Siapa top skor Piala Dunia 2022?', a: 'kylian mbappe', hint: 'Pemain muda Prancis' },
        { q: 'Club apa yang dijuluki "The Red Devils"?', a: 'manchester united', hint: 'Berbasis di Manchester, Inggris' },
    ],
    teknologi: [
        { q: 'Siapa pendiri Microsoft?', a: 'bill gates', hint: 'Orang terkaya di dunia beberapa tahun' },
        { q: 'Apa kepanjangan dari CPU?', a: 'central processing unit', hint: 'Otak dari komputer' },
        { q: 'Bahasa pemrograman apa yang digunakan untuk membuat WhatsApp pertama kali?', a: 'erlang', hint: 'Bukan Java, bukan Python' },
        { q: 'Siapa yang mendirikan Tesla Inc?', a: 'elon musk', hint: 'Juga punya SpaceX' },
        { q: 'Apa nama OS yang dikembangkan oleh Google untuk smartphone?', a: 'android', hint: 'Robot hijau sebagai logonya' },
    ]
};

// ─── State Sesi ───────────────────────────────────────────────
const sesiTrivia = new Map(); // chatId -> { soal, jawaban, hint, kategori, pot, pemain, timeout, mulai }

// ──────────────────────────────────────────────────────────────
module.exports = async (command, args, msg, user, db, body) => {
    const chatId = msg.from;
    const sender = msg.author || msg.from;
    const now = Date.now();

    // ─── PENGECEKAN JAWABAN (tanpa prefix, rebutan) ────────────
    if (!command && sesiTrivia.has(chatId)) {
        const sesi = sesiTrivia.get(chatId);
        if (!body) return;
        const jawabanUser = body.toLowerCase().trim();
        const jawaban = sesi.jawaban.toLowerCase().trim();

        if (jawabanUser === jawaban || jawaban.split(' ').some(w => w.length > 3 && jawabanUser.includes(w))) {
            clearTimeout(sesi.timeout);
            sesiTrivia.delete(chatId);

            // Beri hadiah
            if (!db.users[sender]) db.users[sender] = {};
            const pemenang = db.users[sender];
            const hadiah = sesi.pot;
            if (typeof pemenang.balance === 'undefined') pemenang.balance = 0;
            pemenang.balance += hadiah;

            // Update skor trivia
            if (!pemenang.triviaSkor) pemenang.triviaSkor = 0;
            pemenang.triviaSkor += 1;

            saveDB(db);

            const elapsed = ((now - sesi.mulai) / 1000).toFixed(1);
            return msg.reply(
                `🎉 *BENAR! SELAMAT!*\n\n` +
                `👤 Pemenang: *${msg.pushName || 'Kamu'}*\n` +
                `✅ Jawaban: *${sesi.jawaban}*\n` +
                `⏱️ Waktu: *${elapsed} detik*\n` +
                `💰 Hadiah: *+${hadiah.toLocaleString('id-ID')} koin*\n\n` +
                `Ketik \`!trivia\` untuk soal berikutnya!`
            );
        }
        return;
    }

    const validCommands = ['trivia', 'triviastop', 'triviaskor', 'trivialeader'];
    if (!validCommands.includes(command)) return;

    // ══════════════════════════════════════════════════════════
    // !trivia [kategori]
    // ══════════════════════════════════════════════════════════
    if (command === 'trivia') {
        if (sesiTrivia.has(chatId)) {
            const sesiAktif = sesiTrivia.get(chatId);
            return msg.reply(`⚠️ Masih ada soal aktif!\n\n❓ *${sesiAktif.soal}*\n\n_Ketik \`!triviastop\` untuk skip_`);
        }

        const KATEGORI = Object.keys(SOAL_TRIVIA);
        let kategori = args[0]?.toLowerCase();

        if (!kategori || !SOAL_TRIVIA[kategori]) {
            kategori = KATEGORI[Math.floor(Math.random() * KATEGORI.length)];
        }

        const bankSoal = SOAL_TRIVIA[kategori];
        const soalData = bankSoal[Math.floor(Math.random() * bankSoal.length)];

        const hadiah = Math.floor(Math.random() * 400) + 100; // 100–500 koin
        const WAKTU = 30; // 30 detik

        const timeout = setTimeout(async () => {
            if (sesiTrivia.has(chatId)) {
                sesiTrivia.delete(chatId);
                try {
                    await msg.reply(`⏰ *WAKTU HABIS!*\n\nJawaban yang benar: *${soalData.a}*\n\nKetik \`!trivia\` untuk coba lagi.`);
                } catch (e) { /* ignore */ }
            }
        }, WAKTU * 1000);

        sesiTrivia.set(chatId, {
            soal: soalData.q,
            jawaban: soalData.a,
            hint: soalData.hint,
            kategori,
            pot: hadiah,
            timeout,
            mulai: now
        });

        return msg.reply(
            `🧠 *TRIVIA BATTLE!*\n` +
            `${'─'.repeat(30)}\n\n` +
            `📚 Kategori: *${kategori.toUpperCase()}*\n` +
            `💰 Hadiah: *${hadiah.toLocaleString('id-ID')} koin*\n` +
            `⏱️ Waktu: *${WAKTU} detik*\n\n` +
            `❓ *${soalData.q}*\n\n` +
            `_Ketik jawabannya langsung di chat! (tanpa !)_\n` +
            `Butuh bantuan? Ketik \`!hint\``
        );
    }

    // !triviastop
    if (command === 'triviastop') {
        if (!sesiTrivia.has(chatId)) return msg.reply('❌ Tidak ada sesi trivia aktif.');
        const sesi = sesiTrivia.get(chatId);
        clearTimeout(sesi.timeout);
        sesiTrivia.delete(chatId);
        return msg.reply(`🛑 Trivia dihentikan.\n\nJawaban: *${sesi.jawaban}*`);
    }

    // !triviaskor / !trivialeader
    if (command === 'triviaskor' || command === 'trivialeader') {
        const allUsers = Object.entries(db.users || {})
            .filter(([, u]) => u.triviaSkor && u.triviaSkor > 0)
            .sort(([, a], [, b]) => (b.triviaSkor || 0) - (a.triviaSkor || 0))
            .slice(0, 10);

        if (allUsers.length === 0) return msg.reply('📊 Belum ada skor trivia. Mainkan \`!trivia\` dulu!');

        const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
        let papan = `🧠 *LEADERBOARD TRIVIA*\n${'─'.repeat(30)}\n\n`;
        allUsers.forEach(([id, u], i) => {
            const nama = u.name || u.pushName || id.replace('@s.whatsapp.net', '');
            papan += `${medals[i]} *${nama}* — ${(u.triviaSkor || 0)} benar\n`;
        });

        papan += `\n${'─'.repeat(25)}\n`;
        papan += `Kamu: *${user.triviaSkor || 0}* benar`;
        return msg.reply(papan);
    }
};
