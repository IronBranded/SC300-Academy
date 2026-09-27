const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');
const errors = [];
const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/',
  beforeParse(w) { w.scrollTo = () => {}; w.Element.prototype.scrollIntoView = () => {}; w.matchMedia = () => ({ matches: false, addListener(){}, addEventListener(){} }); } });
const w = dom.window;
w.addEventListener('error', e => errors.push('window error: ' + e.message));
const vc = dom.virtualConsole; vc.on('jsdomError', e => errors.push('jsdom: ' + e.message));
function go(h) { w.location.hash = h; w.dispatchEvent(new w.HashChangeEvent('hashchange')); }
const routes = ['#/dash', '#/learn', '#/glossary', '#/exam', '#/cost', '#/ready'];
w.MODULES.forEach(m => { routes.push('#/m/' + m.id); routes.push('#/lab/' + m.id); });
w.LEARN.forEach(L => routes.push('#/learn/' + L.id));
const report = [];
for (const r of routes) {
  try { go(r); } catch (e) { errors.push(r + ': ' + e.message); }
  const c = w.document.getElementById('content');
  const len = c.innerHTML.length;
  if (len < 400) errors.push(r + ' short content ' + len);
  if (r.startsWith('#/m/')) {
    const id = r.slice(4); const figs = (w.FIGURES[id] || []).length;
    const placed = c.querySelectorAll('[id^="fig-' + id + '-"]').length;
    if (figs !== placed) errors.push(r + ' figures ' + placed + '/' + figs);
    const q = c.querySelectorAll('.quiz__q').length; if (!q) errors.push(r + ' no quiz');
    report.push(id + ' q' + q + ' fig' + placed + ' h2:' + c.querySelectorAll('h2').length);
  }
}
// widgets
go('#/m/02-02');
let sel = w.document.querySelector('[data-widget="ca-eval"] select[data-s="client"]');
sel.value = 'legacy'; sel.dispatchEvent(new w.Event('change'));
const out1 = w.document.querySelector('[data-widget="ca-eval"] .cae__out').textContent;
const u = w.document.querySelector('[data-widget="ca-eval"] select[data-s="user"]'); u.value = 'bg'; u.dispatchEvent(new w.Event('change'));
const out2 = w.document.querySelector('[data-widget="ca-eval"] .cae__out').textContent;
go('#/m/03-02');
const cs = w.document.querySelector('[data-widget="consent"] select[data-s="perm"]'); cs.value = 'app'; cs.dispatchEvent(new w.Event('change'));
const out3 = w.document.querySelector('[data-widget="consent"] .cae__out').textContent;
// exam flow
go('#/exam');
w.document.querySelector('[data-act="xstart"][data-mode="full"]').click();
const n = w.state ? 0 : 0;
const cur = JSON.parse(w.localStorage.getItem('sc300.progress.v1')).exam.cur;
let steps = 0;
for (let i = 0; i < cur.ids.length; i++) { const nx = w.document.querySelector('[data-act="xnext"]'); if (nx && !nx.disabled) { nx.click(); steps++; } }
const sub = w.document.querySelector('[data-act="xsubmit"]'); sub.click(); w.document.querySelector('[data-act="xsubmit"]') && w.document.querySelector('[data-act="xsubmit"]').click();
const rev = w.document.getElementById('content').textContent.slice(0, 120);
// quiz check on a module
go('#/m/01-01');
w.document.querySelectorAll('.quiz__q').forEach(fs => { const r = fs.querySelector('input[type=radio]'); r.checked = true; r.dispatchEvent(new w.Event('change', { bubbles: true })); });
w.document.querySelector('[data-act="check"]').click();
const score = (w.document.querySelector('.quiz__score') || {}).textContent;
go('#/ready'); const ready = w.document.getElementById('content').textContent.slice(0, 160);
console.log(report.join('\n'));
console.log('CA legacy ->', out1.slice(0, 80)); console.log('CA bg ->', out2.slice(0, 80)); console.log('consent app ->', out3.slice(0, 80));
console.log('exam: ids', cur.ids.length, 'walked', steps, '| review:', rev.replace(/\s+/g,' '));
console.log('quiz score', score, '| ready:', ready.replace(/\s+/g, ' '));
console.log('GLOSS terms', w.document.title);
console.log('ERRORS', errors.length, errors.slice(0, 20));
