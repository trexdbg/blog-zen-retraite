/*
  Zen Retraite – script principal
  --------------------------------
  Objectif: Blog statique (HTML+CSS+JS) avec recherche, filtres et
  chargement d’articles JSON. Compatible GitHub Pages et ouverture locale.

  Sections:
    1) Constantes et utilitaires
    2) Données fallback (mode file://)
    3) Chargement JSON avec rattrapage
    4) Lazy‑loading des images
    5) Accueil: grille, tri, recherche, filtres
    6) Article: affichage à partir de ?id=
    7) Archives: liste simple
*/

// 1) Constantes et utilitaires ----------------------------------------------
const BODY = document.body;
const HTML = document.documentElement;
const PAGE = BODY.dataset.page || ""; // "home" | "article" | "archive"

// Année courante dans le pied de page
const YEAR_EL = document.getElementById("current-year");
if (YEAR_EL) YEAR_EL.textContent = String(new Date().getFullYear());

// Formatage de date ISO → français lisible
function formatDateFR(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" });
}

// Polyfill trivial pour structuredClone si indisponible
function structuredClone(obj) { return JSON.parse(JSON.stringify(obj)); }

// Gestion du thème jour/nuit -------------------------------------------------
function effectiveTheme() {
  const saved = (() => { try { return localStorage.getItem('zr-theme'); } catch(e) { return null; } })();
  if (saved === 'dark' || saved === 'light') return saved;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function updateThemeButton() {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  const current = (HTML.getAttribute('data-theme') || effectiveTheme());
  const isDark = current === 'dark';
  btn.textContent = isDark ? '☀️' : '🌙';
  btn.title = isDark ? 'Passer en mode jour' : 'Passer en mode nuit';
  btn.setAttribute('aria-label', btn.title);
}

function setTheme(theme) {
  if (theme !== 'dark' && theme !== 'light') return;
  HTML.setAttribute('data-theme', theme);
  try { localStorage.setItem('zr-theme', theme); } catch (e) {}
  updateThemeButton();
}

function initThemeToggle() {
  updateThemeButton();
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const current = (HTML.getAttribute('data-theme') || effectiveTheme());
    const next = current === 'dark' ? 'light' : 'dark';
    setTheme(next);
  });
  // Si le système change et aucun thème forcé, mettre à jour l'icône
  const attr = HTML.getAttribute('data-theme');
  if (!attr && window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => updateThemeButton();
    if (typeof mq.addEventListener === 'function') mq.addEventListener('change', onChange);
    else if (typeof mq.addListener === 'function') mq.addListener(onChange);
  }
}

// 2) Données fallback (mode file://) ----------------------------------------
// Ouvrir en file:// bloque fetch des JSON. Pour une démo fluide hors serveur,
// on embarque un petit échantillon identique aux fichiers /data.
const IS_LOCAL = location.protocol === "file:";

