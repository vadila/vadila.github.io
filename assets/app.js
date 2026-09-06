'use strict';

const all = (selector, root = document) => Array.from(root.querySelectorAll(selector));
const one = (selector, root = document) => root.querySelector(selector);

async function copyText(text, button) {
  const done = () => {
    const original = button.dataset.label || button.textContent;
    button.dataset.label = original;
    button.textContent = 'Copied ✓';
    button.classList.add('copied');
    setTimeout(() => { button.textContent = original; button.classList.remove('copied'); }, 1200);
  };
  try {
    await navigator.clipboard.writeText(text);
    done();
  } catch {}
}

/** Fill the selects that mirror a country's lookup tables (banks, states, …). */
function fillOptions(panel, country) {
  for (const select of all('[data-options]', panel)) {
    const rows = (country.options || {})[select.dataset.options] || [];
    select.replaceChildren(...rows.map(([value, label]) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      return option;
    }));
  }
}

/** Generator + validator for one document section. */
function wireDoc(section, doc) {
  const fields = all('[data-field]', section);
  const countSelect = one('[data-role="count"]', section);
  const results = one('[data-role="results"]', section);
  const genBtn = one('[data-action="generate"]', section);
  const copyAllBtn = one('[data-action="copy-all"]', section);

  const readValues = () => {
    const v = {};
    for (const input of fields) v[input.dataset.field] = input.value;
    return v;
  };

  const applyVisibility = () => {
    const v = readValues();
    for (const field of all('[data-show-if]', section)) {
      const [name, values] = field.dataset.showIf.split('=');
      field.hidden = !values.split('|').includes(v[name]);
    }
  };

  const li = (className, ...children) => {
    const node = document.createElement('li');
    node.className = className;
    node.append(...children);
    return node;
  };
  const div = (className, text) => {
    const node = document.createElement('div');
    node.className = className;
    node.textContent = text;
    return node;
  };

  let lastCodes = [];

  const generate = () => {
    const v = readValues();
    const n = +countSelect.value;
    results.replaceChildren();
    lastCodes = [];
    for (let i = 0; i < n; i++) {
      let item;
      try {
        item = doc.generate(v);
      } catch (err) {
        const grow = document.createElement('span');
        grow.className = 'grow';
        grow.append(div('value', '—'), div('meta', err.message));
        results.append(li('result', grow));
        copyAllBtn.hidden = true;
        return;
      }
      lastCodes.push(item.code);

      const grow = document.createElement('span');
      grow.className = 'grow';
      grow.append(div('value', item.code));
      if (item.meta) grow.append(div('meta', item.meta));

      const copyBtn = document.createElement('button');
      copyBtn.className = 'btn small';
      copyBtn.textContent = 'Copy';
      copyBtn.addEventListener('click', () => copyText(item.code, copyBtn));

      results.append(li('result', grow, copyBtn));
    }
    copyAllBtn.hidden = lastCodes.length < 2;
  };

  for (const input of fields) {
    input.addEventListener('change', applyVisibility);
    input.addEventListener('input', applyVisibility);
  }
  genBtn.addEventListener('click', generate);
  copyAllBtn.addEventListener('click', () => copyText(lastCodes.join('\n'), copyAllBtn));

  /* ---- validator ---- */
  const input = one('[data-role="validate"]', section);
  const verdict = one('[data-role="verdict"]', section);

  const check = () => {
    const raw = input.value.trim();
    if (!raw) { verdict.className = 'verdict'; verdict.replaceChildren(); return; }
    const res = doc.validate(raw);
    verdict.className = `verdict ${res.valid ? 'ok' : 'err'}`;
    verdict.replaceChildren(document.createTextNode(res.valid ? 'Valid ✓' : `Invalid — ${res.reason}`));
    if (res.valid && res.info) {
      const ul = document.createElement('ul');
      for (const line of res.info) {
        const item = document.createElement('li');
        item.textContent = line;
        ul.append(item);
      }
      verdict.append(ul);
    }
  };

  input.addEventListener('input', check);
  one('[data-action="check"]', section).addEventListener('click', check);

  applyVisibility();
  generate();
}

/** Sub-tabs of one country panel; returns a `selectDoc(token)` for deep links. */
function wirePanel(panel) {
  const country = Gen.country(panel.dataset.country);
  if (!country) return () => {};

  fillOptions(panel, country);

  const tabs = all('.switcher .sw', panel);
  const sections = all('.doc', panel);

  const select = (docId) => {
    for (const tab of tabs) tab.setAttribute('aria-selected', String(tab.dataset.doc === docId));
    for (const section of sections) section.hidden = section.dataset.doc !== docId;
  };

  for (const tab of tabs) tab.addEventListener('click', () => select(tab.dataset.doc));
  for (const section of sections) {
    const doc = country.docs[section.dataset.doc];
    if (doc) wireDoc(section, doc);
  }

  return (token) => {
    const tab = tabs.find((t) => t.dataset.doc === token
      || (t.dataset.aliases || '').split(/\s+/).includes(token));
    if (tab) select(tab.dataset.doc);
  };
}

function init() {
  const tabs = all('.tabs .tab');
  const panels = all('#panels .panel');
  const selectDoc = new Map(panels.map((p) => [p.dataset.country, wirePanel(p)]));

  const select = (key, push = true) => {
    for (const tab of tabs) {
      const active = tab.dataset.country === key;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    }
    for (const panel of panels) panel.hidden = panel.dataset.country !== key;
    if (push) history.replaceState(null, '', `#${key.toLowerCase()}`);
  };

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => select(tab.dataset.country));
    tab.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      const next = (i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length;
      select(tabs[next].dataset.country);
      tabs[next].focus();
    });
  });

  // "#pl" opens the country tab; "#pl-nip" (or "#pl-iban", "#pl-dowod") also opens a sub-tab.
  const hash = decodeURIComponent((location.hash || '').replace('#', '')).toLowerCase();
  const [hashKey, ...rest] = hash.split('-');
  const key = tabs.some((t) => t.dataset.country === hashKey.toUpperCase())
    ? hashKey.toUpperCase()
    : tabs[0].dataset.country;
  select(key, false);
  const hashDoc = rest.join('-');
  if (hashDoc) selectDoc.get(key)(hashDoc);
}

document.addEventListener('DOMContentLoaded', init);
