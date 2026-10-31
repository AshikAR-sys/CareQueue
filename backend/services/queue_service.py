"""Queue service: SQLite-backed operations and API response mapping."""
from __future__ import annotations

import math
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
        # US-17: staff and the patient's own token see the reason; public views only that it is a priority token.
        "priority": row["priority"] if include_patient else bool(row["priority"]),
        "rating": row["rating"],   # US-20: a number only, so the public reports can average it
        "awayUntil": row["away_until"],   # US-22: set once when the patient steps out
        "estimateMin": row["estimate_min"],   # US-24: the estimate shown when the token was issued
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
    now = now_ms()
    delays = {
        row["code"]: {"reason": row["reason"], "until": row["until_ms"]}
        for row in conn.execute(
            "SELECT code, reason, until_ms FROM delays WHERE queue_date = ? AND until_ms > ?", (day, now)
        ).fetchall()
    }
    return {
        "date": day,
        "counters": counters,
        "openCounters": open_counters,
        "delays": delays,
        "tokens": [token_from_row(row, include_patient) for row in rows],
    }


DEFAULT_AST_MS = 3 * 60 * 1000


def estimate_for_new(conn: Connection, day: str, code: str, priority, now: int) -> int:
    """US-24: the wait estimate (whole minutes) for a token about to join the end of its line. The same rule as
    QueueCore.estimate in the browser: EWT = delay left + R + (N / C) x AST."""
    waiting = conn.execute(
        "SELECT priority FROM tokens WHERE queue_date = ? AND code = ? AND status = 'waiting'", (day, code)
    ).fetchall()
    ahead = sum(1 for row in waiting if row["priority"]) if priority else len(waiting)
    served = conn.execute(
        """SELECT done_at - called_at AS span FROM tokens
           WHERE queue_date = ? AND code = ? AND status = 'done' AND called_at IS NOT NULL AND done_at IS NOT NULL
           ORDER BY done_at DESC LIMIT 10""", (day, code),
    ).fetchall()
    total_served = conn.execute(
        """SELECT COUNT(*) FROM tokens WHERE queue_date = ? AND code = ? AND status = 'done'
           AND called_at IS NOT NULL AND done_at IS NOT NULL""", (day, code),
    ).fetchone()[0]
    ast = DEFAULT_AST_MS if total_served < 3 else sum(row["span"] for row in served) / len(served)
    counters = open_counters(conn, day, code)
    left = []
    for counter in counters:
        current = serving_at(conn, day, code, counter)
        left.append(max(0, ast - (now - current["called_at"])) if current else 0)
    delay = conn.execute("SELECT until_ms FROM delays WHERE queue_date = ? AND code = ?", (day, code)).fetchone()
    delay_ms = max(0, delay["until_ms"] - now) if delay else 0
    return math.ceil((delay_ms + min(left) + ahead / len(counters) * ast) / 60000)


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

    priority = payload.get("priority") or None
    if priority not in (None, "senior", "pregnant", "emergency"):
        raise ValueError("Choose a valid priority: senior, pregnant or emergency.")
    if priority == "senior" and age < 60:
        raise ValueError("Senior citizen priority is for patients aged 60 or over.")

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
        estimate = estimate_for_new(conn, day, code, priority, created)
        conn.execute(
            """INSERT INTO tokens
               (queue_date, number, code, seq, status, patient_name, age, gender, phone, doctor, created_at, priority,
                estimate_min)
               VALUES (?, ?, ?, ?, 'waiting', ?, ?, ?, ?, ?, ?, ?, ?)""",
            (day, number, code, seq, name, age, gender, phone, doctor, created, priority, estimate),
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
                 AND (away_until IS NULL OR away_until <= ?)
               ORDER BY priority IS NULL, seq LIMIT 1""", (day, code, now),
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
        estimate = estimate_for_new(conn, day, to_code, current["priority"], now)
        conn.execute(
            """INSERT INTO tokens
               (queue_date, number, code, seq, status, patient_name, age, gender, phone, doctor, created_at,
                linked_from, priority, estimate_min)
               VALUES (?, ?, ?, ?, 'waiting', ?, ?, ?, ?, '', ?, ?, ?, ?)""",
            (day, number, to_code, seq, current["patient_name"], current["age"], current["gender"],
             current["phone"], now, current["number"], current["priority"], estimate),
        )
        conn.execute(
            "UPDATE tokens SET status = 'done', done_at = ?, forwarded_to = ? WHERE id = ?",
            (now, number, current["id"]),
        )
    return token_from_row(conn.execute(
        "SELECT * FROM tokens WHERE queue_date = ? AND number = ?", (day, number)).fetchone())


class RatingRefused(Exception):
    """The token cannot be rated (not finished, sent on to Billing, or already rated)."""


def rate_visit(conn: Connection, number: str, rating) -> dict | None:
    """US-20: save the patient's 1-5 star rating of a finished visit, once. None if the token does not exist today."""
    if isinstance(rating, bool) or not isinstance(rating, int) or not 1 <= rating <= 5:
        raise ValueError("Choose a rating from 1 to 5 stars.")
    day = today_key()
    with conn:
        conn.execute("BEGIN IMMEDIATE")
        row = conn.execute(
            "SELECT * FROM tokens WHERE queue_date = ? AND number = ?", (day, number.strip().upper())
        ).fetchone()
        if not row:
            return None
        if row["rating"]:
            raise RatingRefused("This visit has already been rated. Thank you.")
        if row["status"] != "done" or row["forwarded_to"]:
            raise RatingRefused("You can rate your visit when it is finished.")
        conn.execute("UPDATE tokens SET rating = ? WHERE id = ?", (rating, row["id"]))
    return token_from_row(conn.execute("SELECT * FROM tokens WHERE id = ?", (row["id"],)).fetchone(), include_patient=False)


DELAY_REASONS = ("surgery", "break", "emergency", "other")


def set_delay(conn: Connection, code: str, reason=None, minutes=None, clear: bool = False) -> dict | None:
    """US-21: post a doctor delay notice for a queue (5-180 minutes from now), or clear it. Returns the notice."""
    code = code.strip().upper()
    if not department(conn, code):
        raise ValueError("Unknown department.")
    day = today_key()
    with conn:
        if clear:
            conn.execute("DELETE FROM delays WHERE queue_date = ? AND code = ?", (day, code))
            return None
        if reason not in DELAY_REASONS:
            raise ValueError("Choose a reason: surgery, break, emergency or other.")
        if isinstance(minutes, bool) or not isinstance(minutes, int) or not 5 <= minutes <= 180:
            raise ValueError("The delay must be 5 to 180 minutes.")
        until = now_ms() + minutes * 60 * 1000
        conn.execute(
            """INSERT INTO delays(queue_date, code, reason, until_ms) VALUES (?, ?, ?, ?)
               ON CONFLICT(queue_date, code) DO UPDATE SET reason = excluded.reason, until_ms = excluded.until_ms""",
            (day, code, reason, until),
        )
    return {"reason": reason, "until": until}


class StepOutRefused(Exception):
    """The patient cannot step out now (not waiting, already used their step-out, or not away)."""


def step_out(conn: Connection, number: str, minutes=None, back: bool = False) -> dict | None:
    """US-22: a waiting patient steps out for 5, 10 or 15 minutes (once per token), or says they are back.
    None if the token does not exist today."""
    if not back and (isinstance(minutes, bool) or minutes not in (5, 10, 15)):
        raise ValueError("Choose 5, 10 or 15 minutes.")
    day, now = today_key(), now_ms()
    with conn:
        conn.execute("BEGIN IMMEDIATE")
        row = conn.execute(
            "SELECT * FROM tokens WHERE queue_date = ? AND number = ?", (day, number.strip().upper())
        ).fetchone()
        if not row:
            return None
        if row["status"] != "waiting":
            raise StepOutRefused("Only a waiting token can step out.")
        if back:
            if not row["away_until"] or row["away_until"] <= now:
                raise StepOutRefused("This token is not marked as away.")
            until = now          # kept, so the step-out cannot be used again
        else:
            if row["away_until"]:
                raise StepOutRefused("You have already stepped out once with this token.")
            until = now + minutes * 60 * 1000
        conn.execute("UPDATE tokens SET away_until = ? WHERE id = ?", (until, row["id"]))
    return token_from_row(conn.execute("SELECT * FROM tokens WHERE id = ?", (row["id"],)).fetchone(), include_patient=False)


HISTORY_DAYS = 28


def hourly_history(conn: Connection) -> list[list]:
    """US-25: [code, created_at, date] for every token of the previous 28 days (not today). Numbers only."""
    today = date.fromisoformat(today_key())
    start = date.fromordinal(today.toordinal() - HISTORY_DAYS).isoformat()
    rows = conn.execute(
        "SELECT code, created_at, queue_date FROM tokens WHERE queue_date >= ? AND queue_date < ? ORDER BY id",
        (start, today.isoformat()),
    ).fetchall()
    return [[row["code"], row["created_at"], row["queue_date"]] for row in rows]
