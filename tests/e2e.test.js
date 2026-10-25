// End-to-end browser tests: token page, staff console and display working together.
// Run: npm run test:e2e   (needs Playwright: npm install && npx playwright install chromium)
// Each test gets a fresh browser context, so localStorage (the queue) starts empty.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { chromium } = require("playwright");

const APP = "file://" + path.resolve(__dirname, "../app") + "/";
let browser;

// Uses installed Google Chrome by default. Set PW_CHANNEL=chromium to use Playwright's own Chromium instead
// (for example on machines or CI without Chrome).
const CHANNEL = process.env.PW_CHANNEL === "chromium" ? undefined : (process.env.PW_CHANNEL || "chrome");
test.before(async () => { browser = await chromium.launch(CHANNEL ? { channel: CHANNEL } : {}); });
test.after(async () => { await browser.close(); });

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

// Default role is "admin" — bypasses all auth guards so queue tests work unchanged.
// Opens a throwaway page to set localStorage reliably before any guarded page loads.
async function setup(viewport = { width: 1440, height: 900 }, role = "admin") {
  const ctx = await browser.newContext({ viewport });
  const seed = await ctx.newPage();
  await seed.goto(APP + "index.html");
  await seed.waitForLoadState("load");
  await seed.evaluate((session) => {
    localStorage.setItem("carequeue-session", JSON.stringify(session));
  }, { role, timestamp: Date.now() });
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
  await staff.click("#skip");
  assert.equal(await staff.isVisible("#missed-card"), true);
  assert.equal(await staff.textContent("#missed-rows .token"), "G001");
  await staff.click("#call-next");
  await staff.click("#recall-G001");
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
  const est = await staff.$$eval("#waiting-rows tr td:last-child", (els) => els.map((e) => e.textContent));
  assert.deepEqual(est, ["3 min", "6 min"]);
  const shown = await disp.$$eval(".next-wait", (els) => els.map((e) => e.textContent));
  assert.deepEqual(shown, ["about 3 min", "about 6 min"]);
  await staff.click("#call-next");
  await staff.click("#call-next");                  // G003 is now serving
  await tok.waitForFunction(() => document.getElementById("t-wait").textContent === "It's your turn now", null, { timeout: 2000 });
  await ctx.close();
});

test("the queue survives a reload (persistence)", async () => {
  const { ctx, open } = await setup();
  const tok = await open("patient.html");
  await issue(tok, "gen", "Priya Sharma");
  const staff = await open("staff.html");
  await staff.click("#call-next");
  await staff.reload();
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
  const errText = await page.textContent("#s-pin-err");
  assert.match(errText, /incorrect/i);
  assert.ok(page.url().includes("index.html"), "should stay on index.html");
  assert.deepEqual(errors, []);
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
  await staff.click("#send-billing");
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
  await staff.click("#send-billing");
  await staff.click('.dept-tab[data-code="B"]');
  assert.match(await staff.textContent("#waiting-rows tr"), /from G001/);
  await staff.click("#call-next");
  assert.equal(await staff.textContent("#serving-number"), "B001");
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
