// The doctor's face in the chat: a young English GP drawn as an SVG with
// separate parts so she can blink, listen, think and talk. States are CSS
// classes on the wrapper: idle | listening | thinking | speaking | happy.
// (Part class names keep the lf- prefix the shared chat styles animate.)
let uid = 0;

export function avatarSvg() {
  const id = 'dr' + (++uid);
  return `<svg viewBox="0 0 120 120" role="img" aria-label="The doctor" focusable="false">
  <defs>
    <clipPath id="${id}c"><circle cx="60" cy="60" r="60"/></clipPath>
    <radialGradient id="${id}g" cx="50%" cy="30%" r="80%"><stop offset="0" class="lf-bg1"/><stop offset="1" class="lf-bg2"/></radialGradient>
  </defs>
  <g clip-path="url(#${id}c)">
    <rect width="120" height="120" fill="url(#${id}g)"/>
    <g class="lf-body">
      <path d="M33 70c-6 14-6 30-2 44h58c4-14 4-30-2-44z" fill="#6b4630"/>
      <path d="M12 124C14 103 33 93 60 93s46 10 48 31z" fill="#f7f8fa"/>
      <path d="M50 93.5 60 108l10-14.5c-3-.8-6.5-1.2-10-1.2s-7 .4-10 1.2z" fill="#4f8fb8"/>
      <path d="M44 95l-6 26M76 95l6 26" stroke="#d8dde3" stroke-width="2" fill="none"/>
      <path d="M47 96c-3 8-1 15 5 18M73 96c3 8 1 15-5 18" stroke="#2f3a46" stroke-width="2.4" fill="none" stroke-linecap="round"/>
      <circle cx="60" cy="115" r="4.4" fill="#c9d1da" stroke="#5b6672" stroke-width="1.4"/>
      <rect x="80" y="104" width="12" height="3.2" rx="1.6" fill="#0b7a6d"/>
    </g>
    <g class="lf-head">
      <rect x="52" y="80" width="16" height="15" rx="6" fill="#efc2a3"/>
      <path d="M31 60c-3-20 8-34 29-34s32 14 29 34c-1 6-3 11-4 14l-3-22H38l-3 22c-1-3-3-8-4-14z" fill="#6b4630"/>
      <ellipse cx="34" cy="62" rx="4.2" ry="6.4" fill="#e8b393"/>
      <ellipse cx="86" cy="62" rx="4.2" ry="6.4" fill="#e8b393"/>
      <circle cx="34" cy="68.5" r="1.6" fill="#e6d3a1"/><circle cx="86" cy="68.5" r="1.6" fill="#e6d3a1"/>
      <ellipse cx="60" cy="61" rx="25" ry="27.5" fill="#f6cfb2"/>
      <circle cx="45" cy="70" r="5.2" fill="#f29a8a" opacity=".32"/><circle cx="75" cy="70" r="5.2" fill="#f29a8a" opacity=".32"/>
      <path d="M35 52c3-13 13-19 25-19 9 0 17 3 22 10-6-1-12 1-17 5-5-4-12-5-18-3-5 1-9 4-12 7z" fill="#7a5238"/>
      <g class="lf-brows" stroke="#6b4630" stroke-width="2.6" stroke-linecap="round" fill="none">
        <path class="lf-brow-l" d="M42 51c3.5-2.4 8-2.6 11.5-1.2"/>
        <path class="lf-brow-r" d="M66.5 49.8c3.5-1.4 8-1.2 11.5 1.2"/>
      </g>
      <g class="lf-pupils">
        <g class="lf-eye"><ellipse cx="48" cy="58.5" rx="3" ry="3.5" fill="#2d3b4a"/><circle cx="49.1" cy="57.3" r="1" fill="#fff"/></g>
        <g class="lf-eye"><ellipse cx="72" cy="58.5" rx="3" ry="3.5" fill="#2d3b4a"/><circle cx="73.1" cy="57.3" r="1" fill="#fff"/></g>
      </g>
      <path d="M44.5 54.6l-2.2-1.3M75.5 54.6l2.2-1.3" stroke="#6b4630" stroke-width="1" stroke-linecap="round"/>
      <path d="M59 60c-.6 3.6-1.5 6.4-2.6 8.4-.9 1.8.2 3.4 2.2 3.6 1 .1 2 .1 2.8 0 2-.2 3.1-1.8 2.2-3.6" stroke="#dba487" stroke-width="1.4" fill="none" stroke-linecap="round"/>
      <g class="lf-mouth">
        <path class="lf-smile" d="M53.5 78c3.4 3 9.6 3 13 0" stroke="#b3524a" stroke-width="1.9" fill="none" stroke-linecap="round"/>
        <g class="lf-open"><path d="M53.5 77.2c1.5 6 11.5 6 13 0-3.5 1.1-9.5 1.1-13 0z" fill="#8a3532"/><ellipse cx="60" cy="80.8" rx="3.4" ry="1.3" fill="#e07a6e"/></g>
      </g>
      <g class="lf-stache"></g>
    </g>
  </g>
</svg>`;
}

// One avatar on screen. set(state) changes what she is doing; speak() keeps
// her mouth moving while words arrive, then settles back.
export function createAvatar(el) {
  el.classList.add('leffy');
  el.innerHTML = avatarSvg();
  let state = 'idle', quiet = 0, happyT = 0;
  const apply = s => { el.classList.remove('idle', 'listening', 'thinking', 'speaking', 'happy'); el.classList.add(s); };
  apply('idle');
  return {
    get state() { return state; },
    set(s) { clearTimeout(quiet); clearTimeout(happyT); state = s; apply(s); },
    // Call on each chunk of text: she talks, and stops 700 ms after the last one.
    speak() {
      clearTimeout(quiet);
      if (state !== 'speaking') { state = 'speaking'; apply('speaking'); }
      quiet = setTimeout(() => this.done(), 700);
    },
    done() { clearTimeout(quiet); state = 'happy'; apply('happy'); happyT = setTimeout(() => { state = 'idle'; apply('idle'); }, 1400); },
  };
}
