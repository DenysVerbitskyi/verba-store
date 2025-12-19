const Database = require("better-sqlite3");
const path = require("path");
const bcrypt = require("bcryptjs");

const DB_PATH = path.join(__dirname, "database.sqlite");

class DatabaseManager {
  constructor() {
    console.log("📂 Database path:", DB_PATH);
    this.db = new Database(DB_PATH);
    this.db.pragma("journal_mode = WAL"); // Для кращої продуктивності
    this.createTables();
    this.createDefaultAdmin();
    console.log("✅ Database initialized");
  }

  createTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        price REAL NOT NULL,
        image_path TEXT,
        category_id INTEGER,
        images TEXT,
        is_sale INTEGER DEFAULT 0,
        wholesale_price_tier2 REAL,
        wholesale_price_tier3 REAL,
        FOREIGN KEY (category_id) REFERENCES categories(id)
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_name TEXT NOT NULL,
        customer_phone TEXT,
        customer_email TEXT NOT NULL,
        delivery_address TEXT,
        status TEXT DEFAULT 'new',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER,
        product_id INTEGER,
        product_name TEXT,
        product_price REAL,
        quantity INTEGER,
        FOREIGN KEY (order_id) REFERENCES orders(id),
        FOREIGN KEY (product_id) REFERENCES products(id)
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS verification_codes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        code TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL
      )
    `);
  }

  createDefaultAdmin() {
    const hashedPassword = bcrypt.hashSync("admin123", 10);
    const stmt = this.db.prepare(
      "INSERT OR IGNORE INTO users (username, password) VALUES (?, ?)"
    );
    stmt.run("admin", hashedPassword);
  }

  // USER METHODS
  getUserByUsername(username) {
    const stmt = this.db.prepare("SELECT * FROM users WHERE username = ?");
    return stmt.get(username);
  }

  createUser(username, hashedPassword) {
    const stmt = this.db.prepare(
      "INSERT INTO users (username, password) VALUES (?, ?)"
    );
    const result = stmt.run(username, hashedPassword);
    return result.lastInsertRowid;
  }

  // CATEGORY METHODS
  getAllCategories() {
    const stmt = this.db.prepare(
      "SELECT * FROM categories ORDER BY created_at"
    );
    return stmt.all();
  }

  createCategory(name) {
    const stmt = this.db.prepare("INSERT INTO categories (name) VALUES (?)");
    const result = stmt.run(name);
    return result.lastInsertRowid;
  }

  deleteCategory(id) {
    const stmt = this.db.prepare("DELETE FROM categories WHERE id = ?");
    stmt.run(id);
  }

  // PRODUCT METHODS
  getAllProducts() {
    const stmt = this.db.prepare(`
      SELECT p.*, c.name as category_name 
      FROM products p 
      LEFT JOIN categories c ON p.category_id = c.id 
      ORDER BY p.is_sale DESC, p.id DESC
    `);
    const products = stmt.all();
    return products.map((p) => ({
      ...p,
      images: p.images ? JSON.parse(p.images) : [],
    }));
  }

  getProductsByCategory(categoryId) {
    const stmt = this.db.prepare(`
      SELECT p.*, c.name as category_name 
      FROM products p 
      LEFT JOIN categories c ON p.category_id = c.id 
      WHERE p.category_id = ? 
      ORDER BY p.is_sale DESC, p.id DESC
    `);
    const products = stmt.all(categoryId);
    return products.map((p) => ({
      ...p,
      images: p.images ? JSON.parse(p.images) : [],
    }));
  }

  createProduct(
    name,
    description,
    price,
    imagePath,
    categoryId,
    isSale,
    wholesaleTier2,
    wholesaleTier3
  ) {
    const stmt = this.db.prepare(`
      INSERT INTO products (name, description, price, image_path, category_id, is_sale, wholesale_price_tier2, wholesale_price_tier3) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      name,
      description,
      price,
      imagePath,
      categoryId,
      isSale ? 1 : 0,
      wholesaleTier2,
      wholesaleTier3
    );
    return result.lastInsertRowid;
  }

  updateProduct(
    id,
    name,
    description,
    price,
    categoryId,
    isSale,
    wholesaleTier2,
    wholesaleTier3
  ) {
    const stmt = this.db.prepare(`
      UPDATE products 
      SET name = ?, description = ?, price = ?, category_id = ?, is_sale = ?, 
          wholesale_price_tier2 = ?, wholesale_price_tier3 = ? 
      WHERE id = ?
    `);
    stmt.run(
      name,
      description,
      price,
      categoryId,
      isSale ? 1 : 0,
      wholesaleTier2,
      wholesaleTier3,
      id
    );
  }

  updateProductImages(productId, images) {
    const stmt = this.db.prepare("UPDATE products SET images = ? WHERE id = ?");
    stmt.run(JSON.stringify(images), productId);
  }

  deleteProduct(id) {
    const stmt = this.db.prepare("DELETE FROM products WHERE id = ?");
    stmt.run(id);
  }

  getProductImages(productId) {
    const stmt = this.db.prepare("SELECT images FROM products WHERE id = ?");
    const result = stmt.get(productId);
    if (result && result.images) {
      return JSON.parse(result.images);
    }
    return [];
  }

  // ORDER METHODS
  createOrder(
    customerName,
    customerPhone,
    customerEmail,
    deliveryAddress,
    items
  ) {
    const insertOrder = this.db.prepare(
      "INSERT INTO orders (customer_name, customer_phone, customer_email, delivery_address) VALUES (?, ?, ?, ?)"
    );
    const insertItem = this.db.prepare(
      "INSERT INTO order_items (order_id, product_id, product_name, product_price, quantity) VALUES (?, ?, ?, ?, ?)"
    );

    const transaction = this.db.transaction(
      (name, phone, email, address, orderItems) => {
        const orderResult = insertOrder.run(name, phone, email, address);
        const orderId = orderResult.lastInsertRowid;

        for (const item of orderItems) {
          insertItem.run(
            orderId,
            item.id,
            item.name,
            item.price,
            item.quantity
          );
        }

        return orderId;
      }
    );

    return transaction(
      customerName,
      customerPhone,
      customerEmail,
      deliveryAddress,
      items
    );
  }

  getAllOrders() {
    const orders = this.db
      .prepare(
        `
      SELECT o.* FROM orders o ORDER BY o.created_at DESC
    `
      )
      .all();

    return orders.map((order) => {
      const items = this.db
        .prepare(
          `
        SELECT product_name, product_price, quantity 
        FROM order_items 
        WHERE order_id = ?
      `
        )
        .all(order.id);

      return {
        ...order,
        items: items,
      };
    });
  }

  getOrdersByEmail(email) {
    const orders = this.db
      .prepare(
        `
      SELECT o.* FROM orders o WHERE o.customer_email = ? ORDER BY o.created_at DESC
    `
      )
      .all(email);

    return orders.map((order) => {
      const items = this.db
        .prepare(
          `
        SELECT product_id, product_name, product_price, quantity 
        FROM order_items 
        WHERE order_id = ?
      `
        )
        .all(order.id);

      const totalAmount = items.reduce(
        (sum, item) => sum + item.product_price * item.quantity,
        0
      );

      return {
        ...order,
        items: items,
        total_amount: totalAmount,
      };
    });
  }

  updateOrderStatus(orderId, status) {
    const stmt = this.db.prepare("UPDATE orders SET status = ? WHERE id = ?");
    stmt.run(status, orderId);
  }

  deleteOrder(orderId) {
    const stmt = this.db.prepare("DELETE FROM orders WHERE id = ?");
    stmt.run(orderId);
  }

  saveVerificationCode(email, code) {
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const deleteStmt = this.db.prepare(
      "DELETE FROM verification_codes WHERE email = ?"
    );
    deleteStmt.run(email);

    const insertStmt = this.db.prepare(
      "INSERT INTO verification_codes (email, code, expires_at) VALUES (?, ?, ?)"
    );
    insertStmt.run(email, code, expiresAt);
  }

  getVerificationCode(email) {
    const stmt = this.db.prepare(`
      SELECT * FROM verification_codes 
      WHERE email = ? AND datetime(expires_at) > datetime('now') 
      ORDER BY created_at DESC 
      LIMIT 1
    `);
    return stmt.get(email);
  }

  deleteVerificationCode(email) {
    const stmt = this.db.prepare(
      "DELETE FROM verification_codes WHERE email = ?"
    );
    stmt.run(email);
  }
}

module.exports = new DatabaseManager();
