import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, "..");
const dataDir = path.join(rootDir, "data");
const articlesDataDir = path.join(dataDir, "articles");
const archiveDataPath = path.join(dataDir, "archive.json");
const templatesDir = path.join(rootDir, "templates");
const distDir = path.join(rootDir, "dist");
const articlesOutputDir = path.join(distDir, "articles");
const STATIC_FILES = ["style.css", "script.js", "favicon.png", "robots.txt", "CNAME", "article.html"];
const STATIC_DIRECTORIES = ["assets"];

const SITE_URL = (process.env.SITE_URL || "https://zen-retraite.fr").replace(/\/+$/, "");
const DATE_FORMATTER = new Intl.DateTimeFormat("fr-FR", { year: "numeric", month: "long", day: "numeric" });
const SITE_NAME = "Zen Retraite";
const ABOUT_LASTMOD = "2026-10-05";
const AFFILIATE_DISCLOSURE =
  "En tant que Partenaire Amazon, je réalise un bénéfice sur les achats remplissant les conditions requises. Certains liens peuvent être affiliés, sans surcoût pour vous.";

const THEME_LABELS = {
  maison_jardin: "Maison et jardin",
  loisirs_vie_active: "Loisirs et vie active",
  numerique_pratique: "Numérique pratique",
};

function normalizeTheme(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr-FR")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function displayTheme(value) {
  const raw = String(value || "").trim();
  return THEME_LABELS[raw.toLocaleLowerCase("fr-FR")] || raw || "Inspiration";
}

function themeFamily(value) {
  const normalized = normalizeTheme(value);
  if (["maison jardin", "maison", "jardin"].includes(normalized)) return "maison_jardin";
  if (["loisirs vie active", "loisirs", "voyage"].includes(normalized)) return "loisirs_vie_active";
  if (["numerique pratique", "numerique"].includes(normalized)) return "numerique_pratique";
  return normalized;
}


async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

function htmlEscape(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeJson(data) {
  return JSON.stringify(data).replace(/</g, "\\u003C");
}

function normalizeImage(value) {
  if (!value) return null;
  const trimmed = String(value).trim();
  const normalized = trimmed.toLocaleLowerCase("fr-FR").replace(/\s+/g, " ");
  if (["n/a", "pas d'image", "pas d\u2019image"].includes(normalized)) return null;
  return trimmed;
}

function normalizeImageText(value) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function normalizeImageDimension(value) {
  const candidate = typeof value === "number" ? value : typeof value === "string" && /^\d+$/.test(value.trim()) ? Number(value.trim()) : 0;
  return Number.isSafeInteger(candidate) && candidate > 0 && candidate <= 10000 ? candidate : null;
}

function articleImageAlt(article) {
  return article.image_alt || article.title || "Illustration de l'article";
}

function imageDimensionAttributes(article) {
  const width = article.image_width;
  const height = article.image_height;
  if (!width || !height) return "";
  return ` width="${width}" height="${height}"`;
}

function formatDateHuman(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return DATE_FORMATTER.format(date);
}

function toDateStamp(iso) {
  const normalized = structuredDate(iso);
  return normalized ? normalized.slice(0, 10) : "";
}

function structuredDate(value) {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw) return null;

  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:(Z)|([+-])(\d{2}):(\d{2}))?)?$/);
  if (!match) return null;
  const [, year, month, day, hour = "00", minute = "00", second = "00", utc, offsetSign, offsetHour = "00", offsetMinute = "00"] = match;
  const [parsedYear, parsedMonth, parsedDay, parsedHour, parsedMinute, parsedSecond] = [year, month, day, hour, minute, second].map(Number);
  const calendarDate = new Date(Date.UTC(parsedYear, parsedMonth - 1, parsedDay, parsedHour, parsedMinute, parsedSecond));
  const validCalendar =
    calendarDate.getUTCFullYear() === parsedYear &&
    calendarDate.getUTCMonth() === parsedMonth - 1 &&
    calendarDate.getUTCDate() === parsedDay &&
    calendarDate.getUTCHours() === parsedHour &&
    calendarDate.getUTCMinutes() === parsedMinute &&
    calendarDate.getUTCSeconds() === parsedSecond;
  const validOffset = !offsetSign || (Number(offsetHour) <= 23 && Number(offsetMinute) <= 59);
  if (!validCalendar || !validOffset) return null;

  // GitHub Actions historically writes some publication timestamps without an
  // offset. They represent UTC, so make that explicit for schema.org while
  // leaving the source JSON untouched. Dates carrying an offset are preserved.
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (!utc && !offsetSign) return `${raw}Z`;
  return raw;
}

