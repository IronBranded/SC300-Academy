/* ======================================================================
   04-03  Privileged Identity Management and break-glass
   ====================================================================== */
MODULES.push({
  id: '04-03', domain: '04', title: 'Privileged Identity Management and Emergency Access', short: 'PIM and Break-glass',
  group: 'Plan and implement privileged access',
  objectives: [
    'Plan and manage Microsoft Entra roles in Microsoft Entra Privileged Identity Management (PIM), including settings and assignments',
    'Plan and manage Azure resources in PIM, including settings and assignments',
    'Plan and configure PIM for Groups',
    'Manage the PIM request and approval process',
    'Analyze PIM audit history and reports',
    'Create and manage break-glass accounts'
  ],
  status: 'GA', verified: '',
  cost: { level: 'none', label: '$0', est: '$0 with P2 from the trial. Azure resource roles use the lab subscription; nothing is deployed.', meter: 'none' },
  portal: 'Entra admin center &gt; ID Governance &gt; Privileged Identity Management: Microsoft Entra roles · Groups · Azure resources · My roles · Approve requests · Alerts · Resource audit',
  ms: [{ t: "Plan and implement privileged access", u: "https://learn.microsoft.com/en-us/training/modules/plan-implement-privileged-access/" }],
  sdk: '<code>Microsoft.Graph.Identity.Governance</code> <code>Az.Resources</code>',
  kql: '<code>AuditLogs</code> (category RoleManagement) <code>SigninLogs</code>',
  prereq: ['00-01', '01-01', '02-03'],
  tactical: 'An eligible assignment is persistence that looks like good hygiene. An attacker holding Privileged Role Administrator can make an account they control <em>eligible</em> for Global Administrator with no expiry and activate it only when needed - nothing is standing, so standing-admin reports stay clean. The PIM alert <em>Roles are being assigned outside of PIM</em> catches the crude version; the quiet one needs a query on <em>Add eligible member to role</em> events whose initiator is not your provisioning process. Then look at activations: <em>Add member to role completed (PIM activation)</em> from an IP or device that account has never used.',
  body: function () { return '' +
    S('concept', 'Why this exists',
      '<p>Standing privilege is the attacker’s best friend. PIM replaces it with <strong>eligible</strong> assignments that a user <strong>activates</strong> for a limited time, with MFA or an authentication context, a justification and, optionally, approval. Every step is logged.</p>' +
      vFlow([
        { t: 'Eligible', s: 'no permissions yet; time-bound or permanent', k: 'd4' },
        { t: 'Request', s: 'justification, ticket, auth context', k: 'd2' },
        { t: 'Approval', s: 'optional; approvers notified', k: 'warn' },
        { t: 'Active', s: 'role works for 1-24 hours', k: 'ok' },
        { t: 'Expired', s: 'back to eligible, logged', k: 'd4' }
      ], 'An activation from start to finish. Each arrow is an audit event.') +
      T('compare', ['PIM covers', 'Assign', 'Typical use'], [
        ['<strong>Microsoft Entra roles</strong>', 'Directory roles at tenant or AU scope', 'Global Administrator, Exchange Administrator...'],
        ['<strong>Azure resources</strong>', 'Azure RBAC roles on management groups, subscriptions, resource groups, resources', 'Owner, User Access Administrator, Contributor'],
        ['<strong>Groups</strong> (PIM for Groups)', 'Just-in-time <em>member</em> or <em>owner</em> of a security or Microsoft 365 group', 'JIT access to whatever the group grants: roles through a role-assignable group, apps, Azure roles']
      ])) +
    S('mechanism', 'How it works under the hood',
      '<h3>Role settings</h3>' +
      '<p>Each role (per resource, for Azure) has its own settings, and they apply to every assignment of that role:</p>' +
      T('config', ['Setting', 'Options', 'Notes'], [
        ['Activation maximum duration', '1 to 24 hours', 'Set per role; keep it short for privileged roles'],
        ['On activation, require', 'None · multifactor authentication · <strong>Microsoft Entra Conditional Access authentication context</strong>', 'Reauthentication covers further activations for 10 minutes'],
        ['Require justification / ticket information', 'Yes / No', 'An information-only field; PIM does not check it against any ticketing system'],
        ['Require approval to activate', 'Yes, with approvers. Entra roles: if none are selected, <em>active</em> Privileged Role Administrators and Global Administrators approve. Azure resource roles: no default, select at least one', 'Name at least two approvers'],
        ['Allow permanent eligible assignment', 'Yes, or expire eligible assignments after a set period', 'Forces a start and end date when permanent is off'],
        ['Allow permanent active assignment', 'Yes, or expire active assignments after a set period', 'Forces a start and end date when permanent is off'],
        ['Require MFA / justification on active assignment', 'Yes / No', 'Applies when an administrator assigns the role as active'],
        ['Notifications', 'Per event: assigned eligible, assigned active, activated - to admins, requestors, approvers', 'Route them to a monitored mailbox']
      ]) +
      '<p>Using an <strong>authentication context</strong> (02-03) instead of plain MFA is the stronger design: it lets a Conditional Access policy demand phishing-resistant MFA and a fresh sign-in for activation. Scope that policy to all users or to the eligible users, <strong>never to the directory role</strong>: during activation the user does not hold the role yet, so a role-scoped policy never applies. Once satisfied, the reauthentication covers further activations for 10 minutes, across Entra roles, Azure resource roles and PIM for Groups. If no enabled policy targets the context, PIM falls back to requiring MFA - but not if the policy is off, report-only, or excludes the user.</p>' +
      C('powershell', String.raw`
# Eligible for Exchange Administrator for 180 days
$role = Get-MgRoleManagementDirectoryRoleDefinition -Filter "displayName eq 'Exchange Administrator'"
New-MgRoleManagementDirectoryRoleEligibilityScheduleRequest -Action 'adminAssign' -PrincipalId $alex.Id -RoleDefinitionId $role.Id -DirectoryScopeId '/' -Justification 'Mail migration project' -ScheduleInfo @{ StartDateTime = (Get-Date); Expiration = @{ Type = 'afterDuration'; Duration = 'P180D' } }

# Activation, as alex, for two hours
New-MgRoleManagementDirectoryRoleAssignmentScheduleRequest -Action 'selfActivate' -PrincipalId $alex.Id -RoleDefinitionId $role.Id -DirectoryScopeId '/' -Justification 'Change 4411: transport rule' -ScheduleInfo @{ StartDateTime = (Get-Date); Expiration = @{ Type = 'afterDuration'; Duration = 'PT2H' } }

# PIM for Groups: alex eligible to become a member of a group for 90 days
New-MgIdentityGovernancePrivilegedAccessGroupEligibilityScheduleRequest -AccessId 'member' -GroupId $grp.Id -PrincipalId $alex.Id -Action 'adminAssign' -Justification 'On-call rota' -ScheduleInfo @{ StartDateTime = (Get-Date); Expiration = @{ Type = 'afterDuration'; Duration = 'P90D' } }`) +
      '<h3>Azure resources</h3>' +
      '<p>In the Azure resources view you <strong>discover</strong> (onboard) a management group or subscription, then manage eligible and active assignments and role settings per role at each scope; assignments inherit downward as in Azure RBAC. Owner and User Access Administrator should never be standing. PIM for Azure resources is the same machinery as Entra roles, surfaced through <code>Az.Resources</code>:</p>' +
      C('powershell', String.raw`
$scope = "/subscriptions/$subId"
$contrib = Get-AzRoleDefinition -Name 'Contributor'
New-AzRoleEligibilityScheduleRequest -Name (New-Guid).Guid -Scope $scope -PrincipalId $alex.Id -RoleDefinitionId "$scope/providers/Microsoft.Authorization/roleDefinitions/$($contrib.Id)" -RequestType 'AdminAssign' -ScheduleInfoStartDateTime (Get-Date -Format o) -ExpirationType 'AfterDuration' -ExpirationDuration 'P90D' -Justification 'Lab'`) +
      '<h3>PIM for Groups</h3>' +
      '<p>Any security group or Microsoft 365 group (not dynamic, not synced from AD) can be managed in PIM. A user eligible for <em>membership</em> activates to join the group for a while; eligibility for <em>ownership</em> is the same for managing it. Combine it with a <strong>role-assignable group</strong> to activate several roles at once, or with a group that grants app or Azure access to make that access just-in-time. For anything privileged, use a <strong>role-assignable</strong> group: on an ordinary group, other group-management roles - Exchange Administrators for non-role-assignable Microsoft 365 groups, or administrators scoped to an administrative unit - can change membership through the groups API and override what PIM decided. Expect a delay after activation: Microsoft documents that group membership is provisioned in 2 to 10 minutes.</p>' +
      '<h3>Requests and approvals</h3>' +
      '<p>Users activate from <strong>My roles</strong> (or the Azure portal for resource roles). With approval required, the request stays <em>pending approval</em>; approvers get an email and act under <strong>Approve requests</strong>, where they see the justification and must give their own. Requestors can cancel pending requests. For Entra roles with no approvers set, active Privileged Role Administrators and Global Administrators approve. That default has a trap: if every one of them is only <em>eligible</em>, approval is required and no approvers are configured, nobody can approve and the tenant is locked out - one more reason for permanently active break-glass accounts and named approvers. Azure resource roles have no default approvers at all.</p>' +
      '<h3>Audit history and reports</h3>' +
      '<p><strong>Resource audit</strong> shows every PIM event for a resource or for all Entra roles; <strong>My audit</strong> shows your own. <strong>Alerts</strong> flag configuration risk - too many Global Administrators, roles assigned outside of PIM, roles that do not require MFA for activation, potential stale accounts in privileged roles. Access reviews of roles (04-02) close the loop. All of it is also in the Entra audit log under category <em>RoleManagement</em>.</p>' +
      '<h3>Break-glass accounts</h3>' +
      '<p>Emergency access accounts are the exception to everything above, on purpose (00-01):</p>' +
      T('compare', ['Rule', 'Why'], [
        ['At least two, cloud-only, on the <code>.onmicrosoft.com</code> domain', 'No dependency on federation, sync or a custom domain'],
        ['Global Administrator <strong>permanently active</strong>, not eligible', 'PIM activation could itself be what is broken'],
        ['Phishing-resistant method registered: passkey (FIDO2) or certificate', 'Mandatory MFA applies to admin portals whatever CA says'],
        ['Excluded from Conditional Access policies (via one group), or covered only by a policy they are designed to meet', 'A bad policy must not lock them out'],
        ['Not tied to a person’s phone or mailbox; credentials stored separately', 'People leave'],
        ['Every sign-in alerts, and the accounts are tested on a schedule', 'Unused and unwatched is how they get abused']
      ])) +
    S('config', 'Configuration surface',
      T('config', ['Control', 'Default', 'Set it to', 'Why'], [
        ['Global Administrator activation', 'Set per role', 'Authentication context (phishing-resistant), approval, 1-2 hours', 'Most sensitive role'],
        ['Permanent active assignments', 'Allowed with expiry', 'Only the break-glass accounts', 'Standing privilege'],
        ['Eligible assignment expiry', 'Set per role', '6-12 months, renewed through review or entitlement management', 'Eligibility accumulates too'],
        ['PIM alerts', 'On', 'On, with someone reading them', 'Assignments outside PIM'],
        ['Access reviews of roles', 'None', 'Quarterly for privileged roles', 'Attest eligible assignments'],
        ['Break-glass sign-in alert', 'None', 'Log Analytics alert rule (04-04)', 'Any use is an event']
      ])) +
    S('failure', 'Common failure modes',
      '<p><strong>Activation succeeds but the portal still denies.</strong> Refresh the session or sign out and in; role claims update on a new token.</p>' +
      '<p><strong>No approver responds.</strong> Approvers were set to one person on leave. Use a group of approvers.</p>' +
      '<p><strong>User cannot activate: "authentication context required".</strong> They signed in with a method the context’s CA policy does not accept.</p>' +
      '<p><strong>Authentication context never prompts on activation.</strong> The Conditional Access policy for the context is scoped to the directory role, which the user does not yet hold.</p>' +
      '<p><strong>Nobody can approve Global Administrator activation.</strong> No approvers are configured and every Privileged Role Administrator and Global Administrator is only eligible.</p>' +
      '<p><strong>Activated group membership, still no access.</strong> Membership takes 2 to 10 minutes to provision, and the app may need a new token after that.</p>' +
      '<p><strong>Group cannot be onboarded to PIM for Groups.</strong> It is dynamic or synced from on-premises.</p>' +
      '<p><strong>Break-glass account blocked at the Azure portal.</strong> It has only a password; mandatory MFA applies.</p>') +
    S('exam', 'How this is tested',
      T('exam', ['Phrase in the question', 'What it steers you to'], [
        ['"admins must request the role, for at most 2 hours, with approval"', 'PIM role settings: max duration, require approval'],
        ['"activation must require phishing-resistant MFA"', 'Require CA authentication context on activation'],
        ['"just-in-time Owner on a subscription"', 'PIM for Azure resources, eligible assignment'],
        ['"just-in-time membership of a group that grants access to an app"', 'PIM for Groups'],
        ['"activate several Entra roles at once"', 'PIM for Groups on a role-assignable group'],
        ['"who approved Alex’s activation last month"', 'PIM resource audit / audit logs'],
        ['"detect roles assigned outside PIM"', 'PIM alerts'],
        ['"ensure access if the federation service fails"', 'Break-glass accounts, cloud-only, permanently active']
      ])) +
    S('validation', 'Validation',
      C('kql', String.raw`
AuditLogs
| where TimeGenerated > ago(30d)
| where Category == "RoleManagement" and OperationName has "PIM"
| extend Actor = coalesce(tostring(InitiatedBy.user.userPrincipalName), tostring(InitiatedBy.app.displayName)),
         Target = tostring(TargetResources[0].userPrincipalName), Role = tostring(TargetResources[0].displayName)
| project TimeGenerated, OperationName, Actor, Target, Role, ResultReason
| order by TimeGenerated desc`) +
      C('powershell', String.raw`
# Who can become what: every eligible directory role assignment, with expiry
Get-MgRoleManagementDirectoryRoleEligibilitySchedule -All -ExpandProperty RoleDefinition, Principal |
    Select-Object @{ n = 'Role'; e = { $_.RoleDefinition.DisplayName } }, @{ n = 'Principal'; e = { $_.Principal.AdditionalProperties.userPrincipalName } }, @{ n = 'Expires'; e = { $_.ScheduleInfo.Expiration.EndDateTime } }`)) +
    S('sources', 'Sources', '<ul>' + LEARNLI(this) +
      '<li>' + L('What is Privileged Identity Management?', 'https://learn.microsoft.com/entra/id-governance/privileged-identity-management/pim-configure') + '</li>' +
      '<li>' + L('Configure Microsoft Entra role settings in PIM', 'https://learn.microsoft.com/entra/id-governance/privileged-identity-management/pim-how-to-change-default-settings') + '</li>' +
      '<li>' + L('PIM for Groups', 'https://learn.microsoft.com/entra/id-governance/privileged-identity-management/concept-pim-for-groups') + '</li>' +
      '<li>' + L('Approve or deny requests in PIM', 'https://learn.microsoft.com/entra/id-governance/privileged-identity-management/pim-approval-workflow') + '</li>' +
      '<li>' + L('Manage emergency access accounts', 'https://learn.microsoft.com/entra/identity/role-based-access-control/security-emergency-access') + '</li>' +
      '</ul>' + SRCSTAMP(this));
  },
  lab: {
    intro: 'Move a standing admin to eligible, require the c1 authentication context from 02-03 for activation, add approval, then do the same for an Azure role and a group - and finish by testing the break-glass accounts.',
    steps: [
      '<p>Open <strong>PIM &gt; Microsoft Entra roles &gt; Alerts</strong> and read what is flagged in your tenant.</p>',
      '<p>Make alex <strong>eligible</strong> for Exchange Administrator for 180 days with the PowerShell in the module. Remove any active assignment alex had.</p>',
      '<p>Edit the Exchange Administrator role settings: maximum activation 2 hours, require justification, <strong>require Microsoft Entra Conditional Access authentication context c1</strong>, require approval with yourself as approver.</p>',
      '<p>As alex, activate from <strong>My roles</strong>. Satisfy c1 with a passkey. As yourself, approve in <strong>Approve requests</strong>. Confirm alex can open the Exchange admin center.</p>',
      '<p>In <strong>Azure resources</strong>, discover your lab subscription, make alex eligible for <strong>Contributor</strong> on one resource group, and set the Owner role on the subscription to require approval.</p>',
      '<p>Create a security group <code>JIT-Helpdesk</code> (role-assignable) holding Helpdesk Administrator and User Administrator. In <strong>PIM &gt; Groups</strong>, make alex eligible for membership. Activate it and confirm both roles appear.</p>',
      '<p>Open <strong>Resource audit</strong> and export the history of everything you did. Run the Validation queries.</p>',
      '<p>Sign in as bg01 and bg02 with their passkeys, open the Entra admin center, and record the date. Confirm both are still permanently active Global Administrators and excluded from every CA policy.</p>'
    ],
    teardown: [
      { bucket: '1', title: 'Configuration', items: [
        'Remove alex’s eligible assignments (Exchange Administrator, Contributor, JIT-Helpdesk membership)',
        'Keep the improved role settings' ] },
      { bucket: '2', title: 'Verify', items: [
        'PIM alerts show no roles assigned outside PIM except the two break-glass accounts',
        'Both emergency accounts signed in successfully today' ] }
    ]
  },
  quiz: [
    { q: 'Global Administrators must activate the role for at most one hour, with justification and approval by the security team. Where do you configure this?', o: ['Conditional Access policy for admins', 'PIM role settings for Global Administrator', 'An access package', 'The admin consent workflow'], a: 1, obj: 0,
      why: 'Activation duration, justification and approval are PIM role settings.' },
    { q: 'Role activation must require phishing-resistant MFA, not just any MFA. What do you set in PIM?', o: ['On activation, require multifactor authentication', 'On activation, require a Conditional Access authentication context whose policy requires phishing-resistant strength', 'Require ticket information', 'Require approval'], a: 1, obj: 0,
      why: 'An authentication context lets a CA policy enforce an authentication strength at activation.' },
    { q: 'Engineers need Owner on a production subscription only during change windows. What do you use?', o: ['A custom Entra role', 'PIM for Azure resources with an eligible Owner assignment', 'An administrative unit', 'Azure Policy'], a: 1, obj: 1,
      why: 'PIM manages Azure RBAC roles as eligible assignments that engineers activate when needed.' },
    { q: 'Helpdesk staff must get three Entra roles at once, only when on call. What is the most efficient design?', o: ['Three eligible assignments per person', 'A role-assignable group holding the roles, with PIM for Groups eligibility for membership', 'A dynamic group', 'Permanent assignments reviewed monthly'], a: 1, obj: 2,
      why: 'One activation of group membership grants every role assigned to the role-assignable group.' },
    { q: 'An activation request is pending approval. Who approves if no approvers were specified in the role settings?', o: ['The requestor’s manager', 'Active Privileged Role Administrators and Global Administrators', 'Nobody; it auto-approves', 'Security Readers'], a: 1, obj: 3,
      why: 'For Entra roles, active Privileged Role Administrators and Global Administrators are the default approvers. If all of them are only eligible, nobody can approve. Azure resource roles have no default approvers.' },
    { q: 'You need to know who activated Global Administrator in the last 30 days and who approved each activation. Where do you look?', o: ['Sign-in logs', 'PIM resource audit (or the RoleManagement audit log category)', 'Identity Secure Score', 'Provisioning logs'], a: 1, obj: 4,
      why: 'PIM audit history records requests, approvals and activations, also available in the audit log.' },
    { q: 'Which PIM feature warns you that someone assigned a privileged role directly, bypassing PIM?', o: ['Access reviews', 'PIM alerts', 'Role settings', 'My audit'], a: 1, obj: 4,
      why: 'The alert "Roles are being assigned outside of Privileged Identity Management" detects this.' },
    { q: 'How should emergency access accounts hold the Global Administrator role?', o: ['Eligible in PIM with approval', 'Permanently active, cloud-only, with a phishing-resistant method registered', 'Through a role-assignable group activated in PIM', 'Only during business hours'], a: 1, obj: 5,
      why: 'They must work when PIM, MFA providers or federation are the problem, so the role is permanently active and the method must satisfy mandatory MFA.' }
  ]
});

