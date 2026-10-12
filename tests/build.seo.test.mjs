import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { articleContentWithToc, cleanArticleContent, keyTakeaways, relatedArticles, relatedArticlesBlock, structuredDate } from "../scripts/build.js";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const run = (file, args, options) => new Promise((resolve, reject) => execFile(file, args, options, (error, stdout, stderr) => error ? reject(error) : resolve({ stdout, stderr })));

test("structured dates make Actions timestamps explicitly UTC while preserving offsets", () => {
  assert.equal(structuredDate("2026-10-04T07:56:44"), "2026-10-04T07:56:44Z");
  assert.equal(structuredDate("2026-10-04T09:56:44+02:00"), "2026-10-04T09:56:44+02:00");
  assert.equal(structuredDate("2026-10-04"), "2026-10-04");
  assert.equal(structuredDate("2026-99-99T07:56:44"), null);
  assert.equal(structuredDate("2026-02-30T07:56:44"), null);
  assert.equal(structuredDate("October 5, 2026"), null);
  assert.equal(structuredDate("2026-10-04T07:56:44+25:00"), null);
});

test("related articles require a shared topic inside the same family", () => {
  const article = { id: "photos", theme: "numerique_pratique", subtheme: "gestion des photos", title: "Sauvegarder ses photos" };
  const candidates = [
    { id: "photo-albums", theme: "numerique_pratique", subtheme: "albums photos", title: "Classer ses photos de famille", created_at: "2026-10-03T10:00:00Z" },
    { id: "lecture", theme: "numerique_pratique", subtheme: "lecture optique", title: "Lire confortablement sur écran", created_at: "2026-10-04T10:00:00Z" },
    { id: "photos", theme: "numerique_pratique", subtheme: "gestion des photos", title: "Sauvegarder ses photos", created_at: "2026-10-05T10:00:00Z" },
    { id: "other", theme: "maison", subtheme: "photos", title: "Cadres photos", created_at: "2026-10-05T10:00:00Z" },
  ];
  assert.deepEqual(relatedArticles(article, candidates).map((item) => item.id), ["photo-albums"]);
});

test("related article links use their canonical trailing-slash URL", () => {
  const article = { id: "photos", theme: "numerique_pratique", subtheme: "gestion des photos", title: "Sauvegarder ses photos" };
  const candidate = { id: "photo-albums", theme: "numerique_pratique", subtheme: "albums photos", title: "Classer ses photos", created_at: "2026-10-03T10:00:00Z" };
  const html = relatedArticlesBlock(article, [candidate]);
  assert.match(html, /href='\/articles\/photo-albums\/'/);
  assert.doesNotMatch(html, /index\.html/);
});

test("generic retirement terms alone do not create a related link", () => {
  const article = { id: "budget", theme: "finances", subtheme: "budget", title: "Conseils simples pour la retraite en 2026" };
  const candidate = { id: "comfort", theme: "finances", subtheme: "confort", title: "Nos idées pour les seniors et leur vie après la retraite en 2026", created_at: "2026-10-04T10:00:00Z" };
  assert.deepEqual(relatedArticles(article, [candidate]), []);
});

test("key takeaways only render valid editorial metadata", () => {
  assert.deepEqual(keyTakeaways({ key_takeaways: ["Première idée.", "Deuxième idée."] }), ["Première idée.", "Deuxième idée."]);
  assert.deepEqual(keyTakeaways({ key_takeaways: ["Une seule idée."] }), []);
  assert.deepEqual(keyTakeaways({ key_takeaways: ["Une idée.", 42] }), []);
});

