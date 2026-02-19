/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║         KREATIF TOOLS — Fitur 31, 33, 34, 35                ║
 * ║  !lirik <judul> <artis>  — Cari lirik + terjemahan          ║
 * ║  !meme <template> | <atas> | <bawah> — Buat meme            ║
 * ║  !voice <teks>           — AI TTS natural                   ║
 * ║  !cerita <tema>          — AI Story Generator interaktif    ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

require('dotenv').config();
const axios = require('axios');
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');

const client = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
    defaultHeaders: { "HTTP-Referer": "https://wa-bot.com", "X-Title": "Arya Bot Kreatif" }
});

const TEMP_DIR = path.join(__dirname, '../temp');
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

// ─── Sesi cerita interaktif ───────────────────────────────────
const sesiCerita = new Map();

// ─── Helper: Tanya AI ─────────────────────────────────────────
async function tanyaAI(prompt, systemPrompt = '', maxTokens = 1000) {
    const response = await client.chat.completions.create({
        model: 'google/gemini-2.5-flash',
        messages: [
            ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
            { role: 'user', content: prompt }
        ],
        max_tokens: maxTokens
    });
    return response.choices[0]?.message?.content || '';
}

// ──────────────────────────────────────────────────────────────
module.exports = async (command, args, msg, user, db, sock, m) => {
    const validCommands = [
        'lirik', 'lyrics',
        'meme',
        'voice', 'suara', 'tts2',
        'cerita', 'story', 'lanjut', 'ceritalanjut',
        'stopcerita'
    ];
    if (!validCommands.includes(command)) return;

    const userId = msg.author || msg.from;

    // ══════════════════════════════════════════════════════════
    // FITUR 31: LIRIK LAGU — !lirik <judul> <artis>
    // ══════════════════════════════════════════════════════════
    if (['lirik', 'lyrics'].includes(command)) {
        const query = args.join(' ').trim();

        if (!query) {
            return msg.reply(
                `🎵 *LIRIK LAGU*\n\n` +
                `Cara pakai:\n` +
                `• \`!lirik <judul lagu>\`\n` +
                `• \`!lirik <judul> - <artis>\`\n\n` +
                `Contoh:\n` +
                `\`!lirik Riptide Vance Joy\`\n` +
                `\`!lirik Berapa Selamanya - Raisa\``
            );
        }

        await msg.reply(`🎵 _Mencari lirik "${query}"..._`);

        try {
            // Cari via Lyrics.ovh API (gratis)
            let judul = query;
            let artis = '';

            // Parse "judul - artis" atau "judul artis" (tebak)
            if (query.includes(' - ')) {
                [judul, artis] = query.split(' - ').map(s => s.trim());
            } else if (query.includes(' by ')) {
                [judul, artis] = query.split(' by ').map(s => s.trim());
            }

            let lirik = null;

            // Coba Lyrics.ovh jika ada artis
            if (artis) {
                try {
                    const res = await axios.get(
                        `https://api.lyrics.ovh/v1/${encodeURIComponent(artis)}/${encodeURIComponent(judul)}`,
                        { timeout: 8000 }
                    );
                    if (res.data.lyrics) {
                        lirik = { artis, judul, teks: res.data.lyrics };
                    }
                } catch (e) { /* coba cara lain */ }
            }

            // Fallback: Pakai AI untuk informasi lirik
            if (!lirik) {
                const systemPrompt = `Kamu adalah asisten musik yang berpengetahuan luas.
Berikan informasi tentang lagu yang diminta.
PENTING: Jangan reproduksi lirik lengkap karena hak cipta. 
Berikan:
1. Informasi lagu (artis, tahun, album, genre)
2. Tema dan makna lagu secara ringkas
3. Bait atau bagian terkenal MAKSIMAL 2 baris saja sebagai referensi
4. Terjemahan tema umum ke Bahasa Indonesia jika lagu berbahasa asing
5. Rekomendasi lagu serupa

Format yang menarik dan informatif.`;

                const hasil = await tanyaAI(`Informasi tentang lagu: "${query}"`, systemPrompt, 800);

                return msg.reply(
                    `🎵 *INFORMASI LAGU*\n` +
                    `${'─'.repeat(30)}\n\n` +
                    `🔍 Pencarian: "${query}"\n\n` +
                    `${hasil}\n\n` +
                    `${'─'.repeat(20)}\n` +
                    `💡 Untuk lirik lengkap, kunjungi:\n` +
                    `• genius.com\n` +
                    `• azlyrics.com\n` +
                    `• lirik.net (Indonesia)`
                );
            }

            // Batasi lirik yang ditampilkan (max 50 baris)
            const barisBaris = lirik.teks.split('\n');
            const tampil = barisBaris.slice(0, 40).join('\n');
            const adaTerpotong = barisBaris.length > 40;

            // Terjemahan tema (jika terdeteksi bukan Indonesia)
            let terjemahan = '';
            const isMungkinAsingLog = /[a-zA-Z]{4,}/.test(tampil) && !/[a-z]{2,}/.test(tampil.substring(0, 50).toLowerCase().replace(/[^a-z]/g, ''));

            return msg.reply(
                `🎵 *${lirik.judul.toUpperCase()}*\n` +
                `🎤 ${lirik.artis}\n` +
                `${'─'.repeat(30)}\n\n` +
                `${tampil}\n` +
                (adaTerpotong ? `\n_... (${barisBaris.length - 40} baris lagi)_\n` : '') +
                `\n${'─'.repeat(20)}\n` +
                `_Terjemahan makna: \`!translate indonesia <teks>\`_`
            );
        } catch (e) {
            console.error('Lirik Error:', e.message);
            return msg.reply(`❌ Tidak bisa menemukan lirik untuk "${query}".\n\nCoba format: \`!lirik Judul - Artis\``);
        }
    }

    // ══════════════════════════════════════════════════════════
    // FITUR 33: MEME GENERATOR — !meme <template>|<atas>|<bawah>
    // ══════════════════════════════════════════════════════════
    if (command === 'meme') {
        const fullText = args.join(' ');

        if (!fullText) {
            return msg.reply(
                `😂 *MEME GENERATOR*\n\n` +
                `Format:\n` +
                `\`!meme <template> | <teks atas> | <teks bawah>\`\n\n` +
                `Template tersedia:\n` +
                `• drake, doge, distracted, button, galaxy, fine, change, thisisfine\n` +
                `• always-has-been, uno, epic, coffin, bernie, running, waiting\n\n` +
                `Contoh:\n` +
                `\`!meme drake | Ngerjain PR sendiri | Nyontek temen\`\n` +
                `\`!meme doge | Wow | Such meme | Very wow | Amaze\``
            );
        }

        await msg.reply('😂 _Membuat meme..._');

        try {
            const parts = fullText.split('|').map(s => s.trim());
            const template = parts[0]?.toLowerCase().replace(/\s+/g, '-') || 'drake';
            const texts = parts.slice(1);

            if (texts.length === 0) {
                return msg.reply('❌ Harus ada teks! Format: `!meme <template> | <teks1> | <teks2>`');
            }

            // Mapping template ke ID Memegen
            const TEMPLATE_MAP = {
                'drake': 'drake',
                'doge': 'doge',
                'distracted': 'distracted-boyfriend',
                'button': 'two-buttons',
                'galaxy': 'galaxy-brain',
                'fine': 'this-is-fine',
                'change': 'change-my-mind',
                'thisisfine': 'this-is-fine',
                'always-has-been': 'always-has-been',
                'uno': 'uno-reverse',
                'epic': 'epic-handshake',
                'coffin': 'coffin-dance',
                'bernie': 'bernie',
                'running': 'running-away-balloon',
                'waiting': 'waiting-skeleton',
                'batman': 'batman-slapping-robin',
                'spiderman': 'spiderman-pointing',
                'pikachu': 'surprised-pikachu',
                'stonks': 'stonks',
                'gru': 'grus-plan',
                'hide': 'hide-the-pain-harold',
                'lisa': 'lisa-presentation',
                'cat': 'woman-yelling-at-cat',
            };

            const templateId = TEMPLATE_MAP[template] || template;

            // Encode teks untuk URL
            const encodedTexts = texts
                .slice(0, 4)
                .map(t => encodeURIComponent(t.replace(/\s+/g, '_')));

            const memeUrl = `https://api.memegen.link/images/${templateId}/${encodedTexts.join('/')}.jpg?width=500`;

            // Download meme
            const response = await axios.get(memeUrl, {
                responseType: 'arraybuffer',
                timeout: 15000,
                validateStatus: (status) => status < 500
            });

            if (response.status !== 200) {
                return msg.reply(
                    `❌ Template "${template}" tidak ditemukan!\n\n` +
                    `Template yang tersedia: drake, doge, distracted, button, galaxy, fine, change, spiderman, pikachu, stonks, gru, cat, dll\n\n` +
                    `Atau coba template custom di: memegen.link`
                );
            }

            const imgBuffer = Buffer.from(response.data);

            await sock.sendMessage(msg.from, {
                image: imgBuffer,
                caption:
                    `😂 *MEME SELESAI!*\n\n` +
                    `🎨 Template: ${templateId}\n` +
                    `📝 Teks: ${texts.join(' | ')}\n\n` +
                    `_Powered by memegen.link_`,
                mimetype: 'image/jpeg'
            }, { quoted: m });

        } catch (e) {
            console.error('Meme Error:', e.message);
            return msg.reply('❌ Gagal membuat meme. Coba template yang berbeda atau cek format penulisan.');
        }
    }

    // ══════════════════════════════════════════════════════════
    // FITUR 34: AI VOICE TTS — !voice <teks>
    // ══════════════════════════════════════════════════════════
    if (['voice', 'suara', 'tts2'].includes(command)) {
        const teks = args.join(' ').trim();

        if (!teks) {
            return msg.reply(
                `🎙️ *AI VOICE TTS*\n\n` +
                `Cara pakai:\n` +
                `\`!voice <teks>\`\n\n` +
                `Contoh:\n` +
                `\`!voice Halo semuanya, selamat pagi!\`\n` +
                `\`!voice Good morning, how are you today?\`\n\n` +
                `💡 Mendukung Bahasa Indonesia & Inggris\n` +
                `_Maksimal 200 karakter_`
            );
        }

        if (teks.length > 200) {
            return msg.reply('❌ Teks terlalu panjang! Maksimal 200 karakter.');
        }

        await msg.reply('🎙️ _Mengkonversi teks ke suara..._');

        try {
            // Coba VoiceRSS API (gratis tier tersedia)
            const voiceKey = process.env.VOICERSS_API_KEY;
            const elevenKey = process.env.ELEVENLABS_API_KEY;

            if (elevenKey) {
                // ─── Mode: ElevenLabs (kualitas terbaik) ─────
                const response = await axios({
                    method: 'POST',
                    url: 'https://api.elevenlabs.io/v1/text-to-speech/pNInz6obpgDQGcFmaJgB',
                    headers: {
                        'Accept': 'audio/mpeg',
                        'xi-api-key': elevenKey,
                        'Content-Type': 'application/json'
                    },
                    data: {
                        text: teks,
                        model_id: 'eleven_multilingual_v2',
                        voice_settings: { stability: 0.5, similarity_boost: 0.75 }
                    },
                    responseType: 'arraybuffer',
                    timeout: 20000
                });

                const audioBuffer = Buffer.from(response.data);
                const audioPath = path.join(TEMP_DIR, `voice_${Date.now()}.mp3`);
                fs.writeFileSync(audioPath, audioBuffer);

                await sock.sendMessage(msg.from, {
                    audio: audioBuffer,
                    mimetype: 'audio/mpeg',
                    ptt: true // Kirim sebagai voice note
                }, { quoted: m });

                fs.unlinkSync(audioPath);
                return msg.reply(`✅ _Voice note berhasil dikirim!_\n_Powered by ElevenLabs AI_`);
            }

            // ─── Fallback: VoiceRSS ──────────────────────────
            if (voiceKey) {
                const lang = /[a-zA-Z]{3,}/.test(teks) && !/[iuea]/.test(teks.substring(0, 10).toLowerCase()) ? 'id-id' : 'id-id';
                const url = `https://api.voicerss.org/?key=${voiceKey}&hl=${lang}&src=${encodeURIComponent(teks)}&f=48khz_16bit_stereo&r=0&c=mp3&ssml=false`;
                const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000 });
                const audioBuffer = Buffer.from(res.data);

                await sock.sendMessage(msg.from, {
                    audio: audioBuffer,
                    mimetype: 'audio/mpeg',
                    ptt: true
                }, { quoted: m });

                return msg.reply('✅ _Voice note berhasil!_');
            }

            // ─── Fallback: gTTS via endpoint publik ───────────
            // Pakai Google Translate TTS (informal, tidak resmi)
            const lang = /[a-zA-Z]/.test(teks.substring(0, 20)) ? 'en' : 'id';
            const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(teks)}&tl=${lang}&client=tw-ob`;

            const res = await axios.get(ttsUrl, {
                responseType: 'arraybuffer',
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)',
                    'Referer': 'https://translate.google.com/'
                }
            });

            const audioBuffer = Buffer.from(res.data);
            await sock.sendMessage(msg.from, {
                audio: audioBuffer,
                mimetype: 'audio/mpeg',
                ptt: true
            }, { quoted: m });

            return msg.reply('✅ _Voice note berhasil dikirim!_');

        } catch (e) {
            console.error('Voice Error:', e.message);
            return msg.reply(
                `❌ Gagal membuat voice note.\n\n` +
                `💡 Tips: Tambahkan API key di .env:\n` +
                `• \`ELEVENLABS_API_KEY\` (kualitas terbaik)\n` +
                `• \`VOICERSS_API_KEY\` (gratis 350 req/hari)\n\n` +
                `Atau gunakan \`!tts ${teks}\` (TTS bawaan)`
            );
        }
    }

    // ══════════════════════════════════════════════════════════
    // FITUR 35: AI STORY GENERATOR — !cerita <tema>
    // ══════════════════════════════════════════════════════════
    if (['cerita', 'story'].includes(command)) {
        const tema = args.join(' ').trim();

        if (!tema) {
            return msg.reply(
                `📖 *AI STORY GENERATOR*\n\n` +
                `Cara pakai:\n` +
                `\`!cerita <tema/genre>\`\n\n` +
                `Contoh:\n` +
                `\`!cerita horor di hutan\`\n` +
                `\`!cerita romance di kereta api\`\n` +
                `\`!cerita komedi kantor\`\n` +
                `\`!cerita sci-fi di luar angkasa\`\n\n` +
                `Setelah cerita dimulai:\n` +
                `\`!lanjut <pilihan>\` — Lanjutkan cerita\n` +
                `\`!stopcerita\` — Akhiri cerita`
            );
        }

        if (sesiCerita.has(userId)) {
            return msg.reply('📖 Masih ada cerita aktif! Lanjutkan dengan `!lanjut <pilihan>` atau ketik `!stopcerita`');
        }

        await msg.reply(`📖 _Membuat cerita "${tema}"..._`);

        try {
            const systemPrompt = `Kamu adalah penulis cerita interaktif berbahasa Indonesia yang hebat.
Buat cerita pendek yang menarik, seru, dan immersive.
Di akhir setiap segmen, berikan 3 pilihan aksi untuk pembaca.
Format respons:
{narasi cerita 3-4 paragraf menarik}

━━━━━━━━━━━━━━━━━
🔀 *Pilih lanjutan cerita:*
1️⃣ [pilihan 1]
2️⃣ [pilihan 2]  
3️⃣ [pilihan 3]

_Balas: !lanjut 1 / !lanjut 2 / !lanjut 3_`;

            const prompt = `Mulai cerita interaktif bertema: "${tema}". 
Buat pembukaan yang menarik dengan setting jelas dan tokoh utama. 
Akhiri dengan pilihan yang memengaruhi jalannya cerita.`;

            const hasil = await tanyaAI(prompt, systemPrompt, 1200);

            sesiCerita.set(userId, {
                tema,
                chapter: 1,
                riwayat: [hasil],
                pilihan: [],
                startTime: Date.now()
            });

            return msg.reply(
                `📖 *CERITA: ${tema.toUpperCase()}*\n` +
                `${'═'.repeat(30)}\n\n` +
                `${hasil}\n\n` +
                `${'─'.repeat(20)}\n` +
                `_Chapter 1 dari ?? | Ketik \`!stopcerita\` untuk akhiri_`
            );
        } catch (e) {
            console.error('Story Error:', e.message);
            return msg.reply('❌ Gagal membuat cerita. Coba lagi nanti.');
        }
    }

    // !lanjut <pilihan> — Lanjutkan cerita
    if (['lanjut', 'ceritalanjut'].includes(command)) {
        if (!sesiCerita.has(userId)) {
            return msg.reply('❌ Tidak ada cerita aktif. Mulai dengan `!cerita <tema>`');
        }

        const pilihan = args.join(' ').trim();
        if (!pilihan) return msg.reply('❌ Pilih lanjutan! Contoh: `!lanjut 1` atau `!lanjut kabur dari gedung`');

        const sesi = sesiCerita.get(userId);
        sesi.chapter++;

        await msg.reply(`📖 _Melanjutkan cerita (Chapter ${sesi.chapter})..._`);

        try {
            const riwayatSingkat = sesi.riwayat.slice(-2).join('\n...\n');
            const systemPrompt = `Kamu adalah penulis cerita interaktif berbahasa Indonesia.
Lanjutkan cerita dengan dramatis dan konsisten dengan plot sebelumnya.
Format respons:
{narasi cerita 3-4 paragraf}

━━━━━━━━━━━━━━━━━
🔀 *Pilih lanjutan cerita:*
1️⃣ [pilihan 1]
2️⃣ [pilihan 2]
3️⃣ [pilihan 3 - bisa berakhir di sini]

_Balas: !lanjut 1/2/3 atau !stopcerita untuk ending_`;

            const prompt = `Tema: ${sesi.tema}
Cerita sebelumnya: ${riwayatSingkat}
Pilihan pembaca: "${pilihan}"

Lanjutkan cerita dari pilihan tersebut secara natural dan dramatis.
${sesi.chapter >= 5 ? 'Arahkan menuju ending yang memuaskan.' : ''}`;

            const hasil = await tanyaAI(prompt, systemPrompt, 1200);
            sesi.riwayat.push(hasil);
            sesi.pilihan.push(pilihan);

            const isEnding = sesi.chapter >= 7;
            if (isEnding) sesiCerita.delete(userId);

            return msg.reply(
                `📖 *Chapter ${sesi.chapter}*\n` +
                `${'─'.repeat(30)}\n\n` +
                `${hasil}\n\n` +
                `${'─'.repeat(20)}\n` +
                (isEnding ? `_🎉 Cerita selesai! Main lagi: \`!cerita <tema>\`_` : `_Chapter ${sesi.chapter} dari ??? | \`!stopcerita\` untuk akhiri_`)
            );
        } catch (e) {
            console.error('Story Continue Error:', e.message);
            return msg.reply('❌ Gagal melanjutkan cerita. Coba lagi.');
        }
    }

    // !stopcerita
    if (command === 'stopcerita') {
        if (!sesiCerita.has(userId)) return msg.reply('❌ Tidak ada cerita aktif.');
        const sesi = sesiCerita.get(userId);
        sesiCerita.delete(userId);

        try {
            const endingPrompt = `Buat ending singkat (2 paragraf) yang memuaskan untuk cerita bertema "${sesi.tema}" yang telah berjalan ${sesi.chapter} chapter. Buat penutup yang berkesan.`;
            const ending = await tanyaAI(endingPrompt, '', 400);

            return msg.reply(
                `📖 *ENDING CERITA*\n` +
                `${'═'.repeat(30)}\n\n` +
                `${ending}\n\n` +
                `${'═'.repeat(25)}\n` +
                `🎭 *TAMAT*\n\n` +
                `📊 Stats: ${sesi.chapter} chapter dimainkan\n` +
                `_Buat cerita baru: \`!cerita <tema>\`_`
            );
        } catch (e) {
            return msg.reply(`📖 Cerita "${sesi.tema}" dihentikan di chapter ${sesi.chapter}.\n\nTERIMA KASIH SUDAH MEMBACA! 🎭\n\nCerita baru: \`!cerita <tema>\``);
        }
    }
};
