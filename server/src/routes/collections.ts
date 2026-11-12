import { Router } from "express";
import { db } from "../db.js";
import { importRecipeFromUrl } from "../importer.js";

export const collectionsRouter = Router();

collectionsRouter.get("/", (_req, res) => {
  const rows = db
    .prepare(`SELECT c.*, COUNT(r.id) AS recipe_count FROM recipe_collections c
             LEFT JOIN recipes r ON r.collection_id = c.id GROUP BY c.id ORDER BY c.name`)
    .all();
  res.json(rows);
});

collectionsRouter.post("/", (req, res) => {
  const { name } = req.body as { name?: string };
  if (!name?.trim()) return res.status(400).json({ error: "nom requis" });
  db.prepare(`INSERT INTO recipe_collections (name) VALUES (?)`).run(name.trim());
  const row = db.prepare(`SELECT * FROM recipe_collections WHERE name = ?`).get(name.trim());
  res.status(201).json(row);
});

// Importer une recette depuis une URL dans un répertoire
collectionsRouter.post("/:id/import", async (req, res) => {
  const { url } = req.body as { url?: string };
  if (!url) return res.status(400).json({ error: "url requise" });
  try {
    const recipe = await importRecipeFromUrl(url, Number(req.params.id));
    res.status(201).json(recipe);
  } catch (e) {
    res.status(422).json({ error: `import impossible: ${(e as Error).message}` });
  }
});

collectionsRouter.delete("/:id", (req, res) => {
  db.prepare(`DELETE FROM recipe_collections WHERE id = ?`).run(req.params.id);
  res.status(204).end();
});
