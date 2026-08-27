# Simarpreet Singh | Portfolio

Source code for my personal developer portfolio:

**[simarpreetsingh.org](https://simarpreetsingh.org)**

The portfolio is designed to be more than a collection of projects. It is itself a demonstration of how I build software, with interactive demos, live GitHub data, technical writing, project case studies, and client work.

## Features

- Interactive GitHub contribution heatmap
- Live GitHub repository and activity statistics
- Interactive TeapotOS terminal simulation
- TeapotLang compiler playground
- FOSSil Chat interactive demo
- Project case studies
- Technical writing
- Freelance/client project showcase
- Responsive design
- Accessible interactive components
- SEO metadata and JSON-LD structured data
- Open Graph and Twitter metadata
- Custom 404 page
- Sitemap and robots.txt
- Custom domain via GitHub Pages

## Tech Stack

- HTML5
- CSS3
- JavaScript
- GitHub API
- GitHub Pages
- Pyodide / WebAssembly for the TeapotLang browser playground

No frontend framework is used. The site is built with vanilla HTML, CSS and JavaScript.

## Interactive Projects

### TeapotLang

The portfolio includes an interactive TeapotLang playground.

The browser version uses **Pyodide** to run the actual Python-based TeapotLang compiler through WebAssembly rather than maintaining a separate JavaScript implementation of the compiler.

The goal is to make the project directly executable from the portfolio while keeping the compiler implementation itself in the TeapotLang repository.

### TeapotOS

The TeapotOS section includes an interactive terminal-style demonstration of the operating system.

The demo is intentionally a browser simulation rather than the actual kernel. It provides a lightweight way to demonstrate the project’s interface without requiring visitors to run an x86 virtual machine.

### FOSSil Chat

The portfolio includes an interactive demonstration of FOSSil Chat, my open-source chat application written in Rust.

## GitHub Integration

The portfolio retrieves public GitHub data to display information such as:

- Contribution history
- Repository count
- Rust repositories
- Python repositories
- Pull requests
- Recent commits
- Repository language distribution
- Daily contribution details

GitHub data is fetched client-side, with graceful fallbacks when external APIs are unavailable.

## Project Structure

```text
.
├── css/
│   ├── style.css
│   └── ...
├── js/
│   ├── script.js
│   ├── heatmap.js
│   └── writing.js
├── images/
├── fonts/
├── files/
│   └── Simarpreet_Singh_CV.pdf
├── websites/
├── index.html
├── 404.html
├── robots.txt
├── sitemap.xml
├── CNAME
└── LICENSE