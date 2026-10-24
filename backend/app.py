"""CareQueue Flask API and static frontend server."""
from __future__ import annotations

import os
import sys
from pathlib import Path
from flask import Flask, jsonify, request, send_from_directory, Response

ROOT = Path(__file__).resolve().parent.parent
FRONTEND = ROOT / "frontend"
if str(Path(__file__).resolve().parent) not in sys.path:
    sys.path.insert(0, str(Path(__file__).resolve().parent))

from db import close_db, get_db, init_database
from services.queue_service import (
    call_next, get_day, issue_token, list_departments, recall_token, skip_current,
)


def create_app(test_config: dict | None = None) -> Flask:
    app = Flask(__name__, static_folder=str(FRONTEND), static_url_path="")
    app.config.update(
        DATABASE=os.environ.get("CAREQUEUE_DB_PATH", str(ROOT / "database" / "carequeue.sqlite3")),
        TESTING=os.environ.get("CAREQUEUE_TEST_MODE", "") == "1",
        JSON_SORT_KEYS=False,
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

    @app.get("/api/queue/state")
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
    def call_next_route(code: str):
        try:
            token = call_next(get_db(), code)
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400
        return jsonify({"token": token})

    @app.post("/api/queue/<code>/skip")
    def skip_route(code: str):
        try:
            token = skip_current(get_db(), code)
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400
        return jsonify({"token": token})

    @app.post("/api/tokens/<number>/recall")
    def recall_route(number: str):
        token = recall_token(get_db(), number)
        if token is None:
            return jsonify({"token": None, "error": "No missed token with that number was found."}), 404
        return jsonify({"token": token})

    @app.post("/api/test/reset")
    def reset_for_tests():
        if not app.config.get("TESTING"):
            return jsonify({"error": "Not found"}), 404
        conn = get_db()
        with conn:
            conn.execute("DELETE FROM tokens")
            conn.execute("DELETE FROM queue_counters")
        return jsonify({"status": "reset"})

    return app


if __name__ == "__main__":
    app = create_app()
    port = int(os.environ.get("CAREQUEUE_PORT", "8000"))
    app.run(host="127.0.0.1", port=port, debug=False, threaded=True)
