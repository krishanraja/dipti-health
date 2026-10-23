// One grounded answer from Claude, with live web search and fetch limited to
// trusted medical sources. Uses a direct Anthropic key when set, otherwise the
// Vercel AI Gateway authenticated by the deployment's OIDC token.
import Anthropic from '@anthropic-ai/sdk';

// Trusted sources only: Indian and UK health bodies, guideline societies,
// regulators and journals.
export const TRUSTED_DOMAINS = [
  'nhs.uk', 'nice.org.uk', 'sdcep.org.uk', 'endocrinology.org', 'endocrine.org', 'ese-hormones.org', 'bnf.nice.org.uk',
  'medicines.org.uk', 'gov.uk', 'aae.org', 'ada.org', 'mouthhealthy.org', 'bda.org', 'ida.org.in', 'ies.org.in',
  'icmr.gov.in', 'mohfw.gov.in', 'cdsco.gov.in', 'aiims.edu', 'aasld.org', 'easl.eu', 'rheumatology.org', 'versusarthritis.org',
  'bsg.org.uk', 'britishlivertrust.org.uk', 'fda.gov', 'ema.europa.eu', 'nih.gov', 'medlineplus.gov', 'mayoclinic.org',
  'clevelandclinic.org', 'cochranelibrary.com', 'bmj.com', 'thelancet.com', 'nejm.org', 'jamanetwork.com',
  'academic.oup.com', 'springer.com', 'wiley.com', 'nature.com', 'sciencedirect.com',
];

const DIRECT_MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-5-5';
const GATEWAY_MODEL = process.env.AI_GATEWAY_MODEL || 'anthropic/claude-opus-5.5';

function gatewayToken(req) {
  return process.env.AI_GATEWAY_API_KEY || req?.headers?.['x-vercel-oidc-token'] || process.env.VERCEL_OIDC_TOKEN;
}

export function aiProvider(req) {
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
  return gatewayToken(req) ? 'gateway' : null;
}

function client(req) {
  if (process.env.ANTHROPIC_API_KEY) return { c: new Anthropic({ timeout: 150000, maxRetries: 1 }), model: DIRECT_MODEL };
  return { c: new Anthropic({ apiKey: gatewayToken(req), baseURL: 'https://ai-gateway.vercel.sh', timeout: 150000, maxRetries: 1 }), model: GATEWAY_MODEL };
}

// Tool sets from richest to plainest. If the route rejects one, try the next.
const TOOLSETS = [
  { name: 'search+fetch', tools: [
    { type: 'web_search_20260209', name: 'web_search', max_uses: 4, allowed_domains: TRUSTED_DOMAINS, user_location: { type: 'approximate', city: 'Pune', region: 'Maharashtra', country: 'IN', timezone: 'Asia/Kolkata' } },
    { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 3, allowed_domains: TRUSTED_DOMAINS },
  ] },
  { name: 'search', tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 4, allowed_domains: TRUSTED_DOMAINS }] },
  { name: 'none', tools: [] },
];

// Collect every URL the model actually saw from search or fetch.
function seenSources(content, into) {
  for (const b of content) {
    if (b.type === 'web_search_tool_result' && Array.isArray(b.content)) {
      for (const r of b.content) if (r.url) into.set(r.url, r.title || r.url);
    }
    if (b.type === 'web_fetch_tool_result' && b.content && b.content.url) {
      into.set(b.content.url, b.content.content?.title || b.content.url);
    }
  }
}

// user: a string, or content blocks (text plus an image). onText(delta) gets
// the answer text as it is written; a new text block starts with onText(null).
export async function complete({ system, user, req, onProgress = () => {}, onText = () => {}, web = true, effort = 'medium', maxTokens = 16000 }) {
  // Local runs and UI tests only: the dev server installs a scripted model.
  if (globalThis.__mockComplete) return globalThis.__mockComplete({ system, user, onProgress, onText, web });
  if (!aiProvider(req)) { const e = new Error('no AI provider configured'); e.code = 'NO_AI'; throw e; }
  const { c, model } = client(req);
  let lastErr;
  for (const set of web ? TOOLSETS : TOOLSETS.slice(-1)) {
    try {
      const messages = [{ role: 'user', content: user }];
      const sources = new Map();
      let res, searches = 0;
      // Server tools can pause a long turn; resume it, at most three times.
      for (let i = 0; i < 4; i++) {
        // Stream so progress (searches, pages read) can be shown as it happens.
        const stream = c.messages.stream({
          model, max_tokens: maxTokens,
          system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
          output_config: { effort },
          ...(set.tools.length ? { tools: set.tools } : {}),
          messages,
        });
        stream.on('streamEvent', ev => {
          if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') { onText(ev.delta.text); return; }
          if (ev.type !== 'content_block_start') return;
          const b = ev.content_block;
          if (b.type === 'server_tool_use') onProgress({ kind: b.name === 'web_fetch' ? 'fetch' : 'search' });
          else if (b.type === 'web_search_tool_result') onProgress({ kind: 'results', n: Array.isArray(b.content) ? b.content.length : 0 });
          else if (b.type === 'web_fetch_tool_result') onProgress({ kind: 'read' });
          else if (b.type === 'text') { onText(null); onProgress({ kind: 'writing' }); }
        });
        res = await stream.finalMessage();
        seenSources(res.content, sources);
        searches += res.content.filter(b => b.type === 'server_tool_use').length;
        if (res.stop_reason !== 'pause_turn') break;
        messages.push({ role: 'assistant', content: res.content });
      }
      if (res.stop_reason === 'refusal') { const e = new Error('model declined'); e.code = 'REFUSAL'; throw e; }
      // The answer is the text after the last tool result.
      let lastTool = -1;
      res.content.forEach((b, i) => { if (/_tool_result$|server_tool_use/.test(b.type)) lastTool = i; });
      const text = res.content.slice(lastTool + 1).filter(b => b.type === 'text').map(b => b.text).join('');
      console.log(JSON.stringify({ ai: aiProvider(req), tools: set.name, stop: res.stop_reason, searches, sources: sources.size, textLen: text.length, usage: res.usage }));
      return { text, model, tools: set.name, sources: [...sources].map(([url, title]) => ({ url, title })) };
    } catch (e) {
      lastErr = e;
      // Only a rejected request shape is worth retrying with a plainer tool set.
      if (!(e instanceof Anthropic.BadRequestError)) throw e;
      console.error(JSON.stringify({ aiToolsetRejected: set.name, message: String(e.message).slice(0, 200) }));
    }
  }
  throw lastErr;
}
