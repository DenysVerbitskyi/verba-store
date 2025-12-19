const postgres = require("postgres");
const bcrypt = require("bcryptjs");

class Database {
  constructor() {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      console.error("❌ DATABASE_URL not found!");
      process.exit(1);
    }

    // postgres-js connection
    this.sql = postgres(connectionString, {
      ssl: { rejectUnauthorized: false }, // ← ЗАМІСТЬ 'require'
      max: 20,
      idle_timeout: 30,
      connect_timeout: 10,
    });

    this.initDatabase();
  }

  async initDatabase() {
    try {
      console.log("🔄 Connecting to database...");
      await this.sql`SELECT NOW()`;
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
    await this.sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await this.sql`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await this.sql`
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
    `;

    await this.sql`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        customer_name TEXT NOT NULL,
        customer_phone TEXT,
        customer_email TEXT NOT NULL,
        delivery_address TEXT,
        status TEXT DEFAULT 'new',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await this.sql`
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
    `;

    await this.sql`
      CREATE TABLE IF NOT EXISTS verification_codes (
        id SERIAL PRIMARY KEY,
        email TEXT NOT NULL,
        code TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL
      )
    `;
  }

  async createDefaultAdmin() {
    const hashedPassword = await bcrypt.hash("admin123", 10);

    try {
      await this.sql`
        INSERT INTO users (username, password) 
        VALUES ('admin', ${hashedPassword}) 
        ON CONFLICT (username) DO NOTHING
      `;
    } catch (error) {
      // Already exists
    }
  }

  // USER METHODS
  async getUserByUsername(username) {
    const result = await this
      .sql`SELECT * FROM users WHERE username = ${username}`;
    return result[0];
  }

  async createUser(username, hashedPassword) {
    const result = await this.sql`
      INSERT INTO users (username, password) 
      VALUES (${username}, ${hashedPassword}) 
      RETURNING id
    `;
    return result[0].id;
  }

  // CATEGORY METHODS
  async getAllCategories() {
    const result = await this.sql`SELECT * FROM categories ORDER BY created_at`;
    return result;
  }

  async createCategory(name) {
    const result = await this.sql`
      INSERT INTO categories (name) 
      VALUES (${name}) 
      RETURNING id
    `;
    return result[0].id;
  }

  async deleteCategory(id) {
    await this.sql`DELETE FROM categories WHERE id = ${id}`;
  }

  // PRODUCT METHODS
  async getAllProducts() {
    const result = await this.sql`
      SELECT p.*, c.name as category_name 
      FROM products p 
      LEFT JOIN categories c ON p.category_id = c.id 
      ORDER BY p.is_sale DESC, p.id DESC
    `;
    return result.map((row) => ({
      ...row,
      images: row.images ? JSON.parse(row.images) : [],
    }));
  }

  async getProductsByCategory(categoryId) {
    const result = await this.sql`
      SELECT p.*, c.name as category_name 
      FROM products p 
      LEFT JOIN categories c ON p.category_id = c.id 
      WHERE p.category_id = ${categoryId} 
      ORDER BY p.is_sale DESC, p.id DESC
    `;
    return result.map((row) => ({
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
    const result = await this.sql`
      INSERT INTO products (name, description, price, image_path, category_id, is_sale, wholesale_price_tier2, wholesale_price_tier3) 
      VALUES (${name}, ${description}, ${price}, ${imagePath}, ${categoryId}, ${
      isSale ? 1 : 0
    }, ${wholesaleTier2}, ${wholesaleTier3}) 
      RETURNING id
    `;
    return result[0].id;
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
    await this.sql`
      UPDATE products 
      SET name = ${name}, description = ${description}, price = ${price}, category_id = ${categoryId}, 
          is_sale = ${
            isSale ? 1 : 0
          }, wholesale_price_tier2 = ${wholesaleTier2}, wholesale_price_tier3 = ${wholesaleTier3} 
      WHERE id = ${id}
    `;
  }

  async updateProductImages(productId, images) {
    await this.sql`
      UPDATE products 
      SET images = ${JSON.stringify(images)} 
      WHERE id = ${productId}
    `;
  }

  async deleteProduct(id) {
    await this.sql`DELETE FROM products WHERE id = ${id}`;
  }

  async getProductImages(productId) {
    const result = await this
      .sql`SELECT images FROM products WHERE id = ${productId}`;
    if (result[0] && result[0].images) {
      return JSON.parse(result[0].images);
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
    return await this.sql.begin(async (sql) => {
      const orderResult = await sql`
        INSERT INTO orders (customer_name, customer_phone, customer_email, delivery_address) 
        VALUES (${customerName}, ${customerPhone}, ${customerEmail}, ${deliveryAddress}) 
        RETURNING id
      `;
      const orderId = orderResult[0].id;

      for (const item of items) {
        await sql`
          INSERT INTO order_items (order_id, product_id, product_name, product_price, quantity) 
          VALUES (${orderId}, ${item.id}, ${item.name}, ${item.price}, ${item.quantity})
        `;
      }

      return orderId;
    });
  }

  async getAllOrders() {
    const result = await this.sql`
      SELECT o.id, o.customer_name, o.customer_phone, o.customer_email, 
             o.delivery_address, o.status, o.created_at,
             json_agg(json_build_object(
               'product_name', oi.product_name,
               'product_price', oi.product_price,
               'quantity', oi.quantity
             )) as items
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `;
    return result;
  }

  async getOrdersByEmail(email) {
    const result = await this.sql`
      SELECT o.id, o.customer_name, o.customer_phone, o.customer_email,
             o.delivery_address, o.status, o.created_at,
             SUM(oi.product_price * oi.quantity) as total_amount,
             json_agg(json_build_object(
               'product_id', oi.product_id,
               'product_name', oi.product_name,
               'product_price', oi.product_price,
               'quantity', oi.quantity
             )) as items
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.customer_email = ${email}
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `;
    return result;
  }

  async updateOrderStatus(orderId, status) {
    await this.sql`
      UPDATE orders 
      SET status = ${status} 
      WHERE id = ${orderId}
    `;
  }

  async deleteOrder(orderId) {
    await this.sql`DELETE FROM orders WHERE id = ${orderId}`;
  }

  // VERIFICATION CODE METHODS
  async saveVerificationCode(email, code) {
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await this.sql`DELETE FROM verification_codes WHERE email = ${email}`;
    await this.sql`
      INSERT INTO verification_codes (email, code, expires_at) 
      VALUES (${email}, ${code}, ${expiresAt})
    `;
  }

  async getVerificationCode(email) {
    const result = await this.sql`
      SELECT * FROM verification_codes 
      WHERE email = ${email} AND expires_at > NOW() 
      ORDER BY created_at DESC 
      LIMIT 1
    `;
    return result[0];
  }

  async deleteVerificationCode(email) {
    await this.sql`DELETE FROM verification_codes WHERE email = ${email}`;
  }
}

module.exports = new Database();
