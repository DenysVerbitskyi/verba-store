const { Pool } = require("pg");
const bcrypt = require("bcryptjs");

class Database {
  constructor() {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      console.error("❌ DATABASE_URL not found!");
      process.exit(1);
    }

    this.pool = new Pool({
      connectionString: connectionString,
      ssl: {
        rejectUnauthorized: false,
      },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    this.pool.on("error", (err) => {
      console.error("❌ Unexpected database error:", err);
    });

    this.initDatabase();
  }

  async initDatabase() {
    try {
      console.log("🔄 Connecting to database...");
      await this.pool.query("SELECT NOW()");
      console.log("✅ Database connected");

      await this.createTables();
      console.log("✅ Tables created");

      await this.createDefaultAdmin();
      console.log("✅ Admin created");
    } catch (error) {
      console.error("❌ Database init failed:", error);
      throw error;
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
    const hashedPassword = await bcrypt.hash("admin123", 10);

    try {
      await this.pool.query(
        "INSERT INTO users (username, password) VALUES ($1, $2) ON CONFLICT (username) DO NOTHING",
        ["admin", hashedPassword]
      );
    } catch (error) {
      // Already exists
    }
  }

  // USER METHODS
  async getUserByUsername(username) {
    const result = await this.pool.query(
      "SELECT * FROM users WHERE username = $1",
      [username]
    );
    return result.rows[0];
  }

  async createUser(username, hashedPassword) {
    const result = await this.pool.query(
      "INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id",
      [username, hashedPassword]
    );
    return result.rows[0].id;
  }

  // CATEGORY METHODS
  async getAllCategories() {
    const result = await this.pool.query(
      "SELECT * FROM categories ORDER BY created_at"
    );
    return result.rows;
  }

  async createCategory(name) {
    const result = await this.pool.query(
      "INSERT INTO categories (name) VALUES ($1) RETURNING id",
      [name]
    );
    return result.rows[0].id;
  }

  async deleteCategory(id) {
    await this.pool.query("DELETE FROM categories WHERE id = $1", [id]);
  }

  // PRODUCT METHODS
  async getAllProducts() {
    const result = await this.pool.query(`
      SELECT p.*, c.name as category_name 
      FROM products p 
      LEFT JOIN categories c ON p.category_id = c.id 
      ORDER BY p.is_sale DESC, p.id DESC
    `);
    return result.rows.map((row) => ({
      ...row,
      images: row.images ? JSON.parse(row.images) : [],
    }));
  }

  async getProductsByCategory(categoryId) {
    const result = await this.pool.query(
      `
      SELECT p.*, c.name as category_name 
      FROM products p 
      LEFT JOIN categories c ON p.category_id = c.id 
      WHERE p.category_id = $1 
      ORDER BY p.is_sale DESC, p.id DESC
    `,
      [categoryId]
    );
    return result.rows.map((row) => ({
      ...row,
      images: row.images ? JSON.parse(row.images) : [],
    }));
  }

  async createProduct(
    name,
    description,
    price,
    imagePath,
    categoryId,
    isSale,
    wholesaleTier2,
    wholesaleTier3
  ) {
    const result = await this.pool.query(
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
    );
    return result.rows[0].id;
  }

  async updateProduct(
    id,
    name,
    description,
    price,
    categoryId,
    isSale,
    wholesaleTier2,
    wholesaleTier3
  ) {
    await this.pool.query(
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

  async updateProductImages(productId, images) {
    await this.pool.query("UPDATE products SET images = $1 WHERE id = $2", [
      JSON.stringify(images),
      productId,
    ]);
  }

  async deleteProduct(id) {
    await this.pool.query("DELETE FROM products WHERE id = $1", [id]);
  }

  async getProductImages(productId) {
    const result = await this.pool.query(
      "SELECT images FROM products WHERE id = $1",
      [productId]
    );
    if (result.rows[0] && result.rows[0].images) {
      return JSON.parse(result.rows[0].images);
    }
    return [];
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

  async getAllOrders() {
    const result = await this.pool.query(`
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
    `);
    return result.rows;
  }

  async getOrdersByEmail(email) {
    const result = await this.pool.query(
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
    );
    return result.rows;
  }

  async updateOrderStatus(orderId, status) {
    await this.pool.query("UPDATE orders SET status = $1 WHERE id = $2", [
      status,
      orderId,
    ]);
  }

  async deleteOrder(orderId) {
    await this.pool.query("DELETE FROM orders WHERE id = $1", [orderId]);
  }

  // VERIFICATION CODE METHODS
  async saveVerificationCode(email, code) {
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await this.pool.query("DELETE FROM verification_codes WHERE email = $1", [
      email,
    ]);
    await this.pool.query(
      "INSERT INTO verification_codes (email, code, expires_at) VALUES ($1, $2, $3)",
      [email, code, expiresAt]
    );
  }

  async getVerificationCode(email) {
    const result = await this.pool.query(
      "SELECT * FROM verification_codes WHERE email = $1 AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1",
      [email]
    );
    return result.rows[0];
  }

  async deleteVerificationCode(email) {
    await this.pool.query("DELETE FROM verification_codes WHERE email = $1", [
      email,
    ]);
  }
}

module.exports = new Database();
