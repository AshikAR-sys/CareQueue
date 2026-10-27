// Queue reports (US-15, US-16): today's figures per department, tokens per hour and a CSV download.
// Staff only. Reads the public queue state, so no patient names or phone numbers reach this page.
(function () {
  "use strict";

  if (window.CareAuth && !window.CareAuth.guard("receptionist")) return;

  const { DATA, startClock, deptByCode, el } = window.Screens;
  const Core = window.QueueCore;
  const Q = window.TokenQueue;
  const $ = (id) => document.getElementById(id);
  const CODES = DATA.departments.map((d) => d.code);
  let lastSignature = "";

  const nameOf = (code) => (deptByCode(code) || { name: code }).name;
  const mins = (v) => (v == null ? "–" : v + " min");
  // US-20: "4.5 / 5 (2)" = average stars and how many patients rated.
  const stars = (r) => (r.avgRating == null ? "–" : r.avgRating + " / 5 (" + r.ratingCount + ")");
  const hourLabel = (h) => (h % 12 || 12) + (h < 12 ? " AM" : " PM");

  function current() { return Core.report(Q.day(), CODES); }

  function row(cells, tag = "td") {
    const tr = el("tr");
    cells.forEach((c, i) => {
      const cell = el(i === 0 ? "th" : tag, i === 0 ? null : "num", c);
      if (i === 0) cell.scope = "row";
      tr.append(cell);
    });
    return tr;
  }

  function figures(r) {
    return [r.issued, r.served, r.waiting, r.serving, r.missed, r.sentToBilling, mins(r.avgWaitMin), mins(r.avgServiceMin), stars(r)].map(String);
  }

  function render() {
    const rep = current();
    const signature = JSON.stringify(rep);
    if (signature === lastSignature) return;
    lastSignature = signature;

    const t = rep.total;
    $("tile-issued").textContent = t.issued;
    $("tile-served").textContent = t.served;
    $("tile-waiting").textContent = t.waiting;
    $("tile-missed").textContent = t.missed;
    $("tile-wait").textContent = mins(t.avgWaitMin);
    $("tile-service").textContent = mins(t.avgServiceMin);
    $("tile-rating").textContent = stars(t);

    // Departments with no tokens today are left out of the table; the total covers everything.
    const rows = $("dept-rows");
    rows.textContent = "";
    const used = rep.departments.filter((d) => d.issued > 0);
    for (const d of used) {
      const tr = row([nameOf(d.code)].concat(figures(d)));
      tr.dataset.code = d.code;
      rows.append(tr);
    }
    if (!used.length) {
      const tr = el("tr", "empty-row");
      const td = el("td", null, "No tokens issued yet today.");
      td.colSpan = 10;
      tr.append(td);
      rows.append(tr);
    }
    const foot = $("dept-total");
    foot.textContent = "";
    foot.append(row(["Total"].concat(figures(t))));

    renderChart(rep);
  }

  // One series, so no legend: bars in one hue, the busiest hour in the deeper step of the same hue and named
  // in text above the chart. Each bar carries its count as a hover title and an accessible label.
  function renderChart(rep) {
    const chart = $("hour-chart");
    chart.textContent = "";
    if (!rep.busiest) {
      $("busiest").textContent = "No tokens issued yet today.";
      return;
    }
    const b = rep.busiest;
    $("busiest").textContent = "Busiest hour: " + hourLabel(b.hour) + " – " + hourLabel((b.hour + 1) % 24) +
      ", " + b.count + (b.count === 1 ? " token" : " tokens") + ".";
    const max = b.count;
    for (const h of rep.hours) {
      const item = el("div", "hour" + (h.hour === b.hour ? " busiest" : ""));
      item.setAttribute("role", "listitem");
      const label = hourLabel(h.hour) + ": " + h.count + (h.count === 1 ? " token" : " tokens");
      item.setAttribute("aria-label", label);
      item.title = label;
      item.dataset.hour = String(h.hour);
      const track = el("div", "hour-track");
      const bar = el("div", "hour-bar");
      bar.style.height = (h.count / max * 100) + "%";
      if (h.hour === b.hour) bar.append(el("span", "hour-value", String(h.count)));
      track.append(bar);
      item.append(track, el("span", "hour-label", hourLabel(h.hour)));
      chart.append(item);
    }
  }

  $("download-csv").addEventListener("click", () => {
    const csv = Core.reportCsv(current(), nameOf);
    const link = document.createElement("a");
    link.download = "CareQueue-report-" + Q.day().date + ".csv";
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  });

  const session = window.CareAuth ? window.CareAuth.get() : null;
  const chip = $("session-chip"), soBtn = $("signout-btn");
  if (session && chip) { chip.textContent = session.name || ""; chip.style.display = ""; }
  if (soBtn) {
    soBtn.style.display = "";
    soBtn.addEventListener("click", () => { if (window.CareAuth) window.CareAuth.clear(); window.location.replace("index.html"); });
  }

  startClock();
  Q.subscribe(render);
})();
