const BODY = document.body;
const HTML = document.documentElement;
const PAGE = BODY.dataset.page || "";
const PAGE_SIZE = 6;

const YEAR_EL = document.getElementById("current-year");
if (YEAR_EL) YEAR_EL.textContent = String(new Date().getFullYear());

function articlePath(id) {
  return `/articles/${encodeURIComponent(String(id))}/`;
}

function formatDateFR(iso) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" });
}

function readInlineJson(id) {
  const node = document.getElementById(id);
  if (!node) return null;
  try { return JSON.parse(node.textContent); } catch (error) { console.warn("JSON inline invalide", id, error); return null; }
}

function effectiveTheme() {
  try {
    const saved = localStorage.getItem("zr-theme");
    if (saved === "dark" || saved === "light") return saved;
  } catch (error) { /* storage may be unavailable */ }
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function updateThemeButton() {
  const button = document.getElementById("theme-toggle");
  if (!button) return;
  const isDark = (HTML.getAttribute("data-theme") || effectiveTheme()) === "dark";
  button.textContent = isDark ? "☀️" : "🌙";
  button.title = isDark ? "Passer en mode jour" : "Passer en mode nuit";
  button.setAttribute("aria-label", button.title);
}

function initThemeToggle() {
  updateThemeButton();
  const button = document.getElementById("theme-toggle");
  if (!button) return;
  button.addEventListener("click", () => {
    const next = (HTML.getAttribute("data-theme") || effectiveTheme()) === "dark" ? "light" : "dark";
    HTML.setAttribute("data-theme", next);
    try { localStorage.setItem("zr-theme", next); } catch (error) { /* preference remains for this page */ }
    updateThemeButton();
  });
}

function normalized(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr-FR");
}

function sortByPublicationDate(items) {
  return [...items].sort((left, right) => {
    const a = new Date(left.created_at || 0).getTime() || 0;
    const b = new Date(right.created_at || 0).getTime() || 0;
    return b - a || String(right.id).localeCompare(String(left.id), "fr");
  });
}

function appendMeta(parent, article) {
  const meta = document.createElement("div");
  meta.className = "card-meta";
  const category = document.createElement("span");
  category.textContent = article.category_label || article.theme || "Guide";
  meta.appendChild(category);
  if (article.subtheme) {
    const subject = document.createElement("span");
    subject.textContent = article.subtheme;
    meta.appendChild(subject);
  }
  parent.appendChild(meta);
}

function buildCard(article, index) {
  const card = document.createElement("article");
  card.className = "card";
  card.style.animationDelay = `${Math.min(index, 8) * 0.05}s`;
  if (article.image) {
    const image = document.createElement("img");
    image.src = article.image;
    image.alt = article.image_alt || "";
    image.loading = "lazy";
    image.addEventListener("error", () => { image.remove(); card.classList.add("card-without-image"); }, { once: true });
    card.appendChild(image);
  } else {
    card.classList.add("card-without-image");
  }
  const content = document.createElement("div");
  content.className = "card-content";
  appendMeta(content, article);
  const title = document.createElement("h3");
  title.className = "card-title";
  title.textContent = article.title || "Guide Zen Retraite";
  const excerpt = document.createElement("p");
  excerpt.className = "card-excerpt";
  excerpt.textContent = article.excerpt || "";
  const link = document.createElement("a");
  link.href = article.url || articlePath(article.id);
  link.textContent = "Lire le guide";
  content.append( title, excerpt, link );
  card.appendChild(content);
  return card;
}

function fillSelect(select, values, placeholder) {
  if (!select) return;
  const selected = select.value;
  select.replaceChildren();
  const empty = new Option(placeholder, "");
  select.add(empty);
  values.forEach((value) => select.add(new Option(value.label || value, value.value || value)));
  select.value = [...select.options].some((option) => option.value === selected) ? selected : "";
}

function initHome() {
  const grid = document.getElementById("articles-grid");
  const data = readInlineJson("zr-home-data");
  if (!grid || !Array.isArray(data?.articles)) return;
  const empty = document.getElementById("empty-state");
  const status = document.getElementById("catalogue-status");
  const search = document.getElementById("search-input");
  const categorySelect = document.getElementById("theme-filter");
  const subjectSelect = document.getElementById("subtheme-filter");
  const loadMore = document.getElementById("load-more");
  const articles = sortByPublicationDate(data.articles.filter(Boolean).map((article) => ({ ...article, url: article.url || articlePath(article.id), excerpt: article.excerpt || "" })));
  const state = { query: "", category: "", subject: "", visible: PAGE_SIZE };

  const categories = [...new Map(articles.filter((article) => article.category).map((article) => [article.category, article.category_label || article.category])).entries()]
    .sort((a, b) => a[1].localeCompare(b[1], "fr"))
    .map(([value, label]) => ({ value, label }));
  fillSelect(categorySelect, categories, "Toutes les catégories");

  function updateSubjects() {
    const values = [...new Set(articles.filter((article) => !state.category || article.category === state.category).map((article) => article.subtheme).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "fr"));
    fillSelect(subjectSelect, values, "Tous les sujets");
    if (state.subject && !values.includes(state.subject)) state.subject = "";
  }

  function filteredArticles() {
    const query = normalized(state.query);
    return articles.filter((article) => {
      const haystack = normalized(`${article.title} ${article.excerpt} ${article.theme} ${article.subtheme} ${article.category_label}`);
      return (!state.category || article.category === state.category) && (!state.subject || article.subtheme === state.subject) && (!query || haystack.includes(query));
    });
  }

  function render() {
    const filtered = filteredArticles();
    const visible = filtered.slice(0, state.visible);
    grid.replaceChildren(...visible.map(buildCard));
    grid.dataset.state = "ready";
    if (empty) empty.hidden = visible.length > 0;
    if (status) status.textContent = filtered.length === articles.length && state.visible <= PAGE_SIZE
      ? `${visible.length} publications récentes affichées.`
      : `${filtered.length} guide${filtered.length > 1 ? "s" : ""} trouvé${filtered.length > 1 ? "s" : ""}, ${visible.length} affiché${visible.length > 1 ? "s" : ""}.`;
    if (loadMore) loadMore.hidden = visible.length >= filtered.length;
  }

  search?.addEventListener("input", (event) => { state.query = event.target.value; state.visible = PAGE_SIZE; render(); });
  categorySelect?.addEventListener("change", (event) => { state.category = event.target.value; state.visible = PAGE_SIZE; updateSubjects(); render(); });
  subjectSelect?.addEventListener("change", (event) => { state.subject = event.target.value; state.visible = PAGE_SIZE; render(); });
  loadMore?.addEventListener("click", () => { state.visible += PAGE_SIZE; render(); });
  updateSubjects();
  render();
}

function initArchive() {
  const list = document.getElementById("archive-list");
  const data = readInlineJson("zr-archive-data");
  if (!list || !Array.isArray(data?.entries)) return;
  const search = document.getElementById("archive-search");
  const categorySelect = document.getElementById("archive-theme");
  const empty = document.getElementById("archive-empty");
  const status = document.getElementById("archive-status");
  const entries = sortByPublicationDate(data.entries.filter(Boolean));
  const requestedCategory = new URLSearchParams(location.search).get("theme") || "";
  const state = { query: "", category: requestedCategory };
  const labels = { maison: "Maison et quotidien", budget: "Budget et démarches", numerique_pratique: "Numérique pratique", bien_etre: "Bien-être et loisirs" };
  fillSelect(categorySelect, [...new Set(entries.map((entry) => entry.category).filter(Boolean))].sort().map((value) => ({ value, label: labels[value] || value })), "Toutes les catégories");
  categorySelect.value = [...categorySelect.options].some((option) => option.value === requestedCategory) ? requestedCategory : "";
  state.category = categorySelect.value;

  function render() {
    const query = normalized(state.query);
    const filtered = entries.filter((entry) => (!state.category || entry.category === state.category) && (!query || normalized(`${entry.title} ${entry.category}`).includes(query)));
    list.replaceChildren(...filtered.map((entry) => {
      const item = document.createElement("li");
      const title = document.createElement("div");
      const label = document.createElement("p");
      label.className = "archive-category";
      label.textContent = labels[entry.category] || "Guide";
      const heading = document.createElement("h2");
      const link = document.createElement("a");
      link.href = entry.url || articlePath(entry.id);
      link.textContent = entry.title || `Article ${entry.id}`;
      heading.appendChild(link);
      title.append(label, heading);
      const details = document.createElement("div");
      if (entry.created_at) { const date = document.createElement("time"); date.dateTime = entry.created_at; date.textContent = formatDateFR(entry.created_at); details.appendChild(date); }
      const read = document.createElement("a"); read.href = entry.url || articlePath(entry.id); read.textContent = "Lire"; details.appendChild(read);
      item.append(title, details);
      return item;
    }));
    if (empty) empty.hidden = filtered.length > 0;
    if (status) status.textContent = `${filtered.length} guide${filtered.length > 1 ? "s" : ""} disponible${filtered.length > 1 ? "s" : ""}.`;
  }
  search?.addEventListener("input", (event) => { state.query = event.target.value; render(); });
  categorySelect?.addEventListener("change", (event) => { state.category = event.target.value; render(); });
  render();
}

initThemeToggle();
if (PAGE === "home") initHome();
if (PAGE === "archive") initArchive();
