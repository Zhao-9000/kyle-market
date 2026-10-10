const express = require('express');
const cors = require('cors');
const { createClient } = require('@libsql/client');

const app = express();
app.use(express.static('public'));
app.use(cors());
app.use(express.json());

// Inisialisasi Koneksi Turso Database (Cloud)
const db = createClient({
  url: process.env.TURSO_DATABASE_URL || "file:database.sqlite",
  authToken: process.env.TURSO_AUTH_TOKEN || ""
});

// Buat Tabel jika belum ada
(async () => {
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT,
        price REAL NOT NULL,
        allow_dp INTEGER DEFAULT 0,
        min_dp_amount REAL DEFAULT 0,
        file_url TEXT
      );
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER,
        client_name TEXT NOT NULL,
        client_whatsapp TEXT NOT NULL,
        payment_type TEXT NOT NULL,
        total_amount REAL NOT NULL,
        paid_amount REAL NOT NULL,
        payment_method TEXT,
        status TEXT DEFAULT 'PENDING',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("Database Cloud Siap!");
  } catch (err) {
    console.error("Error DB Init:", err);
  }
})();

// === ENDPOINT ADMIN ===

// 1. Tambah Produk Baru
app.post('/api/admin/products', async (req, res) => {
  const { title, category, description, price, allow_dp, min_dp_amount, file_url } = req.body;
  try {
    const result = await db.execute({
      sql: `INSERT INTO products (title, category, description, price, allow_dp, min_dp_amount, file_url) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [title, category, description, price, allow_dp ? 1 : 0, min_dp_amount || 0, file_url || null]
    });
    res.json({ message: "Produk/Jasa berhasil ditambahkan!", productId: Number(result.lastInsertRowid) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Ambil Daftar Pesanan (Admin)
app.get('/api/admin/orders', async (req, res) => {
  try {
    const resOrders = await db.execute(`
      SELECT orders.*, products.title as product_title 
      FROM orders 
      LEFT JOIN products ON orders.product_id = products.id 
      ORDER BY orders.id DESC
    `);
    res.json(resOrders.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Update Status Pesanan (Admin)
app.patch('/api/admin/orders/:id', async (req, res) => {
  const { status } = req.body;
  const { id } = req.params;
  try {
    await db.execute({
      sql: 'UPDATE orders SET status = ? WHERE id = ?',
      args: [status, id]
    });
    res.json({ message: `Status pesanan #${id} diperbarui menjadi ${status}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === ENDPOINT KLIEN ===

// 4. Ambil Katalog Produk
app.get('/api/products', async (req, res) => {
  try {
    const resProducts = await db.execute('SELECT * FROM products');
    res.json(resProducts.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Buat Pesanan Baru
app.post('/api/orders', async (req, res) => {
  const { product_id, client_name, client_whatsapp, payment_type, payment_method, paid_amount, total_amount } = req.body;
  try {
    const result = await db.execute({
      sql: `INSERT INTO orders (product_id, client_name, client_whatsapp, payment_type, payment_method, paid_amount, total_amount) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [product_id, client_name, client_whatsapp, payment_type, payment_method, paid_amount, total_amount]
    });
    res.json({ message: "Pesanan berhasil dibuat!", orderId: Number(result.lastInsertRowid) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server berjalan di port ${PORT}`);
});

module.exports = app;

