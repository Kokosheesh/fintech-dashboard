/* Founder's Seat — accounts (email or Google), play tracking, 7-day trial and the ₹269 unlock.
   Talks to Supabase Auth, REST and one edge function directly; no SDK. */
(function () {
  'use strict';
  var SB = 'https://xxdxuuqmftxufvnkkuif.supabase.co';
  var KEY = 'sb_publishable_-QIiye3pp3AmD6UvuBz__A_LtfUeg4F'; // publishable: safe in the browser; tables are protected by row-level security
  var SK = 'fs_auth_v1';
  var sess = null, offline = false, lastTrack = '', ACC = null, googleOn = null;
  function $(id) { return document.getElementById(id); }
  function esc(x) { return String(x).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function save() { try { if (sess) localStorage.setItem(SK, JSON.stringify(sess)); else localStorage.removeItem(SK); } catch (e) { } }
  function read() { try { return JSON.parse(localStorage.getItem(SK) || 'null'); } catch (e) { return null; } }
  function here() { return location.origin + location.pathname; }

  function req(path, opts) {
    opts = opts || {};
    var h = { apikey: KEY, 'Content-Type': 'application/json' };
    if (opts.auth && sess) h.Authorization = 'Bearer ' + sess.access_token;
    for (var k in opts.headers || {}) h[k] = opts.headers[k];
    return fetch(SB + path, { method: opts.method || 'GET', headers: h, body: opts.body ? JSON.stringify(opts.body) : undefined }).then(function (r) {
      return r.text().then(function (t) {
        var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) { }
        if (!r.ok) { var msg = (j && (j.msg || j.message || j.error_description || j.error)) || ('HTTP ' + r.status); var err = new Error(msg); err.status = r.status; err.body = j; throw err; }
        return j;
      });
    });
  }
  function take(j) {
    if (!j || !j.access_token) throw new Error('No session returned. Email confirmation may be switched on in Supabase.');
    var u = j.user || {}, md = u.user_metadata || {};
    sess = { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: Math.floor(Date.now() / 1000) + (Number(j.expires_in) || 3600), user: { id: u.id, email: u.email, name: md.name || md.full_name || '' } };
    save(); return sess;
  }
  function fresh() {
    if (!sess) return Promise.reject(new Error('Not signed in'));
    if (sess.expires_at - 90 > Date.now() / 1000) return Promise.resolve(sess);
    return req('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: sess.refresh_token } }).then(take);
  }
  function friendly(e) {
    var m = String(e && e.message || e);
    if (/Invalid login credentials/i.test(m)) return 'That email and password do not match an account. If you signed up with Google, use the Google button.';
    if (/already registered|already been registered|User already registered/i.test(m)) return 'An account with this email already exists. Sign in instead.';
    if (/Password should be at least/i.test(m)) return 'Use a password of at least 6 characters.';
    if (/rate limit/i.test(m)) return 'Too many attempts. Wait a minute and try again.';
    if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'Cannot reach the sign-in server. Check your connection.';
    if (/provider is not enabled|Unsupported provider/i.test(m)) return 'Google sign-in is not switched on yet. Use email for now.';
    return m;
  }

  /* ---------- Google sign-in (Supabase OAuth, implicit flow: tokens come back in the URL hash) ---------- */
  function googleStart() { location.href = SB + '/auth/v1/authorize?provider=google&redirect_to=' + encodeURIComponent(here()); }
  function googleReturn() {
    var h = location.hash.replace(/^#/, ''); if (!h) return null;
    var p = new URLSearchParams(h);
    if (p.get('error') || p.get('error_description')) {
      history.replaceState(null, '', here() + location.search);
      return Promise.reject(new Error(p.get('error_description') || p.get('error')));
    }
    if (!p.get('access_token')) return null;
    var tok = { access_token: p.get('access_token'), refresh_token: p.get('refresh_token'), expires_in: p.get('expires_in') };
    history.replaceState(null, '', here() + location.search);
    return fetch(SB + '/auth/v1/user', { headers: { apikey: KEY, Authorization: 'Bearer ' + tok.access_token } })
      .then(function (r) { if (!r.ok) throw new Error('Google sign-in could not be completed.'); return r.json(); })
      .then(function (u) { tok.user = u; return take(tok); });
  }
  function checkGoogle() {
    if (googleOn !== null) return Promise.resolve(googleOn);
    return fetch(SB + '/auth/v1/settings', { headers: { apikey: KEY } }).then(function (r) { return r.json(); })
      .then(function (j) { googleOn = !!(j && j.external && j.external.google); return googleOn; })
      .catch(function () { googleOn = false; return false; });
  }

  /* ---------- tracking ---------- */
  function trackLogin() {
    if (!sess || offline) return;
    fresh().then(function () {
      req('/rest/v1/logins?on_conflict=user_id,day', { method: 'POST', auth: true, headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: { user_id: sess.user.id } }).catch(function () { });
      req('/rest/v1/players?id=eq.' + sess.user.id, { method: 'PATCH', auth: true, headers: { Prefer: 'return=minimal' }, body: { last_seen: new Date().toISOString() } }).catch(function () { });
    }).catch(function () { });
  }

  /* ---------- access: trial, paid, granted ---------- */
  function access() {
    return fresh().then(function () { return req('/rest/v1/rpc/my_access', { method: 'POST', auth: true, body: {} }); })
      .then(function (a) { ACC = a; return a; })
      .catch(function (e) {
        // If the database is unreachable, or the paywall is not installed yet, let the player in.
        if (!e || !e.status || e.status === 404 || (e.body && e.body.code === 'PGRST202')) { ACC = { access: true, status: 'unknown' }; return ACC; }
        throw e;
      });
  }
  function fn(route, body) {
    return fresh().then(function () {
      return fetch(SB + '/functions/v1/phonepe/' + route, { method: 'POST', headers: { apikey: KEY, Authorization: 'Bearer ' + sess.access_token, 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) { var e = new Error(j.error || ('HTTP ' + r.status)); e.status = r.status; throw e; } return j; });
    });
  }
  function pay(onErr) {
    return fn('pay', { returnUrl: here() }).then(function (j) {
      if (j.already) { location.href = here(); return; }
      location.href = j.redirectUrl;
    }).catch(function (e) {
      var m = e.status === 404 || /Failed to fetch/i.test(e.message) ? 'Payments are being set up. Please try again later.' : e.message;
      if (onErr) onErr(m);
    });
  }
  function daysLeft() { if (!ACC || !ACC.trial_ends_at) return null; return Math.max(0, Math.ceil((new Date(ACC.trial_ends_at) - Date.now()) / 86400000)); }

  var FSAuth = {
    get user() { return sess && sess.user; },
    get offline() { return offline; },
    get access() { return ACC; },
    pay: function () { pay(function (m) { if (window.__FS_UI) window.__FS_UI.toast(m, true); }); },
    trackGame: function (S, sc) {
      if (!sess || offline || !S || !S.clientId) return;
      var key = S.clientId + ':' + S.month + ':' + (S.over ? 1 : 0); if (key === lastTrack) return; lastTrack = key;
      var body = { user_id: sess.user.id, client_id: S.clientId, seed: S.seed, archetype: S.archetype, month: S.month, outcome: S.outcome || null, finished: !!S.over, updated_at: new Date().toISOString() };
      if (sc) { body.founder_outcome = Math.round(sc.founderOutcome * 100) / 100; body.decision_quality = Math.round(sc.dq); }
      fresh().then(function () {
        return req('/rest/v1/games?on_conflict=user_id,client_id', { method: 'POST', auth: true, headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: body });
      }).catch(function () { lastTrack = ''; });
    },
    signOut: function () {
      var t = sess; sess = null; ACC = null; save();
      if (t) fetch(SB + '/auth/v1/logout', { method: 'POST', headers: { apikey: KEY, Authorization: 'Bearer ' + t.access_token } }).catch(function () { });
      location.href = here();
    },
    gate: function (cb) {
      var order = new URLSearchParams(location.search).get('order');
      var g = null;
      try { g = googleReturn(); } catch (e) { g = null; }
      var start = g || Promise.resolve(read());
      start.then(function (s) {
        if (g) sess = s; else sess = s;
        if (!sess) return screen(cb);
        return fresh().then(function () {
          trackLogin();
          return (order ? fn('status', { order: order }).catch(function () { return null; }) : Promise.resolve(null));
        }).then(function (st) {
          if (order) history.replaceState(null, '', here());
          return access().then(function (a) {
            if (st && st.status === 'PENDING' && !a.access) return paywall(cb, 'Your payment is still processing. This page checks again when you press the button below.', order);
            if (st && (st.status === 'FAILED' || st.status === 'MISMATCH') && !a.access) return paywall(cb, 'The payment did not go through. You have not been charged twice; you can try again.');
            if (!a.access) return paywall(cb);
            chip(); cb();
            if (st && st.status === 'COMPLETED' && window.__FS_UI) setTimeout(function () { if (window.FSFX) window.FSFX.show('big', { icon: 'medal', kicker: 'Payment received', title: 'Founder\'s Seat is unlocked', sub: 'Thank you. Every game is yours to play.' }); }, 300);
          });
        }).catch(function (e) {
          if (e && e.status) { sess = null; save(); screen(cb, friendly(e)); } else { offline = true; chip(); cb(); }
        });
      }).catch(function (e) { screen(cb, friendly(e)); });
    }
  };
  window.FSAuth = FSAuth;

  /* ---------- account chip in the side rail ---------- */
  function chip() {
    var rf = document.querySelector('.railfoot'); if (!rf || $('acctChip')) return;
    var d = document.createElement('div'); d.id = 'acctChip';
    var left = ACC && ACC.status === 'trial' ? daysLeft() : null;
    d.innerHTML = (left !== null ? '<div class="trial"><span class="mono acc" style="font-size:10px;letter-spacing:.1em">FREE TRIAL · ' + left + ' DAY' + (left === 1 ? '' : 'S') + ' LEFT</span><div class="bar"><i style="width:' + Math.round(left / (ACC.trial_days || 7) * 100) + '%"></i></div><button type="button" class="btn sm ghost" id="unlockBtn">Unlock for ₹' + (ACC.price_inr || 269) + '</button></div>' : '') +
      '<div class="acct">' + (sess ? '<span class="mono faint" style="font-size:10px">' + (ACC && ACC.status === 'paid' ? 'FULL ACCESS' : ACC && ACC.status === 'granted' ? 'PROGRAMME ACCESS' : 'SIGNED IN') + '</span><span class="em2">' + esc(sess.user.email) + '</span><button type="button" id="signOut">Sign out</button>' : '<span class="mono faint" style="font-size:10px">PLAYING OFFLINE</span>') + '</div>';
    rf.appendChild(d);
    var so = $('signOut'); if (so) so.addEventListener('click', function () { FSAuth.signOut(); });
    var ub = $('unlockBtn'); if (ub) ub.addEventListener('click', function () { ub.disabled = true; ub.textContent = 'Opening PhonePe…'; pay(function (m) { ub.disabled = false; ub.textContent = 'Unlock for ₹' + (ACC.price_inr || 269); if (window.__FS_UI) window.__FS_UI.toast(m, true); }); });
  }

  var LOGO = '<a href="../" style="display:flex;align-items:center;gap:10px;color:var(--ivory)"><svg width="22" height="22" viewBox="0 0 28 28" fill="none" stroke="#C9A45C" stroke-width="1.7" aria-hidden="true"><rect x="3" y="3" width="22" height="22"/><path d="M3 12h22M12 12v13"/></svg><b class="mono" style="font-size:12px;letter-spacing:.16em;font-weight:500">FOUNDER\'S SEAT</b></a>';
  var GICON = '<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';

  /* ---------- sign-in screen ---------- */
  function screen(cb, firstErr) {
    var st = $('start'); st.hidden = false; $('app').hidden = true;
    var mode = 'up', vals = {};
    function draw(err, busy) {
      st.innerHTML = '<div class="startin authin">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">' + LOGO + '<span class="pill acc">7-DAY FREE TRIAL</span></div>' +
        '<div class="authgrid"><div style="display:flex;flex-direction:column;gap:16px"><span class="eyebrow acc">Thirty-six months. One company.</span><h1>Take the <span class="em">seat.</span></h1><p class="lede" style="font-size:17px;color:var(--body);line-height:1.55;max-width:520px">Run a post-seed logistics SaaS start-up in Bengaluru: raise, hire, ship, sell, negotiate and survive crises. Play free for 7 days, then unlock everything for a one-time ₹269.</p>' +
        '<div class="how" style="grid-template-columns:1fr 1fr;gap:16px"><div><span class="mono acc" style="font-size:12px">01</span><span class="note">Ten panels: finance, growth, product, team, operations, partners, capital, reports and goals.</span></div><div><span class="mono acc" style="font-size:12px">02</span><span class="note">Graded on judgment: every decision is scored on what you knew at the time.</span></div></div></div>' +
        '<form class="authcard" id="authForm" novalidate>' +
        '<button type="button" class="gbtn" id="gBtn"' + (googleOn === false ? ' disabled title="Google sign-in is not switched on yet"' : '') + '>' + GICON + 'Continue with Google</button>' +
        (googleOn === false ? '<p class="note" style="margin-top:-6px">Google sign-in is coming soon. Use email for now.</p>' : '') +
        '<div class="orline">OR WITH EMAIL</div>' +
        '<div class="seg" role="tablist" aria-label="Account"><button type="button" role="tab" data-mode="up" aria-pressed="' + (mode === 'up') + '">Create account</button><button type="button" role="tab" data-mode="in" aria-pressed="' + (mode === 'in') + '">Sign in</button></div>' +
        (mode === 'up' ? '<label>Your name<input type="text" id="aName" autocomplete="name" required maxlength="80"></label><label><span>College or company <span class="faint">(optional)</span></span><input type="text" id="aInst" autocomplete="organization" maxlength="120"></label>' : '') +
        '<label>Email<input type="email" id="aEmail" autocomplete="email" required></label><label>Password<input type="password" id="aPass" autocomplete="' + (mode === 'up' ? 'new-password' : 'current-password') + '" required minlength="6"></label>' +
        (err ? '<p class="note down" role="alert">' + esc(err) + '</p>' : '') +
        '<button class="btn primary lg" type="submit"' + (busy ? ' disabled' : '') + '>' + (busy ? 'Working…' : mode === 'up' ? 'Create account and start trial' : 'Sign in and play') + '</button>' +
        '<p class="note">We store your name, email and when you play, to count players. No marketing emails. By continuing you agree to the <a href="../terms/">terms</a> and <a href="../privacy/">privacy policy</a>.</p></form></div></div>';
      ['aName', 'aInst', 'aEmail'].forEach(function (id) { if ($(id) && vals[id]) $(id).value = vals[id]; });
      st.querySelectorAll('[data-mode]').forEach(function (b) { b.addEventListener('click', function () { mode = b.getAttribute('data-mode'); draw(); }); });
      $('gBtn').addEventListener('click', function () { $('gBtn').disabled = true; googleStart(); });
      $('authForm').addEventListener('submit', function (ev) {
        ev.preventDefault();
        var email = $('aEmail').value.trim(), pass = $('aPass').value, name = mode === 'up' ? $('aName').value.trim() : '';
        vals = { aName: name, aInst: mode === 'up' ? $('aInst').value.trim() : '', aEmail: email };
        if (mode === 'up' && !name) return draw('Please enter your name.');
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return draw('Please enter a valid email address.');
        if (pass.length < 6) return draw('Use a password of at least 6 characters.');
        var inst = mode === 'up' ? $('aInst').value.trim() : '';
        draw(null, true);
        var p = mode === 'up'
          ? req('/auth/v1/signup', { method: 'POST', body: { email: email, password: pass, data: { name: name, institution: inst } } })
          : req('/auth/v1/token?grant_type=password', { method: 'POST', body: { email: email, password: pass } });
        p.then(take).then(function () { trackLogin(); return access(); }).then(function (a) {
          if (!a.access) return paywall(cb);
          st.hidden = true; chip(); cb();
        }).catch(function (e) { draw(friendly(e)); });
      });
    }
    draw(firstErr);
    checkGoogle().then(function () { if (!st.hidden && $('authForm') && !$('aPass').value) draw(firstErr); });
  }

  /* ---------- paywall ---------- */
  function paywall(cb, msg, pendingOrder) {
    var st = $('start'); st.hidden = false; $('app').hidden = true;
    var price = (ACC && ACC.price_inr) || 269;
    function draw(err, busy) {
      st.innerHTML = '<div class="startin authin">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">' + LOGO + '<span class="mono faint" style="font-size:11px">' + esc(sess.user.email) + ' · <button type="button" class="linkb" id="pwOut">Sign out</button></span></div>' +
        '<div class="authgrid"><div style="display:flex;flex-direction:column;gap:16px"><span class="eyebrow acc">Your free trial has ended</span><h1>Keep the <span class="em">seat.</span></h1>' +
        '<p class="lede" style="font-size:17px;color:var(--body);line-height:1.55;max-width:520px">' + (msg ? esc(msg) : 'You have played your 7 free days. Unlock Founder\'s Seat once and keep playing: every scenario, every seed, every future update.') + '</p></div>' +
        '<div class="pwcard"><span class="eyebrow">One-time payment</span><span class="pwprice">₹' + price + '</span>' +
        '<ul class="pwlist"><li>Unlimited games and replays</li><li>Full reports: P&amp;L, cash flow and MIS</li><li>Debrief that grades every decision</li><li>Cohort seeds to compete with classmates</li></ul>' +
        (err ? '<p class="note down" role="alert">' + esc(err) + '</p>' : '') +
        (pendingOrder ? '<button type="button" class="btn primary lg" id="pwCheck"' + (busy ? ' disabled' : '') + '>' + (busy ? 'Checking…' : 'Check payment status') + '</button>' : '') +
        '<button type="button" class="btn ' + (pendingOrder ? '' : 'primary ') + 'lg" id="pwPay"' + (busy ? ' disabled' : '') + '>' + (busy && !pendingOrder ? 'Opening PhonePe…' : 'Pay ₹' + price + ' with PhonePe') + '</button>' +
        '<p class="note">UPI, cards and net banking through PhonePe\'s secure checkout. No subscription and no auto-renewal. See <a href="../refunds/">refunds</a>. Your programme may already cover access; ask your faculty.</p></div></div></div>';
      $('pwOut').addEventListener('click', function () { FSAuth.signOut(); });
      $('pwPay').addEventListener('click', function () { draw(null, true); pay(function (m) { draw(m); }); });
      var ck = $('pwCheck'); if (ck) ck.addEventListener('click', function () {
        draw(null, true);
        fn('status', { order: pendingOrder }).then(function () { return access(); }).then(function (a) {
          if (a.access) { st.hidden = true; chip(); cb(); } else draw('Still processing. UPI payments can take a couple of minutes.');
        }).catch(function (e) { draw(e.message); });
      });
    }
    draw();
  }
})();
