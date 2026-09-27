/* diagrams.js - SC-300 guide
   Hand-built SVG where the idea is spatial, the HTML kit where it is a sequence,
   and two widgets where the point is a decision you should be able to predict. */

var FIGURES = {};

/* 01-04: where the password is checked ------------------------------------ */
FIGURES['01-04'] = [{ shape: 'mechanism', at: 'afterH3:Three ways to check a password', cap: 'Password hash sync, pass-through authentication and federation compared',
  html: dgFig(680, 330, 'Three lanes showing where a password is validated for PHS, PTA and federation',
    zn(335, 118, 335, 202, 'On-premises') +
    tx(20, 22, 'Password hash sync', 'dg-t', 'start') +
    bx(20, 32, 90, 56, ['User', 'password']) + bx(150, 32, 150, 56, ['Microsoft Entra ID', 'checks hash of hash'], 'd2') +
    bx(355, 32, 175, 56, ['Connect / Cloud Sync', 'hash sync every 2 min'], 'ok') +
    ar([[110, 60], [150, 60]]) + ar([[355, 60], [300, 60]], 'ok') +
    tx(540, 56, 'works if on-premises', 'dg-lb', 'start') + tx(540, 71, 'is down', 'dg-lb', 'start') +
    tx(20, 132, 'Pass-through authentication', 'dg-t', 'start') +
    bx(20, 142, 90, 56, ['User']) + bx(150, 142, 150, 56, ['Microsoft Entra ID', 'queues the request'], 'd2') +
    bx(360, 142, 120, 56, ['PTA agent', 'outbound 443'], 'd1') + bx(530, 142, 125, 56, ['Domain controller', 'validates live']) +
    ar([[110, 170], [150, 170]]) + ar([[360, 170], [300, 170]]) + ar([[480, 170], [530, 170]]) +
    tx(20, 242, 'Federation (AD FS)', 'dg-t', 'start') +
    bx(20, 252, 90, 56, ['User']) + bx(150, 252, 150, 56, ['Microsoft Entra ID', 'redirects to IdP'], 'd2') +
    bx(360, 252, 120, 56, ['AD FS', 'signs the token'], 'warn') + bx(530, 252, 125, 56, ['Domain controller']) +
    ar([[110, 280], [150, 280]]) + ar([[300, 280], [360, 280]], 'warn') + ar([[480, 280], [530, 280]]) +
    tx(420, 322, 'token-signing key = forge any user', 'dg-lb t-warn'),
    'Only PHS keeps working when on-premises is down, and only federation depends on a signing key that, if stolen, mints tokens for anyone on the domain.') }];

/* 02-02: the Conditional Access evaluator ---------------------------------- */
FIGURES['02-02'] = [{ shape: 'mechanism', cap: 'Interactive: predict which Conditional Access policies apply',
  html: '<figure class="diagram widget" data-widget="ca-eval"><div class="cae">' +
    '<div class="cae__sig">' +
      '<label>User<select data-s="user"><option value="sales">Sales user</option><option value="ga">Global Administrator</option><option value="guest">Guest (partner)</option><option value="bg">Emergency account bg01</option></select></label>' +
      '<label>Target resource<select data-s="app"><option value="exo">Exchange Online</option><option value="spo">SharePoint Online</option><option value="azure">Azure portal</option></select></label>' +
      '<label>Client app<select data-s="client"><option value="browser">Browser</option><option value="modern">Mobile or desktop app</option><option value="legacy">IMAP / POP / SMTP (Other clients)</option></select></label>' +
      '<label>Network<select data-s="loc"><option value="office">Trusted office IP</option><option value="home">Home</option><option value="blocked">Blocked country</option></select></label>' +
      '<label>Device<select data-s="device"><option value="compliant">Compliant (Intune)</option><option value="unmanaged">Unmanaged</option></select></label>' +
      '<label>Sign-in risk<select data-s="risk"><option value="none">None or low</option><option value="medium">Medium</option><option value="high">High</option></select></label>' +
    '</div><div class="cae__pols"></div><div class="cae__out" aria-live="polite"></div></div>' +
    '<figcaption>Seven policies from this guide’s baseline. Every applicable policy is enforced together; block wins; exclusions beat inclusions; report-only never enforces. Change one signal at a time and predict the result before you read it.</figcaption></figure>' }];

