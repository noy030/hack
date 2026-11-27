// ═══════════════════════════════════════════════════════════════════
//  Service Worker — שומר את כל המשחק על הטלפון כדי שיעבוד ביער בלי קליטה.
//  אחרי כל שינוי בקבצים: להעלות את VERSION באחד, כדי שהטלפונים יורידו מחדש.
// ═══════════════════════════════════════════════════════════════════
var VERSION = 'htb-v4';
// the game can't run without these — if one fails, the install fails and retries next visit
var CORE = [
  'router.html', 'prep.html', 'shooter.html', 'sequence.html', 'nodes.html',
  'boxes.js', 'htbcrypto.js', 'htb.js', 'manifest.json', 'icon.svg'
];
// nice to have — a missing track must not block the whole offline install
var MUSIC = [
  'music/01.mp3', 'music/02.mp3', 'music/03.mp3', 'music/04.mp3', 'music/05.mp3',
  'music/06.mp3', 'music/07.mp3', 'music/08.mp3', 'music/09.mp3', 'music/10.mp3'
];
var FILES = CORE.concat(MUSIC);
var FONT_CSS = 'https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Rajdhani:wght@300;500;700&display=swap';

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) {
    // cache:'reload' — skip the HTTP cache so a new VERSION really gets fresh files
    function grab(f) {
      return fetch(new Request(f, { cache: 'reload' })).then(function (r) {
        if (!r.ok) throw new Error(f + ' ' + r.status);
        return c.put(f, r);
      });
    }
    return Promise.all(CORE.map(grab)).then(function () {
      return Promise.all(MUSIC.map(function (f) { return grab(f)['catch'](function () {}); }));
    }).then(function () {
      // fonts are nice-to-have: never fail the install over them
      return fetch(FONT_CSS).then(function (r) { return c.put(FONT_CSS, r.clone()).then(function () { return r.text(); }); })
        .then(function (css) {
          var urls = css.match(/https:\/\/fonts\.gstatic\.com[^)'"]+/g) || [];
          return Promise.all(urls.map(function (u) { return fetch(u, { mode: 'no-cors' }).then(function (r) { return c.put(u, r); }); }));
        })['catch'](function () {});
    });
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches['delete'](k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('message', function (e) {
  if (e.data === 'status') {
    caches.open(VERSION).then(function (c) {
      return Promise.all(FILES.map(function (f) { return c.match(f, { ignoreSearch: true }); }));
    }).then(function (hits) {
      var have = hits.filter(function (h) { return !!h; }).length;
      e.source.postMessage({ type: 'status', version: VERSION, have: have, total: FILES.length });
    });
  }
});

// audio elements ask for byte ranges; Safari refuses to play a plain 200 for those
function rangeResponse(req, resp) {
  var m = /bytes=(\d+)-(\d*)/.exec(req.headers.get('range') || '');
  if (!m) return resp;
  return resp.arrayBuffer().then(function (buf) {
    var start = parseInt(m[1], 10), end = m[2] ? parseInt(m[2], 10) : buf.byteLength - 1;
    if (start >= buf.byteLength) return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + buf.byteLength } });
    end = Math.min(end, buf.byteLength - 1);
    return new Response(buf.slice(start, end + 1), {
      status: 206,
      headers: {
        'Content-Type': resp.headers.get('Content-Type') || 'audio/mpeg',
        'Content-Range': 'bytes ' + start + '-' + end + '/' + buf.byteLength,
        'Content-Length': String(end - start + 1),
        'Accept-Ranges': 'bytes'
      }
    });
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  var sameOrigin = url.origin === self.location.origin;
  var isFont = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!sameOrigin && !isFont) return;          // Firebase etc. → straight to network

  if (sameOrigin && /\.mp3$/.test(url.pathname)) {
    e.respondWith(caches.match(url.pathname.replace(/^.*\/music\//, 'music/'), { ignoreSearch: true }).then(function (hit) {
      return hit ? rangeResponse(req, hit) : fetch(req);
    }));
    return;
  }

  // cache first (works offline), refresh in the background when there is signal
  e.respondWith(caches.open(VERSION).then(function (c) {
    return c.match(req, { ignoreSearch: true }).then(function (hit) {
      var net = fetch(req).then(function (r) {
        if (r && (r.ok || r.type === 'opaque') && !url.search) c.put(req, r.clone());
        return r;
      });
      if (hit) { net['catch'](function () {}); return hit; }
      return net;
    });
  }));
});
