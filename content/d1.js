/* ======================================================================
   00-01  Lab tenant
   ====================================================================== */
MODULES.push({
  id: '00-01', domain: '00', title: 'Lab Tenant, Licences and Emergency Access', short: 'Lab Tenant',
  group: 'Not an exam objective: the tenant every lab in this guide reuses',
  objectives: [],
  status: 'GA', verified: '',
  cost: { level: 'none', label: '$0', est: '$0 for 30 days of trial licences. From 01-04 you also need an Azure subscription in the same tenant, with a budget on it.', meter: 'none · licences on trial' },
  portal: 'entra.microsoft.com · admin.microsoft.com &gt; Billing · Azure portal &gt; Cost Management',
  ms: [{ t: "Explore identity in Microsoft Entra ID", u: "https://learn.microsoft.com/training/modules/explore-identity-azure-active-directory" }],
  sdk: '<code>Microsoft.Graph</code> <code>Microsoft.Entra</code> <code>Az</code>',
  kql: '<code>SigninLogs</code> <code>AuditLogs</code>',
  prereq: [],
  tactical: 'A lab tenant is a test tenant, and test tenants are where real intrusions start. Microsoft’s own January 2024 disclosure describes Midnight Blizzard password-spraying a legacy, non-production test tenant account that had no MFA, then abusing a legacy test OAuth application that held elevated access into the corporate tenant. Everything in this guide assumes the lab tenant is disposable and never trusted by anything that matters: no apps consented into your work tenant, no guests from it, MFA on every account including the emergency ones.',
  body: function () { return '' +
    S('concept', 'Why this exists',
      '<p>SC-300 is an administration exam, and every objective is something you configure. That needs four things: a tenant you are allowed to break, licences that unlock the premium features, an Azure subscription attached to the same tenant, and a guaranteed way back in when you lock yourself out. The last one comes first.</p>' +
      '<p>Never run these labs in a production tenant, and never in your employer’s. Half the modules change tenant-wide settings, and several of them - Conditional Access, authentication methods, cross-tenant access - can lock out every user if they are wrong.</p>' +
      T('compare', ['Route', 'What it gives you', 'The catch'], [
        ['Microsoft 365 E5 trial', 'Entra ID P2, Defender for Cloud Apps, Intune, Exchange Online and SharePoint for 25 users, 30 days', 'Needs a payment method; recurring billing is on unless you turn it off'],
        ['Microsoft Entra Suite trial', 'Private Access, Internet Access, ID Governance, ID Protection', 'Needed only for 02-05 and some governance features; start it when you get there'],
        ['Entra ID P2 trial', 'P2 features only', 'No Microsoft 365 workloads, so 03-04 and the Exchange and SharePoint session controls do not work'],
        ['Microsoft 365 Developer Program', 'An E5 sandbox, renewable', 'Eligibility-based since 2024: joining the programme does not guarantee a sandbox'],
        ['A partner or employer demo tenant', 'Varies', 'Time-limited and shared rules; check what you may change']
      ]) +
      Q('warn', '<strong>Licences are per user.</strong> Starting a trial does not license anyone. PIM, access reviews and risk-based policies are visible in the portal but refuse to work until the signed-in administrator, and the users in scope, hold a P2 licence.')) +
    S('mechanism', 'How it works under the hood',
      '<p>A tenant is one Microsoft Entra directory with a permanent initial domain, <code>&lt;name&gt;.onmicrosoft.com</code>. An Azure subscription trusts exactly one tenant for its identities, which is why the subscription for this guide must be created in, or moved to, the lab tenant: managed identities, PIM for Azure resources and Log Analytics all depend on it.</p>' +
      '<p>Microsoft now enforces MFA for sign-in to the Azure portal, the Microsoft Entra admin center and the Intune admin center, and has extended enforcement to Azure CLI, Azure PowerShell and other Azure Resource Manager clients. Conditional Access cannot exempt anyone from it. That is the reason emergency access accounts need a phishing-resistant method registered before you need them, not a long password in a safe.</p>' +
      C('powershell', String.raw`
Install-Module Microsoft.Graph -Scope CurrentUser
Install-Module Microsoft.Entra -Scope CurrentUser    # optional: friendlier cmdlets on the same SDK

Connect-MgGraph -Scopes 'User.ReadWrite.All', 'RoleManagement.ReadWrite.Directory', 'Group.ReadWrite.All', 'Directory.Read.All', 'AuditLog.Read.All'
Get-MgContext | Select-Object TenantId, Account      # check this before every lab

$initial = (Get-MgOrganization).VerifiedDomains | Where-Object IsInitial

# Two cloud-only emergency accounts, permanent active Global Administrator.
# 62e90394-69f5-4237-9190-012177145e10 is the Global Administrator role template ID.
$exclude = New-MgGroup -DisplayName 'CA-Exclude-EmergencyAccess' -MailEnabled:$false -MailNickname 'caexclude' -SecurityEnabled:$true
foreach ($n in 'bg01', 'bg02') {
    $u = @{
        DisplayName       = "Emergency access $n"
        UserPrincipalName = "$n@$($initial.Name)"
        MailNickname      = $n
        AccountEnabled    = $true
        PasswordProfile   = @{ Password = (New-Guid).Guid + (New-Guid).Guid; ForceChangePasswordNextSignIn = $false }
    }
    $user = New-MgUser @u
    New-MgRoleManagementDirectoryRoleAssignment -PrincipalId $user.Id -RoleDefinitionId '62e90394-69f5-4237-9190-012177145e10' -DirectoryScopeId '/'
    New-MgGroupMemberByRef -GroupId $exclude.Id -OdataId ('https://graph.microsoft.com/v1.0/directoryObjects/' + $user.Id)
}`)) +
    S('config', 'Configuration surface',
      T('config', ['Control', 'Default', 'Set it to', 'Why'], [
        ['Security defaults', 'On for new tenants', 'On until 02-02, then off', 'Security defaults and Conditional Access cannot both be on; turn it off only when a CA baseline replaces it'],
        ['Trial recurring billing', 'On when a card is on file', '<strong>Off</strong>', 'Otherwise the trial converts to paid seats'],
        ['Restrict non-admin users from creating tenants', 'No', 'Yes', 'Every user can otherwise create tenants you do not govern'],
        ['Emergency access accounts', 'None', 'Two, cloud-only, on the .onmicrosoft.com domain, passkey or certificate registered', 'Survive federation, sync and CA mistakes'],
        ['CA exclusion group for emergency accounts', 'None', 'One group, excluded from every policy', 'One place to check, one place to audit'],
        ['Sign-in log retention', '7 days (Free), 30 days (P1/P2)', 'Send to Log Analytics in 04-04', 'Investigations outlive 30 days'],
        ['Azure budget', 'None', 'Small monthly amount, alerts at 50/80/100%', 'Alerts only; it never stops spend']
      ])) +
    S('failure', 'Common failure modes',
      '<p><strong>The lab ran in the wrong tenant.</strong> Graph PowerShell, the portal and Azure CLI each remember their own tenant. <code>Get-MgContext</code>, the tenant name in the portal header and <code>az account show</code> must agree before anything that writes.</p>' +
      '<p><strong>The emergency account has only a password.</strong> Mandatory MFA blocks it at the Azure portal and admin centers regardless of Conditional Access. Register a FIDO2 key or passkey for each account and prove it works.</p>' +
      '<p><strong>A feature says it needs P2 though the trial is active.</strong> The trial added licences to the tenant; nobody holds one. Assign them.</p>' +
      '<p><strong>New Conditional Access policy is greyed out.</strong> Security defaults is still on.</p>') +
    S('exam', 'How this is tested',
      T('exam', ['Phrase in the question', 'What it steers you to'], [
        ['"risk-based policy", "PIM", "access reviews", "risky users"', 'Microsoft Entra ID P2 (or ID Governance for newer governance features)'],
        ['"Conditional Access", "dynamic groups", "group-based licensing", "Application Proxy"', 'Microsoft Entra ID P1'],
        ['"Private Access", "Internet Access" for all traffic', 'Entra Private Access / Internet Access, or Microsoft Entra Suite'],
        ['"Conditional Access for service principals"', 'Workload Identities Premium'],
        ['"always be able to regain administrative access"', 'Emergency access (break-glass) accounts'],
        ['"baseline MFA with no Conditional Access licence"', 'Security defaults']
      ]) +
      Q('exam', '<strong>Not an exam domain.</strong> Licence-to-feature mapping, however, sits inside many Domain 2 and 4 questions as the deciding detail.')) +
    S('validation', 'Validation',
      C('powershell', String.raw`
# What the tenant owns, and how much of it is assigned
Get-MgSubscribedSku | Select-Object SkuPartNumber, ConsumedUnits, @{ n = 'Enabled'; e = { $_.PrepaidUnits.Enabled } }

# Both emergency accounts hold Global Administrator directly (not via PIM)
Get-MgRoleManagementDirectoryRoleAssignment -Filter "roleDefinitionId eq '62e90394-69f5-4237-9190-012177145e10'" -ExpandProperty Principal |
    Select-Object PrincipalId, @{ n = 'UPN'; e = { $_.Principal.AdditionalProperties.userPrincipalName } }`) +
      C('kql', String.raw`
// Every emergency-account sign-in. In 04-04 this becomes an alert rule.
SigninLogs
| where TimeGenerated > ago(30d)
| where UserPrincipalName startswith "bg0"
| project TimeGenerated, UserPrincipalName, IPAddress, AppDisplayName, ResultType, AuthenticationRequirement`)) +
    S('sources', 'Sources', '<ul>' + LEARNLI(this) +
      '<li>' + L('Manage emergency access admin accounts', 'https://learn.microsoft.com/entra/identity/role-based-access-control/security-emergency-access') + '</li>' +
      '<li>' + L('Mandatory multifactor authentication for Azure and admin portals', 'https://learn.microsoft.com/entra/identity/authentication/concept-mandatory-multifactor-authentication') + '</li>' +
      '<li>' + L('Microsoft Entra licensing', 'https://learn.microsoft.com/entra/fundamentals/licensing') + '</li>' +
      '<li>' + L('Install the Microsoft Graph PowerShell SDK', 'https://learn.microsoft.com/powershell/microsoftgraph/installation') + '</li>' +
      '<li>' + L('MSRC: Microsoft actions following attack by Midnight Blizzard', 'https://msrc.microsoft.com/blog/2024/01/microsoft-actions-following-attack-by-nation-state-actor-midnight-blizzard/') + '</li>' +
      '<li>' + L('Microsoft Threat Intelligence: Midnight Blizzard guidance for responders', 'https://www.microsoft.com/en-us/security/blog/2024/01/25/midnight-blizzard-guidance-for-responders-on-nation-state-attack/') + '</li>' +
      '</ul>' + SRCSTAMP(this));
  },
  lab: {
    intro: 'Build the tenant once. Every later lab assumes two working emergency accounts in <code>CA-Exclude-EmergencyAccess</code>, P2-level licences on your admin account, and an Azure subscription in the same tenant.',
    steps: [
      '<p>Create a new tenant by signing up for the <strong>Microsoft 365 E5 trial</strong> with a new organisation name. Record the tenant ID and the <code>.onmicrosoft.com</code> domain. Use a separate browser profile for this tenant from now on.</p>',
      '<p>In the Microsoft 365 admin center, open <strong>Billing &gt; Your products</strong>, select the trial and turn <strong>recurring billing off</strong>.</p>',
      '<p>Assign the E5 licence to your admin account. Set a usage location first - licence assignment fails without one.</p>',
      '<p>Install the Graph PowerShell SDK, connect, and confirm <code>Get-MgContext</code> shows the lab tenant ID. Run the emergency-account script from the module.</p>',
      '<p>Sign in as <code>bg01</code> in a private window, open <strong>My Sign-ins &gt; Security info</strong> and register a FIDO2 security key or a passkey. Repeat for <code>bg02</code> with a different authenticator. Store the passwords offline, separately from the keys.</p>',
      '<p>Create or move an Azure subscription into this tenant. Add a budget with alerts at 50, 80 and 100 percent.</p>',
      '<p>In <strong>Entra ID &gt; Users &gt; User settings</strong>, set <em>Restrict non-admin users from creating tenants</em> to <strong>Yes</strong>.</p>',
      '<p>Sign in once with each emergency account, then find both sign-ins under <strong>Entra ID &gt; Monitoring &amp; health &gt; Sign-in logs</strong>. Note the authentication method recorded.</p>'
    ],
    teardown: [
      { bucket: '1', title: 'At the end of the guide only', items: [
        'Delete every Azure resource group the guide created, then cancel the subscription',
        'Cancel the trials in the Microsoft 365 admin center' ] },
      { bucket: '2', title: 'Tenant deletion (optional)', items: [
        'Remove subscriptions, enterprise applications and users other than yourself, then use <strong>Entra ID &gt; Overview &gt; Manage tenants &gt; Delete</strong>' ] },
      { bucket: '3', title: 'Verify', items: [
        'Both emergency accounts signed in successfully with a phishing-resistant method at least once',
        '<strong>Check the billing page again in two days.</strong> Trial conversions do not show immediately.' ] }
    ]
  },
  quiz: [
    { q: 'You try to create your first Conditional Access policy in a new tenant and the option is unavailable. What is the most likely cause?', o: ['The tenant has no P2 licences', 'Security defaults is enabled', 'You are not a Global Administrator', 'The tenant has no verified custom domain'], a: 1, obj: -1,
      why: 'Security defaults and Conditional Access are mutually exclusive. Conditional Access needs P1, and Conditional Access Administrator is enough to create policies.' },
    { q: 'An E5 trial is active, but PIM reports that you need a Microsoft Entra ID P2 licence. What fixes it?', o: ['Wait 24 hours for the trial to propagate', 'Assign a licence that includes P2 to your account', 'Enable security defaults', 'Buy a separate PIM add-on'], a: 1, obj: -1,
      why: 'Licences are assigned per user. The trial made licences available to the tenant; nobody holds one until you assign it.' },
    { q: 'Which design is correct for an emergency access account?', o: ['Synced from AD with a 30-character password', 'Cloud-only on the .onmicrosoft.com domain, excluded from Conditional Access, with a phishing-resistant method registered', 'An eligible Global Administrator assignment in PIM', 'A guest account from a partner tenant'], a: 1, obj: -1,
      why: 'It must not depend on federation, sync, PIM activation or a partner tenant, and mandatory MFA means it needs a method that works when everything else has failed.' },
    { q: 'Which licence is the minimum for risk-based Conditional Access policies?', o: ['Microsoft Entra ID Free', 'Microsoft Entra ID P1', 'Microsoft Entra ID P2', 'Workload Identities Premium'], a: 2, obj: -1,
      why: 'Sign-in risk and user risk conditions come from ID Protection, which is a P2 capability. Workload Identities Premium is for risk on service principals.' }
  ]
});

