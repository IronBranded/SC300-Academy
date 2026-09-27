function vFig(inner, cap, cls) {
  return '<figure class="diagram v ' + (cls || '') + '">' + inner + (cap ? '<figcaption>' + cap + '</figcaption>' : '') + '</figure>';
}

/* Steps joined by arrows. steps: [{t, s, k}]; k = acc | d1 | d2 | warn | ok */
function vFlow(steps, cap, opts) {
  opts = opts || {};
  var h = '<div class="vf">';
  steps.forEach(function (s, i) {
    if (i) h += '<span class="vf__ar" aria-hidden="true"></span>';
    h += '<div class="vf__st" data-k="' + (s.k || '') + '"><strong>' + s.t + '</strong>' + (s.s ? '<span>' + s.s + '</span>' : '') + '</div>';
  });
  h += '</div>' + (opts.loop ? '<div class="vf__loop">&#8634; ' + opts.loop + '</div>' : '');
  return vFig(h, cap);
}

/* A grid of concept cards. cards: [{t, s, k, tag}] */
function vCards(cards, cap) {
  return vFig('<div class="vc">' + cards.map(function (c) {
    return '<div class="vc__c" data-k="' + (c.k || '') + '">' + (c.tag ? '<span class="vc__tag">' + c.tag + '</span>' : '') + '<strong>' + c.t + '</strong><span>' + c.s + '</span></div>';
  }).join('') + '</div>', cap);
}

/* Nested boxes, outermost first. layers: [{t, s, k}]; last layer may carry chips: [] */
function vNest(layers, cap) {
  function build(i) {
    var L = layers[i];
    var inner = i + 1 < layers.length ? build(i + 1) : (L.chips ? '<div class="vn__chips">' + L.chips.map(function (c) { return '<span>' + c + '</span>'; }).join('') + '</div>' : '');
    return '<div class="vn" data-k="' + (L.k || '') + '"><div class="vn__l"><strong>' + L.t + '</strong>' + (L.s ? ' <span>' + L.s + '</span>' : '') + '</div>' + inner + '</div>';
  }
  return vFig(build(0), cap);
}

/* Two columns compared. a, b: {t, k, items: []} */
function vVs(a, b, cap) {
  function col(c) { return '<div class="vv__c" data-k="' + (c.k || '') + '"><strong>' + c.t + '</strong><ul>' + c.items.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul></div>'; }
  return vFig('<div class="vv">' + col(a) + '<div class="vv__x">vs</div>' + col(b) + '</div>', cap);
}

/* Labelled bands, e.g. the anatomy of a request. parts: [{l, t, k}] */
function vAnat(parts, cap, title) {
  return vFig((title ? '<div class="va__title">' + title + '</div>' : '') + '<div class="va">' + parts.map(function (p) {
    return '<div class="va__r" data-k="' + (p.k || '') + '"><span class="va__l">' + p.l + '</span><span class="va__t">' + p.t + '</span></div>';
  }).join('') + '</div>', cap);
}

/* Tokens as chips with illustrative IDs. toks: [[text, id]] */
function vTokens(toks, cap) {
  return vFig('<div class="vt">' + toks.map(function (t, i) {
    return '<span class="vt__k" data-i="' + (i % 4) + '"><b>' + t[0].replace(/ /g, '&middot;') + '</b><small>' + t[1] + '</small></span>';
  }).join('') + '</div>', cap);
}

/* Horizontal bars. items: [{l, v (0..1), k, note}] */
function vBars(items, cap) {
  return vFig('<div class="wg-bars">' + items.map(function (it) {
    return '<div class="wg-bar vb"><span>' + it.l + '</span><div class="wg-track"><div class="wg-fill" data-k="' + (it.k || '') + '" style="width:' + Math.round(it.v * 100) + '%"></div></div><span class="wg-p">' + (it.note || Math.round(it.v * 100) + '%') + '</span></div>';
  }).join('') + '</div>', cap);
}

