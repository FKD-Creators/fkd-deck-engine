/* ==========================================================================
   FKD Charts — gráficos SVG mínimos, no padrão do sistema (marcas finas,
   pontas arredondadas, rótulos diretos seletivos, grade recessiva, cores
   categóricas em ordem fixa via --c1..--c5 do tema).
   Uso: <figure class="chart" data-chart="bar" data-labels="A|B|C" data-values="10|20|30"></figure>
   Tipos: bar (horizontal), column (vertical), stacked (horizontal, séries),
   line, area, donut, dumbbell, bullet, sparkline, waterfall,
   funnel, pyramid, ring, gauge, slope, lollipop, waffle, heatmap, treemap,
   bubble, flow, gantt, radar (detalhes em references/infograficos.md).
   Dados: data-labels="a|b|c"  data-values="1|2|3"  ou data-series='[{"name":"X","values":[..]}]'
   Opções: data-format="compact|percent|int|decimal:1|raw|prefix:US$ |suffix: pp"
           data-highlight="i[,j]" (ênfase)  data-labels-mode="all|ends|max|none"
           data-max="n"  data-target="n" (bullet)  data-unit="%"  data-baseline="n"
   ========================================================================== */
(function () {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs = {}, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };
  const split = (s) => (s || '').split('|').map((x) => x.trim()).filter((x) => x !== '');
  const nums = (s) => split(s).map((x) => parseFloat(String(x).replace(/\./g, '').replace(',', '.')));

  /* Formatação pt-BR */
  const fmtBR = (n, dec = 1) => n.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  function formatter(spec = 'compact') {
    const [kind, arg] = spec.split(':');
    return (v) => {
      if (v == null || isNaN(v)) return '';
      switch (kind) {
        case 'raw': return String(v);
        case 'int': return Math.round(v).toLocaleString('pt-BR');
        case 'decimal': return fmtBR(v, +(arg || 1));
        case 'percent': return fmtBR(v, Number.isInteger(v) ? 0 : 1) + '%';
        case 'prefix': return arg + compact(v);
        case 'suffix': return compact(v) + arg;
        default: return compact(v);
      }
    };
  }
  function compact(v) {
    const a = Math.abs(v);
    if (a >= 1e9) return fmtBR(v / 1e9, 1) + ' bi';
    if (a >= 1e6) return fmtBR(v / 1e6, 1) + ' mi';
    if (a >= 1e3) return fmtBR(v / 1e3, a >= 1e5 ? 0 : 1) + ' mil';
    if (Number.isInteger(v)) return v.toLocaleString('pt-BR');
    if (a < 10) return v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    return fmtBR(v, 1);
  }

  function readData(fig) {
    const d = fig.dataset;
    let series;
    if (d.series) series = JSON.parse(d.series).map((sr) => ({ ...sr, values: (sr.values || []).map((v) => typeof v === 'number' ? v : parseFloat(String(v).replace(/\./g, '').replace(',', '.'))) }));  // aceita 11.4 (número JSON) ou "11,40" (texto pt-BR)
    else series = [{ name: d.name || '', values: nums(d.values) }];
    const labels = split(d.labels);
    const highlight = new Set(split(d.highlight).map(Number));
    return { series, labels, highlight, fmt: formatter(d.format), labelsMode: d.labelsMode || 'all', max: d.max ? parseFloat(d.max) : null, target: d.target ? parseFloat(d.target) : null, baseline: d.baseline ? parseFloat(d.baseline) : 0 };
  }
  const color = (i, hot, anyHot) => (anyHot && !hot) ? 'var(--c-muted)' : `var(--c${(i % 5) + 1})`;
  // largura de texto (para reservar só o espaço que os rótulos ocupam, e o gráfico preencher o resto)
  const _cv = document.createElement('canvas').getContext('2d');
  function textW(txt, px = 22, weight = 400, family = 'Sora, sans-serif') { _cv.font = `${weight} ${px}px ${family}`; return _cv.measureText(String(txt)).width; }
  const labelsW = (labels, px = 22, pad = 24, cap = 400) => Math.min(cap, Math.max(60, ...labels.map((l) => textW(l, px))) + pad);
  const valuesW = (vals, fmt, px = 30, pad = 24) => Math.min(260, Math.max(40, ...vals.map((v) => textW(fmt(v), px, 700, 'Barlow Condensed, sans-serif'))) + pad);
  // cor de texto legível sobre uma cor da paleta (resolve var(--cN) do tema)
  function inkOn(fig, cssColor) {
    const m = /var\((--[\w-]+)\)/.exec(cssColor);
    let c = m ? getComputedStyle(fig).getPropertyValue(m[1]).trim() : cssColor;
    let r = 255, g = 255, b = 255;
    if (/^#/.test(c)) { const h = c.slice(1); const f = h.length === 3 ? h.split('').map((x) => x + x).join('') : h; r = parseInt(f.slice(0, 2), 16); g = parseInt(f.slice(2, 4), 16); b = parseInt(f.slice(4, 6), 16); }
    else if (/^rgb/.test(c)) { const p = c.match(/[\d.]+/g).map(Number); if (p[3] != null && p[3] < 0.5) return 'currentColor'; [r, g, b] = p; }
    const L = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return L > 0.55 ? 'var(--fkd-dark)' : 'var(--fkd-white)';
  }

  function frame(fig) {
    let plot = fig.querySelector('.chart-plot');
    if (!plot) { plot = document.createElement('div'); plot.className = 'chart-plot'; fig.appendChild(plot); }
    plot.innerHTML = '';
    const W = plot.clientWidth || 800, H = plot.clientHeight || 400;
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H }, plot);
    return { svg, W, H };
  }
  function legend(fig, series, anyHot, highlight) {
    let lg = fig.querySelector('.legend');
    if (series.length < 2) { if (lg) lg.remove(); return; }
    if (!lg) { lg = document.createElement('div'); lg.className = 'legend'; fig.appendChild(lg); }
    lg.innerHTML = series.map((s, i) => `<span class="lg"><i style="background:${fig.dataset.chart === 'dumbbell' && i === 0 ? 'transparent;box-shadow:inset 0 0 0 3px currentColor;opacity:.55' : color(i, highlight.has(i), anyHot)}"></i>${s.name}</span>`).join('');
  }
  const R = 6; // raio das pontas

  /* ---------- Barras horizontais / cascata ------------------------------- */
  function bar(fig, D, horizontal = true) {
    const { svg, W, H } = frame(fig);
    const vals = D.series[0].values;
    const n = vals.length;
    const anyHot = D.highlight.size > 0;
    const labelW = horizontal ? labelsW(D.labels) : 0;
    const valW = horizontal ? valuesW(vals, D.fmt) : 0;
    const max = D.max || Math.max(...vals, D.target || 0) * 1.0;
    if (horizontal) {
      const gap = 14, rowH = Math.min(96, (H - gap * (n - 1)) / n);
      const barH = Math.max(18, rowH * 0.62);
      const x0 = labelW, w = W - labelW - valW;
      const y0 = (H - (n * rowH + (n - 1) * gap)) / 2;
      vals.forEach((v, i) => {
        const y = y0 + i * (rowH + gap) + (rowH - barH) / 2;
        const len = Math.max(barH / 2, (v / max) * w);
        const hot = D.highlight.has(i);
        el('rect', { x: x0, y, width: len, height: barH, rx: R, class: 'mark' + (hot ? ' is-hot' : ''), fill: color(0, hot, anyHot), style: hot || !anyHot ? '' : 'opacity:.35' }, svg);
        el('text', { x: x0 - 20, y: y + barH / 2, 'text-anchor': 'end', 'dominant-baseline': 'central', class: 'axis' }, svg).textContent = D.labels[i] || '';
        if (D.labelsMode !== 'none') {
          const t = el('text', { x: x0 + len + 16, y: y + barH / 2, 'dominant-baseline': 'central', class: 'mark-label' }, svg);
          t.textContent = D.fmt(v);
        }
      });
      if (D.target != null) { const tx = x0 + (D.target / max) * w; el('line', { x1: tx, x2: tx, y1: 0, y2: H, stroke: 'currentColor', 'stroke-width': 3, 'stroke-dasharray': '8 8' }, svg); }
    } else {
      const gap = 24, colW = Math.min(180, (W - gap * (n - 1)) / n);
      const baseY = H - 44, plotH = baseY - 56;
      const total = n * colW + (n - 1) * gap, x0 = (W - total) / 2;
      vals.forEach((v, i) => {
        const h = Math.max(colW * 0.1, (v / max) * plotH);
        const x = x0 + i * (colW + gap), y = baseY - h;
        const hot = D.highlight.has(i);
        el('rect', { x, y, width: colW, height: h, rx: R, class: 'mark' + (hot ? ' is-hot' : ''), fill: color(0, hot, anyHot), style: hot || !anyHot ? '' : 'opacity:.35' }, svg);
        el('text', { x: x + colW / 2, y: baseY + 30, 'text-anchor': 'middle', class: 'axis' }, svg).textContent = D.labels[i] || '';
        if (D.labelsMode !== 'none') el('text', { x: x + colW / 2, y: y - 14, 'text-anchor': 'middle', class: 'mark-label' }, svg).textContent = D.fmt(v);
      });
      el('line', { x1: 0, x2: W, y1: baseY, y2: baseY, stroke: 'currentColor', 'stroke-opacity': .3, 'stroke-width': 2 }, svg);
    }
  }

  /* ---------- Empilhado horizontal (parte-todo) ------------------------- */
  function stacked(fig, D) {
    const { svg, W, H } = frame(fig);
    const rows = D.labels.length || 1;
    const anyHot = D.highlight.size > 0;
    const labelW = labelsW(D.labels);
    const totals = Array.from({ length: rows }, (_, r) => D.series.reduce((a, s) => a + (s.values[r] || 0), 0));
    const totW = valuesW(totals, D.fmt);
    const max = D.max || Math.max(...totals);
    const gap = 18, rowH = Math.min(110, (H - gap * (rows - 1)) / rows), barH = rowH * 0.7;
    const y0 = (H - (rows * rowH + (rows - 1) * gap)) / 2;
    for (let r = 0; r < rows; r++) {
      let x = labelW; const y = y0 + r * (rowH + gap) + (rowH - barH) / 2;
      el('text', { x: labelW - 20, y: y + barH / 2, 'text-anchor': 'end', 'dominant-baseline': 'central', class: 'axis' }, svg).textContent = D.labels[r] || '';
      D.series.forEach((s, i) => {
        const v = s.values[r] || 0; const len = (v / max) * (W - labelW - totW);
        if (len <= 0) return;
        const hot = D.highlight.has(i);
        el('rect', { x, y, width: Math.max(0, len - 3), height: barH, rx: 4, fill: color(i, hot, anyHot), class: 'mark' }, svg); // 3px de vão
        if (len > 90 && D.labelsMode !== 'none') { el('text', { x: x + len / 2, y: y + barH / 2, 'text-anchor': 'middle', 'dominant-baseline': 'central', style: `font-weight:600;font-size:22px;fill:${inkOn(fig, color(i, hot, anyHot))};paint-order:normal;stroke:none` }, svg).textContent = D.fmt(v); }
        x += len;
      });
      if (D.labelsMode !== 'none') el('text', { x: x + 16, y: y + barH / 2, 'dominant-baseline': 'central', class: 'mark-label' }, svg).textContent = D.fmt(totals[r]);
    }
    legend(fig, D.series, anyHot, D.highlight);
  }

  /* ---------- Linha / área ----------------------------------------------- */
  function line(fig, D, area = false) {
    const { svg, W, H } = frame(fig);
    const anyHot = D.highlight.size > 0;
    const all = D.series.flatMap((s) => s.values);
    const max = D.max || Math.max(...all) * 1.08, min = Math.min(0, ...all);
    const endLabels = D.series.map((s) => (D.series.length > 1 ? s.name + ' ' : '') + D.fmt(s.values[s.values.length - 1]));
    const padL = 24, padR = valuesW(endLabels, (x) => x, 30, 40), padT = 36, padB = 50;
    const n = Math.max(...D.series.map((s) => s.values.length));
    // rótulo acima em pico, abaixo em vale: nunca em cima da linha
    const labelY = (pts, i) => { const p = pts[i]; const nb = [pts[i - 1], pts[i + 1]].filter(Boolean); const avg = nb.reduce((a, q) => a + q[1], 0) / (nb.length || 1); return avg >= p[1] ? p[1] - 26 : p[1] + 40; };
    const X = (i) => padL + (i / (n - 1)) * (W - padL - padR);
    const Y = (v) => padT + (1 - (v - min) / (max - min)) * (H - padT - padB);
    // grade recessiva: 3 linhas
    for (let g = 0; g <= 3; g++) { const y = padT + (g / 3) * (H - padT - padB); el('line', { x1: padL, x2: W - padR, y1: y, y2: y, class: 'grid', stroke: 'currentColor', 'stroke-opacity': .12 }, svg); }
    D.labels.forEach((l, i) => { if (n <= 8 || i % Math.ceil(n / 8) === 0 || i === n - 1) el('text', { x: X(i), y: H - 12, 'text-anchor': 'middle', class: 'axis' }, svg).textContent = l; });
    D.series.forEach((s, si) => {
      const hot = D.highlight.has(si);
      const c = color(si, hot, anyHot);
      const pts = s.values.map((v, i) => [X(i), Y(v)]);
      const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
      if (area) el('path', { d: d + ` L${X(pts.length - 1)} ${Y(min)} L${X(0)} ${Y(min)} Z`, fill: c, 'fill-opacity': .18, class: 'mark' }, svg);
      el('path', { d, fill: 'none', stroke: c, 'stroke-width': 7, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', class: 'mark' + (hot ? ' is-hot' : ''), pathLength: 1, style: 'transform-box:fill-box' }, svg);
      const last = pts[pts.length - 1];
      el('circle', { cx: last[0], cy: last[1], r: 10, fill: c, stroke: 'var(--bg)', 'stroke-width': 3 }, svg);
      const t = el('text', { x: last[0] + 18, y: last[1], 'dominant-baseline': 'central', class: 'mark-label' }, svg);
      t.textContent = (D.series.length > 1 ? s.name + ' ' : '') + D.fmt(s.values[s.values.length - 1]);
      if (D.labelsMode === 'ends' || D.labelsMode === 'all') { const f = pts[0]; el('text', { x: f[0] + 4, y: labelY(pts, 0), 'text-anchor': 'start', class: 'mark-label', style: 'font-size:24px' }, svg).textContent = D.fmt(s.values[0]); }
      // marcadores em pontos destacados (data-points="i|j")
      split(fig.dataset.points).map(Number).forEach((i) => { if (pts[i] && i !== pts.length - 1) { el('circle', { cx: pts[i][0], cy: pts[i][1], r: 11, fill: c, stroke: 'var(--bg)', 'stroke-width': 4 }, svg); el('text', { x: pts[i][0], y: labelY(pts, i), 'text-anchor': 'middle', class: 'mark-label' }, svg).textContent = D.fmt(s.values[i]); } });
    });
    legend(fig, D.series, anyHot, D.highlight);
  }

  /* ---------- Donut (parte-todo, ≤ 5 fatias) ----------------------------- */
  function donut(fig, D) {
    const { svg, W, H } = frame(fig);
    const vals = D.series[0].values, total = vals.reduce((a, b) => a + b, 0);
    const anyHot = D.highlight.size > 0;
    const legendItems = vals.map((v, i) => `${D.labels[i] || ''} · ${D.fmt(v)}`);
    const legendW = Math.min(W * 0.5, labelsW(legendItems, 22, 80, 520));
    const r = Math.min(H, W - legendW) / 2 - 12, sw = Math.max(28, r * 0.28);
    const offX = Math.max(0, (W - (2 * r + 24 + legendW)) / 2);   // centra anel + legenda no slot
    const cx = offX + r + 12, cy = H / 2;
    const maxChars = Math.max(10, Math.floor((legendW - 60) / 11));
    const trunc = (t) => (t.length > maxChars ? t.slice(0, maxChars - 1) + '…' : t);
    let a0 = -Math.PI / 2;
    vals.forEach((v, i) => {
      const a1 = a0 + (v / total) * Math.PI * 2;
      const gapA = 0.025; // vão entre fatias
      const p = (a) => [cx + (r - sw / 2) * Math.cos(a), cy + (r - sw / 2) * Math.sin(a)];
      const [x0, y0] = p(a0 + gapA / 2), [x1, y1] = p(a1 - gapA / 2);
      const large = a1 - a0 > Math.PI ? 1 : 0;
      el('path', { d: `M${x0} ${y0} A${r - sw / 2} ${r - sw / 2} 0 ${large} 1 ${x1} ${y1}`, fill: 'none', stroke: color(i, D.highlight.has(i), anyHot), 'stroke-width': sw, 'stroke-linecap': 'butt', class: 'mark' }, svg);
      a0 = a1;
    });
    const center = fig.dataset.center || D.fmt(D.highlight.size ? vals[[...D.highlight][0]] : total);
    el('text', { x: cx, y: cy, 'text-anchor': 'middle', 'dominant-baseline': 'central', class: 'mark-label', style: 'font-size:64px' }, svg).textContent = center;
    // rótulos à direita
    const lx = cx + r + 48; let ly = cy - (vals.length - 1) * 26;
    vals.forEach((v, i) => { el('rect', { x: lx, y: ly - 12, width: 22, height: 22, rx: 5, fill: color(i, D.highlight.has(i), anyHot) }, svg); el('text', { x: lx + 36, y: ly, 'dominant-baseline': 'central', class: 'axis' }, svg).textContent = trunc(`${D.labels[i] || ''} · ${D.fmt(v)}`); ly += 52; });
  }

  /* ---------- Dumbbell (antes → depois por item) ------------------------- */
  function dumbbell(fig, D) {
    const { svg, W, H } = frame(fig);
    const [a, b] = D.series; const n = D.labels.length;
    const labelW = labelsW(D.labels, 22, 36), padR = valuesW(b.values, D.fmt, 30, 40);
    const max = D.max || Math.max(...a.values, ...b.values) * 1.05;
    const X = (v) => labelW + (v / max) * (W - labelW - padR);
    const rowH = H / n;
    el('line', { x1: labelW - 12, x2: labelW - 12, y1: 0, y2: H, stroke: 'currentColor', 'stroke-opacity': .2, 'stroke-width': 2 }, svg);   // separa rótulos do gráfico
    D.labels.forEach((l, i) => {
      const y = rowH * i + rowH / 2;
      el('line', { x1: labelW, x2: W, y1: y, y2: y, stroke: 'currentColor', 'stroke-opacity': .18, 'stroke-width': 2, 'stroke-dasharray': '2 8' }, svg);   // guia pontilhada da linha
      el('text', { x: labelW - 28, y, 'text-anchor': 'end', 'dominant-baseline': 'central', class: 'axis' }, svg).textContent = l;
      el('line', { x1: X(a.values[i]), x2: X(b.values[i]), y1: y, y2: y, stroke: 'currentColor', 'stroke-opacity': .3, 'stroke-width': 4 }, svg);
      el('circle', { cx: X(a.values[i]), cy: y, r: 13, fill: 'var(--bg)', stroke: 'currentColor', 'stroke-width': 4, 'stroke-opacity': .55, class: 'mark' }, svg);
      el('circle', { cx: X(b.values[i]), cy: y, r: 13, fill: 'var(--c1)', class: 'mark' }, svg);
      el('text', { x: Math.max(X(a.values[i]), X(b.values[i])) + 24, y, 'dominant-baseline': 'central', class: 'mark-label' }, svg).textContent = D.fmt(b.values[i]);
    });
    legend(fig, D.series, false, D.highlight);
  }

  /* ---------- Bullet (valor vs. teto/meta) ------------------------------ */
  function bullet(fig, D) {
    const { svg, W, H } = frame(fig);
    const v = D.series[0].values[0], t = D.target ?? D.max, max = D.max || Math.max(v, t) * 1.1;
    const h = Math.min(56, H * 0.4), y = H / 2 - h / 2;
    el('rect', { x: 0, y, width: W, height: h, rx: R, fill: 'currentColor', 'fill-opacity': .1 }, svg);
    el('rect', { x: 0, y, width: (v / max) * W, height: h, rx: R, fill: 'var(--c1)', class: 'mark' }, svg);
    if (t != null) { const tx = (t / max) * W; el('line', { x1: tx, x2: tx, y1: y - 18, y2: y + h + 18, stroke: 'currentColor', 'stroke-width': 4 }, svg); el('text', { x: tx, y: y - 28, 'text-anchor': 'middle', class: 'axis' }, svg).textContent = (fig.dataset.targetLabel || 'meta') + ' ' + D.fmt(t); }
    el('text', { x: Math.min((v / max) * W + 16, W - 160), y: y + h / 2, 'dominant-baseline': 'central', class: 'mark-label' }, svg).textContent = D.fmt(v);
  }

  /* ---------- Sparkline ------------------------------------------------- */
  function sparkline(fig, D) {
    const { svg, W, H } = frame(fig);
    const v = D.series[0].values, max = Math.max(...v), min = Math.min(...v);
    const pts = v.map((x, i) => [(i / (v.length - 1)) * (W - 8) + 4, 6 + (1 - (x - min) / ((max - min) || 1)) * (H - 12)]);
    el('path', { d: pts.map((p, i) => (i ? 'L' : 'M') + p.join(' ')).join(' '), fill: 'none', stroke: 'var(--c1)', 'stroke-width': 4, 'stroke-linejoin': 'round' }, svg);
    const l = pts[pts.length - 1]; el('circle', { cx: l[0], cy: l[1], r: 7, fill: 'var(--c1)' }, svg);
  }

  /* ---------- Waterfall (composição de um total) ------------------------- */
  function waterfall(fig, D) {
    const { svg, W, H } = frame(fig);
    const vals = D.series[0].values; const n = vals.length;
    const total = vals.reduce((a, b) => a + b, 0);
    const max = D.max || Math.max(total, D.target || 0) * 1.08;
    const gap = Math.max(16, Math.min(40, W * 0.02)), colW = Math.min(260, (W - gap * n) / (n + 1));
    const baseY = H - 60, plotH = baseY - 60; let acc = 0;
    const Y = (v) => baseY - (v / max) * plotH;
    vals.forEach((v, i) => {
      const x = i * (colW + gap);
      const hot = D.highlight.has(i);
      el('rect', { x, y: Y(acc + v), width: colW, height: Math.max(4, Y(acc) - Y(acc + v)), rx: 4, fill: hot ? 'var(--c2)' : 'var(--c1)', class: 'mark' }, svg);
      el('line', { x1: x + colW, x2: x + colW + gap, y1: Y(acc + v), y2: Y(acc + v), stroke: 'currentColor', 'stroke-opacity': .35, 'stroke-width': 2 }, svg);
      el('text', { x: x + colW / 2, y: baseY + 28, 'text-anchor': 'middle', class: 'axis', style: 'font-size:18px' }, svg).textContent = D.labels[i] || '';
      el('text', { x: x + colW / 2, y: Y(acc + v) - 12, 'text-anchor': 'middle', class: 'mark-label', style: 'font-size:24px' }, svg).textContent = D.fmt(v);
      acc += v;
    });
    const x = n * (colW + gap);
    el('rect', { x, y: Y(total), width: colW, height: Y(0) - Y(total), rx: 4, fill: 'var(--c5)', class: 'mark' }, svg);
    el('text', { x: x + colW / 2, y: Y(total) - 12, 'text-anchor': 'middle', class: 'mark-label' }, svg).textContent = D.fmt(total);
    el('text', { x: x + colW / 2, y: baseY + 28, 'text-anchor': 'middle', class: 'axis', style: 'font-size:18px' }, svg).textContent = fig.dataset.totalLabel || 'Total';
    if (D.target != null) { const ty = Y(D.target); el('line', { x1: 0, x2: W, y1: ty, y2: ty, stroke: 'currentColor', 'stroke-width': 3, 'stroke-dasharray': '8 8' }, svg); el('text', { x: W - 4, y: ty - 10, 'text-anchor': 'end', class: 'axis' }, svg).textContent = (fig.dataset.targetLabel || 'teto') + ' ' + D.fmt(D.target); }
  }


  /* ---------- Funil / pirâmide (etapas com perda) ------------------------- */
  function funnel(fig, D, invert = false) {
    const { svg, W, H } = frame(fig);
    let vals = D.series[0].values.slice(), labels = D.labels.slice();
    if (invert) { vals.reverse(); labels.reverse(); }
    const n = vals.length, max = Math.max(...vals), anyHot = D.highlight.size > 0;
    const labelW = labelsW(labels), valueW = valuesW(vals, D.fmt, 30, 40), plotW = W - labelW - valueW;
    const gap = 8, bandH = (H - gap * (n - 1)) / n;
    // largura: proporcional (data-scale="linear") ou raiz quadrada (padrão; funis com queda de 100× continuam legíveis)
    const scaleW = (v) => (fig.dataset.scale === 'linear' ? v / max : Math.sqrt(v / max));
    vals.forEach((v, i) => {
      const w = Math.max(24, scaleW(v) * plotW), x = labelW + (plotW - w) / 2, y = i * (bandH + gap);
      const idx = invert ? n - 1 - i : i;
      el('rect', { x, y, width: w, height: bandH, rx: R, fill: color(idx, D.highlight.has(idx), anyHot), class: 'mark', 'data-anim': 'pop' }, svg);
      el('text', { x: labelW - 20, y: y + bandH / 2, 'text-anchor': 'end', 'dominant-baseline': 'central', class: 'axis' }, svg).textContent = labels[i] || '';
      el('text', { x: labelW + plotW + 24, y: y + bandH / 2, 'dominant-baseline': 'central', class: 'mark-label' }, svg).textContent = D.fmt(v);
      if (fig.dataset.conversion != null && i > 0 && !invert && w > 120) {
        el('text', { x: x + w / 2, y: y + bandH / 2, 'text-anchor': 'middle', 'dominant-baseline': 'central', class: 'axis', style: 'font-size:20px;font-weight:600;fill:var(--bg);opacity:1' }, svg).textContent = fmtBR(v / vals[i - 1] * 100, 0) + '%';
      }
    });
  }

  /* ---------- Anel de progresso (1 a 4 valores, concêntricos) ------------- */
  function ring(fig, D) {
    const { svg, W, H } = frame(fig);
    const vals = D.series[0].values, max = D.max || 100, n = vals.length;
    const legendW = n > 1 ? Math.min(W * 0.45, labelsW(vals.map((v, i) => `${D.labels[i] || ''} · ${D.fmt(v)}`), 22, 80, 460)) : 0;
    const side = Math.min(W - legendW - (n > 1 ? 40 : 0), H), offX = Math.max(0, (W - side - (n > 1 ? 40 + legendW : 0)) / 2), cx = offX + side / 2, cy = H / 2;
    const sw = n === 1 ? Math.max(30, side * 0.11) : Math.max(16, (side / 2 - 16) / n * 0.6);
    const anyHot = D.highlight.size > 0;
    vals.forEach((v, i) => {
      const r = side / 2 - sw / 2 - 6 - i * (sw + 10);
      el('circle', { cx, cy, r, fill: 'none', stroke: 'currentColor', 'stroke-opacity': .1, 'stroke-width': sw }, svg);
      const frac = Math.max(0, Math.min(1, v / max));
      const c = el('circle', { cx, cy, r, fill: 'none', stroke: color(i, D.highlight.has(i), anyHot), 'stroke-width': sw, 'stroke-linecap': 'round', pathLength: 1, transform: `rotate(-90 ${cx} ${cy})`, class: 'mark', 'data-anim': 'ring' }, svg);
      c.style.strokeDasharray = `${frac.toFixed(4)} 1`;
    });
    if (n === 1) {
      el('text', { x: cx, y: cy, 'text-anchor': 'middle', 'dominant-baseline': 'central', class: 'mark-label', style: `font-size:${Math.round(side * 0.22)}px` }, svg).textContent = fig.dataset.center || D.fmt(vals[0]);
      if (D.labels[0]) el('text', { x: cx, y: cy + side * 0.15, 'text-anchor': 'middle', 'dominant-baseline': 'central', class: 'axis', style: 'font-size:20px;text-transform:uppercase;letter-spacing:.06em;font-weight:600' }, svg).textContent = D.labels[0];
    } else {
      const lx = offX + side + 40; let ly = cy - (n - 1) * 26;
      vals.forEach((v, i) => { el('rect', { x: lx, y: ly - 11, width: 22, height: 22, rx: 5, fill: color(i, D.highlight.has(i), anyHot) }, svg); el('text', { x: lx + 36, y: ly, 'dominant-baseline': 'central', class: 'axis' }, svg).textContent = `${D.labels[i] || ''} · ${D.fmt(v)}`; ly += 52; });
    }
  }

  /* ---------- Gauge (meia-lua, valor vs. máximo e meta) ------------------- */
  function gauge(fig, D) {
    const { svg, W, H } = frame(fig);
    const v = D.series[0].values[0], max = D.max || 100, t = D.target;
    const sw = Math.max(28, Math.min(W / 2, H) * 0.16);
    const r = Math.min(W / 2, H - 40) - sw / 2 - 8, cx = W / 2, cy = Math.min(H - 40, r + sw / 2 + 8);
    const P = (f) => [cx + r * Math.cos(Math.PI * (1 - f)), cy - r * Math.sin(Math.PI * (1 - f))];
    const arc = (f0, f1) => { const [x0, y0] = P(f0), [x1, y1] = P(f1); return `M${x0} ${y0} A${r} ${r} 0 0 1 ${x1} ${y1}`; };
    el('path', { d: arc(0, 1), fill: 'none', stroke: 'currentColor', 'stroke-opacity': .1, 'stroke-width': sw, 'stroke-linecap': 'round' }, svg);
    const frac = Math.max(0.001, Math.min(1, v / max));
    el('path', { d: arc(0, frac), fill: 'none', stroke: 'var(--c1)', 'stroke-width': sw, 'stroke-linecap': 'round', pathLength: 1, class: 'mark', 'data-anim': 'draw' }, svg);
    if (t != null) { const f = t / max; const [ax, ay] = P(f); const k = (r + sw / 2 + 14) / r; const [bx, by] = [cx + (ax - cx) * k, cy + (ay - cy) * k]; const k2 = (r - sw / 2 - 14) / r; el('line', { x1: cx + (ax - cx) * k2, y1: cy + (ay - cy) * k2, x2: bx, y2: by, stroke: 'currentColor', 'stroke-width': 4 }, svg); el('text', { x: bx + (bx - cx) * 0.08, y: by - 12, 'text-anchor': bx < cx ? 'end' : 'start', class: 'axis' }, svg).textContent = (fig.dataset.targetLabel || 'meta') + ' ' + D.fmt(t); }
    el('text', { x: cx, y: cy - 10, 'text-anchor': 'middle', class: 'mark-label', style: `font-size:${Math.round(r * 0.5)}px` }, svg).textContent = fig.dataset.center || D.fmt(v);
    if (D.labels[0]) el('text', { x: cx, y: cy + 30, 'text-anchor': 'middle', class: 'axis', style: 'font-size:20px;text-transform:uppercase;letter-spacing:.06em;font-weight:600' }, svg).textContent = D.labels[0];
    el('text', { x: P(0)[0], y: cy + 34, 'text-anchor': 'middle', class: 'axis', style: 'font-size:18px' }, svg).textContent = D.fmt(0);
    el('text', { x: P(1)[0], y: cy + 34, 'text-anchor': 'middle', class: 'axis', style: 'font-size:18px' }, svg).textContent = D.fmt(max);
  }

  // afasta rótulos que colidem (ordena por y e empurra para baixo)
  function spread(items, minGap) { items.sort((a, b) => a.y - b.y); for (let i = 1; i < items.length; i++) if (items[i].y - items[i - 1].y < minGap) items[i].y = items[i - 1].y + minGap; return items; }

  /* ---------- Slope (antes → depois, um segmento por item) ---------------- */
  function slope(fig, D) {
    const { svg, W, H } = frame(fig);
    const [a, b] = D.series; const anyHot = D.highlight.size > 0;
    const labelL = labelsW(D.labels.map((l, i) => `${l}  ${D.fmt(a.values[i])}`), 22, 40), labelR = valuesW(b.values, D.fmt, 26, 40);
    const x0 = labelL, x1 = W - labelR;
    const all = [...a.values, ...b.values]; const max = D.max || Math.max(...all) * 1.05, min = Math.min(0, ...all);
    const padT = 56, padB = 24; const Y = (v) => padT + (1 - (v - min) / (max - min)) * (H - padT - padB);
    [[x0, a.name || 'antes'], [x1, b.name || 'depois']].forEach(([x, t]) => { el('text', { x, y: 22, 'text-anchor': 'middle', class: 'axis', style: 'font-size:20px;font-weight:600;text-transform:uppercase;letter-spacing:.06em' }, svg).textContent = t; el('line', { x1: x, x2: x, y1: padT - 10, y2: H - padB + 6, stroke: 'currentColor', 'stroke-opacity': .15, 'stroke-width': 2 }, svg); });
    const L = spread(D.labels.map((l, i) => ({ i, y: Y(a.values[i]) })), 30), Rr = spread(D.labels.map((l, i) => ({ i, y: Y(b.values[i]) })), 30);
    D.labels.forEach((l, i) => {
      const hot = D.highlight.has(i);
      const c = anyHot && !hot ? 'var(--c-muted)' : (b.values[i] >= a.values[i] ? 'var(--c1)' : 'var(--c2)');
      el('line', { x1: x0, y1: Y(a.values[i]), x2: x1, y2: Y(b.values[i]), stroke: c, 'stroke-width': hot || !anyHot ? 5 : 3, 'stroke-linecap': 'round', pathLength: 1, class: 'mark', 'data-anim': 'draw' }, svg);
      el('circle', { cx: x0, cy: Y(a.values[i]), r: 9, fill: c }, svg); el('circle', { cx: x1, cy: Y(b.values[i]), r: 9, fill: c }, svg);
      const ly = L.find((o) => o.i === i).y, ry = Rr.find((o) => o.i === i).y;
      el('text', { x: x0 - 20, y: ly, 'text-anchor': 'end', 'dominant-baseline': 'central', class: 'axis', style: anyHot && !hot ? 'opacity:.5' : '' }, svg).textContent = `${l}  ${D.fmt(a.values[i])}`;
      el('text', { x: x1 + 20, y: ry, 'dominant-baseline': 'central', class: 'mark-label', style: 'font-size:26px' + (anyHot && !hot ? ';opacity:.5' : '') }, svg).textContent = D.fmt(b.values[i]);
    });
  }

  /* ---------- Lollipop (barra fina + ponto) -------------------------------- */
  function lollipop(fig, D) {
    const { svg, W, H } = frame(fig);
    const vals = D.series[0].values, n = vals.length, anyHot = D.highlight.size > 0;
    const labelW = labelsW(D.labels), valW = valuesW(vals, D.fmt, 30, 40), max = D.max || Math.max(...vals) * 1.05;
    const X = (v) => labelW + (v / max) * (W - labelW - valW), rowH = H / n;
    vals.forEach((v, i) => {
      const y = rowH * i + rowH / 2, c = color(0, true, false);
      const cc = anyHot && !D.highlight.has(i) ? 'var(--c-muted)' : c;
      el('text', { x: labelW - 20, y, 'text-anchor': 'end', 'dominant-baseline': 'central', class: 'axis' }, svg).textContent = D.labels[i] || '';
      el('line', { x1: labelW, x2: X(v), y1: y, y2: y, stroke: cc, 'stroke-width': 5, 'stroke-linecap': 'round', class: 'mark' }, svg);
      el('circle', { cx: X(v), cy: y, r: 13, fill: cc, class: 'mark', 'data-anim': 'pop' }, svg);
      el('text', { x: X(v) + 26, y, 'dominant-baseline': 'central', class: 'mark-label' }, svg).textContent = D.fmt(v);
    });
  }

  /* ---------- Waffle / unidades (100 quadradinhos, círculos ou pessoas) ----- */
  function waffle(fig, D) {
    const { svg, W, H } = frame(fig);
    const vals = D.series[0].values, total = D.max || vals.reduce((a, b) => a + b, 0);
    const cols = +(fig.dataset.cols || 10), rows = +(fig.dataset.rows || 10), units = cols * rows;
    const legendItems = vals.map((v, i) => `${D.labels[i] || ''} · ${D.fmt(v)}`);
    const legendW = vals.length > 1 || D.labels.length ? Math.min(W * 0.45, labelsW(legendItems, 22, 80, 460)) : 0;
    const cell = Math.min((W - legendW - 40) / cols, H / rows), gap = cell * 0.2, sz = cell - gap, oy = (H - rows * cell) / 2;
    const ox0 = Math.max(0, (W - (cols * cell + (legendW ? 40 + legendW : 0))) / 2);
    const shape = fig.dataset.shape || 'square', anyHot = D.highlight.size > 0;
    const raw = vals.map((v) => v / total * units); const counts = raw.map(Math.floor);
    let rem = units - counts.reduce((a, b) => a + b, 0);
    if (vals.reduce((a, b) => a + b, 0) >= total) raw.map((r, i) => [r - Math.floor(r), i]).sort((p, q) => q[0] - p[0]).slice(0, rem).forEach(([, i]) => counts[i]++);
    let k = 0;
    const unit = (x, y, fill, cls) => {
      if (shape === 'circle') return el('circle', { cx: x + cell / 2, cy: y + cell / 2, r: sz / 2, fill, class: cls, 'data-anim': 'pop' }, svg);
      if (shape === 'person') return el('use', { href: '#fkd-person', x: x + gap / 2, y: y + gap / 2, width: sz, height: sz, fill, class: cls, 'data-anim': 'pop' }, svg);
      return el('rect', { x: x + gap / 2, y: y + gap / 2, width: sz, height: sz, rx: Math.min(6, sz * 0.2), fill, class: cls, 'data-anim': 'pop' }, svg);
    };
    const pos = (k) => [ox0 + (k % cols) * cell, oy + (rows - 1 - Math.floor(k / cols)) * cell];
    counts.forEach((c, i) => { for (let u = 0; u < c && k < units; u++, k++) { const [x, y] = pos(k); unit(x, y, color(i, D.highlight.has(i), anyHot), 'mark'); } });
    for (; k < units; k++) { const [x, y] = pos(k); const u = unit(x, y, 'currentColor', ''); u.setAttribute('fill-opacity', '.12'); }
    if (legendW) { const lx = ox0 + cols * cell + 40; let ly = H / 2 - (vals.length - 1) * 26; vals.forEach((v, i) => { el('rect', { x: lx, y: ly - 11, width: 22, height: 22, rx: 5, fill: color(i, D.highlight.has(i), anyHot) }, svg); el('text', { x: lx + 36, y: ly, 'dominant-baseline': 'central', class: 'axis' }, svg).textContent = `${D.labels[i] || ''} · ${D.fmt(v)}`; ly += 52; }); }
  }

  /* ---------- Heatmap (linhas = séries, colunas = labels) ------------------ */
  function heatmap(fig, D) {
    const { svg, W, H } = frame(fig);
    const rows = D.series, cols = D.labels, labelW = labelsW(rows.map((r) => r.name), 22, 32), headH = 44, gap = 6;
    const cw = (W - labelW) / cols.length, rh = (H - headH) / rows.length;
    const all = rows.flatMap((r) => r.values), max = D.max || Math.max(...all), min = Math.min(...all);
    cols.forEach((c, j) => { el('text', { x: labelW + j * cw + cw / 2, y: headH - 16, 'text-anchor': 'middle', class: 'axis', style: 'font-size:18px' }, svg).textContent = c; });
    rows.forEach((r, i) => {
      el('text', { x: labelW - 16, y: headH + i * rh + rh / 2, 'text-anchor': 'end', 'dominant-baseline': 'central', class: 'axis' }, svg).textContent = r.name;
      r.values.forEach((v, j) => {
        const t = (v - min) / ((max - min) || 1), x = labelW + j * cw + gap / 2, y = headH + i * rh + gap / 2;
        el('rect', { x, y, width: cw - gap, height: rh - gap, rx: 8, fill: 'var(--c1)', 'fill-opacity': (0.1 + 0.9 * t).toFixed(2), class: 'mark', 'data-anim': 'fade' }, svg);
        el('text', { x: x + (cw - gap) / 2, y: y + (rh - gap) / 2, 'text-anchor': 'middle', 'dominant-baseline': 'central', class: 'mark-label', style: `font-size:${Math.round(Math.min(28, rh * 0.4))}px;fill:${t > 0.55 ? 'var(--bg)' : 'currentColor'}` }, svg).textContent = D.fmt(v);
      });
    });
  }

  /* ---------- Treemap (parte-todo com área; squarify) ---------------------- */
  function treemap(fig, D) {
    const { svg, W, H } = frame(fig);
    const items = D.series[0].values.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v);
    const total = items.reduce((s, x) => s + x.v, 0), area = (it) => it.v / total * W * H;
    const rects = []; let x = 0, y = 0, w = W, h = H, row = [];
    const worst = (row, side) => { const s = row.reduce((a, r) => a + area(r), 0); const mx = Math.max(...row.map(area)), mn = Math.min(...row.map(area)); return Math.max(side * side * mx / (s * s), s * s / (side * side * mn)); };
    const layoutRow = (row) => { const s = row.reduce((a, r) => a + area(r), 0); if (w >= h) { const rw = s / h; let yy = y; row.forEach((r) => { const rh = area(r) / rw; rects.push({ ...r, x, y: yy, w: rw, h: rh }); yy += rh; }); x += rw; w -= rw; } else { const rh = s / w; let xx = x; row.forEach((r) => { const rw = area(r) / rh; rects.push({ ...r, x: xx, y, w: rw, h: rh }); xx += rw; }); y += rh; h -= rh; } };
    items.forEach((it) => { const side = Math.min(w, h); if (!row.length || worst([...row, it], side) <= worst(row, side)) row.push(it); else { layoutRow(row); row = [it]; } });
    if (row.length) layoutRow(row);
    const anyHot = D.highlight.size > 0, g = 6;
    rects.forEach((r) => {
      el('rect', { x: r.x + g / 2, y: r.y + g / 2, width: Math.max(0, r.w - g), height: Math.max(0, r.h - g), rx: 12, fill: color(r.i, D.highlight.has(r.i), anyHot), class: 'mark', 'data-anim': 'pop' }, svg);
      if (r.w > 110 && r.h > 70) {
        const label = D.labels[r.i] || ''; const fs = Math.max(16, Math.min(32, r.h * 0.26, (r.w - 40) / Math.max(4, label.length) * 1.9));
        const ink = inkOn(fig, color(r.i, D.highlight.has(r.i), anyHot));
        el('text', { x: r.x + 20, y: r.y + 20 + fs * 0.85, class: 'mark-label', style: `font-size:${fs}px;fill:${ink};stroke:none` }, svg).textContent = label;
        el('text', { x: r.x + 20, y: r.y + 20 + fs * 0.85 + fs * 1.05, class: 'axis', style: `font-size:${Math.max(16, Math.round(fs * 0.75))}px;fill:${ink};opacity:.85` }, svg).textContent = D.fmt(r.v);
      }
    });
  }

  /* ---------- Bolhas / dispersão (data-points JSON) -------------------------- */
  function bubble(fig, D) {
    const { svg, W, H } = frame(fig);
    const pts = JSON.parse(fig.dataset.points || '[]'); // [{l,x,y,r,c,hot}]
    const padL = 84, padB = 64, padT = 40, padR = 80;
    const nice = (v) => { const p = Math.pow(10, Math.floor(Math.log10(v))); const f = v / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p; };
    const xmax = +(fig.dataset.xMax || nice(Math.max(...pts.map((p) => p.x)) * 1.15)), ymax = +(fig.dataset.yMax || nice(Math.max(...pts.map((p) => p.y)) * 1.15)), rmax = Math.max(...pts.map((p) => p.r || 1));
    const X = (v) => padL + (v / xmax) * (W - padL - padR), Y = (v) => padT + (1 - v / ymax) * (H - padT - padB), Rr = (v) => 10 + Math.sqrt((v || 1) / rmax) * Math.min(W, H) * 0.085;
    // grade e escala numérica (5 divisões por eixo)
    for (let k = 0; k <= 5; k++) {
      const xv = xmax * k / 5, yv = ymax * k / 5;
      el('line', { x1: X(xv), x2: X(xv), y1: padT, y2: H - padB, stroke: 'currentColor', 'stroke-opacity': k ? .1 : .3, 'stroke-width': k ? 1.5 : 2 }, svg);
      el('line', { x1: padL, x2: W - padR, y1: Y(yv), y2: Y(yv), stroke: 'currentColor', 'stroke-opacity': k ? .1 : .3, 'stroke-width': k ? 1.5 : 2 }, svg);
      el('text', { x: X(xv), y: H - padB + 28, 'text-anchor': 'middle', class: 'axis', style: 'font-size:18px' }, svg).textContent = compact(+xv.toFixed(2));
      if (k) el('text', { x: padL - 14, y: Y(yv), 'text-anchor': 'end', 'dominant-baseline': 'central', class: 'axis', style: 'font-size:18px' }, svg).textContent = compact(+yv.toFixed(2));
    }
    if (fig.dataset.xLabel) el('text', { x: W - padR, y: H - 8, 'text-anchor': 'end', class: 'axis', style: 'font-size:18px;text-transform:uppercase;letter-spacing:.06em;font-weight:600' }, svg).textContent = fig.dataset.xLabel + ' →';
    if (fig.dataset.yLabel) el('text', { x: padL - 14, y: padT - 14, 'text-anchor': 'end', class: 'axis', style: 'font-size:18px;text-transform:uppercase;letter-spacing:.06em;font-weight:600' }, svg).textContent = '↑ ' + fig.dataset.yLabel;
    if (fig.dataset.quadrants) { const [qx, qy] = nums(fig.dataset.quadrants); el('line', { x1: X(qx), x2: X(qx), y1: padT, y2: H - padB, stroke: 'currentColor', 'stroke-opacity': .25, 'stroke-dasharray': '6 8', 'stroke-width': 2 }, svg); el('line', { x1: padL, x2: W - padR, y1: Y(qy), y2: Y(qy), stroke: 'currentColor', 'stroke-opacity': .25, 'stroke-dasharray': '6 8', 'stroke-width': 2 }, svg); }
    const anyHot = pts.some((p) => p.hot);
    [...pts].sort((p, q) => (q.r || 1) - (p.r || 1)).forEach((p) => {   // maiores primeiro, menores por cima
      const c = anyHot ? (p.hot ? 'var(--c1)' : 'var(--c-muted)') : `var(--c${p.c || 1})`;
      const r = Rr(p.r), x = X(p.x), y = Y(p.y);
      if (p.hot) { el('circle', { cx: x, cy: y, r: r + 18, fill: 'none', stroke: c, 'stroke-width': 3, 'stroke-opacity': .35, class: 'mark', 'data-anim': 'pop' }, svg); el('circle', { cx: x, cy: y, r: r + 36, fill: 'none', stroke: c, 'stroke-width': 2, 'stroke-opacity': .15, class: 'mark', 'data-anim': 'pop' }, svg); }
      el('circle', { cx: x, cy: y, r, fill: c, 'fill-opacity': p.hot || !anyHot ? .9 : .55, stroke: 'var(--bg)', 'stroke-width': 3, class: 'mark', 'data-anim': 'pop' }, svg);
      if (p.l) el('text', { x: x + r + 10, y, 'dominant-baseline': 'central', class: p.hot ? 'mark-label' : 'axis', style: p.hot ? 'font-size:28px' : 'font-weight:600;opacity:.75;font-size:18px' }, svg).textContent = p.l;
    });
  }

  /* ---------- Fluxo (sankey de duas colunas; data-flows JSON) ---------------- */
  function flow(fig, D) {
    const { svg, W, H } = frame(fig);
    const flows = JSON.parse(fig.dataset.flows || '[]'); // [{from,to,v}]
    const L = [...new Set(flows.map((f) => f.from))], Rn = [...new Set(flows.map((f) => f.to))];
    const sum = (arr, key) => Object.fromEntries(arr.map((n) => [n, flows.filter((f) => f[key] === n).reduce((a, f) => a + f.v, 0)]));
    const sumL = sum(L, 'from'), sumR = sum(Rn, 'to'), total = flows.reduce((a, f) => a + f.v, 0);
    const gap = 16, nodeW = 18, labelW = Math.min(260, W * 0.24), x0 = labelW, x1 = W - labelW - nodeW;
    const sL = (H - gap * (L.length - 1)) / total, sR = (H - gap * (Rn.length - 1)) / total;
    let y = 0; const posL = {}; L.forEach((n) => { posL[n] = { y, h: sumL[n] * sL, off: 0 }; y += sumL[n] * sL + gap; });
    y = 0; const posR = {}; Rn.forEach((n) => { posR[n] = { y, h: sumR[n] * sR, off: 0 }; y += sumR[n] * sR + gap; });
    flows.forEach((f) => {
      const a = posL[f.from], b = posR[f.to], hA = f.v * sL, hB = f.v * sR, ya = a.y + a.off, yb = b.y + b.off; a.off += hA; b.off += hB;
      const xa = x0 + nodeW, xb = x1, cm = (xa + xb) / 2;
      el('path', { d: `M${xa} ${ya} C${cm} ${ya} ${cm} ${yb} ${xb} ${yb} L${xb} ${yb + hB} C${cm} ${yb + hB} ${cm} ${ya + hA} ${xa} ${ya + hA} Z`, fill: `var(--c${(L.indexOf(f.from) % 5) + 1})`, 'fill-opacity': f.hot ? .9 : .5, class: 'mark', 'data-anim': 'fade' }, svg);
    });
    L.forEach((n, i) => { const p = posL[n]; el('rect', { x: x0, y: p.y, width: nodeW, height: p.h, rx: 5, fill: `var(--c${(i % 5) + 1})` }, svg); el('text', { x: x0 - 14, y: p.y + p.h / 2, 'text-anchor': 'end', 'dominant-baseline': 'central', class: 'axis', style: 'font-weight:600;opacity:1' }, svg).textContent = `${n} · ${D.fmt(sumL[n])}`; });
    Rn.forEach((n) => { const p = posR[n]; el('rect', { x: x1, y: p.y, width: nodeW, height: p.h, rx: 5, fill: 'currentColor', 'fill-opacity': .6 }, svg); el('text', { x: x1 + nodeW + 14, y: p.y + p.h / 2, 'dominant-baseline': 'central', class: 'axis', style: 'font-weight:600;opacity:1' }, svg).textContent = `${n} · ${D.fmt(sumR[n])}`; });
  }

  /* ---------- Gantt / roadmap (data-tasks JSON; labels = períodos) ----------- */
  function gantt(fig, D) {
    const { svg, W, H } = frame(fig);
    const tasks = JSON.parse(fig.dataset.tasks || '[]'); // [{name,start,end,label,c,hot}] ou [{name,at}] (marco)
    const periods = D.labels, nP = periods.length, labelW = labelsW(tasks.map((t) => t.name), 22, 36), headH = 48;
    const rowH = (H - headH) / tasks.length, colW = (W - labelW) / nP;
    periods.forEach((p, j) => { el('text', { x: labelW + j * colW + colW / 2, y: headH - 18, 'text-anchor': 'middle', class: 'axis', style: 'font-size:18px;text-transform:uppercase;letter-spacing:.06em;font-weight:600' }, svg).textContent = p; el('line', { x1: labelW + j * colW, x2: labelW + j * colW, y1: headH - 4, y2: H, stroke: 'currentColor', 'stroke-opacity': .12, 'stroke-width': 2 }, svg); });
    const anyHot = tasks.some((t) => t.hot);
    tasks.forEach((t, i) => {
      const y = headH + i * rowH, c = anyHot ? (t.hot ? 'var(--c1)' : 'var(--c-muted)') : `var(--c${t.c || 1})`;
      el('text', { x: labelW - 18, y: y + rowH / 2, 'text-anchor': 'end', 'dominant-baseline': 'central', class: 'axis', style: 'opacity:.9' }, svg).textContent = t.name;
      if (t.at != null) { const x = labelW + t.at * colW; el('path', { d: `M${x} ${y + rowH / 2 - 16} l16 16 l-16 16 l-16 -16 z`, fill: c, class: 'mark', 'data-anim': 'pop' }, svg); if (t.label) el('text', { x: x + 26, y: y + rowH / 2, 'dominant-baseline': 'central', class: 'axis', style: 'font-size:18px' }, svg).textContent = t.label; return; }
      const x = labelW + t.start * colW, w = (t.end - t.start) * colW, bh = Math.min(38, rowH * 0.56);
      el('rect', { x: x + 4, y: y + rowH / 2 - bh / 2, width: Math.max(8, w - 8), height: bh, rx: bh / 2, fill: c, class: 'mark' }, svg);
      if (t.label && w > 100) el('text', { x: x + w / 2, y: y + rowH / 2, 'text-anchor': 'middle', 'dominant-baseline': 'central', class: 'axis', style: 'font-size:16px;font-weight:600;fill:var(--bg);opacity:1' }, svg).textContent = t.label;
    });
    if (fig.dataset.now != null) { const x = labelW + (+fig.dataset.now) * colW; el('line', { x1: x, x2: x, y1: headH - 8, y2: H, stroke: 'var(--accent)', 'stroke-width': 3, 'stroke-dasharray': '6 6' }, svg); el('text', { x: x + 8, y: H - 6, class: 'axis', style: 'font-size:16px;font-weight:600;fill:var(--accent);opacity:1' }, svg).textContent = fig.dataset.nowLabel || 'hoje'; }
  }

  /* ---------- Radar (≤ 2 séries, 4–7 eixos) ---------------------------------- */
  function radar(fig, D) {
    const { svg, W, H } = frame(fig);
    const n = D.labels.length, cx = W / 2, cy = H / 2, r = Math.min(W, H) / 2 - 60, max = D.max || Math.max(...D.series.flatMap((s) => s.values));
    const P = (i, v) => { const a = -Math.PI / 2 + i * 2 * Math.PI / n; return [cx + Math.cos(a) * r * v / max, cy + Math.sin(a) * r * v / max]; };
    [0.25, 0.5, 0.75, 1].forEach((k) => el('polygon', { points: D.labels.map((_, i) => P(i, max * k).join(',')).join(' '), fill: 'none', stroke: 'currentColor', 'stroke-opacity': .15, 'stroke-width': 1.5 }, svg));
    D.labels.forEach((l, i) => { const [x, y] = P(i, max * 1.18); const [ex, ey] = P(i, max); el('line', { x1: cx, y1: cy, x2: ex, y2: ey, stroke: 'currentColor', 'stroke-opacity': .15 }, svg); el('text', { x, y, 'text-anchor': Math.abs(x - cx) < 12 ? 'middle' : x > cx ? 'start' : 'end', 'dominant-baseline': 'central', class: 'axis', style: 'font-size:20px' }, svg).textContent = l; });
    const anyHot = D.highlight.size > 0;
    D.series.forEach((s, k) => { const pts = s.values.map((v, i) => P(i, v)); const c = color(k, D.highlight.has(k), anyHot); el('polygon', { points: pts.map((p) => p.join(',')).join(' '), fill: c, 'fill-opacity': .18, stroke: c, 'stroke-width': 4, 'stroke-linejoin': 'round', class: 'mark', 'data-anim': 'pop' }, svg); pts.forEach((p) => el('circle', { cx: p[0], cy: p[1], r: 6, fill: c }, svg)); });
    legend(fig, D.series, anyHot, D.highlight);
  }

  const TYPES = { bar: (f, D) => bar(f, D, true), column: (f, D) => bar(f, D, false), stacked, line: (f, D) => line(f, D, false), area: (f, D) => line(f, D, true), donut, dumbbell, bullet, sparkline, waterfall,
    funnel: (f, D) => funnel(f, D, false), pyramid: (f, D) => funnel(f, D, true), ring, gauge, slope, lollipop, waffle, heatmap, treemap, bubble, scatter: bubble, flow, gantt, roadmap: gantt, radar };

  function render(fig, opts = {}) {
    const type = fig.dataset.chart || 'bar';
    const fn = TYPES[type]; if (!fn) return;
    try { fn(fig, readData(fig)); } catch (e) { console.warn('FKDCharts', type, e); }
    if (opts.animate === false || document.body.classList.contains('is-print')) return;
    // crescimento das marcas (respeita reduced motion)
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const marks = fig.querySelectorAll('.mark'); const per = Math.min(80, 1400 / Math.max(1, marks.length));
    const organic = window.FKDDeck?.EASE?.organic || 'cubic-bezier(0.16, 1, 0.3, 1)';
    marks.forEach((m, i) => {
      const anim = m.dataset.anim;
      if (anim === 'pop') { m.style.transformBox = 'fill-box'; m.style.transformOrigin = 'center'; m.animate([{ transform: 'scale(0)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 800, delay: per * i, easing: organic, fill: 'both' }); return; }
      if (anim === 'fade') { m.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 700, delay: per * i, easing: 'ease-out', fill: 'both' }); return; }
      if (anim === 'ring') { const to = m.style.strokeDasharray; m.animate([{ strokeDasharray: '0 1' }, { strokeDasharray: to }], { duration: 1300, delay: 150 * i, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'both' }); return; }
      if (anim === 'draw' || (m.tagName === 'path' && m.getAttribute('stroke-width'))) { m.style.strokeDasharray = '1'; m.style.strokeDashoffset = '1'; m.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 1200, delay: 200, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'both' }); return; }
      const vertical = type === 'column' || type === 'waterfall';
      m.style.transformBox = 'fill-box'; m.style.transformOrigin = vertical ? 'bottom' : 'left';
      m.animate([{ transform: vertical ? 'scaleY(0)' : 'scaleX(0)' }, { transform: 'none' }], { duration: 900, delay: 80 * i, easing: window.FKDDeck?.EASE?.soft || 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'both' });
    });
  }
  function renderAll(root = document) { root.querySelectorAll('.chart').forEach((c) => render(c)); }
  window.FKDCharts = { render, renderAll, formatter, compact };
})();
