(function () {
  const CART_STORAGE_KEY = "cart";
  const FAV_STORAGE_KEY = "favourites";
  const ADMIN_STORAGE_KEY = "prodom_admin_v1";
  const ORDER_STORAGE_KEY = "prodom_orders_v1";
  const FEEDBACK_STORAGE_KEY = "prodom_feedback_v1";
  const DEFAULT_JSON_PATH = "data/products.json";

  document.addEventListener("DOMContentLoaded", () => {
    initSmoothScroll();
    initHeaderScroll();
    initSearchFocus();
    initNewsletterForm();
    initContactsForm();
    initAdminIntegration();
    initCardHoverEffects();
    initProductCards();
    initCartBadge();
    initCartBadgeAutoUpdate();
    document.addEventListener("products:updated", initCardHoverEffects);
  });

  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
      anchor.addEventListener("click", (event) => {
        const href = anchor.getAttribute("href");
        if (!href || href === "#") return;

        const target = document.querySelector(href);
        if (!target) return;

        event.preventDefault();
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  function initHeaderScroll() {
    const header = document.querySelector(".header");
    if (!header) return;

    const applyState = () => {
      const top = window.scrollY || window.pageYOffset;
      header.style.boxShadow =
        top > 10
          ? "0 4px 20px rgba(5, 98, 164, 0.15)"
          : "0 2px 8px rgba(5, 98, 164, 0.1)";
    };

    applyState();
    window.addEventListener("scroll", applyState, { passive: true });
  }

  function initSearchFocus() {
    document.querySelectorAll(".header-actions .input").forEach((input) => {
      input.addEventListener("focus", () => {
        input.style.transform = "scale(1.01)";
      });
      input.addEventListener("blur", () => {
        input.style.transform = "";
      });
    });
  }

  function initCardHoverEffects() {
    document.querySelectorAll(".product-card, .category-card").forEach((card) => {
      card.addEventListener("mouseenter", () => {
        card.style.zIndex = "2";
      });
      card.addEventListener("mouseleave", () => {
        card.style.zIndex = "";
      });
    });
  }

  function initNewsletterForm() {
    const newsletters = document.querySelectorAll(".newsletter");
    if (!newsletters.length) return;

    newsletters.forEach((block) => {
      const emailInput = block.querySelector('input[type="email"]');
      const button = block.querySelector(".btn-primary");
      if (!emailInput || !button) return;
      emailInput.required = true;
      emailInput.setAttribute("maxlength", "120");
      emailInput.setAttribute("inputmode", "email");

      button.addEventListener("click", (event) => {
        event.preventDefault();
        const email = String(emailInput.value || "").trim();

        if (!email) {
          showNotification("Введите email", "error");
          return;
        }

        if (!isValidEmail(email)) {
          showNotification("Введите корректный email", "error");
          return;
        }

        submitFeedback({
          type: "newsletter",
          name: "Подписка",
          contact: email,
          topic: "Подписка на новости",
          message: `Новая заявка на подписку: ${email}`
        });
        emailInput.value = "";
        showNotification("Спасибо за подписку", "success");
      });
    });
  }

  function initContactsForm() {
    const form = document.getElementById("contact-form");
    if (!form) return;

    const nameInput = document.getElementById("contact-name");
    const contactInput = document.getElementById("contact-contact");
    const topicInput = document.getElementById("contact-topic");
    const messageInput = document.getElementById("contact-message");
    if (!nameInput || !contactInput || !topicInput || !messageInput) return;

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const name = sanitizePlainText(nameInput.value || "", 80);
      const contact = sanitizePlainText(contactInput.value || "", 120);
      const topic = sanitizePlainText(topicInput.value || "", 80);
      const message = sanitizePlainText(messageInput.value || "", 1200);

      const contactLooksValid = isValidEmail(contact) || isValidPhone(contact);
      if (!name || !contact || !topic || !message) {
        showNotification("Заполните все обязательные поля.", "error");
        return;
      }
      if (!contactLooksValid) {
        showNotification("Введите корректный email или телефон.", "error");
        return;
      }
      if (message.length < 10) {
        showNotification("Сообщение должно быть не короче 10 символов.", "error");
        return;
      }

      submitFeedback({
        type: "contacts",
        name,
        contact,
        topic,
        message
      });

      form.reset();
      showNotification("Сообщение отправлено.", "success");
    });
  }

  function initAdminIntegration() {
    const hasHomeBlocks = document.querySelector(".catalog .catalog-grid") || document.querySelector(".popular .products-grid");
    if (!hasHomeBlocks) return;

    const renderHomeFromData = async () => {
      const catalog = await loadCatalogData();
      if (catalog.categories.length) {
        hydrateHomeCategories(catalog.categories);
      }
      if (catalog.products.length) {
        hydrateHomePopular(catalog.products);
      }
    };

    renderHomeFromData();

    window.addEventListener("storage", (event) => {
      if (!event.key || event.key === ADMIN_STORAGE_KEY || event.key === ORDER_STORAGE_KEY) {
        renderHomeFromData();
      }
    });
  }

  function hydrateHomeCategories(categories) {
    const grid = document.querySelector(".catalog .catalog-grid");
    if (!grid || !categories.length) return;

    const icons = [
      "images/plumber.svg",
      "images/vacuum-cleaner.svg",
      "images/construction.svg",
      "images/paint-brush.svg",
      "images/tools.svg"
    ];

    grid.innerHTML = "";
    const fragment = document.createDocumentFragment();

    categories.forEach((category, index) => {
      const card = document.createElement("a");
      card.className = "category-card";
      card.href = `pages/catalogue.html?category=${encodeURIComponent(String(category || ""))}`;
      card.innerHTML = `
        <img src="${icons[index % icons.length]}" alt="${escapeHtml(category)}">
        <span>${escapeHtml(category)}</span>
      `;
      fragment.appendChild(card);
    });

    grid.appendChild(fragment);
  }

  function hydrateHomePopular(products) {
    const grid = document.querySelector(".popular .products-grid");
    if (!grid || !products.length) return;

    const items = selectPopularProducts(products, 4);
    grid.innerHTML = "";
    const fragment = document.createDocumentFragment();

    items.forEach((product, index) => {
      const name = sanitizePlainText(product?.name || `Товар ${index + 1}`, 120);
      const description = sanitizePlainText(product?.description || "", 400);
      const category = sanitizePlainText(product?.category || "", 80);
      const price = Math.max(0, Number(product?.price) || 0);
      const image = resolveImageForCurrentPage(product?.photo);
      const id = sanitizeId(product?.id || slugify(name) || `product-${index + 1}`);

      const card = document.createElement("div");
      card.className = "product-card";
      card.dataset.category = normalizeCategory(category);
      card.dataset.productId = id;
      card.innerHTML = `
        <img src="${image}" alt="${escapeHtml(name)}">
        <h4>${escapeHtml(name)}</h4>
        <h5>${escapeHtml(description)}</h5>
        <p class="product-category">${escapeHtml(category || "Без категории")}</p>
        <p class="price">${formatPriceText(price)}</p>
        <button class="btn-primary">В корзину</button>
      `;

      fragment.appendChild(card);
    });

    grid.appendChild(fragment);
    document.dispatchEvent(new Event("products:updated"));
  }

  function readOrdersSafe() {
    try {
      const raw = localStorage.getItem(ORDER_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function selectPopularProducts(products, limit) {
    const safeLimit = Math.max(1, Number(limit) || 4);
    const orders = readOrdersSafe();
    if (!orders.length) return products.slice(0, safeLimit);

    const quantityById = new Map();
    const quantityByName = new Map();

    orders.forEach((order) => {
      const items = Array.isArray(order?.items) ? order.items : [];
      items.forEach((item) => {
        const qty = Math.max(0, Number(item?.quantity) || 0);
        if (!qty) return;

        const itemId = sanitizeId(item?.id || "");
        const itemName = sanitizePlainText(item?.name || "", 120).toLowerCase();

        if (itemId) {
          quantityById.set(itemId, (quantityById.get(itemId) || 0) + qty);
        }
        if (itemName) {
          quantityByName.set(itemName, (quantityByName.get(itemName) || 0) + qty);
        }
      });
    });

    const ranked = products
      .map((product, index) => {
        const id = sanitizeId(product?.id || "");
        const name = sanitizePlainText(product?.name || "", 120);
        const byId = quantityById.get(id) || 0;
        const byName = quantityByName.get(name.toLowerCase()) || 0;
        return {
          product,
          index,
          quantity: Math.max(byId, byName),
          name
        };
      })
      .sort((a, b) => {
        if (b.quantity !== a.quantity) return b.quantity - a.quantity;
        const byName = a.name.localeCompare(b.name, "ru", { sensitivity: "base" });
        if (byName !== 0) return byName;
        return a.index - b.index;
      });

    return ranked.slice(0, safeLimit).map((entry) => entry.product);
  }

  function readAdminCatalogSafe() {
    try {
      const raw = localStorage.getItem(ADMIN_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      const categories = Array.isArray(parsed?.categories)
        ? parsed.categories.map((item) => sanitizePlainText(item || "", 80)).filter(Boolean)
        : [];
      const products = Array.isArray(parsed?.products)
        ? parsed.products
            .map((item) => ({
              id: sanitizeId(item?.id || ""),
              name: sanitizePlainText(item?.name || "", 120),
              category: sanitizePlainText(item?.category || "", 80),
              price: Math.max(0, Number(item?.price) || 0),
              description: sanitizePlainText(item?.description || "", 400),
              photo: String(item?.photo || "")
            }))
            .filter((item) => item.name)
        : [];

      return { categories, products };
    } catch {
      return { categories: [], products: [] };
    }
  }

  function getProductsJsonPath() {
    return window.location.pathname.includes("/pages/") ? `../${DEFAULT_JSON_PATH}` : DEFAULT_JSON_PATH;
  }

  async function readJsonCatalogSafe() {
    try {
      const response = await fetch(getProductsJsonPath(), { cache: "no-store" });
      if (!response.ok) return { categories: [], products: [] };
      const payload = await response.json();
      return normalizeCatalogPayload(payload);
    } catch {
      return { categories: [], products: [] };
    }
  }

  function normalizeCatalogPayload(payload) {
    const categoriesRaw = Array.isArray(payload?.categories) ? payload.categories : [];
    const productsRaw = Array.isArray(payload?.products)
      ? payload.products
      : Array.isArray(payload)
        ? payload
        : [];

    const categories = categoriesRaw.map((item) => sanitizePlainText(item || "", 80)).filter(Boolean);
    const products = productsRaw
      .map((item) => ({
        id: sanitizeId(item?.id || ""),
        name: sanitizePlainText(item?.name || "", 120),
        category: sanitizePlainText(item?.category || "", 80),
        price: Math.max(0, Number(item?.price) || 0),
        description: sanitizePlainText(item?.description || "", 400),
        photo: String(item?.photo || "").trim()
      }))
      .filter((item) => item.name);

    const normalizedCategories = categories.length ? categories : extractCategoriesFromProducts(products);
    return { categories: normalizedCategories, products };
  }

  function mergeCatalogData(baseCatalog, adminCatalog) {
    const base = baseCatalog || { categories: [], products: [] };
    const admin = adminCatalog || { categories: [], products: [] };
    const byId = new Map();

    base.products.forEach((product) => {
      byId.set(product.id, product);
    });
    admin.products.forEach((product) => {
      byId.set(product.id, product);
    });

    const products = Array.from(byId.values());
    const categorySet = new Set();
    [...admin.categories, ...base.categories].forEach((category) => {
      const clean = sanitizePlainText(category || "", 80);
      if (clean) categorySet.add(clean);
    });

    if (!categorySet.size) {
      extractCategoriesFromProducts(products).forEach((category) => categorySet.add(category));
    }

    return {
      categories: Array.from(categorySet),
      products
    };
  }

  async function loadCatalogData() {
    const [jsonCatalog, adminCatalog] = await Promise.all([
      readJsonCatalogSafe(),
      Promise.resolve(readAdminCatalogSafe())
    ]);
    return mergeCatalogData(jsonCatalog, adminCatalog);
  }

  function extractCategoriesFromProducts(products) {
    const set = new Set();
    (Array.isArray(products) ? products : []).forEach((item) => {
      const category = sanitizePlainText(item?.category || "", 80);
      if (category) set.add(category);
    });
    return Array.from(set);
  }

  function initProductCards() {
    const cards = Array.from(document.querySelectorAll(".product-card"));
    if (!cards.length) return;

    cards.forEach((card, index) => {
      const product = buildProductFromCard(card, index);
      card.dataset.productId = product.id;
      card.__product = product;

      const { addBtn, qtyWrap, qtyValue, favBtn } = ensureProductCardControls(card);

      if (!addBtn.dataset.bound) {
        addBtn.dataset.bound = "1";
        addBtn.addEventListener("click", (event) => {
          event.preventDefault();
          addProductToCart(card.__product || product, 1);
        });
      }

      if (!favBtn.dataset.bound) {
        favBtn.dataset.bound = "1";
        favBtn.addEventListener("click", (event) => {
          event.preventDefault();
          toggleFavourite(card.__product || product);
        });
      }

      if (!qtyWrap.dataset.bound) {
        qtyWrap.dataset.bound = "1";
        qtyWrap.addEventListener("click", (event) => {
          const target = event.target;
          if (!(target instanceof HTMLElement)) return;
          const button = target.closest("button[data-action]");
          if (!button) return;

          const action = String(button.dataset.action || "").trim();
          const currentProduct = card.__product || product;
          const currentQty = getCartItemQuantity(currentProduct.id);

          if (action === "minus") {
            const nextQty = currentQty - 1;
            updateCartItemQuantity(currentProduct, nextQty);
            return;
          }

          if (action === "plus") {
            const nextQty = Math.min(99, currentQty + 1);
            updateCartItemQuantity(currentProduct, nextQty);
          }
        });
      }

      syncProductCardState(card, qtyValue, favBtn);
    });

    const syncAll = () => {
      document.querySelectorAll(".product-card").forEach((card) => {
        const qtyValue = card.querySelector(".product-card-qty .card-qty-value");
        const favBtn = card.querySelector(".product-card-actions .fav-btn");
        if (qtyValue) syncProductCardState(card, qtyValue, favBtn);
      });
    };

    if (!window.__prodomProductListenersBound) {
      window.__prodomProductListenersBound = true;

      document.addEventListener("cart:updated", syncAll);
      document.addEventListener("favourites:updated", syncAll);
      document.addEventListener("products:updated", () => {
        initProductCards();
      });
      window.addEventListener("storage", (event) => {
        if (!event.key || event.key === CART_STORAGE_KEY || event.key === FAV_STORAGE_KEY) {
          syncAll();
        }
      });
    }
  }

  function buildProductFromCard(card, index) {
    const name = sanitizePlainText(card.querySelector("h4")?.textContent || `Товар ${index + 1}`, 120);
    const description = sanitizePlainText(card.querySelector("h5")?.textContent || "", 400);
    const price = parsePrice(card.querySelector(".price")?.textContent || "0");
    const category = normalizeCategory(
      card.dataset.category || card.querySelector(".product-category")?.textContent || ""
    );
    const image = normalizeImagePath(card.querySelector("img")?.getAttribute("src"));
    const id = sanitizeId(card.dataset.productId || slugify(name) || `product-${index + 1}`);

    return {
      id,
      name,
      description,
      price,
      category,
      image
    };
  }

  function ensureProductCardControls(card) {
    let actions = card.querySelector(".product-card-actions");
    if (!actions) {
      actions = document.createElement("div");
      actions.className = "product-card-actions";
      card.appendChild(actions);
    }

    let favBtn = actions.querySelector(".fav-btn");
    if (!favBtn) {
      favBtn = document.createElement("button");
      favBtn.type = "button";
      favBtn.className = "fav-btn";
      favBtn.setAttribute("aria-label", "Добавить в избранное");
      favBtn.textContent = "♥";
      actions.appendChild(favBtn);
    }

    let addBtn = actions.querySelector(".btn-primary") || card.querySelector(".btn-primary");
    if (!addBtn) {
      addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.className = "btn-primary";
      addBtn.textContent = "В корзину";
    }

    if (addBtn.parentElement !== actions) {
      actions.appendChild(addBtn);
    }

    let qtyWrap = actions.querySelector(".product-card-qty");
    if (!qtyWrap) {
      qtyWrap = document.createElement("div");
      qtyWrap.className = "product-card-qty";
      qtyWrap.innerHTML = `
        <button type="button" class="card-qty-btn" data-action="minus">-</button>
        <span class="card-qty-value">1</span>
        <button type="button" class="card-qty-btn" data-action="plus">+</button>
      `;
      actions.appendChild(qtyWrap);
    }

    const qtyValue = qtyWrap.querySelector(".card-qty-value");
    return { addBtn, qtyWrap, qtyValue, favBtn };
  }

  function syncProductCardState(card, qtyValue, favBtn) {
    const productId = String(card.dataset.productId || "").trim();
    if (!productId) return;
    const quantity = getCartItemQuantity(productId);
    const addBtn = card.querySelector(".product-card-actions .btn-primary");
    const qtyWrap = card.querySelector(".product-card-actions .product-card-qty");
    if (!addBtn || !qtyWrap || !qtyValue) return;

    if (quantity > 0) {
      addBtn.style.display = "none";
      qtyWrap.style.display = "inline-flex";
      qtyValue.textContent = String(quantity);
    } else {
      addBtn.style.display = "";
      qtyWrap.style.display = "none";
    }

    if (favBtn) {
      const isFav = isFavourite(productId);
      favBtn.classList.toggle("is-active", isFav);
      favBtn.setAttribute("aria-label", isFav ? "Убрать из избранного" : "Добавить в избранное");
    }
  }

  function slugify(value) {
    return String(value || "")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^\w\-а-яё]/gi, "");
  }

  function parsePrice(value) {
    const normalized = String(value || "").replace(/[^\d]/g, "");
    const numeric = Number(normalized);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  function normalizeCategory(value) {
    return String(value || "").trim().toLowerCase();
  }

  function sanitizePlainText(value, maxLength) {
    const limit = Math.max(1, Number(maxLength) || 300);
    return String(value || "")
      .replace(/[\u0000-\u001F\u007F]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, limit);
  }

  function sanitizeId(value) {
    const normalized = String(value || "")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9а-яё_:-]/gi, "")
      .slice(0, 120);
    return normalized || `p_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  }

  function normalizeImagePath(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    if (raw.startsWith("http")) return raw;
    if (raw.startsWith("/")) return raw.slice(1);
    return raw.startsWith("./") ? raw.slice(2) : raw;
  }

  function resolveImageForCurrentPage(value) {
    const raw = String(value || "").trim();
    if (!raw) {
      return location.pathname.includes("/pages/") ? "../images/logo.svg" : "images/logo.svg";
    }
    if (raw.startsWith("data:") || raw.startsWith("http")) return raw;
    if (raw.startsWith("/")) return raw;
    if (raw.startsWith("../") || raw.startsWith("./")) return raw;
    if (location.pathname.includes("/pages/")) return `../${raw}`;
    return raw;
  }

  function formatPriceText(value) {
    const number = Math.max(0, Number(value) || 0);
    return `${new Intl.NumberFormat("ru-RU").format(number)} ₽`;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function isValidPhone(phone) {
    const digits = String(phone || "").replace(/\D/g, "");
    return digits.length >= 10 && digits.length <= 11;
  }

  function readFeedbackSafe() {
    try {
      const raw = localStorage.getItem(FEEDBACK_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function submitFeedback(payload) {
    const items = readFeedbackSafe();
    items.unshift({
      id: `fb_${Date.now()}_${Math.floor(Math.random() * 100000)}`,
      createdAt: new Date().toISOString(),
      type: sanitizePlainText(payload?.type || "feedback", 40),
      name: sanitizePlainText(payload?.name || "", 80),
      contact: sanitizePlainText(payload?.contact || "", 120),
      topic: sanitizePlainText(payload?.topic || "", 80),
      message: sanitizePlainText(payload?.message || "", 1200)
    });
    localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(items));
  }

  function initCartBadge() {
    updateCartBadge();
    updateFavouritesBadge();

    window.addEventListener("storage", (event) => {
      if (!event.key || event.key === CART_STORAGE_KEY || event.key === FAV_STORAGE_KEY) {
        updateCartBadge();
        updateFavouritesBadge();
      }
    });
  }

  function initCartBadgeAutoUpdate() {
    if (window.__prodomBadgeHooked) return;
    window.__prodomBadgeHooked = true;

    const originalSetItem = localStorage.setItem.bind(localStorage);
    const originalRemoveItem = localStorage.removeItem.bind(localStorage);

    localStorage.setItem = (key, value) => {
      originalSetItem(key, value);
      if (key === CART_STORAGE_KEY) {
        updateCartBadge();
      }
      if (key === FAV_STORAGE_KEY) {
        updateFavouritesBadge();
      }
    };

    localStorage.removeItem = (key) => {
      originalRemoveItem(key);
      if (key === CART_STORAGE_KEY) {
        updateCartBadge();
      }
      if (key === FAV_STORAGE_KEY) {
        updateFavouritesBadge();
      }
    };

    document.addEventListener("cart:updated", updateCartBadge);
    document.addEventListener("favourites:updated", updateFavouritesBadge);
  }

  function readCartSafe() {
    try {
      const raw = localStorage.getItem(CART_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function readFavouritesSafe() {
    try {
      const raw = localStorage.getItem(FAV_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveFavouritesSafe(items) {
    localStorage.setItem(FAV_STORAGE_KEY, JSON.stringify(items));
    document.dispatchEvent(new Event("favourites:updated"));
  }

  function saveCartSafe(cart) {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    document.dispatchEvent(new Event("cart:updated"));
  }

  function makeCartItemId(productId) {
    return sanitizeId(productId);
  }

  function addProductToCart(product, quantity) {
    const safeQuantity = Math.max(1, Math.min(99, Number(quantity) || 1));
    const cart = readCartSafe();
    const itemId = makeCartItemId(product.id);
    const existing = cart.find((item) => String(item?.id) === itemId);

    if (existing) {
      existing.quantity = (Number(existing.quantity) || 0) + safeQuantity;
    } else {
      cart.push({
        id: itemId,
        baseId: itemId,
        name: sanitizePlainText(product.name || "Товар", 120),
        description: sanitizePlainText(product.description || "", 400),
        price: Number(product.price) || 0,
        category: sanitizePlainText(product.category || "", 80),
        image: normalizeImagePath(product.image),
        quantity: safeQuantity
      });
    }

    saveCartSafe(cart);
    showNotification("Товар добавлен в корзину", "success");
  }

  function updateCartItemQuantity(product, nextQuantity) {
    const quantity = Number(nextQuantity) || 0;
    const cart = readCartSafe();
    const itemId = makeCartItemId(product.id);
    const itemIndex = cart.findIndex((item) => String(item?.id) === itemId);

    if (quantity <= 0) {
      if (itemIndex >= 0) {
        cart.splice(itemIndex, 1);
        saveCartSafe(cart);
      }
      return;
    }

    if (itemIndex >= 0) {
      cart[itemIndex].quantity = Math.min(99, quantity);
    } else {
      cart.push({
        id: itemId,
        baseId: itemId,
        name: sanitizePlainText(product.name || "Товар", 120),
        description: sanitizePlainText(product.description || "", 400),
        price: Number(product.price) || 0,
        category: sanitizePlainText(product.category || "", 80),
        image: normalizeImagePath(product.image),
        quantity: Math.min(99, quantity)
      });
    }

    saveCartSafe(cart);
  }

  function getCartItemQuantity(productId) {
    const id = makeCartItemId(productId);
    const cart = readCartSafe();
    const item = cart.find((entry) => String(entry?.id) === id);
    return Math.max(0, Number(item?.quantity) || 0);
  }

  function isFavourite(productId) {
    const id = makeCartItemId(productId);
    const favourites = readFavouritesSafe();
    return favourites.some((item) => String(item?.id) === id);
  }

  function toggleFavourite(product) {
    const favourites = readFavouritesSafe();
    const id = makeCartItemId(product.id);
    const index = favourites.findIndex((item) => String(item?.id) === id);

    if (index >= 0) {
      favourites.splice(index, 1);
      saveFavouritesSafe(favourites);
      showNotification("Удалено из избранного", "info");
      return;
    }

    favourites.push({
      id,
      baseId: id,
      name: sanitizePlainText(product.name || "Товар", 120),
      description: sanitizePlainText(product.description || "", 400),
      price: Number(product.price) || 0,
      category: sanitizePlainText(product.category || "", 80),
      image: normalizeImagePath(product.image)
    });

    saveFavouritesSafe(favourites);
    showNotification("Добавлено в избранное", "success");
  }

  function updateCartBadge() {
    const count = readCartSafe().reduce((sum, item) => {
      return sum + Math.max(0, Number(item?.quantity) || 0);
    }, 0);

    document.querySelectorAll(".cart-count").forEach((badge) => {
      badge.textContent = String(count);
    });
  }

  function updateFavouritesBadge() {
    const count = readFavouritesSafe().length;
    document.querySelectorAll(".fav-count").forEach((badge) => {
      badge.textContent = String(count);
    });
  }

  function showNotification(message, type) {
    ensureNotificationStyle();

    const existing = document.querySelector(".notification");
    if (existing) existing.remove();

    const notification = document.createElement("div");
    notification.className = `notification notification-${type || "info"}`;
    const text = document.createElement("span");
    text.className = "notification-message";
    text.textContent = sanitizePlainText(message || "", 200);

    const closeBtn = document.createElement("button");
    closeBtn.className = "notification-close";
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "Закрыть");
    closeBtn.textContent = "×";

    notification.appendChild(text);
    notification.appendChild(closeBtn);

    document.body.appendChild(notification);

    const close = () => {
      notification.style.animation = "slideOut 0.2s ease";
      setTimeout(() => notification.remove(), 200);
    };

    closeBtn?.addEventListener("click", close);
    setTimeout(close, 3000);
  }

  function ensureNotificationStyle() {
    if (document.getElementById("prodom-notification-style")) return;

    const style = document.createElement("style");
    style.id = "prodom-notification-style";
    style.textContent = `
      .notification {
        position: fixed;
        top: 96px;
        right: 20px;
        z-index: 10000;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        border-radius: 10px;
        color: #fff;
        background: #5fa8d3;
        box-shadow: 0 8px 24px rgba(0,0,0,0.18);
        animation: slideIn 0.2s ease;
      }

      .notification-success { background: #2e7d32; }
      .notification-error { background: #c62828; }
      .notification-info { background: #1565c0; }

      .notification-close {
        background: transparent;
        border: 0;
        color: #fff;
        font-size: 20px;
        line-height: 1;
        cursor: pointer;
      }

      @keyframes slideIn {
        from { transform: translateX(20px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }

      @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(20px); opacity: 0; }
      }
    `;

    document.head.appendChild(style);
  }

  window.PROdom = {
    addProductToCart,
    parsePrice,
    showNotification,
    updateCartBadge,
    updateFavouritesBadge,
    readCartSafe,
    saveCartSafe,
    readFavouritesSafe,
    saveFavouritesSafe,
    toggleFavourite,
    isFavourite,
    normalizeImagePath,
    readAdminCatalogSafe,
    readJsonCatalogSafe,
    loadCatalogData,
    readFeedbackSafe,
    submitFeedback,
    resolveImageForCurrentPage,
    updateCartItemQuantity,
    getCartItemQuantity,
    initProductCards
  };
})();
