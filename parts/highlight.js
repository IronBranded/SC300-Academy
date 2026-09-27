/* highlight.js - SC-300 guide
   Same tokenizer as the SC-500 and AI-901 guides, retargeted.

   SC-300 code is mostly Microsoft Graph PowerShell (Microsoft.Graph.*) and the
   Microsoft Entra PowerShell module, with KQL for the sign-in and audit tables,
   JSON for policy objects and Graph requests, XML for SAML, and a little Azure
   CLI. MSOnline and AzureAD cmdlets appear nowhere: both modules are retired.

     DESTRUCTIVE, LOCKOUT-PRONE AND BILLABLE TOKENS ARE MARKED IN THE COST COLOUR.

   In identity the expensive mistake is rarely a bill. It is deleting an object
   that cannot be recovered, revoking the sessions of the wrong account, or
   enabling a policy that locks out every administrator. Those get the same
   treatment as the few Azure resources in this guide that bill by the hour. */

(function (global) {
  'use strict';

  function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  var DANGER = new RegExp([
    '\\bRemove-Mg[A-Za-z]*', '\\bRemove-Entra[A-Za-z]*', '\\bRemove-Az[A-Za-z]*',
    '\\bRevoke-Mg[A-Za-z]*', '\\bRevoke-Entra[A-Za-z]*',
    '\\bReset-Mg[A-Za-z]*', '\\bClear-\\w+',
    '-Force\\b', '-Confirm:\\$false',
    '--yes\\b', '--force\\b', '\\baz\\s+group\\s+delete\\b', '\\baz\\s+vm\\s+create\\b',
    '\\bNew-AzVM\\b', '\\bNew-AzBastion\\b', '\\baz\\s+eventhubs\\s+namespace\\s+create\\b',
    "\\bstate\\s*=\\s*'enabled'", '"state":\\s*"enabled"', "-State\\s+'enabled'"
  ].join('|'), 'g');

  var LANGS = {
    powershell: {
      comment: /#[^\n]*/g,
      string: /@'[\s\S]*?'@|@"[\s\S]*?"@|'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"/g,
      keyword: /\b(?:if|else|elseif|foreach|for|while|do|switch|function|return|try|catch|finally|param|begin|process|end|in|break|continue|throw)\b/gi,
      fn: /\b(?:[A-Z][a-z]+)-[A-Za-z0-9]+\b/g,
      variable: /\$[A-Za-z_][\w:]*/g,
      param: /(?:^|\s)-[A-Za-z][\w]*/g,
      number: /\b\d+(?:\.\d+)?\b/g
    },
    bash: {
      comment: /#[^\n]*/g,
      string: /'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"/g,
      keyword: /\b(?:if|then|fi|for|do|done|while|case|esac|function|export|local|return|echo)\b/g,
      fn: /\b(?:az|curl|git|sudo|jq)\b/g,
      param: /(?:^|\s)--?[A-Za-z][\w-]*/g,
      variable: /\$\{?[A-Za-z_]\w*\}?/g,
      number: /\b\d+(?:\.\d+)?\b/g
    },
    kusto: {
      comment: /\/\/[^\n]*/g,
      string: /'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"/g,
      keyword: /\b(?:where|summarize|project|project-away|project-rename|extend|join|union|let|order|sort|by|take|top|count|distinct|render|make-series|mv-expand|parse|on|asc|desc|and|or|not|has|has_any|contains|startswith|in|kind|leftouter|inner|isnotempty|isempty)\b/g,
      fn: /\b(?:ago|now|todatetime|tostring|toint|todynamic|parse_json|bin|strcat|split|iff|case|arg_max|arg_min|dcount|sum|avg|min|max|round|countif|make_set|array_length|datetime_diff)\b(?=\s*\()/g,
      number: /\b\d+(?:\.\d+)?[dhms]?\b/g,
      table: /^\s*([A-Z]\w+)(?=\s*$|\s*\|)/gm
    },
    json: {
      key: /"(?:[^"\\]|\\.)*"(?=\s*:)/g,
      string: /"(?:[^"\\]|\\.)*"/g,
      keyword: /\b(?:true|false|null)\b/g,
      number: /-?\b\d+(?:\.\d+)?\b/g
    },
    xml: {
      comment: /<!--[\s\S]*?-->/g,
      string: /"(?:[^"\\]|\\.)*"/g,
      tag: /<\/?[\w:-]+|\/?>/g,
      attr: /\b[\w:-]+(?==)/g
    },
    http: {
      keyword: /^(?:GET|POST|PATCH|PUT|DELETE)\b/gm,
      string: /"(?:[^"\\]|\\.)*"/g,
      key: /"(?:[^"\\]|\\.)*"(?=\s*:)/g,
      number: /-?\b\d+(?:\.\d+)?\b/g
    },
    text: {}
  };

  var ALIAS = {
    ps: 'powershell', ps1: 'powershell', pwsh: 'powershell', powershell: 'powershell',
    sh: 'bash', bash: 'bash', shell: 'bash', console: 'bash',
    kql: 'kusto', kusto: 'kusto',
    json: 'json', xml: 'xml', saml: 'xml', http: 'http', text: 'text'
  };

  function tokenize(src, rules) {
    var marks = new Array(src.length);
    var order = ['comment', 'string', 'key', 'table', 'tag', 'attr', 'keyword', 'fn', 'param', 'variable', 'number'];
    order.forEach(function (kind) {
      var re = rules[kind];
      if (!re) return;
      re.lastIndex = 0;
      var m;
      while ((m = re.exec(src)) !== null) {
        if (m[0] === '') { re.lastIndex++; continue; }
        var start = m.index + (m[0].length - m[0].replace(/^\s+/, '').length);
        var end = m.index + m[0].length;
        var free = true;
        for (var i = start; i < end; i++) if (marks[i]) { free = false; break; }
        if (free) for (var j = start; j < end; j++) marks[j] = kind;
      }
    });
    DANGER.lastIndex = 0;
    var d;
    while ((d = DANGER.exec(src)) !== null) {
      for (var k = d.index; k < d.index + d[0].length; k++) marks[k] = 'danger';
    }
    var out = '', cur = null, buf = '';
    function flush() {
      if (!buf) return;
      out += cur ? '<span class="t-' + cur + '">' + esc(buf) + '</span>' : esc(buf);
      buf = '';
    }
    for (var p = 0; p < src.length; p++) {
      if (marks[p] !== cur) { flush(); cur = marks[p]; }
      buf += src[p];
    }
    flush();
    return out;
  }

  function highlightEl(code) {
    if (code.dataset.hl === 'done') return;
    var m = /language-([\w-]+)/.exec(code.className || '');
    var lang = m ? ALIAS[m[1].toLowerCase()] : null;
    code.dataset.hl = 'done';
    if (!lang || !LANGS[lang]) return;
    code.dataset.lang = lang === 'kusto' ? 'kql' : lang;
    code.innerHTML = tokenize(code.textContent, LANGS[lang]);
  }

  function mount(root) {
    var blocks = root.querySelectorAll('pre > code');
    for (var i = 0; i < blocks.length; i++) highlightEl(blocks[i]);
  }

  global.SC300Highlight = { mount: mount };
})(window);
