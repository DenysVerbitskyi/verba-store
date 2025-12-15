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
const PORT = 3001;
const SECRET_KEY = "your-secret-key-change-in-production";

// Email configuration (optional - set these in production)
const EMAIL_USER = process.env.EMAIL_USER || "your-email@gmail.com";
const EMAIL_PASS = process.env.EMAIL_PASS || "your-app-password";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@example.com";

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
const Database = require("./database");
const db = new Database();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));
app.use(express.static(path.join(__dirname, "../public")));

// File upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
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

  const user = db.getUserByUsername(username);

  if (!user) {
    return res.status(400).json({ error: "User not found" });
  }

  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) {
    return res.status(400).json({ error: "Invalid password" });
  }

  const token = jwt.sign({ id: user.id, username: user.username }, SECRET_KEY);
  res.json({ token });
});

app.post("/api/register", async (req, res) => {
  const { username, password } = req.body;

  const existingUser = db.getUserByUsername(username);
  if (existingUser) {
    return res.status(400).json({ error: "User already exists" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const userId = db.createUser(username, hashedPassword);

  res.json({ message: "User created successfully", userId });
});

// CATEGORY ENDPOINTS
app.get("/api/categories", (req, res) => {
  try {
    const categories = db.getAllCategories();
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/categories", authenticateToken, (req, res) => {
  try {
    const { name } = req.body;
    const id = db.createCategory(name);
    res.json({ id, name });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/categories/:id", authenticateToken, (req, res) => {
  try {
    db.deleteCategory(req.params.id);
    res.json({ message: "Category deleted" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PRODUCT ENDPOINTS
app.get("/api/products", (req, res) => {
  try {
    const products = db.getAllProducts();
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/products/category/:categoryId", (req, res) => {
  try {
    const products = db.getProductsByCategory(req.params.categoryId);
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post(
  "/api/products",
  authenticateToken,
  upload.array("images", 5),
  (req, res) => {
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

      // Array of uploaded image paths
      const images = req.files
        ? req.files.map((f) => `/uploads/${f.filename}`)
        : [];
      const imagePath = images.length > 0 ? images[0] : null; // First image as main

      const id = db.createProduct(
        name,
        description,
        price,
        imagePath,
        categoryId,
        imagesJson,
        isSale,
        wholesaleTier2,
        wholesaleTier3
      );
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
      res.status(500).json({ error: error.message });
    }
  }
);

app.delete("/api/products/:id", authenticateToken, (req, res) => {
  try {
    const product = db.getProductById(req.params.id);

    // Delete all images from the images array
    if (product && product.images) {
      try {
        const images =
          typeof product.images === "string"
            ? JSON.parse(product.images)
            : product.images;
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

    // Also delete old image_path if exists (for backward compatibility)
    if (product && product.image_path) {
      const filePath = path.join(__dirname, "..", product.image_path);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    db.deleteProduct(req.params.id);
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

      let imagePath = undefined;
      let imagesToSave = undefined;

      if (req.files && req.files.length > 0) {
        const imageUrls = req.files.map((file) => `/uploads/${file.filename}`);
        imagePath = imageUrls[0];
        imagesToSave = imageUrls; // Це масив!
      }

      db.updateProduct(
        req.params.id,
        name,
        description,
        parseFloat(price),
        imagePath,
        categoryId,
        imagesToSave,
        isSale,
        wholesaleTier2 ? parseFloat(wholesaleTier2) : null,
        wholesaleTier3 ? parseFloat(wholesaleTier3) : null
      );

      res.json({ message: "Product updated" });
    } catch (error) {
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
    const orderId = db.createOrder(
      customerName,
      customerPhone,
      customerEmail,
      deliveryAddress,
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
            `${item.name} x${item.quantity} - ${item.price * item.quantity} грн`
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

Загальна сума: ${totalAmount.toFixed(2)} грн

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
                    ).toFixed(2)} грн</li>`
                )
                .join("")}
            </ul>
            
            <div style="background: #0071e3; color: white; padding: 15px; border-radius: 10px; margin: 20px 0;">
              <h3 style="margin: 0;">Загальна сума: ${totalAmount.toFixed(
                2
              )} грн</h3>
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

app.get("/api/orders", authenticateToken, (req, res) => {
  try {
    const orders = db.getAllOrders();
    res.json(orders);
  } catch (error) {
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

    // Expires in 10 minutes
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // Save to database
    db.createVerificationCode(email, code, expiresAt);

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
        subject: "Код підтвердження для Apple Store",
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
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/verify-code", (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ error: "Email and code are required" });
    }

    // Get verification code from database
    const record = db.getVerificationCode(email, code);

    if (!record) {
      return res.status(400).json({ error: "Невірний код" });
    }

    // Check if expired
    if (new Date() > new Date(record.expires_at)) {
      return res.status(400).json({ error: "Код застарів. Запитайте новий." });
    }

    // Delete used code
    db.deleteVerificationCode(email, code);

    // Generate JWT token valid for 24 hours
    const token = jwt.sign({ email, type: "customer" }, SECRET_KEY, {
      expiresIn: "24h",
    });

    res.json({ token, email });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Middleware for customer authentication
const authenticateCustomer = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Access denied" });
  }

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Invalid token" });
    }
    if (user.type !== "customer") {
      return res.status(403).json({ error: "Not a customer token" });
    }
    req.user = user;
    next();
  });
};

app.get("/api/my-orders", authenticateCustomer, (req, res) => {
  try {
    const { email } = req.user;
    const orders = db.getOrdersByEmail(email);
    res.json(orders);
  } catch (error) {
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
  console.log(`Server running on http://localhost:${PORT}`);
});