function metaDescription(text) {
  const fallback = "Zen Retraite partage des inspirations pour une retraite active et sereine.";
  if (!text) return fallback;
  const sanitized = String(text).replace(/\s+/g, " ").trim();
  if (!sanitized) return fallback;
  if (sanitized.length <= 160) return sanitized;
  return `${sanitized.slice(0, 157).trim()}…`;
}

function siteStructuredData() {
  const payload = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL + "/",
    inLanguage: "fr-FR",
    publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL + "/" },
  };
  return "<script type='application/ld+json'>" + safeJson(payload) + "</script>";
}

function archiveStructuredData() {
  const payload = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Archives | " + SITE_NAME,
    url: SITE_URL + "/archive.html",
    inLanguage: "fr-FR",
    isPartOf: { "@type": "WebSite", name: SITE_NAME, url: SITE_URL + "/" },
  };
  return "<script type='application/ld+json'>" + safeJson(payload) + "</script>";
}

function aboutStructuredData() {
  const payload = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    name: "À propos | " + SITE_NAME,
    url: SITE_URL + "/a-propos.html",
    inLanguage: "fr-FR",
    isPartOf: { "@type": "WebSite", name: SITE_NAME, url: SITE_URL + "/" },
    about: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL + "/",
    },
  };
  return "<script type='application/ld+json'>" + safeJson(payload) + "</script>";
}

async function loadTemplate(name) {
  const filePath = path.join(templatesDir, name);
  return fs.readFile(filePath, "utf8");
}

async function prepareDist() {
  await fs.rm(distDir, { recursive: true, force: true });
  await fs.mkdir(distDir, { recursive: true });
}

async function copyPathSafe(source, target) {
  try {
    const stats = await fs.stat(source);
    if (stats.isDirectory()) {
      await fs.cp(source, target, { recursive: true });
    } else {
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.copyFile(source, target);
    }
  } catch (error) {
    if (error.code === "ENOENT") {
      console.warn(`[build] Ressource statique absente (ignorée): ${source}`);
    } else {
      throw error;
    }
  }
}

async function copyStaticAssets() {
  const tasks = [];
  for (const file of STATIC_FILES) {
    tasks.push(copyPathSafe(path.join(rootDir, file), path.join(distDir, file)));
  }
  for (const dir of STATIC_DIRECTORIES) {
    tasks.push(copyPathSafe(path.join(rootDir, dir), path.join(distDir, dir)));
  }
  await Promise.all(tasks);
  console.log("[build] Fichiers statiques copiés.");
}

function renderTemplate(template, replacements) {
  return template.replace(/{{([\w_]+)}}/g, (_, key) => (key in replacements ? replacements[key] : ""));
}

async function loadArticles() {
  const files = await fs.readdir(articlesDataDir);
  const articles = [];

  for (const file of files) {
    if (!file.endsWith(".json") || file === "index.json") continue;
    const data = await readJson(path.join(articlesDataDir, file));
    if (!data || !data.id) {
      console.warn(`[build] Fichier ignoré (id manquant): ${file}`);
      continue;
    }
    articles.push({
      ...data,
      image: normalizeImage(data.image),
      image_alt: normalizeImageText(data.image_alt),
      image_caption: normalizeImageText(data.image_caption),
      image_width: normalizeImageDimension(data.image_width),
      image_height: normalizeImageDimension(data.image_height),
      created_at: data.created_at || data.createdAt || null,
    });
  }

  return articles;
}

function sortByDateDesc(items) {
  return [...items].sort((a, b) => {
    const da = a.created_at ? new Date(a.created_at).getTime() : 0;
    const db = b.created_at ? new Date(b.created_at).getTime() : 0;
    return db - da;
  });
}

function buildCard(article, index) {
  const delay = (index * 0.06).toFixed(2);
  const imageHtml = article.image
    ? `<img src="${htmlEscape(article.image)}" data-src="${htmlEscape(article.image)}" alt="${htmlEscape(articleImageAlt(article))}" loading="lazy"${imageDimensionAttributes(article)}>`
    : "";
  const theme = displayTheme(article.theme);
  const subtheme = article.subtheme || "Découverte";
  const href = `./articles/${htmlEscape(article.id)}/index.html`;
  return `
<article class="card" style="animation-delay: ${delay}s">
${imageHtml}
<div class="card-content">
<div class="card-meta"><span>${htmlEscape(theme)}</span><span>${htmlEscape(subtheme)}</span></div>
<h2 class="card-title">${htmlEscape(article.title)}</h2>
<p class="card-excerpt">${htmlEscape(article.excerpt || "")}</p>
<a href="${href}">Lire la suite</a>
</div>
</article>`.trim();
}

