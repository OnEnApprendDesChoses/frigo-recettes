import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";

import { env } from "../env";

// ---------------------------------------------------------------------------
// Client API minimal (le client généré se mettra à jour au prochain codegen)
// ---------------------------------------------------------------------------

const BASE = env.VITE_API_URL.replace(/\/+$/u, "");

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(detail || `Erreur ${response.status}`);
  }
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

type Tab = "frigo" | "resultats" | "repertoire" | "histoire";

interface FridgeItem { id: number; name: string }
interface Collection { id: number; name: string; recipe_count: number }
interface Recipe {
  id: number; collection_id: number | null; title: string; url: string | null;
  minutes: number | null; diet_tags: string[]; ingredients: string[]; steps: string[];
}
interface Suggestion {
  titre: string; minutes: number; ingredients: string[]; manquants: string[]; etapes: string[];
}
interface SuggestResponse { mode: string; message: string | null; suggestions: Suggestion[] }
interface HistoryEntry { id: number; recipe_title: string; rating: number; cooked_at: string }

const REGIMES = ["Végétarien", "Vegan", "Sans gluten", "Sans lactose"];

const Stars = ({ n }: { n: number }) => (
  <span className="text-amber-500">{"★".repeat(n)}{"☆".repeat(5 - n)}</span>
);

// ---------------------------------------------------------------------------
// Écran principal
// ---------------------------------------------------------------------------