test("table of contents only annotates h2 headings with collision-proof anchors", () => {
  const content = '<p><a href="#existing">Lien conservé</a></p><h2 id="existing">Déjà présent</h2><h2>Choisir son matériel</h2><h2>Choisir son matériel</h2>';
  const rendered = articleContentWithToc(content);
  assert.match(rendered.toc, /article-toc/);
  assert.match(rendered.html, /href="#existing"/);
  assert.match(rendered.html, /<h2 id="existing">Déjà présent<\/h2>/);
  assert.match(rendered.html, /id="choisir-son-materiel"/);
  assert.match(rendered.html, /id="choisir-son-materiel-1"/);
  assert.match(rendered.toc, /href="#choisir-son-materiel-1"/);
  assert.equal(articleContentWithToc("<h2>Un</h2><h2>Deux</h2>").toc, "");
});

test("content cleanup preserves Amazon URLs while deduplicating the disclosure", () => {
  const input = '<aside class="affiliate-disclosure"><p><strong>Information d’affiliation :</strong> En tant que Partenaire Amazon, je réalise un bénéfice sur les achats remplissant les conditions requises.</p></aside><p><a href="https://www.amazon.fr/dp/B081VJ79QZ?tag=example-21" rel="nofollow sponsored">Disque dur (lien affilié)</a></p>';
  const cleaned = cleanArticleContent(input);
  assert.doesNotMatch(cleaned, /Partenaire Amazon/);
  assert.doesNotMatch(cleaned, /\(lien affilié\)/);
  assert.match(cleaned, /https:\/\/www\.amazon\.fr\/dp\/B081VJ79QZ\?tag=example-21/);
  assert.match(cleaned, /rel="nofollow sponsored"/);
});

