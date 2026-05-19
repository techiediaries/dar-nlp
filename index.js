'use strict';

const path = require('path');
const fs   = require('fs');
const { buildIndex, score } = require('./tfidf');

/**
 * @contract
 * @role        factory
 * @domain      nlp
 * @does        Loads a contracts JSON file, builds a TF-IDF index over all contracts, and returns a search function.
 * @tags        factory, searcher, index, load, contracts, tfidf, graph, retrieval
 * @takes       {string} contractsPath — absolute path to a contracts JSON file ({contracts:[...]} or {all:[...]})
 * @returns     {Function} search(query, topK?) → results array with routing decisions
 * @example     const search = createSearcher('/path/to/contracts.json'); search('render board position', 5)
 * @reuse-when  You need a ready-to-use search function over any @contract corpus
 * @complexity  simple
 * @module      dar-nlp/index
 */
function createSearcher(contractsPath) {
  if (!contractsPath) {
    throw new Error('dar-nlp: contractsPath is required. Pass the absolute path to your contracts.json.');
  }

  if (!fs.existsSync(contractsPath)) {
    throw new Error(`dar-nlp: contracts file not found at ${contractsPath}\nRun your project's extract-contracts script first.`);
  }

  const raw = JSON.parse(fs.readFileSync(contractsPath, 'utf8'));
  const all = raw.contracts || raw.all;

  if (!Array.isArray(all) || all.length === 0) {
    throw new Error(`dar-nlp: no contracts found in ${contractsPath}`);
  }

  const index = buildIndex(all);

  function search(query, topK = 5) {
    return score(index, query, topK);
  }

  search.contractCount = all.length;
  search.sourcePath    = contractsPath;

  return search;
}

module.exports = { createSearcher };
