/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║            DUNGEON CRAWLER AI — Fitur 12                    ║
 * ║  !dungeon          — Masuk dungeon                          ║
 * ║  !dungeon maju/serang/lari/ambil/status — Aksi             ║
 * ║  !dungeonberhenti  — Keluar dungeon                         ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

require('dotenv').config();
const OpenAI = require('openai');
const { saveDB } = require('../helpers/database');

const client = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
    defaultHeaders: { "HTTP-Referer": "https://wa-bot.com", "X-Title": "Arya Bot Dungeon" }
});

// ─── Sesi dungeon per user ─────────────────────────────────────
const sesiDungeon = new Map();

// ─── Generate narasi dungeon dengan AI ────────────────────────
async function generateDungeon(context, aksi, state) {
    const systemPrompt = `Kamu adalah Game Master untuk game Dungeon Crawler berbasis teks dalam Bahasa Indonesia.
Buat narasi petualangan yang seru, dramatis, dan immersive.

State pemain saat ini:
- Nama: ${state.nama}
- HP: ${state.hp}/${state.maxHp}
- Level: ${state.level}
- Emas: ${state.emas}
- Item: ${state.items.join(', ') || 'kosong'}
- Lantai Dungeon: ${state.lantai}
- Musuh saat ini: ${state.musuh || 'Tidak ada'}

Riwayat singkat: ${context}
Aksi pemain: ${aksi}

Buat respons dalam format JSON:
{
  "narasi": "Narasi dramatis 2-3 kalimat tentang apa yang terjadi",
  "situasi": "menjelajah | pertarungan | dialog | ditemukan_item | level_naik | mati | boss | menang",
  "musuh": "nama musuh jika ada pertarungan, null jika tidak",
  "musuhHp": 0-100,
  "hpChange": angka negatif jika kena serangan, 0 jika tidak,
  "emasChange": angka positif jika dapat emas, 0 jika tidak,
  "itemBaru": "nama item jika ada, null jika tidak",
  "pilihan": ["Aksi 1", "Aksi 2", "Aksi 3"],
  "pesanKhusus": "Pesan khusus jika level naik/item epic/boss dll, null jika biasa"
}

Aturan:
- Narasi seru dan berbahasa Indonesia yang vivid
- Boss muncul di lantai kelipatan 5
- Item yang didapat bisa: pedang, tameng, ramuan HP, kunci, mantra, dll
- Musuh: goblin, skeleton, troll, witch, dragon, dll disesuaikan lantai
- JSON harus valid, tidak ada teks lain`;

    const response = await client.chat.completions.create({
        model: 'google/gemini-2.5-flash',
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: 'Generate dungeon event sesuai konteks.' }
        ],
        max_tokens: 800
    });

    const text = response.choices[0]?.message?.content || '{}';
    const cleaned = text.replace(/```json|```/g, '').trim();
    return JSON.parse(cleaned);
}

// ─── Render HP bar ─────────────────────────────────────────────
function hpBar(hp, maxHp) {
    const pct = hp / maxHp;
    const filled = Math.round(pct * 10);
    const bar = '❤️'.repeat(filled) + '🖤'.repeat(10 - filled);
    return `${bar} ${hp}/${maxHp}`;
}

