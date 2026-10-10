const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

const app = express();
app.use(express.static('public'));
app.use(cors());
app.use(express.json());


let db;

// Inisialisasi Database SQLite
(async () => {
  db = await open({
    filename: './database.sqlite',
    driver: sqlite3.Database
  });

  // Tabel Produk & Jasa (Bisa tambah opsi jualan baru kapan saja)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT NOT NULL, -- 'jasa', 'ebook', 'lisensi', dll.
      description TEXT,
      price REAL NOT NULL,
      allow_dp INTEGER DEFAULT 0, -- 1 jika bisa DP, 0 jika harus lunas
      min_dp_amount REAL DEFAULT 0,
      file_url TEXT -- URL file jika produk digital (ebook/akun)
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER,
      client_name TEXT NOT NULL,
      client_whatsapp TEXT NOT NULL,
      payment_type TEXT NOT NULL, -- 'FULL' atau 'DP'
      total_amount REAL NOT NULL,
      paid_amount REAL NOT NULL,
      payment_method TEXT, -- 'QRIS', 'Bank', 'E-Wallet'
      status TEXT DEFAULT 'PENDING', -- PENDING, IN_PROGRESS, COMPLETED, REVISION
      proof_of_payment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log("Database & Tabel Siap!");
})();

// === ENDPOINT UNTUK ADMIN ===

// 1. Tambah Opsi Jualan Baru (Produk/Jasa)
app.post('/api/admin/products', async (req, res) => {
  const { title, category, description, price, allow_dp, min_dp_amount, file_url } = req.body;
  const result = await db.run(
    `INSERT INTO products (title, category, description, price, allow_dp, min_dp_amount, file_url) 
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [title, category, description, price, allow_dp ? 1 : 0, min_dp_amount || 0, file_url || null]
  );
  res.json({ message: "Produk/Jasa berhasil ditambahkan!", productId: result.lastID });
});

// 4. Ambil Semua Daftar Pesanan (Admin)
app.get('/api/admin/orders', async (req, res) => {
  const orders = await db.all(`
    SELECT orders.*, products.title as product_title 
    FROM orders 
    LEFT JOIN products ON orders.product_id = products.id 
    ORDER BY orders.id DESC
  `);
  res.json(orders);
});

// 5. Update Status Pesanan (Admin)
app.patch('/api/admin/orders/:id', async (req, res) => {
  const { status } = req.body;
  const { id } = req.params;
  
  await db.run('UPDATE orders SET status = ? WHERE id = ?', [status, id]);
  res.json({ message: `Status pesanan #${id} diperbarui menjadi ${status}` });
});

// === ENDPOINT UNTUK KLIEN ===

// 2. Ambil Semua Katalog Produk/Jasa
app.get('/api/products', async (req, res) => {
  const products = await db.all('SELECT * FROM products');
  res.json(products);
});

// 3. Buat Pesanan Baru (Klien)
app.post('/api/orders', async (req, res) => {
  const { product_id, client_name, client_whatsapp, payment_type, payment_method, paid_amount, total_amount } = req.body;
  
  const result = await db.run(
    `INSERT INTO orders (product_id, client_name, client_whatsapp, payment_type, payment_method, paid_amount, total_amount)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [product_id, client_name, client_whatsapp, payment_type, payment_method, paid_amount, total_amount]
  );

  res.json({ message: "Pesanan berhasil dibuat!", orderId: result.lastID });
});

// Jalankan Server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});


