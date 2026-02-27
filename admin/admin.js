
(function () {
  const STORAGE_KEY = "prodom_admin_v1";
  const ORDER_STORAGE_KEY = "prodom_orders_v1";
  const FEEDBACK_STORAGE_KEY = "prodom_feedback_v1";
  const FALLBACK_IMAGE =
    "data:image/svg+xml;charset=UTF-8," +
    encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="100%" height="100%" fill="#eef4ff"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#5f78a4" font-family="Arial" font-size="28">No photo</text></svg>');

  const state = loadState();

  const categoryLimitInput = document.getElementById("category-limit");
  const newCategoryInput = document.getElementById("new-category");
  const addCategoryBtn = document.getElementById("add-category");
  const categoryCounter = document.getElementById("category-counter");
  const categoryList = document.getElementById("category-list");
  const categoryStatus = document.getElementById("category-status");
  const productForm = document.getElementById("product-form");
  const productIdInput = document.getElementById("product-id");
  const productNameInput = document.getElementById("product-name");
  const productCategorySelect = document.getElementById("product-category");
  const productPriceInput = document.getElementById("product-price");
  const productDescriptionInput = document.getElementById("product-description");
  const productPhotoInput = document.getElementById("product-photo");
  const photoPreview = document.getElementById("photo-preview");
  const cancelEditBtn = document.getElementById("cancel-edit");
  const productStatus = document.getElementById("product-status");
  const productsGrid = document.getElementById("products-grid");
  const resetAllBtn = document.getElementById("reset-all");
  const importBtn = document.getElementById("import-data");
  const importFileInput = document.getElementById("import-data-file");
  const exportBtn = document.getElementById("export-data");
  const ordersList = document.getElementById("orders-list");
  const ordersCount = document.getElementById("orders-count");
  const clearOrdersBtn = document.getElementById("clear-orders");
  const feedbackList = document.getElementById("feedback-list");
  const feedbackCount = document.getElementById("feedback-count");
  const clearFeedbackBtn = document.getElementById("clear-feedback");

  const saveSettingsBtn = document.getElementById("save-settings");
  const settingsStatus = document.getElementById("settings-status");
  const settingBrandName = document.getElementById("setting-brand-name");
  const settingSupportPhone = document.getElementById("setting-support-phone");
  const settingSupportEmail = document.getElementById("setting-support-email");
  const settingHeroTitle = document.getElementById("setting-hero-title");
  const settingHeroSubtitle = document.getElementById("setting-hero-subtitle");
  const settingNewsletterTitle = document.getElementById("setting-newsletter-title");
  const settingNewsletterNote = document.getElementById("setting-newsletter-note");
  const settingOrderStatuses = document.getElementById("setting-order-statuses");
  const settingDefaultOrderStatus = document.getElementById("setting-default-order-status");
  const settingPaymentMethods = document.getElementById("setting-payment-methods");
  const settingDeliveryMethods = document.getElementById("setting-delivery-methods");
  const settingContactTopics = document.getElementById("setting-contact-topics");
  const settingCatalogPageSize = document.getElementById("setting-catalog-page-size");

  let pendingPhotoData = "";

  init();

  function init() {
    bindEvents();
    ensureOrdersHaveStatus();
    renderAll();
  }

  function bindEvents() {
    categoryLimitInput?.addEventListener("change", onCategoryLimitChange);
    addCategoryBtn?.addEventListener("click", onAddCategory);
    productPhotoInput?.addEventListener("change", onPhotoChange);
    productForm?.addEventListener("submit", onSaveProduct);
    cancelEditBtn?.addEventListener("click", resetProductForm);
    productsGrid?.addEventListener("click", onProductsGridClick);
    resetAllBtn?.addEventListener("click", onResetAll);
    importBtn?.addEventListener("click", () => importFileInput?.click());
    importFileInput?.addEventListener("change", onImportJson);
    exportBtn?.addEventListener("click", onExport);
    clearOrdersBtn?.addEventListener("click", onClearOrders);
    clearFeedbackBtn?.addEventListener("click", onClearFeedback);
    saveSettingsBtn?.addEventListener("click", onSaveSettings);
    settingOrderStatuses?.addEventListener("input", syncDefaultStatusSelectFromTextarea);
  }

  function renderAll() {
    renderSettings();
    renderCategories();
    renderCategorySelect();
    renderProducts();
    renderOrders();
    renderFeedback();
    if (photoPreview) photoPreview.src = FALLBACK_IMAGE;
  }

  function renderSettings() {
    const settings = state.settings;
    settingBrandName.value = settings.brandName || "";
    settingSupportPhone.value = settings.supportPhone || "";
    settingSupportEmail.value = settings.supportEmail || "";
    settingHeroTitle.value = settings.heroTitle || "";
    settingHeroSubtitle.value = settings.heroSubtitle || "";
    settingNewsletterTitle.value = settings.newsletterTitle || "";
    settingNewsletterNote.value = settings.newsletterNote || "";
    settingOrderStatuses.value = settings.orderStatuses.join("\n");
    settingPaymentMethods.value = settings.paymentMethods.join("\n");
    settingDeliveryMethods.value = settings.deliveryMethods.join("\n");
    settingContactTopics.value = settings.contactTopics.join("\n");
    settingCatalogPageSize.value = settings.catalogPageSizeOptions.join(",");
    syncDefaultStatusSelectFromTextarea(settings.defaultOrderStatus);
  }

  function onSaveSettings() {
    const orderStatuses = readLines(settingOrderStatuses.value, 20);
    const paymentMethods = readLines(settingPaymentMethods.value, 20);
    const deliveryMethods = readLines(settingDeliveryMethods.value, 20);
    const contactTopics = readLines(settingContactTopics.value, 30);
    const pageSizeOptions = readNumberList(settingCatalogPageSize.value, 20, 1, 60);

    if (!orderStatuses.length) return showStatus(settingsStatus, "warn", "Add at least one order status.");
    if (!paymentMethods.length || !deliveryMethods.length) {
      return showStatus(settingsStatus, "warn", "Add at least one payment and delivery method.");
    }

    state.settings = normalizeSettings({
      brandName: sanitizePlainText(settingBrandName.value || "", 80),
      supportPhone: sanitizePlainText(settingSupportPhone.value || "", 80),
      supportEmail: sanitizePlainText(settingSupportEmail.value || "", 120),
      heroTitle: sanitizePlainText(settingHeroTitle.value || "", 160),
      heroSubtitle: sanitizePlainText(settingHeroSubtitle.value || "", 260),
      newsletterTitle: sanitizePlainText(settingNewsletterTitle.value || "", 140),
      newsletterNote: sanitizePlainText(settingNewsletterNote.value || "", 220),
      orderStatuses,
      defaultOrderStatus: resolveDefaultStatus(orderStatuses, settingDefaultOrderStatus.value),
      paymentMethods,
      deliveryMethods,
      contactTopics,
      catalogPageSizeOptions: pageSizeOptions
    });

    ensureOrdersHaveStatus();
    saveState();
    renderSettings();
    renderOrders();
    showStatus(settingsStatus, "ok", "Settings saved.");
  }

  function syncDefaultStatusSelectFromTextarea(preferredValue) {
    const statuses = readLines(settingOrderStatuses.value, 20);
    const available = statuses.length ? statuses : makeDefaultSettings().orderStatuses;
    const preferred = String(preferredValue || settingDefaultOrderStatus.value || "").trim();
    settingDefaultOrderStatus.innerHTML = "";
    available.forEach((status) => {
      const option = document.createElement("option");
      option.value = status;
      option.textContent = status;
      settingDefaultOrderStatus.appendChild(option);
    });
    settingDefaultOrderStatus.value = resolveDefaultStatus(available, preferred);
  }
  function onCategoryLimitChange() {
    const raw = Number(categoryLimitInput.value);
    const nextLimit = clamp(Math.trunc(raw || 0), 1, 50);

    if (nextLimit < state.categories.length) {
      const dropCount = state.categories.length - nextLimit;
      const confirmed = window.confirm(`Limit is lower than current count. Remove last ${dropCount} categories?`);
      if (!confirmed) {
        categoryLimitInput.value = String(state.categoryLimit);
        return;
      }
      state.categories = state.categories.slice(0, nextLimit);
    }

    state.categoryLimit = nextLimit;
    saveState();
    renderCategories();
    renderCategorySelect();
    showStatus(categoryStatus, "ok", "Category limit updated.");
  }

  function onAddCategory() {
    const title = normalizeCategoryTitle(newCategoryInput.value);
    if (!title) return showStatus(categoryStatus, "warn", "Enter category name.");
    if (state.categories.length >= state.categoryLimit) return showStatus(categoryStatus, "warn", "Category limit reached.");
    if (state.categories.some((item) => item.toLowerCase() === title.toLowerCase())) {
      return showStatus(categoryStatus, "warn", "Category already exists.");
    }

    state.categories.push(title);
    newCategoryInput.value = "";
    saveState();
    renderCategories();
    renderCategorySelect();
    showStatus(categoryStatus, "ok", "Category added.");
  }

  function onRemoveCategory(categoryName) {
    const usedByProducts = state.products.some((product) => product.category === categoryName);
    if (usedByProducts) return showStatus(categoryStatus, "warn", "Cannot remove category used by products.");
    state.categories = state.categories.filter((name) => name !== categoryName);
    saveState();
    renderCategories();
    renderCategorySelect();
    showStatus(categoryStatus, "ok", "Category removed.");
  }

  function onEditCategory(categoryName) {
    const current = normalizeCategoryTitle(categoryName);
    if (!current) return;

    const nextRaw = window.prompt("Edit category name", current);
    if (nextRaw === null) return;

    const next = normalizeCategoryTitle(nextRaw);
    if (!next) return showStatus(categoryStatus, "warn", "Enter category name.");
    if (next.toLowerCase() !== current.toLowerCase()) {
      const exists = state.categories.some((item) => item.toLowerCase() === next.toLowerCase());
      if (exists) return showStatus(categoryStatus, "warn", "Category already exists.");
    }

    if (next === current) return;

    state.categories = state.categories.map((item) => (item === current ? next : item));
    state.products = state.products.map((product) => {
      if (String(product?.category || "").trim() !== current) return product;
      return { ...product, category: next };
    });

    saveState();
    renderCategories();
    renderCategorySelect();
    renderProducts();
    showStatus(categoryStatus, "ok", "Category updated.");
  }

  async function onPhotoChange() {
    const file = productPhotoInput.files && productPhotoInput.files[0];
    if (!file) {
      pendingPhotoData = "";
      photoPreview.src = FALLBACK_IMAGE;
      return;
    }
    try {
      pendingPhotoData = await fileToDataUrl(file);
      photoPreview.src = pendingPhotoData;
    } catch {
      pendingPhotoData = "";
      photoPreview.src = FALLBACK_IMAGE;
      showStatus(productStatus, "warn", "Cannot read image.");
    }
  }

  function onSaveProduct(event) {
    event.preventDefault();

    if (!state.categories.length) return showStatus(productStatus, "warn", "Add at least one category first.");

    const id = sanitizeId(productIdInput.value || "");
    const name = sanitizePlainText(productNameInput.value || "", 120);
    const category = String(productCategorySelect.value || "").trim();
    const price = Math.max(0, Number(productPriceInput.value || 0));
    const description = sanitizePlainText(productDescriptionInput.value || "", 400);

    if (!name || !category || !Number.isFinite(price)) return showStatus(productStatus, "warn", "Fill required fields.");

    let photo = pendingPhotoData;
    if (!photo && id) {
      const current = state.products.find((item) => item.id === id);
      photo = current ? current.photo : "";
    }

    const product = { id: id || makeId(), name, category, price: Math.round(price), description, photo: photo || "" };
    const index = state.products.findIndex((item) => item.id === product.id);

    if (index >= 0) {
      state.products[index] = product;
      showStatus(productStatus, "ok", "Product updated.");
    } else {
      state.products.unshift(product);
      showStatus(productStatus, "ok", "Product added.");
    }

    saveState();
    renderProducts();
    resetProductForm();
  }

  function onProductsGridClick(event) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const actionBtn = target.closest("button[data-action]");
    if (!actionBtn) return;

    const id = String(actionBtn.dataset.id || "");
    const action = String(actionBtn.dataset.action || "");
    if (!id || !action) return;

    if (action === "edit") startEdit(id);

    if (action === "delete") {
      if (!window.confirm("Delete product?")) return;
      state.products = state.products.filter((item) => item.id !== id);
      saveState();
      renderProducts();
      showStatus(productStatus, "ok", "Product deleted.");
    }
  }

  function startEdit(id) {
    const product = state.products.find((item) => item.id === id);
    if (!product) return;
    productIdInput.value = product.id;
    productNameInput.value = product.name;
    productCategorySelect.value = product.category;
    productPriceInput.value = String(product.price);
    productDescriptionInput.value = product.description || "";
    pendingPhotoData = product.photo || "";
    photoPreview.src = pendingPhotoData || FALLBACK_IMAGE;
    productPhotoInput.value = "";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetProductForm() {
    productForm.reset();
    productIdInput.value = "";
    pendingPhotoData = "";
    photoPreview.src = FALLBACK_IMAGE;
  }
  function renderCategories() {
    categoryLimitInput.value = String(state.categoryLimit);
    categoryCounter.textContent = `${state.categories.length} / ${state.categoryLimit}`;
    addCategoryBtn.disabled = state.categories.length >= state.categoryLimit;
    categoryList.innerHTML = "";

    if (!state.categories.length) {
      const empty = document.createElement("li");
      empty.className = "empty";
      empty.textContent = "No categories yet.";
      categoryList.appendChild(empty);
      return;
    }

    state.categories.forEach((name) => {
      const li = document.createElement("li");
      li.className = "category-item";
      li.innerHTML = `
        <span>${escapeHtml(name)}</span>
        <div style="display:flex; gap:6px; flex-wrap:wrap;">
          <button class="btn btn-soft" type="button" data-edit-category="${escapeHtml(name)}">Edit</button>
          <button class="btn btn-danger" type="button" data-remove-category="${escapeHtml(name)}">Delete</button>
        </div>
      `;
      categoryList.appendChild(li);
    });

    categoryList.querySelectorAll("button[data-edit-category]").forEach((btn) => {
      btn.addEventListener("click", () => onEditCategory(btn.dataset.editCategory || ""));
    });

    categoryList.querySelectorAll("button[data-remove-category]").forEach((btn) => {
      btn.addEventListener("click", () => onRemoveCategory(btn.dataset.removeCategory || ""));
    });
  }

  function renderCategorySelect() {
    const prev = productCategorySelect.value;
    productCategorySelect.innerHTML = "";

    if (!state.categories.length) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "Add category first";
      productCategorySelect.appendChild(option);
      return;
    }

    state.categories.forEach((name) => {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      productCategorySelect.appendChild(option);
    });

    if (state.categories.includes(prev)) productCategorySelect.value = prev;
  }

  function renderProducts() {
    productsGrid.innerHTML = "";

    if (!state.products.length) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = "No products yet.";
      productsGrid.appendChild(empty);
      return;
    }

    state.products.forEach((product) => {
      const card = document.createElement("article");
      card.className = "card";
      card.innerHTML = `
        <img class="thumb" src="${product.photo || FALLBACK_IMAGE}" alt="${escapeHtml(product.name)}">
        <div class="meta">
          <h3>${escapeHtml(product.name)}</h3>
          <span class="chip">${escapeHtml(product.category)}</span>
          <p class="price">${formatPrice(product.price)}</p>
          <p>${escapeHtml(product.description || "No description")}</p>
        </div>
        <div class="card-actions">
          <button class="btn btn-soft" type="button" data-action="edit" data-id="${product.id}">Edit</button>
          <button class="btn btn-danger" type="button" data-action="delete" data-id="${product.id}">Delete</button>
        </div>
      `;
      productsGrid.appendChild(card);
    });
  }

  function onResetAll() {
    if (!window.confirm("Delete all categories, products and settings?")) return;
    localStorage.removeItem(STORAGE_KEY);
    const fresh = makeDefaultState();
    state.categoryLimit = fresh.categoryLimit;
    state.categories = fresh.categories;
    state.products = fresh.products;
    state.settings = fresh.settings;
    resetProductForm();
    saveState();
    renderAll();
    showStatus(categoryStatus, "ok", "Data reset.");
    showStatus(productStatus, "ok", "Data reset.");
  }

  function onExport() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "prodom-admin-data.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function onImportJson(event) {
    const input = event.target;
    const file = input.files && input.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const normalized = normalizeImportedCatalog(payload);
      if (!normalized.products.length) return showStatus(productStatus, "warn", "JSON has no valid products.");
      state.products = normalized.products;
      state.categories = normalized.categories.length
        ? normalized.categories.slice(0, 50)
        : extractCategoriesFromProducts(normalized.products).slice(0, 50);
      state.categoryLimit = clamp(Math.max(state.categoryLimit, state.categories.length), 1, 50);
      state.settings = normalized.settings;
      ensureOrdersHaveStatus();
      saveState();
      renderAll();
      showStatus(productStatus, "ok", "JSON imported.");
      showStatus(categoryStatus, "ok", "Categories updated.");
    } catch {
      showStatus(productStatus, "warn", "Cannot read JSON file.");
    } finally {
      input.value = "";
    }
  }
  function onClearOrders() {
    if (!window.confirm("Delete all orders?")) return;
    localStorage.removeItem(ORDER_STORAGE_KEY);
    renderOrders();
    showStatus(productStatus, "ok", "Orders cleared.");
  }

  function onClearFeedback() {
    if (!window.confirm("Delete all feedback?")) return;
    localStorage.removeItem(FEEDBACK_STORAGE_KEY);
    renderFeedback();
    showStatus(categoryStatus, "ok", "Feedback cleared.");
  }

  function renderOrders() {
    if (!ordersList || !ordersCount) return;

    const orders = readOrders();
    const availableStatuses = state.settings.orderStatuses;
    ordersCount.textContent = `${orders.length}`;
    ordersList.innerHTML = "";

    if (!orders.length) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = "No orders yet.";
      ordersList.appendChild(empty);
      return;
    }

    orders.forEach((order) => {
      const title = String(order?.id || "No number");
      const createdAt = formatDate(order?.createdAt);
      const customerName = String(order?.customer?.fullName || "No name");
      const customerEmail = String(order?.customer?.email || "-");
      const customerPhone = String(order?.customer?.phone || "-");
      const total = formatPrice(order?.total || 0);
      const status = sanitizePlainText(order?.status || "", 80) || state.settings.defaultOrderStatus;
      const items = Array.isArray(order?.items) ? order.items : [];
      const itemLines = items.map((item) => {
        const name = escapeHtml(item?.name || "Product");
        const qty = Math.max(1, Number(item?.quantity) || 1);
        const lineTotal = formatPrice(item?.total || (Number(item?.price) || 0) * qty);
        return `<li>${name} x ${qty} - ${lineTotal}</li>`;
      }).join("");

      const card = document.createElement("article");
      card.className = "order-card";
      card.innerHTML = `
        <div class="order-card-top">
          <h3 class="order-card-title">Order ${escapeHtml(title)}</h3>
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <span class="chip">${escapeHtml(total)}</span>
            <select class="order-status-select" data-order-id="${escapeHtml(title)}">
              ${availableStatuses.map((item) => `<option value="${escapeHtml(item)}"${item === status ? " selected" : ""}>${escapeHtml(item)}</option>`).join("")}
            </select>
          </div>
        </div>
        <p class="order-card-meta">
          <span>Date: ${escapeHtml(createdAt)}</span>
          <span>Customer: ${escapeHtml(customerName)}</span>
          <span>Email: ${escapeHtml(customerEmail)}</span>
          <span>Phone: ${escapeHtml(customerPhone)}</span>
          <span>Status: ${escapeHtml(status)}</span>
        </p>
        <ol class="order-items">${itemLines || "<li>Order items unavailable</li>"}</ol>
      `;

      ordersList.appendChild(card);
    });

    ordersList.querySelectorAll(".order-status-select").forEach((node) => {
      node.addEventListener("change", onOrderStatusChange);
    });
  }

  function onOrderStatusChange(event) {
    const node = event.target;
    if (!(node instanceof HTMLSelectElement)) return;
    const orderId = sanitizePlainText(node.dataset.orderId || "", 120);
    const nextStatus = sanitizePlainText(node.value || "", 80);
    if (!orderId || !nextStatus) return;

    const orders = readOrders();
    const targetOrder = orders.find((item) => String(item?.id || "") === orderId);
    if (!targetOrder) return;
    targetOrder.status = nextStatus;
    writeOrders(orders);
    showStatus(productStatus, "ok", "Order status updated.");
  }

  function renderFeedback() {
    if (!feedbackList || !feedbackCount) return;
    const feedback = readFeedback();
    feedbackCount.textContent = `${feedback.length}`;
    feedbackList.innerHTML = "";

    if (!feedback.length) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = "No messages yet.";
      feedbackList.appendChild(empty);
      return;
    }

    feedback.forEach((item) => {
      const card = document.createElement("article");
      card.className = "feedback-item";
      const date = formatDate(item?.createdAt);
      card.innerHTML = `<p><strong>${escapeHtml(item?.topic || "No topic")}</strong></p><p>Date: ${escapeHtml(date)}</p><p>Name: ${escapeHtml(item?.name || "-")}</p><p>Contact: ${escapeHtml(item?.contact || "-")}</p><p>Message: ${escapeHtml(item?.message || "-")}</p>`;
      feedbackList.appendChild(card);
    });
  }

  function showStatus(node, type, text) {
    if (!node) return;
    node.className = `status show ${type}`;
    node.textContent = text;
    window.clearTimeout(node._hideTimer);
    node._hideTimer = window.setTimeout(() => { node.className = "status"; }, 2600);
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function readOrders() {
    try {
      const raw = localStorage.getItem(ORDER_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      const orders = Array.isArray(parsed) ? parsed : [];
      return orders.map((order) => normalizeOrderWithSettings(order));
    } catch {
      return [];
    }
  }

  function writeOrders(orders) {
    localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(Array.isArray(orders) ? orders : []));
  }

  function readFeedback() {
    try {
      const raw = localStorage.getItem(FEEDBACK_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  function ensureOrdersHaveStatus() {
    const orders = readOrders();
    let changed = false;
    const normalized = orders.map((order) => {
      const next = normalizeOrderWithSettings(order);
      if ((order?.status || "") !== next.status) changed = true;
      return next;
    });
    if (changed) writeOrders(normalized);
  }

  function normalizeOrderWithSettings(order) {
    const safe = order && typeof order === "object" ? order : {};
    const statuses = state.settings.orderStatuses;
    const rawStatus = sanitizePlainText(safe.status || "", 80);
    const status = statuses.includes(rawStatus) ? rawStatus : state.settings.defaultOrderStatus;
    return { ...safe, status };
  }

  function normalizeImportedCatalog(payload) {
    const categoriesRaw = Array.isArray(payload?.categories) ? payload.categories : [];
    const productsRaw = Array.isArray(payload?.products) ? payload.products : Array.isArray(payload) ? payload : [];
    const settingsRaw = payload?.settings && typeof payload.settings === "object" ? payload.settings : {};

    const categories = categoriesRaw.map((item) => normalizeCategoryTitle(item)).filter(Boolean);
    const products = productsRaw
      .filter((item) => item && typeof item === "object")
      .map((item) => ({
        id: sanitizeId(item.id || makeId()),
        name: sanitizePlainText(item.name || "", 120),
        category: normalizeCategoryTitle(item.category || ""),
        price: Math.max(0, Number(item.price) || 0),
        description: sanitizePlainText(item.description || "", 400),
        photo: String(item.photo || "")
      }))
      .filter((item) => item.name && item.category);

    return { categories, products, settings: normalizeSettings(settingsRaw) };
  }

  function extractCategoriesFromProducts(products) {
    const set = new Set();
    products.forEach((item) => {
      const category = normalizeCategoryTitle(item?.category || "");
      if (category) set.add(category);
    });
    return Array.from(set);
  }

  function loadState() {
    const fallback = makeDefaultState();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);

      const categories = Array.isArray(parsed.categories)
        ? parsed.categories.map((value) => normalizeCategoryTitle(value)).filter(Boolean)
        : fallback.categories;
      const categoryLimit = clamp(Number(parsed.categoryLimit) || 0, 1, 50);
      const products = Array.isArray(parsed.products)
        ? parsed.products
            .filter((item) => item && typeof item === "object")
            .map((item) => ({
              id: sanitizeId(item.id || makeId()),
              name: sanitizePlainText(item.name || "", 120),
              category: String(item.category || "").trim(),
              price: Math.max(0, Number(item.price) || 0),
              description: sanitizePlainText(item.description || "", 400),
              photo: String(item.photo || "")
            }))
            .filter((item) => item.name && item.category)
        : fallback.products;

      return {
        categoryLimit,
        categories: categories.slice(0, categoryLimit),
        products,
        settings: normalizeSettings(parsed.settings || {})
      };
    } catch {
      return fallback;
    }
  }

  function makeDefaultState() {
    return {
      categoryLimit: 5,
      categories: ["Сантехника", "Электроприборы", "Стройматериалы", "Товары для дома", "Инструменты"],
      products: [],
      settings: makeDefaultSettings()
    };
  }

  function makeDefaultSettings() {
    return {
      brandName: "PROdom",
      supportPhone: "+7 (000) 000-00-00",
      supportEmail: "info@prodom.ru",
      heroTitle: "Все для дома — в одном месте",
      heroSubtitle: "Качественные хозяйственные товары и инструменты для вашего комфорта.",
      newsletterTitle: "Готовы узнавать о новинках?",
      newsletterNote: "Мы создаём комфорт и уют вместе с вами.",
      orderStatuses: ["Новый", "Подтвержден", "В доставке", "Выполнен", "Отменен"],
      defaultOrderStatus: "Новый",
      paymentMethods: ["Карта онлайн", "Наличные при получении"],
      deliveryMethods: ["Доставка", "Самовывоз"],
      contactTopics: ["Вопрос по товару", "Доставка", "Сотрудничество", "Другое"],
      catalogPageSizeOptions: [8, 12, 16, 24]
    };
  }

  function normalizeSettings(raw) {
    const defaults = makeDefaultSettings();
    const parsed = raw && typeof raw === "object" ? raw : {};
    const orderStatuses = readLines(parsed.orderStatuses, 20, defaults.orderStatuses);
    const paymentMethods = readLines(parsed.paymentMethods, 20, defaults.paymentMethods);
    const deliveryMethods = readLines(parsed.deliveryMethods, 20, defaults.deliveryMethods);
    const contactTopics = readLines(parsed.contactTopics, 30, defaults.contactTopics);
    const catalogPageSizeOptions = readNumberList(parsed.catalogPageSizeOptions, 20, 1, 60, defaults.catalogPageSizeOptions);

    return {
      brandName: sanitizePlainText(parsed.brandName || defaults.brandName, 80),
      supportPhone: sanitizePlainText(parsed.supportPhone || defaults.supportPhone, 80),
      supportEmail: sanitizePlainText(parsed.supportEmail || defaults.supportEmail, 120),
      heroTitle: sanitizePlainText(parsed.heroTitle || defaults.heroTitle, 160),
      heroSubtitle: sanitizePlainText(parsed.heroSubtitle || defaults.heroSubtitle, 260),
      newsletterTitle: sanitizePlainText(parsed.newsletterTitle || defaults.newsletterTitle, 140),
      newsletterNote: sanitizePlainText(parsed.newsletterNote || defaults.newsletterNote, 220),
      orderStatuses,
      defaultOrderStatus: resolveDefaultStatus(orderStatuses, parsed.defaultOrderStatus || defaults.defaultOrderStatus),
      paymentMethods,
      deliveryMethods,
      contactTopics,
      catalogPageSizeOptions
    };
  }
  function resolveDefaultStatus(statuses, value) {
    const normalizedStatuses = Array.isArray(statuses) ? statuses.filter(Boolean) : [];
    if (!normalizedStatuses.length) return "Новый";
    const next = sanitizePlainText(value || "", 80);
    return normalizedStatuses.includes(next) ? next : normalizedStatuses[0];
  }

  function readLines(value, maxItems, fallback) {
    const list = Array.isArray(value) ? value : String(value || "").split(/\r?\n/).map((item) => item.trim());
    const unique = [];

    list.forEach((entry) => {
      const clean = sanitizePlainText(entry || "", 80);
      if (!clean) return;
      if (unique.some((item) => item.toLowerCase() === clean.toLowerCase())) return;
      if (unique.length >= Math.max(1, Number(maxItems) || 20)) return;
      unique.push(clean);
    });

    if (unique.length) return unique;
    return Array.isArray(fallback) && fallback.length ? fallback.slice() : [];
  }

  function readNumberList(value, maxItems, min, max, fallback) {
    const raw = Array.isArray(value) ? value : String(value || "").split(/[\s,;]+/).map((item) => item.trim());
    const unique = [];

    raw.forEach((entry) => {
      const number = Number(entry);
      if (!Number.isFinite(number)) return;
      const safe = clamp(Math.round(number), min, max);
      if (unique.includes(safe)) return;
      if (unique.length >= Math.max(1, Number(maxItems) || 20)) return;
      unique.push(safe);
    });

    if (unique.length) return unique;
    return Array.isArray(fallback) && fallback.length ? fallback.slice() : [];
  }

  function normalizeCategoryTitle(value) {
    const text = String(value || "").trim().replace(/\s+/g, " ");
    if (!text) return "";
    return text.charAt(0).toUpperCase() + text.slice(1);
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
    const text = String(value || "")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9\u0400-\u04FF_:-]/gi, "")
      .slice(0, 120);
    return text || makeId();
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function makeId() {
    return `p_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  }

  function formatPrice(price) {
    return `${new Intl.NumberFormat("ru-RU").format(Math.round(Number(price) || 0))} ₽`;
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return new Intl.DateTimeFormat("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
})();