test("static build preserves every archived article and adds the about page to the sitemap", async () => {
  await run(process.execPath, ["scripts/build.js"], { cwd: rootDir });
  const articlesDir = path.join(rootDir, "data", "articles");
  const articleFiles = (await readdir(articlesDir)).filter((file) => file.endsWith(".json") && file !== "index.json");
  const records = await Promise.all(articleFiles.map(async (file) => JSON.parse(await readFile(path.join(articlesDir, file), "utf8"))));
  const articleIds = new Set(records.map((record) => record.id));
  const supersededIds = new Set(records.filter((record) => articleIds.has(record.superseded_by)).map((record) => record.id));
  const publishedIds = new Set([...articleIds].filter((id) => !supersededIds.has(id)));
  const homeIds = new Set(JSON.parse(await readFile(path.join(articlesDir, "index.json"), "utf8")).filter((id) => publishedIds.has(id)));
  const expectedArchiveIds = new Set([...publishedIds].filter((id) => !homeIds.has(id)));
  const [archive, sitemap] = await Promise.all([
    readFile(path.join(rootDir, "dist", "archive.html"), "utf8"),
    readFile(path.join(rootDir, "dist", "sitemap.xml"), "utf8"),
  ]);
  const home = await readFile(path.join(rootDir, "dist", "index.html"), "utf8");
  const archiveData = archive.match(/<script id="zr-archive-data" type="application\/json">([\s\S]*?)<\/script>/);
  assert.ok(archiveData);
  const archiveEntries = JSON.parse(archiveData[1]).entries;
  assert.deepEqual(new Set(archiveEntries.map((entry) => entry.id)), expectedArchiveIds);
  const homeData = home.match(/<script id="zr-home-data" type="application\/json">([\s\S]*?)<\/script>/);
  assert.ok(homeData);
  const homeArticles = JSON.parse(homeData[1]).articles;
  assert.deepEqual(new Set(homeArticles.map((entry) => entry.id)), publishedIds);
  const latestIds = [...homeArticles]
    .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
    .slice(0, 6)
    .map((entry) => entry.id);
  const visibleCardIds = [...home.matchAll(/<article class="card" data-article-id="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(visibleCardIds, latestIds);
  assert.match(home, /id="search-input"/);
  assert.match(home, /id="load-more"/);
  assert.match(home, /archive\.html\?theme=/);
  for (const entry of [...homeArticles, ...archiveEntries]) {
    assert.equal(entry.url, `/articles/${encodeURIComponent(entry.id)}/`);
  }
  for (const entry of homeArticles.filter((entry) => visibleCardIds.includes(entry.id))) {
    assert.ok(home.includes(`href="/articles/${encodeURIComponent(entry.id)}/"`));
  }
  for (const entry of archiveEntries) {
    assert.ok(archive.includes(`href="/articles/${encodeURIComponent(entry.id)}/"`));
  }
  const legacyArticleHref = /href=['\"][^'\"]*(?:\/articles\/[^'\"]+|(?:\.\.\/)+[A-Za-z0-9_%~-]+)\/index\.html/;
  assert.doesNotMatch(home, legacyArticleHref);
  assert.doesNotMatch(archive, legacyArticleHref);
  const sitemapLocs = new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]));
  assert.equal(sitemapLocs.size, publishedIds.size + 3);
  assert.match(sitemap, /https:\/\/zen-retraite\.fr\/a-propos\.html/);
  for (const id of publishedIds) assert.ok(sitemapLocs.has(`https://zen-retraite.fr/articles/${id}/`), `missing article URL: ${id}`);
  for (const id of supersededIds) assert.ok(!sitemapLocs.has(`https://zen-retraite.fr/articles/${id}/`));
  assert.match(sitemap, /<loc>https:\/\/zen-retraite\.fr\/a-propos\.html<\/loc>\s*<lastmod>2026-10-05<\/lastmod>/);
  const photoId = "2026-10-04_07-56_gestion-des-photos_photos-souvenirs-famille";
  const source = JSON.parse(await readFile(path.join(articlesDir, `${photoId}.json`), "utf8"));
  const article = await readFile(path.join(rootDir, "dist", "articles", photoId, "index.html"), "utf8");
  assert.doesNotMatch(article, legacyArticleHref);
  const articleData = article.match(/<script id="zr-article-data" type="application\/json">([\s\S]*?)<\/script>/);
  assert.ok(articleData);
  assert.equal(JSON.parse(articleData[1]).url, `/articles/${photoId}/`);
  const clientScript = await readFile(path.join(rootDir, "script.js"), "utf8");
  assert.doesNotMatch(clientScript, /\/articles\/[^`"']*\/index\.html/);
  assert.match(clientScript, /function articlePath\(id\)/);
  const jsonLd = article.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(jsonLd);
  assert.equal(JSON.parse(jsonLd[1]).datePublished, structuredDate(source.created_at));
  assert.equal(JSON.parse(jsonLd[1]).dateModified, structuredDate(source.updated_at) || structuredDate(source.created_at));
  if (structuredDate(source.updated_at)) assert.match(article, /Mis à jour le/);
  assert.equal((article.match(/En tant que Partenaire Amazon/g) || []).length, 1, "affiliate notice should appear once per article");
  assert.match(article, /<script type="application\/ld\+json">[\s\S]*?"citation":\[/);
  assert.match(article, /"@type":"BreadcrumbList"/);
  assert.match(article, /https:\/\/www\.amazon\.fr\/dp\/B081VJ79QZ/);
  const legacyId = "2025-11-20_18-46_technologie-confort-autonomie_maison-connect-e-sant";
  const legacy = await readFile(path.join(rootDir, "dist", "articles", legacyId, "index.html"), "utf8");
  assert.match(legacy, /<h2 id='key-takeaways-title'>/);
  assert.match(legacy, /"@type":"BreadcrumbList"/);
  const olderId = "2026-10-07_20-07_s-curit-des-comptes-en-ligne_t-l-phone-connexion-s-curis-e";
  const newerId = "2026-10-11_20-28_s-curit-des-comptes-en-ligne_t-l-phone-connexion-s-curis-e";
  const olderHtml = await readFile(path.join(rootDir, "dist", "articles", olderId, "index.html"), "utf8");
  assert.match(olderHtml, new RegExp('rel="canonical" href="https://zen-retraite.fr/articles/' + newerId + '/"'));
  assert.match(olderHtml, /lire le guide actualisé/);
  assert.ok(!homeArticles.some((article) => article.id === olderId));
  assert.ok(!archiveEntries.some((article) => article.id === olderId));

});
