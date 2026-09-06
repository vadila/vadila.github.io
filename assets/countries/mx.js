/* Mexico — CURP, and the 18-digit CLABE (Mexico is not in the IBAN registry). */
'use strict';

(function (Gen) {
  const { rndInt, pick, pad, coinFlip, randomDigits, daysInMonth, fmtDate, randomBirthDate, parseDate, optionList } = Gen;

  /* ----------------------------------------------------------------- CURP */

  const STATES = {
    AS: 'Aguascalientes', BC: 'Baja California', BS: 'Baja California Sur', CC: 'Campeche',
    CL: 'Coahuila', CM: 'Colima', CS: 'Chiapas', CH: 'Chihuahua', DF: 'Ciudad de México',
    DG: 'Durango', GT: 'Guanajuato', GR: 'Guerrero', HG: 'Hidalgo', JC: 'Jalisco',
    MC: 'México', MN: 'Michoacán', MS: 'Morelos', NT: 'Nayarit', NL: 'Nuevo León',
    OC: 'Oaxaca', PL: 'Puebla', QT: 'Querétaro', QR: 'Quintana Roo', SP: 'San Luis Potosí',
    SL: 'Sinaloa', SR: 'Sonora', TC: 'Tabasco', TS: 'Tamaulipas', TL: 'Tlaxcala',
    VZ: 'Veracruz', YN: 'Yucatán', ZS: 'Zacatecas', NE: 'Nacido en el extranjero',
  };

  /* Words the RENAPO filter rewrites (2nd character becomes X). */
  const BANNED = new Set([
    'BACA', 'BAKA', 'BUEI', 'BUEY', 'CACA', 'CACO', 'CAGA', 'CAGO', 'CAKA', 'CAKO',
    'COGE', 'COGI', 'COJA', 'COJE', 'COJI', 'COJO', 'COLA', 'CULO', 'FALO', 'FETO',
    'GETA', 'GUEI', 'GUEY', 'JOTO', 'KACA', 'KACO', 'KAGA', 'KAGO', 'KAKA', 'KAKO',
    'KOGE', 'KOGI', 'KOJA', 'KOJE', 'KOJI', 'KOJO', 'KOLA', 'KULO', 'LILO', 'LOCA',
    'LOCO', 'LOKA', 'LOKO', 'MAME', 'MAMO', 'MEAR', 'MEAS', 'MEON', 'MIAR', 'MION',
    'MOCO', 'MOKO', 'MULA', 'MULO', 'NACA', 'NACO', 'PEDA', 'PEDO', 'PENE', 'PIPI',
    'PITO', 'POPO', 'PUTA', 'PUTO', 'QULO', 'RATA', 'ROBA', 'ROBE', 'ROBO', 'RUIN',
    'SENO', 'TETA', 'VACA', 'VAGA', 'VAGO', 'VAKA', 'VUEI', 'VUEY', 'WUEI', 'WUEY',
  ]);

  const PARTICLES = new Set(['DA', 'DAS', 'DE', 'DEL', 'DER', 'DI', 'DIE', 'DD', 'EL', 'LA', 'LOS', 'LAS', 'LE', 'LES', 'MAC', 'MC', 'VAN', 'VON', 'Y']);
  const ALPHABET = '0123456789ABCDEFGHIJKLMNÑOPQRSTUVWXYZ';

  const SURNAMES = ['HERNANDEZ', 'GARCIA', 'MARTINEZ', 'LOPEZ', 'GONZALEZ', 'PEREZ', 'RODRIGUEZ', 'SANCHEZ', 'RAMIREZ', 'FLORES', 'GOMEZ', 'DIAZ', 'REYES', 'MORALES', 'CRUZ', 'ORTIZ', 'GUTIERREZ', 'CHAVEZ', 'RAMOS', 'VAZQUEZ', 'JIMENEZ', 'MENDOZA', 'AGUILAR', 'CASTILLO', 'ROMERO', 'MORENO', 'HERRERA', 'MEDINA', 'VARGAS', 'CASTRO'];
  const NAMES_M = ['JOSE LUIS', 'JUAN CARLOS', 'MIGUEL ANGEL', 'PEDRO', 'FRANCISCO', 'ANTONIO', 'RICARDO', 'ALEJANDRO', 'JORGE', 'FERNANDO', 'ROBERTO', 'DANIEL', 'EDUARDO', 'SERGIO', 'MANUEL', 'RAUL', 'ARTURO', 'HECTOR'];
  const NAMES_F = ['MARIA GUADALUPE', 'ANA MARIA', 'LAURA', 'PATRICIA', 'CLAUDIA', 'ALEJANDRA', 'VERONICA', 'GABRIELA', 'ADRIANA', 'MONICA', 'ROSA MARIA', 'LETICIA', 'SANDRA', 'ELENA', 'CARMEN', 'BEATRIZ', 'SILVIA', 'DIANA'];

  /** Strip diacritics, uppercase, map Ñ -> X (CURP treats Ñ as X). */
  function normalizeName(s) {
    return (s || '')
      .toUpperCase()
      .replace(/Ñ/g, 'X')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Z ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** Drop leading particles ("DE LA CRUZ" -> "CRUZ") and keep the first word. */
  function curpWord(raw) {
    const parts = normalizeName(raw).split(' ').filter(Boolean);
    while (parts.length > 1 && PARTICLES.has(parts[0])) parts.shift();
    return parts.join('');
  }

  /** First given name, skipping MARIA / MA / JOSE / J when another name follows. */
  function curpGivenName(raw) {
    const parts = normalizeName(raw).split(' ').filter(Boolean);
    const skip = new Set(['MARIA', 'MA', 'M', 'JOSE', 'J']);
    while (parts.length > 1 && skip.has(parts[0])) parts.shift();
    const rest = parts.filter((p) => !PARTICLES.has(p));
    return (rest[0] || parts[0] || '');
  }

  const firstChar = (w) => (w && w[0]) || 'X';
  const innerVowel = (w) => { const m = /[AEIOU]/.exec((w || '').slice(1)); return m ? m[0] : 'X'; };
  const innerConsonant = (w) => { const m = /[BCDFGHJKLMNPQRSTVWXYZ]/.exec((w || '').slice(1)); return m ? m[0] : 'X'; };

  function curpCheckDigit(first17) {
    let sum = 0;
    for (let i = 0; i < 17; i++) {
      sum += ALPHABET.indexOf(first17[i]) * (18 - i);
    }
    const d = 10 - (sum % 10);
    return String(d === 10 ? 0 : d);
  }

  function buildCurp({ paternal, maternal, given, birth, sex, state }) {
    const p = curpWord(paternal);
    const m = curpWord(maternal);
    const n = curpGivenName(given);

    let root = firstChar(p) + innerVowel(p) + firstChar(m) + firstChar(n);
    if (BANNED.has(root)) root = root[0] + 'X' + root.slice(2);

    const datePart = pad(birth.y % 100, 2) + pad(birth.m, 2) + pad(birth.d, 2);
    const consonants = innerConsonant(p) + innerConsonant(m) + innerConsonant(n);
    // Position 17: digit for 20th-century births, letter for 2000 onwards.
    const homoclave = birth.y < 2000
      ? String(rndInt(0, 9))
      : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[rndInt(0, 25)];

    const first17 = root + datePart + sex + state + consonants + homoclave;
    return first17 + curpCheckDigit(first17);
  }

  const id = {
    generate(v) {
      const sex = v.sex === 'random' ? (coinFlip() ? 'H' : 'M') : v.sex;
      const state = v.state === 'random' ? pick(Object.keys(STATES)) : v.state;
      const birth = parseDate(v.birth) || randomBirthDate(18, 70);

      let paternal, maternal, given;
      if (v.nameMode === 'manual') {
        paternal = v.paternal || 'X';
        maternal = v.maternal || '';
        given = v.given || 'X';
      } else {
        paternal = pick(SURNAMES);
        do { maternal = pick(SURNAMES); } while (maternal === paternal);
        given = sex === 'H' ? pick(NAMES_M) : pick(NAMES_F);
      }

      const code = buildCurp({ paternal, maternal, given, birth, sex, state });
      const person = [given, paternal, maternal].filter(Boolean).join(' ');
      return {
        code,
        meta: `${person} · ${fmtDate(birth)} · ${sex === 'H' ? 'hombre' : 'mujer'} · ${STATES[state]}`,
      };
    },

    validate(raw) {
      const s = raw.replace(/\s/g, '').toUpperCase();
      if (!/^[A-Z]{4}\d{6}[HM][A-Z]{5}[0-9A-Z]\d$/.test(s)) {
        return { valid: false, reason: 'Expected 18 characters: AAAA######SEEXXX#N.' };
      }
      const state = s.slice(11, 13);
      if (!STATES[state]) return { valid: false, reason: `Unknown state code "${state}".` };

      const yy = +s.slice(4, 6), mm = +s.slice(6, 8), dd = +s.slice(8, 10);
      const century = /\d/.test(s[16]) ? 1900 : 2000;
      const year = century + yy;
      if (mm < 1 || mm > 12 || dd < 1 || dd > daysInMonth(year, mm)) {
        return { valid: false, reason: `Invalid birth date ${pad(mm, 2)}/${pad(dd, 2)}.` };
      }

      const expected = curpCheckDigit(s.slice(0, 17));
      if (expected !== s[17]) return { valid: false, reason: `Wrong check digit — expected ${expected}, got ${s[17]}.` };

      return {
        valid: true,
        info: [
          `Born ${year}-${pad(mm, 2)}-${pad(dd, 2)}`,
          s[10] === 'H' ? 'Hombre' : 'Mujer',
          `${state} — ${STATES[state]}`,
          `Check digit ${expected} ✓`,
        ],
      };
    },
  };

  /* ---------------------------------------------------------------- CLABE */

  const CLABE_WEIGHTS = [3, 7, 1];

  function clabeCheckDigit(first17) {
    let sum = 0;
    for (let i = 0; i < 17; i++) sum += (Number(first17[i]) * CLABE_WEIGHTS[i % 3]) % 10;
    return String((10 - (sum % 10)) % 10);
  }

  const BANKS = [
    ['002', 'Banamex'], ['012', 'BBVA México'], ['014', 'Santander'], ['021', 'HSBC'],
    ['030', 'Banco del Bajío'], ['036', 'Inbursa'], ['042', 'Mifel'], ['044', 'Scotiabank'],
    ['058', 'Banregio'], ['072', 'Banorte'], ['127', 'Banco Azteca'], ['137', 'BanCoppel'],
    ['638', 'NU México'], ['646', 'STP'], ['710', 'NVIO'],
  ];

  const bank = {
    generate(v) {
      const [code, name] = v.bank === 'random' ? pick(BANKS) : BANKS.find(([c]) => c === v.bank);
      const plaza = /^\d{1,3}$/.test((v.plaza || '').trim()) ? pad(v.plaza.trim(), 3) : randomDigits(3);
      const account = randomDigits(11);
      const first17 = code + plaza + account;
      const clabe = first17 + clabeCheckDigit(first17);
      return {
        code: v.format === 'grouped' ? `${code} ${plaza} ${account} ${clabe[17]}` : clabe,
        meta: `${name} · plaza ${plaza} · cuenta ${account}`,
      };
    },

    validate(raw) {
      const s = raw.replace(/[\s-]/g, '');
      if (!/^\d{18}$/.test(s)) return { valid: false, reason: 'A CLABE is exactly 18 digits.' };
      const expected = clabeCheckDigit(s.slice(0, 17));
      if (expected !== s[17]) return { valid: false, reason: `Wrong check digit — expected ${expected}, got ${s[17]}.` };
      const found = BANKS.find(([c]) => c === s.slice(0, 3));
      return {
        valid: true,
        info: [
          found ? `Banco ${s.slice(0, 3)} — ${found[1]}` : `Banco ${s.slice(0, 3)} (not in the built-in list)`,
          `Plaza ${s.slice(3, 6)} · cuenta ${s.slice(6, 17)}`,
          `Check digit ${expected} ✓`,
        ],
      };
    },
  };

  Gen.register('MX', {
    options: { states: optionList(STATES), banks: optionList(BANKS) },
    docs: { id, bank },
    // Checksum helpers, reachable as Gen.country('MX').internals for a self-test.
    internals: { curpCheckDigit, buildCurp, clabeCheckDigit },
  });
})(typeof Gen !== 'undefined' ? Gen : require('../core.js'));
