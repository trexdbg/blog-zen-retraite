/* Zen Retraite — consentement pour la mesure d'audience GA4.
 * Aucun code tiers Analytics n'est téléchargé avant le consentement explicite.
 * Consent Mode v2 basique : pas de signal publicitaire ni de ping sans accord.
 */
(() => {
  "use strict";

  const GA_ID = "G-HZTBGCK3YM";
  const STORAGE_KEY = "zr-analytics-consent-v1";
  const SIX_MONTHS = 183 * 24 * 60 * 60 * 1000;
  let trackingStarted = false;

  function readChoice() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (stored && ["accepted", "rejected"].includes(stored.choice)
          && Number.isFinite(stored.expires) && Date.now() < stored.expires) {
        return stored.choice;
      }
    } catch { /* Stockage indisponible : on demande le consentement. */ }
    return null;
  }

  function saveChoice(choice) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ choice, expires: Date.now() + SIX_MONTHS }));
    } catch { /* Aucun suivi n'est activé par défaut. */ }
  }

  function startAnalytics() {
    if (trackingStarted) return;
    trackingStarted = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };

    window.gtag("consent", "default", {
      analytics_storage: "denied",
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied"
    });
    window.gtag("consent", "update", { analytics_storage: "granted" });
    window.gtag("js", new Date());
    window.gtag("config", GA_ID, {
      allow_google_signals: false,
      allow_ad_personalization_signals: false
    });

    const tag = document.createElement("script");
    tag.async = true;
    tag.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(GA_ID);
    tag.referrerPolicy = "strict-origin-when-cross-origin";
    document.head.appendChild(tag);
  }

  function clearAnalyticsCookies() {
    // Retirer les cookies Analytics sur le domaine actif lors d'un retrait.
    const host = location.hostname;
    const domains = ["", host, "." + host];
    if (host === "zen-retraite.fr" || host.endsWith(".zen-retraite.fr")) {
      domains.push("zen-retraite.fr", ".zen-retraite.fr");
    }
    for (const entry of document.cookie.split(";")) {
      const name = entry.split("=")[0].trim();
      if (!/^_ga(?:_|$)/.test(name)) continue;
      for (const domain of new Set(domains)) {
        const suffix = domain ? "; domain=" + domain : "";
        document.cookie = name + "=; Max-Age=0; path=/; SameSite=Lax" + suffix;
      }
    }
  }

  function setChoice(choice) {
    const wasTracking = trackingStarted;
    saveChoice(choice);
    banner.hidden = true;
    if (choice === "accepted") {
      startAnalytics();
    } else if (wasTracking) {
      // Révoquer le consentement et recharger sans la balise tierce.
      window.gtag?.("consent", "update", { analytics_storage: "denied" });
      clearAnalyticsCookies();
      location.reload();
    }
    preferencesButton.focus();
  }

  const banner = document.createElement("section");
  banner.id = "zr-cookie-banner";
  banner.className = "cookie-banner";
  banner.setAttribute("role", "region");
  banner.setAttribute("aria-labelledby", "zr-cookie-title");
  banner.innerHTML = `
    <div class="cookie-banner-copy">
      <h2 id="zr-cookie-title">Vos préférences de confidentialité</h2>
      <p>Avec votre accord, Google Analytics utilise des cookies pour mesurer la fréquentation du site.
      Vous pouvez refuser sans conséquence pour la lecture des articles.
      <a href="/a-propos.html#confidentialite">En savoir plus</a>.</p>
    </div>
    <div class="cookie-banner-actions">
      <button type="button" class="cookie-choice" data-consent="rejected">Tout refuser</button>
      <button type="button" class="cookie-choice" data-consent="accepted">Tout accepter</button>
    </div>`;
  banner.hidden = true;
  banner.querySelector('[data-consent="accepted"]').addEventListener("click", () => setChoice("accepted"));
  banner.querySelector('[data-consent="rejected"]').addEventListener("click", () => setChoice("rejected"));

  const preferencesButton = document.createElement("button");
  preferencesButton.type = "button";
  preferencesButton.className = "cookie-settings-link";
  preferencesButton.textContent = "Gérer les cookies";
  preferencesButton.addEventListener("click", () => {
    banner.hidden = false;
    banner.querySelector('[data-consent="rejected"]').focus();
  });

  document.body.appendChild(banner);
  const footer = document.querySelector(".footer-bottom");
  if (footer) footer.appendChild(preferencesButton);
  else document.body.appendChild(preferencesButton);

  const choice = readChoice();
  if (choice === "accepted") startAnalytics();
  else if (!choice) banner.hidden = false;
})();
