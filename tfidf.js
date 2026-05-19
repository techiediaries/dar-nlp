'use strict';

const STOPWORDS = new Set([
  'a','an','the','is','are','was','were','be','been','being',
  'have','has','had','do','does','did','will','would','could','should','may','might',
  'i','you','he','she','it','we','they','me','him','her','us','them',
  'this','that','these','those','what','which','who','how','when','where','why',
  'to','of','in','for','on','with','at','by','from','up','about','into','through',
  'and','or','but','if','not','no','so','as','any','all','both','each',
  'need','want','use','get','make','just','only','also','already','without',
]);

function stem(token) {
  if (token.length < 5) return token;
  if (token.endsWith('ies'))   return token.slice(0, -3) + 'y';
  if (token.endsWith('ying'))  return token.slice(0, -4) + 'ie';
  if (token.endsWith('ing') && token.length > 6) return token.slice(0, -3);
  if (token.endsWith('tion'))  return token.slice(0, -3);
  if (token.endsWith('ness'))  return token.slice(0, -4);
  if (token.endsWith('ed')  && token.length > 5) return token.slice(0, -2);
  if (token.endsWith('er')  && token.length > 5) return token.slice(0, -2);
  if (token.endsWith('ly')  && token.length > 5) return token.slice(0, -2);
  if (token.endsWith('s')   && !token.endsWith('ss') && token.length > 4) return token.slice(0, -1);
  return token;
}

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1 && !STOPWORDS.has(t))
    .map(stem);
}

function buildIndex(contracts) {
  const docs = contracts.map((c, i) => {
    const parts = [
      (c['reuse-when'] || ''), (c['reuse-when'] || ''), (c['reuse-when'] || ''),
      (c.does || ''), (c.does || ''),
      (c.tags || '').replace(/,/g, ' '), (c.tags || '').replace(/,/g, ' '),
      (c.role   || ''),
      (c.domain || ''),
    ];
    const tokens = tokenize(parts.join(' '));
    const tf = {};
    for (const t of tokens) tf[t] = (tf[t] || 0) + 1;
    const len = tokens.length || 1;
    for (const t in tf) tf[t] /= len;
    return { id: i, tokens, tf, contract: c };
  });

  const df = {};
  const N  = docs.length;
  for (const doc of docs) {
    const seen = new Set(doc.tokens);
    for (const t of seen) df[t] = (df[t] || 0) + 1;
  }
  const idf = {};
  for (const t in df) idf[t] = Math.log(N / df[t]) + 1;

  return { docs, idf, contracts };
}

function deriveRouting(contract, matchScore, confidentLead = false) {
  const complexity = contract.complexity || 'simple';
  if (complexity === 'complex')                       return 'llm-generate';
  if (complexity === 'moderate' && matchScore < 0.4)  return 'llm-generate';
  if (complexity === 'moderate')                      return 'nlp-verify';
  if (confidentLead && matchScore >= 0.15)            return 'nlp-reuse';
  if (matchScore >= 0.45)                             return 'nlp-reuse';
  if (matchScore >= 0.15)                             return 'nlp-verify';
  return 'llm-generate';
}

function score(index, query, topK = 5) {
  const qTokens = tokenize(query);
  if (qTokens.length === 0) return [];

  const qTf = {};
  for (const t of qTokens) qTf[t] = (qTf[t] || 0) + 1;
  const qLen = qTokens.length;
  for (const t in qTf) qTf[t] /= qLen;

  const results = index.docs.map(doc => {
    let dot = 0, qMag = 0, dMag = 0;
    const allTerms = new Set([...Object.keys(qTf), ...Object.keys(doc.tf)]);
    for (const t of allTerms) {
      const qW = (qTf[t] || 0) * (index.idf[t] || 0);
      const dW = (doc.tf[t] || 0) * (index.idf[t] || 0);
      dot  += qW * dW;
      qMag += qW * qW;
      dMag += dW * dW;
    }
    const sim = (qMag > 0 && dMag > 0) ? dot / (Math.sqrt(qMag) * Math.sqrt(dMag)) : 0;
    return { contract: doc.contract, score: sim };
  });

  const sorted = results.filter(r => r.score > 0).sort((a, b) => b.score - a.score);
  const top  = sorted[0]?.score || 0;
  const next = sorted[1]?.score || 0;
  const confidentLead = top > 0 && (next === 0 || top / next >= 1.8);

  return sorted.slice(0, topK).map((r, i) => ({
    ...r,
    routing: deriveRouting(r.contract, r.score, i === 0 && confidentLead),
  }));
}

module.exports = { tokenize, buildIndex, score, deriveRouting };
