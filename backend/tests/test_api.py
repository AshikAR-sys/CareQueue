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

    def test_test_reset_is_not_available_without_test_mode(self):
        production_app = create_app({"TESTING": False, "DATABASE": str(Path(self.temp_dir.name) / "prod.sqlite3")})
        response = production_app.test_client().post("/api/test/reset")
        self.assertEqual(response.status_code, 404)


if __name__ == "__main__":
    unittest.main()
