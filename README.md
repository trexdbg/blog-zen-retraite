Zen Retraite – Site statique

- Dossier principal: `zen-retraite/`
- Pages: `index.html` (accueil), `article.html` (détail), `archive.html` (archives)
- Données: `zen-retraite/data/`

Structure des données
- `data/articles/index.json`: tableau d’IDs des articles visibles à l’accueil, ex: `["2025-10-30-1", "2025-10-18-1"]`
- `data/articles/{id}.json`: contenu d’un article (id, title, created_at, image, excerpt, content, theme, subtheme)
- `data/archive.json`: peut être soit
  - un tableau d’IDs: `["2025-11-01-1", ...]`, ou
  - un objet avec clé `articles` contenant des objets ou des IDs.

Règles d’archivage
- Un article archivé ne doit plus apparaître à l’accueil.
- Pour archiver: retirer son `id` de `data/articles/index.json` puis l’ajouter à `data/archive.json` (format ID simple recommandé).

Ajouter un article
1) Créer un fichier `data/articles/{id}.json` (voir exemples existants).
2) Ajouter l’`id` dans `data/articles/index.json` pour l’afficher à l’accueil.
3) Plus tard, pour l’archiver, suivre les règles ci‑dessus.

Développement local
- Ce site est statique. Ouvrir `zen-retraite/index.html` dans un navigateur.
- Pour éviter les restrictions CORS lors des fetch JSON, utiliser un petit serveur local:
  - Python: `python -m http.server 8080` puis ouvrir `http://localhost:8080/zen-retraite/`
  - Node (serve): `npx serve -l 8080 .` puis ouvrir `http://localhost:8080/zen-retraite/`

Déploiement
- Héberger tel quel sur un hébergement statique (GitHub Pages, Netlify, Vercel, S3, etc.).

Notes
- `archive.json` accepte désormais un simple tableau d’IDs et la page Archives reconstitue `title` et `created_at` en chargeant chaque article.

