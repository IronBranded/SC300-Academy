function escH(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function C(lang, src) { return '<pre><code class="language-' + lang + '">' + escH(src.replace(/^\n+/, '').replace(/\s+$/, '')) + '</code></pre>'; }
function S(shape, title, html) { return '<section class="shape" data-shape="' + shape + '"><h2 data-shape="' + shape + '">' + title + '</h2>' + html + '</section>'; }
function Q(kind, html) { return '<blockquote data-callout="' + kind + '"><p>' + html + '</p></blockquote>'; }
function T(kind, head, rows) {
  var h = '<div class="table-scroll"><table data-table="' + kind + '"><thead><tr>' + head.map(function (x) { return '<th>' + x + '</th>'; }).join('') + '</tr></thead><tbody>';
  rows.forEach(function (r) { h += '<tr>' + r.map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr>'; });
  return h + '</tbody></table></div>';
}
function L(text, url) { return '<a href="' + url + '" target="_blank" rel="noopener">' + text + '</a>'; }

function SRCSTAMP(m) { return m && m.srcCheck ? '<p class="field__note">All ' + m.srcCheck.n + ' links in this module were checked on ' + m.srcCheck.date + ' against Microsoft’s docs source repositories or the live page. The full log is in the link verification report.</p>' : ''; }
function LEARNLI(m) { return m && m.ms && m.ms.length ? '<li><strong>Microsoft Learn training:</strong> ' + m.ms.map(function (x) { return L(x.t, x.u); }).join(' &middot; ') + '</li>' : ''; }

/* Date-aware wording: renders 'before' until the date, then 'after', so deadline text never goes stale. */
function DUE(iso, before, after) { return Date.now() < Date.parse(iso + 'T00:00:00Z') ? before : after; }
