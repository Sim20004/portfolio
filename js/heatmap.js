(function () {
  "use strict";

  var USERNAME = "Sim20004";
  var DAY_MS = 24 * 60 * 60 * 1000;
  var MONTH_LABELS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];

  var root = document.getElementById("commit-heatmap");
  if (!root) return;

  var els = {
    liveBadge: document.getElementById("heatmap-live-badge"),
    profileLink: document.getElementById("heatmap-profile-link"),
    total: document.getElementById("heatmap-total"),
    months: document.getElementById("heatmap-months"),
    weeks: document.getElementById("heatmap-weeks"),
    tooltip: document.getElementById("heatmap-tooltip"),
  };

  els.profileLink.href = "https://github.com/" + USERNAME;
  els.profileLink.textContent = "github.com/" + USERNAME;

  function toISODate(d) {
    return d.toISOString().slice(0, 10);
  }

  // Deterministic pseudo-random generator seeded by a string, so the
  // fallback view looks the same on every reload instead of flickering.
  function seededRandom(seed) {
    var h = 0;
    for (var i = 0; i < seed.length; i++) {
      h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
    }
    return function () {
      h = (Math.imul(h, 48271) + 1) % 2147483647;
      return (h & 0x7fffffff) / 2147483647;
    };
  }

  function buildFallbackData(username) {
    var rand = seededRandom(username || "guest");
    var today = new Date();
    var start = new Date(today);
    start.setDate(start.getDate() - 371); // ~53 weeks back, GitHub-aligned
    var days = [];
    for (var t = start.getTime(); t <= today.getTime(); t += DAY_MS) {
      var d = new Date(t);
      var dow = d.getDay();
      var weekendDamp = dow === 0 || dow === 6 ? 0.4 : 1;
      var streaky = Math.sin(t / (DAY_MS * 9)) * 0.5 + 0.5;
      var r = rand();
      var count = 0;
      if (r < 0.28 * weekendDamp) {
        count = 0;
      } else {
        count = Math.round(streaky * r * 11 * weekendDamp);
      }
      days.push({ date: toISODate(d), count: count });
    }
    return days;
  }

  // Groups a flat array of {date,count} into GitHub-style weeks (7-day columns, Sun-Sat)
  function groupIntoWeeks(days) {
    if (!days.length) return [];
    var weeks = [];
    var currentWeek = new Array(7).fill(null);

    var firstDow = new Date(days[0].date + "T00:00:00").getDay();
    for (var i = 0; i < firstDow; i++) currentWeek[i] = null;

    days.forEach(function (day) {
      var dow = new Date(day.date + "T00:00:00").getDay();
      currentWeek[dow] = day;
      if (dow === 6) {
        weeks.push(currentWeek);
        currentWeek = new Array(7).fill(null);
      }
    });
    if (currentWeek.some(function (d) { return d !== null; })) {
      weeks.push(currentWeek);
    }
    return weeks;
  }

  function levelFor(count, max) {
    if (!count) return 0;
    if (max <= 0) return 1;
    var ratio = count / max;
    if (ratio > 0.75) return 4;
    if (ratio > 0.5) return 3;
    if (ratio > 0.25) return 2;
    return 1;
  }

  function formatDate(iso) {
    var d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  var cell = 11;
  var gap = 3;

  function showTooltip(target, day) {
    var rect = target.getBoundingClientRect();
    var tip = els.tooltip;
    tip.hidden = false;
    tip.innerHTML =
      "<strong>" + day.count + "</strong> " +
      (day.count === 1 ? "commit" : "commits") + " on " + formatDate(day.date);
    var tipRect = tip.getBoundingClientRect();
    tip.style.left = (rect.left + rect.width / 2) + "px";
    tip.style.top = (rect.top - tipRect.height - 8) + "px";
  }

  function hideTooltip() {
    els.tooltip.hidden = true;
  }

  function render(days, isLive) {
    var weeks = groupIntoWeeks(days);
    var maxCount = days.reduce(function (m, d) { return Math.max(m, d.count); }, 0);
    var total = days.reduce(function (s, d) { return s + d.count; }, 0);

    // Total line
    els.total.innerHTML =
      "<strong>" + total.toLocaleString() + "</strong> contributions in the last year" +
      (isLive
        ? ""
        : ' <span class="heatmap-fallback-note">(showing sample data -- live fetch failed or user has no public history)</span>');

    els.liveBadge.hidden = !isLive;

    // Month labels: find which week-column each month first appears in
    els.months.innerHTML = "";
    var lastMonth = null;
    weeks.forEach(function (week, wi) {
      var firstReal = week.find(function (d) { return d !== null; });
      if (!firstReal) return;
      var m = new Date(firstReal.date + "T00:00:00").getMonth();
      if (m !== lastMonth) {
        var span = document.createElement("span");
        span.textContent = MONTH_LABELS[m];
        span.style.left = (wi * (cell + gap)) + "px";
        els.months.appendChild(span);
        lastMonth = m;
      }
    });

    // Weeks grid
    els.weeks.innerHTML = "";
    weeks.forEach(function (week) {
      var weekEl = document.createElement("div");
      weekEl.className = "heatmap-week";
      week.forEach(function (day) {
        var dayEl = document.createElement("div");
        dayEl.className = "heatmap-day";
        if (day) {
          var level = levelFor(day.count, maxCount);
          dayEl.classList.add("has-data");
          dayEl.setAttribute("data-level", String(level));
          dayEl.addEventListener("mouseenter", function () {
            dayEl.classList.add("is-active");
            showTooltip(dayEl, day);
          });
          dayEl.addEventListener("mouseleave", function () {
            dayEl.classList.remove("is-active");
            hideTooltip();
          });
        }
        weekEl.appendChild(dayEl);
      });
      els.weeks.appendChild(weekEl);
    });
  }

  function load(username) {
    els.total.textContent = "Loading contribution history…";
    els.liveBadge.hidden = true;

    fetch(
      "https://github-contributions-api.jogruber.de/v4/" +
        encodeURIComponent(username) + "?y=last"
    )
      .then(function (res) {
        if (!res.ok) throw new Error("bad response");
        return res.json();
      })
      .then(function (json) {
        var contributions = json && json.contributions;
        if (!Array.isArray(contributions) || contributions.length === 0) {
          throw new Error("empty");
        }
        var normalized = contributions.map(function (c) {
          return { date: c.date, count: c.count };
        });
        render(normalized, true);
      })
      .catch(function () {
        render(buildFallbackData(username), false);
      });
  }

  load(USERNAME);
})();
