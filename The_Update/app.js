// CONFIG 
const CONFIG = {
  API_KEY: "ee879ec2bf2a417e8f23bf9383477893",   
  BASE_URL: "https://newsapi.org/v2",
  PAGE_SIZE: 9,
  DEFAULT_CATEGORY: "general",
  DEFAULT_COUNTRY: "us",
  CACHE_TTL: 5 * 60 * 1000,          
};

// STATE 
const state = {
  articles: [],
  currentPage: 1,
  totalResults: 0,
  currentCategory: CONFIG.DEFAULT_CATEGORY,
  currentQuery: "",
  currentSort: "publishedAt",
  isListView: false,
  lastViewed: JSON.parse(localStorage.getItem("the_update_last_viewed") || "null"),
  cache: {},
};

// DOM REFS 
const dom = {
  newsGrid:          () => document.getElementById("newsGrid"),
  loadingContainer:  () => document.getElementById("loadingContainer"),
  errorContainer:    () => document.getElementById("errorContainer"),
  emptyContainer:    () => document.getElementById("emptyContainer"),
  errorMessage:      () => document.getElementById("errorMessage"),
  pagination:        () => document.getElementById("pagination"),
  prevPage:          () => document.getElementById("prevPage"),
  nextPage:          () => document.getElementById("nextPage"),
  pageInfo:          () => document.getElementById("pageInfo"),
  searchInput:       () => document.getElementById("searchInput"),
  searchBtn:         () => document.getElementById("searchBtn"),
  sortSelect:        () => document.getElementById("sortSelect"),
  themeToggle:       () => document.getElementById("themeToggle"),
  gridViewBtn:       () => document.getElementById("gridViewBtn"),
  listViewBtn:       () => document.getElementById("listViewBtn"),
  retryBtn:          () => document.getElementById("retryBtn"),
  sectionLabel:      () => document.getElementById("sectionLabel"),
  articleCount:      () => document.getElementById("articleCount"),
  heroDate:          () => document.getElementById("heroDate"),
  modalOverlay:      () => document.getElementById("modalOverlay"),
  modalClose:        () => document.getElementById("modalClose"),
  modalImage:        () => document.getElementById("modalImage"),
  modalCategory:     () => document.getElementById("modalCategory"),
  modalSource:       () => document.getElementById("modalSource"),
  modalDate:         () => document.getElementById("modalDate"),
  modalTitle:        () => document.getElementById("modalTitle"),
  modalDesc:         () => document.getElementById("modalDesc"),
  modalLink:         () => document.getElementById("modalLink"),
  lvTitle:           () => document.getElementById("lvTitle"),
  lvSource:          () => document.getElementById("lvSource"),
  lvProgress:        () => document.getElementById("lvProgress"),
  lastViewedImage:   () => document.getElementById("lastViewedImage"),
  lastViewedCard:    () => document.getElementById("lastViewedCard"),
  toast:             () => document.getElementById("toast"),
};

//UTILITIES 

/**
 * Date string 
 */
