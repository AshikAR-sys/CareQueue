"""CareQueue Flask API and static frontend server."""
from __future__ import annotations

import hmac
import os
import secrets
import sys
from functools import wraps
from pathlib import Path
from flask import Flask, current_app, jsonify, request, send_from_directory, Response
from itsdangerous import BadSignature, URLSafeTimedSerializer

ROOT = Path(__file__).resolve().parent.parent
FRONTEND = ROOT / "frontend"
if str(Path(__file__).resolve().parent) not in sys.path:
    sys.path.insert(0, str(Path(__file__).resolve().parent))

from db import close_db, get_db, init_database
from services.queue_service import (
    RatingRefused, call_next, get_day, issue_token, list_departments, rate_visit, recall_token, send_to, set_counter,
    skip_current,
)


def counter_from_request() -> int:
    """US-11: the service counter a queue action is for, from the JSON body; Counter 1 when not given."""
    payload = request.get_json(silent=True) or {}
    value = payload.get("counter", 1)
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValueError("Choose Counter 1, 2 or 3.")
    return value


# ---- QA fix 3: staff sign-in is checked on the server ----
# The receptionist's PIN is checked by POST /api/staff/sign-in, which returns a signed staff pass. Every staff route
# needs that pass in an "Authorization: Bearer <pass>" header; patient and public routes do not.

def staff_passes() -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(current_app.config["SECRET_KEY"], salt="carequeue-staff")


def staff_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        header = request.headers.get("Authorization", "")
        token = header[7:] if header.startswith("Bearer ") else ""
        try:
            staff_passes().loads(token, max_age=current_app.config["STAFF_SESSION_SECONDS"])
        except BadSignature:   # also covers an expired pass
            return jsonify({"error": "Please sign in as staff again."}), 401
        return view(*args, **kwargs)
    return wrapped


def create_app(test_config: dict | None = None) -> Flask:
    app = Flask(__name__, static_folder=str(FRONTEND), static_url_path="")
    app.config.update(
        DATABASE=os.environ.get("CAREQUEUE_DB_PATH", str(ROOT / "database" / "carequeue.sqlite3")),
        TESTING=os.environ.get("CAREQUEUE_TEST_MODE", "") == "1",
        JSON_SORT_KEYS=False,
        # Demo PIN unless CAREQUEUE_STAFF_PIN is set. Without CAREQUEUE_SECRET_KEY a new key is made at each start,
        # so staff sign in again after a restart.
        STAFF_PIN=os.environ.get("CAREQUEUE_STAFF_PIN", "1234"),
        SECRET_KEY=os.environ.get("CAREQUEUE_SECRET_KEY") or secrets.token_hex(32),
        STAFF_SESSION_SECONDS=8 * 60 * 60,
    )
    if test_config:
        app.config.update(test_config)

    init_database(app)
    app.teardown_appcontext(close_db)

    @app.get("/")
    def home():
        return send_from_directory(str(FRONTEND), "index.html")

    @app.get("/favicon.ico")
    def favicon():
        return Response(status=204)

    @app.get("/api/health")
    def health():
        return jsonify({"status": "ok", "service": "CareQueue API"})

    @app.get("/api/departments")
    def departments():
        return jsonify({"departments": list_departments(get_db())})

    @app.post("/api/staff/sign-in")
    def staff_sign_in():
        pin = str((request.get_json(silent=True) or {}).get("pin", ""))
        if not pin or not hmac.compare_digest(pin.encode(), str(app.config["STAFF_PIN"]).encode()):
            return jsonify({"error": "Incorrect PIN. Please try again."}), 401
        return jsonify({"token": staff_passes().dumps({"role": "receptionist"}),
                        "expiresIn": app.config["STAFF_SESSION_SECONDS"]})

    @app.get("/api/queue/state")
    @staff_required
    def queue_state():
        return jsonify(get_day(get_db(), include_patient=True))

    @app.get("/api/queue/public-state")
    def public_queue_state():
        # The waiting-room display receives token numbers and statuses, never patient details.
        return jsonify(get_day(get_db(), include_patient=False))

    @app.post("/api/tokens")
    def create_token():
        payload = request.get_json(silent=True) or {}
        try:
            token = issue_token(get_db(), payload)
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400
        return jsonify({"token": token}), 201

    @app.post("/api/queue/<code>/call-next")
    @staff_required
    def call_next_route(code: str):
        try:
            token = call_next(get_db(), code, counter_from_request())
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400
        return jsonify({"token": token})

    @app.post("/api/queue/<code>/skip")
    @staff_required
    def skip_route(code: str):
        try:
            token = skip_current(get_db(), code, counter_from_request())
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400
        return jsonify({"token": token})

    @app.post("/api/queue/<code>/send-to/<target>")
    @staff_required
    def send_to_route(code: str, target: str):
        # US-04 Send to Billing: token is null when nobody is being served in <code>.
        try:
            token = send_to(get_db(), code, target, counter_from_request())
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400
        return jsonify({"token": token})

    @app.post("/api/tokens/<number>/recall")
    @staff_required
    def recall_route(number: str):
        try:
            token = recall_token(get_db(), number, counter_from_request())
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400
        if token is None:
            return jsonify({"token": None, "error": "No missed token with that number was found."}), 404
        return jsonify({"token": token})

    @app.post("/api/queue/<code>/counters/<int:counter>")
    @staff_required
    def counter_route(code: str, counter: int):
        # US-11: open or pause one service counter of a queue.
        payload = request.get_json(silent=True) or {}
        try:
            counters = set_counter(get_db(), code, counter, payload.get("open") is True)
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400
        return jsonify({"openCounters": counters})

    @app.post("/api/tokens/<number>/rating")
    def rating_route(number: str):
        # US-20: patients rate their own finished visit from the phone page; no sign-in.
        payload = request.get_json(silent=True) or {}
        try:
            token = rate_visit(get_db(), number, payload.get("rating"))
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400
        except RatingRefused as exc:
            return jsonify({"error": str(exc)}), 409
        if token is None:
            return jsonify({"error": "No token with that number was found today."}), 404
        return jsonify({"token": token})

    @app.post("/api/test/reset")
    def reset_for_tests():
        if not app.config.get("TESTING"):
            return jsonify({"error": "Not found"}), 404
        conn = get_db()
        with conn:
            conn.execute("DELETE FROM tokens")
            conn.execute("DELETE FROM queue_counters")
            conn.execute("DELETE FROM open_counters")
        return jsonify({"status": "reset"})

    return app


if __name__ == "__main__":
    app = create_app()
    port = int(os.environ.get("PORT", os.environ.get("CAREQUEUE_PORT", "8000")))
    host = os.environ.get("HOST", "127.0.0.1")
    app.run(host=host, port=port, debug=False, threaded=True)