/* ======================================================================
   01-01  Tenant, roles and administrative units
   ====================================================================== */
MODULES.push({
  id: '01-01', domain: '01', title: 'Tenant Configuration, Roles and Administrative Units', short: 'Tenant and Roles',
  group: 'Configure and manage a Microsoft Entra tenant',
  objectives: [
    'Configure and manage built-in and custom Microsoft Entra roles',
    'Recommend when to use administrative units',
    'Configure and manage administrative units',
    'Evaluate effective permissions for Microsoft Entra roles',
    'Configure and manage domains in Microsoft Entra ID and Microsoft 365',
    'Configure Company branding settings',
    'Configure tenant properties, user settings, group settings, and device settings'
  ],
  status: 'GA', verified: '',
  cost: { level: 'none', label: '$0', est: '$0. Directory configuration only. A custom domain is optional and uses one you already own.', meter: 'none' },
  portal: 'Entra admin center &gt; Entra ID &gt; Roles &amp; admins · Administrative units · Domain names · Company branding · User settings · Devices',
  ms: [{ t: "Implement initial configuration of Microsoft Entra ID", u: "https://learn.microsoft.com/en-us/training/modules/implement-initial-configuration-of-azure-active-directory/" }],
  sdk: '<code>Microsoft.Graph.Identity.DirectoryManagement</code> <code>Microsoft.Graph.Identity.Governance</code>',
  kql: '<code>AuditLogs</code>',
  prereq: ['00-01'],
  tactical: 'Two audit events deserve a standing alert in any tenant. <em>Add member to role</em> for Global Administrator or Privileged Role Administrator is the classic escalation. <em>Set domain authentication</em> and <em>Set federation settings on domain</em> are quieter and worse: converting a domain to federated, or adding a signing certificate to an existing federation, lets whoever holds the key mint tokens for any user on that domain - the technique Microsoft documented in the 2020-21 NOBELIUM investigations. A role assignment can be removed; forged tokens leave no sign-in at your IdP.',
  body: function () { return '' +
    S('concept', 'Why this exists',
      '<p>A Microsoft Entra role is a set of permissions. An assignment gives that set to a principal - a user, a role-assignable group or a service principal - <strong>at a scope</strong>. Almost every exam question in this objective group is really about the scope.</p>' +
      T('compare', ['Scope', 'Written as', 'Typical use'], [
        ['Tenant', '<code>/</code>', 'Global Reader, Security Administrator, anything tenant-wide'],
        ['Administrative unit', '<code>/administrativeUnits/{id}</code>', 'Helpdesk for one office, one country, one subsidiary'],
        ['Single resource', '<code>/{objectId}</code> of an app registration', 'Let one person manage one application’s credentials']
      ]) +
      '<p><strong>Administrative units</strong> exist because roles are otherwise all-or-nothing. User Administrator at tenant scope can reset the password of every non-admin in the company; the same role scoped to <em>AU-Quebec</em> can reset only the users in that unit. Use an AU when the requirement names a subset of users, groups or devices by location, department or business unit. Use a <strong>restricted management AU</strong> when the requirement is the opposite - protect a subset (executives, sensitive accounts) from tenant-level administrators, so that only admins assigned at that AU’s scope can change its members.</p>' +
      Q('warn', '<strong>Adding a group to an AU does not add its members.</strong> The group object comes into scope, so a scoped Groups Administrator can manage the group. Its members stay out of scope unless they are added to the AU themselves.')) +
    S('mechanism', 'How it works under the hood',
      '<h3>Built-in roles worth knowing by name</h3>' +
      T('compare', ['Role', 'Can', 'Cannot'], [
        ['Global Administrator', 'Everything, including elevating to User Access Administrator at the Azure root', '-'],
        ['Privileged Role Administrator', 'Manage every role assignment and PIM settings', 'Change most other settings'],
        ['Privileged Authentication Administrator', 'Reset passwords and authentication methods for <strong>any</strong> user, admins included', 'Assign roles'],
        ['Authentication Administrator', 'Reset methods for non-admins and some limited admins', 'Touch Global Administrators'],
        ['User Administrator', 'Create and manage users and groups, reset passwords for non-admins', 'Manage privileged admins’ credentials'],
        ['Helpdesk Administrator', 'Reset passwords for non-admins and other helpdesk admins', 'Create users'],
        ['Groups Administrator', 'All group settings, including naming and expiration policies', 'Manage users'],
        ['Global Reader', 'Read everything a Global Administrator can see', 'Change anything']
      ]) +
      '<p><strong>Custom roles</strong> (P1) are built only from Microsoft’s published list of Entra permissions, such as <code>microsoft.directory/applications/credentials/update</code>. App registration and enterprise application permissions are the mature set; you cannot invent permissions or add Azure actions. A custom role can be assigned at tenant, AU or single-app scope.</p>' +
      '<p><strong>Effective permissions</strong> are the union of every assignment that applies: direct, through role-assignable groups, active, and - once activated - eligible. There is no deny. A role-assignable group must be created with <code>isAssignableToRole</code> set; it cannot be changed later, it cannot be dynamic, and only Privileged Role Administrators and Global Administrators can manage its membership. Azure RBAC is a separate system: a Global Administrator has no Azure rights until they use <em>Access management for Azure resources</em> to elevate.</p>' +
      C('powershell', String.raw`
# A custom role that can rotate app credentials and nothing else
$perm = @{ AllowedResourceActions = @(
    'microsoft.directory/applications/allProperties/read',
    'microsoft.directory/applications/credentials/update') }
$rotator = New-MgRoleManagementDirectoryRoleDefinition -DisplayName 'App Credential Rotator' -Description 'Rotate secrets and certificates on app registrations' -RolePermissions @($perm) -IsEnabled:$true

# A dynamic administrative unit and a scoped Helpdesk Administrator
$au = New-MgDirectoryAdministrativeUnit -BodyParameter @{
    displayName                   = 'AU-Quebec'
    membershipType                = 'Dynamic'
    membershipRule                = '(user.state -eq "QC")'
    membershipRuleProcessingState = 'On'
}
$helpdesk = Get-MgRoleManagementDirectoryRoleDefinition -Filter "displayName eq 'Helpdesk Administrator'"
New-MgRoleManagementDirectoryRoleAssignment -PrincipalId $alex.Id -RoleDefinitionId $helpdesk.Id -DirectoryScopeId "/administrativeUnits/$($au.Id)"

# A restricted management AU - the flag is set at creation
New-MgDirectoryAdministrativeUnit -BodyParameter @{ displayName = 'AU-Executives'; isMemberManagementRestricted = $true }

# A role scoped to one application object
New-MgRoleManagementDirectoryRoleAssignment -PrincipalId $dev.Id -RoleDefinitionId $rotator.Id -DirectoryScopeId "/$($app.Id)"`) +
      '<h3>Domains</h3>' +
      '<p>Add a custom domain, publish the TXT (or MX) record Entra gives you, then verify. Only verified domains can be UPN suffixes. A domain is <strong>managed</strong> (Entra checks the password, possibly via PTA) or <strong>federated</strong> (another IdP does). You cannot remove a domain that users, groups or apps still reference, and you can never remove the initial <code>.onmicrosoft.com</code> domain. Adding the domain in the Microsoft 365 admin center adds the Exchange, Teams and autodiscover records on top of verification.</p>' +
      C('powershell', String.raw`
New-MgDomain -Id 'lab.contoso.ca'
Get-MgDomainVerificationDnsRecord -DomainId 'lab.contoso.ca' | Where-Object RecordType -eq 'Txt' | Select-Object Label, Text, Ttl
Confirm-MgDomain -DomainId 'lab.contoso.ca'           # after the TXT record resolves
Update-MgDomain -DomainId 'lab.contoso.ca' -IsDefault:$true`)) +
    S('config', 'Configuration surface',
      T('config', ['Setting', 'Where', 'Default', 'What to know'], [
        ['Company branding', 'Entra ID &gt; Company branding', 'Microsoft default', 'Default plus per-language overrides: background, logo, sign-in text, username hint, SSPR link, custom CSS. Needs P1/P2 (Office 365 covers Office sign-in). Phishing kits copy it, so it is not a phishing control'],
        ['Tenant properties', 'Entra ID &gt; Overview &gt; Properties', '-', 'Name, technical contact, privacy statement URL; country or region is set at creation and cannot be changed'],
        ['Users can register applications', 'User settings', 'Yes', 'Revisited in 03-03'],
        ['Restrict access to Microsoft Entra admin center', 'User settings', 'No', 'Hides the portal only. Graph and PowerShell still work: not a security boundary'],
        ['Users can create security groups / Microsoft 365 groups', 'Groups &gt; General', 'Yes', 'Turn off where group sprawl matters'],
        ['Group naming policy and expiration', 'Groups &gt; Naming policy · Expiration', 'Off', 'Microsoft 365 groups only; naming policy needs P1'],
        ['Users may join devices to Microsoft Entra', 'Devices &gt; Device settings', 'All', 'All / Selected / None'],
        ['Require MFA to register or join devices', 'Device settings', 'No', 'Prefer the CA user action <em>Register or join devices</em> (02-02); both on is unsupported'],
        ['Maximum devices per user', 'Device settings', '50', 'Counts joined and registered devices'],
        ['Enable Microsoft Entra LAPS', 'Device settings', 'No', 'Local admin passwords for joined devices']
      ])) +
    S('failure', 'Common failure modes',
      '<p><strong>Scoped admin cannot see the user.</strong> The user is in a group that is in the AU, not in the AU itself.</p>' +
      '<p><strong>Group created for role assignment, option missing.</strong> The group was not created role-assignable. Recreate it; the flag cannot be added.</p>' +
      '<p><strong>Global Administrator cannot edit an executive’s account.</strong> The account is in a restricted management AU. That is the feature working.</p>' +
      '<p><strong>Domain removal fails.</strong> Objects still use it as UPN or proxy address. Move them first.</p>' +
      '<p><strong>A standing User Access Administrator at the Azure root.</strong> Left behind by someone who elevated once. It is invisible from Entra roles; check Azure IAM at root scope.</p>') +
    S('exam', 'How this is tested',
      T('exam', ['Phrase in the question', 'What it steers you to'], [
        ['"reset passwords only for users in the Paris office"', 'AU containing those users + Helpdesk or Password Administrator scoped to it'],
        ['"prevent tenant administrators from modifying executive accounts"', 'Restricted management administrative unit'],
        ['"assign a Microsoft Entra role to a group"', 'Role-assignable group, created with isAssignableToRole'],
        ['"least privileged role to reset MFA for a Global Administrator"', 'Privileged Authentication Administrator'],
        ['"manage credentials of one application only"', 'Custom role (or Application Administrator) scoped to that app object'],
        ['"which roles does the user effectively hold"', 'User &gt; Assigned roles (direct, group, eligible) - union, no deny'],
        ['"prove ownership of a domain"', 'TXT or MX record, then verify'],
        ['"users must see the company logo at sign-in"', 'Company branding']
      ])) +
    S('validation', 'Validation',
      C('powershell', String.raw`
# Effective roles for one user: direct and eligible. Group-based assignments show on the group's principal ID.
$uid = (Get-MgUser -UserId 'alex@lab.contoso.ca').Id
Get-MgRoleManagementDirectoryRoleAssignment -Filter "principalId eq '$uid'" -ExpandProperty RoleDefinition |
    Select-Object @{ n = 'Role'; e = { $_.RoleDefinition.DisplayName } }, DirectoryScopeId
Get-MgRoleManagementDirectoryRoleEligibilitySchedule -Filter "principalId eq '$uid'" -ExpandProperty RoleDefinition |
    Select-Object @{ n = 'Eligible'; e = { $_.RoleDefinition.DisplayName } }, DirectoryScopeId`) +
      C('kql', String.raw`
AuditLogs
| where TimeGenerated > ago(7d)
| where OperationName has "member to role" or OperationName in ("Set domain authentication", "Set federation settings on domain", "Verify domain")
| extend Actor = coalesce(tostring(InitiatedBy.user.userPrincipalName), tostring(InitiatedBy.app.displayName))
| project TimeGenerated, OperationName, Actor, Result, TargetResources
| order by TimeGenerated desc`)) +
    S('sources', 'Sources', '<ul>' + LEARNLI(this) +
      '<li>' + L('Microsoft Entra built-in roles', 'https://learn.microsoft.com/entra/identity/role-based-access-control/permissions-reference') + '</li>' +
      '<li>' + L('Administrative units', 'https://learn.microsoft.com/entra/identity/role-based-access-control/administrative-units') + '</li>' +
      '<li>' + L('Restricted management administrative units', 'https://learn.microsoft.com/entra/identity/role-based-access-control/admin-units-restricted-management') + '</li>' +
      '<li>' + L('Add your custom domain name', 'https://learn.microsoft.com/entra/fundamentals/add-custom-domain') + '</li>' +
      '<li>' + L('Add company branding', 'https://learn.microsoft.com/entra/fundamentals/how-to-customize-branding') + '</li>' +
      '</ul>' + SRCSTAMP(this));
  },
  lab: {
    intro: 'Scope a role three ways - tenant, administrative unit and single application - and prove each boundary by signing in as the scoped admin.',
    steps: [
      '<p>Create six test users: three with <em>State</em> = <code>QC</code>, three with <code>ON</code>, plus <code>alex</code> (no state). Set a usage location on all of them.</p>',
      '<p>Create the dynamic AU <code>AU-Quebec</code> from the module and wait until its membership shows the three QC users.</p>',
      '<p>Assign <strong>Helpdesk Administrator</strong> to alex scoped to AU-Quebec. In a private window, sign in as alex: reset a QC user’s password (succeeds) and an ON user’s (fails).</p>',
      '<p>Create the restricted AU <code>AU-Executives</code> and add one ON user. As your Global Administrator, try to reset that user’s password or edit their job title. Note the message.</p>',
      '<p>Register a throwaway application, create the <em>App Credential Rotator</em> custom role, and assign it to alex scoped to that application only. As alex, add a secret to that app (works) and to any other app (fails).</p>',
      '<p>Open <strong>Users &gt; alex &gt; Assigned roles</strong>. Confirm both scoped assignments appear with their scopes, then run the Validation script and compare.</p>',
      '<p>Configure company branding: a background image, a banner logo and sign-in page text. Test with a private window and your UPN.</p>',
      '<p>Record the defaults, then set: restrict non-admin users from creating security groups, maximum devices per user 20, and leave <em>Require MFA to register or join devices</em> at No (02-02 replaces it with a CA user action). If you own a domain, add and verify it.</p>'
    ],
    teardown: [
      { bucket: '1', title: 'Keep', items: [
        'Keep the users, AUs and branding - 01-02 and 02-02 reuse them' ] },
      { bucket: '2', title: 'Remove', items: [
        'Delete the App Credential Rotator assignment and the throwaway app registration',
        'Remove the custom domain if you will not use it as a UPN suffix in 01-04' ] },
      { bucket: '3', title: 'Verify', items: [
        'The Validation KQL (or the Audit logs blade) shows each <em>Add scoped member to role</em> event you made' ] }
    ]
  },
  quiz: [
    { q: 'Support staff must reset MFA methods for all users, including Global Administrators. Which role follows least privilege?', o: ['Authentication Administrator', 'Privileged Authentication Administrator', 'Helpdesk Administrator', 'Global Administrator'], a: 1, obj: 0,
      why: 'Authentication Administrator cannot act on privileged admins. Privileged Authentication Administrator can reset methods for any user.' },
    { q: 'You need a role that can update credentials on app registrations and nothing else. What do you create?', o: ['A role-assignable group', 'A custom Microsoft Entra role with the applications/credentials/update permission', 'An Azure custom role', 'An administrative unit'], a: 1, obj: 0,
      why: 'Custom Entra roles are composed from Entra permissions such as microsoft.directory/applications/credentials/update. Azure custom roles govern Azure resources, not directory objects.' },
    { q: 'Regional IT in each of five countries must manage only their own users. What should you recommend?', o: ['Five custom roles', 'One administrative unit per country with roles scoped to it', 'Five tenants', 'Dynamic groups with owners'], a: 1, obj: 1,
      why: 'Administrative units exist to restrict role scope to a subset of objects, such as a country.' },
    { q: 'Executives’ accounts must not be modifiable by tenant-level User Administrators or Global Administrators. What do you configure?', o: ['A restricted management administrative unit', 'A role-assignable group', 'Conditional Access for the executives', 'Protected actions'], a: 0, obj: 2,
      why: 'Objects in a restricted management AU can be modified only by administrators assigned at that AU’s scope.' },
    { q: 'A Groups Administrator scoped to an AU can manage a group in the AU but not the group’s members’ user accounts. Why?', o: ['The role lacks user permissions', 'Adding a group to an AU does not bring its members into the AU', 'AUs support devices only', 'Dynamic membership is paused'], a: 1, obj: 2,
      why: 'Group members must be added to the AU individually (or by a dynamic rule) to be in scope.' },
    { q: 'A user holds User Administrator directly and Helpdesk Administrator via a role-assignable group. What are their effective permissions?', o: ['Only the direct role', 'The union of both roles', 'The intersection of both roles', 'Only the group role, which takes precedence'], a: 1, obj: 3,
      why: 'Entra role permissions are additive across all assignments; there is no deny.' },
    { q: 'You add lab.contoso.ca to Microsoft Entra ID. What proves ownership?', o: ['Uploading a certificate', 'Publishing the TXT or MX record Entra provides, then verifying', 'Setting it as the default domain', 'Creating a user with that suffix'], a: 1, obj: 4,
      why: 'Verification checks the DNS record Entra issued. Only then can the domain be a UPN suffix or the default.' },
    { q: 'Users should see the corporate logo and a custom message on the sign-in page, in French for French-language browsers. What do you configure?', o: ['Company branding with a French language customization', 'An application proxy', 'Terms of use', 'Tenant properties'], a: 0, obj: 5,
      why: 'Company branding has a default configuration and per-language overrides.' },
    { q: 'You set "Restrict access to Microsoft Entra admin center" to Yes. What does this prevent?', o: ['Non-admin users reading directory data through Graph', 'Non-admin users browsing the admin center portal', 'Guests signing in', 'Users registering devices'], a: 1, obj: 6,
      why: 'It hides the portal from non-administrators. Graph, PowerShell and other clients are unaffected, so it is not a security control.' }
  ]
});

