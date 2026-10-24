// Feedback: one tap on what it's like, then say more if she wants to.
// Each send is one row in the Sheet's Feedback tab. The draft stays on this
// device until it is sent.
import { wireMic, MIC } from './today.js';

let ctx, root, sent = false;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const KEY = 'steady.feedbackDraft';
const draft = {
  get() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } },
  set(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* private mode */ } },
  clear() { try { localStorage.removeItem(KEY); } catch { /* private mode */ } },
};

export const CHIPS = ["Something's confusing", "Something's missing", "Something's not right", 'Too much to read', 'Hard to tap or see', 'I like this'];
const PROMPT = {
  "Something's confusing": 'What was confusing, and where?',
  "Something's missing": 'What would you like it to do?',
  "Something's not right": 'What looked wrong?',
  'Too much to read': 'Which screen felt like too much?',
  'Hard to tap or see': 'What was hard to tap or see?',
  'I like this': 'What do you like?',
};

let lastScreen = 'today';
export function mountFeedback(el, context) { root = el; ctx = context; render(); }
export function feedbackFrom(screen) { if (screen && screen !== 'feedback') lastScreen = screen; }

function render() {
  if (!root) return;
  const d = draft.get();
  if (sent) {
    root.innerHTML = `<div class="fb fb-done">
      <div class="fb-tick" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6 12.5l4 4 8-9"/></svg></div>
      <h1>Thank you.</h1><p>Krish reads every one.</p>
      <button class="btn tinted" data-again>Send another</button></div>`;
    root.querySelector('[data-again]').onclick = () => { sent = false; render(); };
    return;
  }
  root.innerHTML = `<div class="fb">
    <div class="hello"><p class="kicker">Help make Steady better</p><h1>What's it like to use?</h1></div>
    ${d.chip ? `<div class="fb-picked"><span class="fb-pill">${esc(d.chip)}</span><button type="button" class="btn quiet" data-change>Change</button></div>`
    : `<div class="fb-chips" role="group" aria-label="Pick one">
      ${CHIPS.map(c => `<button type="button" data-chip="${esc(c)}">${esc(c)}</button>`).join('')}
    </div>`}
    <div class="fb-more" ${d.chip ? '' : 'hidden'}>
      <label for="fbText">${esc(PROMPT[d.chip] || 'Tell me more')} <span class="soft">(optional)</span></label>
      <textarea id="fbText" maxlength="700" placeholder="Say it however it comes out">${esc(d.text || '')}</textarea>
      <div class="row"><button class="micbtn" data-mic aria-pressed="false">${MIC}<span>Speak</span></button><button class="btn primary grow" data-send>Send</button></div>
    </div>
    <p class="fb-hint" ${d.chip ? 'hidden' : ''}>Tap one. You can say more after.</p>
  </div>`;
  const ta = root.querySelector('#fbText');
  // No scrolling: long words shrink a little to stay in the box.
  const fitText = () => { ta.style.fontSize = ''; for (let f = 17; ta.scrollHeight > ta.clientHeight + 1 && f > 12; f--) ta.style.fontSize = f - 1 + 'px'; };
  root.querySelectorAll('[data-chip]').forEach(b => b.onclick = () => {
    navigator.vibrate?.(10);
    draft.set({ ...draft.get(), chip: b.dataset.chip, text: ta.value });
    render();
  });
  root.querySelector('[data-change]')?.addEventListener('click', () => { draft.set({ ...draft.get(), chip: '', text: ta.value }); render(); });
  const keep = () => { draft.set({ ...draft.get(), text: ta.value }); fitText(); };
  ta.oninput = keep; ta.onblur = keep;
  if (d.chip) requestAnimationFrame(fitText);
  wireMic(root.querySelector('[data-mic]'), ta);
  root.querySelector('[data-send]').onclick = async e => {
    const { chip } = draft.get();
    if (!chip) return;
    e.target.disabled = true;
    const r = await ctx.save('feedback', { chip, text: ta.value.trim(), screen: lastScreen });
    if (!r.ok && !r.queued) { e.target.disabled = false; return; }
    draft.clear();
    sent = true;
    render();
    if (!r.ok && r.queued) ctx.toast('Saved. It will send when you are online.');
  };
}