const FALLBACK = {
  index: ["2025-11-01-1", "2025-10-30-1", "2025-10-18-1"],
  articles: {
    "2025-11-01-1": {
      id: "2025-11-01-1",
      theme: "Cuisine",
      subtheme: "Soupes",
      title: "Velouté de potimarron facile et parfumé",
      image: "https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?auto=format&fit=crop&w=900&q=80",
      excerpt: "Une recette réconfortante, prête en 20 minutes, parfaite pour l’automne.",
      content: "<p>Ce velouté de potimarron est onctueux et très simple à préparer. Le potimarron se mixe avec la peau, ce qui fait gagner du temps et donne une belle texture.</p><p><strong>Ingrédients (2 à 3 bols)</strong>: 1 petit potimarron, 1 oignon, 1 gousse d’ail, 600 ml d’eau ou bouillon, 1 c. à s. d’huile d’olive, 1 pincée de noix de muscade, sel, poivre, un trait de crème (optionnel).</p><ol><li>Lavez le potimarron, retirez les graines et coupez-le en cubes.</li><li>Faites revenir l’oignon émincé et l’ail dans l’huile 2 minutes.</li><li>Ajoutez le potimarron, couvrez d’eau/bouillon, assaisonnez, puis laissez mijoter 12 à 15 minutes.</li><li>Mixez finement. Ajoutez un peu de crème et une pincée de muscade.</li></ol><p>Servez bien chaud avec quelques graines de courge grillées et un filet d’huile de noisette. Bon appétit !</p>",
      created_at: "2025-11-01T08:00:00Z"
    },
    "2025-10-30-1": {
      id: "2025-10-30-1",
      theme: "Bien-être",
      subtheme: "Gym douce",
      title: "Bouger sans se blesser : la gym douce à la maison",
      image: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=900&q=80",
      excerpt: "Quelques exercices simples pour garder la forme et le sourire à tout âge.",
      content: "<p>La gym douce combine respiration, étirements et renforcement léger pour garder ses articulations souples sans forcer. Installez un tapis antidérapant et ouvrez les fenêtres pour respirer un air frais.</p><p>Avant de commencer, prenez cinq minutes pour échauffer vos poignets, vos chevilles et votre nuque. Ensuite, enchaînez trois séries de respiration abdominale puis deux exercices doux de mobilisation des épaules.</p><ul><li>Serrez légèrement vos abdominaux et levez les bras à l’horizontale avant de les relâcher, dix fois.</li><li>Assis sur une chaise, étirez vos jambes en gardant le dos droit, huit fois de chaque côté.</li><li>Terminez par un automassage des mollets avec une crème chauffante pour favoriser la récupération.</li></ul><p>Hydratez-vous et écoutez vos sensations : la régularité vaut plus que l’intensité. En dix minutes par jour, vous ressentirez rapidement plus d’énergie.</p>",
      created_at: "2025-10-30T08:00:00Z"
    },
    "2025-10-18-1": {
      id: "2025-10-18-1",
      theme: "Voyage",
      subtheme: "City break",
      title: "Un week-end slow à Nantes",
      image: "https://images.unsplash.com/photo-1505761671935-60b3a7427bad?auto=format&fit=crop&w=900&q=80",
      excerpt: "Balade en bord de Loire, musées intimistes et pauses gourmandes pour un séjour apaisant.",
      content: "<p>Nantes est une destination idéale pour un city break sans stress. Arrivez la veille au soir pour profiter d’un dîner au bord de l’Erdre et d’une promenade digestive sous les lanternes.</p><p>Le lendemain, commencez par le marché de Talensac pour goûter les produits locaux, puis rejoignez l’île de Versailles à pied ou à vélo. Les jardins japonais invitent à la contemplation et offrent des bancs confortables pour une pause lecture.</p><p>L’après-midi, explorez le passage Pommeraye avant de rejoindre Les Machines de l’île. Réservez votre balade sur le Grand Éléphant à l’avance : sensations douces garanties et vue panoramique sur la ville.</p><p>Terminez votre escapade au Jardin des plantes pour admirer les serres et savourer un café à la terrasse ombragée. Nantes se découvre en douceur, au fil des pas et des rencontres.</p>",
      created_at: "2025-10-18T09:30:00Z"
    }
  },
  archive: {
    articles: [
      { id: "2025-11-01-1", title: "Velouté de potimarron facile et parfumé", created_at: "2025-11-01T08:00:00Z" }
    ]
  }
};

// 3) Chargement JSON avec rattrapage ---------------------------------------
async function fetchJson(path) {
  try {
    const res = await fetch(path, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (error) {
    if (IS_LOCAL) {
      if (path.endsWith("index.json")) return structuredClone(FALLBACK.index);
      if (path.endsWith("archive.json")) return structuredClone(FALLBACK.archive);
      if (path.includes("/data/articles/")) {
        const id = path.split("/").pop().replace(".json", "");
        if (FALLBACK.articles[id]) return structuredClone(FALLBACK.articles[id]);
      }
    }
    throw error;
  }
}

// 4) Lazy‑loading des images ------------------------------------------------
const IO = "IntersectionObserver" in window
  ? new IntersectionObserver((entries, obs) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          const img = e.target;
          if (img.dataset.src) img.src = img.dataset.src;
          obs.unobserve(img);
        }
      });
    })
  : null;

function observeImage(img) {
  img.loading = "lazy";
  if (IO && img.dataset.src) IO.observe(img);
  else if (img.dataset.src) img.src = img.dataset.src;
}

function createMeta(article) {
  const div = document.createElement("div");
  div.className = "card-meta";
  div.innerHTML = `<span>${article.theme}</span><span>${article.subtheme}</span>`;
  return div;
}

