/* Spain — DNI / NIE, and the IBAN built on a 20-digit CCC. */
'use strict';

(function (Gen) {
  const { rndInt, pick, pad, digits, coinFlip, randomDigits, ibanCheckDigits, groupIban, checkIban, optionList } = Gen;

  /* - DNI / NIE */

  const DNI_LETTERS = 'TRWAGMYFPDXBNJZSQVHLCKE';
  const dniLetter = (n) => DNI_LETTERS[n % 23];

  const id = {
    generate(v) {
      const kind = v.kind === 'random' ? (coinFlip() ? 'dni' : 'nie') : v.kind;
      let body, letter, meta;

      if (kind === 'dni') {
        const n = rndInt(1000000, 99999999);
        body = pad(n, 8);
        letter = dniLetter(n);
        meta = 'DNI · Spanish national';
      } else {
        const prefix = v.niePrefix && v.niePrefix !== 'random' ? v.niePrefix : pick(['X', 'Y', 'Z']);
        const rest = pad(rndInt(0, 9999999), 7);
        body = prefix + rest;
        letter = dniLetter(Number(String('XYZ'.indexOf(prefix)) + rest));
        meta = `NIE · foreign resident · ${prefix} series`;
      }

      return { code: body + (v.formatted === 'dash' ? '-' : '') + letter, meta };
    },

    validate(raw) {
      const s = raw.replace(/[\s-]/g, '').toUpperCase();
      if (!/^[0-9XYZ][0-9]{7}[A-Z]$/.test(s)) {
        return { valid: false, reason: 'Expected 8 digits + letter (DNI) or X/Y/Z + 7 digits + letter (NIE).' };
      }
      const isNie = /^[XYZ]/.test(s);
      const numeric = isNie ? String('XYZ'.indexOf(s[0])) + s.slice(1, 8) : s.slice(0, 8);
      const expected = dniLetter(Number(numeric));
      if (expected !== s[8]) {
        return { valid: false, reason: `Wrong control letter — expected ${expected}, got ${s[8]}.` };
      }
      return { valid: true, info: [isNie ? `NIE (${s[0]} series) — foreign resident` : 'DNI — Spanish national', `Control letter ${expected} ✓`] };
    },
  };

  /* IBAN / CCC */

  const CCC_WEIGHTS = [1, 2, 4, 8, 5, 10, 9, 7, 3, 6];

  function cccDigit(ten) {
    const sum = digits(ten).reduce((acc, d, i) => acc + d * CCC_WEIGHTS[i], 0);
    const r = 11 - (sum % 11);
    return String(r === 11 ? 0 : r === 10 ? 1 : r);
  }

  const spaced = (s, n) => s.replace(new RegExp(`(.{${n}})(?=.)`, 'g'), '$1 ');

  const BANKS = [
    ['0049', 'Banco Santander'], ['2100', 'CaixaBank'], ['0182', 'BBVA'],
    ['0081', 'Banco Sabadell'], ['0128', 'Bankinter'], ['0073', 'Openbank'],
    ['1465', 'ING'], ['3058', 'Cajamar'], ['2085', 'Ibercaja'], ['2080', 'Abanca'],
    ['2103', 'Unicaja Banco'], ['0186', 'Banco Mediolanum'], ['0019', 'Deutsche Bank SAE'],
    ['0061', 'Banca March'], ['1490', 'Self Bank'],
  ];

  const bank = {
    generate(v) {
      const [code, name] = v.bank === 'random' ? pick(BANKS) : BANKS.find(([c]) => c === v.bank);
      const oficina = randomDigits(4);
      const cuenta = randomDigits(10);
      const dc = cccDigit('00' + code + oficina) + cccDigit(cuenta);
      const bban = code + oficina + dc + cuenta;
      const iban = 'ES' + ibanCheckDigits('ES', bban) + bban;
      return {
        code: v.format === 'plain' ? iban : groupIban(iban),
        meta: `${name} · CCC ${spaced(bban, 4)} · control digits ${dc}`,
      };
    },

    validate(raw) {
      const res = checkIban(raw, { cc: 'ES', length: 24 });
      if (!res.valid) return res;
      const bban = res.s.slice(4);
      const [code, oficina, dc, cuenta] = [bban.slice(0, 4), bban.slice(4, 8), bban.slice(8, 10), bban.slice(10)];
      const expected = cccDigit('00' + code + oficina) + cccDigit(cuenta);
      if (expected !== dc) {
        return { valid: false, reason: `IBAN checksum is fine but the CCC control digits are wrong — expected ${expected}, got ${dc}.` };
      }
      const found = BANKS.find(([c]) => c === code);
      return {
        valid: true,
        info: [
          found ? `Entidad ${code} — ${found[1]}` : `Entidad ${code} (not in the built-in list)`,
          `Oficina ${oficina} · cuenta ${cuenta}`,
          `CCC control digits ${dc} ✓`,
          'Mod-97 IBAN check ✓',
        ],
      };
    },
  };

  Gen.register('ES', {
    options: { banks: optionList(BANKS) },
    docs: { id, bank },
    // Checksum helpers, reachable as Gen.country('ES').internals for a self-test.
    internals: { dniLetter, cccDigit },
  });
})(typeof Gen !== 'undefined' ? Gen : require('../core.js'));
