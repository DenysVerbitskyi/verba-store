const Database = require("./database");

const db = new Database();

// Дочекатись ініціалізації бази
setTimeout(() => {
  seedDatabase();
}, 100);

function seedDatabase() {
  // Очистити табліці
  console.log("Очищення бази даних...");
  db.db.run("DELETE FROM order_items");
  db.db.run("DELETE FROM orders");
  db.db.run("DELETE FROM products");
  db.db.run("DELETE FROM categories");
  db.save();

  // Створити категорії
  console.log("\n📁 Створення категорій...");
  db.createCategory("Блоки для зарядки");
  db.createCategory("Кабелі");
  db.createCategory("Павербанки");
  db.createCategory("Чохли");
  db.createCategory("Захисне скло");
  db.createCategory("Навушники");

  const categories = db.getAllCategories();
  console.log(`✅ Створено ${categories.length} категорій`);

  // Функція для розрахунку оптових цін
  function calculateWholesale(price) {
    return {
      tier2: Math.round(price * 0.97), // -3% для 4-10 шт
      tier3: Math.round(price * 0.94), // -6% для 11+ шт
    };
  }

  // Створити товари
  console.log("\n📦 Створення товарів...\n");

  // Блоки для зарядки
  console.log("⚡ Блоки для зарядки:");
  const chargers = [
    {
      name: "20W USB-C Adapter",
      desc: "Компактний блок швидкої зарядки",
      price: 999,
      sale: false,
    },
    {
      name: "35W Dual USB-C",
      desc: "Двопортовий зарядний пристрій",
      price: 1599,
      sale: false,
    },
    {
      name: "67W GaN Charger",
      desc: 'Для MacBook Pro 14"',
      price: 2299,
      sale: true,
    },
    {
      name: "140W USB-C Power",
      desc: 'Для MacBook Pro 16"',
      price: 3499,
      sale: false,
    },
    {
      name: "30W USB-C Compact",
      desc: "З просторовим звуком",
      price: 1199,
      sale: false,
    },
  ];

  chargers.forEach((item) => {
    const wholesale = calculateWholesale(item.price);
    db.createProduct(
      item.name,
      item.desc,
      item.price,
      null,
      1,
      null,
      item.sale ? 1 : 0,
      wholesale.tier2,
      wholesale.tier3
    );
    console.log(
      `   ✓ ${item.name} - ${item.price} грн (опт: ${wholesale.tier2}/${wholesale.tier3} грн)`
    );
  });

  // Кабелі
  console.log("\n🔌 Кабелі:");
  const cables = [
    {
      name: "USB-C to Lightning 1m",
      desc: "Оригінальний кабель Apple",
      price: 799,
      sale: false,
    },
    {
      name: "USB-C to USB-C 2m",
      desc: "Посилений плетений кабель",
      price: 999,
      sale: true,
    },
    {
      name: "MagSafe Cable 1m",
      desc: "Магнітний кабель для зарядки",
      price: 1499,
      sale: false,
    },
    {
      name: "Thunderbolt 4 Cable",
      desc: "Для швидкої передачі даних",
      price: 2999,
      sale: false,
    },
    {
      name: "Lightning to 3.5mm",
      desc: "Перехідник для навушників",
      price: 599,
      sale: false,
    },
  ];

  cables.forEach((item) => {
    const wholesale = calculateWholesale(item.price);
    db.createProduct(
      item.name,
      item.desc,
      item.price,
      null,
      2,
      null,
      item.sale ? 1 : 0,
      wholesale.tier2,
      wholesale.tier3
    );
    console.log(
      `   ✓ ${item.name} - ${item.price} грн (опт: ${wholesale.tier2}/${wholesale.tier3} грн)`
    );
  });

  // Павербанки
  console.log("\n🔋 Павербанки:");
  const powerbanks = [
    {
      name: "MagSafe Battery Pack",
      desc: "Офіційний павербанк Apple",
      price: 2999,
      sale: false,
    },
    {
      name: "Anker 20000mAh PD",
      desc: "Швидка зарядка 65W",
      price: 2499,
      sale: true,
    },
    {
      name: "Baseus 30000mAh",
      desc: "Потужний павербанк",
      price: 3299,
      sale: false,
    },
    {
      name: "RAVPower 26800mAh",
      desc: "З підтримкою Quick Charge",
      price: 2799,
      sale: false,
    },
    {
      name: "Xiaomi 30000mAh",
      desc: "Великий ємності",
      price: 2499,
      sale: false,
    },
  ];

  powerbanks.forEach((item) => {
    const wholesale = calculateWholesale(item.price);
    db.createProduct(
      item.name,
      item.desc,
      item.price,
      null,
      3,
      null,
      item.sale ? 1 : 0,
      wholesale.tier2,
      wholesale.tier3
    );
    console.log(
      `   ✓ ${item.name} - ${item.price} грн (опт: ${wholesale.tier2}/${wholesale.tier3} грн)`
    );
  });

  // Чохли
  console.log("\n📱 Чохли:");
  const cases = [
    {
      name: "Silicone Case iPhone 15",
      desc: "Силіконовий чохол преміум",
      price: 1299,
      sale: false,
    },
    {
      name: "Clear Case iPhone 14 Pro",
      desc: "Прозорий захисний чохол",
      price: 1299,
      sale: true,
    },
    {
      name: "Leather Case iPhone 15",
      desc: "Шкіряний чохол з MagSafe",
      price: 2499,
      sale: false,
    },
    {
      name: "MagSafe Wallet",
      desc: "Гаманець на магнітах",
      price: 1999,
      sale: false,
    },
    {
      name: "Tough Armor Case",
      desc: "Захисний протиударний",
      price: 1499,
      sale: false,
    },
  ];

  cases.forEach((item) => {
    const wholesale = calculateWholesale(item.price);
    db.createProduct(
      item.name,
      item.desc,
      item.price,
      null,
      4,
      null,
      item.sale ? 1 : 0,
      wholesale.tier2,
      wholesale.tier3
    );
    console.log(
      `   ✓ ${item.name} - ${item.price} грн (опт: ${wholesale.tier2}/${wholesale.tier3} грн)`
    );
  });

  // Захисне скло
  console.log("\n🛡️ Захисне скло:");
  const screenProtectors = [
    {
      name: "Tempered Glass iPhone 15",
      desc: "Загартоване скло",
      price: 299,
      sale: false,
    },
    {
      name: "Ceramic Shield Film",
      desc: "Нанокерамічна плівка",
      price: 799,
      sale: false,
    },
    {
      name: "Privacy Glass",
      desc: "З захистом приватності",
      price: 599,
      sale: true,
    },
    {
      name: "Camera Lens Protector",
      desc: "Захист камери із скла",
      price: 299,
      sale: false,
    },
    {
      name: "Anti-Blue Light Glass",
      desc: "З фільтром синього світла",
      price: 499,
      sale: false,
    },
  ];

  screenProtectors.forEach((item) => {
    const wholesale = calculateWholesale(item.price);
    db.createProduct(
      item.name,
      item.desc,
      item.price,
      null,
      5,
      null,
      item.sale ? 1 : 0,
      wholesale.tier2,
      wholesale.tier3
    );
    console.log(
      `   ✓ ${item.name} - ${item.price} грн (опт: ${wholesale.tier2}/${wholesale.tier3} грн)`
    );
  });

  // Навушники
  console.log("\n🎧 Навушники:");
  const headphones = [
    {
      name: "AirPods Pro 2",
      desc: "З активним шумозаглушенням",
      price: 9499,
      sale: true,
    },
    {
      name: "AirPods 3",
      desc: "З просторовим звуком",
      price: 6999,
      sale: false,
    },
    {
      name: "AirPods Max",
      desc: "Преміум накладні навушники",
      price: 19999,
      sale: false,
    },
    {
      name: "Beats Studio Buds+",
      desc: "Компактні з шумозаглушенням",
      price: 5499,
      sale: false,
    },
    {
      name: "Beats Fit Pro",
      desc: "Спортивні навушники",
      price: 6499,
      sale: false,
    },
  ];

  headphones.forEach((item) => {
    const wholesale = calculateWholesale(item.price);
    db.createProduct(
      item.name,
      item.desc,
      item.price,
      null,
      6,
      null,
      item.sale ? 1 : 0,
      wholesale.tier2,
      wholesale.tier3
    );
    console.log(
      `   ✓ ${item.name} - ${item.price} грн (опт: ${wholesale.tier2}/${wholesale.tier3} грн)`
    );
  });

  console.log(
    "\n✅ Готово! Створено 6 категорій та 30 товарів з оптовими цінами\n"
  );
  console.log("💡 Оптові ціни:");
  console.log("   • 4-10 шт: -3% від роздрібу");
  console.log("   • 11+ шт:  -6% від роздрібу\n");
}