// 5) Accueil -----------------------------------------------------------------
async function initHome() {
  const grid = document.getElementById("articles-grid");
  if (!grid) return;
  const empty = document.getElementById("empty-state");
  const input = document.getElementById("search-input");
  const themeSel = document.getElementById("theme-filter");
  const subSel = document.getElementById("subtheme-filter");

  let articles = [];
  const state = { search: "", theme: "", subtheme: "" };

  function setOptions(select, values) {
    const opts = ["<option value=\"\">Tous</option>"];
    values.forEach(v => opts.push(`<option value="${v}">${v}</option>`));
    select.innerHTML = opts.join("");
  }

  function buildCard(article, index) {
    const card = document.createElement("article");
    card.className = "card";
    card.style.animationDelay = `${(index * 0.06).toFixed(2)}s`;

    const img = document.createElement("img");
    img.alt = article.title;
    img.dataset.src = article.image;
    observeImage(img);

    const wrap = document.createElement("div");
    wrap.className = "card-content";

    const h2 = document.createElement("h2");
    h2.className = "card-title";
    h2.textContent = article.title;

    const p = document.createElement("p");
    p.className = "card-excerpt";
    p.textContent = article.excerpt;

    const a = document.createElement("a");
    a.href = `./article.html?id=${encodeURIComponent(article.id)}`;
    a.textContent = "Lire la suite";

    wrap.appendChild(createMeta(article));
    wrap.appendChild(h2);
    wrap.appendChild(p);
    wrap.appendChild(a);

    card.appendChild(img);
    card.appendChild(wrap);
    return card;
  }

  function render(items) {
    grid.innerHTML = "";
    grid.dataset.state = "ready";
    if (!items.length) { empty.hidden = false; return; }
    empty.hidden = true;
    items.forEach((a, i) => grid.appendChild(buildCard(a, i)));
  }

  function applyFilters() {
    const q = state.search.toLowerCase();
    const filtered = articles.filter(a => {
      const byTheme = !state.theme || a.theme === state.theme;
      const bySub = !state.subtheme || a.subtheme === state.subtheme;
      const byText = !q || a.title.toLowerCase().includes(q) || a.excerpt.toLowerCase().includes(q);
      return byTheme && bySub && byText;
    });
    render(filtered);
  }

  function resetSubthemes() {
    const set = new Set();
    articles.forEach(a => { if (!state.theme || a.theme === state.theme) set.add(a.subtheme); });
    const list = [...set].sort((a, b) => a.localeCompare(b, "fr"));
    setOptions(subSel, list);
    if (!list.includes(state.subtheme)) { state.subtheme = ""; subSel.value = ""; }
  }

  try {
    const ids = await fetchJson("./data/articles/index.json");
    if (!Array.isArray(ids)) throw new Error("Index absent");

    const loaded = await Promise.all(ids.map(async (id) => {
      try { return await fetchJson(`./data/articles/${id}.json`); }
      catch (e) { console.warn("Article ignoré", id, e); return null; }
    }));

    articles = loaded.filter(Boolean).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const themes = [...new Set(articles.map(a => a.theme))].sort((a, b) => a.localeCompare(b, "fr"));
    setOptions(themeSel, themes);
    resetSubthemes();
    applyFilters();
  } catch (e) {
    console.error(e);
    grid.dataset.state = "ready";
    grid.innerHTML = '<p class="empty-state">Impossible de charger les articles. Merci de réessayer plus tard.</p>';
  }

  if (input) input.addEventListener("input", (ev) => { state.search = ev.target.value.trim(); applyFilters(); });
  if (themeSel) themeSel.addEventListener("change", (ev) => { state.theme = ev.target.value; resetSubthemes(); applyFilters(); });
  if (subSel) subSel.addEventListener("change", (ev) => { state.subtheme = ev.target.value; applyFilters(); });

  // Hamburger toggle (mobile): open/close filters panel
  const toggleBtn = document.getElementById("filters-toggle");
  const headerEl = document.querySelector(".site-header");
  const panelEl = document.getElementById("filters-panel");
  if (toggleBtn && headerEl && panelEl) {
    toggleBtn.addEventListener("click", () => {
      const open = !headerEl.classList.contains("filters-open");
      headerEl.classList.toggle("filters-open", open);
      toggleBtn.setAttribute("aria-expanded", String(open));
    });

    // Close panel when resizing to desktop
    const mq = window.matchMedia("(min-width: 641px)");
    const onChange = (e) => {
      if (e.matches) {
        headerEl.classList.remove("filters-open");
        toggleBtn.setAttribute("aria-expanded", "false");
      }
    };
    if (typeof mq.addEventListener === "function") mq.addEventListener("change", onChange);
    else if (typeof mq.addListener === "function") mq.addListener(onChange);
  }
}

