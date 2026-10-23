
"use strict";

const TEAPOT_PYODIDE =
    "https://cdn.jsdelivr.net/pyodide/v0.27.7/full/";

const TEAPOT_REPOSITORY = "Sim20004/teapot-lang";
const TEAPOT_BRANCH = "main";
const TEAPOT_SOURCE_ROOT = "/teapot/src";

const log = (...args) =>
    console.info("[Portfolio Teapot]", ...args);

const logError = (...args) =>
    console.error("[Portfolio Teapot]", ...args);

const escapeHTML = (value) => {
    const element = document.createElement("span");
    element.textContent = String(value);
    return element.innerHTML;
};

const renderValue = (value) => {
    if (value === null || value === undefined) return "None";

    if (typeof value === "boolean") {
        return value ? "true" : "false";
    }

    if (typeof value === "object") {
        try {
            return JSON.stringify(value);
        } catch {
            return String(value);
        }
    }

    return String(value);
};

const describeError = (error) => {
    if (error instanceof Error) {
        return `${error.name}: ${error.message}`;
    }

    return String(error);
};

const fetchJSON = async (url) => {
    const response = await fetch(url);

    if (!response.ok) {
        const body = await response.text().catch(() => "");

        throw new Error(
            `HTTP ${response.status} fetching ${url}: ${body.slice(0, 200)}`
        );
    }

    const body = await response.text();

    try {
        return JSON.parse(body);
    } catch (error) {
        throw new Error(
            `Expected JSON from ${url}; received: ${body.slice(0, 160)}. ` +
            describeError(error)
        );
    }
};

const loadPyodideScript = async () => {
    if (typeof window.loadPyodide === "function") return;

    if (!window.teapotPyodideScriptLoading) {
        window.teapotPyodideScriptLoading = new Promise(
            (resolve, reject) => {
                const script = document.createElement("script");

                script.src = `${TEAPOT_PYODIDE}pyodide.js`;
                script.async = true;

                script.addEventListener("load", resolve, { once: true });

                script.addEventListener(
                    "error",
                    () => reject(new Error("Could not load the Pyodide script.")),
                    { once: true }
                );

                document.head.append(script);
            }
        ).catch((error) => {
            window.teapotPyodideScriptLoading = null;
            throw error;
        });
    }

    await window.teapotPyodideScriptLoading;
};

const loadTeapotCompiler = async () => {
    if (window.teapotCompiler) return window.teapotCompiler;

    if (!window.teapotCompilerLoading) {
        window.teapotCompilerLoading = (async () => {
            // Resolve main once so all modules come from the same commit.
            const reference = await fetchJSON(
                `https://api.github.com/repos/${TEAPOT_REPOSITORY}` +
                `/git/ref/heads/${TEAPOT_BRANCH}`
            );

            const commit = reference?.object?.sha;

            if (!commit) {
                throw new Error("GitHub did not return a commit SHA.");
            }

            log("Loading compiler from commit:", commit);

            // Discover all Python modules, including nested packages.
            const tree = await fetchJSON(
                `https://api.github.com/repos/${TEAPOT_REPOSITORY}` +
                `/git/trees/${commit}?recursive=1`
            );

            if (tree.truncated) {
                throw new Error(
                    "GitHub truncated the repository tree; cannot safely load the compiler."
                );
            }

            const files = tree.tree.filter(
                (entry) =>
                    entry.type === "blob" &&
                    entry.path.startsWith("src/teapot/") &&
                    entry.path.endsWith(".py")
            );

            if (!files.some((file) => file.path === "src/teapot/web.py")) {
                throw new Error(
                    "Could not find src/teapot/web.py in the repository."
                );
            }

            log("Python modules discovered:", files.length);

            await loadPyodideScript();

            const pyodide = await window.loadPyodide({
                indexURL: TEAPOT_PYODIDE,
            });

            log("Pyodide initialised:", {
                version: pyodide.version,
                pythonVersion: pyodide.runPython(
                    "import sys; sys.version"
                ),
            });

            // Create the full package directory structure first.
            pyodide.FS.mkdirTree(TEAPOT_SOURCE_ROOT);

            for (const file of files) {
                const relativePath = file.path.slice("src/".length);
                const destination =
                    `${TEAPOT_SOURCE_ROOT}/${relativePath}`;

                const directory = destination.slice(
                    0,
                    destination.lastIndexOf("/")
                );

                pyodide.FS.mkdirTree(directory);
            }

            // Download all files from the exact same commit.
            const results = await Promise.all(
                files.map(async (file) => {
                    const url =
                        `https://raw.githubusercontent.com/${TEAPOT_REPOSITORY}/` +
                        `${commit}/${file.path}`;

                    const response = await fetch(url);

                    if (!response.ok) {
                        throw new Error(
                            `HTTP ${response.status} downloading ${file.path}`
                        );
                    }

                    return {
                        repositoryPath: file.path,
                        path:
                            `${TEAPOT_SOURCE_ROOT}/` +
                            file.path.slice("src/".length),
                        content: await response.text(),
                    };
                })
            );

            // Write to /teapot/src/teapot/... so Python can import teapot.
            for (const file of results) {
                try {
                    pyodide.FS.writeFile(file.path, file.content);
                } catch (error) {
                    throw new Error(
                        `Could not write ${file.repositoryPath} to ` +
                        `${file.path}: ${describeError(error)}`
                    );
                }
            }

            const webModule =
                `${TEAPOT_SOURCE_ROOT}/teapot/web.py`;

            if (!pyodide.FS.analyzePath(webModule).exists) {
                throw new Error(
                    `Compiler entry point was not written: ${webModule}`
                );
            }

            // Verify the actual package imports before enabling compilation.
            await pyodide.runPythonAsync(`
import sys
sys.path.insert(0, ${JSON.stringify(TEAPOT_SOURCE_ROOT)})

import teapot.web
print("TeapotLang loaded from:", teapot.web.__file__)
            `);

            log("Compiler package imported successfully.");

            return pyodide;
        })();

        // Allow retrying if initialisation fails.
        window.teapotCompilerLoading.catch(() => {
            window.teapotCompilerLoading = null;
        });
    }

    window.teapotCompiler = await window.teapotCompilerLoading;
    return window.teapotCompiler;
};

