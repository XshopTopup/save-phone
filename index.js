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
    const phone = typeof phoneModule === 'function' ? phoneModule : require('phone').phone;
    const result = phone(inputNomor, { country: inputNegara || undefined });
    
    if (result.isValid) {
      const formatted = result.phoneNumber;
      const countryName = result.countryIso3;
      
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
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("✅ Database Turso siap");
  } catch (error) {
    console.error("❌ Gagal inisialisasi tabel:", error.message);
  }
};

initDb();

// Route: Homepage
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============= CRUD ENDPOINTS =============

// CREATE - Simpan nomor telepon baru
app.post('/api/phones', async (req, res) => {
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
      return res.status(201).json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    console.error("Error di POST /api/phones:", error);
    return res.status(500).json({ 
      status: "error", 
      message: "Terjadi kesalahan pada server",
      error_detail: error.message 
    });
  }
});

// READ - Ambil semua data nomor telepon
app.get('/api/phones', async (req, res) => {
  try {
    const { limit, offset, search } = req.query;
    
    let sql = "SELECT * FROM users";
    let args = [];
    
    // Fitur pencarian
    if (search) {
      sql += " WHERE phone_number LIKE ? OR country_info LIKE ?";
      args.push(`%${search}%`, `%${search}%`);
    }
    
    sql += " ORDER BY updated_at DESC";
    
    // Pagination
    if (limit) {
      sql += " LIMIT ?";
      args.push(parseInt(limit));
      
      if (offset) {
        sql += " OFFSET ?";
        args.push(parseInt(offset));
      }
    }
    
    const result = await client.execute({ sql, args });
    
    // Hitung total data
    const countResult = await client.execute("SELECT COUNT(*) as total FROM users");
    const total = countResult.rows[0].total;
    
    return res.status(200).json({ 
      status: "success", 
      total: total,
      count: result.rows.length,
      data: result.rows 
    });
  } catch (error) {
    console.error("Error di GET /api/phones:", error.message);
    return res.status(500).json({ 
      status: "error", 
      message: "Gagal mengambil data",
      error_detail: error.message 
    });
  }
});

// READ - Ambil satu data berdasarkan ID
app.get('/api/phones/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await client.execute({
      sql: "SELECT * FROM users WHERE id = ?",
      args: [id]
    });
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        status: "fail", 
        message: "Data tidak ditemukan" 
      });
    }
    
    return res.status(200).json({ 
      status: "success", 
      data: result.rows[0] 
    });
  } catch (error) {
    console.error("Error di GET /api/phones/:id:", error.message);
    return res.status(500).json({ 
      status: "error", 
      message: "Gagal mengambil data",
      error_detail: error.message 
    });
  }
});

// UPDATE - Update nomor telepon
app.put('/api/phones/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nomor, negara } = req.body;
    
    if (!nomor) {
      return res.status(400).json({ 
        status: "fail", 
        message: "Nomor harus diisi" 
      });
    }
    
    // Cek apakah data ada
    const checkResult = await client.execute({
      sql: "SELECT * FROM users WHERE id = ?",
      args: [id]
    });
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ 
        status: "fail", 
        message: "Data tidak ditemukan" 
      });
    }
    
    // Validasi nomor baru
    const phone = typeof phoneModule === 'function' ? phoneModule : require('phone').phone;
    const result = phone(nomor, { country: negara || undefined });
    
    if (!result.isValid) {
      return res.status(400).json({ 
        status: "fail", 
        message: "Nomor tidak valid" 
      });
    }
    
    // Update data
    await client.execute({
      sql: `UPDATE users 
            SET phone_number = ?, country_info = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?`,
      args: [result.phoneNumber, result.countryIso3, id]
    });
    
    return res.status(200).json({ 
      status: "success", 
      message: "Data berhasil diupdate",
      data: {
        id: id,
        phone_number: result.phoneNumber,
        country_info: result.countryIso3
      }
    });
  } catch (error) {
    console.error("Error di PUT /api/phones/:id:", error.message);
    return res.status(500).json({ 
      status: "error", 
      message: "Gagal mengupdate data",
      error_detail: error.message 
    });
  }
});

// DELETE - Hapus data
app.delete('/api/phones/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Cek apakah data ada
    const checkResult = await client.execute({
      sql: "SELECT * FROM users WHERE id = ?",
      args: [id]
    });
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ 
        status: "fail", 
        message: "Data tidak ditemukan" 
      });
    }
    
    // Hapus data
    await client.execute({
      sql: "DELETE FROM users WHERE id = ?",
      args: [id]
    });
    
    return res.status(200).json({ 
      status: "success", 
      message: "Data berhasil dihapus" 
    });
  } catch (error) {
    console.error("Error di DELETE /api/phones/:id:", error.message);
    return res.status(500).json({ 
      status: "error", 
      message: "Gagal menghapus data",
      error_detail: error.message 
    });
  }
});

// DELETE ALL - Hapus semua data
app.delete('/api/phones', async (req, res) => {
  try {
    await client.execute("DELETE FROM users");
    
    return res.status(200).json({ 
      status: "success", 
      message: "Semua data berhasil dihapus" 
    });
  } catch (error) {
    console.error("Error di DELETE /api/phones:", error.message);
    return res.status(500).json({ 
      status: "error", 
      message: "Gagal menghapus data",
      error_detail: error.message 
    });
  }
});

// STATISTICS - Statistik database
app.get('/api/stats', async (req, res) => {
  try {
    const totalResult = await client.execute("SELECT COUNT(*) as total FROM users");
    const countryResult = await client.execute(
      "SELECT country_info, COUNT(*) as count FROM users GROUP BY country_info ORDER BY count DESC"
    );
    
    return res.status(200).json({ 
      status: "success", 
      stats: {
        total_records: totalResult.rows[0].total,
        by_country: countryResult.rows
      }
    });
  } catch (error) {
    console.error("Error di GET /api/stats:", error.message);
    return res.status(500).json({ 
      status: "error", 
      message: "Gagal mengambil statistik",
      error_detail: error.message 
    });
  }
});

// Backward compatibility dengan endpoint lama
app.post('/api/sphone.php', async (req, res) => {
  req.url = '/api/phones';
  app.handle(req, res);
});

app.get('/api/get-phones', async (req, res) => {
  req.url = '/api/phones';
  app.handle(req, res);
});

// Jalankan server
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🚀 Server berjalan di port ${PORT}`);
    console.log(`📊 Database API tersedia di:`);
    console.log(`   - GET    /api/phones       - Ambil semua data`);
    console.log(`   - GET    /api/phones/:id   - Ambil data by ID`);
    console.log(`   - POST   /api/phones       - Tambah data baru`);
    console.log(`   - PUT    /api/phones/:id   - Update data`);
    console.log(`   - DELETE /api/phones/:id   - Hapus data`);
    console.log(`   - DELETE /api/phones       - Hapus semua data`);
    console.log(`   - GET    /api/stats        - Statistik database`);
  });
}

module.exports = app;