function buildArchiveItem(entry) {
  const title = entry.title || `Article ${entry.id}`;
  const dateIso = entry.created_at && !Number.isNaN(new Date(entry.created_at).getTime()) ? entry.created_at : "";
  const dateHuman = formatDateHuman(dateIso);
  const timeBlock = dateIso
    ? `<time dateTime="${htmlEscape(dateIso)}">${htmlEscape(dateHuman)}</time>`
    : "";
  const href = entry.url || `./articles/${htmlEscape(entry.id)}/index.html`;
  return `
<li>
  <div>${htmlEscape(title)}</div>
  <div>
    ${timeBlock}
    <a href="${href}">Lire</a>
  </div>
</li>`.trim();
}

async function buildHome(template, articles, archiveCount) {
  const cards = articles.map(buildCard).join("\n");
  const listData = articles.map((article) => ({
    id: article.id,
    title: article.title,
    excerpt: article.excerpt,
    theme: displayTheme(article.theme),
    subtheme: article.subtheme,
    image: article.image,
    created_at: article.created_at,
    url: `./articles/${article.id}/index.html`,
  }));

  const replacements = {
    HOME_ARTICLE_LIST: cards,
    HOME_EMPTY_STATE_ATTR: articles.length ? "hidden" : "",
    HOME_ARCHIVE_LINK_ATTR: archiveCount ? "" : "hidden",
    HOME_ARCHIVE_COUNT: String(archiveCount),
    HOME_DATA_SCRIPT: `<script id="zr-home-data" type="application/json">${safeJson({ articles: listData })}</script>`,
  };

  replacements.SITE_URL = htmlEscape(SITE_URL);
  replacements.HOME_STRUCTURED_DATA = siteStructuredData();
  replacements.AFFILIATE_DISCLOSURE = htmlEscape(AFFILIATE_DISCLOSURE);
  const html = renderTemplate(template, replacements);
  await fs.writeFile(path.join(distDir, "index.html"), html, "utf8");
  console.log(`[build] Accueil généré (${articles.length} articles).`);
}

async function buildArchive(template, entries) {
  const listHtml = entries.map(buildArchiveItem).join("\n");
  const replacements = {
    ARCHIVE_LIST: listHtml,
    ARCHIVE_EMPTY_STATE_ATTR: entries.length ? "hidden" : "",
    ARCHIVE_COUNT: String(entries.length),
    ARCHIVE_DATA_SCRIPT: `<script id="zr-archive-data" type="application/json">${safeJson({ entries })}</script>`,
  };
  replacements.SITE_URL = htmlEscape(SITE_URL);
  replacements.ARCHIVE_STRUCTURED_DATA = archiveStructuredData();
  replacements.AFFILIATE_DISCLOSURE = htmlEscape(AFFILIATE_DISCLOSURE);
  const html = renderTemplate(template, replacements);
  await fs.writeFile(path.join(distDir, "archive.html"), html, "utf8");
  console.log(`[build] Archives générées (${entries.length} entrées).`);
}

function articleImageBlock(article) {
  if (!article.image) return "";
  const image = `<img src="${htmlEscape(article.image)}" alt="${htmlEscape(articleImageAlt(article))}" loading="lazy"${imageDimensionAttributes(article)}>`;
  if (!article.image_caption) return image;
  return `<figure class="article-image">${image}<figcaption>${htmlEscape(article.image_caption)}</figcaption></figure>`;
}