// ──────────────────────────────────────────────────────────────
module.exports = async (command, args, msg, user, db) => {
    const validCommands = ['dungeon', 'dungeonberhenti', 'dungeonkeluar', 'dungeonstatus'];
    if (!validCommands.includes(command)) return;

    const userId = msg.author || msg.from;
    const nama = user.name || msg.pushName || 'Petualang';

    // Init dungeon stats
    if (!user.dungeonStat) user.dungeonStat = { totalRun: 0, bestFloor: 0, totalKill: 0 };

    // ══════════════════════════════════════════════════════════
    // !dungeon — Mulai atau lanjutkan aksi
    // ══════════════════════════════════════════════════════════
    if (command === 'dungeon') {
        const aksi = args.join(' ').toLowerCase() || 'mulai';

        // ─── Mulai dungeon baru ───────────────────────────────
        if (!sesiDungeon.has(userId)) {
            if (aksi !== 'mulai' && aksi !== '') {
                return msg.reply('❌ Belum ada dungeon aktif! Ketik `!dungeon` untuk masuk.');
            }

            const state = {
                nama,
                hp: 100,
                maxHp: 100,
                level: 1,
                emas: 0,
                items: [],
                lantai: 1,
                musuh: null,
                musuhHp: 0,
                riwayat: [],
                totalLangkah: 0
            };

            await msg.reply('⚔️ _Memasuki dungeon..._');

            try {
                const hasil = await generateDungeon('(Baru masuk dungeon)', 'Masuki dungeon pertama kali', state);

                state.riwayat.push(hasil.narasi);
                if (hasil.musuh) state.musuh = hasil.musuh;
                if (hasil.musuhHp) state.musuhHp = hasil.musuhHp;

                sesiDungeon.set(userId, state);
                user.dungeonStat.totalRun++;
                saveDB(db);

                const pilihan = (hasil.pilihan || ['Maju', 'Periksa sekitar', 'Kembali'])
                    .map((p, i) => `${i + 1}. \`!dungeon ${p.toLowerCase()}\``)
                    .join('\n');

                return msg.reply(
                    `⚔️ *DUNGEON CRAWLER*\n` +
                    `${'─'.repeat(30)}\n\n` +
                    `🗡️ *${nama}* memasuki kegelapan...\n\n` +
                    `📖 ${hasil.narasi}\n\n` +
                    `${'─'.repeat(25)}\n` +
                    `❤️ HP: ${hpBar(state.hp, state.maxHp)}\n` +
                    `🏰 Lantai: ${state.lantai} | ⭐ Level: ${state.level}\n` +
                    `💰 Emas: ${state.emas}\n\n` +
                    `🎮 *Pilihan Aksi:*\n${pilihan}\n\n` +
                    `_Atau ketik aksi bebas: \`!dungeon <aksi>\`_`
                );
            } catch (e) {
                console.error('Dungeon Error:', e.message);
                return msg.reply('❌ Gagal memulai dungeon. Coba lagi.');
            }
        }

        // ─── Lanjutkan aksi di dungeon ────────────────────────
        const state = sesiDungeon.get(userId);
        state.totalLangkah++;

        await msg.reply('⚔️ _Memproses aksi..._');

        try {
            const konteks = state.riwayat.slice(-3).join(' | ');
            const hasil = await generateDungeon(konteks, aksi, state);

            // Update state
            if (hasil.hpChange) state.hp = Math.max(0, Math.min(state.maxHp, state.hp + hasil.hpChange));
            if (hasil.emasChange) state.emas += hasil.emasChange;
            if (hasil.itemBaru && state.items.length < 10) state.items.push(hasil.itemBaru);
            if (hasil.musuh) { state.musuh = hasil.musuh; state.musuhHp = hasil.musuhHp || 50; }
            if (hasil.situasi === 'pertarungan' && hasil.musuhHp <= 0) {
                state.musuh = null;
                state.musuhHp = 0;
                state.lantai++;
                user.dungeonStat.totalKill++;
            }
            if (hasil.situasi === 'level_naik') {
                state.level++;
                state.maxHp += 20;
                state.hp = Math.min(state.maxHp, state.hp + 30);
            }

            state.riwayat.push(hasil.narasi);
            if (state.riwayat.length > 10) state.riwayat.shift();

            if (state.lantai > user.dungeonStat.bestFloor) {
                user.dungeonStat.bestFloor = state.lantai;
            }

            // ─── MATI ─────────────────────────────────────────
            if (state.hp <= 0 || hasil.situasi === 'mati') {
                sesiDungeon.delete(userId);
                saveDB(db);
                return msg.reply(
                    `💀 *KAMU GUGUR!*\n` +
                    `${'─'.repeat(30)}\n\n` +
                    `📖 ${hasil.narasi}\n\n` +
                    `${'─'.repeat(25)}\n` +
                    `📊 *Hasil Run:*\n` +
                    `🏰 Lantai Terdalam: ${state.lantai}\n` +
                    `⭐ Level Tercapai: ${state.level}\n` +
                    `💰 Emas Terkumpul: ${state.emas}\n` +
                    `👾 Total Langkah: ${state.totalLangkah}\n\n` +
                    `_Coba lagi? \`!dungeon\`_`
                );
            }

            // ─── MENANG / BOSS DEFEAT ─────────────────────────
            if (hasil.situasi === 'menang') {
                const hadiah = state.emas + (state.level * 100);
                user.balance = (user.balance || 0) + hadiah;
                sesiDungeon.delete(userId);
                saveDB(db);
                return msg.reply(
                    `🏆 *DUNGEON CLEARED!*\n` +
                    `${'─'.repeat(30)}\n\n` +
                    `📖 ${hasil.narasi}\n\n` +
                    `🎉 *SELAMAT!* Kamu berhasil menaklukkan dungeon!\n\n` +
                    `💰 Hadiah: *+${hadiah.toLocaleString('id-ID')} koin*\n` +
                    `🏆 Best Floor: ${user.dungeonStat.bestFloor}\n\n` +
                    `_Main lagi? \`!dungeon\`_`
                );
            }

            saveDB(db);

            const pesanKhusus = hasil.pesanKhusus ? `\n✨ *${hasil.pesanKhusus}*\n` : '';
            const pilihan = (hasil.pilihan || ['Maju', 'Serang', 'Kabur'])
                .map((p, i) => `${i + 1}. \`!dungeon ${p.toLowerCase()}\``)
                .join('\n');

            return msg.reply(
                `⚔️ *DUNGEON — Lantai ${state.lantai}*\n` +
                `${'─'.repeat(30)}\n\n` +
                `📖 ${hasil.narasi}\n` +
                pesanKhusus +
                `\n${'─'.repeat(25)}\n` +
                `❤️ HP: ${hpBar(state.hp, state.maxHp)}\n` +
                `🏰 Lantai: ${state.lantai} | ⭐ Level: ${state.level}\n` +
                `💰 Emas: ${state.emas}\n` +
                (state.musuh ? `👾 Musuh: *${state.musuh}* (HP: ${state.musuhHp}%)\n` : '') +
                (state.items.length > 0 ? `🎒 Item: ${state.items.slice(-3).join(', ')}\n` : '') +
                `\n🎮 *Pilihan:*\n${pilihan}`
            );
        } catch (e) {
            console.error('Dungeon Error:', e.message);
            return msg.reply('❌ Error saat memproses aksi. Coba lagi atau `!dungeonberhenti`');
        }
    }

    // !dungeonberhenti / !dungeonkeluar
    if (command === 'dungeonberhenti' || command === 'dungeonkeluar') {
        if (!sesiDungeon.has(userId)) return msg.reply('❌ Tidak ada sesi dungeon aktif.');
        const state = sesiDungeon.get(userId);
        sesiDungeon.delete(userId);
        return msg.reply(
            `🚪 *Keluar dari Dungeon*\n\n` +
            `Kamu berhasil kabur dengan selamat!\n` +
            `🏰 Lantai terdalam: ${state.lantai}\n` +
            `💰 Emas: ${state.emas}\n\n` +
            `_Kembali lagi kapanpun dengan \`!dungeon\`_`
        );
    }

    // !dungeonstatus
    if (command === 'dungeonstatus') {
        const s = user.dungeonStat;
        return msg.reply(
            `📊 *STATISTIK DUNGEON*\n` +
            `${'─'.repeat(25)}\n\n` +
            `🏃 Total Run: ${s.totalRun}\n` +
            `🏰 Best Floor: ${s.bestFloor}\n` +
            `☠️ Total Kill: ${s.totalKill}\n\n` +
            `_Masuk dungeon: \`!dungeon\`_`
        );
    }
};
