// Contrôle du site réellement publié (pas seulement des fichiers générés).
// Exécutable via : npm run smoke:public
const base = (process.env.PUBLIC_BASE_URL || "https://zen-retraite.fr").replace(/\/+$/, "");
const checks = [
  { path: "/", canonical: "/", marker: 'id="home-title"', extraMarker: 'id="equipment-title"' },
  { path: "/guides-numerique.html", canonical: "/guides-numerique.html", marker: 'id="hub-title"' },
  { path: "/maison-pratique.html", canonical: "/maison-pratique.html", marker: 'id="hub-title"' },
  {
    path: "/articles/2026-10-04_07-56_gestion-des-photos_photos-souvenirs-famille/",
    canonical: "/articles/2026-10-04_07-56_gestion-des-photos_photos-souvenirs-famille/",
    marker: 'id="article-detail"',
  },
  {
    path: "/articles/2025-12-01_11-33_am-nagement-logement-senior_maison-autonomie-confort/",
    canonical: "/articles/2025-12-01_11-33_am-nagement-logement-senior_maison-autonomie-confort/",
    marker: 'id="fiche-diagnostic-logement"',
  },
  { path: "/sitemap.xml", marker: "<urlset" },
  { path: "/robots.txt", marker: "Sitemap:" },
];

async function fetchWithRetry(check) {
  const url = base + check.path;
  for (let attempt = 1; attempt <= 7; attempt++) {
    try {
      const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(15000), cache: "no-store" });
      if (!response.ok) throw new Error("HTTP " + response.status);
      const text = await response.text();
      if (text.length < 30) throw new Error("Réponse vide ou trop courte");
      for (const marker of [check.marker, check.extraMarker].filter(Boolean)) {
        if (!text.includes(marker)) throw new Error("Contenu attendu absent : " + marker);
      }
      if (check.canonical && (!text.includes('<link rel="canonical" href="' + base + check.canonical + '">') || !text.includes("<h1"))) {
        throw new Error("Canonique ou h1 absent");
      }
      return text;
    } catch (error) {
      if (attempt === 7) throw new Error(url + " : " + error.message);
      console.warn("[smoke] Tentative " + attempt + "/7 pour " + check.path + " : " + error.message);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

async function main() {
  const contents = new Map();
  for (const check of checks) {
    const body = await fetchWithRetry(check);
    if (!body.includes(check.marker)) throw new Error(check.path + " : contenu essentiel absent (" + check.marker + ")");
    if (check.canonical && !body.includes('<link rel="canonical" href="' + base + check.canonical + '">')) {
      throw new Error(check.path + " : URL canonique absente ou incorrecte");
    }
    if (check.canonical && !body.includes("<h1")) throw new Error(check.path + " : h1 absent");
    contents.set(check.path, body);
    console.log("[smoke] OK " + base + check.path);
  }
  const sitemap = contents.get("/sitemap.xml");
  for (const check of checks.filter((entry) => entry.canonical)) {
    if (!sitemap.includes("<loc>" + base + check.canonical + "</loc>")) {
      throw new Error("Le sitemap n'inclut pas l'URL prioritaire " + check.canonical);
    }
  }
  const robots = contents.get("/robots.txt");
  if (!robots.includes("Sitemap: " + base + "/sitemap.xml")) {
    throw new Error("robots.txt : déclaration du sitemap absente ou incohérente");
  }
  console.log("[smoke] Pages, canoniques, h1, sitemap et robots.txt contrôlés.");
}

main().catch((error) => {
  console.error("[smoke] Échec :", error.message);
  process.exitCode = 1;
});
