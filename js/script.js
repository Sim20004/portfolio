const hamburger = document.querySelector(".hamburger")
const links = document.querySelector(".nav-links")

hamburger.addEventListener("click", () => {
    links.classList.toggle("active")
})

links.addEventListener("click", () => {
    links.classList.toggle("active")
})

const GITHUB_USERNAME = "Sim20004";

async function loadGitHubStats() {
    const stats = {
        repos: document.getElementById("github-repos"),
        stars: document.getElementById("github-stars"),
        forks: document.getElementById("github-forks"),
        commits: document.getElementById("github-commits"),
        activity: document.getElementById("github-activity-list")
    };

    try {
        /*
         * Fetch public repositories.
         *
         * Sorting by "pushed" means the most recently active
         * repositories come first.
         */
        const reposResponse = await fetch(
            `https://api.github.com/users/${GITHUB_USERNAME}/repos?sort=pushed&per_page=100`
        );

        if (!reposResponse.ok) {
            throw new Error("Failed to fetch repositories");
        }

        const repos = await reposResponse.json();

        /*
         * Calculate useful repository statistics.
         */
        const totalStars = repos.reduce(
            (total, repo) => total + repo.stargazers_count,
            0
        );

        const totalForks = repos.reduce(
            (total, repo) => total + repo.forks_count,
            0
        );

        stats.repos.textContent = repos.length;
        stats.stars.textContent = totalStars;
        stats.forks.textContent = totalForks;

        /*
         * Fetch recent public GitHub events.
         *
         * PushEvent tells us that commits were pushed to a
         * repository. GitHub only exposes a limited recent
         * event history through this public endpoint.
         */
        const eventsResponse = await fetch(
            `https://api.github.com/users/${GITHUB_USERNAME}/events/public?per_page=100`
        );

        if (!eventsResponse.ok) {
            throw new Error("Failed to fetch GitHub activity");
        }

        const events = await eventsResponse.json();

        const pushEvents = events.filter(
            event => event.type === "PushEvent"
        );

        const recentCommitCount = pushEvents.reduce(
            (total, event) => {
                return total + (event.payload.commits?.length || 0);
            },
            0
        );

        stats.commits.textContent = recentCommitCount;

        /*
         * Display the latest activity.
         */
        const activity = events
            .filter(event =>
                event.type === "PushEvent" ||
                event.type === "PullRequestEvent" ||
                event.type === "IssuesEvent" ||
                event.type === "CreateEvent"
            )
            .slice(0, 6);

        if (activity.length === 0) {
            stats.activity.innerHTML =
                "<p>No recent public activity found.</p>";
            return;
        }

        stats.activity.innerHTML = activity.map(event => {

            const repoName = event.repo?.name || "GitHub repository";
            const repoUrl = `https://github.com/${repoName}`;

            let description = "Activity";

            switch (event.type) {
                case "PushEvent":
                    description =
                        `Pushed ${event.payload.commits?.length || 0} commit${
                            event.payload.commits?.length === 1 ? "" : "s"
                        }`;
                    break;

                case "PullRequestEvent":
                    description =
                        `${event.payload.action} a pull request`;
                    break;

                case "IssuesEvent":
                    description =
                        `${event.payload.action} an issue`;
                    break;

                case "CreateEvent":
                    description =
                        `Created ${event.payload.ref_type || "repository content"}`;
                    break;
            }

            const date = new Date(event.created_at);

            return `
                <article class="github-activity-item">

                    <div>
                        <strong>${description}</strong>

                        <a
                            href="${repoUrl}"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            ${repoName}
                        </a>
                    </div>

                    <time datetime="${event.created_at}">
                        ${date.toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric"
                        })}
                    </time>

                </article>
            `;

        }).join("");

    } catch (error) {

        console.error("GitHub API error:", error);

        stats.activity.innerHTML =
            "<p>GitHub activity is temporarily unavailable.</p>";

    }
}

loadGitHubStats();