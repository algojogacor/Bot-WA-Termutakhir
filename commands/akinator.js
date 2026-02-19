/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║              AKINATOR AI — Fitur 11                         ║
 * ║  !akinator   — Mulai permainan Akinator                     ║
 * ║  !ya / !tidak / !mungkin / !tidaktahu — Jawab pertanyaan   ║
 * ║  !akinatorberhenti — Stop game                             ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

require('dotenv').config();
const OpenAI = require('openai');
const { saveDB } = require('../helpers/database');

const client = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
    defaultHeaders: {
        "HTTP-Referer": "https://wa-bot.com",
        "X-Title": "Arya Bot Akinator"
    }
});

// ─── Sesi Akinator ────────────────────────────────────────────
const sesiAkinator = new Map(); // userId -> { pertanyaan, jawaban, pertanyaanKe, selesai }

// ─── Tanya AI untuk pertanyaan berikutnya ─────────────────────
async function generatePertanyaan(riwayat) {
    const systemPrompt = `Kamu adalah Akinator, permainan tebak karakter/tokoh/benda. 
Tugasmu adalah menebak karakter/tokoh/benda yang dipikirkan user melalui serangkaian pertanyaan ya/tidak.
Pertanyaan harus cerdas, efisien, dan mempersempit kemungkinan secara cepat.

Format respons HARUS JSON seperti ini:
{
  "pertanyaan": "Pertanyaan ya/tidak yang informatif",
  "tebakan": null OR "nama karakter jika yakin (>80%)",
  "alasan": "alasan singkat mengapa kamu yakin atau belum" 
}

Aturan:
- Tanya hal yang general dulu (manusia/tokoh fiksi/benda? nyata/fiksi? hidup/sudah meninggal? dll)
- Lalu mempersempit (bidang, era, kebangsaan, dll)
- Setelah 10 pertanyaan, HARUS memberikan tebakan
- Jangan tanya pertanyaan yang sudah ditanya
- Gunakan Bahasa Indonesia
- Format respons harus valid JSON, tidak ada teks lain`;

    const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Riwayat tanya-jawab sejauh ini:\n${riwayat}\n\nBerikan pertanyaan berikutnya atau tebakan dalam format JSON.` }
    ];

    const response = await client.chat.completions.create({
        model: 'google/gemini-2.5-flash',
        messages,
        max_tokens: 500
    });

    const text = response.choices[0]?.message?.content || '{}';
    const cleaned = text.replace(/```json|```/g, '').trim();
    return JSON.parse(cleaned);
}

// ──────────────────────────────────────────────────────────────
module.exports = async (command, args, msg, user, db) => {
    const validCommands = ['akinator', 'ya', 'tidak', 'mungkin', 'tidaktahu', 'entah', 'akinatorberhenti', 'akiberhenti'];
    if (!validCommands.includes(command)) return;

    const userId = msg.author || msg.from;

    // ══════════════════════════════════════════════════════════
    // !akinator — Mulai permainan baru
    // ══════════════════════════════════════════════════════════
    if (command === 'akinator') {
        if (sesiAkinator.has(userId)) {
            return msg.reply('🧞 Akinator sudah aktif! Jawab pertanyaannya dengan `!ya` / `!tidak` / `!mungkin` / `!tidaktahu`');
        }

        await msg.reply(
            `🧞 *AKINATOR*\n` +
            `${'─'.repeat(30)}\n\n` +
            `_"Aku bisa menebak siapa yang kamu pikirkan..."_\n\n` +
            `Pikirkan sebuah *karakter, tokoh, atau benda* apa saja.\n` +
            `Aku akan menebaknya hanya dengan pertanyaan!\n\n` +
            `⏳ _Sedang menyiapkan pertanyaan pertama..._`
        );

        try {
            const awal = await generatePertanyaan('(Belum ada riwayat, ini pertanyaan pertama)');

            sesiAkinator.set(userId, {
                pertanyaanKe: 1,
                riwayat: [],
                currentQ: awal.pertanyaan,
                selesai: false
            });

            return msg.reply(
                `🧞 *AKINATOR — Pertanyaan 1*\n\n` +
                `❓ *${awal.pertanyaan}*\n\n` +
                `Jawab:\n` +
                `✅ \`!ya\`  |  ❌ \`!tidak\`  |  🤔 \`!mungkin\`  |  ❓ \`!tidaktahu\`\n\n` +
                `_Berhenti: \`!akinatorberhenti\`_`
            );
        } catch (e) {
            console.error('Akinator Error:', e.message);
            return msg.reply('❌ Gagal memulai Akinator. Coba lagi.');
        }
    }

    // ══════════════════════════════════════════════════════════
    // Jawaban user
    // ══════════════════════════════════════════════════════════
    if (['ya', 'tidak', 'mungkin', 'tidaktahu', 'entah'].includes(command)) {
        if (!sesiAkinator.has(userId)) {
            return msg.reply('❌ Belum ada game Akinator. Ketik `!akinator` untuk mulai!');
        }

        const sesi = sesiAkinator.get(userId);
        if (sesi.selesai) return;

        const jawabanMap = {
            'ya': 'Ya',
            'tidak': 'Tidak',
            'mungkin': 'Mungkin',
            'tidaktahu': 'Tidak tahu',
            'entah': 'Tidak tahu'
        };

        const jawaban = jawabanMap[command];
        sesi.riwayat.push(`Pertanyaan ${sesi.pertanyaanKe}: "${sesi.currentQ}" → Jawaban: ${jawaban}`);
        sesi.pertanyaanKe++;

        await msg.reply(`💭 _Berpikir..._`);

        try {
            const riwayatStr = sesi.riwayat.join('\n');
            const hasil = await generatePertanyaan(riwayatStr);

            // Jika ada tebakan
            if (hasil.tebakan || sesi.pertanyaanKe > 15) {
                sesi.selesai = true;
                sesiAkinator.delete(userId);

                const tebakan = hasil.tebakan || 'Tidak berhasil menebak';
                return msg.reply(
                    `🧞 *AKINATOR PUNYA TEBAKAN!*\n` +
                    `${'─'.repeat(30)}\n\n` +
                    `Setelah *${sesi.pertanyaanKe - 1} pertanyaan*...\n\n` +
                    `🎯 Apakah yang kamu pikirkan adalah:\n\n` +
                    `✨ *${tebakan.toUpperCase()}* ✨\n\n` +
                    `_${hasil.alasan || ''}_\n\n` +
                    `${'─'.repeat(25)}\n` +
                    `Benar? Ketik \`!ya\` atau \`!tidak\`.\n` +
                    `Main lagi? Ketik \`!akinator\``
                );
            }

            // Lanjut pertanyaan
            sesi.currentQ = hasil.pertanyaan;

            return msg.reply(
                `🧞 *AKINATOR — Pertanyaan ${sesi.pertanyaanKe}*\n\n` +
                `❓ *${hasil.pertanyaan}*\n\n` +
                `✅ \`!ya\`  |  ❌ \`!tidak\`  |  🤔 \`!mungkin\`  |  ❓ \`!tidaktahu\``
            );
        } catch (e) {
            console.error('Akinator Error:', e.message);
            sesiAkinator.delete(userId);
            return msg.reply('❌ Terjadi error. Game dihentikan. Coba `!akinator` lagi.');
        }
    }

    // !akinatorberhenti
    if (command === 'akinatorberhenti' || command === 'akiberhenti') {
        if (!sesiAkinator.has(userId)) return msg.reply('❌ Tidak ada game Akinator aktif.');
        sesiAkinator.delete(userId);
        return msg.reply('🧞 *Akinator dihentikan.* Oke, aku menyerah kali ini...\nMain lagi? `!akinator`');
    }
};
