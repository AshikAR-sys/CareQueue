// End-to-end browser tests: token page, staff console and display working together.
// Run: npm run test:e2e   (needs Playwright: npm install && npx playwright install chromium)
// Each test resets the test database through /api/test/reset and gets a fresh browser context.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const os = require("node:os");
const fs = require("node:fs");
const { spawn } = require("node:child_process");
const { chromium } = require("playwright");

const APP = "http://127.0.0.1:8765/";
let browser;
let server;
let tempDir;
let serverError = "";

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    if (server && server.exitCode !== null) throw new Error("CareQueue server exited: " + serverError);
    try {
      const response = await fetch(APP + "api/health");
      if (response.ok) return;
    } catch (_) {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("CareQueue API did not become ready. " + serverError);
}

test.before(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "carequeue-e2e-"));
  const python = process.env.PYTHON || (process.platform === "win32" ? "python" : "python3");
  server = spawn(python, ["backend/app.py"], {
    cwd: path.resolve(__dirname, ".."),
    env: { ...process.env, CAREQUEUE_PORT: "8765", CAREQUEUE_TEST_MODE: "1",
      CAREQUEUE_DB_PATH: path.join(tempDir, "carequeue.sqlite3") },
    stdio: ["ignore", "pipe", "pipe"]
  });
  server.stdout.on("data", (chunk) => { serverError += chunk.toString(); });
  server.stderr.on("data", (chunk) => { serverError += chunk.toString(); });
  await waitForServer();
  browser = await chromium.launch();
});
test.after(async () => {
  if (browser) await browser.close();
  if (server && server.exitCode === null) {
    await new Promise((resolve) => {
      const timeout = setTimeout(resolve, 3000);
      server.once("exit", () => { clearTimeout(timeout); resolve(); });
      server.kill();
    });
  }
  if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
});

async function open(ctx, file, errors) {
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(file + ": " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(file + ": " + m.text()); });
  await page.goto(APP + file);
  await page.waitForLoadState("load");
  return page;
}

async function issue(page, dept, name) {
  await page.selectOption("#department", dept);
  await page.fill("#name", name);
  await page.fill("#age", "40");
  await page.click(".segmented label:nth-child(2)");
  await page.fill("#phone", "9876543210");
  await page.click("#submit-btn");
  await page.waitForFunction(() => document.getElementById("token-card").dataset.state === "issued");
  return page.textContent("#t-number");
}

async function staffPass() {
  const response = await fetch(APP + "api/staff/sign-in", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin: "1234" })
  });
  return (await response.json()).token;
}

// Default role is "admin" — bypasses all auth guards so queue tests work unchanged.
// Opens a throwaway page to set localStorage reliably before any guarded page loads.
async function setup(viewport = { width: 1440, height: 900 }, role = "admin") {
  const reset = await fetch(APP + "api/test/reset", { method: "POST" });
  assert.equal(reset.status, 200, "the test server should reset the database before each test");
  const ctx = await browser.newContext({ viewport });
  const seed = await ctx.newPage();
  await seed.goto(APP + "index.html");
  await seed.waitForLoadState("load");
  // Staff routes need a staff pass from the server (QA fix 3); the test sessions get a real one.
  const token = await staffPass();
  await seed.evaluate((session) => {
    localStorage.setItem("carequeue-session", JSON.stringify(session));
  }, { role, timestamp: Date.now(), token });
  await seed.close();
  const errors = [];
  return { ctx, errors, open: (f) => open(ctx, f, errors) };
}

// --- existing queue tests (patient page is now patient.html) ---

