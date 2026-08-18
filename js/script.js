const hamburger = document.querySelector(".hamburger")
const links = document.querySelector(".nav-links")

hamburger.addEventListener("click", () => {
    links.classList.toggle("active")
})

links.addEventListener("click", () => {
    links.classList.toggle("active")
})

const GITHUB_USERNAME = "Sim20004";

const githubElements = {
    repos: document.getElementById("github-repos"),
    stars: document.getElementById("github-stars"),
    forks: document.getElementById("github-forks"),
    commits: document.getElementById("github-commits"),
    activity: document.getElementById("github-activity-list")
};

function setText(element, value) {
    if (element) {
        element.textContent = String(value);
    }
}

function formatDate(value) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "Unknown date";
    }

    return date.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric"
    });
}

function safeNumber(value) {
    return Number.isFinite(value) && value >= 0 ? value : 0;
}

function createActivityItem(description, repoName, repoUrl, date) {
    const article = document.createElement("article");
    article.className = "github-activity-item";

    const content = document.createElement("div");

    const strong = document.createElement("strong");
    strong.textContent = description;

    const link = document.createElement("a");
    link.href = repoUrl;
    link.textContent = repoName;
    link.target = "_blank";
    link.rel = "noopener noreferrer";

    const time = document.createElement("time");
    time.textContent = formatDate(date);

    if (date) {
        time.dateTime = date;
    }

    content.appendChild(strong);
    content.appendChild(link);

    article.appendChild(content);
    article.appendChild(time);

    return article;
}

function describeEvent(event) {
    if (!event || typeof event !== "object") {
        return null;
    }

    const payload =
        event.payload && typeof event.payload === "object"
            ? event.payload
            : {};

    switch (event.type) {
        case "PushEvent": {
            /*
             * GitHub may not include the commits array in the
             * public Events API response.
             *
             * `size` represents the number of commits pushed.
             */
            const count = safeNumber(payload.size);

            return {
                text: `Pushed ${count} commit${count === 1 ? "" : "s"}`,
                commitCount: count
            };
        }

        case "PullRequestEvent": {
            const action =
                typeof payload.action === "string"
                    ? payload.action
                    : "updated";

            return {
                text: `${action.charAt(0).toUpperCase()}${action.slice(1)} a pull request`,
                commitCount: 0
            };
        }

        case "IssuesEvent": {
            const action =
                typeof payload.action === "string"
                    ? payload.action
                    : "updated";

            return {
                text: `${action.charAt(0).toUpperCase()}${action.slice(1)} an issue`,
                commitCount: 0
            };
        }

        case "CreateEvent": {
            const refType =
                typeof payload.ref_type === "string"
                    ? payload.ref_type
                    : "repository content";

            return {
                text: `Created ${refType}`,
                commitCount: 0
            };
        }

        default:
            return null;
    }
}

async function fetchGitHubJson(url) {
    const response = await fetch(url, {
        headers: {
            Accept: "application/vnd.github+json"
        }
    });

    if (!response.ok) {
        throw new Error(`GitHub API returned HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
        throw new Error("Unexpected GitHub API response");
    }

    return data;
}

async function loadGitHubStats() {
    if (
        !githubElements.repos ||
        !githubElements.stars ||
        !githubElements.forks ||
        !githubElements.commits ||
        !githubElements.activity
    ) {
        console.warn("GitHub section elements are missing.");
        return;
    }

    try {
        const repos = await fetchGitHubJson(
            `https://api.github.com/users/${encodeURIComponent(
                GITHUB_USERNAME
            )}/repos?sort=pushed&per_page=100`
        );

        /*
         * Only count valid repository objects.
         */
        const validRepos = repos.filter(
            repo =>
                repo &&
                typeof repo === "object" &&
                !repo.fork
        );

        const totalStars = validRepos.reduce(
            (total, repo) =>
                total + safeNumber(repo.stargazers_count),
            0
        );

        const totalForks = validRepos.reduce(
            (total, repo) =>
                total + safeNumber(repo.forks_count),
            0
        );

        setText(githubElements.repos, validRepos.length);
        setText(githubElements.stars, totalStars);
        setText(githubElements.forks, totalForks);

        const events = await fetchGitHubJson(
            `https://api.github.com/users/${encodeURIComponent(
                GITHUB_USERNAME
            )}/events/public?per_page=100`
        );

        /*
         * Only process event types we explicitly understand.
         */
        const activityEvents = events
            .filter(event => describeEvent(event) !== null)
            .slice(0, 6);

        let recentCommitCount = 0;

        for (const event of activityEvents) {
            const description = describeEvent(event);

            if (description) {
                recentCommitCount += description.commitCount;
            }
        }

        setText(githubElements.commits, recentCommitCount);

        /*
         * Clear existing content safely.
         *
         * We deliberately do NOT use innerHTML with GitHub data.
         */
        githubElements.activity.replaceChildren();

        if (activityEvents.length === 0) {
            const message = document.createElement("p");
            message.textContent = "No recent public activity found.";
            githubElements.activity.appendChild(message);
            return;
        }

        for (const event of activityEvents) {
            const description = describeEvent(event);

            if (!description) {
                continue;
            }

            const repoName =
                event.repo &&
                typeof event.repo.name === "string"
                    ? event.repo.name
                    : "GitHub repository";

            /*
             * GitHub repository names returned by the API are
             * expected to be owner/name.
             *
             * Construct the URL ourselves rather than trusting
             * an arbitrary URL supplied by the API.
             */
            const repoUrl =
                `https://github.com/${encodeURIComponent(
                    repoName.split("/")[0] || GITHUB_USERNAME
                )}/${encodeURIComponent(
                    repoName.split("/")[1] || ""
                )}`;

            const item = createActivityItem(
                description.text,
                repoName,
                repoUrl,
                event.created_at
            );

            githubElements.activity.appendChild(item);
        }

    } catch (error) {
        console.error("GitHub API error:", error);

        setText(githubElements.repos, "--");
        setText(githubElements.stars, "--");
        setText(githubElements.forks, "--");
        setText(githubElements.commits, "--");

        githubElements.activity.replaceChildren();

        const message = document.createElement("p");
        message.textContent =
            "GitHub activity is temporarily unavailable.";

        githubElements.activity.appendChild(message);
    }
}

loadGitHubStats();