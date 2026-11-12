"""Historique des recettes faites, avec note pour re-cuisiner ce qu'on aime."""

from typing import Annotated

from db.models.kitchen_history import CookedHistory
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from .kitchen import SessionDep

router = APIRouter(tags=["history"])


class HistoryOut(BaseModel):
    id: int
    recipe_title: str
    rating: int
    cooked_at: str
    notes: str | None


class HistoryIn(BaseModel):
    recipe_title: str
    rating: int = Field(ge=1, le=5)
    notes: str | None = None


@router.get("", operation_id="list_history")
async def list_history(session: SessionDep) -> list[HistoryOut]:
    from sqlalchemy import select

    result = await session.execute(
        select(CookedHistory).order_by(CookedHistory.cooked_at.desc(), CookedHistory.id.desc())
    )
    return [
        HistoryOut(
            id=row.id,
            recipe_title=row.recipe_title,
            rating=row.rating,
            cooked_at=row.cooked_at.isoformat(),
            notes=row.notes,
        )
        for row in result.scalars()
    ]


@router.post("", operation_id="rate_recipe", status_code=201)
async def rate_recipe(body: HistoryIn, session: SessionDep) -> HistoryOut:
    if not body.recipe_title.strip():
        raise HTTPException(status_code=422, detail="recipe_title requis")
    entry = CookedHistory(
        recipe_title=body.recipe_title.strip(),
        rating=body.rating,
        notes=body.notes,
    )
    session.add(entry)
    await session.commit()
    return HistoryOut(
        id=entry.id,
        recipe_title=entry.recipe_title,
        rating=entry.rating,
        cooked_at=entry.cooked_at.isoformat(),
        notes=entry.notes,
    )
