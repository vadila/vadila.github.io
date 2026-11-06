# ID & Bank Account Generators

A single static page with one tab per country that generates **structurally valid, synthetic
national identification numbers and bank accounts** for test data, each with a
copy-to-clipboard button and a validator.

| Tab | Country | National ID | Other documents | Bank account |
|-----|---------|-------------|-----------------|--------------|
| 🇪🇸 ES | Spain | DNI / NIE | — | IBAN (24 chars, incl. CCC control digits) |
| 🇲🇽 MX | Mexico | CURP | — | CLABE (18 digits) |
| 🇵🇱 PL | Poland | PESEL | NIP (tax number), numer dowodu osobistego | IBAN (28 chars) / NRB |
| 🇷🇴 RO | Romania | CNP | — | IBAN (24 chars) |
| 🇵🇹 PT | Portugal | N.º Documento de Identificação (Cartão de Cidadão) | NISS (Segurança Social) | IBAN (25 chars, incl. NIB control digits) |
| 🇨🇴 CO | Colombia | Cédula CC / TI / CE, NIT | — | Cuenta bancaria (no IBAN — see below) |

Each country tab has a switch across the documents it offers — for Poland that is
**PESEL / NIP / Dowód osobisty / IBAN**. Everything runs client-side — no build step,
no dependencies, no network calls.

> **Mexico and Colombia are not in the IBAN registry.** Mexico uses the 18-digit CLABE, which
> has a real check digit. Colombia uses a bank code plus an account number with **no published
> checksum at all**, so that tab only produces realistic bank codes and lengths — there is
> nothing to verify beyond the format.

> The numbers satisfy each country's published format and checksum rules but are **not** issued
> to any real person. Use them for test fixtures only.

## Files

```
index.html                       the whole page: tabs, sub-tabs, card headers,
                                 form fields and the structure tables
assets/styles.css                styling (light + dark, responsive)
assets/core.js                   shared helpers (random, dates, mod-97 IBAN)
                                 and the country registry
assets/countries/es.js           Spain — DNI / NIE, IBAN / CCC
assets/countries/mx.js           Mexico — CURP, CLABE
assets/countries/pl.js           Poland — PESEL, NIP, dowód osobisty, IBAN / NRB
assets/countries/ro.js           Romania — CNP, IBAN
assets/countries/pt.js           Portugal — Cartão de Cidadão, NISS, IBAN / NIB
assets/countries/co.js           Colombia — cédula / NIT, cuenta bancaria
assets/app.js                    UI wiring only — it builds no markup
.nojekyll                        tells Pages to serve files as-is (skip Jekyll)
.github/workflows/deploy-pages.yml   GitHub Actions deploy (optional, see below)
```

## How the page is put together

All static content lives in `index.html` — the country tabs, the document sub-tabs, the
card headers (`Validate IBAN`, `Structure`), the hints, the labels and the fixed
`<option>` lists. `app.js` never creates any of it; it reads `data-*` hooks and connects
them to the generators each country file registered on `Gen`:

| Hook | Meaning |
|---|---|
| `data-country` | a country tab and the panel it controls |
| `data-doc` | a document sub-tab and the section it controls |
| `data-aliases` | extra hash tokens that open that sub-tab (`#pl-vat` → NIP) |
| `data-field` | an input whose value is passed to `generate()` under that name |
| `data-options` | a select filled from one of the country's lookup tables |
| `data-show-if` | `field=value\|value` — show the field only for those values |
| `data-role` | `count` / `results` / `validate` / `verdict` |
| `data-action` | `generate` / `copy-all` / `check` |

The only lists still built in JavaScript are the ones the generator itself needs — banks,
Mexican states, Romanian counties, Polish tax offices — so their codes and names are not
duplicated between the markup and the checksum code. A country file exposes them as
`options` and its documents as `docs`:

```js
Gen.register('ES', {
  options: { banks: optionList(BANKS) },     // fills <select data-options="banks">
  docs: { id: { generate, validate }, bank: { generate, validate } },
});
```

Adding a document to a country is therefore: a `docs` entry in that country's file, plus a
sub-tab button and a `.doc` section in `index.html` carrying the same `data-doc` value.

## Local preview

Open `index.html` directly, or serve it (clipboard API prefers a secure context):

```sh
python3 -m http.server 8000
# then http://localhost:8000
```

## Publishing to GitHub Pages

Push this folder as the root of a repository, then pick **one** of the two options.

```sh
cd generators
git init -b main
git add .
git commit -m "National ID generators"
git remote add origin git@github.com:<org>/<repo>.git
git push -u origin main
```

### Option A — Deploy from a branch (simplest)

1. **Settings → Pages**
2. **Source**: `Deploy from a branch`
3. **Branch**: `main`, folder `/ (root)` → **Save**

The `.nojekyll` file is what stops Jekyll from mangling the `assets/` folder. Delete
`.github/workflows/deploy-pages.yml` if you use this option — you don't need it.

### Option B — GitHub Actions (included workflow)

1. **Settings → Pages**
2. **Source**: `GitHub Actions` → **Save**

The included workflow then publishes on every push to `main`, and can be run manually from
the **Actions** tab. Nothing else to configure.

