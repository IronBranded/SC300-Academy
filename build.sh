#!/bin/sh
# Assemble the single-file site (index.html) from parts/ and content/.
set -e
cd "$(dirname "$0")"
{ cat parts/head.html; echo '<script>'
  cat parts/highlight.js parts/helpers.js parts/dg.js parts/vis.js content/00_exam.js content/d1.js content/d2.js content/d3a.js content/d3b.js content/d4a.js content/d4b.js content/srccheck.js content/figures.js content/exam.js content/palinks.js content/learn1.js content/learn2.js parts/engine.js
  echo '</script>'; echo '</body>'; echo '</html>'; } > index.html
echo "built index.html ($(wc -c < index.html) bytes)"
