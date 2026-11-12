"""Répertoires de recettes et recettes (importées d'une URL ou créées à la main)."""

import json
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


class RecipeCollection(SQLModel, table=True):
    __tablename__ = "recipe_collections"

    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(unique=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Recipe(SQLModel, table=True):
    __tablename__ = "recipes"

    id: int | None = Field(default=None, primary_key=True)
    collection_id: int | None = Field(default=None, foreign_key="recipe_collections.id")
    title: str
    url: str | None = None
    minutes: int | None = None
    diet_tags: list[Any] = Field(default_factory=list, sa_column=Column(JSON))
    ingredients: list[Any] = Field(default_factory=list, sa_column=Column(JSON))
    steps: list[Any] = Field(default_factory=list, sa_column=Column(JSON))
    style: str | None = None

    def normalized_ingredients(self) -> list[str]:
        return [str(i).strip().lower() for i in self.ingredients]


def dumps(value: Any) -> str:
    """Sérialise pour les tests et les logs."""
    return json.dumps(value, ensure_ascii=False)
