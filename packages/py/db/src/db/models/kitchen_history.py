"""Sources d'inspiration (sites, cuisiniers) et historique des recettes faites."""

from datetime import datetime, timezone

from sqlmodel import Field, SQLModel


class InspirationSource(SQLModel, table=True):
    __tablename__ = "inspiration_sources"

    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(unique=True)
    collection_id: int | None = Field(default=None)


class CookedHistory(SQLModel, table=True):
    __tablename__ = "cooked_history"

    id: int | None = Field(default=None, primary_key=True)
    recipe_title: str
    rating: int
    cooked_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    notes: str | None = None
