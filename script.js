(function () {
  const CART_STORAGE_KEY = "cart";
  const FAV_STORAGE_KEY = "favourites";

  document.addEventListener("DOMContentLoaded", () => {
    initSmoothScroll();
    initHeaderScroll();
    initSearchFocus();
    initCardHoverEffects();
    initNewsletterForm();
    initProductCards();
    initCartBadge();
    initCartBadgeAutoUpdate();
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

        emailInput.value = "";
        showNotification("Спасибо за подписку", "success");
      });
    });
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
          addProductToCart(product, 1);
        });
      }

      if (!favBtn.dataset.bound) {
        favBtn.dataset.bound = "1";
        favBtn.addEventListener("click", (event) => {
          event.preventDefault();
          toggleFavourite(product);
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
          const currentQty = getCartItemQuantity(product.id);

          if (action === "minus") {
            const nextQty = currentQty - 1;
            updateCartItemQuantity(product, nextQty);
            return;
          }

          if (action === "plus") {
            const nextQty = Math.min(99, currentQty + 1);
            updateCartItemQuantity(product, nextQty);
          }
        });
      }

      syncProductCardState(card, qtyValue, favBtn);
    });

    const syncAll = () => {
      cards.forEach((card) => {
        const qtyValue = card.querySelector(".product-card-qty .card-qty-value");
        const favBtn = card.querySelector(".product-card-actions .fav-btn");
        if (qtyValue) syncProductCardState(card, qtyValue, favBtn);
      });
    };

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

  function buildProductFromCard(card, index) {
    const name = String(card.querySelector("h4")?.textContent || `Товар ${index + 1}`).trim();
    const description = String(card.querySelector("h5")?.textContent || "").trim();
    const price = parsePrice(card.querySelector(".price")?.textContent || "0");
    const category = normalizeCategory(
      card.dataset.category || card.querySelector(".product-category")?.textContent || ""
    );
    const image = normalizeImagePath(card.querySelector("img")?.getAttribute("src"));
    const id = String(card.dataset.productId || slugify(name) || `product-${index + 1}`);

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

  function normalizeImagePath(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    if (raw.startsWith("http")) return raw;
    if (raw.startsWith("/")) return raw.slice(1);
    return raw.startsWith("./") ? raw.slice(2) : raw;
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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
    return String(productId || "").trim();
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
        name: String(product.name || "Товар"),
        description: String(product.description || ""),
        price: Number(product.price) || 0,
        category: String(product.category || ""),
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
        name: String(product.name || "Товар"),
        description: String(product.description || ""),
        price: Number(product.price) || 0,
        category: String(product.category || ""),
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
      name: String(product.name || "Товар"),
      description: String(product.description || ""),
      price: Number(product.price) || 0,
      category: String(product.category || ""),
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
    notification.innerHTML = `
      <span class="notification-message">${String(message || "")}</span>
      <button class="notification-close" type="button" aria-label="Закрыть">&times;</button>
    `;

    document.body.appendChild(notification);

    const close = () => {
      notification.style.animation = "slideOut 0.2s ease";
      setTimeout(() => notification.remove(), 200);
    };

    const closeBtn = notification.querySelector(".notification-close");
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
    updateCartItemQuantity,
    getCartItemQuantity,
    initProductCards
  };
})();
