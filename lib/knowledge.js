// Loads the general evidence corpus (knowledge/*.md, no patient data) and
// supports reference lookup and simple section retrieval (used when no AI
// model is reachable). Patient-specific evidence lives in her Sheet.
import fs from 'node:fs';
import path from 'node:path';

let cache = null;

// Reference lines: "1. [Title](https://...) ... (Grade A)".
function parseRefs(block, into) {
  for (const m of block.matchAll(/^(\d+)\.\s+\[([^\]]+)\]\((https?:[^)\s]+)\)(.*)$/gm)) {
    const grade = (m[4].match(/Grade\s+([A-E])/i) || [])[1] || '';
    into[m[1]] = { title: m[2].trim(), url: m[3], grade };
  }
}

export function corpus() {
  if (cache) return cache;
  const dir = path.join(process.cwd(), 'knowledge');
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.md')).sort() : [];
  const refs = {}, bodies = [], sections = [];
  for (const f of files) {
    const text = fs.readFileSync(path.join(dir, f), 'utf8');
    const [body, refBlock = ''] = text.split(/\n## References\s*\n/);
    parseRefs(refBlock, refs);
    bodies.push(body.trim());
    for (const s of body.split(/\n(?=#{2,3} )/)) {
      const heading = (s.match(/^#{2,3} (.+)/) || [, ''])[1].trim();
      if (heading) sections.push({ heading, text: s.replace(/^#{1,3} .+\n/, '').trim() });
    }
  }
  cache = { body: bodies.join('\n\n'), refs, sections };
  return cache;
}

const STOP = new Set('the a an and or of to in is it she her my i me with for on at be was are this that what why how do does can should about from have has when there they them their your you not but if so as by'.split(' '));

export function retrieve(query, k = 2) {
  const terms = String(query).toLowerCase().match(/[a-z]{3,}/g)?.filter(t => !STOP.has(t)) || [];
  const scored = corpus().sections.map(s => {
    const hay = (s.heading + ' ' + s.text).toLowerCase();
    let score = 0;
    for (const t of terms) {
      const stem = t.slice(0, 6);
      if (s.heading.toLowerCase().includes(stem)) score += 3;
      score += Math.min(hay.split(stem).length - 1, 4);
    }
    return { ...s, score };
  }).sort((a, b) => b.score - a.score);
  return scored.filter(s => s.score > 0).slice(0, k);
}

// Inline citations are written [n] or [n, m].
export function refsFor(text) {
  const { refs } = corpus();
  const ids = [...new Set([...String(text).matchAll(/\[(\d+(?:\s*,\s*\d+)*)\]/g)].flatMap(m => m[1].split(/\s*,\s*/)))];
  return ids.map(id => ({ id, ...refs[id] })).filter(r => r.url);
}
