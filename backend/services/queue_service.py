"""Queue service: SQLite-backed operations and API response mapping."""
from __future__ import annotations

from datetime import date
from sqlite3 import Connection
import json
import time


def today_key() -> str:
    return date.today().isoformat()


def now_ms() -> int:
    return int(time.time() * 1000)


def token_from_row(row, include_patient: bool = True) -> dict:
    token = {
        "number": row["number"], "code": row["code"], "seq": row["seq"],
        "status": row["status"], "createdAt": row["created_at"],
        "calledAt": row["called_at"], "doneAt": row["done_at"],
        "skippedAt": row["skipped_at"],
    }
    if include_patient:
        token["patient"] = {
            "name": row["patient_name"], "age": row["age"],
            "gender": row["gender"], "phone": row["phone"],
            "doctor": row["doctor"] or "",
        }
    else:
        token["patient"] = None
    return token


def department(conn: Connection, code: str):
    return conn.execute(
        "SELECT * FROM departments WHERE code = ? AND active = 1",
        (code.strip().upper(),),
    ).fetchone()


def list_departments(conn: Connection) -> list[dict]:
    return [
        {"id": row["id"], "code": row["code"], "name": row["name"],
         "location": row["location"], "doctors": json.loads(row["doctors_json"])}
        for row in conn.execute(
            "SELECT * FROM departments WHERE active = 1 ORDER BY sort_order"
        ).fetchall()
    ]


def get_day(conn: Connection, include_patient: bool = True) -> dict:
    day = today_key()
    counters = {
        row["code"]: row["last_seq"]
        for row in conn.execute(
            "SELECT code, last_seq FROM queue_counters WHERE queue_date = ?", (day,)
        ).fetchall()
    }
    rows = conn.execute(
        "SELECT * FROM tokens WHERE queue_date = ? ORDER BY id", (day,)
    ).fetchall()
    return {
        "date": day,
        "counters": counters,
        "tokens": [token_from_row(row, include_patient) for row in rows],
    }


def issue_token(conn: Connection, payload: dict) -> dict:
    code = str(payload.get("code", "")).strip().upper()
    if not department(conn, code):
        raise ValueError("Select a valid department.")

    patient = payload.get("patient") or {}
    name = " ".join(str(patient.get("name", "")).split())
    if len(name) < 2:
        raise ValueError("Patient name must contain at least 2 characters.")
    phone = "".join(char for char in str(patient.get("phone", "")) if char.isdigit())
    if len(phone) != 10 or phone[0] not in "6789":
        raise ValueError("A valid 10-digit phone number is required.")
    try:
        age = int(patient.get("age"))
    except (TypeError, ValueError):
        raise ValueError("Patient age must be a number from 0 to 120.")
    if age < 0 or age > 120:
        raise ValueError("Patient age must be a number from 0 to 120.")
    gender = str(patient.get("gender", "")).strip()
    if gender not in {"Female", "Male", "Other"}:
        raise ValueError("Select a valid gender.")

    day, created = today_key(), now_ms()
    doctor = str(patient.get("doctor", "")).strip()
    with conn:
        conn.execute("BEGIN IMMEDIATE")
        current = conn.execute(
            "SELECT last_seq FROM queue_counters WHERE queue_date = ? AND code = ?",
            (day, code),
        ).fetchone()
        seq = (current["last_seq"] if current else 0) + 1
        if seq > 999:
            raise ValueError("Today's token limit for this department has been reached.")
        conn.execute(
            """INSERT INTO queue_counters(queue_date, code, last_seq) VALUES (?, ?, ?)
               ON CONFLICT(queue_date, code) DO UPDATE SET last_seq = excluded.last_seq""",
            (day, code, seq),
        )
        number = code + str(seq).zfill(3)
        conn.execute(
            """INSERT INTO tokens
               (queue_date, number, code, seq, status, patient_name, age, gender, phone, doctor, created_at)
               VALUES (?, ?, ?, ?, 'waiting', ?, ?, ?, ?, ?, ?)""",
            (day, number, code, seq, name, age, gender, phone, doctor, created),
        )
    row = conn.execute(
        "SELECT * FROM tokens WHERE queue_date = ? AND number = ?", (day, number)
    ).fetchone()
    return token_from_row(row)


def call_next(conn: Connection, code: str) -> dict | None:
    code = code.strip().upper()
    if not department(conn, code):
        raise ValueError("Unknown department.")
    day, now = today_key(), now_ms()
    with conn:
        conn.execute("BEGIN IMMEDIATE")
        conn.execute(
            """UPDATE tokens SET status = 'done', done_at = ?
               WHERE queue_date = ? AND code = ? AND status = 'serving'""",
            (now, day, code),
        )
        next_row = conn.execute(
            """SELECT id FROM tokens
               WHERE queue_date = ? AND code = ? AND status = 'waiting'
               ORDER BY seq LIMIT 1""", (day, code),
        ).fetchone()
        if not next_row:
            return None
        conn.execute(
            "UPDATE tokens SET status = 'serving', called_at = ? WHERE id = ?",
            (now, next_row["id"]),
        )
    return token_from_row(conn.execute("SELECT * FROM tokens WHERE id = ?", (next_row["id"],)).fetchone())


def skip_current(conn: Connection, code: str) -> dict | None:
    code, day, now = code.strip().upper(), today_key(), now_ms()
    if not department(conn, code):
        raise ValueError("Unknown department.")
    with conn:
        conn.execute("BEGIN IMMEDIATE")
        current = conn.execute(
            """SELECT id FROM tokens WHERE queue_date = ? AND code = ? AND status = 'serving'
               ORDER BY seq LIMIT 1""", (day, code),
        ).fetchone()
        if not current:
            return None
        conn.execute(
            "UPDATE tokens SET status = 'missed', skipped_at = ?, done_at = NULL WHERE id = ?",
            (now, current["id"]),
        )
    return token_from_row(conn.execute("SELECT * FROM tokens WHERE id = ?", (current["id"],)).fetchone())


def recall_token(conn: Connection, number: str) -> dict | None:
    day, now = today_key(), now_ms()
    with conn:
        conn.execute("BEGIN IMMEDIATE")
        missed = conn.execute(
            "SELECT id, code FROM tokens WHERE queue_date = ? AND number = ? AND status = 'missed'",
            (day, number.strip().upper()),
        ).fetchone()
        if not missed:
            return None
        conn.execute(
            """UPDATE tokens SET status = 'done', done_at = ?
               WHERE queue_date = ? AND code = ? AND status = 'serving'""",
            (now, day, missed["code"]),
        )
        conn.execute(
            "UPDATE tokens SET status = 'serving', called_at = ? WHERE id = ?",
            (now, missed["id"]),
        )
    return token_from_row(conn.execute("SELECT * FROM tokens WHERE id = ?", (missed["id"],)).fetchone())
