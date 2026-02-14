require('dotenv').config();
const path = require('path');
const express = require('express');
const { phone: phoneModule } = require('phone');
const { createClient } = require('@libsql/client');

const app = express();

// Inisialisasi Turso client
const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// Fungsi untuk menyimpan nomor telepon yang sudah diformat
const saveFormattedPhone = async (userId, inputNomor, inputNegara = '') => {
  try {
    // Ambil fungsi phone dengan benar
    const phone = typeof phoneModule === 'function' ? phoneModule : require('phone').phone;
    
    // Validasi nomor telepon
    const result = phone(inputNomor, { country: inputNegara || undefined });
    
    if (result.isValid) {
      const formatted = result.phoneNumber;
      const countryName = result.countryIso3;
      
      // Simpan ke database
      await client.execute({
        sql: `INSERT INTO users (id, phone_number, country_info) 
              VALUES (?, ?, ?) 
              ON CONFLICT(id) DO UPDATE SET 
                phone_number = excluded.phone_number, 
                country_info = excluded.country_info, 
                updated_at = CURRENT_TIMESTAMP`,
        args: [userId, formatted, countryName],
      });
      
      return { 
        status: "success", 
        formatted, 
        country: countryName,
        message: "Nomor berhasil disimpan"
      };
    }
    
    return { 
      status: "fail", 
      message: "Nomor tidak valid" 
    };
  } catch (error) {
    console.error("Error di saveFormattedPhone:", error);
    throw error;
  }
};

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Inisialisasi database
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

// Panggil initDb saat aplikasi start
initDb();

// Route: Homepage
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Route: Simpan nomor telepon
app.post('/api/sphone.php', async (req, res) => {
  try {
    const { userId, nomor, negara } = req.body;
    
    // Validasi input
    if (!userId || !nomor) {
      return res.status(400).json({ 
        status: "fail", 
        message: "userId dan nomor harus diisi" 
      });
    }

    // Panggil fungsi helper
    const result = await saveFormattedPhone(userId, nomor, negara || '');
    
    if (result.status === "success") {
      return res.status(200).json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    console.error("Error di endpoint /api/sphone.php:", error);
    return res.status(500).json({ 
      status: "error", 
      message: "Terjadi kesalahan pada server",
      error_detail: error.message 
    });
  }
});

// Route: Ambil semua data nomor telepon
app.get('/api/get-phones', async (req, res) => {
  try {
    console.log("Mengambil data nomor telepon dari Turso...");
    
    const result = await client.execute(
      "SELECT * FROM users ORDER BY updated_at DESC"
    );
    
    return res.status(200).json({ 
      status: "success", 
      count: result.rows.length,
      data: result.rows 
    });
  } catch (error) {
    console.error("Error di endpoint /api/get-phones:", error.message);
    return res.status(500).json({ 
      status: "error", 
      message: "Gagal mengambil data",
      error_detail: error.message 
    });
  }
});

// Jalankan server (untuk development)
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`🚀 Server berjalan di port ${PORT}`));
}

module.exports = app;
/*


Sekarang semua kode sudah digabung dalam satu file `index.js`. Anda bisa **menghapus file `phoneHelper.js`** karena semua fungsinya sudah ada di dalam `index.js`.

## **Struktur file yang dibutuhkan:**
```
project/
├── index.js          ← File utama (semua kode ada di sini)
├── .env              ← File environment variables
├── package.json
└── public/
    └── index.html*/
