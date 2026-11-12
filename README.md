# Frigo → Recettes (Mistral App)

App full-stack construite avec le CLI Mistral : front TanStack Start, API FastAPI,
base Postgres managée, suggestions générées par l'API Mistral.

## Ce que fait l'app

- **Frigo persistant** : ajoute/retire des ingrédients, gardés d'une session à l'autre
- **Contraintes** : temps disponible, régimes, nombre de jours à planifier
- **Répertoires de recettes** : crée des répertoires et importe des recettes depuis
  n'importe quelle URL publiant du JSON-LD schema.org/Recipe (Marmiton, CuisineAZ…)
- **Suggestions LLM** : les recettes importées qui matchent le mieux le frigo servent
  d'exemples de style au modèle ; l'historique des notes oriente aussi les suggestions
- **Histoire** : note chaque recette faite (1 à 5 étoiles)

## Endpoints (API, préfixe /api)

| Méthode | Route | Rôle |
|---|---|---|
| GET / POST / DELETE | `/kitchen` | frigo (POST : `{"name": "oeufs"}`) |
| GET / POST | `/recipes/collections` | répertoires |
| POST | `/recipes/collections/{id}/import` | importer une recette (`{"url": "…"}`) |
| GET / POST | `/recipes` | recettes |
| GET / POST | `/history` | historique noté |
| POST | `/suggest` | suggestions (`{"temps_max":45,"regimes":[],"nb_jours":1}`) |

## Démarrage local

```bash
mistral login          # connexion navigateur
mistral dev            # démarre API + web + Postgres (nécessite Docker)
```

- Web : http://localhost:3001 — API : http://localhost:3000/api

## Déploiement

Chaque push sur `main` déclenche un déploiement automatique via GitHub Actions
(`.github/workflows/deploy.yml`), avec `MISTRAL_API_KEY` en secret du dépôt.
Le déploiement clone le commit poussé sur `origin`, applique les migrations
(`0001_frigo`), puis sert l'API et le web. Configure aussi `MISTRAL_API_KEY`
dans les secrets de l'app sur Studio pour que les suggestions LLM fonctionnent.

## Structure

- `apps/api/src/api/routers/api/` : routeurs auto-découverts (`kitchen`, `recipes`, `history`, `suggest`)
- `packages/py/db/src/db/models/` : modèles SQLModel auto-découverts
- `packages/py/db/src/db/migrations/versions/0001_frigo_recettes.py` : création des tables
- `apps/web/src/routes/index.tsx` : toute l'interface
