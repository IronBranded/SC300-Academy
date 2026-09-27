/* diagrams.js - AI-901 guide
   Hand-built SVG so every figure uses the same tokens as the page and follows
   the theme. A figure earns its place only where the idea is spatial: where a
   request goes, what wraps what, which direction data travels. */

var DGN = 0;
function dgFig(w, h, label, body, caption) {
  var id = 'dg' + (++DGN);
  function mk(suffix, cls) {
    return '<marker id="' + id + suffix + '" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="dg-ah ' + cls + '" d="M0,0L10,5L0,10z"/></marker>';
  }
  return '<figure class="diagram dg-fig"><svg class="dg" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="' + label + '">' +
    '<defs>' + mk('a', '') + mk('w', 'dg-ah--warn') + mk('k', 'dg-ah--ok') + '</defs>' +
    body.split('#M').join('#' + id) + '</svg><figcaption>' + caption + '</figcaption></figure>';
}
function bx(x, y, w, h, lines, cls) {
  var s = '<rect class="dg-box ' + (cls || '') + '" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="6"/>';
  var n = lines.length, lh = 15, cy = y + h / 2 - (n - 1) * lh / 2;
  lines.forEach(function (t, i) {
    s += '<text class="' + (i === 0 ? 'dg-t' : 'dg-s') + '" x="' + (x + w / 2) + '" y="' + (cy + i * lh) + '" text-anchor="middle" dominant-baseline="middle">' + t + '</text>';
  });
  return s;
}
function zn(x, y, w, h, label, cls) {
  return '<rect class="dg-zone ' + (cls || '') + '" x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="10"/>' +
    '<text class="dg-zl" x="' + (x + 12) + '" y="' + (y + 17) + '">' + label + '</text>';
}
function ar(pts, cls, both) {
  var m = cls === 'warn' ? 'w' : cls === 'ok' ? 'k' : 'a';
  return '<path class="dg-ln ' + (cls || '') + '" d="M' + pts.map(function (p) { return p.join(','); }).join(' L') + '" marker-end="url(#M' + m + ')"' + (both ? ' marker-start="url(#M' + m + ')"' : '') + '/>';
}
function tx(x, y, t, cls, anchor) {
  return '<text class="' + (cls || 'dg-lb') + '" x="' + x + '" y="' + y + '" text-anchor="' + (anchor || 'middle') + '">' + t + '</text>';
}