/* ======================================================================
   01-02  Users, groups, devices and licences
   ====================================================================== */
MODULES.push({
  id: '01-02', domain: '01', title: 'Users, Groups, Custom Security Attributes, Devices and Licences', short: 'Users and Groups',
  group: 'Create, configure, and manage Microsoft Entra identities',
  objectives: [
    'Create, configure, and manage users',
    'Create, configure, and manage groups',
    'Manage custom security attributes',
    'Automate bulk operations by using the Microsoft Entra admin center and PowerShell',
    'Manage device join and device registration in Microsoft Entra ID',
    'Assign, modify, and report on licenses'
  ],
  status: 'GA', verified: '',
  cost: { level: 'none', label: '$0', est: '$0. Directory objects and trial licences. Joining a device is optional and uses one you already own.', meter: 'none' },
  portal: 'Entra admin center &gt; Entra ID &gt; Users · Groups · Custom security attributes · Devices · Billing &gt; Licenses',
  ms: [{ t: "Create, configure, and manage identities", u: "https://learn.microsoft.com/en-us/training/modules/create-configure-manage-identities/" }],
  sdk: '<code>Microsoft.Graph.Users</code> <code>Microsoft.Graph.Groups</code> <code>Microsoft.Graph.Identity.DirectoryManagement</code>',
  kql: '<code>AuditLogs</code> <code>SigninLogs</code>',
  prereq: ['00-01', '01-01'],
  tactical: 'Device registration is persistence. Microsoft Threat Intelligence reported in February 2025 that Storm-2372 switched its device code phishing to the Microsoft Authentication Broker client ID, used the resulting refresh token to request a token for the device registration service, registered an actor-controlled device in Entra ID and obtained a Primary Refresh Token, which it used to collect email. In July 2026 Microsoft assessed Storm-2372 as an initial-access sub-cluster of Midnight Blizzard. In an investigation, <em>Register device</em> and <em>Add registered owner to device</em> events near a suspicious sign-in, a device name that matches nothing in your fleet, or a device registered from the same IP as the phish are the pivot. The controls are the CA user action for device registration and blocking device code flow (02-02).',
  body: function () { return '' +
    S('concept', 'Why this exists',
      '<p>Everything else in SC-300 targets these objects. Conditional Access targets users and groups, licences unlock features per user, device identity feeds <em>require compliant device</em>, and custom security attributes feed attribute-based conditions. Getting their properties right is what makes the later policy objectives work.</p>' +
      vCards([
        { t: 'Cloud user', s: 'Source of authority is Entra. Editable everywhere.', k: 'd1' },
        { t: 'Synced user', s: 'Source of authority is AD DS. Most attributes read-only in Entra.', k: 'd1' },
        { t: 'Guest / external member', s: 'userType Guest or Member, authenticates at home (01-03).', k: 'acc' },
        { t: 'Security group', s: 'Access, CA targeting, licensing. Assigned or dynamic.', k: 'd2' },
        { t: 'Microsoft 365 group', s: 'Shared mailbox, site, Teams. Expiration and naming policy apply.', k: 'd2' },
        { t: 'Device', s: 'Registered, joined or hybrid joined. Carries trustType.', k: 'd3' }
      ], 'The directory objects most questions in this domain act on.')) +
    S('mechanism', 'How it works under the hood',
      '<h3>Users</h3>' +
      '<p>A deleted user goes to <strong>Deleted users</strong> for 30 days and can be restored with its group memberships, licences and role assignments; after that, or after a hard delete, it is gone. <code>usageLocation</code> must be set before a licence can be assigned. Blocking sign-in sets <code>accountEnabled</code> to false but does not end existing sessions - see 02-01 for revocation.</p>' +
      '<h3>Groups</h3>' +
      '<p>Membership is <strong>assigned</strong>, <strong>dynamic user</strong> or <strong>dynamic device</strong> (P1). A dynamic group evaluates a rule such as <code>(user.department -eq "Sales") -and (user.accountEnabled -eq true)</code>; members cannot be added manually, and rule changes reprocess asynchronously. Dynamic groups cannot be role-assignable, and <strong>group-based licensing does not flow through nested groups</strong> - only direct members of the licensed group receive the licence.</p>' +
      C('powershell', String.raw`
$u = @{
    DisplayName = 'Mathieu Roy'; UserPrincipalName = 'mroy@lab.contoso.ca'; MailNickname = 'mroy'
    Department = 'Sales'; UsageLocation = 'CA'; AccountEnabled = $true
    PasswordProfile = @{ Password = 'Temp-' + (New-Guid).Guid; ForceChangePasswordNextSignIn = $true }
}
$user = New-MgUser @u

New-MgGroup -DisplayName 'DYN-Sales' -MailEnabled:$false -MailNickname 'dynsales' -SecurityEnabled:$true -GroupTypes 'DynamicMembership' -MembershipRule '(user.department -eq "Sales") -and (user.accountEnabled -eq true)' -MembershipRuleProcessingState 'On'

# Group-based licensing: every direct member of LIC-E5 gets E5 minus Yammer (example)
$sku = Get-MgSubscribedSku | Where-Object SkuPartNumber -eq 'SPE_E5'
$lic = New-MgGroup -DisplayName 'LIC-E5' -MailEnabled:$false -MailNickname 'lice5' -SecurityEnabled:$true
$off = ($sku.ServicePlans | Where-Object ServicePlanName -eq 'YAMMER_ENTERPRISE').ServicePlanId
Set-MgGroupLicense -GroupId $lic.Id -AddLicenses @(@{ SkuId = $sku.SkuId; DisabledPlans = @($off) }) -RemoveLicenses @()`) +
      '<h3>Custom security attributes</h3>' +
      '<p>Business metadata - project, cost centre, sensitivity - stored in <strong>attribute sets</strong> with typed definitions (string, integer, Boolean; single or multi-valued; optionally restricted to predefined values). They exist to be read by policy: Azure ABAC conditions on storage, and the <em>filter for applications</em> condition in Conditional Access. They are deliberately separate from normal attributes: <strong>Global Administrators cannot read or assign them by default.</strong> Access needs Attribute Definition Administrator (define), Attribute Assignment Administrator (assign) or the reader roles. Definitions cannot be deleted, only deactivated.</p>' +
      C('powershell', String.raw`
New-MgDirectoryAttributeSet -Id 'Engineering' -Description 'Engineering metadata' -MaxAttributesPerSet 25
New-MgDirectoryCustomSecurityAttributeDefinition -AttributeSet 'Engineering' -Name 'Project' -Type 'String' -Status 'Available' -IsCollection:$false -IsSearchable:$true -UsePreDefinedValuesOnly:$false -Description 'Project code name'

Update-MgUser -UserId $user.Id -CustomSecurityAttributes @{
    Engineering = @{ '@odata.type' = '#Microsoft.DirectoryServices.CustomSecurityAttributeValue'; Project = 'Baker' }
}`) +
      '<h3>Bulk operations</h3>' +
      '<p>The admin center offers <strong>Bulk create, Bulk invite, Bulk delete</strong> and <strong>Download users</strong> from CSV templates you download from the same blade, plus bulk add and remove for group members. Each run appears under <strong>Bulk operation results</strong> with per-row errors. For anything conditional or repeatable, PowerShell with <code>Import-Csv</code> is the answer.</p>' +
      C('powershell', String.raw`
Import-Csv .\new-hires.csv | ForEach-Object {
    $p = @{
        DisplayName = $_.DisplayName; UserPrincipalName = $_.UPN; MailNickname = $_.UPN.Split('@')[0]
        Department = $_.Department; UsageLocation = 'CA'; AccountEnabled = $true
        PasswordProfile = @{ Password = 'Temp-' + (New-Guid).Guid; ForceChangePasswordNextSignIn = $true }
    }
    try { New-MgUser @p | Out-Null; "created $($_.UPN)" } catch { "FAILED $($_.UPN): $($_.Exception.Message)" }
}`) +
      '<h3>Devices</h3>' +
      T('compare', ['Identity', 'trustType', 'For', 'How it gets there'], [
        ['Microsoft Entra registered', '<code>Workplace</code>', 'Personal devices (BYOD), iOS, Android, Windows, macOS', 'User adds a work account; Company Portal or Authenticator broker'],
        ['Microsoft Entra joined', '<code>AzureAd</code>', 'Corporate Windows (and macOS with Platform SSO), cloud-first', 'OOBE, Autopilot or Settings &gt; Access work or school'],
        ['Microsoft Entra hybrid joined', '<code>ServerAd</code>', 'Domain-joined Windows that also needs Entra identity', 'Entra Connect device sync + SCP or targeted deployment']
      ]) +
      '<p>A joined or hybrid joined device receives a <strong>Primary Refresh Token</strong> at sign-in, which is what gives Windows SSO to Entra apps and what Conditional Access device conditions read. Stale devices are found by <code>approximateLastSignInDateTime</code>, disabled first, deleted later.</p>' +
      '<h3>Licences</h3>' +
      '<p>Assign directly or through groups (group-based licensing). Group-based licensing reports <strong>errors per user</strong> - no usage location, conflicting service plans, not enough licences - under the group’s <em>Licenses</em> blade, and a user’s <code>licenseAssignmentStates</code> shows whether each licence came directly or from which group. Remove the direct assignment once a group covers a user, or the user keeps the licence when they leave the group.</p>') +
    S('config', 'Configuration surface',
      T('config', ['Control', 'Default', 'Set it to', 'Why'], [
        ['Dynamic rule on a user-editable or broadly writable attribute', '-', 'Key on HR-mastered attributes', 'Anyone who can write the attribute can join the group'],
        ['Microsoft 365 group expiration', 'Off', '180 or 365 days, owners notified', 'Sprawl; renewals are automatic when the group is active'],
        ['Device registration via CA user action', 'None', 'Require MFA (02-02)', 'Stops token-only device registration'],
        ['Stale device cleanup', 'Never', 'Disable after 90 days inactive, delete after 180', 'Stale devices keep BitLocker keys and a trusted identity'],
        ['Custom security attribute roles', 'Nobody, not even Global Administrators', 'Named people only', 'Attributes may drive access decisions'],
        ['Direct and group licence on the same user', '-', 'Group only', 'Direct assignments survive group removal']
      ])) +
    S('failure', 'Common failure modes',
      '<p><strong>Licence assignment fails with "usage location".</strong> Set <code>usageLocation</code> first; group-based licensing shows the same error per user.</p>' +
      '<p><strong>Users in a nested group get no licence.</strong> Group-based licensing ignores nested members.</p>' +
      '<p><strong>Dynamic group is empty after creating it.</strong> Processing is asynchronous and can take a while in large tenants; the rule builder’s <em>Validate rules</em> checks a sample user immediately.</p>' +
      '<p><strong>Global Administrator cannot see custom security attributes.</strong> Assign Attribute Definition or Attribute Assignment Administrator explicitly.</p>' +
      '<p><strong>Bulk create partially fails.</strong> The results page has per-row errors; duplicates and invalid UPN suffixes are the usual cause.</p>') +
    S('exam', 'How this is tested',
      T('exam', ['Phrase in the question', 'What it steers you to'], [
        ['"automatically add users whose department is X"', 'Dynamic user group (P1)'],
        ['"restore a user deleted 10 days ago with group memberships"', 'Deleted users &gt; Restore (within 30 days)'],
        ['"store project code on users and use it in access decisions; restrict who can read it"', 'Custom security attributes'],
        ['"create 500 users from a CSV in the portal"', 'Bulk create with the downloaded template'],
        ['"corporate Windows devices, cloud-only, SSO to Entra apps"', 'Microsoft Entra joined'],
        ['"domain-joined devices must also satisfy require hybrid joined"', 'Microsoft Entra hybrid join (Connect Sync)'],
        ['"personal phones used for email"', 'Microsoft Entra registered'],
        ['"license all Sales users automatically, excluding one service"', 'Group-based licensing on a dynamic group with a disabled service plan'],
        ['"which users have licence assignment errors"', 'Group &gt; Licenses, or licenseAssignmentStates']
      ])) +
    S('validation', 'Validation',
      C('powershell', String.raw`
# Licence report: where each user's licences come from
Get-MgUser -All -Property UserPrincipalName, LicenseAssignmentStates |
    ForEach-Object { foreach ($s in $_.LicenseAssignmentStates) {
        [pscustomobject]@{ UPN = $_.UserPrincipalName; Sku = $s.SkuId; ViaGroup = $s.AssignedByGroup; State = $s.State; Error = $s.Error } } }

# Devices by join type, and stale ones
Get-MgDevice -All -Property DisplayName, TrustType, ApproximateLastSignInDateTime, AccountEnabled |
    Group-Object TrustType | Select-Object Name, Count
Get-MgDevice -All -Filter "approximateLastSignInDateTime le $((Get-Date).AddDays(-90).ToString('yyyy-MM-ddTHH:mm:ssZ'))" | Select-Object DisplayName, TrustType`) +
      C('kql', String.raw`
AuditLogs
| where TimeGenerated > ago(14d)
| where OperationName in ("Register device", "Add registered owner to device", "Add device")
| extend Actor = tostring(InitiatedBy.user.userPrincipalName), Device = tostring(TargetResources[0].displayName)
| project TimeGenerated, OperationName, Actor, Device, Result`)) +
    S('sources', 'Sources', '<ul>' + LEARNLI(this) +
      '<li>' + L('Dynamic membership rules for groups', 'https://learn.microsoft.com/entra/identity/users/groups-dynamic-membership') + '</li>' +
      '<li>' + L('Assign or unassign licenses to a group (Microsoft 365 admin center)', 'https://learn.microsoft.com/microsoft-365/admin/manage/manage-group-licenses') + '</li>' +
      '<li>' + L('Custom security attributes overview', 'https://learn.microsoft.com/entra/fundamentals/custom-security-attributes-overview') + '</li>' +
      '<li>' + L('What is a device identity?', 'https://learn.microsoft.com/entra/identity/devices/overview') + '</li>' +
      '<li>' + L('Microsoft Threat Intelligence: Storm-2372 device code phishing', 'https://www.microsoft.com/security/blog/2025/02/13/storm-2372-conducts-device-code-phishing-campaign/') + '</li>' +
      '</ul>' + SRCSTAMP(this));
  },
  lab: {
    intro: 'Create users in bulk two ways, license them through a dynamic group, tag them with a custom security attribute, and inventory devices.',
    steps: [
      '<p>In <strong>Users &gt; Bulk operations &gt; Bulk create</strong>, download the template, add ten users (five with Department <code>Sales</code>), upload, and review <strong>Bulk operation results</strong>. Fix any failed rows.</p>',
      '<p>Create five more users from a CSV with the <code>Import-Csv</code> script. Deliberately include one duplicate UPN and read the error.</p>',
      '<p>Create the dynamic group <code>DYN-Sales</code>. Use <em>Validate rules</em> against one Sales and one non-Sales user before saving.</p>',
      '<p>Assign the E5 licence to <code>DYN-Sales</code> with one service plan disabled. Remove the usage location from one Sales user and find the licence error on the group’s <strong>Licenses</strong> blade. Put it back and reprocess.</p>',
      '<p>Assign yourself <strong>Attribute Definition Administrator</strong> and <strong>Attribute Assignment Administrator</strong>, then create the <code>Engineering</code> set and <code>Project</code> attribute and assign it to two users. Sign in as another Global Administrator (bg01) and confirm it cannot see the values.</p>',
      '<p>Delete one lab user, then restore it from <strong>Deleted users</strong>. Confirm its group memberships returned.</p>',
      '<p>Optional: on a Windows device you own, add a work account (<strong>Settings &gt; Accounts &gt; Access work or school</strong>) to create an Entra registered device. Find it in <strong>Devices &gt; All devices</strong> and read its join type, then run the device report.</p>'
    ],
    teardown: [
      { bucket: '1', title: 'Keep', items: [
        'Keep the users and <code>DYN-Sales</code> - Conditional Access and governance labs target them' ] },
      { bucket: '2', title: 'Remove', items: [
        'Remove your own Attribute Definition and Assignment Administrator roles once done',
        'Remove the work account from your personal device if you added one, and delete the device object' ] },
      { bucket: '3', title: 'Verify', items: [
        'The licence report shows every Sales user licensed <em>via group</em>, with no direct assignment' ] }
    ]
  },
  quiz: [
    { q: 'A user deleted 12 days ago must be restored with their group memberships. What do you do?', o: ['Recreate the user with the same UPN', 'Restore the user from Deleted users', 'Restore from the AD recycle bin', 'It is not possible after 7 days'], a: 1, obj: 0,
      why: 'Deleted users are soft-deleted for 30 days and restore with memberships and licences.' },
    { q: 'Users must join a group automatically when their department is Finance and leave when it changes. What do you create?', o: ['An assigned security group with an owner', 'A dynamic user group with a department rule', 'An administrative unit', 'A role-assignable group'], a: 1, obj: 1,
      why: 'Dynamic user groups add and remove members as the rule evaluates. Role-assignable groups cannot be dynamic.' },
    { q: 'You must tag users with a project code that feeds access decisions, and only three people may read or change it. What do you use?', o: ['Extension attributes 1-15', 'Custom security attributes with the attribute roles assigned to those three', 'A dynamic group', 'Administrative unit descriptions'], a: 1, obj: 2,
      why: 'Custom security attributes are readable only by holders of the attribute roles - not even Global Administrators by default - and can drive ABAC and CA app filters.' },
    { q: 'You need to create 300 users from a CSV using only the Microsoft Entra admin center. What do you use?', o: ['Bulk create with the downloaded CSV template', 'Bulk invite', 'Entra Connect', 'Download users'], a: 0, obj: 3,
      why: 'Bulk create takes the template CSV; Bulk invite is for external users.' },
    { q: 'Corporate Windows 11 laptops are cloud-only and must get SSO to Entra apps and satisfy device-based Conditional Access. Which device identity?', o: ['Microsoft Entra registered', 'Microsoft Entra joined', 'Microsoft Entra hybrid joined', 'Intune enrolled only'], a: 1, obj: 4,
      why: 'Corporate, cloud-first Windows devices are Entra joined. Registered is for personal devices; hybrid join needs an on-premises domain.' },
    { q: 'Users in a group nested inside LIC-E5 did not receive the licence assigned to LIC-E5. Why?', o: ['Group-based licensing does not support nested groups', 'Usage location is missing', 'The licence is exhausted', 'Dynamic processing is paused'], a: 0, obj: 5,
      why: 'Group-based licensing applies only to direct members of the licensed group.' },
    { q: 'How do you find whether a user\'s licence was assigned directly or inherited from a group?', o: ['The user’s sign-in logs', 'The licenseAssignmentStates property or the user’s Licenses blade', 'Get-MgSubscribedSku', 'The group’s owners'], a: 1, obj: 5,
      why: 'licenseAssignmentStates records the SKU, the assigning group (if any), state and error for each licence.' }
  ]
});

