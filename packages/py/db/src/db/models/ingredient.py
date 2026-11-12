"""Un ingrédient nommé, partagé entre le frigo et les recettes."""

from datetime import datetime, timezone

from sqlmodel import Field, SQLModel


class Ingredient(SQLModel, table=True):
    __tablename__ = "ingredients"

    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(unique=True, index=True)


class FridgeItem(SQLModel, table=True):
    __tablename__ = "fridge_items"

    ingredient_id: int = Field(primary_key=True)
    added_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
