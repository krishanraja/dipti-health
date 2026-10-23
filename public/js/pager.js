// No-scroll lists. Items are packed into pages that fit the box exactly and
// turned with the arrows, a swipe, or the arrow keys. The box re-packs when
// its size changes (rotation, a resize, a view becoming visible), so nothing
// ever scrolls and nothing is cut off.
//
//   const pg = pager(box, [{ html, keep }], { onRender(body), label })
//   keep: true keeps a heading on the same page as the item after it.
//   pg.refresh() re-packs after an item changes height; pg.show(i) turns to
//   the page holding item i.
//   pin: true for a box whose height follows its content (a sheet): once it
//   needs pages it is marked .pg-full, which CSS uses to give it all the room
//   its sheet has, so turning a page does not resize it.

const ARROW_L = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
const ARROW_R = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';

export function pager(box, items, { onRender, label = 'Page', start = 0, pin = false } = {}) {
  box.classList.add('pg');
  box.innerHTML = `<div class="pg-body"></div><div class="pg-foot" hidden>
    <button class="nav-arrow" type="button" data-prev aria-label="Previous page">${ARROW_L}</button>
    <span class="pg-n" aria-live="polite"></span>
    <button class="nav-arrow" type="button" data-next aria-label="Next page">${ARROW_R}</button></div>`;
  const body = box.querySelector('.pg-body'), foot = box.querySelector('.pg-foot'), n = box.querySelector('.pg-n');
  let pages = [[...items.keys()]], page = 0, want = start, lastSize = '';

  const node = i => {
    const t = document.createElement('template');
    t.innerHTML = `<div class="pg-item">${items[i].html}</div>`;
    return t.content.firstElementChild;
  };
  const over = () => body.scrollHeight > body.clientHeight + 1;

  function pack() {
    if (pin) box.classList.remove('pg-full');
    if (!body.clientHeight || !items.length) return draw();
    foot.hidden = true;
    body.replaceChildren(...items.map((_, i) => node(i)));
    if (!over()) { pages = [[...items.keys()]]; return draw(); }
    foot.hidden = false;
    if (pin) box.classList.add('pg-full');
    pages = [];
    let cur = [];
    body.replaceChildren();
    items.forEach((_, i) => {
      body.appendChild(node(i));
      cur.push(i);
      if (!over()) return;
      // Move this item, and any heading kept with it, to a new page.
      const move = [cur.pop()];
      while (cur.length && items[cur[cur.length - 1]].keep) move.unshift(cur.pop());
      if (cur.length) pages.push(cur);
      cur = move;
      body.replaceChildren(...cur.map(node));
      // A heading and its item that will not fit together even on their own
      // page: the heading goes first, alone, and the item starts the next.
      if (over() && cur.length > 1) {
        const last = cur.pop();
        pages.push(cur);
        cur = [last];
        body.replaceChildren(node(last));
      }
    });
    if (cur.length) pages.push(cur);
    draw();
  }

  function draw() {
    page = Math.max(0, pages.findIndex(p => p.includes(want)));
    body.replaceChildren(...(pages[page] || []).map(i => {
      const el = node(i);
      if (pages[page].length === 1 && pages.length > 1) el.classList.add('pg-solo');
      return el;
    }));
    // One item alone and still too tall: shrink it a little (down to 70%)
    // before giving up and fading its end.
    body.querySelectorAll('.pg-solo, .pg-item:only-child').forEach(el => {
      for (let z = 0.95; over() && z >= 0.7; z -= 0.05) el.style.zoom = z.toFixed(2);
      if (over()) el.classList.add('pg-over');
    });
    const many = pages.length > 1;
    foot.hidden = !many;
    // Dots for a few pages, words for many.
    n.className = 'pg-n' + (many && pages.length <= 7 ? ' pg-dots' : '');
    n.innerHTML = !many ? '' : pages.length <= 7
      ? pages.map((_, i) => `<i class="${i === page ? 'on' : ''}"></i>`).join('') + `<span class="sr">Page ${page + 1} of ${pages.length}</span>`
      : `${page + 1} of ${pages.length}`;
    foot.querySelector('[data-prev]').disabled = page === 0;
    foot.querySelector('[data-next]').disabled = page >= pages.length - 1;
    box.setAttribute('aria-label', many ? `${label} ${page + 1} of ${pages.length}` : label);
    onRender?.(body, { page, pages: pages.length });
  }

  function turn(d) {
    const p = page + d;
    if (p < 0 || p >= pages.length) return;
    want = pages[p][0];
    body.classList.remove('pg-in-l', 'pg-in-r'); void body.offsetWidth;
    body.classList.add(d > 0 ? 'pg-in-r' : 'pg-in-l');
    draw();
  }
  foot.querySelector('[data-prev]').onclick = () => turn(-1);
  foot.querySelector('[data-next]').onclick = () => turn(1);

  let x0 = null, y0 = 0;
  body.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  body.addEventListener('touchend', e => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
    x0 = null;
    if (Math.abs(dx) > 44 && Math.abs(dx) > Math.abs(dy) * 1.4) turn(dx < 0 ? 1 : -1);
  });
  box.addEventListener('keydown', e => {
    if (e.target.closest('input, textarea, select')) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { turn(1); e.preventDefault(); }
    if (e.key === 'ArrowLeft' || e.key === 'PageUp') { turn(-1); e.preventDefault(); }
  });

  const ro = new ResizeObserver(() => {
    if (!box.isConnected) return ro.disconnect();
    const size = `${box.clientWidth}x${box.clientHeight}`;
    if (size === lastSize) return;
    lastSize = size;
    requestAnimationFrame(pack);
  });
  ro.observe(box);
  document.fonts?.ready.then(() => box.isConnected && pack());
  if (pin) {
    const onResize = () => { if (!box.isConnected) return removeEventListener('resize', onResize); requestAnimationFrame(pack); };
    addEventListener('resize', onResize);
  }

  return {
    refresh: pack,
    show(i) { want = i; draw(); },
    get page() { return page; },
    get pages() { return pages.length; },
    destroy() { ro.disconnect(); },
  };
}

// Turns every [data-pages] element inside `root` into a pager, one item per
// child (data-keep on a heading keeps it with the next child). Wire clicks by
// delegation on an ancestor: items are redrawn on every page turn.
export function autoPages(root, opts = {}) {
  return [...root.querySelectorAll('[data-pages]')].map(el => {
    const items = [...el.children].map(c => ({ html: c.outerHTML, keep: c.hasAttribute('data-keep') }));
    return pager(el, items, { pin: true, label: el.dataset.pages || 'Page', ...opts });
  });
}
