/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║         PORTOFOLIO & KURS PRO — Fitur 14 & 15               ║
 * ║  !porto add <simbol> <qty> <hargabeli>  — Tambah aset       ║
 * ║  !porto                                 — Lihat portofolio  ║
 * ║  !porto remove <simbol>                 — Hapus aset        ║
 * ║  !kurspro                               — Kurs + tren 7 hari║
 * ╚══════════════════════════════════════════════════════════════╝
 */

const axios = require('axios');
const { saveDB } = require('../helpers/database');

// ─── Cache harga crypto ───────────────────────────────────────
let cacheHarga = {};
let lastFetch = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 menit

// ─── Daftar aset yang didukung ────────────────────────────────
const ASET_MAP = {
    // Crypto
    'BTC': 'bitcoin', 'ETH': 'ethereum', 'BNB': 'binancecoin',
    'SOL': 'solana', 'ADA': 'cardano', 'DOGE': 'dogecoin',
    'XRP': 'ripple', 'DOT': 'polkadot', 'AVAX': 'avalanche-2',
    'MATIC': 'matic-network', 'LINK': 'chainlink', 'UNI': 'uniswap',
    'LTC': 'litecoin', 'BCH': 'bitcoin-cash', 'ATOM': 'cosmos',
    'NEAR': 'near', 'FTM': 'fantom', 'SAND': 'the-sandbox',
    // Stablecoin/Reference
    'USDT': 'tether', 'USDC': 'usd-coin',
};