/* ======================================================================
   04-04  Monitoring
   ====================================================================== */
MODULES.push({
  id: '04-04', domain: '04', title: 'Logs, KQL, Workbooks and Identity Secure Score', short: 'Monitoring',
  group: 'Monitor identity activity by using logs, workbooks, and reports',
  objectives: [
    'Review and analyze sign-in, audit, and provisioning logs by using the Microsoft Entra admin center',
    'Configure diagnostic settings, including configuring destinations such as Log Analytics workspaces, storage accounts, and Azure Event Hubs',
    'Monitor Microsoft Entra ID by using KQL queries in Log Analytics',
    'Analyze Microsoft Entra ID by using workbooks and reporting',
    'Monitor and improve the security posture by using Identity Secure Score'
  ],
  status: 'GA', verified: '',
  cost: { level: 'low', label: 'Low', est: 'Cents to a few dollars a month: Log Analytics ingestion for a lab tenant is tiny, one log alert rule has a small monthly charge, and the storage account costs pennies. Do not create an Event Hubs namespace.', meter: 'per GB ingested' },
  portal: 'Entra admin center &gt; Entra ID &gt; Monitoring &amp; health: Sign-in logs · Audit logs · Provisioning logs · Diagnostic settings · Workbooks · Log Analytics · Entra ID &gt; Identity Secure Score · Entra ID &gt; Overview &gt; Recommendations',
  ms: [{ t: "Monitor and maintain Microsoft Entra ID", u: "https://learn.microsoft.com/en-us/training/modules/monitor-maintain-azure-active-directory/" }],
  sdk: '<code>Az.OperationalInsights</code> <code>Az.Monitor</code>',
  kql: '<code>SigninLogs</code> <code>AADNonInteractiveUserSignInLogs</code> <code>AADServicePrincipalSignInLogs</code> <code>AADManagedIdentitySignInLogs</code> <code>AuditLogs</code> <code>AADProvisioningLogs</code> <code>MicrosoftGraphActivityLogs</code>',
  prereq: ['00-01'],
  tactical: 'Most token replay lives in the non-interactive sign-in log. An attacker replaying a stolen refresh token never produces an interactive sign-in; the evidence is <code>AADNonInteractiveUserSignInLogs</code> entries from a new IP with the same session ID as the victim’s last interactive sign-in. Pair that with <code>MicrosoftGraphActivityLogs</code>, which records what each token actually did against Graph, and you have both halves of an Entra investigation. Neither exists after the fact if diagnostic settings were not sending them somewhere - and attackers who reach Global Administrator do check, and sometimes delete, diagnostic settings.',
  body: function () { return '' +
    S('concept', 'Why this exists',
      '<p>Entra keeps its own logs for a short time: 7 days on Free, 30 days with P1 or P2. Anything longer, anything queryable across tables, anything that alerts, needs <strong>diagnostic settings</strong> sending the logs somewhere else. This module is the difference between being able to answer "what happened?" in week five and not.</p>' +
      T('compare', ['Log', 'Records', 'Where you will need it'], [
        ['Interactive user sign-ins', 'A user presenting a credential', 'Phishing, spray, MFA fatigue'],
        ['Non-interactive user sign-ins', 'Clients refreshing tokens for a user', 'Token replay, stolen refresh tokens'],
        ['Service principal sign-ins', 'Apps authenticating as themselves', 'Credential abuse on app registrations'],
        ['Managed identity sign-ins', 'Azure resources requesting tokens', 'Lateral movement from compromised compute'],
        ['Audit logs', 'Every directory change: users, groups, roles, apps, policies', 'Persistence, escalation'],
        ['Provisioning logs', 'Every create, update and delete by provisioning jobs', 'Sync and SCIM troubleshooting'],
        ['Microsoft Graph activity logs', 'Each Graph API request by user or app', 'What a stolen token did']
      ])) +
    S('mechanism', 'How it works under the hood',
      '<h3>Reading logs in the admin center</h3>' +
      '<p>A sign-in entry has tabs for basic info (including <strong>correlation ID</strong> and <strong>request ID</strong>, which support will ask for), location, device info, <strong>authentication details</strong> (each method and step), <strong>Conditional Access</strong> (each policy’s result) and <strong>Report-only</strong>. Filter by user, app, status, IP, client app, CA result or error code; add columns; download as CSV or JSON. Audit entries show the initiator, the target and the <em>modified properties</em> with old and new values. Provisioning entries show each step - import, match, action, export - so you can see why a user was skipped.</p>' +
      '<h3>Diagnostic settings</h3>' +
      T('compare', ['Destination', 'Choose it for', 'Watch out for'], [
        ['<strong>Log Analytics workspace</strong>', 'KQL, workbooks, alert rules, Microsoft Sentinel', 'Per-GB ingestion and retention cost'],
        ['<strong>Storage account</strong>', 'Cheap long-term retention, archive, legal hold', 'No querying; you restore to analyse'],
        ['<strong>Event Hubs</strong>', 'Streaming to a third-party SIEM', 'Standard namespaces bill hourly per throughput unit'],
        ['Partner solution', 'Supported partner platforms', '-']
      ]) +
      '<p>Configure under <strong>Entra ID &gt; Monitoring &amp; health &gt; Diagnostic settings</strong> (Security Administrator or Global Administrator, plus rights on the destination). Pick categories - AuditLogs, SignInLogs, NonInteractiveUserSignInLogs, ServicePrincipalSignInLogs, ManagedIdentitySignInLogs, ProvisioningLogs, RiskyUsers, UserRiskEvents, NetworkAccessTrafficLogs, MicrosoftGraphActivityLogs and others - and one or more destinations. Exporting sign-in logs needs P1 or P2. <strong>Custom security attribute audit logs</strong> are the exception to one-setting-for-everything: they are configured in their own custom security attributes section of diagnostic settings, and viewing them needs the Attribute Log Reader role.</p>' +
      C('powershell', String.raw`
$rg = 'rg-sc300-logs'; $loc = 'canadacentral'
New-AzResourceGroup -Name $rg -Location $loc
$ws = New-AzOperationalInsightsWorkspace -ResourceGroupName $rg -Name 'law-sc300' -Location $loc -Sku 'PerGB2018' -RetentionInDays 90
# Then: Entra ID > Monitoring & health > Diagnostic settings > Add diagnostic setting
#   categories: AuditLogs, SignInLogs, NonInteractiveUserSignInLogs, ServicePrincipalSignInLogs,
#               ManagedIdentitySignInLogs, ProvisioningLogs, RiskyUsers, UserRiskEvents, MicrosoftGraphActivityLogs
#   destination: law-sc300 (and a storage account for long retention)`) +
      '<h3>KQL for Entra</h3>' +
      C('kql', String.raw`
// Password spray: one IP, many users, bad password (50126).
// 53003 = correct password stopped by Conditional Access: treat those accounts as compromised.
SigninLogs
| where TimeGenerated > ago(1d)
| summarize Users = dcount(UserPrincipalName), Failures = countif(ResultType == 50126),
            ValidButBlocked = dcountif(UserPrincipalName, ResultType == 53003), Successes = countif(ResultType == 0) by IPAddress
| where Users > 10 and Failures > 20
| order by ValidButBlocked desc, Users desc`) +
      C('kql', String.raw`
// Legacy authentication still in use, by user and protocol
SigninLogs
| where TimeGenerated > ago(7d)
| where ClientAppUsed in ("Exchange ActiveSync", "IMAP4", "POP3", "Authenticated SMTP", "Other clients")
| summarize count() by UserPrincipalName, ClientAppUsed, ResultType`) +
      C('kql', String.raw`
// Break-glass sign-in: use this as a log search alert rule, 5-minute frequency
SigninLogs
| where UserPrincipalName in~ ("bg01@contoso.onmicrosoft.com", "bg02@contoso.onmicrosoft.com")
| project TimeGenerated, UserPrincipalName, IPAddress, AppDisplayName, ResultType`) +
      C('kql', String.raw`
// Token replay lead: non-interactive refreshes from an IP never used interactively by that user
let interactive = SigninLogs | where TimeGenerated > ago(14d) and ResultType == 0 | distinct UserPrincipalName, IPAddress;
AADNonInteractiveUserSignInLogs
| where TimeGenerated > ago(1d) and ResultType == 0
| join kind=leftanti interactive on UserPrincipalName, IPAddress
| summarize Refreshes = count(), Apps = make_set(AppDisplayName) by UserPrincipalName, IPAddress, SessionId`) +
      '<h3>Workbooks and reports</h3>' +
      '<p>Workbooks under <strong>Monitoring &amp; health &gt; Workbooks</strong> run on the Log Analytics data from your diagnostic settings: <em>Conditional Access insights and reporting</em>, <em>Sign-ins using legacy authentication</em>, <em>Sensitive operations report</em>, <em>Cross-tenant access activity</em>, <em>Authentication prompts analysis</em>, <em>Provisioning analysis</em> and others; each can be copied and edited. <strong>Usage &amp; insights</strong> reports (authentication methods activity, application sign-ins, AD FS application activity) work without Log Analytics.</p>' +
      '<h3>Identity Secure Score</h3>' +
      '<p>Identity Secure Score is a percentage showing how closely your configuration follows Microsoft’s identity recommendations. It is available to free and paid tenants, recalculated every 24 hours, and shown at <strong>Entra ID &gt; Identity Secure Score</strong> (the dashboard and trend) and <strong>Entra ID &gt; Overview &gt; Recommendations</strong>. Global Reader can view it; partially met recommendations earn partial points. Each recommendation - require MFA for administrative roles, block legacy authentication, protect all users with user and sign-in risk policies, enable password hash sync, restrict user consent, use least privileged roles, have more than one Global Administrator, enable SSPR - lists the affected objects and the steps to fix it. You can mark a recommendation as <em>risk accepted</em> or addressed by a third party; the score counts only what Microsoft can observe. The same identity actions appear in <strong>Microsoft Secure Score</strong> in the Defender portal.</p>') +
    S('config', 'Configuration surface',
      T('config', ['Control', 'Default', 'Set it to', 'Why'], [
        ['Diagnostic settings', 'None', 'All sign-in categories, audit, provisioning, risk and Graph activity to Log Analytics', 'Nothing exists after 30 days otherwise'],
        ['Long-term copy', 'None', 'Storage account with a retention or immutability policy', 'Investigations start months after the fact'],
        ['Workspace retention', '30 days interactive (varies)', '90 days or more', 'Cost versus how far back you can look'],
        ['Alert rules', 'None', 'Break-glass sign-in, new Global Administrator, diagnostic setting changes', 'Logs nobody reads are not monitoring'],
        ['Event Hubs', '-', 'Only if a third-party SIEM needs streaming', 'Hourly cost'],
        ['Identity Secure Score', 'Visible', 'Reviewed monthly, with owners per recommendation', 'Trend matters more than the number']
      ])) +
    S('failure', 'Common failure modes',
      '<p><strong><code>SigninLogs</code> table missing.</strong> The diagnostic setting has no sign-in category, the tenant lacks P1/P2, or data has not arrived yet (first data can take minutes to an hour).</p>' +
      '<p><strong>Queries find interactive sign-ins only.</strong> Non-interactive and service principal sign-ins are separate categories and tables.</p>' +
      '<p><strong>Workbook shows nothing.</strong> It queries a workspace that does not receive Entra logs, or the wrong workspace is selected at the top of the workbook.</p>' +
      '<p><strong>Score did not change after a fix.</strong> The score is recalculated every 24 hours, not instantly.</p>' +
      '<p><strong>Unexpected bill.</strong> An Event Hubs namespace was created "for later", or Sentinel was enabled on the workspace.</p>') +
    S('exam', 'How this is tested',
      T('exam', ['Phrase in the question', 'What it steers you to'], [
        ['"keep sign-in logs for two years at the lowest cost"', 'Diagnostic setting to a storage account'],
        ['"query sign-ins with KQL and create alerts"', 'Diagnostic setting to a Log Analytics workspace'],
        ['"stream logs to a third-party SIEM"', 'Event Hubs'],
        ['"why was a user not provisioned to the SaaS app"', 'Provisioning logs'],
        ['"who changed the Conditional Access policy"', 'Audit logs'],
        ['"which apps still use legacy authentication"', 'Legacy authentication workbook, or KQL on ClientAppUsed'],
        ['"impact of Conditional Access policies over time"', 'Conditional Access insights and reporting workbook'],
        ['"measure and improve identity posture against Microsoft recommendations"', 'Identity Secure Score'],
        ['"support asks for the correlation ID"', 'Sign-in log entry, basic info']
      ])) +
    S('validation', 'Validation',
      C('kql', String.raw`
// Is every expected table arriving? One row per table with the newest record
union withsource = Table SigninLogs, AADNonInteractiveUserSignInLogs, AADServicePrincipalSignInLogs, AADManagedIdentitySignInLogs, AuditLogs, AADProvisioningLogs, MicrosoftGraphActivityLogs
| summarize Newest = max(TimeGenerated), Rows = count() by Table`)) +
    S('sources', 'Sources', '<ul>' + LEARNLI(this) +
      '<li>' + L('Sign-in logs', 'https://learn.microsoft.com/entra/identity/monitoring-health/concept-sign-ins') + '</li>' +
      '<li>' + L('Configure Microsoft Entra diagnostic settings', 'https://learn.microsoft.com/entra/identity/monitoring-health/howto-configure-diagnostic-settings') + '</li>' +
      '<li>' + L('Analyze Entra activity logs with Log Analytics', 'https://learn.microsoft.com/entra/identity/monitoring-health/howto-analyze-activity-logs-log-analytics') + '</li>' +
      '<li>' + L('Microsoft Entra workbooks', 'https://learn.microsoft.com/entra/identity/monitoring-health/overview-workbooks') + '</li>' +
      '<li>' + L('Microsoft Graph activity logs', 'https://learn.microsoft.com/graph/microsoft-graph-activity-logs-overview') + '</li>' +
      '<li>' + L('Identity Secure Score', 'https://learn.microsoft.com/entra/identity/monitoring-health/concept-identity-secure-score') + '</li>' +
      '</ul>' + SRCSTAMP(this));
  },
  lab: {
    intro: 'Do this lab early - ideally straight after 00-01 - so every later lab leaves data you can query. The steps below assume earlier labs have generated some activity.',
    steps: [
      '<p>In the admin center, open a failed sign-in from an earlier lab. Read every tab, then copy its correlation ID. Filter the sign-in log by error code 53003 and by client app <em>Other clients</em>.</p>',
      '<p>Open <strong>Audit logs</strong>, filter category <em>Policy</em> or <em>RoleManagement</em>, and find a change you made. Read the modified properties.</p>',
      '<p>Open <strong>Provisioning logs</strong> and find a cross-tenant sync or SCIM action from 01-03 or 03-02. Read the steps.</p>',
      '<p>Create the Log Analytics workspace and a storage account. Add a diagnostic setting sending all sign-in categories, audit, provisioning, risk and Microsoft Graph activity logs to both.</p>',
      '<p>After data arrives, run the Validation query, then the spray, legacy authentication and token replay queries from the module.</p>',
      '<p>Create a <strong>log search alert rule</strong> on the break-glass query with an email action. Sign in as bg01 and wait for the email.</p>',
      '<p>Open the <em>Conditional Access insights and reporting</em> and <em>Sign-ins using legacy authentication</em> workbooks against your workspace.</p>',
      '<p>Open <strong>Entra ID &gt; Identity Secure Score</strong>, read your score and the three lowest-scoring recommendations. Fix one (for example, enable SSPR for all users) and check again tomorrow.</p>'
    ],
    teardown: [
      { bucket: '1', title: 'Keep while studying', items: [
        'Keep the workspace and diagnostic setting until the end of the guide - every other lab benefits' ] },
      { bucket: '2', title: 'At the end of the guide', items: [
        'Delete the diagnostic setting first, then <code>Remove-AzResourceGroup -Name rg-sc300-logs -Force</code>',
        'Delete the alert rule' ] },
      { bucket: '3', title: 'Verify', items: [
        'No Event Hubs namespace exists in the subscription',
        '<strong>Check Cost Management tomorrow, not today.</strong>' ] }
    ]
  },
  quiz: [
    { q: 'A user cannot reach an app and support asks for identifiers to trace the request. Where do you find the correlation ID?', o: ['Audit logs', 'The sign-in log entry’s basic info', 'Provisioning logs', 'Identity Secure Score'], a: 1, obj: 0,
      why: 'Each sign-in record includes a correlation ID and request ID in its basic info.' },
    { q: 'A user was not created in a SaaS app by automatic provisioning. Which log shows why?', o: ['Sign-in logs', 'Provisioning logs', 'Audit logs', 'Graph activity logs'], a: 1, obj: 0,
      why: 'Provisioning logs record each provisioning step and the reason an object was skipped or failed.' },
    { q: 'Sign-in logs must be kept for three years at the lowest cost; they rarely need querying. Which destination?', o: ['Log Analytics with 3-year retention', 'A storage account', 'Event Hubs', 'The Entra admin center'], a: 1, obj: 1,
      why: 'Storage accounts are the cheapest long-term destination; Log Analytics costs more for querying capability.' },
    { q: 'Logs must be streamed in near real time to a third-party SIEM. Which destination?', o: ['Storage account', 'Event Hubs', 'Log Analytics', 'Email'], a: 1, obj: 1,
      why: 'Event Hubs is the streaming destination for external SIEMs.' },
    { q: 'You want to find IP addresses that failed sign-ins for many different users in the last day. What do you use?', o: ['A KQL query on SigninLogs in Log Analytics', 'Identity Secure Score', 'Access reviews', 'The Usage & insights report'], a: 0, obj: 2,
      why: 'Aggregating failures by IP across users is a KQL query over SigninLogs.' },
    { q: 'An attacker is replaying a stolen refresh token. Which table is most likely to show it?', o: ['SigninLogs', 'AADNonInteractiveUserSignInLogs', 'AuditLogs', 'AADProvisioningLogs'], a: 1, obj: 2,
      why: 'Token refreshes are non-interactive sign-ins and land in the non-interactive table.' },
    { q: 'You need a ready-made view of how Conditional Access policies affected sign-ins over the last month. What do you use?', o: ['Conditional Access insights and reporting workbook', 'What If tool', 'Identity Secure Score', 'Audit logs'], a: 0, obj: 3,
      why: 'The workbook summarises policy impact over time from Log Analytics data.' },
    { q: 'Management wants a single measure of identity posture against Microsoft’s recommendations, with actions to improve it. What do you use?', o: ['Identity Secure Score', 'The sign-ins workbook', 'Azure Advisor', 'PIM alerts'], a: 0, obj: 4,
      why: 'Identity Secure Score measures implementation of identity recommendations and lists improvement actions.' }
  ]
});
