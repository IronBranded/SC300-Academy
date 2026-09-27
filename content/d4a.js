/* ======================================================================
   04-01  Entitlement management
   ====================================================================== */
MODULES.push({
  id: '04-01', domain: '04', title: 'Entitlement Management, Terms of Use and External User Lifecycle', short: 'Entitlement Management',
  group: 'Plan and implement entitlement management in Microsoft Entra',
  objectives: [
    'Plan entitlements',
    'Create and configure catalogs',
    'Create and configure access packages',
    'Manage access requests',
    'Implement and manage terms of use (ToU)',
    'Manage the lifecycle of external users',
    'Configure and manage connected organizations'
  ],
  status: 'GA', verified: '',
  cost: { level: 'none', label: '$0', est: '$0. Needs Entra ID P2 (from the E5 trial) or Entra ID Governance (in the Entra Suite trial) for the newer features.', meter: 'none' },
  portal: 'Entra admin center &gt; ID Governance &gt; Entitlement management: Catalogs · Access packages · Connected organizations · Settings · Conditional Access &gt; Terms of use · myaccess.microsoft.com',
  ms: [{ t: "Plan and implement entitlement management", u: "https://learn.microsoft.com/en-us/training/modules/plan-implement-entitlement-management/" }],
  sdk: '<code>Microsoft.Graph.Identity.Governance</code>',
  kql: '<code>AuditLogs</code> (service Entitlement Management)',
  prereq: ['01-02', '01-03'],
  tactical: 'Entitlement management answers the question every investigation eventually asks: how did this account get access to that? A direct group add leaves one audit line; an access package assignment carries the request, the justification, each approver’s decision, the policy, the expiry and the removal. When a guest turns up in a sensitive SharePoint site, the access package assignment history is the timeline, and an assignment whose approval came from a single approver who is also the requester’s sponsor is the social-engineering pattern to look for.',
  body: function () { return '' +
    S('concept', 'Why this exists',
      '<p>Access requests by email, fulfilled by an admin adding people to groups, never expire. Entitlement management replaces that with <strong>access packages</strong>: named bundles of resources that users request, someone approves, and that expire and get reviewed.</p>' +
      vNest([
        { t: 'Catalog', s: 'a container of resources and packages, with its own owners', k: 'd4' },
        { t: 'Access package', s: 'resource roles bundled for one purpose', k: 'd4' },
        { t: 'Policy', s: 'who can request, who approves, how long, reviews', k: 'acc', chips: ['Groups and teams', 'Enterprise apps and app roles', 'SharePoint sites', 'Custom extensions'] }
      ], 'Catalogs contain access packages; each package has one or more policies deciding who may get it and on what terms.') +
      '<p><strong>Planning entitlements</strong> starts from jobs, not resources: list what a role needs (the Sales team needs the CRM app, the Sales Teams team and the pricing SharePoint site), who owns each resource, who should approve, how long access should last, who outside the company needs it, and how often it is reviewed. One catalog per department or business owner lets that owner delegate without a directory role.</p>') +
    S('mechanism', 'How it works under the hood',
      '<h3>Catalogs and delegation</h3>' +
      T('compare', ['Role', 'Scope', 'Can'], [
        ['Identity Governance Administrator', 'Directory role', 'Everything in entitlement management'],
        ['Catalog creator', 'Entitlement management', 'Create catalogs and become their owner'],
        ['Catalog owner', 'One catalog', 'Add resources, create packages, manage roles in the catalog'],
        ['Access package manager', 'One catalog', 'Create and edit packages in it'],
        ['Access package assignment manager', 'One catalog', 'Assign and remove users directly'],
        ['Catalog reader', 'One catalog', 'Read']
      ]) +
      '<p>A resource must be added to a catalog before any package in it can use the resource, and the person adding it must own or administer the resource. A catalog can be marked <strong>enabled for external users</strong>; if it is not, external users cannot request its packages whatever the policy says.</p>' +
      '<h3>Access packages and policies</h3>' +
      T('config', ['Policy setting', 'Options'], [
        ['Who can request', 'Users and groups in your directory · all members (not guests) · specific connected organisations · all configured connected organisations · all users including external · none (administrator direct assignment only)'],
        ['Approval', 'None, single-stage or multi-stage; approvers can be specific users, the requestor’s manager, internal or external sponsors; fallback approvers; escalation after N days'],
        ['Requestor information', 'Justification, custom questions (text or choice), required terms of use'],
        ['Lifecycle', 'Expire after N days, on a date, or never; allow users to extend; access reviews on the assignments'],
        ['Automatic assignment', 'Attribute-based rule assigns and removes the package without a request (Entra ID Governance)'],
        ['Separation of duties', 'Incompatible access packages or groups block the request']
      ]) +
      C('powershell', String.raw`
# Catalog, a group resource, and an access package (Graph v1.0)
$cat = Invoke-MgGraphRequest -Method POST -Uri 'v1.0/identityGovernance/entitlementManagement/catalogs' -Body @{
    displayName = 'Sales'; description = 'Resources owned by the Sales department'; isExternallyVisible = $true }

$pkg = Invoke-MgGraphRequest -Method POST -Uri 'v1.0/identityGovernance/entitlementManagement/accessPackages' -Body @{
    displayName = 'Sales partner access'; description = 'Pricing site and partner Teams team for 90 days'
    catalog     = @{ id = $cat.id } }

# Who has what, and why
Invoke-MgGraphRequest -Method GET -Uri ('v1.0/identityGovernance/entitlementManagement/assignments?$expand=target&$filter=accessPackage/id eq ''' + $pkg.id + '''')`) +
      '<h3>Access requests</h3>' +
      '<p>Users request from <strong>My Access</strong> (<code>myaccess.microsoft.com</code>), or through the package’s direct link. Approvers act in My Access or from the email. Administrators follow each request under the package’s <strong>Requests</strong> blade - pending, delivered, failed - and can cancel a pending request or <strong>reprocess</strong> a failed delivery. Assignment managers can also assign users directly, and remove them.</p>' +
      '<h3>Terms of use</h3>' +
      '<p>Terms of use (<strong>Conditional Access &gt; Terms of use</strong>) is a PDF per language that users must accept. Options: <strong>require users to expand</strong> the document, <strong>require on every device</strong>, <strong>expire consents</strong> on a schedule, and a duration after which users must accept again. Enforce it either as a grant control in a Conditional Access policy (for example: guests, All resources, require terms of use) or as a requirement in an access package policy. Acceptances and declines are reported on the terms of use blade and in the audit logs.</p>' +
      '<h3>External users and connected organisations</h3>' +
      '<p>A <strong>connected organisation</strong> is a partner defined by its Entra tenant or by a domain (for partners on SAML/WS-Fed, email one-time passcode or Microsoft accounts), with optional internal and external <strong>sponsors</strong> who can approve. Its state is <strong>Configured</strong> - included in "all configured connected organisations" policies - or <strong>Proposed</strong>, which entitlement management creates automatically when someone from an unknown organisation is approved through a policy open to all users; proposed organisations are not included in configured-only policies until an admin changes the state.</p>' +
      '<p>For external users who arrived <em>through</em> entitlement management, <strong>Settings &gt; Manage the lifecycle of external users</strong> decides what happens when their last assignment ends: <strong>block sign-in</strong> and then <strong>remove the user</strong> after the number of days you set. Guests invited directly are not governed by this; use access reviews (04-02) for them.</p>') +
    S('config', 'Configuration surface',
      T('config', ['Control', 'Default', 'Set it to', 'Why'], [
        ['Assignment expiry', 'Never (if not set)', '90-365 days, extension allowed with approval', 'Access that never expires is the problem entitlement management exists to fix'],
        ['Approval for external requests', 'Configurable', 'Two stages: sponsor, then resource owner', 'One approver is one phish'],
        ['External user lifecycle', 'Configured in entitlement management settings', 'Block sign-in, then remove after a set number of days', 'Leaves no orphaned guests'],
        ['Catalog enabled for external users', 'Yes for new catalogs', 'Only for catalogs meant for partners', 'Internal-only catalogs stay internal'],
        ['Terms of use: require on every device', 'Off', 'On for guests on unmanaged devices', 'Acceptance per device, not per account'],
        ['Connected organisation state', 'Configured / Proposed', 'Review proposed ones monthly', 'Proposed orgs arrive without a sponsor']
      ])) +
    S('failure', 'Common failure modes',
      '<p><strong>External users cannot see the package.</strong> The catalog is not enabled for external users, or the policy does not include their connected organisation.</p>' +
      '<p><strong>Resource missing from the package editor.</strong> It was never added to the catalog.</p>' +
      '<p><strong>Request delivered with errors.</strong> A SharePoint site or app role could not be assigned - reprocess after fixing the resource.</p>' +
      '<p><strong>Guests never removed.</strong> They were invited directly, not through an access package, so the external user lifecycle setting does not apply.</p>' +
      '<p><strong>Terms of use prompts on every sign-in.</strong> A short expiry or per-device acceptance combined with users who clear cookies.</p>') +
    S('exam', 'How this is tested',
      T('exam', ['Phrase in the question', 'What it steers you to'], [
        ['"department owners manage their own resources and packages without a directory role"', 'Catalog per department, catalog owner role'],
        ['"bundle a group, an app and a SharePoint site; users request; access expires"', 'Access package with a policy'],
        ['"partner users request access, approved by their sponsor"', 'Connected organisation + policy with sponsor approval'],
        ['"remove guests automatically when their access ends"', 'Entitlement management external user lifecycle settings'],
        ['"users must accept an NDA before accessing the app"', 'Terms of use (CA grant or access package requirement)'],
        ['"NDA must be re-accepted every year"', 'Terms of use: expire consents'],
        ['"Sales users get the package automatically based on department"', 'Automatic assignment policy (ID Governance)'],
        ['"users with Finance access must not request Payments access"', 'Incompatible access packages (separation of duties)'],
        ['"where do users request access"', 'My Access portal']
      ])) +
    S('validation', 'Validation',
      C('kql', String.raw`
AuditLogs
| where TimeGenerated > ago(30d)
| where LoggedByService == "Entitlement Management"   // spans the EntitlementManagement and UserManagement categories
| extend Actor = coalesce(tostring(InitiatedBy.user.userPrincipalName), tostring(InitiatedBy.app.displayName))
| project TimeGenerated, Category, OperationName, Actor, Result, Target = tostring(TargetResources[0].displayName)
| order by TimeGenerated desc`)) +
    S('sources', 'Sources', '<ul>' + LEARNLI(this) +
      '<li>' + L('What is entitlement management?', 'https://learn.microsoft.com/entra/id-governance/entitlement-management-overview') + '</li>' +
      '<li>' + L('Create and manage a catalog', 'https://learn.microsoft.com/entra/id-governance/entitlement-management-catalog-create') + '</li>' +
      '<li>' + L('Delegation and roles in entitlement management', 'https://learn.microsoft.com/entra/id-governance/entitlement-management-delegate') + '</li>' +
      '<li>' + L('Govern access for external users', 'https://learn.microsoft.com/entra/id-governance/entitlement-management-external-users') + '</li>' +
      '<li>' + L('Terms of use', 'https://learn.microsoft.com/entra/identity/conditional-access/terms-of-use') + '</li>' +
      '</ul>' + SRCSTAMP(this));
  },
  lab: {
    intro: 'Build a partner access package end to end: catalog, resources, connected organisation, two-stage approval, terms of use, expiry - then request it as a guest from the second tenant used in 01-03.',
    steps: [
      '<p>Create a security group <code>Sales-Partners</code>, and note the SAML app from 03-02. Create the <strong>Sales</strong> catalog, enabled for external users, and add both as resources.</p>',
      '<p>Make a Sales user <strong>catalog owner</strong>. Sign in as that user and confirm they can create a package in Sales but cannot see other catalogs.</p>',
      '<p>Upload a one-page PDF as terms of use <em>Partner NDA</em>, with <em>require users to expand</em> on and consent expiry yearly.</p>',
      '<p>Add the second tenant as a <strong>connected organisation</strong> (state Configured) with yourself as internal sponsor.</p>',
      '<p>Create the access package <em>Sales partner access</em>: group membership and the app’s user role; policy for the connected organisation; two-stage approval (internal sponsor, then the catalog owner); justification required; the Partner NDA required; expiry 90 days.</p>',
      '<p>As a user from the second tenant, open the package’s link, accept the NDA and request. Approve both stages in My Access. Watch the guest get created and receive the group and app.</p>',
      '<p>As an admin, open the package’s <strong>Requests</strong> and <strong>Assignments</strong>, then remove the assignment. Confirm that entitlement management blocks the guest’s sign-in and schedules removal per <strong>Settings</strong>.</p>',
      '<p>Request the package from an account in an unconnected tenant through a copy of the policy open to all users, and find the new <strong>Proposed</strong> connected organisation.</p>'
    ],
    teardown: [
      { bucket: '1', title: 'Configuration', items: [
        'Delete the access packages (remove assignments first), then the catalog',
        'Delete proposed connected organisations; keep or delete the configured one' ] },
      { bucket: '2', title: 'Keep', items: [
        'Keep the Partner NDA terms of use if you want to use it as a CA grant for guests' ] },
      { bucket: '3', title: 'Verify', items: [
        'The guest created in step 6 is gone after the removal period, or delete it now' ] }
    ]
  },
  quiz: [
    { q: 'You are planning entitlements for a new partner programme. What should you define first?', o: ['The access review schedule only', 'The resources each partner role needs, who approves, how long access lasts, and which organisations may request', 'A dynamic group of partners', 'A new administrative unit'], a: 1, obj: 0,
      why: 'Access packages encode a role’s resources plus the request, approval, duration and eligibility rules; plan those before building.' },
    { q: 'The Marketing department must manage its own groups and access packages without holding any Microsoft Entra directory role. What do you create?', o: ['An administrative unit for Marketing', 'A Marketing catalog with a Marketing user as catalog owner', 'A role-assignable group', 'A connected organisation'], a: 1, obj: 1,
      why: 'Catalog roles delegate entitlement management within one catalog without a directory role.' },
    { q: 'Users must be able to request a bundle of a Teams team, an app role and a SharePoint site, with manager approval and 180-day expiry. What do you create?', o: ['A dynamic group', 'An access package with a request policy', 'An access review', 'A collection'], a: 1, obj: 2,
      why: 'An access package bundles resource roles; its policy defines approval and expiry.' },
    { q: 'A delivered request shows an error assigning the SharePoint site. After fixing permissions on the site, what do you do?', o: ['Delete and recreate the package', 'Reprocess the request', 'Ask the user to request again only', 'Run an access review'], a: 1, obj: 3,
      why: 'Administrators can reprocess failed or partially delivered requests.' },
    { q: 'Guests must accept an NDA before accessing any app, and re-accept every year. What do you configure?', o: ['Company branding', 'Terms of use with consent expiry, enforced by a CA policy for guests', 'An access review every year', 'The admin consent workflow'], a: 1, obj: 4,
      why: 'Terms of use enforced as a CA grant control, with expiring consents, forces periodic re-acceptance.' },
    { q: 'External users onboarded through access packages must be blocked and then deleted once they have no assignments left. Where do you configure this?', o: ['External collaboration settings', 'Entitlement management settings: manage the lifecycle of external users', 'Cross-tenant access settings', 'Guest access reviews only'], a: 1, obj: 5,
      why: 'Entitlement management settings define blocking sign-in and removal for external users it brought in.' },
    { q: 'A partner uses email one-time passcode rather than Entra ID. How do you define it as a connected organisation?', o: ['By tenant ID', 'By domain', 'It cannot be connected', 'Through cross-tenant sync'], a: 1, obj: 6,
      why: 'Connected organisations can be defined by domain for partners not on Entra ID.' },
    { q: 'A request from an unknown organisation was approved through a policy open to all users. What state does the resulting connected organisation have?', o: ['Configured', 'Proposed', 'Blocked', 'Pending'], a: 1, obj: 6,
      why: 'Entitlement management creates it as Proposed; it is excluded from "all configured connected organisations" policies until changed.' }
  ]
});

