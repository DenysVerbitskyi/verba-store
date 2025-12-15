const { useState, useEffect } = React;

const API_URL = `${window.location.origin}/api`;

function App() {
  const [view, setView] = useState("shop");
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [cart, setCart] = useState(() => {
    const savedCart = localStorage.getItem("cart");
    return savedCart ? JSON.parse(savedCart) : [];
  });
  const [showCart, setShowCart] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "light");
  const [scrolled, setScrolled] = useState(false);
  const [lightboxData, setLightboxData] = useState(null);
  const [logoClickCount, setLogoClickCount] = useState(0);
  const [logoClickTimer, setLogoClickTimer] = useState(null);
  const [customerToken, setCustomerToken] = useState(
    localStorage.getItem("customerToken")
  );
  const [customerEmail, setCustomerEmail] = useState(
    localStorage.getItem("customerEmail")
  );
  const [infoModal, setInfoModal] = useState(null);
  // Обробник секретних кліків на logo
  const handleLogoClick = () => {
    const newCount = logoClickCount + 1;
    setLogoClickCount(newCount);

    // Завжди переходити на головну при кліку
    goToShop();

    // Скинути таймер
    if (logoClickTimer) {
      clearTimeout(logoClickTimer);
    }

    // Якщо 5 кліків - відкрити логін
    if (newCount >= 5) {
      setView("login");
      setLogoClickCount(0);
      setLogoClickTimer(null);
      return;
    }

    // Скинути лічильник через 1.5 секунди
    const timer = setTimeout(() => {
      setLogoClickCount(0);
    }, 1500);
    setLogoClickTimer(timer);
  };
  useEffect(() => {
    loadCategories();
    loadProducts();
    document.documentElement.setAttribute("data-theme", theme);
    if (window.location.pathname === "/admin" && !token) {
      setView("login");
      window.history.replaceState({}, "", "/");
    }
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("cart", JSON.stringify(cart));
  }, [cart]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  const loadCategories = async () => {
    try {
      const response = await fetch(`${API_URL}/categories`);
      const data = await response.json();
      setCategories(data);
    } catch (error) {
      console.error("Error loading categories:", error);
    }
  };

  const loadProducts = async () => {
    try {
      const response = await fetch(`${API_URL}/products`);
      const data = await response.json();
      setProducts(data);
    } catch (error) {
      console.error("Error loading products:", error);
    }
  };

  const addToCart = (product, quantity) => {
    const existingItem = cart.find((item) => item.id === product.id);
    if (existingItem) {
      setCart(
        cart.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        )
      );
    } else {
      setCart([...cart, { ...product, quantity }]);
    }
  };

  const removeFromCart = (productId) => {
    setCart(cart.filter((item) => item.id !== productId));
  };

  const getTotalPrice = () => {
    return cart.reduce((sum, item) => {
      let price = item.price; // Базова ціна

      // Застосувати оптову ціну якщо є
      if (item.quantity >= 11 && item.wholesale_price_tier3) {
        price = item.wholesale_price_tier3;
      } else if (item.quantity >= 4 && item.wholesale_price_tier2) {
        price = item.wholesale_price_tier2;
      }

      return sum + price * item.quantity;
    }, 0);
  };
  const getSavings = () => {
    const regularTotal = cart.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    const discountedTotal = getTotalPrice();
    return regularTotal - discountedTotal;
  };
  const goToShop = () => {
    setView("shop");
    setSelectedCategory(null);
  };

  const openLightbox = (images, initialIndex, productName) => {
    setLightboxData({ images, initialIndex, productName });
  };

  const closeLightbox = () => {
    setLightboxData(null);
  };

  const customerLogout = () => {
    setCustomerToken(null);
    setCustomerEmail(null);
    localStorage.removeItem("customerToken");
    localStorage.removeItem("customerEmail");
    setView("shop");
  };

  const filteredProducts = selectedCategory
    ? products.filter((p) => p.category_id === selectedCategory)
    : products;

  return (
    <div className="app">
      <div className={`header ${scrolled ? "scrolled" : ""}`}>
        <div className="header-content">
          <div
            className="logo"
            onClick={handleLogoClick}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              cursor: "pointer",
            }}
          >
            <img
              src={
                theme === "dark" ? "verba-logo.png" : "verba-logo-header.png"
              }
              alt="VERBA"
              style={{
                height: "50px",
                width: "auto",
                borderRadius: "8px",
                transition: "all 0.3s ease",
              }}
            />
            <span
              style={{
                fontSize: "24px",
                fontWeight: "700",
                letterSpacing: "-0.5px",
                color: theme === "dark" ? "white" : "#2c3654",
                transition: "color 0.3s ease",
              }}
            >
              VERBA
            </span>
          </div>
          <div className="nav">
            <button
              className="theme-toggle"
              onClick={toggleTheme}
              title="Змінити тему"
            ></button>

            {customerToken ? (
              <button
                className="btn btn-secondary"
                onClick={() => setView("my-orders")}
              >
                Замовлення
              </button>
            ) : (
              <button
                className="btn btn-secondary"
                onClick={() => setView("my-orders")}
              >
                Мої замовлення
              </button>
            )}

            {token && (
              <>
                <button
                  className="btn btn-secondary"
                  onClick={() => setView("admin")}
                >
                  Адмін
                </button>
                <button
                  className="btn btn-danger"
                  onClick={() => {
                    setToken(null);
                    localStorage.removeItem("token");
                    setView("shop");
                  }}
                >
                  Вийти
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {view === "shop" && (
        <>
          <HeroSection />
          <ShopView
            categories={categories}
            products={filteredProducts}
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            addToCart={addToCart}
            openLightbox={openLightbox}
          />
        </>
      )}

      {view === "login" && <LoginView setToken={setToken} setView={setView} />}

      {view === "admin" && token && (
        <AdminPanel
          token={token}
          categories={categories}
          products={products}
          loadCategories={loadCategories}
          loadProducts={loadProducts}
        />
      )}

      {view === "my-orders" && (
        <MyOrdersView
          customerToken={customerToken}
          customerEmail={customerEmail}
          setCustomerToken={setCustomerToken}
          setCustomerEmail={setCustomerEmail}
          customerLogout={customerLogout}
          addToCart={addToCart}
        />
      )}

      {cart.length > 0 && view === "shop" && (
        <>
          <div className="cart-badge" onClick={() => setShowCart(!showCart)}>
            {cart.length}
          </div>

          {showCart && (
            <div className="cart">
              <h3>Кошик</h3>
              {cart.map((item) => (
                <div key={item.id} className="cart-item">
                  <div>
                    <div>{item.name}</div>
                    <div>
                      {item.price} грн × {item.quantity}
                    </div>
                  </div>
                  <div>
                    <button
                      className="btn btn-danger"
                      onClick={() => removeFromCart(item.id)}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
              <div className="cart-total">
                Всього: {getTotalPrice().toFixed(2)} грн
              </div>
              <button
                className="btn btn-success"
                onClick={() => {
                  setShowCheckout(true);
                  setShowCart(false);
                }}
                style={{ width: "100%", marginTop: "10px" }}
              >
                Оформити замовлення
              </button>
            </div>
          )}
        </>
      )}

      {showCheckout && (
        <CheckoutModal
          cart={cart}
          totalPrice={getTotalPrice()}
          getTotalPrice={getTotalPrice}
          getSavings={getSavings}
          onClose={() => setShowCheckout(false)}
          onSuccess={() => {
            setCart([]);
            setShowCheckout(false);
            alert("Замовлення успішно оформлено!");
          }}
          customerEmail={customerEmail}
        />
      )}

      {lightboxData && (
        <Lightbox
          images={lightboxData.images}
          initialIndex={lightboxData.initialIndex}
          onClose={closeLightbox}
          productName={lightboxData.productName}
        />
      )}
      {lightboxData && (
        <Lightbox
          images={lightboxData.images}
          initialIndex={lightboxData.initialIndex}
          onClose={closeLightbox}
          productName={lightboxData.productName}
        />
      )}

      {view === "shop" && <Footer onOpenInfo={setInfoModal} />}
      {infoModal && (
        <InfoModal type={infoModal} onClose={() => setInfoModal(null)} />
      )}
    </div>
  );
}

function HeroSection() {
  return (
    <div
      className="hero"
      style={{
        background: "linear-gradient(135deg, #2c3654 0%, #3d4a6b 100%)",
        minHeight: "550px",
        height: "auto",
        display: "flex",
        alignItems: "center",
        padding: "60px 20px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div className="hero-bg"></div>
      <div
        style={{
          maxWidth: "800px",
          margin: "0 auto",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "40px",
          textAlign: "center",
        }}
      >
        {/* Зверху - Логотип */}
        <div>
          <img
            src="verba-logo.png"
            alt="VERBA"
            style={{
              maxWidth: "350px",
              height: "auto",
              width: "50%",
              marginTop: "-20px",
            }}
          />
        </div>

        {/* Знизу - Текст + Кнопка */}
        <div>
          <h1
            className="hero-title"
            style={{
              color: "White",
              fontSize: "48px",
              marginTop: "-20px",
              lineHeight: "1",
            }}
          >
            Брендові аксесуари для ваших гаджетів
          </h1>
          <p
            className="hero-subtitle"
            style={{
              color: "White",
              fontSize: "24px",
              marginBottom: "30px",
              opacity: 0.9,
            }}
          >
            Стиль який ти обираєш
          </p>
          <button
            className="btn btn-primary"
            style={{
              fontSize: "18px",
              padding: "16px 40px",
              background: "white",
              color: "#2c3654",
              fontWeight: "700",
              boxShadow: "0 4px 20px rgba(255,255,255,0.3)",
              transition: "all 0.3s ease",
            }}
            onClick={() => {
              document
                .querySelector(".container")
                .scrollIntoView({ behavior: "smooth" });
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = "translateY(-2px) scale(1.05)";
              e.target.style.boxShadow = "0 8px 30px rgba(255,255,255,0.4)";
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = "translateY(0) scale(1)";
              e.target.style.boxShadow = "0 4px 20px rgba(255,255,255,0.3)";
            }}
          >
            Переглянути каталог
          </button>
        </div>
      </div>
    </div>
  );
}

function ShopView({
  categories,
  products,
  selectedCategory,
  setSelectedCategory,
  addToCart,
  openLightbox,
}) {
  const [displayCount, setDisplayCount] = useState(20);
  const ITEMS_PER_PAGE = 20;

  const visibleProducts = products.slice(0, displayCount);
  const hasMore = displayCount < products.length;

  const loadMore = () => {
    setDisplayCount((prev) => prev + ITEMS_PER_PAGE);
  };

  useEffect(() => {
    setDisplayCount(20);
  }, [selectedCategory]);

  return (
    <div className="container">
      <div className="categories">
        <button
          className={`category-btn ${!selectedCategory ? "active" : ""}`}
          onClick={() => setSelectedCategory(null)}
        >
          Всі
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            className={`category-btn ${
              selectedCategory === cat.id ? "active" : ""
            }`}
            onClick={() => setSelectedCategory(cat.id)}
          >
            {cat.name}
          </button>
        ))}
      </div>

      <div className="products">
        {visibleProducts.length === 0 ? (
          <div className="empty-state">
            <h3>Товарів поки немає</h3>
            <p>Адміністратор скоро додасть товари</p>
          </div>
        ) : (
          visibleProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              addToCart={addToCart}
              openLightbox={openLightbox}
            />
          ))
        )}
      </div>

      {hasMore && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginTop: "40px",
            marginBottom: "40px",
          }}
        >
          <button
            className="btn btn-primary"
            onClick={loadMore}
            style={{
              padding: "16px 48px",
              fontSize: "16px",
              minWidth: "200px",
            }}
          >
            Завантажити ще ({products.length - displayCount})
          </button>
        </div>
      )}
    </div>
  );
}