function structuredData(article, canonicalUrl, description) {
  const payload = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description,
    mainEntityOfPage: canonicalUrl,
    inLanguage: "fr-FR",
    isPartOf: { "@type": "WebSite", name: SITE_NAME, url: SITE_URL + "/" },
    author: { "@type": "Organization", name: SITE_NAME, url: SITE_URL + "/a-propos.html" },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/favicon.png`,
      },
    },
  };
  const datePublished = structuredDate(article.created_at);
  const dateModified = structuredDate(article.updated_at) || structuredDate(article.created_at);
  if (datePublished) payload.datePublished = datePublished;
  if (dateModified) payload.dateModified = dateModified;
  if (article.image) payload.image = [article.image];
  return `<script type="application/ld+json">${safeJson(payload)}</script>`;
}

const TOPIC_STOP_WORDS = new Set([
  "a", "apres", "ans", "au", "aux", "avant", "avec", "ce", "ces", "comment", "confort", "conseil", "conseils", "dans", "de", "des", "du", "en", "et", "facile", "faciles", "faire", "guide", "guides", "idees", "la", "le", "leur", "leurs", "les", "mon", "nos", "notre", "nous", "pour", "retraite", "retraites", "sans", "senior", "seniors", "ses", "simple", "simples", "son", "sur", "un", "une", "vie", "vous", "votre", "vos",
]);

function topicTerms(article) {
  return new Set(
    `${article.title || ""} ${article.subtheme || ""}`
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("fr-FR")
      .match(/[a-z0-9]+/g)
      ?.filter((term) => term.length >= 3 && !/^\d+$/.test(term) && !TOPIC_STOP_WORDS.has(term)) || []
  );
}

function relatedArticles(article, articles, limit = 3) {
  const family = themeFamily(article.theme);
  const terms = topicTerms(article);
  const seen = new Set([article.id]);
  return articles
    .filter((candidate) => candidate.id !== article.id)
    .map((candidate) => {
      if (seen.has(candidate.id)) return null;
      seen.add(candidate.id);
      const candidateFamily = themeFamily(candidate.theme);
      if (!family || candidateFamily !== family) return null;
      const sharedTerms = [...topicTerms(candidate)].filter((term) => terms.has(term));
      if (!sharedTerms.length) return null;
      return { candidate, score: sharedTerms.length, date: new Date(candidate.created_at).getTime() || 0 };
    })
    .filter(Boolean)
    .sort((left, right) => right.score - left.score || right.date - left.date || left.candidate.id.localeCompare(right.candidate.id, "fr"))
    .slice(0, limit)
    .map((entry) => entry.candidate);
}

function relatedArticlesBlock(article, articles) {
  const links = relatedArticles(article, articles).map((candidate) =>
    "<li><a href='../" + htmlEscape(candidate.id) + "/index.html'>" + htmlEscape(candidate.title) + "</a></li>"
  );
  if (!links.length) {
    return "<section class='related-articles' aria-labelledby='related-articles-title'><h2 id='related-articles-title'>Continuer votre lecture</h2><p>Explorez les guides classés par date dans les <a href='../../archive.html'>archives</a>.</p></section>";
  }
  return "<section class='related-articles' aria-labelledby='related-articles-title'><h2 id='related-articles-title'>À lire aussi</h2><ul>" + links.join("") + "</ul></section>";
}

function keyTakeaways(article) {
  if (!Array.isArray(article.key_takeaways) || article.key_takeaways.length < 2 || article.key_takeaways.length > 4) return [];
  const values = article.key_takeaways.map((item) => (typeof item === "string" ? item.trim() : ""));
  return values.every((item) => item && item.length <= 320) ? values : [];
}

function keyTakeawaysBlock(article) {
  const takeaways = keyTakeaways(article);
  if (!takeaways.length) return "";
  return "<section class='key-takeaways' aria-labelledby='key-takeaways-title'><h2 id='key-takeaways-title'>À retenir</h2><ul>" + takeaways.map((item) => `<li>${htmlEscape(item)}</li>`).join("") + "</ul></section>";
}

function sourcesBlock(article) {
  if (!Array.isArray(article.sources)) return "";
  const uniqueSources = new Map();

  for (const source of article.sources) {
    if (!source || typeof source.url !== "string") continue;
    try {
      const parsedUrl = new URL(source.url);
      if (!["http:", "https:"].includes(parsedUrl.protocol) || !parsedUrl.hostname) continue;
      parsedUrl.hash = "";
      const url = parsedUrl.toString();
      if (!uniqueSources.has(url)) {
        uniqueSources.set(url, {
          url,
          label: String(source.title || source.name || url).trim(),
        });
      }
    } catch {
      // Une source invalide est ignorée plutôt que d’être publiée.
    }
  }

  const links = [...uniqueSources.values()]
    .slice(0, 8)
    .map((source) =>
      "<li><a href='" + htmlEscape(source.url) + "' rel='noopener noreferrer' target='_blank'>" + htmlEscape(source.label) + "</a></li>"
    );
  if (!links.length) return "";
  return "<section class='article-sources' aria-labelledby='article-sources-title'><h2 id='article-sources-title'>Sources</h2><ul>" + links.join("") + "</ul></section>";
}

async function buildArticles(template, articles) {
  await fs.mkdir(articlesOutputDir, { recursive: true });

  const tasks = articles.map(async (article) => {
    const dir = path.join(articlesOutputDir, article.id);
    await fs.mkdir(dir, { recursive: true });
    const canonicalPath = `/articles/${article.id}/`;
    const canonicalUrl = `${SITE_URL}${canonicalPath}`;
    const description = metaDescription(article.excerpt);
    const publishedDate = structuredDate(article.created_at);
    const updatedDate = structuredDate(article.updated_at);
    const replacements = {
      ARTICLE_TITLE: htmlEscape(article.title),
      ARTICLE_DESCRIPTION: htmlEscape(description),
      ARTICLE_CANONICAL_URL: htmlEscape(canonicalUrl),
      ARTICLE_OG_IMAGE_TAGS: article.image
        ? `<meta property="og:image" content="${htmlEscape(article.image)}">\n<meta property="og:image:alt" content="${htmlEscape(articleImageAlt(article))}">`
        : "",
      ARTICLE_TWITTER_IMAGE_TAG: article.image
        ? `<meta name="twitter:image" content="${htmlEscape(article.image)}">\n<meta name="twitter:image:alt" content="${htmlEscape(articleImageAlt(article))}">`
        : "",
      ARTICLE_STRUCTURED_DATA: structuredData(article, canonicalUrl, description),
      ARTICLE_PUBLISHED_ISO: htmlEscape(publishedDate || ""),
      ARTICLE_PUBLISHED_HUMAN: htmlEscape(formatDateHuman(article.created_at)),
      ARTICLE_UPDATED_BLOCK: updatedDate
        ? `<span>Mis à jour le <time dateTime="${htmlEscape(updatedDate)}">${htmlEscape(formatDateHuman(article.updated_at))}</time></span>`
        : "",
      ARTICLE_THEME: htmlEscape(displayTheme(article.theme)),
      ARTICLE_SUBTHEME: htmlEscape(article.subtheme || "Découverte"),
      ARTICLE_IMAGE_BLOCK: articleImageBlock(article),
      ARTICLE_CONTENT: article.content || "",
      ARTICLE_DATA_SCRIPT: `<script id="zr-article-data" type="application/json">${safeJson({
        id: article.id,
        title: article.title,
        theme: displayTheme(article.theme),
        subtheme: article.subtheme,
        created_at: article.created_at,
        image: article.image,
        content: article.content,
        excerpt: article.excerpt,
        url: canonicalPath,
      })}</script>`,
    };
    replacements.ARTICLE_SOURCES = sourcesBlock(article);
    replacements.ARTICLE_KEY_TAKEAWAYS = keyTakeawaysBlock(article);
    replacements.ARTICLE_RELATED = relatedArticlesBlock(article, articles);
    replacements.AFFILIATE_DISCLOSURE = htmlEscape(AFFILIATE_DISCLOSURE);
    const html = renderTemplate(template, replacements);
    await fs.writeFile(path.join(dir, "index.html"), html, "utf8");
  });

  await Promise.all(tasks);
  console.log(`[build] Pages articles générées (${articles.length}).`);
}

async function buildAbout(template) {
  const replacements = {
    SITE_URL: htmlEscape(SITE_URL),
    ABOUT_STRUCTURED_DATA: aboutStructuredData(),
    AFFILIATE_DISCLOSURE: htmlEscape(AFFILIATE_DISCLOSURE),
  };
  await fs.writeFile(path.join(distDir, "a-propos.html"), renderTemplate(template, replacements), "utf8");
  console.log("[build] Page À propos générée.");
}

async function buildSitemap(articles, homeNewestDate, archiveNewestDate) {
  const urls = [
    {
      loc: `${SITE_URL}/`,
      lastmod: homeNewestDate || new Date().toISOString().slice(0, 10),
      changefreq: "hourly",
      priority: "1.0",
    },
    {
      loc: `${SITE_URL}/archive.html`,
      lastmod: archiveNewestDate || new Date().toISOString().slice(0, 10),
      changefreq: "daily",
      priority: "0.9",
    },
    {
      loc: `${SITE_URL}/a-propos.html`,
      lastmod: ABOUT_LASTMOD,
      changefreq: "monthly",
      priority: "0.6",
    },
  ];

  articles.forEach((article) => {
    urls.push({
      loc: `${SITE_URL}/articles/${article.id}/`,
      lastmod: toDateStamp(article.updated_at) || toDateStamp(article.created_at) || new Date().toISOString().slice(0, 10),
      changefreq: "weekly",
      priority: "0.8",
    });
  });

  const xmlEntries = urls
    .map(
      (url) => `
  <url>
    <loc>${htmlEscape(url.loc)}</loc>
    <lastmod>${url.lastmod}</lastmod>
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority}</priority>
  </url>`.trim()
    )
    .join("\n\n  ");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${xmlEntries}
</urlset>
`;

  await fs.writeFile(path.join(distDir, "sitemap.xml"), xml, "utf8");
  console.log("[build] sitemap.xml mis à jour.");
}

