const hamburger = document.querySelector(".hamburger")
const links = document.querySelector(".nav-links")

hamburger.addEventListener("click", () => {
    links.classList.toggle("active")
})

links.addEventListener("click", () => {
    links.classList.toggle("active")
})

const escapeText = (value) => value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
}[character]))

document.querySelectorAll("[data-os-terminal]").forEach((terminal) => {
    const output = terminal.querySelector(".terminal-output")
    const input = terminal.querySelector("input")
    let prompt = terminal.querySelector(".terminal-prompt")

    const createPrompt = () => {
        const nextPrompt = document.createElement("p")
        nextPrompt.className = "terminal-prompt"
        nextPrompt.innerHTML = "<strong>TeapotOS&gt;</strong> <span></span><b aria-hidden=\"true\">_</b>"
        output.append(nextPrompt)
        prompt = nextPrompt
    }

    input.addEventListener("input", () => {
        prompt.querySelector("span").textContent = input.value
    })

    terminal.querySelector(".terminal-form").addEventListener("submit", (event) => {
        event.preventDefault()
        const command = input.value.trim().toLowerCase()
        if (!command) return

        const responses = {
            help: "Commands:\nhelp: prints this message\nclear: clears terminal\nwhoami: prints current user\nver: prints TeapotOS version",
            whoami: "teapotos",
            ver: "TeapotOS v0.1.0\nBuild date: 09-08-2026 (DD-MM-YYYY)\nArchitecture: i386",
            clear: ""
        }
        const response = responses[command] ?? `${command}: command not found`

        if (command === "clear") {
            output.replaceChildren()
            createPrompt()
        } else {
            const line = document.createElement("p")
            line.innerHTML = `<strong>TeapotOS&gt; ${escapeText(command)}</strong>`
            prompt.replaceWith(line)
            output.append(line)
            const result = document.createElement("p")
            result.textContent = response
            output.append(result)
            createPrompt()
        }
        input.value = ""
        output.scrollTop = output.scrollHeight
    })
})