/* ======================================================================
   01-03  External identities and cross-tenant
   ====================================================================== */
MODULES.push({
  id: '01-03', domain: '01', title: 'External Users, Cross-Tenant Access and Cross-Tenant Sync', short: 'External and Cross-Tenant',
  group: 'Implement and manage identities for external users and tenants',
  objectives: [
    'Manage External collaboration settings in Microsoft Entra ID',
    'Invite external users, individually or in bulk',
    'Manage external user accounts in Microsoft Entra ID',
    'Implement Cross-tenant access settings',
    'Implement and manage cross-tenant synchronization',
    'Configure external identity providers, including protocols such as SAML and WS-Fed'
  ],
  status: 'GA', verified: '',
  cost: { level: 'none', label: '$0', est: '$0. Needs a second tenant for the partner side; its own P1/P2 trial covers cross-tenant sync. Do not link a subscription for guest billing.', meter: 'none' },
  portal: 'Entra admin center &gt; Entra ID &gt; External Identities &gt; External collaboration settings · Cross-tenant access settings · Cross-tenant synchronization · All identity providers',
  ms: [{ t: "Implement and manage external identities", u: "https://learn.microsoft.com/en-us/training/modules/implement-manage-external-identities/" }],
  sdk: '<code>Microsoft.Graph.Identity.SignIns</code> <code>Microsoft.Graph.Applications</code>',
  kql: '<code>SigninLogs</code> <code>AuditLogs</code> <code>AADProvisioningLogs</code>',
  prereq: ['00-01', '01-02'],
  tactical: 'Cross-tenant synchronization is a documented persistence technique: security researchers showed in 2023 that an attacker with Global Administrator can add their own tenant as a partner, allow inbound sync and automatic redemption, and push accounts back in at will. Inbound trust settings are the quieter variant - trusting a partner’s MFA and device claims means their compromise satisfies your Conditional Access. In any Entra intrusion, diff the cross-tenant access partner list and each partner’s inbound settings against a known-good baseline.',
  body: function () { return '' +
    S('concept', 'Why this exists',
      '<p>B2B collaboration lets a user from another organisation access your resources with <strong>their own credentials</strong>. Your tenant holds a user object for them (userType Guest by default), but authentication happens at their home IdP. Everything in this group is about who may create those objects, how they sign in, what your tenant trusts about that sign-in, and how to automate it between tenants you own.</p>' +
      T('compare', ['Mechanism', 'Direction', 'Creates an object in the resource tenant?', 'Typical use'], [
        ['B2B collaboration (invite)', 'Inbound', 'Yes, on redemption', 'Partners, contractors, vendors'],
        ['B2B direct connect', 'Both', 'No', 'Teams shared channels with a partner tenant'],
        ['Cross-tenant synchronization', 'Source pushes to target', 'Yes, provisioned automatically, usually as Member', 'Subsidiaries, mergers, multitenant organisations'],
        ['External ID (external tenant)', '-', 'Consumer accounts in a separate tenant', 'Customer-facing apps - not this exam objective']
      ])) +
    S('mechanism', 'How it works under the hood',
      '<h3>External collaboration settings</h3>' +
      T('config', ['Setting', 'Options', 'Default'], [
        ['Guest user access', 'Same as members · Limited access · <strong>Restricted</strong> (own objects only)', 'Limited access'],
        ['Guest invite settings', 'Anyone including guests · Members and specific admin roles · Only specific admin roles (Guest Inviter) · No one', 'Anyone in the organisation'],
        ['Self-service sign-up via user flows', 'On / Off', 'Off'],
        ['External users can leave the organisation', 'Yes / No', 'Yes'],
        ['Collaboration restrictions', 'Allow all · <strong>Deny list</strong> of domains · <strong>Allow list</strong> of domains (one or the other)', 'Allow all']
      ]) +
      '<h3>Invitation and redemption</h3>' +
      '<p>An invitation creates the guest object immediately with <code>externalUserState = PendingAcceptance</code>. On redemption Entra follows a configurable <strong>redemption order</strong>: an Entra account in the guest’s home tenant, a Microsoft account, a SAML/WS-Fed or Google federation matching the domain, then <strong>email one-time passcode</strong> as the fallback. If a guest’s home account changes, <strong>Reset redemption status</strong> lets them redeem again without losing group memberships and app assignments.</p>' +
      C('powershell', String.raw`
New-MgInvitation -InvitedUserEmailAddress 'dana@fabrikam.example' -InvitedUserDisplayName 'Dana (Fabrikam)' -InviteRedirectUrl 'https://myapps.microsoft.com' -SendInvitationMessage:$true

# Bulk: portal Users > Bulk operations > Bulk invite, or:
Import-Csv .\partners.csv | ForEach-Object {
    New-MgInvitation -InvitedUserEmailAddress $_.Email -InvitedUserDisplayName $_.Name -InviteRedirectUrl 'https://myapps.microsoft.com' -SendInvitationMessage:$true }

Get-MgUser -Filter "userType eq 'Guest'" -Property DisplayName, Mail, ExternalUserState, CreatedDateTime | Select-Object DisplayName, Mail, ExternalUserState`) +
      '<h3>Cross-tenant access settings</h3>' +
      '<p>There is a <strong>default</strong> configuration and one <strong>organisational</strong> configuration per partner tenant, each with inbound and outbound settings for B2B collaboration and B2B direct connect. <strong>Inbound trust</strong> accepts the partner’s MFA, compliant device and hybrid joined claims so their users are not prompted twice. <strong>Automatic redemption</strong> suppresses the consent prompt and only works when the home tenant allows it outbound and the resource tenant allows it inbound. <strong>Tenant restrictions v2</strong> is the outbound mirror: it stops your users signing in to other tenants from your managed devices or network.</p>' +
      C('powershell', String.raw`
$partner = 'aaaaaaaa-0000-0000-0000-bbbbbbbbbbbb'     # the partner's tenant ID
New-MgPolicyCrossTenantAccessPolicyPartner -TenantId $partner
Update-MgPolicyCrossTenantAccessPolicyPartner -CrossTenantAccessPolicyConfigurationPartnerTenantId $partner -BodyParameter @{
    inboundTrust                 = @{ isMfaAccepted = $true; isCompliantDeviceAccepted = $true; isHybridAzureADJoinedDeviceAccepted = $false }
    automaticUserConsentSettings = @{ inboundAllowed = $true }
}`) +
      '<h3>Cross-tenant synchronization</h3>' +
      '<p>A provisioning job in the <strong>source</strong> tenant pushes users into the <strong>target</strong> tenant as B2B users (userType <em>Member</em> by default, configurable in attribute mappings). The target must allow it first: in its cross-tenant access settings for the source, <strong>Allow users sync into this tenant</strong> plus inbound automatic redemption. The source enables outbound automatic redemption, creates the configuration, tests connectivity, assigns the users or groups in scope, and starts provisioning. It is one-way, runs on the provisioning service’s cycle, supports <strong>provision on demand</strong> for testing, and writes to the provisioning logs. Multitenant organisations build on it.</p>' +
      C('powershell', String.raw`
# In the TARGET tenant: let the source tenant sync users in
$source = 'cccccccc-0000-0000-0000-dddddddddddd'
Invoke-MgGraphRequest -Method PUT -Uri "v1.0/policies/crossTenantAccessPolicy/partners/$source/identitySynchronization" -Body @{
    userSyncInbound = @{ isSyncAllowed = $true } }`) +
      '<h3>External identity providers</h3>' +
      '<p><strong>SAML/WS-Fed IdP federation</strong> lets guests from a partner whose IdP is not Entra sign in with their own credentials. You configure it per domain with the partner’s issuer URI, passive sign-in endpoint and token-signing certificate (or a metadata URL). The partner domain can be unverified or DNS-verified in Entra. For an unverified domain, users sign in at their own IdP after federation; for an Entra-verified domain, Entra ID stays the primary IdP for invitation redemption unless you change the redemption order in cross-tenant access settings (workforce tenants only). <strong>Google federation</strong> covers Gmail addresses; <strong>email one-time passcode</strong> covers everyone else. Facebook is only for self-service sign-up.</p>') +
    S('config', 'Configuration surface',
      T('config', ['Control', 'Default', 'Set it to', 'Why'], [
        ['Guest user access', 'Limited access', 'Restricted access', 'Guests cannot enumerate your directory'],
        ['Guest invite settings', 'Anyone in the organisation', 'Member users and specific admin roles', 'Guests inviting guests is how sprawl starts'],
        ['Collaboration restrictions', 'Allow all', 'Deny list of consumer or competitor domains, or an allow list', 'Only one list type at a time'],
        ['Inbound trust for a partner', 'Nothing trusted', 'MFA only, for partners whose MFA you have reviewed', 'Their compromise satisfies your policy'],
        ['B2B direct connect default', 'Blocked', 'Leave blocked; allow per partner', 'No guest object means your reviews never see them'],
        ['Email one-time passcode', 'On', 'On', 'The fallback that makes invites always redeemable']
      ])) +
    S('failure', 'Common failure modes',
      '<p><strong>Cross-tenant sync fails on "not allowed".</strong> The target never enabled inbound user sync for the source, or automatic redemption is missing on one side.</p>' +
      '<p><strong>Partner users prompted for MFA twice.</strong> Inbound MFA trust is not enabled for that partner.</p>' +
      '<p><strong>SAML IdP federation cannot be saved for a domain.</strong> The domain is verified in an Entra tenant; use B2B with that tenant instead.</p>' +
      '<p><strong>Guest cannot redeem after moving companies.</strong> Reset redemption status rather than deleting and reinviting, which loses their access.</p>' +
      '<p><strong>Allow list configured, deny list vanished.</strong> They are mutually exclusive.</p>') +
    S('exam', 'How this is tested',
      T('exam', ['Phrase in the question', 'What it steers you to'], [
        ['"guests must not see other users in the directory"', 'Guest user access: restricted'],
        ['"only allow invitations to fabrikam.com"', 'Collaboration restrictions: allow list'],
        ['"invite 200 partner users from a CSV"', 'Bulk invite (or New-MgInvitation in a loop)'],
        ['"partner users should not be prompted for MFA again"', 'Cross-tenant access, inbound trust: accept MFA'],
        ['"automatically provision subsidiary users as members"', 'Cross-tenant synchronization'],
        ['"users collaborate in Teams shared channels without guest accounts"', 'B2B direct connect'],
        ['"block users from signing in to unknown tenants from corporate devices"', 'Tenant restrictions v2'],
        ['"partner uses a non-Microsoft SAML IdP"', 'SAML/WS-Fed IdP federation'],
        ['"guest changed email provider and cannot sign in"', 'Reset redemption status']
      ])) +
    S('validation', 'Validation',
      C('kql', String.raw`
// Sign-ins that crossed a tenant boundary, in either direction
SigninLogs
| where TimeGenerated > ago(7d)
| where CrossTenantAccessType != "none" and isnotempty(CrossTenantAccessType)
| summarize count() by CrossTenantAccessType, HomeTenantId, ResourceTenantId, ResultType`) +
      C('kql', String.raw`
AADProvisioningLogs
| where TimeGenerated > ago(1d)
| project TimeGenerated, JobId, ProvisioningAction, ResultType, SourceIdentity, TargetIdentity, ResultDescription`)) +
    S('sources', 'Sources', '<ul>' + LEARNLI(this) +
      '<li>' + L('External collaboration settings', 'https://learn.microsoft.com/entra/external-id/external-collaboration-settings-configure') + '</li>' +
      '<li>' + L('Cross-tenant access overview', 'https://learn.microsoft.com/entra/external-id/cross-tenant-access-overview') + '</li>' +
      '<li>' + L('Configure cross-tenant synchronization', 'https://learn.microsoft.com/entra/identity/multi-tenant-organizations/cross-tenant-synchronization-configure') + '</li>' +
      '<li>' + L('Federation with SAML/WS-Fed identity providers', 'https://learn.microsoft.com/entra/external-id/direct-federation') + '</li>' +
      '<li>' + L('Reset redemption status for a guest user', 'https://learn.microsoft.com/entra/external-id/reset-redemption-status') + '</li>' +
      '</ul>' + SRCSTAMP(this));
  },
  lab: {
    intro: 'You need a second tenant to play the partner. Create a free Entra tenant (Manage tenants &gt; Create) and start a P2 trial in it, or use a colleague’s lab tenant.',
    steps: [
      '<p>Set guest user access to <strong>Restricted</strong> and guest invite settings to <strong>Member users and users assigned to specific admin roles</strong>. Add a deny list containing one domain.</p>',
      '<p>Invite a personal Microsoft account or Gmail address with <code>New-MgInvitation</code>. Before redeeming, read the guest’s <em>externalUserState</em>. Redeem it and read it again.</p>',
      '<p>Bulk invite three addresses from the downloaded template. Try one on the deny list and read the failure.</p>',
      '<p>Reset the redemption status of the first guest and redeem again with the same address. Confirm group memberships survived.</p>',
      '<p>Add the second tenant as an organisational setting. Enable inbound MFA trust. Sign in as a user from the second tenant to an app in yours and find the sign-in with its <em>Cross tenant access type</em>.</p>',
      '<p>Configure cross-tenant sync with your lab tenant as <strong>source</strong>: enable inbound user sync and inbound automatic redemption in the target, outbound automatic redemption in the source, create the configuration, test connection, assign <code>DYN-Sales</code>, and <strong>provision on demand</strong> for one user.</p>',
      '<p>Open <strong>External Identities &gt; All identity providers &gt; SAML/WS-Fed</strong> and walk through adding one without saving: note the fields (domain, issuer URI, passive endpoint, certificate or metadata URL).</p>'
    ],
    teardown: [
      { bucket: '1', title: 'Configuration', items: [
        'Stop and delete the cross-tenant sync configuration in the source tenant',
        'Remove the partner organisational setting from both tenants',
        'Delete the synced users in the target tenant and the guests in yours' ] },
      { bucket: '2', title: 'Keep', items: [
        'Keep restricted guest access and the invite restriction - they are the right defaults' ] },
      { bucket: '3', title: 'Verify', items: [
        'Cross-tenant access settings show only the default configuration in both tenants' ] }
    ]
  },
  quiz: [
    { q: 'Guests must not be able to enumerate users and groups in your directory. What do you configure?', o: ['Guest invite settings: No one', 'Guest user access: Restricted access', 'A deny list', 'Conditional Access for guests'], a: 1, obj: 0,
      why: 'Restricted access limits guests to their own directory objects. Invite settings control who can invite, not what guests see.' },
    { q: 'You must invite 150 contractors listed in a spreadsheet, using only the admin center. What do you use?', o: ['Bulk create', 'Bulk invite', 'Cross-tenant synchronization', 'Entra Connect'], a: 1, obj: 1,
      why: 'Bulk invite takes a CSV of external email addresses and sends invitations. Bulk create is for member users.' },
    { q: 'A guest’s email moved from a Gmail address to a Microsoft 365 account at their company. They must keep existing access. What do you do?', o: ['Delete and reinvite the guest', 'Reset redemption status', 'Convert the guest to a member', 'Add a SAML IdP'], a: 1, obj: 2,
      why: 'Resetting redemption lets the user redeem again with a new home account while keeping memberships and app assignments.' },
    { q: 'Users from a partner tenant are prompted for MFA in your tenant even though they completed MFA at home. What fixes it?', o: ['Disable Conditional Access for guests', 'Enable inbound trust for MFA in cross-tenant access settings for that partner', 'Enable B2B direct connect', 'Add the partner to the allow list'], a: 1, obj: 3,
      why: 'Inbound trust lets your Conditional Access accept MFA claims from the partner’s tenant.' },
    { q: 'Employees of a subsidiary tenant must appear automatically in the parent tenant as members and be removed when they leave. What do you implement?', o: ['Bulk invite on a schedule', 'Cross-tenant synchronization from the subsidiary to the parent', 'B2B direct connect', 'SAML IdP federation'], a: 1, obj: 4,
      why: 'Cross-tenant sync provisions and deprovisions users from source to target, as Member by default. A B2B user who already exists in the target keeps their userType unless the mapping’s Apply this mapping is set to Always.' },
    { q: 'Cross-tenant sync provisioning fails with a policy error. In which tenant, and where, is the missing setting most likely?', o: ['Source tenant, attribute mappings', 'Target tenant, cross-tenant access settings: allow users sync into this tenant', 'Source tenant, external collaboration settings', 'Target tenant, company branding'], a: 1, obj: 4,
      why: 'The target must explicitly allow inbound user sync for the source tenant.' },
    { q: 'A partner uses a third-party SAML 2.0 IdP and its domain is not verified in any Entra tenant. Partner users must sign in with their corporate credentials. What do you configure?', o: ['Google federation', 'SAML/WS-Fed IdP federation for the partner domain', 'Email one-time passcode', 'Cross-tenant synchronization'], a: 1, obj: 5,
      why: 'SAML/WS-Fed IdP federation is configured per domain. It works with unverified domains, as here, and now also with Entra-verified domains, where Entra ID remains the primary IdP for invitation redemption unless the redemption order is changed.' }
  ]
});

