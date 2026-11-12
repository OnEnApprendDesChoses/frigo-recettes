import { db } from "./db.js";

/**
 * Import basique d'une recette depuis une URL : récupère le HTML et extrait
 * les données via JSON-LD (schema.org/Recipe), format publié par la plupart
 * des sites de cuisine (Marmiton, CuisineAZ, etc.).
 * En production, on ajouterait des adaptateurs par site + fallback LLM d'extraction.
 */
export async function importRecipeFromUrl(url: string, collectionId: number) {
  const html = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; FrigoRecettes/0.1)" },
  }).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.text();
  });

  const jsonLd = extractJsonLdRecipe(html);
  if (!jsonLd) throw new Error("pas de balisage schema.org/Recipe trouvé sur la page");

  const title = jsonLd.name ?? "Recette sans titre";
  const minutes = parseMinutes(jsonLd);
  const ingredients = (jsonLd.recipeIngredient ?? []).map(normalizeIngredient);
  const steps = (jsonLd.recipeInstructions ?? [])
    .map((s: unknown) => (typeof s === "string" ? s : (s as { text?: string }).text))
    .filter(Boolean);
  const dietTags = (jsonLd.suitableForDiet ?? []).map(dietTagFromSchema).filter(Boolean);

  const info = db
    .prepare(`INSERT INTO recipes (collection_id, title, url, minutes, diet_tags, ingredients, steps, style)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(collectionId, title, url, minutes, JSON.stringify(dietTags),
         JSON.stringify(ingredients), JSON.stringify(steps), null);

  return { id: info.lastInsertRowid, title, url, minutes, ingredients, steps, diet_tags: dietTags };
}

function extractJsonLdRecipe(html: string): Record<string, unknown> | null {
  const re = /<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    try {
      const data = JSON.parse(m[1].replace(/&quot;/g, '"'));
      const candidates = Array.isArray(data) ? data : [data, ...((data as { "@graph"?: unknown[] })["@graph"] ?? [])];
      for (const c of candidates) {
        const t = (c as { "@type"?: unknown })["@type"];
        if (t === "Recipe" || (Array.isArray(t) && t.includes("Recipe"))) return c as Record<string, unknown>;
      }
    } catch { /* fragment JSON invalide, on continue */ }
  }
  return null;
}

function parseMinutes(r: Record<string, any>): number | null {
  const raw = r.totalTime ?? r.cookTime ?? r.prepTime;
  if (!raw) return null;
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?/.exec(raw);
  if (!m) return null;
  return Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0);
}

function normalizeIngredient(s: string): string {
  return s
    .replace(/^\d+([.,]\d+)?\s*(g|kg|ml|cl|l|cs|cc|c\.à\.s\.?|c\.à\.c\.?)\s+(de\s+)?/i, "")
    .replace(/^\d+\s+(/g, "")
    .replace(/^(des|une?|le|la|les|du)\s+/i, "")
    .trim()
    .toLowerCase();
}

function dietTagFromSchema(uri: string): string | null {
  const map: Record<string, string> = {
    "LowSaltDiet": "Sans sel ajouté",
    "VeganDiet": "Vegan",
    "VegetarianDiet": "Végétarien",
    "GlutenFreeDiet": "Sans gluten",
    "LactoseFreeDiet": "Sans lactose",
  };
  const key = uri.split("/").pop() ?? "";
  return map[key] ?? null;
}