const App = () => {
  const [tab, setTab] = useState<Tab>("frigo");
  const [status, setStatus] = useState("");

  const [fridge, setFridge] = useState<FridgeItem[]>([]);
  const [fridgeInput, setFridgeInput] = useState("");
  const [tempsMax, setTempsMax] = useState(45);
  const [regimes, setRegimes] = useState<string[]>([]);
  const [nbJours, setNbJours] = useState(1);

  const [collections, setCollections] = useState<Collection[]>([]);
  const [newCollName, setNewCollName] = useState("");
  const [importCollId, setImportCollId] = useState<number | null>(null);
  const [importUrl, setImportUrl] = useState("");

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestMode, setSuggestMode] = useState("");
  const [loading, setLoading] = useState(false);

  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const refresh = useCallback(() => {
    api<FridgeItem[]>("/api/kitchen").then(setFridge).catch(() => {});
    api<Collection[]>("/api/recipes/collections").then(setCollections).catch(() => {});
    api<HistoryEntry[]>("/api/history").then(setHistory).catch(() => {});
  }, []);

  useEffect(refresh, [refresh]);

  const addFridgeItem = async () => {
    const name = fridgeInput.trim();
    if (!name) return;
    await api<FridgeItem>("/api/kitchen", { method: "POST", body: JSON.stringify({ name }) });
    setFridgeInput("");
    api<FridgeItem[]>("/api/kitchen").then(setFridge);
  };

  const createCollection = async () => {
    const name = newCollName.trim();
    if (!name) return;
    await api<Collection>("/api/recipes/collections", { method: "POST", body: JSON.stringify({ name }) });
    setNewCollName("");
    api<Collection[]>("/api/recipes/collections").then(setCollections);
  };

  const importRecipe = async () => {
    if (!importCollId || !importUrl.trim()) {
      setStatus("Choisis un répertoire et colle une URL de recette.");
      return;
    }
    setStatus("Import en cours…");
    try {
      const recipe = await api<Recipe>(`/api/recipes/collections/${importCollId}/import`, {
        method: "POST",
        body: JSON.stringify({ url: importUrl.trim() }),
      });
      setStatus(`✔ ${recipe.title} importée`);
      setImportUrl("");
      api<Collection[]>("/api/recipes/collections").then(setCollections);
    } catch (error) {
      setStatus(`✘ ${(error as Error).message}`);
    }
  };

  const findRecipes = async () => {
    setLoading(true);
    setTab("resultats");
    try {
      const result = await api<SuggestResponse>("/api/suggest", {
        method: "POST",
        body: JSON.stringify({ temps_max: tempsMax, regimes, nb_jours: nbJours }),
      });
      setSuggestions(result.suggestions);
      setSuggestMode(result.mode);
      if (result.message) setStatus(result.message);
    } catch (error) {
      setStatus(`✘ ${(error as Error).message}`);
    }
    setLoading(false);
  };

  const rateRecipe = async (title: string, rating: number) => {
    await api("/api/history", { method: "POST", body: JSON.stringify({ recipe_title: title, rating }) });
    api<HistoryEntry[]>("/api/history").then(setHistory);
  };

  const tabClass = (active: boolean) =>
    `rounded-lg px-3 py-2 font-semibold ${active ? "bg-orange-600 text-white" : "bg-stone-100 text-stone-700"}`;

  return (
    <main className="mx-auto min-h-screen max-w-2xl p-4">
      <h1 className="text-3xl font-bold text-stone-800">🥕 Frigo → Recettes</h1>
      <p className="mb-4 text-stone-500">Dis-moi ce que tu as, je t'inspire.</p>

      <nav className="mb-6 flex flex-wrap gap-2">
        <button type="button" className={tabClass(tab === "frigo")} onClick={() => setTab("frigo")}>🧊 Frigo</button>
        <button type="button" className={tabClass(tab === "resultats")} onClick={() => setTab("resultats")}>🍽️ Recettes</button>
        <button type="button" className={tabClass(tab === "repertoire")} onClick={() => setTab("repertoire")}>📖 Répertoires</button>
        <button type="button" className={tabClass(tab === "histoire")} onClick={() => setTab("histoire")}>⭐ Histoire</button>
      </nav>

      {tab === "frigo" && (
        <section className="grid gap-6">
          <div>
            <h2 className="mb-2 text-xl font-semibold text-stone-800">Mon frigo</h2>
            <div className="mb-3 flex flex-wrap gap-2">
              {fridge.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="rounded-full border border-stone-300 bg-stone-50 px-3 py-1 text-sm"
                  onClick={() => {
                    void api(`/api/kitchen/${item.id}`, { method: "DELETE" })
                      .then(() => api<FridgeItem[]>("/api/kitchen"))
                      .then(setFridge);
                  }}
                >
                  {item.name} ✕
                </button>
              ))}
              {fridge.length === 0 && <span className="text-sm text-stone-400">Frigo vide…</span>}
            </div>
            <div className="flex gap-2">
              <input
                value={fridgeInput}
                onChange={(event) => setFridgeInput(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && void addFridgeItem()}
                placeholder="Ajouter un ingrédient (ex. courgettes)"
                className="flex-1 rounded-lg border border-stone-300 p-2"
              />
              <button
                type="button"
                onClick={() => void addFridgeItem()}
                className="rounded-lg bg-orange-600 px-4 py-2 font-semibold text-white"
              >
                Ajouter
              </button>
            </div>
          </div>

          <div>
            <h2 className="mb-2 text-xl font-semibold text-stone-800">Temps disponible : {tempsMax} min</h2>
            <input
              type="range" min={10} max={90} step={5} value={tempsMax}
              onChange={(event) => setTempsMax(Number(event.target.value))}
              className="w-full"
            />
          </div>

          <div>
            <h2 className="mb-2 text-xl font-semibold text-stone-800">Régime</h2>
            <div className="flex flex-wrap gap-3">
              {REGIMES.map((regime) => (
                <label key={regime} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={regimes.includes(regime)}
                    onChange={() =>
                      setRegimes((previous) =>
                        previous.includes(regime)
                          ? previous.filter((value) => value !== regime)
                          : [...previous, regime],
                      )
                    }
                  />
                  {regime}
                </label>
              ))}
            </div>
          </div>

          <div>
            <h2 className="mb-2 text-xl font-semibold text-stone-800">Planifier pour</h2>
            <div className="flex gap-2">
              {[1, 2, 3, 5, 7].map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setNbJours(days)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${nbJours === days ? "bg-orange-600 text-white" : "bg-stone-100 text-stone-700"}`}
                >
                  {days} jour{days > 1 ? "s" : ""}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => void findRecipes()}
            disabled={loading}
            className="sticky bottom-2 rounded-xl bg-emerald-600 p-4 text-lg font-bold text-white shadow-lg disabled:opacity-60"
          >
            {loading ? "Recherche…" : `🔍 Trouver mes recettes (${nbJours} jour${nbJours > 1 ? "s" : ""}, ${tempsMax} min max)`}
          </button>
        </section>
      )}

      {tab === "resultats" && (
        <section className="grid gap-4">
          <button type="button" className={tabClass(false)} onClick={() => setTab("frigo")}>← Modifier mon frigo</button>

          {suggestMode === "fallback" && (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              LLM indisponible : ce sont les recettes de tes répertoires qui matchent ton frigo.
            </p>
          )}
          {suggestMode === "vide" && (
            <p className="text-stone-500">Ajoute des ingrédients au frigo ou importe des recettes d'abord.</p>
          )}
          {suggestions.length === 0 && suggestMode === "" && (
            <p className="text-stone-500">Lance une recherche depuis l'onglet Frigo.</p>
          )}

          {suggestions.map((suggestion, index) => (
            <article key={index} className="rounded-xl border border-stone-200 p-4">
              <h3 className="text-lg font-semibold text-stone-800">
                {suggestion.titre}{" "}
                <small className="text-stone-500">⏱️ {suggestion.minutes} min</small>
              </h3>
              <p className="mt-1 text-stone-600">{suggestion.ingredients.join(", ")}</p>
              {suggestion.manquants.length > 0 && (
                <p className="mt-1 text-sm text-amber-700">À acheter : {suggestion.manquants.join(", ")}</p>
              )}
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-stone-600">
                {suggestion.etapes.map((step, stepIndex) => (
                  <li key={stepIndex}>{step}</li>
                ))}
              </ol>
              <div className="mt-3 flex gap-2">
                {[3, 4, 5].map((rating) => (
                  <button
                    key={rating}
                    type="button"
                    onClick={() => void rateRecipe(suggestion.titre, rating)}
                    className="rounded-lg border border-stone-300 px-3 py-1 text-sm"
                  >
                    <Stars n={rating} />
                  </button>
                ))}
              </div>
            </article>
          ))}
        </section>
      )}

      {tab === "repertoire" && (
        <section className="grid gap-6">
          <div>
            <h2 className="mb-2 text-xl font-semibold text-stone-800">Mes répertoires</h2>
            {collections.map((collection) => (
              <div key={collection.id} className="flex justify-between border-b border-stone-200 py-1.5">
                <span>{collection.name}</span>
                <span className="text-sm text-stone-400">{collection.recipe_count} recette(s)</span>
              </div>
            ))}
            <div className="mt-3 flex gap-2">
              <input
                value={newCollName}
                onChange={(event) => setNewCollName(event.target.value)}
                placeholder="Nouveau répertoire (ex. Recettes de mamie)"
                className="flex-1 rounded-lg border border-stone-300 p-2"
              />
              <button type="button" onClick={() => void createCollection()} className="rounded-lg bg-stone-100 px-4 font-semibold text-stone-700">
                Créer
              </button>
            </div>
          </div>

          <div>
            <h2 className="mb-2 text-xl font-semibold text-stone-800">Importer une recette depuis une URL</h2>
            <select
              value={importCollId ?? ""}
              onChange={(event) => setImportCollId(Number(event.target.value))}
              className="mb-2 w-full rounded-lg border border-stone-300 p-2"
            >
              <option value="">Choisir un répertoire…</option>
              {collections.map((collection) => (
                <option key={collection.id} value={collection.id}>{collection.name}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <input
                value={importUrl}
                onChange={(event) => setImportUrl(event.target.value)}
                placeholder="https://www.marmiton.org/recettes/..."
                className="flex-1 rounded-lg border border-stone-300 p-2"
              />
              <button type="button" onClick={() => void importRecipe()} className="rounded-lg bg-stone-100 px-4 font-semibold text-stone-700">
                Importer
              </button>
            </div>
            {status && <p className="mt-2 text-sm text-stone-500">{status}</p>}
          </div>
        </section>
      )}

      {tab === "histoire" && (
        <section>
          <h2 className="mb-2 text-xl font-semibold text-stone-800">Recettes faites & notées</h2>
          {history.length === 0 && <p className="text-stone-500">Note une recette pour la retrouver ici.</p>}
          {history.map((entry) => (
            <div key={entry.id} className="flex justify-between border-b border-stone-200 py-1.5">
              <span>
                {entry.recipe_title}{" "}
                <small className="text-stone-400">{entry.cooked_at.slice(0, 10)}</small>
              </span>
              <Stars n={entry.rating} />
            </div>
          ))}
        </section>
      )}
    </main>
  );
};

export const Route = createFileRoute("/")({
  component: App,
});
