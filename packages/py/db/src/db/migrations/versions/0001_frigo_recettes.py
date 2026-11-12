"""frigo-recettes: tables du frigo, des répertoires de recettes et de l'historique.

Revision ID: 0001_frigo
Revises:
Create Date: 2026-11-12

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0001_frigo"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "ingredients",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.Text(), nullable=False, unique=True, index=True),
    )
    op.create_table(
        "fridge_items",
        sa.Column("ingredient_id", sa.Integer(), primary_key=True),
        sa.Column("added_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "recipe_collections",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.Text(), nullable=False, unique=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "recipes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("collection_id", sa.Integer(), sa.ForeignKey("recipe_collections.id"), nullable=True),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("url", sa.Text(), nullable=True),
        sa.Column("minutes", sa.Integer(), nullable=True),
        sa.Column("diet_tags", sa.JSON(), nullable=False),
        sa.Column("ingredients", sa.JSON(), nullable=False),
        sa.Column("steps", sa.JSON(), nullable=False),
        sa.Column("style", sa.Text(), nullable=True),
    )
    op.create_table(
        "inspiration_sources",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.Text(), nullable=False, unique=True),
        sa.Column("collection_id", sa.Integer(), nullable=True),
    )
    op.create_table(
        "cooked_history",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("recipe_title", sa.Text(), nullable=False),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column("cooked_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("cooked_history")
    op.drop_table("inspiration_sources")
    op.drop_table("recipes")
    op.drop_table("recipe_collections")
    op.drop_table("fridge_items")
    op.drop_table("ingredients")