// ─── Fetch harga real-time dari CoinGecko ─────────────────────
async function fetchHarga(simbolList) {
    const now = Date.now();
    if (now - lastFetch < CACHE_TTL && Object.keys(cacheHarga).length > 0) {
        return cacheHarga;
    }
    try {
        const ids = simbolList
            .filter(s => ASET_MAP[s.toUpperCase()])
            .map(s => ASET_MAP[s.toUpperCase()])
            .join(',');

        if (!ids) return {};

        const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=idr,usd&include_24hr_change=true`;
        const res = await axios.get(url, { timeout: 8000 });
        const data = res.data;

        // Rebuild cache dengan simbol
        const newCache = {};
        Object.entries(ASET_MAP).forEach(([simbol, id]) => {
            if (data[id]) {
                newCache[simbol] = {
                    idr: data[id].idr || 0,
                    usd: data[id].usd || 0,
                    change24h: data[id].idr_24h_change || 0
                };
            }
        });
        cacheHarga = newCache;
        lastFetch = now;
        return cacheHarga;
    } catch (e) {
        console.error('Fetch harga error:', e.message);
        return cacheHarga; // Return cache lama
    }
}

// ─── Format angka ─────────────────────────────────────────────
const fmt = (n) => Math.floor(n).toLocaleString('id-ID');
const fmtUSD = (n) => n < 1 ? n.toFixed(6) : n.toFixed(2);
const sign = (n) => n >= 0 ? `+${n.toFixed(2)}` : `${n.toFixed(2)}`;

// ──────────────────────────────────────────────────────────────
module.exports = async (command, args, msg, user, db) => {
    const validCommands = ['porto', 'portofolio', 'portfolio', 'kurspro', 'kursupdate'];
    if (!validCommands.includes(command)) return;

    // Init portofolio
    if (!user.porto) user.porto = [];

    // ══════════════════════════════════════════════════════════
    // FITUR 14: PORTOFOLIO — !porto
    // ══════════════════════════════════════════════════════════
    if (['porto', 'portofolio', 'portfolio'].includes(command)) {
        const subCmd = args[0]?.toLowerCase();

        // ─── !porto add <simbol> <qty> <hargabeli> ─────────────
        if (subCmd === 'add' || subCmd === 'tambah') {
            const simbol = args[1]?.toUpperCase();
            const qty = parseFloat(args[2]);
            const hargaBeli = parseFloat(args[3]);

            if (!simbol || isNaN(qty) || isNaN(hargaBeli) || qty <= 0 || hargaBeli <= 0) {
                return msg.reply(
                    `❌ Format salah!\n\n` +
                    `*!porto add <SIMBOL> <JUMLAH> <HARGA_BELI_IDR>*\n\n` +
                    `Contoh:\n` +
                    `\`!porto add BTC 0.001 850000000\`\n` +
                    `\`!porto add ETH 0.5 40000000\`\n\n` +
                    `Simbol tersedia: ${Object.keys(ASET_MAP).join(', ')}`
                );
            }

            if (!ASET_MAP[simbol]) {
                return msg.reply(`❌ Simbol *${simbol}* tidak didukung.\n\nSimbol tersedia: ${Object.keys(ASET_MAP).join(', ')}`);
            }

            // Cek apakah sudah ada
            const existing = user.porto.find(p => p.simbol === simbol);
            if (existing) {
                // Average down/up
                const totalQty = existing.qty + qty;
                const totalModal = (existing.qty * existing.hargaBeli) + (qty * hargaBeli);
                existing.qty = totalQty;
                existing.hargaBeli = totalModal / totalQty;
                saveDB(db);
                return msg.reply(
                    `✅ *${simbol}* diperbarui!\n\n` +
                    `📊 Total: *${totalQty} ${simbol}*\n` +
                    `💰 Avg. harga beli: *Rp${fmt(existing.hargaBeli)}*`
                );
            }

            user.porto.push({
                simbol,
                qty,
                hargaBeli,
                tanggal: new Date().toLocaleDateString('id-ID')
            });
            saveDB(db);
            return msg.reply(
                `✅ *${simbol}* ditambahkan ke portofolio!\n\n` +
                `📊 ${qty} ${simbol} @ Rp${fmt(hargaBeli)}/unit\n` +
                `💰 Modal: *Rp${fmt(qty * hargaBeli)}*\n\n` +
                `_Lihat porto: \`!porto\`_`
            );
        }

        // ─── !porto remove <simbol> ──────────────────────────
        if (subCmd === 'remove' || subCmd === 'hapus') {
            const simbol = args[1]?.toUpperCase();
            if (!simbol) return msg.reply('❌ Format: `!porto remove <SIMBOL>`');
            const idx = user.porto.findIndex(p => p.simbol === simbol);
            if (idx === -1) return msg.reply(`❌ *${simbol}* tidak ada di portofolio kamu.`);
            user.porto.splice(idx, 1);
            saveDB(db);
            return msg.reply(`🗑️ *${simbol}* dihapus dari portofolio.`);
        }

        // ─── !porto — Tampilkan portofolio ───────────────────
        if (user.porto.length === 0) {
            return msg.reply(
                `💼 *PORTOFOLIO KOSONG*\n\n` +
                `Mulai tambah aset:\n` +
                `*!porto add <SIMBOL> <QTY> <HARGA_BELI>*\n\n` +
                `Contoh: \`!porto add BTC 0.001 850000000\``
            );
        }

        await msg.reply('📊 _Mengambil data harga real-time..._');

        const simbolList = user.porto.map(p => p.simbol);
        const harga = await fetchHarga(simbolList);

        let totalModal = 0;
        let totalNilaiSaatIni = 0;
        let rows = '';

        for (const aset of user.porto) {
            const hargaKini = harga[aset.simbol]?.idr || 0;
            const change24h = harga[aset.simbol]?.change24h || 0;
            const modal = aset.qty * aset.hargaBeli;
            const nilaiKini = aset.qty * hargaKini;
            const plIdr = nilaiKini - modal;
            const plPct = modal > 0 ? ((plIdr / modal) * 100).toFixed(1) : '0.0';
            const arrow = plIdr >= 0 ? '📈' : '📉';
            const c24h = change24h >= 0 ? `+${change24h.toFixed(1)}%` : `${change24h.toFixed(1)}%`;

            totalModal += modal;
            totalNilaiSaatIni += nilaiKini;

            rows +=
                `${arrow} *${aset.simbol}* (24h: ${c24h})\n` +
                `   ${aset.qty} × Rp${fmt(hargaKini)}\n` +
                `   Modal: Rp${fmt(modal)} → Kini: Rp${fmt(nilaiKini)}\n` +
                `   P/L: *${plIdr >= 0 ? '+' : ''}Rp${fmt(plIdr)}* (${plPct}%)\n\n`;
        }

        const totalPL = totalNilaiSaatIni - totalModal;
        const totalPLPct = totalModal > 0 ? ((totalPL / totalModal) * 100).toFixed(1) : '0.0';
        const totalEmoji = totalPL >= 0 ? '📈' : '📉';

        return msg.reply(
            `💼 *PORTOFOLIO KAMU*\n` +
            `${'─'.repeat(30)}\n\n` +
            rows +
            `${'═'.repeat(25)}\n` +
            `💰 Total Modal: *Rp${fmt(totalModal)}*\n` +
            `💎 Nilai Kini: *Rp${fmt(totalNilaiSaatIni)}*\n` +
            `${totalEmoji} Total P/L: *${totalPL >= 0 ? '+' : ''}Rp${fmt(totalPL)}* (${totalPLPct}%)\n\n` +
            `_Update: ${new Date().toLocaleString('id-ID')}_\n` +
            `_Tambah: \`!porto add\` | Hapus: \`!porto remove\`_`
        );
    }

    // ══════════════════════════════════════════════════════════
    // FITUR 15: KURS PRO — !kurspro
    // ══════════════════════════════════════════════════════════
    if (command === 'kurspro' || command === 'kursupdate') {
        await msg.reply('💱 _Mengambil data kurs real-time..._');

        try {
            // Ambil kurs dari API
            const kursUrl = 'https://api.coingecko.com/api/v3/simple/price?ids=tether,bitcoin,ethereum,binancecoin,pax-gold&vs_currencies=idr&include_24hr_change=true&include_7d_change=true';
            const [kursRes, fiatRes] = await Promise.allSettled([
                axios.get(kursUrl, { timeout: 8000 }),
                axios.get('https://open.er-api.com/v6/latest/USD', { timeout: 8000 })
            ]);

            const kursData = kursRes.status === 'fulfilled' ? kursRes.value.data : {};
            const fiatData = fiatRes.status === 'fulfilled' ? fiatRes.value.data : {};

            const idrPerUsd = kursData.tether?.idr || fiatData?.rates?.IDR || 16000;
            const usd24h = kursData.tether?.idr_24h_change || 0;
            const usd7d = kursData.tether?.idr_7d_change || 0;

            const eurIdr = fiatData?.rates?.IDR && fiatData?.rates?.EUR
                ? Math.round(fiatData.rates.IDR / fiatData.rates.EUR) : 17500;
            const jpyIdr = fiatData?.rates?.IDR && fiatData?.rates?.JPY
                ? Math.round(fiatData.rates.IDR / fiatData.rates.JPY) : 110;
            const gbpIdr = fiatData?.rates?.IDR && fiatData?.rates?.GBP
                ? Math.round(fiatData.rates.IDR / fiatData.rates.GBP) : 20500;
            const sgdIdr = fiatData?.rates?.IDR && fiatData?.rates?.SGD
                ? Math.round(fiatData.rates.IDR / fiatData.rates.SGD) : 12000;
            const myrIdr = fiatData?.rates?.IDR && fiatData?.rates?.MYR
                ? Math.round(fiatData.rates.IDR / fiatData.rates.MYR) : 3700;

            const btcIdr = kursData.bitcoin?.idr || 0;
            const btc24h = kursData.bitcoin?.idr_24h_change || 0;
            const ethIdr = kursData.ethereum?.idr || 0;
            const eth24h = kursData.ethereum?.idr_24h_change || 0;
            const goldIdr = kursData['pax-gold']?.idr || 0;

            const trendUSD = usd7d > 1 ? '📈 Menguat' : usd7d < -1 ? '📉 Melemah' : '➡️ Stabil';
            const trendBTC = btc24h > 0 ? '📈' : '📉';
            const trendETH = eth24h > 0 ? '📈' : '📉';

            return msg.reply(
                `💱 *KURS PRO — REAL-TIME*\n` +
                `${'─'.repeat(30)}\n\n` +
                `💵 *FOREX vs IDR:*\n` +
                `🇺🇸 USD: *Rp${fmt(idrPerUsd)}* (24h: ${sign(usd24h)}%) ${trendUSD}\n` +
                `🇪🇺 EUR: *Rp${fmt(eurIdr)}*\n` +
                `🇯🇵 JPY: *Rp${fmt(jpyIdr)}*/¥\n` +
                `🇬🇧 GBP: *Rp${fmt(gbpIdr)}*\n` +
                `🇸🇬 SGD: *Rp${fmt(sgdIdr)}*\n` +
                `🇲🇾 MYR: *Rp${fmt(myrIdr)}*\n\n` +
                `${'─'.repeat(20)}\n` +
                `₿ *CRYPTO vs IDR:*\n` +
                `₿ BTC: *Rp${fmt(btcIdr)}* ${trendBTC} (${sign(btc24h)}%)\n` +
                `⟠ ETH: *Rp${fmt(ethIdr)}* ${trendETH} (${sign(eth24h)}%)\n` +
                (goldIdr > 0 ? `🥇 EMAS: *Rp${fmt(goldIdr/31.1)}/gram*\n` : '') +
                `\n${'─'.repeat(20)}\n` +
                `📊 Tren USD 7 hari: *${usd7d > 0 ? '+' : ''}${usd7d.toFixed(2)}%*\n` +
                `_Update: ${new Date().toLocaleString('id-ID')}_\n\n` +
                `💼 Track investasi: \`!porto\`\n` +
                `📈 Trading crypto: \`!crypto\``
            );
        } catch (e) {
            console.error('Kurs Error:', e.message);
            return msg.reply('❌ Gagal mengambil data kurs. Coba lagi nanti.');
        }
    }
};
