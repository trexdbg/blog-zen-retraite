import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

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
