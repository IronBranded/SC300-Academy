const { JSDOM } = require('jsdom'); const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8'); const errors = [];
const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/',
  beforeParse(w) { w.scrollTo = () => {}; w.Element.prototype.scrollIntoView = () => {}; } });
const w = dom.window; dom.virtualConsole.on('jsdomError', e => errors.push(e.message));
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  w.location.hash = '#/exam'; await wait(50);
  w.document.querySelector('[data-act="xstart"][data-mode="d2"]').click(); await wait(50);
  // answer every question: pick option 0 / Yes / first blank option
  for (let i = 0; i < 40; i++) {
    const c = w.document.getElementById('content');
    c.querySelectorAll('input[name="xopt"]').forEach((el, k) => { if (k === 0) { el.checked = true; el.dispatchEvent(new w.Event('change', { bubbles: true })); } });
    c.querySelectorAll('input[data-x="yesno"][value="1"]').forEach(el => { el.checked = true; el.dispatchEvent(new w.Event('change', { bubbles: true })); });
    c.querySelectorAll('select.xq__sel').forEach(el => { el.value = '0'; el.dispatchEvent(new w.Event('change', { bubbles: true })); });
    const nx = c.querySelector('[data-act="xnext"]'); if (!nx || nx.disabled) break; nx.click(); await wait(5);
  }
  const b = () => w.document.querySelector('[data-act="xsubmit"]');
  b().click(); b().click(); await wait(80);
  const c = w.document.getElementById('content');
  console.log('route', w.location.hash, '| head:', c.querySelector('h1').textContent, '|', (c.querySelector('.gauge__big') || {}).textContent, '| rows', c.querySelectorAll('.xr__q').length);
  w.location.hash = '#/ready'; await wait(50);
  console.log('ready blocks', w.document.querySelectorAll('.ready__block').length, '| missed rows', w.document.querySelectorAll('.ready__row').length);
  w.location.hash = '#/cost'; await wait(50);
  console.log('cost groups', w.document.querySelectorAll('.plan__group').length, '|', w.document.querySelector('.field__note') && w.document.querySelectorAll('#content .field__note')[0].textContent);
  w.location.hash = '#/glossary'; await wait(50);
  console.log('glossary terms', w.document.querySelectorAll('.gl__t').length);
  console.log('errors', errors);
})();
