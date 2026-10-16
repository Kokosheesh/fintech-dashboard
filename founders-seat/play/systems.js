/* Founder's Seat — systems layer: growth engine, product library, experiments, operations,
   partners, enterprise deals, crises, goals and financial reporting. Plugs into engine.js hooks. */
(function (root) {
  'use strict';
  var FS = root.FS, H = FS._h, HK = FS._hooks, ACT = FS._ACT, EV = FS._EV, FX = FS._FX;
  var rng = H.rng, clamp = H.clamp, sround = H.sround, news = H.news, log = H.logDecision, addTemp = H.addTemp,
    spend = H.spend, book = H.book, findP = H.findP, rampF = H.rampF, tempSum = FS.tempSum;

  /* ---------- small helpers ---------- */
  function cnt(s, role) { var n = 0; s.people.forEach(function (p) { if (p.role === role) n++; }); return n; }
  function eff(s, role) { return s.people.reduce(function (a, p) { return a + (p.role === role ? p.skill * rampF(p) : 0); }, 0); }
  function has(s, id) { return s.product.shipped.indexOf(id) >= 0; }
  function opsDone(s, id) { return !!(s.ops && s.ops.done[id]); }
  function gauss(s) { var u = Math.max(1e-9, rng(s)), v = rng(s); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  function liveParts(s) { return s.partners.active.filter(function (p) { return p.status === 'live'; }); }
  function ins(s) { return s.flags.insurance ? 0.4 : 1; }
  function tax(s, wks) { s.product.progress.__tax = (s.product.progress.__tax || 0) + wks; }
  function okr(o) { return o; }
  FS.cnt = cnt; FS.eff = eff; FS.has = has; FS.opsDone = opsDone;

  /* =====================================================================
     1. PRODUCT LIBRARY — new ideas keep arriving as the product matures
     ===================================================================== */
  var LIB = [
    ['usage', 'Usage-based pricing', 12, 'Monetisation', { expansion: 0.005 }, 'Heavy users pay flat fees today.', 1],
    ['sso', 'SSO and audit logs', 20, 'Enterprise', { win: 0.01, sec: 10, flag: 'sso' }, 'The price of entry for Enterprise deals.', 1],
    ['dispatch', 'Dispatch integration', 24, 'Fit', { pmf: 0.04, churn: -0.001 }, 'Kavya and other logistics accounts want it.', 1],
    ['billing', 'Billing service refactor', 16, 'Platform', { debt: -22, risk: -0.15 }, 'The source of most incidents.', 1],
    ['whatsapp', 'WhatsApp notifications', 6, 'Retention', { pmf: 0.02, churn: -0.002 }, 'Drivers ignore email.', 1],
    ['analytics', 'Analytics dashboard', 14, 'Retention', { pmf: 0.04, churn: -0.003 }, 'Ops heads want proof of savings.', 1],
    ['selfserve', 'Self-serve onboarding', 18, 'Growth', { cac: -0.15, organic: 0.4, act: 0.05, flag: 'selfserve' }, 'Every deal needs a demo today. Enables product-led growth.', 1],
    ['mobile', 'Native mobile app', 40, 'Fit', { pmf: 0.02, cac: -0.05, debt: 4, flag: 'mobile' }, 'Asked for by three customers.', 1],
    ['onboardwiz', 'Guided setup wizard', 8, 'Growth', { act: 0.06, churn: -0.001 }, 'Half of new accounts stall before adding a truck.', 2],
    ['eta', 'Live ETA links for consignees', 8, 'Growth', { organic: 0.25, pmf: 0.01 }, 'Every shared link is a free ad to a shipper.', 2],
    ['epod', 'Electronic proof of delivery', 10, 'Retention', { pmf: 0.03, churn: -0.002 }, 'Paper PODs delay invoicing by a week.', 2],
    ['routeopt', 'Route optimisation', 20, 'Fit', { pmf: 0.05, churn: -0.002, debt: 2 }, 'The feature prospects ask about first.', 3],
    ['rbac', 'Roles and permissions', 10, 'Enterprise', { win: 0.02, flag: 'rbac' }, 'Mid-market buyers need branch-level access.', 3],
    ['testing', 'Automated test suite', 14, 'Platform', { debt: -12, risk: -0.25, flag: 'testing' }, 'Releases break things nobody tested.', 3],
    ['observ', 'Monitoring and alerting', 8, 'Platform', { risk: -0.25, flag: 'observ' }, 'Customers find outages before you do.', 3],
    ['ewaybill', 'GST e-way bill automation', 10, 'Fit', { pmf: 0.04, churn: -0.002 }, 'Dispatchers re-type every e-way bill by hand.', 4],
    ['hindi', 'Hindi and regional-language UI', 8, 'Growth', { act: 0.04, qual: 0.03 }, 'Most fleet owners prefer Hindi or Marathi.', 4],
    ['inapp', 'In-app chat support', 6, 'Retention', { churn: -0.0015 }, 'Support happens on personal WhatsApp today.', 4],
    ['api', 'Public API and webhooks', 16, 'Platform', { organic: 0.2, expansion: 0.002, debt: 2, flag: 'api' }, 'Partners and larger customers keep asking.', 5],
    ['fuel', 'Fuel-theft alerts', 12, 'Fit', { pmf: 0.03, expansion: 0.002 }, 'Fuel is 40% of a fleet\'s costs.', 5],
    ['trial', 'Free 14-day trial', 6, 'Growth', { qual: 0.04, act: 0.03, flag: 'trial' }, 'Prospects want to try before a demo.', 5, 'selfserve'],
    ['multi', 'Multi-branch accounts', 14, 'Monetisation', { expansion: 0.004, win: 0.01 }, 'Growing fleets open second depots.', 6],
    ['driverapp', 'Offline driver app', 14, 'Fit', { pmf: 0.03, churn: -0.002 }, 'Highways have no signal.', 6, 'mobile'],
    ['audit', 'Data retention and audit trail', 10, 'Security', { sec: 15, win: 0.01 }, 'Procurement teams ask for it in every RFP.', 6],
    ['perf', 'Performance overhaul', 12, 'Platform', { debt: -10, churn: -0.001 }, 'Month-end reports time out.', 6],
    ['invoicing', 'Freight invoicing module', 22, 'Monetisation', { expansion: 0.005, pmf: 0.02, debt: 3 }, 'An add-on customers would pay extra for.', 7],
    ['portal', 'Shipper self-service portal', 14, 'Growth', { organic: 0.25, churn: -0.001 }, 'Shippers call your customers for status updates.', 8],
    ['dataloc', 'India data residency', 8, 'Security', { sec: 8, win: 0.01 }, 'Regulated customers need data kept in India.', 8],
    ['coldchain', 'Cold-chain temperature tracking', 16, 'Fit', { pmf: 0.03, expansion: 0.002 }, 'Pharma and food fleets would pay for it.', 9],
    ['customreports', 'Report builder', 12, 'Retention', { churn: -0.0015, expansion: 0.002 }, 'Every account wants a slightly different report.', 9],
    ['benchmark', 'Industry benchmark dashboards', 10, 'Growth', { win: 0.02, organic: 0.15 }, 'Prospects love seeing how peers perform.', 10, 'analytics'],
    ['payments', 'Embedded freight payments', 24, 'Monetisation', { expansion: 0.006, debt: 3 }, 'Fleets chase payments for weeks.', 10],
    ['ratecard', 'Smart rate cards', 12, 'Monetisation', { expansion: 0.003, pmf: 0.02 }, 'Pricing a lane is guesswork today.', 11],
    ['aiplan', 'AI load planning', 30, 'Fit', { pmf: 0.06, organic: 0.3, debt: 5 }, 'Stackline is demoing something similar.', 12],
    ['carbon', 'Carbon-emissions reporting', 12, 'Enterprise', { win: 0.02, organic: 0.1 }, 'Large shippers now ask carriers for emissions data.', 12],
    ['maintenance', 'Predictive maintenance alerts', 18, 'Fit', { pmf: 0.04, expansion: 0.002 }, 'A breakdown costs a fleet ₹40,000 a day.', 14],
    ['marketplace', 'Load marketplace', 40, 'Growth', { organic: 0.5, pmf: 0.02, debt: 8 }, 'A bet: match idle trucks with loads.', 16],
    ['copilot', 'AI dispatcher copilot', 26, 'Fit', { pmf: 0.05, act: 0.03, debt: 4 }, 'Dispatchers drown in WhatsApp messages.', 18]
  ];
  var LIBMAP = {}; LIB.forEach(function (d) { LIBMAP[d[0]] = d; });
  var SRC = ['Customer calls', 'Sales team', 'Arjun (CTO)', 'Support tickets', 'Usage data', 'A lost deal', 'Board member'];

  function makeItem(s, d, over) {
    var it = { id: d[0], name: d[1], effort: d[2], cat: d[3], fx: d[4], why: d[5], src: d[0] === 'dispatch' ? 'Customer calls' : SRC[Math.floor(rng(s) * SRC.length)], real: Math.round((0.5 + rng(s) * 1.1) * 100) / 100, born: s.month };
    for (var k in over || {}) it[k] = over[k];
    s.product.items[it.id] = it;
    return it;
  }
  FS.libItem = function (s, id) { if (!s.product.items[id] && LIBMAP[id]) makeItem(s, LIBMAP[id]); return s.product.items[id]; };

  function refreshBacklog(s, rep) {
    var P = s.product, added = [];
    for (var g = 0; g < 2 && P.backlog.length < 7; g++) {
      var cand = LIB.filter(function (d) { return !P.items[d[0]] && d[6] <= s.month && (!d[7] || has(s, d[7])); });
      var it;
      if (cand.length) it = makeItem(s, cand[Math.floor(rng(s) * Math.min(3, cand.length))]);
      else {
        var base = P.shipped.map(function (id) { return P.items[id]; }).filter(function (x) { return x && !x.custom && !x.partner && ['Fit', 'Retention', 'Growth', 'Monetisation'].indexOf(x.cat) >= 0; });
        if (!base.length) break;
        var b = base[Math.floor(rng(s) * base.length)];
        var root0 = b.root || b.id, v = (s.product.ver[root0] || 1) + 1; s.product.ver[root0] = v;
        var fx = {}; for (var k in b.fx) { if (k === 'flag') continue; fx[k] = k === 'debt' ? Math.max(1, Math.round(b.fx[k] / 2)) : b.fx[k] * 0.5; }
        var nm = b.name.replace(/ v\d+$/, '');
        it = makeItem(s, [root0 + '_v' + v, nm + ' v' + v, Math.max(4, Math.round(b.effort * 0.7)), b.cat, fx, 'Customers want more depth in ' + nm.toLowerCase() + '.', 0], { root: root0 });
      }
      P.backlog.push(it.id); added.push(it.name);
    }
    if (added.length && rep) rep.notes.push('New in the backlog: ' + added.join(', ') + '.');
  }

  function room(x, top, span) { return clamp((top - x) / span, 0, 1); }
  FS.headroom = function (s) { return { pmf: room(s.product.pmf, 0.88, 0.33), win: room(s.funnel.win, 0.72, 0.22) }; };
  function applyFx(s, fx, mult) {
    var P = s.product, F = s.funnel;
    if (fx.pmf) P.pmf += fx.pmf * mult * (fx.pmf > 0 ? room(P.pmf, 0.88, 0.33) : 1);
    if (fx.churn) s.mods.churn = Math.max(-0.005, s.mods.churn + fx.churn * 0.5 * mult * (fx.churn < 0 ? room(-s.mods.churn, 0.005, 0.005) : 1));
    if (fx.cac) s.mods.cac = Math.max(0.6, s.mods.cac * (1 + fx.cac * mult));
    if (fx.organic) s.mods.organic = Math.min(2, s.mods.organic + fx.organic * mult);
    if (fx.expansion) s.mods.expansion = Math.min(0.028, s.mods.expansion + fx.expansion * mult);
    if (fx.debt) P.debt = clamp(P.debt + (fx.debt < 0 ? fx.debt * mult : fx.debt), 5, 100);
    if (fx.win) F.win += fx.win * mult * room(F.win, 0.72, 0.22);
    if (fx.qual) F.qual += fx.qual * mult * room(F.qual, 0.72, 0.22);
    if (fx.act) F.act += fx.act * mult * room(F.act, 0.75, 0.25);
    if (fx.sec) s.sec = clamp(s.sec + fx.sec, 0, 100);
    if (fx.risk) s.mods.incident *= 1 + fx.risk * Math.min(mult, 1.3);
    if (fx.flag) s.flags[fx.flag] = true;
    P.pmf = clamp(P.pmf, 0.2, 0.92); F.win = clamp(F.win, 0.2, 0.85); F.qual = clamp(F.qual, 0.2, 0.85); F.act = clamp(F.act, 0.2, 0.85);
  }

  FS.fxText = function (fx, mult) {
    mult = mult || 1; var o = [];
    function pp(x) { return (x > 0 ? '+' : '−') + Math.abs(x * 100).toFixed(Math.abs(x * 100) < 1 ? 1 : 0); }
    if (fx.pmf) o.push('Fit ' + pp(fx.pmf * mult));
    if (fx.churn) o.push('Churn ' + pp(fx.churn * mult) + 'pp');
    if (fx.cac) o.push('Lead cost ' + pp(fx.cac * mult) + '%');
    if (fx.organic) o.push('Inbound +' + Math.round(fx.organic * mult * 100) + '%');
    if (fx.expansion) o.push('Expansion ' + pp(fx.expansion * mult) + 'pp/mo');
    if (fx.win) o.push('Win rate ' + pp(fx.win * mult) + 'pp');
    if (fx.qual) o.push('Lead quality ' + pp(fx.qual * mult) + 'pp');
    if (fx.act) o.push('Activation ' + pp(fx.act * mult) + 'pp');
    if (fx.debt) o.push('Tech debt ' + (fx.debt > 0 ? '+' + fx.debt : '−' + Math.round(-fx.debt * mult)));
    if (fx.sec) o.push('Security +' + fx.sec);
    if (fx.risk) o.push('Incident risk ' + Math.round(fx.risk * 100) + '%');
    var flags = { sso: 'Unlocks Enterprise', selfserve: 'Enables product-led growth', api: 'Enables API partners', trial: 'Free trial', mobile: 'Mobile platform', observ: 'Observability', testing: 'Safer releases', rbac: 'Access control' };
    if (fx.flag && flags[fx.flag]) o.push(flags[fx.flag]);
    return o.join(' · ') || 'No direct metric change';
  };
  FS.itemEstimate = function (s, id) {
    var it = FS.item(s, id); if (!it) return { text: '', conf: '' };
    var pm = cnt(s, 'pm'), da = cnt(s, 'data');
    var est = pm ? 1 + (it.real - 1) * (da ? 0.7 : 0.45) : 1;
    return { text: FS.fxText(it.fx, est), conf: it.custom || it.partner ? 'Fixed' : pm && da ? 'High' : pm ? 'Medium' : 'Low' };
  };

  HK.ship = function (s, id, rep) {
    var it = FS.item(s, id); if (!it) return;
    if (it.partner) { activatePartner(s, it.partner, rep); return; }
    if (it.custom) { s.product.maint += 0.8; applyFx(s, it.fx || {}, 1); return; }
    var mult = it.real + 0.1 * Math.min(2, eff(s, 'pm'));
    if (it.cat === 'Growth' || it.cat === 'Retention') mult += 0.12 * Math.min(2, eff(s, 'designer'));
    it.realised = Math.round(mult * 100) / 100;
    applyFx(s, it.fx, mult);
    var lbl = mult >= 1.2 ? 'beat expectations' : mult < 0.8 ? 'landed below expectations' : 'landed as expected';
    rep.notes.push(it.name + ' ' + lbl + ': ' + FS.fxText(it.fx, mult) + '.');
  };

  /* =====================================================================
     2. GROWTH ENGINE — channels, GTM motion, funnel, sales capacity
     ===================================================================== */
  var CH = {
    google: { name: 'Google Search', kind: 'paid', cpl: 0.6, cap: 4, qual: 1.0, desc: 'High intent. Gets expensive beyond ~₹4L a month.' },
    linkedin: { name: 'LinkedIn Ads', kind: 'paid', cpl: 0.9, cap: 5, qual: 1.25, desc: 'Reaches fleet heads. Best for mid-market.' },
    meta: { name: 'Meta Ads', kind: 'paid', cpl: 0.35, cap: 5, qual: 0.5, desc: 'Cheap leads, mostly small owners. Low quality.' },
    events: { name: 'Events and trade shows', kind: 'field', cpl: 1.1, cap: 8, qual: 1.45, desc: 'Lumpy and relationship-driven. Good for larger accounts.' },
    outbound: { name: 'Outbound agency', kind: 'outbound', cpl: 0.75, cap: 6, qual: 0.9, desc: 'Cold email and calls. Steady, middling quality.' },
    content: { name: 'Content and SEO', kind: 'asset', qual: 0.95, desc: 'Builds an asset slowly. Cheap leads after 4–6 months.' },
    referral: { name: 'Referral rewards', kind: 'referral', qual: 1.5, desc: 'Pays customers for intros. Scales with customers and fit.' }
  };
  var CH_ORDER = ['google', 'linkedin', 'meta', 'events', 'outbound', 'content', 'referral'];
  FS.CH = CH; FS.CH_ORDER = CH_ORDER;

  var GTM = {
    founder: { name: 'Founder-led sales', desc: 'You sell personally. +12% win rate and +4 deals of capacity, but it costs 1 Strategy focus every month and does not scale.', win: 1.12 },
    inside: { name: 'Inside sales (SMB)', desc: 'Reps work high-volume SMB demand from marketing. The default motion.', win: 1 },
    plg: { name: 'Product-led growth', desc: 'Free sign-up and self-serve conversion. Leads cost 12% less and many convert without a rep. Needs Self-serve onboarding.', win: 0.96, req: 'selfserve' },
    partner: { name: 'Partner-led', desc: 'Partners and associations bring the demand: partner leads ×1.6. Needs a live distribution partner.', win: 1, req: 'partner' },
    enterprise: { name: 'Enterprise-led', desc: 'AEs chase mid-market and enterprise: twice the mid-market pull, more enterprise wins; SMB lead quality −20%. Needs SSO and a Head of Sales.', win: 1.05, req: 'enterprise' }
  };
  FS.GTM = GTM;
  FS.gtmReady = function (s, id) {
    var g = GTM[id];
    if (g.req === 'selfserve') return has(s, 'selfserve') ? '' : 'Ship Self-serve onboarding first.';
    if (g.req === 'partner') return liveParts(s).some(function (p) { return PARTMAP[p.id].type === 'Distribution'; }) ? '' : 'Needs a live distribution partner.';
    if (g.req === 'enterprise') return has(s, 'sso') && cnt(s, 'hos') ? '' : 'Needs SSO shipped and a Head of Sales.';
    return '';
  };

  function syncMkt(s) { s.marketing = CH_ORDER.reduce(function (a, c) { return a + (s.channels[c] || 0); }, 0); }

  function partnerLeads(s) {
    var mgr = 1 + 0.25 * Math.min(2, eff(s, 'partner')), L = 0, ent = 0, parts = [];
    liveParts(s).forEach(function (p) {
      var T = PARTMAP[p.id], b = T.benefit, ex = p.terms.excl && p.terms.excl.val ? 1.2 : 1;
      var l = (b.leads || 0) * mgr * ex * (s.gtm === 'partner' ? 1.6 : 1);
      L += l; ent += (b.ent || 0) * ex; parts.push([p.id, l]);
    });
    if (s.flags.reseller > s.month) { L += 3.5; parts.push(['reseller', 3.5]); }
    return { leads: L, ent: ent, parts: parts };
  }

  FS.acq = function (s) {
    var G = GTM[s.gtm] || GTM.inside, P = s.product;
    var perf = Math.min(0.3, 0.12 * eff(s, 'perf')), mk = Math.min(0.3, 0.12 * eff(s, 'mkt')), pmm = Math.min(0.2, 0.07 * eff(s, 'pmm'));
    var cplMult = s.mods.cac * (1 + tempSum(s, 'cac')) * (s.gtm === 'plg' ? 0.88 : 1);
    var custN = 0; for (var k in s.segments) custN += s.segments[k].cust;
    var rows = [], totL = 0, totO = 0;
    CH_ORDER.forEach(function (c) {
      var C = CH[c], sp = s.channels[c] || 0, L = 0;
      if (C.kind === 'paid' || C.kind === 'field' || C.kind === 'outbound') {
        var cpl = C.cpl * cplMult * (1 + tempSum(s, 'cpl_' + c)) / (s.chEff[c] * s.chFat[c] * (C.kind === 'paid' ? 1 + perf : 1) * (C.kind === 'field' ? 1 + mk : 1));
        L = sp / cpl; if (sp > C.cap) L = L * C.cap * (1 + Math.log(sp / C.cap)) / sp;
        if (c === 'events') L *= s.evLuck || 1;
        if (c === 'google' && s.flags.adBanUntil > s.month) L = 0;
      } else if (c === 'content') L = s.seo * 0.2 * (1 + mk) * s.chEff.content;
      else if (c === 'referral') L = custN * P.pmf * 0.008 * (sp > 0 ? 1 + 1.4 * Math.sqrt(sp) : 0.4) * (1 + mk) * (s.mods.ref || 1);
      if (c === 'outbound') L += 3 * eff(s, 'sdr');
      var q = s.funnel.qual * C.qual * (s.gtm === 'enterprise' && (c === 'google' || c === 'meta' || c === 'content') ? 0.8 : 1) * (1 + pmm * 0.5);
      q = clamp(q, 0.05, 0.95);
      rows.push({ id: c, name: C.name, spend: sp, leads: L, qual: q, opps: L * q }); totL += L; totO += L * q;
    });
    var PL = partnerLeads(s);
    var pq = clamp(s.funnel.qual * 1.0, 0.05, 0.95);
    rows.push({ id: 'partners', name: 'Partners', spend: 0, leads: PL.leads, qual: pq, opps: PL.leads * pq });
    var orgL = 3 * P.pmf * s.mods.organic + tempSum(s, 'leads');
    var oq = clamp(s.funnel.qual * 1.4, 0.05, 0.95);
    rows.push({ id: 'organic', name: 'Word of mouth and inbound', spend: 0, leads: orgL, qual: oq, opps: orgL * oq });
    totL += PL.leads + orgL; totO += PL.leads * pq + orgL * oq;
    var seCap = 6.5 * eff(s, 'se'), aeCap = 4.5 * eff(s, 'ae');
    var hos = s.people.filter(function (p) { return p.role === 'hos'; })[0];
    var cap = (seCap + aeCap) * (hos ? 1 + 0.3 * hos.skill * rampF(hos) : 1) * s.mods.sales + (s.gtm === 'founder' ? 4 : 0);
    var aeShare = seCap + aeCap > 0 ? aeCap / (seCap + aeCap) : 0;
    var selfShare = s.gtm === 'plg' ? (has(s, 'selfserve') ? 0.55 : 0.25) + (has(s, 'trial') ? 0.1 : 0) : (has(s, 'selfserve') ? 0.12 : 0);
    var selfO = totO * selfShare, salesO = totO - selfO, worked = Math.min(salesO, cap);
    var pmfF = 0.7 + 0.55 * P.pmf, compF = 1 / (1 + tempSum(s, 'comp')), priceF = Math.pow(1 / s.price, 0.9), wt = 1 + tempSum(s, 'win');
    var win = clamp(s.funnel.win * pmfF * compF * priceF * G.win * (1 + pmm) * (1 + 0.15 * aeShare) * wt, 0.05, 0.58);
    var act = clamp(s.funnel.act + 0.03 * Math.min(2, eff(s, 'designer')), 0.05, 0.9);
    var selfWin = clamp(act * pmfF * priceF * compF * 0.9 * wt, 0.03, 0.85);
    var customers = worked * win + selfO * selfWin;
    return { rows: rows, leads: totL, opps: totO, cap: cap, salesOpps: salesO, selfOpps: selfO, worked: worked, win: win, selfWin: selfWin, act: act, customers: customers, aeShare: aeShare, entPartner: PL.ent, partnerSplit: PL.parts, bottleneck: salesO > cap * 1.02 ? 'sales' : 'demand', spend: s.marketing };
  };

  FS.salesInfo = function (s) {
    var A = FS.acq(s);
    return { cap: A.cap, leads: A.salesOpps, opps: A.opps, paid: A.worked, cac: HK.cac(s), bottleneck: A.bottleneck === 'sales' ? 'sales' : 'marketing', A: A };
  };
  HK.cac = function (s) {
    if (s.lastCac) return s.lastCac;
    var A = FS.acq(s); return s.marketing / Math.max(0.5, A.customers);
  };

  function avgSmbArpa(s) {
    var n = 0, t = 0; ['blr', 'mum', 'pune', 'del', 'sea'].forEach(function (k) { var g = s.segments[k]; if (g.unlocked) { n += 1; t += g.arpa; } });
    return (n ? t / n : 0.16) * s.price;
  }

  HK.acquire = function (s, rep) {
    if (s.gtm === 'founder') {
      if (s.focus.str >= 1) s.focus.str -= 1;
      else { s.gtm = 'inside'; rep.notes.push('Founder-led sales lapsed: no Strategy focus was left. You are back to inside sales.'); }
    }
    var A = FS.acq(s), G = GTM[s.gtm] || GTM.inside;
    var n = sround(s, A.customers);
    var segs = Object.keys(s.segments).filter(function (k) { return s.segments[k].unlocked && k !== 'ent'; });
    var wsum = 0, ws = {};
    segs.forEach(function (k) {
      var g = s.segments[k], left = Math.max(0, g.tam - g.cust), conv = Math.pow(Math.max(0, 1 - g.cust / (g.tam * 0.55)), 1.5);
      var w = left * conv * (k === 'del' ? 0.45 * (0.3 + 1.4 * A.aeShare) * (s.gtm === 'enterprise' ? 2 : 1) : k === 'sea' ? 0.8 : 1);
      ws[k] = w; wsum += w;
    });
    var added = 0, newMrr = 0;
    segs.forEach(function (k) {
      if (wsum <= 0) return;
      var g = s.segments[k], x = Math.min(sround(s, n * ws[k] / wsum), g.tam - g.cust);
      g.cust += x; added += x; newMrr += x * g.arpa * s.price;
    });
    var hos = s.people.filter(function (p) { return p.role === 'hos'; })[0];
    if (s.segments.ent.unlocked && hos) {
      var en = sround(s, (0.3 * hos.skill * rampF(hos) + A.entPartner) * (s.gtm === 'enterprise' ? 1.6 : 1) * (opsDone(s, 'soc2') ? 1.3 : 1));
      en = Math.min(en, s.segments.ent.tam - s.segments.ent.cust);
      s.segments.ent.cust += en; added += en; newMrr += en * s.segments.ent.arpa * s.price;
    }
    // channel attribution
    var arpaNew = added ? newMrr / added : avgSmbArpa(s);
    s.chStats = {}; s.chCum = s.chCum || {};
    A.rows.forEach(function (r) {
      var c = A.opps > 0 ? added * r.opps / A.opps : 0;
      s.chStats[r.id] = { leads: r.leads, opps: r.opps, cust: c, mrr: c * arpaNew, spend: r.spend };
      var cu = s.chCum[r.id] || (s.chCum[r.id] = { spend: 0, cust: 0, mrr: 0 });
      cu.spend += r.spend; cu.cust += c; cu.mrr += c * arpaNew;
      if (r.id === 'partners' && r.leads > 0) A.partnerSplit.forEach(function (ps) {
        var p = s.partners.active.filter(function (x) { return x.id === ps[0]; })[0]; if (!p) return;
        var share = c * ps[1] / r.leads; p.cust += share; p.mrr += share * arpaNew;
      });
    });
    // channel state
    s.seo = s.seo * 0.95 + (s.channels.content || 0) * 0.9;
    var perf = cnt(s, 'perf') > 0;
    CH_ORDER.forEach(function (c) { if (CH[c].kind === 'paid' && s.channels[c] > 0) s.chFat[c] = Math.max(0.7, s.chFat[c] * (1 - (perf ? 0.01 : 0.02))); });
    s.evLuck = 0.5 + rng(s);
    s.lastAcq = { leads: A.leads, opps: A.opps, worked: A.worked, selfOpps: A.selfOpps, cap: A.cap, win: A.win, selfWin: A.selfWin, cust: added, spend: s.marketing };
    s.lastCac = added > 0 ? s.marketing / added : s.marketing / 0.5;
    rep.newMrr = newMrr; rep.leads = A.leads; rep.opps = A.opps;
    return added;
  };

  ACT.setChannel = function (s, p) {
    if (!CH[p.ch]) return { ok: false };
    s.channels[p.ch] = clamp(Math.round(Number(p.value) * 2) / 2, 0, 30); syncMkt(s);
    return { ok: true };
  };
  ACT.refreshCreative = function (s, p) {
    if (!CH[p.ch] || CH[p.ch].kind !== 'paid') return { ok: false };
    var err = spend(s, { ops: 1, cash: 1, cat: 'Launches & campaigns' }); if (err) return { ok: false, msg: err };
    var was = s.chFat[p.ch]; s.chFat[p.ch] = 1;
    log(s, 'Growth', 'Ad creative', 'Refreshed ' + CH[p.ch].name + ' creatives', was < 0.85 ? 78 : 40, was < 0.85 ? 'Fatigue had pushed lead costs up; a refresh paid for itself.' : 'Creatives were still fresh; the refresh was early.');
    return { ok: true, msg: CH[p.ch].name + ' creatives refreshed. Lead costs reset.' };
  };
  ACT.setGtm = function (s, p) {
    var g = GTM[p.id]; if (!g || s.gtm === p.id) return { ok: false };
    var why = FS.gtmReady(s, p.id); if (why) return { ok: false, msg: why };
    var err = spend(s, { str: 2 }); if (err) return { ok: false, msg: err };
    var m = FS.metrics(s), q = 60, w = 'A reasonable change of motion.';
    if (p.id === 'founder') { q = s.month <= 8 || m.customers < 60 ? 72 : 38; w = q > 60 ? 'Founder selling works early, when every deal teaches you something.' : 'Founder-led sales does not scale and eats your strategy time.'; }
    if (p.id === 'plg') { q = s.product.pmf >= 0.55 && has(s, 'trial') ? 82 : s.product.pmf >= 0.55 ? 70 : 42; w = q >= 70 ? 'Self-serve demand with decent fit makes product-led growth efficient.' : 'Product-led growth needs strong fit and activation first.'; }
    if (p.id === 'enterprise') { q = opsDone(s, 'soc2') ? 82 : 58; w = q > 70 ? 'Enterprise-ready on security and sales leadership; the motion fits.' : 'Enterprise buyers will ask for SOC 2 you do not yet have.'; }
    if (p.id === 'partner') { q = liveParts(s).length >= 2 ? 75 : 50; w = q > 70 ? 'Several live partners justified a partner-led motion.' : 'One partner is a thin base for a whole go-to-market motion.'; }
    if (p.id === 'inside') { q = 65; w = 'Inside sales is a solid default for SMB SaaS.'; }
    s.gtm = p.id; s.gtmAt = s.month; addTemp(s, 'win', -0.06, 2);
    log(s, 'Growth', 'GTM strategy', 'Switched to ' + g.name, q, w);
    news(s, 'You switched your go-to-market motion to ' + g.name.toLowerCase() + '.');
    return { ok: true, msg: 'Now running ' + g.name + '. Expect a dip in win rate for two months while the team adjusts.' };
  };

  /* ---------- A/B experiments ---------- */
  var EXPS = {
    headline: { name: 'Landing-page headline test', stage: 'qual', mu: 0.02, sd: 0.03, eng: 0, unit: 'pp lead quality' },
    pricingpage: { name: 'Pricing-page anchoring', stage: 'win', mu: 0.01, sd: 0.03, eng: 2, unit: 'pp win rate' },
    onboarding: { name: 'Onboarding checklist', stage: 'act', mu: 0.03, sd: 0.04, eng: 3, unit: 'pp activation' },
    demo: { name: 'Demo script and deck', stage: 'win', mu: 0.015, sd: 0.025, eng: 0, unit: 'pp win rate' },
    emails: { name: 'Activation email sequence', stage: 'act', mu: 0.02, sd: 0.03, eng: 1, unit: 'pp activation' },
    annual: { name: 'Annual-plan discount offer', stage: 'churn', mu: 0.0015, sd: 0.002, eng: 1, unit: 'pp lower churn' },
    creative: { name: 'Ad creative test', stage: 'cpl', mu: 0.06, sd: 0.08, eng: 0, unit: '% cheaper paid leads' },
    triallen: { name: 'Trial length: 14 vs 30 days', stage: 'act', mu: 0.01, sd: 0.04, eng: 1, unit: 'pp activation', req: 'trial' },
    referralamt: { name: 'Referral reward size', stage: 'ref', mu: 0.1, sd: 0.15, eng: 0, unit: '% more referrals' }
  };
  FS.EXPS = EXPS;
  FS.expSlots = function (s) { return 1 + Math.min(1, cnt(s, 'pm')) + Math.min(1, cnt(s, 'data')); };
  ACT.runExp = function (s, p) {
    var E = EXPS[p.id]; if (!E) return { ok: false };
    if (E.req && !has(s, E.req)) return { ok: false, msg: 'Needs ' + FS.item(s, E.req).name + ' shipped.' };
    if (s.exp.active.length >= FS.expSlots(s)) return { ok: false, msg: 'All experiment slots are busy. A PM or data analyst adds a slot.' };
    if (s.exp.last[p.id] && s.exp.last[p.id] > s.month - 4) return { ok: false, msg: 'You ran this recently. Try again in month ' + (s.exp.last[p.id] + 4) + '.' };
    if (s.exp.ready.some(function (r) { return r.id === p.id; })) return { ok: false, msg: 'Decide on the last result first.' };
    var err = spend(s, { ops: 1 }); if (err) return { ok: false, msg: err };
    if (E.eng) tax(s, E.eng);
    s.exp.active.push({ id: p.id, m: s.month }); s.exp.last[p.id] = s.month;
    return { ok: true, msg: E.name + ' is live. Results arrive in the month report.' };
  };
  function resolveExps(s, rep) {
    var leads = (s.lastAcq && s.lastAcq.leads) || 10, da = cnt(s, 'data') > 0;
    s.exp.active.forEach(function (x) {
      var E = EXPS[x.id];
      var tru = E.mu + E.sd * gauss(s);
      var sdo = E.sd * 1.3 * Math.sqrt(12 / Math.max(3, leads)) * (da ? 0.7 : 1);
      var obs = tru + sdo * gauss(s);
      var z = obs / sdo, sig = Math.abs(z) >= 1.96;
      var r = { id: x.id, m: s.month, tru: tru, obs: obs, z: z, sig: sig, n: Math.round(leads * 10) };
      s.exp.ready.push(r);
      rep.notes.push('Experiment result, ' + E.name + ': ' + fmtLift(E, obs) + (sig ? ' (statistically significant).' : ' (not significant; ' + r.n + ' visitors).'));
    });
    s.exp.active = [];
  }
  function fmtLift(E, g) {
    var v = E.stage === 'churn' ? g * 100 : E.stage === 'cpl' || E.stage === 'ref' ? g * 100 : g * 100;
    return (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(E.stage === 'churn' ? 2 : 1) + (E.stage === 'cpl' || E.stage === 'ref' ? '%' : 'pp') + ' ' + E.unit.replace(/^(pp|%) /, '');
  }
  FS.fmtLift = fmtLift;
  ACT.expDecide = function (s, p) {
    var i = s.exp.ready.findIndex(function (r) { return r.id === p.id; }); if (i < 0) return { ok: false };
    var r = s.exp.ready[i], E = EXPS[r.id];
    s.exp.ready.splice(i, 1); s.exp.history.unshift({ id: r.id, m: s.month, obs: r.obs, sig: r.sig, shipped: !!p.ship, tru: r.tru });
    if (p.ship) {
      var g = r.tru;
      if (E.stage === 'qual') s.funnel.qual = clamp(s.funnel.qual + g, 0.2, 0.85);
      if (E.stage === 'win') s.funnel.win = clamp(s.funnel.win + g, 0.2, 0.85);
      if (E.stage === 'act') s.funnel.act = clamp(s.funnel.act + g, 0.2, 0.85);
      if (E.stage === 'churn') s.mods.churn -= g;
      if (E.stage === 'cpl') s.mods.cac *= 1 - g;
      if (E.stage === 'ref') s.mods.ref = (s.mods.ref || 1) * (1 + g);
    }
    var q, w;
    if (p.ship) { q = r.sig && r.obs > 0 ? 85 : r.obs > 0 ? 38 : 12; w = r.sig && r.obs > 0 ? 'Shipped a statistically significant win.' : r.obs > 0 ? 'Shipped an inconclusive result; with this little traffic, the "lift" may be noise.' : 'Shipped a variant that tested worse.'; }
    else { q = r.sig && r.obs > 0 ? 30 : 75; w = r.sig && r.obs > 0 ? 'Discarded a clear, significant win.' : 'Rightly declined to ship an unproven change.'; }
    log(s, 'Product', 'Experiment', (p.ship ? 'Shipped: ' : 'Discarded: ') + E.name, q, w);
    return { ok: true, msg: p.ship ? 'Variant shipped to everyone.' : 'Experiment closed. Control stays.' };
  };

  /* ---------- launches ---------- */
  var LAUNCH = [{ name: 'Blog post and customer email', cost: { str: 1, cash: 1 }, leads: 1 }, { name: 'PR, webinar and partner push', cost: { str: 1, cash: 4 }, leads: 3 }, { name: 'Launch event and paid campaign', cost: { str: 1, ops: 1, cash: 10 }, leads: 7 }];
  FS.LAUNCH = LAUNCH;
  FS.launchable = function (s) {
    return s.product.shipped.filter(function (id) { var it = FS.item(s, id); return it && !it.custom && !it.partner && !it.launched && s.product.shippedAt[id] >= s.month - 3; });
  };
  ACT.launch = function (s, p) {
    var it = FS.item(s, p.id), T = LAUNCH[p.tier | 0];
    if (!it || it.launched || FS.launchable(s).indexOf(p.id) < 0) return { ok: false, msg: 'Only features shipped in the last three months can be launched.' };
    var c = {}; for (var k in T.cost) c[k] = T.cost[k]; c.cat = 'Launches & campaigns';
    var err = spend(s, c); if (err) return { ok: false, msg: err };
    it.launched = true;
    var boost = T.leads * (1 + 0.5 * Math.min(2, eff(s, 'pmm'))) * (0.6 + 0.4 * Math.min(1.6, it.realised || it.real));
    addTemp(s, 'leads', boost, 2);
    if (p.tier === 2) s.mods.organic += 0.05;
    var major = it.effort >= 18, m = FS.metrics(s);
    var q = major ? (p.tier >= 1 ? 80 : 55) : (p.tier === 0 ? 72 : p.tier === 1 ? 55 : 32);
    if (m.runway < 6 && p.tier === 2) q -= 20;
    log(s, 'Growth', 'Launch', T.name + ' for ' + it.name, q, major ? (p.tier >= 1 ? 'A major feature deserved a real launch.' : 'A major feature went out with little noise.') : (p.tier === 2 ? 'A big launch for a small feature wasted budget.' : 'A launch sized to the feature.'));
    news(s, 'You launched ' + it.name + '.');
    return { ok: true, msg: 'Launch booked: about ' + Math.round(boost) + ' extra leads a month for two months.' };
  };

  /* =====================================================================
     3. OPERATIONS — initiatives, support, receivables
     ===================================================================== */
  var OPS = {
    mis: { name: 'Monthly close and MIS pack', cost: { ops: 1, cash: 1.5 }, months: 1, what: 'Board confidence +4 now and a steady upward drift; fewer costly finance mistakes.' },
    collections: { name: 'Collections drive and auto-reminders', cost: { ops: 1, cash: 0.5 }, months: 1, what: 'Days sales outstanding −12, releasing cash tied up in receivables.' },
    saasaudit: { name: 'SaaS tools audit', cost: { ops: 1 }, months: 1, what: 'Tools spend −₹0.5L a month.' },
    cloudcommit: { name: 'Negotiate a cloud commitment', cost: { ops: 1, str: 1 }, months: 1, what: 'Infrastructure −18% in exchange for a two-year commitment.' },
    compliance: { name: 'Payroll and GST compliance automation', cost: { ops: 1, cash: 2 }, months: 2, what: 'Compliance surprises become rare.' },
    helpdesk: { name: 'Helpdesk and SLA process', cost: { ops: 2, cash: 1 }, months: 1, what: 'Support capacity +25%; churn −0.1pp.' },
    oncall: { name: 'On-call rotation and incident runbooks', cost: { ops: 1 }, eng: 4, months: 1, what: 'Outages and bad releases −35%. Uses 4 engineering weeks.' },
    hiring: { name: 'Structured hiring process', cost: { ops: 1, ppl: 1 }, months: 1, what: 'Recruiter fees −30%; candidates slightly stronger.' },
    dataroom: { name: 'Investor data room', cost: { ops: 1, str: 1 }, months: 1, what: 'Investor interest up; diligence goes faster.' },
    insurance: { name: 'Cyber and D&O insurance', cost: { ops: 1 }, months: 1, what: 'Costs ₹0.4L a month; cuts the cash cost of most crises by 60%.' },
    okrs: { name: 'Quarterly OKRs and weekly business review', cost: { ops: 1, str: 1 }, months: 1, what: 'Productivity +4%; morale +2.' },
    soc2: { name: 'SOC 2 Type I audit', cost: { ops: 2, cash: 12 }, months: 4, what: 'Security +30 and +30% enterprise wins; some deals require it. Two months with a Security Engineer.' },
    vendorterms: { name: 'Renegotiate vendor payment terms', cost: { ops: 1 }, months: 1, what: 'A one-off cash release of about ₹6L.' },
    dpdp: { name: 'DPDP Act privacy programme', cost: { ops: 1, cash: 3 }, months: 2, what: 'Defuses privacy complaints; security +10.' }
  };
  FS.OPS = OPS;
  ACT.startOps = function (s, p) {
    var O = OPS[p.id]; if (!O) return { ok: false };
    if (s.ops.done[p.id] || s.ops.active[p.id]) return { ok: false, msg: 'Already done or under way.' };
    var c = {}; for (var k in O.cost) c[k] = O.cost[k]; c.cat = ['compliance', 'soc2', 'dpdp', 'insurance'].indexOf(p.id) >= 0 ? 'Legal & compliance' : 'Operations projects';
    var err = spend(s, c); if (err) return { ok: false, msg: err };
    if (O.eng) tax(s, O.eng);
    var months = p.id === 'soc2' && cnt(s, 'sec') ? 2 : O.months;
    s.ops.active[p.id] = s.month + months;
    var m = FS.metrics(s), sup = FS.support(s), q = 65, w = 'A sensible operational investment.';
    var Q = {
      mis: [75, 'A clean monthly close is how boards learn to trust a founder.'],
      collections: [m.mrr > 12 ? 80 : 60, 'Cash stuck in receivables is runway you have already earned.'],
      saasaudit: [80, 'Cheap, fast savings.'],
      cloudcommit: [m.runway > 12 ? 75 : 58, m.runway > 12 ? 'A commitment you could carry, for a lasting discount.' : 'A two-year commitment with little runway limits options.'],
      compliance: [75, 'Small cost to remove a recurring legal risk.'],
      helpdesk: [sup.sla < 0.92 ? 85 : 55, sup.sla < 0.92 ? 'Support was overloaded; this fixed a real churn driver.' : 'Support was coping; useful but early.'],
      oncall: [s.product.debt > 45 || m.customers > 80 ? 82 : 60, 'Incidents cost trust; runbooks cut their cost.'],
      hiring: [65, 'A repeatable hiring process pays off over many hires.'],
      dataroom: [s.fund.status === 'active' || m.runway < 12 ? 85 : 55, 'Preparing diligence before a raise speeds it up.'],
      insurance: [62, 'Insurance trades a small certain cost for protection against big shocks.'],
      okrs: [70, 'Shared goals focus a growing team.'],
      soc2: [s.segments.ent.unlocked || s.deals.active.length ? 85 : s.month < 10 ? 40 : 65, s.segments.ent.unlocked || s.deals.active.length ? 'Enterprise buyers require it; the timing was right.' : 'Expensive before you sell to enterprises.'],
      vendorterms: [m.runway < 6 ? 75 : 45, m.runway < 6 ? 'Working-capital levers are right when runway is short.' : 'Squeezing vendors without need costs goodwill.'],
      dpdp: [70, 'Privacy compliance is now a legal duty in India.']
    }[p.id];
    if (Q) { q = Q[0]; w = Q[1]; }
    log(s, 'Operations', 'Operations', 'Started: ' + O.name, q, w);
    return { ok: true, msg: O.name + ' started. Done in ' + months + (months > 1 ? ' months.' : ' month.') };
  };
  function finishOps(s, id, rep) {
    var m = FS.metrics(s);
    s.ops.done[id] = s.month; delete s.ops.active[id];
    if (id === 'mis') s.board = Math.min(95, s.board + 4);
    if (id === 'collections') s.dso = Math.max(20, s.dso - 12);
    if (id === 'saasaudit') s.tools = Math.max(0.6, s.tools - 0.5);
    if (id === 'cloudcommit') s.mods.infra *= 0.82;
    if (id === 'helpdesk') s.mods.churn -= 0.001;
    if (id === 'oncall') s.mods.incident *= 0.65;
    if (id === 'okrs') { addTemp(s, 'prod', 0.04, 99); addTemp(s, 'teamMorale', 2, 99); }
    if (id === 'soc2') s.sec = clamp(s.sec + 30, 0, 100);
    if (id === 'dpdp') s.sec = clamp(s.sec + 10, 0, 100);
    if (id === 'vendorterms') book(s, 'Working capital (payables)', 6);
    s.flags[id] = true;
    rep.notes.push('Operations: ' + OPS[id].name + ' is complete.');
  }
  FS.secScore = function (s) { return clamp(s.sec + 20 * Math.min(2, eff(s, 'sec')), 0, 100); };
  FS.support = function (s) {
    var cust = 0; for (var k in s.segments) cust += s.segments[k].cust;
    var entN = s.segments.ent.cust + s.keys.filter(function (x) { return x.active && x.ent; }).length;
    var tickets = cust * 1.1 + entN * 6 + s.keys.filter(function (x) { return x.active; }).length * 2;
    var cap = (90 * eff(s, 'csm') + 220 * eff(s, 'support') + 30 * eff(s, 'solutions')) * (s.flags.helpdesk ? 1.25 : 1);
    return { tickets: tickets, cap: cap, sla: tickets > 0 ? Math.min(1, cap / tickets) : 1 };
  };
  HK.supportChurn = function (s) { var sp = FS.support(s); s.lastSla = sp.sla; return sp.sla < 0.9 ? (0.9 - sp.sla) * 0.025 : 0; };
  FS.dso = function (s) { return Math.max(15, s.dso - 6 * Math.min(1, eff(s, 'fin')) + (s.deals.live.some(function (d) { return d.slowPay; }) ? 6 : 0)); };
  HK.feeMult = function (s) { return (cnt(s, 'recruiter') ? 0.5 : 1) * (s.flags.hiring ? 0.7 : 1); };
  HK.candBonus = function (s) { return (s.flags.hiring ? 0.04 : 0) + (cnt(s, 'recruiter') ? 0.04 : 0); };

  /* =====================================================================
     4. PARTNERS — proposals with negotiable terms
     ===================================================================== */
  var PARTNERS = [
    { id: 'nimbus', name: 'Nimbus Cloud', cat: 'cloud', type: 'Technology', min: 4, effort: 8, pitch: 'A cloud provider offers startup credits if you migrate and standardise on its platform.', benefit: { credits: true }, terms: [{ k: 'credits', label: 'Cloud credits', val: 30, step: 10, lim: 60, unit: '₹L', up: true }, { k: 'excl', label: 'Single-cloud commitment for two years', val: 1, bool: true }] },
    { id: 'ledgerbook', name: 'LedgerBook', cat: 'accounting', type: 'Distribution', min: 5, effort: 10, pitch: 'Accounting software used by 1.2 million Indian SMBs wants to list you in its marketplace and co-sell to transport businesses.', benefit: { leads: 2 }, terms: [{ k: 'share', label: 'Revenue share on referred customers', val: 20, step: 5, lim: 10, unit: '%' }, { k: 'excl', label: 'You list in no other accounting marketplace', val: 1, bool: true }] },
    { id: 'mapwise', name: 'Mapwise', cat: 'maps', type: 'Technology', min: 5, effort: 6, pitch: 'A maps API vendor offers truck-specific routing data that would sharpen your ETAs.', benefit: { pmf: 0.025, churn: -0.001 }, terms: [{ k: 'price', label: 'Uplift on your infrastructure bill', val: 12, step: 4, lim: 4, unit: '%' }, { k: 'commit', label: 'Minimum contract term', val: 24, step: 6, lim: 12, unit: ' months' }] },
    { id: 'trackpoint', name: 'TrackPoint Telematics', cat: 'telematics', type: 'Technology', min: 7, effort: 12, pitch: 'India\'s second-largest GPS-device maker wants a native integration and a co-selling deal.', benefit: { pmf: 0.03, churn: -0.0015, leads: 1 }, terms: [{ k: 'share', label: 'Referral fee you pay on their leads', val: 15, step: 5, lim: 5, unit: '%' }, { k: 'fee', label: 'Joint marketing contribution', val: 6, step: 2, lim: 0, unit: '₹L' }] },
    { id: 'bfa', name: 'Bharat Freight Association', cat: 'association', type: 'Distribution', min: 8, effort: 0, pitch: 'An association of 4,000 fleet owners will endorse one fleet tool to its members.', benefit: { leads: 2.5 }, terms: [{ k: 'discount', label: 'Discount for members', val: 20, step: 5, lim: 5, unit: '%' }, { k: 'fee', label: 'Annual sponsorship', val: 8, step: 2, lim: 2, unit: '₹L' }] },
    { id: 'cloudmart', name: 'CloudMart Marketplace', cat: 'marketplace', type: 'Distribution', min: 9, effort: 6, req: 'api', pitch: 'A cloud marketplace offers a listing with co-sell support from its field team.', benefit: { leads: 1.2 }, terms: [{ k: 'share', label: 'Marketplace fee', val: 12, step: 2, lim: 6, unit: '%' }] },
    { id: 'payrail', name: 'PayRail', cat: 'payments', type: 'Technology', min: 10, effort: 12, pitch: 'A payments company wants to embed freight payments in your product and share the fees.', benefit: { expansion: 0.003, pay: true }, terms: [{ k: 'take', label: 'Your share of payment fees', val: 20, step: 10, lim: 50, unit: '%', up: true }, { k: 'excl', label: 'Exclusive payments partner', val: 1, bool: true }] },
    { id: 'kestrel', name: 'Kestrel Consulting', cat: 'si', type: 'Distribution', min: 12, effort: 4, req: 'sso', pitch: 'A supply-chain consultancy will recommend you in its enterprise transformation projects.', benefit: { ent: 0.35 }, terms: [{ k: 'share', label: 'Referral fee on enterprise revenue', val: 20, step: 5, lim: 10, unit: '%' }, { k: 'fee', label: 'Partner certification and training', val: 5, step: 1, lim: 2, unit: '₹L' }] },
    { id: 'ashwa', name: 'Ashwa Motors', cat: 'oem', type: 'Distribution', min: 15, effort: 20, req: 'sso', pitch: 'A truck maker wants to bundle your software with every new truck it sells.', benefit: { leads: 3.5, ent: 0.2 }, terms: [{ k: 'share', label: 'Revenue share on bundled customers', val: 30, step: 5, lim: 15, unit: '%' }, { k: 'excl', label: 'No other truck maker partnerships', val: 1, bool: true }] }
  ];
  var PARTMAP = {}; PARTNERS.forEach(function (p) { PARTMAP[p.id] = p; });
  FS.PARTNERS = PARTMAP;

  function copyTerms(T) { var o = {}; T.terms.forEach(function (t) { o[t.k] = { k: t.k, label: t.label, val: t.val, step: t.step, lim: t.lim, unit: t.unit, up: !!t.up, bool: !!t.bool, start: t.val }; }); return o; }
  FS.leverage = function (s) {
    var m = FS.metrics(s);
    return clamp(0.3 * s.product.pmf + Math.min(0.25, m.arr / 1600) + 0.1 * Math.min(2, eff(s, 'partner')) + 0.05 * liveParts(s).length + (s.fund.raised ? 0.05 : 0), 0, 0.8);
  };
  function exclBlocked(s, T) { return s.partners.active.some(function (p) { return PARTMAP[p.id].cat === T.cat && p.terms.excl && p.terms.excl.val; }); }

  function partnerOffers(s, rep) {
    var PS = s.partners;
    PS.offers = PS.offers.filter(function (o) { if (o.expires < s.month) { news(s, PARTMAP[o.id].name + '\'s proposal lapsed.'); PS.closed[o.id] = 'lapsed'; return false; } return true; });
    if (PS.offers.length || s.month < 4 || rng(s) > 0.15) return;
    var el = PARTNERS.filter(function (T) { return T.min <= s.month && !PS.closed[T.id] && !PS.active.some(function (p) { return p.id === T.id; }) && (!T.req || has(s, T.req)) && !exclBlocked(s, T); });
    if (!el.length) return;
    var T = el[Math.floor(rng(s) * el.length)];
    PS.offers.push({ id: T.id, terms: copyTerms(T), counters: 0, expires: s.month + 2, at: s.month, log: [] });
    rep.notes.push('Partner proposal from ' + T.name + '. Review it in Partners & Deals.');
    news(s, T.name + ' sent a partnership proposal.');
  }
  function findOffer(s, id) { return s.partners.offers.filter(function (o) { return o.id === id; })[0]; }
  ACT.pNegotiate = function (s, p) {
    var o = findOffer(s, p.id); if (!o) return { ok: false };
    var t = o.terms[p.k]; if (!t) return { ok: false };
    if (t.bool ? !t.val : (t.up ? t.val >= t.lim : t.val <= t.lim)) return { ok: false, msg: 'They will not move further on that term.' };
    if (o.counters >= 3) return { ok: false, msg: 'They want a yes or no now.' };
    var err = spend(s, { str: 1 }); if (err) return { ok: false, msg: err };
    var T = PARTMAP[o.id], lev = FS.leverage(s);
    var pr = clamp(0.25 + lev * 0.7 - 0.12 * o.counters, 0.1, 0.85);
    o.counters++;
    if (rng(s) < pr) {
      if (t.bool) t.val = 0; else t.val = t.up ? Math.min(t.lim, t.val + t.step) : Math.max(t.lim, t.val - t.step);
      o.log.push('They agreed: ' + t.label.toLowerCase() + ' → ' + termTxt(t) + '.');
      return { ok: true, msg: T.name + ' agreed: ' + t.label + ' now ' + termTxt(t) + '.' };
    }
    if (rng(s) < 0.1 + 0.1 * o.counters) {
      s.partners.offers = s.partners.offers.filter(function (x) { return x !== o; }); s.partners.closed[o.id] = 'walked';
      log(s, 'Partners', 'Negotiation', T.name + ' walked away after ' + o.counters + ' counters', o.counters >= 3 ? 30 : 45, 'Pushing past your leverage cost the deal.');
      news(s, T.name + ' ended partnership talks.');
      return { ok: true, msg: T.name + ' walked away from the table.' };
    }
    o.log.push('They held firm on ' + t.label.toLowerCase() + '.');
    return { ok: true, msg: T.name + ' held firm on ' + t.label.toLowerCase() + '.' };
  };
  function termTxt(t) { return t.bool ? (t.val ? 'Yes' : 'No') : (t.unit === '₹L' ? '₹' + t.val + 'L' : t.val + t.unit); }
  FS.termTxt = termTxt;
  ACT.pAccept = function (s, p) {
    var o = findOffer(s, p.id); if (!o) return { ok: false };
    var T = PARTMAP[o.id], fee = o.terms.fee ? o.terms.fee.val : 0;
    var err = spend(s, { str: 1, cash: fee, cat: 'Partner fees' }); if (err) return { ok: false, msg: err };
    s.partners.offers = s.partners.offers.filter(function (x) { return x !== o; });
    var ap = { id: o.id, terms: o.terms, status: T.effort ? 'integrating' : 'live', since: s.month, cust: 0, mrr: 0, commitUntil: o.terms.commit ? s.month + o.terms.commit.val : 0 };
    s.partners.active.push(ap);
    if (T.effort) {
      var it = { id: 'p_' + T.id, name: 'Integration: ' + T.name, effort: T.effort, cat: 'Partner', fx: {}, why: T.pitch, src: 'Partnership', real: 1, partner: T.id, born: s.month };
      s.product.items[it.id] = it; s.product.queue.push(it.id);
    } else activatePartner(s, T.id);
    var improved = 0; for (var k in o.terms) if (o.terms[k].val !== o.terms[k].start) improved++;
    var m = FS.metrics(s), q = 58 + 10 * improved;
    if (fee && m.runway < 5) q -= 20;
    if (T.cat === 'cloud' && m.infra < 3) q -= 10;
    log(s, 'Partners', 'Partnership', 'Signed with ' + T.name, clamp(q, 0, 95), improved ? 'Negotiated better terms before signing.' : 'Accepted the opening terms; there was usually room to negotiate.');
    news(s, 'You signed a partnership with ' + T.name + '.');
    return { ok: true, msg: 'Signed with ' + T.name + (T.effort ? '. The integration (' + T.effort + ' eng-weeks) is at the back of your roadmap queue.' : '. It is live now.') };
  };
  ACT.pDecline = function (s, p) {
    var o = findOffer(s, p.id); if (!o) return { ok: false };
    s.partners.offers = s.partners.offers.filter(function (x) { return x !== o; }); s.partners.closed[o.id] = 'declined';
    log(s, 'Partners', 'Partnership', 'Declined ' + PARTMAP[o.id].name, 55, 'Declining keeps focus; the channel is forgone.');
    return { ok: true, msg: 'Declined.' };
  };
  ACT.pEnd = function (s, p) {
    var ap = s.partners.active.filter(function (x) { return x.id === p.id; })[0]; if (!ap) return { ok: false };
    var pen = ap.commitUntil > s.month ? 5 : 0;
    var err = spend(s, { ops: 1, cash: pen, cat: 'Partner fees' }); if (err) return { ok: false, msg: err };
    s.partners.active = s.partners.active.filter(function (x) { return x !== ap; }); s.partners.closed[ap.id] = 'ended';
    if (ap.status === 'live') deactivatePartner(s, ap);
    var q = ap.mrr < 0.5 && s.month - ap.since >= 6 ? 75 : 45;
    log(s, 'Partners', 'Partnership', 'Ended the ' + PARTMAP[ap.id].name + ' partnership', q, q > 60 ? 'An underperforming partnership was costing more than it returned.' : 'Ended before it had time to work.');
    return { ok: true, msg: 'Partnership ended' + (pen ? ' (₹5L early-exit penalty).' : '.') };
  };
  function activatePartner(s, id, rep) {
    var ap = s.partners.active.filter(function (x) { return x.id === id; })[0]; if (!ap) return;
    var T = PARTMAP[id], b = T.benefit;
    ap.status = 'live'; ap.liveAt = s.month;
    if (b.pmf) s.product.pmf = clamp(s.product.pmf + b.pmf, 0.2, 0.92);
    if (b.churn) s.mods.churn += b.churn;
    if (b.expansion) s.mods.expansion += b.expansion;
    if (ap.terms.credits) { s.credits += ap.terms.credits.val; }
    if (T.cat === 'cloud') s.product.debt = clamp(s.product.debt + 4, 5, 100);
    if (rep) rep.notes.push(T.name + ' partnership is live.');
    news(s, T.name + ' partnership is live.');
  }
  function deactivatePartner(s, ap) {
    var b = PARTMAP[ap.id].benefit;
    if (b.pmf) s.product.pmf -= b.pmf * 0.5;
    if (b.churn) s.mods.churn -= b.churn;
    if (b.expansion) s.mods.expansion -= b.expansion;
  }
  FS.partnerEcon = function (s, ap) {
    var t = ap.terms, share = (t.share ? t.share.val : 0) + (t.discount ? t.discount.val : 0);
    return { share: share, cost: ap.mrr * share / 100 };
  };

  EV.pSqueeze = {
    sys: true, tag: 'PARTNERS', w: 0, once: false, when: function () { return false; },
    title: function (s) { var ap = squeezeTarget(s); return (ap ? PARTMAP[ap.id].name : 'A partner') + ' wants to renegotiate.'; },
    body: function (s) { var ap = squeezeTarget(s); if (!ap) return 'A partner wants better terms.'; var e = FS.partnerEcon(s, ap); return PARTMAP[ap.id].name + ' says the partnership is not paying off for them and wants an extra 5 points of revenue share. Partner-sourced MRR is ₹' + ap.mrr.toFixed(2) + 'L; you pay them ₹' + e.cost.toFixed(2) + 'L a month today.'; },
    quotes: [],
    choices: [
      { label: 'Agree to +5 points', effect: 'Partnership continues on worse terms.', cost: {}, apply: function (s) { var ap = squeezeTarget(s); if (ap) { if (!ap.terms.share) ap.terms.share = { k: 'share', label: 'Revenue share', val: 0, unit: '%' }; ap.terms.share.val += 5; } }, q: function (s) { var ap = squeezeTarget(s); return ap && ap.mrr > 1.5 ? 65 : 40; }, why: 'Worth it only if the partner drives meaningful revenue.' },
      { label: 'Counter: +2 points with volume targets', effect: '60% chance they accept; otherwise they walk.', cost: { str: 1 }, apply: function (s) { var ap = squeezeTarget(s); if (!ap) return; if (rng(s) < 0.6 + FS.leverage(s) * 0.3) { if (!ap.terms.share) ap.terms.share = { k: 'share', label: 'Revenue share', val: 0, unit: '%' }; ap.terms.share.val += 2; news(s, PARTMAP[ap.id].name + ' accepted a +2 point compromise.'); } else { s.partners.active = s.partners.active.filter(function (x) { return x !== ap; }); deactivatePartner(s, ap); news(s, PARTMAP[ap.id].name + ' ended the partnership.'); } }, q: function () { return 75; }, why: 'A counter tied to performance protected margin with a fair chance of keeping the partner.' },
      { label: 'Refuse and let them go', effect: 'Partner leads stop.', cost: {}, apply: function (s) { var ap = squeezeTarget(s); if (ap) { s.partners.active = s.partners.active.filter(function (x) { return x !== ap; }); deactivatePartner(s, ap); s.partners.closed[ap.id] = 'ended'; } }, q: function (s) { var ap = squeezeTarget(s); return ap && ap.mrr < 1 ? 70 : 40; }, why: 'Walking away made sense only if the partner was not pulling its weight.' }
    ]
  };
  function squeezeTarget(s) { return s.partners.active.filter(function (x) { return x.id === s.flags.squeezeId; })[0]; }

  /* =====================================================================
     5. ENTERPRISE DEAL DESK — customise for large customers
     ===================================================================== */
  var REQ = {
    sso: { name: 'SSO and audit logs', item: 'sso' }, rbac: { name: 'Roles and permissions', item: 'rbac' }, audit: { name: 'Data retention and audit trail', item: 'audit' },
    dataloc: { name: 'India data residency', item: 'dataloc' }, api: { name: 'Public API', item: 'api' },
    sap: { name: 'SAP integration', custom: 18 }, oracle: { name: 'Oracle TMS connector', custom: 16 }, privcloud: { name: 'Private-cloud deployment', custom: 24 },
    whitelabel: { name: 'White-label branding', custom: 10 }, reports: { name: 'Custom compliance reports', custom: 8 },
    customsla: { name: '99.9% uptime SLA with penalties', sla: true }, soc2: { name: 'SOC 2 report', ops: 'soc2' }
  };
  FS.REQ = REQ;
  var DEALS = [
    { id: 'agri', name: 'Krishi Agri Supply', trucks: 600, mrr: 1.6, fee: 5, min: 8, reqs: ['whitelabel', 'reports'], deadline: 4 },
    { id: 'transindia', name: 'TransIndia Logistics', trucks: 1200, mrr: 3.2, fee: 12, min: 9, reqs: ['sso', 'sap', 'reports'], deadline: 5 },
    { id: 'coldline', name: 'ColdLine Foods', trucks: 450, mrr: 1.8, fee: 6, min: 10, reqs: ['rbac', 'whitelabel', 'dataloc'], deadline: 4 },
    { id: 'swiftkart', name: 'SwiftKart', trucks: 900, mrr: 2.6, fee: 8, min: 12, reqs: ['api', 'oracle', 'customsla'], deadline: 5 },
    { id: 'medimove', name: 'MediMove Pharma', trucks: 700, mrr: 2.4, fee: 9, min: 13, reqs: ['audit', 'sap', 'customsla'], deadline: 5 },
    { id: 'mahanagar', name: 'Mahanagar Cement', trucks: 2000, mrr: 5.0, fee: 20, min: 15, reqs: ['sso', 'privcloud', 'customsla', 'soc2'], deadline: 6 },
    { id: 'govfleet', name: 'State Transport Corporation', trucks: 3500, mrr: 4.2, fee: 15, min: 18, reqs: ['dataloc', 'audit', 'privcloud', 'reports'], deadline: 6, slowPay: true }
  ];
  FS.DEALS = DEALS;
  function dealOffer(s, rep) {
    var D = s.deals;
    if (D.offer && D.offer.expires < s.month) { news(s, D.offer.name + ' went with another vendor.'); D.seen[D.offer.id] = 'lapsed'; D.offer = null; }
    if (D.offer || D.active.length >= 2 || !(cnt(s, 'ae') + cnt(s, 'hos')) || FS.metrics(s).arr < 120) return;
    var p = 0.1 + (s.gtm === 'enterprise' ? 0.12 : 0) + (opsDone(s, 'soc2') ? 0.05 : 0);
    if (rng(s) > p) return;
    var el = DEALS.filter(function (d) { return d.min <= s.month && !D.seen[d.id]; });
    if (!el.length) return;
    var d = el[Math.floor(rng(s) * Math.min(2, el.length))];
    D.offer = { id: d.id, name: d.name, trucks: d.trucks, mrr: d.mrr, fee: d.fee, reqs: d.reqs.slice(), deadline: d.deadline, slowPay: !!d.slowPay, expires: s.month + 1, productised: false, tried: false };
    D.seen[d.id] = 'offered';
    rep.notes.push(d.name + ' (' + d.trucks + ' trucks) sent an RFP worth ₹' + d.mrr.toFixed(1) + 'L MRR. Review it on the deal desk.');
    news(s, d.name + ' invited you to bid for its fleet software contract.');
  }
  function reqItemId(d, r) { return REQ[r].item ? REQ[r].item : (d.productised ? 'x_' + r : 'd_' + d.id + '_' + r); }
  FS.dealReqs = function (s, d) {
    return d.reqs.map(function (r) {
      var R = REQ[r], met, note, id = null;
      if (R.ops) { met = opsDone(s, R.ops); note = met ? 'Done' : s.ops.active[R.ops] ? 'In progress' : 'Start it in Operations'; }
      else if (R.sla) { met = true; note = has(s, 'observ') || cnt(s, 'sre') ? 'Covered by monitoring' : 'Penalty risk without monitoring or an SRE'; }
      else { id = reqItemId(d, r); met = has(s, id); var it = FS.item(s, id); note = met ? 'Shipped' : it ? Math.round(s.product.progress[id] || 0) + ' / ' + it.effort + ' wks' : (R.custom ? R.custom + ' wks custom' : 'Not started'); }
      return { r: r, name: R.name, met: met, note: note, custom: !!R.custom && !d.productised, id: id };
    });
  };
  FS.dealEffort = function (s, d) {
    var sol = Math.pow(0.85, Math.min(2, eff(s, 'solutions'))), t = 0;
    d.reqs.forEach(function (r) { var R = REQ[r]; if (R.custom) t += Math.round(R.custom * (d.productised ? 1.3 : 1) * sol); else if (R.item && !has(s, R.item)) { var it = FS.libItem(s, R.item); t += it.effort - (s.product.progress[R.item] || 0); } });
    return Math.round(t);
  };
  ACT.dProductise = function (s) {
    var d = s.deals.offer; if (!d || d.tried) return { ok: false };
    var err = spend(s, { str: 1 }); if (err) return { ok: false, msg: err };
    d.tried = true;
    var pr = 0.35 + 0.4 * s.product.pmf + 0.1 * Math.min(2, eff(s, 'solutions')) + 0.05 * Math.min(2, eff(s, 'pmm'));
    if (rng(s) < pr) { d.productised = true; d.mrr = Math.round(d.mrr * 0.9 * 100) / 100; return { ok: true, msg: d.name + ' agreed to standard product features instead of bespoke work, at a 10% lower price.' }; }
    return { ok: true, msg: d.name + ' insists on bespoke work. Accept as specified or decline.' };
  };
  ACT.dAccept = function (s, p) {
    var d = s.deals.offer; if (!d) return { ok: false };
    var cost = { str: 1 }; if (p.pod) cost.ppl = 1;
    var err = spend(s, cost); if (err) return { ok: false, msg: err };
    var P = s.product, sol = Math.pow(0.85, Math.min(2, eff(s, 'solutions'))), front = [];
    d.reqs.forEach(function (r) {
      var R = REQ[r];
      if (R.item) { FS.libItem(s, R.item); if (!has(s, R.item)) front.push(R.item); }
      else if (R.custom) {
        var id = reqItemId(d, r);
        if (!P.items[id]) P.items[id] = d.productised ?
          { id: id, name: R.name, effort: Math.round(R.custom * 1.3 * sol), cat: 'Enterprise', fx: { win: 0.01, pmf: 0.01 }, why: 'Productised from the ' + d.name + ' deal; every customer gets it.', src: d.name, real: 1, born: s.month } :
          { id: id, name: R.name + ' for ' + d.name, effort: Math.round(R.custom * sol), cat: 'Custom', fx: { debt: 2 }, why: 'Bespoke work for one customer. Adds permanent maintenance.', src: d.name, real: 1, custom: true, deal: d.id, born: s.month };
        if (!has(s, id)) front.push(id);
      }
    });
    front.forEach(function (id) { P.queue = P.queue.filter(function (x) { return x !== id; }); P.backlog = P.backlog.filter(function (x) { return x !== id; }); });
    P.queue = front.concat(P.queue);
    if (p.pod) {
      [['eng', 'Engineer', 22], ['eng', 'Engineer', 22], ['solutions', 'Solutions Engineer', 26]].forEach(function (x) {
        var nm, g = 0; do { nm = H.pick(s, H.NAMES); g++; } while (s.usedNames[nm] && g < 50); s.usedNames[nm] = true;
        s.pipeline.push({ name: nm, role: x[0], title: x[1], salary: x[2], skill: 1.0, ramp: 2, arrive: s.month + 1 });
        book(s, 'Recruiting fees', -FS.hireFee(s, { salary: x[2] }));
      });
    }
    var ad = { id: d.id, name: d.name, trucks: d.trucks, mrr: d.mrr, fee: d.fee, reqs: d.reqs, productised: d.productised, slowPay: d.slowPay, deadline: s.month + d.deadline, start: s.month, pod: !!p.pod };
    s.deals.active.push(ad); s.deals.offer = null; s.deals.seen[d.id] = 'won';
    var m = FS.metrics(s), effort = FS.dealEffort(s, ad), cap = Math.max(1, m.eng.feature + (p.pod ? 8 : 0));
    var feasible = effort / cap <= d.deadline;
    var q = (feasible ? 72 : 40) + (d.productised ? 10 : 0) + (p.pod && !feasible ? 15 : 0) - (m.runway < 6 && p.pod ? 20 : 0);
    log(s, 'Deals', 'Enterprise deal', 'Took on ' + d.name + (d.productised ? ' (productised)' : ' (custom)') + (p.pod ? ' with a dedicated pod' : ''), clamp(q, 0, 95),
      feasible ? (d.productised ? 'Won a large account while building features every customer can use.' : 'Feasible scope, but bespoke work leaves permanent maintenance.') : 'The scope did not fit the deadline at your engineering capacity.');
    news(s, 'You signed ' + d.name + '. Delivery is due by month ' + ad.deadline + '.');
    return { ok: true, msg: d.name + ' signed. ' + effort + ' eng-weeks of work moved to the top of the roadmap; go-live by month ' + ad.deadline + '.' };
  };
  ACT.dDecline = function (s) {
    var d = s.deals.offer; if (!d) return { ok: false };
    s.deals.offer = null; s.deals.seen[d.id] = 'declined';
    var m = FS.metrics(s), effort = FS.dealEffort(s, d), feasible = effort / Math.max(1, m.eng.feature) <= d.deadline;
    log(s, 'Deals', 'Enterprise deal', 'Declined ' + d.name, feasible ? 45 : 72, feasible ? 'A winnable, sizeable deal was left on the table.' : 'The scope would have swamped the roadmap; declining protected the core product.');
    return { ok: true, msg: 'Declined ' + d.name + '.' };
  };
  function dealTick(s, rep) {
    var D = s.deals;
    D.active = D.active.filter(function (d) {
      var reqs = FS.dealReqs(s, d);
      if (reqs.every(function (r) { return r.met; })) {
        s.keys.push({ id: 'd_' + d.id, name: d.name, mrr: d.mrr, active: true, ent: true, sla: d.reqs.indexOf('customsla') >= 0, priv: d.reqs.indexOf('privcloud') >= 0 });
        book(s, 'Implementation fees', d.fee);
        D.live.push({ id: d.id, name: d.name, mrr: d.mrr, at: s.month, slowPay: d.slowPay, late: s.month > d.deadline });
        rep.notes.push(d.name + ' is live: +₹' + d.mrr.toFixed(1) + 'L MRR and a ₹' + d.fee + 'L implementation fee.');
        news(s, d.name + ' went live on your platform.');
        log(s, 'Deals', 'Delivery', d.name + ' delivered ' + (s.month <= d.deadline ? 'on time' : 'late'), s.month <= d.deadline ? 82 : 50, s.month <= d.deadline ? 'Delivered on time; enterprise references are gold.' : 'Late delivery strained the relationship.');
        return false;
      }
      if (s.month > d.deadline) {
        if (rng(s) < 0.35) {
          D.lost.push({ id: d.id, name: d.name, at: s.month }); s.board -= 3;
          rep.notes.push(d.name + ' cancelled the contract after the missed deadline.');
          news(s, d.name + ' cancelled after delivery slipped.');
          return false;
        }
        d.deadline++; rep.notes.push(d.name + ' granted a one-month extension. Deliver soon.');
      }
      return true;
    });
    s.keys.forEach(function (k) {
      if (k.active && k.sla && !(has(s, 'observ') || cnt(s, 'sre')) && rng(s) < 0.15 * s.mods.incident) {
        var c = Math.round(k.mrr * 0.5 * 10) / 10; book(s, 'SLA credits', -c);
        rep.notes.push('SLA breach: ' + k.name + ' claimed ₹' + c + 'L in service credits.');
      }
    });
  }

  /* =====================================================================
     6. CRISES — tech, marketing and product
     ===================================================================== */
  function C(id, def) { def.crisis = true; def.quotes = def.quotes || []; EV[id] = def; }
  function tempSpike(s, k, v, mo) { addTemp(s, k, v, mo); }
  C('breach', {
    title: 'Data breach: consignee data exposed.', tag: 'CRISIS · TECH', once: false, cool: 8,
    when: function (s) { return s.month >= 5; }, w: function (s) { return 0.9 * (1 - FS.secScore(s) / 100); },
    body: function () { return 'A misconfigured storage bucket exposed delivery addresses and phone numbers for about 3,200 consignees. A security researcher emailed you an hour ago. Indian rules require reporting to CERT-In within six hours.'; },
    quotes: [['If we disclose, Stackline will use it against us in every deal.', 'Kunal Sethi, Account Executive'], ['If we don\'t, and it comes out, we\'re finished.', 'Vikram Joshi, DevOps']],
    choices: [
      { label: 'Disclose, notify CERT-In and customers, fix and audit', effect: 'Short-term churn bump; trust preserved; security +10.', cost: function (s) { return { ops: 1, cash: Math.round(4 * ins(s) * 10) / 10, cat: 'Crisis costs' }; }, apply: function (s) { s.board -= 2; tempSpike(s, 'churn', 0.002, 2); s.sec = clamp(s.sec + 10, 0, 100); }, q: function () { return 88; }, why: 'Fast, honest disclosure is a legal duty and limits the damage.' },
      { label: 'Fix it quietly and thank the researcher', effect: 'No cost now. If it leaks, it is far worse.', cost: {}, apply: function (s) { if (rng(s) < 0.5) s.scheduled.push({ m: s.month + 2, fx: 'breachLeak' }); }, q: function () { return 12; }, why: 'Concealing a breach breaks the law and, when found, destroys trust.' },
      { label: 'Hire an incident-response firm, then disclose', effect: 'Expensive; thorough; security +20.', cost: function (s) { return { ops: 1, cash: Math.round(9 * ins(s) * 10) / 10, cat: 'Crisis costs' }; }, apply: function (s) { tempSpike(s, 'churn', 0.001, 2); s.sec = clamp(s.sec + 20, 0, 100); }, q: function (s) { return FS.metrics(s).runway > 6 ? 80 : 60; }, why: 'Thorough and honest, at a real cash cost.' }
    ]
  });
  FX.breachLeak = function (s) { s.scandal++; s.board -= 12; addTemp(s, 'churn', 0.008, 3); addTemp(s, 'win', -0.08, 3); news(s, 'A news site reported the data breach you did not disclose.'); };
  C('cloudOutage', {
    title: 'Your cloud region went down for nine hours.', tag: 'CRISIS · TECH', once: false, cool: 6,
    when: function (s) { return s.month >= 3; }, w: function (s) { return 0.7 * s.mods.incident * (has(s, 'observ') ? 0.6 : 1); },
    body: function () { return 'Trucks could not be dispatched for most of a working day. About 60% of customers were affected, and Kavya\'s operations head called you directly.'; },
    choices: [
      { label: 'Service credits for every affected customer', effect: 'Costs about a quarter of a month\'s revenue; churn contained.', cost: function (s) { return { ops: 1, cash: Math.round(0.25 * FS.metrics(s).mrr * ins(s) * 10) / 10, cat: 'Crisis costs' }; }, apply: function (s) { tempSpike(s, 'churn', 0.002, 1); }, q: function () { return 72; }, why: 'Owning the impact limited churn.' },
      { label: 'Build multi-region failover', effect: '10 eng-weeks; infra +8%; outages −40%.', cost: { ops: 1 }, apply: function (s) { tax(s, 10); s.mods.infra *= 1.08; s.mods.incident *= 0.6; tempSpike(s, 'churn', 0.003, 1); }, q: function (s) { return FS.metrics(s).customers > 80 ? 82 : 58; }, why: 'Resilience is worth paying for once many customers depend on you.' },
      { label: 'Blame the cloud provider publicly', effect: 'Customers do not care whose fault it was.', cost: {}, apply: function (s) { tempSpike(s, 'churn', 0.006, 2); s.board -= 2; }, q: function () { return 22; }, why: 'Customers hold you responsible for your vendors.' }
    ]
  });
  C('ransomware', {
    title: 'Ransomware: staging is encrypted.', tag: 'CRISIS · TECH', once: true,
    when: function (s) { return s.month >= 8; }, w: function (s) { return 0.45 * (1 - FS.secScore(s) / 100); },
    body: function () { return 'A ransomware gang encrypted your staging environment and claims to hold copies of production backups. They want $40,000 in crypto within 48 hours.'; },
    choices: [
      { label: 'Refuse, restore from backups and report to CERT-In', effect: 'Costs engineering time; more if your releases are fragile.', cost: { ops: 2 }, apply: function (s) { tax(s, has(s, 'testing') || s.flags.oncall ? 4 : 10); s.sec = clamp(s.sec + 5, 0, 100); }, q: function () { return 86; }, why: 'Refusing and restoring is the standard, lawful response.' },
      { label: 'Pay the ransom', effect: 'No guarantee they delete anything.', cost: { cash: 34, cat: 'Crisis costs' }, apply: function (s) { if (rng(s) < 0.35) { s.scandal++; news(s, 'Reports surfaced that you paid a ransom.'); } }, q: function () { return 8; }, why: 'Paying funds crime, may break sanctions rules and guarantees nothing.' },
      { label: 'Hire an incident-response firm', effect: 'Fast, expert recovery; security +15.', cost: function (s) { return { ops: 1, cash: Math.round(12 * ins(s) * 10) / 10, cat: 'Crisis costs' }; }, apply: function (s) { tax(s, 4); s.sec = clamp(s.sec + 15, 0, 100); }, q: function () { return 76; }, why: 'Expert help shortened recovery at a cost.' }
    ]
  });
  C('dbScale', {
    title: 'The database is buckling under load.', tag: 'CRISIS · TECH', once: true,
    when: function (s) { return FS.metrics(s).customers >= 110 && s.product.debt >= 45; }, w: 1.2,
    body: function () { return 'Month-end reports take 12 seconds to load and some time out. Three customers have asked for a call about "stability".'; },
    choices: [
      { label: 'Throw hardware at it now', effect: 'Infra +12% for good.', cost: { cash: 6, cat: 'Crisis costs' }, apply: function (s) { s.mods.infra *= 1.12; }, q: function () { return 58; }, why: 'Bought time at a permanent cost.' },
      { label: 'Two-month performance sprint (50% to debt)', effect: 'Features slow; the root cause gets fixed.', cost: { ops: 1 }, apply: function (s) { s.flags.sprintUntil = s.month + 2; s.flags.sprintPrev = s.product.alloc; s.product.alloc = 50; tempSpike(s, 'churn', 0.001, 1); }, q: function (s) { return s.product.debt > 55 ? 84 : 70; }, why: 'Treating the cause was right with debt this high.' },
      { label: 'Keep shipping features', effect: 'Churn rises for three months.', cost: {}, apply: function (s) { tempSpike(s, 'churn', 0.006, 3); }, q: function () { return 20; }, why: 'Ignoring performance at scale drives churn.' }
    ]
  });
  C('mapsPrice', {
    title: 'Your maps API bill is about to triple.', tag: 'CRISIS · TECH', once: true,
    when: function (s) { return s.month >= 7; }, w: 0.5,
    body: function () { return 'Your maps vendor is ending startup pricing. From next month, routing calls cost three times as much.'; },
    choices: [
      { label: 'Pay it', effect: 'Infra +15%.', cost: {}, apply: function (s) { s.mods.infra *= 1.15; }, q: function () { return 48; }, why: 'Paying without exploring alternatives is costly.' },
      { label: 'Migrate to an open-source map stack', effect: '8 eng-weeks; tech debt +3.', cost: { ops: 1 }, apply: function (s) { tax(s, 8); s.product.debt = clamp(s.product.debt + 3, 5, 100); }, q: function () { return 75; }, why: 'Removing a vendor dependency paid back quickly.' },
      { label: 'Negotiate a volume deal', effect: '60% chance of only +5%; otherwise +15%.', cost: { str: 1 }, apply: function (s) { s.mods.infra *= rng(s) < 0.6 ? 1.05 : 1.15; }, q: function () { return 70; }, why: 'Negotiating first is usually worth one meeting.' }
    ]
  });
  C('adBan', {
    title: 'Google suspended your ads account.', tag: 'CRISIS · MARKETING', once: true,
    when: function (s) { return s.month >= 4 && s.channels.google > 0; }, w: 0.6,
    body: function () { return 'An ad claimed "40% lower fuel costs, guaranteed". Google flagged it as an unverified claim and paused your account. No Google Search leads until the appeal clears.'; },
    choices: [
      { label: 'Appeal and move the budget to LinkedIn and content', effect: 'Google is paused for two months; the spend keeps working elsewhere.', cost: { ops: 1 }, apply: function (s) { s.flags.adBanUntil = s.month + 2; var g = s.channels.google; s.channels.google = 0; s.channels.linkedin += Math.round(g / 2 * 2) / 2; s.channels.content += Math.round(g / 2 * 2) / 2; syncMkt(s); }, q: function () { return 80; }, why: 'Reallocating kept the pipeline flowing during the appeal.' },
      { label: 'Appeal and wait', effect: 'Two months with no Google leads; the budget sits idle.', cost: {}, apply: function (s) { s.flags.adBanUntil = s.month + 2; }, q: function () { return 45; }, why: 'Paying for a paused channel wasted budget.' },
      { label: 'Open a new account under another entity', effect: 'Risks a permanent ban.', cost: {}, apply: function (s) { if (rng(s) < 0.5) { s.flags.adBanUntil = 99; s.scandal++; news(s, 'Google permanently banned your business from advertising.'); } }, q: function () { return 10; }, why: 'Evading a platform ban risks losing the channel for good.' }
    ]
  });
  C('badReview', {
    title: 'A furious customer post is going viral.', tag: 'CRISIS · MARKETING', once: false, cool: 6,
    when: function (s) { return s.month >= 5; }, w: function (s) { return 0.35 + Math.max(0, FS.metrics(s).churn - 0.02) * 20; },
    body: function () { return 'A churned customer posted "Fleet software that loses your trucks" on LinkedIn. It has 40,000 views and prospects are asking about it.'; },
    choices: [
      { label: 'Respond publicly with facts and the fix', effect: 'Win rate dips briefly, then recovers.', cost: { str: 1 }, apply: function (s) { tempSpike(s, 'win', -0.03, 1); }, q: function () { return 80; }, why: 'A calm, factual public reply usually turns the story.' },
      { label: 'Offer a refund to take it down', effect: 'Might backfire if they post the offer.', cost: { cash: 2, cat: 'Crisis costs' }, apply: function (s) { if (rng(s) < 0.5) { tempSpike(s, 'win', -0.06, 2); s.scandal++; news(s, 'The customer posted your takedown offer.'); } }, q: function () { return 28; }, why: 'Paying for silence often becomes the bigger story.' },
      { label: 'Ignore it', effect: 'Win rate down for two months.', cost: {}, apply: function (s) { tempSpike(s, 'win', -0.05, 2); }, q: function () { return 45; }, why: 'Silence left prospects with only one side of the story.' }
    ]
  });
  C('brandBid', {
    title: 'Stackline is bidding on your brand name.', tag: 'CRISIS · MARKETING', once: true,
    when: function (s) { return s.month >= 6 && s.channels.google > 0; }, w: 0.6,
    body: function () { return 'Search for your company and Stackline\'s ad now appears first. Your Google cost per lead jumped 45%.'; },
    choices: [
      { label: 'Raise your own brand bids', effect: 'Google leads cost 15% more for four months.', cost: { cash: 2, cat: 'Launches & campaigns' }, apply: function (s) { tempSpike(s, 'cpl_google', 0.15, 4); }, q: function () { return 66; }, why: 'Defending your brand keyword is cheap insurance.' },
      { label: 'Shift budget away from Google', effect: 'Google leads cost 45% more for four months. Rebalance yourself.', cost: {}, apply: function (s) { tempSpike(s, 'cpl_google', 0.45, 4); }, q: function () { return 62; }, why: 'Reasonable, if you actually rebalance the spend.' },
      { label: 'Send a legal notice', effect: '40% chance they stop.', cost: { str: 1, cash: 1.5, cat: 'Legal & compliance' }, apply: function (s) { tempSpike(s, 'cpl_google', rng(s) < 0.4 ? 0.1 : 0.45, 4); }, q: function () { return 40; }, why: 'Brand bidding is usually legal in India; the notice rarely works.' }
    ]
  });
  C('trademark', {
    title: 'A trademark infringement notice arrives.', tag: 'CRISIS · MARKETING', once: true,
    when: function (s) { return s.month >= 10; }, w: 0.35,
    body: function () { return 'A Pune company with a similar name claims prior use and wants you to rebrand within 90 days.'; },
    choices: [
      { label: 'Settle with a coexistence agreement', effect: 'Closes the matter.', cost: { str: 1, cash: 6, cat: 'Legal & compliance' }, apply: function () { }, q: function () { return 75; }, why: 'A known, modest cost closed an open-ended risk.' },
      { label: 'Fight it in court', effect: '50% chance of losing and a forced rebrand.', cost: { cash: 3, cat: 'Legal & compliance' }, apply: function (s) { s.scheduled.push({ m: s.month + 4, fx: 'tmCase' }); }, q: function () { return 45; }, why: 'Litigation is slow, distracting and uncertain.' },
      { label: 'Rebrand now', effect: 'Lead costs +25% for three months.', cost: { ops: 1, cash: 12, cat: 'Launches & campaigns' }, apply: function (s) { tempSpike(s, 'cac', 0.25, 3); }, q: function () { return 48; }, why: 'Expensive and premature.' }
    ]
  });
  FX.tmCase = function (s) { if (rng(s) < 0.5) { book(s, 'Legal & compliance', -15); addTemp(s, 'cac', 0.2, 3); news(s, 'You lost the trademark case and must rebrand.'); } else news(s, 'The court dismissed the trademark claim.'); };
  C('leadFraud', {
    title: 'Sales says Meta leads are fake.', tag: 'CRISIS · MARKETING', once: true,
    when: function (s) { return s.month >= 3 && s.channels.meta >= 2; }, w: 0.8,
    body: function () { return 'About 40% of Meta form-fills are bots or wrong numbers. Your real cost per lead there is much higher than the dashboard shows.'; },
    choices: [
      { label: 'Add phone verification to forms', effect: '2 eng-weeks; Meta lead count −15% but real.', cost: { ops: 1 }, apply: function (s) { tax(s, 2); s.chEff.meta *= 0.85; }, q: function () { return 82; }, why: 'Fixing measurement beats arguing about it.' },
      { label: 'Cut Meta spend to zero', effect: 'Stops the waste.', cost: {}, apply: function (s) { s.chEff.meta *= 0.6; s.channels.meta = 0; syncMkt(s); }, q: function () { return 68; }, why: 'Stopping a broken channel is sound, if blunt.' },
      { label: 'Keep spending; volume is volume', effect: 'Meta efficiency falls 40%.', cost: {}, apply: function (s) { s.chEff.meta *= 0.6; }, q: function () { return 22; }, why: 'Paying for fake leads inflates CAC.' }
    ]
  });
  C('badRelease', {
    title: 'A release broke route assignment.', tag: 'CRISIS · PRODUCT', once: false, cool: 5,
    when: function (s) { return s.month >= 3; }, w: function (s) { return Math.max(0.05, 0.25 + s.product.debt / 200 - (has(s, 'testing') ? 0.2 : 0)) * s.mods.incident; },
    body: function () { return 'Tuesday\'s release broke route assignment for about 30% of customers. Support has 140 open tickets.'; },
    choices: [
      { label: 'Roll back now and fix properly', effect: '4 eng-weeks; small churn bump.', cost: { ops: 1 }, apply: function (s) { tax(s, 4); tempSpike(s, 'churn', 0.001, 1); }, q: function () { return 86; }, why: 'Rolling back first limits customer harm.' },
      { label: 'Hot-fix forward under pressure', effect: '50% chance of a second incident.', cost: {}, apply: function (s) { if (rng(s) < 0.5) { tempSpike(s, 'churn', 0.004, 2); s.product.debt = clamp(s.product.debt + 3, 5, 100); news(s, 'The hot-fix caused a second incident.'); } }, q: function () { return 45; }, why: 'Rushed fixes under pressure often break something else.' },
      { label: 'Tell customers it is their setup', effect: 'Churn up for three months.', cost: {}, apply: function (s) { tempSpike(s, 'churn', 0.006, 3); s.scandal += 0.5; }, q: function () { return 8; }, why: 'Blaming customers for your bug costs trust.' }
    ]
  });
  C('appReject', {
    title: 'Google Play rejected your driver-app update.', tag: 'CRISIS · PRODUCT', once: true,
    when: function (s) { return has(s, 'mobile'); }, w: 0.8,
    body: function () { return 'The update was rejected over background-location permissions. Drivers on the old version keep crashing.'; },
    choices: [
      { label: 'Rework the permissions properly', effect: '6 eng-weeks.', cost: { ops: 1 }, apply: function (s) { tax(s, 6); }, q: function () { return 80; }, why: 'Doing it properly avoids repeated rejections.' },
      { label: 'Strip location features to pass review', effect: 'Fit −2.', cost: {}, apply: function (s) { s.product.pmf -= 0.02; }, q: function () { return 45; }, why: 'Removing core value to pass review hurt the product.' },
      { label: 'Tell drivers to sideload the app', effect: 'Security −10; churn risk.', cost: {}, apply: function (s) { s.sec = clamp(s.sec - 10, 0, 100); tempSpike(s, 'churn', 0.003, 2); }, q: function () { return 12; }, why: 'Sideloading is a security risk and a support nightmare.' }
    ]
  });
  C('privacy', {
    title: 'A DPDP privacy complaint is filed.', tag: 'CRISIS · PRODUCT', once: true,
    when: function (s) { return s.month >= 9 && !s.flags.dpdp; }, w: 0.5,
    body: function () { return 'A drivers\' union says your app tracks drivers\' locations after their shifts end, and has filed a complaint under the Digital Personal Data Protection Act.'; },
    choices: [
      { label: 'Fix tracking and publish a clear privacy notice', effect: '4 eng-weeks; board +1.', cost: { ops: 1 }, apply: function (s) { tax(s, 4); s.board += 1; s.sec = clamp(s.sec + 5, 0, 100); }, q: function () { return 86; }, why: 'Fixing the practice is the real answer to a privacy complaint.' },
      { label: 'Hire lawyers and contest it', effect: 'Risk of a later penalty.', cost: { cash: 5, cat: 'Legal & compliance' }, apply: function (s) { if (rng(s) < 0.5) s.scheduled.push({ m: s.month + 4, fx: 'privacyFine' }); }, q: function () { return 38; }, why: 'Contesting a legitimate complaint is expensive and risky.' },
      { label: 'Ignore it', effect: 'A penalty is likely.', cost: {}, apply: function (s) { s.scheduled.push({ m: s.month + 3, fx: 'privacyFine' }); s.scandal += 0.5; }, q: function () { return 8; }, why: 'Ignoring a regulator is never cheap.' }
    ]
  });
  FX.privacyFine = function (s) { book(s, 'Legal & compliance', -20); s.board -= 5; news(s, 'The Data Protection Board imposed a ₹20L penalty.'); };
  C('flop', {
    title: function (s) { var it = flopItem(s); return 'Almost nobody uses "' + (it ? it.name : 'your new feature') + '".'; }, tag: 'CRISIS · PRODUCT', once: false, cool: 6,
    when: function (s) { return !!flopItem(s); }, w: 1.2,
    body: function (s) { var it = flopItem(s); return 'You spent ' + (it ? it.effort : 'many') + ' eng-weeks on it. Usage data shows 6% of accounts have tried it and 2% use it weekly.'; },
    choices: [
      { label: 'Interview ten customers and iterate', effect: 'A focused v2 joins the backlog with better odds.', cost: { ops: 1 }, apply: function (s) { var it = flopItem(s); if (!it) return; it.flopped = true; var id = it.id + '_fix'; s.product.items[id] = { id: id, name: it.name.replace(/ v\d+$/, '') + ' (reworked)', effort: Math.max(4, Math.round(it.effort * 0.35)), cat: it.cat, fx: it.fx, why: 'Rebuilt around what customers actually said.', src: 'Customer interviews', real: 0.9 + rng(s) * 0.5, born: s.month }; s.product.backlog.unshift(id); }, q: function () { return 82; }, why: 'Learning why a feature failed is the cheapest way to fix it.' },
      { label: 'Sunset it to cut maintenance', effect: 'Tech debt −3.', cost: {}, apply: function (s) { var it = flopItem(s); if (it) it.flopped = true; s.product.debt = clamp(s.product.debt - 3, 5, 100); }, q: function () { return 62; }, why: 'Killing unused features keeps the product lean.' },
      { label: 'Push it with a marketing campaign', effect: 'Adoption barely moves.', cost: { cash: 4, cat: 'Launches & campaigns' }, apply: function (s) { var it = flopItem(s); if (it) it.flopped = true; addTemp(s, 'leads', 1, 1); }, q: function () { return 28; }, why: 'Marketing cannot fix a feature customers do not need.' }
    ]
  });
  function flopItem(s) { var P = s.product; for (var i = P.shipped.length - 1; i >= 0; i--) { var it = FS.item(s, P.shipped[i]); if (it && !it.custom && !it.partner && !it.flopped && it.realised != null && it.realised < 0.8 && P.shippedAt[it.id] >= s.month - 3) return it; } return null; }
  C('dataLoss', {
    title: 'An import bug wiped a customer\'s trip history.', tag: 'CRISIS · PRODUCT', once: true,
    when: function (s) { return s.month >= 6 && H.keyActive(s, 'arvind'); }, w: function (s) { return 0.35 * (has(s, 'testing') ? 0.5 : 1); },
    body: function () { return 'A bulk-import bug deleted three months of trip history for Arvind Freight. They are threatening to leave.'; },
    choices: [
      { label: 'Restore from backups and give two months free', effect: 'Two months of service credits.', cost: { ops: 1, cash: 1.4, cat: 'Crisis costs' }, apply: function () { }, q: function () { return 82; }, why: 'Generous recovery kept a key account.' },
      { label: 'Restore, but no compensation', effect: '40% chance they churn.', cost: {}, apply: function (s) { if (rng(s) < 0.4) H.churnKey(s, 'arvind'); }, q: function () { return 50; }, why: 'Saving a little cash put a key account at risk.' }
    ]
  });

  HK.crisis = function (s) {
    if (s.month < 3 || (s.lastCrisis && s.lastCrisis > s.month - 2)) return null;
    var paid = (s.channels.google || 0) + (s.channels.meta || 0) + (s.channels.linkedin || 0);
    var p = 0.1 + s.product.debt * 0.0012 + (FS.secScore(s) < 40 ? 0.03 : 0) + (paid > 8 ? 0.03 : 0);
    if (rng(s) > p) return null;
    var pool = [];
    for (var id in EV) {
      var e = EV[id]; if (!e.crisis) continue;
      if (e.once && s.fired[id]) continue;
      if (!e.once && s.fired[id] && s.fired[id] > s.month - (e.cool || 6)) continue;
      if (!e.when(s)) continue;
      var w = typeof e.w === 'function' ? e.w(s) : e.w; if (w > 0) pool.push([id, w]);
    }
    if (!pool.length) return null;
    var tot = pool.reduce(function (a, x) { return a + x[1]; }, 0), r = rng(s) * tot;
    for (var i = 0; i < pool.length; i++) { r -= pool[i][1]; if (r <= 0) { s.lastCrisis = s.month; return pool[i][0]; } }
    return null;
  };

  /* =====================================================================
     7. GOALS AND BOARD OKRs
     ===================================================================== */
  var GOALS = [
    { id: 'arr1', ch: 'Survive and find fit', name: '₹1 Cr ARR', t: function (s, m) { return m.arr >= 100; }, board: 3 },
    { id: 'cust75', ch: 'Survive and find fit', name: '75 customers', t: function (s, m) { return m.customers >= 75; }, board: 2 },
    { id: 'pmf', ch: 'Survive and find fit', name: 'Strong product-market fit signal', t: function (s) { return s.product.pmf >= 0.68; }, board: 3 },
    { id: 'ship8', ch: 'Survive and find fit', name: 'Ship 8 features', t: function (s) { return s.product.shipped.filter(function (id) { var it = FS.item(s, id); return it && !it.custom && !it.partner; }).length >= 8; }, board: 2 },
    { id: 'nrr', ch: 'Build the engine', name: 'Net revenue retention above 110%', t: function (s, m) { return m.nrr >= 1.1; }, board: 3 },
    { id: 'win', ch: 'Build the engine', name: 'Win rate above 50% on worked deals', t: function (s) { return s.lastAcq && s.lastAcq.win >= 0.5; }, board: 2 },
    { id: 'exp3', ch: 'Build the engine', name: 'Ship three significant experiment wins', t: function (s) { return s.exp.history.filter(function (h) { return h.shipped && h.sig && h.obs > 0; }).length >= 3; }, board: 2 },
    { id: 'partner2', ch: 'Build the engine', name: 'Two live partnerships', t: function (s) { return liveParts(s).length >= 2; }, board: 2 },
    { id: 'arr3', ch: 'Build the engine', name: '₹3 Cr ARR', t: function (s, m) { return m.arr >= 300; }, board: 4 },
    { id: 'seriesA', ch: 'Raise and scale', name: 'Close a Series A', t: function (s) { return s.fund.raised; }, board: 0 },
    { id: 'cleanA', ch: 'Raise and scale', name: 'Series A with under 25% dilution', t: function (s) { return s.fund.raised && s.fund.dil < 0.25; }, board: 2 },
    { id: 'ent1', ch: 'Raise and scale', name: 'First enterprise customer live', t: function (s) { return s.segments.ent.cust > 0 || s.deals.live.length > 0; }, board: 3 },
    { id: 'soc2', ch: 'Raise and scale', name: 'Achieve SOC 2', t: function (s) { return opsDone(s, 'soc2'); }, board: 2 },
    { id: 'markets', ch: 'Raise and scale', name: 'Operate in five market segments', t: function (s) { return Object.keys(s.segments).filter(function (k) { return s.segments[k].unlocked; }).length >= 5; }, board: 3 },
    { id: 'team', ch: 'Build the company', name: 'Morale above 70 for six straight months', t: function (s) { return s.streak.team >= 6; }, board: 2 },
    { id: 'bm', ch: 'Build the company', name: 'Burn multiple under 1.5 for a quarter', t: function (s) { return s.streak.bm >= 3; }, board: 3 },
    { id: 'alive', ch: 'Build the company', name: 'Default alive: profitable or 24+ months of runway', t: function (s, m) { return m.burn <= 0 || m.runway >= 24; }, board: 3 },
    { id: 'arr6', ch: 'Beyond Series A', name: '₹6 Cr ARR', t: function (s, m) { return m.arr >= 600; }, board: 4 },
    { id: 'arr10', ch: 'Beyond Series A', name: '₹10 Cr ARR', t: function (s, m) { return m.arr >= 1000; }, board: 4 },
    { id: 'seriesB', ch: 'Beyond Series A', name: 'Series B ready: ₹12 Cr ARR, 5%+ monthly growth, burn multiple under 2', t: function (s, m) { return m.arr >= 1200 && m.g3 >= 0.05 && m.bm < 2; }, board: 5 }
  ];
  FS.GOALS = GOALS;
  HK.goalsDone = function (s) { return Object.keys(s.goals).length; };
  HK.goalsTotal = function () { return GOALS.length; };
  FS.nextGoals = function (s) { return GOALS.filter(function (g) { return !s.goals[g.id]; }).slice(0, 3); };
  function goalsTick(s, rep) {
    var m = FS.metrics(s);
    s.streak.team = m.morale >= 70 && !rep.quit.length ? s.streak.team + 1 : 0;
    s.streak.bm = m.bm < 1.5 ? s.streak.bm + 1 : 0;
    GOALS.forEach(function (g) {
      if (s.goals[g.id]) return;
      if (g.t(s, m)) { s.goals[g.id] = s.month; s.board = Math.min(95, s.board + g.board); rep.goals = (rep.goals || []).concat([g.name]); news(s, 'Milestone: ' + g.name + '.'); }
    });
  }

  var OKR = {
    mrr: function (s, m) { var t = Math.round(m.mrr * 1.2 * 10) / 10; return { k: 'mrr', label: 'MRR at least ₹' + t + 'L', target: t }; },
    bm: function () { return { k: 'bm', label: 'Burn multiple under 2.5×', target: 2.5 }; },
    ship: function (s) { var n = s.product.shipped.length + 2; return { k: 'ship', label: 'Ship 2 more roadmap items', target: n }; },
    churn: function () { return { k: 'churn', label: 'Monthly logo churn at or under 2%', target: 0.02 }; },
    runway: function () { return { k: 'runway', label: 'Keep 9+ months of runway, or be mid-raise', target: 9 }; },
    sla: function () { return { k: 'sla', label: 'Support SLA at 95% or better', target: 0.95 }; },
    nrr: function () { return { k: 'nrr', label: 'Net revenue retention at 105% or more', target: 1.05 }; },
    hos: function () { return { k: 'hos', label: 'Hire a Head of Sales', target: 1 }; }
  };
  FS.okrMet = function (s, o) {
    var m = FS.metrics(s);
    switch (o.k) {
      case 'mrr': return m.mrr >= o.target;
      case 'bm': return m.bm <= o.target;
      case 'ship': return s.product.shipped.length >= o.target;
      case 'churn': return m.churn <= o.target;
      case 'runway': return m.runway >= o.target || s.fund.status === 'active' || s.fund.raised;
      case 'sla': return FS.support(s).sla >= o.target;
      case 'nrr': return m.nrr >= o.target;
      case 'hos': return cnt(s, 'hos') > 0;
    }
    return false;
  };
  HK.board = function (s, b) {
    var m = FS.metrics(s);
    if (s.okrs.length) {
      b.review = s.okrs.map(function (o) { var ok = FS.okrMet(s, o); s.board = clamp(s.board + (ok ? 3 : -2), 0, 95); return { label: o.label, ok: ok }; });
    }
    var list = [OKR.mrr(s, m)];
    if (m.bm > 2.5) list.push(OKR.bm()); else if (m.churn > 0.02) list.push(OKR.churn()); else list.push(OKR.nrr());
    if (!s.fund.raised && m.runway < 12) list.push(OKR.runway());
    else if (FS.support(s).sla < 0.95) list.push(OKR.sla());
    else if (!cnt(s, 'hos') && m.arr > 150) list.push(OKR.hos());
    else list.push(OKR.ship(s));
    s.okrs = list; b.okrs = list.map(function (o) { return o.label; });
  };

  /* =====================================================================
     8. MONEY — extra costs, receivables, P&L, cash flow, MIS
     ===================================================================== */
  HK.extra = function (s, mrr) {
    var rs = 0, other = 0, mult = 1, ent = 0;
    s.partners.active.forEach(function (p) {
      if (p.status !== 'live') return;
      rs += FS.partnerEcon(s, p).cost;
      if (p.terms.price) mult *= 1 + p.terms.price.val / 100;
      if (p.terms.take) other += mrr * 0.15 * p.terms.take.val / 100;
    });
    s.keys.forEach(function (k) { if (k.active && k.priv) ent += 1.2; });
    return { revShare: rs, otherRev: other, recurring: s.flags.insurance ? 0.4 : 0, credits: s.credits || 0, infraMult: mult, entInfra: ent };
  };
  HK.money = function (s, rep, m) {
    var dso = FS.dso(s), newAR = (m.mrr + m.otherRev) * dso / 30, d = newAR - s.ar;
    if (Math.abs(d) > 0.001) book(s, 'Working capital (receivables)', -d);
    s.ar = newAR;
    s.credits = Math.max(0, (s.credits || 0) - m.credits);
    rep._pay = payByFn(s); rep._rt = { rent: s.rent, tools: s.tools };
  };
  var EXP_CATS = ['Recruiting fees', 'Severance', 'Market entry', 'Team & culture', 'Launches & campaigns', 'Partner fees', 'Operations projects', 'Legal & compliance', 'Crisis costs', 'SLA credits', 'Other one-offs'];
  var REV_CATS = ['Implementation fees', 'Services income'];
  var FIN_CATS = ['Equity raised', 'Debt drawn'];
  var WC_CATS = ['Working capital (receivables)', 'Working capital (payables)', 'Customer prepayments', 'Deferred salaries'];
  FS.REPORT_CATS = { exp: EXP_CATS, rev: REV_CATS, fin: FIN_CATS, wc: WC_CATS };
  function payByFn(s) {
    var o = { rd: 0, sm: 0, cs: 0, ga: 0 };
    s.people.forEach(function (p) {
      var c = p.salary / 12 * 1.1, f = p.fn;
      if (f === 'eng' || f === 'product') o.rd += c; else if (f === 'sales' || f === 'mkt') o.sm += c; else if (f === 'cs') o.cs += c; else o.ga += c;
    });
    return o;
  }
  HK.close = function (s, rep) {
    var m = rep._m; delete rep._m;
    if (!m) return;
    var x = s.mtx || {}, pay = rep._pay || payByFn(s), rt = rep._rt || { rent: s.rent, tools: s.tools }; delete rep._pay; delete rep._rt;
    var oneRev = REV_CATS.reduce(function (a, c) { return a + (x[c] || 0); }, 0);
    var oneExp = {}; EXP_CATS.forEach(function (c) { if (x[c]) oneExp[c] = -x[c]; });
    var oneExpT = Object.keys(oneExp).reduce(function (a, c) { return a + oneExp[c]; }, 0);
    var progs = {}; CH_ORDER.forEach(function (c) { if (s.channels[c]) progs[c] = s.channels[c]; });
    var rev = m.mrr + m.otherRev + oneRev, cogs = m.infra + pay.cs + m.revShare, gp = rev - cogs;
    var opex = pay.rd + pay.sm + pay.ga + m.marketing + rt.rent + rt.tools + m.recurring + oneExpT;
    var ebitda = gp - opex;
    rep.pl = {
      rev: { subscription: m.mrr, payments: m.otherRev, oneoff: oneRev, total: rev },
      cogs: { infra: m.infra, credits: m.credits, support: pay.cs, revShare: m.revShare, total: cogs },
      gp: gp, gm: rev > 0 ? gp / rev : 0,
      opex: { rd: pay.rd, smPay: pay.sm, programs: m.marketing, progs: progs, gaPay: pay.ga, rent: rt.rent, tools: rt.tools, insurance: m.recurring, oneoff: oneExp, total: opex },
      ebitda: ebitda, interest: m.interest, net: ebitda - m.interest
    };
    var wc = 0, wcl = {}; WC_CATS.forEach(function (c) { if (x[c]) { wc += x[c]; wcl[c] = x[c]; } });
    var fin = 0, finl = {}; FIN_CATS.forEach(function (c) { if (x[c]) { fin += x[c]; finl[c] = x[c]; } });
    var payroll = pay.rd + pay.sm + pay.cs + pay.ga;
    var open = s.openCash != null ? s.openCash : rep.cash0;
    var cf = {
      open: open, receipts: m.mrr + m.otherRev + oneRev, payroll: -payroll,
      vendors: -(m.infra + rt.rent + rt.tools + m.marketing + m.recurring + m.revShare), interest: -m.interest, oneoff: -oneExpT,
      wc: wc, wcl: wcl, fin: fin, finl: finl, repay: -m.repay, close: s.cash
    };
    var sum = cf.open + cf.receipts + cf.payroll + cf.vendors + cf.interest + cf.oneoff + cf.wc + cf.fin + cf.repay;
    cf.other = Math.abs(s.cash - sum) > 0.05 ? s.cash - sum : 0;
    rep.cf = cf;
    var mm = FS.metrics(s), sp = FS.support(s), la = s.lastAcq || {}, A = s.chStats || {};
    var churnedMrr = rep.churned * (rep.mrr0 / Math.max(1, mm.customers + rep.churned - rep.newCust));
    var smTotal = m.marketing + pay.sm;
    var fn = {}; s.people.forEach(function (p) { fn[p.fn] = (fn[p.fn] || 0) + 1; });
    rep.mis = {
      mrr: mm.mrr, arr: mm.arr, newMrr: rep.newMrr || 0, churnedMrr: churnedMrr, expansionMrr: (mm.mrr - rep.mrr0) - (rep.newMrr || 0) + churnedMrr,
      customers: mm.customers, newCust: rep.newCust, churned: rep.churned, arpa: mm.arpa, churn: mm.churn, nrr: mm.nrr, grr: Math.pow(1 - mm.churn, 12),
      leads: la.leads || 0, opps: la.opps || 0, worked: la.worked || 0, win: la.win || 0, cap: la.cap || 0,
      cac: rep.newCust ? m.marketing / rep.newCust : 0, cacFull: rep.newCust ? smTotal / rep.newCust : 0,
      payback: rep.newCust && mm.arpa ? (smTotal / rep.newCust) / (mm.arpa * Math.max(0.3, mm.gm)) : 0,
      ltv: mm.churn > 0 ? mm.arpa * Math.max(0.3, mm.gm) / mm.churn : 0,
      burn: mm.burn, bm: mm.bm, runway: mm.runway, cash: s.cash, headcount: mm.headcount, fn: fn,
      revPerHead: mm.arr / Math.max(1, mm.headcount), sla: sp.sla, tickets: sp.tickets, dso: FS.dso(s), ar: s.ar,
      featureWeeks: m.eng.feature, debt: s.product.debt, pmf: s.product.pmf, morale: mm.morale, board: s.board, sec: FS.secScore(s), gm: mm.gm, g3: mm.g3
    };
    s.mtx = {}; s.openCash = s.cash;
  };

  /* =====================================================================
     9. INIT AND MONTHLY HOOKS
     ===================================================================== */
  HK.init = function (s) {
    var P = s.product; P.items = {}; P.ver = {};
    ['usage', 'sso', 'dispatch', 'billing', 'whatsapp', 'analytics', 'selfserve', 'mobile'].forEach(function (id) { makeItem(s, LIBMAP[id]); });
    s.channels = { google: 2, linkedin: 1, meta: 0, events: 0, outbound: 1, content: 1, referral: 0 };
    s.chEff = {}; s.chFat = {}; CH_ORDER.forEach(function (c) { s.chEff[c] = Math.round((0.78 + rng(s) * 0.44) * 100) / 100; s.chFat[c] = 1; });
    s.seo = 10; s.gtm = 'inside'; s.funnel = { qual: 0.5, win: 0.42, act: 0.42 }; s.chStats = {}; s.chCum = {}; s.evLuck = 1;
    syncMkt(s);
    s.exp = { active: [], ready: [], history: [], last: {} };
    s.ops = { done: {}, active: {} };
    s.partners = { offers: [], active: [], closed: {} };
    s.deals = { offer: null, active: [], live: [], lost: [], seen: {} };
    s.sec = 20; s.dso = 40; s.ar = 8 * 40 / 30; s.credits = 0;
    s.goals = {}; s.okrs = []; s.streak = { team: 0, bm: 0 }; s.crises = [];
    s.mtx = {}; s.openCash = s.cash;
  };
  HK.postTick = function (s, rep) {
    resolveExps(s, rep);
    for (var id in s.ops.active) if (s.ops.active[id] <= s.month) finishOps(s, id, rep);
    if (s.flags.mis) s.board = clamp(s.board + 0.3, 0, 95);
    if (s.month >= 4) s.product.pmf = clamp(s.product.pmf - 0.0025, 0.2, 0.92); // rivals catch up
    if (s.month === 12 || s.month === 24) rep.notes.push('Stackline shipped features that close part of your lead. Fit erodes without new product work.');
    s.product.debt = clamp(s.product.debt + s.product.maint * 0.25, 5, 100);
    if (s.flags.adBanUntil && s.flags.adBanUntil === s.month) rep.notes.push('Google lifted the ads suspension. Restore your Google budget in Growth if you want it back.');
    partnerOffers(s, rep);
    dealOffer(s, rep);
    dealTick(s, rep);
    // partner customer churn and renegotiation pressure
    var ch = s.lastChurn || 0.02;
    s.partners.active.forEach(function (p) { p.mrr *= 1 - ch; p.cust *= 1 - ch; });
    var old = liveParts(s).filter(function (p) { return s.month - p.liveAt >= 8 && !p.squeezed; });
    if (old.length && !s.pending.length && rng(s) < 0.1) { var t = old[0]; t.squeezed = true; s.flags.squeezeId = t.id; s.pending.push('pSqueeze'); }
    refreshBacklog(s, rep);
    goalsTick(s, rep);
  };

  FS.channelsTotal = function (s) { return s.marketing; };
  root.FS = FS;
})(typeof window !== 'undefined' ? window : globalThis);