// 6) Article ----------------------------------------------------------------
async function initArticle() {
  const container = document.getElementById("article-detail");
  if (!container) return;

  const params = new URLSearchParams(location.search);
  const id = params.get("id");
  if (!id) { container.innerHTML = '<p class="empty-state">Article introuvable.</p>'; return; }

  try {
    const article = await fetchJson(`./data/articles/${id}.json`);
    document.title = `${article.title} - Zen Retraite`;
    container.innerHTML = "";

    const h1 = document.createElement("h1");
    h1.textContent = article.title;

    const meta = document.createElement("div");
    meta.className = "card-meta";
    const time = document.createElement("time");
    time.dateTime = article.created_at;
    time.textContent = formatDateFR(article.created_at);
    meta.appendChild(time);
    const tags = document.createElement("span");
    tags.textContent = `${article.theme} - ${article.subtheme}`;
    meta.appendChild(tags);

    const img = document.createElement("img");
    img.alt = article.title;
    img.dataset.src = article.image;
    observeImage(img);

    const body = document.createElement("div");
    body.className = "article-body";
    body.innerHTML = article.content;

    container.appendChild(h1);
    container.appendChild(meta);
    container.appendChild(img);
    container.appendChild(body);
  } catch (e) {
    console.error(e);
    container.innerHTML = '<p class="empty-state">Impossible de charger cet article.</p>';
  }
}

// 7) Archives ---------------------------------------------------------------
async function initArchive() {
  const list = document.getElementById("archive-list");
  if (!list) return;
  const empty = document.getElementById("archive-empty");

  try {
    const data = await fetchJson("./data/archive.json");
    let entriesRaw = Array.isArray(data) ? data : (Array.isArray(data.articles) ? data.articles : []);
    let entries = [];
    if (!entriesRaw.length) { empty.hidden = false; return; }
    // Normalisation: accepte soit une liste d'objets { id, title?, created_at? },
    // soit une liste d'IDs (strings). Dans ce dernier cas, on récupère titre/date
    // depuis le fichier d'article correspondant pour l'affichage.
    if (typeof entriesRaw[0] === "string") {
      const ids = entriesRaw;
      const loaded = await Promise.all(ids.map(async (id) => {
        try {
          const a = await fetchJson(`./data/articles/${id}.json`);
          return { id, title: a.title, created_at: a.created_at };
        } catch (e) {
          console.warn("Archive ignorée", id, e);
          return { id };
        }
      }));
      entries = loaded.filter(Boolean);
    } else {
      entries = entriesRaw.filter(Boolean);
    }

    if (!entries.length) { empty.hidden = false; return; }
    empty.hidden = true;

    entries.sort((a, b) => {
      const da = a.created_at ? new Date(a.created_at).getTime() : 0;
      const db = b.created_at ? new Date(b.created_at).getTime() : 0;
      if (db !== da) return db - da;
      return String(b.id).localeCompare(String(a.id), "fr");
    });

    entries.forEach((item) => {
      const li = document.createElement("li");
      const left = document.createElement("div");
      left.textContent = item.title || `Article ${item.id}`;
      const right = document.createElement("div");
      if (item.created_at) {
        const t = document.createElement("time");
        t.dateTime = item.created_at;
        t.textContent = formatDateFR(item.created_at);
        right.appendChild(t);
      }
      const a = document.createElement("a");
      a.href = `./article.html?id=${encodeURIComponent(item.id)}`;
      a.textContent = "Lire";
      right.appendChild(a);
      li.appendChild(left);
      li.appendChild(right);
      list.appendChild(li);
    });
  } catch (e) {
    console.error(e);
    empty.hidden = false;
    empty.textContent = "Impossible de charger les archives.";
  }
}

// Point d’entrée – selon la page courante
initThemeToggle();
if (PAGE === "home") initHome();
else if (PAGE === "article") initArticle();
else if (PAGE === "archive") initArchive();
