import { Router } from "express";
import { db } from "../db.js";

export const suggestRouter = Router();

interface SuggestBody {
  tempsMax?: number;          // minutes disponibles
  regimes?: string[];        // ["Végétarien", "Sans gluten", ...]
  nbJours?: number;         // nombre de repas à planifier
}

/**
 * POST /api/suggest
 * 1. lit le frigo,
 * 2. récupère les recettes des répertoires qui matchent le mieux les ingrédients,
 * 3. demande au LLM (Mistral) de nouveaux repas inspirés de ces exemples,
 *    en respectant temps max, régimes et nombre de jours.
 * Sans MISTRAL_API_KEY, renvoie un fallback basé uniquement sur les recettes importées.
 */
suggestRouter.post("/", async (req, res) => {
  const { tempsMax = 45, regimes = [], nbJours = 1 } = req.body as SuggestBody;

  const fridge = (
    db.prepare(`SELECT i.name FROM fridge_items f JOIN ingredients i ON i.id = f.ingredient_id`).all() as { name: string }[]
  ).map((r) => r.name);

  const inspirations = (
    db.prepare(`SELECT name FROM inspiration_sources`).all() as { name: string }[]
  ).map((r) => r.name);

  // Similarité simple : recettes importées partageant le plus d'ingrédients avec le frigo
  const imported = db.prepare(`SELECT title, url, minutes, diet_tags, ingredients, steps FROM recipes`).all() as any[];
  const scored = imported
    .map((r) => {
      const ings: string[] = JSON.parse(r.ingredients);
      const overlap = ings.filter((i) => fridge.includes(i)).length;
      return { ...r, ingredients: ings, steps: JSON.parse(r.steps), diet_tags: JSON.parse(r.diet_tags), overlap };
    })
    .filter((r) => r.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, 6);

  if (!process.env.MISTRAL_API_KEY) {
    return res.json({
      mode: "fallback",
      message: "MISTRAL_API_KEY absente : suggestions limitées aux recettes importées.",
      suggestions: scored.slice(0, nbJours),
    });
  }

  const examples = scored
    .map((r) => `- ${r.title} (${r.minutes ?? "?"} min) : ${r.ingredients.join(", ")}`)
    .join("\n");

  const prompt = `Tu es un chef qui aide à cuisiner avec ce qu'on a sous la main.
Contenu du frigo : ${fridge.join(", ") || "(vide)"}.
Contraintes : ${tempsMax} minutes maximum, régimes : ${regimes.join(", ") || "aucun"}.
Génère ${nbJours} recette(s) originale(s), numérotées, avec pour chacune :
titre, temps estimé, liste d'ingrédients (en indiquant ce qui manque), étapes courtes.
Inspire-toi fortement du style de ces recettes que j'aime${inspirations.length ? ` et des sources ${inspirations.join(", ")}` : ""} :
${examples || "(aucune recette de référence)"}
Réponds en français, en JSON: {"suggestions":[{"titre":"","minutes":0,"ingredients":[""],"manquants":[""],"etapes":[""]}]}`;

  try {
    const r = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
      },
      body: JSON.stringify({
        model: "mistral-small-latest",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      }),
    });
    if (!r.ok) throw new Error(`API Mistral ${r.status}`);
    const data = await r.json();
    const parsed = JSON.parse(data.choices[0].message.content);
    res.json({ mode: "llm", ...parsed });
  } catch (e) {
    res.status(502).json({ error: `échec LLM: ${(e as Error).message}`, suggestions: scored.slice(0, nbJours) });
  }
});
