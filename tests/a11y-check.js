// Accessibility and rendering check in real Chromium (run by .github/workflows/a11y.yml).
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const AXE = require.resolve('axe-core/axe.min.js');
const BASE = process.env.BASE_URL || 'http://localhost:8080/';
const views = ['dash', 'learn', 'learn/L4', 'glossary', 'm/02-02', 'm/03-02', 'lab/02-02', 'pa', 'exam', 'ready', 'cost'];
const sizes = { phone: { width: 390, height: 844 }, desktop: { width: 1440, height: 900 } };
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'];
(async () => {
  const shots = path.join(__dirname, 'screenshots'); fs.mkdirSync(shots, { recursive: true });
  const browser = await chromium.launch(), problems = [];
  for (const theme of ['light', 'dark']) {
    for (const [size, viewport] of Object.entries(sizes)) {
      const ctx = await browser.newContext({ viewport });
      await ctx.addInitScript(t => { try { localStorage.setItem('sc300.theme', t); } catch (e) {} }, theme);
      const page = await ctx.newPage();
      page.on('pageerror', e => problems.push(`${theme}/${size}: page error: ${e.message}`));
      page.on('console', m => { if (m.type() === 'error') problems.push(`${theme}/${size}: console error: ${m.text()}`); });
      const audit = async (label) => {
        await page.addScriptTag({ path: AXE });
        const r = await page.evaluate(async (tags) => await axe.run(document, { runOnly: { type: 'tag', values: tags } }), TAGS);
        r.violations.forEach(v => problems.push(`${theme}/${size} ${label}: ${v.id} (${v.impact}) - ${v.help} - ${v.nodes.length} node(s), e.g. ${v.nodes[0].target.join(' ')}`));
        const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        if (size === 'phone' && over > 1) problems.push(`${theme}/${size} ${label}: page scrolls sideways by ${over}px`);
        await page.screenshot({ path: path.join(shots, `${theme}-${size}-${label.replace(/[/#]/g, '_')}.png`) });
      };
      for (const v of views) { await page.goto(BASE + '#/' + v); await page.waitForTimeout(300); await audit('#/' + v); }
      await page.goto(BASE + '#/pa'); await page.click('[data-act="pastart"][data-mode="practice"]'); await page.waitForTimeout(300);
      await audit('pa-question');
      await ctx.close();
    }
  }
  await browser.close();
  if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
  console.log(`accessibility check passed: ${views.length + 1} page types x 2 themes x 2 sizes, 0 violations`);
})();