/* ======================================================================
   04-02  Access reviews
   ====================================================================== */
MODULES.push({
  id: '04-02', domain: '04', title: 'Access Reviews: Planning, Configuration and Response', short: 'Access Reviews',
  group: 'Plan, implement, and manage access reviews in Microsoft Entra',
  objectives: [
    'Plan for access reviews',
    'Create and configure access reviews',
    'Monitor access review activity',
    'Manually respond to access review activity'
  ],
  status: 'GA', verified: '',
  cost: { level: 'none', label: '$0', est: '$0 with P2 from the trial. Inactive-user reviews and machine-learning recommendations need Entra ID Governance (Entra Suite trial).', meter: 'none' },
  portal: 'Entra admin center &gt; ID Governance &gt; Access reviews · Review history · myaccess.microsoft.com &gt; Access reviews',
  ms: [{ t: "Plan, implement, and manage access review", u: "https://learn.microsoft.com/en-us/training/modules/plan-implement-manage-access-review/" }],
  sdk: '<code>Microsoft.Graph.Identity.Governance</code>',
  kql: '<code>AuditLogs</code> (service Access Reviews)',
  prereq: ['01-02', '04-01'],
  tactical: 'Access reviews are hygiene, not detection: a quarterly review will not catch a guest added last night. But the <em>inactive users</em> review finds exactly the accounts attackers prefer - dormant guests and forgotten members that nobody would notice signing in again - and review history is evidence of whether an account’s access was ever attested. When an incident involves a guest, check whether their access was reviewed, by whom, and whether the reviewer approved it from the recommendation without looking.',
  body: function () { return '' +
    S('concept', 'Why this exists',
      '<p>Access accumulates. An access review asks someone accountable - an owner, a manager, the user - whether each person still needs a specific access, and can remove access automatically when the answer is no or no answer comes.</p>' +
      T('compare', ['What can be reviewed', 'Typical reviewer'], [
        ['Members of a security or Microsoft 365 group (all, or guests only)', 'Group owners, or members themselves'],
        ['Users assigned to an enterprise application', 'App owner or business owner'],
        ['Access package assignments', 'Configured in the package policy'],
        ['Microsoft Entra roles and Azure resource roles (through PIM)', 'Role owners, security team, or self'],
        ['PIM for Groups members and owners', 'Group owners'],
        ['Inactive users across the tenant (ID Governance)', 'Managers or a named team']
      ]) +
      '<p><strong>Planning</strong> decides, per resource: who reviews (and who covers when they do not), how often, how long reviewers have, what happens to people nobody reviewed, and whether decisions apply automatically. Guests and privileged roles are reviewed more often than employee group memberships.</p>') +
    S('mechanism', 'How it works under the hood',
      T('config', ['Setting', 'Options'], [
        ['Scope', 'All users or guests only; for tenant-wide guest reviews, all Microsoft 365 groups with guests'],
        ['Reviewers', 'Group or resource owners · selected users or groups · managers of users · users review their own access; <strong>fallback reviewers</strong> when owners or managers are missing'],
        ['Multi-stage', 'Up to three stages, each with its own reviewers; later stages can see earlier decisions'],
        ['Duration and recurrence', 'Duration in days; one-time, weekly, monthly, quarterly, semi-annually or annually'],
        ['Auto apply results', 'Denied users are removed at the end without an admin'],
        ['If reviewers don’t respond', 'No change · Remove access · Approve access · Take recommendations'],
        ['Action on denied guests', 'Remove from the resource, or block sign-in for 30 days then remove from the tenant'],
        ['Decision helpers', 'Recommendations from inactivity (no sign-in for 30 days by default) and user-to-group affiliation (ID Governance)'],
        ['Justification required, notifications, reminders', 'On by default for most']
      ]) +
      C('powershell', String.raw`
# Quarterly guest review of one group, owners review, deny by default, auto-apply
$g = Get-MgGroup -Filter "displayName eq 'Sales-Partners'"
$def = @{
    displayName = 'Quarterly guest review - Sales-Partners'
    scope = @{ '@odata.type' = '#microsoft.graph.accessReviewQueryScope'
               query = '/groups/' + $g.Id + '/transitiveMembers/microsoft.graph.user/?$count=true&$filter=(userType eq ''Guest'')'; queryType = 'MicrosoftGraph' }
    reviewers = @(@{ query = "/groups/$($g.Id)/owners"; queryType = 'MicrosoftGraph' })
    settings = @{
        mailNotificationsEnabled = $true; reminderNotificationsEnabled = $true; justificationRequiredOnApproval = $true
        defaultDecisionEnabled = $true; defaultDecision = 'Deny'; autoApplyDecisionsEnabled = $true
        recommendationsEnabled = $true; instanceDurationInDays = 14
        recurrence = @{ pattern = @{ type = 'absoluteMonthly'; interval = 3 }; range = @{ type = 'noEnd'; startDate = (Get-Date -Format 'yyyy-MM-dd') } }
    }
}
New-MgIdentityGovernanceAccessReviewDefinition -BodyParameter $def`) +
      '<h3>Monitoring</h3>' +
      '<p>Each review has an <strong>Overview</strong> (reviewed, not reviewed, approved, denied), <strong>Results</strong> per user with the reviewer and justification, and for recurring reviews a history of instances. <strong>Review history</strong> produces downloadable reports across reviews for auditors. Every decision and every applied result is also written to the audit log with the service <em>Access Reviews</em> - filter on the service, because the events are spread across the Policy, UserManagement and DirectoryManagement categories.</p>' +
      '<h3>Responding manually</h3>' +
      T('compare', ['Who', 'Action', 'Where'], [
        ['Reviewer', 'Approve, Deny or Don’t know with justification; accept recommendations in bulk; change a decision until the review ends', 'My Access &gt; Access reviews, or the email'],
        ['Administrator', 'Send reminders, <strong>stop</strong> the review early, <strong>apply results</strong> manually when auto-apply is off, reset decisions', 'The review’s blade'],
        ['Owner of a denied guest’s resource', 'Nothing - denial removes access when results are applied', '-']
      ])) +
    S('config', 'Configuration surface',
      T('config', ['Control', 'Default', 'Set it to', 'Why'], [
        ['If reviewers don’t respond', 'No change', 'Remove access for guests; take recommendations for members', 'No change means the review had no effect'],
        ['Auto apply results', 'Off', 'On for guests and low-risk groups', 'Manual application is the step that gets forgotten'],
        ['Fallback reviewers', 'None', 'A named governance team', 'Groups without owners, users without managers'],
        ['Recurrence for privileged roles', '-', 'Monthly or quarterly', 'Standing privilege is the highest risk'],
        ['Justification on approval', 'On', 'On', 'Approval without a reason is rubber-stamping'],
        ['Denied guests', 'Remove from resource', 'Block sign-in, then remove from tenant (guest-only reviews)', 'Removes the account, not just one membership']
      ])) +
    S('failure', 'Common failure modes',
      '<p><strong>Review ended, nothing changed.</strong> Auto-apply was off and nobody applied the results, or the default decision was <em>No change</em>.</p>' +
      '<p><strong>Group owner review with no reviewers.</strong> The group has no owners and no fallback reviewer.</p>' +
      '<p><strong>Denied user regains access next day.</strong> They are a member through another route - a dynamic rule, a nested group, an access package - that the review did not cover.</p>' +
      '<p><strong>Cannot review a dynamic group’s members.</strong> Removing members from dynamic groups is not possible; fix the rule or the attribute instead.</p>') +
    S('exam', 'How this is tested',
      T('exam', ['Phrase in the question', 'What it steers you to'], [
        ['"review guest access to all Microsoft 365 groups every quarter"', 'Access review scoped to guests in all Microsoft 365 groups, quarterly'],
        ['"managers must confirm their reports’ app access; if they don’t, remove it"', 'Reviewers: managers; if no response: Remove access; auto-apply'],
        ['"group owners unavailable"', 'Fallback reviewers'],
        ['"help reviewers by flagging users who have not signed in"', 'Recommendations (decision helpers)'],
        ['"review who holds the Global Administrator role"', 'Access review of Entra roles through PIM'],
        ['"provide auditors a report of all review decisions"', 'Review history'],
        ['"results were not applied automatically"', 'Apply results manually from the review'],
        ['"end the review now"', 'Stop the review']
      ])) +
    S('validation', 'Validation',
      C('kql', String.raw`
AuditLogs
| where TimeGenerated > ago(90d)
| where LoggedByService == "Access Reviews"   // a service, not a category: events land in Policy, UserManagement and DirectoryManagement
| extend Actor = coalesce(tostring(InitiatedBy.user.userPrincipalName), tostring(InitiatedBy.app.displayName))
| summarize count() by Category, OperationName, Actor
| order by count_ desc`)) +
    S('sources', 'Sources', '<ul>' + LEARNLI(this) +
      '<li>' + L('What are access reviews?', 'https://learn.microsoft.com/entra/id-governance/access-reviews-overview') + '</li>' +
      '<li>' + L('Plan a Microsoft Entra access reviews deployment', 'https://learn.microsoft.com/entra/id-governance/deploy-access-reviews') + '</li>' +
      '<li>' + L('Create an access review of groups and applications', 'https://learn.microsoft.com/entra/id-governance/create-access-review') + '</li>' +
      '<li>' + L('Complete an access review', 'https://learn.microsoft.com/entra/id-governance/complete-access-review') + '</li>' +
      '<li>' + L('Review history reports', 'https://learn.microsoft.com/entra/id-governance/access-reviews-downloadable-review-history') + '</li>' +
      '</ul>' + SRCSTAMP(this));
  },
  lab: {
    intro: 'Run one review each way - owners, managers and self - and one that nobody answers, then compare what auto-apply did.',
    steps: [
      '<p>Give <code>Sales-Partners</code> an owner (a Sales user) and add two guests to it. Set a manager on three lab users.</p>',
      '<p>Create the guest review from the module with PowerShell, then open it in the portal and compare its settings.</p>',
      '<p>Create a review of the SAML app’s assignments with <strong>managers</strong> as reviewers, you as fallback reviewer, duration 1 day, <em>If reviewers don’t respond: Remove access</em>, auto-apply on.</p>',
      '<p>Create a one-time <strong>self-review</strong> of <code>DYN-Sales</code>, and notice what the portal says about removing members of a dynamic group.</p>',
      '<p>As the group owner, open My Access &gt; Access reviews: approve one guest with justification, deny the other.</p>',
      '<p>As one manager, deny a report’s app access. Leave the other managers’ decisions empty.</p>',
      '<p>As administrator, send a reminder, then <strong>stop</strong> the guest review early and <strong>apply results</strong>. Confirm the denied guest left the group.</p>',
      '<p>After a day, check the app review: which users were removed by denial, and which by non-response? Generate a <strong>Review history</strong> report covering all three reviews.</p>'
    ],
    teardown: [
      { bucket: '1', title: 'Configuration', items: [
        'Delete the recurring guest review definition so it does not run every quarter',
        'Re-assign the app to anyone removed whom later labs need' ] },
      { bucket: '2', title: 'Verify', items: [
        'The audit query shows decisions and <em>Apply review</em> events for each review' ] }
    ]
  },
  quiz: [
    { q: 'Guest access to Microsoft 365 groups must be reviewed every quarter by group owners, and guests nobody reviews should lose access. How do you plan it?', o: ['Monthly self-review, no change on no response', 'Quarterly review of guests, owners as reviewers, fallback reviewer, if no response remove access, auto-apply', 'Annual manager review with recommendations only', 'An access package with 90-day expiry'], a: 1, obj: 0,
      why: 'Scope, reviewer, fallback, recurrence and default decision together meet the requirement; auto-apply removes access without an admin step.' },
    { q: 'Managers must review their direct reports’ access to an app. Some users have no manager. What do you configure?', o: ['Reviewers: managers, with fallback reviewers', 'Reviewers: group owners', 'Self-review', 'Multi-stage review with no reviewers'], a: 0, obj: 1,
      why: 'Fallback reviewers handle users without a manager.' },
    { q: 'You want reviewers to see a recommendation to deny users who have not signed in for 30 days. Which setting?', o: ['Justification required', 'Decision helpers / recommendations', 'Auto apply results', 'Mail notifications'], a: 1, obj: 1,
      why: 'Recommendations use inactivity (and, with ID Governance, affiliation) to suggest decisions.' },
    { q: 'Auditors need a downloadable record of decisions across all access reviews for the last year. What do you use?', o: ['Sign-in logs', 'Review history reports', 'Identity Secure Score', 'Provisioning logs'], a: 1, obj: 2,
      why: 'Review history generates downloadable reports of decisions across reviews.' },
    { q: 'A review ended but denied users still have access. Auto-apply was off. What do you do?', o: ['Restart the review', 'Apply results manually from the review', 'Delete the group', 'Wait for the next recurrence'], a: 1, obj: 3,
      why: 'When auto-apply is off, an administrator must apply results after the review ends.' },
    { q: 'Reviewers finished early and you want to act on their decisions now rather than wait for the end date. What do you do?', o: ['Stop the review, then apply results', 'Reset decisions', 'Send reminders', 'Change the recurrence'], a: 0, obj: 3,
      why: 'Stopping the review ends it immediately; results can then be applied.' }
  ]
});