### If this lives in a subfolder of an existing repo

Pages can only serve the repo root or `/docs`. Two ways out:

- Point Pages at `/docs` and move these files there, or
- keep Option B and change the workflow's upload path:

  ```yaml
  - uses: actions/upload-pages-artifact@v3
    with:
      path: ./generators
  ```

### URL

- Project site: `https://<org>.github.io/<repo>/`
- Deep link to a country tab: append `#es`, `#mx`, `#pl`, `#ro`, `#pt`, `#co`
- Deep link straight to a sub-tab: append the document, e.g. `#pl-iban`, `#mx-clabe`,
  `#pl-nip` (also `#pl-vat`), `#pl-dowod`, `#pt-cc`, `#pt-niss`, `#pt-iban`

For a custom domain, add a `CNAME` file containing the hostname and configure the DNS record
under **Settings → Pages → Custom domain**.

## Algorithms

| Document | Rule implemented |
|---|---|
| **DNI** | 8 digits + control letter `TRWAGMYFPDXBNJZSQVHLCKE[n mod 23]` |
| **NIE** | `X`/`Y`/`Z` mapped to `0`/`1`/`2`, then the DNI letter rule |
| **CURP** | Name-derived 4 chars (with the RENAPO inconvenient-word filter), `YYMMDD`, sex, state, three inner consonants, century homoclave, mod-10 check digit |
| **PESEL** | `YYMMDD` with century-shifted month (+20 for 2000s, +80 for 1800s), serial whose last digit encodes sex, check digit with weights `1,3,7,9…` |
| **NIP** | 3-digit tax-office prefix + 6-digit serial + check digit; weights `6,5,7,2,3,4,5,6,7` over digits 1–9, `sum mod 11`. A body whose remainder is 10 has no writable check digit and is never issued — the generator draws again |
| **Dowód osobisty** | 3 series letters (`A`=10 … `Z`=35) + 6 digits, the **first** digit being the check digit; weights `7,3,1,9,7,3,1,7,3` across all nine characters, valid when `sum mod 10 == 0` |
| **CNP** | Sex/century digit, `YYMMDD`, county code, serial `001–999`, check digit with weights `279146358279` mod 11 (10 → 1) |
| **Cartão de Cidadão** | 8-digit civil ID + its check digit (weights `9…2`, mod 11; 10 is printed as 0 and never generated) + 2-character version (`ZZ` on a first card) + final check digit: from the right, every other value (A=10 … Z=35) doubled, −9 if over 9, total ≡ 0 mod 10 |
| **NISS** | 11 digits, first `1` (individual) or `2` (legal entity); check digit = `9 − (sum mod 10)` with weights `29,23,19,17,13,11,7,5,3,2` |
| **NIT** | Base number + verification digit, weights `3,7,13,17,19,23,29,37,41,43,47,53,59,67,71` right-to-left, mod 11 |
| **Cédula (CC/TI/CE)** | No checksum exists in the Colombian scheme — only realistic series ranges are produced |
| **IBAN** (ES/PL/RO/PT) | ISO 7064 mod-97-10: check digits = `98 − mod97(bban + country + "00")` |
| **ES CCC** | Two extra control digits — one over `00`+entidad+oficina, one over the account, weights `1,2,4,8,5,10,9,7,3,6` mod 11 |
| **PT NIB** | 21 digits: banco(4) + balcão(4) + conta(11) + 2 control digits = `98 − mod97(first 19 digits + "00")`; this makes every PT IBAN's check digits `50` |
| **PL NRB** | The 8-digit sort code carries its own check digit, weights `3,9,7,1,3,9,7` mod 10 |
| **CLABE** | 18 digits: bank(3) + plaza(3) + account(11) + check digit — each digit × weight `3,7,1` taken mod 10, summed, then `10 − (sum mod 10)` |
| **CO cuenta** | Bank code + account number; no check digit exists. Nequi/Daviplata accounts are the holder's mobile number |

The check-digit implementations are verified against published reference numbers —
`12345678Z`, `44051401359`, `HEGG560427MVZRRL04`, the Cartão de Cidadão example `00000000 0 ZZ4`, NITs `890903938-8` and `899999068-1`,
the publicly listed NIPs `5250007738` (PKO BP), `5260250995` (Orange Polska) and
`5261040828`, the dowód example `ABA300000`, the SWIFT registry IBAN examples
`ES9121000418450200051332`, `PL61109010140000071219812874`, `RO49AAAA1B31007593840000`, `PT50000201231234567890154`,
and CLABE `032180000118359719`.

The validators reject a value that merely *looks* right: an ES IBAN with a correct mod-97
checksum but wrong CCC control digits is flagged, as is a PT IBAN with wrong NIB control digits, a PL IBAN with a bad sort-code check
digit and a NIP whose first nine digits could only ever take a check digit of 10.

The NIP and dowód validators accept the formatted variants too — `525-000-77-38`,
`525-00-07-738`, `PL5250007738` and `ABA 300000`. A NIP's tax-office prefix is labelled
with its city when it is one of the built-in codes; it is historical and plays no part in
the checksum, so an unrecognised prefix is reported rather than rejected.
