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
const articlesOutputDir = path.join(rootDir, "articles");

const SITE_URL = (process.env.SITE_URL || "https://zen-retraite.fr").replace(/\/+$/, "");
const DATE_FORMATTER = new Intl.DateTimeFormat("fr-FR", { year: "numeric", month: "long", day: "numeric" });

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
  if (!trimmed || trimmed.toLowerCase() === "n/a") return null;
  return trimmed;
}

function formatDateHuman(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return DATE_FORMATTER.format(date);
}

function toDateStamp(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function metaDescription(text) {
  const fallback = "Zen Retraite partage des inspirations pour une retraite active et sereine.";
  if (!text) return fallback;
  const sanitized = String(text).replace(/\s+/g, " ").trim();
  if (!sanitized) return fallback;
  if (sanitized.length <= 160) return sanitized;
  return `${sanitized.slice(0, 157).trim()}…`;
}

async function loadTemplate(name) {
  const filePath = path.join(templatesDir, name);
  return fs.readFile(filePath, "utf8");
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
    ? `<img src="${htmlEscape(article.image)}" data-src="${htmlEscape(article.image)}" alt="${htmlEscape(article.title)}" loading="lazy">`
    : "";
  const theme = article.theme || "Inspiration";
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

async function buildHome(template, articles) {
  const cards = articles.map(buildCard).join("\n");
  const listData = articles.map((article) => ({
    id: article.id,
    title: article.title,
    excerpt: article.excerpt,
    theme: article.theme,
    subtheme: article.subtheme,
    image: article.image,
    created_at: article.created_at,
    url: `./articles/${article.id}/index.html`,
  }));

  const replacements = {
    HOME_ARTICLE_LIST: cards,
    HOME_EMPTY_STATE_ATTR: articles.length ? "hidden" : "",
    HOME_DATA_SCRIPT: `<script id="zr-home-data" type="application/json">${safeJson({ articles: listData })}</script>`,
  };

  const html = renderTemplate(template, replacements);
  await fs.writeFile(path.join(rootDir, "index.html"), html, "utf8");
  console.log(`[build] Accueil généré (${articles.length} articles).`);
}

async function buildArchive(template, entries) {
  const listHtml = entries.map(buildArchiveItem).join("\n");
  const replacements = {
    ARCHIVE_LIST: listHtml,
    ARCHIVE_EMPTY_STATE_ATTR: entries.length ? "hidden" : "",
    ARCHIVE_DATA_SCRIPT: `<script id="zr-archive-data" type="application/json">${safeJson({ entries })}</script>`,
  };
  const html = renderTemplate(template, replacements);
  await fs.writeFile(path.join(rootDir, "archive.html"), html, "utf8");
  console.log(`[build] Archives générées (${entries.length} entrées).`);
}

function articleImageBlock(article) {
  if (!article.image) return "";
  return `<img src="${htmlEscape(article.image)}" alt="${htmlEscape(article.title)}" loading="lazy">`;
}

function structuredData(article, canonicalUrl, description) {
  const payload = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: article.title,
    description,
    datePublished: article.created_at,
    dateModified: article.updated_at || article.created_at,
    mainEntityOfPage: canonicalUrl,
    author: { "@type": "Organization", name: "Zen Retraite" },
    publisher: {
      "@type": "Organization",
      name: "Zen Retraite",
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/favicon.png`,
      },
    },
  };
  if (article.image) payload.image = [article.image];
  return `<script type="application/ld+json">${safeJson(payload)}</script>`;
}

async function buildArticles(template, articles) {
  await fs.rm(articlesOutputDir, { recursive: true, force: true });
  await fs.mkdir(articlesOutputDir, { recursive: true });

  const tasks = articles.map(async (article) => {
    const dir = path.join(articlesOutputDir, article.id);
    await fs.mkdir(dir, { recursive: true });
    const canonicalPath = `/articles/${article.id}/`;
    const canonicalUrl = `${SITE_URL}${canonicalPath}`;
    const description = metaDescription(article.excerpt);
    const replacements = {
      ARTICLE_TITLE: htmlEscape(article.title),
      ARTICLE_DESCRIPTION: htmlEscape(description),
      ARTICLE_CANONICAL_URL: htmlEscape(canonicalUrl),
      ARTICLE_OG_IMAGE_TAGS: article.image
        ? `<meta property="og:image" content="${htmlEscape(article.image)}">\n<meta property="og:image:alt" content="${htmlEscape(article.title)}">`
        : "",
      ARTICLE_TWITTER_IMAGE_TAG: article.image
        ? `<meta name="twitter:image" content="${htmlEscape(article.image)}">`
        : "",
      ARTICLE_STRUCTURED_DATA: structuredData(article, canonicalUrl, description),
      ARTICLE_PUBLISHED_ISO: htmlEscape(article.created_at || ""),
      ARTICLE_PUBLISHED_HUMAN: htmlEscape(formatDateHuman(article.created_at)),
      ARTICLE_THEME: htmlEscape(article.theme || "Inspiration"),
      ARTICLE_SUBTHEME: htmlEscape(article.subtheme || "Découverte"),
      ARTICLE_IMAGE_BLOCK: articleImageBlock(article),
      ARTICLE_CONTENT: article.content || "",
      ARTICLE_DATA_SCRIPT: `<script id="zr-article-data" type="application/json">${safeJson({
        id: article.id,
        title: article.title,
        theme: article.theme,
        subtheme: article.subtheme,
        created_at: article.created_at,
        image: article.image,
        content: article.content,
        excerpt: article.excerpt,
        url: canonicalPath,
      })}</script>`,
    };
    const html = renderTemplate(template, replacements);
    await fs.writeFile(path.join(dir, "index.html"), html, "utf8");
  });

  await Promise.all(tasks);
  console.log(`[build] Pages articles générées (${articles.length}).`);
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
  ];

  articles.forEach((article) => {
    urls.push({
      loc: `${SITE_URL}/articles/${article.id}/`,
      lastmod: toDateStamp(article.created_at) || new Date().toISOString().slice(0, 10),
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

  await fs.writeFile(path.join(rootDir, "sitemap.xml"), xml, "utf8");
  console.log("[build] sitemap.xml mis à jour.");
}

async function loadArchiveEntries(articleMap) {
  try {
    const raw = await readJson(archiveDataPath);
    const source = Array.isArray(raw) ? raw : Array.isArray(raw.articles) ? raw.articles : [];
    return source
      .map((entry) => {
        if (typeof entry === "string") {
          const article = articleMap.get(entry);
          return {
            id: entry,
            title: article?.title || null,
            created_at: article?.created_at || null,
          };
        }
        if (!entry || !entry.id) return null;
        const article = articleMap.get(entry.id);
        return {
          id: entry.id,
          title: entry.title || article?.title || null,
          created_at: entry.created_at || article?.created_at || null,
        };
      })
      .filter(Boolean);
  } catch (error) {
    console.warn("[build] Impossible de lire archive.json :", error.message);
    return [];
  }
}

async function main() {
  const [templates, articles, indexIds] = await Promise.all([
    Promise.all([
      loadTemplate("home.html"),
      loadTemplate("archive.html"),
      loadTemplate("article-page.html"),
    ]),
    loadArticles(),
    readJson(path.join(articlesDataDir, "index.json")).catch(() => []),
  ]);

  const [homeTemplate, archiveTemplate, articleTemplate] = templates;

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

  const archiveEntriesRaw = await loadArchiveEntries(articleMap);
  const archiveEntries = sortByDateDesc(
    archiveEntriesRaw.map((entry) => ({
      ...entry,
      url: `./articles/${entry.id}/index.html`,
    }))
  );

  await buildHome(homeTemplate, homeArticles);
  await buildArchive(archiveTemplate, archiveEntries);
  await buildArticles(articleTemplate, sortByDateDesc(articles));
  await buildSitemap(
    sortByDateDesc(articles),
    toDateStamp(homeArticles[0]?.created_at),
    toDateStamp(archiveEntries[0]?.created_at)
  );

  console.log("[build] Terminé ✅");
}

main().catch((error) => {
  console.error("[build] Erreur:", error);
  process.exitCode = 1;
});
