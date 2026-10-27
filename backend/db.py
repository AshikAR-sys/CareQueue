"""SQLite initialization and request-scoped connections."""
from __future__ import annotations

import sqlite3
from pathlib import Path
from flask import current_app, g

ROOT = Path(__file__).resolve().parent.parent
SCHEMA = ROOT / "database" / "schema.sql"
SEED = ROOT / "database" / "seed.sql"


def connect(path: str) -> sqlite3.Connection:
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(target), timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA busy_timeout = 10000")
    return conn


def init_database(app) -> None:
    conn = connect(app.config["DATABASE"])
    try:
        with conn:
            conn.executescript(SCHEMA.read_text(encoding="utf-8"))
            upgrade_schema(conn)
            if SEED.exists():
                conn.executescript(SEED.read_text(encoding="utf-8"))
    finally:
        conn.close()


def upgrade_schema(conn: sqlite3.Connection) -> None:
    """Add columns introduced after a database was first created (CREATE TABLE IF NOT EXISTS skips them)."""
    columns = {row["name"] for row in conn.execute("PRAGMA table_info(tokens)")}
    for name in ("linked_from", "forwarded_to"):  # US-04 Send to Billing
        if name not in columns:
            conn.execute(f"ALTER TABLE tokens ADD COLUMN {name} TEXT")
    if "counter" not in columns:  # US-11 Multiple counters
        conn.execute("ALTER TABLE tokens ADD COLUMN counter INTEGER")
    if "priority" not in columns:  # US-17 Priority tokens
        conn.execute("ALTER TABLE tokens ADD COLUMN priority TEXT")
    if "rating" not in columns:  # US-20 Rate my visit
        conn.execute("ALTER TABLE tokens ADD COLUMN rating INTEGER")


def get_db() -> sqlite3.Connection:
    if "db" not in g:
        g.db = connect(current_app.config["DATABASE"])
    return g.db


def close_db(_error=None) -> None:
    conn = g.pop("db", None)
    if conn is not None:
        conn.close()
