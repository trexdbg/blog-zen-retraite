// Audit interne du catalogue d'affiliation. Aucune requête Amazon n'est effectuée.
// Les dates "expires_at" sont des échéances de revalidation documentaire,
// PAS une preuve de stock, de prix, de présence en ligne ou de compte actif.
import { readFile, readdir, appendFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalog = JSON.parse(await readFile(path.join(root, "data/affiliate-approved-products.json"), "utf8"));
if (catalog.version !== 1 || !Array.isArray(catalog.products) || !/^[A-Za-z0-9-]{3,64}$/.test(catalog.affiliate_tag || "")) {
  throw new Error("Catalogue d'affiliation invalide");
}
const productMap = new Map();
for (const product of catalog.products) {
  if (!/^[A-Z0-9]{10}$/.test(product.asin || "") || !/^\d{4}-\d{2}-\d{2}$/.test(product.expires_at || "") || productMap.has(product.asin)) {
    throw new Error("Produit invalide ou dupliqué : " + (product.asin || "sans ASIN"));
  }
  productMap.set(product.asin, product);
}

const date = new Date().toISOString().slice(0, 10);
const warningDate = new Date(Date.now() + 21 * 86400000).toISOString().slice(0, 10);
const files = (await readdir(path.join(root, "data/articles"))).filter((file) => file.endsWith(".json") && file !== "index.json");
const entries = await Promise.all(files.map(async file => JSON.parse(await readFile(path.join(root, "data/articles", file), "utf8"))));
const publishedIds = new Set(entries.filter(a => a?.id && !a?.superseded_by).map(a => a.id));
const usage = new Map();
let ignoredLinks = 0;
let expiredLinks = 0;
let validLinks = 0;
const blockedExamples = [];
for (const article of entries) {
  if (!article.id || !publishedIds.has(article.id)) continue;
  for (const match of (article.content || "").matchAll(/<a\b[^>]*\bhref=(["'])(.*?)\1[^>]*>/gi)) {
    const raw = match[2].replace(/&amp;/gi, "&");
    let url;
    try { url = new URL(raw); } catch { continue; }
    if (!["amazon.fr", "www.amazon.fr"].includes(url.hostname.toLowerCase())) continue;
    const asin = url.pathname.match(/^\/dp\/([A-Z0-9]{10})\/?$/i)?.[1]?.toUpperCase();
    const product = productMap.get(asin);
    if (url.protocol !== "https:" || url.username || url.password || url.port || !product || url.searchParams.get("tag") !== catalog.affiliate_tag) {
      ignoredLinks++;
      if (blockedExamples.length < 8) blockedExamples.push(article.id + " : destination ou tag non approuvé");
      continue;
    }
    if (product.expires_at < date) {
      expiredLinks++;
      if (blockedExamples.length < 8) blockedExamples.push(article.id + " : référence à revalider (" + asin + ")");
      continue;
    }
    validLinks++;
    const list = usage.get(asin) || new Set();
    list.add(article.id);
    usage.set(asin, list);
  }
}
const due = catalog.products.filter(p => p.expires_at <= warningDate).sort((a, b) => a.expires_at.localeCompare(b.expires_at));
const activeUse = [...usage.entries()].sort((a, b) => b[1].size - a[1].size);
const lines = [
  "## Zen Retraite — audit des références Amazon",
  "",
  "Date du contrôle : " + date,
  "",
  "| Indicateur interne | Nombre |",
  "|---|---:|",
  "| Produits du catalogue documenté | " + productMap.size + " |",
  "| Pages publiées examinées | " + publishedIds.size + " |",
  "| Liens approuvés et non expirés dans les sources | " + validLinks + " |",
  "| Références distinctes effectivement utilisées | " + usage.size + " |",
  "| Liens de source non approuvés (bloqués au build) | " + ignoredLinks + " |",
  "| Liens à revalider avant republication | " + expiredLinks + " |",
  "| Produits à revalider sous 21 jours | " + due.length + " |",
  "",
  "**Limite :** ce contrôle analyse seulement les données locales. Il ne vérifie pas le stock, le prix, la fiche Amazon actuelle, l'approbation du compte Partenaires ni les commissions.",
  "",
  "### Références utilisées",
  ...(activeUse.length ? activeUse.map(([asin, ids]) => "- " + asin + " — " + productMap.get(asin).title + " ; " + ids.size + " article(s) ; à revoir avant " + productMap.get(asin).expires_at) : ["Aucune référence active utilisée."]),
  "",
  "### Références approchant de la revalidation",
  ...(due.length ? due.map(p => "- " + p.asin + " — " + p.title + " ; échéance " + p.expires_at + (usage.has(p.asin) ? " (en ligne dans un guide)" : " (non utilisée)")) : ["Aucune dans les 21 prochains jours."]),
  "",
  "### Anomalies de liens dans les sources",
  ...(blockedExamples.length ? blockedExamples.map(v => "- " + v) : ["Aucune anomalie détectée dans l'échantillon."]),
  "",
  "La validation finale d'un produit doit être réalisée sur sa fiche Amazon et sa fiche fabricant, sans inventer de prix ni de disponibilité.",
  ""
];
const report = lines.join("\n");
console.log(report);
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, report + "\n");
if (expiredLinks || ignoredLinks) console.warn("[affiliate-audit] Liens de source ignorés par les contrôles de publication : " + (expiredLinks + ignoredLinks));
// Les pages restent publiables : le build retire déjà les liens non approuvés.
// L'audit reste informatif pour éviter de cacher un guide entier à cause d'un seul lien.
