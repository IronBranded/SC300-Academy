/* app.js - SC-300 guide runtime (the AI-901 runtime, generalised to any number of domains).
   Progress lives in this browser (localStorage) and, when the claude.ai viewer
   grants it, in a private per-user document so it follows you between devices. */
(function () {
  'use strict';

  var STORE_KEY = 'sc300.progress.v1', THEME_KEY = 'sc300.theme', PASS = 80;
  var SCORED = EXAM.domains.filter(function (d) { return d.id !== '00'; }).map(function (d) { return d.id; });
  var ORDER = SCORED.concat(['00']);
  var MAXMID = Math.max.apply(null, EXAM.domains.map(function (d) { return d.mid; }));
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------------- state ---------------- */
  function blank() { return { v: 1, read: {}, learned: {}, steps: {}, quiz: {}, misses: {}, exam: { cur: null, hist: [] }, pa: { cur: null, hist: [], view: 0 }, labrun: {}, review: false, updatedAt: 0 }; }
  function normalize(s) {
    var b = blank();
    if (!s || s.v !== 1) return b;
    ['read', 'learned', 'steps', 'quiz', 'misses'].forEach(function (k) { if (s[k] && typeof s[k] === 'object') b[k] = s[k]; });
    if (s.exam && typeof s.exam === 'object') b.exam = { cur: s.exam.cur || null, hist: Array.isArray(s.exam.hist) ? s.exam.hist : [] };
    if (s.pa && typeof s.pa === 'object') b.pa = { cur: s.pa.cur || null, hist: Array.isArray(s.pa.hist) ? s.pa.hist : [], view: s.pa.view || 0 };
    if (s.labrun && typeof s.labrun === 'object') b.labrun = s.labrun;
    b.review = !!s.review; b.updatedAt = s.updatedAt || 0;
    return b;
  }
  function loadLocal() { try { return normalize(JSON.parse(localStorage.getItem(STORE_KEY))); } catch (e) { return blank(); } }
  var state = loadLocal();
  function save() {
    state.updatedAt = Date.now();
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* storage may be unavailable */ }
    scheduleSync();
  }

  /* ---------------- sync (optional) ---------------- */
  var syncRef = null, syncTimer = null;
  function setSync(text, st) { var el = $('#sync'); if (el) { el.textContent = text; el.dataset.state = st || ''; } }
  function scheduleSync() {
    if (!syncRef) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(function () {
      syncRef.set({ json: JSON.stringify(state), updatedAt: state.updatedAt })
        .then(function () { setSync('Synced to your account', 'synced'); })
        .catch(function () { setSync('Saved in this browser', ''); });
    }, 1200);
  }
  function initSync() {
    if (!window.claude || typeof window.claude.use !== 'function') return;
    Promise.all([window.claude.use('db'), window.claude.use('user')]).then(function (caps) {
      var db = caps[0], user = caps[1];
      if (!db || !user) return null;
      return user.id().then(function (uid) {
        if (!uid) return null;
        var ref = db.doc('data/users/' + uid + '/progress');
        return ref.get().then(function (snap) {
          syncRef = ref;
          var remote = snap.exists ? snap.data() : null;
          if (remote && remote.json && (remote.updatedAt || 0) > (state.updatedAt || 0)) {
            try { state = normalize(JSON.parse(remote.json)); localStorage.setItem(STORE_KEY, remote.json); } catch (e) {}
            render(true);
            setSync('Synced to your account', 'synced');
          } else if (state.updatedAt) {
            scheduleSync();
          } else {
            setSync('Synced to your account', 'synced');
          }
        });
      });
    }).catch(function () { /* stay local */ });
  }

  /* ---------------- model helpers ---------------- */
  function byId(id) { for (var i = 0; i < MODULES.length; i++) if (MODULES[i].id === id) return MODULES[i]; return null; }
  function dom(id) { for (var i = 0; i < EXAM.domains.length; i++) if (EXAM.domains[i].id === id) return EXAM.domains[i]; return null; }
  function mods(d) { return MODULES.filter(function (m) { return m.domain === d; }); }
  function labKeys(m) {
    var k = m.lab.steps.map(function (_, i) { return 's' + i; });
    m.lab.teardown.forEach(function (b, bi) { b.items.forEach(function (_, i) { k.push('t' + bi + '-' + i); }); });
    return k;
  }
  function labTotal(m) { return labKeys(m).length; }
  function labDone(m) { var s = state.steps[m.id] || {}; return labKeys(m).filter(function (k) { return s[k]; }).length; }
  function labComplete(m) { return labDone(m) === labTotal(m); }
  function quizLast(m) { return state.quiz[m.id] && state.quiz[m.id].last; }
  function quizPct(m) { var l = quizLast(m); return l ? Math.round(100 * l.score / l.total) : null; }
  function objLevel(m, i) {
    var l = quizLast(m), qs = m.quiz.filter(function (q) { return q.obj === i; });
    if (l && qs.length && m.quiz.every(function (q, qi) { return q.obj !== i || l.correct[qi]; })) return 'tested';
    if (labComplete(m)) return 'practised';
    if (state.read[m.id]) return 'read';
    return 'none';
  }
  var LEVEL_TEXT = { none: 'Not started', read: 'Read', practised: 'Lab complete', tested: 'Quiz passed' };
  function pagesDone(list) { var n = 0; list.forEach(function (m) { if (state.read[m.id]) n++; if (labComplete(m)) n++; }); return n; }
  function moduleProgress(m) {
    var q = quizPct(m);
    return ((state.read[m.id] ? 1 : 0) + labDone(m) / labTotal(m) + (q === null ? 0 : q / 100)) / 3;
  }
  function pct(x) { return Math.round(x * 100); }
  function costChip(level, label) { return '<span class="cost" data-level="' + level + '">' + label + '</span>'; }
  function meter(level) { return '<span class="meter" data-level="' + level + '">' + '<span class="meter__step"></span>'.repeat(5) + '</span>'; }
  function slug(s) { return 'h-' + s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

  /* ---------------- routing ---------------- */
  function route() {
    var p = location.hash.replace(/^#\/?/, '').split('/');
    if (p[0] === 'm' && byId(p[1])) return { view: 'module', id: p[1] };
    if (p[0] === 'lab' && byId(p[1])) return { view: 'lab', id: p[1] };
    if (p[0] === 'cost') return { view: 'cost' };
    if (p[0] === 'ready') return { view: 'ready' };
    if (p[0] === 'exam') return { view: p[1] === 'review' ? 'examreview' : 'exam' };
    if (p[0] === 'pa') return { view: p[1] === 'review' ? 'pareview' : 'pa' };
    if (p[0] === 'learn') return lById(p[1]) ? { view: 'learn', id: p[1] } : { view: 'learnindex' };
    if (p[0] === 'glossary') return { view: 'glossary' };
    return { view: 'dash' };
  }
  function go(h) { if (location.hash === h) render(); else location.hash = h; }

  /* ---------------- sidebar ---------------- */
  var closedGroups = {};
  function renderSidebar(r) {
    var cur = r.view === 'module' ? '#/m/' + r.id : r.view === 'lab' ? '#/lab/' + r.id : r.view === 'learn' ? '#/learn/' + r.id : r.view === 'learnindex' ? '#/learn' : r.view === 'examreview' ? '#/exam' : '#/' + r.view;
    function top(h, t) { return '<a class="nav-link" href="' + h + '"' + (cur === h ? ' aria-current="page"' : '') + '><span class="nav-link__id">&mdash;</span><span class="nav-link__title">' + t + '</span></a>'; }
    var h = '<div class="nav-group">' + top('#/dash', 'Dashboard') + top('#/learn', 'Learn the concepts') + top('#/glossary', 'Glossary') + top('#/exam', 'Practice exam') + top('#/pa', 'Practice assessment') + top('#/cost', 'Cost planner') + top('#/ready', 'Readiness') + '</div>';
    var lr = LEARN.filter(function (L) { return state.learned[L.id]; }).length;
    h += '<details class="nav-group" data-domain="L" style="--domain-tint:var(--accent)"' + (closedGroups.L ? '' : ' open') + '><summary class="nav-group__head"><div class="nav-group__top"><span class="nav-group__name">Learn the concepts</span><span class="nav-group__weight">' + lr + '/' + LEARN.length + '</span></div>' +
      '<div class="nav-group__bar"><span class="nav-group__fill" style="width:' + pct(lr / LEARN.length) + '%"></span></div></summary><ul class="nav-list">' +
      LEARN.map(function (L) { var hh = '#/learn/' + L.id; return '<li><a class="nav-link" href="' + hh + '"' + (state.learned[L.id] ? ' data-done="true"' : '') + (cur === hh ? ' aria-current="page"' : '') + '><span class="nav-link__id">' + L.id + '</span><span class="nav-link__title">' + L.short + '</span></a></li>'; }).join('') + '</ul></details>';
    ORDER.forEach(function (d) {
      var D = dom(d), list = mods(d), done = pagesDone(list), total = list.length * 2;
      h += '<details class="nav-group" data-domain="' + d + '" style="--domain-tint:' + D.tint + '"' + (closedGroups[d] ? '' : ' open') + '>' +
        '<summary class="nav-group__head"><div class="nav-group__top"><span class="nav-group__name">' + D.name + '</span><span class="nav-group__weight">' + (d === '00' ? 'setup' : D.weight) + '</span></div>' +
        '<div class="nav-group__bar"><span class="nav-group__fill" style="width:' + pct(done / total) + '%"></span></div></summary><ul class="nav-list">';
      list.forEach(function (m) {
        var mh = '#/m/' + m.id, lh = '#/lab/' + m.id;
        h += '<li><a class="nav-link" href="' + mh + '"' + (state.read[m.id] ? ' data-done="true"' : '') + (cur === mh ? ' aria-current="page"' : '') + '><span class="nav-link__id">' + m.id + '</span><span class="nav-link__title">' + m.short + '</span></a>' +
          '<a class="nav-link" href="' + lh + '"' + (labComplete(m) ? ' data-done="true"' : '') + (cur === lh ? ' aria-current="page"' : '') + '><span class="nav-link__id">' + m.id + '</span><span class="nav-link__title">' + m.short + '<span class="nav-sub">Lab ' + labDone(m) + '/' + labTotal(m) + '</span></span></a></li>';
      });
      h += '</ul></details>';
    });
    var sb = $('#sidebar');
    sb.innerHTML = h;
    $$('details.nav-group[data-domain]', sb).forEach(function (el) {
      el.addEventListener('toggle', function () { closedGroups[el.dataset.domain] = !el.open; });
    });
  }

  /* ---------------- module view ---------------- */
  function progressStripModule(m) {
    var q = quizPct(m);
    return '<div class="progress-strip" id="strip">' +
      '<span>' + (state.read[m.id] ? 'Read' : 'Not read') + ' &middot; Lab ' + labDone(m) + '/' + labTotal(m) + ' &middot; Quiz ' + (q === null ? '&mdash;' : q + '%') + '</span>' +
      '<div class="bar"><span class="bar__fill" style="width:' + pct(moduleProgress(m)) + '%"></span></div>' +
      '<button class="btn" data-act="read" aria-pressed="' + !!state.read[m.id] + '">' + (state.read[m.id] ? 'Read &#10003;' : 'Mark as read') + '</button>' +
      '<button class="btn" data-act="review" aria-pressed="' + state.review + '">Review pass</button>' +
      '<button class="btn" data-variant="danger" data-act="reset">Reset this page</button></div>' +
      '<p class="review-note field__note">Review pass is on: explanation is folded; exam tables, objectives and the knowledge check stay open.</p>';
  }
  function objectivesShape(m) {
    if (!m.objectives.length) return '';
    return S('objectives', 'Objectives covered', '<ul class="objlist">' + m.objectives.map(function (o, i) {
      var lv = objLevel(m, i);
      return '<li data-level="' + lv + '" class="cov__list-item"><span class="cov__dot"></span><span>' + o + '</span><span class="lvl">' + LEVEL_TEXT[lv] + '</span></li>';
    }).join('') + '</ul>');
  }
  function quizShape(m) {
    var qs = state.quiz[m.id] || {}, ans = qs.answers || {}, marked = !!qs.marked, last = qs.last;
    var h = '<p>' + m.quiz.length + ' questions. ' + PASS + '% passes. Wrong answers are counted against their objective on the Readiness page.</p>';
    m.quiz.forEach(function (q, qi) {
      var chosen = ans[qi], right = chosen === q.a;
      var objLabel = q.obj >= 0 ? 'Objective ' + (q.obj + 1) : 'Environment';
      h += '<fieldset class="quiz__q" data-q="' + qi + '"' + (marked ? ' data-marked="true" data-result="' + (right ? 'right' : 'wrong') + '"' : '') + '>' +
        '<legend><span class="quiz__num">Question ' + (qi + 1) + ' &middot; ' + objLabel + '</span>' + q.q + '</legend>';
      q.o.forEach(function (opt, oi) {
        var mark = marked ? (oi === q.a ? ' data-mark="right"' : (oi === chosen ? ' data-mark="wrong"' : '')) : '';
        h += '<label class="quiz__opt"' + mark + '><input type="radio" name="q' + qi + '" value="' + oi + '"' + (chosen === oi ? ' checked' : '') + (marked ? ' disabled' : '') + '><span>' + opt + '</span></label>';
      });
      if (marked) h += '<p class="quiz__why"><strong>' + (right ? 'Correct.' : 'Not quite.') + '</strong> ' + q.why + '</p>';
      h += '</fieldset>';
    });
    h += '<div class="quiz__bar">';
    if (marked && last) {
      var p = Math.round(100 * last.score / last.total);
      h += '<span class="quiz__score" data-pass="' + (p >= PASS) + '">' + last.score + ' / ' + last.total + ' &middot; ' + p + '%</span><button class="btn" type="button" data-act="retry">Try again</button>';
    } else {
      h += '<button class="btn" type="button" data-act="check">Check answers</button><span id="quizmsg" class="field__note"></span>';
      if (last) h += '<span class="field__note">Last attempt: ' + last.score + '/' + last.total + '</span>';
    }
    h += '</div>';
    return '<section class="shape quiz" data-shape="selfcheck" id="quiz"><h2 data-shape="selfcheck">Knowledge check</h2><form class="quiz__form" onsubmit="return false">' + h + '</form></section>';
  }
  function renderModule(m) {
    var D = dom(m.domain);
    var html = '<h1>' + m.title + '</h1>' + progressStripModule(m) +
      Q('tactical', m.tactical) +
      Q('note', '<strong>Objective group:</strong> ' + m.group + '<br><strong>Domain:</strong> ' + D.name + (m.domain === '00' ? '' : ' (' + D.weight + ')') +
        (learnFor(m.id).length ? '<br><strong>Concepts first:</strong> ' + learnFor(m.id).map(function (L) { return '<a href="#/learn/' + L.id + '">' + L.id + ' ' + L.short + '</a>' + (state.learned[L.id] ? ' &#10003;' : ''); }).join(' &middot; ') : '')) +
      objectivesShape(m) + m.body() +
      '<p><a href="#/lab/' + m.id + '">Go to lab ' + m.id + ' &rarr;</a></p>';
    var c = $('#content');
    c.innerHTML = html;
    var src = $('.shape[data-shape="sources"]', c), wrap = document.createElement('div');
    wrap.innerHTML = quizShape(m);
    if (src) src.parentNode.insertBefore(wrap.firstChild, src); else c.appendChild(wrap.firstChild);
    (FIGURES[m.id] || []).forEach(function (f, i) {
      var sec = $('.shape[data-shape="' + f.shape + '"]', c);
      if (!sec) return;
      var w = document.createElement('div'); w.innerHTML = f.html;
      var el = w.firstElementChild; el.id = 'fig-' + m.id + '-' + i;
      if (f.at === 'start') { var h2 = $('h2', sec); sec.insertBefore(el, h2.nextSibling); }
      else if (f.at && f.at.indexOf('afterH3:') === 0) {
        var want = f.at.slice(8), h3 = $$('h3', sec).filter(function (x) { return x.textContent === want; })[0];
        if (!h3) { sec.appendChild(el); return; }
        var nx = h3.nextElementSibling, ref = nx && nx.classList.contains('table-scroll') ? nx : h3;
        ref.parentNode.insertBefore(el, ref.nextSibling);
      } else sec.appendChild(el);
    });
    initWidgets(c);
  }

  /* ---------------- lab view ---------------- */
  function renderLab(m) {
    var s = state.steps[m.id] || {};
    var html = '<h1>Lab ' + m.id + ' &mdash; ' + m.title + '</h1>' +
      '<div class="progress-strip" id="strip"><span id="stripText">' + labDone(m) + ' of ' + labTotal(m) + ' steps</span>' +
      '<div class="bar"><span class="bar__fill" id="stripBar" style="width:' + pct(labDone(m) / labTotal(m)) + '%"></span></div>' +
      '<button class="btn" data-variant="danger" data-act="reset">Reset this page</button></div>' +
      '<p class="lede">' + m.lab.intro + '</p>' +
      (m.cost.level === 'mid' || m.cost.level === 'high' ? Q('warn', '<strong>Cost warning.</strong> ' + m.cost.est) : Q('note', '<strong>Cost:</strong> ' + m.cost.est));
    var pre = m.prereq.length ? '<ul>' + m.prereq.map(function (id) { var p = byId(id); return '<li><a href="#/lab/' + id + '">' + id + ' ' + p.short + '</a>' + (labComplete(p) ? ' &#10003;' : '') + '</li>'; }).join('') + '</ul>' : '<p>None.</p>';
    html += S('prereq', 'Prerequisites', pre);
    html += S('steps', 'Steps', '<ol class="steps">' + m.lab.steps.map(function (st, i) {
      var k = 's' + i;
      return '<li data-done="' + !!s[k] + '"><label class="step__tick"><input type="checkbox" data-step="' + k + '"' + (s[k] ? ' checked' : '') + ' aria-label="Step ' + (i + 1) + ' done"></label><div class="step__body">' + st + '</div></li>';
    }).join('') + '</ol>');
    var td = '<p><strong>Mandatory.</strong> Tick each item as you do it; unticked items keep this lab out of the complete column.</p>';
    m.lab.teardown.forEach(function (b, bi) {
      td += '<h3 class="bucket" data-bucket="' + b.bucket + '">' + b.title + '</h3><ul>';
      b.items.forEach(function (it, i) {
        var k = 't' + bi + '-' + i;
        td += '<li class="task-list-item" data-done="' + !!s[k] + '"><input type="checkbox" data-step="' + k + '"' + (s[k] ? ' checked' : '') + ' aria-label=\"Teardown: ' + escH(String(it).replace(/<[^>]+>/g, '')) + '\"> ' + it + '</li>';
      });
      td += '</ul>';
    });
    html += S('teardown', 'Teardown', td);
    var lr = state.labrun[m.id];
    html += S('validation', 'Record your lab run', '<div class="labrun">' + (lr ? '<p><strong>Run recorded ' + new Date(lr.at).toLocaleDateString() + '.</strong>' + (lr.note ? ' ' + escH(lr.note) : '') + '</p><button class="btn" data-act="labunrun">Clear this record</button>' :
      '<p>This lab was written from Microsoft documentation and has not been run end to end by the guide’s author. When you have run it successfully in your tenant, record it here; the module’s <em>Lab run</em> field then shows your date. Note anything that differed from the steps.</p><label for="labrunNote">Notes (optional)</label><textarea id="labrunNote" rows="3" style="width:100%" placeholder="What differed from the steps (optional)"></textarea><p><button class="btn" data-variant="primary" data-act="labrun">I ran this lab successfully</button></p>') + '</div>');
    html += '<p><a href="#/m/' + m.id + '">&larr; Back to module ' + m.id + '</a></p>';
    $('#content').innerHTML = html;
  }

  /* ---------------- dashboard ---------------- */
  function chipsFor(m) {
    var q = quizPct(m);
    return '<div class="chips"><a class="chip" href="#/m/' + m.id + '" data-on="' + !!state.read[m.id] + '">Module</a>' +
      '<a class="chip" href="#/lab/' + m.id + '" data-on="' + labComplete(m) + '">Lab ' + labDone(m) + '/' + labTotal(m) + '</a>' +
      '<a class="chip" href="#/m/' + m.id + '" data-on="' + (q !== null && q >= PASS) + '">Quiz' + (q === null ? '' : ' ' + q + '%') + '</a></div>';
  }
  function renderDash() {
    var total = MODULES.length * 2, done = pagesDone(MODULES);
    var h = '<h1>' + EXAM.site + '</h1><p class="lede">' + MODULES.length + ' modules and labs for Exam ' + EXAM.code + ', built against the skills outline dated ' + EXAM.outline + '. ' + EXAM.dashLede + '</p>' +
      '<div class="progress-strip"><span>' + done + ' of ' + total + ' pages complete</span><div class="bar"><span class="bar__fill" style="width:' + pct(done / total) + '%"></span></div></div>' +
      Q('exam', '<strong>Practice assessment.</strong> <a href="#/pa">' + PA_N + ' randomized questions</a> in the format of Microsoft’s free practice assessment, with rationale and Microsoft Learn links for every question. <strong>Practice exam.</strong> ' + EXAMQ.length + ' scenario questions in every exam format, including a case study. ' + (state.exam.hist[0] ? 'Last score: <a href="#/exam/review">' + state.exam.hist[0].pct + '%</a>. ' : '') + (state.exam.cur ? '<a href="#/exam">Resume your attempt &rarr;</a>' : '<a href="#/exam">Take it &rarr;</a>')) + '<div class="dash">';
    var lrd = LEARN.filter(function (L) { return state.learned[L.id]; }).length;
    h += '<details class="dash__row" style="--domain-tint:var(--accent)"><summary class="dash__summary"><div class="dash__label"><span>Learn the concepts</span>' +
      '<span class="dash__weight">start here &middot; ' + lrd + '/' + LEARN.length + ' pages read</span></div>' +
      '<div class="dash__track"><div class="dash__weightbar" style="width:100%"><div class="dash__fill" style="width:' + pct(lrd / LEARN.length) + '%"></div></div></div></summary><div class="drill">' +
      LEARN.map(function (L) { return '<div class="drill__row"><a class="drill__id" href="#/learn/' + L.id + '">' + L.id + '</a><a class="drill__title" href="#/learn/' + L.id + '">' + L.title + '</a><div class="chips"><a class="chip" href="#/learn/' + L.id + '" data-on="' + !!state.learned[L.id] + '">Read</a><a class="chip" href="#/glossary">' + termCount(L) + ' terms</a></div></div>'; }).join('') + '</div></details>';
    ORDER.forEach(function (d) {
      var D = dom(d), list = mods(d), pd = pagesDone(list), pt = list.length * 2;
      var wb = d === '00' ? 30 : Math.round(100 * D.mid / MAXMID);
      h += '<details class="dash__row" style="--domain-tint:' + D.tint + '"' + (d === '00' ? '' : ' open') + '><summary class="dash__summary"><div class="dash__label"><span>' + D.name + '</span>' +
        '<span class="dash__weight">' + (d === '00' ? 'not scored' : D.weight + ' of the exam') + ' &middot; ' + pd + '/' + pt + ' pages</span></div>' +
        '<div class="dash__track"><div class="dash__weightbar" style="width:' + wb + '%"><div class="dash__fill" style="width:' + pct(pd / pt) + '%"></div></div></div></summary><div class="drill">';
      list.forEach(function (m) {
        h += '<div class="drill__row"><a class="drill__id" href="#/m/' + m.id + '">' + m.id + '</a><a class="drill__title" href="#/m/' + m.id + '">' + m.title + '</a>' + chipsFor(m) + '</div>';
      });
      h += '</div></details>';
    });
    h += '</div>';
    var allObj = 0, touched = 0;
    MODULES.forEach(function (m) { m.objectives.forEach(function (_, i) { allObj++; if (objLevel(m, i) !== 'none') touched++; }); });
    h += '<section class="cov"><div class="cov__head"><h2>Objective coverage</h2><p class="cov__total">' + touched + ' of ' + allObj + ' sub-objectives touched. Open a domain to see each objective, verbatim, and which module teaches it.</p></div>' +
      '<div class="cov__legend">' + ['none', 'read', 'practised', 'tested'].map(function (l) { return '<span class="cov__legenditem"><span class="cov__cell" data-level="' + l + '"></span><span>' + LEVEL_TEXT[l] + '</span></span>'; }).join('') + '</div><div class="cov__grid">';
    SCORED.forEach(function (d) {
      var D = dom(d), list = mods(d), n = 0, t = 0;
      list.forEach(function (m) { m.objectives.forEach(function (_, i) { n++; if (objLevel(m, i) !== 'none') t++; }); });
      h += '<details class="cov__domain" style="--domain-tint:' + D.tint + '"><summary class="cov__dsummary"><span class="cov__dname">' + D.name + '</span><span class="cov__dmeta">' + D.weight + ' &middot; ' + t + ' of ' + n + ' objectives</span></summary><div class="cov__dbody">';
      list.forEach(function (m) {
        h += '<details class="cov__module"><summary class="cov__summary"><span class="cov__id">' + m.id + '</span><span class="cov__obj">' + m.group + '</span><span class="cov__cells">' +
          m.objectives.map(function (_, i) { return '<a class="cov__cell" href="#/m/' + m.id + '" data-level="' + objLevel(m, i) + '"></a>'; }).join('') +
          '</span><span class="cov__count">' + m.objectives.length + '</span></summary><div class="cov__body">' + chipsFor(m) + '<ul class="cov__list">' +
          m.objectives.map(function (o, i) { return '<li data-level="' + objLevel(m, i) + '"><span class="cov__dot"></span>' + o + '</li>'; }).join('') + '</ul></div></details>';
      });
      h += '</div></details>';
    });
    h += '</div></section>';
    $('#content').innerHTML = h;
  }

  /* ---------------- cost planner ---------------- */
  function renderCost() {
    var groups = [
      { level: 'high', label: 'High', note: 'Several standing meters at once. Deallocate between sessions and delete at the end of the lab.' },
      { level: 'mid', label: 'Medium', note: 'A virtual machine or another hourly meter. Deallocate it when you stop, delete it when the teardown says so.' },
      { level: 'low', label: 'Low', note: 'Consumption only: log ingestion, a few storage transactions. Nothing meaningful bills while idle.' },
      { level: 'none', label: 'No Azure cost', note: 'Configuration inside Entra and Microsoft 365. Covered by the trial licences from 00-01.' }
    ];
    var h = '<h1>Cost planner</h1><p class="lede">Every lab, ordered by what it will cost you to run. Pay-as-you-go has no spending cap, so this is a planning tool rather than a guarantee.</p>' + EXAM.costIntro + '<div class="plan">';
    groups.forEach(function (g) {
      var list = MODULES.filter(function (m) { return m.cost.level === g.level; });
      if (!list.length) return;
      h += '<section class="plan__group"><div class="plan__head">' + costChip(g.level, g.label) + '<span class="plan__note">' + g.note + '</span><span class="plan__count">' + list.length + ' lab' + (list.length > 1 ? 's' : '') + '</span></div>';
      list.forEach(function (m) {
        h += '<a class="plan__row" href="#/lab/' + m.id + '"><span class="drill__id">' + m.id + '</span><span class="plan__body"><span class="plan__title">' + m.title + '</span><span class="plan__est">' + m.cost.est + '</span></span>' + (m.cost.level === 'mid' || m.cost.level === 'high' ? '<span class="plan__meter">' + m.cost.meter + '</span>' : '') + '</a>';
      });
      h += '</section>';
    });
    h += '<section class="plan__group"><div class="plan__head">' + costChip('max', 'Traps') + '<span class="plan__note">Not required by any lab. Each one can grow, or lock you out, while you are not watching.</span><span class="plan__count">' + COST_TRAPS.length + '</span></div>' +
      COST_TRAPS.map(function (t) { return '<div class="plan__row"><span class="drill__id">' + t.mod + '</span><span class="plan__body"><span class="plan__title">' + t.t + '</span><span class="plan__est">' + t.s + '</span></span><span class="plan__meter">' + t.meter + '</span></div>'; }).join('') + '</section>';
    var z = MODULES.filter(function (m) { return m.cost.level === 'none'; }).length, hr = MODULES.filter(function (m) { return m.cost.level === 'mid' || m.cost.level === 'high'; }).length;
    h += '</div><p class="field__note">' + MODULES.length + ' labs: ' + z + ' cost nothing in Azure, ' + hr + ' carry an hourly meter. The traps are the only line items that can grow without you.</p>';
    $('#content').innerHTML = h;
  }

  /* ---------------- readiness ---------------- */
  function renderReady() {
    var h = '<h1>Readiness</h1><p class="lede">What to study next, ranked by exam weight and by what your knowledge-check answers actually got wrong.</p>';
    var totalW = 0, rows = '';
    SCORED.forEach(function (d) {
      var D = dom(d), n = 0, t = 0;
      mods(d).forEach(function (m) { m.objectives.forEach(function (_, i) { n++; if (objLevel(m, i) === 'tested') t++; }); });
      totalW += D.mid * t / n;
      rows += '<div class="gauge__row" style="--domain-tint:' + D.tint + '"><span>' + D.name + '</span><div class="gauge__track"><div class="gauge__fill" style="width:' + pct(t / n) + '%"></div></div><span>' + t + '/' + n + '</span></div>';
    });
    h += '<div class="gauge"><div><span class="gauge__big">' + Math.round(totalW) + '%</span><span class="gauge__cap">of exam weight verified by a correct answer on the latest knowledge check</span></div>' + rows +
      '<p class="field__note">Only quiz results count here. Reading a module or ticking a lab does not move this number.</p></div><div class="ready">';

    var missed = [];
    MODULES.forEach(function (m) {
      var l = quizLast(m);
      m.objectives.forEach(function (o, i) {
        var n = state.misses[m.id + ':' + i] || 0;
        var wrongNow = l && m.quiz.some(function (q, qi) { return q.obj === i && !l.correct[qi]; });
        if (wrongNow) missed.push({ m: m, o: o, n: n, w: dom(m.domain).mid });
      });
    });
    missed.sort(function (a, b) { return b.w - a.w || b.n - a.n; });
    h += '<section class="ready__block"><h2>Missed in a knowledge check</h2>' + (missed.length ? missed.map(function (x) {
      return '<a class="ready__row" href="#/m/' + x.m.id + '" data-weight="high"><span class="drill__id">' + x.m.id + '</span><span class="plan__body"><span class="plan__title">' + x.o + '</span><span class="plan__est">' + dom(x.m.domain).name + '</span></span><span class="chip">missed &times;' + x.n + '</span></a>';
    }).join('') : '<div class="empty"><strong>Nothing missed on a latest attempt.</strong> Either you have not taken a check yet, or every objective you were tested on is currently right.</div>') + '</section>';

    var lx = state.exam.hist[0], exm = [];
    if (lx) Object.keys(lx.wrongObjs).forEach(function (k) { var p = k.split(':'), mm = byId(p[0]); if (mm && +p[1] >= 0) exm.push({ m: mm, obj: +p[1], n: lx.wrongObjs[k] }); });
    exm.sort(function (a, b) { return dom(b.m.domain).mid - dom(a.m.domain).mid || b.n - a.n; });
    h += '<section class="ready__block"><h2>Missed on your last practice exam</h2>' + (!lx ? '<div class="empty"><strong>No practice exam taken yet.</strong> <a href="#/exam">Start one</a> once you have read the heavier domain.</div>' :
      exm.length ? exm.map(function (x) {
        return '<a class="ready__row" href="#/m/' + x.m.id + '" data-weight="high"><span class="drill__id">' + x.m.id + '</span><span class="plan__body"><span class="plan__title">' + x.m.objectives[x.obj] + '</span><span class="plan__est">' + dom(x.m.domain).name + ' &middot; last exam ' + lx.pct + '%</span></span><span class="chip">&times;' + x.n + '</span></a>';
      }).join('') : '<div class="empty"><strong>Nothing missed on the last attempt (' + lx.pct + '%).</strong></div>') + '</section>';

    var unread = MODULES.filter(function (m) { return !state.read[m.id] && m.domain !== '00'; }).sort(function (a, b) { return dom(b.domain).mid - dom(a.domain).mid; });
    h += '<section class="ready__block"><h2>Not yet read, heaviest domain first</h2>' + (unread.length ? unread.map(function (m) {
      return '<a class="ready__row" href="#/m/' + m.id + '"><span class="drill__id">' + m.id + '</span><span class="plan__body"><span class="plan__title">' + m.title + '</span><span class="plan__est">' + dom(m.domain).name + ' &middot; ' + dom(m.domain).weight + '</span></span></a>';
    }).join('') : '<div class="empty"><strong>Every module is marked read.</strong></div>') + '</section>';

    var untested = MODULES.filter(function (m) { return state.read[m.id] && (quizPct(m) === null || quizPct(m) < PASS); });
    h += '<section class="ready__block"><h2>Read, but the knowledge check is not passed</h2>' + (untested.length ? untested.map(function (m) {
      var q = quizPct(m);
      return '<a class="ready__row" href="#/m/' + m.id + '"><span class="drill__id">' + m.id + '</span><span class="plan__body"><span class="plan__title">' + m.title + '</span><span class="plan__est">' + (q === null ? 'Not taken' : 'Last score ' + q + '%') + '</span></span><span class="chip" data-on="false">' + (q === null ? 'quiz' : q + '%') + '</span></a>';
    }).join('') : '<div class="empty"><strong>Nothing here.</strong> Every module you have read has a passing check.</div>') + '</section>';

    var labs = MODULES.filter(function (m) { return state.read[m.id] && !labComplete(m); });
    h += '<section class="ready__block"><h2>Read, but the lab is unfinished</h2>' + (labs.length ? labs.map(function (m) {
      return '<a class="ready__row" href="#/lab/' + m.id + '"><span class="drill__id">' + m.id + '</span><span class="plan__body"><span class="plan__title">' + m.title + '</span><span class="plan__est">' + m.cost.est + '</span></span><span class="chip" data-on="false">' + labDone(m) + '/' + labTotal(m) + ' steps</span></a>';
    }).join('') : '<div class="empty"><strong>Nothing here.</strong> No read module has an unfinished lab.</div>') + '</section></div>';
    $('#content').innerHTML = h;
  }

  /* ---------------- learn track ---------------- */
  function lById(id) { for (var i = 0; i < LEARN.length; i++) if (LEARN[i].id === id) return LEARN[i]; return null; }
  function tId(term) { return 't-' + term.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  function learnFor(modId) { return LEARN.filter(function (L) { return L.mods.indexOf(modId) !== -1; }); }
  function termCount(L) { return L.units.reduce(function (n, u) { return n + u.terms.length; }, 0); }
  var GLOSS = (function () {
    var seen = {}, out = [];
    LEARN.forEach(function (L) {
      L.units.forEach(function (u, ui) {
        u.terms.forEach(function (t) {
          var k = t[0].toLowerCase();
          if (seen[k]) return;
          seen[k] = true;
          out.push({ term: t[0], def: t[1], L: L, ui: ui });
        });
      });
    });
    return out.sort(function (a, b) { return a.term.toLowerCase().localeCompare(b.term.toLowerCase()); });
  })();

  function termsHTML(terms) {
    return '<div class="terms"><div class="terms__lbl">Key terms</div><dl>' + terms.map(function (t) {
      return '<div class="term" id="' + tId(t[0]) + '"><dt>' + t[0] + '</dt><dd>' + t[1] + '</dd></div>';
    }).join('') + '</dl></div>';
  }

  function renderLearnIndex() {
    var read = LEARN.filter(function (L) { return state.learned[L.id]; }).length;
    var h = '<h1>Learn the concepts</h1><p class="lede">' + EXAM.learnLede + '</p>' +
      '<div class="progress-strip"><span>' + read + ' of ' + LEARN.length + ' pages read &middot; ' + GLOSS.length + ' terms in the <a href="#/glossary">glossary</a></span><div class="bar"><span class="bar__fill" style="width:' + pct(read / LEARN.length) + '%"></span></div></div>' +
      vFlow([
        { t: 'Learn page', s: 'concepts and terms', k: 'acc' },
        { t: 'Module', s: 'exam detail, traps', k: 'd2' },
        { t: 'Lab', s: 'do it in your lab tenant', k: 'd2' },
        { t: 'Knowledge check', s: 'per module', k: 'd1' },
        { t: 'Practice exam', s: 'scenarios, all formats', k: 'ok' }
      ], 'The study order this academy is built around. Readiness counts only the last two.') +
      '<div class="lcards">' + LEARN.map(function (L) {
        return '<a class="lcard" href="#/learn/' + L.id + '" data-read="' + !!state.learned[L.id] + '"><span class="lcard__id">' + L.id + '</span><strong>' + L.title + '</strong><span class="lcard__s">' + L.summary + '</span>' +
          '<span class="lcard__m">' + L.units.length + ' units &middot; ~' + L.mins + ' min &middot; ' + termCount(L) + ' terms &middot; feeds ' + L.mods.join(', ') + (state.learned[L.id] ? ' &middot; <b>read</b>' : '') + '</span></a>';
      }).join('') + '</div>';
    $('#content').innerHTML = h;
  }

  function renderLearn(L) {
    var idx = LEARN.indexOf(L), prev = LEARN[idx - 1], next = LEARN[idx + 1], n = L.units.length;
    var h = '<h1>' + L.title + '</h1>' +
      '<div class="progress-strip"><span>' + n + ' units &middot; ~' + L.mins + ' min &middot; ' + termCount(L) + ' key terms</span>' +
      '<div class="bar"><span class="bar__fill" style="width:' + (state.learned[L.id] ? 100 : 0) + '%"></span></div>' +
      '<button class="btn" data-act="lread" aria-pressed="' + !!state.learned[L.id] + '">' + (state.learned[L.id] ? 'Read &#10003;' : 'Mark as read') + '</button>' +
      '<button class="btn" data-act="lflip" aria-pressed="false">Quiz me on the terms</button></div>' +
      '<p class="lede">' + L.summary + '</p>' +
      Q('note', '<strong>Microsoft Learn:</strong> ' + L.ms.map(function (x) { return '<a href="' + x.u + '" target="_blank" rel="noopener">' + x.t + '</a>'; }).join(' &middot; ') +
        '<br><strong>Feeds exam modules:</strong> ' + L.mods.map(function (id) { return '<a href="#/m/' + id + '">' + id + ' ' + byId(id).short + '</a>'; }).join(' &middot; '));
    L.units.forEach(function (u, i) {
      h += '<section class="shape learn-unit" data-shape="unit" id="u-' + L.id + '-' + i + '"><h2 data-shape="unit" data-label="Unit ' + (i + 1) + ' of ' + n + '">' + u.t + '</h2>' + u.body + (u.vis || '') + termsHTML(u.terms) + '</section>';
    });
    h += '<div class="lnav">' + (prev ? '<a class="btn" href="#/learn/' + prev.id + '">&larr; ' + prev.title + '</a>' : '<span></span>') +
      '<span class="lnav__mods">' + L.mods.map(function (id) { return '<a class="btn" href="#/m/' + id + '">Module ' + id + ' &rarr;</a>'; }).join('') + '</span>' +
      (next ? '<a class="btn" href="#/learn/' + next.id + '">' + next.title + ' &rarr;</a>' : '<a class="btn" href="#/glossary">Glossary &rarr;</a>') + '</div>';
    $('#content').innerHTML = h;
    initWidgets($('#content'));
  }

  function renderGlossary() {
    var h = '<h1>Glossary</h1><p class="lede">' + GLOSS.length + ' terms defined across the Learn pages, alphabetically. Each links back to the unit that explains it with a diagram.</p>' +
      '<div class="gl__bar"><input class="gl__q" id="glq" type="search" placeholder="Filter terms and definitions" autocomplete="off">' +
      '<label class="xs__timed"><input type="checkbox" id="glflash"> Flashcards: hide definitions until clicked</label></div><div class="gl" id="gl">';
    var letter = '';
    GLOSS.forEach(function (g) {
      var L0 = g.term.charAt(0).toUpperCase();
      if (/[A-Z]/.test(L0) && L0 !== letter) { letter = L0; h += '<h2 class="gl__letter" data-letter="' + letter + '">' + letter + '</h2>'; }
      h += '<details class="gl__t" open data-text="' + escH((g.term + ' ' + g.def).toLowerCase()) + '"><summary><strong>' + g.term + '</strong><span class="gl__src">' + g.L.id + ' &middot; ' + g.L.short + '</span></summary>' +
        '<p>' + g.def + ' <a href="#/learn/' + g.L.id + '" data-term="' + tId(g.term) + '">See it explained &rarr;</a></p></details>';
    });
    $('#content').innerHTML = h + '</div>';
  }
  function filterGlossary() {
    var q = ($('#glq').value || '').toLowerCase().trim();
    $$('#gl .gl__t').forEach(function (d) { d.hidden = !!q && d.dataset.text.indexOf(q) === -1; });
    $$('#gl .gl__letter').forEach(function (hd) {
      var el = hd.nextElementSibling, any = false;
      while (el && !el.classList.contains('gl__letter')) { if (!el.hidden) any = true; el = el.nextElementSibling; }
      hd.hidden = !any;
    });
  }

  /* ---------------- practice exam ---------------- */
  var XQ = {}; EXAMQ.forEach(function (q) { XQ[q.id] = q; });
  var MODE = { full: 'Full exam', missed: 'Missed questions' };
  SCORED.forEach(function (d) { MODE['d' + (+d)] = 'Domain ' + (+d) + ' only'; });
  var TYPE_NAME = { single: 'Multiple choice', multi: 'Multiple response', yesno: 'Yes / No set', code: 'Code completion', order: 'Build a list (ordering)' };
  var examTimer = null;
  function qDom(q) { return byId(q.mod).domain; }
  function hashStr(s) { var h = 7; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
  function scramble(n, seed) {
    var p = [], h = hashStr(seed), i;
    for (i = 0; i < n; i++) p.push(i);
    for (i = n - 1; i > 0; i--) { h = (h * 1103515245 + 12345) >>> 0; var k = h % (i + 1), t = p[i]; p[i] = p[k]; p[k] = t; }
    if (p.every(function (v, j) { return v === j; })) p.reverse();
    return p;
  }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function ids(list) { return list.map(function (q) { return q.id; }); }
  function initAns(q) {
    if (q.type === 'multi') return [];
    if (q.type === 'yesno') return q.s.map(function () { return null; });
    if (q.type === 'code') return q.blanks.map(function () { return null; });
    if (q.type === 'order') return scramble(q.items.length, q.id);
    return null;
  }
  function isAnswered(q, a) {
    if (q.type === 'single') return a !== null && a !== undefined;
    if (q.type === 'multi') return !!a && a.length > 0;
    if (q.type === 'order') return true;
    return !!a && a.every(function (x) { return x !== null; });
  }
  function scoreQ(q, a) {
    if (q.type === 'single') return a === q.a ? 1 : 0;
    if (q.type === 'multi') return (a || []).slice().sort().join(',') === q.a.slice().sort().join(',') ? 1 : 0;
    if (q.type === 'yesno') return q.a.filter(function (v, i) { return a && a[i] === v; }).length / q.a.length;
    if (q.type === 'code') return q.blanks.filter(function (b, i) { return a && a[i] === b.a; }).length / q.blanks.length;
    if (q.type === 'order') return a && a.every(function (v, i) { return v === i; }) ? 1 : 0;
    return 0;
  }
  function wrongParts(q, a) {
    if (q.type === 'yesno' || q.type === 'code') {
      var out = [], n = q.type === 'yesno' ? q.a.length : q.blanks.length;
      for (var i = 0; i < n; i++) {
        var ok = q.type === 'yesno' ? (a && a[i] === q.a[i]) : (a && a[i] === q.blanks[i].a);
        if (!ok) out.push(q.pm ? q.pm[i] : [q.mod, q.obj]);
      }
      return out;
    }
    return scoreQ(q, a) === 1 ? [] : [[q.mod, q.obj]];
  }
  function instr(q) {
    return q.type === 'single' ? 'Choose one.' :
      q.type === 'multi' ? 'Choose ' + ['', 'one', 'two', 'three'][q.pick] + '. Each correct selection presents part of the solution.' :
      q.type === 'yesno' ? 'For each statement, select Yes if the statement is true. Otherwise, select No.' :
      q.type === 'code' ? 'Select the correct option for each blank in the code.' :
      'Move the items into the correct order.';
  }
  function fmtDate(t) { var d = new Date(t); return d.toISOString().slice(0, 10) + ' ' + d.toTimeString().slice(0, 5); }
  function fmtDur(s) { return Math.floor(s / 60) + ' min ' + (s % 60) + ' s'; }

  function startExam(mode) {
    var base = EXAMQ.filter(function (q) { return !q.case; }), cases = EXAMQ.filter(function (q) { return q.case; }), list;
    if (/^d\d$/.test(mode)) list = ids(shuffle(base.filter(function (q) { return qDom(q) === '0' + mode.slice(1); })));
    else if (mode === 'missed') {
      var last = state.exam.hist[0], wrong = last ? last.ids.filter(function (id) { return last.scores[id] < 1 && XQ[id]; }) : [];
      list = shuffle(wrong.filter(function (id) { return !XQ[id].case; })).concat(wrong.filter(function (id) { return XQ[id].case; }));
    } else list = ids(shuffle(base)).concat(ids(cases));
    if (!list.length) return;
    var answers = {};
    list.forEach(function (id) { answers[id] = initAns(XQ[id]); });
    var tm = $('#xtimed');
    state.exam.cur = { mode: mode, ids: list, answers: answers, flags: {}, idx: 0, started: Date.now(), timed: !!(tm && tm.checked) };
    save();
    go('#/exam');
  }
  function submitExam() {
    var c = state.exam.cur, scores = {}, byD = {}, wrongObjs = {}, total = 0;
    ORDER.forEach(function (d) { byD[d] = [0, 0]; });
    c.ids.forEach(function (id) {
      var q = XQ[id], a = c.answers[id], s = scoreQ(q, a), d = qDom(q);
      scores[id] = s; total += s; byD[d][0] += s; byD[d][1] += 1;
      wrongParts(q, a).forEach(function (p) {
        var k = p[0] + ':' + p[1];
        wrongObjs[k] = (wrongObjs[k] || 0) + 1;
        if (p[1] >= 0) state.misses[k] = (state.misses[k] || 0) + 1;
      });
    });
    state.exam.hist.unshift({ at: Date.now(), mode: c.mode, ids: c.ids, answers: c.answers, scores: scores,
      pct: Math.round(100 * total / c.ids.length), byD: byD, wrongObjs: wrongObjs, secs: Math.round((Date.now() - c.started) / 1000) });
    state.exam.hist = state.exam.hist.slice(0, 8);
    state.exam.cur = null;
    save();
    go('#/exam/review');
  }

  function answerUI(q, a, lock) {
    var dis = lock ? ' disabled' : '';
    if (q.type === 'single' || q.type === 'multi') {
      var multi = q.type === 'multi';
      return '<div class="xq__opts">' + q.o.map(function (o, i) {
        var on = multi ? (a || []).indexOf(i) !== -1 : a === i, mark = '';
        if (lock) { var right = multi ? q.a.indexOf(i) !== -1 : q.a === i; mark = right ? ' data-mark="right"' : (on ? ' data-mark="wrong"' : ''); }
        return '<label class="quiz__opt"' + mark + '><input type="' + (multi ? 'checkbox' : 'radio') + '" name="xopt" data-x="' + q.type + '" value="' + i + '"' + (on ? ' checked' : '') + dis + '><span>' + o + '</span></label>';
      }).join('') + '</div>';
    }
    if (q.type === 'yesno') {
      return '<div class="table-scroll"><table class="xq__yn"><thead><tr><th>Statement</th><th>Yes</th><th>No</th>' + (lock ? '<th>Key</th>' : '') + '</tr></thead><tbody>' +
        q.s.map(function (st, i) {
          var v = a ? a[i] : null;
          function cell(val) { return '<td class="xq__ync"><input type="radio" name="yn' + i + '" data-x="yesno" data-i="' + i + '" value="' + (val ? 1 : 0) + '"' + (v === val ? ' checked' : '') + dis + ' aria-label="' + (val ? 'Yes' : 'No') + '"></td>'; }
          return '<tr' + (lock ? ' data-ok="' + (v === q.a[i]) + '"' : '') + '><td>' + st + '</td>' + cell(true) + cell(false) + (lock ? '<td class="xq__key">' + (q.a[i] ? 'Yes' : 'No') + '</td>' : '') + '</tr>';
        }).join('') + '</tbody></table></div>';
    }
    if (q.type === 'code') {
      var out = '';
      q.code.split(/\[\[(\d+)\]\]/).forEach(function (p, i) {
        if (i % 2 === 0) { out += escH(p); return; }
        var k = +p, b = q.blanks[k], v = a ? a[k] : null;
        if (lock) {
          var ok = v === b.a;
          out += '<span class="xq__blank" data-ok="' + ok + '">' + escH(v === null || v === undefined ? '(blank)' : b.o[v]) + '</span>' + (ok ? '' : '<span class="xq__fix"> &rarr; ' + escH(b.o[b.a]) + '</span>');
        } else {
          out += '<select class="xq__sel" data-x="code" data-i="' + k + '" aria-label="Blank ' + (k + 1) + '"><option value="">&mdash; select &mdash;</option>' +
            b.o.map(function (o, oi) { return '<option value="' + oi + '"' + (v === oi ? ' selected' : '') + '>' + escH(o) + '</option>'; }).join('') + '</select>';
        }
      });
      return '<pre class="xq__code"><code>' + out + '</code></pre>';
    }
    if (q.type === 'order') {
      var perm = a || q.items.map(function (_, i) { return i; });
      if (lock) {
        return '<div class="xq__ord2"><div><h4>Your order</h4><ol>' + perm.map(function (ix, pos) { return '<li data-ok="' + (ix === pos) + '">' + q.items[ix] + '</li>'; }).join('') +
          '</ol></div><div><h4>Correct order</h4><ol>' + q.items.map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ol></div></div>';
      }
      return '<ol class="xq__order">' + perm.map(function (ix, pos) {
        return '<li><span>' + q.items[ix] + '</span><span class="xq__mv">' +
          '<button class="btn" type="button" data-act="xmove" data-i="' + pos + '" data-d="-1" aria-label="Move up"' + (pos === 0 ? ' disabled' : '') + '>&uarr;</button>' +
          '<button class="btn" type="button" data-act="xmove" data-i="' + pos + '" data-d="1" aria-label="Move down"' + (pos === perm.length - 1 ? ' disabled' : '') + '>&darr;</button></span></li>';
      }).join('') + '</ol>';
    }
    return '';
  }

  function examCounts(c) {
    return {
      ans: c.ids.filter(function (x) { return isAnswered(XQ[x], c.answers[x]); }).length,
      flag: c.ids.filter(function (x) { return c.flags[x]; }).length
    };
  }
  function refreshExamStrip() {
    var c = state.exam.cur, el = $('#xstat');
    if (!c || !el) return;
    var k = examCounts(c);
    el.textContent = 'Question ' + (c.idx + 1) + ' of ' + c.ids.length + ' \u00b7 ' + k.ans + ' answered' + (k.flag ? ' \u00b7 ' + k.flag + ' flagged' : '');
    var bar = $('#xbar'); if (bar) bar.style.width = pct(k.ans / c.ids.length) + '%';
    var cell = $('.xq__cell[data-i="' + c.idx + '"]'); if (cell) cell.dataset.done = String(isAnswered(XQ[c.ids[c.idx]], c.answers[c.ids[c.idx]]));
  }
  function startTimer() {
    clearInterval(examTimer);
    var c = state.exam.cur;
    if (!c || !c.timed || !$('#xtimer')) return;
    function tick() {
      var el = $('#xtimer');
      if (!el || !state.exam.cur) { clearInterval(examTimer); return; }
      var rem = c.ids.length * 60 - Math.round((Date.now() - c.started) / 1000), neg = rem < 0, r = Math.abs(rem);
      el.textContent = (neg ? '-' : '') + Math.floor(r / 60) + ':' + ('0' + (r % 60)).slice(-2) + (neg ? ' over' : ' left');
      el.dataset.over = String(neg);
    }
    tick();
    examTimer = setInterval(tick, 1000);
  }

  function renderExamStart() {
    var base = EXAMQ.filter(function (q) { return !q.case; });
    var nd = {}; SCORED.forEach(function (d) { nd[d] = base.filter(function (q) { return qDom(q) === d; }).length; });
    var last = state.exam.hist[0], missed = last ? last.ids.filter(function (id) { return last.scores[id] < 1; }).length : 0;
    var counts = {};
    EXAMQ.forEach(function (q) { counts[q.type] = (counts[q.type] || 0) + 1; });
    var h = '<h1>Practice exam</h1><p class="lede">' + EXAMQ.length + ' scenario questions across all ' + SCORED.length + ' domains, including a ' + (EXAMQ.length - base.length) + '-question case study. Questions give no hint of which module they come from until you submit.</p>' +
      Q('note', '<strong>Formats.</strong> Microsoft exams use item types like these; the exact mix on ' + EXAM.code + ' is not published. Here, Yes/No sets and code completions earn credit per part; every other item is all-or-nothing.') +
      T('compare', ['Format', 'What you do', 'Here'], [
        ['Multiple choice', 'Pick the one best answer to a scenario', counts.single || 0],
        ['Multiple response', 'Pick exactly the stated number of answers', counts.multi || 0],
        ['Yes / No set', 'Judge three statements about one scenario independently', counts.yesno || 0],
        ['Code completion', 'Choose the right token for each blank in a code sample', counts.code || 0],
        ['Build a list', 'Put steps in the right order', counts.order || 0],
        ['Case study', 'Several questions against one longer business scenario', EXAMQ.length - base.length]
      ]) +
      '<div class="xs"><label class="xs__timed"><input type="checkbox" id="xtimed"> Pace myself at one minute per question. This is a drill, not the official time limit.</label>' +
      '<div class="xs__btns"><button class="btn" type="button" data-act="xstart" data-mode="full">Full exam (' + EXAMQ.length + ')</button>' +
      SCORED.map(function (d) { return '<button class="btn" type="button" data-act="xstart" data-mode="d' + (+d) + '">Domain ' + (+d) + ' only (' + nd[d] + ')</button>'; }).join('') +
      (missed ? '<button class="btn" type="button" data-act="xstart" data-mode="missed">Retry the ' + missed + ' missed</button>' : '') + '</div></div>';
    if (state.exam.hist.length) {
      h += '<h2>Your attempts</h2>' + T('compare', ['When', 'Mode', 'Questions', 'Score'], state.exam.hist.map(function (x, i) {
        return [fmtDate(x.at), MODE[x.mode] || x.mode, x.ids.length, (i === 0 ? '<a href="#/exam/review">' + x.pct + '%</a>' : x.pct + '%')];
      }));
    }
    $('#content').innerHTML = h;
  }

  function renderExamSession() {
    var c = state.exam.cur, n = c.ids.length;
    if (c.idx >= n) c.idx = n - 1;
    var id = c.ids[c.idx], q = XQ[id], a = c.answers[id], k = examCounts(c);
    var h = '<h1>Practice exam</h1><div class="progress-strip"><span id="xstat">Question ' + (c.idx + 1) + ' of ' + n + ' &middot; ' + k.ans + ' answered' + (k.flag ? ' &middot; ' + k.flag + ' flagged' : '') + '</span>' +
      '<div class="bar"><span class="bar__fill" id="xbar" style="width:' + pct(k.ans / n) + '%"></span></div>' + (c.timed ? '<span class="xtimer" id="xtimer"></span>' : '') +
      '<button class="btn" type="button" data-act="xsubmit">Submit exam</button><button class="btn" type="button" data-variant="danger" data-act="xabandon">Abandon</button></div>';
    if (q.case) h += '<details class="xcase" open><summary>' + CASES[q.case].title + '</summary><div class="xcase__body">' + CASES[q.case].html + '</div></details>';
    h += '<article class="xq" data-type="' + q.type + '"><p class="xq__meta">' + TYPE_NAME[q.type] + (q.case ? ' &middot; Case study' : '') + '</p>' +
      '<div class="xq__stem"><p>' + q.stem + '</p></div><p class="xq__instr">' + instr(q) + '</p>' + answerUI(q, a, false) + '</article>';
    h += '<div class="xq__nav"><button class="btn" type="button" data-act="xprev"' + (c.idx === 0 ? ' disabled' : '') + '>&larr; Previous</button>' +
      '<button class="btn" type="button" data-act="xflag" aria-pressed="' + !!c.flags[id] + '">' + (c.flags[id] ? 'Flagged for review' : 'Flag for review') + '</button>' +
      '<button class="btn" type="button" data-act="xnext"' + (c.idx === n - 1 ? ' disabled' : '') + '>Next &rarr;</button></div>';
    h += '<div class="xq__grid" aria-label="Question navigator">' + c.ids.map(function (x, i) {
      return '<button class="xq__cell" type="button" data-act="xjump" data-i="' + i + '" data-done="' + isAnswered(XQ[x], c.answers[x]) + '"' +
        (c.flags[x] ? ' data-flag="true"' : '') + (i === c.idx ? ' aria-current="true"' : '') + (XQ[x].case ? ' data-case="true"' : '') + '>' + (i + 1) + '</button>';
    }).join('') + '</div><p class="field__note">Filled: answered. Orange ring: flagged. Dashed: case study.</p>';
    $('#content').innerHTML = h;
  }

  function renderExamReview() {
    var last = state.exam.hist[0];
    if (!last) { renderExamStart(); return; }
    var missed = last.ids.filter(function (id) { return last.scores[id] < 1; }).length;
    var h = '<h1>Practice exam results</h1><div class="gauge"><div><span class="gauge__big">' + last.pct + '%</span><span class="gauge__cap">' +
      last.ids.length + ' questions &middot; ' + (MODE[last.mode] || last.mode) + ' &middot; ' + fmtDate(last.at) + ' &middot; ' + fmtDur(last.secs) + '</span></div>';
    SCORED.forEach(function (d) {
      var b = last.byD[d]; if (!b || !b[1]) return;
      var D = dom(d);
      h += '<div class="gauge__row" style="--domain-tint:' + D.tint + '"><span>' + D.name + '</span><div class="gauge__track"><div class="gauge__fill" style="width:' + pct(b[0] / b[1]) + '%"></div></div><span>' + Math.round(100 * b[0] / b[1]) + '%</span></div>';
    });
    h += '<p class="field__note">Microsoft reports a scaled score where 700 passes, and it is not the same as 70% correct. Treat 80% here as the bar before booking.</p></div>';
    var wk = Object.keys(last.wrongObjs).map(function (k) { var p = k.split(':'); return { m: byId(p[0]), obj: +p[1], n: last.wrongObjs[k] }; })
      .filter(function (x) { return x.m; })
      .sort(function (a, b) { return dom(b.m.domain).mid - dom(a.m.domain).mid || b.n - a.n; });
    h += '<div class="ready"><section class="ready__block"><h2>Objectives to revisit</h2>' + (wk.length ? wk.map(function (x) {
      return '<a class="ready__row" href="#/m/' + x.m.id + '" data-weight="high"><span class="drill__id">' + x.m.id + '</span><span class="plan__body"><span class="plan__title">' +
        (x.obj >= 0 ? x.m.objectives[x.obj] : x.m.title) + '</span><span class="plan__est">' + dom(x.m.domain).name + '</span></span><span class="chip">missed &times;' + x.n + '</span></a>';
    }).join('') : '<div class="empty"><strong>Nothing to revisit.</strong> Every part of every question was right.</div>') + '</section></div>';
    h += '<div class="xs__btns">' + (missed ? '<button class="btn" type="button" data-act="xstart" data-mode="missed">Retry the ' + missed + ' missed</button>' : '') +
      '<button class="btn" type="button" data-act="xstart" data-mode="full">New full exam</button><button class="btn" type="button" data-go="exam">Exam home</button></div>' +
      '<label class="xs__timed"><input type="checkbox" id="xonlywrong"> Show only questions that were not fully correct</label>';
    var caseShown = {};
    h += '<div class="xr" id="xr">' + last.ids.map(function (id, i) {
      var q = XQ[id]; if (!q) return '';
      var s = last.scores[id], st = s === 1 ? 'right' : s === 0 ? 'wrong' : 'partial', m = byId(q.mod), pre = '';
      if (q.case && !caseShown[q.case]) { caseShown[q.case] = true; pre = '<details class="xcase"><summary>' + CASES[q.case].title + '</summary><div class="xcase__body">' + CASES[q.case].html + '</div></details>'; }
      return pre + '<article class="xq xr__q" data-ok="' + (s === 1) + '" data-result="' + st + '"><p class="xq__meta"><span class="xr__chip" data-result="' + st + '">' +
        (st === 'right' ? 'Correct' : st === 'wrong' ? 'Incorrect' : 'Partly correct, ' + Math.round(s * 100) + '%') + '</span> Question ' + (i + 1) + ' &middot; ' + TYPE_NAME[q.type] + (q.case ? ' &middot; Case study' : '') + '</p>' +
        '<div class="xq__stem"><p>' + q.stem + '</p></div>' + answerUI(q, last.answers[id], true) +
        '<p class="quiz__why"><strong>Why.</strong> ' + q.why + '</p><p class="xr__study">Study: <a href="#/m/' + q.mod + '">' + q.mod + ' ' + m.short + '</a>' +
        (q.obj >= 0 ? ' &middot; ' + m.objectives[q.obj] : '') + '</p></article>';
    }).join('') + '</div>';
    $('#content').innerHTML = h;
  }

  /* ---------------- meta column ---------------- */
  /* ---------------- practice assessment ----------------
     Modeled on the format of Microsoft's free Practice Assessment: 50 randomized
     questions, check an answer as you go (practice mode) or at the end (exam
     conditions), rationale with Microsoft Learn links for every question, and a
     score report broken down by skill area. The questions are this guide's own. */
  var PA_N = 50, PA_MINUTES = 100;
  var PAQ = {}, PA_POOL = {};
  (function buildPool() {
    MODULES.forEach(function (m) {
      if (SCORED.indexOf(m.domain) < 0) return;
      m.quiz.forEach(function (q, i) {
        var id = m.id + '.q' + (i + 1);
        PAQ[id] = { id: id, dom: m.domain, mod: m.id, obj: q.obj, type: 'single', stem: q.q, o: q.o, a: q.a, why: q.why };
      });
    });
    EXAMQ.forEach(function (q) {
      if ((q.type !== 'single' && q.type !== 'multi') || q.case) return;
      var m = byId(q.mod); if (!m || SCORED.indexOf(m.domain) < 0) return;
      PAQ[q.id] = { id: q.id, dom: m.domain, mod: q.mod, obj: q.obj, type: q.type, stem: q.stem, o: q.o, a: q.a, pick: q.pick, why: q.why };
    });
    Object.keys(PAQ).forEach(function (id) { var d = PAQ[id].dom; (PA_POOL[d] = PA_POOL[d] || []).push(id); });
  })();
  function paQuota() {
    var ds = EXAM.domains.filter(function (d) { return SCORED.indexOf(d.id) >= 0; });
    var tot = ds.reduce(function (s, d) { return s + d.mid; }, 0), q = {}, used = 0;
    var rem = ds.map(function (d) { var x = PA_N * d.mid / tot; q[d.id] = Math.floor(x); used += q[d.id]; return [d.id, x - q[d.id]]; });
    rem.sort(function (a, b) { return b[1] - a[1]; });
    for (var i = 0; used < PA_N; i++, used++) q[rem[i % rem.length][0]]++;
    return q;
  }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function paLinks(q) {
    var l = (window.PALINKS && PALINKS[q.id]) || [];
    var m = byId(q.mod);
    if (m && m.ms) m.ms.forEach(function (x) { if (!l.some(function (y) { return y.u === x.u; })) l = l.concat([{ t: x.t + ' (training)', u: x.u }]); });
    return l;
  }
  function paStart(mode) {
    var quota = paQuota(), ids = [];
    Object.keys(quota).forEach(function (d) { ids = ids.concat(shuffle(PA_POOL[d] || []).slice(0, quota[d])); });
    ids = shuffle(ids);
    var perm = {};
    ids.forEach(function (id) { perm[id] = shuffle(PAQ[id].o.map(function (_, i) { return i; })); });
    state.pa.cur = { mode: mode, ids: ids, perm: perm, ans: {}, checked: {}, idx: 0, started: Date.now(), deadline: mode === 'exam' ? Date.now() + PA_MINUTES * 60000 : null };
    save(); go('#/pa');
  }
  function paCorrect(q, a) {
    if (a === undefined || a === null) return false;
    if (q.type === 'single') return a === q.a;
    var want = q.a.slice().sort().join(','), got = (a || []).slice().sort().join(',');
    return want === got;
  }
  function paFinish() {
    var c = state.pa.cur; if (!c) return;
    var byD = {}, byG = {}, right = 0, res = {};
    c.ids.forEach(function (id) {
      var q = PAQ[id], ok = paCorrect(q, c.ans[id]), m = byId(q.mod), g = m.group;
      res[id] = ok; if (ok) right++;
      byD[q.dom] = byD[q.dom] || [0, 0]; byD[q.dom][0] += ok ? 1 : 0; byD[q.dom][1]++;
      byG[g] = byG[g] || [0, 0, q.dom]; byG[g][0] += ok ? 1 : 0; byG[g][1]++;
      if (!ok && q.obj >= 0) { var k = q.mod + ':' + q.obj; state.misses[k] = (state.misses[k] || 0) + 1; }
    });
    state.pa.hist.unshift({ at: Date.now(), mode: c.mode, ids: c.ids, perm: c.perm, ans: c.ans, res: res, pct: Math.round(100 * right / c.ids.length), right: right, n: c.ids.length, byD: byD, byG: byG, secs: Math.round((Date.now() - c.started) / 1000) });
    state.pa.hist = state.pa.hist.slice(0, 10);
    state.pa.cur = null; state.pa.view = 0; save(); go('#/pa/review');
  }
  function paOptLetter(i) { return String.fromCharCode(65 + i); }
  function paOptions(q, perm, sel, lock, showKey) {
    var multi = q.type === 'multi';
    return '<div class="pa__opts" role="' + (multi ? 'group' : 'radiogroup') + '">' + perm.map(function (oi, pos) {
      var on = multi ? (sel || []).indexOf(oi) >= 0 : sel === oi;
      var key = multi ? q.a.indexOf(oi) >= 0 : q.a === oi;
      var st = showKey ? (key ? 'right' : on ? 'wrong' : '') : '';
      return '<label class="pa__opt" data-state="' + st + '"><input type="' + (multi ? 'checkbox' : 'radio') + '" name="paopt" data-pa="' + oi + '"' + (on ? ' checked' : '') + (lock ? ' disabled' : '') + '><span class="pa__letter">' + paOptLetter(pos) + '</span><span>' + q.o[oi] + '</span></label>';
    }).join('') + '</div>';
  }
  function paRationale(q, ok) {
    return '<div class="pa__why" data-ok="' + ok + '"><p><strong>' + (ok ? 'Correct.' : 'Incorrect.') + '</strong> ' + q.why + '</p>' +
      '<p class="pa__learn"><strong>Learn more on Microsoft Learn:</strong></p><ul>' + paLinks(q).map(function (x) { return '<li>' + L(x.t, x.u) + '</li>'; }).join('') + '</ul></div>';
  }
  function paDomName(d) { var x = EXAM.domains.filter(function (y) { return y.id === d; })[0]; return x ? x.name : d; }
  function renderPAStart() {
    var h = '<h1>Practice assessment</h1><p class="lede">' + PA_N + ' randomized questions drawn in proportion to the exam’s domain weights, from a bank of ' + Object.keys(PAQ).length + ' single- and multiple-answer questions. Every question comes with its rationale and the Microsoft Learn pages that ground it, and the score report breaks results down by skill area.</p>' +
      Q('note', '<strong>Modeled on Microsoft’s format, not Microsoft’s questions.</strong> Microsoft’s free ' + L('SC-300 Practice Assessment', EXAM.paUrl) + ' uses the same shape: randomized questions, the answer and rationale with links for every question, and a score report. Its questions are Microsoft’s and are not reproduced here. Take it as well - it is written by the team that writes the exam.') +
      '<div class="pa__modes"><div class="pa__mode"><h3>Practice mode</h3><p>Check each answer as you go and read the rationale before moving on. No timer.</p><button class="btn" data-variant="primary" data-act="pastart" data-mode="practice">Start practice mode</button></div>' +
      '<div class="pa__mode"><h3>Exam conditions</h3><p>' + PA_MINUTES + ' minutes, the time Microsoft allows for associate exams without labs. Answers and rationale appear in the score report at the end.</p><button class="btn" data-act="pastart" data-mode="exam">Start under exam conditions</button></div></div>';
    if (state.pa.hist.length) {
      h += '<h2>Previous attempts</h2><table class="pa__hist"><thead><tr><th>Date</th><th>Mode</th><th>Score</th><th></th></tr></thead><tbody>' +
        state.pa.hist.map(function (x, i) { return '<tr><td>' + new Date(x.at).toLocaleString() + '</td><td>' + (x.mode === 'exam' ? 'Exam conditions' : 'Practice') + '</td><td>' + x.pct + '% (' + x.right + '/' + x.n + ')</td><td><button class="btn" data-act="paview" data-i="' + i + '">Score report</button></td></tr>'; }).join('') + '</tbody></table>';
    }
    $('#content').innerHTML = h;
  }
  var paTimer = null;
  function paTick() {
    var c = state.pa.cur, el = $('#paClock');
    if (!c || !c.deadline || !el) { clearInterval(paTimer); paTimer = null; return; }
    var left = Math.max(0, c.deadline - Date.now()), mm = Math.floor(left / 60000), ss = Math.floor(left % 60000 / 1000);
    el.textContent = mm + ':' + (ss < 10 ? '0' : '') + ss + ' left';
    if (left <= 0) { clearInterval(paTimer); paTimer = null; paFinish(); }
  }
  function renderPASession() {
    var c = state.pa.cur, id = c.ids[c.idx], q = PAQ[id], n = c.ids.length, sel = c.ans[id], chk = !!c.checked[id];
    var answered = c.ids.filter(function (x) { var a = c.ans[x]; return a !== undefined && (!Array.isArray(a) || a.length); }).length;
    var h = '<h1>Practice assessment</h1><div class="progress-strip"><span>Question ' + (c.idx + 1) + ' of ' + n + ' &middot; ' + answered + ' answered' + (c.deadline ? ' &middot; <strong id="paClock"></strong>' : '') + '</span><div class="bar"><span class="bar__fill" style="width:' + pct(answered / n) + '%"></span></div></div>' +
      '<div class="pa__q"><p class="pa__meta">' + paDomName(q.dom) + ' &middot; ' + byId(q.mod).group + '</p><p class="pa__stem">' + q.stem + '</p>' +
      (q.type === 'multi' ? '<p class="pa__hint">Choose ' + q.pick + '. Each correct answer presents part of the solution.</p>' : '') +
      paOptions(q, c.perm[id], sel, chk, chk) + (chk ? paRationale(q, paCorrect(q, sel)) : '') + '</div>' +
      '<div class="pa__nav"><button class="btn" data-act="paprev"' + (c.idx === 0 ? ' disabled' : '') + '>&larr; Previous</button>' +
      (c.mode === 'practice' && !chk ? '<button class="btn" data-variant="primary" data-act="pacheck"' + (sel === undefined || (Array.isArray(sel) && !sel.length) ? ' disabled' : '') + '>Check answer</button>' : '') +
      (c.idx < n - 1 ? '<button class="btn" data-act="panext">Next &rarr;</button>' : '<button class="btn" data-variant="primary" data-act="pafinish">Finish and see score report</button>') + '</div>' +
      '<details class="pa__grid"><summary>All questions</summary><div class="pa__cells">' + c.ids.map(function (x, i) { var a = c.ans[x], done = a !== undefined && (!Array.isArray(a) || a.length); return '<button class="pa__cell" data-act="pajump" data-i="' + i + '" data-done="' + done + '"' + (i === c.idx ? ' aria-current="true"' : '') + '>' + (i + 1) + '</button>'; }).join('') + '</div></details>' +
      '<p><button class="btn" data-variant="danger" data-act="paabandon">Abandon attempt</button> <button class="btn" data-act="pafinish">Finish now</button></p>';
    $('#content').innerHTML = h;
    if (c.deadline) { paTick(); if (!paTimer) paTimer = setInterval(paTick, 1000); }
  }
  function renderPAReview() {
    var x = state.pa.hist[state.pa.view || 0];
    if (!x) { renderPAStart(); return; }
    var h = '<h1>Score report</h1><p class="lede">' + new Date(x.at).toLocaleString() + ' &middot; ' + (x.mode === 'exam' ? 'Exam conditions' : 'Practice mode') + ' &middot; ' + Math.round(x.secs / 60) + ' minutes</p>' +
      '<div class="gauge"><div class="gauge__big">' + x.pct + '%</div><div>' + x.right + ' of ' + x.n + ' correct. ' + (x.pct >= PASS ? 'At or above this guide’s ' + PASS + '% readiness bar.' : 'Below this guide’s ' + PASS + '% readiness bar; the skill areas below show where.') + '</div></div>' +
      '<h2>By exam domain</h2><table class="pa__hist"><thead><tr><th>Domain</th><th>Correct</th><th>Score</th></tr></thead><tbody>' +
      Object.keys(x.byD).sort().map(function (d) { var v = x.byD[d]; return '<tr><td>' + paDomName(d) + '</td><td>' + v[0] + '/' + v[1] + '</td><td>' + Math.round(100 * v[0] / v[1]) + '%</td></tr>'; }).join('') + '</tbody></table>' +
      '<h2>By skill area</h2><table class="pa__hist"><thead><tr><th>Skill area</th><th>Correct</th></tr></thead><tbody>' +
      Object.keys(x.byG).sort(function (a, b) { return x.byG[a][0] / x.byG[a][1] - x.byG[b][0] / x.byG[b][1]; }).map(function (g) { var v = x.byG[g]; return '<tr><td>' + g + '</td><td>' + v[0] + '/' + v[1] + '</td></tr>'; }).join('') + '</tbody></table>' +
      '<h2>Every question</h2>';
    x.ids.forEach(function (id, i) {
      var q = PAQ[id]; if (!q) return;
      h += '<div class="pa__q" data-ok="' + !!x.res[id] + '"><p class="pa__meta">' + (i + 1) + '. ' + paDomName(q.dom) + ' &middot; ' + byId(q.mod).group + '</p><p class="pa__stem">' + q.stem + '</p>' +
        paOptions(q, x.perm[id], x.ans[id], true, true) + paRationale(q, !!x.res[id]) + '</div>';
    });
    h += '<p><a class="btn" href="#/pa">Back to practice assessment</a> <a class="btn" href="#/ready">Readiness</a></p>';
    $('#content').innerHTML = h;
  }
  document.addEventListener('change', function (e) {
    var t = e.target; if (!t || !t.dataset || t.dataset.pa === undefined) return;
    var c = state.pa.cur; if (!c) return;
    var id = c.ids[c.idx], q = PAQ[id], oi = +t.dataset.pa;
    if (c.checked[id]) return;
    if (q.type === 'multi') { var a = (c.ans[id] || []).slice(), p = a.indexOf(oi); if (t.checked && p < 0) a.push(oi); if (!t.checked && p >= 0) a.splice(p, 1); c.ans[id] = a; }
    else c.ans[id] = oi;
    save(); var y = window.scrollY; renderPASession(); window.scrollTo(0, y);
  });
  function paAct(act, t) {
    var c = state.pa.cur;
    if (act === 'pastart') { paStart(t.dataset.mode); return true; }
    if (act === 'paview') { state.pa.view = +t.dataset.i; save(); go('#/pa/review'); render(false); return true; }
    if (!c) return false;
    if (act === 'pacheck') { c.checked[c.ids[c.idx]] = true; save(); var y = window.scrollY; renderPASession(); window.scrollTo(0, y); return true; }
    if (act === 'paprev' || act === 'panext' || act === 'pajump') {
      c.idx = act === 'pajump' ? +t.dataset.i : Math.max(0, Math.min(c.ids.length - 1, c.idx + (act === 'panext' ? 1 : -1)));
      save(); renderPASession(); window.scrollTo(0, 0); return true;
    }
    if (act === 'pafinish') { arm(t, paFinish, 'Click again to finish'); return true; }
    if (act === 'paabandon') { arm(t, function () { state.pa.cur = null; save(); render(false); }, 'Click again to abandon'); return true; }
    return false;
  }
  (function paStyles() {
    document.head.insertAdjacentHTML('beforeend', '<style>' +
      '.pa__modes{display:grid;grid-template-columns:repeat(auto-fit,minmax(15rem,1fr));gap:var(--s-4);margin:var(--s-4) 0}' +
      '.pa__mode{border:1px solid var(--rule);border-radius:8px;padding:var(--s-4);background:var(--paper-raise)}' +
      '.pa__mode h3{margin-top:0}' +
      '.pa__q{border:1px solid var(--rule);border-radius:8px;padding:var(--s-4);margin:var(--s-4) 0;background:var(--paper-raise)}' +
      '.pa__q[data-ok="true"]{border-left:4px solid var(--cost-none)}.pa__q[data-ok="false"]{border-left:4px solid var(--cost-high)}' +
      '.pa__meta{font-size:var(--t-sm);color:var(--ink-soft);margin:0 0 .5em}.pa__stem{font-weight:600}.pa__hint{font-size:var(--t-sm);color:var(--ink-soft)}' +
      '.pa__opts{display:grid;gap:.5em;margin:.75em 0}' +
      '.pa__opt{display:flex;gap:.6em;align-items:flex-start;border:1px solid var(--rule);border-radius:6px;padding:.6em .75em;cursor:pointer;background:var(--paper)}' +
      '.pa__opt input{margin-top:.25em}.pa__letter{font-weight:700;min-width:1.2em}' +
      '.pa__opt[data-state="right"]{border-color:var(--cost-none);box-shadow:inset 3px 0 0 var(--cost-none)}.pa__opt[data-state="wrong"]{border-color:var(--cost-high);box-shadow:inset 3px 0 0 var(--cost-high)}' +
      '.pa__why{border-top:1px solid var(--rule);margin-top:.75em;padding-top:.5em}.pa__learn{margin-bottom:.25em}' +
      '.pa__nav{display:flex;flex-wrap:wrap;gap:.5em;margin:var(--s-4) 0}' +
      '.pa__grid summary{cursor:pointer;color:var(--ink-soft)}.pa__cells{display:flex;flex-wrap:wrap;gap:4px;margin-top:.5em}' +
      '.pa__cell{min-width:2.2em;padding:.3em;border:1px solid var(--rule);border-radius:4px;background:var(--paper);color:var(--ink);cursor:pointer}' +
      '.pa__cell[data-done="true"]{background:var(--accent-fill)}.pa__cell[aria-current="true"]{outline:2px solid var(--accent)}' +
      '.pa__hist{width:100%;border-collapse:collapse;margin:.5em 0}.pa__hist th,.pa__hist td{text-align:left;padding:.4em .5em;border-bottom:1px solid var(--rule)}' +
      '.labrun{border:1px solid var(--rule);border-radius:8px;padding:var(--s-4);background:var(--paper-raise)}' +
      '</style>');
  })();

  function renderMeta(r) {
    var h;
    if (r.view === 'learn') {
      var L = lById(r.id);
      h = '<aside class="field"><h2 class="field__title">Learn page at a glance</h2>' +
        '<div class="field__row"><span class="field__key">Microsoft Learn</span><span class="field__val">' + L.ms.map(function (x) { return '<a href="' + x.u + '" target="_blank" rel="noopener">' + x.t + '</a>'; }).join('<br>') + '</span></div>' +
        '<div class="field__row"><span class="field__key">Feeds</span><span class="field__val">' + L.mods.map(function (id) { return '<a href="#/m/' + id + '">' + id + '</a>'; }).join(', ') + '</span></div>' +
        '<div class="field__row"><span class="field__key">Units</span><span class="field__val">' + L.units.length + '</span></div>' +
        '<div class="field__row"><span class="field__key">Reading</span><span class="field__val">~' + L.mins + ' min</span></div>' +
        '<div class="field__row"><span class="field__key">Key terms</span><span class="field__val">' + termCount(L) + '</span></div>' +
        '<p class="field__note">Written for this guide from the same syllabus as the Learn modules linked above. Read those too; the explanations here are shaped for the exam.</p></aside>' +
        '<nav class="outline"><h2 class="field__title">On this page</h2><ul class="outline__list" id="outline"></ul></nav>';
    } else if (r.view === 'module' || r.view === 'lab') {
      var m = byId(r.id), D = dom(m.domain);
      h = '<aside class="field"><h2 class="field__title">' + (r.view === 'lab' ? 'Lab' : 'Module') + ' at a glance</h2>' +
        '<div class="field__row"><span class="field__key">Domain</span><span class="field__val">' + D.name + (m.domain === '00' ? '' : ' &middot; ' + D.weight) + '</span></div>' +
        '<div class="field__row"><span class="field__key">Status</span><span class="field__val"><span class="status" data-status="' + m.status + '">' + m.status + '</span></span></div>' +
        '<div class="field__row"><span class="field__key">Cost</span><span class="field__val">' + costChip(m.cost.level, m.cost.label) + meter(m.cost.level) + '</span></div>' +
        (m.ms && m.ms.length ? '<div class="field__row"><span class="field__key">Microsoft Learn</span><span class="field__val">' + m.ms.map(function (x) { return '<a href="' + x.u + '" target="_blank" rel="noopener">' + x.t + '</a>'; }).join('<br>') + '</span></div>' : '') +
        '<div class="field__row"><span class="field__key">Portal</span><span class="field__val">' + m.portal + '</span></div>' +
        '<div class="field__row"><span class="field__key">Modules / CLI</span><span class="field__val">' + m.sdk + '</span></div>' +
        '<div class="field__row"><span class="field__key">KQL tables</span><span class="field__val">' + m.kql + '</span></div>' +
        '<div class="field__row"><span class="field__key">Prerequisites</span><span class="field__val">' + (m.prereq.length ? m.prereq.map(function (id) { return '<a href="#/m/' + id + '">' + id + '</a>'; }).join(', ') : 'None') + '</span></div>' +
        (m.srcCheck ? '<div class="field__row"><span class="field__key">Sources verified</span><span class="field__val">' + m.srcCheck.date + ' &middot; ' + m.srcCheck.n + ' links resolved</span></div>' : '') +
        (m.codeCheck ? '<div class="field__row"><span class="field__key">Code verified</span><span class="field__val">' + m.codeCheck.date + ' &middot; ' + [m.codeCheck.kql ? m.codeCheck.kql + ' KQL' : '', m.codeCheck.ps ? m.codeCheck.ps + ' PowerShell' : '', m.codeCheck.cli ? m.codeCheck.cli + ' Azure CLI' : ''].filter(Boolean).join(', ') + ' block' + ((m.codeCheck.kql + m.codeCheck.ps + m.codeCheck.cli) > 1 ? 's' : '') + ' against Microsoft schemas and references</span></div>' : '') +
        '<div class="field__row"><span class="field__key">Lab run</span><span class="field__val">' + (state.labrun[m.id] ? 'You, ' + new Date(state.labrun[m.id].at).toLocaleDateString() : m.verified ? m.verified : '<span class="status" data-status="Preview">Not yet</span>') + '</span></div>' +
        '<p class="field__note">' + m.cost.est + '</p>' +
        (m.verified ? '<p class="field__note">Lab run end to end on ' + m.verified + '.</p>' : '<p class="field__note">' + EXAM.unverified + '</p>') +
        '<div class="field__links">' + (r.view === 'lab' ? '<a href="#/m/' + m.id + '">Back to the module</a>' : '<a href="#/lab/' + m.id + '">Go to the lab</a>') + '</div></aside>' +
        '<nav class="outline"><h2 class="field__title">On this page</h2><ul class="outline__list" id="outline"></ul></nav>';
    } else {
      h = '<aside class="field"><h2 class="field__title">Exam at a glance</h2>' +
        '<div class="field__row"><span class="field__key">Exam</span><span class="field__val">' + EXAM.code + '</span></div>' +
        '<div class="field__row"><span class="field__key">Passing</span><span class="field__val">' + EXAM.passing + ' of 1000</span></div>' +
        '<div class="field__row"><span class="field__key">Outline</span><span class="field__val">' + EXAM.outline + '</span></div>' +
        SCORED.map(function (d) { var D = dom(d); return '<div class="field__row"><span class="field__key">' + D.short + '</span><span class="field__val">' + D.weight + '</span></div>'; }).join('') +
        EXAM.glance.map(function (g) { return '<div class="field__row"><span class="field__key">' + g[0] + '</span><span class="field__val">' + g[1] + '</span></div>'; }).join('') +
        '<div class="field__row"><span class="field__key">Your practice</span><span class="field__val">' + (state.exam.hist[0] ? '<a href="#/exam/review">' + state.exam.hist[0].pct + '%</a>' : '<a href="#/exam">Not taken</a>') + '</span></div>' +
        '<p class="field__note">' + EXAM.note + '</p>' +
        '<div class="field__links">' + EXAM.links.map(function (l) { return '<a href="' + l[1] + '" target="_blank" rel="noopener">' + l[0] + '</a>'; }).join(' &middot; ') + '</div></aside>' +
        '<aside class="field"><h2 class="field__title">Progress</h2><p class="field__note">Stored in this browser, and synced to your account when the viewer allows it. Readiness counts only knowledge-check answers.</p>' +
        '<div class="field__links"><button class="btn" data-act="wipe" data-variant="danger" type="button">Reset all progress</button></div></aside>';
    }
    $('#meta').innerHTML = h;
  }
  function buildOutline() {
    var ol = $('#outline');
    if (!ol) return;
    ol.innerHTML = $$('#content h2').map(function (h2) {
      if (!h2.id) h2.id = slug(h2.textContent);
      return '<li data-depth="2"><a class="outline__link" href="#" data-target="' + h2.id + '">' + h2.textContent + '</a></li>';
    }).join('');
  }

  /* ---------------- chrome ---------------- */
  function addCopyButtons() {
    $$('#content pre').forEach(function (pre) {
      if ($('.copy-btn', pre) || pre.classList.contains('xq__code')) return;
      var b = document.createElement('button');
      b.className = 'copy-btn'; b.type = 'button'; b.textContent = 'Copy';
      b.addEventListener('click', function () {
        var text = $('code', pre).textContent;
        var done = function () { b.dataset.state = 'copied'; b.textContent = 'Copied'; setTimeout(function () { b.dataset.state = ''; b.textContent = 'Copy'; }, 1500); };
        try {
          navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text); done(); });
        } catch (e) { fallbackCopy(text); done(); }
      });
      pre.appendChild(b);
    });
  }
  function fallbackCopy(text) {
    var t = document.createElement('textarea'); t.value = text; t.style.position = 'fixed'; t.style.opacity = '0';
    document.body.appendChild(t); t.select();
    try { document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(t);
  }
  function setTopbar(r) {
    $$('.viewbtn[data-go]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.go === r.view || (b.dataset.go === 'exam' && r.view === 'examreview') || (b.dataset.go === 'learn' && (r.view === 'learn' || r.view === 'learnindex' || r.view === 'glossary')))); });
  }

  /* ---------------- render ---------------- */
  var lastRouteKey = '', pendingFig = null;
  function render(keepScroll) {
    var r = route(), key = r.view + ':' + (r.id || '');
    var y = window.scrollY;
    document.body.dataset.review = String(state.review && (r.view === 'module'));
    $('#content').dataset.flash = 'false';
    renderSidebar(r);
    if (r.view === 'module') renderModule(byId(r.id));
    else if (r.view === 'lab') renderLab(byId(r.id));
    else if (r.view === 'cost') renderCost();
    else if (r.view === 'ready') renderReady();
    else if (r.view === 'exam') { if (state.exam.cur) renderExamSession(); else renderExamStart(); }
    else if (r.view === 'examreview') renderExamReview();
    else if (r.view === 'pa') { if (state.pa.cur) renderPASession(); else renderPAStart(); }
    else if (r.view === 'pareview') renderPAReview();
    else if (r.view === 'learnindex') renderLearnIndex();
    else if (r.view === 'learn') renderLearn(lById(r.id));
    else if (r.view === 'glossary') renderGlossary();
    else renderDash();
    renderMeta(r);
    window.SC300Highlight.mount($('#content'));
    addCopyButtons();
    buildOutline();
    setTopbar(r);
    var titles = { dash: 'Dashboard', cost: 'Cost planner', ready: 'Readiness', exam: 'Practice exam', examreview: 'Practice exam results', learnindex: 'Learn the concepts', glossary: 'Glossary' };
    document.title = (r.view === 'learn' ? 'Learn ' + r.id + ' ' + lById(r.id).short : r.id ? (r.view === 'lab' ? 'Lab ' : '') + r.id + ' ' + byId(r.id).short : titles[r.view]) + ' - ' + EXAM.site;
    if (keepScroll === true && key === lastRouteKey) window.scrollTo(0, y);
    else window.scrollTo(0, 0);
    lastRouteKey = key;
    if (pendingFig) { var pf = document.getElementById(pendingFig); pendingFig = null; if (pf) pf.scrollIntoView({ block: 'start' }); }
    closeNav();
    startTimer();
  }

  /* ---------------- events ---------------- */
  var armed = null;
  function arm(btn, fn, text) {
    if (armed === btn) { armed = null; fn(); return; }
    if (armed) { armed.removeAttribute('data-confirm'); armed.textContent = armed.dataset.label; }
    armed = btn; btn.dataset.label = btn.textContent; btn.dataset.confirm = 'armed'; btn.textContent = text || 'Click again to confirm';
    setTimeout(function () { if (armed === btn) { armed = null; btn.removeAttribute('data-confirm'); btn.textContent = btn.dataset.label; } }, 4000);
  }

  document.addEventListener('click', function (e) {
    var tm = e.target.closest('#content[data-flash="true"] .term');
    if (tm) { tm.dataset.shown = String(tm.dataset.shown !== 'true'); return; }
    var tl = e.target.closest('a[data-term]');
    if (tl) { pendingFig = tl.dataset.term; return; }
    var t = e.target.closest('[data-act], [data-go], .outline__link, #palbtn, #theme-toggle, #nav-toggle, .pal__item');
    if (!t) return;
    var r = route(), m = r.id ? byId(r.id) : null;
    if (t.matches('.outline__link')) { e.preventDefault(); var el = document.getElementById(t.dataset.target); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    if (t.id === 'palbtn') { openPal(); return; }
    if (t.id === 'theme-toggle') { cycleTheme(); return; }
    if (t.id === 'nav-toggle') { var sb = $('#sidebar'), open = sb.dataset.open !== 'true'; sb.dataset.open = String(open); t.setAttribute('aria-expanded', String(open)); return; }
    if (t.matches('.pal__item')) { runPal(+t.dataset.i); return; }
    if (t.dataset.go) { go('#/' + t.dataset.go); return; }
    var act = t.dataset.act;
    if (act && paAct(act, t)) return;
    if (act === 'labrun' && m) { var note = ($('#labrunNote') || {}).value || ''; state.labrun[m.id] = { at: Date.now(), note: note.slice(0, 500) }; save(); render(true); return; }
    if (act === 'labunrun' && m) { arm(t, function () { delete state.labrun[m.id]; save(); render(true); }, 'Click again to clear'); return; }
    if (act === 'read' && m) { if (state.read[m.id]) delete state.read[m.id]; else state.read[m.id] = true; save(); render(true); }
    else if (act === 'review') { state.review = !state.review; save(); render(true); }
    else if (act === 'reset' && m) {
      arm(t, function () {
        if (r.view === 'lab') delete state.steps[m.id];
        else { delete state.read[m.id]; delete state.quiz[m.id]; }
        save(); render(true);
      });
    }
    else if (act === 'wipe') { arm(t, function () { state = blank(); save(); render(true); }); }
    else if (act === 'check' && m) {
      var qs = state.quiz[m.id] || (state.quiz[m.id] = {}), ans = qs.answers || {};
      var missing = m.quiz.filter(function (_, i) { return ans[i] === undefined; }).length;
      if (missing) { var msg = $('#quizmsg'); if (msg) msg.textContent = 'Answer all ' + m.quiz.length + ' first (' + missing + ' left).'; return; }
      var correct = m.quiz.map(function (q, i) { return ans[i] === q.a; });
      m.quiz.forEach(function (q, i) { if (!correct[i] && q.obj >= 0) { var k = m.id + ':' + q.obj; state.misses[k] = (state.misses[k] || 0) + 1; } });
      qs.marked = true;
      qs.last = { correct: correct, score: correct.filter(Boolean).length, total: m.quiz.length, at: Date.now() };
      save(); render(true);
      var qz = $('#quiz'); if (qz) qz.scrollIntoView({ block: 'start' });
    }
    else if (act === 'xstart') { startExam(t.dataset.mode); }
    else if (act === 'lread' && r.view === 'learn') { if (state.learned[r.id]) delete state.learned[r.id]; else state.learned[r.id] = true; save(); render(true); }
    else if (act === 'lflip') { var on = t.getAttribute('aria-pressed') !== 'true'; t.setAttribute('aria-pressed', String(on)); t.textContent = on ? 'Show definitions' : 'Quiz me on the terms'; $('#content').dataset.flash = String(on); }
    else if (act === 'xprev' || act === 'xnext' || act === 'xjump') {
      var cx = state.exam.cur; if (!cx) return;
      cx.idx = act === 'xjump' ? +t.dataset.i : Math.max(0, Math.min(cx.ids.length - 1, cx.idx + (act === 'xnext' ? 1 : -1)));
      save(); render(false);
    }
    else if (act === 'xflag') { var cf = state.exam.cur; if (!cf) return; var fid = cf.ids[cf.idx]; if (cf.flags[fid]) delete cf.flags[fid]; else cf.flags[fid] = true; save(); render(true); }
    else if (act === 'xmove') {
      var cm = state.exam.cur; if (!cm) return;
      var mid = cm.ids[cm.idx], perm = cm.answers[mid], i0 = +t.dataset.i, i1 = i0 + (+t.dataset.d);
      if (i1 < 0 || i1 >= perm.length) return;
      var tmp = perm[i0]; perm[i0] = perm[i1]; perm[i1] = tmp; save(); render(true);
    }
    else if (act === 'xsubmit') {
      var cs = state.exam.cur; if (!cs) return;
      var left = cs.ids.filter(function (x) { return !isAnswered(XQ[x], cs.answers[x]); }).length;
      arm(t, submitExam, left ? left + ' unanswered - click again to submit' : 'Click again to submit');
    }
    else if (act === 'xabandon') { arm(t, function () { state.exam.cur = null; save(); render(false); }, 'Click again to abandon'); }
    else if (act === 'retry' && m) { var q2 = state.quiz[m.id]; q2.marked = false; q2.answers = {}; save(); render(true); var qz2 = $('#quiz'); if (qz2) qz2.scrollIntoView({ block: 'start' }); }
  });

  document.addEventListener('change', function (e) {
    var t = e.target, r = route(), m = r.id ? byId(r.id) : null;
    if (t.id === 'xonlywrong') { var xr = $('#xr'); if (xr) xr.dataset.onlyWrong = String(t.checked); return; }
    if (t.id === 'glflash') { $$('#gl .gl__t').forEach(function (d) { d.open = !t.checked; }); return; }
    if (t.dataset && t.dataset.x && state.exam.cur) {
      var c = state.exam.cur, q = XQ[c.ids[c.idx]], a = c.answers[q.id];
      if (t.dataset.x === 'single') c.answers[q.id] = +t.value;
      else if (t.dataset.x === 'multi') { a = (a || []).filter(function (v) { return v !== +t.value; }); if (t.checked) a.push(+t.value); c.answers[q.id] = a; }
      else if (t.dataset.x === 'yesno') a[+t.dataset.i] = t.value === '1';
      else if (t.dataset.x === 'code') a[+t.dataset.i] = t.value === '' ? null : +t.value;
      save(); refreshExamStrip();
      return;
    }
    if (!m) return;
    if (t.matches('input[type="checkbox"][data-step]')) {
      var s = state.steps[m.id] || (state.steps[m.id] = {});
      if (t.checked) s[t.dataset.step] = true; else delete s[t.dataset.step];
      var li = t.closest('li'); if (li) li.dataset.done = String(t.checked);
      save();
      var st = $('#stripText'), sbar = $('#stripBar');
      if (st) st.textContent = labDone(m) + ' of ' + labTotal(m) + ' steps';
      if (sbar) sbar.style.width = pct(labDone(m) / labTotal(m)) + '%';
      renderSidebar(r);
    } else if (t.matches('.quiz__form input[type="radio"]')) {
      var qs = state.quiz[m.id] || (state.quiz[m.id] = {});
      qs.answers = qs.answers || {};
      qs.answers[+t.name.slice(1)] = +t.value;
      save();
    }
  });

  window.addEventListener('hashchange', function () { render(false); });
  document.addEventListener('input', function (e) { if (e.target.id === 'glq') filterGlossary(); });

  function closeNav() { var sb = $('#sidebar'); if (sb) sb.dataset.open = 'false'; var nt = $('#nav-toggle'); if (nt) nt.setAttribute('aria-expanded', 'false'); }

  /* ---------------- theme ---------------- */
  var THEMES = ['system', 'dark', 'light'], GLYPH = { system: '\u25D1 System', dark: '\u25D0 Dark', light: '\u25CB Light' };
  function applyTheme(t) { document.documentElement.setAttribute('data-theme', t); var b = $('#theme-toggle'); if (b) b.textContent = GLYPH[t]; }
  function cycleTheme() {
    var cur = document.documentElement.getAttribute('data-theme') || 'system';
    var next = THEMES[(THEMES.indexOf(cur) + 1) % THEMES.length];
    applyTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
  }

  /* ---------------- palette ---------------- */
  var palItems = [], palShown = [], palActive = 0;
  function buildPalItems() {
    var r = route(), items = [
      { kind: 'Action', label: 'Dashboard', sub: 'Progress and objective coverage', run: function () { go('#/dash'); } },
      { kind: 'Action', label: 'Cost planner', sub: 'Labs ordered by cost, plus the traps', run: function () { go('#/cost'); } },
      { kind: 'Action', label: 'Readiness', sub: 'What to study next', run: function () { go('#/ready'); } },
      { kind: 'Action', label: 'Practice exam', sub: EXAMQ.length + ' scenario questions in exam formats', run: function () { go('#/exam'); } },
      { kind: 'Action', label: 'Learn the concepts', sub: LEARN.length + ' pages with diagrams', run: function () { go('#/learn'); } },
      { kind: 'Action', label: 'Glossary', sub: GLOSS.length + ' defined terms', run: function () { go('#/glossary'); } },
      { kind: 'Action', label: 'Toggle review pass', sub: 'Fold explanation, keep exam tables', run: function () { state.review = !state.review; save(); render(true); } },
      { kind: 'Action', label: 'Cycle theme', sub: 'System, dark, light', run: cycleTheme }
    ];
    LEARN.forEach(function (L) {
      items.push({ kind: 'Learn', label: L.id + '  ' + L.title, sub: L.units.length + ' units', run: function () { go('#/learn/' + L.id); } });
      L.units.forEach(function (u, i) { items.push({ kind: 'Concept', label: u.t, sub: L.id + ' ' + L.short, run: function () { pendingFig = 'u-' + L.id + '-' + i; go('#/learn/' + L.id); } }); });
    });
    GLOSS.forEach(function (g) { items.push({ kind: 'Term', label: g.term, sub: g.def.length > 90 ? g.def.slice(0, 88) + '\u2026' : g.def, run: function () { pendingFig = tId(g.term); go('#/learn/' + g.L.id); } }); });
    MODULES.forEach(function (m) {
      items.push({ kind: 'Module', label: m.id + '  ' + m.title, sub: dom(m.domain).name, run: function () { go('#/m/' + m.id); } });
      items.push({ kind: 'Lab', label: m.id + '  ' + m.title, sub: m.cost.label + ' cost', run: function () { go('#/lab/' + m.id); } });
      m.objectives.forEach(function (o) { items.push({ kind: 'Objective', label: o, sub: m.id + ' \u00b7 ' + dom(m.domain).name, run: function () { go('#/m/' + m.id); } }); });
      (FIGURES[m.id] || []).forEach(function (f, i) { items.push({ kind: 'Diagram', label: f.cap, sub: m.id + ' ' + m.short, run: function () { pendingFig = 'fig-' + m.id + '-' + i; go('#/m/' + m.id); } }); });
    });
    $$('#content h2').forEach(function (h2) {
      items.push({ kind: 'On this page', label: h2.textContent, sub: 'Current page', run: function () { h2.scrollIntoView({ block: 'start' }); } });
    });
    return items;
  }
  function filterPal() {
    var q = $('#palinput').value.toLowerCase().trim(), terms = q.split(/\s+/).filter(Boolean);
    palShown = palItems.filter(function (it) {
      if (!terms.length) return it.kind === 'Action' || it.kind === 'Learn';
      var hay = (it.kind + ' ' + it.label + ' ' + it.sub).toLowerCase();
      return terms.every(function (t) { return hay.indexOf(t) !== -1; });
    }).slice(0, 16);
    palActive = 0;
    drawPal();
  }
  function drawPal() {
    var list = $('#pallist');
    if (!palShown.length) { list.innerHTML = '<li class="pal__empty">No matches.</li>'; return; }
    list.innerHTML = palShown.map(function (it, i) {
      return '<li class="pal__item" data-i="' + i + '"' + (i === palActive ? ' data-active="true"' : '') + '><span class="pal__kind">' + it.kind + '</span><span class="pal__body"><span class="pal__label">' + escH(it.label) + '</span><span class="pal__sub">' + escH(it.sub) + '</span></span></li>';
    }).join('');
    var a = $('.pal__item[data-active="true"]', list); if (a) a.scrollIntoView({ block: 'nearest' });
  }
  function openPal() {
    palItems = buildPalItems();
    var p = $('#pal'); p.hidden = false; $('#palbtn').setAttribute('aria-pressed', 'true');
    var inp = $('#palinput'); inp.value = ''; filterPal(); inp.focus();
  }
  function closePal() { $('#pal').hidden = true; $('#palbtn').setAttribute('aria-pressed', 'false'); }
  function runPal(i) { var it = palShown[i]; closePal(); if (it) it.run(); }

  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); if ($('#pal').hidden) openPal(); else closePal(); return; }
    if ($('#pal').hidden) return;
    if (e.key === 'Escape' || e.key === 'Esc') { e.preventDefault(); e.stopPropagation(); closePal(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); palActive = Math.min(palActive + 1, palShown.length - 1); drawPal(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); palActive = Math.max(palActive - 1, 0); drawPal(); }
    else if (e.key === 'Enter') { e.preventDefault(); runPal(palActive); }
  }, true);

  /* ---------------- boot ---------------- */
  function boot() {
    var t = 'system'; try { t = localStorage.getItem(THEME_KEY) || 'system'; } catch (e) {}
    applyTheme(THEMES.indexOf(t) === -1 ? 'system' : t);
    $('#palinput').addEventListener('input', filterPal);
    $('#pal').addEventListener('click', function (e) { if (e.target.id === 'pal') closePal(); });
    render(false);
    initSync();
    // Offline support on the GitHub Pages site only (sw.js ships with the repository, not with the claude.ai artifact).
    if ('serviceWorker' in navigator && location.protocol === 'https:' && /\.github\.io$/.test(location.hostname)) {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
