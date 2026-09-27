// Print the app's modules (id, group, objectives, Learn training links) as JSON, straight from content/.
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..'), ctx = { window: {}, console };
vm.createContext(ctx);
for (const f of ['parts/helpers.js', 'parts/dg.js', 'parts/vis.js', 'content/00_exam.js', 'content/d1.js', 'content/d2.js', 'content/d3a.js', 'content/d3b.js', 'content/d4a.js', 'content/d4b.js'])
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
vm.runInContext('this.__out = { outline: EXAM.outline, modules: MODULES.map(m => ({ id: m.id, domain: m.domain, group: m.group, objectives: m.objectives, ms: m.ms || [] })) };', ctx);
process.stdout.write(JSON.stringify(ctx.__out));