test("AC-03.1 empty form is refused with a message on each field", async () => {
  const { ctx, errors, open } = await setup();
  const tok = await open("patient.html");
  await tok.click("#submit-btn");
  const msgs = await tok.$$eval(".err", (els) => els.map((e) => e.textContent).filter(Boolean));
  assert.equal(msgs.length, 5);
  assert.equal(await tok.getAttribute("#token-card", "data-state"), "sample");
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("after a token is issued, entering the next patient shows no errors until submit", async () => {
  const { ctx, open } = await setup();
  const tok = await open("patient.html");
  await issue(tok, "gen", "Priya Sharma");
  await tok.fill("#name", "");
  await tok.fill("#phone", "98");
  assert.equal(await tok.isVisible("#form-error"), false);
  assert.equal(await tok.textContent("#phone-err"), "");
  await ctx.close();
});

test("AC-01.1 / AC-02.1 tokens are issued in order per department", async () => {
  const { ctx, errors, open } = await setup();
  const tok = await open("patient.html");
  assert.equal(await issue(tok, "gen", "Priya Sharma"), "G001");
  assert.equal(await issue(tok, "gen", "Ravi Kumar"), "G002");
  assert.equal(await issue(tok, "card", "Anita Das"), "C001");
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("AC-05.1 / AC-06.1 Call Next updates the display within 2 seconds, without refresh", async () => {
  const { ctx, errors, open } = await setup();
  const tok = await open("patient.html");
  await issue(tok, "gen", "Priya Sharma");
  await issue(tok, "gen", "Ravi Kumar");
  const staff = await open("staff.html");
  const disp = await open("display.html");
  const start = Date.now();
  await staff.click("#call-next");
  await disp.waitForFunction(() => document.querySelector(".panel-number")?.textContent === "G001", null, { timeout: 2000 });
  assert.ok(Date.now() - start < 2000);
  await staff.click("#call-next");
  await disp.waitForFunction(() => document.querySelector(".panel-number")?.textContent === "G002", null, { timeout: 2000 });
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("AC-05.1 Call Next confirms which token was called", async () => {
  const { ctx, open } = await setup();
  const tok = await open("patient.html");
  await issue(tok, "gen", "Priya Sharma");
  const staff = await open("staff.html");
  await staff.click("#call-next");
  await staff.waitForFunction(() => document.getElementById("serving-number").textContent === "G001");
  assert.equal(await staff.textContent("#serving-hint"), "Called G001 to Counter 1. It is now on the display.");
  await ctx.close();
});

test("AC-05.2 with nobody waiting, Call Next is disabled and says no one is waiting", async () => {
  const { ctx, errors, open } = await setup();
  const staff = await open("staff.html");
  assert.equal(await staff.isDisabled("#call-next"), true);
  assert.match(await staff.textContent("#serving-name"), /No one is waiting/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("AC-05.3 a called token leaves the waiting list", async () => {
  const { ctx, open } = await setup();
  const tok = await open("patient.html");
  await issue(tok, "gen", "Priya Sharma");
  await issue(tok, "gen", "Ravi Kumar");
  const staff = await open("staff.html");
  await staff.click("#call-next");
  await staff.waitForFunction(() =>
    document.getElementById("serving-number").textContent === "G001" &&
    Array.from(document.querySelectorAll("#waiting-rows .token")).map((e) => e.textContent).join(",") === "G002"
  );
  const waiting = await staff.$$eval("#waiting-rows .token", (els) => els.map((e) => e.textContent));
  assert.deepEqual(waiting, ["G002"]);
  assert.equal(await staff.textContent("#serving-number"), "G001");
  await ctx.close();
});

test("AC-06.2 / AC-06.3 / AC-06.4 display shows the next 5 in order, no names, number at least 120px", async () => {
  const { ctx, open } = await setup({ width: 1920, height: 1080 });
  const tok = await open("patient.html");
  const names = ["Priya Sharma", "Ravi Kumar", "Anita Das", "Mohan Iyer", "Lakshmi Rao", "Arjun Nair", "Kavya Reddy"];
  for (const n of names) await issue(tok, "gen", n);
  const staff = await open("staff.html");
  await staff.click("#call-next");
  const disp = await open("display.html");
  await disp.waitForFunction(() => document.querySelector(".panel-number")?.textContent === "G001");
  const next = await disp.$$eval(".next-number", (els) => els.map((e) => e.textContent));
  assert.deepEqual(next, ["G002", "G003", "G004", "G005", "G006"]);
  const html = await disp.content();
  for (const n of names) assert.ok(!html.includes(n.split(" ")[0]), "name on display: " + n);
  assert.ok(!html.includes("9876543210"));
  const px = parseFloat(await disp.$eval(".panel-number", (e) => getComputedStyle(e).fontSize));
  assert.ok(px >= 120, "number is " + px + "px");
  await ctx.close();
});

test("AC-07.1 / AC-07.2 skip moves a token to Missed and recall serves it again", async () => {
  const { ctx, errors, open } = await setup();
  const tok = await open("patient.html");
  await issue(tok, "gen", "Priya Sharma");
  await issue(tok, "gen", "Ravi Kumar");
  const staff = await open("staff.html");
  const disp = await open("display.html");
  await staff.click("#call-next");
  await staff.waitForFunction(() => document.getElementById("serving-number").textContent === "G001");
  await staff.click("#skip");
  await staff.waitForFunction(() => document.getElementById("missed-card").hidden === false);
  assert.equal(await staff.isVisible("#missed-card"), true);
  assert.equal(await staff.textContent("#missed-rows .token"), "G001");
  await staff.click("#call-next");
  await staff.waitForFunction(() => document.getElementById("serving-number").textContent === "G002");
  await staff.click("#recall-G001");
  await staff.waitForFunction(() => document.getElementById("serving-number").textContent === "G001");
  assert.equal(await staff.textContent("#serving-number"), "G001");
  await disp.waitForFunction(() => document.querySelector(".panel-number")?.textContent === "G001", null, { timeout: 2000 });
  assert.equal(await staff.isVisible("#missed-card"), false);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("AC-09.2 / AC-09.3 estimates show on the token, staff screen and display, and update live", async () => {
  const { ctx, open } = await setup();
  const tok = await open("patient.html");
  await issue(tok, "gen", "Priya Sharma");
  await issue(tok, "gen", "Ravi Kumar");
  await issue(tok, "gen", "Anita Das");             // the token card now shows G003
  assert.equal(await tok.textContent("#t-wait"), "About 6 min · 2 people ahead");
  const staff = await open("staff.html");
  const disp = await open("display.html");
  await staff.click("#call-next");                  // G001 serving, default AST 3 min
  await tok.waitForFunction(() => document.getElementById("t-wait").textContent.includes("1 person ahead"), null, { timeout: 2000 });
  await staff.waitForFunction(() =>
    Array.from(document.querySelectorAll("#waiting-rows tr td:last-child")).map((e) => e.textContent).join(",") === "3 min,6 min"
  );
  const est = await staff.$$eval("#waiting-rows tr td:last-child", (els) => els.map((e) => e.textContent));
  assert.deepEqual(est, ["3 min", "6 min"]);
  await disp.waitForFunction(() =>
    Array.from(document.querySelectorAll(".next-wait"))
      .map((e) => e.textContent)
      .filter((text) => text.startsWith("about "))
      .join(",") === "about 3 min,about 6 min"
  );
  const shown = await disp.$$eval(".next-wait", (els) =>
    els.map((e) => e.textContent).filter((text) => text.startsWith("about "))
  );
  assert.deepEqual(shown, ["about 3 min", "about 6 min"]);
  await staff.click("#call-next");
  await staff.waitForFunction(() => document.getElementById("serving-number").textContent === "G002");
  await staff.click("#call-next");                  // G003 is now serving
  await tok.waitForFunction(() => document.getElementById("t-wait").textContent === "It's your turn now · Counter 1", null, { timeout: 2000 });
  await ctx.close();
});

test("the queue survives a reload (persistence)", async () => {
  const { ctx, open } = await setup();
  const tok = await open("patient.html");
  await issue(tok, "gen", "Priya Sharma");
  const staff = await open("staff.html");
  await staff.click("#call-next");
  await staff.waitForFunction(() => document.getElementById("serving-number").textContent === "G001");
  await staff.reload();
  await staff.waitForFunction(() => document.getElementById("serving-number").textContent === "G001");
  assert.equal(await staff.textContent("#serving-number"), "G001");
  await ctx.close();
});

test("all three screens fit a phone without sideways scrolling", async () => {
  const { ctx, errors, open } = await setup({ width: 390, height: 844 });
  for (const f of ["patient.html", "staff.html", "display.html"]) {
    const p = await open(f);
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.equal(overflow, 0, f + " overflows by " + overflow + "px");
  }
  assert.deepEqual(errors, []);
  await ctx.close();
});

// --- auth-specific tests ---

test("AC-14.1 landing page shows patient and receptionist role cards", async () => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  const page = await open(ctx, "index.html", errors);
  assert.ok(await page.isVisible("#card-patient"),  "patient card not visible");
  assert.ok(await page.isVisible("#card-staff"),    "staff card not visible");
  assert.ok(await page.isHidden("#form-patient"),   "patient form should start hidden");
  assert.ok(await page.isHidden("#form-staff"),     "staff form should start hidden");
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("AC-14.2 patient can sign in and reaches patient.html", async () => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  const page = await open(ctx, "index.html", errors);
  await page.click("#card-patient");
  await page.fill("#p-name", "Priya Sharma");
  await page.fill("#p-phone", "9876543210");
  await page.click('#patient-form button[type="submit"]');
  await page.waitForURL(/patient\.html/, { timeout: 3000 });
  assert.ok(page.url().includes("patient.html"), "expected patient.html, got " + page.url());
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("AC-14.3 receptionist can sign in with PIN 1234 and reaches staff.html", async () => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  const page = await open(ctx, "index.html", errors);
  await page.click("#card-staff");
  await page.fill("#s-name", "Reception Desk 1");
  await page.fill("#s-pin", "1234");
  await page.click('#staff-form button[type="submit"]');
  await page.waitForURL(/staff\.html/, { timeout: 3000 });
  assert.ok(page.url().includes("staff.html"), "expected staff.html, got " + page.url());
  await page.waitForTimeout(1500);                 // the staff pass is accepted: the console stays open
  assert.ok(page.url().includes("staff.html"), "the server refused the staff pass");
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("AC-14.3 wrong PIN shows an error and does not navigate", async () => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  const page = await open(ctx, "index.html", errors);
  await page.click("#card-staff");
  await page.fill("#s-name", "Reception");
  await page.fill("#s-pin", "9999");
  await page.click('#staff-form button[type="submit"]');
  // The server checks the PIN (QA fix 3); its 401 answer is logged by the browser and is expected here.
  await page.waitForFunction(() => /incorrect/i.test(document.getElementById("s-pin-err").textContent));
  assert.ok(page.url().includes("index.html"), "should stay on index.html");
  assert.equal(await page.evaluate(() => localStorage.getItem("carequeue-session")), null);
  assert.deepEqual(errors.filter((e) => !/status of 401/.test(e)), []);
  await ctx.close();
});

test("AC-14.4 patient.html without a session redirects to index.html", async () => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(APP + "patient.html");
  await page.waitForURL(/index\.html/, { timeout: 3000 });
  assert.ok(page.url().includes("index.html"), "expected redirect to index.html");
  await ctx.close();
});

test("AC-14.4 staff.html without a session redirects to index.html", async () => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(APP + "staff.html");
  await page.waitForURL(/index\.html/, { timeout: 3000 });
  assert.ok(page.url().includes("index.html"), "expected redirect to index.html");
  await ctx.close();
});

test("AC-14.2 patient session pre-fills name in the token form", async () => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const session = JSON.stringify({ role: "patient", name: "Priya Sharma", phone: "9876543210", timestamp: Date.now() });
  await ctx.addInitScript(`localStorage.setItem("carequeue-session", '${session}');`);
  const errors = [];
  const page = await open(ctx, "patient.html", errors);
  const nameVal = await page.inputValue("#name");
  assert.equal(nameVal, "Priya Sharma");
  assert.deepEqual(errors, []);
  await ctx.close();
});

// --- US-04 Send to Billing ---

test("AC-04.1 Send to Billing completes the served token and creates a billing token", async () => {
  const { ctx, errors, open } = await setup();
  const tok = await open("patient.html");
  await issue(tok, "gen", "Priya Sharma");
  const staff = await open("staff.html");
  await staff.click("#call-next");
  await staff.waitForFunction(() => document.getElementById("serving-number").textContent === "G001");
  await staff.click("#send-billing");
  await staff.waitForFunction(() => /sent to Billing/.test(document.getElementById("serving-hint").textContent));
  assert.match(await staff.textContent("#serving-hint"), /G001 sent to Billing as B001/);
  assert.equal(await staff.textContent("#serving-number"), "—");
  await staff.click('.dept-tab[data-code="B"]');
  const waiting = await staff.$$eval("#waiting-rows .token", (els) => els.map((e) => e.textContent));
  assert.deepEqual(waiting, ["B001"]);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("AC-04.2 the billing token shows the token it came from", async () => {
  const { ctx, open } = await setup();
  const tok = await open("patient.html");
  await issue(tok, "gen", "Priya Sharma");
  const staff = await open("staff.html");
  await staff.click("#call-next");
  await staff.waitForFunction(() => document.getElementById("serving-number").textContent === "G001");
  await staff.click("#send-billing");
  await staff.waitForFunction(() => /sent to Billing/.test(document.getElementById("serving-hint").textContent));
  await staff.click('.dept-tab[data-code="B"]');
  assert.match(await staff.textContent("#waiting-rows tr"), /from G001/);
  await staff.click("#call-next");
  await staff.waitForFunction(() => document.getElementById("serving-number").textContent === "B001");
  assert.match(await staff.textContent("#serving-meta"), /from G001/);
  await ctx.close();
});

test("US-04 display shows the billing queue (numbers only) and the patient's page shows the billing token", async () => {
  const { ctx, open } = await setup();
  const tok = await open("patient.html");
  await issue(tok, "gen", "Priya Sharma");
  const staff = await open("staff.html");
  const disp = await open("display.html");
  await staff.click("#call-next");
  await staff.waitForFunction(() => document.getElementById("serving-number").textContent === "G001");
  await staff.click("#send-billing");
  await disp.waitForFunction(() => [...document.querySelectorAll(".display-panel h2")].some((h) => h.textContent === "Billing"), null, { timeout: 2000 });
  const next = await disp.$$eval(".next-number", (els) => els.map((e) => e.textContent));
  assert.ok(next.includes("B001"));
  assert.ok(!(await disp.content()).includes("Priya"));
  await tok.waitForFunction(() => document.getElementById("t-wait").textContent.includes("B001"), null, { timeout: 2000 });
  await ctx.close();
});

test("US-04 Send to Billing is disabled with nobody served and hidden on the Billing queue", async () => {
  const { ctx, open } = await setup();
  const tok = await open("patient.html");
  await issue(tok, "gen", "Priya Sharma");
  const staff = await open("staff.html");
  assert.equal(await staff.isDisabled("#send-billing"), true);
  await staff.click('.dept-tab[data-code="B"]');
  assert.equal(await staff.isHidden("#send-billing"), true);
  await ctx.close();
});

test("US-04 patients can choose Billing directly; no doctor is needed", async () => {
  const { ctx, open } = await setup();
  const tok = await open("patient.html");
  await tok.selectOption("#department", "bill");
  assert.equal(await tok.isDisabled("#doctor"), true);
  assert.equal(await tok.textContent("#doctor-hint"), "No doctor needed for Billing.");
  assert.equal(await issue(tok, "bill", "Ravi Kumar"), "B001");
  await ctx.close();
});

// --- US-08 Voice announcement ---

async function soundOnDisplay(open) {
  const disp = await open("display.html");
  await disp.click("#sound-toggle");
  await disp.waitForFunction(() => document.getElementById("sound-toggle").getAttribute("aria-pressed") === "true");
  return disp;
}
const heard = (disp) => disp.evaluate(() => window.CareQueueAnnouncer.history.map((h) => h.text));

test("US-08 the display has a sound switch that starts off", async () => {
  const { ctx, errors, open } = await setup();
  const disp = await open("display.html");
  assert.equal(await disp.getAttribute("#sound-toggle", "aria-pressed"), "false");
  assert.match(await disp.textContent("#sound-toggle"), /Turn on sound/);
  await disp.click("#sound-toggle");
  assert.equal(await disp.getAttribute("#sound-toggle", "aria-pressed"), "true");
  assert.match(await disp.textContent("#sound-toggle"), /Sound on/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("AC-08.1 with sound on, a called token is announced with a chime", async () => {
  const { ctx, open } = await setup();
  const tok = await open("patient.html");
  await issue(tok, "gen", "Priya Sharma");
  const disp = await soundOnDisplay(open);
  const staff = await open("staff.html");
  await staff.click("#call-next");
  await disp.waitForFunction(() => window.CareQueueAnnouncer.history.length > 0, null, { timeout: 3000 });
  const h = await disp.evaluate(() => window.CareQueueAnnouncer.history[0]);
  assert.equal(h.text, "Token G 0 0 1, please come to General Medicine, counter 1.");
  assert.equal(h.chime, true);
  assert.ok(!JSON.stringify(await heard(disp)).includes("Priya"));
  await ctx.close();
});

test("AC-08.2 a recalled token is announced again", async () => {
  const { ctx, open } = await setup();
  const tok = await open("patient.html");
  await issue(tok, "gen", "Priya Sharma");
  await issue(tok, "gen", "Ravi Kumar");
  const disp = await soundOnDisplay(open);
  const staff = await open("staff.html");
  await staff.click("#call-next");
  await disp.waitForFunction(() => window.CareQueueAnnouncer.history.length === 1, null, { timeout: 3000 });
  await staff.click("#skip");
  await staff.waitForFunction(() => !document.getElementById("missed-card").hidden);
  await staff.click("#recall-G001");
  await disp.waitForFunction(() => window.CareQueueAnnouncer.history.length === 2, null, { timeout: 3000 });
  assert.deepEqual(await heard(disp), ["Token G 0 0 1, please come to General Medicine, counter 1.", "Token G 0 0 1, please come to General Medicine, counter 1."]);
  await ctx.close();
});

test("US-08 nothing is announced while sound is off, or for tokens already serving when the display opens", async () => {
  const { ctx, open } = await setup();
  const tok = await open("patient.html");
  await issue(tok, "gen", "Priya Sharma");
  await issue(tok, "gen", "Ravi Kumar");
  const staff = await open("staff.html");
  await staff.click("#call-next");
  await staff.waitForFunction(() => document.getElementById("serving-number").textContent === "G001");
  const disp = await soundOnDisplay(open);                 // G001 already serving: not announced
  const quiet = await open("display.html");                // sound stays off on this one
  await disp.waitForTimeout(1500);
  assert.deepEqual(await heard(disp), []);
  await staff.click("#call-next");                         // G002
  await disp.waitForFunction(() => window.CareQueueAnnouncer.history.length === 1, null, { timeout: 3000 });
  await quiet.waitForFunction(() => document.querySelector(".panel-number")?.textContent === "G002", null, { timeout: 3000 });
  assert.deepEqual(await heard(quiet), []);
  await ctx.close();
});

// --- Privacy: only the staff console may load patient details ---

test("patient page loads only the public queue, never other patients' details", async () => {
  const { ctx, open } = await setup();
  const other = await open("patient.html");
  await issue(other, "gen", "Ravi Kumar");                 // another patient's token
  const tok = await ctx.newPage();
  const urls = [];
  const bodies = [];
  tok.on("request", (r) => { if (r.url().includes("/api/queue/")) urls.push(new URL(r.url()).pathname); });
  tok.on("response", async (r) => { if (r.url().includes("/api/queue/")) bodies.push(await r.text().catch(() => "")); });
  await tok.goto(APP + "patient.html");
  await tok.waitForLoadState("load");
  assert.equal(await issue(tok, "gen", "Priya Sharma"), "G002");
  await tok.waitForFunction(() => /1 person ahead/.test(document.getElementById("t-wait").textContent), null, { timeout: 3000 });
  await tok.waitForTimeout(1200);                          // at least one periodic refresh
  assert.ok(urls.length > 0, "the patient page should refresh the queue");
  assert.deepEqual([...new Set(urls)], ["/api/queue/public-state"]);
  assert.ok(!bodies.join("").includes("Ravi"), "another patient's name reached the patient page");
  await ctx.close();
});

test("staff console still loads full queue details", async () => {
  const { ctx, open } = await setup();
  const tok = await open("patient.html");
  await issue(tok, "gen", "Ravi Kumar");
  const staff = await open("staff.html");
  await staff.waitForFunction(() => /Ravi Kumar/.test(document.getElementById("waiting-rows").textContent), null, { timeout: 3000 });
  await ctx.close();
});

// --- US-13 Track my token on my phone ---

// A phone with no CareQueue sign-in, as when a patient scans the QR code.
async function phone(url, errors) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push("track: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("track: " + m.text()); });
  await page.goto(url);
  return { ctx, page };
}

test("US-13 an issued token shows a QR code that links to its tracking page", async () => {
  const { ctx, errors, open } = await setup();
  const tok = await open("patient.html");
  assert.equal(await tok.isVisible("#t-qr"), false, "no QR code before a token exists");
  await issue(tok, "gen", "Priya Sharma");
  assert.equal(await tok.isVisible("#t-qr"), true);
  const url = await tok.getAttribute("#t-qr-code", "data-url");
  assert.match(url, /^http:\/\/127\.0\.0\.1:8765\/track\.html\?t=G001&d=\d{4}-\d{2}-\d{2}$/);
  assert.equal(await tok.getAttribute("#t-track-link", "href"), url);
  const dark = await tok.$eval("#t-qr-code", (c) => {
    const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] < 100) n++;
    return n;
  });
  assert.ok(dark > 1000, "the QR code is drawn (" + dark + " dark pixels)");
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("AC-13.1 the tracking page shows my token, now serving, people ahead and wait, with no login", async () => {
  const { ctx, errors, open } = await setup();
  const tok = await open("patient.html");
  for (const n of ["Priya Sharma", "Ravi Kumar", "Anita Das", "Mohan Iyer"]) await issue(tok, "gen", n);
  const staff = await open("staff.html");
  await staff.click("#call-next");
  await staff.waitForFunction(() => document.getElementById("serving-number").textContent === "G001");
  const url = await tok.getAttribute("#t-qr-code", "data-url");    // G004
  const { ctx: pctx, page } = await phone(url, errors);
  await page.waitForFunction(() => document.getElementById("track-ahead").textContent === "2");
  assert.equal(page.url(), url, "no redirect to sign-in");
  assert.equal(await page.textContent("#track-number"), "G004");
  assert.equal(await page.textContent("#track-dept"), "General Medicine");
  assert.equal(await page.textContent("#track-serving"), "G001");
  assert.match(await page.textContent("#track-wait"), /^About \d+ min$/);
  const html = await page.content();
  assert.ok(!html.includes("Mohan") && !html.includes("9876543210"), "no patient details on the phone page");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  assert.equal(overflow, false);
  assert.deepEqual(errors, []);
  await pctx.close();
  await ctx.close();
});

test("AC-13.2 / AC-13.3 the tracking page updates without refresh and warns when 2 or fewer are ahead", async () => {
  const { ctx, errors, open } = await setup();
  const tok = await open("patient.html");
  for (const n of ["Priya Sharma", "Ravi Kumar", "Anita Das", "Mohan Iyer", "Lakshmi Rao"]) await issue(tok, "gen", n);
  const url = await tok.getAttribute("#t-qr-code", "data-url");    // G005, 4 ahead
  const { ctx: pctx, page } = await phone(url, errors);
  await page.waitForFunction(() => document.getElementById("track-ahead").textContent === "4");
  assert.equal(await page.isVisible("#track-alert"), false);
  const staff = await open("staff.html");
  await staff.click("#call-next");                                 // G001 serving, 3 ahead
  await page.waitForFunction(() => document.getElementById("track-serving").textContent === "G001", null, { timeout: 2000 });
  assert.equal(await page.isVisible("#track-alert"), false);
  await staff.click("#call-next");                                 // G002 serving, 2 ahead
  await page.waitForFunction(() => document.getElementById("track-ahead").textContent === "2", null, { timeout: 2000 });
  assert.equal(await page.isVisible("#track-alert"), true);
  assert.match(await page.textContent("#track-alert"), /Almost your turn/);
  for (let i = 0; i < 3; i++) {
    await staff.click("#call-next");
    await staff.waitForFunction((n) => document.getElementById("serving-number").textContent === n, "G00" + (i + 3));
  }
  await page.waitForFunction(() => document.getElementById("track-card").dataset.state === "serving", null, { timeout: 2000 });
  assert.match(await page.textContent("#track-alert"), /your turn now/);
  assert.deepEqual(errors, []);
  await pctx.close();
  await ctx.close();
});

test("US-13 tracking page explains a missing, unknown or old token", async () => {
  await setup();
  const errors = [];
  const { ctx, page } = await phone(APP + "track.html", errors);
  await page.waitForFunction(() => document.getElementById("track-card").dataset.state === "invalid");
  await page.goto(APP + "track.html?t=G999");
  await page.waitForFunction(() => document.getElementById("track-card").dataset.state === "notfound");
  await page.goto(APP + "track.html?t=G001&d=2020-01-01");
  await page.waitForFunction(() => document.getElementById("track-card").dataset.state === "stale");
  assert.match(await page.textContent("#track-dept"), /2020-01-01/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

// --- E6 Queue reports (US-15, US-16) ---

// G: 3 tokens, G001 served, G002 missed, G003 waiting. C: 1 token waiting.
async function reportDay(open) {
  const tok = await open("patient.html");
  for (const n of ["Priya Sharma", "Ravi Kumar", "Anita Das"]) await issue(tok, "gen", n);
  await issue(tok, "card", "Mohan Iyer");
  const staff = await open("staff.html");
  await staff.click("#call-next");
  await staff.waitForFunction(() => document.getElementById("serving-number").textContent === "G001");
  await staff.click("#call-next");
  await staff.waitForFunction(() => document.getElementById("serving-number").textContent === "G002");
  await staff.click("#skip");
  await staff.waitForFunction(() => document.getElementById("missed-card").hidden === false);
  return { tok, staff };
}

const cells = (page, sel) => page.$$eval(sel, (els) => els.map((e) => e.textContent));

test("AC-15.1 / AC-15.2 the report shows per-department counts and averages that match the staff console", async () => {
  const { ctx, errors, open } = await setup();
  const { staff } = await reportDay(open);
  const rep = await open("reports.html");
  await rep.waitForFunction(() => document.getElementById("tile-issued").textContent === "4");
  const g = await cells(rep, '#dept-rows tr[data-code="G"] th, #dept-rows tr[data-code="G"] td');
  assert.deepEqual(g.slice(0, 7), ["General Medicine", "3", "1", "1", "0", "1", "0"]);
  assert.match(g[7], /^\d+(\.\d)? min$/, "average wait shown in minutes");
  assert.match(g[8], /^\d+(\.\d)? min$/, "average service shown in minutes");
  const c = await cells(rep, '#dept-rows tr[data-code="C"] td');
  assert.deepEqual(c.slice(0, 5), ["1", "0", "1", "0", "0"]);
  assert.equal(c[6], "–", "no average wait before anyone is called");
  assert.equal(await rep.textContent("#tile-served"), await staff.textContent("#stat-served"));
  const total = await cells(rep, "#dept-total td");
  assert.deepEqual(total.slice(0, 5), ["4", "1", "2", "0", "1"]);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("AC-15.3 the report updates within 2 seconds without refresh", async () => {
  const { ctx, errors, open } = await setup();
  const tok = await open("patient.html");
  await issue(tok, "gen", "Priya Sharma");
  const rep = await open("reports.html");
  await rep.waitForFunction(() => document.getElementById("tile-issued").textContent === "1");
  await issue(tok, "gen", "Ravi Kumar");
  await rep.waitForFunction(() => document.getElementById("tile-issued").textContent === "2", null, { timeout: 2000 });
  const staff = await open("staff.html");
  await staff.click("#call-next");
  await rep.waitForFunction(() => document.getElementById("tile-waiting").textContent === "1", null, { timeout: 2000 });
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("AC-15.4 the report is closed to anyone not signed in as staff", async () => {
  // No session: back to the landing page. A patient: the landing page sends them on to their own token page.
  for (const [role, landing] of [["none", /index\.html$/], ["patient", /patient\.html$/]]) {
    const { ctx } = await setup(undefined, role);
    const page = await ctx.newPage();
    await page.goto(APP + "reports.html");
    await page.waitForURL(landing, { timeout: 3000 });
    await ctx.close();
  }
});

test("US-15 the report loads only the public queue: no patient names reach the page", async () => {
  const { ctx, open } = await setup();
  await reportDay(open);
  const rep = await ctx.newPage();
  const urls = [];
  const bodies = [];
  rep.on("request", (r) => { if (r.url().includes("/api/queue/")) urls.push(new URL(r.url()).pathname); });
  rep.on("response", async (r) => { if (r.url().includes("/api/queue/")) bodies.push(await r.text().catch(() => "")); });
  await rep.goto(APP + "reports.html");
  await rep.waitForFunction(() => document.getElementById("tile-issued").textContent === "4");
  await rep.waitForTimeout(1200);
  assert.deepEqual([...new Set(urls)], ["/api/queue/public-state"]);
  const seen = bodies.join("") + (await rep.content());
  for (const n of ["Priya", "Ravi", "Anita", "Mohan", "9876543210"]) assert.ok(!seen.includes(n), n + " reached the report");
  await ctx.close();
});

test("AC-16.1 a chart shows tokens per hour and names the busiest hour", async () => {
  const { ctx, errors, open } = await setup();
  await reportDay(open);
  const rep = await open("reports.html");
  await rep.waitForFunction(() => document.querySelectorAll("#hour-chart .hour").length > 0);
  const busiest = await rep.$$eval("#hour-chart .hour.busiest", (els) => els.map((e) => e.getAttribute("aria-label")));
  assert.equal(busiest.length, 1);
  assert.match(busiest[0], /: 4 tokens$/);
  assert.match(await rep.textContent("#busiest"), /^Busiest hour: .+, 4 tokens\.$/);
  assert.equal(await rep.textContent("#hour-chart .hour.busiest .hour-value"), "4");
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("AC-16.2 Download CSV saves one row per department and a total, with no patient details", async () => {
  const { ctx, errors, open } = await setup();
  await reportDay(open);
  const rep = await open("reports.html");
  await rep.waitForFunction(() => document.getElementById("tile-issued").textContent === "4");
  const [download] = await Promise.all([rep.waitForEvent("download"), rep.click("#download-csv")]);
  assert.match(download.suggestedFilename(), /^CareQueue-report-\d{4}-\d{2}-\d{2}\.csv$/);
  const csv = fs.readFileSync(await download.path(), "utf8");
  const lines = csv.trim().split("\n");
  assert.equal(lines[0], "Department,Code,Issued,Served,Waiting,Serving,Missed,Sent to Billing,Average wait (min),Average service (min)");
  assert.match(lines.find((l) => l.startsWith("General Medicine,")), /^General Medicine,G,3,1,1,0,1,0,/);
  assert.match(lines[lines.length - 1], /^Total,,4,1,2,0,1,0,/);
  for (const n of ["Priya", "Ravi", "Anita", "Mohan", "9876543210"]) assert.ok(!csv.includes(n));
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("US-15 the report fits a phone without sideways scrolling", async () => {
  const { ctx, open } = await setup({ width: 390, height: 844 });
  await reportDay(open);
  const rep = await open("reports.html");
  await rep.waitForFunction(() => document.getElementById("tile-issued").textContent === "4");
  const overflow = await rep.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  assert.equal(overflow, false);
  await ctx.close();
});

// --- US-11 Multiple counters ---

// A second receptionist in their own browser, working at the given counter of General Medicine.
async function receptionistAt(counter, errors) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const seed = await ctx.newPage();
  await seed.goto(APP + "index.html");
  const token = await staffPass();
  await seed.evaluate(([c, token]) => {
    localStorage.setItem("carequeue-session", JSON.stringify({ role: "receptionist", name: "Desk " + c, timestamp: Date.now(), token }));
    localStorage.setItem("carequeue-staff-dept-counter-G", String(c));
  }, [counter, token]);
  await seed.close();
  const page = await open(ctx, "staff.html", errors);
  await page.waitForFunction((c) => document.getElementById("serving-counter").textContent === "Counter " + c, counter);
  return { ctx, page };
}

async function openCounter(staff, counter) {
  await staff.click("#counter-" + counter);
  await staff.waitForFunction((c) => document.getElementById("counter-toggle").textContent === "Open Counter " + c, counter);
  await staff.click("#counter-toggle");
  await staff.waitForFunction((c) => document.querySelector("#counter-" + c + " .counter-status").textContent !== "Paused", counter);
}

test("US-11 the staff console starts with Counter 1 open and Counters 2-3 paused", async () => {
  const { ctx, errors, open } = await setup();
  const staff = await open("staff.html");
  const chips = await cells(staff, "#counter-chips .counter-chip");
  assert.deepEqual(chips, ["Counter 1Free", "Counter 2Paused", "Counter 3Paused"]);
  assert.equal(await staff.getAttribute("#counter-1", "aria-pressed"), "true");
  assert.equal(await staff.textContent("#counter-toggle"), "Pause Counter 1");
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("AC-11.3 two receptionists call their own patients at Counters 1 and 2", async () => {
  const { ctx, errors, open } = await setup();
  const tok = await open("patient.html");
  for (const n of ["Priya Sharma", "Ravi Kumar", "Anita Das"]) await issue(tok, "gen", n);
  const desk1 = await open("staff.html");
  await openCounter(desk1, 2);
  await desk1.click("#counter-1");
  const { ctx: ctx2, page: desk2 } = await receptionistAt(2, errors);
  await desk1.click("#call-next");
  await desk1.waitForFunction(() => document.getElementById("serving-number").textContent === "G001");
  await desk2.click("#call-next");
  await desk2.waitForFunction(() => document.getElementById("serving-number").textContent === "G002");
  assert.equal(await desk2.textContent("#serving-hint"), "Called G002 to Counter 2. It is now on the display.");
  await desk1.waitForFunction(() => document.querySelector("#counter-2 .counter-status").textContent === "G002");
  assert.equal(await desk1.textContent("#serving-number"), "G001", "Counter 1 keeps its patient");
  const disp = await open("display.html");
  await disp.waitForFunction(() => document.querySelectorAll(".serving-slot").length === 2);
  const slots = await cells(disp, ".serving-slot");
  assert.deepEqual(slots, ["G001Counter 1", "G002Counter 2"]);
  await desk1.click("#call-next");                                // finishes G001 only
  await desk1.waitForFunction(() => document.getElementById("serving-number").textContent === "G003");
  await disp.waitForFunction(() => document.querySelector(".serving-slot").textContent === "G003Counter 1");
  assert.equal(await desk2.textContent("#serving-number"), "G002");
  assert.deepEqual(errors, []);
  await ctx2.close();
  await ctx.close();
});

test("AC-11.2 a paused counter cannot call, and a counter with a patient cannot be paused", async () => {
  const { ctx, errors, open } = await setup();
  const tok = await open("patient.html");
  await issue(tok, "gen", "Priya Sharma");
  const staff = await open("staff.html");
  await staff.click("#counter-2");
  await staff.waitForFunction(() => document.getElementById("serving-counter").textContent === "Counter 2");
  assert.equal(await staff.isDisabled("#call-next"), true);
  assert.equal(await staff.textContent("#serving-name"), "Counter 2 is paused");
  await staff.click("#counter-1");
  await staff.waitForFunction(() => document.getElementById("counter-toggle").textContent === "Pause Counter 1");
  await staff.click("#counter-toggle");
  await staff.waitForFunction(() => /at least one counter/i.test(document.getElementById("serving-hint").textContent));
  await staff.click("#call-next");
  await staff.waitForFunction(() => document.getElementById("serving-number").textContent === "G001");
  await openCounter(staff, 2);
  await staff.click("#counter-1");
  await staff.waitForFunction(() => document.getElementById("counter-toggle").textContent === "Pause Counter 1");
  await staff.click("#counter-toggle");
  await staff.waitForFunction(() => /G001 is at Counter 1/.test(document.getElementById("serving-hint").textContent));
  // The two refused pauses are 400 answers from the server, which the browser logs; nothing else may fail.
  assert.equal(errors.filter((e) => /status of 400/.test(e)).length, 2);
  assert.deepEqual(errors.filter((e) => !/status of 400/.test(e)), []);
  await ctx.close();
});

test("AC-11.1 opening a second counter halves the queue part of the estimate", async () => {
  const { ctx, errors, open } = await setup();
  const tok = await open("patient.html");
  for (const n of ["Priya Sharma", "Ravi Kumar", "Anita Das", "Mohan Iyer", "Lakshmi Rao"]) await issue(tok, "gen", n);
  // G005: 4 ahead, nobody serving. One counter: 4 x 3 = 12 min. Two counters: 4 / 2 x 3 = 6 min.
  await tok.waitForFunction(() => /^About 12 min/.test(document.getElementById("t-wait").textContent));
  const staff = await open("staff.html");
  await openCounter(staff, 2);
  await tok.waitForFunction(() => /^About 6 min/.test(document.getElementById("t-wait").textContent), null, { timeout: 2000 });
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("AC-11.4 the voice and the patient's phone name the counter", async () => {
  const { ctx, errors, open } = await setup();
  const tok = await open("patient.html");
  await issue(tok, "gen", "Priya Sharma");
  await issue(tok, "gen", "Ravi Kumar");
  const url = await tok.getAttribute("#t-qr-code", "data-url");      // G002
  const disp = await soundOnDisplay(open);
  const staff = await open("staff.html");
  await openCounter(staff, 2);
  await staff.click("#call-next");                                   // G001 to Counter 2 (the selected counter)
  await staff.waitForFunction(() => document.getElementById("serving-number").textContent === "G001");
  await disp.waitForFunction(() => window.CareQueueAnnouncer.history.length === 1, null, { timeout: 3000 });
  assert.deepEqual(await heard(disp), ["Token G 0 0 1, please come to General Medicine, counter 2."]);
  await staff.click("#counter-1");
  await staff.waitForFunction(() => document.getElementById("serving-counter").textContent === "Counter 1");
  await staff.click("#call-next");                                   // G002 to Counter 1
  const { ctx: pctx, page } = await phone(url, errors);
  await page.waitForFunction(() => document.getElementById("track-card").dataset.state === "serving");
  assert.match(await page.textContent("#track-alert"), /General Medicine, Counter 1\./);
  assert.equal(await page.textContent("#track-serving"), "G002, G001");
  assert.deepEqual(errors, []);
  await pctx.close();
  await ctx.close();
});

// --- QA fix 3: the server checks the staff PIN ---

test("fix 3 a staff console with an old session and no staff pass is sent back to sign in", async () => {
  const { ctx } = await setup(undefined, "patient");
  const page = await ctx.newPage();
  await page.goto(APP + "index.html");
  await page.evaluate(() => localStorage.setItem("carequeue-session",
    JSON.stringify({ role: "receptionist", name: "Old session", timestamp: Date.now() })));
  await page.goto(APP + "staff.html");
  await page.waitForURL(/index\.html$/, { timeout: 3000 });
  assert.equal(await page.evaluate(() => localStorage.getItem("carequeue-session")), null);
  await ctx.close();
});

test("fix 3 queue actions sent without a staff pass are refused by the server", async () => {
  await setup();
  await fetch(APP + "api/tokens", { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: "G", patient: { name: "Priya Sharma", age: "40", gender: "Female", phone: "9876543210" } }) });
  assert.equal((await fetch(APP + "api/queue/G/call-next", { method: "POST" })).status, 401);
  assert.equal((await fetch(APP + "api/queue/state")).status, 401);
  const pub = await (await fetch(APP + "api/queue/public-state")).json();
  assert.equal(pub.tokens[0].status, "waiting");
});
