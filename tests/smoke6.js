const { JSDOM } = require('jsdom'); const fs = require('fs');
const dom = new JSDOM(fs.readFileSync(require('path').join(__dirname, '..', 'index.html'),'utf8'), { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/', beforeParse(w){ w.scrollTo=()=>{}; w.Element.prototype.scrollIntoView=()=>{}; } });
const w = dom.window, errs = []; dom.virtualConsole.on('jsdomError', e => errs.push(e.message));
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  w.location.hash = '#/pa'; await wait(30);
  const start = w.document.querySelector('[data-act="pastart"][data-mode="practice"]'); start.click(); await wait(30);
  const st = () => JSON.parse(w.localStorage.getItem('sc300.progress.v1')).pa;
  const cur = st().cur; const doms = {}; cur.ids.forEach(id => { const d = id.startsWith('x') || id.startsWith('c') ? 'x' : id.slice(0,2); doms[d] = (doms[d]||0)+1; });
  // answer q1, check it, then answer the rest by picking the first option
  let checked = false, withLinks = 0;
  for (let i = 0; i < cur.ids.length; i++) {
    const c = w.document.getElementById('content');
    const inp = c.querySelector('input[data-pa]'); if (inp) { inp.checked = true; inp.dispatchEvent(new w.Event('change', { bubbles: true })); }
    if (i === 0) { w.document.querySelector('[data-act="pacheck"]').click(); await wait(10); checked = !!w.document.querySelector('.pa__why'); withLinks = w.document.querySelectorAll('.pa__why li a').length; }
    const nx = w.document.querySelector('[data-act="panext"]'); if (nx) { nx.click(); await wait(2); }
  }
  const fin = () => w.document.querySelector('.pa__nav [data-act="pafinish"]'); fin().click(); fin().click(); await wait(60);
  const c = w.document.getElementById('content');
  const rows = c.querySelectorAll('.pa__q').length, dom = c.querySelectorAll('h2').length;
  const h = st().hist[0];
  // every question in the report has at least one Learn link
  const noLink = [...c.querySelectorAll('.pa__q')].filter(q => !q.querySelector('.pa__why li a')).length;
  // exam-conditions mode shows a clock
  w.location.hash = '#/pa'; await wait(30); w.document.querySelector('[data-act="pastart"][data-mode="exam"]').click(); await wait(40);
  const clock = (w.document.getElementById('paClock') || {}).textContent;
  // lab run record
  w.location.hash = '#/lab/02-02'; await wait(30); w.document.querySelector('[data-act="labrun"]').click(); await wait(30);
  w.location.hash = '#/m/02-02'; await wait(30);
  const labRow = [...w.document.querySelectorAll('.field__row')].find(r => r.textContent.startsWith('Lab run')).textContent;
  console.log('PA drawn:', cur.ids.length, 'mix', JSON.stringify(doms), '| check shows rationale:', checked, 'links:', withLinks);
  console.log('report:', rows, 'questions,', dom, 'sections, score', h.pct + '%', '| questions without a Learn link:', noLink);
  console.log('exam clock:', clock, '| lab run field:', labRow, '| errors:', errs);
  process.exit(0);
})();
