'use strict';

const assert = require('assert');
const path   = require('path');
const fs     = require('fs');
const os     = require('os');

const { tokenize, buildIndex, score } = require('../tfidf');
const { createSearcher }              = require('../index');
const { extract }                     = require('../lib/extract');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ✗ ${name}`);
    console.log(`    ${e.message}`);
    failed++;
  }
}

// ── tfidf ────────────────────────────────────────────────────────────────────

console.log('\ntfidf');

test('tokenize removes stopwords and stems', () => {
  const tokens = tokenize('You need to render the board position');
  assert.ok(tokens.includes('rend'),   'render → rend (er suffix stemmed)');
  assert.ok(tokens.includes('board'),  'board present');
  assert.ok(!tokens.includes('you'),   'stopword removed');
  assert.ok(!tokens.includes('the'),   'stopword removed');
  assert.ok(!tokens.includes('render'),'unstemmed form not present');
});

test('buildIndex returns docs and idf', () => {
  const contracts = [
    { does: 'Renders board', tags: 'board, render', 'reuse-when': 'display a position', role: 'renderer', domain: 'ui' },
    { does: 'Plays audio',   tags: 'audio, sound',  'reuse-when': 'play a sound effect', role: 'adapter',  domain: 'audio' },
  ];
  const idx = buildIndex(contracts);
  assert.strictEqual(idx.docs.length, 2);
  assert.ok(typeof idx.idf === 'object');
});

test('score returns ranked results with routing', () => {
  const contracts = [
    { does: 'Renders chess board', tags: 'board, render, chess', 'reuse-when': 'display board position', role: 'renderer', domain: 'ui', complexity: 'simple' },
    { does: 'Plays TTS audio',     tags: 'audio, tts, speech',   'reuse-when': 'speak text aloud',       role: 'adapter',  domain: 'audio', complexity: 'simple' },
    { does: 'Validates a move',    tags: 'move, validate, chess', 'reuse-when': 'check if move is legal', role: 'validator',domain: 'engine',complexity: 'simple' },
  ];
  const idx     = buildIndex(contracts);
  const results = score(idx, 'render board', 3);
  assert.ok(results.length > 0, 'has results');
  assert.strictEqual(results[0].contract.domain, 'ui', 'board renderer ranks first');
  if (results.length > 1) {
    assert.ok(results[0].score >= results[1].score, 'sorted by score descending');
  }
  assert.ok(['nlp-reuse','nlp-verify','llm-generate'].includes(results[0].routing), 'routing present');
});

test('score returns empty array for empty query', () => {
  const idx     = buildIndex([{ does: 'x', tags: 'x', 'reuse-when': 'x', role: 'query', domain: 'd' }]);
  const results = score(idx, '   ');
  assert.deepStrictEqual(results, []);
});

// ── createSearcher ────────────────────────────────────────────────────────────

console.log('\ncreateSearcher');

test('throws when contractsPath missing', () => {
  assert.throws(() => createSearcher(), /contractsPath is required/);
});

test('throws when file not found', () => {
  assert.throws(() => createSearcher('/nonexistent/contracts.json'), /not found/);
});

test('loads file and returns search function', () => {
  const tmp  = path.join(os.tmpdir(), `dar-nlp-test-${Date.now()}.json`);
  const data = {
    contracts: [
      { does: 'Renders board', tags: 'board, render', 'reuse-when': 'display position', role: 'renderer', domain: 'ui', complexity: 'simple' },
    ],
  };
  fs.writeFileSync(tmp, JSON.stringify(data));
  const search = createSearcher(tmp);
  assert.strictEqual(typeof search, 'function');
  assert.strictEqual(search.contractCount, 1);
  const results = search('render board');
  assert.ok(results.length > 0);
  fs.unlinkSync(tmp);
});

// ── extract ───────────────────────────────────────────────────────────────────

console.log('\nextract');

test('extracts @contract blocks from JS source', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dar-nlp-'));
  fs.writeFileSync(path.join(tmp, 'sample.js'), `
    /**
     * @contract
     * @role transformer
     * @domain test
     * @does Converts input to output.
     * @tags convert, input, output
     * @reuse-when You need to convert something
     * @complexity simple
     * @module test/sample
     */
    function sample() {}
  `);
  const { contracts, count } = extract(tmp);
  assert.strictEqual(count, 1);
  assert.strictEqual(contracts[0].role, 'transformer');
  assert.strictEqual(contracts[0].does, 'Converts input to output.');
  fs.rmSync(tmp, { recursive: true });
});

test('ignores blocks without @contract or @module', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dar-nlp-'));
  fs.writeFileSync(path.join(tmp, 'plain.js'), `
    /** Just a plain comment with no contract tag */
    function plain() {}
  `);
  const { count } = extract(tmp);
  assert.strictEqual(count, 0);
  fs.rmSync(tmp, { recursive: true });
});

test('skips node_modules directories', () => {
  const tmp     = fs.mkdtempSync(path.join(os.tmpdir(), 'dar-nlp-'));
  const nmDir   = path.join(tmp, 'node_modules', 'some-pkg');
  fs.mkdirSync(nmDir, { recursive: true });
  fs.writeFileSync(path.join(nmDir, 'index.js'), `
    /** @contract @role query @domain x @does Something. @tags x @reuse-when x @complexity simple @module x */
    function x() {}
  `);
  const { count } = extract(tmp);
  assert.strictEqual(count, 0, 'node_modules not scanned');
  fs.rmSync(tmp, { recursive: true });
});

// ── summary ───────────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
