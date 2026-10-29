/* ==========================================================================
   FKD Deck Engine — JS
   Responsabilidades: escala do palco, navegação, passos (builds), entradas
   animadas (WAAPI + springs), transições entre slides (View Transitions API
   com elementos compartilhados via data-vt), parallax inverso do grafismo,
   ajuste automático de texto (data-fit), notas, modo impressão e relatório
   de overflow para o script de render.
   ========================================================================== */
(function fkdDeck() {
  'use strict';
  if (document.currentScript && document.currentScript.src) window.__fkdDeckSrc = document.currentScript.src;
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', fkdDeck); return; }
  if (window.FKDDeck && window.FKDDeck.slides) return;
  const DECK_SRC = window.__fkdDeckSrc || (window.FKDBoot ? window.FKDBoot.base + 'fkd-deck.js' : '');

  /* ---------- Springs → linear() ---------------------------------------- */
  // Gera uma string linear(...) a partir de um sistema massa-mola amortecido.
  function springEasing({ mass = 1, stiffness = 170, damping = 20, steps = 40, duration = 1 } = {}) {
    const w0 = Math.sqrt(stiffness / mass);
    const zeta = damping / (2 * Math.sqrt(stiffness * mass));
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * duration;
      let x;
      if (zeta < 1) {
        const wd = w0 * Math.sqrt(1 - zeta * zeta);
        x = 1 - Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + (zeta * w0 / wd) * Math.sin(wd * t));
      } else {
        x = 1 - Math.exp(-w0 * t) * (1 + w0 * t);
      }
      pts.push(x.toFixed(4));
    }
    pts[pts.length - 1] = '1';
    return `linear(${pts.join(', ')})`;
  }
  const EASE = {
    soft: springEasing({ stiffness: 120, damping: 14, duration: 1.4 }),
    snappy: springEasing({ stiffness: 260, damping: 24, duration: 0.9 }),
    gentle: springEasing({ stiffness: 90, damping: 18, duration: 1.6 }),
    organic: springEasing({ stiffness: 95, damping: 11, duration: 1.8 }),   // chega, passa um pouco, assenta devagar
    settle: 'cubic-bezier(0.22, 1, 0.36, 1)',                                  // chega rápido, sem passar
    expo: 'cubic-bezier(0.16, 1, 0.3, 1)',
    inout: 'cubic-bezier(0.76, 0, 0.24, 1)',
  };

  /* ---------- Estado ---------------------------------------------------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const params = new URLSearchParams(location.search);
  const hashMode = (location.hash.match(/^#(check|print|pdf)$/) || [])[1];
  const MODE = window.FKD_MODE || hashMode || (window.name === 'fkd-check' ? 'check' : window.name === 'fkd-print' ? 'print' : window.name === 'fkd-pdf' ? 'pdf' : params.has('check') ? 'check' : params.has('pdf') ? 'pdf' : params.has('print') ? 'print' : '');
  const isCheck = MODE === 'check';
  const isPrint = isCheck || MODE === 'print' || MODE === 'pdf';
  const embedded = window.self !== window.top;                       // preview do Canvas, player, overlay
  const canNavigate = /^(https?|file):$/.test(location.protocol) && !embedded;  // pode trocar ?check=1 na URL
  const ENGINE_BASE = DECK_SRC.replace(/[^/]*$/, '');
  const PLAYER_URL = 'https://fkd-creators.github.io/fkd-deck-engine/apresentar.html';
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  snapshotSource(); normalizeMarkup();
  const stage = $('.stage');
  const deck = $('.deck');
  const slides = $$('.slide', deck);
  let index = 0;
  let stepIndex = -1; // -1 = nenhum passo revelado
  let busy = false;

  /* ---------- Fonte do deck (HTML original) ------------------------------ */
  // O carregador (fkd-boot.js) guarda o HTML antes de o engine mexer no DOM. Sem ele, reconstrói.
  function snapshotSource() {
    if (window.FKD_SOURCE) return;
    const c = document.documentElement.cloneNode(true);
    $$('#fkd-symbols, #fkd-symbols-extra, #fkd-chrome, link[rel="preload"]', c).forEach((n) => n.remove());
    window.FKD_SOURCE = '<!doctype html>\n' + c.outerHTML + '\n';
  }

  /* ---------- Marcação tolerante ---------------------------------------- */
  // O modelo às vezes erra nomes que têm correspondência direta no sistema. Corrige o que dá;
  // o que não tem equivalente continua como está (e aparece no relatório de verificação).
  function normalizeMarkup() {
    const ALIAS = { 'deck-stage': 'stage', 'area-header': 'area-head', 'area-footer': 'area-foot', 'area-title': 'area-head', 'area-source': 'area-foot', 'area-content': 'area-main', 'area-body': 'area-main',
    't-eyebrow': 'eyebrow has-line', 't-title': 't-h2', 't-subtitle': 't-lead', 't-caption': 't-small', 't-text': 't-body', 'slide-notes': 'notes', 'speaker-notes': 'notes', 'presenter-notes': 'notes',
    'stat-value': 't-stat', 'stat-subvalue': 't-stat', 'stat-sublabel': 'stat-label', 'stat-unit': 'unit', 'step-chip': 'num-chip', 'step-num': 'num-chip', 'step-number': 'num-chip', 'card-title': 't-h4', 'card-text': 't-small', 'source': 't-source', 'notes-text': 'notes' };
    Object.keys(ALIAS).forEach((bad) => { $$('.' + bad).forEach((el) => { el.classList.remove(bad); ALIAS[bad].split(' ').forEach((c) => el.classList.add(c)); }); });
    $$('[data-fit-max-height]').forEach((el) => { if (!el.style.maxHeight) el.style.maxHeight = parseInt(el.dataset.fitMaxHeight, 10) + 'px'; });
    $$('[data-fit-max-width]').forEach((el) => { if (!el.style.maxWidth) el.style.maxWidth = parseInt(el.dataset.fitMaxWidth, 10) + 'px'; });
    let deckEl = $('.deck');
    if (!deckEl) { const first = $('section.slide'); if (!first) return; deckEl = document.createElement('div'); deckEl.className = 'deck'; deckEl.dataset.grafismo = '3 loop'; first.parentNode.insertBefore(deckEl, first); $$('section.slide').forEach((s) => deckEl.appendChild(s)); }
    if (!deckEl.closest('.stage')) { const st = document.createElement('div'); st.className = 'stage'; deckEl.parentNode.insertBefore(st, deckEl); st.appendChild(deckEl); }
    $$('.slide', deckEl).forEach((sl) => {
      Array.from(sl.classList).forEach((c) => { if (/^l-r\d+$/i.test(c)) { sl.classList.remove(c); sl.dataset.recipe = sl.dataset.recipe || c.slice(2).toUpperCase(); } });
      if ($(':scope > .content', sl)) return;
      const content = document.createElement('div'); content.className = 'content';
      Array.from(sl.children).forEach((ch) => { if (ch.matches('.under, .aperture, .notes, .chrome, .grafismo, template, script, style')) return; content.appendChild(ch); });
      const notes = $(':scope > .notes', sl);
      if (notes) sl.insertBefore(content, notes); else sl.appendChild(content);
      sl.dataset.normalized = 'content';
    });
  }

  /* ---------- Escala do palco ------------------------------------------- */
  function fitStage() {
    if (isPrint) return;
    const s = Math.min(innerWidth / 1920, innerHeight / 1080);
    document.documentElement.style.setProperty('--stage-scale', s.toFixed(4));
  }

  /* ---------- Numeração e chrome dinâmico ------------------------------- */
  // Grafismo: .deck[data-grafismo] dá o padrão do deck (número + flags); cada slide pode trocar
  // o número ("3 loop") ou só as flags ("faint") ou desligar ("none"). Regra: um grafismo por
  // camada (o slide nunca tem dois sobrepostos); variar ao longo do deck é desejável.
  const deckGraf = (deck && deck.dataset.grafismo || '').trim().split(/\s+/).filter(Boolean);
  const deckGrafNum = deckGraf.find((t) => /^\d$/.test(t)) || null;
  function grafismoSpec(sl) {
    const own = (sl.dataset.grafismo || '').trim().split(/\s+/).filter(Boolean);
    if (own.includes('none')) return null;
    if (!own.length && !deckGraf.length) return null;
    const num = own.find((t) => /^\d$/.test(t)) || deckGrafNum || '5';
    const flags = own.filter((t) => !/^\d$/.test(t));
    const base = flags.length ? flags : deckGraf.filter((t) => !/^\d$/.test(t));
    return { num, flags: base };
  }
  // Bandas de refração: 4 blocos horizontais irregulares, cada um com fase, duração e direção próprias
  const BANDS = [
    { top: 0, bottom: 76, dir: 0.7, dur: '33s', phase: '-5s' },
    { top: 24, bottom: 46, dir: -1, dur: '41s', phase: '-13s' },
    { top: 54, bottom: 22, dir: 0.85, dur: '37s', phase: '-21s' },
    { top: 78, bottom: 0, dir: -1.2, dur: '47s', phase: '-8s' },
  ];
  function buildGrafismo(sl, spec, target) {
    const div = document.createElement('div');
    div.className = 'grafismo ' + spec.flags.filter((f) => f !== 'moire').map((f) => 'is-' + f).join(' ');
    div.dataset.g = spec.num;
    const use = `<svg viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice"><use href="#grafismo-${spec.num}"/></svg>`;
    if (isPrint || reduceMotion || spec.flags.includes('flat')) div.innerHTML = use;
    else div.innerHTML = BANDS.map((b) => `<div class="band" style="--b-top:${b.top}%;--b-bottom:${b.bottom}%;--dir:${b.dir};--dur:${b.dur};--phase:${b.phase}">${use}</div>`).join('');
    (target || sl).prepend(div);
  }
  const DEFAULT_CHROME = '<div class="chrome"><div class="logo"><svg viewBox="0 0 747 225"><use href="#fkd-logo"/></svg></div>'
    + '<svg class="badge" viewBox="0 0 500 519.22"><use href="#fkd-stamp"/></svg>'
    + '<div class="footer"><span>@fkdcreators</span><span class="num"></span><span>fkdcreators.com.br</span></div></div>';
  function numberSlides() {
    let chromeTpl = $('#fkd-chrome');
    if (!chromeTpl) { chromeTpl = document.createElement('template'); chromeTpl.id = 'fkd-chrome'; chromeTpl.innerHTML = DEFAULT_CHROME; document.body.appendChild(chromeTpl); }
    slides.forEach((sl, i) => {
      sl.dataset.index = String(i);
      const spec = grafismoSpec(sl);
      if (spec && !$('.grafismo', sl)) buildGrafismo(sl, spec);
      // camada de baixo com grafismo próprio (aparece pelos recortes)
      $$('.under[data-grafismo]', sl).forEach((u) => { if (!$('.grafismo', u)) { const t = u.dataset.grafismo.split(/\s+/).filter(Boolean); buildGrafismo(sl, { num: t.find((x) => /^\d$/.test(x)) || deckGrafNum || (spec && spec.num) || '5', flags: t.filter((x) => !/^\d$/.test(x)) }, u); } });
      if ($('.aperture', sl)) sl.classList.add('has-aperture');
      // chrome automático (logo, badge, rodapé, número) a partir de <template id="fkd-chrome">
      if (chromeTpl && !$('.chrome', sl) && sl.dataset.chrome !== 'none') sl.appendChild(chromeTpl.content.cloneNode(true));
      const n = $('.chrome .num', sl);
      if (n) n.textContent = String(i + 1).padStart(2, '0') + ' / ' + String(slides.length).padStart(2, '0');
      // stamp avulso: <div class="stamp" data-stamp></div> recebe um clone do badge
      const badge = chromeTpl && $('.badge', chromeTpl.content);
      $$('[data-stamp]', sl).forEach((st) => { if (!st.children.length && badge) { const c = badge.cloneNode(true); c.classList.remove('badge'); c.removeAttribute('class'); st.appendChild(c); } });
    });
  }

  /* ---------- Ícones Mage sob demanda ----------------------------------- */
  function ensureIcons() {
    const hrefs = $$('use').map((u) => u.getAttribute('href') || u.getAttribute('xlink:href'));
    const missing = [...new Set(hrefs.filter((h) => h && h.startsWith('#mg-') && !document.getElementById(h.slice(1))))];
    if (!missing.length) return;
    const add = () => {
      const all = window.FKD_MAGE_ICONS || {};
      let host = document.getElementById('fkd-symbols-extra');
      if (!host) { host = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); host.id = 'fkd-symbols-extra'; host.setAttribute('width', '0'); host.setAttribute('height', '0'); host.setAttribute('aria-hidden', 'true'); host.style.position = 'absolute'; document.body.prepend(host); }
      missing.forEach((h) => { const n = h.slice(4); const ic = all[n]; if (!ic) { console.warn('[FKD] ícone Mage inexistente: ' + n + ' (veja references/icones.md)'); return; }
        host.insertAdjacentHTML('beforeend', '<symbol id="mg-' + n + '" viewBox="0 0 ' + (ic.w || 24) + ' ' + (ic.h || 24) + '">' + ic.b + '</symbol>'); });
    };
    if (window.FKD_MAGE_ICONS) return add();
    const s = document.createElement('script'); s.src = ENGINE_BASE + 'fkd-icons.js'; s.onload = add; s.onerror = () => console.warn('[FKD] fkd-icons.js não encontrado em ' + ENGINE_BASE); document.head.appendChild(s);
  }

  /* ---------- Placeholder de foto quando a pasta img/ não existe (engine remoto) --------- */
  function fallbackPlaceholders() {
    $$('img').forEach((img) => {
      const src = img.getAttribute('src') || '';
      if (!/placeholder-retrato\.svg$/.test(src) || img.dataset.fallback) return;
      const swap = () => { if (img.dataset.fallback) return; img.dataset.fallback = '1'; img.src = ENGINE_BASE + '../img/placeholder-retrato.svg'; };
      if (img.complete && img.naturalWidth === 0) swap(); else img.addEventListener('error', swap, { once: true });
    });
  }

  /* ---------- Passos (builds) ------------------------------------------- */
  function stepsOf(slide) {
    return $$('[data-step]', slide).sort((a, b) => (+a.dataset.step || 0) - (+b.dataset.step || 0));
  }
  function showStep(el, animate = true) {
    el.classList.add('is-shown');
    // anima o próprio passo e os filhos com data-in
    const targets = el.matches('[data-in]') ? [el, ...$$('[data-in]', el)] : $$('[data-in]', el);
    if (targets.length === 0) targets.push(el);
    playEntrances(targets, animate);
  }

  /* ---------- Entradas animadas ----------------------------------------- */
  const PRESETS = {
    fade:  { from: { opacity: 0 }, to: { opacity: 1 } },
    up:    { from: { opacity: 0, transform: 'translateY(48px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
    down:  { from: { opacity: 0, transform: 'translateY(-48px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
    left:  { from: { opacity: 0, transform: 'translateX(-64px)' }, to: { opacity: 1, transform: 'translateX(0)' } },
    right: { from: { opacity: 0, transform: 'translateX(64px)' }, to: { opacity: 1, transform: 'translateX(0)' } },
    scale: { from: { opacity: 0, transform: 'scale(.86)' }, to: { opacity: 1, transform: 'scale(1)' } },
    pop:   { from: { opacity: 0, transform: 'scale(.6)' }, to: { opacity: 1, transform: 'scale(1)' } },
    clip:  { from: { opacity: 1, clipPath: 'inset(0 0 100% 0)' }, to: { opacity: 1, clipPath: 'inset(0 0 0 0)' } },
    wipe:  { from: { opacity: 1, clipPath: 'inset(0 100% 0 0)' }, to: { opacity: 1, clipPath: 'inset(0 0 0 0)' } },
    grow:  { from: { opacity: 1, transform: 'scaleY(0)' }, to: { opacity: 1, transform: 'scaleY(1)' } },
    growx: { from: { opacity: 1, transform: 'scaleX(0)' }, to: { opacity: 1, transform: 'scaleX(1)' } },
    blur:  { from: { opacity: 0, filter: 'blur(18px)' }, to: { opacity: 1, filter: 'blur(0)' } },
    rise:  { from: { opacity: 0, transform: 'translateY(120px) scale(.98)' }, to: { opacity: 1, transform: 'translateY(0) scale(1)' } },
    // orgânicos
    bloom: { from: { opacity: 0, transform: 'scale(.72) rotate(-2deg)', filter: 'blur(14px)' }, to: { opacity: 1, transform: 'scale(1) rotate(0deg)', filter: 'blur(0)' } },
    swing: { from: { opacity: 0, transform: 'rotate(-5deg) translateY(30px)' }, to: { opacity: 1, transform: 'rotate(0deg) translateY(0)' } },
    unfold:{ from: { opacity: 0, transform: 'perspective(1600px) rotateX(-58deg) translateY(40px)' }, to: { opacity: 1, transform: 'perspective(1600px) rotateX(0deg) translateY(0)' } },
    float: { from: { opacity: 0, transform: 'translateY(40px) scale(.96)' }, to: { opacity: 1, transform: 'translateY(0) scale(1)' } },
    iris:  { from: { opacity: 1, clipPath: 'circle(0% at 50% 50%)' }, to: { opacity: 1, clipPath: 'circle(75% at 50% 50%)' } },
    tilt:  { from: { opacity: 0, transform: 'perspective(1800px) rotateY(-24deg) translateX(-60px)' }, to: { opacity: 1, transform: 'perspective(1800px) rotateY(0deg) translateX(0)' } },
  };
  const ORGANIC = new Set(['bloom', 'swing', 'float', 'tilt', 'rise', 'pop']);
  function playEntrances(els, animate = true) {
    let stagger = 0;
    els.forEach((el) => {
      const preset = PRESETS[el.dataset.in] || PRESETS.fade;
      if (!animate || reduceMotion || isPrint || document.body.classList.contains('no-anim')) {
        el.style.opacity = '1'; el.style.transform = 'none'; el.style.clipPath = 'none'; el.style.filter = 'none';
        return;
      }
      const dur = +(el.dataset.dur || 900);
      const delay = el.dataset.delay != null ? +el.dataset.delay : stagger;
      const easing = EASE[el.dataset.ease] || (el.dataset.in === 'clip' || el.dataset.in === 'wipe' || el.dataset.in === 'iris' ? EASE.expo : ORGANIC.has(el.dataset.in) ? EASE.organic : EASE.soft);
      if (el.dataset.in === 'grow') el.style.transformOrigin = el.style.transformOrigin || 'bottom';
      if (el.dataset.in === 'swing') el.style.transformOrigin = el.style.transformOrigin || 'top left';
      if (el.dataset.in === 'unfold') el.style.transformOrigin = el.style.transformOrigin || 'top center';
      if (el.dataset.in === 'growx') el.style.transformOrigin = el.style.transformOrigin || 'left';
      el.style.opacity = ''; // deixa o WAAPI mandar
      const anim = el.animate([preset.from, preset.to], { duration: dur, delay, easing, fill: 'both', composite: 'add' });
      // no fim, só a opacidade fica inline (o resto volta ao CSS: um .device.is-angled mantém o ângulo)
      anim.onfinish = () => { el.style.opacity = '1'; anim.cancel(); };
      stagger += +(el.closest('[data-stagger]')?.dataset.stagger ?? 90);
    });
  }
  function resetEntrances(slide) {
    $$('[data-in]', slide).forEach((el) => {
      el.getAnimations().forEach((a) => a.cancel());
      el.style.opacity = ''; el.style.transform = ''; el.style.clipPath = ''; el.style.filter = '';
    });
    $$('[data-step]', slide).forEach((el) => el.classList.remove('is-shown'));
  }

  /* ---------- Colunas vazias e caixas da mesma altura ------------------- */
  const BOX = '.card, .panel, .kpi, .compare-col, .post, .profile, .chat';
  function fitLayouts(slide) {
    const content = $('.content', slide); if (!content) return;
    const m = slide.className.match(/\bl-(head-cols|cols)-(\d)\b/);
    if (m) {
      const N = +m[2];
      const kids = [...content.children].filter((c) => !c.matches('.area-head, .area-foot, .notes') && getComputedStyle(c).display !== 'none');
      const k = kids.length;
      if (k && k < N) {   // menos filhos que colunas: reduz o grid, o conjunto fica centrado
        const letters = 'abcdef'.slice(0, k).split('');
        content.style.gridTemplateColumns = `repeat(${k}, 1fr)`;
        content.style.gridTemplateAreas = (m[1] === 'head-cols' ? `"${letters.map(() => 'head').join(' ')}" ` : '') + `"${letters.join(' ')}"` + (m[1] === 'head-cols' ? ` "${letters.map(() => 'foot').join(' ')}"` : '');
        kids.forEach((c, i) => { c.style.gridArea = letters[i]; });
      }
    }
    const boxes = [...content.children].filter((c) => c.matches(BOX));
    if (boxes.length > 1) { boxes.forEach((b) => { b.style.minHeight = ''; }); const h = Math.max(...boxes.map((b) => b.offsetHeight)); boxes.forEach((b) => { b.style.minHeight = h + 'px'; }); }
  }

  /* ---------- Ajuste de texto (data-fit) -------------------------------- */
  function fitAll(slide) {
    fitLayouts(slide);
    $$('[data-fit]', slide).forEach((el) => {
      const min = +(el.dataset.fitMin || 0.7);
      let scale = 1;
      el.style.setProperty('--fit', '1');
      const tol = Math.max(6, (parseFloat(getComputedStyle(el).fontSize) || 16) * 0.3 * (+(el.style.getPropertyValue('--fit')) || 1));
      const overflows = () => el.scrollHeight > el.clientHeight + tol || el.scrollWidth > el.clientWidth + 2;
      let guard = 40;
      while (overflows() && scale > min && guard--) {
        scale = +(scale - 0.02).toFixed(2);
        el.style.setProperty('--fit', String(scale));
      }
      el.dataset.fitScale = String(scale);
      el.dataset.fitOverflow = overflows() ? '1' : '0';
    });
  }

  /* ---------- Relatório para o script de render ------------------------- */
  const KNOWN_LAYOUTS = ['l-agenda', 'l-chart', 'l-chart-side', 'l-closing', 'l-cols-2', 'l-cols-3', 'l-cols-4', 'l-cols-5', 'l-compare', 'l-contact', 'l-cover', 'l-cover-split', 'l-free', 'l-grid-2x2', 'l-head-cols-3', 'l-head-cols-4', 'l-head-grid-2x2', 'l-head-grid-2x3', 'l-head-split', 'l-idle', 'l-photo-band', 'l-photo-bg', 'l-photo-left', 'l-photo-right', 'l-process', 'l-quote', 'l-quote-photo', 'l-section', 'l-split-30-70', 'l-split-40-60', 'l-split-50', 'l-split-60-40', 'l-stat-hero', 'l-stat-row', 'l-statement', 'l-table', 'l-team', 'l-timeline', 'l-title-lead', 'l-title-only'];
  function report(slide = slides[index]) {
    const deckRect = deck.getBoundingClientRect();
    const scale = deckRect.width / 1920;
    const issues = [];
    const content = $('.content', slide) || slide;
    $$('*', content).forEach((el) => {
      if (el.closest('.notes') || el.matches('svg *') || el.closest('[data-allow-overflow]')) return;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return;
      const ov = cs.overflow;
      const hOver = el.scrollHeight - el.clientHeight;
      const wOver = el.scrollWidth - el.clientWidth;
      const fs = parseFloat(cs.fontSize) || 16;
      // overshoot de glifo com line-height apertado não é overflow; conectores (::before) de 24px também não
      if ((hOver > Math.max(24, fs * 0.35) || wOver > 30) && el.clientHeight > 0) {
        issues.push({ type: 'overflow', el: describe(el), extraHeight: Math.round(hOver), extraWidth: Math.round(wOver), clipped: ov !== 'visible' });
      }
      const r = el.getBoundingClientRect();
      if (r.width > 0 && (r.right > deckRect.right + 1 || r.bottom > deckRect.bottom + 1 || r.left < deckRect.left - 1 || r.top < deckRect.top - 1)) {
        issues.push({ type: 'out-of-bounds', el: describe(el), right: Math.round((r.right - deckRect.right) / scale), bottom: Math.round((r.bottom - deckRect.bottom) / scale) });
      }
    });
    $$('[data-fit]', slide).forEach((el) => {
      if (el.dataset.fitScale && +el.dataset.fitScale < 0.85) issues.push({ type: 'fit-shrunk', el: describe(el), scale: +el.dataset.fitScale, overflow: el.dataset.fitOverflow === '1' });
    });
    $$('img', slide).forEach((img) => { if (!img.complete || img.naturalWidth === 0) issues.push({ type: 'image-missing', el: describe(img), src: img.getAttribute('src') }); });
    // dois grafismos sobrepostos na mesma camada (fora de .under) é erro
    const sheet = $$(':scope > .grafismo', slide);
    if (sheet.length > 1) issues.push({ type: 'grafismo-duplo', el: describe(sheet[1]), hint: 'um grafismo por camada; para outra textura use .under + .aperture' });
    // conteúdo fora da moldura (área entre o chrome superior e o rodapé, dentro das margens)
    if (content !== slide) {
      const cs2 = getComputedStyle(content), cr = content.getBoundingClientRect();
      const frame = { left: cr.left + parseFloat(cs2.paddingLeft), right: cr.right - parseFloat(cs2.paddingRight), top: cr.top + parseFloat(cs2.paddingTop), bottom: cr.bottom - parseFloat(cs2.paddingBottom) };
      $$(':scope > *', content).forEach((el) => {
        if (el.closest('[data-allow-overflow]') || el.matches('.notes')) return;
        const r = el.getBoundingClientRect(); if (!r.width) return;
        const over = { top: Math.round((frame.top - r.top) / scale), bottom: Math.round((r.bottom - frame.bottom) / scale), left: Math.round((frame.left - r.left) / scale), right: Math.round((r.right - frame.right) / scale) };
        const bad = Object.entries(over).filter(([, v]) => v > 4);
        if (bad.length) issues.push({ type: 'outside-frame', el: describe(el), ...Object.fromEntries(bad), hint: 'o conteúdo precisa ficar entre o chrome e o rodapé: reduza (zoom .z-80, is-s) ou divida' });
      });
    }
    const layout = (slide.className.match(/\bl-[\w-]+/) || [''])[0];
    if (!layout) issues.push({ type: 'layout-missing', el: 'section', hint: 'use uma estrutura l-* do catálogo (l-stat-hero, l-chart, l-head-cols-3…)' });
    else if (!KNOWN_LAYOUTS.includes(layout)) issues.push({ type: 'layout-unknown', el: layout, hint: 'estrutura inexistente; use uma do catálogo' });
    if (slide.dataset.normalized) issues.push({ type: 'content-missing', el: 'section', hint: 'faltava <div class="content"> envolvendo o conteúdo (o engine criou um)' });
    if (!slide.dataset.theme) issues.push({ type: 'theme-missing', el: 'section', hint: 'faltou data-theme' });
    return { slide: index + 1, id: slide.id || null, theme: slide.dataset.theme, layout, recipe: slide.dataset.recipe || null, issues };
  }
  function describe(el) {
    const cls = (el.className && typeof el.className === 'string') ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : '';
    const txt = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 48);
    return `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${cls}${txt ? ' “' + txt + '”' : ''}`;
  }

  /* ---------- Transições ------------------------------------------------ */
  function setSharedNames(slide, on) {
    $$('[data-vt]', slide).forEach((el) => { el.style.viewTransitionName = on ? el.dataset.vt : 'none'; });
  }
  function activate(target, dir) {
    const from = slides[index];
    const to = slides[target];
    // o slide de destino decide a transição; "auto" respeita a direção
    let t = to.dataset.transition || deck.dataset.transition || 'fade';
    if (t === 'auto') t = dir < 0 ? 'slide-back' : 'slide';
    if (t === 'slide' && dir < 0) t = 'slide-back';
    document.documentElement.dataset.transition = reduceMotion ? 'fade' : t;

    const swap = () => {
      setSharedNames(from, false);
      from.classList.remove('is-active');
      resetEntrances(from); clearFocus(from);
      to.classList.add('is-active');
      index = target; stepIndex = -1;
      setSharedNames(to, true);
      fitAll(to);
      $$('.chart', to).forEach((c) => window.FKDCharts && window.FKDCharts.render(c));
      updateUrl(); updateProgress(); updateNotes();
    };
    const afterSwap = () => {
      playEntrances($$('[data-in]', to).filter((el) => !el.closest('[data-step]')), true);
      // passos com data-step="0" aparecem junto com o slide
      stepsOf(to).filter((s) => s.dataset.step === '0').forEach((s) => showStep(s, true));
      busy = false;
    };

    if (document.startViewTransition && !reduceMotion && !isPrint) {
      const vt = document.startViewTransition(swap);
      vt.finished.finally(afterSwap);
    } else {
      swap();
      to.classList.add('is-entering');
      setTimeout(() => { to.classList.remove('is-entering'); afterSwap(); }, reduceMotion ? 0 : 640);
    }
  }
  function goTo(n, dir = 1) {
    n = Math.max(0, Math.min(slides.length - 1, n));
    if (n === index || busy) return;
    busy = true;
    activate(n, dir);
  }
  function next() {
    const steps = stepsOf(slides[index]).filter((s) => s.dataset.step !== '0' && !s.classList.contains('is-shown'));
    if (steps.length) { showStep(steps[0], true); stepIndex++; updateNotes(); return; }
    const foc = focusables(slides[index]);
    if (foc.length && focusIndex < foc.length - 1) { focusIndex++; applyFocus(slides[index]); return; }
    goTo(index + 1, 1);
  }
  function prev() {
    if (focusIndex >= 0) { focusIndex--; applyFocus(slides[index]); return; }
    const shown = stepsOf(slides[index]).filter((s) => s.dataset.step !== '0' && s.classList.contains('is-shown'));
    if (shown.length) { const s = shown[shown.length - 1]; s.classList.remove('is-shown'); $$('[data-in]', s).concat(s.matches('[data-in]') ? [s] : []).forEach((el) => { el.getAnimations().forEach((a) => a.cancel()); el.style.opacity = ''; el.style.transform = ''; }); return; }
    goTo(index - 1, -1);
  }
  function revealAllSteps(slide) { stepsOf(slide).forEach((s) => showStep(s, false)); }

  /* ---------- Foco por passos (data-focus) -------------------------------
     Itens com data-focus="1..n" dentro de [data-focus-group] ficam todos visíveis; cada
     avanço realça o próximo (.is-focus) e esmaece os demais (.is-dim). Vem depois dos
     data-step do slide e antes de trocar de slide. */
  let focusIndex = -1;
  function focusables(slide) { return $$('[data-focus]', slide).sort((a, b) => (+a.dataset.focus || 0) - (+b.dataset.focus || 0)); }
  function applyFocus(slide) {
    const list = focusables(slide);
    list.forEach((el, i) => { el.classList.toggle('is-focus', i === focusIndex); el.classList.toggle('is-dim', focusIndex >= 0 && i !== focusIndex); });
    const grp = list[focusIndex]?.closest('[data-focus-group]');
    if (grp && grp.dataset.focusNotes != null) updateNotes();
  }
  function clearFocus(slide) { focusIndex = -1; focusables(slide).forEach((el) => el.classList.remove('is-focus', 'is-dim')); }

  /* ---------- URL / progresso / notas ----------------------------------- */
  function updateUrl() { try { history.replaceState(null, '', '#' + (index + 1)); } catch (e) { /* srcdoc / sandbox */ } }
  function updateProgress() { document.documentElement.style.setProperty('--progress', ((index + 1) / slides.length * 100).toFixed(2) + '%'); }
  let notesPanel;
  function updateNotes() {
    if (!notesPanel) return;
    const n = $('.notes', slides[index]);
    notesPanel.innerHTML = `<h4>Notas · slide ${index + 1}/${slides.length}</h4>` + (n ? n.innerHTML : '<em>Sem notas.</em>');
  }

  /* ---------- Parallax inverso do grafismo ------------------------------ */
  let tx = 0, ty = 0, cx = 0, cy = 0, rafId = 0, mx = 0, my = 0, tmx = 0, tmy = 0;
  function onMove(e) {
    if (isPrint || reduceMotion) return;
    const nx = (e.clientX / innerWidth - 0.5) * 2;   // -1..1
    const ny = (e.clientY / innerHeight - 0.5) * 2;
    const max = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--parallax-max')) || 14;
    tx = -nx * max; ty = -ny * max;                  // inverso ao mouse
    tmx = nx; tmy = ny;                              // alvo da inclinação/refração (chega com atraso)
    if (!rafId) rafId = requestAnimationFrame(tick);
  }
  function tick() {
    cx += (tx - cx) * 0.06; cy += (ty - cy) * 0.06;   // lerp: muito suave
    mx += (tmx - mx) * 0.025; my += (tmy - my) * 0.025; // refração: ainda mais lenta (atraso perceptível)
    const sl = slides[index];
    $$('.grafismo', sl).forEach((g) => {
      g.style.setProperty('--px', cx.toFixed(2) + 'px'); g.style.setProperty('--py', cy.toFixed(2) + 'px');
      g.style.setProperty('--mx', mx.toFixed(3)); g.style.setProperty('--rx', (mx * 2.4).toFixed(2) + 'deg'); g.style.setProperty('--ry', (-my * 1.6).toFixed(2) + 'deg');
    });
    $$('[data-parallax]', sl).forEach((el) => { const d = +el.dataset.parallax || 0.5; el.style.translate = `${(-cx * d).toFixed(2)}px ${(-cy * d).toFixed(2)}px`; });
    // a luz está no cursor: sombras (--sx/--sy) fogem dele, na mesma direção do grafismo, mais fortes
    sl.style.setProperty('--sx', (cx * 1.8).toFixed(2) + 'px'); sl.style.setProperty('--sy', (cy * 1.8).toFixed(2) + 'px');
    if (Math.abs(tx - cx) > 0.05 || Math.abs(ty - cy) > 0.05 || Math.abs(tmx - mx) > 0.002 || Math.abs(tmy - my) > 0.002) rafId = requestAnimationFrame(tick); else rafId = 0;
  }

  /* ---------- Teclado / toque ------------------------------------------- */
  function onKey(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    switch (e.key) {
      case 'ArrowRight': case 'ArrowDown': case ' ': case 'PageDown': case 'Enter': e.preventDefault(); next(); break;
      case 'ArrowLeft': case 'ArrowUp': case 'PageUp': case 'Backspace': e.preventDefault(); prev(); break;
      case 'Home': goTo(0, -1); break;
      case 'End': goTo(slides.length - 1, 1); break;
      case 'f': case 'F': document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.(); break;
      case 'n': case 'N': notesPanel?.classList.toggle('is-open'); break;
      case 'p': case 'P': if (canNavigate) location.search = isPrint ? '' : '?print=1'; else openOverlay('print'); break;
      case 'c': case 'C': if (canNavigate) location.search = '?check=1'; else openOverlay('check'); break;
      case '.': case 'b': case 'B': document.body.classList.toggle('is-black'); break;
    }
  }
  let touchX = 0;
  function onTouchStart(e) { touchX = e.changedTouches[0].clientX; }
  function onTouchEnd(e) { const dx = e.changedTouches[0].clientX - touchX; if (Math.abs(dx) > 50) (dx < 0 ? next() : prev()); }

  /* ---------- Modo impressão / PDF --------------------------------------- */
  function printMode() {
    document.body.classList.add('is-print', 'no-anim');
    slides.forEach((sl) => { sl.classList.add('is-active'); revealAllSteps(sl); });
    // fontes e imagens antes de medir
    Promise.all([document.fonts?.ready, ...$$('img').map((i) => i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; }))]).then(() => {
      slides.forEach((sl) => { fitAll(sl); $$('.chart', sl).forEach((c) => window.FKDCharts && window.FKDCharts.render(c, { animate: false })); });
      document.body.dataset.ready = '1';
      if (isCheck) checkPanel();
      if (MODE === 'pdf') setTimeout(() => { try { window.print(); } catch (e) { /* sem diálogo de impressão */ } }, 400);
    });
    addEventListener('keydown', (e) => { if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') { if (canNavigate) location.search = ''; else if (embedded) parent.postMessage({ type: 'fkd-overlay-close' }, '*'); } });
  }
  function checkPanel() {
    const reports = slides.map((s, i) => { index = i; return report(s); }); index = 0;
    const total = reports.reduce((n, r) => n + r.issues.length, 0);
    const label = { overflow: 'conteúdo maior que a caixa', 'out-of-bounds': 'elemento fora da lâmina', 'outside-frame': 'conteúdo fora da moldura (entre o chrome e o rodapé)', 'fit-shrunk': 'título encolhido para caber (corte texto)', 'image-missing': 'imagem não encontrada', 'grafismo-duplo': 'dois grafismos no mesmo slide', 'layout-missing': 'slide sem estrutura l-*', 'layout-unknown': 'estrutura l-* que não existe no sistema', 'content-missing': 'slide sem <div class="content">', 'theme-missing': 'slide sem data-theme' };
    const detail = (i) => [i.scale != null ? 'escala ' + i.scale : '', i.extraHeight ? '+' + i.extraHeight + ' px de altura' : '', i.extraWidth ? '+' + i.extraWidth + ' px de largura' : '', i.bottom > 4 ? i.bottom + ' px abaixo' : '', i.right > 4 ? i.right + ' px à direita' : '', i.top > 4 ? i.top + ' px acima' : '', i.left > 4 ? i.left + ' px à esquerda' : '', i.src ? i.src : '', i.hint ? i.hint : ''].filter(Boolean).join(', ');
    const lines = reports.filter((r) => r.issues.length).map((r) => 'Slide ' + r.slide + (r.id ? ' (#' + r.id + ')' : '') + ' · ' + r.layout + ' · ' + r.theme + '\n' + r.issues.map((i) => '  - ' + (label[i.type] || i.type) + ': ' + i.el + (detail(i) ? ' (' + detail(i) + ')' : '')).join('\n')).join('\n');
    const text = total ? 'Relatório do deck (' + slides.length + ' slides, ' + total + ' problema(s)):\n' + lines : 'Relatório do deck (' + slides.length + ' slides): nenhum problema de encaixe encontrado.';
    const p = document.createElement('div'); p.className = 'deck-check';
    p.innerHTML = '<div class="dc-head"><strong>Verificação do deck</strong><span></span><button type="button">Copiar relatório</button>' + (canNavigate ? '<a href="?">Voltar à apresentação</a>' : '<a href="#" class="dc-close">Fechar</a>') + '</div><pre tabindex="0"></pre><p class="dc-hint">Cole o relatório no chat com o Gemini e peça a correção. Slides com problema têm borda coral.</p>';
    const closeLink = $('.dc-close', p); if (closeLink) closeLink.onclick = (e) => { e.preventDefault(); if (embedded) parent.postMessage({ type: 'fkd-overlay-close' }, '*'); };
    $('span', p).textContent = total + ' problema(s) em ' + slides.length + ' slides';
    $('pre', p).textContent = text;
    $('button', p).onclick = () => { (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(() => { $('button', p).textContent = 'Copiado'; }, () => { const pre = $('pre', p); const r = document.createRange(); r.selectNodeContents(pre); const s = getSelection(); s.removeAllRanges(); s.addRange(r); pre.focus(); $('button', p).textContent = 'Selecionado: Ctrl/Cmd+C'; }); };
    document.body.appendChild(p);
    slides.forEach((s, i) => { if (reports[i].issues.length) s.classList.add('has-issues'); });
    window.FKDDeck = Object.assign(window.FKDDeck || {}, { checkText: text, reports });
    if (embedded) { try { parent.postMessage({ type: 'fkd-check-report', text, reports }, '*'); } catch (e) { /* sem pai acessível */ } }
  }

  /* ---------- Ferramentas do preview (Canvas do Gemini, player, arquivo local) --------- */
  let overlay = null;
  function openOverlay(mode) {
    closeOverlay();
    overlay = document.createElement('div'); overlay.className = 'deck-overlay';
    overlay.innerHTML = '<div class="do-bar"><strong>' + (mode === 'check' ? 'Verificação do deck' : 'Modo impressão: Ctrl/Cmd+P e "Salvar como PDF"') + '</strong><button type="button">Fechar</button></div>';
    const fr = document.createElement('iframe'); fr.name = 'fkd-' + mode; fr.srcdoc = window.FKD_SOURCE; overlay.appendChild(fr);
    $('button', overlay).onclick = closeOverlay;
    document.body.appendChild(overlay);
  }
  function closeOverlay() { if (overlay) { overlay.remove(); overlay = null; } }
  addEventListener('message', (e) => { if (e.data && e.data.type === 'fkd-overlay-close') closeOverlay(); });
  // verificação silenciosa num iframe escondido; resultado vira um selo no canto
  function autoCheck() {
    if (isPrint || !window.FKD_SOURCE || params.has('nocheck')) return;
    const fr = document.createElement('iframe'); fr.name = 'fkd-check'; fr.className = 'deck-check-probe'; fr.setAttribute('aria-hidden', 'true'); fr.tabIndex = -1;
    fr.style.cssText = 'position:fixed;left:-4000px;top:0;width:1920px;height:1080px;visibility:hidden;pointer-events:none;';
    fr.srcdoc = window.FKD_SOURCE; document.body.appendChild(fr);
    let done = false;
    const finish = (reports, text) => { if (done) return; done = true; removeEventListener('message', onMsg); fr.remove(); if (reports) showBadge(reports, text); };
    const onMsg = (e) => { if (e.source === fr.contentWindow && e.data && e.data.type === 'fkd-check-report') finish(e.data.reports, e.data.text); };
    addEventListener('message', onMsg);
    setTimeout(() => finish(null), 40000);
  }
  function showBadge(reports, text) {
    const total = reports.reduce((n, r) => n + r.issues.length, 0);
    const b = document.createElement('button'); b.type = 'button'; b.className = 'deck-badge' + (total ? ' has-issues' : '');
    b.textContent = total ? total + ' ajuste(s) de encaixe · ver relatório' : 'Encaixe verificado: ok';
    b.title = 'Verificação do deck (tecla C)';
    b.onclick = () => (canNavigate ? (location.search = '?check=1') : openOverlay('check'));
    document.body.appendChild(b);
    if (!total) setTimeout(() => b.classList.add('is-fading'), 5000);
    window.FKDDeck = Object.assign(window.FKDDeck || {}, { checkText: text, reports, issues: total });
  }
  function downloadSource() {
    const html = window.FKD_SOURCE; if (!html) return false;
    try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' })); a.download = 'index.html'; document.body.appendChild(a); a.click(); a.remove(); return true; }
    catch (e) { return false; }
  }
  // abre o player hospedado em nova aba e entrega o HTML por postMessage (não depende de copiar código)
  function openInPlayer() {
    const html = window.FKD_SOURCE; if (!html) return;
    let w = null; try { w = window.open(PLAYER_URL + '#receber', '_blank'); } catch (e) { w = null; }
    if (!w) { if (!downloadSource()) alert('O navegador bloqueou a nova aba. Copie o código do deck e cole em ' + PLAYER_URL); return; }
    const send = () => { try { w.postMessage({ type: 'fkd-deck', html }, '*'); } catch (e) { /* aba fechada */ } };
    const iv = setInterval(send, 600);
    const onMsg = (e) => { if (e.source !== w || !e.data) return; if (e.data.type === 'fkd-player-ready') send(); if (e.data.type === 'fkd-player-got') { clearInterval(iv); removeEventListener('message', onMsg); } };
    addEventListener('message', onMsg);
    setTimeout(() => { clearInterval(iv); removeEventListener('message', onMsg); }, 60000);
  }
  function toolbar() {
    if (!embedded || window.name === 'fkd-player') return;   // o player tem a própria barra
    const t = document.createElement('div'); t.className = 'deck-toolbar';
    t.innerHTML = '<button type="button" data-act="open">Abrir em nova aba (apresentar, PDF)</button><button type="button" data-act="check">Verificar</button><button type="button" data-act="download">Baixar index.html</button>';
    t.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.act === 'check') openOverlay('check'); else if (b.dataset.act === 'download') { if (!downloadSource()) alert('Não deu para baixar daqui. Use "Abrir em nova aba".'); } else openInPlayer(); });
    document.body.appendChild(t);
  }

  /* ---------- Init ------------------------------------------------------ */
  function init() {
    if (!deck || slides.length === 0) return;
    numberSlides(); ensureIcons(); fallbackPlaceholders();
    if (isPrint) { printMode(); window.FKDDeck = { report: () => slides.map((s, i) => { index = i; return report(s); }), slides }; return; }

    fitStage();
    addEventListener('resize', fitStage);
    notesPanel = document.createElement('div'); notesPanel.className = 'notes-panel'; document.body.appendChild(notesPanel);
    if (params.has('notes')) notesPanel.classList.add('is-open');
    const progress = document.createElement('div'); progress.className = 'deck-progress'; document.body.appendChild(progress);
    if (params.has('noanim')) document.body.classList.add('no-anim');

    const start = Math.max(0, Math.min(slides.length - 1, (parseInt((location.hash || '#1').slice(1), 10) || parseInt(params.get('slide') || '1', 10) || 1) - 1));
    index = start;
    slides[index].classList.add('is-active');
    setSharedNames(slides[index], true);
    (document.fonts?.ready || Promise.resolve()).then(() => {
      fitAll(slides[index]);
      $$('.chart', slides[index]).forEach((c) => window.FKDCharts && window.FKDCharts.render(c));
      playEntrances($$('[data-in]', slides[index]).filter((el) => !el.closest('[data-step]')), true);
      stepsOf(slides[index]).filter((s) => s.dataset.step === '0').forEach((s) => showStep(s, true));
      if (params.has('all')) revealAllSteps(slides[index]);
      document.body.dataset.ready = '1';
      toolbar(); autoCheck();
    });
    updateProgress(); updateNotes(); updateUrl();
    // relógio da tela de espera ([data-clock]): HH:MM, atualiza a cada 10 s
    const clocks = $$('[data-clock]');
    if (clocks.length) { const tickClock = () => { const d = new Date(); const t = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); clocks.forEach((c) => { c.textContent = t; }); }; tickClock(); setInterval(tickClock, 10000); }

    addEventListener('keydown', onKey);
    addEventListener('mousemove', onMove, { passive: true });
    addEventListener('touchstart', onTouchStart, { passive: true });
    addEventListener('touchend', onTouchEnd, { passive: true });
    deck.addEventListener('click', (e) => { if (e.target.closest('a, button, video')) return; (e.clientX > innerWidth * 0.25 ? next() : prev()); });

    window.FKDDeck = {
      goTo: (n) => goTo(n - 1, n - 1 > index ? 1 : -1), next, prev, openOverlay, openInPlayer, downloadSource,
      get source() { return window.FKD_SOURCE; }, embedded, mode: MODE,
      get current() { return index + 1; }, get count() { return slides.length; },
      revealAll: () => revealAllSteps(slides[index]),
      report: () => report(slides[index]), slides, springEasing, EASE,
    };
  }
  init();
})();
