# dar-nlp

Zero-dependency TF-IDF contract retrieval engine. Find reusable code from `@contract` blocks before writing anything new.

```
dar-nlp find "play text to speech"
```
```
[nlp-reuse] score=0.642  TTSAdapter
  does:       Wraps Web Speech API; play() resolves only when speech ENDS.
  reuse-when: Any module needs awaitable text-to-speech.
  example:    await tts.play()
```

---

## Install

```bash
npm install -g dar-nlp
```

Or locally via npm link for development:

```bash
git clone https://github.com/techiediaries/dar-nlp
cd dar-nlp && npm link
```

---

## Workflow

**1. Init** — tell dar-nlp where your source and output live:

```bash
dar-nlp init --src src --contracts contracts.json
```

Creates `.darnlp.json` in the current directory. Run once per project.

**2. Extract** — scan your JS files for `@contract` blocks:

```bash
dar-nlp extract
```

Reads `.darnlp.json` for the source path. Re-run after adding or editing contracts.

**3. Find** — search before writing any new code:

```bash
dar-nlp find "validate a chess move"
dar-nlp find "render a board position" --top 3
```

---

## Routing

Results come back color-coded with a routing decision:

| Color | Routing | Meaning |
|-------|---------|---------|
| 🟢 Green | `nlp-reuse` | Strong match — reuse as-is |
| 🟡 Yellow | `nlp-verify` | Possible match — check before using |
| 🔴 Red | `llm-generate` | No good match — write new code, then add a `@contract` |

---

## @contract format

dar-nlp reads standard JSDoc blocks tagged with `@contract`. The fields it indexes:

```js
/**
 * @contract
 * @role        adapter
 * @domain      audio
 * @does        Wraps Web Speech API; play() resolves when speech ENDS, not when it starts.
 * @tags        tts, speech, audio, promise, await, voice
 * @reuse-when  Any module needs awaitable text-to-speech without coupling to the DOM.
 * @example     const tts = new TTSAdapter(); await tts.play('Hello');
 * @complexity  simple
 * @module      src/audio/TTSAdapter
 */
```

**Key fields for retrieval:**

| Field | Weight | Purpose |
|-------|--------|---------|
| `@reuse-when` | 3× | Plain-English trigger — most important |
| `@does` | 2× | Semantic description |
| `@tags` | 2× | Keyword index — comma-separated |
| `@role` | 1× | Coarse classification |
| `@domain` | 1× | Namespace filter |

`@complexity` drives routing: `simple` → reuse, `moderate` → verify, `complex` → always LLM.

---

## API

Use programmatically if you prefer:

```js
const { createSearcher } = require('dar-nlp');

const search = createSearcher('/abs/path/to/contracts.json');
console.log(search.contractCount); // number of indexed contracts

const results = search('render board position', 5);
// [{ contract, score, routing }, ...]
```

`contracts.json` shape: `{ contracts: [...] }` — produced by `dar-nlp extract`.

---

## Enforcing the rule in AI coding tools

dar-nlp only works if `find` runs **before** code is written — not after. The tool exists; the habit is the hard part. Every major AI coding tool has a project-level instruction file that loads automatically at the start of every session. Put the rule there.

### The rule (copy this into any config file)

```
Before writing any new function, class, or method:
1. Run: dar-nlp find "<what you need>"
2. If result is nlp-reuse (green) — reuse it. Do not write new code.
3. If no match — write the code, then immediately add a @contract block and run dar-nlp extract.
Skipping this defeats the retrieval system.
```

---

### Claude Code — `CLAUDE.md`

Claude Code loads `CLAUDE.md` from the project root at the start of every session.

```markdown
## dar-nlp — run BEFORE writing any new code

Before writing any new function, class, or method in `src/`:
1. Run `dar-nlp find "<what you need>"` first
2. `nlp-reuse` (green) → reuse it, write nothing new
3. No match → write code, add `@contract` block, run `dar-nlp extract`

This is not optional. Skipping it defeats the retrieval system.
```

Global rule (applies to all projects): add to `~/.claude/CLAUDE.md`.

---

### Gemini CLI / Antigravity — `GEMINI.md`

Gemini CLI loads `GEMINI.md` from the project root.

```markdown
## dar-nlp contract search

Before writing any new function or module:
- Run: dar-nlp find "<description of what you need>"
- Green (nlp-reuse): reuse the matched code, skip writing
- No match: write code → add @contract block → dar-nlp extract
```

Global rule: `~/.gemini/GEMINI.md`

---

### Cursor — `.cursorrules`

Cursor reads `.cursorrules` from the project root and injects it into every chat and inline edit.

```
Before writing any new function or class, run:
  dar-nlp find "<what you need>"
If the result is nlp-reuse — use it. Do not write a duplicate.
If no match — write the code, add a @contract JSDoc block, run dar-nlp extract.
Never skip this step.
```

---

### GitHub Copilot — `.github/copilot-instructions.md`

Copilot reads this file and includes it in every suggestion context.

```markdown
## Code reuse via dar-nlp

Before suggesting any new function or class, the agent should recommend running:
  dar-nlp find "<description>"
If nlp-reuse is returned, suggest the existing code instead of generating new.
If no match, generate new code and include a @contract JSDoc block.
```

---

### Windsurf — `.windsurfrules`

```
Before writing any new function: run dar-nlp find "<what you need>".
nlp-reuse = use existing code. No match = write + add @contract + dar-nlp extract.
```

---

### Cline / Roo — `.clinerules`

```markdown
# dar-nlp rule
Always run `dar-nlp find "<need>"` before implementing anything new.
Reuse nlp-reuse matches. For misses: implement + @contract + dar-nlp extract.
```

---

### Aider — `CONVENTIONS.md`

Aider reads `CONVENTIONS.md` (or pass `--read CONVENTIONS.md`).

```markdown
## Contract-first rule
Before writing any function: dar-nlp find "<description>".
Reuse if nlp-reuse. Otherwise write + @contract + dar-nlp extract.
```

---

### OpenCode — `AGENTS.md`

OpenCode loads `AGENTS.md` from the project root.

```markdown
## dar-nlp
Run dar-nlp find before implementing. Reuse nlp-reuse results.
Add @contract to any new code, then dar-nlp extract.
```

---

### Universal fallback — any tool that reads a system prompt file

Most AI tools support some form of project-level context. The pattern is always the same — find the file, paste the rule. If your tool isn't listed, check its docs for:
- A file loaded automatically from the project root
- A global config or "custom instructions" field
- A `--system-prompt` or `--context` flag

Paste the rule from the top of this section into whichever mechanism your tool provides.

---

### Why enforcement matters

dar-nlp reduces cold-start token cost only if the retrieval step actually happens. Without enforcement, the agent writes new code by default — the corpus grows, but the retrieval savings never materialise.

The config file is the enforcement mechanism. An agent that has read the rule before it starts coding will reach for `dar-nlp find` the same way it reaches for a linter or formatter — because the instructions say to, every time, without being reminded.

---

## Why

Every AI-assisted codebase has a cold-start cost: the agent re-reads files it already read last session to re-learn what exists. `@contract` blocks + `dar-nlp find` replace that file-reading with a 20-token retrieval query.

Three types of token debt this eliminates:

- **Orientation** (`dar-nlp find` + a file map) — *where do I look?*
- **Interface** (contracts.json) — *what does each module take and return?*
- **Reuse-discovery** (`@reuse-when` + `dar-nlp find`) — *does this already exist?*

See [Building in the Age of Agents — Article 019](https://10xdev.blog) for the full breakdown.

---

## License

MIT