/* ======================================================================
   01-04  Hybrid identity
   ====================================================================== */
MODULES.push({
  id: '01-04', domain: '01', title: 'Hybrid Identity: Connect Sync, Cloud Sync and Sign-in Methods', short: 'Hybrid Identity',
  group: 'Implement and manage hybrid identity',
  objectives: [
    'Implement and manage Microsoft Entra Connect Sync',
    'Implement and manage Microsoft Entra Cloud Sync',
    'Implement and manage password hash synchronization',
    'Implement and manage pass-through authentication',
    'Implement and manage seamless single sign-on (SSO)',
    'Migrate from AD FS to other authentication and authorization mechanisms',
    'Implement and manage Microsoft Entra Connect Health'
  ],
  status: 'GA', verified: '',
  cost: { level: 'mid', label: 'Medium', est: 'About US$2-3 a day for two small Windows Server VMs if left running; cents a day deallocated (disks only). Or run both on Hyper-V at home for $0. The same VMs serve 03-02 and 02-05.', meter: 'hourly · 2 VMs + disks' },
  portal: 'Entra admin center &gt; Entra ID &gt; Entra Connect · Cloud sync · Connect Health · Hybrid management',
  ms: [{ t: "Implement and manage hybrid identity", u: "https://learn.microsoft.com/en-us/training/modules/implement-manage-hybrid-identity/" }],
  sdk: '<code>ADSync</code> (on the Connect server) <code>Microsoft.Graph</code> <code>Az.Compute</code>',
  kql: '<code>SigninLogs</code> <code>AuditLogs</code> <code>AADProvisioningLogs</code>',
  prereq: ['00-01', '01-01'],
  tactical: 'Treat the Entra Connect server as a domain controller. Its AD DS connector account holds directory replication rights so that password hash sync can read hashes. Microsoft reported in 2024, with high confidence, that the ransomware operator Storm-0501 located Entra Connect Sync servers and extracted the plaintext credentials of the cloud and on-premises sync accounts - a position from which an attacker can set or change Entra ID passwords for hybrid accounts and pivot from on-premises into the cloud. A Connect server outside Tier 0, or a sync account signing in from anywhere but that server, is an incident.',
  body: function () { return '' +
    S('concept', 'Why this exists',
      '<p>Most organisations still master identities in Active Directory. Hybrid identity is two separate decisions that questions deliberately blur: <strong>how objects get into Entra</strong> (Connect Sync or Cloud Sync) and <strong>how the password is checked</strong> (password hash sync, pass-through authentication or federation). Seamless SSO and Connect Health are add-ons to the first decision; AD FS migration is moving off federation in the second.</p>' +
      Q('warn', '<strong>' + DUE('2026-10-01', 'Deadline: September 30, 2026.', 'Minimum version in force since September 30, 2026.') + '</strong> Every Entra Connect Sync server must run version 2.5.79.0 or later, or all synchronization stops until it is upgraded. Do not stop at the floor: 2.5.79.0 itself ' + DUE('2026-10-23', 'reaches', 'reached') + ' end of support on October 23, 2026, so install the latest build. The installer is available only from the Microsoft Entra admin center.')) +
    S('mechanism', 'How it works under the hood',
      '<h3>Connect Sync versus Cloud Sync</h3>' +
      T('compare', ['', 'Microsoft Entra Connect Sync', 'Microsoft Entra Cloud Sync'], [
        ['Engine', 'Full sync engine on your server: connectors, metaverse, SQL (LocalDB up to 100,000 objects)', 'Lightweight provisioning agent; configuration and engine in the cloud'],
        ['High availability', 'One active server plus <strong>staging mode</strong> servers', 'Multiple active agents'],
        ['Disconnected forests', 'Harder (needs line of sight)', '<strong>Designed for it</strong> - an agent per forest'],
        ['Device objects / hybrid join', 'Yes', 'No'],
        ['Pass-through authentication', 'Yes', 'No'],
        ['Custom sync rules', 'Sync Rules Editor', 'Attribute mapping expressions only'],
        ['Password hash sync, password writeback, Exchange hybrid writeback', 'Yes', 'Yes'],
        ['Cycle', 'Delta every 30 minutes by default', 'Every 2 minutes for changes']
      ]) +
      '<p>They can run side by side for <strong>different</strong> objects - for example Connect Sync for the main forest and Cloud Sync for an acquired, disconnected forest - but never for the same objects. Microsoft’s direction is Cloud Sync; Connect Sync remains required for the features in the table it alone supports.</p>' +
      C('powershell', String.raw`
# On the Connect Sync server
Import-Module ADSync
Get-ADSyncScheduler                              # cycle interval, next run, staging mode, SyncCycleEnabled
Start-ADSyncSyncCycle -PolicyType Delta          # Initial only after filtering or rule changes
Set-ADSyncScheduler -SyncCycleEnabled $false     # pause before maintenance; set back to $true after
Get-ADSyncConnectorRunStatus`) +
      '<h3>Three ways to check a password</h3>' +
      '<p><strong>Password hash sync</strong> never sends the password or the NT hash: it syncs a hash of the NT hash (salted, 1,000 iterations of HMAC-SHA256) every two minutes. Authentication then happens entirely in the cloud, so it survives an on-premises outage and is what makes <strong>leaked credentials detection</strong> in ID Protection possible. It is Microsoft’s recommended method, and worth enabling as a backup even when you use PTA or federation.</p>' +
      '<p><strong>Pass-through authentication</strong> keeps validation on-premises: agents on your servers hold an outbound connection to Entra, pick up the encrypted credential and validate it against a DC. It enforces on-premises account states (disabled, expired, logon hours) instantly, at the cost of dependency on agents and DCs. Deploy at least three agents. Set Entra smart lockout below the AD lockout threshold so that cloud lockout triggers first and attackers cannot lock accounts in AD.</p>' +
      '<p><strong>Seamless SSO</strong> gives domain-joined devices on the corporate network a silent sign-in by presenting a Kerberos ticket for the <code>AZUREADSSOACC</code> computer account. It works with PHS or PTA, not federation. That account’s Kerberos key is effectively a secret shared with Entra - roll it over at least every 30 days with <code>Update-AzureADSSOForest</code>. On Entra joined and hybrid joined Windows devices the PRT already provides SSO, which is why Defender for Identity now recommends disabling Seamless SSO where it is no longer needed.</p>' +
      '<h3>Migrating from AD FS</h3>' +
      vFlow([
        { t: 'Inventory', s: 'AD FS application activity report (needs Connect Health for AD FS)', k: 'd1' },
        { t: 'Move apps', s: 'Relying parties to Entra enterprise apps (SAML/OIDC); claim rules to CA', k: 'd1' },
        { t: 'Pick a method', s: 'Enable PHS (or PTA) now, as a backup', k: 'd2' },
        { t: 'Staged rollout', s: 'Pilot groups sign in to Entra directly while the domain stays federated', k: 'd2' },
        { t: 'Convert', s: 'Domain federated to managed', k: 'ok' },
        { t: 'Decommission', s: 'Remove the Microsoft 365 relying party trust, then AD FS', k: 'ok' }
      ], 'The order Microsoft’s migration guidance follows. Staged rollout is the step exam questions ask about.') +
      '<p><strong>Entra Connect Health</strong> (P1) adds monitoring agents for sync, AD FS and AD DS: alerts, sync error reports (duplicate attributes, data mismatches), sync latency and, for AD FS, the risky IP and application activity reports. The sync agent is installed with Connect; AD FS and AD DS agents are separate installs.</p>') +
    S('config', 'Configuration surface',
      T('config', ['Control', 'Default', 'Set it to', 'Why'], [
        ['Connect Sync version', 'Whatever was installed', 'The latest build', '2.5.79.0 is mandatory by September 30, 2026 and itself out of support October 23, 2026'],
        ['Staging mode server', 'None', 'One, same config', 'Warm standby and a safe place to test rule changes'],
        ['OU / attribute filtering', 'Whole forest', 'Only OUs with real users and groups', 'Service accounts and admins do not belong in the cloud'],
        ['Password hash sync', 'On in express install', 'On, even with PTA or federation', 'Backup sign-in and leaked credential detection'],
        ['PTA agents', 'One (on the Connect server)', 'Three or more', 'Every sign-in depends on them'],
        ['Seamless SSO key rollover', 'Never', 'Every 30 days', 'The key is a standing Kerberos secret'],
        ['Staged rollout', 'Off', 'Pilot groups during AD FS migration', 'Test cloud authentication without converting the domain'],
        ['Accidental delete threshold', '500 objects', 'Keep, tune to your size', 'Stops a bad filter change deleting the cloud directory']
      ])) +
    S('failure', 'Common failure modes',
      '<p><strong>Users sync with <code>@tenant.onmicrosoft.com</code> UPNs.</strong> Their AD UPN suffix is not a verified domain in Entra. Add a routable UPN suffix in AD and verify the domain.</p>' +
      '<p><strong>Sync stopped deleting after a filter change.</strong> The accidental delete threshold fired. Confirm the deletions are intended before allowing them.</p>' +
      '<p><strong>Everyone fails sign-in with PTA.</strong> The only agent is down. That is why PHS is the recommended backup.</p>' +
      '<p><strong>Seamless SSO never happens.</strong> <code>https://autologon.microsoftazuread-sso.com</code> is not in the browser’s Intranet zone via policy, or the device is off the corporate network.</p>' +
      '<p><strong>Duplicate attribute errors.</strong> Two AD objects share a UPN or proxy address. Connect Health lists them.</p>' +
      '<p><strong>Edited an out-of-box sync rule.</strong> Upgrades overwrite it. Clone it, give the clone a lower precedence number, and disable the original.</p>') +
    S('exam', 'How this is tested',
      T('exam', ['Phrase in the question', 'What it steers you to'], [
        ['"minimise on-premises infrastructure", "sign-in must survive an on-premises outage"', 'Password hash synchronization'],
        ['"detect leaked credentials"', 'Password hash sync (even alongside PTA or federation)'],
        ['"on-premises account policies and logon hours must be enforced at sign-in"', 'Pass-through authentication'],
        ['"several disconnected forests", "lightweight agent"', 'Cloud Sync'],
        ['"hybrid join", "sync device objects", "custom sync rules"', 'Connect Sync'],
        ['"high availability for the sync server"', 'Connect Sync staging mode (or multiple Cloud Sync agents)'],
        ['"domain-joined PCs on the corporate network sign in silently"', 'Seamless SSO'],
        ['"test cloud authentication for a pilot group before converting the federated domain"', 'Staged rollout'],
        ['"identify which AD FS relying parties can move to Entra"', 'AD FS application activity report (Connect Health)'],
        ['"alerts on sync errors and AD FS failures"', 'Microsoft Entra Connect Health']
      ])) +
    S('validation', 'Validation',
      C('powershell', String.raw`
# From any admin workstation
Get-MgOrganization | Select-Object OnPremisesSyncEnabled, OnPremisesLastSyncDateTime, OnPremisesLastPasswordSyncDateTime
Get-MgUser -Filter "onPremisesSyncEnabled eq true" -CountVariable n -ConsistencyLevel eventual -Top 1 | Out-Null; "synced users: $n"`) +
      C('kql', String.raw`
// How synced users actually authenticated: PHS and PTA show as different authentication details
SigninLogs
| where TimeGenerated > ago(1d)
| mv-expand AuthenticationDetails
| extend Method = tostring(AuthenticationDetails.authenticationMethod), Detail = tostring(AuthenticationDetails.authenticationStepResultDetail)
| where Method in ("Password", "Password Hash Sync", "Pass-through Authentication", "Seamless SSO")
| summarize count() by Method, Detail`) +
      C('kql', String.raw`
// The sync account should only ever sign in from the Connect server
SigninLogs
| where TimeGenerated > ago(30d)
| where UserPrincipalName startswith "Sync_" or AppDisplayName has "Microsoft Entra AD Synchronization"
| summarize count(), IPs = make_set(IPAddress) by UserPrincipalName, AppDisplayName`)) +
    S('sources', 'Sources', '<ul>' + LEARNLI(this) +
      '<li>' + L('Entra Connect version history (mandatory upgrade notice)', 'https://learn.microsoft.com/entra/identity/hybrid/connect/reference-connect-version-history') + '</li>' +
      '<li>' + L('What is Microsoft Entra Cloud Sync?', 'https://learn.microsoft.com/entra/identity/hybrid/cloud-sync/what-is-cloud-sync') + '</li>' +
      '<li>' + L('Password hash synchronization', 'https://learn.microsoft.com/entra/identity/hybrid/connect/how-to-connect-password-hash-synchronization') + '</li>' +
      '<li>' + L('Pass-through authentication', 'https://learn.microsoft.com/entra/identity/hybrid/connect/how-to-connect-pta') + '</li>' +
      '<li>' + L('Seamless single sign-on', 'https://learn.microsoft.com/entra/identity/hybrid/connect/how-to-connect-sso') + '</li>' +
      '<li>' + L('Migrate from federation to cloud authentication', 'https://learn.microsoft.com/entra/identity/hybrid/connect/migrate-from-federation-to-cloud-authentication') + '</li>' +
      '<li>' + L('Microsoft Threat Intelligence: Storm-0501 in hybrid environments', 'https://www.microsoft.com/security/blog/2024/09/26/storm-0501-ransomware-attacks-expanding-to-hybrid-cloud-environments/') + '</li>' +
      '</ul>' + SRCSTAMP(this));
  },
  lab: {
    intro: 'Build a one-DC forest and a sync server, sync one OU with password hash sync, switch to PTA, add Seamless SSO, then sync a second OU with Cloud Sync. AD FS migration is a planning exercise: building AD FS properly needs certificates and more servers than it teaches.',
    steps: [
      '<p>Create a resource group, a VNet and two Windows Server 2022 or 2025 VMs (Standard_B2s is enough): <code>dc01</code> and <code>sync01</code>. Restrict RDP to your own IP, or use Bastion Developer (free). Set the VNet DNS to dc01’s private IP.</p>',
      '<p>On dc01: <code>Install-WindowsFeature AD-Domain-Services -IncludeManagementTools</code>, then <code>Install-ADDSForest -DomainName corp.lab.local</code>. Add a UPN suffix that matches a verified domain from 01-01 if you have one. Create OUs <code>Synced</code> and <code>CloudSync</code> with three users each.</p>',
      '<p>Join sync01 to the domain. Download Entra Connect from <strong>Entra ID &gt; Entra Connect &gt; Connect Sync</strong> in the Entra admin center, run a <strong>custom</strong> install, choose <strong>Password hash synchronization</strong> and <strong>Enable single sign-on</strong>, and filter to the <code>Synced</code> OU only.</p>',
      '<p>After the first cycle, confirm the three users appear with <em>On-premises sync enabled: Yes</em>. Change one user’s title in AD, run <code>Start-ADSyncSyncCycle -PolicyType Delta</code>, and watch it arrive.</p>',
      '<p>Rerun the Connect wizard, choose <strong>Change user sign-in</strong>, select <strong>Pass-through authentication</strong> and keep password hash sync enabled. Sign in as a synced user and find the method in the sign-in log.</p>',
      '<p>Add <code>https://autologon.microsoftazuread-sso.com</code> to the Intranet zone by GPO, sign in to dc01 as a synced user, open a private browser window to myapps.microsoft.com and confirm no password prompt.</p>',
      '<p>In <strong>Cloud sync</strong>, download the provisioning agent, install it on dc01 (lab only - production uses member servers), and create a configuration scoped to the <code>CloudSync</code> OU with password hash sync. Provision one user on demand.</p>',
      '<p>Open <strong>Connect Health &gt; Sync services</strong>. Create a sync error on purpose - give two AD users the same <code>proxyAddresses</code> value - and find it in the error report.</p>',
      '<p>Planning exercise: write the six-step AD FS migration for a tenant with 40 relying parties and 2,000 users, naming which step uses staged rollout and which uses the application activity report.</p>'
    ],
    teardown: [
      { bucket: '1', title: 'Now', items: [
        'Deallocate both VMs: <code>Stop-AzVM -ResourceGroupName rg-sc300-hybrid -Name dc01 -Force</code> (and sync01)' ] },
      { bucket: '2', title: 'After 03-02 and 02-05', items: [
        'Turn off directory synchronization so synced users become cloud objects: <code>Invoke-MgGraphRequest -Method PATCH -Uri "beta/organization/$orgId" -Body @{ onPremisesSyncEnabled = $false }</code> (can take up to 72 hours)',
        'Delete the Cloud Sync configuration',
        'Delete the resource group: <code>Remove-AzResourceGroup -Name rg-sc300-hybrid -Force</code>' ] },
      { bucket: '3', title: 'Verify', items: [
        '<code>Get-AzVM</code> returns nothing in the subscription',
        '<strong>Check Cost Management tomorrow, not today.</strong>' ] }
    ]
  },
  quiz: [
    { q: 'You need high availability for Entra Connect Sync. What do you deploy?', o: ['A second active Connect Sync server', 'A Connect Sync server in staging mode', 'Two PTA agents', 'Connect Health'], a: 1, obj: 0,
      why: 'Only one Connect Sync server can be active; a staging-mode server holds the same configuration and can be promoted.' },
    { q: 'A company acquired three forests with no network connectivity between them. It wants a lightweight agent in each. What do you use?', o: ['Connect Sync with three connectors', 'Cloud Sync with an agent per forest', 'Cross-tenant synchronization', 'AD FS'], a: 1, obj: 1,
      why: 'Cloud Sync is designed for disconnected forests, with agents that do not need line of sight to each other.' },
    { q: 'The security team wants ID Protection to detect leaked credentials. Users authenticate with PTA. What must you add?', o: ['Seamless SSO', 'Password hash synchronization', 'Staged rollout', 'Connect Health for AD DS'], a: 1, obj: 2,
      why: 'Leaked credentials detection compares against synced hashes, so PHS must be enabled even if PTA remains the sign-in method.' },
    { q: 'Sign-in must immediately respect on-premises account lockout, disabled state and logon hours, without federation servers. Which method?', o: ['Password hash synchronization', 'Pass-through authentication', 'Seamless SSO', 'Cloud Sync'], a: 1, obj: 3,
      why: 'PTA validates against a domain controller in real time; PHS only learns of state changes at the next sync.' },
    { q: 'Domain-joined Windows 10 devices on the corporate network should sign in to Microsoft 365 without a password prompt. Devices are not hybrid joined. What do you enable?', o: ['Seamless SSO', 'Staged rollout', 'Password writeback', 'Cloud Sync'], a: 0, obj: 4,
      why: 'Seamless SSO uses a Kerberos ticket for the AZUREADSSOACC account to sign users in silently.' },
    { q: 'How often should the Seamless SSO Kerberos decryption key be rolled over?', o: ['Never', 'At least every 30 days', 'Every 2 minutes', 'Only after an incident'], a: 1, obj: 4,
      why: 'Microsoft recommends rolling over the AZUREADSSOACC key at least every 30 days.' },
    { q: 'You are moving from AD FS to PHS and want a pilot group to authenticate in the cloud while the domain stays federated. What do you use?', o: ['Convert the domain to managed', 'Staged rollout', 'Cross-tenant access settings', 'A new Connect Sync server'], a: 1, obj: 5,
      why: 'Staged rollout sends selected groups to cloud authentication without converting the federated domain.' },
    { q: 'You need a report of AD FS relying parties and whether each can migrate to Microsoft Entra ID. What is required?', o: ['Entra Connect Health agent for AD FS', 'Cloud Sync', 'Seamless SSO', 'Tenant restrictions'], a: 0, obj: 5,
      why: 'The AD FS application activity report is fed by the Connect Health for AD FS agent.' },
    { q: 'You want alerts when synchronization errors such as duplicate proxy addresses occur. What do you use?', o: ['Microsoft Entra Connect Health', 'ID Protection', 'Access reviews', 'Defender for Cloud Apps'], a: 0, obj: 6,
      why: 'Connect Health for sync reports sync errors and raises alerts.' }
  ]
});
