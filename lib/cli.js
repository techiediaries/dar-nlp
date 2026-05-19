'use strict';

const fs   = require('fs');
const path = require('path');

const GREEN  = '\x1b[32m';
const RED    = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN   = '\x1b[36m';
const DIM    = '\x1b[2m';
const BOLD   = '\x1b[1m';
const RESET  = '\x1b[0m';

const CONFIG_FILE = '.darnlp.json';

// ── config helpers ──────────────────────────────────────────────────────────

function loadConfig(cwd) {
  const p = path.join(cwd, CONFIG_FILE);
  if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
  return null;
}

function saveConfig(cwd, cfg) {
  fs.writeFileSync(path.join(cwd, CONFIG_FILE), JSON.stringify(cfg, null, 2) + '\n', 'utf8');
}

function resolveContracts(cwd, flag) {
  if (flag) return path.resolve(cwd, flag);
  const cfg = loadConfig(cwd);
  if (cfg?.contracts) return path.resolve(cwd, cfg.contracts);
  return path.join(cwd, 'contracts.json');
}

function resolveSrc(cwd, arg) {
  if (arg) return path.resolve(cwd, arg);
  const cfg = loadConfig(cwd);
  if (cfg?.src) return path.resolve(cwd, cfg.src);
  return path.join(cwd, 'src');
}

// ── commands ─────────────────────────────────────────────────────────────────

function cmdInit(cwd, args) {
  const existing = loadConfig(cwd);
  if (existing) {
    console.log(`${YELLOW}${CONFIG_FILE} already exists:${RESET}`, JSON.stringify(existing));
    return;
  }

  // Interactive defaults — sensible for most JS projects
  const srcDir       = args['--src']       || 'src';
  const contractsOut = args['--contracts'] || 'contracts.json';

  const cfg = { src: srcDir, contracts: contractsOut };
  saveConfig(cwd, cfg);
  console.log(`${GREEN}✓ Created ${CONFIG_FILE}${RESET}`);
  console.log(DIM + JSON.stringify(cfg, null, 2) + RESET);
  console.log(`\nNext: ${CYAN}dar-nlp extract${RESET}  then  ${CYAN}dar-nlp find "your query"${RESET}`);
}

function cmdExtract(cwd, args) {
  const { extract } = require('./extract');
  const srcDir      = resolveSrc(cwd, args._[0]);
  const outPath     = resolveContracts(cwd, args['--out']);

  if (!fs.existsSync(srcDir)) {
    console.error(`${RED}src dir not found: ${srcDir}${RESET}`);
    console.error(`Run ${CYAN}dar-nlp init${RESET} first, or pass the src dir: ${CYAN}dar-nlp extract <srcDir>${RESET}`);
    process.exit(1);
  }

  const { contracts, count } = extract(srcDir);
  const output = { generated: new Date().toISOString(), src: srcDir, contracts };
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf8');
  console.log(`${GREEN}✓ ${count} contracts${RESET} → ${DIM}${outPath}${RESET}`);
}

function cmdFind(cwd, args) {
  const { createSearcher } = require('../index');
  const query        = args._.join(' ');
  const topK         = parseInt(args['--top'] || args['-n'] || '5', 10);
  const contractsPath = resolveContracts(cwd, args['--contracts']);

  if (!query) {
    console.error(`Usage: ${CYAN}dar-nlp find "your query" [--top N]${RESET}`);
    process.exit(1);
  }

  let search;
  try {
    search = createSearcher(contractsPath);
  } catch (e) {
    console.error(`${RED}${e.message}${RESET}`);
    console.error(`Run ${CYAN}dar-nlp extract${RESET} first.`);
    process.exit(1);
  }

  console.log(`\n${DIM}Searching ${search.contractCount} contracts for:${RESET} ${BOLD}"${query}"${RESET}\n`);
  const results = search(query, topK);

  if (results.length === 0) {
    console.log('No matches found — safe to write new code.');
    return;
  }

  const ROUTING_COLOR = { 'nlp-reuse': GREEN, 'nlp-verify': YELLOW, 'llm-generate': RED };

  for (const { contract: c, score, routing } of results) {
    const col = ROUTING_COLOR[routing] || '';
    console.log(`${col}[${routing}]${RESET} ${DIM}score=${score.toFixed(3)}${RESET}  ${BOLD}${c.module || ''}${RESET}`);
    if (c.does)           console.log(`  ${DIM}does:${RESET}       ${c.does}`);
    if (c['reuse-when'])  console.log(`  ${DIM}reuse-when:${RESET} ${c['reuse-when']}`);
    if (c.example)        console.log(`  ${DIM}example:${RESET}    ${CYAN}${c.example}${RESET}`);
    console.log();
  }
}

// ── arg parser ───────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const result = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--') || a.startsWith('-n')) {
      const next = argv[i + 1];
      if (next && !next.startsWith('-')) { result[a] = next; i++; }
      else result[a] = true;
    } else {
      result._.push(a);
    }
  }
  return result;
}

// ── help ─────────────────────────────────────────────────────────────────────

function help() {
  console.log(`
${BOLD}dar-nlp${RESET} — contract-based code retrieval

${CYAN}Commands:${RESET}
  ${BOLD}init${RESET}     [--src <dir>] [--contracts <path>]
           Create .darnlp.json config in the current project

  ${BOLD}extract${RESET}  [srcDir] [--out <path>]
           Scan JS files for @contract blocks → write contracts JSON

  ${BOLD}find${RESET}     <query> [--top N] [--contracts <path>]
           Search contracts by natural language

${CYAN}Routing:${RESET}
  ${GREEN}nlp-reuse${RESET}    — reuse as-is (simple + strong match)
  ${YELLOW}nlp-verify${RESET}   — check before using (moderate or weak match)
  ${RED}llm-generate${RESET} — no good match; write new code + add @contract

${CYAN}Example workflow:${RESET}
  dar-nlp init
  dar-nlp extract
  dar-nlp find "play text to speech"
`);
}

// ── entry ────────────────────────────────────────────────────────────────────

function run(argv, cwd) {
  const [cmd, ...rest] = argv;
  const args = parseArgs(rest);

  if (!cmd || cmd === '--help' || cmd === '-h') return help();
  if (cmd === 'init')    return cmdInit(cwd, args);
  if (cmd === 'extract') return cmdExtract(cwd, args);
  if (cmd === 'find')    return cmdFind(cwd, args);

  console.error(`${RED}Unknown command: ${cmd}${RESET}`);
  help();
  process.exit(1);
}

module.exports = { run };
