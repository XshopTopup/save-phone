require('dotenv').config();
const path = require('path');
const express = require('express');
const app = express();
const { saveFormattedPhone, client } = require('./phoneHelper'); 

app.use(express.json());
app.use(express.static('public')); 

// Perbaikan initDb: Hanya untuk membuat tabel
const initDb = async () => {
    try {
        await client.execute(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY, 
                phone_number TEXT NOT NULL,
                country_info TEXT,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("✅ Database Turso siap");
    } catch (error) {
        console.error("❌ Gagal inisialisasi tabel:", error.message);
    }
};

// Panggil initDb
initDb();

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
/*
app.get('/api/get-phones', async (req, res) => {
    try {
        const result = await client.execute("SELECT * FROM users ORDER BY updated_at DESC");
        res.status(200).json({ status: "success", data: result.rows });
    } catch (error) {
        res.status(500).json({ status: "error", message: error.message });
    }
});

app.post('/api/sphone.php', async (req, res) => {
    try {
        const { userId, nomor, negara } = req.body;
        if (!userId || !nomor) {
            return res.status(400).json({ status: "fail", message: "userId dan nomor harus diisi" });
        }

        const result = await saveFormattedPhone(userId, nomor, negara || '');
        res.status(result.status === "success" ? 200 : 400).json(result);
    } catch (error) {
        res.status(500).json({ status: "error", message: "Terjadi kesalahan pada server" });
    }
});
*/
// Arsyilla AI - Updated Endpoint for Vercel & Turso Stability
app.post('/api/sphone.php', async (req, res) => {
    try {
        const { userId, nomor, negara } = req.body;

        // 1. Validasi input dasar
        if (!userId || !nomor) {
            return res.status(400).json({ 
                status: "fail", 
                message: "userId dan nomor harus diisi" 
            });
        }

        // 2. Pastikan tabel ada (Mencegah error 'no such table' di Vercel cold start)
        try {
            await client.execute(`
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY, 
                    phone_number TEXT, 
                    country_info TEXT, 
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );
            `);
        } catch (dbError) {
            console.error("Database Init Error:", dbError.message);
            // Lanjut saja, jika tabel sudah ada maka tidak masalah
        }

        // 3. Eksekusi penyimpanan dengan helper yang sudah mendukung UPSERT
        const result = await saveFormattedPhone(userId, nomor, negara || '');

        // 4. Kirim response sesuai hasil status
        if (result.status === "success") {
            return res.status(200).json(result);
        } else {
            return res.status(400).json({
                status: "fail",
                message: result.message || "Gagal memproses nomor telepon"
            });
        }

    } catch (error) {
        // Log detail error ke console Vercel untuk mempermudah debugging kamu
        console.error("Full Endpoint Error:", error);
        
        return res.status(500).json({ 
            status: "error", 
            message: "Terjadi kesalahan pada server",
            detail: process.env.NODE_ENV === 'development' ? error.message : undefined 
        });
    }
});
                
// Khusus Vercel: Listen hanya jika tidak dijalankan sebagai serverless function
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
}

module.exports = app;
