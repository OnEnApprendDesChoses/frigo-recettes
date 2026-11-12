import express from "express";
import cors from "cors";
import { fridgeRouter } from "./routes/fridge.js";
import { collectionsRouter } from "./routes/collections.js";
import { recipesRouter } from "./routes/recipes.js";
import { historyRouter } from "./routes/history.js";
import { suggestRouter } from "./routes/suggest.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.use("/api/fridge", fridgeRouter);
app.use("/api/collections", collectionsRouter);
app.use("/api/recipes", recipesRouter);
app.use("/api/history", historyRouter);
app.use("/api/suggest", suggestRouter);

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => console.log(`API sur http://localhost:${port}`));
