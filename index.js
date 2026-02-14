require('dotenv').config();
const path = require('path');
const express = require('express');
const app = express();
const { saveFormattedPhone, client } = require('./phoneHelper'); 

app.use(express.json());

const initDb = async () => {
    try {/*
        await client.execute({
    sql: `INSERT INTO users (id, phone_number, country_info) 
          VALUES (?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET 
          phone_number = excluded.phone_number, 
          country_info = excluded.country_info,
          updated_at = CURRENT_TIMESTAMP`,
    args: [userId, formatted, countryName],
});*/
            // Perbaikan pada phoneHelper.js
await client.execute({
    sql: `INSERT INTO users (id, phone_number, country_info) 
          VALUES (?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET 
          phone_number = excluded.phone_number, 
          country_info = excluded.country_info,
          updated_at = CURRENT_TIMESTAMP`,
    args: [userId, formatted, countryName],
});
        
        console.log("✅ Database Turso siap (Tabel 'users' tersedia)");
    } catch (error) {
        console.error("❌ Gagal inisialisasi tabel:", error.message);
    }
};

initDb();

app.use(express.static('public')); 

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/get-phones', async (req, res) => {
    try {
        const result = await client.execute("SELECT * FROM users ORDER BY updated_at DESC");
        
        res.status(200).json({
            status: "success",
            data: result.rows
        });
    } catch (error) {
        res.status(500).json({
            status: "error",
            message: error.message
        });
    }
});

app.post('/api/sphone.php', async (req, res) => {
    try {
        const { userId, nomor, negara } = req.body;

        if (!userId || !nomor) {
            return res.status(400).json({
                status: "fail",
                message: "userId dan nomor harus diisi"
            });
        }

        const result = await saveFormattedPhone(userId, nomor, negara || '');

        if (result.status === "success") {
            return res.status(200).json(result);
        } else {
            return res.status(400).json(result);
        }

    } catch (error) {
        console.error("Endpoint Error:", error.message);
        return res.status(500).json({
            status: "error",
            message: "Terjadi kesalahan pada server"
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Arsyilla AI Server running on port ${PORT}`);
});

module.exports = app;