/* 02-05: Private Access path ---------------------------------------------- */
FIGURES['02-05'] = [{ shape: 'mechanism', at: 'afterH3:Private Access', cap: 'How a Private Access request travels',
  html: vFlow([
    { t: 'Entra joined device', s: 'GSA client acquires dc01:445', k: 'd1' },
    { t: 'Microsoft SSE edge', s: 'token checked, CA for the app', k: 'd2' },
    { t: 'Private network connector', s: 'holds an outbound session', k: 'acc' },
    { t: 'dc01.corp.lab.local', s: 'SMB, RDP, any TCP/UDP', k: 'ok' }
  ], 'No inbound ports anywhere: the connector dialled out first. Conditional Access runs at the edge, per application.') }];

/* 03-02: consent decision widget ------------------------------------------ */
FIGURES['03-02'] = [{ shape: 'mechanism', at: 'afterH3:Consent', cap: 'Interactive: who can consent to this app?',
  html: '<figure class="diagram widget" data-widget="consent"><div class="cae">' +
    '<div class="cae__sig">' +
      '<label>User consent setting<select data-s="setting"><option value="verified">Verified publishers, low-impact permissions only</option><option value="none">Do not allow user consent</option></select></label>' +
      '<label>Publisher<select data-s="pub"><option value="verified">Verified publisher</option><option value="unverified">Unverified publisher</option><option value="own">Registered in your own tenant</option></select></label>' +
      '<label>Permissions requested<select data-s="perm"><option value="low">User.Read, openid, profile (classified low impact)</option><option value="mail">Mail.Read, delegated (not low impact)</option><option value="app">User.Read.All, application</option><option value="appother">An application permission of your own API</option></select></label>' +
      '<label>Admin consent workflow<select data-s="wf"><option value="on">On</option><option value="off">Off</option></select></label>' +
      '<label>Who is signing in<select data-s="who"><option value="user">Regular user</option><option value="cloudapp">Cloud Application Administrator</option><option value="pra">Privileged Role Administrator</option></select></label>' +
    '</div><div class="cae__out" aria-live="polite"></div></div>' +
    '<figcaption>Application permissions always need an administrator. Granting Microsoft Graph app roles directly needs Privileged Role Administrator; approving them through the admin consent workflow needs Global Administrator.</figcaption></figure>' }];

/* 03-03: application object versus service principal ----------------------- */
FIGURES['03-03'] = [{ shape: 'mechanism', at: 'afterH3:API permissions', cap: 'One application object, a service principal in every tenant that uses it',
  html: dgFig(680, 250, 'An application object in the home tenant with service principals in the home tenant and two customer tenants',
    zn(15, 15, 305, 220, 'Home tenant (publisher)', 'acc') +
    bx(35, 50, 265, 80, ['Application object (app registration)', 'client ID · redirect URIs · credentials', 'permissions requested · app roles'], 'd3') +
    bx(35, 160, 265, 55, ['Service principal', 'the home tenant’s own instance']) +
    ar([[167, 130], [167, 160]]) +
    zn(365, 15, 300, 105, 'Customer tenant A') +
    bx(385, 45, 260, 60, ['Service principal', 'consent grants · assignments · CA'], 'd3') +
    zn(365, 130, 300, 105, 'Customer tenant B') +
    bx(385, 160, 260, 60, ['Service principal', 'its own grants and assignments'], 'd3') +
    ar([[300, 80], [385, 75]]) + ar([[300, 100], [385, 190]]) +
    tx(342, 70, 'consent', 'dg-lb') + tx(342, 160, 'consent', 'dg-lb'),
    'Credentials and requested permissions live on the application object; granted permissions, assignments and Conditional Access attach to each tenant’s service principal.') }];

