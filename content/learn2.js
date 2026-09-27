/* ======================================================================
   L4  The Conditional Access decision
   ====================================================================== */
LEARN.push({
  id: 'L4', title: 'Zero Trust and the Conditional Access Decision', short: 'The access decision', mins: 20,
  summary: 'How Entra decides whether to issue a token: the signals it collects, how every applicable policy is combined, what risk adds, and where Global Secure Access and session controls extend the decision past sign-in.',
  ms: [MSD("Plan, implement, and administer Conditional Access", "https://learn.microsoft.com/en-us/training/modules/plan-implement-administer-conditional-access/"), MSD("Manage Microsoft Entra Identity Protection", "https://learn.microsoft.com/en-us/training/modules/manage-azure-active-directory-identity-protection/"), MSD('What is Conditional Access?', 'https://learn.microsoft.com/entra/identity/conditional-access/overview'), MSD('Zero Trust: secure identity', 'https://learn.microsoft.com/security/zero-trust/deploy/identity')],
  mods: ['02-02', '02-03', '02-04', '02-05'],
  units: [
    { t: 'Zero Trust in three sentences',
      body: '<p><strong>Verify explicitly</strong>: decide every access with all available signals, not network location alone. <strong>Use least privilege</strong>: just enough access, just in time. <strong>Assume breach</strong>: limit blast radius, segment, and watch everything. Conditional Access is where the first principle is enforced for identity; PIM and entitlement management carry the second; logs and ID Protection the third.</p>',
      vis: vCards([
        { t: 'Verify explicitly', s: 'Conditional Access, authentication strengths, device compliance, risk', k: 'd2' },
        { t: 'Least privilege', s: 'PIM, access packages, access reviews, scoped roles', k: 'd4' },
        { t: 'Assume breach', s: 'CAE, token protection, logs, ID Protection', k: 'warn' }
      ], 'Where each SC-300 feature sits in Microsoft’s Zero Trust model.'),
      terms: [['Zero Trust', 'A security model that verifies every request explicitly, grants least privilege and assumes breach.'],
              ['Verify explicitly', 'Deciding access on identity, device, location, risk and other signals for every request.'],
              ['Assume breach', 'Designing controls on the premise that an attacker is already present.']] },
    { t: 'Signals, decision, enforcement',
      body: '<p>After the first factor, Entra gathers signals - who the user is and their groups and roles, which app, which network, which device and its compliance, which client, how risky the sign-in and user are - and evaluates every enabled Conditional Access policy against them. Policies whose assignments match all <em>apply</em>; the rest do not. The decision is then enforced: block, grant with requirements, or grant with session controls.</p>',
      vis: vFlow([
        { t: 'Signals', s: 'user, app, network, device, client, risk', k: 'd1' },
        { t: 'Policies that apply', s: 'all assignments match, not excluded', k: 'd2' },
        { t: 'Combine', s: 'block wins; all grants required', k: 'acc' },
        { t: 'Enforce', s: 'block, prompt, or issue token with session rules', k: 'ok' }
      ], 'The same four steps run for every sign-in to every app that uses Entra ID.'),
      terms: [['Conditional Access', 'Entra’s policy engine that decides, per sign-in, whether and how to issue a token.'],
              ['Assignment', 'The users, target resources, network and conditions a policy applies to.'],
              ['Grant control', 'What a user must satisfy to get access, such as MFA or a compliant device; or block.'],
              ['Session control', 'What applies after access is granted, such as sign-in frequency or app enforced restrictions.'],
              ['Report-only mode', 'A policy state that evaluates and logs the outcome without enforcing it.']] },
    { t: 'Combining policies',
      body: '<p>Three rules settle almost every combination question. <strong>All applicable policies are enforced together</strong>: if one requires MFA and another a compliant device, the user needs both. <strong>Block wins</strong> over any grant. <strong>Exclusions win</strong> over inclusions, for users, apps and networks alike. Within one policy, <em>require all</em> is AND and <em>require one</em> is OR.</p>',
      vis: vAnat([
        { l: 'Rule 1', t: 'Every applicable policy applies; their grant requirements add up', k: 'd2' },
        { l: 'Rule 2', t: 'Any applicable block policy blocks, whatever else applies', k: 'warn' },
        { l: 'Rule 3', t: 'An exclusion removes the policy for that user, app or network', k: 'acc' },
        { l: 'Rule 4', t: 'Report-only policies never enforce', k: 'd1' }
      ], 'Try them in the evaluator in module 02-02.', 'Four rules'),
      terms: [['Authentication strength', 'A grant control that specifies which combinations of methods satisfy it, such as phishing-resistant MFA.'],
              ['Named location', 'An IP range or country set used in the network assignment; can be marked trusted.'],
              ['Filter for devices', 'A condition matching device properties such as trustType, isCompliant or extension attributes.']] },
    { t: 'Risk and the network edge',
      body: '<p><strong>ID Protection</strong> contributes two signals: sign-in risk (this request is probably not the owner) and user risk (this account is probably compromised). Risk-based policies turn them into requirements - MFA for risky sign-ins, a secure password change for risky users - so users can remediate themselves.</p>' +
        '<p><strong>Global Secure Access</strong> extends the decision to the network: Conditional Access can require that traffic arrives through your security service edge (the compliant network condition), and it applies web filtering profiles as a session control. Access decisions then follow the traffic, not just the sign-in.</p>',
      vis: vFlow([
        { t: 'ID Protection', s: 'sign-in risk, user risk', k: 'warn' },
        { t: 'Conditional Access', s: 'risk and network as conditions', k: 'd2' },
        { t: 'Global Secure Access', s: 'compliant network, web filtering', k: 'd2' },
        { t: 'CAE at the resource', s: 're-evaluate on events and IP change', k: 'ok' }
      ], 'Signals feed the decision; enforcement continues past it.'),
      terms: [['Sign-in risk', 'The probability that a specific authentication request was not made by the account owner.'],
              ['User risk', 'The probability that an account is compromised, aggregated over time.'],
              ['Self-remediation', 'A user satisfying a risk-based policy (MFA or secure password change) to close their own risk.'],
              ['Compliant network', 'A Conditional Access network condition satisfied only by traffic through the tenant’s Global Secure Access.']] }
  ]
});

