"""API integration tests for token persistence and queue transitions."""
import json
import tempfile
import unittest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import create_app  # noqa: E402


class CareQueueApiTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        database = str(Path(self.temp_dir.name) / "test.sqlite3")
        self.app = create_app({"TESTING": True, "DATABASE": database})
        self.client = self.app.test_client()

    def tearDown(self):
        self.temp_dir.cleanup()

    def issue(self, name="Priya Sharma", phone="9876543210", code="G"):
        return self.client.post("/api/tokens", json={
            "code": code,
            "patient": {
                "name": name, "age": "40", "gender": "Female",
                "phone": phone, "doctor": "Dr. Anjali Rao"
            }
        })

    def test_health_and_departments(self):
        self.assertEqual(self.client.get("/api/health").status_code, 200)
        response = self.client.get("/api/departments")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["departments"][0]["code"], "G")

    def test_issue_persists_and_increments_token_number(self):
        first = self.issue()
        second = self.issue(name="Ravi Kumar")
        self.assertEqual(first.status_code, 201)
        self.assertEqual(first.get_json()["token"]["number"], "G001")
        self.assertEqual(second.get_json()["token"]["number"], "G002")
        state = self.client.get("/api/queue/state").get_json()
        self.assertEqual([t["number"] for t in state["tokens"]], ["G001", "G002"])

    def test_validation_rejects_invalid_phone(self):
        response = self.issue(phone="123")
        self.assertEqual(response.status_code, 400)
        self.assertIn("phone", response.get_json()["error"].lower())

    def test_call_skip_and_recall_transitions(self):
        self.issue()
        self.issue(name="Ravi Kumar")
        first = self.client.post("/api/queue/G/call-next").get_json()["token"]
        self.assertEqual(first["number"], "G001")
        skipped = self.client.post("/api/queue/G/skip").get_json()["token"]
        self.assertEqual(skipped["status"], "missed")
        second = self.client.post("/api/queue/G/call-next").get_json()["token"]
        self.assertEqual(second["number"], "G002")
        recalled = self.client.post("/api/tokens/G001/recall").get_json()["token"]
        self.assertEqual(recalled["status"], "serving")
        state = self.client.get("/api/queue/state").get_json()
        statuses = {t["number"]: t["status"] for t in state["tokens"]}
        self.assertEqual(statuses, {"G001": "serving", "G002": "done"})

    def test_public_state_never_contains_patient_details(self):
        self.issue()
        payload = json.dumps(self.client.get("/api/queue/public-state").get_json())
        self.assertIn("G001", payload)
        self.assertNotIn("Priya Sharma", payload)
        self.assertNotIn("9876543210", payload)

    # ---- US-04 Send to Billing ----

    def test_send_to_billing_completes_visit_and_issues_linked_billing_token(self):
        self.issue()
        self.client.post("/api/queue/G/call-next")
        response = self.client.post("/api/queue/G/send-to/B")
        self.assertEqual(response.status_code, 200)
        billing = response.get_json()["token"]
        self.assertEqual(billing["number"], "B001")
        self.assertEqual(billing["status"], "waiting")
        self.assertEqual(billing["linkedFrom"], "G001")
        self.assertEqual(billing["patient"]["name"], "Priya Sharma")
        self.assertEqual(billing["patient"]["doctor"], "")
        state = {t["number"]: t for t in self.client.get("/api/queue/state").get_json()["tokens"]}
        self.assertEqual(state["G001"]["status"], "done")
        self.assertEqual(state["G001"]["forwardedTo"], "B001")
        self.assertIsNotNone(state["G001"]["doneAt"])

    def test_send_to_billing_with_nobody_serving_returns_no_token(self):
        self.issue()
        response = self.client.post("/api/queue/G/send-to/B")
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.get_json()["token"])
        self.assertEqual(len(self.client.get("/api/queue/state").get_json()["tokens"]), 1)

    def test_send_to_same_queue_is_refused(self):
        self.issue(code="B")
        self.client.post("/api/queue/B/call-next")
        self.assertEqual(self.client.post("/api/queue/B/send-to/B").status_code, 400)

    def test_billing_is_a_department_and_public_state_hides_patient(self):
        codes = [d["code"] for d in self.client.get("/api/departments").get_json()["departments"]]
        self.assertIn("B", codes)
        self.issue()
        self.client.post("/api/queue/G/call-next")
        self.client.post("/api/queue/G/send-to/B")
        payload = json.dumps(self.client.get("/api/queue/public-state").get_json())
        self.assertIn("B001", payload)
        self.assertNotIn("Priya Sharma", payload)

    def test_existing_database_gets_link_columns(self):
        import sqlite3
        old = str(Path(self.temp_dir.name) / "old.sqlite3")
        conn = sqlite3.connect(old)
        conn.executescript(Path(__file__).resolve().parents[2].joinpath("database", "schema.sql").read_text()
                           .replace("  linked_from TEXT,\n  forwarded_to TEXT,\n", ""))
        conn.close()
        upgraded = create_app({"TESTING": True, "DATABASE": old})
        columns = {row[1] for row in sqlite3.connect(old).execute("PRAGMA table_info(tokens)")}
        self.assertTrue({"linked_from", "forwarded_to"} <= columns)
        self.assertEqual(upgraded.test_client().get("/api/health").status_code, 200)

    def test_test_reset_is_not_available_without_test_mode(self):
        production_app = create_app({"TESTING": False, "DATABASE": str(Path(self.temp_dir.name) / "prod.sqlite3")})
        response = production_app.test_client().post("/api/test/reset")
        self.assertEqual(response.status_code, 404)


if __name__ == "__main__":
    unittest.main()
