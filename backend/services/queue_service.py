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
        "linkedFrom": row["linked_from"], "forwardedTo": row["forwarded_to"],
        "counter": row["counter"],
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
    open_counters = {
        row["code"]: [int(c) for c in row["counters"].split(",")]
        for row in conn.execute("SELECT code, counters FROM open_counters WHERE queue_date = ?", (day,)).fetchall()
    }
    return {
        "date": day,
        "counters": counters,
        "openCounters": open_counters,
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


# ---- US-11 Multiple counters: up to 3 service counters per queue; Counter 1 is open unless changed today ----
MAX_COUNTERS = 3


def check_counter(counter: int) -> None:
    if not isinstance(counter, int) or isinstance(counter, bool) or not 1 <= counter <= MAX_COUNTERS:
        raise ValueError("Choose Counter 1, 2 or 3.")


def open_counters(conn: Connection, day: str, code: str) -> list[int]:
    row = conn.execute(
        "SELECT counters FROM open_counters WHERE queue_date = ? AND code = ?", (day, code)
    ).fetchone()
    return [int(c) for c in row["counters"].split(",")] if row else [1]


def check_open(conn: Connection, day: str, code: str, counter: int) -> None:
    check_counter(counter)
    if counter not in open_counters(conn, day, code):
        raise ValueError(f"Counter {counter} is paused. Open it to call patients.")


def serving_at(conn: Connection, day: str, code: str, counter: int):
    # Tokens called before US-11 have no counter; they belong to Counter 1.
    return conn.execute(
        """SELECT * FROM tokens WHERE queue_date = ? AND code = ? AND status = 'serving'
           AND COALESCE(counter, 1) = ? ORDER BY seq LIMIT 1""", (day, code, counter),
    ).fetchone()


def complete_at(conn: Connection, day: str, code: str, counter: int, now: int) -> None:
    conn.execute(
        """UPDATE tokens SET status = 'done', done_at = ?
           WHERE queue_date = ? AND code = ? AND status = 'serving' AND COALESCE(counter, 1) = ?""",
        (now, day, code, counter),
    )


def set_counter(conn: Connection, code: str, counter: int, is_open: bool) -> list[int]:
    """Open or pause a counter. A counter serving a patient cannot be paused; one counter always stays open."""
    code = code.strip().upper()
    if not department(conn, code):
        raise ValueError("Unknown department.")
    check_counter(counter)
    day = today_key()
    with conn:
        conn.execute("BEGIN IMMEDIATE")
        current = open_counters(conn, day, code)
        if is_open:
            updated = sorted(set(current) | {counter})
        else:
            serving = serving_at(conn, day, code, counter)
            if serving and counter in current:
                raise ValueError(f"{serving['number']} is at Counter {counter}. Finish or skip it before pausing.")
            updated = [c for c in current if c != counter]
            if not updated:
                raise ValueError("Keep at least one counter open.")
        conn.execute(
            """INSERT INTO open_counters(queue_date, code, counters) VALUES (?, ?, ?)
               ON CONFLICT(queue_date, code) DO UPDATE SET counters = excluded.counters""",
            (day, code, ",".join(str(c) for c in updated)),
        )
    return updated


def call_next(conn: Connection, code: str, counter: int = 1) -> dict | None:
    """Call the next waiting token to a counter; the patient at that counter is completed first."""
    code = code.strip().upper()
    if not department(conn, code):
        raise ValueError("Unknown department.")
    day, now = today_key(), now_ms()
    with conn:
        conn.execute("BEGIN IMMEDIATE")
        check_open(conn, day, code, counter)
        complete_at(conn, day, code, counter, now)
        next_row = conn.execute(
            """SELECT id FROM tokens
               WHERE queue_date = ? AND code = ? AND status = 'waiting'
               ORDER BY seq LIMIT 1""", (day, code),
        ).fetchone()
        if not next_row:
            return None
        conn.execute(
            "UPDATE tokens SET status = 'serving', called_at = ?, counter = ? WHERE id = ?",
            (now, counter, next_row["id"]),
        )
    return token_from_row(conn.execute("SELECT * FROM tokens WHERE id = ?", (next_row["id"],)).fetchone())


def skip_current(conn: Connection, code: str, counter: int = 1) -> dict | None:
    code, day, now = code.strip().upper(), today_key(), now_ms()
    if not department(conn, code):
        raise ValueError("Unknown department.")
    check_counter(counter)
    with conn:
        conn.execute("BEGIN IMMEDIATE")
        current = serving_at(conn, day, code, counter)
        if not current:
            return None
        conn.execute(
            "UPDATE tokens SET status = 'missed', skipped_at = ?, done_at = NULL WHERE id = ?",
            (now, current["id"]),
        )
    return token_from_row(conn.execute("SELECT * FROM tokens WHERE id = ?", (current["id"],)).fetchone())


def recall_token(conn: Connection, number: str, counter: int = 1) -> dict | None:
    """Recall a missed token to a counter; the patient at that counter is completed first."""
    day, now = today_key(), now_ms()
    with conn:
        conn.execute("BEGIN IMMEDIATE")
        missed = conn.execute(
            "SELECT id, code FROM tokens WHERE queue_date = ? AND number = ? AND status = 'missed'",
            (day, number.strip().upper()),
        ).fetchone()
        if not missed:
            return None
        check_open(conn, day, missed["code"], counter)
        complete_at(conn, day, missed["code"], counter, now)
        conn.execute(
            "UPDATE tokens SET status = 'serving', called_at = ?, counter = ? WHERE id = ?",
            (now, counter, missed["id"]),
        )
    return token_from_row(conn.execute("SELECT * FROM tokens WHERE id = ?", (missed["id"],)).fetchone())


def send_to(conn: Connection, from_code: str, to_code: str, counter: int = 1) -> dict | None:
    """US-04 Send to Billing: complete the patient at a counter of one queue and add them to the end of another
    queue with a new token carrying the same details. Returns the new token, or None if nobody is being served."""
    from_code, to_code = from_code.strip().upper(), to_code.strip().upper()
    if not department(conn, from_code) or not department(conn, to_code):
        raise ValueError("Unknown department.")
    if from_code == to_code:
        raise ValueError("A queue cannot send a patient to itself.")
    check_counter(counter)
    day, now = today_key(), now_ms()
    with conn:
        conn.execute("BEGIN IMMEDIATE")
        current = serving_at(conn, day, from_code, counter)
        if not current:
            return None
        counter = conn.execute(
            "SELECT last_seq FROM queue_counters WHERE queue_date = ? AND code = ?", (day, to_code),
        ).fetchone()
        seq = (counter["last_seq"] if counter else 0) + 1
        if seq > 999:
            raise ValueError("Today's token limit for this department has been reached.")
        conn.execute(
            """INSERT INTO queue_counters(queue_date, code, last_seq) VALUES (?, ?, ?)
               ON CONFLICT(queue_date, code) DO UPDATE SET last_seq = excluded.last_seq""",
            (day, to_code, seq),
        )
        number = to_code + str(seq).zfill(3)
        conn.execute(
            """INSERT INTO tokens
               (queue_date, number, code, seq, status, patient_name, age, gender, phone, doctor, created_at, linked_from)
               VALUES (?, ?, ?, ?, 'waiting', ?, ?, ?, ?, '', ?, ?)""",
            (day, number, to_code, seq, current["patient_name"], current["age"], current["gender"],
             current["phone"], now, current["number"]),
        )
        conn.execute(
            "UPDATE tokens SET status = 'done', done_at = ?, forwarded_to = ? WHERE id = ?",
            (now, number, current["id"]),
        )
    return token_from_row(conn.execute(
        "SELECT * FROM tokens WHERE queue_date = ? AND number = ?", (day, number)).fetchone())
