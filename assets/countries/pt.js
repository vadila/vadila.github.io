/* Portugal — Cartão de Cidadão number, NISS, and the IBAN built on a 21-digit NIB. */
'use strict';

(function (Gen) {
  const { rndInt, pick, pad, digits, coinFlip, randomDigits, mod97, ibanCheckDigits, groupIban, checkIban, optionList } = Gen;

  /* ------------------------------------------- Cartão de Cidadão (CC) */

  /** Check digit of the 8-digit civil ID (old BI rule): weights 9..2, mod 11. 10 is written as 0. */
  function civilCheckDigit(eight) {
    const sum = digits(eight).reduce((acc, d, i) => acc + d * (9 - i), 0);
    const r = (11 - (sum % 11)) % 11;
    return r; // 0–10; the caller decides what to do with the ambiguous 10
  }

  const CC_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  /** Final CC check digit over the first 11 characters (autenticacao.gov spec): Luhn-like, letters A=10…Z=35. */
  function ccCheckDigit(eleven) {
    let sum = 0;
    [...eleven].reverse().forEach((ch, i) => {
      let v = CC_ALPHABET.indexOf(ch);
      if (i % 2 === 0) { v *= 2; if (v > 9) v -= 9; }
      sum += v;
    });
    return String((10 - (sum % 10)) % 10);
  }

  const fmtCc = (s) => `${s.slice(0, 8)} ${s[8]} ${s.slice(9)}`;

  const id = {
    generate(v) {
      let civil, check;
      do { // a civil ID whose check would be 10 is printed ambiguously as 0 — skip those
        civil = pad(rndInt(10000000, 39999999), 8);
        check = civilCheckDigit(civil);
      } while (check === 10);
      const version = v.version === 'random' ? pick(['ZZ', 'ZY', 'ZX']) : v.version;
      const eleven = civil + check + version;
      const code = eleven + ccCheckDigit(eleven);
      return {
        code: v.format === 'plain' ? code : fmtCc(code),
        meta: `Civil ID ${civil}-${check} · version ${version}`,
      };
    },

    validate(raw) {
      const s = raw.replace(/[\s-]/g, '').toUpperCase();
      if (!/^\d{9}[A-Z0-9]{2}\d$/.test(s)) {
        return { valid: false, reason: 'Expected 8 digits + 1 check digit + 2-character version + 1 check digit, e.g. 00000000 0 ZZ4.' };
      }
      const expected = ccCheckDigit(s.slice(0, 11));
      if (expected !== s[11]) return { valid: false, reason: `Wrong final check digit — expected ${expected}, got ${s[11]}.` };

      const civil = s.slice(0, 8);
      const civilCheck = civilCheckDigit(civil);
      const info = [];
      if (civilCheck === 10 && s[8] === '0') {
        info.push(`Civil ID ${civil}-0 (computed 10, written as 0)`);
      } else if (String(civilCheck) !== s[8]) {
        return { valid: false, reason: `Civil ID check digit is wrong — expected ${civilCheck === 10 ? '0 (10)' : civilCheck}, got ${s[8]}.` };
      } else {
        info.push(`Civil ID ${civil}-${civilCheck} ✓`);
      }
      info.push(`Version ${s.slice(9, 11)}`, `Final check digit ${expected} ✓`);
      return { valid: true, info };
    },
  };

  /* ------------------------------------- NISS (Segurança Social number) */

  const NISS_WEIGHTS = [29, 23, 19, 17, 13, 11, 7, 5, 3, 2];

  function nissCheckDigit(ten) {
    const sum = digits(ten).reduce((acc, d, i) => acc + d * NISS_WEIGHTS[i], 0);
    return String(9 - (sum % 10));
  }

  const niss = {
    generate(v) {
      const kind = v.kind === 'random' ? (coinFlip() ? 'person' : 'company') : v.kind;
      const prefix = (kind === 'person' ? '1' : '2') + pick(['0', '1']);
      const ten = prefix + randomDigits(8);
      return {
        code: ten + nissCheckDigit(ten),
        meta: kind === 'person' ? 'Pessoa singular (individual)' : 'Pessoa coletiva (legal entity)',
      };
    },

    validate(raw) {
      const s = raw.replace(/[\s-]/g, '');
      if (!/^\d{11}$/.test(s)) return { valid: false, reason: 'NISS must be exactly 11 digits.' };
      if (s[0] !== '1' && s[0] !== '2') {
        return { valid: false, reason: `First digit is ${s[0]} — must be 1 (individual) or 2 (legal entity).` };
      }
      const expected = nissCheckDigit(s.slice(0, 10));
      if (expected !== s[10]) return { valid: false, reason: `Wrong check digit — expected ${expected}, got ${s[10]}.` };
      return {
        valid: true,
        info: [s[0] === '1' ? 'Pessoa singular (individual)' : 'Pessoa coletiva (legal entity)', `Check digit ${expected} ✓`],
      };
    },
  };

  /* ----------------------------------------------------------------- IBAN */

  /** NIB control digits: 98 − (banco+balcão+conta × 100) mod 97, over the first 19 digits. */
  const nibCheckDigits = (nineteen) => pad(98 - mod97(nineteen + '00'), 2);

  const BANKS = [
    ['0035', 'Caixa Geral de Depósitos'], ['0033', 'Millennium BCP'],
    ['0018', 'Banco Santander Totta'], ['0010', 'Banco BPI'], ['0007', 'Novo Banco'],
    ['0036', 'Banco Montepio'], ['0045', 'Crédito Agrícola'], ['0023', 'ActivoBank'],
    ['0079', 'Banco BIC Português'], ['0061', 'Banco BiG'], ['0193', 'Banco CTT'],
    ['0269', 'Bankinter'], ['0019', 'BBVA'], ['0781', 'IGCP — Tesouraria do Estado'],
  ];

  const spaced = (nib) => `${nib.slice(0, 4)} ${nib.slice(4, 8)} ${nib.slice(8, 19)} ${nib.slice(19)}`;

  const bank = {
    generate(v) {
      const [code, name] = v.bank === 'random' ? pick(BANKS) : BANKS.find(([c]) => c === v.bank);
      const body = code + randomDigits(4) + randomDigits(11);
      const nib = body + nibCheckDigits(body);
      const iban = 'PT' + ibanCheckDigits('PT', nib) + nib;
      return {
        code: v.format === 'plain' ? iban : groupIban(iban),
        meta: `${name} · NIB ${spaced(nib)}`,
      };
    },

    validate(raw) {
      const res = checkIban(raw, { cc: 'PT', length: 25 });
      if (!res.valid) return res;
      const nib = res.s.slice(4);
      if (!/^\d{21}$/.test(nib)) return { valid: false, reason: 'The NIB after "PTkk" must be 21 digits.' };
      const [code, balcao, conta, dc] = [nib.slice(0, 4), nib.slice(4, 8), nib.slice(8, 19), nib.slice(19)];
      const expected = nibCheckDigits(nib.slice(0, 19));
      if (expected !== dc) {
        return { valid: false, reason: `IBAN checksum is fine but the NIB control digits are wrong — expected ${expected}, got ${dc}.` };
      }
      const found = BANKS.find(([c]) => c === code);
      return {
        valid: true,
        info: [
          found ? `Banco ${code} — ${found[1]}` : `Banco ${code} (not in the built-in list)`,
          `Balcão ${balcao} · conta ${conta}`,
          `NIB control digits ${dc} ✓`,
          'Mod-97 IBAN check ✓',
        ],
      };
    },
  };

  Gen.register('PT', {
    options: { banks: optionList(BANKS) },
    docs: { id, niss, bank },
    // Checksum helpers, reachable as Gen.country('PT').internals for a self-test.
    internals: { civilCheckDigit, ccCheckDigit, nissCheckDigit, nibCheckDigits },
  });
})(typeof Gen !== 'undefined' ? Gen : require('../core.js'));
