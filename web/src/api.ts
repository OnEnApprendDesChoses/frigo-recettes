const base = "/api";

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const r = await fetch(base + path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.status === 204 ? (undefined as T) : r.json();
}

export interface FridgeItem { id: number; name: string }
export interface Collection { id: number; name: string; recipe_count: number }
export interface Recipe {
  id: number; collection_id: number | null; title: string; url: string | null;
  minutes: number | null; diet_tags: string[]; ingredients: string[]; steps: string[];
}
export interface Suggestion {
  titre: string; minutes: number; ingredients: string[]; manquants?: string[]; etapes: string[];
}
export interface HistoryEntry { id: number; recipe_title: string; rating: number; cooked_at: string }

export const api = {
  getFridge: () => req<FridgeItem[]>("/fridge"),
  addToFridge: (name: string) => req<FridgeItem>("/fridge", { method: "POST", body: JSON.stringify({ name }) }),
  removeFromFridge: (id: number) => req<void>(`/fridge/${id}`, { method: "DELETE" }),

  getCollections: () => req<Collection[]>("/collections"),
  createCollection: (name: string) => req<Collection>("/collections", { method: "POST", body: JSON.stringify({ name }) }),
  importUrl: (collectionId: number, url: string) =>
    req<Recipe>(`/collections/${collectionId}/import`, { method: "POST", body: JSON.stringify({ url }) }),

  getRecipes: (collectionId?: number) =>
    req<Recipe[]>(`/recipes${collectionId ? `?collection_id=${collectionId}` : ""}`),
  createRecipe: (r: Partial<Recipe>) => req<Recipe>("/recipes", { method: "POST", body: JSON.stringify(r) }),

  suggest: (body: { tempsMax: number; regimes: string[]; nbJours: number }) =>
    req<{ mode: string; suggestions: Suggestion[]; message?: string }>("/suggest", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  getHistory: () => req<HistoryEntry[]>("/history"),
  addHistory: (recipe_title: string, rating: number) =>
    req<HistoryEntry>("/history", { method: "POST", body: JSON.stringify({ recipe_title, rating }) }),
};
