'use strict';

const Gen = (function () {
  const registry = new Map();

  const rndInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
  const pick = (arr) => arr[rndInt(0, arr.length - 1)];
  const pad = (n, len) => String(n).padStart(len, '0');
  const digits = (s) => s.split('').map(Number);
  const coinFlip = () => Math.random() < 0.5;
  const randomDigits = (n) => Array.from({ length: n }, () => rndInt(0, 9)).join('');
  const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
  const fmtDate = (b) => `${b.y}-${pad(b.m, 2)}-${pad(b.d, 2)}`;

  function randomBirthDate(minAge, maxAge) {
    const now = new Date();
    const oldest = Date.UTC(now.getUTCFullYear() - maxAge, now.getUTCMonth(), now.getUTCDate());
    const newest = Date.UTC(now.getUTCFullYear() - minAge, now.getUTCMonth(), now.getUTCDate());
    const d = new Date(rndInt(oldest, newest));
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() };
  }

  /** "1990-03-15" -> {y,m,d}; empty/invalid -> null */
  function parseDate(value) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((value || '').trim());
    if (!m) return null;
    const y = +m[1], mo = +m[2], d = +m[3];
    if (mo < 1 || mo > 12 || d < 1 || d > daysInMonth(y, mo)) return null;
    return { y, m: mo, d };
  }

  /* ----------------------------------------------------------------- IBAN */

  /** ISO 7064 mod-97-10, streamed so we never exceed Number precision. */
  function mod97(input) {
    let rem = 0;
    for (const ch of input.toUpperCase()) {
      const code = ch.charCodeAt(0);
      const part = code >= 65 && code <= 90 ? String(code - 55) : ch;
      for (const d of part) rem = (rem * 10 + (d.charCodeAt(0) - 48)) % 97;
    }
    return rem;
  }

  const ibanCheckDigits = (cc, bban) => pad(98 - mod97(`${bban}${cc}00`), 2);
  const groupIban = (s) => s.replace(/(.{4})(?=.)/g, '$1 ');

  /** Shared IBAN validation: charset, country, length, mod-97. */
  function checkIban(raw, expected) {
    const s = raw.replace(/[\s-]/g, '').toUpperCase();
    if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(s)) {
      return { valid: false, reason: 'An IBAN is 2 country letters, 2 check digits, then the national account number.' };
    }
    if (s.slice(0, 2) !== expected.cc) {
      return { valid: false, reason: `Country code is ${s.slice(0, 2)}, expected ${expected.cc}.` };
    }
    if (s.length !== expected.length) {
      return { valid: false, reason: `${expected.cc} IBANs are ${expected.length} characters, got ${s.length}.` };
    }
    if (mod97(s.slice(4) + s.slice(0, 4)) !== 1) {
      const correct = ibanCheckDigits(expected.cc, s.slice(4));
      return { valid: false, reason: `Mod-97 check failed — check digits should be ${correct}, got ${s.slice(2, 4)}.` };
    }
    return { valid: true, s };
  }

  const optionList = (rows, randomLabel = 'Random') =>
    [['random', randomLabel]].concat(
      (Array.isArray(rows) ? rows : Object.entries(rows)).map(([code, name]) => [code, `${code} — ${name}`]));

  return {
    rndInt, pick, pad, digits, coinFlip, randomDigits, daysInMonth, fmtDate,
    randomBirthDate, parseDate,
    mod97, ibanCheckDigits, groupIban, checkIban,
    optionList,

    register(key, def) { registry.set(key, def); },
    country(key) { return registry.get(key); },
  };
})();

/* Exported for a Node self-test (harmless in the browser). */
if (typeof module !== 'undefined' && module.exports) module.exports = Gen;
