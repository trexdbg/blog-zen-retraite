Zen Retraite - generation statique (SSG)
========================================

Le site HTML est desormais pre-genere a partir des fichiers JSON situes dans `data/`. Chaque build injecte le contenu de vos articles dans des pages totalement statiques (HTML + JSON-LD) puis depose les fichiers finis dans `dist/`, pret a etre deployes (SEO + GEO friendly) sur GitHub Pages, Netlify ou tout autre hebergeur statique.

Structure cle
-------------

- `data/articles/` : source JSON des articles (`index.json` + 1 fichier par article).
- `data/archive.json` : liste d'IDs ou d'objets `{ id, title?, created_at? }` pour la page Archives.
- `templates/` : patrons HTML utilises par le script de build.
- `scripts/build.js` : SSG qui lit les JSON, applique les templates, genere `dist/` et met a jour `sitemap.xml`.
- `style.css`, `script.js`, `assets/`, `favicon.png`, `robots.txt`, `CNAME`, `article.html` : ressources sources copiees automatiquement dans `dist/`.
- `dist/` : resultat complet (index.html, archive.html, article.html, sitemap.xml, articles/<id>/index.html, assets, etc.). Le dossier est recree a chaque build.

Generer le site
---------------

```
cd zen-retraite
npm run build
# ou avec une URL canonique precise
SITE_URL=https://zen-retraite.fr npm run build
```

Ce que fait `npm run build` :

1. Nettoie `dist/`.
2. Charge `index.json` et tous les `articles/<id>.json`.
3. Cree `dist/index.html`, `dist/archive.html`, `dist/articles/<id>/index.html` avec contenu inline + schema.org Article + balises Open Graph/Twitter.
4. Ecrit `dist/sitemap.xml` avec `/` et toutes les URLs `/articles/<id>/`.
5. Copie `style.css`, `script.js`, `article.html`, `favicon.png`, `robots.txt`, `CNAME` et `assets/` dans `dist/`.

Structure des donnees
---------------------

- `data/articles/index.json` : tableau d'IDs a afficher sur l'accueil (ordre descendant).
- `data/articles/{id}.json` : article complet (`id`, `title`, `excerpt`, `content` HTML, `image`, `theme`, `subtheme`, `created_at`, etc.).
- `data/archive.json` : tableau d'IDs ou d'objets `{ id, title?, created_at? }`. Les champs manquants sont completes automatiquement depuis les fichiers article.

Archivage
---------

1. Retirer l'ID du fichier `data/articles/index.json` pour le sortir de l'accueil.
2. Ajouter cet ID (ou un objet) dans `data/archive.json`. La page Archives se met a jour automatiquement.

Ajouter ou mettre a jour un article
-----------------------------------

1. Creer/editer `data/articles/{id}.json` (copier un exemple).
2. Ajouter l'ID dans `data/articles/index.json` pour le rendre visible en homepage.
3. Lancer `npm run build`. Le nouveau contenu est immediatement integre dans `dist/`.

Compatibilite des anciens liens (`article.html?id=...`)
-------------------------------------------------------

- `article.html` detecte le parametre `?id=`, genere une redirection propre vers `/articles/<ID>/` et renseigne un meta-refresh.
- Un lien cliquable apparait instantanement en fallback si la redirection automatique echoue.
- Sans JavaScript, un message explique comment reconstruire l'URL ou revenir vers l'accueil/les archives. La page est marquee `noindex,follow` pour que les bots suivent les nouveaux liens sans indexer ce relais.

Deploiement
-----------

**GitHub Pages (branche `gh-pages` ou Pages modernes)**

1. Build command : `npm run build`.
2. Directory a publier : `zen-retraite/dist`.
3. Exemple de workflow (extrait) :

```yaml
- name: Build static pages
  env:
    SITE_URL: https://zen-retraite.fr
  run: npm run build
  working-directory: zen-retraite

- name: Deploy to GitHub Pages
  uses: peaceiris/actions-gh-pages@v4
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    publish_dir: zen-retraite/dist
    force_orphan: true
```

**Netlify**

- Build command : `npm run build`.
- Publish directory : `dist`.
- Optionnel : definir `SITE_URL` dans les variables Netlify pour generer les URLs canoniques definitives.

Developpement local
-------------------

- Apres `npm run build`, ouvrir `dist/index.html` dans le navigateur ou lancer `npx serve dist`.
- Les pages HTML affichent tout le contenu sans JavaScript. `script.js` reste optionnel et ajoute seulement la recherche, les filtres et le switch de theme.
- `dist/` est regenere a chaque build : ne pas y faire de modifications manuelles.

Points cle SEO/GEO
------------------

- `templates/article-page.html` injecte le contenu complet (h1 + corps) directement dans le HTML.
- Chaque article inclut un JSON-LD `Article` avec `headline`, `description`, `image`, `datePublished`, `author`, `mainEntityOfPage`.
- `sitemap.xml` recense `/` et toutes les pages articles.
- `article.html` n'affiche plus de spinner : il fournit un meta-refresh rapide et un lien manuel pour que les crawlers et les utilisateurs suivent la nouvelle URL.