document.querySelectorAll("[data-compiler]").forEach((compiler) => {
    const source = compiler.querySelector("textarea")
    const outputs = Object.fromEntries([...compiler.querySelectorAll(".compiler-output")].map((element) => [element.dataset.output, element]))
    const stage = compiler.querySelector(".compile-stage")
    const button = compiler.querySelector(".preview-button")

    const keywords = {
        attach: "IMPORT", as: "AS", pub: "PUBLIC", fc: "FUNCTION", exit: "EXIT",
        operator: "OPERATOR", val: "VAL", ref: "REFERENCE", free: "FREE", null: "NULL",
        if: "IF", elif: "ELSEIF", else: "ELSE", while: "WHILE", for: "FOR",
        break: "BREAK", continue: "CONTINUE", do: "DO", fail: "FAIL", err: "ERROR",
        sct: "STRUCT", enm: "ENUM", list: "LIST", map: "MAP"
    }
    const types = new Set("void str char bln aint dml f32 f64 si8 si16 si32 si64 ui8 ui16 ui32 ui64 mstr mbln msi8 msi16 msi32 mui8 mui16 mui32 mui64 maint mf32 mf64 mdml cstr cbln csi8 csi16 csi32 csi64 cui8 cui16 cui32 cui64 caint cf32 cf64 cdml cchar mchar".split(" "))
    const symbols = { "**": "POWER", "==": "EQUALS", ">=": "GREATER_EQUAL", "<=": "LESS_EQUAL", "~=": "NOT_EQUAL", "&&": "AND", "||": "OR", "+=": "ASSIGN_PLUS", "-=": "ASSIGN_MINUS", "*=": "ASSIGN_MULTIPLY", "/=": "ASSIGN_DIVIDE", "::": "DOUBLE_COLON", ">>": "CAST", "+": "PLUS", "-": "MINUS", "*": "MULTIPLY", "/": "DIVIDE", "%": "MODULO", ">": "GREATER", "<": "LESS", "~": "NOT", "=": "ASSIGN", "(": "OPEN_PAREN", ")": "CLOSE_PAREN", "{": "OPEN_BRACE", "}": "CLOSE_BRACE", "[": "OPEN_BRACKET", "]": "CLOSE_BRACKET", ",": "COMMA", ".": "PERIOD", "|": "PIPE", ":": "COLON", "!": "EXCLAMATION" }

    const lex = (text) => {
        const result = []
        let position = 0
        let line = 1
        let col = 1
        const add = (type, value, tokenLine, tokenCol) => result.push({ type, value, line: tokenLine, col: tokenCol })
        const advance = () => { if (text[position] === "\n") { line += 1; col = 1 } else col += 1; position += 1 }
        while (position < text.length) {
            const character = text[position]
            if (/\s/.test(character)) { advance(); continue }
            const tokenLine = line
            const tokenCol = col
            if (character === "/" && text[position + 1] === "/") { while (position < text.length && text[position] !== "\n") advance(); continue }
            if (character === "$" ) {
                let value = ""
                while (position < text.length && text[position] !== "\n") { value += text[position]; advance() }
                if (!["$MEM-GC", "$MEM-MANUAL"].includes(value)) throw new Error(`Lexer error at ${tokenLine}:${tokenCol}: Invalid directive`)
                add("DIRECTIVE", value, tokenLine, tokenCol); continue
            }
            if (/[A-Za-z_]/.test(character)) {
                let value = ""
                while (/[A-Za-z0-9_]/.test(text[position] || "")) { value += text[position]; advance() }
                add(keywords[value] || (types.has(value) ? "TYPE" : ["true", "false"].includes(value) ? "BOOLEAN" : "IDENTIFIER"), value, tokenLine, tokenCol); continue
            }
            if (/\d/.test(character)) {
                let value = ""
                while (/\d/.test(text[position] || "") || (text[position] === "." && /\d/.test(text[position + 1] || ""))) { value += text[position]; advance() }
                add(value.includes(".") ? "FLOAT" : "INTEGER", value, tokenLine, tokenCol); continue
            }
            if (character === '"') {
                advance(); let value = ""
                while (position < text.length && text[position] !== '"') { value += text[position]; advance() }
                if (text[position] !== '"') throw new Error(`Lexer error at ${tokenLine}:${tokenCol}: Unterminated string.`)
                advance(); add("STRING", value, tokenLine, tokenCol); continue
            }
            const symbol = Object.keys(symbols).sort((left, right) => right.length - left.length).find((candidate) => text.startsWith(candidate, position))
            if (!symbol) throw new Error(`Lexer error at ${tokenLine}:${tokenCol}: Invalid symbol.`)
            for (let count = 0; count < symbol.length; count += 1) advance()
            add(symbols[symbol], symbol, tokenLine, tokenCol)
        }
        add("EOF", null, line, col)
        return result
    }

    const formatTokens = (tokens) => tokens.map((token) => `Token(type=${token.type}, value=${token.value === null ? "None" : JSON.stringify(token.value)}, line=${token.line}, col=${token.col})`).join("\n")
    const validateSyntax = (tokens) => {
        let position = 1
        const current = () => tokens[position]
        const fail = (message) => {
            const token = current() || tokens[tokens.length - 1]
            throw new Error(`Parser error at token ${token.type} at ${token.line}:${token.col}: ${message}`)
        }
        const take = (type, message = `Expected ${type}`) => {
            if (current()?.type !== type) fail(message)
            return tokens[position++]
        }
        const maybe = (type) => current()?.type === type && tokens[position++]
        const balanced = (open, close) => {
            take(open)
            let depth = 1
            while (depth && current()?.type !== "EOF") {
                if (current().type === open) depth += 1
                if (current().type === close) depth -= 1
                position += 1
            }
            if (depth) fail(`Expected ${close}`)
        }
        const expressionUntil = (endTypes) => {
            let count = 0
            while (current()?.type !== "EOF" && !endTypes.includes(current().type)) {
                if (["OPEN_PAREN", "OPEN_BRACE", "OPEN_BRACKET"].includes(current().type)) count += 1
                if (["CLOSE_PAREN", "CLOSE_BRACE", "CLOSE_BRACKET"].includes(current().type)) count -= 1
                if (count < 0) fail("Unexpected closing delimiter")
                position += 1
            }
            if (!count && endTypes.length && !endTypes.includes(current()?.type)) fail(`Expected ${endTypes.join(" or ")}`)
            if (!position || tokens[position - 1]?.type === "ASSIGN") fail("Expected an expression")
        }
        const block = () => {
            take("OPEN_BRACE", "Expected an opening brace for the block")
            while (current()?.type !== "CLOSE_BRACE" && current()?.type !== "EOF") statement()
            take("CLOSE_BRACE", "Expected a closing brace for the block")
        }
        const variable = () => {
            maybe("REFERENCE")
            if (!["TYPE", "IDENTIFIER"].includes(current()?.type)) fail("Expected a datatype")
            position += 1
            if (maybe("OPEN_BRACKET")) take("CLOSE_BRACKET")
            take("IDENTIFIER", "Expected a variable name")
            if (maybe("ASSIGN")) expressionUntil(["PERIOD"])
            take("PERIOD", "Expected a period after the variable declaration")
        }
        const argumentsList = () => {
            take("OPEN_PAREN")
            if (current()?.type !== "CLOSE_PAREN") {
                while (true) {
                    if (!["TYPE", "IDENTIFIER"].includes(current()?.type)) fail("Expected an argument datatype")
                    position += 1
                    if (maybe("OPEN_BRACKET")) take("CLOSE_BRACKET")
                    take("IDENTIFIER", "Expected an argument name")
                    if (maybe("ASSIGN")) expressionUntil(["COMMA", "CLOSE_PAREN"])
                    if (!maybe("COMMA")) break
                }
            }
            take("CLOSE_PAREN")
        }
        const namedBlockDeclaration = (kind) => {
            take("IDENTIFIER", `Expected a name after ${kind}`)
            take("OPEN_BRACE", `Expected an opening brace after ${kind} name`)
            while (current()?.type !== "CLOSE_BRACE" && current()?.type !== "EOF") {
                if (kind === "STRUCT" || kind === "ERROR") {
                    if (current()?.type !== "TYPE") fail("Expected a datatype in the declaration")
                    position += 1
                    take("IDENTIFIER", "Expected a member name")
                } else take("IDENTIFIER", "Expected a member name")
                take("PERIOD", "Expected a period after the member")
            }
            take("CLOSE_BRACE", "Expected a closing brace for the declaration")
        }
        const callable = (kind) => {
            if (kind === "OPERATOR") {
                if (!["IDENTIFIER", "PLUS", "MINUS", "MODULO", "MULTIPLY", "DIVIDE"].includes(current()?.type)) fail("Invalid operator name")
                position += 1
            } else take("IDENTIFIER", "Expected a function name")
            argumentsList()
            take("EXCLAMATION", "Expected ! before the return type")
            if (!["TYPE", "IDENTIFIER"].includes(current()?.type)) fail("Expected a return type")
            position += 1
            block()
        }
        const statement = () => {
            const isPublic = maybe("PUBLIC")
            const kind = current()?.type
            if (isPublic && !["FUNCTION", "STRUCT", "ENUM", "ERROR", "OPERATOR"].includes(kind)) fail("Only functions, structs, enums, operators, and errors can be public")
            if (kind === "VAL") { position += 1; variable(); return }
            if (kind === "FUNCTION" || kind === "OPERATOR") { position += 1; callable(kind); return }
            if (kind === "STRUCT" || kind === "ENUM" || kind === "ERROR") { position += 1; namedBlockDeclaration(kind); return }
            if (kind === "EXIT") { position += 1; expressionUntil(["PERIOD"]); take("PERIOD", "Expected a period after exit"); return }
            if (["IF", "WHILE"].includes(kind)) { position += 1; balanced("OPEN_PAREN", "CLOSE_PAREN"); block(); return }
            if (kind === "FOR") { position += 1; balanced("OPEN_PAREN", "CLOSE_PAREN"); block(); return }
            if (kind === "DO") { position += 1; block(); return }
            if (kind === "ELSEIF") { position += 1; balanced("OPEN_PAREN", "CLOSE_PAREN"); block(); return }
            if (kind === "ELSE") { position += 1; block(); return }
            if (kind === "EOF") return
            expressionUntil(["PERIOD"])
            take("PERIOD", "Expected a period after the statement")
        }
        while (current()?.type !== "EOF") statement()
    }

    const formatAst = (tokens) => {
        const lines = [`Program`, `  memory_mode: ${tokens[0].value}`, "  statements:"]
        const value = (index) => tokens[index]?.value ?? "?"
        const matching = (start, open, close) => {
            let depth = 0
            for (let index = start; index < tokens.length; index += 1) {
                if (tokens[index].type === open) depth += 1
                if (tokens[index].type === close) { depth -= 1; if (depth === 0) return index }
            }
            throw new Error(`Parser error at token ${tokens[start]?.type}: expected ${close}`)
        }
        const expression = (start, end) => tokens.slice(start, end).map((token) => token.value === null ? "None" : JSON.stringify(token.value)).join(" ") || "None"
        for (let index = 1; index < tokens.length - 1;) {
            let isPublic = false
            if (tokens[index].type === "PUBLIC") { isPublic = true; index += 1 }
            const token = tokens[index]
            if (["FUNCTION", "OPERATOR"].includes(token.type)) {
                const open = tokens.findIndex((item, offset) => offset > index && item.type === "OPEN_PAREN")
                const close = matching(open, "OPEN_PAREN", "CLOSE_PAREN")
                const brace = tokens.findIndex((item, offset) => offset > close && item.type === "OPEN_BRACE")
                const bodyEnd = matching(brace, "OPEN_BRACE", "CLOSE_BRACE")
                lines.push(`    ${token.type === "FUNCTION" ? "Function" : "Operator"}`)
                lines.push(`      name: ${value(index + 1)}`)
                lines.push(`      public: ${isPublic}`)
                lines.push(`      arguments: [${expression(open + 1, close)}]`)
                lines.push(`      return_type: ${value(close + 2)}`)
                lines.push("      body:")
                for (let body = brace + 1; body < bodyEnd; body += 1) {
                    if (tokens[body].type === "EXIT") lines.push(`        Return: ${expression(body + 1, Math.min(body + 5, bodyEnd))}`)
                    if (tokens[body].type === "VAL") lines.push(`        DeclareVariable: ${value(body + 2)} (${value(body + 1)})`)
                    if (["IF", "ELIF", "ELSE", "WHILE", "FOR", "DO"].includes(tokens[body].type)) lines.push(`        ${tokens[body].type} block`)
                }
                index = bodyEnd + 1
            } else if (token.type === "VAL") {
                lines.push(`    DeclareVariable: ${value(index + 2)} (${value(index + 1)})`)
                const period = tokens.findIndex((item, offset) => offset > index && item.type === "PERIOD")
                index = period < 0 ? tokens.length : period + 1
            } else if (["STRUCT", "ENUM", "ERROR"].includes(token.type)) {
                lines.push(`    ${token.type} declaration: ${value(index + 1)}`)
                index += 2
            } else index += 1
        }
        return lines.join("\n")
    }
    const formatTable = (tokens) => `<table><thead><tr><th>Index</th><th>Type</th><th>Value</th><th>Line</th><th>Col</th></tr></thead><tbody>${tokens.map((token, index) => `<tr><td>${index}</td><td>${escapeText(token.type)}</td><td>${escapeText(String(token.value ?? "None"))}</td><td>${token.line}</td><td>${token.col}</td></tr>`).join("")}</tbody></table>`

    compiler.querySelectorAll(".compiler-tab").forEach((tab) => tab.addEventListener("click", () => {
        compiler.querySelectorAll(".compiler-tab").forEach((item) => item.classList.toggle("active", item === tab))
        compiler.querySelectorAll(".compiler-output").forEach((output) => { output.hidden = output.dataset.output !== tab.dataset.view })
    }))

    button.addEventListener("click", () => {
        const text = source.value.trim()
        const stages = ["lexing tokens...", "building AST...", "checking semantics..."]
        Object.values(outputs).forEach((output) => { output.classList.remove("error"); output.textContent = "" })
        button.disabled = true
        let index = 0
        const advance = () => {
            stage.textContent = stages[index]
            outputs.tokens.textContent = `stage ${index + 1}/3: ${stages[index]}`
            index += 1
            if (index < stages.length) {
                window.setTimeout(advance, 260)
                return
            }

            window.setTimeout(() => {
                button.disabled = false
                stage.textContent = "compiled"
                if (!text) {
                    outputs.tokens.classList.add("error")
                    outputs.tokens.textContent = "error: source is empty"
                    stage.textContent = "failed"
                } else {
                    try {
                        const tokens = lex(text)
                        if (tokens[0]?.type !== "DIRECTIVE") throw new Error("Parser error: No directive found. Specify $MEM-GC or $MEM-MANUAL.")
                        if (tokens.filter((token) => token.type === "DIRECTIVE").length > 1) throw new Error("Parser error: Directive must only appear once")
                        validateSyntax(tokens)
                        outputs.tokens.textContent = formatTokens(tokens)
                        outputs.ast.textContent = formatAst(tokens)
                        outputs.table.innerHTML = formatTable(tokens)
                        stage.textContent = "complete"
                    } catch (error) {
                        outputs.tokens.classList.add("error")
                        outputs.tokens.textContent = error.message
                        stage.textContent = "failed"
                    }
                }
            }, 260)
        }
        advance()
    })
})

