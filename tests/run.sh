#!/bin/sh
# Headless tests: every route renders, widgets, quizzes, practice exam, practice assessment, lab-run record.
set -e
cd "$(dirname "$0")"
for t in smoke smoke2 smoke3 smoke4 smoke5 smoke6; do echo "== $t"; node $t.js; done