/* 03-04: Conditional Access app control routing ---------------------------- */
FIGURES['03-04'] = [{ shape: 'mechanism', at: 'afterH3:Conditional Access app control', cap: 'Conditional Access app control from sign-in to session',
  html: vFlow([
    { t: 'User signs in', s: 'browser session', k: 'd1' },
    { t: 'Entra Conditional Access', s: 'session control: Use CA App Control', k: 'd2' },
    { t: 'Defender for Cloud Apps', s: 'access policy, then session policies', k: 'd3' },
    { t: 'SaaS app', s: 'Edge in-browser, or via *.mcas.ms', k: 'ok' }
  ], 'Access policies decide at sign-in; session policies act on every download, upload, paste or print in the session.') }];

function FIG() { return ''; }

/* ---------------- widgets ---------------- */
function initWidgets(root) {
  root.querySelectorAll('[data-widget="ca-eval"]').forEach(function (w) {
    var P = [
      { id: 'CA001', name: 'Block legacy authentication', state: 'on', when: function (s) { return s.client === 'legacy'; }, grant: 'block' },
      { id: 'CA004', name: 'All users: require MFA', state: 'on', when: function () { return true; }, grant: 'Multifactor authentication' },
      { id: 'CA010', name: 'Admins: phishing-resistant MFA', state: 'on', when: function (s) { return s.user === 'ga'; }, grant: 'Authentication strength: phishing-resistant' },
      { id: 'CA012', name: 'SharePoint on unmanaged devices', state: 'on', when: function (s) { return s.app === 'spo' && s.device === 'unmanaged'; },
        grant: function (s) { return s.client === 'browser' ? null : 'block'; }, session: function (s) { return s.client === 'browser' ? 'App enforced restrictions (web-only, no download)' : null; } },
      { id: 'CA020', name: 'Block sign-ins from blocked countries', state: 'on', when: function (s) { return s.loc === 'blocked'; }, grant: 'block' },
      { id: 'CA031', name: 'Guests: accept terms of use', state: 'on', when: function (s) { return s.user === 'guest'; }, grant: 'Terms of use: Partner NDA' },
      { id: 'CA041', name: 'Sign-in risk medium or high', state: 'report', when: function (s) { return s.risk !== 'none'; }, grant: 'Multifactor authentication', session: function () { return 'Sign-in frequency: every time'; } }
    ];
    var polsEl = w.querySelector('.cae__pols'), out = w.querySelector('.cae__out');
    function val(fn, s) { return typeof fn === 'function' ? fn(s) : fn; }
    function draw() {
      var s = {};
      w.querySelectorAll('select[data-s]').forEach(function (el) { s[el.dataset.s] = el.value; });
      var blocks = [], grants = [], sessions = [], report = [], html = '';
      P.forEach(function (p) {
        var excluded = s.user === 'bg', applies = !excluded && p.when(s), g = applies ? val(p.grant, s) : null, se = applies && p.session ? p.session(s) : null;
        var state, tag, why;
        if (excluded) { state = 'skip'; tag = 'excluded'; why = 'CA-Exclude-EmergencyAccess is excluded from every policy.'; }
        else if (!applies) { state = 'skip'; tag = 'not applied'; why = 'Conditions do not match this sign-in.'; }
        else if (p.state === 'report') { state = 'report'; tag = 'report-only'; why = 'Would require: ' + (g || 'grant') + (se ? '; ' + se : '') + '. Logged, not enforced.'; report.push(p.id); }
        else if (g === 'block') { state = 'block'; tag = 'blocks'; why = 'Block access.'; blocks.push(p.id); }
        else { state = 'applies'; tag = 'applies'; why = (g ? 'Requires ' + g : 'Grants access') + (se ? '; session: ' + se : '') + '.'; if (g) grants.push(g + ' (' + p.id + ')'); if (se) sessions.push(se + ' (' + p.id + ')'); }
        html += '<div class="cae__pol" data-state="' + state + '"><strong>' + p.id + ' ' + p.name + '</strong><span class="cae__tag">' + tag + '</span><small>' + why + '</small></div>';
      });
      polsEl.innerHTML = html;
      var o = '';
      if (s.user === 'bg') {
        out.dataset.verdict = 'grant';
        o = '<strong>No Conditional Access policy applies.</strong>The emergency account is excluded everywhere. ' + (s.app === 'azure' ? 'It still meets <em>mandatory MFA</em> for the Azure portal, which Conditional Access cannot exempt - hence the passkey.' : 'Its sign-in should still raise an alert (04-04).');
      } else if (blocks.length) {
        out.dataset.verdict = 'block';
        o = '<strong>Blocked (AADSTS53003).</strong>Block wins over every grant. Blocking policy: ' + blocks.join(', ') + '.';
      } else {
        out.dataset.verdict = 'grant';
        o = '<strong>Access granted once the user satisfies every requirement together:</strong><ul>' + grants.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul>' +
          (grants.join(' ').indexOf('phishing-resistant') !== -1 ? '<p>A passkey satisfies both the MFA and the phishing-resistant requirement in one prompt.</p>' : '') +
          (sessions.length ? '<p>Session: ' + sessions.join('; ') + '</p>' : '');
      }
      if (report.length) o += '<p>Report-only (' + report.join(', ') + ') is logged on the sign-in’s Report-only tab and changes nothing.</p>';
      out.innerHTML = o;
    }
    w.querySelectorAll('select').forEach(function (el) { el.addEventListener('change', draw); });
    draw();
  });

  root.querySelectorAll('[data-widget="consent"]').forEach(function (w) {
    var out = w.querySelector('.cae__out');
    function draw() {
      var s = {};
      w.querySelectorAll('select[data-s]').forEach(function (el) { s[el.dataset.s] = el.value; });
      var appPerm = s.perm === 'app' || s.perm === 'appother', graphApp = s.perm === 'app', o, v;
      if (s.who === 'pra') { v = 'grant'; o = '<strong>Can grant tenant-wide admin consent.</strong>Privileged Role Administrator can consent to any permission, including Microsoft Graph application permissions.'; }
      else if (s.who === 'cloudapp') {
        if (graphApp) { v = 'block'; o = '<strong>Cannot grant this one.</strong>Cloud Application Administrator and Application Administrator can consent to delegated permissions and to application permissions of other APIs, but Microsoft Graph application permissions need Privileged Role Administrator.'; }
        else { v = 'grant'; o = '<strong>Can grant tenant-wide admin consent.</strong>This is within the Cloud Application Administrator role.'; }
      } else {
        var userOk = !appPerm && s.setting === 'verified' && s.perm === 'low' && (s.pub === 'verified' || s.pub === 'own');
        if (userOk) { v = 'grant'; o = '<strong>The user can consent for themselves.</strong>Low-impact delegated permissions from a verified publisher (or an app from your own tenant). A delegated grant for this user alone is created.'; }
        else {
          var reason = appPerm ? 'Application permissions always require an administrator.' : s.setting === 'none' ? 'User consent is turned off.' : s.perm !== 'low' ? 'The permission is not classified as low impact.' : 'The publisher is not verified.';
          if (s.wf === 'on') { v = 'report'; o = '<strong>Approval required.</strong>' + reason + ' The user can submit a request with a justification; reviewers act in Admin consent requests, and the request expires if nobody does.' + (graphApp ? ' For Microsoft Graph app roles, only a Global Administrator can approve the request.' : ''); }
          else { v = 'block'; o = '<strong>Need admin approval - dead end.</strong>' + reason + ' With the workflow off, the user can only contact IT outside the product.'; }
        }
      }
      out.dataset.verdict = v === 'report' ? '' : v;
      out.innerHTML = o;
    }
    w.querySelectorAll('select').forEach(function (el) { el.addEventListener('change', draw); });
    draw();
  });
}
