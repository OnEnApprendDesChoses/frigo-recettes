"""Répertoires de recettes, recettes et import depuis une URL (JSON-LD schema.org)."""

import re
from typing import Annotated, Any

from db.models.recipe import Recipe, RecipeCollection
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from .kitchen import SessionDep

router = APIRouter(tags=["recipes"])


class CollectionOut(BaseModel):
    id: int
    name: str
    recipe_count: int


class CollectionIn(BaseModel):
    name: str


class RecipeOut(BaseModel):
    id: int
    collection_id: int | None
    title: str
    url: str | None
    minutes: int | None
    diet_tags: list[str]
    ingredients: list[str]
    steps: list[str]
    style: str | None


class RecipeIn(BaseModel):
    collection_id: int | None = None
    title: str
    url: str | None = None
    minutes: int | None = None
    diet_tags: list[str] = []
    ingredients: list[str] = []
    steps: list[str] = []
    style: str | None = None


class ImportIn(BaseModel):
    url: str


def to_out(r: Recipe) -> RecipeOut:
    return RecipeOut(
        id=r.id,
        collection_id=r.collection_id,
        title=r.title,
        url=r.url,
        minutes=r.minutes,
        diet_tags=[str(t) for t in (r.diet_tags or [])],
        ingredients=[str(i) for i in (r.ingredients or [])],
        steps=[str(s) for s in (r.steps or [])],
        style=r.style,
    )


@router.get("/collections", operation_id="list_collections")
async def list_collections(session: SessionDep) -> list[CollectionOut]:
    result = await session.execute(
        select(
            RecipeCollection.id,
            RecipeCollection.name,
            func.count(Recipe.id).label("recipe_count"),
        )
        .outerjoin(Recipe, Recipe.collection_id == RecipeCollection.id)
        .group_by(RecipeCollection.id)
        .order_by(RecipeCollection.name)
    )
    return [CollectionOut(id=row.id, name=row.name, recipe_count=row.recipe_count) for row in result]


@router.post("/collections", operation_id="create_collection", status_code=201)
async def create_collection(body: CollectionIn, session: SessionDep) -> CollectionOut:
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="nom requis")
    existing = (
        await session.execute(select(RecipeCollection).where(RecipeCollection.name == name))
    ).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(status_code=409, detail=f"le répertoire « {name} » existe déjà")
    collection = RecipeCollection(name=name)
    session.add(collection)
    await session.commit()
    return CollectionOut(id=collection.id, name=name, recipe_count=0)


@router.delete("/collections/{collection_id}", operation_id="delete_collection", status_code=204)
async def delete_collection(collection_id: int, session: SessionDep) -> None:
    collection = await session.get(RecipeCollection, collection_id)
    if collection is None:
        raise HTTPException(status_code=404, detail="répertoire introuvable")
    await session.execute(
        Recipe.__table__.update().where(Recipe.collection_id == collection_id).values(collection_id=None)
    )
    await session.delete(collection)
    await session.commit()


@router.get("", operation_id="list_recipes")
async def list_recipes(session: SessionDep, collection_id: int | None = None) -> list[RecipeOut]:
    stmt = select(Recipe).order_by(Recipe.id.desc())
    if collection_id is not None:
        stmt = stmt.where(Recipe.collection_id == collection_id)
    result = await session.execute(stmt)
    return [to_out(r) for r in result.scalars()]


@router.post("", operation_id="create_recipe", status_code=201)
async def create_recipe(body: RecipeIn, session: SessionDep) -> RecipeOut:
    recipe = Recipe(
        collection_id=body.collection_id,
        title=body.title.strip(),
        url=body.url,
        minutes=body.minutes,
        diet_tags=body.diet_tags,
        ingredients=[i.strip().lower() for i in body.ingredients if i.strip()],
        steps=body.steps,
        style=body.style,
    )
    session.add(recipe)
    await session.commit()
    return to_out(recipe)


@router.delete("/{recipe_id}", operation_id="delete_recipe", status_code=204)
async def delete_recipe(recipe_id: int, session: SessionDep) -> None:
    recipe = await session.get(Recipe, recipe_id)
    if recipe is None:
        raise HTTPException(status_code=404, detail="recette introuvable")
    await session.delete(recipe)
    await session.commit()