/* ======================================================================
   L5  Application identity
   ====================================================================== */
LEARN.push({
  id: 'L5', title: 'Application Identity: Registrations, Service Principals and Consent', short: 'Application identity', mins: 20,
  summary: 'Why applications have two objects, how permissions are requested, consented and granted, and which kind of identity a workload should use.',
  ms: [MSD("Implement app registration", "https://learn.microsoft.com/en-us/training/modules/implement-app-registration/"), MSD("Register apps using Microsoft Entra ID", "https://learn.microsoft.com/en-us/training/modules/register-apps-use-microsoft-entra-id/"), MSD('Application and service principal objects', 'https://learn.microsoft.com/entra/identity-platform/app-objects-and-service-principals'), MSD('Permissions and consent', 'https://learn.microsoft.com/entra/identity-platform/permissions-consent-overview'), MSD('Workload identities', 'https://learn.microsoft.com/entra/workload-id/workload-identities-overview')],
  mods: ['03-01', '03-02', '03-03', '03-04'],
  units: [
    { t: 'The blueprint and the instance',
      body: '<p>An <strong>application object</strong> (what you see under App registrations) is the blueprint: one per app, in its home tenant, holding the client ID, redirect URIs, credentials, requested permissions and app roles. A <strong>service principal</strong> (what you see under Enterprise apps) is the instance of that blueprint in a particular tenant. It holds what that tenant decided: consent grants, user assignments, Conditional Access, whether sign-in is enabled.</p>' +
        '<p>A multitenant app has one application object and a service principal in every tenant that has consented to it. Microsoft’s own apps - Graph, Exchange Online, SharePoint - appear in your tenant as service principals of applications registered in Microsoft’s tenants.</p>',
      vis: vVs({ t: 'Application object', k: 'd3', items: ['One per app, in the home tenant', 'Client ID, redirect URIs, credentials', 'Permissions requested, app roles defined'] },
               { t: 'Service principal', k: 'd3', items: ['One per tenant that uses the app', 'Consent grants and app role assignments', 'Users assigned, CA, enabled or not'] },
               'App registrations and Enterprise applications are two views of this pair.'),
      terms: [['Application object', 'The global definition of an app in its home tenant; shown under App registrations.'],
              ['Service principal', 'The local instance of an application in a tenant; holds grants and assignments; shown under Enterprise applications.'],
              ['Client ID', 'The application ID that identifies an app in token requests.'],
              ['Multitenant application', 'An app registered to accept sign-ins from users in other organisations’ tenants.']] },
    { t: 'Requested, consented, granted',
      body: '<p>An app <em>requests</em> permissions in its registration. <strong>Consent</strong> turns requests into grants on the service principal: a user can consent for themselves to some delegated permissions, depending on your consent settings; an administrator can consent for the whole tenant. Delegated consent creates <em>OAuth2 permission grants</em>; consent to application permissions creates <em>app role assignments</em>. Nothing works until that second step happens.</p>',
      vis: vFlow([
        { t: 'Requested', s: 'requiredResourceAccess on the registration', k: 'd3' },
        { t: 'Consent', s: 'user (limited) or admin (tenant-wide)', k: 'warn' },
        { t: 'Granted', s: 'permission grant or app role assignment on the SP', k: 'ok' },
        { t: 'In the token', s: 'scp (delegated) or roles (application)', k: 'd2' }
      ], 'Where a permission lives at each stage - and where to remove it.'),
      terms: [['Delegated permission', 'A permission an app uses on behalf of a signed-in user; limited by what the user can do.'],
              ['Application permission', 'A permission an app uses as itself with no user; always requires admin consent.'],
              ['Consent', 'Approval that turns a requested permission into a grant for an application.'],
              ['Admin consent workflow', 'A process for users to request consent they cannot give; reviewers approve or deny.'],
              ['Illicit consent grant', 'An attack in which a user is tricked into consenting to a malicious application.']] },
    { t: 'Choosing a workload identity',
      body: '<p>Code needs an identity; the right one depends on where it runs. Code on an Azure resource uses a <strong>managed identity</strong> and never sees a credential. Code elsewhere uses a <strong>service principal</strong>, ideally with a <strong>federated credential</strong> so it exchanges its own platform token instead of holding a secret, otherwise a certificate. Windows services on-premises use <strong>group or delegated managed service accounts</strong>. User accounts are for people.</p>',
      vis: vCards([
        { t: 'Managed identity', s: 'Code on Azure. No credential to manage.', k: 'd3', tag: 'Azure' },
        { t: 'Service principal + federated credential', s: 'GitHub Actions, Kubernetes, other clouds. No secret exists.', k: 'd3', tag: 'outside Azure' },
        { t: 'Service principal + certificate', s: 'On-premises apps and daemons.', k: 'acc', tag: 'outside Azure' },
        { t: 'gMSA / dMSA', s: 'Windows services on AD-joined servers.', k: 'd1', tag: 'on-premises' }
      ], 'Four answers, chosen by where the code runs.'),
      terms: [['Managed identity', 'An Entra identity for an Azure resource whose credentials Azure manages.'],
              ['System-assigned managed identity', 'A managed identity tied to one resource’s lifecycle.'],
              ['User-assigned managed identity', 'A standalone managed identity that can be shared by resources and authorised in advance.'],
              ['Workload identity federation', 'Letting external workloads exchange their own OIDC tokens for Entra tokens, without secrets.'],
              ['Group managed service account', 'An AD account for services on several servers, with a password AD generates and rotates.']] }
  ]
});

