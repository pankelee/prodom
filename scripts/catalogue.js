(function () {
  const layout = document.querySelector(".catalog-layout");
  if (!layout) return;

  const grid = document.querySelector(".catalog-products .products-grid");
  if (!grid) return;

  const filterPanel = document.querySelector(".catalog-filters");
  const categoryFilterNode = document.getElementById("catalogue-category-filter");
  const priceInputs = filterPanel ? Array.from(filterPanel.querySelectorAll('input[type="number"]')) : [];
  const minPriceInput = priceInputs[0] || null;
  const maxPriceInput = priceInputs[1] || null;
  const searchInput = document.querySelector(".header-actions .input");
  const pageSizeSelect = document.getElementById("catalogue-page-size");
  const paginationNode = document.getElementById("catalogue-pagination");
  const emptyState = ensureEmptyState(grid);

  let cards = [];
  let currentPage = 1;
  let pageSize = Number(pageSizeSelect?.value) || 8;
  let filtered = [];
  let selectedCategory = "";

  bootstrap();

  async function bootstrap() {
    await renderCatalogueFromSources();
    bindEvents();
    applyCategoryFromUrl();
    applyFilters();
  }

  function bindEvents() {
    minPriceInput?.addEventListener("input", applyFilters);
    maxPriceInput?.addEventListener("input", applyFilters);
    searchInput?.addEventListener("input", applyFilters);

    categoryFilterNode?.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const button = target.closest("button[data-category]");
      if (!button) return;
      selectedCategory = normalizeCategory(button.dataset.category || "");
      currentPage = 1;
      highlightCategoryButton();
      applyFilters();
    });

    pageSizeSelect?.addEventListener("change", () => {
      pageSize = Number(pageSizeSelect.value) || 8;
      currentPage = 1;
      applyFilters();
    });

    window.addEventListener("storage", (event) => {
      if (!event.key || event.key === "prodom_admin_v1") {
        renderCatalogueFromSources().then(() => {
          currentPage = 1;
          applyCategoryFromUrl();
          applyFilters();
        });
      }
    });
  }

  async function renderCatalogueFromSources() {
    const merged = await window.PROdom?.loadCatalogData?.();
    const products = Array.isArray(merged?.products) ? merged.products : [];

    if (!products.length) {
      cards = Array.from(grid.querySelectorAll(".product-card"));
      renderCategoryButtons(extractCategoriesFromCards(cards));
      document.dispatchEvent(new Event("products:updated"));
      return;
    }

    const categories = Array.isArray(merged?.categories) && merged.categories.length
      ? merged.categories
      : extractCategoriesFromProducts(products);

    renderCategoryButtons(categories);
    renderCards(products);
    cards = Array.from(grid.querySelectorAll(".product-card"));
    document.dispatchEvent(new Event("products:updated"));
  }

  function renderCards(products) {
    grid.innerHTML = "";
    const fragment = document.createDocumentFragment();

    products.forEach((product, index) => {
      const name = String(product?.name || `Товар ${index + 1}`).trim();
      const description = String(product?.description || "").trim();
      const category = String(product?.category || "").trim();
      const price = Math.max(0, Number(product?.price) || 0);
      const id = String(product?.id || `product-${index + 1}`);
      const image = normalizeImageForCataloguePage(product?.photo);

      const card = document.createElement("div");
      card.className = "product-card";
      card.dataset.category = normalizeCategory(category);
      card.dataset.productId = id;
      card.innerHTML = `
        <img src="${image}" alt="${escapeHtml(name)}">
        <h4>${escapeHtml(name)}</h4>
        <h5>${escapeHtml(description)}</h5>
        <p class="product-category">${escapeHtml(category || "Без категории")}</p>
        <p class="price">${formatPrice(price)}</p>
        <button class="btn-primary">В корзину</button>
      `;
      fragment.appendChild(card);
    });

    grid.appendChild(fragment);
  }

  function renderCategoryButtons(categories) {
    if (!categoryFilterNode) return;
    const normalizedSelected = normalizeCategory(selectedCategory || "");
    categoryFilterNode.innerHTML = "";

    const buttons = [{ label: "Все категории", value: "" }].concat(
      categories.map((category) => ({
        label: String(category || "").trim(),
        value: normalizeCategory(category)
      }))
    );

    const fragment = document.createDocumentFragment();
    buttons.forEach((item) => {
      if (!item.label && item.value) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "catalog-category-btn";
      button.dataset.category = item.value;
      button.textContent = item.label || "Категория";
      if (item.value === normalizedSelected) {
        button.classList.add("is-active");
      }
      fragment.appendChild(button);
    });

    categoryFilterNode.appendChild(fragment);
  }

  function highlightCategoryButton() {
    if (!categoryFilterNode) return;
    const normalizedSelected = normalizeCategory(selectedCategory || "");
    categoryFilterNode.querySelectorAll(".catalog-category-btn").forEach((button) => {
      const value = normalizeCategory(button.dataset.category || "");
      button.classList.toggle("is-active", value === normalizedSelected);
    });
  }

  function applyFilters() {
    const minPrice = minPriceInput ? Number(minPriceInput.value) : 0;
    const maxPrice = maxPriceInput ? Number(maxPriceInput.value) : 0;
    const hasMin = Number.isFinite(minPrice) && minPrice > 0;
    const hasMax = Number.isFinite(maxPrice) && maxPrice > 0;
    const term = String(searchInput?.value || "").trim().toLowerCase();
    const currentCategory = normalizeCategory(selectedCategory);

    filtered = cards.filter((card) => {
      const price = readPrice(card.querySelector(".price")?.textContent || "");
      const title = String(card.querySelector("h4")?.textContent || "").toLowerCase();
      const category = normalizeCategory(card.dataset.category || card.querySelector(".product-category")?.textContent || "");

      if (currentCategory && category !== currentCategory) return false;
      if (hasMin && price < minPrice) return false;
      if (hasMax && price > maxPrice) return false;
      if (term && !title.includes(term)) return false;
      return true;
    });

    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    currentPage = Math.min(currentPage, totalPages);
    if (!filtered.length) currentPage = 1;
    render();
  }

  function render() {
    cards.forEach((card) => {
      card.style.display = "none";
    });

    if (!filtered.length) {
      emptyState.style.display = "block";
      if (paginationNode) paginationNode.innerHTML = "";
      return;
    }

    emptyState.style.display = "none";
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    filtered.slice(start, end).forEach((card) => {
      card.style.display = "";
    });
    renderPagination();
  }

  function renderPagination() {
    if (!paginationNode) return;

    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    paginationNode.innerHTML = "";
    if (totalPages <= 1) return;

    const fragment = document.createDocumentFragment();
    fragment.appendChild(createPaginationButton("<", Math.max(1, currentPage - 1), currentPage === 1, false));

    for (let page = 1; page <= totalPages; page += 1) {
      fragment.appendChild(createPaginationButton(String(page), page, false, page === currentPage));
    }

    fragment.appendChild(
      createPaginationButton(">", Math.min(totalPages, currentPage + 1), currentPage === totalPages, false)
    );
    paginationNode.appendChild(fragment);
  }

  function createPaginationButton(label, page, disabled, active) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `pagination-btn${active ? " is-active" : ""}`;
    btn.textContent = label;

    if (disabled) {
      btn.disabled = true;
      return btn;
    }

    btn.addEventListener("click", () => {
      currentPage = page;
      render();
    });
    return btn;
  }

  function applyCategoryFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const categoryFromUrl = normalizeCategory(params.get("category") || "");
    if (!categoryFromUrl) {
      selectedCategory = "";
      highlightCategoryButton();
      return;
    }

    selectedCategory = categoryFromUrl;
    highlightCategoryButton();
  }

  function extractCategoriesFromProducts(products) {
    const set = new Set();
    products.forEach((item) => {
      const category = String(item?.category || "").trim();
      if (category) set.add(category);
    });
    return Array.from(set);
  }

  function extractCategoriesFromCards(cardNodes) {
    const set = new Set();
    cardNodes.forEach((card) => {
      const category = String(card?.dataset?.category || card.querySelector(".product-category")?.textContent || "").trim();
      if (category) set.add(category);
    });
    return Array.from(set);
  }

  function normalizeImageForCataloguePage(value) {
    const raw = String(value || "").trim();
    if (!raw) return "../images/logo.svg";
    if (raw.startsWith("data:") || raw.startsWith("http")) return raw;
    if (raw.startsWith("/")) return `..${raw}`;
    if (raw.startsWith("../") || raw.startsWith("./")) return raw;
    return `../${raw}`;
  }

  function ensureEmptyState(parent) {
    let node = document.getElementById("catalogue-empty-state");
    if (node) return node;

    node = document.createElement("p");
    node.id = "catalogue-empty-state";
    node.textContent = "По вашему запросу ничего не найдено.";
    node.style.display = "none";
    node.style.marginTop = "12px";
    node.style.color = "#444";
    parent?.appendChild(node);
    return node;
  }

  function readPrice(value) {
    const normalized = String(value || "").replace(/[^\d]/g, "");
    const numeric = Number(normalized);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  function normalizeCategory(value) {
    return String(value || "").trim().toLowerCase();
  }

  function formatPrice(value) {
    return `${new Intl.NumberFormat("ru-RU").format(Math.round(Number(value) || 0))} ₽`;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
})();
