/* FKD Deck Engine: carregador. Uma linha no <head> do deck basta:
   <script src="https://cdn.jsdelivr.net/gh/FKD-Creators/fkd-deck-engine@main/engine/fkd-boot.js"></script>
   Carrega CSS, fontes, símbolos, gráficos e o engine a partir da pasta onde este arquivo está
   (CDN ou pasta engine/ local). Uma segunda cópia (local + CDN) é ignorada. */
(function () {
  if (window.FKDBoot) return;
  var src = (document.currentScript && document.currentScript.src) || '';
  var base = src.replace(/[^/]*$/, '');
  if (!base) return;
  var CSS = ['fonts/fonts.css', 'fkd-deck.css', 'fkd-components.css'];
  var JS = ['fkd-symbols.js', 'fkd-charts.js', 'fkd-deck.js'];
  window.FKDBoot = { base: base, src: src, version: '2026-10-29' };
  CSS.forEach(function (f) { var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = base + f; document.head.appendChild(l); });
  JS.forEach(function (f) { var l = document.createElement('link'); l.rel = 'preload'; l.as = 'script'; l.href = base + f; document.head.appendChild(l); });
  function loadScripts() {
    // cópia fiel do HTML antes de o engine mexer no DOM: é o que o deck baixa, abre em nova aba ou verifica
    if (!window.FKD_SOURCE) window.FKD_SOURCE = '<!doctype html>\n' + document.documentElement.outerHTML + '\n';
    (function next(i) {
      if (i >= JS.length) return;
      var s = document.createElement('script'); s.src = base + JS[i]; s.async = false;
      s.onload = function () { next(i + 1); };
      s.onerror = function () { console.error('[FKD] não carregou ' + s.src); window.FKDBoot.error = s.src; showHelp(); };
      document.head.appendChild(s);
    })(0);
  }
  function showHelp() {
    if (document.getElementById('fkd-engine-help')) return;
    var d = document.createElement('div'); d.id = 'fkd-engine-help';
    d.style.cssText = 'position:fixed;inset:0;z-index:999999;background:#1E1F2A;color:#E4E6F0;font:18px/1.5 system-ui,sans-serif;padding:48px;';
    d.innerHTML = '<h1 style="font-size:28px;margin:0 0 16px">Engine FKD não carregou</h1><p>Um dos arquivos do engine não respondeu (<code>' + (window.FKDBoot.error || '') + '</code>). Verifique a conexão e recarregue. Sem internet, o arquivo precisa estar dentro da pasta "FKD Deck", ao lado da pasta <code>engine/</code>.</p>';
    document.body.appendChild(d);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadScripts); else loadScripts();
})();
