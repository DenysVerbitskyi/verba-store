const { Pool } = require("pg");

class Database {
  constructor() {
    const connectionString = process.env.DATABASE_URL;

    this.pool = new Pool({
      connectionString: connectionString,
      ssl: connectionString?.includes("railway")
        ? { rejectUnauthorized: false }
        : false,
    });

    // Обробка помилок з'єднання
    this.pool.on("error", (err) => {
      console.error("❌ Unexpected database error:", err);
    });

    // Затримка для з'єднання
    setTimeout(() => {
      this.init();
    }, 1000);
  }

  async init() {
    try {
      await this.createTables();
      await this.createDefaultAdmin();
      console.log("✅ Database initialized");
    } catch (error) {
      console.error("❌ Database initialization error:", error);
    }
  }

  async createTables() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        price DECIMAL(10,2) NOT NULL,
        image_path TEXT,
        category_id INTEGER,
        images TEXT,
        is_sale INTEGER DEFAULT 0,
        wholesale_price_tier2 DECIMAL(10,2),
        wholesale_price_tier3 DECIMAL(10,2),
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
      )
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        customer_name TEXT NOT NULL,
        customer_phone TEXT,
        customer_email TEXT NOT NULL,
        delivery_address TEXT,
        status TEXT DEFAULT 'new',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER,
        product_id INTEGER,
        product_name TEXT,
        product_price DECIMAL(10,2),
        quantity INTEGER,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id)
      )
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS verification_codes (
        id SERIAL PRIMARY KEY,
        email TEXT NOT NULL,
        code TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL
      )
    `);
  }

  async createDefaultAdmin() {
    const bcrypt = require("bcryptjs");
    const hashedPassword = await bcrypt.hash("admin123", 10);

    try {
      await this.pool.query(
        "INSERT INTO users (username, password) VALUES ($1, $2) ON CONFLICT (username) DO NOTHING",
        ["admin", hashedPassword]
      );
    } catch (error) {
      // Вже існує
    }
  }

  // USER METHODS
  getUserByUsername(username) {
    return this.pool
      .query("SELECT * FROM users WHERE username = $1", [username])
      .then((res) => res.rows[0]);
  }

  createUser(username, hashedPassword) {
    return this.pool
      .query(
        "INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id",
        [username, hashedPassword]
      )
      .then((res) => res.rows[0].id);
  }

  // CATEGORY METHODS
  getAllCategories() {
    return this.pool
      .query("SELECT * FROM categories ORDER BY created_at")
      .then((res) => res.rows);
  }

  createCategory(name) {
    return this.pool
      .query("INSERT INTO categories (name) VALUES ($1) RETURNING id", [name])
      .then((res) => res.rows[0].id);
  }

  deleteCategory(id) {
    return this.pool.query("DELETE FROM categories WHERE id = $1", [id]);
  }

  // PRODUCT METHODS
  getAllProducts() {
    return this.pool
      .query(
        `
      SELECT p.*, c.name as category_name 
      FROM products p 
      LEFT JOIN categories c ON p.category_id = c.id 
      ORDER BY p.is_sale DESC, p.created_at DESC
    `
      )
      .then((res) => {
        return res.rows.map((row) => ({
          ...row,
          images: row.images ? JSON.parse(row.images) : [],
        }));
      });
  }

  getProductsByCategory(categoryId) {
    return this.pool
      .query(
        `
      SELECT p.*, c.name as category_name 
      FROM products p 
      LEFT JOIN categories c ON p.category_id = c.id 
      WHERE p.category_id = $1 
      ORDER BY p.is_sale DESC, p.created_at DESC
    `,
        [categoryId]
      )
      .then((res) => {
        return res.rows.map((row) => ({
          ...row,
          images: row.images ? JSON.parse(row.images) : [],
        }));
      });
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
    return this.pool
      .query(
        `INSERT INTO products (name, description, price, image_path, category_id, is_sale, wholesale_price_tier2, wholesale_price_tier3) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [
          name,
          description,
          price,
          imagePath,
          categoryId,
          isSale ? 1 : 0,
          wholesaleTier2,
          wholesaleTier3,
        ]
      )
      .then((res) => res.rows[0].id);
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
    return this.pool.query(
      `UPDATE products 
       SET name = $1, description = $2, price = $3, category_id = $4, is_sale = $5, 
           wholesale_price_tier2 = $6, wholesale_price_tier3 = $7 
       WHERE id = $8`,
      [
        name,
        description,
        price,
        categoryId,
        isSale ? 1 : 0,
        wholesaleTier2,
        wholesaleTier3,
        id,
      ]
    );
  }

  updateProductImages(productId, images) {
    return this.pool.query("UPDATE products SET images = $1 WHERE id = $2", [
      JSON.stringify(images),
      productId,
    ]);
  }

  deleteProduct(id) {
    return this.pool.query("DELETE FROM products WHERE id = $1", [id]);
  }

  getProductImages(productId) {
    return this.pool
      .query("SELECT images FROM products WHERE id = $1", [productId])
      .then((res) => {
        if (res.rows[0] && res.rows[0].images) {
          return JSON.parse(res.rows[0].images);
        }
        return [];
      });
  }

  // ORDER METHODS
  async createOrder(
    customerName,
    customerPhone,
    customerEmail,
    deliveryAddress,
    items
  ) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      const orderResult = await client.query(
        "INSERT INTO orders (customer_name, customer_phone, customer_email, delivery_address) VALUES ($1, $2, $3, $4) RETURNING id",
        [customerName, customerPhone, customerEmail, deliveryAddress]
      );
      const orderId = orderResult.rows[0].id;

      for (const item of items) {
        await client.query(
          "INSERT INTO order_items (order_id, product_id, product_name, product_price, quantity) VALUES ($1, $2, $3, $4, $5)",
          [orderId, item.id, item.name, item.price, item.quantity]
        );
      }

      await client.query("COMMIT");
      return orderId;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  getAllOrders() {
    return this.pool
      .query(
        `
      SELECT o.*, 
             json_agg(json_build_object(
               'product_name', oi.product_name,
               'product_price', oi.product_price,
               'quantity', oi.quantity
             )) as items
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `
      )
      .then((res) => res.rows);
  }

  getOrdersByEmail(email) {
    return this.pool
      .query(
        `
      SELECT o.*, 
             SUM(oi.product_price * oi.quantity) as total_amount,
             json_agg(json_build_object(
               'product_id', oi.product_id,
               'product_name', oi.product_name,
               'product_price', oi.product_price,
               'quantity', oi.quantity
             )) as items
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.customer_email = $1
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `,
        [email]
      )
      .then((res) => res.rows);
  }

  updateOrderStatus(orderId, status) {
    return this.pool.query("UPDATE orders SET status = $1 WHERE id = $2", [
      status,
      orderId,
    ]);
  }

  deleteOrder(orderId) {
    return this.pool.query("DELETE FROM orders WHERE id = $1", [orderId]);
  }

  // VERIFICATION CODE METHODS
  async saveVerificationCode(email, code) {
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    await this.pool.query("DELETE FROM verification_codes WHERE email = $1", [
      email,
    ]);
    return this.pool.query(
      "INSERT INTO verification_codes (email, code, expires_at) VALUES ($1, $2, $3)",
      [email, code, expiresAt]
    );
  }

  getVerificationCode(email) {
    return this.pool
      .query(
        "SELECT * FROM verification_codes WHERE email = $1 AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1",
        [email]
      )
      .then((res) => res.rows[0]);
  }

  deleteVerificationCode(email) {
    return this.pool.query("DELETE FROM verification_codes WHERE email = $1", [
      email,
    ]);
  }
}

module.exports = new Database();
