/* Poland — PESEL, NIP, numer dowodu osobistego, and the IBAN / NRB. */
'use strict';

(function (Gen) {
  const { rndInt, pick, pad, digits, coinFlip, randomDigits, daysInMonth, fmtDate, randomBirthDate, parseDate, ibanCheckDigits, groupIban, checkIban, optionList } = Gen;

  /* ---------------------------------------------------------------- PESEL */

  const PESEL_WEIGHTS = [1, 3, 7, 9, 1, 3, 7, 9, 1, 3];

  function peselCheckDigit(first10) {
    const sum = digits(first10).reduce((acc, d, i) => acc + d * PESEL_WEIGHTS[i], 0);
    return String((10 - (sum % 10)) % 10);
  }

  function peselMonthOffset(year) {
    if (year >= 1800 && year <= 1899) return 80;
    if (year >= 1900 && year <= 1999) return 0;
    if (year >= 2000 && year <= 2099) return 20;
    if (year >= 2100 && year <= 2199) return 40;
    if (year >= 2200 && year <= 2299) return 60;
    return null;
  }

  const id = {
    generate(v) {
      const sex = v.sex === 'random' ? (coinFlip() ? 'M' : 'F') : v.sex;
      const birth = parseDate(v.birth) || randomBirthDate(18, 80);
      const offset = peselMonthOffset(birth.y);
      if (offset === null) throw new Error('PESEL only covers birth years 1800–2299.');

      const serialHead = pad(rndInt(0, 999), 3);
      // Last serial digit encodes sex: odd = male, even = female.
      const sexDigit = sex === 'M' ? pick([1, 3, 5, 7, 9]) : pick([0, 2, 4, 6, 8]);

      const first10 = pad(birth.y % 100, 2) + pad(birth.m + offset, 2) + pad(birth.d, 2) + serialHead + sexDigit;
      const code = first10 + peselCheckDigit(first10);
      return { code, meta: `${fmtDate(birth)} · ${sex === 'M' ? 'male' : 'female'}` };
    },

    validate(raw) {
      const s = raw.replace(/[\s-]/g, '');
      if (!/^\d{11}$/.test(s)) return { valid: false, reason: 'PESEL must be exactly 11 digits.' };

      const yy = +s.slice(0, 2);
      const rawMonth = +s.slice(2, 4);
      const dd = +s.slice(4, 6);
      const centuries = { 0: 1900, 20: 2000, 40: 2100, 60: 2200, 80: 1800 };
      const offset = Math.floor(rawMonth / 20) * 20;
      const bucket = rawMonth >= 80 ? 80 : offset;
      if (!(bucket in centuries)) return { valid: false, reason: `Invalid encoded month ${pad(rawMonth, 2)}.` };
      const month = rawMonth - bucket;
      const year = centuries[bucket] + yy;
      if (month < 1 || month > 12 || dd < 1 || dd > daysInMonth(year, month)) {
        return { valid: false, reason: `Invalid birth date encoded (${pad(rawMonth, 2)}/${pad(dd, 2)}).` };
      }

      const expected = peselCheckDigit(s.slice(0, 10));
      if (expected !== s[10]) return { valid: false, reason: `Wrong check digit — expected ${expected}, got ${s[10]}.` };

      return {
        valid: true,
        info: [`Born ${year}-${pad(month, 2)}-${pad(dd, 2)}`, +s[9] % 2 === 1 ? 'Male' : 'Female', `Check digit ${expected} ✓`],
      };
    },
  };

  /* ------------------------------------------------------------------ NIP */

  /* The first three digits are the historical code of the issuing urząd skarbowy.
   * They carry no arithmetic meaning — the list only makes the output look real. */
  const NIP_OFFICES = [
    ['113', 'Warszawa'], ['521', 'Warszawa'], ['522', 'Warszawa'], ['524', 'Warszawa'],
    ['525', 'Warszawa'], ['526', 'Warszawa'], ['527', 'Warszawa'], ['951', 'Warszawa'],
    ['675', 'Kraków'], ['676', 'Kraków'], ['677', 'Kraków'], ['678', 'Kraków'],
    ['679', 'Kraków'], ['944', 'Kraków'],
    ['894', 'Wrocław'], ['895', 'Wrocław'], ['896', 'Wrocław'], ['897', 'Wrocław'],
    ['898', 'Wrocław'], ['899', 'Wrocław'],
    ['777', 'Poznań'], ['778', 'Poznań'], ['779', 'Poznań'], ['781', 'Poznań'],
    ['782', 'Poznań'], ['783', 'Poznań'], ['972', 'Poznań'],
    ['725', 'Łódź'], ['726', 'Łódź'], ['727', 'Łódź'], ['728', 'Łódź'],
    ['729', 'Łódź'], ['947', 'Łódź'],
    ['583', 'Gdańsk'], ['584', 'Gdańsk'], ['585', 'Gdańsk'], ['957', 'Gdańsk'],
    ['586', 'Gdynia'],
    ['634', 'Katowice'], ['635', 'Katowice'], ['954', 'Katowice'],
    ['851', 'Szczecin'], ['852', 'Szczecin'], ['955', 'Szczecin'],
    ['712', 'Lublin'], ['946', 'Lublin'],
    ['554', 'Bydgoszcz'], ['953', 'Bydgoszcz'],
    ['542', 'Białystok'], ['966', 'Białystok'],
    ['813', 'Rzeszów'], ['517', 'Rzeszów'],
    ['657', 'Kielce'], ['959', 'Kielce'],
    ['739', 'Olsztyn'], ['742', 'Olsztyn'],
    ['754', 'Opole'], ['991', 'Opole'],
    ['929', 'Zielona Góra'], ['973', 'Zielona Góra'],
    ['879', 'Toruń'], ['956', 'Toruń'],
    ['796', 'Radom'], ['948', 'Radom'],
  ];

  const NIP_WEIGHTS = [6, 5, 7, 2, 3, 4, 5, 6, 7];

  /** Returns "0".."9", or null when the weighted sum lands on 10 — such a NIP is never issued. */
  function nipCheckDigit(first9) {
    const sum = digits(first9).reduce((acc, d, i) => acc + d * NIP_WEIGHTS[i], 0);
    const r = sum % 11;
    return r === 10 ? null : String(r);
  }

  /** 3-3-2-2 is the modern company form; 3-2-2-3 is the older personal one. */
  function formatNip(n, style) {
    if (style === 'dashes') return `${n.slice(0, 3)}-${n.slice(3, 6)}-${n.slice(6, 8)}-${n.slice(8)}`;
    if (style === 'dashesOld') return `${n.slice(0, 3)}-${n.slice(3, 5)}-${n.slice(5, 7)}-${n.slice(7)}`;
    if (style === 'vat') return `PL${n}`;
    return n;
  }

  const nip = {
    generate(v) {
      const office = v.office === 'random' ? pick(NIP_OFFICES) : NIP_OFFICES.find(([c]) => c === v.office);
      let value = null;
      // Roughly one in eleven random bodies needs a check digit of 10; draw again.
      for (let attempt = 0; attempt < 50 && value === null; attempt++) {
        const first9 = office[0] + randomDigits(6);
        const cd = nipCheckDigit(first9);
        if (cd !== null) value = first9 + cd;
      }
      if (value === null) throw new Error('Could not build a NIP for that prefix — try again.');
      return { code: formatNip(value, v.format), meta: `Tax office ${office[0]} — ${office[1]} · check digit ${value[9]}` };
    },

    validate(raw) {
      const s = raw.replace(/[\s.-]/g, '').toUpperCase().replace(/^PL/, '');
      if (!/^\d{10}$/.test(s)) return { valid: false, reason: 'NIP must be exactly 10 digits (an optional "PL" prefix and dashes are ignored).' };
      if (/^(\d)\1{9}$/.test(s)) return { valid: false, reason: 'All ten digits are the same — not a real NIP.' };

      const expected = nipCheckDigit(s.slice(0, 9));
      if (expected === null) return { valid: false, reason: 'The first nine digits require a check digit of 10, which cannot be written — no such NIP exists.' };
      if (expected !== s[9]) return { valid: false, reason: `Wrong check digit — expected ${expected}, got ${s[9]}.` };

      const office = NIP_OFFICES.find(([c]) => c === s.slice(0, 3));
      return {
        valid: true,
        info: [
          office ? `Tax office ${office[0]} — ${office[1]}` : `Tax office prefix ${s.slice(0, 3)} (not in the built-in list)`,
          `EU VAT form PL${s}`,
          `Check digit ${expected} ✓`,
        ],
      };
    },
  };

  /* ------------------------------------------------- numer dowodu osobistego */

  /* 3 letters + 6 digits; the FIRST digit (position 4) is the check digit. */
  const DOWOD_WEIGHTS = [7, 3, 1, 9, 7, 3, 1, 7, 3];
  const DOWOD_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  /** Digits keep their value; letters run A=10 … Z=35. */
  const dowodValue = (ch) => (/\d/.test(ch) ? +ch : ch.charCodeAt(0) - 55);

  const dowodSum = (s) => s.split('').reduce((acc, ch, i) => acc + DOWOD_WEIGHTS[i] * dowodValue(ch), 0);

  /** Check digit for "AAAnnnnn" = 3 letters + the 5 trailing digits, in that order. */
  function dowodCheckDigit(series, tail5) {
    const letters = series.split('').reduce((acc, ch, i) => acc + DOWOD_WEIGHTS[i] * dowodValue(ch), 0);
    const rest = digits(tail5).reduce((acc, d, i) => acc + DOWOD_WEIGHTS[i + 4] * d, 0);
    // 9·c ≡ −base (mod 10) and −9 ≡ 1, so the check digit is just the base mod 10.
    return String((letters + rest) % 10);
  }

  const dowod = {
    generate(v) {
      const wanted = (v.series || '').trim().toUpperCase();
      if (wanted && !/^[A-Z]{3}$/.test(wanted)) throw new Error('Series must be exactly three letters A–Z.');
      const series = wanted || Array.from({ length: 3 }, () => pick(DOWOD_LETTERS.split(''))).join('');

      const tail = randomDigits(5);
      const code = series + dowodCheckDigit(series, tail) + tail;
      return {
        code: v.format === 'spaced' ? `${code.slice(0, 3)} ${code.slice(3)}` : code,
        meta: `Series ${series} · check digit ${code[3]}`,
      };
    },

    validate(raw) {
      const s = raw.replace(/[\s-]/g, '').toUpperCase();
      if (!/^[A-Z]{3}\d{6}$/.test(s)) return { valid: false, reason: 'Expected three letters followed by six digits, e.g. ABA300000.' };

      const expected = dowodCheckDigit(s.slice(0, 3), s.slice(4));
      if (expected !== s[3]) return { valid: false, reason: `Wrong check digit — expected ${expected}, got ${s[3]}.` };
      if (dowodSum(s) % 10 !== 0) return { valid: false, reason: 'Weighted sum is not a multiple of 10.' };

      return {
        valid: true,
        info: [`Series ${s.slice(0, 3)}`, `Serial ${s.slice(4)}`, `Check digit ${expected} ✓`, 'Weighted sum ≡ 0 (mod 10) ✓'],
      };
    },
  };

  /* ----------------------------------------------------------- IBAN / NRB */

  const BANK_WEIGHTS = [3, 9, 7, 1, 3, 9, 7];
  const sortCodeCheck = (seven) => String((10 - (digits(seven).reduce((a, d, i) => a + d * BANK_WEIGHTS[i], 0) % 10)) % 10);

  const BANKS = [
    ['1020', 'PKO Bank Polski'], ['1240', 'Bank Pekao'], ['1140', 'mBank'],
    ['1050', 'ING Bank Śląski'], ['1090', 'Santander Bank Polska'], ['1160', 'Bank Millennium'],
    ['1030', 'Citi Handlowy'], ['1750', 'BNP Paribas'], ['2490', 'Alior Bank'],
    ['1870', 'Nest Bank'], ['1930', 'Bank Polskiej Spółdzielczości'], ['1610', 'SGB-Bank'],
  ];

  const bank = {
    generate(v) {
      const [prefix, name] = v.bank === 'random' ? pick(BANKS) : BANKS.find(([c]) => c === v.bank);
      const branch = prefix + randomDigits(3);
      const sortCode = branch + sortCodeCheck(branch);
      const bban = sortCode + randomDigits(16);
      const iban = 'PL' + ibanCheckDigits('PL', bban) + bban;
      const meta = `${name} · sort code ${sortCode}`;
      if (v.format === 'nrb') return { code: iban.slice(2), meta: `${meta} · NRB form (no country prefix)` };
      return { code: v.format === 'plain' ? iban : groupIban(iban), meta };
    },

    validate(raw) {
      const bare = raw.replace(/[\s-]/g, '').toUpperCase();
      // A bare 26-digit NRB is the same number without the "PL" prefix.
      const res = checkIban(/^\d{26}$/.test(bare) ? 'PL' + bare : bare, { cc: 'PL', length: 28 });
      if (!res.valid) return res;
      const sortCode = res.s.slice(4, 12);
      const expected = sortCodeCheck(sortCode.slice(0, 7));
      if (expected !== sortCode[7]) {
        return { valid: false, reason: `IBAN checksum is fine but the sort code check digit is wrong — expected ${expected}, got ${sortCode[7]}.` };
      }
      const found = BANKS.find(([c]) => c === sortCode.slice(0, 4));
      return {
        valid: true,
        info: [
          found ? `${sortCode.slice(0, 4)} — ${found[1]}` : `Bank ${sortCode.slice(0, 4)} (not in the built-in list)`,
          `Sort code ${sortCode} ✓`,
          `Account ${res.s.slice(12)}`,
          'Mod-97 IBAN check ✓',
        ],
      };
    },
  };

  Gen.register('PL', {
    options: { offices: optionList(NIP_OFFICES), banks: optionList(BANKS) },
    docs: { id, nip, dowod, bank },
    // Checksum helpers, reachable as Gen.country('PL').internals for a self-test.
    internals: { peselCheckDigit, nipCheckDigit, dowodCheckDigit, dowodSum, sortCodeCheck },
  });
})(typeof Gen !== 'undefined' ? Gen : require('../core.js'));
