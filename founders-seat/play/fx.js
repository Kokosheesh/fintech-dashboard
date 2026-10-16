/* Founder's Seat — delighters: celebration and alarm graphics, plus synthesised sounds (no audio files). */
(function () {
  'use strict';
  var MUTE_KEY = 'fs_mute', ctx = null, muted = false, lastArr = null, seenRunway = false, wasProfitable = false;
  try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch (e) { }
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------- sound ---------------- */
  function ac() {
    if (muted) return null;
    try {
      if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    } catch (e) { return null; }
  }
  function tone(c, f, t0, dur, type, vol, f2) {
    var o = c.createOscillator(), g = c.createGain(), lp = c.createBiquadFilter();
    o.type = type || 'triangle'; o.frequency.setValueAtTime(f, t0);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
    lp.type = 'lowpass'; lp.frequency.value = 3200;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.12, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(lp); lp.connect(g); g.connect(c.destination);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }
  var SOUNDS = {
    good: function (c, t) { [523.25, 659.25, 783.99].forEach(function (f, i) { tone(c, f, t + i * 0.09, 0.35, 'triangle', 0.10); }); },
    big: function (c, t) {
      [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) { tone(c, f, t + i * 0.1, 0.5, 'triangle', 0.11); });
      [1567.98, 2093].forEach(function (f, i) { tone(c, f, t + 0.45 + i * 0.07, 0.6, 'sine', 0.05); });
    },
    medal: function (c, t) { tone(c, 880, t, 0.25, 'sine', 0.10); tone(c, 1318.5, t + 0.12, 0.6, 'sine', 0.09); },
    bad: function (c, t) { tone(c, 311.13, t, 0.35, 'sawtooth', 0.06, 220); tone(c, 233.08, t + 0.22, 0.55, 'sawtooth', 0.06, 160); },
    alarm: function (c, t) { for (var i = 0; i < 3; i++) { tone(c, 740, t + i * 0.28, 0.14, 'square', 0.05); tone(c, 554.37, t + i * 0.28 + 0.14, 0.14, 'square', 0.05); } },
    click: function (c, t) { tone(c, 1200, t, 0.05, 'sine', 0.04); }
  };
  function play(name) { var c = ac(); if (!c || !SOUNDS[name]) return; try { SOUNDS[name](c, c.currentTime + 0.02); } catch (e) { } }

  /* ---------------- graphics ---------------- */
  var ICONS = {
    up: '<svg viewBox="0 0 48 48" width="44" height="44" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 36l12-12 8 8 16-18"/><path d="M32 14h10v10"/></svg>',
    medal: '<svg viewBox="0 0 48 48" width="44" height="44" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M16 4l8 14 8-14"/><circle cx="24" cy="30" r="12"/><path d="M24 23l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4-3.9-3.8 5.4-.8z"/></svg>',
    cash: '<svg viewBox="0 0 48 48" width="44" height="44" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><rect x="5" y="13" width="38" height="22"/><circle cx="24" cy="24" r="6"/><path d="M11 19v10M37 19v10"/></svg>',
    down: '<svg viewBox="0 0 48 48" width="44" height="44" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 12l12 12 8-8 16 18"/><path d="M32 34h10V24"/></svg>',
    warn: '<svg viewBox="0 0 48 48" width="44" height="44" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M24 5L44 41H4z"/><path d="M24 18v11M24 34v2" stroke-linecap="round"/></svg>',
    flag: '<svg viewBox="0 0 48 48" width="44" height="44" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M10 44V6"/><path d="M10 8h26l-5 8 5 8H10"/></svg>'
  };
  var layer = null, hideT = null;
  function ensureLayer() {
    if (layer) return layer;
    layer = document.createElement('div'); layer.id = 'fxLayer'; layer.setAttribute('aria-live', 'polite');
    document.body.appendChild(layer);
    layer.addEventListener('click', clear);
    return layer;
  }
  function clear() { if (!layer) return; layer.className = ''; layer.innerHTML = ''; clearTimeout(hideT); }

  function confetti(canvas, palette, count) {
    var c = canvas.getContext('2d'), W = canvas.width = canvas.offsetWidth * (window.devicePixelRatio || 1), H = canvas.height = canvas.offsetHeight * (window.devicePixelRatio || 1);
    var ps = [], i, start = performance.now();
    for (i = 0; i < count; i++) ps.push({ x: W / 2 + (Math.random() - 0.5) * W * 0.25, y: H * 0.42, vx: (Math.random() - 0.5) * W * 0.018, vy: -(Math.random() * H * 0.022 + H * 0.008), r: Math.random() * 6 + 3, a: Math.random() * 6.28, va: (Math.random() - 0.5) * 0.3, col: palette[i % palette.length], shape: i % 3 });
    (function frame(now) {
      var t = now - start; if (t > 2600 || !canvas.isConnected) return;
      c.clearRect(0, 0, W, H);
      ps.forEach(function (p) {
        p.vy += H * 0.0006; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.a += p.va;
        c.save(); c.globalAlpha = Math.max(0, 1 - t / 2600); c.translate(p.x, p.y); c.rotate(p.a); c.fillStyle = p.col;
        if (p.shape === 0) c.fillRect(-p.r, -p.r / 2, p.r * 2, p.r);
        else if (p.shape === 1) { c.beginPath(); c.arc(0, 0, p.r * 0.7, 0, 6.28); c.fill(); }
        else { c.beginPath(); c.moveTo(0, -p.r); c.lineTo(p.r, p.r); c.lineTo(-p.r, p.r); c.closePath(); c.fill(); }
        c.restore();
      });
      requestAnimationFrame(frame);
    })(start);
  }

  function show(kind, o) {
    var L = ensureLayer(); clear();
    var good = kind === 'good' || kind === 'big' || kind === 'medal';
    L.className = 'on ' + (good ? 'good' : 'bad') + (kind === 'big' ? ' big' : '') + (kind === 'alarm' ? ' alarm' : '');
    L.innerHTML = (good && !reduced ? '<canvas class="fxc"></canvas>' : '') + (!good ? '<div class="fxv"></div>' : '') +
      '<div class="fxcard" role="status"><span class="fxi">' + (ICONS[o.icon] || ICONS.up) + '</span><span class="fxk">' + o.kicker + '</span><span class="fxt">' + o.title + '</span>' + (o.sub ? '<span class="fxs">' + o.sub + '</span>' : '') + '</div>';
    if (good && !reduced) confetti(L.querySelector('canvas'), kind === 'big' ? ['#C9A45C', '#E2C27F', '#ECE6DA', '#7DB892', '#B8C4D6'] : ['#C9A45C', '#E2C27F', '#7DB892'], kind === 'big' ? 160 : 70);
    if (!good) { var md = document.querySelector('#modalRoot .modal'); if (md && !reduced) { md.classList.remove('fxshake'); void md.offsetWidth; md.classList.add('fxshake'); } }
    play(kind === 'medal' ? 'medal' : kind);
    hideT = setTimeout(clear, kind === 'big' ? 3200 : 2300);
  }

  function esc(x) { return String(x).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function lakh(x) { x = Math.abs(x); return x >= 100 ? '₹' + (x / 100).toFixed(2) + ' Cr' : '₹' + x.toFixed(1) + 'L'; }

  /* ---------------- game hooks ---------------- */
  var ARR_MARKS = [100, 200, 300, 500, 1000, 2000];
  var FSFX = {
    get muted() { return muted; },
    toggleMute: function () { muted = !muted; try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch (e) { } if (!muted) play('click'); paintMute(); return muted; },
    play: play,
    show: function (kind, o) { show(kind, { icon: o.icon, kicker: esc(o.kicker || ''), title: esc(o.title || ''), sub: o.sub ? esc(o.sub) : '' }); },
    reset: function (S) { lastArr = S ? S.history[S.history.length - 1].mrr * 12 : null; seenRunway = false; wasProfitable = false; },
    report: function (rep, m, S) {
      var arr0 = rep.mrr0 * 12, arr1 = rep.mrr1 * 12, g = rep.mrr0 ? (rep.mrr1 - rep.mrr0) / rep.mrr0 : 0;
      var cands = [];
      if (rep.termsheet) cands.push([100, 'big', { icon: 'cash', kicker: 'Capital', title: 'A term sheet has arrived', sub: 'Open Capital & Board to review it.' }]);
      var mark = ARR_MARKS.filter(function (x) { return arr0 < x && arr1 >= x; }).pop();
      if (mark) cands.push([90, 'big', { icon: 'flag', kicker: 'Milestone', title: lakh(mark) + ' ARR crossed', sub: 'Annual recurring revenue is now ' + lakh(arr1) + '.' }]);
      if (m.burn <= 0 && !wasProfitable && S.month > 1) cands.push([85, 'big', { icon: 'cash', kicker: 'Default alive', title: 'You are profitable', sub: 'Revenue now covers every cost.' }]);
      if (rep.goals && rep.goals.length) cands.push([80, 'medal', { icon: 'medal', kicker: 'Milestone reached', title: rep.goals[0], sub: rep.goals.length > 1 ? '+' + (rep.goals.length - 1) + ' more this month' : 'Board confidence goes up.' }]);
      if (m.runway < 4 && !seenRunway) cands.push([75, 'alarm', { icon: 'warn', kicker: 'Danger', title: m.runway.toFixed(1) + ' months of runway', sub: 'Raise, cut or bridge now.' }]);
      if (g <= -0.03) cands.push([60, 'bad', { icon: 'down', kicker: 'Revenue fell', title: 'MRR down ' + Math.abs(g * 100).toFixed(1) + '%', sub: rep.churned + ' customers churned this month.' }]);
      if (rep.quit && rep.quit.length >= 2) cands.push([55, 'bad', { icon: 'warn', kicker: 'Team', title: rep.quit.length + ' people resigned', sub: 'Check morale on Team & Org.' }]);
      if (g >= 0.08) cands.push([50, 'good', { icon: 'up', kicker: 'Strong month', title: 'MRR up ' + (g * 100).toFixed(1) + '%', sub: '+' + rep.newCust + ' new customers · ' + lakh(rep.mrr1) + ' MRR' }]);
      else if (rep.quit && rep.quit.length === 1) cands.push([30, 'bad', { icon: 'warn', kicker: 'Team', title: 'Someone resigned', sub: String(rep.quit[0]) }]);
      if (m.runway < 4) seenRunway = true;
      if (m.burn <= 0) wasProfitable = true;
      lastArr = arr1;
      if (!cands.length) { if (g > 0.02) play('good'); return; }
      cands.sort(function (a, b) { return b[0] - a[0]; });
      var c = cands[0];
      show(c[1], { icon: c[2].icon, kicker: esc(c[2].kicker), title: esc(c[2].title), sub: esc(c[2].sub || '') });
    },
    crisis: function (ev) { show('alarm', { icon: 'warn', kicker: /crisis/i.test(ev.tag || '') ? esc(ev.tag) : 'Crisis · ' + esc(ev.tag || ''), title: esc(ev.title || 'Something broke'), sub: 'Respond before the month ends.' }); },
    emergency: function () { show('alarm', { icon: 'warn', kicker: 'Cash is gone', title: 'You cannot make payroll', sub: '' }); },
    ending: function (outcome) {
      if (outcome === 'completed' || outcome === 'acquired') show('big', { icon: 'flag', kicker: outcome === 'acquired' ? 'Exit' : 'Month 36', title: outcome === 'acquired' ? 'You sold the company' : 'You made it', sub: 'Read your debrief.' });
      else show('bad', { icon: 'down', kicker: 'Game over', title: outcome === 'dead' ? 'Out of cash' : outcome === 'fired' ? 'The board replaced you' : 'The company did not make it', sub: 'The debrief shows what to do differently.' });
    },
    small: function (good) { play(good ? 'good' : 'bad'); }
  };
  window.FSFX = FSFX;

  function paintMute() {
    var b = document.getElementById('muteBtn'); if (!b) return;
    b.setAttribute('aria-pressed', String(muted)); b.title = muted ? 'Sound off. Click to turn on.' : 'Sound on. Click to mute.';
    b.innerHTML = muted ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9l5 6M22 9l-5 6"/></svg><span class="sr">Sound off</span>'
      : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12"/></svg><span class="sr">Sound on</span>';
  }
  document.addEventListener('DOMContentLoaded', paintMute); paintMute();
  document.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('#muteBtn')) FSFX.toggleMute(); });
})();
