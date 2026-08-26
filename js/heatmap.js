(function () {
  "use strict";

  var USERNAME = "Sim20004";
  var DAY_MS = 24 * 60 * 60 * 1000;
  var root = document.getElementById("commit-heatmap");
  if (!root) return;

  var els = {
    liveBadge: document.getElementById("heatmap-live-badge"),
    profileLink: document.getElementById("heatmap-profile-link"),
    total: document.getElementById("heatmap-total"),
    fallback: document.getElementById("heatmap-fallback"),
    weeks: document.getElementById("heatmap-weeks"),
    tooltip: document.getElementById("heatmap-tooltip"),
  };

  els.profileLink.href = "https://github.com/" + USERNAME;
  els.profileLink.textContent = "github.com/" + USERNAME;

  function toISODate(d) {
    return d.toISOString().slice(0, 10);
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

  function render(days) {
    var weeks = groupIntoWeeks(days);
    var maxCount = days.reduce(function (m, d) { return Math.max(m, d.count); }, 0);
    var total = days.reduce(function (s, d) { return s + d.count; }, 0);

    // Total line
    els.total.innerHTML = "<strong>" + total.toLocaleString() + "</strong> contributions in the last year";
    els.liveBadge.hidden = false;
    if (els.fallback) els.fallback.hidden = true;

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
        render(normalized);
      })
      .catch(function () {
        els.total.textContent = "Contribution history is unavailable right now.";
        if (els.fallback) els.fallback.hidden = false;
        els.weeks.innerHTML = "";
      });
  }

  load(USERNAME);

  var githubApi = "https://api.github.com";
  var apiHeaders = { Accept: "application/vnd.github+json" };
  var stats = {
    repos: document.getElementById("github-repos"),
    rustRepos: document.getElementById("github-rust-repos"),
    pythonRepos: document.getElementById("github-python-repos"),
    prs: document.getElementById("github-prs"),
    languageTotal: document.getElementById("github-language-total"),
    languageBars: document.getElementById("github-language-bars"),
    prTitle: document.getElementById("github-pr-title"),
    prMeta: document.getElementById("github-pr-meta"),
    commitTitle: document.getElementById("github-commit-title"),
    commitMeta: document.getElementById("github-commit-meta"),
  };

  function formatRelativeDate(date) {
    var days = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / DAY_MS));
    if (days === 0) return "today";
    if (days === 1) return "yesterday";
    if (days < 30) return days + " days ago";
    return new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }

  function fetchGitHub(path) {
    return fetch(githubApi + path, { headers: apiHeaders }).then(function (res) {
      if (!res.ok) throw new Error("GitHub request failed");
      return res.json();
    });
  }

  function setText(element, value) {
    if (element) element.textContent = value;
  }

  function loadGitHubStats() {
    Promise.all([
      fetchGitHub("/users/" + USERNAME + "/repos?per_page=100&sort=updated"),
      fetchGitHub("/search/issues?q=author:" + USERNAME + "+type:pr&sort=updated&order=desc&per_page=1"),
      fetchGitHub("/search/commits?q=author:" + USERNAME + "&sort=committer-date&order=desc&per_page=1"),
    ]).then(function (results) {
      var repos = results[0];
      var prs = results[1];
      var commits = results[2];
      var languageCounts = {};
      repos.forEach(function (repo) {
        if (repo.language) languageCounts[repo.language] = (languageCounts[repo.language] || 0) + 1;
      });
      var languages = Object.keys(languageCounts).sort(function (a, b) {
        return languageCounts[b] - languageCounts[a];
      });
      var languageTotal = languages.reduce(function (total, language) { return total + languageCounts[language]; }, 0);
      setText(stats.repos, repos.length);
      setText(stats.rustRepos, languageCounts.Rust || 0);
      setText(stats.pythonRepos, languageCounts.Python || 0);
      setText(stats.prs, prs.total_count || 0);
      setText(stats.languageTotal, languageTotal + " repos classified");
      if (stats.languageBars) {
        stats.languageBars.innerHTML = "";
        languages.slice(0, 5).forEach(function (language) {
          var row = document.createElement("div");
          row.className = "language-row";
          row.innerHTML = "<span>" + language + "</span><div class=\"language-track\"><i style=\"width: " + Math.round(languageCounts[language] / languageTotal * 100) + "%\"></i></div><strong>" + languageCounts[language] + "</strong>";
          stats.languageBars.appendChild(row);
        });
      }

      if (prs.items && prs.items.length) {
        var pr = prs.items[0];
        stats.prTitle.href = pr.html_url;
        setText(stats.prTitle, pr.title);
        setText(stats.prMeta, "" + (pr.repository_url.split("/").pop()) + " · " + formatRelativeDate(pr.updated_at));
      } else {
        setText(stats.prTitle, "No public pull requests yet");
        setText(stats.prMeta, "Open source work in progress");
      }

      if (commits.items && commits.items.length) {
        var commit = commits.items[0];
        stats.commitTitle.href = commit.html_url;
        setText(stats.commitTitle, commit.commit.message.split("\n")[0]);
        setText(stats.commitMeta, commit.repository.full_name + " · " + formatRelativeDate(commit.commit.committer.date));
      } else {
        setText(stats.commitTitle, "No recent public commits");
        setText(stats.commitMeta, "Visit GitHub for the full archive");
      }
    }).catch(function () {
      setText(stats.repos, "--");
      setText(stats.rustRepos, "--");
      setText(stats.pythonRepos, "--");
      setText(stats.prs, "--");
      setText(stats.languageTotal, "Unavailable");
      if (stats.languageBars) stats.languageBars.innerHTML = "<span class=\"language-empty\">Language data is unavailable right now.</span>";
      setText(stats.prTitle, "GitHub activity unavailable");
      setText(stats.prMeta, "Try again later");
      setText(stats.commitTitle, "GitHub activity unavailable");
      setText(stats.commitMeta, "Try again later");
    });
  }

  loadGitHubStats();
})();
