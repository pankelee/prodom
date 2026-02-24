(function () {
  const layout = document.querySelector(".catalog-layout");
  if (!layout) return;

  const grid = document.querySelector(".catalog-products .products-grid");
  if (!grid) return;

  const originalCards = Array.from(grid.querySelectorAll(".product-card"));
  if (!originalCards.length) return;

  duplicateCardsToCount(originalCards, grid, 60);
  document.dispatchEvent(new Event("products:updated"));

  const cards = Array.from(grid.querySelectorAll(".product-card"));

  const filterPanel = document.querySelector(".catalog-filters");
  const categorySelect = document.getElementById("catalogue-category-filter");
  const priceInputs = filterPanel ? Array.from(filterPanel.querySelectorAll('input[type="number"]')) : [];
  const minPriceInput = priceInputs[0] || null;
  const maxPriceInput = priceInputs[1] || null;
  const applyButton = filterPanel?.querySelector(".filter-btn") || null;
  const searchInput = document.querySelector(".header-actions .input");

  const pageSizeSelect = document.getElementById("catalogue-page-size");
  const paginationNode = document.getElementById("catalogue-pagination");

  const emptyState = ensureEmptyState(grid);

  let currentPage = 1;
  let pageSize = Number(pageSizeSelect?.value) || 8;
  let filtered = cards.slice();

  applyCategoryFromUrl();

  const applyFilters = () => {
    const minPrice = minPriceInput ? Number(minPriceInput.value) : 0;
    const maxPrice = maxPriceInput ? Number(maxPriceInput.value) : 0;
    const hasMin = Number.isFinite(minPrice) && minPrice > 0;
    const hasMax = Number.isFinite(maxPrice) && maxPrice > 0;
    const selectedCategory = normalizeCategory(categorySelect?.value || "");
    const term = String(searchInput?.value || "").trim().toLowerCase();

    filtered = cards.filter((card) => {
      const priceText = card.querySelector(".price")?.textContent || "";
      const title = String(card.querySelector("h4")?.textContent || "").toLowerCase();
      const price = readPrice(priceText);
      const category = normalizeCategory(
        card.dataset.category || card.querySelector(".product-category")?.textContent || ""
      );

      if (selectedCategory && category !== selectedCategory) return false;
      if (hasMin && price < minPrice) return false;
      if (hasMax && price > maxPrice) return false;
      if (term && !title.includes(term)) return false;
      return true;
    });

    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    currentPage = Math.min(currentPage, totalPages);
    if (filtered.length === 0) currentPage = 1;

    render();
  };

  const render = () => {
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
  };

  const renderPagination = () => {
    if (!paginationNode) return;

    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    paginationNode.innerHTML = "";

    if (totalPages <= 1) return;

    const fragment = document.createDocumentFragment();

    const createBtn = (label, page, disabled, isActive) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "pagination-btn" + (isActive ? " is-active" : "");
      btn.textContent = String(label);
      if (disabled) {
        btn.disabled = true;
      } else {
        btn.addEventListener("click", () => {
          currentPage = page;
          render();
        });
      }
      return btn;
    };

    fragment.appendChild(createBtn("<", Math.max(1, currentPage - 1), currentPage === 1, false));

    for (let page = 1; page <= totalPages; page += 1) {
      fragment.appendChild(createBtn(page, page, false, page === currentPage));
    }

    fragment.appendChild(createBtn(">", Math.min(totalPages, currentPage + 1), currentPage === totalPages, false));

    paginationNode.appendChild(fragment);
  };

  applyButton?.addEventListener("click", (event) => {
    event.preventDefault();
    applyFilters();
  });

  minPriceInput?.addEventListener("input", applyFilters);
  maxPriceInput?.addEventListener("input", applyFilters);
  categorySelect?.addEventListener("change", () => {
    currentPage = 1;
    applyFilters();
  });
  searchInput?.addEventListener("input", applyFilters);

  pageSizeSelect?.addEventListener("change", () => {
    pageSize = Number(pageSizeSelect.value) || 8;
    currentPage = 1;
    applyFilters();
  });

  applyFilters();

  function duplicateCardsToCount(seedCards, container, total) {
    const originalCount = seedCards.length;
    const allCards = seedCards.slice();

    allCards.forEach((card, index) => {
      card.dataset.productId = `catalogue-${index + 1}`;
    });

    for (let i = originalCount; i < total; i += 1) {
      const source = seedCards[i % originalCount];
      const clone = source.cloneNode(true);
      clone.dataset.productId = `catalogue-${i + 1}`;
      container.appendChild(clone);
      allCards.push(clone);
    }
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

  function applyCategoryFromUrl() {
    if (!categorySelect) return;

    const params = new URLSearchParams(window.location.search);
    const categoryFromUrl = normalizeCategory(params.get("category") || "");
    if (!categoryFromUrl) return;

    const options = Array.from(categorySelect.options);
    const matched = options.find((option) => normalizeCategory(option.value) === categoryFromUrl);
    if (matched) {
      categorySelect.value = matched.value;
    }
  }
})();
