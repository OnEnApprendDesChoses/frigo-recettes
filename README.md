# Frigo → Recettes

App de suggestions de recettes à partir du contenu du frigo, avec contraintes (temps, régime),
répertoires de recettes importés depuis des sites, sources d'inspiration et historique noté.

## Stack

- **web/** : Vite + React + TypeScript
- **server/** : Express + TypeScript + SQLite (better-sqlite3)
- **LLM** : API Mistral (variable d'env `MISTRAL_API_KEY`) pour générer les suggestions
  inspirées de tes répertoires.

## Démarrage

```bash
# Terminal 1 : API
cd server
npm install
export MISTRAL_API_KEY="ta-clé"   # optionnel, suggestions simulées sinon
npm run dev                         # http://localhost:3001

# Terminal 2 : front
cd web
npm install
npm run dev                         # http://localhost:5173
```

## Modèle de données (SQLite, voir server/src/db.ts)

- `ingredients` / `fridge_items` : le frigo (persistant, plus besoin de re-saisir)
- `recipe_collections` : tes répertoires (« Marmiton favoris », « Ottolenghi », recettes perso…)
- `recipes` : recettes importées (via URL) ou créées à la main, rattachées à un répertoire
- `inspiration_sources` : sites/cuisiniers qui orientent le style des suggestions
- `cooked_history` : recettes faites + note, alimente la mémoire des goûts

## Endpoints principaux

| Méthode | Route | Rôle |
|---|---|---|
| GET/POST/DELETE | `/api/fridge` | gérer le frigo |
| GET/POST | `/api/collections` | gérer les répertoires |
| POST | `/api/collections/:id/import` | importer une recette depuis une URL |
| GET/POST | `/api/recipes` | lister / créer des recettes |
| POST | `/api/suggest` | suggestions LLM (frigo + contraintes + extraits des répertoires) |
| GET/POST | `/api/history` | historique des recettes faites |

## Comment les répertoires nourrissent les suggestions

Quand tu demandes une suggestion, le serveur :
1. filtre tes recettes importées par similarité d'ingrédients avec ton frigo,
2. envoie les plus proches au LLM comme exemples de style,
3. le LLM propose de nouvelles recettes adaptées à ton frigo, ton temps et ton régime.

## Pousser sur GitHub

```bash
git init && git add . && git commit -m "starter frigo-recettes"
git remote add origin git@github.com:<ton-compte>/frigo-recettes.git
git push -u origin main
```
