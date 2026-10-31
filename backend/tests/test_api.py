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
        # Staff routes need a staff pass (QA fix 3); most tests act as a signed-in receptionist.
        token = self.app.test_client().post("/api/staff/sign-in", json={"pin": "1234"}).get_json()["token"]
        self.client.environ_base["HTTP_AUTHORIZATION"] = "Bearer " + token

    def tearDown(self):
        self.temp_dir.cleanup()

    def issue(self, name="Priya Sharma", phone="9876543210", code="G", priority=None, age="40"):
        payload = {
            "code": code,
            "patient": {
                "name": name, "age": age, "gender": "Female",
                "phone": phone, "doctor": "Dr. Anjali Rao"
            }
        }
        if priority is not None:
            payload["priority"] = priority
        return self.client.post("/api/tokens", json=payload)

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
                           .replace("  linked_from TEXT,\n  forwarded_to TEXT,\n", "")
                           .replace("  counter INTEGER CHECK(counter BETWEEN 1 AND 3),\n", "")
                           .replace("  priority TEXT CHECK(priority IN ('senior','pregnant','emergency')),\n", "")
                           .replace("  rating INTEGER CHECK(rating BETWEEN 1 AND 5),\n", "")
                           .replace("  away_until INTEGER,\n", ""))
        conn.close()
        upgraded = create_app({"TESTING": True, "DATABASE": old})
        columns = {row[1] for row in sqlite3.connect(old).execute("PRAGMA table_info(tokens)")}
        self.assertTrue({"linked_from", "forwarded_to", "counter", "priority", "rating", "away_until"} <= columns)
        self.assertEqual(upgraded.test_client().get("/api/health").status_code, 200)

    # ---- US-11 Multiple counters ----

    def call(self, code="G", counter=None):
        body = {} if counter is None else {"counter": counter}
        return self.client.post(f"/api/queue/{code}/call-next", json=body)

    def set_counter(self, counter, is_open, code="G"):
        return self.client.post(f"/api/queue/{code}/counters/{counter}", json={"open": is_open})

    def test_counter_one_is_open_by_default_and_calls_without_a_counter(self):
        self.issue()
        token = self.call().get_json()["token"]
        self.assertEqual(token["counter"], 1)
        state = self.client.get("/api/queue/public-state").get_json()
        self.assertEqual(state["openCounters"], {})

    def test_two_open_counters_each_serve_their_own_patient(self):
        for name in ("Priya Sharma", "Ravi Kumar", "Anita Das"):
            self.issue(name=name)
        response = self.set_counter(2, True)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["openCounters"], [1, 2])
        self.assertEqual(self.call(counter=1).get_json()["token"]["number"], "G001")
        second = self.call(counter=2).get_json()["token"]
        self.assertEqual((second["number"], second["counter"]), ("G002", 2))
        third = self.call(counter=1).get_json()["token"]          # finishes G001 only
        self.assertEqual((third["number"], third["counter"]), ("G003", 1))
        state = {t["number"]: t for t in self.client.get("/api/queue/state").get_json()["tokens"]}
        self.assertEqual(state["G001"]["status"], "done")
        self.assertEqual(state["G002"]["status"], "serving")
        public = self.client.get("/api/queue/public-state").get_json()
        self.assertEqual(public["openCounters"], {"G": [1, 2]})

    def test_paused_counter_cannot_call(self):
        self.issue()
        response = self.call(counter=2)
        self.assertEqual(response.status_code, 400)
        self.assertIn("Counter 2 is paused", response.get_json()["error"])
        self.assertEqual(self.call(counter=4).status_code, 400)

    def test_counter_pause_rules(self):
        self.issue()
        self.assertEqual(self.set_counter(1, False).status_code, 400)       # last open counter
        self.set_counter(2, True)
        self.call(counter=2)
        refused = self.set_counter(2, False)
        self.assertEqual(refused.status_code, 400)
        self.assertIn("G001 is at Counter 2", refused.get_json()["error"])
        self.assertEqual(self.set_counter(1, False).get_json()["openCounters"], [2])
        self.assertEqual(self.set_counter(5, True).status_code, 400)

    def test_skip_recall_and_send_to_use_the_counter(self):
        self.issue()
        self.issue(name="Ravi Kumar")
        self.set_counter(2, True)
        self.call(counter=1)
        self.call(counter=2)
        skipped = self.client.post("/api/queue/G/skip", json={"counter": 2}).get_json()["token"]
        self.assertEqual(skipped["number"], "G002")
        recalled = self.client.post("/api/tokens/G002/recall", json={"counter": 2}).get_json()["token"]
        self.assertEqual((recalled["status"], recalled["counter"]), ("serving", 2))
        billing = self.client.post("/api/queue/G/send-to/B", json={"counter": 2}).get_json()["token"]
        self.assertEqual(billing["linkedFrom"], "G002")
        state = {t["number"]: t["status"] for t in self.client.get("/api/queue/state").get_json()["tokens"]}
        self.assertEqual(state["G001"], "serving")

    # ---- QA fix 3: staff routes need a staff pass from the server ----

    STAFF_ROUTES = [
        ("get", "/api/queue/state"),
        ("post", "/api/queue/G/call-next"),
        ("post", "/api/queue/G/skip"),
        ("post", "/api/queue/G/send-to/B"),
        ("post", "/api/tokens/G001/recall"),
        ("post", "/api/queue/G/counters/2"),
    ]

    def test_staff_routes_refuse_requests_without_a_staff_pass(self):
        self.issue()
        anonymous = self.app.test_client()
        for method, path in self.STAFF_ROUTES:
            response = getattr(anonymous, method)(path, json={})
            self.assertEqual(response.status_code, 401, path)
            self.assertIn("sign in", response.get_json()["error"].lower())
        state = self.client.get("/api/queue/state").get_json()
        self.assertEqual(state["tokens"][0]["status"], "waiting", "nothing changed")

    def test_patient_and_public_routes_need_no_staff_pass(self):
        anonymous = self.app.test_client()
        self.assertEqual(anonymous.post("/api/tokens", json={
            "code": "G", "patient": {"name": "Priya Sharma", "age": "40", "gender": "Female", "phone": "9876543210"}
        }).status_code, 201)
        for path in ("/api/health", "/api/departments", "/api/queue/public-state"):
            self.assertEqual(anonymous.get(path).status_code, 200, path)

    def test_sign_in_checks_the_pin_on_the_server(self):
        anonymous = self.app.test_client()
        wrong = anonymous.post("/api/staff/sign-in", json={"pin": "0000"})
        self.assertEqual(wrong.status_code, 401)
        self.assertIn("Incorrect PIN", wrong.get_json()["error"])
        self.assertEqual(anonymous.post("/api/staff/sign-in", json={}).status_code, 401)
        right = anonymous.post("/api/staff/sign-in", json={"pin": "1234"}).get_json()
        self.assertTrue(right["token"])
        headers = {"Authorization": "Bearer " + right["token"]}
        self.assertEqual(anonymous.get("/api/queue/state", headers=headers).status_code, 200)

    def test_forged_or_expired_staff_pass_is_refused(self):
        anonymous = self.app.test_client()
        token = anonymous.post("/api/staff/sign-in", json={"pin": "1234"}).get_json()["token"]
        forged = token[:-2] + ("AA" if not token.endswith("AA") else "BB")
        self.assertEqual(anonymous.get("/api/queue/state", headers={"Authorization": "Bearer " + forged}).status_code, 401)
        self.assertEqual(anonymous.get("/api/queue/state", headers={"Authorization": "Bearer nonsense"}).status_code, 401)
        self.app.config["STAFF_SESSION_SECONDS"] = -1
        self.assertEqual(anonymous.get("/api/queue/state", headers={"Authorization": "Bearer " + token}).status_code, 401)

    def test_staff_pin_can_be_changed_by_configuration(self):
        app = create_app({"TESTING": True, "DATABASE": str(Path(self.temp_dir.name) / "pin.sqlite3"), "STAFF_PIN": "8642"})
        client = app.test_client()
        self.assertEqual(client.post("/api/staff/sign-in", json={"pin": "1234"}).status_code, 401)
        self.assertEqual(client.post("/api/staff/sign-in", json={"pin": "8642"}).status_code, 200)

    # ---- US-17 Priority tokens ----

    def test_priority_token_is_issued_and_validated(self):
        token = self.issue(priority="pregnant").get_json()["token"]
        self.assertEqual(token["priority"], "pregnant")
        self.assertIsNone(self.issue(name="Ravi Kumar").get_json()["token"]["priority"])
        bad = self.issue(name="Anita Das", priority="vip")
        self.assertEqual(bad.status_code, 400)
        self.assertIn("priority", bad.get_json()["error"].lower())
        young = self.issue(name="Mohan Iyer", priority="senior", age="40")
        self.assertEqual(young.status_code, 400)
        self.assertIn("60", young.get_json()["error"])
        self.assertEqual(self.issue(name="Lakshmi Rao", priority="senior", age="67").status_code, 201)

    def test_call_next_calls_priority_tokens_first(self):
        self.issue()
        self.issue(name="Ravi Kumar")
        self.issue(name="Anita Das", priority="emergency")
        order = [self.client.post("/api/queue/G/call-next").get_json()["token"]["number"] for _ in range(3)]
        self.assertEqual(order, ["G003", "G001", "G002"])

    def test_public_state_shows_priority_without_the_reason(self):
        self.issue(priority="pregnant")
        public = self.client.get("/api/queue/public-state").get_json()
        self.assertIs(public["tokens"][0]["priority"], True)
        self.assertNotIn("pregnant", json.dumps(public))
        staff = self.client.get("/api/queue/state").get_json()
        self.assertEqual(staff["tokens"][0]["priority"], "pregnant")

    def test_send_to_billing_keeps_priority(self):
        self.issue(priority="emergency")
        self.client.post("/api/queue/G/call-next")
        billing = self.client.post("/api/queue/G/send-to/B").get_json()["token"]
        self.assertEqual(billing["priority"], "emergency")

    # ---- US-20 Rate my visit ----

    def rate(self, number, rating, client=None):
        return (client or self.app.test_client()).post(f"/api/tokens/{number}/rating", json={"rating": rating})

    def test_a_finished_visit_can_be_rated_once_without_sign_in(self):
        self.issue()
        self.client.post("/api/queue/G/call-next")
        self.assertEqual(self.rate("G001", 5).status_code, 409, "not finished yet")
        self.client.post("/api/queue/G/call-next")                 # G001 done
        response = self.rate("G001", 4)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["token"]["rating"], 4)
        again = self.rate("G001", 1)
        self.assertEqual(again.status_code, 409)
        self.assertIn("already", again.get_json()["error"])
        public = self.client.get("/api/queue/public-state").get_json()
        self.assertEqual(public["tokens"][0]["rating"], 4)

    def test_rating_must_be_1_to_5_for_a_real_token(self):
        self.issue()
        self.client.post("/api/queue/G/call-next")
        self.client.post("/api/queue/G/call-next")
        for bad in (0, 6, "5", None, 4.5, True):
            self.assertEqual(self.rate("G001", bad).status_code, 400, bad)
        self.assertEqual(self.rate("G999", 5).status_code, 404)

    def test_a_patient_sent_to_billing_rates_the_billing_token(self):
        self.issue()
        self.client.post("/api/queue/G/call-next")
        self.client.post("/api/queue/G/send-to/B")
        self.assertEqual(self.rate("G001", 5).status_code, 409)

    # ---- US-21 Doctor delay notice ----

    def delay(self, body, client=None):
        return (client or self.client).post("/api/queue/G/delay", json=body)

    def test_staff_post_a_delay_and_everyone_sees_it(self):
        response = self.delay({"reason": "surgery", "minutes": 20})
        self.assertEqual(response.status_code, 200)
        public = self.client.get("/api/queue/public-state").get_json()
        notice = public["delays"]["G"]
        self.assertEqual(notice["reason"], "surgery")
        self.assertAlmostEqual((notice["until"] - response.get_json()["delay"]["until"]) / 1000, 0, delta=1)

    def test_delay_needs_staff_and_valid_values(self):
        self.assertEqual(self.delay({"reason": "surgery", "minutes": 20}, self.app.test_client()).status_code, 401)
        for bad in ({"reason": "lunch party", "minutes": 20}, {"reason": "break", "minutes": 0},
                    {"reason": "break", "minutes": 181}, {"reason": "break", "minutes": "20"}):
            self.assertEqual(self.delay(bad).status_code, 400, bad)
        self.assertEqual(self.client.post("/api/queue/Z/delay", json={"reason": "break", "minutes": 10}).status_code, 400)

    def test_clearing_a_delay_removes_it(self):
        self.delay({"reason": "break", "minutes": 15})
        cleared = self.client.post("/api/queue/G/delay", json={"clear": True})
        self.assertEqual(cleared.status_code, 200)
        self.assertIsNone(cleared.get_json()["delay"])
        self.assertEqual(self.client.get("/api/queue/public-state").get_json()["delays"], {})

    # ---- US-22 Hold my place ----

    def away(self, number, body):
        return self.app.test_client().post(f"/api/tokens/{number}/away", json=body)

    def test_a_waiting_patient_can_step_out_once_and_is_passed_over(self):
        self.issue()
        self.issue(name="Ravi Kumar")
        response = self.away("G001", {"minutes": 10})
        self.assertEqual(response.status_code, 200)
        self.assertGreater(response.get_json()["token"]["awayUntil"], 0)
        self.assertEqual(self.client.post("/api/queue/G/call-next").get_json()["token"]["number"], "G002")
        self.assertEqual(self.away("G001", {"minutes": 5}).status_code, 409, "only one step-out per token")
        back = self.away("G001", {"back": True})
        self.assertEqual(back.status_code, 200)
        self.assertEqual(self.client.post("/api/queue/G/call-next").get_json()["token"]["number"], "G001")

    def test_step_out_rules(self):
        self.issue()
        for bad in ({"minutes": 20}, {"minutes": 0}, {"minutes": "10"}, {}):
            self.assertEqual(self.away("G001", bad).status_code, 400, bad)
        self.assertEqual(self.away("G999", {"minutes": 5}).status_code, 404)
        self.client.post("/api/queue/G/call-next")
        self.assertEqual(self.away("G001", {"minutes": 5}).status_code, 409, "already called")
        self.assertEqual(self.away("G001", {"back": True}).status_code, 409, "not away")

    def test_test_reset_is_not_available_without_test_mode(self):
        production_app = create_app({"TESTING": False, "DATABASE": str(Path(self.temp_dir.name) / "prod.sqlite3")})
        response = production_app.test_client().post("/api/test/reset")
        self.assertEqual(response.status_code, 404)


if __name__ == "__main__":
    unittest.main()