/* ======================================================================
   L6  The identity lifecycle
   ====================================================================== */
LEARN.push({
  id: 'L6', title: 'The Identity Lifecycle and Governance', short: 'Identity lifecycle', mins: 15,
  summary: 'Joiner, mover, leaver - and how entitlement management, access reviews, PIM and logs each govern one part of an identity’s life, so that access is granted deliberately, expires, and leaves evidence.',
  ms: [MSD("Plan and implement entitlement management", "https://learn.microsoft.com/en-us/training/modules/plan-implement-entitlement-management/"), MSD("Plan and implement privileged access", "https://learn.microsoft.com/en-us/training/modules/plan-implement-privileged-access/"), MSD('What is Microsoft Entra ID Governance?', 'https://learn.microsoft.com/entra/id-governance/identity-governance-overview'), MSD('What is Privileged Identity Management?', 'https://learn.microsoft.com/entra/id-governance/privileged-identity-management/pim-configure')],
  mods: ['04-01', '04-02', '04-03', '04-04'],
  units: [
    { t: 'Joiner, mover, leaver',
      body: '<p>Every identity is created, changes role, and leaves. Governance problems come from the middle and the end: movers keep old access, leavers keep accounts, guests outstay their project. Entra ID Governance addresses each stage: provisioning and dynamic groups for joiners, access packages with expiry and reviews for movers, and deprovisioning, external-user lifecycle settings and inactive-user reviews for leavers.</p>',
      vis: vFlow([
        { t: 'Joiner', s: 'provisioning, dynamic groups, TAP onboarding', k: 'd1' },
        { t: 'Mover', s: 'access packages, expiry, access reviews', k: 'd4' },
        { t: 'Leaver', s: 'disable, revoke, remove guests, review inactivity', k: 'warn' }
      ], 'Each stage has a feature that makes the right outcome the default.'),
      terms: [['Joiner-mover-leaver', 'The lifecycle stages of an identity in an organisation.'],
              ['Identity governance', 'Ensuring the right people have the right access for the right time, with evidence.'],
              ['Access creep', 'The accumulation of access as people change roles without losing old permissions.']] },
    { t: 'Four governance tools, four questions',
      body: '<p>Each governance feature answers one question. <strong>Entitlement management</strong>: how do people get access, and when does it end? <strong>Access reviews</strong>: does everyone who has access still need it? <strong>PIM</strong>: how do we avoid standing privilege? <strong>Logs and reports</strong>: can we prove what happened? Exam scenarios usually describe the question, not the tool.</p>',
      vis: vCards([
        { t: 'Entitlement management', s: 'Request, approve, expire. Catalogs and access packages.', k: 'd4' },
        { t: 'Access reviews', s: 'Attest periodically; remove what nobody vouches for.', k: 'd4' },
        { t: 'Privileged Identity Management', s: 'Eligible, not standing. Activate with MFA, approval, time limit.', k: 'd4' },
        { t: 'Logs and workbooks', s: 'Evidence: who did what, when, approved by whom.', k: 'acc' }
      ], 'Match the requirement to the tool before thinking about settings.'),
      terms: [['Access package', 'A bundle of resource roles users can request under a policy with approval and expiry.'],
              ['Catalog', 'A container of resources and access packages with its own delegated owners.'],
              ['Access review', 'A periodic attestation in which reviewers approve or deny continued access.'],
              ['Connected organisation', 'A partner organisation whose users may request access packages.']] },
    { t: 'Eligible, not standing',
      body: '<p>A <strong>standing</strong> (permanently active) admin role is available to anyone who steals the account, at any time. An <strong>eligible</strong> role grants nothing until activated, and activation can demand phishing-resistant MFA through an authentication context, a justification, a ticket and an approver, for a few hours at most. The only accounts that should hold standing Global Administrator are the emergency access accounts - because they must work when PIM or MFA is the thing that is broken.</p>',
      vis: vVs({ t: 'Standing (active)', k: 'warn', items: ['Always usable', 'Stolen session = stolen privilege', 'Only for break-glass accounts'] },
               { t: 'Eligible (PIM)', k: 'ok', items: ['Nothing until activated', 'MFA or auth context, approval, justification', 'Time-boxed and logged'] },
               'The core design choice PIM exists to make easy.'),
      terms: [['Eligible assignment', 'A PIM assignment that must be activated before its permissions apply.'],
              ['Active assignment', 'An assignment whose permissions apply now; permanent or time-bound.'],
              ['Activation', 'The PIM request that turns an eligible assignment active for a limited time.'],
              ['Emergency access account', 'A cloud-only, permanently active Global Administrator account kept for recovery.']] },
    { t: 'Evidence',
      body: '<p>Governance that leaves no record cannot be audited or investigated. Entra writes <strong>audit logs</strong> for every directory change, <strong>sign-in logs</strong> in four families, and <strong>provisioning logs</strong> for every create, update and delete - but keeps them only 7 or 30 days. Diagnostic settings send them to Log Analytics for KQL, workbooks and alerts, and to storage for long retention. <strong>Identity Secure Score</strong> turns configuration into a measurable posture.</p>',
      vis: vFlow([
        { t: 'Entra logs', s: 'sign-in, audit, provisioning, risk, Graph', k: 'd4' },
        { t: 'Diagnostic settings', s: 'choose categories and destinations', k: 'acc' },
        { t: 'Log Analytics', s: 'KQL, workbooks, alerts', k: 'd2' },
        { t: 'Storage', s: 'years, cheaply', k: 'ok' }
      ], 'Without the middle step, the evidence disappears after 30 days.'),
      terms: [['Audit log', 'The record of changes to directory objects and configuration.'],
              ['Diagnostic settings', 'Configuration that routes Entra logs to Log Analytics, storage, Event Hubs or partners.'],
              ['Log Analytics workspace', 'An Azure Monitor store for logs queried with KQL, used by workbooks and alerts.'],
              ['Identity Secure Score', 'A measure of how many Microsoft identity recommendations a tenant has implemented.']] }
  ]
});
