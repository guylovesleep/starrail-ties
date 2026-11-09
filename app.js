/* Star Rail Ties — data-driven relationship web. */
(() => {
  'use strict';

  const D = window.STARRAIL_TIES;
  if (!D) return;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
  const oneLine = (s) => String(s || '').replace(/\s+/g, ' ').trim();

  const byId = new Map(D.characters.map((c) => [c.id, c]));
  const worldById = new Map(D.worlds.map((w) => [w.id, w]));
  const playable = D.characters.filter((c) => !c.npc);
  const npcIds = new Set(D.characters.filter((c) => c.npc).map((c) => c.id));
  const WORLD_COLOR = {
    express: '#e4c98c', hss: '#79d6e8', jarilo: '#9fc9ea', xianzhou: '#8ad4b1',
    penacony: '#e5a8ca', amphoreus: '#e7c078', planarcadia: '#b7a6f2', cosmos: '#aab8ea'
  };

  const page = $('.ties-page');
  const panel = $('#panel');
  const panelScroll = $('#panelScroll');
  const homeView = $('#homeView');
  const personView = $('#personView');
  const personBody = $('#personBody');
  const nodesEl = $('#nodes');
  const marksEl = $('#marks');
  const dialEl = $('#dial');
  const hubEl = $('#hub');
  const tooltip = $('#tooltip');
  const webCanvas = $('#web');
  const wctx = webCanvas.getContext('2d');
  const sheet = $('#sheet');
  const paper = $('#paper');
  const sheetBody = $('#sheetBody');
  const sheetNames = $('#sheetNames');
  const splashA = $('#splashA');
  const splashB = $('#splashB');
  const convoBtn = $('#convoBtn');
  const toastEl = $('#toast');

  const nodeEls = new Map();
  const worldEls = new Map();
  const positions = {};
  let layout = { R: 0, cx: 0, cy: 0, size: 24, mobile: false, panelW: 0, panelH: 0 };
  let edgeList = [];
  let selected = null;
  let hovered = null;
  let sheetOpen = false;
  let sheetA = null;
  let sheetB = null;
  let lastFocus = null;

  /* ------------------------------------------------------------- indexes */
  const outOf = new Map(D.characters.map((c) => [c.id, new Map()]));
  const inOf = new Map(D.characters.map((c) => [c.id, new Map()]));

  function push(map, key, val) {
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(val);
  }

  D.quotes.forEach((q, i) => {
    q.i = i;
    q.to.forEach((t) => {
      push(outOf.get(q.from), t, q);
      push(inOf.get(t), q.from, q);
    });
  });

  const outCount = (id) => (outOf.get(id) || new Map()).size;
  const inCount = (id) => (inOf.get(id) || new Map()).size;
  const worldName = (id) => (worldById.get(id) || { name: '' }).name;

  // every unordered playable pair with at least one line
  const pairList = [];
  const pairSeen = new Set();
  D.quotes.forEach((q) => {
    q.to.forEach((t) => {
      if (q.from === t || npcIds.has(q.from) || npcIds.has(t)) return;
      const key = q.from < t ? q.from + '|' + t : t + '|' + q.from;
      if (pairSeen.has(key)) return;
      pairSeen.add(key);
      const [a, b] = key.split('|');
      pairList.push({ a, b, key });
    });
  });

  /* ------------------------------------------------------------- helpers */
  function playIcon() { return '<svg class="icon"><use href="#i-play"></use></svg>'; }
  function stopIcon() { return '<svg class="icon"><use href="#i-stop"></use></svg>'; }

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('is-on');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toastEl.classList.remove('is-on'), 2600);
  }

  function setHash(value) {
    try {
      const url = value ? '#' + value : location.pathname + location.search;
      history.replaceState(null, '', url);
    } catch (e) { /* file:// or sandboxed */ }
  }

  function duoFaces(a, b, size) {
    const A = byId.get(a), B = byId.get(b);
    if (!A || !B) return '';
    return `<span class="duo" style="--sz:${size || 28}px">
      <span class="face" style="width:${size || 28}px;height:${size || 28}px"><img src="assets/icons/${A.id}.webp" alt="" loading="lazy"></span>
      <span class="face" style="width:${size || 28}px;height:${size || 28}px"><img src="assets/icons/${B.id}.webp" alt="" loading="lazy"></span>
    </span>`;
  }

  function faceHtml(id, size, ring) {
    const c = byId.get(id);
    if (!c) return '';
    const s = size || 32;
    return `<span class="face" style="width:${s}px;height:${s}px;${ring ? '--ring:' + c.element : ''}"><img src="assets/icons/${c.id}.webp" alt="" loading="lazy"></span>`;
  }

  function plural(n, word) { return `${n} ${word}${n === 1 ? '' : 's'}`; }

  /* ------------------------------------------------------------- background */
  function initStars() {
    const canvas = $('.back');
    const ctx = canvas.getContext('2d');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    let stars = [], w = 0, h = 0, shooting = null, lastShoot = 0;

    function resize() {
      w = innerWidth; h = innerHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round(Math.min(240, (w * h) / 9000));
      stars = Array.from({ length: count }, (_, i) => ({
        x: Math.random() * w, y: Math.random() * h,
        r: Math.random() < .86 ? Math.random() * 1.1 + .2 : Math.random() * 1.7 + .8,
        a: Math.random() * .5 + .18,
        ph: Math.random() * Math.PI * 2,
        sp: .2 + Math.random() * .55,
        drift: (Math.random() - .5) * .05,
        big: i % 37 === 0
      }));
    }

    function draw(t) {
      ctx.clearRect(0, 0, w, h);
      stars.forEach((s) => {
        const alpha = s.a * (.55 + .45 * Math.sin(t * .00045 * s.sp + s.ph));
        ctx.globalAlpha = alpha;
        ctx.fillStyle = s.big ? '#f4e7c6' : '#d8e2f2';
        if (s.big) {
          ctx.shadowColor = 'rgba(244,231,198,.65)';
          ctx.shadowBlur = 9;
        } else {
          ctx.shadowBlur = 0;
        }
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
        s.x += s.drift; s.y += s.drift * .4;
        if (s.x < -4) s.x = w + 4; if (s.x > w + 4) s.x = -4;
        if (s.y < -4) s.y = h + 4; if (s.y > h + 4) s.y = -4;
      });
      ctx.shadowBlur = 0;
      if (!reduced && !shooting && t - lastShoot > 7600 && Math.random() < .012) {
        lastShoot = t;
        shooting = { x: Math.random() * w * .65 + w * .1, y: Math.random() * h * .35, life: 0, len: 90 + Math.random() * 100 };
      }
      if (shooting) {
        shooting.life += .016;
        const p = shooting.life;
        const alpha = Math.max(0, 1 - p / 1.15);
        const x = shooting.x + p * 420, y = shooting.y + p * 250;
        const g = ctx.createLinearGradient(x, y, x - shooting.len, y - shooting.len * .6);
        g.addColorStop(0, `rgba(244,231,198,${alpha * .75})`);
        g.addColorStop(1, 'rgba(244,231,198,0)');
        ctx.strokeStyle = g; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - shooting.len, y - shooting.len * .6); ctx.stroke();
        if (p > 1.15) shooting = null;
      }
      ctx.globalAlpha = 1;
      if (reduced) { requestAnimationFrame(draw); return; }
      requestAnimationFrame(draw);
    }

    resize();
    window.addEventListener('resize', resize);
    if (reduced) { draw(0); } else { requestAnimationFrame(draw); }
  }

  /* ------------------------------------------------------------- layout */
  const mqMobile = matchMedia('(max-width: 899px), (max-aspect-ratio: 11/10)');

  function computeLayout() {
    const vw = innerWidth, vh = innerHeight;
    const mobile = mqMobile.matches;
    const panelRect = panel.getBoundingClientRect();
    const panelW = mobile ? 0 : panelRect.width;
    const panelH = mobile ? panelRect.height : 0;
    const availW = vw - panelW;
    const availH = vh - panelH;
    const cx = panelW + availW / 2;
    const cy = mobile ? availH / 2 : vh / 2;
    const R = Math.max(105, Math.min(availW / 2 - (mobile ? 30 : 96), availH / 2 - (mobile ? 42 : 80)));
    const total = D.characters.length;
    const spacing = (Math.PI * 2 * R) / Math.max(1, total);
    const size = Math.max(mobile ? 10.5 : 17, Math.min(spacing * .86, mobile ? 23 : 32));
    return { vw, vh, mobile, panelW, panelH, availW, availH, cx, cy, R, size, total };
  }

  function scheduleLayout() {
    cancelAnimationFrame(scheduleLayout._raf);
    scheduleLayout._raf = requestAnimationFrame(() => layoutNodes());
  }

  function layoutNodes() {
    layout = computeLayout();
    const { cx, cy, R, total } = layout;
    const gap = total > 70 ? .045 : .07;
    const usable = Math.PI * 2 - gap * D.worlds.length;
    let a0 = -Math.PI / 2;

    D.worlds.forEach((w) => {
      const list = D.characters.filter((c) => c.world === w.id);
      const span = usable * list.length / total;
      w._a0 = a0;
      w._a1 = a0 + span;
      list.forEach((c, i) => {
        const a = a0 + span * ((i + .5) / list.length);
        const r = c.npc ? R * .955 : R;
        positions[c.id] = { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, a, r };
      });
      a0 += span + gap;
    });

    D.characters.forEach((c) => {
      const p = positions[c.id], el = nodeEls.get(c.id);
      if (!p || !el) return;
      const s = c.npc ? layout.size * .74 : layout.size;
      el.style.left = p.x + 'px';
      el.style.top = p.y + 'px';
      el.style.setProperty('--s', s + 'px');
    });

    hubEl.style.left = cx + 'px';
    hubEl.style.top = cy + 'px';

    renderMarks();
    renderDial();
    updateCanvasSize();
    applyState();
  }

  function polar(cx, cy, r, a) { return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; }
  function arcPath(cx, cy, r, a1, a2) {
    const [x1, y1] = polar(cx, cy, r, a1);
    const [x2, y2] = polar(cx, cy, r, a2);
    const large = (a2 - a1) > Math.PI ? 1 : 0;
    return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
  }
  function renderMarks() {
    marksEl.innerHTML = '';
    worldEls.clear();
    const { cx, cy, R, mobile } = layout;
    const placed = [];
    const gap = mobile ? 16 : 28;

    D.worlds.forEach((w) => {
      if (w._a0 == null) return;
      const mid = (w._a0 + w._a1) / 2;
      const cos = Math.cos(mid), sin = Math.sin(mid);
      // Desktop labels sit outside the ring with their outer edge anchored;
      // on narrow screens the same labels open inward so they stay on-screen.
      let ax = mobile
        ? (cos > .32 ? '-100%' : cos < -.32 ? '0%' : '-50%')
        : (cos > .32 ? '0%' : cos < -.32 ? '-100%' : '-50%');
      let ay = ax === '-50%'
        ? (mobile ? (sin < 0 ? '0%' : '-100%') : (sin < 0 ? '-100%' : '0%'))
        : '-50%';
      // At phone widths the horizontal world label on the left would sit under
      // the central wordmark; lift it into the open band above the hub.
      const yShift = mobile && Math.abs(sin) < .22 ? -40 : 0;
      const el = document.createElement('div');
      el.className = 'region';
      el.style.color = WORLD_COLOR[w.id] || 'var(--gold)';
      const compact = !mobile && innerWidth < 1200;
      const label = compact && w.id === 'hss' ? 'Herta Station' : compact && w.id === 'jarilo' ? 'Jarilo' : w.name;
      el.innerHTML = `<svg class="icon"><use href="#i-${w.id}"></use></svg><b>${esc(label)}</b>`;
      marksEl.appendChild(el);

      let lr = R + (mobile ? -24 : 32);
      let box = null;
      for (let attempt = 0; attempt < 8; attempt++) {
        const x = cx + cos * lr;
        const y = cy + sin * lr + yShift;
        const bw = el.offsetWidth, bh = el.offsetHeight;
        const left = ax === '0%' ? x : ax === '-100%' ? x - bw : x - bw / 2;
        const top = ay === '0%' ? y : ay === '-100%' ? y - bh : y - bh / 2;
        box = { left, right: left + bw, top, bottom: top + bh };
        const hit = placed.some((r) => box.left < r.right + 5 && box.right > r.left - 5 && box.top < r.bottom + 3 && box.bottom > r.top - 3);
        if (!hit) break;
        lr += mobile ? -gap : gap;
      }

      el.style.left = (cx + cos * lr) + 'px';
      el.style.top = (cy + sin * lr + yShift) + 'px';
      el.style.transform = `translate(${ax},${ay})`;
      placed.push(box);
      worldEls.set(w.id, el);
    });
  }

  function renderDial() {
    const { cx, cy, R, mobile } = layout;
    const pad = mobile ? 52 : 74;
    const S = (R + pad) * 2;
    const c = S / 2;
    const outer = R + (mobile ? 31 : 45);
    const middle = R + (mobile ? 8 : 14);
    const arcs = D.worlds.map((w) => {
      if (w._a0 == null) return '';
      return `<path d="${arcPath(c, c, outer - 4, w._a0 + .012, Math.max(w._a0 + .013, w._a1 - .012))}"
        fill="none" stroke="${WORLD_COLOR[w.id] || '#d8c08a'}" stroke-width="1.5" stroke-linecap="round" opacity=".5"/>`;
    }).join('');

    dialEl.style.left = cx + 'px';
    dialEl.style.top = cy + 'px';
    dialEl.style.width = S + 'px';
    dialEl.style.height = S + 'px';
    dialEl.innerHTML = `<svg viewBox="0 0 ${S} ${S}" width="${S}" height="${S}">
      <circle cx="${c}" cy="${c}" r="${outer}" fill="none" stroke="rgba(216,192,138,.20)" stroke-width="1"/>
      <circle class="ticks" cx="${c}" cy="${c}" r="${outer}" fill="none" stroke="rgba(236,214,168,.46)" stroke-width="3" stroke-dasharray=".5 7"/>
      <circle cx="${c}" cy="${c}" r="${middle}" fill="none" stroke="rgba(236,214,168,.14)" stroke-width="1" stroke-dasharray="2 6"/>
      <g class="arcs">${arcs}</g>
    </svg>`;
  }

  /* ------------------------------------------------------------- marks / hub */
  function updateHub() {
    const focus = selected || hovered;
    const eyebrow = $('.hub-eyebrow', hubEl);
    const title = $('.hub-title', hubEl);
    const sub = $('.hub-sub', hubEl);
    if (focus && byId.has(focus)) {
      const c = byId.get(focus);
      hubEl.classList.add('is-person');
      eyebrow.textContent = c.npc ? 'NPC · ' + worldName(c.world).toUpperCase() : worldName(c.world).toUpperCase();
      title.textContent = c.name;
      sub.textContent = c.npc
        ? `Talked about by ${inCount(c.id)} characters`
        : `Talks about ${outCount(c.id)} · talked about by ${inCount(c.id)}`;
    } else {
      hubEl.classList.remove('is-person');
      eyebrow.textContent = 'HONKAI: STAR RAIL';
      title.textContent = 'Star Rail Ties';
      sub.textContent = `${D.stats.playable} characters · ${edgeList.length} threads`;
    }
  }

  /* ------------------------------------------------------------- nodes */
  function createNodes() {
    const frag = document.createDocumentFragment();
    D.characters.forEach((c, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'node' + (c.npc ? ' is-npc' : '');
      b.dataset.char = c.id;
      b.style.setProperty('--ring', c.rarity === 5 ? 'rgba(216,192,138,.82)' : c.rarity === 4 ? 'rgba(155,142,196,.78)' : 'rgba(216,192,138,.42)');
      b.style.setProperty('--el', c.element);
      b.style.setProperty('--i', i);
      b.innerHTML = `<span class="node-face"><img src="assets/icons/${c.id}.webp" alt="" loading="lazy" decoding="async" draggable="false"></span><span class="node-name">${esc(c.name)}</span>`;
      b.setAttribute('aria-label', c.npc
        ? `${c.name}, NPC, talked about by ${inCount(c.id)} characters`
        : `${c.name}, ${worldName(c.world)}, talks about ${outCount(c.id)} characters, talked about by ${inCount(c.id)}`);
      b.addEventListener('mouseenter', () => onHover(c.id, b));
      b.addEventListener('focus', () => onHover(c.id, b));
      b.addEventListener('mouseleave', onLeave);
      b.addEventListener('blur', onLeave);
      nodeEls.set(c.id, b);
      frag.appendChild(b);
    });
    nodesEl.appendChild(frag);
  }

  function onHover(id, el) {
    hovered = id;
    applyState();
    showTip(id, el);
  }
  function onLeave() {
    hovered = null;
    tooltip.classList.remove('is-on');
    tooltip.hidden = true;
    applyState();
  }

  function showTip(id, el) {
    if (layout.mobile) return;
    const c = byId.get(id);
    if (!c) return;
    const first = firstQuote(id);
    let html = `<b>${esc(c.name)}</b><small>${c.npc ? 'NPC · ' : ''}${esc(worldName(c.world))}${c.npc ? '' : ' · ' + esc(c.elementName) + ' · ' + esc(c.path)}</small>`;
    html += `<p>${first ? `<em>${esc(first.title)}</em> — ${esc(oneLine(first.text))}` : 'No voice line of their own — only talked about.'}</p>`;
    if (selected && selected !== id) html += `<p class="tip-hint">Click to compare with ${esc(byId.get(selected).name)}</p>`;
    tooltip.innerHTML = html;
    tooltip.hidden = false;
    const rect = el.getBoundingClientRect();
    const tw = 300;
    let x = rect.left + rect.width / 2;
    x = Math.max(tw / 2 + 12, Math.min(innerWidth - tw / 2 - 12, x));
    let y = rect.top;
    const below = y < 150;
    tooltip.classList.toggle('is-below', below);
    tooltip.style.left = x + 'px';
    tooltip.style.top = (below ? rect.bottom + 10 : y - 8) + 'px';
    requestAnimationFrame(() => tooltip.classList.add('is-on'));
  }

  function firstQuote(id) {
    const out = outOf.get(id);
    if (out) {
      for (const arr of out.values()) if (arr.length) return arr[0];
    }
    const inc = inOf.get(id);
    if (inc) {
      for (const arr of inc.values()) if (arr.length) return arr[0];
    }
    return null;
  }

  /* ------------------------------------------------------------- state */
  function linkedSet(id) {
    const s = new Set([id]);
    const out = outOf.get(id), inc = inOf.get(id);
    if (out) out.forEach((_, k) => s.add(k));
    if (inc) inc.forEach((_, k) => s.add(k));
    return s;
  }

  function applyState() {
    const focus = selected || hovered;
    const linked = focus ? linkedSet(focus) : null;
    page.classList.toggle('is-focus', !!selected);
    nodeEls.forEach((el, id) => {
      el.classList.toggle('is-selected', selected === id);
      el.classList.toggle('is-hover', hovered === id);
      el.classList.toggle('is-linked', !!(linked && linked.has(id) && id !== focus));
      el.classList.toggle('is-dim', !!(selected && linked && !linked.has(id)));
    });
    $$('.roster-grid button').forEach((b) => b.classList.toggle('is-sel', b.dataset.char === selected));
    const focusChar = focus && byId.get(focus);
    worldEls.forEach((el, wid) => {
      el.classList.toggle('is-dim', !!(focusChar && focusChar.world !== wid));
      el.classList.toggle('is-hot', !!(focusChar && focusChar.world === wid));
    });
    updateHub();
    drawWeb(performance.now());
  }

  function selectNode(id) {
    if (!byId.has(id)) return;
    if (sheetOpen) {
      const a = sheetA;
      if (a && id !== a) {
        closeSheet(false);
        openPair(a, id);
      } else {
        closeSheet(true);
      }
      return;
    }
    if (selected && selected !== id) {
      openPair(selected, id);
      return;
    }
    if (selected === id) {
      showHome();
      return;
    }
    showPerson(id);
  }

  /* ------------------------------------------------------------- panel: home */
  function renderHome() {
    $('#statPlayable').textContent = D.stats.playable;
    $('#statLines').textContent = D.stats.voiceLines.toLocaleString('en-US');
    $('#statMutual').textContent = D.stats.mutual;
    $('#statOneway').textContent = D.stats.oneway;
    $('#npcNote').innerHTML = `${D.stats.npcs} NPCs also come up ${D.stats.npcMentions} times (dashed threads); they aren’t counted above. The Trailblazer is left out of the headline pair counts — almost everyone has a line about them.`;
    renderHighlights();
    renderRoster();
  }

  function renderHighlights() {
    const box = $('#highlights');
    const H = D.highlights;
    const mostIn = byId.get(H.mostIn.id), mostOut = byId.get(H.mostOut.id);
    const bp = { a: byId.get(H.bestPair.a), b: byId.get(H.bestPair.b) };
    const rows = [];

    if (mostIn) rows.push(`
      <button class="stat" type="button" data-char="${mostIn.id}">
        ${faceHtml(mostIn.id, 34)}
        <span><small>Most talked about</small><b>${esc(mostIn.name)}</b><em>Mentioned by ${inCount(mostIn.id)} characters</em></span>
      </button>`);
    if (mostOut) rows.push(`
      <button class="stat" type="button" data-char="${mostOut.id}">
        ${faceHtml(mostOut.id, 34)}
        <span><small>Talks about the most people</small><b>${esc(mostOut.name)}</b><em>Mentions ${outCount(mostOut.id)} characters</em></span>
      </button>`);
    if (bp.a && bp.b) rows.push(`
      <button class="stat" type="button" data-pair="${bp.a.id}|${bp.b.id}">
        ${duoFaces(bp.a.id, bp.b.id, 30)}
        <span><small>Most to say about each other</small><b>${esc(bp.a.name)} <span class="swap">⇄</span> ${esc(bp.b.name)}</b><em>${H.bestPair.aCount} lines one way, ${H.bestPair.bCount} back</em></span>
      </button>`);
    if (H.oneSided && H.oneSided.length) {
      rows.push(`<div class="stat is-list"><small>Most one-sided</small>${H.oneSided.map((p) => {
        const A = byId.get(p.a), B = byId.get(p.b);
        if (!A || !B) return '';
        return `<button type="button" data-pair="${A.id}|${B.id}">
          ${duoFaces(A.id, B.id, 24)}
          <b>${esc(A.name)} → ${esc(B.name)}</b>
          <em>${plural(p.count, 'line')}</em>
        </button>`;
      }).join('')}</div>`);
    }
    if (H.offWeb && H.offWeb.length) {
      const c = byId.get(H.offWeb[0]);
      if (c) rows.push(`
        <button class="stat" type="button" data-char="${c.id}">
          ${faceHtml(c.id, 34)}
          <span><small>Off the web</small><b>${esc(c.name)}</b><em>Talks about no one, and no one talks about them.</em></span>
        </button>`);
    }
    box.innerHTML = rows.join('');
  }

  function renderRoster() {
    const body = $('#rosterBody');
    const frag = document.createDocumentFragment();
    D.worlds.forEach((w) => {
      const list = D.characters.filter((c) => c.world === w.id && !c.npc);
      if (!list.length) return;
      const sec = document.createElement('section');
      const h = document.createElement('h4');
      h.textContent = w.name;
      const grid = document.createElement('div');
      grid.className = 'roster-grid';
      list.forEach((c) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.dataset.char = c.id;
        b.title = c.name;
        b.setAttribute('aria-label', `${c.name}, ${w.name}`);
        b.innerHTML = `<span class="face"><img src="assets/icons/${c.id}.webp" alt="" loading="lazy" decoding="async"></span><span>${esc(c.name)}</span>`;
        grid.appendChild(b);
      });
      sec.append(h, grid);
      frag.appendChild(sec);
    });
    body.innerHTML = '';
    body.appendChild(frag);
  }

  /* ------------------------------------------------------------- panel: person */
  function showPerson(id) {
    const c = byId.get(id);
    if (!c) return;
    selected = id;
    hovered = null;
    homeView.hidden = true;
    personView.hidden = false;
    renderPerson(id);
    panelScroll.scrollTop = 0;
    applyState();
    setHash(c.id);
  }

  function showHome() {
    selected = null;
    hovered = null;
    homeView.hidden = false;
    personView.hidden = true;
    panelScroll.scrollTop = 0;
    tooltip.classList.remove('is-on');
    tooltip.hidden = true;
    applyState();
    setHash('');
  }

  function renderPerson(id) {
    const c = byId.get(id);
    if (!c) return;
    const out = outOf.get(id) || new Map();
    const inc = inOf.get(id) || new Map();
    const mutual = [], onlyOut = [], onlyIn = [];
    out.forEach((_, k) => { if (inc.has(k)) mutual.push(k); else onlyOut.push(k); });
    inc.forEach((_, k) => { if (!out.has(k)) onlyIn.push(k); });

    const total = (k) => ((out.get(k) || []).length + (inc.get(k) || []).length);
    mutual.sort((a, b) => total(b) - total(a) || byId.get(a).name.localeCompare(byId.get(b).name));
    onlyOut.sort((a, b) => (out.get(b).length - out.get(a).length) || byId.get(a).name.localeCompare(byId.get(b).name));
    onlyIn.sort((a, b) => (inc.get(b).length - inc.get(a).length) || byId.get(a).name.localeCompare(byId.get(b).name));

    let html = `
      <div class="person-head">
        <span class="face" style="--ring:${c.element}"><img src="assets/icons/${c.id}.webp" alt=""></span>
        <div class="person-title">
          <h2>${esc(c.name)}</h2>
          <div class="person-meta"><i style="--el:${c.element}"></i>${esc(worldName(c.world))}${c.npc ? ' · NPC' : ' · ' + esc(c.elementName) + ' · ' + esc(c.path)}</div>
        </div>
      </div>`;

    if (c.npc) {
      html += `<p class="person-count">Nobody hears an NPC’s side: <b>${esc(c.name)}</b> is only talked about, by <b>${inc.size}</b> characters.</p>`;
      html += `<p class="person-hint">Pick one of them to read what they say.</p>`;
    } else {
      html += `<p class="person-count"><b>${esc(c.name)}</b> talks about <b>${out.size}</b> characters, talked about by <b>${inc.size}</b> characters.</p>`;
      html += `<p class="person-hint">Pick a second character to read what they and ${esc(c.name)} say about each other.</p>`;
    }

    if (mutual.length) {
      html += `<section class="person-group"><h3>Both ways <i>${mutual.length}</i></h3><div class="person-rows">`;
      html += mutual.map((pid, i) => rowHtml(pid, out.get(pid), inc.get(pid), 'both', i)).join('');
      html += `</div></section>`;
    }
    if (onlyOut.length) {
      html += `<section class="person-group"><h3>One way, from ${esc(c.name)} <i>${onlyOut.length}</i></h3><div class="person-rows">`;
      html += onlyOut.map((pid, i) => rowHtml(pid, out.get(pid), null, 'out', i)).join('');
      html += `</div></section>`;
    }
    if (onlyIn.length) {
      html += `<section class="person-group"><h3>One way, about ${esc(c.name)} <i>${onlyIn.length}</i></h3><div class="person-rows">`;
      html += onlyIn.map((pid, i) => rowHtml(pid, null, inc.get(pid), 'in', i)).join('');
      html += `</div></section>`;
    }
    if (!mutual.length && !onlyOut.length && !onlyIn.length) {
      html += `<p class="person-empty">No threads yet. ${esc(c.name)} hasn’t been mentioned in the archive — and has no lines about anyone else.</p>`;
    }
    personBody.innerHTML = html;
  }

  function rowHtml(pid, outQuotes, inQuotes, mode, i) {
    const p = byId.get(pid);
    if (!p) return '';
    const primary = mode === 'in' ? inQuotes : outQuotes;
    const q = primary && primary[0];
    const counts = mode === 'both'
      ? `${outQuotes.length} <span class="swap">⇄</span> ${inQuotes.length}`
      : plural(primary ? primary.length : 0, 'line');
    const label = mode === 'in'
      ? `Play ${p.name}'s line about ${byId.get(selected).name}`
      : `Play ${byId.get(selected).name}'s line about ${p.name}`;
    const play = q && q.audio
      ? `<button class="row-play" type="button" data-play="${q.i}" aria-label="${esc(label)}" aria-pressed="false">${playIcon()}</button>`
      : '';
    return `<div class="row" style="--i:${i}">
      <button class="row-main" type="button" data-char="${p.id}" aria-label="Read ${esc(p.name)}">
        <span class="face"><img src="assets/icons/${p.id}.webp" alt="" loading="lazy"></span>
        <span class="row-body">
          <span class="row-head"><b>${esc(p.name)}</b><small>${q ? esc(q.title) : ''}</small><i>${counts}</i></span>
          <span class="row-line">${q ? esc(oneLine(q.text)) : 'No line between them yet.'}</span>
        </span>
      </button>
      ${play}
    </div>`;
  }

  /* ------------------------------------------------------------- pair sheet */
  function openPair(a, b) {
    if (!byId.has(a) || !byId.has(b) || a === b) return;
    if (!sheetOpen) lastFocus = document.activeElement;
    sheetA = a; sheetB = b;
    selected = a;
    hovered = null;
    sheetOpen = true;
    renderSheet();
    if (sheet.hidden) {
      sheet.hidden = false;
      sheet.classList.remove('is-closing');
      paper.focus({ preventScroll: true });
    }
    sheetBody.scrollTop = 0;
    applyState();
    setHash(a + '+' + b);
  }

  function renderSheet() {
    const A = byId.get(sheetA), B = byId.get(sheetB);
    if (!A || !B) return;
    const aOnB = (outOf.get(A.id).get(B.id) || []);
    const bOnA = (outOf.get(B.id).get(A.id) || []);
    const shared = [];
    (outOf.get(A.id) || new Map()).forEach((arr, k) => {
      if (k === B.id || npcIds.has(k)) return;
      if (outOf.get(B.id).has(k)) shared.push({ id: k, n: arr.length + outOf.get(B.id).get(k).length });
    });
    shared.sort((x, y) => y.n - x.n || byId.get(x.id).name.localeCompare(byId.get(y.id).name));

    splashA.src = `assets/splash/${A.id}.webp`;
    splashB.src = `assets/splash/${B.id}.webp`;
    splashA.onload = () => splashA.classList.add('is-in');
    splashB.onload = () => splashB.classList.add('is-in');
    splashA.onerror = () => { splashA.onerror = null; splashA.src = `assets/icons/${A.id}.webp`; };
    splashB.onerror = () => { splashB.onerror = null; splashB.src = `assets/icons/${B.id}.webp`; };
    splashA.alt = '';
    splashB.alt = '';

    $('#seats').innerHTML = `<span class="seat"><span class="face" style="--ring:${A.element}"><img src="assets/icons/${A.id}.webp" alt=""></span></span><span class="seat"><span class="face" style="--ring:${B.element}"><img src="assets/icons/${B.id}.webp" alt=""></span></span>`;
    $('#nameA').textContent = A.name;
    $('#nameB').textContent = B.name;

    const col = (from, to, quotes) => {
      const body = quotes.length
        ? quotes.map((q) => letterHtml(q)).join('')
        : `<div class="never"><p>${from.npc ? 'No lines of their own.' : 'Nothing yet.'}</p><small>${from.npc
            ? `${esc(from.name)} is an NPC, so the archive only has what others say about them.`
            : `${esc(from.name)} hasn’t said anything about ${esc(to.name)} in the archive.`}</small></div>`;
      return `<section class="col">
        <span class="col-mark"><svg class="icon"><use href="#i-${from.world}"></use></svg></span>
        <h3>${from.npc ? `${esc(from.name)} · NPC` : `${esc(from.name)} on ${esc(to.name)}`}</h3>
        ${body}
      </section>`;
    };

    let html = `<div class="spread">${col(A, B, aOnB)}${col(B, A, bOnA)}</div>`;
    if (shared.length) {
      html += `<div class="shared"><h4>Both also talk about</h4><div>${shared.slice(0, 12).map((s) => {
        const c = byId.get(s.id);
        return `<button type="button" data-char="${c.id}" aria-label="${esc(c.name)}"><span class="face"><img src="assets/icons/${c.id}.webp" alt="" loading="lazy"></span><span>${esc(c.name)}</span></button>`;
      }).join('')}</div></div>`;
    }
    html += `<p class="paper-source">Voice lines from the in-game character archive, via the Honkai: Star Rail Wiki.</p>`;
    sheetBody.innerHTML = html;

    const audible = aOnB.some((q) => q.audio) || bOnA.some((q) => q.audio);
    convoBtn.hidden = !audible;
    resetConvoButton();
    resetSingle();
  }

  function letterHtml(q) {
    return `<article class="letter" data-qi="${q.i}">
      <h4><span>${esc(q.title)}${q.form ? `<span class="form">as ${esc(q.form)}</span>` : ''}</span>
        ${q.audio ? `<button class="voice" type="button" data-play="${q.i}" aria-label="Play this line" aria-pressed="false">${playIcon()}</button>` : ''}
      </h4>
      <p>${esc(q.text)}</p>
    </article>`;
  }

  function closeSheet(returnToPerson) {
    if (!sheetOpen) return;
    stopEverything();
    sheetOpen = false;
    sheet.classList.add('is-closing');
    const sx = sheetA, sy = sheetB;
    sheetA = sheetB = null;
    const done = () => {
      sheet.hidden = true;
      sheet.classList.remove('is-closing');
      splashA.classList.remove('is-in');
      splashB.classList.remove('is-in');
    };
    setTimeout(done, 220);
    if (returnToPerson && selected) {
      showPerson(selected);
    } else {
      setHash('');
      applyState();
    }
    if (lastFocus && lastFocus.focus) {
      try { lastFocus.focus({ preventScroll: true }); } catch (e) {}
    }
    if (!returnToPerson && selected && sx && sy) {
      // keep the first reader selected while another pair is chosen
      applyState();
    }
  }

  function pairKey(a, b) { return a < b ? a + '|' + b : b + '|' + a; }

  function randomPair(excludeKey) {
    if (!pairList.length) return null;
    for (let i = 0; i < 24; i++) {
      const p = pairList[Math.floor(Math.random() * pairList.length)];
      if (p.key !== excludeKey) return p;
    }
    return pairList[0];
  }

  function openRandomPair() {
    const p = randomPair(sheetOpen ? pairKey(sheetA, sheetB) : null);
    if (p) openPair(p.a, p.b);
  }

  /* ------------------------------------------------------------- audio */
  const audioEl = new Audio();
  audioEl.preload = 'none';
  let audioMode = null;       // 'single' | 'convo' | null
  let audioQuote = null;
  let convo = { list: [], idx: 0, playing: false, a: null, b: null };
  let convoFails = 0;

  function resetSingle() {
    audioMode = null;
    audioQuote = null;
    $$('.row-play, .voice').forEach((b) => {
      b.setAttribute('aria-pressed', 'false');
      b.innerHTML = playIcon();
    });
    $$('.letter.is-playing').forEach((el) => el.classList.remove('is-playing'));
  }

  function stopEverything() {
    audioEl.pause();
    try { audioEl.removeAttribute('src'); audioEl.load(); } catch (e) {}
    resetSingle();
    stopConvo();
  }

  function playSingle(qi, btn) {
    const q = D.quotes[qi];
    if (!q || !q.audio) { toast('That voice line isn’t in the archive yet.'); return; }
    stopConvo();
    const wasSame = audioMode === 'single' && audioQuote === qi && !audioEl.paused;
    resetSingle();
    if (wasSame) return;
    audioMode = 'single';
    audioQuote = qi;
    audioEl.src = q.audio;
    $$(`[data-play="${qi}"]`).forEach((b) => {
      b.setAttribute('aria-pressed', 'true');
      b.innerHTML = stopIcon();
    });
    const art = document.querySelector(`.letter[data-qi="${qi}"]`);
    if (art) art.classList.add('is-playing');
    audioEl.play().catch(() => {
      toast('That voice line isn’t available right now.');
      resetSingle();
    });
  }

  function startConvo() {
    if (convo.playing) { stopConvo(); return; }
    const A = byId.get(sheetA), B = byId.get(sheetB);
    if (!A || !B) return;
    const list = [];
    (outOf.get(A.id).get(B.id) || []).forEach((q) => { if (q.audio) list.push(q); });
    (outOf.get(B.id).get(A.id) || []).forEach((q) => { if (q.audio) list.push(q); });
    if (!list.length) { toast('No audio for this pair yet.'); return; }
    stopEverything();
    convo = { list, idx: 0, playing: true, a: A.id, b: B.id };
    convoFails = 0;
    convoBtn.setAttribute('aria-pressed', 'true');
    convoBtn.innerHTML = stopIcon() + ' Stop the conversation';
    playConvoNext();
  }

  function playConvoNext() {
    if (!convo.playing) return;
    if (convo.idx >= convo.list.length) { stopConvo(); return; }
    const q = convo.list[convo.idx];
    const art = document.querySelector(`.letter[data-qi="${q.i}"]`);
    $$('.letter.is-playing').forEach((el) => el.classList.remove('is-playing'));
    if (art) art.classList.add('is-playing');
    audioMode = 'convo';
    audioEl.src = q.audio;
    audioEl.play().catch(() => {
      convoFails++;
      if (convoFails > 4) { stopConvo(); toast('The audio for this pair isn’t available right now.'); return; }
      convo.idx++;
      playConvoNext();
    });
  }

  function stopConvo() {
    if (convo.playing) {
      convo.playing = false;
      audioEl.pause();
    }
    convo = { list: [], idx: 0, playing: false, a: null, b: null };
    resetConvoButton();
    $$('.letter.is-playing').forEach((el) => el.classList.remove('is-playing'));
  }

  function resetConvoButton() {
    if (!convoBtn) return;
    convoBtn.setAttribute('aria-pressed', 'false');
    convoBtn.innerHTML = '<svg class="icon"><use href="#i-volume"></use></svg> Hear them as a conversation';
  }

  audioEl.addEventListener('ended', () => {
    if (audioMode === 'convo' && convo.playing) {
      convo.idx++;
      playConvoNext();
    } else {
      resetSingle();
    }
  });
  audioEl.addEventListener('error', () => {
    if (audioMode === 'convo' && convo.playing) {
      convoFails++;
      if (convoFails > 4) { stopConvo(); toast('The audio for this pair isn’t available right now.'); return; }
      convo.idx++;
      playConvoNext();
    } else if (audioMode === 'single') {
      toast('That voice line isn’t available right now.');
      resetSingle();
    }
  });

  /* ------------------------------------------------------------- web canvas */
  let lastWebDraw = 0;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function updateCanvasSize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    webCanvas.width = Math.round(innerWidth * dpr);
    webCanvas.height = Math.round(innerHeight * dpr);
    webCanvas.style.width = innerWidth + 'px';
    webCanvas.style.height = innerHeight + 'px';
    wctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function buildEdges() {
    const seen = new Map();
    D.quotes.forEach((q) => {
      q.to.forEach((t) => {
        const key = q.from + '|' + t;
        if (!seen.has(key)) seen.set(key, { a: q.from, b: t, mutual: false, npc: npcIds.has(q.from) || npcIds.has(t) });
      });
    });
    const dir = seen;
    edgeList = Array.from(seen.values());
    edgeList.forEach((e) => {
      e.mutual = dir.has(e.b + '|' + e.a);
      e.curve = (hash(e.a + e.b) % 2 ? 1 : -1);
    });
  }

  function hash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
    return Math.abs(h);
  }

  function edgePoint(e, t) {
    const p1 = positions[e.a], p2 = positions[e.b];
    if (!p1 || !p2) return null;
    const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
    const dx = p2.x - p1.x, dy = p2.y - p1.y;
    const len = Math.hypot(dx, dy) || 1;
    const off = Math.min(26, len * .075) * (e.curve || 1);
    const cx = mx - dy / len * off;
    const cy = my + dx / len * off;
    const mt = 1 - t;
    return {
      x: mt * mt * p1.x + 2 * mt * t * cx + t * t * p2.x,
      y: mt * mt * p1.y + 2 * mt * t * cy + t * t * p2.y,
      cx, cy
    };
  }

  function drawWeb(now) {
    if (!layout.R || !Object.keys(positions).length) return;
    if (!reducedMotion && now - lastWebDraw < 30) return;
    lastWebDraw = now;
    const { vw, vh } = layout;
    wctx.clearRect(0, 0, vw, vh);
    const focus = selected || hovered;
    const activeEdges = [];

    edgeList.forEach((e) => {
      const p1 = positions[e.a], p2 = positions[e.b];
      if (!p1 || !p2) return;
      const active = focus && (e.a === focus || e.b === focus);
      if (active) activeEdges.push(e);
      const mid = edgePoint(e, .5);
      if (!mid) return;
      wctx.beginPath();
      wctx.moveTo(p1.x, p1.y);
      wctx.quadraticCurveTo(mid.cx, mid.cy, p2.x, p2.y);
      if (active) {
        const mobile = layout.mobile;
        wctx.strokeStyle = e.npc
          ? `rgba(244,231,198,${mobile ? .46 : .62})`
          : `rgba(244,231,198,${mobile ? .58 : .78})`;
        wctx.lineWidth = mobile ? .9 : (e.mutual ? 1.35 : 1.05);
        wctx.setLineDash(e.npc ? [2, 4] : []);
        wctx.shadowColor = 'rgba(216,192,138,.55)';
        wctx.shadowBlur = mobile ? 3 : 7;
      } else {
        const base = focus ? (e.mutual ? .035 : .024) : (e.mutual ? .115 : .075);
        wctx.strokeStyle = `rgba(216,192,138,${base})`;
        wctx.lineWidth = 1;
        wctx.setLineDash(e.npc ? [2, 4] : []);
        wctx.shadowBlur = 0;
      }
      wctx.stroke();
    });
    wctx.setLineDash([]);
    wctx.shadowBlur = 0;

    if (focus && !reducedMotion && activeEdges.length) {
      const t0 = (now / 2400) % 1;
      activeEdges.slice(0, 48).forEach((e, i) => {
        const outgoing = e.a === focus;
        const t = (t0 + i * .113) % 1;
        const pt = edgePoint(e, outgoing ? t : 1 - t);
        if (!pt) return;
        wctx.beginPath();
        wctx.arc(pt.x, pt.y, outgoing ? 1.7 : 1.35, 0, Math.PI * 2);
        wctx.fillStyle = outgoing ? 'rgba(244,231,198,.95)' : 'rgba(150,214,232,.9)';
        wctx.shadowColor = outgoing ? 'rgba(244,231,198,.9)' : 'rgba(150,214,232,.8)';
        wctx.shadowBlur = 8;
        wctx.fill();
      });
      wctx.shadowBlur = 0;
    }
  }

  function webLoop(now) {
    drawWeb(now);
    requestAnimationFrame(webLoop);
  }

  /* ------------------------------------------------------------- search */
  function setupSearch(input, list, onPick) {
    const wrap = input.closest('.search');
    const clear = wrap.querySelector('.search-clear');
    let active = -1, items = [];

    function hide() {
      list.hidden = true;
      active = -1;
      input.setAttribute('aria-expanded', 'false');
    }
    function render() {
      const q = input.value.trim().toLowerCase();
      clear.hidden = !q;
      if (!q) { hide(); return; }
      const matches = D.characters.filter((c) => {
        const names = [c.name, ...(c.aliases || [])].map((x) => x.toLowerCase());
        return names.some((n) => n.includes(q));
      }).sort((a, b) => {
        const an = a.name.toLowerCase(), bn = b.name.toLowerCase();
        const as = an.startsWith(q) ? 0 : 1, bs = bn.startsWith(q) ? 0 : 1;
        return as - bs || an.localeCompare(bn);
      }).slice(0, 9);
      items = matches;
      active = matches.length ? 0 : -1;
      if (!matches.length) {
        list.innerHTML = `<p>No one by that name.</p>`;
      } else {
        list.innerHTML = matches.map((c, i) => {
          const aka = (c.aliases || []).find((a) => a.toLowerCase() !== c.name.toLowerCase() && a.toLowerCase().includes(q));
          const sub = c.npc ? 'NPC · ' + worldName(c.world) : worldName(c.world);
          return `<button type="button" data-char="${c.id}" class="${i === active ? 'is-at' : ''}">
            ${faceHtml(c.id, 28)}
            <b>${esc(c.name)}</b>
            <small>${aka ? 'aka ' + esc(aka) : esc(sub)}</small>
          </button>`;
        }).join('');
      }
      list.hidden = false;
      input.setAttribute('aria-expanded', 'true');
    }
    function move(dir) {
      if (!items.length) return;
      active = (active + dir + items.length) % items.length;
      $$('button', list).forEach((b, i) => b.classList.toggle('is-at', i === active));
      const el = $$('button', list)[active];
      if (el) el.scrollIntoView({ block: 'nearest' });
    }
    function pick(id) {
      input.value = '';
      clear.hidden = true;
      hide();
      input.blur();
      onPick(id);
    }

    input.addEventListener('input', render);
    input.addEventListener('focus', () => { if (input.value.trim()) render(); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        if (items[active]) pick(items[active].id);
      } else if (e.key === 'Escape') { e.preventDefault(); hide(); input.blur(); }
    });
    clear.addEventListener('click', () => { input.value = ''; clear.hidden = true; hide(); input.focus(); });
    list.addEventListener('click', (e) => {
      const b = e.target.closest('[data-char]');
      if (b) pick(b.dataset.char);
    });
    input.addEventListener('blur', () => setTimeout(hide, 160));
  }

  /* ------------------------------------------------------------- events */
  function bind() {
    document.addEventListener('click', (e) => {
      const play = e.target.closest('[data-play]');
      if (play) {
        e.preventDefault(); e.stopPropagation();
        playSingle(Number(play.dataset.play), play);
        return;
      }
      const pair = e.target.closest('[data-pair]');
      if (pair) {
        e.preventDefault(); e.stopPropagation();
        const [a, b] = pair.dataset.pair.split('|');
        openPair(a, b);
        return;
      }
      const ch = e.target.closest('[data-char]');
      if (ch) {
        e.preventDefault(); e.stopPropagation();
        selectNode(ch.dataset.char);
        return;
      }
      if (sheetOpen) return;
      if (e.target.closest('.panel,.corner,.tooltip,.sheet')) return;
      if (selected) showHome();
    }, true);

    $('#backHome').addEventListener('click', showHome);
    $('#randomPair').addEventListener('click', openRandomPair);
    $('#sheetBack').addEventListener('click', () => closeSheet(true));
    $('#scrim').addEventListener('click', () => closeSheet(true));
    $('#anotherPair').addEventListener('click', () => {
      const p = randomPair(pairKey(sheetA, sheetB));
      if (p) openPair(p.a, p.b);
    });
    convoBtn.addEventListener('click', startConvo);
    paper.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); closeSheet(true); }
    });
    sheet.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); closeSheet(true); }
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (sheetOpen) { closeSheet(true); return; }
        if (!personView.hidden) { showHome(); return; }
        tooltip.classList.remove('is-on');
      }
      if (e.key === '/' && !/input|textarea|select/i.test(document.activeElement.tagName)) {
        e.preventDefault();
        (personView.hidden ? $('#homeSearch') : $('#personSearch')).focus();
      }
      if (sheetOpen && e.key === 'Tab') {
        const focusables = $$('button,[href],[tabindex]:not([tabindex="-1"])', paper)
          .filter((el) => !el.hidden && el.offsetParent !== null);
        if (!focusables.length) return;
        const first = focusables[0], last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });

    window.addEventListener('resize', scheduleLayout);
    window.addEventListener('orientationchange', () => setTimeout(scheduleLayout, 120));
    if (mqMobile.addEventListener) mqMobile.addEventListener('change', scheduleLayout);

    setupSearch($('#homeSearch'), $('#homeSearchList'), (id) => showPerson(id));
    setupSearch($('#personSearch'), $('#personSearchList'), (id) => {
      if (selected && selected !== id) openPair(selected, id);
      else showPerson(id);
    });

    window.addEventListener('hashchange', () => {
      if (sheetOpen) return;
      const h = decodeURIComponent(location.hash.slice(1));
      if (!h) return;
      if (h.includes('+')) {
        const [a, b] = h.split('+');
        if (byId.has(a) && byId.has(b)) openPair(a, b);
      } else if (byId.has(h)) {
        showPerson(h);
      }
    });
  }

  /* ------------------------------------------------------------- boot */
  function boot() {
    buildEdges();
    renderHome();
    createNodes();
    bind();
    layoutNodes();
    initStars();
    applyState();

    if (document.fonts && document.fonts.ready) document.fonts.ready.then(scheduleLayout);
    requestAnimationFrame(() => page.classList.add('is-ready'));
    requestAnimationFrame(webLoop);

    const h = decodeURIComponent(location.hash.slice(1));
    if (h) {
      if (h.includes('+')) {
        const [a, b] = h.split('+');
        if (byId.has(a) && byId.has(b)) openPair(a, b);
      } else if (byId.has(h)) {
        showPerson(h);
      }
    }
  }

  boot();
})();