async function loadArchiveEntries(articleMap, homeIds) {
  const archiveEntries = new Map();

  // The archive is a complete index of every published article except those
  // shown on the home page. archive.json can still supply labels for existing
  // entries, but it is never the sole source of archive coverage.
  const addEntry = (entry) => {
    const id = typeof entry === "string" ? entry : typeof entry?.id === "string" ? entry.id : "";
    const normalizedId = id.trim();
    if (!normalizedId || homeIds.has(normalizedId)) return;

    const article = articleMap.get(normalizedId);
    if (!article) {
      console.warn(`[build] Article inconnu ignoré dans les archives: ${normalizedId}`);
      return;
    }
    if (archiveEntries.has(normalizedId)) return;

    archiveEntries.set(normalizedId, {
      id: normalizedId,
      title: typeof entry === "object" && entry?.title ? entry.title : article.title || null,
      created_at: typeof entry === "object" && entry?.created_at ? entry.created_at : article.created_at || null,
    });
  };

  try {
    const raw = await readJson(archiveDataPath);
    const source = Array.isArray(raw) ? raw : Array.isArray(raw.articles) ? raw.articles : [];
    source.forEach(addEntry);
  } catch (error) {
    console.warn("[build] Impossible de lire archive.json :", error.message);
  }

  // A new synchronisation may replace archive.json. Add every non-home article
  // from the authoritative article collection so old URLs keep an internal path
  // from the public archive without adding duplicate cards to the home page.
  articleMap.forEach((article) => addEntry(article));
  return [...archiveEntries.values()];
}

