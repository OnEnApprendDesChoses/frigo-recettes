import { Router } from "express";
import { db } from "../db.js";

export const historyRouter = Router();

historyRouter.get("/", (_req, res) => {
  const rows = db.prepare(`SELECT * FROM cooked_history ORDER BY cooked_at DESC`).all();
  res.json(rows);
});

historyRouter.post("/", (req, res) => {
  const { recipe_title, rating, notes } = req.body;
  if (!recipe_title || !(1 <= rating && rating <= 5)) {
    return res.status(400).json({ error: "recipe_title et rating (1-5) requis" });
  }
  const info = db
    .prepare(`INSERT INTO cooked_history (recipe_title, rating, notes) VALUES (?, ?, ?)`)
    .run(recipe_title, rating, notes ?? null);
  const row = db.prepare(`SELECT * FROM cooked_history WHERE id = ?`).get(info.lastInsertRowid);
  res.status(201).json(row);
});
