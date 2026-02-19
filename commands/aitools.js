/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║         AI TOOLS — SUMMARIZE | TRANSLATE | OCR              ║
 * ║  Fitur 1: !summarize — Ringkas artikel/link pakai AI        ║
 * ║  Fitur 2: !translate — Terjemahkan teks/gambar pakai AI     ║
 * ║  Fitur 3: !ocr       — Baca teks dari gambar                ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

require('dotenv').config();
const axios = require('axios');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const OpenAI = require('openai');

const API_KEY = process.env.OPENROUTER_API_KEY;
const client = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: API_KEY,
    defaultHeaders: {
        "HTTP-Referer": "https://wa-bot.com",
        "X-Title": "Arya Bot AI Tools"
    }
});

// ─── HELPER: Tanya AI ─────────────────────────────────────────
async function tanyaAI(prompt, systemPrompt = '') {
    const response = await client.chat.completions.create({
        model: 'google/gemini-2.5-flash',
        messages: [
            ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
            { role: 'user', content: prompt }
        ],
        max_tokens: 1500
    });
    return response.choices[0]?.message?.content || 'Tidak ada respons dari AI.';
}

// ─── HELPER: Tanya AI dengan Gambar (Vision) ──────────────────
async function tanyaAIGambar(base64Image, mimeType, prompt) {
    const response = await client.chat.completions.create({
        model: 'google/gemini-2.5-flash',
        messages: [{
            role: 'user',
            content: [
                { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Image}` } },
                { type: 'text', text: prompt }
            ]
        }],
        max_tokens: 1500
    });
    return response.choices[0]?.message?.content || 'Tidak ada respons dari AI.';
}

// ─── HELPER: Fetch Isi Halaman Web ───────────────────────────
async function fetchWebContent(url) {
    try {
        const res = await axios.get(url, {
            timeout: 10000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        // Hapus HTML tags secara sederhana
        let text = res.data
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        return text.substring(0, 4000); // Batasi 4000 karakter
    } catch (e) {
        return null;
    }
}

// ─── HELPER: Download & Encode Gambar ─────────────────────────
async function downloadGambar(m, msg) {
    const msgType = Object.keys(m.message)[0];
    const isImage = msgType === 'imageMessage';
    const isQuotedImage = m.message.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;

    if (!isImage && !isQuotedImage) return null;

    let buffer;
    if (isQuotedImage) {
        buffer = await downloadMediaMessage({
            key: m.message.extendedTextMessage.contextInfo.stanzaId,
            message: m.message.extendedTextMessage.contextInfo.quotedMessage
        }, 'buffer', {}, { logger: console });
    } else {
        buffer = await downloadMediaMessage(m, 'buffer', {}, { logger: console });
    }
    return buffer;
}

// ══════════════════════════════════════════════════════════════
module.exports = async (command, args, msg, user, db, sock, m) => {
    const validCommands = ['summarize', 'ringkas', 'translate', 'terjemah', 'ocr', 'baca'];
    if (!validCommands.includes(command)) return;

    const text = args.join(' ');
    const jid = msg.from;

    // ══════════════════════════════════════════════════════════
    // FITUR 1: SUMMARIZE — !summarize <link/teks>
    // ══════════════════════════════════════════════════════════
    if (command === 'summarize' || command === 'ringkas') {
        if (!text) {
            return msg.reply(
                `📋 *AI SUMMARIZE*\n\n` +
                `Cara pakai:\n` +
                `• *!summarize <link>* — Ringkas artikel dari URL\n` +
                `• *!summarize <teks panjang>* — Ringkas teks langsung\n\n` +
                `Contoh: \`!summarize https://cnnindonesia.com/...\``
            );
        }

        await msg.reply('⏳ _Sedang meringkas, tunggu sebentar..._');

        try {
            let konten = text;

            // Cek apakah input adalah URL
            const urlRegex = /https?:\/\/[^\s]+/;
            if (urlRegex.test(text)) {
                const url = text.match(urlRegex)[0];
                await msg.reply('🌐 _Mengambil konten dari URL..._');
                const webContent = await fetchWebContent(url);
                if (!webContent) {
                    return msg.reply('❌ Gagal mengakses URL tersebut. Coba kirim teks langsung.');
                }
                konten = `Konten dari URL (${url}):\n\n${webContent}`;
            }

            const systemPrompt = `Kamu adalah asisten ringkasan profesional. Buat ringkasan yang jelas, terstruktur, dan padat dalam Bahasa Indonesia. Gunakan format:
- 📌 POIN UTAMA (max 3 poin)
- 📊 DETAIL PENTING
- 💡 KESIMPULAN
Maksimal 300 kata. Gunakan bahasa yang mudah dipahami.`;

            const hasil = await tanyaAI(`Ringkas ini:\n\n${konten}`, systemPrompt);

            return msg.reply(
                `📋 *RINGKASAN AI*\n` +
                `${'─'.repeat(30)}\n\n` +
                `${hasil}\n\n` +
                `${'─'.repeat(30)}\n` +
                `_Diringkas oleh AI • ${new Date().toLocaleString('id-ID')}_`
            );
        } catch (e) {
            console.error('Summarize Error:', e.message);
            return msg.reply('❌ Gagal meringkas. Coba lagi nanti.');
        }
    }

    // ══════════════════════════════════════════════════════════
    // FITUR 2: TRANSLATE — !translate <bahasa> <teks>
    // ══════════════════════════════════════════════════════════
    if (command === 'translate' || command === 'terjemah') {
        if (!text) {
            return msg.reply(
                `🌐 *AI TRANSLATE*\n\n` +
                `Cara pakai:\n` +
                `• *!translate inggris <teks>*\n` +
                `• *!translate jepang <teks>*\n` +
                `• *!translate arab <teks>*\n` +
                `• *!translate <kode_bahasa> <teks>* (en/ja/ar/ko/zh/fr/de/dll)\n\n` +
                `Contoh: \`!translate inggris Halo, apa kabar?\``
            );
        }

        const targetLang = args[0];
        const teksAsli = args.slice(1).join(' ');

        if (!teksAsli) {
            return msg.reply('❌ Format: `!translate <bahasa> <teks>`\nContoh: `!translate inggris Selamat pagi`');
        }

        await msg.reply('⏳ _Menerjemahkan..._');

        try {
            const systemPrompt = `Kamu adalah penerjemah profesional yang sangat akurat. 
Terjemahkan teks yang diberikan ke ${targetLang} secara natural dan idiomatis.
Format jawaban:
🔤 *Asli:* <teks asli>
✅ *Terjemahan:* <hasil terjemahan>
📝 *Catatan:* <penjelasan singkat jika ada ungkapan khusus> (jika perlu)
Hanya berikan format di atas, tidak perlu penjelasan lain.`;

            const hasil = await tanyaAI(`Terjemahkan ke ${targetLang}: "${teksAsli}"`, systemPrompt);

            return msg.reply(
                `🌐 *TRANSLATE AI*\n` +
                `${'─'.repeat(25)}\n\n` +
                `${hasil}\n\n` +
                `_Target: ${targetLang}_`
            );
        } catch (e) {
            console.error('Translate Error:', e.message);
            return msg.reply('❌ Gagal menerjemahkan. Coba lagi nanti.');
        }
    }

    // ══════════════════════════════════════════════════════════
    // FITUR 3: OCR — !ocr (reply/kirim gambar)
    // ══════════════════════════════════════════════════════════
    if (command === 'ocr' || command === 'baca') {
        if (!m) return msg.reply('❌ Terjadi error internal, coba lagi.');

        const msgType = Object.keys(m.message)[0];
        const isImage = msgType === 'imageMessage';
        const isQuotedImage = m.message.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;

        if (!isImage && !isQuotedImage) {
            return msg.reply(
                `👁️ *OCR — BACA TEKS GAMBAR*\n\n` +
                `Cara pakai:\n` +
                `• Kirim gambar dengan caption \`!ocr\`\n` +
                `• Reply gambar dengan \`!ocr\`\n\n` +
                `Cocok untuk: struk belanja, soal ujian, foto dokumen, papan tulisan, dll.`
            );
        }

        await msg.reply('🔍 _Sedang membaca teks dari gambar..._');

        try {
            const buffer = await downloadGambar(m, msg);
            if (!buffer) return msg.reply('❌ Gagal mengunduh gambar.');

            const base64 = buffer.toString('base64');
            const mimeType = 'image/jpeg';

            const prompt = `Baca dan ekstrak SEMUA teks yang ada di dalam gambar ini secara lengkap dan akurat. 
Pertahankan format aslinya (baris baru, spasi, angka). 
Jika ada tabel, format sebagai tabel teks. 
Jika tidak ada teks, tuliskan "Tidak ditemukan teks dalam gambar ini."
Hanya tulis teks yang ada di gambar, tidak perlu komentar tambahan.`;

            const hasil = await tanyaAIGambar(base64, mimeType, prompt);

            return msg.reply(
                `👁️ *HASIL OCR*\n` +
                `${'─'.repeat(30)}\n\n` +
                `${hasil}\n\n` +
                `${'─'.repeat(30)}\n` +
                `_Teks berhasil diekstrak dari gambar_`
            );
        } catch (e) {
            console.error('OCR Error:', e.message);
            return msg.reply('❌ Gagal membaca gambar. Pastikan gambar jelas dan coba lagi.');
        }
    }
};