const compileSource = async (pyodide, source) => {
    log("Compiling source:", {
        characters: source.length,
        preview: source.slice(0, 100),
    });

    pyodide.globals.set("teapot_source", source);

    let pythonResult;

    try {
        // Return the Python dictionary directly. Do not JSON-serialise it.
        pythonResult = await pyodide.runPythonAsync(`
from teapot.web import compile_source
compile_source(teapot_source)
        `);

        if (
            pythonResult === null ||
            typeof pythonResult?.toJs !== "function"
        ) {
            throw new Error(
                "Expected a Python dictionary proxy from the compiler, but " +
                `received ${typeof pythonResult}.`
            );
        }

        // Convert nested Python dictionaries into ordinary JS objects.
        const data = pythonResult.toJs({
            dict_converter: Object.fromEntries,
        });

        if (
            !data ||
            !Array.isArray(data.tokens) ||
            !data.ast ||
            !Array.isArray(data.symbols)
        ) {
            throw new Error(
                `Unexpected compiler result: ${renderValue(data)}`
            );
        }

        log("Compilation result:", {
            tokens: data.tokens.length,
            symbols: data.symbols.length,
            memoryMode: data.memory_mode,
        });

        return data;
    } catch (error) {
        logError("Compilation failed:", error);
        throw error;
    } finally {
        if (pythonResult && typeof pythonResult.destroy === "function") {
            pythonResult.destroy();
        }

        pyodide.globals.delete("teapot_source");
    }
};

const appendTree = (parent, value, label = null, depth = 0) => {
    const item = document.createElement("li");
    const row = document.createElement("div");

    row.className = "ast-row";

    const isObject = value !== null && typeof value === "object";

    const title = label === null
        ? (isObject ? (value.node ?? "Program") : "Value")
        : label;

    const branch = document.createElement("span");
    branch.className = "ast-branch";
    branch.textContent = depth ? "├─" : "";

    const heading = document.createElement("strong");
    heading.textContent = String(title);

    row.append(branch, heading);

    if (!isObject) {
        const content = document.createElement("span");
        content.className = "ast-value";
        content.textContent = renderValue(value);

        row.append(content);
        item.append(row);
        parent.append(item);
        return;
    }

    item.append(row);

    const children = document.createElement("ul");

    Object.entries(value).forEach(([key, child]) => {
        if (Array.isArray(child)) {
            child.forEach((entry, index) => {
                appendTree(
                    children,
                    entry,
                    `${key}[${index}]`,
                    depth + 1
                );
            });
        } else {
            appendTree(children, child, key, depth + 1);
        }
    });

    if (children.children.length) {
        item.append(children);
    }

    parent.append(item);
};

