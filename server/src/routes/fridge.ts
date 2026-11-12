import { Router } from "express";
import { db } from "../db.js";

export const fridgeRouter = Router();

fridgeRouter.get("/", (_req, res) => {
  const rows = db
    .prepare(`SELECT i.id, i.name FROM fridge_items f JOIN ingredients i ON i.id = f.ingredient_id ORDER BY i.name`)
    .all();
  res.json(rows);
});

fridgeRouter.post("/", (req, res) => {
  const { name } = req.body as { name?: string };
  if (!name?.trim()) return res.status(400).json({ error: "nom d'ingrédient requis" });
  const clean = name.trim().toLowerCase();
  db.prepare(`INSERT OR IGNORE INTO ingredients (name) VALUES (?)`).run(clean);
  const { id } = db.prepare(`SELECT id FROM ingredients WHERE name = ?`).get(clean) as { id: number };
  db.prepare(`INSERT OR IGNORE INTO fridge_items (ingredient_id) VALUES (?)`).run(id);
  res.status(201).json({ id, name: clean });
});

fridgeRouter.delete("/:id", (req, res) => {
  db.prepare(`DELETE FROM fridge_items WHERE ingredient_id = ?`).run(req.params.id);
  res.status(204).end();
});
