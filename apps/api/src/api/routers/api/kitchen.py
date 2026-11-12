"""Le frigo : ce que j'ai sous la main, persistant d'une session à l'autre."""

from typing import Annotated

from db.engine import get_session_maker

from db.models.ingredient import FridgeItem, Ingredient
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(tags=["fridge"])


async def get_session() -> AsyncSession:
    async with get_session_maker()() as session:
        yield session


SessionDep = Annotated[AsyncSession, Depends(get_session)]


class FridgeItemOut(BaseModel):
    id: int
    name: str


class FridgeItemIn(BaseModel):
    name: str


@router.get("", operation_id="list_fridge")
async def list_fridge(session: SessionDep) -> list[FridgeItemOut]:
    from sqlalchemy import select

    result = await session.execute(
        select(Ingredient.id, Ingredient.name)
        .join_from(FridgeItem, Ingredient, FridgeItem.ingredient_id == Ingredient.id)
        .order_by(Ingredient.name)
    )
    return [FridgeItemOut(id=row.id, name=row.name) for row in result]


@router.post("", operation_id="add_fridge_item", status_code=201)
async def add_fridge_item(item: FridgeItemIn, session: SessionDep) -> FridgeItemOut:
    from sqlalchemy import select

    name = item.name.strip().lower()
    if not name:
        raise HTTPException(status_code=422, detail="nom d'ingrédient requis")

    existing = (
        await session.execute(select(Ingredient).where(Ingredient.name == name))
    ).scalar_one_or_none()
    if existing is None:
        existing = Ingredient(name=name)
        session.add(existing)
        await session.flush()

    already = await session.get(FridgeItem, existing.id)
    if already is None:
        session.add(FridgeItem(ingredient_id=existing.id))
    await session.commit()
    return FridgeItemOut(id=existing.id, name=name)


@router.delete("/{ingredient_id}", operation_id="remove_fridge_item", status_code=204)
async def remove_fridge_item(ingredient_id: int, session: SessionDep) -> None:
    item = await session.get(FridgeItem, ingredient_id)
    if item is not None:
        await session.delete(item)
        await session.commit()
