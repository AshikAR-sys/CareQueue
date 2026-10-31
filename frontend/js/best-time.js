// Best time to visit (US-25): usual tokens per hour in each department, from earlier days. Public, no sign-in.
// Reads /api/history/hourly (department codes and times only) and works out the advice with QueueCore.bestTimes.
(function () {
  "use strict";
  const { DATA, el } = window.Screens;
  const I = window.CareQueueI18n;
  const $ = (id) => document.getElementById(id);
  let lang = I.load();
  let rows = null;
  const tr = (key, vars) => I.t(lang, key, vars);

  function hourLabel(h) {
    const d = new Date(2026, 0, 1, h);
    return new Intl.DateTimeFormat(lang === "ta" ? "ta-IN" : "en-IN", { hour: "numeric", hour12: true }).format(d).toUpperCase();
  }

  function render() {
    document.documentElement.lang = lang;
    $("best-title").textContent = tr("best.title");
    document.querySelectorAll(".lang-switch button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lang === lang)));
    const list = $("best-list");
    list.textContent = "";
    if (!rows) return;
    const r = window.QueueCore.bestTimes(rows);
    if (!r.enough) {
      $("best-sub").textContent = "";
      list.append(el("p", "glass best-empty", tr("best.notenough", { n: 3 })));
      return;
    }
    $("best-sub").textContent = tr("best.sub", { n: r.days });
    for (const d of DATA.departments) {
      const info = r.departments[d.code];
      if (!info) continue;
      const card = el("section", "glass list-card best-card");
      card.dataset.code = d.code;
      card.append(el("h2", "card-title", I.deptName(lang, d.code, d.name)));
      const quiet = el("p", "best-quiet", tr("best.quiet", { hours: info.quietest.map(hourLabel).join(", ") }));
      card.append(quiet, el("p", "best-busy", tr("best.busy", { hour: hourLabel(info.busiest) })));
      // One series, so no legend: the quiet hours are the teal bars and are named in the line above.
      const chart = el("div", "hour-chart best-chart");
      chart.setAttribute("role", "list");
      const max = Math.max(...info.hours.map((h) => h.avg)) || 1;
      for (const h of info.hours) {
        const item = el("div", "hour" + (info.quietest.includes(h.hour) ? " quiet" : ""));
        item.setAttribute("role", "listitem");
        const label = tr("best.tokens", { hour: hourLabel(h.hour), n: h.avg });
        item.setAttribute("aria-label", label);
        item.title = label;
        const track = el("div", "hour-track");
        const bar = el("div", "hour-bar");
        bar.style.height = (h.avg / max * 100) + "%";
        track.append(bar);
        item.append(track, el("span", "hour-label", hourLabel(h.hour)));
        chart.append(item);
      }
      card.append(chart);
      list.append(card);
    }
  }

  document.querySelectorAll(".lang-switch button").forEach((b) => b.addEventListener("click", () => {
    lang = b.dataset.lang;
    I.save(lang);
    render();
  }));

  render();
  fetch("/api/history/hourly", { cache: "no-store" })
    .then((response) => response.json())
    .then((payload) => { rows = payload.tokens || []; render(); })
    .catch(() => { rows = []; render(); });
})();
