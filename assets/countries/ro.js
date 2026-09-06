/* Romania — CNP and the IBAN (no national check digit). */
'use strict';

(function (Gen) {
  const { rndInt, pick, pad, digits, coinFlip, randomDigits, daysInMonth, fmtDate, randomBirthDate, parseDate, ibanCheckDigits, groupIban, checkIban, optionList } = Gen;

  /* ------------------------------------------------------------------ CNP */

  const COUNTIES = {
    '01': 'Alba', '02': 'Arad', '03': 'Argeș', '04': 'Bacău', '05': 'Bihor',
    '06': 'Bistrița-Năsăud', '07': 'Botoșani', '08': 'Brașov', '09': 'Brăila',
    '10': 'Buzău', '11': 'Caraș-Severin', '12': 'Cluj', '13': 'Constanța',
    '14': 'Covasna', '15': 'Dâmbovița', '16': 'Dolj', '17': 'Galați', '18': 'Gorj',
    '19': 'Harghita', '20': 'Hunedoara', '21': 'Ialomița', '22': 'Iași', '23': 'Ilfov',
    '24': 'Maramureș', '25': 'Mehedinți', '26': 'Mureș', '27': 'Neamț', '28': 'Olt',
    '29': 'Prahova', '30': 'Satu Mare', '31': 'Sălaj', '32': 'Sibiu', '33': 'Suceava',
    '34': 'Teleorman', '35': 'Timiș', '36': 'Tulcea', '37': 'Vaslui', '38': 'Vâlcea',
    '39': 'Vrancea', '40': 'București', '41': 'București — Sector 1',
    '42': 'București — Sector 2', '43': 'București — Sector 3', '44': 'București — Sector 4',
    '45': 'București — Sector 5', '46': 'București — Sector 6', '51': 'Călărași', '52': 'Giurgiu',
  };

  const CNP_WEIGHTS = [2, 7, 9, 1, 4, 6, 3, 5, 8, 2, 7, 9];

  function cnpCheckDigit(first12) {
    const sum = digits(first12).reduce((acc, d, i) => acc + d * CNP_WEIGHTS[i], 0);
    const r = sum % 11;
    return String(r === 10 ? 1 : r);
  }

  function cnpSexDigit(year, sex, status) {
    if (status === 'foreign') return sex === 'M' ? '7' : '8'; // resident foreigner
    if (status === 'unknown') return '9';
    if (year >= 1800 && year <= 1899) return sex === 'M' ? '3' : '4';
    if (year >= 1900 && year <= 1999) return sex === 'M' ? '1' : '2';
    if (year >= 2000 && year <= 2099) return sex === 'M' ? '5' : '6';
    return null;
  }

  const id = {
    generate(v) {
      const sex = v.sex === 'random' ? (coinFlip() ? 'M' : 'F') : v.sex;
      const birth = parseDate(v.birth) || randomBirthDate(18, 80);
      const county = v.county === 'random' ? pick(Object.keys(COUNTIES)) : v.county;

      const s = cnpSexDigit(birth.y, sex, v.status);
      if (s === null) throw new Error('CNP only covers birth years 1800–2099.');

      const first12 = s + pad(birth.y % 100, 2) + pad(birth.m, 2) + pad(birth.d, 2) + county + pad(rndInt(1, 999), 3);
      const code = first12 + cnpCheckDigit(first12);
      return { code, meta: `${fmtDate(birth)} · ${sex === 'M' ? 'male' : 'female'} · ${COUNTIES[county]}` };
    },

    validate(raw) {
      const s = raw.replace(/[\s-]/g, '');
      if (!/^\d{13}$/.test(s)) return { valid: false, reason: 'CNP must be exactly 13 digits.' };

      const centuries = { 1: 1900, 2: 1900, 3: 1800, 4: 1800, 5: 2000, 6: 2000, 7: 1900, 8: 1900 };
      const first = +s[0];
      if (first === 0) return { valid: false, reason: 'First digit cannot be 0.' };

      const county = s.slice(7, 9);
      if (!COUNTIES[county]) return { valid: false, reason: `Unknown county code "${county}".` };

      const info = [];
      if (first === 9) {
        info.push('Foreign national (S = 9) — birth century not encoded');
      } else {
        const year = centuries[first] + +s.slice(1, 3);
        const mm = +s.slice(3, 5), dd = +s.slice(5, 7);
        if (mm < 1 || mm > 12 || dd < 1 || dd > daysInMonth(year, mm)) {
          return { valid: false, reason: `Invalid birth date ${pad(mm, 2)}/${pad(dd, 2)}.` };
        }
        info.push(`Born ${year}-${pad(mm, 2)}-${pad(dd, 2)}`);
        info.push(first % 2 === 1 ? 'Male' : 'Female');
        if (first === 7 || first === 8) info.push('Resident foreigner');
      }
      info.push(`${county} — ${COUNTIES[county]}`);

      const expected = cnpCheckDigit(s.slice(0, 12));
      if (expected !== s[12]) return { valid: false, reason: `Wrong check digit — expected ${expected}, got ${s[12]}.` };
      info.push(`Check digit ${expected} ✓`);

      return { valid: true, info };
    },
  };

  /* ----------------------------------------------------------------- IBAN */

  const BANKS = [
    ['RNCB', 'Banca Comercială Română'], ['BTRL', 'Banca Transilvania'],
    ['BRDE', 'BRD — Groupe Société Générale'], ['RZBR', 'Raiffeisen Bank'],
    ['INGB', 'ING Bank'], ['BACX', 'UniCredit Bank'], ['CECE', 'CEC Bank'],
    ['OTPV', 'OTP Bank'], ['PIRB', 'First Bank'], ['UGBI', 'Garanti BBVA'],
    ['BREL', 'Libra Internet Bank'], ['BUCU', 'Alpha Bank'],
    ['FNNB', 'Credit Agricole'], ['MIRO', 'ProCredit Bank'], ['TREZ', 'Trezoreria Statului'],
  ];

  const bank = {
    generate(v) {
      const [code, name] = v.bank === 'random' ? pick(BANKS) : BANKS.find(([c]) => c === v.bank);
      const bban = code + randomDigits(16);
      const iban = 'RO' + ibanCheckDigits('RO', bban) + bban;
      return { code: v.format === 'plain' ? iban : groupIban(iban), meta: `${name} (${code})` };
    },

    validate(raw) {
      const res = checkIban(raw, { cc: 'RO', length: 24 });
      if (!res.valid) return res;
      const code = res.s.slice(4, 8);
      if (!/^[A-Z]{4}$/.test(code)) return { valid: false, reason: `Bank code "${code}" should be 4 letters.` };
      const found = BANKS.find(([c]) => c === code);
      return {
        valid: true,
        info: [
          found ? `${code} — ${found[1]}` : `Bank ${code} (not in the built-in list)`,
          `Account ${res.s.slice(8)}`,
          'Mod-97 IBAN check ✓',
        ],
      };
    },
  };

  Gen.register('RO', {
    options: { counties: optionList(COUNTIES), banks: optionList(BANKS) },
    docs: { id, bank },
    // Checksum helpers, reachable as Gen.country('RO').internals for a self-test.
    internals: { cnpCheckDigit, cnpSexDigit },
  });
})(typeof Gen !== 'undefined' ? Gen : require('../core.js'));
