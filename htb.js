// ═══════════════════════════════════════════════════════════════════
//  HACK THE BOX — ליבה משותפת לכל המשחקים
//  Firebase (REST), זהות שחקן, דיווח ניצחונות, קוד פתיחה, קודי עזרה.
//  ES5 בלבד — בלי let/const/=>/`template`/async — בגלל WebView ישנים.
//  דורש: boxes.js נטען לפני הקובץ הזה.
// ═══════════════════════════════════════════════════════════════════
var HTB = (function () {
  var FB_URL     = 'https://hack-the-box-larp-default-rtdb.europe-west1.firebasedatabase.app';
  var FB_API_KEY = 'AIzaSyBQylFseHge48iq3U5CqgJJZPdHM5QHbtA';
  var LS = window.localStorage;

  // ── utils ───────────────────────────────────────────────────────
  function lsGet(k) { try { return LS.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { LS.setItem(k, v); } catch (e) {} }
  function lsDel(k) { try { LS.removeItem(k); } catch (e) {} }
  function $(id) { return document.getElementById(id); }
  function extend(a, b) { for (var k in b) if (b.hasOwnProperty(k)) a[k] = b[k]; return a; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function param(name) {
    var m = new RegExp('[?&]' + name + '=([^&#]*)').exec(location.search);
    return m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : null;
  }
  function vibe(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} }

  // ── HTTP (XHR, callbacks) ───────────────────────────────────────
  // cb(status, json) — status 0 = network error / timeout
  function http(method, url, body, contentType, cb) {
    var r = new XMLHttpRequest();
    r.open(method, url, true);
    r.timeout = 12000;
    if (body != null) r.setRequestHeader('Content-Type', contentType || 'application/json');
    r.onload = function () {
      var data = null;
      try { data = JSON.parse(r.responseText); } catch (e) {}
      cb(r.status, data);
    };
    r.onerror = r.ontimeout = function () { cb(0, null); };
    r.send(body == null ? null : (typeof body === 'string' ? body : JSON.stringify(body)));
  }

  // ── Auth: anonymous user that persists across boxes ─────────────
  var auth = { uid: lsGet('htb_uid'), refresh: lsGet('htb_refresh'), token: null, exp: 0 };
  var authWaiters = null;

  function getToken(cb) {
    if (auth.token && Date.now() < auth.exp) return cb(auth.token);
    if (authWaiters) { authWaiters.push(cb); return; }
    authWaiters = [cb];
    function done(tok) { var w = authWaiters; authWaiters = null; for (var i = 0; i < w.length; i++) w[i](tok); }

    if (auth.refresh) {
      http('POST', 'https://securetoken.googleapis.com/v1/token?key=' + FB_API_KEY,
        'grant_type=refresh_token&refresh_token=' + encodeURIComponent(auth.refresh),
        'application/x-www-form-urlencoded',
        function (st, d) {
          if (st === 200 && d && d.id_token) {
            setAuth(d.user_id, d.refresh_token, d.id_token, d.expires_in);
            done(auth.token);
          } else if (st === 0) {
            done(null);
          } else {
            auth.refresh = null; lsDel('htb_refresh');
            authWaiters = null; getToken(cb);   // refresh token dead → new anonymous user
          }
        });
      return;
    }
    http('POST', 'https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=' + FB_API_KEY,
      { returnSecureToken: true }, null,
      function (st, d) {
        if (st === 200 && d && d.idToken) {
          setAuth(d.localId, d.refreshToken, d.idToken, d.expiresIn);
          done(auth.token);
        } else done(null);
      });
  }
  function setAuth(uid, refresh, token, expiresIn) {
    auth.uid = uid; auth.refresh = refresh; auth.token = token;
    auth.exp = Date.now() + (parseInt(expiresIn, 10) || 3600) * 1000 - 60000;
    lsSet('htb_uid', uid); lsSet('htb_refresh', refresh);
  }

  // ── DB ──────────────────────────────────────────────────────────
  function db(method, path, data, cb) {
    getToken(function (tok) {
      if (!tok) { conn(false); if (cb) cb(0, null); return; }
      http(method, FB_URL + '/' + path + '.json?auth=' + tok, data, null, function (st, d) {
        conn(st !== 0);
        if (cb) cb(st, d);
      });
    });
  }
  function conn(ok) { var el = $('conn-status'); if (el) el.style.display = ok ? 'none' : 'block'; }

  // ── State ───────────────────────────────────────────────────────
  var S = {
    game: null, box: null, cfg: null, name: lsGet('htb_name') || '',
    code: null, playStart: 0, helped: [], paused: false, effects: {}
  };
  function attemptsKey() { return 'htb_attempts_' + S.box; }
  function attempts() { return parseInt(lsGet(attemptsKey()) || '0', 10); }

  // ── Init: box config by number only — nothing secret in the URL ─
  function init(game) {
    S.game = game;
    S.box = param('box');
    var base = (typeof BOXES !== 'undefined' && BOXES[S.box]) ? BOXES[S.box] : null;
    if (!base || base.game !== game) {
      document.body.innerHTML = '<div style="position:fixed;top:0;left:0;width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;background:#0e0d0b;color:#cc3300;font-family:monospace;letter-spacing:3px;text-align:center">BOX NOT FOUND<span style="font-size:11px;color:#6a6458">CHECK QR CODE AND TRY AGAIN</span></div>';
      throw new Error('HTB: unknown box ' + S.box);
    }
    S.cfg = extend({}, base);
    initName();
    prefetchCode();
    flushPending();
    setInterval(function () { heartbeat(); flushPending(); }, 30000);
    return S.cfg;
  }

  // ── Player name ─────────────────────────────────────────────────
  function initName() {
    var ns = $('name-screen'), inp = $('player-name-input'), btn = $('name-submit');
    if (!ns || !inp || !btn) return;
    if (S.name) { ns.style.display = 'none'; heartbeat(); return; }
    function submit() {
      var n = inp.value.replace(/^\s+|\s+$/g, '').slice(0, 20);
      if (!n) { inp.style.borderBottomColor = 'var(--red)'; inp.focus(); return; }
      S.name = n; lsSet('htb_name', n);
      ns.style.display = 'none';
      heartbeat();
    }
    btn.addEventListener('click', submit);
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.keyCode === 13) submit(); });
    setTimeout(function () { inp.focus(); }, 200);
  }

  function heartbeat() {
    if (!S.name) return;
    getToken(function (tok) {
      if (!tok) return;
      var now = Date.now();
      db('PATCH', 'players/' + auth.uid, {
        name: S.name, lastSeen: now, currentBox: S.box,
        currentBoxTitle: S.cfg.title, currentGame: S.game
      });
      db('GET', 'players/' + auth.uid + '/firstSeen', null, function (st, d) {
        if (st === 200 && d == null) db('PUT', 'players/' + auth.uid + '/firstSeen', now);
      });
    });
  }

  // ── Box unlock code: fetched from DB, never in the URL ──────────
  function prefetchCode(cb) {
    if (S.code) { if (cb) cb(S.code); return; }
    db('GET', 'boxCodes/' + S.box, null, function (st, d) {
      if (st === 200 && d != null && d !== '') S.code = String(d);
      if (cb) cb(S.code);
    });
  }

  // ── Results ─────────────────────────────────────────────────────
  function startPlay() { if (!S.playStart) S.playStart = Date.now(); }
  function fail() { lsSet(attemptsKey(), String(attempts() + 1)); }

  function win() {
    var rec = {
      boxId: S.box, boxTitle: S.cfg.title, game: S.game, winTime: Date.now(),
      attempts: attempts(), playMs: S.playStart ? Date.now() - S.playStart : 0,
      helped: S.helped.join('') || null
    };
    lsDel(attemptsKey());
    // queue first, so a win is never lost if the network drops
    var pend = pending(); pend[S.box] = rec; lsSet('htb_pending', JSON.stringify(pend));
    flushPending();
    showCode();
  }
  function pending() { try { return JSON.parse(lsGet('htb_pending') || '{}') || {}; } catch (e) { return {}; } }
  function flushPending() {
    var pend = pending(), keys = Object.keys(pend);
    if (!keys.length || !S.name) return;
    getToken(function (tok) {
      if (!tok) return;
      keys.forEach(function (bx) {
        db('PUT', 'players/' + auth.uid + '/boxes/' + bx, pend[bx], function (st) {
          if (st === 200) {
            var p = pending(); delete p[bx]; lsSet('htb_pending', JSON.stringify(p));
            db('PATCH', 'players/' + auth.uid, { name: S.name, lastSeen: Date.now() });
          }
        });
      });
    });
  }

  function showCode() {
    var wc = $('wincode'), ws = $('winscreen'), scb = $('show-code-btn');
    if (ws) ws.style.display = 'flex';
    if (scb) { scb.style.display = 'block'; scb.onclick = showCode; }
    if (S.code) { wc.textContent = S.code; return; }
    wc.textContent = '····';
    prefetchCode(function (code) {
      wc.textContent = code || '✕';
      if (!code) popup('NO SIGNAL', 'אין חיבור — לחץ "הצג קוד" שוב', 'תיבה ' + S.box, '#c43000', 3000);
    });
  }

  // ── Popups ──────────────────────────────────────────────────────
  function popup(header, body, sub, color, duration) {
    if (!$('nie-pop-style')) {
      var s = document.createElement('style'); s.id = 'nie-pop-style';
      s.textContent = '@keyframes nie-pop{from{transform:scale(0.7);opacity:0;}to{transform:scale(1);opacity:1;}}';
      document.head.appendChild(s);
    }
    var div = document.createElement('div');
    div.style.cssText = 'position:fixed;left:' + (8 + Math.random() * 45) + '%;top:' + (12 + Math.random() * 50) +
      '%;background:#e8e3da;border:2px solid ' + color + ";font-family:'Share Tech Mono',monospace;font-size:clamp(10px,2.5vw,13px);" +
      'padding:10px 14px;box-shadow:4px 4px 0 rgba(0,0,0,0.15);z-index:6000;pointer-events:none;animation:nie-pop .15s ease-out;max-width:min(260px,60vw);';
    div.innerHTML = '<div style="background:' + color + ';color:#fff;margin:-10px -14px 8px;padding:3px 8px;font-size:clamp(9px,2vw,11px);letter-spacing:2px;">' + esc(header) +
      '</div><div style="color:#2a2520;letter-spacing:1px;line-height:1.6;">' + esc(body) + '</div>' +
      (sub ? '<div style="color:#6e6860;font-size:clamp(9px,2vw,10px);margin-top:4px;">' + esc(sub) + '</div>' : '');
    document.body.appendChild(div);
    setTimeout(function () { if (div.parentNode) div.parentNode.removeChild(div); }, duration);
  }
  function errorBurst(lines, cb) {
    var i = 0;
    var iv = setInterval(function () {
      var pair = lines[i % lines.length];
      popup(pair[0], pair[1], '', '#c43000', 900);
      i++;
      if (i >= 7) { clearInterval(iv); setTimeout(cb, 500); }
    }, 160);
  }

  // ── Help codes ──────────────────────────────────────────────────
  // effects: { T:{label, can:fn→true|'reason', apply:fn}, W:..., L:..., E:... }
  // opts: { onOpen, onClose, fab:'top'|'bottom' }
  function help(effects, opts) {
    opts = opts || {};
    S.effects = effects;
    var overlay = $('help-overlay'), input = $('help-input'), msg = $('help-msg');
    var btn = $('help-btn'), submitBtn = $('help-submit');
    if (!overlay) return;
    document.body.appendChild(overlay);   // was inside #startscreen → invisible during play

    var fab = document.createElement('button');
    fab.id = 'htb-help-fab'; fab.textContent = '🔑';
    fab.setAttribute('aria-label', 'קוד עזרה');
    fab.style.cssText = 'position:fixed;' + (opts.fab === 'top'
      ? 'top:max(8px,env(safe-area-inset-top,0px));right:max(84px,env(safe-area-inset-right,0px));'
      : 'bottom:max(10px,env(safe-area-inset-bottom,0px));left:10px;') +
      'width:40px;height:40px;border-radius:50%;border:1px solid rgba(74,69,58,0.4);background:rgba(232,227,218,0.85);' +
      'font-size:18px;z-index:120;display:none;cursor:pointer;padding:0;';
    document.body.appendChild(fab);

    var busy = false;
    function setMsg(t, cls) { msg.textContent = t; msg.className = cls ? 'help-msg ' + cls : 'help-msg'; }
    function open() {
      overlay.classList.add('show'); input.value = ''; setMsg('');
      S.paused = true; if (opts.onOpen) opts.onOpen();
      setTimeout(function () { input.focus(); }, 100);
    }
    function close() {
      overlay.classList.remove('show');
      if (S.paused) { S.paused = false; if (opts.onClose) opts.onClose(); }
    }
    if (btn) btn.addEventListener('click', open);
    fab.addEventListener('click', open);
    $('help-cancel').addEventListener('click', close);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.keyCode === 13) submitBtn.click(); });

    submitBtn.addEventListener('click', function () {
      if (busy) return;
      var code = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (code.length < 4) { setMsg('קוד קצר מדי', 'bad'); return; }
      if (!S.name) { setMsg('הזדהה קודם', 'bad'); return; }
      busy = true; setMsg('מאמת...');
      db('GET', 'helpCodeDefs/' + code, null, function (st, def) {
        if (st === 0) { busy = false; setMsg('אין חיבור — הקוד לא נוצל, נסה שוב', 'bad'); return; }
        var eff = def && effects[def.type];
        if (!eff) { busy = false; setMsg('קוד לא מוכר', 'bad'); vibe([150]); return; }
        var can = eff.can ? eff.can() : true;
        if (can !== true) { busy = false; setMsg(can + ' — הקוד לא נוצל', 'bad'); return; }
        // one-time claim — enforced by DB rules (write only if it doesn't exist yet)
        db('PUT', 'helpCodes/' + code, {
          uid: auth.uid, player: S.name, boxId: S.box, type: def.type, effect: eff.label, ts: Date.now()
        }, function (st2) {
          busy = false;
          if (st2 === 0) { setMsg('אין חיבור — הקוד לא נוצל, נסה שוב', 'bad'); return; }
          if (st2 !== 200) { setMsg('קוד זה כבר שומש', 'bad'); vibe([150]); return; }
          S.helped.push(def.type);
          setMsg(eff.label, 'ok'); vibe([80, 40, 80, 40, 120]);
          if (btn) { btn.textContent = '✓ ' + eff.label; btn.style.color = '#5a8a4a'; btn.style.borderColor = '#5a8a4a'; }
          setTimeout(function () { close(); eff.apply(); }, 900);
        });
      });
    });
    return { showFab: function (on) { fab.style.display = on ? 'block' : 'none'; }, close: close };
  }

  // ── Background music ────────────────────────────────────────────
  var bgm = document.createElement('audio');
  bgm.loop = true; bgm.volume = 0.6; bgm.preload = 'none';
  bgm.src = 'music/' + ('0' + (1 + Math.floor(Math.random() * 10))).slice(-2) + '.mp3';
  function startBGM() { if (!bgm.parentNode) document.body.appendChild(bgm); if (bgm.paused) { var p = bgm.play(); if (p && p['catch']) p['catch'](function () {}); } }
  function stopBGM() { bgm.pause(); try { bgm.currentTime = 0; } catch (e) {} }

  return {
    init: init, cfg: function () { return S.cfg; }, box: function () { return S.box; },
    isPaused: function () { return S.paused; },
    startPlay: startPlay, win: win, fail: fail, showCode: showCode, heartbeat: heartbeat,
    help: help, popup: popup, errorBurst: errorBurst, vibe: vibe, esc: esc,
    startBGM: startBGM, stopBGM: stopBGM
  };
})();
