require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");

const app = express();
const PORT = process.env.PORT || 3001;
const SECRET_KEY = "your-secret-key-change-in-production";

// Email configuration (optional - set these in production)
const EMAIL_USER = process.env.EMAIL_USER || "your-email@gmail.com";
const EMAIL_PASS = process.env.EMAIL_PASS || "your-app-password";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@example.com";
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

// Create email transporter (will work if credentials are set)
let emailTransporter = null;
try {
  emailTransporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS,
    },
  });
} catch (error) {
  console.log(
    "Email not configured. Set EMAIL_USER and EMAIL_PASS environment variables."
  );
}

// Database helper functions
const db = require("./database");

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));
app.use(express.static(path.join(__dirname, "../public")));

// File upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    
    // Створити директорію якщо не існує
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);  // ← ПРАВИЛЬНО!
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});
const upload = multer({ storage: storage });

// Auth middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Access denied" });
  }

  try {
    const verified = jwt.verify(token, SECRET_KEY);
    req.user = verified;
    next();
  } catch (err) {
    res.status(403).json({ error: "Invalid token" });
  }
};

// AUTH ENDPOINTS
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;

  // Перевірка через environment variables
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    const token = jwt.sign({ id: 1, username: ADMIN_USERNAME }, SECRET_KEY);
    return res.json({ token });
  }

  return res.status(400).json({ error: "Invalid credentials" });
});

// CATEGORY ENDPOINTS
app.get("/api/categories", async (req, res) => {
  try {
   	const categories = await db.getAllCategories();
	console.log('Categories from DB:', categories); // ← ДОДАЙ ЦЕЙ РЯДОК
	res.json(categories || []);
  } catch (error) {
	console.error('Error in /api/categories:', error); // ← І ЦЕЙ
	res.status(500).json({ error: error.message });
  }
});

