const initSqlJs = require("sql.js");
const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "../database.sqlite");

class Database {
  constructor() {
    this.db = null;
    this.init();
  }

  async init() {
    const SQL = await initSqlJs();

    // Try to load existing database
    if (fs.existsSync(DB_PATH)) {
      const buffer = fs.readFileSync(DB_PATH);
      this.db = new SQL.Database(buffer);
    } else {
      this.db = new SQL.Database();
      this.createTables();
      this.createDefaultAdmin();
    }
  }

  save() {
    if (this.db) {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(DB_PATH, buffer);
    }
  }

  createTables() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    this.db.run(`
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

    this.db.run(`
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_name TEXT NOT NULL,
        customer_phone TEXT,
        customer_email TEXT NOT NULL,
        delivery_address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    this.db.run(`
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

    this.db.run(`
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

    this.db.run(`
      CREATE TABLE IF NOT EXISTS verification_codes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        code TEXT NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    this.save();
  }

  async createDefaultAdmin() {
    const bcrypt = require("bcryptjs");
    const hashedPassword = await bcrypt.hash("admin123", 10);

    this.db.run("INSERT INTO users (username, password) VALUES (?, ?)", [
      "admin",
      hashedPassword,
    ]);
    this.save();
  }

  // User methods
  getUserByUsername(username) {
    const stmt = this.db.prepare("SELECT * FROM users WHERE username = ?");
    stmt.bind([username]);
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return row;
    }
    stmt.free();
    return null;
  }

  createUser(username, hashedPassword) {
    this.db.run("INSERT INTO users (username, password) VALUES (?, ?)", [
      username,
      hashedPassword,
    ]);
    this.save();
    return this.db.exec("SELECT last_insert_rowid()")[0].values[0][0];
  }

  // Category methods
  getAllCategories() {
    const result = this.db.exec("SELECT * FROM categories ORDER BY name");
    if (result.length === 0) return [];

    const columns = result[0].columns;
    const values = result[0].values;

    return values.map((row) => {
      const obj = {};
      columns.forEach((col, i) => {
        obj[col] = row[i];
      });
      return obj;
    });
  }

  createCategory(name) {
    this.db.run("INSERT INTO categories (name) VALUES (?)", [name]);
    this.save();
    return this.db.exec("SELECT last_insert_rowid()")[0].values[0][0];
  }

  deleteCategory(id) {
    // Delete all products in this category first
    this.db.run("DELETE FROM products WHERE category_id = ?", [id]);
    this.db.run("DELETE FROM categories WHERE id = ?", [id]);
    this.save();
  }

  // Product methods
  getAllProducts() {
    const result = this.db.exec(
      "SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id ORDER BY p.is_sale DESC, p.name"
    );

    if (result.length === 0) return [];

    const columns = result[0].columns;
    const values = result[0].values;

    return values.map((row) => {
      const obj = {};
      columns.forEach((col, i) => {
        obj[col] = row[i];
      });

      // Парсити images з JSON
      if (obj.images) {
        try {
          obj.images = JSON.parse(obj.images);
        } catch (e) {
          obj.images = [];
        }
      }

      return obj;
    });
  }

  getProductsByCategory(categoryId) {
    const result = this.db.exec(
      "SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.category_id = ? ORDER BY p.is_sale DESC, p.name",
      [categoryId]
    );

    if (result.length === 0) return [];

    const columns = result[0].columns;
    const values = result[0].values;

    return values.map((row) => {
      const obj = {};
      columns.forEach((col, i) => {
        obj[col] = row[i];
      });

      // Парсити images з JSON
      if (obj.images) {
        try {
          obj.images = JSON.parse(obj.images);
        } catch (e) {
          obj.images = [];
        }
      }

      return obj;
    });
  }

  getProductById(id) {
    const stmt = this.db.prepare("SELECT * FROM products WHERE id = ?");
    stmt.bind([id]);
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      // Parse images JSON
      if (row.images) {
        try {
          row.images = JSON.parse(row.images);
        } catch (e) {
          row.images = [];
        }
      } else {
        row.images = [];
      }
      return row;
    }
    stmt.free();
    return null;
  }

  createProduct(
    name,
    description,
    price,
    imagePath,
    categoryId,
    images,
    isSale,
    wholesaleTier2,
    wholesaleTier3
  ) {
    const imagesJson = JSON.stringify(images);
    this.db.run(
      "INSERT INTO products (name, description, price, image_path, category_id, images, is_sale, wholesale_price_tier2, wholesale_price_tier3) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        name,
        description,
        price,
        imagePath,
        categoryId,
        images,
        isSale || 0,
        wholesaleTier2 || null,
        wholesaleTier3 || null,
      ]
    );
    this.save();
    return this.db.exec("SELECT last_insert_rowid()")[0].values[0][0];
  }

  deleteProduct(id) {
    this.db.run("DELETE FROM products WHERE id = ?", [id]);
    this.save();
  }

  updateProduct(
    id,
    name,
    description,
    price,
    imagePath,
    categoryId,
    images,
    isSale,
    wholesaleTier2,
    wholesaleTier3
  ) {
    const imagesJson = images ? JSON.stringify(images) : null;
    if (imagePath && imagesJson) {
      this.db.run(
        "UPDATE products SET name = ?, description = ?, price = ?, category_id = ?, image_path = ?, is_sale = ?, images = ?, wholesale_price_tier2 = ?, wholesale_price_tier3 = ? WHERE id = ?",
        [
          name,
          description,
          price,
          categoryId,
          imagePath,
          isSale,
          imagesJson,
          wholesaleTier2,
          wholesaleTier3,
          id,
        ]
      );
    } else if (imagePath) {
      this.db.run(
        "UPDATE products SET name = ?, description = ?, price = ?, category_id = ?, image_path = ?, is_sale = ?, wholesale_price_tier2 = ?, wholesale_price_tier3 = ? WHERE id = ?",
        [
          name,
          description,
          price,
          categoryId,
          imagePath,
          isSale,
          wholesaleTier2,
          wholesaleTier3,
          id,
        ]
      );
    } else if (imagesJson) {
      this.db.run(
        "UPDATE products SET name = ?, description = ?, price = ?, category_id = ?, is_sale = ?, images = ?, wholesale_price_tier2 = ?, wholesale_price_tier3 = ? WHERE id = ?",
        [
          name,
          description,
          price,
          categoryId,
          isSale,
          imagesJson,
          wholesaleTier2,
          wholesaleTier3,
          id,
        ]
      );
    } else {
      this.db.run(
        "UPDATE products SET name = ?, description = ?, price = ?, category_id = ?, is_sale = ?, wholesale_price_tier2 = ?, wholesale_price_tier3 = ? WHERE id = ?",
        [
          name,
          description,
          price,
          categoryId,
          isSale,
          wholesaleTier2,
          wholesaleTier3,
          id,
        ]
      );
    }
    this.save();
  }

  // Order methods
  createOrder(
    customerName,
    customerPhone,
    customerEmail,
    deliveryAddress,
    items
  ) {
    const totalAmount = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    this.db.run(
      "INSERT INTO orders (customer_name, customer_phone, customer_email, delivery_address) VALUES (?, ?, ?, ?)",
      [customerName, customerPhone, customerEmail, deliveryAddress]
    );

    const orderId = this.db.exec("SELECT last_insert_rowid()")[0].values[0][0];

    items.forEach((item) => {
      this.db.run(
        "INSERT INTO order_items (order_id, product_id, product_name, product_price, quantity) VALUES (?, ?, ?, ?, ?)",
        [orderId, item.id, item.name, item.price, item.quantity]
      );
    });

    this.save();
    return orderId;
  }

  getAllOrders() {
    const result = this.db.exec(
      "SELECT * FROM orders ORDER BY created_at DESC"
    );

    if (result.length === 0) return [];

    const columns = result[0].columns;
    const values = result[0].values;

    const orders = values.map((row) => {
      const obj = {};
      columns.forEach((col, i) => {
        obj[col] = row[i];
      });
      return obj;
    });

    // Get items for each order
    orders.forEach((order) => {
      const itemsResult = this.db.exec(
        "SELECT * FROM order_items WHERE order_id = ?",
        [order.id]
      );

      if (itemsResult.length > 0) {
        const itemColumns = itemsResult[0].columns;
        const itemValues = itemsResult[0].values;

        order.items = itemValues.map((row) => {
          const obj = {};
          itemColumns.forEach((col, i) => {
            obj[col] = row[i];
          });
          return obj;
        });
      } else {
        order.items = [];
      }
    });

    return orders;
  }

  getOrderById(id) {
    const stmt = this.db.prepare("SELECT * FROM orders WHERE id = ?");
    stmt.bind([id]);

    if (stmt.step()) {
      const order = stmt.getAsObject();
      stmt.free();

      // Get order items
      const itemsResult = this.db.exec(
        "SELECT * FROM order_items WHERE order_id = ?",
        [id]
      );

      if (itemsResult.length > 0) {
        const itemColumns = itemsResult[0].columns;
        const itemValues = itemsResult[0].values;

        order.items = itemValues.map((row) => {
          const obj = {};
          itemColumns.forEach((col, i) => {
            obj[col] = row[i];
          });
          return obj;
        });
      } else {
        order.items = [];
      }

      return order;
    }

    stmt.free();
    return null;
  }

  updateOrderStatus(id, status) {
    this.db.run("UPDATE orders SET status = ? WHERE id = ?", [status, id]);
    this.save();
  }

  deleteOrder(id) {
    this.db.run("DELETE FROM order_items WHERE order_id = ?", [id]);
    this.db.run("DELETE FROM orders WHERE id = ?", [id]);
    this.save();
  }

  // Verification code methods
  createVerificationCode(email, code, expiresAt) {
    // Delete old codes for this email
    this.db.run("DELETE FROM verification_codes WHERE email = ?", [email]);

    this.db.run(
      "INSERT INTO verification_codes (email, code, expires_at) VALUES (?, ?, ?)",
      [email, code, expiresAt]
    );
    this.save();
  }

  getVerificationCode(email, code) {
    const stmt = this.db.prepare(
      "SELECT * FROM verification_codes WHERE email = ? AND code = ? ORDER BY created_at DESC LIMIT 1"
    );
    stmt.bind([email, code]);
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return row;
    }
    stmt.free();
    return null;
  }

  deleteVerificationCode(email, code) {
    this.db.run("DELETE FROM verification_codes WHERE email = ? AND code = ?", [
      email,
      code,
    ]);
    this.save();
  }

  getOrdersByEmail(email) {
    const result = this.db.exec(
      "SELECT * FROM orders WHERE customer_email = ? ORDER BY created_at DESC",
      [email]
    );

    if (result.length === 0) return [];

    const columns = result[0].columns;
    const values = result[0].values;

    return values.map((row) => {
      const obj = {};
      columns.forEach((col, i) => {
        obj[col] = row[i];
      });

      // Load items for each order
      const itemsResult = this.db.exec(
        "SELECT * FROM order_items WHERE order_id = ?",
        [obj.id]
      );

      if (itemsResult.length > 0) {
        const itemColumns = itemsResult[0].columns;
        const itemValues = itemsResult[0].values;

        obj.items = itemValues.map((row) => {
          const itemObj = {};
          itemColumns.forEach((col, i) => {
            itemObj[col] = row[i];
          });
          return itemObj;
        });
      } else {
        obj.items = [];
      }

      return obj;
    });
  }
}

module.exports = Database;
