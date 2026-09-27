const { JSDOM } = require('jsdom'); const fs = require('fs');
const dom = new JSDOM(fs.readFileSync(require('path').join(__dirname, '..', 'index.html'),'utf8'), { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.org/', beforeParse(w){ w.scrollTo=()=>{}; w.Element.prototype.scrollIntoView=()=>{}; } });
const w = dom.window; const miss = [];
w.MODULES.forEach(m => { w.location.hash = '#/m/' + m.id; w.dispatchEvent(new w.HashChangeEvent('hashchange'));
  if (![...w.document.querySelectorAll('.field__key')].some(k => k.textContent === 'Code verified')) miss.push(m.id); });
w.location.hash = '#/m/04-04'; w.dispatchEvent(new w.HashChangeEvent('hashchange'));
const r = [...w.document.querySelectorAll('.field__row')].find(x => x.textContent.startsWith('Code verified'));
console.log('code stamp:', miss.length ? miss : 'all 18 OK', '|', r && r.textContent);
