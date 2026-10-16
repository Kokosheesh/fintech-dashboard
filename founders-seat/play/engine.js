/* Founder's Seat — simulation engine.
   Pure logic, no DOM. All money in ₹ lakh (L). 100 L = ₹1 Cr.
   State is plain JSON so it can be saved and replayed from a seed. */
(function (root) {
  'use strict';
  var FS = {};

  /* ---------- utilities ---------- */
  function rng(s) { // mulberry32, state kept in s.rng
    var t = (s.rng = (s.rng + 0x6D2B79F5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function sround(s, x) { if (x <= 0) return 0; var f = Math.floor(x); return f + (rng(s) < x - f ? 1 : 0); }
  function pick(s, arr) { return arr[Math.floor(rng(s) * arr.length)]; }
  function r1(x) { return Math.round(x * 10) / 10; }
  FS.clamp = clamp;
  function book(s, cat, amt) { s.cash += amt; s.mtx = s.mtx || {}; s.mtx[cat] = (s.mtx[cat] || 0) + amt; }
  var HK = {}; FS._hooks = HK;
  function hk(name) { return HK[name] ? HK[name].apply(null, Array.prototype.slice.call(arguments, 1)) : undefined; }

  /* ---------- static content ---------- */
  var ARCH = {
    technical: { name: 'Technical founder', blurb: 'Ex-engineer. You ship fast and dread sales calls.', focus: { str: 3, ops: 5, ppl: 3 }, prod: 1.12, board: 0, interest: 0, fee: 1 },
    consultant: { name: 'Ex-consultant', blurb: 'Board-ready decks, a sharp model, no code shipped.', focus: { str: 5, ops: 4, ppl: 3 }, prod: 1.06, board: 10, interest: 0.05, fee: 1 },
    serial: { name: 'Second-time founder', blurb: 'A real network, and scar tissue from the first one.', focus: { str: 4, ops: 3, ppl: 4 }, prod: 1.0, board: 4, interest: 0.02, fee: 0.6 }
  };
  FS.ARCH = ARCH;

  var ROLES = {
    eng: { title: 'Engineer', fn: 'eng', salary: 22, skill: [0.85, 1.1], what: 'Ships roadmap work.' },
    seng: { title: 'Senior Engineer', fn: 'eng', salary: 34, skill: [1.2, 1.45], what: 'Ships faster; can become a tech lead.' },
    em: { title: 'Engineering Manager', fn: 'eng', salary: 45, skill: [0.5, 0.7], em: true, what: 'Takes 6 engineers off the CTO\'s plate.' },
    sre: { title: 'DevOps / SRE', fn: 'eng', salary: 30, skill: [0.9, 1.2], what: 'Fewer outages and faster recovery.' },
    sec: { title: 'Security Engineer', fn: 'eng', salary: 38, skill: [0.9, 1.25], what: 'Raises security score; halves SOC 2 time.' },
    pm: { title: 'Product Manager', fn: 'product', salary: 32, skill: [0.85, 1.25], what: 'Better feature impact, +1 experiment slot.' },
    designer: { title: 'Product Designer', fn: 'product', salary: 20, skill: [0.85, 1.2], what: 'Lifts activation and feature adoption.' },
    data: { title: 'Data Analyst', fn: 'product', salary: 18, skill: [0.85, 1.2], what: 'Cleaner experiment reads, +1 experiment slot.' },
    se: { title: 'Sales Executive', fn: 'sales', salary: 9, skill: [0.8, 1.2], what: 'High-volume SMB inside sales. Works ~6.5 deals a month.' },
    ae: { title: 'Account Executive', fn: 'sales', salary: 18, skill: [0.8, 1.2], what: 'Mid-market and larger deals. Works ~4.5 deals a month, wins more.' },
    sdr: { title: 'Sales Development Rep', fn: 'sales', salary: 8, skill: [0.8, 1.2], what: 'Books ~3 outbound leads a month.' },
    hos: { title: 'Head of Sales', fn: 'sales', salary: 55, skill: [1.0, 1.4], hos: true, what: 'Multiplies sales capacity; unlocks Enterprise.' },
    csm: { title: 'Customer Success Manager', fn: 'cs', salary: 16, skill: [0.85, 1.15], what: 'Handles ~90 tickets a month and keeps accounts healthy.' },
    support: { title: 'Support Associate', fn: 'cs', salary: 6, skill: [0.85, 1.15], what: 'Handles ~220 tickets a month.' },
    solutions: { title: 'Solutions Engineer', fn: 'cs', salary: 26, skill: [0.9, 1.25], what: 'Speeds custom enterprise work and wins scoping debates.' },
    mkt: { title: 'Growth Marketer', fn: 'mkt', salary: 20, skill: [0.85, 1.25], what: 'Better content, referral and event returns.' },
    perf: { title: 'Performance Marketer', fn: 'mkt', salary: 22, skill: [0.85, 1.25], what: 'Cheaper paid leads; slows ad fatigue.' },
    pmm: { title: 'Product Marketing Manager', fn: 'mkt', salary: 26, skill: [0.85, 1.25], what: 'Higher win rate and bigger launches.' },
    fin: { title: 'Finance Manager', fn: 'ops', salary: 18, skill: [0.85, 1.2], what: 'Faster collections, fewer compliance surprises.' },
    recruiter: { title: 'In-house Recruiter', fn: 'ops', salary: 12, skill: [0.85, 1.2], what: 'Halves recruiter fees; better candidates.' },
    partner: { title: 'Partnerships Manager', fn: 'ops', salary: 24, skill: [0.85, 1.25], what: 'More partner leads; stronger negotiations.' }
  };
  FS.ROLES = ROLES;

  var NAMES = ['Aarav Shah', 'Isha Kapoor', 'Kabir Malik', 'Neha Gupta', 'Rahul Menon', 'Zoya Ahmed', 'Siddharth Rao', 'Tanvi Desai', 'Varun Iyer', 'Pooja Bhat', 'Arnav Sinha', 'Kavya Nair', 'Manav Chopra', 'Riya Sen', 'Yash Agarwal', 'Diya Joshi', 'Harsh Vardhan', 'Meghna Pillai', 'Omkar Patil', 'Sana Qureshi', 'Tejas Kulkarni', 'Nandini Rao', 'Aditi Verma', 'Imran Khan', 'Lakshmi Prasad', 'Rohit Bansal', 'Shreya Ghosh', 'Vivek Anand', 'Anjali Mehra', 'Dhruv Saxena'];

  var ITEMS = {}; // filled by systems.js
  function item(s, id) { return (s.product.items && s.product.items[id]) || ITEMS[id]; }
  FS.item = item;
  FS.ITEMS = ITEMS;

  var FUNDS = [
    { id: 'kiln', name: 'Kiln Capital', fit: 3, path: 'Warm via Banyan' },
    { id: 'saffron', name: 'Saffron Partners', fit: 3, path: 'Warm via an angel' },
    { id: 'lattice', name: 'Lattice Ventures', fit: 2, path: 'Warm via alumni' },
    { id: 'northbridge', name: 'Northbridge Ventures', fit: 2, path: 'Cold' },
    { id: 'meridian', name: 'Meridian Growth', fit: 1, path: 'Cold' }
  ];
  FS.FUNDS = FUNDS;

  /* ---------- new game ---------- */
  function person(id, name, role, fn, title, salary, skill, morale, extra) {
    var p = { id: id, name: name, role: role, fn: fn, title: title, salary: salary, skill: skill, morale: morale, bias: 0, joined: 0, ramp: 0, equity: 0, lead: false, key: false, founder: false };
    for (var k in extra || {}) p[k] = extra[k];
    return p;
  }

  FS.newGame = function (opts) {
    opts = opts || {};
    var seed = (opts.seed >>> 0) || ((Date.now() % 1000000) >>> 0);
    var arch = ARCH[opts.archetype] ? opts.archetype : 'technical';
    var A = ARCH[arch];
    var s = {
      v: 2, seed: seed, rng: seed, archetype: arch, month: 1, over: false, outcome: null,
      cash: 420, startCash: 420, raisedTotal: 420,
      segments: {
        blr: { name: 'Bengaluru SMB', tam: 160, arpa: 0.16, cust: 20, unlocked: true },
        mum: { name: 'Mumbai SMB', tam: 220, arpa: 0.16, cust: 10, unlocked: true },
        pune: { name: 'Pune SMB', tam: 90, arpa: 0.15, cust: 5, unlocked: true },
        del: { name: 'Delhi mid-market', tam: 80, arpa: 0.42, cust: 0, unlocked: false, cost: 12, str: 2, need: 'Costs ₹12L and 2 Strategy focus.' },
        ent: { name: 'Enterprise', tam: 25, arpa: 1.3, cust: 0, unlocked: false, cost: 8, str: 2, need: 'Needs SSO shipped and a Head of Sales.' },
        sea: { name: 'Southeast Asia', tam: 200, arpa: 0.22, cust: 0, unlocked: false, cost: 40, str: 3, need: 'Needs a Series A and ₹40L.' }
      },
      keys: [
        { id: 'kavya', name: 'Kavya Logistics', mrr: 1.1, active: true },
        { id: 'arvind', name: 'Arvind Freight', mrr: 0.7, active: true },
        { id: 'northline', name: 'Northline Cold Chain', mrr: 0.6, active: true }
      ],
      people: [
        person('you', 'You', 'ceo', 'exec', 'CEO, founder', 24, 1, 85, { founder: true }),
        person('arjun', 'Arjun Rao', 'cto', 'eng', 'CTO, co-founder', 24, 0.5, 74, { founder: true, key: true }),
        person('rohan', 'Rohan Mehta', 'seng', 'eng', 'Senior Backend Engineer', 34, 1.35, 64, { key: true }),
        person('priya', 'Priya Nair', 'seng', 'eng', 'Senior Frontend Engineer', 30, 1.2, 66, { key: true }),
        person('aditya', 'Aditya Kulkarni', 'eng', 'eng', 'Backend Engineer', 22, 1.0, 72),
        person('sneha', 'Sneha Reddy', 'eng', 'eng', 'Backend Engineer', 21, 1.0, 74),
        person('vikram', 'Vikram Joshi', 'eng', 'eng', 'DevOps Engineer', 26, 1.05, 70),
        person('farah', 'Farah Khan', 'eng', 'eng', 'Frontend Engineer', 19, 0.9, 76),
        person('nikhil', 'Nikhil Bose', 'eng', 'eng', 'Full-stack Engineer', 20, 0.75, 63),
        person('ananya', 'Ananya Pillai', 'eng', 'eng', 'QA Engineer', 15, 0.85, 72),
        person('kunal', 'Kunal Sethi', 'ae', 'sales', 'Account Executive', 18, 1.0, 70),
        person('ritu', 'Ritu Tandon', 'se', 'sales', 'Sales Executive', 9, 0.95, 72),
        person('meera', 'Meera Iyer', 'csm', 'cs', 'Head of Customer Success', 20, 1.1, 74, { key: true }),
        person('kabir', 'Kabir Shah', 'ops', 'ops', 'Operations Lead', 14, 1.0, 72)
      ],
      pipeline: [], usedNames: {},
      product: {
        debt: 45, pmf: 0.55, alloc: 10,
        queue: ['usage', 'sso'], backlog: ['dispatch', 'billing', 'whatsapp', 'analytics', 'selfserve', 'mobile'],
        progress: { dispatch: 10 }, shipped: [], shippedAt: {}, incidents: [], items: {}, maint: 0
      },
      marketing: 5, price: 1.0, rent: 3.6, tools: 1.6,
      mods: { cac: 1, churn: 0, expansion: 0.019, organic: 1, sales: 1, infra: 1, incident: 1 },
      temp: [],
      board: 60 + A.board, energy: 75, director: false, boardHistory: [],
      focusMax: { str: A.focus.str, ops: A.focus.ops, ppl: A.focus.ppl },
      focus: { str: A.focus.str, ops: A.focus.ops, ppl: A.focus.ppl },
      cap: { you: 40, arjun: 32, banyan: 15, angels: 8, pool: 5, newInv: 0, bridge: 0 },
      poolUsed: 3.4,
      fund: { status: 'none', start: 0, months: 0, pitched: {}, offer: null, cooldown: 0, raised: false, inflated: false, interest: {} },
      vdebt: { taken: false, principal: 0, start: 0 }, bridge: { used: false },
      flags: {}, fired: {}, scheduled: [], pending: [], news: [],
      log: [], history: [], reports: [], lastReport: null, regretted: 0, quits: 0, layoffs: 0,
      scandal: 0, comp: 1.0
    };
    s.people.forEach(function (p) { s.usedNames[p.name] = true; });
    hk('init', s);
    s.history.push(snapshot(s));
    s.news.push({ m: 1, text: 'You closed a ₹4.2 Cr seed round from Banyan Seed Fund and six angels.' });
    s.news.push({ m: 1, text: 'Stackline, your closest rival, has just raised a $10M Series A.' });
    return s;
  };

  /* ---------- derived metrics ---------- */
  function segMRR(s) { var t = 0; for (var k in s.segments) { var g = s.segments[k]; t += g.cust * g.arpa * s.price; } return t; }
  function keyMRR(s) { return s.keys.reduce(function (a, k) { return a + (k.active ? k.mrr : 0); }, 0); }
  function customers(s) { var t = 0; for (var k in s.segments) t += s.segments[k].cust; return t + s.keys.filter(function (k) { return k.active; }).length; }
  function staff(s, fn) { return s.people.filter(function (p) { return p.fn === fn; }); }
  function roleCount(s, role, includeRamp) { return s.people.filter(function (p) { return p.role === role; }).length; }
  function tempSum(s, key) { return s.temp.reduce(function (a, t) { return a + (t.key === key ? t.v : 0); }, 0); }
  FS.tempSum = tempSum;

  function payroll(s) { return s.people.reduce(function (a, p) { return a + p.salary; }, 0) / 12 * 1.1; }

  FS.metrics = function (s) {
    var mrr = segMRR(s) + keyMRR(s);
    var cust = customers(s);
    var pay = payroll(s);
    var x = hk('extra', s, mrr) || { revShare: 0, otherRev: 0, recurring: 0, credits: 0, infraMult: 1, entInfra: 0 };
    var infraGross = (1.4 + 0.03 * cust + (s.segments.ent.cust * 0.15) + x.entInfra) * (s.mods.infra || 1) * x.infraMult;
    var infra = infraGross - Math.min(x.credits, infraGross);
    var interest = s.vdebt.taken ? s.vdebt.principal * 0.14 / 12 : 0;
    var repay = (s.vdebt.taken && s.month >= s.vdebt.start + 12 && s.vdebt.principal > 0) ? Math.min(s.vdebt.principal, 150 / 18) : 0;
    var other = s.rent + s.tools;
    var costs = pay + infra + other + s.marketing + interest + x.revShare + x.recurring;
    var burn = costs - mrr - x.otherRev; // operating net burn (excl. principal)
    var cashOut = burn + repay;
    var runway = cashOut > 0 ? s.cash / cashOut : Infinity;
    var h = s.history;
    var g3 = 0;
    if (h.length >= 4 && h[h.length - 4].mrr > 0) g3 = Math.pow(mrr / h[h.length - 4].mrr, 1 / 3) - 1;
    else if (h.length >= 2 && h[0].mrr > 0) g3 = Math.pow(mrr / h[0].mrr, 1 / Math.max(1, h.length - 1)) - 1;
    var newMrr3 = h.length >= 4 ? (mrr - h[h.length - 4].mrr) / 3 : (h.length >= 2 ? (mrr - h[0].mrr) / (h.length - 1) : 0.5);
    var bm = newMrr3 > 0.01 ? Math.max(0, burn) / (newMrr3 * 12) : 99;
    var churn = s.lastChurn != null ? s.lastChurn : 0.018;
    var nrrM = 1 + s.mods.expansion + tempSum(s, 'expansion') - churn;
    var nrr = Math.pow(nrrM, 12);
    var gm = mrr > 0 ? (mrr + x.otherRev - infra - x.revShare) / (mrr + x.otherRev) : 0;
    var topKey = s.keys.reduce(function (a, k) { return k.active && k.mrr > a ? k.mrr : a; }, 0);
    var conc = mrr > 0 ? topKey / mrr : 0;
    var people = s.people.filter(function (p) { return !p.founder || p.id === 'arjun'; });
    var morale = people.length ? people.reduce(function (a, p) { return a + p.morale; }, 0) / people.length : 70;
    var arpa = cust ? mrr / cust : 0;
    var cac = HK.cac ? HK.cac(s) : cacEff(s);
    var payback = arpa > 0 ? cac / (arpa * Math.max(0.3, gm)) : 99;
    var eng = engineering(s);
    var you = s.cap.you;
    return {
      mrr: mrr, arr: mrr * 12, customers: cust, payroll: pay, infra: infra, interest: interest, repay: repay, other: other,
      marketing: s.marketing, costs: costs, burn: burn, cashOut: cashOut, runway: runway, g3: g3, bm: bm, churn: churn, nrr: nrr,
      gm: gm, conc: conc, morale: morale, headcount: s.people.length, arpa: arpa, cac: cac, payback: payback, eng: eng, you: you,
      infraGross: infraGross, credits: infraGross - infra, revShare: x.revShare, otherRev: x.otherRev, recurring: x.recurring
    };
  };

  function cacEff(s) {
    var comp = 1 + tempSum(s, 'comp');
    var pmfMult = 1.3 - s.product.pmf * 0.6;
    var mkt = staff(s, 'mkt').reduce(function (a, p) { return a + 0.12 * p.skill * rampF(p); }, 0);
    return 1.6 * s.mods.cac * comp * pmfMult * (1 + tempSum(s, 'cac')) / (1 + Math.min(0.3, mkt));
  }

  function rampF(p) { return p.ramp > 0 ? 0.5 : 1; }

  FS.salesInfo = function (s) {
    var aes = s.people.filter(function (p) { return p.role === 'ae'; });
    var hos = s.people.filter(function (p) { return p.role === 'hos'; })[0];
    var cap = aes.reduce(function (a, p) { return a + 2.6 * p.skill * rampF(p); }, 0) * (hos ? 1 + 0.3 * hos.skill * rampF(hos) : 1) * s.mods.sales;
    var cac = cacEff(s);
    var leads = s.marketing / cac;
    return { cap: cap, cac: cac, leads: leads, paid: Math.min(cap, leads), organic: s.mods.organic * s.product.pmf * 1.8 + (s.flags.reseller > s.month ? 2 : 0), bottleneck: leads > cap ? 'sales' : 'marketing' };
  };

  function engineering(s) {
    var engs = staff(s, 'eng');
    var cap = 0, m = 0, n = 0, leads = 0, ems = 0;
    engs.forEach(function (p) {
      var share = p.role === 'cto' ? 0.5 : (p.role === 'em' ? 0.4 : p.role === 'sre' ? 0.3 : p.role === 'sec' ? 0.2 : 1);
      cap += 4 * p.skill * share * rampF(p) / (p.role === 'cto' || p.role === 'em' ? p.skill : 1) * (p.role === 'cto' || p.role === 'em' ? 1 : 1);
      m += p.morale; n++;
      if (p.lead) leads++;
      if (p.role === 'em') ems++;
    });
    var ics = engs.filter(function (p) { return p.role !== 'cto' && p.role !== 'em'; }).length;
    var maint = s.product.maint || 0;
    var reports = ics - leads * 4 - ems * 6;
    var span = reports > 7 ? 1 - 0.03 * (reports - 7) : 1;
    var avgM = n ? m / n : 70;
    var A = ARCH[s.archetype];
    var prod = (1 - s.product.debt / 220) * (0.65 + 0.35 * avgM / 100) * span * A.prod * (1 + tempSum(s, 'prod'));
    var bugTax = s.product.debt / 100 * 0.35;
    var usable = cap * prod * (1 - bugTax);
    var feat = Math.max(0, usable * (1 - s.product.alloc / 100) - maint);
    return { raw: cap, prod: prod, bugTax: bugTax, usable: usable, feature: feat, maint: Math.min(maint, usable * (1 - s.product.alloc / 100)), debtWeeks: usable * s.product.alloc / 100, reports: reports, span: span, ics: ics };
  }

  function snapshot(s) {
    var m = FS.metrics(s);
    return { m: s.month, cash: r1(s.cash), mrr: Math.round(m.mrr * 100) / 100, burn: r1(m.burn), payroll: r1(m.payroll), infra: r1(m.infra), other: r1(m.other), mkt: r1(m.marketing), interest: r1(m.interest), customers: m.customers, morale: Math.round(m.morale), board: Math.round(s.board), debt: Math.round(s.product.debt), head: s.people.length };
  }

  /* ---------- logging & quality ---------- */
  function logDecision(s, src, title, choice, q, why) {
    s.log.push({ m: s.month, src: src, title: title, choice: choice, q: Math.round(clamp(q, 0, 100)), why: why });
  }
  function news(s, text) { s.news.unshift({ m: s.month, text: text }); if (s.news.length > 30) s.news.length = 30; }
  function addTemp(s, key, v, months) { s.temp.push({ key: key, v: v, until: s.month + months }); }

  function spend(s, cost) {
    cost = cost || {};
    var f = s.focus;
    if ((cost.str || 0) > f.str || (cost.ops || 0) > f.ops || (cost.ppl || 0) > f.ppl) return 'Not enough Founder Focus this month.';
    if ((cost.cash || 0) > 0 && cost.cash > s.cash) return 'Not enough cash.';
    f.str -= cost.str || 0; f.ops -= cost.ops || 0; f.ppl -= cost.ppl || 0;
    if (cost.cash) book(s, cost.cat || 'Other one-offs', -cost.cash);
    s.spentThisMonth = (s.spentThisMonth || 0) + (cost.str || 0) + (cost.ops || 0) + (cost.ppl || 0);
    return null;
  }
  FS.canAfford = function (s, cost) {
    cost = cost || {};
    return (cost.str || 0) <= s.focus.str && (cost.ops || 0) <= s.focus.ops && (cost.ppl || 0) <= s.focus.ppl && (cost.cash || 0) <= s.cash;
  };

  function runwayQ(rw, good) { // generic: quality of an action given runway bands
    for (var i = 0; i < good.length; i++) if (rw >= good[i][0]) return good[i][1];
    return good[good.length - 1][1];
  }

  /* ---------- player actions ---------- */
  var ACT = {};

  ACT.setMarketing = function (s, p) {
    var v = clamp(Math.round(p.value), 0, 25);
    s.marketing = v; return { ok: true };
  };
  ACT.setAlloc = function (s, p) { s.product.alloc = clamp(Math.round(p.value), 0, 50); return { ok: true }; };

  ACT.price = function (s, p) {
    if (s.flags.priceMonth === s.month) return { ok: false, msg: 'One price change per month.' };
    var err = spend(s, { str: 1 }); if (err) return { ok: false, msg: err };
    var m = FS.metrics(s);
    var up = p.dir === 'up';
    s.price *= up ? 1.1 : 0.9;
    s.flags.priceMonth = s.month;
    if (up) { addTemp(s, 'churn', 0.012 * (1.2 - s.product.pmf), 2); addTemp(s, 'cac', 0.08, 3); }
    else { addTemp(s, 'cac', -0.12, 4); addTemp(s, 'churn', -0.003, 3); }
    var q = up ? (s.product.pmf >= 0.6 || m.payback > 14 ? 72 : 52) : (m.runway < 9 ? 25 : 45);
    logDecision(s, 'Finance', 'Pricing', up ? 'Raised prices 10%' : 'Cut prices 10%', q,
      up ? (q > 60 ? 'Fit and payback justified a price rise; short-term churn was a fair cost.' : 'With modest fit, a price rise mostly buys churn.') :
        'Price cuts rarely fix a growth problem and they shrink revenue you cannot spare.');
    return { ok: true, msg: up ? 'Prices up 10%. Expect some churn for two months.' : 'Prices down 10%. Cheaper to acquire, less revenue per account.' };
  };

  ACT.ventureDebt = function (s) {
    var m = FS.metrics(s);
    if (s.vdebt.taken) return { ok: false, msg: 'Already drawn.' };
    if (m.arr < 90) return { ok: false, msg: 'Lenders want ₹90L+ ARR.' };
    if (m.runway < 4) return { ok: false, msg: 'Lenders will not lend below 4 months of runway.' };
    var err = spend(s, { str: 1 }); if (err) return { ok: false, msg: err };
    s.vdebt = { taken: true, principal: 150, start: s.month };
    book(s, 'Debt drawn', 150);
    var q = s.fund.status === 'active' || s.fund.raised ? 80 : (m.runway >= 6 && m.runway <= 12 ? 70 : 50);
    logDecision(s, 'Capital', 'Venture debt', 'Drew ₹1.5 Cr at 14%', q, q >= 70 ? 'Debt extended runway while equity was in motion, which is what it is for.' : 'Debt without a plan to raise or reach profit only delays the cliff.');
    news(s, 'You drew ₹1.5 Cr of venture debt at 14% a year.');
    return { ok: true, msg: '₹1.5 Cr drawn. Interest ₹1.75L a month; repayments start in 12 months.' };
  };

  ACT.bridge = function (s) {
    if (s.bridge.used) return { ok: false, msg: 'Banyan has already bridged you once.' };
    if (s.board < 45) return { ok: false, msg: 'Board confidence is too low for Banyan to bridge you.' };
    var err = spend(s, { str: 1 }); if (err) return { ok: false, msg: err };
    var m = FS.metrics(s);
    var pre = Math.max(30, m.arr / 100 * 8) * 100; // in L
    var amt = 150, d = amt / (pre + amt);
    dilute(s, d, 'bridge');
    book(s, 'Equity raised', amt); s.raisedTotal += amt; s.bridge.used = true; s.board -= 4;
    logDecision(s, 'Capital', 'Bridge round', 'Took ₹1.5 Cr from Banyan', m.runway < 4 ? 70 : 55, m.runway < 4 ? 'A bridge from an insider kept the company alive.' : 'A bridge signals weakness to new investors; better used only when needed.');
    news(s, 'Banyan Seed Fund bridged you with ₹1.5 Cr.');
    return { ok: true, msg: 'Bridge closed: ₹1.5 Cr at ' + (d * 100).toFixed(1) + '% dilution.' };
  };

  function dilute(s, d, into) {
    ['you', 'arjun', 'banyan', 'angels', 'pool', 'newInv', 'bridge'].forEach(function (k) { s.cap[k] *= (1 - d); });
    s.poolUsed *= (1 - d);
    s.cap[into] += d * 100;
  }

  ACT.startRaise = function (s) {
    if (s.fund.raised) return { ok: false, msg: 'Series A already closed.' };
    if (s.fund.status === 'active') return { ok: false, msg: 'Already raising.' };
    if (s.fund.cooldown > s.month) return { ok: false, msg: 'Investors want to see progress first. Try again in month ' + s.fund.cooldown + '.' };
    var err = spend(s, { str: 2 }); if (err) return { ok: false, msg: err };
    var m = FS.metrics(s);
    s.fund.status = 'active'; s.fund.start = s.month; s.fund.months = 0; s.fund.pitched = {}; s.fund.offer = null;
    var q = runwayQ(m.runway, [[16, 62], [9, 90], [7, 72], [5, 48], [0, 25]]);
    logDecision(s, 'Capital', 'Series A', 'Started the raise at ' + (isFinite(m.runway) ? m.runway.toFixed(1) : '∞') + ' months of runway', q,
      q >= 85 ? 'Raises take 4–6 months. Starting with 9+ months left preserved leverage.' : q >= 70 ? 'Slightly late: leverage drops as runway shrinks.' : q >= 60 ? 'Early: metrics were not yet at their best.' : 'Late: investors can see the cliff and price it in.');
    s.board += 3;
    news(s, 'You kicked off your Series A process.');
    return { ok: true, msg: 'Raise started. It costs 1 Strategy focus each month while active.' };
  };

  ACT.pitch = function (s, p) {
    if (s.fund.status !== 'active') return { ok: false, msg: 'Start the raise first.' };
    var n = s.fund.pitched[p.fund] || 0;
    if (n >= 2) return { ok: false, msg: 'You have already met them twice.' };
    var err = spend(s, { str: 1 }); if (err) return { ok: false, msg: err };
    s.fund.pitched[p.fund] = n + 1;
    var f = FUNDS.filter(function (x) { return x.id === p.fund; })[0];
    return { ok: true, msg: (n ? 'Partner meeting' : 'First meeting') + ' with ' + f.name + ' done.' };
  };

  ACT.acceptOffer = function (s, p) {
    var o = s.fund.offer; if (!o) return { ok: false, msg: 'No term sheet.' };
    var amt = o.options[p.idx || 0];
    if (s.fund.inflated && rng(s) < 0.5) {
      s.fund.status = 'failed'; s.fund.offer = null; s.fund.cooldown = s.month + 3;
      s.board -= 22; s.scandal += 1;
      logDecision(s, 'Capital', 'Diligence', 'Inflated metrics caught in diligence', 5, 'The deck flattered ARR; diligence found it, and the term sheet was withdrawn.');
      news(s, o.fund + ' withdrew its term sheet after diligence found inflated metrics.');
      return { ok: true, msg: 'Diligence found the inflated ARR. ' + o.fund + ' withdrew the term sheet.' };
    }
    var d = amt / (o.pre + amt);
    s.fund.dil = d;
    dilute(s, d, 'newInv');
    book(s, 'Equity raised', amt); s.raisedTotal += amt;
    s.fund.status = 'closed'; s.fund.raised = true; s.fund.offer = null; s.fund.closedAt = s.month; s.fund.post = o.pre + amt;
    s.board = Math.min(95, s.board + 14);
    s.flags.seriesA = true;
    var m = FS.metrics(s);
    var q = d <= 0.25 ? 85 : d <= 0.3 ? 70 : 55;
    logDecision(s, 'Capital', 'Series A', 'Raised ₹' + (amt / 100).toFixed(1) + ' Cr at ₹' + (o.pre / 100).toFixed(1) + ' Cr pre-money', q,
      q >= 80 ? 'Enough runway without giving away too much.' : 'Dilution above 25% is costly; a smaller round or better metrics would have helped.');
    news(s, 'Series A closed: ₹' + (amt / 100).toFixed(1) + ' Cr led by ' + o.fund + '.');
    return { ok: true, msg: 'Series A closed. ₹' + (amt / 100).toFixed(1) + ' Cr in the bank; you now own ' + s.cap.you.toFixed(1) + '%.' };
  };
  ACT.declineOffer = function (s) {
    if (!s.fund.offer) return { ok: false };
    var o = s.fund.offer; s.fund.offer = null; s.fund.status = 'active';
    logDecision(s, 'Capital', 'Series A', 'Declined ' + o.fund + "'s term sheet", FS.metrics(s).runway > 9 ? 55 : 20, FS.metrics(s).runway > 9 ? 'Holding out can work with runway to spare.' : 'Declining money with little runway left is a big bet.');
    return { ok: true, msg: 'Declined. The process continues.' };
  };

  ACT.director = function (s) {
    if (s.director) return { ok: false, msg: 'Seat already filled.' };
    var err = spend(s, { str: 1 }); if (err) return { ok: false, msg: err };
    s.director = true; s.board = Math.min(95, s.board + 6);
    s.cap.pool -= 0.25; s.poolUsed += 0.25;
    logDecision(s, 'Capital', 'Board', 'Recruited an independent director', 75, 'An independent voice steadies the board and helps in a raise.');
    news(s, 'Lata Krishnan, ex-COO of a listed logistics firm, joins your board as an independent director.');
    return { ok: true, msg: 'Lata Krishnan joins the board. Board confidence +6.' };
  };

  ACT.enter = function (s, p) {
    var g = s.segments[p.seg];
    if (!g || g.unlocked) return { ok: false };
    if (p.seg === 'ent' && !(s.product.shipped.indexOf('sso') >= 0 && roleCount(s, 'hos') > 0)) return { ok: false, msg: g.need };
    if (p.seg === 'sea' && !s.fund.raised) return { ok: false, msg: g.need };
    var err = spend(s, { str: g.str, cash: g.cost, cat: 'Market entry' }); if (err) return { ok: false, msg: err };
    g.unlocked = true; g.enteredAt = s.month;
    var m = FS.metrics(s);
    var q = p.seg === 'del' ? (roleCount(s, 'ae') >= 3 ? 72 : 55) : p.seg === 'sea' ? (m.runway > 18 ? 65 : 40) : 75;
    if (m.runway < 7) q -= 20;
    logDecision(s, 'Market', 'Expansion', 'Entered ' + g.name, q, q >= 65 ? 'Expansion was resourced and timed with runway to spare.' : 'Expanding while stretched splits focus and cash.');
    news(s, 'You entered ' + g.name + '.');
    return { ok: true, msg: 'Entered ' + g.name + '.' };
  };

  ACT.queue = function (s, p) { // move item: to queue / backlog / up / down
    var P = s.product, id = p.id;
    function rm(a) { var i = a.indexOf(id); if (i >= 0) a.splice(i, 1); }
    if (p.op === 'add') { if (P.queue.indexOf(id) < 0) { rm(P.backlog); P.queue.push(id); } }
    else if (p.op === 'remove') { rm(P.queue); if (P.backlog.indexOf(id) < 0) P.backlog.unshift(id); }
    else if (p.op === 'up' || p.op === 'down') {
      var i = P.queue.indexOf(id), j = p.op === 'up' ? i - 1 : i + 1;
      if (i >= 0 && j >= 0 && j < P.queue.length) { var t = P.queue[i]; P.queue[i] = P.queue[j]; P.queue[j] = t; }
    }
    return { ok: true };
  };

  /* hiring */
  ACT.candidates = function (s, p) {
    var R = ROLES[p.role]; if (!R) return { ok: false };
    var out = [];
    for (var i = 0; i < 3; i++) {
      var tier = i; // 0 cheap/raw, 1 balanced, 2 premium
      var skill = R.skill[0] + (R.skill[1] - R.skill[0]) * (0.15 + 0.35 * tier + rng(s) * 0.3) + (hk('candBonus', s) || 0);
      var salary = Math.round(R.salary * (0.82 + 0.2 * tier + rng(s) * 0.1));
      var name; var guard = 0;
      do { name = pick(s, NAMES); guard++; } while (s.usedNames[name] && guard < 50);
      var notes = ['Hungry, needs coaching.', 'Steady, strong references.', 'Top of market; others are bidding.'];
      out.push({ name: name, role: p.role, title: R.title, salary: salary, skill: Math.round(skill * 100) / 100, note: notes[tier], ramp: tier === 2 ? 1 : 2 });
    }
    return { ok: true, list: out };
  };
  FS.hireFee = function (s, c) { return Math.round(c.salary * 0.12 * ARCH[s.archetype].fee * (hk('feeMult', s) || 1) * 10) / 10; };
  ACT.hire = function (s, p) {
    var c = p.cand; var R = ROLES[c.role];
    if (c.role === 'hos' && (roleCount(s, 'hos') > 0 || s.pipeline.some(function (x) { return x.role === 'hos'; }))) return { ok: false, msg: 'You already have a Head of Sales.' };
    var fee = FS.hireFee(s, c);
    var err = spend(s, { ppl: 1, cash: fee, cat: 'Recruiting fees' }); if (err) return { ok: false, msg: err };
    s.usedNames[c.name] = true;
    s.pipeline.push({ name: c.name, role: c.role, title: c.title, salary: c.salary, skill: c.skill, ramp: c.ramp, arrive: s.month + 1 });
    var m = FS.metrics(s);
    var revenueRole = ['ae', 'se', 'sdr', 'hos', 'csm', 'support', 'mkt', 'perf', 'pmm', 'solutions', 'partner'].indexOf(c.role) >= 0;
    var q;
    if (m.runway < 5) q = revenueRole ? 40 : 18;
    else if (m.runway < 8) q = revenueRole ? 62 : 45;
    else q = 70;
    if (c.role === 'csm' && m.customers / Math.max(1, staff(s, 'cs').length) > 30) q += 12;
    if (c.role === 'em' && engineering(s).reports > 8) q += 15;
    if (c.role === 'hos' && s.product.shipped.indexOf('sso') >= 0) q += 10;
    if ((c.role === 'eng' || c.role === 'seng') && s.product.debt > 65) q -= 10;
    logDecision(s, 'Team', 'Hiring', 'Hired ' + c.title + ' at ₹' + c.salary + 'L', q,
      q >= 70 ? 'The hire matched a real bottleneck with runway to pay for it.' : q >= 50 ? 'Defensible, but runway made every fixed cost riskier.' : 'Adding fixed cost this close to the cliff cut options.');
    return { ok: true, msg: c.name + ' accepted. Starts next month (recruiter fee ₹' + fee + 'L).' };
  };

  function findP(s, id) { return s.people.filter(function (p) { return p.id === id; })[0]; }
  FS.findP = findP;

  ACT.raise = function (s, p) {
    var x = findP(s, p.id); if (!x || x.founder) return { ok: false };
    var err = spend(s, { ppl: 1 }); if (err) return { ok: false, msg: err };
    var inc = Math.round(x.salary * 0.18);
    x.salary += inc; x.morale = Math.min(95, x.morale + 18); x.bias = Math.min(10, x.bias + 6); x.offer = false;
    var m = FS.metrics(s);
    var q = (x.key || x.skill >= 1.15) ? (m.runway > 5 ? 82 : 60) : (x.morale < 50 ? 55 : 35);
    logDecision(s, 'Team', 'Retention', 'Raised ' + x.name + "'s pay by ₹" + inc + 'L', q, q >= 70 ? 'Keeping a high performer is far cheaper than replacing them.' : 'Pay rises for average performers set a costly precedent.');
    addTemp(s, 'teamMorale', -1.5, 2); // others notice
    return { ok: true, msg: x.name + ' gets +₹' + inc + 'L. Morale up.' };
  };
  ACT.esop = function (s, p) {
    var x = findP(s, p.id); if (!x || x.founder) return { ok: false };
    if (s.cap.pool - s.poolUsed < 0.25) return { ok: false, msg: 'ESOP pool is empty.' };
    var err = spend(s, { ppl: 1 }); if (err) return { ok: false, msg: err };
    s.poolUsed += 0.25; x.equity += 0.25; x.morale = Math.min(95, x.morale + 12); x.bias = Math.min(10, x.bias + 5); x.offer = false;
    logDecision(s, 'Team', 'Retention', 'Granted ' + x.name + ' 0.25% ESOP', (x.key || x.skill >= 1.15) ? 80 : 50, (x.key || x.skill >= 1.15) ? 'Equity aligns a key person without adding burn.' : 'The pool is finite; better saved for critical people.');
    return { ok: true, msg: x.name + ' receives 0.25% in options.' };
  };
  ACT.promote = function (s, p) {
    var x = findP(s, p.id); if (!x || x.fn !== 'eng' || x.lead || x.founder || x.role === 'em') return { ok: false };
    if (x.skill < 1.15) return { ok: false, msg: 'Only strong senior engineers can lead.' };
    var err = spend(s, { ppl: 2 }); if (err) return { ok: false, msg: err };
    x.lead = true; x.salary += 6; x.title = 'Tech Lead'; x.morale = Math.min(95, x.morale + 15); x.bias += 4; x.offer = false;
    var e = engineering(s);
    logDecision(s, 'Team', 'Org design', 'Promoted ' + x.name + ' to tech lead', e.reports + 4 > 7 ? 85 : 55, e.reports + 4 > 7 ? 'It cut the CTO\'s span of control, which was dragging velocity.' : 'Useful for retention, less so for structure.');
    return { ok: true, msg: x.name + ' now leads 4 engineers.' };
  };
  ACT.fire = function (s, p) {
    var x = findP(s, p.id); if (!x || x.founder) return { ok: false };
    var err = spend(s, { ppl: 1 }); if (err) return { ok: false, msg: err };
    var sev = Math.round(x.salary / 12 * 10) / 10;
    book(s, 'Severance', -sev);
    s.people = s.people.filter(function (q) { return q.id !== x.id; });
    var low = x.skill < 0.85;
    addTemp(s, 'teamMorale', low ? -3 : -7, 3);
    s.layoffs++;
    var m = FS.metrics(s);
    var q = low ? 70 : (m.runway < 7 ? 60 : 30);
    if (x.key) q -= 25;
    logDecision(s, 'Team', 'Exit', 'Let ' + x.name + ' go', q, low ? 'Acting on clear under-performance protects the bar.' : m.runway < 7 ? 'A painful but defensible cost cut.' : 'Losing a solid performer without a burn emergency cost morale for little gain.');
    news(s, x.name + ' (' + x.title + ') has left the company.');
    if (s.layoffs >= 3 && !s.flags.layoffPress) { s.flags.layoffPress = true; s.pending.push('journalist'); }
    return { ok: true, msg: x.name + ' has been let go (severance ₹' + sev + 'L).' };
  };
  ACT.offsite = function (s) {
    var err = spend(s, { ops: 1, cash: 6, cat: 'Team & culture' }); if (err) return { ok: false, msg: err };
    addTemp(s, 'teamMorale', 6, 3);
    var m = FS.metrics(s);
    logDecision(s, 'Team', 'Culture', 'Ran a team offsite', m.morale < 65 ? 72 : 50, m.morale < 65 ? 'Morale was slipping; a reset was worth ₹6L.' : 'Nice to have; the money had better uses.');
    return { ok: true, msg: 'Offsite booked. Morale lifts for three months.' };
  };
  ACT.rest = function (s) {
    if (s.flags.restMonth === s.month) return { ok: false, msg: 'Already resting.' };
    s.flags.restMonth = s.month;
    s.energy = Math.min(100, s.energy + 28);
    s.focus.ops = 0; s.focus.str = Math.max(0, s.focus.str - 1);
    logDecision(s, 'Founder', 'Energy', 'Took a week off', s.energy < 70 ? 78 : 40, s.energy < 70 ? 'Rest before burnout protects every later decision.' : 'Energy was fine; the focus was better spent.');
    return { ok: true, msg: 'You take a week off. Energy +28; Ops focus is gone for this month.' };
  };

  FS.act = function (s, name, params) {
    if (s.over) return { ok: false, msg: 'The game is over.' };
    if (!ACT[name]) return { ok: false, msg: 'Unknown action' };
    return ACT[name](s, params || {});
  };

  /* ---------- events ---------- */
  var EV = {};
  function keyActive(s, id) { var k = s.keys.filter(function (k) { return k.id === id; })[0]; return k && k.active; }
  function churnKey(s, id) {
    var k = s.keys.filter(function (k) { return k.id === id; })[0];
    if (k && k.active) { k.active = false; news(s, k.name + ' did not renew. MRR −₹' + k.mrr.toFixed(2) + 'L.'); return true; }
    return false;
  }

  EV.kavya = {
    title: 'Your largest customer wants a custom module.',
    tag: 'CUSTOMERS',
    when: function (s) { return s.month >= 5 && keyActive(s, 'kavya') && s.product.shipped.indexOf('dispatch') < 0; },
    w: 9, once: true,
    body: function (s) {
      var m = FS.metrics(s);
      return 'Kavya Logistics (' + Math.round(1.1 / m.mrr * 100) + '% of MRR) will renew only if you ship their dispatch integration within three months. Their head of operations told Meera directly.';
    },
    quotes: [['Six weeks on this means SSO slips a full quarter.', 'Arjun Rao, CTO'], ['They will churn without it. Two other logistics accounts want the same thing.', 'Meera Iyer, Customer Success']],
    choices: [
      { label: 'Build it. Keep the logo.', effect: 'Dispatch jumps to the top of the roadmap. Kavya renews if it ships within 3 months.', cost: { ops: 2 },
        apply: function (s) { var P = s.product; P.queue = P.queue.filter(function (x) { return x !== 'dispatch'; }); P.backlog = P.backlog.filter(function (x) { return x !== 'dispatch'; }); P.queue.unshift('dispatch'); s.flags.kavyaDeadline = s.month + 3; },
        q: function (s) { var m = FS.metrics(s); return m.conc > 0.1 ? 78 : 60; }, why: 'With one customer above 10% of MRR, protecting it while the build also serves a segment was sound.' },
      { label: 'Offer a paid services engagement', effect: '+₹6L now; a partner builds it. Renewal is not guaranteed.', cost: { str: 1 },
        apply: function (s) { book(s, 'Services income', 6); s.scheduled.push({ m: s.month + 2, fx: 'kavyaServices' }); },
        q: function () { return 60; }, why: 'Monetising a custom ask is reasonable, but it leaves the renewal to chance.' },
      { label: 'Decline. Protect the roadmap.', effect: 'Roadmap stays on track; team morale +3. High churn risk.', cost: {},
        apply: function (s) { addTemp(s, 'teamMorale', 3, 2); s.scheduled.push({ m: s.month + 1, fx: 'kavyaDecline' }); },
        q: function (s) { var m = FS.metrics(s); return m.conc > 0.12 ? 35 : 60; }, why: 'Walking away from a customer this large was a concentration risk you did not need to take.' }
    ]
  };

  EV.rohanOffer = {
    title: 'Rohan has a competing offer.', tag: 'TEAM',
    when: function (s) { var r = findP(s, 'rohan'); return s.month >= 3 && r && r.morale < 70; }, w: 6, once: true,
    body: function () { return 'Stackline has offered Rohan Mehta ₹44L and 0.2% equity. He owns the billing service and half the dispatch module. He hasn\'t told Arjun yet.'; },
    quotes: [['He knows billing better than anyone. If he goes, the next three months of incidents are ours.', 'Arjun Rao, CTO']],
    choices: [
      { label: 'Counter at ₹42L', effect: '+₹0.7L a month in payroll. He likely stays.', cost: { ppl: 1 },
        apply: function (s) { var r = findP(s, 'rohan'); if (r) { r.salary = 42; r.morale = 82; r.bias = 6; } },
        q: function (s) { return FS.metrics(s).runway > 5 ? 80 : 55; }, why: 'Replacing a key engineer costs months of velocity; the counter was cheap by comparison.' },
      { label: 'Offer 0.3% ESOP instead of cash', effect: 'No burn. He may still leave.', cost: { ppl: 1 },
        apply: function (s) { var r = findP(s, 'rohan'); if (r) { r.equity += 0.3; s.poolUsed += 0.3; r.morale = 74; r.bias = 3; } s.scheduled.push({ m: s.month + 1, fx: 'rohanMaybe', data: 0.3 }); },
        q: function () { return 68; }, why: 'Equity preserves cash but is worth less to someone with a firm cash offer.' },
      { label: 'Let him go', effect: 'Saves pay. Billing knowledge walks out the door.', cost: {},
        apply: function (s) { leave(s, 'rohan', true); s.product.debt = Math.min(100, s.product.debt + 6); },
        q: function () { return 22; }, why: 'Losing the owner of your most fragile system raised debt and incident risk.' }
    ]
  };

  EV.pricecut = {
    title: 'Stackline cuts prices by 40%.', tag: 'COMPETITION',
    when: function (s) { return s.month >= 6; }, w: 4, once: true,
    body: function () { return 'Flush with Series A money, Stackline has cut prices 40% for teams under 20 seats. Three of your prospects have gone quiet.'; },
    quotes: [['We can\'t win a price war against $10M. We can win on dispatch accuracy.', 'Kunal Sethi, Account Executive']],
    choices: [
      { label: 'Match on new deals', effect: 'New-customer pricing −15%; win rate holds.', cost: { str: 1 },
        apply: function (s) { s.price *= 0.94; addTemp(s, 'comp', 0.05, 4); },
        q: function (s) { return s.product.pmf < 0.55 ? 55 : 35; }, why: 'Matching a better-funded rival on price trains customers to buy on price.' },
      { label: 'Hold price and sell value', effect: 'CAC +25% for four months; ARPA protected.', cost: { str: 1 },
        apply: function (s) { addTemp(s, 'comp', 0.25, 4); },
        q: function (s) { return s.product.pmf >= 0.55 ? 75 : 55; }, why: 'With decent fit, holding price kept unit economics intact through a temporary squeeze.' },
      { label: 'Launch a stripped-down cheaper tier', effect: 'Costs 6 eng-weeks; protects the low end.', cost: { ops: 1 },
        apply: function (s) { addTemp(s, 'comp', 0.08, 4); s.product.progress.__tax = (s.product.progress.__tax || 0) + 6; s.price *= 0.97; },
        q: function () { return 65; }, why: 'Segmenting price is a reasonable response, at an engineering cost.' }
    ]
  };

  EV.outage = {
    title: 'SEV-1: invoices failed to send for 47 minutes.', tag: 'PRODUCT',
    when: function (s) { return s.product.debt > 50 && s.month >= 2; }, w: function (s) { return (s.product.debt - 40) / 10; },
    body: function () { return 'The billing service fell over during month-end runs. Twelve customers noticed; two have emailed you directly.'; },
    quotes: [['This is the third billing incident this quarter. It will happen again.', 'Vikram Joshi, DevOps']],
    choices: [
      { label: 'Public post-mortem and service credits', effect: '−₹1.5L credits; trust recovers.', cost: { ops: 1, cash: 1.5, cat: 'Crisis costs' },
        apply: function (s) { addTemp(s, 'churn', 0.002, 1); },
        q: function () { return 75; }, why: 'Owning an outage openly limits churn and builds trust.' },
      { label: 'Fix quietly, say little', effect: 'No cost now. Churn risk rises.', cost: {},
        apply: function (s) { addTemp(s, 'churn', 0.008, 2); },
        q: function () { return 35; }, why: 'Silence after customers noticed raised churn.' },
      { label: 'Emergency debt sprint (40% to debt for 2 months)', effect: 'Features slow; debt falls.', cost: { ops: 1 },
        apply: function (s) { s.flags.sprintUntil = s.month + 2; s.flags.sprintPrev = s.product.alloc; s.product.alloc = 40; addTemp(s, 'churn', 0.003, 1); },
        q: function (s) { return s.product.debt > 60 ? 82 : 62; }, why: 'Treating the cause, not the symptom, was right with debt this high.' }
    ]
  };
  EV.outage.once = false;

  EV.rewrite = {
    title: 'Arjun wants to rewrite the stack.', tag: 'CO-FOUNDER',
    when: function (s) { return s.product.debt > 55 && s.month >= 8; }, w: 3, once: true,
    body: function () { return 'Arjun says the monolith is beyond saving and wants to rewrite it in a new stack. He estimates four months with most of the team. He is frustrated and wants your support.'; },
    quotes: [['If we don\'t do this now, we never will.', 'Arjun Rao, CTO']],
    choices: [
      { label: 'Approve the rewrite', effect: '4 months at 70% debt allocation; debt falls hard. Arjun is thrilled.', cost: { ops: 2 },
        apply: function (s) { s.flags.sprintUntil = s.month + 4; s.flags.sprintPrev = s.product.alloc; s.product.alloc = 70; var a = findP(s, 'arjun'); if (a) { a.morale = 90; } },
        q: function (s) { return FS.metrics(s).runway > 12 ? 55 : 25; }, why: 'Big-bang rewrites stall growth; it only makes sense with long runway.' },
      { label: 'Compromise: 30% to debt for 3 months', effect: 'Steady improvement; Arjun is lukewarm.', cost: { ppl: 1 },
        apply: function (s) { s.flags.sprintUntil = s.month + 3; s.flags.sprintPrev = s.product.alloc; s.product.alloc = 30; var a = findP(s, 'arjun'); if (a) a.morale = Math.max(a.morale, 72); },
        q: function () { return 82; }, why: 'Incremental debt work balanced the CTO\'s concern against growth.' },
      { label: 'Say no; growth comes first', effect: 'Roadmap untouched. Arjun\'s morale drops sharply.', cost: {},
        apply: function (s) { var a = findP(s, 'arjun'); if (a) { a.morale = 45; a.bias = -8; } s.flags.arjunUpset = s.month; },
        q: function () { return 30; }, why: 'Dismissing your co-founder on a real problem strained the most important relationship in the company.' }
    ]
  };

  EV.grey = {
    title: 'An advisor suggests "annualising" your best month.', tag: 'ETHICS',
    when: function (s) { return s.fund.status === 'active' && s.fund.months >= 1; }, w: 6, once: true,
    body: function () { return 'Your deck could quote ARR as your best week × 52, which reads about 25% higher. "Everyone does it," says an advisor.'; },
    quotes: [],
    choices: [
      { label: 'Use the flattering number', effect: 'Investor interest up now.', cost: {},
        apply: function (s) { s.fund.inflated = true; },
        q: function () { return 5; }, why: 'Inflated metrics are a diligence time bomb and an integrity breach.' },
      { label: 'Report true ARR', effect: 'No change.', cost: {},
        apply: function () { }, q: function () { return 90; }, why: 'Honest numbers survive diligence and build investor trust.' }
    ]
  };

  EV.discount = {
    title: 'A large prospect wants 30% off for annual prepay.', tag: 'SALES',
    when: function (s) { return s.month >= 4; }, w: 3, once: true,
    body: function () { return 'Rajdhani Carriers will sign a 12-month prepaid contract worth ₹0.6L a month, but only at 30% off list.'; },
    quotes: [['Cash up front is cash up front.', 'Kabir Shah, Ops']],
    choices: [
      { label: 'Accept: ₹5.0L cash today', effect: '+1 customer at a discount; cash now.', cost: {},
        apply: function (s) { book(s, 'Customer prepayments', 5.0); s.keys.push({ id: 'rajdhani', name: 'Rajdhani Carriers', mrr: 0.42, active: true, prepaid: s.month + 12 }); },
        q: function (s) { return FS.metrics(s).runway < 10 ? 78 : 62; }, why: 'Prepaid cash is worth a discount when runway is the binding constraint.' },
      { label: 'Counter at 15% off', effect: '60% chance they sign.', cost: { str: 1 },
        apply: function (s) { if (rng(s) < 0.6) { book(s, 'Customer prepayments', 6.1); s.keys.push({ id: 'rajdhani', name: 'Rajdhani Carriers', mrr: 0.51, active: true }); news(s, 'Rajdhani Carriers signed at 15% off.'); } else news(s, 'Rajdhani Carriers walked away.'); },
        q: function () { return 70; }, why: 'Negotiating protected price with a fair chance of closing.' },
      { label: 'Decline', effect: 'Protect list price.', cost: {}, apply: function () { }, q: function (s) { return FS.metrics(s).runway < 8 ? 35 : 55; }, why: 'Protecting price is fine, but cash had real value at that runway.' }
    ]
  };

  EV.gst = {
    title: 'A GST notice arrives.', tag: 'COMPLIANCE',
    when: function (s) { return s.month >= 3; }, w: 2, once: true,
    body: function () { return 'The GST department has flagged a mismatch in input credits for last year. Kabir thinks it\'s a clerical error.'; },
    quotes: [],
    choices: [
      { label: 'Hire a CA firm to respond', effect: '−₹3L now.', cost: { ops: 1, cash: 3, cat: 'Legal & compliance' }, apply: function () { }, q: function () { return 80; }, why: 'Small, certain cost to close a legal risk.' },
      { label: 'Let Kabir handle it', effect: 'Free. Might be fine.', cost: {}, apply: function (s) { if (rng(s) < 0.5) s.scheduled.push({ m: s.month + 4, fx: 'gstFine' }); }, q: function () { return 40; }, why: 'Under-resourcing a compliance notice risked a larger fine.' }
    ]
  };

  EV.poach = {
    title: 'A senior Stackline engineer wants to join.', tag: 'TEAM',
    when: function (s) { return s.month >= 5; }, w: 2, once: true,
    body: function () { return 'Sameer Rizvi, a senior engineer at Stackline, is unhappy and wants to join you at ₹40L. He knows their roadmap.'; },
    quotes: [],
    choices: [
      { label: 'Hire him at ₹40L', effect: '+1 senior engineer next month.', cost: { ppl: 1 },
        apply: function (s) { s.pipeline.push({ name: 'Sameer Rizvi', role: 'seng', title: 'Senior Engineer', salary: 40, skill: 1.4, ramp: 1, arrive: s.month + 1 }); },
        q: function (s) { return FS.metrics(s).runway > 8 ? 75 : 45; }, why: 'A proven senior hire is valuable if runway can carry the salary.' },
      { label: 'Pass', effect: 'No change.', cost: {}, apply: function () { }, q: function (s) { return FS.metrics(s).runway > 8 ? 50 : 70; }, why: 'Passing preserved burn.' }
    ]
  };

  EV.lease = {
    title: 'Your office lease is up: +30%.', tag: 'OPERATIONS',
    when: function (s) { return s.month >= 10; }, w: 3, once: true,
    body: function () { return 'The landlord wants ₹4.7L a month, up from ₹3.6L.'; },
    quotes: [],
    choices: [
      { label: 'Renew', effect: 'Rent ₹4.7L/mo.', cost: {}, apply: function (s) { s.rent = 4.7; }, q: function (s) { return FS.metrics(s).runway > 15 ? 60 : 35; }, why: 'A 30% rent rise without negotiating is expensive.' },
      { label: 'Move to co-working', effect: 'Rent ₹2.4L/mo; morale −3.', cost: { ops: 1 }, apply: function (s) { s.rent = 2.4; addTemp(s, 'teamMorale', -3, 3); }, q: function () { return 75; }, why: 'Cut a fixed cost with little lasting downside.' },
      { label: 'Go fully remote', effect: 'Rent ₹0.6L/mo; morale −6, productivity −4%.', cost: { ops: 1 }, apply: function (s) { s.rent = 0.6; addTemp(s, 'teamMorale', -6, 4); s.mods.remote = true; }, q: function (s) { return FS.metrics(s).runway < 9 ? 70 : 55; }, why: 'Big savings, at a real cost to collaboration.' }
    ]
  };

  EV.journalist = {
    title: 'A journalist asks about layoff rumours.', tag: 'REPUTATION', w: 0, once: true,
    when: function () { return false; },
    body: function () { return 'A tech reporter has heard you let several people go and asks for comment before publishing.'; },
    quotes: [],
    choices: [
      { label: 'Be candid about the restructure', effect: 'Short story; trust preserved.', cost: { str: 1 }, apply: function (s) { s.board += 2; }, q: function () { return 82; }, why: 'Candour contains a story; denial invites a second one.' },
      { label: 'Deny it', effect: 'Risky if the story checks out.', cost: {}, apply: function (s) { if (rng(s) < 0.6) { s.board -= 10; s.scandal++; addTemp(s, 'teamMorale', -5, 2); news(s, 'The story ran, quoting your denial alongside ex-employees.'); } }, q: function () { return 15; }, why: 'Denying a verifiable fact is a reputational gamble.' },
      { label: 'No comment', effect: 'Neutral.', cost: {}, apply: function () { }, q: function () { return 55; }, why: 'Safe but cedes the narrative.' }
    ]
  };

  EV.burnout = {
    title: 'You are running on empty.', tag: 'FOUNDER',
    when: function (s) { return s.energy < 30; }, w: 8, once: false,
    body: function () { return 'You have not had a full night\'s sleep in weeks. You snapped at Meera in a standup yesterday.'; },
    quotes: [['Take a week. We\'ve got it.', 'Arjun Rao, CTO']],
    choices: [
      { label: 'Take two weeks off', effect: 'Energy +40; no focus left this month.', cost: {}, apply: function (s) { s.energy = Math.min(100, s.energy + 40); s.focus = { str: 0, ops: 0, ppl: 0 }; }, q: function () { return 85; }, why: 'Rest before a breakdown protects every later decision.' },
      { label: 'Push through', effect: 'Energy −5; risk of a costly mistake.', cost: {}, apply: function (s) { s.energy -= 5; if (rng(s) < 0.4) s.scheduled.push({ m: s.month + 1, fx: 'mistake' }); }, q: function () { return 20; }, why: 'Exhausted founders make expensive mistakes.' }
    ]
  };
  EV.burnout.once = false;

  EV.meeraOffer = {
    title: 'Stackline is courting Meera.', tag: 'TEAM',
    when: function (s) { var p = findP(s, 'meera'); return s.month >= 9 && p && p.morale < 68; }, w: 4, once: true,
    body: function () { return 'Meera, who runs customer success, has been offered a head-of-CS role at Stackline at ₹34L.'; },
    quotes: [],
    choices: [
      { label: 'Match at ₹30L and a title bump', effect: 'Likely stays.', cost: { ppl: 1 }, apply: function (s) { var p = findP(s, 'meera'); if (p) { p.salary = 30; p.morale = 84; p.bias = 6; p.title = 'VP Customer Success'; } }, q: function () { return 80; }, why: 'Meera holds the customer relationships; losing her raises churn.' },
      { label: 'Let her go', effect: 'Churn risk up for 4 months.', cost: {}, apply: function (s) { leave(s, 'meera', true); addTemp(s, 'churn', 0.006, 4); }, q: function () { return 25; }, why: 'Your CS lead walked out with relationship knowledge.' }
    ]
  };

  EV.partner = {
    title: 'A reseller offers to sell your product.', tag: 'GROWTH',
    when: function (s) { return s.month >= 7; }, w: 2, once: true,
    body: function () { return 'A large accounting-software reseller will bundle you for its SMB base in exchange for 20% of revenue from those customers.'; },
    quotes: [],
    choices: [
      { label: 'Sign the deal', effect: '+2 customers a month for a year, at 80% revenue.', cost: { str: 1 }, apply: function (s) { s.flags.reseller = s.month + 12; }, q: function (s) { return s.product.pmf >= 0.55 ? 72 : 55; }, why: 'A cheap channel with real reach, at a margin cost.' },
      { label: 'Pass', effect: 'Keep full margin.', cost: {}, apply: function () { }, q: function () { return 50; }, why: 'Margin protected, growth forgone.' }
    ]
  };

  EV.acq = {
    title: 'Stackline wants to acquire you.', tag: 'EXIT',
    when: function (s) { return s.month >= 14 && !s.fund.raised && FS.metrics(s).runway < 7; }, w: 5, once: true,
    body: function (s) { var m = FS.metrics(s); return 'Stackline offers to buy the company for ₹' + (Math.max(8, m.arr / 100 * 4)).toFixed(1) + ' Cr, mostly in stock. Your team keeps their jobs. Accepting ends the game.'; },
    quotes: [],
    choices: [
      { label: 'Accept the offer', effect: 'The game ends with an exit.', cost: {}, apply: function (s) { var m = FS.metrics(s); s.acqValue = Math.max(8, m.arr / 100 * 4); s.over = true; s.outcome = 'acquired'; }, q: function (s) { return FS.metrics(s).runway < 4 ? 65 : 40; }, why: 'Selling under pressure caps the outcome, but beats running out of cash.' },
      { label: 'Decline and fight on', effect: 'Keep going.', cost: {}, apply: function () { }, q: function (s) { return FS.metrics(s).runway < 3 && s.bridge.used ? 25 : 60; }, why: 'Declining makes sense if you have a credible path to funding.' }
    ]
  };

  EV.viral = {
    title: 'Your LinkedIn post on fleet costs went viral.', tag: 'GROWTH',
    when: function (s) { return s.month >= 3; }, w: 2, once: true,
    body: function () { return 'Two hundred inbound demo requests in three days. Sales can\'t keep up.'; },
    quotes: [],
    choices: [
      { label: 'Lean in: founder-led demos for a month', effect: 'CAC −20% for 2 months; Strategy focus spent.', cost: { str: 2 }, apply: function (s) { addTemp(s, 'cac', -0.2, 2); s.mods.organic += 0.2; }, q: function () { return 75; }, why: 'Founder selling converted rare demand while it was hot.' },
      { label: 'Route to sales as normal', effect: 'Some lift; most leads go cold.', cost: {}, apply: function (s) { addTemp(s, 'cac', -0.07, 2); }, q: function () { return 50; }, why: 'Fine, but the spike deserved more attention.' }
    ]
  };

  EV.parttime = {
    title: 'Sneha asks to go part-time.', tag: 'TEAM',
    when: function (s) { return !!findP(s, 'sneha') && s.month >= 6; }, w: 1.5, once: true,
    body: function () { return 'Sneha is caring for a parent and asks to work three days a week for six months.'; },
    quotes: [],
    choices: [
      { label: 'Agree, at 60% pay', effect: 'She stays; capacity −0.4 engineer.', cost: { ppl: 1 }, apply: function (s) { var p = findP(s, 'sneha'); if (p) { p.salary = Math.round(p.salary * 0.6); p.skill *= 0.6; p.morale = 88; p.bias = 8; addTemp(s, 'teamMorale', 2, 3); } }, q: function () { return 82; }, why: 'Flexing for a good employee built loyalty across the team.' },
      { label: 'Say no', effect: 'She will probably resign.', cost: {}, apply: function (s) { s.scheduled.push({ m: s.month + 1, fx: 'snehaLeaves' }); addTemp(s, 'teamMorale', -2, 2); }, q: function () { return 30; }, why: 'Rigid policy cost a solid engineer and the team noticed.' }
    ]
  };

  EV.delaySalary = {
    title: 'Cash is too tight for this month\'s payroll.', tag: 'ETHICS',
    when: function (s) { return FS.metrics(s).runway < 2.2 && !s.flags.delayAsked; }, w: 20, once: true,
    body: function () { return 'You can cover payroll this month only by leaving almost nothing for vendors. Kabir suggests delaying salaries by three weeks without telling the team why.'; },
    quotes: [],
    choices: [
      { label: 'Delay salaries quietly', effect: 'Buys three weeks of cash.', cost: {}, apply: function (s) { s.flags.delayAsked = true; var m = FS.metrics(s); book(s, 'Deferred salaries', m.payroll * 0.75); addTemp(s, 'teamMorale', -15, 3); s.scandal++; s.scheduled.push({ m: s.month + 1, fx: 'payback', data: m.payroll * 0.75 }); }, q: function () { return 10; }, why: 'Delaying pay without candour breaks the deepest trust in a company.' },
      { label: 'Tell the team the truth and cut founder pay', effect: 'Founder salaries go to zero; morale dips less.', cost: { ppl: 1 }, apply: function (s) { s.flags.delayAsked = true; s.people.forEach(function (p) { if (p.founder) p.salary = 0; }); addTemp(s, 'teamMorale', -4, 2); }, q: function () { return 85; }, why: 'Leaders absorbing the pain first is what keeps teams in a crisis.' }
    ]
  };

  FS.EVENTS = EV;

  function leave(s, id, regretted) {
    var p = findP(s, id); if (!p) return;
    s.people = s.people.filter(function (q) { return q.id !== id; });
    s.quits++; if (regretted || p.skill >= 1.1 || p.key) s.regretted++;
    addTemp(s, 'teamMorale', -3, 2);
    news(s, p.name + ' (' + p.title + ') resigned.');
  }

  var FX = {
    kavyaServices: function (s) { if (rng(s) < 0.5) churnKey(s, 'kavya'); else news(s, 'Kavya Logistics renewed after the services engagement.'); },
    kavyaDecline: function (s) { if (rng(s) < 0.8) churnKey(s, 'kavya'); else news(s, 'Kavya Logistics renewed anyway, grudgingly.'); },
    rohanMaybe: function (s) { if (rng(s) < 0.4) { leave(s, 'rohan', true); s.product.debt = Math.min(100, s.product.debt + 6); } },
    gstFine: function (s) { book(s, 'Legal & compliance', -15); news(s, 'GST demand of ₹15L including penalties is upheld.'); logDecision(s, 'Compliance', 'GST', 'The unanswered notice became a ₹15L demand', 20, 'A ₹3L response would have avoided a ₹15L fine.'); },
    mistake: function (s) { book(s, 'Other one-offs', -8); news(s, 'An exhausted sign-off on a vendor contract cost ₹8L.'); },
    snehaLeaves: function (s) { if (rng(s) < 0.8) leave(s, 'sneha', false); },
    payback: function (s, d) { book(s, 'Deferred salaries', -d); }
  };

  function weightOf(e, s) { return typeof e.w === 'function' ? e.w(s) : e.w; }

  function rollEvents(s) {
    // scripted deadlines
    if (s.flags.kavyaDeadline && s.month > s.flags.kavyaDeadline) {
      if (s.product.shipped.indexOf('dispatch') < 0) churnKey(s, 'kavya');
      else news(s, 'Kavya Logistics renewed for two years.');
      s.flags.kavyaDeadline = 0;
    }
    if (s.pending.length) return;
    var pool = [];
    // crises are rolled separately (systems.js)
    for (var id in EV) {
      var e = EV[id];
      if (e.crisis || e.sys) continue;
      if (e.once && s.fired[id]) continue;
      if (!e.once && s.fired[id] && s.fired[id] >= s.month - 3) continue;
      if (!e.when(s)) continue;
      var w = weightOf(e, s); if (w > 0) pool.push([id, w]);
    }
    var chance = s.month <= 2 ? 0.3 : 0.55;
    if (!pool.length || rng(s) > chance) return;
    var tot = pool.reduce(function (a, x) { return a + x[1]; }, 0), r = rng(s) * tot;
    for (var i = 0; i < pool.length; i++) { r -= pool[i][1]; if (r <= 0) { s.pending.push(pool[i][0]); break; } }
  }
  function rollAll(s) { rollEvents(s); var c = hk('crisis', s); if (c && s.pending.indexOf(c) < 0) s.pending.push(c); }

  FS.currentEvent = function (s) {
    if (!s.pending.length) return null;
    var id = s.pending[0], e = EV[id];
    var ch = typeof e.choices === 'function' ? e.choices(s) : e.choices;
    return { id: id, title: typeof e.title === 'function' ? e.title(s) : e.title, tag: e.tag, crisis: !!e.crisis, body: e.body(s), quotes: e.quotes || [], choices: ch.map(function (c) { return { label: c.label, effect: c.effect, cost: (typeof c.cost === 'function' ? c.cost(s) : c.cost) || {} }; }) };
  };

  FS.resolveEvent = function (s, idx) {
    var id = s.pending[0]; if (!id) return { ok: false };
    var e = EV[id], ch = typeof e.choices === 'function' ? e.choices(s) : e.choices, c = ch[idx];
    var err = spend(s, (typeof c.cost === 'function' ? c.cost(s) : c.cost) || {});
    if (err) return { ok: false, msg: err };
    var q = c.q(s);
    var title = typeof e.title === 'function' ? e.title(s) : e.title;
    c.apply(s);
    s.fired[id] = s.month;
    s.pending.shift();
    logDecision(s, e.crisis ? 'Crisis' : 'Event', title, c.label, q, c.why);
    if (e.crisis) { s.crises = s.crises || []; s.crises.unshift({ m: s.month, title: title, choice: c.label, tag: e.tag }); }
    return { ok: true };
  };

  /* ---------- the monthly tick ---------- */
  FS.endMonth = function (s) {
    if (s.over) return null;
    if (s.pending.length) return { blocked: 'Resolve the open event first.' };
    var before = FS.metrics(s);
    var rep = { m: s.month, mrr0: before.mrr, cash0: s.cash, newCust: 0, churned: 0, shipped: [], arrived: [], quit: [], notes: [] };
    var newsBefore = s.news.length ? s.news[0] : null;

    // fundraise upkeep
    if (s.fund.status === 'active') {
      if (s.focus.str >= 1) { s.focus.str -= 1; s.fund.months++; }
      else rep.notes.push('The raise stalled: no Strategy focus left to keep it moving.');
    }

    // 1. engineering
    var e = engineering(s);
    var P = s.product, fw = e.feature;
    if (P.progress.__tax) { var t = Math.min(fw, P.progress.__tax); fw -= t; P.progress.__tax -= t; }
    var guard = 0;
    while (fw > 0.01 && P.queue.length && guard++ < 10) {
      var id = P.queue[0], it = item(s, id);
      if (!it) { P.queue.shift(); continue; }
      var need = it.effort - (P.progress[id] || 0);
      var put = Math.min(need, fw);
      P.progress[id] = (P.progress[id] || 0) + put; fw -= put;
      if (P.progress[id] >= it.effort - 0.01) { P.queue.shift(); P.shipped.push(id); P.shippedAt[id] = s.month; rep.shipped.push(it.name); news(s, 'Shipped: ' + it.name + '.'); hk('ship', s, id, rep); }
    }
    if (fw > 1 && !P.queue.length) rep.notes.push(Math.round(fw) + ' engineering weeks went unused: the roadmap queue was empty.');
    P.debt = clamp(P.debt + 1.0 + e.feature * 0.05 - e.debtWeeks * 0.4, 8, 100);
    if (s.flags.sprintUntil && s.month >= s.flags.sprintUntil) { P.alloc = s.flags.sprintPrev || 10; s.flags.sprintUntil = 0; rep.notes.push('The debt sprint ended; allocation is back to ' + P.alloc + '%.'); }
    P.pmf = clamp(P.pmf + (P.debt > 70 ? -0.004 : 0), 0.2, 0.9);

    // 2. customers
    var m = FS.metrics(s);
    var cs = staff(s, 'cs').reduce(function (a, p) { return a + p.skill * rampF(p); }, 0);
    var cover = cs * 30 / Math.max(1, m.customers);
    var churn = 0.017 - 0.0015 * Math.min(cs, 3) + Math.max(0, (P.debt - 30)) / 100 * 0.015 + (HK.supportChurn ? HK.supportChurn(s, m) : Math.max(0, 1 - cover) * 0.01) + (0.6 - P.pmf) * 0.015 + s.mods.churn + tempSum(s, 'churn');
    churn = clamp(churn, 0.01, 0.08);
    s.lastChurn = churn;
    var churned = 0;
    for (var k in s.segments) { var g = s.segments[k]; var c = sround(s, g.cust * churn); g.cust -= c; churned += c; }
    rep.churned = churned;
    // expansion
    var exp = s.mods.expansion + tempSum(s, 'expansion');
    for (k in s.segments) { var sg = s.segments[k]; sg.base = sg.base || sg.arpa; sg.arpa *= (1 + exp * Math.pow(sg.base / sg.arpa, 2.5)); }
    s.keys.forEach(function (kk) { if (kk.active) kk.mrr *= (1 + exp * 0.5); });
    // acquisition
    var added = hk('acquire', s, rep) || 0;
    rep.newCust = added;

    // 3. money
    m = FS.metrics(s);
    rep._m = m;
    hk('money', s, rep, m);
    s.cash -= m.cashOut;
    if (m.repay > 0) s.vdebt.principal = Math.max(0, s.vdebt.principal - m.repay);

    // 4. people: arrivals, ramp, morale, quits
    s.pipeline = s.pipeline.filter(function (h) {
      if (h.arrive <= s.month + 1) {
        var id = 'h' + s.month + '_' + Math.floor(rng(s) * 1e6);
        var R = ROLES[h.role];
        s.people.push(person(id, h.name, h.role, R.fn, h.title, h.salary, h.skill, 78, { joined: s.month + 1, ramp: h.ramp }));
        rep.arrived.push(h.name + ' (' + h.title + ')');
        return false;
      }
      return true;
    });
    s.people.forEach(function (p) { if (p.ramp > 0 && p.joined <= s.month) p.ramp--; });
    var teamMod = tempSum(s, 'teamMorale');
    var target = 66 + (s.energy - 60) * 0.12 + teamMod - (P.debt > 65 ? 5 : 0) + (rep.shipped.length ? 3 : 0) - (m.runway < 4 ? 8 : 0) - (s.mods.remote ? 2 : 0) + (s.fund.raised && s.fund.closedAt >= s.month - 2 ? 5 : 0);
    s.people.forEach(function (p) {
      if (p.id === 'you') return;
      var tgt = target + p.bias;
      if (p.id === 'arjun' && e.reports > 8) tgt -= 4;
      p.morale = clamp(p.morale + (tgt - p.morale) * 0.25 + (rng(s) - 0.5) * 6, 10, 98);
      p.bias *= 0.92;
    });
    var quitters = [];
    s.people.forEach(function (p) {
      if (p.founder) return;
      var pr = p.morale < 35 ? 0.13 : p.morale < 45 ? 0.06 : p.morale < 52 ? 0.02 : 0.004;
      if (rng(s) < pr) quitters.push(p.id);
    });
    quitters.forEach(function (id) { var p = findP(s, id); rep.quit.push(p.name + ' (' + p.title + ')'); leave(s, id, p.skill >= 1.1 || p.key); });
    var arj = findP(s, 'arjun');
    if (arj && arj.morale < 30 && rng(s) < 0.25) { s.over = true; s.outcome = 'cofounder'; rep.notes.push('Arjun has resigned as CTO.'); }

    // 5. board & energy
    var bd = 0;
    if (m.g3 >= 0.07) bd += 1.2; else if (m.g3 < 0.04) bd -= 1.2;
    if (m.runway < 6 && s.fund.status !== 'active' && !s.fund.raised) bd -= 2;
    if (s.fund.status === 'active') bd += 0.5;
    if (m.bm > 4 && s.month > 4) bd -= 0.6;
    if (bd < 0 && s.director) bd *= 0.5;
    bd += (62 - s.board) * 0.04;
    s.board = clamp(s.board + bd, 0, 95);
    var total = s.focusMax.str + s.focusMax.ops + s.focusMax.ppl;
    var used = (s.spentThisMonth || 0) + (s.fund.status === 'active' ? 1 : 0);
    s.energy = clamp(s.energy - (used >= total * 0.8 ? 5 : used >= total * 0.5 ? 2.5 : 0.5) - (m.runway < 4 ? 2 : 0), 0, 100);

    // 6. fundraise progress
    fundraiseTick(s, rep);
    hk('postTick', s, rep);

    // scheduled effects
    s.scheduled = s.scheduled.filter(function (x) { if (x.m <= s.month) { FX[x.fx](s, x.data); return false; } return true; });

    // record
    rep.mrr1 = FS.metrics(s).mrr; rep.cash1 = s.cash;
    s.reports.push(rep); s.lastReport = rep;
    // collect news created this month
    rep.news = s.news.filter(function (n) { return n.m === s.month; }).map(function (n) { return n.text; });

    // board meeting at end of each quarter
    if (s.month % 3 === 0) { rep.boardMeeting = boardMeeting(s); hk('board', s, rep.boardMeeting); }
    hk('close', s, rep);

    // advance
    s.month++;
    s.temp = s.temp.filter(function (t) { return t.until >= s.month; });
    var pen = s.energy < 30 ? 1 : 0;
    s.focus = { str: Math.max(0, s.focusMax.str - pen), ops: Math.max(0, s.focusMax.ops - pen), ppl: Math.max(0, s.focusMax.ppl - pen) };
    s.spentThisMonth = 0;
    s.history.push(snapshot(s));

    // endings
    if (s.cash < 0) {
      if (!s.bridge.used && s.board >= 45 && !s.flags.emergencyOffered) { s.flags.emergencyOffered = true; s.cash = Math.max(s.cash, -5); rep.emergency = true; }
      else { s.over = true; s.outcome = 'dead'; }
    }
    if (!s.over && s.board < 12) { s.over = true; s.outcome = 'fired'; }
    if (!s.over && s.month > 36) { s.over = true; s.outcome = 'completed'; s.month = 36; }
    if (!s.over) rollAll(s);
    return rep;
  };

  function shipFx(s, id) {
    var P = s.product;
    if (id === 'usage') s.mods.expansion += 0.005;
    if (id === 'sso') s.flags.sso = true;
    if (id === 'dispatch') { P.pmf += 0.04; s.mods.churn -= 0.001; }
    if (id === 'billing') { P.debt = Math.max(5, P.debt - 22); }
    if (id === 'whatsapp') { P.pmf += 0.02; s.mods.churn -= 0.002; }
    if (id === 'analytics') { P.pmf += 0.04; s.mods.churn -= 0.003; }
    if (id === 'selfserve') { s.mods.cac *= 0.85; s.mods.organic += 0.4; }
    if (id === 'mobile') { P.pmf += 0.02; s.mods.cac *= 0.95; }
    P.pmf = clamp(P.pmf, 0.2, 0.9);
  }

  function metricsScore(s) {
    var m = FS.metrics(s);
    var sc = 0.35 * Math.min(m.arr / 600, 1) + 0.25 * clamp(m.g3 / 0.08, 0, 1.2) + 0.15 * clamp(m.nrr / 1.1, 0, 1.1) + 0.15 * (m.bm <= 2.5 ? 1 : 2.5 / m.bm) + 0.1 * s.board / 100;
    return sc;
  }
  FS.fundInterest = function (s, f) {
    var base = metricsScore(s) + f.fit * 0.03 + (s.fund.pitched[f.id] || 0) * 0.045 + ARCH[s.archetype].interest + (s.fund.inflated ? 0.06 : 0) + (s.director ? 0.02 : 0) + (s.flags.dataroom ? 0.03 : 0);
    return base;
  };

  function fundraiseTick(s, rep) {
    if (s.fund.status !== 'active' || s.fund.offer) return;
    if (s.fund.months < 3) return;
    var best = null, bi = 0;
    FUNDS.forEach(function (f) { var i = FS.fundInterest(s, f) + (rng(s) - 0.5) * 0.06; if (i > bi) { bi = i; best = f; } });
    if (bi >= 0.66) {
      var m = FS.metrics(s);
      var mult = clamp(7 + 80 * m.g3 + 12 * (m.nrr - 1) - 1.2 * Math.max(0, m.bm - 2) + (bi - 0.66) * 20, 5, 30);
      var pre = Math.max(20, m.arr / 100 * mult) * 100; // L
      var maxAmt = pre * 0.3 / 0.7;
      var opts = [0.6, 0.8, 1.0].map(function (x) { return Math.round(maxAmt * x / 50) * 50; }).filter(function (x) { return x >= 300; });
      if (!opts.length) opts = [300];
      s.fund.offer = { fund: best.name, pre: Math.round(pre), options: opts, month: s.month };
      s.fund.status = 'termsheet';
      rep.termsheet = true;
      news(s, best.name + ' sent a term sheet at ₹' + (pre / 100).toFixed(1) + ' Cr pre-money.');
    } else if (s.fund.months >= 6) {
      s.fund.status = 'failed'; s.fund.cooldown = s.month + 3; s.board -= 8;
      rep.notes.push('Your Series A process ended without a term sheet. Investors want stronger growth or a lower burn multiple.');
      news(s, 'The Series A process ended without a term sheet.');
      logDecision(s, 'Capital', 'Series A', 'The raise failed after six months', 35, 'Metrics were below the bar; fixing burn multiple or growth first would have helped.');
    }
  }

  function boardMeeting(s) {
    var m = FS.metrics(s);
    var asks = [];
    if (!s.fund.raised && s.fund.status !== 'active' && s.month >= 6) asks.push('Start the Series A process.');
    if (m.bm > 2.5) asks.push('Bring the burn multiple below 2.5× (now ' + (m.bm > 50 ? '—' : m.bm.toFixed(1) + '×') + ').');
    if (m.conc > 0.1) asks.push('No customer above 10% of MRR (now ' + Math.round(m.conc * 100) + '%).');
    if (m.g3 < 0.06) asks.push('Get monthly growth back above 6%.');
    if (m.morale < 60) asks.push('Fix morale before people leave.');
    if (!asks.length) asks.push('Keep doing what you are doing.');
    return { month: s.month, mood: s.board >= 65 ? 'Supportive' : s.board >= 45 ? 'Concerned' : 'Losing patience', asks: asks, g3: m.g3, runway: m.runway, bm: m.bm };
  }

  FS.boardChoice = function (s, choice) {
    var m = FS.metrics(s);
    if (choice === 'candid') { s.board = clamp(s.board + (m.g3 >= 0.06 ? 3 : 1), 0, 100); logDecision(s, 'Board', 'Board meeting M' + (s.month - 1), 'Gave a candid update', 85, 'Boards forgive bad news; they rarely forgive surprises.'); }
    else { s.board = clamp(s.board + 6, 0, 100); s.flags.spin = (s.flags.spin || 0) + 1; logDecision(s, 'Board', 'Board meeting M' + (s.month - 1), 'Spun the numbers', 20, 'A rosy update buys a quarter and costs trust when reality arrives.'); s.scheduled.push({ m: s.month + 3, fx: 'spinBack' }); }
  };
  FX.spinBack = function (s) { var m = FS.metrics(s); if (m.g3 < 0.06 || m.runway < 6) { s.board -= 12; news(s, 'The board realised last quarter\'s update was rosier than reality.'); } };

  /* ---------- scoring ---------- */
  FS.score = function (s) {
    var m = FS.metrics(s);
    var mult = clamp(4 + 50 * m.g3 + 15 * (m.nrr - 1) + 5 * (m.gm - 0.7) - 8 * Math.max(0, m.conc - 0.1) - 0.5 * Math.max(0, Math.min(m.bm, 10) - 2), 2, 20);
    var ev = m.arr / 100 * mult;
    if (s.outcome === 'acquired') ev = s.acqValue;
    if (s.outcome === 'dead') ev = 0;
    if (s.outcome === 'fired') ev = ev * 0.5;
    var founderOutcome = ev * s.cap.you / 100;
    var dq = s.log.length ? s.log.reduce(function (a, l) { return a + l.q; }, 0) / s.log.length : 0;
    var arrAdded = m.arr - s.history[0].mrr * 12;
    var burned = Math.max(1, s.raisedTotal - Math.max(0, s.cash));
    var eff = arrAdded / burned;
    var team = clamp(m.morale - s.regretted * 6, 0, 100);
    var rep = clamp(100 - s.scandal * 30 - Math.max(0, (m.churn - 0.02)) * 1500, 0, 100);
    function grade(x, cuts) { var g = ['A', 'B', 'C', 'D']; for (var i = 0; i < cuts.length; i++) if (x >= cuts[i]) return g[i]; return 'E'; }
    return {
      ev: ev, mult: mult, founderOutcome: founderOutcome, ownership: s.cap.you,
      dq: dq, dqGrade: grade(dq, [78, 66, 54, 42]),
      eff: eff, effGrade: grade(eff, [1.0, 0.6, 0.35, 0.15]),
      team: team, teamGrade: grade(team, [75, 65, 55, 45]),
      rep: rep, repGrade: grade(rep, [85, 70, 50, 30]),
      outcome: s.outcome, months: s.history.length - 1,
      goals: HK.goalsDone ? HK.goalsDone(s) : 0, goalsTotal: HK.goalsTotal ? HK.goalsTotal() : 0
    };
  };

  FS._ACT = ACT; FS._EV = EV; FS._FX = FX;
  FS._h = { rng: rng, clamp: clamp, sround: sround, pick: pick, r1: r1, book: book, news: news, logDecision: logDecision, addTemp: addTemp, spend: spend, findP: findP, staff: staff, rampF: rampF, engineering: engineering, person: person, leave: leave, churnKey: churnKey, dilute: dilute, NAMES: NAMES, keyActive: keyActive, snapshot: snapshot };
  root.FS = FS;
})(typeof window !== 'undefined' ? window : globalThis);
