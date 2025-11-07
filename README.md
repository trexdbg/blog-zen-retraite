Zen Retraite – génération statique (SSG)
=======================================

Tout le site HTML est désormais pré-généré à partir des fichiers JSON présents dans `data/`.  
Les pages rendues contiennent le contenu des articles dès l’ouverture et exposent aussi les données
en JSON inline pour que `script.js` puisse améliorer la navigation sans dépendre du réseau.

Arborescence principale
-----------------------

- `data/articles/` – source JSON des articles (`index.json` + 1 fichier par article)
- `data/archive.json` – liste d’IDs ou d’objets pour la page Archives
- `templates/` – patrons HTML utilisés par le script de build
- `scripts/build.js` – génère `index.html`, `archive.html`, `sitemap.xml` et `articles/<id>/index.html`
- `articles/` – pages finales prêtes à être servies (recréées à chaque build)
- `article.html` – page dynamique de secours (`?id=`) conservée pour les anciens liens

Générer le site
---------------

```
cd zen-retraite
npm run build              # génère index + archive + toutes les pages /articles/<id>/
SITE_URL=https://zen-retraite.fr npm run build   # optionnel : définit l’URL canonique dans le sitemap/SEO
```

Chaque build lit les JSON, applique les modèles et met à jour `sitemap.xml`.  
Le script supprime puis recrée le dossier `articles/`, assurez-vous donc de ne rien y stocker manuellement.

Structure des données
---------------------

- `data/articles/index.json` : tableau d’IDs à afficher sur l’accueil (ordre ≈ chronologique)
- `data/articles/{id}.json` : article complet (`id`, `title`, `created_at`, `image`, `excerpt`, `content`, `theme`, `subtheme`, …)
- `data/archive.json` : soit un simple tableau d’IDs, soit `{ "articles": [ ... ] }` avec des objets `{ id, title?, created_at? }`

Règles d’archivage
------------------

1. Retirer l’ID du fichier `data/articles/index.json` pour qu’il n’apparaisse plus à l’accueil.
2. Ajouter cet ID (ou un objet) dans `data/archive.json`.  
   La page Archives complétera automatiquement `title`/`date` à partir du JSON de l’article.

Ajouter / mettre à jour un article
----------------------------------

1. Créer/éditer `data/articles/{id}.json` (copier un exemple existant).
2. Ajouter l’ID dans `data/articles/index.json` pour l’afficher en page d’accueil.
3. Lancer `npm run build` pour régénérer toutes les pages statiques.

Développement & déploiement
---------------------------

- Les pages générées fonctionnent sans JavaScript, mais `script.js` (inchangé) ajoute recherche, filtres, thème, etc.
- Pour visualiser localement : après `npm run build`, ouvrir `index.html` ou lancer un petit serveur (`python -m http.server`…).
- Déployer le dossier `zen-retraite/` sur n’importe quel hébergement statique (GitHub Pages, Netlify, Vercel, S3, …).

