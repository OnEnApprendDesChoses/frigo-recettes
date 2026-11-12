import { Router } from "express";
import { db } from "../db.js";

export const recipesRouter = Router();

interface RecipeRow {
  id: number; collection_id: number | null; title: string; url: string | null;
  minutes: number | null; diet_tags: string; ingredients: string; steps: string; style: string | null;
}

const hydrate = (r: RecipeRow) => ({
  ...r,
  diet_tags: JSON.parse(r.diet_tags),
  ingredients: JSON.parse(r.ingredients),
  steps: JSON.parse(r.steps),
});

recipesRouter.get("/", (req, res) => {
  const { collection_id } = req.query;
  const rows = collection_id
    ? db.prepare(`SELECT * FROM recipes WHERE collection_id = ? ORDER BY id DESC`).all(collection_id)
    : db.prepare(`SELECT * FROM recipes ORDER BY id DESC`).all();
  res.json((rows as RecipeRow[]).map(hydrate));
});

recipesRouter.post("/", (req, res) => {
  const { collection_id, title, url, minutes, diet_tags = [], ingredients = [], steps = [], style } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: "titre requis" });
  const info = db
    .prepare(`INSERT INTO recipes (collection_id, title, url, minutes, diet_tags, ingredients, steps, style)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(collection_id ?? null, title.trim(), url ?? null, minutes ?? null,
         JSON.stringify(diet_tags), JSON.stringify(ingredients.map((i: string) => i.trim().toLowerCase())),
         JSON.stringify(steps), style ?? null);
  const row = db.prepare(`SELECT * FROM recipes WHERE id = ?`).get(info.lastInsertRowid) as RecipeRow;
  res.status(201).json(hydrate(row));
});

recipesRouter.delete("/:id", (req, res) => {
  db.prepare(`DELETE FROM recipes WHERE id = ?`).run(req.params.id);
  res.status(204).end();
});