async function main() {
  const [templates, articles, indexIds] = await Promise.all([
    Promise.all([
      loadTemplate("home.html"),
      loadTemplate("archive.html"),
      loadTemplate("article-page.html"),
      loadTemplate("about.html"),
    ]),
    loadArticles(),
    readJson(path.join(articlesDataDir, "index.json")).catch(() => []),
  ]);

  const [homeTemplate, archiveTemplate, articleTemplate, aboutTemplate] = templates;

  await prepareDist();

  const articleMap = new Map(articles.map((article) => [article.id, article]));
  const homeArticles = sortByDateDesc(
    (indexIds || [])
      .map((id) => {
        if (!articleMap.has(id)) {
          console.warn(`[build] Article manquant pour l'accueil: ${id}`);
        }
        return articleMap.get(id);
      })
      .filter(Boolean)
  );

  const homeIdSet = new Set(homeArticles.map((article) => article.id));
  const archiveEntriesRaw = await loadArchiveEntries(articleMap, homeIdSet);
  const archiveEntries = sortByDateDesc(
    archiveEntriesRaw.map((entry) => ({
      ...entry,
      url: `./articles/${entry.id}/index.html`,
    }))
  );

  await buildHome(homeTemplate, homeArticles, archiveEntries.length);
  await buildArchive(archiveTemplate, archiveEntries);
  await buildArticles(articleTemplate, sortByDateDesc(articles));
  await buildAbout(aboutTemplate);
  await buildSitemap(
    sortByDateDesc(articles),
    toDateStamp(homeArticles[0]?.created_at),
    toDateStamp(archiveEntries[0]?.created_at)
  );
  await copyStaticAssets();

  console.log("[build] Terminé ✅");
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main().catch((error) => {
    console.error("[build] Erreur:", error);
    process.exitCode = 1;
  });
}

export { keyTakeaways, relatedArticles, structuredDate };
