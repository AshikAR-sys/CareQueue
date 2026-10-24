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
            if SEED.exists():
                conn.executescript(SEED.read_text(encoding="utf-8"))
    finally:
        conn.close()


def get_db() -> sqlite3.Connection:
    if "db" not in g:
        g.db = connect(current_app.config["DATABASE"])
    return g.db


def close_db(_error=None) -> None:
    conn = g.pop("db", None)
    if conn is not None:
        conn.close()