@router.post("/collections/{collection_id}/import", operation_id="import_recipe_url", status_code=201)
async def import_recipe_url(collection_id: int, body: ImportIn, session: SessionDep) -> RecipeOut:
    """Importe une recette depuis une URL via son balisage JSON-LD schema.org/Recipe."""
    import httpx

    collection = await session.get(RecipeCollection, collection_id)
    if collection is None:
        raise HTTPException(status_code=404, detail="répertoire introuvable")

    try:
        async with httpx.AsyncClient(
            headers={"User-Agent": "Mozilla/5.0 (compatible; FrigoRecettes/0.1)"},
            follow_redirects=True,
            timeout=15.0,
        ) as client:
            response = await client.get(body.url)
            response.raise_for_status()
            html = response.text
    except httpx.HTTPError as error:
        raise HTTPException(status_code=422, detail=f"page inaccessible : {error}") from error

    json_ld = _extract_jsonld_recipe(html)
    if json_ld is None:
        raise HTTPException(
            status_code=422,
            detail="pas de balisage schema.org/Recipe trouvé sur la page "
            "(souvent le cas des sites derrière un paywall ou en JavaScript pur)",
        )

    recipe = Recipe(
        collection_id=collection_id,
        title=str(json_ld.get("name") or "Recette sans titre"),
        url=body.url,
        minutes=_parse_minutes(json_ld),
        diet_tags=_diet_tags(json_ld),
        ingredients=[_normalize_ingredient(i) for i in json_ld.get("recipeIngredient") or []],
        steps=[
            step if isinstance(step, str) else str(step.get("text") or "")
            for step in json_ld.get("recipeInstructions") or []
        ],
    )
    session.add(recipe)
    await session.commit()
    return to_out(recipe)


def _extract_jsonld_recipe(html: str) -> dict[str, Any] | None:
    pattern = re.compile(r"<script[^>]+application/ld\+json[^>]*>([\s\S]*?)</script>", re.IGNORECASE)
    for match in pattern.finditer(html):
        try:
            import json

            data = json.loads(match.group(1).replace("&quot;", '"'))
        except ValueError:
            continue
        candidates = data if isinstance(data, list) else [data]
        graph = data.get("@graph") if isinstance(data, dict) else None
        if isinstance(graph, list):
            candidates += graph
        for candidate in candidates:
            if not isinstance(candidate, dict):
                continue
            types = candidate.get("@type")
            types = types if isinstance(types, list) else [types]
            if "Recipe" in types:
                return candidate
    return None


def _parse_minutes(data: dict[str, Any]) -> int | None:
    raw = data.get("totalTime") or data.get("cookTime") or data.get("prepTime")
    if not isinstance(raw, str):
        return None
    match = re.match(r"PT(?:(\d+)H)?(?:(\d+)M)?", raw)
    if match is None:
        return None
    hours = int(match.group(1) or 0)
    minutes = int(match.group(2) or 0)
    total = hours * 60 + minutes
    return total or None


def _normalize_ingredient(raw: str) -> str:
    value = raw.strip().lower()
    value = re.sub(r"^\d+([.,]\d+)?\s*(g|kg|ml|cl|l|cs|cc|c\.à\.s\.?|c\.à\.c\.?)\s+(de\s+)?", "", value)
    value = re.sub(r"^(des|une?|le|la|les|du)\s+", "", value)
    return value.strip()


_DIET_MAP = {
    "LowSaltDiet": "Sans sel ajouté",
    "VeganDiet": "Vegan",
    "VegetarianDiet": "Végétarien",
    "GlutenFreeDiet": "Sans gluten",
    "LactoseFreeDiet": "Sans lactose",
}


def _diet_tags(data: dict[str, Any]) -> list[str]:
    tags = []
    for uri in data.get("suitableForDiet") or []:
        key = str(uri).rsplit("/", maxsplit=1)[-1]
        tag = _DIET_MAP.get(key)
        if tag:
            tags.append(tag)
    return tags