app.post("/api/categories", authenticateToken, async (req, res) => {
  try {
    const { name } = req.body;
    const id = await db.createCategory(name);
    res.json({ id, name });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/categories/:id", authenticateToken, async (req, res) => {
  try {
    await db.deleteCategory(req.params.id);
    res.json({ message: "Category deleted" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/categories/:id", authenticateToken, async (req, res) => {
  try {
    const { name } = req.body;
    await db.updateCategory(req.params.id, name);
    res.json({ success: true });
  } catch (error) {
    console.error("Error updating category:", error);
    res.status(500).json({ error: error.message });
  }
});

// PRODUCT ENDPOINTS
app.get("/api/products", async (req, res) => {
  try {
    const products = await db.getAllProducts();  // ← ДОДАЙ await
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/products/category/:categoryId", async (req, res) => {  // ← ДОДАЙ async
  try {
    const products = await db.getProductsByCategory(req.params.categoryId);  // ← ДОДАЙ await
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post(
  "/api/products",
  authenticateToken,
  upload.array("images", 5),
  async (req, res) => {  // ← ДОДАЙ async
    try {
      const {
        name,
        description,
        price,
        categoryId,
        isSale,
        wholesaleTier2,
        wholesaleTier3,
      } = req.body;

      const images = req.files ? req.files.map((f) => `/uploads/${f.filename}`) : [];
      const imagePath = images.length > 0 ? images[0] : null;

      const id = await db.createProduct(  // ← ДОДАЙ await
        name,
        description,
        price,
        imagePath,
        categoryId,
        isSale,  // ← ВИПРАВЛЕНО порядок параметрів
        wholesaleTier2,
        wholesaleTier3
      );

      // Зберегти масив зображень окремо
      if (images.length > 0) {
        await db.updateProductImages(id, images);  // ← ДОДАЙ await
      }

      res.json({
        id,
        name,
        description,
        price,
        categoryId,
        imagePath,
        isSale,
        images,
      });
    } catch (error) {
      console.error('Error creating product:', error);  // ← ДОДАЙ лог
      res.status(500).json({ error: error.message });
    }
  }
);

app.delete("/api/products/:id", authenticateToken, async (req, res) => {  // ← ДОДАЙ async
  try {
    const product = await db.getProductById(req.params.id);  // ← ДОДАЙ await

    if (product && product.images) {
      try {
        const images = typeof product.images === "string" ? JSON.parse(product.images) : product.images;
        images.forEach((img) => {
          const filePath = path.join(__dirname, "..", img);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        });
      } catch (e) {
        console.log("Error deleting images:", e.message);
      }
    }

    if (product && product.image_path) {
      const filePath = path.join(__dirname, "..", product.image_path);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await db.deleteProduct(req.params.id);  // ← ДОДАЙ await
    res.json({ message: "Product deleted" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put(
  "/api/products/:id",
  authenticateToken,
  upload.array("images", 5),
  async (req, res) => {
    try {
      const {
        name,
        description,
        price,
        categoryId,
        isSale,
        wholesaleTier2,
        wholesaleTier3,
      } = req.body;

      await db.updateProduct(
      req.params.id,
      name,
      description,
      parseFloat(price),
      categoryId,
      isSale === '1' || isSale === 1 || isSale === true,
      wholesaleTier2 ? parseFloat(wholesaleTier2) : null,
      wholesaleTier3 ? parseFloat(wholesaleTier3) : null
    );

      // Оновити зображення якщо є нові
      if (req.files && req.files.length > 0) {
        const images = req.files.map((file) => `/uploads/${file.filename}`);
        await db.updateProductImages(req.params.id, images);  // ← ДОДАЙ await
      }

      res.json({ message: "Product updated" });
    } catch (error) {
      console.error('Error updating product:', error);  // ← ДОДАЙ лог
      res.status(500).json({ error: error.message });
    }
  }
);

// ORDER ENDPOINTS
app.post("/api/orders", async (req, res) => {
  try {
    const {
      customerName,
      customerPhone,
      customerEmail,
      deliveryAddress,
      items,
    } = req.body;
    const orderId = await db.createOrder(
      customerName,
      customerPhone,
      customerEmail,
      deliveryAddress,
      req.body.comment || "",
      items
    );

    // Send email notification if configured
    if (emailTransporter && ADMIN_EMAIL !== "admin@example.com") {
      const totalAmount = items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      );
      const itemsList = items
        .map(
          (item) =>
            `${item.name} x${item.quantity} - ${item.price * item.quantity} $`
        )
        .join("\n");

      const mailOptions = {
        from: EMAIL_USER,
        to: ADMIN_EMAIL,
        subject: `🛒 Нове замовлення #${orderId} - Apple Store`,
        text: `
Нове замовлення від клієнта!

Замовлення #${orderId}
Дата: ${new Date().toLocaleString("uk-UA")}

Клієнт:
- Ім'я: ${customerName}
- Телефон: ${customerPhone}
- Email: ${customerEmail || "Не вказано"}

Товари:
${itemsList}

Загальна сума: ${totalAmount.toFixed(2)} $

Перейти в адмін-панель: http://localhost:3001
        `,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #0071e3;">🛒 Нове замовлення #${orderId}</h2>
            <p><strong>Дата:</strong> ${new Date().toLocaleString("uk-UA")}</p>
            
            <div style="background: #f5f5f7; padding: 20px; border-radius: 10px; margin: 20px 0;">
              <h3 style="margin-top: 0;">Інформація про клієнта</h3>
              <p><strong>Ім'я:</strong> ${customerName}</p>
              <p><strong>Телефон:</strong> ${customerPhone}</p>
              <p><strong>Email:</strong> ${customerEmail || "Не вказано"}</p>
            </div>
            
            <h3>Товари:</h3>
            <ul>
              ${items
                .map(
                  (item) =>
                    `<li>${item.name} x${item.quantity} - ${(
                      item.price * item.quantity
                    ).toFixed(2)} $</li>`
                )
                .join("")}
            </ul>
            
            <div style="background: #0071e3; color: white; padding: 15px; border-radius: 10px; margin: 20px 0;">
              <h3 style="margin: 0;">Загальна сума: ${totalAmount.toFixed(
                2
              )} $</h3>
            </div>
            
            <p><a href="http://localhost:3001" style="color: #0071e3;">Перейти в адмін-панель</a></p>
          </div>
        `,
      };

      emailTransporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.log("Email error:", error);
        } else {
          console.log("Email sent:", info.response);
        }
      });
    }

    res.json({ orderId, message: "Order created successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/orders", authenticateToken, async (req, res) => {
  try {
    const orders = await db.getAllOrders();
    console.log('Orders from DB:', orders);
    res.json(orders || []);
  } catch (error) {
    console.error('Error loading orders:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/orders/:id", authenticateToken, (req, res) => {
  try {
    const order = db.getOrderById(req.params.id);
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch("/api/orders/:id/status", authenticateToken, (req, res) => {
  try {
    const { status } = req.body;
    db.updateOrderStatus(req.params.id, status);
    res.json({ message: "Order status updated" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/orders/:id", authenticateToken, (req, res) => {
  try {
    db.deleteOrder(req.params.id);
    res.json({ message: "Order deleted" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// VERIFICATION CODE ENDPOINTS
app.post("/api/request-code", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Save to database (метод saveVerificationCode вже додає expiresAt)
    await db.saveVerificationCode(email, code);  // ← ВИПРАВЛЕНО!

    // Show code in console (since email not configured)
    console.log("=================================");
    console.log("Verification code for", email);
    console.log("CODE:", code);
    console.log("=================================");

    // Send email if configured
    if (emailTransporter && EMAIL_USER !== "your-email@gmail.com") {
      const mailOptions = {
        from: EMAIL_USER,
        to: email,
        subject: "Код підтвердження для VERBA Store",
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #1d1d1f;">Код підтвердження</h2>
            <p>Ваш код для перегляду замовлень:</p>
            <div style="background: #f5f5f7; padding: 20px; border-radius: 10px; text-align: center; margin: 20px 0;">
              <h1 style="color: #0071e3; font-size: 48px; margin: 0; letter-spacing: 8px;">${code}</h1>
            </div>
            <p style="color: #666;">Код дійсний протягом <strong>10 хвилин</strong>.</p>
            <p style="color: #666; font-size: 12px; margin-top: 30px;">Якщо ви не запитували цей код, проігноруйте цей лист.</p>
          </div>
        `,
      };

      emailTransporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.log("Email error:", error);
        } else {
          console.log("Verification code sent:", info.response);
        }
      });
    }

    res.json({ message: "Verification code sent to email" });
  } catch (error) {
    console.error('Error in /api/request-code:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/verify-code", async (req, res) => {  // ← ДОДАЙ async!
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ error: "Email and code are required" });
    }

    // Get verification code from database
    const record = await db.getVerificationCode(email);  // ← ДОДАЙ await, видали code параметр!

    if (!record) {
      return res.status(400).json({ error: "Невірний код" });
    }

    // Check if code matches
    if (record.code !== code) {
      return res.status(400).json({ error: "Невірний код" });
    }

    // Check if expired
    if (new Date() > new Date(record.expires_at)) {
      return res.status(400).json({ error: "Код застарів. Запитайте новий." });
    }

    // Delete used code
    await db.deleteVerificationCode(email);  // ← ДОДАЙ await, видали code параметр!

    // Generate JWT token valid for 24 hours
    const token = jwt.sign({ email, type: "customer" }, SECRET_KEY, {
      expiresIn: "24h",
    });

    res.json({ token, email });
  } catch (error) {
    console.error('Error in /api/verify-code:', error);
    res.status(500).json({ error: error.message });
  }
});

// Middleware for customer authentication
const authenticateCustomer = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  console.log('=== CUSTOMER AUTH ===');
  console.log('Token:', token);
  console.log('Auth header:', authHeader);

  if (!token) {
    return res.status(401).json({ error: "Access denied" });
  }

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) {
      console.log('JWT error:', err.message);
      return res.status(403).json({ error: "Invalid token" });
    }
    if (user.type !== "customer") {
      return res.status(403).json({ error: "Not a customer token" });
    }
    console.log('User verified:', user);
    req.user = user;
    next();
  });
};

app.get("/api/my-orders", authenticateCustomer, async (req, res) => {
  try {
    const { email } = req.user;
    const orders = await db.getOrdersByEmail(email);
    console.log('Orders for customer:', email, orders);
    res.json(orders || []);
  } catch (error) {
    console.error('Error loading customer orders:', error);
    res.status(500).json({ error: error.message });
  }
});

// Відправка статичних файлів
app.use(express.static(path.join(__dirname, "../public")));
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// ← ДОДАЙ ЦЕ ПЕРЕД app.listen():
// Fallback для всіх невідомих роутів - віддати index.html (для SPA)
app.use((req, res, next) => {
  // Якщо це не API запит - віддати index.html
  if (!req.path.startsWith("/api") && !req.path.startsWith("/uploads")) {
    res.sendFile(path.join(__dirname, "../public/index.html"));
  } else {
    next();
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
