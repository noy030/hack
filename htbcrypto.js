// ═══════════════════════════════════════════════════════════════════
//  הצפנה קטנה למצב לא-מקוון (ES5, בלי תלות ב-crypto.subtle)
//  • קוד תיבה מוצפן במפתח שמודפס רק ב-QR של אותה תיבה
//  • קודי עזרה נשמרים רק כ-hash איטי (קשה לנחש בכוח)
// ═══════════════════════════════════════════════════════════════════
var HTBCrypto = (function () {
  var K = [
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
  ];

  function utf8(str) {
    var s = unescape(encodeURIComponent(str)), out = [];
    for (var i = 0; i < s.length; i++) out.push(s.charCodeAt(i));
    return out;
  }
  function fromUtf8(bytes) {
    var s = ''; for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    try { return decodeURIComponent(escape(s)); } catch (e) { return null; }
  }

  // SHA-256 over a byte array → byte array (32)
  function sha256(bytes) {
    var H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
    var l = bytes.length, msg = bytes.slice(0);
    msg.push(0x80);
    while (msg.length % 64 !== 56) msg.push(0);
    var bits = l * 8;
    msg.push(0, 0, 0, 0, (bits >>> 24) & 255, (bits >>> 16) & 255, (bits >>> 8) & 255, bits & 255);
    var W = new Array(64);
    for (var off = 0; off < msg.length; off += 64) {
      for (var t = 0; t < 16; t++) W[t] = (msg[off+t*4] << 24) | (msg[off+t*4+1] << 16) | (msg[off+t*4+2] << 8) | msg[off+t*4+3];
      for (t = 16; t < 64; t++) {
        var x = W[t-15], y = W[t-2];
        var s0 = ((x >>> 7) | (x << 25)) ^ ((x >>> 18) | (x << 14)) ^ (x >>> 3);
        var s1 = ((y >>> 17) | (y << 15)) ^ ((y >>> 19) | (y << 13)) ^ (y >>> 10);
        W[t] = (W[t-16] + s0 + W[t-7] + s1) | 0;
      }
      var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (t = 0; t < 64; t++) {
        var S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
        var ch = (e & f) ^ (~e & g);
        var t1 = (h + S1 + ch + K[t] + W[t]) | 0;
        var S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
        var maj = (a & b) ^ (a & c) ^ (b & c);
        var t2 = (S0 + maj) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    var out = [];
    for (var i = 0; i < 8; i++) out.push((H[i] >>> 24) & 255, (H[i] >>> 16) & 255, (H[i] >>> 8) & 255, H[i] & 255);
    return out;
  }
  function hex(bytes) { var s = ''; for (var i = 0; i < bytes.length; i++) s += (bytes[i] < 16 ? '0' : '') + bytes[i].toString(16); return s; }
  function unhex(s) { var out = []; for (var i = 0; i + 1 < s.length; i += 2) out.push(parseInt(s.substr(i, 2), 16)); return out; }
  function shaHex(str) { return hex(sha256(utf8(str))); }

  // ── box codes: XOR with a keystream derived from the QR key, + 2-byte check ──
  function stream(box, key, n) {
    var out = [], ctr = 0;
    while (out.length < n) { out = out.concat(sha256(utf8('HTB|' + box + '|' + key + '|' + ctr))); ctr++; }
    return out.slice(0, n);
  }
  function encryptCode(box, key, code) {
    var plain = utf8(code), chk = sha256(utf8('CHK|' + code)).slice(0, 2), data = plain.concat(chk);
    var ks = stream(box, key, data.length), out = [];
    for (var i = 0; i < data.length; i++) out.push(data[i] ^ ks[i]);
    return hex(out);
  }
  function decryptCode(box, key, encHex) {
    if (!key || !encHex) return null;
    var data = unhex(encHex), ks = stream(box, key, data.length), plain = [];
    for (var i = 0; i < data.length; i++) plain.push(data[i] ^ ks[i]);
    var code = fromUtf8(plain.slice(0, -2));
    if (code == null) return null;
    var chk = sha256(utf8('CHK|' + code)).slice(0, 2);
    return (chk[0] === plain[plain.length - 2] && chk[1] === plain[plain.length - 1]) ? code : null;   // wrong key → null
  }

  // ── help codes: slow hash, so the published list can't be brute-forced quickly ──
  var ROUNDS = 2000;
  function helpHash(code) {
    var b = utf8('HTBH|' + code);
    for (var i = 0; i < ROUNDS; i++) b = sha256(b);
    return hex(b).slice(0, 24);
  }

  var ALPHABET = 'ACDEFHJKLMNPQRTUVWXY34679';   // no lookalikes (0/O, 1/I, 2/Z, 5/S, 8/B)
  function randomCode(n) {
    var buf = new Uint32Array(n), s = '';
    (window.crypto || window.msCrypto).getRandomValues(buf);
    for (var i = 0; i < n; i++) s += ALPHABET.charAt(buf[i] % ALPHABET.length);
    return s;
  }

  return { sha256Hex: shaHex, encryptCode: encryptCode, decryptCode: decryptCode, helpHash: helpHash, randomCode: randomCode };
})();