function formatDate(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now  = new Date();
  const diff  = Math.floor((now - date) / 1000);

  if (diff < 60)        return "just now";
  if (diff < 3600)      return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400)     return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800)    return `${Math.floor(diff / 86400)}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Estimate reading time based on word count 
 */
function readingTime(text) {
  if (!text) return "1 min read";
  const wpm = 200;
  const words = text.trim().split(/\s+/).length;
  const mins  = Math.max(1, Math.ceil(words / wpm));
  return `${mins} min read`;
}

/**
 * Category emoji icon.
 */
function categoryIcon(cat) {
  const icons = {
    general:       "🌐",
    technology:    "💻",
    business:      "📈",
    science:       "🔬",
    health:        "❤️",
    sports:        "⚽",
    entertainment: "🎬",
  };
  return icons[cat] || "📰";
}

/**
 * Cache key from params.
 */
function cacheKey(params) {
  return JSON.stringify(params);
}

/**
 * Show a toast notification.
 */
function showToast(msg) {
  const t = dom.toast();
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2800);
}

// THEME 

function initTheme() {
  const saved = localStorage.getItem("the_update_theme") || "light";
  document.documentElement.setAttribute("data-theme", saved);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme");
  const next = current === "light" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("the_update_theme", next);
}

// LAST VIEWED 

function saveLastViewed(article) {
  state.lastViewed = article;
  localStorage.setItem("the_update_last_viewed", JSON.stringify(article));
  renderLastViewed();
}

function renderLastViewed() {
  const lv = state.lastViewed;
  if (!lv) return;

  const lvImg = dom.lastViewedImage();
  lvImg.innerHTML = "";

  if (lv.urlToImage) {
    const img = document.createElement("img");
    img.src = lv.urlToImage;
    img.alt = lv.title || "";
    img.style.cssText = "width:100%;height:100%;object-fit:cover;";
    img.onerror = () => {
      lvImg.innerHTML = `<div class="lv-placeholder"><span>${categoryIcon(state.currentCategory)}</span></div>`;
    };
    lvImg.appendChild(img);
  } else {
    lvImg.innerHTML = `<div class="lv-placeholder"><span>${categoryIcon(state.currentCategory)}</span></div>`;
  }

  dom.lvTitle().textContent = lv.title || "Untitled article";
  dom.lvSource().textContent = lv.source?.name || "";
  dom.lvProgress().style.width = `${Math.floor(Math.random() * 40) + 40}%`;

  dom.lastViewedCard().onclick = () => openModal(lv);
}

// API CALLS 

/**
 * Fetch top headlines by category.
 */
async function fetchTopHeadlines(category = "general", page = 1) {
  const params = {
    type: "headlines",
    category,
    country: CONFIG.DEFAULT_COUNTRY,
    pageSize: CONFIG.PAGE_SIZE,
    page,

  };

  const key = cacheKey(params);
  if (state.cache[key] && Date.now() - state.cache[key].ts < CONFIG.CACHE_TTL) {
    return state.cache[key].data;
  }

  const url = new URL(`/api/top-headlines`, window.location.origin);
  url.searchParams.set("country",  CONFIG.DEFAULT_COUNTRY);
  url.searchParams.set("category", category);
  url.searchParams.set("pageSize", CONFIG.PAGE_SIZE);
  url.searchParams.set("page",     page);
  

  const res  = await fetch(url.toString());
  const data = await res.json();

  if (!res.ok || data.status === "error") {
    throw new Error(data.message || `HTTP ${res.status}`);
  }

  state.cache[key] = { data, ts: Date.now() };
  return data;
}

/**
 * Search for articles by query string.
 */
async function fetchSearch(query, page = 1, sortBy = "publishedAt") {
  const params = { type: "search", query, page, sortBy };
  const key = cacheKey(params);

  if (state.cache[key] && Date.now() - state.cache[key].ts < CONFIG.CACHE_TTL) {
    return state.cache[key].data;
  }

  const url = new URL(`/api/search`, window.location.origin);
  url.searchParams.set("q",        query);
  url.searchParams.set("pageSize", CONFIG.PAGE_SIZE);
  url.searchParams.set("page",     page);
  url.searchParams.set("sortBy",   sortBy);
  url.searchParams.set("language", "en");
  

  const res  = await fetch(url.toString());
  const data = await res.json();

  if (!res.ok || data.status === "error") {
    throw new Error(data.message || `HTTP ${res.status}`);
  }

  state.cache[key] = { data, ts: Date.now() };
  return data;
}

//  RENDER ARTICLES 

function renderArticles(articles) {
  const grid = dom.newsGrid();
  grid.innerHTML = "";

  articles.forEach((article, i) => {
    const card = buildCard(article, i);
    grid.appendChild(card);
  });
}

function buildCard(article, index) {
  const card = document.createElement("article");
  card.className = "news-card";
  card.setAttribute("tabindex", "0");
  card.setAttribute("role", "button");
  card.setAttribute("aria-label", article.title || "Read article");

  const hasImage = article.urlToImage && !article.urlToImage.includes("None");
  const imgHTML  = hasImage
    ? `<img class="card-image" src="${escapeHtml(article.urlToImage)}" alt="" loading="lazy" onerror="this.style.display='none'" />`
    : `<div class="card-image-placeholder"><span>${categoryIcon(state.currentCategory)}</span></div>`;

  card.innerHTML = `
    <div class="card-image-wrap">
      ${imgHTML}
      <span class="card-category">${escapeHtml(state.currentCategory)}</span>
    </div>
    <div class="card-body">
      <div class="card-meta">
        <span class="card-source">${escapeHtml(article.source?.name || "Unknown")}</span>
        <span class="card-dot">·</span>
        <span class="card-date">${formatDate(article.publishedAt)}</span>
      </div>
      <h2 class="card-title">${escapeHtml(article.title || "Untitled")}</h2>
      <p class="card-desc">${escapeHtml(article.description || "")}</p>
      <div class="card-footer">
        <span class="card-read-time">${readingTime(article.description || article.content || "")}</span>
        <span class="card-arrow">→</span>
      </div>
    </div>
  `;

  card.addEventListener("click", () => openModal(article));
  card.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") openModal(article); });

  return card;
}

function escapeHtml(str) {
  if (typeof str !== "string") return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// MODAL

function openModal(article) {
  saveLastViewed(article);

  const hasImage = article.urlToImage && !article.urlToImage.includes("None");
  const img      = dom.modalImage();

  if (hasImage) {
    img.src   = article.urlToImage;
    img.alt   = article.title || "";
    img.style.display = "block";
    img.onerror = () => {
      img.style.display = "none";
      document.querySelector(".modal-image-wrap").style.background =
        `linear-gradient(135deg, var(--accent) 0%, var(--accent-light) 100%)`;
    };
  } else {
    img.style.display = "none";
    document.querySelector(".modal-image-wrap").style.background =
      `linear-gradient(135deg, var(--accent) 0%, var(--accent-light) 100%)`;
  }

  dom.modalCategory().textContent = state.currentCategory;
  dom.modalSource().textContent   = article.source?.name || "Unknown Source";
  dom.modalDate().textContent     = formatDate(article.publishedAt);
  dom.modalTitle().textContent    = article.title || "Untitled";
  dom.modalDesc().textContent     = article.description || article.content || "No description available.";
  dom.modalLink().href            = article.url || "#";

  dom.modalOverlay().classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeModal() {
  dom.modalOverlay().classList.remove("open");
  document.body.style.overflow = "";
}

// LOADING / ERROR STATES 

function showLoading() {
  dom.loadingContainer().style.display = "flex";
  dom.errorContainer().style.display   = "none";
  dom.emptyContainer().style.display   = "none";
  dom.newsGrid().innerHTML              = "";
  dom.pagination().style.display       = "none";
}

function hideLoading() {
  dom.loadingContainer().style.display = "none";
}

function showError(message) {
  hideLoading();
  dom.errorContainer().style.display = "flex";
  dom.errorMessage().textContent = message ||
    "Failed to load articles. Check your API key and internet connection.";
}

function showEmpty() {
  hideLoading();
  dom.emptyContainer().style.display = "flex";
}

//LOAD NEWS 

async function loadNews(options = {}) {
  const {
    category = state.currentCategory,
    query    = state.currentQuery,
    page     = state.currentPage,
    sort     = state.currentSort,
    label    = null,
  } = options;

  showLoading();

  try {
    let data;

    if (query && query.trim() !== "") {
      data = await fetchSearch(query.trim(), page, sort);
      dom.sectionLabel().textContent = `Results for "${query}"`;
    } else {
      data = await fetchTopHeadlines(category, page);
      dom.sectionLabel().textContent = label || capitalize(category);
    }

    const articles = (data.articles || []).filter(
      (a) => a.title && a.title !== "[Removed]" && a.url
    );

    state.articles      = articles;
    state.totalResults  = data.totalResults || 0;
    state.currentPage   = page;

    if (articles.length === 0) {
      showEmpty();
      dom.articleCount().textContent = "";
      dom.pagination().style.display = "none";
      return;
    }

    hideLoading();
    renderArticles(articles);
    updatePagination(data.totalResults, page);

    const shown = Math.min(page * CONFIG.PAGE_SIZE, data.totalResults);
    dom.articleCount().textContent = `${data.totalResults.toLocaleString()} stories`;

  } catch (err) {
    console.error("loadNews error:", err);
    showError(friendlyError(err.message));
  }
}

/**
 * Convert raw error messages to user-friendly ones.
 */
function friendlyError(msg) {
  if (!msg) return "Something went wrong. Please try again.";
  if (msg.includes("apiKey") || msg.includes("API key")) {
    return "Invalid API key. Please check your NewsAPI key in app.js.";
  }
  if (msg.includes("rateLimited") || msg.includes("429") || msg.includes("too many requests")) {
    return "Too many requests. Please wait a moment and try again.";
  }
  if (msg.includes("network") || msg.includes("fetch") || msg.includes("Failed to fetch")) {
    return "Network error. Please check your internet connection.";
  }
  if (msg.includes("cors") || msg.includes("CORS")) {
    return "CORS error. For local testing, use a development server or a CORS proxy.";
  }
  return msg;
}

function capitalize(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : "";
}

// PAGINATION 

function updatePagination(totalResults, page) {
  const totalPages = Math.ceil(totalResults / CONFIG.PAGE_SIZE);
  const pag = dom.pagination();

  if (totalPages <= 1) {
    pag.style.display = "none";
    return;
  }

  pag.style.display     = "flex";
  dom.prevPage().disabled = page <= 1;
  dom.nextPage().disabled = page >= totalPages;
  dom.pageInfo().textContent = `Page ${page} of ${Math.min(totalPages, 100)}`; // NewsAPI caps at 100
}

// SEARCH 

function handleSearch() {
  const q = dom.searchInput().value.trim();
  if (!q) {
    showToast("Please enter a search term.");
    return;
  }
  state.currentQuery    = q;
  state.currentPage     = 1;
  state.currentCategory = "";

  // Deactivate all nav links
  document.querySelectorAll(".nav-link").forEach((l) => l.classList.remove("active"));

  loadNews({ query: q, page: 1, sort: state.currentSort });
}

// EVENT LISTENERS 

function bindEvents() {
  // Theme toggle
  dom.themeToggle().addEventListener("click", toggleTheme);

  // Search
  dom.searchBtn().addEventListener("click", handleSearch);
  dom.searchInput().addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleSearch();
  });

  // Suggestion tags
  document.querySelectorAll(".suggestion-tag").forEach((tag) => {
    tag.addEventListener("click", () => {
      const q = tag.dataset.query;
      dom.searchInput().value = q;
      handleSearch();
    });
  });

  // Nav category links
  document.querySelectorAll(".nav-link").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const cat = link.dataset.category;

      document.querySelectorAll(".nav-link, .mobile-nav-link").forEach((l) => l.classList.remove("active"));
      link.classList.add("active");

      // Also activate matching mobile link
      document.querySelectorAll(`.mobile-nav-link[data-category="${cat}"]`).forEach((l) => l.classList.add("active"));

      state.currentCategory = cat;
      state.currentQuery    = "";
      state.currentPage     = 1;
      dom.searchInput().value = "";

      loadNews({ category: cat, page: 1 });
    });
  });

  // Mobile nav links (injected dynamically below)
  document.addEventListener("click", (e) => {
    if (e.target.classList.contains("mobile-nav-link")) {
      e.preventDefault();
      const cat = e.target.dataset.category;
      document.querySelectorAll(".nav-link, .mobile-nav-link").forEach((l) => l.classList.remove("active"));
      e.target.classList.add("active");
      state.currentCategory = cat;
      state.currentQuery    = "";
      state.currentPage     = 1;
      dom.searchInput().value = "";
      closeMobileMenu();
      loadNews({ category: cat, page: 1 });
    }
  });

  // Sort
  dom.sortSelect().addEventListener("change", () => {
    state.currentSort = dom.sortSelect().value;
    state.currentPage = 1;
    loadNews({
      category: state.currentCategory,
      query:    state.currentQuery,
      page:     1,
      sort:     state.currentSort,
    });
  });

  // Pagination
  dom.prevPage().addEventListener("click", () => {
    if (state.currentPage > 1) {
      loadNews({
        category: state.currentCategory,
        query:    state.currentQuery,
        page:     state.currentPage - 1,
        sort:     state.currentSort,
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  });

  dom.nextPage().addEventListener("click", () => {
    const totalPages = Math.ceil(state.totalResults / CONFIG.PAGE_SIZE);
    if (state.currentPage < totalPages) {
      loadNews({
        category: state.currentCategory,
        query:    state.currentQuery,
        page:     state.currentPage + 1,
        sort:     state.currentSort,
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  });

  // View toggle
  dom.gridViewBtn().addEventListener("click", () => {
    state.isListView = false;
    dom.newsGrid().classList.remove("list-view");
    dom.gridViewBtn().classList.add("active");
    dom.listViewBtn().classList.remove("active");
  });

  dom.listViewBtn().addEventListener("click", () => {
    state.isListView = true;
    dom.newsGrid().classList.add("list-view");
    dom.listViewBtn().classList.add("active");
    dom.gridViewBtn().classList.remove("active");
  });

  // Modal close
  dom.modalClose().addEventListener("click", closeModal);
  dom.modalOverlay().addEventListener("click", (e) => {
    if (e.target === dom.modalOverlay()) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });

  // Retry
  dom.retryBtn().addEventListener("click", () => {
    dom.errorContainer().style.display = "none";
    loadNews({
      category: state.currentCategory,
      query:    state.currentQuery,
      page:     state.currentPage,
    });
  });
}

// MOBILE NAV 

function buildMobileNav() {
  const categories = [
    { cat: "general",       label: "Top Stories" },
    { cat: "technology",    label: "Tech"         },
    { cat: "business",      label: "Business"     },
    { cat: "science",       label: "Science"      },
    { cat: "health",        label: "Health"       },
    { cat: "sports",        label: "Sports"       },
    { cat: "entertainment", label: "Culture"      },
  ];

  // Build mobile menu button
  const menuBtn = document.createElement("button");
  menuBtn.className = "mobile-menu-btn";
  menuBtn.id        = "mobileMenuBtn";
  menuBtn.innerHTML = "☰";
  menuBtn.setAttribute("aria-label", "Open menu");

  const navRight = document.querySelector(".nav-right");
  navRight.prepend(menuBtn);

  // Build mobile nav
  const mobileNav = document.createElement("div");
  mobileNav.className = "mobile-nav";
  mobileNav.id        = "mobileNav";

  categories.forEach(({ cat, label }) => {
    const a = document.createElement("a");
    a.href            = "#";
    a.className       = "nav-link mobile-nav-link" + (cat === state.currentCategory ? " active" : "");
    a.dataset.category = cat;
    a.textContent     = label;
    mobileNav.appendChild(a);
  });

  document.querySelector(".navbar").after(mobileNav);

  menuBtn.addEventListener("click", toggleMobileMenu);
}

function toggleMobileMenu() {
  const nav = document.getElementById("mobileNav");
  const btn = document.getElementById("mobileMenuBtn");
  const open = nav.classList.toggle("open");
  btn.innerHTML = open ? "✕" : "☰";
}

function closeMobileMenu() {
  const nav = document.getElementById("mobileNav");
  const btn = document.getElementById("mobileMenuBtn");
  if (nav) nav.classList.remove("open");
  if (btn) btn.innerHTML = "☰";
}

// HERO DATE 

function setHeroDate() {
  const now = new Date();
  dom.heroDate().textContent = now.toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

// INIT 

function init() {
  initTheme();
  setHeroDate();
  bindEvents();
  buildMobileNav();
  renderLastViewed();

  // Initial load
  loadNews({ category: CONFIG.DEFAULT_CATEGORY, page: 1 });
}

document.addEventListener("DOMContentLoaded", init);
 