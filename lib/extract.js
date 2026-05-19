'use strict';

const fs   = require('fs');
const path = require('path');

const ARRAY_FIELDS = new Set(['takes', 'throws', 'used-by', 'depends-on']);

function parseBlock(block) {
  const result = {};
  const tagRe  = /^\s*\*?\s*@([\w-]+)[ \t]+(.*)/gm;
  let m;
  while ((m = tagRe.exec(block)) !== null) {
    const tag = m[1];
    const val = m[2].trim();
    if (ARRAY_FIELDS.has(tag)) {
      if (!result[tag]) result[tag] = [];
      result[tag].push(val);
    } else {
      result[tag] = val;
    }
  }
  return result;
}

function extractFromSource(src, relPath) {
  const contracts  = [];
  const modulePath = relPath.replace(/\.js$/, '');
  const domain     = modulePath.split('/')[0] || 'unknown';
  const blockRe    = /\/\*\*([\s\S]*?)\*\//g;
  let m;
  while ((m = blockRe.exec(src)) !== null) {
    const parsed = parseBlock(m[1]);
    if (!parsed.contract && !parsed.module) continue;
    if (!parsed.domain)  parsed.domain  = domain;
    if (!parsed.module)  parsed.module  = modulePath;
    contracts.push(parsed);
  }
  return contracts;
}

function walk(dir, base) {
  let all = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory() && e.name !== 'node_modules' && !e.name.startsWith('.')) {
      all = all.concat(walk(full, base));
    } else if (e.isFile() && e.name.endsWith('.js')) {
      const rel = path.relative(base, full);
      all = all.concat(extractFromSource(fs.readFileSync(full, 'utf8'), rel));
    }
  }
  return all;
}

/**
 * Extract all @contract blocks from JS files under srcDir.
 * Returns { contracts, count, srcDir }.
 */
function extract(srcDir) {
  const abs       = path.resolve(srcDir);
  const contracts = walk(abs, abs);
  return { contracts, count: contracts.length, srcDir: abs };
}

module.exports = { extract };
