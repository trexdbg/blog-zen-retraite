import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { articleCategory } from "../scripts/build.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFile(path.join(root, p), "utf8");

test("home offers problem-led navigation to real guides", async () => {
  const home = await read("templates/home.html");
  const ids = [
    "2025-11-14_20-43_autonomie-num-rique_num-rique-facile-connexion",
    "2026-10-04_07-56_gestion-des-photos_photos-souvenirs-famille",
    "2026-10-11_20-28_s-curit-des-comptes-en-ligne_t-l-phone-connexion-s-curis-e",
    "2025-11-27_18-43_technologie-au-quotidien_num-rique-facile-vie",
    "2025-12-01_11-33_am-nagement-logement-senior_maison-autonomie-confort"
  ];
  assert.match(home, /id="parcours"/);
  assert.match(home, /Choisissez votre problème, pas un produit/);
  for (const id of ids) {
    assert.match(home, new RegExp(id));
    const data = JSON.parse(await read(`data/articles/${id}.json`));
    assert.ok(data.title && !data.superseded_by, `Home links to an unpublished or superseded guide: ${id}`);
  }
});

test("updated Wi-Fi guide has actionable sections, public sources and no forced product", async () => {
  const data = JSON.parse(await read("data/articles/2025-11-27_18-43_technologie-au-quotidien_num-rique-facile-vie.json"));
  assert.match(data.title, /Wi-Fi/);
  assert.equal(data.theme, "numerique_pratique");
  assert.ok(data.key_takeaways?.length >= 3);
  assert.ok(data.sources?.some(s => s.url.includes("cybermalveillance.gouv.fr")));
  assert.match(data.content, /WPA2/);
  assert.match(data.content, /mot de passe/);
  assert.match(data.content, /r.seau invit./i);
  assert.doesNotMatch(data.content, /amazon.fr|nous avons test.|Apolosign|SPC Zeus/i);
  assert.match(data.image, /editorial-confidentialite\.svg/);
  assert.equal(data.updated_at, "2026-10-21");
});

test("about page defines new mission without claiming physical product tests", async () => {
  const about = await read("templates/about.html");
  assert.match(about, /apprivoiser le numérique/);
  assert.match(about, /simplifier le quotidien à la maison/);
  assert.match(about, /ne remplacent pas la vérification humaine/);
});

test("FranceConnect belongs to digital help even when the title mentions procedures", () => {
  assert.equal(articleCategory({ title: "Démarches en ligne : mieux comprendre FranceConnect", theme: "numerique_pratique", subtheme: "identite-numerique" }), "numerique_pratique");
  assert.equal(articleCategory({ title: "Réduire son budget courses", theme: "maison", subtheme: "budget" }), "budget");
});

test("topic hubs link exclusively to articles that are not superseded", async () => {
  const templates = ["guides-numerique.html", "maison-pratique.html"];
  for (const file of templates) {
    const html = await read("templates/" + file);
    const ids = [...html.matchAll(/href="\/articles\/([^/]+)\/"/g)].map(match => match[1]);
    assert.ok(ids.length >= 3, "hub should feature substantive existing articles: " + file);
    for (const id of ids) {
      const article = JSON.parse(await read("data/articles/" + id + ".json"));
      assert.ok(!article.superseded_by, "hub links to a replaced article: " + id);
    }
  }
});

test("permissions guide gives a tested, source-backed Android and iPhone path", async () => {
  const guide = JSON.parse(await read("data/articles/2026-10-17_18-40_applications-mobiles-et-vie-priv-e_smartphone-applications-mobiles.json"));
  assert.match(guide.content, /Sur Android : vérifier une autorisation/);
  assert.match(guide.content, /Sur iPhone : voir quelles applications/);
  assert.match(guide.content, /Gestionnaire d.autorisations/);
  assert.match(guide.content, /Confidentialité et sécurité/);
  assert.ok(guide.sources.some(source => source.url.includes("support.google.com/android/")));
  assert.ok(guide.sources.some(source => source.url.includes("support.apple.com/fr-fr/guide/iphone/")));
  assert.equal(guide.updated_at, "2026-10-21");
});

test("messaging safety guide provides Gmail and Microsoft setup and recovery steps", async () => {
  const guide = JSON.parse(await read("data/articles/2026-10-11_20-28_s-curit-des-comptes-en-ligne_t-l-phone-connexion-s-curis-e.json"));
  assert.match(guide.content, /Pour une adresse Gmail/);
  assert.match(guide.content, /Outlook\.com ou Hotmail/);
  assert.match(guide.content, /Vérifier que tout fonctionne sans se bloquer/);
  assert.match(guide.content, /moyen de récupération supplémentaire|moyens de récupération|moyen de retrouver l'accès/);
  assert.ok(guide.sources.some(source => source.url.includes("support.google.com/mail/answer/185839")));
  assert.ok(guide.sources.some(source => source.url.includes("support.microsoft.com/fr-fr/accounts-billing/security/")));
  assert.doesNotMatch(guide.content, /href="\/articles\/2026-10-07_20-07_s-curit-des-comptes-en-ligne_t-l-phone-connexion-s-curis-e\/"/);
  assert.equal(guide.updated_at, "2026-11-04");
});

test("photos guide has distinct Android and iPhone paths and warns about cloud sync", async () => {
  const guide = JSON.parse(await read("data/articles/2026-10-04_07-56_gestion-des-photos_photos-souvenirs-famille.json"));
  assert.match(guide.content, /Sur Android/);
  assert.match(guide.content, /Sur iPhone/);
  assert.match(guide.content, /Sauvegarde terminée/);
  assert.match(guide.content, /une sauvegarde indépendante/);
  assert.ok(guide.sources.some(source => source.url.includes("support.google.com/photos/answer/9343402")));
  assert.ok(guide.sources.some(source => source.url.includes("support.apple.com/fr-fr/120267")));
  assert.equal(guide.updated_at, "2026-11-04");
});
