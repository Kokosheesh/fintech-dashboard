/* Founder's Seat — extra panels: Growth, Operations, Partners & Deals, Reports, Goals. */
(function () {
  'use strict';
  var U = window.__FS_UI, FS = U.FS, L = U.L, esc = U.esc, btn = U.btn, pct = U.pct, mm = U.mm, afford = U.afford, rw = U.rw;
  function S() { return U.S; }
  function DO(label, a, p, opts) { return btn(label, 'do', { a: a, p: JSON.stringify(p || {}) }, opts); }
  function kpis(list) { return '<div class="kpis">' + list.map(function (k) { return '<div class="kpi"><span class="eyebrow">' + k[0] + '</span><span class="v">' + esc(k[1]) + '</span><span class="n ' + (k[3] || 'mut') + '">' + esc(k[2]) + '</span></div>'; }).join('') + '</div>'; }
  function head(eb, h) { return '<div class="head"><div><div class="eyebrow acc">' + eb + '</div><h1>' + h + '</h1></div></div>'; }
  function card(title, body, opt) { opt = opt || {}; return '<section class="card' + (opt.hl ? ' hl' : '') + '"><div class="ch"><span class="eyebrow' + (opt.hl ? ' acc' : '') + '">' + title + '</span>' + (opt.right || '') + '</div>' + body + '</section>'; }
  function f1(x) { return (Math.round(x * 10) / 10).toFixed(1); }

  /* ------------------------------------------------------------------ GROWTH */
  U.views.growth = function (m) {
    var s = S(), A = FS.acq(s), la = s.lastAcq || {}, st = s.chStats || {}, cum = s.chCum || {};
    var rows = A.rows.map(function (r) {
      var C = FS.CH[r.id], last = st[r.id] || {}, cu = cum[r.id] || {};
      var roas = cu.spend > 0 ? cu.mrr * 12 / cu.spend : null, cac = last.cust > 0.05 && r.spend > 0 ? r.spend / last.cust : null;
      var fat = C && C.kind === 'paid' ? s.chFat[r.id] : null;
      var stepper = C ? '<span class="stepper sm">' + DO('−', 'setChannel', { ch: r.id, value: Math.max(0, r.spend - 0.5) }, { cls: 'sm icon2', disabled: r.spend <= 0, title: 'Spend ₹0.5L less' }) + '<span class="val">' + L(r.spend) + '</span>' + DO('+', 'setChannel', { ch: r.id, value: r.spend + 0.5 }, { cls: 'sm icon2', disabled: r.spend >= 30, title: 'Spend ₹0.5L more' }) + '</span>' : '<span class="mono faint">—</span>';
      return '<tr><td><b style="font-weight:500">' + esc(r.name) + '</b><br><span class="note">' + esc(C ? C.desc : r.id === 'partners' ? 'Leads from live partners.' : 'Grows with fit and launches. Free.') + (r.id === 'google' && s.flags.adBanUntil > s.month ? ' <span class="down">Account suspended.</span>' : '') + '</span></td><td>' + stepper + '</td><td>' + f1(r.leads) + '</td><td>' + Math.round(r.qual * 100) + '%</td><td>' + f1(last.cust || 0) + '</td><td>' + (cac ? L(cac) : '—') + '</td><td class="' + (roas == null ? 'mut' : roas >= 1.5 ? 'up' : roas >= 0.8 ? 'acc' : 'down') + '">' + (roas == null ? '—' : roas.toFixed(1) + '×') + '</td><td>' + (fat == null ? '—' : (fat < 0.9 ? '<span class="fat"><span class="down">' + Math.round((1 - fat) * 100) + '% stale</span>' + DO('Refresh', 'refreshCreative', { ch: r.id }, { cls: 'sm', disabled: !afford({ ops: 1, cash: 1 }), title: 'Costs 1 Ops focus and ₹1L' }) + '</span>' : '<span class="up">Fresh</span>')) + '</td></tr>';
    }).join('');
    var tot = A.opps || 1;
    var fstages = [['Leads', A.leads, ''], ['Qualified opportunities', A.opps, Math.round(A.opps / Math.max(1, A.leads) * 100) + '% of leads'], ['Worked by sales', A.worked, 'capacity ' + f1(A.cap) + (A.selfOpps > 0.05 ? ' · ' + f1(A.selfOpps) + ' self-serve' : '')], ['Won', A.customers, Math.round(A.win * 100) + '% sales win' + (A.selfOpps > 0.05 ? ' · ' + Math.round(A.selfWin * 100) + '% self-serve' : '')]];
    var fmax = Math.max(1, A.leads);
    var funnel = '<div class="cb funnel">' + fstages.map(function (f) { return '<div class="fs"><div class="fl"><span>' + f[0] + '</span><span class="mono">' + f1(f[1]) + '</span></div><div class="bar" style="height:10px"><i style="width:' + Math.max(1, f[1] / fmax * 100) + '%"></i></div><span class="note">' + esc(f[2]) + '</span></div>'; }).join('') + '<p class="note">' + (A.bottleneck === 'sales' ? '<b class="down">Sales is the bottleneck:</b> ' + f1(A.salesOpps - A.cap) + ' qualified deals a month go unworked. Hire Sales Executives (volume) or Account Executives (larger deals).' : '<b class="acc">Demand is the bottleneck:</b> sales could work ' + f1(A.cap - A.salesOpps) + ' more deals a month.') + '</p></div>';
    var gtm = Object.keys(FS.GTM).map(function (id) {
      var G = FS.GTM[id], cur = s.gtm === id, why = FS.gtmReady(s, id);
      return '<div class="opt' + (cur ? ' cur' : '') + '"><div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><b>' + G.name + '</b>' + (cur ? '<span class="pill acc">CURRENT</span>' : DO('Switch', 'setGtm', { id: id }, { cls: 'sm', cost: { str: 2 }, disabled: !!why || !afford({ str: 2 }), title: why })) + '</div><span class="note">' + esc(G.desc) + (why && !cur ? ' <span class="down">' + esc(why) + '</span>' : '') + '</span></div>';
    }).join('');
    var slots = FS.expSlots(s);
    var ready = s.exp.ready.map(function (r) {
      var E = FS.EXPS[r.id];
      return '<div class="alert"><span class="lv ' + (r.sig ? (r.obs > 0 ? 'up' : 'down') : 'acc') + '">' + (r.sig ? 'SIG' : 'N/S') + '</span><span style="flex:1"><b style="font-weight:500">' + esc(E.name) + '</b><br><span class="note">Observed ' + esc(FS.fmtLift(E, r.obs)) + ' on ~' + r.n + ' visitors. ' + (r.sig ? 'Statistically significant (z = ' + r.z.toFixed(1) + ').' : 'Not significant (z = ' + r.z.toFixed(1) + '): it could easily be noise.') + '</span></span><span style="display:flex;gap:6px;align-items:center">' + DO('Ship variant', 'expDecide', { id: r.id, ship: true }, { cls: 'sm' }) + DO('Discard', 'expDecide', { id: r.id, ship: false }, { cls: 'sm' }) + '</span></div>';
    }).join('');
    var running = s.exp.active.map(function (x) { return '<div class="alert"><span class="lv acc">LIVE</span><span>' + esc(FS.EXPS[x.id].name) + ' <span class="note">· result in this month\'s report</span></span></div>'; }).join('');
    var avail = Object.keys(FS.EXPS).map(function (id) {
      var E = FS.EXPS[id], cool = s.exp.last[id] && s.exp.last[id] > s.month - 4, busy = s.exp.active.some(function (x) { return x.id === id; }) || s.exp.ready.some(function (x) { return x.id === id; });
      var lock = E.req && !FS.has(s, E.req);
      return '<div class="lrow"><span class="k" style="flex:1">' + esc(E.name) + ' <span class="note">· ' + esc(E.unit.replace(/^(pp|%) /, '')) + (E.eng ? ' · ' + E.eng + ' eng-wks' : '') + '</span></span>' + DO(busy ? 'Running' : cool ? 'Ran recently' : lock ? 'Locked' : 'Run test', 'runExp', { id: id }, { cls: 'sm', cost: busy || cool || lock ? null : { ops: 1 }, disabled: busy || cool || lock || s.exp.active.length >= slots || !afford({ ops: 1 }) }) + '</div>';
    }).join('');
    var hist = s.exp.history.slice(0, 6).map(function (h) { var E = FS.EXPS[h.id]; return '<div><span class="k">M' + mm(h.m) + ' · ' + esc(E.name) + '</span><span class="v ' + (h.shipped ? 'acc' : 'mut') + '">' + (h.shipped ? 'SHIPPED' : 'DISCARDED') + ' · ' + esc(FS.fmtLift(E, h.obs).split(' ')[0]) + (h.sig ? '' : ' N/S') + '</span></div>'; }).join('');
    return head('Growth', f1(A.leads) + ' leads a month become <span class="em">' + f1(A.customers) + ' customers.</span>') +
      kpis([['LEADS / MO', f1(A.leads), 'LAST MONTH ' + f1(la.leads || 0), 'mut'], ['QUALIFIED', f1(A.opps), Math.round(A.opps / Math.max(1, A.leads) * 100) + '% OF LEADS', 'mut'], ['WIN RATE', Math.round(A.win * 100) + '%', 'FIT, PRICE, COMPETITION', A.win < 0.35 ? 'down' : 'acc'], ['CAC (PROGRAMMES)', L(m.cac), 'SPEND ÷ NEW CUSTOMERS', m.payback > 15 ? 'down' : 'mut'], ['SALES CAPACITY', f1(A.worked) + ' / ' + f1(A.cap), A.bottleneck === 'sales' ? 'FULL: HIRE SALES' : 'DEALS A MONTH', A.bottleneck === 'sales' ? 'down' : 'up']]) +
      '<div class="grid gside"><div class="grid" style="align-content:start">' +
      card('Channels · spend, leads and returns', '<div class="tscroll"><table class="chtab"><thead><tr><th>Channel</th><th>Spend / mo</th><th>Leads</th><th>Qualify</th><th>Won</th><th>CAC</th><th>ROAS</th><th>Ads</th></tr></thead><tbody>' + rows + '</tbody></table></div><p class="cb note">ROAS = first-year revenue from customers a channel brought in, per rupee spent, since month 1. Each channel\'s true efficiency is hidden at the start and differs by game; read the numbers and reallocate. Paid channels saturate above their natural size, and ads go stale without fresh creative (a refresh costs 1 Ops focus and ₹1L).</p>', { right: '<span class="mono" style="font-size:12px">' + L(s.marketing) + '/MO TOTAL</span>' }) +
      card('Experiments · A/B tests on the funnel', (ready ? '<div class="fnh">RESULTS TO DECIDE</div>' + ready : '') + (running ? '<div class="fnh">RUNNING</div>' + running : '') + '<div class="fnh">AVAILABLE TESTS · ' + s.exp.active.length + ' / ' + slots + ' SLOTS IN USE</div>' + avail + '<p class="cb note">Small traffic makes noisy results. Shipping a "win" that is not significant can quietly make the funnel worse. A PM and a Data Analyst each add a slot; the analyst also reduces noise.</p>', { right: '<span class="mono faint" style="font-size:10px">−1 OPS EACH</span>' }) +
      (hist ? card('Experiment history', '<div class="rows">' + hist + '</div>') : '') +
      '</div><aside class="grid" style="align-content:start">' +
      card('Funnel · this month\'s forecast', funnel, { hl: true }) +
      card('Go-to-market motion', '<div class="opts">' + gtm + '</div><p class="cb note">Switching costs 2 Strategy focus and dents win rate for two months while the team adjusts.</p>') +
      '</aside></div>';
  };

  /* ------------------------------------------------------------------ OPERATIONS */
  U.views.ops = function (m) {
    var s = S(), sup = FS.support(s), sec = FS.secScore(s);
    var list = Object.keys(FS.OPS).map(function (id) {
      var O = FS.OPS[id], done = s.ops.done[id], act = s.ops.active[id];
      var st = done ? '<span class="pill up">DONE M' + mm(done) + '</span>' : act ? '<span class="pill acc">UNTIL M' + mm(act) + '</span>' : DO('Start', 'startOps', { id: id }, { cls: 'sm', cost: O.cost, disabled: !afford(O.cost) });
      return '<div class="qitem" style="grid-template-columns:minmax(0,1fr) auto"><div style="display:flex;flex-direction:column;gap:3px;min-width:0"><span class="t">' + esc(O.name) + ' <span class="mono faint" style="font-size:11px;font-weight:400">' + (id === 'soc2' && FS.cnt(s, 'sec') ? 2 : O.months) + ' MO' + (O.eng ? ' · ' + O.eng + ' ENG-WKS' : '') + '</span></span><span class="w">' + esc(O.what) + '</span></div>' + st + '</div>';
    }).join('');
    var risk = [['GST and payroll compliance', s.flags.compliance], ['DPDP privacy programme', s.flags.dpdp], ['SOC 2', s.flags.soc2], ['On-call and runbooks', s.flags.oncall], ['Monitoring and alerting', FS.has(s, 'observ')], ['Automated tests', FS.has(s, 'testing')], ['Cyber and D&O insurance', s.flags.insurance], ['Security engineer on staff', FS.cnt(s, 'sec') > 0]];
    var vend = [['Infrastructure (gross)', L(m.infraGross)], ['Cloud credits applied', m.credits > 0 ? '−' + L(m.credits) : '—'], ['Rent', L(s.rent)], ['Tools and software', L(s.tools)], ['Insurance', s.flags.insurance ? L(0.4) : '—'], ['Partner revenue share', m.revShare ? L(m.revShare) : '—']];
    return head('Operations', 'Support at <span class="em">' + Math.round(sup.sla * 100) + '% of demand.</span> Security score ' + Math.round(sec) + '.') +
      kpis([['SUPPORT SLA', Math.round(sup.sla * 100) + '%', Math.round(sup.tickets) + ' TICKETS / ' + Math.round(sup.cap) + ' CAPACITY', sup.sla < 0.9 ? 'down' : 'up'], ['DAYS TO COLLECT', Math.round(FS.dso(s)) + ' days', 'RECEIVABLES ' + L(s.ar), FS.dso(s) > 35 ? 'down' : 'mut'], ['SECURITY', String(Math.round(sec)), sec < 40 ? 'BREACH RISK HIGH' : 'OUT OF 100', sec < 40 ? 'down' : 'up'], ['INCIDENT RISK', Math.round(s.mods.incident * 100) + '%', 'OF BASELINE', s.mods.incident > 0.9 ? 'down' : 'up'], ['OPS FOCUS', s.focus.ops + ' / ' + s.focusMax.ops, 'REFILLS MONTHLY', 'mut']]) +
      '<div class="grid gside"><div class="grid" style="align-content:start">' +
      card('Operating initiatives', list, { right: '<span class="mono faint" style="font-size:10px">ONE-OFF PROJECTS, LASTING EFFECTS</span>' }) +
      '</div><aside class="grid" style="align-content:start">' +
      card('Support desk', '<div class="rows"><div><span class="k">Tickets a month</span><span class="v">' + Math.round(sup.tickets) + '</span></div><div><span class="k">Team capacity</span><span class="v">' + Math.round(sup.cap) + '</span></div><div><span class="k">Customer success managers</span><span class="v">' + FS.cnt(s, 'csm') + '</span></div><div><span class="k">Support associates</span><span class="v">' + FS.cnt(s, 'support') + '</span></div></div><p class="cb note">Below 90% SLA, churn rises. Support Associates are the cheapest capacity (~220 tickets a month each).</p>', { hl: sup.sla < 0.9 }) +
      card('Risk and compliance', '<div class="rows">' + risk.map(function (r) { return '<div><span class="k">' + r[0] + '</span><span class="v ' + (r[1] ? 'up' : 'faint') + '">' + (r[1] ? 'IN PLACE' : '—') + '</span></div>'; }).join('') + '</div>') +
      card('Vendor and fixed costs · monthly', '<div class="rows">' + vend.map(function (r) { return '<div><span class="k">' + r[0] + '</span><span class="v">' + r[1] + '</span></div>'; }).join('') + '</div>') +
      '</aside></div>';
  };

  /* ------------------------------------------------------------------ PARTNERS & DEALS */
  U.views.partners = function (m) {
    var s = S(), lev = FS.leverage(s);
    var offers = s.partners.offers.map(function (o) {
      var T = FS.PARTNERS[o.id];
      var terms = Object.keys(o.terms).map(function (k) {
        var t = o.terms[k], best = t.bool ? !t.val : (t.up ? t.val >= t.lim : t.val <= t.lim);
        return '<tr><td>' + esc(t.label) + '</td><td class="faint">' + FS.termTxt({ val: t.start, unit: t.unit, bool: t.bool }) + '</td><td class="' + (t.val !== t.start ? 'up' : '') + '">' + FS.termTxt(t) + '</td><td>' + DO(best ? 'Best possible' : t.bool ? 'Ask to drop' : (t.up ? 'Ask for more' : 'Push down'), 'pNegotiate', { id: o.id, k: k }, { cls: 'sm', cost: best || o.counters >= 3 ? null : { str: 1 }, disabled: best || o.counters >= 3 || !afford({ str: 1 }) }) + '</td></tr>';
      }).join('');
      var fee = o.terms.fee ? o.terms.fee.val : 0;
      return '<section class="card hl"><div class="ch"><span class="eyebrow acc">Proposal · ' + esc(T.name) + ' · ' + esc(T.type) + '</span><span class="mono faint" style="font-size:10px">EXPIRES M' + mm(o.expires) + ' · ' + o.counters + ' / 3 COUNTERS</span></div><div class="cb" style="display:flex;flex-direction:column;gap:10px"><p class="lede" style="font-size:14px">' + esc(T.pitch) + '</p><p class="note">What you get: ' + esc(benefitTxt(T)) + (T.effort ? ' Integration: ' + T.effort + ' eng-weeks.' : ' No integration needed.') + '</p></div>' +
        '<div class="tscroll"><table><thead><tr><th>Term</th><th>Opening</th><th>Now</th><th></th></tr></thead><tbody>' + terms + '</tbody></table></div>' +
        (o.log.length ? '<div class="cb note">' + o.log.map(esc).join(' ') + '</div>' : '') +
        '<div class="cb" style="display:flex;gap:8px;flex-wrap:wrap;border-top:1px solid var(--line)">' + DO('Sign the deal', 'pAccept', { id: o.id }, { cls: 'primary sm', cost: fee ? { str: 1, cash: fee } : { str: 1 }, disabled: !afford({ str: 1, cash: fee }) }) + DO('Decline', 'pDecline', { id: o.id }, { cls: 'sm' }) + '</div></section>';
    }).join('');
    var act = s.partners.active.map(function (p) {
      var T = FS.PARTNERS[p.id], e = FS.partnerEcon(s, p);
      return '<div class="lrow" style="flex-wrap:wrap;padding:10px 16px;gap:8px"><span style="flex:1;min-width:180px"><b style="font-weight:500">' + esc(T.name) + '</b> <span class="pill ' + (p.status === 'live' ? 'up' : 'acc') + '">' + (p.status === 'live' ? 'LIVE' : 'INTEGRATING') + '</span><br><span class="note">' + Object.keys(p.terms).map(function (k) { return esc(p.terms[k].label) + ': ' + FS.termTxt(p.terms[k]); }).join(' · ') + '</span></span><span class="mono" style="font-size:12px">' + f1(p.cust) + ' cust · ' + L(p.mrr, 2) + ' MRR · share ' + L(e.cost, 2) + '</span>' + DO('End', 'pEnd', { id: p.id }, { cls: 'sm', cost: { ops: 1 }, disabled: !afford({ ops: 1 }), title: p.commitUntil > s.month ? 'Locked in until M' + p.commitUntil + ' (₹5L penalty)' : '' }) + '</div>';
    }).join('');
    var D = s.deals, deal = '';
    if (D.offer) {
      var d = D.offer, reqs = FS.dealReqs(s, d), effort = FS.dealEffort(s, d), cap = Math.max(0.5, m.eng.feature), months = effort / cap;
      deal = '<section class="card hl"><div class="ch"><span class="eyebrow acc">RFP · ' + esc(d.name) + ' · ' + d.trucks + ' trucks</span><span class="mono faint" style="font-size:10px">RESPOND BY M' + mm(d.expires) + '</span></div>' +
        '<div class="statrow" style="border-left:0;border-right:0"><div><span class="l">CONTRACT MRR</span><span class="v">' + L(d.mrr, 2) + '</span></div><div><span class="l">SETUP FEE</span><span class="v">' + L(d.fee) + '</span></div><div><span class="l">BUILD WORK</span><span class="v">' + effort + ' wks</span></div><div><span class="l">DEADLINE</span><span class="v">' + d.deadline + ' months</span></div></div>' +
        '<div class="rows">' + reqs.map(function (r) { return '<div><span class="k">' + esc(r.name) + (r.custom ? ' <span class="pill down">BESPOKE</span>' : '') + '</span><span class="v ' + (r.met ? 'up' : 'mut') + '" style="font-size:11px">' + esc(r.note) + '</span></div>'; }).join('') + '</div>' +
        '<p class="cb note">At today\'s feature capacity (' + f1(cap) + ' wks/mo) the build takes about <b class="' + (months > d.deadline ? 'down' : 'up') + '">' + f1(months) + ' months</b>, and pushes everything else back. Bespoke items add permanent upkeep (0.8 eng-weeks a month each). ' + (d.productised ? '<span class="up">Agreed: you will build these as standard features.</span>' : 'You can try to convince them to accept standard product features instead.') + '</p>' +
        '<div class="cb" style="display:flex;gap:8px;flex-wrap:wrap;border-top:1px solid var(--line)">' + (!d.tried ? DO('Propose productised features', 'dProductise', {}, { cls: 'sm', cost: { str: 1 }, disabled: !afford({ str: 1 }) }) : '') + DO('Accept', 'dAccept', { pod: false }, { cls: 'primary sm', cost: { str: 1 }, disabled: !afford({ str: 1 }) }) + DO('Accept with a dedicated pod', 'dAccept', { pod: true }, { cls: 'sm ghost', cost: { str: 1, ppl: 1 }, disabled: !afford({ str: 1, ppl: 1 }), title: 'Hires 2 engineers and 1 solutions engineer, starting next month' }) + DO('Decline', 'dDecline', {}, { cls: 'sm' }) + '</div></section>';
    }
    var building = D.active.map(function (d) {
      var reqs = FS.dealReqs(s, d), done = reqs.filter(function (r) { return r.met; }).length;
      return '<div class="alert"><span class="lv ' + (s.month > d.deadline - 1 ? 'down' : 'acc') + '">M' + mm(d.deadline) + '</span><span style="flex:1"><b style="font-weight:500">' + esc(d.name) + '</b> · ' + L(d.mrr, 2) + ' MRR · ' + done + ' / ' + reqs.length + ' requirements met<br><span class="note">' + reqs.map(function (r) { return (r.met ? '✓ ' : '○ ') + esc(r.name) + ' (' + esc(r.note) + ')'; }).join(' · ') + '</span></span></div>';
    }).join('');
    var live = D.live.map(function (d) { return '<div><span class="k">' + esc(d.name) + '</span><span class="v">' + L(d.mrr, 2) + ' · since M' + mm(d.at) + '</span></div>'; }).join('');
    return head('Partners & Deals', 'Partners widen distribution. <span class="em">Big customers want it their way.</span>') +
      kpis([['LIVE PARTNERS', String(s.partners.active.filter(function (p) { return p.status === 'live'; }).length), s.partners.active.length + ' SIGNED', 'mut'], ['PARTNER MRR', L(s.partners.active.reduce(function (a, p) { return a + p.mrr; }, 0), 2), 'SOURCED BY PARTNERS', 'mut'], ['LEVERAGE', Math.round(lev * 100) + '%', 'FIT, ARR, PARTNERS MANAGER', lev < 0.25 ? 'down' : 'acc'], ['ENTERPRISE LIVE', String(D.live.length), L(D.live.reduce(function (a, d) { return a + d.mrr; }, 0), 2) + ' MRR', 'mut'], ['CUSTOM UPKEEP', f1(s.product.maint) + ' wks', 'EVERY MONTH', s.product.maint > 2 ? 'down' : 'mut']]) +
      '<div class="grid gside"><div class="grid" style="align-content:start">' +
      (offers || card('Partnership proposals', '<p class="cb note">No open proposals. Partners approach you as the company grows; a Partnerships Manager attracts better terms and more leads from each partner.</p>')) +
      (deal || card('Enterprise deal desk', '<p class="cb note">No open RFPs. Large fleets send RFPs once you have ₹1.2 Cr+ ARR and an Account Executive or Head of Sales. Enterprise-led GTM and SOC 2 bring more of them.</p>')) +
      (building ? card('Deals in delivery', building) : '') +
      '</div><aside class="grid" style="align-content:start">' +
      card('Signed partnerships', act || '<p class="cb note">None yet.</p>') +
      card('Live enterprise customers', live ? '<div class="rows">' + live + '</div>' : '<p class="cb note">None yet.</p>') +
      card('Negotiating', '<p class="cb note">Each push costs 1 Strategy focus. Your odds rise with leverage: fit, ARR, live partners and a Partnerships Manager. Every counter makes the next one harder, and the other side may walk away.</p>') +
      '</aside></div>';
  };
  function benefitTxt(T) {
    var b = T.benefit, o = [];
    if (b.leads) o.push('~' + b.leads + ' leads a month');
    if (b.ent) o.push('enterprise introductions');
    if (b.pmf) o.push('product fit +' + Math.round(b.pmf * 100));
    if (b.churn) o.push('lower churn');
    if (b.expansion) o.push('expansion revenue');
    if (b.credits) o.push('cloud credits against your infra bill');
    if (b.pay) o.push('a share of payment fees as new revenue');
    return o.join(', ') + '.';
  }

  /* ------------------------------------------------------------------ REPORTS */
  var rtab = 'pl', roff = 0;
  U.H.rtab = function (d) { rtab = d.v; U.render(); };
  U.H.rpage = function (d) { roff = Math.max(0, roff + Number(d.d)); U.render(); };
  U.H.rcsv = function () {
    var t = buildTable(S(), true); if (!t) return;
    var csv = t.map(function (r) { return r.map(function (c) { c = String(c == null ? '' : c); return /[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(','); }).join('\n');
    try { var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'founders-seat-' + rtab + '-seed' + S().seed + '.csv'; document.body.appendChild(a); a.click(); a.remove(); } catch (e) { U.toast('Download blocked by the browser.', true); }
  };
  function n1(x) { return x == null || isNaN(x) ? '' : (Math.abs(x) < 0.05 ? '0.0' : (x < 0 ? '(' + Math.abs(x).toFixed(1) + ')' : x.toFixed(1))); }
  function plRows(reps) {
    var R = [], cats = {};
    reps.forEach(function (r) { Object.keys(r.pl.opex.oneoff).forEach(function (c) { cats[c] = 1; }); });
    var chans = {}; reps.forEach(function (r) { Object.keys(r.pl.opex.progs).forEach(function (c) { chans[c] = 1; }); });
    function row(label, fn, cls) { R.push([label, fn ? reps.map(fn) : null, cls || '']); }
    row('REVENUE', null, 'sec');
    row('Subscription revenue', function (r) { return r.pl.rev.subscription; });
    row('Payments income', function (r) { return r.pl.rev.payments; });
    row('Implementation and services', function (r) { return r.pl.rev.oneoff; });
    row('Total revenue', function (r) { return r.pl.rev.total; }, 'strong');
    row('COST OF REVENUE', null, 'sec');
    row('Infrastructure (net of credits)', function (r) { return -r.pl.cogs.infra; });
    row('Customer success and support payroll', function (r) { return -r.pl.cogs.support; });
    row('Partner revenue share', function (r) { return -r.pl.cogs.revShare; });
    row('Gross profit', function (r) { return r.pl.gp; }, 'strong');
    row('Gross margin %', function (r) { return r.pl.gm * 100; }, 'pctrow');
    row('OPERATING EXPENSES', null, 'sec');
    row('R&D payroll (engineering, product)', function (r) { return -r.pl.opex.rd; });
    row('Sales and marketing payroll', function (r) { return -r.pl.opex.smPay; });
    row('Growth programmes', function (r) { return -r.pl.opex.programs; });
    Object.keys(chans).forEach(function (c) { row('  ' + (FS.CH[c] ? FS.CH[c].name : c), function (r) { return -(r.pl.opex.progs[c] || 0); }, 'sub'); });
    row('G&A payroll (leadership, operations)', function (r) { return -r.pl.opex.gaPay; });
    row('Rent', function (r) { return -r.pl.opex.rent; });
    row('Tools and software', function (r) { return -r.pl.opex.tools; });
    row('Insurance', function (r) { return -r.pl.opex.insurance; });
    Object.keys(cats).forEach(function (c) { row(c, function (r) { return -(r.pl.opex.oneoff[c] || 0); }); });
    row('Total operating expenses', function (r) { return -r.pl.opex.total; }, 'strong');
    row('EBITDA', function (r) { return r.pl.ebitda; }, 'strong');
    row('Interest', function (r) { return -r.pl.interest; });
    row('Net income', function (r) { return r.pl.net; }, 'strong');
    return R;
  }
  function cfRows(reps) {
    var R = [], wc = {}, fin = {};
    reps.forEach(function (r) { Object.keys(r.cf.wcl).forEach(function (c) { wc[c] = 1; }); Object.keys(r.cf.finl).forEach(function (c) { fin[c] = 1; }); });
    function row(label, fn, cls) { R.push([label, fn ? reps.map(fn) : null, cls || '']); }
    row('Opening cash', function (r) { return r.cf.open; }, 'strong');
    row('OPERATING', null, 'sec');
    row('Receipts from customers (billed)', function (r) { return r.cf.receipts; });
    row('Payroll', function (r) { return r.cf.payroll; });
    row('Vendors, infrastructure and programmes', function (r) { return r.cf.vendors; });
    row('Interest paid', function (r) { return r.cf.interest; });
    row('One-off costs', function (r) { return r.cf.oneoff; });
    Object.keys(wc).forEach(function (c) { row(c, function (r) { return r.cf.wcl[c] || 0; }); });
    row('Operating cash flow', function (r) { return r.cf.receipts + r.cf.payroll + r.cf.vendors + r.cf.interest + r.cf.oneoff + r.cf.wc; }, 'strong');
    row('FINANCING', null, 'sec');
    Object.keys(fin).forEach(function (c) { row(c, function (r) { return r.cf.finl[c] || 0; }); });
    row('Debt repayment', function (r) { return r.cf.repay; });
    if (reps.some(function (r) { return Math.abs(r.cf.other) > 0.05; })) row('Other', function (r) { return r.cf.other; });
    row('Closing cash', function (r) { return r.cf.close; }, 'strong');
    row('Receivables (end of month)', function (r) { return r.mis.ar; }, 'sub');
    row('Days to collect', function (r) { return r.mis.dso; }, 'sub int');
    row('Runway (months)', function (r) { return isFinite(r.mis.runway) ? r.mis.runway : null; }, 'sub');
    return R;
  }
  function misRows(reps) {
    var R = [];
    function row(label, fn, cls) { R.push([label, fn ? reps.map(fn) : null, cls || '']); }
    row('REVENUE', null, 'sec');
    row('ARR', function (r) { return r.mis.arr; }, 'strong');
    row('MRR', function (r) { return r.mis.mrr; });
    row('New MRR', function (r) { return r.mis.newMrr; });
    row('Expansion MRR', function (r) { return r.mis.expansionMrr; });
    row('Churned MRR', function (r) { return -r.mis.churnedMrr; });
    row('MoM growth % (3-mo avg)', function (r) { return r.mis.g3 * 100; }, 'pctrow');
    row('CUSTOMERS', null, 'sec');
    row('Customers', function (r) { return r.mis.customers; }, 'int');
    row('New', function (r) { return r.mis.newCust; }, 'int');
    row('Churned', function (r) { return -r.mis.churned; }, 'int');
    row('Avg revenue per account', function (r) { return r.mis.arpa; }, 'dp2');
    row('Logo churn % / month', function (r) { return r.mis.churn * 100; }, 'pctrow dp2');
    row('Net revenue retention %', function (r) { return r.mis.nrr * 100; }, 'pctrow');
    row('Gross revenue retention %', function (r) { return r.mis.grr * 100; }, 'pctrow');
    row('FUNNEL', null, 'sec');
    row('Leads', function (r) { return r.mis.leads; });
    row('Qualified opportunities', function (r) { return r.mis.opps; });
    row('Deals worked by sales', function (r) { return r.mis.worked; });
    row('Sales capacity', function (r) { return r.mis.cap; });
    row('Win rate %', function (r) { return r.mis.win * 100; }, 'pctrow');
    row('UNIT ECONOMICS', null, 'sec');
    row('CAC, programmes only', function (r) { return r.mis.cac; });
    row('CAC, fully loaded', function (r) { return r.mis.cacFull; });
    row('CAC payback (months)', function (r) { return r.mis.payback; });
    row('Customer lifetime value', function (r) { return r.mis.ltv; });
    row('LTV : CAC', function (r) { return r.mis.cacFull ? r.mis.ltv / r.mis.cacFull : null; }, 'dp2');
    row('Gross margin %', function (r) { return r.mis.gm * 100; }, 'pctrow');
    row('Net burn', function (r) { return r.mis.burn; });
    row('Burn multiple', function (r) { return r.mis.bm > 50 ? null : r.mis.bm; }, 'dp2');
    row('Cash', function (r) { return r.mis.cash; }, 'strong');
    row('Runway (months)', function (r) { return isFinite(r.mis.runway) ? r.mis.runway : null; });
    row('TEAM', null, 'sec');
    row('Headcount', function (r) { return r.mis.headcount; }, 'int');
    ['eng', 'product', 'sales', 'mkt', 'cs', 'ops'].forEach(function (f) { row('  ' + { eng: 'Engineering', product: 'Product', sales: 'Sales', mkt: 'Marketing', cs: 'Customer success', ops: 'Operations' }[f], function (r) { return r.mis.fn[f] || 0; }, 'sub int'); });
    row('ARR per employee', function (r) { return r.mis.revPerHead; });
    row('Average morale', function (r) { return r.mis.morale; }, 'int');
    row('PRODUCT AND OPERATIONS', null, 'sec');
    row('Feature eng-weeks shipped', function (r) { return r.mis.featureWeeks; });
    row('Tech debt index', function (r) { return r.mis.debt; }, 'int');
    row('Product fit index', function (r) { return r.mis.pmf * 100; }, 'int');
    row('Support SLA %', function (r) { return r.mis.sla * 100; }, 'pctrow');
    row('Days to collect', function (r) { return r.mis.dso; }, 'int');
    row('Security score', function (r) { return r.mis.sec; }, 'int');
    row('Board confidence', function (r) { return r.mis.board; }, 'int');
    return R;
  }
  function fmtCell(v, cls) {
    if (v == null) return '—';
    if (/int/.test(cls)) return String(Math.round(v));
    if (/dp2/.test(cls)) return v.toFixed(2);
    if (/pctrow/.test(cls)) return v.toFixed(1);
    return n1(v);
  }
  function buildTable(s, raw) {
    var reps = s.reports.filter(function (r) { return r.pl && r.cf && r.mis; });
    if (!reps.length) return null;
    var R = rtab === 'pl' ? plRows(reps) : rtab === 'cf' ? cfRows(reps) : misRows(reps);
    if (raw) return [['Line (₹ lakh)'].concat(reps.map(function (r) { return 'M' + r.m; }))].concat(R.filter(function (x) { return x[1]; }).map(function (x) { return [x[0].trim()].concat(x[1].map(function (v) { return v == null ? '' : Math.round(v * 100) / 100; })); }));
    return { reps: reps, rows: R };
  }
  U.views.reports = function (m) {
    var s = S(), t = buildTable(s, false);
    var tabs = [['pl', 'Monthly P&L'], ['cf', 'Cash flow and balances'], ['mis', 'MIS report']];
    var tabbar = '<div class="seg" role="tablist" aria-label="Report">' + tabs.map(function (x) { return '<button type="button" role="tab" data-act="rtab" data-v="' + x[0] + '" aria-pressed="' + (rtab === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</div>';
    if (!t) return head('Reports', 'Your first month-end close is <span class="em">still to come.</span>') + '<section class="card"><div class="cb">' + tabbar + '<p class="note" style="margin-top:12px">Reports appear after you end month 1.</p></div></section>';
    var n = t.reps.length, per = 6, maxOff = Math.max(0, n - per); if (roff > maxOff) roff = maxOff;
    var end = n - roff, start = Math.max(0, end - per), idx = []; for (var i = start; i < end; i++) idx.push(i);
    var showTotal = rtab === 'pl';
    var th = '<tr><th>₹ lakh</th>' + idx.map(function (i) { return '<th>M' + mm(t.reps[i].m) + '</th>'; }).join('') + (showTotal ? '<th>Total M' + mm(t.reps[0].m) + '–' + mm(t.reps[n - 1].m) + '</th>' : '') + '</tr>';
    var body = t.rows.map(function (r) {
      if (!r[1]) return '<tr class="secrow"><td colspan="' + (idx.length + 1 + (showTotal ? 1 : 0)) + '">' + r[0] + '</td></tr>';
      var tot = showTotal && !/pctrow/.test(r[2]) ? r[1].reduce(function (a, v) { return a + (v || 0); }, 0) : null;
      if (showTotal && /pctrow/.test(r[2])) { var rv = t.reps.reduce(function (a, x) { return a + x.pl.rev.total; }, 0), gp = t.reps.reduce(function (a, x) { return a + x.pl.gp; }, 0); tot = rv ? gp / rv * 100 : null; }
      return '<tr class="' + (/strong/.test(r[2]) ? 'strong' : '') + (/sub/.test(r[2]) ? ' subrow' : '') + '"><td>' + esc(r[0]) + '</td>' + idx.map(function (i) { var v = r[1][i]; return '<td class="' + (v < -0.05 && !/pctrow|int/.test(r[2]) ? 'neg' : '') + '">' + fmtCell(v, r[2]) + '</td>'; }).join('') + (showTotal ? '<td class="tot">' + fmtCell(tot, r[2]) + '</td>' : '') + '</tr>';
    }).join('');
    var last = t.reps[n - 1];
    var hl = rtab === 'pl' ? 'Month ' + last.m + ' net income: <span class="em">' + L(last.pl.net) + '.</span>' : rtab === 'cf' ? 'Cash went from ' + L(last.cf.open) + ' to <span class="em">' + L(last.cf.close) + '.</span>' : 'ARR ' + L(last.mis.arr) + ', <span class="em">' + pct(last.mis.g3) + ' monthly growth.</span>';
    return head('Reports · month-end close', hl) +
      '<section class="card"><div class="ch" style="flex-wrap:wrap;align-items:center">' + tabbar + '<span style="display:flex;gap:6px;align-items:center">' + btn('◀ Earlier', 'rpage', { d: 6 }, { cls: 'sm', disabled: roff >= maxOff }) + btn('Later ▶', 'rpage', { d: -6 }, { cls: 'sm', disabled: roff <= 0 }) + btn('Download CSV', 'rcsv', {}, { cls: 'sm ghost' }) + '</span></div>' +
      '<div class="tscroll"><table class="report">' + '<thead>' + th + '</thead><tbody>' + body + '</tbody></table></div>' +
      '<p class="cb note">' + (rtab === 'pl' ? 'Accrual view: revenue is recognised when billed. Figures in ₹ lakh; brackets are negative.' : rtab === 'cf' ? 'Cash view: customers pay with a lag (days to collect), so growing revenue ties up cash in receivables. Equity and debt appear here, never in the P&L.' : 'The management pack a board expects every month. CAC payback above 18 months or LTV:CAC under 3 usually means growth is too expensive.') + '</p></section>';
  };

  /* ------------------------------------------------------------------ GOALS */
  U.views.goals = function (m) {
    var s = S(), chapters = [];
    FS.GOALS.forEach(function (g) { if (chapters.indexOf(g.ch) < 0) chapters.push(g.ch); });
    var done = Object.keys(s.goals).length;
    var cards = chapters.map(function (c) {
      var gs = FS.GOALS.filter(function (g) { return g.ch === c; });
      return card(c, '<div class="rows">' + gs.map(function (g) { var d = s.goals[g.id]; return '<div><span class="k">' + (d ? '<span class="up">✓</span> ' : '<span class="faint">○</span> ') + esc(g.name) + '</span><span class="v ' + (d ? 'up' : 'faint') + '" style="font-size:11px">' + (d ? 'M' + mm(d) : (g.board ? 'BOARD +' + g.board : '')) + '</span></div>'; }).join('') + '</div>', { right: '<span class="mono faint" style="font-size:10px">' + gs.filter(function (g) { return s.goals[g.id]; }).length + ' / ' + gs.length + '</span>' });
    }).join('');
    var okr = s.okrs.length ? '<div class="rows">' + s.okrs.map(function (o) { var ok = FS.okrMet(s, o); return '<div><span class="k">' + esc(o.label) + '</span><span class="v ' + (ok ? 'up' : 'mut') + '">' + (ok ? 'ON TRACK' : 'OPEN') + '</span></div>'; }).join('') + '</div>' : '<p class="cb note">The board sets targets at the end of each quarter, starting in month 3.</p>';
    return head('Goals', done + ' of ' + FS.GOALS.length + ' milestones. <span class="em">Series A is a step, not the finish.</span>') +
      '<div class="grid gside"><div class="grid g2" style="align-content:start">' + cards + '</div><aside class="grid" style="align-content:start">' +
      card('Board targets this quarter', okr + '<p class="cb note">Hitting a target adds 3 board confidence at the next meeting; missing one costs 2.</p>', { hl: true }) +
      card('How goals count', '<p class="cb note">Milestones lift board confidence when you reach them, and the debrief scores how many you hit. Your main score is still Founder Outcome: company value × your ownership at month 36.</p>') +
      '</aside></div>';
  };
})();