const renderTokens = (container, tokens) => {
    container.replaceChildren();

    const table = document.createElement("table");
    const head = document.createElement("thead");
    const headingRow = document.createElement("tr");

    ["#", "Type", "Value", "Position"].forEach((heading) => {
        const cell = document.createElement("th");
        cell.textContent = heading;
        headingRow.append(cell);
    });

    head.append(headingRow);
    table.append(head);

    const body = document.createElement("tbody");

    tokens.forEach((token, index) => {
        const row = document.createElement("tr");

        [
            index + 1,
            token.type,
            renderValue(token.value),
            `${token.line}:${token.col}`,
        ].forEach((value, cellIndex) => {
            const cell = document.createElement("td");

            if (cellIndex === 1) {
                const type = document.createElement("span");
                type.className = "token-type";
                type.textContent = String(value);
                cell.append(type);
            } else {
                cell.textContent = String(value);
            }

            row.append(cell);
        });

        body.append(row);
    });

    table.append(body);
    container.append(table);
};

const renderSymbols = (container, symbols) => {
    container.replaceChildren();

    const table = document.createElement("table");
    const head = document.createElement("thead");
    const headingRow = document.createElement("tr");

    ["Name", "Kind", "Type", "Scope"].forEach((heading) => {
        const cell = document.createElement("th");
        cell.textContent = heading;
        headingRow.append(cell);
    });

    head.append(headingRow);
    table.append(head);

    const body = document.createElement("tbody");

    const appendRows = (entries, parentScope = "module") => {
        entries.forEach((symbol) => {
            const row = document.createElement("tr");

            [
                symbol.name,
                symbol.kind,
                renderValue(symbol.type),
                symbol.scope ?? parentScope,
            ].forEach((value) => {
                const cell = document.createElement("td");
                cell.textContent = renderValue(value);
                row.append(cell);
            });

            body.append(row);

            if (Array.isArray(symbol.members)) {
                appendRows(symbol.members, symbol.name);
            }
        });
    };

    appendRows(symbols);

    table.append(body);
    container.append(table);
};

const renderResult = (outputs, data) => {
    renderTokens(outputs.tokens, data.tokens);

    const tree = document.createElement("ul");
    tree.className = "ast-tree";

    appendTree(tree, data.ast);
    outputs.ast.replaceChildren(tree);

    renderSymbols(outputs.symbols, data.symbols);

    Object.values(outputs).forEach((output) => {
        output.classList.remove("error");
    });
};

const initialisePlayground = (compiler) => {
    const source = compiler.querySelector("textarea");
    const stage = compiler.querySelector(".compile-stage");
    const button = compiler.querySelector(".preview-button");

    if (!source || !stage || !button) {
        logError("Playground is missing its textarea, stage or button.");
        return;
    }

    const outputs = Object.fromEntries(
        [...compiler.querySelectorAll(".compiler-output")]
            .map((element) => [element.dataset.output, element])
    );

    if (!outputs.tokens || !outputs.ast || !outputs.symbols) {
        stage.textContent = "invalid playground markup";
        logError("Expected tokens, ast and symbols output elements.");
        return;
    }

    compiler.querySelectorAll(".compiler-tab").forEach((tab) => {
        tab.addEventListener("click", () => {
            compiler.querySelectorAll(".compiler-tab").forEach((item) => {
                const active = item === tab;

                item.classList.toggle("active", active);
                item.setAttribute("aria-selected", String(active));
            });

            Object.values(outputs).forEach((output) => {
                output.hidden = output.dataset.output !== tab.dataset.view;
            });
        });
    });

    source.addEventListener("keydown", (event) => {
        if (event.key !== "Tab") return;

        event.preventDefault();

        source.setRangeText(
            "    ",
            source.selectionStart,
            source.selectionEnd,
            "end"
        );
    });

    button.addEventListener("click", async () => {
        button.disabled = true;
        stage.textContent = "loading compiler...";

        Object.values(outputs).forEach((output) => {
            output.classList.remove("error");
            output.replaceChildren();
        });

        try {
            const pyodide = await loadTeapotCompiler();

            stage.textContent = "compiling...";

            const data = await compileSource(pyodide, source.value);

            renderResult(outputs, data);

            stage.textContent = `${renderValue(data.memory_mode)} / complete`;
            log("Compilation completed successfully.");
        } catch (error) {
            const message = describeError(error);

            outputs.tokens.classList.add("error");

            const errorElement = document.createElement("code");
            errorElement.className = "compiler-error";
            errorElement.textContent = message;

            outputs.tokens.replaceChildren(errorElement);
            stage.textContent = "failed";

            logError("Playground error:", error);
        } finally {
            button.disabled = false;
        }
    });
};

const initialisePlaygrounds = () => {
    const playgrounds = document.querySelectorAll("[data-compiler]");

    log("Found playgrounds:", playgrounds.length);
    playgrounds.forEach(initialisePlayground);
};

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialisePlaygrounds, {
        once: true,
    });
} else {
    initialisePlaygrounds();
}
