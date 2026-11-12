"""Suggestions de repas : frigo + contraintes + extraits des répertoires -> LLM Mistral."""

import json
from typing import Annotated

from db.models.ingredient import FridgeItem, Ingredient
from db.models.kitchen_history import CookedHistory
from db.models.recipe import Recipe
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .kitchen import SessionDep

router = APIRouter(tags=["suggest"])

_MODEL = "mistral-small-latest"


class SuggestIn(BaseModel):
    temps_max: int = 45
    regimes: list[str] = []
    nb_jours: int = 1


class Suggestion(BaseModel):
    titre: str
    minutes: int
    ingredients: list[str]
    manquants: list[str] = []
    etapes: list[str]


class SuggestOut(BaseModel):
    mode: str
    message: str | None = None
    suggestions: list[Suggestion]


@router.post("", operation_id="suggest_recipes")
async def suggest_recipes(body: SuggestIn, session: SessionDep) -> SuggestOut:
    fridge = [
        row.name
        for row in (
            await session.execute(
                select(Ingredient.name).join(FridgeItem, FridgeItem.ingredient_id == Ingredient.id)
            )
        ).scalars()
    ]
    imported = (await session.execute(select(Recipe))).scalars().all()

    # Similarité simple : les recettes importées partageant le plus d'ingrédients avec le frigo
    # servent d'exemples de style au LLM.
    scored: list[tuple[int, Recipe]] = []
    for recipe in imported:
        overlap = len(set(recipe.normalized_ingredients()) & set(fridge))
        if overlap > 0:
            scored.append((overlap, recipe))
    scored.sort(key=lambda pair: pair[0], reverse=True)
    examples = [recipe for _, recipe in scored[:6]]

    liked = [
        f"{row.recipe_title} (note {row.rating}/5)"
        for row in (
            await session.execute(
                select(CookedHistory).order_by(CookedHistory.rating.desc()).limit(8)
            )
        ).scalars()
    ]

    if not fridge and not examples:
        return SuggestOut(
            mode="vide",
            message="Ajoute des ingrédients au frigo ou importe des recettes pour recevoir des suggestions.",
            suggestions=[],
        )

    prompt = _build_prompt(
        fridge=fridge,
        temps_max=body.temps_max,
        regimes=body.regimes,
        nb_jours=body.nb_jours,
        examples=examples,
        liked=liked,
    )

    parsed = await _ask_mistral(prompt)
    if parsed is None:
        # Fallback : pas de LLM disponible, on renvoie les recettes importées les plus proches.
        return SuggestOut(
            mode="fallback",
            message="LLM indisponible : voici les recettes de tes répertoires qui matchent ton frigo.",
            suggestions=[
                Suggestion(
                    titre=r.title,
                    minutes=r.minutes or 30,
                    ingredients=[str(i) for i in r.ingredients],
                    etapes=[str(s) for s in r.steps],
                )
                for r in examples[: body.nb_jours]
            ],
        )

    suggestions = [
        Suggestion(
            titre=item.get("titre", "Recette"),
            minutes=int(item.get("minutes") or body.temps_max),
            ingredients=[str(i) for i in item.get("ingredients", [])],
            manquants=[str(m) for m in item.get("manquants", [])],
            etapes=[str(e) for e in item.get("etapes", [])],
        )
        for item in parsed.get("suggestions", [])
    ]
    return SuggestOut(mode="llm", suggestions=suggestions[: body.nb_jours])


def _build_prompt(
    *, fridge: list[str], temps_max: int, regimes: list[str], nb_jours: int,
    examples: list[Recipe], liked: list[str],
) -> str:
    examples_text = "\n".join(
        f"- {r.title} ({r.minutes or '?'} min) : {', '.join(r.normalized_ingredients())}"
        for r in examples
    ) or "(aucune recette de référence)"

    liked_text = "\n".join(f"- {title}" for title in liked) or "(aucune note encore)"

    return f"""Tu es un chef qui aide à cuisiner avec ce qu'on a sous la main.

Contenu du frigo : {', '.join(fridge) or '(vide)'}.
Contraintes : {temps_max} minutes maximum par recette, régimes à respecter : {', '.join(regimes) or 'aucun'}.

Génère {nb_jours} recette(s) originale(s), avec pour chacune :
- titre
- minutes : temps estimé (max {temps_max})
- ingredients : liste d'ingrédients
- manquants : ceux à acheter qui ne sont pas dans le frigo
- etapes : étapes courtes

Inspire-toi fortement du style de ces recettes que j'aime :
{examples_text}

J'ai déjà beaucoup aimé ces plats :
{liked_text}

Réponds uniquement en JSON :
{{"suggestions":[{{"titre":"", "minutes":0, "ingredients":[""], "manquants":[""], "etapes":[""]}}]}}"""


async def _ask_mistral(prompt: str) -> dict | None:
    import asyncio

    try:
        from utils.mistral import mistral_client

        client = mistral_client()

        def complete() -> str | None:
            response = client.chat.complete(
                model=_MODEL,
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"},
            )
            return response.choices[0].message.content if response.choices else None

        content = await asyncio.to_thread(complete)
    except Exception:
        return None
    if isinstance(content, str):
        try:
            return json.loads(content)
        except ValueError:
            return None
    if isinstance(content, dict):
        return content
    return None
