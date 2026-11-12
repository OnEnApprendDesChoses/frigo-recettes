import { useEffect, useState } from "react";
import { api, type Collection, type FridgeItem, type HistoryEntry, type Suggestion } from "./api";

const REGIMES = ["Végétarien", "Vegan", "Sans gluten", "Sans lactose", "Sans porc"];

type Tab = "frigo" | "resultats" | "repertoire" | "histoire";

export default function App() {
  const [tab, setTab] = useState<Tab>("frigo");

  const [fridge, setFridge] = useState<FridgeItem[]>([]);
  const [fridgeInput, setFridgeInput] = useState("");

  const [tempsMax, setTempsMax] = useState(45);
  const [regimes, setRegimes] = useState<string[]>([]);
  const [nbJours, setNbJours] = useState(1);

  const [collections, setCollections] = useState<Collection[]>([]);
  const [newCollName, setNewCollName] = useState("");
  const [importUrl, setImportUrl] = useState("");
  const [importCollId, setImportCollId] = useState<number | null>(null);
  const [status, setStatus] = useState("");

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);

  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const refresh = () => {
    api.getFridge().then(setFridge).catch(() => {});
    api.getCollections().then(setCollections).catch(() => {});
    api.getHistory().then(setHistory).catch(() => {});
  };
  useEffect(refresh, []);

  const addFridge = async () => {
    if (!fridgeInput.trim()) return;
    await api.addToFridge(fridgeInput);
    setFridgeInput("");
    api.getFridge().then(setFridge);
  };

  const createCollection = async () => {
    if (!newCollName.trim()) return;
    await api.createCollection(newCollName);
    setNewCollName("");
    api.getCollections().then(setCollections);
  };

  const importRecipe = async () => {
    if (!importCollId || !importUrl.trim()) {
      setStatus("Choisis un répertoire et colle une URL de recette.");
      return;
    }
    setStatus("Import en cours…");
    try {
      const r = await api.importUrl(importCollId, importUrl.trim());
      setStatus(`✔ ${r.title} importée`);
      setImportUrl("");
      api.getCollections().then(setCollections);
    } catch (e) {
      setStatus(`✘ ${(e as Error).message}`);
    }
  };

  const findRecipes = async () => {
    setLoading(true);
    setTab("resultats");
    try {
      const res = await api.suggest({ tempsMax, regimes, nbJours });
      setSuggestions(res.suggestions ?? []);
      if (res.message) setStatus(res.message);
    } catch (e) {
      setStatus(`✘ ${(e as Error).message}`);
    }
    setLoading(false);
  };

  const rate = async (titre: string, rating: number) => {
    await api.addHistory(titre, rating);
    api.getHistory().then(setHistory);
  };

  const Stars = ({ n }: { n: number }) => <span style={{ color: "#f59e0b" }}>{"★".repeat(n)}{"☆".repeat(5 - n)}</span>;

  const tabStyle = (active: boolean) => ({
    padding: "8px 12px", borderRadius: 8, border: "none", cursor: "pointer",
    background: active ? "#f97316" : "#f5f5f4", color: active ? "white" : "#444",
    fontWeight: 600,
  });

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <h1>🥕 Frigo → Recettes</h1>
      <p style={{ color: "#78716c" }}>Dis-moi ce que tu as, je t'inspire.</p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        <button style={tabStyle(tab === "frigo")} onClick={() => setTab("frigo")}>🧊 Frigo</button>
        <button style={tabStyle(tab === "resultats")} onClick={() => setTab("resultats")}>🍽️ Recettes</button>
        <button style={tabStyle(tab === "repertoire")} onClick={() => setTab("repertoire")}>📖 Répertoires</button>
        <button style={tabStyle(tab === "histoire")} onClick={() => setTab("histoire")}>⭐ Histoire</button>
      </div>

      {tab === "frigo" && (
        <section style={{ display: "grid", gap: 16 }}>
          <div>
            <h2>Mon frigo</h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
              {fridge.map((f) => (
                <button key={f.id} onClick={() => api.removeFromFridge(f.id).then(() => api.getFridge().then(setFridge))}
                  style={{ border: "1px solid #e7e5e4", borderRadius: 999, padding: "4px 10px", background: "#fafaf9", cursor: "pointer" }}>
                  {f.name} ✕
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input value={fridgeInput} onChange={(e) => setFridgeInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addFridge()}
                placeholder="Ajouter un ingrédient" style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid #d6d3d1" }} />
              <button onClick={addFridge} style={{ padding: "10px 16px", borderRadius: 8, border: "none", background: "#f97316", color: "white", fontWeight: 600 }}>Ajouter</button>
            </div>
          </div>

          <div>
            <h2>Temps disponible : {tempsMax} min</h2>
            <input type="range" min={10} max={90} step={5} value={tempsMax}
              onChange={(e) => setTempsMax(Number(e.target.value))} style={{ width: "100%" }} />
          </div>

          <div>
            <h2>Régime</h2>
            {REGIMES.map((r) => (
              <label key={r} style={{ display: "inline-flex", gap: 6, marginRight: 12 }}>
                <input type="checkbox" checked={regimes.includes(r)}
                  onChange={() => setRegimes((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]))} />
                {r}
              </label>
            ))}
          </div>

          <div>
            <h2>Planifier pour</h2>
            {[1, 2, 3, 5, 7].map((n) => (
              <button key={n} onClick={() => setNbJours(n)}
                style={{ ...tabStyle(nbJours === n), marginRight: 8 }}>{n} jour{n > 1 ? "s" : ""}</button>
            ))}
          </div>

          <button onClick={findRecipes} disabled={loading}
            style={{ padding: 16, fontSize: 17, fontWeight: 700, borderRadius: 12, border: "none", background: "#10b981", color: "white", cursor: "pointer" }}>
            {loading ? "Recherche…" : `🔍 Trouver mes recettes (${nbJours} jour${nbJours > 1 ? "s" : ""}, ${tempsMax} min max)`}
          </button>
        </section>
      )}

      {tab === "resultats" && (
        <section style={{ display: "grid", gap: 12 }}>
          <button onClick={() => setTab("frigo")} style={{ ...tabStyle(false), justifySelf: "start" }}>← Modifier mon frigo</button>
          {suggestions.length === 0 && <p style={{ color: "#78716c" }}>Lance une recherche depuis l'onglet Frigo.</p>}
          {suggestions.map((s, i) => (
            <div key={i} style={{ border: "1px solid #e7e5e4", borderRadius: 12, padding: 16 }}>
              <h3>{s.titre} <small style={{ color: "#78716c" }}>⏱️ {s.minutes} min</small></h3>
              <p>{s.ingredients.join(", ")}</p>
              {s.manquants?.length ? <p style={{ color: "#b45309" }}>À acheter : {s.manquants.join(", ")}</p> : null}
              <ol style={{ paddingLeft: 20 }}>{s.etapes.map((e, j) => <li key={j}>{e}</li>)}</ol>
              <div style={{ display: "flex", gap: 6 }}>
                {[3, 4, 5].map((n) => (
                  <button key={n} onClick={() => rate(s.titre, n)} style={{ ...tabStyle(false) }}><Stars n={n} /></button>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {tab === "repertoire" && (
        <section style={{ display: "grid", gap: 16 }}>
          <div>
            <h2>Mes répertoires</h2>
            {collections.map((c) => (
              <div key={c.id} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #e7e5e4", padding: "6px 0" }}>
                <span>{c.name}</span>
                <small style={{ color: "#78716c" }}>{c.recipe_count} recette(s)</small>
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <input value={newCollName} onChange={(e) => setNewCollName(e.target.value)}
                placeholder="Nouveau répertoire (ex. Recettes de mamie)"
                style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid #d6d3d1" }} />
              <button onClick={createCollection} style={{ ...tabStyle(false) }}>Créer</button>
            </div>
          </div>

          <div>
            <h2>Importer une recette depuis une URL</h2>
            <select value={importCollId ?? ""} onChange={(e) => setImportCollId(Number(e.target.value))}
              style={{ padding: 10, borderRadius: 8, border: "1px solid #d6d3d1", marginBottom: 8, width: "100%" }}>
              <option value="">Choisir un répertoire…</option>
              {collections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div style={{ display: "flex", gap: 8 }}>
              <input value={importUrl} onChange={(e) => setImportUrl(e.target.value)}
                placeholder="https://www.marmiton.org/recettes/..."
                style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid #d6d3d1" }} />
              <button onClick={importRecipe} style={{ ...tabStyle(false) }}>Importer</button>
            </div>
            {status && <p style={{ color: "#78716c", marginTop: 8 }}>{status}</p>}
          </div>
        </section>
      )}

      {tab === "histoire" && (
        <section>
          <h2>Recettes faites & notées</h2>
          {history.length === 0 && <p style={{ color: "#78716c" }}>Note une recette pour la retrouver ici.</p>}
          {history.map((h) => (
            <div key={h.id} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #e7e5e4", padding: "6px 0" }}>
              <span>{h.recipe_title} <small style={{ color: "#a8a29e" }}>{h.cooked_at.slice(0, 10)}</small></span>
              <Stars n={h.rating} />
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