document.querySelectorAll("[data-chat]").forEach((chat) => {
    const clients = [...chat.querySelectorAll(".chat-client")]
    const sessions = clients.map(() => ({ name: "", joined: false, active: true }))

    clients.forEach((client, senderIndex) => {
        const form = client.querySelector(".chat-form")
        const input = form.querySelector("input")
        const messages = client.querySelector(".chat-messages")
        input.placeholder = "Enter your name"
        const addMessage = (text, className = "") => {
            const message = document.createElement("p")
            message.className = `chat-message ${className}`
            message.textContent = text
            messages.append(message)
        }
        addMessage("Enter your name (or !exit to leave chat):", "prompt-line")
        const updatePrompt = () => {
            const existing = messages.querySelector(".live-prompt")
            if (existing) existing.remove()
            if (!sessions[senderIndex].active) return
            const prompt = document.createElement("p")
            prompt.className = "chat-message live-prompt"
            prompt.textContent = sessions[senderIndex].joined
                ? `Message (or !exit to leave chat): ${input.value}_`
                : `Enter your name (or !exit to leave chat): ${input.value}_`
            messages.append(prompt)
        }
        updatePrompt()
        input.addEventListener("input", updatePrompt)
        form.addEventListener("submit", (event) => {
            event.preventDefault()
            const text = input.value.trim()
            const session = sessions[senderIndex]
            if (!text || !session.active) return
            messages.querySelector(".live-prompt")?.remove()
            if (!session.joined) {
                if (text === "!exit") {
                    addMessage("disconnected", "chat-error")
                    input.disabled = true
                    session.active = false
                    return
                }
                if (sessions.some((other, index) => index !== senderIndex && other.name === text && other.joined)) {
                    addMessage("[Error] ERROR_USER_EXISTS", "chat-error")
                    updatePrompt()
                    return
                }
                session.name = text
                session.joined = true
                input.placeholder = "Message (or !exit to leave chat)"
                addMessage(`Joined chat as ${text}`, "joined")
                input.value = ""
                updatePrompt()
                return
            }
            if (text === "!exit") {
                addMessage(`\n${session.name} left.`, "joined")
                input.disabled = true
                session.active = false
                return
            }
            clients.forEach((recipient, recipientIndex) => {
                if (!sessions[recipientIndex].joined || !sessions[recipientIndex].active) return
                const message = document.createElement("p")
                message.className = `chat-message relay${recipientIndex === senderIndex ? " own" : ""}`
                message.textContent = `${session.name}: ${text}`
                const recipientMessages = recipient.querySelector(".chat-messages")
                recipientMessages.append(message)
                const recipientPrompt = recipientMessages.querySelector(".live-prompt")
                if (recipientPrompt) recipientMessages.append(recipientPrompt)
            })
            input.value = ""
            updatePrompt()
        })
    })
})