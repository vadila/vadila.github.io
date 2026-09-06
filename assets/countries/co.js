/* Colombia — Cédula / NIT and the bank account (Colombia has no IBAN). */
'use strict';

(function (Gen) {
  const { rndInt, pick, digits, randomDigits, optionList } = Gen;

  /* ---------------------------------------------------------- Cédula / NIT */

  const NIT_WEIGHTS = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];

  function nitCheckDigit(number) {
    const ds = digits(number).reverse();
    const sum = ds.reduce((acc, d, i) => acc + d * NIT_WEIGHTS[i], 0);
    const r = sum % 11;
    return String(r < 2 ? r : 11 - r);
  }

  const group = (n) => n.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  const id = {
    generate(v) {
      let number, meta;

      if (v.kind === 'nit') {
        number = String(rndInt(800000000, 901999999));
        const dv = nitCheckDigit(number);
        const shown = v.formatted === 'dots' ? group(number) : number;
        return { code: `${shown}-${dv}`, meta: 'NIT · company / taxpayer · with verification digit' };
      }

      if (v.kind === 'ce') {
        number = String(rndInt(100000, 9999999));
        meta = 'Cédula de Extranjería · foreign resident · no checksum defined';
      } else if (v.kind === 'ti') {
        number = String(rndInt(1000000000, 1099999999));
        meta = 'Tarjeta de Identidad · minor (NUIP series) · no checksum defined';
      } else {
        let era = v.era;
        if (!era || era === 'random') era = pick(['old_m', 'old_f', 'nuip']);
        if (era === 'old_m') {
          number = String(rndInt(1000000, 19999999));
          meta = 'Cédula de Ciudadanía · legacy male series · no checksum defined';
        } else if (era === 'old_f') {
          number = String(rndInt(20000000, 69999999));
          meta = 'Cédula de Ciudadanía · legacy female series · no checksum defined';
        } else {
          number = String(rndInt(1000000000, 1099999999));
          meta = 'Cédula de Ciudadanía · NUIP series · no checksum defined';
        }
      }

      return { code: v.formatted === 'dots' ? group(number) : number, meta };
    },

    validate(raw) {
      const s = raw.replace(/[\s.,]/g, '').toUpperCase();
      const m = /^(\d{5,15})(?:-?(\d))?$/.exec(s);
      if (!m) return { valid: false, reason: 'Expected digits, optionally followed by "-" and a verification digit.' };

      const number = m[1];
      if (m[2] === undefined) {
        return {
          valid: true,
          info: [
            'No verification digit supplied — treated as a cédula.',
            'Colombian cédulas carry no checksum, so only the format can be checked.',
            `${number.length} digits · ${number.startsWith('1') && number.length === 10 ? 'NUIP series' : 'legacy series'}`,
          ],
        };
      }

      const expected = nitCheckDigit(number);
      if (expected !== m[2]) return { valid: false, reason: `Wrong NIT verification digit — expected ${expected}, got ${m[2]}.` };
      return { valid: true, info: ['NIT format', `Verification digit ${expected} ✓`] };
    },
  };

  /* -------------------------------------------------------- Cuenta bancaria */

  const BANKS = [
    ['007', 'Bancolombia', [10, 11]], ['051', 'Davivienda', [9, 10]],
    ['001', 'Banco de Bogotá', [9, 10]], ['013', 'BBVA Colombia', [11]],
    ['023', 'Banco de Occidente', [9]], ['002', 'Banco Popular', [9]],
    ['019', 'Scotiabank Colpatria', [9, 10]], ['012', 'Banco GNB Sudameris', [9]],
    ['006', 'Itaú', [9, 10]], ['009', 'Citibank', [9]], ['052', 'Banco AV Villas', [9]],
    ['060', 'Banco Pichincha', [9]], ['062', 'Banco Falabella', [9]],
    ['507', 'Nequi', [10]], ['551', 'Daviplata', [10]],
  ];

  const bank = {
    generate(v) {
      const found = v.bank === 'random' ? pick(BANKS) : BANKS.find(([c]) => c === v.bank);
      const [code, name, lengths] = found;
      const isWallet = code === '507' || code === '551';
      // Nequi and Daviplata accounts are the holder's mobile number.
      const account = isWallet ? '3' + randomDigits(9) : randomDigits(pick(lengths));
      const type = isWallet ? 'depósito de bajo monto' : v.type === 'random' ? pick(['ahorros', 'corriente']) : v.type;
      return {
        code: v.format === 'withBank' ? `${code}-${account}` : account,
        meta: `${name} · ${type}${isWallet ? ' (mobile number)' : ''} · no checksum defined`,
      };
    },

    validate(raw) {
      const s = raw.replace(/[\s.-]/g, '');
      if (!/^\d{6,20}$/.test(s)) return { valid: false, reason: 'Expected 6–20 digits (optionally prefixed with a bank code and a dash).' };
      const m = /^(\d{3})-(\d{6,17})$/.exec(raw.replace(/[\s.]/g, ''));
      const info = ['Colombia has no IBAN and no account-number checksum — format only.'];
      if (m) {
        const found = BANKS.find(([c]) => c === m[1]);
        info.push(found ? `Bank ${m[1]} — ${found[1]}` : `Bank code ${m[1]} (not in the built-in list)`);
        info.push(`Account ${m[2]} · ${m[2].length} digits`);
      } else {
        info.push(`${s.length} digits — plausible length for a Colombian account`);
      }
      return { valid: true, info };
    },
  };

  Gen.register('CO', {
    options: { banks: optionList(BANKS) },
    docs: { id, bank },
    // Checksum helpers, reachable as Gen.country('CO').internals for a self-test.
    internals: { nitCheckDigit },
  });
})(typeof Gen !== 'undefined' ? Gen : require('../core.js'));
