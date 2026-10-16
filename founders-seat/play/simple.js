/* Founder's Seat — Simple view. Runs after every render and hides secondary detail behind a click.
   Detailed view shows everything, as before. */
(function () {
  'use strict';
  var KEY = 'fs_ui_mode', mode = 'simple', OPEN = {};
  try { mode = localStorage.getItem(KEY) || 'simple'; } catch (e) { }

  var TOP_KEEP = ['CASH', 'RUNWAY', 'MRR', 'BOARD'];
  var TOP_LINK = { CASH: 'finance', RUNWAY: 'finance', MRR: 'growth', 'NET BURN': 'finance', CUSTOMERS: 'growth', HEADCOUNT: 'team', BOARD: 'capital' };
  /* Cards that start folded even in the main column */
  var FOLD_MAIN = /^(Market map|Experiment history|Shipped|Deals in delivery|Live enterprise|Negotiating|How goals count)/i;
  /* Cards that always stay open */
  var KEEP_OPEN = /^(This month|Roadmap queue|Funnel|Proposal|RFP|Term sheet|Series A|Selected|Hire|Board targets|Operating initiatives|Reports|Channels|Experiments)/i;
  /* Table columns hidden in Simple view (matched on header text) */
  var HIDE_COLS = /^(Qualify|Won|CAC|Ads|Opening|Meetings|M\d+ *$)/i;
  var ROW_LIMIT = 4;

  function U() { return window.__FS_UI; }
  function curView() { var b = document.querySelector('#nav [aria-current="page"]'); return b ? b.getAttribute('data-v') : 'overview'; }
  function txt(el) { return el ? el.textContent.replace(/\s+/g, ' ').trim() : ''; }

  function paintToggle() {
    var b = document.getElementById('modeBtn'); if (!b) return;
    b.setAttribute('aria-pressed', String(mode === 'detailed'));
    b.innerHTML = '<span class="mono faint" style="font-size:10px">VIEW</span><span>' + (mode === 'simple' ? 'Simple' : 'Detailed') + '</span>';
    b.title = mode === 'simple' ? 'Show every number' : 'Hide secondary numbers';
  }
  function setMode(m) {
    mode = m; try { localStorage.setItem(KEY, m); } catch (e) { }
    document.body.classList.toggle('simple', m === 'simple');
    paintToggle();
    if (U() && U().S) U().render();
  }

  function foldCard(card, key, defOpen) {
    var ch = card.querySelector(':scope > .ch'); if (!ch) return;
    var hasBody = Array.prototype.some.call(card.children, function (c) { return c !== ch; });
    if (!hasBody) return;
    card.classList.add('fold');
    var open = key in OPEN ? OPEN[key] : defOpen;
    card.classList.toggle('closed', !open);
    ch.setAttribute('role', 'button'); ch.setAttribute('tabindex', '0'); ch.setAttribute('aria-expanded', String(open));
    ch.setAttribute('data-fold', key);
    if (!ch.querySelector('.chev')) { var s = document.createElement('span'); s.className = 'chev'; s.setAttribute('aria-hidden', 'true'); ch.appendChild(s); }
  }

  function moreToggle(container, items, key, label) {
    var open = !!OPEN[key];
    items.forEach(function (el) { el.classList.toggle('xhide', !open); });
    var b = document.createElement('button'); b.type = 'button'; b.className = 'morebtn'; b.setAttribute('data-more', key);
    b.textContent = open ? 'Show less' : label.replace('{n}', items.length);
    container.appendChild(b);
  }

  function apply() {
    var main = document.getElementById('main'), top = document.getElementById('metrics');
    if (!main || !top) return;
    document.body.classList.toggle('simple', mode === 'simple');
    paintToggle();
    var v = curView();

    /* top bar: every metric opens its panel; secondary ones fold in Simple view */
    Array.prototype.forEach.call(top.querySelectorAll('.met'), function (m) {
      var l = txt(m.querySelector('.l'));
      m.setAttribute('role', 'button'); m.setAttribute('tabindex', '0'); m.setAttribute('data-go', TOP_LINK[l] || 'overview');
      m.title = 'Open ' + (TOP_LINK[l] || 'overview');
      m.classList.toggle('x', TOP_KEEP.indexOf(l) < 0);
    });
    if (!top.querySelector('.metmore')) { var mb = document.createElement('button'); mb.type = 'button'; mb.className = 'metmore'; mb.title = 'Show all numbers'; top.appendChild(mb); }
    top.querySelector('.metmore').textContent = top.classList.contains('peek') ? '−' : '+' + top.querySelectorAll('.met.x').length;
    if (mode !== 'simple') return;

    /* KPI strips: first three, the rest behind "more" */
    Array.prototype.forEach.call(main.querySelectorAll('.kpis'), function (k, i) {
      var items = Array.prototype.slice.call(k.querySelectorAll('.kpi')).slice(3);
      if (!items.length) return;
      k.classList.add('kfold');
      moreToggle(k, items, v + ':kpi' + i, '+{n} more');
    });

    /* cards */
    Array.prototype.forEach.call(main.querySelectorAll('section.card'), function (card) {
      var title = txt(card.querySelector(':scope > .ch .eyebrow'));
      var key = v + ':' + title.replace(/[\d₹.,%]+/g, '#').slice(0, 40);
      var inAside = !!card.closest('aside');
      var important = card.classList.contains('hl') || card.classList.contains('crisis') || KEEP_OPEN.test(title);
      var firstInAside = inAside && card.parentElement.querySelector('section.card') === card;
      var defOpen = important || (!inAside && !FOLD_MAIN.test(title)) || firstInAside;
      foldCard(card, key, defOpen);

      /* explanations at the bottom of a card become an (i) toggle */
      var notes = Array.prototype.filter.call(card.querySelectorAll(':scope > p.cb.note, :scope > .cb > p.note:last-child'), function (p) { return p.parentElement === card ? card.children.length > 2 : p.parentElement.children.length > 1; });
      if (notes.length) {
        var nk = key + ':info', nopen = !!OPEN[nk];
        notes.forEach(function (p) { p.classList.toggle('xhide', !nopen); });
        var ch = card.querySelector(':scope > .ch');
        if (ch && !ch.querySelector('.infob')) { var ib = document.createElement('button'); ib.type = 'button'; ib.className = 'infob'; ib.setAttribute('data-more', nk); ib.setAttribute('aria-label', 'Explain this'); ib.setAttribute('aria-pressed', String(nopen)); ib.textContent = 'i'; ch.insertBefore(ib, ch.querySelector('.chev')); }
      }

      /* long lists: first few rows */
      Array.prototype.forEach.call(card.querySelectorAll(':scope > .rows'), function (r, i) {
        var items = Array.prototype.slice.call(r.children).slice(ROW_LIMIT + 1);
        if (items.length) moreToggle(r, items, key + ':rows' + i, 'Show {n} more');
      });
    });

    /* row descriptions: hidden, shown as a tooltip and on tap */
    Array.prototype.forEach.call(main.querySelectorAll('.chtab td:first-child .note, .qitem .w, .opt > .note'), function (n) {
      var host = n.closest('tr, .qitem, .opt'); if (!host) return;
      host.classList.add('hasdesc'); host.title = txt(n);
    });

    /* wide tables: secondary columns hidden */
    Array.prototype.forEach.call(main.querySelectorAll('table:not(.report)'), function (t, ti) {
      var hs = t.querySelectorAll('thead th'); if (hs.length < 5) return;
      var idx = []; Array.prototype.forEach.call(hs, function (h, i) { if (i > 0 && HIDE_COLS.test(txt(h))) idx.push(i); });
      if (!idx.length) return;
      var tk = v + ':cols' + ti, open = !!OPEN[tk];
      Array.prototype.forEach.call(t.rows, function (row) { idx.forEach(function (i) { if (row.cells[i]) row.cells[i].classList.toggle('xhide', !open); }); });
      var card = t.closest('section.card'), ch = card && card.querySelector(':scope > .ch');
      if (ch && !ch.querySelector('.colsb')) { var cb = document.createElement('button'); cb.type = 'button'; cb.className = 'infob colsb'; cb.setAttribute('data-more', tk); cb.textContent = open ? 'Fewer columns' : 'All columns'; ch.insertBefore(cb, ch.querySelector('.chev')); }
    });
  }

  document.addEventListener('click', function (e) {
    var t = e.target;
    var mode0 = t.closest && t.closest('#modeBtn'); if (mode0) { setMode(mode === 'simple' ? 'detailed' : 'simple'); return; }
    var more = t.closest && t.closest('[data-more]');
    if (more) { e.stopPropagation(); var k = more.getAttribute('data-more'); OPEN[k] = !OPEN[k]; if (U()) U().render(); return; }
    var mm = t.closest && t.closest('.metmore'); if (mm) { document.getElementById('metrics').classList.toggle('peek'); apply(); return; }
    var met = t.closest && t.closest('.met[data-go]');
    if (met && U() && U().S) { U().H.view({ v: met.getAttribute('data-go') }); return; }
    var fold = t.closest && t.closest('[data-fold]');
    if (fold && !t.closest('button:not([data-fold]), a, input, select')) {
      var fk = fold.getAttribute('data-fold'), card = fold.parentElement;
      OPEN[fk] = card.classList.contains('closed');
      card.classList.toggle('closed', !OPEN[fk]); fold.setAttribute('aria-expanded', String(OPEN[fk]));
      return;
    }
    var host = t.closest && t.closest('body.simple .hasdesc');
    if (host && !t.closest('button, a, input')) host.classList.toggle('showdesc');
  }, true);
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var el = document.activeElement; if (!el) return;
    if (el.matches('[data-fold], .met[data-go]')) { e.preventDefault(); el.click(); }
  });
  /* hover peek on the top bar for pointer devices */
  document.addEventListener('mouseover', function (e) { var m = document.getElementById('metrics'); if (m && e.target.closest && e.target.closest('#metrics')) m.classList.add('hov'); });
  document.addEventListener('mouseout', function (e) { var m = document.getElementById('metrics'); if (m && e.target.closest && e.target.closest('#metrics') && !(e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('#metrics'))) m.classList.remove('hov'); });

  window.FSSimple = { apply: apply, get mode() { return mode; }, setMode: setMode };
  document.body.classList.toggle('simple', mode === 'simple');
  paintToggle();
})();
