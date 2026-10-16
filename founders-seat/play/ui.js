/* Founder's Seat — interface. Renders engine state; all game rules live in engine.js. */
(function () {
  'use strict';
  var FS = window.FS;
  var SAVE = 'fs_game_v2';
  var S = null, view = 'overview', selPerson = null, modalQ = [], pickedArch = 'technical';
  var $ = function (id) { return document.getElementById(id); };

  /* ---------- helpers ---------- */
  function esc(x) { return String(x).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function L(x, dp) {
    var neg = x < 0; x = Math.abs(x);
    var t = x >= 100 ? '₹' + (x / 100).toFixed(2) + ' Cr' : '₹' + x.toFixed(dp == null ? 1 : dp) + 'L';
    return (neg ? '−' : '') + t;
  }
  function rw(x) { return !isFinite(x) || x > 99 ? 'Profitable' : x.toFixed(1) + ' mo'; }
  function pct(x, dp) { return (x * 100).toFixed(dp == null ? 1 : dp) + '%'; }
  function mm(n) { return (n < 10 ? '0' : '') + n; }
  function save() { try { localStorage.setItem(SAVE, JSON.stringify(S)); } catch (e) { } }
  function load() { try { var j = localStorage.getItem(SAVE); var o = j ? JSON.parse(j) : null; return o && o.v === 2 ? o : null; } catch (e) { return null; } }
  function clearSave() { try { localStorage.removeItem(SAVE); } catch (e) { } }
  function toast(msg, err) {
    if (!msg) return;
    var t = $('toast'); t.textContent = msg; t.className = 'show' + (err ? ' err' : '');
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.className = ''; }, 3200);
  }
  function costTxt(c) {
    var out = [];
    if (c.str) out.push('−' + c.str + ' STR'); if (c.ops) out.push('−' + c.ops + ' OPS'); if (c.ppl) out.push('−' + c.ppl + ' PPL'); if (c.cash) out.push('−' + L(c.cash));
    return out.join(' · ');
  }
  function btn(label, act, data, opts) {
    opts = opts || {};
    var attrs = ''; for (var k in (data || {})) attrs += ' data-' + k + '="' + esc(data[k]) + '"';
    var dis = opts.disabled ? ' disabled' : '';
    var cost = opts.cost ? ' <span class="cost">' + esc(costTxt(opts.cost)) + '</span>' : '';
    return '<button type="button" class="btn ' + (opts.cls || '') + '" data-act="' + act + '"' + attrs + dis + (opts.title ? ' title="' + esc(opts.title) + '"' : '') + '>' + esc(label) + cost + '</button>';
  }
  function afford(c) { return FS.canAfford(S, c); }
  function risk(p) { return p.morale < 45 ? ['High', 'down'] : p.morale < 55 ? ['Medium', 'acc'] : ['Low', 'mut']; }
  var ARROW = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M2 7h10M8 3l4 4-4 4"/></svg>';

  /* ---------- charts ---------- */
  function lineChart(series, o) {
    var W = o.w || 640, H = o.h || 200, pl = 44, pr = 12, pt = 14, pb = 24;
    var xmax = o.xmax || 36, ymax = o.ymax, ymin = o.ymin || 0;
    if (ymax == null) { ymax = 0; series.forEach(function (s) { s.pts.forEach(function (p) { ymax = Math.max(ymax, p[1]); }); }); ymax = ymax * 1.12 || 1; }
    var X = function (m) { return pl + (m - 1) / (xmax - 1) * (W - pl - pr); };
    var Y = function (v) { return pt + (1 - (v - ymin) / (ymax - ymin)) * (H - pt - pb); };
    var g = '';
    for (var i = 0; i <= 4; i++) { var v = ymin + (ymax - ymin) * i / 4, y = Y(v); g += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '" stroke="#1E242C"/><text x="' + (pl - 6) + '" y="' + (y + 3.5).toFixed(1) + '" text-anchor="end">' + esc(o.fmt ? o.fmt(v) : v.toFixed(0)) + '</text>'; }
    [1, 6, 12, 18, 24, 30, 36].forEach(function (m) { if (m <= xmax) g += '<text x="' + X(m).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle">M' + m + '</text>'; });
    if (o.now) g += '<line x1="' + X(o.now).toFixed(1) + '" x2="' + X(o.now).toFixed(1) + '" y1="' + pt + '" y2="' + (H - pb) + '" stroke="#2A323C" stroke-dasharray="2 3"/>';
    var paths = series.map(function (s) {
      if (!s.pts.length) return '';
      var d = s.pts.map(function (p, i) { return (i ? 'L' : 'M') + X(p[0]).toFixed(1) + ' ' + Y(Math.max(ymin, p[1])).toFixed(1); }).join(' ');
      var last = s.pts[s.pts.length - 1];
      return '<path d="' + d + '" fill="none" stroke="' + s.color + '" stroke-width="' + (s.dash ? 1.8 : 2.2) + '"' + (s.dash ? ' stroke-dasharray="' + s.dash + '"' : '') + '/>' + (s.dot ? '<circle cx="' + X(last[0]).toFixed(1) + '" cy="' + Y(last[1]).toFixed(1) + '" r="3.5" fill="' + s.color + '"/>' : '');
    }).join('');
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" aria-label="' + esc(o.label || 'Chart') + '" style="display:block;max-height:' + (H + 20) + 'px"><g font-family="Geist Mono, monospace" font-size="10" fill="#8E959E">' + g + '</g>' + paths + '</svg>';
  }

  /* ---------- top bar, rail ---------- */
  function renderTop(m) {
    var h = S.history, prev = h.length > 1 ? h[h.length - 2] : h[0];
    var dm = m.mrr - prev.mrr;
    var cells = [
      ['CASH', L(S.cash), (m.cashOut > 0 ? '−' : '+') + L(Math.abs(m.cashOut)).replace('−', '') + ' / MO', m.cashOut > 0 ? 'down' : 'up'],
      ['RUNWAY', rw(m.runway), m.runway < 6 ? 'DANGER' : m.runway < 9 ? 'RAISE WINDOW' : 'HEALTHY', m.runway < 9 ? 'down' : 'up'],
      ['MRR', L(m.mrr, 2), (dm >= 0 ? '+' : '') + pct(prev.mrr ? dm / prev.mrr : 0) + ' MOM', dm >= 0 ? 'up' : 'down'],
      ['NET BURN', L(Math.max(0, m.burn)), m.burn <= 0 ? 'PROFITABLE' : 'BURN MULT ' + (m.bm > 50 ? '—' : m.bm.toFixed(1) + '×'), m.bm > 2.5 && m.burn > 0 ? 'down' : 'mut'],
      ['CUSTOMERS', String(m.customers), 'TOP ' + Math.round(m.conc * 100) + '% OF MRR', m.conc > 0.1 ? 'down' : 'mut'],
      ['HEADCOUNT', String(m.headcount), S.pipeline.length ? '+' + S.pipeline.length + ' JOINING' : 'MORALE ' + Math.round(m.morale), m.morale < 60 ? 'down' : 'mut'],
      ['BOARD', String(Math.round(S.board)), S.board >= 65 ? 'SUPPORTIVE' : S.board >= 45 ? 'CONCERNED' : 'LOSING PATIENCE', S.board < 45 ? 'down' : S.board < 65 ? 'acc' : 'up']
    ];
    $('metrics').innerHTML = cells.map(function (c) { return '<div class="met"><span class="l">' + c[0] + '</span><span class="v">' + esc(c[1]) + '</span><span class="d ' + c[3] + '">' + esc(c[2]) + '</span></div>'; }).join('');
    $('monthv').textContent = mm(S.month) + ' / 36';
    $('endMonth').disabled = S.over;
  }

  var VIEWS = [['overview', 'Overview'], ['finance', 'Finance'], ['growth', 'Growth'], ['product', 'Product'], ['team', 'Team & Org'], ['ops', 'Operations'], ['partners', 'Partners & Deals'], ['capital', 'Capital & Board'], ['reports', 'Reports'], ['goals', 'Goals']];
  function renderNav(m) {
    var flags = {
      finance: m.runway < 6 ? '!' : '',
      product: S.product.queue.length ? '' : '!',
      team: (function () { var n = S.people.filter(function (p) { return !p.founder && p.morale < 50; }).length; return n ? String(n) : ''; })(),
      capital: S.fund.offer ? '•' : (m.runway < 9 && S.fund.status === 'none' ? '!' : ''),
      growth: S.exp.ready.length ? String(S.exp.ready.length) : '',
      partners: S.partners.offers.length + (S.deals.offer ? 1 : 0) ? '•' : '',
      ops: FS.support(S).sla < 0.9 ? '!' : ''
    };
    $('nav').innerHTML = VIEWS.map(function (v) {
      return '<button type="button" data-act="view" data-v="' + v[0] + '"' + (view === v[0] ? ' aria-current="page"' : '') + '><span>' + v[1] + '</span><span class="flag">' + (flags[v[0]] || '') + '</span></button>';
    }).join('');
    function pool(name, k) {
      var max = S.focusMax[k], cur = S.focus[k], pips = '';
      for (var i = 0; i < max; i++) pips += '<span class="' + (i < cur ? 'on' : '') + '"></span>';
      return '<div class="pool"><div class="row"><span class="mut">' + name + '</span><span class="mono">' + cur + ' / ' + max + '</span></div><div class="pips" style="grid-template-columns:repeat(' + max + ',1fr)">' + pips + '</div></div>';
    }
    $('focus').innerHTML = '<div class="eb"><div class="eyebrow">Founder focus</div><div class="mono faint" style="font-size:10px">REFILLS EACH MONTH</div></div>' +
      pool('Strategy', 'str') + pool('Ops', 'ops') + pool('People', 'ppl') +
      '<div class="pool"><div class="row"><span class="mut">Energy</span><span class="mono ' + (S.energy < 40 ? 'down' : '') + '">' + Math.round(S.energy) + '%</span></div><div class="bar"><i style="width:' + Math.round(S.energy) + '%;background:' + (S.energy < 40 ? '#E08B7C' : '#C9A45C') + '"></i></div></div>';
  }

  /* ---------- views ---------- */
  function headline(m) {
    if (S.fund.offer) return ['A term sheet is on the table.', 'Read it before it expires.'];
    if (m.runway < 4) return [rw(m.runway) + ' of runway.', 'This is an emergency.'];
    if (m.runway < 9 && !S.fund.raised && S.fund.status !== 'active') return [rw(m.runway) + ' of runway.', 'The raise starts now.'];
    if (S.fund.status === 'active') return ['You are raising.', 'Every point of growth moves the price.'];
    if (m.burn <= 0) return ['You are profitable.', 'Now choose how fast to grow.'];
    if (m.g3 < 0.04 && S.month > 3) return ['Growth has stalled at ' + pct(m.g3) + '.', 'Find the bottleneck.'];
    if (S.fund.raised) return ['Series A in the bank.', 'Turn capital into growth.'];
    return ['Month ' + S.month + ' of 36.', 'Every call is yours.'];
  }

  function agenda(m) {
    var a = [], e = m.eng, si = FS.salesInfo(S);
    if (S.fund.offer) a.push(['A term sheet from ' + S.fund.offer.fund + ' is waiting', 'capital', '#C9A45C']);
    if (m.runway < 9 && S.fund.status === 'none' && !S.fund.raised) a.push(['Start the Series A process', 'capital', '#E08B7C']);
    if (S.fund.status === 'active' && !S.fund.offer) a.push(['Pitch funds to build interest (month ' + S.fund.months + ' of the raise)', 'capital', '#C9A45C']);
    if (m.runway < 4 && !S.vdebt.taken && m.arr >= 90) a.push(['Venture debt could buy you time', 'finance', '#E08B7C']);
    var risky = S.people.filter(function (p) { return !p.founder && p.morale < 50; });
    if (risky.length) a.push([risky.length + (risky.length > 1 ? ' people are' : ' person is') + ' a flight risk', 'team', '#E08B7C']);
    if (!S.product.queue.length) a.push(['The roadmap queue is empty: engineers are idle', 'product', '#E08B7C']);
    if (S.product.debt > 60) a.push(['Tech debt is slowing the team', 'product', '#C9A45C']);
    if (e.reports > 8) a.push(['Arjun has ' + e.reports + ' direct reports', 'team', '#C9A45C']);
    if (S.pending.length) a.unshift(['An event needs your decision', 'overview', '#E08B7C']);
    if (S.deals.offer) a.push(['RFP from ' + S.deals.offer.name + ' (₹' + S.deals.offer.mrr.toFixed(1) + 'L MRR) is waiting', 'partners', '#C9A45C']);
    if (S.partners.offers.length) a.push([FS.PARTNERS[S.partners.offers[0].id].name + ' sent a partnership proposal', 'partners', '#C9A45C']);
    if (S.exp.ready.length) a.push([S.exp.ready.length + ' experiment result' + (S.exp.ready.length > 1 ? 's' : '') + ' to decide on', 'growth', '#C9A45C']);
    if (si.A.bottleneck === 'sales' && si.A.salesOpps - si.A.cap > 1) a.push(['Deals are piling up: hire Sales Executives or AEs', 'team', '#C9A45C']);
    if (si.A.bottleneck !== 'sales' && si.A.cap - si.A.salesOpps > 3) a.push(['Sales has spare capacity: invest in channels', 'growth', '#8E959E']);
    var sup = FS.support(S); if (sup.sla < 0.9) a.push(['Support is overloaded: SLA at ' + Math.round(sup.sla * 100) + '%', 'ops', '#E08B7C']);
    if (FS.launchable(S).length) a.push(['A shipped feature is ready to launch', 'product', '#8E959E']);
    if (m.g3 < 0.04 && S.month > 4) a.push(['Growth is ' + pct(m.g3) + ' a month', 'overview', '#E08B7C']);
    return a.slice(0, 7);
  }

  function vOverview(m) {
    var hl = headline(m), ag = agenda(m);
    var mrrPts = S.history.map(function (h) { return [h.m, h.mrr]; });
    var segs = Object.keys(S.segments).map(function (k) {
      var g = S.segments[k];
      var share = g.cust / g.tam;
      var act = '';
      if (!g.unlocked) {
        var c = { str: g.str, cash: g.cost };
        var can = afford(c) && !(k === 'ent' && !(S.product.shipped.indexOf('sso') >= 0 && S.people.some(function (p) { return p.role === 'hos'; }))) && !(k === 'sea' && !S.fund.raised);
        act = btn('Enter', 'enter', { seg: k }, { cls: 'sm ghost', cost: c, disabled: !can });
      }
      return '<div class="prov ' + (k === 'blr' ? 'home' : '') + (g.unlocked ? '' : ' locked') + '"><div class="top2"><span class="nm">' + esc(g.name) + '</span><span class="pill' + (g.unlocked ? (k === 'blr' ? ' acc' : '') : '') + '">' + (k === 'blr' ? 'HOME' : g.unlocked ? 'ACTIVE' : 'LOCKED') + '</span></div>' +
        (g.unlocked ? '<span class="sh">' + Math.round(share * 100) + '%</span><div class="bar"><i style="width:' + Math.min(100, share * 100) + '%"></i></div><span class="meta">' + g.cust + ' OF ~' + g.tam + ' ACCOUNTS · ARPA ' + L(g.arpa * S.price, 2) + '</span>'
          : '<span class="meta" style="flex:1">ARPA ~' + L(g.arpa, 2) + ' · ~' + g.tam + ' ACCOUNTS</span><span class="note">' + esc(g.need) + '</span>' + act) + '</div>';
    }).join('');
    var keys = S.keys.filter(function (k) { return k.active; }).sort(function (a, b) { return b.mrr - a.mrr; }).slice(0, 3);
    return '<div class="head"><div><div class="eyebrow acc">Month ' + mm(S.month) + ' · Overview</div><h1>' + esc(hl[0]) + ' <span class="em">' + esc(hl[1]) + '</span></h1></div></div>' +
      '<div class="grid gside"><div class="grid" style="align-content:start">' +
      '<div class="grid g2"><section class="card"><div class="ch"><span class="eyebrow">This month\'s agenda</span><span class="mono faint" style="font-size:10px">' + (S.focus.str + S.focus.ops + S.focus.ppl) + ' FOCUS LEFT</span></div><div class="agenda">' +
      (ag.length ? ag.map(function (x) { return '<button type="button" data-act="view" data-v="' + x[1] + '"><span class="dot" style="background:' + x[2] + '"></span><span class="t">' + esc(x[0]) + '</span><span class="p">' + x[1].toUpperCase() + '</span>' + ARROW + '</button>'; }).join('') : '<p class="cb note">Nothing urgent. Spend your focus on growth, then end the month.</p>') +
      '</div></section>' +
      '<section class="card"><div class="ch"><span class="eyebrow">MRR</span><span class="mono" style="font-size:12px">ARR ' + L(m.arr) + '</span></div><div class="cb">' + lineChart([{ pts: mrrPts, color: '#C9A45C', dot: true }], { w: 400, h: 190, fmt: function (v) { return v.toFixed(0) + 'L'; }, label: 'Monthly recurring revenue by month', xmax: Math.max(12, S.month + 2) }) + '</div></section></div>' +
      '<section class="card"><div class="ch"><span class="eyebrow">Market map · segments</span><span class="mono faint" style="font-size:10px">STACKLINE IS IN EVERY SEGMENT</span></div><div class="map">' + segs + '</div></section>' +
      '</div><aside class="grid" style="align-content:start">' +
      '<section class="card"><div class="ch"><span class="eyebrow">Company</span></div><div class="rows">' +
      [['Customers', m.customers], ['Avg revenue / account', L(m.arpa, 2) + '/mo'], ['Monthly logo churn', pct(m.churn)], ['Net revenue retention', Math.round(m.nrr * 100) + '%'], ['3-month growth', S.history.length > 1 ? pct(m.g3) + '/mo' : '—'], ['Largest customer', Math.round(m.conc * 100) + '% of MRR']].map(function (r) { return '<div><span class="k">' + r[0] + '</span><span class="v">' + esc(r[1]) + '</span></div>'; }).join('') +
      '</div></section>' +
      goalsCard() + crisisCard() +
      '<section class="card"><div class="ch"><span class="eyebrow">Key accounts</span></div><div class="rows">' + keys.map(function (k) { return '<div><span class="k">' + esc(k.name) + '</span><span class="v">' + L(k.mrr, 2) + ' · ' + Math.round(k.mrr / m.mrr * 100) + '%</span></div>'; }).join('') + '</div></section>' +
      '<section class="card"><div class="ch"><span class="eyebrow">Market feed</span></div><div class="feed">' + S.news.slice(0, 6).map(function (n) { return '<div><span class="w">MONTH ' + mm(n.m) + '</span><span class="x">' + esc(n.text) + '</span></div>'; }).join('') + '</div></section>' +
      '</aside></div>';
  }

  function goalsCard() {
    var ng = FS.nextGoals(S), done = Object.keys(S.goals).length;
    var okr = S.okrs.length ? '<div class="fnh">BOARD TARGETS FOR THIS QUARTER</div><div class="rows">' + S.okrs.map(function (o) { var ok = FS.okrMet(S, o); return '<div><span class="k">' + esc(o.label) + '</span><span class="v ' + (ok ? 'up' : 'mut') + '">' + (ok ? 'ON TRACK' : 'OPEN') + '</span></div>'; }).join('') + '</div>' : '';
    return '<section class="card"><div class="ch"><span class="eyebrow">Next milestones</span><button type="button" class="linkb" data-act="view" data-v="goals">' + done + ' / ' + FS.GOALS.length + ' DONE</button></div><div class="rows">' +
      ng.map(function (g) { return '<div><span class="k">' + esc(g.name) + '</span><span class="v faint" style="font-size:10px">' + esc(g.ch.toUpperCase()) + '</span></div>'; }).join('') + '</div>' + okr + '</section>';
  }
  function crisisCard() {
    var c = (S.crises || []).filter(function (x) { return x.m >= S.month - 4; });
    var sec = FS.secScore(S), sup = FS.support(S);
    return '<section class="card' + (c.length ? ' crisis' : '') + '"><div class="ch"><span class="eyebrow' + (c.length ? ' down' : '') + '">Crisis room</span><span class="mono faint" style="font-size:10px">SECURITY ' + Math.round(sec) + ' · SLA ' + Math.round(sup.sla * 100) + '%</span></div>' +
      (c.length ? c.slice(0, 3).map(function (x) { return '<div class="alert"><span class="lv down">M' + mm(x.m) + '</span><span><b style="font-weight:500">' + esc(x.title) + '</b><br><span class="note">' + esc(x.tag) + ' · ' + esc(x.choice) + '</span></span></div>'; }).join('') : '<p class="cb note">No crises in the last four months. Tech debt, weak security and heavy paid spend all raise the odds.</p>') + '</section>';
  }

  function vFinance(m) {
    var h = S.history, prev = h.length > 1 ? h[h.length - 2] : null;
    var cashPts = h.map(function (x) { return [x.m, x.cash / 100]; });
    var proj = [[S.month, S.cash / 100]], c = S.cash, mo = S.month;
    while (c > 0 && mo < 36 && m.cashOut > 0) { mo++; c -= m.cashOut; proj.push([mo, Math.max(0, c) / 100]); }
    if (m.cashOut <= 0) proj.push([36, (S.cash - m.cashOut * (36 - S.month)) / 100]);
    var zero = m.cashOut > 0 ? S.month + S.cash / m.cashOut : null;
    var si = FS.salesInfo(S);
    var row = function (label, a, b, strong, inv) {
      var d = b == null ? '' : (a - b);
      var tone = d === '' || Math.abs(d) < 0.05 ? 'mut' : ((d > 0) !== !!inv ? 'up' : 'down');
      return '<tr class="' + (strong ? 'strong' : '') + '"><td>' + label + '</td><td>' + a.toFixed(1) + '</td><td class="mut">' + (b == null ? '—' : b.toFixed(1)) + '</td><td class="' + tone + '">' + (d === '' ? '—' : (d >= 0 ? '+' : '−') + Math.abs(d).toFixed(1)) + '</td></tr>';
    };
    var dsoTxt = 'Receivables ' + L(S.ar) + ' · ' + Math.round(FS.dso(S)) + ' days to collect';
    var debtTxt = S.vdebt.taken ? 'Drawn: ' + L(S.vdebt.principal) + ' outstanding at 14%.' : 'Lenders offer ₹1.5 Cr at 14%, repaid over 18 months after a 12-month holiday. Needs ₹90L ARR and 4+ months of runway.';
    return '<div class="head"><div><div class="eyebrow acc">Finance</div><h1>' + (zero ? 'On current burn, cash runs out in <span class="em">month ' + zero.toFixed(1) + '.</span>' : 'Cash-flow positive. <span class="em">Every rupee is now a choice.</span>') + '</h1></div></div>' +
      '<div class="kpis">' +
      [['CASH', L(S.cash), 'RAISED ' + L(S.raisedTotal) + ' TO DATE', 'mut'], ['NET BURN', L(Math.max(0, m.burn)), m.burn <= 0 ? 'PROFITABLE' : 'GROSS COSTS ' + L(m.costs), m.burn > 0 ? 'down' : 'up'], ['RUNWAY', rw(m.runway), zero ? 'ZERO CASH IN M' + zero.toFixed(1) : 'NO CLIFF', m.runway < 9 ? 'down' : 'up'], ['GROSS MARGIN', pct(m.gm, 0), 'INFRA ' + L(m.infra) + '/MO', m.gm < 0.7 ? 'down' : 'mut'], ['BURN MULTIPLE', m.bm > 50 ? '—' : m.bm.toFixed(1) + '×', 'INVESTORS WANT < 2.5×', m.bm > 2.5 ? 'down' : 'up']]
        .map(function (k) { return '<div class="kpi"><span class="eyebrow">' + k[0] + '</span><span class="v">' + esc(k[1]) + '</span><span class="n ' + k[3] + '">' + esc(k[2]) + '</span></div>'; }).join('') + '</div>' +
      '<div class="grid gside"><div class="grid" style="align-content:start">' +
      '<section class="card"><div class="ch"><span class="eyebrow">Cash · ₹ Cr · actual and projected at today\'s burn</span></div><div class="cb">' +
      lineChart([{ pts: proj, color: '#ECE6DA', dash: '6 4' }, { pts: cashPts, color: '#C9A45C', dot: true }], { h: 210, now: S.month, fmt: function (v) { return v.toFixed(1); }, label: 'Cash balance by month with projection' }) + '</div></section>' +
      '<section class="card"><div class="ch"><span class="eyebrow">P&amp;L · ₹ lakh · this month</span><span class="mono faint" style="font-size:10px">VS LAST MONTH</span></div><table><thead><tr><th>Line</th><th>M' + mm(S.month) + '</th><th>M' + mm(Math.max(1, S.month - 1)) + '</th><th>Change</th></tr></thead><tbody>' +
      row('Revenue (MRR)', m.mrr, prev && prev.mrr, true) + row('Payroll (' + m.headcount + ' people)', m.payroll, prev && prev.payroll, false, true) + row('Infrastructure', m.infra, prev && prev.infra, false, true) + row('Rent and tools', m.other, prev && prev.other, false, true) + row('Growth spend', m.marketing, prev && prev.mkt, false, true) + (m.revShare ? row('Partner revenue share', m.revShare, null, false, true) : '') + (m.otherRev ? row('Payments income', m.otherRev, null) : '') + (m.interest ? row('Debt interest', m.interest, prev && prev.interest, false, true) : '') + row('Net burn', -m.burn, prev ? -prev.burn : null, true) +
      '</tbody></table><p class="cb note">' + dsoTxt + (S.credits > 0 ? ' · Cloud credits left ' + L(S.credits) : '') + '. Full P&amp;L, cash flow and MIS are in Reports.</p></section></div>' +
      '<aside class="grid" style="align-content:start">' +
      '<section class="card hl"><div class="ch"><span class="eyebrow acc">Growth spend</span><span class="mono" style="font-size:12px">' + L(S.marketing) + '/mo</span></div><div class="cb" style="display:flex;flex-direction:column;gap:12px">' +
      '<p class="note">Spread across ' + FS.CH_ORDER.filter(function (c) { return S.channels[c] > 0; }).length + ' channels. Last month it bought ' + ((S.lastAcq && S.lastAcq.leads) || si.A.leads).toFixed(0) + ' leads and ' + ((S.lastAcq && S.lastAcq.cust) || 0) + ' new customers. <b class="' + (si.bottleneck === 'sales' ? 'down' : 'acc') + '">Bottleneck: ' + si.bottleneck + '.</b></p>' +
      btn('Open Growth to change spend', 'view', { v: 'growth' }, { cls: 'sm ghost' }) + '</div></section>' +
      '<section class="card"><div class="ch"><span class="eyebrow">Unit economics</span></div><div class="rows">' +
      [['CAC (programmes)', L(m.cac)], ['Avg revenue / account', L(m.arpa, 2) + '/mo'], ['CAC payback', m.payback > 60 ? '—' : m.payback.toFixed(1) + ' mo'], ['Logo churn', pct(m.churn) + '/mo'], ['NRR (annualised)', Math.round(m.nrr * 100) + '%']].map(function (r) { return '<div><span class="k">' + r[0] + '</span><span class="v">' + r[1] + '</span></div>'; }).join('') + '</div></section>' +
      '<section class="card"><div class="ch"><span class="eyebrow">Pricing</span><span class="mono" style="font-size:12px">INDEX ' + S.price.toFixed(2) + '</span></div><div class="cb" style="display:flex;flex-direction:column;gap:10px"><p class="note">Changes apply to all accounts. Raising prices lifts revenue but triggers churn for two months.</p><div style="display:flex;gap:8px;flex-wrap:wrap">' +
      btn('Raise 10%', 'price', { dir: 'up' }, { cls: 'sm', cost: { str: 1 }, disabled: !afford({ str: 1 }) || S.flags.priceMonth === S.month }) + btn('Cut 10%', 'price', { dir: 'down' }, { cls: 'sm', cost: { str: 1 }, disabled: !afford({ str: 1 }) || S.flags.priceMonth === S.month }) + '</div></div></section>' +
      '<section class="card"><div class="ch"><span class="eyebrow">Venture debt</span></div><div class="cb" style="display:flex;flex-direction:column;gap:10px"><p class="note">' + debtTxt + '</p>' + (S.vdebt.taken ? '' : btn('Draw ₹1.5 Cr', 'vdebt', {}, { cls: 'sm ghost', cost: { str: 1 }, disabled: !afford({ str: 1 }) })) + '</div></section>' +
      '</aside></div>';
  }

  var CATC = { Fit: 'acc', Retention: 'up', Growth: 'up', Monetisation: 'acc', Enterprise: 'mut', Platform: 'mut', Security: 'mut', Custom: 'down', Partner: 'mut' };
  var bfilter = 'All';
  function vProduct(m) {
    var e = m.eng, P = S.product;
    var bugs = Math.round(3 + P.debt * 0.22), fit = P.pmf >= 0.68 ? ['Strong', 'up'] : P.pmf >= 0.58 ? ['Good', 'up'] : P.pmf >= 0.5 ? ['Lukewarm', 'acc'] : ['Weak', 'down'];
    var fw = Math.max(0.1, e.feature), cum = 0;
    function chips(it) { return '<span class="pill ' + (CATC[it.cat] || '') + '">' + esc(it.cat.toUpperCase()) + '</span>'; }
    var q = P.queue.map(function (id, i) {
      var it = FS.item(S, id); if (!it) return '';
      var done = P.progress[id] || 0, left = it.effort - done; cum += left;
      var eta = Math.ceil(cum / fw), est = FS.itemEstimate(S, id);
      return '<div class="qitem"><span class="n">' + mm(i + 1) + '</span><div style="display:flex;flex-direction:column;gap:6px;min-width:0"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><span class="t">' + esc(it.name) + ' ' + chips(it) + '</span><span class="mono mut" style="font-size:11px;white-space:nowrap">' + Math.round(done) + ' / ' + it.effort + ' WKS · ETA ' + (eta <= 1 ? 'THIS MONTH' : eta + ' MO') + '</span></div><div class="bar"><i style="width:' + (done / it.effort * 100) + '%"></i></div><span class="w">' + esc(it.why) + '</span><span class="w acc">Expected: ' + esc(est.text) + (est.conf !== 'Fixed' ? ' <span class="faint">· confidence ' + est.conf.toLowerCase() + '</span>' : '') + '</span></div>' +
        '<div class="acts"><button class="icon" type="button" data-act="q" data-op="up" data-id="' + id + '" aria-label="Move ' + esc(it.name) + ' up"' + (i === 0 ? ' disabled' : '') + '>↑</button><button class="icon" type="button" data-act="q" data-op="down" data-id="' + id + '" aria-label="Move ' + esc(it.name) + ' down"' + (i === P.queue.length - 1 ? ' disabled' : '') + '>↓</button><button class="icon" type="button" data-act="q" data-op="remove" data-id="' + id + '" aria-label="Remove ' + esc(it.name) + ' from queue">×</button></div></div>';
    }).join('');
    var cats = ['All'].concat(P.backlog.map(function (id) { var it = FS.item(S, id); return it ? it.cat : ''; }).filter(function (c, i, a) { return c && a.indexOf(c) === i; }));
    if (cats.indexOf(bfilter) < 0) bfilter = 'All';
    var b = P.backlog.map(function (id) {
      var it = FS.item(S, id); if (!it || (bfilter !== 'All' && it.cat !== bfilter)) return '';
      var est = FS.itemEstimate(S, id);
      return '<div class="qitem" style="grid-template-columns:minmax(0,1fr) auto"><div style="display:flex;flex-direction:column;gap:4px;min-width:0"><span class="t">' + esc(it.name) + ' ' + chips(it) + ' <span class="mono faint" style="font-size:11px;font-weight:400">' + it.effort + ' WKS' + (P.progress[id] ? ' · ' + Math.round(P.progress[id]) + ' DONE' : '') + '</span></span><span class="w">' + esc(it.why) + ' <span class="faint">Source: ' + esc(it.src || '—') + '.</span></span><span class="w acc">Expected: ' + esc(est.text) + '</span></div>' + btn('Add to queue', 'q', { op: 'add', id: id }, { cls: 'sm' }) + '</div>';
    }).join('');
    var launch = FS.launchable(S).map(function (id) {
      var it = FS.item(S, id);
      return '<div class="lrow" style="flex-wrap:wrap;padding:10px 16px"><span class="k" style="flex:1;min-width:140px">' + esc(it.name) + '</span><span class="lbtns">' + FS.LAUNCH.map(function (T, i) { return btn(['Small ₹1L', 'Medium ₹4L', 'Big ₹10L'][i], 'do', { a: 'launch', p: JSON.stringify({ id: id, tier: i }) }, { cls: 'sm', disabled: !afford(T.cost), title: T.name + ' · ' + costTxt(T.cost) }); }).join('') + '</span></div>';
    }).join('');
    return '<div class="head"><div><div class="eyebrow acc">Product</div><h1>' + (P.debt > 60 ? 'Tech debt now eats <span class="em">' + Math.round(e.bugTax * 100) + '% of every sprint.</span>' : 'The team ships <span class="em">' + e.feature.toFixed(0) + ' eng-weeks a month.</span>') + '</h1></div></div>' +
      '<div class="kpis">' +
      [['CAPACITY', e.raw.toFixed(0) + ' wks', e.ics + ' ENGINEERS + CTO', 'mut'], ['TO FEATURES', e.feature.toFixed(1) + ' wks', e.maint > 0.05 ? e.maint.toFixed(1) + ' WKS ON CUSTOM UPKEEP' : 'AFTER BUGS AND DEBT WORK', e.maint > 2 ? 'down' : 'acc'], ['BUGS / WEEK', String(bugs), 'RISES WITH TECH DEBT', bugs > 14 ? 'down' : 'mut'], ['PRODUCTIVITY', Math.round(e.prod * 100) + '%', e.span < 1 ? 'CTO SPAN TOO WIDE' : 'DEBT, MORALE, SPAN', e.prod < 0.7 ? 'down' : 'mut'], ['FIT SIGNAL', fit[0], 'ERODES ~0.25 PTS A MONTH', fit[1]]]
        .map(function (k) { return '<div class="kpi"><span class="eyebrow">' + k[0] + '</span><span class="v">' + esc(k[1]) + '</span><span class="n ' + k[3] + '">' + esc(k[2]) + '</span></div>'; }).join('') + '</div>' +
      '<div class="grid gside"><div class="grid" style="align-content:start">' +
      '<section class="card"><div class="ch"><span class="eyebrow">Roadmap queue · engineers work top-down</span><span class="mono faint" style="font-size:10px">' + P.queue.length + ' ITEMS</span></div>' + (q || '<p class="cb note down">The queue is empty. Engineers will sit idle; add something from the backlog.</p>') + '</section>' +
      '<section class="card"><div class="ch"><span class="eyebrow">Backlog · new ideas arrive as the product matures</span><span class="mono faint" style="font-size:10px">' + P.backlog.length + ' IDEAS</span></div>' +
      '<div class="cb" style="padding-bottom:0"><div class="seg" role="group" aria-label="Filter backlog">' + cats.map(function (c) { return '<button type="button" data-act="bfilter" data-v="' + esc(c) + '" aria-pressed="' + (bfilter === c) + '">' + esc(c) + '</button>'; }).join('') + '</div></div>' +
      (b || '<p class="cb note">Nothing in this category. New ideas arrive every month.</p>') + '</section>' +
      '</div><aside class="grid" style="align-content:start">' +
      '<section class="card hl"><div class="ch"><span class="eyebrow acc">Debt allocation</span><span class="mono" style="font-size:12px">' + P.alloc + '% TO DEBT</span></div><div class="cb" style="display:flex;flex-direction:column;gap:12px">' +
      '<div class="seg" role="group" aria-label="Share of capacity to tech debt">' + [0, 10, 20, 30, 40, 50].map(function (v) { return '<button type="button" data-act="alloc" data-v="' + v + '" aria-pressed="' + (P.alloc === v) + '">' + v + '%</button>'; }).join('') + '</div>' +
      '<div class="stack" role="img" aria-label="Capacity split"><i style="width:' + (e.bugTax * 100) + '%;background:#E08B7C"></i><i style="width:' + ((1 - e.bugTax) * (1 - P.alloc / 100) * 100) + '%;background:#C9A45C"></i><i style="width:' + ((1 - e.bugTax) * P.alloc) + '%;background:#8E959E"></i></div>' +
      '<p class="note"><span class="down">■</span> Bugs ' + Math.round(e.bugTax * 100) + '% &nbsp; <span class="acc">■</span> Features &nbsp; <span class="mut">■</span> Debt. Debt work lowers future bug load; too little and the bug tax compounds.' + (P.maint > 0 ? ' Custom enterprise work also costs ' + P.maint.toFixed(1) + ' eng-weeks of upkeep every month.' : '') + '</p>' + (S.flags.sprintUntil ? '<p class="note acc">A debt sprint is running until month ' + S.flags.sprintUntil + '.</p>' : '') + '</div></section>' +
      '<section class="card"><div class="ch"><span class="eyebrow">Launch what you shipped</span><span class="mono faint" style="font-size:10px">−1 STR EACH</span></div>' + (launch || '<p class="cb note">Features shipped in the last three months can be launched to create a burst of leads. Size the launch to the feature.</p>') + '</section>' +
      '<section class="card"><div class="ch"><span class="eyebrow">How estimates work</span></div><p class="cb note">Expected impact is a guess until a feature ships. A Product Manager narrows the guess and lifts real impact; a Data Analyst sharpens it further. Gains shrink as fit approaches its ceiling, and rivals erode fit every month.</p></section>' +
      '<section class="card"><div class="ch"><span class="eyebrow">Shipped</span><span class="mono faint" style="font-size:10px">' + P.shipped.length + '</span></div><div class="cb" style="display:flex;flex-wrap:wrap;gap:6px">' + (P.shipped.length ? P.shipped.slice().reverse().slice(0, 24).map(function (id) { var it = FS.item(S, id); return '<span class="pill up" title="' + esc(it.realised ? 'Impact ×' + it.realised : '') + '">' + esc(it.name) + '</span>'; }).join('') : '<span class="note">Nothing yet.</span>') + '</div></section>' +
      '</aside></div>';
  }

  var FN = [['exec', 'Leadership'], ['eng', 'Engineering'], ['product', 'Product'], ['sales', 'Sales'], ['cs', 'Customer success'], ['mkt', 'Marketing'], ['ops', 'Operations and G&A']];
  function vTeam(m) {
    var list = FN.map(function (f) {
      var ps = S.people.filter(function (p) { return p.fn === f[0] || (f[0] === 'exec' && p.id === 'you'); });
      if (f[0] === 'eng') ps = S.people.filter(function (p) { return p.fn === 'eng'; });
      if (!ps.length) return '';
      return '<div class="fnh">' + f[1].toUpperCase() + ' · ' + ps.length + '</div>' + ps.map(function (p) {
        var r = risk(p);
        return '<button type="button" class="prow" data-act="selp" data-id="' + p.id + '" aria-pressed="' + (selPerson === p.id) + '"><span style="min-width:0"><span class="nm">' + esc(p.name) + (p.lead ? ' <span class="pill acc">LEAD</span>' : '') + (p.ramp > 0 ? ' <span class="pill">RAMPING</span>' : '') + '</span><br><span class="ti">' + esc(p.title) + '</span></span><span class="ti hide-s">' + (p.founder ? 'Founder' : p.joined ? 'Joined M' + mm(p.joined) : 'Since seed') + '</span><span class="mono">₹' + p.salary + 'L</span><span class="mono ' + (p.id === 'you' ? 'mut' : p.morale < 55 ? 'down' : '') + '">' + (p.id === 'you' ? '—' : 'Morale ' + Math.round(p.morale)) + '</span><span class="mono hide-s ' + r[1] + '">' + (p.founder ? '' : r[0]) + '</span></button>';
      }).join('');
    }).join('');
    var p = selPerson && FS.findP(S, selPerson);
    var detail;
    if (p && !p.founder) {
      var r = risk(p);
      detail = '<section class="card hl"><div class="ch"><span class="eyebrow ' + r[1] + '">Selected · flight risk ' + r[0].toLowerCase() + '</span></div><div class="cb" style="display:flex;flex-direction:column;gap:14px">' +
        '<div><h2 class="serif" style="font-size:30px">' + esc(p.name) + '</h2><span class="mut">' + esc(p.title) + '</span></div>' +
        '<div class="statrow" style="grid-template-columns:repeat(2,1fr)">' + [['SALARY', '₹' + p.salary + 'L/yr'], ['MORALE', Math.round(p.morale)], ['PERFORMANCE', p.skill >= 1.25 ? 'Top 10%' : p.skill >= 1.1 ? 'Strong' : p.skill >= 0.9 ? 'Solid' : 'Below bar'], ['EQUITY', p.equity ? p.equity.toFixed(2) + '%' : 'None']].map(function (x) { return '<div><span class="l">' + x[0] + '</span><span class="v">' + x[1] + '</span></div>'; }).join('') + '</div>' +
        '<div style="display:flex;flex-direction:column;gap:8px">' +
        btn('Raise pay by 18%', 'praise', { id: p.id }, { cost: { ppl: 1 }, disabled: !afford({ ppl: 1 }) }) +
        btn('Grant 0.25% ESOP', 'pesop', { id: p.id }, { cost: { ppl: 1 }, disabled: !afford({ ppl: 1 }) || S.cap.pool - S.poolUsed < 0.25 }) +
        (p.fn === 'eng' && !p.lead && p.role !== 'em' ? btn('Promote to tech lead', 'promote', { id: p.id }, { cost: { ppl: 2 }, disabled: !afford({ ppl: 2 }) || p.skill < 1.15, title: p.skill < 1.15 ? 'Only strong senior engineers can lead' : '' }) : '') +
        btn('Let go (1 month severance)', 'fire', { id: p.id }, { cost: { ppl: 1 }, disabled: !afford({ ppl: 1 }) }) +
        '</div></div></section>';
    } else detail = '<section class="card"><div class="cb note">Select a person to see their pay, morale and performance, and to act on it. People with morale below 45 are likely to quit.</div></section>';
    var RG = [['Sales', ['se', 'ae', 'sdr', 'hos']], ['Marketing', ['mkt', 'perf', 'pmm']], ['Product and engineering', ['eng', 'seng', 'em', 'pm', 'designer', 'data', 'sre', 'sec']], ['Customers', ['csm', 'support', 'solutions']], ['Operations', ['fin', 'recruiter', 'partner']]];
    var roles = RG.map(function (g) {
      return '<div class="fnh" style="grid-column:1/-1;margin:4px -16px 0">' + g[0].toUpperCase() + '</div>' + g[1].map(function (rid) {
        var R = FS.ROLES[rid], dis = !afford({ ppl: 1 }) || (rid === 'hos' && (S.people.some(function (x) { return x.role === 'hos'; }) || S.pipeline.some(function (x) { return x.role === 'hos'; })));
        var n = S.people.filter(function (x) { return x.role === rid; }).length;
        return '<button type="button" class="roleb" data-act="cands" data-role="' + rid + '"' + (dis ? ' disabled' : '') + '><span class="t">' + R.title + (n ? ' <span class="faint mono" style="font-size:10px">×' + n + '</span>' : '') + '</span><span class="s">~₹' + R.salary + 'L/YR · −1 PPL</span><span class="note" style="font-size:11px">' + esc(R.what) + '</span></button>';
      }).join('');
    }).join('');
    var e = m.eng;
    return '<div class="head"><div><div class="eyebrow acc">Team &amp; Org</div><h1>' + m.headcount + ' people. <span class="em">Payroll ' + L(m.payroll) + ' a month.</span></h1></div></div>' +
      '<div class="kpis">' + [['AVG MORALE', Math.round(m.morale), m.morale < 60 ? 'LOW' : 'STABLE', m.morale < 60 ? 'down' : 'mut'], ['FLIGHT RISKS', S.people.filter(function (p) { return !p.founder && p.morale < 50; }).length, 'MORALE UNDER 50', 'mut'], ['REGRETTED EXITS', S.regretted, 'STRONG PEOPLE WHO LEFT', S.regretted ? 'down' : 'mut'], ['CTO SPAN', e.reports, e.reports > 7 ? 'TOO WIDE: VELOCITY SUFFERS' : 'HEALTHY', e.reports > 7 ? 'down' : 'up'], ['ESOP LEFT', (S.cap.pool - S.poolUsed).toFixed(2) + '%', 'OF ' + S.cap.pool.toFixed(1) + '% POOL', 'mut']]
        .map(function (k) { return '<div class="kpi"><span class="eyebrow">' + k[0] + '</span><span class="v">' + esc(k[1]) + '</span><span class="n ' + k[3] + '">' + esc(k[2]) + '</span></div>'; }).join('') + '</div>' +
      '<div class="grid gside"><section class="card" style="align-self:start"><div class="ch"><span class="eyebrow">People · click to act</span></div>' + list + '</section>' +
      '<aside class="grid" style="align-content:start">' + detail +
      '<section class="card"><div class="ch"><span class="eyebrow">Hire</span><span class="mono faint" style="font-size:10px">STARTS NEXT MONTH · RECRUITER FEE</span></div><div class="roles">' + roles + '</div>' +
      (S.pipeline.length ? '<div class="rows" style="border-top:1px solid var(--line)">' + S.pipeline.map(function (h) { return '<div><span class="k">' + esc(h.name) + ' · ' + esc(h.title) + '</span><span class="v acc">M' + mm(h.arrive) + '</span></div>'; }).join('') + '</div>' : '') + '</section>' +
      '<section class="card"><div class="ch"><span class="eyebrow">Culture and you</span></div><div class="cb" style="display:flex;flex-direction:column;gap:8px">' +
      btn('Team offsite', 'offsite', {}, { cost: { ops: 1, cash: 6 }, disabled: !afford({ ops: 1, cash: 6 }) }) +
      btn('Take a week off yourself', 'rest', {}, { disabled: S.flags.restMonth === S.month, title: 'Energy +28; uses this month\'s Ops focus' }) +
      '<p class="note">Your energy is ' + Math.round(S.energy) + '%. Below 30%, you lose a focus point in every pool each month.</p></div></section>' +
      '</aside></div>';
  }

  function vCapital(m) {
    var F = S.fund, cap = S.cap;
    var capRows = [['You', cap.you, '#C9A45C'], ['Arjun Rao', cap.arjun, '#C9A45C'], ['Banyan Seed Fund', cap.banyan, '#ECE6DA'], ['Angels', cap.angels, '#8E959E'], ['Series A investors', cap.newInv, '#7DB892'], ['Bridge', cap.bridge, '#B8C4D6'], ['ESOP pool', cap.pool, '#4A525C']].filter(function (r) { return r[1] > 0.01; });
    var bar = '<div class="stack" style="height:16px">' + capRows.map(function (r) { return '<i style="width:' + r[1] + '%;background:' + r[2] + '"></i>'; }).join('') + '</div>';
    var status = { none: 'Not started', active: 'Raising · month ' + F.months, termsheet: 'Term sheet received', closed: 'Closed', failed: 'Failed · retry from M' + F.cooldown }[F.status];
    var fundsRows = FS.FUNDS.map(function (f) {
      var i = FS.fundInterest(S, f), lbl = i >= 0.62 ? ['Hot', 'up'] : i >= 0.57 ? ['Warm', 'acc'] : i >= 0.5 ? ['Lukewarm', 'mut'] : ['Cold', 'down'];
      var n = F.pitched[f.id] || 0;
      return '<tr><td>' + esc(f.name) + '<br><span class="mono faint" style="font-size:10px">' + esc(f.path).toUpperCase() + '</span></td><td class="' + lbl[1] + '">' + (F.status === 'active' || F.status === 'termsheet' ? lbl[0] : '—') + '</td><td>' + n + ' / 2</td><td>' + btn(n ? 'Partner meeting' : 'Pitch', 'pitch', { fund: f.id }, { cls: 'sm', cost: { str: 1 }, disabled: F.status !== 'active' || n >= 2 || !afford({ str: 1 }) }) + '</td></tr>';
    }).join('');
    var offer = '';
    if (F.offer) {
      var o = F.offer;
      offer = '<section class="card hl"><div class="ch"><span class="eyebrow acc">Term sheet · ' + esc(o.fund) + '</span><span class="mono" style="font-size:12px">PRE-MONEY ' + L(o.pre) + '</span></div><div class="cb" style="display:flex;flex-direction:column;gap:12px"><p class="note">Pick a round size. Larger rounds buy runway and cost ownership.</p>' +
        o.options.map(function (a, i) { var d = a / (o.pre + a); return '<button type="button" class="choice" data-act="accept" data-i="' + i + '"><span class="lt">' + 'ABC'[i] + '</span><span><span class="t">Raise ' + L(a) + '</span><span class="e" style="display:block">' + pct(d) + ' DILUTION · YOU OWN ' + (cap.you * (1 - d)).toFixed(1) + '% AFTER</span></span><span class="mono acc" style="font-size:11px">ACCEPT</span></button>'; }).join('') +
        btn('Decline and keep raising', 'decline', {}, { cls: 'sm' }) + '</div></section>';
    }
    var canBridge = !S.bridge.used && S.board >= 45;
    return '<div class="head"><div><div class="eyebrow acc">Capital &amp; Board</div><h1>' + (F.raised ? 'Series A closed. <span class="em">You own ' + cap.you.toFixed(1) + '%.</span>' : 'You own ' + cap.you.toFixed(1) + '%. <span class="em">Raise before you have to.</span>') + '</h1></div></div>' +
      '<div class="grid gside"><div class="grid" style="align-content:start">' + offer +
      '<section class="card' + (F.offer ? '' : ' hl') + '"><div class="ch"><span class="eyebrow acc">Series A · ' + esc(status) + '</span>' + (F.status === 'none' || (F.status === 'failed' && S.month >= F.cooldown) ? btn('Start the raise', 'startRaise', {}, { cls: 'primary sm', cost: { str: 2 }, disabled: !afford({ str: 2 }) }) : '') + '</div>' +
      '<div class="cb note">' + (F.raised ? 'Raised in month ' + F.closedAt + ' at a post-money of ' + L(F.post) + '.' : 'A raise takes at least three months. It costs 1 Strategy focus every month it runs. Investors weigh ARR, growth, net retention, burn multiple and board confidence. Pitching a fund raises its interest. Term sheets arrive once a fund is Hot. After six months without one, the process fails.') + '</div>' +
      (F.raised ? '' : '<table><thead><tr><th>Fund</th><th>Interest</th><th>Meetings</th><th></th></tr></thead><tbody>' + fundsRows + '</tbody></table>') + '</section>' +
      '<section class="card"><div class="ch"><span class="eyebrow">What investors see</span></div><div class="rows">' +
      [['ARR', L(m.arr), 'Bar ~₹6 Cr', m.arr >= 600], ['Monthly growth (3-mo)', pct(m.g3), 'Bar 8%', m.g3 >= 0.08], ['Net revenue retention', Math.round(m.nrr * 100) + '%', 'Bar 110%', m.nrr >= 1.1], ['Burn multiple', m.bm > 50 ? '—' : m.bm.toFixed(1) + '×', 'Bar < 2.5×', m.bm <= 2.5], ['Board confidence', Math.round(S.board), 'Higher is better', S.board >= 65]]
        .map(function (r) { return '<div><span class="k">' + r[0] + ' <span class="faint mono" style="font-size:10px">' + r[2].toUpperCase() + '</span></span><span class="v ' + (r[3] ? 'up' : 'down') + '">' + r[1] + '</span></div>'; }).join('') + '</div></section>' +
      '</div><aside class="grid" style="align-content:start">' +
      '<section class="card"><div class="ch"><span class="eyebrow">Cap table · fully diluted</span></div><div class="cb">' + bar + '</div><div class="rows">' + capRows.map(function (r) { return '<div><span class="k"><span style="display:inline-block;width:8px;height:8px;background:' + r[2] + ';margin-right:8px"></span>' + r[0] + '</span><span class="v">' + r[1].toFixed(1) + '%</span></div>'; }).join('') + '</div></section>' +
      '<section class="card"><div class="ch"><span class="eyebrow">Board · ' + Math.round(S.board) + ' / 100</span><span class="mono faint" style="font-size:10px">NEXT MEETING M' + mm(Math.ceil(S.month / 3) * 3) + '</span></div><div class="rows"><div><span class="k">Anita Desai · Banyan Seed Fund</span><span class="v">Seat</span></div><div><span class="k">' + (S.director ? 'Lata Krishnan · Independent' : 'Independent seat · open') + '</span>' + (S.director ? '<span class="v">Seat</span>' : btn('Recruit', 'director', {}, { cls: 'sm ghost', cost: { str: 1 }, disabled: !afford({ str: 1 }) })) + '</div></div><p class="cb note">Below 12, the board replaces you. Quarterly meetings move it most.</p></section>' +
      '<section class="card"><div class="ch"><span class="eyebrow">Bridge from Banyan</span></div><div class="cb" style="display:flex;flex-direction:column;gap:10px"><p class="note">' + (S.bridge.used ? 'Used.' : 'An insider bridge of ₹1.5 Cr at a flat-ish price. Needs board confidence of 45 or more; costs 4 points of it.') + '</p>' + (S.bridge.used ? '' : btn('Take the bridge', 'bridge', {}, { cls: 'sm', cost: { str: 1 }, disabled: !canBridge || !afford({ str: 1 }) })) + '</div></section>' +
      '</aside></div>';
  }

  function renderMain() {
    var m = FS.metrics(S);
    renderTop(m); renderNav(m);
    var fn = VIEWFN[view] || VIEWFN.overview;
    var html = fn(m);
    $('main').innerHTML = html;
    if (window.FSSimple) try { window.FSSimple.apply(); } catch (e) { }
  }
  function render() { if (S) renderMain(); }
  var VIEWFN = { overview: function (m) { return vOverview(m); }, finance: function (m) { return vFinance(m); }, product: function (m) { return vProduct(m); }, team: function (m) { return vTeam(m); }, capital: function (m) { return vCapital(m); } };

  /* ---------- modals ---------- */
  function openModal(html, opts) {
    opts = opts || {};
    $('modalRoot').innerHTML = '<div class="overlay"><div class="modal' + (opts.crisis ? ' crisis' : '') + '" role="dialog" aria-modal="true" aria-labelledby="mt"' + (opts.wide ? ' style="width:min(1040px,100%)"' : '') + '>' + html + '</div></div>';
    var f = $('modalRoot').querySelector('[data-autofocus]') || $('modalRoot').querySelector('button');
    if (f) f.focus();
  }
  function closeModal() { $('modalRoot').innerHTML = ''; }
  function next() {
    closeModal();
    var fn = modalQ.shift();
    if (fn) fn(); else { render(); if (S.over) { if (window.FSFX && next.fxEnd !== S.clientId) { next.fxEnd = S.clientId; try { window.FSFX.ending(S.outcome); } catch (e) { } } debrief(); } }
  }

  var picked = null;
  function eventModal() {
    var ev = FS.currentEvent(S);
    if (!ev) return next();
    picked = null;
    var draw = function () {
      openModal('<div class="mh"><span class="eyebrow ' + (ev.crisis ? 'down' : 'acc') + '">' + (ev.crisis ? '⚠ ' : 'Event · ') + esc(ev.tag) + ' · month ' + mm(S.month) + '</span><span class="eyebrow">' + (ev.crisis ? 'Respond now' : 'Decide before the month ends') + '</span></div><div class="mb">' +
        '<h2 id="mt">' + esc(ev.title) + '</h2><p class="lede">' + esc(ev.body) + '</p>' +
        (ev.quotes.length ? '<div class="grid ' + (ev.quotes.length > 1 ? 'g2' : '') + '">' + ev.quotes.map(function (q) { return '<figure class="quote" style="margin:0"><q>' + esc(q[0]) + '</q><cite>' + esc(q[1]).toUpperCase() + '</cite></figure>'; }).join('') + '</div>' : '') +
        '<div role="radiogroup" aria-label="Your response" style="display:flex;flex-direction:column;gap:8px">' + ev.choices.map(function (c, i) {
          var ok = afford(c.cost);
          return '<button type="button" class="choice" role="radio" aria-checked="' + (picked === i) + '" data-act="pick" data-i="' + i + '"' + (ok ? '' : ' disabled') + '><span class="lt">' + 'ABC'[i] + '</span><span><span class="t">' + esc(c.label) + '</span><span class="e" style="display:block">' + esc(c.effect) + (ok ? '' : ' · NOT ENOUGH FOCUS') + '</span></span><span class="mono acc" style="font-size:11px">' + esc(costTxt(c.cost) || 'FREE') + '</span></button>';
        }).join('') + '</div>' +
        '<div class="mf"><span class="mono faint" style="font-size:10px">SOME OPTIONS HAVE EFFECTS YOU WILL ONLY SEE LATER</span>' + btn(picked == null ? 'Pick an option' : 'Decide · option ' + 'ABC'[picked], 'decide', {}, { cls: 'primary lg', disabled: picked == null }) + '</div></div>', { crisis: ev.crisis });
    };
    eventModal.draw = draw; draw();
    if (ev.crisis && window.FSFX && eventModal.fxFor !== S.month + ':' + ev.title) { eventModal.fxFor = S.month + ':' + ev.title; try { window.FSFX.crisis(ev); } catch (e) { } }
  }

  function reportModal(rep) {
    var m = FS.metrics(S);
    var dm = rep.mrr1 - rep.mrr0, dc = rep.cash1 - rep.cash0;
    var items = [];
    rep.shipped.forEach(function (x) { items.push(['SHIPPED', x, 'up']); });
    rep.arrived.forEach(function (x) { items.push(['JOINED', x, 'acc']); });
    rep.quit.forEach(function (x) { items.push(['QUIT', x, 'down']); });
    rep.notes.forEach(function (x) { items.push(['NOTE', x, 'acc']); });
    (rep.news || []).forEach(function (x) { if (!/^Shipped:/.test(x) && !/resigned/.test(x)) items.push(['NEWS', x, 'mut']); });
    (rep.goals || []).forEach(function (x) { items.unshift(['MILESTONE', x, 'up']); });
    if (rep.termsheet) items.push(['CAPITAL', 'A term sheet has arrived. Review it in Capital & Board.', 'up']);
    openModal('<div class="mh"><span class="eyebrow acc">Month ' + mm(rep.m) + ' report</span><span class="eyebrow">' + (36 - rep.m) + ' months left</span></div><div class="mb">' +
      '<h2 id="mt">' + (dm >= 0 ? 'MRR up ' + L(dm, 2) + '.' : 'MRR down ' + L(-dm, 2) + '.') + ' <span class="em">' + (m.runway < 6 ? rw(m.runway) + ' of runway left.' : 'Cash ' + (dc >= 0 ? 'up ' : 'down ') + L(Math.abs(dc)) + '.') + '</span></h2>' +
      '<div class="statrow">' + [['NEW CUSTOMERS', '+' + rep.newCust], ['CHURNED', '−' + rep.churned], ['MRR', L(rep.mrr1, 2)], ['CASH', L(rep.cash1)]].map(function (x) { return '<div><span class="l">' + x[0] + '</span><span class="v">' + x[1] + '</span></div>'; }).join('') + '</div>' +
      (items.length ? '<div style="border:1px solid var(--line2)">' + items.map(function (x) { return '<div class="alert"><span class="lv ' + x[2] + '">' + x[0] + '</span><span>' + esc(x[1]) + '</span></div>'; }).join('') + '</div>' : '<p class="note">A quiet month.</p>') +
      '<div class="mf">' + btn('Open the full reports', 'nextReports', {}, { cls: 'sm' }) + btn('Continue', 'next', {}, { cls: 'primary lg' }) + '</div></div>');
    if (window.FSFX) try { window.FSFX.report(rep, m, S); } catch (e) { }
  }

  function boardModal(b) {
    openModal('<div class="mh"><span class="eyebrow acc">Quarterly board meeting · month ' + mm(b.month) + '</span><span class="eyebrow">Mood: ' + esc(b.mood) + '</span></div><div class="mb">' +
      '<h2 id="mt">The board wants answers.</h2>' +
      '<div class="statrow">' + [['GROWTH (3-MO)', pct(b.g3) + '/mo'], ['RUNWAY', rw(b.runway)], ['BURN MULTIPLE', b.bm > 50 ? '—' : b.bm.toFixed(1) + '×'], ['CONFIDENCE', Math.round(S.board)]].map(function (x) { return '<div><span class="l">' + x[0] + '</span><span class="v">' + x[1] + '</span></div>'; }).join('') + '</div>' +
      '<div><div class="eyebrow" style="margin-bottom:8px">Their asks</div>' + b.asks.map(function (a) { return '<div class="alert" style="border:1px solid var(--line);border-bottom:0"><span class="lv acc">ASK</span><span>' + esc(a) + '</span></div>'; }).join('') + '<div style="border-top:1px solid var(--line)"></div></div>' +
      (b.review ? '<div><div class="eyebrow" style="margin-bottom:8px">Last quarter\'s targets</div>' + b.review.map(function (r) { return '<div class="alert" style="border:1px solid var(--line);border-bottom:0"><span class="lv ' + (r.ok ? 'up' : 'down') + '">' + (r.ok ? 'HIT' : 'MISS') + '</span><span>' + esc(r.label) + (r.ok ? ' · confidence +3' : ' · confidence −2') + '</span></div>'; }).join('') + '<div style="border-top:1px solid var(--line)"></div></div>' : '') +
      (b.okrs ? '<div><div class="eyebrow" style="margin-bottom:8px">Targets for next quarter</div>' + b.okrs.map(function (o) { return '<div class="alert" style="border:1px solid var(--line);border-bottom:0"><span class="lv acc">OKR</span><span>' + esc(o) + '</span></div>'; }).join('') + '<div style="border-top:1px solid var(--line)"></div></div>' : '') +
      '<p class="lede">How do you present the quarter?</p>' +
      '<button type="button" class="choice" data-act="board" data-c="candid"><span class="lt">A</span><span><span class="t">Candid update: here is what is working and what is not</span><span class="e" style="display:block">SMALL CONFIDENCE GAIN IF GROWTH IS ON PLAN</span></span><span></span></button>' +
      '<button type="button" class="choice" data-act="board" data-c="spin"><span class="lt">B</span><span><span class="t">Lead with the wins and keep the misses vague</span><span class="e" style="display:block">CONFIDENCE +6 NOW</span></span><span></span></button></div>');
  }

  function emergencyModal() {
    openModal('<div class="mh"><span class="eyebrow down">Cash is gone</span></div><div class="mb"><h2 id="mt">You cannot make next month\'s payroll.</h2><p class="lede">Banyan will bridge you with ₹1.5 Cr if you ask today. Otherwise the company shuts down.</p>' +
      '<button type="button" class="choice" data-act="emerg" data-c="bridge"><span class="lt">A</span><span><span class="t">Take Banyan\'s emergency bridge</span><span class="e" style="display:block">+₹1.5 CR · DILUTION · BOARD CONFIDENCE −4</span></span><span></span></button>' +
      '<button type="button" class="choice" data-act="emerg" data-c="shut"><span class="lt">B</span><span><span class="t">Shut the company down</span><span class="e" style="display:block">THE GAME ENDS</span></span><span></span></button></div>');
    if (window.FSFX) try { window.FSFX.emergency(); } catch (e) { }
  }

  function candModal(role) {
    var r = FS.act(S, 'candidates', { role: role }); save();
    var R = FS.ROLES[role];
    var fee = function (c) { return FS.hireFee(S, c); };
    openModal('<div class="mh"><span class="eyebrow acc">Hiring · ' + esc(R.title) + '</span><button class="btn sm" type="button" data-act="close">Close</button></div><div class="mb"><h2 id="mt">Three candidates made the final round.</h2><p class="lede">They join next month and ramp at half productivity for one or two months.</p>' +
      r.list.map(function (c, i) {
        var lvl = c.skill >= R.skill[0] + (R.skill[1] - R.skill[0]) * 0.66 ? 'Exceptional' : c.skill >= R.skill[0] + (R.skill[1] - R.skill[0]) * 0.33 ? 'Strong' : 'Promising';
        return '<button type="button" class="choice" data-act="hire" data-i="' + i + '"' + (afford({ ppl: 1, cash: fee(c) }) ? '' : ' disabled') + '><span class="lt">' + 'ABC'[i] + '</span><span><span class="t">' + esc(c.name) + ' · ₹' + c.salary + 'L/yr</span><span class="e" style="display:block">' + lvl.toUpperCase() + ' · ' + esc(c.note).toUpperCase() + ' · RAMP ' + c.ramp + ' MO</span></span><span class="mono acc" style="font-size:11px">−1 PPL · −' + L(fee(c)) + '</span></button>';
      }).join('') + '</div>');
    candModal.list = r.list;
  }

  function logModal() {
    var rows = S.log.slice().reverse().map(function (l) { return '<tr><td>' + esc(l.choice) + '<br><span class="mono faint" style="font-size:10px">' + esc(l.src).toUpperCase() + ' · ' + esc(l.title).toUpperCase() + '</span></td><td>M' + mm(l.m) + '</td></tr>'; }).join('');
    openModal('<div class="mh"><span class="eyebrow acc">Decision log</span><button class="btn sm" type="button" data-act="close">Close</button></div><div class="mb"><h2 id="mt">' + S.log.length + ' decisions so far.</h2><p class="lede">Each one is graded on what you knew when you made it. You will see the grades in the debrief.</p>' + (rows ? '<table><thead><tr><th>Decision</th><th>Month</th></tr></thead><tbody>' + rows + '</tbody></table>' : '<p class="note">No decisions logged yet.</p>') + '</div>');
  }

  function helpModal(first) {
    openModal('<div class="mh"><span class="eyebrow acc">How to play</span>' + (first ? '' : '<button class="btn sm" type="button" data-act="close">Close</button>') + '</div><div class="mb"><h2 id="mt">Thirty-six months. One company.</h2>' +
      '<div class="rows" style="border:1px solid var(--line2)">' + [
        ['The goal', 'Maximise Founder Outcome: company value × your ownership at month 36. Running out of cash scores zero.'],
        ['Each month', 'Act in the panels, then press End month. Customers, cash, morale and the roadmap all move together.'],
        ['Founder Focus', 'Strategy, Ops and People points refill every month and never carry over. Most actions cost focus. You cannot do everything.'],
        ['Delays', 'Hires ramp for months, features take weeks, a raise takes at least three months. Act before the numbers force you.'],
        ['Hidden variables', 'True product-market fit and some event effects are hidden. You see them through churn, referrals and later news.'],
        ['Judgment', 'Every decision is graded on what you knew at the time. The debrief separates good calls from lucky ones.']
      ].map(function (r) { return '<div style="align-items:flex-start;padding:10px 16px"><span class="k" style="min-width:130px;color:var(--ivory)">' + r[0] + '</span><span class="note" style="text-align:right;max-width:520px">' + r[1] + '</span></div>'; }).join('') + '</div>' +
      '<div class="mf"><span class="note">Tip: the agenda on the Overview flags what needs attention.</span>' + btn(first ? 'Start month 1' : 'Back to the game', 'close', {}, { cls: 'primary lg' }) + '</div></div>');
  }

  function track() { try { if (window.FSAuth && S) window.FSAuth.trackGame(S, S.over ? FS.score(S) : null); } catch (e) { } }
  function debrief() {
    var sc = FS.score(S), m = FS.metrics(S);
    track();
    var titles = { completed: 'You made it to month 36.', dead: 'You ran out of cash in month ' + S.month + '.', fired: 'The board replaced you in month ' + S.month + '.', acquired: 'You sold to Stackline in month ' + S.month + '.', cofounder: 'Your co-founder walked out in month ' + S.month + '.' };
    var sorted = S.log.slice().sort(function (a, b) { return b.q - a.q; });
    var best = sorted.slice(0, 3), worst = sorted.slice(-3).reverse();
    var dec = function (l) { return '<div class="alert"><span class="lv ' + (l.q >= 70 ? 'up' : l.q >= 50 ? 'acc' : 'down') + '">' + l.q + '</span><span><b style="font-weight:500">M' + mm(l.m) + ' · ' + (l.src === 'Event' || l.src === 'Board' ? esc(l.title) + ' → ' : '') + esc(l.choice) + '</b><br><span class="note">' + esc(l.why) + '</span></span></div>'; };
    var luck = sc.dq >= 66 && (S.outcome === 'dead' || S.outcome === 'fired') ? 'Your judgment was better than your outcome. Some of this was bad luck, so read the hidden effects below.' :
      sc.dq < 55 && S.outcome === 'completed' ? 'Your outcome was better than your judgment. Several risky calls happened to work out.' :
        'Your outcome broadly matched the quality of your decisions.';
    var url = location.origin + location.pathname + '?seed=' + S.seed;
    openModal('<div class="mh"><span class="eyebrow acc">Debrief · seed ' + S.seed + ' · ' + esc(FS.ARCH[S.archetype].name) + '</span><span class="eyebrow">' + sc.months + ' months played</span></div><div class="mb">' +
      '<h2 id="mt">' + esc(titles[S.outcome] || 'Game over.') + '</h2>' +
      '<div class="statrow"><div><span class="l">FOUNDER OUTCOME</span><span class="v serif" style="font-size:34px">₹' + sc.founderOutcome.toFixed(1) + ' Cr</span></div><div><span class="l">COMPANY VALUE</span><span class="v">₹' + sc.ev.toFixed(1) + ' Cr</span></div><div><span class="l">YOUR OWNERSHIP</span><span class="v">' + sc.ownership.toFixed(1) + '%</span></div><div><span class="l">FINAL ARR</span><span class="v">' + L(m.arr) + '</span></div></div>' +
      '<div class="statrow s5">' + [['MILESTONES', sc.goals + ' / ' + sc.goalsTotal], ['DECISION QUALITY', sc.dqGrade + ' · ' + Math.round(sc.dq)], ['CAPITAL EFFICIENCY', sc.effGrade + ' · ' + sc.eff.toFixed(2) + '×'], ['TEAM HEALTH', sc.teamGrade + ' · ' + Math.round(sc.team)], ['REPUTATION', sc.repGrade + ' · ' + Math.round(sc.rep)]].map(function (x) { return '<div><span class="l">' + x[0] + '</span><span class="v">' + x[1] + '</span></div>'; }).join('') + '</div>' +
      '<p class="lede">' + luck + '</p>' +
      '<div class="grid g2"><div class="card"><div class="ch"><span class="eyebrow">MRR · ₹ lakh</span></div><div class="cb">' + lineChart([{ pts: S.history.map(function (h) { return [h.m, h.mrr]; }), color: '#C9A45C', dot: true }], { h: 150, label: 'MRR over the game' }) + '</div></div>' +
      '<div class="card"><div class="ch"><span class="eyebrow">Cash · ₹ Cr</span></div><div class="cb">' + lineChart([{ pts: S.history.map(function (h) { return [h.m, Math.max(0, h.cash) / 100]; }), color: '#ECE6DA', dot: true }], { h: 150, fmt: function (v) { return v.toFixed(1); }, label: 'Cash over the game' }) + '</div></div></div>' +
      '<div class="grid g2"><div class="card"><div class="ch"><span class="eyebrow up">Your best calls</span></div>' + best.map(dec).join('') + '</div><div class="card"><div class="ch"><span class="eyebrow down">Your weakest calls</span></div>' + worst.map(dec).join('') + '</div></div>' +
      '<div class="card"><div class="cb" style="display:flex;flex-direction:column;gap:8px"><span class="eyebrow">Challenge a classmate on the same seed</span><span class="mono" style="font-size:12px;word-break:break-all">' + esc(url) + '</span></div></div>' +
      '<div class="mf">' + btn('Full decision log', 'openLogFinal', {}, {}) + '<span style="display:flex;gap:8px;flex-wrap:wrap">' + btn('Replay this seed', 'replay', {}, {}) + btn('New company', 'newGame', {}, { cls: 'primary lg' }) + '</span></div></div>', { wide: true });
  }
  function logFinal() {
    var rows = S.log.map(function (l) { return '<tr><td>' + (l.src === 'Event' || l.src === 'Board' ? esc(l.title) + ' → ' : '') + esc(l.choice) + '<br><span class="note">' + esc(l.why) + '</span></td><td>M' + mm(l.m) + '</td><td class="' + (l.q >= 70 ? 'up' : l.q >= 50 ? 'acc' : 'down') + '">' + l.q + '</td></tr>'; }).join('');
    openModal('<div class="mh"><span class="eyebrow acc">Every decision, graded</span>' + btn('Back to debrief', 'debrief', {}, { cls: 'sm' }) + '</div><div class="mb"><table><thead><tr><th>Decision</th><th>Month</th><th>Grade</th></tr></thead><tbody>' + rows + '</tbody></table></div>', { wide: true });
  }

  /* ---------- start screen ---------- */
  function startScreen() {
    var saved = load();
    var qs = new URLSearchParams(location.search), seed = qs.get('seed') || '';
    var st = $('start'); st.hidden = false; $('app').hidden = true;
    var draw = function () {
      st.innerHTML = '<div class="startin">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap"><a href="../" style="display:flex;align-items:center;gap:10px;color:var(--ivory)"><svg width="22" height="22" viewBox="0 0 28 28" fill="none" stroke="#C9A45C" stroke-width="1.7" aria-hidden="true"><rect x="3" y="3" width="22" height="22"/><path d="M3 12h22M12 12v13"/></svg><b class="mono" style="font-size:12px;letter-spacing:.16em;font-weight:500">FOUNDER\'S SEAT</b></a><span class="pill acc">PLAYABLE ALPHA</span></div>' +
        '<div style="display:flex;flex-direction:column;gap:16px"><span class="eyebrow acc">Scenario · post-seed B2B SaaS · Bengaluru</span><h1>Thirty-six months. One company. <span class="em">Every call is yours.</span></h1><p class="lede" style="font-size:17px;color:var(--body);max-width:720px;line-height:1.55">You run a logistics SaaS start-up that just closed its seed round. Stackline, your rival, has raised $10M. Your seed investor wants a Series A within 18 months. You have about 13 months of cash.</p></div>' +
        '<div class="brief">' + [['CASH', '₹4.2 Cr', 'SEED ROUND JUST CLOSED'], ['MRR', '₹8.0L', '38 CUSTOMERS · ~6% MOM'], ['NET BURN', '~₹33L', '≈13 MONTHS OF RUNWAY'], ['TEAM', '14', '9 ENGINEERING · 2 SALES · 1 CS']].map(function (b) { return '<div><span class="eyebrow">' + b[0] + '</span><span class="v">' + b[1] + '</span><span class="mono faint" style="font-size:10px">' + b[2] + '</span></div>'; }).join('') + '</div>' +
        '<div style="display:flex;flex-direction:column;gap:12px"><span class="eyebrow">Who are you?</span><div class="archs" role="radiogroup" aria-label="Founder type">' + Object.keys(FS.ARCH).map(function (k) {
          var A = FS.ARCH[k];
          return '<button type="button" class="arch" role="radio" aria-checked="' + (pickedArch === k) + '" data-act="arch" data-k="' + k + '"><span class="t">' + A.name + '</span><span class="note">' + A.blurb + '</span><span class="mono acc" style="font-size:11px">FOCUS · STR ' + A.focus.str + ' · OPS ' + A.focus.ops + ' · PPL ' + A.focus.ppl + '</span><span class="mono faint" style="font-size:10px">' + (k === 'technical' ? '+12% ENGINEERING PRODUCTIVITY' : k === 'consultant' ? 'BOARD TRUST + FUNDRAISING EDGE' : '40% LOWER HIRING FEES · INVESTOR NETWORK') + '</span></button>';
        }).join('') + '</div></div>' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap"><label style="display:flex;flex-direction:column;gap:6px"><span class="eyebrow">Cohort seed (optional)</span><input type="text" id="seedIn" inputmode="numeric" placeholder="random" value="' + esc(seed) + '"><span class="note">Same seed, same market. Use it to compare a class fairly.</span></label>' +
        '<span style="display:flex;gap:10px;flex-wrap:wrap">' + (saved && !saved.over ? btn('Continue: month ' + saved.month, 'continue', {}, { cls: 'lg' }) : '') + btn('Take the seat', 'begin', {}, { cls: 'primary lg' }) + '</span></div>' +
        '<div class="how">' + [['01', 'Read the board', 'One dashboard for cash, runway, revenue, morale and board confidence, with detail behind every panel.'], ['02', 'Spend your focus', 'Strategy, Ops and People points refill monthly. You can raise, recruit or ship. Rarely all three.'], ['03', 'Live with the delay', 'Hires ramp, features take weeks, raises take months. You are graded on judgment, not luck.']].map(function (h) { return '<div><span class="mono acc" style="font-size:12px">' + h[0] + '</span><span class="serif" style="font-size:24px">' + h[1] + '</span><span class="note">' + h[2] + '</span></div>'; }).join('') + '</div>' +
        '</div>';
    };
    startScreen.draw = draw; draw();
  }
  function begin(seedStr) {
    var seed = parseInt(String(seedStr || '').replace(/\D/g, ''), 10);
    if (!seed) seed = Math.floor(Math.random() * 900000) + 100000;
    S = FS.newGame({ seed: seed, archetype: pickedArch });
    S.clientId = seed + '-' + Date.now().toString(36);
    view = 'overview'; selPerson = null;
    save(); showApp(); helpModal(true);
    track();
  }
  function showApp() { $('start').hidden = true; $('app').hidden = false; render(); if (S.pending.length) { modalQ = []; eventModal(); } }

  /* ---------- end month flow ---------- */
  function endMonth() {
    if (S.pending.length) { eventModal(); return; }
    var rep = FS.endMonth(S);
    if (!rep) return;
    if (rep.blocked) { toast(rep.blocked, true); return; }
    save(); track();
    var q = [function () { reportModal(rep); }];
    if (rep.boardMeeting) q.push(function () { boardModal(rep.boardMeeting); });
    if (rep.emergency) q.push(emergencyModal);
    q.push(function () { if (!S.over && S.pending.length) eventModal(); else next(); });
    modalQ = q; render(); next();
  }

  /* ---------- actions ---------- */
  function doAct(name, params) {
    var r = FS.act(S, name, params);
    if (r && r.msg) toast(r.msg, !r.ok);
    save(); render();
    return r;
  }
  var H = {
    view: function (d) { view = d.v; selPerson = view === 'team' ? selPerson : null; render(); $('main').scrollTop = 0; },
    'do': function (d) { var p = {}; try { p = d.p ? JSON.parse(d.p) : {}; } catch (e) { } if (d.confirm && H['do'].armed !== d.p + d.a) { H['do'].armed = d.p + d.a; toast(d.confirm); return; } H['do'].armed = null; doAct(d.a, p); },
    bfilter: function (d) { bfilter = d.v; render(); },
    nextReports: function () { view = 'reports'; next(); },
    price: function (d) { doAct('price', { dir: d.dir }); },
    vdebt: function () { doAct('ventureDebt'); },
    bridge: function () { doAct('bridge'); },
    startRaise: function () { doAct('startRaise'); },
    pitch: function (d) { doAct('pitch', { fund: d.fund }); },
    accept: function (d) { doAct('acceptOffer', { idx: Number(d.i) }); },
    decline: function () { doAct('declineOffer'); },
    director: function () { doAct('director'); },
    enter: function (d) { doAct('enter', { seg: d.seg }); },
    q: function (d) { doAct('queue', { id: d.id, op: d.op }); },
    alloc: function (d) { doAct('setAlloc', { value: Number(d.v) }); },
    selp: function (d) { selPerson = d.id; render(); },
    praise: function (d) { doAct('raise', { id: d.id }); },
    pesop: function (d) { doAct('esop', { id: d.id }); },
    promote: function (d) { doAct('promote', { id: d.id }); },
    fire: function (d) { if (selPerson === d.id && H.fire.armed !== d.id) { H.fire.armed = d.id; toast('Press "Let go" again to confirm.'); return; } H.fire.armed = null; doAct('fire', { id: d.id }); selPerson = null; render(); },
    offsite: function () { doAct('offsite'); },
    rest: function () { doAct('rest'); },
    cands: function (d) { candModal(d.role); },
    hire: function (d) { var c = candModal.list[Number(d.i)]; closeModal(); doAct('hire', { cand: c }); if (modalQ.length || S.pending.length) next(); },
    close: function () { if (modalQ.length || S.pending.length) next(); else closeModal(); render(); },
    next: function () { next(); },
    pick: function (d) { picked = Number(d.i); eventModal.draw(); },
    decide: function () {
      var r = FS.resolveEvent(S, picked);
      if (!r.ok) { toast(r.msg || 'Cannot do that.', true); return; }
      save(); render();
      if (S.over) { modalQ = []; next(); return; }
      if (S.pending.length) eventModal(); else next();
    },
    board: function (d) { FS.boardChoice(S, d.c); save(); next(); },
    emerg: function (d) {
      if (d.c === 'bridge') { var r = FS.act(S, 'bridge'); if (!r.ok) { S.over = true; S.outcome = 'dead'; } else toast(r.msg); }
      else { S.over = true; S.outcome = 'dead'; }
      save(); if (S.over) modalQ = []; next();
    },
    openLog: function () { logModal(); },
    openHelp: function () { helpModal(false); },
    openLogFinal: function () { logFinal(); },
    debrief: function () { debrief(); },
    newGame: function () { if (S && !S.over && !H.newGame.armed) { H.newGame.armed = true; toast('Press New game again to abandon this company.'); setTimeout(function () { H.newGame.armed = false; }, 4000); return; } H.newGame.armed = false; closeModal(); clearSave(); S = null; startScreen(); },
    replay: function () { var seed = S.seed, a = S.archetype; closeModal(); pickedArch = a; begin(String(seed)); },
    arch: function (d) { pickedArch = d.k; startScreen.draw(); },
    begin: function () { begin($('seedIn') && $('seedIn').value); },
    'continue': function () { S = load(); pickedArch = S.archetype; showApp(); }
  };
  document.addEventListener('click', function (ev) {
    var el = ev.target.closest('[data-act]');
    if (!el || el.disabled) return;
    var h = H[el.getAttribute('data-act')];
    if (h) { ev.preventDefault(); h(el.dataset, el); }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && $('modalRoot').innerHTML && !modalQ.length && S && !S.pending.length && !S.over) { closeModal(); }
  });
  $('endMonth').addEventListener('click', function () { if (S && !S.over) endMonth(); });

  window.__FS_UI = {
    get S() { return S; }, FS: FS, L: L, esc: esc, rw: rw, pct: pct, mm: mm, btn: btn, afford: afford, costTxt: costTxt, lineChart: lineChart, ARROW: ARROW,
    views: VIEWFN, H: H, render: render, openModal: openModal, closeModal: closeModal, doAct: doAct, toast: toast, save: save,
    setView: function (v) { view = v; render(); }, startScreen: function () { startScreen(); }
  };
  if (window.FSAuth) window.FSAuth.gate(function () { startScreen(); }); else startScreen();
})();
