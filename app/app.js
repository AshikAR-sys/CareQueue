(function () {
  "use strict";

  // Auth guard: redirect to login if no patient session.
  if (window.CareAuth && !window.CareAuth.guard("patient")) return;

  const DATA = window.CAREQUEUE_DATA;
  const $ = (id) => document.getElementById(id);

  const form = $("token-form");
  const fields = {
    department: $("department"),
    doctor: $("doctor"),
    name: $("name"),
    age: $("age"),
    phone: $("phone")
  };
  const card = $("token-card");
  const submitBtn = $("submit-btn");
  const printBtn = $("print-btn");
  const downloadBtn = $("download-btn");

  const MIN_LOADING_MS = 500; // keeps the loading state perceptible; the demo queue answers instantly

  let issued = null;     // the last token actually generated, used by print and download
  let submitted = false; // validate as the visitor types only after a first submit

  /* ---------- helpers ---------- */
  const dateFmt = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  const timeFmt = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
  const issuedFmtRaw = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true });

  const issuedFmt = { format: (d) => issuedFmtRaw.format(d).replace(/\b(am|pm)\b/, (m) => m.toUpperCase()) };

  function deptById(id) { return DATA.departments.find((d) => d.id === id) || null; }
  function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
  function setText(id, text) { $(id).textContent = text; }

  /* ---------- top bar ---------- */
  function tick() {
    const now = new Date();
    setText("clock-date", dateFmt.format(now));
    setText("clock-time", timeFmt.format(now).toUpperCase());
  }
  tick();
  setInterval(tick, 15000);

  function togglePopover(btn, panel, open) {
    const next = open ?? btn.getAttribute("aria-expanded") !== "true";
    btn.setAttribute("aria-expanded", String(next));
    if (panel.tagName === "NAV") panel.classList.toggle("open", next);
    else panel.hidden = !next;
  }
  const notifyBtn = $("notify-btn"), notifyPanel = $("notify-panel");
  const menuBtn = $("menu-btn"), nav = $("site-nav");
  if (notifyBtn) notifyBtn.addEventListener("click", (e) => { e.stopPropagation(); togglePopover(notifyBtn, notifyPanel); togglePopover(menuBtn, nav, false); });
  menuBtn.addEventListener("click", (e) => { e.stopPropagation(); togglePopover(menuBtn, nav); if (notifyBtn) togglePopover(notifyBtn, notifyPanel, false); });
  document.addEventListener("click", (e) => {
    if (notifyPanel && !notifyPanel.contains(e.target)) togglePopover(notifyBtn, notifyPanel, false);
    if (!nav.contains(e.target)) togglePopover(menuBtn, nav, false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { if (notifyBtn) togglePopover(notifyBtn, notifyPanel, false); togglePopover(menuBtn, nav, false); }
  });

  /* ---------- form options ---------- */
  for (const d of DATA.departments) {
    const o = document.createElement("option");
    o.value = d.id;
    o.textContent = d.name + " (" + d.code + ")";
    fields.department.append(o);
  }

  function fillDoctors(dept) {
    fields.doctor.length = 1; // keep "Any available doctor"
    if (!dept) {
      fields.doctor.disabled = true;
      setText("doctor-hint", "Choose a department first.");
      return;
    }
    for (const name of dept.doctors) {
      const o = document.createElement("option");
      o.value = name; o.textContent = name;
      fields.doctor.append(o);
    }
    fields.doctor.disabled = false;
    setText("doctor-hint", dept.doctors.length + (dept.doctors.length === 1 ? " doctor" : " doctors") + " in " + dept.name + " today.");
  }

  /* ---------- validation ---------- */
  function readForm() {
    const gender = form.querySelector('input[name="gender"]:checked');
    return {
      department: deptById(fields.department.value),
      doctor: fields.doctor.value,
      name: fields.name.value.trim().replace(/\s+/g, " "),
      age: fields.age.value.trim(),
      gender: gender ? gender.value : "",
      phone: fields.phone.value.replace(/\D/g, "")
    };
  }

  function validate(v) {
    const errors = {};
    if (!v.department) errors.department = "Select a department.";
    if (!v.name) errors.name = "Enter the patient's name.";
    else if (v.name.length < 2) errors.name = "Name must be at least 2 letters.";
    else if (!/^[\p{L} .'-]+$/u.test(v.name)) errors.name = "Use letters, spaces, dots, apostrophes or hyphens only.";
    if (v.age === "") errors.age = "Enter the age.";
    else if (!/^\d{1,3}$/.test(v.age) || +v.age > 120) errors.age = "Enter an age from 0 to 120.";
    if (!v.gender) errors.gender = "Select a gender.";
    if (!v.phone) errors.phone = "Enter a mobile number.";
    else if (!/^[6-9]\d{9}$/.test(v.phone)) errors.phone = "Enter a 10-digit mobile number starting with 6, 7, 8 or 9.";
    return errors;
  }

  function showErrors(errors) {
    for (const key of ["department", "name", "age", "gender", "phone"]) {
      const err = $(key + "-err");
      const field = err.closest(".field");
      err.textContent = errors[key] || "";
      field.classList.toggle("invalid", Boolean(errors[key]));
      const input = key === "gender" ? null : fields[key];
      if (input) input.setAttribute("aria-invalid", errors[key] ? "true" : "false");
    }
    const count = Object.keys(errors).length;
    const box = $("form-error");
    if (count) {
      box.innerHTML = '<svg class="ic"><use href="#i-alert"/></svg><span></span>';
      box.lastChild.textContent = count === 1 ? "Please fix 1 field below." : "Please fix " + count + " fields below.";
      box.hidden = false;
    } else {
      box.hidden = true;
    }
  }

  /* ---------- token card ---------- */
  function setActionsEnabled(on) {
    printBtn.disabled = !on;
    downloadBtn.disabled = !on;
    $("actions-note").hidden = on;
  }

  function setInstructions(dept, number) {
    const where = dept ? "Go to " + dept.name + ", " + dept.location + "." : "Go to the department shown above.";
    const watch = number ? "Watch the display there for " + number + " and keep this token with you."
                         : "Watch the display there and keep this token with you.";
    const items = $("t-instructions").querySelectorAll("li span");
    items[0].textContent = where;
    items[1].textContent = watch;
    items[2].textContent = "If you miss your turn, tell the reception desk.";
  }

  // Words for an estimate from the queue: { status, ahead, minutes } (see queue-core.js).
  function waitText(estimate) {
    if (!estimate) return null;
    if (estimate.status === "serving") return "It's your turn now";
    if (estimate.status === "missed") return "Missed. Please tell the reception desk";
    if (estimate.status === "done") return "Visit completed";
    if (estimate.minutes === 0) return "You're next";
    const ahead = estimate.ahead === 1 ? "1 person ahead" : estimate.ahead + " people ahead";
    return "About " + estimate.minutes + " min · " + ahead;
  }

  function setWait(estimate, fallback) {
    const el = $("t-wait");
    const text = waitText(estimate);
    if (text) {
      el.textContent = text;
      el.classList.remove("unavailable");
    } else {
      el.textContent = fallback;
      el.classList.add("unavailable");
    }
  }

  function renderSample() {
    const s = DATA.sampleToken;
    const dept = deptById(s.departmentId);
    card.dataset.state = "sample";
    setText("status-pill", "Sample preview");
    setText("status-text", "This is how your token will look");
    setText("t-number", s.number);
    setText("t-dept", dept.name);
    setText("t-doctor", s.doctor);
    setText("t-patient", s.patient);
    setText("t-issued", s.issued);
    $("t-wait").textContent = s.wait;
    $("t-wait").classList.remove("unavailable");
    setInstructions(dept, null);
    setActionsEnabled(false);
  }

  // Before a token exists, the card follows the visitor's selections without inventing a number.
  function renderDraft() {
    const v = readForm();
    if (!v.department && !v.name) { renderSample(); return; }
    card.dataset.state = "draft";
    setText("status-pill", "Preview");
    setText("status-text", "Your token number appears after you submit");
    setText("t-number", v.department ? v.department.code + "···" : "···");
    setText("t-dept", v.department ? v.department.name : "Not selected");
    setText("t-doctor", v.doctor || "Any available doctor");
    setText("t-patient", v.name ? v.name + patientSuffix(v) : "Not entered");
    setText("t-issued", "When you submit");
    setWait(null, "Shown after your token is issued");
    setInstructions(v.department, null);
    setActionsEnabled(false);
  }

  function patientSuffix(v) {
    const bits = [];
    if (v.age !== "" && /^\d{1,3}$/.test(v.age)) bits.push(v.age + " y");
    if (v.gender) bits.push(v.gender);
    return bits.length ? ", " + bits.join(", ") : "";
  }

  function renderIssued(t) {
    card.dataset.state = "issued";
    setText("status-pill", "Issued");
    setText("status-text", "Your Token is Generated!");
    setText("t-number", t.number);
    setText("t-dept", t.department.name);
    setText("t-doctor", t.doctor || "Any available doctor");
    setText("t-patient", t.name + patientSuffix(t));
    setText("t-issued", issuedFmt.format(t.issuedAt));
    setWait(t.estimate, "Not available yet. Check the display near the department.");
    setInstructions(t.department, t.number);
    $("token-error").hidden = true;
    setActionsEnabled(true);
  }

  function renderError(message) {
    card.dataset.state = "error";
    setText("status-pill", "Not generated");
    setText("status-text", "Something went wrong");
    setText("token-error-text", message + " Your details are still in the form.");
    $("retry-btn").hidden = false;
    $("token-error").hidden = false;
    setActionsEnabled(false);
  }

  /* ---------- events ---------- */
  fields.department.addEventListener("change", () => {
    fillDoctors(deptById(fields.department.value));
    onEdit();
  });
  fields.phone.addEventListener("input", () => {
    const digits = fields.phone.value.replace(/\D/g, "").slice(0, 10);
    if (digits !== fields.phone.value) fields.phone.value = digits;
  });
  form.addEventListener("input", onEdit);
  form.addEventListener("change", onEdit);

  function onEdit() {
    // Editing after a token was issued starts a new draft; the issued token is kept for print/download
    // only while it is on screen.
    if (card.dataset.state === "issued" || card.dataset.state === "error") {
      issued = null;
      $("token-error").hidden = true;
    }
    if (card.dataset.state !== "loading") renderDraft();
    if (submitted) showErrors(validate(readForm()));
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (submitBtn.getAttribute("aria-busy") === "true") return;
    submitted = true;
    const v = readForm();
    const errors = validate(v);
    showErrors(errors);
    if (Object.keys(errors).length) {
      const first = ["department", "name", "age", "gender", "phone"].find((k) => errors[k]);
      (first === "gender" ? form.querySelector('input[name="gender"]') : fields[first]).focus();
      return;
    }
    await generate(v);
  });

  async function generate(v) {
    submitBtn.setAttribute("aria-busy", "true");
    submitBtn.querySelector(".btn-label").textContent = "Generating…";
    card.dataset.state = "loading";
    setText("status-pill", "Generating");
    setText("status-text", "Generating your token…");
    setActionsEnabled(false);
    try {
      const [result] = await Promise.all([window.TokenQueue.issue(v), sleep(MIN_LOADING_MS)]);
      issued = Object.assign({}, v, result);
      renderIssued(issued);
      if (window.matchMedia("(max-width: 1180px)").matches) {
        card.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    } catch (err) {
      issued = null;
      renderError(err && err.message ? err.message : "We couldn't generate your token.");
    } finally {
      submitBtn.removeAttribute("aria-busy");
      submitBtn.querySelector(".btn-label").textContent = "Generate Token";
    }
  }

  $("retry-btn").addEventListener("click", () => form.requestSubmit());

  /* ---------- print ---------- */
  printBtn.addEventListener("click", () => { if (issued) window.print(); });

  /* ---------- download: draws the slip to a PNG ---------- */
  downloadBtn.addEventListener("click", async () => {
    if (!issued) return;
    try {
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
      const canvas = drawSlip(issued);
      const link = document.createElement("a");
      link.download = "CareQueue-token-" + issued.number + ".png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (err) {
      // Keep the issued token on screen; only report that the file could not be made.
      setText("token-error-text", "The download didn't work in this browser. Use Print Token instead.");
      $("retry-btn").hidden = true;
      $("token-error").hidden = false;
    }
  });

  function drawSlip(t) {
    const W = 720, H = 1000, s = 2;
    const c = document.createElement("canvas");
    c.width = W * s; c.height = H * s;
    const g = c.getContext("2d");
    g.scale(s, s);
    const font = getComputedStyle(document.body).fontFamily;
    const F = (w, px) => w + " " + px + "px " + font;

    const round = (x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };
    g.fillStyle = "#e6f0f7"; g.fillRect(0, 0, W, H);
    round(32, 32, W - 64, H - 64, 28); g.fillStyle = "#ffffff"; g.fill();

    // header
    round(72, 72, 52, 52, 14); g.fillStyle = "#1559e8"; g.fill();
    g.fillStyle = "#fff"; g.fillRect(92, 82, 12, 32); g.fillRect(82, 92, 32, 12);
    g.fillStyle = "#0b1b33"; g.font = F(800, 26); g.fillText("CareQueue", 142, 96);
    g.fillStyle = "#56657b"; g.font = F(500, 18); g.fillText("Outpatient token", 142, 122);

    // number
    round(72, 160, W - 144, 210, 22); g.fillStyle = "#e3edff"; g.fill();
    g.textAlign = "center";
    g.fillStyle = "#56657b"; g.font = F(600, 18); g.fillText("Token number", W / 2, 205);
    g.fillStyle = "#1559e8"; g.font = F(800, 110); g.fillText(t.number, W / 2, 330);
    g.textAlign = "left";

    // details
    const rows = [
      ["Department", t.department.name],
      ["Doctor", t.doctor || "Any available doctor"],
      ["Patient", t.name + patientSuffix(t)],
      ["Phone", "+91 " + t.phone.slice(0, 5) + " " + t.phone.slice(5)],
      ["Issued", issuedFmt.format(t.issuedAt)],
      ["Estimated wait", waitText(t.estimate) || "Not available"],
      ["Where to go", t.department.location]
    ];
    let y = 430;
    for (const [k, val] of rows) {
      g.fillStyle = "#56657b"; g.font = F(600, 17); g.fillText(k, 72, y);
      g.fillStyle = "#0b1b33"; g.font = F(700, 22); g.fillText(fit(g, val, W - 144), 72, y + 30);
      y += 72;
    }

    // footer
    g.fillStyle = "#56657b"; g.font = F(500, 16);
    const note = t.mode === "local" ? "Issued from this computer's queue. Watch the display for your number."
                                   : "Please keep this token until your visit is complete.";
    g.fillText(fit(g, note, W - 144), 72, H - 72);
    return c;
  }

  function fit(g, text, max) {
    if (g.measureText(text).width <= max) return text;
    let t = text;
    while (t.length > 1 && g.measureText(t + "…").width > max) t = t.slice(0, -1);
    return t + "…";
  }

  /* ---------- live estimate on an issued token ---------- */
  window.TokenQueue.subscribe(() => {
    if (!issued || card.dataset.state !== "issued") return;
    issued.estimate = window.TokenQueue.estimate(issued.number);
    setWait(issued.estimate, "Not available.");
  });

  /* ---------- session ---------- */
  const session = window.CareAuth ? window.CareAuth.get() : null;
  if (session) {
    const nameEl = $("session-name"), soBtn = $("signout-btn");
    if (nameEl) { nameEl.textContent = session.name || ""; nameEl.style.display = ""; }
    if (soBtn) soBtn.style.display = "";
    if (session.name && !fields.name.value) { fields.name.value = session.name; onEdit(); }
    if (session.phone) {
      const d = String(session.phone).replace(/\D/g, "").slice(0, 10);
      if (d && !fields.phone.value) fields.phone.value = d;
    }
  }
  const signoutBtn = $("signout-btn");
  if (signoutBtn) {
    signoutBtn.addEventListener("click", () => {
      if (window.CareAuth) window.CareAuth.clear();
      window.location.replace("index.html");
    });
  }

  /* ---------- start ---------- */
  renderSample();
})();
