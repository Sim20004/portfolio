const backLink = document.querySelector(".back-link")
const origin = new URLSearchParams(window.location.search).get("from")

if (backLink && origin === "about") {
    backLink.href = "../../index.html#about"
    backLink.textContent = "← Back to about"
} else if (backLink && origin === "projects") {
    backLink.href = "../../index.html#projects"
    backLink.textContent = "← Back to projects"
}
