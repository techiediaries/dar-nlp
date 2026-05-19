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