function ImageSlider({ images, productName, onImageClick }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!images || images.length === 0) return null;

  const getImageUrl = (imagePath) => {
    if (!imagePath) return null;
    if (imagePath.startsWith("http")) return imagePath;
    return `${window.location.origin}${imagePath}`;
  };

  const goToPrevious = (e) => {
    e.stopPropagation();
    setCurrentIndex((prevIndex) =>
      prevIndex === 0 ? images.length - 1 : prevIndex - 1
    );
  };

  const goToNext = (e) => {
    e.stopPropagation();
    setCurrentIndex((prevIndex) =>
      prevIndex === images.length - 1 ? 0 : prevIndex + 1
    );
  };

  const goToSlide = (index, e) => {
    e.stopPropagation();
    setCurrentIndex(index);
  };

  return (
    <div className="product-image-slider">
      <img
        src={getImageUrl(images[currentIndex])}
        alt={`${productName} - фото ${currentIndex + 1}`}
        onClick={() => onImageClick && onImageClick(currentIndex)}
      />

      {images.length > 1 && (
        <>
          <button className="slider-nav prev" onClick={goToPrevious}>
            ‹
          </button>
          <button className="slider-nav next" onClick={goToNext}>
            ›
          </button>

          <div className="slider-dots">
            {images.map((_, index) => (
              <button
                key={index}
                className={`slider-dot ${
                  index === currentIndex ? "active" : ""
                }`}
                onClick={(e) => goToSlide(index, e)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Lightbox({ images, initialIndex = 0, onClose, productName }) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") goToPrevious();
      if (e.key === "ArrowRight") goToNext();
    };

    window.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [currentIndex]);

  const getImageUrl = (imagePath) => {
    if (!imagePath) return null;
    if (imagePath.startsWith("http")) return imagePath;
    return `${window.location.origin}${imagePath}`;
  };

  const goToPrevious = () => {
    setCurrentIndex((prevIndex) =>
      prevIndex === 0 ? images.length - 1 : prevIndex - 1
    );
  };

  const goToNext = () => {
    setCurrentIndex((prevIndex) =>
      prevIndex === images.length - 1 ? 0 : prevIndex + 1
    );
  };

  return (
    <div className="lightbox" onClick={onClose}>
      <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
        <button className="lightbox-close" onClick={onClose}>
          ×
        </button>

        <img
          src={getImageUrl(images[currentIndex])}
          alt={`${productName} - фото ${currentIndex + 1}`}
          className="lightbox-image"
        />

        {images.length > 1 && (
          <>
            <button className="lightbox-nav prev" onClick={goToPrevious}>
              ‹
            </button>
            <button className="lightbox-nav next" onClick={goToNext}>
              ›
            </button>

            <div className="lightbox-counter">
              {currentIndex + 1} / {images.length}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ProductCard({
  product,
  addToCart,
  openLightbox,
  openDescriptionModal,
}) {
  const [quantity, setQuantity] = useState(1);

  const images =
    product.images && product.images.length > 0
      ? product.images
      : product.image_path
      ? [product.image_path]
      : [];

  const handleImageClick = (index) => {
    openLightbox(images, index, product.name);
  };

  return (
    <div className="product-card">
      {product.is_sale === 1 && <div className="sale-badge">АКЦІЯ 🔥</div>}

      {images.length > 0 && (
        <ImageSlider
          images={images}
          productName={product.name}
          onImageClick={handleImageClick}
        />
      )}

      <div className="product-name">{product.name}</div>

      <div>
        <div className="product-description">{product.description}</div>

        {product.description && product.description.length > 120 && (
          <button
            onClick={() =>
              openDescriptionModal(product.name, product.description)
            }
            style={{
              background: "none",
              border: "none",
              color: "#0071e3",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: "500",
              padding: "0",
              marginBottom: "10px",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => (e.target.style.color = "#0077ED")}
            onMouseLeave={(e) => (e.target.style.color = "#0071e3")}
          >
            📖 Детальніше
          </button>
        )}
      </div>

      <div className="product-price">{product.price} грн</div>

      {(product.wholesale_price_tier2 || product.wholesale_price_tier3) && (
        <div
          style={{
            background: "linear-gradient(135deg, #f0f8ff 0%, #e6f3ff 100%)",
            padding: "12px",
            borderRadius: "8px",
            marginBottom: "12px",
            border: "1px solid #d0e8ff",
          }}
        >
          <div
            style={{
              fontSize: "12px",
              fontWeight: "600",
              color: "#0071e3",
              marginBottom: "6px",
            }}
          >
            💰 Оптові ціни:
          </div>

          {product.wholesale_price_tier2 && (
            <div
              style={{
                fontSize: "13px",
                color: "#333",
                marginBottom: "4px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>4-10 шт:</span>
              <span style={{ fontWeight: "600" }}>
                {product.wholesale_price_tier2} грн
                <span
                  style={{
                    color: "#28a745",
                    fontSize: "11px",
                    marginLeft: "4px",
                  }}
                >
                  (-
                  {Math.round(
                    (1 - product.wholesale_price_tier2 / product.price) * 100
                  )}
                  %)
                </span>
              </span>
            </div>
          )}

          {product.wholesale_price_tier3 && (
            <div
              style={{
                fontSize: "13px",
                color: "#333",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>11+ шт:</span>
              <span style={{ fontWeight: "600" }}>
                {product.wholesale_price_tier3} грн
                <span
                  style={{
                    color: "#28a745",
                    fontSize: "11px",
                    marginLeft: "4px",
                  }}
                >
                  (-
                  {Math.round(
                    (1 - product.wholesale_price_tier3 / product.price) * 100
                  )}
                  %)
                </span>
              </span>
            </div>
          )}
        </div>
      )}

      <div className="quantity-control">
        <button onClick={() => setQuantity(Math.max(1, quantity - 1))}>
          -
        </button>
        <input
          type="number"
          value={quantity}
          onChange={(e) =>
            setQuantity(Math.max(1, parseInt(e.target.value) || 1))
          }
          min="1"
        />
        <button onClick={() => setQuantity(quantity + 1)}>+</button>
      </div>

      <button
        className="btn btn-success"
        style={{ width: "100%", marginTop: "10px" }}
        onClick={() => {
          addToCart(product, quantity);
          setQuantity(1);
        }}
      >
        Додати в кошик
      </button>
    </div>
  );
}

function CheckoutModal({
  cart,
  totalPrice,
  getTotalPrice,
  getSavings,
  onClose,
  onSuccess,
  customerEmail,
}) {
  const [formData, setFormData] = useState({
    customerName: "",
    customerPhone: "",
    customerEmail: customerEmail || "",
    deliveryAddress: "",
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (customerEmail) {
      loadLastOrder();
    } else {
      setLoading(false);
    }
  }, []);

  const loadLastOrder = async () => {
    const customerToken = localStorage.getItem("customerToken");
    if (!customerToken) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/my-orders`, {
        headers: {
          Authorization: `Bearer ${customerToken}`,
        },
      });

      if (response.ok) {
        const orders = await response.json();
        if (orders.length > 0) {
          const lastOrder = orders[0];
          setFormData({
            customerName: lastOrder.customer_name || "",
            customerPhone: lastOrder.customer_phone || "",
            customerEmail: lastOrder.customer_email || customerEmail,
            deliveryAddress: lastOrder.delivery_address || "",
          });
        }
      }
    } catch (error) {
      console.error("Error loading last order:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      // Обробити товари з оптовими цінами
      const itemsWithCorrectPrices = cart.map((item) => {
        let price = item.price; // Базова ціна

        // Застосувати оптову ціну якщо є
        if (item.quantity >= 11 && item.wholesale_price_tier3) {
          price = item.wholesale_price_tier3;
        } else if (item.quantity >= 4 && item.wholesale_price_tier2) {
          price = item.wholesale_price_tier2;
        }

        return {
          ...item,
          price: price, // Правильна ціна
        };
      });

      const response = await fetch(`${API_URL}/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          items: itemsWithCorrectPrices, // ← Використовуємо оброблені товари
        }),
      });

      if (response.ok) {
        onSuccess();
      } else {
        alert("Помилка при оформленні замовлення");
      }
    } catch (error) {
      console.error("Error creating order:", error);
      alert("Помилка при оформленні замовлення");
    }
  };

  if (loading) {
    return (
      <div className="modal" onClick={onClose}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <h2>Оформлення замовлення</h2>
          <p style={{ textAlign: "center", padding: "40px", color: "#666" }}>
            Завантаження даних...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Оформлення замовлення</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Назва компанії (або ПІБ)</label>
            <input
              type="text"
              value={formData.customerName}
              onChange={(e) =>
                setFormData({ ...formData, customerName: e.target.value })
              }
              placeholder="ТОВ Компанія або Іванов Іван"
              required
            />
          </div>
          <div className="form-group">
            <label>Телефон</label>
            <input
              type="tel"
              value={formData.customerPhone}
              onChange={(e) =>
                setFormData({ ...formData, customerPhone: e.target.value })
              }
              placeholder="+380671234567"
              pattern="[\+]?[0-9]{10,13}"
              title="Введіть номер у форматі +380671234567"
            />
          </div>
          <div className="form-group">
            <label>Email *</label>
            <input
              type="email"
              value={formData.customerEmail}
              onChange={(e) =>
                setFormData({ ...formData, customerEmail: e.target.value })
              }
              placeholder="company@example.com"
              required
              pattern="[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$"
              title="Введіть коректний email"
            />
          </div>
          <div className="form-group">
            <label>Адреса доставки</label>
            <input
              type="text"
              value={formData.deliveryAddress}
              onChange={(e) =>
                setFormData({ ...formData, deliveryAddress: e.target.value })
              }
              placeholder="Нова Пошта, відділення №5, м. Київ"
            />
          </div>
          <div
            style={{ fontSize: "18px", fontWeight: "600", marginTop: "15px" }}
          >
            {getSavings() > 0 ? (
              <>
                <div
                  style={{
                    textDecoration: "line-through",
                    color: "#999",
                    fontSize: "14px",
                  }}
                >
                  Без знижки:{" "}
                  {cart.reduce(
                    (sum, item) => sum + item.price * item.quantity,
                    0
                  )}{" "}
                  грн
                </div>
                <div style={{ color: "#0071e3" }}>
                  Загальна сума: {getTotalPrice()} грн
                </div>
                <div style={{ color: "#28a745", fontSize: "14px" }}>
                  💰 Економія: {getSavings()} грн
                </div>
              </>
            ) : (
              <div>Загальна сума: {getTotalPrice()} грн</div>
            )}
          </div>{" "}
          <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
            <button
              type="submit"
              className="btn btn-success"
              style={{ flex: 1 }}
            >
              Підтвердити
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
            >
              Скасувати
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function LoginView({ setToken, setView }) {
  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const response = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const data = await response.json();
        setToken(data.token);
        localStorage.setItem("token", data.token);
        setView("admin");
      } else {
        alert("Невірний логін або пароль");
      }
    } catch (error) {
      console.error("Login error:", error);
      alert("Помилка входу");
    }
  };

  return (
    <div className="admin-panel">
      <h2>Вхід в адмін-панель</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Логін</label>
          <input
            type="text"
            value={formData.username}
            onChange={(e) =>
              setFormData({ ...formData, username: e.target.value })
            }
            required
          />
        </div>
        <div className="form-group">
          <label>Пароль</label>
          <input
            type="password"
            value={formData.password}
            onChange={(e) =>
              setFormData({ ...formData, password: e.target.value })
            }
            required
          />
        </div>
        <button type="submit" className="btn btn-primary">
          Увійти
        </button>
      </form>
      <p style={{ marginTop: "20px", color: "#666" }}>
        Логін за замовчуванням: <strong>admin</strong>
        <br />
        Пароль за замовчуванням: <strong>admin123</strong>
      </p>
    </div>
  );
}

function AdminPanel({
  token,
  categories,
  products,
  loadCategories,
  loadProducts,
}) {
  const [activeTab, setActiveTab] = useState("categories");
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    if (activeTab === "orders") {
      loadOrders();
    }
  }, [activeTab]);

  const loadOrders = async () => {
    try {
      const response = await fetch(`${API_URL}/orders`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      setOrders(data);
    } catch (error) {
      console.error("Error loading orders:", error);
    }
  };

  return (
    <div className="admin-panel">
      <div className="admin-tabs">
        <button
          className={`admin-tab ${activeTab === "categories" ? "active" : ""}`}
          onClick={() => setActiveTab("categories")}
        >
          Категорії
        </button>
        <button
          className={`admin-tab ${activeTab === "products" ? "active" : ""}`}
          onClick={() => setActiveTab("products")}
        >
          Товари
        </button>
        <button
          className={`admin-tab ${activeTab === "orders" ? "active" : ""}`}
          onClick={() => setActiveTab("orders")}
        >
          Замовлення
        </button>
      </div>

      {activeTab === "categories" && (
        <CategoriesTab
          categories={categories}
          loadCategories={loadCategories}
          token={token}
        />
      )}

      {activeTab === "products" && (
        <ProductsTab
          products={products}
          categories={categories}
          loadProducts={loadProducts}
          token={token}
        />
      )}

      {activeTab === "orders" && (
        <OrdersTab orders={orders} loadOrders={loadOrders} token={token} />
      )}
    </div>
  );
}

function CategoriesTab({ categories, loadCategories, token }) {
  const [showAdd, setShowAdd] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  const addCategory = async (e) => {
    e.preventDefault();

    try {
      const response = await fetch(`${API_URL}/categories`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: newCategoryName }),
      });

      if (response.ok) {
        setNewCategoryName("");
        setShowAdd(false);
        loadCategories();
      }
    } catch (error) {
      console.error("Error adding category:", error);
    }
  };

  const deleteCategory = async (id) => {
    if (
      !confirm("Видалити категорію? Всі товари в ній також будуть видалені.")
    ) {
      return;
    }

    try {
      await fetch(`${API_URL}/categories/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      loadCategories();
    } catch (error) {
      console.error("Error deleting category:", error);
    }
  };

  return (
    <div>
      <button
        className="btn btn-primary"
        onClick={() => setShowAdd(!showAdd)}
        style={{ marginBottom: "20px" }}
      >
        {showAdd ? "Скасувати" : "Додати категорію"}
      </button>

      {showAdd && (
        <form onSubmit={addCategory} style={{ marginBottom: "20px" }}>
          <div className="form-group">
            <input
              type="text"
              placeholder="Назва категорії"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn btn-success">
            Зберегти
          </button>
        </form>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {categories.map((cat) => (
          <div
            key={cat.id}
            style={{
              padding: "15px",
              background: "#f8f9fa",
              borderRadius: "5px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>{cat.name}</span>
            <button
              className="btn btn-danger"
              onClick={() => deleteCategory(cat.id)}
            >
              Видалити
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProductsTab({ products, categories, loadProducts, token }) {
  const [showAdd, setShowAdd] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    categoryId: "",
    isSale: false,
    wholesaleTier2: "",
    wholesaleTier3: "",
  });
  const [imageFiles, setImageFiles] = useState([]);

  const filteredProducts = selectedCategory
    ? products.filter((p) => p.category_id === selectedCategory)
    : products;

  const startEdit = (product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description,
      price: product.price,
      categoryId: product.category_id,
      isSale: product.is_sale === 1,
      wholesaleTier2: product.wholesale_price_tier2 || "",
      wholesaleTier3: product.wholesale_price_tier3 || "",
    });
    setImageFiles([]);
    setShowAdd(false);

    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 100);
  };

  const cancelEdit = () => {
    setEditingProduct(null);
    setFormData({
      name: "",
      description: "",
      price: "",
      categoryId: "",
      isSale: false,
      wholesaleTier2: "",
      wholesaleTier3: "",
    });
    setImageFiles([]);
  };

  const saveProduct = async (e) => {
    e.preventDefault();

    const formDataToSend = new FormData();
    formDataToSend.append("name", formData.name);
    formDataToSend.append("description", formData.description);
    formDataToSend.append("price", formData.price);
    formDataToSend.append("categoryId", formData.categoryId);
    formDataToSend.append("isSale", formData.isSale ? 1 : 0);

    if (formData.wholesaleTier2) {
      formDataToSend.append("wholesaleTier2", formData.wholesaleTier2);
    }
    if (formData.wholesaleTier3) {
      formDataToSend.append("wholesaleTier3", formData.wholesaleTier3);
    }

    if (imageFiles.length > 0) {
      imageFiles.forEach((file) => {
        formDataToSend.append("images", file);
      });
    }

    try {
      const url = editingProduct
        ? `${API_URL}/products/${editingProduct.id}`
        : `${API_URL}/products`;

      const response = await fetch(url, {
        method: editingProduct ? "PUT" : "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formDataToSend,
      });

      if (response.ok) {
        setFormData({
          name: "",
          description: "",
          price: "",
          categoryId: "",
          isSale: false,
          wholesaleTier2: "",
          wholesaleTier3: "",
        });
        setImageFiles([]);
        setShowAdd(false);
        setEditingProduct(null);
        loadProducts();
      }
    } catch (error) {
      console.error("Error saving product:", error);
    }
  };

  const deleteProduct = async (id) => {
    if (!confirm("Видалити товар?")) {
      return;
    }

    try {
      await fetch(`${API_URL}/products/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      loadProducts();
    } catch (error) {
      console.error("Error deleting product:", error);
    }
  };

  const getImageUrl = (imagePath) => {
    if (!imagePath) return null;
    if (imagePath.startsWith("http")) return imagePath;
    return `${window.location.origin}${imagePath}`;
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: "10px",
          marginBottom: "20px",
          flexWrap: "wrap",
        }}
      >
        <button
          className="btn btn-primary"
          onClick={() => {
            setShowAdd(!showAdd);
            setEditingProduct(null);
            setFormData({
              name: "",
              description: "",
              price: "",
              categoryId: "",
              isSale: false,
              wholesaleTier2: "",
              wholesaleTier3: "",
            });
            setImageFiles([]);
          }}
        >
          {showAdd ? "Скасувати" : "Додати товар"}
        </button>
      </div>

      <div className="categories" style={{ marginBottom: "30px" }}>
        <button
          className={`category-btn ${!selectedCategory ? "active" : ""}`}
          onClick={() => setSelectedCategory(null)}
        >
          Всі товари ({products.length})
        </button>
        {categories.map((cat) => {
          const count = products.filter((p) => p.category_id === cat.id).length;
          return (
            <button
              key={cat.id}
              className={`category-btn ${
                selectedCategory === cat.id ? "active" : ""
              }`}
              onClick={() => setSelectedCategory(cat.id)}
            >
              {cat.name} ({count})
            </button>
          );
        })}
      </div>

      {(showAdd || editingProduct) && (
        <form
          onSubmit={saveProduct}
          style={{
            marginBottom: "20px",
            background: "#f8f9fa",
            padding: "20px",
            borderRadius: "10px",
          }}
        >
          <h3>{editingProduct ? "Редагувати товар" : "Додати товар"}</h3>
          <div className="form-group">
            <label>Назва товару</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              required
            />
          </div>
          <div className="form-group">
            <label>Опис</label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
            />
          </div>
          <div className="form-group">
            <label>Ціна (грн)</label>
            <input
              type="number"
              step="0.01"
              value={formData.price}
              onChange={(e) =>
                setFormData({ ...formData, price: e.target.value })
              }
              required
            />
          </div>

          <div
            style={{
              background: "#f0f8ff",
              padding: "15px",
              borderRadius: "8px",
              marginBottom: "15px",
              border: "1px solid #d0e8ff",
            }}
          >
            <label
              style={{
                fontSize: "14px",
                fontWeight: "600",
                color: "#333",
                marginBottom: "10px",
                display: "block",
              }}
            >
              💰 Оптові ціни (опціонально)
            </label>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "10px",
              }}
            >
              <div className="form-group" style={{ marginBottom: "0" }}>
                <label style={{ fontSize: "12px", color: "#555" }}>
                  4-10 шт (грн)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.wholesaleTier2 || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, wholesaleTier2: e.target.value })
                  }
                  placeholder="Залиште порожнім"
                />
              </div>

              <div className="form-group" style={{ marginBottom: "0" }}>
                <label style={{ fontSize: "12px", color: "#555" }}>
                  11+ шт (грн)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.wholesaleTier3 || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, wholesaleTier3: e.target.value })
                  }
                  placeholder="Залиште порожнім"
                />
              </div>
            </div>

            <p
              style={{
                fontSize: "11px",
                color: "#666",
                marginTop: "8px",
                marginBottom: "0",
              }}
            >
              💡 Підказка: зазвичай опт -3% (4-10 шт) та -6% (11+ шт) від
              роздрібу
            </p>
          </div>

          <div className="form-group">
            <label>Категорія</label>
            <select
              value={formData.categoryId}
              onChange={(e) =>
                setFormData({ ...formData, categoryId: e.target.value })
              }
              required
            >
              <option value="">Оберіть категорію</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={formData.isSale}
                onChange={(e) =>
                  setFormData({ ...formData, isSale: e.target.checked })
                }
                style={{ marginRight: "10px", width: "auto" }}
              />
              Акція 🔥
            </label>
          </div>
          <div className="form-group">
            <label>
              Зображення (до 5 фото){" "}
              {editingProduct && "(залиште порожнім щоб зберегти поточні)"}
            </label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setImageFiles(Array.from(e.target.files))}
            />
            {imageFiles.length > 0 && (
              <div
                style={{ marginTop: "8px", fontSize: "12px", color: "#666" }}
              >
                Вибрано фото: {imageFiles.length}
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <button type="submit" className="btn btn-success">
              {editingProduct ? "Оновити" : "Зберегти"}
            </button>
            {editingProduct && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={cancelEdit}
              >
                Скасувати
              </button>
            )}
          </div>
        </form>
      )}

      <div className="products">
        {filteredProducts.map((product) => {
          const images =
            product.images && product.images.length > 0
              ? product.images
              : product.image_path
              ? [product.image_path]
              : [];

          return (
            <div key={product.id} className="product-card">
              {product.is_sale === 1 && (
                <div className="sale-badge">АКЦІЯ 🔥</div>
              )}
              {images.length > 0 && images[0] && (
                <img
                  src={getImageUrl(images[0])}
                  alt={product.name}
                  className="product-image"
                  style={{
                    width: "100%",
                    height: "240px",
                    objectFit: "contain",
                    borderRadius: "12px",
                    marginBottom: "12px",
                    background: "var(--bg-secondary)",
                    padding: "20px",
                  }}
                />
              )}
              <div className="product-name">{product.name}</div>
              <div className="product-description">{product.description}</div>
              <div className="product-price">{product.price} грн</div>

              {(product.wholesale_price_tier2 ||
                product.wholesale_price_tier3) && (
                <div
                  style={{
                    background:
                      "linear-gradient(135deg, #f0f8ff 0%, #e6f3ff 100%)",
                    padding: "12px",
                    borderRadius: "8px",
                    marginBottom: "12px",
                    border: "1px solid #d0e8ff",
                  }}
                >
                  <div
                    style={{
                      fontSize: "12px",
                      fontWeight: "600",
                      color: "#0071e3",
                      marginBottom: "6px",
                    }}
                  >
                    💰 Оптові ціни:
                  </div>

                  {product.wholesale_price_tier2 && (
                    <div
                      style={{
                        fontSize: "13px",
                        color: "#333",
                        marginBottom: "4px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span>4-10 шт:</span>
                      <span style={{ fontWeight: "600" }}>
                        {product.wholesale_price_tier2} грн
                        <span
                          style={{
                            color: "#28a745",
                            fontSize: "11px",
                            marginLeft: "4px",
                          }}
                        >
                          (-
                          {Math.round(
                            (1 -
                              product.wholesale_price_tier2 / product.price) *
                              100
                          )}
                          %)
                        </span>
                      </span>
                    </div>
                  )}

                  {product.wholesale_price_tier3 && (
                    <div
                      style={{
                        fontSize: "13px",
                        color: "#333",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span>11+ шт:</span>
                      <span style={{ fontWeight: "600" }}>
                        {product.wholesale_price_tier3} грн
                        <span
                          style={{
                            color: "#28a745",
                            fontSize: "11px",
                            marginLeft: "4px",
                          }}
                        >
                          (-
                          {Math.round(
                            (1 -
                              product.wholesale_price_tier3 / product.price) *
                              100
                          )}
                          %)
                        </span>
                      </span>
                    </div>
                  )}
                </div>
              )}
              <div
                style={{
                  color: "#666",
                  fontSize: "12px",
                  marginBottom: "10px",
                }}
              >
                Категорія: {product.category_name}
                {images.length > 1 && <> • {images.length} фото</>}
              </div>
              <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                <button
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  onClick={() => startEdit(product)}
                >
                  Редагувати
                </button>
                <button
                  className="btn btn-danger"
                  style={{ flex: 1 }}
                  onClick={() => deleteProduct(product.id)}
                >
                  Видалити
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OrdersTab({ orders, loadOrders, token }) {
  const calculateOrderSavings = (items) => {
    let hasDiscount = false;
    items.forEach((item) => {
      if (item.quantity >= 4) hasDiscount = true;
    });
    return hasDiscount;
  };
  const updateOrderStatus = async (orderId, status) => {
    try {
      await fetch(`${API_URL}/orders/${orderId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });
      loadOrders();
    } catch (error) {
      console.error("Error updating order:", error);
    }
  };

  const deleteOrder = async (orderId) => {
    if (!confirm("Видалити замовлення?")) {
      return;
    }

    try {
      await fetch(`${API_URL}/orders/${orderId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      loadOrders();
    } catch (error) {
      console.error("Error deleting order:", error);
    }
  };

  return (
    <div className="orders-list">
      {orders.length === 0 ? (
        <div className="empty-state">
          <h3>Замовлень поки немає</h3>
        </div>
      ) : (
        orders.map((order) => (
          <div key={order.id} className={`order-card ${order.status}`}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "10px",
              }}
            >
              <div>
                <strong>Замовлення #{order.id}</strong>
                <div style={{ fontSize: "12px", color: "#666" }}>
                  {new Date(order.created_at).toLocaleString("uk-UA")}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div
                  style={{
                    fontSize: "20px",
                    fontWeight: "bold",
                    color: "#28a745",
                  }}
                >
                  {order.items
                    ?.reduce(
                      (sum, item) => sum + item.product_price * item.quantity,
                      0
                    )
                    .toFixed(2)}{" "}
                  грн
                </div>
              </div>
            </div>

            <div style={{ marginBottom: "10px" }}>
              <div>
                <strong>Клієнт:</strong> {order.customer_name}
              </div>
              <div>
                <strong>Телефон:</strong> {order.customer_phone}
              </div>
              {order.customer_email && (
                <div>
                  <strong>Email:</strong> {order.customer_email}
                </div>
              )}
              {order.delivery_address && (
                <div>
                  <strong>📍 Адреса:</strong> {order.delivery_address}
                </div>
              )}
            </div>

            <div style={{ marginBottom: "10px" }}>
              <strong>Товари:</strong>
              {order.items?.map((item, index) => {
                const hasDiscount = item.quantity >= 4;
                const discountPercent =
                  item.quantity >= 11 ? 6 : item.quantity >= 4 ? 3 : 0;

                return (
                  <div
                    key={index}
                    style={{ marginLeft: "10px", fontSize: "14px" }}
                  >
                    • {item.product_name} × {item.quantity} ={" "}
                    {(item.product_price * item.quantity).toFixed(2)} грн
                    {hasDiscount && (
                      <span
                        style={{
                          marginLeft: "8px",
                          color: "#28a745",
                          fontSize: "12px",
                          fontWeight: "600",
                        }}
                      >
                        💰 Опт -{discountPercent}%
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
              <select
                value={order.status}
                onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                style={{ flex: 1, padding: "5px" }}
              >
                <option value="new">Нове</option>
                <option value="processing">В обробці</option>
                <option value="completed">Виконано</option>
                <option value="cancelled">Скасовано</option>
              </select>
              <button
                className="btn btn-danger"
                onClick={() => deleteOrder(order.id)}
              >
                Видалити
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function MyOrdersView({
  customerToken,
  customerEmail,
  setCustomerToken,
  setCustomerEmail,
  customerLogout,
  addToCart,
}) {
  const [step, setStep] = useState(customerToken ? "orders" : "email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    if (customerToken) {
      loadOrders();
    }
  }, [customerToken]);

  const loadOrders = async () => {
    try {
      const response = await fetch(`${API_URL}/my-orders`, {
        headers: {
          Authorization: `Bearer ${customerToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setOrders(data);
      } else {
        setError("Помилка завантаження замовлень");
      }
    } catch (error) {
      console.error("Error loading orders:", error);
      setError("Помилка завантаження замовлень");
    }
  };

  const requestCode = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/request-code`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        setStep("code");
      } else {
        const data = await response.json();
        setError(data.error || "Помилка відправки коду");
      }
    } catch (error) {
      console.error("Error requesting code:", error);
      setError("Помилка відправки коду");
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/verify-code`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, code }),
      });

      if (response.ok) {
        const data = await response.json();
        setCustomerToken(data.token);
        setCustomerEmail(data.email);
        localStorage.setItem("customerToken", data.token);
        localStorage.setItem("customerEmail", data.email);
        setStep("orders");
      } else {
        const data = await response.json();
        setError(data.error || "Невірний код");
      }
    } catch (error) {
      console.error("Error verifying code:", error);
      setError("Помилка перевірки коду");
    } finally {
      setLoading(false);
    }
  };

  const reorder = (order) => {
    order.items.forEach((item) => {
      const product = {
        id: item.product_id,
        name: item.product_name,
        price: item.product_price,
      };
      addToCart(product, item.quantity);
    });
    alert("Товари додано в кошик!");
  };

  if (step === "email") {
    return (
      <div
        className="admin-panel"
        style={{ maxWidth: "500px", margin: "120px auto 40px" }}
      >
        <div style={{ textAlign: "center", marginBottom: "30px" }}>
          <h1 style={{ fontSize: "32px", marginBottom: "10px" }}>
            📦 Мої замовлення
          </h1>
          <p style={{ fontSize: "16px", color: "#666" }}>
            Введіть email щоб переглянути історію ваших замовлень
          </p>
        </div>

        <form onSubmit={requestCode}>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
            />
            <p style={{ fontSize: "12px", color: "#666", marginTop: "8px" }}>
              🔒 Ми відправимо вам код підтвердження для безпечного доступу
            </p>
          </div>

          {error && (
            <div style={{ color: "red", marginBottom: "10px" }}>{error}</div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: "100%" }}
          >
            {loading ? "Відправка..." : "Отримати код"}
          </button>
        </form>
      </div>
    );
  }

  if (step === "code") {
    return (
      <div
        className="admin-panel"
        style={{ maxWidth: "500px", margin: "120px auto 40px" }}
      >
        <div style={{ textAlign: "center", marginBottom: "30px" }}>
          <h1 style={{ fontSize: "32px", marginBottom: "10px" }}>
            📧 Введіть код
          </h1>
          <p style={{ fontSize: "14px", color: "#666" }}>
            Код відправлено на
            <br />
            <strong style={{ fontSize: "16px" }}>{email}</strong>
          </p>
        </div>

        <form onSubmit={verifyCode}>
          <div className="form-group">
            <label
              style={{
                textAlign: "center",
                display: "block",
                marginBottom: "15px",
              }}
            >
              Введіть 6-значний код
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              placeholder="000000"
              maxLength="6"
              style={{
                fontSize: "32px",
                letterSpacing: "12px",
                textAlign: "center",
                padding: "20px",
                width: "100%",
                fontWeight: "bold",
                fontFamily: "monospace",
              }}
              required
              autoFocus
            />
            <p
              style={{
                fontSize: "12px",
                color: "#666",
                textAlign: "center",
                marginTop: "10px",
              }}
            >
              ⏱️ Код дійсний протягом 10 хвилин
            </p>
          </div>

          {error && (
            <div
              style={{
                color: "red",
                marginBottom: "10px",
                textAlign: "center",
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: "10px" }}>
            <button
              type="submit"
              className="btn btn-success"
              style={{ flex: 1 }}
              disabled={loading}
            >
              {loading ? "Перевірка..." : "Підтвердити"}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setStep("email")}
            >
              Назад
            </button>
          </div>
        </form>

        <p
          style={{
            marginTop: "20px",
            fontSize: "12px",
            color: "#666",
            textAlign: "center",
          }}
        >
          Не отримали код?{" "}
          <button
            onClick={() => requestCode({ preventDefault: () => {} })}
            style={{
              background: "none",
              border: "none",
              color: "#0071e3",
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            Відправити знову
          </button>
        </p>
      </div>
    );
  }

  if (step === "orders") {
    return (
      <div className="admin-panel">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
          }}
        >
          <h2>Мої замовлення</h2>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <span style={{ color: "#666" }}>{customerEmail}</span>
            <button className="btn btn-secondary" onClick={customerLogout}>
              Вийти
            </button>
          </div>
        </div>

        {orders.length === 0 ? (
          <div className="empty-state">
            <h3>У вас поки немає замовлень</h3>
            <p>Оформіть перше замовлення і воно з'явиться тут</p>
          </div>
        ) : (
          <div className="orders-list">
            {orders.map((order) => (
              <div key={order.id} className={`order-card ${order.status}`}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "10px",
                  }}
                >
                  <div>
                    <strong>Замовлення #{order.id}</strong>
                    <div style={{ fontSize: "12px", color: "#666" }}>
                      {new Date(order.created_at).toLocaleString("uk-UA")}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div
                      style={{
                        fontSize: "20px",
                        fontWeight: "bold",
                        color: "#28a745",
                      }}
                    >
                      {order.total_amount?.toFixed(2)} грн
                    </div>
                    <div style={{ fontSize: "12px", color: "#666" }}>
                      {order.status === "new" && "🟡 Нове"}
                      {order.status === "processing" && "🔵 В обробці"}
                      {order.status === "completed" && "✅ Виконано"}
                      {order.status === "cancelled" && "❌ Скасовано"}
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: "10px" }}>
                  <strong>Товари:</strong>
                  {order.items?.map((item, index) => (
                    <div
                      key={index}
                      style={{ marginLeft: "10px", fontSize: "14px" }}
                    >
                      • {item.product_name} × {item.quantity} ={" "}
                      {(item.product_price * item.quantity).toFixed(2)} грн
                    </div>
                  ))}
                </div>

                <div
                  style={{ display: "flex", gap: "10px", marginTop: "15px" }}
                >
                  <button
                    className="btn btn-primary"
                    onClick={() => reorder(order)}
                    style={{ flex: 1 }}
                  >
                    🔄 Замовити знову
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }
}

function Footer({ onOpenInfo }) {
  window.openInfoModal = onOpenInfo;

  return (
    <footer className="footer">
      <div className="footer-content">
        <div className="footer-section">
          <h3>Контакти</h3>
          <a href="tel:+380123456789">📞 +380 12 345 67 89</a>
          <a href="mailto:info@verba.com">✉️ info@verba.com</a>
          <p>🕒 Пн-Пт: 9:00 - 18:00</p>
          <p>🕒 Сб-Нд: 10:00 - 16:00</p>
        </div>

        <div className="footer-section">
          <h3>Інформація</h3>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              window.openInfoModal("delivery");
            }}
          >
            Доставка та оплата
          </a>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              window.openInfoModal("warranty");
            }}
          >
            Гарантія
          </a>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              window.openInfoModal("return");
            }}
          >
            Повернення товару
          </a>
          <div className="footer-section">
            <div className="social-links">
              <a
                href="https://t.me/your_channel"
                target="_blank"
                rel="noopener noreferrer"
                className="social-link"
              >
                <img src="telegram.png" alt="Telegram" />
              </a>
              <a
                href="viber://chat?number=%2B380123456789"
                className="social-link"
              >
                <img src="viber.png" alt="Viber" />
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <p>© 2024 VERBA. Всі права захищено.</p>
      </div>
    </footer>
  );
}

function InfoModal({ type, onClose }) {
  const content = {
    about: {
      title: "📱 Про нас",
      text: `
        <h3>VERBA - Ваш надійний партнер у світі технологій</h3>
        <p>Ми спеціалізуємося на постачанні високоякісних брендових аксесуарів для ваших гаджетів. Наша місія - забезпечити кожного клієнта надійними та стильними аксесуарами, які підкреслять індивідуальність та захистять ваші пристрої.</p>
        
        <h4>Чому обирають нас:</h4>
        <ul>
          <li>✅ Тільки оригінальна продукція від перевірених виробників</li>
          <li>✅ Конкурентні ціни та оптові знижки</li>
          <li>✅ Швидка доставка по всій Україні</li>
          <li>✅ Професійна консультація</li>
          <li>✅ Офіційна гарантія на всі товари</li>
        </ul>
        
        <p>Працюємо з 2020 року та маємо понад 5000 задоволених клієнтів!</p>
      `,
    },
    delivery: {
      title: "🚚 Доставка та оплата",
      text: `
        <h3>Доставка</h3>
        <p><strong>Нова Пошта:</strong></p>
        <ul>
          <li>Доставка у відділення - 1-2 дні, від 50 грн</li>
          <li>Адресна доставка кур'єром - 1-2 дні, від 70 грн</li>
          <li>Безкоштовна доставка при замовленні від 2000 грн</li>
        </ul>
        
        <p><strong>Укрпошта:</strong></p>
        <ul>
          <li>Доставка у відділення - 3-5 днів, від 40 грн</li>
        </ul>
        
        <h3>Оплата</h3>
        <ul>
          <li>💳 Оплата картою онлайн (Visa, Mastercard)</li>
          <li>💰 Готівкою при отриманні</li>
          <li>📱 Безготівковий розрахунок для юридичних осіб</li>
          <li>🏦 Оплата на ФОП (накладений платіж)</li>
        </ul>
        
        <p><em>При замовленні від 10 одиниць можлива відстрочка платежу!</em></p>
      `,
    },
    warranty: {
      title: "🛡️ Гарантія",
      text: `
        <h3>Гарантійні умови</h3>
        <p>Ми надаємо офіційну гарантію на всі товари згідно з умовами виробника.</p>
        
        <h4>Термін гарантії:</h4>
        <ul>
          <li>Зарядні пристрої та кабелі - 12 місяців</li>
          <li>Павербанки - 12 місяців</li>
          <li>Навушники - 12 місяців</li>
          <li>Захисні аксесуари - 6 місяців</li>
        </ul>
        
        <h4>Гарантія покриває:</h4>
        <ul>
          <li>✅ Заводський брак</li>
          <li>✅ Несправності, що виникли при нормальній експлуатації</li>
          <li>✅ Безкоштовний ремонт або заміну товару</li>
        </ul>
        
        <h4>Гарантія НЕ покриває:</h4>
        <ul>
          <li>❌ Механічні пошкодження</li>
          <li>❌ Пошкодження від води</li>
          <li>❌ Самостійний ремонт</li>
          <li>❌ Невідповідне використання</li>
        </ul>
        
        <p><strong>Для гарантійного обслуговування зверніться до нас з чеком!</strong></p>
      `,
    },
    return: {
      title: "🔄 Повернення товару",
      text: `
        <h3>Умови повернення</h3>
        <p>Ви можете повернути або обміняти товар протягом <strong>14 днів</strong> з моменту покупки.</p>
        
        <h4>Умови для повернення:</h4>
        <ul>
          <li>✅ Товар не використовувався</li>
          <li>✅ Збережено товарний вигляд та упаковку</li>
          <li>✅ Наявність чеку або іншого документа про покупку</li>
          <li>✅ Комплектність товару (всі аксесуари, інструкції)</li>
        </ul>
        
        <h4>Як повернути товар:</h4>
        <ol>
          <li>Зв'яжіться з нами за телефоном або email</li>
          <li>Надішліть товар Новою Поштою на нашу адресу</li>
          <li>Після перевірки товару ми повернемо кошти протягом 3-5 робочих днів</li>
        </ol>
        
        <h4>Обмін товару:</h4>
        <p>Ви можете обміняти товар на аналогічний або інший товар з доплатою різниці.</p>
        
        <p><strong>Важливо:</strong> Вартість доставки при поверненні сплачує покупець, якщо причиною повернення не є брак товару.</p>
        
        <p><em>Для повернення коштів надайте реквізити картки або рахунку.</em></p>
      `,
    },
  };

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "unset";
    };
  }, []);

  const info = content[type];

  return (
    <div className="modal" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "700px" }}
      >
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            right: "20px",
            top: "20px",
            background: "none",
            border: "none",
            fontSize: "32px",
            cursor: "pointer",
            color: "#999",
            lineHeight: "1",
          }}
        >
          ×
        </button>
        <h2 style={{ marginBottom: "20px" }}>{info.title}</h2>
        <div
          dangerouslySetInnerHTML={{ __html: info.text }}
          style={{
            lineHeight: "1.8",
            color: "var(--text-primary)",
          }}
        />
        <button
          onClick={onClose}
          className="btn btn-primary"
          style={{ marginTop: "20px", width: "100%" }}
        >
          Закрити
        </button>
      </div>
    </div>
  );
}

ReactDOM.render(<App />, document.getElementById("root"));
